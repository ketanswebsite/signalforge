/**
 * Chart colours come from the design system's tokens, in both themes (public/js/chart-theme.js).
 *
 * Until 2026-09-24:
 * - the Positions chart dialog (dti-ui-charts.js) hard-coded its legend (#334155), axis ticks, grid,
 *   tooltips, candle wicks and series in the old slate palette, so in dark mode the legend was dark
 *   grey on the ink background;
 * - the Simulator's exit-reason doughnut coloured its slices by position: it leaves out the reasons
 *   nobody exited for, so with no stop-loss exits "Max Days" took the stop's red;
 * - the Simulator's and the Positions page's series kept the old theme's colours after a theme toggle
 *   (the Positions charts listened for a 'themechange' event that nothing sends).
 *
 * The scripts run in a vm context with the DOM calls they make. The token values are read from the real
 * design-system CSS (palette.css + themes.css), so a test compares against what the page shows.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUBLIC = path.join(__dirname, '../../public');
const read = rel => fs.readFileSync(path.join(PUBLIC, rel), 'utf8');

/** The custom properties of :root and [data-theme="dark"], with var() references resolved */
function designTokens() {
    const css = read('css/design-system/tokens/palette.css') + read('css/design-system/tokens/themes.css');
    const block = selector => {
        const out = {};
        for (const m of css.matchAll(new RegExp(selector + '\\s*\\{([^}]*)\\}', 'g'))) {
            for (const d of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[d[1]] = d[2].replace(/\/\*.*?\*\//g, '').trim();
        }
        return out;
    };
    const light = block(':root');
    const dark = { ...light, ...block('\\[data-theme="dark"\\]') };
    const resolve = (vars, value) => value.replace(/var\((--[\w-]+)\)/g, (_, name) => resolve(vars, vars[name] || ''));
    const done = vars => Object.fromEntries(Object.keys(vars).map(k => [k, resolve(vars, vars[k])]));
    return { light: done(light), dark: done(dark) };
}
const TOKENS = designTokens();

/** A context with the DOM chart-theme.js and the chart scripts touch; Chart is a recorder */
function page(theme = 'light') {
    const attrs = theme === 'dark' ? { 'data-theme': 'dark' } : {};
    const observers = [];
    const created = [];
    function FakeChart(item, config) {
        this.canvas = item.canvas || item; // a canvas, or its 2d context
        this.config = config;
        this.data = config.data;
        this.options = config.options;
        this.destroyed = false;
        created.push(this);
        this.update();
    }
    FakeChart.prototype.update = function() {
        (this.config.plugins || []).forEach(p => p.beforeUpdate && p.beforeUpdate(this));
    };
    FakeChart.prototype.destroy = function() { this.destroyed = true; };
    FakeChart.getChart = () => null;
    FakeChart.version = 'fake';
    FakeChart.instances = {};
    FakeChart.defaults = {
        font: {}, scale: { grid: {}, ticks: {}, title: {} },
        plugins: { legend: { labels: {} }, tooltip: {} }
    };
    const gradient = () => ({ stops: [], addColorStop(at, color) { this.stops.push([at, color]); } });
    const canvas = id => {
        const element = { id, closest: () => null };
        element.getContext = () => ({ canvas: element, createLinearGradient: gradient });
        return element;
    };
    const elements = {
        'entry-threshold': { value: '0' },
        'price-chart': canvas('price-chart'), 'dti-chart': canvas('dti-chart'), 'weekly-dti-chart': canvas('weekly-dti-chart')
    };
    ['portfolio-value-chart', 'monthly-returns-chart', 'trades-by-market-chart', 'pl-by-market-chart',
        'return-distribution-chart', 'exit-reason-chart', 'drawdown-chart'].forEach(id => { elements[id] = canvas(id); });
    const documentElement = {
        getAttribute: name => (name in attrs ? attrs[name] : null),
        setAttribute: (name, value) => { attrs[name] = String(value); },
        removeAttribute: name => { delete attrs[name]; }
    };
    const context = {
        console: { log() {}, warn() {}, error() {} },
        Chart: FakeChart,
        MutationObserver: function(callback) { this.observe = () => observers.push(callback); },
        getComputedStyle: () => ({
            getPropertyValue: name => (attrs['data-theme'] === 'dark' ? TOKENS.dark : TOKENS.light)[name] || ''
        }),
        document: {
            readyState: 'complete', documentElement,
            getElementById: id => elements[id] || null,
            querySelector: () => null, querySelectorAll: () => [],
            addEventListener() {}
        },
        setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}
    };
    context.window = context;
    context.innerWidth = 1280;
    vm.createContext(context);
    const run = rel => vm.runInContext(read(rel), context, { filename: rel });
    run('js/chart-theme.js');
    const setTheme = next => {
        if (next === 'dark') documentElement.setAttribute('data-theme', 'dark');
        else documentElement.removeAttribute('data-theme');
        observers.forEach(cb => cb([{ attributeName: 'data-theme' }]));
    };
    return { context, run, created, setTheme, ChartTheme: context.ChartTheme };
}

const REASON_TOKENS = {
    'Take Profit': '--gain', 'Target Reached': '--gain',
    'Stop Loss': '--loss', 'Stop Loss Hit': '--loss',
    'Max Days': '--warn', 'Time Exit': '--warn',
    'Manual Exit': '--info',
    'Other': '--text-3'
};

describe('chart-theme.js', () => {
    test('control: the token reader sees both themes', () => {
        expect(TOKENS.light['--gain']).toBe('#177A4C');
        expect(TOKENS.dark['--gain']).toBe('#4ADE80');
        expect(TOKENS.dark['--line']).toBe('rgba(243,239,230,.16)');
    });

    test('colors() are the design tokens of the current theme', () => {
        const { ChartTheme, setTheme } = page('light');
        const want = t => ({
            textColor: TOKENS[t]['--text-2'], gridColor: TOKENS[t]['--line'], tooltipBg: TOKENS[t]['--text'],
            tooltipText: TOKENS[t]['--bg'], backgroundColor: TOKENS[t]['--surface'], accent: TOKENS[t]['--accent'],
            gain: TOKENS[t]['--gain'], loss: TOKENS[t]['--loss'], warn: TOKENS[t]['--warn'], info: TOKENS[t]['--info'],
            muted: TOKENS[t]['--text-3']
        });
        expect(ChartTheme.colors()).toMatchObject(want('light'));
        setTheme('dark');
        expect(ChartTheme.colors()).toMatchObject(want('dark'));
    });

    test('an exit reason keeps its colour whatever else is in the chart (keyed by reason, not position)', () => {
        const { ChartTheme } = page('light');
        // No stop-loss exits: the old positional list [gain, loss, warn, stone] gave "Max Days" the stop's red
        const labels = ['Take Profit', 'Max Days', 'Other'];
        expect(labels.map(ChartTheme.exitReasonColor)).toEqual([TOKENS.light['--gain'], TOKENS.light['--warn'], TOKENS.light['--text-3']]);
        expect(ChartTheme.exitReasonColor('Max Days')).not.toBe(TOKENS.light['--loss']);
        expect(['Stop Loss', 'Take Profit'].map(ChartTheme.exitReasonColor)).toEqual([TOKENS.light['--loss'], TOKENS.light['--gain']]);
    });

    test('a reason has the same colour (its token) in light and dark', () => {
        const light = page('light').ChartTheme;
        const dark = page('dark').ChartTheme;
        for (const [reason, token] of Object.entries(REASON_TOKENS)) {
            expect([reason, light.exitReasonColor(reason)]).toEqual([reason, TOKENS.light[token]]);
            expect([reason, dark.exitReasonColor(reason)]).toEqual([reason, TOKENS.dark[token]]);
        }
    });

    test('an unknown reason is "Other", never a borrowed colour', () => {
        const { ChartTheme } = page('light');
        for (const reason of ['Something new', undefined, '', 'constructor', 'toString']) {
            expect(ChartTheme.exitReasonColor(reason)).toBe(TOKENS.light['--text-3']);
        }
    });

    test('withAlpha() puts an alpha channel on a token colour', () => {
        const { ChartTheme } = page('light');
        expect(ChartTheme.withAlpha('#177A4C', 0.5)).toBe('rgba(23, 122, 76, 0.5)');
        expect(ChartTheme.withAlpha('#abc', 1)).toBe('rgba(170, 187, 204, 1)');
        expect(ChartTheme.withAlpha('rgba(243,239,230,.16)', 0.3)).toBe('rgba(243, 239, 230, 0.3)');
        expect(ChartTheme.withAlpha('rgb(1 2 3)', 0.25)).toBe('rgba(1, 2, 3, 0.25)');
        expect(ChartTheme.withAlpha('white', 0.5)).toBe('white');
    });

    test('a theme toggle repaints the defaults and tells every listener, even after one fails', () => {
        const { context, ChartTheme, setTheme } = page('light');
        expect(context.Chart.defaults.plugins.legend.labels.color).toBe(TOKENS.light['--text-2']);
        const heard = [];
        ChartTheme.onThemeChange(() => { throw new Error('boom'); });
        ChartTheme.onThemeChange(theme => heard.push(theme));
        setTheme('dark');
        expect(heard).toEqual(['dark']);
        expect(context.Chart.defaults.plugins.legend.labels.color).toBe(TOKENS.dark['--text-2']);
        expect(context.Chart.defaults.scale.grid.color).toBe(TOKENS.dark['--line']);
        expect(context.Chart.defaults.plugins.tooltip.backgroundColor).toBe(TOKENS.dark['--text']);
        setTheme('light');
        expect(heard).toEqual(['dark', 'light']);
    });
});

describe('the Simulator charts (portfolio-charts.js)', () => {
    const portfolio = {
        dailyValues: [{ date: '2026-01-02', value: 10000 }, { date: '2026-01-05', value: 10120 }],
        closedTrades: [{ plPercent: 8 }, { plPercent: 2.5 }, { plPercent: 1 }]
    };
    const analytics = {
        monthlyReturns: [{ month: '2026-01', return: 1.2 }],
        tradesByMarket: { UK: 3 }, plByMarket: { UK: 120 },
        exitReasonBreakdown: { 'Take Profit': 1, 'Stop Loss': 0, 'Max Days': 1, 'Other': 1 }
    };
    function simulator(theme) {
        const p = page(theme);
        p.context.PortfolioSimulator = { getCurrencySymbol: () => '£' };
        p.run('js/portfolio-charts.js');
        p.context.PortfolioCharts.initializeCharts(portfolio, analytics, 'GBP');
        const doughnut = () => p.created.filter(c => c.config.type === 'doughnut').pop();
        return { ...p, doughnut };
    }

    test('each exit-reason slice takes its reason\'s colour', () => {
        const { doughnut } = simulator('light');
        expect(doughnut().data.labels).toEqual(['Take Profit', 'Max Days', 'Other']);
        expect(doughnut().data.datasets[0].backgroundColor)
            .toEqual([TOKENS.light['--gain'], TOKENS.light['--warn'], TOKENS.light['--text-3']]);
    });

    test('a theme toggle builds the charts again in the new theme\'s colours', () => {
        const { created, doughnut, setTheme } = simulator('light');
        const before = created.slice();
        setTheme('dark');
        expect(before.every(c => c.destroyed)).toBe(true);
        expect(doughnut().data.datasets[0].backgroundColor)
            .toEqual([TOKENS.dark['--gain'], TOKENS.dark['--warn'], TOKENS.dark['--text-3']]);
        const value = created.filter(c => c.canvas.id === 'portfolio-value-chart').pop();
        expect(value.data.datasets[0].borderColor).toBe(TOKENS.dark['--accent']);
    });
});

describe('the Positions chart dialog (dti-ui-charts.js)', () => {
    const dates = ['2026-01-05', '2026-01-06', '2026-01-07'];
    const prices = [100, 99, 101];
    function dialog(theme) {
        const p = page(theme);
        Object.assign(p.context, {
            DTIUI: {},
            DTIBacktester: { chartType: 'candlestick', utils: { showNotification() {}, formatDate: d => d } },
            DTIBacktest: {
                warmupInfo: { enabled: false },
                backtest: () => [],
                generateTradeMarkers: () => ({
                    entryMarkers: [], exitMarkers: [], activeEntryMarkers: [],
                    tradeConnections: [], tradeProfitLoss: [], tradeMetadata: {}
                })
            }
        });
        p.run('js/dti-ui-charts.js');
        const build = type => {
            p.context.DTIBacktester.chartType = type;
            p.context.DTIUI.createCharts(dates, prices, [1, 2, 3], { daily7DayDTI: [1, 2, 3] },
                { open: [99, 100, 100], high: [101, 101, 102], low: [98, 98, 99] });
            return {
                price: p.created.filter(c => c.canvas.id === 'price-chart').pop(),
                dti: p.created.filter(c => c.canvas.id === 'dti-chart').pop(),
                weekly: p.created.filter(c => c.canvas.id === 'weekly-dti-chart').pop()
            };
        };
        return { ...p, build };
    }
    const colourKeys = obj => JSON.stringify(obj, (key, value) => (typeof value === 'function' ? undefined : value))
        .match(/"(color|backgroundColor|titleColor|bodyColor|borderColor)":/g) || [];

    test.each(['candlestick', 'line'])('%s mode: the legend, axes, grid and tooltips take the theme\'s defaults', type => {
        const { build } = dialog('dark');
        const charts = build(type);
        for (const chart of Object.values(charts)) {
            const { legend, tooltip } = chart.options.plugins;
            expect(colourKeys(legend)).toEqual([]);
            expect(colourKeys(tooltip)).toEqual([]);
            for (const scale of Object.values(chart.options.scales)) {
                expect(colourKeys({ grid: scale.grid, ticks: scale.ticks })).toEqual([]);
            }
        }
    });

    test.each(['light', 'dark'])('the series take the %s theme\'s tokens', theme => {
        const t = TOKENS[theme];
        const { build } = dialog(theme);
        const { price, dti, weekly } = build('candlestick');
        const [candles, entry, exit, active] = price.data.datasets;
        expect(candles.borderColor).toEqual([t['--gain'], t['--loss'], t['--gain']]);
        expect(candles._themeColors.textColor).toBe(t['--text-2']); // the wicks
        expect([entry.backgroundColor, exit.backgroundColor, active.backgroundColor]).toEqual([t['--gain'], t['--loss'], t['--warn']]);
        expect(dti.data.datasets[0].borderColor).toBe(t['--info']);
        expect(weekly.data.datasets[0].borderColor).toBe(t['--accent']);
        const line = build('line').price.data.datasets[0];
        expect(line.borderColor).toBe(t['--accent']);
    });

    test('the dead parameter path is gone', () => {
        const { context } = dialog('light');
        expect(context.DTIUI.Charts.updateChartsAfterParameterChange).toBeUndefined();
        expect(context.DTIUI.Charts.initParameterChangeListeners).toBeUndefined();
        expect(context.DTIChartHelpers).toBeUndefined();
    });

    test('a note added with Annotate shows its text, in the theme\'s colours', () => {
        const { context, setTheme } = dialog('light');
        setTheme('dark');
        const note = context.DTIUI.Charts.noteAnnotation('2026-01-06', 99, 'Earnings');
        // a 'label' annotation draws its text; the old 'point' one drew only a dot
        expect(note).toMatchObject({
            type: 'label', xValue: '2026-01-06', yValue: 99, content: 'Earnings',
            backgroundColor: TOKENS.dark['--text'], color: TOKENS.dark['--bg'],
            callout: { display: true, borderColor: TOKENS.dark['--accent'] }
        });
    });

    test('a note comes back on its own stock\'s chart only', () => {
        const { context, build } = dialog('light');
        const { price, dti, weekly } = build('candlestick');
        context.DTIBacktester.currentStockIndex = 'HARNESS.L';
        context.DTIBacktester.annotations = {
            mine: { chartId: 'price-chart', symbol: 'HARNESS.L', xValue: '2026-01-06', yValue: 99, text: 'Mine' },
            other: { chartId: 'price-chart', symbol: 'VOD.L', xValue: '2026-01-06', yValue: 7, text: 'Another stock' }
        };
        context.DTIUI.Charts.restoreAnnotations();
        const notes = price.options.plugins.annotation.annotations;
        expect(Object.keys(notes)).toEqual(['mine']);
        expect(notes.mine).toMatchObject({ type: 'label', yValue: 99, content: 'Mine' });
        // each chart has its own list: one shared list put a price note on the DTI charts too
        expect(Object.keys(dti.options.plugins.annotation.annotations)).toEqual([]);
        expect(Object.keys(weekly.options.plugins.annotation.annotations)).toEqual([]);
    });

    test('the dialog\'s scripts carry no colour of their own', () => {
        for (const rel of ['js/dti-ui-charts.js', 'js/dti-ui-controls.js']) {
            const literals = read(rel).match(/rgba?\(\s*\d|#[0-9a-fA-F]{3,8}\b|'(white|black)'/g) || [];
            expect([rel, literals]).toEqual([rel, []]);
        }
    });
});

describe('DTIData (dti-data.js)', () => {
    test('exports only what the chart dialog calls', () => {
        const context = { window: {} };
        vm.createContext(context);
        vm.runInContext(read('js/dti-data.js'), context);
        expect(Object.keys(context.window.DTIData)).toEqual(['fetchStockData', 'processStockCSV']);
    });
});
