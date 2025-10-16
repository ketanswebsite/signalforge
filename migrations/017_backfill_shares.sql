-- ========================================
-- Migration: 017 - Backfill Shares for Active Trades
-- Description: Calculate and populate shares field based on investment_amount and entry_price
-- Date: 2025-10-16
-- ========================================

BEGIN;

-- Update India market trades (.NS stocks)
-- shares = investment_amount / entry_price
UPDATE trades
SET
    shares = CASE
        WHEN entry_price > 0 THEN investment_amount / entry_price
        ELSE 0
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'active'
AND symbol LIKE '%.NS'
AND user_id = 'ketanjoshisahs@gmail.com'
AND (shares IS NULL OR shares = 0)
AND investment_amount IS NOT NULL
AND investment_amount > 0;

-- Update UK market trades (.L stocks)
-- Yahoo Finance returns UK prices in GBP (not pence), so no conversion needed
-- shares = investment_amount / entry_price
UPDATE trades
SET
    shares = CASE
        WHEN entry_price > 0 THEN investment_amount / entry_price
        ELSE 0
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'active'
AND symbol LIKE '%.L'
AND user_id = 'ketanjoshisahs@gmail.com'
AND (shares IS NULL OR shares = 0)
AND investment_amount IS NOT NULL
AND investment_amount > 0;

-- Update US market trades (no suffix)
-- shares = investment_amount / entry_price
UPDATE trades
SET
    shares = CASE
        WHEN entry_price > 0 THEN investment_amount / entry_price
        ELSE 0
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'active'
AND symbol NOT LIKE '%.NS'
AND symbol NOT LIKE '%.L'
AND user_id = 'ketanjoshisahs@gmail.com'
AND (shares IS NULL OR shares = 0)
AND investment_amount IS NOT NULL
AND investment_amount > 0;

-- Log the results
DO $$
DECLARE
    india_count INTEGER;
    uk_count INTEGER;
    us_count INTEGER;
    india_sample_symbol TEXT;
    india_sample_shares NUMERIC;
    india_sample_price NUMERIC;
    india_sample_investment NUMERIC;
BEGIN
    -- Count updates
    SELECT COUNT(*) INTO india_count
    FROM trades
    WHERE status = 'active' AND symbol LIKE '%.NS' AND user_id = 'ketanjoshisahs@gmail.com' AND shares > 0;

    SELECT COUNT(*) INTO uk_count
    FROM trades
    WHERE status = 'active' AND symbol LIKE '%.L' AND user_id = 'ketanjoshisahs@gmail.com' AND shares > 0;

    SELECT COUNT(*) INTO us_count
    FROM trades
    WHERE status = 'active' AND symbol NOT LIKE '%.NS' AND symbol NOT LIKE '%.L' AND user_id = 'ketanjoshisahs@gmail.com' AND shares > 0;

    -- Get sample trade for verification
    SELECT symbol, shares, entry_price, investment_amount
    INTO india_sample_symbol, india_sample_shares, india_sample_price, india_sample_investment
    FROM trades
    WHERE status = 'active' AND symbol LIKE '%.NS' AND user_id = 'ketanjoshisahs@gmail.com' AND shares > 0
    LIMIT 1;

    RAISE NOTICE '✅ Backfilled shares: India=% trades, UK=% trades, US=% trades', india_count, uk_count, us_count;

    IF india_sample_symbol IS NOT NULL THEN
        RAISE NOTICE '📊 Sample India trade: % - shares=%, entry_price=%, investment=%, calculated=%',
            india_sample_symbol,
            india_sample_shares,
            india_sample_price,
            india_sample_investment,
            (india_sample_shares * india_sample_price);
    END IF;
END $$;

COMMIT;
