/**
 * Subscription Routes
 * Public and authenticated user-facing subscription endpoints
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Create pool for database queries
let pool = null;

function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }
  return pool;
}

// Helper function for success responses
function successResponse(data, message = 'Success') {
  return {
    success: true,
    message,
    data
  };
}

// Helper function for error responses
function errorResponse(message, code = 'ERROR') {
  return {
    success: false,
    error: {
      code,
      message
    }
  };
}

// ===================================================
// PUBLIC ENDPOINTS (No authentication required)
// ===================================================

/**
 * GET /api/subscription-plans
 * Get all active subscription plans (public endpoint)
 * No authentication required
 */
router.get('/subscription-plans', async (req, res) => {
  try {
    const db = getPool();

    if (!db) {
      return res.status(500).json(errorResponse('Database not available'));
    }

    // Get all active subscription plans
    const result = await db.query(`
      SELECT
        id,
        plan_name,
        plan_code,
        region,
        currency,
        monthly_price,
        quarterly_price,
        annual_price,
        trial_days,
        features,
        is_active
      FROM subscription_plans
      WHERE is_active = true
      ORDER BY
        CASE
          WHEN plan_code = 'FREE' THEN 1
          WHEN plan_code LIKE '%BASIC%' THEN 2
          WHEN plan_code LIKE '%PRO%' THEN 3
          ELSE 4
        END,
        monthly_price ASC
    `);

    // Group plans by region
    const plansByRegion = {};
    result.rows.forEach(plan => {
      if (!plansByRegion[plan.region]) {
        plansByRegion[plan.region] = [];
      }
      plansByRegion[plan.region].push(plan);
    });

    res.json(successResponse({
      plans: result.rows,
      plansByRegion
    }));

  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    res.status(500).json(errorResponse('Failed to fetch subscription plans'));
  }
});

/**
 * GET /api/subscription-plans/:planCode
 * Get a specific plan by plan code (public endpoint)
 * No authentication required
 */
router.get('/subscription-plans/:planCode', async (req, res) => {
  try {
    const { planCode } = req.params;
    const db = getPool();

    if (!db) {
      return res.status(500).json(errorResponse('Database not available'));
    }

    const result = await db.query(`
      SELECT
        id,
        plan_name,
        plan_code,
        region,
        currency,
        monthly_price,
        quarterly_price,
        annual_price,
        trial_days,
        features,
        is_active,
        created_at
      FROM subscription_plans
      WHERE plan_code = $1 AND is_active = true
      LIMIT 1
    `, [planCode]);

    if (result.rows.length === 0) {
      return res.status(404).json(errorResponse('Plan not found', 'NOT_FOUND'));
    }

    res.json(successResponse({ plan: result.rows[0] }));

  } catch (error) {
    console.error('Error fetching plan:', error);
    res.status(500).json(errorResponse('Failed to fetch plan'));
  }
});

// ===================================================
// AUTHENTICATED USER ENDPOINTS
// ===================================================

// Middleware to ensure user is authenticated
function ensureAuthenticated(req, res, next) {
  if (!req.user || !req.user.email) {
    return res.status(401).json(errorResponse('Authentication required', 'UNAUTHORIZED'));
  }
  next();
}

/**
 * GET /api/user/subscription
 * Get current user's subscription status
 * Requires authentication
 */
router.get('/user/subscription', ensureAuthenticated, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { getUserSubscriptionStatus } = require('../middleware/subscription');

    const subscription = await getUserSubscriptionStatus(userEmail);

    if (!subscription) {
      return res.json(successResponse({
        hasSubscription: false,
        status: 'none',
        message: 'No active subscription found'
      }));
    }

    res.json(successResponse({
      hasSubscription: true,
      subscription
    }));

  } catch (error) {
    console.error('Error fetching user subscription:', error);
    res.status(500).json(errorResponse('Failed to fetch subscription'));
  }
});

/**
 * GET /api/user/payments
 * Get current user's payment history
 * Requires authentication
 */
