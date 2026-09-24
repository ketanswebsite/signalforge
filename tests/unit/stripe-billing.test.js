/**
 * @jest-environment node
 *
 * The paid checkout's mechanics: the one switch (config/stripe.js), the webhook signature, and what each Stripe
 * event does to the subscription tables (lib/shared/stripe-billing.js). Until 2026-09-24 the webhook sat behind the
 * sign-in gate and after the JSON parser (Stripe got 401, and the signature could never verify), a renewal never
 * moved the paid period on (the invoice and subscription-update handlers only logged), and nothing stopped one
 * event being applied twice. The database is a script here, so what is pinned is the decision logic and the SQL
 * each event sends; tests/endpoints/stripe-webhook.test.js runs the same events against Postgres.
 */
const http = require('http');
const express = require('express');
const Stripe = require('stripe');

// routes/stripe.js and middleware/subscription.js use the app's one pool, mocked here; the event handlers get a
// scripted pool of their own (fakeDb)
const mockQuery = jest.fn();
jest.mock('../../database-postgres', () => ({ pool: { query: (...args) => mockQuery(...args) } }));

const StripeConfig = require('../../config/stripe');
const Billing = require('../../lib/shared/stripe-billing');

const ENV = ['STRIPE_CHECKOUT', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'];
const envAtStart = Object.fromEntries(ENV.map(k => [k, process.env[k]]));
beforeEach(() => {
    for (const k of ENV) delete process.env[k];
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
    for (const k of ENV) {
        if (envAtStart[k] === undefined) delete process.env[k]; else process.env[k] = envAtStart[k];
    }
});

const DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);

/** A pool whose one client records every statement and answers from `answers`: [[pattern, rows or fn], ...] */
function fakeDb(answers = [], { claimed = true } = {}) {
    const statements = [];
    const client = {
        released: [],
        async query(sql, params = []) {
            const text = sql.replace(/\s+/g, ' ').trim();
            statements.push({ text, params });
            for (const [pattern, answer] of answers) {
                if (pattern.test(text)) {
                    const out = typeof answer === 'function' ? answer(text, params) : answer;
                    if (out instanceof Error) throw out;
                    return { rows: out, rowCount: out.length };
                }
            }
            if (/^INSERT INTO stripe_webhook_events/.test(text)) return { rows: claimed ? [{ event_id: params[0] }] : [], rowCount: claimed ? 1 : 0 };
            return { rows: [], rowCount: 0 };
        },
        release(error) { this.released.push(error); }
    };
    // ensureSchema reads the columns through the pool: all present, so it adds none
    const pool = {
        query: (sql, params) => (/information_schema\.columns/.test(sql)
            ? Promise.resolve({ rows: allColumns() })
            : client.query(sql, params)),
        connect: async () => client
    };
    // what the event did, from BEGIN on (ensureSchema's statements are its own test's)
    const sent = () => statements.slice(statements.findIndex(s => s.text === 'BEGIN'));
    const texts = () => sent().map(s => s.text);
    const find = prefix => sent().find(s => s.text.startsWith(prefix));
    return { statements, client, pool, sent, texts, find };
}
const allColumns = () => [
    ['users', 'stripe_customer_id'],
    ...['plan_code', 'billing_period', 'amount_paid', 'currency', 'subscription_start_date', 'subscription_end_date', 'end_date',
        'next_billing_date', 'last_payment_date', 'stripe_customer_id', 'stripe_subscription_id', 'auto_renew',
        'cancellation_date', 'cancellation_reason'].map(c => ['user_subscriptions', c])
].map(([table_name, column_name]) => ({ table_name, column_name }));

const eventOf = (type, object, id = 'evt_unit_1') => ({ id, object: 'event', type, data: { object } });
const metadata = { plan_code: 'BASIC_UK', billing_period: 'quarterly' };
const session = (over = {}) => ({
    id: 'cs_unit', object: 'checkout.session', mode: 'subscription', payment_status: 'paid', customer: 'cus_unit',
    subscription: 'sub_unit', amount_total: 2697, currency: 'gbp', metadata, ...over
});
const clover = (id, periodEnd, over = {}) => ({
    id, object: 'invoice', customer: 'cus_unit', billing_reason: 'subscription_cycle', amount_paid: 2697, amount_due: 2697,
    currency: 'gbp', attempt_count: 1, status_transitions: { paid_at: now() },
    parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_unit', metadata } },
    lines: { data: [{ period: { start: now(), end: periodEnd - DAY } }, { period: { start: now(), end: periodEnd } }] }, ...over
});
const subscription = (over = {}) => ({
    id: 'sub_unit', object: 'subscription', customer: 'cus_unit', status: 'active', cancel_at_period_end: false,
    cancel_at: null, ended_at: null, canceled_at: null, items: { data: [{ current_period_end: now() + 90 * DAY }] }, ...over
});

// the answers of a database where the account (cus_unit) exists, with or without the Stripe row
const ROW = { id: 42, user_email: 'buyer@e2e.invalid', status: 'active', subscription_end_date: new Date(), end_date: null };
const account = [/^SELECT email FROM users WHERE stripe_customer_id = \$1/, [{ email: 'buyer@e2e.invalid' }]];
const plan = [/^SELECT plan_name FROM subscription_plans/, [{ plan_name: 'Trader - UK' }]];
const rowFound = (row = ROW) => [/^SELECT id, user_email, status, subscription_end_date, end_date FROM user_subscriptions WHERE stripe_subscription_id/, [row]];
const inserted = [/^INSERT INTO user_subscriptions/, [{ ...ROW }]];
const updatedTo = over => [/^UPDATE user_subscriptions SET subscription_end_date|^UPDATE user_subscriptions SET status/, (text) => [{ ...ROW, ...over(text) }]];

