-- Migration 014: Create Deleted User Financial Records Table
-- Purpose: Archive financial records for deleted accounts (UK GDPR 6-year retention requirement)
-- Dependencies: users table, payment_transactions table, user_subscriptions table
-- Rollback: DROP TABLE deleted_user_financial_records CASCADE;

-- Create table for archiving financial records of deleted users
CREATE TABLE IF NOT EXISTS deleted_user_financial_records (
  id SERIAL PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL,
  deletion_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  retention_until TIMESTAMP NOT NULL,
  financial_data JSONB NOT NULL,
  deletion_requested_by VARCHAR(255),
  deletion_ip_address INET,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_deleted_financial_records_email
  ON deleted_user_financial_records(user_email);

CREATE INDEX IF NOT EXISTS idx_deleted_financial_records_retention
  ON deleted_user_financial_records(retention_until);

CREATE INDEX IF NOT EXISTS idx_deleted_financial_records_deletion_date
  ON deleted_user_financial_records(deletion_date DESC);

-- Add GIN index for JSONB search
CREATE INDEX IF NOT EXISTS idx_deleted_financial_records_data
  ON deleted_user_financial_records USING GIN (financial_data);

-- Add comments
COMMENT ON TABLE deleted_user_financial_records IS 'Archives financial records for deleted user accounts (6-year UK GDPR retention)';
COMMENT ON COLUMN deleted_user_financial_records.user_email IS 'Email of the deleted user account';
COMMENT ON COLUMN deleted_user_financial_records.retention_until IS 'Date when financial records can be permanently deleted (deletion_date + 6 years)';
COMMENT ON COLUMN deleted_user_financial_records.financial_data IS 'Archived payment transactions, refunds, and subscription data';

-- Create view for records ready for permanent deletion
CREATE OR REPLACE VIEW v_expired_financial_records AS
SELECT
  id,
  user_email,
  deletion_date,
  retention_until,
  created_at,
  EXTRACT(YEAR FROM AGE(retention_until, deletion_date)) as retention_years
FROM deleted_user_financial_records
WHERE retention_until <= CURRENT_TIMESTAMP
ORDER BY retention_until ASC;

COMMENT ON VIEW v_expired_financial_records IS 'Financial records that have passed the 6-year retention period and can be permanently deleted';
