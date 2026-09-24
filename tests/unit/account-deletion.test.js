/**
 * @jest-environment node
 *
 * lib/shared/account-deletion.js: one deletion for the account's own GDPR delete and the admin's.
 * The admin route used to delete the users row alone; the account's rows stayed, its sessions stayed
 * signed in, and the next signed-in request re-created the account. The endpoint harness runs both
 * routes against Postgres; these tests pin the order of the statements and the rules around them.
 */
const AccountDeletion = require('../../lib/shared/account-deletion');
const { ADMIN_EMAILS } = require('../../middleware/admin-auth');

/** A pool whose one client records every statement and answers from `answers` */
function fakePool({ userExists = true, subscriptions = [], payments = [], missingTables = [], failOn = null, rollbackFails = false } = {}) {
    const statements = [];
    const client = {
        released: [],
        async query(sql, params) {
            const text = typeof sql === 'string' ? sql.replace(/\s+/g, ' ').trim() : sql.text;
            statements.push({ text, params });
            if (rollbackFails && text === 'ROLLBACK') throw new Error('connection lost');
            if (failOn && text.startsWith(failOn)) throw Object.assign(new Error('refused'), { code: '23503' });
            const table = (text.match(/(?:FROM|INTO) (\w+)/) || [])[1];
            if (missingTables.includes(table)) throw Object.assign(new Error(`relation "${table}" does not exist`), { code: '42P01' });
            if (text.startsWith('SELECT email FROM users')) return { rows: userExists ? [{ email: params[0] }] : [] };
            if (text.startsWith('SELECT * FROM user_subscriptions')) return { rows: subscriptions };
            if (text.startsWith('SELECT * FROM payment_transactions')) return { rows: payments };
            if (text.startsWith('SELECT telegram_chat_id')) return { rows: [{ telegram_chat_id: null }] };
            return { rows: [], rowCount: 0 };
        },
        release(error) { this.released.push(error); }
    };
    return { statements, client, pool: { connect: async () => client } };
}

const texts = (statements) => statements.map(s => s.text);
const index = (statements, prefix) => texts(statements).findIndex(t => t.startsWith(prefix));

