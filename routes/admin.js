/**
 * Admin Routes
 * API endpoints for admin portal functionality
 */

const express = require('express');
const router = express.Router();

// Import middleware
const { ensureAdminAPI } = require('../middleware/admin-auth');

const {
  adminErrorHandler,
  asyncHandler,
  successResponse,
  paginationResponse,
  requireField,
  requireFields,
  AdminAPIError
} = require('../middleware/admin-error-handler');

// Import database
const TradeDB = require('../database-postgres');
const Input = require('../lib/shared/input');
const AccountDeletion = require('../lib/shared/account-deletion');
const SqlConsole = require('../lib/shared/sql-console');

// What the subscription_plans CHECK constraints allow (migrations/003_create_subscription_tables.sql)
const PLAN_REGIONS = ['UK', 'US', 'India', 'Global'];
const PLAN_CURRENCIES = ['GBP', 'USD', 'INR'];

// Subscription rows (us) and their plans (sp). A row from the Stripe checkout (routes/stripe.js) names
// its plan by plan_code and has no plan_id: joined on plan_id alone, every Stripe row was missing from
// the plan counts and the MRR.
const PLAN_OF_ROW = 'sp.id = us.plan_id OR (us.plan_id IS NULL AND sp.plan_code = us.plan_code)';
// A row that pays now: 'active' and inside its paid period, as middleware/subscription.js grants access
const PAYING = "us.status = 'active' AND COALESCE(us.end_date, us.subscription_end_date) > NOW()";
// A row with access now: a paying one, or a free trial that is still running
const CURRENT = `(us.status = 'trial' AND us.trial_end_date > NOW()) OR (${PAYING})`;
// What a paying row brings in each month: its own payment spread over its billing period (a Stripe
// row), else its plan's monthly price (a row an admin or a migration made)
const MONTHLY_AMOUNT = `CASE
      WHEN COALESCE(us.billing_period, us.billing_cycle) = 'lifetime' THEN 0
      WHEN us.amount_paid > 0 THEN us.amount_paid / CASE COALESCE(us.billing_period, us.billing_cycle)
        WHEN 'quarterly' THEN 3 WHEN 'annual' THEN 12 WHEN 'yearly' THEN 12 ELSE 1 END
      ELSE COALESCE(sp.price_monthly, 0)
    END`;

/**
 * Monthly recurring revenue, one entry per currency: amounts in different currencies are never
 * added together (the old figures summed pounds, dollars and rupees and showed the total in pounds).
 * @returns {Promise<Array<{currency: string, mrr: number, subscriptions: number}>>}
 */
async function recurringRevenue() {
  const { rows } = await TradeDB.pool.query(`
    SELECT COALESCE(us.currency, sp.currency) AS currency,
           ROUND(SUM(${MONTHLY_AMOUNT}), 2) AS mrr,
           COUNT(*)::int AS subscriptions
    FROM user_subscriptions us
    LEFT JOIN subscription_plans sp ON ${PLAN_OF_ROW}
    WHERE ${PAYING}
    GROUP BY 1
    ORDER BY 1
  `);
  return rows.map(row => ({ currency: row.currency, mrr: parseFloat(row.mrr), subscriptions: row.subscriptions }));
}

/**
 * Churn over the last 30 days, in percent (one decimal): the subscriptions cancelled in that time against
 * those plus the ones paying now. A cancellation is dated by cancellation_date (the user's cancel and the
 * Stripe webhook write it), else end_date (the admin's cancel writes only that). It used to read end_date
 * alone, so a subscription Stripe cancelled never counted, and to set every 'active' row against them,
 * paid up or not.
 * @returns {Promise<number>}
 */
async function churnRate() {
  const { rows } = await TradeDB.pool.query(`
    SELECT
      (COUNT(*) FILTER (WHERE us.status = 'cancelled'
        AND COALESCE(us.cancellation_date, us.end_date) >= NOW() - INTERVAL '30 days'))::int AS cancelled,
      (COUNT(*) FILTER (WHERE ${PAYING}))::int AS paying
    FROM user_subscriptions us
  `);
  const { cancelled, paying } = rows[0];
  return cancelled + paying > 0 ? Math.round((cancelled / (cancelled + paying)) * 1000) / 10 : 0;
}

// Dashboard "Recent activity": the audit log (admin_activity_log). Account deletions write to it, the
// user's own and the admin's (lib/shared/account-deletion.js); until 2026-09-24 this route was a
// placeholder that always answered an empty list. It sits above router.use(ensureAdminAPI), but
// server.js puts the admin guard in front of this whole router, so it is admin-only like the rest.
router.get('/audit/logs', asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  let result;
  try {
    result = await TradeDB.pool.query(`
      SELECT id, admin_email, activity_type, description, target_type, target_id, success, created_at
      FROM admin_activity_log
      ORDER BY created_at DESC, id DESC
      LIMIT $1
    `, [limit]);
  } catch (error) {
    if (error.code === '42P01') {   // a database that never got migrations/008_create_admin_activity_log.sql
      return res.json(successResponse({ logs: [], missing: true }, 'This database has no audit log table'));
    }
    throw error;
  }
  res.json(successResponse({ logs: result.rows }));
}));

// Apply admin authentication to all routes below
router.use(ensureAdminAPI);

// ========== Dashboard Metrics ==========
// Each figure is read on its own. One that cannot be read comes back as null, and the dashboard shows
// '—': the old handler reported a failed read as 0, and sent a hard-coded zero change for each
// figure and a payments-this-month figure it never computed.
router.get('/dashboard/metrics', asyncHandler(async (req, res) => {
  const read = async (what, fn) => {
    try {
      return await fn();
    } catch (error) {
      console.log(`Dashboard metric "${what}" failed:`, error.message);
      return null;
    }
  };
  const count = (what, sql) => read(what, async () => parseInt((await TradeDB.pool.query(sql)).rows[0].count, 10));

  const [totalUsers, activeSubscriptions, totalTrades, mrr] = await Promise.all([
    count('users', 'SELECT COUNT(*) FROM users'),
    count('paying subscriptions', `SELECT COUNT(*) FROM user_subscriptions us WHERE ${PAYING}`),
    count('trades', 'SELECT COUNT(*) FROM trades'),
    read('mrr', recurringRevenue)
  ]);

  res.json(successResponse({ totalUsers, activeSubscriptions, totalTrades, mrr }));
}));

