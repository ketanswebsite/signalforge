# Handoff: SutrAlgo v3 "Poster" redesign

## Overview
SutrAlgo (repo `ketanswebsite/signalforge`) is being rebranded and restructured to the **v3 "Poster" design system**: cream paper + near-black ink, heavy 2px frames, hard offset shadows (zero blur), Archivo Black display type, gold as a field and a highlight. The redesign also renames the product's surfaces and vocabulary. This package contains everything needed to adapt the existing codebase.

## About the design files
Everything in this bundle is a **design reference created in HTML/JSX** — prototypes showing intended look and behaviour, not production code to copy directly. The task is to **recreate these designs inside the existing signalforge environment** (Express + vanilla JS + one `public/css/main.css`, server-rendered HTML pages) using its established patterns. The two CSS files (`styles.css` closure and `css/components.css`) ARE production-grade and can be adopted nearly as-is; the JSX screen files are specs to read, not modules to import (the target codebase is not React).

The `ui_kits/**/index.html` files load a compiled component bundle that only exists in the original design project — they will not render standalone from this folder. Read the `*.spec.jsx` files as layout/behaviour specs; every visual property they use resolves to a class in `css/components.css` or a token in `tokens/`.

## Fidelity
**High-fidelity.** Colors, type, spacing, borders, shadows, states and copy are final. Recreate pixel-perfectly. The copy shown in the kits is real product copy — use it verbatim unless it conflicts with live data.

## The three surfaces

### 1. Marketing site (`ui_kits/marketing/`) — replaces `public/landing.html`, `pricing.html`, `login.html`
- **Home** (`home-screen.spec.jsx`): full-bleed **ink hero band** (`--text` background, 3px ink bottom border) with cream uppercase Archivo Black headline "ONE RULE. HELD IN **YOUR HEAD.**" (the last phrase in `--gold-on-band`), cream CTA button carrying a `4px 4px 0` gold shadow, and a raised "This morning's scan" card that **overlaps the band's bottom edge by 72px** (`margin-bottom:-72px` inside a band with `padding-bottom:72px`; next section adds `72px` top padding). Then: three exit-rule chips (+8% / −5% / 30 days — heavy frame + `--shadow-pop`), a 4-up feature grid, a stat band with per-stat context sentences and an inline caveat, closing CTA.
- **Pricing** (`pricing-screen.spec.jsx`): region switcher (UK/US/India) drives a plan-feed object — **prices are data, never typed into markup**. Two plans only: Explorer (90 days free) and Trader. Comparison note card + accordion FAQ.
- **Sign in** (`sign-in-screen.spec.jsx`): single card, Google button (Google's own SVG, already in the source repo's `login.html`), a callout explaining exactly what Google access grants.

### 2. Trading app (`ui_kits/platform/`) — replaces `public/index.html`, `trades.html`, `portfolio-backtest.html`, `telegram-subscribe.html`, `account.html`
Five screens with **renamed navigation**: `Scanner` (was Opportunities), `Positions` (was Trades), `Simulator` (was Backtested Simulation), `Alerts` (was Telegram Alerts), `Account` (merges account + pricing).
- **Scanner**: one primary action ("Run the scan"), market-status pills with real times, a settings card, progress with a "320 of 500 stocks checked" detail line, results as signal cards each carrying buy/target/stop and a confidence bar with a plain-English line ("Similar setups worked 78% of the time"). Taking a signal opens a bottom sheet.
- **Positions**: stat row (each number has a context sentence), "Holding now / Already sold" tabs, `PositionCard`s with a stop→target rail (see spec below), sell confirmation sheet, closed-trades table whose "Why it sold" column is words ("Hit the +8% target"), not codes.
- **Simulator**: parameter card, "This is a simulation" callout, headline stat is "What £10,000 became", every chart wrapped with a one-sentence `readAs` caption and square legend swatches.
- **Alerts**: 3 numbered connect steps, a framed preview of a real Telegram message (two-column label/amount receipt, tabular figures), per-alert-type switches, recent alerts list.
- **Account**: trial countdown callout, plan/billing/data tabs, region-driven pricing, data export + typed-DELETE account closure.