describe('config/stripe.js: the paid checkout has one switch, off by default', () => {
    test('nothing set: off, and every part reads false', () => {
        expect(StripeConfig.checkoutStatus()).toEqual({ enabled: false, switchedOn: false, secretKey: false, webhookSecret: false, keyMode: null });
        expect(StripeConfig.checkoutEnabled()).toBe(false);
    });

    test('on only with STRIPE_CHECKOUT=true and both secrets', () => {
        const all = { STRIPE_CHECKOUT: 'true', STRIPE_SECRET_KEY: 'sk_test_unit', STRIPE_WEBHOOK_SECRET: 'whsec_unit' };
        for (const missing of ENV) {
            for (const k of ENV) process.env[k] = all[k];
            delete process.env[missing];
            expect(StripeConfig.checkoutEnabled()).toBe(false);
        }
        for (const k of ENV) process.env[k] = all[k];
        expect(StripeConfig.checkoutEnabled()).toBe(true);
        for (const notTrue of ['1', 'TRUE', 'yes', 'on']) {
            process.env.STRIPE_CHECKOUT = notTrue;
            expect(StripeConfig.checkoutEnabled()).toBe(false);
        }
    });

    test('the status says the key mode and never holds a key', () => {
        process.env.STRIPE_CHECKOUT = 'true';
        process.env.STRIPE_WEBHOOK_SECRET = 'whsec_unit_secret_value';
        for (const [key, mode] of [['sk_test_unit_key', 'test'], ['sk_live_unit_key', 'live'], ['rk_live_unit_key', 'live'], ['odd_unit_key', 'unknown']]) {
            process.env.STRIPE_SECRET_KEY = key;
            const status = StripeConfig.checkoutStatus();
            expect(status.keyMode).toBe(mode);
            expect(JSON.stringify(status)).not.toMatch(/unit_key|unit_secret/);
        }
    });
});

describe('the webhook signature', () => {
    const payload = JSON.stringify(eventOf('invoice.paid', { id: 'in_unit' }));
    const sign = (secret, extra = {}) => Stripe.webhooks.generateTestHeaderString({ payload, secret, ...extra });

    test('an event signed with STRIPE_WEBHOOK_SECRET over the raw bytes is accepted, string or Buffer', () => {
        process.env.STRIPE_WEBHOOK_SECRET = 'whsec_unit';
        expect(StripeConfig.validateWebhookSignature(payload, sign('whsec_unit')).id).toBe('evt_unit_1');
        expect(StripeConfig.validateWebhookSignature(Buffer.from(payload), sign('whsec_unit')).type).toBe('invoice.paid');
    });

    test('altered bytes, another secret, no header, an old signature or no secret: refused', () => {
        process.env.STRIPE_WEBHOOK_SECRET = 'whsec_unit';
        expect(() => StripeConfig.validateWebhookSignature(payload.replace('in_unit', 'in_other'), sign('whsec_unit'))).toThrow();
        expect(() => StripeConfig.validateWebhookSignature(payload, sign('whsec_other'))).toThrow();
        expect(() => StripeConfig.validateWebhookSignature(payload, undefined)).toThrow();
        expect(() => StripeConfig.validateWebhookSignature(payload, sign('whsec_unit', { timestamp: now() - 600 }))).toThrow();
        // a body some JSON parser already turned into an object can never verify
        expect(() => StripeConfig.validateWebhookSignature(JSON.parse(payload), sign('whsec_unit'))).toThrow();
        delete process.env.STRIPE_WEBHOOK_SECRET;
        expect(() => StripeConfig.validateWebhookSignature(payload, sign('whsec_unit'))).toThrow(/not configured/);
    });
});

