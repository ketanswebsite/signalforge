/**
 * High-conviction exits — a close the database refuses must not be silent
 * (lib/portfolio/high-conviction-manager.js handleCloseFailure,
 *  lib/portfolio/close-failure-alerts.js)
 *
 * The manager closes its own high_conviction_portfolio rows, one pass every
 * HC_EXIT_CHECK_INTERVAL_MIN (10) minutes. When closeHighConvictionTrade threw,
 * the closure loop logged one line — "the row is still active, so the next
 * pass retries the close" — and that was all: the position sat past its stop
 * or target, nobody was told, and the same refusal came back every pass for as
 * long as the database kept refusing. The exit monitor had the same silence
 * for `trades` rows until 3915d14; this reuses what fixed it there.
 *
 * Pinned down here:
 *   1. The OWNER is told — once, not every pass — by direct message only.
 *   2. Subscribers hear nothing until the close really happens; then the exit
 *      broadcast goes out once and the owner hears that the close recovered.
 *   3. High-conviction row 2 and `trades` row 2 are different positions: their
 *      episodes never mix.
 *   4. No evidence is written — high-conviction positions have no exit-check
 *      table — so the log line is the record, on every failed pass.
 *   5. Reporting never breaks the pass; the kill switch stops messages only.
 */

jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('../../lib/telegram/telegram-bot', () => ({
    broadcastToSubscribers: jest.fn(),
    sendTelegramAlert: jest.fn()
}));
jest.mock('../../database-postgres', () => ({
    pool: { query: jest.fn() },
    getActiveHighConvictionTrades: jest.fn(),
    updateHighConvictionTrade: jest.fn(),
    closeHighConvictionTrade: jest.fn(),
    getUserChatId: jest.fn()
}));

const TradeDB = require('../../database-postgres');
const telegramBot = require('../../lib/telegram/telegram-bot');
const HighConvictionPortfolioManager = require('../../lib/portfolio/high-conviction-manager');
const CloseFailures = require('../../lib/portfolio/close-failure-alerts');

const OWNER = 'owner@example.com';
const OWNER_CHAT = 'OWNER-CHAT';

const MINUTE = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// HC_EXIT_CHECK_INTERVAL_MIN's default: the intraday cron runs a pass this often
const PASS_MINUTES = 10;
const START = new Date('2026-09-18T14:30:00.000Z');

const daysFromNow = days => new Date(Date.now() + days * DAY_MS).toISOString().split('T')[0];

/** A CHECK constraint refusing the close, SQLSTATE 23514 (the name is illustrative). */
function constraintViolation() {
    const error = new Error('new row for relation "high_conviction_portfolio" violates check constraint "chk_hc_exit_after_entry"');
    error.code = '23514';
    error.constraint = 'chk_hc_exit_after_entry';
    return error;
}

/** node-postgres when the server goes away mid-statement: no code at all. */
function connectionLost() {
    return new Error('Connection terminated unexpectedly');
}