### 3. Admin portal (`ui_kits/admin/`) — replaces `public/admin-v2.html` + `public/js/admin-*.js`
Ink masthead + "Admin" chip, grouped `SideNav` (Overview/People/Product/System; becomes a horizontal scroll strip ≤960px). Eight sections in `sections.spec.jsx`: Analytics (KPIs + "Needs a look" table), Users (search/filter/detail sheet), Subscriptions, Signal testing (parameter replay with live-vs-test comparison), Broadcasts (audience segmenting, send-me-a-test), Database (read-only SQL, table rail collapses ≤960px), Audit log, Settings & roles (RBAC matrix + danger zone).

## Component specs (the important ones)

**Button** `.sa-btn`: 44px min height, square, 2px ink border, Archivo 700. Primary = ink fill, cream text, `4px 4px 0 rgba(20,18,16,.25)` shadow; hover keeps position but shadow turns solid gold `#D4AF37`; active nudges `translate(1px,1px)` and halves the shadow. Secondary = transparent + frame; quiet = borderless; danger = loss-red outline. One primary per screen.

**Card** `.sa-card`: square, `--surface` fill, **2px `--frame` border**, 24px padding. `flush` variant: zero padding + an **ink header band** (`--text` bg, cream title, gold hint) — the poster masthead. `raised`: adds `--shadow-pop` (6px solid gold offset).

**Stat** `.sa-stat`: uppercase 13px/700 label with `.07em` tracking → Archivo Black value (34px, tabular) → optional benchmark bar (7px, framed, square) → a **context sentence in plain English**. A number without its context line is a defect, not a style choice.

**PositionCard** `.sa-pos`: symbol (Archivo Black uppercase) + signed P/L; an 8px framed rail where fill-width = `((plPercent + 5) / 13) * 100`% (stop −5% at 0, break-even pin at 38.5%, target +8% at 100%), green fill when up, red when down; a 3-column "Bought at / Now / Sells at" grid; a footer badge spelling the exit rule ("Day 12 of 30 — auto-sells in 18 days", warn tone when ≤5 days left); a thin days-elapsed bar. Hover = `--shadow-2`, no movement.

**DataTable** `.sa-table`: uppercase 11px ink headers over a 2px frame rule; body rows split by soft 1.5px `--line`; row hover = `--accent-soft` tint; numeric cells right-aligned Archivo 700 tabular. **≤720px the table is hidden and rows render as framed stacked cards** (`.sa-table__cards` / `.sa-rowcard`) keyed by a primary column with the "lead" column top-right.

**Sheet** `.sa-sheet`: centred dialog with 2.5px frame + gold pop shadow, ink header band; **≤640px it becomes a bottom sheet** (slides up 260ms, full-width buttons). Escape and scrim-click close.

**LegalNote** `.sa-legal`: one collapsed line above the footer — "Educational tool, not investment advice. Your capital is at risk." — expanding to the three standard regulatory paragraphs. Exactly one per page. The three standard paragraphs, verbatim: (1) "This service provides informational and educational tools only. Nothing here is investment advice or a recommendation to buy or sell." (2) "Past performance is not a reliable indicator of future results. All trading involves risk and you could lose money." (3) "Technical indicators can produce false signals, and market conditions can change quickly. You accept full responsibility for all investment decisions."

**Navigation**: `.sa-appbar` is an ink masthead (cream wordmark, gold "Algo", pill nav chips — active chip gold-outlined; collapses to hamburger ≤960px). `.sa-bottomnav` is the mobile tab bar (≤720px, filled icon + 3px gold top cap on the current item; pad page bottom by 64px). Admin uses `.sa-sidenav`.

