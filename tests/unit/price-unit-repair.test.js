/**
 * Price-unit repair (lib/shared/price-unit-repair.js)
 *
 * Yahoo's daily history for London lines steps between pence and pounds inside one
 * series. The backtest engines read each step as a -99% or +9900% day. Four things
 * are pinned down here:
 *   1. Unit flips are made continuous - a flip that persists (either direction), a
 *      flip that flips back, a series that oscillates - and the rescale is by exactly
 *      100, so a real move sitting on a flip bar survives underneath it.
 *   2. Genuine moves are left alone: a -60% gap, a -97% day, an intraday wipe-out,
 *      and a lone -99% gap that looks like a collapse rather than a relabelling.
 *   3. Missing bars (null / NaN / 0) pass straight through. Nothing is ever dropped,
 *      reordered or mutated, and volume is never rescaled.
 *   4. The unit that is kept is the live quote's, because that is the unit fills and
 *      exits are booked in - including when the quote is older than the last bar.
 *
 * The real-data fixtures are cut from Yahoo responses fetched 2026-09-19.
 */

const {
    repairPriceUnits,
    repairYahooChartResult,
    alignToQuoteUnit,
    isRepairEnabled,
    isLoneDownStepAUnitChange
} = require('../../lib/shared/price-unit-repair');

/** Ordinary daily bars around each close: a 2% range and steady volume */
function bars(closes, volume = 100000) {
    return {
        open: closes.map(c => (c > 0 ? c * 0.995 : c)),
        high: closes.map(c => (c > 0 ? c * 1.01 : c)),
        low: closes.map(c => (c > 0 ? c * 0.99 : c)),
        close: closes.slice(),
        adjclose: closes.map(c => (c > 0 ? c * 0.98 : c)),
        volume: closes.map(() => volume)
    };
}

const closesOf = result => result.series.close;
const expectCloses = (result, expected) => {
    expect(closesOf(result)).toHaveLength(expected.length);
    expected.forEach((value, i) => {
        // A missing bar (null / NaN / 0 / undefined) must come back as the very same value
        if (value > 0) expect(closesOf(result)[i]).toBeCloseTo(value, 6);
        else expect(closesOf(result)[i]).toBe(value);
    });
};

/** Largest close-to-close ratio in either direction, skipping missing bars */
function worstJump(closes) {
    let worst = 1;
    let previous = null;
    closes.forEach(c => {
        if (!(c > 0)) return;
        if (previous !== null) worst = Math.max(worst, c / previous, previous / c);
        previous = c;
    });
    return worst;
}

