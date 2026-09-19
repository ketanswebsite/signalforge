/**
 * The two readers that fetch Yahoo's chart API directly, outside the /yahoo/history proxy:
 * lib/portfolio/eod-summary.js fetchDayMove() and ml/conviction-engine.js scoreTechnical().
 *
 * Yahoo steps London lines between pence and pounds inside one series. Pinned down here:
 *   1. The EOD day move never reads a unit gap as a move - whether the gap sits between
 *      two bars, or between the WHOLE window and the live quote. The second is GVMH.L,
 *      where the repair alone finds nothing: its 5-day window holds no step at all.
 *   2. Genuine moves are reported exactly as before: a -60% day, a real -99% collapse.
 *   3. The conviction gate's technical pillar scores a flipped window like the clean one,
 *      but ONLY with PRICE_UNIT_REPAIR=true. Off, its inputs are the raw bars - repairing
 *      them changes which signals get traded, and that is the owner's call.
 *
 * The GVMH.L fixture is Yahoo's real response, fetched 2026-09-19.
 */

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../database-postgres', () => ({ pool: { query: jest.fn() } }));
// Under jsdom, jest resolves cheerio's "browser" build, which is ESM and will not parse.
// Only the news reader uses cheerio; neither function under test goes near it.
jest.mock('cheerio', () => ({ load: jest.fn() }));

const axios = require('axios');
const { scoreTechnical } = require('../../ml/conviction-engine');
const { fetchDayMove } = require('../../lib/portfolio/eod-summary');

const DAY = 86400;
const LAST_BAR = 1789714800; // 2026-09-18, the newest bar in the real fixture

/** A Yahoo chart.result[0]: one ordinary daily bar per close, ending at LAST_BAR */
function chartResult(closes, { quote = closes[closes.length - 1] } = {}) {
    const n = closes.length;
    const column = factor => closes.map(c => (c == null ? null : c * factor));
    return {
        meta: quote == null ? {} : { regularMarketPrice: quote, regularMarketTime: LAST_BAR + 8 * 3600 },
        timestamp: closes.map((_, i) => LAST_BAR - (n - 1 - i) * DAY),
        indicators: {
            quote: [{
                open: column(0.995),
                high: column(1.01),
                low: column(0.99),
                close: closes.slice(),
                volume: closes.map(c => (c == null ? null : 100000))
            }]
        }
    };
}

/** The same result with bars from..to reported in the major unit (every field / 100, no volume) */
function flipped(result, from, to) {
    const copy = JSON.parse(JSON.stringify(result));
    const q = copy.indicators.quote[0];
    for (let i = from; i <= to; i++) {
        for (const field of ['open', 'high', 'low', 'close']) q[field][i] = q[field][i] / 100;
        q.volume[i] = 0;
    }
    return copy;
}

// restoreMocks wipes jest.fn() implementations before every test, so each test serves its own
const serve = result => axios.get.mockResolvedValue({ data: { chart: { result: [result] } } });

const FLAG = 'PRICE_UNIT_REPAIR';
const flagAtStart = process.env[FLAG];
let logSpy;

beforeEach(() => {
    delete process.env[FLAG];
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
    if (flagAtStart === undefined) delete process.env[FLAG];
    else process.env[FLAG] = flagAtStart;
});

