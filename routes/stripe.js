/**
 * Paid checkout (Stripe Checkout). Mounted only with the paid checkout switched on (config/stripe.js):
 *   GET  /api/stripe/config               the checkout page's "open?" check (behind the sign-in gate)
 *   POST /api/stripe/create-subscription  { planCode, billingPeriod } -> { url } of Stripe's own payment page
 *   POST /api/stripe/webhook              Stripe's events: server.js mounts `webhook` before the JSON parser and
 *                                         the sign-in gate, and the signature is its only credential
 * The price is the plan's own row in subscription_plans (price_monthly, price_quarterly or price_yearly), so the
 * checkout page shows what Stripe charges. This router writes no subscription row: the webhook writes it when Stripe
 * says the payment went through (lib/shared/stripe-billing.js), so an abandoned checkout leaves nothing behind.
 */

const express = require('express');
const router = express.Router();
const TradeDB = require('../database-postgres');
const StripeConfig = require('../config/stripe');
const StripeBilling = require('../lib/shared/stripe-billing');

// The app's one database pool (database-postgres.js), null when DATABASE_URL is unset. This
// router used to open a pool of its own.
function getPool() {
    return TradeDB.pool;
}

// Helper functions
function successResponse(data, message = 'Success') {
    return { success: true, message, data };
}

function errorResponse(message, code = 'ERROR') {
    return { success: false, error: { code, message } };
}

// Middleware to ensure user is authenticated
function ensureAuthenticated(req, res, next) {
    if (!req.user || !req.user.email) {
        return res.status(401).json(errorResponse('Authentication required', 'UNAUTHORIZED'));
    }
    next();
}

/**
 * GET /api/stripe/config
 * The checkout is open (this router is mounted only while it is), and whether Stripe is in test mode.
 * Hosted Checkout needs no publishable key on the page.
 */
router.get('/config', (req, res) => {
    res.json(successResponse({ open: true, testMode: StripeConfig.checkoutStatus().keyMode !== 'live' }));
});

/**
 * POST /api/stripe/create-subscription
 * Opens a Stripe Checkout page for the plan and billing period: Stripe takes the card there and bills the plan's
 * price every period until it is cancelled. Answers { url }; the page sends the browser to it.
 */
