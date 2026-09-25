/**
 * The Positions page adds its three markets' money in pounds (GAPS #11, README.md section 1).
 *
 * Until 2026-09-25 the page added rupees, pounds and dollars as one number wherever it summed or ranked money across
 * markets: the equity and falls charts, the month-by-month and holding-period charts, the advanced metrics (profit
 * factor, annualised return, Sharpe ratio, maximum drawdown), "Deepest fall", the calendar, the "From sold trades"
 * colour and sparkline and the report's metrics; the market comparison drew an average money result on its % axis,
 * and the size-versus-return chart and "Most invested first" ranked ₹, £ and $ amounts on one scale. The sold-trades
 * P&L summary divided UK P/L by 100, as if it were pence.
 *
 * Now every such figure converts each trade with public/js/fx-convert.js (TradeCore.inPounds): a sold trade at its
 * sell day's rate from GET /api/fx/rates, an open position at the latest, the fixed rates only when the server has
 * none. A UK trade's money is already pounds: the server books shares = pounds / price, so the P/L it stores,
 * (exit - entry) x shares, is pounds whatever unit the price is in (database-postgres.js insertTrade and
 * closeTradeAndRelease).
 *
 * The scripts run in a vm context with the few globals they touch; the rates are made up for the test.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const read = rel => fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8');
const FX_SOURCE = read('public/js/fx-convert.js');
const CORE_SOURCE = read('public/js/trade-core.js');

// Every calendar day of September 2026: 110 rupees and $1.25 a pound to the 10th, 120 and $1.30 after
const RATE_DAYS = Array.from({ length: 30 }, (_, i) => {
    const day = `2026-09-${String(i + 1).padStart(2, '0')}`;
    return i < 10 ? [day, 110, 1.25] : [day, 120, 1.3];
});

function context({ trades = [], rates = RATE_DAYS, ratesStatus = 200 } = {}) {
    const requests = [];
    const ctx = {
        console: { log() {}, warn() {}, error() {} },
        document: {
            readyState: 'loading',
            hidden: false,
            getElementById: () => null,
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener() {},
            dispatchEvent() {}
        },
        window: { addEventListener() {} },
        TradeAPI: { migrateFromLocalStorage: async () => ({ migrated: false }), getAllTrades: async () => trades.map(t => ({ ...t })) },
        fetch: async (url, options) => {
            requests.push(url);
            if (String(url).startsWith('/api/fx/rates')) {
                return { ok: ratesStatus === 200, status: ratesStatus, json: async () => ({ success: true, source: 'dated', days: rates }) };
            }
            const { symbols } = JSON.parse(options.body);
            return { ok: true, json: async () => Object.fromEntries(symbols.map(s => [s, { symbol: s, price: s === 'INFY.NS' ? 1530 : 100 }])) };
        },
        AbortSignal: { timeout: () => undefined },
        CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
        setInterval: () => 1,
        clearInterval() {},
        setTimeout,
        clearTimeout
    };
    vm.createContext(ctx);
    vm.runInContext(FX_SOURCE, ctx);
    return { ctx, requests };
}

// ₹1,000 gain sold on 5 Sep (110), £5 loss sold on 6 Sep, $10 gain sold on 15 Sep (1.30), and an India position
// open ₹1,000 up (its last price as the page holds it)
const TRADES = [
    { id: 1, symbol: 'TCS.NS', market: 'India', status: 'closed', entryDate: '2026-09-01T09:00:00Z', exitDate: '2026-09-05T09:00:00Z',
        entryPrice: 1000, exitPrice: 1020, shares: 50, investmentAmount: 50000, profitLoss: 1000, profitLossPercentage: 2 },
    { id: 2, symbol: 'VOD.L', market: 'UK', status: 'closed', entryDate: '2026-09-02T09:00:00Z', exitDate: '2026-09-06T09:00:00Z',
        entryPrice: 80, exitPrice: 79, shares: 5, investmentAmount: 400, profitLoss: -5, profitLossPercentage: -1.25 },
    { id: 3, symbol: 'AAPL', market: 'US', status: 'closed', entryDate: '2026-09-12T14:00:00Z', exitDate: '2026-09-15T14:00:00Z',
        entryPrice: 200, exitPrice: 204, shares: 2.5, investmentAmount: 500, profitLoss: 10, profitLossPercentage: 2 },
    { id: 4, symbol: 'INFY.NS', market: 'India', status: 'active', entryDate: '2026-09-20T09:00:00Z',
        entryPrice: 1500, currentPrice: 1530, shares: 100 / 3, investmentAmount: 50000 }
];
const SOLD_IN_POUNDS = 1000 / 110 - 5 + 10 / 1.3;
const PUT_IN_POUNDS = 50000 / 110 + 400 + 500 / 1.3;

async function loadedCore(options) {
    const { ctx, requests } = context(options);
    vm.runInContext(CORE_SOURCE, ctx);
    await ctx.window.TradeCore.init();
    for (let i = 0; i < 20; i++) await new Promise(resolve => setTimeout(resolve, 0));
    return { TradeCore: ctx.window.TradeCore, FxConvert: ctx.window.FxConvert, requests };
}

describe('FxConvert (public/js/fx-convert.js)', () => {
    test('before any rate is loaded, the fixed rates convert', () => {
        const { ctx } = context();
        const Fx = ctx.window.FxConvert;
        expect(Fx.source().source).toBe('fixed');
        expect(Fx.toPounds(10500, 'INR', '2026-09-05')).toBeCloseTo(100, 10);
        expect(Fx.toPounds(127, 'USD')).toBeCloseTo(100, 10);
        expect(Fx.toPounds(42, 'GBP')).toBe(42);
    });

    test("each day converts at its own rate; a day outside the window takes the nearer end; no day is the latest", async () => {
        const { ctx, requests } = context();
        const Fx = ctx.window.FxConvert;
        await expect(Fx.load('2026-09-05')).resolves.toMatchObject({ source: 'dated', first: '2026-09-01', last: '2026-09-30' });
        expect(requests).toEqual(['/api/fx/rates?from=2026-09-05']);
        expect(Fx.toPounds(1100, 'INR', '2026-09-05')).toBeCloseTo(10, 10);
        expect(Fx.toPounds(1200, 'INR', new Date('2026-09-15T14:00:00Z'))).toBeCloseTo(10, 10);
        expect(Fx.toPounds(125, 'USD', '2025-01-01')).toBeCloseTo(100, 10);   // before the window: its first day
        expect(Fx.toPounds(130, 'USD', '2027-01-01')).toBeCloseTo(100, 10);   // after it: its last day
        expect(Fx.toPounds(1200, 'INR')).toBeCloseTo(10, 10);                 // an open position: the latest
        // a later load that needs no earlier day asks nothing more
        await Fx.load('2026-09-20');
        expect(requests).toHaveLength(1);
    });

    test('a refused or empty answer leaves the fixed rates, and never throws', async () => {
        for (const options of [{ ratesStatus: 403 }, { rates: [] }]) {
            const { ctx } = context(options);
            const Fx = ctx.window.FxConvert;
            await expect(Fx.load('2026-09-05')).resolves.toMatchObject({ source: 'fixed' });
            expect(Fx.toPounds(105, 'INR', '2026-09-05')).toBeCloseTo(1, 10);
        }
    });

    test("a trade's currency: its market, else its currency symbol, else its exchange", () => {
        const { ctx } = context();
        const Fx = ctx.window.FxConvert;
        expect(Fx.currencyOf({ market: 'India', symbol: 'X' })).toBe('INR');
        expect(Fx.currencyOf({ currencySymbol: '£', symbol: 'X' })).toBe('GBP');
        expect(Fx.currencyOf({ symbol: 'RELIANCE.NS' })).toBe('INR');
        expect(Fx.currencyOf({ symbol: 'VOD.L' })).toBe('GBP');
        expect(Fx.currencyOf({ symbol: 'AAPL' })).toBe('USD');
    });
});

describe('the Positions page views add money in pounds (trade-core.js)', () => {
    test('TradeCore.inPounds: a sold trade at its sell day, an open position at the latest', async () => {
        const { TradeCore, requests } = await loadedCore({ trades: TRADES });
        // the rates were asked for once, from the oldest sell day
        expect(requests.filter(url => url.startsWith('/api/fx/rates'))).toEqual(['/api/fx/rates?from=2026-09-05']);
        const [india, , us, open] = [1, 2, 3, 4].map(id => TradeCore.getTradeById(id));
        expect(TradeCore.inPounds(india, 1000)).toBeCloseTo(1000 / 110, 10);
        expect(TradeCore.inPounds(us, 10)).toBeCloseTo(10 / 1.3, 10);
        expect(TradeCore.inPounds(open, 50000)).toBeCloseTo(50000 / 120, 10);
    });

    test('equity curve (and so the falls chart and the drawdown): sales added in pounds, open P/L at the latest', async () => {
        const { TradeCore } = await loadedCore({ trades: TRADES });
        const curve = TradeCore.getEquityCurveData();
        const lastSale = curve.filter(point => !point.isCurrentValue).slice(-1)[0];
        expect(lastSale.profit).toBeCloseTo(SOLD_IN_POUNDS, 8);                  // was 1005 (₹1,000 - £5 + $10)
        const now = curve.slice(-1)[0];
        expect(now.unrealizedPL).toBeCloseTo(1000 / 120, 8);                    // ₹1,000 open gain at 120
        expect(now.equity).toBeCloseTo(100000 + SOLD_IN_POUNDS + 1000 / 120, 8);
    });

    test('advanced metrics: profit factor and annualised return in pounds', async () => {
        const { TradeCore } = await loadedCore({ trades: TRADES });
        const metrics = TradeCore.getAdvancedMetrics();
        expect(metrics.profitFactor).toBeCloseTo((1000 / 110 + 10 / 1.3) / 5, 8); // was (1000 + 10) / 5 = 202
        const days = [4, 4, 3];
        const years = days.reduce((a, b) => a + b, 0) / days.length / 365;
        expect(metrics.annualizedReturn).toBeCloseTo((SOLD_IN_POUNDS / PUT_IN_POUNDS * 100) / years, 6);
    });

    test('month-by-month and holding-period charts: the % of the money in pounds', async () => {
        const { TradeCore } = await loadedCore({ trades: TRADES });
        const [september] = TradeCore.getMonthlyPerformanceData();
        expect(september.profit).toBeCloseTo(SOLD_IN_POUNDS, 8);
        expect(september.totalPL).toBeCloseTo(SOLD_IN_POUNDS / PUT_IN_POUNDS * 100, 8);
        const holding = TradeCore.getHoldingPeriodStats();
        expect(holding.shortTerm.count).toBe(3);
        expect(holding.shortTerm.avgPLPercent).toBeCloseTo(SOLD_IN_POUNDS / PUT_IN_POUNDS * 100, 8);
    });

    test("market comparison: each market's average P/L %, ranked by its total in pounds", async () => {
        const { TradeCore } = await loadedCore({ trades: TRADES });
        const markets = TradeCore.getPerformanceByMarket();
        expect(markets.map(m => m.name)).toEqual(['NSE/BSE', 'NASDAQ/NYSE', 'LSE']);
        expect(markets.map(m => m.avgPLPercent)).toEqual([2, 2, -1.25]);           // was 1000, 10, -5 (money)
        expect(markets[0].totalPL).toBeCloseTo(1000 / 110, 8);
    });

    test('size versus return: sizes in pounds', async () => {
        const { TradeCore } = await loadedCore({ trades: TRADES });
        const sizes = Object.fromEntries(TradeCore.getTradeSizeVsReturnData().map(point => [point.symbol, point.size]));
        expect(sizes['TCS.NS']).toBeCloseTo(50000 / 110, 8);                       // was 50000
        expect(sizes['VOD.L']).toBe(400);
        expect(sizes['AAPL']).toBeCloseTo(500 / 1.3, 8);
    });

    test('without dated rates the same views use the fixed ones', async () => {
        const { TradeCore } = await loadedCore({ trades: TRADES, ratesStatus: 403 });
        expect(TradeCore.getAdvancedMetrics().profitFactor).toBeCloseTo((1000 / 105 + 10 / 1.27) / 5, 8);
    });
});

describe('the scripts that read the conversion', () => {
    test('trades.html loads fx-convert.js before trade-core.js', () => {
        const html = read('public/trades.html');
        const fx = html.indexOf('<script src="js/fx-convert.js"></script>');
        expect(fx).toBeGreaterThan(0);
        expect(fx).toBeLessThan(html.indexOf('<script src="js/trade-core.js"></script>'));
    });

    test('the cards, the calendar and the "Most invested first" sort convert, and nothing adds the markets raw', () => {
        const cards = read('public/js/TradeUI-MetricCards.js');
        expect(cards).not.toMatch(/plByMarket\['India'\]\s*\+\s*plByMarket\['UK'\]/);
        expect(cards).toMatch(/cumulative \+= inPounds\(/);
        expect(cards).toMatch(/const dayPL = dayTrades\.reduce\(\(sum, t\) => sum \+ inPounds\(/);
        const filters = read('public/js/trade-filters.js');
        expect(filters).not.toMatch(/b\.investmentAmount - a\.investmentAmount/);
        expect(filters.match(/TradeCore\.inPounds\(/g)).toHaveLength(4);
        const charts = read('public/js/TradeUI-Charts.js');
        expect(charts).toMatch(/data\.map\(d => d\.avgPLPercent\)/);
    });

    test('the sold-trades P&L summary keeps UK P/L in pounds, as the server books it (it divided by 100 as if pence)', () => {
        const tradesUi = read('public/js/TradeUI-Trades.js');
        expect(tradesUi).not.toMatch(/plValue \/ 100/);
        expect(tradesUi).toMatch(/const displayPLValue = Number\(trade\.profitLoss \|\| trade\.plValue\) \|\| 0;/);
    });
});
