# Metrics Calculation Fix Plan

## Phase 1: Identify Incorrect Calculations
- [ ] Add temporary logging to see actual trade data structure
- [ ] Verify which fields exist on trade objects
- [ ] Check if closed trades are being filtered correctly
- [ ] Identify which specific calculations are wrong

## Phase 2: Fix Calculations
- [ ] Fix Total P&L calculation
- [ ] Fix Total Trades count (should it be all trades or closed trades?)
- [ ] Fix Avg Return calculation
- [ ] Fix Max Drawdown calculation

## Phase 3: Test and Deploy
- [ ] Verify all metrics match expected values
- [ ] Deploy to Render
- [ ] Remove debug logging and plan file
