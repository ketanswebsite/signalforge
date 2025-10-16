-- ========================================
-- Migration: 016 - Recalculate Allocated Capital (After Investment Amount Population)
-- Description: Recalculate allocated capital now that investment_amount has been populated
-- Date: 2025-10-16
-- ========================================

BEGIN;

-- Calculate total trade sizes per market for active trades
-- India market (.NS stocks)
UPDATE portfolio_capital
SET
    allocated_capital = COALESCE((
        SELECT SUM(investment_amount)
        FROM trades
        WHERE status = 'active'
        AND symbol LIKE '%.NS'
        AND user_id = 'ketanjoshisahs@gmail.com'
        AND investment_amount IS NOT NULL
    ), 0),
    available_capital = initial_capital + realized_pl - COALESCE((
        SELECT SUM(investment_amount)
        FROM trades
        WHERE status = 'active'
        AND symbol LIKE '%.NS'
        AND user_id = 'ketanjoshisahs@gmail.com'
        AND investment_amount IS NOT NULL
    ), 0),
    updated_at = CURRENT_TIMESTAMP
WHERE user_id = 'system' AND market = 'India';

-- UK market (.L stocks)
UPDATE portfolio_capital
SET
    allocated_capital = COALESCE((
        SELECT SUM(investment_amount)
        FROM trades
        WHERE status = 'active'
        AND symbol LIKE '%.L'
        AND user_id = 'ketanjoshisahs@gmail.com'
        AND investment_amount IS NOT NULL
    ), 0),
    available_capital = initial_capital + realized_pl - COALESCE((
        SELECT SUM(investment_amount)
        FROM trades
        WHERE status = 'active'
        AND symbol LIKE '%.L'
        AND user_id = 'ketanjoshisahs@gmail.com'
        AND investment_amount IS NOT NULL
    ), 0),
    updated_at = CURRENT_TIMESTAMP
WHERE user_id = 'system' AND market = 'UK';

-- US market (no suffix)
UPDATE portfolio_capital
SET
    allocated_capital = COALESCE((
        SELECT SUM(investment_amount)
        FROM trades
        WHERE status = 'active'
        AND symbol NOT LIKE '%.NS'
        AND symbol NOT LIKE '%.L'
        AND user_id = 'ketanjoshisahs@gmail.com'
        AND investment_amount IS NOT NULL
    ), 0),
    available_capital = initial_capital + realized_pl - COALESCE((
        SELECT SUM(investment_amount)
        FROM trades
        WHERE status = 'active'
        AND symbol NOT LIKE '%.NS'
        AND symbol NOT LIKE '%.L'
        AND user_id = 'ketanjoshisahs@gmail.com'
        AND investment_amount IS NOT NULL
    ), 0),
    updated_at = CURRENT_TIMESTAMP
WHERE user_id = 'system' AND market = 'US';

-- Log the results
DO $$
DECLARE
    india_allocated DECIMAL;
    uk_allocated DECIMAL;
    us_allocated DECIMAL;
    india_available DECIMAL;
    uk_available DECIMAL;
    us_available DECIMAL;
BEGIN
    SELECT allocated_capital, available_capital INTO india_allocated, india_available
    FROM portfolio_capital WHERE user_id = 'system' AND market = 'India';

    SELECT allocated_capital, available_capital INTO uk_allocated, uk_available
    FROM portfolio_capital WHERE user_id = 'system' AND market = 'UK';

    SELECT allocated_capital, available_capital INTO us_allocated, us_available
    FROM portfolio_capital WHERE user_id = 'system' AND market = 'US';

    RAISE NOTICE '✅ Recalculated allocated capital:';
    RAISE NOTICE '   India: Allocated=₹%, Available=₹%', india_allocated, india_available;
    RAISE NOTICE '   UK: Allocated=£%, Available=£%', uk_allocated, uk_available;
    RAISE NOTICE '   US: Allocated=$%, Available=$%', us_allocated, us_available;
END $$;

COMMIT;
