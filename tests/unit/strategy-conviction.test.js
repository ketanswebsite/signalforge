/**
 * GAPS #17: the AI conviction gate's own arithmetic (ml/conviction-engine.js), with Yahoo faked, the news feed
 * down and no Gemini key, so the engine scores rule-based. Every score is added up by hand beside its test:
 *
 *   technical (45%)    starts at 5. 21-day move: above +6% +2, above +2% +1, below -6% -2, below -2% -1.
 *                      5-day move: above +2% +1, below -2% -1. Price against its 50-day average: above +2% +1,
 *                      below -2% -1. The -5% stop in days of typical range (5 / the 20-day average of
 *                      (high - low) / close, in %): under 1.25 -1, over 2.5 +0.5.
 *   fundamental (30%)  starts at 5. Margin above 10% +1, below 0 -1.5. Revenue growth above 8% +1, below 0 -1.
 *                      Return on equity above 15% +1. Debt/equity under 80% +0.5, over 200% -1. Forward P/E under
 *                      trailing +0.5; trailing P/E over 60 -0.5.
 *   information (25%)  5 here: the feed is down (its tone comes from a sentiment word list, not from our sums).
 *
 * Each pillar is kept between 1 and 10 at one decimal. Confidence = 0.45 T + 0.30 F + 0.25 I, rounded to one
 * decimal. Above 6 is GO, 5 to 6 is WATCH, under 5 is PASS. The backtest win rate is context only.
 */
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../database-postgres', () => ({ pool: { query: jest.fn() } }));
// Under jsdom, jest resolves cheerio's "browser" build, which is ESM and will not parse. Only the news reader uses
// it, and the news feed is down in every test here.
jest.mock('cheerio', () => ({ load: jest.fn() }));

const axios = require('axios');
const db = require('../../database-postgres');
const { getConviction, scoreTechnical } = require('../../ml/conviction-engine');

const DAY = 86400;

/** Yahoo's chart answer: one bar per close, each bar's high and low `spread` either side of its close */
function chart(closes, spread) {
    return {
        chart: {
            result: [{
                meta: { regularMarketPrice: closes[closes.length - 1] },
                timestamp: closes.map((_, i) => 1780000000 + i * DAY),
                indicators: {
                    quote: [{
                        open: closes.slice(),
                        high: closes.map(c => c * (1 + spread)),
                        low: closes.map(c => c * (1 - spread)),
                        close: closes.slice(),
                        volume: closes.map(() => 100000)
                    }]
                }
            }]
        }
    };
}
/** 60 daily closes: 100 until bar `from`, then `level` */
const stepTo = (from, level) => Array.from({ length: 60 }, (_, i) => (i < from ? 100 : level));

// Strong: 100 then 110 from bar 55. 21-day move +10% (+2), 5-day move +10% (+1), 50-day average
// (45 x 100 + 5 x 110) / 50 = 101 so +8.9% (+1), a 1% daily range puts the stop 5 days away (+0.5): 9.5
const STRONG = chart(stepTo(55, 110), 0.005);
// Weak: 100 then 90 from bar 55. -10% (-2), -10% (-1), average 99 so -9.1% (-1), a 6% range puts the stop
// 0.83 days away (-1): 5 - 5 = 0, kept at 1
const WEAK = chart(stepTo(55, 90), 0.03);
// Middling: 100 then 103 from bar 39. 21-day move +3% (+1), 5-day move 0, average (29 x 100 + 21 x 103) / 50
// = 101.26 so +1.7% (0), 1% range (+0.5): 6.5
const MIDDLING = chart(stepTo(39, 103), 0.005);
// Flat at 100 with a 1% range: only the stop fit counts (+0.5): 5.5
const FLAT = chart(stepTo(60, 100), 0.005);

// Yahoo quoteSummary modules for the fundamental pillar
const summary = (fin, det = {}) => {
    const raw = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { raw: v }]));
    return { financialData: raw(fin), summaryDetail: raw(det) };
};
// 5 + 1 (margin 20%) + 1 (growth 10%) + 1 (ROE 20%) + 0.5 (debt/equity 50%) + 0.5 (forward 15 < trailing 20) = 9
const HEALTHY = summary({ profitMargins: 0.2, revenueGrowth: 0.1, returnOnEquity: 0.2, debtToEquity: 50 }, { trailingPE: 20, forwardPE: 15 });
// 5 - 1.5 (margin -5%) - 1 (growth -10%) - 1 (debt/equity 250%) - 0.5 (trailing P/E 80); forward 90 is higher: 1
const AILING = summary({ profitMargins: -0.05, revenueGrowth: -0.1, returnOnEquity: 0.05, debtToEquity: 250 }, { trailingPE: 80, forwardPE: 90 });
// 5 + 1 (margin 20%); growth 5%, ROE 10%, debt/equity 100% and a lone trailing P/E of 20 score nothing: 6
const DECENT = summary({ profitMargins: 0.2, revenueGrowth: 0.05, returnOnEquity: 0.1, debtToEquity: 100 }, { trailingPE: 20 });
// 5 - 1 (growth -2%); margin 5%, ROE 10%, debt/equity 100%, trailing P/E 20 score nothing: 4
const SLIPPING = summary({ profitMargins: 0.05, revenueGrowth: -0.02, returnOnEquity: 0.1, debtToEquity: 100 }, { trailingPE: 20 });