Also in `css/components.css`: `sa-badge` (pill, sentence case), `sa-seg` (segmented control, active = ink fill), `sa-field/input/select` (2px frames, gold focus ring `0 0 0 3px rgba(138,105,18,.35)`), `sa-check` (square, ink fill, gold tick strokes in over 180ms), `sa-switch` (pill, gold track when on), `sa-callout`, `sa-empty`, `sa-menu`, `sa-tabs` (4px gold underline), `sa-prog`, `sa-market` (pulsing dot only while market is open), `sa-plan`, `sa-feature`, `sa-eyebrow`, and layout utilities `sa-page / sa-grid--2/3/4/split/rail / sa-row / sa-spread / sa-stack`.

## Interactions & behaviour
- Motion: `--ease-out cubic-bezier(.2,.8,.3,1)`; 120ms hover tints, 180ms tab underline/tick/switch, 260ms sheets/menus, 400ms bars filling. **Nothing lifts, wipes, or shimmers on hover** — hover changes colour or adds a hard shadow. All animation is disabled under `prefers-reduced-motion`.
- Responsive contract: ≤1040px 4-grids→2 · ≤960px app-bar nav→hamburger, admin sidenav→strip, `--rail`→stacked · ≤720px all grids→1 column, tables→stacked cards, bottom nav appears, `--split`→1 column · ≤640px sheets→bottom sheets. Every target ≥44px; nothing is hover-only.
- Theme: light default; `data-theme="dark"` on `<html>` flips every token (ink page, cream frames, masthead inverts to cream). Persist as `localStorage["sa-theme"]`. **Use `--gold-on-band` for any gold sitting on the masthead band** — it flips bright↔deep gold so contrast survives the inversion.
- Scanner scan: button → loading spinner → progress bar with count detail → results + stat row.
- Vocabulary rule (enforce in copy): a **signal** is what the scanner finds; taking it creates a **position**; a sold position is a **trade**. Never interchange.

## State management
Reference `data.js` in each kit for the exact shapes the screens consume: nav items, market status (`{market,status,note}`), positions (`{symbol,name,currency,plPercent,plLabel,entry,current,target,stop,daysHeld}`), closed trades (`{symbol,closed,held,pl,money,reason}`), signals (`{symbol,name,market,price,target,stop,confidence,confirmed}`), plan feed keyed by region, admin users/payments/audit rows. Prices, plans and currencies must come from the API/feed — **never hard-code an amount, currency or plan name in markup**.

## Design tokens
Full set in `tokens/` (each file is one concern; `styles.css` imports the closure). Key values:
- Light: bg `#F3EFE6` · surface `#FDFBF5` · sunk `#EBE5D8` · text/frame `#141210` · text-2 `#5B564A` · text-3 `#8B8371` · soft line `#DED8C8`
- Dark: bg `#141210` · surface `#1D1A16` · raised `#322D22` · text/frame `#F3EFE6`
- Gold: field `#D4AF37` · on-ink `#E3C25A` · on-cream text `#8A6912` · tint `#F7EBC4` · `--gold-on-band` = `#E3C25A` light / `#8A6912` dark
- Outcomes: gain `#177A4C`/`#4ADE80` · loss `#C22B1F`/`#F87171` · warn `#8A5A00`/`#FBBF24` · info `#1F5FA8`/`#8FBEF5` (+ soft tints in `tokens/palette.css`)
- Type: **Archivo Black** (display, one weight, uppercase via `--case-display`; never synthesise bold) + **Archivo** 400/500/600/700 (body 17px/1.58; every number, tabular in columns). **No monospace anywhere.** Google Fonts: `family=Archivo+Black&family=Archivo:wght@400;500;600;700`
- Icons: **Material Symbols Rounded**, outline; fill only on the current nav item. No custom SVGs, no emoji.
- Spacing: 4px base — `--s-1..9` = 4/8/12/16/24/32/48/64/96 · page rails 1560px app, 1240px marketing · appbar 60px · tabbar 64px · tap-min 44px
- Radii: `0` cards/buttons/inputs · `4px` sheets · pill badges/chips/switch
- Shadows: `2/5/9px` solid ink offsets + `--shadow-pop: 6px 6px 0 #D4AF37`. No blur.

