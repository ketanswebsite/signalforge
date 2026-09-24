/**
 * Exit monitor — a close the database refuses must not be silent
 * (lib/portfolio/exit-monitor.js handleCloseFailure, lib/portfolio/close-failure-alerts.js)
 *
 * closeTrade() re-throws whatever TradeDB.closeTradeAndRelease() throws. That
 * used to land in checkTradeExit's outer catch, which logged one line and
 * returned: no message to anyone, no trade_exit_checks row, and the same
 * attempt again a minute later for as long as the database kept refusing. The
 * same-day-exit bug (SQLSTATE 23514 on chk_trades_date_logic, fixed in 1159327)
 * hid that way, with a position sitting past its stop. The exit monitor is the
 * only closer of `trades` rows, so nothing else would have caught it.
 *
 * Pinned down here:
 *   1. Every failed pass leaves an evidence row, and that row never blocks the retry.
 *   2. The OWNER is told — once, not once a minute — by direct message only.
 *   3. Subscribers are told nothing: no exit alert unless the close succeeded.
 *   4. The alarm cannot fail quietly either (Markdown, missing chat id, a
 *      database that cannot answer the chat-id lookup).
 *   5. The rails around the owner's notification policy.
 *
 * "The shipped policy" block describes shouldNotifyOwner() as shipped — if you
 * reshape that function, that block is the one to edit with it. Everything
 * else holds whatever the policy decides.
 */

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('../../database-postgres', () => ({
    closeTradeAndRelease: jest.fn(),
    getUserChatId: jest.fn(),
    pool: { query: jest.fn() }
}));
jest.mock('../../lib/telegram/telegram-bot', () => ({
    broadcastToSubscribers: jest.fn(),
    sendTelegramAlert: jest.fn()
}));

const TradeDB = require('../../database-postgres');
const telegramBot = require('../../lib/telegram/telegram-bot');
const monitor = require('../../lib/portfolio/exit-monitor');
const CloseFailures = require('../../lib/portfolio/close-failure-alerts');

const { MIN_GAP_MINUTES, MAX_SILENCE_MINUTES, DEFAULT_REMINDER_MINUTES } = CloseFailures;

const OWNER = 'owner@example.com';
const OWNER_CHAT = 'OWNER-CHAT';
const SUBSCRIBER = 'sub_scriber@example.com';
const SUBSCRIBER_CHAT = 'SUBSCRIBER-CHAT';

const MINUTE = 60 * 1000;
const START = new Date('2026-09-18T14:30:00.000Z');
const BOOKED_THREE_DAYS_AGO = new Date('2026-09-15T13:00:05.000Z');

/** What production threw on 2026-09-18: a CHECK constraint, SQLSTATE 23514. */
function constraintViolation() {
    const error = new Error('new row for relation "trades" violates check constraint "chk_trades_date_logic"');
    error.code = '23514';
    error.constraint = 'chk_trades_date_logic';
    return error;
}

/** node-postgres when the server goes away mid-statement: no code at all. */
function connectionLost() {
    return new Error('Connection terminated unexpectedly');
}

function makeTrade(overrides = {}) {
    return {
        id: 42,
        symbol: 'TEST.L',
        market: 'UK',
        user_id: SUBSCRIBER,
        entryPrice: 100,
        entryDate: BOOKED_THREE_DAYS_AGO,
        shares: 10,
        tradeSize: 1000,
        ...overrides
    };
}

/**
 * trade_exit_checks, reduced to what the monitor does with it: INSERT a row
 * per check, and look up alert_sent = true rows before closing.
 */
function fakeExitChecks() {
    const rows = [];
    TradeDB.pool.query.mockImplementation(async (sql, params = []) => {
        if (/INSERT INTO trade_exit_checks/.test(sql)) {
            const [tradeId, currentPrice, plPercent, daysHeld, targetReached, stopLossHit, maxDaysReached, alertSent, alertType] = params;
            rows.push({ tradeId, currentPrice, plPercent, daysHeld, targetReached, stopLossHit, maxDaysReached, alertSent, alertType });
            return { rows: [], rowCount: 1 };
        }
        if (/FROM trade_exit_checks/.test(sql)) {
            return { rows: rows.filter(r => r.tradeId === params[0] && r.alertSent === true && r.alertType === params[1]) };
        }
        return { rows: [] };
    });
    return rows;
}

