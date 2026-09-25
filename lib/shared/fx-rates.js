/**
 * Dated exchange rates (GAPS #11, README.md section 1): the rate of a day, for every figure the system converts
 * between the three currencies it trades in (GBP, INR, USD).
 *
 * Until 2026-09 each converter carried its own fixed rates (GBP_TO_INR 105, GBP_TO_USD 1.27, USD_TO_INR 83, ...):
 * the high-conviction book's P&L and investment in the other two currencies (its exit alerts, the weekly report's
 * totals across markets, its admin API) and the Simulator's portfolio value, P/L by market, trade table and CSV.
 * A pound buys well over 105 rupees now, so every converted figure was off, by a different amount for each trade.
 * Now each figure uses the rate of its own day:
 *
 *   - the store: fx_rates, one row per pair and London calendar day, the pair's final daily close from Yahoo (the
 *     in-process client, lib/shared/yahoo-client.js): GBPINR=X and GBPUSD=X, rupees and dollars per pound. The
 *     other four rates are derived from those two (dollars to rupees = GBPINR / GBPUSD), so all six agree;
 *   - "the rate of a day" is the last stored close on or before it: a weekend, a holiday, or today (its bar is not
 *     final yet) uses the close before it. A day before the first stored close uses the first one;
 *   - the refresh: 00:15 UK every day (the cron is in lib/scanner/scanner.js; job 'fx-rates' in job_runs), one Yahoo
 *     request per pair, from LEAD_DAYS before the newest stored day (an empty store asks for everything since
 *     HISTORY_START), so a missed night is caught up and a revised close corrected. A boot refreshes a store that
 *     is empty or more than STALE_DAYS behind, BOOT_DELAY_MS after it starts;
 *   - after each refresh the high-conviction book's converted columns are brought in line with the store
 *     (restampHighConviction): a closed position's P&L at its exit day's rate, every position's investment at its
 *     entry day's. The column in the market's own currency is the figure itself and is never written. So an exit
 *     alert sent in the day (at the latest stored close, usually the previous day's) is corrected in the table that
 *     night, and positions closed before this store existed get their own day's rate too.
 *
 * Nothing here decides a trade: the entry, the position size, the exits and the P&L in a position's own currency
 * never read a rate. A reader that finds no rate stored at all (a new database before its first refresh) keeps
 * its old fixed rates.
 *
 *   FX_RATES_REFRESH   'false' = kill switch: no Yahoo request and no restamp; the stored rates are still used
 */
'use strict';

const YahooClient = require('./yahoo-client');
const Input = require('./input');

// The cron expression lib/scanner/scanner.js schedules, in Europe/London time (a unit test keeps the two in step)
const CRON_EXPRESSION = '15 0 * * *';
// Units of the other currency per pound. A close outside its band is a bad tick and is never stored
const PAIRS = Object.freeze([
    Object.freeze({ pair: 'GBPINR', symbol: 'GBPINR=X', currency: 'INR', min: 50, max: 300 }),
    Object.freeze({ pair: 'GBPUSD', symbol: 'GBPUSD=X', currency: 'USD', min: 0.8, max: 2.5 })
]);
const CURRENCIES = Object.freeze(['GBP', 'INR', 'USD']);
// Yahoo's currency market keeps London's calendar: its daily bars start at midnight London time
const TIME_ZONE = 'Europe/London';
// An empty store asks Yahoo for everything since this day (the Simulator replays years)
const HISTORY_START = '2010-01-01';
// Each refresh asks again for this many days before the newest stored one
const LEAD_DAYS = 10;
// A boot refreshes a store whose newest close is more than this many days old (a weekend is three)
const STALE_DAYS = 4;
const BOOT_DELAY_MS = 60 * 1000;
// The in-memory copy of the store is read again after this long, and at once while it is empty
const LOAD_TTL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 20000;
// GET /api/fx/rates: the window it serves when none is asked for, and the longest one it serves
const DEFAULT_WINDOW_DAYS = 365;
const MAX_WINDOW_DAYS = 4000;
const DAY_MS = 24 * 60 * 60 * 1000;
// Each high-conviction market's own currency, as the manager books it: anything else is dollars
const MARKET_CURRENCY = Object.freeze({ UK: 'GBP', India: 'INR', US: 'USD' });

