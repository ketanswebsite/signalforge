/**
 * The free-trial lifecycle: the access check (middleware/subscription.js) and the user routes
 * (routes/subscription.js).
 *
 * Until 2026-09-24:
 * - an account that had never started a trial read as 'expired', so the trial page could not tell
 *   day 0 from day 91 and the account page said the plan had ended;
 * - cancelling ended access at once, although the cancel answer (with the date 01-01-1970 for a
 *   trial) and the account page promise access until the end;
 * - reactivate looked only at subscription_end_date, which start-trial never writes, so a cancelled
 *   trial could never come back, and a row it did find always came back as a paid 'active' row;
 * - a trial could be started again after cancelling or running out: re-trials were unlimited;
 * - a checkout attempt (a 'pending' row) became the newest row and ended a running trial.
 *
 * The database is mocked, so what is pinned here is the decision logic and the SQL each route
 * sends. The endpoint harness walks the same lifecycle against real Postgres
 * (tests/endpoints/specs/user-account.json, trial persona).
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');

// Both modules use the app's one pool (database-postgres.js), which is mocked here
const mockQuery = jest.fn();
jest.mock('../../database-postgres', () => ({ pool: { query: (...args) => mockQuery(...args) } }));

const ENV = ['ADMIN_EMAIL', 'DISABLE_SUBSCRIPTION_CHECK'];
const envAtStart = Object.fromEntries(ENV.map(k => [k, process.env[k]]));

const { getUserSubscriptionStatus, ensureSubscriptionActive } = require('../../middleware/subscription');
const subscriptionRoutes = require('../../routes/subscription');

const DAY_MS = 24 * 60 * 60 * 1000;
const inDays = days => new Date(Date.now() + days * DAY_MS);
const EMAIL = 'someone@e2e.invalid';

// What the access check's SELECT returns: the users row LEFT JOINed to the newest subscription row
function row(overrides = {}) {
    return {
        email: EMAIL, region: 'UK', subscription_status: 'trial', subscription_end_date: null, is_premium: false,
        is_complimentary: false, complimentary_until: null, complimentary_reason: null, granted_by: null,
        subscription_id: 7, current_status: 'trial', plan_name: 'Explorer', plan_code: 'FREE', currency: 'USD',
        amount_paid: '0.00', billing_period: 'trial', trial_start_date: inDays(-30), trial_end_date: inDays(60),
        start_date: inDays(-30), row_end_date: null, paid_start_date: null, paid_end_date: null,
        cancellation_date: null, cancellation_reason: null,
        ...overrides
    };
}
// A users row with no subscription row: every us.* column is NULL
const neverSubscribed = () => row({
    subscription_id: null, current_status: null, plan_name: null, plan_code: null, currency: null, amount_paid: null,
    billing_period: null, trial_start_date: null, trial_end_date: null, start_date: null
});
const paid = (overrides = {}) => row({
    current_status: 'active', plan_name: 'Basic UK', plan_code: 'BASIC_UK', currency: 'GBP', amount_paid: '9.99',
    billing_period: 'monthly', trial_start_date: null, trial_end_date: null, start_date: null,
    paid_start_date: inDays(-5), ...overrides
});

const isStatusSelect = sql => /FROM users u\s+LEFT JOIN user_subscriptions us/.test(sql);
const isWrite = sql => /^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql);

/**
 * Answers every statement by its SQL. `status` is the access check's row (null = no users row);
 * the rest are the rows each route-level SELECT gets.
 */
