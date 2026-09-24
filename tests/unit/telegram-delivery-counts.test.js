/**
 * @jest-environment node
 *
 * Telegram delivery counts (lib/telegram/delivery-counts.js, GAPS #12). Every send used to swallow its error, so a
 * subscriber who had blocked the bot, a chat that no longer exists or a message Telegram could not parse went unseen.
 * Every message the bot sends is now counted per UK day, per kind and per outcome (sent, or Telegram's reason), with
 * no chat id and no text, and GET /api/ops/telegram-stats reads the counts back. Counting never breaks or delays a
 * send: not with a database that refuses, not with one that never answers.
 */
'use strict';

const fs = require('fs');
const path = require('path');
// The library's own error classes: the counts must read what node-telegram-bot-api really rejects with
const { TelegramError, FatalError, ParseError } = require('node-telegram-bot-api/src/errors');

// One database mock for every module registry (telegram-bot.js is loaded afresh per test)
const mockPool = { query: jest.fn() };
const mockTradeDB = { getAllActiveSubscribers: jest.fn(), updateSubscriberActivity: jest.fn() };
jest.mock('../../database-postgres', () => ({ pool: mockPool, ...mockTradeDB }));

const mockBots = [];
jest.mock('node-telegram-bot-api', () => jest.fn().mockImplementation((token, options) => {
    const bot = {
        token,
        options,
        deleteWebHook: jest.fn(() => Promise.resolve(true)),
        setWebHook: jest.fn(() => Promise.resolve(true)),
        on: jest.fn(),
        onText: jest.fn(),
        processUpdate: jest.fn(),
        sendMessage: jest.fn(() => Promise.resolve({ message_id: 1 }))
    };
    mockBots.push(bot);
    return bot;
}));

const Counts = require('../../lib/telegram/delivery-counts');

const ROOT = path.join(__dirname, '../..');
const source = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

const CHAT = '4242424242';
const TEXT = 'SECRET-MESSAGE-TEXT';

/** What node-telegram-bot-api rejects with when Telegram answers with an error */
const telegramError = (status, description) =>
    new TelegramError(`${status} ${description}`, { statusCode: status, body: { ok: false, error_code: status, description } });
const blocked = () => telegramError(403, 'Forbidden: bot was blocked by the user');

/** A pool that answers every query and keeps them; the CREATE TABLE, the upsert and the prune in order */
function fakePool({ failOn } = {}) {
    const calls = [];
    return {
        calls,
        query: jest.fn(async (sql, params) => {
            calls.push([sql.replace(/\s+/g, ' ').trim(), params]);
            if (failOn && failOn.test(sql)) throw new Error('database refused');
            return { rows: [] };
        })
    };
}

/** The upsert's rows, [day, kind, outcome, n] each */
function writtenRows(pool) {
    const upserts = pool.calls.filter(([sql]) => sql.startsWith('INSERT INTO telegram_delivery_counts'));
    const rows = [];
    for (const [, params] of upserts) {
        for (let i = 0; i < params.length; i += 4) rows.push(params.slice(i, i + 4));
    }
    return rows;
}

const settle = async () => { for (let i = 0; i < 25; i++) await Promise.resolve(); };

const ENV = ['NODE_ENV', 'RENDER', 'TELEGRAM_WEBHOOK_MODE', 'TELEGRAM_POLLING', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'RENDER_EXTERNAL_URL'];
let savedEnv;

beforeEach(() => {
    savedEnv = {};
    for (const k of ENV) { savedEnv[k] = process.env[k]; delete process.env[k]; }
    mockBots.length = 0;
    mockPool.query.mockReset();
    mockPool.query.mockResolvedValue({ rows: [] });
    mockTradeDB.getAllActiveSubscribers.mockReset();
    mockTradeDB.updateSubscriberActivity.mockReset();
    mockTradeDB.updateSubscriberActivity.mockResolvedValue(undefined);
    Counts.reset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.useRealTimers();
    Counts.reset();
    for (const k of ENV) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; }
    jest.restoreAllMocks();
});