const DDL = `
    CREATE TABLE IF NOT EXISTS fx_rates (
        pair TEXT NOT NULL,
        day DATE NOT NULL,
        rate NUMERIC(18, 8) NOT NULL,
        fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (pair, day)
    )`;

function getConfig(env = process.env) {
    // On by default; the off value is read loosely, like BENCHMARK_FILL
    const killSwitch = String(env.FX_RATES_REFRESH || '').trim().toLowerCase();
    return { enabled: !['false', '0', 'no', 'off'].includes(killSwitch) };
}

function defaultPool() {
    try {
        const TradeDB = require('../../database-postgres');
        return TradeDB && TradeDB.pool && typeof TradeDB.pool.query === 'function' ? TradeDB.pool : null;
    } catch (error) {
        return null;
    }
}

// pool.query may answer a promise or a plain value (a test double); either way, a promise
const query = (pool, sql, params) => Promise.resolve().then(() => pool.query(sql, params));
const rowsOf = result => (result && Array.isArray(result.rows) ? result.rows : []);

const tables = new WeakMap();
function ensureTable(pool) {
    if (!tables.has(pool)) {
        tables.set(pool, query(pool, DDL).catch(error => {
            tables.delete(pool);
            throw error;
        }));
    }
    return tables.get(pool);
}

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
/** A moment's calendar day in London, YYYY-MM-DD. */
const londonDay = moment => dayFormat.format(moment);
/** YYYY-MM-DD plus n days. */
const addDays = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (from, to) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / DAY_MS);
/** A YYYY-MM-DD day from a day string (or a longer ISO string) or a Date (its UTC day), else null. */
function dayKey(value) {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
    if (typeof value !== 'string') return null;
    return Input.isoDate(value.slice(0, 10));
}
const round4 = value => Math.round(value * 10000) / 10000;

/** A high-conviction market's own currency: UK pounds, India rupees, anything else dollars. */
const currencyOfMarket = market => MARKET_CURRENCY[market] || 'USD';

// ---------------------------------------------------------------- the stored rates, in memory

// pair -> { days: ['YYYY-MM-DD', ...] oldest first, rates: [number, ...] }
let cache = { loadedAt: 0, pairs: new Map() };
let loading = null;

/** Read the whole store into memory (a few thousand rows). A store that does not exist yet reads as empty. */
async function load(pool) {
    let result;
    try {
        result = await query(pool, `SELECT pair, to_char(day, 'YYYY-MM-DD') AS day, rate::float8 AS rate FROM fx_rates ORDER BY pair, day`);
    } catch (error) {
        if (!error || error.code !== '42P01') throw error; // undefined_table: no refresh has run yet
    }
    const pairs = new Map();
    for (const row of rowsOf(result)) {
        const rate = Number(row.rate);
        if (!Number.isFinite(rate) || rate <= 0 || !dayKey(row.day)) continue;
        if (!pairs.has(row.pair)) pairs.set(row.pair, { days: [], rates: [] });
        pairs.get(row.pair).days.push(row.day);
        pairs.get(row.pair).rates.push(rate);
    }
    cache = { loadedAt: Date.now(), pairs };
    return cache;
}

/**
 * Make sure the stored rates are in memory: read at once while nothing is held, and again after LOAD_TTL_MS. Never
 * throws: a failed read keeps what was held (nothing, before the first read) and says so once per failure.
 * @param {object} [options]  { pool }: the tests' seam (default: the server's pool; without one, nothing is read)
 */