describe('unit flips are made continuous', () => {
    test('pence -> pounds flip that persists: the tail is lifted back to the live quote\'s unit', () => {
        const series = bars([150, 151, 152, 153, 1.54, 1.55, 1.56]);
        const result = repairPriceUnits(series, { anchorPrice: 156.2 });

        expectCloses(result, [150, 151, 152, 153, 154, 155, 156]);
        expect(result.report).toMatchObject({
            status: 'repaired', steps: 1, barsRescaled: 3, referenceBasis: 'live-quote'
        });
        expect(result.report.segments).toEqual([{ start: 4, end: 6, factor: 100 }]);
    });

    test('pounds -> pence flip that persists: the head is lifted, no live quote needed', () => {
        // A +9900% day cannot be real, so a lone step UP needs no further evidence
        const result = repairPriceUnits(bars([3.60, 3.605, 3.625, 363, 358.9, 357, 354, 360]));

        expectCloses(result, [360, 360.5, 362.5, 363, 358.9, 357, 354, 360]);
        expect(result.report).toMatchObject({ status: 'repaired', steps: 1, barsRescaled: 3 });
        expect(result.report.segments).toEqual([{ start: 0, end: 2, factor: 100 }]);
    });

    test('flip-and-flip-back: only the off-unit run is rescaled', () => {
        const result = repairPriceUnits(bars([44.2, 44.2, 0.442, 0.442, 0.442, 44.2, 45.2]));

        expectCloses(result, [44.2, 44.2, 44.2, 44.2, 44.2, 44.2, 45.2]);
        expect(result.report).toMatchObject({ status: 'repaired', steps: 2, barsRescaled: 3 });
        expect(result.report.segments).toEqual([{ start: 2, end: 4, factor: 100 }]);
    });

    test('a series that oscillates many times comes out with no 100x step left', () => {
        const closes = [];
        for (let run = 0; run < 12; run++) {
            const inPounds = run % 2 === 1;
            for (let k = 0; k < 5; k++) closes.push((46.8 + run * 0.1) * (inPounds ? 0.01 : 1));
        }
        const result = repairPriceUnits(bars(closes), { anchorPrice: 47.9 });

        expect(result.report).toMatchObject({ status: 'repaired', steps: 11, barsRescaled: 30 });
        expect(worstJump(closesOf(result))).toBeLessThan(1.01);
    });

    test('a real daily move stacked on the flip survives: the rescale is exactly 100', () => {
        // VTA.L 2025-07-07: 6.80 euros -> 690 euro-cents is a flip PLUS a real +1.47%
        const result = repairPriceUnits(bars([6.65, 6.80, 690, 695, 6.95]));

        expectCloses(result, [6.65, 6.80, 6.90, 6.95, 6.95]);
        expect(closesOf(result)[2] / closesOf(result)[1]).toBeCloseTo(1.0147, 4);
    });

    test('open, high, low, close and adjclose move together; volume is never touched', () => {
        const series = bars([44.2, 0.442, 44.2]);
        series.volume = [1200, 0, 3400];
        const { series: repaired } = repairPriceUnits(series);

        expect(repaired.open[1]).toBeCloseTo(0.442 * 0.995 * 100, 6);
        expect(repaired.high[1]).toBeCloseTo(0.442 * 1.01 * 100, 6);
        expect(repaired.low[1]).toBeCloseTo(0.442 * 0.99 * 100, 6);
        expect(repaired.adjclose[1]).toBeCloseTo(0.442 * 0.98 * 100, 6);
        expect(repaired.volume).toBe(series.volume);
        expect(repaired.volume).toEqual([1200, 0, 3400]);
    });
});

