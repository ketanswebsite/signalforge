/**
 * Yahoo's throttling (2026-09-25): the server's 06:00 market-cap refresh met 429s on all three quote requests while
 * the same code works from a home network and Yahoo's chart endpoint still answers the server. Pinned here:
 *   1. The handshake (lib/shared/yahoo-client.js getSession) names the step Yahoo refused - cookie or crumb - and keeps
 *      its status where axios puts one, so the dead-ticker record still reads a 429 as "throttled"; the crumb falls back
 *      from query1 to query2.
 *   2. checkSession() (POST /api/ops/yahoo-check) reports each step and never throws.
 *   3. The refresh (lib/shared/market-cap-service.js) waits and asks again on a 429, twice, before a request counts as
 *      failed, and names the refused step (errorStep).
 *   4. The 06:00 job returns the run's counts, so job_runs keeps them.
 */

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('../../database-postgres', () => ({ pool: { query: jest.fn() }, storeMarketCap: jest.fn() }));

const axios = require('axios');
const cron = require('node-cron');
const TradeDB = require('../../database-postgres');
const YahooClient = require('../../lib/shared/yahoo-client');
const MarketCapService = require('../../lib/shared/market-cap-service');
const TickerHealth = require('../../lib/shared/ticker-health');

const COOKIE = 'https://fc.yahoo.com';
const CRUMB1 = 'https://query1.finance.yahoo.com/v1/test/getcrumb';
const CRUMB2 = 'https://query2.finance.yahoo.com/v1/test/getcrumb';
const QUOTE = 'https://query2.finance.yahoo.com/v7/finance/quote';
const refused = status => Object.assign(new Error('Request failed with status code ' + status), { response: { status, data: 'Too Many Requests' } });
const throttled = () => refused(429);

/** Yahoo answering each step as told: a status for the cookie and the crumbs, a function for the quote */
function yahoo({ cookie = 404, setCookie = true, crumb1 = 200, crumb2 = 200, quote = symbols => symbols.map(symbol => ({ symbol, currency: 'USD', marketCap: 1e9 })) } = {}) {
    let quoteCalls = 0;
    axios.get.mockImplementation(async (url, config) => {
        if (url === COOKIE) return { status: cookie, headers: setCookie ? { 'set-cookie': ['A3=d=AQAB; Path=/; Secure'] } : {}, data: '' };
        if (url === CRUMB1) { if (crumb1 !== 200) throw refused(crumb1); return { status: 200, headers: {}, data: 'crumb-one' }; }
        if (url === CRUMB2) { if (crumb2 !== 200) throw refused(crumb2); return { status: 200, headers: {}, data: 'crumb-two' }; }
        if (url === QUOTE) {
            const result = quote(config.params.symbols.split(','), ++quoteCalls, config.params.crumb);
            if (result instanceof Error) throw result;
            return { status: 200, headers: {}, data: { quoteResponse: { result, error: null } } };
        }
        throw new Error('unexpected request: ' + url);
    });
}
const calls = url => axios.get.mock.calls.filter(([u]) => u === url).length;

