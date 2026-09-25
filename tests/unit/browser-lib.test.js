/**
 * /lib serves the browser-shared modules and nothing else (middleware/browser-lib.js)
 *
 * Until 2026-09-20 server.js mounted the whole lib/ directory as static files ahead of
 * the auth gate: the scanner, the trade executor and the Telegram bot were readable by
 * anonymous visitors. Pinned down here:
 *   1. The list is what the pages really load: every lib/ file a page asks for is on it
 *      (the tripwire for the next page), and every listed file is written for the browser.
 *   2. Only listed files are served, by exact URL. Server source, the rest of lib/shared,
 *      and every spelling a filesystem would resolve but the table does not ("..", %2e,
 *      doubled slashes, another case) are a 404 - even with a static mount of the whole
 *      directory further down the stack.
 *   3. The guard mounted in front decides who gets anything at all: an anonymous request
 *      is turned away the same way whether the file is listed, unlisted or non-existent.
 *   4. A listed file that is not on disk yet is a 404, not a 500.
 *   5. server.js is wired that way: one /lib mount with ensureAuthenticated first, no
 *      static mount of lib/ anywhere, and no /lib/ in the gate's public allow-list.
 *
 * Requests go through node's http client, which sends the path as written. fetch and
 * curl normalise ".." before sending, and would test nothing.
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const express = require('express');
const { browserLib, BROWSER_LIB_FILES } = require('../../middleware/browser-lib');

// jest.config.js runs every suite under jsdom, which has no setImmediate - and Express's
// res.sendFile needs it to finish a response. This suite gets node's own.
global.setImmediate = global.setImmediate || require('timers').setImmediate;

const REPO = path.join(__dirname, '..', '..');
const LIB = path.join(REPO, 'lib');
const PUBLIC = path.join(REPO, 'public');

// On main today. backtest-stop.js and trailing-stop.js are listed ahead of their arrival.
const LIVE = ['shared/strategy-params.js', 'shared/stock-data.js', 'shared/dti-calculator.js', 'shared/backtest-calculator.js'];

// Server source that the old mount handed to anyone. Each must exist, or its 404 proves nothing.
const SERVER_ONLY = [
    'scanner/scanner.js',
    'scheduler/trade-executor.js',
    'telegram/telegram-bot.js',
    'portfolio/exit-monitor.js',
    'shared/frontend-backtest-calculator.js', // exports to window, but only the 7 AM scanner loads it
    'shared/price-unit-repair.js',
    'shared/stale-fill-repair.js',
    'shared/market-cap-service.js',
    'shared/date-format.js'
];

/** Every lib/ file the pages under public/ ask for, as a path relative to lib/ */
function libFilesLoadedByPages() {
    const loaded = new Map();
    for (const page of fs.readdirSync(PUBLIC).filter(name => name.endsWith('.html'))) {
        const html = fs.readFileSync(path.join(PUBLIC, page), 'utf8');
        for (const [, ref] of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
            let pathname;
            try {
                pathname = new URL(ref, `http://app.test/${page}`).pathname;
            } catch (e) {
                continue;
            }
            if (!pathname.startsWith('/lib/')) continue;
            const file = pathname.slice('/lib/'.length);
            loaded.set(file, [...(loaded.get(file) || []), page]);
        }
    }
    return loaded;
}

const requiresOf = source => [...source.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map(match => match[1]);

/** './dti-calculator' (from a file in lib/shared) -> 'shared/dti-calculator.js' */
const asListed = required => `shared/${required.slice(2).replace(/\.js$/, '')}.js`;

function request(port, rawPath, { method = 'GET', headers = {} } = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request({ host: '127.0.0.1', port, path: rawPath, method, headers, agent: false }, res => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
        });
        req.on('error', reject);
        req.end();
    });
}

/** The /lib part of server.js's stack, followed by the mount that used to be there */
function listen({ signedIn = () => true, files } = {}) {
    const app = express();
    const guard = (req, res, next) => (signedIn() ? next() : res.redirect('/login'));
    app.use('/lib', guard, browserLib(LIB, files));
    app.use('/lib', express.static(LIB));
    return new Promise(resolve => {
        const server = app.listen(0, '127.0.0.1', () => resolve(server));
    });
}

