/**
 * The dead-ticker record (lib/shared/ticker-health.js, GAPS #10). The 7 AM scan and the 06:00 market-cap refresh note
 * what Yahoo answered for every symbol they already ask about; GET /api/ops/dead-tickers lists the symbols Yahoo has
 * stopped serving; the scan leaves them out only with SKIP_DEAD_TICKERS=true. Pinned here:
 *   1. how an answer is read: a 404 is "not found" and no bars is "no bars" (Yahoo has nothing), while a timeout, a
 *      429, a 5xx or a failed quote request passes;
 *   2. the streaks: a passing failure neither adds to nor ends a run of "nothing" answers; an answer with data ends it;
 *   3. dead = at least 5 such answers over at least 7 days; stale = Yahoo answers, but the newest bar is over 14 days
 *      old; a market where over 20% of the list reads dead is never skipped;
 *   4. recording never breaks a job: a database that throws, never answers or is missing, and junk input;
 *   5. the wiring: the scan notes every symbol it asks about and writes once; the market-cap refresh notes quoted,
 *      not quoted and failed requests; the skip is off by default, fails open and asks a skipped symbol again weekly.
 */
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
// Under jsdom, jest resolves cheerio's "browser" build, which is ESM and will not parse
jest.mock('cheerio', () => ({ load: jest.fn() }));
jest.mock('../../database-postgres', () => ({ pool: { query: jest.fn() }, storeMarketCap: jest.fn() }));
jest.mock('../../lib/telegram/telegram-bot', () => ({ sendTelegramAlert: jest.fn(), broadcastToSubscribers: jest.fn() }));
jest.mock('../../lib/push/push-service', () => jest.fn());
jest.mock('../../ml/conviction-sweep', () => ({
    isSweepDay: jest.fn(),
    runConvictionSweep: jest.fn(),
    scheduleResumeCheck: jest.fn(),
    runSweepWatchdog: jest.fn()
}));

const TradeDB = require('../../database-postgres');
const { broadcastToSubscribers } = require('../../lib/telegram/telegram-bot');
const YahooClient = require('../../lib/shared/yahoo-client');
const MarketCapService = require('../../lib/shared/market-cap-service');
const StockScanner = require('../../lib/scanner/scanner');
const TickerHealth = require('../../lib/shared/ticker-health');
const StockData = require('../../lib/shared/stock-data');

const DAY = 24 * 60 * 60 * 1000;
const MONDAY = new Date('2026-09-28T06:00:00Z');   // 07:00 UK
const day = n => new Date(MONDAY.getTime() + n * DAY);

const COLUMNS = ['first_checked_at', 'checked_at', 'last_ok_at', 'last_date', 'fail_streak', 'gone_streak', 'gone_since',
    'last_error', 'last_error_detail', 'last_failed_at'];

/** ticker_health in memory, answering the statements the module sends (the SQL itself is proven on Postgres) */
function memoryPool({ failOn, hangOn } = {}) {
    const table = new Map();
    let created = false;
    const calls = [];
    const query = jest.fn(async (sql, params = []) => {
        const text = sql.replace(/\s+/g, ' ').trim();
        calls.push(text);
        if (failOn && failOn.test(text)) throw new Error('database refused');
        if (hangOn && hangOn.test(text)) return new Promise(() => {});
        if (text.startsWith('CREATE TABLE IF NOT EXISTS ticker_health')) {
            created = true;
            return { rows: [] };
        }
        if (text.includes('to_regclass')) return { rows: [{ present: created || table.size > 0 }] };
        if (text.startsWith('SELECT') && text.includes('symbol = ANY')) {
            const [source, symbols] = params;
            return { rows: symbols.map(symbol => table.get(`${source}|${symbol}`)).filter(Boolean).map(row => ({ ...row })) };
        }
        if (text.startsWith('SELECT') && text.includes('source = ANY')) {
            return { rows: [...table.values()].filter(row => params[0].includes(row.source)).map(row => ({ ...row })) };
        }
        if (text.startsWith('INSERT INTO ticker_health')) {
            const [source, symbols, ...columns] = params;
            symbols.forEach((symbol, i) => {
                const row = { symbol, source };
                COLUMNS.forEach((name, j) => { row[name] = columns[j][i]; });
                const prev = table.get(`${source}|${symbol}`);
                if (prev && new Date(prev.checked_at) > new Date(row.checked_at)) return;
                table.set(`${source}|${symbol}`, row);
            });
            return { rows: [], rowCount: symbols.length };
        }
        throw new Error('unexpected SQL: ' + text.slice(0, 80));
    });
    return { query, table, calls, row: (symbol, source = 'scan') => table.get(`${source}|${symbol}`) };
}

