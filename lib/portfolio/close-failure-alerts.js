/**
 * Close-failure alerts — a failed automatic close must not be silent
 *
 * The exit monitor is the only thing that closes `trades` rows. When the
 * database refuses a close (a constraint, schema drift, a connection fault)
 * the position stays open past its stop or target and the monitor simply tries
 * again a minute later. Until this module the only trace was a log line per
 * minute: the same-day-exit bug (SQLSTATE 23514 on chk_trades_date_logic, fixed
 * in 1159327) hid that way.
 *
 * What happens now, per failed close (see exit-monitor.js handleCloseFailure):
 *   1. EVIDENCE  a trade_exit_checks row tagged with the exit type, alert_sent
 *      false — written by the monitor on every failed pass.
 *   2. THE OWNER IS TOLD, privately and throttled. This module decides WHEN
 *      (shouldNotifyOwner, inside the rails of resolveShouldNotify), WHAT (the
 *      message text) and HOW (notifyOwner). Subscribers are never told: no
 *      exit happened.
 *
 * The high-conviction manager closes high_conviction_portfolio rows the same
 * way and had the same silence (a log line every pass). It reports through
 * this module too, under namespaced('hc'), but writes no evidence rows:
 * high-conviction positions have no exit-check table, so for those positions
 * the log line and the owner's message are the record.
 *
 * The throttle lives in memory, not in a table, on purpose: it has to work when
 * the database is the thing that is broken. A restart forgets it, which costs
 * one extra message per stuck position per restart.
 *
 *   CLOSE_FAILURE_ALERTS         'false' = kill switch: evidence rows and logs only, no messages
 *   CLOSE_FAILURE_REMINDER_MIN   minutes between reminders while a close keeps failing (default 60)
 */

const { formatDateTimeUK } = require('../shared/date-format');
const AdminIdentity = require('../../config/admin');

const DEFAULT_REMINDER_MINUTES = 60;
// Rails around the owner's policy — see resolveShouldNotify()
const MIN_GAP_MINUTES = 5;
const MAX_SILENCE_MINUTES = 24 * 60;

const MAX_ERROR_LENGTH = 300;

// SQLSTATE classes (the first two characters of a Postgres error code).
// Permanent: the statement itself is wrong for this data or this schema, so
// the identical retry a minute later fails the identical way.
//   22 data exception · 23 integrity constraint violation (23514 = check)
//   42 syntax error or access rule violation (42703 undefined column, 42P01 undefined table)
const PERMANENT_SQLSTATE_CLASSES = ['22', '23', '42'];
// Transient: the database could not serve the statement right now.
//   08 connection exception · 40 transaction rollback (deadlock, serialization)
//   53 insufficient resources · 57 operator intervention (shutdown, cancel) · 58 system error
const TRANSIENT_SQLSTATE_CLASSES = ['08', '40', '53', '57', '58'];
const TRANSIENT_NODE_CODES = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH'];
// node-postgres raises these without a code
const TRANSIENT_MESSAGE = /timeout|terminated|connection|ECONN/i;

// One entry per trade whose close is failing: first failure → seen closed.
// A `trades` row is keyed by its bare id, another table's row by a prefix
// ('hc:12') — see namespaced()
const episodes = new Map();
let lastKnownOwnerChatId = null;

/**
 * Read the settings from the environment.
 */
function getConfig(env = process.env) {
    const parsed = parseInt(env.CLOSE_FAILURE_REMINDER_MIN, 10);
    const reminderMinutes = Number.isFinite(parsed) && parsed >= 1
        ? Math.max(MIN_GAP_MINUTES, Math.min(parsed, MAX_SILENCE_MINUTES))
        : DEFAULT_REMINDER_MINUTES;

    // On by default; the off value is read loosely, like EXIT_CHECK_PRUNE
    const killSwitch = String(env.CLOSE_FAILURE_ALERTS || '').trim().toLowerCase();

    return {
        enabled: !['false', '0', 'no', 'off'].includes(killSwitch),
        reminderMinutes
    };
}

/**
 * Will retrying this close ever work?
 *
 * @returns {{kind: 'permanent'|'transient'|'unknown', code: string|null}}
 */
