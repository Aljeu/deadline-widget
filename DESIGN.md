# Deadline Widget — Design System (senior-UI transfer of the reference schedule app)

Slate-navy canvas, pure-white rounded cards on a **left date-block rail** (featured date
filled), warm terracotta accent, colored category dots. Replicates the reference app's
structure and grouping: date-groups on the left rail, white event cards on the right.

## Window

- **Electron**, frameless (`frame: false`), `transparent: true`, portrait: **360 × 520**,
  `resizable: false`, `fullscreenable: false`. Rounded **20px** corners.
- **Pin toggle** (header thumbtack): pinned = screen-saver level (over fullscreen);
  unpinned (default) = normal level (behind apps). Persisted in localStorage, applied
  via `set-always-on-top` IPC at launch.
- Header row is the drag region (`-webkit-app-region: drag`); buttons are `no-drag`.
- Accessory activation policy (re-asserted after show): no Dock icon, no Cmd-Tab.

## Color Tokens

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#2F3A51` | Canvas — slate-navy (sampled) |
| `--surface` | `#FFFFFF` | Floating cards |
| `--surface-2` | `#F4F7FB` | Card hover |
| `--border` | `rgba(255,255,255,0.10)` | Hairlines on canvas |
| `--text` | `#FFFFFF` | On-canvas primary |
| `--muted` | `#A8B2C6` | On-canvas secondary |
| `--faint` | `#6E7A93` | On-canvas hints |
| `--ink` | `#171923` | On-card primary |
| `--slate` | `#8B93A7` | On-card secondary |
| `--slate-soft` | `#AEB5C4` | On-card faint |
| `--accent` | `#ED7C52` | Terracotta accent |
| `--accent-grad` | `linear-gradient(135deg,#F09266,#E2663F)` | Active states, OVERDUE/TODAY pills |
| `--dot-course` | `#34C759` | Green dot (COURSE) |
| `--dot-announce` | `#AF52DE` | Purple dot (ANNOUNCEMENT) |
| `--featured-bg` | `#14161F` | Featured date block (near-black) |
| `--danger` | `#E5484D` | (reserved) |

## Typography

- **Headings / card titles:** geometric sans — `"Avenir Next", "Helvetica Neue",
  -apple-system`, `font-weight: 700–800`. Window title uppercase, `0.14em` tracking.
- **Data / dates / course codes / senders / times:** crisp mono `"SF Mono", Menlo`,
  8–10px, tracked, uppercase, tabular-nums.
- **Rail dates:** `rail-day` 22px heavy sans (number) + `rail-mon` 8px mono (month).

## Layout

- Window padding `12px`; header `34px`; pagination row `20px`.
- **Header:** star (accent) · `DEADLINES` · pin toggle · sync toggle · `</>` code icon.
- **Split-axis timeline:** each `.tl-row` = left `.tl-rail` (52px date block) + white card.
- **Date block rail:** `rail-day` (big number) over `rail-mon` (month), stacked; the
  **featured** row — the soonest deadline on the page, or any OVERDUE/TODAY — is a
  filled near-black block (`#14161F`) with white text and a white border; the rest are
  plain outline text on the canvas.
- **Cards:** pure white, radius `22px`, `padding 12px`, soft shadow; anatomy =
  `.card-top` (category dot + subject) → `.card-meta` (map-pin icon + source) →
  `.card-bottom` (action_summary · urgency pill · **time**, bold, right).
- **Urgency pills:** OVERDUE/TODAY = terracotta gradient + white text; SOON = `#E9EDF3`
  slate; none = hidden.
- **Toast:** floating white card, `14px` radius, mono message + terracotta UNDO.

## Motion

- **Pagination:** direction-aware page slide (`x: ±48`, 0.35s, `ease [0.22,1,0.36,1]`),
  `AnimatePresence mode="popLayout" custom={dir}`; 4 cards/page, `1/3` indicator + chevrons.
- **Check:** strikethrough `scaleX 0→1` (0.22s, terracotta), then collapse (0.25s) at
  320ms; undo via rollback log.
- **Pin:** icon rotates 45°, toggle glows terracotta when pinned.
- `prefers-reduced-motion` respected.

## Icons

Inline SVG, `stroke: currentColor`, `stroke-width: 1.5`, `fill: none`: 4-point star,
`</>` code, sync arrows, check, map-pin (location), thumbtack pin (rotates 45° when pinned).

## Data

UI consumes the backend card schema via an adapter in `App.jsx` (email_id / category_type
/ source derived from id / course_code / sender) with a static **mock dataset**
(`src/mockData.js`, 9 items) used automatically when the API is unreachable. Real API wins
when the backend is live. Backend (Mail fetch, LLM extraction, SQLite, Flask API) is
unchanged.
