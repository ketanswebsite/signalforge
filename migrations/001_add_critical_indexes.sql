-- ========================================
-- Migration: 001 - Add Critical Indexes
-- Description: Add indexes to improve query performance
-- Impact: 10-50x query speed improvement
-- Estimated Time: 5 minutes
-- Date: 2025-10-02
-- ========================================

-- BACKUP RECOMMENDATION:
-- Before running this migration, create a backup:
-- pg_dump -h your-host -U your-user -d your-database > backup_before_001.sql

BEGIN;

-- ========================================
-- FORWARD MIGRATION
-- ========================================

-- 1. Index on trades.entry_date for date range queries
DROP INDEX IF EXISTS idx_trades_entry_date;
CREATE INDEX idx_trades_entry_date ON trades(entry_date DESC);
COMMENT ON INDEX idx_trades_entry_date IS 'Improves queries filtering by entry date';

-- 2. Index on trades.exit_date for historical analysis
DROP INDEX IF EXISTS idx_trades_exit_date;
CREATE INDEX idx_trades_exit_date ON trades(exit_date DESC) WHERE exit_date IS NOT NULL;
COMMENT ON INDEX idx_trades_exit_date IS 'Improves queries for closed trades and historical analysis';

-- 3. Composite index for common active trades query
DROP INDEX IF EXISTS idx_trades_user_status_date;
CREATE INDEX idx_trades_user_status_date ON trades(user_id, status, entry_date DESC);
COMMENT ON INDEX idx_trades_user_status_date IS 'Optimizes active trades queries per user';

-- 4. Index on trades.updated_at for real-time price updates
DROP INDEX IF EXISTS idx_trades_updated_at;
CREATE INDEX idx_trades_updated_at ON trades(updated_at DESC);
COMMENT ON INDEX idx_trades_updated_at IS 'Improves queries for recently updated trades';

-- 5. Index on high_conviction_portfolio.signal_date
DROP INDEX IF EXISTS idx_high_conviction_signal_date_v2;
CREATE INDEX idx_high_conviction_signal_date_v2 ON high_conviction_portfolio(signal_date DESC);
COMMENT ON INDEX idx_high_conviction_signal_date_v2 IS 'Improves queries for recent high conviction signals';

-- 6. Index on alert_preferences.user_id for faster alert lookups
DROP INDEX IF EXISTS idx_alert_preferences_user;
CREATE INDEX idx_alert_preferences_user ON alert_preferences(user_id);
COMMENT ON INDEX idx_alert_preferences_user IS 'Speeds up alert preference lookups';

-- 7. Composite index for telegram subscribers by activity
DROP INDEX IF EXISTS idx_telegram_subs_active_type;
CREATE INDEX idx_telegram_subs_active_type ON telegram_subscribers(is_active, subscription_type);
COMMENT ON INDEX idx_telegram_subs_active_type IS 'Optimizes queries for active subscribers by type';

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Verify all indexes were created successfully
DO $$
DECLARE
    idx_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO idx_count
    FROM pg_indexes
    WHERE indexname IN (
        'idx_trades_entry_date',
        'idx_trades_exit_date',
        'idx_trades_user_status_date',
        'idx_trades_updated_at',
        'idx_high_conviction_signal_date_v2',
        'idx_alert_preferences_user',
        'idx_telegram_subs_active_type'
    );

    IF idx_count = 7 THEN
        RAISE NOTICE '✅ SUCCESS: All 7 indexes created successfully';
    ELSE
        RAISE EXCEPTION '❌ ERROR: Expected 7 indexes, found %', idx_count;
    END IF;
END $$;

-- Show index sizes
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(schemaname||'.'||indexname::text)) as index_size
FROM pg_indexes
WHERE indexname IN (
    'idx_trades_entry_date',
    'idx_trades_exit_date',
    'idx_trades_user_status_date',
    'idx_trades_updated_at',
    'idx_high_conviction_signal_date_v2',
    'idx_alert_preferences_user',
    'idx_telegram_subs_active_type'
)
ORDER BY tablename, indexname;

COMMIT;

-- ========================================
-- ROLLBACK SCRIPT (Run if needed)
-- ========================================
/*
BEGIN;

DROP INDEX IF EXISTS idx_trades_entry_date;
DROP INDEX IF EXISTS idx_trades_exit_date;
DROP INDEX IF EXISTS idx_trades_user_status_date;
DROP INDEX IF EXISTS idx_trades_updated_at;
DROP INDEX IF EXISTS idx_high_conviction_signal_date_v2;
DROP INDEX IF EXISTS idx_alert_preferences_user;
DROP INDEX IF EXISTS idx_telegram_subs_active_type;

COMMIT;
*/

-- ========================================
-- PERFORMANCE TEST QUERIES
-- ========================================

-- Test 1: Active trades for user (should use idx_trades_user_status_date)
-- EXPLAIN ANALYZE
-- SELECT * FROM trades
-- WHERE user_id = 'test@example.com'
--   AND status = 'active'
-- ORDER BY entry_date DESC;

-- Test 2: Recent entries (should use idx_trades_entry_date)
-- EXPLAIN ANALYZE
-- SELECT * FROM trades
-- WHERE entry_date >= NOW() - INTERVAL '30 days'
-- ORDER BY entry_date DESC;

-- Test 3: Recently updated trades (should use idx_trades_updated_at)
-- EXPLAIN ANALYZE
-- SELECT * FROM trades
-- WHERE updated_at >= NOW() - INTERVAL '1 hour'
-- ORDER BY updated_at DESC;

-- ========================================
-- MIGRATION COMPLETE
-- ========================================
-- Next Migration: 002_add_constraints.sql
