/**
 * Nightly ledger drift check (GAPS #6, README.md section 1)
 *
 * portfolio_capital is a running ledger, one row per account and market: the
 * 1 PM executor allocates at entry, closeTradeAndRelease releases at the exit
 * and a delete settles in the same statement. The trades table is the record
 * it has to agree with, and POST /api/ops/reconcile-capital recomputes the
 * ledger from it. Every endpoint-harness run proves that those writes keep the
 * two in step, but only on a scratch database. Nothing looked at production:
 * a booking whose trade insert fails after its allocation (trade-executor.js
 * allocates, then inserts, in two statements), a hand edit or a release that
 * never happened stayed out of sight until someone thought to run the reconcile.
 *
 * At 22:30 UK on weekdays (the cron is in lib/scanner/scanner.js) this runs the
 * reconcile's own dry run, CapitalManager.reconcileReport(), the computation the
 * endpoint answers with. When a ledger row is out by more than DRIFT_TOLERANCE
 * in realized, allocated or available capital, or counts a different number of
 * open positions, the owner gets ONE Telegram message for the run, with a short
 * summary, through close-failure-alerts.js notifyOwner: a direct message to the
 * owner, never to subscribers, and it never rejects. This module reads and
 * reports; it never writes the ledger. The repair stays a decision:
 * POST /api/ops/reconcile-capital?apply=true.
 *
 * 22:30 UK is the quiet point of a weekday: every market has closed, the exit
 * monitor and the high-conviction checks stop at 22:00, the executors ran at
 * 13:00 local and the exit-check prune waits until 23:20. No scheduled job
 * books, closes or releases while the dry run reads, so a booking caught
 * between its two statements cannot read as drift. (A close or a delete from
 * the Positions page settles the ledger in one transaction or statement, and
 * the dry run is one statement, so those cannot either.)
 *
 * The last run is kept in memory and shows as `nightlyCheck` in the reconcile
 * endpoint's answer. A restart forgets it.
 *
 *   LEDGER_DRIFT_CHECK   'false' = kill switch: no check, no message
 */

const CapitalManager = require('./capital-manager');
const OwnerAlerts = require('./close-failure-alerts');
const { formatDateTimeUK } = require('../shared/date-format');

const { markdownSafe } = OwnerAlerts;

// The cron expression lib/scanner/scanner.js schedules, in Europe/London time
// (a unit test keeps the two in step)
const CRON_EXPRESSION = '30 22 * * 1-5';
const SCHEDULE_LABEL = '22:30 UK, Monday to Friday';
// One minor unit: a penny, a cent, a paisa. The reconcile rounds money drift to
// 2 decimals, and every ledger write keeps both sides equal to the 4th, so a
// larger difference is a real one. A position count has to match exactly.
const DRIFT_TOLERANCE = 0.01;
const MONEY_FIELDS = ['realized', 'allocated', 'available'];
// Ledger lines in the owner's message; the rest are counted
const MAX_LINES = 10;
const MAX_ERROR_LENGTH = 200;

let running = false;
let lastRun = null;

/**
 * Read the settings from the environment.
 */
function getConfig(env = process.env) {
    // On by default; the off value is read loosely, like CLOSE_FAILURE_ALERTS
    const killSwitch = String(env.LEDGER_DRIFT_CHECK || '').trim().toLowerCase();
    return {
        enabled: !['false', '0', 'no', 'off'].includes(killSwitch),
        tolerance: DRIFT_TOLERANCE
    };
}

/**
 * Is this reconcile entry out of step beyond the tolerance?
 *
 * @param {object} entry  one element of CapitalManager.reconcileReport()
 */
function isDrifted(entry, tolerance = DRIFT_TOLERANCE) {
    const drift = entry.drift || {};
    return MONEY_FIELDS.some(field => Math.abs(Number(drift[field]) || 0) > tolerance)
        || (Number(drift.positions) || 0) !== 0;
}

const signed = (value, digits) => `${value > 0 ? '+' : ''}${Number(value).toFixed(digits)}`;

function describeEntry(entry, tolerance) {
    const drift = entry.drift;
    const parts = MONEY_FIELDS
        .filter(field => Math.abs(Number(drift[field]) || 0) > tolerance)
        .map(field => `${field} ${signed(drift[field], 2)}`);
    if ((Number(drift.positions) || 0) !== 0) {
        parts.push(`positions ${signed(drift.positions, 0)}`);
    }
    const currency = entry.currency ? ` (${markdownSafe(entry.currency)})` : '';
    return `${markdownSafe(entry.user_id)} · ${markdownSafe(entry.market)}${currency}: ${parts.join(', ')}`;
}

/**
 * The owner's message: which ledgers are out, and by how much. Legacy Markdown,
 * every dynamic value through markdownSafe(). The first line carries no account
 * name: it is the one notifyOwner() writes to the log.
 *
 * @param {object[]} drifted  the reconcile entries that are out
 * @param {object} run        { markets, accounts, at }
 */