describe('why Telegram did not take a message', () => {
    test.each([
        ['403, blocked by the user', blocked(), 'blocked'],
        ['403, a deleted account', telegramError(403, 'Forbidden: user is deactivated'), 'blocked'],
        ['400, chat not found', telegramError(400, 'Bad Request: chat not found'), 'chat-not-found'],
        ['400, Markdown Telegram cannot parse', telegramError(400, "Bad Request: can't parse entities: Can't find end of the entity starting at byte offset 12"), 'bad-markdown'],
        ['400, anything else', telegramError(400, 'Bad Request: message is too long'), 'bad-request'],
        ['429', telegramError(429, 'Too Many Requests: retry after 5'), 'rate-limited'],
        ['another code', telegramError(502, 'Bad Gateway'), 'telegram-502'],
        ['no answer (EFATAL)', new FatalError(new Error('connect ETIMEDOUT 149.154.167.220:443')), 'network'],
        ['an answer that was not Telegram\'s (EPARSE)', new ParseError('Error parsing response: <html>', { statusCode: 502, body: '<html>' }), 'network'],
        ['an error of our own, before Telegram', new TypeError("Cannot read properties of null (reading 'type')"), 'other'],
        ['nothing at all', undefined, 'other']
    ])('%s', (_name, error, expected) => {
        expect(Counts.reason(error)).toBe(expected);
    });
});

describe('the UK day', () => {
    test.each([
        ['2026-06-30T23:30:00Z', '2026-07-01'],   // British Summer Time: already the next day in London
        ['2026-12-31T23:30:00Z', '2026-12-31'],   // GMT
        ['2026-10-25T00:30:00Z', '2026-10-25']    // the night the clocks go back
    ])('%s is %s in the UK', (instant, day) => {
        expect(Counts.ukDay(new Date(instant))).toBe(day);
    });
});

