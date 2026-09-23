/**
 * Reliability rails.
 *
 * 1. lib/shared/process-guards.js: an unhandled rejection is reported (throttled) and the process
 *    keeps running; an uncaught exception reports, then exits 1, even if the report hangs; SIGTERM
 *    closes the HTTP server and exits 0 within the grace period. Driven with a fake process.
 * 2. close-failure-alerts notifyOwner() never rejects, whatever the database or Telegram does.
 * 3. The exit monitor tells the owner when a whole pass fails - once, then hourly at most.
 */

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('../../database-postgres', () => ({
    getActiveTrades: jest.fn(),
    getUserChatId: jest.fn(),
    pool: { query: jest.fn() }
}));
jest.mock('../../lib/telegram/telegram-bot', () => ({
    broadcastToSubscribers: jest.fn(),
    sendTelegramAlert: jest.fn()
}));

const { EventEmitter } = require('events');
const { installProcessGuards } = require('../../lib/shared/process-guards');
const CloseFailures = require('../../lib/portfolio/close-failure-alerts');
const TradeDB = require('../../database-postgres');
const telegramBot = require('../../lib/telegram/telegram-bot');
const monitor = require('../../lib/portfolio/exit-monitor');

beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
});

function rig({ server = true, notify } = {}) {
    const proc = new EventEmitter();
    const exit = jest.fn();
    const notifyOwner = notify || jest.fn(() => Promise.resolve(true));
    let clock = 1_000_000;
    const fakeServer = server ? { close: jest.fn(), closeIdleConnections: jest.fn() } : null;
    const guards = installProcessGuards({
        server: fakeServer, notifyOwner, proc, exit, now: () => clock,
        options: { rejectionGapMs: 60_000, exceptionWaitMs: 3_000, shutdownGraceMs: 20_000 }
    });
    return { proc, exit, notifyOwner, server: fakeServer, guards, advance: ms => { clock += ms; } };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));   // jsdom has no setImmediate

describe('unhandled rejections', () => {
    test('are reported and the process keeps running', () => {
        const { proc, exit, notifyOwner } = rig();
        proc.emit('unhandledRejection', new Error('pool exhausted'));
        expect(notifyOwner).toHaveBeenCalledTimes(1);
        expect(notifyOwner.mock.calls[0][0]).toContain('Error: pool exhausted');
        expect(exit).not.toHaveBeenCalled();
    });

    test('are throttled: one report per gap, then a count of the rest', () => {
        const { proc, notifyOwner, advance } = rig();
        proc.emit('unhandledRejection', new Error('first'));
        proc.emit('unhandledRejection', new Error('second'));
        proc.emit('unhandledRejection', 'a string reason');
        expect(notifyOwner).toHaveBeenCalledTimes(1);
        advance(60_000);
        proc.emit('unhandledRejection', new Error('after the gap'));
        expect(notifyOwner).toHaveBeenCalledTimes(2);
        expect(notifyOwner.mock.calls[1][0]).toContain('after the gap');
        expect(notifyOwner.mock.calls[1][0]).toContain('2 more since the last report');
    });

    test('a report that throws costs nothing', async () => {
        const { proc, exit } = rig({ notify: jest.fn(() => { throw new Error('telegram down'); }) });
        expect(() => proc.emit('unhandledRejection', new Error('x'))).not.toThrow();
        await flush();
        expect(exit).not.toHaveBeenCalled();
    });
});

describe('uncaught exceptions', () => {
    test('report, then exit 1', async () => {
        const { proc, exit, notifyOwner } = rig();
        proc.emit('uncaughtException', new TypeError('undefined is not a function'));
        expect(notifyOwner.mock.calls[0][0]).toContain('TypeError: undefined is not a function');
        await flush();
        expect(exit).toHaveBeenCalledWith(1);
    });

    test('exit 1 even when the report hangs', () => {
        jest.useFakeTimers();
        const { proc, exit } = rig({ notify: jest.fn(() => new Promise(() => {})) });
        proc.emit('uncaughtException', new Error('boom'));
        expect(exit).not.toHaveBeenCalled();
        jest.advanceTimersByTime(3_000);
        expect(exit).toHaveBeenCalledWith(1);
    });
});