## Assets
`assets/wordmark-light.svg`, `assets/wordmark-dark.svg` (typographic wordmark: "Sutr" Archivo 700 ink + "Algo" 500 gold), `assets/app-icon.png` / `app-icon-light.png` / `favicon.png` ("SA" in Archivo Black, gold on ink). **The logo is a wordmark — there is no symbol or mandala; the old `public/images/logo.PNG` is retired.** Replace favicon references across `public/*.html`.

## Files in this bundle
- `DESIGN_GUIDE.md` — the full brand/design guide (voice, vocabulary, foundations, rules of thumb)
- `styles.css` + `tokens/*.css` + `css/components.css` — production-ready CSS (adopt in place of the 21,000-line `main.css`)
- `assets/` — wordmark + icons
- `ui_kits/platform/`, `ui_kits/admin/`, `ui_kits/marketing/` — screen specs (`*.spec.jsx` + `data.js` + per-kit `README.md` with source-file mapping back to the current repo)

## Suggested migration order
1. Ship `styles.css` + `tokens/` + `css/components.css` alongside the old `main.css`; add fonts + favicon.
2. Rebuild the marketing pages (smallest surface, biggest visual payoff), then the five app screens (renaming nav routes/labels), then admin.
3. Delete `main.css`, `modern-effects.js`, `landing.js` particle/orb code, and the old logo once nothing references them.


---

## v3.1 additions — six screens the v3 handoff didn't cover

New screen specs, same conventions (`*.spec.jsx` reads every visual property from `tokens/` or `css/components.css`; prices/currencies always come from `data.js`, never markup):

| Folder | Screens | Notes |
| --- | --- | --- |
| `ui_kits/checkout/` | `checkout-flow.spec.jsx` — pay, success (receipt), failure | The payment frame (`.sa-payframe`) hosts the provider's own element — Stripe (UK/US) or Razorpay (India) mounts inside `.sa-payframe__slot`; SutrAlgo never renders card inputs. Decline errors are a loss-tone Callout in plain English. One primary: the pay button, with a `loading` processing state. |
| `ui_kits/lifecycle/` | `trial-lifecycle.spec.jsx` — day 1, 14-day chip, 5-day warn chip, expired | The countdown chip (`.sa-countdown`, `--warn` at ≤5 days) sits in the app bar's `end` slot from 14 days out. Expired = read-only badge, history intact, exactly one upgrade path. |
| `ui_kits/account-data/` | `data-management.spec.jsx` | Export rows (`.sa-dl`), plain-language "what we store and why", deletion behind a typed-DELETE `Sheet` (confirm disabled until the text matches — same pattern as the Account danger zone). |
| `ui_kits/legal/` | `legal-doc.spec.jsx` | One template renders both `terms` and `privacy` from `data.js`. Reading-max measure, ink section numbers (`.sa-doc__secnum`), sticky ToC rail (`.sa-toc`) that becomes a horizontal strip ≤960px. |

### New CSS components (appended to `css/components.css`, diff against your copy)

- `.sa-receipt` / `__row` / `__row--total` — label/amount rows, tabular figures; the total row is an ink band with the amount in gold display type.
- `.sa-dl` — framed download/list row: icon tile, name + hint, right-aligned size.
- `.sa-countdown` (+ `--warn`) — app-bar trial chip: ink number tile + link.
- `.sa-payframe` / `__slot` (+ `--error`) — the frame around a third-party payment element, with dashed mount slot and error border.
- `.sa-doc` / `.sa-toc` — long-form document grid, sticky contents rail, ink section numbers, `--reading-max` measure.

All five read only existing tokens — no new tokens were added, and both themes work unchanged.

### Rules carried through
Region-driven prices from data (₹/£/$ never typed), one primary per screen, every stat with a context sentence, one LegalNote per page, tabular numerals on money, sheets become bottom sheets ≤640px, no exclamation marks in failure copy.
