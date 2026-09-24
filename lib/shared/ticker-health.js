/**
 * The dead-ticker record (GAPS #10): what Yahoo answered, symbol by symbol, to the jobs that already ask it about the
 * whole scan universe, so a delisted line can be told from a live one without a single extra request.
 *
 * The universe is a static list (lib/shared/stock-data.js: 2,187 India, 842 UK and 2,000 US symbols, last refreshed
 * 2025-10-27), and every weekday two jobs walk all of it:
 *   scan         the 7 AM scan's five years of daily bars, one chart request per symbol (lib/scanner/scanner.js).
 *                Bars (the newest bar's date is kept), none ('no-bars'), an HTTP 404 ('not-found': Yahoo's "No data
 *                found, symbol may be delisted"), or a passing failure: 'timeout', 'throttled' (429), 'server-error'
 *                (5xx), 'http-<status>', 'network', 'other'.
 *   market-caps  the 06:00 refresh's v7 quote, 50 symbols a request (lib/shared/market-cap-service.js). A quoted symbol
 *                keeps the day of its last trade (regularMarketTime); a symbol missing from Yahoo's answer is
 *                'not-quoted'; a request that fails is a passing failure ('request-<kind>') for each of its symbols,
 *                because it says nothing about any one of them.
 * The monthly AI sweep asks Yahoo about every symbol too, but a month apart and from inside the conviction engine,
 * whose technical pillar scores a failed request as neutral; the weekday scan asks the same chart endpoint about the
 * same symbols about twenty times as often, so the sweep is not recorded.
 *
 * One row per symbol and source in ticker_health, written once per run:
 *   last_ok_at, last_date     the last answer with data, and the newest date it carried
 *   fail_streak               answers in a row without data, of any kind (0 after an answer with data)
 *   gone_streak, gone_since   answers in a row that said the symbol has nothing ('not-found', 'no-bars', 'not-quoted')
 *                             and when the first of them came. A passing failure neither adds to nor ends it: a
 *                             timeout says nothing about whether a line is listed
 *   last_error, last_error_detail, last_failed_at   the latest failure: its kind and Yahoo's own words
 *
 * DEAD (GET /api/ops/dead-tickers): the scan's gone_streak is at least DEAD_MIN_ANSWERS and began at least
 * DEAD_MIN_DAYS ago, with no bar since: a full trading week of "no such symbol", which two scans on one day cannot
 * make. Why that bar: on 2026-09-19 two full fetches of the UK list, hours apart (GAPS #18 and #19), both found data for
 * the same 756 of its 842 symbols, so the answer is steady, not flaky; and the other 86 are 10.2% of a list that was
 * checked against Yahoo on 2025-10-27 (222 of 1,064 symbols removed then), about 8 UK lines a month. A week of evidence
 * costs about 5 wasted requests per dead line; a false positive could hide a signal.
 * STALE: Yahoo still answers, but the newest bar is more than STALE_BAR_DAYS old (suspended, or delisted with its
 * history kept). Reported, never skipped.
 *
 * SKIP_DEAD_TICKERS=true (off unless the owner sets it: README rule 7) makes the scan leave the DEAD out, except that
 * each is asked again once every RECHECK_DAYS, so a line Yahoo serves again is back within a week; and a market where
 * more than MAX_SKIP_SHARE of the list reads dead (twice the worst rate measured) is scanned in full, because that is a
 * Yahoo fault, not delistings. Reading the record fails open: the whole universe is scanned.
 *
 * Recording never breaks a job: every call is caught, a run's write gets at most FLUSH_TIMEOUT_MS, and without a
 * database pool nothing is recorded. The table appears with the first run, like job_runs.
 */
'use strict';

const StockData = require('./stock-data');

const TABLE = 'ticker_health';
const SOURCES = ['scan', 'market-caps'];
const GONE_KINDS = ['not-found', 'no-bars', 'not-quoted'];
const SWITCH = 'SKIP_DEAD_TICKERS';

const DEAD_MIN_ANSWERS = 5;
const DEAD_MIN_DAYS = 7;
const STALE_BAR_DAYS = 14;
const RECHECK_DAYS = 7;
const MAX_SKIP_SHARE = 0.2;

