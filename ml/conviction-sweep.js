/**
 * Monthly AI conviction sweep
 *
 * Scores the FULL stock universe (~5,000 symbols) once a month and persists
 * the verdicts to conviction_daily, where the engine's month-long read
 * window (CONVICTION_MAX_AGE_DAYS) serves them to the 7 AM scanner, the
 * 1 PM executor, the insights panel and the simulator until the next sweep.
 *
 * The sweep asks the engine for FRESH verdicts. It has to: the read window
 * (37 days) outlasts the gap between sweeps (28 or 35), so on sweep morning
 * every verdict from the last sweep is still being served, and an ordinary
 * getConviction() call hands it straight back. Until 2026-09 that is what
 * happened — on production the 2026-09-05 sweep left 257 verdicts from
 * 08-15..08-22 untouched and counted them as scored. The tally below is
 * therefore honest: `scored` = computed now and stored, `reused` = handed a
 * stored verdict, `blind` = every source was down, nothing stored.
 *
 * Runs on the FIRST Saturday of each month from the scanner cron hub
 * (weekly used to be the cadence; dropped to monthly 2026-08 to cut AI
 * cost). Resumable — symbols already scored inside the resume window are
 * skipped, so a re-run continues where the last one stopped. Deliberately
 * gentle on the data sources: low concurrency plus a per-symbol delay.
 * Results where every pillar failed to neutral are not persisted (see
 * conviction-engine), so a rate-limited stretch never locks blind verdicts
 * in for the month.
 *
 * A run takes about four hours inside the web process, and one that died used
 * to leave the rest of the universe on last month's verdicts without anyone
 * knowing (GAPS #21: the 2026-08-22 and 08-29 runs stopped part-way, cause
 * unknown). Now:
 *   - the OWNER is told when a run starts and how it ended: the tally, the
 *     duration, and how much of the universe the TABLE says is covered. A start
 *     with no end report means the process died and nothing picked the run up.
 *   - a restart on sweep day picks the run up again (resumeInterruptedSweep).
 *     It scores only what is not stored yet, so nothing already done is paid
 *     for twice — only the few symbols that were mid-flight when it died.
 *   - so does the sweep-day watchdog (runSweepWatchdog), every 30 minutes from
 *     09:00 to 20:00 UK, for a run that ended short in a process that lived on:
 *     a refused start, sources that failed part-way (2026-08-29), a run that
 *     threw. It starts at most WATCHDOG_MAX_RUNS runs a day.
 *   - either pick-up needs at least max(50, 1% of the universe) symbols left
 *     (shouldResumeSweep); fewer wait for on-demand scoring.
 *
 * Kill switch: CONVICTION_SWEEP=false (the monthly run, the restart pick-up and the watchdog)
 * No pick-up after a restart: CONVICTION_SWEEP_BOOT_RESUME=false
 * No sweep-day watchdog: CONVICTION_SWEEP_WATCHDOG=false
 * No owner messages: CONVICTION_SWEEP_ALERTS=false
 * Reuse instead of re-scoring (the pre-2026-09 behaviour): CONVICTION_SWEEP_FRESH=false
 * Manual trigger: POST /api/ops/conviction-sweep (ANALYSIS_API_TOKEN in the x-analysis-token header)
 */

const { getConviction, isAllNeutral } = require('./conviction-engine');
const StockData = require('../lib/shared/stock-data');
const OwnerAlerts = require('../lib/portfolio/close-failure-alerts');
const { formatDateTimeUK } = require('../lib/shared/date-format');

const { markdownSafe } = OwnerAlerts;

const CONCURRENCY = parseInt(process.env.CONVICTION_SWEEP_CONCURRENCY, 10) || 3;
const DELAY_MS = parseInt(process.env.CONVICTION_SWEEP_DELAY_MS, 10) || 300;

// The monthly cron fires at 08:00 UK ('0 8 * * 6' in lib/scanner/scanner.js) —
// keep the two in step
const SWEEP_HOUR_UK = 8;
// A restart looks for an unfinished run this long after boot: the server has
// settled, and the process it replaced is gone - on a deploy it stops within
// 20 s of SIGTERM (lib/shared/process-guards.js)
const RESUME_CHECK_DELAY_MS = 3 * 60 * 1000;
// A running sweep writes several verdicts a minute, so one written this
// recently means a run is still going somewhere; look again a little later
const BUSY_WINDOW_SECONDS = 120;
const RESUME_RECHECK_MS = 3 * 60 * 1000;
// A pick-up (after a restart, or by the watchdog) needs at least this many
// symbols left: 1% of the universe, and never fewer than 50. See shouldResumeSweep()
const RESUME_MIN_LEFT = 50;
const RESUME_MIN_PERCENT = 1;
// The sweep-day watchdog acts from 09:00 to 20:00 UK, both included (minutes
// after midnight; the scanner cron hub fires it at '*/30 9-20 * * 6'), and
// starts at most WATCHDOG_MAX_RUNS runs a day
const WATCHDOG_FIRST_MINUTE_UK = 9 * 60;
const WATCHDOG_LAST_MINUTE_UK = 20 * 60;
const WATCHDOG_MAX_RUNS = 3;
const MAX_ERROR_LENGTH = 200;

