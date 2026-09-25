/**
 * GAPS #11: dated exchange rates (lib/shared/fx-rates.js).
 *
 *   1. The stored closes: each bar's London day; never today's bar (not final), a bar without a close or one outside
 *      the pair's band; the last bar of a day wins.
 *   2. The rate of a day: the last stored close on or before it, and before the first close the first one; the six
 *      rates derived from the two pairs agree with each other; an amount converts through the pound, and not at all
 *      without both pairs. The store is read into memory once, again after an hour, and at once while it is empty.
 *   3. GET /api/fx/rates' window and its series: every calendar day, a weekend on the Friday's close.
 *   4. The refresh: one request per pair (all history for an empty store, LEAD_DAYS before the newest close
 *      otherwise); a failed pair keeps its closes and the other is still written; the kill switch, no database and a
 *      database error end it quietly.
 *   5. The restamp: a closed high-conviction position's P&L at its exit day's rate, every position's investment at
 *      its entry day's, the column in the market's own currency never written, rows already right not written.
 *   6. The high-conviction pass converts at the dated rates, and at its old fixed ones while nothing is stored.
 *   7. The cron (00:15 UK, recorded in job_runs as 'fx-rates', nothing it throws escapes) and the boot catch-up (an
 *      empty or stale store only).
 * The SQL on a real Postgres is checked by tests/endpoints/fx-rates.test.js.
 */

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
// Under jsdom, jest resolves cheerio's "browser" build, which is ESM and will not parse
jest.mock('cheerio', () => ({ load: jest.fn() }));
jest.mock('../../database-postgres', () => ({
    pool: { query: jest.fn() },
    getActiveHighConvictionTrades: jest.fn(),
    updateHighConvictionTrade: jest.fn(),
    closeHighConvictionTrade: jest.fn()
}));
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

const FxRates = require('../../lib/shared/fx-rates');

const squash = sql => sql.replace(/\s+/g, ' ').trim();
const epoch = day => Math.floor(Date.parse(day + 'T00:00:00Z') / 1000);
// 00:15 UK on Friday 25 September 2026 (BST): the nightly run
const NOW = new Date('2026-09-24T23:15:00Z');

// Yahoo's v8 chart answer for daily bars at the given UTC moments
function chart(bars) {
    return {
        chart: {
            result: [{
                meta: { symbol: 'X', exchangeTimezoneName: 'Europe/London' },
                timestamp: bars.map(([iso]) => Math.floor(Date.parse(iso) / 1000)),
                indicators: { quote: [{ close: bars.map(([, close]) => close) }] }
            }],
            error: null
        }
    };
}
// A currency bar starts at midnight London time: 23:00 UTC the day before, in summer
const INR_BARS = [
    ['2026-09-21T23:00:00Z', 118.2], ['2026-09-22T23:00:00Z', 118.5], ['2026-09-23T23:00:00Z', 118.9],
    ['2026-09-24T23:00:00Z', 119.3] // today, 25 September: not final
];
const USD_BARS = [
    ['2026-09-21T23:00:00Z', 1.341], ['2026-09-22T23:00:00Z', 1.344], ['2026-09-23T23:00:00Z', 1.347],
    ['2026-09-24T23:00:00Z', 1.35]
];
const answer = symbol => chart(symbol === 'GBPINR=X' ? INR_BARS : USD_BARS);

// Friday 18th, then Monday 21st and Tuesday 22nd: no close on the weekend
const RATES = [
    { pair: 'GBPINR', day: '2026-09-18', rate: 118.0 }, { pair: 'GBPINR', day: '2026-09-21', rate: 118.4 },
    { pair: 'GBPINR', day: '2026-09-22', rate: 118.6 },
    { pair: 'GBPUSD', day: '2026-09-18', rate: 1.34 }, { pair: 'GBPUSD', day: '2026-09-21', rate: 1.345 },
    { pair: 'GBPUSD', day: '2026-09-22', rate: 1.35 }
];

/**
 * A database holding fx_rates rows and, when given, high_conviction_portfolio rows. It answers the statements the
 * module and the job-run log send, keeps the upserts, and records every statement in `calls`.
 */
