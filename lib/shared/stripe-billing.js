/**
 * Paid plans billed by Stripe: what each Stripe event does to the subscription tables, each event applied once, and
 * the calls that keep Stripe in step when a plan is cancelled, reactivated or deleted here.
 *
 * The paid checkout (routes/stripe.js) opens Stripe's own Checkout page for one plan and billing period. Stripe then
 * tells this server what happened (POST /api/stripe/webhook), and middleware/subscription.js decides access from the
 * account's newest subscription row that is not a checkout attempt, as it does for a free trial:
 *   checkout.session.completed, checkout.session.async_payment_succeeded
 *       the first payment went through: an 'active' row with the plan, its billing period, the amount per period and
 *       a first paid-up end (now + one period); one row per Stripe subscription
 *   invoice.paid
 *       a period was paid, the first one or a renewal: the paid-up end (subscription_end_date) moves to the end of
 *       the invoiced period, never back, and the payment is recorded. It makes the row itself when it arrives before
 *       the checkout event (Stripe does not promise an order). A payment for time after the plan was cancelled or
 *       ended gives no access back: routes/stripe.js tells the owner, as for a payment no account holds
 *   invoice.payment_failed
 *       recorded; access still ends where the last paid period ends, since only a paid invoice extends it
 *   customer.subscription.updated
 *       set to end at the period end: 'cancelled', with access until the paid-up end; renewing again: 'active';
 *       ended by Stripe: as customer.subscription.deleted
 *   customer.subscription.deleted
 *       ended: 'cancelled' with end_date = when it ended, so access stops then
 * Each event is one transaction that starts by recording its id in stripe_webhook_events: a repeat delivery (Stripe
 * retries until it gets a 2xx) changes nothing, and an event that fails is rolled back whole, its id included, so
 * Stripe's retry applies it again. Events for one Stripe subscription wait for each other (an advisory lock).
 *
 * No email address or card detail is stored or logged here: rows are found by the Stripe customer id
 * (users.stripe_customer_id, written by the checkout route) and the Stripe subscription id.
 */
'use strict';

// The billing periods the checkout sells: the plan column that prices each, Stripe's recurring interval, and the
// same length for Postgres (the first paid-up end, until the invoice says exactly)
const PERIODS = {
    monthly: { column: 'price_monthly', interval: 'month', count: 1, sql: '1 month' },
    quarterly: { column: 'price_quarterly', interval: 'month', count: 3, sql: '3 months' },
    annual: { column: 'price_yearly', interval: 'year', count: 1, sql: '1 year' }
};

// Outcomes where Stripe took money that gives no access: the owner hears about them (routes/stripe.js), to refund
const OWNER_ALERT_OUTCOMES = ['unknown-customer', 'second-paid-plan', 'paid-after-end'];
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------- reading Stripe objects (both API shapes)

const idOf = value => (value && typeof value === 'object' ? value.id : value) || null;
const toDate = seconds => (Number(seconds) > 0 ? new Date(Number(seconds) * 1000) : null);
// GBP, USD and INR are two-decimal currencies: Stripe counts pence, cents and paise
const amountOf = minor => Math.round(Number(minor) || 0) / 100;
const currencyOf = object => (object && object.currency ? String(object.currency).toUpperCase() : null);

/** A Stripe subscription id (sub_...); legacy checkout rows hold a PaymentIntent id (pi_...) instead. */
function isStripeSubscriptionId(id) {
    return typeof id === 'string' && id.startsWith('sub_');
}

/** The Stripe subscription behind a subscription row, when Stripe bills it; else null. */
function stripeSubscriptionOf(row) {
    return row && isStripeSubscriptionId(row.stripe_subscription_id) ? row.stripe_subscription_id : null;
}

/** The subscription an invoice bills: `invoice.subscription` before API 2025-03-31, `parent.subscription_details` since. */
function invoiceSubscriptionId(invoice) {
    const details = invoice.parent && invoice.parent.subscription_details;
    return idOf(invoice.subscription) || idOf(details && details.subscription) || null;
}

/** The metadata the checkout put on the subscription, as the invoice carries it (both API shapes). */
function invoiceSubscriptionMetadata(invoice) {
    const details = (invoice.parent && invoice.parent.subscription_details) || invoice.subscription_details;
    return (details && details.metadata) || {};
}

