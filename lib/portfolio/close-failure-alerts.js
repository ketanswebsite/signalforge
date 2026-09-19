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
 *      (shouldNotifyOwner, inside the rails of resolveShouldNotify) and WHAT
 *      (the message text). Subscribers are never told: no exit happened.
 *
 * The throttle lives in memory, not in a table, on purpose: it has to work when
 * the database is the thing that is broken. A restart forgets it, which costs
 * one extra message per stuck position per restart.
 *
 *   CLOSE_FAILURE_ALERTS         'false' = kill switch: evidence rows and logs only, no messages
 *   CLOSE_FAILURE_REMINDER_MIN   minutes between reminders while a close keeps failing (default 60)
 */

const { formatDateTimeUK } = require('../shared/date-format');

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

// One entry per trade whose close is failing: first failure → seen closed
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
 * ── Yours to shape ───────────────────────────────────────────────────────
 * This is called once per failed close — that is once a minute per stuck
 * position — and every `true` is a Telegram message on your phone. The
 * tension: a position sitting past its stop is worth interrupting you for,
 * but an alarm that nags gets muted, and a muted alarm is how the same-day
 * exit bug went unseen in the first place.
 *
 * Things you might decide differently from the plain rule:
 *   - kind === 'permanent' (a constraint, a missing column) can never heal by
 *     retrying: it needs you, now. kind === 'transient' (a dropped
 *     connection) usually heals by the next pass — you could wait for, say,
 *     attempts >= 3 before the first message so a one-minute blip stays quiet.
 *   - Back off instead of a fixed interval: 15 min, then 1 h, then 4 h.
 *   - exitType: is a stuck 'stop_loss' more urgent than a stuck 'max_days'?
 *   - plPercent: escalate when the loss is running away from the stop.
 *
 * Rails you cannot break from here (resolveShouldNotify): never more than one
 * message per trade per MIN_GAP_MINUTES, never silent for longer than
 * MAX_SILENCE_MINUTES while a close is failing, and a policy that throws or
 * returns anything but true/false is replaced by the plain rule.
 *
 * @param {object} failure
 * @param {'permanent'|'transient'|'unknown'} failure.kind  will a retry ever work?
 * @param {string|null} failure.code          SQLSTATE ('23514') or node code ('ECONNRESET')
 * @param {string} failure.exitType           'stop_loss' | 'target_reached' | 'max_days' | 'square_off' | …
 * @param {number} failure.plPercent          where the position stands now
 * @param {number} failure.attempts           failed closes so far, this one included
 * @param {number} failure.minutesFailing     since the first failed close
 * @param {number} failure.notifications      messages already sent about this position
 * @param {number|null} failure.minutesSinceLastNotification  null until the first has gone out
 * @param {number} failure.reminderMinutes    CLOSE_FAILURE_REMINDER_MIN (default 60)
 * @returns {boolean} true = message the owner now
 */
function shouldNotifyOwner(failure) {
    // TODO(owner): the plain rule for now — see the trade-offs above
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
function recordFailure(tradeId, { error, exitType, plPercent }, now = Date.now()) {
    // trades.id is a BIGINT: node-postgres hands it over as a string
    const key = String(tradeId);
    let episode = episodes.get(key);
    if (!episode) {
        episode = { firstFailedAt: now, attempts: 0, notifications: 0, lastNotifiedAt: null };
        episodes.set(key, episode);
    }

    Object.assign(episode, classifyCloseError(error), { exitType, plPercent });
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
 * @param {object} trade    the monitor's trade
 * @param {object} check    { currentPrice, plPercent, exitReason, currencySymbol } from this pass
 * @param {object} failure  recordFailure()'s answer
 * @param {Error}  error    what closeTradeAndRelease threw
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

module.exports = {
    getConfig,
    classifyCloseError,
    shouldNotifyOwner,
    resolveShouldNotify,
    firstThenReminders,
    recordFailure,
    markNotified,
    resolveEpisode,
    rememberOwnerChatId,
    reset,
    markdownSafe,
    plainText,
    formatFailureMessage,
    formatRecoveryMessage,
    DEFAULT_REMINDER_MINUTES,
    MIN_GAP_MINUTES,
    MAX_SILENCE_MINUTES
};
