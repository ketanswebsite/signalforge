/**
 * The three senders of personal Telegram DMs honour the Alerts page switches
 * (exit-monitor.js sendExitAlert, trade-executor.js executeForCommunity,
 * eod-summary.js sendEODSummary → lib/shared/alert-policy.js)
 *
 * What must hold in every one of them:
 *  - a switch withholds the DM and NOTHING else: the position still closes, the
 *    trade is still booked, the public broadcast still goes out;
 *  - the public broadcast never reads anyone's preferences — it goes to
 *    telegram_subscribers, which is not tied to an account;
 *  - no row, or a failed read, sends.
 */

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('../../database-postgres', () => ({
    getUserChatId: jest.fn(),
    getAlertPreferences: jest.fn(),
    getAutoTradingUsers: jest.fn(),
    allocateCapital: jest.fn(),
    insertTrade: jest.fn(),
    updateSignalStatus: jest.fn(),
    pool: { query: jest.fn() }
}));
jest.mock('../../lib/telegram/telegram-bot', () => ({
    broadcastToSubscribers: jest.fn(),
    sendTelegramAlert: jest.fn()
}));
jest.mock('../../lib/portfolio/capital-manager', () => ({ validateTradeEntry: jest.fn() }));
jest.mock('../../ml/conviction-engine', () => ({
    getConviction: jest.fn(),
    summarizeConviction: jest.fn(),
    fetchRecentHeadlines: jest.fn()
}));
jest.mock('../../lib/push/push-service', () => jest.fn().mockImplementation(() => ({ isConfigured: false })));

const TradeDB = require('../../database-postgres');
const telegramBot = require('../../lib/telegram/telegram-bot');
const CapitalManager = require('../../lib/portfolio/capital-manager');
const exitMonitor = require('../../lib/portfolio/exit-monitor');
const tradeExecutor = require('../../lib/scheduler/trade-executor');
const eodSummary = require('../../lib/portfolio/eod-summary');

const ADMIN = 'admin@example.com';
const SUBSCRIBER = 'subscriber@example.com';
const CHAT_ID = '555000111';

const ALL_ON = {
    telegram_enabled: true,
    alert_on_buy: true,
    alert_on_target: true,
    alert_on_stoploss: true,
    alert_on_time_exit: true
};
const EVERY_EVENT_OFF = {
    telegram_enabled: true,
    alert_on_buy: false,
    alert_on_target: false,
    alert_on_stoploss: false,
    alert_on_time_exit: false
};

let savedAdminEmail;

beforeEach(() => {
    savedAdminEmail = process.env.ADMIN_EMAIL;
    process.env.ADMIN_EMAIL = ADMIN;
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    telegramBot.sendTelegramAlert.mockResolvedValue(true);
    telegramBot.broadcastToSubscribers.mockResolvedValue([]);
    TradeDB.getUserChatId.mockResolvedValue(CHAT_ID);
    TradeDB.getAlertPreferences.mockResolvedValue(null);
});