describe('fetchDayMove - the EOD summary\'s day move', () => {
    // Yahoo's real 5-day response for GVMH.L on 2026-09-19. Every bar is a zero-volume
    // forward-fill at 0.006 (pounds); the live quote - the last trade, 04-09 - is 0.6 (pence).
    const GVMH = {
        meta: { symbol: 'GVMH.L', currency: 'GBp', regularMarketPrice: 0.6, regularMarketTime: 1788508899, chartPreviousClose: 0.006 },
        timestamp: [1789369200, 1789455600, 1789542000, 1789628400, 1789714800],
        indicators: {
            quote: [{
                open: [0.006000000052154064, 0.006000000052154064, 0.006000000052154064, null, 0.006000000052154064],
                high: [0.006000000052154064, 0.006000000052154064, 0.006000000052154064, null, 0.006000000052154064],
                low: [0.006000000052154064, 0.006000000052154064, 0.006000000052154064, null, 0.006000000052154064],
                close: [0.006000000052154064, 0.006000000052154064, 0.006000000052154064, null, 0.006000000052154064],
                volume: [0, 0, 0, null, 0]
            }],
            adjclose: [{ adjclose: [0.006000000052154064, 0.006000000052154064, 0.006000000052154064, null, 0.006000000052154064] }]
        }
    };

    test('a forward-filled previous bar in pounds no longer reads as a ~9900% day', async () => {
        const result = flipped(chartResult([60, 60.5, 61, 61, 61.5]), 3, 3);
        expect(result.indicators.quote[0].close[3]).toBeCloseTo(0.61, 10);
        serve(result);

        const day = await fetchDayMove('FLIP.L');

        // Raw, this was 61.5 / 0.61 - 1 = +9982%
        expect(day.prevClose).toBeCloseTo(61, 6);
        expect(day.current).toBe(61.5);
        expect(day.dayMovePct).toBeCloseTo((61.5 / 61 - 1) * 100, 6);
    });

    test('real data - GVMH.L: the whole window is in pounds under a pence quote, with no step to find', async () => {
        serve(GVMH);

        const day = await fetchDayMove('GVMH.L');

        // Raw, this was 0.6 / 0.006 - 1 = +9900%. The line has not traded: the move is nil.
        expect(day.current).toBe(0.6);
        expect(day.prevClose).toBeCloseTo(0.6, 6);
        expect(day.dayMovePct).toBeCloseTo(0, 4);
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('GVMH.L price units: clean; steps=0; bars x100'));
    });

    test('the mirror image: a window in pence under a quote in pounds', async () => {
        serve(chartResult([60, 60.5, 61, 61.2, 61.5], { quote: 0.615 }));

        const day = await fetchDayMove('MIRROR.L');

        expect(day.current).toBe(0.615);
        expect(day.prevClose).toBeCloseTo(0.612, 6);
        expect(day.dayMovePct).toBeCloseTo((0.615 / 0.612 - 1) * 100, 6);
    });

    test('a genuine -60% day move is reported unchanged', async () => {
        serve(chartResult([100, 101, 99, 100, 40]));

        const day = await fetchDayMove('CRASH.L');

        expect(day).toEqual({ current: 40, prevClose: 100, dayMovePct: (40 / 100 - 1) * 100 });
        expect(logSpy).not.toHaveBeenCalled();
    });

    test('a genuine -99% collapse is still reported: it trades DOWN through the day', async () => {
        const result = chartResult([50, 50.2, 49.8, 50, 0.5]);
        // The collapse bar opens at the old level - one bar spanning both price levels
        result.indicators.quote[0].open[4] = 50;
        result.indicators.quote[0].high[4] = 50.5;
        serve(result);

        const day = await fetchDayMove('WIPED.L');

        expect(day.prevClose).toBe(50);
        expect(day.dayMovePct).toBeCloseTo(-99, 6);
    });

    test('an ordinary series comes out exactly as the raw formula gives it', async () => {
        serve(chartResult([100, 101, 102, 103, 104.03]));

        const day = await fetchDayMove('PLAIN.L');

        expect(day).toEqual({ current: 104.03, prevClose: 103, dayMovePct: (104.03 / 103 - 1) * 100 });
        expect(logSpy).not.toHaveBeenCalled();
    });

    test('with no live quote the last close stands in, and a flipped bar is still repaired', async () => {
        serve(flipped(chartResult([60, 60.5, 61, 61, 61.5], { quote: null }), 3, 3));

        const day = await fetchDayMove('NOQUOTE.L');

        expect(day.current).toBe(61.5);
        expect(day.prevClose).toBeCloseTo(61, 6);
    });

    test('it does not wait for PRICE_UNIT_REPAIR: a display cannot change what is traded', async () => {
        process.env[FLAG] = 'false';
        serve(GVMH);

        expect((await fetchDayMove('GVMH.L')).dayMovePct).toBeCloseTo(0, 4);
    });

    test('Yahoo\'s response is never mutated', async () => {
        const result = flipped(chartResult([60, 60.5, 61, 61, 61.5]), 3, 3);
        const before = JSON.stringify(result);
        serve(result);

        await fetchDayMove('FLIP.L');

        expect(JSON.stringify(result)).toBe(before);
    });
});

