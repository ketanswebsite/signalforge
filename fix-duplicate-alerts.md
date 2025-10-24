# Fix: Duplicate Telegram Alerts for High Conviction Trades

## Phase 1: Identification of the Issue ✅

### Root Cause
The High Conviction Portfolio Manager sends repetitive Telegram alerts when trades reach their target because:

1. **Two separate monitoring systems exist:**
   - Exit Monitor (runs every 5 minutes) - monitors `trades` table - HAS duplicate prevention ✅
   - High Conviction Manager (runs daily at 4 PM UK) - monitors `high_conviction_portfolio` table - NO duplicate prevention ❌

2. **The Problem:**
   - High Conviction Manager in `lib/portfolio/high-conviction-manager.js` (lines 225-325)
   - When target/stop-loss reached, it closes trade and sends Telegram alert
   - **Missing duplicate prevention** - relies only on database status update
   - If `closeHighConvictionTrade()` fails to update DB, trade stays 'active'
   - Next run will send alert again (daily or if manually triggered via API)
   - No tracking table like Exit Monitor has (`trade_exit_checks`)

### Evidence from Logs
```
2025-10-20T15:00:04Z [HIGH CONVICTION] Broadcasting exit alert for JSWINFRA.NS...
2025-10-20T15:00:05Z [HIGH CONVICTION] Exit alert sent to 3 subscribers
2025-10-20T15:00:05Z [HIGH CONVICTION] Broadcasting exit alert for DIXON.NS...
2025-10-20T15:00:05Z [HIGH CONVICTION] Exit alert sent to 3 subscribers
```

## Phase 2: Plan to Resolve the Issue

### 2.1 Create High Conviction Exit Tracking Table
Create `high_conviction_exit_checks` table to track exit alerts.

### 2.2 Add Duplicate Prevention
- Add `checkAlertSent()` method (similar to Exit Monitor)
- Add `recordExitCheck()` method to track each check
- Update `updateAllActiveTrades()` to check before sending alerts

### 2.3 Improve Trade Closing
- Add verification after close to ensure status changed
- Add detailed error logging

## Phase 3: Testing the Resolved Issue

### 3.1 Database Migration
- Run migration to create tracking table
- Verify table created successfully

### 3.2 Code Testing
- Deploy updated code to Render
- Monitor next daily update at 4 PM UK
- Verify no duplicate alerts sent

### 3.3 Production Monitoring
- Watch Render logs for successful operation
- Confirm Telegram subscribers receive exactly one alert per exit event

---

**Status:** Implementation in progress
**Created:** 2025-10-24
**To be deleted after:** Phase 3 complete
