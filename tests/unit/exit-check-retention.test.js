/**
 * Exit-check retention (lib/portfolio/exit-check-retention.js) — GAPS #13
 *
 * Two things are pinned down here:
 *   1. The duplicate-alert guard is untouched. checkAlertSent() in both
 *      managers still reads ONLY alert_sent = true rows, and no statement the
 *      prune can issue is able to delete one.
 *   2. The job's safety rails: a dry run unless EXIT_CHECK_PRUNE=true,
 *      batching, a missing table, a clamped retention policy, never throwing.
 *
 * The database is mocked, so what is asserted is the SQL the job sends. That
 * the SQL does what it says against real Postgres is covered by the local
 * end-to-end run described in the change's plan.
 */

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('../../database-postgres', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../lib/telegram/telegram-bot', () => ({
    broadcastToSubscribers: jest.fn(),
    sendTelegramAlert: jest.fn()
}));

const TradeDB = require('../../database-postgres');
const exitMonitor = require('../../lib/portfolio/exit-monitor');
const HighConvictionPortfolioManager = require('../../lib/portfolio/high-conviction-manager');
const retention = require('../../lib/portfolio/exit-check-retention');

const { BATCH_SIZE, MAX_BATCHES, MIN_RETENTION_DAYS } = retention;

/**
 * A pool.query stand-in that answers the job's four kinds of statement.
 *   missing   tables that to_regclass() should not find
 *   prunable  what the dry-run count reports
 *   batches   rowCount of each successive DELETE (then 0 for ever)
 */
function mockDatabase({ missing = [], prunable = 0, batches = [] } = {}) {
    const remaining = [...batches];
    TradeDB.pool.query.mockImplementation(async (sql, params) => {
        if (/to_regclass/.test(sql)) {
            return { rows: [{ oid: missing.includes(params[0]) ? null : params[0] }] };
        }
        if (/^\s*DELETE/.test(sql)) {
            return { rowCount: remaining.length ? remaining.shift() : 0 };
        }
        if (/routine_rows/.test(sql)) {
            return { rows: [{ routine_rows: '282357', recent_rows: '40000', recent_days: '5', table_bytes: '47169536' }] };
        }
        return { rows: [{ rows: String(prunable), oldest: null, newest: null }] };
    });
}

const PROD_LIKE = { missing: ['high_conviction_exit_checks'] };

function deletes() {
    return TradeDB.pool.query.mock.calls.filter(([sql]) => /^\s*DELETE/.test(sql));
}

beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    delete process.env.EXIT_CHECK_PRUNE;
    delete process.env.EXIT_CHECK_RETENTION_DAYS;
});

afterEach(() => {
    delete process.env.EXIT_CHECK_PRUNE;
    delete process.env.EXIT_CHECK_RETENTION_DAYS;
});

describe('Duplicate-alert guard — checkAlertSent() is untouched', () => {
    test('exit monitor: looks up alert_sent = true rows for this trade and exit type', async () => {
        TradeDB.pool.query.mockResolvedValue({ rows: [{ id: 1 }] });

        const sent = await exitMonitor.checkAlertSent(42, 'stop_loss');

        expect(sent).toBe(true);
        const [sql, params] = TradeDB.pool.query.mock.calls[0];
        expect(sql).toMatch(/FROM trade_exit_checks/);
        expect(sql).toMatch(/trade_id = \$1/);
        expect(sql).toMatch(/alert_sent = true/);
        expect(sql).toMatch(/alert_type = \$2/);
        expect(params).toEqual([42, 'stop_loss']);
    });

    test('exit monitor: no alert row means not sent', async () => {
        TradeDB.pool.query.mockResolvedValue({ rows: [] });

        expect(await exitMonitor.checkAlertSent(42, 'target_reached')).toBe(false);
    });

    test('exit monitor: a failed lookup reads as not sent, as it always has', async () => {
        TradeDB.pool.query.mockRejectedValue(new Error('db down'));

        expect(await exitMonitor.checkAlertSent(42, 'stop_loss')).toBe(false);
    });

    test('high-conviction manager: the same guard, keyed by symbol', async () => {
        TradeDB.pool.query.mockResolvedValue({ rows: [{ id: 1 }] });
        const manager = new HighConvictionPortfolioManager();

        const sent = await manager.checkAlertSent('DIXON.NS', 'take_profit');

        expect(sent).toBe(true);
        const [sql, params] = TradeDB.pool.query.mock.calls[0];
        expect(sql).toMatch(/FROM high_conviction_exit_checks/);
        expect(sql).toMatch(/symbol = \$1/);
        expect(sql).toMatch(/alert_sent = true/);
        expect(sql).toMatch(/alert_type = \$2/);
        expect(params).toEqual(['DIXON.NS', 'take_profit']);
    });

    test('high-conviction manager: no row, or a failed lookup, means not sent', async () => {
        const manager = new HighConvictionPortfolioManager();

        TradeDB.pool.query.mockResolvedValue({ rows: [] });
        expect(await manager.checkAlertSent('DIXON.NS', 'stop_loss')).toBe(false);

        TradeDB.pool.query.mockRejectedValue(new Error('relation does not exist'));
        expect(await manager.checkAlertSent('DIXON.NS', 'stop_loss')).toBe(false);
    });

    test('no DELETE the job issues can reach an alert row', async () => {
        process.env.EXIT_CHECK_PRUNE = 'true';
        mockDatabase({ batches: [BATCH_SIZE, 12, 7] });

        await retention.pruneExitChecks();

        expect(deletes().length).toBeGreaterThan(0);
        for (const [sql] of deletes()) {
            // Once in the subquery that picks ids, once on the DELETE itself
            expect(sql.match(/alert_sent = false/g)).toHaveLength(2);
            expect(sql).not.toMatch(/alert_sent = true/);
            expect(sql).not.toMatch(/alert_sent IS NOT/i);
        }
    });

    test('the job deletes from the two exit-check tables and nothing else', async () => {
        process.env.EXIT_CHECK_PRUNE = 'true';
        mockDatabase({ batches: [5, 5] });

        await retention.pruneExitChecks();

        const targets = deletes().map(([sql]) => sql.match(/DELETE FROM (\w+)/)[1]);
        expect(targets).toEqual(['trade_exit_checks', 'high_conviction_exit_checks']);
        expect(retention.TABLES).toEqual(['trade_exit_checks', 'high_conviction_exit_checks']);
    });
});

