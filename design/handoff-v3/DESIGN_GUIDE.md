# SutrAlgo Design System

**SutrAlgo** watches the market for one specific setup. When it finds one it tells you what to pay, what to sell at, and when to give up — then gets out of the way. It is an educational tool built on a refinement of William Blau's DTI, applied to **cash markets only** in India, the UK and the US, with three mechanical exits: **+8% target, −5% stop, or 30 days.**

This system is **v3 — "The Poster"**: a redesign, not a recreation of the shipped product. Cream paper and near-black ink, heavy frames, hard offset shadows, Archivo Black headlines, gold as a field and a highlight. Light-first with a dark (ink) theme, built around plain language and numbers that explain themselves.

---

## Sources

| Source | Detail |
| --- | --- |
| GitHub repo | **https://github.com/ketanswebsite/signalforge** (branch `main`) — the shipped product: Express server, Postgres, vanilla-JS front end under `public/` |
| Screens read | `landing.html`, `index.html`, `trades.html`, `portfolio-backtest.html`, `telegram-subscribe.html`, `pricing.html`, `account.html`, `login.html`, `admin-v2.html` |
| Styling read | `public/css/main.css` (21,400 lines) — v1's token set and class families |
| Navigation | `public/js/unified-navbar.js`; admin modules under `public/js/admin-*.js` |

Read the repo for anything this guide doesn't cover — the product's real data model, scan logic and admin surface all live there.

> **The v1 identity is gone by request.** Exo 2, Work Sans, glassy gold-on-black and the mandala logo were replaced in v2; v3 then swapped v2's quiet minimalism for the Poster direction the user chose from built candidates. `github.md` records the history; original values are recoverable from the repo.

---

## Index

| Path | What it is |
| --- | --- |
| `styles.css` | **Global entry point.** Import lines only — consumers link this one file. |
| `tokens/` | `fonts, palette, themes, typography, spacing, radii, elevation, motion, layers, base` |
| `css/components.css` | Component class rules — real `:hover`, `:focus` and media queries |
| `assets/` | `wordmark-light.svg`, `wordmark-dark.svg`, `app-icon.png`, `app-icon-light.png`, `favicon.png` |
| `components/` | 30 React components in six groups |
| `ui_kits/platform/` | The signed-in app — Scanner, Positions, Simulator, Alerts, Account |
| `ui_kits/admin/` | Admin portal — eight sections |
| `ui_kits/marketing/` | Home, pricing, sign in |
| `templates/` | `app-screen/`, `landing-page/` — starter files for consuming projects |
| `guidelines/` | 19 foundation specimen cards |
| `thumbnail.html` · `SKILL.md` · `github.md` | Tile, Agent-Skills wrapper, upstream sync record |

### Components

**core** — `Wordmark`, `Button`, `IconButton`, `Icon`, `Badge`, `Card`, `SegmentedControl`, `ThemeToggle`
**data** — `Stat`, `DataTable`, `PositionCard`, `ChartFrame`, `ProgressBar`, `MarketStatus`
**forms** — `Field`, `Select`, `Checkbox`, `Switch`
**feedback** — `Callout`, `LegalNote`, `EmptyState`, `Sheet`
**navigation** — `AppBar`, `BottomNav`, `SideNav`, `Tabs`, `UserMenu`
**marketing** — `SectionHeader`, `FeatureCard`, `PricingCard`

Each has a sibling `.d.ts` (props contract) and `.prompt.md` (what, when, example).

---

## The vocabulary

The biggest source of confusion in v1 was that *signal*, *trade* and *position* were used interchangeably. They are now three distinct things and the words are never swapped:

- A **signal** is what the scanner finds. It has a buy price, a target and a stop.
- You **take** a signal and it becomes a **position** — something you are holding.
- A sold position is a **trade**. Trades are history.

Navigation follows the same rule. **Scanner · Positions · Simulator · Alerts · Account** — not "Opportunities", "Backtested Simulation" or "Telegram Alerts".

---

## Content fundamentals

**Voice: someone explaining a rule to a capable person who is not a trader.** Calm, specific, never salesy and never patronising.

