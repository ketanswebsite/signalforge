# Analytics Metrics Fix Plan

## Phase 1: Identification of the Issue
- [x] Read trades.html to understand the structure
- [x] Locate the JavaScript file(s) that populate the analytics-metrics-grid
- [x] Identify the data source and calculation logic
- [x] Determine why metrics are showing 0/N/A values

**Finding:** TradeUI-MetricCards.js was using snake_case field names (pl_percent, pl_amount, entry_date, exit_date, exit_reason, market) while the rest of the codebase uses camelCase (profitLossPercentage, profitLoss, entryDate, exitDate, exitReason). This mismatch caused all metrics to show 0 values.

## Phase 2: Plan to Resolve the Issue
- [x] Fix data fetching if API endpoint is not returning data
- [x] Fix calculation logic if computations are incorrect
- [x] Ensure proper data flow from backend to frontend
- [x] Update any database queries if needed

**Changes Made:**
1. Updated all field references in TradeUI-MetricCards.js to use camelCase naming
2. Added fallback field names for backward compatibility (e.g., `t.profitLossPercentage || t.plPercent`)
3. Fixed market detection logic to derive market from symbol suffix (.NS, .L, etc.)
4. Updated all date field references from snake_case to camelCase
5. Fixed exit reason field references

## Phase 3: Testing the Resolved Issue
- [ ] Verify metrics display real values
- [ ] Test with different user accounts/trade data
- [ ] Check browser console for errors
- [ ] Deploy to Render and monitor logs