describe('genuine moves survive', () => {
    test('a genuine -60% gap is left exactly as it was', () => {
        const series = bars([250, 252, 248, 99.2, 97, 101, 100]);
        const result = repairPriceUnits(series, { anchorPrice: 100 });

        expect(result.report).toMatchObject({ status: 'clean', steps: 0, barsRescaled: 0 });
        expect(result.series).toBe(series);
        expect(closesOf(result)[3] / closesOf(result)[2]).toBeCloseTo(0.4, 6);
    });

    test.each([
        ['-70%', 0.30],
        ['-90%', 0.10],
        ['-97%', 0.03],
        ['+400%', 5.0],
        ['+1900%', 20.0]
    ])('a one-bar move of %s is nowhere near the 100x band', (_label, ratio) => {
        const series = bars([100, 101, 100 * ratio, 100 * ratio * 1.02]);
        const result = repairPriceUnits(series);

        expect(result.report.status).toBe('clean');
        expect(result.series).toBe(series);
    });

    test('an intraday wipe-out (opens at the old level, closes 99% lower) is refused', () => {
        const series = bars([100, 101, 1.0, 0.9, 0.95]);
        series.open[2] = 100;
        series.high[2] = 101;
        series.low[2] = 0.9;
        const result = repairPriceUnits(series);

        expect(result.report).toMatchObject({ status: 'skipped', reason: 'step-bar-fields-disagree' });
        expect(result.series).toBe(series);
    });

    test('a lone -99% gap on a volume spike with a wild range is treated as a collapse', () => {
        const series = bars([100, 101, 99, 1.0, 0.9, 0.95]);
        series.open[3] = 1.4;
        series.high[3] = 1.5;
        series.low[3] = 0.7;
        series.volume[3] = 100000 * 40;
        // The live quote agrees with the tail, so nothing contradicts a real collapse
        const result = repairPriceUnits(series, { anchorPrice: 0.95 });

        expect(result.report).toMatchObject({ status: 'skipped', reason: 'possible-genuine-collapse' });
        expect(result.series).toBe(series);
    });

    test('real data - AMGO.L 2023-03-23: the wind-down collapse (-86%) is untouched', () => {
        const series = {
            open: [1.5, 1.45, 1.7, 1.7, 0.7, 0.375, 0.25, 0.25, 0.25],
            high: [1.74, 1.798, 1.9, 1.9, 0.9, 0.362, 0.3, 0.284, 0.263],
            low: [1.26, 1.202, 1.446, 1.41, 0.121, 0.173, 0.2, 0.15, 0.163],
            close: [1.348, 1.51, 1.7, 1.74, 0.25, 0.27, 0.25, 0.23, 0.2],
            volume: [15762553, 14514990, 1833315, 3476125, 170521949, 52889223, 10080908, 22942305, 8263635]
        };
        const result = repairPriceUnits(series, { anchorPrice: 0.2 });

        expect(result.report.status).toBe('clean');
        expect(result.series).toBe(series);
    });

    test('real data - CHSS.L 2025-11-17: a crash day reported in pounds keeps its real -28%', () => {
        const series = {
            open: [1.25, 1.25, 0.9, 0.0085, 0.5, 0.55, 0.6],
            high: [1.4, 1.3, 0.824, 0.009, 0.6, 0.69, 0.679],
            low: [1.1, 0.828, 0.824, 0.004, 0.455, 0.5, 0.679],
            close: [1.25, 0.9, 0.85, 0.0061, 0.5, 0.6, 0.6],
            volume: [29262, 5499793, 500000, 31597328, 2069950, 1095405, 116362]
        };
        const result = repairPriceUnits(series, { anchorPrice: 0.65 });

        expectCloses(result, [1.25, 0.9, 0.85, 0.61, 0.5, 0.6, 0.6]);
        expect(closesOf(result)[3] / closesOf(result)[2]).toBeCloseTo(0.7176, 4);
        expect(result.report.segments).toEqual([{ start: 3, end: 3, factor: 100 }]);
    });

    test('real data - BCG.L 2026-08-24: a calm lone step down is a relabelling, not a collapse', () => {
        // FTSE 250, ordinary volume, 5% range: Yahoo moved the line from pence to pounds
        const series = {
            open: [204.4, 200.2, 204.8, 200.2, 1.951, 2.046, 2.174, 2.128, 2.082],
            high: [207.8, 206, 206, 203.8, 2.046, 2.104, 2.174, 2.172, 2.186],
            low: [204.2, 200.2, 201.4, 198, 1.951, 2.042, 2.07, 2.08474, 2.082],
            close: [205.6, 205.8, 202.4, 203.4, 2.046, 2.078, 2.126, 2.172, 2.138],
            volume: [380083, 508953, 640080, 1006102, 589194, 1110987, 1295071, 1890341, 4493080]
        };
        const result = repairPriceUnits(series, { anchorPrice: 2.22 });

        expectCloses(result, [2.056, 2.058, 2.024, 2.034, 2.046, 2.078, 2.126, 2.172, 2.138]);
        expect(result.report).toMatchObject({ status: 'repaired', referenceBasis: 'live-quote', barsRescaled: 4 });
        expect(result.report.segments).toEqual([{ start: 0, end: 3, factor: 0.01 }]);
    });
});

describe('missing bars', () => {
    test('null, NaN and 0 bars pass through untouched and are never dropped', () => {
        const series = bars([44.2, null, 0.442, NaN, 0.442, 0, 44.2, undefined, 45.2]);
        const result = repairPriceUnits(series);

        expectCloses(result, [44.2, null, 44.2, NaN, 44.2, 0, 44.2, undefined, 45.2]);
        expect(result.series.high).toHaveLength(9);
        expect(result.series.high[1]).toBeNull();
        expect(result.series.low[3]).toBeNaN();
        expect(result.report.barsRescaled).toBe(2);
    });

    test('a flip is still seen across a gap of missing bars', () => {
        const result = repairPriceUnits(bars([84.2, 84.2, null, null, null, 0.842, 0.842]), { anchorPrice: 84.2 });

        expectCloses(result, [84.2, 84.2, null, null, null, 84.2, 84.2]);
    });

    test('a bar with no close yet (today\'s bar) is rescaled with the run it sits in', () => {
        const series = bars([44.2, 44.2, 0.442, 0.442]);
        series.close[3] = null;
        const result = repairPriceUnits(series, { anchorPrice: 44.2 });

        expect(closesOf(result)[3]).toBeNull();
        expect(result.series.high[3]).toBeCloseTo(0.442 * 1.01 * 100, 6);
        expect(result.series.low[3]).toBeCloseTo(0.442 * 0.99 * 100, 6);
    });

    test.each([
        ['an empty series', { open: [], high: [], low: [], close: [] }],
        ['nothing but missing bars', bars([null, NaN, 0, undefined])],
        ['a single bar', bars([44.2])],
        ['no close column at all', { open: [1], high: [1], low: [1] }],
        ['no series', null]
    ])('%s comes back clean and unchanged', (_label, series) => {
        const result = repairPriceUnits(series);

        expect(result.series).toBe(series);
        expect(result.report).toMatchObject({ status: 'clean', steps: 0, barsRescaled: 0 });
    });
});