function serve({ status = neverSubscribed(), running = [], latest = [], pastTrial = [], cancelReturning = [], reactivateReturning = [{ id: 7 }], stripeSubscription = null } = {}) {
    mockQuery.mockImplementation(async (sql) => {
        if (isStatusSelect(sql)) return { rows: status ? [status] : [] };
        // lib/shared/stripe-billing.js: the Stripe subscription behind a row (none unless the test says)
        if (/^\s*SELECT stripe_subscription_id FROM user_subscriptions WHERE id = \$1/.test(sql)) {
            return { rows: [{ stripe_subscription_id: stripeSubscription }] };
        }
        if (/FROM subscription_plans/.test(sql)) {
            return { rows: [{ id: 1, plan_code: 'FREE', plan_name: 'Explorer', region: 'Global', currency: 'USD', trial_days: 90 }] };
        }
        if (/^\s*SELECT 1\s+FROM user_subscriptions/.test(sql)) return { rows: pastTrial };
        if (/^\s*SELECT id, status\s+FROM user_subscriptions/.test(sql)) return { rows: running };
        if (/AS access_until/.test(sql)) return { rows: latest };
        if (/^\s*UPDATE user_subscriptions/.test(sql) && /RETURNING end_date/.test(sql)) return { rows: cancelReturning };
        if (/^\s*UPDATE user_subscriptions/.test(sql) && /RETURNING id\b/.test(sql)) return { rows: reactivateReturning };
        if (/^\s*INSERT INTO user_subscriptions/.test(sql)) return { rows: [{ id: 42, trial_end_date: inDays(90) }] };
        return { rows: [] };
    });
}
const writes = () => mockQuery.mock.calls.filter(([sql]) => isWrite(sql));

async function statusOf(dbRow) {
    serve({ status: dbRow });
    return getUserSubscriptionStatus(EMAIL);
}

beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    delete process.env.ADMIN_EMAIL;
    delete process.env.DISABLE_SUBSCRIPTION_CHECK;
});

afterAll(() => {
    for (const k of ENV) {
        if (envAtStart[k] === undefined) delete process.env[k]; else process.env[k] = envAtStart[k];
    }
});

describe('getUserSubscriptionStatus', () => {
    test('an account that never started a trial reads "none", not "expired"', async () => {
        const s = await statusOf(neverSubscribed());
        expect(s).toMatchObject({ status: 'none', isActive: false, isPremium: false, daysRemaining: 0, endDate: null });
    });

    test('no users row at all is still null', async () => {
        expect(await statusOf(null)).toBeNull();
    });

    test('a live trial runs until trial_end_date', async () => {
        const end = inDays(60);
        const s = await statusOf(row({ trial_end_date: end }));
        expect(s).toMatchObject({ status: 'trial', isActive: true, isPremium: false, daysRemaining: 60 });
        expect(s.subscription_end_date).toEqual(end);
    });

    test('a trial past its end is expired', async () => {
        const s = await statusOf(row({ trial_end_date: inDays(-1) }));
        expect(s).toMatchObject({ status: 'expired', isActive: false, daysRemaining: 0 });
    });

    test('a cancelled trial keeps access until the end its cancel wrote into end_date', async () => {
        const s = await statusOf(row({ current_status: 'cancelled', row_end_date: inDays(20), trial_end_date: inDays(20) }));
        expect(s).toMatchObject({ status: 'cancelled', isActive: true, isPremium: false, daysRemaining: 20 });
    });

    test('a trial cancelled before end_date was written keeps access until its trial end', async () => {
        const s = await statusOf(row({ current_status: 'cancelled', row_end_date: null, trial_end_date: inDays(10) }));
        expect(s).toMatchObject({ status: 'cancelled', isActive: true, daysRemaining: 10 });
    });

    test('an admin cancel (end_date = the moment it cancelled) ends access, whatever the trial end', async () => {
        const s = await statusOf(row({ current_status: 'cancelled', row_end_date: new Date(Date.now() - 1000), trial_end_date: inDays(60) }));
        expect(s).toMatchObject({ status: 'expired', isActive: false, daysRemaining: 0 });
    });

    test('a paid plan runs until end_date, else the Stripe period end', async () => {
        expect(await statusOf(paid({ row_end_date: inDays(12), paid_end_date: inDays(40) })))
            .toMatchObject({ status: 'active', isActive: true, isPremium: true, daysRemaining: 12 });
        expect(await statusOf(paid({ row_end_date: null, paid_end_date: inDays(25) })))
            .toMatchObject({ status: 'active', isActive: true, isPremium: true, daysRemaining: 25 });
    });

    test('a paid plan past its end is expired; a trial end never extends a paid row', async () => {
        const s = await statusOf(paid({ row_end_date: null, paid_end_date: inDays(-1), trial_end_date: inDays(30) }));
        expect(s).toMatchObject({ status: 'expired', isActive: false, isPremium: false });
    });

    test('a cancelled paid plan keeps access until its paid-up period ends', async () => {
        const s = await statusOf(paid({ current_status: 'cancelled', row_end_date: inDays(8) }));
        expect(s).toMatchObject({ status: 'cancelled', isActive: true, daysRemaining: 8 });
    });

    test('any other status grants nothing', async () => {
        for (const current of ['expired', 'grace_period', 'deleted']) {
            expect(await statusOf(row({ current_status: current, row_end_date: inDays(30) })))
                .toMatchObject({ status: 'expired', isActive: false });
        }
    });

    test('checkout attempts (pending, payment_failed) never decide access; the newest other row does', async () => {
        await statusOf(row());
        const [sql, params] = mockQuery.mock.calls[0];
        expect(sql).toMatch(/LEFT JOIN user_subscriptions us\s+ON u\.email = us\.user_email AND us\.status NOT IN \('pending', 'payment_failed'\)/);
        expect(sql).toMatch(/ORDER BY us\.created_at DESC, us\.id DESC\s+LIMIT 1/);
        expect(params).toEqual([EMAIL]);
    });

    test('the row\'s start date comes back as subscription_start_date (the account page\'s "Started")', async () => {
        const start = inDays(-30);
        expect((await statusOf(row({ start_date: start }))).subscription_start_date).toEqual(start);
        expect((await statusOf(paid({ start_date: null }))).subscription_start_date).toEqual(expect.any(Date));
    });

    test('complimentary access is untouched: it comes first and needs no subscription row', async () => {
        const s = await statusOf(row({ ...neverSubscribed(), is_complimentary: true, complimentary_until: null }));
        expect(s).toMatchObject({ status: 'complimentary_lifetime', isActive: true, isPremium: true });
    });
});

