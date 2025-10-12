/**
 * Stripe Configuration
 * Handles Stripe API initialization and configuration
 */

const stripe = require('stripe');

let stripeClient = null;

/**
 * Initialize Stripe with API keys from environment
 */
function initializeStripe() {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
        console.warn('⚠️  STRIPE_SECRET_KEY not configured. Payment processing will be disabled.');
        return null;
    }

    if (!stripeClient) {
        try {
            stripeClient = stripe(secretKey, {
                apiVersion: '2023-10-16',
                typescript: false
            });
            console.log('✓ Stripe client initialized successfully');
        } catch (error) {
            console.error('✗ Failed to initialize Stripe:', error.message);
            return null;
        }
    }

    return stripeClient;
}

/**
 * Get Stripe client instance
 */
function getStripeClient() {
    if (!stripeClient) {
        return initializeStripe();
    }
    return stripeClient;
}

/**
 * Get Stripe publishable key for frontend
 */
function getPublishableKey() {
    return process.env.STRIPE_PUBLISHABLE_KEY || null;
}

/**
 * Get Stripe webhook secret
 */
function getWebhookSecret() {
    return process.env.STRIPE_WEBHOOK_SECRET || null;
}

/**
 * Check if Stripe is properly configured
 */
function isStripeConfigured() {
    return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY);
}

/**
 * Validate Stripe webhook signature
 */
function validateWebhookSignature(payload, signature) {
    const webhookSecret = getWebhookSecret();

    if (!webhookSecret) {
        throw new Error('Stripe webhook secret not configured');
    }

    const client = getStripeClient();
    if (!client) {
        throw new Error('Stripe client not initialized');
    }

    try {
        const event = client.webhooks.constructEvent(
            payload,
            signature,
            webhookSecret
        );
        return event;
    } catch (error) {
        console.error('Webhook signature verification failed:', error.message);
        throw error;
    }
}

module.exports = {
    initializeStripe,
    getStripeClient,
    getPublishableKey,
    getWebhookSecret,
    isStripeConfigured,
    validateWebhookSignature
};
