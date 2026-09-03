# Deadline Widget — Design System (redesigned)

Warm, personal deadline briefing. Slate-navy canvas, strong status-tinted bubbles,
a bold greeting with the user's first name, a live color time-of-day mark, and a
conversational task-count line. Fonts: Plus Jakarta Sans (UI) + JetBrains Mono (data),
vendored as variable woff2 (offline, no external requests).

## Window

- Electron, frameless, transparent, 360px wide. **Height hugs content** — the renderer
  reports `.app` height via `set-content-height` IPC; `main.js` resizes the window
  (clamped 260–560) so there's no dead void.
- Header row is the drag region; buttons are `no-drag`. Pin toggle persists to
  localStorage and applies via `set-always-on-top`.
- Device owner name (`get-owner-name` via osascript → first token) greets by name.

## Color tokens

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#2F3A51` | Canvas — slate-navy |
| `--text` | `#FFFFFF` | On-canvas primary |
| `--muted` | `#A8B2C6` | On-canvas secondary |
| `--faint` | `#6E7A93` | On-canvas hints |
| `--ink` | `#171923` | On-card primary |
| `--slate` | `#7A8498` | On-card meta |
| `--accent` | `#ED7C52` | Terracotta accent |
| `--accent-grad` | `#F09266→#E2663F` | Pinned/checked/priority |
| `--danger` | `#E5484D` | Danger (confirm delete) |
| `--st-overdue` | `#E25B5E→#D6353F` | Overdue bubble |
| `--st-urgent` | `#F0946A→#E2663F` | Due-today/soon bubble |
| `--featured-bg` | `#14161F` | Priority date block |

## Typography

- **Plus Jakarta Sans** (variable 300–800): greeting, card titles, chips, buttons.
  Greeting 21px/700, name 800 accent + `!`. Card title 15px/700.
- **JetBrains Mono** (variable): dates, times, course codes, ranges, summary counts.
- Humanized date: `Thursday, Sep 3` (no year, no slashes).

## Layout (top block)

- **Greeting** — `Good afternoon, Alex!` (time-of-day + first name + accent `!`).
- **Summary** — conversational: `You have 1 overdue, 1 due today & 2 this week.`
  or `Nothing due this week — you're all clear!`
- **Date** — quiet `--faint` line.
- **Tools (right, centered, reordered):** colored **time mark** → **refresh** → **pin**.
  `</>` removed. Time mark is a filled gradient glyph (sunrise/sun/sunset/moon) with a
  pulsing glow on hover; tooltip shows the live clock time.

## Cards (uniform anatomy)

```
[✓]  Task header (15px/700)                        [★]
     [STATUS chip]        ← Overdue / Due today / Soon / Upcoming
     CS 210 · Today 11:59 PM
```

- Checkbox LEFT, priority star RIGHT (one action per corner).
- **Status bubble color** carries state: Overdue = red gradient + white text;
  Due-today/Soon = terracotta gradient + white text; remaining = white + ink.
- Chip (white pill) reinforces status in text; `Upcoming` for the neutral baseline so
  every card has identical bands.
- Date block on the rail is **featured (filled black) only for starred/priority tasks**;
  the star floats a priority task to the top.

## Pagination (fit-based, no scrollbar)

- Page size derived from a measured probe card vs a fixed card-area budget (400px);
  overflow flows to the next page via the `‹ 1/N ›` chevrons.
- **Finished cleanup:** trash button (always visible, disabled + dim until a task is
  checked) in the pagination row; a count badge shows how many are done. Clicking it
  opens a **confirmation modal** (blurred backdrop + white card, Cancel / Delete).
  Confirm removes finished tasks (and persists real ids to the backend).

## Motion

- Time mark: slow pulse + colored drop-shadow on hover.
- Card hover: lift + deeper shadow. Modal: fade + scale. Toast: slide up.
- `prefers-reduced-motion` respected.

## Data

Real backend when reachable; static mock otherwise. Checked = local working set;
delete persists to backend. `deadline.js` holds shared Safari-safe date/urgency helpers.
