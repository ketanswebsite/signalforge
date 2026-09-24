/**
 * @jest-environment node
 *
 * lib/shared/ops-auth.js: the ops tokens. ANALYSIS_API_TOKEN opens every token-guarded route (the /api/ops
 * probes and triggers, the manual scan, the AI routine's feed). ANALYSIS_READ_TOKEN opens the seven read-only
 * GET /api/ops probes and nothing else: never a POST, never a route that did not ask for it, never from the
 * URL. Until 2026-09-24 thirteen routes compared the one token by hand, eleven of them also from the URL.
 * The endpoint harness runs both tokens against every ops route; these tests pin the guard and the wiring.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { requireOpsToken, opsAccess, tokenMatches, HEADER } = require('../../lib/shared/ops-auth');

const ROOT = path.join(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const FULL = 'full-token-' + 'f'.repeat(40);
const READ = 'read-token-' + 'r'.repeat(40);

const savedEnv = { API: process.env.ANALYSIS_API_TOKEN, READ: process.env.ANALYSIS_READ_TOKEN };
const restore = (key, value) => { if (value === undefined) delete process.env[key]; else process.env[key] = value; };
beforeEach(() => {
    process.env.ANALYSIS_API_TOKEN = FULL;
    process.env.ANALYSIS_READ_TOKEN = READ;
});
afterAll(() => {
    restore('ANALYSIS_API_TOKEN', savedEnv.API);
    restore('ANALYSIS_READ_TOKEN', savedEnv.READ);
});

describe('tokenMatches', () => {
    test('equal strings match; anything else does not', () => {
        expect(tokenMatches(FULL, FULL)).toBe(true);
        expect(tokenMatches(FULL.slice(0, -1) + 'g', FULL)).toBe(false);
        expect(tokenMatches(FULL + 'x', FULL)).toBe(false);
        expect(tokenMatches(FULL.toUpperCase(), FULL)).toBe(false);
    });

    test('a missing token on either side never matches, not even another missing one', () => {
        for (const [presented, expected] of [[undefined, undefined], ['', ''], [undefined, FULL], ['', FULL], [FULL, undefined], [FULL, ''],
            ['undefined', undefined], [[FULL], FULL], [{ token: FULL }, FULL], [42, '42']]) {
            expect(tokenMatches(presented, expected)).toBe(false);
        }
    });
});

describe('opsAccess', () => {
    const req = ({ method = 'GET', header, query = {} } = {}) => ({ method, query, get: name => (name.toLowerCase() === HEADER ? header : undefined) });

    test('the full token: from the header always, from the URL only where the route reads it', () => {
        expect(opsAccess(req({ header: FULL }))).toBe('full');
        expect(opsAccess(req({ method: 'POST', header: FULL }))).toBe('full');
        expect(opsAccess(req({ query: { token: FULL } }))).toBe(null);
        expect(opsAccess(req({ query: { token: FULL } }), { query: true })).toBe('full');
    });

    test('the read token: a GET or HEAD that asks for it, from the header, and nothing more', () => {
        expect(opsAccess(req({ header: READ }), { read: true })).toBe('read');
        expect(opsAccess(req({ method: 'HEAD', header: READ }), { read: true })).toBe('read');
        expect(opsAccess(req({ header: READ }))).toBe(null);
        expect(opsAccess(req({ header: READ }), { query: true })).toBe(null);
        for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) expect(opsAccess(req({ method, header: READ }), { read: true, query: true })).toBe(null);
        expect(opsAccess(req({ query: { token: READ } }), { read: true, query: true })).toBe(null);
    });

    test('with no read token configured, nothing is a read token', () => {
        delete process.env.ANALYSIS_READ_TOKEN;
        expect(opsAccess(req({ header: READ }), { read: true })).toBe(null);
        expect(opsAccess(req({ header: '' }), { read: true })).toBe(null);
        expect(opsAccess(req({ header: FULL }), { read: true })).toBe('full');
    });

    test('with no full token configured, only the read token opens anything, and only where it may', () => {
        delete process.env.ANALYSIS_API_TOKEN;
        expect(opsAccess(req({ header: FULL }), { read: true, query: true })).toBe(null);
        expect(opsAccess(req({ query: { token: '' } }), { query: true })).toBe(null);
        expect(opsAccess(req({ header: READ }), { read: true })).toBe('read');
    });
});

describe('requireOpsToken on a real Express app', () => {
    let server, base;
    const ran = [];

    beforeAll(async () => {
        const app = express();
        const handler = name => (req, res) => { ran.push(name); res.json({ access: req.opsAccess }); };
        app.get('/probe', requireOpsToken({ query: true, read: true }), handler('probe'));          // like /api/ops/version
        app.get('/header-probe', requireOpsToken({ read: true }), handler('header-probe'));         // like /api/ops/schedule-stats
        app.get('/feed', requireOpsToken({ query: true }), handler('feed'));                        // like /api/signals/screened-today
        app.post('/trigger', requireOpsToken({ query: true }), handler('trigger'));                 // like /api/ops/eod-summary
        app.post('/misread', requireOpsToken({ query: true, read: true }), handler('misread'));     // a POST that asks for the read token
        server = http.createServer(app);
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        base = `http://127.0.0.1:${server.address().port}`;
    });
    afterAll(() => new Promise(resolve => server.close(resolve)));
    beforeEach(() => { ran.length = 0; });

    const call = (method, url, token) => new Promise((resolve, reject) => {
        const request = http.request(base + url, { method, headers: token === undefined ? {} : { [HEADER]: token } }, res => {
            let text = '';
            res.on('data', chunk => { text += chunk; });
            res.on('end', () => { let json; try { json = JSON.parse(text); } catch (e) { json = undefined; } resolve({ status: res.statusCode, json }); });
        });
        request.on('error', reject);
        request.end();
    });
    const ROUTES = [['GET', '/probe'], ['GET', '/header-probe'], ['GET', '/feed'], ['POST', '/trigger'], ['POST', '/misread']];

    test('no token, or a wrong one: 401 on every route, and no handler runs', async () => {
        for (const [method, url] of ROUTES) {
            expect(await call(method, url)).toEqual({ status: 401, json: { error: 'Unauthorized' } });
            expect((await call(method, url, 'wrong')).status).toBe(401);
        }
        expect(ran).toEqual([]);
    });

    test('the full token in the header opens every route', async () => {
        for (const [method, url] of ROUTES) expect(await call(method, url, FULL)).toEqual({ status: 200, json: { access: 'full' } });
        expect(ran).toEqual(['probe', 'header-probe', 'feed', 'trigger', 'misread']);
    });

    test('the full token in the URL (legacy): where the route still reads ?token=, and nowhere else', async () => {
        const q = `?token=${FULL}`;
        expect((await call('GET', '/probe' + q)).status).toBe(200);
        expect((await call('GET', '/feed' + q)).status).toBe(200);
        expect((await call('POST', '/trigger' + q)).status).toBe(200);
        expect((await call('GET', '/header-probe' + q)).status).toBe(401);
        expect((await call('GET', `/probe?token=${FULL}&token=${FULL}`)).status).toBe(401);   // a repeated ?token= is an array: refused, not a crash
    });

    test('the read token opens the read-only GET probes, from the header', async () => {
        expect(await call('GET', '/probe', READ)).toEqual({ status: 200, json: { access: 'read' } });
        expect(await call('GET', '/header-probe', READ)).toEqual({ status: 200, json: { access: 'read' } });
        expect((await call('HEAD', '/probe', READ)).status).toBe(200);
    });

    test('the read token never opens a POST, even one that asks for it, nor a GET that did not ask', async () => {
        expect((await call('POST', '/trigger', READ)).status).toBe(401);
        expect((await call('POST', '/misread', READ)).status).toBe(401);
        expect((await call('GET', '/feed', READ)).status).toBe(401);
        expect(ran).toEqual([]);
    });

    test('the read token is never read from the URL', async () => {
        expect((await call('GET', `/probe?token=${READ}`)).status).toBe(401);
        expect((await call('GET', `/header-probe?token=${READ}`)).status).toBe(401);
        expect(ran).toEqual([]);
    });
});

describe('server.js wiring', () => {
    const SERVER = read('server.js');
    // app.<method>('<path>', <the rest of the line>
    const TOKEN_ROUTES = [...SERVER.matchAll(/^app\.(get|post|put|patch|delete)\('(\/api\/ops\/[^']+|\/api\/signals\/screened-today|\/api\/scanner\/run)',([^\n]*)$/gm)]
        .map(m => ({ route: `${m[1].toUpperCase()} ${m[2]}`, rest: m[3] }));
    const names = list => list.map(r => r.route).sort();

    test('control: the routes are found', () => {
        expect(TOKEN_ROUTES.length).toBe(14);
        expect(names(TOKEN_ROUTES)).toEqual(expect.arrayContaining(['GET /api/ops/version', 'POST /api/ops/eod-summary', 'GET /api/signals/screened-today']));
    });

    test('every one goes through requireOpsToken', () => {
        expect(TOKEN_ROUTES.filter(r => !/^ requireOpsToken\(/.test(r.rest)).map(r => r.route)).toEqual([]);
    });

    test('the read token opens exactly the seven read-only GET /api/ops probes', () => {
        expect(names(TOKEN_ROUTES.filter(r => /read: true/.test(r.rest)))).toEqual([
            'GET /api/ops/alert-prefs-stats', 'GET /api/ops/conviction-stats', 'GET /api/ops/exit-checks-stats',
            'GET /api/ops/schedule-stats', 'GET /api/ops/sessions-stats', 'GET /api/ops/telegram-stats', 'GET /api/ops/version'
        ]);
    });

    test('the routes that still read the full token from the URL, until the owner\'s routine sends the header', () => {
        expect(names(TOKEN_ROUTES.filter(r => /query: true/.test(r.rest)))).toEqual([
            'GET /api/ops/alert-prefs-stats', 'GET /api/ops/conviction-stats', 'GET /api/ops/exit-checks-stats', 'GET /api/ops/version',
            'GET /api/signals/screened-today', 'POST /api/ops/conviction-sweep', 'POST /api/ops/eod-summary', 'POST /api/ops/prune-exit-checks',
            'POST /api/ops/reconcile-capital', 'POST /api/ops/reset-day-trades', 'POST /api/scanner/run'
        ]);
    });

    test('no route compares a token by hand: the tokens are read in lib/shared/ops-auth.js only', () => {
        const runtime = ['server.js', 'database-postgres.js', 'config', 'routes', 'middleware', 'lib', 'ml'];
        const files = rel => {
            const abs = path.join(ROOT, rel);
            if (!fs.existsSync(abs)) return [];
            if (fs.statSync(abs).isFile()) return rel.endsWith('.js') ? [rel] : [];
            return fs.readdirSync(abs).filter(n => !n.startsWith('.')).flatMap(n => files(path.posix.join(rel, n)));
        };
        const readers = runtime.flatMap(files).filter(rel => /process\.env\.ANALYSIS_(API|READ)_TOKEN\b|['"]x-analysis-token['"]/.test(read(rel)));
        expect(readers).toEqual(['lib/shared/ops-auth.js']);
    });
});
