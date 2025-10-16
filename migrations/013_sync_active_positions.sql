-- ========================================
-- Migration: 013 - Sync Active Positions Count
-- Description: Update portfolio_capital.active_positions to match actual trade count
-- Date: 2025-10-16
-- ========================================

BEGIN;

-- Update India market (.NS stocks)
UPDATE portfolio_capital
SET active_positions = (
    SELECT COUNT(*)
    FROM trades
    WHERE status = 'active'
    AND symbol LIKE '%.NS'
    AND user_id = 'ketanjoshisahs@gmail.com'
)
WHERE user_id = 'system' AND market = 'India';

-- Update UK market (.L stocks)
UPDATE portfolio_capital
SET active_positions = (
    SELECT COUNT(*)
    FROM trades
    WHERE status = 'active'
    AND symbol LIKE '%.L'
    AND user_id = 'ketanjoshisahs@gmail.com'
)
WHERE user_id = 'system' AND market = 'UK';

-- Update US market (no suffix)
UPDATE portfolio_capital
SET active_positions = (
    SELECT COUNT(*)
    FROM trades
    WHERE status = 'active'
    AND symbol NOT LIKE '%.NS'
    AND symbol NOT LIKE '%.L'
    AND user_id = 'ketanjoshisahs@gmail.com'
)
WHERE user_id = 'system' AND market = 'US';

-- Log the results
DO $$
DECLARE
    india_count INTEGER;
    uk_count INTEGER;
    us_count INTEGER;
BEGIN
    SELECT active_positions INTO india_count FROM portfolio_capital WHERE user_id = 'system' AND market = 'India';
    SELECT active_positions INTO uk_count FROM portfolio_capital WHERE user_id = 'system' AND market = 'UK';
    SELECT active_positions INTO us_count FROM portfolio_capital WHERE user_id = 'system' AND market = 'US';

    RAISE NOTICE '✅ Synced active_positions: India=%, UK=%, US=%', india_count, uk_count, us_count;
END $$;

COMMIT;
