/**
 * Nightly ledger drift check (lib/portfolio/ledger-drift-check.js) - GAPS #6
 *
 * Pinned down here:
 *   1. It runs the reconcile's own dry run, CapitalManager.reconcileReport(): the
 *      computation POST /api/ops/reconcile-capital answers with (pinned against
 *      server.js in positions-integrity.test.js). It never writes: its only
 *      statement is that SELECT, drift or not.
 *   2. The owner hears about drift beyond the tolerance (more than 0.01 of
 *      realized, allocated or available capital, or any difference in open
 *      positions) in one message per run, through the owner-only sender
 *      (close-failure-alerts.js notifyOwner): the owner's own linked chat, never a
 *      broadcast, never the bot's default chat. No drift, or drift within the
 *      tolerance, sends nothing.
 *   3. It never throws: a dry run that fails is logged and reported, a message
 *      that cannot be sent is logged.
 *   4. LEDGER_DRIFT_CHECK=false: no query, no message.
 *   5. The cron: 22:30 UK, Monday to Friday, in the scanner cron hub; nothing it
 *      throws escapes the callback.
 *   6. The last run is what the reconcile endpoint shows as nightlyCheck.
 *
 * The database and the bot are mocked. What the SELECT does on a real Postgres is
 * checked by the endpoint harness: trading.json ends with a reconcile dry run that
 * must show zero drift.
 */

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
// Under jsdom, jest resolves cheerio's "browser" build, which is ESM and will not parse
jest.mock('cheerio', () => ({ load: jest.fn() }));
jest.mock('../../database-postgres', () => ({ pool: { query: jest.fn() }, getUserChatId: jest.fn() }));
jest.mock('../../lib/telegram/telegram-bot', () => ({
    sendTelegramAlert: jest.fn(),
    broadcastToSubscribers: jest.fn()
}));
jest.mock('../../ml/conviction-sweep', () => ({
    isSweepDay: jest.fn(),
    runConvictionSweep: jest.fn(),
    scheduleResumeCheck: jest.fn(),
    runSweepWatchdog: jest.fn()
}));

const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const TradeDB = require('../../database-postgres');
const telegramBot = require('../../lib/telegram/telegram-bot');
const CapitalManager = require('../../lib/portfolio/capital-manager');
const OwnerAlerts = require('../../lib/portfolio/close-failure-alerts');
const LedgerDrift = require('../../lib/portfolio/ledger-drift-check');
const StockScanner = require('../../lib/scanner/scanner');

const WRITE = /\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE)\b/i;
const OWNER_CHAT = '424242';
const envAtStart = process.env.LEDGER_DRIFT_CHECK;

/**
 * One ledger row as the reconcile's SELECT returns it (the money cast to float),
 * in step with its automatic trades unless told otherwise.
 */
function ledgerRow(overrides = {}) {
    return {
        user_id: 'owner@e2e.invalid', market: 'UK', currency: 'GBP',
        initial_capital: 10000,
        ledger_realized: 40, ledger_allocated: 1000, ledger_available: 9040, ledger_positions: 2,
        trades_realized: 40, trades_allocated: 1000, trades_positions: 2,
        ...overrides
    };
}

function mockLedger(rows) {
    TradeDB.pool.query.mockResolvedValue({ rows, rowCount: rows.length });
}

const sentMessages = () => telegramBot.sendTelegramAlert.mock.calls.map(([, alert]) => alert.message);

beforeEach(() => {
    LedgerDrift.reset();
    OwnerAlerts.reset();   // it remembers the owner's chat id between calls
    delete process.env.LEDGER_DRIFT_CHECK;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    TradeDB.getUserChatId.mockResolvedValue(OWNER_CHAT);
    telegramBot.sendTelegramAlert.mockResolvedValue(true);
});

afterAll(() => {
    if (envAtStart === undefined) delete process.env.LEDGER_DRIFT_CHECK;
    else process.env.LEDGER_DRIFT_CHECK = envAtStart;
});