// ========== User Management ==========
router.get('/users', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;

  // The Users tab's search box (part of an email or a name) and its "Telegram linked" filter. The tab
  // always sent them; until 2026-09-24 this route ignored both and listed everyone.
  const where = [];
  const params = [];
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (search) {
    params.push(`%${search.replace(/[\\%_]/g, '\\$&')}%`);
    where.push(`(u.email ILIKE $${params.length} OR u.name ILIKE $${params.length})`);
  }
  if (req.query.filter === 'telegram') {
    where.push('u.telegram_chat_id IS NOT NULL');
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countResult = await TradeDB.pool.query(`SELECT COUNT(*) FROM users u ${whereSql}`, params);
  const total = parseInt(countResult.rows[0].count);

  const usersResult = await TradeDB.pool.query(`
    SELECT
      u.email,
      u.name,
      u.first_login,
      u.last_login,
      u.telegram_chat_id,
      u.is_complimentary,
      u.complimentary_until,
      s.plan_name AS sub_plan,
      s.status AS sub_status,
      s.billing_cycle AS sub_billing_cycle,
      s.trial_end_date AS sub_trial_end,
      s.end_date AS sub_end,
      s.next_billing_date AS sub_next_billing
    FROM users u
    LEFT JOIN LATERAL (
      SELECT plan_name, status, billing_cycle, trial_end_date, end_date, next_billing_date
      FROM user_subscriptions us
      WHERE us.user_email = u.email
      ORDER BY us.id DESC
      LIMIT 1
    ) s ON true
    ${whereSql}
    ORDER BY u.first_login DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, offset]);

  // Summarise what each user can actually use — shown in User Management
  const ADMIN_EMAIL_ACCESS = process.env.ADMIN_EMAIL || 'ketanjoshisahs@gmail.com';
  const shortDate = d => d ? require('../lib/shared/date-format').formatDateDDMMYYYY(d) : null;
  const withAccess = usersResult.rows.map(row => {
    let access;
    if (row.email === ADMIN_EMAIL_ACCESS) {
      access = { level: 'admin', label: 'Admin', detail: 'Every feature, every market' };
    } else if (row.is_complimentary && (!row.complimentary_until || new Date(row.complimentary_until) > new Date())) {
      access = {
        level: 'complimentary',
        label: 'Complimentary',
        detail: row.complimentary_until ? `Until ${shortDate(row.complimentary_until)}` : 'Lifetime'
      };
    } else if (row.sub_status === 'active') {
      access = {
        level: 'subscribed',
        label: row.sub_plan || 'Subscribed',
        detail: row.sub_next_billing ? `Renews ${shortDate(row.sub_next_billing)}` : (row.sub_billing_cycle || 'Active')
      };
    } else if (row.sub_status === 'trial') {
      const trialEnd = row.sub_trial_end ? new Date(row.sub_trial_end) : null;
      const live = !trialEnd || trialEnd > new Date();
      access = live
        ? { level: 'trial', label: `${row.sub_plan || 'Trial'} trial`, detail: trialEnd ? `Ends ${shortDate(trialEnd)}` : 'Running' }
        : { level: 'none', label: 'Trial ended', detail: shortDate(trialEnd) };
    } else if (row.sub_status === 'cancelled' && row.sub_end && new Date(row.sub_end) > new Date()) {
      access = { level: 'cancelled', label: `${row.sub_plan || 'Plan'} (cancelled)`, detail: `Keeps access until ${shortDate(row.sub_end)}` };
    } else if (row.is_complimentary && row.complimentary_until) {
      access = { level: 'none', label: 'Comp expired', detail: shortDate(row.complimentary_until) };
    } else if (row.sub_status) {
      access = { level: 'none', label: 'Expired', detail: row.sub_plan || null };
    } else {
      access = { level: 'none', label: 'No access', detail: 'Never subscribed' };
    }
    return { ...row, access };
  });

  res.json(paginationResponse(withAccess, page, limit, total));
}));

// Get all users with complimentary access (must be before /users/:email to avoid route conflict)
router.get('/users/complimentary', asyncHandler(async (req, res) => {
  const result = await TradeDB.pool.query(`
    SELECT
      email,
      name,
      is_complimentary,
      complimentary_until,
      complimentary_reason,
      granted_by,
      granted_at,
      CASE
        WHEN complimentary_until IS NULL THEN 'lifetime'
        WHEN complimentary_until > NOW() THEN 'active'
        ELSE 'expired'
      END as status
    FROM users
    WHERE is_complimentary = true
    ORDER BY granted_at DESC
  `);

  res.json(successResponse({ users: result.rows }));
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

router.post('/users', asyncHandler(async (req, res) => {
  const { email, name } = req.body;

  requireFields(req.body, ['email', 'name']);

  const result = await TradeDB.pool.query(`
    INSERT INTO users (email, name, first_login, last_login)
    VALUES ($1, $2, NOW(), NOW())
    RETURNING *
  `, [email, name]);

  res.json(successResponse(result.rows[0], 'User created successfully'));
}));

router.put('/users/:email', asyncHandler(async (req, res) => {
  const email = req.params.email;
  const { name } = req.body;

  requireField(req.body, 'name');

  const result = await TradeDB.pool.query(`
    UPDATE users
    SET name = $1
    WHERE email = $2
    RETURNING *
  `, [name, email]);

  if (result.rows.length === 0) {
    throw new AdminAPIError('USER_NOT_FOUND', `User with email ${email} not found`);
  }

  res.json(successResponse(result.rows[0], 'User updated successfully'));
}));

// Deletes the account and everything it owns, and signs it out on every device: the same deletion as
// the user's own GDPR delete (lib/shared/account-deletion.js). It used to delete the users row alone:
// the account's trades, subscriptions and payments stayed, and its next signed-in request re-created
// the row (server.js ensureUserInDatabase), so the account came back.
router.delete('/users/:email', asyncHandler(async (req, res) => {
  const email = req.params.email;
  if (AccountDeletion.isProtectedAccount(email)) {
    throw new AdminAPIError('FORBIDDEN', 'The admin account owns the house portfolio and cannot be deleted');
  }

  let result;
  try {
    result = await AccountDeletion.deleteAccount({
      pool: TradeDB.pool,
      email,
      requestedBy: req.adminUser.email,
      ipAddress: AccountDeletion.clientAddress(req),
      byAdmin: true
    });
  } catch (error) {
    console.error('Admin account deletion failed:', error.message);
    throw new AdminAPIError('DATABASE_ERROR', 'Deleting the account failed, and nothing was deleted');
  }

  if (!result.found) {
    throw new AdminAPIError('USER_NOT_FOUND', `User with email ${email} not found`);
  }

  const sessionsEnded = await AccountDeletion.endAccountSessions(req.sessionStore, email);
  res.json(successResponse(
    { email, financialRecordsRetained: result.financialRecordsRetained, sessionsEnded },
    'User deleted with everything the account owned, and signed out everywhere'
  ));
}));

// ========== Subscription Management ==========

// Get all subscription plans, each with the subscriptions that have access now (running trials included)
router.get('/subscription-plans', asyncHandler(async (req, res) => {
  const plansResult = await TradeDB.pool.query(`
    SELECT
      sp.*,
      (COUNT(us.id) FILTER (WHERE ${CURRENT}))::int AS subscriber_count
    FROM subscription_plans sp
    LEFT JOIN user_subscriptions us ON ${PLAN_OF_ROW}
    GROUP BY sp.id
    ORDER BY sp.created_at DESC
  `);

  res.json(successResponse({
    plans: plansResult.rows
  }));
}));

// Create subscription plan
router.post('/subscription-plans', asyncHandler(async (req, res) => {
  const { plan_name, plan_code, region, currency, price_monthly, trial_days } = req.body;

  requireFields(req.body, ['plan_name', 'plan_code', 'region', 'currency', 'price_monthly']);
  // Values the table refuses used to fail in Postgres and come back as 500
  if (!PLAN_REGIONS.includes(region)) {
    throw new AdminAPIError('VALIDATION_ERROR', `region must be one of ${PLAN_REGIONS.join(', ')}`);
  }
  if (!PLAN_CURRENCIES.includes(currency)) {
    throw new AdminAPIError('VALIDATION_ERROR', `currency must be one of ${PLAN_CURRENCIES.join(', ')}`);
  }
  const price = Input.nonNegativeNumber(price_monthly);
  if (price === null) {
    throw new AdminAPIError('VALIDATION_ERROR', 'price_monthly must be a number of zero or more');
  }
  const trialDays = trial_days === undefined || trial_days === null || trial_days === '' ? 0 : Input.nonNegativeInteger(trial_days);
  if (trialDays === null) {
    throw new AdminAPIError('VALIDATION_ERROR', 'trial_days must be a whole number of zero or more');
  }

  const result = await TradeDB.pool.query(`
    INSERT INTO subscription_plans (
      plan_name, plan_code, region, currency,
      price_monthly, trial_days, is_active, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
    RETURNING *
  `, [plan_name, plan_code, region, currency, price, trialDays]);

  res.json(successResponse(result.rows[0], 'Plan created successfully'));
}));

// Update subscription plan
router.put('/subscription-plans/:id', asyncHandler(async (req, res) => {
  const planId = req.params.id;
  const { plan_name, price_monthly, is_active } = req.body;

  const updates = [];
  const values = [];
  let paramCount = 1;

  if (plan_name !== undefined) {
    updates.push(`plan_name = $${paramCount++}`);
    values.push(plan_name);
  }

  if (price_monthly !== undefined) {
    const price = Input.nonNegativeNumber(price_monthly);
    if (price === null) {
      throw new AdminAPIError('VALIDATION_ERROR', 'price_monthly must be a number of zero or more');
    }
    updates.push(`price_monthly = $${paramCount++}`);
    values.push(price);
  }

  if (is_active !== undefined) {
    if (typeof is_active !== 'boolean') {
      throw new AdminAPIError('VALIDATION_ERROR', 'is_active must be true or false');
    }
    updates.push(`is_active = $${paramCount++}`);
    values.push(is_active);
  }

  if (updates.length === 0) {
    throw new AdminAPIError('VALIDATION_ERROR', 'No fields to update');
  }

  values.push(planId);
  const query = `
    UPDATE subscription_plans
    SET ${updates.join(', ')}
    WHERE id = $${paramCount}
    RETURNING *
  `;

  const result = await TradeDB.pool.query(query, values);

  if (result.rows.length === 0) {
    throw new AdminAPIError('NOT_FOUND', 'Plan not found');
  }

  res.json(successResponse(result.rows[0], 'Plan updated successfully'));
}));

// Delete subscription plan
router.delete('/subscription-plans/:id', asyncHandler(async (req, res) => {
  const planId = req.params.id;
  if (!/^\d+$/.test(planId)) {
    throw new AdminAPIError('NOT_FOUND', 'Plan not found');
  }

  // Any subscription that references the plan blocks the delete, whatever its status: the
  // foreign key (user_subscriptions.plan_id) refuses it. Counting only 'active' ones let a plan
  // with trial subscribers through to that refusal, which came back as a misleading 400.
  const checkResult = await TradeDB.pool.query(`
    SELECT status, COUNT(*)::int AS count FROM user_subscriptions
    WHERE plan_id = $1
    GROUP BY status
  `, [planId]);
  const inUse = checkResult.rows.reduce((sum, row) => sum + row.count, 0);

  if (inUse > 0) {
    throw new AdminAPIError(
      'CONFLICT',
      'Cannot delete a plan that subscriptions still use',
      { subscriptions: Object.fromEntries(checkResult.rows.map(row => [row.status, row.count])) }
    );
  }

  const result = await TradeDB.pool.query(`
    DELETE FROM subscription_plans WHERE id = $1 RETURNING id
  `, [planId]);

  if (result.rows.length === 0) {
    throw new AdminAPIError('NOT_FOUND', 'Plan not found');
  }

  res.json(successResponse({ id: planId }, 'Plan deleted successfully'));
}));

// Get active subscriptions
router.get('/subscriptions', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  const status = req.query.status;

  // A Stripe row keeps its own plan name, currency, dates and billing period (routes/stripe.js)
  let query = `
    SELECT
      us.id,
      us.user_email,
      us.plan_id,
      us.status,
      us.trial_end_date,
      COALESCE(us.start_date, us.subscription_start_date, us.trial_start_date) AS start_date,
      COALESCE(us.end_date, us.subscription_end_date) AS end_date,
      us.created_at,
      COALESCE(us.plan_name, sp.plan_name) AS plan_name,
      COALESCE(us.currency, sp.currency) AS currency,
      sp.price_monthly,
      us.amount_paid,
      COALESCE(us.billing_period, us.billing_cycle) AS billing
    FROM user_subscriptions us
    LEFT JOIN subscription_plans sp ON ${PLAN_OF_ROW}
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

// Cancel subscription
router.post('/subscriptions/:id/cancel', asyncHandler(async (req, res) => {
  const subscriptionId = req.params.id;

  const result = await TradeDB.pool.query(`
    UPDATE user_subscriptions
    SET status = 'cancelled', end_date = NOW()
    WHERE id = $1
    RETURNING *
  `, [subscriptionId]);

  if (result.rows.length === 0) {
    throw new AdminAPIError('NOT_FOUND', 'Subscription not found');
  }

  res.json(successResponse(result.rows[0], 'Subscription cancelled successfully'));
}));

// ========== Complimentary Access Management ==========

// Grant complimentary access to a user
router.post('/users/:email/grant-access', asyncHandler(async (req, res) => {
  const userEmail = req.params.email;
  const { type, expiresAt, reason } = req.body;
  const adminEmail = req.user?.email || 'admin';

  requireFields(req.body, ['type', 'reason']);

  if (!['lifetime', 'temporary'].includes(type)) {
    throw new AdminAPIError('VALIDATION_ERROR', 'Type must be lifetime or temporary');
  }

  if (type === 'temporary' && !expiresAt) {
    throw new AdminAPIError('VALIDATION_ERROR', 'expiresAt required for temporary access');
  }
  // A date (YYYY-MM-DD) or an ISO date-time: anything else failed in Postgres and came back as 500
  if (type === 'temporary' && !Input.isoTimestamp(expiresAt)) {
    throw new AdminAPIError('VALIDATION_ERROR', 'expiresAt must be a date written YYYY-MM-DD');
  }

  // Check if user exists
  const userCheck = await TradeDB.pool.query(
    'SELECT email FROM users WHERE email = $1',
    [userEmail]
  );

  if (userCheck.rows.length === 0) {
    throw new AdminAPIError('NOT_FOUND', 'User not found');
  }

  // Update user with complimentary access
  const userUpdate = await TradeDB.pool.query(`
    UPDATE users
    SET is_complimentary = true,
        complimentary_until = $1,
        complimentary_reason = $2,
        granted_by = $3,
        granted_at = NOW()
    WHERE email = $4
    RETURNING *
  `, [type === 'temporary' ? expiresAt : null, reason, adminEmail, userEmail]);

  // Log in grants table
  await TradeDB.pool.query(`
    INSERT INTO subscription_grants
    (user_email, grant_type, expires_at, reason, granted_by)
    VALUES ($1, $2, $3, $4, $5)
  `, [userEmail, type, type === 'temporary' ? expiresAt : null, reason, adminEmail]);

  res.json(successResponse(userUpdate.rows[0], 'Complimentary access granted successfully'));
}));

// Revoke complimentary access from a user
router.post('/users/:email/revoke-access', asyncHandler(async (req, res) => {
  const userEmail = req.params.email;
  const { reason } = req.body;
  const adminEmail = req.user?.email || 'admin';

  requireField(req.body, 'reason');

  // Update user to remove complimentary access
  const userUpdate = await TradeDB.pool.query(`
    UPDATE users
    SET is_complimentary = false,
        complimentary_until = NULL
    WHERE email = $1
    RETURNING *
  `, [userEmail]);

  if (userUpdate.rows.length === 0) {
    throw new AdminAPIError('NOT_FOUND', 'User not found');
  }

  // Log revocation
  await TradeDB.pool.query(`
    INSERT INTO subscription_grants
    (user_email, grant_type, reason, granted_by, revoked_at, revoked_by, revoke_reason)
    VALUES ($1, 'revoked', $2, $3, NOW(), $4, $5)
  `, [userEmail, 'Access revoked', adminEmail, adminEmail, reason]);

  res.json(successResponse(userUpdate.rows[0], 'Complimentary access revoked successfully'));
}));

// Get subscription analytics. MRR per currency, from every paying row (Stripe rows included). The
// trends it used to send (MRR +12%, ARR +12%, churn -2%, LTV +15%) were hard-coded, and so was its
// lifetime value: total MRR divided by the churn rate, not a customer's value.
router.get('/subscription-analytics', asyncHandler(async (req, res) => {
  const mrr = await recurringRevenue();
  const churn = await churnRate();

  // Subscriptions started in each of the last 6 months, trials included, oldest first
  const growthResult = await TradeDB.pool.query(`
    SELECT
      TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') as month,
      COUNT(*)::int as count
    FROM user_subscriptions
    WHERE created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY DATE_TRUNC('month', created_at)
  `);

  res.json(successResponse({
    mrr,
    churn_rate: churn,
    growth: growthResult.rows
  }));
}));

// ========== Payment Management ==========

// Get all payment transactions
router.get('/payments', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  const status = req.query.status;
  const provider = req.query.provider;

  let query = `
    SELECT
      pt.*
    FROM payment_transactions pt
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 1;

  if (status && status !== 'all') {
    query += ` AND pt.status = $${paramCount++}`;
    params.push(status);
  }

  if (provider && provider !== 'all') {
    query += ` AND pt.payment_provider = $${paramCount++}`;
    params.push(provider);
  }

  // Add pagination
  query += ` ORDER BY pt.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
  params.push(limit, offset);

  // Get total count
  let countQuery = 'SELECT COUNT(*) FROM payment_transactions WHERE 1=1';
  const countParams = [];
  let countParamCount = 1;

  if (status && status !== 'all') {
    countQuery += ` AND status = $${countParamCount++}`;
    countParams.push(status);
  }

  if (provider && provider !== 'all') {
    countQuery += ` AND payment_provider = $${countParamCount++}`;
    countParams.push(provider);
  }

  const countResult = await TradeDB.pool.query(countQuery, countParams);
  const total = parseInt(countResult.rows[0].count);

  const payments = await TradeDB.pool.query(query, params);

  res.json(paginationResponse(payments.rows, page, limit, total));
}));

// Get verification queue (must come BEFORE /:transactionId to avoid route conflict)
router.get('/payments/verification-queue', asyncHandler(async (req, res) => {
  const result = await TradeDB.pool.query(`
    SELECT
      pv.*,
      pt.amount,
      pt.currency,
      pt.payment_provider,
      pt.user_email
    FROM payment_verification_queue pv
    LEFT JOIN payment_transactions pt ON pv.transaction_id = pt.transaction_id
    WHERE pv.verification_status = 'pending'
    ORDER BY pv.created_at ASC
  `);

  res.json(successResponse({
    queue: result.rows
  }));
}));

// Get refunds (must come BEFORE /:transactionId to avoid route conflict)
router.get('/payments/refunds', asyncHandler(async (req, res) => {
  const result = await TradeDB.pool.query(`
    SELECT * FROM payment_refunds
    ORDER BY created_at DESC
    LIMIT 100
  `);

  res.json(successResponse({
    refunds: result.rows
  }));
}));

// Get single payment
router.get('/payments/:transactionId', asyncHandler(async (req, res) => {
  const transactionId = req.params.transactionId;

  const result = await TradeDB.pool.query(
    'SELECT * FROM payment_transactions WHERE transaction_id = $1',
    [transactionId]
  );

  if (result.rows.length === 0) {
    throw new AdminAPIError('NOT_FOUND', 'Payment not found');
  }

  res.json(successResponse(result.rows[0]));
}));

// Verify payment
router.post('/payments/:transactionId/verify', asyncHandler(async (req, res) => {
  const transactionId = req.params.transactionId;
  const { approved } = req.body;

  requireField(req.body, 'approved');
  if (typeof approved !== 'boolean') {
    throw new AdminAPIError('VALIDATION_ERROR', 'approved must be true or false');
  }

  // Only a payment still awaiting verification can be approved or rejected. One statement checks
  // and changes it, so two admins cannot both decide the same payment. It used to update 0 rows
  // for a payment that does not exist, and re-stamp one already decided, and answer success.
  const newStatus = approved ? 'completed' : 'failed';
  const updated = await TradeDB.pool.query(`
    UPDATE payment_transactions
    SET status = $1, processed_at = NOW(), updated_at = NOW()
    WHERE transaction_id = $2 AND status = 'pending'
    RETURNING transaction_id
  `, [newStatus, transactionId]);

  if (updated.rows.length === 0) {
    const existing = await TradeDB.pool.query('SELECT status FROM payment_transactions WHERE transaction_id = $1', [transactionId]);
    if (existing.rows.length === 0) {
      throw new AdminAPIError('PAYMENT_NOT_FOUND', 'Payment not found');
    }
    throw new AdminAPIError('PAYMENT_ALREADY_VERIFIED', `Payment is already ${existing.rows[0].status}`);
  }

  // Update verification queue
  await TradeDB.pool.query(`
    UPDATE payment_verification_queue
    SET verification_status = $1, verified_at = NOW()
    WHERE transaction_id = $2
  `, [approved ? 'verified' : 'failed', transactionId]);

  res.json(successResponse(
    { transactionId, approved, status: newStatus },
    `Payment ${approved ? 'approved' : 'rejected'} successfully`
  ));
}));

// Process refund
router.post('/payments/:transactionId/refund', asyncHandler(async (req, res) => {
  const transactionId = req.params.transactionId;
  const { reason } = req.body;

  requireField(req.body, 'reason');

  // Get original payment
  const paymentResult = await TradeDB.pool.query(
    'SELECT * FROM payment_transactions WHERE transaction_id = $1',
    [transactionId]
  );

  if (paymentResult.rows.length === 0) {
    throw new AdminAPIError('NOT_FOUND', 'Payment not found');
  }

  const payment = paymentResult.rows[0];

  if (payment.status !== 'completed') {
    throw new AdminAPIError('INVALID_STATE', `Can only refund completed payments (this one is ${payment.status})`);
  }

  // One transaction: the payment becomes 'refunded' - only while it is still completed, so a double
  // click cannot refund twice - and payment_refunds gets the reason and the time. The reason and
  // time used to be written to payment_transactions, which has no such columns: every refund failed
  // with 500. This records the refund; the money itself moves in the payment provider.
  const client = await TradeDB.pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(`
      UPDATE payment_transactions
      SET status = 'refunded', updated_at = NOW()
      WHERE transaction_id = $1 AND status = 'completed'
      RETURNING transaction_id
    `, [transactionId]);
    if (updated.rows.length === 0) {
      throw new AdminAPIError('INVALID_STATE', 'Can only refund completed payments (this one changed meanwhile)');
    }
    await client.query(`
      INSERT INTO payment_refunds (
        transaction_id, user_email, refund_amount, currency,
        refund_reason, status, refunded_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, 'completed', NOW(), NOW())
    `, [transactionId, payment.user_email, payment.amount, payment.currency, reason]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  res.json(successResponse(
    { transactionId, refundAmount: payment.amount },
    'Refund recorded'
  ));
}));

// Get payment analytics. Revenue is per currency, and the changes it used to send (+15%, +23, +2%,
// -1%) were hard-coded; there is no earlier period to compare with, so there are none.
router.get('/payment-analytics', asyncHandler(async (req, res) => {
  // Completed payments, per currency
  const revenueResult = await TradeDB.pool.query(`
    SELECT currency, SUM(amount) as revenue, COUNT(*)::int as payments
    FROM payment_transactions
    WHERE status = 'completed'
    GROUP BY currency
    ORDER BY currency
  `);

  // Total transactions
  const transactionsResult = await TradeDB.pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
      COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded
    FROM payment_transactions
  `);

  // Revenue by provider and currency
  const providerResult = await TradeDB.pool.query(`
    SELECT
      payment_provider as provider,
      currency,
      SUM(amount) as revenue,
      COUNT(*)::int as count
    FROM payment_transactions
    WHERE status = 'completed'
    GROUP BY payment_provider, currency
    ORDER BY revenue DESC
  `);

  // Success rate by day (last 7 days, oldest first)
  const successRateResult = await TradeDB.pool.query(`
    SELECT
      TO_CHAR(DATE_TRUNC('day', created_at), 'DD-MM') as date,
      ROUND(
        (COUNT(CASE WHEN status = 'completed' THEN 1 END)::DECIMAL / COUNT(*) * 100),
        2
      ) as rate
    FROM payment_transactions
    WHERE created_at >= NOW() - INTERVAL '7 days'
    GROUP BY DATE_TRUNC('day', created_at)
    ORDER BY DATE_TRUNC('day', created_at)
  `);

  const stats = transactionsResult.rows[0];
  const totalTransactions = parseInt(stats.total);
  const successRate = totalTransactions > 0
    ? ((parseInt(stats.completed) / totalTransactions) * 100).toFixed(2)
    : 0;
  const refundRate = totalTransactions > 0
    ? ((parseInt(stats.refunded) / totalTransactions) * 100).toFixed(2)
    : 0;

  res.json(successResponse({
    revenue: revenueResult.rows.map(row => ({ currency: row.currency, revenue: parseFloat(row.revenue), payments: row.payments })),
    totalTransactions,
    successRate,
    refundRate,
    byProvider: providerResult.rows.map(row => ({ ...row, revenue: parseFloat(row.revenue) })),
    successRateDaily: successRateResult.rows
  }));
}));

// ========== Analytics ==========

// Revenue Analytics: MRR per currency from every paying row (Stripe rows included), what each plan
// and region brings in, and completed payments per month. It used to add pounds, dollars and rupees
// together, send an "MRR growth" of 12% that was a placeholder, and a lifetime value computed as
// total MRR divided by the churn rate.
router.get('/analytics/revenue', asyncHandler(async (req, res) => {
  const mrr = await recurringRevenue();

  // What each plan and region brings in each month, per currency
  const breakdownResult = await TradeDB.pool.query(`
    SELECT
      COALESCE(sp.region, 'Unknown') as region,
      COALESCE(us.plan_name, sp.plan_name) as plan_name,
      COALESCE(us.currency, sp.currency) as currency,
      ROUND(SUM(${MONTHLY_AMOUNT}), 2) as mrr,
      COUNT(*)::int as subscriptions
    FROM user_subscriptions us
    LEFT JOIN subscription_plans sp ON ${PLAN_OF_ROW}
    WHERE ${PAYING}
    GROUP BY 1, 2, 3
    ORDER BY 4 DESC
  `);

  // Completed payments per month and currency, the last 12 months, oldest first
  const trendResult = await TradeDB.pool.query(`
    SELECT
      TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') as month,
      currency,
      SUM(amount) as revenue
    FROM payment_transactions
    WHERE created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '11 months' AND status = 'completed'
    GROUP BY DATE_TRUNC('month', created_at), currency
    ORDER BY DATE_TRUNC('month', created_at), currency
  `);

  res.json(successResponse({
    mrr,
    breakdown: breakdownResult.rows.map(row => ({ ...row, mrr: parseFloat(row.mrr) })),
    trend: trendResult.rows.map(row => ({ ...row, revenue: parseFloat(row.revenue) }))
  }));
}));

// User Engagement Analytics
router.get('/analytics/engagement', asyncHandler(async (req, res) => {
  // DAU (Daily Active Users) - users who logged in today
  const dauResult = await TradeDB.pool.query(`
    SELECT COUNT(DISTINCT email) as dau
    FROM users
    WHERE last_login >= CURRENT_DATE
  `);

  // WAU (Weekly Active Users)
  const wauResult = await TradeDB.pool.query(`
    SELECT COUNT(DISTINCT email) as wau
    FROM users
    WHERE last_login >= CURRENT_DATE - INTERVAL '7 days'
  `);

  // MAU (Monthly Active Users)
  const mauResult = await TradeDB.pool.query(`
    SELECT COUNT(DISTINCT email) as mau
    FROM users
    WHERE last_login >= CURRENT_DATE - INTERVAL '30 days'
  `);

  // Inactive users (30+ days)
  const inactiveResult = await TradeDB.pool.query(`
    SELECT COUNT(*) as inactive
    FROM users
    WHERE last_login < CURRENT_DATE - INTERVAL '30 days' OR last_login IS NULL
  `);

  // Users by the day of their last sign-in, the last 30 days (the only activity users rows record).
  // The feature-usage percentages and the week and month growth this route used to send were made up.
  const activityTrendResult = await TradeDB.pool.query(`
    SELECT
      TO_CHAR(last_login, 'YYYY-MM-DD') as date,
      COUNT(DISTINCT email) as active_users
    FROM users
    WHERE last_login >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY TO_CHAR(last_login, 'YYYY-MM-DD')
    ORDER BY date
  `);

  res.json(successResponse({
    dau: parseInt(dauResult.rows[0].dau),
    wau: parseInt(wauResult.rows[0].wau),
    mau: parseInt(mauResult.rows[0].mau),
    inactive: parseInt(inactiveResult.rows[0].inactive),
    activityTrend: activityTrendResult.rows
  }));
}));

// Subscription Health Analytics
router.get('/analytics/subscriptions', asyncHandler(async (req, res) => {
  // Trial conversion, per account: of the accounts that ever had a trial, those paying now. The Stripe
  // checkout adds a paid row and leaves the trial row as it was (routes/stripe.js), so the old count of
  // 'active' rows with a trial end date never saw a Stripe conversion.
  const conversionResult = await TradeDB.pool.query(`
    SELECT
      (COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM user_subscriptions us WHERE us.user_email = t.user_email AND ${PAYING}
      )))::int AS converted,
      COUNT(*)::int AS total_trials
    FROM (SELECT DISTINCT user_email FROM user_subscriptions WHERE trial_end_date IS NOT NULL) t
  `);

  const converted = conversionResult.rows[0].converted;
  const totalTrials = conversionResult.rows[0].total_trials;
  const trialConversion = totalTrials > 0 ? Math.round((converted / totalTrials) * 1000) / 10 : 0;

  const churn = await churnRate();

  // Subscription funnel. The upgrades (12), downgrades (3) and "profile completed" (88% of trials)
  // this route used to send were made up: nothing records a plan change or a profile.
  const funnelResult = await TradeDB.pool.query(`
    SELECT
      COUNT(*) as signups
    FROM users
  `);

  const funnel = {
    signups: parseInt(funnelResult.rows[0].signups),
    trialStarted: totalTrials,
    converted
  };

  // Age distribution
  const ageDistResult = await TradeDB.pool.query(`
    SELECT
      CASE
        WHEN us.created_at >= NOW() - INTERVAL '30 days' THEN '0-30 days'
        WHEN us.created_at >= NOW() - INTERVAL '90 days' THEN '31-90 days'
        WHEN us.created_at >= NOW() - INTERVAL '180 days' THEN '91-180 days'
        ELSE '180+ days'
      END as age_group,
      COUNT(*) as count
    FROM user_subscriptions us
    WHERE ${PAYING}
    GROUP BY age_group
  `);

  const ageDistribution = {};
  ageDistResult.rows.forEach(row => {
    ageDistribution[row.age_group] = parseInt(row.count);
  });

  res.json(successResponse({
    trialConversion,
    churnRate: churn,
    funnel,
    ageDistribution
  }));
}));

// Trading Activity Analytics
router.get('/analytics/trades', asyncHandler(async (req, res) => {
  // Total trades
  const totalResult = await TradeDB.pool.query(`
    SELECT COUNT(*) as total FROM trades
  `);

  // Win rate
  const winRateResult = await TradeDB.pool.query(`
    SELECT
      COUNT(CASE WHEN profit_loss_percentage > 0 THEN 1 END) as winning,
      COUNT(*) as total
    FROM trades
    WHERE status = 'closed'
  `);

  const winning = parseInt(winRateResult.rows[0].winning);
  const total = parseInt(winRateResult.rows[0].total);
  const winRate = total > 0 ? ((winning / total) * 100).toFixed(1) : 0;

  // Average P/L
  const avgPLResult = await TradeDB.pool.query(`
    SELECT AVG(profit_loss_percentage) as avg_pl
    FROM trades
    WHERE status = 'closed'
  `);

  // Avg trades per user
  const avgTradesResult = await TradeDB.pool.query(`
    SELECT
      CASE WHEN COUNT(DISTINCT user_id) > 0
      THEN COUNT(*)::DECIMAL / COUNT(DISTINCT user_id)
      ELSE 0 END as avg_trades
    FROM trades
  `);

  // Top symbols
  const topSymbolsResult = await TradeDB.pool.query(`
    SELECT
      symbol,
      COUNT(*) as count,
      ROUND((COUNT(CASE WHEN profit_loss_percentage > 0 THEN 1 END)::DECIMAL / COUNT(*) * 100), 1) as win_rate,
      ROUND(AVG(profit_loss_percentage), 2) as avg_pl
    FROM trades
    WHERE status = 'closed'
    GROUP BY symbol
    ORDER BY count DESC
    LIMIT 10
  `);

  res.json(successResponse({
    totalTrades: parseInt(totalResult.rows[0].total),
    winRate: parseFloat(winRate),
    winningTrades: winning,
    avgPL: parseFloat(avgPLResult.rows[0].avg_pl || 0).toFixed(2),
    avgTradesPerUser: parseFloat(avgTradesResult.rows[0].avg_trades || 0).toFixed(1),
    topSymbols: topSymbolsResult.rows
  }));
}));

// ========== Database Tools ==========

// The migration files, and which of them schema_migrations records. Nothing here applies a migration:
// they are applied by hand (run-single-migration.js), which does not record them, so a file the list
// calls unrecorded may well be applied. This route used to call those files "pending", beside two
// buttons that ran nothing and answered success.
router.get('/database/migrations', asyncHandler(async (req, res) => {
  const fs = require('fs');
  const path = require('path');

  // Get applied migrations from database (if migrations table exists)
  let applied = [];
  try {
    const result = await TradeDB.pool.query(`
      SELECT filename, applied_at
      FROM schema_migrations
      ORDER BY applied_at DESC
    `);
    applied = result.rows;
  } catch (error) {
    // Migrations table doesn't exist yet
  }

  // Get all migration files
  const migrationsDir = path.join(process.cwd(), 'migrations');
  let allMigrations = [];

  try {
    if (fs.existsSync(migrationsDir)) {
      allMigrations = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();
    }
  } catch (error) {
    console.error('Error reading migrations directory:', error);
  }

  const recordedNames = applied.map(m => m.filename);

  res.json(successResponse({
    recorded: applied,
    unrecorded: allMigrations.filter(m => !recordedNames.includes(m)),
    lastRecorded: applied.length > 0 ? applied[0].filename : null
  }));
}));

// Execute SQL query. Read mode (the default, anything but mode 'write') runs exactly one statement in a
// READ ONLY transaction (lib/shared/sql-console.js): Postgres refuses a write and a second statement.
// It used to judge the text by its first word, so "WITH d AS (DELETE ...) SELECT", TRUNCATE or
// "SELECT 1; DROP TABLE x" ran as reads. Write mode runs the text as given.
router.post('/database/query', asyncHandler(async (req, res) => {
  const { query, mode } = req.body;
  requireField(req.body, 'query');
  if (typeof query !== 'string') {
    throw new AdminAPIError('VALIDATION_ERROR', 'query must be text');
  }

  const startTime = Date.now();
  let result;

  try {
    result = mode === 'write'
      ? await TradeDB.pool.query(SqlConsole.capRows(query))
      : await SqlConsole.runReadOnly(TradeDB.pool, query);
  } catch (error) {
    // A Postgres answer (a five-character SQLSTATE) is the admin's to read; anything else is ours (500)
    if (!/^[0-9A-Z]{5}$/.test(String(error.code || ''))) {
      throw error;
    }
    if (error.code === '25006') {
      throw new AdminAPIError('FORBIDDEN', `Read-only mode: ${error.message}. Choose write mode to change data.`);
    }
    if (/multiple commands/.test(error.message)) {
      throw new AdminAPIError('INVALID_INPUT', 'Read-only mode runs one statement at a time');
    }
    throw new AdminAPIError('INVALID_INPUT', error.message, { code: error.code });
  }

  const executionTime = Date.now() - startTime;

  res.json(successResponse({
    rows: result.rows,
    rowCount: result.rowCount,
    executionTime
  }));
}));

// Get maintenance status
router.get('/database/maintenance-status', asyncHandler(async (req, res) => {
  // Get last vacuum/analyze times from pg_stat_user_tables
  const statsResult = await TradeDB.pool.query(`
    SELECT
      MAX(last_vacuum) as last_vacuum,
      MAX(last_autovacuum) as last_autovacuum,
      MAX(last_analyze) as last_analyze,
      MAX(last_autoanalyze) as last_autoanalyze
    FROM pg_stat_user_tables
  `);

  // Get index usage stats
  const indexResult = await TradeDB.pool.query(`
    SELECT
      schemaname,
      relname as tablename,
      indexrelname as indexname,
      idx_scan,
      idx_tup_read,
      idx_tup_fetch
    FROM pg_stat_user_indexes
    ORDER BY idx_scan DESC
    LIMIT 20
  `);

  const stats = statsResult.rows[0];

  res.json(successResponse({
    lastVacuum: stats.last_vacuum || stats.last_autovacuum || 'Never',
    lastAnalyze: stats.last_analyze || stats.last_autoanalyze || 'Never',
    lastReindex: 'N/A', // PostgreSQL doesn't track this
    indexes: indexResult.rows
  }));
}));

// Run VACUUM
router.post('/database/maintenance/vacuum', asyncHandler(async (req, res) => {
  // Run VACUUM on all tables
  await TradeDB.pool.query('VACUUM');

  res.json(successResponse({
    message: 'VACUUM completed successfully'
  }));
}));

// Run ANALYZE
router.post('/database/maintenance/analyze', asyncHandler(async (req, res) => {
  // Run ANALYZE on all tables
  await TradeDB.pool.query('ANALYZE');

  res.json(successResponse({
    message: 'ANALYZE completed successfully'
  }));
}));

// Run REINDEX, one table at a time (REINDEX TABLE needs the table's owner). The answer says which tables
// failed: it used to say "REINDEX completed successfully" even when every table had failed.
router.post('/database/maintenance/reindex', asyncHandler(async (req, res) => {
  const tables = await TradeDB.pool.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `);

  const failed = [];
  for (const { tablename } of tables.rows) {
    try {
      await TradeDB.pool.query(`REINDEX TABLE "${tablename.replace(/"/g, '""')}"`);
    } catch (error) {
      console.error(`Failed to reindex ${tablename}:`, error.message);
      failed.push({ table: tablename, error: error.message });
    }
  }

  const total = tables.rows.length;
  const reindexed = total - failed.length;
  res.json(successResponse(
    { reindexed, failed },
    failed.length === 0
      ? `REINDEX rebuilt the indexes of all ${total} tables`
      : `REINDEX rebuilt ${reindexed} of ${total} tables; ${failed.length} failed`
  ));
}));