**Person.** Second person for the reader (*"you never have to decide in the moment"*), third person for the product (*"the formula sells at +8%"*). "We" only for company statements. Never "I".

**Case is structural.** Display headings and the label layer (eyebrows, stat labels, table headers, card titles) are UPPERCASE, wide-tracked — that is the poster voice. Everything a person actually reads — body, buttons, badges, hints, table cells — stays sentence case. Never uppercase a sentence.

**Plain words over product words.**

| Don't write | Write |
| --- | --- |
| Entry price / Current / Target | Bought at / Now / Sells at |
| Exit reason: Target hit | Why it sold: Hit the +8% target |
| Total return 18.7% | What £10,000 became — £11,824 |
| Backtested Simulation | Simulator |
| Active Signals | Holding now |
| P&L | Profit and loss, or just Result |

**Every number gets a sentence.** This is the rule that changed the product most. `63.4%` alone is meaningless; *"Above the 55% long-run average for this formula"* is not. If you cannot write the context line, the number probably shouldn't be on the screen.

**Every chart gets a reading.** `ChartFrame`'s `readAs` prop says what one unit on each axis means and what "up" means — written for someone who has never read a chart.

**Numbers are concrete and unrounded.** +8% target · −5% stop · 30 days · 63.4% · 15-day average hold · 90 free days · 07:00 UK. Never "high returns" where a real figure exists.

**Regulatory copy stayed; its volume didn't.** The obligation is unchanged, but it now sits in one collapsed `LegalNote` at the foot of the page instead of a stack of gold-railed blocks above the content. The standard wording is baked into the component:

> *"This service provides informational and educational tools only. Nothing here is investment advice or a recommendation to buy or sell."*
> *"Past performance is not a reliable indicator of future results."*
> *"You accept full responsibility for all investment decisions."*

Inline caveats go where the claim is — a performance stat carries its own footnote rather than pushing the reader to a block at the top.

**No emoji. Anywhere.**

---

## Visual foundations

### Colour
**Light by default**, dark on request. Light is cream poster paper (`#F3EFE6` page, `#FDFBF5` surface) with near-black ink `#141210`; dark inverts to the ink poster (`#141210` page, `#1D1A16` surface, cream text and cream frames). No blue-grey slate in either.

Gold plays three roles: a **solid field** (`--accent-field #D4AF37` — hero bands, tab underlines, progress fills, always carrying ink text or ink frames), a **highlight on ink** (`#E3C25A` — the gold words in an ink headline, active nav chips), and a **readable text gold on cream** (`--accent #8A6912`). Components read the tokens; no component names a hex.

Gain green and loss red are the only other saturated colours, and they only ever mean money moving. Warning amber and info blue exist for `Callout` and nothing else.

### Type
One superfamily, two voices:
- **Archivo Black** — headlines, card titles, stat values. Ships exactly one weight; headings are UPPERCASE by default (`--case-display`). **Never synthesise bold on it.**
- **Archivo** — body, buttons, labels, table cells, and **every number**. 17px base, 1.58 line height. Table figures are Archivo 700 with tabular numerals, right-aligned.
- **There is no monospace in this system.** It was tried twice and read as cold; tabular figures do the aligning.

### Spacing & layout
4px base, nine steps (`--s-1` 4px → `--s-9` 96px). App pages max at 1560px, marketing and reading at 1240px, prose at 68ch. Gutters are `clamp(16px, 4vw, 32px)`.

### Backgrounds
Flat. The animated gold orbs, the particle canvas and the radial backdrop are all gone — they cost clarity and performance for decoration. Surfaces are separated by one step of warm neutral and a 1px border.

### Cards
Square corners, `--surface` fill, a **2px ink frame** (`--frame`) — the frame IS the design. Internal dividers use the soft `--line`. `flush` cards get an ink header band with cream/gold text (the poster masthead); `tone="raised"` adds the gold `--shadow-pop`. No hover lift — position cards and feature tiles gain a hard shadow on hover instead.

### Corner radii
Square or pill, nothing between: `0` for cards, buttons and inputs · `4px` for sheets · pill for badges, nav chips, market dots and the switch. The tension between hard frames and soft chips is the look.