describe('scoreTechnical - the conviction gate\'s technical pillar', () => {
    /** 130 ordinary daily closes around 250p: a seeded walk, so every run sees the same bars */
    function walk(n = 130, start = 250) {
        const closes = [];
        let seed = 42;
        let price = start;
        for (let i = 0; i < n; i++) {
            seed = (seed * 1664525 + 1013904223) % 4294967296;
            price *= 1 + (seed / 4294967296 - 0.5) * 0.03; // within +/-1.5% a day
            closes.push(price);
        }
        return closes;
    }

    const clean = chartResult(walk());
    const n = clean.timestamp.length;
    // Pence -> pounds -> pence. The run covers the 21-day lookback bar and 16 of the 50
    // bars in the average; the 5-day lookback bar and the last bar sit outside it.
    const withFlip = flipped(clean, n - 30, n - 15);
    const closeOf = (result, i) => result.indicators.quote[0].close[i];
    const rawMom21 = (closeOf(withFlip, n - 1) / closeOf(withFlip, n - 22) - 1) * 100;

    test('the fixture really is corrupt: raw, the 21-day move reads as ~+9900%', () => {
        expect(rawMom21).toBeGreaterThan(5000);
    });

    test('flag on: a window with a flip-and-flip-back scores exactly like the window without it', async () => {
        process.env[FLAG] = 'true';
        serve(clean);
        const expected = await scoreTechnical('CLEAN-ON.L');
        serve(withFlip);
        const actual = await scoreTechnical('FLIP-ON.L');

        expect(actual).toEqual(expected);
        expect(actual.evidence[0]).not.toMatch(/\d{4}/);
        expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/^\[conviction\] FLIP-ON\.L price units: repaired; steps=2; bars=16; unit=live-quote; applied=true$/));
    });

    test.each([
        ['unset', undefined],
        ['"false"', 'false'],
        ['empty', ''],
        ['"1" - only the word true turns it on', '1']
    ])('flag %s: the inputs are the raw bars, flip and all', async (_label, value) => {
        if (value !== undefined) process.env[FLAG] = value;
        const before = JSON.stringify(withFlip);
        serve(withFlip);

        const actual = await scoreTechnical(`FLIP-OFF-${_label}.L`);

        // Only the untouched bars can produce this number
        expect(actual.evidence[0]).toBe(`21-day move +${rawMom21.toFixed(1)}%`);
        expect(JSON.stringify(withFlip)).toBe(before);

        serve(clean);
        expect(actual).not.toEqual(await scoreTechnical(`CLEAN-OFF-${_label}.L`));
    });

    test('flag off: the flip is still detected and reported - once per symbol, never applied', async () => {
        serve(withFlip);
        await scoreTechnical('DETECT.L');
        await scoreTechnical('DETECT.L');

        const lines = logSpy.mock.calls.map(call => call[0]).filter(line => line.includes('DETECT.L'));
        expect(lines).toEqual(['[conviction] DETECT.L price units: repaired; steps=2; bars=16; unit=live-quote; applied=false']);
    });

    test('a clean window scores the same whichever way the flag is set', async () => {
        serve(clean);
        const off = await scoreTechnical('CLEAN-A.L');
        process.env[FLAG] = 'true';
        const on = await scoreTechnical('CLEAN-B.L');

        expect(on).toEqual(off);
        expect(logSpy).not.toHaveBeenCalled();
    });

    test('flag on: a genuine -60% gap inside the window is scored as the fall it is', async () => {
        const closes = walk();
        for (let i = n - 10; i < n; i++) closes[i] *= 0.4;
        serve(chartResult(closes));
        const off = await scoreTechnical('CRASH-A.L');
        process.env[FLAG] = 'true';
        const on = await scoreTechnical('CRASH-B.L');

        expect(on).toEqual(off);
        expect(on.evidence[0]).toMatch(/^21-day move -(5|6)\d\.\d%$/);
        expect(logSpy).not.toHaveBeenCalled();
    });

    test('flag on: Yahoo\'s response is never mutated', async () => {
        process.env[FLAG] = 'true';
        const before = JSON.stringify(withFlip);
        serve(withFlip);

        await scoreTechnical('PURE.L');

        expect(JSON.stringify(withFlip)).toBe(before);
    });
});

describe('a repair that throws costs nothing', () => {
    test('both readers fall back to the raw bars and say so', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        process.env[FLAG] = 'true';
        let isolated;
        jest.isolateModules(() => {
            jest.doMock('../../lib/shared/price-unit-repair', () => ({
                ...jest.requireActual('../../lib/shared/price-unit-repair'),
                repairYahooChartResult: () => { throw new Error('boom'); }
            }));
            isolated = {
                axios: require('axios'),
                scoreTechnical: require('../../ml/conviction-engine').scoreTechnical,
                fetchDayMove: require('../../lib/portfolio/eod-summary').fetchDayMove
            };
        });
        jest.dontMock('../../lib/shared/price-unit-repair');

        const five = flipped(chartResult([60, 60.5, 61, 61, 61.5]), 3, 3);
        isolated.axios.get.mockResolvedValue({ data: { chart: { result: [five] } } });
        const day = await isolated.fetchDayMove('BOOM.L');
        expect(day.prevClose).toBeCloseTo(0.61, 10);
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Price-unit repair failed for BOOM.L, using raw bars: boom'));

        const six = chartResult(Array.from({ length: 60 }, (_, i) => 100 + i));
        isolated.axios.get.mockResolvedValue({ data: { chart: { result: [six] } } });
        const pillar = await isolated.scoreTechnical('BOOM.L');
        expect(pillar.evidence[0]).toBe(`21-day move +${((159 / 138 - 1) * 100).toFixed(1)}%`);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('BOOM.L price-unit repair failed, scoring the raw bars: boom'));
    });
});