function formatDriftMessage(drifted, { markets, accounts, at }, tolerance = DRIFT_TOLERANCE) {
    const lines = drifted.slice(0, MAX_LINES).map(entry => describeEntry(entry, tolerance));
    const more = drifted.length - lines.length;
    return `⚠️ *Ledger drift:* ${drifted.length} of ${markets} paper-capital ledger${markets === 1 ? '' : 's'} ` +
        `(${accounts} account${accounts === 1 ? '' : 's'}) disagree with the trades table.\n\n` +
        lines.join('\n') +
        (more > 0 ? `\n…and ${more} more` : '') +
        '\n\nFigures are the trades table minus the ledger. Nothing was changed: ' +
        'POST /api/ops/reconcile-capital shows the drift, and ?apply=true writes the trades table\'s figures into the ledger.\n' +
        `🕐 ${formatDateTimeUK(at)}`;
}

function formatFailureMessage(errorText, at) {
    return '⚠️ *Ledger drift check failed:* the paper-capital ledger was not checked tonight.\n' +
        `${markdownSafe(errorText)}\n` +
        `🕐 ${formatDateTimeUK(at)}`;
}

/**
 * Message the owner and nobody else (close-failure-alerts.js notifyOwner).
 * Never rejects. The bot module is loaded here, not at the top: requiring it
 * creates the bot client (server.js has loaded it long before a cron fires).
 */
async function notifyOwner(message) {
    try {
        return await OwnerAlerts.notifyOwner(message, {
            TradeDB: require('../../database-postgres'),
            telegramBot: require('../telegram/telegram-bot')
        });
    } catch (error) {
        // OwnerAlerts.notifyOwner never rejects: this is a module that failed to load
        console.error('❌ [LEDGER DRIFT] Owner message failed:', error.message);
        return false;
    }
}

/**
 * Run the reconcile's dry run and tell the owner about any drift.
 *
 * Never throws: it runs from a cron. Never writes the ledger. With
 * LEDGER_DRIFT_CHECK=false it reads nothing and sends nothing.
 *
 * @returns {Promise<object>} the run, as getStatus().lastRun shows it
 */
async function runLedgerDriftCheck() {
    const at = new Date();
    const config = getConfig();

    if (!config.enabled) {
        lastRun = { at: at.toISOString(), skipped: 'LEDGER_DRIFT_CHECK=false' };
        console.log('📒 [LEDGER DRIFT] Check skipped: LEDGER_DRIFT_CHECK=false');
        return lastRun;
    }
    if (running) {
        console.log('📒 [LEDGER DRIFT] A check is already running — skipped');
        return { at: at.toISOString(), skipped: 'A check is already running' };
    }
    running = true;

    try {
        const report = await CapitalManager.reconcileReport();
        const drifted = report.filter(entry => isDrifted(entry, config.tolerance));
        const accounts = new Set(report.map(entry => entry.user_id)).size;
        const run = {
            at: at.toISOString(),
            accounts,
            markets: report.length,
            drifted: drifted.map(entry => ({
                user_id: entry.user_id,
                market: entry.market,
                currency: entry.currency,
                drift: { ...entry.drift }
            })),
            ownerNotified: null
        };

        if (drifted.length === 0) {
            console.log(`📒 [LEDGER DRIFT] All ${report.length} paper-capital ledger(s) (${accounts} account(s)) agree with the trades table`);
        } else {
            // Markets and amounts only: the owner's message and the reconcile endpoint name the accounts
            console.error(`❌ [LEDGER DRIFT] ${drifted.length} of ${report.length} ledger(s) disagree with the trades table: ` +
                drifted.map(entry => `${entry.market} ${JSON.stringify(entry.drift)}`).join('; '));
            run.ownerNotified = await notifyOwner(formatDriftMessage(drifted, { markets: report.length, accounts, at }, config.tolerance));
        }

        lastRun = run;
        return run;
    } catch (error) {
        const errorText = String((error && error.message) || error).slice(0, MAX_ERROR_LENGTH);
        console.error('❌ [LEDGER DRIFT] Check failed:', errorText);
        lastRun = { at: at.toISOString(), error: errorText, ownerNotified: null };
        lastRun.ownerNotified = await notifyOwner(formatFailureMessage(errorText, at));
        return lastRun;
    } finally {
        running = false;
    }
}

/**
 * What the reconcile endpoint shows as `nightlyCheck`.
 */
function getStatus() {
    const { enabled, tolerance } = getConfig();
    return {
        enabled,
        schedule: SCHEDULE_LABEL,
        tolerance,
        running,
        lastRun: lastRun ? { ...lastRun } : null
    };
}

/**
 * Forget the last run (tests).
 */
function reset() {
    running = false;
    lastRun = null;
}

module.exports = {
    runLedgerDriftCheck,
    getStatus,
    getConfig,
    isDrifted,
    formatDriftMessage,
    reset,
    CRON_EXPRESSION,
    SCHEDULE_LABEL,
    DRIFT_TOLERANCE,
    MAX_LINES
};