/** One exit check with the position through its −5% stop. */
function passAtStop(trade, price = 94.8) {
    jest.spyOn(monitor, 'fetchCurrentPrice').mockResolvedValue(price);
    return monitor.checkTradeExit(trade);
}

/** `count` consecutive checks, a minute apart — what the cron does. */
async function consecutivePasses(trade, count) {
    const results = [];
    for (let i = 0; i < count; i++) {
        if (i > 0) jest.setSystemTime(Date.now() + MINUTE);
        results.push(await passAtStop(trade));
    }
    return results;
}

const minutesLater = minutes => jest.setSystemTime(Date.now() + minutes * MINUTE);

const messagesTo = chatId => telegramBot.sendTelegramAlert.mock.calls
    .filter(([to]) => to === chatId)
    .map(([, alert]) => alert.message);

/** Markdown control characters that are not backslash-escaped. */
const unescaped = (message, char) => (message.match(new RegExp(`(?<!\\\\)\\${char}`, 'g')) || []).length;

let exitChecks;
let savedEnv;

beforeEach(() => {
    jest.useFakeTimers({ now: START });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    savedEnv = { ...process.env };
    process.env.ADMIN_EMAIL = OWNER;
    delete process.env.CLOSE_FAILURE_ALERTS;
    delete process.env.CLOSE_FAILURE_REMINDER_MIN;

    CloseFailures.reset();
    exitChecks = fakeExitChecks();
    TradeDB.closeTradeAndRelease.mockRejectedValue(constraintViolation());
    TradeDB.getUserChatId.mockImplementation(async email =>
        ({ [OWNER]: OWNER_CHAT, [SUBSCRIBER]: SUBSCRIBER_CHAT })[email] || null);
    telegramBot.sendTelegramAlert.mockResolvedValue(true);
    telegramBot.broadcastToSubscribers.mockResolvedValue([]);
});

afterEach(() => {
    process.env = savedEnv;
    jest.useRealTimers();
});

describe('A close the database refuses leaves evidence', () => {
    test('every failed pass writes a row: exit type set, alert_sent false, the price it saw', async () => {
        await consecutivePasses(makeTrade(), 5);

        expect(exitChecks).toHaveLength(5);
        for (const row of exitChecks) {
            expect(row).toMatchObject({
                tradeId: 42,
                currentPrice: 94.8,
                daysHeld: 3,
                stopLossHit: true,
                targetReached: false,
                alertSent: false,
                alertType: 'stop_loss'
            });
            expect(row.plPercent).toBeCloseTo(-5.2, 6);
        }
    });

    test('the evidence never blocks the retry: the close is attempted again on every pass', async () => {
        await consecutivePasses(makeTrade(), 5);

        expect(TradeDB.closeTradeAndRelease).toHaveBeenCalledTimes(5);
        await expect(monitor.checkAlertSent(42, 'stop_loss')).resolves.toBe(false);
    });

    test('the check reports the failure instead of an exit', async () => {
        const [result] = await consecutivePasses(makeTrade(), 1);

        expect(result).toMatchObject({ shouldExit: false, closeFailed: true });
        expect(result.error).toMatch(/chk_trades_date_logic/);
    });

    test('with the kill switch on, the evidence is still written — only the messages stop', async () => {
        process.env.CLOSE_FAILURE_ALERTS = 'false';

        await consecutivePasses(makeTrade(), 3);

        expect(exitChecks).toHaveLength(3);
        expect(telegramBot.sendTelegramAlert).not.toHaveBeenCalled();
    });
});

