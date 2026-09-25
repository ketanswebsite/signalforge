/**
 * High-conviction exits: a re-entered symbol still closes, and alerts exactly once
 * (lib/portfolio/high-conviction-manager.js, TradeDB.closeHighConvictionTrade and
 *  TradeDB.updateHighConvictionTrade)
 *
 * high_conviction_portfolio.symbol is not unique — a symbol can be booked again
 * after its earlier position has closed, and nothing in the schema stops two
 * ACTIVE rows in one symbol (GET /api/ops/exit-checks-stats counts them). A
 * symbol does not identify a position, so every write the pass makes — the
 * price refresh and the close — is keyed by the portfolio ROW.
 *
 * The guard that prevents duplicate exit alerts is the close itself: one
 * UPDATE, keyed by the row, that only matches a row still 'active'. Whoever
 * gets the row back sends the alert; everybody else gets nothing and stays quiet.
 */

jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('../../lib/telegram/telegram-bot', () => ({
    broadcastToSubscribers: jest.fn()
}));
jest.mock('pg', () => {
    const query = jest.fn();
    return { Pool: jest.fn(() => ({ query })), __query: query };
});
jest.mock('../../database-postgres', () => ({
    pool: { query: jest.fn() },
    getActiveHighConvictionTrades: jest.fn(),
    updateHighConvictionTrade: jest.fn(),
    closeHighConvictionTrade: jest.fn()
}));

const TradeDB = require('../../database-postgres');
const { broadcastToSubscribers } = require('../../lib/telegram/telegram-bot');
const HighConvictionPortfolioManager = require('../../lib/portfolio/high-conviction-manager');

const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = days => new Date(Date.now() + days * DAY_MS).toISOString().split('T')[0];

function position(overrides) {
    return {
        id: 1,
        symbol: 'AAPL',
        name: 'Apple Inc.',
        market: 'US',
        currency_symbol: '$',
        signal_date: daysFromNow(-3),
        entry_date: daysFromNow(-3),
        entry_price: '100.0000',
        current_price: '100.0000',
        target_price: '108.0000',
        stop_loss_price: '95.0000',
        square_off_date: daysFromNow(27),
        shares: '3.000000',
        status: 'active',
        exit_date: null,
        exit_price: null,
        exit_reason: null,
        pl_percent: null,
        ...overrides
    };
}

/**
 * high_conviction_portfolio in memory.
 *   portfolio   its rows
 *   statements  every SQL string sent through pool.query
 *   beforeClose runs just before a close is applied (lets a test lose a race)
 */
function fakeDatabase(portfolio) {
    const db = { portfolio, statements: [], beforeClose: null };

    TradeDB.pool.query.mockImplementation(async sql => {
        db.statements.push(sql);
        // pending_signals verdict lookup: no AI-rejected signal for any of these
        return { rows: [] };
    });

    TradeDB.getActiveHighConvictionTrades.mockImplementation(async () =>
        db.portfolio.filter(row => row.status === 'active').map(row => ({ ...row })));

    // WHERE id = $6 AND status = 'active' RETURNING *, like the close below
    TradeDB.updateHighConvictionTrade.mockImplementation(async (tradeId, update) => {
        const row = db.portfolio.find(r => r.id === tradeId && r.status === 'active');
        if (!row) return undefined;
        Object.assign(row, {
            current_price: update.currentPrice,
            pl_percent: update.plPercent,
            pl_amount_gbp: update.plAmountGBP,
            pl_amount_inr: update.plAmountINR,
            pl_amount_usd: update.plAmountUSD
        });
        return { ...row };
    });

    // WHERE id = $8 AND status = 'active' RETURNING * (the SQL itself is pinned
    // in the last describe block, against the real module)
    TradeDB.closeHighConvictionTrade.mockImplementation(async (tradeId, exitData) => {
        if (db.beforeClose) db.beforeClose(tradeId);
        const row = db.portfolio.find(r => r.id === tradeId && r.status === 'active');
        if (!row) return undefined;
        Object.assign(row, {
            status: 'closed',
            exit_date: exitData.exitDate,
            exit_price: exitData.exitPrice,
            exit_reason: exitData.exitReason,
            pl_percent: exitData.plPercent,
            current_price: exitData.exitPrice
        });
        return { ...row };
    });

    return db;
}

/** A manager whose price feed is a plain lookup table. */
function managerWithPrices(prices) {
    const manager = new HighConvictionPortfolioManager();
    jest.spyOn(manager, 'fetchCurrentPrice').mockImplementation(async symbol => prices[symbol]);
    return manager;
}

