const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Determine database directory based on environment
let dbDir;
if (process.env.RENDER) {
    // Use Render's persistent disk mount point
    dbDir = '/var/data';
} else {
    // Use local database directory
    dbDir = path.join(__dirname, '..', 'database');
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
}

console.log('Session database directory:', dbDir);

// Parse allowed users from environment variable
const allowedUsers = process.env.ALLOWED_USERS 
    ? process.env.ALLOWED_USERS.split(',').map(email => email.trim().toLowerCase())
    : [];

// User serialization
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Google OAuth2 Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL
}, (accessToken, refreshToken, profile, done) => {
    try {
        console.log('OAuth callback received for:', profile.emails[0].value);
        
        // Extract user information
        const user = {
            id: profile.id,
            email: profile.emails[0].value.toLowerCase(),
            name: profile.displayName,
            picture: profile.photos[0].value
        };
        
        // Check if user is allowed
        if (allowedUsers.length > 0 && !allowedUsers.includes(user.email)) {
            console.log('Access denied for email:', user.email);
            console.log('Allowed users:', allowedUsers);
            return done(null, false, { message: 'Access denied. Your email is not authorized.' });
        } else if (allowedUsers.length === 0) {
            console.warn('WARNING: ALLOWED_USERS not configured - allowing all authenticated users');
        }
        
        console.log('User authenticated successfully:', user.email);
        return done(null, user);
    } catch (error) {
        console.error('Error in Google OAuth strategy:', error);
        return done(error);
    }
}));

// Session configuration
const sessionConfig = {
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: dbDir,
        concurrentDB: true
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax', // Add SameSite for better security
        // Remove domain setting - let Express handle it automatically
        path: '/' // Ensure cookie is available for all paths
    },
    name: 'sessionId', // Custom session name
    proxy: true // Trust the reverse proxy (Render uses one)
};

// Middleware to check if user is authenticated
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
};

// Middleware to check if user is authenticated for API routes
const ensureAuthenticatedAPI = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Authentication required' });
};

module.exports = {
    passport,
    sessionConfig,
    ensureAuthenticated,
    ensureAuthenticatedAPI
};