/**
 * Security configuration and recommendations
 */

module.exports = {
    // CORS configuration
    cors: {
        origin: process.env.ALLOWED_ORIGINS ? 
            process.env.ALLOWED_ORIGINS.split(',') : 
            ['http://localhost:3000', 'http://localhost:3001'],
        credentials: true,
        optionsSuccessStatus: 200
    },
    
    // Rate limiting configuration
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limit each IP to 100 requests per windowMs
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
    },
    
    // API rate limits (more restrictive)
    apiRateLimit: {
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 30, // 30 requests per minute for API endpoints
        message: 'API rate limit exceeded. Please wait before making more requests.',
    },
    
    // Price fetching rate limit (to protect Yahoo Finance)
    priceRateLimit: {
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 10, // 10 price requests per minute
        message: 'Price fetch rate limit exceeded. Please wait.',
    },
    
    // Security headers (for use with helmet.js)
    headers: {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
                styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                fontSrc: ["'self'", 'https://fonts.gstatic.com'],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'", 'https://query1.finance.yahoo.com'],
            },
        },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        }
    },
    
    // Environment variables that MUST be set in production
    requiredEnvVars: {
        production: [
            'SESSION_SECRET',
            'DATABASE_ENCRYPTION_KEY',
            'ALLOWED_ORIGINS',
            'ADMIN_PASSWORD'
        ],
        optional: [
            'TELEGRAM_BOT_TOKEN',
            'YAHOO_API_KEY',
            'LOG_LEVEL'
        ]
    },
    
    // Security recommendations
    recommendations: `
CRITICAL SECURITY RECOMMENDATIONS:

1. **Authentication**: 
   - Implement JWT or session-based authentication immediately
   - Add middleware to protect all /api/* routes
   - Use bcrypt for password hashing

2. **Environment Variables**:
   - Never commit .env files
   - Set strong SESSION_SECRET in production
   - Use different secrets for each environment

3. **Database Security**:
   - Enable SQLite encryption if storing sensitive data
   - Regular backups of trades.db
   - Implement row-level security for multi-user setup

4. **Input Validation**:
   - Already added validation middleware
   - Consider using joi or express-validator for complex validation
   - Validate file uploads if implemented

5. **Rate Limiting**:
   - Implement rate limiting (configuration provided)
   - Different limits for different endpoints
   - Consider Redis for distributed rate limiting

6. **Monitoring**:
   - Set up error logging (Winston, Sentry)
   - Monitor for suspicious activity
   - Regular security audits

7. **HTTPS**:
   - Always use HTTPS in production
   - Implement HSTS headers
   - Use secure cookies

Example implementation in server.js:

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const session = require('express-session');

// Security headers
app.use(helmet(securityConfig.headers));

// Rate limiting
app.use('/api/', rateLimit(securityConfig.apiRateLimit));
app.use('/api/prices', rateLimit(securityConfig.priceRateLimit));

// Session management
app.use(session({
    secret: process.env.SESSION_SECRET || 'CHANGE_THIS_IN_PRODUCTION',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));
`
};