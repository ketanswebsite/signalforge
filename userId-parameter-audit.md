# userId Parameter Audit - Potential Error Points

**Audit Date:** 2025-10-31
**Purpose:** Identify all locations where missing userId parameter could cause runtime errors
**Context:** Fixed bug in exit-monitor.js where missing userId caused Telegram alerts to fail

---

## Summary

**Total Issues Found:** 8
**Critical (Will Fail):** 6
**Non-Critical (Legacy/Optional):** 2

---

## Database Functions Requiring userId

These functions in `database-postgres.js` throw errors if userId is missing:

### 1. `getPortfolioCapital(market, userId)`
**Location:** database-postgres.js:2774
**Error if missing:** `"userId is required for getPortfolioCapital"`

### 2. `allocateCapital(market, amount, userId)`
**Location:** database-postgres.js:2837
**Error if missing:** `"userId is required for allocateCapital"`

### 3. `releaseCapital(market, allocatedAmount, plAmount, userId)`
**Location:** database-postgres.js:2861
**Error if missing:** `"userId is required for releaseCapital"`

### 4. `canAddPosition(market, requiredCapital, userId)`
**Location:** database-postgres.js:2886
**Error if missing:** `"userId is required for canAddPosition"`

---

## Capital Manager Functions Requiring userId

These functions in `lib/portfolio/capital-manager.js` require userId:

### 5. `releaseFromTrade(trade, userId)`
**Location:** capital-manager.js:169
**Calls:** `TradeDB.releaseCapital()` internally (which requires userId)

---

## Audit Results by File

### ✅ **server.js** - ALL CORRECT

| Line | Function Call | userId Passed? | Status |
|------|---------------|----------------|---------|
| 1250 | `getPortfolioCapital(null, ADMIN_EMAIL)` | ✅ Yes (ADMIN_EMAIL) | ✅ CORRECT |
| 2037 | `releaseFromTrade(existingTrade, userId)` | ✅ Yes | ✅ CORRECT |
| 2107 | `getPortfolioCapital(null, userId)` | ✅ Yes | ✅ CORRECT |
| 2120 | `getPortfolioCapital(null, userId)` | ✅ Yes | ✅ CORRECT |
| 2236 | `canAddPosition(market, tradeSize, userId)` | ✅ Yes | ✅ CORRECT |
| 2245 | `getPortfolioCapital(market, userId)` | ✅ Yes | ✅ CORRECT |
| 2270 | `allocateCapital(market, tradeSize, userId)` | ✅ Yes | ✅ CORRECT |
| 2276 | `getPortfolioCapital(market, userId)` | ✅ Yes | ✅ CORRECT |

**Result:** All server.js calls are passing userId correctly ✅

---

### ❌ **scripts/health-check.js** - NEEDS FIX

| Line | Function Call | userId Passed? | Status |
|------|---------------|----------------|---------|
| 234 | `getPortfolioCapital()` | ❌ No | ❌ **WILL FAIL** |

**Issue:** Health check calls `getPortfolioCapital()` without userId parameter
**Impact:** Health check will fail with error "userId is required for getPortfolioCapital"
**Fix Required:** Pass a valid userId (e.g., ADMIN_EMAIL or test user)

**Suggested Fix:**
```javascript
// BEFORE (Line 234):
const capital = await TradeDB.getPortfolioCapital();

// AFTER:
const HEALTH_CHECK_USER = process.env.ADMIN_EMAIL || 'ketanjoshisahs@gmail.com';
const capital = await TradeDB.getPortfolioCapital(null, HEALTH_CHECK_USER);
```

---

### ❌ **tests/database.test.js** - NEEDS FIX

| Line | Function Call | userId Passed? | Status |
|------|---------------|----------------|---------|
| 113 | `getPortfolioCapital()` | ❌ No | ❌ **WILL FAIL** |
| 127 | `canAddPosition('India', 50000)` | ❌ No | ❌ **WILL FAIL** |

**Issue:** Tests call functions without userId parameter
**Impact:** Tests will fail with userId required errors
**Fix Required:** Pass a test userId

**Suggested Fix:**
```javascript
// BEFORE (Line 113):
const capital = await TradeDB.getPortfolioCapital();

// AFTER:
const TEST_USER = 'test@example.com';
const capital = await TradeDB.getPortfolioCapital(null, TEST_USER);

// BEFORE (Line 127):
const canAdd = await TradeDB.canAddPosition('India', 50000);

// AFTER:
const canAdd = await TradeDB.canAddPosition('India', 50000, TEST_USER);
```

---

### ❌ **tests/performance.test.js** - NEEDS FIX

