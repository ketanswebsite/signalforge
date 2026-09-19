/**
 * Exit-check retention (docs/GAPS.md #13)
 *
 * The exit monitor writes one trade_exit_checks row per open position per
 * minute; the high-conviction manager writes one per position per 10 minutes
 * into high_conviction_exit_checks. Nothing reads those routine rows. The only
 * reader is checkAlertSent(), and it looks exclusively at alert_sent = true
 * rows — that is what stops an exit alert going out twice.
 *
 * Measured on production 2026-09-19: 282,381 rows / 45 MB = 63% of the whole
 * database after 29 trading days, of which 24 rows were alert rows.
 *
 * This job bounds the tables: once a day, routine rows older than the
 * retention window are deleted. alert_sent = true rows are NEVER deleted —
 * they are the duplicate-alert guard, and there is one per closed trade.
 *
 * Deleting history cannot be undone, so the job is a DRY RUN — it reports what
 * it would delete and deletes nothing — unless EXIT_CHECK_PRUNE=true.
 *
 *   EXIT_CHECK_PRUNE            'true' to really delete (default: dry run)
 *   EXIT_CHECK_RETENTION_DAYS   days of routine history to keep (default 30)
 */

const TradeDB = require('../../database-postgres');

// Table names are interpolated into SQL, so they come from this list and
// never from a caller. high_conviction_exit_checks is created by a standalone
// migration rather than the boot-time schema, so it may not exist.
const TABLES = ['trade_exit_checks', 'high_conviction_exit_checks'];

const DEFAULT_RETENTION_DAYS = 30;
const MIN_RETENTION_DAYS = 3;
const MAX_RETENTION_DAYS = 3650;
const BATCH_SIZE = 10000;
const MAX_BATCHES = 50;

// A row is prunable when it is older than the window AND is not an alert row.
// The cutoff is computed by the database, against the same clock and time zone
// that stamped check_time (DEFAULT CURRENT_TIMESTAMP into a zone-less column).
// `alert_sent = false` rather than `IS NOT TRUE` on purpose: a row this job
// does not positively recognise as a non-alert row is left alone.
const PRUNABLE = `check_time < (CURRENT_TIMESTAMP - make_interval(days => $1::int))::timestamp
                  AND alert_sent = false`;

let isPruning = false;

/**
 * Read the job's settings from the environment.
 */
function getConfig(env = process.env) {
    const parsed = parseInt(env.EXIT_CHECK_RETENTION_DAYS, 10);
    // Anything unusable (unset, 0, negative, text) falls back to the default
    // window — a typo must never be read as "keep nothing"
    const retentionDays = Number.isFinite(parsed) && parsed >= 1
        ? Math.min(parsed, MAX_RETENTION_DAYS)
        : DEFAULT_RETENTION_DAYS;

    return {
        enabled: env.EXIT_CHECK_PRUNE === 'true',
        retentionDays
    };
}

/**
 * How many days of routine history should this table keep tonight?
 *
 * ── Yours to shape ───────────────────────────────────────────────────────
 * A fixed window is bounded per position, not in total: at ~1,070 rows per
 * position per day and 167 bytes per row, 30 days costs about 37 MB for every
 * 10 open positions. Per-user auto-trading multiplies positions, so at 100
 * positions the same window is ~375 MB on a small Render Postgres.
 *
 * Two ways to answer that:
 *   - Fixed age (what this returns today): you always know how much history
 *     you have, but the table grows with every subscriber.
 *   - Size budget: keep as many days as fit in N rows, e.g.
 *     Math.floor(budgetRows / rowsPerDay). The table stays bounded however
 *     many subscribers join, but the window shrinks silently as you grow —
 *     you may find 4 days of history when you expected 30.
 *
 * Whatever this returns is clamped by resolveRetentionDays(): it can shorten
 * the window down to MIN_RETENTION_DAYS but never lengthen it past the
 * configured value, and anything that is not a number is ignored. Alert rows
 * are out of reach whatever happens here.
 *
 * @param {object} stats
 * @param {number} stats.configuredDays  EXIT_CHECK_RETENTION_DAYS (default 30)
 * @param {number} stats.routineRows     non-alert rows in the table right now
 * @param {number} stats.rowsPerDay      average non-alert rows per day, last 7 days
 * @param {number} stats.tableBytes      pg_total_relation_size of the table
 * @returns {number} days of routine history to keep
 */
function chooseRetentionDays({ configuredDays, routineRows, rowsPerDay, tableBytes }) {
    // TODO(owner): fixed window for now — see the trade-off above
    return configuredDays;
}

/**
 * Run the retention policy and keep its answer inside safe bounds.
 */
function resolveRetentionDays(stats, policy = chooseRetentionDays) {
    const { configuredDays } = stats;

    let chosen;
    try {
        chosen = policy(stats);
    } catch (error) {
        console.error('❌ [EXIT CHECKS] Retention policy threw — using the configured window:', error.message);
        return configuredDays;
    }

    if (!Number.isFinite(chosen)) {
        return configuredDays;
    }

    const floor = Math.min(MIN_RETENTION_DAYS, configuredDays);
    return Math.max(floor, Math.min(configuredDays, Math.floor(chosen)));
}

