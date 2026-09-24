/**
 * The ops tokens: one guard for every route a headless caller reaches without a Google session - the
 * /api/ops/* probes and triggers, POST /api/scanner/run and GET /api/signals/screened-today.
 *
 *   ANALYSIS_API_TOKEN   the full token: every one of those routes, reads and writes, in the
 *                        x-analysis-token header. The routes that always read it from the URL as well
 *                        (?token=, the { query: true } routes) still do, until the owner's scheduled
 *                        routine sends the header: a token in a URL ends up in logs and histories.
 *   ANALYSIS_READ_TOKEN  the read token: only the read-only GET probes that ask for it ({ read: true }),
 *                        only on a GET (or HEAD), only from the header. Never from the URL, never on a
 *                        route that writes or starts a job. Set it to a value of its own, never the full
 *                        token's: a monitor or a scheduled read can hold it without being able to change
 *                        anything.
 *
 * A token the server does not have set matches nothing, and a guess takes the same time to refuse
 * whatever it shares with the token. A refused request gets 401 { error: 'Unauthorized' } and never
 * reaches the handler.
 */
'use strict';

const crypto = require('crypto');

const HEADER = 'x-analysis-token';
const READ_METHODS = new Set(['GET', 'HEAD']);

/** Constant-time comparison of a presented token with a configured one; false when either is missing. */
function tokenMatches(presented, expected) {
    if (typeof presented !== 'string' || typeof expected !== 'string' || presented === '' || expected === '') return false;
    const a = crypto.createHash('sha256').update(presented).digest();
    const b = crypto.createHash('sha256').update(expected).digest();
    return crypto.timingSafeEqual(a, b);
}

/**
 * What the request's token opens on this route: 'full', 'read', or null.
 * @param {object} req                the Express request
 * @param {object} [options]
 * @param {boolean} [options.query]   also take the FULL token from ?token= (the legacy URL form; never the read token)
 * @param {boolean} [options.read]    a read-only GET probe: the read token opens it too
 */
function opsAccess(req, { query = false, read = false } = {}) {
    const header = typeof req.get === 'function' ? req.get(HEADER) : undefined;
    const full = process.env.ANALYSIS_API_TOKEN;
    if (tokenMatches(header, full)) return 'full';
    if (query && req.query && tokenMatches(req.query.token, full)) return 'full';
    if (read && READ_METHODS.has(req.method) && tokenMatches(header, process.env.ANALYSIS_READ_TOKEN)) return 'read';
    return null;
}

/** Express middleware: 401 unless opsAccess() lets the request in. The handler finds req.opsAccess. */
function requireOpsToken(options = {}) {
    return function opsTokenGuard(req, res, next) {
        const access = opsAccess(req, options);
        if (!access) return res.status(401).json({ error: 'Unauthorized' });
        req.opsAccess = access;
        return next();
    };
}

module.exports = { requireOpsToken, opsAccess, tokenMatches, HEADER };