function classifyCloseError(error) {
    const code = error && typeof error.code === 'string' ? error.code : null;

    // Node codes first: 'EPIPE' is five capitals and would pass for a SQLSTATE
    if (code && TRANSIENT_NODE_CODES.includes(code)) return { kind: 'transient', code };

    if (code && /^[0-9A-Z]{5}$/.test(code)) {
        const sqlstateClass = code.slice(0, 2);
        if (PERMANENT_SQLSTATE_CLASSES.includes(sqlstateClass)) return { kind: 'permanent', code };
        if (TRANSIENT_SQLSTATE_CLASSES.includes(sqlstateClass)) return { kind: 'transient', code };
        return { kind: 'unknown', code };
    }

    if (!code && TRANSIENT_MESSAGE.test(String(error && error.message))) return { kind: 'transient', code };

    return { kind: 'unknown', code };
}

/**
 * The plain rule: tell the owner about the first failure, then remind them
 * every `reminderMinutes` for as long as the close keeps failing. It is also
 * what resolveShouldNotify() falls back to when the policy below misbehaves.
 */
function firstThenReminders(failure) {
    if (failure.notifications === 0) {
        return true;
    }
    return failure.minutesSinceLastNotification >= failure.reminderMinutes;
}

/**
 * Should the owner be told about this failed close right now?
 *
 * The rule (README §4.7) is the plain one, firstThenReminders(): the owner
 * hears about the first failed close of a position at once, whatever its
 * kind, then every reminderMinutes for as long as it keeps failing. This is
 * called once per failed close (once a minute per stuck trade, once a
 * high-conviction pass, every 10 minutes, per stuck high-conviction
 * position), and every `true` is a Telegram message on the owner's phone.
 *
 * Why nothing finer:
 *   - a close fails only at the moment a position should exit, so every
 *     failure is a position past its stop, target or day limit: worth the
 *     interruption, transient or not. A one-pass blip costs two messages
 *     (failed, then recovered), and a blip rarely lands on a close.
 *   - holding a transient failure back until a third attempt would hold a
 *     high-conviction position back twenty minutes, because its attempts
 *     arrive ten minutes apart.
 *   - the reminder is already bounded by the rails, and a muted alarm is how
 *     the same-day exit bug went unseen.
 *
 * Rails no policy can break (resolveShouldNotify): never more than one
 * message per trade per MIN_GAP_MINUTES, never silent for longer than
 * MAX_SILENCE_MINUTES while a close is failing, and a policy that throws or
 * returns anything but true/false is replaced by the plain rule.
 *
 * @param {object} failure
 * @param {'trades'|'hc'} failure.namespace   which book: a trade (exit monitor) or a high-conviction position
 * @param {'permanent'|'transient'|'unknown'} failure.kind  will a retry ever work?
 * @param {string|null} failure.code          SQLSTATE ('23514') or node code ('ECONNRESET')
 * @param {string} failure.exitType           trades: 'stop_loss' | 'target_reached' | 'max_days' | 'square_off' | …
 *                                            hc: 'take_profit' | 'stop_loss' | 'max_days' | …
 * @param {number} failure.plPercent          where the position stands now
 * @param {number} failure.attempts           failed closes so far, this one included
 * @param {number} failure.minutesFailing     since the first failed close
 * @param {number} failure.notifications      messages already sent about this position
 * @param {number|null} failure.minutesSinceLastNotification  null until the first has gone out
 * @param {number} failure.reminderMinutes    CLOSE_FAILURE_REMINDER_MIN (default 60)
 * @returns {boolean} true = message the owner now
 */
function shouldNotifyOwner(failure) {
    return firstThenReminders(failure);
}

/**
 * Run the notification policy and keep its answer inside safe bounds.
 */
function resolveShouldNotify(failure, policy = shouldNotifyOwner) {
    const told = failure.notifications > 0;
    const quietMinutes = told ? failure.minutesSinceLastNotification : failure.minutesFailing;

    // Floor: whatever the policy wants, this is not a once-a-minute channel
    if (told && quietMinutes < MIN_GAP_MINUTES) {
        return false;
    }
    // Ceiling: silence is the bug this exists to end, so no policy can keep a
    // failing close quiet for ever
    if (quietMinutes >= MAX_SILENCE_MINUTES) {
        return true;
    }

    let answer;
    try {
        answer = policy(failure);
    } catch (error) {
        console.error('❌ [CLOSE FAILURE] Notification policy threw — using the plain rule:', error.message);
    }

    return typeof answer === 'boolean' ? answer : firstThenReminders(failure);
}

const minutesBetween = (from, to) => Math.round((to - from) / 60000);

/**
 * What the policy (and the message) get to see. A copy, so nothing outside
 * this module can alter the tracker.
 */