describe('which unit is kept', () => {
    // 70GD.L pattern: nearly every bar is a forward-fill in pounds, the quote is in pence
    const mostlyPounds = [0.7025, 0.7025, 0.7025, 0.7025, 0.7025, 70.25, 70.5, 0.705, 0.705, 0.705];

    test('the live quote beats the majority', () => {
        const result = repairPriceUnits(bars(mostlyPounds), { anchorPrice: 70.5 });

        expect(result.report).toMatchObject({ referenceBasis: 'live-quote', barsRescaled: 8 });
        expectCloses(result, [70.25, 70.25, 70.25, 70.25, 70.25, 70.25, 70.5, 70.5, 70.5, 70.5]);
    });

    test('with no live quote the unit most bars are in is kept', () => {
        const result = repairPriceUnits(bars(mostlyPounds));

        expect(result.report).toMatchObject({ referenceBasis: 'majority', barsRescaled: 2 });
        expectCloses(result, [0.7025, 0.7025, 0.7025, 0.7025, 0.7025, 0.7025, 0.705, 0.705, 0.705, 0.705]);
    });

    test('a dead heat goes to the most recent unit', () => {
        const result = repairPriceUnits(bars([1.5, 1.5, 150, 150]));

        expect(result.report.referenceBasis).toBe('latest');
        expectCloses(result, [150, 150, 150, 150]);
    });

    test('a live quote that fits neither unit is ignored (GV2O.L: stale, pre-distribution)', () => {
        const result = repairPriceUnits(bars([48, 48, 48, 0.48, 48, 0.055]), { anchorPrice: 35 });

        expect(result.report.referenceBasis).toBe('majority');
    });

    test('either choice of unit yields the same percentage moves', () => {
        const inPence = closesOf(repairPriceUnits(bars(mostlyPounds), { anchorPrice: 70.5 }));
        const inPounds = closesOf(repairPriceUnits(bars(mostlyPounds)));

        for (let i = 1; i < inPence.length; i++) {
            expect(inPence[i] / inPence[i - 1]).toBeCloseTo(inPounds[i] / inPounds[i - 1], 9);
        }
    });
});

describe('refuses what it does not understand', () => {
    test('three price levels is not one instrument in two units', () => {
        // HOME.L / GV1O.L: a flip tangled up with stale fills and a capital return
        const series = bars([100, 101, 1.0, 1.01, 0.0101, 0.0102]);
        const result = repairPriceUnits(series);

        expect(result.report).toMatchObject({ status: 'skipped', reason: 'more-than-two-price-levels', barsRescaled: 0 });
        expect(result.series).toBe(series);
    });
});

describe('purity', () => {
    test('frozen input survives and nothing is mutated', () => {
        const series = bars([44.2, 0.442, 0.442, 44.2]);
        const snapshot = JSON.stringify(series);
        Object.values(series).forEach(Object.freeze);
        Object.freeze(series);

        const result = repairPriceUnits(series, { anchorPrice: 44.2 });

        expect(JSON.stringify(series)).toBe(snapshot);
        expect(result.series).not.toBe(series);
        expect(result.series.close).not.toBe(series.close);
        expectCloses(result, [44.2, 44.2, 44.2, 44.2]);
    });

    test('a clean series is handed back as-is, not copied', () => {
        const series = bars([10, 10.2, 10.1, 9.9]);

        expect(repairPriceUnits(series).series).toBe(series);
    });
});