function fakePool({ rates = [], positions = null, failOn = null } = {}) {
    const store = rates.map(row => ({ ...row }));
    const calls = [];
    const query = jest.fn(async (sql, params) => {
        const text = squash(sql);
        calls.push([text, params]);
        if (failOn && failOn.test(text)) throw new Error('connection terminated');
        if (/^CREATE (TABLE|INDEX) IF NOT EXISTS/.test(text)) return { rows: [] };
        if (text.startsWith('SELECT pair, to_char(MAX(day)')) {
            const newest = new Map();
            for (const row of store) if (!newest.has(row.pair) || row.day > newest.get(row.pair)) newest.set(row.pair, row.day);
            return { rows: [...newest].map(([pair, day]) => ({ pair, newest: day })) };
        }
        if (text.startsWith('SELECT pair, to_char(day')) {
            return { rows: store.slice().sort((a, b) => (a.pair + a.day).localeCompare(b.pair + b.day)) };
        }
        if (text.startsWith('INSERT INTO fx_rates')) {
            const [pair, days, values] = params;
            let written = 0;
            days.forEach((day, i) => {
                const rate = Math.round(values[i] * 1e8) / 1e8; // NUMERIC(18, 8)
                const row = store.find(r => r.pair === pair && r.day === day);
                if (row && row.rate === rate) return;
                if (row) row.rate = rate; else store.push({ pair, day, rate });
                written++;
            });
            return { rowCount: written };
        }
        if (text.startsWith("SELECT to_regclass('public.high_conviction_portfolio')")) return { rows: [{ present: positions !== null }] };
        if (text.startsWith('SELECT id, market, status')) return { rows: positions };
        if (text.startsWith('UPDATE high_conviction_portfolio')) return { rowCount: params[0].length };
        if (text.startsWith('INSERT INTO job_runs')) return { rows: [{ id: 41 }] };
        if (/^(UPDATE|DELETE FROM) job_runs/.test(text)) return { rows: [] };
        throw new Error('unexpected statement: ' + text);
    });
    return { query, calls, store };
}

beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    // Every test starts from an empty store in memory
    await FxRates.load(fakePool());
});

describe('the stored closes', () => {
    test('each bar\'s London day; not today\'s bar, a bar without a close or one outside the band; the last bar of a day', () => {
        const band = FxRates.PAIRS.find(p => p.pair === 'GBPINR');
        const closes = FxRates.finalCloses(chart([
            ['2026-09-21T23:00:00Z', 118.2],   // 22 September in London
            ['2026-09-22T23:00:00Z', 118.4],   // 23 September ...
            ['2026-09-23T10:00:00Z', 118.45],  // ... and a later bar on the 23rd: it wins
            ['2026-09-23T23:00:00Z', null],    // 24 September without a close
            ['2026-09-23T23:30:00Z', 11.89],   // a bad tick, outside 50-300
            ['2026-09-24T23:00:00Z', 119.3]    // 25 September: today, not final
        ]), band, NOW);
        expect(closes).toEqual([{ day: '2026-09-22', rate: 118.2 }, { day: '2026-09-23', rate: 118.45 }]);
        // in winter a bar at midnight London is midnight UTC
        expect(FxRates.finalCloses(chart([['2026-01-15T00:00:00Z', 115.1]]), band, NOW)).toEqual([{ day: '2026-01-15', rate: 115.1 }]);
        expect(FxRates.finalCloses({ chart: { result: null } }, band, NOW)).toEqual([]);
        expect(FxRates.finalCloses(undefined, band, NOW)).toEqual([]);
    });
});