/**
 * What the retention policy gets to see about one table.
 */
async function getTableStats(table) {
    const { rows: [stats] } = await TradeDB.pool.query(`
        SELECT count(*) FILTER (WHERE alert_sent = false) AS routine_rows,
               count(*) FILTER (WHERE alert_sent = false
                                  AND check_time >= (CURRENT_TIMESTAMP - interval '7 days')::timestamp) AS recent_rows,
               count(DISTINCT check_time::date) FILTER (WHERE alert_sent = false
                                  AND check_time >= (CURRENT_TIMESTAMP - interval '7 days')::timestamp) AS recent_days,
               pg_total_relation_size($1::regclass) AS table_bytes
        FROM ${table}
    `, [table]);

    const recentDays = Number(stats.recent_days);
    return {
        routineRows: Number(stats.routine_rows),
        rowsPerDay: recentDays > 0 ? Math.round(Number(stats.recent_rows) / recentDays) : 0,
        tableBytes: Number(stats.table_bytes)
    };
}

/**
 * Prune one table — or, on a dry run, count what a prune would remove.
 */
async function pruneTable(table, { retentionDays, dryRun }) {
    const pool = TradeDB.pool;

    if (dryRun) {
        const { rows: [found] } = await pool.query(`
            SELECT count(*) AS rows, min(check_time) AS oldest, max(check_time) AS newest
            FROM ${table}
            WHERE ${PRUNABLE}
        `, [retentionDays]);

        return { wouldDelete: Number(found.rows), oldest: found.oldest, newest: found.newest };
    }

    // Small batches, oldest ids first: no long-held lock and no single huge
    // transaction on a small instance. The predicate is repeated on the outer
    // DELETE so that every statement that deletes carries the alert-row
    // protection itself, not only its subquery.
    let deleted = 0;
    let batches = 0;
    let lastBatch = BATCH_SIZE;

    while (lastBatch === BATCH_SIZE && batches < MAX_BATCHES) {
        const result = await pool.query(`
            DELETE FROM ${table}
            WHERE id IN (
                SELECT id FROM ${table}
                WHERE ${PRUNABLE}
                ORDER BY id
                LIMIT $2
            )
            AND ${PRUNABLE}
        `, [retentionDays, BATCH_SIZE]);

        lastBatch = result.rowCount;
        deleted += lastBatch;
        batches++;
    }

    // Stopped by the batch cap with a full last batch: more remains, and
    // tomorrow's run carries on from there
    return { deleted, batches, capped: lastBatch === BATCH_SIZE };
}

/**
 * Prune routine exit-check rows older than the retention window.
 *
 * Never throws — it runs from a cron. EXIT_CHECK_PRUNE=true is the owner's
 * consent to delete: without it every run is a dry run, whatever the caller
 * asks for. `options.dryRun: true` forces a dry run even when enabled.
 */
async function pruneExitChecks(options = {}) {
    const config = getConfig();
    const dryRun = !config.enabled || options.dryRun === true;
    const summary = {
        dryRun,
        enabled: config.enabled,
        configuredDays: config.retentionDays,
        tables: []
    };

    if (isPruning) {
        return { ...summary, skipped: 'A prune is already running' };
    }
    isPruning = true;

    try {
        for (const table of TABLES) {
            const { rows: [found] } = await TradeDB.pool.query('SELECT to_regclass($1) AS oid', [table]);
            if (!found.oid) {
                summary.tables.push({ table, exists: false });
                continue;
            }

            const stats = await getTableStats(table);
            const retentionDays = resolveRetentionDays({ configuredDays: config.retentionDays, ...stats });
            const outcome = await pruneTable(table, { retentionDays, dryRun });
            summary.tables.push({ table, exists: true, retentionDays, ...stats, ...outcome });

            if (dryRun) {
                console.log(`🧹 [EXIT CHECKS] DRY RUN — ${table}: ${outcome.wouldDelete} of ${stats.routineRows} routine rows ` +
                    `are older than ${retentionDays} days and would be deleted. Nothing was deleted` +
                    (config.enabled ? '.' : ' — set EXIT_CHECK_PRUNE=true to enable.'));
            } else {
                console.log(`🧹 [EXIT CHECKS] ${table}: deleted ${outcome.deleted} routine rows older than ` +
                    `${retentionDays} days in ${outcome.batches} batch(es)` +
                    (outcome.capped ? ' — batch cap reached, the rest goes tomorrow' : ''));
            }
        }
    } catch (error) {
        console.error('❌ [EXIT CHECKS] Retention job failed:', error.message);
        summary.error = error.message;
    } finally {
        isPruning = false;
    }

    return summary;
}

module.exports = {
    pruneExitChecks,
    chooseRetentionDays,
    resolveRetentionDays,
    getConfig,
    TABLES,
    DEFAULT_RETENTION_DAYS,
    MIN_RETENTION_DAYS,
    BATCH_SIZE,
    MAX_BATCHES
};
