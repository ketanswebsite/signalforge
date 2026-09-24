/**
 * The kill switch (GAPS #16): AUTO_EXECUTE=false puts the system in observation mode. The 7 AM scan still stores and
 * announces its signals, but nothing books a trade: not the 1 PM executor (house or subscriber pass), and not the scan's
 * own portfolio add.
 */
const fs = require('fs');
const path = require('path');

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('../../database-postgres', () => ({
    getPendingSignals: jest.fn(),
    getAutoTradingUsers: jest.fn(),
    allocateCapital: jest.fn(),
    insertTrade: jest.fn(),
    updateSignalStatus: jest.fn(),
    pool: { query: jest.fn() }
}));
jest.mock('../../lib/telegram/telegram-bot', () => ({ broadcastToSubscribers: jest.fn(), sendTelegramAlert: jest.fn() }));
jest.mock('../../lib/portfolio/capital-manager', () => ({ validateTradeEntry: jest.fn() }));
jest.mock('../../ml/conviction-engine', () => ({ getConviction: jest.fn(), summarizeConviction: jest.fn(), fetchRecentHeadlines: jest.fn() }));
jest.mock('../../lib/push/push-service', () => jest.fn().mockImplementation(() => ({ isConfigured: false })));

const TradeDB = require('../../database-postgres');
const tradeExecutor = require('../../lib/scheduler/trade-executor');

let saved;
beforeEach(() => {
    saved = process.env.AUTO_EXECUTE;
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    TradeDB.getPendingSignals.mockResolvedValue([]);
});
afterEach(() => {
    if (saved === undefined) delete process.env.AUTO_EXECUTE; else process.env.AUTO_EXECUTE = saved;
    jest.restoreAllMocks();
});

describe('the 1 PM executor', () => {
    test.each(['India', 'UK', 'US'])('AUTO_EXECUTE=false: the %s run books nothing and reads no signal', async market => {
        process.env.AUTO_EXECUTE = 'false';
        const result = await tradeExecutor.executeMarketSignals(market);
        expect(result).toMatchObject({ success: true, market, executed: 0, observationMode: true });
        expect(TradeDB.getPendingSignals).not.toHaveBeenCalled();
        expect(TradeDB.allocateCapital).not.toHaveBeenCalled();
        expect(TradeDB.insertTrade).not.toHaveBeenCalled();
        expect(TradeDB.getAutoTradingUsers).not.toHaveBeenCalled();
    });

    test('control: without the switch the run reads its signals', async () => {
        delete process.env.AUTO_EXECUTE;
        const result = await tradeExecutor.executeMarketSignals('UK');
        expect(result.observationMode).toBeUndefined();
        expect(TradeDB.getPendingSignals).toHaveBeenCalledWith('pending', 'UK');
    });
});

describe('the 7 AM scan', () => {
    // The scan's run path needs Yahoo and the AI engine; what is pinned here is that its one portfolio add sits in the
    // branch the switch turns off.
    const src = fs.readFileSync(path.join(__dirname, '../../lib/scanner/scanner.js'), 'utf8').replace(/\r\n/g, '\n');
    test('its only portfolio add is behind AUTO_EXECUTE', () => {
        expect(src.match(/addTradeFromScan\(/g)).toHaveLength(1);
        const guard = src.indexOf("if (process.env.AUTO_EXECUTE === 'false') {");
        const add = src.indexOf('addTradeFromScan(');
        const elseBranch = src.indexOf('} else {', guard);
        expect(guard).toBeGreaterThan(-1);
        expect(elseBranch).toBeGreaterThan(guard);
        expect(add).toBeGreaterThan(elseBranch);
    });
});
