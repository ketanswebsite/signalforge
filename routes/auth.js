const express = require('express');
const router = express.Router();
const { passport } = require('../config/auth');
const { isAdmin } = require('../middleware/admin-auth');

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
        // Never log the session id or the whole user object: a session id in a log is a way into the account.
        console.log('OAuth callback: signed in', req.user && req.user.email);

        try {
            // Check if user has a subscription
            const { getUserSubscriptionStatus } = require('../middleware/subscription');
            const subscription = await getUserSubscriptionStatus(req.user.email);

            // Admin bypass - admin always gets redirected to home
            const isAdminUser = isAdmin(req.user.email);

            // Save session explicitly before redirecting
            req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);
                    return res.status(500).send('Session save failed');
                }

                let redirectTo;

                // Determine redirect location based on subscription status
                if (isAdminUser) {
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
    },
    // Any Google error other than "access denied" (which failureRedirect handles) reaches here instead of the
    // global error handler, which answered the browser with a JSON 502.
    (err, req, res, next) => {
        if (res.headersSent) return next(err);
        console.error('OAuth callback error:', err && err.message);
        res.redirect('/login?error=auth_failed');
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
                picture: req.user.picture,
                // The same check as the admin API guard, so the Admin link shows exactly when /api/admin lets you in.
                isAdmin: isAdmin(req.user.email)
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

module.exports = router;