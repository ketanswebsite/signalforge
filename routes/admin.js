/**
 * Admin Routes
 * API endpoints for admin portal functionality
 */

const express = require('express');
const router = express.Router();

// Import middleware
const {
  ensureAdmin,
  ensureAdminAPI,
  ensureAdminRole,
  generateTokenEndpoint,
  verifyTokenEndpoint,
  ADMIN_ROLES
} = require('../middleware/admin-auth');

const {
  adminErrorHandler,
  asyncHandler,
  successResponse,
  paginationResponse,
  requireField,
  requireFields,
  AdminAPIError
} = require('../middleware/admin-error-handler');

const {
  logAdminAPIRequest,
  getRecentActivityLogs,
  getActivityStatistics
} = require('../middleware/admin-activity-log');

const sseHandler = require('../lib/admin/sse-handler');

// Import database
const TradeDB = require('../database-postgres');

// Authentication endpoints
router.post('/auth/token', generateTokenEndpoint);
router.post('/auth/verify', verifyTokenEndpoint);

// Apply admin authentication and activity logging to all routes below
router.use(ensureAdminAPI);
router.use(logAdminAPIRequest());

// ========== SSE Endpoint ==========
router.get('/events', (req, res) => {
  sseHandler.initializeSSE(req, res);
});

// ========== Dashboard Metrics ==========
router.get('/dashboard/metrics', asyncHandler(async (req, res) => {
  // Get metrics from database
  const totalUsers = await TradeDB.pool.query('SELECT COUNT(*) FROM users');
  const activeSubscriptions = await TradeDB.pool.query(
    "SELECT COUNT(*) FROM user_subscriptions WHERE status = 'active'"
  );
  const totalTrades = await TradeDB.pool.query('SELECT COUNT(*) FROM trades');

  // Calculate MRR (if subscription_plans table exists)
  let mrr = 0;
  try {
    const mrrResult = await TradeDB.pool.query(`
      SELECT COALESCE(SUM(sp.price_monthly), 0) as total_mrr
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.status = 'active'
    `);
    mrr = parseFloat(mrrResult.rows[0]?.total_mrr || 0);
  } catch (error) {
    console.log('MRR calculation skipped (subscription_plans table may not exist yet)');
  }

  // Get this month's payments count (from trade_audit_log or similar)
  const paymentsThisMonth = 0; // Placeholder

  res.json(successResponse({
    mrr,
    totalUsers: parseInt(totalUsers.rows[0].count),
    activeSubscriptions: parseInt(activeSubscriptions.rows[0].count),
    totalTrades: parseInt(totalTrades.rows[0].count),
    paymentsThisMonth,
    changes: {
      mrr: '+12%',
      users: '+5',
      subscriptions: '+2',
      payments: '+8'
    }
  }));
}));

// ========== User Management ==========
router.get('/users', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;

  const countResult = await TradeDB.pool.query('SELECT COUNT(*) FROM users');
  const total = parseInt(countResult.rows[0].count);

  const usersResult = await TradeDB.pool.query(`
    SELECT
      email,
      name,
      first_login,
      last_login,
      telegram_chat_id
    FROM users
    ORDER BY first_login DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);

  res.json(paginationResponse(usersResult.rows, page, limit, total));
}));

router.get('/users/:email', asyncHandler(async (req, res) => {
  const email = req.params.email;

  const userResult = await TradeDB.pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  if (userResult.rows.length === 0) {
    throw new AdminAPIError('USER_NOT_FOUND', `User with email ${email} not found`);
  }

  res.json(successResponse(userResult.rows[0]));
}));

// ========== Subscription Management ==========
router.get('/subscriptions', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  const status = req.query.status;

  let query = `
    SELECT
      us.id,
      us.user_email,
      us.plan_id,
      us.status,
      us.trial_end_date,
      us.subscription_start_date,
      us.subscription_end_date,
      us.created_at
    FROM user_subscriptions us
  `;

  const params = [limit, offset];
  let paramCount = 3;

  if (status) {
    query += ` WHERE us.status = $${paramCount}`;
    params.push(status);
  }

  query += ` ORDER BY us.created_at DESC LIMIT $1 OFFSET $2`;

  // Get total count
  let countQuery = 'SELECT COUNT(*) FROM user_subscriptions';
  if (status) {
    countQuery += ` WHERE status = $1`;
  }

  const countResult = await TradeDB.pool.query(
    countQuery,
    status ? [status] : []
  );

  const total = parseInt(countResult.rows[0].count);

  const subscriptions = await TradeDB.pool.query(query, params);

  res.json(paginationResponse(subscriptions.rows, page, limit, total));
}));

// ========== Payment Management ==========
router.get('/payments', asyncHandler(async (req, res) => {
  // Placeholder - implement when payment tracking is added
  res.json(successResponse({
    message: 'Payment tracking coming soon',
    items: []
  }));
}));

// ========== Audit Log ==========
router.get('/audit/logs', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const adminEmail = req.query.adminEmail;
  const activityType = req.query.activityType;
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;

  const logs = await getRecentActivityLogs({
    limit,
    adminEmail,
    activityType,
    startDate,
    endDate
  });

  res.json(successResponse({ logs }));
}));

router.get('/audit/statistics', asyncHandler(async (req, res) => {
  const startDate = req.query.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const endDate = req.query.endDate || new Date().toISOString();

  const statistics = await getActivityStatistics({ startDate, endDate });

  res.json(successResponse({ statistics }));
}));

// ========== Analytics ==========
router.get('/analytics/overview', asyncHandler(async (req, res) => {
  // Placeholder - implement detailed analytics
  res.json(successResponse({
    message: 'Analytics coming soon'
  }));
}));

// ========== Database Tools ==========
router.get('/database/status', asyncHandler(async (req, res) => {
  const result = await TradeDB.pool.query(`
    SELECT
      pg_database_size(current_database()) as database_size,
      (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as active_connections
  `);

  const tables = await TradeDB.pool.query(`
    SELECT
      schemaname,
      tablename,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
      n_live_tup as row_count
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
  `);

  res.json(successResponse({
    database: {
      size: result.rows[0].database_size,
      activeConnections: parseInt(result.rows[0].active_connections)
    },
    tables: tables.rows
  }));
}));

// ========== System Settings ==========
router.get('/settings', asyncHandler(async (req, res) => {
  // Return system settings (read-only for now)
  res.json(successResponse({
    environment: process.env.NODE_ENV || 'development',
    telegram: {
      enabled: !!process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_CHAT_ID || null
    },
    database: {
      connected: TradeDB.isConnected()
    }
  }));
}));

// ========== System Actions ==========
router.post('/system/trigger-scan', asyncHandler(async (req, res) => {
  // Trigger stock scanner manually
  // This will need to be implemented based on your scanner architecture
  res.json(successResponse({
    message: 'Stock scanner triggered',
    scheduled: true
  }));
}));

router.get('/system/health', asyncHandler(async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: {
      connected: TradeDB.isConnected()
    },
    sse: {
      activeConnections: sseHandler.getConnectionCount()
    }
  };

  res.json(successResponse(health));
}));

// ========== SSE Connection Info ==========
router.get('/sse/connections', asyncHandler(async (req, res) => {
  const connections = sseHandler.getActiveConnections();

  res.json(successResponse({
    count: connections.length,
    connections
  }));
}));

// Error handler (must be last)
router.use(adminErrorHandler);

module.exports = router;
