-- ========================================
-- Migration: 012 - Fix Portfolio Capital Duplicate Rows
-- Description: Clean up duplicate portfolio_capital rows caused by NULL user_id
--              and switch to using 'system' as sentinel value instead of NULL
-- Date: 2025-10-16
-- ========================================

BEGIN;

-- Step 1: Get the current state for each market (use the row with most recent activity)
-- We'll keep the row with the highest allocated_capital and active_positions
CREATE TEMP TABLE portfolio_capital_latest AS
SELECT DISTINCT ON (market)
  market,
  currency,
  initial_capital,
  realized_pl,
  allocated_capital,
  available_capital,
  active_positions,
  max_positions
FROM portfolio_capital
WHERE user_id IS NULL
ORDER BY market, active_positions DESC, allocated_capital DESC, id DESC;

-- Step 2: Delete ALL existing rows with NULL user_id
DELETE FROM portfolio_capital WHERE user_id IS NULL;

-- Step 3: Insert the cleaned data using 'system' as the user_id
INSERT INTO portfolio_capital (user_id, market, currency, initial_capital, realized_pl, allocated_capital, available_capital, active_positions, max_positions)
SELECT
  'system' as user_id,
  market,
  currency,
  initial_capital,
  realized_pl,
  allocated_capital,
  available_capital,
  active_positions,
  max_positions
FROM portfolio_capital_latest;

-- Step 4: Update the UNIQUE constraint to handle the new 'system' user_id
-- (The existing UNIQUE constraint on (user_id, market) will now work properly)

-- Log the cleanup
DO $$
DECLARE
    india_row RECORD;
    uk_row RECORD;
    us_row RECORD;
BEGIN
    SELECT * INTO india_row FROM portfolio_capital WHERE user_id = 'system' AND market = 'India';
    SELECT * INTO uk_row FROM portfolio_capital WHERE user_id = 'system' AND market = 'UK';
    SELECT * INTO us_row FROM portfolio_capital WHERE user_id = 'system' AND market = 'US';

    RAISE NOTICE '✅ Cleaned up portfolio_capital duplicates';
    RAISE NOTICE 'India: Initial=%, Allocated=%, Available=%, Positions=%',
      india_row.initial_capital, india_row.allocated_capital, india_row.available_capital, india_row.active_positions;
    RAISE NOTICE 'UK: Initial=%, Allocated=%, Available=%, Positions=%',
      uk_row.initial_capital, uk_row.allocated_capital, uk_row.available_capital, uk_row.active_positions;
    RAISE NOTICE 'US: Initial=%, Allocated=%, Available=%, Positions=%',
      us_row.initial_capital, us_row.allocated_capital, us_row.available_capital, us_row.active_positions;
END $$;

COMMIT;
