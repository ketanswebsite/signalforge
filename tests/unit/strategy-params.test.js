/**
 * GAPS #9: the strategy's parameters live in one module, lib/shared/strategy-params.js.
 *
 *   1. Its values are the ones the rules ran on when it was written. Changing one is a rule change: raise
 *      STRATEGY_VERSION in lib/shared/strategy-version.js in the same commit (README rule 7), then the value here.
 *   2. No reader writes a parameter out again. Each pattern below is a way the code used to spell one; every server
 *      file and every page script is searched, comment lines skipped. What still matches is in HELD with the reason
 *      it stays, and a held copy of a module value must still read that value, so changing the module fails here
 *      until each copy is changed with it. The copies that disagree on purpose wait for the owner.
 *   3. The module loads in a page (no requires, nothing read from the environment, window.StrategyParams), and a
 *      page that runs a script reading window.StrategyParams loads the module before it.
 *   4. The Positions page's hidden inputs, which its chart's backtest reads, hold the module's values.
 *   5. MAX_ENTRY_DRIFT_PERCENT, the one runtime override, is read the way the executor reads it.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const P = require('../../lib/shared/strategy-params');

const ROOT = path.join(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const MODULE = 'lib/shared/strategy-params.js';

// ------------------------------------------------------------------------------------------------------ the values

describe('the values', () => {
    test('are the ones the rules ran on (a change here is a rule change: raise STRATEGY_VERSION)', () => {
        expect(JSON.parse(JSON.stringify(P))).toEqual({
            DTI_PERIODS: { r: 14, s: 10, u: 5 },
            SEVEN_DAY_DTI_BARS: 7,
            ENTRY_THRESHOLD: 0,
            WARMUP_MONTHS: 6,
            BACKTEST_HISTORY_YEARS: 5,
            WIN_RATE_BAR_PERCENT: 75,
            RECENT_SIGNAL_TRADING_DAYS: 2,
            CONVICTION_WEIGHTS: { technical: 45, fundamental: 30, information: 25 },
            CONVICTION_GO_ABOVE: 6,
            CONVICTION_WATCH_FROM: 5,
            DEFAULT_ENTRY_DRIFT_PERCENT: 3,
            MAX_POSITIONS_PER_MARKET: 10,
            MAX_POSITIONS_TOTAL: 30,
            TRADE_SIZES: {
                India: { currency: 'INR', amount: 50000 },
                UK: { currency: 'GBP', amount: 400 },
                US: { currency: 'USD', amount: 500 }
            },
            MIN_TRADE_SIZE_SHARE: 0.1,
            HIGH_CONVICTION_INVESTMENTS: {
                UK: { gbp: 250, inr: 26250, usd: 318 },
                India: { gbp: 238, inr: 25000, usd: 301 },
                US: { gbp: 236, inr: 24900, usd: 300 },
                International: { gbp: 250, inr: 26250, usd: 318 }
            },
            TAKE_PROFIT_PERCENT: 8,
            STOP_LOSS_PERCENT: 5,
            MAX_HOLDING_DAYS: 30,
            BACKTEST_PARAMS: { r: 14, s: 10, u: 5, entryThreshold: 0, takeProfitPercent: 8, stopLossPercent: 5, maxHoldingDays: 30 }
        });
    });

    test('the price helpers give what "* 1.08" and "* 0.95" gave, bit for bit, and the weights divide exactly', () => {
        for (const price of [100, 103, 97, 0.0123, 77.77, 1234.5, 2837.45, 0]) {
            expect(P.targetPrice(price)).toBe(price * 1.08);
            expect(P.stopLossPrice(price)).toBe(price * 0.95);
        }
        // ml/conviction-engine.js blends with weight / 100; these are the literals it used to multiply by
        expect([P.CONVICTION_WEIGHTS.technical / 100, P.CONVICTION_WEIGHTS.fundamental / 100, P.CONVICTION_WEIGHTS.information / 100])
            .toEqual([0.45, 0.30, 0.25]);
    });

    test('nothing in it can be changed at run time', () => {
        const objects = [P, P.DTI_PERIODS, P.CONVICTION_WEIGHTS, P.TRADE_SIZES, P.HIGH_CONVICTION_INVESTMENTS, P.BACKTEST_PARAMS,
            ...Object.values(P.TRADE_SIZES), ...Object.values(P.HIGH_CONVICTION_INVESTMENTS)];
        expect(objects.filter(object => !Object.isFrozen(object))).toEqual([]);
    });
});

// ---------------------------------------------------------------------------------------------- no second copy

const escape = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const either = values => `(?:${values.map(escape).join('|')})`;
const W = P.CONVICTION_WEIGHTS;

/** Ways the code spelled a parameter before it read the module. A keyed one matches any number */
const PATTERNS = {
    'the target, keyed': /\b(?:takeProfitPercent|TAKE_PROFIT_PERCENT|TARGET_PERCENT|targetPercent)\s*(?:[:=]|\|\|)\s*-?\d/g,
    'the stop, keyed': /\b(?:stopLossPercent|STOP_LOSS_PERCENT|stopPercent)\s*(?:[:=]|\|\|)\s*-?\d/g,
    'the holding limit, keyed': /\b(?:maxHoldingDays|MAX_HOLDING_DAYS)\s*(?:[:=]|\|\|)\s*\d/g,
    'the entry threshold, keyed': /\bentryThreshold\s*(?:[:=]|\|\|)\s*-?\d/g,
    'the target as a multiplier': new RegExp(`(?<![\\d.])${escape(1 + P.TAKE_PROFIT_PERCENT / 100)}(?![\\d.])`, 'g'),
    'the stop as a multiplier': new RegExp(`(?<![\\d.])${escape(1 - P.STOP_LOSS_PERCENT / 100)}(?![\\d.])`, 'g'),
    'an exit check on the P/L': new RegExp(`\\b[pP][lL]Percent\\s*(?:>=\\s*${P.TAKE_PROFIT_PERCENT}|<=\\s*-${P.STOP_LOSS_PERCENT})\\b`, 'g'),
    'the holding limit in days': new RegExp(`\\.getDate\\(\\)\\s*\\+\\s*${P.MAX_HOLDING_DAYS}\\b`, 'g'),
    'the DTI periods': new RegExp(`\\b(?:r\\s*[:=]\\s*${P.DTI_PERIODS.r}|s\\s*[:=]\\s*${P.DTI_PERIODS.s}|u\\s*[:=]\\s*${P.DTI_PERIODS.u})\\b`, 'g'),
    'the 7-day blocks': new RegExp(`%\\s*${P.SEVEN_DAY_DTI_BARS}\\s*===`, 'g'),
    'the warm-up': new RegExp(`\\.getMonth\\(\\)\\s*\\+\\s*${P.WARMUP_MONTHS}\\b`, 'g'),
    'the history': new RegExp(`\\b${P.BACKTEST_HISTORY_YEARS}\\s*\\*\\s*365\\b|getFullYear\\(\\)\\s*-\\s*${P.BACKTEST_HISTORY_YEARS}\\b`, 'g'),
    'the win-rate bar': new RegExp(`\\b(?:winRate|HIGH_CONVICTION_THRESHOLD|WIN_RATE_BAR_PERCENT)\\s*(?:>=?|:)\\s*${P.WIN_RATE_BAR_PERCENT}\\b`, 'g'),
    'the recent-signal window': /\bdaysToCheck\s*=\s*\d|\bisWithinTradingDays\([^)]*,\s*\d+\s*\)/g,
    'the position limits': /\bMAX_POSITIONS_(?:TOTAL|PER_MARKET)\s*:\s*\d/g,
    'the trade sizes': new RegExp(`\\bamount\\s*:\\s*${either(Object.values(P.TRADE_SIZES).map(size => size.amount))}\\b`, 'g'),
    'the size floor': new RegExp(`\\bamount\\s*\\*\\s*${escape(P.MIN_TRADE_SIZE_SHARE)}\\b`, 'g'),
    'the conviction weights': new RegExp(`\\*\\s*${either(Object.values(W).map(weight => weight / 100))}(?![\\d.])` +
        `|(?<![-\\w])weight\\s*:\\s*${either(Object.values(W))}\\b|\\bweight ${either(Object.values(W))}%`, 'g'),
    'the conviction bands': new RegExp(`\\bconfidence\\s*(?:>\\s*${P.CONVICTION_GO_ABOVE}|>=\\s*${P.CONVICTION_WATCH_FROM})\\b`, 'g'),
    'the drift default': /MAX_ENTRY_DRIFT_PERCENT\)\s*\|\|\s*\d/g,
    'the stop in days of range': new RegExp(`\\b${P.STOP_LOSS_PERCENT}\\s*\\/\\s*adr20\\b`, 'g')
};

