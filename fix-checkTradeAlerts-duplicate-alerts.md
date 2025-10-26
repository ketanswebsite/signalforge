# Fix checkTradeAlerts Duplicate Alerts Issue

## Phase 1: Identification

### Issue
User receiving repetitive Telegram alerts every 5 minutes for trades reaching target, even on weekends when markets are closed.

### Root Cause
The `checkTradeAlerts()` function in server.js (line 2961) runs via `setInterval` every 5 minutes (line 3045) with:
- ❌ NO weekend check (runs 24/7 including Sat/Sun)
- ❌ NO market hours check (runs outside trading hours)
- ❌ NO duplicate prevention (sends same alert repeatedly)
- ❌ NO trade closing logic (trades stay active after target reached)

### Alert Flow
1. `setInterval(checkTradeAlerts, 5 * 60 * 1000)` runs unconditionally
2. Gets active trades via `TradeDB.getActiveTrades(user.user_id)`
3. Checks if target/stop loss conditions met
4. Sends alert via `telegramBot.sendTelegramAlert()` every 5 minutes
5. Trade remains active (never closed), so next check finds same condition

### Alert Format (telegram-bot.js:383-393)
```
🎯 ✅ TARGET REACHED
📊 Stock: AXL
💰 Price: ₹6.49
📍 Entry: ₹5.66
🎯 Target: ₹6.11
💹 P/L: 14.66%
📝 Reason: Target price reached
🕐 Time: 10/26/2025, 8:36:22 PM
```

## Phase 2: Solution Plan

### Fix Strategy
Add similar logic as Exit Monitor system:
1. Add market hours check (weekdays only, 8 AM - 9 PM UK time)
2. Add duplicate alert prevention using tracking table
3. Integrate with Exit Monitor to close trades when alerts sent
4. Add logging for debugging

### Implementation Steps

#### Step 1: Modify checkTradeAlerts() in server.js
- Add UK timezone market hours check before processing
- Skip checking if not Mon-Fri between 8 AM - 9 PM UK time
- Add logging for when checks are skipped

#### Step 2: Add Duplicate Prevention
- Create `trade_alerts_sent` table to track sent alerts
- Before sending alert, check if already sent for this trade + alert type
- Record alert after successfully sending
- Prevent same alert being sent multiple times

#### Step 3: Integrate Trade Closing
- After sending alert, mark trade as closed in database
- Use `TradeDB.closeTrade()` to properly close the trade
- Release capital via CapitalManager
- Verify trade closed before recording alert as sent

#### Step 4: Migration for Tracking Table
```sql
CREATE TABLE IF NOT EXISTS trade_alerts_sent (
    id SERIAL PRIMARY KEY,
    trade_id INTEGER NOT NULL REFERENCES trades(id),
    user_id VARCHAR(255) NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(trade_id, alert_type)
);

CREATE INDEX idx_trade_alerts_trade_type ON trade_alerts_sent(trade_id, alert_type);
```

## Phase 3: Testing Plan

### Test 1: Weekend Check
- Verify alerts NOT sent on Sat/Sun
- Check logs show "Skipping alert check - market closed"

### Test 2: Market Hours Check
- Verify alerts NOT sent before 8 AM or after 9 PM UK time on weekdays
- Check logs show proper timezone handling

### Test 3: Duplicate Prevention
- Verify alert sent only ONCE when target reached
- Verify no repeat alerts on subsequent 5-minute checks
- Check `trade_alerts_sent` table has proper records

### Test 4: Trade Closing
- Verify trade status changes to 'closed' after alert sent
- Verify capital released properly
- Verify trade no longer appears in active trades list

### Test 5: Integration
- Verify existing Exit Monitor continues to work
- Verify High Conviction Manager continues to work
- Verify no conflicts between the three alert systems

## Notes
- This is separate from Exit Monitor (for regular trades) and High Conviction Manager (for high conviction portfolio)
- All three systems should work independently with their own duplicate prevention
- User alerts are per-user (telegram_chat_id), while Exit Monitor is global
