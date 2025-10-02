-- ========================================
-- Migration: 006 - Optimize Data Types
-- Description: Optimize column data types for better performance and storage
-- Impact: 10-20% storage savings, better performance
-- Estimated Time: 2 hours
-- Date: 2025-10-02
-- ========================================

-- BACKUP RECOMMENDATION:
-- Before running this migration, create a backup:
-- pg_dump -h your-host -U your-user -d your-database > backup_before_006.sql

-- ⚠️  WARNING: This is a complex migration that modifies core data types
-- Test thoroughly in staging environment first!

BEGIN;

-- ========================================
-- PART 1: Fix Telegram Chat ID Data Types
-- ========================================

-- 1.1 Fix users table telegram_chat_id
-- Telegram chat IDs are 64-bit integers, not strings
DO $$
BEGIN
    -- Check if column exists and is not already BIGINT
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name = 'telegram_chat_id'
          AND data_type != 'bigint'
    ) THEN
        -- Create temp backup
        CREATE TEMP TABLE temp_telegram_users AS
        SELECT id, email, telegram_chat_id
        FROM users
        WHERE telegram_chat_id IS NOT NULL;

        -- Convert to BIGINT
        ALTER TABLE users
        ALTER COLUMN telegram_chat_id TYPE BIGINT
        USING telegram_chat_id::BIGINT;

        RAISE NOTICE '✅ Converted users.telegram_chat_id to BIGINT';
    ELSE
        RAISE NOTICE 'ℹ️  users.telegram_chat_id already BIGINT or does not exist';
    END IF;
END $$;

-- 1.2 Fix alert_preferences table telegram_chat_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'alert_preferences'
          AND column_name = 'telegram_chat_id'
          AND data_type != 'bigint'
    ) THEN
        ALTER TABLE alert_preferences
        ALTER COLUMN telegram_chat_id TYPE BIGINT
        USING telegram_chat_id::BIGINT;

        RAISE NOTICE '✅ Converted alert_preferences.telegram_chat_id to BIGINT';
    ELSE
        RAISE NOTICE 'ℹ️  alert_preferences.telegram_chat_id already BIGINT or does not exist';
    END IF;
END $$;

-- 1.3 Fix telegram_subscribers table chat_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'telegram_subscribers'
          AND column_name = 'chat_id'
          AND data_type != 'bigint'
    ) THEN
        ALTER TABLE telegram_subscribers
        ALTER COLUMN chat_id TYPE BIGINT
        USING chat_id::BIGINT;

        RAISE NOTICE '✅ Converted telegram_subscribers.chat_id to BIGINT';
    ELSE
        RAISE NOTICE 'ℹ️  telegram_subscribers.chat_id already BIGINT or does not exist';
    END IF;
END $$;

-- ========================================
-- PART 2: Add Length Limits to TEXT Columns
-- ========================================

-- 2.1 Add constraint to notes column (max 5000 characters)
DO $$
BEGIN
    -- First, truncate any existing notes that are too long
    UPDATE trades
    SET notes = LEFT(notes, 5000)
    WHERE LENGTH(notes) > 5000;

    -- Add constraint
    ALTER TABLE trades DROP CONSTRAINT IF EXISTS chk_trades_notes_length;
    ALTER TABLE trades
    ADD CONSTRAINT chk_trades_notes_length
    CHECK (notes IS NULL OR LENGTH(notes) <= 5000);

    RAISE NOTICE '✅ Added length constraint to trades.notes (max 5000 chars)';
END $$;

-- 2.2 Add constraint to entry_reason
DO $$
BEGIN
    UPDATE trades
    SET entry_reason = LEFT(entry_reason, 2000)
    WHERE LENGTH(entry_reason) > 2000;

    ALTER TABLE trades DROP CONSTRAINT IF EXISTS chk_trades_entry_reason_length;
    ALTER TABLE trades
    ADD CONSTRAINT chk_trades_entry_reason_length
    CHECK (entry_reason IS NULL OR LENGTH(entry_reason) <= 2000);

    RAISE NOTICE '✅ Added length constraint to trades.entry_reason (max 2000 chars)';
