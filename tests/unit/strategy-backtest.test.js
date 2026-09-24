/**
 * GAPS #17: the backtest rules, pinned with numbers worked out by hand. There are two engines (GAPS #7):
 *
 *   lib/shared/frontend-backtest-calculator.js  the 7 AM scan's: its win rate decides which signals are sent and
 *                                               booked (lib/scanner/scanner.js keeps a win rate above 75%)
 *   lib/shared/backtest-calculator.js           the Simulator's (portfolio-backtest.html)
 *
 * Both enter at the day's close when the daily DTI is below the entry threshold (0) and above the day before
 * and the 7-day DTI is rising, then exit at the first close that is +8% or more (target), -5% or less (stop), or
 * 30 calendar days or more after the entry (time exit). One position at a time; a win is a P/L above 0. Where the
 * engines differ, the block says so.
 *
 * The closes make every P/L a whole number: entry 100, target 108 (+8), stop 95 (-5), time exit 103 (+3) or 100
 * (0, which counts as a loss). No fixture's best close reaches +4% unless the trade goes on to its +8% target,
 * so a stop that only moves once a trade has been 4% up (README: Trailing stop) leaves every number here as it is.
 */
const ScanEngine = require('../../lib/shared/frontend-backtest-calculator');
const SimEngine = require('../../lib/shared/backtest-calculator');

const DAY_MS = 24 * 60 * 60 * 1000;
/** Calendar day i after `from`, as the CSV writes dates. Consecutive days, so holding days = bar distance */
const day = (i, from = Date.UTC(2025, 0, 1)) => new Date(from + i * DAY_MS).toISOString().slice(0, 10);

beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

// ------------------------------------------------------------------------------------------------ the scan's engine

/**
 * What the scan's engine reads (scanner.js fetchStockData): dates, closes, the daily DTI and the 7-day DTI in the
 * shape dti-calculator.js calculate7DayDTI returns it, all built by hand here. Blocks of 7 bars from bar 0; block
 * p's 7-day value is sevenDay(p) (rising by default). Daily DTI +10 (never an entry) and close 100 unless a test
 * says otherwise.
 */
function scanStock(n, { sevenDay = p => p } = {}) {
    const dates = [];
    const close = [];
    const dti = [];
    for (let i = 0; i < n; i++) {
        dates.push(day(i));
        close.push(100);
        dti.push(10);
    }
    const sevenDayData = [];
    const sevenDayDTI = [];
    const daily7DayDTI = [];
    for (let start = 0, p = 0; start < n; start += 7, p++) {
        const end = Math.min(start + 6, n - 1);
        sevenDayData.push({ startDate: dates[start], endDate: dates[end], startIndex: start, endIndex: end });
        sevenDayDTI.push(sevenDay(p));
        for (let j = start; j <= end; j++) daily7DayDTI.push(sevenDay(p));
    }
    return { symbol: 'TEST.L', dates, close, dti, sevenDayDTI: { sevenDayData, sevenDayDTI, daily7DayDTI } };
}

/** A DTI turn on bar i: -30 the day before, -20 on the day (below 0, and rising) */
function turnOn(stock, i) {
    stock.dti[i - 1] = -30;
    stock.dti[i] = -20;
}

// Bar 190 is 10 July 2025, bar 170 is 20 June: the series starts on 1 January 2025
const JULY_10 = 190;

describe('the scan\'s engine (frontend-backtest-calculator.js): entries', () => {
    test('a DTI turn below 0 opens a trade at that day\'s close, but not in the first six months of data', () => {
        const early = scanStock(220);
        turnOn(early, 170);
        expect(ScanEngine.runBacktest(early).trades).toEqual([]);

        const stock = scanStock(220);
        turnOn(stock, JULY_10);
        stock.close[JULY_10] = 100;
        const { trades } = ScanEngine.runBacktest(stock);
        expect(trades).toHaveLength(1);
        // Still open on the last bar, 29 days later: nothing has hit its target, stop or clock
        expect(trades[0]).toMatchObject({
            entryDate: '2025-07-10', entryPrice: 100, entryDTI: -20, isOpen: true, holdingDays: 29
        });
    });

    test('the threshold is strict: a DTI of exactly 0 opens nothing, and with -40 the DTI must be below -40', () => {
        const atZero = scanStock(220);
        atZero.dti[JULY_10 - 1] = -30;
        atZero.dti[JULY_10] = 0;
        expect(ScanEngine.runBacktest(atZero).trades).toEqual([]);

        const shallow = scanStock(220);
        turnOn(shallow, JULY_10);
        expect(ScanEngine.runBacktest(shallow, { entryThreshold: -40 }).trades).toEqual([]);

        const deep = scanStock(220);
        deep.dti[JULY_10 - 1] = -60;
        deep.dti[JULY_10] = -50;
        expect(ScanEngine.runBacktest(deep, { entryThreshold: -40 }).trades).toHaveLength(1);
    });

    test('the DTI must be rising: -20 after -10 opens nothing', () => {
        const falling = scanStock(220);
        falling.dti[JULY_10 - 1] = -10;
        falling.dti[JULY_10] = -20;
        expect(ScanEngine.runBacktest(falling).trades).toEqual([]);
    });

    test('the 7-day DTI of the day\'s block must beat the block before; any day of such a block will do', () => {
        // Bar 190 is the second bar of block 27 (bars 189-195). Rising blocks: it enters
        const rising = scanStock(220);
        turnOn(rising, JULY_10);
        expect(ScanEngine.runBacktest(rising).trades).toHaveLength(1);

        // Every block the same: never above the block before, so never an entry
        const flat = scanStock(220, { sevenDay: () => 5 });
        turnOn(flat, JULY_10);
        expect(ScanEngine.runBacktest(flat).trades).toEqual([]);
    });
});