function position(overrides) {
    return {
        id: 2,
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
 *   refuse(tradeId)  the error a close of that row throws, or null to let it through
 *   beforeClose      runs just before a close is applied (lets a test lose a race)
 *   statements       every SQL string sent through pool.query
 */
function fakeDatabase(portfolio) {
    const db = { portfolio, statements: [], refuse: () => null, beforeClose: null };

    TradeDB.pool.query.mockImplementation(async sql => {
        db.statements.push(sql);
        // pending_signals verdict lookup: no AI-rejected signal for any of these
        return { rows: [] };
    });

    TradeDB.getActiveHighConvictionTrades.mockImplementation(async () =>
        db.portfolio.filter(row => row.status === 'active').map(row => ({ ...row })));

    TradeDB.updateHighConvictionTrade.mockResolvedValue(undefined);

    // WHERE id = $8 AND status = 'active' RETURNING * — see high-conviction-reentry.test.js
    TradeDB.closeHighConvictionTrade.mockImplementation(async (tradeId, exitData) => {
        const refusal = db.refuse(tradeId);
        if (refusal) throw refusal;
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

const minutesLater = minutes => jest.setSystemTime(Date.now() + minutes * MINUTE);

/** `count` passes, PASS_MINUTES apart — what the intraday cron does. */
async function passes(manager, count) {
    const results = [];
    for (let i = 0; i < count; i++) {
        if (i > 0) minutesLater(PASS_MINUTES);
        results.push(await manager.updateAllActiveTrades());
    }
    return results;
}

const messagesTo = chatId => telegramBot.sendTelegramAlert.mock.calls
    .filter(([to]) => to === chatId)
    .map(([, alert]) => alert.message);

/** Markdown control characters that are not backslash-escaped. */
const unescaped = (message, char) => (message.match(new RegExp(`(?<!\\\\)\\${char}`, 'g')) || []).length;

let savedEnv;

beforeEach(() => {
    // Only the clock is ours: a pass really waits 100 ms between positions
    jest.useFakeTimers({ now: START, doNotFake: ['setTimeout', 'clearTimeout'] });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    savedEnv = { ...process.env };
    process.env.ADMIN_EMAIL = OWNER;
    delete process.env.CLOSE_FAILURE_ALERTS;
    delete process.env.CLOSE_FAILURE_REMINDER_MIN;

    CloseFailures.reset();
    TradeDB.getUserChatId.mockImplementation(async email => (email === OWNER ? OWNER_CHAT : null));
    telegramBot.sendTelegramAlert.mockResolvedValue(true);
    // The shape broadcastToSubscribers() really returns: one { chatId, success } per send
    telegramBot.broadcastToSubscribers.mockResolvedValue([{ chatId: 1, success: true }, { chatId: 2, success: true }]);
});

afterEach(() => {
    process.env = savedEnv;
    jest.useRealTimers();
});

describe('A close the database refuses reaches the owner — once, not every pass', () => {
    test('six failing passes: one owner message, no broadcast, the close retried every pass — then a recovery message when it closes', async () => {
        const db = fakeDatabase([position()]);
        db.refuse = () => constraintViolation();
        const manager = managerWithPrices({ AAPL: 108 });

        const failing = await passes(manager, 6); // 0 … 50 min

        expect(TradeDB.closeHighConvictionTrade).toHaveBeenCalledTimes(6);
        expect(failing.map(result => result.closed)).toEqual([0, 0, 0, 0, 0, 0]);
        expect(db.portfolio[0].status).toBe('active');
        expect(telegramBot.broadcastToSubscribers).not.toHaveBeenCalled();
        expect(telegramBot.sendTelegramAlert).toHaveBeenCalledTimes(1);
        expect(messagesTo(OWNER_CHAT)).toHaveLength(1);

        db.refuse = () => null;
        minutesLater(PASS_MINUTES);
        const recovered = await manager.updateAllActiveTrades();

        expect(recovered.closed).toBe(1);
        expect(db.portfolio[0].status).toBe('closed');
        expect(telegramBot.broadcastToSubscribers).toHaveBeenCalledTimes(1);
        expect(telegramBot.broadcastToSubscribers.mock.calls[0][0].message).toMatch(/PROFIT TARGET REACHED[\s\S]*AAPL/);
        const ownerMessages = messagesTo(OWNER_CHAT);
        expect(ownerMessages).toHaveLength(2);
        expect(ownerMessages[1]).toMatch(/CLOSE RECOVERED/);
        expect(ownerMessages[1]).toMatch(/6 failed attempt\(s\) over 60 min/);

        // The row is closed: later passes have nothing to close or announce
        await passes(manager, 2);
        expect(telegramBot.broadcastToSubscribers).toHaveBeenCalledTimes(1);
        expect(messagesTo(OWNER_CHAT)).toHaveLength(2);
    });

    test('the message says which position is stuck, which exit it missed, and why', async () => {
        const db = fakeDatabase([position()]);
        db.refuse = () => constraintViolation();

        await managerWithPrices({ AAPL: 108 }).updateAllActiveTrades();

        const [message] = messagesTo(OWNER_CHAT);
        expect(message).toMatch(/CLOSE FAILED — POSITION STILL OPEN/);
        expect(message).toContain('AAPL (trade #2)');
        expect(message).toContain('High Conviction');
        expect(message).toContain('Take Profit (8%)');
        expect(message).toContain('+8.00% at $108.00');
        expect(message).toContain('23514');
        expect(message).toMatch(/permanent/);
        expect(message).toMatch(/No exit alert has gone to subscribers/);
    });

    test('the constraint name arrives intact, in Markdown that Telegram will accept', async () => {
        const db = fakeDatabase([position()]);
        db.refuse = () => constraintViolation();

        await managerWithPrices({ AAPL: 108 }).updateAllActiveTrades();

        const [message] = messagesTo(OWNER_CHAT);
        expect(message).toContain('chk\\_hc\\_exit\\_after\\_entry');
        expect(unescaped(message, '_')).toBe(0);
        expect(unescaped(message, '`')).toBe(0);
        expect(unescaped(message, '[')).toBe(0);
        expect(unescaped(message, '*') % 2).toBe(0);
    });

    test('a close still failing an hour on is reminded, headed as a reminder', async () => {
        const db = fakeDatabase([position()]);
        db.refuse = () => constraintViolation();

        await passes(managerWithPrices({ AAPL: 108 }), 7); // 0 … 60 min

        const messages = messagesTo(OWNER_CHAT);
        expect(messages).toHaveLength(2);
        expect(messages[1]).toMatch(/CLOSE STILL FAILING/);
        expect(messages[1]).toMatch(/Failed attempts:\* 7 over 60 min/);
    });

    test('CLOSE_FAILURE_REMINDER_MIN moves the window', async () => {
        process.env.CLOSE_FAILURE_REMINDER_MIN = '20';
        const db = fakeDatabase([position()]);
        db.refuse = () => constraintViolation();

        await passes(managerWithPrices({ AAPL: 108 }), 5); // 0 … 40 min

        expect(messagesTo(OWNER_CHAT)).toHaveLength(3); // at 0, 20 and 40 min
    });
});

describe('Subscribers hear nothing until the close really happens', () => {
    test('while the close fails: no broadcast, nobody but the owner messaged, nothing reported closed', async () => {
        const db = fakeDatabase([position()]);
        db.refuse = () => constraintViolation();

        const results = await passes(managerWithPrices({ AAPL: 94 }), 3);

        expect(telegramBot.broadcastToSubscribers).not.toHaveBeenCalled();
        expect(telegramBot.sendTelegramAlert.mock.calls.map(([to]) => to)).toEqual([OWNER_CHAT]);
        expect(TradeDB.getUserChatId.mock.calls.every(([email]) => email === OWNER)).toBe(true);
        expect(results.every(result => result.closed === 0 && result.closures.length === 0)).toBe(true);
        expect(messagesTo(OWNER_CHAT)[0]).toContain('Stop Loss (5%)');
    });

    test('a row closed elsewhere while its close was failing ends the episode too — still no broadcast', async () => {
        const db = fakeDatabase([position()]);
        db.refuse = () => constraintViolation();
        const manager = managerWithPrices({ AAPL: 108 });
        await passes(manager, 2);

        // e.g. the admin's manual close lands between this pass's read and its close
        db.refuse = () => null;
        db.beforeClose = tradeId => { db.portfolio.find(r => r.id === tradeId).status = 'closed'; };
        minutesLater(PASS_MINUTES);
        const result = await manager.updateAllActiveTrades();

        expect(result.closed).toBe(0);
        expect(telegramBot.broadcastToSubscribers).not.toHaveBeenCalled();
        const messages = messagesTo(OWNER_CHAT);
        expect(messages).toHaveLength(2);
        expect(messages[1]).toMatch(/CLOSE RECOVERED[\s\S]*closed elsewhere/);
    });

    test('an ordinary close — nothing had failed — sends the owner nothing', async () => {
        fakeDatabase([position()]);

        const result = await managerWithPrices({ AAPL: 108 }).updateAllActiveTrades();

        expect(result.closed).toBe(1);
        expect(telegramBot.broadcastToSubscribers).toHaveBeenCalledTimes(1);
        expect(telegramBot.sendTelegramAlert).not.toHaveBeenCalled();
    });

    test('an exit alert that reached nobody is reported to the owner', async () => {
        fakeDatabase([position()]);
        telegramBot.broadcastToSubscribers.mockResolvedValue([{ chatId: 1, success: false }, { chatId: 2, success: false }]);

        const result = await managerWithPrices({ AAPL: 108 }).updateAllActiveTrades();

        expect(result.closed).toBe(1);
        const messages = messagesTo(OWNER_CHAT);
        expect(messages).toHaveLength(1);
        expect(messages[0]).toMatch(/exit alert reached nobody[\s\S]*AAPL[\s\S]*2 sends attempted/);
    });
});

describe('A high-conviction row is not a trade', () => {
    test('high-conviction row 2 and trades row 2 keep separate episodes', async () => {
        // The exit monitor is already failing to close TRADE 2, and has said so
        CloseFailures.recordFailure(2, { error: connectionLost(), exitType: 'stop_loss', plPercent: -6 });
        CloseFailures.markNotified(2);

        const db = fakeDatabase([position({ id: 2 })]);
        db.refuse = () => constraintViolation();
        const manager = managerWithPrices({ AAPL: 108 });
        await manager.updateAllActiveTrades();

        // …which must not swallow the FIRST message about high-conviction ROW 2
        expect(messagesTo(OWNER_CHAT)).toHaveLength(1);
        expect(messagesTo(OWNER_CHAT)[0]).toMatch(/CLOSE FAILED — POSITION STILL OPEN/);

        db.refuse = () => null;
        minutesLater(PASS_MINUTES);
        await manager.updateAllActiveTrades();

        // Row 2 recovered; trade 2's episode is untouched and still open
        expect(messagesTo(OWNER_CHAT)[1]).toMatch(/CLOSE RECOVERED/);
        expect(CloseFailures.resolveEpisode(2)).toMatchObject({ namespace: 'trades', attempts: 1, notifications: 1 });
    });

    test('the notification policy is told which book a failure came from', () => {
        const details = { error: constraintViolation(), exitType: 'stop_loss', plPercent: -6 };

        expect(CloseFailures.recordFailure(7, details)).toMatchObject({ namespace: 'trades', attempts: 1 });
        expect(CloseFailures.namespaced('hc').recordFailure(7, details)).toMatchObject({ namespace: 'hc', attempts: 1 });
    });
});

describe('No evidence table — the log line is the record', () => {
    test('failing passes write nothing', async () => {
        const db = fakeDatabase([position()]);
        db.refuse = () => constraintViolation();

        await passes(managerWithPrices({ AAPL: 108 }), 3);

        expect(db.statements.length).toBeGreaterThan(0); // the verdict lookups did run
        expect(db.statements.filter(sql => /\b(INSERT|UPDATE|DELETE)\b/i.test(sql))).toEqual([]);
    });

    test('every failed pass logs what the database said: closeHighConvictionTrade does not', async () => {
        const db = fakeDatabase([position()]);
        db.refuse = () => constraintViolation();

        await passes(managerWithPrices({ AAPL: 108 }), 2);

        const failureLines = console.error.mock.calls.filter(([line]) => /Close FAILED for AAPL/.test(line));
        expect(failureLines).toHaveLength(2);
        expect(failureLines[0][0]).toMatch(/\(id 2, take_profit\) — permanent error 23514, attempt 1, position still open/);
        expect(failureLines[1][0]).toMatch(/attempt 2/);
        expect(failureLines[0][1]).toMatchObject({ code: '23514', constraint: 'chk_hc_exit_after_entry' });
    });
});

describe('Reporting never breaks the pass', () => {
    test('one refused close does not hold up another position: it still closes and alerts', async () => {
        const db = fakeDatabase([
            position({ id: 2 }),
            position({ id: 3, symbol: 'MSFT', name: 'Microsoft' })
        ]);
        db.refuse = tradeId => (tradeId === 2 ? constraintViolation() : null);

        const result = await managerWithPrices({ AAPL: 108, MSFT: 108 }).updateAllActiveTrades();

        expect(result.closed).toBe(1);
        expect(result.closures.map(closure => closure.tradeId)).toEqual([3]);
        expect(telegramBot.broadcastToSubscribers).toHaveBeenCalledTimes(1);
        expect(telegramBot.broadcastToSubscribers.mock.calls[0][0].message).toContain('MSFT');
        expect(messagesTo(OWNER_CHAT)).toHaveLength(1);
        expect(messagesTo(OWNER_CHAT)[0]).toContain('AAPL');
    });

    test('a message Telegram turns down is sent once more as plain text', async () => {
        const db = fakeDatabase([position()]);
        db.refuse = () => constraintViolation();
        telegramBot.sendTelegramAlert.mockResolvedValueOnce(false).mockResolvedValue(true);

        await passes(managerWithPrices({ AAPL: 108 }), 3);

        const attempts = messagesTo(OWNER_CHAT);
        expect(attempts).toHaveLength(2);
        expect(attempts[1]).toContain('chk_hc_exit_after_entry');
        expect(attempts[1]).not.toMatch(/[*`\\]/);
    });

    test('an owner with no linked Telegram gets nothing — and the bot default chat is never used', async () => {
        TradeDB.getUserChatId.mockResolvedValue(null);
        const db = fakeDatabase([position()]);
        db.refuse = () => constraintViolation();

        await passes(managerWithPrices({ AAPL: 108 }), 2);

        expect(telegramBot.sendTelegramAlert).not.toHaveBeenCalled();
        expect(TradeDB.closeHighConvictionTrade).toHaveBeenCalledTimes(2);
    });

    test('a chat-id lookup that blows up is contained: the pass completes, and the next one retries', async () => {
        TradeDB.getUserChatId.mockRejectedValue(new Error('lookup exploded'));
        const db = fakeDatabase([position()]);
        db.refuse = () => constraintViolation();

        const results = await passes(managerWithPrices({ AAPL: 108 }), 2);

        expect(results).toEqual([
            { updated: 0, closed: 0, closures: [] },
            { updated: 0, closed: 0, closures: [] }
        ]);
        expect(TradeDB.closeHighConvictionTrade).toHaveBeenCalledTimes(2);
    });

    test('with the kill switch on, no message — the close is still retried and still logged', async () => {
        process.env.CLOSE_FAILURE_ALERTS = 'false';
        const db = fakeDatabase([position()]);
        db.refuse = () => constraintViolation();

        await passes(managerWithPrices({ AAPL: 108 }), 3);

        expect(telegramBot.sendTelegramAlert).not.toHaveBeenCalled();
        expect(TradeDB.closeHighConvictionTrade).toHaveBeenCalledTimes(3);
        expect(console.error.mock.calls.filter(([line]) => /Close FAILED for AAPL/.test(line))).toHaveLength(3);
    });
});
