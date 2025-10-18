# Animation Fix Plan

## Phase 1: Identification
**Problem**: Applied wrong animation system from index.html instead of landing.html
- Created animationController.js with wrong background class `.animated-background`
- Should have used `.landing-background` from landing.html
- User wants the landing.html animation (particles with connections, orb tracking, parallax)

## Phase 2: Resolution Steps

### Step 1: Remove Wrong Files
- Delete `/public/js/animationController.js`
- Revert changes from main.css (remove `.animated-background` styles)

### Step 2: Revert HTML Pages (14 pages)
Remove from all pages:
- `<script src="/js/animationController.js" defer></script>`
- `<div class="animated-background animated-background--[full/reduced]">` sections
- Animation initialization scripts

### Step 3: Apply Correct Animation
Add to all pages:
- `<script src="/js/landing.js" defer></script>`
- `<div class="landing-background">` structure from landing.html
- Same gradient orbs (3) and floating elements (6)

### Step 4: Reduce Hover Glow by 50%
In main.css line 70:
- Change: `--shadow-gold-hover: 0 15px 50px rgba(212, 175, 55, 0.5);`
- To: `--shadow-gold-hover: 0 15px 25px rgba(212, 175, 55, 0.25);`

## Phase 3: Testing
- Push to GitHub
- Deploy to Render
- Verify animations work correctly on deployed site
- Delete this plan file

## Files to Update
1. Delete: `/public/js/animationController.js`
2. Edit CSS: `/public/css/main.css` (remove animated-background styles, reduce hover glow)
3. Revert 14 HTML files and apply correct animation
