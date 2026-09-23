/**
 * The harness itself: if these fail, no endpoint result means anything.
 */
const fs = require('fs');
const h = require('./harness/client');

describe('harness', () => {
    let report;
    beforeAll(() => { report = JSON.parse(fs.readFileSync(h.state().routesOut, 'utf8')); });

    test('every cron job was intercepted and the stub held', () => {
        expect(report.cronStubHolds).toBe(true);
        expect(report.cronIntercepted).toBeGreaterThanOrEqual(10);
    });

    test('the test login exists only because the harness installed it', () => {
        expect(report.loginInstalled).toBe(true);
    });

    test('the server answers /health', async () => {
        expect((await h.request('anon', 'GET', '/health')).status).toBe(200);
    });

    test('anonymous /api requests stop at the sign-in gate', async () => {
        const r = await h.request('anon', 'GET', '/api/trades');
        expect(r.status).toBe(401);
    });

    test('a signed-in trial user reads their own trades', async () => {
        const r = await h.request('user', 'GET', '/api/trades');
        expect(r.status).toBe(200);
        expect(Array.isArray(r.json)).toBe(true);
        expect(r.json.every(t => t.user_id === undefined || t.user_id === h.state().personas.user)).toBe(true);
    });
});