describe('reading Stripe objects, in both API shapes', () => {
    test('the subscription an invoice bills, and the metadata the checkout gave it', () => {
        expect(Billing.invoiceSubscriptionId({ subscription: 'sub_a' })).toBe('sub_a');
        expect(Billing.invoiceSubscriptionId({ subscription: { id: 'sub_b' } })).toBe('sub_b');
        expect(Billing.invoiceSubscriptionId({ parent: { subscription_details: { subscription: 'sub_c' } } })).toBe('sub_c');
        expect(Billing.invoiceSubscriptionId({ parent: null })).toBeNull();
        expect(Billing.invoiceSubscriptionMetadata({ subscription_details: { metadata } })).toEqual(metadata);
        expect(Billing.invoiceSubscriptionMetadata({ parent: { subscription_details: { metadata } } })).toEqual(metadata);
        expect(Billing.invoiceSubscriptionMetadata({})).toEqual({});
    });

    test('the period an invoice pays for ends at its latest line (not at the invoice\'s own period_end)', () => {
        const end = now() + 30 * DAY;
        expect(Billing.invoicePeriodEnd({ period_end: now(), lines: { data: [{ period: { end: end - DAY } }, { period: { end } }] } }))
            .toEqual(new Date(end * 1000));
        expect(Billing.invoicePeriodEnd({ lines: { data: [] } })).toBeNull();
    });

    test('a subscription\'s period end: on the subscription before 2025-03-31, on its items since', () => {
        const end = now() + 10 * DAY;
        expect(Billing.subscriptionPeriodEnd({ current_period_end: end })).toEqual(new Date(end * 1000));
        expect(Billing.subscriptionPeriodEnd({ items: { data: [{ current_period_end: end }] } })).toEqual(new Date(end * 1000));
        expect(Billing.subscriptionPeriodEnd({ items: { data: [] } })).toBeNull();
    });

    test('what a subscription\'s state means for its row', () => {
        expect(Billing.subscriptionState({ status: 'active' })).toBe('active');
        expect(Billing.subscriptionState({ status: 'past_due' })).toBe('active');
        expect(Billing.subscriptionState({ status: 'active', cancel_at_period_end: true })).toBe('cancelled');
        expect(Billing.subscriptionState({ status: 'trialing', cancel_at: now() + DAY })).toBe('cancelled');
        expect(Billing.subscriptionState({ status: 'canceled' })).toBe('ended');
        expect(Billing.subscriptionState({ status: 'incomplete_expired' })).toBe('ended');
        for (const status of ['incomplete', 'unpaid', 'paused']) expect(Billing.subscriptionState({ status })).toBeNull();
    });

    test('only a Stripe subscription id counts as billed by Stripe: a legacy checkout row holds a PaymentIntent id', () => {
        expect(Billing.stripeSubscriptionOf({ stripe_subscription_id: 'sub_a' })).toBe('sub_a');
        expect(Billing.stripeSubscriptionOf({ stripe_subscription_id: 'pi_a' })).toBeNull();
        expect(Billing.stripeSubscriptionOf({ stripe_subscription_id: null })).toBeNull();
        expect(Billing.stripeSubscriptionOf(undefined)).toBeNull();
    });
});

describe('processEvent: each event once, in one transaction', () => {
    test('not an event: refused before the database is touched', async () => {
        const db = fakeDb();
        await expect(Billing.processEvent(db.pool, { id: 'evt_x' })).rejects.toThrow(/not a Stripe event/);
        expect(db.statements).toEqual([]);
    });

    test('a repeat delivery (its id already recorded) changes nothing', async () => {
        const db = fakeDb([], { claimed: false });
        await expect(Billing.processEvent(db.pool, eventOf('checkout.session.completed', session())))
            .resolves.toEqual({ duplicate: true, outcome: 'duplicate' });
        expect(db.texts()).toEqual(['BEGIN',
            'INSERT INTO stripe_webhook_events (event_id, event_type) VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING RETURNING event_id',
            'ROLLBACK']);
        expect(db.client.released).toEqual([undefined]);
    });

    test('an event type it does not handle is recorded as ignored', async () => {
        const db = fakeDb();
        await expect(Billing.processEvent(db.pool, eventOf('charge.succeeded', { id: 'ch_unit' })))
            .resolves.toEqual({ duplicate: false, outcome: 'ignored' });
        expect(db.find('UPDATE stripe_webhook_events').params).toEqual(['evt_unit_1', 'ignored']);
        expect(db.texts().pop()).toBe('COMMIT');
    });

    test('an event that fails is rolled back whole, its id included, so Stripe\'s retry applies it again', async () => {
        const db = fakeDb([[/^SELECT id, user_email/, new Error('connection lost')]]);
        await expect(Billing.processEvent(db.pool, eventOf('customer.subscription.deleted', subscription()))).rejects.toThrow('connection lost');
        expect(db.texts().pop()).toBe('ROLLBACK');
        expect(db.texts()).not.toContain('COMMIT');
        expect(db.client.released).toEqual([undefined]);
    });

    test('a connection that breaks on ROLLBACK is not handed back to the pool', async () => {
        const broken = new Error('socket closed');
        const db = fakeDb([[/^SELECT id, user_email/, new Error('first')], [/^ROLLBACK$/, broken]]);
        await expect(Billing.processEvent(db.pool, eventOf('customer.subscription.deleted', subscription()))).rejects.toThrow('first');
        expect(db.client.released).toEqual([broken]);
    });

    test('every event about a subscription waits for the others about it (an advisory lock)', async () => {
        const db = fakeDb([rowFound(), updatedTo(() => ({ status: 'cancelled' }))]);
        await Billing.processEvent(db.pool, eventOf('customer.subscription.deleted', subscription()));
        expect(db.find('SELECT pg_advisory_xact_lock').params).toEqual(['stripe-subscription:sub_unit']);
        expect(db.texts().indexOf('SELECT pg_advisory_xact_lock(hashtext($1))'))
            .toBeLessThan(db.texts().findIndex(t => t.startsWith('SELECT id, user_email')));
    });

    test('the event types the webhook endpoint must send', () => {
        expect(Billing.EVENT_TYPES.sort()).toEqual(['checkout.session.async_payment_succeeded', 'checkout.session.completed',
            'customer.subscription.deleted', 'customer.subscription.updated', 'invoice.paid', 'invoice.payment_failed']);
    });
});