router.post('/create-subscription', ensureAuthenticated, async (req, res) => {
    try {
        const planCode = typeof req.body.planCode === 'string' ? req.body.planCode : '';
        const billingPeriod = typeof req.body.billingPeriod === 'string' ? req.body.billingPeriod : '';
        const period = Object.prototype.hasOwnProperty.call(StripeBilling.PERIODS, billingPeriod) && StripeBilling.PERIODS[billingPeriod];
        if (!period) {
            return res.status(400).json(errorResponse('Choose a billing period: monthly, quarterly or annual', 'INVALID_PERIOD'));
        }

        const stripe = StripeConfig.getStripeClient();
        const db = getPool();
        if (!stripe || !db) {
            return res.status(503).json(errorResponse('Payments are not available right now. Nothing was charged.', 'NOT_AVAILABLE'));
        }
        await StripeBilling.ensureSchema(db);

        const { rows: [plan] } = await db.query(
            `SELECT plan_code, plan_name, currency, price_monthly, price_quarterly, price_yearly
             FROM subscription_plans WHERE plan_code = $1 AND is_active = true`,
            [planCode]
        );
        if (!plan) {
            return res.status(404).json(errorResponse('Plan not found', 'NOT_FOUND'));
        }
        const amount = Number(plan[period.column]);
        if (plan.plan_code === 'FREE' || !(amount > 0)) {
            return res.status(400).json(errorResponse('This plan has no price for that billing period', 'NO_PRICE'));
        }

        // One paid plan at a time: a second checkout would start a second Stripe subscription and charge twice. A
        // cancelled paid plan that still runs is reactivated on the Account page instead.
        const { getUserSubscriptionStatus } = require('../middleware/subscription');
        const current = await getUserSubscriptionStatus(req.user.email);
        if (!current) {
            return res.status(503).json(errorResponse('Payments are not available right now. Nothing was charged.', 'NOT_AVAILABLE'));
        }
        if (current.isActive && (current.status === 'active' || Number(current.amount_paid) > 0)) {
            return res.status(409).json(errorResponse(
                'You already have a paid plan. A cancelled one can be reactivated on the Account page.', 'ALREADY_SUBSCRIBED'));
        }

        // A plan Stripe still tries to charge although its paid period ran out (its renewal payments failed) is ended
        // first, so the account never has two Stripe subscriptions charging it
        const { rows: lapsed } = await db.query(
            `SELECT stripe_subscription_id FROM user_subscriptions
             WHERE user_email = $1 AND status = 'active' AND left(stripe_subscription_id, 4) = 'sub_'
               AND COALESCE(end_date, subscription_end_date, NOW()) <= NOW()`,
            [req.user.email]
        );
        for (const { stripe_subscription_id: lapsedSubscription } of lapsed) {
            await StripeBilling.tellStripe(lapsedSubscription, 'end-now', { stripe });
        }

        const customer = await StripeBilling.customerFor(db, stripe, req.user.email);
        // Where Stripe sends the browser back: the service's public URL on Render, else this request's own origin (Render's
        // proxy says https in X-Forwarded-Proto; this app does not trust proxies, so req.protocol alone reads http)
        const protocol = String(req.get('x-forwarded-proto') || req.protocol).split(',')[0].trim();
        const origin = (process.env.RENDER_EXTERNAL_URL || `${protocol}://${req.get('host')}`).replace(/\/+$/, '');
        const planMetadata = { plan_code: plan.plan_code, billing_period: billingPeriod };
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer,
            line_items: [{
                quantity: 1,
                price_data: {
                    currency: String(plan.currency).toLowerCase(),
                    unit_amount: Math.round(amount * 100),
                    recurring: { interval: period.interval, interval_count: period.count },
                    product_data: { name: plan.plan_name }
                }
            }],
            // Both reach the webhook: the session's on checkout.session.completed, the subscription's on its invoices
            metadata: planMetadata,
            subscription_data: { metadata: planMetadata },
            // {CHECKOUT_SESSION_ID} is filled in by Stripe: the receipt page then knows the buyer came back from paying
            success_url: `${origin}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/checkout.html?plan=${encodeURIComponent(plan.plan_code)}&cancelled=1`
        });

        res.json(successResponse({ url: session.url }));
    } catch (error) {
        console.error('[STRIPE] The checkout could not start:', error.message);
        res.status(502).json(errorResponse('The payment page could not be opened. Nothing was charged.', 'CHECKOUT_FAILED'));
    }
});

/**
 * POST /api/stripe/webhook (mounted by server.js, before the JSON parser: req.body is the raw bytes)
 * 400 for a missing or wrong signature, 200 once the event is applied (or was already), 500 when it could not be
 * applied: nothing of it was written, and Stripe retries.
 */
async function webhook(req, res) {
    let event;
    try {
        event = StripeConfig.validateWebhookSignature(req.body, req.headers['stripe-signature']);
    } catch (error) {
        return res.status(400).json(errorResponse('Invalid Stripe signature', 'BAD_SIGNATURE'));
    }

    const db = getPool();
    if (!db) {
        return res.status(503).json(errorResponse('Database not available'));
    }

    let result;
    try {
        result = await StripeBilling.processEvent(db, event);
    } catch (error) {
        console.error(`[STRIPE] ${event.type} ${event.id} was not applied:`, error.message);
        return res.status(500).json(errorResponse('The event was not applied', 'EVENT_FAILED'));
    }

    console.log(`[STRIPE] ${event.type} ${event.id}: ${result.outcome}`);
    if (StripeBilling.OWNER_ALERT_OUTCOMES.includes(result.outcome)) {
        // Stripe took a payment that gives no access here: the owner checks it, and refunds or cancels it in Stripe
        const object = event.data.object;
        const OwnerAlerts = require('../lib/portfolio/close-failure-alerts');
        const safe = value => OwnerAlerts.markdownSafe(value);
        OwnerAlerts.notifyOwner(
            `Stripe took a payment that gives no access here (${safe(result.outcome)}). Event ${safe(event.id)}, customer ` +
            `${safe((object.customer && object.customer.id) || object.customer || 'unknown')}. Check it in the Stripe dashboard, and refund or cancel it there.`,
            { TradeDB, telegramBot: require('../lib/telegram/telegram-bot') }
        );
    }
    res.json({ received: true, duplicate: result.duplicate, outcome: result.outcome });
}

module.exports = router;
module.exports.webhook = webhook;
