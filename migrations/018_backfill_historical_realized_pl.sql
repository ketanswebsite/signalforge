-- Backfill historical realized P/L from closed trades
-- This corrects the realized_pl that wasn't updated due to the bug
-- in capital-manager.js releaseFromTrade() function before it was fixed on 2025-10-26
--
-- Bug: Field name mismatches prevented realized_pl from being updated when trades closed
-- Fix: Now deployed (commit f532ce4), but historical data needs backfill
-- Impact: AXL trade closed with $219.96 profit but realized_pl stayed at 0

-- Update US Market (stocks without .NS or .L suffix)
UPDATE portfolio_capital
SET realized_pl = (
    SELECT COALESCE(SUM(profit_loss), 0)
    FROM trades
    WHERE status = 'closed'
      AND user_id = 'ketanjoshisahs@gmail.com'
      AND symbol NOT LIKE '%.NS'
      AND symbol NOT LIKE '%.L'
      AND profit_loss IS NOT NULL
),
available_capital = initial_capital + (
    SELECT COALESCE(SUM(profit_loss), 0)
    FROM trades
    WHERE status = 'closed'
      AND user_id = 'ketanjoshisahs@gmail.com'
      AND symbol NOT LIKE '%.NS'
      AND symbol NOT LIKE '%.L'
      AND profit_loss IS NOT NULL
) - allocated_capital,
updated_at = CURRENT_TIMESTAMP
WHERE user_id = 'system' AND market = 'US';

-- Update India Market (.NS suffix stocks)
UPDATE portfolio_capital
SET realized_pl = (
    SELECT COALESCE(SUM(profit_loss), 0)
    FROM trades
    WHERE status = 'closed'
      AND user_id = 'ketanjoshisahs@gmail.com'
      AND symbol LIKE '%.NS'
      AND profit_loss IS NOT NULL
),
available_capital = initial_capital + (
    SELECT COALESCE(SUM(profit_loss), 0)
    FROM trades
    WHERE status = 'closed'
      AND user_id = 'ketanjoshisahs@gmail.com'
      AND symbol LIKE '%.NS'
      AND profit_loss IS NOT NULL
) - allocated_capital,
updated_at = CURRENT_TIMESTAMP
WHERE user_id = 'system' AND market = 'India';

-- Update UK Market (.L suffix stocks)
UPDATE portfolio_capital
SET realized_pl = (
    SELECT COALESCE(SUM(profit_loss), 0)
    FROM trades
    WHERE status = 'closed'
      AND user_id = 'ketanjoshisahs@gmail.com'
      AND symbol LIKE '%.L'
      AND profit_loss IS NOT NULL
),
available_capital = initial_capital + (
    SELECT COALESCE(SUM(profit_loss), 0)
    FROM trades
    WHERE status = 'closed'
      AND user_id = 'ketanjoshisahs@gmail.com'
      AND symbol LIKE '%.L'
      AND profit_loss IS NOT NULL
) - allocated_capital,
updated_at = CURRENT_TIMESTAMP
WHERE user_id = 'system' AND market = 'UK';