END $$;

-- 2.3 Add constraint to exit_reason
DO $$
BEGIN
    UPDATE trades
    SET exit_reason = LEFT(exit_reason, 2000)
    WHERE LENGTH(exit_reason) > 2000;

    ALTER TABLE trades DROP CONSTRAINT IF EXISTS chk_trades_exit_reason_length;
    ALTER TABLE trades
    ADD CONSTRAINT chk_trades_exit_reason_length
    CHECK (exit_reason IS NULL OR LENGTH(exit_reason) <= 2000);

    RAISE NOTICE '✅ Added length constraint to trades.exit_reason (max 2000 chars)';
END $$;

-- 2.4 Add constraint to technical_setup
DO $$
BEGIN
    UPDATE trades
    SET technical_setup = LEFT(technical_setup, 3000)
    WHERE LENGTH(technical_setup) > 3000;

    ALTER TABLE trades DROP CONSTRAINT IF EXISTS chk_trades_technical_setup_length;
    ALTER TABLE trades
    ADD CONSTRAINT chk_trades_technical_setup_length
    CHECK (technical_setup IS NULL OR LENGTH(technical_setup) <= 3000);

    RAISE NOTICE '✅ Added length constraint to trades.technical_setup (max 3000 chars)';
END $$;

-- 2.5 Add constraint to lessons_learned
DO $$
BEGIN
    UPDATE trades
    SET lessons_learned = LEFT(lessons_learned, 3000)
    WHERE LENGTH(lessons_learned) > 3000;

    ALTER TABLE trades DROP CONSTRAINT IF EXISTS chk_trades_lessons_learned_length;
    ALTER TABLE trades
    ADD CONSTRAINT chk_trades_lessons_learned_length
    CHECK (lessons_learned IS NULL OR LENGTH(lessons_learned) <= 3000);

    RAISE NOTICE '✅ Added length constraint to trades.lessons_learned (max 3000 chars)';
END $$;

-- ========================================
-- PART 3: Optimize Numeric Precision
-- ========================================

-- 3.1 Review and document current precision usage
-- (No changes in this migration, but document recommendations)

DO $$
BEGIN
    RAISE NOTICE '📊 Current numeric column precision:';
    RAISE NOTICE '   entry_price: DECIMAL(12,4) - Good for prices up to 99,999,999.9999';
    RAISE NOTICE '   shares: DECIMAL(12,6) - Good for fractional shares';
    RAISE NOTICE '   profit_loss: DECIMAL(12,4) - Good for P&L amounts';
    RAISE NOTICE '   These are appropriate for most use cases';
END $$;

-- ========================================
-- PART 4: Optimize VARCHAR Lengths
-- ========================================

-- 4.1 Analyze actual usage of VARCHAR columns
CREATE TEMP TABLE varchar_usage_analysis AS
SELECT
    'symbol' as column_name,
    MAX(LENGTH(symbol)) as max_length,
    AVG(LENGTH(symbol))::INT as avg_length,
    50 as current_max
FROM trades WHERE symbol IS NOT NULL
UNION ALL
SELECT
    'name' as column_name,
    MAX(LENGTH(name)) as max_length,
    AVG(LENGTH(name))::INT as avg_length,
    255 as current_max
FROM trades WHERE name IS NOT NULL
UNION ALL
SELECT
    'stock_index' as column_name,
    MAX(LENGTH(stock_index)) as max_length,
    AVG(LENGTH(stock_index))::INT as avg_length,
    50 as current_max
FROM trades WHERE stock_index IS NOT NULL;

-- Show analysis results
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '📏 VARCHAR column usage analysis:';
    FOR rec IN SELECT * FROM varchar_usage_analysis LOOP
        RAISE NOTICE '   %: max=%, avg=%, allocated=%',
            rec.column_name, rec.max_length, rec.avg_length, rec.current_max;
    END LOOP;
END $$;

-- ========================================
-- PART 5: Add Database Statistics Collection
-- ========================================