const TRIGGER_LABEL = {
    monthly: 'monthly run',
    resume: 'picked up after a restart',
    watchdog: 'picked up by the sweep-day watchdog',
    manual: 'manual run'
};

const status = {
    running: false,
    trigger: null,          // 'monthly' | 'resume' | 'watchdog' | 'manual'
    startedAt: null,
    finishedAt: null,
    total: 0,
    done: 0,
    scored: 0,
    withoutGemini: 0,       // of `scored`: stored on the rule-based scores alone
    reused: 0,
    blind: 0,
    skipped: 0,
    failed: 0,
    remaining: null,        // symbols the table still showed uncovered when the run ended
    lastSymbol: null,
    lastError: null
};

function getDB() {
    try {
        return require('../database-postgres');
    } catch (e) {
        return null;
    }
}

// Read window: how old a stored verdict may be and still be served — must
// mirror the default in conviction-engine.js (37: consecutive first
// Saturdays are at most 35 days apart, plus margin).
function readWindowDays() {
    const days = parseInt(process.env.CONVICTION_MAX_AGE_DAYS, 10);
    return days > 0 ? days : 37;
}

// Resume window: how recent a verdict must be for the sweep to SKIP the
// symbol. Deliberately much shorter than the read window — long enough that
// a crashed sweep resumed days later skips its finished symbols, but shorter
// than the 28-day minimum gap between monthly sweeps, so a new month's sweep
// always re-scores the whole universe.
function resumeWindowDays() {
    const days = parseInt(process.env.CONVICTION_SWEEP_RESUME_DAYS, 10);
    return days > 0 ? days : 14;
}

// The oldest score_date inside the resume window
function resumeCutoff() {
    return new Date(Date.now() - (resumeWindowDays() - 1) * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];
}

// Fresh re-score is the default. CONVICTION_SWEEP_FRESH=false goes back to
// reusing any verdict still inside the read window — every other sweep then
// re-scores next to nothing, which halves the AI calls and lets verdicts
// expire mid-month into piecemeal on-demand scoring.
function sweepIsFresh() {
    return process.env.CONVICTION_SWEEP_FRESH !== 'false';
}

function sweepAlertsEnabled() {
    return process.env.CONVICTION_SWEEP_ALERTS !== 'false';
}

function bootResumeEnabled() {
    return process.env.CONVICTION_SWEEP_BOOT_RESUME !== 'false';
}

function watchdogEnabled() {
    return process.env.CONVICTION_SWEEP_WATCHDOG !== 'false';
}

// The runs the watchdog has started, for one UK date at a time. In memory:
// a restart forgets it, and the restart check covers that moment anyway
const watchdogDay = { date: null, runs: 0 };

function watchdogRunsOn(date) {
    return watchdogDay.date === date ? watchdogDay.runs : 0;
}

function tally() {
    return `${status.scored} scored (${status.withoutGemini} without Gemini), ${status.reused} reused, ${status.blind} blind, ${status.skipped} skipped, ${status.failed} failed`;
}

/**
 * The Europe/London wall clock: weekday (0 = Sunday), day of the month, hour,
 * minute, and the date as YYYY-MM-DD.
 */
function ukClock(now = new Date()) {
    const parts = {};
    const format = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
    });
    for (const part of format.formatToParts(now)) parts[part.type] = part.value;
    return {
        weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday),
        day: parseInt(parts.day, 10),
        hour: parseInt(parts.hour, 10),
        minute: parseInt(parts.minute, 10),
        date: `${parts.year}-${parts.month}-${parts.day}`
    };
}

/**
 * The watchdog's hours: 09:00 to 20:00 UK, both included.
 */
function withinWatchdogHours(now = new Date()) {
    const { hour, minute } = ukClock(now);
    const minuteOfDay = hour * 60 + minute;
    return minuteOfDay >= WATCHDOG_FIRST_MINUTE_UK && minuteOfDay <= WATCHDOG_LAST_MINUTE_UK;
}