// The trailing-stop work (uncommitted when this was written) rewrites the lines next to these copies; they read the
// module once it has landed
const BESIDE_TRAILING_STOP_WORK = 'beside lines the trailing-stop work in progress rewrites';

/**
 * Copies still written out, exactly as written, how many times, and why. `agrees` gives the text the copy must read
 * for the module's current values; `disagrees` marks a reader that uses another number on purpose until the owner
 * reconciles it (it changes which trades are taken or what a page shows); `unrelated` is a match that is not a
 * strategy parameter. The count is a ceiling: a copy that goes away needs no change here.
 */
const HELD = [
    // the exit monitor's exit rule
    { file: 'lib/portfolio/exit-monitor.js', text: 'TARGET_PERCENT: 8', times: 1, why: BESIDE_TRAILING_STOP_WORK, agrees: p => `TARGET_PERCENT: ${p.TAKE_PROFIT_PERCENT}` },
    { file: 'lib/portfolio/exit-monitor.js', text: 'STOP_LOSS_PERCENT: 5', times: 1, why: BESIDE_TRAILING_STOP_WORK, agrees: p => `STOP_LOSS_PERCENT: ${p.STOP_LOSS_PERCENT}` },
    { file: 'lib/portfolio/exit-monitor.js', text: 'MAX_HOLDING_DAYS: 30', times: 1, why: BESIDE_TRAILING_STOP_WORK, agrees: p => `MAX_HOLDING_DAYS: ${p.MAX_HOLDING_DAYS}` },
    // the scan's backtest parameters (scanStockBatchForOpportunities and the uncalled scanStockBatchWithBacktest)
    { file: 'lib/scanner/scanner.js', text: 'takeProfitPercent: 8', times: 2, why: BESIDE_TRAILING_STOP_WORK, agrees: p => `takeProfitPercent: ${p.TAKE_PROFIT_PERCENT}` },
    { file: 'lib/scanner/scanner.js', text: 'stopLossPercent: 5', times: 2, why: BESIDE_TRAILING_STOP_WORK, agrees: p => `stopLossPercent: ${p.STOP_LOSS_PERCENT}` },
    { file: 'lib/scanner/scanner.js', text: 'maxHoldingDays: 30', times: 2, why: BESIDE_TRAILING_STOP_WORK, agrees: p => `maxHoldingDays: ${p.MAX_HOLDING_DAYS}` },
    // the two engines' defaults and fallbacks
    { file: 'lib/shared/backtest-calculator.js', text: 'maxHoldingDays = 30', times: 1, why: BESIDE_TRAILING_STOP_WORK, agrees: p => `maxHoldingDays = ${p.MAX_HOLDING_DAYS}` },
    { file: 'lib/shared/frontend-backtest-calculator.js', text: 'params.stopLossPercent || 5', times: 1, why: BESIDE_TRAILING_STOP_WORK, agrees: p => `params.stopLossPercent || ${p.STOP_LOSS_PERCENT}` },
    { file: 'lib/shared/frontend-backtest-calculator.js', text: 'params.maxHoldingDays || 30', times: 1, why: BESIDE_TRAILING_STOP_WORK, agrees: p => `params.maxHoldingDays || ${p.MAX_HOLDING_DAYS}` },
    // the high-conviction book's stop and exit reasons
    { file: 'lib/portfolio/high-conviction-manager.js', text: 'pl.plPercent <= -5', times: 1, why: BESIDE_TRAILING_STOP_WORK, agrees: p => `pl.plPercent <= -${p.STOP_LOSS_PERCENT}` },
    { file: 'lib/portfolio/high-conviction-manager.js', text: "'Take Profit (8%)'", times: 1, why: BESIDE_TRAILING_STOP_WORK, agrees: p => `'Take Profit (${p.TAKE_PROFIT_PERCENT}%)'` },
    { file: 'lib/portfolio/high-conviction-manager.js', text: "'Stop Loss (5%)'", times: 1, why: BESIDE_TRAILING_STOP_WORK, agrees: p => `'Stop Loss (${p.STOP_LOSS_PERCENT}%)'` },
    { file: 'lib/portfolio/high-conviction-manager.js', text: "'Max Days (30 days)'", times: 1, why: BESIDE_TRAILING_STOP_WORK, agrees: p => `'Max Days (${p.MAX_HOLDING_DAYS} days)'` },
    // the messages that spell the rule out
    { file: 'lib/scheduler/trade-executor.js', text: 'Target +8%, stop −5%', times: 1, why: BESIDE_TRAILING_STOP_WORK, agrees: p => `Target +${p.TAKE_PROFIT_PERCENT}%, stop −${p.STOP_LOSS_PERCENT}%` },
    { file: 'lib/scheduler/trade-executor.js', text: '30-day max hold', times: 1, why: BESIDE_TRAILING_STOP_WORK, agrees: p => `${p.MAX_HOLDING_DAYS}-day max hold` },
    { file: 'lib/portfolio/eod-summary.js', text: '+8% target', times: 1, why: BESIDE_TRAILING_STOP_WORK, agrees: p => `+${p.TAKE_PROFIT_PERCENT}% target` },
    { file: 'lib/portfolio/eod-summary.js', text: '−5% stop', times: 1, why: BESIDE_TRAILING_STOP_WORK, agrees: p => `−${p.STOP_LOSS_PERCENT}% stop` },
    { file: 'lib/portfolio/eod-summary.js', text: '30-day max hold', times: 1, why: BESIDE_TRAILING_STOP_WORK, agrees: p => `${p.MAX_HOLDING_DAYS}-day max hold` },
    // the drift guard's default: tests/unit/strategy-version.test.js checks both lines as written
    { file: 'lib/scheduler/trade-executor.js', text: 'parseFloat(process.env.MAX_ENTRY_DRIFT_PERCENT) || 3', times: 1, why: 'strategy-version.test.js checks this line', agrees: p => `parseFloat(process.env.MAX_ENTRY_DRIFT_PERCENT) || ${p.DEFAULT_ENTRY_DRIFT_PERCENT}` },
    { file: 'lib/portfolio/high-conviction-manager.js', text: 'parseFloat(process.env.MAX_ENTRY_DRIFT_PERCENT) || 3', times: 1, why: 'strategy-version.test.js checks this line', agrees: p => `parseFloat(process.env.MAX_ENTRY_DRIFT_PERCENT) || ${p.DEFAULT_ENTRY_DRIFT_PERCENT}` },
    // the Positions page's own copies
    { file: 'public/js/dti-indicators.js', text: '% 7 ===', times: 1, why: 'its own DTI copy: strategy-dti.test.js runs it with no window.StrategyParams and holds it to lib\'s numbers', agrees: p => `% ${p.SEVEN_DAY_DTI_BARS} ===` },
    { file: 'public/js/trade-core.js', text: 'trade.squareOffDate.getDate() + 30', times: 3, why: 'fallbacks for a trade stored without them; live-prices-batches.test.js runs this file with no window.StrategyParams', agrees: p => `trade.squareOffDate.getDate() + ${p.MAX_HOLDING_DAYS}` },
    { file: 'public/js/trade-core.js', text: 'trade.entryPrice * 0.95', times: 2, why: 'fallbacks for a trade stored without them; live-prices-batches.test.js runs this file with no window.StrategyParams', agrees: p => `trade.entryPrice * ${1 - p.STOP_LOSS_PERCENT / 100}` },
    { file: 'public/js/trade-core.js', text: 'trade.entryPrice * 1.08', times: 1, why: 'fallbacks for a trade stored without them; live-prices-batches.test.js runs this file with no window.StrategyParams', agrees: p => `trade.entryPrice * ${1 + p.TAKE_PROFIT_PERCENT / 100}` },
    { file: 'public/js/TradeUI-Dialogs.js', text: 'trade.stopLossPercent || 5', times: 1, why: 'the Sell dialog\'s pre-selection for a trade stored without its stop', agrees: p => `trade.stopLossPercent || ${p.STOP_LOSS_PERCENT}` },
    { file: 'public/js/dti-data.js', text: '5 * 365', times: 2, why: 'the chart\'s period table; the chart dialog asks for \'5y\'', agrees: p => `${p.BACKTEST_HISTORY_YEARS} * 365` },
    { file: 'public/js/signals-display.js', text: 'winRate >= 75', times: 1, why: 'the lowest win-rate badge on a signal card', agrees: p => `winRate >= ${p.WIN_RATE_BAR_PERCENT}` },
    { file: 'public/js/dti-backtest.js', text: 'u: 5', times: 1, why: 'findOptimalParameters, which nothing calls', agrees: p => `u: ${p.DTI_PERIODS.u}` },
    // readers that use another number on purpose, until the owner reconciles them
    { file: 'lib/shared/dti-calculator.js', text: 'entryThreshold = -40', times: 2, disagrees: 'Blau\'s -40 as the default of detectTradeSignals and analyzeStock; no live caller leaves the threshold out (GAPS #4)' },
    { file: 'public/js/TradeUI-Dialogs.js', text: 'trade.takeProfitPercent || 10', times: 1, disagrees: 'the Sell dialog pre-selects "Target Reached" from +10% for a trade stored without its target' },
    // not a strategy parameter
    { file: 'lib/shared/market-cap-service.js', text: "'EUR': 1.08", times: 1, unrelated: 'an exchange rate' }
];

