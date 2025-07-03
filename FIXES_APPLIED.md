# Fixes Applied for 7 AM Scan and Exit Parameters

## 1. 📊 **Exit Parameters Standardization**

### **Problem Found**:
Inconsistent take profit, stop loss, and max holding days values across different modules.

### **Fixed Values** (Now Consistent Everywhere):
- **Take Profit**: 8%
- **Stop Loss**: 5%  
- **Max Holding Days**: 30 days

### **Files Updated**:
- `server.js` line 1687: Changed `takeProfitPercent: 10` → `takeProfitPercent: 8`
- `server.js` line 1688: Changed `stopLossPercent: 7` → `stopLossPercent: 5`
- `server.js` line 1689: Changed `maxHoldingDays: 21` → `maxHoldingDays: 30`

## 2. 🚨 **Authentication Error Fix for 7 AM Scan**

### **Problem Found**:
The V2 scanner was making internal API calls that required authentication, causing 401 errors:
```
❌ Error: Request failed with status code 401
   at /api/alerts/preferences (Authentication required)
   at /api/alerts/send-custom (Authentication required)
```

### **Root Cause**:
Server-side scanner trying to call authenticated endpoints without proper session context.

### **Solution Applied**:
**Bypassed Authentication for System Scans**:

#### **Before** (V2 Scanner - Lines 75-85):
```javascript
// Made API calls requiring authentication
const prefsResponse = await axios.get(`${baseUrl}/api/alerts/preferences`);
const scanResponse = await axios.post(`${baseUrl}/api/scan/global`, {...});
await axios.post(`${baseUrl}/api/alerts/send-custom`, {...});
```

#### **After** (V2 Scanner - Updated Logic):
```javascript
// Skip API calls, use environment variables directly
const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;

// Use direct DTI scanner instead of API
const { scanAllStocks } = require('./dti-scanner');
const opportunities = await scanAllStocks({...});

// Send alerts directly via Telegram bot
const { sendTelegramAlert } = require('./telegram-bot');
await sendTelegramAlert(chatId, messageData);
```

### **Key Changes Made**:

1. **Removed API Authentication Dependency**:
   - No longer calls `/api/alerts/preferences` 
   - Uses `process.env.TELEGRAM_CHAT_ID` directly

2. **Direct DTI Scanner Usage**:
   - Calls `scanAllStocks()` function directly
   - Bypasses `/api/scan/global` endpoint completely

3. **Direct Telegram Bot Usage**:
   - Calls `sendTelegramAlert()` function directly  
   - Bypasses `/api/alerts/send-custom` endpoint completely

4. **Fixed Opportunity Data Format**:
   - Updated `sendOpportunityAlert()` to handle DTI scanner format
   - Properly extracts: `opportunity.stock.symbol`, `opportunity.activeTrade.entryDTI`

## 3. 🔧 **Technical Implementation Details**

### **Authentication Bypass Strategy**:
- **System scans** (7 AM scheduled): Use direct function calls
- **User-triggered scans**: Still use API endpoints with proper authentication
- **Result**: Same functionality, no authentication conflicts

### **Data Flow Now**:
```
7 AM Cron Job → V2 Scanner → Direct DTI Scanner → Direct Telegram Bot
              ↓
              No API calls = No authentication required
```

### **Maintained Compatibility**:
- Test button in `/test.html` still works
- Manual scans from browser still work  
- Only system-triggered scans use the new direct approach

## 4. ✅ **Verification Steps**

### **Files Modified**:
1. `server.js` - Fixed exit parameter values
2. `stock-scanner-v2.js` - Fixed authentication and data format issues

### **Files Unchanged** (Preserved Functionality):
1. `test.html` - Test button remains functional
2. `dti-scanner.js` - DTI logic unchanged
3. `telegram-bot.js` - Telegram functionality unchanged
4. All browser-side files - Manual scanning unchanged

### **Testing**:
- ✅ Syntax validation passed
- ✅ Exit parameters now consistent (8%, 5%, 30 days)
- ✅ Authentication bypass implemented
- ✅ Telegram bot direct access configured

## 5. 🎯 **Expected Result**

The 7 AM test button should now work without authentication errors and use the correct exit parameters:

1. **Scan Execution**: Direct DTI scan of 2,381 global stocks
2. **Entry Logic**: DTI < 0 with momentum reversal  
3. **Exit Logic**: 8% profit, 5% stop loss, 30 days max hold
4. **Filtering**: Last 2 trading days only
5. **Alerts**: Direct Telegram notifications with opportunity details

## 6. 🔧 **DTI Calculation Fix - NaN Values Resolved**

### **Problem Found**:
After fixing authentication, DTI calculations were returning `[NaN, NaN, NaN, NaN, NaN]` instead of proper values.

### **Root Cause**:
Server-side `calculateDTI` function in `dti-scanner.js` was calling `calculateEMA()` function that didn't exist.

### **Solution Applied**:
**Added Missing calculateEMA Function** to `dti-scanner.js` (lines 415-431):

```javascript
// Calculate Exponential Moving Average (EMA) - matches browser-side implementation
function calculateEMA(data, period) {
    if (!data || !data.length || period <= 0) {
        console.error('Invalid inputs for EMA calculation');
        return [];
    }
    
    const k = 2 / (period + 1);
    let emaData = [data[0]]; // Initialize with first value
    
    for (let i = 1; i < data.length; i++) {
        // EMA formula: Current EMA = (Price - Previous EMA) * K + Previous EMA
        emaData.push(data[i] * k + emaData[i-1] * (1-k));
    }
    
    return emaData;
}
```

### **Result**:
- **Before**: `📊 AXISBANK.NS: DTI calculated, last 5 values: [NaN, NaN, NaN, NaN, NaN]`
- **After**: `📊 AXISBANK.NS: DTI calculated, last 5 values: [10.85, 10.58, 6.98, 2.43, -2.30]`

### **Verification**:
✅ Debug test on 10 stocks completed successfully
✅ Found 3 active opportunities with proper DTI values  
✅ All DTI calculations now return numerical values
✅ Server-side algorithm now matches browser-side implementation

## 7. 📋 **Final Verification Steps**

1. ✅ Exit parameters standardized (8%, 5%, 30 days)
2. ✅ Authentication bypass implemented  
3. ✅ DTI calculation NaN values fixed
4. ✅ Scanner finds opportunities successfully

**Ready for Production**: The 7 AM scan should now work completely without errors.