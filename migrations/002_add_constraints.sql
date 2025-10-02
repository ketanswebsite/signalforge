-- ========================================
-- Migration: 002 - Add Data Integrity Constraints
-- Description: Add foreign keys and CHECK constraints to prevent data corruption
-- Impact: Prevents data corruption and orphaned records
-- Estimated Time: 15 minutes
-- Date: 2025-10-02
-- ========================================

-- BACKUP RECOMMENDATION:
-- Before running this migration, create a backup:
-- pg_dump -h your-host -U your-user -d your-database > backup_before_002.sql

-- WARNING: This migration may fail if there's existing invalid data
-- Run the validation queries below first to identify any issues

BEGIN;

-- ========================================
-- PRE-MIGRATION VALIDATION QUERIES
-- ========================================

-- Check for orphaned trades (trades with no matching user)
DO $$
DECLARE
    orphaned_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphaned_count
    FROM trades t
    LEFT JOIN users u ON t.user_id = u.email
    WHERE u.email IS NULL AND t.user_id != 'default';

    IF orphaned_count > 0 THEN
        RAISE WARNING '⚠️  Found % orphaned trades without matching users', orphaned_count;
        RAISE WARNING 'Run this query to see them: SELECT user_id, COUNT(*) FROM trades LEFT JOIN users ON trades.user_id = users.email WHERE users.email IS NULL GROUP BY user_id;';
    ELSE
        RAISE NOTICE '✅ No orphaned trades found';
    END IF;
END $$;

-- Check for invalid status values
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM trades
    WHERE status NOT IN ('active', 'closed') AND status IS NOT NULL;

    IF invalid_count > 0 THEN
        RAISE WARNING '⚠️  Found % trades with invalid status values', invalid_count;
        RAISE WARNING 'Run this query to see them: SELECT DISTINCT status, COUNT(*) FROM trades WHERE status NOT IN (''active'', ''closed'') GROUP BY status;';
    ELSE
        RAISE NOTICE '✅ No invalid status values found';
    END IF;
END $$;

-- Check for negative values
DO $$
DECLARE
    negative_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO negative_count
    FROM trades
    WHERE entry_price < 0 OR exit_price < 0 OR shares < 0 OR investment_amount < 0;

    IF negative_count > 0 THEN
        RAISE WARNING '⚠️  Found % trades with negative values', negative_count;
    ELSE
        RAISE NOTICE '✅ No negative values found';
    END IF;
END $$;

-- Check for invalid date logic (exit before entry)
DO $$
DECLARE
    invalid_date_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_date_count
    FROM trades
    WHERE exit_date IS NOT NULL AND entry_date IS NOT NULL AND exit_date < entry_date;

    IF invalid_date_count > 0 THEN
        RAISE WARNING '⚠️  Found % trades with exit_date before entry_date', invalid_date_count;
    ELSE
        RAISE NOTICE '✅ No invalid date logic found';
    END IF;
END $$;

-- ========================================
-- DATA CLEANUP (if needed)
-- ========================================

-- Fix any NULL status values to 'active' (assuming open positions)
UPDATE trades
SET status = 'active'
WHERE status IS NULL;

-- Fix any negative values (set to 0 or absolute value)
UPDATE trades
SET entry_price = ABS(entry_price)
WHERE entry_price < 0;

UPDATE trades
SET exit_price = ABS(exit_price)
WHERE exit_price < 0;

UPDATE trades
SET shares = ABS(shares)
WHERE shares < 0;

UPDATE trades
SET investment_amount = ABS(investment_amount)
WHERE investment_amount < 0;

-- ========================================
-- FORWARD MIGRATION - FOREIGN KEYS
-- ========================================

-- 1. Foreign key from trades to users
-- Note: 'default' user should exist, or we exclude it from constraint
ALTER TABLE trades DROP CONSTRAINT IF EXISTS fk_trades_user_email;
ALTER TABLE trades
ADD CONSTRAINT fk_trades_user_email
FOREIGN KEY (user_id)
REFERENCES users(email)
ON DELETE CASCADE
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_trades_user_email ON trades IS
'Ensures every trade belongs to a valid user, cascades on delete';

