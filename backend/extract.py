"""extract.py — LLM extraction of academic deadlines from email.

Strict JSON-only contract: the model is commanded to reply with a single JSON
object and nothing else (no markdown, no code fences). `response_format`
json_object enforces parseability at the API level. Non-deadline emails yield
`null` and are skipped, so the widget only ever shows actionable cards.

The prompt instructs the model to resolve both absolute and relative deadlines
(`Due Dec 5` -> 2026-12-05 23:59, `Due tomorrow` -> next day from received_at)
and to return literal `null` for non-deadline mail (meetings, confirmations,
security alerts, informational material). A defensive normalizer in
`_sanitize` coerces common alternate date shapes.
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import datetime as dt
import json
import os
import re
from pathlib import Path

import requests

DEADLINE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$")
_DEADLINE_DT_RE = re.compile(
    r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?"
)

SYSTEM_PROMPT = (
    "You are a strict JSON extraction engine. Respond with ONLY a valid JSON "
    "object and nothing else. No markdown, no code fences, no commentary, no "
    "trailing text. Every response must parse as JSON."
)

USER_PROMPT = """You are an academic-deadline extractor for a university student. Given ONE email (its subject, sender, received_at, and body), decide whether it announces an academic deadline — an assignment, quiz, exam, report, or other required coursework with a due/submission date.

Return ONLY a single JSON object with EXACTLY these keys:
{{
  "subject": "string — the given subject, exactly as-is",
  "course_code": "string — the course this deadline belongs to, e.g. 'ME 201'; empty string if unknown",
  "sender": "string — the sender, exactly as-is",
  "deadline_date": "YYYY-MM-DD HH:mm or null — the absolute due/submission datetime",
  "action_summary": "string — a short imperative phrase of what the student must do, e.g. 'Submit assignment', 'Take quiz', 'Read chapter 4'; 'No action' when there is no deadline"
}}

DATE RESOLUTION RULES — apply these carefully; do NOT leave a real deadline blank:
- If the email states an absolute date ('Due Dec 5', 'Dec 5, 11:59 PM', '2026-12-05'), output it as YYYY-MM-DD HH:mm (pad month/day/hour/minute to two digits).
- If a day is given but no time, default the time to 23:59.
- If the year is omitted, use the year of the email's received_at. If that date has already passed for the current year, use the next year.
- If the due is RELATIVE ('Due tomorrow', 'Due today', 'Due by <weekday>', 'Due <Month> <day>'), resolve it to an absolute date using the email's received_at date as the reference.
- If the email is NOT an academic deadline — for example a meeting/invitation, a security alert, a submission confirmation, a welcome message, or informational material (like a lecture note) with no required due date — respond with the literal JSON value null (NOT an object).

EMAIL EMAIL:
{email_json}
EMAIL CONTEXT — use this to resolve relative dates: received_at = {received_at}"""


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
                    {"role": "user", "content": USER_PROMPT.format(
                        email_json=email_json, received_at=email.get("received_at", ""))},
                ],
                "temperature": 0,
                "max_tokens": 400,
                "response_format": {"type": "json_object"},
            },
            timeout=45,
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
        return None, None  # no deadline -> intentional silent skip
    return card, None


def _normalize_deadline(raw: str | None) -> str | None:
    """Coerce a model-returned date into `YYYY-MM-DD HH:mm` (or `YYYY-MM-DD`).

    Handles padded/unpadded, slash separators, an optional time, and a few
    common human date shapes. Returns None if nothing usable is found.
    """
    s = (raw or "").strip()
    if not s:
        return None
    if DEADLINE_RE.match(s):
        return s
    m = _DEADLINE_DT_RE.search(s)
    if m:
        y, mo, d = m.group(1), int(m.group(2)), int(m.group(3))
        hh = int(m.group(4)) if m.group(4) else 23
        mm = int(m.group(5)) if m.group(5) else 59
        return f"{y}-{mo:02d}-{d:02d} {hh:02d}:{mm:02d}"
    for fmt in (
        "%d %b %Y %I:%M %p", "%d %b %Y %H:%M",
        "%b %d %Y %I:%M %p", "%b %d %Y %H:%M",
        "%A, %b %d %Y %I:%M %p", "%A, %b %d, %Y",
        "%d %b %Y", "%b %d %Y", "%B %d %Y",
    ):
        try:
            t = dt.datetime.strptime(s, fmt)
            return t.strftime("%Y-%m-%d %H:%M")
        except ValueError:
            continue
    return None


def _sanitize(data: dict, email: dict) -> dict | None:
    subject = str(data.get("subject") or email.get("subject") or "").strip()
    if not subject:
        return None
    deadline = _normalize_deadline(data.get("deadline_date"))
    action = str(data.get("action_summary") or "").strip() or "No action"
    # A card must carry an absolute deadline to be actionable. Non-deadline
    # mail (security alerts, confirmations, meetings, material) has a null date
    # -> silently skipped, never stored, never surfaced as an error.
    if not deadline:
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