/** Answers the engine's requests: the chart, Yahoo's cookie and crumb, quoteSummary; the news feed is down */
function serve(chartAnswer, fundamentals) {
    axios.get.mockImplementation(async url => {
        if (url.startsWith('https://query1.finance.yahoo.com/v8/finance/chart/')) return { data: chartAnswer };
        if (url === 'https://fc.yahoo.com') return { headers: { 'set-cookie': ['A3=test; Path=/'] }, data: '' };
        if (url === 'https://query1.finance.yahoo.com/v1/test/getcrumb') return { data: 'test-crumb' };
        if (url.includes('/v10/finance/quoteSummary/')) return { data: { quoteSummary: { result: [fundamentals] } } };
        throw new Error(`offline: ${url}`);
    });
}

const envAtStart = { GEMINI_API_KEY: process.env.GEMINI_API_KEY, PRICE_UNIT_REPAIR: process.env.PRICE_UNIT_REPAIR };
beforeAll(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.PRICE_UNIT_REPAIR;
});
afterAll(() => {
    for (const [key, value] of Object.entries(envAtStart)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
});
beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    // No stored verdict for any symbol; writes succeed
    db.pool.query.mockResolvedValue({ rows: [], rowCount: 1 });
});

describe('the technical pillar', () => {
    test('strong chart: 5 + 2 + 1 + 1 + 0.5 = 9.5, with its evidence', async () => {
        serve(STRONG, HEALTHY);
        expect(await scoreTechnical('STRONG.L')).toEqual({
            score: 9.5,
            evidence: [
                '21-day move +10.0%',
                '5-day move +10.0%',
                'Price +8.9% vs its 50-day average',
                'Typical daily range 1.0% — the −5% stop is ~5.0 days of range'
            ]
        });
    });

    test('weak chart: 5 - 2 - 1 - 1 - 1 = 0, kept at the floor of 1', async () => {
        serve(WEAK, HEALTHY);
        expect((await scoreTechnical('WEAK.L')).score).toBe(1);
    });

    test('middling chart 6.5, flat chart 5.5', async () => {
        serve(MIDDLING, HEALTHY);
        expect((await scoreTechnical('MIDDLING.L')).score).toBe(6.5);
        serve(FLAT, HEALTHY);
        expect((await scoreTechnical('FLAT.L')).score).toBe(5.5);
    });

    test('fewer than 55 bars is not enough history', async () => {
        serve(chart(stepTo(54, 100).slice(0, 54), 0.005), HEALTHY);
        await expect(scoreTechnical('SHORT.L')).rejects.toThrow('Not enough price history');
    });
});

describe('the blend and the verdict', () => {
    const score = async (symbol, chartAnswer, fundamentals, winRate = 80) => {
        serve(chartAnswer, fundamentals);
        return getConviction({ symbol, name: symbol, winRate });
    };

    test('GO: 0.45 x 9.5 + 0.30 x 9 + 0.25 x 5 = 4.275 + 2.7 + 1.25 = 8.225 -> 8.2', async () => {
        const result = await score('GOCASE.L', STRONG, HEALTHY);
        expect(result).toMatchObject({ confidence: 8.2, verdict: 'GO', engine: 'rule-based' });
        expect(result.pillars).toMatchObject({
            technical: { score: 9.5, weight: 45 },
            fundamental: { score: 9, weight: 30 },
            information: { score: 5, weight: 25 }
        });
    });

    test('exactly 6.0 is WATCH, not GO: 0.45 x 6.5 + 0.30 x 6 + 1.25 = 2.925 + 1.8 + 1.25 = 5.975 -> 6.0', async () => {
        expect(await score('EDGEHIGH.L', MIDDLING, DECENT)).toMatchObject({ confidence: 6, verdict: 'WATCH' });
    });

    test('4.9 is PASS: 0.45 x 5.5 + 0.30 x 4 + 1.25 = 2.475 + 1.2 + 1.25 = 4.925 -> 4.9', async () => {
        expect(await score('EDGELOW.L', FLAT, SLIPPING)).toMatchObject({ confidence: 4.9, verdict: 'PASS' });
    });

    test('PASS: 0.45 x 1 + 0.30 x 1 + 1.25 = 2.0', async () => {
        const result = await score('PASSCASE.L', WEAK, AILING);
        expect(result).toMatchObject({ confidence: 2, verdict: 'PASS' });
        expect(result.pillars.fundamental.score).toBe(1);
    });

    test('the backtest win rate is context only: 99% and 10% get the same confidence', async () => {
        const high = await score('CTXHIGH.L', MIDDLING, HEALTHY, 99);
        const low = await score('CTXLOW.L', MIDDLING, HEALTHY, 10);
        // 0.45 x 6.5 + 0.30 x 9 + 1.25 = 2.925 + 2.7 + 1.25 = 6.875 -> 6.9
        expect([high.confidence, low.confidence]).toEqual([6.9, 6.9]);
        expect([high.context.winRate, low.context.winRate]).toEqual([99, 10]);
    });
});