describe('the reconcile report (CapitalManager.reconcileReport)', () => {
    test('before, after and drift for every ledger row: trades minus ledger, money rounded to cents', async () => {
        mockLedger([ledgerRow({ trades_realized: 65, trades_allocated: 500, trades_positions: 1 })]);

        const [entry] = await CapitalManager.reconcileReport();

        expect(entry).toEqual({
            user_id: 'owner@e2e.invalid', market: 'UK', currency: 'GBP',
            before: { realized: 40, allocated: 1000, available: 9040, positions: 2 },
            after: { realized: 65, allocated: 500, available: 9565, positions: 1 },
            drift: { realized: 25, allocated: -500, available: 525, positions: -1 }
        });
    });

    test("available capital that disagrees with the row's own figures is drift too", async () => {
        mockLedger([ledgerRow({ ledger_available: 9000 })]);

        const [entry] = await CapitalManager.reconcileReport();

        expect(entry.drift).toEqual({ realized: 0, allocated: 0, available: 40, positions: 0 });
    });

    test('one read-only statement, over automatic trades only', async () => {
        mockLedger([]);

        expect(await CapitalManager.reconcileReport()).toEqual([]);

        expect(TradeDB.pool.query).toHaveBeenCalledTimes(1);
        const [sql, params] = TradeDB.pool.query.mock.calls[0];
        expect(sql).toMatch(/^\s*SELECT/);
        expect(WRITE.test(sql)).toBe(false);
        expect(sql).toMatch(/WHERE auto_added = true AND market IS NOT NULL/);
        expect(params).toBeUndefined();
    });
});

