/**
 * Stale-fill repair (lib/shared/stale-fill-repair.js)
 *
 * On no-trade days Yahoo fills some London bars with a price no trade ever printed:
 * HOME.L's show 38.05p - the price it was suspended at - between trades at 10p. The
 * backtest engines book the zig-zag as -68% and -75% trades. Four things are pinned
 * down here:
 *   1. A zero-volume bar far from BOTH trades either side of it, when those two trades
 *      agree with each other, gets the last traded close carried forward over it.
 *   2. Real information is left alone: a no-volume move the next trade confirms, any
 *      bar that traded, small quote moves, and gaps whose two trades disagree.
 *   3. With no trade before a bar, or none after it, there is nothing to judge it by:
 *      it is counted and never changed.
 *   4. Missing bars (null / NaN / 0) pass straight through. Nothing is ever dropped,
 *      reordered or mutated, and volume is never touched.
 *
 * The real-data fixtures are cut from Yahoo responses fetched 2026-09-19.
 */

const {
    repairStaleFills,
    repairYahooChartStaleFills,
    isRepairEnabled,
    describeReport,
    isUnconfirmedExcursion,
    EXCURSION_FACTOR
} = require('../../lib/shared/stale-fill-repair');
const { repairYahooChartResult } = require('../../lib/shared/price-unit-repair');

/**
 * Bars from [close, volume] rows. A no-trade bar is flat (open = high = low = close),
 * as Yahoo's are; a traded bar gets a 2% range. adjclose sits 2% under the close so a
 * test can tell which of the two was carried forward.
 */
function bars(rows) {
    const flat = ([, volume]) => !(volume > 0);
    return {
        open: rows.map(r => (r[0] > 0 && !flat(r) ? r[0] * 0.995 : r[0])),
        high: rows.map(r => (r[0] > 0 && !flat(r) ? r[0] * 1.01 : r[0])),
        low: rows.map(r => (r[0] > 0 && !flat(r) ? r[0] * 0.99 : r[0])),
        close: rows.map(r => r[0]),
        adjclose: rows.map(r => (r[0] > 0 ? r[0] * 0.98 : r[0])),
        volume: rows.map(r => r[1])
    };
}

const expectCloses = (result, expected) => {
    expect(result.series.close).toHaveLength(expected.length);
    expected.forEach((value, i) => {
        // A missing bar (null / NaN / 0 / undefined) must come back as the very same value
        if (value > 0) expect(result.series.close[i]).toBeCloseTo(value, 9);
        else expect(result.series.close[i]).toBe(value);
    });
};

/** Nothing was judged stale: the caller gets its own object back, untouched */
const expectUntouched = (series, result) => {
    expect(result.series).toBe(series);
    expect(result.report.bars).toBe(0);
    expect(result.report.runs).toEqual([]);
};

