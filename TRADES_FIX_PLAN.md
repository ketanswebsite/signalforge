# Trades.html Fixes + Multi-User Architecture Plan

## Phase 1: Identification of Issues

### Issue A: Historical Pattern Analysis Showing Zeros
- **Status**: ✅ FIXED
- **Description**: All statistics displaying 0.00% despite 4 active trades existing
- **Root Cause**: trades table had NULL values for win_rate, entry_dti, etc. even though columns existed
- **Solution**: Updated insertTrade() to include 10 signal fields, created migration 011 to backfill existing trades

### Issue B: Portfolio Capital Display Errors
- **Status**: ✅ FIXED
- **Description**: Showing "₹10.00", "£0.0%", "$0.0%" with formatting problems
- **Root Cause**: 69 duplicate rows in portfolio_capital (PostgreSQL treats NULL != NULL in UNIQUE constraints)
- **Solution**: Created migration 012 to clean duplicates, switched from NULL to 'system' as sentinel value

### Issue C: Multi-User Architecture Gap
- **Status**: IDENTIFIED
- **Description**: Current system uses hardcoded email in trade-executor.js
- **Future Requirement**: Each subscriber should get trades in their own portfolio with independent capital tracking

---

## Phase 2: Plan to Resolve Issues

### Part A: Fix Current Inconsistencies (Immediate)

**A1. Debug Historical Pattern Analysis**
- [x] Check database trades for signal field values (win_rate, entry_dti, etc.)
- [x] Updated insertTrade() to include 10 signal fields
- [x] Created migration 011_backfill_signal_data_to_trades.sql
- [x] Deployed and verified: All 4 trades now have signal data

**A2. Fix Portfolio Capital Display**
- [x] Identified root cause: 69 duplicate rows due to NULL in UNIQUE constraint
- [x] Created migration 012_fix_portfolio_capital_duplicates.sql
- [x] Updated database code to use 'system' instead of NULL
- [x] Deployed and verified: 3 clean rows (one per market)
- [ ] Test frontend display shows correct values

**A3. Verify Trade History**
- [ ] Confirm empty state is correct (no closed trades)
- [ ] Test closing mechanism

### Part B: Multi-User Architecture (Long-term)

**B1. Database Schema Updates**
- [ ] Add `auto_execution_enabled` to user_settings table
- [ ] Change portfolio_capital to use actual user_id instead of NULL
- [ ] Create migration script

**B2. Trade Executor Refactor**
- [ ] Remove hardcoded email
- [ ] Query users with auto_execution_enabled = true
- [ ] Loop through subscribed users for each signal
- [ ] Create trades per-user with proper validation

**B3. Capital Manager Updates**
- [ ] Add userId parameter to validateTradeEntry()
- [ ] Add userId parameter to allocateCapital() and releaseCapital()
- [ ] Implement per-user position limit checks
- [ ] Implement per-user capital tracking

**B4. Admin UI**
- [ ] Add toggle for users to enable/disable auto-execution
- [ ] Display per-user capital allocation
- [ ] Show per-user position limits

---

## Phase 3: Testing

### Test A: Current Fixes
- [ ] Historical Pattern Analysis displays correct percentages
- [ ] Portfolio Capital shows: ₹100,000, £10,000, $10,000
- [ ] Trade History displays correctly when trades are closed
- [ ] All 4 active trades display in Active Signals section

### Test B: Multi-User Architecture
- [ ] Add second test user with auto-execution enabled
- [ ] Trigger manual execution for test market
- [ ] Verify both users receive separate trade entries
- [ ] Verify capital allocated independently per user
- [ ] Test position limit enforcement (max 10/market, 30 total per user)
- [ ] Verify one user reaching limit doesn't block other users
- [ ] Test disabling auto-execution for one user

---

## Progress Tracking

**Current Phase**: Phase 2A Complete → Testing Phase 3A
**Started**: 2025-10-16
**Latest Update**: 2025-10-16 18:06 UTC

**Completed**:
- ✅ Migration 011: Backfilled signal data for 4 trades (win_rate, DTI metrics)
- ✅ Migration 012: Cleaned 69 duplicate rows → 3 clean rows
- ✅ Database code updated to use 'system' instead of NULL
- ✅ Deployed to Render successfully

**Next Steps**:
1. Test trades.html to verify Historical Pattern Analysis now shows percentages
2. Verify Portfolio Capital displays correct amounts (₹1,000,000, £10,000, $15,000)
3. Begin Phase 2B (Multi-User Architecture) design