describe('counting', () => {
    test('sent() and failed() only add to the tally in memory: nothing waits on the database', () => {
        mockPool.query.mockImplementation(() => new Promise(() => {}));
        const started = Date.now();
        Counts.sent('scan');
        Counts.sent('scan');
        Counts.failed('scan', blocked());
        Counts.failed('exit-dm', new FatalError(new Error('socket hang up')));
        expect(Date.now() - started).toBeLessThan(100);
        expect(mockPool.query).not.toHaveBeenCalled();
        expect(Counts.stats()).toEqual({ notYetWritten: 4, writeOutstanding: false });
    });

    test('neither ever throws, whatever it is handed', () => {
        const hostile = { get code() { throw new Error('boom'); } };
        expect(() => Counts.failed('scan', hostile)).not.toThrow();
        expect(() => Counts.sent(Symbol('not a kind'))).not.toThrow();
        expect(() => Counts.sent()).not.toThrow();
    });

    test('a failure logs its kind and Telegram\'s reason, never the chat, the text or the error message', () => {
        const error = telegramError(403, `Forbidden: bot was blocked by the user ${CHAT} ${TEXT}`);
        error.message = `ETELEGRAM: 403 chat ${CHAT} text ${TEXT}`;
        Counts.failed('exit-dm', error);
        expect(console.warn).toHaveBeenCalledWith('⚠️ [TELEGRAM] Not delivered (exit-dm): blocked');
        const logged = [console.warn, console.log, console.error].flatMap(spy => spy.mock.calls.flat()).join(' ');
        expect(logged).not.toContain(CHAT);
        expect(logged).not.toContain(TEXT);
    });

    test('one write for a burst: the summed counts per UK day, kind and outcome, then a prune once a day', async () => {
        const pool = fakePool();
        const today = Counts.ukDay();
        Counts.sent('scan');
        Counts.sent('scan');
        Counts.failed('scan', blocked());
        Counts.failed('scan', telegramError(400, 'Bad Request: chat not found'));
        Counts.sent('eod-dm');
        Counts.sent('no-such-kind');
        Counts.sent();

        await expect(Counts.flush({ pool })).resolves.toBe(true);
        await settle();

        expect(pool.calls[0][0]).toMatch(/^CREATE TABLE IF NOT EXISTS telegram_delivery_counts \( day DATE NOT NULL, kind TEXT NOT NULL, outcome TEXT NOT NULL, n INTEGER/);
        expect(pool.calls.filter(([sql]) => sql.startsWith('INSERT INTO telegram_delivery_counts'))).toHaveLength(1);
        expect(writtenRows(pool)).toEqual(expect.arrayContaining([
            [today, 'scan', 'sent', 2], [today, 'scan', 'blocked', 1], [today, 'scan', 'chat-not-found', 1],
            [today, 'eod-dm', 'sent', 1], [today, 'other', 'sent', 2]
        ]));
        expect(writtenRows(pool)).toHaveLength(5);
        // Counts only: a UK date, a known kind, an outcome and a number in every row
        for (const [day, kind, outcome, n] of writtenRows(pool)) {
            expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(Object.keys(Counts.KINDS)).toContain(kind);
            expect(outcome).toMatch(/^(sent|blocked|chat-not-found|bad-markdown|bad-request|rate-limited|network|other|telegram-\d{3})$/);
            expect(Number.isInteger(n)).toBe(true);
        }
        expect(pool.calls.filter(([sql]) => sql.startsWith('DELETE FROM telegram_delivery_counts')))
            .toEqual([['DELETE FROM telegram_delivery_counts WHERE day < $1::date - $2::int', [today, 90]]]);
        expect(Counts.stats()).toEqual({ notYetWritten: 0, writeOutstanding: false });

        // A second write the same UK day adds to the rows and does not prune again
        Counts.sent('scan');
        await expect(Counts.flush({ pool })).resolves.toBe(true);
        await settle();
        expect(pool.calls.filter(([sql]) => sql.startsWith('DELETE'))).toHaveLength(1);
        expect(pool.calls.find(([sql]) => sql.startsWith('INSERT'))[0]).toMatch(/ON CONFLICT \(day, kind, outcome\) DO UPDATE SET n = telegram_delivery_counts\.n \+ EXCLUDED\.n/);
    });

    test('the write starts by itself FLUSH_DELAY_MS after the first message of a burst', async () => {
        jest.useFakeTimers();
        Counts.sent('weekly-report');
        Counts.sent('weekly-report');
        jest.advanceTimersByTime(Counts.FLUSH_DELAY_MS - 1);
        await settle();
        expect(mockPool.query).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
        await settle();
        const upserts = mockPool.query.mock.calls.filter(([sql]) => sql.startsWith('INSERT INTO telegram_delivery_counts'));
        expect(upserts).toHaveLength(1);
        expect(upserts[0][1]).toEqual([Counts.ukDay(), 'weekly-report', 'sent', 2]);
    });

    test('nothing to write, or no database: nothing is written and the tally stays', async () => {
        await expect(Counts.flush({ pool: fakePool() })).resolves.toBe(false);
        Counts.sent('scan');
        await expect(Counts.flush({ pool: null })).resolves.toBe(false);
        expect(Counts.stats()).toEqual({ notYetWritten: 1, writeOutstanding: false });
    });
});

describe('a database that refuses', () => {
    test('the counts go back into the tally, one log line says so, and the next write carries them', async () => {
        mockPool.query.mockRejectedValue(new Error('database refused'));
        Counts.sent('exit-dm');
        Counts.failed('exit-dm', blocked());

        await expect(Counts.flush()).resolves.toBe(false);
        expect(Counts.stats()).toEqual({ notYetWritten: 2, writeOutstanding: false });
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Could not record 2 deliveries, kept for the next write: database refused'));

        const pool = fakePool();
        Counts.sent('exit-dm');
        await expect(Counts.flush({ pool })).resolves.toBe(true);
        expect(writtenRows(pool)).toEqual(expect.arrayContaining([
            [Counts.ukDay(), 'exit-dm', 'sent', 2], [Counts.ukDay(), 'exit-dm', 'blocked', 1]
        ]));
        expect(Counts.stats().notYetWritten).toBe(0);
    });

    test('a refused write is not retried in a loop: only a new message starts the next one', async () => {
        jest.useFakeTimers();
        mockPool.query.mockRejectedValue(new Error('database refused'));
        Counts.sent('eod');
        jest.advanceTimersByTime(Counts.FLUSH_DELAY_MS);
        await settle();
        const attempts = mockPool.query.mock.calls.length;
        expect(attempts).toBeGreaterThan(0);
        jest.advanceTimersByTime(Counts.FLUSH_DELAY_MS * 10);
        await settle();
        expect(mockPool.query.mock.calls.length).toBe(attempts);
        expect(Counts.stats().notYetWritten).toBe(1);
    });

    test('a refused prune costs nothing: the counts were written', async () => {
        const pool = fakePool({ failOn: /^DELETE/ });
        Counts.sent('scan');
        await expect(Counts.flush({ pool })).resolves.toBe(true);
        await settle();
        expect(writtenRows(pool)).toEqual([[Counts.ukDay(), 'scan', 'sent', 1]]);
        expect(Counts.stats().notYetWritten).toBe(0);
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Could not prune old counts: database refused'));
    });
});

describe('a database that never answers', () => {
    test('the write is given up on after WRITE_TIMEOUT_MS, no second write starts, and the counts stay in memory', async () => {
        jest.useFakeTimers();
        mockPool.query.mockImplementation(() => new Promise(() => {}));
        Counts.sent('scan');
        Counts.sent('scan');

        const first = Counts.flush();
        await settle();
        jest.advanceTimersByTime(Counts.WRITE_TIMEOUT_MS);
        await expect(first).resolves.toBe(false);
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining(`has not answered a write in ${Counts.WRITE_TIMEOUT_MS} ms`));
        expect(Counts.stats()).toEqual({ notYetWritten: 2, writeOutstanding: true });

        // More messages are still counted at once; no other write goes to the database while the first is out
        Counts.failed('scan', blocked());
        await expect(Counts.flush()).resolves.toBe(false);
        jest.advanceTimersByTime(Counts.FLUSH_DELAY_MS * 5);
        await settle();
        expect(mockPool.query).toHaveBeenCalledTimes(1);
        expect(Counts.stats()).toEqual({ notYetWritten: 3, writeOutstanding: true });
    });
});

