/**
 * The market-cap refresh (lib/shared/market-cap-service.js updateMarketCaps, run by
 * lib/scheduler/market-cap-updater.js at 06:00 UK on weekdays).
 *
 * Until 2026-09 it read meta.marketCap from Yahoo's v8 chart endpoint, one symbol a request.
 * That answer has no market-cap field, so ~5,000 requests every weekday stored nothing and said
 * nothing: prod's stock_market_caps table was empty. Pinned down here:
 *   1. Caps come from Yahoo's v7 quote, 50 symbols a request, with the cookie + crumb session the
 *      conviction engine uses (lib/shared/yahoo-client.js): one handshake for the whole run.
 *   2. Yahoo's real answer (2026-09-24): AAPL's cap is in dollars; VOD.L's price is in pence but
 *      its cap in pounds, so it is stored as GBP; RELIANCE.NS came back without a cap.
 *   3. A 401 gets one new crumb and one retry. A request that still fails counts its symbols as
 *      failed, and three in a row end the run: the rest are skipped, not hammered.
 *   4. Every symbol lands in exactly one count, by market, and the run ends with one summary
 *      line - an error line when nothing was stored.
 *   5. The updater keeps the counts of the last run for the admin stats, a failed run included.
 */

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('../../database-postgres', () => ({ pool: { query: jest.fn() }, storeMarketCap: jest.fn() }));

const axios = require('axios');
const TradeDB = require('../../database-postgres');
const YahooClient = require('../../lib/shared/yahoo-client');
const MarketCapService = require('../../lib/shared/market-cap-service');
const updater = require('../../lib/scheduler/market-cap-updater');

const QUOTE_URL = 'https://query2.finance.yahoo.com/v7/finance/quote';

// Yahoo's v7 answer for these three symbols on 2026-09-24, cut to the fields that matter here.
// VOD.L: 23,110,332,966 shares x 125p = £28,887,916,208 - the cap is in pounds, not pence.
const LIVE_2026_09_24 = [
    { symbol: 'AAPL', quoteType: 'EQUITY', currency: 'USD', financialCurrency: 'USD', exchange: 'NMS', regularMarketPrice: 337.02, sharesOutstanding: 14594180000, marketCap: 4918530277376 },
    { symbol: 'VOD.L', quoteType: 'EQUITY', currency: 'GBp', financialCurrency: 'EUR', exchange: 'LSE', regularMarketPrice: 125, sharesOutstanding: 23110332966, marketCap: 28887914496 },
    { symbol: 'RELIANCE.NS', quoteType: 'EQUITY', currency: 'INR', financialCurrency: 'INR', exchange: 'NSI', regularMarketPrice: 1228.7 }
];

const unauthorized = () => Object.assign(new Error('Request failed with status code 401'), {
    response: { status: 401, data: { finance: { result: null, error: { code: 'Unauthorized', description: 'Invalid Crumb' } } } }
});

/**
 * Yahoo: the cookie, a new crumb each time one is asked for, and the v7 quote answering from
 * `answer(symbols, callNumber)` - an array of quotes, or an Error to throw.
 */
function yahoo(answer) {
    let crumbs = 0;
    let quoteCalls = 0;
    axios.get.mockImplementation(async (url, config) => {
        if (url === 'https://fc.yahoo.com') return { status: 404, headers: { 'set-cookie': ['A3=d=AQAB; Path=/; Secure'] }, data: '' };
        if (url === 'https://query1.finance.yahoo.com/v1/test/getcrumb') return { status: 200, headers: {}, data: `crumb-${++crumbs}` };
        if (url === QUOTE_URL) {
            const result = answer(config.params.symbols.split(','), ++quoteCalls);
            if (result instanceof Error) throw result;
            return { status: 200, headers: {}, data: { quoteResponse: { result, error: null } } };
        }
        throw new Error('unexpected request: ' + url);
    });
}
const quoteRequests = () => axios.get.mock.calls.filter(([url]) => url === QUOTE_URL);
const handshakes = () => axios.get.mock.calls.filter(([url]) => url === 'https://fc.yahoo.com').length;
/** A v7 quote with a cap of 1bn dollars per symbol */
const capsFor = symbols => symbols.map(symbol => ({ symbol, currency: 'USD', marketCap: 1e9 }));
const symbolsNamed = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

let logSpy;
let errorSpy;

