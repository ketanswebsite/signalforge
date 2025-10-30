-- Migration 014: Sync active_positions counter with actual trade counts
-- Fixes mismatch where counter doesn't match actual active trades in database

-- Create migration tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Check if migration already applied
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM migrations WHERE name = '014_sync_active_positions') THEN
        -- Sync each market's active_positions counter with actual count
        UPDATE portfolio_capital pc
        SET active_positions = (
            SELECT COUNT(*)
            FROM trades t
            WHERE t.status = 'active'
              AND t.user_id = pc.user_id
              AND t.market = pc.market
        )
        WHERE EXISTS (
            SELECT 1
            FROM trades t
            WHERE t.user_id = pc.user_id
              AND t.market = pc.market
              AND t.status = 'active'
            GROUP BY t.user_id, t.market
            HAVING COUNT(*) != pc.active_positions
        );

        -- Record migration
        INSERT INTO migrations (name) VALUES ('014_sync_active_positions');

        RAISE NOTICE 'Migration 014: Synced active_positions counters with actual trade counts';
    ELSE
        RAISE NOTICE 'Migration 014: Already applied, skipping';
    END IF;
END $$;
