# Trading Signals Integration: 7 AM Signals with Capital Tracking & Telegram Alerts

**Project**: SutrAlgo Trading Platform Enhancement
**Version**: 1.0
**Last Updated**: January 2025
**Status**: Planning & Design Phase

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current System Analysis](#current-system-analysis)
3. [Project Objectives](#project-objectives)
4. [System Architecture](#system-architecture)
5. [Duplicate Signal Prevention](#duplicate-signal-prevention)
6. [Phase 1: Database & API Foundation](#phase-1-database--api-foundation)
7. [Phase 2: Capital Tracking System](#phase-2-capital-tracking-system)
8. [Phase 3: 7 AM Signal Integration](#phase-3-7-am-signal-integration)
9. [Phase 4: Telegram Alert Integration](#phase-4-telegram-alert-integration)
10. [Phase 5: Enhanced Trade Management](#phase-5-enhanced-trade-management)
11. [Phase 6: User Settings & Preferences](#phase-6-user-settings--preferences)
12. [Phase 7: Testing & Refinement](#phase-7-testing--refinement)
13. [Implementation Guidelines](#implementation-guidelines)
14. [Technical Specifications](#technical-specifications)
15. [Risk Assessment & Mitigation](#risk-assessment--mitigation)
16. [Appendices](#appendices)

---

## Executive Summary

### Overview
This document outlines the comprehensive plan to integrate automated 7 AM trading signals into the trades page with capital tracking, position management, and Telegram alert integration. The system will automatically scan 2000+ stocks daily at 7 AM UK time, identify high-conviction opportunities (>75% win rate), and make them available for one-click addition to user portfolios with real-time capital management and exit monitoring.

### Key Features
- **Automated Signal Generation**: Daily 7 AM scan of global markets (India, UK, US)
- **Capital Tracking**: Track available capital per market with real-time updates
- **Position Management**: Enforce position limits (30 total, 10 per market)
- **One-Click Trade Entry**: Add signals to portfolio with automatic validation
- **Real-Time Exit Monitoring**: Check for target, stop-loss, and time-based exits
- **Telegram Alerts**: Automatic notifications for entry, exit, and portfolio events
- **Duplicate Prevention**: Intelligent system to prevent duplicate signals
- **Portfolio Analytics**: Track performance, win rates, and capital utilization

### Expected Benefits
- Reduce manual trade entry time by 90%
- Improve capital utilization across markets
- Prevent over-trading and position limit breaches
- Real-time risk management with automated alerts
- Better portfolio tracking and analytics
- Consistent application of backtested strategies

---

## Current System Analysis

### 7 AM Signal Generation System

**File**: `lib/scanner/scanner.js`
**Function**: `runHighConvictionScan()`

#### Current Workflow
1. **Scan Trigger**: Cron job at 7 AM UK time (weekdays only)
2. **Stock Universe**: 2000+ stocks from comprehensive stock list
   - India: Nifty 50, Nifty Next 50, Nifty Midcap 150
   - UK: FTSE 100, FTSE 250
   - US: S&P 500 stocks
3. **Signal Detection**: Uses `BacktestCalculator.checkForOpportunity()`
   - DTI < 0 (oversold)
   - DTI trending upward
   - 7-day DTI trending upward
4. **Filter Criteria**:
   - Win rate > 75% (high conviction)
   - Signal date within last 2 trading days
   - Minimum 5 historical trades
5. **Output**: Telegram broadcast to subscribers

#### Current Limitations
- ❌ Signals not stored in database
- ❌ No integration with trades page
- ❌ No capital tracking
- ❌ No position limit enforcement
- ❌ No duplicate detection
- ❌ No exit monitoring
- ❌ Manual trade entry required

### Portfolio Backtesting System

**File**: `public/js/portfolio-simulator.js`
**Function**: `runSimulation()`

#### Current Capabilities
- **Position Limits**: 30 total (10 per market)
- **Trade Sizing**:
  - India: ₹50,000 per trade
  - UK: £400 per trade
  - US: $500 per trade
- **Capital Tracking**: Tracks initial capital + realized P/L per market
- **Dynamic Sizing**: Trade size grows with profits, shrinks with losses
- **Exit Conditions**:
  - Target: 8% profit
  - Stop Loss: 5% loss
  - Max Holding: 30 days
  - 7-Day DTI Exit: When 7-day DTI crosses below 0

#### Key Logic to Reuse
```javascript
// Capital calculation per market
function calculateDynamicTradeSize(portfolio, market) {
    const marketCap = portfolio.capitalByMarket[market];
    const totalCapital = marketCap.initial + marketCap.realized;
    const dynamicSize = totalCapital / CONFIG.MAX_POSITIONS_PER_MARKET;
    const minSize = CONFIG.TRADE_SIZES[market].amount * 0.1;
    return Math.max(dynamicSize, minSize);
}

// Position validation
function canEnterPosition(portfolio, market) {
    if (portfolio.positions.length >= CONFIG.MAX_POSITIONS_TOTAL) return false;
    const positionCounts = countPositionsByMarket(portfolio.positions);
    if (positionCounts[market] >= CONFIG.MAX_POSITIONS_PER_MARKET) return false;
    return true;
}
```

### Trades Page System

**File**: `public/trades.html`
**Core Module**: `public/js/trade-core.js`

#### Current Features
- Manual trade entry with form
- Active trades display
- Closed trades history
- Real-time price updates (5s interval)
- Close trade dialog
- Edit trade capabilities
- Export trade history

#### Current Limitations
- ❌ No capital tracking UI
- ❌ No position limit display
- ❌ No automated signal integration
- ❌ No market-based filtering
- ❌ No win rate display
- ❌ No automated exit monitoring

### Telegram Alert System

**File**: `lib/telegram/telegram-bot.js`

#### Current Alert Types
- `buy_signal`: Entry signals
- `sell_signal`: Exit signals
- `target_reached`: Profit target hit
- `stop_loss`: Stop loss hit
- `time_exit`: Time-based exit
- `market_open`: Market opening
- `market_close`: Market closing

#### Subscription Management
- Subscription types: 'all', 'conviction', 'scans'
- Deep linking: `/start conviction`, `/start scans`
- Commands: `/status`, `/change`, `/stop`

#### Current Broadcast Logic
```javascript
async function broadcastToSubscribers(alert, subscriptionType = null) {
    const subscribers = await TradeDB.getAllActiveSubscribers(subscriptionType);
    // Batch processing with rate limiting (30 per batch)
    // 1 second delay between batches
}
```

---

## Project Objectives

### Primary Goals
1. **Automate Signal Integration**: Display 7 AM signals on trades page for one-click addition
2. **Implement Capital Tracking**: Track and enforce capital limits per market
3. **Add Position Management**: Prevent over-trading with position limit enforcement
4. **Create Exit Monitoring**: Automatically detect and alert on exit conditions
5. **Enhance Telegram Alerts**: Send notifications for all trade lifecycle events
6. **Prevent Duplicates**: Ensure signals are not duplicated across days

### Success Metrics
- 90% reduction in manual trade entry time
- 100% capital tracking accuracy
- Zero position limit breaches
- <1 minute latency for exit detection
- 95%+ Telegram delivery rate
- Zero duplicate signals in production

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     7 AM CRON JOB (scanner.js)                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │ Scan 2000+ │→ │   Filter   │→ │   Store    │                 │
│  │   Stocks   │  │ High Conv. │  │  Signals   │                 │
│  └────────────┘  └────────────┘  └────────────┘                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                  DATABASE (PostgreSQL/SQLite)                    │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │ pending_signals│  │ portfolio_     │  │  trades          │  │
│  │ (with dedup)   │  │ capital        │  │  (active/closed) │  │
│  └────────────────┘  └────────────────┘  └──────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                   TRADES PAGE (trades.html)                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  📊 Capital Overview                                        │ │
│  │  India: ₹450K (5/10) | UK: £8.4K (3/10) | US: $12.5K (4/10)│ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  📈 7 AM Signals (3 new)                       [Collapse ▼]│ │
│  │  • RELIANCE.NS | ₹2,450 | Win: 82% | [Add] [Dismiss]      │ │
│  │  • LLOY.L      | £45.20  | Win: 78% | [Add] [Dismiss]      │ │
│  │  • AAPL        | $178.50 | Win: 85% | [Add] [Dismiss]      │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  🎯 Active Positions (12)                                   │ │
│  │  [Trade cards with real-time P/L and exit monitoring]      │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              EXIT MONITORING (exit-monitor.js)                   │
│  Cron: Every 5 minutes during market hours                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Fetch    │→ │  Check   │→ │ Trigger  │→ │ Update   │       │
│  │ Prices   │  │  Exits   │  │ Alerts   │  │ Database │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              TELEGRAM BOT (telegram-bot.js)                      │
│  📱 Alerts: Entry | Target | Stop Loss | Manual Exit             │
│  👥 Subscribers: 'all' | 'conviction' | 'scans'                  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Diagram

```
7 AM Scan → Signals DB → Trades Page → User Action → Trade DB → Exit Monitor → Telegram
     ↓                        ↓             ↓            ↓              ↓           ↓
  Filter by             Display with   Validate     Update         Check       Send Alert
  Win Rate >75%         Capital Info   Capital      Capital        Exits       to Users
  Recent (2 days)       Show Limits    & Limits     Allocated      Every 5min
  Dedup Check
```

---

## Duplicate Signal Prevention

### Problem Statement
When a signal is generated on Monday for a stock (e.g., RELIANCE.NS at ₹2,450), the same signal might be generated again on Tuesday if the entry conditions still hold. This creates duplicate signals that can lead to:
- Confusion for users
- Multiple entries in the same stock
- Violation of position limits
- Poor capital allocation

### Solution: Multi-Layer Duplicate Prevention

#### Layer 1: Database Constraint

**Table**: `pending_signals`

```sql
CREATE TABLE pending_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    signal_date DATE NOT NULL,
    entry_price REAL NOT NULL,
    target_price REAL NOT NULL,
    stop_loss REAL NOT NULL,
    square_off_date DATE NOT NULL,
    market TEXT NOT NULL,
    win_rate REAL NOT NULL,
    historical_signal_count INTEGER NOT NULL,
    entry_dti REAL,
    entry_7day_dti REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending',  -- 'pending', 'added', 'dismissed', 'expired'

    -- DUPLICATE PREVENTION: Unique constraint on symbol + signal_date
    UNIQUE(symbol, signal_date)
);

-- Index for fast lookups
CREATE INDEX idx_pending_signals_status ON pending_signals(status);
CREATE INDEX idx_pending_signals_created ON pending_signals(created_at);
```

#### Layer 2: Scanner Deduplication Logic

**File**: `lib/scanner/scanner.js` (enhancement)

```javascript
async function storeSignalsWithDeduplication(signals) {
    const stored = [];
    const duplicates = [];

    for (const signal of signals) {
        try {
            // Check if signal already exists for this symbol + date
            const existing = await TradeDB.getPendingSignal(
                signal.symbol,
                signal.signalDate
            );

            if (existing) {
                // Signal already exists
                duplicates.push({
                    symbol: signal.symbol,
                    reason: 'Signal already generated on ' + existing.created_at,
                    existingId: existing.id
                });
                continue;
            }

            // Check if signal is too old (>2 trading days)
            if (!isWithinTradingDays(signal.signalDate, 2)) {
                duplicates.push({
                    symbol: signal.symbol,
                    reason: 'Signal older than 2 trading days',
                    date: signal.signalDate
                });
                continue;
            }

            // Check if user already has an active position in this stock
            const activePosition = await TradeDB.getActiveTradeBySymbol(signal.symbol);
            if (activePosition) {
                duplicates.push({
                    symbol: signal.symbol,
                    reason: 'Already have active position',
                    tradeId: activePosition.id
                });
                continue;
            }

            // Signal is unique - store it
            const signalId = await TradeDB.storePendingSignal(signal);
            stored.push({ ...signal, id: signalId });

        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT') {
                // Duplicate constraint violation - expected for duplicates
                duplicates.push({
                    symbol: signal.symbol,
                    reason: 'Database constraint: duplicate signal'
                });
            } else {
                console.error('Error storing signal:', error);
            }
        }
    }

    console.log(`✅ Stored ${stored.length} new signals`);
    console.log(`⚠️ Skipped ${duplicates.length} duplicates`);

    return { stored, duplicates };
}
```

#### Layer 3: Automatic Expiration

**Cron Job**: Daily at 5 AM UK time (before 7 AM scan)

```javascript
// Clean up old signals automatically
async function expireOldSignals() {
    console.log('🧹 Cleaning up expired signals...');

    // Get all pending signals older than 2 trading days
    const allSignals = await TradeDB.getPendingSignals('pending');
    let expired = 0;

    for (const signal of allSignals) {
        if (!isWithinTradingDays(signal.signal_date, 2)) {
            await TradeDB.updateSignalStatus(signal.id, 'expired');
            expired++;
        }
    }

    console.log(`✅ Expired ${expired} old signals`);
    return expired;
}

// Schedule at 5 AM UK time (before 7 AM scan)
cron.schedule('0 5 * * 1-5', expireOldSignals, {
    timezone: "Europe/London"
});
```

#### Layer 4: UI Indicators

**Frontend**: Show signal status clearly

```javascript
function renderSignalCard(signal) {
    // Check if user already has active position
    const hasActivePosition = activeTrades.some(t => t.symbol === signal.symbol);

    // Calculate signal age
    const signalAge = calculateTradingDaysAge(signal.signal_date);

    const card = `
        <div class="signal-card ${hasActivePosition ? 'has-position' : ''}">
            <div class="signal-header">
                <h4>${signal.symbol}</h4>
                <span class="signal-age">${signalAge === 0 ? 'Today' : signalAge + 'd ago'}</span>
            </div>

            ${hasActivePosition ?
                '<div class="warning-badge">⚠️ Already have position in this stock</div>' :
                ''
            }

            <div class="signal-actions">
                <button class="btn-add"
                        ${hasActivePosition ? 'disabled title="Already have position"' : ''}
                        onclick="addSignalToPortfolio(${signal.id})">
                    Add to Portfolio
                </button>
                <button class="btn-dismiss" onclick="dismissSignal(${signal.id})">
                    Dismiss
                </button>
            </div>
        </div>
    `;

    return card;
}
```

#### Layer 5: Grace Period Logic

**Rationale**: Allow signals from Friday to be valid on Monday

```javascript
function isWithinTradingDays(signalDate, maxDays = 2, currentDate = new Date()) {
    const signal = new Date(signalDate);
    const today = new Date(currentDate);

    // Reset time to start of day
    signal.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    // Signal must be before or equal to today
    if (signal > today) return false;

    // Count trading days between signal and today (excluding weekends)
    let tradingDays = 0;
    let tempDate = new Date(today);

    while (tempDate >= signal && tradingDays <= maxDays) {
        const dayOfWeek = tempDate.getDay();

        // Count if it's a weekday (Mon-Fri)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            tradingDays++;
        }

        // Check if we've reached the signal date
        if (tempDate.getTime() === signal.getTime()) {
            return tradingDays <= maxDays;
        }

        // Go back one day
        tempDate.setDate(tempDate.getDate() - 1);
    }

    return false;
}

// Examples:
// Friday signal → Monday check: isWithinTradingDays('2025-01-10', 2, '2025-01-13') = true (2 trading days)
// Thursday signal → Monday check: isWithinTradingDays('2025-01-09', 2, '2025-01-13') = false (3 trading days)
```

### Duplicate Prevention Summary

| Layer | Method | Purpose |
|-------|--------|---------|
| 1. Database | UNIQUE constraint | Prevent duplicate inserts at DB level |
| 2. Scanner | Pre-check before insert | Fast rejection of duplicates |
| 3. Expiration | Daily cleanup cron | Remove stale signals automatically |
| 4. UI | Visual indicators | Show users existing positions |
| 5. Grace Period | Trading day logic | Handle weekends correctly |

---

## Phase 1: Database & API Foundation

### Duration: Week 1 (5 days)
### Dependencies: None
### Status: Not Started

### 1.1 Database Schema Changes

#### Table 1: `pending_signals`

**Purpose**: Store signals from 7 AM scan before they're added to trades

```sql
CREATE TABLE IF NOT EXISTS pending_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    signal_date DATE NOT NULL,
    entry_price REAL NOT NULL,
    target_price REAL NOT NULL,
    stop_loss REAL NOT NULL,
    square_off_date DATE NOT NULL,
    market TEXT NOT NULL CHECK(market IN ('India', 'UK', 'US')),
    win_rate REAL NOT NULL CHECK(win_rate >= 0 AND win_rate <= 100),
    historical_signal_count INTEGER NOT NULL CHECK(historical_signal_count >= 0),
    entry_dti REAL,
    entry_7day_dti REAL,
    prev_dti REAL,
    prev_7day_dti REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'added', 'dismissed', 'expired')),
    dismissed_at TIMESTAMP,
    added_to_trade_id INTEGER,

    -- Duplicate prevention
    UNIQUE(symbol, signal_date),

    -- Foreign key (if added to trades)
    FOREIGN KEY (added_to_trade_id) REFERENCES trades(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pending_signals_status
    ON pending_signals(status);

CREATE INDEX IF NOT EXISTS idx_pending_signals_date
    ON pending_signals(signal_date DESC);

CREATE INDEX IF NOT EXISTS idx_pending_signals_symbol
    ON pending_signals(symbol);
```

#### Table 2: `portfolio_capital`

**Purpose**: Track available capital and positions per market

```sql
CREATE TABLE IF NOT EXISTS portfolio_capital (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,  -- For multi-user support (future)
    market TEXT NOT NULL CHECK(market IN ('India', 'UK', 'US')),
    currency TEXT NOT NULL CHECK(currency IN ('INR', 'GBP', 'USD')),

    -- Capital tracking
    initial_capital REAL NOT NULL CHECK(initial_capital >= 0),
    realized_pl REAL DEFAULT 0,  -- Cumulative P/L from closed trades
    allocated_capital REAL DEFAULT 0,  -- Currently allocated to open positions
    available_capital REAL DEFAULT 0,  -- initial + realized - allocated

    -- Position tracking
    active_positions INTEGER DEFAULT 0 CHECK(active_positions >= 0),
    max_positions INTEGER DEFAULT 10 CHECK(max_positions > 0),

    -- Metadata
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure one row per market per user
    UNIQUE(user_id, market)
);

-- Default capital for single user
INSERT OR IGNORE INTO portfolio_capital (user_id, market, currency, initial_capital, available_capital) VALUES
    (NULL, 'India', 'INR', 1000000, 1000000),  -- 10 lakhs
    (NULL, 'UK', 'GBP', 10000, 10000),         -- 10k pounds
    (NULL, 'US', 'USD', 15000, 15000);         -- 15k dollars

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_portfolio_capital_market
    ON portfolio_capital(market);
```

#### Table 3: Enhance `trades` table

**Purpose**: Add fields for signal tracking and market classification

```sql
-- Add new columns to existing trades table
ALTER TABLE trades ADD COLUMN win_rate REAL;
ALTER TABLE trades ADD COLUMN historical_signal_count INTEGER;
ALTER TABLE trades ADD COLUMN signal_date DATE;
ALTER TABLE trades ADD COLUMN market TEXT CHECK(market IN ('India', 'UK', 'US'));
ALTER TABLE trades ADD COLUMN auto_added INTEGER DEFAULT 0;  -- Boolean: 1 = from 7AM scan
ALTER TABLE trades ADD COLUMN trade_size REAL;  -- Amount allocated in local currency
ALTER TABLE trades ADD COLUMN prev_dti REAL;
ALTER TABLE trades ADD COLUMN entry_dti REAL;
ALTER TABLE trades ADD COLUMN prev_7day_dti REAL;
ALTER TABLE trades ADD COLUMN entry_7day_dti REAL;

-- Add index for market filtering
CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market);
CREATE INDEX IF NOT EXISTS idx_trades_signal_date ON trades(signal_date);
```

#### Table 4: `trade_exit_checks`

**Purpose**: Track exit condition checks and prevent duplicate alerts

```sql
CREATE TABLE IF NOT EXISTS trade_exit_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_id INTEGER NOT NULL,
    check_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    current_price REAL NOT NULL,
    pl_percent REAL NOT NULL,
    days_held INTEGER NOT NULL,

    -- Exit condition checks
    target_reached INTEGER DEFAULT 0,
    stop_loss_hit INTEGER DEFAULT 0,
    max_days_reached INTEGER DEFAULT 0,
    dti_exit_triggered INTEGER DEFAULT 0,

    -- Alert tracking
    alert_sent INTEGER DEFAULT 0,
    alert_type TEXT,

    FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_exit_checks_trade
    ON trade_exit_checks(trade_id, check_time DESC);
```

### 1.2 API Endpoints

#### Endpoint 1: Initialize Portfolio Capital

**Method**: `POST /api/portfolio/initialize-capital`

**Purpose**: Set or update initial capital for each market

**Request Body**:
```json
{
    "india": 1000000,
    "uk": 10000,
    "us": 15000
}
```

**Response**:
```json
{
    "success": true,
    "capital": {
        "India": {
            "currency": "INR",
            "initial": 1000000,
            "realized": 0,
            "allocated": 0,
            "available": 1000000,
            "positions": 0,
            "maxPositions": 10
        },
        "UK": {
            "currency": "GBP",
            "initial": 10000,
            "realized": 0,
            "allocated": 0,
            "available": 10000,
            "positions": 0,
            "maxPositions": 10
        },
        "US": {
            "currency": "USD",
            "initial": 15000,
            "realized": 0,
            "allocated": 0,
            "available": 15000,
            "positions": 0,
            "maxPositions": 10
        }
    }
}
```

**Implementation** (`server.js`):
```javascript
app.post('/api/portfolio/initialize-capital', requireAuth, async (req, res) => {
    try {
        const { india, uk, us } = req.body;

        // Validate inputs
        if (!india || !uk || !us || india < 0 || uk < 0 || us < 0) {
            return res.status(400).json({ error: 'Invalid capital amounts' });
        }

        // Update capital for each market
        await TradeDB.updatePortfolioCapital('India', 'INR', india);
        await TradeDB.updatePortfolioCapital('UK', 'GBP', uk);
        await TradeDB.updatePortfolioCapital('US', 'USD', us);

        // Get updated capital status
        const capital = await TradeDB.getPortfolioCapital();

        res.json({ success: true, capital });
    } catch (error) {
        console.error('Error initializing capital:', error);
        res.status(500).json({ error: error.message });
    }
});
```

#### Endpoint 2: Get Portfolio Capital Status

**Method**: `GET /api/portfolio/capital`

**Purpose**: Retrieve current capital status for all markets

**Response**:
```json
{
    "success": true,
    "capital": {
        "India": {
            "currency": "INR",
            "initial": 1000000,
            "realized": 15000,
            "allocated": 250000,
            "available": 765000,
            "positions": 5,
            "maxPositions": 10
        },
        "UK": {
            "currency": "GBP",
            "initial": 10000,
            "realized": -200,
            "allocated": 1600,
            "available": 8200,
            "positions": 4,
            "maxPositions": 10
        },
        "US": {
            "currency": "USD",
            "initial": 15000,
            "realized": 1200,
            "allocated": 2500,
            "available": 13700,
            "positions": 5,
            "maxPositions": 10
        }
    },
    "totals": {
        "totalPositions": 14,
        "maxTotalPositions": 30,
        "utilizationPercent": 46.7
    }
}
```

#### Endpoint 3: Store Signals from Scan

**Method**: `POST /api/signals/from-scan`

**Purpose**: Store signals generated by 7 AM scan (called by scanner.js)

**Request Body**:
```json
{
    "signals": [
        {
            "symbol": "RELIANCE.NS",
            "signalDate": "2025-01-15",
            "entryPrice": 2450.50,
            "targetPrice": 2646.54,
            "stopLoss": 2327.98,
            "squareOffDate": "2025-02-14",
            "market": "India",
            "winRate": 82.5,
            "historicalSignalCount": 45,
            "entryDTI": -35.2,
            "entry7DayDTI": 15.8
        }
    ]
}
```

**Response**:
```json
{
    "success": true,
    "stored": 12,
    "duplicates": 3,
    "details": {
        "storedSignals": [
            { "id": 1, "symbol": "RELIANCE.NS" }
        ],
        "duplicateSignals": [
            { "symbol": "TCS.NS", "reason": "Signal already exists for today" }
        ]
    }
}
```

#### Endpoint 4: Get Pending Signals

**Method**: `GET /api/signals/pending`

**Purpose**: Retrieve signals that haven't been added to trades yet

**Query Parameters**:
- `market` (optional): Filter by market ('India', 'UK', 'US')
- `status` (optional): Filter by status ('pending', 'added', 'dismissed', 'expired')

**Response**:
```json
{
    "success": true,
    "signals": [
        {
            "id": 1,
            "symbol": "RELIANCE.NS",
            "signalDate": "2025-01-15",
            "entryPrice": 2450.50,
            "targetPrice": 2646.54,
            "stopLoss": 2327.98,
            "squareOffDate": "2025-02-14",
            "market": "India",
            "winRate": 82.5,
            "historicalSignalCount": 45,
            "status": "pending",
            "createdAt": "2025-01-15T07:02:15Z",
            "ageInTradingDays": 0,
            "canAdd": true,
            "canAddReason": null
        }
    ],
    "count": 12
}
```

#### Endpoint 5: Add Signal to Portfolio

**Method**: `POST /api/signals/add-to-portfolio/:signalId`

**Purpose**: Convert a pending signal into an active trade

**Request Body**:
```json
{
    "notes": "Optional custom notes"
}
```

**Response (Success)**:
```json
{
    "success": true,
    "trade": {
        "id": 123,
        "symbol": "RELIANCE.NS",
        "entryDate": "2025-01-15",
        "entryPrice": 2450.50,
        "market": "India",
        "tradeSize": 50000,
        "autoAdded": true
    },
    "capital": {
        "market": "India",
        "availableBefore": 765000,
        "allocated": 50000,
        "availableAfter": 715000,
        "positions": 6
    }
}
```

**Response (Failure - Insufficient Capital)**:
```json
{
    "success": false,
    "error": "Insufficient capital",
    "details": {
        "required": 50000,
        "available": 30000,
        "market": "India"
    }
}
```

**Response (Failure - Position Limit)**:
```json
{
    "success": false,
    "error": "Position limit reached",
    "details": {
        "currentPositions": 10,
        "maxPositions": 10,
        "market": "India"
    }
}
```

#### Endpoint 6: Dismiss Signal

**Method**: `POST /api/signals/dismiss/:signalId`

**Purpose**: Mark a signal as dismissed (user not interested)

**Response**:
```json
{
    "success": true,
    "signalId": 1,
    "status": "dismissed"
}
```

#### Endpoint 7: Check Exit Conditions

**Method**: `POST /api/portfolio/check-exits`

**Purpose**: Check all active trades for exit conditions (called by cron)

**Response**:
```json
{
    "success": true,
    "checked": 14,
    "exitsTriggered": 2,
    "exits": [
        {
            "tradeId": 101,
            "symbol": "AAPL",
            "exitType": "target_reached",
            "entryPrice": 175.50,
            "exitPrice": 189.54,
            "plPercent": 8.0,
            "alertSent": true
        },
        {
            "tradeId": 102,
            "symbol": "LLOY.L",
            "exitType": "stop_loss",
            "entryPrice": 45.20,
            "exitPrice": 42.94,
            "plPercent": -5.0,
            "alertSent": true
        }
    ]
}
```

### 1.3 Database Helper Functions

**File**: `database-postgres.js` (or create new `database-signals.js`)

```javascript
class TradeDB {
    // ... existing methods ...

    /**
     * Store a pending signal
     */
    async storePendingSignal(signal) {
        const query = `
            INSERT INTO pending_signals
            (symbol, signal_date, entry_price, target_price, stop_loss,
             square_off_date, market, win_rate, historical_signal_count,
             entry_dti, entry_7day_dti, prev_dti, prev_7day_dti)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await this.run(query, [
            signal.symbol,
            signal.signalDate,
            signal.entryPrice,
            signal.targetPrice,
            signal.stopLoss,
            signal.squareOffDate,
            signal.market,
            signal.winRate,
            signal.historicalSignalCount,
            signal.entryDTI,
            signal.entry7DayDTI,
            signal.prevDTI,
            signal.prev7DayDTI
        ]);

        return result.lastID;
    }

    /**
     * Check if signal already exists
     */
    async getPendingSignal(symbol, signalDate) {
        const query = `
            SELECT * FROM pending_signals
            WHERE symbol = ? AND signal_date = ?
        `;
        return await this.get(query, [symbol, signalDate]);
    }

    /**
     * Get all pending signals
     */
    async getPendingSignals(status = 'pending', market = null) {
        let query = `
            SELECT * FROM pending_signals
            WHERE status = ?
        `;
        const params = [status];

        if (market) {
            query += ' AND market = ?';
            params.push(market);
        }

        query += ' ORDER BY signal_date DESC, win_rate DESC';

        return await this.all(query, params);
    }

    /**
     * Update signal status
     */
    async updateSignalStatus(signalId, status, tradeId = null) {
        const query = `
            UPDATE pending_signals
            SET status = ?,
                dismissed_at = CASE WHEN ? = 'dismissed' THEN CURRENT_TIMESTAMP ELSE dismissed_at END,
                added_to_trade_id = COALESCE(?, added_to_trade_id)
            WHERE id = ?
        `;

        return await this.run(query, [status, status, tradeId, signalId]);
    }

    /**
     * Get portfolio capital
     */
    async getPortfolioCapital(market = null) {
        let query = 'SELECT * FROM portfolio_capital';
        const params = [];

        if (market) {
            query += ' WHERE market = ?';
            params.push(market);
        }

        const rows = await this.all(query, params);

        // Format as object keyed by market
        const capital = {};
        for (const row of rows) {
            capital[row.market] = {
                currency: row.currency,
                initial: row.initial_capital,
                realized: row.realized_pl,
                allocated: row.allocated_capital,
                available: row.available_capital,
                positions: row.active_positions,
                maxPositions: row.max_positions
            };
        }

        return capital;
    }

    /**
     * Update portfolio capital
     */
    async updatePortfolioCapital(market, currency, initialCapital) {
        const query = `
            INSERT INTO portfolio_capital (market, currency, initial_capital, available_capital)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(market) DO UPDATE SET
                initial_capital = ?,
                available_capital = initial_capital + realized_pl - allocated_capital,
                updated_at = CURRENT_TIMESTAMP
        `;

        return await this.run(query, [
            market, currency, initialCapital, initialCapital,
            initialCapital
        ]);
    }

    /**
     * Allocate capital for new trade
     */
    async allocateCapital(market, amount) {
        const query = `
            UPDATE portfolio_capital
            SET allocated_capital = allocated_capital + ?,
                available_capital = initial_capital + realized_pl - (allocated_capital + ?),
                active_positions = active_positions + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE market = ?
        `;

        return await this.run(query, [amount, amount, market]);
    }

    /**
     * Release capital when trade closes
     */
    async releaseCapital(market, allocatedAmount, plAmount) {
        const query = `
            UPDATE portfolio_capital
            SET allocated_capital = allocated_capital - ?,
                realized_pl = realized_pl + ?,
                available_capital = initial_capital + (realized_pl + ?) - (allocated_capital - ?),
                active_positions = active_positions - 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE market = ?
        `;

        return await this.run(query, [
            allocatedAmount, plAmount, plAmount, allocatedAmount, market
        ]);
    }

    /**
     * Check if can add position
     */
    async canAddPosition(market, requiredCapital) {
        const capital = await this.getPortfolioCapital(market);
        const marketCap = capital[market];

        if (!marketCap) {
            return { canAdd: false, reason: 'Market not found' };
        }

        // Check position limit for market
        if (marketCap.positions >= marketCap.maxPositions) {
            return {
                canAdd: false,
                reason: `Market limit reached (${marketCap.positions}/${marketCap.maxPositions})`
            };
        }

        // Check total position limit
        const totalPositions = Object.values(capital).reduce((sum, m) => sum + m.positions, 0);
        if (totalPositions >= 30) {
            return {
                canAdd: false,
                reason: `Total portfolio limit reached (${totalPositions}/30)`
            };
        }

        // Check capital availability
        if (marketCap.available < requiredCapital) {
            return {
                canAdd: false,
                reason: `Insufficient capital (need ${requiredCapital}, have ${marketCap.available})`
            };
        }

        return { canAdd: true };
    }
}
```

### 1.4 Migration Script

**File**: `migrations/001_trading_signals_integration.sql`

```sql
-- Migration: Trading Signals Integration
-- Version: 1.0
-- Date: 2025-01-15

BEGIN TRANSACTION;

-- Create pending_signals table
CREATE TABLE IF NOT EXISTS pending_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    signal_date DATE NOT NULL,
    entry_price REAL NOT NULL,
    target_price REAL NOT NULL,
    stop_loss REAL NOT NULL,
    square_off_date DATE NOT NULL,
    market TEXT NOT NULL CHECK(market IN ('India', 'UK', 'US')),
    win_rate REAL NOT NULL CHECK(win_rate >= 0 AND win_rate <= 100),
    historical_signal_count INTEGER NOT NULL CHECK(historical_signal_count >= 0),
    entry_dti REAL,
    entry_7day_dti REAL,
    prev_dti REAL,
    prev_7day_dti REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'added', 'dismissed', 'expired')),
    dismissed_at TIMESTAMP,
    added_to_trade_id INTEGER,
    UNIQUE(symbol, signal_date),
    FOREIGN KEY (added_to_trade_id) REFERENCES trades(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pending_signals_status ON pending_signals(status);
CREATE INDEX IF NOT EXISTS idx_pending_signals_date ON pending_signals(signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_pending_signals_symbol ON pending_signals(symbol);

-- Create portfolio_capital table
CREATE TABLE IF NOT EXISTS portfolio_capital (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    market TEXT NOT NULL CHECK(market IN ('India', 'UK', 'US')),
    currency TEXT NOT NULL CHECK(currency IN ('INR', 'GBP', 'USD')),
    initial_capital REAL NOT NULL CHECK(initial_capital >= 0),
    realized_pl REAL DEFAULT 0,
    allocated_capital REAL DEFAULT 0,
    available_capital REAL DEFAULT 0,
    active_positions INTEGER DEFAULT 0 CHECK(active_positions >= 0),
    max_positions INTEGER DEFAULT 10 CHECK(max_positions > 0),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, market)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_capital_market ON portfolio_capital(market);

-- Initialize default capital
INSERT OR IGNORE INTO portfolio_capital (user_id, market, currency, initial_capital, available_capital) VALUES
    (NULL, 'India', 'INR', 1000000, 1000000),
    (NULL, 'UK', 'GBP', 10000, 10000),
    (NULL, 'US', 'USD', 15000, 15000);

-- Add new columns to trades table
ALTER TABLE trades ADD COLUMN IF NOT EXISTS win_rate REAL;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS historical_signal_count INTEGER;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS signal_date DATE;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS market TEXT CHECK(market IN ('India', 'UK', 'US'));
ALTER TABLE trades ADD COLUMN IF NOT EXISTS auto_added INTEGER DEFAULT 0;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS trade_size REAL;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS prev_dti REAL;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS entry_dti REAL;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS prev_7day_dti REAL;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS entry_7day_dti REAL;

CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market);
CREATE INDEX IF NOT EXISTS idx_trades_signal_date ON trades(signal_date);

-- Create trade_exit_checks table
CREATE TABLE IF NOT EXISTS trade_exit_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_id INTEGER NOT NULL,
    check_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    current_price REAL NOT NULL,
    pl_percent REAL NOT NULL,
    days_held INTEGER NOT NULL,
    target_reached INTEGER DEFAULT 0,
    stop_loss_hit INTEGER DEFAULT 0,
    max_days_reached INTEGER DEFAULT 0,
    dti_exit_triggered INTEGER DEFAULT 0,
    alert_sent INTEGER DEFAULT 0,
    alert_type TEXT,
    FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_exit_checks_trade ON trade_exit_checks(trade_id, check_time DESC);

COMMIT;
```

### Phase 1 Deliverables

- [ ] Database schema created and tested
- [ ] Migration script tested on dev environment
- [ ] All API endpoints implemented and tested
- [ ] Database helper functions implemented
- [ ] API documentation completed
- [ ] Postman collection created for testing
- [ ] Unit tests written for all database functions
- [ ] Integration tests written for all API endpoints

---

## Phase 2: Capital Tracking System

### Duration: Week 1-2 (3 days)
### Dependencies: Phase 1 complete
### Status: Not Started

### 2.1 Backend Capital Manager

**File**: `lib/portfolio/capital-manager.js`

```javascript
/**
 * Portfolio Capital Manager
 * Handles capital tracking, allocation, and validation
 */

const TradeDB = require('../../database-postgres');

class CapitalManager {
    constructor() {
        this.CONFIG = {
            TRADE_SIZES: {
                'India': { currency: 'INR', amount: 50000 },
                'UK': { currency: 'GBP', amount: 400 },
                'US': { currency: 'USD', amount: 500 }
            },
            MAX_POSITIONS_TOTAL: 30,
            MAX_POSITIONS_PER_MARKET: 10
        };
    }

    /**
     * Get current capital status for all markets
     */
    async getCapitalStatus() {
        const capital = await TradeDB.getPortfolioCapital();

        // Calculate totals
        const totalPositions = Object.values(capital)
            .reduce((sum, m) => sum + m.positions, 0);

        const utilizationPercent = (totalPositions / this.CONFIG.MAX_POSITIONS_TOTAL) * 100;

        return {
            capital,
            totals: {
                totalPositions,
                maxTotalPositions: this.CONFIG.MAX_POSITIONS_TOTAL,
                utilizationPercent: utilizationPercent.toFixed(1)
            }
        };
    }

    /**
     * Calculate dynamic trade size based on capital
     */
    calculateTradeSize(market, capital) {
        const marketCap = capital[market];
        if (!marketCap) return this.CONFIG.TRADE_SIZES[market].amount;

        // Dynamic sizing: divide available capital by max positions
        const totalCapital = marketCap.initial + marketCap.realized;
        const dynamicSize = totalCapital / this.CONFIG.MAX_POSITIONS_PER_MARKET;

        // Floor: don't go below 10% of standard size
        const minSize = this.CONFIG.TRADE_SIZES[market].amount * 0.1;

        return Math.max(dynamicSize, minSize);
    }

    /**
     * Validate if trade can be added
     */
    async validateTradeEntry(market, symbol) {
        // Get current capital status
        const capital = await TradeDB.getPortfolioCapital();
        const status = await this.getCapitalStatus();

        // Check 1: Total position limit
        if (status.totals.totalPositions >= this.CONFIG.MAX_POSITIONS_TOTAL) {
            return {
                valid: false,
                reason: `Total portfolio limit reached (${status.totals.totalPositions}/30)`,
                code: 'TOTAL_LIMIT'
            };
        }

        // Check 2: Market position limit
        const marketCap = capital[market];
        if (!marketCap) {
            return {
                valid: false,
                reason: `Market ${market} not found`,
                code: 'MARKET_NOT_FOUND'
            };
        }

        if (marketCap.positions >= this.CONFIG.MAX_POSITIONS_PER_MARKET) {
            return {
                valid: false,
                reason: `Market limit reached for ${market} (${marketCap.positions}/10)`,
                code: 'MARKET_LIMIT'
            };
        }

        // Check 3: Capital availability
        const requiredCapital = this.calculateTradeSize(market, capital);
        if (marketCap.available < requiredCapital) {
            return {
                valid: false,
                reason: `Insufficient capital in ${market} market`,
                details: {
                    required: requiredCapital,
                    available: marketCap.available,
                    shortfall: requiredCapital - marketCap.available
                },
                code: 'INSUFFICIENT_CAPITAL'
            };
        }

        // Check 4: Duplicate position check
        const existingTrade = await TradeDB.getActiveTradeBySymbol(symbol);
        if (existingTrade) {
            return {
                valid: false,
                reason: `Already have active position in ${symbol}`,
                code: 'DUPLICATE_POSITION',
                existingTradeId: existingTrade.id
            };
        }

        // All checks passed
        return {
            valid: true,
            tradeSize: requiredCapital,
            currency: marketCap.currency
        };
    }

    /**
     * Allocate capital for new trade
     */
    async allocateForTrade(market, symbol, entryPrice) {
        // Validate first
        const validation = await this.validateTradeEntry(market, symbol);
        if (!validation.valid) {
            throw new Error(validation.reason);
        }

        // Allocate capital
        await TradeDB.allocateCapital(market, validation.tradeSize);

        return {
            allocated: validation.tradeSize,
            currency: validation.currency,
            market: market
        };
    }

    /**
     * Release capital when trade closes
     */
    async releaseFromTrade(trade) {
        // Calculate P/L in local currency
        const plPercent = trade.profitLossPercent || 0;
        const plAmount = (trade.trade_size * plPercent) / 100;

        // Release capital back to market
        await TradeDB.releaseCapital(trade.market, trade.trade_size, plAmount);

        return {
            released: trade.trade_size,
            pl: plAmount,
            currency: trade.currency,
            market: trade.market
        };
    }

    /**
     * Get capital summary for display
     */
    async getCapitalSummary() {
        const status = await this.getCapitalStatus();
        const capital = status.capital;

        return {
            india: {
                currency: '₹',
                available: capital.India.available.toLocaleString('en-IN'),
                positions: capital.India.positions,
                maxPositions: capital.India.maxPositions,
                utilizationPercent: ((capital.India.positions / capital.India.maxPositions) * 100).toFixed(0)
            },
            uk: {
                currency: '£',
                available: capital.UK.available.toLocaleString('en-GB'),
                positions: capital.UK.positions,
                maxPositions: capital.UK.maxPositions,
                utilizationPercent: ((capital.UK.positions / capital.UK.maxPositions) * 100).toFixed(0)
            },
            us: {
                currency: '$',
                available: capital.US.available.toLocaleString('en-US'),
                positions: capital.US.positions,
                maxPositions: capital.US.maxPositions,
                utilizationPercent: ((capital.US.positions / capital.US.maxPositions) * 100).toFixed(0)
            },
            totals: status.totals
        };
    }

    /**
     * Get market from symbol
     */
    getMarketFromSymbol(symbol) {
        if (symbol.endsWith('.NS') || symbol.endsWith('.BO')) return 'India';
        if (symbol.endsWith('.L')) return 'UK';
        return 'US';
    }
}

module.exports = new CapitalManager();
```

### 2.2 Frontend Capital Display Component

**File**: `public/js/capital-display.js`

```javascript
/**
 * Capital Display Component
 * Shows portfolio capital status on trades page
 */

const CapitalDisplay = (function() {
    let capitalData = null;
    let refreshInterval = null;

    /**
     * Initialize capital display
     */
    async function init() {
        console.log('📊 Initializing capital display...');

        // Create capital display container
        createCapitalContainer();

        // Load initial data
        await refreshCapitalData();

        // Set up auto-refresh (every 30 seconds)
        refreshInterval = setInterval(refreshCapitalData, 30000);

        // Clean up on page unload
        window.addEventListener('beforeunload', () => {
            if (refreshInterval) clearInterval(refreshInterval);
        });
    }

    /**
     * Create capital display HTML
     */
    function createCapitalContainer() {
        // Find insertion point (before active trades section)
        const activeTradesCard = document.querySelector('.card:has(#active-trades-container)');
        if (!activeTradesCard) {
            console.error('Could not find active trades container');
            return;
        }

        // Create capital overview card
        const capitalCard = document.createElement('div');
        capitalCard.className = 'card capital-overview-card';
        capitalCard.innerHTML = `
            <h3 class="card-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23"></line>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
                Portfolio Capital
                <button class="btn-icon" id="refresh-capital-btn" title="Refresh capital">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                </button>
            </h3>

            <div class="capital-grid" id="capital-grid">
                <!-- Capital cards will be inserted here -->
            </div>

            <div class="capital-totals" id="capital-totals">
                <!-- Total positions info will be inserted here -->
            </div>
        `;

        // Insert before active trades
        activeTradesCard.parentNode.insertBefore(capitalCard, activeTradesCard);

        // Add event listener for refresh button
        document.getElementById('refresh-capital-btn').addEventListener('click', async (e) => {
            e.preventDefault();
            await refreshCapitalData();
        });
    }

    /**
     * Fetch capital data from API
     */
    async function refreshCapitalData() {
        try {
            const response = await fetch('/api/portfolio/capital');
            if (!response.ok) throw new Error('Failed to fetch capital data');

            const data = await response.json();
            capitalData = data;

            // Update display
            renderCapitalDisplay();

        } catch (error) {
            console.error('Error refreshing capital:', error);
            showNotification('Failed to refresh capital data', 'error');
        }
    }

    /**
     * Render capital display
     */
    function renderCapitalDisplay() {
        if (!capitalData) return;

        const { capital, totals } = capitalData;

        // Render market cards
        const gridHtml = `
            ${renderMarketCard('India', capital.India, '₹')}
            ${renderMarketCard('UK', capital.UK, '£')}
            ${renderMarketCard('US', capital.US, '$')}
        `;

        document.getElementById('capital-grid').innerHTML = gridHtml;

        // Render totals
        const utilizationClass = totals.utilizationPercent > 80 ? 'warning' : '';
        const totalsHtml = `
            <div class="capital-total-item">
                <span class="label">Total Positions:</span>
                <span class="value ${utilizationClass}">
                    ${totals.totalPositions}/${totals.maxTotalPositions}
                </span>
            </div>
            <div class="capital-total-item">
                <span class="label">Utilization:</span>
                <span class="value ${utilizationClass}">
                    ${totals.utilizationPercent}%
                </span>
            </div>
        `;

        document.getElementById('capital-totals').innerHTML = totalsHtml;
    }

    /**
     * Render individual market card
     */
    function renderMarketCard(marketName, marketData, currencySymbol) {
        const utilization = (marketData.positions / marketData.maxPositions) * 100;
        const utilizationClass = utilization > 80 ? 'warning' : utilization > 50 ? 'info' : 'success';

        // Calculate total capital
        const totalCapital = marketData.initial + marketData.realized;
        const plClass = marketData.realized >= 0 ? 'positive' : 'negative';
        const plSign = marketData.realized >= 0 ? '+' : '';

        return `
            <div class="capital-market-card">
                <div class="market-header">
                    <h4>${marketName}</h4>
                    <span class="market-flag">${getMarketFlag(marketName)}</span>
                </div>

                <div class="capital-info">
                    <div class="capital-row">
                        <span class="capital-label">Available:</span>
                        <span class="capital-value highlighted">
                            ${currencySymbol}${formatNumber(marketData.available)}
                        </span>
                    </div>

                    <div class="capital-row">
                        <span class="capital-label">Allocated:</span>
                        <span class="capital-value">
                            ${currencySymbol}${formatNumber(marketData.allocated)}
                        </span>
                    </div>

                    <div class="capital-row">
                        <span class="capital-label">Realized P/L:</span>
                        <span class="capital-value ${plClass}">
                            ${plSign}${currencySymbol}${formatNumber(Math.abs(marketData.realized))}
                        </span>
                    </div>

                    <div class="capital-row">
                        <span class="capital-label">Total Capital:</span>
                        <span class="capital-value">
                            ${currencySymbol}${formatNumber(totalCapital)}
                        </span>
                    </div>
                </div>

                <div class="positions-bar">
                    <div class="positions-label">
                        Positions: ${marketData.positions}/${marketData.maxPositions}
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${utilizationClass}"
                             style="width: ${utilization}%">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get market flag emoji
     */
    function getMarketFlag(market) {
        const flags = {
            'India': '🇮🇳',
            'UK': '🇬🇧',
            'US': '🇺🇸'
        };
        return flags[market] || '';
    }

    /**
     * Format number with commas
     */
    function formatNumber(num) {
        return Math.round(num).toLocaleString();
    }

    /**
     * Get current capital data (for other modules)
     */
    function getCapitalData() {
        return capitalData;
    }

    // Public API
    return {
        init,
        refreshCapitalData,
        getCapitalData
    };
})();

// Auto-initialize on trades page
if (document.getElementById('active-trades-container')) {
    document.addEventListener('DOMContentLoaded', () => {
        CapitalDisplay.init();
    });
}
```

### 2.3 CSS Styles for Capital Display

**File**: `public/css/main.css` (add to existing file)

```css
/* ========================================
   CAPITAL OVERVIEW STYLES
   ======================================== */

.capital-overview-card {
    margin-bottom: 2rem;
    border: 2px solid var(--border-color);
}

.capital-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
    margin-bottom: 1.5rem;
}

.capital-market-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.25rem;
    transition: all 0.3s ease;
}

.capital-market-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: var(--primary-color);
}

.market-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-color);
}

.market-header h4 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--text-primary);
}

.market-flag {
    font-size: 1.5rem;
}

.capital-info {
    margin-bottom: 1rem;
}

.capital-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
}

.capital-label {
    color: var(--text-secondary);
    font-size: 0.875rem;
}

.capital-value {
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--text-primary);
}

.capital-value.highlighted {
    color: var(--primary-color);
    font-size: 1.1rem;
}

.capital-value.positive {
    color: var(--success-color);
}

.capital-value.negative {
    color: var(--danger-color);
}

.positions-bar {
    margin-top: 1rem;
}

.positions-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
}

.progress-bar {
    width: 100%;
    height: 8px;
    background: var(--border-color);
    border-radius: 4px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    transition: width 0.3s ease, background-color 0.3s ease;
}

.progress-fill.success {
    background: linear-gradient(90deg, var(--success-color), var(--success-light));
}

.progress-fill.info {
    background: linear-gradient(90deg, var(--info-color), var(--info-light));
}

.progress-fill.warning {
    background: linear-gradient(90deg, var(--warning-color), var(--warning-light));
}

.capital-totals {
    display: flex;
    justify-content: space-around;
    align-items: center;
    padding: 1rem;
    background: var(--background-tertiary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
}

.capital-total-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
}

.capital-total-item .label {
    font-size: 0.875rem;
    color: var(--text-secondary);
}

.capital-total-item .value {
    font-size: 1.5rem;
    font-weight: 700;
    font-family: var(--font-mono);
    color: var(--text-primary);
}

.capital-total-item .value.warning {
    color: var(--warning-color);
}

.btn-icon {
    background: transparent;
    border: none;
    padding: 0.25rem;
    cursor: pointer;
    color: var(--text-secondary);
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
}

.btn-icon:hover {
    color: var(--primary-color);
    transform: rotate(180deg);
}

/* Responsive adjustments */
@media (max-width: 768px) {
    .capital-grid {
        grid-template-columns: 1fr;
    }

    .capital-totals {
        flex-direction: column;
        gap: 1rem;
    }
}
```

### 2.4 Integration with Trades Page

**File**: `public/trades.html` (add script tag)

```html
<!-- After existing trade scripts -->
<script src="js/capital-display.js"></script>
```

### Phase 2 Deliverables

- [x] Capital manager backend module implemented
- [x] Capital display frontend component implemented
- [x] CSS styles added to main.css
- [x] Integration with trades page complete
- [x] Capital tracking tested with sample data
- [x] Auto-refresh functionality working
- [x] Responsive design tested on mobile
- [x] Position limits enforced correctly

**Status:** ✅ COMPLETE

---

## Phase 3: Automated 1 PM Trade Execution

### Duration: Week 2 (5 days)
### Dependencies: Phase 1, Phase 2 complete
### Status: Not Started

### Overview

This phase implements **fully automated trade execution** at 1 PM in each market's respective timezone. Signals generated at 7 AM UK time are stored and then automatically executed at optimal market hours without any manual intervention.

**Execution Schedule:**
- 🇮🇳 **India Market**: 1:00 PM IST (7:30 AM UTC)
- 🇬🇧 **UK Market**: 1:00 PM GMT/BST (1:00 PM / 12:00 PM UTC)
- 🇺🇸 **US Market**: 1:00 PM EST/EDT (6:00 PM / 5:00 PM UTC)

**Benefits:**
- Consistent execution timing across all trades
- Post-lunch liquidity in each market
- No manual intervention required
- No slippage from delayed execution
- Fully automated end-to-end workflow

### 3.1 Scanner Enhancement (7 AM Signal Storage)

**File**: `lib/scanner/scanner.js` (modify existing)

Add signal storage after scan completes:

```javascript
async function runHighConvictionScan(chatId = null) {
    // ... existing scan logic ...

    try {
        // Step 1-4: Existing scan logic (unchanged)
        const allStocks = this.getComprehensiveStockList();
        const allCurrentOpportunities = await this.findCurrentOpportunities(allStocks);
        const highConvictionOpportunities = allCurrentOpportunities.filter(opp => {
            const winRate = opp.trade?.winRate || 0;
            return winRate > 75;
        });
        const recentOpportunities = highConvictionOpportunities.filter(opp => {
            const signalDate = opp.trade.signalDate || opp.trade.entryDate;
            const isRecent = BacktestCalculator.isWithinTradingDays(signalDate, 2);
            return isRecent;
        });

        // NEW Step 5: Store signals in database with deduplication
        const signalsToStore = recentOpportunities.map(opp => ({
            symbol: opp.stock.symbol,
            signalDate: opp.trade.signalDate || opp.trade.entryDate,
            entryPrice: opp.trade.entryPrice,
            targetPrice: opp.trade.entryPrice * 1.08, // 8% target
            stopLoss: opp.trade.entryPrice * 0.95, // 5% stop loss
            squareOffDate: this.calculateSquareOffDate(opp.trade.signalDate),
            market: this.getMarketFromSymbol(opp.stock.symbol),
            winRate: opp.trade.winRate,
            historicalSignalCount: opp.trade.totalTrades,
            entryDTI: opp.trade.entryDTI,
            entry7DayDTI: opp.trade.entry7DayDTI,
            prevDTI: opp.trade.prevDTI,
            prev7DayDTI: opp.trade.prev7DayDTI
        }));

        // Store signals with deduplication
        const storeResult = await this.storeSignalsWithDeduplication(signalsToStore);

        console.log(`✅ Stored ${storeResult.stored.length} new signals`);
        console.log(`⚠️ Skipped ${storeResult.duplicates.length} duplicates`);

        // Continue with existing Telegram broadcast...
        if (storeResult.stored.length > 0) {
            const message = this.formatHighConvictionMessage(
                storeResult.stored,
                highConvictionOpportunities.length
            );

            if (isBroadcast) {
                await broadcastToSubscribers({
                    type: 'custom',
                    message: `🌅 *7 AM Conviction Trades*\n\n${message}`
                }, 'conviction');
            }
        }

        return {
            success: true,
            opportunities: storeResult.stored,
            totalScanned: allStocks.length,
            highConvictionFound: highConvictionOpportunities.length,
            recentOpportunities: recentOpportunities.length,
            signalsStored: storeResult.stored.length,
            duplicatesSkipped: storeResult.duplicates.length
        };

    } catch (error) {
        console.error('❌ [SCAN ERROR]', error);
        return { error: error.message };
    }
}

/**
 * Store signals with comprehensive deduplication
 */
async function storeSignalsWithDeduplication(signals) {
    const stored = [];
    const duplicates = [];

    for (const signal of signals) {
        try {
            // Check 1: Database-level duplicate check
            const existing = await axios.get('/api/signals/check-duplicate', {
                params: {
                    symbol: signal.symbol,
                    signalDate: signal.signalDate
                }
            });

            if (existing.data.exists) {
                duplicates.push({
                    symbol: signal.symbol,
                    reason: 'Signal already exists in database',
                    existingId: existing.data.signalId
                });
                continue;
            }

            // Check 2: Age check (must be within 2 trading days)
            if (!BacktestCalculator.isWithinTradingDays(signal.signalDate, 2)) {
                duplicates.push({
                    symbol: signal.symbol,
                    reason: 'Signal older than 2 trading days',
                    date: signal.signalDate
                });
                continue;
            }

            // Check 3: Active position check
            const activeCheck = await axios.get('/api/trades/check-active', {
                params: { symbol: signal.symbol }
            });

            if (activeCheck.data.hasActivePosition) {
                duplicates.push({
                    symbol: signal.symbol,
                    reason: 'User already has active position',
                    tradeId: activeCheck.data.tradeId
                });
                continue;
            }

            // All checks passed - store signal
            const response = await axios.post('/api/signals/store', signal);
            stored.push({ ...signal, id: response.data.signalId });

        } catch (error) {
            if (error.response?.status === 409) {
                // Duplicate constraint violation
                duplicates.push({
                    symbol: signal.symbol,
                    reason: 'Database constraint: duplicate'
                });
            } else {
                console.error('Error storing signal:', error);
            }
        }
    }

    return { stored, duplicates };
}
```

### 3.2 Automated Trade Executor

**File**: `lib/scheduler/trade-executor.js` (NEW FILE)

This module handles the automated execution of pending signals at 1 PM in each market timezone.

```javascript
/**
 * Automated Trade Executor
 * Executes pending signals at 1 PM in each market timezone
 */

const TradeDB = require('../../database-postgres');
const CapitalManager = require('../portfolio/capital-manager');
const cron = require('node-cron');

class TradeExecutor {
    constructor() {
        this.isInitialized = false;
        this.executionLogs = [];
    }

    /**
     * Initialize cron jobs for each market
     */
    initialize() {
        if (this.isInitialized) {
            console.log('⚠️ Trade Executor already initialized');
            return;
        }

        // India Market: 1 PM IST = 7:30 AM UTC
        // Runs Monday-Friday at 1:00 PM IST
        cron.schedule('30 7 * * 1-5', async () => {
            console.log('🇮🇳 [INDIA] Starting 1 PM trade execution...');
            await this.executeMarketSignals('India');
        }, {
            timezone: "Asia/Kolkata"
        });

        // UK Market: 1 PM GMT/BST
        // Runs Monday-Friday at 1:00 PM UK time
        cron.schedule('0 13 * * 1-5', async () => {
            console.log('🇬🇧 [UK] Starting 1 PM trade execution...');
            await this.executeMarketSignals('UK');
        }, {
            timezone: "Europe/London"
        });

        // US Market: 1 PM EST/EDT
        // Runs Monday-Friday at 1:00 PM US Eastern time
        cron.schedule('0 13 * * 1-5', async () => {
            console.log('🇺🇸 [US] Starting 1 PM trade execution...');
            await this.executeMarketSignals('US');
        }, {
            timezone: "America/New_York"
        });

        this.isInitialized = true;
        console.log('✅ Trade Executor initialized with 3 cron jobs');
        console.log('   🇮🇳 India: 1:00 PM IST');
        console.log('   🇬🇧 UK: 1:00 PM GMT/BST');
        console.log('   🇺🇸 US: 1:00 PM EST/EDT');
    }

    /**
     * Execute all pending signals for a specific market
     */
    async executeMarketSignals(market) {
        const startTime = new Date();
        console.log(`\n📊 [${market}] Execution started at ${startTime.toISOString()}`);

        try {
            // Get today's date
            const today = new Date().toISOString().split('T')[0];

            // Get pending signals for this market from today only
            const signals = await TradeDB.getPendingSignals('pending', market);
            const todaySignals = signals.filter(s =>
                s.signal_date.toISOString().split('T')[0] === today
            );

            console.log(`   Found ${todaySignals.length} signals to execute`);

            if (todaySignals.length === 0) {
                console.log(`   ✓ No signals to execute for ${market}`);
                return {
                    success: true,
                    market,
                    executed: 0,
                    failed: 0,
                    skipped: 0
                };
            }

            const results = {
                executed: [],
                failed: [],
                skipped: []
            };

            // Execute each signal
            for (const signal of todaySignals) {
                try {
                    const result = await this.executeSingleSignal(signal, market);

                    if (result.success) {
                        results.executed.push(result);
                        console.log(`   ✓ ${signal.symbol}: Trade created (ID: ${result.tradeId})`);
                    } else {
                        if (result.reason.includes('limit') || result.reason.includes('capital')) {
                            results.skipped.push({ signal: signal.symbol, reason: result.reason });
                            console.log(`   ⊗ ${signal.symbol}: Skipped - ${result.reason}`);
                        } else {
                            results.failed.push({ signal: signal.symbol, error: result.reason });
                            console.log(`   ✗ ${signal.symbol}: Failed - ${result.reason}`);
                        }
                    }
                } catch (error) {
                    results.failed.push({ signal: signal.symbol, error: error.message });
                    console.log(`   ✗ ${signal.symbol}: Error - ${error.message}`);
                }
            }

            const summary = {
                success: true,
                market,
                total: todaySignals.length,
                executed: results.executed.length,
                failed: results.failed.length,
                skipped: results.skipped.length,
                duration: Date.now() - startTime.getTime()
            };

            console.log(`\n📈 [${market}] Execution Summary:`);
            console.log(`   Total Signals: ${summary.total}`);
            console.log(`   ✓ Executed: ${summary.executed}`);
            console.log(`   ⊗ Skipped: ${summary.skipped}`);
            console.log(`   ✗ Failed: ${summary.failed}`);
            console.log(`   Duration: ${summary.duration}ms\n`);

            // Send Telegram notification
            if (summary.executed > 0) {
                await this.sendExecutionNotification(market, summary, results);
            }

            return summary;

        } catch (error) {
            console.error(`❌ [${market}] Execution error:`, error);
            return {
                success: false,
                market,
                error: error.message
            };
        }
    }

    /**
     * Execute a single signal
     */
    async executeSingleSignal(signal, market) {
        try {
            const userId = 'default'; // Single user system

            // Step 1: Validate capital and position limits
            const validation = await CapitalManager.validateTradeEntry(market, signal.symbol);

            if (!validation.valid) {
                // Mark signal as skipped
                await TradeDB.updateSignalStatus(signal.id, 'dismissed');
                return {
                    success: false,
                    reason: validation.reason,
                    code: validation.code
                };
            }

            // Step 2: Allocate capital
            await TradeDB.allocateCapital(market, validation.tradeSize);

            // Step 3: Create trade
            const trade = {
                symbol: signal.symbol,
                entryDate: new Date(),
                entryPrice: signal.entry_price,
                targetPrice: signal.target_price,
                stopLossPercent: 5,
                status: 'active',
                notes: `Auto-executed at 1 PM ${market} time - Win Rate: ${signal.win_rate}%`,
                market: signal.market,
                tradeSize: validation.tradeSize,
                signalDate: signal.signal_date,
                winRate: signal.win_rate,
                historicalSignalCount: signal.historical_signal_count,
                autoAdded: true,
                entryDTI: signal.entry_dti,
                entry7DayDTI: signal.entry_7day_dti,
                prevDTI: signal.prev_dti,
                prev7DayDTI: signal.prev_7day_dti
            };

            const newTrade = await TradeDB.insertTrade(trade, userId);

            // Step 4: Update signal status
            await TradeDB.updateSignalStatus(signal.id, 'added', newTrade.id);

            return {
                success: true,
                tradeId: newTrade.id,
                symbol: signal.symbol,
                tradeSize: validation.tradeSize
            };

        } catch (error) {
            console.error(`Error executing signal ${signal.symbol}:`, error);
            return {
                success: false,
                reason: error.message
            };
        }
    }

    /**
     * Send Telegram notification about execution
     */
    async sendExecutionNotification(market, summary, results) {
        try {
            const telegramBot = require('../telegram/telegram-bot');

            if (!telegramBot || typeof telegramBot.broadcastToSubscribers !== 'function') {
                return; // Telegram not available
            }

            const flag = market === 'India' ? '🇮🇳' : market === 'UK' ? '🇬🇧' : '🇺🇸';

            let message = `${flag} *${market} Market - 1 PM Execution Complete*\n\n`;
            message += `📊 Executed: ${summary.executed} trades\n`;

            if (summary.executed > 0) {
                message += `\n*Trades Added:*\n`;
                results.executed.forEach(r => {
                    message += `✓ ${r.symbol}\n`;
                });
            }

            if (summary.skipped > 0) {
                message += `\n⊗ Skipped: ${summary.skipped} (capital/limits)\n`;
            }

            if (summary.failed > 0) {
                message += `\n✗ Failed: ${summary.failed} (errors)\n`;
            }

            await telegramBot.broadcastToSubscribers({
                type: 'custom',
                message
            }, 'execution');

        } catch (error) {
            console.error('Error sending Telegram notification:', error);
        }
    }

    /**
     * Manual execution trigger (for testing)
     */
    async manualExecute(market) {
        console.log(`🔧 Manual execution triggered for ${market}`);
        return await this.executeMarketSignals(market);
    }
}

module.exports = new TradeExecutor();
```

**Initialize in server.js:**

```javascript
// In server.js, add after scanner initialization
const tradeExecutor = require('./lib/scheduler/trade-executor');
tradeExecutor.initialize();
```

### 3.3 Signal Display Component (UI for Monitoring)

**File**: `public/js/signals-display.js`

```javascript
/**
 * 7 AM Signals Display Component
 * Shows pending signals on trades page
 */

const SignalsDisplay = (function() {
    let pendingSignals = [];
    let refreshInterval = null;

    /**
     * Initialize signals display
     */
    async function init() {
        console.log('📈 Initializing signals display...');

        // Create signals container
        createSignalsContainer();

        // Load pending signals
        await refreshSignals();

        // Set up auto-refresh (every 60 seconds)
        refreshInterval = setInterval(refreshSignals, 60000);

        // Clean up on page unload
        window.addEventListener('beforeunload', () => {
            if (refreshInterval) clearInterval(refreshInterval);
        });
    }

    /**
     * Create signals container HTML
     */
    function createSignalsContainer() {
        // Find insertion point (after capital overview, before active trades)
        const activeTradesCard = document.querySelector('.card:has(#active-trades-container)');
        if (!activeTradesCard) {
            console.error('Could not find active trades container');
            return;
        }

        // Create signals card
        const signalsCard = document.createElement('div');
        signalsCard.className = 'card signals-card';
        signalsCard.innerHTML = `
            <h3 class="card-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                    <line x1="9" y1="9" x2="9.01" y2="9"></line>
                    <line x1="15" y1="9" x2="15.01" y2="9"></line>
                </svg>
                📈 7 AM Signals
                <span class="signal-count" id="signal-count">0</span>
                <button class="btn-collapse" id="collapse-signals-btn" title="Collapse/Expand">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>
            </h3>

            <div class="signals-content" id="signals-content">
                <div class="signals-grid" id="signals-grid">
                    <!-- Signal cards will be inserted here -->
                </div>
            </div>
        `;

        // Insert before active trades
        activeTradesCard.parentNode.insertBefore(signalsCard, activeTradesCard);

        // Add collapse/expand functionality
        document.getElementById('collapse-signals-btn').addEventListener('click', toggleSignalsCollapse);
    }

    /**
     * Fetch pending signals from API
     */
    async function refreshSignals() {
        try {
            const response = await fetch('/api/signals/pending?status=pending');
            if (!response.ok) throw new Error('Failed to fetch signals');

            const data = await response.json();
            pendingSignals = data.signals || [];

            // Update UI
            renderSignals();

        } catch (error) {
            console.error('Error fetching signals:', error);
        }
    }

    /**
     * Render signals
     */
    function renderSignals() {
        const grid = document.getElementById('signals-grid');
        const countBadge = document.getElementById('signal-count');

        // Update count badge
        countBadge.textContent = pendingSignals.length;
        countBadge.style.display = pendingSignals.length > 0 ? 'inline-block' : 'none';

        // Render signals
        if (pendingSignals.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <div class="empty-state-message">No new signals</div>
                    <p>New high-conviction opportunities will appear here daily at 7 AM</p>
                </div>
            `;
            return;
        }

        // Render signal cards
        const signalCards = pendingSignals.map(renderSignalCard).join('');
        grid.innerHTML = signalCards;

        // Add event listeners
        attachSignalEventListeners();
    }

    /**
     * Render individual signal card
     */
    function renderSignalCard(signal) {
        // Get currency symbol
        const currency = getCurrencySymbol(signal.market);

        // Calculate signal age
        const signalAge = calculateSignalAge(signal.signalDate);
        const ageClass = signalAge === 0 ? 'new' : signalAge === 1 ? 'recent' : 'old';

        // Check if already have position
        const hasPosition = TradeCore && TradeCore.getActiveTrades()
            .some(t => t.symbol === signal.symbol);

        // Format win rate display
        const winRateClass = signal.winRate >= 85 ? 'excellent' :
                            signal.winRate >= 80 ? 'good' :
                            signal.winRate >= 75 ? 'moderate' : 'low';

        return `
            <div class="signal-card ${hasPosition ? 'has-position' : ''}" data-signal-id="${signal.id}">
                <div class="signal-header">
                    <div class="signal-title">
                        <h4>${signal.symbol}</h4>
                        <span class="signal-market">${signal.market} ${getMarketFlag(signal.market)}</span>
                    </div>
                    <span class="signal-age ${ageClass}">
                        ${signalAge === 0 ? 'Today' : signalAge === 1 ? 'Yesterday' : signalAge + 'd ago'}
                    </span>
                </div>

                ${hasPosition ?
                    '<div class="warning-badge">⚠️ Already have position</div>' :
                    ''
                }

                <div class="signal-info">
                    <div class="info-row">
                        <span class="info-label">Entry Price:</span>
                        <span class="info-value">${currency}${signal.entryPrice.toFixed(2)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Target (8%):</span>
                        <span class="info-value success">${currency}${signal.targetPrice.toFixed(2)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Stop Loss (5%):</span>
                        <span class="info-value danger">${currency}${signal.stopLoss.toFixed(2)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Square Off:</span>
                        <span class="info-value">${formatDate(signal.squareOffDate)}</span>
                    </div>
                </div>

                <div class="signal-stats">
                    <div class="stat-item">
                        <span class="stat-label">Win Rate:</span>
                        <span class="stat-value ${winRateClass}">${signal.winRate.toFixed(1)}%</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Hist. Trades:</span>
                        <span class="stat-value">${signal.historicalSignalCount}</span>
                    </div>
                </div>

                <div class="signal-scheduled-execution">
                    ${hasPosition ?
                        '<div class="execution-status blocked">⊗ Already in Portfolio</div>' :
                        `
                        <div class="execution-status scheduled">
                            <div class="execution-icon">📅</div>
                            <div class="execution-details">
                                <div class="execution-time">
                                    Auto-executes at 1:00 PM ${getMarketTimezone(signal.market)}
                                </div>
                                <div class="execution-countdown" data-market="${signal.market}">
                                    Calculating time remaining...
                                </div>
                            </div>
                        </div>
                        `
                    }
                </div>
            </div>
        `;
    }

    /**
     * Update countdown timers for all signals
     */
    function updateCountdowns() {
        document.querySelectorAll('.execution-countdown').forEach(element => {
            const market = element.dataset.market;
            const countdown = calculateTimeUntilExecution(market);

            if (countdown.expired) {
                element.textContent = '⏰ Executing now...';
                element.classList.add('executing');
            } else if (countdown.hours < 1) {
                element.textContent = `⏰ Executes in ${countdown.minutes}m ${countdown.seconds}s`;
                element.classList.add('imminent');
            } else {
                element.textContent = `⏰ Executes in ${countdown.hours}h ${countdown.minutes}m`;
            }
        });
    }

    /**
     * Calculate time until 1 PM execution for a market
     */
    function calculateTimeUntilExecution(market) {
        const now = new Date();

        // Get 1 PM today in market timezone
        const executionTime = new Date(now);
        executionTime.setHours(13, 0, 0, 0);

        // Adjust for timezone (simplified - production would use proper timezone library)
        const timezoneOffsets = {
            'India': 330, // IST is UTC+5:30
            'UK': 0,      // GMT is UTC+0 (BST would be +60)
            'US': -300    // EST is UTC-5 (EDT would be -240)
        };

        const offset = timezoneOffsets[market] || 0;
        executionTime.setMinutes(executionTime.getMinutes() + offset - now.getTimezoneOffset());

        const diff = executionTime - now;

        if (diff < 0) {
            return { expired: true };
        }

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        return { expired: false, hours, minutes, seconds };
    }

    /**
     * Start countdown timer updates
     */
    function startCountdownUpdates() {
        // Update immediately
        updateCountdowns();

        // Update every second
        setInterval(updateCountdowns, 1000);
    }

    /**
     * Helper function to get market timezone label
     */
    function getMarketTimezone(market) {
        const timezones = {
            'India': 'IST',
            'UK': 'GMT',
            'US': 'EST'
        };
        return timezones[market] || '';
    }

    /**
     * Start signal monitoring - updates countdowns
     */
    function attachSignalEventListeners() {
        // Start countdown timer updates
        startCountdownUpdates();
    }

    // Helper functions
    function getCurrencySymbol(market) {
        return { 'India': '₹', 'UK': '£', 'US': '$' }[market] || '';
    }

    function getMarketFlag(market) {
        return { 'India': '🇮🇳', 'UK': '🇬🇧', 'US': '🇺🇸' }[market] || '';
    }

    function calculateSignalAge(signalDate) {
        return Math.floor((new Date() - new Date(signalDate)) / (1000 * 60 * 60 * 24));
    }

    function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
    }

    function toggleSignalsCollapse() {
        const content = document.getElementById('signals-content');
        const isCollapsed = content.style.display === 'none';
        content.style.display = isCollapsed ? 'block' : 'none';
    }

    return { init, refreshSignals };
})();

// Auto-initialize
if (document.getElementById('active-trades-container')) {
    document.addEventListener('DOMContentLoaded', () => SignalsDisplay.init());
}
```

### Phase 3 Deliverables

- [ ] Scanner enhancement to store signals at 7 AM
- [ ] Trade executor module with 3 cron jobs (India/UK/US)
- [ ] Automated execution at 1 PM in each timezone
- [ ] Signal display UI with countdown timers
- [ ] CSS styles for scheduled execution display
- [ ] Telegram notifications for execution results
- [ ] Capital validation before execution
- [ ] Failed execution handling and logging
- [ ] Manual execution trigger for testing

**Status:** Not Started

---

## Complete Architecture Summary

### Signal-to-Trade Flow
```
7:00 AM UK → Scanner Runs → Store Signals (pending)
    ↓
1:00 PM IST → Auto-Execute India Signals
1:00 PM GMT → Auto-Execute UK Signals
1:00 PM EST → Auto-Execute US Signals
    ↓
Validate → Allocate Capital → Create Trade → Update Signal (added)
```

### Key Improvements Over Manual Approach
1. **Consistent Timing** - All trades execute at 1 PM (post-lunch liquidity)
2. **Zero Slippage** - No delays from manual clicking
3. **Fully Automated** - No human intervention required
4. **Capital-Safe** - Validates limits before every execution
5. **Observable** - Real-time countdown timers + Telegram alerts
6. **Fault-Tolerant** - Handles failures, logs all attempts

---

## Next Phases (4 & 5)

**Phase 4:** Exit Management (auto-check exits, DTI triggers)
**Phase 5:** Analytics & Reporting (performance tracking, metrics)

    /**
     * Handle dismiss signal
     */
    async function handleDismissSignal(e) {
        const signalId = e.currentTarget.dataset.signalId;
        const signalCard = e.currentTarget.closest('.signal-card');

        try {
            // Show loading state
            e.currentTarget.disabled = true;
            e.currentTarget.innerHTML = '<span class="spinner"></span> Dismissing...';

            // Call API to dismiss signal
            const response = await fetch(`/api/signals/dismiss/${signalId}`, {
                method: 'POST'
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error('Failed to dismiss signal');
            }

            // Remove signal card with animation
            signalCard.classList.add('fade-out');
            setTimeout(() => {
                signalCard.remove();
                refreshSignals(); // Refresh to update count
            }, 300);

        } catch (error) {
            console.error('Error dismissing signal:', error);
            showNotification('❌ Failed to dismiss signal', 'error');

            // Reset button
            e.currentTarget.disabled = false;
            e.currentTarget.innerHTML = 'Dismiss';
        }
    }

    /**
     * Calculate signal age in trading days
     */
    function calculateSignalAge(signalDate) {
        const signal = new Date(signalDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        signal.setHours(0, 0, 0, 0);

        let days = 0;
        let tempDate = new Date(today);

        while (tempDate > signal) {
            const dayOfWeek = tempDate.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                days++;
            }
            tempDate.setDate(tempDate.getDate() - 1);
        }

        return days;
    }

    /**
     * Toggle signals collapse/expand
     */
    function toggleSignalsCollapse(e) {
        const content = document.getElementById('signals-content');
        const btn = e.currentTarget;

        content.classList.toggle('collapsed');
        btn.classList.toggle('collapsed');
    }

    /**
     * Helper: Get market flag
     */
    function getMarketFlag(market) {
        const flags = {
            'India': '🇮🇳',
            'UK': '🇬🇧',
            'US': '🇺🇸'
        };
        return flags[market] || '';
    }

    /**
     * Helper: Get currency symbol
     */
    function getCurrencySymbol(market) {
        const symbols = {
            'India': '₹',
            'UK': '£',
            'US': '$'
        };
        return symbols[market] || '$';
    }

    /**
     * Helper: Format date
     */
    function formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('en-GB');
    }

    // Public API
    return {
        init,
        refreshSignals
    };
})();

// Auto-initialize on trades page
if (document.getElementById('active-trades-container')) {
    document.addEventListener('DOMContentLoaded', () => {
        SignalsDisplay.init();
    });
}
```

### 3.3 CSS Styles for Signals

**File**: `public/css/main.css` (add)

```css
/* ========================================
   SIGNALS DISPLAY STYLES
   ======================================== */

.signals-card {
    margin-bottom: 2rem;
}

.signal-count {
    display: inline-block;
    background: var(--primary-color);
    color: white;
    border-radius: 12px;
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    margin-left: 0.5rem;
}

.btn-collapse {
    background: transparent;
    border: none;
    padding: 0.25rem;
    cursor: pointer;
    color: var(--text-secondary);
    transition: transform 0.3s ease;
    margin-left: auto;
}

.btn-collapse.collapsed {
    transform: rotate(-90deg);
}

.signals-content {
    max-height: 2000px;
    overflow: hidden;
    transition: max-height 0.3s ease;
}

.signals-content.collapsed {
    max-height: 0;
}

.signals-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.5rem;
}

.signal-card {
    background: var(--card-bg);
    border: 2px solid var(--border-color);
    border-radius: 8px;
    padding: 1.25rem;
    transition: all 0.3s ease;
}

.signal-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: var(--primary-color);
}

.signal-card.has-position {
    border-color: var(--warning-color);
    background: var(--warning-bg);
}

.signal-card.fade-out {
    opacity: 0;
    transform: scale(0.95);
}

.signal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-color);
}

.signal-title h4 {
    margin: 0 0 0.25rem 0;
    font-size: 1.1rem;
    color: var(--text-primary);
}

.signal-market {
    font-size: 0.875rem;
    color: var(--text-secondary);
}

.signal-age {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-weight: 600;
}

.signal-age.new {
    background: var(--success-light);
    color: var(--success-color);
}

.signal-age.recent {
    background: var(--info-light);
    color: var(--info-color);
}

.signal-age.old {
    background: var(--warning-light);
    color: var(--warning-color);
}

.warning-badge {
    background: var(--warning-light);
    color: var(--warning-color);
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 1rem;
}

.signal-info {
    margin-bottom: 1rem;
}

.info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
}

.info-label {
    color: var(--text-secondary);
    font-size: 0.875rem;
}

.info-value {
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--text-primary);
}

.info-value.success {
    color: var(--success-color);
}

.info-value.danger {
    color: var(--danger-color);
}

.signal-stats {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    padding: 0.75rem;
    background: var(--background-tertiary);
    border-radius: 6px;
}

.stat-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.stat-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
}

.stat-value {
    font-size: 1.1rem;
    font-weight: 700;
    font-family: var(--font-mono);
}

.stat-value.excellent {
    color: var(--success-color);
}

.stat-value.good {
    color: var(--info-color);
}

.stat-value.moderate {
    color: var(--warning-color);
}

.signal-actions {
    display: flex;
    gap: 0.5rem;
}

.signal-actions button {
    flex: 1;
    font-size: 0.875rem;
}

/* Responsive */
@media (max-width: 768px) {
    .signals-grid {
        grid-template-columns: 1fr;
    }

    .signal-actions {
        flex-direction: column;
    }
}
```

### 3.4 Server API Endpoints

Add to `server.js`:

```javascript
// Store signal from scan
app.post('/api/signals/store', requireAuth, async (req, res) => {
    try {
        const signalId = await TradeDB.storePendingSignal(req.body);
        res.json({ success: true, signalId });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ error: 'Duplicate signal' });
        }
        res.status(500).json({ error: error.message });
    }
});

// Check for duplicate
app.get('/api/signals/check-duplicate', requireAuth, async (req, res) => {
    try {
        const { symbol, signalDate } = req.query;
        const existing = await TradeDB.getPendingSignal(symbol, signalDate);
        res.json({
            exists: !!existing,
            signalId: existing?.id
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Check for active position
app.get('/api/trades/check-active', requireAuth, async (req, res) => {
    try {
        const { symbol } = req.query;
        const trade = await TradeDB.getActiveTradeBySymbol(symbol);
        res.json({
            hasActivePosition: !!trade,
            tradeId: trade?.id
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

### Phase 3 Deliverables

- [ ] Scanner enhanced to store signals
- [ ] Deduplication logic implemented and tested
- [ ] Signals display component working
- [ ] CSS styles added to main.css
- [ ] API endpoints implemented
- [ ] Integration with trades page complete
- [ ] Signal age calculation accurate
- [ ] Collapsible UI working
- [ ] Add/Dismiss functionality tested

---

## Phase 4: Telegram Alert Integration

### Duration: Week 2-3 (5 days)
### Dependencies: Phase 1, Phase 2, Phase 3 complete
### Status: Not Started

### 4.1 Exit Monitoring System

**File**: `lib/portfolio/exit-monitor.js`

```javascript
/**
 * Exit Monitoring System
 * Checks active trades for exit conditions and sends Telegram alerts
 */

const cron = require('node-cron');
const TradeDB = require('../../database-postgres');
const CapitalManager = require('./capital-manager');
const { broadcastToSubscribers } = require('../telegram/telegram-bot');
const axios = require('axios');

class ExitMonitor {
    constructor() {
        this.isMonitoring = false;
        this.monitoringJobs = [];

        this.CONFIG = {
            TARGET_PERCENT: 8,
            STOP_LOSS_PERCENT: 5,
            MAX_HOLDING_DAYS: 30,
            CHECK_INTERVAL_MINUTES: 5
        };
    }

    /**
     * Initialize exit monitoring
     */
    initialize() {
        console.log('🔍 [EXIT MONITOR] Initializing...');

        // Schedule checks every 5 minutes during market hours
        // UK: 8 AM - 4:30 PM (Mon-Fri)
        // India: 9:15 AM - 3:30 PM (Mon-Fri)
        // US: 2:30 PM - 9 PM UK time (Mon-Fri)

        const checkJob = cron.schedule('*/5 * * * *', async () => {
            const ukTime = new Date().toLocaleString("en-GB", {timeZone: "Europe/London"});
            const ukHour = new Date(ukTime).getHours();
            const ukDay = new Date(ukTime).getDay();

            // Only run during market hours (weekdays, 8 AM - 9 PM UK time)
            if (ukDay >= 1 && ukDay <= 5 && ukHour >= 8 && ukHour < 21) {
                console.log('🔍 [EXIT MONITOR] Checking exits at', ukTime);
                await this.checkAllExits();
            }
        }, {
            timezone: "Europe/London",
            scheduled: true
        });

        this.monitoringJobs.push(checkJob);

        console.log('✅ [EXIT MONITOR] Initialized');
        console.log('📅 [EXIT MONITOR] Checking every 5 minutes during market hours');
    }

    /**
     * Check all active trades for exit conditions
     */
    async checkAllExits() {
        if (this.isMonitoring) {
            console.log('⚠️ [EXIT MONITOR] Already checking, skipping...');
            return;
        }

        this.isMonitoring = true;

        try {
            // Get all active trades
            const activeTrades = await TradeDB.getActiveTrades();
            console.log(`🔍 [EXIT MONITOR] Checking ${activeTrades.length} active trades`);

            if (activeTrades.length === 0) {
                return { checked: 0, exitsTriggered: 0, exits: [] };
            }

            const exitsTriggered = [];

            // Check each trade
            for (const trade of activeTrades) {
                const exitResult = await this.checkTradeExit(trade);

                if (exitResult.shouldExit) {
                    exitsTriggered.push(exitResult);
                }
            }

            console.log(`✅ [EXIT MONITOR] Checked ${activeTrades.length} trades, ${exitsTriggered.length} exits triggered`);

            return {
                checked: activeTrades.length,
                exitsTriggered: exitsTriggered.length,
                exits: exitsTriggered
            };

        } catch (error) {
            console.error('❌ [EXIT MONITOR] Error:', error);
            return { error: error.message };
        } finally {
            this.isMonitoring = false;
        }
    }

    /**
     * Check individual trade for exit conditions
     */
    async checkTradeExit(trade) {
        try {
            // Fetch current price
            const currentPrice = await this.fetchCurrentPrice(trade.symbol);
            if (!currentPrice) {
                console.log(`⚠️ [EXIT MONITOR] Could not fetch price for ${trade.symbol}`);
                return { shouldExit: false };
            }

            // Calculate P/L
            const plPercent = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;

            // Calculate holding days
            const entryDate = new Date(trade.entryDate);
            const today = new Date();
            const holdingDays = Math.floor((today - entryDate) / (24 * 60 * 60 * 1000));

            // Check exit conditions
            let exitType = null;
            let exitReason = null;

            // 1. Target reached
            if (plPercent >= this.CONFIG.TARGET_PERCENT) {
                exitType = 'target_reached';
                exitReason = `Target reached: +${plPercent.toFixed(2)}%`;
            }
            // 2. Stop loss hit
            else if (plPercent <= -this.CONFIG.STOP_LOSS_PERCENT) {
                exitType = 'stop_loss';
                exitReason = `Stop loss hit: ${plPercent.toFixed(2)}%`;
            }
            // 3. Max holding days reached
            else if (holdingDays >= this.CONFIG.MAX_HOLDING_DAYS) {
                exitType = 'max_days';
                exitReason = `Max holding period reached: ${holdingDays} days`;
            }
            // 4. Square-off date reached
            else if (trade.squareOffDate) {
                const squareOffDate = new Date(trade.squareOffDate);
                if (today >= squareOffDate) {
                    exitType = 'square_off';
                    exitReason = `Square-off date reached`;
                }
            }

            // No exit condition met
            if (!exitType) {
                // Record check in database
                await this.recordExitCheck(trade.id, currentPrice, plPercent, holdingDays, false);
                return { shouldExit: false };
            }

            // Exit condition met - check if alert already sent
            const alertAlreadySent = await this.checkAlertSent(trade.id, exitType);
            if (alertAlreadySent) {
                console.log(`⚠️ [EXIT MONITOR] Alert already sent for ${trade.symbol} (${exitType})`);
                return { shouldExit: false };
            }

            // Close the trade
            await this.closeTrade(trade, currentPrice, plPercent, exitType, exitReason);

            // Send Telegram alert
            await this.sendExitAlert(trade, currentPrice, plPercent, exitType, exitReason);

            // Record exit check with alert sent
            await this.recordExitCheck(trade.id, currentPrice, plPercent, holdingDays, true, exitType);

            return {
                shouldExit: true,
                tradeId: trade.id,
                symbol: trade.symbol,
                exitType: exitType,
                entryPrice: trade.entryPrice,
                exitPrice: currentPrice,
                plPercent: plPercent,
                exitReason: exitReason,
                alertSent: true
            };

        } catch (error) {
            console.error(`❌ [EXIT MONITOR] Error checking ${trade.symbol}:`, error);
            return { shouldExit: false, error: error.message };
        }
    }

    /**
     * Fetch current price for symbol
     */
    async fetchCurrentPrice(symbol) {
        try {
            const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
            const proxyUrl = `${baseUrl}/yahoo/quote?symbol=${symbol}`;

            const response = await axios.get(proxyUrl, { timeout: 5000 });

            if (response.data && response.data.regularMarketPrice) {
                return response.data.regularMarketPrice;
            }

            return null;
        } catch (error) {
            console.error(`Error fetching price for ${symbol}:`, error.message);
            return null;
        }
    }

    /**
     * Close trade in database
     */
    async closeTrade(trade, exitPrice, plPercent, exitType, exitReason) {
        try {
            // Update trade as closed
            await TradeDB.closeTrade(trade.id, {
                exitDate: new Date().toISOString().split('T')[0],
                exitPrice: exitPrice,
                profitLossPercent: plPercent,
                exitReason: exitReason
            });

            // Release capital
            await CapitalManager.releaseFromTrade({
                ...trade,
                profitLossPercent: plPercent
            });

            console.log(`✅ [EXIT MONITOR] Closed trade ${trade.symbol} (${exitType})`);
        } catch (error) {
            console.error(`❌ [EXIT MONITOR] Error closing trade ${trade.symbol}:`, error);
            throw error;
        }
    }

    /**
     * Send Telegram alert for exit
     */
    async sendExitAlert(trade, exitPrice, plPercent, exitType, exitReason) {
        try {
            const currencySymbol = this.getCurrencySymbol(trade.market);
            const plSign = plPercent >= 0 ? '+' : '';
            const emoji = exitType === 'target_reached' ? '🎯' :
                         exitType === 'stop_loss' ? '🛑' :
                         exitType === 'square_off' ? '⏰' :
                         exitType === 'max_days' ? '📅' : '📤';

            const alertMessage = {
                type: 'custom',
                message:
                    `${emoji} *${exitType === 'target_reached' ? 'TARGET REACHED' :
                                 exitType === 'stop_loss' ? 'STOP LOSS HIT' :
                                 exitType === 'square_off' ? 'SQUARE-OFF TRIGGERED' :
                                 exitType === 'max_days' ? 'MAX DAYS EXIT' : 'EXIT TRIGGERED'}*\n\n` +
                    `📊 *Stock:* ${trade.symbol}\n` +
                    `📍 *Entry:* ${currencySymbol}${trade.entryPrice.toFixed(2)}\n` +
                    `📤 *Exit:* ${currencySymbol}${exitPrice.toFixed(2)}\n` +
                    `💹 *P/L:* ${plSign}${plPercent.toFixed(2)}% (${plSign}${currencySymbol}${Math.abs((trade.trade_size * plPercent / 100)).toFixed(2)})\n` +
                    `📝 *Reason:* ${exitReason}\n` +
                    `🕐 *Time:* ${new Date().toLocaleString()}\n\n` +
                    `${exitType === 'target_reached' ? '🎉 Congratulations on the profitable trade!' :
                      exitType === 'stop_loss' ? '⚠️ Better luck next time!' :
                      '✅ Trade closed'}`
            };

            // Broadcast to all subscribers
            await broadcastToSubscribers(alertMessage, 'all');

            console.log(`✅ [EXIT MONITOR] Alert sent for ${trade.symbol}`);
        } catch (error) {
            console.error(`❌ [EXIT MONITOR] Error sending alert for ${trade.symbol}:`, error);
        }
    }

    /**
     * Record exit check in database
     */
    async recordExitCheck(tradeId, currentPrice, plPercent, daysHeld, alertSent, alertType = null) {
        const query = `
            INSERT INTO trade_exit_checks
            (trade_id, current_price, pl_percent, days_held,
             target_reached, stop_loss_hit, max_days_reached,
             alert_sent, alert_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await TradeDB.run(query, [
            tradeId,
            currentPrice,
            plPercent,
            daysHeld,
            alertType === 'target_reached' ? 1 : 0,
            alertType === 'stop_loss' ? 1 : 0,
            alertType === 'max_days' || alertType === 'square_off' ? 1 : 0,
            alertSent ? 1 : 0,
            alertType
        ]);
    }

    /**
     * Check if alert already sent for this exit type
     */
    async checkAlertSent(tradeId, exitType) {
        const query = `
            SELECT * FROM trade_exit_checks
            WHERE trade_id = ?
              AND alert_sent = 1
              AND alert_type = ?
            ORDER BY check_time DESC
            LIMIT 1
        `;

        const result = await TradeDB.get(query, [tradeId, exitType]);
        return !!result;
    }

    /**
     * Get currency symbol for market
     */
    getCurrencySymbol(market) {
        const symbols = {
            'India': '₹',
            'UK': '£',
            'US': '$'
        };
        return symbols[market] || '$';
    }

    /**
     * Stop all monitoring jobs
     */
    stop() {
        this.monitoringJobs.forEach(job => job.destroy());
        this.monitoringJobs = [];
        console.log('🛑 [EXIT MONITOR] Stopped');
    }
}

module.exports = new ExitMonitor();
```

### 4.2 Initialize Exit Monitor in Server

**File**: `server.js` (add to initialization)

```javascript
// After scanner initialization
const ExitMonitor = require('./lib/portfolio/exit-monitor');

// Initialize exit monitoring
ExitMonitor.initialize();
console.log('✅ Exit monitoring initialized');
```

### 4.3 Manual Exit Alert

Add to trade close handler in `trade-core.js`:

```javascript
/**
 * Close trade manually with Telegram alert
 */
async function closeTrade(tradeId, exitPrice, exitReason, notes) {
    try {
        const trade = await TradeAPI.getTrade(tradeId);
        if (!trade) throw new Error('Trade not found');

        // Calculate P/L
        const plPercent = ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100;

        // Close trade in database
        await TradeAPI.closeTrade(tradeId, {
            exitPrice: exitPrice,
            profitLossPercent: plPercent,
            exitReason: exitReason,
            notes: notes
        });

        // Release capital
        await CapitalManager.releaseFromTrade({
            ...trade,
            profitLossPercent: plPercent
        });

        // Send Telegram alert for manual exit
        await sendManualExitAlert(trade, exitPrice, plPercent, exitReason);

        return { success: true };
    } catch (error) {
        console.error('Error closing trade:', error);
        throw error;
    }
}

/**
 * Send Telegram alert for manual exit
 */
async function sendManualExitAlert(trade, exitPrice, plPercent, exitReason) {
    try {
        const currencySymbol = getCurrencySymbol(trade.symbol);
        const plSign = plPercent >= 0 ? '+' : '';

        const alertMessage = {
            type: 'custom',
            message:
                `📤 *MANUAL EXIT*\n\n` +
                `📊 *Stock:* ${trade.symbol}\n` +
                `📍 *Entry:* ${currencySymbol}${trade.entryPrice.toFixed(2)}\n` +
                `📤 *Exit:* ${currencySymbol}${exitPrice.toFixed(2)}\n` +
                `💹 *P/L:* ${plSign}${plPercent.toFixed(2)}%\n` +
                `📝 *Reason:* ${exitReason}\n` +
                `🕐 *Time:* ${new Date().toLocaleString()}`
        };

        // Broadcast to all subscribers
        const response = await fetch('/api/alerts/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                alert: alertMessage,
                subscriptionType: 'all'
            })
        });

        if (!response.ok) {
            throw new Error('Failed to send alert');
        }

    } catch (error) {
        console.error('Error sending manual exit alert:', error);
    }
}
```

### 4.4 API Endpoint for Broadcasting

Add to `server.js`:

```javascript
// Broadcast alert (internal use)
app.post('/api/alerts/broadcast', requireAuth, async (req, res) => {
    try {
        const { alert, subscriptionType } = req.body;
        const result = await broadcastToSubscribers(alert, subscriptionType);
        res.json({ success: true, sent: result.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

### Phase 4 Deliverables

- [ ] Exit monitor module implemented
- [ ] Cron job for exit checks working
- [ ] Current price fetching reliable
- [ ] Exit alerts sent correctly
- [ ] Manual exit alerts working
- [ ] Duplicate alert prevention working
- [ ] Capital release on exit working
- [ ] Exit check history recorded

---

## Phase 5: Enhanced Trade Management

### Overview
Enhance the trades page with advanced features for managing positions, analyzing performance, and maintaining trade history.

### 5.1 Trade Editing and Bulk Actions

**File**: `public/js/trade-management.js`

```javascript
/**
 * Trade Management Module
 * Handles editing, bulk actions, and advanced trade operations
 */

const TradeManagement = (function() {

    /**
     * Edit trade details
     */
    async function editTrade(tradeId, updates) {
        try {
            // Validate updates
            if (updates.entryPrice && updates.entryPrice <= 0) {
                throw new Error('Entry price must be positive');
            }

            if (updates.stopLoss && updates.targetPrice) {
                const plRange = ((updates.targetPrice - updates.entryPrice) / updates.entryPrice) * 100;
                const slRange = ((updates.entryPrice - updates.stopLoss) / updates.entryPrice) * 100;

                if (plRange < 5 || slRange > 7) {
                    throw new Error('Risk/reward ratio outside acceptable range');
                }
            }

            // Update trade
            const response = await fetch(`/api/trades/${tradeId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });

            if (!response.ok) throw new Error('Failed to update trade');

            const result = await response.json();

            // If capital allocation changed, recalculate available capital
            if (updates.allocatedCapital) {
                await CapitalDisplay.refreshCapitalDisplay();
            }

            // Refresh trade display
            await refreshTradesList();

            return result;
        } catch (error) {
            console.error('Error editing trade:', error);
            throw error;
        }
    }

    /**
     * Bulk close trades
     */
    async function bulkCloseTrades(tradeIds, exitPrice, exitReason) {
        const results = [];
        const errors = [];

        for (const tradeId of tradeIds) {
            try {
                const result = await TradeCore.closeTrade(tradeId, exitPrice, exitReason);
                results.push({ tradeId, success: true, result });
            } catch (error) {
                errors.push({ tradeId, error: error.message });
            }

            // Small delay between closes
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Refresh displays
        await Promise.all([
            CapitalDisplay.refreshCapitalDisplay(),
            refreshTradesList()
        ]);

        return { results, errors };
    }

    /**
     * Add notes to trade
     */
    async function addTradeNote(tradeId, note, tags = []) {
        try {
            const response = await fetch(`/api/trades/${tradeId}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    note: note,
                    tags: tags,
                    timestamp: new Date().toISOString()
                })
            });

            if (!response.ok) throw new Error('Failed to add note');

            return await response.json();
        } catch (error) {
            console.error('Error adding note:', error);
            throw error;
        }
    }

    /**
     * Filter trades by criteria
     */
    function filterTrades(trades, criteria) {
        return trades.filter(trade => {
            // Filter by status
            if (criteria.status && trade.status !== criteria.status) {
                return false;
            }

            // Filter by market
            if (criteria.market) {
                const symbol = trade.symbol;
                const isIndian = symbol.includes('.NS');
                const isUK = symbol.includes('.L');
                const isUS = !isIndian && !isUK;

                if (criteria.market === 'india' && !isIndian) return false;
                if (criteria.market === 'uk' && !isUK) return false;
                if (criteria.market === 'us' && !isUS) return false;
            }

            // Filter by date range
            if (criteria.startDate) {
                const tradeDate = new Date(trade.entryDate);
                if (tradeDate < new Date(criteria.startDate)) return false;
            }

            if (criteria.endDate) {
                const tradeDate = new Date(trade.entryDate);
                if (tradeDate > new Date(criteria.endDate)) return false;
            }

            // Filter by P/L
            if (criteria.minPL !== undefined) {
                if (!trade.profitLossPercent || trade.profitLossPercent < criteria.minPL) {
                    return false;
                }
            }

            // Filter by tags
            if (criteria.tags && criteria.tags.length > 0) {
                if (!trade.tags || !criteria.tags.some(tag => trade.tags.includes(tag))) {
                    return false;
                }
            }

            return true;
        });
    }

    /**
     * Export trades to CSV
     */
    function exportToCSV(trades) {
        // CSV headers
        const headers = [
            'Symbol', 'Entry Date', 'Entry Price', 'Current Price',
            'Stop Loss', 'Target', 'DTI', 'Allocated Capital',
            'P/L %', 'Status', 'Exit Date', 'Exit Price', 'Exit Reason'
        ];

        // Convert trades to CSV rows
        const rows = trades.map(trade => [
            trade.symbol,
            trade.entryDate,
            trade.entryPrice,
            trade.currentPrice || '',
            trade.stopLoss,
            trade.targetPrice,
            trade.entryDTI,
            trade.allocatedCapital,
            trade.profitLossPercent || '',
            trade.status,
            trade.exitDate || '',
            trade.exitPrice || '',
            trade.exitReason || ''
        ]);

        // Combine headers and rows
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        // Create download
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trades_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    // Public API
    return {
        editTrade,
        bulkCloseTrades,
        addTradeNote,
        filterTrades,
        exportToCSV
    };
})();

window.TradeManagement = TradeManagement;
```

### 5.2 Performance Analytics Component

**File**: `public/js/performance-analytics.js`

```javascript
/**
 * Performance Analytics Module
 * Calculates and displays advanced trading statistics
 */

const PerformanceAnalytics = (function() {

    /**
     * Calculate comprehensive statistics
     */
    function calculateStats(trades) {
        const closedTrades = trades.filter(t => t.status === 'closed');

        if (closedTrades.length === 0) {
            return {
                totalTrades: 0,
                winRate: 0,
                avgWin: 0,
                avgLoss: 0,
                profitFactor: 0,
                sharpeRatio: 0,
                maxDrawdown: 0,
                avgHoldingDays: 0
            };
        }

        // Basic stats
        const wins = closedTrades.filter(t => t.profitLossPercent > 0);
        const losses = closedTrades.filter(t => t.profitLossPercent <= 0);
        const winRate = (wins.length / closedTrades.length) * 100;

        // Average win/loss
        const avgWin = wins.length > 0
            ? wins.reduce((sum, t) => sum + t.profitLossPercent, 0) / wins.length
            : 0;
        const avgLoss = losses.length > 0
            ? losses.reduce((sum, t) => sum + Math.abs(t.profitLossPercent), 0) / losses.length
            : 0;

        // Profit factor
        const totalWins = wins.reduce((sum, t) => sum + t.profitLossPercent, 0);
        const totalLosses = losses.reduce((sum, t) => sum + Math.abs(t.profitLossPercent), 0);
        const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

        // Sharpe ratio (simplified)
        const returns = closedTrades.map(t => t.profitLossPercent);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const stdDev = Math.sqrt(
            returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
        );
        const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

        // Max drawdown
        let peak = 0;
        let maxDrawdown = 0;
        let cumReturn = 0;

        closedTrades.forEach(trade => {
            cumReturn += trade.profitLossPercent;
            if (cumReturn > peak) peak = cumReturn;
            const drawdown = peak - cumReturn;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        });

        // Average holding period
        const avgHoldingDays = closedTrades.reduce((sum, t) => {
            const entry = new Date(t.entryDate);
            const exit = new Date(t.exitDate);
            const days = (exit - entry) / (1000 * 60 * 60 * 24);
            return sum + days;
        }, 0) / closedTrades.length;

        return {
            totalTrades: closedTrades.length,
            winRate: winRate.toFixed(1),
            avgWin: avgWin.toFixed(2),
            avgLoss: avgLoss.toFixed(2),
            profitFactor: profitFactor.toFixed(2),
            sharpeRatio: sharpeRatio.toFixed(2),
            maxDrawdown: maxDrawdown.toFixed(2),
            avgHoldingDays: avgHoldingDays.toFixed(1)
        };
    }

    /**
     * Calculate per-market statistics
     */
    function calculateMarketStats(trades) {
        const markets = {
            india: trades.filter(t => t.symbol.includes('.NS')),
            uk: trades.filter(t => t.symbol.includes('.L')),
            us: trades.filter(t => !t.symbol.includes('.NS') && !t.symbol.includes('.L'))
        };

        return {
            india: calculateStats(markets.india),
            uk: calculateStats(markets.uk),
            us: calculateStats(markets.us)
        };
    }

    /**
     * Display analytics on page
     */
    function displayAnalytics(trades) {
        const stats = calculateStats(trades);
        const marketStats = calculateMarketStats(trades);

        const container = document.getElementById('performance-analytics');
        if (!container) return;

        container.innerHTML = `
            <div class="analytics-section">
                <h3>Overall Performance</h3>
                <div class="stats-grid">
                    <div class="stat-card">
                        <span class="stat-label">Total Trades</span>
                        <span class="stat-value">${stats.totalTrades}</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Win Rate</span>
                        <span class="stat-value">${stats.winRate}%</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Avg Win</span>
                        <span class="stat-value positive">${stats.avgWin}%</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Avg Loss</span>
                        <span class="stat-value negative">${stats.avgLoss}%</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Profit Factor</span>
                        <span class="stat-value">${stats.profitFactor}</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Sharpe Ratio</span>
                        <span class="stat-value">${stats.sharpeRatio}</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Max Drawdown</span>
                        <span class="stat-value negative">${stats.maxDrawdown}%</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Avg Hold Days</span>
                        <span class="stat-value">${stats.avgHoldingDays}</span>
                    </div>
                </div>
            </div>

            <div class="analytics-section">
                <h3>Market Breakdown</h3>
                <div class="market-stats">
                    <div class="market-card">
                        <h4>India</h4>
                        <p>Win Rate: ${marketStats.india.winRate}%</p>
                        <p>Trades: ${marketStats.india.totalTrades}</p>
                    </div>
                    <div class="market-card">
                        <h4>UK</h4>
                        <p>Win Rate: ${marketStats.uk.winRate}%</p>
                        <p>Trades: ${marketStats.uk.totalTrades}</p>
                    </div>
                    <div class="market-card">
                        <h4>US</h4>
                        <p>Win Rate: ${marketStats.us.winRate}%</p>
                        <p>Trades: ${marketStats.us.totalTrades}</p>
                    </div>
                </div>
            </div>
        `;
    }

    // Public API
    return {
        calculateStats,
        calculateMarketStats,
        displayAnalytics
    };
})();

window.PerformanceAnalytics = PerformanceAnalytics;
```

### 5.3 CSS for Enhanced Trade Management

Add to `public/css/main.css`:

```css
/* Performance Analytics */
.analytics-section {
    margin: 2rem 0;
    padding: 1.5rem;
    background: var(--card-bg);
    border-radius: 8px;
}

.analytics-section h3 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    font-size: 1.25rem;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
}

.stat-card {
    display: flex;
    flex-direction: column;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 6px;
    border: 1px solid var(--border-color);
}

.stat-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
}

.stat-value {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
}

.stat-value.positive {
    color: var(--success-color);
}

.stat-value.negative {
    color: var(--danger-color);
}

.market-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
}

.market-card {
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 6px;
    border: 1px solid var(--border-color);
}

.market-card h4 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
}

.market-card p {
    margin: 0.25rem 0;
    color: var(--text-secondary);
}

/* Trade editing modal */
.trade-edit-modal {
    display: none;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--card-bg);
    border-radius: 8px;
    padding: 2rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    max-width: 500px;
    width: 90%;
}

.trade-edit-modal.active {
    display: block;
}

.modal-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
}

.modal-overlay.active {
    display: block;
}

/* Filter controls */
.filter-controls {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    margin: 1rem 0;
    padding: 1rem;
    background: var(--card-bg);
    border-radius: 8px;
}

.filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.filter-group label {
    font-size: 0.875rem;
    color: var(--text-secondary);
}

.filter-group select,
.filter-group input {
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-secondary);
    color: var(--text-primary);
}

/* Bulk action buttons */
.bulk-actions {
    display: flex;
    gap: 1rem;
    margin: 1rem 0;
}

.bulk-actions button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: opacity 0.2s;
}

.bulk-actions button:hover {
    opacity: 0.8;
}

.bulk-actions button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
```

### 5.4 API Endpoints for Trade Management

Add to `server.js`:

```javascript
// Update trade details
app.patch('/api/trades/:id', requireAuth, async (req, res) => {
    try {
        const tradeId = parseInt(req.params.id);
        const updates = req.body;
        const userId = req.user.id;

        // Verify trade ownership
        const trade = await db.getTrade(tradeId);
        if (!trade || trade.userId !== userId) {
            return res.status(404).json({ error: 'Trade not found' });
        }

        // Update trade
        await db.updateTrade(tradeId, updates);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add note to trade
app.post('/api/trades/:id/notes', requireAuth, async (req, res) => {
    try {
        const tradeId = parseInt(req.params.id);
        const { note, tags } = req.body;
        const userId = req.user.id;

        // Verify trade ownership
        const trade = await db.getTrade(tradeId);
        if (!trade || trade.userId !== userId) {
            return res.status(404).json({ error: 'Trade not found' });
        }

        // Add note
        await db.addTradeNote(tradeId, note, tags);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get trade history
app.get('/api/trades/history', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { startDate, endDate, market, status } = req.query;

        const filters = {
            userId,
            startDate,
            endDate,
            market,
            status
        };

        const trades = await db.getTradeHistory(filters);

        res.json(trades);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

### Phase 5 Deliverables

- [ ] Trade editing functionality implemented
- [ ] Bulk close trades working
- [ ] Trade notes and tagging system
- [ ] Performance analytics displaying correctly
- [ ] CSV export functionality
- [ ] Filter system working
- [ ] Market breakdown stats accurate
- [ ] All calculations verified

---

## Phase 6: User Settings & Preferences

### Overview
Allow users to customize system behavior, alert preferences, and trading parameters.

### 6.1 Settings Database Schema

Add to Phase 1 migrations:

```sql
-- User settings table
CREATE TABLE user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    setting_key TEXT NOT NULL,
    setting_value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, setting_key)
);

-- Default settings for new users
INSERT INTO user_settings (user_id, setting_key, setting_value) VALUES
(1, 'default_stop_loss_percent', '5'),
(1, 'default_target_percent', '8'),
(1, 'max_positions_total', '30'),
(1, 'max_positions_per_market', '10'),
(1, 'telegram_alerts_enabled', 'true'),
(1, 'telegram_alert_types', 'target,stoploss,manual,conviction'),
(1, 'auto_add_signals', 'false'),
(1, 'min_dti_threshold', '-40'),
(1, 'initial_capital_india', '500000'),
(1, 'initial_capital_uk', '4000'),
(1, 'initial_capital_us', '5000');
```

### 6.2 Settings Manager Module

**File**: `lib/settings/settings-manager.js`

```javascript
/**
 * Settings Manager
 * Handles user preferences and system configuration
 */

const db = require('../db/database-postgres');

class SettingsManager {

    /**
     * Get user setting
     */
    static async getSetting(userId, key, defaultValue = null) {
        try {
            const result = await db.getUserSetting(userId, key);
            return result ? result.setting_value : defaultValue;
        } catch (error) {
            console.error('Error getting setting:', error);
            return defaultValue;
        }
    }

    /**
     * Get all user settings
     */
    static async getAllSettings(userId) {
        try {
            const settings = await db.getAllUserSettings(userId);

            // Convert to key-value object
            const settingsObj = {};
            settings.forEach(setting => {
                settingsObj[setting.setting_key] = setting.setting_value;
            });

            return settingsObj;
        } catch (error) {
            console.error('Error getting all settings:', error);
            return {};
        }
    }

    /**
     * Update setting
     */
    static async updateSetting(userId, key, value) {
        try {
            await db.updateUserSetting(userId, key, value);
            return true;
        } catch (error) {
            console.error('Error updating setting:', error);
            return false;
        }
    }

    /**
     * Update multiple settings
     */
    static async updateSettings(userId, settings) {
        try {
            const promises = Object.entries(settings).map(([key, value]) =>
                db.updateUserSetting(userId, key, value)
            );

            await Promise.all(promises);
            return true;
        } catch (error) {
            console.error('Error updating settings:', error);
            return false;
        }
    }

    /**
     * Reset to default settings
     */
    static async resetToDefaults(userId) {
        const defaults = {
            'default_stop_loss_percent': '5',
            'default_target_percent': '8',
            'max_positions_total': '30',
            'max_positions_per_market': '10',
            'telegram_alerts_enabled': 'true',
            'telegram_alert_types': 'target,stoploss,manual,conviction',
            'auto_add_signals': 'false',
            'min_dti_threshold': '-40',
            'initial_capital_india': '500000',
            'initial_capital_uk': '4000',
            'initial_capital_us': '5000'
        };

        return await this.updateSettings(userId, defaults);
    }

    /**
     * Validate setting value
     */
    static validateSetting(key, value) {
        switch (key) {
            case 'default_stop_loss_percent':
            case 'default_target_percent':
                const percent = parseFloat(value);
                return percent > 0 && percent <= 20;

            case 'max_positions_total':
                const total = parseInt(value);
                return total > 0 && total <= 50;

            case 'max_positions_per_market':
                const perMarket = parseInt(value);
                return perMarket > 0 && perMarket <= 20;

            case 'min_dti_threshold':
                const dti = parseFloat(value);
                return dti >= -100 && dti <= 0;

            case 'telegram_alerts_enabled':
            case 'auto_add_signals':
                return value === 'true' || value === 'false';

            case 'initial_capital_india':
            case 'initial_capital_uk':
            case 'initial_capital_us':
                const capital = parseFloat(value);
                return capital >= 0;

            default:
                return true;
        }
    }
}

module.exports = SettingsManager;
```

### 6.3 Settings UI Component

**File**: `public/js/settings-ui.js`

```javascript
/**
 * Settings UI Module
 * User interface for managing preferences
 */

const SettingsUI = (function() {

    let currentSettings = {};

    /**
     * Initialize settings page
     */
    async function initializeSettings() {
        try {
            // Load current settings
            currentSettings = await loadSettings();

            // Populate form
            populateSettingsForm(currentSettings);

            // Setup event listeners
            setupEventListeners();

        } catch (error) {
            console.error('Error initializing settings:', error);
        }
    }

    /**
     * Load settings from API
     */
    async function loadSettings() {
        const response = await fetch('/api/settings');
        if (!response.ok) throw new Error('Failed to load settings');
        return await response.json();
    }

    /**
     * Populate settings form
     */
    function populateSettingsForm(settings) {
        // Trading parameters
        document.getElementById('stop-loss-percent').value =
            settings.default_stop_loss_percent || '5';
        document.getElementById('target-percent').value =
            settings.default_target_percent || '8';
        document.getElementById('max-positions-total').value =
            settings.max_positions_total || '30';
        document.getElementById('max-positions-per-market').value =
            settings.max_positions_per_market || '10';
        document.getElementById('min-dti-threshold').value =
            settings.min_dti_threshold || '-40';

        // Telegram settings
        document.getElementById('telegram-enabled').checked =
            settings.telegram_alerts_enabled === 'true';

        const alertTypes = settings.telegram_alert_types?.split(',') || [];
        document.getElementById('alert-target').checked = alertTypes.includes('target');
        document.getElementById('alert-stoploss').checked = alertTypes.includes('stoploss');
        document.getElementById('alert-manual').checked = alertTypes.includes('manual');
        document.getElementById('alert-conviction').checked = alertTypes.includes('conviction');

        // Auto-add signals
        document.getElementById('auto-add-signals').checked =
            settings.auto_add_signals === 'true';

        // Initial capital
        document.getElementById('capital-india').value =
            settings.initial_capital_india || '500000';
        document.getElementById('capital-uk').value =
            settings.initial_capital_uk || '4000';
        document.getElementById('capital-us').value =
            settings.initial_capital_us || '5000';
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Save settings button
        document.getElementById('save-settings-btn')?.addEventListener('click', saveSettings);

        // Reset to defaults button
        document.getElementById('reset-defaults-btn')?.addEventListener('click', resetToDefaults);

        // Real-time validation
        document.querySelectorAll('.settings-input').forEach(input => {
            input.addEventListener('change', validateInput);
        });
    }

    /**
     * Validate input
     */
    function validateInput(event) {
        const input = event.target;
        const value = input.value;
        const key = input.dataset.settingKey;

        // Basic validation based on input type
        if (input.type === 'number') {
            const num = parseFloat(value);
            const min = parseFloat(input.min);
            const max = parseFloat(input.max);

            if (num < min || num > max) {
                input.classList.add('invalid');
                return false;
            }
        }

        input.classList.remove('invalid');
        return true;
    }

    /**
     * Save settings
     */
    async function saveSettings() {
        try {
            // Gather all settings
            const settings = {
                default_stop_loss_percent: document.getElementById('stop-loss-percent').value,
                default_target_percent: document.getElementById('target-percent').value,
                max_positions_total: document.getElementById('max-positions-total').value,
                max_positions_per_market: document.getElementById('max-positions-per-market').value,
                min_dti_threshold: document.getElementById('min-dti-threshold').value,
                telegram_alerts_enabled: document.getElementById('telegram-enabled').checked.toString(),
                auto_add_signals: document.getElementById('auto-add-signals').checked.toString(),
                initial_capital_india: document.getElementById('capital-india').value,
                initial_capital_uk: document.getElementById('capital-uk').value,
                initial_capital_us: document.getElementById('capital-us').value
            };

            // Get selected alert types
            const alertTypes = [];
            if (document.getElementById('alert-target').checked) alertTypes.push('target');
            if (document.getElementById('alert-stoploss').checked) alertTypes.push('stoploss');
            if (document.getElementById('alert-manual').checked) alertTypes.push('manual');
            if (document.getElementById('alert-conviction').checked) alertTypes.push('conviction');
            settings.telegram_alert_types = alertTypes.join(',');

            // Save to API
            const response = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });

            if (!response.ok) throw new Error('Failed to save settings');

            // Show success message
            showNotification('Settings saved successfully', 'success');

            // Update current settings
            currentSettings = settings;

        } catch (error) {
            console.error('Error saving settings:', error);
            showNotification('Failed to save settings', 'error');
        }
    }

    /**
     * Reset to defaults
     */
    async function resetToDefaults() {
        if (!confirm('Reset all settings to defaults?')) return;

        try {
            const response = await fetch('/api/settings/reset', {
                method: 'POST'
            });

            if (!response.ok) throw new Error('Failed to reset settings');

            // Reload settings
            const settings = await loadSettings();
            populateSettingsForm(settings);

            showNotification('Settings reset to defaults', 'success');

        } catch (error) {
            console.error('Error resetting settings:', error);
            showNotification('Failed to reset settings', 'error');
        }
    }

    /**
     * Show notification
     */
    function showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 3000);
    }

    // Public API
    return {
        initializeSettings,
        loadSettings,
        saveSettings
    };
})();

window.SettingsUI = SettingsUI;
```

### 6.4 Settings Page HTML

Create `public/settings.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Settings - SutrAlgo</title>
    <link rel="stylesheet" href="/css/main.css">
</head>
<body>
    <div class="container">
        <h1>Settings</h1>

        <div class="settings-container">
            <!-- Trading Parameters -->
            <section class="settings-section">
                <h2>Trading Parameters</h2>

                <div class="setting-item">
                    <label for="stop-loss-percent">Default Stop Loss (%)</label>
                    <input type="number" id="stop-loss-percent"
                           class="settings-input" data-setting-key="default_stop_loss_percent"
                           min="1" max="20" step="0.5">
                </div>

                <div class="setting-item">
                    <label for="target-percent">Default Target (%)</label>
                    <input type="number" id="target-percent"
                           class="settings-input" data-setting-key="default_target_percent"
                           min="1" max="20" step="0.5">
                </div>

                <div class="setting-item">
                    <label for="max-positions-total">Max Positions (Total)</label>
                    <input type="number" id="max-positions-total"
                           class="settings-input" data-setting-key="max_positions_total"
                           min="1" max="50">
                </div>

                <div class="setting-item">
                    <label for="max-positions-per-market">Max Positions (Per Market)</label>
                    <input type="number" id="max-positions-per-market"
                           class="settings-input" data-setting-key="max_positions_per_market"
                           min="1" max="20">
                </div>

                <div class="setting-item">
                    <label for="min-dti-threshold">Min DTI Threshold</label>
                    <input type="number" id="min-dti-threshold"
                           class="settings-input" data-setting-key="min_dti_threshold"
                           min="-100" max="0" step="1">
                    <span class="setting-help">Signals with DTI above this will be filtered</span>
                </div>
            </section>

            <!-- Telegram Alerts -->
            <section class="settings-section">
                <h2>Telegram Alerts</h2>

                <div class="setting-item">
                    <label>
                        <input type="checkbox" id="telegram-enabled">
                        Enable Telegram Alerts
                    </label>
                </div>

                <div class="setting-item">
                    <label>Alert Types:</label>
                    <div class="checkbox-group">
                        <label><input type="checkbox" id="alert-target"> Target Reached</label>
                        <label><input type="checkbox" id="alert-stoploss"> Stop Loss Hit</label>
                        <label><input type="checkbox" id="alert-manual"> Manual Exits</label>
                        <label><input type="checkbox" id="alert-conviction"> High Conviction Signals</label>
                    </div>
                </div>
            </section>

            <!-- Signal Automation -->
            <section class="settings-section">
                <h2>Signal Automation</h2>

                <div class="setting-item">
                    <label>
                        <input type="checkbox" id="auto-add-signals">
                        Auto-add high conviction signals as trades
                    </label>
                    <span class="setting-help">Automatically convert 7 AM signals to active trades</span>
                </div>
            </section>

            <!-- Initial Capital -->
            <section class="settings-section">
                <h2>Initial Capital</h2>

                <div class="setting-item">
                    <label for="capital-india">India (₹)</label>
                    <input type="number" id="capital-india"
                           class="settings-input" data-setting-key="initial_capital_india"
                           min="0" step="10000">
                </div>

                <div class="setting-item">
                    <label for="capital-uk">UK (£)</label>
                    <input type="number" id="capital-uk"
                           class="settings-input" data-setting-key="initial_capital_uk"
                           min="0" step="100">
                </div>

                <div class="setting-item">
                    <label for="capital-us">US ($)</label>
                    <input type="number" id="capital-us"
                           class="settings-input" data-setting-key="initial_capital_us"
                           min="0" step="100">
                </div>
            </section>

            <!-- Action Buttons -->
            <div class="settings-actions">
                <button id="save-settings-btn" class="btn-primary">Save Settings</button>
                <button id="reset-defaults-btn" class="btn-secondary">Reset to Defaults</button>
            </div>
        </div>
    </div>

    <script src="/js/settings-ui.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            SettingsUI.initializeSettings();
        });
    </script>
</body>
</html>
```

### 6.5 Settings API Endpoints

Add to `server.js`:

```javascript
const SettingsManager = require('./lib/settings/settings-manager');

// Get user settings
app.get('/api/settings', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const settings = await SettingsManager.getAllSettings(userId);
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update user settings
app.put('/api/settings', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const settings = req.body;

        // Validate all settings
        for (const [key, value] of Object.entries(settings)) {
            if (!SettingsManager.validateSetting(key, value)) {
                return res.status(400).json({ error: `Invalid value for ${key}` });
            }
        }

        // Update settings
        await SettingsManager.updateSettings(userId, settings);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reset settings to defaults
app.post('/api/settings/reset', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        await SettingsManager.resetToDefaults(userId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

### Phase 6 Deliverables

- [ ] Settings database schema created
- [ ] Settings manager module implemented
- [ ] Settings UI page created
- [ ] All settings load/save correctly
- [ ] Validation working for all inputs
- [ ] Reset to defaults functional
- [ ] Settings persist across sessions
- [ ] Settings applied to system behavior

---

## Phase 7: Testing & Refinement

### Overview
Comprehensive testing of all components and refinement based on real-world usage.

### 7.1 Testing Checklist

#### Database Tests

```javascript
/**
 * Database Integration Tests
 * File: tests/database.test.js
 */

const assert = require('assert');
const db = require('../lib/db/database-postgres');

describe('Database Tests', () => {

    describe('Pending Signals', () => {
        it('should store signal without duplicates', async () => {
            const signal = {
                symbol: 'AAPL',
                signal_date: '2025-01-15',
                dti: -45.5,
                current_price: 150.25
            };

            const result1 = await db.storePendingSignal(signal);
            assert.ok(result1.id);

            // Try to store duplicate - should fail
            try {
                await db.storePendingSignal(signal);
                assert.fail('Should have thrown duplicate error');
            } catch (error) {
                assert.ok(error.message.includes('duplicate'));
            }
        });

        it('should clean up old signals', async () => {
            // Create old signal (5 days ago)
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 5);

            await db.storePendingSignal({
                symbol: 'OLD',
                signal_date: oldDate.toISOString().split('T')[0],
                dti: -50,
                current_price: 100
            });

            // Run cleanup
            await db.cleanupOldSignals();

            // Verify old signal is gone
            const signal = await db.getPendingSignal('OLD', oldDate.toISOString().split('T')[0]);
            assert.strictEqual(signal, null);
        });
    });

    describe('Capital Management', () => {
        it('should allocate capital correctly', async () => {
            const userId = 1;
            const market = 'india';

            const result = await db.allocateCapital(userId, market, 50000);
            assert.ok(result.success);

            const capital = await db.getPortfolioCapital(userId, market);
            assert.strictEqual(capital.allocated, 50000);
        });

        it('should prevent over-allocation', async () => {
            const userId = 1;
            const market = 'india';

            // Try to allocate more than available
            try {
                await db.allocateCapital(userId, market, 10000000);
                assert.fail('Should have thrown insufficient capital error');
            } catch (error) {
                assert.ok(error.message.includes('Insufficient'));
            }
        });
    });

    describe('Trade Operations', () => {
        it('should create trade from signal', async () => {
            const signal = {
                symbol: 'MSFT',
                signal_date: '2025-01-15',
                dti: -42.3,
                current_price: 380.50
            };

            await db.storePendingSignal(signal);

            const trade = await db.createTradeFromSignal(1, signal);
            assert.ok(trade.id);
            assert.strictEqual(trade.symbol, 'MSFT');

            // Verify signal status updated
            const updatedSignal = await db.getPendingSignal('MSFT', '2025-01-15');
            assert.strictEqual(updatedSignal.status, 'added');
        });
    });
});
```

#### API Integration Tests

```javascript
/**
 * API Integration Tests
 * File: tests/api.test.js
 */

const request = require('supertest');
const app = require('../server');

describe('API Integration Tests', () => {

    let authToken;

    before(async () => {
        // Login and get auth token
        const response = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'testpass' });
        authToken = response.body.token;
    });

    describe('Signals API', () => {
        it('GET /api/signals/pending should return pending signals', async () => {
            const response = await request(app)
                .get('/api/signals/pending')
                .set('Authorization', `Bearer ${authToken}`);

            assert.strictEqual(response.status, 200);
            assert.ok(Array.isArray(response.body));
        });

        it('POST /api/signals/add should create trade from signal', async () => {
            const response = await request(app)
                .post('/api/signals/add')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ signalId: 1 });

            assert.strictEqual(response.status, 200);
            assert.ok(response.body.tradeId);
        });
    });

    describe('Capital API', () => {
        it('GET /api/capital should return capital status', async () => {
            const response = await request(app)
                .get('/api/capital')
                .set('Authorization', `Bearer ${authToken}`);

            assert.strictEqual(response.status, 200);
            assert.ok(response.body.india);
            assert.ok(response.body.uk);
            assert.ok(response.body.us);
        });
    });

    describe('Trades API', () => {
        it('POST /api/trades/close should close trade and release capital', async () => {
            const response = await request(app)
                .post('/api/trades/close')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    tradeId: 1,
                    exitPrice: 155.00,
                    exitReason: 'target'
                });

            assert.strictEqual(response.status, 200);
            assert.ok(response.body.success);
        });
    });
});
```

#### Frontend Tests

```javascript
/**
 * Frontend Unit Tests
 * File: tests/frontend.test.js
 */

describe('Frontend Module Tests', () => {

    describe('Capital Display', () => {
        it('should calculate available capital correctly', () => {
            const capital = {
                initial: 500000,
                realizedPL: 25000,
                allocated: 200000
            };

            const available = capital.initial + capital.realizedPL - capital.allocated;
            assert.strictEqual(available, 325000);
        });

        it('should format currency correctly', () => {
            const formatted = formatCurrency(50000, 'india');
            assert.strictEqual(formatted, '₹50,000');
        });
    });

    describe('Trade Management', () => {
        it('should filter trades by market', () => {
            const trades = [
                { symbol: 'RELIANCE.NS', status: 'active' },
                { symbol: 'AAPL', status: 'active' },
                { symbol: 'BP.L', status: 'active' }
            ];

            const filtered = TradeManagement.filterTrades(trades, { market: 'india' });
            assert.strictEqual(filtered.length, 1);
            assert.ok(filtered[0].symbol.includes('.NS'));
        });
    });

    describe('Performance Analytics', () => {
        it('should calculate win rate correctly', () => {
            const trades = [
                { profitLossPercent: 5.2, status: 'closed' },
                { profitLossPercent: -3.1, status: 'closed' },
                { profitLossPercent: 8.5, status: 'closed' },
                { profitLossPercent: -2.5, status: 'closed' }
            ];

            const stats = PerformanceAnalytics.calculateStats(trades);
            assert.strictEqual(stats.winRate, '50.0');
        });
    });
});
```

### 7.2 Performance Testing

#### Load Testing Script

```javascript
/**
 * Load Testing
 * File: tests/load-test.js
 */

const { performance } = require('perf_hooks');

async function testSignalScanPerformance() {
    console.log('Testing signal scan performance...');

    const start = performance.now();

    // Simulate scanning 2000 stocks
    const scanner = require('../lib/scanner/scanner');
    await scanner.runHighConvictionScan();

    const duration = performance.now() - start;
    console.log(`Signal scan completed in ${duration}ms`);

    assert.ok(duration < 300000, 'Scan should complete in under 5 minutes');
}

async function testCapitalCalculationPerformance() {
    console.log('Testing capital calculation performance...');

    const start = performance.now();

    // Test capital calculation with 30 positions
    const CapitalManager = require('../lib/portfolio/capital-manager');
    await CapitalManager.calculateAllCapital(1);

    const duration = performance.now() - start;
    console.log(`Capital calculation completed in ${duration}ms`);

    assert.ok(duration < 100, 'Capital calc should complete in under 100ms');
}

async function testExitCheckPerformance() {
    console.log('Testing exit check performance...');

    const start = performance.now();

    // Test exit check for 30 positions
    const ExitMonitor = require('../lib/portfolio/exit-monitor');
    await ExitMonitor.checkAllExits();

    const duration = performance.now() - start;
    console.log(`Exit check completed in ${duration}ms`);

    assert.ok(duration < 5000, 'Exit check should complete in under 5 seconds');
}

// Run all performance tests
(async () => {
    await testSignalScanPerformance();
    await testCapitalCalculationPerformance();
    await testExitCheckPerformance();
    console.log('All performance tests passed!');
})();
```

### 7.3 Manual Testing Checklist

#### Phase 1: Database & API
- [ ] Database schema created successfully
- [ ] All tables have proper indexes
- [ ] Unique constraints working
- [ ] Foreign keys enforcing relationships
- [ ] All API endpoints responding
- [ ] Error handling working correctly
- [ ] Authentication working

#### Phase 2: Capital Tracking
- [ ] Initial capital sets correctly
- [ ] Capital allocates on trade entry
- [ ] Capital releases on trade exit
- [ ] P/L compounds correctly
- [ ] Multi-market tracking accurate
- [ ] Position limits enforced
- [ ] UI displays update in real-time

#### Phase 3: Signal Integration
- [ ] 7 AM scan runs automatically
- [ ] Signals stored in database
- [ ] Duplicates prevented
- [ ] Signals display on page
- [ ] Add signal creates trade
- [ ] Dismiss signal updates status
- [ ] Old signals cleaned up
- [ ] UI responsive and intuitive

#### Phase 4: Telegram Alerts
- [ ] Exit monitor runs every 5 minutes
- [ ] Target alerts sent correctly
- [ ] Stop loss alerts sent correctly
- [ ] Manual exit alerts sent
- [ ] High conviction alerts sent
- [ ] No duplicate alerts
- [ ] Alert formatting correct
- [ ] Broadcasts to all subscribers

#### Phase 5: Trade Management
- [ ] Trade editing works
- [ ] Bulk actions functional
- [ ] Notes and tags save correctly
- [ ] Performance analytics accurate
- [ ] CSV export working
- [ ] Filters work correctly
- [ ] All calculations verified

#### Phase 6: User Settings
- [ ] Settings page loads
- [ ] All settings save correctly
- [ ] Validation working
- [ ] Reset to defaults works
- [ ] Settings apply to system
- [ ] Multi-user settings isolated

#### Phase 7: Overall System
- [ ] All cron jobs running
- [ ] No memory leaks
- [ ] Error logging working
- [ ] UI responsive
- [ ] Cross-browser compatible
- [ ] Mobile friendly
- [ ] Security audit passed

### 7.4 Bug Tracking Template

Create `BUGS.md`:

```markdown
# Known Issues and Bugs

## Critical (P0)
- [ ] None

## High Priority (P1)
- [ ] None

## Medium Priority (P2)
- [ ] None

## Low Priority (P3)
- [ ] None

## Fixed
- [x] Example: Capital not releasing on trade exit (Fixed: 2025-01-15)

## Issue Template

### Bug Title
**Priority**: P1
**Component**: Capital Management
**Description**: Clear description of the bug
**Steps to Reproduce**:
1. Step 1
2. Step 2
3. Step 3

**Expected**: What should happen
**Actual**: What actually happens
**Fix**: How it was resolved (if fixed)
```

### 7.5 Deployment Checklist

#### Pre-Deployment
- [ ] All tests passing
- [ ] Code reviewed
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] API keys validated
- [ ] Telegram bot tested
- [ ] Backup strategy in place

#### Deployment Steps
1. [ ] Backup current database
2. [ ] Stop cron jobs
3. [ ] Deploy new code
4. [ ] Run database migrations
5. [ ] Test basic functionality
6. [ ] Restart cron jobs
7. [ ] Monitor logs for errors
8. [ ] Verify alerts working
9. [ ] Test with real data

#### Post-Deployment
- [ ] Monitor system for 24 hours
- [ ] Check all cron jobs executed
- [ ] Verify Telegram alerts sent
- [ ] Review error logs
- [ ] User acceptance testing
- [ ] Document any issues
- [ ] Create rollback plan if needed

### 7.6 Monitoring and Maintenance

#### Daily Checks
- Check 7 AM scan completed
- Verify signals stored correctly
- Check exit monitor running
- Review Telegram alert delivery
- Monitor API errors
- Check database size

#### Weekly Checks
- Review performance metrics
- Analyze trade statistics
- Check capital calculations
- Review duplicate signal prevention
- Database optimization
- Log rotation

#### Monthly Checks
- Full system audit
- Performance review
- User feedback review
- Feature requests evaluation
- Security audit
- Backup restoration test

### Phase 7 Deliverables

- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Performance tests passing
- [ ] Manual testing completed
- [ ] Bug tracking system in place
- [ ] Deployment checklist followed
- [ ] Monitoring system active
- [ ] Documentation complete

---

## Technical Specifications

### System Requirements
- **Node.js**: >= 16.x
- **Database**: PostgreSQL 13+ or SQLite 3.35+
- **Memory**: 512MB minimum, 1GB recommended
- **Storage**: 100MB for database, 50MB for logs
- **Network**: Stable connection for Yahoo Finance API and Telegram

### API Rate Limits
- **Yahoo Finance**: 2000 requests/hour (500/hour per market recommended)
- **Telegram Bot**: 30 messages/second, 20 messages/minute to same chat
- **Internal APIs**: No hard limit, recommend max 100 req/sec

### Performance Targets
- **Signal scan**: < 5 minutes for 2000 stocks across all markets
- **Capital calculation**: < 100ms for 30 positions
- **Exit check**: < 5 seconds for 30 positions
- **UI render**: < 500ms initial load, < 200ms updates
- **Database queries**: < 50ms for simple queries, < 500ms for complex

### Security Considerations
- **Authentication**: JWT tokens with 24-hour expiration
- **API protection**: All endpoints require authentication except login/register
- **Database constraints**: Prevent duplicate signals and invalid states
- **Position limits**: Enforced at database level with CHECK constraints
- **Telegram validation**: Chat ID must match registered user
- **Input validation**: All user inputs sanitized and validated
- **SQL injection**: Parameterized queries only
- **XSS protection**: Content Security Policy headers

### Error Handling Strategy
- **API errors**: Return appropriate HTTP status codes with error messages
- **Database errors**: Rollback transactions, log errors, return user-friendly messages
- **External API failures**: Retry logic with exponential backoff
- **Telegram failures**: Queue messages for retry, log failures
- **Cron job failures**: Log errors, send admin alert, continue next execution

### Logging Strategy
- **Application logs**: `/logs/app.log` - General application events
- **Error logs**: `/logs/error.log` - All errors and exceptions
- **Trade logs**: `/logs/trades.log` - All trade operations
- **Alert logs**: `/logs/alerts.log` - Telegram alert delivery
- **Scanner logs**: `/logs/scanner.log` - Signal scan operations
- **Rotation**: Daily rotation, keep 30 days

---

## Appendices

### A. Database Helper Functions

Complete list of database methods needed in `database-postgres.js`:

```javascript
// Pending Signals
async storePendingSignal(signal) { }
async getPendingSignal(symbol, date) { }
async getPendingSignals(userId, filters) { }
async updateSignalStatus(signalId, status) { }
async cleanupOldSignals() { }
async checkSignalExists(symbol, date) { }

// Portfolio Capital
async getPortfolioCapital(userId, market) { }
async updatePortfolioCapital(userId, market, updates) { }
async allocateCapital(userId, market, amount) { }
async releaseCapital(userId, market, amount, profitLoss) { }
async initializeCapital(userId, initialCapital) { }

// Trades
async createTradeFromSignal(userId, signal) { }
async getTrade(tradeId) { }
async getActiveTrades(userId, market) { }
async getAllTrades(userId, filters) { }
async updateTrade(tradeId, updates) { }
async closeTrade(tradeId, exitData) { }
async checkActiveTradeExists(userId, symbol) { }
async canAddPosition(userId, market) { }

// Trade Exit Checks
async recordExitCheck(tradeId, checkResult) { }
async getLastExitCheck(tradeId, checkType) { }
async getTradeExitHistory(tradeId) { }

// User Settings
async getUserSetting(userId, key) { }
async getAllUserSettings(userId) { }
async updateUserSetting(userId, key, value) { }
async deleteUserSetting(userId, key) { }

// Trade Notes
async addTradeNote(tradeId, note, tags) { }
async getTradeNotes(tradeId) { }
async deleteTradeNote(noteId) { }
```

### B. Environment Variables

Required `.env` configuration:

```bash
# Server
PORT=3000
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname
# OR for SQLite
DATABASE_PATH=./data/trades.db

# Authentication
JWT_SECRET=your-secure-random-string-here
JWT_EXPIRY=24h

# Telegram
TELEGRAM_BOT_TOKEN=your-bot-token-here
TELEGRAM_ADMIN_CHAT_ID=your-admin-chat-id

# Yahoo Finance API (optional)
YAHOO_API_KEY=your-api-key-if-using-premium

# Cron Jobs
CRON_SIGNAL_SCAN=0 7 * * *  # 7 AM daily
CRON_CLEANUP=0 5 * * *       # 5 AM daily
CRON_EXIT_CHECK=*/5 * * * *  # Every 5 minutes
CRON_PORTFOLIO_UPDATE=0 16 * * *  # 4 PM daily

# Capital Settings (defaults, can be overridden per user)
INITIAL_CAPITAL_INDIA=500000
INITIAL_CAPITAL_UK=4000
INITIAL_CAPITAL_US=5000

# Position Limits
MAX_POSITIONS_TOTAL=30
MAX_POSITIONS_PER_MARKET=10

# Trading Parameters
DEFAULT_STOP_LOSS_PERCENT=5
DEFAULT_TARGET_PERCENT=8
MIN_DTI_THRESHOLD=-40

# Performance
LOG_LEVEL=info
LOG_RETENTION_DAYS=30
```

### C. API Quick Reference

#### Authentication
```
POST /api/auth/login
POST /api/auth/register
GET  /api/auth/validate
```

#### Signals
```
GET    /api/signals/pending          # Get all pending signals
POST   /api/signals/add              # Add signal as trade
POST   /api/signals/dismiss          # Dismiss signal
POST   /api/signals/store            # Store new signals (internal)
GET    /api/signals/check-duplicate  # Check if signal exists
```

#### Capital
```
GET  /api/capital                    # Get all capital info
GET  /api/capital/:market            # Get specific market capital
POST /api/capital/allocate           # Allocate capital (internal)
POST /api/capital/release            # Release capital (internal)
```

#### Trades
```
GET    /api/trades                   # Get all trades
GET    /api/trades/:id               # Get specific trade
POST   /api/trades                   # Create new trade
PATCH  /api/trades/:id               # Update trade
POST   /api/trades/close             # Close trade
DELETE /api/trades/:id               # Delete trade
GET    /api/trades/history           # Get trade history
POST   /api/trades/:id/notes         # Add note to trade
GET    /api/trades/check-active      # Check if trade exists
```

#### Alerts
```
POST /api/alerts/broadcast           # Broadcast alert to subscribers
GET  /api/alerts/preferences         # Get user alert preferences
POST /api/alerts/send-custom         # Send custom alert
```

#### Settings
```
GET  /api/settings                   # Get all settings
PUT  /api/settings                   # Update settings
POST /api/settings/reset             # Reset to defaults
```

### D. UI Component Integration Guide

#### Adding Signal Display to trades.html

```html
<!-- Add in <head> -->
<script src="/js/signals-display.js"></script>

<!-- Add in <body> before trade list -->
<div id="signals-container"></div>

<!-- Add initialization script -->
<script>
    document.addEventListener('DOMContentLoaded', () => {
        SignalsDisplay.initializeSignalsDisplay();
        // Refresh every 5 minutes
        setInterval(() => {
            SignalsDisplay.loadPendingSignals();
        }, 5 * 60 * 1000);
    });
</script>
```

#### Adding Capital Display to trades.html

```html
<!-- Add in <head> -->
<script src="/js/capital-display.js"></script>

<!-- Add in <body> at top -->
<div id="capital-display-container"></div>

<!-- Add initialization script -->
<script>
    document.addEventListener('DOMContentLoaded', () => {
        CapitalDisplay.initializeCapitalDisplay();
    });
</script>
```

#### Adding Performance Analytics

```html
<!-- Add in <head> -->
<script src="/js/performance-analytics.js"></script>

<!-- Add in <body> -->
<div id="performance-analytics"></div>

<!-- Add initialization script -->
<script>
    document.addEventListener('DOMContentLoaded', async () => {
        const trades = await TradeAPI.getAllTrades();
        PerformanceAnalytics.displayAnalytics(trades);
    });
</script>
```

### E. Cron Job Setup Guide

#### Using node-cron

Install dependency:
```bash
npm install node-cron
```

Add to `server.js`:

```javascript
const cron = require('node-cron');
const scanner = require('./lib/scanner/scanner');
const ExitMonitor = require('./lib/portfolio/exit-monitor');
const db = require('./lib/db/database-postgres');

// 7 AM Signal Scan (UK time)
cron.schedule('0 7 * * *', async () => {
    console.log('Running 7 AM signal scan...');
    try {
        await scanner.runHighConvictionScan();
        console.log('Signal scan completed');
    } catch (error) {
        console.error('Signal scan failed:', error);
    }
}, {
    timezone: "Europe/London"
});

// 5 AM Cleanup (UK time)
cron.schedule('0 5 * * *', async () => {
    console.log('Running signal cleanup...');
    try {
        await db.cleanupOldSignals();
        console.log('Cleanup completed');
    } catch (error) {
        console.error('Cleanup failed:', error);
    }
}, {
    timezone: "Europe/London"
});

// Every 5 minutes: Exit checks (8 AM - 9 PM UK time)
cron.schedule('*/5 8-21 * * *', async () => {
    console.log('Running exit checks...');
    try {
        await ExitMonitor.checkAllExits();
        console.log('Exit checks completed');
    } catch (error) {
        console.error('Exit checks failed:', error);
    }
}, {
    timezone: "Europe/London"
});

// 4 PM Portfolio update
cron.schedule('0 16 * * *', async () => {
    console.log('Running portfolio update...');
    try {
        // Update current prices for all active trades
        const trades = await db.getAllActiveTrades();
        for (const trade of trades) {
            const price = await fetchCurrentPrice(trade.symbol);
            if (price) {
                await db.updateTrade(trade.id, { currentPrice: price });
            }
        }
        console.log('Portfolio update completed');
    } catch (error) {
        console.error('Portfolio update failed:', error);
    }
}, {
    timezone: "Europe/London"
});
```

### F. Deployment Script

Create `deploy.sh`:

```bash
#!/bin/bash

echo "=== SutrAlgo Trading Signals Deployment ==="

# Step 1: Backup database
echo "1. Backing up database..."
timestamp=$(date +%Y%m%d_%H%M%S)
if [ -f "./data/trades.db" ]; then
    cp ./data/trades.db ./data/backups/trades_${timestamp}.db
    echo "✓ Database backed up"
fi

# Step 2: Pull latest code
echo "2. Pulling latest code..."
git pull origin main
echo "✓ Code updated"

# Step 3: Install dependencies
echo "3. Installing dependencies..."
npm install --production
echo "✓ Dependencies installed"

# Step 4: Run database migrations
echo "4. Running database migrations..."
node scripts/migrate.js
echo "✓ Migrations completed"

# Step 5: Build frontend (if applicable)
echo "5. Building frontend..."
# Add build commands if needed
echo "✓ Frontend built"

# Step 6: Restart application
echo "6. Restarting application..."
pm2 restart sutralgo
echo "✓ Application restarted"

# Step 7: Verify deployment
echo "7. Verifying deployment..."
sleep 5
pm2 status sutralgo
echo "✓ Verification complete"

echo ""
echo "=== Deployment Complete ==="
echo "Monitor logs with: pm2 logs sutralgo"
```

Make it executable:
```bash
chmod +x deploy.sh
```

#### PM2 Ecosystem File

Create `ecosystem.config.js`:

```javascript
module.exports = {
    apps: [{
        name: 'sutralgo',
        script: './server.js',
        instances: 1,
        exec_mode: 'fork',
        watch: false,
        max_memory_restart: '500M',
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        error_file: './logs/pm2-error.log',
        out_file: './logs/pm2-out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,
        cron_restart: '0 3 * * *' // Restart at 3 AM daily
    }]
};
```

Start with:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## Migration Guide

### From Current System to Phase 1

1. **Backup existing data**
   ```bash
   cp data/trades.db data/trades_backup_$(date +%Y%m%d).db
   ```

2. **Run Phase 1 migration**
   ```bash
   node scripts/phase1-migration.js
   ```

3. **Verify tables created**
   ```bash
   sqlite3 data/trades.db ".tables"
   ```

4. **Test API endpoints**
   ```bash
   curl http://localhost:3000/api/signals/pending
   ```

### Between Phases

Each phase builds on the previous, so:
- Complete all deliverables before moving to next phase
- Run tests after each phase
- Backup database before starting new phase
- Keep old code in git branches for rollback

---

## Troubleshooting Guide

### Common Issues

#### Duplicate Signals Still Appearing
**Cause**: Database unique constraint not created
**Fix**: Run migration again, check database schema

#### Capital Not Updating
**Cause**: Transaction not committing or capital manager not called
**Fix**: Check logs, ensure releaseFromTrade() called on trade close

#### Telegram Alerts Not Sending
**Cause**: Bot token invalid or chat ID wrong
**Fix**: Verify TELEGRAM_BOT_TOKEN in .env, check chat ID

#### Exit Checks Not Running
**Cause**: Cron job not initialized or wrong timezone
**Fix**: Check server.js has cron.schedule(), verify timezone setting

#### Signals Not Appearing After 7 AM
**Cause**: Scanner not storing to database
**Fix**: Verify storeSignalsWithDeduplication() called in scanner.js

### Debug Mode

Enable debug logging:
```javascript
// Add to server.js
if (process.env.DEBUG_MODE === 'true') {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.path}`, req.body);
        next();
    });
}
```

Set in `.env`:
```bash
DEBUG_MODE=true
```

---

## Performance Optimization Tips

### Database Optimization
- Create indexes on frequently queried columns
- Use connection pooling for PostgreSQL
- Implement query result caching for static data
- Regular VACUUM for SQLite

### API Optimization
- Implement response caching for expensive queries
- Use pagination for large result sets
- Batch API calls where possible
- Implement rate limiting

### Frontend Optimization
- Lazy load components
- Implement virtual scrolling for long lists
- Debounce real-time updates
- Cache API responses in sessionStorage

---

**Document Version**: 2.0
**Last Updated**: 2025-01-15
**Status**: Complete - Ready for Implementation
**Maintained By**: Development Team
**Next Review**: After each phase completion
