# UI kit — SutrAlgo marketing site

Public, signed-out surface: home, pricing, sign in.

Built from `public/landing.html`, `public/pricing.html` and `public/login.html`, rewritten for v2.

## What changed from v1
- The hero no longer explains the Sanskrit etymology. It says what arrives on your phone.
- The three exit rules are the hero's second section, as three plain chips.
- Performance figures carry their own caveat inline instead of a wall of disclaimers at the top.
- Prices come from `data.js` per region — nothing is typed into a screen.
- Sign-in explains what Google access actually grants, which was the most common support question.

## Files
`site.spec.jsx` (bar + footer) · `home-screen.spec.jsx` · `pricing-screen.spec.jsx` · `sign-in-screen.spec.jsx` · `data.js` (plan feed + FAQ copy)

## Notes
The Google mark in the sign-in button is Google's own SVG, copied from the source `login.html`.
