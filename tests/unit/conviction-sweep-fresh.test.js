/**
 * The monthly AI sweep must RE-SCORE, not be handed last month's verdict back.
 *
 * ml/conviction-sweep.js scores through ml/conviction-engine.js getConviction(), and
 * getConviction() serves any stored conviction_daily verdict up to 36 days old without
 * computing. First Saturdays are 28 or 35 days apart, so on sweep day every verdict from
 * the previous sweep is still inside that window. Seen on production: after the
 * 2026-09-05 sweep ran its whole queue, 257 symbols still held a verdict from 08-15..08-22
 * - handed back, and counted as "scored".
 *
 * Pinned down here:
 *   1. The month-long reuse itself stays: an ordinary caller is still served a stored
 *      verdict 36 days old, and still scores at 37.
 *   2. `fresh: true` (the sweep only) gets past BOTH cache layers, keeps the in-flight
 *      dedup, and REPLACES a row already written today - ordinary scoring still keeps
 *      the day's first verdict.
 *   3. A fresh re-score that finds every source down leaves the stored verdict in charge.
 *   4. The sweep re-scores 28- and 35-day-old verdicts, still skips what the current (or
 *      a crashed) run already scored, and counts honestly: scored / reused / blind.
 *   5. CONVICTION_SWEEP_FRESH=false is the old behaviour exactly - and now says so.
 */

process.env.CONVICTION_SWEEP_DELAY_MS = '1';   // read once, when the sweep module loads

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../database-postgres', () => ({ pool: { query: jest.fn() } }));
// Under jsdom, jest resolves cheerio's "browser" build, which is ESM and will not parse
jest.mock('cheerio', () => ({ load: jest.fn() }));
jest.mock('../../lib/shared/stock-data', () => ({ getAllStocks: jest.fn() }));

const axios = require('axios');
const db = require('../../database-postgres');
const StockData = require('../../lib/shared/stock-data');
const { getConviction } = require('../../ml/conviction-engine');
const { runConvictionSweep } = require('../../ml/conviction-sweep');

const DAY_MS = 24 * 60 * 60 * 1000;
const day = ageDays => new Date(Date.now() - ageDays * DAY_MS).toISOString().split('T')[0];
const TODAY = () => day(0);

const ENV = ['CONVICTION_MAX_AGE_DAYS', 'CONVICTION_SWEEP_RESUME_DAYS', 'CONVICTION_SWEEP_FRESH',
    'CONVICTION_CACHE_TTL_MIN', 'GEMINI_API_KEY', 'PRICE_UNIT_REPAIR'];
const envAtStart = Object.fromEntries(ENV.map(k => [k, process.env[k]]));

/** A verdict as the engine stored it `ageDays` ago */
function storedVerdict(symbol, ageDays) {
    return {
        success: true, symbol, name: symbol, confidence: 7.1, verdict: 'GO', engine: 'rule-based', summary: null,
        pillars: {
            technical: { score: 9, evidence: ['stored'], weight: 45 },
            fundamental: { score: 5, evidence: ['stored'], weight: 30 },
            information: { score: 6, evidence: ['stored'], weight: 25 }
        },
        context: { winRate: null },
        generatedAt: new Date(Date.now() - ageDays * DAY_MS).toISOString()
    };
}

/**
 * conviction_daily, in memory. Answers the three statements the two modules send and
 * honours the primary key the way Postgres does: DO NOTHING keeps the row, DO UPDATE
 * replaces it. `hidden` rows exist but are invisible to reads - the race in which
 * another process writes today's row between this one's read and its insert.
 */
function verdictTable(seed = [], { hidden = [] } = {}) {
    const rows = new Map();
    const key = (symbol, date) => `${symbol}|${date}`;
    for (const [symbol, ageDays] of seed) rows.set(key(symbol, day(ageDays)), storedVerdict(symbol, ageDays));
    const visible = () => [...rows.keys()].filter(k => !hidden.includes(k.split('|')[0]));

    db.pool.query.mockImplementation(async (sql, params) => {
        if (/^\s*SELECT payload/.test(sql)) {
            const [symbol, cutoff] = params;
            const newest = visible().filter(k => k.startsWith(`${symbol}|`) && k.split('|')[1] >= cutoff).sort().pop();
            return { rows: newest ? [{ payload: rows.get(newest) }] : [] };
        }
        if (/^\s*INSERT INTO conviction_daily/.test(sql)) {
            const [symbol, date, , , , json] = params;
            if (!rows.has(key(symbol, date)) || /DO UPDATE/.test(sql)) rows.set(key(symbol, date), JSON.parse(json));
            return { rowCount: 1 };
        }
        if (/SELECT DISTINCT symbol/.test(sql)) {
            const [cutoff] = params;
            const symbols = new Set(visible().filter(k => k.split('|')[1] >= cutoff).map(k => k.split('|')[0]));
            return { rows: [...symbols].map(symbol => ({ symbol })) };
        }
        throw new Error(`verdictTable: unexpected statement: ${sql}`);
    });

    return { today: symbol => rows.get(key(symbol, TODAY())), at: (symbol, ageDays) => rows.get(key(symbol, day(ageDays))) };
}

