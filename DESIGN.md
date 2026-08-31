# Deadline Widget — Design System ("Digital Concrete")

The visual language: minimalist **Digital Concrete** — deep almost-black charcoal, one
electric cyan→blue gradient, brutalist heavy type, crisp mono details. Kinetic but
never noisy. Every pixel must feel intentional.

## Window

- **Electron**, frameless (`frame: false`), `transparent: true`, portrait: **384 × 640**,
  `resizable: false`, `alwaysOnTop: true`, `fullscreenable: false`.
- Rounded **16px** corners achieved via transparent frame + CSS `border-radius` on the
  app root (body background must be transparent; the root container paints the charcoal).
- A thin 1px inner border (`rgba(255,255,255,0.07)`) around the window edge.
- The **entire header row is a drag region** (`-webkit-app-region: drag`); all buttons and
  interactive elements inside it need `-webkit-app-region: no-drag`.

## Color Tokens

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0A0C0E` | Window background (charcoal, almost black) |
| `--surface` | `#12151A` | Card background |
| `--surface-2` | `#181C23` | Hover / raised |
| `--border` | `rgba(255,255,255,0.06)` | Hairline borders |
| `--border-strong` | `rgba(255,255,255,0.12)` | Hover borders |
| `--text` | `#E9EDF2` | Primary text |
| `--muted` | `#8A93A2` | Secondary / labels |
| `--faint` | `#4E5763` | Disabled / hints |
| `--cyan` | `#22D3EE` | Accent start |
| `--blue` | `#3B82F6` | Accent end |
| `--accent-grad` | `linear-gradient(135deg, #22D3EE, #3B82F6)` | Primary accents |
| `--accent-soft` | `rgba(34,211,238,0.10)` | Hover fills, active toggles |
| `--danger` | `#F87171` | Overdue tags (used sparingly) |

Shadows: `0 12px 32px rgba(0,0,0,0.55)` on cards; window drop shadow handled by Electron
`hasShadow: true`.

## Typography

- **Headers / titles / card subject:** brutalist heavy sans — `-apple-system, "SF Pro
  Display", "Segoe UI", Roboto, sans-serif`, `font-weight: 800`, uppercase, `letter-spacing:
  -0.02em`, `font-size: 13px` for card subjects, `11px` for the window title.
- **Data / dates / course codes / sender / pagination / toasts:** crisp mono —
  `"SF Mono", "JetBrains Mono", Menlo, Consolas, monospace`, `font-size: 10–11px`,
  `letter-spacing: 0.02em`, `text-transform: uppercase`.
- Never use a generic rounded font for data. Mono is the detail voice.
- Tabular numbers for dates (`font-variant-numeric: tabular-nums`).

## Layout

- Window padding: `14px`; header `height: 36px`; content column `gap: 10px`.
- **Header (drag region):** left = 4-point star icon (stroke, cyan), 8px gap, then title
  `DEADLINES` in heavy sans 11px uppercase, letter-spacing 0.12em. Right = manual **Sync
  toggle** (16px square, `border: 1px solid var(--border-strong)`, radius 5px; **active** =
  `var(--accent-grad)` background with glow `box-shadow: 0 0 12px rgba(34,211,238,0.45)`),
  then a `</>` code icon (stroke, muted).
- **Pagination header** row under the main header: left = `DEADLINE 01 — 04` mono 10px
  muted; right = page indicator `1/2` mono 10px, cyan when > 1 page, flanked by two
  tiny chevron buttons (`.page-prev`, `.page-next`: 14px, mono glyphs `‹` `›`, muted,
  cyan on hover, disabled + `--faint` at bounds). Clicking next slides the current list
  out left while the next page slides in from the right (direction-aware motion).
- **Cards:** `background: var(--surface)`, `border: 1px solid var(--border)`, radius `10px`,
  padding `12px 12px`, `display: flex; gap: 10px`, hover: border → `var(--border-strong)`,
  background → `var(--surface-2)`, `translateY(-1px)` transition 150ms.
- **Card content:** checkbox (16px, 2px border `var(--border-strong)`, radius 4px, checked
  state = accent gradient fill + white check glyph) | column: subject (heavy sans 13px,
  line-height 1.25, 2-line clamp) / meta row (course code + sender, mono 10px, muted) /
  deadline row (calendar glyph + `MON 08 SEP · 11:59 PM` mono 10px; **urgency tag** right:
  `OVERDUE`/`TODAY` in accent-soft pill with cyan text, `SOON` muted pill, none = no tag).
- **Toast:** fixed bottom, `left/right: 14px`, `background: var(--surface-2)`, border
  `1px solid var(--border-strong)`, radius `10px`, padding `10px 12px`, flex row: mono
  10px message + **UNDO** button (mono 10px, `color: var(--cyan)`, hover underline).
  Slides up + fades in (Framer Motion), auto-dismisses after **6s**, `onClick` undo
  dismisses instantly.
- **Empty state:** centered column: 4-point star outline (muted), `NO DEADLINES` heavy
  sans 12px, `SYNC TO CHECK` mono 9px faint. Plus a centered **Sync now** ghost button
  (mono 9px, 1px border, hover accent).

## Motion (Framer Motion — `motion` package)

- **Page transitions:** direction-aware slide. Exit page: `x: -48, opacity: 0,
  filter: blur(2px)` (left slide-out); enter page: `x: 48 → 0, opacity: 0 → 1` (slide in
  from right). Duration `0.35s`, ease `[0.22, 1, 0.36, 1]`. Use `<AnimatePresence mode="popLayout"
  initial={false} custom={dir}>` with variants keyed on custom direction.
- **Checkbox check:** strikethrough line animates `scaleX: 0 → 1` across the subject
  (origin left, 0.22s, accent color), then after `320ms` the card collapses
  (`height/opacity` exit, 0.25s). Card content fades to `--faint` during strikethrough.
- **Toast:** initial `{y: 24, opacity: 0}`, animate `{y: 0, opacity: 1}`, exit `{y: 24,
  opacity: 0}`, duration 0.25s, spring-ish ease.
- **Sync toggle:** while syncing, show a spinning ring (border-top cyan, 12px, 600ms linear
  infinite). Respect `prefers-reduced-motion` by falling back to instant transitions.
- Keep animation count low — motion is an accent, not the product.

## Iconography

Inline SVG, `stroke: currentColor`, `stroke-width: 1.5`, `fill: none`, 14px.
- **Star:** 4-point sparkle `M12 3 L13.8 10.2 L21 12 L13.8 13.8 L12 21 L10.2 13.8 L3 12
  L10.2 10.2 Z` (normalized to viewBox 0 0 24 24).
- **Code:** `</>` — `M8 7 L3 12 L8 17 M16 7 L21 12 L16 17 M13 5 L11 19`.

## Interaction Rules

1. Checking a card → optimistic UI: strikethrough → remove → toast `CLEARED` + UNDO.
   On Undo: `POST /api/undo` → card restored to its original page position.
2. Max **4 cards per page**. If > 4, paginate with the `1/2` indicator; dots optional.
3. Sync toggle click → `POST /api/sync`; while in-flight the toggle spins; on completion
   toast `SYNCED · +2 NEW` (or `NO NEW MAIL`).
4. All fetches hit `http://127.0.0.1:8766` via a tiny `api.js` wrapper (base URL from
   `window.deadlineAPI` preload bridge, fallback `http://127.0.0.1:8766`).
5. Any API failure → quiet toast `OFFLINE — RETRYING` and the list keeps last known data.