const csv = (...bars) => 'Date,Open,High,Low,Close,Adj Close,Volume\n' +
    bars.map(([date, close]) => `${date},1,2,0.5,${close},${close},100`).join('\n') + '\n';
const history = (...bars) => ({ csv: csv(...bars), priceUnitRepair: null, staleFillRepair: null });
const notFound = () => Object.assign(new Error('Request failed with status code 404'), {
    response: { status: 404, data: { chart: { result: null, error: { code: 'Not Found', description: 'No data found, symbol may be delisted' } } } }
});
const timeout = () => Object.assign(new Error('timeout of 10000ms exceeded'), { code: 'ECONNABORTED' });
const universe = (...symbols) => symbols.map(symbol => ({ symbol, name: `${symbol} plc` }));

/** One scan run at `at`: answers is { SYMBOL: history | Error | null } */
async function scanRun(pool, at, answers) {
    const run = TickerHealth.startRun('scan', { pool, now: at });
    for (const [symbol, answer] of Object.entries(answers)) {
        if (answer instanceof Error) run.failed(symbol, answer);
        else run.history(symbol, answer);
    }
    return run.flush();
}

let logSpy;
let errorSpy;
beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('reading an answer', () => {
    test('a 404 is "not found"; a 429, a 5xx, another status, a timeout, no answer at all and anything else pass', () => {
        const status = s => Object.assign(new Error(`status ${s}`), { response: { status: s } });
        expect(TickerHealth.classifyError(notFound())).toBe('not-found');
        expect(TickerHealth.classifyError(status(429))).toBe('throttled');
        expect(TickerHealth.classifyError(status(503))).toBe('server-error');
        expect(TickerHealth.classifyError(status(400))).toBe('http-400');
        expect(TickerHealth.classifyError(timeout())).toBe('timeout');
        expect(TickerHealth.classifyError(new Error('timeout of 20000ms exceeded'))).toBe('timeout');
        expect(TickerHealth.classifyError(Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }))).toBe('network');
        expect(TickerHealth.classifyError(new TypeError('x is undefined'))).toBe('other');
        expect(TickerHealth.classifyError(undefined)).toBe('other');
    });

    test('the detail is Yahoo\'s own words when it sent some, else the error\'s message, at most 200 characters', () => {
        expect(TickerHealth.describeError(notFound())).toBe('No data found, symbol may be delisted');
        expect(TickerHealth.describeError(timeout())).toBe('timeout of 10000ms exceeded');
        expect(TickerHealth.describeError(new Error('x'.repeat(500)))).toHaveLength(200);
        expect(TickerHealth.describeError(Object.assign(new Error('Request failed with status code 404'), { response: { status: 404, data: '<html>' } })))
            .toBe('Request failed with status code 404');
    });

    test('the newest bar is the last one with a close; no bar, no date', () => {
        expect(TickerHealth.lastBarDate(csv(['2026-09-24', 101], ['2026-09-25', 102]))).toBe('2026-09-25');
        expect(TickerHealth.lastBarDate(csv(['2026-09-24', 101]) + '2026-09-25,,,,,,\n')).toBe('2026-09-24');
        expect(TickerHealth.lastBarDate('Date,Open,High,Low,Close,Adj Close,Volume\n')).toBeNull();
        for (const junk of [null, undefined, '', 42, 'not,a\ncsv']) expect(TickerHealth.lastBarDate(junk)).toBeNull();
    });

    test('a quote\'s last trade day, from seconds since the epoch', () => {
        const seconds = Date.parse('2026-09-24T15:30:00Z') / 1000;
        expect(TickerHealth.quoteDate({ regularMarketTime: seconds })).toBe('2026-09-24');
        expect(TickerHealth.quoteDate({ regularMarketTime: { raw: seconds } })).toBe('2026-09-24');
        for (const quote of [null, {}, { regularMarketTime: 0 }, { regularMarketTime: 'soon' }]) expect(TickerHealth.quoteDate(quote)).toBeNull();
    });

    test('markets as the refresh counts them, and the switch is exactly "true"', () => {
        expect(['RELIANCE.NS', 'VOD.L', 'AAPL', 'BRK-B'].map(TickerHealth.marketOf)).toEqual(['India', 'UK', 'US', 'US']);
        for (const value of ['true', 'TRUE', ' true ']) expect(TickerHealth.skipEnabled({ SKIP_DEAD_TICKERS: value })).toBe(true);
        for (const value of [undefined, '', 'false', '1', 'yes', 'on']) expect(TickerHealth.skipEnabled({ SKIP_DEAD_TICKERS: value })).toBe(false);
    });
});

