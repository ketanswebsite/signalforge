const TradeDB = require('../database-postgres');

// The app's one database pool (database-postgres.js), null when DATABASE_URL is unset. This
// module used to open a pool of its own.
function getPool() {
  return TradeDB.pool;
}

// Helper function to check user's subscription status
async function getUserSubscriptionStatus(userEmail) {
  const db = getPool();
  if (!db) {
    console.error('Database not available for subscription check');
    return null;
  }

  try {
    // Get user's subscription information (including complimentary access): the users row LEFT JOINed
    // to the account's newest subscription row. Checkout attempts (pending, payment_failed) are not
    // subscriptions and never decide access, so opening the checkout cannot end a running trial.
    // u.subscription_end_date is the users column; the row's own dates come under their own names.
    const result = await db.query(`
      SELECT
        u.email,
        u.region,
        u.subscription_status,
        u.subscription_end_date,
        u.is_premium,
        u.is_complimentary,
        u.complimentary_until,
        u.complimentary_reason,
        u.granted_by,
        us.id as subscription_id,
        us.status as current_status,
        us.plan_name,
        us.plan_code,
        us.currency,
        us.amount_paid,
        us.billing_period,
        us.trial_start_date,
        us.trial_end_date,
        us.start_date,
        us.end_date as row_end_date,
        us.subscription_start_date as paid_start_date,
        us.subscription_end_date as paid_end_date,
        us.cancellation_date,
        us.cancellation_reason
      FROM users u
      LEFT JOIN user_subscriptions us
        ON u.email = us.user_email AND us.status NOT IN ('pending', 'payment_failed')
      WHERE u.email = $1
      ORDER BY us.created_at DESC, us.id DESC
      LIMIT 1
    `, [userEmail]);

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    const now = new Date();

    // ========================================
    // PRIORITY 1: Check complimentary access first
    // ========================================
    if (user.is_complimentary) {
      // Lifetime complimentary access (no expiry date)
      if (!user.complimentary_until) {
        return {
          email: user.email,
          region: user.region || 'IN',
          status: 'complimentary_lifetime',
          endDate: null,
          daysRemaining: null,
          isPremium: true,
          isActive: true,
          reason: user.complimentary_reason,
          grantedBy: user.granted_by
        };
      }

      // Temporary complimentary access - check if not expired
      const expiryDate = new Date(user.complimentary_until);
      if (now <= expiryDate) {
        const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
        return {
          email: user.email,
          region: user.region || 'IN',
          status: 'complimentary_temporary',
          endDate: expiryDate,
          daysRemaining: daysRemaining,
          isPremium: true,
          isActive: true,
          reason: user.complimentary_reason,
          grantedBy: user.granted_by
        };
      }
      // If complimentary access expired, fall through to regular subscription check
    }

    // ========================================
    // PRIORITY 2: Check regular subscription
    // ========================================
    // Access comes from the newest subscription row and lasts until that row's end:
    //   none       no row: the account has never started a trial
    //   trial      a free trial, until trial_end_date
    //   active     a paid plan, until end_date where the row has one (legacy rows), else the Stripe
    //              period end, subscription_end_date
    //   cancelled  keeps access until the row's end. The user's cancel writes that end into end_date
    //              (the trial end or the paid-up period); an admin cancel writes the moment it
    //              cancelled. Rows cancelled before end_date was written fall back to the paid period
    //              end, then the trial end.
    //   expired    any row past its end, and every other status
    let status = 'expired';
    let endDate = null;
    let isActive = false;

    if (!user.subscription_id) {
      status = 'none';
    } else {
      const current = user.current_status;
      const rowEnd = current === 'trial' ? user.trial_end_date
        : current === 'active' ? (user.row_end_date || user.paid_end_date)
        : (user.row_end_date || user.paid_end_date || user.trial_end_date);
      endDate = rowEnd ? new Date(rowEnd) : null;
      if (endDate && now <= endDate && (current === 'trial' || current === 'active' || current === 'cancelled')) {
        status = current;
        isActive = true;
      }
    }

    const daysRemaining = isActive ? Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)) : 0;

    return {
      email: user.email,
      region: user.region || 'IN',
      status: status,
      subscription_id: user.subscription_id,
      plan_name: user.plan_name || 'Free Trial',
      plan_code: user.plan_code,
      currency: user.currency || 'USD',
      amount_paid: user.amount_paid || 0,
      billing_period: user.billing_period || 'monthly',
      trial_start_date: user.trial_start_date,
      trial_end_date: user.trial_end_date,
      start_date: user.start_date,
      subscription_start_date: user.start_date || user.paid_start_date || user.trial_start_date,
      subscription_end_date: endDate,
      cancellation_date: user.cancellation_date,
      cancellation_reason: user.cancellation_reason,
      endDate: endDate,
      daysRemaining: daysRemaining,
      isPremium: status === 'active',
      isActive: isActive
    };
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return null;
  }
}