describe('the rate of a day', () => {
    beforeEach(() => FxRates.load(fakePool({ rates: RATES })));

    test('the last close on or before the day; before the first close, the first', () => {
        expect(FxRates.rateOn('GBPINR', '2026-09-21')).toEqual({ day: '2026-09-21', rate: 118.4 });
        expect(FxRates.rateOn('GBPINR', '2026-09-20')).toEqual({ day: '2026-09-18', rate: 118.0 }); // Sunday: Friday's close
        expect(FxRates.rateOn('GBPINR', '2026-09-30')).toEqual({ day: '2026-09-22', rate: 118.6 }); // after the newest
        expect(FxRates.rateOn('GBPINR', '2026-01-02')).toEqual({ day: '2026-09-18', rate: 118.0 }); // before the first
        expect(FxRates.rateOn('GBPUSD', new Date('2026-09-21T10:00:00Z'))).toEqual({ day: '2026-09-21', rate: 1.345 });
        expect(FxRates.rateOn('GBPINR', '2026-09-21T14:00:00.000Z')).toEqual({ day: '2026-09-21', rate: 118.4 });
        expect(FxRates.rateOn('GBPINR', 'not a day')).toBeNull();
        expect(FxRates.rateOn('GBPEUR', '2026-09-21')).toBeNull();
    });

    test('the six rates come from the two pairs and agree with each other', () => {
        const rates = FxRates.ratesOn('2026-09-21');
        expect(rates).toMatchObject({ GBP_TO_INR: 118.4, GBP_TO_USD: 1.345, day: '2026-09-21' });
        expect(rates.USD_TO_INR).toBeCloseTo(118.4 / 1.345, 10);
        expect(rates.INR_TO_GBP * rates.GBP_TO_INR).toBeCloseTo(1, 12);
        expect(rates.USD_TO_GBP * rates.GBP_TO_USD).toBeCloseTo(1, 12);
        expect(rates.INR_TO_USD * rates.USD_TO_INR).toBeCloseTo(1, 12);
    });

    test('an amount converts through the pound at the day\'s rate', () => {
        expect(FxRates.convert(100, 'GBP', 'INR', '2026-09-21')).toBeCloseTo(11840, 8);
        expect(FxRates.convert(11840, 'INR', 'USD', '2026-09-21')).toBeCloseTo(134.5, 8);
        expect(FxRates.convert(134.5, 'USD', 'GBP', '2026-09-21')).toBeCloseTo(100, 8);
        expect(FxRates.convert(5, 'USD', 'USD', 'any day')).toBe(5);
        expect(FxRates.convert(5, 'EUR', 'GBP', '2026-09-21')).toBeNull();
        expect(FxRates.convert(NaN, 'GBP', 'INR', '2026-09-21')).toBeNull();
        const all = FxRates.convertAll(250, 'GBP', '2026-09-22');
        expect(all.GBP).toBe(250);
        expect(all.INR).toBeCloseTo(29650, 8);
        expect(all.USD).toBeCloseTo(337.5, 8);
    });

    test('without both pairs nothing converts, and the callers keep their own rates', async () => {
        await FxRates.load(fakePool({ rates: RATES.filter(r => r.pair === 'GBPINR') }));
        expect(FxRates.hasRates()).toBe(false);
        expect(FxRates.ratesOn('2026-09-21')).toBeNull();
        expect(FxRates.convert(100, 'GBP', 'INR', '2026-09-21')).toBeNull();
        expect(FxRates.convertAll(100, 'GBP', '2026-09-21')).toBeNull();
    });
});

describe('reading the store into memory', () => {
    test('once, then not again within the hour; an empty store is read again at every call', async () => {
        const pool = fakePool({ rates: RATES });
        await FxRates.ensureLoaded({ pool });
        await FxRates.ensureLoaded({ pool });
        expect(pool.query).toHaveBeenCalledTimes(1);
        expect(FxRates.ratesOn('2026-09-22')).toMatchObject({ GBP_TO_INR: 118.6 });

        await FxRates.load(fakePool());
        const empty = fakePool();
        await FxRates.ensureLoaded({ pool: empty });
        await FxRates.ensureLoaded({ pool: empty });
        expect(empty.query).toHaveBeenCalledTimes(2);
        // no pool: nothing is read, nothing breaks
        await expect(FxRates.ensureLoaded({ pool: null })).resolves.toBeDefined();
    });

    test('a store that does not exist yet reads as empty; any other error keeps what was held and is logged', async () => {
        const missing = { query: jest.fn(async () => { throw Object.assign(new Error('relation "fx_rates" does not exist'), { code: '42P01' }); }) };
        await FxRates.ensureLoaded({ pool: missing });
        expect(FxRates.hasRates()).toBe(false);
        expect(console.error).not.toHaveBeenCalled();

        await FxRates.load(fakePool({ rates: RATES }));
        const broken = { query: jest.fn(async () => { throw new Error('connection terminated'); }) };
        // an old copy: past the hour, so it is read again, and the read fails
        const realNow = Date.now;
        Date.now = () => realNow() + FxRates.LOAD_TTL_MS + 1000;
        try {
            await FxRates.ensureLoaded({ pool: broken });
        } finally {
            Date.now = realNow;
        }
        expect(broken.query).toHaveBeenCalledTimes(1);
        expect(FxRates.ratesOn('2026-09-22')).toMatchObject({ GBP_TO_INR: 118.6 });
        expect(console.error).toHaveBeenCalledWith('[FX] Could not read the stored exchange rates: connection terminated');
    });
});