describe('The owner is told — once, not once a minute', () => {
    test('several consecutive failing passes produce exactly one message, to the owner', async () => {
        await consecutivePasses(makeTrade(), 5);

        expect(telegramBot.sendTelegramAlert).toHaveBeenCalledTimes(1);
        expect(messagesTo(OWNER_CHAT)).toHaveLength(1);
    });

    test('the message says what is stuck, why, and that retrying cannot fix it', async () => {
        await consecutivePasses(makeTrade(), 1);

        const [message] = messagesTo(OWNER_CHAT);
        expect(message).toMatch(/CLOSE FAILED/);
        expect(message).toContain('TEST.L');
        expect(message).toContain('trade #42');
        expect(message).toContain('Stop loss hit: -5.20%');
        expect(message).toContain('-5.20% at £94.80');
        expect(message).toContain('23514');
        expect(message).toMatch(/permanent/);
        expect(message).toMatch(/No exit alert has gone to subscribers/);
    });

    test('two stuck positions are throttled separately: one message each', async () => {
        const first = makeTrade({ id: 42, symbol: 'ONE.L' });
        const second = makeTrade({ id: 43, symbol: 'TWO.L' });

        for (let pass = 0; pass < 3; pass++) {
            if (pass > 0) minutesLater(1);
            await passAtStop(first);
            await passAtStop(second);
        }

        const messages = messagesTo(OWNER_CHAT);
        expect(messages).toHaveLength(2);
        expect(messages.filter(m => m.includes('ONE.L'))).toHaveLength(1);
        expect(messages.filter(m => m.includes('TWO.L'))).toHaveLength(1);
    });

    test('a trade id arriving as a BIGINT string is the same position as its number', async () => {
        await passAtStop(makeTrade({ id: '42' }));
        minutesLater(1);
        await passAtStop(makeTrade({ id: 42 }));

        expect(messagesTo(OWNER_CHAT)).toHaveLength(1);
    });
});

describe('Subscribers are told nothing — no exit happened', () => {
    test('no broadcast while the close keeps failing, for a system trade', async () => {
        await consecutivePasses(makeTrade({ user_id: 'default' }), 5);

        expect(telegramBot.broadcastToSubscribers).not.toHaveBeenCalled();
    });

    test('no direct message to the subscriber who owns the position either', async () => {
        await consecutivePasses(makeTrade({ user_id: SUBSCRIBER }), 5);

        expect(telegramBot.broadcastToSubscribers).not.toHaveBeenCalled();
        expect(messagesTo(SUBSCRIBER_CHAT)).toHaveLength(0);
        expect(TradeDB.getUserChatId).not.toHaveBeenCalledWith(SUBSCRIBER);
    });

    test('when the close finally succeeds the exit alert goes out once, and the owner hears it recovered', async () => {
        const trade = makeTrade({ user_id: 'default' });
        await consecutivePasses(trade, 3);
        expect(telegramBot.broadcastToSubscribers).not.toHaveBeenCalled();

        TradeDB.closeTradeAndRelease.mockResolvedValue({ closed: true, released: true, trade: { id: 42 } });
        minutesLater(1);
        const result = await passAtStop(trade);

        expect(result).toMatchObject({ shouldExit: true, alertSent: true });
        expect(telegramBot.broadcastToSubscribers).toHaveBeenCalledTimes(1);
        expect(telegramBot.broadcastToSubscribers.mock.calls[0][0].message).toMatch(/STOP LOSS HIT/);

        const ownerMessages = messagesTo(OWNER_CHAT);
        expect(ownerMessages).toHaveLength(2);
        expect(ownerMessages[1]).toMatch(/CLOSE RECOVERED/);
        expect(ownerMessages[1]).toMatch(/3 failed attempt\(s\) over 3 min/);
        expect(exitChecks.filter(r => r.alertSent)).toHaveLength(1);
    });

    test('a position closed elsewhere while its close was failing also ends the episode', async () => {
        const trade = makeTrade();
        await consecutivePasses(trade, 2);

        TradeDB.closeTradeAndRelease.mockResolvedValue({ closed: false, released: false, trade: null });
        minutesLater(1);
        const result = await passAtStop(trade);

        // Nothing left to close is not a failed close: no error line, and no alert from this pass
        expect(result).toEqual({ shouldExit: false, closedElsewhere: true });
        expect(console.error.mock.calls.filter(([line]) => /Failed to close/.test(line))).toEqual([]);
        expect(messagesTo(OWNER_CHAT)[1]).toMatch(/CLOSE RECOVERED[\s\S]*closed elsewhere/);
        expect(messagesTo(SUBSCRIBER_CHAT)).toHaveLength(0);
        expect(CloseFailures.resolveEpisode(42)).toBeNull();
    });

    test('an ordinary close — nothing had failed — sends the owner nothing extra', async () => {
        TradeDB.closeTradeAndRelease.mockResolvedValue({ closed: true, released: true, trade: { id: 42 } });

        await passAtStop(makeTrade());

        expect(messagesTo(OWNER_CHAT)).toHaveLength(0);
        expect(messagesTo(SUBSCRIBER_CHAT)).toHaveLength(1);
    });
});