/** 60 rising daily bars: the technical pillar scores well above neutral, so the verdict is storable */
function risingChart() {
    const closes = Array.from({ length: 60 }, (_, i) => 100 * Math.pow(1.004, i));
    return {
        meta: {},
        timestamp: closes.map((_, i) => 1789714800 - (59 - i) * 86400),
        indicators: { quote: [{
            open: closes.map(c => c * 0.995), high: closes.map(c => c * 1.01), low: closes.map(c => c * 0.99),
            close: closes, volume: closes.map(() => 100000)
        }] }
    };
}

// restoreMocks wipes jest.fn() implementations before every test, so each test installs its own.
// Price history answers; fundamentals and news are refused, and score neutral on their own.
function sourcesUp() {
    axios.get.mockImplementation(async url => {
        if (String(url).includes('/v8/finance/chart/')) return { data: { chart: { result: [risingChart()] } } };
        throw new Error('refused by test');
    });
}
function sourcesDown() {
    axios.get.mockRejectedValue(new Error('refused by test'));
}
const priceHistoryRequests = () => axios.get.mock.calls.filter(([url]) => String(url).includes('/v8/finance/chart/')).length;

beforeEach(() => {
    for (const k of ENV) delete process.env[k];
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
    for (const k of ENV) {
        if (envAtStart[k] === undefined) delete process.env[k];
        else process.env[k] = envAtStart[k];
    }
});

// The engine keeps a per-symbol memory cache for the life of the module, so every test
// uses symbols of its own.

describe('getConviction - the month-long reuse stays', () => {
    test('an ordinary caller is served a stored verdict 36 days old, without scoring', async () => {
        verdictTable([['REUSE36.L', 36]]);
        sourcesUp();

        const verdict = await getConviction({ symbol: 'REUSE36.L', name: 'x', winRate: 81 });

        expect(verdict.pillars.technical.evidence).toEqual(['stored']);
        expect(verdict.context.winRate).toBe(81);
        expect(axios.get).not.toHaveBeenCalled();
    });

    test('and scores again once it is 37 days old', async () => {
        const table = verdictTable([['EXPIRED37.L', 37]]);
        sourcesUp();

        await getConviction({ symbol: 'EXPIRED37.L', name: 'x' });

        expect(priceHistoryRequests()).toBe(1);
        expect(table.today('EXPIRED37.L')).toBeDefined();
    });
});

describe('getConviction({ fresh: true }) - the sweep\'s re-score', () => {
    test.each([28, 35])('scores again although a %i-day-old verdict is stored', async (ageDays) => {
        const symbol = `FRESH${ageDays}.L`;
        const table = verdictTable([[symbol, ageDays]]);
        sourcesUp();
        const askedAt = Date.now();

        const verdict = await getConviction({ symbol, name: 'x', fresh: true });

        expect(priceHistoryRequests()).toBe(1);
        expect(Date.parse(verdict.generatedAt)).toBeGreaterThanOrEqual(askedAt);
        expect(table.today(symbol).generatedAt).toBe(verdict.generatedAt);
        expect(table.at(symbol, ageDays).pillars.technical.evidence).toEqual(['stored']);   // history is kept
    });

    test('gets past the in-memory cache too, and leaves the new verdict in it', async () => {
        verdictTable([['MEMORY.L', 28]]);
        sourcesUp();

        const before = await getConviction({ symbol: 'MEMORY.L', name: 'x' });        // now cached in memory
        const fresh = await getConviction({ symbol: 'MEMORY.L', name: 'x', fresh: true });
        const after = await getConviction({ symbol: 'MEMORY.L', name: 'x' });

        expect(before.pillars.technical.evidence).toEqual(['stored']);
        expect(fresh.generatedAt).not.toBe(before.generatedAt);
        expect(after.generatedAt).toBe(fresh.generatedAt);
        expect(priceHistoryRequests()).toBe(1);
    });

    test('replaces a row already written today', async () => {
        const table = verdictTable([['SAMEDAY.L', 0]]);
        sourcesUp();

        const verdict = await getConviction({ symbol: 'SAMEDAY.L', name: 'x', fresh: true });

        expect(table.today('SAMEDAY.L').generatedAt).toBe(verdict.generatedAt);
        expect(table.today('SAMEDAY.L').pillars.technical.evidence).not.toEqual(['stored']);
    });

    test('ordinary scoring still keeps the first verdict of the day', async () => {
        // Another process wrote today's row between this one's read and its insert
        const table = verdictTable([['RACE.L', 0]], { hidden: ['RACE.L'] });
        sourcesUp();

        await getConviction({ symbol: 'RACE.L', name: 'x' });

        expect(priceHistoryRequests()).toBe(1);
        expect(table.today('RACE.L').pillars.technical.evidence).toEqual(['stored']);
    });

    test('keeps the in-flight dedup: two concurrent re-scores score once', async () => {
        verdictTable([['TWICE.L', 28]]);
        sourcesUp();

        const [a, b] = await Promise.all([
            getConviction({ symbol: 'TWICE.L', name: 'x', fresh: true }),
            getConviction({ symbol: 'TWICE.L', name: 'x', fresh: true })
        ]);

        expect(priceHistoryRequests()).toBe(1);
        expect(a.generatedAt).toBe(b.generatedAt);
    });

    test('every source down: the stored verdict stays in charge, in the table and in memory', async () => {
        const table = verdictTable([['BLIND.L', 28]]);
        sourcesDown();

        const blind = await getConviction({ symbol: 'BLIND.L', name: 'x', fresh: true });
        const served = await getConviction({ symbol: 'BLIND.L', name: 'x' });

        expect(blind.pillars.technical.score).toBe(5);
        expect(blind.verdict).toBe('WATCH');
        expect(table.today('BLIND.L')).toBeUndefined();
        expect(served.verdict).toBe('GO');                       // not the blind WATCH
        expect(served.pillars.technical.evidence).toEqual(['stored']);
    });
});