/**
 * The end of the period an invoice pays for: the latest end among its lines. (The invoice's own period_end is the
 * end of the period before, for a subscription invoice.)
 */
function invoicePeriodEnd(invoice) {
    const lines = (invoice.lines && invoice.lines.data) || [];
    const ends = lines.map(line => Number(line.period && line.period.end)).filter(end => end > 0);
    return ends.length ? toDate(Math.max(...ends)) : null;
}

/** A subscription's current period end: on the subscription before API 2025-03-31, on its items since. */
function subscriptionPeriodEnd(subscription) {
    if (Number(subscription.current_period_end) > 0) return toDate(subscription.current_period_end);
    const ends = ((subscription.items && subscription.items.data) || [])
        .map(item => Number(item.current_period_end)).filter(end => end > 0);
    return ends.length ? toDate(Math.max(...ends)) : null;
}

/**
 * What a subscription's state means for its row: 'active' (renews), 'cancelled' (ends at the period end), 'ended'
 * (Stripe ended it) or null (incomplete, unpaid, paused: no change, access follows the paid-up end).
 */
function subscriptionState(subscription) {
    if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') return 'ended';
    if (!['active', 'trialing', 'past_due'].includes(subscription.status)) return null;
    return subscription.cancel_at_period_end || subscription.cancel_at ? 'cancelled' : 'active';
}

// ---------------------------------------------------------------- schema

// Columns this module writes. The subscription ones come from migrations/003 and 012, the customer id from 011; a
// database built otherwise gets them here. Only missing columns are added, so a normal boot takes no table lock.
const COLUMNS = {
    users: { stripe_customer_id: 'VARCHAR(255)' },
    user_subscriptions: {
        plan_code: 'VARCHAR(20)', billing_period: 'VARCHAR(20)', amount_paid: 'DECIMAL(10, 2)', currency: 'VARCHAR(3)',
        subscription_start_date: 'TIMESTAMP', subscription_end_date: 'TIMESTAMP', end_date: 'TIMESTAMP',
        next_billing_date: 'TIMESTAMP', last_payment_date: 'TIMESTAMP', stripe_customer_id: 'VARCHAR(255)',
        stripe_subscription_id: 'VARCHAR(255)', auto_renew: 'BOOLEAN DEFAULT false', cancellation_date: 'TIMESTAMP',
        cancellation_reason: 'TEXT'
    }
};

const schemaReady = new WeakMap();

/** The tables and columns the paid checkout needs, once per pool (a failure is retried on the next call). */
function ensureSchema(pool) {
    if (!schemaReady.has(pool)) {
        const ready = (async () => {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS stripe_webhook_events (
                    event_id VARCHAR(255) PRIMARY KEY,
                    event_type VARCHAR(100) NOT NULL,
                    outcome VARCHAR(40),
                    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )`);
            const { rows } = await pool.query(
                `SELECT table_name, column_name FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = ANY($1)`, [Object.keys(COLUMNS)]);
            const present = new Set(rows.map(row => `${row.table_name}.${row.column_name}`));
            for (const [table, columns] of Object.entries(COLUMNS)) {
                for (const [column, type] of Object.entries(columns)) {
                    if (!present.has(`${table}.${column}`)) {
                        await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${type}`);
                    }
                }
            }
            await pool.query('CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users (stripe_customer_id)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_user_subs_stripe_sub ON user_subscriptions (stripe_subscription_id)');
        })();
        schemaReady.set(pool, ready);
        ready.catch(() => schemaReady.delete(pool));
    }
    return schemaReady.get(pool);
}

// ---------------------------------------------------------------- the rows

const ROW_COLUMNS = 'id, user_email, status, subscription_end_date, end_date';

async function lockSubscription(client, subscriptionId) {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['stripe-subscription:' + subscriptionId]);
}

async function rowFor(client, subscriptionId) {
    const { rows } = await client.query(
        `SELECT ${ROW_COLUMNS} FROM user_subscriptions WHERE stripe_subscription_id = $1 ORDER BY id DESC LIMIT 1`,
        [subscriptionId]);
    return rows[0] || null;
}

async function history(client, row, eventType, oldStatus, newStatus, description) {
    await client.query(`
        INSERT INTO subscription_history (subscription_id, user_email, event_type, old_status, new_status, description, triggered_by)
        VALUES ($1, $2, $3, $4, $5, $6, 'stripe')`,
    [row.id, row.user_email, eventType, oldStatus, newStatus, description]);
}

