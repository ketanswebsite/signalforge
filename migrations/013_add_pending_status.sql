-- ========================================
-- Migration: 013 - Add 'pending' Status to user_subscriptions
-- Description: Add 'pending' as a valid status for subscriptions awaiting payment
-- Impact: Enables checkout flow to create pending subscriptions
-- Date: 2025-10-13
-- ========================================

BEGIN;

-- ========================================
-- DROP OLD CONSTRAINT AND ADD NEW ONE WITH 'pending'
-- ========================================

-- Drop the existing constraint
ALTER TABLE user_subscriptions
DROP CONSTRAINT IF EXISTS user_subscriptions_status_check;

-- Add new constraint with 'pending' included
ALTER TABLE user_subscriptions
ADD CONSTRAINT user_subscriptions_status_check
CHECK (status IN (
    'pending',        -- NEW: For subscriptions awaiting payment confirmation
    'active',         -- Paid subscription is active
    'trial',          -- User is on free trial
    'expired',        -- Subscription has expired
    'cancelled',      -- User cancelled subscription
    'payment_failed', -- Payment attempt failed
    'grace_period'    -- Grace period after payment failure
));

COMMENT ON CONSTRAINT user_subscriptions_status_check ON user_subscriptions IS
'Valid subscription status values including pending for awaiting payment';

-- ========================================
-- VERIFICATION
-- ========================================

DO $$
DECLARE
    constraint_def TEXT;
BEGIN
    -- Get the constraint definition
    SELECT pg_get_constraintdef(oid) INTO constraint_def
    FROM pg_constraint
    WHERE conname = 'user_subscriptions_status_check';

    -- Check if 'pending' is in the constraint
    IF constraint_def LIKE '%pending%' THEN
        RAISE NOTICE '✅ SUCCESS: Constraint updated successfully';
        RAISE NOTICE '   Allowed statuses now include: pending, active, trial, expired, cancelled, payment_failed, grace_period';
    ELSE
        RAISE WARNING '⚠️  Constraint may not have been updated correctly';
    END IF;
END $$;

COMMIT;

-- ========================================
-- ROLLBACK SCRIPT (if needed)
-- ========================================
/*
BEGIN;

-- Restore original constraint without 'pending'
ALTER TABLE user_subscriptions
DROP CONSTRAINT user_subscriptions_status_check;

ALTER TABLE user_subscriptions
ADD CONSTRAINT user_subscriptions_status_check
CHECK (status IN (
    'active',
    'trial',
    'expired',
    'cancelled',
    'payment_failed',
    'grace_period'
));

COMMIT;
*/
