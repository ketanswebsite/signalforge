-- Migration 008: Create Admin Activity Log Table
-- Purpose: Store all admin actions for audit trail and security monitoring
-- Dependencies: None
-- Rollback: DROP TABLE admin_activity_log CASCADE;

-- Create admin activity log table
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id BIGSERIAL PRIMARY KEY,
  admin_email VARCHAR(255) NOT NULL,
  activity_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  target_type VARCHAR(50),
  target_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_admin_email
  ON admin_activity_log(admin_email);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_activity_type
  ON admin_activity_log(activity_type);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created_at
  ON admin_activity_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_target
  ON admin_activity_log(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_success
  ON admin_activity_log(success, created_at DESC);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_admin_date
  ON admin_activity_log(admin_email, created_at DESC);

-- Add GIN index for JSONB metadata search
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_metadata
  ON admin_activity_log USING GIN (metadata);

-- Create view for recent admin activity
CREATE OR REPLACE VIEW recent_admin_activity AS
SELECT
  id,
  admin_email,
  activity_type,
  description,
  target_type,
  target_id,
  metadata,
  ip_address,
  success,
  created_at
FROM admin_activity_log
ORDER BY created_at DESC
LIMIT 1000;

-- Create view for failed admin actions
CREATE OR REPLACE VIEW failed_admin_actions AS
SELECT
  id,
  admin_email,
  activity_type,
  description,
  target_type,
  target_id,
  metadata,
  ip_address,
  created_at
FROM admin_activity_log
WHERE success = false
ORDER BY created_at DESC;

-- Add comment on table
COMMENT ON TABLE admin_activity_log IS 'Audit trail for all admin actions in the system';
COMMENT ON COLUMN admin_activity_log.admin_email IS 'Email of admin who performed the action';
COMMENT ON COLUMN admin_activity_log.activity_type IS 'Type of activity (e.g., user_created, payment_verified)';
COMMENT ON COLUMN admin_activity_log.target_type IS 'Type of resource affected (e.g., user, subscription, payment)';
COMMENT ON COLUMN admin_activity_log.target_id IS 'ID of the affected resource';
COMMENT ON COLUMN admin_activity_log.metadata IS 'Additional contextual data about the action';
COMMENT ON COLUMN admin_activity_log.success IS 'Whether the action completed successfully';