describe('Deleting needs consent — a dry run is the default', () => {
    test('without EXIT_CHECK_PRUNE the job only counts', async () => {
        mockDatabase({ ...PROD_LIKE, prunable: 33166 });

        const result = await retention.pruneExitChecks();

        expect(deletes()).toHaveLength(0);
        expect(result.dryRun).toBe(true);
        expect(result.enabled).toBe(false);
        expect(result.tables[0]).toMatchObject({ table: 'trade_exit_checks', wouldDelete: 33166, retentionDays: 30 });
    });

    test('a caller asking for a real run cannot override the missing consent', async () => {
        mockDatabase({ ...PROD_LIKE, prunable: 33166 });

        const result = await retention.pruneExitChecks({ dryRun: false });

        expect(deletes()).toHaveLength(0);
        expect(result.dryRun).toBe(true);
    });

    test.each(['TRUE', '1', 'yes', 'on', ' true'])('EXIT_CHECK_PRUNE=%p is not consent — only the exact string "true" is', async (value) => {
        process.env.EXIT_CHECK_PRUNE = value;
        mockDatabase({ ...PROD_LIKE, prunable: 10 });

        const result = await retention.pruneExitChecks();

        expect(deletes()).toHaveLength(0);
        expect(result.dryRun).toBe(true);
    });

    test('dryRun: true still only counts once pruning is enabled', async () => {
        process.env.EXIT_CHECK_PRUNE = 'true';
        mockDatabase({ ...PROD_LIKE, prunable: 33166 });

        const result = await retention.pruneExitChecks({ dryRun: true });

        expect(deletes()).toHaveLength(0);
        expect(result).toMatchObject({ dryRun: true, enabled: true });
    });
});