describe('repairYahooChartResult', () => {
    const DAY = 86400;
    const T0 = 1789000000;

    function chartResult(closes, meta) {
        const series = bars(closes);
        return {
            meta,
            timestamp: closes.map((_, i) => T0 + i * DAY),
            indicators: {
                quote: [{ open: series.open, high: series.high, low: series.low, close: series.close, volume: series.volume }],
                adjclose: [{ adjclose: series.adjclose }]
            }
        };
    }
    const lastBar = closes => T0 + (closes.length - 1) * DAY;
    const flippedTail = [0.6, 0.6, 0.6, 0.006, 0.006, 0.006, 0.006];

    test('a window that runs up to the quote is anchored to it', () => {
        const result = repairYahooChartResult(chartResult(flippedTail, {
            regularMarketPrice: 0.6, regularMarketTime: lastBar(flippedTail) + 3600
        }));

        expect(result.report).toMatchObject({ status: 'repaired', referenceBasis: 'live-quote' });
        expect(result.quote.close[6]).toBeCloseTo(0.6, 9);
        expect(result.adjclose[6]).toBeCloseTo(0.006 * 0.98 * 100, 9);
    });

    test('a quote OLDER than the last bar still anchors (illiquid line: last trade long ago)', () => {
        // GVMH.L / 70GD.L: forward-filled bars keep arriving after the last trade, in pounds,
        // while /yahoo/quote keeps serving the frozen pence price to the trade executor
        const result = repairYahooChartResult(chartResult(flippedTail, {
            regularMarketPrice: 0.6, regularMarketTime: lastBar(flippedTail) - 900 * DAY
        }));

        expect(result.report.referenceBasis).toBe('live-quote');
        expect(result.quote.close[6]).toBeCloseTo(0.6, 9);
    });

    test('a window that ends long before the quote is NOT anchored to it', () => {
        // A Simulator run over an old window: today's price says nothing about its last bar
        const result = repairYahooChartResult(chartResult(flippedTail, {
            regularMarketPrice: 0.6, regularMarketTime: lastBar(flippedTail) + 400 * DAY
        }));

        expect(result.report).toMatchObject({ status: 'repaired', referenceBasis: 'majority' });
        expect(result.quote.close[0]).toBeCloseTo(0.006, 9);
    });

    test('the Yahoo result is never mutated and volume is passed through', () => {
        const input = chartResult(flippedTail, { regularMarketPrice: 0.6, regularMarketTime: lastBar(flippedTail) });
        const snapshot = JSON.stringify(input);
        const result = repairYahooChartResult(input);

        expect(JSON.stringify(input)).toBe(snapshot);
        expect(result.quote.volume).toBe(input.indicators.quote[0].volume);
        expect(result.quote.close).toHaveLength(flippedTail.length);
    });

    test('a result with no adjclose, no meta, or no bars does not throw', () => {
        const noAdj = chartResult([44.2, 0.442, 44.2], undefined);
        delete noAdj.indicators.adjclose;

        expect(repairYahooChartResult(noAdj).adjclose).toBeNull();
        expect(repairYahooChartResult(noAdj).quote.close[1]).toBeCloseTo(44.2, 9);
        expect(repairYahooChartResult({ indicators: { quote: [{}] } }).report.status).toBe('clean');
        expect(repairYahooChartResult({}).report.status).toBe('clean');
        expect(repairYahooChartResult(null).report.status).toBe('clean');
    });
});

describe('isLoneDownStepAUnitChange - the default policy for the one ambiguous shape', () => {
    const step = overrides => ({ direction: -1, ratio: 0.01, deviation: 0, intrabarSpread: 1, volume: 0, volumeSpike: null, ...overrides });

    test('a forward-filled bar (flat, no volume) is a unit change', () => {
        expect(isLoneDownStepAUnitChange(step())).toBe(true);
    });

    test('an ordinary trading day in a new unit is a unit change (BCG.L)', () => {
        expect(isLoneDownStepAUnitChange(step({ intrabarSpread: 1.049, volume: 589194, volumeSpike: 0.7 }))).toBe(true);
    });

    test('a wild intraday range is not', () => {
        expect(isLoneDownStepAUnitChange(step({ intrabarSpread: 2.2 }))).toBe(false);
    });

    test('a volume spike is not', () => {
        expect(isLoneDownStepAUnitChange(step({ intrabarSpread: 1.1, volumeSpike: 12 }))).toBe(false);
    });
});

