# Admin & Trial Status Display Fix

## Phase 1: Identification of Issues

**Problems:**
1. Admin users don't see their special status displayed on account/pricing pages
2. Trial status not prominently displayed on pricing page for active trial users
3. No clear indication of "Admin - Unlimited Access" vs "Trial - X days remaining"

## Phase 2: Plan to Resolve

### A. Update `/api/user/subscription` endpoint to include admin flag
- Modify the response to always include admin status
- Return admin info even when no subscription exists

### B. Update account.js
- Fetch user info from `/api/user` to check admin status
- Display "Admin - Unlimited Access" badge prominently
- Show trial info if user has active trial
- Add admin indicator to hero subscription card

### C. Update pricing.js
- Fetch user authentication and subscription status on page load
- Display status banner at top of pricing page:
  - "Admin Access - Unlimited" (green)
  - "Free Trial Active - X days remaining" (blue)
  - "No subscription" with call-to-action

### D. Update pricing.html
- Add status banner container at top of page

## Phase 3: Testing

- Test as admin user
- Test as trial user
- Test as non-subscribed user
- Verify both account.html and pricing.html show correct status
