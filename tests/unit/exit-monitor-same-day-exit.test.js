/**
 * Exit monitor — a position can be closed on the day it was booked
 * (lib/portfolio/exit-monitor.js closeTrade → TradeDB.closeTradeAndRelease)
 *
 * trades.entry_date and trades.exit_date are TIMESTAMP columns, and the 1 PM
 * executor books entry_date with `new Date()`. closeTrade() used to send the
 * exit as a date-only string ("2026-09-18"), which a timestamp column promotes
 * to MIDNIGHT — before a same-day entry — so chk_trades_date_logic
 * (exit_date >= entry_date) rejected the UPDATE. closeTrade re-threw,
 * checkTradeExit swallowed it, nothing was recorded, and the monitor retried
 * every minute until the date rolled over: a stop or target hit on booking day
 * could not close. The exit monitor is the only closer of `trades` rows, so
 * nothing else covered it.
 *
 * The fake database below enforces the same ordering rule as the real CHECK
 * constraint, promoting a date-only string to midnight the way Postgres does,
 * so the old shape fails here the way it failed in production. The clock is
 * pinned so that "booked earlier today" can never straddle midnight.
 */

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('../../database-postgres', () => ({
    closeTradeAndRelease: jest.fn(),
    pool: { query: jest.fn() }
}));

const TradeDB = require('../../database-postgres');
const monitor = require('../../lib/portfolio/exit-monitor');

const BOOKED_AT_1PM = new Date('2026-09-18T13:00:05.000Z');
const STOP_HIT_SAME_AFTERNOON = new Date('2026-09-18T14:30:00.000Z');

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** What a TIMESTAMP column makes of the bound value. */
function asTimestampColumn(value) {
    if (typeof value === 'string' && DATE_ONLY.test(value)) {
        return new Date(`${value}T00:00:00.000Z`);
    }
    return new Date(value);
}

/** closeTradeAndRelease, reduced to the constraint that used to reject the close. */
function fakeCloseTradeAndRelease(trade) {
    return async (tradeId, exitData) => {
        if (asTimestampColumn(exitData.exitDate) < trade.entryDate) {
            throw new Error('new row for relation "trades" violates check constraint "chk_trades_date_logic"');
        }
        return { closed: true, released: true, trade: { id: tradeId } };
    };
}

function makeTrade(overrides = {}) {
    return {
        id: 42,
        symbol: 'TEST.L',
        market: 'UK',
        user_id: 'subscriber@example.com',
        entryPrice: 100,
        entryDate: BOOKED_AT_1PM,
        ...overrides
    };
}

const closeAtStop = trade => monitor.closeTrade(trade, 94.8, -5.2, -52, 'stop_loss', 'Stop loss hit: -5.20%');

beforeEach(() => {
    jest.useFakeTimers({ now: STOP_HIT_SAME_AFTERNOON });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.useRealTimers();
});

describe('Exit monitor — closing a position on the day it was booked', () => {
    test('the fake database rejects a date-only exit on the entry day, like the real constraint', async () => {
        const trade = makeTrade();
        const close = fakeCloseTradeAndRelease(trade);

        await expect(close(trade.id, { exitDate: '2026-09-18' })).rejects.toThrow(/chk_trades_date_logic/);
        await expect(close(trade.id, { exitDate: STOP_HIT_SAME_AFTERNOON })).resolves.toMatchObject({ closed: true });
    });

    test('a stop hit the same afternoon closes the position', async () => {
        const trade = makeTrade();
        TradeDB.closeTradeAndRelease.mockImplementation(fakeCloseTradeAndRelease(trade));

        await expect(closeAtStop(trade)).resolves.toEqual({ id: 42 });
    });

    test('the exit date reaches the database as a full timestamp, not a date-only string', async () => {
        const trade = makeTrade();
        TradeDB.closeTradeAndRelease.mockImplementation(fakeCloseTradeAndRelease(trade));

        await closeAtStop(trade);

        const { exitDate } = TradeDB.closeTradeAndRelease.mock.calls[0][1];
        expect(typeof exitDate).not.toBe('string');
        expect(exitDate).toBeInstanceOf(Date);
        expect(exitDate.getTime()).toBe(STOP_HIT_SAME_AFTERNOON.getTime());
        expect(exitDate.getTime()).toBeGreaterThanOrEqual(trade.entryDate.getTime());
    });

    test('the rest of the close is unchanged: same trade, same owner, same figures', async () => {
        const trade = makeTrade();
        TradeDB.closeTradeAndRelease.mockImplementation(fakeCloseTradeAndRelease(trade));

        await closeAtStop(trade);

        expect(TradeDB.closeTradeAndRelease).toHaveBeenCalledTimes(1);
        const [tradeId, exitData, userId] = TradeDB.closeTradeAndRelease.mock.calls[0];
        expect(tradeId).toBe(42);
        expect(userId).toBe('subscriber@example.com');
        expect(exitData).toMatchObject({
            exitPrice: 94.8,
            profitLoss: -52,
            profitLossPercent: -5.2,
            exitReason: 'Stop loss hit: -5.20%'
        });
    });
});
