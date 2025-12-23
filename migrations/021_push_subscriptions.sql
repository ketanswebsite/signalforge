-- Migration: Create push_subscriptions table for Web Push Notifications
-- This table stores push subscription data for each user's browser
-- Run this migration to enable Web Push Notifications feature

-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    keys_p256dh TEXT NOT NULL,
    keys_auth TEXT NOT NULL,
    user_agent VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    UNIQUE(endpoint)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
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

-- Comment on table
COMMENT ON TABLE push_subscriptions IS 'Stores Web Push notification subscriptions for users';
COMMENT ON COLUMN push_subscriptions.endpoint IS 'The push service endpoint URL';
COMMENT ON COLUMN push_subscriptions.keys_p256dh IS 'Public key for push encryption';
COMMENT ON COLUMN push_subscriptions.keys_auth IS 'Auth secret for push encryption';
COMMENT ON COLUMN push_subscriptions.user_agent IS 'Browser/device info for debugging';
