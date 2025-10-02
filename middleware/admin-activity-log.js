/**
 * Admin Activity Logging Middleware
 * Logs all admin actions for audit trail and security monitoring
 */

const TradeDB = require('../database-postgres');

/**
 * Activity log types
 */
const ACTIVITY_TYPES = {
  // Authentication
  LOGIN: 'login',
  LOGOUT: 'logout',
  TOKEN_GENERATED: 'token_generated',

  // User Management
  USER_VIEWED: 'user_viewed',
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DELETED: 'user_deleted',
  USER_SUSPENDED: 'user_suspended',
  USER_ACTIVATED: 'user_activated',

  // Subscription Management
  SUBSCRIPTION_VIEWED: 'subscription_viewed',
  SUBSCRIPTION_CREATED: 'subscription_created',
  SUBSCRIPTION_UPDATED: 'subscription_updated',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  PLAN_CREATED: 'plan_created',
  PLAN_UPDATED: 'plan_updated',
  PLAN_DEACTIVATED: 'plan_deactivated',

  // Payment Management
  PAYMENT_VIEWED: 'payment_viewed',
  PAYMENT_VERIFIED: 'payment_verified',
  PAYMENT_REJECTED: 'payment_rejected',
  REFUND_ISSUED: 'refund_issued',

  // System Actions
  SETTINGS_UPDATED: 'settings_updated',
  EMAIL_TEMPLATE_UPDATED: 'email_template_updated',
  DATABASE_QUERY_EXECUTED: 'database_query_executed',
  BACKUP_CREATED: 'backup_created',
  MIGRATION_EXECUTED: 'migration_executed',

  // Bulk Actions
  BULK_USER_ACTION: 'bulk_user_action',
  BULK_EMAIL_SENT: 'bulk_email_sent',
  TELEGRAM_BROADCAST: 'telegram_broadcast',

  // Security Events
  UNAUTHORIZED_ACCESS_ATTEMPT: 'unauthorized_access_attempt',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  SECURITY_SETTING_CHANGED: 'security_setting_changed'
};

/**
 * Log admin activity to database
 */
async function logActivity({
  adminEmail,
  activityType,
  description,
  targetType = null,
  targetId = null,
  metadata = {},
  ipAddress = null,
  userAgent = null,
  success = true
}) {
  try {
    const query = `
      INSERT INTO admin_activity_log (
        admin_email,
        activity_type,
        description,
        target_type,
        target_id,
        metadata,
        ip_address,
        user_agent,
        success,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING id, created_at
    `;

    const values = [
      adminEmail,
      activityType,
      description,
      targetType,
      targetId,
      JSON.stringify(metadata),
      ipAddress,
      userAgent,
      success
    ];

    const result = await TradeDB.pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    // Silent fail - don't break the request if logging fails
    console.error('Failed to log admin activity:', error);
    return null;
  }
}

/**
 * Middleware: Log admin API requests
 */
function logAdminAPIRequest(activityTypeOverride = null) {
  return async (req, res, next) => {
    // Store original res.json to intercept response
    const originalJson = res.json.bind(res);

    res.json = function(data) {
      // Determine if request was successful
      const success = res.statusCode >= 200 && res.statusCode < 400;

      // Determine activity type from route if not provided
      const activityType = activityTypeOverride || inferActivityType(req);

      // Generate description
      const description = generateDescription(req, activityType);

      // Extract metadata
      const metadata = {
        method: req.method,
        endpoint: req.originalUrl,
        statusCode: res.statusCode,
        query: req.query,
        body: sanitizeBody(req.body),
        responseSuccess: data?.success
      };

      // Log activity (don't await - fire and forget)
      if (req.adminUser) {
        logActivity({
          adminEmail: req.adminUser.email,
          activityType,
          description,
          targetType: extractTargetType(req),
          targetId: extractTargetId(req),
          metadata,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          success
        });
      }

      // Call original json method
      return originalJson(data);
    };

    next();
  };
}

/**
 * Infer activity type from request
 */
function inferActivityType(req) {
  const path = req.path.toLowerCase();
  const method = req.method.toUpperCase();

  // User management
  if (path.includes('/users')) {
    if (method === 'GET') return ACTIVITY_TYPES.USER_VIEWED;
    if (method === 'POST') return ACTIVITY_TYPES.USER_CREATED;
    if (method === 'PUT' || method === 'PATCH') return ACTIVITY_TYPES.USER_UPDATED;
    if (method === 'DELETE') return ACTIVITY_TYPES.USER_DELETED;
  }

  // Subscription management
  if (path.includes('/subscription')) {
    if (method === 'GET') return ACTIVITY_TYPES.SUBSCRIPTION_VIEWED;
    if (method === 'POST') return ACTIVITY_TYPES.SUBSCRIPTION_CREATED;
    if (method === 'PUT' || method === 'PATCH') return ACTIVITY_TYPES.SUBSCRIPTION_UPDATED;
    if (method === 'DELETE') return ACTIVITY_TYPES.SUBSCRIPTION_CANCELLED;
  }

  // Payment management
  if (path.includes('/payment')) {
    if (method === 'GET') return ACTIVITY_TYPES.PAYMENT_VIEWED;
    if (path.includes('/verify')) return ACTIVITY_TYPES.PAYMENT_VERIFIED;
    if (path.includes('/reject')) return ACTIVITY_TYPES.PAYMENT_REJECTED;
    if (path.includes('/refund')) return ACTIVITY_TYPES.REFUND_ISSUED;
  }

  // Settings
  if (path.includes('/settings')) {
    return ACTIVITY_TYPES.SETTINGS_UPDATED;
  }

  // Database operations
  if (path.includes('/database') || path.includes('/query')) {
    return ACTIVITY_TYPES.DATABASE_QUERY_EXECUTED;
  }

  // Default
  return 'api_request';
}

