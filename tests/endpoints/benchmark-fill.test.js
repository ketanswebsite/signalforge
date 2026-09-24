/**
 * The nightly benchmark fill (lib/portfolio/benchmark-fill.js, GAPS #15) against the harness's real Postgres: the
 * columns the boot DDL added, the job's two SELECTs and its batched UPDATEs, and the trade API reading the result.
 *
 * The harness server's cron is stubbed, so the job runs here, in the test process, on the scratch database, with
 * index series made here (fetchChart is injected): no request leaves the machine. Its rows belong to the harness
 * personas and are deleted afterwards.
 */
'use strict';

const { Pool } = require('pg');
const h = require('./harness/client');

// The harness server writes timestamps in UTC; read them back the same way
const TZ_AT_START = process.env.TZ;
process.env.TZ = 'UTC';

const BenchmarkFill = require('../../lib/portfolio/benchmark-fill');

const DAY = 86400 * 1000;
// The last 40 weekdays up to yesterday (UTC), each bar at 12:00 UTC: the same calendar day in London, Kolkata and
// New York. No bar for today, so whatever the specs closed today waits.
function weekdays() {
    const days = [];
    const d = new Date(); d.setUTCHours(12, 0, 0, 0);
    while (days.length < 40) {
        d.setTime(d.getTime() - DAY);
        if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) days.unshift(new Date(d));
    }
    return days;
}
const DAYS = weekdays();
const LEVELS = { '^FTSE': 9000, '^NSEI': 25000, '^GSPC': 6500 };
const closeOf = (symbol, i) => LEVELS[symbol] + 7 * i + (i % 3);
function series(symbol) {
    return {
        chart: {
            result: [{
                // the index "started trading" on the first day of the series
                meta: { symbol, firstTradeDate: Math.floor(DAYS[0].getTime() / 1000) },
                timestamp: DAYS.map(d => Math.floor(d.getTime() / 1000)),
                indicators: { quote: [{ close: DAYS.map((d, i) => closeOf(symbol, i)) }] }
            }],
            error: null
        }
    };
}
const expected = (symbol, entry, exit) => Math.round((closeOf(symbol, exit) / closeOf(symbol, entry) - 1) * 100 * 10000) / 10000;
const isoDay = d => d.toISOString().slice(0, 10);

let pool;
const ids = {};

beforeAll(async () => {
    // the job's one summary line per run, and its line for a failed request, are expected here
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    pool = new Pool({ connectionString: h.state().env.DATABASE_URL });
    const user = h.state().personas.user;
    const trade = async (symbol, market, entry, exit) => (await pool.query(`
        INSERT INTO trades (symbol, name, entry_date, entry_price, exit_date, exit_price, shares, status, market, user_id, auto_added)
        VALUES ($1, 'Harness benchmark', $2, 100, $3, 104, 1, 'closed', $4, $5, false) RETURNING id`,
    [symbol, entry, exit, market, user])).rows[0].id;
    // UK with its market stored; India read from the symbol (the Positions page stores no market)
    ids.uk = await trade('HARNESSBM.L', 'UK', DAYS[5], DAYS[20]);
    ids.india = await trade('HARNESSBM.NS', null, DAYS[8], DAYS[30]);
    // entered before the index's first trading day in the series it will be given: priced by nothing, marked once
    ids.old = await trade('HARNESSBM3.L', 'UK', new Date(DAYS[0].getTime() - 60 * DAY), DAYS[12]);
    ids.hc = (await pool.query(`
        INSERT INTO high_conviction_portfolio (symbol, name, market, signal_date, entry_date, entry_price, target_price,
                                               stop_loss_price, square_off_date, status, exit_date, exit_price, exit_reason)
        VALUES ('HARNESSBM2.L', 'Harness benchmark', 'UK', $1, $1, 100, 108, 95, $2, 'closed', $3, 104, 'Harness')
        RETURNING id`, [isoDay(DAYS[10]), isoDay(new Date(DAYS[10].getTime() + 30 * DAY)), isoDay(DAYS[25])])).rows[0].id;
});

