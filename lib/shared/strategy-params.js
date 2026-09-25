/**
 * Strategy parameters (GAPS #9, README.md section 1): every number the trading rules run on, in one place.
 *
 * The server's readers require this file: the 7 AM scan (lib/scanner/scanner.js), the 1 PM executor
 * (lib/scheduler/trade-executor.js), the paper capital ledger (lib/portfolio/capital-manager.js), the
 * high-conviction book (lib/portfolio/high-conviction-manager.js), the AI conviction gate (ml/conviction-engine.js),
 * the rules' version stamp (strategy-version.js), the DTI (dti-calculator.js) and both backtest engines
 * (frontend-backtest-calculator.js, the scan's; backtest-calculator.js, the Simulator's). The Simulator and the
 * Positions page load it through /lib (middleware/browser-lib.js) and read window.StrategyParams.
 *
 * Every value is the one its readers used when this module was written: moving them here changed no trade.
 * Changing one changes which trades are taken or how they exit, so raise STRATEGY_VERSION in strategy-version.js
 * in the same commit (README rule 7). tests/unit/strategy-params.test.js pins each value, fails when a reader
 * writes one out again, and lists the copies still written out (each must agree with this file) and the readers
 * that use a different number on purpose until the owner reconciles them.
 *
 * Written for a page as well as for node: no requires, and nothing read from the environment here - the one
 * runtime override, MAX_ENTRY_DRIFT_PERCENT, is read through entryDriftPercent(), which is handed the environment.
 */
