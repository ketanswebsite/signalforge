/**
 * The paid checkout switched on, end to end on the harness database.
 *
 * The harness server runs with the checkout off, as prod does until the owner switches it on (specs/stripe.json).
 * This file starts a second server on the same scratch database with STRIPE_CHECKOUT=true and made-up Stripe secrets
 * (the preload accepts only harness-shaped ones, and egress stays blocked), then delivers Stripe events signed here
 * with the same webhook secret (stripe.webhooks.generateTestHeaderString: no network). Nothing here calls Stripe:
 * the checkout route is only driven down paths that answer before it would.
 * The buyer pays in USD on a plan of its own and ends with no access, so the admin figures other specs check (GBP)
 * are the same whichever file runs first.
 */
'use strict';

const fs = require('fs');
const net = require('net');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const Stripe = require('stripe');
const h = require('./harness/client');

const WEBHOOK_SECRET = 'whsec_harness_' + crypto.randomBytes(16).toString('hex');
const SECRET_KEY = 'sk_test_harness_' + crypto.randomBytes(16).toString('hex');
const BUYER = 'harness-buyer@e2e.invalid';
const CUSTOMER = 'cus_harness_buyer';
const SUB = 'sub_harness_buyer';
const PLAN = 'HARNESS_HOOK';
const DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);
const metadata = { plan_code: PLAN, billing_period: 'quarterly' };

function pgBin(name) {
    for (const dir of [process.env.PG_BIN, '/opt/homebrew/opt/postgresql@16/bin', '/usr/local/opt/postgresql@16/bin', '/usr/bin']) {
        if (dir && fs.existsSync(path.join(dir, name))) return path.join(dir, name);
    }
    return name;
}
/** Run SQL on the harness's scratch database (psql, no shell); `rows` answers a query's rows as JSON */
function psql(sql, flags = ['-q']) {
    const r = spawnSync(pgBin('psql'), [...flags, '-v', 'ON_ERROR_STOP=1', '-d', h.state().db, '-c', sql], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error('psql: ' + (r.stderr || '').slice(0, 500));
    return r.stdout.trim();
}
const rows = query => JSON.parse(psql(`SELECT COALESCE(json_agg(t), '[]') FROM (${query}) t`, ['-At']));

function freePort() {
    return new Promise((resolve, reject) => {
        const s = net.createServer();
        s.on('error', reject);
        s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
    });
}

let base = null;
let child = null;
let routesFile = null;
let buyerCookie = null;

function call(method, url, { body, headers = {}, cookie } = {}) {
    return new Promise((resolve, reject) => {
        const sent = { ...headers };
        if (body !== undefined) {
            if (!sent['content-type']) sent['content-type'] = 'application/json';
            sent['content-length'] = Buffer.byteLength(body);
        }
        if (cookie) sent.cookie = cookie;
        const req = http.request(base + url, { method, headers: sent }, res => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                const text = Buffer.concat(chunks).toString('utf8');
                let json;
                try { json = JSON.parse(text); } catch (e) { json = undefined; }
                resolve({ status: res.statusCode, headers: res.headers, text, json });
            });
        });
        req.on('error', reject);
        if (body !== undefined) req.write(body);
        req.end();
    });
}
const asBuyer = (method, url, body) => call(method, url, { cookie: buyerCookie, body: body === undefined ? undefined : JSON.stringify(body) });

// ---------------------------------------------------------------- Stripe events, as Stripe sends them
const eventOf = (type, object) => ({
    id: 'evt_harness_' + crypto.randomBytes(8).toString('hex'), object: 'event', type, created: now(),
    livemode: false, api_version: '2025-09-30.clover', data: { object }
});
const session = (over = {}) => ({
    id: 'cs_test_harness_buyer', object: 'checkout.session', mode: 'subscription', status: 'complete',
    payment_status: 'paid', customer: CUSTOMER, subscription: SUB, amount_total: 3497, currency: 'usd', metadata, ...over
});
// An invoice before API 2025-03-31: the subscription on the invoice itself
const legacyInvoice = (id, periodEnd, reason) => ({
    id, object: 'invoice', customer: CUSTOMER, subscription: SUB, billing_reason: reason, status: 'paid',
    amount_paid: 3497, amount_due: 3497, currency: 'usd', payment_intent: 'pi_' + id, attempt_count: 1,
    subscription_details: { metadata }, status_transitions: { paid_at: now() },
    lines: { object: 'list', data: [{ id: 'il_' + id, period: { start: now(), end: periodEnd } }] }
});
// An invoice since API 2025-03-31 (the "clover" version stripe-node 19 speaks): the subscription under parent
const invoice = (id, periodEnd, reason, over = {}) => ({
    id, object: 'invoice', customer: CUSTOMER, billing_reason: reason, status: 'paid', amount_paid: 3497,
    amount_due: 3497, currency: 'usd', attempt_count: 1,
    parent: { type: 'subscription_details', subscription_details: { subscription: SUB, metadata } },
    status_transitions: { paid_at: now() },
    lines: { object: 'list', data: [{ id: 'il_' + id, period: { start: now(), end: periodEnd } }] }, ...over
});
const subscription = (over = {}) => ({
    id: SUB, object: 'subscription', customer: CUSTOMER, status: 'active', cancel_at_period_end: false, cancel_at: null,
    canceled_at: null, ended_at: null, metadata,
    items: { object: 'list', data: [{ id: 'si_harness_buyer', current_period_end: now() + 90 * DAY }] }, ...over
});

