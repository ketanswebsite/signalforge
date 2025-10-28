# Capital Allocation Multi-User Isolation Fix Plan

**Created**: 2025-10-28
**Priority**: CRITICAL
**Issue**: Capital allocation is shared across all users instead of being isolated per user

---

## Phase 1: Identification of the Issue

### Root Cause
The application was designed as a single-user system using `'system'` as a sentinel value for `user_id`. All capital allocation operations default to this shared 'system' user, causing complete lack of data isolation between users.

### Impact Assessment

**Security Impact**: CRITICAL
- Data isolation failure - users can see and manipulate other users' capital
- Capital depletion - one user's trades consume shared capital, blocking others
- Position limits shared across ALL users (30 positions total, not per user)

**Business Impact**: CRITICAL
- Users see incorrect capital amounts
- Financial accuracy compromised
- Trust and data integrity completely broken

### Affected Code Locations

#### Database Layer (`database-postgres.js`)
- Line 218-226: Initialization with 'system' user
- Line 2485: `getPortfolioCapital()` - defaults to 'system'
- Line 2520: `updatePortfolioCapital()` - nullable userId
- Line 2539: `allocateCapital()` - defaults to 'system'
- Line 2558: `releaseCapital()` - defaults to 'system'
- Line 2578: `canAddPosition()` - defaults to 'system'

#### Capital Manager (`lib/portfolio/capital-manager.js`)
- Line 25: `getCapitalStatus()` - no userId parameter
- Line 65: `validateTradeEntry()` - no userId parameter
- Line 140: `allocateForTrade()` - no userId passed
- Line 192: `releaseFromTrade()` - no userId passed

#### Server Endpoints (`server.js`)
- Line 1999: GET `/api/portfolio/capital` - no userId passed
- Line 1982-1984: POST `/api/portfolio/initialize-capital` - no userId passed
- Line 2115-2155: POST `/api/signals/add-to-portfolio/:signalId` - no userId passed (3 locations)
- Line 164-173: `ensureUserInDatabase()` - doesn't initialize capital

#### Trade Executor (`lib/scheduler/trade-executor.js`)
- Line 267: No userId passed to `allocateCapital()`

### Current Behavior Example
1. User A (test@example.com) has 1M INR, makes 5 trades → allocates 250K INR
2. User B (another@example.com) logs in → sees 750K available (WRONG!)
3. User B makes 3 trades → allocates 150K from User A's pool (WRONG!)
4. User A now shows 600K available (WRONG!)
5. Both users share the same 30-position limit

---

## Phase 2: Plan to Resolve the Issue

### User Requirements (Confirmed)
✓ Assign existing 'system' capital to primary user account
✓ New users get standard amounts: 1M INR, 10K GBP, 15K USD
✓ Start fresh from now - no trade history recalculation

### 2.1 Database Migration Script

**File**: `migrations/013_migrate_system_capital_to_user.sql`

**Actions**:
1. Identify primary user email from environment or user input
2. Update 'system' rows to primary user email
3. Add NOT NULL constraint to user_id column
4. Verify no 'system' records remain

**SQL**:
```sql
-- Get primary user email (will be provided during migration)
-- UPDATE portfolio_capital SET user_id = '[PRIMARY_USER_EMAIL]' WHERE user_id = 'system';

-- Add NOT NULL constraint
ALTER TABLE portfolio_capital ALTER COLUMN user_id SET NOT NULL;

-- Verify
SELECT user_id, market, initial_capital, allocated_capital, available_capital
FROM portfolio_capital
ORDER BY user_id, market;
```

### 2.2 Database Layer Fixes (`database-postgres.js`)

**Function**: `getPortfolioCapital(market = null, userId = null)`
- **Change**: Make userId required, remove `|| 'system'` fallback
- **Before**: `const params = [userId || 'system'];`
- **After**:
  ```javascript
  if (!userId) {
    throw new Error('userId is required for getPortfolioCapital');
  }
  const params = [userId];
  ```

**Function**: `updatePortfolioCapital(market, currency, initialCapital, userId = null)`
- **Change**: Make userId required, add validation
- **After**:
  ```javascript
  if (!userId) {
    throw new Error('userId is required for updatePortfolioCapital');
  }
  const result = await pool.query(`...`, [userId, market, currency, initialCapital]);
  ```

**Function**: `allocateCapital(market, amount, userId = null)`
- **Change**: Make userId required, remove `|| 'system'` fallback
- **After**:
  ```javascript
  if (!userId) {
    throw new Error('userId is required for allocateCapital');
  }
  const result = await pool.query(`...`, [amount, market, userId]);
  ```

**Function**: `releaseCapital(market, allocatedAmount, plAmount, userId = null)`
- **Change**: Make userId required, remove `|| 'system'` fallback
- **After**:
  ```javascript
  if (!userId) {
    throw new Error('userId is required for releaseCapital');
  }
  const result = await pool.query(`...`, [allocatedAmount, plAmount, market, userId]);
  ```