/** Every server file and every page script, as a path from the repository root */
function readers() {
    const out = ['server.js', 'database-postgres.js'];
    const walk = dir => {
        for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
            const rel = path.posix.join(dir, entry.name);
            if (entry.isDirectory()) walk(rel);
            else if (entry.name.endsWith('.js')) out.push(rel);
        }
    };
    for (const dir of ['lib', 'ml', 'routes', 'middleware', 'config', 'public/js']) walk(dir);
    return out.filter(file => file !== MODULE);
}

/** The file's code with its comment lines blanked (line numbers kept) and its held copies taken out */
function codeOf(file) {
    let code = read(file).replace(/^[ \t]*(?:\/\/|\/\*|\*).*$/gm, '');
    for (const held of HELD.filter(entry => entry.file === file)) {
        for (let i = 0; i < held.times; i++) code = code.replace(held.text, '');
    }
    return code;
}

describe('no reader writes a parameter out again', () => {
    const files = readers();

    test('the search sees what it must: the known readers, and every held copy in the file named', () => {
        for (const file of ['lib/scanner/scanner.js', 'lib/scheduler/trade-executor.js', 'lib/portfolio/exit-monitor.js',
            'lib/portfolio/high-conviction-manager.js', 'lib/portfolio/capital-manager.js', 'lib/shared/backtest-calculator.js',
            'lib/shared/frontend-backtest-calculator.js', 'lib/shared/dti-calculator.js', 'ml/conviction-engine.js',
            'public/js/portfolio-simulator.js', 'public/js/dti-backtest.js']) {
            expect(files).toContain(file);
        }
        // positive control: every pattern finds a copy written the old way, with the module's numbers in it
        const control = {
            'the target, keyed': `takeProfitPercent: ${P.TAKE_PROFIT_PERCENT},`,
            'the stop, keyed': `STOP_LOSS_PERCENT: ${P.STOP_LOSS_PERCENT},`,
            'the holding limit, keyed': `maxHoldingDays = ${P.MAX_HOLDING_DAYS}`,
            'the entry threshold, keyed': `params.entryThreshold || ${P.ENTRY_THRESHOLD}`,
            'the target as a multiplier': `entryPrice * ${1 + P.TAKE_PROFIT_PERCENT / 100};`,
            'the stop as a multiplier': `entryPrice * ${1 - P.STOP_LOSS_PERCENT / 100};`,
            'an exit check on the P/L': `if (pl.plPercent >= ${P.TAKE_PROFIT_PERCENT}) {`,
            'the holding limit in days': `squareOffDate.setDate(squareOffDate.getDate() + ${P.MAX_HOLDING_DAYS});`,
            'the DTI periods': `const r = ${P.DTI_PERIODS.r};`,
            'the 7-day blocks': `if (i % ${P.SEVEN_DAY_DTI_BARS} === 0 && i > 0) {`,
            'the warm-up': `earliestAllowableDate.setMonth(firstDate.getMonth() + ${P.WARMUP_MONTHS});`,
            'the history': `endDate - (${P.BACKTEST_HISTORY_YEARS} * 365 * 24 * 60 * 60)`,
            'the win-rate bar': `return winRate > ${P.WIN_RATE_BAR_PERCENT};`,
            'the recent-signal window': `isWithinTradingDays(signalDate, ${P.RECENT_SIGNAL_TRADING_DAYS})`,
            'the position limits': `MAX_POSITIONS_PER_MARKET: ${P.MAX_POSITIONS_PER_MARKET}`,
            'the trade sizes': `'UK': { currency: 'GBP', amount: ${P.TRADE_SIZES.UK.amount} }`,
            'the size floor': `TRADE_SIZES[market].amount * ${P.MIN_TRADE_SIZE_SHARE};`,
            'the conviction weights': `pillars.technical.score * ${W.technical / 100} + x, weight: ${W.fundamental} }`,
            'the conviction bands': `confidence > ${P.CONVICTION_GO_ABOVE} ? 'GO'`,
            'the drift default': `parseFloat(process.env.MAX_ENTRY_DRIFT_PERCENT) || ${P.DEFAULT_ENTRY_DRIFT_PERCENT};`,
            'the stop in days of range': `adr20 > 0 ? ${P.STOP_LOSS_PERCENT} / adr20 : 99`
        };
        expect(Object.keys(control).sort()).toEqual(Object.keys(PATTERNS).sort());
        for (const [name, sample] of Object.entries(control)) {
            expect(`${name}: ${(sample.match(PATTERNS[name]) || []).length > 0}`).toBe(`${name}: true`);
        }
        // and none mistakes CSS or an ordinary sign check for a parameter
        const innocent = 'font-weight: 600; const sign = plPercent >= 0; stats.winRate >= 50; date.setDate(date.getDate() + 1);';
        for (const [name, pattern] of Object.entries(PATTERNS)) expect(`${name}: ${innocent.match(pattern)}`).toBe(`${name}: null`);
        for (const held of HELD) expect(files).toContain(held.file);
    });

    test('outside the held copies, no reader spells a parameter', () => {
        const found = [];
        for (const file of files) {
            const lines = codeOf(file).split('\n');
            lines.forEach((line, i) => {
                for (const [name, pattern] of Object.entries(PATTERNS)) {
                    for (const match of line.match(pattern) || []) found.push(`${file}:${i + 1} ${name}: ${match}`);
                }
            });
        }
        // A match here is a parameter written out: read it from lib/shared/strategy-params.js instead
        expect(found).toEqual([]);
    });

    test('every held copy of a module value still reads that value', () => {
        const stale = HELD.filter(held => held.agrees && held.text !== held.agrees(P))
            .map(held => `${held.file}: "${held.text}" should read "${held.agrees(P)}"`);
        expect(stale).toEqual([]);
        // each entry says which kind it is
        for (const held of HELD) {
            expect([held.agrees, held.disagrees, held.unrelated].filter(Boolean)).toHaveLength(1);
            expect(held.times).toBeGreaterThan(0);
        }
    });
});

