-- ========================================
-- Migration: 009 - Update Trial Period to 90 Days
-- Description: Update existing subscription plans and trials from 14 to 90 days
-- Impact: Extends trial period for all users and plans
-- Estimated Time: 1 minute
-- Date: 2025-10-12
-- ========================================

BEGIN;

-- Update all subscription plans to have 90-day trials
UPDATE subscription_plans
SET trial_days = 90
WHERE trial_days = 14 OR trial_days < 90;

-- Update existing trial subscriptions to extend their trial period
-- Only update trials that haven't expired yet
UPDATE user_subscriptions
SET trial_end_date = trial_start_date + INTERVAL '90 days'
WHERE status = 'trial'
  AND trial_start_date IS NOT NULL
  AND trial_end_date IS NOT NULL
  AND trial_end_date > NOW(); -- Only extend active trials

-- Log the changes in subscription history
INSERT INTO subscription_history (subscription_id, user_email, event_type, old_status, new_status, description, triggered_by)
SELECT
    id,
    user_email,
    'trial_extended',
    status,
    status,
    'Trial period extended from 14 to 90 days',
    'system_migration'
FROM user_subscriptions
WHERE status = 'trial'
  AND trial_start_date IS NOT NULL
  AND trial_end_date > NOW();

-- Verification
DO $$
DECLARE
    updated_plans INTEGER;
    updated_subscriptions INTEGER;
BEGIN
    -- Count updated plans
    SELECT COUNT(*) INTO updated_plans
    FROM subscription_plans
    WHERE trial_days = 90;

    -- Count trial subscriptions
    SELECT COUNT(*) INTO updated_subscriptions
    FROM user_subscriptions
    WHERE status = 'trial' AND trial_end_date > NOW();

    RAISE NOTICE '✅ Updated % subscription plans to 90-day trial', updated_plans;
    RAISE NOTICE '✅ Extended % active trial subscriptions', updated_subscriptions;
END $$;

-- Show updated plans
SELECT id, plan_name, plan_code, region, trial_days, is_active
FROM subscription_plans
ORDER BY region, plan_name;

COMMIT;

-- ========================================
-- ROLLBACK SCRIPT (Run if needed)
-- ========================================
/*
BEGIN;

-- Revert plans back to 14 days (if needed)
UPDATE subscription_plans
SET trial_days = 14
WHERE trial_days = 90;

-- Revert trial subscriptions (be careful with this!)
UPDATE user_subscriptions
SET trial_end_date = trial_start_date + INTERVAL '14 days'
WHERE status = 'trial'
  AND trial_start_date IS NOT NULL;

COMMIT;
*/
