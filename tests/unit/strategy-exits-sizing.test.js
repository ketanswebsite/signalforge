/**
 * GAPS #17: the rules that move paper money, pinned with numbers worked out by hand.
 *
 *   lib/portfolio/exit-monitor.js checkTradeExit    when an open position closes: +8% target, -5% stop, 30 days
 *                                                   held, or its square-off date, judged in that order
 *   lib/portfolio/capital-manager.js                how big a new position is, and when there is no room for it
 *   lib/scheduler/trade-executor.js                 what the 1 PM executor books with that size: the live price,
 *                                                   within 3% of the signal's, and the target and stop anchored
 *                                                   to the price paid
 *
 * The database, Yahoo and Telegram are faked; the clock is set where a rule depends on it (only Date is faked).
 */
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../database-postgres', () => ({
    getPortfolioCapital: jest.fn(),
    getActiveTradeBySymbol: jest.fn(),
    allocateCapital: jest.fn(),
    releaseCapital: jest.fn(),
    insertTrade: jest.fn(),
    updateSignalStatus: jest.fn(),
    getAutoTradingUsers: jest.fn(),
    getAlertPreferences: jest.fn(),
    closeTradeAndRelease: jest.fn(),
    pool: { query: jest.fn() }
}));
jest.mock('../../lib/telegram/telegram-bot', () => ({ broadcastToSubscribers: jest.fn(), sendTelegramAlert: jest.fn() }));
jest.mock('../../ml/conviction-engine', () => ({ getConviction: jest.fn(), summarizeConviction: jest.fn(), fetchRecentHeadlines: jest.fn() }));
jest.mock('../../lib/push/push-service', () => jest.fn().mockImplementation(() => ({ isConfigured: false })));

const axios = require('axios');
const TradeDB = require('../../database-postgres');
const monitor = require('../../lib/portfolio/exit-monitor');
const CapitalManager = require('../../lib/portfolio/capital-manager');
const tradeExecutor = require('../../lib/scheduler/trade-executor');

const ADMIN = 'admin@e2e.invalid';
// Everything but Date keeps running for real, so the code's own awaits are untouched
const ONLY_DATE = ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame',
    'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval',
    'setTimeout', 'clearTimeout'];
const setClock = iso => jest.useFakeTimers({ now: new Date(iso), doNotFake: ONLY_DATE });

let savedAdmin;
beforeEach(() => {
    savedAdmin = process.env.ADMIN_EMAIL;
    process.env.ADMIN_EMAIL = ADMIN;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
    jest.useRealTimers();
    if (savedAdmin === undefined) delete process.env.ADMIN_EMAIL; else process.env.ADMIN_EMAIL = savedAdmin;
});

// ------------------------------------------------------------------------------------------------ the exit monitor

