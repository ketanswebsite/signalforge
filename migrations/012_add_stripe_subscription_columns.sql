-- ========================================
-- Migration: 012 - Add Stripe Subscription Columns
-- Description: Add missing columns for Stripe payment integration
-- Impact: Enables checkout flow to work properly
-- Date: 2025-10-13
-- ========================================

BEGIN;

-- ========================================
-- 1. ADD updated_at TO users TABLE
-- ========================================

-- Add updated_at column to users table (required for Stripe customer ID updates)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add trigger to auto-update updated_at timestamp
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON COLUMN users.updated_at IS 'Timestamp of last update to user record';

-- ========================================
-- 2. ADD STRIPE COLUMNS TO user_subscriptions TABLE
-- ========================================

-- Add Stripe-specific columns
ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS plan_code VARCHAR(20);

ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS billing_period VARCHAR(20)
CHECK (billing_period IN ('monthly', 'quarterly', 'annual', NULL));

ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP;

ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP;

ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);

ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255);

ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT false;

ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS cancellation_date TIMESTAMP;

-- Add column comments
COMMENT ON COLUMN user_subscriptions.plan_code IS 'Plan code for Stripe integration (e.g., BASIC_US, PRO_UK)';
COMMENT ON COLUMN user_subscriptions.billing_period IS 'Billing period for Stripe subscriptions (monthly, quarterly, annual)';
COMMENT ON COLUMN user_subscriptions.subscription_start_date IS 'Subscription start date for Stripe';
COMMENT ON COLUMN user_subscriptions.subscription_end_date IS 'Subscription end date for Stripe';
COMMENT ON COLUMN user_subscriptions.stripe_customer_id IS 'Stripe customer ID';
COMMENT ON COLUMN user_subscriptions.stripe_subscription_id IS 'Stripe subscription ID';
COMMENT ON COLUMN user_subscriptions.stripe_payment_intent_id IS 'Stripe payment intent ID';
COMMENT ON COLUMN user_subscriptions.auto_renew IS 'Whether subscription auto-renews';
COMMENT ON COLUMN user_subscriptions.cancellation_date IS 'Date subscription was cancelled';

-- ========================================
-- 3. ADD INDEXES FOR PERFORMANCE
-- ========================================

-- Create indexes for Stripe lookup columns
CREATE INDEX IF NOT EXISTS idx_user_subs_stripe_customer
ON user_subscriptions(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_user_subs_stripe_sub
ON user_subscriptions(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_user_subs_stripe_payment
ON user_subscriptions(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_user_subs_plan_code
ON user_subscriptions(plan_code);

CREATE INDEX IF NOT EXISTS idx_user_subs_billing_period
ON user_subscriptions(billing_period);

-- ========================================
-- 4. DATA MIGRATION (Sync existing data)
-- ========================================

-- Copy data from old columns to new columns for backward compatibility
UPDATE user_subscriptions
SET
    subscription_start_date = start_date,
    subscription_end_date = end_date,
    billing_period = CASE
        WHEN billing_cycle = 'yearly' THEN 'annual'
        ELSE billing_cycle
    END
WHERE subscription_start_date IS NULL;

-- ========================================
-- 5. VERIFICATION
-- ========================================

DO $$
DECLARE
    users_updated_at_exists BOOLEAN;
    user_subs_columns_count INTEGER;
BEGIN
    -- Check if users.updated_at exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'updated_at'
    ) INTO users_updated_at_exists;

    -- Count new columns in user_subscriptions
    SELECT COUNT(*) INTO user_subs_columns_count
    FROM information_schema.columns
    WHERE table_name = 'user_subscriptions'
    AND column_name IN (
        'plan_code', 'billing_period', 'subscription_start_date',
        'subscription_end_date', 'stripe_customer_id', 'stripe_subscription_id',
        'stripe_payment_intent_id', 'auto_renew', 'cancellation_date'
    );

    IF users_updated_at_exists AND user_subs_columns_count = 9 THEN
        RAISE NOTICE '✅ SUCCESS: All columns added successfully';
        RAISE NOTICE '   - users.updated_at: %', users_updated_at_exists;
        RAISE NOTICE '   - user_subscriptions new columns: %/9', user_subs_columns_count;
    ELSE
        RAISE WARNING '⚠️  Migration incomplete:';
        RAISE WARNING '   - users.updated_at: %', users_updated_at_exists;
        RAISE WARNING '   - user_subscriptions columns: %/9', user_subs_columns_count;
    END IF;
END $$;

COMMIT;

-- ========================================
-- ROLLBACK SCRIPT (if needed)
-- ========================================
/*
BEGIN;

-- Remove columns from user_subscriptions
ALTER TABLE user_subscriptions DROP COLUMN IF EXISTS plan_code;
ALTER TABLE user_subscriptions DROP COLUMN IF EXISTS billing_period;
ALTER TABLE user_subscriptions DROP COLUMN IF EXISTS subscription_start_date;
ALTER TABLE user_subscriptions DROP COLUMN IF EXISTS subscription_end_date;
ALTER TABLE user_subscriptions DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE user_subscriptions DROP COLUMN IF EXISTS stripe_subscription_id;
ALTER TABLE user_subscriptions DROP COLUMN IF EXISTS stripe_payment_intent_id;
ALTER TABLE user_subscriptions DROP COLUMN IF EXISTS auto_renew;
ALTER TABLE user_subscriptions DROP COLUMN IF EXISTS cancellation_date;

-- Remove trigger and column from users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
ALTER TABLE users DROP COLUMN IF EXISTS updated_at;

COMMIT;
*/