// The earlier, finished position in the same symbol
const EARLIER_AAPL = () => position({
    id: 1,
    signal_date: daysFromNow(-60),
    entry_date: daysFromNow(-60),
    entry_price: '80.0000',
    status: 'closed',
    exit_date: daysFromNow(-45),
    exit_price: '86.4000',
    exit_reason: 'Take Profit (8%)',
    pl_percent: '8.0000'
});

beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    broadcastToSubscribers.mockResolvedValue([{ chatId: 1 }, { chatId: 2 }]);
});

describe('A re-entered symbol', () => {
    test('the second position closes and alerts exactly once', async () => {
        const db = fakeDatabase([EARLIER_AAPL(), position({ id: 2, entry_price: '100.0000' })]);
        const manager = managerWithPrices({ AAPL: 108 });

        const firstPass = await manager.updateAllActiveTrades();

        expect(firstPass.closed).toBe(1);
        expect(TradeDB.closeHighConvictionTrade).toHaveBeenCalledTimes(1);
        expect(TradeDB.closeHighConvictionTrade).toHaveBeenCalledWith(
            2, expect.objectContaining({ exitPrice: 108, exitReason: 'Take Profit (8%)' }));
        expect(db.portfolio[1]).toMatchObject({ id: 2, status: 'closed', exit_price: 108 });
        expect(broadcastToSubscribers).toHaveBeenCalledTimes(1);
        expect(broadcastToSubscribers.mock.calls[0][0].message).toMatch(/PROFIT TARGET REACHED[\s\S]*AAPL/);

        // Later passes: the row is no longer active, so there is nothing to
        // close and nothing to announce
        const secondPass = await manager.updateAllActiveTrades();
        await manager.updateAllActiveTrades();

        expect(secondPass.closed).toBe(0);
        expect(TradeDB.closeHighConvictionTrade).toHaveBeenCalledTimes(1);
        expect(broadcastToSubscribers).toHaveBeenCalledTimes(1);
    });

    test('the earlier position is left exactly as it was closed', async () => {
        const db = fakeDatabase([EARLIER_AAPL(), position({ id: 2 })]);

        await managerWithPrices({ AAPL: 108 }).updateAllActiveTrades();

        expect(db.portfolio[0]).toEqual(EARLIER_AAPL());
    });

    test('a stop-loss exit on the re-entry closes too', async () => {
        fakeDatabase([EARLIER_AAPL(), position({ id: 2 })]);

        const result = await managerWithPrices({ AAPL: 94 }).updateAllActiveTrades();

        expect(result.closed).toBe(1);
        expect(broadcastToSubscribers).toHaveBeenCalledTimes(1);
        expect(broadcastToSubscribers.mock.calls[0][0].message).toMatch(/STOP LOSS HIT/);
    });

    test('and so does a max-days exit', async () => {
        fakeDatabase([EARLIER_AAPL(), position({ id: 2, entry_date: daysFromNow(-31), square_off_date: daysFromNow(-1) })]);

        const result = await managerWithPrices({ AAPL: 101 }).updateAllActiveTrades();

        expect(result.closed).toBe(1);
        expect(broadcastToSubscribers).toHaveBeenCalledTimes(1);
        expect(broadcastToSubscribers.mock.calls[0][0].message).toMatch(/TIME SQUARE OFF/);
    });
});

