/**
 * The 06:30 retry of the market-cap refresh (lib/scheduler/market-cap-updater.js). On 2026-09-25 the 06:00 run met a
 * 429 on every request and stored nothing; the same server was answered that evening (POST /api/ops/yahoo-check).
 * Pinned here: the retry runs only when the day's run stored nothing (or none is known), is named in job_runs, and
 * hands its counts back.
 */

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../database-postgres', () => ({ pool: { query: jest.fn() }, storeMarketCap: jest.fn() }));
jest.mock('../../ml/conviction-sweep', () => ({ isSweepDay: jest.fn() }));

const cron = require('node-cron');
const updater = require('../../lib/scheduler/market-cap-updater');
const JobRuns = require('../../lib/shared/job-runs');

function initialize() {
    cron.schedule.mockImplementation(() => ({ stop: jest.fn() }));
    updater.isInitialized = false;
    updater.initialize();
}
const retryJob = () => cron.schedule.mock.calls.find(([e]) => e === '30 6 * * 1-5');

beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    updater.lastUpdateResult = null;
});
afterEach(() => jest.restoreAllMocks());

describe('needsRetry', () => {
    const at = iso => new Date(iso);

    test('the day\'s run stored nothing: yes', () => {
        updater.lastUpdateResult = { updated: 0, failed: 150, timestamp: '2026-09-25T05:02:10Z' };
        expect(updater.needsRetry(at('2026-09-25T05:30:00Z'))).toBe(true);
    });

    test('the day\'s run stored caps: no', () => {
        updater.lastUpdateResult = { updated: 4200, timestamp: '2026-09-25T05:02:10Z' };
        expect(updater.needsRetry(at('2026-09-25T05:30:00Z'))).toBe(false);
    });

    test('a run that failed outright (no counts): yes', () => {
        updater.lastUpdateResult = { error: 'No Yahoo cookie (the cookie request answered 429)', timestamp: '2026-09-25T05:00:40Z' };
        expect(updater.needsRetry(at('2026-09-25T05:30:00Z'))).toBe(true);
    });

    test('no run known today (yesterday\'s, or none since a restart): yes', () => {
        updater.lastUpdateResult = { updated: 4200, timestamp: '2026-09-24T05:02:10Z' };
        expect(updater.needsRetry(at('2026-09-25T05:30:00Z'))).toBe(true);
        updater.lastUpdateResult = null;
        expect(updater.needsRetry(at('2026-09-25T05:30:00Z'))).toBe(true);
    });

    test('the day is the UK day: 23:30 UTC on the 24th is already the 25th in London (BST)', () => {
        updater.lastUpdateResult = { updated: 10, timestamp: '2026-09-24T23:30:00Z' };
        expect(updater.needsRetry(at('2026-09-25T05:30:00Z'))).toBe(false);
    });
});

describe('the 06:30 job', () => {
    test('scheduled on weekdays at 06:30 UK and named in job_runs', () => {
        initialize();
        const job = retryJob();
        expect(job).toBeDefined();
        expect(job[2]).toMatchObject({ timezone: 'Europe/London' });
        expect(JobRuns.jobName('market-caps', '30 6 * * 1-5', { timezone: 'Europe/London' })).toBe('market-caps-retry');
    });

    test('the 06:00 run stored caps: the retry stands aside, and says so', async () => {
        initialize();
        const run = jest.spyOn(updater, 'updateAllMarketCaps').mockResolvedValue({ updated: 1 });
        updater.lastUpdateResult = { updated: 4200, timestamp: new Date().toISOString() };
        await expect(retryJob()[1]()).resolves.toEqual({ skipped: 'the 06:00 run stored caps' });
        expect(run).not.toHaveBeenCalled();
    });

    test('the 06:00 run stored nothing: the refresh runs again and hands back its counts', async () => {
        initialize();
        const counts = { requested: 5029, updated: 4400 };
        const run = jest.spyOn(updater, 'updateAllMarketCaps').mockResolvedValue(counts);
        updater.lastUpdateResult = { updated: 0, failed: 150, timestamp: new Date().toISOString() };
        await expect(retryJob()[1]()).resolves.toBe(counts);
        expect(run).toHaveBeenCalledTimes(1);
    });
});
