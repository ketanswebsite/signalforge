/**
 * Stripe Payment Routes
 * Handles payment processing, subscriptions, and webhooks
 */

const express = require('express');
const router = express.Router();
const TradeDB = require('../database-postgres');
const { getStripeClient, getPublishableKey, isStripeConfigured, validateWebhookSignature } = require('../config/stripe');

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
 * Get Stripe publishable key for frontend initialization
 */
router.get('/config', (req, res) => {
    if (!isStripeConfigured()) {
        return res.status(503).json(errorResponse('Payment system not configured', 'NOT_CONFIGURED'));
    }

    const publishableKey = getPublishableKey();
    if (!publishableKey) {
        return res.status(500).json(errorResponse('Stripe configuration error'));
    }

    res.json(successResponse({ publishableKey }));
});

/**
 * POST /api/stripe/create-subscription
 * Create a new subscription with payment intent
 * Requires authentication
 */
router.post('/create-subscription', ensureAuthenticated, async (req, res) => {
    try {
        const { planCode, billingPeriod, discountCode } = req.body;
        const userEmail = req.user.email;
        const stripe = getStripeClient();
        const db = getPool();

        if (!stripe) {
            return res.status(503).json(errorResponse('Payment system not available'));
        }

        if (!db) {
            return res.status(500).json(errorResponse('Database not available'));
        }

        // Get plan details
        const planResult = await db.query(
            'SELECT * FROM subscription_plans WHERE plan_code = $1 AND is_active = true',
            [planCode]
        );

        if (planResult.rows.length === 0) {
            return res.status(404).json(errorResponse('Plan not found', 'NOT_FOUND'));
        }

        const plan = planResult.rows[0];
        const isFree = plan.plan_code === 'FREE';

        // Handle free trial without payment
        if (isFree) {
            return res.status(400).json(errorResponse('The free plan starts with POST /api/user/subscription/start-trial'));
        }

        // Calculate amount based on billing period
        let amount = 0;
        switch (billingPeriod) {
            case 'monthly':
                amount = parseFloat(plan.price_monthly) || 0;
                break;
            case 'quarterly':
                amount = parseFloat(plan.price_quarterly) || 0;
                break;
            case 'annual':
                amount = parseFloat(plan.price_yearly) || 0;
                break;
            default:
                return res.status(400).json(errorResponse('Invalid billing period'));
        }

        if (amount <= 0) {
            return res.status(400).json(errorResponse('Invalid plan pricing'));
        }

        // Apply discount if provided
        let discountAmount = 0;
        if (discountCode) {
            // TODO: Implement discount code validation
            // For now, we'll skip this
        }

        const finalAmount = Math.max(0, amount - discountAmount);

        // Create or get Stripe customer
        let stripeCustomerId = null;
        const customerResult = await db.query(
            'SELECT stripe_customer_id FROM users WHERE email = $1',
            [userEmail]
        );

        if (customerResult.rows.length > 0 && customerResult.rows[0].stripe_customer_id) {
            stripeCustomerId = customerResult.rows[0].stripe_customer_id;
        } else {
            // Create new Stripe customer
            const customer = await stripe.customers.create({
                email: userEmail,
                metadata: {
                    plan_code: planCode,
                    billing_period: billingPeriod
                }
            });
            stripeCustomerId = customer.id;

            // Save customer ID to database
            await db.query(
                'UPDATE users SET stripe_customer_id = $1, updated_at = NOW() WHERE email = $2',
                [stripeCustomerId, userEmail]
            );
        }

        // Create payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(finalAmount * 100), // Convert to cents
            currency: plan.currency.toLowerCase(),
            customer: stripeCustomerId,
            metadata: {
                plan_code: planCode,
                billing_period: billingPeriod,
                user_email: userEmail,
                discount_code: discountCode || ''
            },
            description: `${plan.plan_name} - ${billingPeriod}`
        });

        // Create subscription record in database (status: pending)
        const subResult = await db.query(`
            INSERT INTO user_subscriptions (
                user_email,
                plan_code,
                plan_name,
                billing_period,
                amount_paid,
                currency,
                status,
                stripe_customer_id,
                stripe_subscription_id,
                subscription_start_date,
                subscription_end_date,
                next_billing_date,
                auto_renew,
                created_at,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW() + INTERVAL '1 ${billingPeriod === 'annual' ? 'year' : billingPeriod === 'quarterly' ? '3 months' : 'month'}', NOW() + INTERVAL '1 ${billingPeriod === 'annual' ? 'year' : billingPeriod === 'quarterly' ? '3 months' : 'month'}', true, NOW(), NOW())
            RETURNING id
        `, [
            userEmail,
            planCode,
            plan.plan_name,
            billingPeriod,
            finalAmount,
            plan.currency,
            'pending',
            stripeCustomerId,
            paymentIntent.id,
        ]);

        const subscriptionId = subResult.rows[0].id;

        // Log to subscription history
        await db.query(`
            INSERT INTO subscription_history (subscription_id, user_email, event_type, new_status, description)
            VALUES ($1, $2, 'created', 'pending', 'Subscription created, awaiting payment')
        `, [subscriptionId, userEmail]);

        res.json(successResponse({
            clientSecret: paymentIntent.client_secret,
            subscriptionId: subscriptionId,
            amount: finalAmount,
            currency: plan.currency
        }));

    } catch (error) {
        console.error('Error creating subscription:', error);
        res.status(500).json(errorResponse('Failed to create subscription'));
    }
});

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhook events
 * No authentication required (validated by Stripe signature)
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const signature = req.headers['stripe-signature'];

        if (!signature) {
            return res.status(400).json(errorResponse('Missing Stripe signature'));
        }

        // Validate webhook signature
        const event = validateWebhookSignature(req.body, signature);

        console.log('Stripe webhook received:', event.type);

        const db = getPool();
        if (!db) {
            console.error('Database not available for webhook processing');
            return res.status(500).json(errorResponse('Database not available'));
        }

        // Handle different webhook events
        switch (event.type) {
            case 'payment_intent.succeeded':
                await handlePaymentSucceeded(event.data.object, db);
                break;

            case 'payment_intent.payment_failed':
                await handlePaymentFailed(event.data.object, db);
                break;

            case 'customer.subscription.created':
                await handleSubscriptionCreated(event.data.object, db);
                break;

            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object, db);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object, db);
                break;

            case 'invoice.payment_succeeded':
                await handleInvoicePaymentSucceeded(event.data.object, db);
                break;

            case 'invoice.payment_failed':
                await handleInvoicePaymentFailed(event.data.object, db);
                break;

            default:
                console.log('Unhandled webhook event type:', event.type);
        }

        res.json({ received: true });

    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(400).json(errorResponse('Webhook processing failed'));
    }
});

