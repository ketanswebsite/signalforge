/**
 * GAPS #17: the DTI maths, pinned with numbers worked out by hand.
 *
 * lib/shared/dti-calculator.js is the one DTI the 7 AM scan reads (lib/scanner/scanner.js fetchStockData) and
 * the Simulator page loads for its backtest engine (portfolio-backtest.html). The Positions page draws its DTI
 * with its own copy, public/js/dti-indicators.js; the last block holds that copy to the same numbers.
 *
 * DTI (William Blau): up-move = how far the high rose (else 0), down-move = how far the low fell (else 0),
 * momentum = up-move - down-move, DTI = 100 x EMA_u(EMA_s(EMA_r(momentum))) / the same EMAs of |momentum|, and
 * 0 where that denominator is 0. Each EMA starts at its first input and weighs each new value k = 2 / (period + 1).
 * The scan runs r = 14, s = 10, u = 5. The 7-day DTI is the same sum over blocks of 7 bars.
 *
 * Every expected number is worked out in the comment beside it, or by the closed-form reference below (each EMA
 * value written out as a weighted sum of all the inputs before it), never by calling the code under test.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const DTI = require('../../lib/shared/dti-calculator');

/** EMA value n written out: (1 - k)^n x0 + sum over j = 1..n of k (1 - k)^(n - j) xj */
function emaAt(x, period, n) {
    const k = 2 / (period + 1);
    let sum = Math.pow(1 - k, n) * x[0];
    for (let j = 1; j <= n; j++) sum += k * Math.pow(1 - k, n - j) * x[j];
    return sum;
}
const emaSeries = (x, period) => x.map((_, n) => emaAt(x, period, n));

/** Blau's DTI from its definition, through the written-out EMAs */
function referenceDTI(high, low, r, s, u) {
    const momentum = high.map((h, i) => (i === 0 ? 0 :
        Math.max(0, h - high[i - 1]) - Math.max(0, low[i - 1] - low[i])));
    const smooth = x => emaSeries(emaSeries(emaSeries(x, r), s), u);
    const top = smooth(momentum);
    const bottom = smooth(momentum.map(Math.abs));
    return top.map((v, i) => (bottom[i] === 0 ? 0 : (100 * v) / bottom[i]));
}

// 80 bars of an ordinary-looking chart: a swing up and down on a slow drift, ranges that vary by the day
const HIGH = [];
const LOW = [];
for (let i = 0; i < 80; i++) {
    const mid = 100 + 8 * Math.sin(i / 6) + i / 10;
    HIGH.push(Math.round((mid + 1 + (i % 3) * 0.25) * 100) / 100);
    LOW.push(Math.round((mid - 1 - (i % 4) * 0.2) * 100) / 100);
}

// 16 trading days across three calendar weeks. The 7-bar blocks are bars 0-6, 7-13 and 14-15:
//   block 0 (1-9 Sep):   highs 5 7 6 8 4 3 2       -> high 8    lows 4 6 5 7 3 2 1          -> low 1
//   block 1 (10-18 Sep): highs 9 1 1 1 1 1 12      -> high 12   lows 8 .5 .7 .9 .6 .8 11    -> low 0.5
//   block 2 (21-22 Sep): highs 2 3                 -> high 3    lows 1 2.5                  -> low 1
const DATES16 = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-07', '2026-09-08', '2026-09-09',
    '2026-09-10', '2026-09-11', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18',
    '2026-09-21', '2026-09-22'];
const HIGH16 = [5, 7, 6, 8, 4, 3, 2, 9, 1, 1, 1, 1, 1, 12, 2, 3];
const LOW16 = [4, 6, 5, 7, 3, 2, 1, 8, 0.5, 0.7, 0.9, 0.6, 0.8, 11, 1, 2.5];
// With every period 1 the EMAs change nothing, so each block's 7-day DTI is 100 x the sign of its momentum:
//   block 1: the high rose 12 - 8 = 4, the low fell 1 - 0.5 = 0.5 -> momentum 3.5  -> 100
//   block 2: the high fell (3 < 12), the low rose (1 > 0.5)       -> momentum 0    -> 0
const SEVEN_DAY_DTI16 = [0, 100, 0];
const DAILY_7DAY_DTI16 = [0, 0, 0, 0, 0, 0, 0, 100, 100, 100, 100, 100, 100, 100, 0, 0];

beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('EMA: starts at the first value, then weighs each new value 2 / (period + 1)', () => {
    test('period 3 (k = 0.5) on 4, 8, 0, 6', () => {
        // 4; 0.5 x 8 + 0.5 x 4 = 6; 0.5 x 0 + 0.5 x 6 = 3; 0.5 x 6 + 0.5 x 3 = 4.5
        expect(DTI.EMA([4, 8, 0, 6], 3)).toEqual([4, 6, 3, 4.5]);
    });

    test('period 1 (k = 1) is the input itself', () => {
        expect(DTI.EMA([3, -1, 7], 1)).toEqual([3, -1, 7]);
    });

    test('no data, or a period of 0, gives nothing', () => {
        expect(DTI.EMA([], 3)).toEqual([]);
        expect(DTI.EMA([1, 2], 0)).toEqual([]);
    });
});