describe('checkout.session.completed: the plan with its billing period', () => {
    test('paid: one active row with the plan, the billing period, the amount per period and a first paid-up end', async () => {
        const db = fakeDb([account, plan, inserted]);
        const result = await Billing.processEvent(db.pool, eventOf('checkout.session.completed', session()));
        expect(result).toEqual({ duplicate: false, outcome: 'activated' });
        const insert = db.find('INSERT INTO user_subscriptions');
        expect(insert.text).toMatch(/VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, 'active', \$7, \$8, NOW\(\), COALESCE\(\$9::timestamptz, NOW\(\) \+ \$10::interval\)/);
        expect(insert.params).toEqual(['buyer@e2e.invalid', 'BASIC_UK', 'Trader - UK', 'quarterly', 26.97, 'GBP', 'cus_unit', 'sub_unit', null, '3 months']);
        expect(db.find('INSERT INTO subscription_history').params.slice(2, 5)).toEqual(['activated', null, 'active']);
        expect(db.texts().pop()).toBe('COMMIT');
    });

    test('a paid plan whose period ran out is expired first; one still running is left to the owner', async () => {
        const running = fakeDb([account, plan, [/^SELECT id FROM user_subscriptions WHERE user_email/, [{ id: 7 }]]]);
        const result = await Billing.processEvent(running.pool, eventOf('checkout.session.completed', session()));
        expect(result.outcome).toBe('second-paid-plan');
        expect(Billing.OWNER_ALERT_OUTCOMES).toContain('second-paid-plan');
        expect(running.find("UPDATE user_subscriptions SET status = 'expired'").text).toMatch(/COALESCE\(end_date, subscription_end_date, NOW\(\)\) <= NOW\(\)/);
        expect(running.find('INSERT INTO user_subscriptions')).toBeUndefined();
    });

    test('not paid yet (an asynchronous method), or not a subscription: nothing is written', async () => {
        for (const [over, outcome] of [[{ payment_status: 'unpaid' }, 'awaiting-payment'], [{ mode: 'payment', subscription: null }, 'ignored']]) {
            const db = fakeDb([account, plan]);
            expect((await Billing.processEvent(db.pool, eventOf('checkout.session.completed', session(over)))).outcome).toBe(outcome);
            expect(db.texts().filter(t => /^(INSERT INTO user_subscriptions|UPDATE user_subscriptions)/.test(t))).toEqual([]);
        }
    });

    test('recorded already (its invoice came first): nothing new', async () => {
        const db = fakeDb([rowFound()]);
        expect((await Billing.processEvent(db.pool, eventOf('checkout.session.completed', session()))).outcome).toBe('already-recorded');
        expect(db.find('INSERT INTO user_subscriptions')).toBeUndefined();
    });

    test('a checkout this app did not make, or a customer no account holds: nothing is written', async () => {
        const noPlan = fakeDb([account]);
        expect((await Billing.processEvent(noPlan.pool, eventOf('checkout.session.completed', session({ metadata: {} })))).outcome).toBe('not-a-checkout-plan');
        const noAccount = fakeDb([plan]);
        expect((await Billing.processEvent(noAccount.pool, eventOf('checkout.session.completed', session()))).outcome).toBe('unknown-customer');
        expect(Billing.OWNER_ALERT_OUTCOMES).toContain('unknown-customer');
        for (const db of [noPlan, noAccount]) expect(db.find('INSERT INTO user_subscriptions')).toBeUndefined();
    });
});

