/**
 * Every HTTP route, against the real server (see harness/global-setup.js).
 *
 * Specs live in tests/endpoints/specs/*.json, one entry per route:
 *   { "route": "GET /api/trades/:id",                   METHOD + the registered path
 *     "path": "/api/trades/{userActiveTradeId}",        optional concrete path; {fact} = an id global-setup seeded
 *     "body": { ... },                                  optional default JSON body
 *     "order": "last",                                  optional: runs after every other spec (destructive / session-ending)
 *     "absent": true,                                   optional: the route must NOT exist (removed on purpose)
 *     "cases": [ { "as": "user", "status": 200, "check": "array", "body": { ... }, "bug": "why", "note": "..." } ] }
 * Personas: anon, token (anonymous + x-analysis-token), user (live trial), nosub (no subscription, never changed),
 * admin, trial (subscription lifecycle), delete (throwaway for deletions), victim (target of admin actions),
 * logout (session-ending calls).
 * A case with "bug" states the CORRECT status and runs as test.failing: it fails today because of a known bug and
 * turns this suite red the moment the bug is fixed - then drop the "bug" field. Never encode a bug as expected.
 * HARNESS_SPECS=a.json,b.json limits the run to some files.
 */
const fs = require('fs');
const path = require('path');
const h = require('./harness/client');

const DIR = path.join(__dirname, 'specs');
const only = (process.env.HARNESS_SPECS || '').split(',').filter(Boolean);
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && (!only.length || only.includes(f))).sort();
const specs = files.flatMap(f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).map(s => ({ ...s, file: f })));
const ordered = [...specs.filter(s => s.order !== 'last'), ...specs.filter(s => s.order === 'last')];

