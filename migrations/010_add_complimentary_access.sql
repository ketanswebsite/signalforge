-- ========================================
-- Migration: 010 - Add Complimentary Access Features
-- Description: Add columns for admin to grant free access to users (lifetime or temporary)
-- Impact: Enables admin to grant free subscriptions to marketing partners, influencers, etc.
-- Estimated Time: 2 minutes
-- Date: 2025-10-12
-- ========================================

-- BACKUP RECOMMENDATION:
-- Before running this migration, create a backup:
-- pg_dump -h your-host -U your-user -d your-database > backup_before_010.sql

BEGIN;

-- ========================================
-- 1. ADD COMPLIMENTARY ACCESS COLUMNS TO USERS TABLE
-- ========================================

-- Add complimentary access columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_complimentary BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS complimentary_until TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS complimentary_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS granted_by VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS granted_at TIMESTAMP;

-- Add comments to document the columns
COMMENT ON COLUMN users.is_complimentary IS 'Whether user has complimentary (free) access';
COMMENT ON COLUMN users.complimentary_until IS 'Expiry date for temporary complimentary access. NULL means lifetime access';
COMMENT ON COLUMN users.complimentary_reason IS 'Reason for granting complimentary access (e.g., Marketing partner, Beta tester)';
COMMENT ON COLUMN users.granted_by IS 'Admin email who granted the complimentary access';
COMMENT ON COLUMN users.granted_at IS 'Timestamp when complimentary access was granted';

-- Create index for quick lookup of complimentary users
CREATE INDEX IF NOT EXISTS idx_users_complimentary ON users(is_complimentary) WHERE is_complimentary = true;
CREATE INDEX IF NOT EXISTS idx_users_complimentary_expiry ON users(complimentary_until) WHERE complimentary_until IS NOT NULL;

-- ========================================
-- 2. CREATE SUBSCRIPTION_GRANTS AUDIT TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS subscription_grants (
    id BIGSERIAL PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    grant_type VARCHAR(20) NOT NULL CHECK (grant_type IN ('lifetime', 'temporary', 'revoked')),
    expires_at TIMESTAMP,
    reason TEXT NOT NULL,
    granted_by VARCHAR(255) NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP,
    revoked_by VARCHAR(255),
    revoke_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE subscription_grants IS 'Audit log of all complimentary access grants and revocations';
COMMENT ON COLUMN subscription_grants.grant_type IS 'Type of grant: lifetime (permanent), temporary (expires), or revoked';
COMMENT ON COLUMN subscription_grants.expires_at IS 'Expiry date for temporary grants. NULL for lifetime grants';
COMMENT ON COLUMN subscription_grants.reason IS 'Business reason for granting access';
COMMENT ON COLUMN subscription_grants.granted_by IS 'Admin email who granted the access';
COMMENT ON COLUMN subscription_grants.revoked_at IS 'When access was revoked (if applicable)';
COMMENT ON COLUMN subscription_grants.revoked_by IS 'Admin who revoked the access';
COMMENT ON COLUMN subscription_grants.revoke_reason IS 'Reason for revoking access';
COMMENT ON COLUMN subscription_grants.metadata IS 'Additional metadata (JSON)';

-- Create indexes for subscription_grants
CREATE INDEX IF NOT EXISTS idx_grants_user ON subscription_grants(user_email);
CREATE INDEX IF NOT EXISTS idx_grants_type ON subscription_grants(grant_type);
CREATE INDEX IF NOT EXISTS idx_grants_active ON subscription_grants(grant_type, expires_at) WHERE grant_type != 'revoked';
CREATE INDEX IF NOT EXISTS idx_grants_granted_at ON subscription_grants(granted_at DESC);

-- ========================================
-- 3. CREATE HELPER VIEW
-- ========================================

-- Create view to easily see all complimentary users
CREATE OR REPLACE VIEW v_complimentary_users AS
SELECT
    u.email,
    u.name,
    u.is_complimentary,
    u.complimentary_until,
    u.complimentary_reason,
    u.granted_by,
    u.granted_at,
    CASE
        WHEN u.complimentary_until IS NULL THEN 'lifetime'
        WHEN u.complimentary_until > NOW() THEN 'active'
        ELSE 'expired'
    END as status,
    CASE
        WHEN u.complimentary_until IS NULL THEN NULL
        WHEN u.complimentary_until > NOW() THEN EXTRACT(DAY FROM (u.complimentary_until - NOW()))::INTEGER
        ELSE 0
    END as days_remaining
FROM users u
WHERE u.is_complimentary = true
ORDER BY u.granted_at DESC;

COMMENT ON VIEW v_complimentary_users IS 'View of all users with complimentary access showing their status';

-- ========================================
-- 4. VERIFICATION
-- ========================================

DO $$
DECLARE
    has_columns BOOLEAN;
    table_exists BOOLEAN;
BEGIN
    -- Check if columns were added
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name IN ('is_complimentary', 'complimentary_until', 'complimentary_reason', 'granted_by', 'granted_at')
    ) INTO has_columns;

    -- Check if table was created
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'subscription_grants'
    ) INTO table_exists;

    IF has_columns AND table_exists THEN
        RAISE NOTICE '✅ SUCCESS: Complimentary access columns and table created successfully';
    ELSE
        RAISE WARNING '⚠️  Some components may not have been created properly';
    END IF;
