/**
 * Benchmark return per trade (GAPS #15, README.md section 1)
 *
 * A trade that made 3% while its market's index made 5% did worse than holding the index, and nothing recorded
 * it. This job gives every closed position - in `trades` (the 1 PM executor's house and subscriber books and the
 * Positions page's own trades) and in `high_conviction_portfolio` - its market index's return over the same
 * holding window:
 *
 *   benchmark_return_percent = (index close on the exit day / index close on the entry day - 1) x 100
 *
 *   - the index: India ^NSEI (NIFTY 50), UK ^FTSE (FTSE 100), US ^GSPC (S&P 500), the same symbols as
 *     `marketIndices` in stock-data.js; benchmark_symbol records which. A row's market is its market column, else
 *     its symbol's (.NS or .BO India, .L UK, a plain ticker US; a trade added on the Positions page's form has
 *     none, an imported one keeps its export's). Any other market has no benchmark.
 *   - the entry and exit days are calendar days in the market's own time zone (a high-conviction row stores
 *     dates, which are used as they are);
 *   - "the close on a day" is the last daily close on or before it, so a weekend or holiday uses the session
 *     before it, and a position closed on the day it opened reads 0;
 *   - index levels, not total return: dividends are in neither this nor the trade's own P/L. Rounded to 4 places.
 *
 * No close waits for it. Every close path (the exit monitor, the Positions page's Sell, the high-conviction pass
 * and its admin close) only writes the exit; this job fills the benchmark afterwards, nightly at 23:40 UK (the
 * cron is in lib/scanner/scanner.js), when every market has closed. A row is filled once the index has a final
 * close on or after its exit day: an exit is filled the night of its exit day, a weekend or holiday exit after
 * the next session. It makes one Yahoo request per market that has rows to fill, per run (the in-process client,
 * lib/shared/yahoo-client.js), from the earliest entry among them. A market whose request fails is skipped with
 * one log line, its rows stay NULL and the next run asks again; the other markets are written. A row the index
 * cannot price (an entry before the index's first trading day, as Yahoo gives it, or an exit before the entry)
 * gets its benchmark_symbol and a NULL return, and is not asked again. A missed run costs nothing: the next one
 * fills everything still open.
 *
 *   BENCHMARK_FILL   'false' = kill switch: the job reads and writes nothing
 */
'use strict';

const YahooClient = require('../shared/yahoo-client');

// The cron expression lib/scanner/scanner.js schedules, in Europe/London time (a unit test keeps the two in step)
const CRON_EXPRESSION = '40 23 * * *';

// Each market's index, its time zone and its regular close (minutes after local midnight)
const BENCHMARKS = Object.freeze({
    India: Object.freeze({ symbol: '^NSEI', timeZone: 'Asia/Kolkata', closeMinute: 15 * 60 + 30 }),
    UK: Object.freeze({ symbol: '^FTSE', timeZone: 'Europe/London', closeMinute: 16 * 60 + 30 }),
    US: Object.freeze({ symbol: '^GSPC', timeZone: 'America/New_York', closeMinute: 16 * 60 })
});
// Until this long after the close, Yahoo's bar for today carries the live level, not the close
const SETTLE_MINUTES = 30;
// History asked for before the earliest entry, so an entry on a holiday still finds the close before it
const LEAD_DAYS = 10;
// Rows per table per run; the rest wait for the next run
const MAX_ROWS = 5000;
const FETCH_TIMEOUT_MS = 20000;
// Only these two tables are written; their names are interpolated into SQL
const TABLES = ['trades', 'high_conviction_portfolio'];

let running = false;

function getConfig(env = process.env) {
    // On by default; the off value is read loosely, like LEDGER_DRIFT_CHECK
    const killSwitch = String(env.BENCHMARK_FILL || '').trim().toLowerCase();
    return { enabled: !['false', '0', 'no', 'off'].includes(killSwitch) };
}