beforeEach(() => {
    axios.get.mockReset();
    YahooClient.invalidateSession();
    TradeDB.storeMarketCap.mockResolvedValue({});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('the handshake', () => {
    test('query1 refusing the crumb: query2 gives one, and the handshake records both', async () => {
        yahoo({ crumb1: 429 });
        const session = await YahooClient.getSession();
        expect(session.crumb).toBe('crumb-two');
        expect(YahooClient.getLastHandshake()).toMatchObject({
            cookie: { status: 404, names: ['A3'] },
            crumb: [{ host: 'query1.finance.yahoo.com', status: 429, ok: false }, { host: 'query2.finance.yahoo.com', status: 200, ok: true }]
        });
    });

    test('both crumbs refused: the error names the crumb step and keeps the 429, which the dead-ticker record reads as throttled', async () => {
        yahoo({ crumb1: 429, crumb2: 429 });
        const error = await YahooClient.getSession().catch(e => e);
        expect(error).toMatchObject({ yahooStep: 'crumb', response: { status: 429 } });
        expect(error.message).toBe('No Yahoo crumb from query1 or query2 (the crumb request answered 429)');
        expect(TickerHealth.classifyError(error)).toBe('throttled');
    });

    test('no cookie: the error names the cookie step and its status', async () => {
        yahoo({ cookie: 429, setCookie: false });
        const error = await YahooClient.getSession().catch(e => e);
        expect(error).toMatchObject({ yahooStep: 'cookie', response: { status: 429 } });
        expect(calls(CRUMB1)).toBe(0);
    });

    test('a crumb that is an HTML page (a consent page) is not an HTTP refusal: no second host, "No Yahoo crumb" as before', async () => {
        yahoo();
        axios.get.mockImplementation(async url => {
            if (url === COOKIE) return { status: 404, headers: { 'set-cookie': ['A3=d=AQAB; Path=/; Secure'] }, data: '' };
            if (url === CRUMB1) return { status: 200, headers: {}, data: '<html>consent</html>' };
            throw new Error('unexpected request: ' + url);
        });
        await expect(YahooClient.getSession()).rejects.toThrow('No Yahoo crumb (the crumb request answered 200)');
        expect(calls(CRUMB2)).toBe(0);
    });

    test('a quote Yahoo refuses carries the quote step', async () => {
        yahoo({ quote: () => throttled() });
        const error = await YahooClient.fetchQuotes(['AAPL']).catch(e => e);
        expect(error).toMatchObject({ yahooStep: 'quote', response: { status: 429 } });
    });
});

describe('checkSession (POST /api/ops/yahoo-check)', () => {
    test('everything answered: ok, each cap, and the handshake', async () => {
        yahoo({ quote: symbols => symbols.map(symbol => ({ symbol, marketCap: symbol === 'RELIANCE.NS' ? undefined : 5e9 })) });
        const report = await YahooClient.checkSession();
        expect(report).toMatchObject({ ok: true, error: null, quote: { status: 200, caps: { AAPL: 5e9, 'VOD.L': 5e9, 'RELIANCE.NS': null } } });
        expect(report.handshake.crumb).toEqual([{ host: 'query1.finance.yahoo.com', status: 200, ok: true }]);
        expect(typeof report.ms).toBe('number');
    });

    test('Yahoo throttling the crumb: not ok, the step and status named, and it never throws', async () => {
        yahoo({ crumb1: 429, crumb2: 429 });
        const report = await YahooClient.checkSession();
        expect(report).toMatchObject({ ok: false, quote: null, error: { step: 'crumb', status: 429 } });
        expect(calls(QUOTE)).toBe(0);
    });

    test('a fresh handshake each time, even with a session in hand', async () => {
        yahoo();
        await YahooClient.getSession();
        await YahooClient.checkSession();
        expect(calls(COOKIE)).toBe(2);
    });
});

describe('the refresh waits out a 429', () => {
    const symbols = n => Array.from({ length: n }, (_, i) => 'S' + i);

    test('a 429 then an answer: the batch is stored, nothing failed, the 429 counted', async () => {
        yahoo({ quote: (batch, call) => (call === 1 ? throttled() : batch.map(symbol => ({ symbol, currency: 'USD', marketCap: 1e9 }))) });
        const result = await MarketCapService.updateMarketCaps(symbols(50), 50, 0, { throttleBackoffMs: 0 });
        expect(result).toMatchObject({ updated: 50, failed: 0, requests: 1, failedRequests: 0, throttled: 1, error: null, errorStep: null });
    });

    test('Yahoo throttling every quote: each request asked three times, three failures end the run, the step named', async () => {
        yahoo({ quote: () => throttled() });
        const result = await MarketCapService.updateMarketCaps(symbols(200), 50, 0, { throttleBackoffMs: 0 });
        expect(calls(QUOTE)).toBe(9);
        expect(result).toMatchObject({ updated: 0, failed: 150, skipped: 50, requests: 3, failedRequests: 3, throttled: 6, errorStep: 'quote' });
    });

    test('a handshake Yahoo throttles is waited out the same way, and named when it never comes', async () => {
        yahoo({ crumb1: 429, crumb2: 429 });
        const result = await MarketCapService.updateMarketCaps(symbols(50), 50, 0, { throttleBackoffMs: 0 });
        expect(result).toMatchObject({ updated: 0, failedRequests: 1, throttled: 2, errorStep: 'crumb' });
        expect(result.error).toBe('No Yahoo crumb from query1 or query2 (the crumb request answered 429)');
    });

    test('the wait doubles: 60 s, then 120 s, by default', async () => {
        jest.useFakeTimers({ doNotFake: ['nextTick'] });
        try {
            yahoo({ quote: (batch, call) => (call <= 2 ? throttled() : batch.map(symbol => ({ symbol, currency: 'USD', marketCap: 1e9 }))) });
            const run = MarketCapService.updateMarketCaps(symbols(1), 50, 0);
            await jest.advanceTimersByTimeAsync(1);
            expect(calls(QUOTE)).toBe(1);       // the first answer was a 429: waiting 60 s
            await jest.advanceTimersByTimeAsync(60000);
            expect(calls(QUOTE)).toBe(2);
            await jest.advanceTimersByTimeAsync(119000);
            expect(calls(QUOTE)).toBe(2);       // the second wait is 120 s
            await jest.advanceTimersByTimeAsync(1000);
            const result = await run;
            expect(result).toMatchObject({ updated: 1, throttled: 2, failedRequests: 0 });
        } finally {
            jest.useRealTimers();
        }
    });
});

describe('the 06:00 job hands its counts to job_runs', () => {
    test('the scheduled function returns the run\'s result', async () => {
        const updater = require('../../lib/scheduler/market-cap-updater');
        updater.initialize();
        const weekday = cron.schedule.mock.calls.find(([expression]) => expression === '0 6 * * 1-5');
        expect(weekday).toBeDefined();
        const result = { requested: 1, updated: 1 };
        jest.spyOn(updater, 'updateAllMarketCaps').mockResolvedValue(result);
        await expect(weekday[1]()).resolves.toBe(result);
    });
});