describe('invoice.paid: the paid period moves on', () => {
    test('a renewal moves the paid-up end forward (never back), records the payment and the renewal', async () => {
        const end = now() + 92 * DAY;
        const db = fakeDb([rowFound(), updatedTo(() => ({ subscription_end_date: new Date(end * 1000) }))]);
        const result = await Billing.processEvent(db.pool, eventOf('invoice.paid', clover('in_unit', end)));
        expect(result.outcome).toBe('renewed');
        const update = db.find('UPDATE user_subscriptions SET subscription_end_date');
        expect(update.text).toMatch(/subscription_end_date = GREATEST\(COALESCE\(subscription_end_date, \$2::timestamptz\), \$2::timestamptz\)/);
        expect(update.text).not.toMatch(/end_date = CASE|SET end_date/);
        expect(update.params[0]).toBe(42);
        expect(update.params[1]).toEqual(new Date(end * 1000));   // the latest line's end
        const payment = db.find('INSERT INTO payment_transactions');
        expect(payment.text).toMatch(/'completed'/);
        expect(payment.text).toMatch(/WHERE NOT EXISTS \(SELECT 1 FROM payment_transactions WHERE transaction_id = \$3::varchar\)/);
        expect(payment.params.slice(0, 6)).toEqual([42, 'buyer@e2e.invalid', 'in_unit', 'in_unit', 26.97, 'GBP']);
        expect(db.find('INSERT INTO subscription_history').params[2]).toBe('renewed');
    });

    test('the first invoice of a recorded checkout is recorded as a payment, not as a renewal', async () => {
        const db = fakeDb([rowFound(), updatedTo(() => ({}))]);
        const result = await Billing.processEvent(db.pool, eventOf('invoice.paid', clover('in_unit', now() + 92 * DAY, { billing_reason: 'subscription_create', payment_intent: 'pi_unit' })));
        expect(result.outcome).toBe('paid');
        expect(db.find('INSERT INTO payment_transactions').params[3]).toBe('pi_unit');
        expect(db.find('INSERT INTO subscription_history')).toBeUndefined();
    });

    test('an invoice before its checkout event makes the row itself, with the exact paid-up end', async () => {
        const end = now() + 92 * DAY;
        const db = fakeDb([account, plan, inserted, updatedTo(() => ({}))]);
        const result = await Billing.processEvent(db.pool, eventOf('invoice.paid', clover('in_unit', end, { billing_reason: 'subscription_create' })));
        expect(result.outcome).toBe('activated');
        expect(db.find('INSERT INTO user_subscriptions').params[8]).toEqual(new Date(end * 1000));
    });

    test('a payment for time after a cancelled plan stops gives no access back, and the owner hears of it', async () => {
        const ended = new Date(Date.now() - DAY * 1000);
        const db = fakeDb([rowFound({ ...ROW, status: 'cancelled', end_date: ended }), updatedTo(() => ({ status: 'cancelled', end_date: ended }))]);
        const result = await Billing.processEvent(db.pool, eventOf('invoice.paid', clover('in_unit', now() + 60 * DAY)));
        expect(result.outcome).toBe('paid-after-end');
        expect(Billing.OWNER_ALERT_OUTCOMES).toContain('paid-after-end');
        expect(db.find('INSERT INTO payment_transactions')).toBeDefined();
    });

    test('an invoice for an earlier period arriving late is recorded as a payment, not as a renewal', async () => {
        const later = new Date(Date.now() + 200 * DAY * 1000);
        const db = fakeDb([rowFound({ ...ROW, subscription_end_date: later }), updatedTo(() => ({ subscription_end_date: later }))]);
        expect((await Billing.processEvent(db.pool, eventOf('invoice.paid', clover('in_late', now() + 90 * DAY)))).outcome).toBe('paid');
        expect(db.find('INSERT INTO payment_transactions').params[2]).toBe('in_late');
        expect(db.find('INSERT INTO subscription_history')).toBeUndefined();
    });

    test('a zero invoice records no payment; an invoice for no subscription is ignored', async () => {
        const zero = fakeDb([rowFound(), updatedTo(() => ({}))]);
        await Billing.processEvent(zero.pool, eventOf('invoice.paid', clover('in_unit', now() + DAY, { amount_paid: 0 })));
        expect(zero.find('INSERT INTO payment_transactions')).toBeUndefined();
        const none = fakeDb();
        expect((await Billing.processEvent(none.pool, eventOf('invoice.paid', { id: 'in_one_off', parent: null, lines: { data: [] } }))).outcome).toBe('ignored');
    });
});

describe('invoice.payment_failed', () => {
    test('recorded as a failed attempt; the paid-up end does not move', async () => {
        const db = fakeDb([rowFound()]);
        const result = await Billing.processEvent(db.pool, eventOf('invoice.payment_failed', clover('in_unit', now() + 92 * DAY, { attempt_count: 3, amount_paid: 0 })));
        expect(result.outcome).toBe('payment-failed');
        const payment = db.find('INSERT INTO payment_transactions');
        expect(payment.text).toMatch(/'failed'/);
        expect(payment.params.slice(0, 6)).toEqual([42, 'buyer@e2e.invalid', 'in_unit:attempt-3', 'in_unit', 26.97, 'GBP']);
        expect(db.find('UPDATE user_subscriptions')).toBeUndefined();
        expect(db.find('INSERT INTO subscription_history').params[2]).toBe('payment_failed');
    });

    test('for a subscription this app never recorded: nothing', async () => {
        const db = fakeDb();
        expect((await Billing.processEvent(db.pool, eventOf('invoice.payment_failed', clover('in_unit', now())))).outcome).toBe('unknown-subscription');
        expect(db.find('INSERT INTO payment_transactions')).toBeUndefined();
    });
});

describe('customer.subscription.updated and .deleted', () => {
    test('set to end at the period end: cancelled, with access to the paid-up end', async () => {
        const db = fakeDb([rowFound(), updatedTo(() => ({ status: 'cancelled' }))]);
        expect((await Billing.processEvent(db.pool, eventOf('customer.subscription.updated', subscription({ cancel_at_period_end: true })))).outcome).toBe('cancelled');
        const update = db.find('UPDATE user_subscriptions SET status');
        expect(update.text).toMatch(/SET status = 'cancelled', end_date = COALESCE\(end_date, subscription_end_date, \$2::timestamptz\)/);
        expect(update.text).toMatch(/WHERE id = \$1 AND status = 'active'/);
    });

    test('renewing again: active, and the end its cancel wrote goes', async () => {
        const db = fakeDb([rowFound({ ...ROW, status: 'cancelled', end_date: new Date(Date.now() + 9 * DAY * 1000) }), updatedTo(() => ({ status: 'active' }))]);
        expect((await Billing.processEvent(db.pool, eventOf('customer.subscription.updated', subscription()))).outcome).toBe('reactivated');
        expect(db.find('UPDATE user_subscriptions SET status').text).toMatch(/SET status = 'active', end_date = NULL, cancellation_date = NULL/);
    });

    test('renewing again never makes a second active row for the account', async () => {
        const db = fakeDb([rowFound({ ...ROW, status: 'cancelled', end_date: new Date(Date.now() + 9 * DAY * 1000) }),
            [/^SELECT id FROM user_subscriptions WHERE user_email = \$1 AND status = 'active' AND id <> \$2/, [{ id: 9 }]]]);
        expect((await Billing.processEvent(db.pool, eventOf('customer.subscription.updated', subscription()))).outcome).toBe('second-paid-plan');
        expect(db.find('UPDATE user_subscriptions')).toBeUndefined();
    });

    test('incomplete, unpaid or paused: no change (access follows the paid-up end)', async () => {
        const db = fakeDb([rowFound()]);
        expect((await Billing.processEvent(db.pool, eventOf('customer.subscription.updated', subscription({ status: 'unpaid' })))).outcome).toBe('no-change');
        expect(db.find('UPDATE user_subscriptions')).toBeUndefined();
    });

    test('ended (deleted, or updated to canceled): cancelled, and access stops when it ended', async () => {
        for (const type of ['customer.subscription.deleted', 'customer.subscription.updated']) {
            const endedAt = now() - 60;
            const db = fakeDb([rowFound(), updatedTo(() => ({ status: 'cancelled' }))]);
            const result = await Billing.processEvent(db.pool, eventOf(type, subscription({ status: 'canceled', ended_at: endedAt })));
            expect(result.outcome).toBe('ended');
            const update = db.find('UPDATE user_subscriptions SET status');
            expect(update.text).toMatch(/end_date = LEAST\(COALESCE\(end_date, \$2::timestamptz\), \$2::timestamptz\)/);
            expect(update.text).toMatch(/cancellation_date = COALESCE\(cancellation_date, \$2::timestamptz\)/);
            expect(update.params).toEqual([42, new Date(endedAt * 1000)]);
            expect(db.find('INSERT INTO subscription_history').params.slice(2, 5)).toEqual(['cancelled', 'active', 'cancelled']);
        }
    });
});