describe('the exit monitor\'s exit rules', () => {
    // Booked at 1 PM UK on 25 August: 4 shares at 100 (a 400 position)
    const BOOKED = '2026-08-25T13:00:00.000Z';
    const position = (extra = {}) => ({
        id: 7, symbol: 'TEST.L', market: 'UK', user_id: 'subscriber@e2e.invalid',
        entryPrice: 100, entryDate: new Date(BOOKED), shares: 4, ...extra
    });

    beforeEach(() => {
        jest.spyOn(monitor, 'recordExitCheck').mockResolvedValue();
        jest.spyOn(monitor, 'checkAlertSent').mockResolvedValue(false);
        jest.spyOn(monitor, 'closeTrade').mockImplementation(async trade => ({ id: trade.id }));
        jest.spyOn(monitor, 'sendExitAlert').mockResolvedValue();
        jest.spyOn(monitor, 'handleCloseRecovered').mockResolvedValue();
    });

    /** One check of `trade` at `iso`, with the live price at `price` */
    async function checkAt(iso, price, trade = position()) {
        setClock(iso);
        jest.spyOn(monitor, 'fetchCurrentPrice').mockResolvedValue(price);
        return monitor.checkTradeExit(trade);
    }

    test('target: +8% or more closes the position at the price polled', async () => {
        const result = await checkAt('2026-08-26T10:00:00.000Z', 108);
        expect(result).toMatchObject({
            shouldExit: true, exitType: 'target_reached', exitPrice: 108, plPercent: 8, exitReason: 'Target reached: +8.00%'
        });
        // P/L in money: (108 - 100) x 4 shares = 32
        expect(monitor.closeTrade).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }), 108, 8, 32, 'target_reached', 'Target reached: +8.00%');
    });

    test('stop: -5% or less closes it', async () => {
        const result = await checkAt('2026-08-26T10:00:00.000Z', 95);
        expect(result).toMatchObject({ shouldExit: true, exitType: 'stop_loss', plPercent: -5, exitReason: 'Stop loss hit: -5.00%' });
        // (95 - 100) x 4 = -20
        expect(monitor.closeTrade).toHaveBeenCalledWith(expect.anything(), 95, -5, -20, 'stop_loss', 'Stop loss hit: -5.00%');
    });

    test('just inside either line (107.99, 95.01) it stays open, and the check is recorded', async () => {
        expect(await checkAt('2026-08-26T10:00:00.000Z', 107.99)).toEqual({ shouldExit: false });
        expect(await checkAt('2026-08-26T10:00:00.000Z', 95.01)).toEqual({ shouldExit: false });
        expect(monitor.closeTrade).not.toHaveBeenCalled();
        // (trade id, price, P/L %, whole days held, no alert): 21 hours after booking is day 0
        const [id, price, plPercent, daysHeld, alertSent] = monitor.recordExitCheck.mock.calls[0];
        expect([id, price, daysHeld, alertSent]).toEqual([7, 107.99, 0, false]);
        expect(plPercent).toBeCloseTo(7.99, 10);
    });

    test('time: 30 whole days after the booking; a minute short is not enough', async () => {
        expect(await checkAt('2026-09-24T12:59:00.000Z', 101)).toEqual({ shouldExit: false });
        const result = await checkAt('2026-09-24T13:00:00.000Z', 101);
        expect(result).toMatchObject({ shouldExit: true, exitType: 'max_days', exitReason: 'Max holding period reached: 30 days' });
        expect(result.plPercent).toBeCloseTo(1, 10);
    });

    test('square-off: a stored square-off date closes the position from that date\'s midnight UTC', async () => {
        // The 1 PM executor stores the entry date + 30 days here, so a booked position meets this rule hours before
        // the 30-day one: at the first check after midnight UTC, when no market it trades in is open
        const booked = position({ squareOffDate: '2026-09-24' });
        expect(await checkAt('2026-09-23T23:59:00.000Z', 101, booked)).toEqual({ shouldExit: false });
        // 01:00 UTC on the 24th: 29 days held, but the date has come
        expect(await checkAt('2026-09-24T01:00:00.000Z', 101, booked))
            .toMatchObject({ shouldExit: true, exitType: 'square_off', exitReason: 'Square-off date reached' });
    });

    test('the order: target before stop before time; a price at the target on day 30 is a target exit', async () => {
        expect(await checkAt('2026-09-24T13:00:00.000Z', 108)).toMatchObject({ exitType: 'target_reached' });
        expect(await checkAt('2026-09-24T13:00:00.000Z', 95)).toMatchObject({ exitType: 'stop_loss' });
    });

    test('no live price: no decision, nothing recorded, nothing closed', async () => {
        expect(await checkAt('2026-08-26T10:00:00.000Z', null)).toEqual({ shouldExit: false });
        expect(monitor.recordExitCheck).not.toHaveBeenCalled();
        expect(monitor.closeTrade).not.toHaveBeenCalled();
    });
});

// ----------------------------------------------------------------------------------------------- position sizing

/** A paper ledger: each market's initial capital, realized P/L, available capital and open positions */
function ledger(markets) {
    const currency = { India: 'INR', UK: 'GBP', US: 'USD' };
    const out = {};
    for (const [market, m] of Object.entries(markets)) out[market] = { currency: currency[market], ...m };
    return out;
}

