-- ========================================
-- Migration: 010 - Migrate Trades to Primary User
-- Description: Update trades created with wrong user_id to primary user
-- Date: 2025-10-16
-- ========================================

BEGIN;

-- Update all trades from deepak.joshi2898@gmail.com to ketanjoshisahs@gmail.com
UPDATE trades
SET user_id = 'ketanjoshisahs@gmail.com'
WHERE user_id = 'deepak.joshi2898@gmail.com';

-- Log the number of trades migrated
DO $$
DECLARE
    migrated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO migrated_count
    FROM trades
    WHERE user_id = 'ketanjoshisahs@gmail.com';

    RAISE NOTICE '✅ Migrated trades to primary user (ketanjoshisahs@gmail.com)';
    RAISE NOTICE 'Total trades for primary user: %', migrated_count;
END $$;

COMMIT;
