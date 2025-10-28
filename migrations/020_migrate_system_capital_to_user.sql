-- Migration: 020 - Migrate System Capital to Per-User Capital
-- Description: Fix critical bug where all users share the same capital pool
--              Migrate 'system' capital to primary user and add NOT NULL constraint
-- Date: 2025-10-28
-- Priority: CRITICAL

-- Step 1: Verify current state
-- This should show 3 rows with user_id = 'system'
SELECT user_id, market, initial_capital, allocated_capital, available_capital, active_positions
FROM portfolio_capital
WHERE user_id = 'system';

-- Step 2: Migrate 'system' capital to primary user
-- Primary user: ketanjoshisahs@gmail.com (first user created, owner account)
UPDATE portfolio_capital
SET user_id = 'ketanjoshisahs@gmail.com'
WHERE user_id = 'system';

-- Step 3: Verify migration successful
-- This should show 3 rows with user_id = 'ketanjoshisahs@gmail.com'
SELECT user_id, market, initial_capital, allocated_capital, available_capital, active_positions
FROM portfolio_capital
WHERE user_id = 'ketanjoshisahs@gmail.com';

-- Step 4: Verify no 'system' records remain
-- This should return 0 rows
SELECT COUNT(*) as remaining_system_records
FROM portfolio_capital
WHERE user_id = 'system';

-- Step 5: Add NOT NULL constraint to user_id column
-- This prevents future 'system' or NULL user_id records
ALTER TABLE portfolio_capital
ALTER COLUMN user_id SET NOT NULL;

-- Step 6: Verify constraint added
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'portfolio_capital' AND column_name = 'user_id';

-- Step 7: Final verification - show all capital records
SELECT user_id, market, currency,
       initial_capital, allocated_capital, available_capital,
       active_positions, max_positions,
       updated_at
FROM portfolio_capital
ORDER BY user_id, market;

-- Migration complete!
-- Expected result:
-- - 3 rows for ketanjoshisahs@gmail.com (India, UK, US)
-- - 0 rows for 'system'
-- - user_id column is NOT NULL
-- - All capital amounts and allocations preserved
