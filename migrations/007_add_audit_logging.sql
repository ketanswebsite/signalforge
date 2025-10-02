-- ========================================
-- Migration: 007 - Add Comprehensive Audit Logging
-- Description: Track all data changes for compliance and debugging
-- Impact: Complete audit trail of all database changes
-- Estimated Time: 1.5 hours
-- Date: 2025-10-02
-- ========================================

-- BACKUP RECOMMENDATION:
-- Before running this migration, create a backup:
-- pg_dump -h your-host -U your-user -d your-database > backup_before_007.sql

BEGIN;

-- ========================================
-- PART 1: CREATE AUDIT LOG TABLES
-- ========================================

-- 1.1 Trades Audit Log
CREATE TABLE IF NOT EXISTS trade_audit_log (
    id BIGSERIAL PRIMARY KEY,
    trade_id BIGINT NOT NULL,
    user_email VARCHAR(255) NOT NULL,

    -- Action details
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    action_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Changed data
    old_data JSONB,
    new_data JSONB,
    changed_fields TEXT[],

    -- Context
    triggered_by VARCHAR(255),  -- User or system that made the change
    ip_address INET,
    user_agent TEXT,
    api_endpoint VARCHAR(255),

    -- Metadata
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trade_audit_trade_id ON trade_audit_log(trade_id);
CREATE INDEX idx_trade_audit_user ON trade_audit_log(user_email);
CREATE INDEX idx_trade_audit_action ON trade_audit_log(action);
CREATE INDEX idx_trade_audit_timestamp ON trade_audit_log(action_timestamp DESC);
CREATE INDEX idx_trade_audit_changed_fields ON trade_audit_log USING GIN(changed_fields);

COMMENT ON TABLE trade_audit_log IS 'Complete audit trail of all changes to trades table';

-- 1.2 Users Audit Log
CREATE TABLE IF NOT EXISTS user_audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER,
    user_email VARCHAR(255) NOT NULL,

    -- Action details
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'PASSWORD_CHANGE')),
    action_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Changed data
    old_data JSONB,
    new_data JSONB,
    changed_fields TEXT[],

    -- Context
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),

    -- Metadata
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_audit_user ON user_audit_log(user_email);
CREATE INDEX idx_user_audit_action ON user_audit_log(action);
CREATE INDEX idx_user_audit_timestamp ON user_audit_log(action_timestamp DESC);

COMMENT ON TABLE user_audit_log IS 'Audit trail of user account changes and authentication events';