describe('shutdown on SIGTERM', () => {
    test('closes the server, drops idle keep-alive sockets, exits 0 when closed', () => {
        const { proc, exit, server } = rig();
        proc.emit('SIGTERM');
        expect(server.close).toHaveBeenCalledTimes(1);
        expect(server.closeIdleConnections).toHaveBeenCalledTimes(1);
        expect(exit).not.toHaveBeenCalled();
        server.close.mock.calls[0][0]();          // the last open request finished
        expect(exit).toHaveBeenCalledWith(0);
    });

    test('exits 0 after the grace period if requests never finish', () => {
        jest.useFakeTimers();
        const { proc, exit } = rig();
        proc.emit('SIGTERM');
        jest.advanceTimersByTime(19_999);
        expect(exit).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
        expect(exit).toHaveBeenCalledWith(0);
    });

    test('a second signal does nothing more; SIGINT behaves the same', () => {
        const { proc, server } = rig();
        proc.emit('SIGTERM');
        proc.emit('SIGINT');
        proc.emit('SIGTERM');
        expect(server.close).toHaveBeenCalledTimes(1);
    });

    test('with no server it exits at once', () => {
        const { proc, exit } = rig({ server: false });
        proc.emit('SIGTERM');
        expect(exit).toHaveBeenCalledWith(0);
    });

    test('installing twice registers the listeners once', () => {
        const { proc, guards } = rig();
        const again = installProcessGuards({ notifyOwner: jest.fn(), proc, exit: jest.fn() });
        expect(again).toBe(guards);
        expect(proc.listenerCount('SIGTERM')).toBe(1);
        expect(proc.listenerCount('unhandledRejection')).toBe(1);
    });
});

describe('notifyOwner never rejects', () => {
    test('a database that throws on the chat lookup resolves false', async () => {
        const db = { getUserChatId: jest.fn(() => Promise.reject(new Error('connection refused'))) };
        await expect(CloseFailures.notifyOwner('hello', { TradeDB: db, telegramBot: { sendTelegramAlert: jest.fn() } })).resolves.toBe(false);
    });

    test('a Telegram call that throws resolves false', async () => {
        const db = { getUserChatId: jest.fn(() => Promise.resolve('CHAT')) };
        const bot = { sendTelegramAlert: jest.fn(() => { throw new Error('socket hang up'); }) };
        await expect(CloseFailures.notifyOwner('hello', { TradeDB: db, telegramBot: bot })).resolves.toBe(false);
    });

    test('no dependencies at all resolves false', async () => {
        await expect(CloseFailures.notifyOwner('hello')).resolves.toBe(false);
    });

    test('a delivered message resolves true', async () => {
        const db = { getUserChatId: jest.fn(() => Promise.resolve('CHAT')) };
        const bot = { sendTelegramAlert: jest.fn(() => Promise.resolve(true)) };
        await expect(CloseFailures.notifyOwner('hello', { TradeDB: db, telegramBot: bot })).resolves.toBe(true);
        expect(bot.sendTelegramAlert).toHaveBeenCalledWith('CHAT', { type: 'custom', message: 'hello' });
    });
});

describe('the exit monitor reports a failed pass', () => {
    beforeEach(() => {
        monitor.lastPassFailureReportAt = undefined;
        monitor.failedPasses = 0;
        monitor.isMonitoring = false;
        TradeDB.getActiveTrades.mockReset();
        jest.spyOn(monitor, 'notifyOwner').mockResolvedValue(true);
    });

    test('once, then not again within the hour, then with the count', async () => {
        jest.useFakeTimers({ now: new Date('2026-09-24T09:00:00Z') });
        TradeDB.getActiveTrades.mockRejectedValue(new Error('the database is not answering'));

        await expect(monitor.checkAllExits()).resolves.toEqual({ error: 'the database is not answering' });
        expect(monitor.notifyOwner).toHaveBeenCalledTimes(1);
        expect(monitor.notifyOwner.mock.calls[0][0]).toContain('no open position was checked');

        jest.setSystemTime(new Date('2026-09-24T09:30:00Z'));
        await monitor.checkAllExits();
        await monitor.checkAllExits();
        expect(monitor.notifyOwner).toHaveBeenCalledTimes(1);

        jest.setSystemTime(new Date('2026-09-24T10:00:01Z'));
        await monitor.checkAllExits();
        expect(monitor.notifyOwner).toHaveBeenCalledTimes(2);
        expect(monitor.notifyOwner.mock.calls[1][0]).toContain('3 failed passes since the last report');
    });

    test('a healthy pass reports nothing', async () => {
        TradeDB.getActiveTrades.mockResolvedValue([]);
        await monitor.checkAllExits();
        expect(monitor.notifyOwner).not.toHaveBeenCalled();
    });
});
