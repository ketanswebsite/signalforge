/**
 * Every named scheduled job hands its result to job_runs (lib/shared/job-runs.js records what a job's function
 * returns as the run's summary). Until 2026-09-25 most callbacks awaited their work and returned nothing, so
 * GET /api/ops/schedule-stats showed "ok" with an empty summary for the scan, the executors, the EOD summary and the
 * rest, and a failure a callback caught itself read "ok" with nothing to say why. Pinned here, for every job the
 * name tables know: its callback returns a value (the run's result, { error } or { skipped }).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { NAMES } = require('../../lib/shared/job-runs');

const ROOT = path.join(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const MODULES = {
    scanner: 'lib/scanner/scanner.js',
    executor: 'lib/scheduler/trade-executor.js',
    'market-caps': 'lib/scheduler/market-cap-updater.js'
};

/** The callback of cron.schedule('<expression>', ...) whose options name the zone (when given): up to its options */
function callbackOf(source, expression, zone) {
    const needle = `cron.schedule('${expression}'`;
    for (let at = source.indexOf(needle); at >= 0; at = source.indexOf(needle, at + 1)) {
        const optionsAt = source.indexOf('}, {', at);
        const options = source.slice(optionsAt, source.indexOf('}', optionsAt + 4) + 1);
        if (!zone || options.includes(zone)) return source.slice(at, optionsAt);
    }
    return null;
}

const jobs = Object.entries(NAMES).flatMap(([module, table]) => Object.entries(table).map(([key, name]) => {
    const [expression, zone] = key.split('|');
    return [name, module, expression, zone];
}));

test('control: the name tables list every module\'s jobs', () => {
    expect(jobs.length).toBeGreaterThanOrEqual(17);
    expect(jobs.map(j => j[0])).toEqual(expect.arrayContaining(['scan', 'executor-uk', 'eod-summary', 'market-caps-retry']));
});

test.each(jobs)('%s (%s, %s) returns what its run did', (name, module, expression, zone) => {
    const callback = callbackOf(read(MODULES[module]), expression, zone);
    expect(callback).not.toBeNull();
    // a return with a value: the run's result (return await ..., return this..., return result) or { error } / { skipped }
    expect(callback).toMatch(/\breturn\s+(await\s|this\.|result\b|\{)/);
});
