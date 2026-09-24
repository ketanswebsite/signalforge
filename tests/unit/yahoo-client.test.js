/**
 * The in-process Yahoo client (lib/shared/yahoo-client.js).
 *
 * The scanner, the high-conviction manager and the exit monitor used to fetch Yahoo through this
 * server's own /yahoo/* routes over HTTP; they call this module now, and the routes serve only
 * signed-in pages. Pinned down here:
 *   1. Every symbol is URL-encoded into Yahoo's path. Through the proxy the scanner sent
 *      ?symbol=M&M.NS unencoded, which Express reads as "M" (Macy's).
 *   2. The one-day chart and the history make the requests the routes made: the same URL,
 *      parameters and headers, with the caller's timeout.
 *   3. The history is the CSV GET /yahoo/history served: empty cells for missing values, Adj
 *      Close falling back to Close, the one-year daily default, null when Yahoo has no bars.
 *   4. Both repairs stay detect-only until their switches are on, and report in one line each
 *      (the route sends them as headers); one log line per symbol per process.
 *   5. The cookie + crumb session is fetched once, kept 30 minutes, and dropped on request.
 *   6. The v7 quote takes 1 to 50 symbols; a 401 gets one new session and one retry, no more.
 */

jest.mock('axios', () => ({ get: jest.fn() }));

const axios = require('axios');
const YahooClient = require('../../lib/shared/yahoo-client');

const DAY = 86400;
const LAST_BAR = 1789714800; // 2026-09-18
const HEADER = 'Date,Open,High,Low,Close,Adj Close,Volume\n';

/** A Yahoo chart.result[0]: one daily bar per close, ending at LAST_BAR */
function chartResult(closes, { quote = closes[closes.length - 1], volume = 100000 } = {}) {
    const n = closes.length;
    const column = factor => closes.map(c => (c == null ? null : +(c * factor).toFixed(6)));
    return {
        meta: { regularMarketPrice: quote, regularMarketTime: LAST_BAR + 8 * 3600 },
        timestamp: closes.map((_, i) => LAST_BAR - (n - 1 - i) * DAY),
        indicators: {
            quote: [{
                open: column(0.995),
                high: column(1.01),
                low: column(0.99),
                close: closes.slice(),
                volume: closes.map(c => (c == null ? null : volume))
            }],
            adjclose: [{ adjclose: closes.slice() }]
        }
    };
}

/** The same result with bars from..to reported in the major unit (every price / 100, no volume) */
function flipped(result, from, to) {
    const copy = JSON.parse(JSON.stringify(result));
    const q = copy.indicators.quote[0];
    for (let i = from; i <= to; i++) {
        for (const field of ['open', 'high', 'low', 'close']) q[field][i] = q[field][i] / 100;
        copy.indicators.adjclose[0].adjclose[i] = copy.indicators.adjclose[0].adjclose[i] / 100;
        q.volume[i] = 0;
    }
    return copy;
}

/** 40 ordinary daily closes around 250p: a seeded walk, so every run sees the same bars */
function walk(n = 40, start = 250) {
    const closes = [];
    let seed = 7;
    let price = start;
    for (let i = 0; i < n; i++) {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        price *= 1 + (seed / 4294967296 - 0.5) * 0.02;
        closes.push(+price.toFixed(4));
    }
    return closes;
}

/** The close column of a history CSV */
const csvCloses = csv => csv.trim().split('\n').slice(1).map(row => parseFloat(row.split(',')[4]));

const serve = result => axios.get.mockResolvedValue({ status: 200, headers: {}, data: { chart: { result: [result], error: null } } });

const FLAGS = ['PRICE_UNIT_REPAIR', 'STALE_FILL_REPAIR'];
const flagsAtStart = Object.fromEntries(FLAGS.map(flag => [flag, process.env[flag]]));
let logSpy;

beforeEach(() => {
    FLAGS.forEach(flag => delete process.env[flag]);
    YahooClient.invalidateSession();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
    for (const flag of FLAGS) {
        if (flagsAtStart[flag] === undefined) delete process.env[flag];
        else process.env[flag] = flagsAtStart[flag];
    }
});