describe('the scan\'s engine: exits, win rate and expectancy', () => {
    // Five trades on one 300-day chart:
    //   bar 190 (10 Jul): 101, 102, then 108 on bar 193            -> Take Profit  +8, 3 days
    //   bar 195 (15 Jul): 99, 97, then 95 on bar 198               -> Stop Loss    -5, 3 days
    //   bar 200 (20 Jul): flat, then 103 on bar 230, day 30        -> Time Exit    +3, 30 days
    //                     (a DTI turn on bar 210 falls inside this trade and opens nothing)
    //   bar 232 (21 Aug): flat, 100 on bar 262, day 30             -> Time Exit     0 (a loss), 30 days
    //   bar 280 (8 Oct):  still open on the last bar (27 Oct)      -> left out of the win rate
    // Completed: 4. Wins: 2 (+8, +3). Win rate 2 / 4 = 50%. Total 8 - 5 + 3 + 0 = 6; per trade 6 / 4 = 1.5.
    function fiveTrades() {
        const stock = scanStock(300);
        [190, 195, 200, 210, 232, 280].forEach(i => turnOn(stock, i));
        Object.assign(stock.close, { 191: 101, 192: 102, 193: 108, 196: 99, 197: 97, 198: 95, 230: 103 });
        return stock;
    }

    test('each exit comes at the first close that reaches it', () => {
        const { trades } = ScanEngine.runBacktest(fiveTrades());
        expect(trades.map(t => [t.entryDate, t.exitDate, t.exitPrice, t.plPercent, t.exitReason, t.holdingDays]))
            .toEqual([
                ['2025-07-10', '2025-07-13', 108, 8, 'Take Profit', 3],
                ['2025-07-15', '2025-07-18', 95, -5, 'Stop Loss', 3],
                ['2025-07-20', '2025-08-19', 103, 3, 'Time Exit', 30],
                ['2025-08-21', '2025-09-20', 100, 0, 'Time Exit', 30],
                ['2025-10-08', undefined, undefined, undefined, undefined, 19]
            ]);
        expect(trades[4]).toMatchObject({ isOpen: true, currentPrice: 100, currentPlPercent: 0 });
    });

    test('win rate and expectancy count the completed trades only, and a P/L of exactly 0 is a loss', () => {
        expect(ScanEngine.runBacktest(fiveTrades()).metrics).toEqual({
            totalTrades: 4, winningTrades: 2, losingTrades: 2, winRate: 50, totalReturn: 6, avgReturn: 1.5
        });
    });

    test('just short of the target or the stop is no exit: 107.99 then 108, and 95.01 then 95', () => {
        const target = scanStock(220);
        turnOn(target, JULY_10);
        Object.assign(target.close, { 191: 107.99, 192: 108 });
        expect(ScanEngine.runBacktest(target).trades[0]).toMatchObject({ exitDate: '2025-07-12', plPercent: 8, exitReason: 'Take Profit' });

        const stop = scanStock(220);
        turnOn(stop, JULY_10);
        Object.assign(stop.close, { 191: 95.01, 192: 95 });
        expect(ScanEngine.runBacktest(stop).trades[0]).toMatchObject({ exitDate: '2025-07-12', plPercent: -5, exitReason: 'Stop Loss' });
    });

    test('no trades: every figure is 0', () => {
        expect(ScanEngine.runBacktest(scanStock(220)).metrics).toEqual({
            totalTrades: 0, winningTrades: 0, losingTrades: 0, winRate: 0, totalReturn: 0, avgReturn: 0
        });
    });
});

// ------------------------------------------------------------------------------------------- the Simulator's engine

