/**
 * Account deletion (GDPR Article 17 - Right to Erasure), one implementation for both callers:
 *   DELETE /api/user/delete-account   the signed-in user deletes their own account (server.js)
 *   DELETE /api/admin/users/:email    the admin deletes an account (routes/admin.js)
 *
 * Until 2026-09-24 the admin route deleted only the users row. The account's trades, subscriptions,
 * payments and settings stayed behind, and its sessions stayed signed in: the next request of such a
 * session re-created the users row (server.js ensureUserInDatabase), so the account came back.
 *
 * deleteAccount() is one transaction: archive the payment records the law makes us keep (6 years),
 * delete every row the account owns, then the account itself. Postgres aborts the whole transaction on
 * any error, so a statement that may fail runs in its own savepoint and only that statement is undone.
 * Until 2026-09-24 a swallowed CHECK violation (user_subscriptions has no 'deleted' status) aborted the
 * transaction: every account with a subscription row got a 500 and kept all its data.
 *
 * endAccountSessions() then signs the account out on every device. The caller runs it after the
 * transaction has committed; the self-delete route also logs its own request out first.
 */
'use strict';

const net = require('net');
const { ADMIN_EMAILS } = require('../../middleware/admin-auth');

// The audit triggers of migrations/007 copy every changed trade, preference and profile row
// (row_to_json) into these logs - including the deletions deleteAccount() makes - so they go last.
const AUDIT_COPY_TABLES = ['trade_audit_log', 'alert_preferences_audit_log', 'user_audit_log',
    'trade_audit_log_archive', 'alert_preferences_audit_log_archive', 'user_audit_log_archive'];

/**
 * The admin account owns the house portfolio (the 1 PM executor books every signal to it), so no
 * route deletes it: the admin guard's list plus ADMIN_EMAIL, the house book the executor uses.
 */
function isProtectedAccount(email) {
    const address = String(email || '').trim().toLowerCase();
    return [...ADMIN_EMAILS, process.env.ADMIN_EMAIL].filter(Boolean)
        .some(admin => admin.toLowerCase() === address);
}

/** The request's address when it is one: the INET columns reject anything else. */
function clientAddress(req) {
    const raw = (req && (req.ip || (req.socket && req.socket.remoteAddress))) || '';
    return net.isIP(raw) ? raw : null;
}

/**
 * Delete one account and everything it owns.
 *
 * @param {object} opts
 * @param {object} opts.pool          the app's pg Pool (TradeDB.pool)
 * @param {string} opts.email         the account to delete
 * @param {string} opts.requestedBy   who asked: the account itself, or the admin
 * @param {string} [opts.ipAddress]   the requester's address, kept with the audit entry and the archive
 * @param {boolean} [opts.byAdmin]    the admin deletes someone else's account: when no users row has
 *   that email, nothing changes and found is false. The account's own request deletes whatever rows
 *   carry its email either way, as it always did.
 * @returns {Promise<{found: boolean, financialRecordsRetained: boolean}>}
 */
