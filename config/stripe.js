/**
 * Stripe configuration, and the paid checkout's one switch.
 *
 * The paid checkout (routes/stripe.js: the checkout routes, and the webhook that records what Stripe charged) is on
 * only when all three are set on Render:
 *   STRIPE_CHECKOUT=true     the switch itself; unset, or anything else, is off
 *   STRIPE_SECRET_KEY        sk_live_... (or sk_test_... to try it in Stripe's test mode)
 *   STRIPE_WEBHOOK_SECRET    whsec_... of the Stripe webhook endpoint https://<host>/api/stripe/webhook
 * Off (the default), server.js mounts nothing under /api/stripe and no Stripe code runs.
 */

const Stripe = require('stripe');

let stripeClient = null;

/** The switch and what it needs, as booleans and the key's mode: never a key. GET /api/ops/version shows it. */
function checkoutStatus() {
    const secretKey = process.env.STRIPE_SECRET_KEY || '';
    const status = {
        enabled: false,
        switchedOn: process.env.STRIPE_CHECKOUT === 'true',
        secretKey: secretKey !== '',
        webhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
        keyMode: /^(sk|rk)_live_/.test(secretKey) ? 'live' : /^(sk|rk)_test_/.test(secretKey) ? 'test' : secretKey ? 'unknown' : null
    };
    status.enabled = status.switchedOn && status.secretKey && status.webhookSecret;
    return status;
}

/** True when the paid checkout is on: the switch, and both Stripe secrets. */
function checkoutEnabled() {
    return checkoutStatus().enabled;
}

/** The Stripe API client, made on first use; null without STRIPE_SECRET_KEY. */
function getStripeClient() {
    if (!stripeClient && process.env.STRIPE_SECRET_KEY) {
        try {
            stripeClient = Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
        } catch (error) {
            console.error('✗ Failed to initialize Stripe:', error.message);
        }
    }
    return stripeClient;
}

/**
 * The event Stripe signed, or a throw. The signature is an HMAC of the raw request bytes with STRIPE_WEBHOOK_SECRET,
 * at most five minutes old (Stripe's default tolerance). No API key or network call is needed.
 */
function validateWebhookSignature(payload, signature) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        throw new Error('Stripe webhook secret not configured');
    }
    return Stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

module.exports = {
    checkoutStatus,
    checkoutEnabled,
    getStripeClient,
    validateWebhookSignature
};
