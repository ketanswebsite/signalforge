/**
 * Telegram delivery counts (GAPS #12): how many of the bot's messages Telegram took, and why it refused
 * the rest, per UK day and per kind of message, in telegram_delivery_counts. Every send used to swallow
 * its error (sendTelegramAlert() answered false and logged nothing), so a subscriber who had blocked the
 * bot, a chat that no longer exists or a message Telegram could not parse went unseen.
 * GET /api/ops/telegram-stats reads the counts back.
 *
 * Counts only: a row is a UK day, a kind, an outcome and a number. Never a chat id, a name or message text.
 * The senders label each message with its kind (KINDS): `kind` on the alert that sendTelegramAlert() and
 * broadcastToSubscribers() take, and 'bot-reply' for the bot's answers to commands; a message without a
 * known kind counts as 'other'. The outcome is 'sent', or why Telegram refused it (REASONS).
 *
 * Counting never breaks or delays a send, on the model of the job-run log (lib/shared/job-runs.js):
 * sent() and failed() only add to a tally in memory, and never throw. The tally is written in the
 * background, at most once every FLUSH_DELAY_MS and one write at a time, and every database call is
 * caught. A write the database refuses puts its counts back in the tally, and the next message counted
 * starts the next write. A write the database does not answer within WRITE_TIMEOUT_MS is logged, and no
 * other write starts until it is answered. Counts still in memory when the process ends are lost (a few
 * seconds' worth). Rows older than RETENTION_DAYS are pruned once a UK day.
 */
'use strict';

const RETENTION_DAYS = 90;
// A broadcast's sends land in one write
const FLUSH_DELAY_MS = 2000;
// A healthy write takes milliseconds; a database that does not answer is not waited for
const WRITE_TIMEOUT_MS = 2000;

// What a message is, as its sender labels it
const KINDS = Object.freeze({
    scan: 'the 7 AM scan, to subscribers: scan started, the day\'s signals or none, a scan error',
    execution: 'the 1 PM executor\'s report, to subscribers, per market',
    'booking-dm': 'a subscriber\'s own "trades booked for you" message at 1 PM',
    exit: 'an exit in the house book, to subscribers',
    'exit-dm': 'an exit in a subscriber\'s own portfolio, to that subscriber',
    eod: 'the evening summary, to subscribers',
    'eod-dm': 'a subscriber\'s own evening summary',
    'hc-exit': 'a high-conviction exit, to subscribers',
    'weekly-report': 'the Saturday weekly report, to subscribers',
    'owner-alert': 'a message to the owner: a failed close, ledger drift, the AI sweep, a crash',
    'admin-test': 'the admin portal\'s test message',
    'bot-reply': 'the bot\'s answer to a command: /start (and account linking), /stop, /status, /change, /help',
    other: 'a message sent without one of these labels'
});

// Why Telegram did not take a message
const REASONS = Object.freeze({
    blocked: '403: the user blocked the bot or deleted their account, or the bot was removed from the chat',
    'chat-not-found': '400: there is no such chat',
    'bad-markdown': '400: Telegram could not parse the message\'s Markdown',
    'bad-request': '400: any other request Telegram refused',
    'rate-limited': '429: too many messages too fast',
    network: 'no usable answer from Telegram: a timeout, a dropped connection, a reply that was not Telegram\'s',
    'telegram-NNN': 'any other error code NNN from Telegram',
    other: 'an error that came neither from Telegram nor from the network'
});

const UK_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });

/** The UK calendar date of a moment, written YYYY-MM-DD */
function ukDay(at = new Date()) {
    return UK_DATE.format(at);
}

/**
 * Why Telegram did not take a message (a REASONS key, or telegram-NNN), from what node-telegram-bot-api
 * rejected with: ETELEGRAM carries Telegram's error_code and description, EFATAL means no answer came,
 * EPARSE an answer that was not Telegram's JSON. Reads the error's codes only, never its message.
 */