/**
 * Generate human-readable description
 */
function generateDescription(req, activityType) {
  const path = req.path;
  const method = req.method;

  const descriptions = {
    [ACTIVITY_TYPES.USER_VIEWED]: `Viewed user information (${path})`,
    [ACTIVITY_TYPES.USER_CREATED]: 'Created new user',
    [ACTIVITY_TYPES.USER_UPDATED]: `Updated user (${extractTargetId(req)})`,
    [ACTIVITY_TYPES.USER_DELETED]: `Deleted user (${extractTargetId(req)})`,
    [ACTIVITY_TYPES.SUBSCRIPTION_VIEWED]: 'Viewed subscriptions',
    [ACTIVITY_TYPES.SUBSCRIPTION_CREATED]: 'Created new subscription',
    [ACTIVITY_TYPES.SUBSCRIPTION_UPDATED]: `Updated subscription (${extractTargetId(req)})`,
    [ACTIVITY_TYPES.SUBSCRIPTION_CANCELLED]: `Cancelled subscription (${extractTargetId(req)})`,
    [ACTIVITY_TYPES.PAYMENT_VERIFIED]: `Verified payment (${extractTargetId(req)})`,
    [ACTIVITY_TYPES.PAYMENT_REJECTED]: `Rejected payment (${extractTargetId(req)})`,
    [ACTIVITY_TYPES.REFUND_ISSUED]: `Issued refund (${extractTargetId(req)})`,
    [ACTIVITY_TYPES.SETTINGS_UPDATED]: 'Updated system settings',
    [ACTIVITY_TYPES.DATABASE_QUERY_EXECUTED]: 'Executed database query'
  };

  return descriptions[activityType] || `${method} ${path}`;
}

/**
 * Extract target type from request
 */
function extractTargetType(req) {
  const path = req.path.toLowerCase();

  if (path.includes('/users')) return 'user';
  if (path.includes('/subscription')) return 'subscription';
  if (path.includes('/payment')) return 'payment';
  if (path.includes('/plan')) return 'plan';
  if (path.includes('/trade')) return 'trade';

  return null;
}

/**
 * Extract target ID from request
 */
function extractTargetId(req) {
  // Try to get ID from URL params
  if (req.params.id) return req.params.id;
  if (req.params.userId) return req.params.userId;
  if (req.params.subscriptionId) return req.params.subscriptionId;
  if (req.params.paymentId) return req.params.paymentId;

  // Try to get ID from body
  if (req.body.id) return req.body.id;
  if (req.body.user_id) return req.body.user_id;

  return null;
}

/**
 * Sanitize request body to remove sensitive data
 */
function sanitizeBody(body) {
  if (!body) return {};

  const sanitized = { ...body };

  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Get recent admin activity logs
 */
async function getRecentActivityLogs({ limit = 100, adminEmail = null, activityType = null, startDate = null, endDate = null }) {
  try {
    let query = `
      SELECT
        id,
        admin_email,
        activity_type,
        description,
        target_type,
        target_id,
        metadata,
        ip_address,
        user_agent,
        success,
        created_at
      FROM admin_activity_log
      WHERE 1=1
    `;

    const values = [];
    let paramCount = 1;

    if (adminEmail) {
      query += ` AND admin_email = $${paramCount++}`;
      values.push(adminEmail);
    }

    if (activityType) {
      query += ` AND activity_type = $${paramCount++}`;
      values.push(activityType);
    }

    if (startDate) {
      query += ` AND created_at >= $${paramCount++}`;
      values.push(startDate);
    }

    if (endDate) {
      query += ` AND created_at <= $${paramCount++}`;
      values.push(endDate);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
    values.push(limit);

    const result = await TradeDB.pool.query(query, values);

    return result.rows.map(row => ({
      ...row,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
    }));
  } catch (error) {
    console.error('Failed to get activity logs:', error);
    return [];
  }
}

/**
 * Get activity statistics
 */
async function getActivityStatistics({ startDate, endDate }) {
  try {
    const query = `
      SELECT
        admin_email,
        activity_type,
        COUNT(*) as count,
        SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failed
      FROM admin_activity_log
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY admin_email, activity_type
      ORDER BY count DESC
    `;

    const result = await TradeDB.pool.query(query, [startDate, endDate]);
    return result.rows;
  } catch (error) {
    console.error('Failed to get activity statistics:', error);
    return [];
  }
}

module.exports = {
  logActivity,
  logAdminAPIRequest,
  getRecentActivityLogs,
  getActivityStatistics,
  ACTIVITY_TYPES
};
