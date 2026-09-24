/**
 * express-session store on the app's own Postgres pool.
 *
 * Sessions used to live in express-session's default MemoryStore: every deploy and every restart
 * signed every user out, and the store grows without bound in a long-lived process. Here each
 * session is one row of user_sessions (sid, sess JSONB, expire), so a signed-in user stays signed
 * in until the cookie expires, across restarts and across Render's deploys.
 *
 * - The table is created here, idempotently, before the first read or write (README rule 16), and a
 *   failed attempt is retried by the next operation.
 * - get() ignores a row past its expiry; expired rows are deleted every 15 minutes (timer unref'd).
 * - touch() only ever pushes the expiry later, so an unchanged session costs no write per request
 *   unless the cookie itself rolls.
 * - Errors go to express-session's callback, which answers that request with an error.
 */
const session = require('express-session');

const TABLE = 'user_sessions';
const PRUNE_EVERY_MS = 15 * 60 * 1000;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

class PgSessionStore extends session.Store {
    /**
     * @param {object} options
     * @param {object} options.pool         a pg Pool (query(text, values) -> Promise<{rows, rowCount}>)
     * @param {number} [options.ttlMs]      lifetime of a session whose cookie has no expiry
     * @param {number} [options.pruneEveryMs]  0 turns the prune timer off (tests)
     */
    constructor({ pool, ttlMs = DEFAULT_TTL_MS, pruneEveryMs = PRUNE_EVERY_MS } = {}) {
        super();
        if (!pool || typeof pool.query !== 'function') throw new Error('PgSessionStore needs a pg pool');
        this.pool = pool;
        this.ttlMs = ttlMs;
        this.readyPromise = null;
        this.ready().catch(error => console.error('❌ [SESSIONS] Could not create the session table yet:', error.message));
        if (pruneEveryMs > 0) {
            this.pruneTimer = setInterval(() => this.prune().catch(() => {}), pruneEveryMs);
            if (typeof this.pruneTimer.unref === 'function') this.pruneTimer.unref();
        }
    }

    /**
     * The table exists. A failure is not cached: the next operation tries again, so a database that was
     * down at boot does not break sessions until the next restart.
     */
    ready() {
        if (!this.readyPromise) {
            this.readyPromise = this.pool.query(
                `CREATE TABLE IF NOT EXISTS ${TABLE} (
                    sid VARCHAR(255) PRIMARY KEY,
                    sess JSONB NOT NULL,
                    expire TIMESTAMPTZ NOT NULL
                )`
            )
                .then(() => this.pool.query(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_expire ON ${TABLE} (expire)`))
                .catch(error => { this.readyPromise = null; throw error; });
        }
        return this.readyPromise;
    }

    expiryOf(sess) {
        const cookieExpiry = sess && sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires) : null;
        return cookieExpiry && !Number.isNaN(cookieExpiry.getTime()) ? cookieExpiry : new Date(Date.now() + this.ttlMs);
    }

    // Promise work, callback answer - handed over on the next tick (as util.callbackify does), so an
    // error thrown by the callback is not swallowed into a rejected promise
    run(work, callback) {
        const done = typeof callback === 'function' ? callback : () => {};
        this.ready().then(work).then(
            result => process.nextTick(done, null, result),
            error => process.nextTick(done, error)
        );
    }

    get(sid, callback) {
        this.run(async () => {
            const { rows } = await this.pool.query(`SELECT sess FROM ${TABLE} WHERE sid = $1 AND expire > NOW()`, [sid]);
            return rows.length ? rows[0].sess : null;
        }, callback);
    }

    set(sid, sess, callback) {
        this.run(async () => {
            await this.pool.query(
                `INSERT INTO ${TABLE} (sid, sess, expire) VALUES ($1, $2, $3)
                 ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
                [sid, JSON.stringify(sess), this.expiryOf(sess)]
            );
        }, callback);
    }

    destroy(sid, callback) {
        this.run(async () => {
            await this.pool.query(`DELETE FROM ${TABLE} WHERE sid = $1`, [sid]);
        }, callback);
    }

    touch(sid, sess, callback) {
        this.run(async () => {
            await this.pool.query(`UPDATE ${TABLE} SET expire = $2 WHERE sid = $1 AND expire < $2`, [sid, this.expiryOf(sess)]);
        }, callback);
    }

    /** Delete expired rows. Returns how many went. */
    async prune() {
        await this.ready();
        const { rowCount } = await this.pool.query(`DELETE FROM ${TABLE} WHERE expire < NOW()`);
        return rowCount;
    }

    /** Stop the prune timer (tests, shutdown). */
    close() {
        if (this.pruneTimer) clearInterval(this.pruneTimer);
    }
}

module.exports = { PgSessionStore, TABLE };
