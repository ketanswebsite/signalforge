# Stop Loss Exit Fix

## Phase 1: Identification of the Issue
**Problem:** Trades hitting stop losses are NOT being closed automatically
**Evidence:**
- Exit monitor runs every 5 minutes ✅
- Logs show "Checking 0 active trades" ❌
- Database has 20 active trades ✅
- Exit monitor can't see ANY trades!

**Root Cause Found:**
- `exit-monitor.js:81` calls `TradeDB.getActiveTrades()` without userId
- `database-postgres.js:1478` defaults userId to 'default'
- All trades belong to 'ketanjoshisahs@gmail.com'
- Query returns 0 trades because user_id mismatch
- NO exit conditions can trigger (stop loss, profit target, max days)

## Phase 2: Plan to Resolve the Issue
**Fix:** Modified `getActiveTrades()` to return ALL users' active trades when userId is null
- Line 1478: Changed default from 'default' to null
- Lines 1483-1493: Added conditional logic:
  - If userId provided → query for that specific user
  - If userId is null → query for ALL active trades
- Exit monitor can now see all trades across all users

## Phase 3: Testing the Resolved Issue
- Deploy fix to Render
- Monitor exit monitor logs - should show "Checking 20 active trades" (not 0)
- Wait for next 5-minute check cycle
- Verify trades with stop losses get closed
- Verify trades with profit targets get closed