describe('runConvictionSweep', () => {
    const universe = (...symbols) => StockData.getAllStocks.mockReturnValue(symbols.map(symbol => ({ symbol, name: symbol })));

    test('re-scores verdicts from the previous sweep, 28 or 35 days old', async () => {
        const table = verdictTable([['SWEEP28.L', 28], ['SWEEP35.L', 35]]);
        universe('SWEEP28.L', 'SWEEP35.L');
        sourcesUp();

        const result = await runConvictionSweep();

        expect(result).toMatchObject({ total: 2, scored: 2, reused: 0, blind: 0, skipped: 0, failed: 0 });
        expect(priceHistoryRequests()).toBe(2);
        expect(table.today('SWEEP28.L')).toBeDefined();
        expect(table.today('SWEEP35.L')).toBeDefined();
    });

    test('still skips what this run - or a crashed one, days ago - already scored', async () => {
        const table = verdictTable([['DONE0.L', 0], ['DONE13.L', 13], ['DUE14.L', 14]]);
        universe('DONE0.L', 'DONE13.L', 'DUE14.L');
        sourcesUp();

        const result = await runConvictionSweep();

        expect(result).toMatchObject({ total: 3, scored: 1, skipped: 2, reused: 0 });
        expect(priceHistoryRequests()).toBe(1);
        expect(table.today('DONE0.L').pillars.technical.evidence).toEqual(['stored']);   // not re-scored
        expect(table.today('DUE14.L')).toBeDefined();
    });

    test('a symbol with no verdict at all is scored, as before', async () => {
        const table = verdictTable();
        universe('NEVER.L');
        sourcesUp();

        const result = await runConvictionSweep();

        expect(result).toMatchObject({ scored: 1, reused: 0, blind: 0 });
        expect(table.today('NEVER.L')).toBeDefined();
    });

    test('does not count a blind result as scored, and keeps the stored verdict', async () => {
        const table = verdictTable([['DOWN28.L', 28]]);
        universe('DOWN28.L');
        sourcesDown();

        const result = await runConvictionSweep();

        expect(result).toMatchObject({ scored: 0, blind: 1, reused: 0, failed: 0 });
        expect(table.today('DOWN28.L')).toBeUndefined();
        expect(table.at('DOWN28.L', 28)).toBeDefined();
    });

    test('CONVICTION_SWEEP_FRESH=false is the old behaviour - and the sweep now says so', async () => {
        process.env.CONVICTION_SWEEP_FRESH = 'false';
        const table = verdictTable([['OLD28.L', 28], ['OLD35.L', 35]]);
        universe('OLD28.L', 'OLD35.L');
        sourcesUp();

        const result = await runConvictionSweep();

        expect(result).toMatchObject({ total: 2, scored: 0, reused: 2 });
        expect(axios.get).not.toHaveBeenCalled();
        expect(table.today('OLD28.L')).toBeUndefined();
        expect(console.log.mock.calls.flat().join('\n')).toMatch(/2 reused/);
    });
});
