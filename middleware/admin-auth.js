/**
 * Admin Authentication Middleware
 * Session-based admin check. server.js mounts ensureAdminAPI in front of
 * everything under /api/admin, after the /api sign-in gate. Who the admin is
 * lives in config/admin.js (ADMIN_EMAIL); its isAdmin() is the one definition.
 */

const { adminEmail, isAdmin } = require('../config/admin');

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
  return isAdmin(email) ? ADMIN_ROLES.SUPER_ADMIN : ADMIN_ROLES.READ_ONLY;
}

/**
 * Middleware: Ensure user is authenticated admin (for API endpoints)
 */
function ensureAdminAPI(req, res, next) {
  // Local development bypass — inert unless explicitly enabled and never in production
  if (process.env.ADMIN_DEV_BYPASS === 'true' && process.env.NODE_ENV !== 'production') {
    req.adminUser = { email: adminEmail(), name: 'Dev admin', role: 'super_admin' };
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
  ADMIN_ROLES
};
