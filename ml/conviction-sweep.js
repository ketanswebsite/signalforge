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
 * skipped, so a crash or restart continues where it left off. Deliberately
 * gentle on the data sources: low concurrency plus a per-symbol delay.
 * Results where every pillar failed to neutral are not persisted (see
 * conviction-engine), so a rate-limited stretch never locks blind verdicts
 * in for the month.
 *
 * Kill switch: CONVICTION_SWEEP=false
 * Reuse instead of re-scoring (the pre-2026-09 behaviour): CONVICTION_SWEEP_FRESH=false
 * Manual trigger: POST /api/ops/conviction-sweep?token=ANALYSIS_API_TOKEN
 */

const { getConviction, isAllNeutral } = require('./conviction-engine');
const StockData = require('../lib/shared/stock-data');

const CONCURRENCY = parseInt(process.env.CONVICTION_SWEEP_CONCURRENCY, 10) || 3;
const DELAY_MS = parseInt(process.env.CONVICTION_SWEEP_DELAY_MS, 10) || 300;

const status = {
    running: false,
    startedAt: null,
    finishedAt: null,
    total: 0,
    done: 0,
    scored: 0,
    reused: 0,
    blind: 0,
    skipped: 0,
    failed: 0,
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

// Fresh re-score is the default. CONVICTION_SWEEP_FRESH=false goes back to
// reusing any verdict still inside the read window — every other sweep then
// re-scores next to nothing, which halves the AI calls and lets verdicts
// expire mid-month into piecemeal on-demand scoring.
function sweepIsFresh() {
    return process.env.CONVICTION_SWEEP_FRESH !== 'false';
}

function tally() {
    return `${status.scored} scored, ${status.reused} reused, ${status.blind} blind, ${status.skipped} skipped, ${status.failed} failed`;
}

/**
 * Symbols already scored inside the resume window — skipped so re-runs
 * resume instead of starting over.
 */
async function alreadyScored() {
    try {
        const db = getDB();
        if (!db || !db.pool) return new Set();
        const cutoff = new Date(Date.now() - (resumeWindowDays() - 1) * 24 * 60 * 60 * 1000)
            .toISOString().split('T')[0];
        const result = await db.pool.query(
            `SELECT DISTINCT symbol FROM conviction_daily WHERE score_date >= $1`,
            [cutoff]
        );
        return new Set(result.rows.map(r => r.symbol));
    } catch (e) {
        return new Set();
    }
}

async function runConvictionSweep() {
    if (status.running) {
        return { started: false, reason: 'Sweep already running' };
    }

    status.running = true;
    status.startedAt = new Date().toISOString();
    status.finishedAt = null;
    status.done = 0;
    status.scored = 0;
    status.reused = 0;
    status.blind = 0;
    status.skipped = 0;
    status.failed = 0;
    status.lastError = null;

    // Deduplicated full universe
    const bySymbol = new Map();
    for (const stock of StockData.getAllStocks()) {
        if (stock && stock.symbol && !bySymbol.has(stock.symbol)) {
            bySymbol.set(stock.symbol, stock);
        }
    }

    const scoredSet = await alreadyScored();
    const queue = [...bySymbol.values()];
    status.total = queue.length;

    const fresh = sweepIsFresh();
    console.log(`\n🧠 [AI SWEEP] Scoring ${queue.length} stocks (${scoredSet.size} already scored this window, will skip)`);
    console.log(fresh
        ? '🧠 [AI SWEEP] Fresh re-score: stored verdicts are replaced, not reused'
        : '🧠 [AI SWEEP] CONVICTION_SWEEP_FRESH=false: a verdict still inside the read window is REUSED, not re-scored');
    console.log(`🧠 [AI SWEEP] Concurrency ${CONCURRENCY}, delay ${DELAY_MS} ms — expect a few hours\n`);

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
                else status.scored++;
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

    return { started: true, ...getSweepStatus() };
}

function stopSweep() {
    status.running = false;
}

function getSweepStatus() {
    return { ...status };
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
 */
async function getVerdictStats(days = 120) {
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

    return {
        universe: new Set(StockData.getAllStocks().map(s => s.symbol)).size,
        settings: {
            readWindowDays: readDays,
            resumeWindowDays: resumeWindowDays(),
            sweepEnabled: process.env.CONVICTION_SWEEP !== 'false',
            sweepFresh: sweepIsFresh(),
            geminiConfigured: !!process.env.GEMINI_API_KEY
        },
        totals: totals.rows[0],
        served: served.rows.map(r => ({
            ...r,
            servedUntil: isoDay(Date.parse(r.scoredOn) + (readDays - 1) * DAY_MS)
        })),
        byDate: byDate.rows
    };
}

module.exports = { runConvictionSweep, stopSweep, getSweepStatus, getCoverage, getVerdictStats };
