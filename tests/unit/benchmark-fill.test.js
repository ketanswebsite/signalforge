/**
 * GAPS #15: the benchmark return per trade (lib/portfolio/benchmark-fill.js).
 *
 *   1. The definition: the index's close on the exit day over its close on the entry day, each the last final close
 *      on or before that day, in percent to 4 places; days in the market's own time zone; today's bar counts only
 *      once the market has closed.
 *   2. The nightly run: one Yahoo request per market with rows to fill, from the earliest entry; a failed request
 *      leaves that market's rows for the next run and still writes the others; a row the index cannot price is
 *      marked so it is not asked again; one batched UPDATE per table, guarded to closed rows without a benchmark.
 *   3. Its cron: 23:40 UK every day, recorded in job_runs, and nothing it throws escapes.
 * The SQL on a real Postgres is checked by tests/endpoints/benchmark-fill.test.js.
 */

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
// Under jsdom, jest resolves cheerio's "browser" build, which is ESM and will not parse
jest.mock('cheerio', () => ({ load: jest.fn() }));
jest.mock('../../database-postgres', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../lib/telegram/telegram-bot', () => ({
    sendTelegramAlert: jest.fn(),
    broadcastToSubscribers: jest.fn()
}));
jest.mock('../../ml/conviction-sweep', () => ({
    isSweepDay: jest.fn(),
    runConvictionSweep: jest.fn(),
    scheduleResumeCheck: jest.fn(),
    runSweepWatchdog: jest.fn()
}));

const BenchmarkFill = require('../../lib/portfolio/benchmark-fill');

const { benchmarkReturn, finalCloses, marketOf, tradeDay, runBenchmarkFill, BENCHMARKS } = BenchmarkFill;
const squash = sql => sql.replace(/\s+/g, ' ').trim();

// Yahoo's v8 chart answer for daily bars at the given UTC moments
function chart(bars, meta = {}) {
    return {
        chart: {
            result: [{
                meta: { symbol: 'X', ...meta },
                timestamp: bars.map(([iso]) => Math.floor(Date.parse(iso) / 1000)),
                indicators: { quote: [{ close: bars.map(([, close]) => close) }] }
            }],
            error: null
        }
    };
}

beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('the definition', () => {
    const closes = [
        { day: '2026-09-14', close: 100 },
        { day: '2026-09-15', close: 102 },
        { day: '2026-09-16', close: 101 },
        // 09-17 was a holiday: no bar
        { day: '2026-09-18', close: 105 }
    ];

    test('close on the exit day over close on the entry day, in percent, 4 places', () => {
        expect(benchmarkReturn(closes, '2026-09-14', '2026-09-16')).toEqual({ state: 'filled', percent: 1 });
        expect(benchmarkReturn(closes, '2026-09-15', '2026-09-16')).toEqual({ state: 'filled', percent: -0.9804 });
    });

    test('a weekend or holiday uses the last close before it; a same-day exit reads 0', () => {
        expect(benchmarkReturn(closes, '2026-09-13', '2026-09-17')).toEqual({ state: 'unpriced' }); // no close on or before 09-13
        expect(benchmarkReturn(closes, '2026-09-14', '2026-09-17')).toEqual({ state: 'filled', percent: 1 }); // 09-17 -> 09-16's close
        expect(benchmarkReturn(closes, '2026-09-17', '2026-09-18')).toEqual({ state: 'filled', percent: 3.9604 }); // entry 09-17 -> 09-16
        expect(benchmarkReturn(closes, '2026-09-16', '2026-09-16')).toEqual({ state: 'filled', percent: 0 });
    });

    test('an exit day with no final close on or after it waits; an impossible window is unpriced', () => {
        expect(benchmarkReturn(closes, '2026-09-14', '2026-09-19')).toEqual({ state: 'waiting' });
        expect(benchmarkReturn([], '2026-09-14', '2026-09-15')).toEqual({ state: 'waiting' });
        expect(benchmarkReturn(closes, '2026-09-16', '2026-09-15')).toEqual({ state: 'unpriced' });
        expect(benchmarkReturn(closes, null, '2026-09-15')).toEqual({ state: 'unpriced' });
    });

    test('bars are dated in the market\'s own time zone, and today\'s bar counts only after the close', () => {
        const bars = chart([
            ['2026-09-21T03:45:00Z', 25000],   // 09:15 IST, 21 Sept
            ['2026-09-22T03:45:00Z', 25100],
            ['2026-09-23T03:45:00Z', null],     // no close: dropped
            ['2026-09-24T03:45:00Z', 25300]     // today in India
        ]);
        // 14:00 IST on the 24th: India is still trading, so the 24th is not final yet
        expect(finalCloses(bars, 'India', new Date('2026-09-24T08:30:00Z')).map(b => b.day)).toEqual(['2026-09-21', '2026-09-22']);
        // 16:05 IST: closed at 15:30, settled 30 minutes later
        expect(finalCloses(bars, 'India', new Date('2026-09-24T10:35:00Z'))).toEqual([
            { day: '2026-09-21', close: 25000 }, { day: '2026-09-22', close: 25100 }, { day: '2026-09-24', close: 25300 }
        ]);
        // The New York session's bar opens at 13:30 UTC; 23:40 UK is 18:40 in New York, after the 16:00 close
        const us = chart([['2026-09-23T13:30:00Z', 6600], ['2026-09-24T13:30:00Z', 6650]]);
        expect(finalCloses(us, 'US', new Date('2026-09-24T22:40:00Z')).map(b => b.day)).toEqual(['2026-09-23', '2026-09-24']);
        expect(finalCloses(us, 'US', new Date('2026-09-24T19:00:00Z')).map(b => b.day)).toEqual(['2026-09-23']);
        expect(finalCloses({ chart: { result: [] } }, 'UK')).toEqual([]);
    });

    test('a position\'s days: a timestamp in the market\'s time zone, a stored date as it is', () => {
        // 01:00 UTC on the 25th is still the 24th in New York, and already the 25th in India
        expect(tradeDay(new Date('2026-09-25T01:00:00Z'), BENCHMARKS.US.timeZone)).toBe('2026-09-24');
        expect(tradeDay(new Date('2026-09-25T01:00:00Z'), BENCHMARKS.India.timeZone)).toBe('2026-09-25');
        expect(tradeDay('2026-09-18', BENCHMARKS.US.timeZone)).toBe('2026-09-18');
        expect(tradeDay('not a date', BENCHMARKS.UK.timeZone)).toBeNull();
    });

    test('the market: the market column, else the symbol', () => {
        expect(marketOf({ market: 'India', symbol: 'ANY' })).toBe('India');
        expect(marketOf({ market: null, symbol: 'RELIANCE.NS' })).toBe('India');
        expect(marketOf({ symbol: 'TCS.BO' })).toBe('India');
        expect(marketOf({ symbol: 'vod.l' })).toBe('UK');
        expect(marketOf({ symbol: 'BRK-B' })).toBe('US');
        expect(marketOf({ market: 'International', symbol: 'SAP.DE' })).toBeNull();
        expect(marketOf({ symbol: '' })).toBeNull();
        expect(BENCHMARKS.India.symbol).toBe('^NSEI');
        expect(BENCHMARKS.UK.symbol).toBe('^FTSE');
        expect(BENCHMARKS.US.symbol).toBe('^GSPC');
    });
});

