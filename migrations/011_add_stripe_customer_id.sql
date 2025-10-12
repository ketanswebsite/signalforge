-- Migration: Add stripe_customer_id to users table
-- This column stores the Stripe customer ID for payment processing

ALTER TABLE users
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id
ON users(stripe_customer_id);

-- Add comment
COMMENT ON COLUMN users.stripe_customer_id IS 'Stripe customer ID for payment processing';
