/**
 * Rule 21 (README 4.6): the scripts the Positions page loads set no inline style. A script shows or hides an element
 * with the hidden attribute and changes a state with a class; a number only the script knows (a bar's fill, a place
 * measured on screen) reaches the stylesheet as a CSS custom property, which a rule reads.
 *
 * Until 2026-09-25 these ten scripts wrote 113 inline styles (element.style.x = ..., style="..." in markup, and two
 * whole <style> sheets written into the chart export and report windows, now public/css/export.css).
 */
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '../../public');
const read = rel => fs.readFileSync(path.join(PUBLIC, rel), 'utf8');

const SCRIPTS = [
    'js/TradeUI-Trades.js', 'js/TradeUI-Core.js', 'js/TradeUI-Dialogs.js', 'js/TradeUI-Export-Metrics.js',
    'js/trade-filters.js', 'js/trade-modal.js', 'js/dti-core.js', 'js/market-status-manager.js',
    'js/capital-display.js', 'js/utils/notifications.js'
];

/** The custom properties a script may set, and the sheet whose rule reads each one */
const CUSTOM_PROPERTIES = {
    '--pos-fill': 'css/design-system/components.css', // a position card's stop-to-target rail (TradeUI-Trades.js)
    '--pos-days': 'css/app.css',                      // its 30-day bar (TradeUI-Trades.js)
    '--capital-fill': 'css/app.css',                  // a market's bar on the capital card (capital-display.js)
    '--pnl-left': 'css/app.css',                      // where the floating P&L change appears (TradeUI-Core.js)
    '--pnl-top': 'css/app.css'
};

/** Ways a script can set an inline style */
const INLINE = [
    ['element.style.x =', /\.style\.(?!setProperty\b)[A-Za-z]+\s*=(?!=)/],
    ['element.style[x]', /\.style\[/],
    ['cssText', /\bcssText\b/],
    ["setAttribute('style')", /setAttribute\(\s*['"]style['"]/],
    ['style="..." in markup', /\sstyle=\\?["']/],
    ['a <style> sheet', /<style[\s>]/i],
    ["createElement('style')", /createElement\(\s*['"]style['"]/],
    ['Object.assign(element.style)', /Object\.assign\(\s*[\w.$]+\.style\b/]
];

const lines = source => source.split('\n').map((line, i) => [i + 1, line]);

test('control: each pattern catches its kind of inline style, and the allowed forms pass', () => {
    const samples = {
        'element.style.x =': "el.style.width = '10px';",
        'element.style[x]': "el.style['width'] = '10px';",
        'cssText': "el.style.cssText = 'width:10px';",
        "setAttribute('style')": "el.setAttribute('style', 'width:10px');",
        'style="..." in markup': '`<div class="bar" style="width: ${w}%">`',
        'a <style> sheet': '`<style>body{margin:0}</style>`',
        "createElement('style')": "document.createElement('style');",
        'Object.assign(element.style)': 'Object.assign(el.style, { width: w });'
    };
    for (const [name, re] of INLINE) expect([name, re.test(samples[name])]).toEqual([name, true]);
    const allowed = "el.style.setProperty('--pos-fill', w + '%'); el.hidden = true; el.classList.add('is-entered'); if (el.style.width === '') {}";
    expect(INLINE.filter(([, re]) => re.test(allowed)).map(([name]) => name)).toEqual([]);
});

test.each(SCRIPTS)('%s sets no inline style', rel => {
    const found = INLINE.flatMap(([name, re]) => lines(read(rel))
        .filter(([, line]) => re.test(line))
        .map(([n, line]) => `${rel}:${n} ${name}: ${line.trim()}`));
    expect(found).toEqual([]);
});

test('a script sets only the custom properties named here, and a stylesheet reads each one', () => {
    const calls = SCRIPTS.flatMap(rel => read(rel).match(/\.style\.setProperty\(/g) || []);
    const named = SCRIPTS.flatMap(rel => [...read(rel).matchAll(/\.style\.setProperty\(\s*(['"`])([^'"`]*)\1/g)].map(m => m[2]));
    expect(named).toHaveLength(calls.length); // every call names its property as a literal
    expect(named.filter(name => !(name in CUSTOM_PROPERTIES))).toEqual([]);
    expect([...new Set(named)].sort()).toEqual(Object.keys(CUSTOM_PROPERTIES).sort());
    for (const [name, sheet] of Object.entries(CUSTOM_PROPERTIES)) expect([name, read(sheet).includes(`var(${name})`)]).toEqual([name, true]);
});

test('the export windows load their own sheet, whose every rule is scoped to one of the two documents', () => {
    const source = read('js/TradeUI-Export-Metrics.js');
    expect(source.match(/<link rel="stylesheet" href="\$\{window\.location\.origin\}\/css\/export\.css">/g)).toHaveLength(2);
    expect(source).toContain('<body class="export-charts">');
    expect(source).toContain('<body class="export-report">');
    const sheet = read('css/export.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const selectors = [...sheet.matchAll(/([^{}]+)\{[^{}]*\}/g)]
        .map(m => m[1].trim()).filter(head => !head.startsWith('@'))
        .flatMap(head => head.replace(/^@media[^{]*\{/, '').split(',').map(s => s.trim()));
    expect(selectors.length).toBeGreaterThan(60); // control: the scan sees the rules
    expect(selectors.filter(s => !/^\.export-(charts|report)\b/.test(s))).toEqual([]);
});

test('every state the scripts set has its rule in app.css', () => {
    const app = read('css/app.css');
    const rules = [
        '.card.is-entered', '.statistic-card.is-entered', '.chart-container.is-entered', '.trade-card.is-entered',
        '.trade-card.is-entering', '.market-status-badge.is-entered', '.market-status-badge.is-entering',
        '.market-status-badge.is-pressed', '.market-status-badge.is-dimmed', '.market-status-badge.is-leaving',
        '.notification.is-dismissed', '.pl-summary-container.is-shown', '#import-progress.is-error',
        '#import-status-message.is-error', '.detail-icon',
        ...['0', '10', '30', '60', '100'].map(step => `#import-progress[data-progress="${step}"]`)
    ];
    expect(rules.filter(rule => !app.includes(rule + '{') && !app.includes(rule + ','))).toEqual([]);
});