/** POST an event to the webhook, signed with the webhook secret (or unsigned, or with another secret) */
function deliver(event, { secret = WEBHOOK_SECRET, unsigned = false, tamper = null } = {}) {
    const payload = JSON.stringify(event);
    const headers = { 'content-type': 'application/json; charset=utf-8' };
    if (!unsigned) headers['stripe-signature'] = Stripe.webhooks.generateTestHeaderString({ payload, secret });
    return call('POST', '/api/stripe/webhook', { body: tamper ? tamper(payload) : payload, headers });
}

const paidRow = () => rows(`
    SELECT status, plan_code, plan_name, billing_period, amount_paid::float AS amount_paid, currency,
           extract(epoch FROM subscription_end_date)::bigint AS paid_until, extract(epoch FROM end_date)::bigint AS end_date,
           cancellation_date IS NOT NULL AS cancelled_on
    FROM user_subscriptions WHERE stripe_subscription_id = '${SUB}'`);
const payments = () => rows(`
    SELECT transaction_id, status, amount::float AS amount, currency FROM payment_transactions
    WHERE user_email = '${BUYER}' ORDER BY id`);

beforeAll(async () => {
    const s = h.state();
    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    routesFile = path.join(s.work, 'routes-runtime-stripe.json');
    const log = fs.openSync(path.join(s.work, 'server-stripe.log'), 'a');
    child = spawn(process.execPath, ['-r', s.preload, 'server.js'], {
        cwd: s.root,
        env: {
            ...s.env, PORT: String(port), BASE_URL: base, HARNESS_ROUTES_OUT: routesFile,
            STRIPE_CHECKOUT: 'true', STRIPE_SECRET_KEY: SECRET_KEY, STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET
        },
        stdio: ['ignore', log, log]
    });
    const t0 = Date.now();
    for (;;) {
        if (child.exitCode !== null) throw new Error('the switched-on server exited with ' + child.exitCode);
        const health = await call('GET', '/health').catch(() => ({ status: 0 }));
        if (health.status === 200 && fs.existsSync(routesFile)) break;
        if (Date.now() - t0 > 60000) throw new Error('the switched-on server was not ready after 60 s');
        await new Promise(r => setTimeout(r, 300));
    }
}, 90000);

afterAll(async () => {
    if (!child || child.exitCode !== null) return;
    child.kill('SIGTERM');
    for (let i = 0; i < 50 && child.exitCode === null; i++) await new Promise(r => setTimeout(r, 100));
    if (child.exitCode === null) child.kill('SIGKILL');
});

