/**
 * Every HTTP route has an endpoint spec, and every spec names a real route.
 *
 * Routes are read from the source (server.js plus every router it mounts; the mount table is derived from
 * server.js itself). Specs are tests/endpoints/specs/*.json, which the endpoint harness runs against a live
 * server (npm run test:endpoints). A new route without a spec, a spec for a route that no longer exists, and a
 * removed route coming back all fail here, in the ordinary `npm test`, with no server needed.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const ROUTE = (obj) => new RegExp(`^\\s*${obj}\\.(get|post|put|patch|delete|all)\\(\\s*(['"\`])(\\/[^'"\`]*)\\2`, 'gm');
const join = (prefix, p) => ((prefix === '/' ? '' : prefix) + p).replace(/\/+$/, '') || '/';

function sourceRoutes() {
    const server = read('server.js');
    const routes = new Set();
    for (const m of server.matchAll(ROUTE('app'))) routes.add(`${m[1].toUpperCase()} ${m[3]}`);
    // app.get(['/a', '/b'], ...) registers each path
    for (const m of server.matchAll(/^\s*app\.(get|post|put|patch|delete|all)\(\s*\[([^\]]+)\]/gm)) {
        for (const p of m[2].matchAll(/['"`](\/[^'"`]*)['"`]/g)) routes.add(`${m[1].toUpperCase()} ${p[1]}`);
    }

    // [const|let] xRoutes = require('./routes/x');  ...  app.use('/prefix', xRoutes);
    const requires = new Map([...server.matchAll(/(?:const |let |var )?(\w+) = require\('(\.\/[^']+)'\)/g)].map(m => [m[1], m[2]]));
    const mounts = [...server.matchAll(/app\.use\('([^']+)',\s*(\w+)\)/g)]
        .filter(m => requires.has(m[2]))
        .map(m => ({ prefix: m[1], file: requires.get(m[2]).replace(/^\.\//, '') + '.js' }));
    for (const { prefix, file } of mounts) {
        for (const m of read(file).matchAll(ROUTE('router'))) routes.add(`${m[1].toUpperCase()} ${join(prefix, m[3])}`);
    }
    return { routes, mounts };
}

function specRoutes() {
    const dir = path.join(ROOT, 'tests/endpoints/specs');
    const specs = fs.readdirSync(dir).filter(f => f.endsWith('.json'))
        .flatMap(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).map(s => ({ ...s, file: f })));
    return specs;
}

describe('route-spec coverage', () => {
    const { routes, mounts } = sourceRoutes();
    const specs = specRoutes();
    const live = specs.filter(s => !s.absent).map(s => s.route);
    const removed = specs.filter(s => s.absent).map(s => s.route);

    test('control: the extractor sees inline routes and every mounted router', () => {
        expect(routes.has('GET /health')).toBe(true);
        expect(routes.has('GET /api/trades')).toBe(true);
        expect(mounts.map(m => m.file)).toEqual(expect.arrayContaining(['routes/admin.js', 'routes/auth.js', 'routes/subscription.js', 'ml/ml-routes.js']));
        expect(routes.has('GET /api/admin/users')).toBe(true);
        expect(routes.has('GET /api/ml/conviction/:symbol')).toBe(true);
        expect(routes.size).toBeGreaterThan(100);
    });

    test('no route is specified twice', () => {
        const all = specs.map(s => s.route);
        expect(all.filter((r, i) => all.indexOf(r) !== i)).toEqual([]);
    });

    test('every route in the source has a spec', () => {
        expect([...routes].filter(r => !live.includes(r)).sort()).toEqual([]);
    });

    test('every spec names a route that exists', () => {
        expect(live.filter(r => !routes.has(r)).sort()).toEqual([]);
    });

    test('removed routes stay removed', () => {
        expect(removed.length).toBeGreaterThan(0);
        expect(removed.filter(r => routes.has(r)).sort()).toEqual([]);
    });

    test('every spec case has a persona and an expected status; bug cases say why', () => {
        const personas = ['anon', 'token', 'user', 'nosub', 'admin', 'trial', 'delete', 'victim', 'logout'];
        for (const s of specs) {
            expect(Array.isArray(s.cases) && s.cases.length > 0).toBe(true);
            for (const c of s.cases) {
                expect(personas).toContain(c.as);
                expect(Number.isInteger(c.status)).toBe(true);
                if ('bug' in c) expect(String(c.bug).length).toBeGreaterThan(10);
            }
        }
    });
});
