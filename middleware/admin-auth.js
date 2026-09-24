/**
 * Admin Authentication Middleware
 * Session-based admin check. server.js mounts ensureAdminAPI in front of
 * everything under /api/admin, after the /api sign-in gate.
 */

// Admin configuration
const ADMIN_EMAILS = [
  'ketanjoshisahs@gmail.com'
];

const ADMIN_ROLES = {
  SUPER_ADMIN: 'super_admin',
  SUPPORT_ADMIN: 'support_admin',
  FINANCE_ADMIN: 'finance_admin',
  READ_ONLY: 'read_only'
};

/**
 * Determine admin role based on email
 */
function determineAdminRole(email) {
  if (email === 'ketanjoshisahs@gmail.com') {
    return ADMIN_ROLES.SUPER_ADMIN;
  }
  return ADMIN_ROLES.READ_ONLY;
}

/**
 * Check if user is admin
 */
function isAdmin(email) {
  return ADMIN_EMAILS.includes(email);
}

/**
 * Middleware: Ensure user is authenticated admin (for API endpoints)
 */
function ensureAdminAPI(req, res, next) {
  // Local development bypass — inert unless explicitly enabled and never in production
  if (process.env.ADMIN_DEV_BYPASS === 'true' && process.env.NODE_ENV !== 'production') {
    req.adminUser = { email: process.env.ADMIN_EMAIL || 'ketanjoshisahs@gmail.com', name: 'Dev admin', role: 'super_admin' };
    return next();
  }
  // The signed-in Google account must be an admin (the session is the only credential)
  if (req.user && isAdmin(req.user.email)) {
    req.adminUser = {
      email: req.user.email,
      name: req.user.name || req.user.email,
      role: determineAdminRole(req.user.email)
    };
    return next();
  }

  return res.status(403).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: 'Admin access required',
      details: 'You do not have permission to access this resource'
    },
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  ensureAdminAPI,
  isAdmin,
  determineAdminRole,
  ADMIN_ROLES,
  ADMIN_EMAILS
};