// Rows per upsert statement
const CHUNK_ROWS = 1000;
// A healthy write of the whole universe takes well under a second; a database that does not answer must not hold the
// scan back for longer than this
const FLUSH_TIMEOUT_MS = 15000;
const READ_TIMEOUT_MS = 5000;
const MAX_DETAIL_CHARS = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
const MARKETS = ['India', 'UK', 'US'];

const DDL = `
    CREATE TABLE IF NOT EXISTS ticker_health (
        symbol TEXT NOT NULL,
        source TEXT NOT NULL,
        first_checked_at TIMESTAMPTZ NOT NULL,
        checked_at TIMESTAMPTZ NOT NULL,
        last_ok_at TIMESTAMPTZ,
        last_date DATE,
        fail_streak INTEGER NOT NULL DEFAULT 0,
        gone_streak INTEGER NOT NULL DEFAULT 0,
        gone_since TIMESTAMPTZ,
        last_error TEXT,
        last_error_detail TEXT,
        last_failed_at TIMESTAMPTZ,
        PRIMARY KEY (symbol, source)
    )`;

const COLUMNS = `symbol, source, first_checked_at, checked_at, last_ok_at, to_char(last_date, 'YYYY-MM-DD') AS last_date,
    fail_streak, gone_streak, gone_since, last_error, last_error_detail, last_failed_at`;

const UPSERT = `
    INSERT INTO ticker_health (symbol, source, first_checked_at, checked_at, last_ok_at, last_date, fail_streak,
                               gone_streak, gone_since, last_error, last_error_detail, last_failed_at)
    SELECT r.symbol, $1, r.first_checked_at, r.checked_at, r.last_ok_at, r.last_date, r.fail_streak, r.gone_streak,
           r.gone_since, r.last_error, r.last_error_detail, r.last_failed_at
    FROM unnest($2::text[], $3::timestamptz[], $4::timestamptz[], $5::timestamptz[], $6::date[], $7::int[], $8::int[],
                $9::timestamptz[], $10::text[], $11::text[], $12::timestamptz[])
         AS r(symbol, first_checked_at, checked_at, last_ok_at, last_date, fail_streak, gone_streak, gone_since,
              last_error, last_error_detail, last_failed_at)
    ON CONFLICT (symbol, source) DO UPDATE SET
        first_checked_at = EXCLUDED.first_checked_at, checked_at = EXCLUDED.checked_at,
        last_ok_at = EXCLUDED.last_ok_at, last_date = EXCLUDED.last_date, fail_streak = EXCLUDED.fail_streak,
        gone_streak = EXCLUDED.gone_streak, gone_since = EXCLUDED.gone_since, last_error = EXCLUDED.last_error,
        last_error_detail = EXCLUDED.last_error_detail, last_failed_at = EXCLUDED.last_failed_at
    WHERE ticker_health.checked_at <= EXCLUDED.checked_at`;

function withTimeout(promise, ms) {
    let timer;
    const expiry = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`no answer in ${ms} ms`)), ms);
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

async function tableExists(pool) {
    const [found] = rowsOf(await query(pool, `SELECT to_regclass('public.${TABLE}') IS NOT NULL AS present`));
    return Boolean(found && found.present);
}

/** The switch: exactly "true" (any case) turns the skip on; anything else, or nothing, leaves it off. */
function skipEnabled(env = process.env) {
    return String((env && env[SWITCH]) || '').trim().toLowerCase() === 'true';
}

/** The universe's market for a symbol: .NS India, .L UK, anything else US (as the market-cap refresh counts them). */
function marketOf(symbol) {
    const s = String(symbol);
    return s.endsWith('.NS') ? 'India' : s.endsWith('.L') ? 'UK' : 'US';
}

const clip = text => (text == null ? null : String(text).slice(0, MAX_DETAIL_CHARS));
const isDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const iso = value => (value == null ? null : new Date(value).toISOString());
const time = value => (value == null ? NaN : new Date(value).getTime());

/**
 * What a failed request was: 'not-found' (HTTP 404), 'throttled' (429), 'server-error' (5xx), 'http-<status>',
 * 'timeout', 'network' (no answer at all) or 'other'.
 */
function classifyError(error) {
    const status = Number(error && error.response && error.response.status);
    if (status === 404) return 'not-found';
    if (status === 429) return 'throttled';
    if (status >= 500 && status < 600) return 'server-error';
    if (status > 0) return `http-${status}`;
    const code = error && error.code;
    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || /timeout/i.test(String(error && error.message))) return 'timeout';
    if (code) return 'network';
    return 'other';
}

