/**
 * A durable record of every scheduled job run (the job_runs table), so a run can be read back on prod without logs:
 * GET /api/ops/schedule-stats lists a UK day's runs. Several jobs leave nothing else behind (the evening summary is
 * Telegram only, and the 1 PM executor keeps its own log in memory, which a deploy wipes).
 *
 * A module swaps its node-cron require for cronFor('<module>'): schedule() then wraps each job whose expression (and
 * time zone) the module's name table knows. A job the table does not name - the every-minute exit monitor, the
 * 10-minute high-conviction pass, the hourly heartbeat - runs exactly as before and is not recorded.
 *
 * Recording can never break a job: every database call is caught and logged, and without a database pool the job
 * simply runs. `ok` is whether the job's function returned or threw; a job that catches its own errors reads ok.
 * Rows older than RETENTION_DAYS are pruned when a run is recorded.
 */
'use strict';

const cron = require('node-cron');

const RETENTION_DAYS = 90;
const MAX_SUMMARY_CHARS = 2000;
// A healthy insert takes milliseconds; a database that does not answer must not hold a job back
const RECORD_TIMEOUT_MS = 2000;

function withTimeout(promise, ms) {
    let timer;
    const expiry = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`no answer in ${ms} ms`)), ms);
        if (timer.unref) timer.unref();
    });
    return Promise.race([promise, expiry]).finally(() => clearTimeout(timer));
}

// expression, or "expression|time zone" where one module schedules the same expression in several zones
const NAMES = {
    scanner: {
        '0 7 * * 1-5': 'scan',
        '0 8 * * 6': 'ai-sweep',
        '*/30 9-20 * * 6': 'ai-sweep-watchdog',
        '0 16 * * 1-5': 'daily-update',
        '0 19 * * 1-5': 'eod-summary',
        '30 22 * * 1-5': 'ledger-drift-check',
        '20 23 * * *': 'exit-check-prune',
        '40 23 * * *': 'benchmark-fill',
        '15 0 * * *': 'fx-rates',
        '0 10 * * 6': 'weekly-report'
    },
    executor: {
        '0 13 * * 1-5|Asia/Kolkata': 'executor-india',
        '0 13 * * 1-5|Europe/London': 'executor-uk',
        '0 13 * * 1-5|America/New_York': 'executor-us',
        '0 0 * * *|UTC': 'signal-cleanup'
    },
    'market-caps': {
        '0 6 * * 1-5': 'market-caps',
        '30 6 * * 1-5': 'market-caps-retry',
        '0 8 * * 6': 'market-caps-saturday'
    }
};

/** The job name for a schedule() call, or null when the module does not record it. */
function jobName(moduleName, expression, options = {}) {
    const table = NAMES[moduleName] || {};
    const zone = options && options.timezone;
    return table[`${expression}|${zone}`] || table[expression] || null;
}

let ready = null;
function ensureTable(pool) {
    if (!ready) {
        ready = Promise.resolve(pool.query(`
            CREATE TABLE IF NOT EXISTS job_runs (
                id BIGSERIAL PRIMARY KEY,
                job TEXT NOT NULL,
                started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                finished_at TIMESTAMPTZ,
                ok BOOLEAN,
                summary JSONB
            )`))
            .then(() => Promise.resolve(pool.query('CREATE INDEX IF NOT EXISTS idx_job_runs_started ON job_runs (started_at DESC)')))
            .catch(error => { ready = null; throw error; });
    }
    return ready;
}

function defaultPool() {
    try {
        const TradeDB = require('../../database-postgres');
        return TradeDB && TradeDB.pool && typeof TradeDB.pool.query === 'function' ? TradeDB.pool : null;
    } catch (error) {
        return null;
    }
}

/** A small JSON summary of a job's return value: an object's plain fields, an array's length, else nothing. */
function summarize(value) {
    if (value == null) return null;
    if (Array.isArray(value)) return { items: value.length };
    if (typeof value !== 'object') return { value: String(value).slice(0, 200) };
    const out = {};
    for (const [key, v] of Object.entries(value).slice(0, 30)) {
        if (v == null || typeof v === 'number' || typeof v === 'boolean') out[key] = v;
        else if (typeof v === 'string') out[key] = v.slice(0, 200);
        else if (Array.isArray(v)) out[key] = { items: v.length };
    }
    const text = JSON.stringify(out);
    return text.length > MAX_SUMMARY_CHARS ? { truncated: true } : out;
}

/**
 * Run fn as the job `job`, recording its start and end. Returns what fn returns; rethrows what fn throws.
 */
async function recordRun(job, fn, { pool = defaultPool() } = {}) {
    let id = null;
    if (pool) {
        try {
            // At most RECORD_TIMEOUT_MS: after that the job runs unrecorded
            id = await withTimeout((async () => {
                await ensureTable(pool);
                const { rows } = await Promise.resolve(pool.query('INSERT INTO job_runs (job) VALUES ($1) RETURNING id', [job]));
                return rows[0].id;
            })(), RECORD_TIMEOUT_MS);
            Promise.resolve(pool.query(`DELETE FROM job_runs WHERE started_at < NOW() - INTERVAL '${RETENTION_DAYS} days'`))
                .catch(error => console.error(`⚠️ [JOB RUNS] Could not prune old runs: ${error.message}`));
        } catch (error) {
            console.error(`⚠️ [JOB RUNS] Could not record the start of ${job}: ${error.message}`);
        }
    }
    // Written in the background: the job's own result never waits on the log
    const finish = (ok, summary) => {
        if (!pool || id == null) return;
        try {
            Promise.resolve(pool.query('UPDATE job_runs SET finished_at = NOW(), ok = $2, summary = $3 WHERE id = $1', [id, ok, summary]))
                .catch(error => console.error(`⚠️ [JOB RUNS] Could not record the end of ${job}: ${error.message}`));
        } catch (error) {
            console.error(`⚠️ [JOB RUNS] Could not record the end of ${job}: ${error.message}`);
        }
    };
    try {
        const result = await fn();
        finish(true, summarize(result));
        return result;
    } catch (error) {
        finish(false, { error: String((error && error.message) || error).slice(0, 300) });
        throw error;
    }
}

/** A node-cron stand-in for one module: schedule() records the jobs the module's name table knows. */
function cronFor(moduleName) {
    return {
        ...cron,
        schedule(expression, fn, options) {
            const job = jobName(moduleName, expression, options);
            const task = job ? (...args) => recordRun(job, () => fn(...args)) : fn;
            return cron.schedule(expression, task, options);
        }
    };
}

module.exports = { cronFor, recordRun, jobName, summarize, NAMES, RETENTION_DAYS, RECORD_TIMEOUT_MS };
