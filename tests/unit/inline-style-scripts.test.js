/**
 * README rule 21: no inline CSS in HTML or JS. A script under public/js (vendor/ aside) styles an element through
 * classes, the hidden attribute or an attribute a sheet selects on, never through its style.
 *
 * The one allowance is a value known only at run time, such as a bar's width worked out from a number: the script
 * hands it to the class that draws the bar as a CSS custom property (style.setProperty('--name', value)). Each such
 * property is listed in RUNTIME_PROPERTIES with the sheet whose rule reads it. The Positions page's ten scripts are
 * also held by tests/unit/positions-inline-style.test.js (with their export sheet and their state classes).
 */
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '../../public');

const RUNTIME_PROPERTIES = {
    'account.js': { '--ac-statbar': 'css/app.css' },       // the Account page's days-left bar
    'portfolio-ui.js': { '--sim-progress': 'css/app.css' }, // the Simulator's progress bar
    // the Positions page: a position's rail fill and 30-day bar, where the floating P&L change appears, a market's bar
    'TradeUI-Trades.js': { '--pos-fill': 'css/design-system/components.css', '--pos-days': 'css/app.css' },
    'TradeUI-Core.js': { '--pnl-left': 'css/app.css', '--pnl-top': 'css/app.css' },
    'capital-display.js': { '--capital-fill': 'css/app.css' }
};

const INLINE = [
    ['a style property assigned', /\.style\.(?!setProperty\b|getPropertyValue\b|cssText\b)[A-Za-z]+\s*=(?!=)/],
    ['style.cssText', /\.style\.cssText\b/],
    ['the style object replaced', /\.style\s*=(?!=)/],
    ['style[...]', /\.style\s*\[/],
    ['style.removeProperty', /\.style\.removeProperty\s*\(/],
    ['setAttribute style', /setAttribute\(\s*['"`]style['"`]/],
    ['a style attribute in markup', /\sstyle=\s*(\\?["'`]|\$\{)/],
    ['Object.assign onto a style', /Object\.assign\(\s*[^,)]*\.style\b/],
    ['a <style> element', /createElement\(\s*['"`]style['"`]\s*\)|<style[\s>]/],
    ['a sheet built in script', /\binsertRule\s*\(|adoptedStyleSheets|new\s+CSSStyleSheet\b/]
];
const SET_PROPERTY = /\.style\.setProperty\(\s*(?:(['"`])([^'"`]*)\1)?/g;

/** Every script under public/js except vendor/, as a path relative to public/js */
const scripts = (dir = '') => fs.readdirSync(path.join(PUBLIC, 'js', dir), { withFileTypes: true }).flatMap(entry => {
    const rel = dir ? dir + '/' + entry.name : entry.name;
    if (entry.isDirectory()) return rel === 'vendor' ? [] : scripts(rel);
    return rel.endsWith('.js') ? [rel] : [];
});

/** Block comments and whole-line // comments go first, so prose about styles is not read as code */
const code = source => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** What a script does to inline styles: every pattern it matches, and the custom properties it sets */
function inlineStyles(source) {
    const text = code(source);
    const found = INLINE.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
    const properties = [...text.matchAll(SET_PROPERTY)].map(m => m[2] === undefined ? '(not a literal name)' : m[2]);
    return { found, properties };
}

test('the detector sees every way of setting a style inline (control)', () => {
    const samples = [
        "el.style.width = '10%';", 'el.style.cssText = x;', "el.style = 'color:red';", "el.style['width'] = x;",
        "el.style.removeProperty('width');", "el.setAttribute('style', x);", '`<div class="a" style="padding: 2rem;">`',
        '`<i style=${x}>`', 'Object.assign(el.style, { width: 0 });', "document.createElement('style');",
        "'<style>.a{}</style>'", 'sheet.insertRule(r);', 'document.adoptedStyleSheets = [s];'
    ];
    for (const sample of samples) expect([sample, inlineStyles(sample).found.length]).toEqual([sample, 1]);
    expect(inlineStyles("el.style.setProperty('--w', x); el.style.setProperty(name, x);").properties).toEqual(['--w', '(not a literal name)']);
    // reads, and prose in comments, are not writes
    for (const sample of ["if (el.style.display !== 'none') go();", "// style='x'\n/* el.style.width = 1 */", 'getComputedStyle(el).getPropertyValue("--a");'])
        expect([sample, inlineStyles(sample)]).toEqual([sample, { found: [], properties: [] }]);
});

test('no script sets a style inline', () => {
    const all = scripts();
    expect(all.length).toBeGreaterThan(50); // control: the scan reads public/js
    const offenders = all
        .map(rel => ({ rel, ...inlineStyles(fs.readFileSync(path.join(PUBLIC, 'js', rel), 'utf8')) }))
        .filter(s => s.found.length > 0);
    expect(offenders).toEqual([]);
});

test('a run-time value reaches its class only as a listed custom property that the sheet reads', () => {
    for (const rel of scripts()) {
        const { properties } = inlineStyles(fs.readFileSync(path.join(PUBLIC, 'js', rel), 'utf8'));
        expect([rel, properties.sort()]).toEqual([rel, Object.keys(RUNTIME_PROPERTIES[rel] || {}).sort()]);
    }
    for (const [rel, props] of Object.entries(RUNTIME_PROPERTIES)) {
        for (const [name, sheet] of Object.entries(props)) {
            const css = fs.readFileSync(path.join(PUBLIC, sheet), 'utf8');
            expect([rel, name, css.includes('var(' + name + ')')]).toEqual([rel, name, true]);
        }
    }
});
