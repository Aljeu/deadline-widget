"""mail_fetch.py — query macOS Mail for messages received in the past N days.

Both read and unread messages are considered (the window is date-based only,
so deadline emails the student has already opened still surface). The raw
fetch returns every message in the window; the caller then applies
`filter_deadline_candidates()` to narrow to likely academic-deadline mail
before any LLM extraction, so non-deadline noise is never sent to the model.

Primary path: py-applescript (the `applescript` package).
Fallback path: JXA via `osascript -l JavaScript` (no third-party dep needed).

Both paths return the same shape: {"ok": bool, "emails": [...], "error": str?}
Each email dict: {message_id, subject, sender, received_at, body_snippet}.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import subprocess
from pathlib import Path

DAYS_SECONDS = 7 * 24 * 3600
MAX_EMAILS = 200

APPLESCRIPT = r"""
tell application "Mail"
    with timeout of 90 seconds
        set outList to {{}}
        set cutoffDate to (current date) - ({days} * days)
        -- The whose-clause date filter is evaluated inside Mail (~60x faster
        -- than looping every message and comparing dates in AppleScript).
        -- NOTE: no read-status filter -> read AND unread messages both match.
        set recentMsgs to (every message of inbox whose (date received of it) >= cutoffDate)
        repeat with m in recentMsgs
            try
                if (count of outList) < {cap} then
                    set msgDate to date received of m
                    set msgId to ""
                    try
                        set msgId to (message id of m)
                    end try
                    if msgId is "" then
                        try
                            set msgId to (id of m)
                        end try
                    end if
                    set msgBody to ""
                    try
                        with timeout of 8 seconds
                            set msgBody to (content of m)
                        end timeout
                    end try
                    set y to (year of msgDate) as text
                    set mo to (month of msgDate) as integer
                    set d to (day of msgDate) as text
                    set h to (hours of msgDate) as text
                    set mi to (minutes of msgDate) as text
                    set padMo to text -2 thru -1 of ("0" & mo)
                    set padD to text -2 thru -1 of ("0" & d)
                    set padH to text -2 thru -1 of ("0" & h)
                    set padMi to text -2 thru -1 of ("0" & mi)
                    set msgDateStr to y & "-" & padMo & "-" & padD & " " & padH & ":" & padMi
                    set end of outList to {{msgId:msgId, msgSubject:(subject of m), msgSender:(sender of m), msgDate:msgDateStr, msgBody:msgBody}}
                end if
            end try
        end repeat
        return outList
    end timeout