describe('ensureSubscriptionActive', () => {
    function gate(dbRow, email = EMAIL) {
        serve({ status: dbRow });
        return new Promise(resolve => {
            const req = { path: '/api/trades', user: { email } };
            const res = {
                status(code) { this.code = code; return this; },
                json(body) { resolve({ passed: false, code: this.code, body }); }
            };
            ensureSubscriptionActive(req, res, () => resolve({ passed: true, subscription: req.subscription }));
        });
    }

    test('never started a trial: 403 that points at the trial page', async () => {
        const r = await gate(neverSubscribed());
        expect(r).toMatchObject({ passed: false, code: 403 });
        expect(r.body).toMatchObject({ requiresTrial: true, redirect: '/trial-activation.html' });
    });

    test('a cancelled trial with days left passes', async () => {
        const r = await gate(row({ current_status: 'cancelled', row_end_date: inDays(5) }));
        expect(r.passed).toBe(true);
        expect(r.subscription).toMatchObject({ status: 'cancelled', isActive: true });
    });

    test('an expired trial gets 403 "Subscription expired"', async () => {
        const r = await gate(row({ trial_end_date: inDays(-3) }));
        expect(r).toMatchObject({ passed: false, code: 403 });
        expect(r.body).toMatchObject({ error: 'Subscription expired', redirect: '/pricing.html' });
    });

    test('the admin passes without a database read', async () => {
        process.env.ADMIN_EMAIL = 'admin@e2e.invalid';
        const r = await gate(neverSubscribed(), 'admin@e2e.invalid');
        expect(r.passed).toBe(true);
        expect(mockQuery).not.toHaveBeenCalled();
    });
});

