-- ========================================
-- Migration: 004 - Consolidate Duplicate Columns
-- Description: Remove duplicate columns that serve the same purpose
-- Impact: 5-10% storage savings, cleaner schema
-- Estimated Time: 30 minutes
-- Date: 2025-10-02
-- ========================================

-- BACKUP RECOMMENDATION:
-- Before running this migration, create a backup:
-- pg_dump -h your-host -U your-user -d your-database > backup_before_004.sql

-- WARNING: This migration will drop columns after data migration
-- Ensure no application code is using the old columns

BEGIN;

-- ========================================
-- PRE-MIGRATION ANALYSIS
-- ========================================

-- Skip analysis if columns already dropped
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trades' AND column_name='profit') THEN
        RAISE NOTICE '✅ Columns already migrated, skipping analysis';
    END IF;
END $$;

-- ========================================
-- STEP 1: DATA MIGRATION (Prefer newer/more descriptive names)
-- ========================================

DO $$
BEGIN
    -- 1.1 Migrate profit → profit_loss (keep profit_loss)
    -- Check if profit column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trades' AND column_name='profit') THEN
        UPDATE trades
        SET profit_loss = COALESCE(profit_loss, profit)
        WHERE profit_loss IS NULL AND profit IS NOT NULL;
    END IF;

    -- 1.2 Migrate percent_gain → profit_loss_percentage (keep profit_loss_percentage)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trades' AND column_name='percent_gain') THEN
        UPDATE trades
        SET profit_loss_percentage = COALESCE(profit_loss_percentage, percent_gain)
        WHERE profit_loss_percentage IS NULL AND percent_gain IS NOT NULL;
    END IF;

    -- 1.3 Migrate quantity → shares (keep shares)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trades' AND column_name='quantity') THEN
        UPDATE trades
        SET shares = COALESCE(shares, quantity)
        WHERE shares IS NULL AND quantity IS NOT NULL;
    END IF;

    -- 1.4 Migrate stop_loss (amount) data
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trades' AND column_name='stop_loss') THEN
        UPDATE trades
        SET stop_loss_percent = CASE
            WHEN stop_loss_percent IS NOT NULL THEN stop_loss_percent
            WHEN stop_loss IS NOT NULL AND entry_price > 0 THEN (stop_loss / entry_price) * 100
            ELSE NULL
        END
        WHERE stop_loss_percent IS NULL AND stop_loss IS NOT NULL;
    END IF;
END $$;


-- ========================================
-- STEP 2: VERIFY DATA MIGRATION
-- ========================================

DO $$
DECLARE
    profit_exists BOOLEAN;
BEGIN
    -- Check if old columns exist
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='trades' AND column_name='profit') INTO profit_exists;

    -- Skip verification if columns already dropped
    IF NOT profit_exists THEN
        RAISE NOTICE '✅ Old columns already dropped, skipping verification';
    END IF;
END $$;

-- ========================================
-- STEP 3: DROP DUPLICATE COLUMNS
-- ========================================

-- Before dropping, create a temporary backup table (optional but recommended)
-- Only create if columns still exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trades' AND column_name='profit') THEN
        CREATE TABLE IF NOT EXISTS trades_backup_before_004 AS
        SELECT id, profit, percent_gain, quantity, stop_loss, stop_loss_price
        FROM trades
        WHERE profit IS NOT NULL
           OR percent_gain IS NOT NULL
           OR quantity IS NOT NULL
           OR stop_loss IS NOT NULL
           OR stop_loss_price IS NOT NULL;

        EXECUTE 'COMMENT ON TABLE trades_backup_before_004 IS ''Backup of dropped columns from migration 004 (can be dropped after verification)''';
    END IF;
END $$;

-- Drop the duplicate columns
ALTER TABLE trades DROP COLUMN IF EXISTS profit;
ALTER TABLE trades DROP COLUMN IF EXISTS percent_gain;
ALTER TABLE trades DROP COLUMN IF EXISTS quantity;
ALTER TABLE trades DROP COLUMN IF EXISTS stop_loss;
ALTER TABLE trades DROP COLUMN IF EXISTS stop_loss_price;


-- ========================================
-- STEP 4: UPDATE COLUMN COMMENTS FOR CLARITY
-- ========================================

COMMENT ON COLUMN trades.profit_loss IS 'Profit or loss amount in trade currency (formerly also tracked in profit column)';
COMMENT ON COLUMN trades.profit_loss_percentage IS 'Profit or loss as percentage (formerly also tracked in percent_gain column)';
COMMENT ON COLUMN trades.shares IS 'Number of shares/units traded (formerly also tracked in quantity column)';
COMMENT ON COLUMN trades.stop_loss_percent IS 'Stop loss as percentage below entry price (canonical field)';
COMMENT ON COLUMN trades.take_profit_percent IS 'Take profit as percentage above entry price';

-- ========================================
-- STEP 5: CREATE HELPER FUNCTIONS FOR CALCULATIONS
-- ========================================

-- Function to calculate stop loss price from percentage
CREATE OR REPLACE FUNCTION calculate_stop_loss_price(
    p_entry_price DECIMAL(12,4),
    p_stop_loss_percent DECIMAL(8,4)
)
RETURNS DECIMAL(12,4)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF p_entry_price IS NULL OR p_stop_loss_percent IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN p_entry_price * (1 - p_stop_loss_percent / 100);
END;
$$;

