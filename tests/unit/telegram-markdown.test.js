/**
 * Telegram's legacy Markdown (lib/telegram/markdown.js) and the bot's own replies. An underscore in a user's name,
 * an email address, a deep-link parameter or the bot's name made Telegram refuse the whole message (400 "can't parse
 * entities"): /start then told the user "Error setting up your subscription" although the subscription or the account
 * link had been stored, and /help did not arrive at all.
 */

jest.mock('../../database-postgres', () => ({
    pool: { query: jest.fn(() => Promise.resolve({ rows: [] })) },
    addTelegramSubscriber: jest.fn(() => Promise.resolve({})),
    linkTelegramToUser: jest.fn()
}));
jest.mock('../../lib/telegram/delivery-counts', () => ({ sent: jest.fn(), failed: jest.fn() }));

const mockBots = [];
jest.mock('node-telegram-bot-api', () => jest.fn().mockImplementation((token, options) => {
    const bot = {
        token, options,
        deleteWebHook: jest.fn(() => Promise.resolve(true)),
        setWebHook: jest.fn(() => Promise.resolve(true)),
        on: jest.fn(), onText: jest.fn(), processUpdate: jest.fn(),
        sendMessage: jest.fn(() => Promise.resolve({}))
    };
    mockBots.push(bot);
    return bot;
}));

const Markdown = require('../../lib/telegram/markdown');

describe('markdownSafe and plainText', () => {
    test('escapes the four characters that open an entity, and nothing else', () => {
        expect(Markdown.markdownSafe('jane_doe@example.com')).toBe('jane\\_doe@example.com');
        expect(Markdown.markdownSafe('a*b`c[d]e')).toBe('a\\*b\\`c\\[d]e');
        expect(Markdown.markdownSafe('M&M.NS (x) - 1.5%')).toBe('M&M.NS (x) - 1.5%');
    });

    test('a backslash, which cannot be escaped, becomes a slash; nothing becomes empty text', () => {
        expect(Markdown.markdownSafe('C:\\path')).toBe('C:/path');
        expect(Markdown.markdownSafe(null)).toBe('');
        expect(Markdown.markdownSafe(undefined)).toBe('');
        expect(Markdown.markdownSafe(42)).toBe('42');
    });

    test('plainText takes the markup back out', () => {
        expect(Markdown.plainText('*Hello* jane\\_doe `x`')).toBe('Hello jane_doe x');
    });

    test('the owner alerts use the same helper', () => {
        expect(require('../../lib/portfolio/close-failure-alerts').markdownSafe).toBe(Markdown.markdownSafe);
    });
});

describe('the bot escapes what it did not write', () => {
    const ENV = ['NODE_ENV', 'RENDER', 'TELEGRAM_WEBHOOK_MODE', 'TELEGRAM_POLLING', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_USERNAME'];
    let saved;
    beforeEach(() => {
        saved = {};
        for (const k of ENV) { saved[k] = process.env[k]; delete process.env[k]; }
        mockBots.length = 0;
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
        for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
        jest.restoreAllMocks();
    });

    // A fresh copy of the bot module (outside production: no webhook), its command handlers registered
    function start(env = {}) {
        Object.assign(process.env, { NODE_ENV: 'development', TELEGRAM_BOT_TOKEN: '123456:HARNESS-token' }, env);
        let mod;
        jest.isolateModules(() => { mod = require('../../lib/telegram/telegram-bot'); });
        const bot = mockBots[mockBots.length - 1];
        mod.initializeTelegramBot();
        const handler = command => bot.onText.mock.calls.find(([re]) => String(re) === command)[1];
        return { bot, handler };
    }
    const lastText = bot => bot.sendMessage.mock.calls[bot.sendMessage.mock.calls.length - 1][1];
    const from = { id: 7, username: 'jo_hn', first_name: 'Jo' };

    test('/start: the name and a referral parameter', async () => {
        const { bot, handler } = start();
        await handler('/\\/start(.*)/')({ chat: { id: 101 }, from }, ['/start my_ref', ' my_ref']);
        const text = lastText(bot);
        expect(text).toContain('Hello jo\\_hn!');
        expect(text).toContain('Thanks for joining via: my\\_ref');
        expect(text).not.toContain('Error setting up');
    });

    test('/start with an account link: the account name, email and Telegram name', async () => {
        require('../../database-postgres').linkTelegramToUser.mockResolvedValue({ success: true, user: { name: null, email: 'jane_doe@e2e.invalid' } });
        const { bot, handler } = start();
        await handler('/\\/start(.*)/')({ chat: { id: 102 }, from }, ['/start link_abc', ' link_abc']);
        const text = lastText(bot);
        expect(text).toContain('Hello jane\\_doe@e2e.invalid!');
        expect(text).toContain('Email: jane\\_doe@e2e.invalid');
        expect(text).toContain('Telegram: @jo\\_hn');
    });

    test('/start with a failed link: the reason', async () => {
        require('../../database-postgres').linkTelegramToUser.mockResolvedValue({ success: false, error: 'token_expired' });
        const { bot, handler } = start();
        await handler('/\\/start(.*)/')({ chat: { id: 103 }, from }, ['/start link_abc', ' link_abc']);
        expect(lastText(bot)).toContain('token\\_expired');
    });

    test('/help: the bot name in its links', async () => {
        const { bot, handler } = start({ TELEGRAM_BOT_USERNAME: 'sutra_algo_bot' });
        await handler('/\\/help/')({ chat: { id: 104 }, from });
        const text = lastText(bot);
        expect(text).toContain('t.me/sutra\\_algo\\_bot?start=all');
        expect(text).toContain('t.me/sutra\\_algo\\_bot?start=scans');
    });
});