describe('routes/subscription.js', () => {
    let server, base;

    beforeAll(async () => {
        const app = express();
        app.use(express.json());
        app.use((req, res, next) => {
            if (req.body === undefined) req.body = {};
            const who = req.get('x-test-user');
            if (who) req.user = { email: who };
            next();
        });
        app.use('/api', subscriptionRoutes);
        server = http.createServer(app);
        await new Promise(r => server.listen(0, '127.0.0.1', r));
        base = `http://127.0.0.1:${server.address().port}`;
    });
    afterAll(() => new Promise(r => server.close(r)));

    const call = (method, url, body) => new Promise((resolve, reject) => {
        const payload = body === undefined ? undefined : JSON.stringify(body);
        const headers = { 'x-test-user': EMAIL };
        if (payload !== undefined) Object.assign(headers, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) });
        const req = http.request(base + url, { method, headers }, res => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null') }));
        });
        req.on('error', reject);
        if (payload !== undefined) req.write(payload);
        req.end();
    });

    describe('POST /api/user/subscription/start-trial', () => {
        test('never started a trial: one trial row is written', async () => {
            serve({ status: neverSubscribed(), pastTrial: [] });
            const r = await call('POST', '/api/user/subscription/start-trial');
            expect(r.status).toBe(200);
            expect(r.json.data).toMatchObject({ trialStarted: true, subscriptionId: 42 });
            expect(writes().filter(([sql]) => /INSERT INTO user_subscriptions/.test(sql))).toHaveLength(1);
        });

        test('a running trial: 400 ALREADY_SUBSCRIBED, nothing written', async () => {
            serve({ status: row(), pastTrial: [{ '?column?': 1 }] });
            const r = await call('POST', '/api/user/subscription/start-trial');
            expect(r.status).toBe(400);
            expect(r.json.error.code).toBe('ALREADY_SUBSCRIBED');
            expect(writes()).toEqual([]);
        });

        test('a cancelled trial, even with days left: 409 TRIAL_USED, nothing written', async () => {
            serve({ status: row({ current_status: 'cancelled', row_end_date: inDays(30) }), pastTrial: [{ '?column?': 1 }] });
            const r = await call('POST', '/api/user/subscription/start-trial');
            expect(r.status).toBe(409);
            expect(r.json.error).toMatchObject({ code: 'TRIAL_USED', message: expect.stringMatching(/already had your free trial/) });
            expect(writes()).toEqual([]);
        });

        test('a trial that ran out: 409 TRIAL_USED, and the history check covers every row of the account', async () => {
            serve({ status: row({ trial_end_date: inDays(-1) }), pastTrial: [{ '?column?': 1 }] });
            const r = await call('POST', '/api/user/subscription/start-trial');
            expect(r.status).toBe(409);
            const [sql, params] = mockQuery.mock.calls.find(([s]) => /^\s*SELECT 1\s+FROM user_subscriptions/.test(s));
            expect(sql).toMatch(/status = 'trial' OR trial_start_date IS NOT NULL OR trial_end_date IS NOT NULL/);
            expect(sql).not.toMatch(/ORDER BY/);
            expect(params).toEqual([EMAIL]);
            expect(writes()).toEqual([]);
        });
    });

    describe('POST /api/user/subscription/cancel', () => {
        test('keeps access: end_date becomes the row\'s own end, and the answer carries it', async () => {
            const end = new Date('2026-12-23T10:00:00Z');
            serve({ running: [{ id: 7, status: 'trial' }], cancelReturning: [{ end_date: end }] });
            const r = await call('POST', '/api/user/subscription/cancel', { reason: 'unit' });
            expect(r.status).toBe(200);
            expect(new Date(r.json.data.accessUntil)).toEqual(end);
            expect(r.json.data.message).toMatch(/until 23-12-2026\.$/);
            const [update, params] = writes().find(([sql]) => /UPDATE user_subscriptions/.test(sql));
            expect(update).toMatch(/end_date = CASE WHEN status = 'trial' THEN trial_end_date\s+ELSE COALESCE\(end_date, subscription_end_date\) END/);
            expect(params).toEqual(['unit', 7]);
        });

        test('a second cancel that raced the first (a double click) is 409 and writes no history', async () => {
            serve({ running: [{ id: 7, status: 'trial' }], cancelReturning: [] });
            const r = await call('POST', '/api/user/subscription/cancel', {});
            expect(r.status).toBe(409);
            expect(r.json.error.code).toBe('ALREADY_CANCELLED');
            const [update] = writes().find(([sql]) => /UPDATE user_subscriptions/.test(sql));
            expect(update).toMatch(/WHERE id = \$2 AND status IN \('trial', 'active'\)/);
            expect(writes().filter(([sql]) => /subscription_history/.test(sql))).toEqual([]);
        });

        describe('a plan Stripe bills', () => {
            const StripeConfig = require('../../config/stripe');
            function fakeStripe({ fails = false } = {}) {
                const calls = [];
                const stripe = { subscriptions: {
                    retrieve: async id => { calls.push(['retrieve', id]); return { id, status: 'active' }; },
                    update: async (id, params) => {
                        calls.push(['update', id, params]);
                        if (fails) throw new Error('Stripe is down');
                        return { id };
                    },
                    cancel: async id => { calls.push(['cancel', id]); return { id }; }
                } };
                jest.spyOn(StripeConfig, 'getStripeClient').mockReturnValue(stripe);
                return calls;
            }

            test('stops renewing in Stripe first, then the row is cancelled as any other', async () => {
                const calls = fakeStripe();
                serve({ running: [{ id: 7, status: 'active' }], cancelReturning: [{ end_date: inDays(20) }], stripeSubscription: 'sub_unit' });
                const r = await call('POST', '/api/user/subscription/cancel', { reason: 'unit' });
                expect(r.status).toBe(200);
                expect(calls).toEqual([['retrieve', 'sub_unit'], ['update', 'sub_unit', { cancel_at_period_end: true }]]);
                expect(writes().filter(([sql]) => /UPDATE user_subscriptions/.test(sql))).toHaveLength(1);
            });

            test('when Stripe cannot be told, nothing changes here: 502', async () => {
                fakeStripe({ fails: true });
                serve({ running: [{ id: 7, status: 'active' }], cancelReturning: [{ end_date: inDays(20) }], stripeSubscription: 'sub_unit' });
                const r = await call('POST', '/api/user/subscription/cancel', { reason: 'unit' });
                expect(r.status).toBe(502);
                expect(r.json.error.code).toBe('PAYMENT_PROVIDER');
                expect(writes()).toEqual([]);
            });

            test('a legacy checkout row (a PaymentIntent id) is never sent to Stripe', async () => {
                const calls = fakeStripe();
                serve({ running: [{ id: 7, status: 'active' }], cancelReturning: [{ end_date: inDays(20) }], stripeSubscription: 'pi_legacy' });
                expect((await call('POST', '/api/user/subscription/cancel', {})).status).toBe(200);
                expect(calls).toEqual([]);
            });

            test('reactivating renews in Stripe first, and the end its cancel wrote goes: the paid-up end decides again', async () => {
                const calls = fakeStripe();
                serve({ latest: [{ id: 8, status: 'cancelled', plan_name: 'Trader - UK', trial_end_date: null, amount_paid: '9.99', access_until: inDays(9) }], stripeSubscription: 'sub_unit' });
                const r = await call('POST', '/api/user/subscription/reactivate');
                expect(r.status).toBe(200);
                expect(calls).toEqual([['retrieve', 'sub_unit'], ['update', 'sub_unit', { cancel_at_period_end: false }]]);
                const [update, params] = writes().find(([sql]) => /UPDATE user_subscriptions/.test(sql));
                expect(update).toMatch(/end_date = CASE WHEN left\(stripe_subscription_id, 4\) = 'sub_' THEN NULL ELSE end_date END/);
                expect(params).toEqual([8, 'active']);
            });
        });

        test('only a row that is still running can be cancelled', async () => {
            serve({ running: [] });
            const r = await call('POST', '/api/user/subscription/cancel', {});
            expect(r.status).toBe(404);
            const [select] = mockQuery.mock.calls[0];
            expect(select).toMatch(/status = 'trial' AND trial_end_date > NOW\(\)/);
            expect(select).toMatch(/status = 'active' AND COALESCE\(end_date, subscription_end_date\) > NOW\(\)/);
            expect(writes()).toEqual([]);
        });
    });

    describe('POST /api/user/subscription/reactivate', () => {
        const restored = () => writes().find(([sql]) => /UPDATE user_subscriptions/.test(sql))[1][1];

        test('a cancelled trial comes back as a trial, never as a paid active row', async () => {
            serve({ latest: [{ id: 7, status: 'cancelled', plan_name: 'Explorer', trial_end_date: inDays(20), amount_paid: '0.00', access_until: inDays(20) }] });
            const r = await call('POST', '/api/user/subscription/reactivate');
            expect(r.status).toBe(200);
            expect(r.json.data).toMatchObject({ reactivated: true, status: 'trial' });
            expect(restored()).toBe('trial');
        });

        test('a cancelled paid plan comes back as active', async () => {
            serve({ latest: [{ id: 8, status: 'cancelled', plan_name: 'Basic UK', trial_end_date: null, amount_paid: '9.99', access_until: inDays(9) }] });
            const r = await call('POST', '/api/user/subscription/reactivate');
            expect(r.status).toBe(200);
            expect(restored()).toBe('active');
        });

        test('a second reactivate that raced the first is 409 and writes no history', async () => {
            serve({ latest: [{ id: 7, status: 'cancelled', plan_name: 'Explorer', trial_end_date: inDays(20), amount_paid: '0.00', access_until: inDays(20) }], reactivateReturning: [] });
            const r = await call('POST', '/api/user/subscription/reactivate');
            expect(r.status).toBe(409);
            expect(r.json.error.code).toBe('ALREADY_REACTIVATED');
            expect(writes().filter(([sql]) => /subscription_history/.test(sql))).toEqual([]);
        });

        test('a cancelled row whose access has ended stays cancelled: 404', async () => {
            serve({ latest: [{ id: 7, status: 'cancelled', plan_name: 'Explorer', trial_end_date: inDays(-2), amount_paid: '0.00', access_until: inDays(-2) }] });
            expect((await call('POST', '/api/user/subscription/reactivate')).status).toBe(404);
            expect(writes()).toEqual([]);
        });

        test('only the newest row counts: a newer running row means nothing to reactivate', async () => {
            serve({ latest: [{ id: 9, status: 'trial', plan_name: 'Explorer', trial_end_date: inDays(80), amount_paid: '0.00', access_until: inDays(80) }] });
            expect((await call('POST', '/api/user/subscription/reactivate')).status).toBe(404);
            const [select] = mockQuery.mock.calls[0];
            expect(select).toMatch(/status NOT IN \('pending', 'payment_failed'\)\s+ORDER BY created_at DESC, id DESC\s+LIMIT 1/);
            expect(writes()).toEqual([]);
        });
    });

    describe('GET /api/user/subscription', () => {
        test('never started a trial: no subscription, and the region the checkout page reads', async () => {
            serve({ status: neverSubscribed() });
            const r = await call('GET', '/api/user/subscription');
            expect(r.status).toBe(200);
            expect(r.json.data).toMatchObject({ hasSubscription: false, status: 'none', isAdmin: false, region: 'UK' });
            expect(r.json.data.subscription).toBeUndefined();
        });

        test('a cancelled trial with days left reads as cancelled and active, with its end date', async () => {
            const end = inDays(15);
            serve({ status: row({ current_status: 'cancelled', row_end_date: end }) });
            const r = await call('GET', '/api/user/subscription');
            expect(r.json.data.subscription).toMatchObject({ status: 'cancelled', isActive: true, daysRemaining: 15 });
            expect(new Date(r.json.data.subscription.subscription_end_date)).toEqual(end);
        });
    });
});

describe('one database pool', () => {
    const source = rel => fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8');

    test.each(['middleware/subscription.js', 'routes/subscription.js', 'routes/stripe.js'])(
        '%s uses the app\'s pool and opens none of its own', (rel) => {
            const src = source(rel);
            expect(src).toMatch(/const TradeDB = require\('\.\.\/database-postgres'\);/);
            expect(src).not.toMatch(/new Pool\(/);
            expect(src).not.toMatch(/require\('pg'\)/);
        });

    test('the Stripe router loads: the checkout routes, and the webhook server.js mounts before the JSON parser', () => {
        const stripeRouter = require('../../routes/stripe');
        const paths = stripeRouter.stack.filter(l => l.route).map(l => l.route.path);
        expect(paths.sort()).toEqual(['/config', '/create-subscription']);
        expect(typeof stripeRouter.webhook).toBe('function');
    });
});
