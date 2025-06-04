const { Pool } = require('pg');

// Create a pool instance for subscription checks
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

// Helper function to check user's subscription status
async function getUserSubscriptionStatus(userEmail) {
  const db = getPool();
  if (!db) {
    console.error('Database not available for subscription check');
    return null;
  }

  try {
    // Get user's subscription information
    const result = await db.query(`
      SELECT 
        u.email,
        u.region,
        u.subscription_status,
        u.subscription_end_date,
        u.is_premium,
        us.subscription_status as current_status,
        us.trial_end_date,
        us.subscription_end_date as active_sub_end_date
      FROM users u
      LEFT JOIN user_subscriptions us ON u.email = us.user_id
      WHERE u.email = $1
      ORDER BY us.created_at DESC
      LIMIT 1
    `, [userEmail]);

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    const now = new Date();

    // Determine actual subscription status
    let status = 'expired';
    let daysRemaining = 0;
    let endDate = null;

    // Check if user has an active subscription record
    if (user.current_status) {
      if (user.current_status === 'trial' && user.trial_end_date) {
        endDate = new Date(user.trial_end_date);
        if (now <= endDate) {
          status = 'trial';
          daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
        }
      } else if (user.current_status === 'active' && user.active_sub_end_date) {
        endDate = new Date(user.active_sub_end_date);
        if (now <= endDate) {
          status = 'active';
          daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
        }
      }
    }

    return {
      email: user.email,
      region: user.region || 'IN',
      status: status,
      endDate: endDate,
      daysRemaining: daysRemaining,
      isPremium: status === 'active',
      isActive: status === 'active' || status === 'trial'
    };
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return null;
  }
}

// Main middleware function
function ensureSubscriptionActive(req, res, next) {
  // Skip subscription check for certain paths
  const exemptPaths = [
    '/api/check-subscription-setup',
    '/api/subscription/status',
    '/api/subscription/plans',
    '/api/payment',
    '/api/admin',
    '/login',
    '/auth',
    '/logout',
    '/health'
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
      if (!subscription) {
        // No subscription record found - treat as expired
        req.subscription = {
          status: 'none',
          isActive: false,
          isPremium: false
        };
        return res.status(403).json({ 
          error: 'No subscription found',
          redirect: '/subscription/expired',
          subscription: req.subscription
        });
      }

      // Attach subscription info to request
      req.subscription = subscription;

      // Allow access if subscription is active (trial or paid)
      if (subscription.isActive) {
        return next();
      }

      // Subscription expired
      return res.status(403).json({ 
        error: 'Subscription expired',
        redirect: '/subscription/expired',
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