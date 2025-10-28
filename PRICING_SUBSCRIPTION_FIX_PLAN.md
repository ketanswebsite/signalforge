# Pricing Page & Subscription System Fixes - Implementation Plan

## Phase 1: Identification of Issues ✅ COMPLETE

**Issues Found:**
1. **Location Detection Missing**: Pricing page shows all 3 regions manually, no auto-detection
2. **Trial Period Inconsistency**: Only India prominently shows 90-day trial (UK/US less clear)
3. **No Trial Prompt**: Users can access system without activating trial first
4. **Missing Admin UI**: Backend exists for complimentary access, but no UI to grant lifetime access
5. **Backend Verification Needed**: Confirm trial creation works without payment info

## Phase 2: Plan to Resolve Issues (IN PROGRESS)

### A. Add IP-Based Geolocation (Backend + Frontend)
- [ ] Add `geoip-lite` npm package for server-side IP detection
- [ ] Create `/api/user/location` endpoint returning user's country code
- [ ] Update `pricing.js` to fetch location on page load
- [ ] Show only detected region's pricing (UK→GBP, US→USD, India→INR)

### B. Fix Trial Period Display Consistency
- [ ] Update `pricing.html` hero section to show "90-Day Free Trial" for all regions
- [ ] Ensure all plan cards show trial information clearly
- [ ] Remove region selector UI (keep single-region display)

### C. Implement Trial Activation Gate
- [ ] Create middleware to check if user has any subscription/trial
- [ ] If no subscription: redirect to trial activation prompt page
- [ ] Block all protected routes until trial activated
- [ ] Update `/routes/auth.js` Google OAuth callback to check subscription status
- [ ] Create simple trial activation flow (no payment info required)

### D. Build Admin Complimentary Access UI
- [ ] Add "Complimentary Access" section in Users tab of `admin-v2.html`
- [ ] Build UI for grant/revoke/extend access
- [ ] Connect to existing `/api/admin/users/:email/grant-access` endpoint
- [ ] Display list of all complimentary users

### E. Verify Backend Integration
- [ ] Test trial creation endpoint
- [ ] Verify database tracking
- [ ] Ensure middleware allows trial access
- [ ] Test trial-to-paid conversion

### F. Update CSS
- [ ] Add any new styles to `main.css` only
- [ ] Reuse existing CSS classes

## Phase 3: Testing the Resolved Issue

**Test Cases:**
1. [ ] Location Detection: Access from UK/US/India IPs, verify correct pricing shown
2. [ ] Trial Activation: New Google login → trial prompt → activate → verify 90-day access
3. [ ] Access Gate: Attempt to access features without trial → blocked
4. [ ] Admin Grant: Use admin panel to grant lifetime access → verify permanent access
5. [ ] Admin Revoke: Revoke complimentary access → verify fallback works
6. [ ] Trial Expiry: Test trial end behavior (mock expiry date)
7. [ ] Backend Data: Query database to confirm correct tracking
8. [ ] Payment Flow: Verify paid subscription still works after trial

## Files to Modify
- `public/pricing.html`
- `public/js/pricing.js`
- `public/admin-v2.html`
- `public/js/admin-user-management-v2.js`
- `routes/auth.js`
- `routes/subscription.js`
- `middleware/subscription.js`
- `server.js`
- `package.json`
- `main.css`