describe('the paid checkout, switched on', () => {
    test('one switch: the harness server mounts nothing under /api/stripe, the switched-on server all three routes', () => {
        const paths = file => JSON.parse(fs.readFileSync(file, 'utf8')).routes.map(r => `${r.method} ${r.path}`);
        expect(paths(h.state().routesOut).filter(r => r.includes('/api/stripe'))).toEqual([]);
        expect(paths(routesFile)).toEqual(expect.arrayContaining(
            ['POST /api/stripe/webhook', 'GET /api/stripe/config', 'POST /api/stripe/create-subscription']));
    });

    test('/api/ops/version reports the switch and the key mode, never a key', async () => {
        const r = await call('GET', '/api/ops/version', { headers: { 'x-analysis-token': h.state().token } });
        expect(r.status).toBe(200);
        expect(r.json.stripeCheckout).toEqual({ enabled: true, switchedOn: true, secretKey: true, webhookSecret: true, keyMode: 'test' });
        expect(r.text.includes(SECRET_KEY) || r.text.includes(WEBHOOK_SECRET)).toBe(false);
    });

    test('the webhook answers Stripe without a session: an event for a subscription this app never made changes nothing', async () => {
        const event = eventOf('customer.subscription.updated', subscription({ id: 'sub_harness_nobody', customer: 'cus_harness_nobody' }));
        const r = await deliver(event);
        expect(r.status).toBe(200);
        expect(r.json).toEqual({ received: true, duplicate: false, outcome: 'unknown-subscription' });
        expect(rows(`SELECT outcome FROM stripe_webhook_events WHERE event_id = '${event.id}'`)).toEqual([{ outcome: 'unknown-subscription' }]);
    });

    test('an unsigned, forged or altered event is refused with 400 and recorded nowhere', async () => {
        const event = eventOf('checkout.session.completed', session());
        expect((await deliver(event, { unsigned: true })).status).toBe(400);
        expect((await deliver(event, { secret: 'whsec_harness_' + 'f'.repeat(32) })).status).toBe(400);
        expect((await deliver(event, { tamper: p => p.replace('"amount_total":3497', '"amount_total":1') })).status).toBe(400);
        expect(rows(`SELECT 1 AS found FROM stripe_webhook_events WHERE event_id = '${event.id}'`)).toEqual([]);
        expect(paidRow()).toEqual([]);
    });

    test('before paying, the buyer has no access', async () => {
        psql(`INSERT INTO subscription_plans (plan_name, plan_code, region, currency, price_monthly, price_quarterly, price_yearly, trial_days, is_active)
              VALUES ('Harness Hook', '${PLAN}', 'US', 'USD', 12.99, 34.97, 129.99, 0, true) ON CONFLICT DO NOTHING`);
        psql(`INSERT INTO users (email, name, stripe_customer_id, first_login, last_login, created_at)
              VALUES ('${BUYER}', 'Harness Buyer', '${CUSTOMER}', now(), now(), now())
              ON CONFLICT (email) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id`);
        const login = await call('GET', '/__harness/login?as=' + encodeURIComponent(BUYER));
        expect(login.status).toBe(200);
        buyerCookie = [].concat(login.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
        expect((await asBuyer('GET', '/api/trades')).status).toBe(403);
    });

    test('checkout.session.completed records the plan with its billing period, once, and opens access', async () => {
        const event = eventOf('checkout.session.completed', session());
        const first = await deliver(event);
        expect(first.status).toBe(200);
        expect(first.json).toMatchObject({ duplicate: false, outcome: 'activated' });
        const replay = await deliver(event);
        expect(replay.json).toMatchObject({ duplicate: true, outcome: 'duplicate' });

        const [row, ...more] = paidRow();
        expect(more).toEqual([]);
        expect(row).toMatchObject({ status: 'active', plan_code: PLAN, plan_name: 'Harness Hook', billing_period: 'quarterly',
            amount_paid: 34.97, currency: 'USD', end_date: null });
        // A first paid-up end one quarter from now, until the invoice gives the exact one
        expect(Math.abs(row.paid_until - now() - 91 * DAY)).toBeLessThan(3 * DAY);

        expect((await asBuyer('GET', '/api/trades')).status).toBe(200);
        const account = await asBuyer('GET', '/api/user/subscription');
        expect(account.json.data.subscription).toMatchObject({ status: 'active', isActive: true, plan_code: PLAN,
            billing_period: 'quarterly', currency: 'USD' });
    });

    test('the checkout routes sit behind the sign-in gate and refuse a second paid plan before they would call Stripe', async () => {
        expect((await call('POST', '/api/stripe/create-subscription', { body: '{}' })).status).toBe(401);
        expect((await call('GET', '/api/stripe/config')).status).toBe(401);
        const config = await asBuyer('GET', '/api/stripe/config');
        expect(config.status).toBe(200);
        expect(config.json.data).toEqual({ open: true, testMode: true });

        const refused = async (body, status, code) => {
            const r = await asBuyer('POST', '/api/stripe/create-subscription', body);
            expect({ status: r.status, code: r.json && r.json.error && r.json.error.code }).toEqual({ status, code });
        };
        await refused({ planCode: PLAN }, 400, 'INVALID_PERIOD');
        await refused({ planCode: PLAN, billingPeriod: 'weekly' }, 400, 'INVALID_PERIOD');
        await refused({ planCode: 'HARNESS-NO-SUCH-PLAN', billingPeriod: 'monthly' }, 404, 'NOT_FOUND');
        await refused({ planCode: 'FREE', billingPeriod: 'monthly' }, 400, 'NO_PRICE');
        await refused({ planCode: PLAN, billingPeriod: 'quarterly' }, 409, 'ALREADY_SUBSCRIBED');
    });

    test('invoice.paid records each payment and moves the paid-up end forward, never back (both API shapes)', async () => {
        const firstEnd = now() + 92 * DAY;
        const r1 = await deliver(eventOf('invoice.paid', legacyInvoice('in_harness_1', firstEnd, 'subscription_create')));
        expect(r1.json).toMatchObject({ duplicate: false, outcome: 'paid' });
        expect(paidRow()[0].paid_until).toBeGreaterThanOrEqual(firstEnd);

        const renewedEnd = now() + 183 * DAY;
        const r2 = await deliver(eventOf('invoice.paid', invoice('in_harness_2', renewedEnd, 'subscription_cycle')));
        expect(r2.json).toMatchObject({ outcome: 'renewed' });
        expect(paidRow()[0].paid_until).toBe(renewedEnd);

        // A late invoice for an earlier period arrives after the renewal: recorded, and the paid-up end stays
        const r3 = await deliver(eventOf('invoice.paid', invoice('in_harness_0', now() + 120 * DAY, 'subscription_cycle')));
        expect(r3.json).toMatchObject({ outcome: 'paid' });
        expect(paidRow()[0].paid_until).toBe(renewedEnd);

        expect(payments()).toEqual(['in_harness_1', 'in_harness_2', 'in_harness_0'].map(id =>
            ({ transaction_id: id, status: 'completed', amount: 34.97, currency: 'USD' })));
        const days = (await asBuyer('GET', '/api/user/subscription')).json.data.subscription.daysRemaining;
        expect(days).toBeGreaterThanOrEqual(182);
    });

    test('a failed renewal is recorded and changes no access', async () => {
        const failed = invoice('in_harness_3', now() + 274 * DAY, 'subscription_cycle', { status: 'open', amount_paid: 0, attempt_count: 2 });
        const r = await deliver(eventOf('invoice.payment_failed', failed));
        expect(r.json).toMatchObject({ outcome: 'payment-failed' });
        expect(payments().filter(p => p.status === 'failed')).toEqual(
            [{ transaction_id: 'in_harness_3:attempt-2', status: 'failed', amount: 34.97, currency: 'USD' }]);
        expect(paidRow()[0]).toMatchObject({ status: 'active', end_date: null });
        expect((await asBuyer('GET', '/api/trades')).status).toBe(200);
    });

    test('set to end at the period end: cancelled with access to the paid-up end; renewing again: active', async () => {
        const paidUntil = paidRow()[0].paid_until;
        const cancel = await deliver(eventOf('customer.subscription.updated', subscription({ cancel_at_period_end: true })));
        expect(cancel.json).toMatchObject({ outcome: 'cancelled' });
        expect(paidRow()[0]).toMatchObject({ status: 'cancelled', end_date: paidUntil, cancelled_on: true });
        expect((await asBuyer('GET', '/api/trades')).status).toBe(200);
        expect((await asBuyer('GET', '/api/user/subscription')).json.data.subscription).toMatchObject({ status: 'cancelled', isActive: true });

        const renew = await deliver(eventOf('customer.subscription.updated', subscription()));
        expect(renew.json).toMatchObject({ outcome: 'reactivated' });
        expect(paidRow()[0]).toMatchObject({ status: 'active', end_date: null, cancelled_on: false });
    });

    test('customer.subscription.deleted ends access; a late invoice never reopens it', async () => {
        const endedAt = now() - 5;
        const ended = await deliver(eventOf('customer.subscription.deleted', subscription({ status: 'canceled', ended_at: endedAt, canceled_at: endedAt })));
        expect(ended.json).toMatchObject({ outcome: 'ended' });
        expect(paidRow()[0]).toMatchObject({ status: 'cancelled', end_date: endedAt, cancelled_on: true });
        expect((await asBuyer('GET', '/api/trades')).status).toBe(403);

        // A payment for time after the end is recorded, flagged for the owner to refund, and gives no access back
        const late = await deliver(eventOf('invoice.paid', invoice('in_harness_4', now() + 300 * DAY, 'subscription_cycle')));
        expect(late.json).toMatchObject({ outcome: 'paid-after-end' });
        expect(paidRow()[0]).toMatchObject({ status: 'cancelled', end_date: endedAt });
        expect((await asBuyer('GET', '/api/trades')).status).toBe(403);
    });

    test('every event applied was recorded once, with its outcome', () => {
        const recorded = rows("SELECT event_type, outcome FROM stripe_webhook_events WHERE event_id LIKE 'evt\\_harness\\_%'");
        expect(recorded).toHaveLength(10);
        expect(recorded.filter(e => e.outcome === 'activated')).toHaveLength(1);
        expect(recorded.every(e => typeof e.outcome === 'string' && e.outcome.length > 0)).toBe(true);
    });
});