-- 1.3 Alert Preferences Audit Log
CREATE TABLE IF NOT EXISTS alert_preferences_audit_log (
    id BIGSERIAL PRIMARY KEY,
    preference_id INTEGER,
    user_email VARCHAR(255) NOT NULL,

    -- Action details
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    action_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Changed data
    old_data JSONB,
    new_data JSONB,

    -- Context
    triggered_by VARCHAR(255),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alert_audit_user ON alert_preferences_audit_log(user_email);
CREATE INDEX idx_alert_audit_timestamp ON alert_preferences_audit_log(action_timestamp DESC);

COMMENT ON TABLE alert_preferences_audit_log IS 'Audit trail of alert preference changes';

-- ========================================
-- PART 2: CREATE AUDIT TRIGGER FUNCTIONS
-- ========================================

-- 2.1 Generic audit function for trades
CREATE OR REPLACE FUNCTION audit_trade_changes()
RETURNS TRIGGER AS $$
DECLARE
    changed_fields_array TEXT[] := ARRAY[]::TEXT[];
    col_name TEXT;
BEGIN
    -- INSERT operation
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO trade_audit_log (
            trade_id,
            user_email,
            action,
            new_data,
            triggered_by
        ) VALUES (
            NEW.id,
            NEW.user_id,
            'INSERT',
            row_to_json(NEW)::JSONB,
            current_user
        );
        RETURN NEW;

    -- UPDATE operation
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Detect which fields changed
        FOR col_name IN
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'trades'
              AND column_name NOT IN ('updated_at', 'last_price_update')  -- Exclude timestamp columns
        LOOP
            IF to_jsonb(NEW) ->> col_name IS DISTINCT FROM to_jsonb(OLD) ->> col_name THEN
                changed_fields_array := array_append(changed_fields_array, col_name);
            END IF;
        END LOOP;

        -- Only log if something actually changed
        IF array_length(changed_fields_array, 1) > 0 THEN
            INSERT INTO trade_audit_log (
                trade_id,
                user_email,
                action,
                old_data,
                new_data,
                changed_fields,
                triggered_by
            ) VALUES (
                NEW.id,
                NEW.user_id,
                'UPDATE',
                row_to_json(OLD)::JSONB,
                row_to_json(NEW)::JSONB,
                changed_fields_array,
                current_user
            );
        END IF;
        RETURN NEW;

    -- DELETE operation
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO trade_audit_log (
            trade_id,
            user_email,
            action,
            old_data,
            triggered_by
        ) VALUES (
            OLD.id,
            OLD.user_id,
            'DELETE',
            row_to_json(OLD)::JSONB,
            current_user
        );
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_trade_changes IS 'Automatically logs all changes to trades table';

-- 2.2 Generic audit function for users
CREATE OR REPLACE FUNCTION audit_user_changes()
RETURNS TRIGGER AS $$
DECLARE
    changed_fields_array TEXT[] := ARRAY[]::TEXT[];
    col_name TEXT;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO user_audit_log (
            user_id,
            user_email,
            action,
            new_data
        ) VALUES (
            NEW.id,
            NEW.email,
            'INSERT',
            row_to_json(NEW)::JSONB
        );
        RETURN NEW;

    ELSIF (TG_OP = 'UPDATE') THEN
        -- Detect changed fields
        FOR col_name IN
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'users'
              AND column_name NOT IN ('last_login', 'updated_at')
        LOOP
            IF to_jsonb(NEW) ->> col_name IS DISTINCT FROM to_jsonb(OLD) ->> col_name THEN
                changed_fields_array := array_append(changed_fields_array, col_name);
            END IF;
        END LOOP;

        IF array_length(changed_fields_array, 1) > 0 THEN
            INSERT INTO user_audit_log (
                user_id,
                user_email,
                action,
                old_data,
                new_data,
                changed_fields
            ) VALUES (
                NEW.id,
                NEW.email,
                'UPDATE',
                row_to_json(OLD)::JSONB,
                row_to_json(NEW)::JSONB,
                changed_fields_array
            );
        END IF;
        RETURN NEW;

    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO user_audit_log (
            user_id,
            user_email,
            action,
            old_data
        ) VALUES (
            OLD.id,
            OLD.email,
            'DELETE',
            row_to_json(OLD)::JSONB
        );
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_user_changes IS 'Automatically logs all changes to users table';

-- 2.3 Audit function for alert preferences
CREATE OR REPLACE FUNCTION audit_alert_preferences_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO alert_preferences_audit_log (
            preference_id,
            user_email,
            action,
            new_data,
            triggered_by
        ) VALUES (
            NEW.id,
            NEW.user_id,
            'INSERT',
            row_to_json(NEW)::JSONB,
            current_user
        );
        RETURN NEW;

    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO alert_preferences_audit_log (
            preference_id,
            user_email,
            action,
            old_data,
            new_data,
            triggered_by
        ) VALUES (
            NEW.id,
            NEW.user_id,
            'UPDATE',
            row_to_json(OLD)::JSONB,
            row_to_json(NEW)::JSONB,
            current_user
        );
        RETURN NEW;

    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO alert_preferences_audit_log (
            preference_id,
            user_email,
            action,
            old_data,
            triggered_by
        ) VALUES (
            OLD.id,
            OLD.user_id,
            'DELETE',
            row_to_json(OLD)::JSONB,
            current_user
        );
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_alert_preferences_changes IS 'Automatically logs all changes to alert_preferences table';

-- ========================================
-- PART 3: ATTACH TRIGGERS TO TABLES
-- ========================================

-- 3.1 Trades audit trigger
DROP TRIGGER IF EXISTS trigger_audit_trades ON trades;
CREATE TRIGGER trigger_audit_trades
    AFTER INSERT OR UPDATE OR DELETE ON trades
    FOR EACH ROW
    EXECUTE FUNCTION audit_trade_changes();

-- 3.2 Users audit trigger
DROP TRIGGER IF EXISTS trigger_audit_users ON users;
CREATE TRIGGER trigger_audit_users
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW
    EXECUTE FUNCTION audit_user_changes();

-- 3.3 Alert preferences audit trigger
DROP TRIGGER IF EXISTS trigger_audit_alert_preferences ON alert_preferences;
CREATE TRIGGER trigger_audit_alert_preferences
    AFTER INSERT OR UPDATE OR DELETE ON alert_preferences
    FOR EACH ROW
    EXECUTE FUNCTION audit_alert_preferences_changes();


-- ========================================
-- PART 4: CREATE AUDIT QUERY HELPER VIEWS
-- ========================================

-- 4.1 Recent trade changes view
CREATE OR REPLACE VIEW v_recent_trade_changes AS
SELECT
    tal.id,
    tal.trade_id,
    t.symbol,
    tal.user_email,
    u.name as user_name,
    tal.action,
    tal.action_timestamp,
    tal.changed_fields,
    tal.triggered_by
FROM trade_audit_log tal
LEFT JOIN trades t ON tal.trade_id = t.id
LEFT JOIN users u ON tal.user_email = u.email
WHERE tal.action_timestamp >= NOW() - INTERVAL '7 days'
ORDER BY tal.action_timestamp DESC
LIMIT 100;

COMMENT ON VIEW v_recent_trade_changes IS 'Last 100 trade changes in the past 7 days';

-- 4.2 User activity summary view
CREATE OR REPLACE VIEW v_user_activity_summary AS
SELECT
    user_email,
    action,
    COUNT(*) as action_count,
    MAX(action_timestamp) as last_action,
    MIN(action_timestamp) as first_action
FROM user_audit_log
WHERE action_timestamp >= NOW() - INTERVAL '30 days'
GROUP BY user_email, action
ORDER BY user_email, action;

COMMENT ON VIEW v_user_activity_summary IS 'Summary of user activities in the past 30 days';

-- 4.3 Trade modifications by user
CREATE OR REPLACE VIEW v_trade_modifications_by_user AS
SELECT
    tal.user_email,
    u.name as user_name,
    COUNT(*) as total_modifications,
    COUNT(CASE WHEN tal.action = 'INSERT' THEN 1 END) as inserts,
    COUNT(CASE WHEN tal.action = 'UPDATE' THEN 1 END) as updates,
    COUNT(CASE WHEN tal.action = 'DELETE' THEN 1 END) as deletes,
    MAX(tal.action_timestamp) as last_modification
FROM trade_audit_log tal
LEFT JOIN users u ON tal.user_email = u.email
WHERE tal.action_timestamp >= NOW() - INTERVAL '30 days'
GROUP BY tal.user_email, u.name
ORDER BY total_modifications DESC;

COMMENT ON VIEW v_trade_modifications_by_user IS 'Trade modification statistics by user (last 30 days)';

-- ========================================
-- PART 5: CREATE AUDIT QUERY FUNCTIONS
-- ========================================

-- 5.1 Function to get trade history
CREATE OR REPLACE FUNCTION get_trade_audit_history(p_trade_id BIGINT)
RETURNS TABLE (
    audit_id BIGINT,
    action VARCHAR,
    action_timestamp TIMESTAMP,
    changed_fields TEXT[],
    old_value JSONB,
    new_value JSONB,
    triggered_by VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        tal.id,
        tal.action,
        tal.action_timestamp,
        tal.changed_fields,
        tal.old_data,
        tal.new_data,
        tal.triggered_by
    FROM trade_audit_log tal
    WHERE tal.trade_id = p_trade_id
    ORDER BY tal.action_timestamp DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_trade_audit_history IS 'Get complete audit history for a specific trade';

-- 5.2 Function to get field change history
CREATE OR REPLACE FUNCTION get_field_change_history(
    p_trade_id BIGINT,
    p_field_name TEXT
)
RETURNS TABLE (
    action_timestamp TIMESTAMP,
    old_value TEXT,
    new_value TEXT,
    changed_by VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        tal.action_timestamp,
        tal.old_data ->> p_field_name as old_value,
        tal.new_data ->> p_field_name as new_value,
        tal.triggered_by
    FROM trade_audit_log tal
    WHERE tal.trade_id = p_trade_id
      AND p_field_name = ANY(tal.changed_fields)
    ORDER BY tal.action_timestamp DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_field_change_history IS 'Get change history for a specific field of a trade';

-- ========================================
-- PART 6: AUDIT LOG MAINTENANCE
-- ========================================

-- 6.1 Function to archive old audit logs
CREATE OR REPLACE FUNCTION archive_old_audit_logs(p_days_to_keep INTEGER DEFAULT 365)
RETURNS TABLE (
    trades_archived BIGINT,
    users_archived BIGINT,
    alerts_archived BIGINT
) AS $$
DECLARE
    v_trades_count BIGINT;
    v_users_count BIGINT;
    v_alerts_count BIGINT;
    v_cutoff_date TIMESTAMP;
BEGIN
    v_cutoff_date := NOW() - (p_days_to_keep || ' days')::INTERVAL;

    -- Archive to backup tables (optional)
    CREATE TABLE IF NOT EXISTS trade_audit_log_archive (LIKE trade_audit_log INCLUDING ALL);
    CREATE TABLE IF NOT EXISTS user_audit_log_archive (LIKE user_audit_log INCLUDING ALL);
    CREATE TABLE IF NOT EXISTS alert_preferences_audit_log_archive (LIKE alert_preferences_audit_log INCLUDING ALL);

    -- Move old records to archive
    WITH moved_trades AS (
        DELETE FROM trade_audit_log
        WHERE action_timestamp < v_cutoff_date
        RETURNING *
    )
    INSERT INTO trade_audit_log_archive SELECT * FROM moved_trades;
    GET DIAGNOSTICS v_trades_count = ROW_COUNT;

    WITH moved_users AS (
        DELETE FROM user_audit_log
        WHERE action_timestamp < v_cutoff_date
        RETURNING *
    )
    INSERT INTO user_audit_log_archive SELECT * FROM moved_users;
    GET DIAGNOSTICS v_users_count = ROW_COUNT;

    WITH moved_alerts AS (
        DELETE FROM alert_preferences_audit_log
        WHERE action_timestamp < v_cutoff_date
        RETURNING *
    )
    INSERT INTO alert_preferences_audit_log_archive SELECT * FROM moved_alerts;
    GET DIAGNOSTICS v_alerts_count = ROW_COUNT;

    RETURN QUERY SELECT v_trades_count, v_users_count, v_alerts_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION archive_old_audit_logs IS 'Archive audit logs older than specified days to archive tables';

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Verify all audit tables exist
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_name IN (
        'trade_audit_log',
        'user_audit_log',
        'alert_preferences_audit_log'
    );

    IF table_count = 3 THEN
        RAISE NOTICE '✅ SUCCESS: All 3 audit tables created successfully';
    ELSE
        RAISE WARNING '⚠️  Expected 3 audit tables, found %', table_count;
    END IF;
END $$;

-- Verify all triggers exist
SELECT
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE 'trigger_audit_%'
ORDER BY event_object_table;

COMMIT;

-- ========================================
-- ROLLBACK SCRIPT (Run if needed)
-- ========================================
/*
BEGIN;

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_audit_trades ON trades;
DROP TRIGGER IF EXISTS trigger_audit_users ON users;
DROP TRIGGER IF EXISTS trigger_audit_alert_preferences ON alert_preferences;

-- Drop functions
DROP FUNCTION IF EXISTS audit_trade_changes CASCADE;
DROP FUNCTION IF EXISTS audit_user_changes CASCADE;
DROP FUNCTION IF EXISTS audit_alert_preferences_changes CASCADE;
DROP FUNCTION IF EXISTS get_trade_audit_history CASCADE;
DROP FUNCTION IF EXISTS get_field_change_history CASCADE;
DROP FUNCTION IF EXISTS archive_old_audit_logs CASCADE;

-- Drop views
DROP VIEW IF EXISTS v_recent_trade_changes;
DROP VIEW IF EXISTS v_user_activity_summary;
DROP VIEW IF EXISTS v_trade_modifications_by_user;

-- Drop tables
DROP TABLE IF EXISTS trade_audit_log CASCADE;
DROP TABLE IF EXISTS user_audit_log CASCADE;
DROP TABLE IF EXISTS alert_preferences_audit_log CASCADE;
DROP TABLE IF EXISTS trade_audit_log_archive CASCADE;
DROP TABLE IF EXISTS user_audit_log_archive CASCADE;
DROP TABLE IF EXISTS alert_preferences_audit_log_archive CASCADE;

COMMIT;
*/

-- ========================================
-- USAGE EXAMPLES
-- ========================================

-- Example 1: Get full history of a trade
-- SELECT * FROM get_trade_audit_history(123);

-- Example 2: Get history of profit_loss field changes
-- SELECT * FROM get_field_change_history(123, 'profit_loss');

-- Example 3: See recent trade changes
-- SELECT * FROM v_recent_trade_changes;

-- Example 4: Archive logs older than 1 year
-- SELECT * FROM archive_old_audit_logs(365);

-- Example 5: Find who deleted a trade
-- SELECT * FROM trade_audit_log WHERE action = 'DELETE' AND trade_id = 123;

-- ========================================
-- MIGRATION COMPLETE
-- ========================================
-- This completes the core database improvement migrations!