afterEach(() => {
    if (savedAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = savedAdminEmail;
    jest.restoreAllMocks();
});

describe('exit monitor — the owner DM', () => {
    const trade = (owner) => ({ id: 7, symbol: 'TEST.L', market: 'UK', user_id: owner, entryPrice: 100, tradeSize: 1000 });
    const alertFor = (owner, exitType) => exitMonitor.sendExitAlert(trade(owner), 95, -5, exitType, 'reason');

    test('a subscriber with no row gets the DM', async () => {
        await alertFor(SUBSCRIBER, 'stop_loss');
        expect(telegramBot.sendTelegramAlert).toHaveBeenCalledTimes(1);
        expect(telegramBot.sendTelegramAlert).toHaveBeenCalledWith(CHAT_ID, expect.any(Object));
        expect(TradeDB.getAlertPreferences).toHaveBeenCalledWith(SUBSCRIBER);
        expect(telegramBot.broadcastToSubscribers).not.toHaveBeenCalled();
    });

    test('the stop switch withholds a stop, and only a stop', async () => {
        TradeDB.getAlertPreferences.mockResolvedValue({ ...ALL_ON, alert_on_stoploss: false });

        await alertFor(SUBSCRIBER, 'stop_loss');
        expect(telegramBot.sendTelegramAlert).not.toHaveBeenCalled();

        await alertFor(SUBSCRIBER, 'target_reached');
        expect(telegramBot.sendTelegramAlert).toHaveBeenCalledTimes(1);
    });

    test.each([['max_days'], ['square_off']])('"Ran out of time" withholds a %s exit', async (exitType) => {
        TradeDB.getAlertPreferences.mockResolvedValue({ ...ALL_ON, alert_on_time_exit: false });
        await alertFor(SUBSCRIBER, exitType);
        expect(telegramBot.sendTelegramAlert).not.toHaveBeenCalled();
    });

    test('the master switch withholds every exit', async () => {
        TradeDB.getAlertPreferences.mockResolvedValue({ ...ALL_ON, telegram_enabled: false });
        await alertFor(SUBSCRIBER, 'target_reached');
        await alertFor(SUBSCRIBER, 'stop_loss');
        expect(telegramBot.sendTelegramAlert).not.toHaveBeenCalled();
    });

    test('an exit type nobody has mapped still reaches its owner', async () => {
        TradeDB.getAlertPreferences.mockResolvedValue(EVERY_EVENT_OFF);
        await alertFor(SUBSCRIBER, 'an_exit_type_nobody_has_mapped');
        expect(telegramBot.sendTelegramAlert).toHaveBeenCalledTimes(1);
    });

    test('a failed preferences read sends rather than withholds', async () => {
        TradeDB.getAlertPreferences.mockRejectedValue(new Error('connection terminated'));
        await alertFor(SUBSCRIBER, 'stop_loss');
        expect(telegramBot.sendTelegramAlert).toHaveBeenCalledTimes(1);
    });

    test('no linked Telegram: nothing to send, and the switches are never consulted', async () => {
        TradeDB.getUserChatId.mockResolvedValue(null);
        await alertFor(SUBSCRIBER, 'stop_loss');
        expect(telegramBot.sendTelegramAlert).not.toHaveBeenCalled();
        expect(TradeDB.getAlertPreferences).not.toHaveBeenCalled();
    });

    test.each([[ADMIN], ['default'], [undefined]])('the public broadcast for owner %s never reads preferences', async (owner) => {
        // Even a row that says "everything off" must not touch the broadcast
        TradeDB.getAlertPreferences.mockResolvedValue({ ...EVERY_EVENT_OFF, telegram_enabled: false });
        await alertFor(owner, 'stop_loss');
        expect(telegramBot.broadcastToSubscribers).toHaveBeenCalledTimes(1);
        expect(telegramBot.broadcastToSubscribers).toHaveBeenCalledWith(expect.any(Object), 'all');
        expect(TradeDB.getAlertPreferences).not.toHaveBeenCalled();
        expect(telegramBot.sendTelegramAlert).not.toHaveBeenCalled();
    });
});

describe('1 PM executor — the booking DM', () => {
    const signal = {
        id: 1, symbol: 'TEST.L', market: 'UK', entry_price: '100', win_rate: '80',
        historical_signal_count: '12', signal_date: '2026-09-18',
        entry_dti: '1', entry_7day_dti: '1', prev_dti: '0', prev_7day_dti: '0'
    };
    const runCommunityPass = () => tradeExecutor.executeForCommunity(
        [signal], 'UK', new Map([[signal.id, { success: true, executionPrice: 101 }]])
    );

    beforeEach(() => {
        TradeDB.getAutoTradingUsers.mockResolvedValue([{ email: SUBSCRIBER, telegram_chat_id: CHAT_ID }]);
        TradeDB.allocateCapital.mockResolvedValue(true);
        TradeDB.insertTrade.mockResolvedValue({ id: 99 });
        TradeDB.updateSignalStatus.mockResolvedValue(true);
        CapitalManager.validateTradeEntry.mockResolvedValue({ valid: true, tradeSize: 1000, currency: 'GBP' });
    });

    test('a subscriber with no row is told what was booked', async () => {
        const result = await runCommunityPass();
        expect(result.executed).toBe(1);
        expect(telegramBot.sendTelegramAlert).toHaveBeenCalledTimes(1);
        expect(TradeDB.getAlertPreferences).toHaveBeenCalledWith(SUBSCRIBER);
    });

    test.each([
        ['"Trades booked for you" off', { ...ALL_ON, alert_on_buy: false }],
        ['the master switch off', { ...ALL_ON, telegram_enabled: false }]
    ])('%s withholds the DM — the trade is booked regardless', async (_name, prefs) => {
        TradeDB.getAlertPreferences.mockResolvedValue(prefs);
        const result = await runCommunityPass();
        expect(telegramBot.sendTelegramAlert).not.toHaveBeenCalled();
        expect(TradeDB.insertTrade).toHaveBeenCalledTimes(1);
        expect(TradeDB.allocateCapital).toHaveBeenCalledTimes(1);
        expect(result.executed).toBe(1);
    });

    test('an exit switch does not silence a booking', async () => {
        TradeDB.getAlertPreferences.mockResolvedValue({ ...ALL_ON, alert_on_stoploss: false, alert_on_target: false });
        await runCommunityPass();
        expect(telegramBot.sendTelegramAlert).toHaveBeenCalledTimes(1);
    });
});

describe('EOD summary — the personal DM', () => {
    const closedToday = {
        user_id: SUBSCRIBER, symbol: 'TEST.L', name: 'Test plc', market: 'UK', currency_symbol: '£',
        shares: 10, entry_price: 100, exit_price: 108, exit_reason: 'Target reached', pl_amount: 80, pl_pct: 8
    };

    beforeEach(() => {
        TradeDB.getAutoTradingUsers.mockResolvedValue([{ email: SUBSCRIBER, telegram_chat_id: CHAT_ID }]);
        TradeDB.pool.query.mockImplementation(async (sql) => {
            if (sql.includes("status = 'closed'")) return { rows: [closedToday] };
            return { rows: [] }; // no open positions (so no price fetches), no capital rows
        });
    });

    test('a subscriber with no row gets their evening summary', async () => {
        const result = await eodSummary.sendEODSummary();
        expect(result).toMatchObject({ success: true, subscriberDMs: 1 });
        expect(telegramBot.sendTelegramAlert).toHaveBeenCalledWith(CHAT_ID, expect.any(Object));
    });

    test('the master switch withholds it — the public broadcast still goes out', async () => {
        TradeDB.getAlertPreferences.mockResolvedValue({ ...ALL_ON, telegram_enabled: false });
        const result = await eodSummary.sendEODSummary();
        expect(result).toMatchObject({ success: true, subscriberDMs: 0 });
        expect(telegramBot.sendTelegramAlert).not.toHaveBeenCalled();
        expect(telegramBot.broadcastToSubscribers).toHaveBeenCalledWith(expect.any(Object), 'portfolio');
    });

    test('it has no switch of its own: every per-event switch off still sends it', async () => {
        TradeDB.getAlertPreferences.mockResolvedValue(EVERY_EVENT_OFF);
        const result = await eodSummary.sendEODSummary();
        expect(result).toMatchObject({ success: true, subscriberDMs: 1 });
    });
});