function reason(error) {
    if (!error || typeof error !== 'object') return 'other';
    if (error.code === 'EFATAL' || error.code === 'EPARSE') return 'network';
    const response = error.response && typeof error.response === 'object' ? error.response : {};
    const body = response.body && typeof response.body === 'object' ? response.body : {};
    const status = Number(body.error_code || response.statusCode);
    if (!Number.isInteger(status) || status < 100 || status > 599) return 'other';
    if (status === 403) return 'blocked';
    if (status === 429) return 'rate-limited';
    if (status === 400) {
        const description = String(body.description || '').toLowerCase();
        if (description.includes('chat not found')) return 'chat-not-found';
        if (description.includes('can\'t parse entities')) return 'bad-markdown';
        return 'bad-request';
    }
    return `telegram-${status}`;
}

// The tally: 'day|kind|outcome' -> messages counted and not written yet
const pending = new Map();
let writeTimer = null;
let inflight = null;   // the write the database has not answered yet
let inflightCount = 0; // the messages it carries
let ready = null;      // CREATE TABLE IF NOT EXISTS, once answered
let prunedDay = null;

function withTimeout(promise, ms) {
    let timer;
    const expiry = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error(`no answer in ${ms} ms`), { timedOut: true })), ms);
        if (timer.unref) timer.unref();
    });
    return Promise.race([promise, expiry]).finally(() => clearTimeout(timer));
}

function defaultPool() {
    try {
        const TradeDB = require('../../database-postgres');
        return TradeDB && TradeDB.pool && typeof TradeDB.pool.query === 'function' ? TradeDB.pool : null;
    } catch (error) {
        return null;
    }
}

/** Create the table when it is missing (idempotent). server.js calls it at boot, so the probe reads a table from the start. */
function ensureTable(pool) {
    if (!ready) {
        ready = Promise.resolve()
            .then(() => pool.query(`
                CREATE TABLE IF NOT EXISTS telegram_delivery_counts (
                    day DATE NOT NULL,
                    kind TEXT NOT NULL,
                    outcome TEXT NOT NULL,
                    n INTEGER NOT NULL DEFAULT 0,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (day, kind, outcome)
                )`))
            .catch(error => { ready = null; throw error; });
    }
    return ready;
}

function count(kind, outcome) {
    const label = Object.prototype.hasOwnProperty.call(KINDS, kind) ? kind : 'other';
    const key = `${ukDay()}|${label}|${outcome}`;
    pending.set(key, (pending.get(key) || 0) + 1);
    scheduleWrite();
    return label;
}

/** A message Telegram took. Never throws, never waits. */
function sent(kind) {
    try {
        count(kind, 'sent');
    } catch (error) {
        // Counting must never touch the send
    }
}

/** A message Telegram did not take. Logs one line: the kind and the reason, never the chat or the text. Never throws. */
function failed(kind, error) {
    try {
        const why = reason(error);
        const label = count(kind, why);
        console.warn(`⚠️ [TELEGRAM] Not delivered (${label}): ${why}`);
    } catch (e) {
        // Counting must never touch the send
    }
}

function scheduleWrite() {
    if (writeTimer) return;
    writeTimer = setTimeout(() => {
        writeTimer = null;
        flush().catch(() => {});
    }, FLUSH_DELAY_MS);
    if (writeTimer.unref) writeTimer.unref();
}

async function writeBatch(pool, batch) {
    await ensureTable(pool);
    const rows = [...batch].map(([key, n]) => [...key.split('|'), n]);
    const values = rows.map((row, i) => `($${4 * i + 1}::date, $${4 * i + 2}, $${4 * i + 3}, $${4 * i + 4}::int)`).join(', ');
    await pool.query(`INSERT INTO telegram_delivery_counts (day, kind, outcome, n) VALUES ${values}
        ON CONFLICT (day, kind, outcome) DO UPDATE SET n = telegram_delivery_counts.n + EXCLUDED.n, updated_at = NOW()`,
    rows.flat());
}

/** Rows older than RETENTION_DAYS go, once a UK day, after a write the database took */
function prune(pool) {
    const today = ukDay();
    if (prunedDay === today) return;
    prunedDay = today;
    Promise.resolve()
        .then(() => pool.query('DELETE FROM telegram_delivery_counts WHERE day < $1::date - $2::int', [today, RETENTION_DAYS]))
        .catch(error => {
            prunedDay = null;
            console.error(`⚠️ [TELEGRAM DELIVERIES] Could not prune old counts: ${error.message}`);
        });
}

const sum = counts => [...counts.values()].reduce((total, n) => total + n, 0);

