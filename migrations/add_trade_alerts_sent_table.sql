-- Migration: Add trade_alerts_sent table for tracking sent alerts
-- Purpose: Prevent duplicate Telegram alerts from checkTradeAlerts() in server.js
-- Date: 2025-10-26

-- Create tracking table for sent alerts
CREATE TABLE IF NOT EXISTS trade_alerts_sent (
    id SERIAL PRIMARY KEY,
    trade_id INTEGER NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    current_price DECIMAL(15, 2),
    pl_percent DECIMAL(10, 2),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_trade_alert UNIQUE(trade_id, user_id, alert_type)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_trade_alerts_trade_user
ON trade_alerts_sent(trade_id, user_id, alert_type);

CREATE INDEX IF NOT EXISTS idx_trade_alerts_sent_at
ON trade_alerts_sent(sent_at DESC);

COMMENT ON TABLE trade_alerts_sent IS 'Tracks sent Telegram alerts to prevent duplicates from checkTradeAlerts() function';
COMMENT ON COLUMN trade_alerts_sent.trade_id IS 'Reference to trades.id';
COMMENT ON COLUMN trade_alerts_sent.user_id IS 'User identifier (email)';
COMMENT ON COLUMN trade_alerts_sent.alert_type IS 'Type: target_reached, stop_loss, time_exit';