describe('deleteAccount', () => {
    test('deletes every row the account owns in one transaction, children first, the users row last but for the audit copies', async () => {
        const { statements, client, pool } = fakePool();
        const result = await AccountDeletion.deleteAccount({ pool, email: 'gone@e2e.invalid', requestedBy: 'gone@e2e.invalid' });

        expect(result).toEqual({ found: true, financialRecordsRetained: false });
        const all = texts(statements);
        expect(all[0]).toBe('BEGIN');
        expect(all[all.length - 1]).toBe('COMMIT');
        const users = index(statements, 'DELETE FROM users');
        for (const child of ['DELETE FROM trades', 'DELETE FROM alert_preferences', 'DELETE FROM portfolio_capital',
            'DELETE FROM user_settings', 'DELETE FROM push_subscriptions', 'DELETE FROM payment_transactions',
            'DELETE FROM subscription_history', 'DELETE FROM user_subscriptions']) {
            expect(index(statements, child)).toBeGreaterThan(-1);
            expect(index(statements, child)).toBeLessThan(users);
        }
        // payment_transactions references user_subscriptions without ON DELETE CASCADE
        expect(index(statements, 'DELETE FROM payment_transactions')).toBeLessThan(index(statements, 'DELETE FROM user_subscriptions'));
        for (const table of AccountDeletion.AUDIT_COPY_TABLES) {
            expect(index(statements, `DELETE FROM ${table}`)).toBeGreaterThan(users);
        }
        expect(client.released).toEqual([undefined]);
    });

    test('the audit entry names who asked: the account itself, or the admin', async () => {
        const own = fakePool();
        await AccountDeletion.deleteAccount({ pool: own.pool, email: 'gone@e2e.invalid', requestedBy: 'gone@e2e.invalid', ipAddress: '127.0.0.1' });
        const ownAudit = own.statements.find(s => s.text.startsWith('INSERT INTO admin_activity_log'));
        expect(ownAudit.params.slice(0, 5)).toEqual(['gone@e2e.invalid', 'account_deletion', 'User requested account deletion', 'user', 'gone@e2e.invalid']);
        expect(ownAudit.params[6]).toBe('127.0.0.1');

        const admin = fakePool();
        await AccountDeletion.deleteAccount({ pool: admin.pool, email: 'gone@e2e.invalid', requestedBy: 'boss@e2e.invalid', byAdmin: true });
        const adminAudit = admin.statements.find(s => s.text.startsWith('INSERT INTO admin_activity_log'));
        expect(adminAudit.params.slice(0, 5)).toEqual(['boss@e2e.invalid', 'account_deletion', 'Admin deleted the account', 'user', 'gone@e2e.invalid']);
    });

    test('the admin deleting an account that does not exist changes nothing', async () => {
        const { statements, client, pool } = fakePool({ userExists: false });
        const result = await AccountDeletion.deleteAccount({ pool, email: 'nobody@e2e.invalid', requestedBy: 'boss@e2e.invalid', byAdmin: true });

        expect(result).toEqual({ found: false, financialRecordsRetained: false });
        expect(texts(statements)).toEqual(['BEGIN', 'SELECT email FROM users WHERE email = $1 FOR UPDATE', 'ROLLBACK']);
        expect(client.released).toEqual([undefined]);
    });

    test("the account's own delete still removes whatever rows carry its email when the users row is missing", async () => {
        const { statements, pool } = fakePool({ userExists: false });
        const result = await AccountDeletion.deleteAccount({ pool, email: 'gone@e2e.invalid', requestedBy: 'gone@e2e.invalid' });

        expect(result.found).toBe(false);
        expect(index(statements, 'DELETE FROM trades')).toBeGreaterThan(-1);
        expect(texts(statements).pop()).toBe('COMMIT');
    });

    test('only money makes a financial record: a free trial is not archived, a payment is', async () => {
        const trial = fakePool({ subscriptions: [{ billing_cycle: 'trial', amount_paid: '0.00', stripe_subscription_id: null }] });
        expect((await AccountDeletion.deleteAccount({ pool: trial.pool, email: 'gone@e2e.invalid', requestedBy: 'gone@e2e.invalid' }))
            .financialRecordsRetained).toBe(false);
        expect(index(trial.statements, 'INSERT INTO deleted_user_financial_records')).toBe(-1);

        const paid = fakePool({ payments: [{ transaction_id: 'txn-1', amount: '9.99' }] });
        expect((await AccountDeletion.deleteAccount({ pool: paid.pool, email: 'gone@e2e.invalid', requestedBy: 'boss@e2e.invalid', byAdmin: true }))
            .financialRecordsRetained).toBe(true);
        const archive = paid.statements.find(s => s.text.startsWith('INSERT INTO deleted_user_financial_records'));
        expect(archive.params[0]).toBe('gone@e2e.invalid');
        expect(archive.params[3]).toBe('boss@e2e.invalid');   // deletion_requested_by
        expect(JSON.parse(archive.params[2]).paymentTransactions).toEqual([{ transaction_id: 'txn-1', amount: '9.99' }]);
    });

    test('a table this database never got is skipped in its own savepoint', async () => {
        const { statements, pool } = fakePool({ missingTables: ['subscription_grants'] });
        await expect(AccountDeletion.deleteAccount({ pool, email: 'gone@e2e.invalid', requestedBy: 'gone@e2e.invalid' }))
            .resolves.toMatchObject({ found: true });
        const at = index(statements, 'DELETE FROM subscription_grants');
        expect(texts(statements).slice(at - 1, at + 3)).toEqual(['SAVEPOINT gdpr_step', 'DELETE FROM subscription_grants WHERE user_email = $1',
            'ROLLBACK TO SAVEPOINT gdpr_step', 'RELEASE SAVEPOINT gdpr_step']);
        expect(texts(statements).pop()).toBe('COMMIT');
    });

    test('any other failure rolls the whole deletion back and rejects', async () => {
        const { statements, client, pool } = fakePool({ failOn: 'DELETE FROM users' });
        await expect(AccountDeletion.deleteAccount({ pool, email: 'gone@e2e.invalid', requestedBy: 'gone@e2e.invalid' }))
            .rejects.toMatchObject({ code: '23503' });
        expect(texts(statements).pop()).toBe('ROLLBACK');
        expect(index(statements, 'COMMIT')).toBe(-1);
        expect(client.released).toEqual([undefined]);
    });

    test('a connection that cannot even roll back is released as broken', async () => {
        const { client, pool } = fakePool({ failOn: 'DELETE FROM users', rollbackFails: true });
        await expect(AccountDeletion.deleteAccount({ pool, email: 'gone@e2e.invalid', requestedBy: 'gone@e2e.invalid' })).rejects.toThrow('refused');
        expect(client.released[0]).toBeInstanceOf(Error);
    });

    test('the admin account is never deleted', async () => {
        const { statements, pool } = fakePool();
        await expect(AccountDeletion.deleteAccount({ pool, email: ADMIN_EMAILS[0], requestedBy: ADMIN_EMAILS[0], byAdmin: true }))
            .rejects.toThrow('The admin account cannot be deleted');
        expect(statements).toEqual([]);
    });
});