/**
 * The Simulator's engine works its DTI out from the highs and lows itself. With periods r = s = u = 1 the EMAs
 * change nothing, so the daily DTI is 100 x the sign of the day's momentum (0 on a flat day), and the 7-day DTI the
 * same over blocks of 7 bars. This chart turns exactly once:
 *   bar 6: the high holds at 105 and the low falls 90 -> 89        DTI -100
 *   bar 7: the high holds and the low holds                        DTI 0: above -100, below the threshold of 50
 *   bar 7 opens block 1 (bars 7-13), whose high (111 on bar 13) beats block 0's (105) with no lower low: the 7-day
 *   DTI goes 0 -> 100 on bar 7. From bar 8 the high rises 1 a day, so every later block reads 100 too.
 * The only entry is bar 7 (8 January 2026). Closes are 100 unless a test says otherwise.
 */
const SIM_START = Date.UTC(2026, 0, 1);
const simDay = i => day(i, SIM_START);
const SIM = { r: 1, s: 1, u: 1, entryThreshold: 50 };

function simStock(n) {
    const dates = [];
    const high = [];
    const low = [];
    const close = [];
    for (let i = 0; i < n; i++) {
        dates.push(simDay(i));
        high.push(i <= 5 ? 100 + i : i <= 7 ? 105 : 98 + i);
        low.push(i <= 5 ? 90 : 89);
        close.push(100);
    }
    return { symbol: 'TEST.L', dates, high, low, close };
}

/** The same chart, but block 2 (bars 14-20) is flat at block 1's high and low: its 7-day DTI is 0, a turn down */
function simStockTurningDown(n) {
    const stock = simStock(n);
    for (let i = 14; i < n; i++) stock.high[i] = i <= 20 ? 111 : 91 + i;
    return stock;
}

describe('the Simulator\'s engine (backtest-calculator.js): entries', () => {
    test('the turn opens a trade at bar 7\'s close', () => {
        const { trades } = SimEngine.runBacktest(simStock(20), SIM);
        expect(trades).toHaveLength(1);
        expect(trades[0]).toMatchObject({
            entryDate: simDay(7), entryPrice: 100, prevDTI: -100, entryDTI: 0, prev7DayDTI: 0, entry7DayDTI: 100,
            exitReason: 'Open', isOpen: true, exitDate: simDay(19), holdingDays: 12, plPercent: 0
        });
    });

    test('the threshold is strict: with the default threshold of 0, bar 7\'s DTI of exactly 0 opens nothing', () => {
        expect(SimEngine.runBacktest(simStock(20), { r: 1, s: 1, u: 1 }).trades).toEqual([]);
    });

    test('it enters only on the first bar of a 7-bar block: the same turn on bar 9 opens nothing (GAPS #7)', () => {
        // Its 7-day test compares a day with the day before, and every day of a block carries the same value,
        // so only a block's first bar can pass. The scan's engine compares with the block before (see above).
        // Here the low falls on bar 8 (DTI -100) and holds on bar 9 (DTI 0), inside rising block 1.
        const stock = simStock(20);
        for (let i = 0; i < 20; i++) {
            stock.high[i] = i <= 5 ? 100 + i : i <= 9 ? Math.min(100 + i, 107) : 98 + i;
            stock.low[i] = i <= 7 ? 90 : 89;
        }
        expect(SimEngine.runBacktest(stock, SIM).trades).toEqual([]);
    });
});

describe('the Simulator\'s engine: exits and win rate', () => {
    test('target: 102, 107.99, then 108 on bar 10 -> Take Profit +8 after 3 days; a 100% win rate', () => {
        const stock = simStock(20);
        Object.assign(stock.close, { 8: 102, 9: 107.99, 10: 108 });
        const { trades, metrics } = SimEngine.runBacktest(stock, SIM);
        expect(trades).toHaveLength(1);
        expect(trades[0]).toMatchObject({
            exitDate: simDay(10), exitPrice: 108, plPercent: 8, holdingDays: 3, exitReason: 'Take Profit', isWin: true
        });
        expect(metrics).toMatchObject({
            totalTrades: 1, completedTrades: 1, openTrades: 0, wins: 1, losses: 0, winRate: 100, totalReturn: 8, avgReturn: 8
        });
    });

    test('stop: 95.01, then 95 on bar 9 -> Stop Loss -5 after 2 days', () => {
        const stock = simStock(20);
        Object.assign(stock.close, { 8: 95.01, 9: 95 });
        const { trades, metrics } = SimEngine.runBacktest(stock, SIM);
        expect(trades[0]).toMatchObject({ exitDate: simDay(9), exitPrice: 95, plPercent: -5, exitReason: 'Stop Loss', isWin: false });
        expect(metrics).toMatchObject({ wins: 0, losses: 1, winRate: 0 });
    });

    test('time: 30 calendar days after the entry, at that day\'s close; a P/L of exactly 0 is a loss', () => {
        const stock = simStock(40);
        stock.close[37] = 103;
        expect(SimEngine.runBacktest(stock, SIM).trades[0]).toMatchObject({
            exitDate: simDay(37), exitPrice: 103, plPercent: 3, holdingDays: 30, exitReason: 'Max Days', isWin: true
        });

        const flat = SimEngine.runBacktest(simStock(40), SIM);
        expect(flat.trades[0]).toMatchObject({ exitDate: simDay(37), plPercent: 0, exitReason: 'Max Days', isWin: false });
        expect(flat.metrics).toMatchObject({ completedTrades: 1, wins: 0, losses: 1, winRate: 0 });
    });

    test('its own fourth exit: the 7-day DTI turning from above 0 to 0 or below (the scan\'s engine has none)', () => {
        const stock = simStockTurningDown(24);
        stock.close[14] = 102;
        const { trades } = SimEngine.runBacktest(stock, SIM);
        expect(trades).toHaveLength(1);
        expect(trades[0]).toMatchObject({
            exitDate: simDay(14), exitPrice: 102, plPercent: 2, holdingDays: 7, exitReason: '7-Day DTI Exit', exit7DayDTI: 0
        });
    });

    test('an open trade is listed but not counted in the win rate', () => {
        expect(SimEngine.runBacktest(simStock(20), SIM).metrics).toMatchObject({
            totalTrades: 1, completedTrades: 0, openTrades: 1, wins: 0, losses: 0, winRate: 0
        });
    });
});