/** Yahoo's own words for a failed request (e.g. "No data found, symbol may be delisted"), else the error's message. */
function describeError(error) {
    const data = error && error.response && error.response.data;
    const body = data && typeof data === 'object' ? (data.chart || data.finance || data.quoteResponse || {}).error : null;
    const words = body && (body.description || body.code);
    return clip(words || (error && error.message) || String(error));
}

/** The date of the newest bar with a close in the CSV lib/shared/yahoo-client.js serves (Date,Open,High,Low,Close,...). */
function lastBarDate(csv) {
    const lines = String(csv || '').trim().split('\n');
    for (let i = lines.length - 1; i >= 1; i--) {
        const cells = lines[i].trim().split(',');
        if (cells.length >= 5 && isDate(cells[0]) && cells[4] !== '' && Number.isFinite(parseFloat(cells[4]))) return cells[0];
    }
    return null;
}

/** The day of a v7 quote's last trade (regularMarketTime, seconds since the epoch), or null. */
function quoteDate(quote) {
    const raw = quote && quote.regularMarketTime;
    const seconds = Number(raw && typeof raw === 'object' ? raw.raw : raw);
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    const date = new Date(seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

/**
 * A stored row after one more answer. `observation`: { ok: true, lastDate } or { ok: false, gone, kind, detail }.
 * The rules are the ones the module docblock states.
 */
function nextRow(prev, observation, at) {
    const row = prev ? { ...prev } : {
        first_checked_at: at, last_ok_at: null, last_date: null, fail_streak: 0, gone_streak: 0, gone_since: null,
        last_error: null, last_error_detail: null, last_failed_at: null
    };
    row.checked_at = at;
    if (observation.ok) {
        row.last_ok_at = at;
        row.last_date = observation.lastDate || row.last_date || null;
        row.fail_streak = 0;
        row.gone_streak = 0;
        row.gone_since = null;
    } else {
        row.fail_streak = (Number(row.fail_streak) || 0) + 1;
        row.last_error = observation.kind || 'other';
        row.last_error_detail = clip(observation.detail);
        row.last_failed_at = at;
        if (observation.gone) {
            if (!Number(row.gone_streak)) row.gone_since = at;
            row.gone_streak = (Number(row.gone_streak) || 0) + 1;
        }
    }
    return row;
}

/** "5,029 answers noted: 4,712 with data, 301 without (not-found 290, no-bars 11), 16 failed (timeout 16)" */
function describeRun(observations) {
    const count = n => Number(n).toLocaleString('en-GB');
    let withData = 0;
    const gone = {};
    const failed = {};
    for (const [, o] of observations) {
        if (o.ok) withData++;
        else {
            const bucket = o.gone ? gone : failed;
            bucket[o.kind] = (bucket[o.kind] || 0) + 1;
        }
    }
    const part = (label, bucket) => {
        const total = Object.values(bucket).reduce((sum, n) => sum + n, 0);
        const kinds = Object.entries(bucket).map(([kind, n]) => `${kind} ${count(n)}`).join(', ');
        return `${count(total)} ${label}${kinds ? ` (${kinds})` : ''}`;
    };
    return `${count(observations.length)} answers noted: ${count(withData)} with data, ${part('without', gone)}, ${part('failed', failed)}`;
}

class Run {
    constructor(source, { now = new Date(), pool, timeoutMs = FLUSH_TIMEOUT_MS } = {}) {
        this.source = source;
        this.at = now instanceof Date ? now : new Date(now);
        this.pool = pool;
        this.timeoutMs = timeoutMs;
        this.observations = new Map();
    }

    // The last answer about a symbol in one run is the one kept
    note(symbol, observation) {
        try {
            if (symbol === undefined || symbol === null || symbol === '') return;
            this.observations.set(String(symbol), observation);
        } catch (error) {
            // never let the record break the job that feeds it
        }
    }

    /** The scan: what fetchHistoryCsv answered (null: Yahoo had no bars) */
    history(symbol, history) {
        try {
            const date = history ? lastBarDate(history.csv) : null;
            if (date) this.note(symbol, { ok: true, lastDate: date });
            else this.note(symbol, { ok: false, gone: true, kind: 'no-bars', detail: history ? 'no bar with a close' : 'no chart result' });
        } catch (error) {
            // as note()
        }
    }

    /** A one-symbol request that failed: only a 404 is Yahoo saying the symbol has nothing */
    failed(symbol, error) {
        try {
            const kind = classifyError(error);
            this.note(symbol, { ok: false, gone: kind === 'not-found', kind, detail: describeError(error) });
        } catch (e) {
            // as note()
        }
    }

    /** The market caps: a symbol in Yahoo's v7 quote answer */
    quoted(symbol, quote) {
        try {
            this.note(symbol, { ok: true, lastDate: quoteDate(quote) });
        } catch (error) {
            // as note()
        }
    }

    /** The market caps: a symbol missing from Yahoo's v7 quote answer */
    notQuoted(symbol) {
        this.note(symbol, { ok: false, gone: true, kind: 'not-quoted', detail: 'missing from Yahoo\'s quote answer' });
    }

    /** The market caps: a request for several symbols failed, which says nothing about any one of them */
    requestFailed(symbols, error) {
        try {
            const kind = `request-${classifyError(error)}`;
            const detail = describeError(error);
            for (const symbol of symbols || []) this.note(symbol, { ok: false, gone: false, kind, detail });
        } catch (e) {
            // as note()
        }
    }

    /**
     * Write the run's answers: one row per symbol, one statement per CHUNK_ROWS rows, at most timeoutMs in all.
     * Never rejects. Resolves to { source, noted, written, error? }.
     */
    async flush() {
        const observations = [...this.observations];
        this.observations.clear();
        const outcome = { source: this.source, noted: observations.length, written: 0 };
        try {
            const pool = this.pool === undefined ? defaultPool() : this.pool;
            if (!observations.length || !pool) return outcome;
            outcome.written = await withTimeout(this.write(pool, observations), this.timeoutMs);
            console.log(`[TICKER HEALTH] ${this.source}: ${describeRun(observations)}`);
        } catch (error) {
            outcome.error = String((error && error.message) || error);
            console.error(`⚠️ [TICKER HEALTH] Could not record the ${this.source} run's Yahoo answers: ${outcome.error}`);
        }
        return outcome;
    }

    async write(pool, observations) {
        await ensureTable(pool);
        const symbols = observations.map(([symbol]) => symbol);
        const stored = new Map(rowsOf(await query(pool,
            `SELECT ${COLUMNS} FROM ${TABLE} WHERE source = $1 AND symbol = ANY($2::text[])`, [this.source, symbols]))
            .map(row => [row.symbol, row]));
        const rows = [];
        for (const [symbol, observation] of observations) {
            const prev = stored.get(symbol);
            // a newer run already wrote this symbol: an older answer must not replace it
            if (prev && time(prev.checked_at) > this.at.getTime()) continue;
            rows.push({ symbol, ...nextRow(prev, observation, this.at) });
        }
        for (let i = 0; i < rows.length; i += CHUNK_ROWS) {
            const chunk = rows.slice(i, i + CHUNK_ROWS);
            const column = name => chunk.map(row => (row[name] === undefined ? null : row[name]));
            await query(pool, UPSERT, [this.source, column('symbol'), column('first_checked_at'), column('checked_at'),
                column('last_ok_at'), column('last_date'), column('fail_streak'), column('gone_streak'), column('gone_since'),
                column('last_error'), column('last_error_detail'), column('last_failed_at')]);
        }
        return rows.length;
    }
}

/** Start noting one run's answers for `source` ('scan' or 'market-caps'). */
function startRun(source, options) {
    return new Run(source, options);
}

/** The universe as a Map symbol -> { name, market } (first spelling wins, as the sweep dedupes it) */
function universeMap(stocks) {
    const map = new Map();
    for (const stock of stocks || []) {
        if (stock && stock.symbol && !map.has(stock.symbol)) map.set(stock.symbol, { name: stock.name || null, market: marketOf(stock.symbol) });
    }
    return map;
}

function countByMarket(items, marketOfItem) {
    const counts = { India: 0, UK: 0, US: 0, total: 0 };
    for (const item of items) {
        counts[marketOfItem(item)]++;
        counts.total++;
    }
    return counts;
}

async function readRows(pool, sources = SOURCES) {
    if (!(await tableExists(pool))) return null;
    return rowsOf(await query(pool, `SELECT ${COLUMNS} FROM ${TABLE} WHERE source = ANY($1::text[])`, [sources]));
}

function isDead(row, now) {
    return Number(row.gone_streak) >= DEAD_MIN_ANSWERS && row.gone_since != null
        && now.getTime() - time(row.gone_since) >= DEAD_MIN_DAYS * DAY_MS;
}

function quoteEvidence(row) {
    if (!row) return null;
    return {
        lastQuotedAt: iso(row.last_ok_at),
        lastTradeDate: row.last_date || null,
        notQuotedAnswers: Number(row.gone_streak) || 0,
        failedAnswers: Number(row.fail_streak) || 0,
        lastError: row.last_error || null,
        lastCheckedAt: iso(row.checked_at)
    };
}

/**
 * Sort the stored rows into the DEAD, the STALE and the FAILING (5 or more answers in a row without data, not dead,
 * or not yet), for the universe symbols only. Pure: the probe and the scan's skip both use it.
 * @param {object[]} rows   ticker_health rows (last_date as 'YYYY-MM-DD')
 * @param {{now?: Date, stocks: Map}} options   stocks: universeMap() of the list being judged
 */
function classify(rows, { now = new Date(), stocks }) {
    const scan = new Map();
    const quote = new Map();
    const outside = new Set();
    const sources = {};
    for (const row of rows || []) {
        if (!stocks.has(row.symbol)) {
            outside.add(row.symbol);
            continue;
        }
        if (row.source === 'scan') scan.set(row.symbol, row);
        else if (row.source === 'market-caps') quote.set(row.symbol, row);
        const s = sources[row.source] || (sources[row.source] = { symbols: 0, withData: 0, failing: 0, failingByKind: {}, lastRunAt: null });
        s.symbols++;
        if (Number(row.fail_streak) === 0) s.withData++;
        else {
            s.failing++;
            s.failingByKind[row.last_error] = (s.failingByKind[row.last_error] || 0) + 1;
        }
        if (!s.lastRunAt || time(row.checked_at) > time(s.lastRunAt)) s.lastRunAt = iso(row.checked_at);
    }

    const dead = [];
    const stale = [];
    const failing = [];
    for (const [symbol, row] of scan) {
        const { name, market } = stocks.get(symbol);
        const evidence = {
            symbol, name, market,
            lastBarDate: row.last_date || null,
            lastOkAt: iso(row.last_ok_at),
            goneAnswers: Number(row.gone_streak) || 0,
            goneSince: iso(row.gone_since),
            failedAnswers: Number(row.fail_streak) || 0,
            lastError: row.last_error || null,
            lastErrorDetail: row.last_error_detail || null,
            lastFailedAt: iso(row.last_failed_at),
            firstCheckedAt: iso(row.first_checked_at),
            lastCheckedAt: iso(row.checked_at),
            quote: quoteEvidence(quote.get(symbol))
        };
        if (isDead(row, now)) dead.push(evidence);
        else if (Number(row.fail_streak) === 0 && row.last_date
            && now.getTime() - time(row.last_date) > STALE_BAR_DAYS * DAY_MS) {
            stale.push({ ...evidence, daysSinceBar: Math.floor((now.getTime() - time(row.last_date)) / DAY_MS) });
        } else if (Number(row.fail_streak) >= DEAD_MIN_ANSWERS) failing.push(evidence);
    }
    dead.sort((a, b) => a.market.localeCompare(b.market) || a.symbol.localeCompare(b.symbol));
    stale.sort((a, b) => a.lastBarDate.localeCompare(b.lastBarDate) || a.symbol.localeCompare(b.symbol));
    failing.sort((a, b) => b.failedAnswers - a.failedAnswers || a.symbol.localeCompare(b.symbol));

    // A market where more than MAX_SKIP_SHARE of the list reads dead is a Yahoo fault, not delistings
    const listed = countByMarket([...stocks.values()], stock => stock.market);
    const deadCounts = countByMarket(dead, item => item.market);
    const refusedMarkets = MARKETS.filter(market => listed[market] > 0 && deadCounts[market] / listed[market] > MAX_SKIP_SHARE);

    return {
        sources,
        counts: { dead: deadCounts, stale: countByMarket(stale, item => item.market), failing: countByMarket(failing, item => item.market) },
        refusedMarkets,
        dead,
        stale,
        failing,
        notInUniverse: outside.size
    };
}

function ruleOf() {
    return {
        deadMinAnswers: DEAD_MIN_ANSWERS, deadMinDays: DEAD_MIN_DAYS, staleBarDays: STALE_BAR_DAYS,
        recheckDays: RECHECK_DAYS, maxSkipShare: MAX_SKIP_SHARE, goneKinds: GONE_KINDS.slice()
    };
}

/**
 * The probe's answer (GET /api/ops/dead-tickers): the rule, the switch, the universe by market, each source's last
 * run, and the DEAD, STALE and FAILING lists with their evidence. Reads the database only; never calls Yahoo.
 */
async function report({ pool = defaultPool(), now = new Date(), env = process.env, universe = StockData.getAllStocks() } = {}) {
    if (!pool) throw new Error('Database unavailable');
    const stocks = universeMap(universe);
    const rows = await readRows(pool);
    const verdict = classify(rows || [], { now, stocks });
    return {
        table: rows !== null,
        rule: ruleOf(),
        skip: { switch: SWITCH, enabled: skipEnabled(env), refusedMarkets: verdict.refusedMarkets },
        universe: countByMarket([...stocks.values()], stock => stock.market),
        sources: verdict.sources,
        counts: verdict.counts,
        notInUniverse: verdict.notInUniverse,
        dead: verdict.dead,
        stale: verdict.stale,
        failing: verdict.failing
    };
}

/**
 * The list the 7 AM scan asks Yahoo about: `stocks` as given, unless SKIP_DEAD_TICKERS=true, when the DEAD are left
 * out, bar those not asked for RECHECK_DAYS and those in a market over MAX_SKIP_SHARE. Never rejects: when the record
 * cannot be read in READ_TIMEOUT_MS, the whole list is scanned.
 * @returns {Promise<{stocks: object[], skipped: string[], refusedMarkets: string[]}>}
 */
async function scanList(stocks, { pool = defaultPool(), now = new Date(), env = process.env, timeoutMs = READ_TIMEOUT_MS } = {}) {
    const list = Array.isArray(stocks) ? stocks : [];
    const everything = { stocks: list, skipped: [], refusedMarkets: [] };
    try {
        if (!skipEnabled(env)) return everything;
        if (!pool) throw new Error('no database pool');
        const rows = await withTimeout(readRows(pool, ['scan']), timeoutMs);
        if (!rows) {
            console.log(`[TICKER HEALTH] ${SWITCH}=true, but nothing is recorded yet: the whole universe is scanned`);
            return everything;
        }
        const { dead, refusedMarkets } = classify(rows, { now, stocks: universeMap(list) });
        const skip = new Set(dead
            .filter(item => !refusedMarkets.includes(item.market))
            .filter(item => now.getTime() - time(item.lastCheckedAt) < RECHECK_DAYS * DAY_MS)
            .map(item => item.symbol));
        console.log(`[TICKER HEALTH] ${SWITCH}=true: ${skip.size} dead ticker(s) left out of this scan, each asked again ` +
            `${RECHECK_DAYS} days after its last answer` +
            (refusedMarkets.length ? `; scanned in full (over ${MAX_SKIP_SHARE * 100}% of the list reads dead): ${refusedMarkets.join(', ')}` : ''));
        return { stocks: list.filter(stock => !(stock && skip.has(stock.symbol))), skipped: [...skip], refusedMarkets };
    } catch (error) {
        console.error(`⚠️ [TICKER HEALTH] Could not read the dead-ticker record, scanning the whole universe: ${error && error.message}`);
        return everything;
    }
}

module.exports = {
    startRun,
    report,
    scanList,
    classify,
    nextRow,
    classifyError,
    describeError,
    lastBarDate,
    quoteDate,
    marketOf,
    skipEnabled,
    TABLE,
    SOURCES,
    GONE_KINDS,
    SWITCH,
    DEAD_MIN_ANSWERS,
    DEAD_MIN_DAYS,
    STALE_BAR_DAYS,
    RECHECK_DAYS,
    MAX_SKIP_SHARE,
    FLUSH_TIMEOUT_MS,
    READ_TIMEOUT_MS,
    CHUNK_ROWS
};
