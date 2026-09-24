/**
 * Strategy version (GAPS #14, README.md section 1): which version of the trading rules booked a trade.
 *
 * Every row that enters `trades` or `high_conviction_portfolio` carries it in strategy_version. The three INSERTs
 * in database-postgres.js write it - insertTrade, bulkInsertTrades and addHighConvictionTrade, the only statements
 * that create a trade or a position (a unit test fails on any other) - so every caller is stamped without doing
 * anything: the 1 PM executor (the house book and every subscriber's), the Positions page's add and import
 * (POST /api/trades, POST /api/trades/bulk) and the high-conviction book. A caller cannot choose it, so a
 * request body cannot claim a version. A manual or imported row is stamped too; its owner chose it, not these
 * rules, so attribution reads the automatic rows (auto_added) and the high-conviction book.
 *
 * Rows booked before stamping began hold NULL. The rules changed more than once after the 2026-08-07 reset
 * (for example 1159327 let a position close on the day it was booked, and since the market caps are stored the
 * executor books a market's signals largest company first), so no one version would be true for them.
 *
 * The stamp is taken when the row is inserted: a signal the 7 AM scan selected before a deploy and the 1 PM
 * executor booked after it carries the version it was booked under.
 *
 * WHEN TO BUMP STRATEGY_VERSION: in the same commit as any change that can change which trades are taken or how
 * they exit:
 *   - the entry rule: the DTI calculation, its threshold, the 7-day DTI, the scan universe;
 *   - the selection: the backtest win-rate bar, a minimum number of backtest trades, the backtest engine behind
 *     it, the AI conviction gate and its verdicts, the market-cap ordering, the position limits;
 *   - the booking: the execution time, the live-price drift guard, the position size;
 *   - the exits: the target, the stop (a trailing stop included), the holding limit;
 *   - the bars the rules read (a Yahoo data repair).
 * A change that alters none of these - a message, a page, a report, a log, a probe - is not a bump. Bump by
 * counting up (v1, v2, ...), and add a line below saying what changed. It is not the deploy's commit: most
 * deploys leave the rules alone, and a stamp that changed with every deploy would split one set of rules into
 * many.
 *
 *   v1  the rules live when stamping began: the DTI (14, 10, 5) below 0 and rising; a backtest win rate above
 *       75%; the AI conviction gate (GO only); a market's signals booked largest company first, then by win
 *       rate, at 13:00 local at the live price within 3% of the signal's (the high-conviction book at the 7 AM
 *       scan); +8% target, -5% stop, 30-day limit.
 *
 * Runtime switches that change the rules without a deploy (README rule 7) are named after the version while they
 * are on, so a flip shows in the data from the day it happens: v1+unit-repair, v1+no-ai-gate+drift=2. A new
 * switch of that kind goes into SWITCHES in the commit that adds it.
 */
'use strict';

const PriceUnitRepair = require('./price-unit-repair');
const StaleFillRepair = require('./stale-fill-repair');

const STRATEGY_VERSION = 'v1';

// The entry drift guard's default in lib/scheduler/trade-executor.js and lib/portfolio/high-conviction-manager.js
const DEFAULT_ENTRY_DRIFT_PERCENT = 3;

// Each switch reads the environment exactly as the code it switches does
const SWITCHES = [
    // PRICE_UNIT_REPAIR=true: the pence/pounds repair is applied to the bars (lib/shared/yahoo-client.js)
    ['unit-repair', env => PriceUnitRepair.isRepairEnabled(env)],
    // STALE_FILL_REPAIR=true: the stale-fill repair is applied to the bars (lib/shared/yahoo-client.js)
    ['stale-fill', env => StaleFillRepair.isRepairEnabled(env)],
    // AI_CONVICTION_GATE=false: every indicator signal passes (lib/scanner/scanner.js, trade-executor.js)
    ['no-ai-gate', env => env.AI_CONVICTION_GATE === 'false'],
    // MAX_ENTRY_DRIFT_PERCENT: the booking's price guard, when it is not the default
    ['drift', env => {
        const percent = parseFloat(env.MAX_ENTRY_DRIFT_PERCENT) || DEFAULT_ENTRY_DRIFT_PERCENT;
        return percent === DEFAULT_ENTRY_DRIFT_PERCENT ? false : `drift=${percent}`;
    }],
    // SKIP_DEAD_TICKERS=true: the 7 AM scan leaves the dead tickers out of its universe (lib/shared/ticker-health.js)
    ['skip-dead', env => String((env && env.SKIP_DEAD_TICKERS) || '').trim().toLowerCase() === 'true']
];

/**
 * The stamp for a row inserted now: STRATEGY_VERSION, then '+' and the name of each switch that is on.
 * @param {object} [env]  defaults to process.env
 * @returns {string}
 */
function strategyVersion(env = process.env) {
    let stamp = STRATEGY_VERSION;
    for (const [name, isOn] of SWITCHES) {
        const on = isOn(env);
        if (on) stamp += '+' + (typeof on === 'string' ? on : name);
    }
    return stamp;
}

module.exports = { STRATEGY_VERSION, strategyVersion, SWITCHES };