describe('a price no trade confirmed is replaced by the last traded close', () => {
    test('HOME.L 2025-01-27..02-07: the 38.05p suspension price between trades at 10p', () => {
        const series = bars([
            [38.05, 0], [38.05, 0], [10, 10444650], [38.05, 0], [10, 9538214],
            [10, 156230], [10, 53500], [38.05, 0], [11, 172201], [11, 25117809]
        ]);
        const result = repairStaleFills(series);

        // The two leading bars have no trade before them in this window: left alone
        expectCloses(result, [38.05, 38.05, 10, 10, 10, 10, 10, 10, 11, 11]);
        expect(result.report).toMatchObject({ status: 'repaired', reason: null, bars: 2, unjudgedTailBars: 0 });
        expect(result.report.runs).toEqual([
            { start: 3, end: 3, anchorIndex: 2 },
            { start: 7, end: 7, anchorIndex: 6 }
        ]);
        expect(result.report.worstFactor).toBeCloseTo(3.805, 6);
    });

    test('the whole bar is carried - open, high, low, close - and adjclose from the same trade', () => {
        const result = repairStaleFills(bars([[10, 5000], [38.05, 0], [10.4, 7000]]));

        for (const field of ['open', 'high', 'low', 'close']) expect(result.series[field][1]).toBe(10);
        expect(result.series.adjclose[1]).toBeCloseTo(9.8, 9);
        // The trades themselves keep their own range
        expect(result.series.high[0]).toBeCloseTo(10.1, 9);
        expect(result.series.low[2]).toBeCloseTo(10.296, 9);
    });

    test('ZAIM.L 2023-07..09: a run filled at exactly a tenth of the traded price', () => {
        const rows = [[6.5, 4200]];
        for (let i = 0; i < 29; i++) rows.push([0.65, 0]);
        rows.push([7.0, 6108]);
        const result = repairStaleFills(bars(rows));

        expect(result.series.close.slice(1, 30).every(c => c === 6.5)).toBe(true);
        expect(result.report).toMatchObject({ status: 'repaired', bars: 29 });
        expect(result.report.runs).toEqual([{ start: 1, end: 29, anchorIndex: 0 }]);
        expect(result.report.worstFactor).toBeCloseTo(7.0 / 0.65, 6);
    });

    test('the same stale price in two units inside one gap (HOME.L 2025-07: 0.3805 then 38.05)', () => {
        const result = repairStaleFills(bars([
            [11, 9000], [0.3805, 0], [0.3805, 0], [38.05, 0], [38.05, 0], [12, 8000]
        ]));

        expectCloses(result, [11, 11, 11, 11, 11, 12]);
        expect(result.report.runs).toEqual([{ start: 1, end: 4, anchorIndex: 0 }]);
    });

    test('the real price doubled across the gap and the fill is still far from both trades', () => {
        // HOME.L 2024-12-27 -> 2025-01-16: traded 4.00, twelve bars at 38.05, traded 8.00
        const result = repairStaleFills(bars([[4, 3000], [38.05, 0], [38.05, 0], [38.05, 0], [8, 2500]]));

        expectCloses(result, [4, 4, 4, 4, 8]);
    });

    test('only the unconfirmed bars in a gap change - sound quotes beside them stay', () => {
        const series = bars([[10, 5000], [10.2, 0], [38.05, 0], [10.2, 0], [38.05, 0], [10.5, 6000]]);
        const result = repairStaleFills(series);

        expectCloses(result, [10, 10.2, 10, 10.2, 10, 10.5]);
        expect(result.report.bars).toBe(2);
        expect(result.report.runs).toEqual([
            { start: 2, end: 2, anchorIndex: 0 },
            { start: 4, end: 4, anchorIndex: 0 }
        ]);
    });

    test('running it again finds nothing left to do', () => {
        const once = repairStaleFills(bars([[10, 5000], [38.05, 0], [0.3805, 0], [10, 6000], [38.05, 0], [11, 100]]));
        const twice = repairStaleFills(once.series);

        expect(once.report.bars).toBe(3);
        expect(twice.report.status).toBe('clean');
        expect(twice.series).toBe(once.series);
    });
});