/**
 * The paid row of a Stripe subscription: the one already recorded, else a new 'active' row once an event proves a
 * payment. Returns { row, created }, or an outcome string when there is nothing to record.
 */
async function ensurePaidRow(client, { subscriptionId, customerId, planCode, billingPeriod, amount, currency, periodEnd }) {
    const existing = await rowFor(client, subscriptionId);
    if (existing) return { row: existing, created: false };

    // Only a subscription this app's checkout made carries its plan and billing period
    const period = PERIODS[billingPeriod];
    if (!planCode || !period) return 'not-a-checkout-plan';
    const { rows: [user] } = await client.query('SELECT email FROM users WHERE stripe_customer_id = $1 LIMIT 1', [customerId]);
    if (!user) return 'unknown-customer';
    const { rows: [plan] } = await client.query('SELECT plan_name FROM subscription_plans WHERE plan_code = $1', [planCode]);

    // One 'active' row per account (idx_user_subscriptions_one_active): a paid row whose period has run out is
    // expired first. One still running means a second paid plan: the checkout refuses that, so it is a race - the
    // owner is told, and the payment is for them to refund.
    await client.query(`
        UPDATE user_subscriptions SET status = 'expired', updated_at = NOW()
        WHERE user_email = $1 AND status = 'active' AND COALESCE(end_date, subscription_end_date, NOW()) <= NOW()`,
    [user.email]);
    const { rows: [running] } = await client.query(
        "SELECT id FROM user_subscriptions WHERE user_email = $1 AND status = 'active' LIMIT 1", [user.email]);
    if (running) {
        console.error(`[STRIPE] ${subscriptionId}: the account already has a running paid plan (row ${running.id})`);
        return 'second-paid-plan';
    }

    const { rows: [row] } = await client.query(`
        INSERT INTO user_subscriptions (user_email, plan_code, plan_name, billing_period, amount_paid, currency, status,
            stripe_customer_id, stripe_subscription_id, subscription_start_date, subscription_end_date, next_billing_date,
            auto_renew, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, NOW(),
            COALESCE($9::timestamptz, NOW() + $10::interval), COALESCE($9::timestamptz, NOW() + $10::interval),
            true, NOW(), NOW())
        RETURNING ${ROW_COLUMNS}`,
    [user.email, planCode, (plan && plan.plan_name) || planCode, billingPeriod, amount, currency,
        customerId, subscriptionId, periodEnd, period.sql]);
    await history(client, row, 'activated', null, 'active', `Paid plan started through Stripe (${billingPeriod})`);
    return { row, created: true };
}

// ---------------------------------------------------------------- the events

async function onCheckoutCompleted(client, session) {
    const subscriptionId = idOf(session.subscription);
    if (session.mode !== 'subscription' || !subscriptionId) return 'ignored';
    // An asynchronous payment method is not paid yet: checkout.session.async_payment_succeeded or invoice.paid follows
    if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') return 'awaiting-payment';
    await lockSubscription(client, subscriptionId);
    const metadata = session.metadata || {};
    const found = await ensurePaidRow(client, {
        subscriptionId,
        customerId: idOf(session.customer),
        planCode: metadata.plan_code,
        billingPeriod: metadata.billing_period,
        amount: amountOf(session.amount_total),
        currency: currencyOf(session),
        periodEnd: null
    });
    if (typeof found === 'string') return found;
    return found.created ? 'activated' : 'already-recorded';
}