/**
 * Sweep day: the FIRST Saturday of the month, in the UK. The one definition
 * the monthly cron and the restart pick-up both use, so they cannot disagree.
 */
function isSweepDay(now = new Date()) {
    const { weekday, day } = ukClock(now);
    return weekday === 6 && day <= 7;
}

// The full universe, deduplicated
function universeStocks() {
    const bySymbol = new Map();
    for (const stock of StockData.getAllStocks()) {
        if (stock && stock.symbol && !bySymbol.has(stock.symbol)) {
            bySymbol.set(stock.symbol, stock);
        }
    }
    return [...bySymbol.values()];
}

/**
 * Symbols already scored inside the resume window — skipped so re-runs
 * resume instead of starting over. null when the table cannot be read:
 * never read that as "nothing is done", or a re-run would pay to score the
 * whole universe again.
 */
async function alreadyScored() {
    try {
        const db = getDB();
        if (!db || !db.pool) return null;
        const result = await db.pool.query(
            `SELECT DISTINCT symbol FROM conviction_daily WHERE score_date >= $1`,
            [resumeCutoff()]
        );
        return new Set(result.rows.map(r => r.symbol));
    } catch (e) {
        return null;
    }
}

/**
 * Seconds since the newest verdict was written, by any process — null when
 * none is inside the resume window. Throws when the table cannot be read.
 */
async function secondsSinceLastWrite() {
    const db = getDB();
    if (!db || !db.pool) throw new Error('Database unavailable');
    const result = await db.pool.query(
        `SELECT EXTRACT(EPOCH FROM (LOCALTIMESTAMP - max(created_at)))::int AS "age"
         FROM conviction_daily WHERE score_date >= $1`,
        [resumeCutoff()]
    );
    const age = result.rows[0] ? result.rows[0].age : null;
    return age === null || age === undefined ? null : Number(age);
}

/**
 * Tell the OWNER, and nobody else, through the owner-only sender the exit
 * monitor and the high-conviction manager share (close-failure-alerts.js
 * notifyOwner): a direct message to ADMIN_EMAIL's linked Telegram — never a
 * broadcast, never the ntfy topic, no TELEGRAM_CHAT_ID fallback — Markdown
 * first, then plain. Never throws: a report that cannot be sent must not
 * stop a sweep.
 *
 * @returns {Promise<boolean>} whether the message was delivered
 */
async function notifyOwner(message) {
    if (!sweepAlertsEnabled()) return false;
    try {
        const TradeDB = getDB();
        if (!TradeDB || typeof TradeDB.getUserChatId !== 'function') {
            console.log('⚠️ [AI SWEEP] Owner report not sent: no database to look up the owner\'s chat');
            return false;
        }
        const delivered = await OwnerAlerts.notifyOwner(message, {
            TradeDB,
            telegramBot: require('../lib/telegram/telegram-bot')
        });
        if (!delivered) console.log('⚠️ [AI SWEEP] Owner report not delivered');
        return delivered;
    } catch (error) {
        console.error('❌ [AI SWEEP] Owner report failed:', error.message);
        return false;
    }
}

const count = n => Number(n).toLocaleString('en-GB');
const symbolCount = n => `${count(n)} symbol${n === 1 ? '' : 's'}`;

function formatDuration(ms) {
    const minutes = Math.max(0, Math.round(ms / 60000));
    const hours = Math.floor(minutes / 60);
    return hours > 0 ? `${hours}h ${String(minutes % 60).padStart(2, '0')}m` : `${minutes}m`;
}

function triggerLabel(trigger) {
    return TRIGGER_LABEL[trigger] || markdownSafe(trigger);
}

const REFIRE_HINT = 're-fire POST /api/ops/conviction-sweep, which skips what is done';

function formatStartMessage({ trigger, universe, toScore, fresh }) {
    return `${trigger === 'resume' || trigger === 'watchdog' ? '🔁 *AI SWEEP PICKED UP AGAIN*' : '🧠 *AI SWEEP STARTED*'} — ${triggerLabel(trigger)}\n\n` +
        `📋 *To score:* ${count(toScore)} of ${count(universe)} symbols ` +
        `(skipping ${count(universe - toScore)} with a verdict from the last ${resumeWindowDays()} days)\n` +
        `🔄 *Mode:* ${fresh ? 'fresh re-score' : `${markdownSafe('CONVICTION_SWEEP_FRESH=false')}: verdicts still in date are reused`}\n` +
        `🕐 *Time:* ${formatDateTimeUK(new Date())}\n\n` +
        `A report follows when the run ends. No report means the run died and nothing picked it up: ${REFIRE_HINT}.`;
}