describe('position sizing (capital-manager.js calculateTradeSize)', () => {
    test('a tenth of the market\'s initial capital plus realized P/L', () => {
        // (1,000,000 + 23,692) / 10 = 102,369.2
        expect(CapitalManager.calculateTradeSize('India', ledger({ India: { initial: 1000000, realized: 23692 } })))
            .toBeCloseTo(102369.2, 6);
        // (4,000 + 250) / 10 = 425
        expect(CapitalManager.calculateTradeSize('UK', ledger({ UK: { initial: 4000, realized: 250 } }))).toBe(425);
    });

    test('never under a tenth of the standard size (UK 400 -> 40), and the standard size with no ledger row', () => {
        // (4,000 - 3,800) / 10 = 20, under the floor of 40
        expect(CapitalManager.calculateTradeSize('UK', ledger({ UK: { initial: 4000, realized: -3800 } }))).toBe(40);
        expect(CapitalManager.calculateTradeSize('US', {})).toBe(500);
    });
});

describe('room for a new position (capital-manager.js validateTradeEntry), checked in this order', () => {
    const roomy = extra => ledger({
        India: { initial: 1000000, realized: 23692, available: 500000, positions: 5 },
        UK: { initial: 4000, realized: 250, available: 4250, positions: 0 },
        US: { initial: 5000, realized: 0, available: 5000, positions: 0 },
        ...extra
    });
    const validate = async (capital, market = 'India', symbol = 'TEST.NS') => {
        TradeDB.getPortfolioCapital.mockResolvedValue(capital);
        return CapitalManager.validateTradeEntry(market, symbol, ADMIN);
    };
    beforeEach(() => TradeDB.getActiveTradeBySymbol.mockResolvedValue(null));

    test('room: the size is a tenth of initial plus realized, in the market\'s currency', async () => {
        const result = await validate(roomy());
        expect(result).toMatchObject({ valid: true, currency: 'INR' });
        expect(result.tradeSize).toBeCloseTo(102369.2, 6);
    });

    test('30 positions across the markets: full', async () => {
        const full = roomy({ UK: { initial: 4000, realized: 0, available: 4000, positions: 10 },
            US: { initial: 5000, realized: 0, available: 5000, positions: 15 } });
        expect(await validate(full)).toMatchObject({ valid: false, code: 'TOTAL_LIMIT', reason: 'Total portfolio limit reached (30/30)' });
    });

    test('no ledger row for the market', async () => {
        const noUS = roomy();
        delete noUS.US;
        expect(await validate(noUS, 'US', 'TEST')).toMatchObject({ valid: false, code: 'MARKET_NOT_FOUND' });
    });

    test('10 positions in the market: full, even with the capital short too', async () => {
        const tenIndia = roomy({ India: { initial: 1000000, realized: 23692, available: 1, positions: 10 } });
        expect(await validate(tenIndia)).toMatchObject({ valid: false, code: 'MARKET_LIMIT', reason: 'Market limit reached for India (10/10)' });
    });

    test('less available than one position: refused, with the shortfall', async () => {
        // Needs 102,369.2 with 100,654 available: 1,715.2 short. The size reads initial + realized; the check
        // reads what is still available.
        const short = roomy({ India: { initial: 1000000, realized: 23692, available: 100654, positions: 9 } });
        const result = await validate(short);
        expect(result).toMatchObject({ valid: false, code: 'INSUFFICIENT_CAPITAL' });
        expect(result.details.required).toBeCloseTo(102369.2, 6);
        expect(result.details.available).toBe(100654);
        expect(result.details.shortfall).toBeCloseTo(1715.2, 6);
    });

    test('the symbol already open in this account: refused, naming the open trade', async () => {
        TradeDB.getActiveTradeBySymbol.mockResolvedValue({ id: 99 });
        expect(await validate(roomy())).toMatchObject({ valid: false, code: 'DUPLICATE_POSITION', existingTradeId: 99 });
        expect(TradeDB.getActiveTradeBySymbol).toHaveBeenCalledWith('TEST.NS', ADMIN);
    });
});