describe('real information is left alone', () => {
    test('a no-volume move that the next trade CONFIRMS (the quote moved ahead of the tape)', () => {
        // The shape of ASIA.L / GVMH.L / OT3.L: 111 such bars across 8 UK symbols at 1.5x
        const series = bars([[10, 5000], [10, 0], [4, 0], [4, 0], [4, 0], [4.1, 900], [4.1, 0]]);

        expectUntouched(series, repairStaleFills(series));
    });

    test('a bar that TRADED is never altered, however wild', () => {
        const series = bars([[10, 5000], [38.05, 500], [10, 5000], [0.5, 12], [10, 5000]]);

        expectUntouched(series, repairStaleFills(series));
    });

    test('ordinary forward-fills and small quote moves on no-trade days', () => {
        const series = bars([[100, 900], [100, 0], [100, 0], [104, 0], [97, 0], [160, 0], [101, 700]]);

        // 160 is a +60% no-volume quote that came straight back: inside 2x, so not ours to judge
        expectUntouched(series, repairStaleFills(series));
    });

    test('exactly 2x is not beyond 2x (TM1.L 2026-07-20: one bar at exactly half price)', () => {
        const series = bars([[0.048, 5378513], [0.024, 0], [0.048, 8502667]]);

        expectUntouched(series, repairStaleFills(series));
    });

    test('ACG.L 2024-01: 380 -> [300, 200] -> 425 on a wild thin line could be real quotes', () => {
        const series = bars([[380, 500], [300, 0], [200, 0], [425, 4000], [700, 1586]]);

        expectUntouched(series, repairStaleFills(series));
    });

    test('GV1O.L: the trades either side disagree by 38x (pounds vs pence) - no telling whose side the fill is on', () => {
        // A genuine two-year slide 0.86 -> 0.35 in pounds, then a trade printed in pence
        const series = bars([[0.86, 1925], [0.70, 0], [0.48, 0], [0.35, 0], [33.0, 2000]]);

        expectUntouched(series, repairStaleFills(series));
    });

    test('HOME.L 2024-12: first trade back printed in pounds (0.06), the next in pence (4.00)', () => {
        const series = bars([[0.06, 472344], [38.05, 0], [38.05, 0], [38.05, 0], [4, 3000]]);

        expectUntouched(series, repairStaleFills(series));
    });

    test('a long suspension at the last traded price is a correct fill, not a stale one', () => {
        // HOME.L 2023-01 -> 2024-12: 38.05 IS the last trade for the whole suspension
        const rows = [[38.05, 719968]];
        for (let i = 0; i < 40; i++) rows.push([38.05, 0]);
        const series = bars(rows);

        expectUntouched(series, repairStaleFills(series));
        expect(repairStaleFills(series).report.status).toBe('clean');
    });
});

describe('nothing to judge a bar by', () => {
    test('GRIT.L: no trade before the zig-zag - and there the flat level is the stale one', () => {
        // 587 bars at 9.6 with no volume; 0.85 and 1.5 were the real quotes; it later trades at 1.35
        const series = bars([[9.6, 0], [9.6, 0], [0.85, 0], [9.6, 0], [1.5, 0], [9.6, 0], [1.35, 0], [1.35, 38461]]);
        const result = repairStaleFills(series);

        expectUntouched(series, result);
        expect(result.report.status).toBe('clean');
    });

    test('suspect bars at the END have no later trade: counted, never changed', () => {
        const series = bars([[10, 5000], [10, 4000], [38.05, 0], [38.05, 0]]);
        const result = repairStaleFills(series);

        expectUntouched(series, result);
        expect(result.report).toMatchObject({
            status: 'skipped', reason: 'tail-has-no-later-trade', unjudgedTailBars: 2
        });
    });

    test('a sound forward-fill at the end is not suspect', () => {
        const result = repairStaleFills(bars([[10, 5000], [10, 0], [10.3, 0]]));

        expect(result.report).toMatchObject({ status: 'clean', unjudgedTailBars: 0 });
    });

    test('a repaired series still reports its unjudged tail', () => {
        const result = repairStaleFills(bars([[10, 5000], [38.05, 0], [10, 4000], [38.05, 0]]));

        expectCloses(result, [10, 10, 10, 38.05]);
        expect(result.report).toMatchObject({ status: 'repaired', bars: 1, unjudgedTailBars: 1 });
    });

    test('no volume column means no traded bars, so nothing can be judged', () => {
        const series = { open: [10, 38.05, 10], high: [10, 38.05, 10], low: [10, 38.05, 10], close: [10, 38.05, 10] };

        expectUntouched(series, repairStaleFills(series));
    });
});

