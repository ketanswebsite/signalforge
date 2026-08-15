/**
 * Weekend AI conviction sweep
 *
 * Scores the FULL stock universe (~5,000 symbols) once over the weekend and
 * persists the verdicts to conviction_daily, where the engine's week-long
 * read window (CONVICTION_MAX_AGE_DAYS) serves them to the 7 AM scanner,
 * the 1 PM executor, the insights panel and the simulator all week.
 *
 * Runs Saturday morning from the scanner cron hub; resumable — symbols
 * already scored inside the current window are skipped, so a crash or
 * restart continues where it left off. Deliberately gentle on the data
 * sources: low concurrency plus a per-symbol delay. Results where every
 * pillar failed to neutral are not persisted (see conviction-engine), so a
 * rate-limited stretch never locks blind verdicts in for the week.
 *
 * Kill switch: CONVICTION_SWEEP=false
 * Manual trigger: POST /api/ops/conviction-sweep?token=ANALYSIS_API_TOKEN
 */

const { getConviction } = require('./conviction-engine');
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

function maxAgeDays() {
    const days = parseInt(process.env.CONVICTION_MAX_AGE_DAYS, 10);
    return days > 0 ? days : 7;
}

/**
 * Symbols already scored inside the current window — skipped so re-runs
 * resume instead of starting over.
 */
async function alreadyScored() {
    try {
        const db = getDB();
        if (!db || !db.pool) return new Set();
        const cutoff = new Date(Date.now() - (maxAgeDays() - 1) * 24 * 60 * 60 * 1000)
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

    console.log(`\n🧠 [AI SWEEP] Scoring ${queue.length} stocks (${scoredSet.size} already scored this window, will skip)`);
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
                await getConviction({ symbol: stock.symbol, name: stock.name });
                status.scored++;
            } catch (error) {
                status.failed++;
                status.lastError = `${stock.symbol}: ${error.message}`;
            }
            status.done++;

            if (status.done % 250 === 0) {
                console.log(`🧠 [AI SWEEP] ${status.done}/${status.total} (${status.scored} scored, ${status.skipped} skipped, ${status.failed} failed)`);
            }

            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
    }

    try {
        await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    } finally {
        status.running = false;
        status.finishedAt = new Date().toISOString();
        console.log(`\n🧠 [AI SWEEP] Complete: ${status.scored} scored, ${status.skipped} skipped, ${status.failed} failed of ${status.total}\n`);
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
 * Weekly coverage: how many of the universe's symbols hold a verdict inside
 * the current window. Rendered on the Simulator page so it's visible that
 * "everything is in place" for the week.
 */
async function getCoverage() {
    const universe = new Set(StockData.getAllStocks().map(s => s.symbol)).size;
    try {
        const db = getDB();
        if (!db || !db.pool) return { universe, scored: 0 };
        const cutoff = new Date(Date.now() - (maxAgeDays() - 1) * 24 * 60 * 60 * 1000)
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

module.exports = { runConvictionSweep, stopSweep, getSweepStatus, getCoverage };
