/**
 * @jest-environment node
 *
 * POST /api/trades/bulk (TradeDB.bulkInsertTrades) keeps what an imported trade says (I53). The Positions
 * page's Import sends the file Export everything saves, which is GET /api/trades (TradeDB.getAllTrades), back
 * to the bulk route. Until 2026-09-25 that INSERT wrote 17 columns: a sold trade came back without its exit
 * reason, market, currency symbol, stock name, entry reason, take-profit or planned exit, its investment amount
 * moved to position_size, its entry reason to notes, and an open trade's square-off date became its exit date.
 *
 * Over a mocked driver: a trade as GET /api/trades returns it goes through bulkInsertTrades, the row that INSERT
 * writes is read back through getAllTrades, and every field a manual trade carries comes back as it was; each
 * column holds what insertTrade (POST /api/trades) stores for the same trade; and what the server decides
 * (auto_added, user_id, strategy_version) is never the file's. The INSERT on a real Postgres is run by the
 * endpoint harness (tests/endpoints/specs/trading.json, POST /api/trades/bulk).
 */
jest.mock('pg', () => {
    const query = jest.fn();
    const connect = jest.fn();
    return { Pool: jest.fn(() => ({ query, connect })), __query: query, __connect: connect };
});

const { STRATEGY_VERSION } = require('../../lib/shared/strategy-version');

const squash = sql => String(sql).replace(/\s+/g, ' ').trim();

// An INSERT INTO trades as { column: the value sent for it }
function columnsOf(sql, params) {
    const found = squash(sql).match(/INSERT INTO trades \(([^)]*)\) VALUES \(([^)]*)\)/);
    const columns = found[1].split(',').map(c => c.trim());
    const values = found[2].split(',').map(v => v.trim());
    expect(values).toHaveLength(columns.length);
    return Object.fromEntries(columns.map((column, i) => [column, params[Number(values[i].slice(1)) - 1]]));
}

// A sold trade as GET /api/trades returns it (the Export everything file), with the fields the server decides
const EXPORTED = {
    id: 7, strategyVersion: 'v0-forged', benchmarkSymbol: '^NSEI', benchmarkReturnPercent: 1.5,
    symbol: 'TCS.NS', name: 'Tata Consultancy Services', stockName: 'Tata Consultancy', stockIndex: 'nifty50',
    market: 'India', currencySymbol: '₹', status: 'closed',
    entryDate: '2026-09-01T09:00:00.000Z', entryPrice: 3500, shares: 14, investmentAmount: 49000, positionSize: 49000,
    targetPrice: 3780, stopLossPercent: 5, takeProfitPercent: 8, squareOffDate: '2026-10-01T09:00:00.000Z',
    exitDate: '2026-09-10T09:00:00.000Z', exitPrice: 3780, exitReason: 'Target hit: +8.00%',
    profitLoss: 3920, profitLossPercentage: 8, entryReason: 'DTI buy signal', notes: 'first lot',
    autoAdded: true, user_id: 'someone-else@e2e.invalid', created_at: '2026-09-01T09:00:00.000Z',
    winRate: 81, historicalSignalCount: 12, tradeSize: 49000, entryDTI: -42.5
};

// Every field a trade entered by hand carries (the add-position form and the Sell dialog)
const KEPT = ['symbol', 'name', 'stockName', 'stockIndex', 'market', 'currencySymbol', 'status', 'entryDate', 'entryPrice',
    'shares', 'investmentAmount', 'positionSize', 'targetPrice', 'stopLossPercent', 'takeProfitPercent', 'squareOffDate',
    'exitDate', 'exitPrice', 'exitReason', 'profitLoss', 'profitLossPercentage', 'entryReason', 'notes'];
const pick = (object, keys) => Object.fromEntries(keys.map(key => [key, object[key]]));