describe('GET /api/fx/rates: the window and the series', () => {
    test('the window: by default the 365 days up to today in London; real dates only, in order, at most 4000 days', () => {
        expect(FxRates.parseWindow({}, NOW)).toEqual({ from: '2025-09-25', to: '2026-09-25' });
        expect(FxRates.parseWindow({ from: '', to: '' }, NOW)).toEqual({ from: '2025-09-25', to: '2026-09-25' });
        expect(FxRates.parseWindow({ from: '2026-09-01', to: '2026-09-10' }, NOW)).toEqual({ from: '2026-09-01', to: '2026-09-10' });
        expect(FxRates.parseWindow({ from: '2026-09-01' }, NOW)).toEqual({ from: '2026-09-01', to: '2026-09-25' });
        expect(FxRates.parseWindow({ from: '2026-02-30' }, NOW).error).toBe('from must be a date written YYYY-MM-DD');
        expect(FxRates.parseWindow({ to: 'abc' }, NOW).error).toBe('to must be a date written YYYY-MM-DD');
        expect(FxRates.parseWindow({ from: ['2026-09-01', '2026-09-02'] }, NOW).error).toBe('from must be a date written YYYY-MM-DD');
        expect(FxRates.parseWindow({ from: '2026-09-10', to: '2026-09-01' }, NOW).error).toBe('from must not be after to');
        expect(FxRates.parseWindow({ from: '2010-01-01', to: '2026-09-01' }, NOW).error).toBe('at most 4000 days a request');
        expect(FxRates.parseWindow({ from: '2015-09-01', to: '2026-08-01' }, NOW)).toEqual({ from: '2015-09-01', to: '2026-08-01' });
    });

    test('every calendar day with the rates in force that day', async () => {
        await FxRates.load(fakePool({ rates: RATES }));
        expect(FxRates.dailySeries('2026-09-17', '2026-09-23')).toEqual({
            from: '2026-09-17',
            to: '2026-09-23',
            source: 'dated',
            firstStoredDay: '2026-09-18',
            newestStoredDay: '2026-09-22',
            columns: ['day', 'GBPINR', 'GBPUSD'],
            days: [
                ['2026-09-17', 118.0, 1.34],  // before the first close: the first
                ['2026-09-18', 118.0, 1.34],
                ['2026-09-19', 118.0, 1.34],  // the weekend: Friday's
                ['2026-09-20', 118.0, 1.34],
                ['2026-09-21', 118.4, 1.345],
                ['2026-09-22', 118.6, 1.35],
                ['2026-09-23', 118.6, 1.35]   // after the newest close
            ]
        });
    });

    test('nothing stored: no day', () => {
        expect(FxRates.dailySeries('2026-09-01', '2026-09-03')).toMatchObject({ source: 'none', firstStoredDay: null, newestStoredDay: null, days: [] });
    });
});