-- 2. Foreign key from alert_preferences to users
ALTER TABLE alert_preferences DROP CONSTRAINT IF EXISTS fk_alert_pref_user;
ALTER TABLE alert_preferences
ADD CONSTRAINT fk_alert_pref_user
FOREIGN KEY (user_id)
REFERENCES users(email)
ON DELETE CASCADE
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_alert_pref_user ON alert_preferences IS
'Ensures alert preferences belong to valid users';

-- ========================================
-- FORWARD MIGRATION - CHECK CONSTRAINTS
-- ========================================

-- 3. Status must be 'active' or 'closed'
ALTER TABLE trades DROP CONSTRAINT IF EXISTS chk_trades_status;
ALTER TABLE trades
ADD CONSTRAINT chk_trades_status
CHECK (status IN ('active', 'closed'));

COMMENT ON CONSTRAINT chk_trades_status ON trades IS
'Ensures status is either active or closed';

-- 4. Positive price values
ALTER TABLE trades DROP CONSTRAINT IF EXISTS chk_trades_positive_prices;
ALTER TABLE trades
ADD CONSTRAINT chk_trades_positive_prices
CHECK (
    (entry_price IS NULL OR entry_price >= 0) AND
    (exit_price IS NULL OR exit_price >= 0) AND
    (target_price IS NULL OR target_price >= 0)
);

COMMENT ON CONSTRAINT chk_trades_positive_prices ON trades IS
'Ensures all prices are non-negative';

-- 5. Positive quantity values
-- Note: quantity column will be dropped in migration 004, so we only check remaining columns
ALTER TABLE trades DROP CONSTRAINT IF EXISTS chk_trades_positive_quantities;
ALTER TABLE trades
ADD CONSTRAINT chk_trades_positive_quantities
CHECK (
    (shares IS NULL OR shares >= 0) AND
    (investment_amount IS NULL OR investment_amount >= 0) AND
    (position_size IS NULL OR position_size >= 0)
);

COMMENT ON CONSTRAINT chk_trades_positive_quantities ON trades IS
'Ensures all quantities and amounts are non-negative';

-- 6. Date logic: exit_date >= entry_date
ALTER TABLE trades DROP CONSTRAINT IF EXISTS chk_trades_date_logic;
ALTER TABLE trades
ADD CONSTRAINT chk_trades_date_logic
CHECK (
    exit_date IS NULL OR entry_date IS NULL OR exit_date >= entry_date
);

COMMENT ON CONSTRAINT chk_trades_date_logic ON trades IS
'Ensures exit date is not before entry date';

-- 7. Closed trades must have exit data
ALTER TABLE trades DROP CONSTRAINT IF EXISTS chk_trades_closed_has_exit;
ALTER TABLE trades
ADD CONSTRAINT chk_trades_closed_has_exit
CHECK (
    status != 'closed' OR (exit_date IS NOT NULL AND exit_price IS NOT NULL)
);

COMMENT ON CONSTRAINT chk_trades_closed_has_exit ON trades IS
'Ensures closed trades have exit date and price';

-- 8. High conviction portfolio status
ALTER TABLE high_conviction_portfolio DROP CONSTRAINT IF EXISTS chk_hcp_status;
ALTER TABLE high_conviction_portfolio
ADD CONSTRAINT chk_hcp_status
CHECK (status IN ('active', 'closed'));

COMMENT ON CONSTRAINT chk_hcp_status ON high_conviction_portfolio IS
'Ensures portfolio status is valid';

-- 9. High conviction portfolio market
ALTER TABLE high_conviction_portfolio DROP CONSTRAINT IF EXISTS chk_hcp_market;
ALTER TABLE high_conviction_portfolio
ADD CONSTRAINT chk_hcp_market
CHECK (market IN ('UK', 'US', 'India', 'IN'));

COMMENT ON CONSTRAINT chk_hcp_market ON high_conviction_portfolio IS
'Ensures market is one of the supported values';

-- 10. Telegram subscription type
ALTER TABLE telegram_subscribers DROP CONSTRAINT IF EXISTS chk_telegram_sub_type;
ALTER TABLE telegram_subscribers
ADD CONSTRAINT chk_telegram_sub_type
CHECK (subscription_type IN ('all', 'conviction', 'scans', 'none'));

COMMENT ON CONSTRAINT chk_telegram_sub_type ON telegram_subscribers IS
'Ensures subscription type is valid';