describe('telling Stripe before a row changes here', () => {
    function fakeStripe({ status = 'active', retrieveError = null, writeError = null } = {}) {
        const calls = [];
        return {
            calls,
            subscriptions: {
                retrieve: async id => { calls.push(['retrieve', id]); if (retrieveError) throw retrieveError; return { id, status }; },
                update: async (id, params) => { calls.push(['update', id, params]); if (writeError) throw writeError; return { id }; },
                cancel: async id => { calls.push(['cancel', id]); if (writeError) throw writeError; return { id }; }
            }
        };
    }

    test('stop renewing (the Account page\'s cancel), renew (reactivate), end now (the admin, account deletion)', async () => {
        const stripe = fakeStripe();
        await expect(Billing.tellStripe('sub_a', 'stop-renewal', { stripe })).resolves.toBe('stops-renewing');
        await expect(Billing.tellStripe('sub_a', 'renew', { stripe })).resolves.toBe('renews');
        await expect(Billing.tellStripe('sub_a', 'end-now', { stripe })).resolves.toBe('ended');
        expect(stripe.calls.filter(c => c[0] !== 'retrieve')).toEqual([
            ['update', 'sub_a', { cancel_at_period_end: true }], ['update', 'sub_a', { cancel_at_period_end: false }], ['cancel', 'sub_a']]);
    });

    test('a subscription Stripe has already ended counts as done, except to renew it', async () => {
        const stripe = fakeStripe({ status: 'canceled' });
        await expect(Billing.tellStripe('sub_a', 'stop-renewal', { stripe })).resolves.toBe('already-ended');
        await expect(Billing.tellStripe('sub_a', 'end-now', { stripe })).resolves.toBe('already-ended');
        await expect(Billing.tellStripe('sub_a', 'renew', { stripe })).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER' });
        expect(stripe.calls.every(c => c[0] === 'retrieve')).toBe(true);
        const gone = fakeStripe({ retrieveError: Object.assign(new Error('No such subscription'), { code: 'resource_missing' }) });
        await expect(Billing.tellStripe('sub_a', 'end-now', { stripe: gone })).resolves.toBe('gone');
    });

    test('Stripe unreachable, or no STRIPE_SECRET_KEY: rejects with PAYMENT_PROVIDER, so the caller changes nothing', async () => {
        const down = fakeStripe({ writeError: new Error('connect ETIMEDOUT') });
        await expect(Billing.tellStripe('sub_a', 'stop-renewal', { stripe: down })).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER', message: expect.stringMatching(/ETIMEDOUT/) });
        await expect(Billing.tellStripe('sub_a', 'end-now')).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER', message: expect.stringMatching(/STRIPE_SECRET_KEY/) });
    });

    test('a row Stripe does not bill is never sent (a legacy PaymentIntent id, no id, or not a row id)', async () => {
        const stripe = fakeStripe();
        const pool = { query: jest.fn(async () => ({ rows: [{ stripe_subscription_id: 'pi_legacy' }] })) };
        await expect(Billing.syncStripeForRow(pool, 7, 'stop-renewal', { stripe })).resolves.toBeNull();
        await expect(Billing.syncStripeForRow(pool, 'not-a-number', 'end-now', { stripe })).resolves.toBeNull();
        expect(pool.query).toHaveBeenCalledTimes(1);
        expect(stripe.calls).toEqual([]);
        pool.query.mockResolvedValueOnce({ rows: [{ stripe_subscription_id: 'sub_b' }] });
        await expect(Billing.syncStripeForRow(pool, '8', 'end-now', { stripe })).resolves.toBe('ended');
        expect(pool.query).toHaveBeenLastCalledWith('SELECT stripe_subscription_id FROM user_subscriptions WHERE id = $1', ['8']);
    });
});