/** The market whose index benchmarks a position: its market column, else its symbol's exchange; null for none. */
function marketOf(row) {
    if (row && Object.prototype.hasOwnProperty.call(BENCHMARKS, row.market)) return row.market;
    const symbol = String((row && row.symbol) || '').trim().toUpperCase();
    if (/\.(NS|BO)$/.test(symbol)) return 'India';
    if (/\.L$/.test(symbol)) return 'UK';
    if (/^[A-Z][A-Z0-9-]{0,9}$/.test(symbol)) return 'US';
    return null;
}

const dayFormats = new Map();
/** A moment's calendar day, YYYY-MM-DD, in a time zone. */
function dayIn(moment, timeZone) {
    if (!dayFormats.has(timeZone)) {
        dayFormats.set(timeZone, new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }));
    }
    return dayFormats.get(timeZone).format(moment);
}

/** Minutes after midnight of a moment, in a time zone. */
function minuteIn(moment, timeZone) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(moment);
    const part = type => Number(parts.find(p => p.type === type).value);
    return part('hour') * 60 + part('minute');
}

/**
 * A position's entry or exit day in its market's time zone. `trades` stores timestamps (the driver hands back a
 * Date), `high_conviction_portfolio` dates (read as YYYY-MM-DD text, which is the day itself).
 */
function tradeDay(value, timeZone) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const moment = value instanceof Date ? value : new Date(value);
    return Number.isNaN(moment.getTime()) ? null : dayIn(moment, timeZone);
}

/**
 * The index's final daily closes from Yahoo's v8 chart answer, oldest first: [{ day, close }], each day in the
 * market's time zone. A bar without a close is dropped, and so is today's bar until SETTLE_MINUTES after the
 * market's close.
 */
function finalCloses(chart, market, now = new Date()) {
    const { timeZone, closeMinute } = BENCHMARKS[market];
    const result = chart && chart.chart && Array.isArray(chart.chart.result) ? chart.chart.result[0] : null;
    if (!result || !Array.isArray(result.timestamp)) return [];
    const quote = (result.indicators && Array.isArray(result.indicators.quote) && result.indicators.quote[0]) || {};
    const closes = Array.isArray(quote.close) ? quote.close : [];
    const today = dayIn(now, timeZone);
    const todayIsFinal = minuteIn(now, timeZone) >= closeMinute + SETTLE_MINUTES;
    const byDay = new Map();
    result.timestamp.forEach((stamp, i) => {
        const close = closes[i];
        if (typeof close !== 'number' || !Number.isFinite(close) || close <= 0) return;
        const day = dayIn(new Date(stamp * 1000), timeZone);
        if (day > today || (day === today && !todayIsFinal)) return;
        byDay.set(day, close);
    });
    return [...byDay.keys()].sort().map(day => ({ day, close: byDay.get(day) }));
}

/** The index's first trading day by Yahoo (meta.firstTradeDate), in the market's time zone; null when Yahoo does not say. */
function firstTradeDay(chart, market) {
    const result = chart && chart.chart && Array.isArray(chart.chart.result) ? chart.chart.result[0] : null;
    const first = result && result.meta ? result.meta.firstTradeDate : null;
    return typeof first === 'number' && Number.isFinite(first) ? dayIn(new Date(first * 1000), BENCHMARKS[market].timeZone) : null;
}

/** The last close on or before a day, or null. `closes` is oldest first. */
function closeOnOrBefore(closes, day) {
    let found = null;
    for (const bar of closes) {
        if (bar.day > day) break;
        found = bar;
    }
    return found;
}

/**
 * The index's percent change from its close on the entry day to its close on the exit day.
 *   { state: 'filled', percent }  both closes are final
 *   { state: 'waiting' }          no final close on or after the exit day yet: the next run asks again
 *   { state: 'unpriced' }         the index has no close on or before the entry day (or the exit precedes the
 *                                 entry): no number is honest. The job keeps such a row waiting instead when the
 *                                 entry is not before the index's first trading day: then the series was short.
 */