describe('the refresh', () => {
    test('an empty store asks for all the history, one request per pair, and keeps the final closes', async () => {
        const pool = fakePool();
        const fetchChart = jest.fn(async symbol => answer(symbol));
        const summary = await FxRates.refreshFxRates({ pool, fetchChart, now: NOW, env: {} });

        expect(fetchChart.mock.calls.map(([symbol]) => symbol)).toEqual(['GBPINR=X', 'GBPUSD=X']);
        for (const [, params, options] of fetchChart.mock.calls) {
            expect(params).toEqual({ period1: epoch(FxRates.HISTORY_START), period2: Math.floor(NOW.getTime() / 1000), interval: '1d' });
            expect(options).toMatchObject({ timeout: expect.any(Number) });
        }
        expect(pool.calls[0][0]).toMatch(/^CREATE TABLE IF NOT EXISTS fx_rates \( pair TEXT NOT NULL, day DATE NOT NULL, rate NUMERIC\(18, 8\) NOT NULL, fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW\(\), PRIMARY KEY \(pair, day\) \)$/);
        const upsert = pool.calls.find(([text]) => text.startsWith('INSERT INTO fx_rates'))[0];
        expect(upsert).toBe('INSERT INTO fx_rates (pair, day, rate) SELECT $1, v.day, v.rate FROM unnest($2::date[], $3::numeric[]) AS v(day, rate) ' +
            'ON CONFLICT (pair, day) DO UPDATE SET rate = EXCLUDED.rate, fetched_at = NOW() WHERE fx_rates.rate IS DISTINCT FROM EXCLUDED.rate');
        expect(pool.store.filter(r => r.pair === 'GBPINR').map(r => [r.day, r.rate])).toEqual([['2026-09-22', 118.2], ['2026-09-23', 118.5], ['2026-09-24', 118.9]]);
        expect(summary).toMatchObject({ enabled: true, requested: 2, stored: 6, pairs: 'GBPINR,GBPUSD', failedPairs: null, newestDay: '2026-09-24', restamped: 0 });
        // and the store is in memory at once
        expect(FxRates.ratesOn('2026-09-25')).toMatchObject({ GBP_TO_INR: 118.9, GBP_TO_USD: 1.347, day: '2026-09-24' });
    });

    test('the next run asks from LEAD_DAYS before the newest close, and a close already stored is not written again', async () => {
        const pool = fakePool();
        const fetchChart = jest.fn(async symbol => answer(symbol));
        await FxRates.refreshFxRates({ pool, fetchChart, now: NOW, env: {} });
        fetchChart.mockClear();
        const summary = await FxRates.refreshFxRates({ pool, fetchChart, now: NOW, env: {} });
        expect(fetchChart).toHaveBeenCalledTimes(2);
        expect(fetchChart.mock.calls[0][1].period1).toBe(epoch('2026-09-14'));
        expect(summary).toMatchObject({ requested: 2, stored: 0, failedPairs: null });
    });

    test('a pair whose request fails keeps its closes; the other is still written', async () => {
        const pool = fakePool({ rates: RATES });
        const fetchChart = jest.fn(async symbol => {
            if (symbol === 'GBPUSD=X') throw new Error('Request failed with status code 429');
            return answer(symbol);
        });
        const summary = await FxRates.refreshFxRates({ pool, fetchChart, now: NOW, env: {} });
        expect(summary).toMatchObject({ requested: 2, stored: 3, pairs: 'GBPINR', failedPairs: 'GBPUSD', newestDay: '2026-09-22' });
        expect(pool.store.filter(r => r.pair === 'GBPUSD')).toEqual(RATES.filter(r => r.pair === 'GBPUSD'));
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.error.mock.calls[0][0]).toMatch(/^\[FX\] GBPUSD=X could not be read, its stored rates stand until the next run: Request failed/);
    });

    test('FX_RATES_REFRESH=false reads and writes nothing; no database, nothing to do; a database error never throws', async () => {
        const pool = fakePool();
        const fetchChart = jest.fn();
        expect(await FxRates.refreshFxRates({ pool, fetchChart, now: NOW, env: { FX_RATES_REFRESH: 'False' } })).toEqual({ enabled: false });
        expect(pool.query).not.toHaveBeenCalled();
        expect(fetchChart).not.toHaveBeenCalled();
        expect(await FxRates.refreshFxRates({ pool: null, fetchChart, now: NOW, env: {} })).toEqual({ enabled: true, skipped: 'no database' });

        const broken = fakePool({ failOn: /^SELECT pair, to_char\(MAX/ });
        const summary = await FxRates.refreshFxRates({ pool: broken, fetchChart, now: NOW, env: {} });
        expect(summary).toMatchObject({ enabled: true, error: 'connection terminated' });
        expect(fetchChart).not.toHaveBeenCalled();
        // and the next run is not blocked
        expect(await FxRates.refreshFxRates({ pool: fakePool(), fetchChart: jest.fn(async symbol => answer(symbol)), now: NOW, env: {} }))
            .toMatchObject({ stored: 6 });
    });
});