describe('the v8 chart', () => {
    test('a symbol with & or / reaches Yahoo as itself', async () => {
        serve(chartResult([10, 11]));

        await YahooClient.fetchChart('M&M.NS', { range: '1d', interval: '1d' });
        await YahooClient.fetchChart('BRK/B', { range: '1d', interval: '1d' });

        expect(axios.get.mock.calls[0][0]).toBe('https://query1.finance.yahoo.com/v8/finance/chart/M%26M.NS');
        expect(axios.get.mock.calls[1][0]).toBe('https://query1.finance.yahoo.com/v8/finance/chart/BRK%2FB');
    });

    test('the one-day chart is the request /yahoo/quote made, and Yahoo\'s answer comes back untouched', async () => {
        const result = chartResult([100, 101]);
        serve(result);

        const data = await YahooClient.fetchQuoteChart('VOD.L', { timeout: 20000 });

        expect(axios.get).toHaveBeenCalledWith('https://query1.finance.yahoo.com/v8/finance/chart/VOD.L', {
            params: { interval: '1d', range: '1d' },
            headers: { 'User-Agent': YahooClient.USER_AGENT, 'Accept': 'application/json' },
            timeout: 20000
        });
        expect(data).toEqual({ chart: { result: [result], error: null } });
    });

    test('without a timeout of its own a request waits 45 s, as the routes did', async () => {
        serve(chartResult([100, 101]));

        await YahooClient.fetchQuoteChart('AAPL');

        expect(axios.get.mock.calls[0][1].timeout).toBe(45000);
    });

    test('Yahoo\'s errors reach the caller as they came', async () => {
        axios.get.mockRejectedValue(Object.assign(new Error('Request failed with status code 404'), { response: { status: 404 } }));

        await expect(YahooClient.fetchQuoteChart('NOPE.L')).rejects.toThrow('status code 404');
    });
});

describe('the history CSV (what GET /yahoo/history serves)', () => {
    test('the request: the caller\'s window and interval, adjusted closes included', async () => {
        serve(chartResult([100, 101]));

        await YahooClient.fetchHistoryCsv('J&KBANK.NS', { period1: 1000, period2: 2000, interval: '1d' }, { timeout: 10000 });

        expect(axios.get).toHaveBeenCalledWith('https://query1.finance.yahoo.com/v8/finance/chart/J%26KBANK.NS', {
            params: { period1: 1000, period2: 2000, interval: '1d', includeAdjustedClose: true },
            headers: { 'User-Agent': YahooClient.USER_AGENT, 'Accept': 'application/json' },
            timeout: 10000
        });
    });

    test('no window given: the last year, daily', async () => {
        serve(chartResult([100, 101]));
        const now = Math.floor(Date.now() / 1000);

        await YahooClient.fetchHistoryCsv('AAPL');

        const { params } = axios.get.mock.calls[0][1];
        expect(params.interval).toBe('1d');
        expect(params.period2 - now).toBeGreaterThanOrEqual(0);
        expect(params.period2 - now).toBeLessThan(5);
        expect(params.period2 - params.period1).toBe(365 * DAY);
    });

    test('the CSV: empty cells for missing values, Adj Close falls back to Close', async () => {
        const n = 4;
        serve({
            meta: {},
            timestamp: [0, 1, 2, 3].map(i => LAST_BAR - (n - 1 - i) * DAY),
            indicators: {
                quote: [{
                    open: [99, 100, null, 101],
                    high: [101, 102, null, 103],
                    low: [98, 99, null, 100],
                    close: [100, 101.5, null, 102],
                    volume: [1000, 0, null, 3000]
                }],
                adjclose: [{ adjclose: [99.5, null, null, 101.4] }]
            }
        });

        const history = await YahooClient.fetchHistoryCsv('PLAIN.L');

        expect(history).toEqual({
            csv: HEADER +
                '2026-09-15,99,101,98,100,99.5,1000\n' +
                '2026-09-16,100,102,99,101.5,101.5,\n' +
                '2026-09-17,,,,,,\n' +
                '2026-09-18,101,103,100,102,101.4,3000\n',
            priceUnitRepair: null,
            staleFillRepair: null
        });
    });

    test('no bars for the symbol: null (the route answers 404)', async () => {
        axios.get.mockResolvedValue({ status: 200, headers: {}, data: { chart: { result: [], error: null } } });

        expect(await YahooClient.fetchHistoryCsv('GONE.L')).toBeNull();
    });

    test('a pence/pounds flip is reported but not repaired while PRICE_UNIT_REPAIR is off', async () => {
        const clean = chartResult(walk());
        const result = flipped(clean, 15, 19);
        serve(result);

        const history = await YahooClient.fetchHistoryCsv('FLIPOFF.L');

        expect(csvCloses(history.csv)).toEqual(result.indicators.quote[0].close);
        expect(history.priceUnitRepair).toMatch(/^repaired; .*applied=false$/);
        expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/^\[yahoo\/history\] FLIPOFF\.L price units: repaired; .*applied=false$/));
    });

    test('with PRICE_UNIT_REPAIR=true the flipped bars come back in pence', async () => {
        process.env.PRICE_UNIT_REPAIR = 'true';
        const clean = chartResult(walk());
        serve(flipped(clean, 15, 19));

        const history = await YahooClient.fetchHistoryCsv('FLIPON.L');

        csvCloses(history.csv).forEach((close, i) => expect(close).toBeCloseTo(clean.indicators.quote[0].close[i], 6));
        expect(history.priceUnitRepair).toMatch(/applied=true$/);
    });

    test('a stale fill (HOME.L\'s suspension price between trades) is reported but served as it came while STALE_FILL_REPAIR is off', async () => {
        const closes = [38.05, 38.05, 10, 38.05, 10, 10, 10, 38.05, 11, 11];
        const volume = [0, 0, 10444650, 0, 9538214, 156230, 53500, 0, 172201, 25117809];
        const result = chartResult(closes, { quote: 11 });
        result.indicators.quote[0].volume = volume;
        ['open', 'high', 'low'].forEach(field => { result.indicators.quote[0][field] = closes.slice(); });
        serve(result);

        const history = await YahooClient.fetchHistoryCsv('STALE.L');

        expect(csvCloses(history.csv)).toEqual(closes);
        expect(history.staleFillRepair).toMatch(/^repaired; .*applied=false$/);

        process.env.STALE_FILL_REPAIR = 'true';
        const repaired = await YahooClient.fetchHistoryCsv('STALE.L');
        expect(csvCloses(repaired.csv)).toEqual([38.05, 38.05, 10, 10, 10, 10, 10, 10, 11, 11]);
        expect(repaired.staleFillRepair).toMatch(/applied=true$/);
    });

    test('one log line per symbol, however many readers ask', async () => {
        serve(flipped(chartResult(walk()), 15, 19));

        await YahooClient.fetchHistoryCsv('ONCE.L');
        await YahooClient.fetchHistoryCsv('ONCE.L');

        expect(logSpy.mock.calls.filter(([line]) => String(line).includes('ONCE.L price units'))).toHaveLength(1);
    });
});