// ------------------------------------------------------------------------------------------- the 1 PM executor

describe('what the 1 PM executor books (executeSingleSignal, the house book)', () => {
    // A UK signal at 100 with a stored GO verdict; the UK ledger sizes a position at (4,000 + 250) / 10 = 425
    const signal = {
        id: 7, symbol: 'TEST.L', market: 'UK', entry_price: '100', win_rate: '80', historical_signal_count: '12',
        signal_date: '2026-09-24', conviction_verdict: 'GO', conviction_score: '7',
        entry_dti: '-20', entry_7day_dti: '10', prev_dti: '-30', prev_7day_dti: '5'
    };
    const livePrice = price => axios.get.mockResolvedValue({
        data: { chart: { result: [{ meta: { regularMarketPrice: price }, indicators: { quote: [{ close: [price] }] } }] } }
    });

    beforeEach(() => {
        TradeDB.getPortfolioCapital.mockResolvedValue(ledger({
            India: { initial: 1000000, realized: 0, available: 1000000, positions: 0 },
            UK: { initial: 4000, realized: 250, available: 4250, positions: 0 },
            US: { initial: 5000, realized: 0, available: 5000, positions: 0 }
        }));
        TradeDB.getActiveTradeBySymbol.mockResolvedValue(null);
        TradeDB.allocateCapital.mockResolvedValue(true);
        TradeDB.updateSignalStatus.mockResolvedValue(true);
        TradeDB.insertTrade.mockResolvedValue({ id: 42 });
        setClock('2026-09-24T12:00:00.000Z');
    });

    test('3% above the signal price books at the live price, with the size the ledger allows', async () => {
        livePrice(103);
        const result = await tradeExecutor.executeSingleSignal(signal, 'UK');
        expect(result).toMatchObject({ success: true, tradeId: 42, tradeSize: 425, executionPrice: 103 });
        expect(TradeDB.allocateCapital).toHaveBeenCalledWith('UK', 425, ADMIN);
        const [trade, owner] = TradeDB.insertTrade.mock.calls[0];
        expect(owner).toBe(ADMIN);
        expect(trade).toMatchObject({
            symbol: 'TEST.L', entryPrice: 103, tradeSize: 425, stopLossPercent: 5, takeProfitPercent: 8,
            squareOffDate: '2026-10-24', autoAdded: true, status: 'active'
        });
        // The target is +8% on the price paid, not on the 7 AM signal price: 103 x 1.08 = 111.24
        expect(trade.targetPrice).toBeCloseTo(111.24, 10);
        expect(TradeDB.updateSignalStatus).toHaveBeenCalledWith(7, 'added', 42);
    });

    test('3% below books too; 3.01% either way is skipped and nothing is allocated', async () => {
        livePrice(97);
        expect(await tradeExecutor.executeSingleSignal(signal, 'UK')).toMatchObject({ success: true, executionPrice: 97 });

        TradeDB.allocateCapital.mockClear();
        for (const drifted of [103.01, 96.99]) {
            livePrice(drifted);
            expect(await tradeExecutor.executeSingleSignal(signal, 'UK')).toMatchObject({ success: false, code: 'PRICE_DRIFT' });
        }
        expect(TradeDB.allocateCapital).not.toHaveBeenCalled();
        expect(TradeDB.updateSignalStatus).toHaveBeenCalledWith(7, 'dismissed');
    });

    test('no live price: skipped, never booked at the signal\'s 7 AM price', async () => {
        axios.get.mockRejectedValue(new Error('timeout of 10000ms exceeded'));
        expect(await tradeExecutor.executeSingleSignal(signal, 'UK')).toMatchObject({ success: false, code: 'NO_LIVE_PRICE' });
        expect(TradeDB.allocateCapital).not.toHaveBeenCalled();
        expect(TradeDB.insertTrade).not.toHaveBeenCalled();
    });
});
