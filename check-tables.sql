-- Quick SQL queries to verify subscription tables

-- 1. List all subscription-related tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('subscription_plans', 'user_subscriptions', 'payment_transactions', 'payment_verification_queue')
ORDER BY table_name;

-- 2. Show subscription plans
SELECT * FROM subscription_plans;

-- 3. Check users table has new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('region', 'subscription_status', 'subscription_end_date', 'is_premium');

-- 4. Count records in each table
SELECT 
  'subscription_plans' as table_name, COUNT(*) as record_count FROM subscription_plans
UNION ALL
SELECT 
  'user_subscriptions', COUNT(*) FROM user_subscriptions
UNION ALL
SELECT 
  'payment_transactions', COUNT(*) FROM payment_transactions
UNION ALL
SELECT 
  'payment_verification_queue', COUNT(*) FROM payment_verification_queue;

-- 5. Show table structure for subscription_plans
\d subscription_plans

-- 6. Show table structure for user_subscriptions
\d user_subscriptions

-- 7. Show users with subscription columns
SELECT email, region, subscription_status, subscription_end_date, is_premium 
FROM users 
LIMIT 5;