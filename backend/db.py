"""db.py — thin sqlite3 layer for the deadline widget.

Schema lives in schema.sql (source of truth). All functions take a connection
first; callers are responsible for commit semantics as documented per function.
"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"


def get_conn(db_path: str | Path) -> sqlite3.Connection:
    db_path = Path(db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    conn.commit()


# ---------------------------------------------------------------- emails ---

def insert_new_emails(conn: sqlite3.Connection, emails: list[dict]) -> list[dict]:
    """Insert emails that are not already known (diff by message_id).

    Returns the newly inserted rows as plain dicts (including their DB ids).
    """
    if not emails:
        return []
    ids = [e["message_id"] for e in emails]
    placeholders = ",".join("?" * len(ids))
    rows = conn.execute(
        f"SELECT message_id FROM emails WHERE message_id IN ({placeholders})", ids
    ).fetchall()
    known = {r["message_id"] for r in rows}

    new_emails = [e for e in emails if e["message_id"] not in known and e["message_id"]]
    if not new_emails:
        return []

    conn.executemany(
        """INSERT OR IGNORE INTO emails (message_id, subject, sender, received_at, body_snippet)
           VALUES (:message_id, :subject, :sender, :received_at, :body_snippet)""",
        new_emails,
    )
    conn.commit()

    new_ids = [e["message_id"] for e in new_emails]
    placeholders = ",".join("?" * len(new_ids))
    rows = conn.execute(
        f"""SELECT id, message_id, subject, sender, received_at, body_snippet
            FROM emails WHERE message_id IN ({placeholders})""",
        new_ids,
    ).fetchall()
    return [dict(r) for r in rows]


# -------------------------------------------------------------- deadlines --

def insert_deadlines(conn: sqlite3.Connection, cards: list[dict]) -> int:
    """cards: LLM-extracted schema dicts, each with an extra `email_id` key.

    INSERT OR IGNORE + the UNIQUE(email_id) index make this idempotent: an email
    that already has a deadline row (any status) is never given a second card, so
    a task the user deleted can never be re-created from a re-processed email.
    """
    if not cards:
        return 0
    before = conn.total_changes
    conn.executemany(
        """INSERT OR IGNORE INTO deadlines
             (email_id, subject, course_code, sender, deadline_date, action_summary)
           VALUES
             (:email_id, :subject, :course_code, :sender, :deadline_date, :action_summary)""",
        cards,
    )
    conn.commit()
    return conn.total_changes - before


def list_cards(conn: sqlite3.Connection, status: str = "active") -> list[dict]:
    rows = conn.execute(
        """SELECT d.id, d.email_id, d.subject, d.course_code, d.sender,
                  d.deadline_date, d.action_summary, d.status, d.created_at
           FROM deadlines d
           WHERE d.status = ?
           ORDER BY (d.deadline_date IS NULL), d.deadline_date ASC, d.created_at DESC""",
        (status,),
    ).fetchall()
    return [dict(r) for r in rows]


def _card_dict(conn: sqlite3.Connection, card_id: int) -> dict | None:
    row = conn.execute(
        """SELECT id, email_id, subject, course_code, sender,
                  deadline_date, action_summary, status, created_at
           FROM deadlines WHERE id = ?""",
        (card_id,),
    ).fetchone()
    return dict(row) if row else None


def check_card(conn: sqlite3.Connection, card_id: int) -> dict | None:
    """Mark a card done + append a rollback log entry.

    Returns {"rollback_id": int, "card": snapshot} or None if not found / already done.
    """
    card = _card_dict(conn, card_id)
    if card is None or card["status"] != "active":
        return None
    conn.execute("UPDATE deadlines SET status = 'done' WHERE id = ?", (card_id,))
    cur = conn.execute(
        """INSERT INTO rollback_log (deadline_id, action, payload)
           VALUES (?, 'checked', ?)""",
        (card_id, json.dumps(card, ensure_ascii=False)),
    )
    conn.commit()
    return {"rollback_id": cur.lastrowid, "card": card}


def undo(conn: sqlite3.Connection, rollback_id: int | None = None) -> dict | None:
    """Restore the most recently checked card (or a specific rollback entry).

    Returns the restored card dict, or None if there is nothing to undo.
    """
    if rollback_id is not None:
        row = conn.execute(
            "SELECT id, deadline_id, payload FROM rollback_log WHERE id = ?",
            (rollback_id,),
        ).fetchone()
    else:
        row = conn.execute(
            "SELECT id, deadline_id, payload FROM rollback_log ORDER BY id DESC LIMIT 1"
        ).fetchone()
    if row is None:
        return None

    payload = json.loads(row["payload"])
    deadline_id = row["deadline_id"]

    existing = _card_dict(conn, deadline_id)
    if existing is None:
        # The deadline row was deleted; rebuild it from the snapshot.
        conn.execute(
            """INSERT INTO deadlines
                 (id, email_id, subject, course_code, sender, deadline_date, action_summary, status, created_at)
               VALUES
                 (:id, :email_id, :subject, :course_code, :sender, :deadline_date, :action_summary, 'active', :created_at)""",
            payload,
        )
    else:
        conn.execute("UPDATE deadlines SET status = 'active' WHERE id = ?", (deadline_id,))

    conn.execute("DELETE FROM rollback_log WHERE id = ?", (row["id"],))
    conn.commit()
    restored = _card_dict(conn, deadline_id)
    if restored is None:
        restored = dict(payload, status="active")
    return restored


# --------------------------------------------------------------- sync meta --

def get_sync_meta(conn: sqlite3.Connection, key: str) -> str | None:
    row = conn.execute("SELECT value FROM sync_meta WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else None


def set_sync_meta(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute(
        "INSERT INTO sync_meta (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )
    conn.commit()
