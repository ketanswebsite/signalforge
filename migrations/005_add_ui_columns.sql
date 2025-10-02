-- ========================================
-- Migration: 005 - Add Missing UI-Required Columns
-- Description: Add columns for enhanced UI features and tracking
-- Impact: Enables enhanced UI features and better data organization
-- Estimated Time: 20 minutes
-- Date: 2025-10-02
-- ========================================

-- BACKUP RECOMMENDATION:
-- Before running this migration, create a backup:
-- pg_dump -h your-host -U your-user -d your-database > backup_before_005.sql

BEGIN;

-- ========================================
-- ADD NEW COLUMNS TO TRADES TABLE
-- ========================================

-- 1. Trade Tags/Categories (for organization and filtering)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS trade_tags TEXT[];
COMMENT ON COLUMN trades.trade_tags IS 'Array of tags for categorizing trades (e.g., [''momentum'', ''breakout'', ''dti''])';

-- 2. Confidence Level (trader's confidence in the setup)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS confidence_level VARCHAR(20) CHECK (confidence_level IN ('low', 'medium', 'high', 'very high', NULL));
COMMENT ON COLUMN trades.confidence_level IS 'Trader confidence in this setup (low/medium/high/very high)';

-- 3. Risk/Reward Ratio at Entry
ALTER TABLE trades ADD COLUMN IF NOT EXISTS risk_reward_ratio DECIMAL(8,4);
COMMENT ON COLUMN trades.risk_reward_ratio IS 'Risk/reward ratio calculated at entry (e.g., 2.5 means 2.5x potential reward vs risk)';

-- 4. Entry Type (manual vs automated)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS entry_type VARCHAR(20) DEFAULT 'manual' CHECK (entry_type IN ('manual', 'automated', 'alert', 'scan', NULL));
COMMENT ON COLUMN trades.entry_type IS 'How the trade was entered (manual/automated/alert/scan)';

-- 5. Exchange Rate Snapshot (for multi-currency tracking)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS exchange_rate_snapshot DECIMAL(10,6);
COMMENT ON COLUMN trades.exchange_rate_snapshot IS 'Exchange rate at entry time for currency conversion tracking';

-- 6. Base Currency (for portfolio-level P&L)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS base_currency VARCHAR(3) DEFAULT 'GBP';
COMMENT ON COLUMN trades.base_currency IS 'Base currency for P&L calculations (GBP/USD/INR)';

-- 7. Converted Investment Amount (in base currency)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS investment_amount_base DECIMAL(12,4);
COMMENT ON COLUMN trades.investment_amount_base IS 'Investment amount converted to base currency for portfolio totals';

-- 8. Converted P&L (in base currency)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS profit_loss_base DECIMAL(12,4);
COMMENT ON COLUMN trades.profit_loss_base IS 'Profit/loss converted to base currency for portfolio totals';

-- 9. Last Price Update Timestamp
ALTER TABLE trades ADD COLUMN IF NOT EXISTS last_price_update TIMESTAMP;
COMMENT ON COLUMN trades.last_price_update IS 'Timestamp of last real-time price update for active trades';

-- 10. Current Market Price (for active trades)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS current_market_price DECIMAL(12,4);
COMMENT ON COLUMN trades.current_market_price IS 'Latest market price for active trades (updated via price feed)';

-- 11. Unrealized P&L Amount (for active trades)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS unrealized_pl DECIMAL(12,4);
COMMENT ON COLUMN trades.unrealized_pl IS 'Current unrealized profit/loss for active trades';

-- 12. Unrealized P&L Percentage (for active trades)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS unrealized_pl_percentage DECIMAL(8,4);
COMMENT ON COLUMN trades.unrealized_pl_percentage IS 'Current unrealized P&L as percentage for active trades';

-- 13. Trade Strategy/Setup Name
ALTER TABLE trades ADD COLUMN IF NOT EXISTS strategy_name VARCHAR(100);
COMMENT ON COLUMN trades.strategy_name IS 'Name of the trading strategy used (e.g., ''DTI Oversold Bounce'', ''Breakout'')';

-- 14. Technical Setup Description
ALTER TABLE trades ADD COLUMN IF NOT EXISTS technical_setup TEXT;
COMMENT ON COLUMN trades.technical_setup IS 'Detailed description of the technical setup at entry';

-- 15. Chart Screenshot URL (optional cloud storage link)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS chart_screenshot_url VARCHAR(500);
COMMENT ON COLUMN trades.chart_screenshot_url IS 'URL to chart screenshot at entry time';

-- 16. Trade Duration in Days (calculated field for reporting)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS duration_days INTEGER;
COMMENT ON COLUMN trades.duration_days IS 'Trade duration in days (exit_date - entry_date)';

-- 17. Exit Type/Reason Category
ALTER TABLE trades ADD COLUMN IF NOT EXISTS exit_type VARCHAR(30) CHECK (exit_type IN (
    'take_profit', 'stop_loss', 'time_exit', 'manual', 'trailing_stop', 'breakeven', 'signal_reversal', NULL
));
COMMENT ON COLUMN trades.exit_type IS 'Categorized exit reason for analytics';

-- 18. Market Conditions at Entry
ALTER TABLE trades ADD COLUMN IF NOT EXISTS market_condition VARCHAR(30) CHECK (market_condition IN (
    'bullish', 'bearish', 'neutral', 'volatile', 'ranging', NULL
));
COMMENT ON COLUMN trades.market_condition IS 'Overall market condition assessment at entry';

-- 19. Sector/Industry
ALTER TABLE trades ADD COLUMN IF NOT EXISTS sector VARCHAR(100);
COMMENT ON COLUMN trades.sector IS 'Stock sector/industry (e.g., ''Technology'', ''Healthcare'')';

-- 20. Is Paper Trade (for practice/testing)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS is_paper_trade BOOLEAN DEFAULT false;
COMMENT ON COLUMN trades.is_paper_trade IS 'True if this is a paper/simulated trade, false for real money';

-- 21. Broker/Account Name (for multi-account tracking)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS broker_account VARCHAR(100);
COMMENT ON COLUMN trades.broker_account IS 'Broker or account name where trade was executed';

-- 22. Commission/Fees Paid
ALTER TABLE trades ADD COLUMN IF NOT EXISTS commission_paid DECIMAL(12,4) DEFAULT 0;
COMMENT ON COLUMN trades.commission_paid IS 'Total commission and fees paid for this trade';

-- 23. Net P&L (after commissions)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS net_profit_loss DECIMAL(12,4);
COMMENT ON COLUMN trades.net_profit_loss IS 'Profit/loss after deducting commissions and fees';

-- 24. Favorite/Star Flag
ALTER TABLE trades ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;
COMMENT ON COLUMN trades.is_favorite IS 'User can star/favorite important trades for quick access';

-- 25. Review Status (for trade journal)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS review_status VARCHAR(30) CHECK (review_status IN (
    'not_reviewed', 'reviewed', 'needs_analysis', 'lessons_learned', NULL
)) DEFAULT 'not_reviewed';
COMMENT ON COLUMN trades.review_status IS 'Trade review status for journaling and learning';

-- 26. Trade Rating (self-evaluation)
ALTER TABLE trades ADD COLUMN IF NOT EXISTS trade_rating INTEGER CHECK (trade_rating BETWEEN 1 AND 5);
COMMENT ON COLUMN trades.trade_rating IS 'Self-rated trade quality from 1 (poor) to 5 (excellent)';

-- 27. Lessons Learned
ALTER TABLE trades ADD COLUMN IF NOT EXISTS lessons_learned TEXT;
COMMENT ON COLUMN trades.lessons_learned IS 'Key takeaways and lessons from this trade';

-- ========================================
-- ADD INDEXES ON NEW COLUMNS
-- ========================================

-- Index on trade_tags for filtering by tag
CREATE INDEX IF NOT EXISTS idx_trades_tags ON trades USING GIN(trade_tags);

-- Index on confidence_level for filtering
CREATE INDEX IF NOT EXISTS idx_trades_confidence ON trades(confidence_level) WHERE confidence_level IS NOT NULL;

-- Index on entry_type for analytics
CREATE INDEX IF NOT EXISTS idx_trades_entry_type ON trades(entry_type);

-- Index on last_price_update for active trades refresh
CREATE INDEX IF NOT EXISTS idx_trades_price_update ON trades(last_price_update DESC) WHERE status = 'active';

-- Index on strategy_name for performance analysis by strategy
CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades(strategy_name);

-- Index on exit_type for exit reason analytics
CREATE INDEX IF NOT EXISTS idx_trades_exit_type ON trades(exit_type);

-- Index on sector for sector performance analysis
CREATE INDEX IF NOT EXISTS idx_trades_sector ON trades(sector);

-- Index on is_paper_trade for filtering
CREATE INDEX IF NOT EXISTS idx_trades_paper ON trades(is_paper_trade);

-- Index on broker_account for multi-account filtering
CREATE INDEX IF NOT EXISTS idx_trades_broker ON trades(broker_account);

-- Index on is_favorite for quick access
CREATE INDEX IF NOT EXISTS idx_trades_favorite ON trades(is_favorite) WHERE is_favorite = true;

-- Index on review_status for trade journal workflow
CREATE INDEX IF NOT EXISTS idx_trades_review_status ON trades(review_status);

-- ========================================
-- CREATE TRIGGER TO AUTO-CALCULATE FIELDS
-- ========================================

-- Function to auto-calculate derived fields
CREATE OR REPLACE FUNCTION calculate_trade_derived_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate duration_days when trade is closed
    IF NEW.status = 'closed' AND NEW.entry_date IS NOT NULL AND NEW.exit_date IS NOT NULL THEN
        NEW.duration_days = EXTRACT(DAY FROM (NEW.exit_date - NEW.entry_date))::INTEGER;
    END IF;

    -- Calculate risk/reward ratio if not set
    IF NEW.risk_reward_ratio IS NULL AND NEW.entry_price > 0 AND NEW.stop_loss_percent > 0 AND NEW.take_profit_percent > 0 THEN
        NEW.risk_reward_ratio = NEW.take_profit_percent / NEW.stop_loss_percent;
    END IF;

    -- Calculate investment_amount_base using exchange rate
    IF NEW.investment_amount IS NOT NULL AND NEW.exchange_rate_snapshot IS NOT NULL AND NEW.currency_symbol != NEW.base_currency THEN
        NEW.investment_amount_base = NEW.investment_amount * NEW.exchange_rate_snapshot;
    ELSIF NEW.investment_amount IS NOT NULL AND NEW.currency_symbol = NEW.base_currency THEN
        NEW.investment_amount_base = NEW.investment_amount;
    END IF;

    -- Calculate profit_loss_base
    IF NEW.profit_loss IS NOT NULL AND NEW.exchange_rate_snapshot IS NOT NULL AND NEW.currency_symbol != NEW.base_currency THEN
        NEW.profit_loss_base = NEW.profit_loss * NEW.exchange_rate_snapshot;
    ELSIF NEW.profit_loss IS NOT NULL AND NEW.currency_symbol = NEW.base_currency THEN
        NEW.profit_loss_base = NEW.profit_loss;
    END IF;

    -- Calculate net P&L (after commissions)
    IF NEW.profit_loss IS NOT NULL THEN
        NEW.net_profit_loss = NEW.profit_loss - COALESCE(NEW.commission_paid, 0);
    END IF;

    -- Calculate unrealized P&L for active trades
    IF NEW.status = 'active' AND NEW.current_market_price IS NOT NULL AND NEW.entry_price > 0 AND NEW.shares > 0 THEN
        NEW.unrealized_pl = (NEW.current_market_price - NEW.entry_price) * NEW.shares;
        NEW.unrealized_pl_percentage = ((NEW.current_market_price - NEW.entry_price) / NEW.entry_price) * 100;
    END IF;

    -- Update last_price_update timestamp when current_market_price changes
    IF TG_OP = 'UPDATE' AND NEW.current_market_price IS DISTINCT FROM OLD.current_market_price THEN
        NEW.last_price_update = CURRENT_TIMESTAMP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_calculate_trade_fields ON trades;
CREATE TRIGGER trigger_calculate_trade_fields
    BEFORE INSERT OR UPDATE ON trades
    FOR EACH ROW
    EXECUTE FUNCTION calculate_trade_derived_fields();

COMMENT ON FUNCTION calculate_trade_derived_fields IS 'Auto-calculates derived fields like duration, R:R ratio, and currency conversions';

-- ========================================
-- CREATE HELPER VIEWS
-- ========================================

-- View for active trades with unrealized P&L
CREATE OR REPLACE VIEW v_active_trades_with_pl AS
SELECT
    t.*,
    CASE
        WHEN t.current_market_price IS NOT NULL AND t.entry_price > 0
        THEN (t.current_market_price - t.entry_price) * t.shares
        ELSE NULL
    END as current_unrealized_pl,
    CASE
        WHEN t.current_market_price IS NOT NULL AND t.entry_price > 0
        THEN ((t.current_market_price - t.entry_price) / t.entry_price) * 100
        ELSE NULL
    END as current_unrealized_pl_pct
FROM trades t
WHERE t.status = 'active';

COMMENT ON VIEW v_active_trades_with_pl IS 'Active trades with real-time unrealized P&L calculations';

-- View for trade journal (trades needing review)
CREATE OR REPLACE VIEW v_trades_for_review AS
SELECT
    t.id,
    t.symbol,
    t.entry_date,
    t.exit_date,
    t.profit_loss,
    t.profit_loss_percentage,
    t.strategy_name,
    t.review_status,
    t.trade_rating,
    t.notes,
    t.lessons_learned
FROM trades t
WHERE t.status = 'closed'
  AND t.review_status IN ('not_reviewed', 'needs_analysis')
ORDER BY t.exit_date DESC;

COMMENT ON VIEW v_trades_for_review IS 'Closed trades that need review for trade journaling';

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Count new columns added
DO $$
DECLARE
    new_columns_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO new_columns_count
    FROM information_schema.columns
    WHERE table_name = 'trades'
      AND column_name IN (
        'trade_tags', 'confidence_level', 'risk_reward_ratio', 'entry_type',
        'exchange_rate_snapshot', 'base_currency', 'investment_amount_base',
        'profit_loss_base', 'last_price_update', 'current_market_price',
        'unrealized_pl', 'unrealized_pl_percentage', 'strategy_name',
        'technical_setup', 'chart_screenshot_url', 'duration_days',
        'exit_type', 'market_condition', 'sector', 'is_paper_trade',
        'broker_account', 'commission_paid', 'net_profit_loss', 'is_favorite',
        'review_status', 'trade_rating', 'lessons_learned'
      );

    IF new_columns_count = 27 THEN
        RAISE NOTICE '✅ SUCCESS: All 27 new columns added successfully';
    ELSE
        RAISE WARNING '⚠️  Expected 27 columns, found %', new_columns_count;
    END IF;
END $$;

-- Show updated table structure
SELECT
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'trades'
  AND column_name IN (
    'trade_tags', 'confidence_level', 'risk_reward_ratio', 'entry_type',
    'strategy_name', 'exit_type', 'sector', 'is_paper_trade', 'is_favorite'
  )
ORDER BY column_name;

COMMIT;

-- ========================================
-- ROLLBACK SCRIPT (Run if needed)
-- ========================================
/*
BEGIN;

ALTER TABLE trades DROP COLUMN IF EXISTS trade_tags;
ALTER TABLE trades DROP COLUMN IF EXISTS confidence_level;
ALTER TABLE trades DROP COLUMN IF EXISTS risk_reward_ratio;
ALTER TABLE trades DROP COLUMN IF EXISTS entry_type;
ALTER TABLE trades DROP COLUMN IF EXISTS exchange_rate_snapshot;
ALTER TABLE trades DROP COLUMN IF EXISTS base_currency;
ALTER TABLE trades DROP COLUMN IF EXISTS investment_amount_base;
ALTER TABLE trades DROP COLUMN IF EXISTS profit_loss_base;
ALTER TABLE trades DROP COLUMN IF EXISTS last_price_update;
ALTER TABLE trades DROP COLUMN IF EXISTS current_market_price;
ALTER TABLE trades DROP COLUMN IF EXISTS unrealized_pl;
ALTER TABLE trades DROP COLUMN IF EXISTS unrealized_pl_percentage;
ALTER TABLE trades DROP COLUMN IF EXISTS strategy_name;
ALTER TABLE trades DROP COLUMN IF EXISTS technical_setup;
ALTER TABLE trades DROP COLUMN IF EXISTS chart_screenshot_url;
ALTER TABLE trades DROP COLUMN IF EXISTS duration_days;
ALTER TABLE trades DROP COLUMN IF EXISTS exit_type;
ALTER TABLE trades DROP COLUMN IF EXISTS market_condition;
ALTER TABLE trades DROP COLUMN IF EXISTS sector;
ALTER TABLE trades DROP COLUMN IF EXISTS is_paper_trade;
ALTER TABLE trades DROP COLUMN IF EXISTS broker_account;
ALTER TABLE trades DROP COLUMN IF EXISTS commission_paid;
ALTER TABLE trades DROP COLUMN IF EXISTS net_profit_loss;
ALTER TABLE trades DROP COLUMN IF EXISTS is_favorite;
ALTER TABLE trades DROP COLUMN IF EXISTS review_status;
ALTER TABLE trades DROP COLUMN IF EXISTS trade_rating;
ALTER TABLE trades DROP COLUMN IF EXISTS lessons_learned;

DROP TRIGGER IF EXISTS trigger_calculate_trade_fields ON trades;
DROP FUNCTION IF EXISTS calculate_trade_derived_fields;
DROP VIEW IF EXISTS v_active_trades_with_pl;
DROP VIEW IF EXISTS v_trades_for_review;

COMMIT;
*/

-- ========================================
-- USAGE EXAMPLES
-- ========================================

-- Example 1: Add tags to a trade
-- UPDATE trades SET trade_tags = ARRAY['momentum', 'breakout', 'high-volume'] WHERE id = 123;

-- Example 2: Mark trade as favorite
-- UPDATE trades SET is_favorite = true WHERE id = 456;

-- Example 3: Update review status after analyzing trade
-- UPDATE trades SET review_status = 'reviewed', trade_rating = 4, lessons_learned = 'Entered too early, should wait for confirmation' WHERE id = 789;

-- Example 4: Filter trades by tag
-- SELECT * FROM trades WHERE 'dti' = ANY(trade_tags);

-- Example 5: Get all unreviewed closed trades
-- SELECT * FROM v_trades_for_review;

-- ========================================
-- MIGRATION COMPLETE
-- ========================================
-- Next Migration: 006_optimize_data_types.sql
