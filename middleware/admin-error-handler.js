/**
 * Admin API Error Handling Middleware
 * Standardized error responses for admin API endpoints
 */

/**
 * Error codes for admin API
 */
const ERROR_CODES = {
  // Authentication & Authorization
  UNAUTHORIZED: { code: 'UNAUTHORIZED', status: 401 },
  FORBIDDEN: { code: 'FORBIDDEN', status: 403 },
  INSUFFICIENT_PERMISSIONS: { code: 'INSUFFICIENT_PERMISSIONS', status: 403 },
  INVALID_TOKEN: { code: 'INVALID_TOKEN', status: 401 },
  TOKEN_EXPIRED: { code: 'TOKEN_EXPIRED', status: 401 },

  // Validation Errors
  VALIDATION_ERROR: { code: 'VALIDATION_ERROR', status: 400 },
  MISSING_REQUIRED_FIELD: { code: 'MISSING_REQUIRED_FIELD', status: 400 },
  INVALID_INPUT: { code: 'INVALID_INPUT', status: 400 },
  INVALID_FORMAT: { code: 'INVALID_FORMAT', status: 400 },

  // Resource Errors
  NOT_FOUND: { code: 'NOT_FOUND', status: 404 },
  RESOURCE_NOT_FOUND: { code: 'RESOURCE_NOT_FOUND', status: 404 },
  USER_NOT_FOUND: { code: 'USER_NOT_FOUND', status: 404 },
  SUBSCRIPTION_NOT_FOUND: { code: 'SUBSCRIPTION_NOT_FOUND', status: 404 },
  PAYMENT_NOT_FOUND: { code: 'PAYMENT_NOT_FOUND', status: 404 },

  // Conflict Errors
  DUPLICATE_ENTRY: { code: 'DUPLICATE_ENTRY', status: 409 },
  RESOURCE_ALREADY_EXISTS: { code: 'RESOURCE_ALREADY_EXISTS', status: 409 },
  CONFLICT: { code: 'CONFLICT', status: 409 },

  // Business Logic Errors
  OPERATION_FAILED: { code: 'OPERATION_FAILED', status: 422 },
  INVALID_STATE: { code: 'INVALID_STATE', status: 422 },
  SUBSCRIPTION_ALREADY_ACTIVE: { code: 'SUBSCRIPTION_ALREADY_ACTIVE', status: 422 },
  PAYMENT_ALREADY_VERIFIED: { code: 'PAYMENT_ALREADY_VERIFIED', status: 422 },

  // Database Errors
  DATABASE_ERROR: { code: 'DATABASE_ERROR', status: 500 },
  QUERY_FAILED: { code: 'QUERY_FAILED', status: 500 },

  // External Service Errors
  EXTERNAL_SERVICE_ERROR: { code: 'EXTERNAL_SERVICE_ERROR', status: 502 },
  PAYMENT_PROVIDER_ERROR: { code: 'PAYMENT_PROVIDER_ERROR', status: 502 },
  EMAIL_SERVICE_ERROR: { code: 'EMAIL_SERVICE_ERROR', status: 502 },

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: { code: 'RATE_LIMIT_EXCEEDED', status: 429 },

  // Server Errors
  INTERNAL_SERVER_ERROR: { code: 'INTERNAL_SERVER_ERROR', status: 500 },
  NOT_IMPLEMENTED: { code: 'NOT_IMPLEMENTED', status: 501 },
  SERVICE_UNAVAILABLE: { code: 'SERVICE_UNAVAILABLE', status: 503 }
};

/**
 * Custom API Error class
 */
