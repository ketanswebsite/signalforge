/**
 * Exit-check retention (GAPS #13, README.md section 1)
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
 * Once a day this job:
 *   1. ROLLS UP every complete day of trade_exit_checks into
 *      trade_exit_checks_daily — one row per position per day holding the
 *      open / high / low / close of both price and P/L%, and when the high and
 *      low were polled. That keeps what the minute rows are worth for analysis
 *      (each position's intraday peaks and troughs, for ever) in about one
 *      row where there were a thousand.
 *   2. PRUNES rows older than the retention window — whole days only, and only
 *      days that have been rolled up. alert_sent = true rows are NEVER
 *      deleted: they are the duplicate-alert guard, one per closed trade.
 *
 * trade_exit_checks_daily is owned by this module and created on first run.
 * high_conviction_exit_checks is pruned without a rollup: it is keyed by
 * symbol rather than by position, mirrors prices already rolled up here, and
 * does not exist on production.
 *
 *   EXIT_CHECK_PRUNE            'false' = kill switch: report only, write nothing
 *   EXIT_CHECK_RETENTION_DAYS   full days of minute-level history to keep (default 30)
 */

const TradeDB = require('../../database-postgres');

// Table names are interpolated into SQL, so they come from this list and
// never from a caller. high_conviction_exit_checks is created by a standalone
// migration rather than the boot-time schema, so it may not exist.
const TABLES = ['trade_exit_checks', 'high_conviction_exit_checks'];
const ROLLUP_SOURCE = 'trade_exit_checks';
const ROLLUP_TABLE = 'trade_exit_checks_daily';

const DEFAULT_RETENTION_DAYS = 30;
const MIN_RETENTION_DAYS = 3;
const MAX_RETENTION_DAYS = 3650;
const BATCH_SIZE = 10000;
const MAX_BATCHES = 50;

let isPruning = false;

/**
 * What makes a row prunable, for the row aliased `alias`.
 *
 * - The cutoff is a DATE, so a day is always either fully present or fully
 *   pruned, and it is computed by the database against the same clock and
 *   time zone that stamped check_time.
 * - `alert_sent = false` rather than `IS NOT TRUE` on purpose: a row this job
 *   does not positively recognise as a non-alert row is left alone.
 * - For the rolled-up table the row's day must already be in the rollup, so
 *   history that has not been summarised cannot be deleted whatever order the
 *   steps run in.
 */
function prunable(alias, table) {
    const base = `${alias}.check_time < (CURRENT_DATE - $1::int) AND ${alias}.alert_sent = false`;
    if (table !== ROLLUP_SOURCE) {
        return base;
    }
    return `${base}
              AND EXISTS (SELECT 1 FROM ${ROLLUP_TABLE} d
                          WHERE d.trade_id = ${alias}.trade_id AND d.day = ${alias}.check_time::date)`;
}

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

    // On by default, like AUTO_EXECUTE and AI_CONVICTION_GATE: the owner
    // approved pruning on 2026-09-19 and EXIT_CHECK_PRUNE=false is the kill
    // switch. Unlike those, the off value is read loosely — for a job that
    // deletes, "False" or "0" must stop it too.
    const killSwitch = String(env.EXIT_CHECK_PRUNE || '').trim().toLowerCase();

    return {
        enabled: !['false', '0', 'no', 'off'].includes(killSwitch),
        retentionDays
    };
}

/**
 * How many days of minute-level history should this table keep tonight?
 *
 * The rule (README §4.7) is a fixed window: EXIT_CHECK_RETENTION_DAYS full
 * days (default 30), whatever the table's size. You always know how much
 * minute-level history there is, and the daily rollup keeps every position's
 * peaks and troughs for ever, so this only decides how long the
 * minute-by-minute path survives.
 *
 * Why not a size budget (as many days as fit in N rows): it would shrink the
 * window silently as positions grow, and you might find 4 days of minute data
 * when you expected 30. The cost of the fixed window: it is bounded per
 * position, not in total. At ~1,070 rows per position per day and 167 bytes
 * per row, 30 days costs about 37 MB for every 10 open positions.
 * GET /api/ops/exit-checks-stats shows the table's size; if it outgrows the
 * database, lower EXIT_CHECK_RETENTION_DAYS, or change this rule here and in
 * README §4.7 together.
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
 * @returns {number} days of minute-level history to keep
 */