async function deleteAccount({ pool, email, requestedBy, ipAddress = null, byAdmin = false }) {
    if (isProtectedAccount(email)) {
        throw new Error('The admin account cannot be deleted');
    }

    const client = await pool.connect();

    // One statement in a savepoint. `tolerate(error)` decides whether a failure is fatal; by default
    // only a table this database never got (42P01) is skipped - the subscription, payment and audit
    // tables come from migrations/, not the boot DDL.
    const missingTable = (error) => error.code === '42P01';
    const step = async (sql, params = [email], tolerate = missingTable) => {
        await client.query('SAVEPOINT gdpr_step');
        try {
            const result = await client.query(sql, params);
            await client.query('RELEASE SAVEPOINT gdpr_step');
            return result;
        } catch (error) {
            await client.query('ROLLBACK TO SAVEPOINT gdpr_step');
            await client.query('RELEASE SAVEPOINT gdpr_step');
            if (!tolerate(error)) throw error;
            return { rows: [], rowCount: 0 };
        }
    };

    let found = false;
    let financialRecordsRetained = false;
    let releaseError;
    try {
        await client.query('BEGIN');

        // Locking the account's row makes a second delete of it wait for this one, then find nothing
        const existing = await client.query('SELECT email FROM users WHERE email = $1 FOR UPDATE', [email]);
        found = existing.rows.length > 0;
        if (!found && byAdmin) {
            await client.query('ROLLBACK');
            return { found, financialRecordsRetained };
        }

        // 1. Audit entry for the erasure itself (kept). Best effort: it never blocks the deletion.
        await step(`
            INSERT INTO admin_activity_log (admin_email, activity_type, description, target_type, target_id, metadata, ip_address, success)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            requestedBy,
            'account_deletion',
            byAdmin ? 'Admin deleted the account' : 'User requested account deletion',
            'user',
            email,
            JSON.stringify({
                reason: byAdmin ? 'Deleted from the admin portal' : 'User requested account deletion via data management page',
                timestamp: new Date().toISOString()
            }),
            ipAddress,
            true
        ], (auditError) => {
            console.error('Failed to create audit log:', auditError.message);
            return true;
        });

        // 2. Archive financial records (REQUIRED for 6 years per UK law)
        // Create archive table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS deleted_user_financial_records (
                id SERIAL PRIMARY KEY,
                user_email VARCHAR(255) NOT NULL,
                deletion_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                retention_until TIMESTAMP NOT NULL,
                financial_data JSONB NOT NULL,
                deletion_requested_by VARCHAR(255),
                deletion_ip_address INET,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const financialRecords = {
            paymentTransactions: (await step('SELECT * FROM payment_transactions WHERE user_email = $1')).rows,
            paymentRefunds: (await step('SELECT * FROM payment_refunds WHERE user_email = $1')).rows,
            subscriptions: (await step('SELECT * FROM user_subscriptions WHERE user_email = $1')).rows,
            subscriptionHistory: (await step('SELECT * FROM subscription_history WHERE user_email = $1')).rows,
            paymentVerifications: (await step('SELECT * FROM payment_verification_queue WHERE user_email = $1')).rows
        };

        // Only money makes a financial record: a free trial alone (amount 0, no Stripe id) is not kept.
        const paidSubscription = financialRecords.subscriptions.some(s =>
            Number(s.amount_paid) > 0 || Boolean(s.stripe_subscription_id) || (s.billing_cycle && s.billing_cycle !== 'trial'));
        financialRecordsRetained = financialRecords.paymentTransactions.length > 0 ||
            financialRecords.paymentRefunds.length > 0 || paidSubscription;

        if (financialRecordsRetained) {
            const retentionDate = new Date();
            retentionDate.setFullYear(retentionDate.getFullYear() + 6);

            await client.query(`
                INSERT INTO deleted_user_financial_records (user_email, retention_until, financial_data, deletion_requested_by, deletion_ip_address)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                email,
                retentionDate,
                JSON.stringify(financialRecords),
                requestedBy,
                ipAddress
            ]);
        }

        // 3. Delete everything the account owns, children first: payment_transactions references both
        //    users and user_subscriptions without ON DELETE CASCADE.
        await client.query('DELETE FROM trades WHERE user_id = $1', [email]);   // exit checks + daily rollup cascade
        await client.query('DELETE FROM alert_preferences WHERE user_id = $1', [email]);
        await client.query('DELETE FROM portfolio_capital WHERE user_id = $1', [email]);
        await client.query('DELETE FROM user_settings WHERE user_id = $1', [email]);
        await client.query('DELETE FROM push_subscriptions WHERE user_email = $1', [email]);
        await step('DELETE FROM trade_alerts_sent WHERE user_id = $1');

        // Telegram: the chat keeps its broadcast subscription (its owner can /stop it), unlinked from this account
        const linked = await client.query('SELECT telegram_chat_id FROM users WHERE email = $1', [email]);
        const chatId = linked.rows[0] && linked.rows[0].telegram_chat_id;
        await client.query(
            'UPDATE telegram_subscribers SET user_id = NULL WHERE user_id = $1' + (chatId ? ' OR chat_id = $2' : ''),
            chatId ? [email, String(chatId)] : [email]
        );

        await step('DELETE FROM payment_verification_queue WHERE user_email = $1');
        await step('DELETE FROM payment_refunds WHERE user_email = $1');
        await step('DELETE FROM payment_transactions WHERE user_email = $1');
        await step('DELETE FROM subscription_history WHERE user_email = $1');
        await step('DELETE FROM subscription_grants WHERE user_email = $1');
        await step('DELETE FROM user_subscriptions WHERE user_email = $1');

        // 4. Finally, delete the user record
        await client.query('DELETE FROM users WHERE email = $1', [email]);

        // 5. The copies the audit triggers made of the rows just deleted
        for (const table of AUDIT_COPY_TABLES) {
            await step(`DELETE FROM ${table} WHERE user_email = $1`);
        }

        await client.query('COMMIT');
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            releaseError = rollbackError;   // a broken connection must not go back to the pool
        }
        throw error;
    } finally {
        client.release(releaseError);
    }

    return { found, financialRecordsRetained };
}

/**
 * End every session of the account, on every device: every signed-in request re-creates a missing
 * users row (server.js ensureUserInDatabase), so a session left behind would bring the account back.
 * Never rejects: the account is already gone, so a failure here is only logged.
 *
 * @param {object} store  the session store (req.sessionStore)
 * @param {string} email
 * @returns {Promise<number|null>} how many sessions ended, when the store can tell
 */
async function endAccountSessions(store, email) {
    try {
        if (store && typeof store.destroyUserSessions === 'function') {
            // The Postgres store (lib/shared/pg-session-store.js) ends them in one statement
            return await new Promise((resolve) => store.destroyUserSessions(email, (err, count) => {
                if (err) console.error('Error ending sessions after account deletion:', err.message);
                resolve(err ? null : (Number.isInteger(count) ? count : null));
            }));
        }
        if (store && typeof store.all === 'function') {
            return await new Promise((resolve) => store.all((err, sessions) => {
                let ended = 0;
                if (!err && sessions) {
                    for (const [sid, session] of Object.entries(sessions)) {
                        const owner = session && session.passport && session.passport.user;
                        if (owner && owner.email === email) {
                            store.destroy(sid);
                            ended += 1;
                        }
                    }
                }
                resolve(err ? null : ended);
            }));
        }
    } catch (error) {
        console.error('Error ending sessions after account deletion:', error);
    }
    return null;
}

module.exports = { deleteAccount, endAccountSessions, isProtectedAccount, clientAddress, AUDIT_COPY_TABLES };
