-- ========================================
-- Migration: 003 - Create Subscription Tables
-- Description: Create complete subscription and payment tracking system
-- Impact: Unlocks subscription feature functionality
-- Estimated Time: 1 hour
-- Date: 2025-10-02
-- ========================================

-- BACKUP RECOMMENDATION:
-- Before running this migration, create a backup:
-- pg_dump -h your-host -U your-user -d your-database > backup_before_003.sql

BEGIN;

-- ========================================
-- 1. SUBSCRIPTION PLANS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL PRIMARY KEY,
    plan_name VARCHAR(50) UNIQUE NOT NULL,
    plan_code VARCHAR(20) UNIQUE NOT NULL,
    region VARCHAR(10) NOT NULL CHECK (region IN ('UK', 'US', 'India', 'Global')),
    currency VARCHAR(3) NOT NULL CHECK (currency IN ('GBP', 'USD', 'INR')),
    price_monthly DECIMAL(10, 2),
    price_quarterly DECIMAL(10, 2),
    price_yearly DECIMAL(10, 2),
    trial_days INTEGER DEFAULT 14,
    max_active_trades INTEGER,
    max_backtests_per_day INTEGER,
    features JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE subscription_plans IS 'Defines available subscription plans and their features';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_region ON subscription_plans(region);

-- Insert default plans
INSERT INTO subscription_plans (plan_name, plan_code, region, currency, price_monthly, price_quarterly, price_yearly, trial_days, max_active_trades, max_backtests_per_day, features)
VALUES
    ('Free Trial', 'FREE', 'Global', 'USD', 0.00, 0.00, 0.00, 14, 5, 10, '{"telegram_alerts": false, "ml_insights": false, "priority_support": false}'),
    ('Basic UK', 'BASIC_UK', 'UK', 'GBP', 9.99, 26.97, 99.99, 14, 20, 50, '{"telegram_alerts": true, "ml_insights": false, "priority_support": false}'),
    ('Pro UK', 'PRO_UK', 'UK', 'GBP', 19.99, 53.97, 199.99, 14, 100, 200, '{"telegram_alerts": true, "ml_insights": true, "priority_support": true}'),
    ('Basic US', 'BASIC_US', 'US', 'USD', 12.99, 34.97, 129.99, 14, 20, 50, '{"telegram_alerts": true, "ml_insights": false, "priority_support": false}'),
    ('Pro US', 'PRO_US', 'US', 'USD', 24.99, 67.47, 249.99, 14, 100, 200, '{"telegram_alerts": true, "ml_insights": true, "priority_support": true}'),
    ('Basic India', 'BASIC_IN', 'India', 'INR', 799.00, 2157.30, 7999.00, 14, 20, 50, '{"telegram_alerts": true, "ml_insights": false, "priority_support": false}'),
    ('Pro India', 'PRO_IN', 'India', 'INR', 1599.00, 4317.30, 15999.00, 14, 100, 200, '{"telegram_alerts": true, "ml_insights": true, "priority_support": true}')
ON CONFLICT (plan_code) DO NOTHING;

-- ========================================
-- 2. USER SUBSCRIPTIONS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    plan_id INTEGER REFERENCES subscription_plans(id),
    plan_name VARCHAR(50) NOT NULL,
    billing_cycle VARCHAR(20) CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly', 'lifetime', 'trial')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'trial', 'expired', 'cancelled', 'payment_failed', 'grace_period')) DEFAULT 'trial',

    -- Trial tracking
    trial_start_date TIMESTAMP,
    trial_end_date TIMESTAMP,

    -- Subscription dates
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    next_billing_date TIMESTAMP,
    cancelled_at TIMESTAMP,

    -- Payment info
    amount_paid DECIMAL(10, 2),
    currency VARCHAR(3),
    payment_method VARCHAR(50),
    last_payment_date TIMESTAMP,

    -- Cancellation tracking
    cancellation_reason TEXT,
    cancelled_by VARCHAR(255),

    -- Usage tracking
    trades_used_this_month INTEGER DEFAULT 0,
    backtests_used_today INTEGER DEFAULT 0,
    last_usage_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Metadata
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE user_subscriptions IS 'Tracks individual user subscriptions and their status';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_email ON user_subscriptions(user_email);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_end_date ON user_subscriptions(end_date) WHERE status IN ('active', 'trial');
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan ON user_subscriptions(plan_id);

