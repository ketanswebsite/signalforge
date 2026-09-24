/**
 * The Positions page's live prices (public/js/trade-core.js -> POST /api/prices).
 *
 * Every symbol the server's one-second cache does not hold is a Yahoo request, so since I24 the
 * route takes at most 100 symbols a call (it answered any number). The page asks 100 at a time,
 * so an account with more open positions than that keeps its live prices.
 *
 * The script runs in a vm context with the few globals it touches on load and on init.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '../../public/js/trade-core.js'), 'utf8');

function position(i) {
    return { id: i + 1, symbol: `P${i}.L`, status: 'active', entryDate: '2026-09-01T12:00:00Z', entryPrice: 100, shares: 10 };
}

function load(trades) {
    const posts = [];
    const context = {
        console: { log() {}, warn() {}, error() {} },
        document: {
            readyState: 'loading',      // the page's own DOMContentLoaded start is left to the test
            hidden: false,
            getElementById: id => (id === 'active-trades-container' ? {} : null),
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener() {},
            dispatchEvent() {}
        },
        window: { addEventListener() {} },
        TradeAPI: { migrateFromLocalStorage: async () => ({ migrated: false }), getAllTrades: async () => trades },
        fetch: async (url, options) => {
            const { symbols } = JSON.parse(options.body);
            posts.push({ url, method: options.method, symbols });
            return { ok: true, json: async () => Object.fromEntries(symbols.map(s => [s, { symbol: s, price: 123 }])) };
        },
        AbortSignal: { timeout: () => undefined },
        CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
        setInterval: () => 1,
        clearInterval() {},
        setTimeout,
        clearTimeout
    };
    vm.createContext(context);
    vm.runInContext(SOURCE, context);
    return { TradeCore: context.window.TradeCore, posts };
}

const settle = async () => { for (let i = 0; i < 20; i++) await new Promise(resolve => setTimeout(resolve, 0)); };

test('up to 100 open symbols: one request, as before', async () => {
    const { TradeCore, posts } = load(Array.from({ length: 100 }, (_, i) => position(i)));

    await TradeCore.init();
    await settle();

    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ url: '/api/prices', method: 'POST' });
    expect(posts[0].symbols).toHaveLength(100);
});

test('250 open symbols: three requests of at most 100, and every position gets its price', async () => {
    const { TradeCore, posts } = load(Array.from({ length: 250 }, (_, i) => position(i)));

    await TradeCore.init();
    await settle();

    expect(posts.map(p => p.symbols.length)).toEqual([100, 100, 50]);
    expect(new Set(posts.flatMap(p => p.symbols)).size).toBe(250);
    expect(TradeCore.getActiveTrades().every(t => t.currentPrice === 123)).toBe(true);
});

test('a symbol held twice is asked for once', async () => {
    const trades = [position(0), position(1), { ...position(0), id: 99 }];
    const { TradeCore, posts } = load(trades);

    await TradeCore.init();
    await settle();

    expect(posts.map(p => p.symbols)).toEqual([['P0.L', 'P1.L']]);
});