describe('bulkInsertTrades over a mocked driver', () => {
    let TradeDB;
    let pgQuery;
    let pgConnect;

    beforeAll(async () => {
        const pg = require('pg');
        pgQuery = pg.__query;
        pgConnect = pg.__connect;
        pgQuery.mockResolvedValue({ rows: [], rowCount: 0 });
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});

        const previousUrl = process.env.DATABASE_URL;
        process.env.DATABASE_URL = 'postgres://unit-test/none';
        TradeDB = require('../../database-postgres');
        if (previousUrl === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = previousUrl;

        // It runs its boot schema block as it loads: let that drain against the mocked driver first
        let seen;
        do {
            seen = pgQuery.mock.calls.length;
            await new Promise(resolve => setTimeout(resolve, 0));
        } while (pgQuery.mock.calls.length !== seen);
    });

    // No rule switch on: the stamp is the bare version
    const SWITCH_ENV = ['PRICE_UNIT_REPAIR', 'STALE_FILL_REPAIR', 'AI_CONVICTION_GATE', 'MAX_ENTRY_DRIFT_PERCENT', 'SKIP_DEAD_TICKERS'];
    let savedSwitches;
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        savedSwitches = SWITCH_ENV.map(name => [name, process.env[name]]);
        for (const name of SWITCH_ENV) delete process.env[name];
    });
    afterEach(() => {
        for (const [name, value] of savedSwitches) {
            if (value === undefined) delete process.env[name];
            else process.env[name] = value;
        }
    });

    // The columns bulkInsertTrades writes for each trade, in order
    async function bulkColumns(trades, userId = 'owner@e2e.invalid') {
        const clientQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 1 });
        const release = jest.fn();
        pgConnect.mockResolvedValue({ query: clientQuery, release });
        const count = await TradeDB.bulkInsertTrades(trades, userId);
        expect(count).toBe(trades.length);
        expect(clientQuery.mock.calls.map(([sql]) => squash(sql).split(' ')[0])).toEqual(['BEGIN', ...trades.map(() => 'INSERT'), 'COMMIT']);
        expect(release).toHaveBeenCalledTimes(1);
        return clientQuery.mock.calls.filter(([sql]) => /INSERT INTO trades/.test(sql)).map(([sql, params]) => columnsOf(sql, params));
    }

    test('a sold trade exported by GET /api/trades imports back with every field a manual trade carries', async () => {
        const [row] = await bulkColumns([{ ...EXPORTED }]);
        // read the row that INSERT writes back through GET /api/trades
        pgQuery.mockReset();
        pgQuery.mockResolvedValue({ rows: [{ ...row, id: '99', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
        const [back] = await TradeDB.getAllTrades('owner@e2e.invalid');
        expect(pick(back, KEPT)).toEqual(pick(EXPORTED, KEPT));
        // the server's own: a manual trade of the caller's, stamped with the rules' version now
        expect(back).toMatchObject({ autoAdded: false, user_id: 'owner@e2e.invalid', strategyVersion: STRATEGY_VERSION, benchmarkSymbol: null });
    });

    test('each column holds what insertTrade (POST /api/trades) stores for the same trade', async () => {
        const [bulk] = await bulkColumns([{ ...EXPORTED }]);
        pgQuery.mockReset();
        pgQuery.mockResolvedValue({ rows: [{ id: '1', symbol: 'TCS.NS', entry_price: '3500' }], rowCount: 1 });
        // what POST /api/trades hands it: the body, spread, with autoAdded false
        await TradeDB.insertTrade({ ...EXPORTED, autoAdded: false }, 'owner@e2e.invalid');
        const single = columnsOf(...pgQuery.mock.calls[0]);
        expect(Object.keys(bulk)).toEqual(['symbol', 'name', 'stock_name', 'stock_index', 'market', 'currency_symbol',
            'entry_date', 'entry_price', 'shares', 'investment_amount', 'position_size', 'stop_loss_percent',
            'take_profit_percent', 'target_price', 'square_off_date', 'exit_date', 'exit_price', 'status', 'profit_loss',
            'profit_loss_percentage', 'entry_reason', 'exit_reason', 'notes', 'auto_added', 'user_id', 'strategy_version']);
        expect(bulk).toEqual(pick(single, Object.keys(bulk)));
    });

    test('what the server decides is never the file\'s: owner, automatic or not, the rules\' version, the signal fields', async () => {
        const [row] = await bulkColumns([{ ...EXPORTED }], 'owner@e2e.invalid');
        expect(row).toMatchObject({ auto_added: false, user_id: 'owner@e2e.invalid', strategy_version: STRATEGY_VERSION });
        const values = Object.values(row);
        for (const forged of ['someone-else@e2e.invalid', 'v0-forged', '^NSEI', 81, 12, -42.5]) expect(values).not.toContain(forged);
        for (const column of ['id', 'win_rate', 'historical_signal_count', 'trade_size', 'entry_dti', 'benchmark_symbol', 'created_at']) {
            expect(Object.keys(row)).not.toContain(column);
        }
    });

    test('an open trade keeps its planned exit in square_off_date, never as an exit date; amounts go where insertTrade puts them', async () => {
        const [open, onlyAmount, onlySize, onlyName] = await bulkColumns([
            { symbol: 'NVDA', status: 'active', entryDate: '2026-09-22T14:00:00.000Z', entryPrice: 125, shares: 4,
                investmentAmount: 500, positionSize: 500, squareOffDate: '2026-10-22T14:00:00.000Z' },
            { symbol: 'A.L', entryDate: '2026-09-01', entryPrice: 10, investmentAmount: 400 },
            { symbol: 'B.L', entryDate: '2026-09-02', entryPrice: 20, positionSize: 300 },
            { symbol: 'C.L', entryDate: '2026-09-03', entryPrice: 30, name: 'Charlie plc' }
        ]);
        expect(open).toMatchObject({ status: 'active', square_off_date: '2026-10-22T14:00:00.000Z', exit_date: null, exit_price: null,
            exit_reason: null, investment_amount: 500, position_size: 500, shares: 4 });
        expect(onlyAmount).toMatchObject({ investment_amount: 400, position_size: 400, status: 'active', market: null });
        expect(onlySize).toMatchObject({ investment_amount: null, position_size: 300 });
        expect(onlyName).toMatchObject({ name: 'Charlie plc', stock_name: null });
    });

    test('a refused row rolls the whole import back', async () => {
        const failure = Object.assign(new Error('value too long for type character varying(10)'), { code: '22001' });
        const clientQuery = jest.fn(async sql => {
            if (/INSERT INTO trades/.test(sql) && clientQuery.mock.calls.filter(([s]) => /INSERT/.test(s)).length === 2) throw failure;
            return { rows: [], rowCount: 1 };
        });
        const release = jest.fn();
        pgConnect.mockResolvedValue({ query: clientQuery, release });
        await expect(TradeDB.bulkInsertTrades([{ ...EXPORTED }, { ...EXPORTED, currencySymbol: 'x'.repeat(11) }], 'owner@e2e.invalid'))
            .rejects.toBe(failure);
        expect(clientQuery.mock.calls.map(([sql]) => squash(sql).split(' ')[0])).toEqual(['BEGIN', 'INSERT', 'INSERT', 'ROLLBACK']);
        expect(release).toHaveBeenCalledTimes(1);
    });
});