describe('the streaks', () => {
    const at = n => day(n).toISOString();

    test('an answer with data: when, the newest date, and nothing failing', () => {
        expect(TickerHealth.nextRow(undefined, { ok: true, lastDate: '2026-09-25' }, at(0))).toMatchObject({
            first_checked_at: at(0), checked_at: at(0), last_ok_at: at(0), last_date: '2026-09-25',
            fail_streak: 0, gone_streak: 0, gone_since: null, last_error: null
        });
    });

    test('a passing failure adds to the failures but neither adds to nor ends the "nothing" answers', () => {
        let row;
        row = TickerHealth.nextRow(row, { ok: false, gone: true, kind: 'not-found', detail: 'No data found' }, at(0));
        row = TickerHealth.nextRow(row, { ok: false, gone: true, kind: 'not-found' }, at(1));
        row = TickerHealth.nextRow(row, { ok: false, gone: false, kind: 'timeout', detail: 'timeout' }, at(2));
        row = TickerHealth.nextRow(row, { ok: false, gone: true, kind: 'no-bars' }, at(3));
        expect(row).toMatchObject({ fail_streak: 4, gone_streak: 3, gone_since: at(0), last_error: 'no-bars', last_failed_at: at(3), first_checked_at: at(0) });
    });

    test('an answer with data ends both runs and keeps the last failure as history; one without a date keeps the old one', () => {
        let row = TickerHealth.nextRow(undefined, { ok: true, lastDate: '2026-09-25' }, at(0));
        row = TickerHealth.nextRow(row, { ok: false, gone: true, kind: 'not-found', detail: 'gone' }, at(1));
        row = TickerHealth.nextRow(row, { ok: true, lastDate: null }, at(2));
        expect(row).toMatchObject({ fail_streak: 0, gone_streak: 0, gone_since: null, last_ok_at: at(2), last_date: '2026-09-25', last_error: 'not-found', last_failed_at: at(1) });
    });
});

