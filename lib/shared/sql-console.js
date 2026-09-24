/**
 * The admin portal's SQL console (POST /api/admin/database/query), read mode.
 *
 * Read mode runs exactly one statement inside a READ ONLY transaction that is always rolled back, so
 * Postgres itself refuses any write: "cannot execute DELETE in a read-only transaction" (25006). The
 * statement goes through the extended query protocol, which accepts one statement only: "SELECT 1;
 * DELETE ..." is refused whole ("cannot insert multiple commands into a prepared statement").
 *
 * The console used to decide read or write from the first word of the text, so a write that did not
 * start with INSERT, UPDATE, DELETE, DROP, ALTER or CREATE ran in read mode: "WITH d AS (DELETE ...)
 * SELECT", TRUNCATE, GRANT, COPY, or a SELECT followed by a second statement.
 */
'use strict';

const ROW_CAP = 1000;
const STATEMENT_TIMEOUT_MS = 30000;

/**
 * A SELECT without a LIMIT gets LIMIT 1000, on a line of its own so a trailing "-- comment" cannot swallow
 * it; a trailing semicolon goes first (after it, the LIMIT would be a second statement).
 */
function capRows(text) {
    const statement = String(text).trim().replace(/;+\s*$/, '');
    return /^select\b/i.test(statement) && !/\blimit\b/i.test(statement)
        ? `${statement}\nLIMIT ${ROW_CAP}`
        : statement;
}

/**
 * Run one statement read-only. Rejects with the Postgres error when the statement fails, writes, or is
 * more than one statement.
 *
 * @param {object} pool   the app's pg Pool
 * @param {string} text   the console's text
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs]  statement_timeout for this transaction only
 * @returns {Promise<{rows: object[], rowCount: number|null}>}
 */
async function runReadOnly(pool, text, { timeoutMs = STATEMENT_TIMEOUT_MS } = {}) {
    const client = await pool.connect();
    let releaseError;
    try {
        await client.query('BEGIN READ ONLY');
        await client.query(`SET LOCAL statement_timeout = ${Math.max(1, Math.floor(timeoutMs))}`);
        const result = await client.query({ text: capRows(text), queryMode: 'extended' });
        return { rows: result.rows || [], rowCount: result.rowCount };
    } finally {
        // Always rolled back: nothing the statement did, a SET included, outlives the request
        try {
            await client.query('ROLLBACK');
        } catch (error) {
            releaseError = error;   // a broken connection must not go back to the pool
        }
        client.release(releaseError);
    }
}

module.exports = { runReadOnly, capRows, ROW_CAP, STATEMENT_TIMEOUT_MS };