describe('the nightly check', () => {
    test('no drift: nothing is sent, and the run is recorded', async () => {
        mockLedger([
            ledgerRow(),
            ledgerRow({
                market: 'US', currency: 'USD', initial_capital: 15000,
                ledger_realized: 0, ledger_allocated: 0, ledger_available: 15000, ledger_positions: 0,
                trades_realized: 0, trades_allocated: 0, trades_positions: 0
            })
        ]);

        const run = await LedgerDrift.runLedgerDriftCheck();

        expect(run).toMatchObject({ accounts: 1, markets: 2, drifted: [], ownerNotified: null });
        expect(TradeDB.getUserChatId).not.toHaveBeenCalled();
        expect(telegramBot.sendTelegramAlert).not.toHaveBeenCalled();
        expect(LedgerDrift.getStatus().lastRun).toEqual(run);
    });

    test("drift: one message to the owner's own chat, naming the ledger and the amounts", async () => {
        mockLedger([
            ledgerRow(),
            ledgerRow({ user_id: 'subscriber@e2e.invalid', ledger_allocated: 0, ledger_available: 10040, ledger_positions: 0 })
        ]);

        const run = await LedgerDrift.runLedgerDriftCheck();

        expect(run).toMatchObject({ accounts: 2, markets: 2, ownerNotified: true });
        expect(run.drifted).toEqual([{
            user_id: 'subscriber@e2e.invalid', market: 'UK', currency: 'GBP',
            drift: { realized: 0, allocated: 1000, available: -1000, positions: 2 }
        }]);
        expect(telegramBot.broadcastToSubscribers).not.toHaveBeenCalled();
        expect(telegramBot.sendTelegramAlert).toHaveBeenCalledTimes(1);
        const [chatId, alert] = telegramBot.sendTelegramAlert.mock.calls[0];
        expect(chatId).toBe(OWNER_CHAT);
        expect(alert.type).toBe('custom');
        // The first line is the one the owner-alert log records: no account name in it
        expect(alert.message.split('\n')[0])
            .toBe('⚠️ *Ledger drift:* 1 of 2 paper-capital ledgers (2 accounts) disagree with the trades table.');
        expect(alert.message).toContain('subscriber@e2e.invalid · UK (GBP): allocated +1000.00, available -1000.00, positions +2');
        expect(alert.message).toContain('Nothing was changed');
        expect(alert.message).toContain('POST /api/ops/reconcile-capital');
        expect(LedgerDrift.getStatus().lastRun).toEqual(run);
    });

    test('within the tolerance is not drift: 0.01 of money sends nothing, 0.02 does', async () => {
        mockLedger([ledgerRow({ trades_realized: 40.01 })]);
        expect((await LedgerDrift.runLedgerDriftCheck()).drifted).toEqual([]);
        expect(telegramBot.sendTelegramAlert).not.toHaveBeenCalled();

        mockLedger([ledgerRow({ trades_realized: 40.02 })]);
        expect((await LedgerDrift.runLedgerDriftCheck()).drifted).toHaveLength(1);
        expect(sentMessages()).toHaveLength(1);
        expect(sentMessages()[0]).toContain('owner@e2e.invalid · UK (GBP): realized +0.02, available +0.02');
    });

    test('a position count that differs is drift, whatever the money says', async () => {
        mockLedger([ledgerRow({ ledger_positions: 3 })]);

        const run = await LedgerDrift.runLedgerDriftCheck();

        expect(run.drifted.map(entry => entry.drift)).toEqual([{ realized: 0, allocated: 0, available: 0, positions: -1 }]);
        expect(sentMessages()[0]).toContain('owner@e2e.invalid · UK (GBP): positions -1');
    });

    test("it never writes: its only statement is the reconcile's SELECT, drift or not", async () => {
        const reconcile = jest.spyOn(CapitalManager, 'reconcileReport');
        mockLedger([ledgerRow()]);
        await LedgerDrift.runLedgerDriftCheck();
        mockLedger([ledgerRow({ ledger_allocated: 0 })]);
        await LedgerDrift.runLedgerDriftCheck();

        expect(reconcile).toHaveBeenCalledTimes(2);
        expect(sentMessages()).toHaveLength(1);
        expect(TradeDB.pool.query).toHaveBeenCalledTimes(2);
        expect(TradeDB.pool.query.mock.calls.filter(([sql]) => WRITE.test(sql))).toEqual([]);
    });

    test('a long list names the first MAX_LINES ledgers and counts the rest', async () => {
        mockLedger(Array.from({ length: LedgerDrift.MAX_LINES + 2 },
            (_, i) => ledgerRow({ user_id: `user${i}@e2e.invalid`, ledger_positions: 1 })));

        await LedgerDrift.runLedgerDriftCheck();

        const message = sentMessages()[0];
        expect(message.split('\n').filter(line => line.includes('@e2e.invalid'))).toHaveLength(LedgerDrift.MAX_LINES);
        expect(message).toContain('…and 2 more');
    });

    test("an account name is escaped for Telegram's Markdown", async () => {
        mockLedger([ledgerRow({ user_id: 'first_last@e2e.invalid', ledger_positions: 1 })]);

        await LedgerDrift.runLedgerDriftCheck();

        expect(sentMessages()[0]).toContain('first\\_last@e2e.invalid · UK (GBP): positions +1');
    });

    test("an owner with no linked Telegram gets nothing, and the bot's default chat is never used", async () => {
        TradeDB.getUserChatId.mockResolvedValue(null);
        mockLedger([ledgerRow({ ledger_positions: 0 })]);

        const run = await LedgerDrift.runLedgerDriftCheck();

        expect(run.ownerNotified).toBe(false);
        expect(run.drifted).toHaveLength(1);
        expect(telegramBot.sendTelegramAlert).not.toHaveBeenCalled();
    });

    test('a message Telegram refuses never throws: the run says it was not delivered', async () => {
        telegramBot.sendTelegramAlert.mockRejectedValue(new Error('telegram down'));
        mockLedger([ledgerRow({ ledger_positions: 0 })]);

        await expect(LedgerDrift.runLedgerDriftCheck()).resolves.toMatchObject({ ownerNotified: false });
    });

    test('a dry run that fails never throws: it is logged, and the owner hears the ledger was not checked', async () => {
        TradeDB.pool.query.mockRejectedValue(new Error('connection terminated'));

        const run = await LedgerDrift.runLedgerDriftCheck();

        expect(run).toMatchObject({ error: 'connection terminated', ownerNotified: true });
        expect(console.error).toHaveBeenCalledWith('❌ [LEDGER DRIFT] Check failed:', 'connection terminated');
        expect(sentMessages()).toHaveLength(1);
        expect(sentMessages()[0].split('\n')[0])
            .toBe('⚠️ *Ledger drift check failed:* the paper-capital ledger was not checked tonight.');
        expect(LedgerDrift.getStatus().lastRun).toEqual(run);
    });

    test.each(['false', 'FALSE', ' 0 ', 'off'])('LEDGER_DRIFT_CHECK=%p: no query and no message', async value => {
        process.env.LEDGER_DRIFT_CHECK = value;
        mockLedger([ledgerRow({ ledger_positions: 0 })]);

        const run = await LedgerDrift.runLedgerDriftCheck();

        expect(run).toMatchObject({ skipped: 'LEDGER_DRIFT_CHECK=false' });
        expect(TradeDB.pool.query).not.toHaveBeenCalled();
        expect(telegramBot.sendTelegramAlert).not.toHaveBeenCalled();
        expect(LedgerDrift.getStatus()).toMatchObject({ enabled: false, lastRun: run });
    });

    test('a second run while one is in flight is skipped, not run twice', async () => {
        let finish;
        TradeDB.pool.query.mockImplementation(() => new Promise(resolve => { finish = resolve; }));

        const first = LedgerDrift.runLedgerDriftCheck();
        expect(LedgerDrift.getStatus().running).toBe(true);
        expect(await LedgerDrift.runLedgerDriftCheck()).toMatchObject({ skipped: 'A check is already running' });
        finish({ rows: [] });
        await first;

        expect(TradeDB.pool.query).toHaveBeenCalledTimes(1);
        expect(LedgerDrift.getStatus().running).toBe(false);
    });
});