async function ensureLoaded({ pool } = {}) {
    const db = pool === undefined ? defaultPool() : pool;
    if (!db) return cache;
    if (hasRates() && Date.now() - cache.loadedAt < LOAD_TTL_MS) return cache;
    if (!loading) {
        loading = load(db)
            .catch(error => {
                console.error(`[FX] Could not read the stored exchange rates: ${error.message}`);
                return cache;
            })
            .finally(() => { loading = null; });
    }
    return loading;
}

/** True when both pairs have at least one stored close in memory. */
function hasRates() {
    return PAIRS.every(({ pair }) => cache.pairs.has(pair) && cache.pairs.get(pair).days.length > 0);
}

/**
 * A pair's rate on a day: the last stored close on or before it, else (a day before the first close) the first one.
 * @returns {{day: string, rate: number}|null}  the close used; null when the pair has nothing stored or no day is given
 */
function rateOn(pair, day) {
    const series = cache.pairs.get(pair);
    const key = dayKey(day);
    if (!series || series.days.length === 0 || !key) return null;
    let lo = 0;
    let hi = series.days.length - 1;
    let found = 0;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (series.days[mid] <= key) {
            found = mid;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    return { day: series.days[found], rate: series.rates[found] };
}

/** Units of each currency per pound on a day, with the older of the two closes used; null without both pairs. */
function perPound(day) {
    const inr = rateOn('GBPINR', day);
    const usd = rateOn('GBPUSD', day);
    if (!inr || !usd) return null;
    return { GBP: 1, INR: inr.rate, USD: usd.rate, day: inr.day < usd.day ? inr.day : usd.day };
}

/**
 * The six conversion rates on a day, in the shape the old fixed tables had (GBP_TO_INR, GBP_TO_USD, USD_TO_GBP,
 * USD_TO_INR, INR_TO_GBP, INR_TO_USD), plus the close's day. null when nothing is stored: the caller keeps its own.
 */
function ratesOn(day) {
    const per = perPound(day);
    if (!per) return null;
    return {
        GBP_TO_INR: per.INR,
        GBP_TO_USD: per.USD,
        USD_TO_GBP: 1 / per.USD,
        USD_TO_INR: per.INR / per.USD,
        INR_TO_GBP: 1 / per.INR,
        INR_TO_USD: per.USD / per.INR,
        day: per.day
    };
}

/** An amount from one currency into another at a day's rate; null when a rate or a currency is missing. */
function convert(amount, from, to, day) {
    if (!Number.isFinite(amount) || !CURRENCIES.includes(from) || !CURRENCIES.includes(to)) return null;
    if (from === to) return amount;
    const per = perPound(day);
    return per ? amount / per[from] * per[to] : null;
}

/** An amount in all three currencies at a day's rate ({GBP, INR, USD}, the given one unchanged); null without rates. */
function convertAll(amount, from, day) {
    const per = perPound(day);
    if (!per || !Number.isFinite(amount) || !CURRENCIES.includes(from)) return null;
    const out = {};
    for (const currency of CURRENCIES) out[currency] = currency === from ? amount : amount / per[from] * per[currency];
    return out;
}

/** Where the stored closes of both pairs begin and end ({first, newest}), or nulls when nothing is stored. */
function storedSpan() {
    if (!hasRates()) return { first: null, newest: null };
    const firsts = PAIRS.map(({ pair }) => cache.pairs.get(pair).days[0]);
    const newests = PAIRS.map(({ pair }) => cache.pairs.get(pair).days.slice(-1)[0]);
    return { first: firsts.sort().slice(-1)[0], newest: newests.sort()[0] };
}

/**
 * GET /api/fx/rates' window: from and to, each absent, empty or a real date written YYYY-MM-DD; to defaults to today
 * in London, from to DEFAULT_WINDOW_DAYS before to; at most MAX_WINDOW_DAYS apart.
 * @returns {{from: string, to: string}|{error: string}}
 */
function parseWindow({ from, to } = {}, now = new Date()) {
    for (const [name, value] of Object.entries({ from, to })) {
        if (value !== undefined && value !== '' && !Input.isoDate(value)) return { error: `${name} must be a date written YYYY-MM-DD` };
    }
    const end = to || londonDay(now);
    const start = from || addDays(end, -DEFAULT_WINDOW_DAYS);
    if (start > end) return { error: 'from must not be after to' };
    if (daysBetween(start, end) > MAX_WINDOW_DAYS) return { error: `at most ${MAX_WINDOW_DAYS} days a request` };
    return { from: start, to: end };
}

/**
 * Every calendar day from `from` to `to` with the rates in force that day: [day, GBPINR, GBPUSD], so a page converts
 * with a plain lookup by day. No day when nothing is stored.
 */
function dailySeries(from, to) {
    const days = [];
    if (hasRates()) {
        for (let day = from; day <= to; day = addDays(day, 1)) {
            days.push([day, rateOn('GBPINR', day).rate, rateOn('GBPUSD', day).rate]);
        }
    }
    const span = storedSpan();
    return {
        from,
        to,
        source: days.length > 0 ? 'dated' : 'none',
        firstStoredDay: span.first,
        newestStoredDay: span.newest,
        columns: ['day', 'GBPINR', 'GBPUSD'],
        days
    };
}

// ---------------------------------------------------------------- the refresh

/**
 * A pair's final daily closes from Yahoo's v8 chart answer, oldest first: [{ day, rate }], each day in London. Today's
 * bar (not final yet), a bar without a close and a close outside the pair's band are dropped; the last bar of a day wins.
 */
function finalCloses(chart, band, now = new Date()) {
    const result = chart && chart.chart && Array.isArray(chart.chart.result) ? chart.chart.result[0] : null;
    if (!result || !Array.isArray(result.timestamp)) return [];
    const quote = (result.indicators && Array.isArray(result.indicators.quote) && result.indicators.quote[0]) || {};
    const closes = Array.isArray(quote.close) ? quote.close : [];
    const today = londonDay(now);
    const byDay = new Map();
    result.timestamp.forEach((stamp, i) => {
        const close = closes[i];
        if (typeof close !== 'number' || !Number.isFinite(close) || close < band.min || close > band.max) return;
        const day = londonDay(new Date(stamp * 1000));
        if (day >= today) return;
        byDay.set(day, close);
    });
    return [...byDay.keys()].sort().map(day => ({ day, rate: byDay.get(day) }));
}

/** Upsert one pair's closes; a close already stored with the same rate is not written. Returns the rows written. */
async function storeCloses(pool, pair, closes) {
    if (closes.length === 0) return 0;
    const result = await query(pool, `
        INSERT INTO fx_rates (pair, day, rate)
        SELECT $1, v.day, v.rate FROM unnest($2::date[], $3::numeric[]) AS v(day, rate)
        ON CONFLICT (pair, day) DO UPDATE SET rate = EXCLUDED.rate, fetched_at = NOW()
        WHERE fx_rates.rate IS DISTINCT FROM EXCLUDED.rate`,
    [pair, closes.map(c => c.day), closes.map(c => c.rate)]);
    return (result && result.rowCount) || 0;
}

/**
 * Bring the high-conviction book's converted columns in line with the store: in each row the column in the market's
 * own currency is the figure and is never written; the other two become it at the dated rate - the P&L of a closed
 * position at its exit day's, the investment of every position at its entry day's. An active position's P&L is the
 * 10-minute pass's (lib/portfolio/high-conviction-manager.js, at the latest close). Only rows whose figures differ at
 * the columns' 4 places are written, in one statement. Returns how many.
 */
async function restampHighConviction(pool) {
    if (!hasRates()) return 0;
    const [table] = rowsOf(await query(pool, `SELECT to_regclass('public.high_conviction_portfolio') IS NOT NULL AS present`));
    if (!table || !table.present) return 0;
    const rows = rowsOf(await query(pool, `
        SELECT id, market, status, to_char(entry_date, 'YYYY-MM-DD') AS entry_day, to_char(exit_date, 'YYYY-MM-DD') AS exit_day,
               investment_gbp::float8 AS investment_gbp, investment_inr::float8 AS investment_inr, investment_usd::float8 AS investment_usd,
               pl_amount_gbp::float8 AS pl_amount_gbp, pl_amount_inr::float8 AS pl_amount_inr, pl_amount_usd::float8 AS pl_amount_usd
        FROM high_conviction_portfolio`));
    const columns = ['investment_gbp', 'investment_inr', 'investment_usd', 'pl_amount_gbp', 'pl_amount_inr', 'pl_amount_usd'];
    const updates = [];
    for (const row of rows) {
        const own = currencyOfMarket(row.market);
        const next = {};
        const restamp = (prefix, day) => {
            const figure = row[`${prefix}_${own.toLowerCase()}`];
            if (figure == null || !day) return;
            const all = convertAll(Number(figure), own, day);
            if (!all) return;
            for (const currency of CURRENCIES) {
                if (currency === own) continue;
                const column = `${prefix}_${currency.toLowerCase()}`;
                const value = round4(all[currency]);
                if (row[column] == null || round4(Number(row[column])) !== value) next[column] = value;
            }
        };
        restamp('investment', row.entry_day);
        if (row.status === 'closed') restamp('pl_amount', row.exit_day);
        if (Object.keys(next).length > 0) updates.push({ id: row.id, ...next });
    }
    if (updates.length === 0) return 0;
    await query(pool, `
        UPDATE high_conviction_portfolio AS h
        SET ${columns.map(column => `${column} = COALESCE(v.${column}, h.${column})`).join(', ')}
        FROM unnest($1::int[], ${columns.map((column, i) => `$${i + 2}::numeric[]`).join(', ')})
             AS v(id, ${columns.join(', ')})
        WHERE h.id = v.id`,
    [updates.map(u => u.id), ...columns.map(column => updates.map(u => (column in u ? u[column] : null)))]);
    return updates.length;
}

let running = false;

/**
 * Refresh the store: one Yahoo request per pair, then read the store into memory and restamp the high-conviction book.
 * Never throws: it runs from a cron. A pair whose request fails keeps its stored closes (one log line) and the other
 * is still written. The answer is a flat summary (lib/shared/job-runs.js keeps it in job_runs):
 *   requested    requests made
 *   stored       closes written (new, or a revised rate)
 *   pairs        the pairs Yahoo answered; failedPairs the ones it did not
 *   newestDay    the newest day both pairs have a close for
 *   restamped    high-conviction positions whose converted figures changed
 *
 * @param {object} [deps]  { pool, fetchChart(symbol, params, options), now, env }: the tests' seams
 */
async function refreshFxRates({ pool, fetchChart = YahooClient.fetchChart, now = new Date(), env = process.env } = {}) {
    if (!getConfig(env).enabled) return { enabled: false };
    if (running) return { enabled: true, skipped: 'already running' };
    const db = pool === undefined ? defaultPool() : pool;
    if (!db) return { enabled: true, skipped: 'no database' };
    running = true;
    const startedAt = Date.now();
    const summary = { enabled: true, requested: 0, stored: 0, pairs: null, failedPairs: null, newestDay: null, restamped: 0 };
    try {
        await ensureTable(db);
        const newest = new Map(rowsOf(await query(db, `SELECT pair, to_char(MAX(day), 'YYYY-MM-DD') AS newest FROM fx_rates GROUP BY pair`))
            .map(row => [row.pair, row.newest]));
        const fetched = [];
        const failed = [];
        for (const band of PAIRS) {
            const from = newest.get(band.pair) ? addDays(newest.get(band.pair), -LEAD_DAYS) : HISTORY_START;
            summary.requested++;
            let closes;
            try {
                // One request per pair per run
                const chart = await fetchChart(band.symbol, {
                    period1: Math.floor(Date.parse(from + 'T00:00:00Z') / 1000),
                    period2: Math.floor(now.getTime() / 1000),
                    interval: '1d'
                }, { timeout: FETCH_TIMEOUT_MS });
                closes = finalCloses(chart, band, now);
            } catch (error) {
                console.error(`[FX] ${band.symbol} could not be read, its stored rates stand until the next run: ${error.message}`);
                failed.push(band.pair);
                continue;
            }
            summary.stored += await storeCloses(db, band.pair, closes);
            fetched.push(band.pair);
        }
        await load(db);
        summary.restamped = await restampHighConviction(db);
        summary.pairs = fetched.join(',') || null;
        summary.failedPairs = failed.join(',') || null;
        summary.newestDay = storedSpan().newest;
        summary.durationMs = Date.now() - startedAt;
        console.log(`[FX] Exchange rates: ${summary.stored} close(s) stored from ${summary.requested} request(s)` +
            `${summary.failedPairs ? ` (failed: ${summary.failedPairs})` : ''}, newest ${summary.newestDay || 'none'}; ` +
            `${summary.restamped} high-conviction position(s) restamped`);
        return summary;
    } catch (error) {
        console.error('[FX] Refresh failed:', error.message);
        return { ...summary, error: String(error.message || error).slice(0, 300), durationMs: Date.now() - startedAt };
    } finally {
        running = false;
    }
}

/** Why the store needs a refresh at boot: 'empty' (a pair has nothing), 'behind' (older than STALE_DAYS), else null. */
function storeBehind(now = new Date()) {
    if (!hasRates()) return 'empty';
    return storedSpan().newest < addDays(londonDay(now), -STALE_DAYS) ? 'behind' : null;
}

/**
 * At boot: read the store, and refresh it (recorded in job_runs as 'fx-rates') when it is empty or behind. Never
 * throws. A first deploy fills the store this way; a process that was down for days catches up.
 */
async function bootCatchUp({ pool, now = new Date(), env = process.env, fetchChart } = {}) {
    try {
        if (!getConfig(env).enabled) return { refreshed: false, reason: 'FX_RATES_REFRESH=false' };
        const db = pool === undefined ? defaultPool() : pool;
        if (!db) return { refreshed: false, reason: 'no database' };
        await ensureLoaded({ pool: db });
        const behind = storeBehind(now);
        if (!behind) {
            console.log(`[FX] Boot: the stored exchange rates are current (newest ${storedSpan().newest})`);
            return { refreshed: false, reason: 'current' };
        }
        console.log(`[FX] Boot: the stored exchange rates are ${behind}; refreshing`);
        const summary = await require('./job-runs').recordRun('fx-rates',
            () => refreshFxRates({ pool: db, now, env, ...(fetchChart ? { fetchChart } : {}) }), { pool: db });
        return { refreshed: true, reason: behind, summary };
    } catch (error) {
        console.error('[FX] Boot catch-up failed:', error.message);
        return { refreshed: false, reason: `failed: ${error.message}` };
    }
}

/** Called once at boot by the scanner cron hub: the catch-up, BOOT_DELAY_MS later. Nothing when switched off. */
function scheduleBootCatchUp({ delayMs = BOOT_DELAY_MS, env = process.env } = {}) {
    if (!getConfig(env).enabled) return null;
    const timer = setTimeout(() => { bootCatchUp({ env }); }, delayMs);
    if (timer && typeof timer.unref === 'function') timer.unref();
    return timer;
}

module.exports = {
    refreshFxRates,
    restampHighConviction,
    finalCloses,
    load,
    ensureLoaded,
    hasRates,
    rateOn,
    ratesOn,
    convert,
    convertAll,
    dailySeries,
    parseWindow,
    storeBehind,
    bootCatchUp,
    scheduleBootCatchUp,
    currencyOfMarket,
    getConfig,
    PAIRS,
    CURRENCIES,
    CRON_EXPRESSION,
    HISTORY_START,
    LEAD_DAYS,
    STALE_DAYS,
    BOOT_DELAY_MS,
    LOAD_TTL_MS,
    DEFAULT_WINDOW_DAYS,
    MAX_WINDOW_DAYS
};