describe('the cookie + crumb session', () => {
    const cookieAnswer = { status: 404, headers: { 'set-cookie': ['A3=d=AQABBxyz&S=AQAAAabc; Expires=Fri, 24 Sep 2027 06:00:00 GMT; Domain=.yahoo.com; Path=/; SameSite=None; Secure; HttpOnly'] }, data: '' };

    function yahooHandsOut(crumbs) {
        let next = 0;
        axios.get.mockImplementation(async url => {
            if (url === 'https://fc.yahoo.com') return cookieAnswer;
            if (url === 'https://query1.finance.yahoo.com/v1/test/getcrumb') return { status: 200, headers: {}, data: crumbs[next++] };
            throw new Error('unexpected request: ' + url);
        });
    }

    test('fetched once, then kept', async () => {
        yahooHandsOut(['crumb-1', 'crumb-2']);

        const first = await YahooClient.getSession();
        const second = await YahooClient.getSession();

        expect(first).toMatchObject({ cookie: 'A3=d=AQABBxyz&S=AQAAAabc', crumb: 'crumb-1' });
        expect(second).toBe(first);
        expect(axios.get).toHaveBeenCalledTimes(2);
        expect(axios.get.mock.calls[1][1].headers).toEqual({ 'User-Agent': YahooClient.USER_AGENT, 'Cookie': 'A3=d=AQABBxyz&S=AQAAAabc' });
    });

    test('kept for 30 minutes, then fetched again', async () => {
        yahooHandsOut(['crumb-1', 'crumb-2']);
        const start = Date.now();
        const clock = jest.spyOn(Date, 'now').mockReturnValue(start);

        await YahooClient.getSession();
        clock.mockReturnValue(start + 29 * 60 * 1000);
        expect((await YahooClient.getSession()).crumb).toBe('crumb-1');
        clock.mockReturnValue(start + 31 * 60 * 1000);
        expect((await YahooClient.getSession()).crumb).toBe('crumb-2');
    });

    test('dropped on request', async () => {
        yahooHandsOut(['crumb-1', 'crumb-2']);

        await YahooClient.getSession();
        YahooClient.invalidateSession();

        expect((await YahooClient.getSession()).crumb).toBe('crumb-2');
    });

    test('no cookie, or a crumb that is an HTML page: an error, and nothing kept', async () => {
        axios.get.mockResolvedValueOnce({ status: 404, headers: {}, data: '' });
        await expect(YahooClient.getSession()).rejects.toThrow('No Yahoo cookie');

        yahooHandsOut(['<html>consent</html>', 'crumb-2']);
        await expect(YahooClient.getSession()).rejects.toThrow('No Yahoo crumb');
        expect((await YahooClient.getSession()).crumb).toBe('crumb-2');
    });
});