describe('The close is the duplicate-alert guard', () => {
    test('losing the race to another closer sends no alert', async () => {
        // e.g. the admin's manual close, or the outgoing instance during a deploy
        const db = fakeDatabase([position({ id: 2 })]);
        db.beforeClose = tradeId => { db.portfolio.find(r => r.id === tradeId).status = 'closed'; };

        const result = await managerWithPrices({ AAPL: 108 }).updateAllActiveTrades();

        expect(TradeDB.closeHighConvictionTrade).toHaveBeenCalledTimes(1);
        expect(broadcastToSubscribers).not.toHaveBeenCalled();
        expect(result.closed).toBe(0);
        expect(result.closures).toEqual([]);
    });

    test('a close is keyed by the portfolio row, never by the symbol', async () => {
        // Two ACTIVE rows in one symbol should not happen (the booking path
        // refuses it), but that is an application rule, not a constraint. Only
        // the row whose own numbers hit the exit may be closed.
        const db = fakeDatabase([
            position({ id: 2, entry_price: '100.0000' }),
            position({ id: 3, entry_price: '107.0000', signal_date: daysFromNow(-1), entry_date: daysFromNow(-1) })
        ]);

        const result = await managerWithPrices({ AAPL: 108 }).updateAllActiveTrades();

        expect(result.closed).toBe(1);
        expect(TradeDB.closeHighConvictionTrade).toHaveBeenCalledTimes(1);
        expect(TradeDB.closeHighConvictionTrade.mock.calls[0][0]).toBe(2);
        expect(db.portfolio.map(r => [r.id, r.status])).toEqual([[2, 'closed'], [3, 'active']]);
        expect(broadcastToSubscribers).toHaveBeenCalledTimes(1);
    });

    test('a close that throws is retried by the next pass and then alerts once', async () => {
        const db = fakeDatabase([position({ id: 2 })]);
        const manager = managerWithPrices({ AAPL: 108 });
        TradeDB.closeHighConvictionTrade.mockRejectedValueOnce(new Error('connection terminated'));

        const failedPass = await manager.updateAllActiveTrades();

        expect(failedPass.closed).toBe(0);
        expect(db.portfolio[0].status).toBe('active');
        expect(broadcastToSubscribers).not.toHaveBeenCalled();

        const retryPass = await manager.updateAllActiveTrades();

        expect(retryPass.closed).toBe(1);
        expect(db.portfolio[0].status).toBe('closed');
        expect(broadcastToSubscribers).toHaveBeenCalledTimes(1);
    });

    test('a failed Telegram broadcast does not reopen or re-announce the position', async () => {
        const db = fakeDatabase([position({ id: 2 })]);
        const manager = managerWithPrices({ AAPL: 108 });
        broadcastToSubscribers.mockRejectedValueOnce(new Error('telegram down'));

        const result = await manager.updateAllActiveTrades();
        await manager.updateAllActiveTrades();

        expect(result.closed).toBe(1);
        expect(db.portfolio[0].status).toBe('closed');
        expect(broadcastToSubscribers).toHaveBeenCalledTimes(1);
    });
});

describe('A price refresh is keyed by the portfolio row too', () => {
    // Two ACTIVE rows in one symbol, neither at an exit at 104: row 2 is up 4%,
    // row 3 (bought at 107 a day later) is down 2.8%. Keyed by symbol, each
    // refresh rewrote both rows, and both ended the pass showing row 3's P&L.
    const twoOpenRows = () => [
        position({ id: 2, entry_price: '100.0000' }),
        position({ id: 3, entry_price: '107.0000', signal_date: daysFromNow(-1), entry_date: daysFromNow(-1) })
    ];

    test('two open rows in one symbol each keep their own price and P&L', async () => {
        const db = fakeDatabase(twoOpenRows());

        const result = await managerWithPrices({ AAPL: 104 }).updateAllActiveTrades();

        expect(result).toMatchObject({ updated: 2, closed: 0 });
        expect(TradeDB.updateHighConvictionTrade.mock.calls.map(([tradeId]) => tradeId)).toEqual([2, 3]);
        const [first, second] = db.portfolio;
        expect(first).toMatchObject({ id: 2, status: 'active', current_price: 104 });
        expect(first.pl_percent).toBeCloseTo(4, 6);
        expect(second).toMatchObject({ id: 3, status: 'active', current_price: 104 });
        expect(second.pl_percent).toBeCloseTo((104 - 107) / 107 * 100, 6);
        expect(broadcastToSubscribers).not.toHaveBeenCalled();
    });

    test('and each keeps its own money P&L', async () => {
        const db = fakeDatabase(twoOpenRows());

        await managerWithPrices({ AAPL: 104 }).updateAllActiveTrades();

        // 3 shares each: +$12 on row 2, -$9 on row 3
        expect(db.portfolio[0].pl_amount_usd).toBeCloseTo(12, 6);
        expect(db.portfolio[1].pl_amount_usd).toBeCloseTo(-9, 6);
    });

    test('a pass sends no SQL of its own but the verdict lookup and the exchange-rate read: every write is a row-keyed TradeDB call', async () => {
        const db = fakeDatabase([
            EARLIER_AAPL(),
            ...twoOpenRows(),
            position({ id: 4, symbol: 'DIXON.NS', name: 'Dixon', market: 'India', currency_symbol: '₹' }),
            position({ id: 5, symbol: 'MER.L', name: 'Mears', market: 'UK', currency_symbol: '£' })
        ]);
        // MER.L is closed elsewhere just before this pass closes it: the pass loses the race
        db.beforeClose = tradeId => { if (tradeId === 5) db.portfolio.find(r => r.id === 5).status = 'closed'; };

        await managerWithPrices({ AAPL: 104, 'DIXON.NS': 101, 'MER.L': 94 }).updateAllActiveTrades();
        await managerWithPrices({ AAPL: 108, 'DIXON.NS': 101, 'MER.L': 94 }).updateAllActiveTrades();

        expect(db.portfolio.map(r => [r.id, r.status])).toEqual([[1, 'closed'], [2, 'closed'], [3, 'active'], [4, 'active'], [5, 'closed']]);
        expect(broadcastToSubscribers).toHaveBeenCalledTimes(1);
        expect(db.statements.length).toBeGreaterThan(0);
        // lib/shared/fx-rates.js reads the dated exchange rates the P&L is converted at (GAPS #11): a SELECT, nothing else
        expect(db.statements.filter(sql => !/FROM (pending_signals|fx_rates)\b/.test(sql))).toEqual([]);
        expect(db.statements.filter(sql => /fx_rates/.test(sql) && !/^\s*SELECT\b/.test(sql))).toEqual([]);
    });
});