describe('the high-conviction restamp', () => {
    const POSITIONS = () => [
        // UK, closed: pounds are its own; rupees and dollars carry the old fixed rates (105, 1.27)
        {
            id: 1, market: 'UK', status: 'closed', entry_day: '2026-09-18', exit_day: '2026-09-21',
            investment_gbp: 250, investment_inr: 26250, investment_usd: 318,
            pl_amount_gbp: 20, pl_amount_inr: 2100, pl_amount_usd: 25.4
        },
        // India, still open: its P&L is the 10-minute pass's; its investment is restamped
        {
            id: 2, market: 'India', status: 'active', entry_day: '2026-09-21', exit_day: null,
            investment_gbp: 238, investment_inr: 25000, investment_usd: 301,
            pl_amount_gbp: 1, pl_amount_inr: 100, pl_amount_usd: 1.2
        },
        // US, closed, already at its own days' rates: not written
        {
            id: 3, market: 'US', status: 'closed', entry_day: '2026-09-22', exit_day: '2026-09-22',
            investment_gbp: 222.2222, investment_inr: 26355.5556, investment_usd: 300,
            pl_amount_gbp: 8.8889, pl_amount_inr: 1054.2222, pl_amount_usd: 12
        }
    ];

    test('the other two columns at the day\'s rate: P&L at the exit day, investment at the entry day; the own column never', async () => {
        const pool = fakePool({ rates: RATES, positions: POSITIONS() });
        await FxRates.load(pool);
        expect(await FxRates.restampHighConviction(pool)).toBe(2);

        const [text, params] = pool.calls.find(([t]) => t.startsWith('UPDATE high_conviction_portfolio'));
        expect(text).toBe('UPDATE high_conviction_portfolio AS h SET investment_gbp = COALESCE(v.investment_gbp, h.investment_gbp), ' +
            'investment_inr = COALESCE(v.investment_inr, h.investment_inr), investment_usd = COALESCE(v.investment_usd, h.investment_usd), ' +
            'pl_amount_gbp = COALESCE(v.pl_amount_gbp, h.pl_amount_gbp), pl_amount_inr = COALESCE(v.pl_amount_inr, h.pl_amount_inr), ' +
            'pl_amount_usd = COALESCE(v.pl_amount_usd, h.pl_amount_usd) ' +
            'FROM unnest($1::int[], $2::numeric[], $3::numeric[], $4::numeric[], $5::numeric[], $6::numeric[], $7::numeric[]) ' +
            'AS v(id, investment_gbp, investment_inr, investment_usd, pl_amount_gbp, pl_amount_inr, pl_amount_usd) WHERE h.id = v.id');
        const [ids, investmentGbp, investmentInr, investmentUsd, plGbp, plInr, plUsd] = params;
        expect(ids).toEqual([1, 2]);
        // UK: invested £250 on the 18th (118.0, 1.34); made £20 by the 21st (118.4, 1.345)
        expect([investmentGbp[0], investmentInr[0], investmentUsd[0]]).toEqual([null, 29500, 335]);
        expect([plGbp[0], plInr[0], plUsd[0]]).toEqual([null, 2368, 26.9]);
        // India: ₹25,000 on the 21st; an open position's P&L is left to the pass
        expect([investmentGbp[1], investmentInr[1], investmentUsd[1]]).toEqual([211.1486, null, 283.9949]);
        expect([plGbp[1], plInr[1], plUsd[1]]).toEqual([null, null, null]);
    });

    test('nothing to write: no statement; no table or no rates: nothing read', async () => {
        const settled = fakePool({ rates: RATES, positions: POSITIONS().filter(p => p.id === 3) });
        await FxRates.load(settled);
        expect(await FxRates.restampHighConviction(settled)).toBe(0);
        expect(settled.calls.some(([t]) => t.startsWith('UPDATE'))).toBe(false);

        const noTable = fakePool({ rates: RATES, positions: null });
        await FxRates.load(noTable);
        expect(await FxRates.restampHighConviction(noTable)).toBe(0);
        expect(noTable.calls.some(([t]) => t.startsWith('SELECT id'))).toBe(false);

        await FxRates.load(fakePool());
        const noRates = fakePool({ positions: POSITIONS() });
        expect(await FxRates.restampHighConviction(noRates)).toBe(0);
        expect(noRates.query).not.toHaveBeenCalled();
    });

    test('the refresh restamps after it stores', async () => {
        const pool = fakePool({ positions: POSITIONS() });
        const summary = await FxRates.refreshFxRates({ pool, fetchChart: jest.fn(async symbol => answer(symbol)), now: NOW, env: {} });
        // every close is from the 22nd on: the 18th and 21st take the first one (118.2, 1.341), so all three move
        expect(summary.restamped).toBe(3);
    });
});

