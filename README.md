# Deadline Widget

A frameless, always-on-top desktop widget that reads your macOS Mail, extracts
**academic deadlines** with a DeepSeek LLM (strict JSON-only contract), and shows
them as a compact, draggable "Digital Concrete" dashboard — 4 cards per page,
direction-aware slide animations, checkbox with strikethrough, and an Undo toast.

![widget](docs/screenshot-cards.png)

## Stack

| Layer | Tech |
|---|---|
| Shell | Electron 33 — frameless, transparent, rounded 16px, draggable header |
| UI | React 18 + Vite + Framer Motion (`motion`) |
| Backend | Python 3.13 + Flask on `127.0.0.1:8766` (spawned by Electron) |
| Mail | `py-applescript` (JXA fallback) — unread Inbox, last 7 days |
| Storage | SQLite (`backend/data/emails.db`) — message-id diffing + rollback log |
| LLM | DeepSeek `deepseek-chat` via OpenAI-compatible API, `response_format: json_object` |

## Architecture

```
Mail.app ──AppleScript──▶ mail_fetch.py ──▶ db.py (diff by message_id)
                                                │ new emails
                                                ▼
                                         extract.py (LLM, JSON only)
                                                │ cards
                                                ▼
                                         db.py (deadlines + rollback_log)
                                                ▲
Electron (frameless) ◀── fetch ── Flask API ───┘
  React + motion UI          /api/cards /check /undo /sync /health
```

- **Data diffing:** only net-new message IDs are sent to the LLM (dedup table
  `emails`). Re-syncing is idempotent.
- **LLM contract:** the prompt commands *"JUST A JSON PROMPT ONLY"* — a single JSON
  object, no markdown, no fences; `response_format=json_object` enforces it at the
  API level. Emails without an actionable deadline return `null` and are skipped;
  the sanitizer also drops no-deadline/no-action cards so the widget stays clean.
- **Undo:** checking a card writes its JSON snapshot to `rollback_log`; Undo restores
  the row (even if it was deleted) and removes the log entry. Rollback is
  per-`rollback_id`, so Undo always reverts the card you just cleared.

## Run it

```bash
# one-time: backend deps + frontend deps
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
cd frontend && npm install && cd ..

# production mode (built UI)
cd frontend && ./node_modules/.bin/electron .     # or: npm start

# dev mode (vite HMR)
npm run start:dev                                  # in frontend/
```

On first sync, macOS will ask for **Automation permission** to control Mail
(System Settings → Privacy & Security → Automation → allow the Electron/Terminal
entry). Until granted, Sync returns a friendly error toast and the widget keeps
last-known data.

**Env knobs** (all optional):

| Env | Effect |
|---|---|
| `DEEPSEEK_API_KEY` | LLM key (falls back to `~/.reasonix/.env`) |
| `DEEPSEEK_MODEL` | Default `deepseek-chat` |
| `DEADLINE_FIXTURES` | Directory of JSON mail fixtures — sync reads these instead of Mail (testing) |
| `DEADLINE_DB` | SQLite path override |
| `DEADLINE_DEBUG_SHOT` | Path — capture the rendered window to PNG after load |

## API

| Endpoint | Description |
|---|---|
| `GET /api/cards` | Active cards, sorted by deadline (nulls last) |
| `POST /api/cards/<id>/check` | Mark done + write rollback log → `{rollback_id}` |
| `POST /api/undo` | Restore last checked card (`{"rollback_id": n}` optional) |
| `POST /api/sync` | Fetch Mail → diff → LLM extract → insert → `{fetched, new_emails, extracted, errors}` |
| `GET /api/health` | Liveness + mail state + last sync |

## Design system

See [DESIGN.md](DESIGN.md) — "Digital Concrete": `#0A0C0E` charcoal, one
cyan→blue gradient (`#22D3EE → #3B82F6`), heavy sans headers, mono data voice,
star + `</>` motifs. Page slides are direction-aware (`x: ±48`, 0.35s,
`ease [0.22,1,0.36,1]`); the checked card gets a cyan strikethrough then collapses
(0.25s); toasts slide up with a 6s Undo window. `prefers-reduced-motion` is
respected.

## Development notes

- **Backend alone:** `DEADLINE_FIXTURES=backend/data/fixtures .venv/bin/python backend/api.py`
  (fixtures = sample academic mail for offline testing).
- **Backend tests:** `python -m py_compile backend/*.py` + curl the API (see
  `docs/verify.sh` for the full check/undo/idempotency sequence).
- **UI interaction test:** Playwright WebKit harness at `docs/ui_test.py` (runs
  against vite dev + fixture backend; asserts pagination, strikethrough removal,
  Undo restore, sync toasts).
- **Verification of reasonix runs:** never trust self-reported results — re-run
  compile/tests/curl yourself.

## Privacy

Everything runs locally: Mail is queried via AppleScript, the DB is local SQLite,
and email bodies go only to the DeepSeek API for extraction (never stored raw
beyond the dedup snippet in `emails.body_snippet`). Fixtures are fake data.
