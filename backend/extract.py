"""extract.py — LLM extraction of academic deadlines from email.

Strict JSON-only contract: the model is commanded to reply with a single JSON
object and nothing else (no markdown, no code fences). `response_format` json_object
enforces parseability at the API level. Non-deadline emails yield `null` and are
skipped, so the widget only ever shows actionable cards.
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import json
import os
import re
from pathlib import Path

import requests

DEADLINE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$")

SYSTEM_PROMPT = (
    "You are a strict JSON extraction engine. Respond with ONLY a valid JSON "
    "object and nothing else. No markdown, no code fences, no commentary, no "
    "trailing text. Every response must parse as JSON."
)

USER_PROMPT = """JUST A JSON PROMPT ONLY. Extract academic deadline information from this email and return a single JSON object.

EMAIL:
{email_json}

TARGET SCHEMA (return exactly these keys):
{{
  "subject": "string — the email subject as-is",
  "course_code": "string — best guess of the course, e.g. 'MatE 183' or 'College of Engineering'; empty string if unknown",
  "sender": "string — the sender as-is",
  "deadline_date": "YYYY-MM-DD HH:mm or null — the submission/deadline datetime; use a reasonable default time (e.g. 23:59) if only a date is given; MUST be null if the email contains no academic deadline",
  "action_summary": "string — short imperative phrase of what the student must do, e.g. 'Submit assignment', 'Prepare for quiz', 'Read chapter 4'; 'No action' when there is no deadline"
}}

CRITICAL RULE: if the email contains NO actionable academic deadline, respond with the literal JSON value null (not an object)."""


def get_api_key() -> str | None:
    """DEEPSEEK_API_KEY env, else parse ~/.reasonix/.env (never print it)."""
    key = os.environ.get("DEEPSEEK_API_KEY")
    if key:
        return key
    env_file = Path.home() / ".reasonix" / ".env"
    if env_file.is_file():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                if k.strip() == "DEEPSEEK_API_KEY" and v.strip():
                    return v.strip()
    return None


def _base_url() -> str:
    return os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")


def _model() -> str:
    return os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")


def _extract_one(email: dict, api_key: str, base: str, model: str) -> tuple[dict | None, str | None]:
    """Returns (card_or_None, error_or_None)."""
    email_json = json.dumps(
        {k: email.get(k, "") for k in ("subject", "sender", "received_at", "body_snippet")},
        ensure_ascii=False,
    )
    try:
        resp = requests.post(
            f"{base}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": USER_PROMPT.format(email_json=email_json)},
                ],
                "temperature": 0,
                "max_tokens": 300,
                "response_format": {"type": "json_object"},
            },
            timeout=40,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as exc:  # noqa: BLE001 — per-email failure is non-fatal
        return None, f"LLM call failed: {exc}"

    try:
        data = json.loads(content)
    except json.JSONDecodeError as exc:
        # Models sometimes emit an empty reply instead of the literal `null`
        # for "no deadline" — that is a silent skip, not an error.
        if content.strip() == "":
            return None, None
        return None, f"non-JSON reply: {content[:120]!r}"

    if data is None:
        return None, None  # no academic deadline — intentionally skipped
    if not isinstance(data, dict):
        return None, f"unexpected JSON shape: {content[:120]!r}"

    card = _sanitize(data, email)
    if card is None:
        return None, f"invalid card after sanitize: {content[:120]!r}"
    return card, None


def _sanitize(data: dict, email: dict) -> dict | None:
    subject = str(data.get("subject") or email.get("subject") or "").strip()
    if not subject:
        return None
    deadline = str(data.get("deadline_date") or "").strip()
    if deadline and not DEADLINE_RE.match(deadline):
        deadline = None
    action = str(data.get("action_summary") or "").strip() or "No action"
    # Enforce the critical rule at code level: no deadline + no action = not a card.
    if not deadline and action.lower() in ("no action", "none", "n/a"):
        return None
    return {
        "subject": subject[:200],
        "course_code": str(data.get("course_code") or "").strip()[:100],
        "sender": str(data.get("sender") or email.get("sender") or "").strip()[:200],
        "deadline_date": deadline or None,
        "action_summary": action[:200],
    }


def extract_deadlines(emails: list[dict], max_workers: int = 3) -> tuple[list[dict], list[str]]:
    """One LLM call per email (parallel). Returns (cards, errors)."""
    if not emails:
        return [], []
    api_key = get_api_key()
    if not api_key:
        return [], ["DEEPSEEK_API_KEY not found (env or ~/.reasonix/.env)"]
    base, model = _base_url(), _model()

    cards: list[dict] = []
    errors: list[str] = []
    with cf.ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {
            pool.submit(_extract_one, email, api_key, base, model): email
            for email in emails
        }
        for fut in cf.as_completed(futures):
            email = futures[fut]
            card, err = fut.result()
            if err:
                errors.append(f"[{email.get('message_id', '?')}] {err}")
            elif card is not None:
                card["email_id"] = email.get("db_id") or email.get("email_id")
                cards.append(card)
    return cards, errors


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="LLM-extract deadlines from fixture emails.")
    parser.add_argument("--fixtures", required=True, help="dir of fixture JSON files")
    parser.add_argument("--dry-run", action="store_true", help="do not touch any DB")
    args = parser.parse_args()

    from mail_fetch import load_fixtures

    emails = load_fixtures(args.fixtures)
    for i, e in enumerate(emails):
        e["db_id"] = i + 1  # synthetic id for dry-run output
    cards, errors = extract_deadlines(emails)
    print(json.dumps({"cards": cards, "errors": errors}, indent=2, ensure_ascii=False))
