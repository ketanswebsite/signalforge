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
        price_monthly,
        price_quarterly,
        price_yearly,
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
        price_monthly ASC
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
        price_monthly,
        price_quarterly,
        price_yearly,
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

    // Check if user is admin
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'ketanjoshisahs@gmail.com';
    const isAdmin = userEmail === ADMIN_EMAIL;

    const subscription = await getUserSubscriptionStatus(userEmail);

    if (!subscription) {
      return res.json(successResponse({
        hasSubscription: false,
        status: 'none',
        isAdmin: isAdmin,
        message: isAdmin ? 'Admin - Unlimited Access' : 'No active subscription found'
      }));
    }

    res.json(successResponse({
      hasSubscription: true,
      isAdmin: isAdmin,
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

/**
 * POST /api/user/subscription/start-trial
 * Start a free 90-day trial for new users
 * Requires authentication
 */
router.post('/user/subscription/start-trial', ensureAuthenticated, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const db = getPool();

    if (!db) {
      return res.status(500).json(errorResponse('Database not available'));
    }

    // Check if user already has a subscription
    const existingSubResult = await db.query(`
      SELECT id, status, trial_end_date, end_date
      FROM user_subscriptions
      WHERE user_email = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [userEmail]);

    if (existingSubResult.rows.length > 0) {
      const existingSub = existingSubResult.rows[0];

      // If they already have an active trial or subscription, don't create a new one
      if (existingSub.status === 'trial' || existingSub.status === 'active') {
        return res.status(400).json(errorResponse('You already have an active subscription or trial', 'ALREADY_SUBSCRIBED'));
      }
    }

    // Get the FREE plan details
    const planResult = await db.query(`
      SELECT id, plan_code, plan_name, region, currency, trial_days
      FROM subscription_plans
      WHERE plan_code = 'FREE' AND is_active = true
      LIMIT 1
    `);

    if (planResult.rows.length === 0) {
      return res.status(500).json(errorResponse('Free trial plan not found', 'PLAN_NOT_FOUND'));
    }

    const plan = planResult.rows[0];
    const trialDays = plan.trial_days || 90;

    // Calculate trial end date
    const trialStartDate = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + trialDays);

    // Create trial subscription
    const insertResult = await db.query(`
      INSERT INTO user_subscriptions (
        user_email,
        plan_id,
        plan_code,
        plan_name,
        status,
        billing_period,
        amount,
        currency,
        start_date,
        trial_start_date,
        trial_end_date,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING id, trial_end_date
    `, [
      userEmail,
      plan.id,
      plan.plan_code,
      plan.plan_name,
      'trial',
      'trial',
      0,
      plan.currency,
      trialStartDate,
      trialStartDate,
      trialEndDate
    ]);

    const newSubscription = insertResult.rows[0];

    // Log to subscription history
    await db.query(`
      INSERT INTO subscription_history
      (subscription_id, user_email, event_type, old_status, new_status, description)
      VALUES ($1, $2, 'created', NULL, 'trial', 'Free 90-day trial started')
    `, [newSubscription.id, userEmail]);

    // Update user record
    await db.query(`
      UPDATE users
      SET
        subscription_status = 'trial',
        subscription_end_date = $2,
        updated_at = NOW()
      WHERE email = $1
    `, [userEmail, trialEndDate]);

    res.json(successResponse({
      trialStarted: true,
      subscriptionId: newSubscription.id,
      trialEndDate: newSubscription.trial_end_date,
      daysRemaining: trialDays,
      message: `Your ${trialDays}-day free trial has started! Enjoy full access to all features.`
    }));

  } catch (error) {
    console.error('Error starting trial:', error);
    res.status(500).json(errorResponse('Failed to start trial'));
  }
});

module.exports = router;