function snapshot(episode, now) {
    return {
        namespace: episode.namespace,
        kind: episode.kind,
        code: episode.code,
        exitType: episode.exitType,
        plPercent: episode.plPercent,
        attempts: episode.attempts,
        minutesFailing: minutesBetween(episode.firstFailedAt, now),
        notifications: episode.notifications,
        minutesSinceLastNotification: episode.lastNotifiedAt === null
            ? null
            : minutesBetween(episode.lastNotifiedAt, now),
        reminderMinutes: getConfig().reminderMinutes
    };
}

/**
 * Count one failed close of a trade and describe where that leaves it.
 * The episode runs until resolveEpisode() — a price that drifts back inside
 * the stop does not end it, so a price flapping across the stop cannot turn
 * every crossing into a "first" failure.
 */
function recordFailure(tradeId, { error, exitType, plPercent, namespace = 'trades' }, now = Date.now()) {
    // trades.id is a BIGINT: node-postgres hands it over as a string
    const key = String(tradeId);
    let episode = episodes.get(key);
    if (!episode) {
        episode = { firstFailedAt: now, attempts: 0, notifications: 0, lastNotifiedAt: null };
        episodes.set(key, episode);
    }

    Object.assign(episode, classifyCloseError(error), { exitType, plPercent, namespace });
    episode.attempts++;

    return snapshot(episode, now);
}

/**
 * A message about this trade reached the owner.
 */
function markNotified(tradeId, now = Date.now()) {
    const episode = episodes.get(String(tradeId));
    if (episode) {
        episode.notifications++;
        episode.lastNotifiedAt = now;
    }
}

/**
 * The trade is closed: end its episode. Returns how it stood, or null if its
 * close had not been failing (the normal case).
 */
function resolveEpisode(tradeId, now = Date.now()) {
    const key = String(tradeId);
    const episode = episodes.get(key);
    if (!episode) {
        return null;
    }
    episodes.delete(key);
    return snapshot(episode, now);
}

/**
 * The same tracker for another table's positions. high_conviction_portfolio.id
 * and trades.id are separate sequences — row 12 of each is a different
 * position — so another table's episodes live under a prefix ('hc:12'), and
 * the policy is told which book a failure came from. The plain recordFailure /
 * markNotified / resolveEpisode above are the `trades` table's.
 */
function namespaced(namespace) {
    const key = tradeId => `${namespace}:${tradeId}`;
    return {
        recordFailure: (tradeId, details, now) => recordFailure(key(tradeId), { ...details, namespace }, now),
        markNotified: (tradeId, now) => markNotified(key(tradeId), now),
        resolveEpisode: (tradeId, now) => resolveEpisode(key(tradeId), now)
    };
}

/**
 * getUserChatId() answers null when the DATABASE is what is failing. Keep the
 * last good answer so that a database fault cannot also silence the alarm
 * about it.
 */
function rememberOwnerChatId(chatId) {
    if (chatId) {
        lastKnownOwnerChatId = chatId;
    }
    return lastKnownOwnerChatId;
}

/**
 * Forget everything (tests).
 */
function reset() {
    episodes.clear();
    lastKnownOwnerChatId = null;
}

/**
 * The bot sends legacy Markdown and Telegram REJECTS a message whose markup
 * does not balance — "chk_trades_date_logic" alone would do it, and the alarm
 * would fail as quietly as the close did. Escaped, outside any entity, the
 * text arrives verbatim.
 */
