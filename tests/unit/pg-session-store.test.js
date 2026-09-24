/**
 * lib/shared/pg-session-store.js - express-session sessions as rows of user_sessions, driven with a fake
 * pool. The harness (tests/endpoints/harness.test.js) proves the real thing: a second server on the same
 * database reads a session the first one wrote.
 */

const { PgSessionStore, TABLE } = require('../../lib/shared/pg-session-store');

function fakePool({ failCreates = 0 } = {}) {
    const rows = new Map();      // sid -> { sess (JSON text), expire (Date) }
    let creates = 0;
    return {
        rows,
        async query(text, values = []) {
            const q = text.replace(/\s+/g, ' ').trim();
            if (q.startsWith('CREATE TABLE')) {
                creates++;
                if (creates <= failCreates) throw new Error('the database is not up yet');
                return { rows: [], rowCount: 0 };
            }
            if (q.startsWith('CREATE INDEX')) return { rows: [], rowCount: 0 };
            if (q.startsWith('SELECT sess')) {
                const r = rows.get(values[0]);
                return { rows: r && r.expire > new Date() ? [{ sess: JSON.parse(r.sess) }] : [] };
            }
            if (q.startsWith('INSERT INTO')) { rows.set(values[0], { sess: values[1], expire: values[2] }); return { rowCount: 1 }; }
            if (q.startsWith(`DELETE FROM ${TABLE} WHERE sid`)) return { rowCount: rows.delete(values[0]) ? 1 : 0 };
            if (q.startsWith('UPDATE')) {
                const r = rows.get(values[0]);
                if (r && r.expire < values[1]) { r.expire = values[1]; return { rowCount: 1 }; }
                return { rowCount: 0 };
            }
            if (q.startsWith(`DELETE FROM ${TABLE} WHERE expire`)) {
                let n = 0;
                for (const [sid, r] of rows) if (r.expire < new Date()) { rows.delete(sid); n++; }
                return { rowCount: n };
            }
            throw new Error('unexpected query: ' + q);
        }
    };
}

/** Call a callback-style store method as a promise */
const call = (store, method, ...args) => new Promise((resolve, reject) =>
    store[method](...args, (error, value) => (error ? reject(error) : resolve(value))));

const HOUR = 60 * 60 * 1000;
const sessionFor = (email, expires) => ({ cookie: { expires, originalMaxAge: 24 * HOUR, httpOnly: true, path: '/' }, passport: { user: { email } } });

beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

test('a stored session comes back, and its row expires with the cookie', async () => {
    const pool = fakePool();
    const store = new PgSessionStore({ pool, pruneEveryMs: 0 });
    const expires = new Date(Date.now() + 24 * HOUR);
    await call(store, 'set', 'sid-1', sessionFor('user@e2e.invalid', expires));
    const back = await call(store, 'get', 'sid-1');
    expect(back.passport.user.email).toBe('user@e2e.invalid');
    expect(pool.rows.get('sid-1').expire.getTime()).toBe(expires.getTime());
});

test('an unknown or expired session reads as none', async () => {
    const pool = fakePool();
    const store = new PgSessionStore({ pool, pruneEveryMs: 0 });
    await expect(call(store, 'get', 'nobody')).resolves.toBeNull();
    await call(store, 'set', 'old', sessionFor('old@e2e.invalid', new Date(Date.now() - HOUR)));
    await expect(call(store, 'get', 'old')).resolves.toBeNull();
});

test('a session without an expiry lives for the store ttl', async () => {
    const pool = fakePool();
    const store = new PgSessionStore({ pool, pruneEveryMs: 0, ttlMs: 2 * HOUR });
    const before = Date.now();
    await call(store, 'set', 'sid-2', { cookie: {}, passport: { user: { email: 'u@e2e.invalid' } } });
    const expire = pool.rows.get('sid-2').expire.getTime();
    expect(expire).toBeGreaterThanOrEqual(before + 2 * HOUR);
    expect(expire).toBeLessThan(before + 2 * HOUR + 5000);
});

test('destroy removes the row', async () => {
    const pool = fakePool();
    const store = new PgSessionStore({ pool, pruneEveryMs: 0 });
    await call(store, 'set', 'sid-3', sessionFor('u@e2e.invalid', new Date(Date.now() + HOUR)));
    await call(store, 'destroy', 'sid-3');
    expect(pool.rows.has('sid-3')).toBe(false);
});

test('touch only ever pushes the expiry later', async () => {
    const pool = fakePool();
    const store = new PgSessionStore({ pool, pruneEveryMs: 0 });
    const t = new Date(Date.now() + 10 * HOUR);
    await call(store, 'set', 'sid-4', sessionFor('u@e2e.invalid', t));
    await call(store, 'touch', 'sid-4', sessionFor('u@e2e.invalid', new Date(Date.now() + HOUR)));
    expect(pool.rows.get('sid-4').expire.getTime()).toBe(t.getTime());
    const later = new Date(Date.now() + 20 * HOUR);
    await call(store, 'touch', 'sid-4', sessionFor('u@e2e.invalid', later));
    expect(pool.rows.get('sid-4').expire.getTime()).toBe(later.getTime());
});

test('prune deletes expired rows only and says how many', async () => {
    const pool = fakePool();
    const store = new PgSessionStore({ pool, pruneEveryMs: 0 });
    await call(store, 'set', 'live', sessionFor('a@e2e.invalid', new Date(Date.now() + HOUR)));
    await call(store, 'set', 'dead-1', sessionFor('b@e2e.invalid', new Date(Date.now() - HOUR)));
    await call(store, 'set', 'dead-2', sessionFor('c@e2e.invalid', new Date(Date.now() - 2 * HOUR)));
    await expect(store.prune()).resolves.toBe(2);
    expect([...pool.rows.keys()]).toEqual(['live']);
});

test('a table that could not be created at boot is created by the next operation', async () => {
    const pool = fakePool({ failCreates: 1 });
    const store = new PgSessionStore({ pool, pruneEveryMs: 0 });
    await new Promise(resolve => setTimeout(resolve, 0));      // the boot attempt fails and is logged
    expect(console.error).toHaveBeenCalled();
    await call(store, 'set', 'sid-5', sessionFor('u@e2e.invalid', new Date(Date.now() + HOUR)));
    await expect(call(store, 'get', 'sid-5')).resolves.toMatchObject({ passport: { user: { email: 'u@e2e.invalid' } } });
});

test('a store without a pool refuses to start', () => {
    expect(() => new PgSessionStore({})).toThrow(/pg pool/);
});
