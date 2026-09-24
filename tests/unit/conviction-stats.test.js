/**
 * ml/conviction-sweep.js getVerdictStats() - the read-only picture of conviction_daily
 * behind GET /api/ops/conviction-stats.
 *
 * It exists to answer one question on production: "did the monthly sweep really re-score
 * the universe?" A genuine sweep is a universe-sized spike on one date; verdicts scored
 * on demand are a smear of small counts. Pinned down here:
 *   1. It only ever SELECTs.
 *   2. The history window and the "being served today" window are the right dates - the
 *      second one must be the engine's read window, not the history window.
 *   3. servedUntil is the last day the read window still accepts a verdict: scored on
 *      2026-08-29, served through 2026-10-04 - one day AFTER the 2026-10-03 sweep.
 *   4. A database error is surfaced, never reported as zeros.
 */

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../database-postgres', () => ({ pool: { query: jest.fn() } }));
// Under jsdom, jest resolves cheerio's "browser" build, which is ESM and will not parse
jest.mock('cheerio', () => ({ load: jest.fn() }));
jest.mock('../../lib/shared/stock-data', () => ({ getAllStocks: jest.fn() }));

const db = require('../../database-postgres');
const StockData = require('../../lib/shared/stock-data');
const { getVerdictStats } = require('../../ml/conviction-sweep');

const ENV = ['CONVICTION_MAX_AGE_DAYS', 'CONVICTION_SWEEP_RESUME_DAYS', 'CONVICTION_SWEEP', 'CONVICTION_SWEEP_FRESH',
    'CONVICTION_SWEEP_BOOT_RESUME', 'CONVICTION_SWEEP_WATCHDOG', 'CONVICTION_SWEEP_ALERTS', 'GEMINI_API_KEY'];
const envAtStart = Object.fromEntries(ENV.map(k => [k, process.env[k]]));

// restoreMocks wipes jest.fn() implementations before every test, so each test installs its own
function serveRows({ byDate = [], served = [], totals = { verdicts: 0, symbols: 0, oldest: null, newest: null } } = {}) {
    db.pool.query.mockImplementation(async (sql) => {
        if (/GROUP BY score_date/.test(sql)) return { rows: byDate };
        if (/GROUP BY newest/.test(sql)) return { rows: served };
        return { rows: [totals] };
    });
}

beforeEach(() => {
    for (const k of ENV) delete process.env[k];
    jest.useFakeTimers().setSystemTime(new Date('2026-09-19T20:00:00Z'));
    StockData.getAllStocks.mockReturnValue([{ symbol: 'AAA' }, { symbol: 'BBB' }, { symbol: 'AAA' }]);
});

afterEach(() => {
    jest.useRealTimers();
});

afterAll(() => {
    for (const k of ENV) {
        if (envAtStart[k] === undefined) delete process.env[k];
        else process.env[k] = envAtStart[k];
    }
});

describe('getVerdictStats', () => {
    test('only ever SELECTs', async () => {
        serveRows();
        await getVerdictStats();

        expect(db.pool.query).toHaveBeenCalledTimes(3);
        for (const [sql] of db.pool.query.mock.calls) {
            expect(sql.trim()).toMatch(/^SELECT/);
            expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i);
        }
    });

    test('history looks back ?days, "served" looks back the engine read window', async () => {
        serveRows();
        await getVerdictStats(60);

        const param = pattern => db.pool.query.mock.calls.find(([sql]) => pattern.test(sql))[1];
        expect(param(/GROUP BY score_date/)).toEqual(['2026-07-21']);   // 60 days back
        expect(param(/GROUP BY newest/)).toEqual(['2026-08-14']);       // today - (37 - 1)
    });

    test('servedUntil is the last day the read window accepts the verdict', async () => {
        serveRows({ served: [{ scoredOn: '2026-08-29', symbols: 4900 }, { scoredOn: '2026-09-15', symbols: 12 }] });
        const stats = await getVerdictStats();

        expect(stats.served).toEqual([
            { scoredOn: '2026-08-29', symbols: 4900, servedUntil: '2026-10-04' },
            { scoredOn: '2026-09-15', symbols: 12, servedUntil: '2026-10-21' }
        ]);
        expect(stats.settings).toEqual({
            readWindowDays: 37, resumeWindowDays: 14, sweepEnabled: true, sweepFresh: true,
            bootResume: true, watchdog: true, ownerReports: true, geminiConfigured: false
        });
        expect(stats.universe).toBe(2);   // deduplicated
    });

    test('reports the windows the server is really running with', async () => {
        process.env.CONVICTION_MAX_AGE_DAYS = '7';
        process.env.CONVICTION_SWEEP_RESUME_DAYS = '3';
        process.env.CONVICTION_SWEEP = 'false';
        process.env.CONVICTION_SWEEP_FRESH = 'false';
        process.env.CONVICTION_SWEEP_BOOT_RESUME = 'false';
        process.env.CONVICTION_SWEEP_WATCHDOG = 'false';
        process.env.CONVICTION_SWEEP_ALERTS = 'false';
        process.env.GEMINI_API_KEY = 'set';
        serveRows({ served: [{ scoredOn: '2026-09-15', symbols: 1 }] });
        const stats = await getVerdictStats();

        expect(stats.settings).toEqual({
            readWindowDays: 7, resumeWindowDays: 3, sweepEnabled: false, sweepFresh: false,
            bootResume: false, watchdog: false, ownerReports: false, geminiConfigured: true
        });
        expect(stats.served[0].servedUntil).toBe('2026-09-21');
    });

    test('surfaces a database error instead of reporting zeros', async () => {
        db.pool.query.mockRejectedValue(new Error('connection refused'));
        await expect(getVerdictStats()).rejects.toThrow('connection refused');
    });
});
