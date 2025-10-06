-- Migration 009: Add Unified Audit Log Columns
-- Purpose: Add entity_type, entity_id, and changes columns to trade_audit_log
--          to support the unified audit view in the admin portal
-- Date: 2025-10-06

BEGIN;

-- Add entity_type column to categorize the type of entity being audited
ALTER TABLE trade_audit_log
ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50) DEFAULT 'trade';

-- Add entity_id column (generic ID that can reference trade_id or other entities)
ALTER TABLE trade_audit_log
ADD COLUMN IF NOT EXISTS entity_id VARCHAR(255);

-- Add changes column (alias for changed_fields for admin portal compatibility)
ALTER TABLE trade_audit_log
ADD COLUMN IF NOT EXISTS changes JSONB;

-- Populate entity_id from trade_id for existing records
UPDATE trade_audit_log
SET entity_id = trade_id::VARCHAR
WHERE entity_id IS NULL;

-- Populate changes from changed_fields for existing records
UPDATE trade_audit_log
SET changes = jsonb_build_object('fields', changed_fields)
WHERE changes IS NULL AND changed_fields IS NOT NULL;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_trade_audit_entity_type ON trade_audit_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_trade_audit_entity_id ON trade_audit_log(entity_id);

-- Add comments
COMMENT ON COLUMN trade_audit_log.entity_type IS 'Type of entity being audited (trade, user, etc.)';
COMMENT ON COLUMN trade_audit_log.entity_id IS 'Generic ID of the entity being audited';
COMMENT ON COLUMN trade_audit_log.changes IS 'JSONB representation of changes for admin portal';

COMMIT;

-- Verification
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'trade_audit_log'
  AND column_name IN ('entity_type', 'entity_id', 'changes')
ORDER BY column_name;