-- 11. Positive values in high conviction portfolio
ALTER TABLE high_conviction_portfolio DROP CONSTRAINT IF EXISTS chk_hcp_positive_values;
ALTER TABLE high_conviction_portfolio
ADD CONSTRAINT chk_hcp_positive_values
CHECK (
    (entry_price IS NULL OR entry_price >= 0) AND
    (current_price IS NULL OR current_price >= 0) AND
    (target_price IS NULL OR target_price >= 0) AND
    (stop_loss_price IS NULL OR stop_loss_price >= 0) AND
    (shares IS NULL OR shares >= 0)
);

COMMENT ON CONSTRAINT chk_hcp_positive_values ON high_conviction_portfolio IS
'Ensures all prices and quantities are non-negative';

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Count all constraints added
DO $$
DECLARE
    constraint_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO constraint_count
    FROM information_schema.table_constraints
    WHERE constraint_name IN (
        'fk_trades_user_email',
        'fk_alert_pref_user',
        'chk_trades_status',
        'chk_trades_positive_prices',
        'chk_trades_positive_quantities',
        'chk_trades_date_logic',
        'chk_trades_closed_has_exit',
        'chk_hcp_status',
        'chk_hcp_market',
        'chk_telegram_sub_type',
        'chk_hcp_positive_values'
    );

    IF constraint_count = 11 THEN
        RAISE NOTICE '✅ SUCCESS: All 11 constraints created successfully';
    ELSE
        RAISE WARNING '⚠️  Expected 11 constraints, found %', constraint_count;
    END IF;
END $$;

-- List all new constraints
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    pg_get_constraintdef(c.oid) as constraint_definition
FROM information_schema.table_constraints tc
JOIN pg_constraint c ON c.conname = tc.constraint_name
WHERE tc.constraint_name IN (
    'fk_trades_user_email',
    'fk_alert_pref_user',
    'chk_trades_status',
    'chk_trades_positive_prices',
    'chk_trades_positive_quantities',
    'chk_trades_date_logic',
    'chk_trades_closed_has_exit',
    'chk_hcp_status',
    'chk_hcp_market',
    'chk_telegram_sub_type',
    'chk_hcp_positive_values'
)
ORDER BY tc.table_name, tc.constraint_name;

COMMIT;

-- ========================================
-- ROLLBACK SCRIPT (Run if needed)
-- ========================================
/*
BEGIN;

ALTER TABLE trades DROP CONSTRAINT IF EXISTS fk_trades_user_email;
ALTER TABLE alert_preferences DROP CONSTRAINT IF EXISTS fk_alert_pref_user;
ALTER TABLE trades DROP CONSTRAINT IF EXISTS chk_trades_status;
ALTER TABLE trades DROP CONSTRAINT IF EXISTS chk_trades_positive_prices;
ALTER TABLE trades DROP CONSTRAINT IF EXISTS chk_trades_positive_quantities;
ALTER TABLE trades DROP CONSTRAINT IF EXISTS chk_trades_date_logic;
ALTER TABLE trades DROP CONSTRAINT IF EXISTS chk_trades_closed_has_exit;
ALTER TABLE high_conviction_portfolio DROP CONSTRAINT IF EXISTS chk_hcp_status;
ALTER TABLE high_conviction_portfolio DROP CONSTRAINT IF EXISTS chk_hcp_market;
ALTER TABLE telegram_subscribers DROP CONSTRAINT IF EXISTS chk_telegram_sub_type;
ALTER TABLE high_conviction_portfolio DROP CONSTRAINT IF EXISTS chk_hcp_positive_values;

COMMIT;
*/

-- ========================================
-- TEST QUERIES (Run after migration)
-- ========================================

-- Test 1: Try to insert invalid status (should fail)
-- INSERT INTO trades (symbol, user_id, status) VALUES ('TEST', 'default', 'invalid');

-- Test 2: Try to insert negative price (should fail)
-- INSERT INTO trades (symbol, user_id, entry_price) VALUES ('TEST', 'default', -100);

-- Test 3: Try to insert exit_date before entry_date (should fail)
-- INSERT INTO trades (symbol, user_id, entry_date, exit_date)
-- VALUES ('TEST', 'default', '2025-01-10', '2025-01-01');

-- Test 4: Try to insert trade for non-existent user (should fail)
-- INSERT INTO trades (symbol, user_id) VALUES ('TEST', 'nonexistent@example.com');

-- ========================================
-- MIGRATION COMPLETE
-- ========================================
-- Next Migration: 003_create_subscription_tables.sql