describe('calculateDTI', () => {
    // highs 10 12 11 13 13, lows 9 10 8 9 9
    //   up-move   0 2 0 2 0    (the high rises 2, falls, rises 2, holds)
    //   down-move 0 0 2 0 0    (only the third low falls, by 2)
    //   momentum  0 2 -2 2 0
    const HIGH5 = [10, 12, 11, 13, 13];
    const LOW5 = [9, 10, 8, 9, 9];

    test('with every period 1 the EMAs change nothing: 100 x the sign of the momentum, 0 on a flat day', () => {
        expect(DTI.calculateDTI(HIGH5, LOW5, 1, 1, 1)).toEqual([0, 100, -100, 100, 0]);
    });

    test('with every period 3 (k = 0.5): four bars worked by hand', () => {
        // momentum    0  2     -2     2        |momentum|  0  2     2      2
        // 1st EMA     0  1     -0.5   0.75                 0  1     1.5    1.75
        // 2nd EMA     0  0.5    0     0.375                0  0.5   1      1.375
        // 3rd EMA     0  0.25   0.125 0.25                 0  0.25  0.625  1
        // DTI         0 (0 / 0), 100, 100 x 0.125 / 0.625 = 20, 100 x 0.25 / 1 = 25
        const dti = DTI.calculateDTI(HIGH5.slice(0, 4), LOW5.slice(0, 4), 3, 3, 3);
        expect(dti).toHaveLength(4);
        [0, 100, 20, 25].forEach((expected, i) => expect(dti[i]).toBeCloseTo(expected, 12));
    });

    test('with the scan\'s periods (14, 10, 5) it matches the written-out definition bar for bar', () => {
        const dti = DTI.calculateDTI(HIGH, LOW, 14, 10, 5);
        const reference = referenceDTI(HIGH, LOW, 14, 10, 5);
        expect(dti).toHaveLength(80);
        reference.forEach((expected, i) => expect(dti[i]).toBeCloseTo(expected, 8));
        // A smoothed momentum can never outweigh the smoothed size of that momentum: -100..100, to rounding
        expect(Math.max(...dti.map(Math.abs))).toBeLessThanOrEqual(100 + 1e-9);
    });

    test('mismatched highs and lows, or a period of 0, give nothing', () => {
        expect(DTI.calculateDTI([1, 2, 3], [1, 2], 14, 10, 5)).toEqual([]);
        expect(DTI.calculateDTI([], [], 14, 10, 5)).toEqual([]);
        expect(DTI.calculateDTI(HIGH5, LOW5, 0, 10, 5)).toEqual([]);
    });
});

describe('the 7-day DTI: blocks of 7 bars counted from the first bar of the series (GAPS #8)', () => {
    test('the blocks are 7 BARS, not calendar weeks: highest high, lowest low, first and last date', () => {
        expect(DTI.aggregateTo7Day(DATES16, HIGH16, LOW16)).toEqual([
            { startDate: '2026-09-01', endDate: '2026-09-09', startIndex: 0, endIndex: 6, high: 8, low: 1 },
            { startDate: '2026-09-10', endDate: '2026-09-18', startIndex: 7, endIndex: 13, high: 12, low: 0.5 },
            { startDate: '2026-09-21', endDate: '2026-09-22', startIndex: 14, endIndex: 15, high: 3, low: 1 }
        ]);
    });

    test('the DTI runs over the blocks, and every day carries its whole block\'s value', () => {
        const seven = DTI.calculate7DayDTI(DATES16, HIGH16, LOW16, 1, 1, 1);
        expect(seven.sevenDayDTI).toEqual(SEVEN_DAY_DTI16);
        expect(seven.daily7DayDTI).toEqual(DAILY_7DAY_DTI16);
        expect(seven.periods.map(p => [p.startDate, p.endDate, p.high, p.low, p.dti])).toEqual([
            ['2026-09-01', '2026-09-09', 8, 1, 0],
            ['2026-09-10', '2026-09-18', 12, 0.5, 100],
            ['2026-09-21', '2026-09-22', 3, 1, 0]
        ]);
        // So 10 Sep, the block's first day, already reads 100 because of the 12 high printed on 18 Sep:
        // a backtest judging 10 Sep sees the rest of that block.
        expect(seven.daily7DayDTI[DATES16.indexOf('2026-09-10')]).toBe(100);
    });

    test('a series that starts one bar later cuts different blocks, so the same day reads a different value', () => {
        // From 2 Sep the blocks are 2-10 Sep (high 9, low 1), 11-21 Sep (high 12, low 0.5) and 22 Sep (3, 2.5):
        // block 1's momentum is 3 - 0.5 = 2.5 -> 100, block 2's is 0 -> 0; 10 Sep now sits in block 0 and reads 0
        const later = DTI.calculate7DayDTI(DATES16.slice(1), HIGH16.slice(1), LOW16.slice(1), 1, 1, 1);
        expect(later.sevenDayDTI).toEqual([0, 100, 0]);
        expect(later.daily7DayDTI[DATES16.slice(1).indexOf('2026-09-10')]).toBe(0);
    });
});

describe('the Positions page\'s copy (public/js/dti-indicators.js) computes the same numbers', () => {
    const context = { window: {}, console: { log() {}, error() {}, warn() {} } };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../../public/js/dti-indicators.js'), 'utf8'), context);
    const PageDTI = context.window.DTIIndicators;

    test('its daily DTI matches the written-out definition', () => {
        const dti = PageDTI.calculateDTI(HIGH, LOW, 14, 10, 5);
        referenceDTI(HIGH, LOW, 14, 10, 5).forEach((expected, i) => expect(dti[i]).toBeCloseTo(expected, 8));
    });

    test('its 7-day DTI cuts the same blocks and maps them to the same days', () => {
        const seven = PageDTI.calculate7DayDTI(DATES16, HIGH16, LOW16, 1, 1, 1);
        expect(Array.from(seven.sevenDayDTI)).toEqual(SEVEN_DAY_DTI16);
        expect(Array.from(seven.daily7DayDTI)).toEqual(DAILY_7DAY_DTI16);
    });
});