router.get('/user/payments', ensureAuthenticated, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const db = getPool();

    if (!db) {
      return res.status(500).json(errorResponse('Database not available'));
    }

    const result = await db.query(`
      SELECT
        pt.id,
        pt.transaction_id,
        pt.external_payment_id,
        pt.payment_provider,
        pt.amount,
        pt.currency,
        pt.status,
        pt.payment_date,
        pt.refund_amount,
        pt.refund_date,
        us.plan_name
      FROM payment_transactions pt
      LEFT JOIN user_subscriptions us ON pt.subscription_id = us.id
      WHERE pt.user_email = $1
      ORDER BY pt.payment_date DESC
      LIMIT 50
    `, [userEmail]);

    res.json(successResponse({
      payments: result.rows,
      totalPayments: result.rows.length
    }));

  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json(errorResponse('Failed to fetch payment history'));
  }
});

/**
 * POST /api/user/subscription/cancel
 * Cancel current user's subscription
 * Requires authentication
 */
router.post('/user/subscription/cancel', ensureAuthenticated, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { reason } = req.body;
    const db = getPool();

    if (!db) {
      return res.status(500).json(errorResponse('Database not available'));
    }

    // Get current subscription
    const subResult = await db.query(`
      SELECT id, status, subscription_end_date
      FROM user_subscriptions
      WHERE user_email = $1
        AND status IN ('active', 'trial')
      ORDER BY created_at DESC
      LIMIT 1
    `, [userEmail]);

    if (subResult.rows.length === 0) {
      return res.status(404).json(errorResponse('No active subscription found', 'NOT_FOUND'));
    }

    const subscription = subResult.rows[0];

    // Update subscription status to cancelled
    await db.query(`
      UPDATE user_subscriptions
      SET
        status = 'cancelled',
        cancellation_date = NOW(),
        cancellation_reason = $1,
        updated_at = NOW()
      WHERE id = $2
    `, [reason || 'User requested cancellation', subscription.id]);

    // Log to subscription history
    await db.query(`
      INSERT INTO subscription_history
      (subscription_id, user_email, event_type, old_status, new_status, description)
      VALUES ($1, $2, 'cancelled', $3, 'cancelled', $4)
    `, [
      subscription.id,
      userEmail,
      subscription.status,
      `Subscription cancelled by user. Reason: ${reason || 'Not provided'}`
    ]);

    res.json(successResponse({
      cancelled: true,
      accessUntil: subscription.subscription_end_date,
      message: `Your subscription has been cancelled. You'll continue to have access until ${new Date(subscription.subscription_end_date).toLocaleDateString()}.`
    }));

  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json(errorResponse('Failed to cancel subscription'));
  }
});

/**
 * POST /api/user/subscription/reactivate
 * Reactivate a cancelled subscription
 * Requires authentication
 */
router.post('/user/subscription/reactivate', ensureAuthenticated, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const db = getPool();

    if (!db) {
      return res.status(500).json(errorResponse('Database not available'));
    }

    // Get cancelled subscription
    const subResult = await db.query(`
      SELECT id, status, plan_name
      FROM user_subscriptions
      WHERE user_email = $1
        AND status = 'cancelled'
        AND subscription_end_date > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `, [userEmail]);

    if (subResult.rows.length === 0) {
      return res.status(404).json(errorResponse('No cancelled subscription found to reactivate', 'NOT_FOUND'));
    }

    const subscription = subResult.rows[0];

    // Reactivate subscription
    await db.query(`
      UPDATE user_subscriptions
      SET
        status = 'active',
        cancellation_date = NULL,
        cancellation_reason = NULL,
        updated_at = NOW()
      WHERE id = $1
    `, [subscription.id]);

    // Log to history
    await db.query(`
      INSERT INTO subscription_history
      (subscription_id, user_email, event_type, old_status, new_status, description)
      VALUES ($1, $2, 'reactivated', 'cancelled', 'active', 'Subscription reactivated by user')
    `, [subscription.id, userEmail]);

    res.json(successResponse({
      reactivated: true,
      message: `Your ${subscription.plan_name} subscription has been reactivated!`
    }));

  } catch (error) {
    console.error('Error reactivating subscription:', error);
    res.status(500).json(errorResponse('Failed to reactivate subscription'));
  }
});

module.exports = router;