// Webhook handlers
async function handlePaymentSucceeded(paymentIntent, db) {
    try {
        const userEmail = paymentIntent.metadata.user_email;
        const planCode = paymentIntent.metadata.plan_code;
        const billingPeriod = paymentIntent.metadata.billing_period;

        // Update subscription status to active
        await db.query(`
            UPDATE user_subscriptions
            SET status = 'active', stripe_payment_intent_id = $1, updated_at = NOW()
            WHERE user_email = $2 AND stripe_subscription_id = $3 AND status = 'pending'
        `, [paymentIntent.id, userEmail, paymentIntent.id]);

        // Log payment transaction
        await db.query(`
            INSERT INTO payment_transactions (
                user_email,
                subscription_id,
                transaction_id,
                external_payment_id,
                payment_provider,
                amount,
                currency,
                status,
                payment_date
            )
            SELECT $1, id, $2, $3, 'stripe', $4, $5, 'completed', NOW()
            FROM user_subscriptions
            WHERE user_email = $1 AND stripe_subscription_id = $3
            LIMIT 1
        `, [
            userEmail,
            `PI_${Date.now()}`,
            paymentIntent.id,
            paymentIntent.amount / 100,
            paymentIntent.currency.toUpperCase()
        ]);

        console.log('Payment succeeded for user:', userEmail);

    } catch (error) {
        console.error('Error handling payment success:', error);
    }
}

async function handlePaymentFailed(paymentIntent, db) {
    try {
        const userEmail = paymentIntent.metadata.user_email;

        // Update subscription status to payment_failed
        await db.query(`
            UPDATE user_subscriptions
            SET status = 'payment_failed', updated_at = NOW()
            WHERE user_email = $1 AND stripe_subscription_id = $2
        `, [userEmail, paymentIntent.id]);

        // Log failed payment
        await db.query(`
            INSERT INTO payment_transactions (
                user_email,
                subscription_id,
                transaction_id,
                external_payment_id,
                payment_provider,
                amount,
                currency,
                status,
                payment_date
            )
            SELECT $1, id, $2, $3, 'stripe', $4, $5, 'failed', NOW()
            FROM user_subscriptions
            WHERE user_email = $1 AND stripe_subscription_id = $3
            LIMIT 1
        `, [
            userEmail,
            `PI_FAILED_${Date.now()}`,
            paymentIntent.id,
            paymentIntent.amount / 100,
            paymentIntent.currency.toUpperCase()
        ]);

        console.log('Payment failed for user:', userEmail);

    } catch (error) {
        console.error('Error handling payment failure:', error);
    }
}

async function handleSubscriptionCreated(subscription, db) {
    // Handle Stripe subscription creation if needed
    console.log('Subscription created:', subscription.id);
}

async function handleSubscriptionUpdated(subscription, db) {
    // Handle Stripe subscription updates
    console.log('Subscription updated:', subscription.id);
}

async function handleSubscriptionDeleted(subscription, db) {
    try {
        // Mark subscription as cancelled in database
        await db.query(`
            UPDATE user_subscriptions
            SET status = 'cancelled', cancellation_date = NOW(), updated_at = NOW()
            WHERE stripe_subscription_id = $1
        `, [subscription.id]);

        console.log('Subscription deleted:', subscription.id);

    } catch (error) {
        console.error('Error handling subscription deletion:', error);
    }
}

async function handleInvoicePaymentSucceeded(invoice, db) {
    // Handle successful invoice payment (for recurring subscriptions)
    console.log('Invoice payment succeeded:', invoice.id);
}

async function handleInvoicePaymentFailed(invoice, db) {
    // Handle failed invoice payment
    console.log('Invoice payment failed:', invoice.id);
}

module.exports = router;