async function onInvoicePaid(client, invoice) {
    const subscriptionId = invoiceSubscriptionId(invoice);
    if (!subscriptionId) return 'ignored';   // an invoice for no subscription
    const periodEnd = invoicePeriodEnd(invoice);
    if (!periodEnd) return 'no-period';
    await lockSubscription(client, subscriptionId);
    const metadata = invoiceSubscriptionMetadata(invoice);
    const found = await ensurePaidRow(client, {
        subscriptionId,
        customerId: idOf(invoice.customer),
        planCode: metadata.plan_code,
        billingPeriod: metadata.billing_period,
        amount: amountOf(invoice.amount_paid),
        currency: currencyOf(invoice),
        periodEnd
    });
    if (typeof found === 'string') return found;
    const { row, created } = found;
    const paidAt = toDate(invoice.status_transitions && invoice.status_transitions.paid_at);

    // The paid-up end only moves forward: a late or repeated invoice never shortens access. end_date is left alone:
    // on a Stripe row only a cancel writes it, and a cancelled or ended plan is not renewed by a payment.
    const { rows: [updated] } = await client.query(`
        UPDATE user_subscriptions
        SET subscription_end_date = GREATEST(COALESCE(subscription_end_date, $2::timestamptz), $2::timestamptz),
            next_billing_date = $2::timestamptz,
            last_payment_date = COALESCE($3::timestamptz, NOW()),
            updated_at = NOW()
        WHERE id = $1
        RETURNING ${ROW_COLUMNS}`,
    [row.id, periodEnd, paidAt]);
    if (!updated) return 'unknown-subscription';   // the row went meanwhile (its account was deleted)

    const amount = amountOf(invoice.amount_paid);
    if (amount > 0) {
        await client.query(`
            INSERT INTO payment_transactions (subscription_id, user_email, transaction_id, external_payment_id,
                payment_provider, amount, currency, status, payment_date, processed_at)
            SELECT $1::integer, $2::varchar, $3::varchar, $4::varchar, 'stripe', $5::numeric, $6::varchar, 'completed',
                COALESCE($7::timestamptz, NOW()), NOW()
            WHERE NOT EXISTS (SELECT 1 FROM payment_transactions WHERE transaction_id = $3::varchar)`,
        [row.id, row.user_email, invoice.id, idOf(invoice.payment_intent) || invoice.id, amount, currencyOf(invoice), paidAt]);
    }
    if (created) return 'activated';
    // Paid for time after a cancelled, ended or expired plan stops: the payment is recorded, but it gives no access back
    const stopped = updated.status !== 'active' && (updated.status !== 'cancelled'
        || (updated.end_date && periodEnd.getTime() > new Date(updated.end_date).getTime() + DAY_MS));
    if (stopped) return 'paid-after-end';
    // A renewal moved the paid-up end on; the first invoice, or one for an earlier period arriving late, did not
    const moved = !row.subscription_end_date || new Date(updated.subscription_end_date) > new Date(row.subscription_end_date);
    if (invoice.billing_reason !== 'subscription_cycle' || !moved) return 'paid';
    await history(client, updated, 'renewed', row.status, updated.status,
        `Renewal paid through ${new Date(updated.subscription_end_date).toISOString().slice(0, 10)} (Stripe)`);
    return 'renewed';
}

async function onInvoicePaymentFailed(client, invoice) {
    const subscriptionId = invoiceSubscriptionId(invoice);
    if (!subscriptionId) return 'ignored';
    await lockSubscription(client, subscriptionId);
    const row = await rowFor(client, subscriptionId);
    if (!row) return 'unknown-subscription';
    const attempt = Number(invoice.attempt_count) || 1;
    await client.query(`
        INSERT INTO payment_transactions (subscription_id, user_email, transaction_id, external_payment_id,
            payment_provider, amount, currency, status, payment_date, processed_at)
        SELECT $1::integer, $2::varchar, $3::varchar, $4::varchar, 'stripe', $5::numeric, $6::varchar, 'failed', NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM payment_transactions WHERE transaction_id = $3::varchar)`,
    [row.id, row.user_email, `${invoice.id}:attempt-${attempt}`, idOf(invoice.payment_intent) || invoice.id,
        amountOf(invoice.amount_due), currencyOf(invoice)]);
    await history(client, row, 'payment_failed', row.status, row.status,
        `Payment attempt ${attempt} failed; Stripe retries it, and access runs to the paid-up end`);
    return 'payment-failed';
}

async function onSubscriptionDeleted(client, subscription) {
    await lockSubscription(client, subscription.id);
    const row = await rowFor(client, subscription.id);
    if (!row) return 'unknown-subscription';
    const endedAt = toDate(subscription.ended_at) || toDate(subscription.canceled_at) || new Date();
    const { rows: [updated] } = await client.query(`
        UPDATE user_subscriptions
        SET status = 'cancelled',
            end_date = LEAST(COALESCE(end_date, $2::timestamptz), $2::timestamptz),
            cancellation_date = COALESCE(cancellation_date, $2::timestamptz),
            cancellation_reason = COALESCE(cancellation_reason, 'Ended in Stripe'),
            auto_renew = false,
            updated_at = NOW()
        WHERE id = $1
        RETURNING ${ROW_COLUMNS}`,
    [row.id, endedAt]);
    if (!updated) return 'unknown-subscription';   // the row went meanwhile (its account was deleted)
    await history(client, updated, row.status === 'cancelled' ? 'expired' : 'cancelled', row.status, 'cancelled', 'Ended in Stripe');
    return 'ended';
}