**Function**: `canAddPosition(market, tradeSize, userId = null)`
- **Change**: Make userId required, remove `|| 'system'` fallback
- **After**:
  ```javascript
  if (!userId) {
    throw new Error('userId is required for canAddPosition');
  }
  const result = await pool.query(`...`, [userId, market, tradeSize]);
  ```

**Initialization** (Lines 218-226):
- **Change**: Remove 'system' user initialization
- **Rationale**: Capital now created per-user on signup

### 2.3 Capital Manager Fixes (`capital-manager.js`)

**Constructor/Class**: Add userId as instance property
- Option 1: Make CapitalManager user-specific (pass userId in constructor)
- Option 2: Pass userId to each method (simpler, chosen approach)

**Method**: `getCapitalStatus(userId)`
- **Change**: Accept userId parameter, pass to database call
- **After**: `const capital = await TradeDB.getPortfolioCapital(null, userId);`

**Method**: `validateTradeEntry(market, symbol, userId)`
- **Change**: Accept userId parameter, pass to all calls
- **After**:
  ```javascript
  const capital = await TradeDB.getPortfolioCapital(null, userId);
  const status = await this.getCapitalStatus(userId);
  ```

**Method**: `allocateForTrade(market, tradeSize, userId)` (around line 140)
- **Change**: Accept userId, pass to allocateCapital
- **After**: `await TradeDB.allocateCapital(market, validation.tradeSize, userId);`

**Method**: `releaseFromTrade(market, investmentAmount, plAmount, userId)` (around line 192)
- **Change**: Accept userId, pass to releaseCapital
- **After**: `await TradeDB.releaseCapital(market, investmentAmount, plAmount, userId);`

### 2.4 Server Endpoint Fixes (`server.js`)

**Endpoint**: GET `/api/portfolio/capital` (line 1997)
- **Change**: Pass `req.user.email` to database call
- **After**:
  ```javascript
  const userId = req.user.email;
  const capital = await TradeDB.getPortfolioCapital(null, userId);
  ```

**Endpoint**: POST `/api/portfolio/initialize-capital` (line 1972)
- **Change**: Pass `req.user.email` to all updatePortfolioCapital calls
- **After**:
  ```javascript
  const userId = req.user.email;
  await TradeDB.updatePortfolioCapital('India', 'INR', india, userId);
  await TradeDB.updatePortfolioCapital('UK', 'GBP', uk, userId);
  await TradeDB.updatePortfolioCapital('US', 'USD', us, userId);
  const capital = await TradeDB.getPortfolioCapital(null, userId);
  ```

**Endpoint**: POST `/api/signals/add-to-portfolio/:signalId` (line 2095)
- **Change**: Pass userId to all capital operations (3 locations)
- **After**:
  ```javascript
  const userId = req.user ? req.user.email : 'default';

  // Line ~2115
  const canAdd = await TradeDB.canAddPosition(selectedSignal.market, tradeSize, userId);

  // Line ~2124
  const capitalBefore = await TradeDB.getPortfolioCapital(selectedSignal.market, userId);

  // Line ~2149
  await TradeDB.allocateCapital(selectedSignal.market, tradeSize, userId);

  // Line ~2155
  const capitalAfter = await TradeDB.getPortfolioCapital(selectedSignal.market, userId);
  ```

**Function**: `ensureUserInDatabase()` (line 164)
- **Change**: Initialize capital for new users with standard amounts
- **After**:
  ```javascript
  if (result.rowCount === 0) {
    console.log('New user detected. Inserting into database...');
    await pool.query(
      'INSERT INTO users (email, name, created_at) VALUES ($1, $2, NOW())',
      [user.email, user.displayName || user.email]
    );

    // Initialize capital for new user
    console.log('Initializing capital for new user:', user.email);
    await TradeDB.updatePortfolioCapital('India', 'INR', 1000000, user.email);
    await TradeDB.updatePortfolioCapital('UK', 'GBP', 10000, user.email);
    await TradeDB.updatePortfolioCapital('US', 'USD', 15000, user.email);
    console.log('Capital initialized for new user');
  }
  ```

### 2.5 Trade Executor Fix (`trade-executor.js`)

**Location**: Line 267 (approx)
- **Change**: Pass userId to allocateCapital call
- **Note**: Need to ensure userId is available in trade executor context
- **Action**: Review trade executor to determine how to get userId from trade object

### 2.6 Additional Considerations

**Error Handling**: All functions now throw errors if userId is missing
- Ensures no silent fallback to shared capital
- Forces proper userId propagation throughout the stack

**Backward Compatibility**: BREAKING CHANGE
- All existing code must pass userId
- No gradual migration possible
- All changes must be deployed together

**Testing Strategy**: Multi-user isolation verification required

---

## Phase 3: Testing the Resolved Issue

### 3.1 Database Migration Verification

**Test Steps**:
1. Connect to Render Postgres database
2. Run migration script with primary user email
3. Query `portfolio_capital` table to verify:
   - All 'system' rows updated to user email
   - user_id column is NOT NULL
   - Capital amounts preserved correctly

