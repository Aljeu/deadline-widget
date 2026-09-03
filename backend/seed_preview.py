"""seed_preview.py — seed a throwaway DB with clearly-fictional deadlines.

Regenerate the public screenshots (docs/screenshot-*.png) with ZERO real Mail
data. Emits a deterministic set of fake deadline cards into a fresh SQLite DB,
which you point the widget at (DEADLINE_DB=<path>) to render.

Usage:
    .venv/bin/python backend/seed_preview.py --db /tmp/deadline-preview.db
    # then capture, e.g.:
    #   DEADLINE_DB=/tmp/deadline-preview.db DEADLINE_DEBUG_SHOT=/tmp/cards.png \
    #     DEADLINE_PROJECT_DIR="$(pwd)" ./frontend/node_modules/.bin/electron frontend
All subjects/senders/course codes below are fictitious placeholders.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import db as dbmod  # noqa: E402

# Fictitious emails (message_id used to link deadlines to their source email).
FICTIONAL_EMAILS = [
    {"message_id": "f0001", "subject": "CS 201: Lab 3 rubric",
     "sender": "Dr. A. Example <example@university.edu>",
     "received_at": "2026-11-20 09:00", "body_snippet": "Lab 3 is due in two weeks."},
    {"message_id": "f0002", "subject": "EE 101: Problem Set 5 posted",
     "sender": "Prof. B. Sample <sample@university.edu>",
     "received_at": "2026-11-21 10:00", "body_snippet": "Problem Set 5 is due on Friday."},
    {"message_id": "f0003", "subject": "MATH 202: Quiz 2 announced",
     "sender": "TA <ta@university.edu>",
     "received_at": "2026-11-22 08:00", "body_snippet": "Quiz 2 coverage has been added."},
    {"message_id": "f0004", "subject": "ME 201: Final report reminder",
     "sender": "Dr. C. Generic <c.generic@university.edu>",
     "received_at": "2026-11-23 08:00", "body_snippet": "Final report outline is due next week."},
]

# Fictitious deadlines (each links to a message_id above).
FICTIONAL_DEADLINES = [
    {"message_id": "f0001", "subject": "CS 201 — Lab 3 due", "course_code": "CS 201",
     "sender": "Dr. A. Example", "deadline_date": "2026-12-04 23:59",
     "action_summary": "Submit Lab 3"},
    {"message_id": "f0002", "subject": "EE 101 — Problem Set 5 due", "course_code": "EE 101",
     "sender": "Prof. B. Sample", "deadline_date": "2026-12-06 23:59",
     "action_summary": "Submit Problem Set 5"},
    {"message_id": "f0003", "subject": "MATH 202 — Quiz 2", "course_code": "MATH 202",
     "sender": "TA", "deadline_date": "2026-12-09 09:00",
     "action_summary": "Take Quiz 2"},
    {"message_id": "f0004", "subject": "ME 201 — Final report outline", "course_code": "ME 201",
     "sender": "Dr. C. Generic", "deadline_date": "2026-12-15 23:59",
     "action_summary": "Submit final report outline"},
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed a throwaway DB with fictional deadlines.")
    parser.add_argument("--db", default="/tmp/deadline-preview.db")
    parser.add_argument("--reset", action="store_true", help="delete any existing db first")
    args = parser.parse_args()

    if args.reset:
        for p in (args.db, args.db + "-wal", args.db + "-shm"):
            Path(p).unlink(missing_ok=True)

    conn = dbmod.get_conn(args.db)
    dbmod.init_db(conn)

    # Insert the fictional source emails, then link deadlines to them by id.
    new_emails = dbmod.insert_new_emails(conn, FICTIONAL_EMAILS)
    id_by_message = {e["message_id"]: e["id"] for e in new_emails}

    cards = []
    for d in FICTIONAL_DEADLINES:
        message_id = d.pop("message_id")
        cards.append({**d, "email_id": id_by_message[message_id]})

    inserted = dbmod.insert_deadlines(conn, cards)
    active = dbmod.list_cards(conn, status="active")
    print(f"seeded {args.db}: {len(new_emails)} emails, {inserted} deadlines ({len(active)} active)")


if __name__ == "__main__":
    main()