describe('Pruning', () => {
    beforeEach(() => {
        process.env.EXIT_CHECK_PRUNE = 'true';
    });

    test('deletes in batches until a batch comes back short', async () => {
        mockDatabase({ ...PROD_LIKE, batches: [BATCH_SIZE, BATCH_SIZE, 3166] });

        const result = await retention.pruneExitChecks();

        expect(deletes()).toHaveLength(3);
        expect(deletes()[0][1]).toEqual([30, BATCH_SIZE]);
        expect(result.tables[0]).toMatchObject({ deleted: 2 * BATCH_SIZE + 3166, batches: 3, capped: false });
    });

    test('a final batch that is exactly full costs one more, empty, round', async () => {
        mockDatabase({ ...PROD_LIKE, batches: [BATCH_SIZE, 0] });

        const result = await retention.pruneExitChecks();

        expect(deletes()).toHaveLength(2);
        expect(result.tables[0]).toMatchObject({ deleted: BATCH_SIZE, capped: false });
    });

    test('stops at the batch cap and says so — the rest goes on the next run', async () => {
        mockDatabase({ ...PROD_LIKE, batches: Array(MAX_BATCHES + 10).fill(BATCH_SIZE) });

        const result = await retention.pruneExitChecks();

        expect(deletes()).toHaveLength(MAX_BATCHES);
        expect(result.tables[0]).toMatchObject({ deleted: MAX_BATCHES * BATCH_SIZE, capped: true });
    });

    test('a table that does not exist is skipped, never queried', async () => {
        mockDatabase({ ...PROD_LIKE, batches: [40] });

        const result = await retention.pruneExitChecks();

        expect(result.tables[1]).toEqual({ table: 'high_conviction_exit_checks', exists: false });
        const touchedMissingTable = TradeDB.pool.query.mock.calls
            .filter(([sql]) => !/to_regclass/.test(sql))
            .some(([sql]) => /high_conviction_exit_checks/.test(sql));
        expect(touchedMissingTable).toBe(false);
    });

    test('never throws, and a failed run does not block the next one', async () => {
        TradeDB.pool.query.mockRejectedValue(new Error('db down'));

        const failed = await retention.pruneExitChecks();
        expect(failed.error).toBe('db down');

        mockDatabase({ ...PROD_LIKE, batches: [3] });
        const next = await retention.pruneExitChecks();
        expect(next.skipped).toBeUndefined();
        expect(next.tables[0].deleted).toBe(3);
    });

    test('a second run while one is in flight is skipped', async () => {
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        TradeDB.pool.query.mockImplementation(async () => {
            await gate;
            return { rows: [{ oid: null }] };
        });

        const first = retention.pruneExitChecks();
        const second = await retention.pruneExitChecks();
        release();
        await first;

        expect(second.skipped).toMatch(/already running/);
    });
});

describe('Retention window', () => {
    test('defaults to 30 days; an unusable value is never read as "keep nothing"', () => {
        expect(retention.getConfig({}).retentionDays).toBe(30);
        expect(retention.getConfig({ EXIT_CHECK_RETENTION_DAYS: '14' }).retentionDays).toBe(14);
        for (const bad of ['0', '-5', 'abc', '', ' ']) {
            expect(retention.getConfig({ EXIT_CHECK_RETENTION_DAYS: bad }).retentionDays).toBe(30);
        }
        expect(retention.getConfig({ EXIT_CHECK_RETENTION_DAYS: '99999' }).retentionDays).toBe(3650);
    });

    test('the configured window is the day count the database receives', async () => {
        process.env.EXIT_CHECK_PRUNE = 'true';
        process.env.EXIT_CHECK_RETENTION_DAYS = '14';
        mockDatabase({ ...PROD_LIKE, batches: [9] });

        await retention.pruneExitChecks();

        expect(deletes()[0][0]).toMatch(/make_interval\(days => \$1::int\)/);
        expect(deletes()[0][1][0]).toBe(14);
    });

    test('the policy can shorten the window, down to the floor, and no further', () => {
        const stats = { configuredDays: 30, routineRows: 1, rowsPerDay: 1, tableBytes: 1 };

        expect(retention.resolveRetentionDays(stats, () => 10)).toBe(10);
        expect(retention.resolveRetentionDays(stats, () => 10.7)).toBe(10);
        expect(retention.resolveRetentionDays(stats, () => 1)).toBe(MIN_RETENTION_DAYS);
        expect(retention.resolveRetentionDays(stats, () => -4)).toBe(MIN_RETENTION_DAYS);
    });

    test('the policy can never lengthen the window past what is configured', () => {
        const stats = { configuredDays: 30, routineRows: 1, rowsPerDay: 1, tableBytes: 1 };

        expect(retention.resolveRetentionDays(stats, () => 45)).toBe(30);
        expect(retention.resolveRetentionDays({ ...stats, configuredDays: 2 }, () => 1)).toBe(2);
    });

    test('a policy that returns rubbish, or throws, is ignored', () => {
        const stats = { configuredDays: 30, routineRows: 1, rowsPerDay: 1, tableBytes: 1 };

        for (const rubbish of [NaN, undefined, null, '7', Infinity, {}]) {
            expect(retention.resolveRetentionDays(stats, () => rubbish)).toBe(30);
        }
        expect(retention.resolveRetentionDays(stats, () => { throw new Error('bug'); })).toBe(30);
    });

    test('whatever the shipped policy decides stays inside the rails, at any scale', () => {
        for (const rowsPerDay of [0, 9737, 120000, 5000000]) {
            const days = retention.resolveRetentionDays({
                configuredDays: 30,
                routineRows: rowsPerDay * 21,
                rowsPerDay,
                tableBytes: rowsPerDay * 21 * 167
            });
            expect(days).toBeGreaterThanOrEqual(MIN_RETENTION_DAYS);
            expect(days).toBeLessThanOrEqual(30);
        }
    });
});