**SQL Verification**:
```sql
-- Check no 'system' records remain
SELECT * FROM portfolio_capital WHERE user_id = 'system';
-- Should return 0 rows

-- Check primary user capital
SELECT * FROM portfolio_capital WHERE user_id = '[PRIMARY_USER_EMAIL]';
-- Should return 3 rows (India, UK, US)

-- Check column constraint
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'portfolio_capital' AND column_name = 'user_id';
-- is_nullable should be 'NO'
```

### 3.2 Multi-User Capital Isolation Tests

**Test Scenario 1: Existing User**
1. Login as primary user (email used in migration)
2. Navigate to account page
3. Verify capital shows:
   - India: 1M INR with current allocations
   - UK: 10K GBP with current allocations
   - US: 15K USD with current allocations
4. Make a test trade
5. Verify capital is allocated correctly

**Test Scenario 2: Second User (Different Email)**
1. Login as different user
2. Navigate to account page
3. Verify capital shows:
   - India: 1M INR (fresh, unallocated)
   - UK: 10K GBP (fresh, unallocated)
   - US: 15K USD (fresh, unallocated)
4. Make a test trade
5. Verify capital allocation is independent

**Test Scenario 3: Verify Isolation**
1. Have both users make trades simultaneously
2. Verify User A's allocations don't affect User B
3. Verify User B's allocations don't affect User A
4. Check database directly to confirm separate rows

### 3.3 New User Signup Test

**Test Steps**:
1. Create a new Google account (or use test account)
2. Login to application for first time
3. Verify user is created in database
4. Navigate to account page
5. Verify capital is automatically initialized:
   - India: 1,000,000 INR (available)
   - UK: 10,000 GBP (available)
   - US: 15,000 USD (available)
6. Make a test trade
7. Verify capital allocation works correctly

### 3.4 Existing Functionality Regression Tests

**Trade Execution**:
- Create signal
- Add to portfolio
- Verify capital allocated
- Close trade
- Verify capital released
- Verify P&L calculated correctly

**Capital Management**:
- Initialize/update capital amounts
- Verify changes persist per user
- Verify other users unaffected

**Position Limits**:
- Test each user can have up to 30 positions
- Verify limits are per-user, not global
- Test position limit validation

**Capital Display**:
- Verify account page shows correct amounts
- Verify allocation percentages correct
- Verify utilization metrics accurate

### 3.5 Database Integrity Checks

**Run on Render Database**:
```sql
-- Verify all users have capital records
SELECT u.email,
       COUNT(DISTINCT pc.market) as market_count,
       SUM(pc.initial_capital) as total_initial,
       SUM(pc.allocated_capital) as total_allocated
FROM users u
LEFT JOIN portfolio_capital pc ON u.email = pc.user_id
GROUP BY u.email;

-- Verify no NULL user_ids
SELECT COUNT(*) FROM portfolio_capital WHERE user_id IS NULL;
-- Should return 0

-- Verify no 'system' records
SELECT COUNT(*) FROM portfolio_capital WHERE user_id = 'system';
-- Should return 0

-- Check data consistency
SELECT user_id, market,
       initial_capital,
       allocated_capital,
       available_capital,
       (initial_capital + realized_pl - allocated_capital) as calculated_available
FROM portfolio_capital
WHERE ABS(available_capital - (initial_capital + realized_pl - allocated_capital)) > 0.01;
-- Should return 0 rows (all capital calculations match)
```

### 3.6 Error Handling Tests

**Test Missing userId**:
- Temporarily remove userId from API call
- Verify server returns proper error
- Verify operation fails safely (no 'system' fallback)

**Test Invalid userId**:
- Pass non-existent user email
- Verify appropriate error handling
- Verify no data corruption

---

## Success Criteria

✅ Migration completes without errors
✅ No 'system' records remain in database
✅ user_id column is NOT NULL
✅ Primary user can see and manage their capital
✅ Second user has independent capital pool
✅ New users automatically get initialized capital
✅ All trades allocate/release capital correctly per user
✅ Position limits work independently per user
✅ No user can see or affect another user's capital
✅ Database integrity checks pass
✅ All regression tests pass

---

## Rollback Plan

If issues arise:

1. **Immediate**: Revert code deployment
2. **Database**: Restore from backup if data corruption occurs
3. **Migration**: Keep backup of 'system' capital values
4. **Users**: Communicate any temporary service interruption

**Note**: This is a breaking change with no gradual migration path. All changes must work together.

---

## Post-Deployment Monitoring

1. Monitor Render logs for any userId-related errors
2. Check database for any new 'system' records (should be none)
3. Monitor user reports of capital discrepancies
4. Verify capital totals match expected values
5. Check trade execution success rates

---

## Files to Modify

1. `migrations/013_migrate_system_capital_to_user.sql` - NEW FILE
2. `database-postgres.js` - ~40 lines modified (5 functions)
3. `lib/portfolio/capital-manager.js` - ~15 lines modified (4 methods)
4. `server.js` - ~25 lines modified (4 endpoints + user onboarding)
5. `lib/scheduler/trade-executor.js` - ~5 lines modified (1 call)

**Total**: ~85 lines modified across 5 files

---

**CRITICAL**: This fix resolves a fundamental security and data integrity issue that completely breaks multi-user functionality. It must be deployed as soon as possible to prevent continued data corruption and user confusion.