### Shadows
**Hard offsets, zero blur** — a second sheet of paper behind the first. `--shadow-1/2/3` are ink offsets (2/5/9px); `--shadow-pop` is the 6px solid-gold offset reserved for the one thing per page that must win (featured plan, open sheet, primary button hover). Dark mode swaps to black and gold-tinted offsets automatically.

### Motion
`--ease-out: cubic-bezier(.2,.8,.3,1)` for almost everything; `--ease-spring` for the switch knob alone. Four durations: 120ms (hover tints), 180ms (tab underline, checkbox tick, switch), 260ms (sheets and menus), 400ms (bars filling to a value).

**Removed:** card lifts, gradient bar wipes, table-row slides, shimmer sweeps, pulsing badges, rotating icon chips. **Kept:** the market-open dot, because it carries meaning. Everything honours `prefers-reduced-motion`.

### Hover, press, focus
Hover is a background tint or a border darkening — nothing moves. Press nudges half a pixel. Focus is a 3px gold ring (`--ring-focus`) on `:focus-visible`, never on mouse click. No information is hover-only; a touch device must see everything a pointer does.

### Transparency & blur
None. v1 leaned on glassmorphism; v2 uses opaque surfaces throughout. The only translucent element is the modal scrim.

### Imagery
The product ships no photography and no illustration. Charts (Chart.js, themed from CSS variables) and the wordmark are the only graphics. If a design needs an image, ask for one.

### Responsive
- **≤1040px** four-column grids fold to two
- **≤960px** app bar nav collapses to a hamburger; admin side nav becomes a scrolling strip
- **≤720px** everything goes single column; `DataTable` stops being a table and renders stacked cards; `BottomNav` appears
- **≤640px** `Sheet` slides up from the bottom edge with full-width buttons

Every interactive element is at least **44px** tall.

---

## Iconography

**Material Symbols Rounded** — softer than v1's filled Material Icons, and a better match for 10–14px radii. Loaded from the Google CDN in `tokens/fonts.css`; use the `Icon` component or a bare `<span class="material-symbols-rounded">`.

- **Outline (FILL 0) by default. Filled only for the current nav item.** That is the only thing fill signals.
- Sizes: 16 · 19 · 22 · 26 · 40px. Icons inherit `currentColor` — never hard-code a colour on one.
- **No custom SVGs, no PNG icons, no emoji, no Unicode symbols as icons.** The only hand-authored SVGs in the system are the Google "G" on the sign-in button (Google's own mark, from the source) and the checkbox tick.

Vocabulary in use: `radar · account_balance_wallet · science · notifications · person · trending_up · monitoring · schedule · group · credit_card · database · campaign · receipt_long · shield_person · settings · check · search · tune · download · play_arrow · expand_more · close · arrow_forward · arrow_back · lock · help · logout · light_mode · dark_mode · payments · person_add · sync · key · pause · campaign`.

### Logo

**The logo is a wordmark. There is no symbol, emblem or mandala.** "Sutr" in Archivo 700 in `--text`, "Algo" in 500 in gold — the weight and colour shift is the whole idea. The "SA" monogram tile (Archivo Black, gold on ink, square) covers favicons, app icons and avatars.

Files: `assets/wordmark-light.svg`, `assets/wordmark-dark.svg`, `assets/app-icon.png` (dark), `assets/app-icon-light.png` (gold), `assets/favicon.png`. In React, use `<Wordmark />` — never re-typeset it by hand, and never draw a mark to sit beside it.

---

## Rules of thumb

1. **No bare numbers.** Every `Stat` gets a `context` sentence; every chart gets a `readAs`.
2. **One primary button per screen.**
3. **Uppercase is for the label layer only** — never for a sentence.
4. **Signal → position → trade.** Never mix the three.
5. **One `LegalNote` per page, at the foot.**
6. **Nothing is hard-coded** — prices, plans and currencies come from data.
7. **Nothing lifts, wipes or glows on hover.**
8. **44px minimum tap target; nothing hover-only.**
9. **Both themes, always.** Read `--accent`, never a hex.