async function onSubscriptionUpdated(client, subscription) {
    const state = subscriptionState(subscription);
    if (state === 'ended') return onSubscriptionDeleted(client, subscription);
    if (!state) return 'no-change';
    await lockSubscription(client, subscription.id);
    const row = await rowFor(client, subscription.id);
    if (!row) return 'unknown-subscription';

    if (state === 'cancelled' && row.status === 'active') {
        // Ends at the paid-up date: the same rule as the Account page's cancel (routes/subscription.js)
        const { rows: [updated] } = await client.query(`
            UPDATE user_subscriptions
            SET status = 'cancelled',
                end_date = COALESCE(end_date, subscription_end_date, $2::timestamptz),
                cancellation_date = COALESCE(cancellation_date, NOW()),
                cancellation_reason = COALESCE(cancellation_reason, 'Cancelled in Stripe'),
                auto_renew = false,
                updated_at = NOW()
            WHERE id = $1 AND status = 'active'
            RETURNING ${ROW_COLUMNS}`,
        [row.id, subscriptionPeriodEnd(subscription)]);
        if (!updated) return 'no-change';
        await history(client, updated, 'cancelled', 'active', 'cancelled', 'Set to end at the paid-up date (Stripe)');
        return 'cancelled';
    }

    if (state === 'active' && row.status === 'cancelled' && !(row.end_date && new Date(row.end_date) <= new Date())) {
        // Renewing again: the paid-up end decides access again, as for any running paid row. Never a second
        // 'active' row for the account (idx_user_subscriptions_one_active).
        const { rows: [other] } = await client.query(
            "SELECT id FROM user_subscriptions WHERE user_email = $1 AND status = 'active' AND id <> $2 LIMIT 1",
            [row.user_email, row.id]);
        if (other) return 'second-paid-plan';
        const { rows: [updated] } = await client.query(`
            UPDATE user_subscriptions
            SET status = 'active', end_date = NULL, cancellation_date = NULL, cancellation_reason = NULL,
                auto_renew = true, updated_at = NOW()
            WHERE id = $1 AND status = 'cancelled'
            RETURNING ${ROW_COLUMNS}`,
        [row.id]);
        if (!updated) return 'no-change';
        await history(client, updated, 'reactivated', 'cancelled', 'active', 'Renewing again (Stripe)');
        return 'reactivated';
    }
    return 'no-change';
}

const HANDLERS = {
    'checkout.session.completed': onCheckoutCompleted,
    'checkout.session.async_payment_succeeded': onCheckoutCompleted,
    'invoice.paid': onInvoicePaid,
    'invoice.payment_failed': onInvoicePaymentFailed,
    'customer.subscription.updated': onSubscriptionUpdated,
    'customer.subscription.deleted': onSubscriptionDeleted
};

/** The event types the Stripe webhook endpoint must send (the owner picks them in the Stripe dashboard). */
const EVENT_TYPES = Object.keys(HANDLERS);

/**
 * Apply one verified Stripe event, once. Resolves { duplicate, outcome }; rejects when the event could not be
 * applied, and then nothing of it was written (Stripe retries it).
 */