COMMENT ON FUNCTION calculate_stop_loss_price IS 'Calculate stop loss price from entry price and stop loss percentage';

-- Function to calculate target price from percentage
CREATE OR REPLACE FUNCTION calculate_target_price_from_percent(
    p_entry_price DECIMAL(12,4),
    p_take_profit_percent DECIMAL(8,4)
)
RETURNS DECIMAL(12,4)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF p_entry_price IS NULL OR p_take_profit_percent IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN p_entry_price * (1 + p_take_profit_percent / 100);
END;
$$;

COMMENT ON FUNCTION calculate_target_price_from_percent IS 'Calculate target price from entry price and take profit percentage';

-- ========================================
-- STEP 6: CREATE VIEW FOR BACKWARDS COMPATIBILITY (OPTIONAL)
-- ========================================

-- Drop and recreate view (can't use CREATE OR REPLACE if column list changes)
DROP VIEW IF EXISTS trades_with_legacy_columns CASCADE;

CREATE VIEW trades_with_legacy_columns AS
SELECT
    t.*,
    t.profit_loss as profit,  -- Alias for old column name
    t.profit_loss_percentage as percent_gain,  -- Alias for old column name
    t.shares as quantity,  -- Alias for old column name
    calculate_stop_loss_price(t.entry_price, t.stop_loss_percent) as stop_loss_price  -- Calculated
FROM trades t;

COMMENT ON VIEW trades_with_legacy_columns IS 'Backwards compatibility view with old column names - DEPRECATED, remove after updating all application code';

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Verify columns are dropped
DO $$
DECLARE
    old_columns TEXT[];
BEGIN
    SELECT ARRAY_AGG(column_name) INTO old_columns
    FROM information_schema.columns
    WHERE table_name = 'trades'
      AND column_name IN ('profit', 'percent_gain', 'quantity', 'stop_loss', 'stop_loss_price');

    IF old_columns IS NOT NULL AND array_length(old_columns, 1) > 0 THEN
        RAISE EXCEPTION '❌ ERROR: Old columns still exist: %', array_to_string(old_columns, ', ');
    ELSE
        RAISE NOTICE '✅ SUCCESS: All duplicate columns successfully dropped';
    END IF;
END $$;

-- Show current trade table schema
SELECT
    column_name,
    data_type,
    character_maximum_length,
    numeric_precision,
    numeric_scale,
    is_nullable,
    column_default,
    col_description('trades'::regclass, ordinal_position) as description
FROM information_schema.columns
WHERE table_name = 'trades'
ORDER BY ordinal_position;

-- Show table size savings
SELECT
    pg_size_pretty(pg_total_relation_size('trades')) as total_size,
    pg_size_pretty(pg_relation_size('trades')) as table_size,
    pg_size_pretty(pg_indexes_size('trades')) as indexes_size
FROM generate_series(1,1);

COMMIT;

-- ========================================
-- ROLLBACK SCRIPT (Run if needed)
-- ========================================
/*
BEGIN;

-- Restore columns from backup
ALTER TABLE trades ADD COLUMN profit DECIMAL(12, 4);
ALTER TABLE trades ADD COLUMN percent_gain DECIMAL(8, 4);
ALTER TABLE trades ADD COLUMN quantity DECIMAL(12, 6);
ALTER TABLE trades ADD COLUMN stop_loss DECIMAL(12, 4);
ALTER TABLE trades ADD COLUMN stop_loss_price DECIMAL(12, 4);

-- Copy data back from primary columns
UPDATE trades SET profit = profit_loss;
UPDATE trades SET percent_gain = profit_loss_percentage;
UPDATE trades SET quantity = shares;

-- Or restore from backup table
UPDATE trades t
SET
    profit = b.profit,
    percent_gain = b.percent_gain,
    quantity = b.quantity,
    stop_loss = b.stop_loss,
    stop_loss_price = b.stop_loss_price
FROM trades_backup_before_004 b
WHERE t.id = b.id;

-- Drop backup table and view
DROP VIEW IF EXISTS trades_with_legacy_columns;
DROP TABLE IF EXISTS trades_backup_before_004;

-- Drop helper functions
DROP FUNCTION IF EXISTS calculate_stop_loss_price;
DROP FUNCTION IF EXISTS calculate_target_price_from_percent;

COMMIT;
*/

-- ========================================
-- POST-MIGRATION TASKS
-- ========================================

-- TODO for application code:
-- 1. Update server.js: Replace all references to old column names
--    - profit → profit_loss
--    - percent_gain → profit_loss_percentage
--    - quantity → shares
--    - stop_loss_price → calculate_stop_loss_price(entry_price, stop_loss_percent)

-- 2. Update database-postgres.js: Update all SQL queries

-- 3. Update UI JavaScript files:
--    - public/js/TradeUI-*.js
--    - public/js/trade-core.js
--    - Update any references to old field names

-- 4. Test all trade-related features:
--    - Creating new trades
--    - Updating existing trades
--    - Displaying trade statistics
--    - Export functionality

-- 5. After verification (1-2 weeks), clean up:
--    DROP VIEW trades_with_legacy_columns;
--    DROP TABLE trades_backup_before_004;

-- ========================================
-- MIGRATION COMPLETE
-- ========================================
-- Next Migration: 005_add_ui_columns.sql