describe('writing a run', () => {
    test('what each answer becomes in ticker_health', async () => {
        const pool = memoryPool();
        const outcome = await scanRun(pool, day(0), {
            'LIVE.L': history(['2026-09-24', 10], ['2026-09-25', 11]),
            'EMPTY.L': null,
            'BLANK.L': { csv: 'Date,Open,High,Low,Close,Adj Close,Volume\n' },
            'GONE.L': notFound(),
            'SLOW.L': timeout()
        });
        expect(outcome).toEqual({ source: 'scan', noted: 5, written: 5 });
        expect(pool.row('LIVE.L')).toMatchObject({ last_date: '2026-09-25', fail_streak: 0, gone_streak: 0 });
        expect(pool.row('EMPTY.L')).toMatchObject({ last_error: 'no-bars', gone_streak: 1, fail_streak: 1, last_date: null });
        expect(pool.row('BLANK.L')).toMatchObject({ last_error: 'no-bars', gone_streak: 1 });
        expect(pool.row('GONE.L')).toMatchObject({ last_error: 'not-found', last_error_detail: 'No data found, symbol may be delisted', gone_streak: 1 });
        expect(pool.row('SLOW.L')).toMatchObject({ last_error: 'timeout', gone_streak: 0, fail_streak: 1 });
        expect(logSpy).toHaveBeenCalledWith('[TICKER HEALTH] scan: 5 answers noted: 1 with data, 3 without (no-bars 2, not-found 1), 1 failed (timeout 1)');
    });

    test('the last answer about a symbol in a run is the one kept, and junk never throws', async () => {
        const pool = memoryPool();
        const run = TickerHealth.startRun('scan', { pool, now: day(0) });
        run.failed('TWICE.L', timeout());
        run.history('TWICE.L', history(['2026-09-25', 5]));
        expect(() => {
            run.history('JUNK.L', { csv: 42 });
            run.history(undefined, null);
            run.failed(null, undefined);
            run.failed('ODD.L', 'a string, not an error');
            run.quoted('Q.L', null);
            run.requestFailed(null, timeout());
            run.requestFailed(['R.L'], undefined);
        }).not.toThrow();
        await run.flush();
        expect(pool.row('TWICE.L')).toMatchObject({ fail_streak: 0, last_date: '2026-09-25' });
        expect(pool.row('JUNK.L')).toMatchObject({ last_error: 'no-bars' });
        expect(pool.row('ODD.L')).toMatchObject({ last_error: 'other' });
    });

    test('one table check, one read, and one statement per 1,000 rows; a second flush writes nothing', async () => {
        const pool = memoryPool();
        const run = TickerHealth.startRun('scan', { pool, now: day(0) });
        for (let i = 0; i < 2500; i++) run.history(`S${i}.L`, history(['2026-09-25', 1]));
        expect(await run.flush()).toEqual({ source: 'scan', noted: 2500, written: 2500 });
        expect(pool.calls.filter(sql => sql.startsWith('CREATE TABLE'))).toHaveLength(1);
        expect(pool.calls.filter(sql => sql.startsWith('SELECT'))).toHaveLength(1);
        expect(pool.calls.filter(sql => sql.startsWith('INSERT'))).toHaveLength(3);
        expect(await run.flush()).toEqual({ source: 'scan', noted: 0, written: 0 });
        expect(pool.calls.filter(sql => sql.startsWith('INSERT'))).toHaveLength(3);
    });

    test('an older run never overwrites a newer one', async () => {
        const pool = memoryPool();
        await scanRun(pool, day(1), { 'LIVE.L': history(['2026-09-28', 3]) });
        const outcome = await scanRun(pool, day(0), { 'LIVE.L': notFound() });
        expect(outcome.written).toBe(0);
        expect(pool.row('LIVE.L')).toMatchObject({ fail_streak: 0, last_date: '2026-09-28' });
    });

    test('recording never breaks a job: a database that refuses, never answers, is missing or answers oddly', async () => {
        for (const failOn of [/^CREATE/, /^SELECT/, /^INSERT/]) {
            const run = TickerHealth.startRun('scan', { pool: memoryPool({ failOn }), now: day(0) });
            run.failed('GONE.L', notFound());
            await expect(run.flush()).resolves.toEqual({ source: 'scan', noted: 1, written: 0, error: 'database refused' });
        }
        expect(errorSpy).toHaveBeenCalledWith('⚠️ [TICKER HEALTH] Could not record the scan run\'s Yahoo answers: database refused');

        const hung = TickerHealth.startRun('scan', { pool: memoryPool({ hangOn: /^INSERT/ }), now: day(0), timeoutMs: 50 });
        hung.failed('GONE.L', notFound());
        await expect(hung.flush()).resolves.toMatchObject({ written: 0, error: 'no answer in 50 ms' });

        const none = TickerHealth.startRun('scan', { pool: null, now: day(0) });
        none.failed('GONE.L', notFound());
        await expect(none.flush()).resolves.toEqual({ source: 'scan', noted: 1, written: 0 });

        const odd = TickerHealth.startRun('scan', { pool: { query: () => undefined }, now: day(0) });
        odd.failed('GONE.L', notFound());
        await expect(odd.flush()).resolves.toEqual({ source: 'scan', noted: 1, written: 1 });

        const broken = TickerHealth.startRun('scan', { pool: { query: () => { throw new Error('pool is closed'); } }, now: day(0) });
        broken.failed('GONE.L', notFound());
        await expect(broken.flush()).resolves.toMatchObject({ written: 0, error: 'pool is closed' });
    });
});

