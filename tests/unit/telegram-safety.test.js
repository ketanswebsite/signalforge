/**
 * Telegram safety (lib/telegram/telegram-bot.js).
 *
 * 1. Outside production the bot neither polls nor deletes the webhook unless TELEGRAM_POLLING=true.
 *    getUpdates cannot run while a webhook is set, so a polling boot deleted the webhook - with the
 *    real token that was PROD's, and prod stopped receiving bot commands until its next boot.
 * 2. Production always registers the webhook with a secret: TELEGRAM_WEBHOOK_SECRET, or one derived
 *    from the bot token. A derived secret is enforced only once Telegram has accepted it, so a failed
 *    registration never locks the bot's own updates out.
 */

jest.mock('../../database-postgres', () => ({ pool: { query: jest.fn() } }));

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
        sendMessage: jest.fn(() => Promise.resolve({}))
    };
    mockBots.push(bot);
    return bot;
}));

const ENV = ['NODE_ENV', 'RENDER', 'TELEGRAM_WEBHOOK_MODE', 'TELEGRAM_POLLING', 'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_WEBHOOK_SECRET', 'RENDER_EXTERNAL_URL', 'TELEGRAM_CHAT_ID'];
const TOKEN = '123456:HARNESS-token';
const PROD = { NODE_ENV: 'production', RENDER: 'true', RENDER_EXTERNAL_URL: 'https://example.invalid', TELEGRAM_BOT_TOKEN: TOKEN };
let saved;

beforeEach(() => {
    saved = {};
    for (const k of ENV) { saved[k] = process.env[k]; delete process.env[k]; }
    mockBots.length = 0;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    jest.restoreAllMocks();
});

/** A fresh copy of the module under the given environment, and the bot it created */
function load(env) {
    Object.assign(process.env, env);
    let mod;
    jest.isolateModules(() => { mod = require('../../lib/telegram/telegram-bot'); });
    return { mod, bot: mockBots[mockBots.length - 1] };
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

describe('outside production', () => {
    test('the bot neither polls nor touches the webhook by default', () => {
        const { mod, bot } = load({ NODE_ENV: 'development', TELEGRAM_BOT_TOKEN: TOKEN });
        expect(bot.options).toEqual({ polling: false });
        mod.initializeTelegramBot();
        expect(bot.deleteWebHook).not.toHaveBeenCalled();
        expect(bot.setWebHook).not.toHaveBeenCalled();
    });

    test('TELEGRAM_POLLING=true opts in: it polls, and deletes the webhook first', () => {
        const { mod, bot } = load({ NODE_ENV: 'development', TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_POLLING: 'true' });
        expect(bot.options).toEqual({ polling: true });
        mod.initializeTelegramBot();
        expect(bot.deleteWebHook).toHaveBeenCalledTimes(1);
        expect(bot.setWebHook).not.toHaveBeenCalled();
    });

    test('TELEGRAM_POLLING is ignored in production', () => {
        const { mod, bot } = load({ ...PROD, TELEGRAM_POLLING: 'true' });
        expect(bot.options).toEqual({ polling: false });
        mod.initializeTelegramBot();
        expect(bot.deleteWebHook).not.toHaveBeenCalled();
    });
});

describe('production webhook secret', () => {
    test('without TELEGRAM_WEBHOOK_SECRET it registers a secret derived from the token, enforced once Telegram accepts it', async () => {
        const { mod, bot } = load(PROD);
        let accept;
        bot.setWebHook.mockReturnValue(new Promise(resolve => { accept = resolve; }));
        mod.initializeTelegramBot();

        expect(bot.setWebHook).toHaveBeenCalledTimes(1);
        const [url, options] = bot.setWebHook.mock.calls[0];
        expect(url).toBe('https://example.invalid/api/telegram/webhook');
        expect(options.secret_token).toMatch(/^[0-9a-f]{64}$/);
        expect(mod.getWebhookSecret()).toBeNull();

        accept(true);
        await tick();
        expect(mod.getWebhookSecret()).toBe(options.secret_token);
    });

    test('the derived secret is stable for one token and differs for another', async () => {
        const first = load(PROD);
        first.mod.initializeTelegramBot();
        await tick();
        const again = load(PROD);
        again.mod.initializeTelegramBot();
        await tick();
        const other = load({ ...PROD, TELEGRAM_BOT_TOKEN: '654321:OTHER-token' });
        other.mod.initializeTelegramBot();
        await tick();
        expect(again.mod.getWebhookSecret()).toBe(first.mod.getWebhookSecret());
        expect(other.mod.getWebhookSecret()).not.toBe(first.mod.getWebhookSecret());
        expect(first.mod.getWebhookSecret()).not.toContain(TOKEN);
    });

    test('a failed registration never locks the bot\'s updates out', async () => {
        const { mod, bot } = load(PROD);
        bot.setWebHook.mockReturnValue(Promise.reject(new Error('Telegram unreachable')));
        mod.initializeTelegramBot();
        await tick();
        expect(mod.getWebhookSecret()).toBeNull();
    });

    test('TELEGRAM_WEBHOOK_SECRET is used as it is, and enforced from boot', () => {
        const { mod, bot } = load({ ...PROD, TELEGRAM_WEBHOOK_SECRET: 'env-secret_1' });
        bot.setWebHook.mockReturnValue(new Promise(() => {}));
        expect(mod.getWebhookSecret()).toBe('env-secret_1');
        mod.initializeTelegramBot();
        expect(bot.setWebHook.mock.calls[0][1]).toEqual({ secret_token: 'env-secret_1' });
    });

    test('no token, no bot and no secret', () => {
        const { mod } = load({ NODE_ENV: 'production' });
        expect(mockBots).toHaveLength(0);
        expect(mod.getWebhookSecret()).toBeNull();
    });
});