-- Ensure one active subscription per user (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_one_active ON user_subscriptions(user_email) WHERE status = 'active';

-- ========================================
-- 3. PAYMENT TRANSACTIONS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS payment_transactions (
    id BIGSERIAL PRIMARY KEY,
    subscription_id INTEGER REFERENCES user_subscriptions(id),
    user_email VARCHAR(255) NOT NULL REFERENCES users(email),

    -- Transaction details
    transaction_id VARCHAR(255) UNIQUE,
    external_payment_id VARCHAR(255),
    payment_provider VARCHAR(50) CHECK (payment_provider IN ('stripe', 'paypal', 'razorpay', 'bank_transfer', 'manual', 'other')),

    -- Amount details
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,

    -- Status
    status VARCHAR(30) NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'disputed', 'cancelled')) DEFAULT 'pending',

    -- Dates
    payment_date TIMESTAMP,
    processed_at TIMESTAMP,

    -- Additional info
    payment_method VARCHAR(50),
    customer_email VARCHAR(255),
    customer_name VARCHAR(255),
    billing_address JSONB,

    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE payment_transactions IS 'Records all payment transactions for audit and reconciliation';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON payment_transactions(user_email);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_subscription ON payment_transactions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_date ON payment_transactions(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_external_id ON payment_transactions(external_payment_id);

-- ========================================
-- 4. PAYMENT VERIFICATION QUEUE TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS payment_verification_queue (
    id BIGSERIAL PRIMARY KEY,
    transaction_id VARCHAR(255),
    user_email VARCHAR(255) NOT NULL,

    -- Verification details
    verification_status VARCHAR(30) NOT NULL CHECK (verification_status IN ('pending', 'verified', 'failed', 'manual_review', 'fraud_check')) DEFAULT 'pending',
    verification_type VARCHAR(50) CHECK (verification_type IN ('automatic', 'manual', 'webhook', 'scheduled')),

    -- Payment provider info
    payment_provider VARCHAR(50),
    external_payment_id VARCHAR(255),

    -- Amount verification
    expected_amount DECIMAL(10, 2),
    received_amount DECIMAL(10, 2),
    currency VARCHAR(3),

    -- Timestamps
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP,
    processed_at TIMESTAMP,

    -- Priority and retry logic
    priority INTEGER DEFAULT 1,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP,

    -- Verification details
    verification_notes TEXT,
    verified_by VARCHAR(255),
    admin_notes TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE payment_verification_queue IS 'Queue for processing and verifying payments';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payment_verification_status ON payment_verification_queue(verification_status);
CREATE INDEX IF NOT EXISTS idx_payment_verification_submitted ON payment_verification_queue(submitted_at);
CREATE INDEX IF NOT EXISTS idx_payment_verification_user ON payment_verification_queue(user_email);
CREATE INDEX IF NOT EXISTS idx_payment_verification_retry ON payment_verification_queue(next_retry_at) WHERE verification_status = 'pending';

-- ========================================
-- 5. SUBSCRIPTION HISTORY TABLE (Audit Log)
-- ========================================

CREATE TABLE IF NOT EXISTS subscription_history (
    id BIGSERIAL PRIMARY KEY,
    subscription_id INTEGER REFERENCES user_subscriptions(id) ON DELETE CASCADE,
    user_email VARCHAR(255) NOT NULL,

    -- Event tracking
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'created', 'activated', 'renewed', 'upgraded', 'downgraded',
        'cancelled', 'expired', 'payment_failed', 'reactivated', 'trial_started', 'trial_ended'
    )),

    -- State changes
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    old_plan VARCHAR(50),
    new_plan VARCHAR(50),

    -- Details
    description TEXT,
    triggered_by VARCHAR(255),

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE subscription_history IS 'Audit log of all subscription status changes';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscription_history_subscription ON subscription_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_user ON subscription_history(user_email);
CREATE INDEX IF NOT EXISTS idx_subscription_history_event ON subscription_history(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_history_date ON subscription_history(created_at DESC);

-- ========================================
-- 6. TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- ========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to subscription tables
DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_transactions_updated_at ON payment_transactions;
CREATE TRIGGER update_payment_transactions_updated_at
    BEFORE UPDATE ON payment_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_verification_queue_updated_at ON payment_verification_queue;
CREATE TRIGGER update_payment_verification_queue_updated_at
    BEFORE UPDATE ON payment_verification_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_name IN (
        'subscription_plans',
        'user_subscriptions',
        'payment_transactions',
        'payment_verification_queue',
        'subscription_history'
    );

    IF table_count = 5 THEN
        RAISE NOTICE '✅ SUCCESS: All 5 subscription tables created successfully';
    ELSE
        RAISE WARNING '⚠️  Expected 5 tables, found %', table_count;
    END IF;
END $$;

-- Show table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size
FROM pg_tables
WHERE tablename IN (
    'subscription_plans',
    'user_subscriptions',
    'payment_transactions',
    'payment_verification_queue',
    'subscription_history'
)
ORDER BY tablename;

-- Show default plans inserted
SELECT id, plan_name, plan_code, region, currency, price_monthly, max_active_trades
FROM subscription_plans
ORDER BY region, price_monthly;

COMMIT;

-- ========================================
-- ROLLBACK SCRIPT (Run if needed)
-- ========================================
/*
BEGIN;

DROP TABLE IF EXISTS subscription_history CASCADE;
DROP TABLE IF EXISTS payment_verification_queue CASCADE;
DROP TABLE IF EXISTS payment_transactions CASCADE;
DROP TABLE IF EXISTS user_subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;

COMMIT;
*/

-- ========================================
-- HELPER QUERIES FOR ADMIN
-- ========================================

-- Create a view for active subscriptions
CREATE OR REPLACE VIEW v_active_subscriptions AS
SELECT
    us.id,
    us.user_email,
    u.name as user_name,
    us.plan_name,
    us.status,
    us.billing_cycle,
    us.start_date,
    us.end_date,
    us.next_billing_date,
    us.amount_paid,
    us.currency,
    CASE
        WHEN us.status = 'trial' THEN us.trial_end_date
        ELSE us.end_date
    END as expires_at,
    sp.max_active_trades,
    sp.max_backtests_per_day,
    us.trades_used_this_month,
    us.backtests_used_today
FROM user_subscriptions us
LEFT JOIN users u ON us.user_email = u.email
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE us.status IN ('active', 'trial');

COMMENT ON VIEW v_active_subscriptions IS 'Quick view of all active subscriptions with user details';

-- ========================================
-- MIGRATION COMPLETE
-- ========================================
-- Next Migration: 004_consolidate_columns.sql