// ------------------------------------------------------------------------------------------------------ in a page

describe('in a page', () => {
    const source = read(MODULE);

    test('it needs nothing: no require, nothing from the environment; it sets window.StrategyParams', () => {
        expect(source).not.toMatch(/\brequire\(/);
        expect(source).not.toMatch(/process\.env/);
        const context = { window: {} };
        vm.createContext(context);
        vm.runInContext(source, context);
        expect(JSON.stringify(context.window.StrategyParams)).toBe(JSON.stringify(P));
        expect(context.window.StrategyParams.targetPrice(100)).toBe(P.targetPrice(100));
    });

    test('a page that runs a script reading window.StrategyParams loads the module first', () => {
        const scripts = [
            ...fs.readdirSync(path.join(ROOT, 'public/js')).filter(name => name.endsWith('.js')).map(name => `public/js/${name}`),
            ...fs.readdirSync(path.join(ROOT, 'lib/shared')).filter(name => name.endsWith('.js')).map(name => `lib/shared/${name}`)
        ].filter(file => file !== MODULE && read(file).includes('window.StrategyParams'));
        const url = file => (file.startsWith('public/') ? file.slice('public'.length) : `/${file}`);
        const readerUrls = new Set(scripts.map(url));
        // control: the readers this module was written for are seen
        expect([...readerUrls]).toEqual(expect.arrayContaining(['/lib/shared/dti-calculator.js', '/lib/shared/backtest-calculator.js',
            '/js/portfolio-simulator.js', '/js/TradeUI-Dialogs.js', '/js/dti-data.js', '/js/dti-backtest.js', '/js/trade-modal.js']));

        const pagesWithReaders = [];
        for (const page of fs.readdirSync(path.join(ROOT, 'public')).filter(name => name.endsWith('.html'))) {
            const html = read(`public/${page}`);
            const order = [...html.matchAll(/<script\b[^>]*\ssrc=["']([^"']+)["']/g)]
                .map(match => new URL(match[1], `http://pages.test/${page}`).pathname);
            const moduleAt = order.indexOf(`/${MODULE}`);
            const readersHere = order.filter(src => readerUrls.has(src));
            if (readersHere.length === 0) continue;
            pagesWithReaders.push(page);
            for (const reader of readersHere) {
                expect(`${page}: ${reader} after the module: ${moduleAt !== -1 && moduleAt < order.indexOf(reader)}`)
                    .toBe(`${page}: ${reader} after the module: true`);
            }
        }
        expect(pagesWithReaders).toEqual(expect.arrayContaining(['portfolio-backtest.html', 'trades.html']));
    });

    test('the Positions page\'s hidden inputs, which its chart\'s backtest reads, hold the module\'s values', () => {
        const html = read('public/trades.html');
        const input = id => (html.match(new RegExp(`<input type="hidden" id="${id}" value="([^"]*)">`)) || [])[1];
        expect({
            r: input('r'), s: input('s'), u: input('u'), weekly: input('enable-weekly-dti'), threshold: input('entry-threshold'),
            target: input('take-profit'), stop: input('stop-loss'), days: input('max-days')
        }).toEqual({
            r: String(P.DTI_PERIODS.r), s: String(P.DTI_PERIODS.s), u: String(P.DTI_PERIODS.u), weekly: 'true',
            threshold: String(P.ENTRY_THRESHOLD), target: String(P.TAKE_PROFIT_PERCENT), stop: String(P.STOP_LOSS_PERCENT),
            days: String(P.MAX_HOLDING_DAYS)
        });
    });
});

// ------------------------------------------------------------------------------------------------ the one override

describe('MAX_ENTRY_DRIFT_PERCENT', () => {
    test('is read as the executor reads it: parseFloat, and 0 or no number means the default', () => {
        for (const value of [undefined, '', '0', 'abc', '2', '1.5', ' 4 ', '-2', '3', '3%']) {
            expect(P.entryDriftPercent({ MAX_ENTRY_DRIFT_PERCENT: value })).toBe(parseFloat(value) || P.DEFAULT_ENTRY_DRIFT_PERCENT);
        }
        expect(P.entryDriftPercent({})).toBe(P.DEFAULT_ENTRY_DRIFT_PERCENT);
        expect(P.entryDriftPercent(undefined)).toBe(P.DEFAULT_ENTRY_DRIFT_PERCENT);
    });

    test('names itself in the stamp through the module: the default is no switch, anything else is', () => {
        const { STRATEGY_VERSION, strategyVersion } = require('../../lib/shared/strategy-version');
        expect(read('lib/shared/strategy-version.js')).toMatch(/StrategyParams\.entryDriftPercent\(env\)/);
        expect(strategyVersion({ MAX_ENTRY_DRIFT_PERCENT: String(P.DEFAULT_ENTRY_DRIFT_PERCENT) })).toBe(STRATEGY_VERSION);
        expect(strategyVersion({ MAX_ENTRY_DRIFT_PERCENT: '2.5' })).toBe(`${STRATEGY_VERSION}+drift=2.5`);
    });
});
