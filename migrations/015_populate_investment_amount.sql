-- ========================================
-- Migration: 015 - Populate Investment Amount for Existing Trades
-- Description: Set investment_amount field for trades created before sizing logic was implemented
-- Date: 2025-10-16
-- ========================================

BEGIN;

-- Update India market trades (.NS stocks) - ₹50,000 per trade
UPDATE trades
SET
    investment_amount = 50000,
    trade_size = 50000,
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'active'
AND symbol LIKE '%.NS'
AND user_id = 'ketanjoshisahs@gmail.com'
AND investment_amount IS NULL;

-- Update UK market trades (.L stocks) - £400 per trade
UPDATE trades
SET
    investment_amount = 400,
    trade_size = 400,
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'active'
AND symbol LIKE '%.L'
AND user_id = 'ketanjoshisahs@gmail.com'
AND investment_amount IS NULL;

-- Update US market trades (no suffix) - $500 per trade
UPDATE trades
SET
    investment_amount = 500,
    trade_size = 500,
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'active'
AND symbol NOT LIKE '%.NS'
AND symbol NOT LIKE '%.L'
AND user_id = 'ketanjoshisahs@gmail.com'
AND investment_amount IS NULL;

-- Log the results
DO $$
DECLARE
    india_count INTEGER;
    uk_count INTEGER;
    us_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO india_count
    FROM trades
    WHERE status = 'active' AND symbol LIKE '%.NS' AND user_id = 'ketanjoshisahs@gmail.com' AND investment_amount = 50000;

    SELECT COUNT(*) INTO uk_count
    FROM trades
    WHERE status = 'active' AND symbol LIKE '%.L' AND user_id = 'ketanjoshisahs@gmail.com' AND investment_amount = 400;

    SELECT COUNT(*) INTO us_count
    FROM trades
    WHERE status = 'active' AND symbol NOT LIKE '%.NS' AND symbol NOT LIKE '%.L' AND user_id = 'ketanjoshisahs@gmail.com' AND investment_amount = 500;

    RAISE NOTICE '✅ Populated investment_amount: India=%  trades (₹50K each), UK=% trades (£400 each), US=% trades ($500 each)', india_count, uk_count, us_count;
END $$;

COMMIT;
