/**
 * The harness itself: if these fail, no endpoint result means anything.
 */
const fs = require('fs');
const net = require('net');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const h = require('./harness/client');

function freePort() {
    return new Promise((resolve, reject) => {
        const s = net.createServer();
        s.on('error', reject);
        s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
    });
}

function getJSON(url, cookie) {
    return new Promise(resolve => {
        http.get(url, { headers: cookie ? { cookie } : {} }, res => {
            let text = '';
            res.on('data', c => { text += c; });
            res.on('end', () => { let json; try { json = JSON.parse(text); } catch (e) { json = undefined; } resolve({ status: res.statusCode, json }); });
        }).on('error', () => resolve({ status: 0 }));
    });
}

/** A second server on the same scratch database and session secret: what a restart looks like to a session. */
async function startSecondServer(s) {
    const port = await freePort();
    const base = `http://127.0.0.1:${port}`;
    const log = fs.openSync(path.join(s.work, 'server-2.log'), 'a');
    const child = spawn(process.execPath, ['-r', s.preload, 'server.js'], {
        cwd: s.root,
        env: { ...s.env, PORT: String(port), BASE_URL: base, HARNESS_ROUTES_OUT: path.join(s.work, 'routes-runtime-2.json') },
        stdio: ['ignore', log, log]
    });
    const stop = () => {
        child.kill('SIGTERM');
        setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 5000).unref();
    };
    const t0 = Date.now();
    while (Date.now() - t0 < 45000) {
        if (child.exitCode !== null) throw new Error('the second server exited with ' + child.exitCode);
        if ((await getJSON(base + '/health')).status === 200) return { base, stop };
        await new Promise(r => setTimeout(r, 300));
    }
    stop();
    throw new Error('the second server was not ready after 45 s');
}

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

    test('a signed-in session survives a restart: a second server on the same database knows it', async () => {
        const s = h.state();
        const cookie = await h.login('user');
        expect((await getJSON(s.base + '/api/user', cookie)).json).toMatchObject({ authenticated: true });
        const second = await startSecondServer(s);
        try {
            // Sessions are rows in user_sessions, not memory of the process that signed the user in
            expect((await getJSON(second.base + '/api/user', cookie)).json).toMatchObject({ authenticated: true });
            expect((await getJSON(second.base + '/api/user')).json).toMatchObject({ authenticated: false });
        } finally {
            second.stop();
        }
    }, 60000);
});