describe('alignToQuoteUnit - a window set against the live quote', () => {
    // A day move compares a bar with the QUOTE. A short window can be continuous - nothing
    // for repairPriceUnits to find - and still sit wholly in the other unit.

    test('real data - GVMH.L 2026-09-19: four forward-filled bars in pounds under a pence quote', () => {
        const closes = [0.006000000052154064, 0.006000000052154064, 0.006000000052154064, null, 0.006000000052154064];
        expect(repairPriceUnits(bars(closes), { anchorPrice: 0.6 }).report.status).toBe('clean');

        const { prices, factor } = alignToQuoteUnit(closes, 0.6);

        expect(factor).toBe(100);
        [0, 1, 2, 4].forEach(i => expect(prices[i]).toBeCloseTo(0.6, 6));
        expect(prices[3]).toBeNull();
    });

    test('bars in pence under a quote in pounds come down by exactly 100', () => {
        const { prices, factor } = alignToQuoteUnit([60, 60.5, 44.2], 0.445);

        expect(factor).toBe(0.01);
        // Divided, not multiplied by 0.01: 44.2 / 100 is exact where 44.2 * 0.01 is not
        expect(prices).toEqual([0.6, 0.605, 0.442]);
    });

    test('a real move between the newest bar and the quote survives: the rescale is exactly 100', () => {
        const { prices } = alignToQuoteUnit([1.50, 1.52], 156.56);

        expect(prices[1]).toBeCloseTo(152, 6);
        expect(156.56 / prices[1] - 1).toBeCloseTo(0.03, 6);
    });

    test('the newest close decides, even when today\'s bar is still empty (VTA.L shape)', () => {
        const { prices, factor } = alignToQuoteUnit([595, 595, null, null], 5.95);

        expect(factor).toBe(0.01);
        expect(prices).toEqual([5.95, 5.95, null, null]);
    });

    test('a genuine -60% or -97% gap to the quote is nowhere near a unit gap', () => {
        const closes = [100, 100];
        expect(alignToQuoteUnit(closes, 40)).toEqual({ prices: closes, factor: 1 });
        expect(alignToQuoteUnit(closes, 3)).toEqual({ prices: closes, factor: 1 });
    });

    test('a window already in the quote\'s unit is handed back as-is, not copied', () => {
        const closes = [60, 60.5, 61];
        expect(alignToQuoteUnit(closes, 61.2).prices).toBe(closes);
    });

    test('no usable quote, no usable price, or not an array: nothing happens', () => {
        const closes = [0.006, 0.006];
        [undefined, null, NaN, 0, -1, '0.6'].forEach(quote => {
            expect(alignToQuoteUnit(closes, quote)).toEqual({ prices: closes, factor: 1 });
        });
        const empty = [null, NaN, 0];
        expect(alignToQuoteUnit(empty, 0.6).prices).toBe(empty);
        expect(alignToQuoteUnit(undefined, 0.6)).toEqual({ prices: undefined, factor: 1 });
    });

    test('frozen input survives and is never mutated', () => {
        const closes = Object.freeze([0.006, null, 0.006]);
        const { prices } = alignToQuoteUnit(closes, 0.6);

        expect(closes).toEqual([0.006, null, 0.006]);
        expect(prices).not.toBe(closes);
    });
});

describe('isRepairEnabled - the owner\'s switch', () => {
    test('only the word true turns it on - any case, stray whitespace allowed', () => {
        ['true', 'TRUE', 'True', ' true '].forEach(value => {
            expect(isRepairEnabled({ PRICE_UNIT_REPAIR: value })).toBe(true);
        });
    });

    test('unset, empty, "false", "1", "yes" and "on" all leave it off', () => {
        [undefined, '', 'false', '1', 'yes', 'on', 'truee'].forEach(value => {
            expect(isRepairEnabled({ PRICE_UNIT_REPAIR: value })).toBe(false);
        });
        expect(isRepairEnabled({})).toBe(false);
    });

    test('reads process.env when it is not handed an environment', () => {
        const atStart = process.env.PRICE_UNIT_REPAIR;
        try {
            process.env.PRICE_UNIT_REPAIR = 'true';
            expect(isRepairEnabled()).toBe(true);
            delete process.env.PRICE_UNIT_REPAIR;
            expect(isRepairEnabled()).toBe(false);
        } finally {
            if (atStart === undefined) delete process.env.PRICE_UNIT_REPAIR;
            else process.env.PRICE_UNIT_REPAIR = atStart;
        }
    });
});
