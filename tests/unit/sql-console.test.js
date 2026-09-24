/**
 * @jest-environment node
 *
 * lib/shared/sql-console.js: the admin SQL console's read mode. It used to judge the text by its first
 * word, so "WITH d AS (DELETE ...) SELECT", TRUNCATE or "SELECT 1; DROP TABLE x" ran as reads. Now the
 * statement runs in a READ ONLY transaction through the extended protocol (one statement only), and
 * is always rolled back. The endpoint harness checks what Postgres does with it; these tests pin the
 * sequence of calls.
 */
const SqlConsole = require('../../lib/shared/sql-console');

function fakePool({ failOn = null, rollbackFails = false } = {}) {
    const calls = [];
    const client = {
        released: [],
        async query(arg) {
            calls.push(arg);
            const text = typeof arg === 'string' ? arg : arg.text;
            if (rollbackFails && text === 'ROLLBACK') throw new Error('connection lost');
            if (failOn && text.startsWith(failOn)) {
                throw Object.assign(new Error('cannot execute DELETE in a read-only transaction'), { code: '25006' });
            }
            return typeof arg === 'string' ? {} : { rows: [{ one: 1 }], rowCount: 1 };
        },
        release(error) { this.released.push(error); }
    };
    return { calls, client, pool: { connect: async () => client } };
}

describe('capRows', () => {
    test('a SELECT without LIMIT gets one, on its own line, after any trailing semicolon', () => {
        expect(SqlConsole.capRows('SELECT * FROM users')).toBe('SELECT * FROM users\nLIMIT 1000');
        expect(SqlConsole.capRows('  select 1;  ')).toBe('select 1\nLIMIT 1000');
        expect(SqlConsole.capRows('SELECT 1 -- note')).toBe('SELECT 1 -- note\nLIMIT 1000');
    });

    test('anything else is left as written (a trailing semicolon aside)', () => {
        expect(SqlConsole.capRows('SELECT * FROM users LIMIT 5')).toBe('SELECT * FROM users LIMIT 5');
        expect(SqlConsole.capRows('WITH x AS (SELECT 1) SELECT * FROM x;')).toBe('WITH x AS (SELECT 1) SELECT * FROM x');
        expect(SqlConsole.capRows('EXPLAIN SELECT 1')).toBe('EXPLAIN SELECT 1');
    });
});

describe('runReadOnly', () => {
    test('one statement, extended protocol, inside a READ ONLY transaction that is rolled back', async () => {
        const { calls, client, pool } = fakePool();
        await expect(SqlConsole.runReadOnly(pool, 'SELECT 1 AS one')).resolves.toEqual({ rows: [{ one: 1 }], rowCount: 1 });
        expect(calls).toEqual([
            'BEGIN READ ONLY',
            `SET LOCAL statement_timeout = ${SqlConsole.STATEMENT_TIMEOUT_MS}`,
            { text: 'SELECT 1 AS one\nLIMIT 1000', queryMode: 'extended' },
            'ROLLBACK'
        ]);
        expect(client.released).toEqual([undefined]);
    });

    test('a refused statement still rolls back, releases the connection and rejects with the database error', async () => {
        const { calls, client, pool } = fakePool({ failOn: 'WITH' });
        await expect(SqlConsole.runReadOnly(pool, 'WITH d AS (DELETE FROM t RETURNING 1) SELECT * FROM d'))
            .rejects.toMatchObject({ code: '25006' });
        expect(calls[calls.length - 1]).toBe('ROLLBACK');
        expect(client.released).toEqual([undefined]);
    });

    test('a connection that cannot roll back is released as broken', async () => {
        const { client, pool } = fakePool({ rollbackFails: true });
        await SqlConsole.runReadOnly(pool, 'SELECT 1 AS one');
        expect(client.released[0]).toBeInstanceOf(Error);
    });

    test('the statement timeout can be set per call', async () => {
        const { calls, pool } = fakePool();
        await SqlConsole.runReadOnly(pool, 'SELECT 1', { timeoutMs: 1500 });
        expect(calls[1]).toBe('SET LOCAL statement_timeout = 1500');
    });
});