| Line | Function Call | userId Passed? | Status |
|------|---------------|----------------|---------|
| 24 | `getPortfolioCapital()` | ❌ No | ❌ **WILL FAIL** |
| 60 | `getPortfolioCapital()` | ❌ No | ❌ **WILL FAIL** |
| 95 | `getPortfolioCapital()` | ❌ No | ❌ **WILL FAIL** |
| 174 | `getPortfolioCapital()` | ❌ No | ❌ **WILL FAIL** |

**Issue:** Performance tests call getPortfolioCapital() without userId
**Impact:** All performance tests will fail
**Fix Required:** Pass a test userId

**Suggested Fix:**
```javascript
const TEST_USER = 'perf-test@example.com';

// Update all calls:
await TradeDB.getPortfolioCapital(null, TEST_USER);
```

---

### ✅ **lib/portfolio/exit-monitor.js** - FIXED

| Line | Function Call | userId Passed? | Status |
|------|---------------|----------------|---------|
| 288 | `releaseFromTrade(trade, userId)` | ✅ Yes | ✅ **FIXED** (commit 861792a) |

**Previous Issue:** Was calling `releaseFromTrade()` without userId
**Status:** Fixed in commit 861792a on 2025-10-31
**Result:** Now passing userId correctly ✅

---

### ✅ **lib/portfolio/capital-manager.js** - ALL CORRECT

| Line | Function Call | userId Passed? | Status |
|------|---------------|----------------|---------|
| 26 | `getPortfolioCapital(null, userId)` | ✅ Yes | ✅ CORRECT |
| 67 | `getPortfolioCapital(null, userId)` | ✅ Yes | ✅ CORRECT |
| 143 | `allocateCapital(market, size, userId)` | ✅ Yes | ✅ CORRECT |
| 196 | `releaseCapital(market, amt, pl, userId)` | ✅ Yes | ✅ CORRECT |

**Result:** All capital-manager.js calls are correct ✅

---

### ✅ **lib/scheduler/trade-executor.js** - CORRECT

| Line | Function Call | userId Passed? | Status |
|------|---------------|----------------|---------|
| 328 | `allocateCapital(market, size, userId)` | ✅ Yes | ✅ CORRECT |

**Result:** Trade executor passing userId correctly ✅

---

## Action Items

### Priority 1: Critical Fixes (Tests & Health Checks)

1. **Fix health-check.js (Line 234)**
   - Add userId parameter to `getPortfolioCapital()` call
   - Use ADMIN_EMAIL or a dedicated health check user

2. **Fix database.test.js (Lines 113, 127)**
   - Add TEST_USER constant
   - Pass userId to `getPortfolioCapital()` and `canAddPosition()`

3. **Fix performance.test.js (Lines 24, 60, 95, 174)**
   - Add TEST_USER constant
   - Pass userId to all `getPortfolioCapital()` calls

### Priority 2: Data Integrity Fix

4. **Fix India Market Position Count**
   - **Current State:** portfolio_capital shows active_positions = 10
   - **Actual State:** Only 9 active trades exist
   - **Cause:** JSWINFRA.NS closure failed to decrement counter (due to userId bug)
   - **Fix Options:**
     - Option A: Manual SQL update (requires write access)
     - Option B: Create migration script
     - Option C: Wait for next trade closure (will auto-correct)

   **Recommended:** Create migration script to safely update:
   ```sql
   UPDATE portfolio_capital
   SET active_positions = 9,
       allocated_capital = 400000
   WHERE market = 'India'
   AND user_id = 'ketanjoshisahs@gmail.com';
   ```

---

## Prevention Checklist

To prevent similar issues in the future:

- [ ] Always pass userId to capital management functions
- [ ] Update function signatures to make userId a required parameter (remove defaults)
- [ ] Add TypeScript/JSDoc type hints for better IDE support
- [ ] Add integration tests that verify userId is passed correctly
- [ ] Review all database function calls during code reviews
- [ ] Consider adding a linter rule to catch missing userId parameters

---

## Testing Verification

After fixes are applied, verify:

1. Run `npm test` - all tests should pass
2. Run health check script - should complete without userId errors
3. Trigger a stop loss - Telegram alert should be sent
4. Close any trade - position count should decrement correctly
5. Check portfolio capital API - should return correct position counts

---

## Related Issues

- **Original Bug:** exit-monitor.js missing userId (Fixed: commit 861792a)
- **Side Effect:** India position count stuck at 10 instead of 9
- **Impact:** Telegram alerts failed for JSWINFRA.NS stop loss

---

**Audit Completed:** 2025-10-31
**Next Review:** After fixes are deployed