describe('missing bars and purity', () => {
    test('null / NaN / 0 bars pass straight through and never break the anchor', () => {
        const series = bars([[10, 5000], [null, null], [38.05, 0], [NaN, 0], [0, 0], [38.05, 0], [10.5, 4000]]);
        const result = repairStaleFills(series);

        expectCloses(result, [10, null, 10, NaN, 0, 10, 10.5]);
        // Separated by the missing bars, so two runs from the one anchor
        expect(result.report.runs).toEqual([
            { start: 2, end: 2, anchorIndex: 0 },
            { start: 5, end: 5, anchorIndex: 0 }
        ]);
    });

    test('a bar with volume but no close is not a trade to anchor on', () => {
        const result = repairStaleFills(bars([[10, 5000], [null, 9000], [38.05, 0], [10, 4000]]));

        expectCloses(result, [10, null, 10, 10]);
        expect(result.report.runs).toEqual([{ start: 2, end: 2, anchorIndex: 0 }]);
    });

    test('inputs are never mutated; length, order and volume are preserved', () => {
        const series = bars([[10, 5000], [38.05, 0], [10, 4000]]);
        const snapshot = JSON.parse(JSON.stringify(series));
        const result = repairStaleFills(series);

        expect(series).toEqual(snapshot);
        expect(result.series).not.toBe(series);
        expect(result.series.close).not.toBe(series.close);
        expect(result.series.volume).toBe(series.volume);
        for (const field of ['open', 'high', 'low', 'close', 'adjclose']) {
            expect(result.series[field]).toHaveLength(3);
        }
    });

    test('a missing adjclose on the anchor leaves the bar\'s own adjclose in place', () => {
        const series = bars([[10, 5000], [38.05, 0], [10, 4000]]);
        series.adjclose[0] = null;
        const result = repairStaleFills(series);

        expect(result.series.close[1]).toBe(10);
        expect(result.series.adjclose[1]).toBeCloseTo(38.05 * 0.98, 9);
    });

    test('empty and malformed input comes back clean', () => {
        expect(repairStaleFills(null).report.status).toBe('clean');
        expect(repairStaleFills({}).report.status).toBe('clean');
        expect(repairStaleFills({ close: [] }).report.status).toBe('clean');
    });
});

describe('isUnconfirmedExcursion - the policy on its own', () => {
    const excursion = (anchor, fill, next) => ({
        outRatio: fill / anchor, backRatio: next / fill, bracketRatio: next / anchor
    });

    test('out and back by more than the factor, on the same side of two agreeing trades', () => {
        expect(isUnconfirmedExcursion(excursion(10, 38.05, 10))).toBe(true);   // above both
        expect(isUnconfirmedExcursion(excursion(6.5, 0.65, 7))).toBe(true);    // below both
        expect(isUnconfirmedExcursion(excursion(4, 38.05, 8))).toBe(true);     // real price doubled meanwhile
    });

    test('one leg inside the factor means a trade (nearly) confirmed it', () => {
        expect(isUnconfirmedExcursion(excursion(10, 4, 4.1))).toBe(false);     // confirmed
        expect(isUnconfirmedExcursion(excursion(10, 38.05, 20))).toBe(false);  // back leg only 1.9x
        expect(isUnconfirmedExcursion(excursion(10, 19, 10))).toBe(false);     // out leg only 1.9x
        expect(isUnconfirmedExcursion(excursion(10, 10, 10))).toBe(false);
    });

    test('a move that KEEPS GOING is a trend, not an excursion', () => {
        expect(isUnconfirmedExcursion(excursion(10, 4, 1.5))).toBe(false);
        expect(isUnconfirmedExcursion(excursion(10, 25, 60))).toBe(false);
    });

    test('trades that disagree with each other more than with the fill settle nothing', () => {
        expect(isUnconfirmedExcursion(excursion(0.86, 0.35, 33))).toBe(false);
        expect(isUnconfirmedExcursion(excursion(0.06, 38.05, 4))).toBe(false);
    });

    test('the factor is 2', () => {
        expect(EXCURSION_FACTOR).toBe(2);
    });
});

