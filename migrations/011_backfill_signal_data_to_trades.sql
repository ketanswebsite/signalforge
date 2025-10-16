-- ========================================
-- Migration: 011 - Backfill Signal Data to Existing Trades
-- Description: Update existing trades with signal data from pending_signals table
-- Date: 2025-10-16
-- ========================================

BEGIN;

-- Update existing trades with signal data from pending_signals
UPDATE trades t
SET
  win_rate = ps.win_rate,
  historical_signal_count = ps.historical_signal_count,
  signal_date = ps.signal_date,
  market = ps.market,
  auto_added = true,
  entry_dti = ps.entry_dti,
  entry_7day_dti = ps.entry_7day_dti,
  prev_dti = ps.prev_dti,
  prev_7day_dti = ps.prev_7day_dti
FROM pending_signals ps
WHERE ps.added_to_trade_id = t.id
  AND t.win_rate IS NULL;  -- Only update trades that don't have signal data

-- Log the number of trades updated
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM trades t
    INNER JOIN pending_signals ps ON ps.added_to_trade_id = t.id
    WHERE t.win_rate IS NOT NULL;

    RAISE NOTICE '✅ Backfilled signal data for % trades', updated_count;
END $$;

COMMIT;
