/**
 * The job-run log (lib/shared/job-runs.js): named scheduled jobs record each run in job_runs, so a run can be read
 * back on prod (GET /api/ops/schedule-stats); unnamed ones run untouched; recording never breaks a job.
 */
jest.mock('node-cron', () => ({ schedule: jest.fn((expression, fn, options) => ({ expression, fn, options })), validate: jest.fn(() => true) }));

const cron = require('node-cron');
const JobRuns = require('../../lib/shared/job-runs');

function fakePool({ failOn } = {}) {
    const calls = [];
    return {
        calls,
        query: jest.fn(async (sql, params) => {
            calls.push([sql.replace(/\s+/g, ' ').trim(), params]);
            if (failOn && failOn.test(sql)) throw new Error('database refused');
            if (/^\s*INSERT INTO job_runs/.test(sql)) return { rows: [{ id: 41 }] };
            return { rows: [] };
        })
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('names', () => {
    test.each([
        ['scanner', '0 7 * * 1-5', {}, 'scan'],
        ['scanner', '0 19 * * 1-5', { timezone: 'Europe/London' }, 'eod-summary'],
        ['scanner', '30 22 * * 1-5', { timezone: 'Europe/London' }, 'ledger-drift-check'],
        ['executor', '0 13 * * 1-5', { timezone: 'Asia/Kolkata' }, 'executor-india'],
        ['executor', '0 13 * * 1-5', { timezone: 'Europe/London' }, 'executor-uk'],
        ['executor', '0 13 * * 1-5', { timezone: 'America/New_York' }, 'executor-us'],
        ['market-caps', '0 6 * * 1-5', { timezone: 'Europe/London' }, 'market-caps']
    ])('%s %s %j is %s', (moduleName, expression, options, name) => {
        expect(JobRuns.jobName(moduleName, expression, options)).toBe(name);
    });

    test('the frequent jobs are not recorded: the hourly heartbeat, a minute or 10-minute pass', () => {
        expect(JobRuns.jobName('scanner', '0 * * * *')).toBeNull();
        expect(JobRuns.jobName('scanner', '*/10 * * * *')).toBeNull();
        expect(JobRuns.jobName('scanner', '* * * * *')).toBeNull();
        expect(JobRuns.jobName('exit-monitor', '*/1 * * * *')).toBeNull();
    });
});

describe('cronFor', () => {
    test('a named job is wrapped, an unnamed one is passed through as it is', () => {
        const scanner = JobRuns.cronFor('scanner');
        const eod = jest.fn();
        const heartbeat = jest.fn();
        scanner.schedule('0 19 * * 1-5', eod, { timezone: 'Europe/London' });
        scanner.schedule('0 * * * *', heartbeat, { timezone: 'Europe/London' });
        const [[, eodTask, eodOptions], [, heartbeatTask]] = cron.schedule.mock.calls;
        expect(eodTask).not.toBe(eod);
        expect(eodOptions).toEqual({ timezone: 'Europe/London' });
        expect(heartbeatTask).toBe(heartbeat);
    });

    test('the rest of node-cron is still there', () => {
        expect(JobRuns.cronFor('scanner').validate('0 7 * * 1-5')).toBe(true);
    });
});

describe('recordRun', () => {
    test('records the start and a successful end with a summary of what the job returned', async () => {
        const pool = fakePool();
        const result = await JobRuns.recordRun('executor-uk', async () => ({ success: true, market: 'UK', executed: 2, trades: [1, 2] }), { pool });
        expect(result).toEqual({ success: true, market: 'UK', executed: 2, trades: [1, 2] });
        const insert = pool.calls.find(([sql]) => sql.startsWith('INSERT INTO job_runs'));
        expect(insert[1]).toEqual(['executor-uk']);
        const update = pool.calls.find(([sql]) => sql.startsWith('UPDATE job_runs'));
        expect(update[1]).toEqual([41, true, { success: true, market: 'UK', executed: 2, trades: { items: 2 } }]);
        expect(pool.calls.some(([sql]) => /DELETE FROM job_runs WHERE started_at < NOW\(\) - INTERVAL '90 days'/.test(sql))).toBe(true);
    });

    test('a job that throws is recorded as failed, and its error still reaches the caller', async () => {
        const pool = fakePool();
        await expect(JobRuns.recordRun('scan', async () => { throw new Error('Yahoo down'); }, { pool })).rejects.toThrow('Yahoo down');
        const update = pool.calls.find(([sql]) => sql.startsWith('UPDATE job_runs'));
        expect(update[1]).toEqual([41, false, { error: 'Yahoo down' }]);
    });

    test('a database that never answers holds the job back at most RECORD_TIMEOUT_MS', async () => {
        const pool = { query: jest.fn(() => new Promise(() => {})) };
        const started = Date.now();
        await expect(JobRuns.recordRun('scan', async () => 'ran', { pool })).resolves.toBe('ran');
        expect(Date.now() - started).toBeLessThan(JobRuns.RECORD_TIMEOUT_MS + 1500);
    });

    test('a database that refuses the record never stops or changes the job', async () => {
        const pool = fakePool({ failOn: /INSERT INTO job_runs/ });
        const job = jest.fn(async () => 'done');
        await expect(JobRuns.recordRun('eod-summary', job, { pool })).resolves.toBe('done');
        expect(job).toHaveBeenCalledTimes(1);
        expect(pool.calls.some(([sql]) => sql.startsWith('UPDATE job_runs'))).toBe(false);
    });

    test('without a database pool the job just runs', async () => {
        await expect(JobRuns.recordRun('scan', async () => 7, { pool: null })).resolves.toBe(7);
    });
});

describe('summarize', () => {
    test('keeps plain fields, counts arrays, drops objects', () => {
        expect(JobRuns.summarize({ a: 1, b: 'x', c: true, d: null, e: [1, 2, 3], f: { deep: 1 } })).toEqual({ a: 1, b: 'x', c: true, d: null, e: { items: 3 } });
        expect(JobRuns.summarize(undefined)).toBeNull();
        expect(JobRuns.summarize([1, 2])).toEqual({ items: 2 });
    });
});

describe('the cron modules use it', () => {
    const fs = require('fs');
    const path = require('path');
    test.each([['lib/scanner/scanner.js', 'scanner'], ['lib/scheduler/trade-executor.js', 'executor'], ['lib/scheduler/market-cap-updater.js', 'market-caps']])('%s', (file, label) => {
        const src = fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');
        expect(src).toMatch(new RegExp(`const cron = require\\('\\.\\./shared/job-runs'\\)\\.cronFor\\('${label}'\\);`));
        expect(src).not.toMatch(/require\('node-cron'\)/);
    });
});