describe('the probe\'s report', () => {
    test('before the table exists it reads as empty, after one query', async () => {
        const pool = { query: jest.fn(async () => ({ rows: [{ present: false }] })) };
        const out = await Counts.report(pool, { day: '2026-09-24', days: 14 });
        expect(pool.query).toHaveBeenCalledTimes(1);
        expect(out).toMatchObject({
            table: false, day: '2026-09-24', days: 14, kinds: [], daily: [],
            totals: { sent: 0, failed: 0, failures: {} }, countedSince: null, retentionDays: 90
        });
    });

    test('a UK day by kind, the daily totals newest first, and what this process has not written yet', async () => {
        const rows = [
            { day: '2026-09-24', kind: 'eod-dm', outcome: 'sent', n: 3 },
            { day: '2026-09-24', kind: 'scan', outcome: 'blocked', n: 2 },
            { day: '2026-09-24', kind: 'scan', outcome: 'chat-not-found', n: 1 },
            { day: '2026-09-24', kind: 'scan', outcome: 'sent', n: 10 },
            { day: '2026-09-23', kind: 'scan', outcome: 'blocked', n: 1 },
            { day: '2026-09-23', kind: 'scan', outcome: 'sent', n: 12 }
        ];
        const pool = {
            query: jest.fn(async (sql, params) => {
                if (sql.includes('to_regclass')) return { rows: [{ present: true }] };
                if (sql.includes('min(day)')) return { rows: [{ since: '2026-09-20' }] };
                expect(params).toEqual(['2026-09-24', 7]);
                return { rows };
            })
        };
        Counts.sent('exit');
        const out = await Counts.report(pool, { day: '2026-09-24', days: 7 });
        expect(out.table).toBe(true);
        expect(out.kinds).toEqual([
            { kind: 'eod-dm', sent: 3, failed: 0, failures: {} },
            { kind: 'scan', sent: 10, failed: 3, failures: { blocked: 2, 'chat-not-found': 1 } }
        ]);
        expect(out.daily).toEqual([
            { day: '2026-09-24', sent: 13, failed: 3, failures: { blocked: 2, 'chat-not-found': 1 } },
            { day: '2026-09-23', sent: 12, failed: 1, failures: { blocked: 1 } }
        ]);
        expect(out.totals).toEqual({ sent: 25, failed: 4, failures: { blocked: 3, 'chat-not-found': 1 } });
        expect(out).toMatchObject({ countedSince: '2026-09-20', notYetWritten: 1, writeOutstanding: false });
        expect(out.legend.kinds).toBe(Counts.KINDS);
        expect(out.legend.reasons).toBe(Counts.REASONS);
    });
});