/**
 * The end report's word on the symbols a run left behind: what will pick them
 * up, and only what really will. A pick-up needs sweep day and at least
 * resumeThreshold() symbols left; the watchdog, its hours and a run to spare.
 */
function pickUpNote(remaining, universe, now = new Date()) {
    if (process.env.CONVICTION_SWEEP === 'false' || !isSweepDay(now)) {
        return 'To finish them: ';
    }
    if (remaining < resumeThreshold(universe)) {
        return `No automatic pick-up for fewer than ${count(resumeThreshold(universe))}. To finish them: `;
    }
    const { hour, minute, date } = ukClock(now);
    if (watchdogEnabled() && hour * 60 + minute < WATCHDOG_LAST_MINUTE_UK && watchdogRunsOn(date) < WATCHDOG_MAX_RUNS) {
        return 'The sweep-day watchdog picks them up within 30 minutes. Or ';
    }
    return bootResumeEnabled() ? 'A restart today picks them up. Or ' : 'To finish them: ';
}

/**
 * @param {object} run       the run's status at the end, plus stoppedEarly and remaining
 * @param {number} universe  universe size
 */
function formatEndMessage(run, universe) {
    const short = run.remaining !== 0 || run.stoppedEarly;
    const coverage = run.remaining === null
        ? `📚 *Covered:* unknown — ${markdownSafe('conviction_daily')} could not be read after the run\n`
        : `📚 *Covered:* ${count(universe - run.remaining)} of ${count(universe)} symbols hold a verdict from the last ${resumeWindowDays()} days\n`;

    let message = `${short ? '⚠️ *AI SWEEP FINISHED SHORT*' : '✅ *AI SWEEP FINISHED*'} — ${triggerLabel(run.trigger)}\n\n` +
        `🧮 *This run:* ${count(run.scored)} scored · ${count(run.reused)} reused · ${count(run.blind)} blind · ` +
        `${count(run.skipped)} skipped · ${count(run.failed)} failed\n` +
        coverage +
        `⏱ *Took:* ${formatDuration(Date.parse(run.finishedAt) - Date.parse(run.startedAt))} ` +
        `(${formatDateTimeUK(run.startedAt)} → ${formatDateTimeUK(run.finishedAt)})\n`;

    if (run.stoppedEarly) {
        message += '⏹ Stopped before the end of its queue.\n';
    }
    // With a key configured, a rule-based verdict means Gemini failed. On 2026-08-29 it failed
    // mid-run and the sweep raced on at ten times the pace, rule-based, until it stored nothing
    if (run.withoutGemini > 0 && process.env.GEMINI_API_KEY) {
        message += `🤖 *Gemini failed for ${symbolCount(run.withoutGemini)}:* their stored verdicts are rule-based, ` +
            `and a re-fire within ${resumeWindowDays()} days skips them.\n`;
    }
    if (run.lastError) {
        message += `❌ *Last error:* ${markdownSafe(String(run.lastError).slice(0, MAX_ERROR_LENGTH))}\n`;
    }
    if (run.remaining > 0) {
        message += `\n${symbolCount(run.remaining)} left without a verdict this recent: each keeps its older one ` +
            'until that expires, then gets scored on demand, one at a time. ' +
            `${pickUpNote(run.remaining, universe)}${REFIRE_HINT}.`;
    }
    return message;
}

function formatRefusalMessage(trigger) {
    return `⚠️ *AI SWEEP DID NOT START* — ${triggerLabel(trigger)}\n\n` +
        `${markdownSafe('conviction_daily')} could not be read, so the sweep cannot tell which symbols are already ` +
        'done. Starting anyway would re-score, and pay for, the whole universe.\n' +
        `🕐 *Time:* ${formatDateTimeUK(new Date())}\n\n` +
        `Once the database answers: ${REFIRE_HINT}.`;
}

/**
 * @param {object} [options]
 * @param {'monthly'|'resume'|'watchdog'|'manual'} [options.trigger]  who started it: the cron, a restart, the watchdog, or a person
 */