const close = server => new Promise(resolve => server.close(resolve));

describe('the list', () => {
    test('is frozen, and names plain files under shared/ once each', () => {
        expect(Object.isFrozen(BROWSER_LIB_FILES)).toBe(true);
        expect(new Set(BROWSER_LIB_FILES).size).toBe(BROWSER_LIB_FILES.length);
        for (const file of BROWSER_LIB_FILES) {
            expect(file).toMatch(/^shared\/[a-z0-9-]+\.js$/);
        }
    });

    test('covers every lib/ file a page loads', () => {
        const loaded = libFilesLoadedByPages();

        // The scan itself works: both pages that use lib/ are seen
        expect(loaded.get('shared/dti-calculator.js')).toEqual(
            expect.arrayContaining(['trades.html', 'portfolio-backtest.html'])
        );

        const unlisted = [...loaded].filter(([file]) => !BROWSER_LIB_FILES.includes(file));
        expect(unlisted).toEqual([]);
    });

    test('holds only files written for the browser', () => {
        for (const file of LIVE) {
            expect(BROWSER_LIB_FILES).toContain(file);
            expect(fs.existsSync(path.join(LIB, file))).toBe(true);
        }

        for (const file of BROWSER_LIB_FILES.filter(name => fs.existsSync(path.join(LIB, name)))) {
            const source = fs.readFileSync(path.join(LIB, file), 'utf8');

            expect(`${file}: ${/typeof window !== 'undefined'/.test(source)}`).toBe(`${file}: true`);
            expect(`${file}: ${/process\.env/.test(source)}`).toBe(`${file}: false`);

            // Its node-side requires may only reach other listed files
            for (const required of requiresOf(source)) {
                expect(required).toMatch(/^\.\//);
                expect(BROWSER_LIB_FILES).toContain(asListed(required));
            }
        }
    });

    test('the same rules would turn the server-only files away', () => {
        const wouldPass = SERVER_ONLY.filter(file => {
            const source = fs.readFileSync(path.join(LIB, file), 'utf8');
            return /typeof window !== 'undefined'/.test(source)
                && !/process\.env/.test(source)
                && requiresOf(source).every(name => name.startsWith('./') && BROWSER_LIB_FILES.includes(asListed(name)));
        });

        // frontend-backtest-calculator.js is browser-SHAPED; it is off the list because no
        // page loads it. The shape rules cannot say that - only the page scan above can.
        expect(wouldPass.filter(file => file !== 'shared/frontend-backtest-calculator.js')).toEqual([]);
    });
});

describe('server.js', () => {
    const source = fs.readFileSync(path.join(REPO, 'server.js'), 'utf8');

    test('mounts /lib once: signed-in only, through browserLib', () => {
        const mounts = source.match(/app\.use\(\s*['"]\/lib['"][^\n]*/g) || [];

        expect(mounts).toEqual([expect.stringContaining("app.use('/lib', ensureAuthenticated, browserLib(")]);
    });

    test('serves no part of lib/ as a static directory, and does not wave /lib/ past the gate', () => {
        expect(source).not.toMatch(/express\.static\([^)]*['"]lib['"]/);
        expect(source).not.toMatch(/startsWith\(\s*['"]\/lib/);
    });
});

describe('signed in', () => {
    let server, port;

    beforeAll(async () => {
        server = await listen();
        port = server.address().port;
    });

    afterAll(() => close(server));

    test.each(LIVE)('%s is served byte for byte, as javascript', async file => {
        const res = await request(port, `/lib/${file}`);

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/javascript/);
        expect(res.body.equals(fs.readFileSync(path.join(LIB, file)))).toBe(true);
    });

    test('caching is what express.static gave: revalidate every time, 304 on a match', async () => {
        const first = await request(port, '/lib/shared/dti-calculator.js');
        expect(first.headers['cache-control']).toBe('public, max-age=0');
        expect(first.headers.etag).toBeTruthy();
        expect(first.headers['last-modified']).toBeTruthy();

        const again = await request(port, '/lib/shared/dti-calculator.js', { headers: { 'If-None-Match': first.headers.etag } });
        expect(again.status).toBe(304);
        expect(again.body.length).toBe(0);
    });

    test('a query string and HEAD both work', async () => {
        expect((await request(port, '/lib/shared/dti-calculator.js?v=20260920')).status).toBe(200);

        const head = await request(port, '/lib/shared/dti-calculator.js', { method: 'HEAD' });
        expect(head.status).toBe(200);
        expect(head.body.length).toBe(0);
    });

    test.each(SERVER_ONLY)('%s exists, and is a 404', async file => {
        expect(fs.existsSync(path.join(LIB, file))).toBe(true);

        const res = await request(port, `/lib/${file}`);

        expect(res.status).toBe(404);
        expect(JSON.parse(res.body.toString())).toEqual({ error: 'Not Found', path: `/lib/${file}` });
    });

    test.each([
        ['parent directory',            '/lib/shared/../scanner/scanner.js'],
        ['encoded parent directory',    '/lib/shared/%2e%2e/scanner/scanner.js'],
        ['encoded slash',               '/lib/shared/..%2fscanner%2fscanner.js'],
        ['backslash',                   '/lib/shared/..%5cscanner%5cscanner.js'],
        ['parent of the mount',         '/lib/../server.js'],
        ['doubled slash',               '/lib//shared/dti-calculator.js'],
        ['dot segment',                 '/lib/shared/./dti-calculator.js'],
        ['upper-case file',             '/lib/shared/DTI-Calculator.js'],
        ['upper-case directory',        '/lib/SHARED/dti-calculator.js'],
        ['trailing slash',              '/lib/shared/dti-calculator.js/'],
        ['null byte',                   '/lib/shared/dti-calculator.js%00'],
        ['path parameter',              '/lib/shared/dti-calculator.js;x=1'],
        ['encoded listed name',         '/lib/shared/dti%2dcalculator.js'],
        ['the directory',               '/lib/shared/'],
        ['the mount itself',            '/lib'],
        ['the mount with a slash',      '/lib/']
    ])('%s is not served: %s', async (label, rawPath) => {
        const res = await request(port, rawPath);

        expect(res.status).not.toBe(200);
        expect(res.status).not.toBe(304);
        expect(res.body.toString()).not.toMatch(/function|require\(|module\.exports/);
    });

    test('only GET and HEAD read a listed file', async () => {
        for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
            expect(`${method} ${(await request(port, '/lib/shared/dti-calculator.js', { method })).status}`).toBe(`${method} 404`);
        }
    });
});

describe('anonymous', () => {
    let server, port;

    beforeAll(async () => {
        server = await listen({ signedIn: () => false });
        port = server.address().port;
    });

    afterAll(() => close(server));

    test.each([
        ['a listed file',        '/lib/shared/dti-calculator.js'],
        ['server source',        '/lib/scanner/scanner.js'],
        ['a file that is not there', '/lib/nothing/here.js']
    ])('%s: sent to sign in, with the same response', async (label, rawPath) => {
        const res = await request(port, rawPath);

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/login');
        expect(res.body.toString()).not.toMatch(/function|require\(|module\.exports/);
    });
});

describe('a listed file that is not on disk yet', () => {
    let server, port;

    beforeAll(async () => {
        server = await listen({ files: ['shared/dti-calculator.js', 'shared/not-written-yet.js'] });
        port = server.address().port;
    });

    afterAll(() => close(server));

    test('is a 404 in the same shape, and the files beside it still load', async () => {
        const missing = await request(port, '/lib/shared/not-written-yet.js');
        expect(missing.status).toBe(404);
        expect(JSON.parse(missing.body.toString())).toEqual({ error: 'Not Found', path: '/lib/shared/not-written-yet.js' });

        expect((await request(port, '/lib/shared/dti-calculator.js')).status).toBe(200);
    });
});