describe('what the reconcile endpoint shows as nightlyCheck', () => {
    test('before any run: on, its schedule and tolerance, no last run', () => {
        expect(LedgerDrift.getStatus()).toEqual({
            enabled: true, schedule: '22:30 UK, Monday to Friday', tolerance: 0.01, running: false, lastRun: null
        });
    });

    test('server.js answers the reconcile with getStatus() as nightlyCheck', () => {
        const server = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8').replace(/\s+/g, ' ');
        const start = server.indexOf("app.post('/api/ops/reconcile-capital'");
        const route = start < 0 ? '' : server.slice(start, server.indexOf("app.get('/api/ops/version'", start));
        expect(route).toMatch(/nightlyCheck: require\('\.\/lib\/portfolio\/ledger-drift-check'\)\.getStatus\(\)/);
    });
});

describe('the cron (lib/scanner/scanner.js)', () => {
    function initialize() {
        cron.schedule.mockImplementation(() => ({ stop: jest.fn() }));   // restoreMocks wipes it before every test
        new StockScanner().initialize();
    }
    const driftCrons = () => cron.schedule.mock.calls.filter(([expression]) => expression === LedgerDrift.CRON_EXPRESSION);

    test('once, at 22:30 UK on weekdays, and the check decides everything else', async () => {
        expect(LedgerDrift.CRON_EXPRESSION).toBe('30 22 * * 1-5');
        initialize();
        expect(driftCrons()).toHaveLength(1);
        const [[, fire, options]] = driftCrons();
        expect(options).toMatchObject({ timezone: 'Europe/London' });

        const check = jest.spyOn(LedgerDrift, 'runLedgerDriftCheck').mockResolvedValue({ drifted: [] });
        await fire();

        expect(check).toHaveBeenCalledTimes(1);
        expect(check).toHaveBeenCalledWith();
    });

    test('nothing it throws escapes the cron callback', async () => {
        initialize();
        const [[, fire]] = driftCrons();
        jest.spyOn(LedgerDrift, 'runLedgerDriftCheck').mockRejectedValue(new Error('boom'));

        await expect(fire()).resolves.toEqual({ error: 'boom' });   // resolves (never escapes), and says why for job_runs
        expect(console.error).toHaveBeenCalledWith('❌ [LEDGER DRIFT] Check failed:', 'boom');
    });
});