describe('The alarm cannot fail quietly either', () => {
    test('the constraint name arrives intact, in Markdown that Telegram will accept', async () => {
        await consecutivePasses(makeTrade(), 1);

        const [message] = messagesTo(OWNER_CHAT);
        expect(message).toContain('chk\\_trades\\_date\\_logic');
        expect(message).toContain('sub\\_scriber@example.com');
        expect(unescaped(message, '_')).toBe(0);
        expect(unescaped(message, '`')).toBe(0);
        expect(unescaped(message, '[')).toBe(0);
        expect(unescaped(message, '*') % 2).toBe(0);
    });

    test('a message Telegram turns down is sent once more as plain text', async () => {
        telegramBot.sendTelegramAlert.mockResolvedValueOnce(false).mockResolvedValue(true);

        await consecutivePasses(makeTrade(), 3);

        const attempts = messagesTo(OWNER_CHAT);
        expect(attempts).toHaveLength(2);
        expect(attempts[1]).toContain('chk_trades_date_logic');
        expect(attempts[1]).not.toMatch(/[*`\\]/);
    });

    test('a message that was not delivered does not count: the next pass tries again', async () => {
        telegramBot.sendTelegramAlert.mockResolvedValue(false);
        await consecutivePasses(makeTrade(), 2);
        expect(telegramBot.sendTelegramAlert).toHaveBeenCalledTimes(4);

        telegramBot.sendTelegramAlert.mockClear();
        telegramBot.sendTelegramAlert.mockResolvedValue(true);
        minutesLater(1);
        await consecutivePasses(makeTrade(), 3);

        expect(telegramBot.sendTelegramAlert).toHaveBeenCalledTimes(1);
        expect(messagesTo(OWNER_CHAT)[0]).toMatch(/CLOSE FAILED/);
    });

    test('an owner with no linked Telegram gets nothing — and the bot default chat is never used', async () => {
        TradeDB.getUserChatId.mockResolvedValue(null);

        await consecutivePasses(makeTrade(), 2);

        expect(telegramBot.sendTelegramAlert).not.toHaveBeenCalled();
        expect(exitChecks).toHaveLength(2);
    });

    test('a database that cannot answer the chat-id lookup does not silence the alarm', async () => {
        await passAtStop(makeTrade({ id: 42, symbol: 'ONE.L' }));

        // getUserChatId() swallows its own errors and answers null
        TradeDB.getUserChatId.mockResolvedValue(null);
        TradeDB.closeTradeAndRelease.mockRejectedValue(connectionLost());
        minutesLater(1);
        await passAtStop(makeTrade({ id: 43, symbol: 'TWO.L' }));

        const messages = messagesTo(OWNER_CHAT);
        expect(messages).toHaveLength(2);
        expect(messages[1]).toContain('TWO.L');
        expect(messages[1]).toMatch(/transient/);
    });

    test('reporting the failure never throws into the exit check', async () => {
        TradeDB.getUserChatId.mockRejectedValue(new Error('lookup exploded'));
        TradeDB.pool.query.mockRejectedValue(new Error('database is gone'));

        await expect(passAtStop(makeTrade())).resolves.toMatchObject({ shouldExit: false, closeFailed: true });
    });
});

describe('The shipped policy — first failure, then a reminder every hour', () => {
    test('no reminder before the window, one when it has passed, headed as a reminder', async () => {
        const trade = makeTrade();
        await passAtStop(trade);

        minutesLater(DEFAULT_REMINDER_MINUTES - 1);
        await passAtStop(trade);
        expect(messagesTo(OWNER_CHAT)).toHaveLength(1);

        minutesLater(1);
        await passAtStop(trade);
        const messages = messagesTo(OWNER_CHAT);
        expect(messages).toHaveLength(2);
        expect(messages[1]).toMatch(/CLOSE STILL FAILING/);
        expect(messages[1]).toMatch(/Failed attempts:\* 3 over 60 min/);
    });

    test('CLOSE_FAILURE_REMINDER_MIN moves the window', async () => {
        process.env.CLOSE_FAILURE_REMINDER_MIN = '15';
        const trade = makeTrade();
        await passAtStop(trade);

        minutesLater(15);
        await passAtStop(trade);

        expect(messagesTo(OWNER_CHAT)).toHaveLength(2);
    });

    test('a transient fault is announced like a permanent one', async () => {
        TradeDB.closeTradeAndRelease.mockRejectedValue(connectionLost());

        await consecutivePasses(makeTrade(), 5);

        expect(messagesTo(OWNER_CHAT)).toHaveLength(1);
    });

    test('a price that drifts back inside the stop does not restart the episode', async () => {
        const trade = makeTrade();
        await passAtStop(trade, 94.8);
        minutesLater(1);
        await passAtStop(trade, 97);
        minutesLater(1);
        await passAtStop(trade, 94.8);

        expect(messagesTo(OWNER_CHAT)).toHaveLength(1);
    });
});

describe('Rails around the policy', () => {
    const failure = (overrides = {}) => ({
        kind: 'permanent',
        code: '23514',
        exitType: 'stop_loss',
        plPercent: -5.2,
        attempts: 1,
        minutesFailing: 0,
        notifications: 0,
        minutesSinceLastNotification: null,
        reminderMinutes: DEFAULT_REMINDER_MINUTES,
        ...overrides
    });
    const always = () => true;
    const never = () => false;

    test('a policy that always says yes still cannot message more than once per gap', () => {
        const told = { notifications: 1, attempts: 3 };

        expect(CloseFailures.resolveShouldNotify(failure(), always)).toBe(true);
        expect(CloseFailures.resolveShouldNotify(failure({ ...told, minutesSinceLastNotification: MIN_GAP_MINUTES - 1 }), always)).toBe(false);
        expect(CloseFailures.resolveShouldNotify(failure({ ...told, minutesSinceLastNotification: MIN_GAP_MINUTES }), always)).toBe(true);
    });

    test('a policy that always says no cannot keep a failing close quiet for ever', () => {
        expect(CloseFailures.resolveShouldNotify(failure({ minutesFailing: MAX_SILENCE_MINUTES - 1 }), never)).toBe(false);
        expect(CloseFailures.resolveShouldNotify(failure({ minutesFailing: MAX_SILENCE_MINUTES }), never)).toBe(true);
        expect(CloseFailures.resolveShouldNotify(failure({
            notifications: 1,
            minutesFailing: 5000,
            minutesSinceLastNotification: MAX_SILENCE_MINUTES
        }), never)).toBe(true);
    });

    test('a policy may hold back the first message — waiting out a blip is a legitimate choice', () => {
        const afterThreeAttempts = f => f.attempts >= 3;

        expect(CloseFailures.resolveShouldNotify(failure({ kind: 'transient', attempts: 1 }), afterThreeAttempts)).toBe(false);
        expect(CloseFailures.resolveShouldNotify(failure({ kind: 'transient', attempts: 3, minutesFailing: 2 }), afterThreeAttempts)).toBe(true);
    });

    test('a policy that returns rubbish, or throws, is replaced by the plain rule', () => {
        for (const rubbish of [undefined, null, 1, 'yes', NaN, {}]) {
            expect(CloseFailures.resolveShouldNotify(failure(), () => rubbish)).toBe(true);
            expect(CloseFailures.resolveShouldNotify(
                failure({ notifications: 1, minutesSinceLastNotification: 10 }), () => rubbish)).toBe(false);
        }
        expect(CloseFailures.resolveShouldNotify(failure(), () => { throw new Error('bug'); })).toBe(true);
    });

    test('the policy is handed a copy: it cannot alter the tracker', () => {
        const seen = CloseFailures.recordFailure(7, { error: constraintViolation(), exitType: 'stop_loss', plPercent: -6 });
        seen.attempts = 99;
        seen.notifications = 99;

        const next = CloseFailures.recordFailure(7, { error: constraintViolation(), exitType: 'stop_loss', plPercent: -6 });
        expect(next).toMatchObject({ attempts: 2, notifications: 0 });
    });

    test('whatever the shipped policy decides, the first failure of each kind is answered with true or false', () => {
        for (const kind of ['permanent', 'transient', 'unknown']) {
            expect(typeof CloseFailures.resolveShouldNotify(failure({ kind }))).toBe('boolean');
        }
    });
});

describe('Settings', () => {
    test('on by default, hourly reminders; the kill switch is read loosely', () => {
        expect(CloseFailures.getConfig({})).toEqual({ enabled: true, reminderMinutes: DEFAULT_REMINDER_MINUTES });
        for (const off of ['false', 'FALSE', ' False ', '0', 'no', 'off']) {
            expect(CloseFailures.getConfig({ CLOSE_FAILURE_ALERTS: off }).enabled).toBe(false);
        }
        expect(CloseFailures.getConfig({ CLOSE_FAILURE_ALERTS: 'true' }).enabled).toBe(true);
    });

    test('an unusable reminder window falls back to the default; a usable one stays inside the rails', () => {
        for (const unusable of [undefined, '', 'soon', '0', '-5']) {
            expect(CloseFailures.getConfig({ CLOSE_FAILURE_REMINDER_MIN: unusable }).reminderMinutes).toBe(DEFAULT_REMINDER_MINUTES);
        }
        expect(CloseFailures.getConfig({ CLOSE_FAILURE_REMINDER_MIN: '1' }).reminderMinutes).toBe(MIN_GAP_MINUTES);
        expect(CloseFailures.getConfig({ CLOSE_FAILURE_REMINDER_MIN: '999999' }).reminderMinutes).toBe(MAX_SILENCE_MINUTES);
        expect(CloseFailures.getConfig({ CLOSE_FAILURE_REMINDER_MIN: '30' }).reminderMinutes).toBe(30);
    });
});

describe('Permanent or transient?', () => {
    const withCode = code => Object.assign(new Error('boom'), { code });

    test.each([
        ['23514', 'permanent'],   // check constraint — the same-day-exit bug
        ['23503', 'permanent'],   // foreign key
        ['22P02', 'permanent'],   // invalid text representation
        ['42703', 'permanent'],   // undefined column — schema drift
        ['42P01', 'permanent'],   // undefined table
        ['08006', 'transient'],   // connection failure
        ['40P01', 'transient'],   // deadlock detected
        ['53300', 'transient'],   // too many connections
        ['57P01', 'transient'],   // admin shutdown
        ['ECONNRESET', 'transient'],
        ['EPIPE', 'transient'],   // five capitals: must not be read as a SQLSTATE
        ['P0001', 'unknown']      // raise_exception — could be either
    ])('%s is %s', (code, kind) => {
        expect(CloseFailures.classifyCloseError(withCode(code))).toEqual({ kind, code });
    });

    test('node-postgres errors that carry no code are read from their message', () => {
        expect(CloseFailures.classifyCloseError(connectionLost()).kind).toBe('transient');
        expect(CloseFailures.classifyCloseError(new Error('timeout exceeded when trying to connect')).kind).toBe('transient');
        expect(CloseFailures.classifyCloseError(new Error('something else')).kind).toBe('unknown');
        expect(CloseFailures.classifyCloseError(undefined).kind).toBe('unknown');
    });
});
