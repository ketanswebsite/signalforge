/**
 * The server's own Yahoo readers call lib/shared/yahoo-client.js in process, never this server's
 * /yahoo/* routes over HTTP - which is what lets those routes require a signed-in session.
 *
 *   the 7 AM scanner          fetchStockData()     five years of daily bars (the /yahoo/history CSV)
 *   the high-conviction book  fetchCurrentPrice()  the last close of seven days of bars
 *   the exit monitor          fetchCurrentPrice()  the live price (the /yahoo/quote chart)
 *
 * Each is pinned to Yahoo's own URL with the symbol encoded, never to BASE_URL: through the proxy,
 * ?symbol=M&M.NS reached Express as "M", and M&M.NS, M&MFIN.NS, J&KBANK.NS and seven more Indian
 * lines were read from another company's chart. And each reads the answer as it did before.
 */

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
// Under jsdom, jest resolves cheerio's "browser" build, which is ESM and will not parse
jest.mock('cheerio', () => ({ load: jest.fn() }));
jest.mock('../../database-postgres', () => ({ pool: { query: jest.fn() } }));
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

const axios = require('axios');
const StockScanner = require('../../lib/scanner/scanner');
const HighConvictionPortfolioManager = require('../../lib/portfolio/high-conviction-manager');
const monitor = require('../../lib/portfolio/exit-monitor');

const DAY = 86400;
const LAST_BAR = 1789714800; // 2026-09-18
const CHART = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const BASE_URL = 'http://127.0.0.1:9';   // nothing listens there: a call to it would fail the test

/** A Yahoo chart answer: one daily bar per close, ending at LAST_BAR */
function chart(closes, meta = {}) {
    const n = closes.length;
    return {
        chart: {
            result: [{
                meta: { regularMarketPrice: closes[n - 1], regularMarketTime: LAST_BAR + 8 * 3600, ...meta },
                timestamp: closes.map((_, i) => LAST_BAR - (n - 1 - i) * DAY),
                indicators: {
                    quote: [{
                        open: closes.map(c => c - 1),
                        high: closes.map(c => c + 2),
                        low: closes.map(c => c - 2),
                        close: closes.slice(),
                        volume: closes.map((_, i) => 1000 + i)
                    }],
                    adjclose: [{ adjclose: closes.map(c => c - 0.5) }]
                }
            }],
            error: null
        }
    };
}

const envAtStart = process.env.BASE_URL;

beforeEach(() => {
    process.env.BASE_URL = BASE_URL;
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
    if (envAtStart === undefined) delete process.env.BASE_URL;
    else process.env.BASE_URL = envAtStart;
});

const onlyYahoo = () => {
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][0].startsWith(CHART)).toBe(true);
};

test('the scanner reads M&M.NS\'s own five years of bars, and parses them as before', async () => {
    const closes = Array.from({ length: 60 }, (_, i) => 3000 + i);
    axios.get.mockResolvedValue({ status: 200, headers: {}, data: chart(closes) });
    const now = Math.floor(Date.now() / 1000);

    const data = await new StockScanner().fetchStockData('M&M.NS');

    onlyYahoo();
    const [url, config] = axios.get.mock.calls[0];
    expect(url).toBe(CHART + 'M%26M.NS');
    expect(config.timeout).toBe(10000);
    expect(config.params).toMatchObject({ interval: '1d', includeAdjustedClose: true });
    expect(config.params.period2 - config.params.period1).toBe(5 * 365 * DAY);
    expect(Math.abs(config.params.period2 - now)).toBeLessThan(5);

    expect(data.symbol).toBe('M&M.NS');
    expect(data.close).toEqual(closes);
    expect(data.high).toEqual(closes.map(c => c + 2));
    expect(data.low).toEqual(closes.map(c => c - 2));
    expect(data.dates[0]).toBe('2026-07-21');
    expect(data.dates[59]).toBe('2026-09-18');
    expect(data.currentPrice).toBe(3059);
    expect(data.dti).toHaveLength(60);
});

test('the scanner still gives up quietly: no bars, or Yahoo failing, is null', async () => {
    axios.get.mockResolvedValue({ status: 200, headers: {}, data: { chart: { result: [], error: null } } });
    expect(await new StockScanner().fetchStockData('GONE.NS')).toBeNull();

    axios.get.mockRejectedValue(new Error('timeout of 10000ms exceeded'));
    expect(await new StockScanner().fetchStockData('SLOW.NS')).toBeNull();
});

test('the high-conviction book prices J&KBANK.NS from its own last close of seven days', async () => {
    axios.get.mockResolvedValue({ status: 200, headers: {}, data: chart([101, 102, 103.25]) });

    const price = await new HighConvictionPortfolioManager().fetchCurrentPrice('J&KBANK.NS');

    onlyYahoo();
    const [url, config] = axios.get.mock.calls[0];
    expect(url).toBe(CHART + 'J%26KBANK.NS');
    expect(config.timeout).toBe(10000);
    expect(config.params.period2 - config.params.period1).toBe(7 * DAY);
    expect(price).toBe(103.25);
});

test('the high-conviction book: no bars is no price', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    axios.get.mockResolvedValue({ status: 200, headers: {}, data: { chart: { result: [], error: null } } });

    expect(await new HighConvictionPortfolioManager().fetchCurrentPrice('GONE.NS')).toBeNull();
});

test('the exit monitor prices S&SPOWER.NS from the live quote of its own one-day chart', async () => {
    axios.get.mockResolvedValue({ status: 200, headers: {}, data: chart([50, 51], { regularMarketPrice: 51.7 }) });

    const price = await monitor.fetchCurrentPrice('S&SPOWER.NS');

    onlyYahoo();
    expect(axios.get.mock.calls[0]).toEqual([CHART + 'S%26SPOWER.NS', expect.objectContaining({
        params: { interval: '1d', range: '1d' },
        timeout: 20000
    })]);
    expect(price).toBe(51.7);
});

test('the exit monitor: a failed request is no price, and a timeout is named as one', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    axios.get.mockRejectedValue(Object.assign(new Error('timeout of 20000ms exceeded'), { code: 'ECONNABORTED' }));

    expect(await monitor.fetchCurrentPrice('SLOW.L')).toBeNull();

    expect(errors).toHaveBeenCalledWith('Timeout fetching price for SLOW.L after 20s');
});
