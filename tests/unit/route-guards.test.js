/**
 * Route guards (2026-09-23).
 *
 * "Signed in" is not an authorisation boundary here: any Google account can
 * start a free trial. Before this change:
 * - fourteen caller-less routes let such an account fire the 1 PM executor,
 *   run the all-users exit pass, book or dismiss the global signals, read
 *   every user's email, write users through a GET, run DDL, or trigger a
 *   broadcast scan;
 * - the inline /api/admin/* routes in server.js were admin-only only because
 *   routes/admin.js happened to be mounted first;
 * - the Alerts POST let a body user_id overwrite another user's row;
 * - push unsubscribe removed anyone's subscription by endpoint.
 *
 * The HTTP harness tests these end to end. These tests pin the guard itself
 * (the real middleware) and the wiring in server.js, so none of the holes can
 * quietly come back.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');

const SERVER = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8').replace(/\r\n/g, '\n');
const lineOf = (re) => { const m = SERVER.match(re); return m ? SERVER.slice(0, m.index).split('\n').length : -1; };

describe('the admin guard (real ensureAdminAPI)', () => {
    let server, base, handlerRan;
    const savedEnv = { ...process.env };

    beforeAll(async () => {
        const { ensureAdminAPI } = require('../../middleware/admin-auth');
        const app = express();
        app.use((req, res, next) => { const who = req.get('x-test-user'); if (who) req.user = { email: who }; next(); });
        app.use('/api/admin', ensureAdminAPI);
        app.post('/api/admin/test-scan', (req, res) => { handlerRan = true; res.json({ ran: true }); });
        server = http.createServer(app);
        await new Promise(r => server.listen(0, '127.0.0.1', r));
        base = `http://127.0.0.1:${server.address().port}`;
    });
    afterAll(async () => { process.env = savedEnv; await new Promise(r => server.close(r)); });
    beforeEach(() => { handlerRan = false; delete process.env.ADMIN_DEV_BYPASS; });

    const post = (headers = {}) => new Promise((resolve, reject) => {
        const req = http.request(`${base}/api/admin/test-scan`, { method: 'POST', headers }, res => { res.resume(); res.on('end', () => resolve({ status: res.statusCode })); });
        req.on('error', reject);
        req.end();
    });

    test('a signed-in non-admin gets 403 and the handler never runs', async () => {
        const r = await post({ 'x-test-user': 'trial-user@e2e.invalid' });
        expect(r.status).toBe(403);
        expect(handlerRan).toBe(false);
    });

    test('no session gets 403 too', async () => {
        expect((await post()).status).toBe(403);
        expect(handlerRan).toBe(false);
    });

    test('an admin passes (the non-production dev bypass stands in for the admin session)', async () => {
        process.env.ADMIN_DEV_BYPASS = 'true';
        process.env.NODE_ENV = 'test';
        const r = await post();
        expect(r.status).toBe(200);
        expect(handlerRan).toBe(true);
    });
});

describe('server.js wiring', () => {
    const REMOVED = [
        ['get', '/api/debug/all-trades'], ['get', '/api/test-admin'], ['get', '/api/user-analytics'],
        ['get', '/api/debug/users'], ['get', '/api/recover-users'], ['post', '/api/signals/add-to-portfolio/:signalId'],
        ['post', '/api/signals/dismiss/:signalId'], ['post', '/api/executor/manual-execute/:market'], ['get', '/api/executor/logs'],
        ['post', '/api/exit-monitor/check-exits'], ['post', '/api/exit-monitor/check-trade/:tradeId'],
        ['post', '/api/run-migration-trade-alerts'], ['post', '/api/execute-signals/:market'], ['post', '/api/force-cron-trigger'],
    ];

    test.each(REMOVED)('%s %s is not registered', (method, route) => {
        expect(SERVER.includes(`app.${method}('${route}'`)).toBe(false);
    });

    test('control: live routes are still registered', () => {
        expect(SERVER.includes("app.get('/api/signals/pending'")).toBe(true);
        expect(SERVER.includes("app.post('/api/admin/test-scan'")).toBe(true);
    });

    test('everything under /api/admin passes the admin guard first, whether or not the admin router loads', () => {
        const guard = lineOf(/^app\.use\('\/api\/admin', requireAdmin\);$/m);
        const router = lineOf(/^\s*app\.use\('\/api\/admin', adminRoutes\);$/m);
        expect(guard).toBeGreaterThan(0);
        expect(router).toBeGreaterThan(guard);
        const inline = [...SERVER.matchAll(/^app\.(get|post|put|patch|delete)\('\/api\/admin/gm)].map(m => SERVER.slice(0, m.index).split('\n').length);
        expect(inline.length).toBeGreaterThan(5);
        for (const line of inline) expect(line).toBeGreaterThan(guard);
    });

    test('if the admin check cannot load, the admin API answers 503 (closed), never open', () => {
        expect(SERVER).toMatch(/requireAdmin = \(req, res\) => res\.status\(503\)/);
    });

    test('the subscription schema probe is admin-only', () => {
        expect(SERVER.includes("app.get('/api/check-subscription-setup', requireAdmin,")).toBe(true);
    });

    test('Alerts POST: only preference columns come from the body; user_id comes from the session, last', () => {
        const start = SERVER.indexOf("app.post('/api/alerts/preferences'");
        const handler = SERVER.slice(start, SERVER.indexOf('\n});', start));
        expect(handler).not.toMatch(/\.\.\.req\.body/);
        expect(handler).toMatch(/saveAlertPreferences\(\{ \.\.\.prefs, user_id: userId \}\)/);
        expect(SERVER).toMatch(/const ALERT_PREFERENCE_FIELDS = \[/);
    });

    test('push unsubscribe removes only the caller\'s own subscription', () => {
        const start = SERVER.indexOf("app.post('/api/push/unsubscribe'");
        const handler = SERVER.slice(start, SERVER.indexOf('\n});', start));
        expect(handler).toMatch(/WHERE endpoint = \$1 AND user_email = \$2/);
        expect(handler).toMatch(/\[endpoint, req\.user\.email\]/);
    });
});