describe('the nightly run', () => {
    const NOW = new Date('2026-09-24T22:40:00Z'); // 23:40 UK
    const UK_BARS = [
        ['2026-09-14T07:00:00Z', 9000], ['2026-09-15T07:00:00Z', 9090], ['2026-09-16T07:00:00Z', 9180],
        ['2026-09-17T07:00:00Z', 8910], ['2026-09-18T07:00:00Z', 9000], ['2026-09-21T07:00:00Z', 9270],
        ['2026-09-22T07:00:00Z', 9300], ['2026-09-23T07:00:00Z', 9310], ['2026-09-24T07:00:00Z', 9320]
    ];
    // as if the index had started trading on 14 September (Yahoo's meta.firstTradeDate)
    const ukBars = chart(UK_BARS, { firstTradeDate: Math.floor(Date.parse('2026-09-14T07:00:00Z') / 1000) });

    // A pool that answers the two SELECTs with the given rows and records the rest
    function fakePool({ trades = [], highConviction = [] } = {}) {
        const calls = [];
        const query = jest.fn(async (sql, params) => {
            const text = squash(sql);
            calls.push([text, params]);
            if (text.startsWith('SELECT') && text.includes('FROM trades')) return { rows: trades };
            if (text.startsWith('SELECT') && text.includes('FROM high_conviction_portfolio')) return { rows: highConviction };
            if (text.startsWith('UPDATE')) return { rowCount: params[0].length };
            throw new Error('unexpected statement: ' + text);
        });
        return { query, calls };
    }
    const updates = pool => pool.calls.filter(([text]) => text.startsWith('UPDATE'));

    test('fills both tables with one request per market and one guarded UPDATE per table', async () => {
        const pool = fakePool({
            trades: [
                // an executor trade: booked 13:00 UK on the 14th, stopped out on the 17th
                { id: '11', symbol: 'VOD.L', market: 'UK', entered: new Date('2026-09-14T12:00:00Z'), exited: new Date('2026-09-17T10:00:00Z') },
                // a Positions-page trade: no market stored
                { id: '12', symbol: 'HSBA.L', market: null, entered: new Date('2026-09-15T09:00:00Z'), exited: new Date('2026-09-21T15:00:00Z') }
            ],
            highConviction: [{ id: 7, symbol: 'BP.L', market: 'UK', entered: '2026-09-16', exited: '2026-09-24' }]
        });
        const fetchChart = jest.fn(async () => ukBars);
        const summary = await runBenchmarkFill({ pool, fetchChart, now: NOW, env: {} });

        expect(fetchChart).toHaveBeenCalledTimes(1);
        const [symbol, params, options] = fetchChart.mock.calls[0];
        expect(symbol).toBe('^FTSE');
        expect(params).toMatchObject({ interval: '1d', period2: Math.floor(NOW.getTime() / 1000) });
        // from LEAD_DAYS before the earliest entry (the 14th)
        expect(params.period1).toBe(Math.floor(Date.parse('2026-09-14T00:00:00Z') / 1000) - BenchmarkFill.LEAD_DAYS * 86400);
        expect(options).toMatchObject({ timeout: expect.any(Number) });

        const [[tradesSql, tradesParams], [hcSql, hcParams]] = updates(pool);
        expect(tradesSql).toMatch(/^UPDATE trades AS t SET benchmark_symbol = v.symbol, benchmark_return_percent = v.percent FROM unnest\(\$1::bigint\[\], \$2::text\[\], \$3::numeric\[\]\)/);
        expect(tradesSql).toMatch(/WHERE t.id = v.id AND t.status = 'closed' AND t.benchmark_symbol IS NULL$/);
        // 9000 -> 8910 is -1%; 9090 -> 9270 is +1.9802%; the HC row 9180 -> 9320 is +1.5251%
        expect(tradesParams).toEqual([['11', '12'], ['^FTSE', '^FTSE'], [-1, 1.9802]]);
        expect(hcSql).toMatch(/^UPDATE high_conviction_portfolio AS t /);
        expect(hcParams).toEqual([[7], ['^FTSE'], [1.5251]]);
        expect(summary).toMatchObject({ pending: 3, filled: 3, unpriced: 0, waiting: 0, failed: 0, noIndex: 0, markets: 'UK', failedMarkets: null });
    });

    test('reads only closed rows without a benchmark, in the three markets or with none stored', async () => {
        const pool = fakePool();
        await runBenchmarkFill({ pool, fetchChart: jest.fn(), now: NOW, env: {} });
        const selects = pool.calls.filter(([text]) => text.startsWith('SELECT')).map(([text]) => text);
        expect(selects).toHaveLength(2);
        for (const text of selects) {
            expect(text).toContain("WHERE status = 'closed' AND benchmark_symbol IS NULL AND entry_date IS NOT NULL AND exit_date IS NOT NULL");
            expect(text).toContain("AND (market IN ('India', 'UK', 'US') OR market IS NULL)");
        }
        // the high-conviction book stores dates: read as the day itself, never through a time zone
        expect(selects.find(text => text.includes('high_conviction_portfolio')))
            .toContain("to_char(entry_date, 'YYYY-MM-DD') AS entered, to_char(exit_date, 'YYYY-MM-DD') AS exited");
    });

    test('a market whose request fails waits for the next run; the others are still written', async () => {
        const pool = fakePool({
            trades: [
                { id: '21', symbol: 'INFY.NS', market: 'India', entered: new Date('2026-09-15T07:30:00Z'), exited: new Date('2026-09-18T07:00:00Z') },
                { id: '22', symbol: 'VOD.L', market: 'UK', entered: new Date('2026-09-15T12:00:00Z'), exited: new Date('2026-09-18T12:00:00Z') }
            ]
        });
        const fetchChart = jest.fn(async symbol => {
            if (symbol === '^NSEI') throw new Error('Request failed with status code 429');
            return ukBars;
        });
        const summary = await runBenchmarkFill({ pool, fetchChart, now: NOW, env: {} });
        expect(fetchChart.mock.calls.map(([symbol]) => symbol).sort()).toEqual(['^FTSE', '^NSEI']);
        const [[, params]] = updates(pool);
        expect(params).toEqual([['22'], ['^FTSE'], [-0.9901]]); // 9090 on the 15th -> 9000 on the 18th
        expect(summary).toMatchObject({ pending: 2, filled: 1, failed: 1, markets: 'UK', failedMarkets: 'India' });
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.error.mock.calls[0][0]).toMatch(/\^NSEI \(India\) could not be read, 1 position\(s\) wait for the next run/);
    });

    test('an exit without a final close waits, and a window the index cannot price is marked once', async () => {
        const pool = fakePool({
            trades: [
                // closed at 15:00 UK today with the bar for today already final (23:40 UK): filled
                { id: '31', symbol: 'VOD.L', market: 'UK', entered: new Date('2026-09-22T12:00:00Z'), exited: new Date('2026-09-24T14:00:00Z') },
                // exit tomorrow (a clock skew or a hand edit): no final close yet
                { id: '32', symbol: 'VOD.L', market: 'UK', entered: new Date('2026-09-22T12:00:00Z'), exited: new Date('2026-09-25T09:00:00Z') },
                // an entry before the index's first trading day
                { id: '33', symbol: 'VOD.L', market: 'UK', entered: new Date('2026-09-01T12:00:00Z'), exited: new Date('2026-09-16T12:00:00Z') },
                // an exit before its entry: nothing to price, and no request for it
                { id: '34', symbol: 'AAPL', market: 'US', entered: new Date('2026-09-20T15:00:00Z'), exited: new Date('2026-09-18T15:00:00Z') },
                // a market without an index
                { id: '35', symbol: 'SAP.DE', market: null, entered: new Date('2026-09-20T15:00:00Z'), exited: new Date('2026-09-22T15:00:00Z') }
            ]
        });
        const fetchChart = jest.fn(async () => ukBars);
        const summary = await runBenchmarkFill({ pool, fetchChart, now: NOW, env: {} });
        expect(fetchChart.mock.calls.map(([symbol]) => symbol)).toEqual(['^FTSE']);
        const [[, params]] = updates(pool);
        expect(params).toEqual([['34', '31', '33'], ['^GSPC', '^FTSE', '^FTSE'], [null, 0.2151, null]]);
        expect(summary).toMatchObject({ pending: 5, filled: 1, unpriced: 2, waiting: 1, noIndex: 1, failed: 0 });
    });

    test('a series shorter than was asked for never marks a row: it waits for the next run', async () => {
        const pool = fakePool({
            trades: [{ id: '41', symbol: 'VOD.L', market: 'UK', entered: new Date('2026-09-01T12:00:00Z'), exited: new Date('2026-09-16T12:00:00Z') }]
        });
        // the same bars, but Yahoo gives the index's first trading day as years earlier (or not at all)
        for (const meta of [{ firstTradeDate: Math.floor(Date.parse('1984-01-03T08:00:00Z') / 1000) }, {}]) {
            pool.calls.length = 0;
            const summary = await runBenchmarkFill({ pool, fetchChart: jest.fn(async () => chart(UK_BARS, meta)), now: NOW, env: {} });
            expect(summary).toMatchObject({ pending: 1, filled: 0, unpriced: 0, waiting: 1 });
            expect(updates(pool)).toEqual([]);
        }
    });

    test('BENCHMARK_FILL=false reads and writes nothing; no database means nothing to do', async () => {
        const pool = fakePool();
        expect(await runBenchmarkFill({ pool, fetchChart: jest.fn(), now: NOW, env: { BENCHMARK_FILL: 'False' } })).toEqual({ enabled: false });
        expect(pool.query).not.toHaveBeenCalled();
        expect(await runBenchmarkFill({ pool: null, fetchChart: jest.fn(), now: NOW, env: {} })).toEqual({ enabled: true, skipped: 'no database' });
    });

    test('a database error ends the run with the error in its summary, never a throw', async () => {
        const pool = { query: jest.fn(async () => { throw new Error('connection terminated'); }) };
        const summary = await runBenchmarkFill({ pool, fetchChart: jest.fn(), now: NOW, env: {} });
        expect(summary).toMatchObject({ enabled: true, error: 'connection terminated' });
        // and the next run is not blocked
        expect(await runBenchmarkFill({ pool: fakePool(), fetchChart: jest.fn(), now: NOW, env: {} })).toMatchObject({ pending: 0, filled: 0 });
    });
});