// ========== System Settings ==========
// What this server runs with, read-only: Render's environment sets it, and the portal cannot change it.
// A key shows only as set or not set. The editable settings pages this replaces saved nothing, and
// their values (a scan every 4 hours, a 60-minute session, PayPal and Razorpay, SMTP) were made up.
router.get('/settings/general', asyncHandler(async (req, res) => {
  const set = (name) => Boolean(process.env[name]);
  res.json(successResponse({
    environment: process.env.NODE_ENV || 'development',
    autoExecute: process.env.AUTO_EXECUTE !== 'false',
    integrations: {
      telegramBot: set('TELEGRAM_BOT_TOKEN'),
      webPush: set('VAPID_PUBLIC_KEY') && set('VAPID_PRIVATE_KEY'),
      stripe: set('STRIPE_SECRET_KEY'),
      stripeWebhook: set('STRIPE_WEBHOOK_SECRET'),
      gemini: set('GEMINI_API_KEY')
    }
  }));
}));

// Telegram: is the bot configured, and has the signed-in admin linked their own chat (the test message
// goes there)
router.get('/settings/telegram', asyncHandler(async (req, res) => {
  const { rows } = await TradeDB.pool.query('SELECT telegram_chat_id FROM users WHERE email = $1', [req.adminUser.email]);
  res.json(successResponse({
    botConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    ownChatLinked: Boolean(rows.length && rows[0].telegram_chat_id)
  }));
}));

