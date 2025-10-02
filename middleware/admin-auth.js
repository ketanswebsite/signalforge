/**
 * Admin Authentication Middleware
 * Provides JWT-based authentication and role-based access control for admin users
 */

const jwt = require('jsonwebtoken');

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

// JWT configuration
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.SESSION_SECRET || 'default-admin-secret';
const JWT_EXPIRES_IN = '24h';

/**
 * Generate JWT token for admin user
 */
function generateAdminToken(user) {
  const payload = {
    email: user.email,
    name: user.name || user.email,
    role: determineAdminRole(user.email),
    type: 'admin',
    timestamp: Date.now()
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'signalforge-admin'
  });
}

/**
 * Verify JWT token
 */
function verifyAdminToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'signalforge-admin'
    });
    return decoded;
  } catch (error) {
    return null;
  }
}

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
 * Middleware: Ensure user is authenticated admin (for HTML pages)
 */
function ensureAdmin(req, res, next) {
  // Check session-based auth first
  if (req.user && isAdmin(req.user.email)) {
    req.adminUser = {
      email: req.user.email,
      name: req.user.name || req.user.email,
      role: determineAdminRole(req.user.email)
    };
    return next();
  }

  // Check JWT token in Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyAdminToken(token);

    if (decoded && isAdmin(decoded.email)) {
      req.adminUser = decoded;
      return next();
    }
  }

  // Check JWT token in cookie
  if (req.cookies && req.cookies.admin_token) {
    const decoded = verifyAdminToken(req.cookies.admin_token);

    if (decoded && isAdmin(decoded.email)) {
      req.adminUser = decoded;
      return next();
    }
  }

  return res.status(403).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Access Denied</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f3f4f6; }
        .error-box { text-align: center; background: white; padding: 3rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 400px; }
        .error-icon { font-size: 4rem; margin-bottom: 1rem; }
        h1 { font-size: 1.5rem; color: #1f2937; margin-bottom: 0.5rem; }
        p { color: #6b7280; margin-bottom: 1.5rem; }
        a { display: inline-block; background: #2563eb; color: white; padding: 0.75rem 1.5rem; border-radius: 6px; text-decoration: none; font-weight: 500; }
        a:hover { background: #1e40af; }
      </style>
    </head>
    <body>
      <div class="error-box">
        <div class="error-icon">🔒</div>
        <h1>Access Denied</h1>
        <p>Admin privileges required to access this page.</p>
        <a href="/">Return to Home</a>
      </div>
    </body>
    </html>
  `);
}

/**
 * Middleware: Ensure user is authenticated admin (for API endpoints)
 */
function ensureAdminAPI(req, res, next) {
  // Check session-based auth first
  if (req.user && isAdmin(req.user.email)) {
    req.adminUser = {
      email: req.user.email,
      name: req.user.name || req.user.email,
      role: determineAdminRole(req.user.email)
    };
    return next();
  }

  // Check JWT token in Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyAdminToken(token);

    if (decoded && isAdmin(decoded.email)) {
      req.adminUser = decoded;
      return next();
    }
  }

  // Check JWT token in cookie
  if (req.cookies && req.cookies.admin_token) {
    const decoded = verifyAdminToken(req.cookies.admin_token);

    if (decoded && isAdmin(decoded.email)) {
      req.adminUser = decoded;
      return next();
    }
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

/**
 * Middleware: Ensure user has specific role
 */
function ensureAdminRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.adminUser) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Admin authentication required'
        },
        timestamp: new Date().toISOString()
      });
    }

    if (!allowedRoles.includes(req.adminUser.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Your admin role does not have permission for this action',
          details: {
            required: allowedRoles,
            current: req.adminUser.role
          }
        },
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
}

/**
 * API endpoint to generate admin token (requires existing session)
 */
async function generateTokenEndpoint(req, res) {
  try {
    if (!req.user || !isAdmin(req.user.email)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Admin privileges required'
        }
      });
    }

    const token = generateAdminToken(req.user);
    const adminUser = {
      email: req.user.email,
      name: req.user.name || req.user.email,
      role: determineAdminRole(req.user.email)
    };

    // Set token as HTTP-only cookie
    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    return res.json({
      success: true,
      data: {
        token,
        user: adminUser,
        expiresIn: JWT_EXPIRES_IN
      },
      message: 'Admin token generated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to generate admin token',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * API endpoint to verify admin token
 */
async function verifyTokenEndpoint(req, res) {
  try {
    const token = req.body.token || req.cookies.admin_token;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'No token provided'
        }
      });
    }

    const decoded = verifyAdminToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token is invalid or expired'
        }
      });
    }

    return res.json({
      success: true,
      data: {
        valid: true,
        user: decoded
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to verify token',
        details: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  // Middleware functions
  ensureAdmin,
  ensureAdminAPI,
  ensureAdminRole,

  // Utility functions
  generateAdminToken,
  verifyAdminToken,
  isAdmin,
  determineAdminRole,

  // API endpoint handlers
  generateTokenEndpoint,
  verifyTokenEndpoint,

  // Constants
  ADMIN_ROLES,
  ADMIN_EMAILS
};