describe('dead, stale and failing', () => {
    const judge = async (pool, now, symbols) => TickerHealth.report({ pool, now, env: {}, universe: universe(...symbols) });

    test('dead: 5 answers of "nothing" over at least 7 days, with no bar since', async () => {
        const pool = memoryPool();
        // Monday to Friday, then the next Monday: 6 answers, the first 7 days before the last
        for (const n of [0, 1, 2, 3, 4]) await scanRun(pool, day(n), { 'GONE.L': notFound(), 'NEW.L': n < 2 ? history(['2026-09-25', 1]) : notFound() });
        let r = await judge(pool, day(4), ['GONE.L', 'NEW.L']);
        expect(r.dead).toEqual([]);                                               // 5 answers, but over 4 days
        expect(r.failing.map(f => f.symbol)).toEqual(['GONE.L']);                 // 5 failures in a row: listed as failing
        await scanRun(pool, day(7), { 'GONE.L': notFound(), 'NEW.L': notFound() });
        r = await judge(pool, day(7), ['GONE.L', 'NEW.L']);
        expect(r.dead).toEqual([expect.objectContaining({
            symbol: 'GONE.L', name: 'GONE.L plc', market: 'UK', goneAnswers: 6, failedAnswers: 6, goneSince: day(0).toISOString(),
            lastError: 'not-found', lastErrorDetail: 'No data found, symbol may be delisted', lastBarDate: null, lastOkAt: null,
            firstCheckedAt: day(0).toISOString(), lastCheckedAt: day(7).toISOString(), quote: null
        })]);
        expect(r.counts.dead).toEqual({ India: 0, UK: 1, US: 0, total: 1 });
        expect(r.failing).toEqual([]);                                            // NEW.L: 4 answers since its last bar
        expect(r.table).toBe(true);
    });

    test('passing failures are not evidence, and one bar ends it', async () => {
        const pool = memoryPool();
        const answers = [notFound(), timeout(), notFound(), timeout(), notFound(), timeout(), notFound()];
        for (const [n, answer] of answers.entries()) await scanRun(pool, day(n * 2), { 'FLAKY.L': answer, 'BACK.L': n === 5 ? history(['2026-10-07', 2]) : notFound() });
        const r = await judge(pool, day(14), ['FLAKY.L', 'BACK.L']);
        expect(r.dead).toEqual([]);                                               // FLAKY.L: 4 "not found" answers; BACK.L: 1 since its bar
        expect(r.failing.map(f => [f.symbol, f.failedAnswers, f.goneAnswers])).toEqual([['FLAKY.L', 7, 4]]);
    });

    test('stale: Yahoo still answers, but its newest bar is over 14 days old', async () => {
        const pool = memoryPool();
        await scanRun(pool, day(0), { 'OLD.L': history(['2026-09-10', 4]), 'FRESH.L': history(['2026-09-25', 4]), 'QUIET.L': history(['2026-09-15', 4]) });
        const r = await judge(pool, day(0), ['OLD.L', 'FRESH.L', 'QUIET.L']);
        expect(r.stale).toEqual([expect.objectContaining({ symbol: 'OLD.L', lastBarDate: '2026-09-10', daysSinceBar: 18 })]);
        expect(r.dead).toEqual([]);
    });

    test('the quote\'s evidence rides along; symbols outside the universe are counted, not listed', async () => {
        const pool = memoryPool();
        for (const n of [0, 1, 2, 3, 4, 7]) await scanRun(pool, day(n), { 'GONE.NS': notFound(), 'DROPPED.L': notFound() });
        const quotes = TickerHealth.startRun('market-caps', { pool, now: day(7) });
        quotes.notQuoted('GONE.NS');
        await quotes.flush();
        const r = await judge(pool, day(7), ['GONE.NS']);
        expect(r.dead).toEqual([expect.objectContaining({ symbol: 'GONE.NS', market: 'India', quote: expect.objectContaining({ notQuotedAnswers: 1, lastError: 'not-quoted', lastQuotedAt: null }) })]);
        expect(r.notInUniverse).toBe(1);
        expect(r.sources.scan).toMatchObject({ symbols: 1, withData: 0, failing: 1, failingByKind: { 'not-found': 1 }, lastRunAt: day(7).toISOString() });
        expect(r.sources['market-caps']).toMatchObject({ symbols: 1, failing: 1 });
    });

    test('a market where over 20% of the list reads dead would not be skipped', async () => {
        const pool = memoryPool();
        const us = ['A', 'B', 'C', 'D', 'E'];
        for (const n of [0, 1, 2, 3, 4, 7]) await scanRun(pool, day(n), { A: notFound(), B: notFound(), 'X.L': notFound() });
        const r = await judge(pool, day(7), [...us, 'X.L', 'Y.L', 'Z.L', 'W.L', 'V.L', 'U.L']);
        expect(r.counts.dead).toEqual({ India: 0, UK: 1, US: 2, total: 3 });
        expect(r.skip).toEqual({ switch: 'SKIP_DEAD_TICKERS', enabled: false, refusedMarkets: ['US'] });  // 2 of 5, but 1 of 6
    });

    test('before the first run there is no table: nothing listed, the rule and the switch still stated', async () => {
        const r = await TickerHealth.report({ pool: memoryPool(), now: day(0), env: { SKIP_DEAD_TICKERS: 'true' }, universe: universe('A', 'B.L', 'C.NS', 'A') });
        expect(r).toEqual({
            table: false,
            rule: { deadMinAnswers: 5, deadMinDays: 7, staleBarDays: 14, recheckDays: 7, maxSkipShare: 0.2, goneKinds: ['not-found', 'no-bars', 'not-quoted'] },
            skip: { switch: 'SKIP_DEAD_TICKERS', enabled: true, refusedMarkets: [] },
            universe: { India: 1, UK: 1, US: 1, total: 3 },
            sources: {}, counts: { dead: { India: 0, UK: 0, US: 0, total: 0 }, stale: { India: 0, UK: 0, US: 0, total: 0 }, failing: { India: 0, UK: 0, US: 0, total: 0 } },
            notInUniverse: 0, dead: [], stale: [], failing: []
        });
    });

    test('the probe reads the whole universe by default, and needs a database', async () => {
        const r = await TickerHealth.report({ pool: memoryPool(), now: day(0), env: {} });
        expect(r.universe.total).toBe(new Set(StockData.getAllStocks().map(stock => stock.symbol)).size);
        expect(r.universe.total).toBe(r.universe.India + r.universe.UK + r.universe.US);
        await expect(TickerHealth.report({ pool: null })).rejects.toThrow('Database unavailable');
    });
});