end tell
"""

JXA_SCRIPT = r"""
function run() {
  const Mail = Application('Mail');
  const now = new Date();
  const cutoff = new Date(now.getTime() - {days} * 24 * 3600 * 1000);
  // No read-status filter: date-window only, so read deadline mail still appears.
  const msgs = Mail.inbox.messages.whose({dateReceived: {_greaterThanEquals: cutoff}})();
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
               ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  const out = [];
  for (const m of msgs) {
    try {
      const d = new Date(m.dateReceived());
      if (d >= cutoff) {
        let mid = '';
        try { mid = String(m.messageId()); } catch (e) {}
        if (!mid) { try { mid = String(m.id()); } catch (e) {} }
        let body = '';
        try { body = String(m.content()); } catch (e) {}
        out.push({message_id: mid, subject: String(m.subject()), sender: String(m.sender()),
                  received_at: iso(d), body_snippet: body.slice(0, 3000)});
      }
    } catch (e) {}
  }
  return JSON.stringify(out);
}
"""


def _fetch_via_applescript(days: int) -> list[dict]:
    """Primary: py-applescript (works on 1.0.x).

    Fetches metadata + body for every in-window message, capped at MAX_EMAILS
    so body downloads stay bounded and the 90s script timeout holds.
    """
    import applescript  # local import so module loads even without the dep

    script = applescript.AppleScript(APPLESCRIPT.format(days=days, cap=MAX_EMAILS))
    result = script.run()
    # py-applescript 1.0.x returns decoded values directly (no .out wrapper).
    raw = getattr(result, 'out', result)
    if not isinstance(raw, list):
        raw = []
    emails = [_normalize_record(rec) for rec in raw]
    emails.sort(key=lambda e: e.get("received_at", ""), reverse=True)
    return emails[:MAX_EMAILS]


def _normalize_record(rec) -> dict:
    if isinstance(rec, dict):
        get = rec.get
        message_id = str(get("msgId", "") or "")
        subject = str(get("msgSubject", "") or "")
        sender = str(get("msgSender", "") or "")
        received = str(get("msgDate", "") or "")
        body = str(get("msgBody", "") or "")
    else:  # some py-applescript versions return tuples for records
        rec = list(rec)
        message_id = str(rec[0] or "") if len(rec) > 0 else ""
        subject = str(rec[1] or "") if len(rec) > 1 else ""
        sender = str(rec[2] or "") if len(rec) > 2 else ""
        received = str(rec[3] or "") if len(rec) > 3 else ""
        body = str(rec[4] or "") if len(rec) > 4 else ""
    return {
        "message_id": message_id,
        "subject": subject,
        "sender": sender,
        "received_at": received,
        "body_snippet": body[:3000],
    }


def _fetch_via_jxa(days: int) -> list[dict]:
    """Fallback: JXA, JSON on stdout."""
    script = JXA_SCRIPT.format(days=days)
    proc = subprocess.run(
        ["osascript", "-l", "JavaScript", "-e", script],
        capture_output=True, text=True, timeout=90,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "osascript failed")
    data = json.loads(proc.stdout.strip() or "[]")
    if not isinstance(data, list):
        raise RuntimeError("unexpected JXA output shape")
    return data[:MAX_EMAILS]


def _is_mail_running() -> bool:
    """True if the Mail app is already running (so we know whether OUR fetch is
    what launches it and we should quit it afterward to keep it out of the Dock).

    Uses a process check (no Automation permission needed) so we never wrongly
    conclude Mail was closed and then quit a Mail window the user had open.
    """
    try:
        proc = subprocess.run(["pgrep", "-x", "Mail"], capture_output=True, timeout=10)
        return proc.returncode == 0  # 0 => at least one matching process
    except Exception:  # noqa: BLE001 — if we can't tell, treat as running (don't quit)
        return True


def _quit_mail_if_we_launched_it(was_running: bool) -> None:
    """If Mail was NOT running before we used it, quit it afterward so the widget
    never leaves the Mail app open/appearing in the Dock after a sync."""
    if was_running:
        return
    try:
        subprocess.run(
            ["osascript", "-e", 'tell application "Mail" to quit'],
            capture_output=True, text=True, timeout=15,
        )
    except Exception:  # noqa: BLE001 — best-effort; never fatal
        pass


def fetch_window(days: int = 7) -> dict:
    """Fetch ALL Inbox mail (read + unread) from the past `days`.

    Never raises for permission problems — returns a structured error dict
    instead. If this fetch launches the Mail app (it wasn't running), Mail is
    quit afterward so it does not linger in the Dock. Callers should run
    `filter_deadline_candidates()` on the result before any LLM extraction.
    """
    mail_was_running = _is_mail_running()
    try:
        try:
            emails = _fetch_via_applescript(days)
        except ImportError:
            emails = _fetch_via_jxa(days)
        result = {"ok": True, "emails": emails}
    except Exception as exc:  # noqa: BLE001 — report any failure structurally
        msg = str(exc)
        if "-1743" in msg or "not allowed" in msg.lower() or "not authorized" in msg.lower():
            result = {"ok": False, "error": "automation_permission",
                      "detail": "Terminal/Hermes lacks Automation permission to control Mail. Grant it in System Settings > Privacy & Security > Automation."}
        elif "-1712" in msg or "timed out" in msg.lower():
            result = {"ok": False, "error": "mail_timeout",
                      "detail": "Mail took too long to respond (likely too many messages in the window). Read/archive old mail or try again."}
        elif "doesn’t understand" in msg or "errAE" in msg:
            result = {"ok": False, "error": "mail_unavailable", "detail": msg}
        else:
            result = {"ok": False, "error": "mail_error", "detail": msg}
    finally:
        _quit_mail_if_we_launched_it(mail_was_running)
    return result


# ---------------------------------------------------------------------------
# Deadline-candidate pre-filter (cheap — runs on subject/sender/body, NO LLM).
# The LLM extraction is the authoritative filter; this just avoids sending
# obvious non-deadline mail (security alerts, confirmations, meetings, etc.)
# to the model, and is deliberately high-recall so real deadlines never get
# dropped before the model can see them.
# ---------------------------------------------------------------------------

_NOISE_SUBJECT_NEEDLES = (
    "security alert", "verify your email", "new sign in", "sign-in",
    "sign in to your", "support ticket", "welcome to", "you have submitted",
    "new material",
)
_MEETING_SUBJECT_NEEDLES = (
    "invitation:", "invite", "calendar invite", "meeting invite", "agenda",
)
_ACADEMIC_DOMAIN_NEEDLES = (
    ".edu.ph", ".edu", "university", "college", "lms",
    "classroom", "notifications.google.com",
)
_DEADLINE_SUBJECT_NEEDLES = (
    "due", "deadline", "assignment", "quiz", "exam", "submission", "submit",
    "report", "final group", "project", "activity", "requirement", "homework",
    "problem set", "lab", "essay", "paper", "defense", "midterm", "long quiz",
    "presentation", "recitation", "conforme", "reading", "registration",
)
_COURSE_RE = re.compile(r"\b[A-Za-z]{2,5}\s?[-/]?\s?\d{1,4}\b")
_BODY_DEADLINE_PHRASES = ("due:", "due date", "deadline:", "submit by", "due on")


def is_deadline_candidate(email: dict) -> bool:
    """Return True if this email plausibly announces an academic deadline."""
    subject = (email.get("subject") or "").lower()
    sender = (email.get("sender") or "").lower()
    body = (email.get("body_snippet") or "").lower()

    # Hard-block system noise, submission confirmations, materials, meetings.
    if any(n in subject for n in _NOISE_SUBJECT_NEEDLES):
        return False
    if any(n in subject for n in _MEETING_SUBJECT_NEEDLES):
        return False

    # High-recall pass: academic sender, deadline-ish subject, course code,
    # or an explicit due-phrase in the body.
    if any(n in sender for n in _ACADEMIC_DOMAIN_NEEDLES):
        return True
    if any(n in subject for n in _DEADLINE_SUBJECT_NEEDLES):
        return True
    if _COURSE_RE.search(subject):
        return True
    if any(p in body for p in _BODY_DEADLINE_PHRASES):
        return True
    return False


def filter_deadline_candidates(emails: list[dict]) -> list[dict]:
    """Return only the emails that look like academic-deadline candidates."""
    return [e for e in emails if is_deadline_candidate(e)]


def load_fixtures(fixture_dir: str | os.PathLike) -> list[dict]:
    """Load test emails from every *.json file in a directory.

    Each file is a JSON array of email dicts:
    {"message_id", "subject", "sender", "received_at", "body_snippet"}.
    """
    root = Path(fixture_dir)
    emails: list[dict] = []
    if not root.is_dir():
        raise FileNotFoundError(f"fixture dir not found: {root}")
    for path in sorted(root.glob("*.json")):
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        if not isinstance(data, list):
            raise ValueError(f"{path}: expected a JSON array of emails")
        for item in data:
            emails.append({
                "message_id": str(item.get("message_id", "")),
                "subject": str(item.get("subject", "") or ""),
                "sender": str(item.get("sender", "") or ""),
                "received_at": str(item.get("received_at", "") or ""),
                "body_snippet": str(item.get("body_snippet", "") or ""),
            })
    return emails


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch Mail messages (or fixtures).")
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--fixtures", type=str, default=None,
                        help="Load fixture JSON files from this dir instead of Mail.")
    parser.add_argument("--candidates", action="store_true",
                        help="Also print which are deadline candidates.")
    args = parser.parse_args()

    if args.fixtures:
        try:
            out = {"ok": True, "emails": load_fixtures(args.fixtures)}
        except Exception as exc:  # noqa: BLE001
            out = {"ok": False, "error": "fixture_error", "detail": str(exc)}
    else:
        out = fetch_window(args.days)

    payload = {"ok": out.get("ok"), "error": out.get("error"), "detail": out.get("detail"),
               "fetched": len(out.get("emails", []))}
    if out.get("ok"):
        payload["emails"] = out["emails"]
        if args.candidates:
            payload["candidates"] = filter_deadline_candidates(out["emails"])
    print(json.dumps(payload, indent=2, ensure_ascii=False))