describe('isProtectedAccount', () => {
    const saved = process.env.ADMIN_EMAIL;
    afterEach(() => {
        if (saved === undefined) delete process.env.ADMIN_EMAIL;
        else process.env.ADMIN_EMAIL = saved;
    });

    test('the admin guard list, in any case, and ADMIN_EMAIL (the house book) are protected', () => {
        delete process.env.ADMIN_EMAIL;
        expect(AccountDeletion.isProtectedAccount(ADMIN_EMAILS[0])).toBe(true);
        expect(AccountDeletion.isProtectedAccount(` ${ADMIN_EMAILS[0].toUpperCase()} `)).toBe(true);
        expect(AccountDeletion.isProtectedAccount('someone@e2e.invalid')).toBe(false);
        expect(AccountDeletion.isProtectedAccount(undefined)).toBe(false);
        process.env.ADMIN_EMAIL = 'house@e2e.invalid';
        expect(AccountDeletion.isProtectedAccount('house@e2e.invalid')).toBe(true);
    });
});

describe('endAccountSessions', () => {
    test('the Postgres store ends every session of the account in one call and says how many', async () => {
        const calls = [];
        const store = { destroyUserSessions: (email, cb) => { calls.push(email); cb(null, 2); } };
        await expect(AccountDeletion.endAccountSessions(store, 'gone@e2e.invalid')).resolves.toBe(2);
        expect(calls).toEqual(['gone@e2e.invalid']);
    });

    test('a store without it: every session whose passport user is the account is destroyed', async () => {
        const destroyed = [];
        const store = {
            all: cb => cb(null, {
                a: { passport: { user: { email: 'gone@e2e.invalid' } } },
                b: { passport: { user: { email: 'stays@e2e.invalid' } } },
                c: {}
            }),
            destroy: sid => destroyed.push(sid)
        };
        await expect(AccountDeletion.endAccountSessions(store, 'gone@e2e.invalid')).resolves.toBe(1);
        expect(destroyed).toEqual(['a']);
    });

    test('never rejects: the account is already gone', async () => {
        const failing = { destroyUserSessions: (email, cb) => cb(new Error('database down')) };
        await expect(AccountDeletion.endAccountSessions(failing, 'gone@e2e.invalid')).resolves.toBeNull();
        await expect(AccountDeletion.endAccountSessions(undefined, 'gone@e2e.invalid')).resolves.toBeNull();
    });
});

describe('clientAddress', () => {
    test('an IP address, or null for anything the INET columns would refuse', () => {
        expect(AccountDeletion.clientAddress({ ip: '203.0.113.9' })).toBe('203.0.113.9');
        expect(AccountDeletion.clientAddress({ ip: '::1' })).toBe('::1');
        expect(AccountDeletion.clientAddress({ ip: 'not-an-ip' })).toBeNull();
        expect(AccountDeletion.clientAddress({})).toBeNull();
    });
});