describe('the checkout\'s Stripe customer', () => {
    test('a stored one is reused; else one is made with the account\'s email and the first stored wins', async () => {
        const created = [];
        const stripe = { customers: { create: async params => { created.push(params); return { id: 'cus_new' }; } } };
        const stored = { query: jest.fn(async () => ({ rows: [{ stripe_customer_id: 'cus_old' }] })) };
        await expect(Billing.customerFor(stored, stripe, 'a@e2e.invalid')).resolves.toBe('cus_old');
        expect(created).toEqual([]);

        const fresh = { query: jest.fn()
            .mockResolvedValueOnce({ rows: [{ stripe_customer_id: null }] })
            .mockResolvedValueOnce({ rows: [{ stripe_customer_id: 'cus_raced' }] }) };
        await expect(Billing.customerFor(fresh, stripe, 'a@e2e.invalid')).resolves.toBe('cus_raced');
        expect(created).toEqual([{ email: 'a@e2e.invalid' }]);
        expect(fresh.query.mock.calls[1]).toEqual([
            'UPDATE users SET stripe_customer_id = COALESCE(stripe_customer_id, $1) WHERE email = $2 RETURNING stripe_customer_id',
            ['cus_new', 'a@e2e.invalid']]);

        const none = { query: jest.fn(async () => ({ rows: [] })) };
        await expect(Billing.customerFor(none, stripe, 'a@e2e.invalid')).rejects.toThrow(/no users row/);
    });
});

describe('ensureSchema', () => {
    test('the processed-events table always; only the columns a database lacks; once per pool, again after a failure', async () => {
        const sent = [];
        let fail = true;
        const pool = {
            query: jest.fn(async (sql) => {
                const text = sql.replace(/\s+/g, ' ').trim();
                sent.push(text);
                if (/^CREATE TABLE IF NOT EXISTS stripe_webhook_events/.test(text) && fail) { fail = false; throw new Error('first try fails'); }
                if (/information_schema\.columns/.test(text)) return { rows: allColumns().filter(c => c.column_name !== 'auto_renew') };
                return { rows: [] };
            })
        };
        await expect(Billing.ensureSchema(pool)).rejects.toThrow('first try fails');
        await Billing.ensureSchema(pool);
        await Billing.ensureSchema(pool);
        expect(sent.filter(t => t.startsWith('CREATE TABLE IF NOT EXISTS stripe_webhook_events'))).toHaveLength(2);
        expect(sent.find(t => t.startsWith('CREATE TABLE')).includes('event_id VARCHAR(255) PRIMARY KEY')).toBe(true);
        expect(sent.filter(t => t.startsWith('ALTER TABLE'))).toEqual(['ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT false']);
    });
});

