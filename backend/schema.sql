-- Deadline Widget — SQLite schema (emails.db)
-- Migrations are applied idempotently at backend startup (CREATE IF NOT EXISTS).

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Raw mail seen: every message_id we have ever fetched (dedup source of truth).
CREATE TABLE IF NOT EXISTS emails (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id  TEXT NOT NULL UNIQUE,      -- Mail.app's numeric message id, stringified
    subject     TEXT NOT NULL DEFAULT '',
    sender      TEXT NOT NULL DEFAULT '',
    received_at TEXT,                       -- ISO-8601 local time
    fetched_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    body_snippet TEXT DEFAULT ''            -- truncated body given to the LLM
);

-- LLM-extracted deadline cards derived from emails.
CREATE TABLE IF NOT EXISTS deadlines (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id       INTEGER NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    subject        TEXT NOT NULL,
    course_code    TEXT NOT NULL DEFAULT '',
    sender         TEXT NOT NULL DEFAULT '',
    deadline_date  TEXT,                    -- 'YYYY-MM-DD HH:mm' or NULL
    action_summary TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','done')),
    created_at     TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_deadlines_status ON deadlines(status);
CREATE INDEX IF NOT EXISTS idx_deadlines_date ON deadlines(deadline_date);

-- Temporary rollback log for the Undo toast. One row per "checked" action,
-- payload = full JSON snapshot of the deadline row needed to restore it.
CREATE TABLE IF NOT EXISTS rollback_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    deadline_id INTEGER NOT NULL,
    action      TEXT NOT NULL DEFAULT 'checked',
    payload     TEXT NOT NULL,              -- JSON snapshot of the deadline row
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Sync bookkeeping: when the last fetch ran and what it found.
CREATE TABLE IF NOT EXISTS sync_meta (
    key   TEXT PRIMARY KEY,
    value TEXT
);