class AdminAPIError extends Error {
  constructor(errorCode, message, details = null) {
    super(message);
    this.name = 'AdminAPIError';

    const errorDef = ERROR_CODES[errorCode] || ERROR_CODES.INTERNAL_SERVER_ERROR;
    this.code = errorDef.code;
    this.statusCode = errorDef.status;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Create error response object
 */
function createErrorResponse(error, req = null) {
  const response = {
    success: false,
    error: {
      code: error.code || 'INTERNAL_SERVER_ERROR',
      message: error.message || 'An unexpected error occurred',
      timestamp: error.timestamp || new Date().toISOString()
    }
  };

  // Add details if available
  if (error.details) {
    response.error.details = error.details;
  }

  // Add request ID for tracking (if available)
  if (req && req.id) {
    response.error.requestId = req.id;
  }

  // In development, include stack trace
  if (process.env.NODE_ENV !== 'production' && error.stack) {
    response.error.stack = error.stack;
  }

  return response;
}

/**
 * Express error handling middleware for admin API
 */
function adminErrorHandler(err, req, res, next) {
  // Log error for debugging
  console.error('Admin API Error:', {
    error: err.message,
    code: err.code,
    path: req.path,
    method: req.method,
    admin: req.adminUser?.email,
    timestamp: new Date().toISOString()
  });

  // If error is already an AdminAPIError, use it directly
  if (err instanceof AdminAPIError) {
    const response = createErrorResponse(err, req);
    return res.status(err.statusCode).json(response);
  }

  // Handle specific error types
  if (err.name === 'ValidationError') {
    const apiError = new AdminAPIError(
      'VALIDATION_ERROR',
      'Input validation failed',
      err.errors || err.message
    );
    const response = createErrorResponse(apiError, req);
    return res.status(apiError.statusCode).json(response);
  }

  if (err.name === 'JsonWebTokenError') {
    const apiError = new AdminAPIError(
      'INVALID_TOKEN',
      'Invalid authentication token'
    );
    const response = createErrorResponse(apiError, req);
    return res.status(apiError.statusCode).json(response);
  }

  if (err.name === 'TokenExpiredError') {
    const apiError = new AdminAPIError(
      'TOKEN_EXPIRED',
      'Authentication token has expired'
    );
    const response = createErrorResponse(apiError, req);
    return res.status(apiError.statusCode).json(response);
  }

  // Database errors
  if (err.code && err.code.startsWith('23')) { // PostgreSQL error codes
    let apiError;

    if (err.code === '23505') { // Unique violation
      apiError = new AdminAPIError(
        'DUPLICATE_ENTRY',
        'A resource with this information already exists',
        { constraint: err.constraint }
      );
    } else if (err.code === '23503') { // Foreign key violation
      apiError = new AdminAPIError(
        'INVALID_INPUT',
        'Referenced resource does not exist',
        { constraint: err.constraint }
      );
    } else {
      apiError = new AdminAPIError(
        'DATABASE_ERROR',
        'Database operation failed',
        { code: err.code }
      );
    }

    const response = createErrorResponse(apiError, req);
    return res.status(apiError.statusCode).json(response);
  }

  // Default to internal server error
  const apiError = new AdminAPIError(
    'INTERNAL_SERVER_ERROR',
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message
  );

  const response = createErrorResponse(apiError, req);
  return res.status(apiError.statusCode).json(response);
}

/**
 * Async handler wrapper to catch promise rejections
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validation helper - throw error if condition is not met
 */
function validate(condition, errorCode, message, details = null) {
  if (!condition) {
    throw new AdminAPIError(errorCode, message, details);
  }
}

/**
 * Validation helper - require field to exist
 */
function requireField(obj, fieldName, errorMessage = null) {
  if (!obj || obj[fieldName] === undefined || obj[fieldName] === null || obj[fieldName] === '') {
    throw new AdminAPIError(
      'MISSING_REQUIRED_FIELD',
      errorMessage || `Missing required field: ${fieldName}`,
      { field: fieldName }
    );
  }
  return obj[fieldName];
}

/**
 * Validation helper - require multiple fields
 */
function requireFields(obj, fieldNames) {
  const missing = [];

  for (const fieldName of fieldNames) {
    if (!obj || obj[fieldName] === undefined || obj[fieldName] === null || obj[fieldName] === '') {
      missing.push(fieldName);
    }
  }

  if (missing.length > 0) {
    throw new AdminAPIError(
      'MISSING_REQUIRED_FIELD',
      `Missing required fields: ${missing.join(', ')}`,
      { fields: missing }
    );
  }
}

/**
 * Success response helper
 */
function successResponse(data, message = 'Operation successful', meta = {}) {
  return {
    success: true,
    data,
    message,
    ...meta,
    timestamp: new Date().toISOString()
  };
}

/**
 * Pagination helper
 */
function paginationResponse(items, page, limit, total) {
  const pages = Math.ceil(total / limit);

  return {
    success: true,
    data: {
      items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total),
        pages,
        hasNext: page < pages,
        hasPrev: page > 1
      }
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * 404 handler for admin API routes
 */
function notFoundHandler(req, res) {
  const error = new AdminAPIError(
    'NOT_FOUND',
    `Endpoint not found: ${req.method} ${req.path}`
  );

  const response = createErrorResponse(error, req);
  res.status(error.statusCode).json(response);
}

module.exports = {
  AdminAPIError,
  ERROR_CODES,
  adminErrorHandler,
  asyncHandler,
  validate,
  requireField,
  requireFields,
  successResponse,
  paginationResponse,
  notFoundHandler,
  createErrorResponse
};