function markdownSafe(text) {
    return String(text === undefined || text === null ? '' : text)
        .replace(/\\/g, '/')
        .replace(/([_*`\[])/g, '\\$1');
}

/**
 * The same message with no markup at all — the second attempt when Telegram
 * turns the formatted one down.
 */
function plainText(message) {
    return String(message).replace(/\\([_*`\[])/g, '$1').replace(/[*`]/g, '');
}

const KIND_NOTE = {
    permanent: 'permanent — the database rejects this close itself, so retrying cannot fix it. It needs a code or data fix.',
    transient: 'transient — the database could not be reached or was busy. Retries may get through.',
    unknown: 'unknown — not a recognised database error.'
};

function describeTrade(trade) {
    return `📊 *Stock:* ${markdownSafe(trade.symbol)} (trade #${markdownSafe(trade.id)})\n` +
        `👤 *Portfolio:* ${markdownSafe(trade.user_id || 'default')}\n`;
}

/**
 * @param {object} trade    { id, symbol, user_id } — user_id is printed as the portfolio
 * @param {object} check    { currentPrice, plPercent, exitReason, currencySymbol } from this pass
 * @param {object} failure  recordFailure()'s answer
 * @param {Error}  error    what the close threw
 */
function formatFailureMessage(trade, check, failure, error) {
    const errorText = String(error && error.message || error).slice(0, MAX_ERROR_LENGTH);
    const sign = check.plPercent >= 0 ? '+' : '';

    return `${failure.notifications === 0 ? '🚨 *CLOSE FAILED — POSITION STILL OPEN*' : '⏰ *CLOSE STILL FAILING*'}\n\n` +
        describeTrade(trade) +
        `📤 *Should have exited:* ${markdownSafe(check.exitReason)}\n` +
        `💹 *Now:* ${sign}${Number(check.plPercent).toFixed(2)}% at ${check.currencySymbol || ''}${Number(check.currentPrice).toFixed(2)}\n` +
        `❌ *Error:* ${failure.code ? `${markdownSafe(failure.code)} · ` : ''}${markdownSafe(errorText)}\n` +
        `🧭 *Kind:* ${KIND_NOTE[failure.kind] || KIND_NOTE.unknown}\n` +
        `🔁 *Failed attempts:* ${failure.attempts} over ${failure.minutesFailing} min — the monitor retries every check\n` +
        `🕐 *Time:* ${formatDateTimeUK(new Date())}\n\n` +
        'No exit alert has gone to subscribers: nothing was closed.';
}

/**
 * @param {object} trade
 * @param {object} episode  resolveEpisode()'s answer
 * @param {string} outcome  'closed' | 'closed elsewhere'
 */
function formatRecoveryMessage(trade, episode, outcome) {
    return '✅ *CLOSE RECOVERED*\n\n' +
        describeTrade(trade) +
        `🔁 Now ${markdownSafe(outcome)}, after ${episode.attempts} failed attempt(s) over ${episode.minutesFailing} min.\n` +
        `🕐 *Time:* ${formatDateTimeUK(new Date())}`;
}

/**
 * Message the OWNER and nobody else: a direct message to ADMIN_EMAIL's linked
 * Telegram. Never broadcastToSubscribers — and not the ntfy topic either,
 * which is advertised to subscribers on the Alerts page.
 *
 * Shared by the exit monitor and the high-conviction manager. They hand in
 * the database module and the bot, so this module requires neither.
 *
 * @param {string} message           legacy Markdown, dynamic text through markdownSafe()
 * @param {object} deps
 * @param {object} deps.TradeDB      getUserChatId(email) — answers null when the database fails
 * @param {object} deps.telegramBot  sendTelegramAlert(chatId, alert) — answers false on ANY failure
 * @returns {Promise<boolean>} whether the message was delivered
 */
async function notifyOwner(message, deps) {
    // Never rejects: every caller is already handling a failure, and a report that cannot be sent
    // must not become a second one. Every attempt leaves one "[OWNER ALERT]" line in the logs.
    const first = String(message).split('\n')[0].slice(0, 120);
    let delivered = false;
    try {
        delivered = await deliverToOwner(message, deps || {});
    } catch (error) {
        console.error('❌ [OWNER ALERT] Sending failed:', error.message);
    }
    console.log(`${delivered ? '📨' : '⚠️'} [OWNER ALERT] ${delivered ? 'delivered' : 'NOT delivered'}: ${first}`);
    return delivered;
}

async function deliverToOwner(message, { TradeDB, telegramBot }) {
    if (!telegramBot || typeof telegramBot.sendTelegramAlert !== 'function') {
        return false;
    }

    const adminEmail = AdminIdentity.adminEmail();
    const chatId = rememberOwnerChatId(await TradeDB.getUserChatId(adminEmail));
    if (!chatId) {
        // Deliberately no fallback: sendTelegramAlert() would substitute
        // TELEGRAM_CHAT_ID for a missing chat id, and that may be a channel
        console.error(`❌ [CLOSE FAILURE] ${adminEmail} has no linked Telegram — the owner alert could not be sent`);
        return false;
    }

    if (await telegramBot.sendTelegramAlert(chatId, { type: 'custom', message })) {
        return true;
    }
    // sendTelegramAlert reports every failure as false, including Telegram
    // refusing the Markdown — so try once more with the markup stripped
    return await telegramBot.sendTelegramAlert(chatId, { type: 'custom', message: plainText(message) }) === true;
}

module.exports = {
    getConfig,
    classifyCloseError,
    shouldNotifyOwner,
    resolveShouldNotify,
    firstThenReminders,
    recordFailure,
    markNotified,
    resolveEpisode,
    namespaced,
    rememberOwnerChatId,
    reset,
    markdownSafe,
    plainText,
    formatFailureMessage,
    formatRecoveryMessage,
    notifyOwner,
    DEFAULT_REMINDER_MINUTES,
    MIN_GAP_MINUTES,
    MAX_SILENCE_MINUTES
};