describe('the v7 quote', () => {
    const QUOTE_URL = 'https://query2.finance.yahoo.com/v7/finance/quote';
    const unauthorized = () => Object.assign(new Error('Request failed with status code 401'), {
        response: { status: 401, data: { finance: { result: null, error: { code: 'Unauthorized', description: 'Invalid Crumb' } } } }
    });

    /** Yahoo, with the v7 answers (or errors) served in order */
    function yahoo(v7Answers) {
        let crumbs = 0;
        const answers = v7Answers.slice();
        axios.get.mockImplementation(async (url, config) => {
            if (url === 'https://fc.yahoo.com') return { status: 404, headers: { 'set-cookie': ['A3=cookie; Path=/'] }, data: '' };
            if (url === 'https://query1.finance.yahoo.com/v1/test/getcrumb') return { status: 200, headers: {}, data: `crumb-${++crumbs}` };
            if (url === QUOTE_URL) {
                const next = answers.shift();
                if (next instanceof Error) throw next;
                return { status: 200, headers: {}, data: { quoteResponse: { result: next, error: null } } };
            }
            throw new Error('unexpected request: ' + url);
        });
    }
    const v7Calls = () => axios.get.mock.calls.filter(([url]) => url === QUOTE_URL);

    test('the request: the symbols in one parameter, the crumb, the cookie', async () => {
        yahoo([[{ symbol: 'M&M.NS', marketCap: 1 }]]);

        const quotes = await YahooClient.fetchQuotes(['AAPL', 'M&M.NS']);

        expect(quotes).toEqual([{ symbol: 'M&M.NS', marketCap: 1 }]);
        expect(v7Calls()).toEqual([[QUOTE_URL, {
            params: { symbols: 'AAPL,M&M.NS', crumb: 'crumb-1' },
            headers: { 'User-Agent': YahooClient.USER_AGENT, 'Cookie': 'A3=cookie', 'Accept': 'application/json' },
            timeout: 20000
        }]]);
    });

    test('a 401 (a crumb Yahoo no longer takes): one new session, one retry', async () => {
        yahoo([unauthorized(), [{ symbol: 'AAPL', marketCap: 2 }]]);

        const quotes = await YahooClient.fetchQuotes(['AAPL']);

        expect(quotes).toEqual([{ symbol: 'AAPL', marketCap: 2 }]);
        expect(v7Calls().map(([, config]) => config.params.crumb)).toEqual(['crumb-1', 'crumb-2']);
    });

    test('a second 401 is thrown, and there is no third try', async () => {
        yahoo([unauthorized(), unauthorized(), [{ symbol: 'AAPL' }]]);

        await expect(YahooClient.fetchQuotes(['AAPL'])).rejects.toThrow('status code 401');
        expect(v7Calls()).toHaveLength(2);
    });

    test('any other failure is thrown at once, the session kept', async () => {
        yahoo([Object.assign(new Error('Request failed with status code 429'), { response: { status: 429 } })]);

        await expect(YahooClient.fetchQuotes(['AAPL'])).rejects.toThrow('status code 429');
        expect(v7Calls()).toHaveLength(1);
        expect(axios.get.mock.calls.filter(([url]) => url.endsWith('/getcrumb'))).toHaveLength(1);
    });

    test('an answer without quoteResponse.result is an error, not an empty list', async () => {
        axios.get.mockImplementation(async url => (url === 'https://fc.yahoo.com'
            ? { status: 404, headers: { 'set-cookie': ['A3=cookie'] }, data: '' }
            : url.endsWith('/getcrumb') ? { status: 200, headers: {}, data: 'crumb' } : { status: 200, headers: {}, data: '<html></html>' }));

        await expect(YahooClient.fetchQuotes(['AAPL'])).rejects.toThrow('no quoteResponse.result');
    });

    test('1 to 50 symbols a request', async () => {
        const fiftyOne = Array.from({ length: 51 }, (_, i) => `S${i}`);

        await expect(YahooClient.fetchQuotes([])).rejects.toThrow('1 to 50 symbols');
        await expect(YahooClient.fetchQuotes(fiftyOne)).rejects.toThrow('1 to 50 symbols');
        expect(axios.get).not.toHaveBeenCalled();
        expect(YahooClient.QUOTE_BATCH_MAX).toBe(50);
    });
});