(function () {
    'use strict';

    // ------------------------------------------------------------------------------------------------ the entry

    // Blau's DTI (dti-calculator.js): the periods of its three EMAs, in bars (trading days). r smooths the daily
    // momentum, s smooths that, u smooths it once more. The 7-day DTI uses the same three.
    const DTI_PERIODS = Object.freeze({ r: 14, s: 10, u: 5 });

    // The 7-day DTI is the DTI of blocks of this many bars, counted from the first bar of the download (GAPS #8)
    const SEVEN_DAY_DTI_BARS = 7;

    // A day is an entry when its DTI (-100 to +100) is below this, above the day before, and the 7-day DTI is
    // rising. Blau's own value is -40 (GAPS #4)
    const ENTRY_THRESHOLD = 0;

    // No backtest trade is entered in the first this-many months of the history, while the DTI's averages settle
    // (the scan's engine and the Positions page's; the Simulator leaves the same months out of its win rates)
    const WARMUP_MONTHS = 6;

    // -------------------------------------------------------------------------------------------- the selection

    // Years of daily bars a stock's backtest win rate is measured over (the scan downloads this many; the
    // Simulator measures as many years before the day its simulation starts)
    const BACKTEST_HISTORY_YEARS = 5;

    // A signal is sent and booked only when its backtest win rate, in percent, is above this. There is no minimum
    // number of backtest trades: one completed trade gives a win rate (GAPS #1 proposes at least 15)
    const WIN_RATE_BAR_PERCENT = 75;

    // A signal counts only when its day is one of the last this-many trading days (weekdays), today included
    const RECENT_SIGNAL_TRADING_DAYS = 2;

    // The AI conviction gate (ml/conviction-engine.js; the owner's cloud routine mirrors it). Each pillar scores
    // 1 to 10; the blended confidence is their mean weighted by these percentages, rounded to one decimal
    const CONVICTION_WEIGHTS = Object.freeze({ technical: 45, fundamental: 30, information: 25 });

    // A confidence above CONVICTION_GO_ABOVE is GO, the only verdict that trades; from CONVICTION_WATCH_FROM up
    // to it is WATCH; below is PASS
    const CONVICTION_GO_ABOVE = 6;
    const CONVICTION_WATCH_FROM = 5;

    // ---------------------------------------------------------------------------------------------- the booking

    // The 1 PM executor skips a signal whose live price is more than this many percent away, either way, from
    // the 7 AM signal's price, and so does the high-conviction book at the scan. MAX_ENTRY_DRIFT_PERCENT
    // overrides it without a deploy (strategy-version.js names the override in every trade's stamp)
    const DEFAULT_ENTRY_DRIFT_PERCENT = 3;

    // An account's paper ledger (capital-manager.js) holds at most this many open positions per market, and in all
    const MAX_POSITIONS_PER_MARKET = 10;
    const MAX_POSITIONS_TOTAL = 30;

    // A new position is (the market's initial capital + its realized P/L) / MAX_POSITIONS_PER_MARKET, in the
    // market's currency, and never less than MIN_TRADE_SIZE_SHARE of the market's standard size below. The
    // standard size is also what a position is sized at when the account has no ledger row for the market
    const TRADE_SIZES = Object.freeze({
        India: Object.freeze({ currency: 'INR', amount: 50000 }),
        UK: Object.freeze({ currency: 'GBP', amount: 400 }),
        US: Object.freeze({ currency: 'USD', amount: 500 })
    });
    const MIN_TRADE_SIZE_SHARE = 0.1;

    // The high-conviction book invests a fixed amount per position: the amount in the market's own currency (gbp
    // for UK, inr for India, usd for US and anything else) sizes it. The other two are that amount in the report's
    // other currencies at the old fixed rates, stored at entry; lib/shared/fx-rates.js restamps them each night at
    // the entry day's dated rate (GAPS #11), so only the own-currency amount is a rule
    const HIGH_CONVICTION_INVESTMENTS = Object.freeze({
        UK: Object.freeze({ gbp: 250, inr: 26250, usd: 318 }),
        India: Object.freeze({ gbp: 238, inr: 25000, usd: 301 }),
        US: Object.freeze({ gbp: 236, inr: 24900, usd: 300 }),
        International: Object.freeze({ gbp: 250, inr: 26250, usd: 318 })
    });

    // ------------------------------------------------------------------------------------------------ the exits

    // A position closes at the first check where its P/L, in percent of the price paid, is TAKE_PROFIT_PERCENT
    // or more (the target) or -STOP_LOSS_PERCENT or less (the stop), or when it has been held MAX_HOLDING_DAYS
    // calendar days (its square-off date is the entry day plus as many)
    const TAKE_PROFIT_PERCENT = 8;
    const STOP_LOSS_PERCENT = 5;
    const MAX_HOLDING_DAYS = 30;

    // What a backtest engine is handed (runBacktest's params): the scan's engine and the Simulator's
    const BACKTEST_PARAMS = Object.freeze({
        r: DTI_PERIODS.r,
        s: DTI_PERIODS.s,
        u: DTI_PERIODS.u,
        entryThreshold: ENTRY_THRESHOLD,
        takeProfitPercent: TAKE_PROFIT_PERCENT,
        stopLossPercent: STOP_LOSS_PERCENT,
        maxHoldingDays: MAX_HOLDING_DAYS
    });

    /** The target price of a position bought at entryPrice */
    function targetPrice(entryPrice) {
        return entryPrice * (1 + TAKE_PROFIT_PERCENT / 100);
    }

    /** The stop price of a position bought at entryPrice */
    function stopLossPrice(entryPrice) {
        return entryPrice * (1 - STOP_LOSS_PERCENT / 100);
    }

    /**
     * The entry drift guard in force, in percent: MAX_ENTRY_DRIFT_PERCENT from the environment it is handed, read
     * the way the executor reads it - a value that is not a number, or is 0, means the default
     * @param {object} env  the environment (node's)
     */
    function entryDriftPercent(env) {
        return parseFloat((env || {}).MAX_ENTRY_DRIFT_PERCENT) || DEFAULT_ENTRY_DRIFT_PERCENT;
    }

    const StrategyParams = Object.freeze({
        DTI_PERIODS,
        SEVEN_DAY_DTI_BARS,
        ENTRY_THRESHOLD,
        WARMUP_MONTHS,
        BACKTEST_HISTORY_YEARS,
        WIN_RATE_BAR_PERCENT,
        RECENT_SIGNAL_TRADING_DAYS,
        CONVICTION_WEIGHTS,
        CONVICTION_GO_ABOVE,
        CONVICTION_WATCH_FROM,
        DEFAULT_ENTRY_DRIFT_PERCENT,
        MAX_POSITIONS_PER_MARKET,
        MAX_POSITIONS_TOTAL,
        TRADE_SIZES,
        MIN_TRADE_SIZE_SHARE,
        HIGH_CONVICTION_INVESTMENTS,
        TAKE_PROFIT_PERCENT,
        STOP_LOSS_PERCENT,
        MAX_HOLDING_DAYS,
        BACKTEST_PARAMS,
        targetPrice,
        stopLossPrice,
        entryDriftPercent
    });

    // Node (the server) and a page (window.StrategyParams, loaded before the scripts that read it)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = StrategyParams;
    }
    if (typeof window !== 'undefined') {
        window.StrategyParams = StrategyParams;
    }
})();