describe('the Simulator\'s engine: a bar without a close (Yahoo sends null, which the pages parse as NaN)', () => {
    test('a time exit that falls on it is booked at the next close, not as a NaN P/L', () => {
        const stock = simStock(40);
        stock.close[37] = NaN;
        stock.close[38] = 102;
        const { trades, metrics } = SimEngine.runBacktest(stock, SIM);
        expect(trades).toHaveLength(1);
        expect(trades[0]).toMatchObject({
            exitDate: simDay(38), exitPrice: 102, plPercent: 2, holdingDays: 31, exitReason: 'Max Days', isWin: true
        });
        expect(metrics).toMatchObject({ completedTrades: 1, wins: 1, winRate: 100, totalReturn: 2, avgReturn: 2 });
    });

    test('no trade opens on it: the chart\'s only turn falls on a bar without a close, so there is no trade', () => {
        const stock = simStock(40);
        stock.close[7] = NaN;
        expect(SimEngine.runBacktest(stock, SIM).trades).toEqual([]);
    });

    test('a 7-day DTI turn on it still exits, at the next close', () => {
        const stock = simStockTurningDown(24);
        stock.close[14] = NaN;
        stock.close[15] = 101;
        const { trades } = SimEngine.runBacktest(stock, SIM);
        expect(trades).toHaveLength(1);
        expect(trades[0]).toMatchObject({ exitDate: simDay(15), exitPrice: 101, plPercent: 1, holdingDays: 8, exitReason: '7-Day DTI Exit' });
    });

    test('an open trade is valued at the last close there is', () => {
        const stock = simStock(20);
        stock.close[17] = 102;
        stock.close[18] = NaN;
        stock.close[19] = NaN;
        const { trades, metrics } = SimEngine.runBacktest(stock, SIM);
        expect(trades[0]).toMatchObject({
            exitDate: simDay(17), exitPrice: 102, plPercent: 2, holdingDays: 10, exitReason: 'Open', isOpen: true
        });
        expect(Number.isNaN(metrics.avgReturn)).toBe(false);
    });
});

// ------------------------------------------------------------------------------------ which signals count as recent

describe('isWithinTradingDays: the scan keeps a signal from today or the trading day before', () => {
    const MON_21_SEP = new Date(2026, 8, 21);
    const THU_24_SEP = new Date(2026, 8, 24);

    test('on a Monday: Monday and the Friday before are recent, the Thursday is not', () => {
        expect(SimEngine.isWithinTradingDays(new Date(2026, 8, 21), 2, MON_21_SEP)).toBe(true);
        expect(SimEngine.isWithinTradingDays(new Date(2026, 8, 18), 2, MON_21_SEP)).toBe(true);
        expect(SimEngine.isWithinTradingDays(new Date(2026, 8, 17), 2, MON_21_SEP)).toBe(false);
    });

    test('on a Thursday: Wednesday is recent, Tuesday is not, and a later date never is', () => {
        expect(SimEngine.isWithinTradingDays(new Date(2026, 8, 23), 2, THU_24_SEP)).toBe(true);
        expect(SimEngine.isWithinTradingDays(new Date(2026, 8, 22), 2, THU_24_SEP)).toBe(false);
        expect(SimEngine.isWithinTradingDays(new Date(2026, 8, 25), 2, THU_24_SEP)).toBe(false);
    });
});
