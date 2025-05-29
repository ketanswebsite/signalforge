const express = require('express');
const router = express.Router();
const { passport } = require('../config/auth');

// Login route
router.get('/login', (req, res) => {
    // If already authenticated, redirect to home
    if (req.isAuthenticated()) {
        return res.redirect('/');
    }
    res.sendFile('login.html', { root: './public' });
});

// Google OAuth2 routes
router.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        // Successful authentication, redirect to home or intended page
        const redirectTo = req.session.returnTo || '/';
        delete req.session.returnTo;
        res.redirect(redirectTo);
    }
);

// Logout route
router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/login');
    });
});

// Get current user info (API route)
router.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            authenticated: true,
            user: {
                name: req.user.name,
                email: req.user.email,
                picture: req.user.picture
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

module.exports = router;