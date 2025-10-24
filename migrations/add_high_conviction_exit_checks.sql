-- Migration: Add high_conviction_exit_checks table for duplicate alert prevention
-- Purpose: Track exit checks and alerts for high conviction trades to prevent duplicate Telegram messages
-- Date: 2025-10-24

CREATE TABLE IF NOT EXISTS high_conviction_exit_checks (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    check_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    current_price DECIMAL(15, 2),
    pl_percent DECIMAL(10, 2),
    days_held INTEGER,
    target_reached BOOLEAN DEFAULT false,
    stop_loss_hit BOOLEAN DEFAULT false,
    max_days_reached BOOLEAN DEFAULT false,
    alert_sent BOOLEAN DEFAULT false,
    alert_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups when checking if alert was sent
CREATE INDEX IF NOT EXISTS idx_hc_exit_checks_symbol_alert
ON high_conviction_exit_checks(symbol, alert_sent, alert_type);

-- Create index for recent checks
CREATE INDEX IF NOT EXISTS idx_hc_exit_checks_check_time
ON high_conviction_exit_checks(check_time DESC);

COMMENT ON TABLE high_conviction_exit_checks IS 'Tracks exit condition checks and alerts for high conviction trades to prevent duplicate notifications';
COMMENT ON COLUMN high_conviction_exit_checks.symbol IS 'Stock symbol (e.g., AAPL, DIXON.NS)';
COMMENT ON COLUMN high_conviction_exit_checks.alert_type IS 'Type of alert: take_profit, stop_loss, max_days';