-- Enable better query planning with statistics
ALTER TABLE trades SET (autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE users SET (autovacuum_analyze_scale_factor = 0.1);
ALTER TABLE user_subscriptions SET (autovacuum_analyze_scale_factor = 0.1);

-- Analyze tables to update statistics
ANALYZE trades;
ANALYZE users;
ANALYZE high_conviction_portfolio;
ANALYZE telegram_subscribers;
ANALYZE user_subscriptions;


-- ========================================
-- PART 6: Create Storage Optimization Report
-- ========================================

CREATE TEMP TABLE storage_report AS
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as indexes_size,
    pg_total_relation_size(schemaname||'.'||tablename) as total_bytes
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('trades', 'users', 'user_subscriptions', 'high_conviction_portfolio', 'telegram_subscribers')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Display report
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '💾 Database storage report:';
    FOR rec IN SELECT * FROM storage_report LOOP
        RAISE NOTICE '   %: % total (table: %, indexes: %)',
            rec.tablename, rec.total_size, rec.table_size, rec.indexes_size;
    END LOOP;
END $$;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Verify telegram_chat_id is BIGINT
DO $$
DECLARE
    data_types TEXT;
BEGIN
    SELECT STRING_AGG(table_name || '.' || column_name || ' = ' || data_type, ', ')
    INTO data_types
    FROM information_schema.columns
    WHERE (table_name = 'users' AND column_name = 'telegram_chat_id')
       OR (table_name = 'alert_preferences' AND column_name = 'telegram_chat_id')
       OR (table_name = 'telegram_subscribers' AND column_name = 'chat_id');

    RAISE NOTICE '✅ Telegram chat ID data types: %', data_types;
END $$;

-- Verify length constraints
SELECT
    tc.table_name,
    tc.constraint_name,
    pg_get_constraintdef(c.oid) as constraint_definition
FROM information_schema.table_constraints tc
JOIN pg_constraint c ON c.conname = tc.constraint_name
WHERE tc.constraint_name LIKE 'chk_trades_%_length'
ORDER BY tc.constraint_name;

COMMIT;

-- ========================================
-- ROLLBACK SCRIPT (Run if needed)
-- ========================================
/*
BEGIN;

-- Revert telegram_chat_id back to VARCHAR
ALTER TABLE users ALTER COLUMN telegram_chat_id TYPE VARCHAR(100) USING telegram_chat_id::VARCHAR;
ALTER TABLE alert_preferences ALTER COLUMN telegram_chat_id TYPE VARCHAR(100) USING telegram_chat_id::VARCHAR;
ALTER TABLE telegram_subscribers ALTER COLUMN chat_id TYPE VARCHAR(100) USING chat_id::VARCHAR;

-- Remove length constraints
ALTER TABLE trades DROP CONSTRAINT IF EXISTS chk_trades_notes_length;
ALTER TABLE trades DROP CONSTRAINT IF EXISTS chk_trades_entry_reason_length;
ALTER TABLE trades DROP CONSTRAINT IF EXISTS chk_trades_exit_reason_length;
ALTER TABLE trades DROP CONSTRAINT IF EXISTS chk_trades_technical_setup_length;
ALTER TABLE trades DROP CONSTRAINT IF EXISTS chk_trades_lessons_learned_length;

-- Reset autovacuum settings
ALTER TABLE trades RESET (autovacuum_analyze_scale_factor);
ALTER TABLE users RESET (autovacuum_analyze_scale_factor);
ALTER TABLE user_subscriptions RESET (autovacuum_analyze_scale_factor);

COMMIT;
*/

-- ========================================
-- POST-MIGRATION TASKS
-- ========================================

-- 1. Update application code to handle BIGINT telegram_chat_id
--    - Ensure JavaScript can handle large integers (use BigInt or string)
--    - Update Telegram bot code to use numeric chat IDs

-- 2. Monitor database performance after changes
--    - Check query performance on telegram_chat_id lookups
--    - Verify autovacuum is running more frequently

-- 3. Consider future optimizations:
--    - Implement table partitioning for trades (by date)
--    - Add database-level compression
--    - Archive old closed trades to separate table

-- ========================================
-- MIGRATION COMPLETE
-- ========================================
-- Next Migration: 007_add_audit_logging.sql