// Send the signed-in admin a message from the bot, to their own linked chat and nowhere else
// (sendTelegramAlert would fall back to the broadcast chat, TELEGRAM_CHAT_ID, for a missing chat id).
// It used to send nothing and answer "Test message sent successfully".
router.post('/settings/telegram/test', asyncHandler(async (req, res) => {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new AdminAPIError('SERVICE_UNAVAILABLE', 'Telegram is not configured on this server: TELEGRAM_BOT_TOKEN is not set');
  }
  const { rows } = await TradeDB.pool.query('SELECT telegram_chat_id FROM users WHERE email = $1', [req.adminUser.email]);
  const chatId = rows.length ? rows[0].telegram_chat_id : null;
  if (!chatId) {
    throw new AdminAPIError('INVALID_STATE', 'Your account has no linked Telegram chat. Link it from the Account page, then try again.');
  }

  const telegramBot = require('../lib/telegram/telegram-bot');
  const delivered = await telegramBot.sendTelegramAlert(chatId, {
    type: 'custom',
    message: 'Admin portal test message: the bot can reach this chat.'
  });
  if (!delivered) {
    throw new AdminAPIError('EXTERNAL_SERVICE_ERROR', 'Telegram did not accept the test message');
  }
  res.json(successResponse({ delivered }, 'Test message sent to your linked Telegram chat'));
}));