// Main middleware function
function ensureSubscriptionActive(req, res, next) {
  // TEMPORARY: Disable subscription checks
  const DISABLE_SUBSCRIPTION_CHECK = process.env.DISABLE_SUBSCRIPTION_CHECK === 'true';
  if (DISABLE_SUBSCRIPTION_CHECK) {
    req.subscription = {
      status: 'bypassed',
      isActive: true,
      isPremium: true
    };
    return next();
  }

  // Skip subscription check for certain paths
  const exemptPaths = [
    '/api/check-subscription-setup',
    '/api/subscription/status',
    '/api/subscription/plans',
    '/api/subscription-plans',
    '/api/user/subscription/start-trial',
    '/api/payment',
    '/api/admin',
    '/login',
    '/auth',
    '/logout',
    '/health',
    '/trial-activation.html',
    '/pricing.html'
  ];

  // Check if current path is exempt
  const isExempt = exemptPaths.some(path => req.path.startsWith(path));
  if (isExempt) {
    return next();
  }

  // Check if user is authenticated
  if (!req.user || !req.user.email) {
    return res.status(401).json({ 
      error: 'Authentication required',
      redirect: '/login'
    });
  }

  // Admin bypass - admin always has access
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'ketanjoshisahs@gmail.com';
  if (req.user.email === ADMIN_EMAIL) {
    req.subscription = {
      status: 'admin',
      isActive: true,
      isPremium: true
    };
    return next();
  }

  // Check subscription status
  getUserSubscriptionStatus(req.user.email)
    .then(subscription => {
      if (!subscription || subscription.status === 'none') {
        // No subscription record found - redirect to trial activation
        req.subscription = {
          status: 'none',
          isActive: false,
          isPremium: false
        };
        return res.status(403).json({
          error: 'No subscription found. Please start your free trial.',
          redirect: '/trial-activation.html',
          requiresTrial: true,
          subscription: req.subscription
        });
      }

      // Attach subscription info to request
      req.subscription = subscription;

      // Allow access if subscription is active (trial or paid)
      if (subscription.isActive) {
        return next();
      }

      // Subscription expired - redirect to pricing page
      return res.status(403).json({
        error: 'Subscription expired',
        redirect: '/pricing.html',
        subscription: req.subscription
      });
    })
    .catch(error => {
      console.error('Subscription middleware error:', error);
      // In case of error, allow access but log the issue
      req.subscription = {
        status: 'error',
        isActive: true,
        isPremium: false
      };
      next();
    });
}

// Middleware for premium-only features
function ensurePremiumSubscription(req, res, next) {
  // First ensure user has active subscription
  ensureSubscriptionActive(req, res, () => {
    // Check if user has premium (paid) subscription
    if (req.subscription && req.subscription.isPremium) {
      return next();
    }

    // Admin bypass
    if (req.subscription && req.subscription.status === 'admin') {
      return next();
    }

    return res.status(403).json({ 
      error: 'Premium subscription required',
      redirect: '/subscription/upgrade',
      subscription: req.subscription
    });
  });
}

// Export middleware functions
module.exports = {
  ensureSubscriptionActive,
  ensurePremiumSubscription,
  getUserSubscriptionStatus
};