afterAll(async () => {
    if (pool) {
        await pool.query('DELETE FROM trades WHERE id = ANY($1::bigint[])', [[ids.uk, ids.india, ids.old].filter(Boolean)]);
        await pool.query('DELETE FROM high_conviction_portfolio WHERE id = $1', [ids.hc || 0]);
        await pool.end();
    }
    if (TZ_AT_START === undefined) delete process.env.TZ;
    else process.env.TZ = TZ_AT_START;
    jest.restoreAllMocks();
});

const benchmarkOf = async (table, id) => (await pool.query(
    `SELECT benchmark_symbol, benchmark_return_percent::float8 AS percent FROM ${table} WHERE id = $1`, [id])).rows[0];

test('a failed index request writes nothing, and the run still ends normally', async () => {
    const summary = await BenchmarkFill.runBenchmarkFill({
        pool, env: {}, fetchChart: async () => { throw new Error('harness: no network') }
    });
    expect(summary).toMatchObject({ enabled: true, filled: 0, markets: null });
    expect(summary.failed).toBeGreaterThanOrEqual(4);
    // one line per market whose request failed
    expect(console.error.mock.calls.filter(([line]) => /could not be read/.test(line))).toHaveLength(summary.failedMarkets.split(',').length);
    expect(summary.failedMarkets.split(',')).toEqual(expect.arrayContaining(['UK', 'India']));
    expect(await benchmarkOf('trades', ids.uk)).toEqual({ benchmark_symbol: null, percent: null });
    expect(await benchmarkOf('high_conviction_portfolio', ids.hc)).toEqual({ benchmark_symbol: null, percent: null });
});

test('fills trades and high-conviction positions with one request per market', async () => {
    const asked = [];
    const summary = await BenchmarkFill.runBenchmarkFill({
        pool, env: {}, fetchChart: async (symbol, params) => { asked.push({ symbol, params }); return series(symbol); }
    });
    expect(summary.error).toBeUndefined();
    expect(summary.filled).toBeGreaterThanOrEqual(3);
    // one request per market, each from before its earliest entry
    expect(asked.map(a => a.symbol).sort()).toEqual([...new Set(asked.map(a => a.symbol))].sort());
    expect(asked.map(a => a.symbol)).toEqual(expect.arrayContaining(['^FTSE', '^NSEI']));
    for (const { params } of asked) expect(params.period1 * 1000).toBeLessThan(DAYS[5].getTime());

    expect(await benchmarkOf('trades', ids.uk)).toEqual({ benchmark_symbol: '^FTSE', percent: expected('^FTSE', 5, 20) });
    expect(await benchmarkOf('trades', ids.india)).toEqual({ benchmark_symbol: '^NSEI', percent: expected('^NSEI', 8, 30) });
    expect(await benchmarkOf('high_conviction_portfolio', ids.hc)).toEqual({ benchmark_symbol: '^FTSE', percent: expected('^FTSE', 10, 25) });
    // the index symbol with no return: tried, and nothing could price it
    expect(summary.unpriced).toBeGreaterThanOrEqual(1);
    expect(await benchmarkOf('trades', ids.old)).toEqual({ benchmark_symbol: '^FTSE', percent: null });
});

test('the trade API returns it, and the next run asks for nothing it already wrote', async () => {
    const r = await h.request('user', 'GET', `/api/trades/${ids.uk}`);
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ benchmarkSymbol: '^FTSE', benchmarkReturnPercent: expected('^FTSE', 5, 20), strategyVersion: null });
    const again = await BenchmarkFill.runBenchmarkFill({ pool, env: {}, fetchChart: async symbol => series(symbol) });
    expect(again).toMatchObject({ filled: 0, unpriced: 0 });
});