beforeEach(() => {
    YahooClient.invalidateSession();
    TradeDB.storeMarketCap.mockResolvedValue({});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('capFromQuote', () => {
    test('a cap in dollars, in pounds for a line quoted in pence, none for a quote without one', () => {
        const [aapl, vod, reliance] = LIVE_2026_09_24;

        expect(MarketCapService.capFromQuote(aapl)).toEqual({
            row: { marketCap: 4918530277376, marketCapUSD: 4918530277376, currency: 'USD', category: 'mega' }
        });
        expect(MarketCapService.capFromQuote(vod)).toEqual({
            row: { marketCap: 28887914496, marketCapUSD: 28887914496 * 1.27, currency: 'GBP', category: 'large' }
        });
        expect(MarketCapService.capFromQuote(reliance)).toEqual({ skip: 'noCap' });
    });

    test('pence written GBX count as pounds too; nothing, zero or junk is no cap; a currency without a rate is skipped', () => {
        expect(MarketCapService.capFromQuote({ symbol: 'X.L', currency: 'GBX', marketCap: 1e9 }).row).toMatchObject({ currency: 'GBP', marketCapUSD: 1.27e9 });
        expect(MarketCapService.capFromQuote({ symbol: 'X.NS', currency: 'INR', marketCap: 1e12 }).row).toMatchObject({ marketCapUSD: 1.2e10, category: 'large' });
        expect(MarketCapService.capFromQuote({ symbol: 'X', marketCap: 5e8 }).row).toMatchObject({ currency: 'USD', category: 'small' });
        for (const marketCap of [undefined, null, 0, -5, 'n/a']) {
            expect(MarketCapService.capFromQuote({ symbol: 'X', currency: 'USD', marketCap })).toEqual({ skip: 'noCap' });
        }
        expect(MarketCapService.capFromQuote({ symbol: 'X.SW', currency: 'CHF', marketCap: 1e9 })).toEqual({ skip: 'unknownCurrency' });
    });
});

describe('updateMarketCaps', () => {
    test('Yahoo\'s real answer: two caps stored, the Indian line counted as quoted without one', async () => {
        yahoo(() => LIVE_2026_09_24);

        const result = await MarketCapService.updateMarketCaps(['AAPL', 'VOD.L', 'RELIANCE.NS'], 50, 0);

        expect(TradeDB.storeMarketCap.mock.calls).toEqual([
            ['AAPL', 4918530277376, 4918530277376, 'mega', 'USD'],
            ['VOD.L', 28887914496, 28887914496 * 1.27, 'large', 'GBP']
        ]);
        expect(result).toEqual({
            requested: 3, updated: 2, noCap: 1, unknownCurrency: 0, notQuoted: 0, failed: 0, skipped: 0,
            requests: 1, failedRequests: 0, error: null,
            byMarket: { US: { requested: 1, updated: 1 }, UK: { requested: 1, updated: 1 }, India: { requested: 1, updated: 0 } }
        });
        expect(quoteRequests()[0][1].params).toEqual({ symbols: 'AAPL,VOD.L,RELIANCE.NS', crumb: 'crumb-1' });
        expect(logSpy).toHaveBeenCalledWith(
            '[MARKET CAP] Update complete: 2 of 3 stored (US 1/1, UK 1/1, India 0/1); no cap 1, unknown currency 0, ' +
            'not quoted 0, failed 0, skipped 0; 1 quote requests, 0 failed');
    });

    test('50 symbols a request: 120 symbols are 3 requests, behind one handshake', async () => {
        yahoo(capsFor);
        const symbols = symbolsNamed('S', 120);

        const result = await MarketCapService.updateMarketCaps(symbols, 50, 0);

        expect(quoteRequests().map(([, config]) => config.params.symbols.split(',').length)).toEqual([50, 50, 20]);
        expect(quoteRequests().flatMap(([, config]) => config.params.symbols.split(','))).toEqual(symbols);
        expect(handshakes()).toBe(1);
        expect(result).toMatchObject({ requested: 120, updated: 120, requests: 3, failedRequests: 0 });
        expect(TradeDB.storeMarketCap).toHaveBeenCalledTimes(120);
    });

    test('a batch size above 50 is held to 50', async () => {
        yahoo(capsFor);

        await MarketCapService.updateMarketCaps(symbolsNamed('S', 60), 500, 0);

        expect(quoteRequests().map(([, config]) => config.params.symbols.split(',').length)).toEqual([50, 10]);
    });

    test('a 401 in mid-run: one new crumb, the batch retried and stored', async () => {
        yahoo((symbols, call) => (call === 2 ? unauthorized() : capsFor(symbols)));

        const result = await MarketCapService.updateMarketCaps(symbolsNamed('S', 100), 50, 0);

        expect(quoteRequests().map(([, config]) => config.params.crumb)).toEqual(['crumb-1', 'crumb-1', 'crumb-2']);
        expect(result).toMatchObject({ updated: 100, failed: 0, requests: 2, failedRequests: 0 });
    });

    test('Yahoo refusing every crumb: three failed requests end the run, the rest skipped, and an error line says so', async () => {
        yahoo(() => unauthorized());

        const result = await MarketCapService.updateMarketCaps(symbolsNamed('S', 200), 50, 0);

        expect(quoteRequests()).toHaveLength(6);                    // 3 requests, each tried twice
        expect(result).toMatchObject({
            updated: 0, failed: 150, skipped: 50, requests: 3, failedRequests: 3,
            error: 'Request failed with status code 401'
        });
        expect(TradeDB.storeMarketCap).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(
            /^\[MARKET CAP\] Update complete: 0 of 200 stored \(US 0\/200\); .*failed 150, skipped 50; 3 quote requests, 3 failed; last error: Request failed with status code 401$/));
    });

    test('a failed request that the next one follows up resets the count: nothing is skipped', async () => {
        yahoo((symbols, call) => ([1, 3].includes(call) ? new Error('timeout of 20000ms exceeded') : capsFor(symbols)));

        const result = await MarketCapService.updateMarketCaps(symbolsNamed('S', 200), 50, 0);

        expect(result).toMatchObject({ updated: 100, failed: 100, skipped: 0, requests: 4, failedRequests: 2 });
    });

    test('symbols Yahoo leaves out, a currency without a rate, Yahoo\'s own spelling of a symbol', async () => {
        yahoo(() => [
            { symbol: 'vod.l', currency: 'GBp', marketCap: 2e10 },
            { symbol: 'NESN.SW', currency: 'CHF', marketCap: 2e11 },
            { symbol: 'UNASKED', currency: 'USD', marketCap: 1e9 }
        ]);

        const result = await MarketCapService.updateMarketCaps(['VOD.L', 'NESN.SW', 'BRK/B', 'GONE.NS'], 50, 0);

        expect(TradeDB.storeMarketCap.mock.calls).toEqual([['VOD.L', 2e10, 2e10 * 1.27, 'large', 'GBP']]);
        expect(result).toMatchObject({ requested: 4, updated: 1, unknownCurrency: 1, notQuoted: 2, noCap: 0 });
    });

    test('a row the database refuses is counted as failed, and the run goes on', async () => {
        yahoo(capsFor);
        TradeDB.storeMarketCap.mockImplementation(async symbol => {
            if (symbol === 'S1') throw new Error('value too long');
        });

        const result = await MarketCapService.updateMarketCaps(symbolsNamed('S', 3), 50, 0);

        expect(result).toMatchObject({ updated: 2, failed: 1, error: 'value too long' });
    });

    test('every symbol lands in exactly one count', async () => {
        yahoo((symbols, call) => (call === 1 ? new Error('socket hang up')
            : symbols.filter((_, i) => i % 3 !== 0).map((symbol, i) => ({ symbol, currency: i % 2 ? 'USD' : 'ZAc', marketCap: i % 5 ? 1e9 : 0 }))));

        const r = await MarketCapService.updateMarketCaps(symbolsNamed('S', 137), 50, 0);

        expect(r.updated + r.noCap + r.unknownCurrency + r.notQuoted + r.failed + r.skipped).toBe(137);
        expect(Object.values(r.byMarket).reduce((sum, m) => sum + m.updated, 0)).toBe(r.updated);
    });
});

describe('the updater', () => {
    test('a finished run: its counts, time and duration are kept for the admin stats', async () => {
        jest.spyOn(MarketCapService, 'updateMarketCaps').mockResolvedValue({ requested: 3, updated: 2, failed: 0, noCap: 1, notQuoted: 0, skipped: 0 });

        await updater.updateAllMarketCaps();

        expect(updater.getStatus().lastUpdate).toMatchObject({ requested: 3, updated: 2, noCap: 1, timestamp: expect.any(String), duration: expect.stringMatching(/minutes$/) });
        expect(MarketCapService.updateMarketCaps).toHaveBeenCalledWith(expect.any(Array), 50, 1000);
    });

    test('a run that fails outright is kept too, with its error', async () => {
        jest.spyOn(MarketCapService, 'updateMarketCaps').mockRejectedValue(new Error('boom'));

        expect(await updater.updateAllMarketCaps()).toEqual({ error: 'boom' });

        expect(updater.getStatus()).toMatchObject({ isUpdating: false, lastUpdate: { error: 'boom', timestamp: expect.any(String) } });
    });

    test('a one-market run (the admin refresh) is kept, named by its market', async () => {
        jest.spyOn(MarketCapService, 'updateMarketCaps').mockResolvedValue({ requested: 842, updated: 800, failed: 0 });

        await updater.updateMarketCapsByMarket('UK');

        expect(updater.getStatus().lastUpdate).toMatchObject({ market: 'UK', requested: 842, updated: 800 });
    });
});