async function processEvent(pool, event) {
    if (!event || typeof event.id !== 'string' || typeof event.type !== 'string' || !event.data || !event.data.object) {
        throw new Error('not a Stripe event');
    }
    await ensureSchema(pool);
    const client = await pool.connect();
    let releaseError;
    try {
        await client.query('BEGIN');
        const claimed = await client.query(
            `INSERT INTO stripe_webhook_events (event_id, event_type) VALUES ($1, $2)
             ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
            [event.id, event.type]);
        if (claimed.rows.length === 0) {
            await client.query('ROLLBACK');
            return { duplicate: true, outcome: 'duplicate' };
        }
        const handler = HANDLERS[event.type];
        const outcome = handler ? await handler(client, event.data.object) : 'ignored';
        await client.query('UPDATE stripe_webhook_events SET outcome = $2 WHERE event_id = $1', [event.id, outcome]);
        await client.query('COMMIT');
        return { duplicate: false, outcome };
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            releaseError = rollbackError;   // a broken connection must not go back to the pool
        }
        throw error;
    } finally {
        client.release(releaseError);
    }
}

// ---------------------------------------------------------------- the checkout's customer

/**
 * The Stripe customer of a signed-in account: the stored one, else a new one (with the account's email, which
 * Stripe needs for receipts) stored in users.stripe_customer_id. The webhook finds the account by this id.
 */
async function customerFor(pool, stripe, email) {
    const { rows: [user] } = await pool.query('SELECT stripe_customer_id FROM users WHERE email = $1', [email]);
    if (!user) throw new Error('the signed-in account has no users row');
    if (user.stripe_customer_id) return user.stripe_customer_id;
    const customer = await stripe.customers.create({ email });
    // The first stored customer wins: a second checkout racing this one reuses it
    const { rows: [kept] } = await pool.query(
        'UPDATE users SET stripe_customer_id = COALESCE(stripe_customer_id, $1) WHERE email = $2 RETURNING stripe_customer_id',
        [customer.id, email]);
    return kept ? kept.stripe_customer_id : customer.id;
}

// ---------------------------------------------------------------- keeping Stripe in step

/**
 * Tell Stripe before a row changes here. 'stop-renewal': the plan ends at its paid-up date (the Account page's
 * cancel); 'renew': it renews again (reactivate); 'end-now': it ends at once (the admin's cancel, account deletion).
 * A subscription Stripe has already ended counts as done, except for 'renew'. Rejects with code 'PAYMENT_PROVIDER'
 * when Stripe cannot be told: the caller then changes nothing, so the app never shows a cancel while Stripe goes on
 * charging the card.
 */
async function tellStripe(subscriptionId, change, { stripe } = {}) {
    const client = stripe || require('../../config/stripe').getStripeClient();
    const fail = (message, cause) => Object.assign(new Error('Stripe was not told: ' + message), { code: 'PAYMENT_PROVIDER', cause });
    if (!client) throw fail('STRIPE_SECRET_KEY is not set');
    try {
        let current;
        try {
            current = await client.subscriptions.retrieve(subscriptionId);
        } catch (error) {
            if (error && error.code === 'resource_missing' && change !== 'renew') return 'gone';
            throw error;
        }
        if (current.status === 'canceled' || current.status === 'incomplete_expired') {
            if (change === 'renew') throw fail('the subscription has already ended in Stripe');
            return 'already-ended';
        }
        if (change === 'end-now') {
            await client.subscriptions.cancel(subscriptionId);
            return 'ended';
        }
        await client.subscriptions.update(subscriptionId, { cancel_at_period_end: change === 'stop-renewal' });
        return change === 'stop-renewal' ? 'stops-renewing' : 'renews';
    } catch (error) {
        throw error && error.code === 'PAYMENT_PROVIDER' ? error : fail((error && error.message) || String(error), error);
    }
}

/** The Stripe subscription behind subscription row `rowId`, when Stripe bills it; else null. */
async function stripeSubscriptionFor(pool, rowId) {
    if (!/^\d+$/.test(String(rowId))) return null;
    const { rows } = await pool.query('SELECT stripe_subscription_id FROM user_subscriptions WHERE id = $1', [rowId]);
    return stripeSubscriptionOf(rows[0]);
}

/**
 * Tell Stripe about a change to subscription row `rowId` when Stripe bills it (see tellStripe); a row Stripe does not
 * bill resolves null and nothing is called.
 */
async function syncStripeForRow(pool, rowId, change, options = {}) {
    const subscriptionId = await stripeSubscriptionFor(pool, rowId);
    return subscriptionId ? tellStripe(subscriptionId, change, options) : null;
}

module.exports = {
    PERIODS,
    EVENT_TYPES,
    OWNER_ALERT_OUTCOMES,
    isStripeSubscriptionId,
    stripeSubscriptionOf,
    invoiceSubscriptionId,
    invoiceSubscriptionMetadata,
    invoicePeriodEnd,
    subscriptionPeriodEnd,
    subscriptionState,
    ensureSchema,
    processEvent,
    customerFor,
    tellStripe,
    stripeSubscriptionFor,
    syncStripeForRow
};
