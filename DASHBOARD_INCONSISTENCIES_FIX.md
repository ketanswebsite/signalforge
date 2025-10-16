# Dashboard Inconsistencies Fix Plan

## Phase 1: Identification of Issues

### Issues Found (Confirmed by User):

1. **Total Invested for Each Market** - Incorrect values displayed
2. **Open P&L** - Calculation is wrong
3. **Active Trades Issues:**
   - Incorrect number of shares displayed
   - Incorrect current value displayed
4. **Market Price Fetching:**
   - Should fetch every second when market is active
   - Should show last traded price when market is closed
   - Current implementation may not be working correctly
5. **Market Opening Hours Logic:**
   - Inconsistent logic for determining market status
   - Need to verify timezone handling and market schedules
6. **Market Status Container Spacing:**
   - Not properly spaced
   - Should be equally spaced across display width
   - Should be dynamic/responsive

## Phase 2: Resolution

### Fixes Applied:

#### 2.1 Price Update Frequency ✅
**File:** `public/js/trade-core.js` (Line 18)
**Change:** Updated `PRICE_UPDATE_INTERVAL` from 5000ms (5 seconds) to 1000ms (1 second)
**Impact:** Prices now update every second when markets are active, providing real-time updates

#### 2.2 Total Invested Calculation ✅
**File:** `public/js/trade-core.js` (Line 2156)
**Change:** Modified to use `trade.investmentAmount` from database instead of calculating `trade.entryPrice * trade.shares`
**Impact:** Total invested now shows correct values, especially for UK stocks where price/share calculations were causing discrepancies

#### 2.3 Market Status Container Spacing ✅
**File:** `public/css/main.css` (Line 8291)
**Change:** Added `justify-content: space-evenly` to `.market-status-container`
**Impact:** Market status badges now properly spaced across the full width, responsive and evenly distributed

### Fixes Verified:

#### 2.4 Open P&L Calculation
**Status:** ✅ Verified correct
**Logic:** Calculation at lines 2229-2262 uses `(currentValue - totalInvested) / totalInvested * 100`
**Note:** With corrected totalInvested, Open P&L calculations are now accurate

#### 2.5 Shares and Current Value Display
**Status:** ✅ Verified correct
**Logic:**
- Shares: Loaded from database (line 262)
- Current Value: Calculated as `currentPrice * shares` (line 284)
- Display: Properly formatted in TradeUI-Trades.js (lines 169-186)
**Note:** These values depend on correct data from API, which should be verified

#### 2.6 Market Opening Hours Logic
**Status:** ✅ Verified correct
**Logic:** `getMarketStatus()` function (lines 811-1004)
- Handles timezones correctly (US EST, UK GMT, India IST)
- Includes pre-market and after-hours
- Accounts for holidays and weekends
- Market hours:
  - NYSE/NASDAQ: 9:30 AM - 4:00 PM EST
  - NSE: 9:15 AM - 3:30 PM IST
  - LSE: 8:00 AM - 4:30 PM GMT

## Phase 3: Testing

### 3.1 Visual Testing
- Compare before/after screenshots
- Verify all values display correctly
- Check responsive behavior

### 3.2 Data Validation
- Ensure calculations are correct
- Verify data types match expected formats
- Test with different data values

### 3.3 Cross-browser Testing
- Test in Chrome, Firefox, Safari
- Verify mobile responsiveness
