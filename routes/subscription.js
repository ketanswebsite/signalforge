/**
 * Subscription Routes
 * Public and authenticated user-facing subscription endpoints
 */

const express = require('express');
const router = express.Router();
const TradeDB = require('../database-postgres');
const AdminIdentity = require('../config/admin');
// A plan Stripe bills is changed in Stripe first (lib/shared/stripe-billing.js)
const StripeBilling = require('../lib/shared/stripe-billing');

// The app's one database pool (database-postgres.js), null when DATABASE_URL is unset. This
// router used to open a pool of its own.
function getPool() {
  return TradeDB.pool;
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

    // Check if user is admin (the admin guard's own check)
    const isAdmin = AdminIdentity.isAdmin(userEmail);

    const subscription = await getUserSubscriptionStatus(userEmail);

    // No row yet: the account has never started a trial. The trial page shows its day-0 state and
    // the account page its "No plan yet" card; region still feeds the checkout page's plan pick.
    if (!subscription || subscription.status === 'none') {
      return res.json(successResponse({
        hasSubscription: false,
        status: 'none',
        isAdmin: isAdmin,
        region: subscription ? subscription.region : undefined,
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

    // The running row: a trial or a paid plan still inside its period
    const subResult = await db.query(`
      SELECT id, status
      FROM user_subscriptions
      WHERE user_email = $1
        AND (   (status = 'trial' AND trial_end_date > NOW())
             OR (status = 'active' AND COALESCE(end_date, subscription_end_date) > NOW()))
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `, [userEmail]);

    if (subResult.rows.length === 0) {
      return res.status(404).json(errorResponse('No active subscription found', 'NOT_FOUND'));
    }

    const subscription = subResult.rows[0];

    // A plan Stripe bills stops renewing in Stripe first, keeping its paid-up period. When Stripe cannot be told,
    // nothing changes here: the page must never show a cancel while the card goes on being charged.
    try {
      await StripeBilling.syncStripeForRow(db, subscription.id, 'stop-renewal');
    } catch (error) {
      if (error.code !== 'PAYMENT_PROVIDER') throw error;
      console.error('[STRIPE] Cancel not applied:', error.message);
      return res.status(502).json(errorResponse('Your plan could not be cancelled with the payment provider just now, so nothing was changed. Try again in a few minutes.', 'PAYMENT_PROVIDER'));
    }

    // Cancel it but keep the access already given: end_date becomes the end the row already had
    // (the trial end, or the paid-up period), and middleware/subscription.js keeps a cancelled row
    // active until then. SET expressions read the row as it was, so `status` is still 'trial' or 'active'.
    const cancelResult = await db.query(`
      UPDATE user_subscriptions
      SET
        status = 'cancelled',
        end_date = CASE WHEN status = 'trial' THEN trial_end_date
                        ELSE COALESCE(end_date, subscription_end_date) END,
        cancellation_date = NOW(),
        cancellation_reason = $1,
        updated_at = NOW()
      WHERE id = $2 AND status IN ('trial', 'active')
      RETURNING end_date
    `, [reason || 'User requested cancellation', subscription.id]);

    // A second cancel that raced this one (a double click) finds the row already cancelled
    if (cancelResult.rows.length === 0) {
      return res.status(409).json(errorResponse('Your plan is already cancelled', 'ALREADY_CANCELLED'));
    }
    const accessUntil = cancelResult.rows[0].end_date;

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
      accessUntil,
      message: accessUntil
        ? `Your subscription has been cancelled. You'll continue to have access until ${require('../lib/shared/date-format').formatDateDDMMYYYY(accessUntil)}.`
        : 'Your subscription has been cancelled.'
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

    // Only the row the access check reads (the newest that is not a checkout attempt) can come back,
    // and only while the access its cancel kept is still running: the rule middleware/subscription.js
    // applies to a cancelled row, so what the account page offers is what this route accepts
    const subResult = await db.query(`
      SELECT id, status, plan_name, trial_end_date, amount_paid,
             COALESCE(end_date, subscription_end_date, trial_end_date) AS access_until
      FROM user_subscriptions
      WHERE user_email = $1
        AND status NOT IN ('pending', 'payment_failed')
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `, [userEmail]);

    const subscription = subResult.rows[0];

    if (!subscription || subscription.status !== 'cancelled' ||
        !subscription.access_until || new Date(subscription.access_until) <= new Date()) {
      return res.status(404).json(errorResponse('No cancelled subscription found to reactivate', 'NOT_FOUND'));
    }

    // A free trial comes back as a trial with the same end date: no extra free days, and never a paid
    // 'active' row. Only a paid plan comes back as 'active'.
    const restoredStatus = subscription.trial_end_date && !(Number(subscription.amount_paid) > 0) ? 'trial' : 'active';

    // A plan Stripe bills renews again in Stripe first; when Stripe cannot be told, nothing changes here
    try {
      await StripeBilling.syncStripeForRow(db, subscription.id, 'renew');
    } catch (error) {
      if (error.code !== 'PAYMENT_PROVIDER') throw error;
      console.error('[STRIPE] Reactivate not applied:', error.message);
      return res.status(502).json(errorResponse('Your plan could not be reactivated with the payment provider just now, so nothing was changed. Try again in a few minutes.', 'PAYMENT_PROVIDER'));
    }

    // Reactivate subscription (a second request that raced this one finds the row no longer cancelled). A plan
    // Stripe bills drops the end its cancel wrote: the paid-up end, which every paid renewal moves on, decides again.
    const reactivated = await db.query(`
      UPDATE user_subscriptions
      SET
        status = $2,
        end_date = CASE WHEN left(stripe_subscription_id, 4) = 'sub_' THEN NULL ELSE end_date END,
        cancellation_date = NULL,
        cancellation_reason = NULL,
        updated_at = NOW()
      WHERE id = $1 AND status = 'cancelled'
      RETURNING id
    `, [subscription.id, restoredStatus]);
    if (reactivated.rows.length === 0) {
      return res.status(409).json(errorResponse('Your plan is already running again', 'ALREADY_REACTIVATED'));
    }

    // Log to history
    await db.query(`
      INSERT INTO subscription_history
      (subscription_id, user_email, event_type, old_status, new_status, description)
      VALUES ($1, $2, 'reactivated', 'cancelled', $3, 'Subscription reactivated by user')
    `, [subscription.id, userEmail, restoredStatus]);

    res.json(successResponse({
      reactivated: true,
      status: restoredStatus,
      accessUntil: subscription.access_until,
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

    // A running trial or paid plan, as the access check reads it, blocks a new trial
    const { getUserSubscriptionStatus } = require('../middleware/subscription');
    const current = await getUserSubscriptionStatus(userEmail);
    if (current && (current.status === 'trial' || current.status === 'active')) {
      return res.status(400).json(errorResponse('You already have an active subscription or trial', 'ALREADY_SUBSCRIBED'));
    }

    // One free trial per account: a trial that was cancelled or has run out never starts again
    const pastTrial = await db.query(`
      SELECT 1
      FROM user_subscriptions
      WHERE user_email = $1
        AND (status = 'trial' OR trial_start_date IS NOT NULL OR trial_end_date IS NOT NULL)
      LIMIT 1
    `, [userEmail]);

    if (pastTrial.rows.length > 0) {
      return res.status(409).json(errorResponse('You have already had your free trial. Choose a plan to keep the signals coming.', 'TRIAL_USED'));
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
        amount_paid,
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