describe('TradeDB — the SQL behind the pass', () => {
    // The real module, over a mocked pg driver
    let RealTradeDB;
    let pgQuery;

    beforeAll(async () => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        pgQuery = require('pg').__query;
        pgQuery.mockResolvedValue({ rows: [] });

        const previousUrl = process.env.DATABASE_URL;
        process.env.DATABASE_URL = 'postgres://unit-test/none';
        RealTradeDB = jest.requireActual('../../database-postgres');
        if (previousUrl === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = previousUrl;

        // The module runs its boot-time schema block as it loads. Let that
        // drain against the mocked driver so it cannot interleave with a test
        let seen;
        do {
            seen = pgQuery.mock.calls.length;
            await new Promise(resolve => setTimeout(resolve, 0));
        } while (pgQuery.mock.calls.length !== seen);
    });

    beforeEach(() => {
        pgQuery.mockReset();
    });

    const exitData = {
        exitDate: '2026-09-19', exitPrice: 108, exitReason: 'Take Profit (8%)',
        plPercent: 8, plAmountGBP: 18.9, plAmountINR: 1992, plAmountUSD: 24
    };

    test('closes one row by id, and only while it is still active', async () => {
        pgQuery.mockResolvedValue({ rows: [{ id: 2, symbol: 'AAPL', status: 'closed' }] });

        const closedRow = await RealTradeDB.closeHighConvictionTrade(2, exitData);

        expect(closedRow).toEqual({ id: 2, symbol: 'AAPL', status: 'closed' });
        expect(pgQuery).toHaveBeenCalledTimes(1);
        const [sql, params] = pgQuery.mock.calls[0];
        expect(sql).toMatch(/UPDATE high_conviction_portfolio/);
        expect(sql).toMatch(/WHERE id = \$8 AND status = 'active'/);
        expect(sql).not.toMatch(/symbol/);
        expect(sql).toMatch(/RETURNING \*/);
        expect(params[7]).toBe(2);
        expect(params).toHaveLength(8);
    });

    test('reports nothing closed when the row was no longer active', async () => {
        pgQuery.mockResolvedValue({ rows: [] });

        expect(await RealTradeDB.closeHighConvictionTrade(2, exitData)).toBeUndefined();
    });

    const refresh = { currentPrice: 104, plPercent: 4, plAmountGBP: 9.48, plAmountINR: 996, plAmountUSD: 12 };

    test('a price refresh updates one row by id, and only while it is still active', async () => {
        pgQuery.mockResolvedValue({ rows: [{ id: 3, symbol: 'AAPL', status: 'active' }] });

        const refreshedRow = await RealTradeDB.updateHighConvictionTrade(3, refresh);

        expect(refreshedRow).toEqual({ id: 3, symbol: 'AAPL', status: 'active' });
        expect(pgQuery).toHaveBeenCalledTimes(1);
        const [sql, params] = pgQuery.mock.calls[0];
        expect(sql).toMatch(/UPDATE high_conviction_portfolio/);
        expect(sql).toMatch(/WHERE id = \$6 AND status = 'active'/);
        expect(sql).not.toMatch(/symbol/);
        expect(params).toEqual([104, 4, 9.48, 996, 12, 3]);
    });

    test('a refresh of a row closed in the meantime changes nothing and reports nothing', async () => {
        pgQuery.mockResolvedValue({ rows: [] });

        expect(await RealTradeDB.updateHighConvictionTrade(3, refresh)).toBeUndefined();
    });
});