describe('its cron', () => {
    test('runs at 23:40 UK every day, is recorded in job_runs, and nothing it throws escapes', async () => {
        const cron = require('node-cron');
        const JobRuns = require('../../lib/shared/job-runs');
        const StockScanner = require('../../lib/scanner/scanner');
        cron.schedule.mockImplementation(() => ({ stop: jest.fn() }));
        new StockScanner().initialize();
        const calls = cron.schedule.mock.calls.filter(([expression]) => expression === BenchmarkFill.CRON_EXPRESSION);
        expect(calls).toHaveLength(1);
        const [, fire, options] = calls[0];
        expect(options).toMatchObject({ timezone: 'Europe/London' });
        expect(JobRuns.jobName('scanner', BenchmarkFill.CRON_EXPRESSION, options)).toBe('benchmark-fill');

        const run = jest.spyOn(BenchmarkFill, 'runBenchmarkFill');
        run.mockResolvedValueOnce({ enabled: true, filled: 2 });
        await expect(fire()).resolves.toEqual({ enabled: true, filled: 2 });
        run.mockRejectedValueOnce(new Error('boom'));
        await expect(fire()).resolves.toBeUndefined();
        expect(console.error).toHaveBeenCalledWith('[BENCHMARK] Fill job failed:', 'boom');
    });
});
