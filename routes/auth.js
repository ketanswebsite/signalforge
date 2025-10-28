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
    passport.authenticate('google', {
        failureRedirect: '/login?error=auth_failed',
        failureMessage: true
    }),
    async (req, res) => {
        console.log('OAuth callback success handler called');
        console.log('User authenticated:', req.user);
        console.log('Session ID:', req.sessionID);

        try {
            // Check if user has a subscription
            const { getUserSubscriptionStatus } = require('../middleware/subscription');
            const subscription = await getUserSubscriptionStatus(req.user.email);

            // Admin bypass - admin always gets redirected to home
            const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'ketanjoshisahs@gmail.com';
            const isAdmin = req.user.email === ADMIN_EMAIL;

            // Save session explicitly before redirecting
            req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);
                    return res.status(500).send('Session save failed');
                }

                let redirectTo;

                // Determine redirect location based on subscription status
                if (isAdmin) {
                    // Admin always goes to home or intended page
                    redirectTo = req.session.returnTo || '/';
                } else if (!subscription || !subscription.isActive) {
                    // No subscription or inactive - redirect to trial activation
                    console.log('User has no active subscription - redirecting to trial activation');
                    redirectTo = '/trial-activation.html';
                } else {
                    // Has active subscription - redirect to home or intended page
                    redirectTo = req.session.returnTo || '/';
                }

                delete req.session.returnTo;

                console.log('Session saved successfully');
                console.log('Redirecting to:', redirectTo);
                res.redirect(redirectTo);
            });
        } catch (error) {
            console.error('Error checking subscription status:', error);

            // On error, save session and redirect to home (fail open)
            req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);
                    return res.status(500).send('Session save failed');
                }

                const redirectTo = req.session.returnTo || '/';
                delete req.session.returnTo;

                console.log('Redirecting to:', redirectTo, '(error fallback)');
                res.redirect(redirectTo);
            });
        }
    }
);

// Debug route for OAuth issues
router.get('/auth/debug', (req, res) => {
    res.json({
        nodeEnv: process.env.NODE_ENV,
        hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        callbackUrl: process.env.CALLBACK_URL,
        sessionConfigured: !!req.session,
        authenticated: req.isAuthenticated(),
        allowedUsers: process.env.ALLOWED_USERS ? process.env.ALLOWED_USERS.split(',').length : 0
    });
});

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