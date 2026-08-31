"""mail_fetch.py — query macOS Mail for unread messages from the past N days.

Primary path: py-applescript (the `applescript` package).
Fallback path: JXA via `osascript -l JavaScript` (no third-party dep needed).

Both paths return the same shape: {"ok": bool, "emails": [...], "error": str?}
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import subprocess
from pathlib import Path

DAYS_SECONDS = 7 * 24 * 3600

APPLESCRIPT = r"""
tell application "Mail"
    set outList to {}
    set recentMsgs to (every message of inbox whose read status is false)
    repeat with m in recentMsgs
        try
            set msgDate to date received of m
            if (current date) - msgDate <= {days} * days then
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
                    set msgBody to (content of m)
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
end tell
"""

JXA_SCRIPT = r"""
function run() {
  const Mail = Application('Mail');
  const now = new Date();
  const cutoff = new Date(now.getTime() - {days} * 24 * 3600 * 1000);
  const msgs = Mail.inbox.messages.whose({readStatus: false})();
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
                  received_at: iso(d), body_snippet: body.slice(0, 2000)});
      }
    } catch (e) {}
  }
  return JSON.stringify(out);
}
"""


def _fetch_via_applescript(days: int) -> list[dict]:
    """Primary: py-applescript."""
    import applescript  # local import so module loads even without the dep

    script = APPLESCRIPT.format(days=days)
    result = applescript.run(script)
    raw = result.out or []
    emails = []
    for rec in raw:
        emails.append(_normalize_record(rec))
    return emails


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
        "body_snippet": body[:2000],
    }


def _fetch_via_jxa(days: int) -> list[dict]:
    """Fallback: JXA, JSON on stdout."""
    script = JXA_SCRIPT.format(days=days)
    proc = subprocess.run(
        ["osascript", "-l", "JavaScript", "-e", script],
        capture_output=True, text=True, timeout=60,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "osascript failed")
    data = json.loads(proc.stdout.strip() or "[]")
    if not isinstance(data, list):
        raise RuntimeError("unexpected JXA output shape")
    return data


def fetch_unread(days: int = 7) -> dict:
    """Fetch unread Inbox mail from the past `days`. Never raises for
    permission problems — returns a structured error dict instead."""
    try:
        try:
            emails = _fetch_via_applescript(days)
        except ImportError:
            emails = _fetch_via_jxa(days)
        return {"ok": True, "emails": emails}
    except Exception as exc:  # noqa: BLE001 — report any failure structurally
        msg = str(exc)
        if "-1743" in msg or "not allowed" in msg.lower() or "not authorized" in msg.lower():
            return {"ok": False, "error": "automation_permission",
                    "detail": "Terminal/Hermes lacks Automation permission to control Mail. Grant it in System Settings > Privacy & Security > Automation."}
        if "doesn’t understand" in msg or "errAE" in msg:
            return {"ok": False, "error": "mail_unavailable", "detail": msg}
        return {"ok": False, "error": "mail_error", "detail": msg}


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
    parser = argparse.ArgumentParser(description="Fetch unread Mail messages (or fixtures).")
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--fixtures", type=str, default=None,
                        help="Load fixture JSON files from this dir instead of Mail.")
    args = parser.parse_args()

    if args.fixtures:
        try:
            out = {"ok": True, "emails": load_fixtures(args.fixtures)}
        except Exception as exc:  # noqa: BLE001
            out = {"ok": False, "error": "fixture_error", "detail": str(exc)}
    else:
        out = fetch_unread(args.days)
    print(json.dumps(out, indent=2, ensure_ascii=False))