function benchmarkReturn(closes, entryDay, exitDay) {
    if (!entryDay || !exitDay || exitDay < entryDay) return { state: 'unpriced' };
    if (closes.length === 0 || closes[closes.length - 1].day < exitDay) return { state: 'waiting' };
    const entry = closeOnOrBefore(closes, entryDay);
    if (!entry) return { state: 'unpriced' };
    const exit = closeOnOrBefore(closes, exitDay);
    const percent = Math.round((exit.close / entry.close - 1) * 100 * 10000) / 10000;
    return { state: 'filled', percent: Object.is(percent, -0) ? 0 : percent };
}

function defaultPool() {
    try {
        const TradeDB = require('../../database-postgres');
        return TradeDB && TradeDB.pool && typeof TradeDB.pool.query === 'function' ? TradeDB.pool : null;
    } catch (error) {
        return null;
    }
}

/** Closed positions with no benchmark yet, from both tables, each with its market and its entry and exit days. */
async function pendingRows(pool) {
    const marketFilter = `(market IN ('India', 'UK', 'US') OR market IS NULL)`;
    const [trades, highConviction] = await Promise.all([
        pool.query(`
            SELECT id, symbol, market, entry_date AS entered, exit_date AS exited
            FROM trades
            WHERE status = 'closed' AND benchmark_symbol IS NULL AND entry_date IS NOT NULL AND exit_date IS NOT NULL
              AND ${marketFilter}
            ORDER BY id LIMIT ${MAX_ROWS}`),
        pool.query(`
            SELECT id, symbol, market, to_char(entry_date, 'YYYY-MM-DD') AS entered, to_char(exit_date, 'YYYY-MM-DD') AS exited
            FROM high_conviction_portfolio
            WHERE status = 'closed' AND benchmark_symbol IS NULL AND entry_date IS NOT NULL AND exit_date IS NOT NULL
              AND ${marketFilter}
            ORDER BY id LIMIT ${MAX_ROWS}`)
    ]);
    const rows = [];
    for (const [table, result] of [[TABLES[0], trades], [TABLES[1], highConviction]]) {
        for (const row of result.rows) {
            const market = marketOf(row);
            const timeZone = market ? BENCHMARKS[market].timeZone : null;
            rows.push({
                table, id: row.id, market,
                entryDay: market ? tradeDay(row.entered, timeZone) : null,
                exitDay: market ? tradeDay(row.exited, timeZone) : null
            });
        }
    }
    return rows;
}

/** One batched UPDATE per table; only a closed row with no benchmark yet is written. */
async function writeBenchmarks(pool, table, updates) {
    if (!TABLES.includes(table) || updates.length === 0) return 0;
    const result = await pool.query(`
        UPDATE ${table} AS t
        SET benchmark_symbol = v.symbol, benchmark_return_percent = v.percent
        FROM unnest($1::bigint[], $2::text[], $3::numeric[]) AS v(id, symbol, percent)
        WHERE t.id = v.id AND t.status = 'closed' AND t.benchmark_symbol IS NULL`,
    [updates.map(u => u.id), updates.map(u => u.symbol), updates.map(u => u.percent)]);
    return result.rowCount || 0;
}

/**
 * Fill the benchmark of every closed position that has none yet. Never throws: it runs from a cron. The answer is
 * a flat summary (lib/shared/job-runs.js keeps it in job_runs):
 *   pending   closed positions without a benchmark when the run started
 *   filled    rows written with a return
 *   unpriced  rows written with the index's symbol and no return (never asked again)
 *   waiting   rows whose exit day has no final index close yet
 *   failed    rows whose market's request failed (failedMarkets names them)
 *   noIndex   rows in a market without an index
 *
 * @param {object} [deps]  { pool, fetchChart(symbol, params, options), now, env }: the tests' seams
 */