// Clear a cache. The server holds one worth clearing: the AI verdicts in memory (ml/conviction-engine.js),
// which the next read takes back from the database (conviction_daily). This route used to accept any
// name ("redis", "query", "sessions": none of them exists here) and clear nothing.
router.post('/settings/clear-cache', asyncHandler(async (req, res) => {
  const { type } = req.body;
  requireField(req.body, 'type');
  if (type !== 'conviction') {
    throw new AdminAPIError('VALIDATION_ERROR', "type must be 'conviction' (the AI verdicts held in memory): the server has no other cache to clear");
  }

  const cleared = require('../ml/conviction-engine').clearMemoryCache();
  res.json(successResponse(
    { type, cleared },
    `Cleared ${cleared} AI verdict${cleared === 1 ? '' : 's'} from memory; the next read of each symbol goes to the database`
  ));
}));

// ========== System Health ==========
// The database answers SELECT 1, within timeoutMs. TradeDB.isConnected() says only that a pool was
// created at boot: the health check used to call that "PostgreSQL pool responding" without asking.
async function pingDatabase(timeoutMs = 5000) {
  if (!TradeDB.pool) {
    return { ok: false, ms: null, message: 'No database is configured (DATABASE_URL is not set)' };
  }
  const started = Date.now();
  let timer;
  try {
    await Promise.race([
      TradeDB.pool.query('SELECT 1'),
      new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`no answer within ${timeoutMs / 1000} s`)), timeoutMs);
      })
    ]);
    const ms = Date.now() - started;
    return { ok: true, ms, message: `PostgreSQL answered SELECT 1 in ${ms} ms` };
  } catch (error) {
    return { ok: false, ms: Date.now() - started, message: `PostgreSQL did not answer: ${error.message}` };
  } finally {
    clearTimeout(timer);
  }
}