const CHECKS = {
    json: r => expect(r.json).toBeDefined(),
    array: r => expect(Array.isArray(r.json)).toBe(true),
    object: r => expect(r.json && typeof r.json === 'object' && !Array.isArray(r.json)).toBe(true),
    html: r => expect(String(r.headers['content-type'] || '')).toMatch(/text\/html/),
    redirectLogin: r => expect(String(r.headers.location || '')).toMatch(/\/login/),
    redirectAccount: r => expect(String(r.headers.location || '')).toBe('/account.html'),
    authenticatedTrue: r => expect(r.json && r.json.authenticated).toBe(true),
    authenticatedFalse: r => expect(r.json && r.json.authenticated).toBe(false),
    isAdminTrue: r => expect((r.json && (r.json.isAdmin ?? (r.json.user && r.json.user.isAdmin)))).toBe(true),
    isAdminFalse: r => expect(Boolean(r.json && (r.json.isAdmin ?? (r.json.user && r.json.user.isAdmin)))).toBe(false),
    commitSha: r => expect(String(r.json && r.json.commit)).toMatch(/^([0-9a-f]{7,40}|unknown|null|undefined)$/),
    // { success: true, count: <whole number> }: the bulk import and delete-all answers
    successCount: r => {
        expect(r.json && r.json.success).toBe(true);
        expect(Number.isInteger(r.json.count)).toBe(true);
    },
    // A trade the body tried to make automatic was stored as a manual one
    autoAddedFalse: r => expect(r.json && r.json.autoAdded).toBe(false),
    // POST /api/ops/reconcile-capital dry run: every ledger row matches the trades table, available
    // capital included, and the nightly drift check it reports on never ran (node-cron is stubbed)
    zeroDrift: r => {
        expect(r.json && r.json.applied).toBe(false);
        expect(Array.isArray(r.json.markets) && r.json.markets.length > 0).toBe(true);
        expect(r.json.markets.filter(m => m.drift.realized !== 0 || m.drift.allocated !== 0
            || m.drift.available !== 0 || m.drift.positions !== 0)).toEqual([]);
        expect(r.json.nightlyCheck).toMatchObject({ enabled: true, lastRun: null });
    },
    // GET /api/ops/exit-checks-stats on the seed: the 'default' user holds HARNESSD.L twice, a duplicate open position,
    // while HARNESS.L is held once each by two users, which is not one; the high-conviction book holds HARNESSH.L once
    duplicateActive: r => {
        expect(r.json && r.json.success).toBe(true);
        const { trades, highConviction } = r.json.duplicateActive;
        expect(trades).toMatchObject({ count: 1, surplusRows: 1 });
        expect(trades.groups).toHaveLength(1);
        expect(trades.groups[0]).toMatchObject({ symbol: 'HARNESSD.L', automatic: 0 });
        expect(trades.groups[0].ids).toHaveLength(2);
        expect(trades.groups[0].ids.every(Number.isInteger)).toBe(true);
        expect(highConviction).toEqual({ count: 0, surplusRows: 0, groups: [] });
    },

    // ---- the admin portal shows only what the database holds (I12b). seed.sql has one paid subscription stored as the
    // Stripe checkout stores it: plan_code HARNESS_PAID and no plan_id, GBP 29.97 a quarter, so 9.99 a month.
    // GET /api/admin/audit/logs: the audit log itself (a placeholder answered [] until I12b)
    auditLogs: r => {
        expect(r.json && r.json.success).toBe(true);
        expect(Array.isArray(r.json.data.logs)).toBe(true);
    },
    // GET /api/admin/dashboard/metrics: counted figures, MRR per currency, nothing hard-coded
    dashboardMetrics: r => {
        const d = r.json.data;
        expect(d.changes).toBeUndefined();
        expect(d.paymentsThisMonth).toBeUndefined();
        expect(Number.isInteger(d.totalUsers) && Number.isInteger(d.totalTrades)).toBe(true);
        expect(d.activeSubscriptions).toBeGreaterThanOrEqual(1);
        expect(d.mrr).toEqual(expect.arrayContaining([{ currency: 'GBP', mrr: 9.99, subscriptions: 1 }]));
    },
    // GET /api/admin/subscription-plans: a Stripe row counts for its plan; the seeded trials count for FREE
    stripeRowCounted: r => {
        const plans = r.json.data.plans;
        expect(plans.every(p => Number.isInteger(p.subscriber_count))).toBe(true);
        expect(plans.find(p => p.plan_code === 'HARNESS_PAID')).toMatchObject({ subscriber_count: 1 });
        expect(plans.find(p => p.plan_code === 'FREE').subscriber_count).toBeGreaterThanOrEqual(3);
    },
    // GET /api/admin/subscriptions: a Stripe row shows its own plan, dates and billing period
    stripeRowListed: r => {
        const row = r.json.data.items.find(s => s.user_email === 'harness-stripe@e2e.invalid');
        expect(row).toMatchObject({ plan_name: 'Harness Paid', currency: 'GBP', billing: 'quarterly', status: 'active' });
        expect(row.start_date && row.end_date).toBeTruthy();
    },
    // GET /api/admin/subscription-analytics and /analytics/revenue: MRR per currency, none of the made-up trends,
    // growth figures or lifetime values
    mrrPerCurrency: r => {
        const d = r.json.data;
        expect(d.mrr).toEqual(expect.arrayContaining([{ currency: 'GBP', mrr: 9.99, subscriptions: 1 }]));
        if ('churn_rate' in d) expect(typeof d.churn_rate).toBe('number');
        for (const key of ['mrr_change', 'arr_change', 'churn_change', 'ltv_change', 'avg_ltv', 'mrrGrowth', 'ltv', 'arpu']) {
            expect(d[key]).toBeUndefined();
        }
    },
    // GET /api/admin/payment-analytics: revenue per currency (the seeded payments are GBP), no made-up changes
    paymentAnalytics: r => {
        const d = r.json.data;
        expect(d.revenue).toEqual(expect.arrayContaining([expect.objectContaining({ currency: 'GBP' })]));
        for (const key of ['totalRevenue', 'revenueChange', 'transactionChange', 'successRateChange', 'refundRateChange']) {
            expect(d[key]).toBeUndefined();
        }
    },
    // GET /api/admin/analytics/engagement: none of the made-up figures
    noInventedFigures: r => {
        const d = r.json.data;
        for (const key of ['wauGrowth', 'mauGrowth', 'featureUsage']) expect(d[key]).toBeUndefined();
        expect(Number.isInteger(d.dau) && Number.isInteger(d.mau)).toBe(true);
    },
    // GET /api/admin/analytics/subscriptions: accounts, not rows; numbers, not strings; none of the made-up figures
    subscriptionHealth: r => {
        const d = r.json.data;
        for (const key of ['upgrades', 'downgrades']) expect(d[key]).toBeUndefined();
        expect(d.funnel.profileCompleted).toBeUndefined();
        expect(Number.isInteger(d.funnel.trialStarted) && Number.isInteger(d.funnel.converted)).toBe(true);
        expect(d.funnel.trialStarted).toBeGreaterThanOrEqual(3);
        expect(d.funnel.converted).toBeLessThanOrEqual(d.funnel.trialStarted);
        expect(typeof d.trialConversion).toBe('number');
        expect(typeof d.churnRate).toBe('number');
    },
    // GET /api/admin/database/migrations: recorded and unrecorded files; nothing is called pending
    migrationsHonest: r => {
        const d = r.json.data;
        expect(Array.isArray(d.recorded) && Array.isArray(d.unrecorded)).toBe(true);
        expect(d.pending).toBeUndefined();
    },
    // POST /api/admin/database/query, read mode: the one statement's rows
    queryRows: r => expect(r.json.data.rows).toEqual([{ one: 1 }]),
    // POST /api/admin/database/maintenance/reindex: the tables rebuilt, and none failed on the scratch database
    reindexReport: r => {
        expect(r.json.data.reindexed).toBeGreaterThan(0);
        expect(r.json.data.failed).toEqual([]);
    },
    // GET /api/admin/system/health: the database check asked the database, and memory is measured against a limit
    // (heapTotal, which V8 grows on demand, made a healthy server read "fail")
    healthPing: r => {
        const db = r.json.data.checks.find(c => c.name === 'Database connection');
        expect(db).toMatchObject({ status: 'pass' });
        expect(db.message).toMatch(/answered SELECT 1 in \d+ ms/);
        expect(r.json.data.database.connected).toBe(true);
        const memory = r.json.data.checks.find(c => c.name === 'Memory pressure');
        expect(memory).toMatchObject({ status: 'pass' });
        expect(memory.message).toMatch(/holds \d+ MB of the \d+ MB (the container allows|it may grow to)/);
    },
    // GET /api/admin/settings/general: facts about the harness boot (AUTO_EXECUTE=false, no keys)
    configurationFacts: r => expect(r.json.data).toEqual({
        environment: 'development',
        autoExecute: false,
        integrations: { telegramBot: false, webPush: false, stripe: false, stripeWebhook: false, gemini: false }
    }),
    // GET /api/admin/settings/telegram: no bot in the harness, and the admin has linked no chat
    telegramFacts: r => expect(r.json.data).toEqual({ botConfigured: false, ownChatLinked: false }),
    // POST /api/admin/settings/clear-cache: the AI verdicts held in memory, counted
    cacheCleared: r => {
        expect(r.json.data.type).toBe('conviction');
        expect(Number.isInteger(r.json.data.cleared)).toBe(true);
    },
    // GET /api/admin/users?search=harness-victim: the search is applied (it was ignored until I12b)
    usersSearchVictim: r => expect(r.json.data.items.map(u => u.email)).toEqual(['harness-victim@e2e.invalid']),
    // ... and a LIKE wildcard is searched for as itself: no email or name holds %
    usersNone: r => expect(r.json.data.items).toEqual([]),
    // GET /api/admin/users?filter=telegram: only accounts with a linked chat
    usersTelegramOnly: r => expect(r.json.data.items.every(u => u.telegram_chat_id)).toBe(true),
    // DELETE /api/admin/users/:email: the whole account, signed out everywhere
    accountDeleted: r => {
        expect(r.json && r.json.success).toBe(true);
        expect(r.json.data).toMatchObject({ email: 'harness-trial@e2e.invalid', financialRecordsRetained: false });
        expect(r.json.data.sessionsEnded).toBeGreaterThanOrEqual(1);
    },
    // GET /api/admin/signal-diagnostics: the seeded signal is checked against the house book (the admin's ledger, where
    // the 1 PM executor books); against no account every signal read MARKET_NOT_FOUND
    diagnosticsHouseBook: r => {
        const d = r.json.diagnostics;
        expect(Object.keys(d.capitalStatus.capital)).toEqual(expect.arrayContaining(['India', 'UK', 'US']));
        expect(d.validationResults.find(v => v.symbol === 'HARNESSP.L')).toMatchObject({ valid: true, code: 'OK' });
    }
};

test('spec files load', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(specs.length).toBeGreaterThan(0);
});

for (const spec of ordered) {
    const [method, route] = spec.route.split(' ');
    describe(`${spec.route}${spec.absent ? ' (removed)' : ''}`, () => {
        for (const c of spec.cases) {
            const run = c.bug ? test.failing : test;
            run(`${c.as} -> ${c.status}${c.bug ? ` (known bug: ${c.bug})` : ''}`, async () => {
                const concrete = h.fill(c.path || spec.path || route);
                const body = c.body !== undefined ? c.body : spec.body;
                const r = await h.request(c.as, method, concrete, body !== undefined ? { body } : {});
                expect({ status: r.status, body: r.text.slice(0, 200) }).toMatchObject({ status: c.status });
                if (c.check) CHECKS[c.check](r);
            });
        }
    });
}