describe('repairYahooChartStaleFills', () => {
    const chartResult = (series, meta = {}) => ({
        meta,
        timestamp: series.close.map((_, i) => 1700000000 + i * 86400),
        indicators: {
            quote: [{ open: series.open, high: series.high, low: series.low, close: series.close, volume: series.volume }],
            adjclose: [{ adjclose: series.adjclose }]
        }
    });

    test('repairs a raw Yahoo result without mutating it', () => {
        const input = chartResult(bars([[10, 5000], [38.05, 0], [10, 4000]]));
        const snapshot = JSON.parse(JSON.stringify(input));
        const result = repairYahooChartStaleFills(input);

        expect(result.quote.close).toEqual([10, 10, 10]);
        expect(result.quote.volume).toEqual([5000, 0, 4000]);
        expect(result.adjclose[1]).toBeCloseTo(9.8, 9);
        expect(result.report.status).toBe('repaired');
        expect(input).toEqual(snapshot);
    });

    test('judges the unit-repaired view when given one, so the two repairs do not overlap', () => {
        // Pence, a no-trade stretch forward-filled in POUNDS, then a run at a tenth of the price
        const input = chartResult(bars([
            [6.5, 900], [6.5, 800], [6.5, 700], [0.065, 0], [0.065, 0], [6.5, 600],
            [0.65, 0], [0.65, 0], [7.0, 6108], [7.0, 500]
        ]));
        const unit = repairYahooChartResult(input);
        expect(unit.report.status).toBe('repaired');

        const onUnitView = repairYahooChartStaleFills(input, { quote: unit.quote, adjclose: unit.adjclose });
        expect(onUnitView.report.bars).toBe(2);                       // only the /10 run
        expect(onUnitView.report.runs).toEqual([{ start: 6, end: 7, anchorIndex: 5 }]);
        expect(onUnitView.quote.close).toEqual([6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 7.0, 7.0]);
        expect(onUnitView.quote.volume).toEqual(input.indicators.quote[0].volume);

        // On the raw bars it would claim the unit module's bars as well
        expect(repairYahooChartStaleFills(input).report.bars).toBe(4);
    });

    test('a result with no adjclose, no quote, or nothing at all', () => {
        const noAdj = chartResult(bars([[10, 5000], [38.05, 0], [10, 4000]]));
        delete noAdj.indicators.adjclose;

        expect(repairYahooChartStaleFills(noAdj).adjclose).toBeNull();
        expect(repairYahooChartStaleFills(noAdj).quote.close).toEqual([10, 10, 10]);
        expect(repairYahooChartStaleFills({ indicators: { quote: [{}] } }).report.status).toBe('clean');
        expect(repairYahooChartStaleFills({}).report.status).toBe('clean');
        expect(repairYahooChartStaleFills(null).report.status).toBe('clean');
    });
});

describe('reporting and the switch', () => {
    test('describeReport is one line fit for a response header', () => {
        const repaired = repairStaleFills(bars([[10, 5000], [38.05, 0], [10, 4000], [38.05, 0]])).report;
        const tailOnly = repairStaleFills(bars([[10, 5000], [38.05, 0]])).report;
        const clean = repairStaleFills(bars([[10, 5000], [10, 0], [10, 4000]])).report;

        expect(describeReport(repaired)).toBe('repaired; bars=1; runs=1; worst=3.8x; tail=1');
        expect(describeReport(tailOnly)).toBe('skipped; reason=tail-has-no-later-trade; tail=1');
        expect(describeReport(clean)).toBe('clean');
    });

    test('STALE_FILL_REPAIR=true is the only thing that turns it on', () => {
        expect(isRepairEnabled({ STALE_FILL_REPAIR: 'true' })).toBe(true);
        expect(isRepairEnabled({ STALE_FILL_REPAIR: ' TRUE ' })).toBe(true);
        expect(isRepairEnabled({ STALE_FILL_REPAIR: '1' })).toBe(false);
        expect(isRepairEnabled({ STALE_FILL_REPAIR: 'false' })).toBe(false);
        expect(isRepairEnabled({ PRICE_UNIT_REPAIR: 'true' })).toBe(false);
        expect(isRepairEnabled({})).toBe(false);
    });
});