/**
 * Write the tally now (the timer calls this). Resolves true when the database took it within
 * WRITE_TIMEOUT_MS, else false; never rejects. Nothing to write, no database or a write still
 * unanswered: false, and the tally stays for the next write.
 */
async function flush({ pool = defaultPool() } = {}) {
    try {
        if (!pool || inflight || pending.size === 0) return false;
        const batch = new Map(pending);
        pending.clear();
        const write = writeBatch(pool, batch);
        inflight = write;
        inflightCount = sum(batch);
        const settled = () => {
            if (inflight !== write) return;
            inflight = null;
            inflightCount = 0;
        };
        write.then(() => {
            settled();
            prune(pool);
            // Messages counted while this write was out
            if (pending.size) scheduleWrite();
        }, error => {
            settled();
            // Back into the tally: the next message counted starts the next write
            for (const [key, n] of batch) pending.set(key, (pending.get(key) || 0) + n);
            console.error(`⚠️ [TELEGRAM DELIVERIES] Could not record ${sum(batch)} deliveries, kept for the next write: ${error.message}`);
        }).catch(() => {});
        await withTimeout(write, WRITE_TIMEOUT_MS);
        return true;
    } catch (error) {
        if (error && error.timedOut) {
            console.error(`⚠️ [TELEGRAM DELIVERIES] The database has not answered a write in ${WRITE_TIMEOUT_MS} ms; no other write starts until it does`);
        }
        return false;
    }
}

/** This process's side: messages counted and not written yet, and whether a write is waiting for the database */
function stats() {
    return { notYetWritten: sum(pending) + inflightCount, writeOutstanding: Boolean(inflight) };
}

// { sent, failed, failures: { reason: n } } of some rows
function tally(rows) {
    const out = { sent: 0, failed: 0, failures: {} };
    for (const row of rows) {
        const n = Number(row.n) || 0;
        if (row.outcome === 'sent') {
            out.sent += n;
        } else {
            out.failed += n;
            out.failures[row.outcome] = (out.failures[row.outcome] || 0) + n;
        }
    }
    return out;
}

function groupBy(rows, key) {
    const groups = new Map();
    for (const row of rows) {
        if (!groups.has(row[key])) groups.set(row[key], []);
        groups.get(row[key]).push(row);
    }
    return [...groups];
}

/**
 * GET /api/ops/telegram-stats: `day`'s messages by kind, and the totals of each UK day with any in the
 * `days` up to and including it, newest first. Reads only; before the table exists it reads as empty.
 */
async function report(pool, { day = ukDay(), days = 14 } = {}) {
    const { rows: [table] } = await pool.query("SELECT to_regclass('public.telegram_delivery_counts') IS NOT NULL AS present");
    let rows = [];
    let countedSince = null;
    if (table.present) {
        ({ rows } = await pool.query(`
            SELECT to_char(day, 'YYYY-MM-DD') AS day, kind, outcome, n
            FROM telegram_delivery_counts
            WHERE day BETWEEN $1::date - ($2::int - 1) AND $1::date
            ORDER BY day DESC, kind, outcome`, [day, days]));
        const { rows: [first] } = await pool.query("SELECT to_char(min(day), 'YYYY-MM-DD') AS since FROM telegram_delivery_counts");
        countedSince = first ? first.since : null;
    }
    return {
        table: table.present,
        day,
        kinds: groupBy(rows.filter(row => row.day === day), 'kind').map(([kind, list]) => ({ kind, ...tally(list) })),
        days,
        daily: groupBy(rows, 'day').map(([date, list]) => ({ day: date, ...tally(list) })),
        totals: tally(rows),
        countedSince,
        retentionDays: RETENTION_DAYS,
        ...stats(),
        legend: { kinds: KINDS, reasons: REASONS }
    };
}

/** Tests only: forget the tally, the timer, the table check and the last prune */
function reset() {
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = null;
    pending.clear();
    inflight = null;
    inflightCount = 0;
    ready = null;
    prunedDay = null;
}

module.exports = {
    sent,
    failed,
    reason,
    ukDay,
    ensureTable,
    flush,
    stats,
    report,
    reset,
    KINDS,
    REASONS,
    RETENTION_DAYS,
    FLUSH_DELAY_MS,
    WRITE_TIMEOUT_MS
};