describe('the high-conviction pass', () => {
    const TradeDB = require('../../database-postgres');
    const HighConvictionPortfolioManager = require('../../lib/portfolio/high-conviction-manager');

    test('P&L in the other two currencies at the day\'s dated rates; the old fixed rates while nothing is stored', async () => {
        const manager = new HighConvictionPortfolioManager();
        // nothing stored: GBP_TO_INR 105, GBP_TO_USD 1.27, INR_TO_GBP 0.0095, INR_TO_USD 0.012
        expect(manager.calculatePL(100, 110, 1, 'UK', '2026-09-21')).toMatchObject({ plPercent: 10, plGBP: 10, plINR: 1050, plUSD: 12.7 });

        await FxRates.load(fakePool({ rates: RATES }));
        const uk = manager.calculatePL(100, 110, 1, 'UK', '2026-09-21');
        expect(uk.plPercent).toBe(10);
        expect(uk.plGBP).toBe(10);
        expect(uk.plINR).toBeCloseTo(1184, 8);
        expect(uk.plUSD).toBeCloseTo(13.45, 8);
        const india = manager.calculatePL(1000, 1100, 1, 'India', '2026-09-20'); // a Sunday: Friday's close
        expect(india.plINR).toBe(100);
        expect(india.plGBP).toBeCloseTo(100 / 118.0, 10);
        expect(india.plUSD).toBeCloseTo(100 / 118.0 * 1.34, 10);
        // no day: today's, the newest close on or before it
        expect(manager.calculatePL(100, 110, 1, 'US').plINR).toBeCloseTo(10 / 1.35 * 118.6, 8);
    });

    test('the pass reads the store before it converts, and writes the dated figures', async () => {
        TradeDB.getActiveHighConvictionTrades.mockResolvedValue([{
            id: 7, symbol: 'VOD.L', name: 'Vodafone', market: 'UK', currency_symbol: '£', signal_date: '2026-09-21',
            entry_date: '2026-09-21', entry_price: '100', target_price: '108', stop_loss_price: '95',
            square_off_date: '2099-01-01', shares: '2', status: 'active'
        }]);
        const store = fakePool({ rates: RATES });
        TradeDB.pool.query.mockImplementation(async (sql, params) => (/FROM pending_signals/.test(sql) ? { rows: [] } : store.query(sql, params)));
        TradeDB.updateHighConvictionTrade.mockResolvedValue({});
        const manager = new HighConvictionPortfolioManager();
        jest.spyOn(manager, 'fetchCurrentPrice').mockResolvedValue(103);

        await manager.updateAllActiveTrades();

        expect(store.calls.map(([text]) => text)).toEqual(["SELECT pair, to_char(day, 'YYYY-MM-DD') AS day, rate::float8 AS rate FROM fx_rates ORDER BY pair, day"]);
        const [[id, update]] = TradeDB.updateHighConvictionTrade.mock.calls;
        expect(id).toBe(7);
        // £6 at the newest close on or before today (the 22nd: 118.6, 1.35)
        expect(update.plAmountGBP).toBeCloseTo(6, 10);
        expect(update.plAmountINR).toBeCloseTo(6 * 118.6, 8);
        expect(update.plAmountUSD).toBeCloseTo(6 * 1.35, 10);
    });
});

