-- Reactivate Telegram subscription for primary user
-- User's subscription was marked as inactive, preventing Telegram notifications
-- This migration reactivates the subscription so the user receives:
-- - 7 AM scan notifications (subscription_type: 'scans')
-- - Trade execution notifications (subscription_type: 'execution')
-- - Exit alerts (subscription_type: 'all')
--
-- Root cause: User's chat_id 6168209389 has is_active = false in database
-- Fix: Set is_active = true to restore notifications

UPDATE telegram_subscribers
SET is_active = true
WHERE chat_id = '6168209389';