describe('POST /api/stripe/create-subscription: a Stripe Checkout page for the plan\'s own price and period', () => {
    let server, base;
    beforeAll(async () => {
        const app = express();
        app.use(express.json());
        app.use((req, res, next) => { req.user = { email: 'buyer@e2e.invalid' }; next(); });
        app.use('/api/stripe', require('../../routes/stripe'));
        server = http.createServer(app);
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        base = `http://127.0.0.1:${server.address().port}`;
    });
    afterAll(() => new Promise(resolve => server.close(resolve)));

    const post = body => new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const req = http.request(base + '/api/stripe/create-subscription', {
            method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }
        }, res => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
        });
        req.on('error', reject);
        req.end(payload);
    });

    const PLAN_ROW = { plan_code: 'BASIC_UK', plan_name: 'Trader - UK', currency: 'GBP', price_monthly: '9.99', price_quarterly: '26.97', price_yearly: '99.99' };
    // what the access check reads (middleware/subscription.js): a running free trial unless a test says otherwise
    const accountRow = (over = {}) => ({
        email: 'buyer@e2e.invalid', region: 'UK', is_complimentary: false, subscription_id: 7, current_status: 'trial',
        plan_name: 'Explorer', plan_code: 'FREE', currency: 'USD', amount_paid: '0.00', billing_period: 'trial',
        trial_start_date: new Date(Date.now() - 10 * DAY * 1000), trial_end_date: new Date(Date.now() + 50 * DAY * 1000),
        start_date: new Date(), row_end_date: null, paid_start_date: null, paid_end_date: null, ...over
    });
    function database({ plan = PLAN_ROW, account = accountRow(), lapsed = [] } = {}) {
        mockQuery.mockImplementation(async (sql, params) => {
            const text = sql.replace(/\s+/g, ' ').trim();
            if (/information_schema\.columns/.test(text)) return { rows: allColumns() };
            if (/FROM subscription_plans WHERE plan_code = \$1 AND is_active = true/.test(text)) return { rows: plan ? [plan] : [] };
            if (/FROM users u LEFT JOIN user_subscriptions us/.test(text)) return { rows: account ? [account] : [] };
            if (/^SELECT stripe_subscription_id FROM user_subscriptions WHERE user_email = \$1 AND status = 'active'/.test(text)) return { rows: lapsed };
            if (/^SELECT stripe_customer_id FROM users WHERE email = \$1/.test(text)) return { rows: [{ stripe_customer_id: 'cus_stored' }] };
            return { rows: [] };
        });
    }
    function fakeStripe({ sessionFails = false } = {}) {
        const calls = [];
        jest.spyOn(StripeConfig, 'getStripeClient').mockReturnValue({
            customers: { create: async p => { calls.push(['customers.create', p]); return { id: 'cus_new' }; } },
            checkout: { sessions: { create: async p => {
                calls.push(['sessions.create', p]);
                if (sessionFails) throw new Error('Stripe is down');
                return { id: 'cs_new', url: 'https://checkout.stripe.com/c/pay/cs_new' };
            } } },
            subscriptions: {
                retrieve: async id => { calls.push(['retrieve', id]); return { id, status: 'past_due' }; },
                cancel: async id => { calls.push(['cancel', id]); return { id, status: 'canceled' }; }
            }
        });
        return calls;
    }

    test('monthly: one subscription-mode session at the plan\'s monthly price, the plan and period on both metadata', async () => {
        const calls = fakeStripe();
        database();
        const r = await post({ planCode: 'BASIC_UK', billingPeriod: 'monthly' });
        expect(r.status).toBe(200);
        expect(r.json).toMatchObject({ success: true, data: { url: 'https://checkout.stripe.com/c/pay/cs_new' } });
        expect(calls.map(c => c[0])).toEqual(['sessions.create']);
        const params = calls[0][1];
        expect(params).toMatchObject({
            mode: 'subscription',
            customer: 'cus_stored',
            line_items: [{ quantity: 1, price_data: { currency: 'gbp', unit_amount: 999, recurring: { interval: 'month', interval_count: 1 }, product_data: { name: 'Trader - UK' } } }],
            metadata: { plan_code: 'BASIC_UK', billing_period: 'monthly' },
            subscription_data: { metadata: { plan_code: 'BASIC_UK', billing_period: 'monthly' } }
        });
        expect(params.success_url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/checkout-success\.html\?session_id=\{CHECKOUT_SESSION_ID\}$/);
        expect(params.cancel_url).toMatch(/\/checkout\.html\?plan=BASIC_UK&cancelled=1$/);
    });

    test('quarterly and annual: their own prices and intervals', async () => {
        for (const [billingPeriod, unit, interval, count] of [['quarterly', 2697, 'month', 3], ['annual', 9999, 'year', 1]]) {
            const calls = fakeStripe();
            database();
            expect((await post({ planCode: 'BASIC_UK', billingPeriod })).status).toBe(200);
            expect(calls[0][1].line_items[0].price_data).toMatchObject({ unit_amount: unit, recurring: { interval, interval_count: count } });
        }
    });

    test('a plan Stripe still tries to charge after its paid period ran out is ended first', async () => {
        const calls = fakeStripe();
        database({ lapsed: [{ stripe_subscription_id: 'sub_lapsed' }] });
        expect((await post({ planCode: 'BASIC_UK', billingPeriod: 'monthly' })).status).toBe(200);
        expect(calls.map(c => c[0] === 'sessions.create' ? c[0] : c.join(' '))).toEqual(['retrieve sub_lapsed', 'cancel sub_lapsed', 'sessions.create']);
        const [lapsedSql] = mockQuery.mock.calls.find(([sql]) => /left\(stripe_subscription_id, 4\) = 'sub_'/.test(sql));
        expect(lapsedSql).toMatch(/COALESCE\(end_date, subscription_end_date, NOW\(\)\) <= NOW\(\)/);
    });

    test('Stripe failing: 502, and the page says nothing was charged', async () => {
        fakeStripe({ sessionFails: true });
        database();
        const r = await post({ planCode: 'BASIC_UK', billingPeriod: 'monthly' });
        expect(r.status).toBe(502);
        expect(r.json.error).toEqual({ code: 'CHECKOUT_FAILED', message: 'The payment page could not be opened. Nothing was charged.' });
    });

    test('refused before Stripe is called: a missing or unknown period, an unknown or free plan, a running paid plan', async () => {
        const future = new Date(Date.now() + 20 * DAY * 1000);
        for (const [body, setup, status, code] of [
            [{ planCode: 'BASIC_UK' }, {}, 400, 'INVALID_PERIOD'],
            [{ planCode: 'BASIC_UK', billingPeriod: 'weekly' }, {}, 400, 'INVALID_PERIOD'],
            [{ planCode: 'BASIC_UK', billingPeriod: '__proto__' }, {}, 400, 'INVALID_PERIOD'],
            [{ planCode: 'NOPE', billingPeriod: 'monthly' }, { plan: null }, 404, 'NOT_FOUND'],
            [{ planCode: 'FREE', billingPeriod: 'monthly' }, { plan: { ...PLAN_ROW, plan_code: 'FREE', price_monthly: '0.00' } }, 400, 'NO_PRICE'],
            [{ planCode: 'BASIC_UK', billingPeriod: 'monthly' }, { account: accountRow({ current_status: 'active', amount_paid: '9.99', trial_end_date: null, paid_end_date: future }) }, 409, 'ALREADY_SUBSCRIBED'],
            [{ planCode: 'BASIC_UK', billingPeriod: 'monthly' }, { account: accountRow({ current_status: 'cancelled', amount_paid: '9.99', trial_end_date: null, row_end_date: future }) }, 409, 'ALREADY_SUBSCRIBED'],
            [{ planCode: 'BASIC_UK', billingPeriod: 'monthly' }, { account: null }, 503, 'NOT_AVAILABLE']
        ]) {
            const calls = fakeStripe();
            database(setup);
            const r = await post(body);
            expect({ status: r.status, code: r.json.error && r.json.error.code }).toEqual({ status, code });
            expect(calls).toEqual([]);
        }
    });
});