describe('its cron and the boot catch-up', () => {
    test('00:15 UK every day, recorded in job_runs as fx-rates; nothing it throws escapes; boot schedules the catch-up', async () => {
        const cron = require('node-cron');
        const JobRuns = require('../../lib/shared/job-runs');
        const StockScanner = require('../../lib/scanner/scanner');
        cron.schedule.mockImplementation(() => ({ stop: jest.fn() }));
        const catchUp = jest.spyOn(FxRates, 'scheduleBootCatchUp').mockReturnValue(null);
        new StockScanner().initialize();
        expect(catchUp).toHaveBeenCalledTimes(1);
        const calls = cron.schedule.mock.calls.filter(([expression]) => expression === FxRates.CRON_EXPRESSION);
        expect(calls).toHaveLength(1);
        const [, fire, options] = calls[0];
        expect(options).toMatchObject({ timezone: 'Europe/London' });
        expect(JobRuns.jobName('scanner', FxRates.CRON_EXPRESSION, options)).toBe('fx-rates');

        const run = jest.spyOn(FxRates, 'refreshFxRates');
        run.mockResolvedValueOnce({ enabled: true, stored: 2 });
        await expect(fire()).resolves.toEqual({ enabled: true, stored: 2 });
        run.mockRejectedValueOnce(new Error('boom'));
        await expect(fire()).resolves.toEqual({ error: 'boom' });   // resolves (never escapes), and says why for job_runs
        expect(console.error).toHaveBeenCalledWith('[FX] Exchange rates job failed:', 'boom');
    });

    test('a boot refreshes an empty store, recorded as fx-rates', async () => {
        const pool = fakePool();
        const fetchChart = jest.fn(async symbol => answer(symbol));
        const result = await FxRates.bootCatchUp({ pool, now: NOW, env: {}, fetchChart });
        expect(result).toMatchObject({ refreshed: true, reason: 'empty', summary: { stored: 6 } });
        expect(pool.calls.find(([text]) => text.startsWith('INSERT INTO job_runs'))[1]).toEqual(['fx-rates']);
    });

    test('a current store is left alone; one more than STALE_DAYS behind is refreshed', async () => {
        const fetchChart = jest.fn(async symbol => answer(symbol));
        // newest the 22nd, today the 25th: current
        expect(await FxRates.bootCatchUp({ pool: fakePool({ rates: RATES }), now: NOW, env: {}, fetchChart })).toEqual({ refreshed: false, reason: 'current' });
        expect(fetchChart).not.toHaveBeenCalled();
        // the same store a week later: behind
        await FxRates.load(fakePool());
        const later = new Date(NOW.getTime() + 7 * 86400 * 1000);
        expect(await FxRates.bootCatchUp({ pool: fakePool({ rates: RATES }), now: later, env: {}, fetchChart })).toMatchObject({ refreshed: true, reason: 'behind' });
        expect(fetchChart).toHaveBeenCalledTimes(2);
    });

    test('switched off: no read, no timer', async () => {
        const pool = fakePool();
        expect(await FxRates.bootCatchUp({ pool, now: NOW, env: { FX_RATES_REFRESH: 'false' } })).toEqual({ refreshed: false, reason: 'FX_RATES_REFRESH=false' });
        expect(pool.query).not.toHaveBeenCalled();
        expect(FxRates.scheduleBootCatchUp({ env: { FX_RATES_REFRESH: 'off' } })).toBeNull();
        const timer = FxRates.scheduleBootCatchUp({ env: {}, delayMs: 60 * 60 * 1000 });
        expect(timer).toBeTruthy();
        clearTimeout(timer);
    });
});
