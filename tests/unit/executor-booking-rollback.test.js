/**
 * The 1 PM executor allocates capital, then stores the trade: two statements. Until 2026-09-24 an insert that
 * failed left the allocation in the ledger with no trade behind it. Both booking passes now hand it back
 * (lib/scheduler/trade-executor.js releaseAllocation), and never when the trade was stored.
 */
const fs = require('fs');
const path = require('path');

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('../../database-postgres', () => ({
    getAutoTradingUsers: jest.fn(),
    allocateCapital: jest.fn(),
    releaseCapital: jest.fn(),
    insertTrade: jest.fn(),
    updateSignalStatus: jest.fn(),
    getAlertPreferences: jest.fn(),
    pool: { query: jest.fn() }
}));
jest.mock('../../lib/telegram/telegram-bot', () => ({ broadcastToSubscribers: jest.fn(), sendTelegramAlert: jest.fn() }));
jest.mock('../../lib/portfolio/capital-manager', () => ({ validateTradeEntry: jest.fn() }));
jest.mock('../../ml/conviction-engine', () => ({ getConviction: jest.fn(), summarizeConviction: jest.fn(), fetchRecentHeadlines: jest.fn() }));
jest.mock('../../lib/push/push-service', () => jest.fn().mockImplementation(() => ({ isConfigured: false })));

const axios = require('axios');
const TradeDB = require('../../database-postgres');
const CapitalManager = require('../../lib/portfolio/capital-manager');
const tradeExecutor = require('../../lib/scheduler/trade-executor');

const ADMIN = 'admin@e2e.invalid';
const SUBSCRIBER = 'subscriber@e2e.invalid';
const signal = {
    id: 7, symbol: 'TEST.L', market: 'UK', entry_price: '100', win_rate: '80', historical_signal_count: '12',
    signal_date: '2026-09-24', conviction_verdict: 'GO', conviction_score: '7',
    entry_dti: '1', entry_7day_dti: '1', prev_dti: '0', prev_7day_dti: '0'
};
let savedAdmin;

beforeEach(() => {
    savedAdmin = process.env.ADMIN_EMAIL;
    process.env.ADMIN_EMAIL = ADMIN;
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    CapitalManager.validateTradeEntry.mockResolvedValue({ valid: true, tradeSize: 1000, currency: 'GBP' });
    TradeDB.allocateCapital.mockResolvedValue(true);
    TradeDB.releaseCapital.mockResolvedValue(true);
    TradeDB.updateSignalStatus.mockResolvedValue(true);
    TradeDB.getAlertPreferences.mockResolvedValue(null);
    // the live 1 PM price, within the slippage guard
    axios.get.mockResolvedValue({ data: { chart: { result: [{ meta: { regularMarketPrice: 100.5 }, indicators: { quote: [{ close: [100.5] }] } }] } } });
});

afterEach(() => {
    if (savedAdmin === undefined) delete process.env.ADMIN_EMAIL; else process.env.ADMIN_EMAIL = savedAdmin;
    jest.restoreAllMocks();
});

describe('the house pass (executeSingleSignal)', () => {
    test('a failed insert hands the allocation back, and the booking fails', async () => {
        TradeDB.insertTrade.mockRejectedValue(new Error('duplicate key value violates unique constraint "uq_trades_active_auto_symbol"'));
        const result = await tradeExecutor.executeSingleSignal(signal, 'UK');
        expect(result.success).toBe(false);
        expect(TradeDB.allocateCapital).toHaveBeenCalledWith('UK', 1000, ADMIN);
        expect(TradeDB.releaseCapital).toHaveBeenCalledTimes(1);
        expect(TradeDB.releaseCapital).toHaveBeenCalledWith('UK', 1000, 0, ADMIN);
        expect(TradeDB.updateSignalStatus).not.toHaveBeenCalledWith(7, 'added', expect.anything());
    });

    test('a stored trade keeps its allocation', async () => {
        TradeDB.insertTrade.mockResolvedValue({ id: 42 });
        const result = await tradeExecutor.executeSingleSignal(signal, 'UK');
        expect(result).toMatchObject({ success: true, tradeId: 42 });
        expect(TradeDB.releaseCapital).not.toHaveBeenCalled();
    });

    test('a failed release is logged and does not hide the insert\'s error', async () => {
        TradeDB.insertTrade.mockRejectedValue(new Error('insert refused'));
        TradeDB.releaseCapital.mockRejectedValue(new Error('release refused'));
        const result = await tradeExecutor.executeSingleSignal(signal, 'UK');
        expect(result).toMatchObject({ success: false, reason: 'insert refused' });
        expect(console.error.mock.calls.flat().join(' ')).toMatch(/could not be handed back \(release refused\)/);
    });
});

describe('the community pass (executeForCommunity)', () => {
    const run = () => tradeExecutor.executeForCommunity([signal], 'UK', new Map([[signal.id, { success: true, executionPrice: 101 }]]));
    beforeEach(() => TradeDB.getAutoTradingUsers.mockResolvedValue([{ email: SUBSCRIBER, telegram_chat_id: null }]));

    test('a failed insert hands the allocation back and counts as skipped', async () => {
        TradeDB.insertTrade.mockRejectedValue(new Error('insert refused'));
        const result = await run();
        expect(result).toMatchObject({ executed: 0, skipped: 1 });
        expect(TradeDB.releaseCapital).toHaveBeenCalledWith('UK', 1000, 0, SUBSCRIBER);
    });

    test('a failed allocation hands nothing back (nothing was allocated)', async () => {
        TradeDB.allocateCapital.mockRejectedValue(new Error('ledger refused'));
        const result = await run();
        expect(result).toMatchObject({ executed: 0, skipped: 1 });
        expect(TradeDB.insertTrade).not.toHaveBeenCalled();
        expect(TradeDB.releaseCapital).not.toHaveBeenCalled();
    });

    test('a stored trade keeps its allocation', async () => {
        TradeDB.insertTrade.mockResolvedValue({ id: 43 });
        const result = await run();
        expect(result).toMatchObject({ executed: 1, skipped: 0 });
        expect(TradeDB.releaseCapital).not.toHaveBeenCalled();
    });
});

describe('the unique indexes (database-postgres.js)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../database-postgres.js'), 'utf8');
    test('one open high-conviction row per symbol', () => {
        expect(src).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_high_conviction_active_symbol ON high_conviction_portfolio\(symbol\) WHERE status = 'active'/);
    });
    test('one open AUTOMATIC position per account and symbol; a second manual one stays allowed', () => {
        expect(src).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_trades_active_auto_symbol ON trades\(user_id, symbol\) WHERE status = 'active' AND auto_added = true/);
    });
    test('built after the auto_added column exists', () => {
        expect(src.indexOf('ADD COLUMN IF NOT EXISTS auto_added')).toBeGreaterThan(-1);
        expect(src.indexOf('ADD COLUMN IF NOT EXISTS auto_added')).toBeLessThan(src.indexOf('uq_trades_active_auto_symbol'));
    });
});
