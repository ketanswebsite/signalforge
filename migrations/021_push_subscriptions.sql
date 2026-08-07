-- Migration: Create push_subscriptions table for Web Push Notifications
-- This table stores push subscription data for each user's browser
-- Schema matches database-postgres.js initializeDatabase() (keyed by user_email,
-- which is what PushService and all queries use). An earlier version of this
-- migration used user_id INTEGER, which conflicts with the application schema
-- and fails on any database bootstrapped by the app itself.

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    endpoint TEXT NOT NULL,
    keys_p256dh TEXT NOT NULL,
    keys_auth TEXT NOT NULL,
    user_agent VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    UNIQUE(endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_email ON push_subscriptions(user_email);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- Add notification preferences column to users table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'notification_preference'
    ) THEN
        ALTER TABLE users ADD COLUMN notification_preference VARCHAR(50) DEFAULT 'telegram';
    END IF;
END $$;

COMMENT ON TABLE push_subscriptions IS 'Stores Web Push notification subscriptions for users';
COMMENT ON COLUMN push_subscriptions.endpoint IS 'The push service endpoint URL';
COMMENT ON COLUMN push_subscriptions.keys_p256dh IS 'Public key for push encryption';
COMMENT ON COLUMN push_subscriptions.keys_auth IS 'Auth secret for push encryption';
COMMENT ON COLUMN push_subscriptions.user_agent IS 'Browser/device info for debugging';