describe('the bot counts every message it sends', () => {
    // Fake timers: no background write fires on its own, and a send that waited on one could not finish
    let loaded = [];
    beforeEach(() => { jest.useFakeTimers(); });
    afterEach(() => { for (const counts of loaded) counts.reset(); loaded = []; });

    /** A fresh telegram-bot.js with a bot, and the counter instance it uses */
    function loadBot({ token = '123456:HARNESS-token' } = {}) {
        process.env.NODE_ENV = 'development';
        if (token) process.env.TELEGRAM_BOT_TOKEN = token;
        let telegram;
        let counts;
        jest.isolateModules(() => {
            telegram = require('../../lib/telegram/telegram-bot');
            counts = require('../../lib/telegram/delivery-counts');
        });
        loaded.push(counts);
        return { telegram, counts, api: mockBots[mockBots.length - 1] };
    }

    test('a message Telegram takes counts as sent under its kind, and the send answers at once whatever the database does', async () => {
        mockPool.query.mockImplementation(() => new Promise(() => {}));
        const { telegram, counts, api } = loadBot();
        counts.sent('scan');
        const stuck = counts.flush();   // a write the database will never answer is out
        await settle();
        // No time passes: the send cannot be waiting for the database
        await expect(telegram.sendTelegramAlert(CHAT, { type: 'custom', message: TEXT, kind: 'exit-dm' })).resolves.toBe(true);
        expect(api.sendMessage).toHaveBeenCalledWith(CHAT, TEXT, { parse_mode: 'Markdown' });
        expect(counts.stats()).toEqual({ notYetWritten: 2, writeOutstanding: true });
        jest.advanceTimersByTime(counts.WRITE_TIMEOUT_MS);
        await expect(stuck).resolves.toBe(false);
    });

    test('a message Telegram refuses answers false and counts with Telegram\'s reason; the log names neither chat nor text', async () => {
        const { telegram, counts, api } = loadBot();
        api.sendMessage.mockRejectedValueOnce(blocked());
        await expect(telegram.sendTelegramAlert(CHAT, { type: 'custom', message: TEXT, kind: 'booking-dm' })).resolves.toBe(false);
        api.sendMessage.mockRejectedValueOnce(new FatalError(new Error('socket hang up')));
        await expect(telegram.sendTelegramAlert(CHAT, { type: 'custom', message: TEXT })).resolves.toBe(false);

        const pool = fakePool();
        await counts.flush({ pool });
        expect(writtenRows(pool)).toEqual(expect.arrayContaining([
            [counts.ukDay(), 'booking-dm', 'blocked', 1], [counts.ukDay(), 'other', 'network', 1]
        ]));
        const logged = [console.warn, console.log, console.error].flatMap(spy => spy.mock.calls.flat()).join(' ');
        expect(logged).toContain('Not delivered (booking-dm): blocked');
        expect(logged).not.toContain(CHAT);
        expect(logged).not.toContain(TEXT);
    });

    test('a broadcast counts each subscriber\'s send under the broadcast\'s kind', async () => {
        const { telegram, counts, api } = loadBot();
        mockTradeDB.getAllActiveSubscribers.mockResolvedValue([{ chat_id: '1' }, { chat_id: '2' }, { chat_id: '3' }]);
        api.sendMessage.mockImplementation(async chatId => {
            if (chatId === '2') throw blocked();
            if (chatId === '3') throw telegramError(400, 'Bad Request: chat not found');
            return { message_id: 1 };
        });
        const results = await telegram.broadcastToSubscribers({ type: 'custom', message: TEXT, kind: 'eod' }, 'portfolio');
        expect(results.map(r => r.success)).toEqual([true, false, false]);

        const pool = fakePool();
        await counts.flush({ pool });
        expect(writtenRows(pool)).toEqual(expect.arrayContaining([
            [counts.ukDay(), 'eod', 'sent', 1], [counts.ukDay(), 'eod', 'blocked', 1], [counts.ukDay(), 'eod', 'chat-not-found', 1]
        ]));
        expect(writtenRows(pool)).toHaveLength(3);
    });

    test('the answers to commands count as bot-reply, and still reject as sendMessage does', async () => {
        const { telegram, counts, api } = loadBot();
        telegram.initializeTelegramBot();
        const handler = command => api.onText.mock.calls.find(([pattern]) => String(pattern) === String(command))[1];
        const msg = { chat: { id: Number(CHAT) }, from: { id: 7, username: 'someone' } };

        // /change swallows a failed reply; the failure is counted all the same
        api.sendMessage.mockRejectedValueOnce(blocked());
        await handler(/\/change/)(msg);
        // /help does not wait for its reply
        await handler(/\/help/)(msg);
        await settle();

        const pool = fakePool();
        await counts.flush({ pool });
        expect(writtenRows(pool)).toEqual(expect.arrayContaining([
            [counts.ukDay(), 'bot-reply', 'blocked', 1], [counts.ukDay(), 'bot-reply', 'sent', 1]
        ]));
    });

    test('no bot (no token): nothing is sent and nothing is counted', async () => {
        const { telegram, counts } = loadBot({ token: null });
        await expect(telegram.sendTelegramAlert(CHAT, { type: 'custom', message: TEXT, kind: 'scan' })).resolves.toBe(false);
        expect(counts.stats().notYetWritten).toBe(0);
    });
});