async function runConvictionSweep({ trigger = 'manual' } = {}) {
    if (status.running) {
        return { started: false, reason: 'Sweep already running' };
    }

    status.running = true;
    status.trigger = trigger;
    status.startedAt = new Date().toISOString();
    status.finishedAt = null;
    status.total = 0;
    status.done = 0;
    status.scored = 0;
    status.withoutGemini = 0;
    status.reused = 0;
    status.blind = 0;
    status.skipped = 0;
    status.failed = 0;
    status.remaining = null;
    status.lastError = null;

    const stocks = universeStocks();
    const scoredSet = await alreadyScored();
    if (!scoredSet) {
        status.running = false;
        status.finishedAt = new Date().toISOString();
        status.lastError = 'conviction_daily could not be read — refused to start rather than re-score (and pay for) the whole universe';
        console.error(`❌ [AI SWEEP] ${status.lastError}`);
        await notifyOwner(formatRefusalMessage(trigger));
        return { started: false, reason: status.lastError, ...getSweepStatus() };
    }

    const queue = [...stocks];
    status.total = queue.length;
    const toScore = stocks.filter(stock => !scoredSet.has(stock.symbol)).length;

    const fresh = sweepIsFresh();
    console.log(`\n🧠 [AI SWEEP] ${TRIGGER_LABEL[trigger] || trigger}: ${toScore} of ${queue.length} stocks to score (${queue.length - toScore} already scored this window, will skip)`);
    console.log(fresh
        ? '🧠 [AI SWEEP] Fresh re-score: stored verdicts are replaced, not reused'
        : '🧠 [AI SWEEP] CONVICTION_SWEEP_FRESH=false: a verdict still inside the read window is REUSED, not re-scored');
    console.log(`🧠 [AI SWEEP] Concurrency ${CONCURRENCY}, delay ${DELAY_MS} ms — expect a few hours\n`);
    await notifyOwner(formatStartMessage({ trigger, universe: queue.length, toScore, fresh }));

    async function worker() {
        while (queue.length > 0 && status.running) {
            const stock = queue.shift();
            status.lastSymbol = stock.symbol;

            if (scoredSet.has(stock.symbol)) {
                status.skipped++;
                status.done++;
                continue;
            }

            try {
                const askedAt = Date.now();
                const payload = await getConviction({ symbol: stock.symbol, name: stock.name, fresh });
                // Count what really happened: a verdict generated before we
                // asked was handed back from the store, and one where every
                // source was down is never stored — neither refreshed anything
                if (!(Date.parse(payload.generatedAt) >= askedAt)) status.reused++;
                else if (isAllNeutral(payload)) status.blind++;
                else {
                    status.scored++;
                    // Gemini failed (or has no key): the rule-based scores were stored
                    if (payload.engine === 'rule-based') status.withoutGemini++;
                }
            } catch (error) {
                status.failed++;
                status.lastError = `${stock.symbol}: ${error.message}`;
            }
            status.done++;

            if (status.done % 250 === 0) {
                console.log(`🧠 [AI SWEEP] ${status.done}/${status.total} (${tally()})`);
            }

            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
    }

    try {
        await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    } finally {
        status.running = false;
        status.finishedAt = new Date().toISOString();
        console.log(`\n🧠 [AI SWEEP] Complete: ${tally()} of ${status.total}\n`);
    }

    // How the run really ended, read from the table rather than the tally: a
    // blind result or a failed write leaves a symbol uncovered, however counted
    const run = { ...getSweepStatus(), stoppedEarly: queue.length > 0 };
    const covered = await alreadyScored();
    run.remaining = covered ? stocks.filter(stock => !covered.has(stock.symbol)).length : null;
    if (status.startedAt === run.startedAt) {
        status.remaining = run.remaining;       // unless another run has begun meanwhile
    }
    console.log(`🧠 [AI SWEEP] Coverage: ${run.remaining === null
        ? 'unknown (conviction_daily unreadable)'
        : `${stocks.length - run.remaining} of ${stocks.length} symbols, ${run.remaining} left`}`);
    await notifyOwner(formatEndMessage(run, stocks.length));

    return { started: true, ...run };
}

function stopSweep() {
    status.running = false;
}

function getSweepStatus() {
    return { ...status };
}

/**
 * The fallback: anything the sweep has not stored yet is worth picking up.
 * resolveShouldResume() falls back to it when the policy below misbehaves,
 * so a broken policy errs towards coverage.
 */
function anythingLeft(state) {
    return state.remaining > 0;
}

/**
 * The fewest symbols left that a pick-up is worth starting for: 1% of the
 * universe, and never fewer than 50 (51 of today's 5,029).
 */
function resumeThreshold(universe) {
    return Math.max(RESUME_MIN_LEFT, Math.ceil(universe * RESUME_MIN_PERCENT / 100));
}

/**
 * Should the sweep be picked up again, after a restart or by the sweep-day
 * watchdog? Yes when at least resumeThreshold() symbols are left
 * (README §4.7).
 *
 * Why a floor: a run that FINISHED still leaves its blind and failed symbols
 * uncovered, and each pick-up costs a run plus two Telegram messages (picked
 * up, finished). Without a floor every deploy that day, and every watchdog
 * check, would retry a handful of dead tickers. A real death leaves hundreds
 * or thousands behind; a handful waits for on-demand scoring instead, one
 * Gemini call per symbol when something asks for it.
 *
 * The hour and minutesSinceLastWrite do not matter. A pick-up scores only
 * what is not stored, so a late one costs no more than an early one, and a
 * run another process is still writing is kept away by the busy check
 * (BUSY_WINDOW_SECONDS) before this is asked.
 *
 * Rails no policy can break (resumeInterruptedSweep): CONVICTION_SWEEP and the
 * caller's own switch (CONVICTION_SWEEP_BOOT_RESUME or
 * CONVICTION_SWEEP_WATCHDOG), sweep day only, never before the 08:00 cron,
 * never while a sweep runs here or another process is still writing
 * verdicts, never when conviction_daily cannot be read. A policy that throws
 * or returns anything but true/false is replaced by anythingLeft().
 *
 * @param {object} state
 * @param {number} state.remaining  universe symbols with no verdict from the last CONVICTION_SWEEP_RESUME_DAYS days
 * @param {number} state.universe   universe size
 * @param {number} state.ukHour     0-23, Europe/London
 * @param {number|null} state.minutesSinceLastWrite  since the newest verdict (null: none in that window)
 * @returns {boolean} true = pick the sweep up now
 */
function shouldResumeSweep(state) {
    return state.remaining >= resumeThreshold(state.universe);
}

/**
 * Run the resume policy and keep its answer inside safe bounds.
 */
function resolveShouldResume(state, policy = shouldResumeSweep) {
    let answer;
    try {
        answer = policy(state);
    } catch (error) {
        console.error('❌ [AI SWEEP] shouldResumeSweep() threw — using the plain rule:', error.message);
    }
    return typeof answer === 'boolean' ? answer : anythingLeft(state);
}

/**
 * Pick an unfinished sweep up: if today is sweep day and the table shows the
 * universe is not covered, start the sweep again. The resume window makes
 * that safe: whatever is already stored is skipped, not paid for twice.
 * Two callers, each with its own switch: a restart (scheduleResumeCheck,
 * trigger 'resume', CONVICTION_SWEEP_BOOT_RESUME) and the sweep-day watchdog
 * (runSweepWatchdog, trigger 'watchdog', CONVICTION_SWEEP_WATCHDOG). Never
 * throws; answers what it decided and why.
 *
 * @param {object} [options]
 * @param {Date} [options.now]          the moment to judge "sweep day" and the UK hour by
 * @param {Function} [options.policy]   the resume policy (tests)
 * @param {'resume'|'watchdog'} [options.trigger]  who is asking: a restart (the default) or the watchdog
 * @returns {Promise<{resumed: boolean, reason?: string, retry?: boolean, remaining?: number, run?: Promise}>}
 */
async function resumeInterruptedSweep({ now = new Date(), policy = shouldResumeSweep, trigger = 'resume' } = {}) {
    const byWatchdog = trigger === 'watchdog';
    try {
        if (process.env.CONVICTION_SWEEP === 'false') {
            return { resumed: false, reason: 'CONVICTION_SWEEP=false' };
        }
        if (byWatchdog && !watchdogEnabled()) {
            return { resumed: false, reason: 'CONVICTION_SWEEP_WATCHDOG=false' };
        }
        if (!byWatchdog && !bootResumeEnabled()) {
            return { resumed: false, reason: 'CONVICTION_SWEEP_BOOT_RESUME=false' };
        }
        if (!isSweepDay(now)) {
            return { resumed: false, reason: 'not sweep day' };
        }
        const { hour } = ukClock(now);
        if (hour < SWEEP_HOUR_UK) {
            return { resumed: false, reason: `before ${SWEEP_HOUR_UK}:00 UK — the monthly cron starts the run` };
        }
        if (status.running) {
            return { resumed: false, reason: 'a sweep is already running in this process' };
        }

        const done = await alreadyScored();
        if (!done) {
            return { resumed: false, reason: 'conviction_daily could not be read — not resuming blind' };
        }
        const stocks = universeStocks();
        const remaining = stocks.filter(stock => !done.has(stock.symbol)).length;
        if (remaining === 0) {
            return { resumed: false, reason: 'the whole universe is covered', remaining };
        }

        // After a deploy the old process keeps sweeping until Render kills it
        const secondsIdle = await secondsSinceLastWrite();
        if (secondsIdle !== null && secondsIdle < BUSY_WINDOW_SECONDS) {
            return {
                resumed: false,
                retry: true,
                remaining,
                reason: `a verdict was written ${secondsIdle}s ago — another process may still be sweeping`
            };
        }

        const state = {
            remaining,
            universe: stocks.length,
            ukHour: hour,
            minutesSinceLastWrite: secondsIdle === null ? null : Math.floor(secondsIdle / 60)
        };
        if (!resolveShouldResume(state, policy)) {
            return { resumed: false, reason: 'shouldResumeSweep() declined', remaining };
        }

        // The monthly cron may have started a run while the table was being read
        if (status.running) {
            return { resumed: false, reason: 'a sweep is already running in this process' };
        }
        const run = runConvictionSweep({ trigger: byWatchdog ? 'watchdog' : 'resume' });
        run.catch(error => console.error('❌ [AI SWEEP] Picked-up run failed:', error.message));
        return { resumed: true, remaining, run };
    } catch (error) {
        return { resumed: false, reason: `restart check failed: ${error.message}` };
    }
}

/**
 * Called once at boot by the scanner cron hub. Looks for an unfinished sweep a
 * few minutes later, and keeps looking while another process is still writing
 * verdicts; that stops by itself when the day is no longer sweep day.
 */
function scheduleResumeCheck(delayMs = RESUME_CHECK_DELAY_MS) {
    const timer = setTimeout(async () => {
        const decision = await resumeInterruptedSweep();
        console.log(`🧠 [AI SWEEP] Restart check: ${decision.resumed
            ? `picking the sweep up again — ${symbolCount(decision.remaining)} left`
            : decision.reason}`);
        if (decision.retry) {
            scheduleResumeCheck(RESUME_RECHECK_MS);
        }
    }, delayMs);
    if (timer && typeof timer.unref === 'function') timer.unref();
    return timer;
}

/**
 * The sweep-day watchdog. The scanner cron hub fires it every 30 minutes on
 * Saturdays from 09:00 to 20:30 UK. From 09:00 to 20:00 on sweep day it picks
 * up a run that ended short while the process lived on, which no restart
 * will ever pick up: a refused start, sources that failed part-way
 * (2026-08-29), a run that threw. The same rails and policy as a restart,
 * plus two of its own: those hours only, and at most WATCHDOG_MAX_RUNS runs a
 * day, so sources that stay down all day cost three futile runs (and six
 * messages), not twenty-three. Never throws. Logs what it decided on sweep
 * day, and nothing on any other day.
 *
 * @param {object} [options]
 * @param {Date} [options.now]          the moment to judge "sweep day" and the UK time by
 * @param {Function} [options.policy]   the resume policy (tests)
 * @returns {Promise<{resumed: boolean, reason?: string, retry?: boolean, remaining?: number, run?: Promise}>}
 */
async function runSweepWatchdog({ now = new Date(), policy = shouldResumeSweep } = {}) {
    if (!isSweepDay(now)) {
        return { resumed: false, reason: 'not sweep day' };
    }
    const { date } = ukClock(now);
    let decision;
    if (!withinWatchdogHours(now)) {
        decision = { resumed: false, reason: 'outside the watchdog hours (09:00-20:00 UK)' };
    } else if (watchdogRunsOn(date) >= WATCHDOG_MAX_RUNS) {
        decision = { resumed: false, reason: `the watchdog has already started ${WATCHDOG_MAX_RUNS} runs today` };
    } else {
        decision = await resumeInterruptedSweep({ now, policy, trigger: 'watchdog' });
        if (decision.resumed) {
            watchdogDay.runs = watchdogRunsOn(date) + 1;
            watchdogDay.date = date;
        }
    }
    console.log(`🧠 [AI SWEEP] Watchdog: ${decision.resumed
        ? `picking the sweep up again — ${symbolCount(decision.remaining)} left`
        : decision.reason}`);
    return decision;
}

/**
 * Forget the runs the watchdog has started (tests).
 */
function resetWatchdog() {
    watchdogDay.date = null;
    watchdogDay.runs = 0;
}

/**
 * Monthly coverage: how many of the universe's symbols hold a verdict inside
 * the read window. Rendered on the Simulator page so it's visible that
 * "everything is in place" for the month.
 */
async function getCoverage() {
    const universe = new Set(StockData.getAllStocks().map(s => s.symbol)).size;
    try {
        const db = getDB();
        if (!db || !db.pool) return { universe, scored: 0 };
        const cutoff = new Date(Date.now() - (readWindowDays() - 1) * 24 * 60 * 60 * 1000)
            .toISOString().split('T')[0];
        const result = await db.pool.query(
            `SELECT COUNT(DISTINCT symbol) AS n, MAX(score_date) AS latest
             FROM conviction_daily WHERE score_date >= $1`,
            [cutoff]
        );
        return {
            universe,
            scored: parseInt(result.rows[0].n, 10) || 0,
            latestScoreDate: result.rows[0].latest || null
        };
    } catch (e) {
        return { universe, scored: 0 };
    }
}

/**
 * Read-only picture of the verdict store, for GET /api/ops/conviction-stats.
 * A genuine sweep is a universe-sized spike on one date (its first and last
 * write give its duration); verdicts scored on demand are a smear of small
 * counts. `served` groups the verdict each symbol is being served TODAY by
 * the date it was scored, with the last day the read window still accepts it.
 *
 * `day` (YYYY-MM-DD) adds that date's writes in 10-minute buckets, database
 * time (UTC on Render). It shows how a run ended: a process that dies stops
 * dead at full rate; failing sources taper off first, with rule-based rows
 * taking over from Gemini and `noPriceHistory` (rule-based rows whose Yahoo
 * price history was unavailable) rising.
 */
async function getVerdictStats(days = 120, { day = null } = {}) {
    const db = getDB();
    if (!db || !db.pool) throw new Error('Database unavailable');

    const DAY_MS = 24 * 60 * 60 * 1000;
    const isoDay = (ms) => new Date(ms).toISOString().split('T')[0];
    const readDays = readWindowDays();

    const byDate = await db.pool.query(
        `SELECT to_char(score_date, 'YYYY-MM-DD') AS "date",
                trim(to_char(score_date, 'Dy')) AS "day",
                count(*)::int AS "verdicts",
                count(*) FILTER (WHERE engine <> 'rule-based')::int AS "gemini",
                to_char(min(created_at), 'HH24:MI') AS "firstWrite",
                to_char(max(created_at), 'HH24:MI') AS "lastWrite"
         FROM conviction_daily
         WHERE score_date >= $1
         GROUP BY score_date
         ORDER BY score_date DESC`,
        [isoDay(Date.now() - days * DAY_MS)]
    );
    const served = await db.pool.query(
        `SELECT to_char(newest, 'YYYY-MM-DD') AS "scoredOn", count(*)::int AS "symbols"
         FROM (SELECT symbol, max(score_date) AS newest
               FROM conviction_daily WHERE score_date >= $1 GROUP BY symbol) latest
         GROUP BY newest
         ORDER BY newest DESC`,
        [isoDay(Date.now() - (readDays - 1) * DAY_MS)]
    );
    const totals = await db.pool.query(
        `SELECT count(*)::int AS "verdicts", count(DISTINCT symbol)::int AS "symbols",
                to_char(min(score_date), 'YYYY-MM-DD') AS "oldest",
                to_char(max(score_date), 'YYYY-MM-DD') AS "newest"
         FROM conviction_daily`
    );
    const timeline = day ? await db.pool.query(
        `SELECT to_char(date_trunc('hour', created_at)
                        + floor(extract(minute FROM created_at) / 10) * interval '10 minutes', 'HH24:MI') AS "at",
                count(*)::int AS "verdicts",
                count(*) FILTER (WHERE engine <> 'rule-based')::int AS "gemini",
                count(*) FILTER (WHERE engine = 'rule-based'
                                 AND payload #>> '{pillars,technical,evidence,0}' LIKE 'Price history unavailable%')::int AS "noPriceHistory"
         FROM conviction_daily
         WHERE score_date = $1
         GROUP BY 1
         ORDER BY 1`,
        [day]
    ) : null;

    return {
        universe: new Set(StockData.getAllStocks().map(s => s.symbol)).size,
        settings: {
            readWindowDays: readDays,
            resumeWindowDays: resumeWindowDays(),
            sweepEnabled: process.env.CONVICTION_SWEEP !== 'false',
            sweepFresh: sweepIsFresh(),
            bootResume: bootResumeEnabled(),
            watchdog: watchdogEnabled(),
            ownerReports: sweepAlertsEnabled(),
            geminiConfigured: !!process.env.GEMINI_API_KEY
        },
        totals: totals.rows[0],
        served: served.rows.map(r => ({
            ...r,
            servedUntil: isoDay(Date.parse(r.scoredOn) + (readDays - 1) * DAY_MS)
        })),
        byDate: byDate.rows,
        ...(timeline ? { timeline: { day, buckets: timeline.rows } } : {})
    };
}

module.exports = {
    runConvictionSweep,
    stopSweep,
    getSweepStatus,
    getCoverage,
    getVerdictStats,
    isSweepDay,
    resumeInterruptedSweep,
    scheduleResumeCheck,
    runSweepWatchdog,
    resetWatchdog,
    shouldResumeSweep
};
