const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Load database module
let TradeDB;
try {
  TradeDB = require('../database-postgres');
} catch (err) {
  console.error('Failed to load PostgreSQL database module:', err.message);
}

// Using memory store for sessions (PostgreSQL-based session store can be added later)
console.log('Using memory store for sessions');

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
}, async (accessToken, refreshToken, profile, done) => {
    try {
        console.log('OAuth callback received for:', profile.emails[0].value);
        
        // Extract user information
        const user = {
            id: profile.id,
            email: profile.emails[0].value.toLowerCase(),
            name: profile.displayName,
            picture: profile.photos[0].value
        };
        
        // Save or update user in database
        if (TradeDB && TradeDB.saveOrUpdateUser) {
            try {
                await TradeDB.saveOrUpdateUser({
                    email: user.email,
                    name: user.name,
                    google_id: user.id,
                    picture: user.picture
                });
                console.log('User saved/updated in database:', user.email);
            } catch (dbError) {
                console.error('Error saving user to database:', dbError);
                // Continue authentication even if database save fails
            }
        }
        
        // Allow all authenticated Google users
        console.log('Allowing all authenticated users - open registration mode');
        
        console.log('User authenticated successfully:', user.email);
        return done(null, user);
    } catch (error) {
        console.error('Error in Google OAuth strategy:', error);
        return done(error);
    }
}));

// Session configuration
const sessionConfig = {
    // Using memory store - sessions will not persist across server restarts
    // For production, consider using connect-pg-simple for PostgreSQL session storage
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