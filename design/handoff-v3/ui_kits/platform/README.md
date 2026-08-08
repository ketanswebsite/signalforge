# UI kit — SutrAlgo trading app

The signed-in product, rebuilt for v2. Light by default; the toggle in the app bar switches to dark. Resize the window below 720px to see the mobile layout.

## Screens
| Screen | Was called | What changed |
| --- | --- | --- |
| **Scanner** | Opportunities | One obvious action ("Run the scan"). Results carry their target and stop, plus a plain-English confidence line. |
| **Positions** | Trades | Open holdings show a rail between the stop and the target. Closed trades say *why* they closed in words. |
| **Simulator** | Backtested Simulation | Every chart has a `readAs` sentence. Headline stat is "what £10,000 became", not "total return". |
| **Alerts** | Telegram Alerts | Three numbered steps, a preview of a real message, and switches per alert type. |
| **Account** | My Account + Pricing | Plans, billing and data in one place. Prices come from a feed object, never typed in. |

## Vocabulary
A **signal** is what the scanner finds. You *take* a signal and it becomes a **position**. A sold position is a **trade**. The kit uses those three words consistently — v1 mixed them freely, which was the single biggest source of confusion.

## Files
`index.html` (reference entry — needs the original design project to render) · `shell.spec.jsx` (app bar, bottom nav, legal note) · `chart.spec.jsx` (Chart.js wrappers that read theme tokens) · one `*-screen.spec.jsx` per screen · `data.js` (the exact data shapes each screen consumes).

## Interactive
Run a scan (progress → results), take a signal (bottom sheet), sell a position, switch position tabs and filters, connect Telegram, flip alert switches, change region on the pricing tab, toggle light/dark.