async function runBenchmarkFill({ pool, fetchChart = YahooClient.fetchChart, now = new Date(), env = process.env } = {}) {
    if (!getConfig(env).enabled) return { enabled: false };
    if (running) return { enabled: true, skipped: 'already running' };
    const db = pool === undefined ? defaultPool() : pool;
    if (!db) return { enabled: true, skipped: 'no database' };
    running = true;
    const startedAt = Date.now();
    const summary = { enabled: true, pending: 0, filled: 0, unpriced: 0, waiting: 0, failed: 0, noIndex: 0, markets: null, failedMarkets: null };
    try {
        const rows = await pendingRows(db);
        summary.pending = rows.length;
        const updates = { trades: [], high_conviction_portfolio: [] };
        const byMarket = new Map();
        for (const row of rows) {
            if (!row.market) { summary.noIndex++; continue; }
            if (!row.entryDay || !row.exitDay || row.exitDay < row.entryDay) {
                // No window to price (no readable date, or an exit before the entry): marked, never fetched for
                summary.unpriced++;
                updates[row.table].push({ id: row.id, symbol: BENCHMARKS[row.market].symbol, percent: null });
                continue;
            }
            if (!byMarket.has(row.market)) byMarket.set(row.market, []);
            byMarket.get(row.market).push(row);
        }

        const fetched = [];
        const failedMarkets = [];
        for (const [market, marketRows] of byMarket) {
            const { symbol } = BENCHMARKS[market];
            const earliest = marketRows.reduce((min, row) => (row.entryDay < min ? row.entryDay : min), marketRows[0].entryDay);
            const period1 = Math.floor(Date.parse(earliest + 'T00:00:00Z') / 1000) - LEAD_DAYS * 86400;
            let closes;
            let inception;
            try {
                // One request per market per run
                const chart = await fetchChart(symbol, { period1, period2: Math.floor(now.getTime() / 1000), interval: '1d' }, { timeout: FETCH_TIMEOUT_MS });
                closes = finalCloses(chart, market, now);
                inception = firstTradeDay(chart, market);
                fetched.push(market);
            } catch (error) {
                console.error(`[BENCHMARK] ${symbol} (${market}) could not be read, ${marketRows.length} position(s) wait for the next run: ${error.message}`);
                failedMarkets.push(market);
                summary.failed += marketRows.length;
                continue;
            }
            for (const row of marketRows) {
                let outcome = benchmarkReturn(closes, row.entryDay, row.exitDay);
                // An entry the series does not reach is unpriced only when it precedes the index itself; otherwise
                // Yahoo sent less history than was asked for, and the next run asks again
                if (outcome.state === 'unpriced' && !(inception && row.entryDay < inception)) outcome = { state: 'waiting' };
                if (outcome.state === 'waiting') { summary.waiting++; continue; }
                if (outcome.state === 'filled') summary.filled++;
                else summary.unpriced++;
                updates[row.table].push({ id: row.id, symbol, percent: outcome.state === 'filled' ? outcome.percent : null });
            }
        }
        for (const table of TABLES) {
            await writeBenchmarks(db, table, updates[table]);
        }
        summary.markets = fetched.join(',') || null;
        summary.failedMarkets = failedMarkets.join(',') || null;
        summary.durationMs = Date.now() - startedAt;
        console.log(`[BENCHMARK] ${summary.pending} closed position(s) without a benchmark: ${summary.filled} filled, ` +
            `${summary.unpriced} unpriced, ${summary.waiting} waiting, ${summary.failed} failed, ${summary.noIndex} without an index`);
        return summary;
    } catch (error) {
        console.error('[BENCHMARK] Fill failed:', error.message);
        return { ...summary, error: String(error.message || error).slice(0, 300), durationMs: Date.now() - startedAt };
    } finally {
        running = false;
    }
}

module.exports = {
    runBenchmarkFill,
    benchmarkReturn,
    finalCloses,
    marketOf,
    tradeDay,
    getConfig,
    BENCHMARKS,
    CRON_EXPRESSION,
    SETTLE_MINUTES,
    LEAD_DAYS
};
