# Field Name Standardization Plan

**Date:** 2025-10-26
**Objective:** Standardize field naming across the codebase while maintaining dual convention (snake_case in DB, camelCase in JS)

---

## Phase 1: Identification of Issues

### Critical Inconsistencies Found

1. **user_id vs userId**
   - Database: `user_id VARCHAR(255)`
   - Mixed usage in JavaScript: sometimes `userId`, sometimes `user_id`
   - Files affected: server.js, admin routes, capital-manager.js

2. **current_market_price vs currentPrice**
   - Database: `current_market_price`
   - Partial transformation in database-postgres.js
   - Inconsistent usage in frontend

3. **unrealized_pl vs unrealizedPL**
   - Database: `unrealized_pl`
   - Partial transformation in database-postgres.js
   - Inconsistent usage in portfolio calculations

4. **Admin Panel Direct Queries**
   - Admin panel queries bypass transformation layer
   - Uses snake_case directly from database
   - Files: admin-signal-testing.js, admin routes

5. **Capital Manager Bug (Fixed but needs validation)**
   - Migration 018 documented realized_pl update failure
   - Field name mismatches in capital-manager.js:156-168
   - Fixed in commit f532ce4 but needs validation

### Transformation Layer Gaps

**File:** `/database-postgres.js`

**Current State:**
- Has transformations for most fields
- Missing consistent mappings for: user_id, current_market_price, unrealized_pl
- No validation/warnings for missing fields
- Admin queries don't use this layer

**Evidence from Analysis:**
- Trades table: 20+ fields require transformation
- User/subscription tables: 10+ fields require transformation
- Portfolio capital table: 8+ fields require transformation

---

## Phase 2: Plan to Resolve Issues

### Step 1: Strengthen database-postgres.js Transformation Layer

**Action Items:**
1. Create comprehensive field mapping constants
   - DB_TO_JS_FIELD_MAP (snake_case → camelCase)
   - JS_TO_DB_FIELD_MAP (camelCase → snake_case)

2. Add missing field mappings:
   - `user_id` ↔ `userId`
   - `current_market_price` ↔ `currentPrice`
   - `unrealized_pl` ↔ `unrealizedPL`
   - `unrealized_pl_percentage` ↔ `unrealizedPLPercentage`

3. Create utility transformation functions:
   - `transformDbRowToJs(row)` - Converts entire row object
   - `transformJsToDbFields(obj)` - Converts JS object to DB fields
   - Add field validation warnings

4. Add JSDoc documentation for all transformation functions

### Step 2: Standardize user_id Usage

**Decision:** Use `user_id` (snake_case) consistently in backend code, transform to `userId` only for frontend API responses

**Files to update:**
- server.js - Standardize to `user_id` in backend
- capital-manager.js - Use `user_id` consistently
- exit-monitor.js - Use `user_id` consistently
- All admin route files

### Step 3: Fix Admin Panel Queries

**Action Items:**
1. Update admin routes to use transformation layer
2. Ensure admin-signal-testing.js uses camelCase data
3. Update admin-*.js files to expect camelCase from API

### Step 4: Validate Capital Manager & Exit Monitor

**Action Items:**
1. Review capital-manager.js:156-168 (releaseFromTrade function)
2. Ensure consistent field access:
   - Use `trade.investmentAmount` (not `trade.investment_amount`)
   - Use `trade.profitLoss` (not `trade.profit_loss`)
   - Use `trade.profitLossPercentage` (not `trade.profit_loss_percentage`)
3. Review exit-monitor.js for similar patterns
4. Add defensive checks for both naming conventions during transition

### Step 5: Add Defensive Code & Documentation

**Action Items:**
1. Add helper functions to handle field name variations temporarily
2. Add console warnings when deprecated field names are used
3. Create comprehensive field mapping documentation as code comments
4. Add JSDoc comments to all transformation functions

### Step 6: Create Field Mapping Reference

**Action Items:**
1. Add detailed comments in database-postgres.js showing all mappings
2. Document the dual convention approach
3. Add examples of proper usage

---

## Phase 3: Testing the Resolved Issue

### Test 1: Transformation Layer Unit Tests

**Objective:** Verify all field transformations work correctly

**Steps:**
1. Create test data with all field combinations
2. Test DB → JS transformation
3. Test JS → DB transformation
4. Test round-trip transformation (DB → JS → DB)
5. Verify missing field handling

**Expected Result:** All fields transform correctly, warnings shown for missing fields

### Test 2: Integration Test - Trade Lifecycle

**Objective:** Test complete trade flow with field transformations

**Steps:**
1. Create a new trade via API (POST /api/trades)
2. Update the trade (PUT /api/trades/:id)
3. Update current price (trigger unrealized P/L calculation)
4. Close the trade (trigger realized P/L update in portfolio_capital)
5. Query the trade via API (GET /api/trades/:id)

**Expected Result:**
- All fields save correctly to database (snake_case)
- All fields return correctly from API (camelCase)
- Portfolio capital updates with correct realized_pl
- No field name mismatch errors in logs

### Test 3: Database Verification via Render MCP

**Objective:** Verify actual database field names and data

**Steps:**
1. Use `mcp__render__list_postgres_instances` to get database ID
2. Use `mcp__render__query_render_postgres` to query:
   - `SELECT * FROM trades LIMIT 1` - Verify column names
   - `SELECT * FROM portfolio_capital LIMIT 1` - Verify realized_pl field
   - Check for any NULL values in critical fields

**Expected Result:** All database columns use snake_case, data is populated correctly

### Test 4: Capital Management Validation

**Objective:** Verify portfolio capital updates work correctly

**Steps:**
1. Check initial portfolio_capital state
2. Close an active trade
3. Verify realized_pl updates correctly
4. Verify available_capital updates correctly
5. Check logs for any field name errors

**Expected Result:** Capital management works without field name errors

### Test 5: Admin Panel Testing

**Objective:** Verify admin panel displays data correctly

**Steps:**
1. Access admin panel
2. Check signal testing page
3. Verify all fields display correctly (camelCase data from API)
4. Check console for any field name errors

**Expected Result:** Admin panel displays all data correctly

### Test 6: Deploy to Render & Monitor

**Objective:** Deploy changes and monitor in production

**Steps:**
1. Push changes to GitHub
2. Deploy to Render using MCP
3. Monitor deployment logs for errors
4. Use `mcp__render__list_logs` to check for field name errors
5. Monitor for 15-30 minutes during live trading hours

**Expected Result:**
- Deployment succeeds
- No field name errors in logs
- All API endpoints work correctly
- Trades update correctly

---

## Files Modified

### Primary Files:
- `/database-postgres.js` - Strengthen transformation layer
- `/lib/portfolio/capital-manager.js` - Validate field consistency
- `/lib/portfolio/exit-monitor.js` - Validate field consistency
- `/routes/admin.js` - Use transformation layer
- `/public/js/admin-signal-testing.js` - Expect camelCase data

### Supporting Files:
- Various admin-*.js files in `/public/js/`
- `/server.js` - Standardize user_id usage

---

## Success Criteria

✅ All fields have bidirectional mappings in transformation layer
✅ No field name mismatch errors in logs
✅ Trade lifecycle works end-to-end
✅ Portfolio capital updates correctly when trades close
✅ Admin panel displays data correctly
✅ Database queries return expected data
✅ Code includes comprehensive documentation

---

## Rollback Plan

If issues occur:
1. Revert changes via git
2. Redeploy previous version
3. Review logs to identify specific field causing issues
4. Fix incrementally

---

**Note:** This plan file will be deleted after Phase 3 is complete (as per CLAUDE.md instructions)