router.get('/system/health', asyncHandler(async (req, res) => {
  const mem = process.memoryUsage();
  const ping = await pingDatabase();
  const dbConnected = ping.ok;
  // Memory against the tightest limit the server knows: the container's (process.constrainedMemory(),
  // the cgroup limit) for everything the process holds, else the most the V8 heap may grow to. It was
  // the heap in use against heapTotal, the heap V8 has reserved so far and grows on demand: 90% of that
  // is normal, and the check read "fail" on a server with memory to spare.
  const containerLimit = typeof process.constrainedMemory === 'function' ? Number(process.constrainedMemory()) || 0 : 0;
  const memory = containerLimit > 0 && containerLimit <= require('os').totalmem()
    ? { used: mem.rss, limit: containerLimit, text: 'the process holds', of: 'the container allows' }
    : { used: mem.heapUsed, limit: require('v8').getHeapStatistics().heap_size_limit, text: 'the heap holds', of: 'it may grow to' };
  const heapPercent = memory.limit > 0 ? (memory.used / memory.limit) * 100 : 0;
  const mb = bytes => Math.round(bytes / 1048576);
  const uptimeSec = process.uptime();
  const fmtUptime = `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m`;

  // Named checks — the admin Health Monitor renders these directly
  const checks = [
    {
      name: 'Database connection',
      status: dbConnected ? 'pass' : 'fail',
      message: ping.message,
      duration: ping.ms === null ? undefined : `${ping.ms} ms`
    },
    {
      name: 'Memory pressure',
      status: heapPercent < 90 ? 'pass' : 'fail',
      message: `${memory.text[0].toUpperCase()}${memory.text.slice(1)} ${mb(memory.used)} MB of the ${mb(memory.limit)} MB ${memory.of} (${heapPercent.toFixed(0)}%)`
    },
    {
      name: 'Server uptime',
      status: 'pass',
      message: `Up ${fmtUptime}`
    }
  ];

  const warnings = [];
  if (heapPercent >= 75 && heapPercent < 90) warnings.push(`Memory at ${heapPercent.toFixed(0)}% of its limit — keep an eye on it`);
  if (!dbConnected) warnings.push('The database did not answer: most admin data will fail to load');

  const health = {
    status: dbConnected ? 'healthy' : 'degraded',
    overall: checks.some(c => c.status === 'fail') ? 'degraded' : 'healthy',
    checks,
    warnings,
    timestamp: new Date().toISOString(),
    uptime: uptimeSec,
    memory: mem,
    database: {
      connected: dbConnected
    }
  };

  res.json(successResponse(health));
}));

// Error handler (must be last)
router.use(adminErrorHandler);

module.exports = router;