END $$;

-- Show the new columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('is_complimentary', 'complimentary_until', 'complimentary_reason', 'granted_by', 'granted_at')
ORDER BY ordinal_position;

-- Show table structure (psql command - commented out for pg library compatibility)
-- \d subscription_grants

-- Show complimentary users (should be empty initially)
SELECT * FROM v_complimentary_users;

COMMIT;

-- ========================================
-- ROLLBACK SCRIPT (Run if needed)
-- ========================================
/*
BEGIN;

-- Drop view
DROP VIEW IF EXISTS v_complimentary_users CASCADE;

-- Drop table
DROP TABLE IF EXISTS subscription_grants CASCADE;

-- Remove columns from users table
ALTER TABLE users DROP COLUMN IF EXISTS is_complimentary;
ALTER TABLE users DROP COLUMN IF EXISTS complimentary_until;
ALTER TABLE users DROP COLUMN IF EXISTS complimentary_reason;
ALTER TABLE users DROP COLUMN IF EXISTS granted_by;
ALTER TABLE users DROP COLUMN IF EXISTS granted_at;

COMMIT;
*/

-- ========================================
-- EXAMPLE USAGE
-- ========================================
/*
-- Grant lifetime access to a marketing partner
UPDATE users
SET is_complimentary = true,
    complimentary_until = NULL,  -- NULL = lifetime
    complimentary_reason = 'Marketing partner - influencer collaboration',
    granted_by = 'admin@example.com',
    granted_at = NOW()
WHERE email = 'partner@example.com';

INSERT INTO subscription_grants (user_email, grant_type, expires_at, reason, granted_by)
VALUES ('partner@example.com', 'lifetime', NULL, 'Marketing partner - influencer collaboration', 'admin@example.com');

-- Grant temporary access to a beta tester (30 days)
UPDATE users
SET is_complimentary = true,
    complimentary_until = NOW() + INTERVAL '30 days',
    complimentary_reason = 'Beta tester access',
    granted_by = 'admin@example.com',
    granted_at = NOW()
WHERE email = 'tester@example.com';

INSERT INTO subscription_grants (user_email, grant_type, expires_at, reason, granted_by)
VALUES ('tester@example.com', 'temporary', NOW() + INTERVAL '30 days', 'Beta tester access', 'admin@example.com');

-- Revoke access
UPDATE users
SET is_complimentary = false,
    complimentary_until = NULL
WHERE email = 'user@example.com';

INSERT INTO subscription_grants (user_email, grant_type, reason, granted_by, revoked_at, revoked_by, revoke_reason)
VALUES ('user@example.com', 'revoked', 'Original grant reason', 'admin@example.com', NOW(), 'admin@example.com', 'Access period ended');

-- View all complimentary users
SELECT * FROM v_complimentary_users;

-- View grant history for a user
SELECT * FROM subscription_grants WHERE user_email = 'user@example.com' ORDER BY created_at DESC;
*/