describe('the skip (SKIP_DEAD_TICKERS)', () => {
    const on = { SKIP_DEAD_TICKERS: 'true' };
    async function withDead() {
        const pool = memoryPool();
        for (const n of [0, 1, 2, 3, 4, 7]) await scanRun(pool, day(n), { 'GONE.L': notFound(), 'LIVE.L': history(['2026-10-02', 1]) });
        return pool;
    }
    const list = universe('GONE.L', 'LIVE.L', 'A.L', 'B.L', 'C.L', 'D.L');

    test('off (the default): the list as it is, and not a single database call', async () => {
        const pool = memoryPool();
        const result = await TickerHealth.scanList(list, { pool, now: day(8), env: {} });
        expect(result).toEqual({ stocks: list, skipped: [], refusedMarkets: [] });
        expect(result.stocks).toBe(list);
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('on: a dead symbol is left out until a week after it was last asked', async () => {
        const pool = await withDead();
        const nextDay = await TickerHealth.scanList(list, { pool, now: day(8), env: on });
        expect(nextDay.stocks.map(s => s.symbol)).toEqual(['LIVE.L', 'A.L', 'B.L', 'C.L', 'D.L']);
        expect(nextDay.skipped).toEqual(['GONE.L']);
        const weekLater = await TickerHealth.scanList(list, { pool, now: day(14), env: on });
        expect(weekLater.stocks).toEqual(list);                                  // asked again: a line Yahoo serves again comes back
    });

    test('on: a market where over 20% of the list reads dead is scanned in full', async () => {
        const pool = await withDead();
        const result = await TickerHealth.scanList(universe('GONE.L', 'LIVE.L', 'A.L'), { pool, now: day(8), env: on });
        expect(result).toMatchObject({ skipped: [], refusedMarkets: ['UK'] });
        expect(result.stocks).toHaveLength(3);
    });

    test('on, but the record cannot be read: everything is scanned', async () => {
        for (const pool of [memoryPool({ failOn: /^SELECT/ }), memoryPool({ hangOn: /to_regclass/ }), memoryPool(), null]) {
            const result = await TickerHealth.scanList(list, { pool, now: day(8), env: on, timeoutMs: 50 });
            expect(result).toEqual({ stocks: list, skipped: [], refusedMarkets: [] });
        }
        expect(errorSpy).toHaveBeenCalledWith('⚠️ [TICKER HEALTH] Could not read the dead-ticker record, scanning the whole universe: database refused');
        expect(errorSpy).toHaveBeenCalledWith('⚠️ [TICKER HEALTH] Could not read the dead-ticker record, scanning the whole universe: no answer in 50 ms');
    });
});

describe('the jobs that feed it', () => {
    let memory;
    beforeEach(() => {
        memory = memoryPool();
        TradeDB.pool.query.mockImplementation((...args) => memory.query(...args));
        TradeDB.storeMarketCap.mockResolvedValue({});
        broadcastToSubscribers.mockResolvedValue([]);
    });

    function yahooHistory(answers) {
        return jest.spyOn(YahooClient, 'fetchHistoryCsv').mockImplementation(async symbol => {
            const answer = answers[symbol];
            if (answer instanceof Error) throw answer;
            return answer === undefined ? null : answer;
        });
    }

    test('the 7 AM scan notes every symbol it asks Yahoo about, and writes them once', async () => {
        yahooHistory({ 'LIVE.L': history(['2026-09-24', 10], ['2026-09-25', 11]), 'GONE.L': notFound(), 'SLOW.L': timeout() });
        const scanner = new StockScanner();

        const found = await scanner.findCurrentOpportunities(universe('LIVE.L', 'EMPTY.L', 'GONE.L', 'SLOW.L'));

        expect(found).toEqual([]);
        expect(scanner.tickerHealthRun).toBeNull();
        expect(memory.row('LIVE.L')).toMatchObject({ last_date: '2026-09-25', fail_streak: 0 });
        expect(memory.row('EMPTY.L')).toMatchObject({ last_error: 'no-bars', gone_streak: 1 });
        expect(memory.row('GONE.L')).toMatchObject({ last_error: 'not-found', gone_streak: 1 });
        expect(memory.row('SLOW.L')).toMatchObject({ last_error: 'timeout', gone_streak: 0 });
        expect(memory.calls.filter(sql => sql.startsWith('INSERT'))).toHaveLength(1);
    });

    test('a database that refuses changes nothing the scan finds', async () => {
        yahooHistory({ 'LIVE.L': history(['2026-09-25', 11]), 'GONE.L': notFound() });
        TradeDB.pool.query.mockImplementation(async () => { throw new Error('connection terminated'); });

        await expect(new StockScanner().findCurrentOpportunities(universe('LIVE.L', 'GONE.L'))).resolves.toEqual([]);
        expect(errorSpy).toHaveBeenCalledWith('⚠️ [TICKER HEALTH] Could not record the scan run\'s Yahoo answers: connection terminated');
    });

    test('outside a scan (a single fetch) nothing is noted', async () => {
        yahooHistory({ 'GONE.L': notFound() });
        expect(await new StockScanner().fetchStockData('GONE.L')).toBeNull();
        expect(TradeDB.pool.query).not.toHaveBeenCalled();
    });

    test('the scan asks about every symbol unless the switch is on; then the dead are left out, and counted', async () => {
        const fetch = yahooHistory({ 'LIVE.L': history(['2026-09-25', 11]), 'GONE.L': notFound() });
        const scanner = new StockScanner();
        scanner.getComprehensiveStockList = () => universe('LIVE.L', 'GONE.L', 'A.L', 'B.L', 'C.L', 'D.L');
        const previous = process.env.SKIP_DEAD_TICKERS;
        try {
            // GONE.L answered "not found" to 5 scans over the last 10 days (written as the scan's own runs write them)
            for (const n of [-10, -9, -8, -7, -3]) await scanRun(memory, new Date(Date.now() + n * DAY), { 'GONE.L': notFound() });
            delete process.env.SKIP_DEAD_TICKERS;
            let result = await scanner.runHighConvictionScan();
            expect(result).toMatchObject({ success: true, totalScanned: 6, deadTickersSkipped: 0 });
            expect(fetch.mock.calls.map(([symbol]) => symbol)).toContain('GONE.L');

            fetch.mockClear();
            process.env.SKIP_DEAD_TICKERS = 'true';
            result = await scanner.runHighConvictionScan();
            expect(result).toMatchObject({ success: true, totalScanned: 5, deadTickersSkipped: 1 });
            expect(fetch).toHaveBeenCalledTimes(5);
            expect(fetch.mock.calls.map(([symbol]) => symbol)).not.toContain('GONE.L');
        } finally {
            if (previous === undefined) delete process.env.SKIP_DEAD_TICKERS;
            else process.env.SKIP_DEAD_TICKERS = previous;
        }
    });

    test('the market-cap refresh notes what its quote requests answered, and returns the same counts', async () => {
        const traded = Date.parse('2026-09-24T15:30:00Z') / 1000;
        jest.spyOn(YahooClient, 'fetchQuotes').mockImplementation(async symbols => {
            if (symbols.includes('CCC')) throw Object.assign(new Error('Request failed with status code 401'), { response: { status: 401 } });
            return [{ symbol: 'aaa', currency: 'USD', marketCap: 1e9, regularMarketTime: traded }];
        });

        const result = await MarketCapService.updateMarketCaps(['AAA', 'BBB', 'CCC'], 2, 0);

        expect(result).toMatchObject({ requested: 3, updated: 1, notQuoted: 1, failed: 1 });
        expect(memory.row('AAA', 'market-caps')).toMatchObject({ last_date: '2026-09-24', fail_streak: 0 });
        expect(memory.row('BBB', 'market-caps')).toMatchObject({ last_error: 'not-quoted', gone_streak: 1 });
        expect(memory.row('CCC', 'market-caps')).toMatchObject({ last_error: 'request-http-401', gone_streak: 0, fail_streak: 1 });
    });
});
