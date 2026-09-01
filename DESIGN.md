# Deadline Widget — Design System ("Digital Concrete × Warm Soft-Modernist Bento")

Deep cobalt-charcoal canvas, pure-white floating bento cards on a split-axis
timeline, one electric cyan→blue gradient. Kinetic but warm; brutalist type on
organic geometry.

## Window

- **Electron**, frameless (`frame: false`), `transparent: true`, portrait: **360 × 520**,
  `resizable: false`, `fullscreenable: false`. Rounded **20px** corners via transparent
  frame + CSS `border-radius` on `.app`.
- **Pin toggle** (header thumbtack): pinned = screen-saver level (floats over fullscreen);
  unpinned (default) = normal level (behind apps/fullscreen video). Persisted in
  localStorage, applied at launch via `set-always-on-top` IPC.
- The **entire header row is a drag region** (`-webkit-app-region: drag`); every button
  inside it carries `-webkit-app-region: no-drag`.
- Accessory activation policy (re-asserted after window show): no Dock icon, no Cmd-Tab.

## Color Tokens

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#162238` | Canvas — deep cobalt-charcoal |
| `--surface` | `#FFFFFF` | Floating bento cards |
| `--surface-2` | `#F1F5F9` | Card hover |
| `--border` | `rgba(255,255,255,0.08)` | Hairlines on canvas |
| `--border-strong` | `rgba(255,255,255,0.16)` | Canvas controls |
| `--text` | `#F1F5F9` | On-canvas primary |
| `--muted` | `#94A3B8` | On-canvas secondary |
| `--faint` | `#5B6B85` | On-canvas hints |
| `--ink` | `#0F172A` | On-card primary (dark slate) |
| `--slate` | `#64748B` | On-card secondary |
| `--slate-soft` | `#94A3B8` | On-card faint |
| `--cyan` | `#22D3EE` | Accent start / rail dots (COURSE) |
| `--blue` | `#3B82F6` | Accent end / strikethrough |
| `--accent-grad` | `linear-gradient(135deg, #22D3EE, #3B82F6)` | Checked boxes, OVERDUE/TODAY pills, pinned state |

Card shadow: `0 8px 24px rgba(2,6,23,0.45)`; toast `0 16px 40px rgba(2,6,23,0.6)`.

## Typography

- **Headers / card subjects:** brutalist geometric sans — `"Avenir Next", "Helvetica Neue",
  -apple-system`, `font-weight: 800`, uppercase window title with `0.14em` tracking;
  card subjects 12px `-0.01em`.
- **Data / dates / course codes / sender / rails / toasts:** crisp mono —
  `"SF Mono", Menlo, Consolas`, 8–10px, `0.02–0.16em` tracking, uppercase, tabular-nums.
- Never use a generic rounded font for data. Mono is the detail voice.

## Layout

- Window padding `12px`; header `34px`; pagination row `20px`.
- **Header:** star (cyan) · `DEADLINES` (heavy, tracked) · pin toggle · sync toggle ·
  `</>` code icon (muted).
- **Split-Axis Timeline:** each row is `.tl-row` = fixed left rail (`44px`) + floating card.
  Rail: 5px dot (cyan for COURSE, muted for ANNOUNCEMENT) → vertical label
  (`writing-mode: vertical-rl`, mono 8px, `0.16em`) showing **course code** (COURSE) or
  **absolute date** `SEP 08` (ANNOUNCEMENT) → 1px gradient timeline line.
- **Cards:** pure white, radius `18px`, `padding 11px`, shadow; checkbox | subject (2-line
  clamp) / meta `SOURCE · SENDER` / action (mono, slate-soft) / deadline row with urgency
  pill right-aligned.
- **Urgency pills:** OVERDUE/TODAY = cyan→blue gradient + white text; SOON = `#E2E8F0`
  slate; none = hidden.
- **Toast:** floating white card, `14px` radius, mono message + cyan UNDO.

## Motion

- **Pagination:** direction-aware page slide (`x: ±48`, 0.35s, `ease [0.22,1,0.36,1]`),
  `<AnimatePresence mode="popLayout" custom={dir}>`; 4 cards/page, `1/3` indicator +
  chevrons.
- **Check:** strikethrough `scaleX 0→1` (0.22s, blue), then collapse (`height/opacity`,
  0.25s) at 320ms; undo via rollback log.
- **Pin:** icon rotates 45°, toggle glows with the accent gradient when pinned.
- `prefers-reduced-motion` respected.

## Icons

Inline SVG, `stroke: currentColor`, `stroke-width: 1.5`, `fill: none`: 4-point star,
`</>` code, sync arrows, calendar, check, thumbtack pin (rotates 45° when pinned).

## Data

UI consumes the backend card schema via an adapter in `App.jsx` (email_id/category_type/
source derived from id/course_code/sender) with a static **mock dataset**
(`src/mockData.js`, 9 items) used automatically when the API is unreachable (pure
frontend dev). Real API wins when the backend is live.
