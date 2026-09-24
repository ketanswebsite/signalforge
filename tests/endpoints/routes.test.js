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