describe('the senders label their messages', () => {
    test('the bot module sends only through the counted paths', () => {
        const bot = source('lib/telegram/telegram-bot.js');
        // reply() and the two sends in sendTelegramAlert(); every command answer goes through reply()
        expect(bot.match(/bot\.sendMessage\(/g)).toHaveLength(3);
        expect(bot.match(/\breply\(chatId,/g)).toHaveLength(11);
        expect(bot).toMatch(/DeliveryCounts\.sent\(alert\.kind\)/);
        expect(bot).toMatch(/DeliveryCounts\.failed\(alert && alert\.kind, error\)/);
    });

    test.each([
        ['lib/scanner/scanner.js', 'scan', 4],
        ['lib/scheduler/trade-executor.js', 'execution', 1],
        ['lib/scheduler/trade-executor.js', 'booking-dm', 1],
        ['lib/portfolio/exit-monitor.js', 'exit', 1],
        ['lib/portfolio/exit-monitor.js', 'exit-dm', 1],
        ['lib/portfolio/eod-summary.js', 'eod', 1],
        ['lib/portfolio/eod-summary.js', 'eod-dm', 3],
        ['lib/portfolio/high-conviction-manager.js', 'hc-exit', 1],
        ['lib/portfolio/high-conviction-manager.js', 'weekly-report', 1],
        ['lib/portfolio/close-failure-alerts.js', 'owner-alert', 2],
        ['routes/admin.js', 'admin-test', 1]
    ])('%s labels %s (%i)', (file, kind, times) => {
        expect(Object.keys(Counts.KINDS)).toContain(kind);
        expect(source(file).split(`kind: '${kind}'`).length - 1).toBe(times);
    });

    test('server.js creates the table at boot and serves the probe with the read token, from the header only', () => {
        const server = source('server.js');
        expect(server).toMatch(/require\('\.\/lib\/telegram\/delivery-counts'\)\.ensureTable\(TradeDB\.pool\)/);
        expect(server).toMatch(/^app\.get\('\/api\/ops\/telegram-stats', requireOpsToken\(\{ read: true \}\), /m);
    });
});