function chooseRetentionDays({ configuredDays }) {
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

async function tableExists(table) {
    const { rows: [found] } = await TradeDB.pool.query('SELECT to_regclass($1) AS oid', [table]);
    return !!found.oid;
}

/**
 * Create the rollup table if this is the first run. Same lifetime as its
 * source: rows go when their trade is deleted.
 */
async function ensureRollupTable() {
    await TradeDB.pool.query(`
        CREATE TABLE IF NOT EXISTS ${ROLLUP_TABLE} (
            trade_id BIGINT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
            day DATE NOT NULL,
            checks INTEGER NOT NULL,
            first_check TIMESTAMP NOT NULL,
            last_check TIMESTAMP NOT NULL,
            open_price DECIMAL(12, 4) NOT NULL,
            high_price DECIMAL(12, 4) NOT NULL,
            low_price DECIMAL(12, 4) NOT NULL,
            close_price DECIMAL(12, 4) NOT NULL,
            open_pl_percent DECIMAL(8, 4) NOT NULL,
            high_pl_percent DECIMAL(8, 4) NOT NULL,
            low_pl_percent DECIMAL(8, 4) NOT NULL,
            close_pl_percent DECIMAL(8, 4) NOT NULL,
            high_at TIMESTAMP NOT NULL,
            low_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (trade_id, day)
        )
    `);
}

/**
 * Summarise every complete day that is not in the rollup yet.
 *
 * Only days before today: a day is rolled up once, from all of its rows, and
 * never again (ON CONFLICT DO NOTHING) — so a summary can never be rebuilt
 * from a day the prune has already thinned out. Alert rows are included: the
 * exit tick is that position's close for the day. high_at / low_at are the
 * FIRST time the extreme was polled.
 */
async function rollUpCompleteDays() {
    await ensureRollupTable();

    const result = await TradeDB.pool.query(`
        INSERT INTO ${ROLLUP_TABLE}
            (trade_id, day, checks, first_check, last_check,
             open_price, high_price, low_price, close_price,
             open_pl_percent, high_pl_percent, low_pl_percent, close_pl_percent,
             high_at, low_at)
        SELECT c.trade_id,
               c.check_time::date,
               count(*),
               min(c.check_time),
               max(c.check_time),
               (array_agg(c.current_price ORDER BY c.check_time, c.id))[1],
               max(c.current_price),
               min(c.current_price),
               (array_agg(c.current_price ORDER BY c.check_time DESC, c.id DESC))[1],
               (array_agg(c.pl_percent ORDER BY c.check_time, c.id))[1],
               max(c.pl_percent),
               min(c.pl_percent),
               (array_agg(c.pl_percent ORDER BY c.check_time DESC, c.id DESC))[1],
               (array_agg(c.check_time ORDER BY c.current_price DESC, c.check_time, c.id))[1],
               (array_agg(c.check_time ORDER BY c.current_price, c.check_time, c.id))[1]
        FROM ${ROLLUP_SOURCE} c
        WHERE c.check_time < CURRENT_DATE
          AND NOT EXISTS (SELECT 1 FROM ${ROLLUP_TABLE} d
                          WHERE d.trade_id = c.trade_id AND d.day = c.check_time::date)
        GROUP BY c.trade_id, c.check_time::date
        ON CONFLICT (trade_id, day) DO NOTHING
    `);

    return result.rowCount;
}

/**
 * A dry run's answer for one table. Reads only — it does not even create the
 * rollup table.
 */
async function previewTable(table, retentionDays) {
    const pool = TradeDB.pool;

    // No rollup clause here: a real run rolls every complete day up first, so
    // everything past the cutoff would qualify
    const { rows: [found] } = await pool.query(`
        SELECT count(*) AS rows, min(c.check_time) AS oldest, max(c.check_time) AS newest
        FROM ${table} c
        WHERE ${prunable('c', null)}
    `, [retentionDays]);

    const preview = { wouldDelete: Number(found.rows), oldest: found.oldest, newest: found.newest };
    if (table !== ROLLUP_SOURCE) {
        return preview;
    }

    const alreadyRolledUp = await tableExists(ROLLUP_TABLE)
        ? `AND NOT EXISTS (SELECT 1 FROM ${ROLLUP_TABLE} d
                           WHERE d.trade_id = c.trade_id AND d.day = c.check_time::date)`
        : '';
    const { rows: [pending] } = await pool.query(`
        SELECT count(*) AS days FROM (
            SELECT 1 FROM ${ROLLUP_SOURCE} c
            WHERE c.check_time < CURRENT_DATE ${alreadyRolledUp}
            GROUP BY c.trade_id, c.check_time::date
        ) position_days
    `);

    return { ...preview, wouldRollUp: Number(pending.days) };
}

/**
 * Delete one table's prunable rows.
 */
async function pruneTable(table, retentionDays) {
    // Small batches, oldest ids first: no long-held lock and no single huge
    // transaction on a small instance. The predicate is repeated on the outer
    // DELETE so that every statement that deletes carries the alert-row (and
    // rollup) protection itself, not only its subquery.
    let deleted = 0;
    let batches = 0;
    let lastBatch = BATCH_SIZE;

    while (lastBatch === BATCH_SIZE && batches < MAX_BATCHES) {
        const result = await TradeDB.pool.query(`
            DELETE FROM ${table} c
            WHERE c.id IN (
                SELECT s.id FROM ${table} s
                WHERE ${prunable('s', table)}
                ORDER BY s.id
                LIMIT $2
            )
            AND ${prunable('c', table)}
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
 * Roll up complete days, then prune rows older than the retention window.
 *
 * Never throws — it runs from a cron. With EXIT_CHECK_PRUNE=false, or
 * `options.dryRun: true`, it only reports and writes nothing at all.
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
            if (!await tableExists(table)) {
                summary.tables.push({ table, exists: false });
                continue;
            }

            const stats = await getTableStats(table);
            const retentionDays = resolveRetentionDays({ configuredDays: config.retentionDays, ...stats });

            if (dryRun) {
                const preview = await previewTable(table, retentionDays);
                summary.tables.push({ table, exists: true, retentionDays, ...stats, ...preview });
                console.log(`🧹 [EXIT CHECKS] DRY RUN — ${table}: ${preview.wouldDelete} of ${stats.routineRows} routine rows ` +
                    `are older than ${retentionDays} full days and would be deleted` +
                    (preview.wouldRollUp === undefined ? '' : `, after rolling up ${preview.wouldRollUp} position-day(s)`) +
                    '. Nothing was written' + (config.enabled ? '.' : ' — EXIT_CHECK_PRUNE=false.'));
                continue;
            }

            // Rollup first. If it throws we never reach the prune — and the
            // DELETE refuses days that are not in the rollup regardless.
            const rolledUp = table === ROLLUP_SOURCE ? await rollUpCompleteDays() : undefined;
            const outcome = await pruneTable(table, retentionDays);
            summary.tables.push({ table, exists: true, retentionDays, ...stats, rolledUp, ...outcome });

            console.log(`🧹 [EXIT CHECKS] ${table}: ` +
                (rolledUp === undefined ? '' : `rolled up ${rolledUp} position-day(s); `) +
                `deleted ${outcome.deleted} routine rows older than ${retentionDays} full days in ${outcome.batches} batch(es)` +
                (outcome.capped ? ' — batch cap reached, the rest goes tomorrow' : ''));
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
    pruneTable,
    rollUpCompleteDays,
    chooseRetentionDays,
    resolveRetentionDays,
    getConfig,
    TABLES,
    ROLLUP_SOURCE,
    ROLLUP_TABLE,
    DEFAULT_RETENTION_DAYS,
    MIN_RETENTION_DAYS,
    BATCH_SIZE,
    MAX_BATCHES
};
