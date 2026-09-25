/**
 * The Positions page's capital card (public/js/capital-display.js). Until 2026-09-24 it threw on an account
 * without a paper ledger - every account not on its own trading signals, for which GET /api/portfolio/capital
 * answers capital {} - so the page said "Failed to refresh capital data" every 30 seconds.
 *
 * The script runs in a vm context with the few DOM calls it makes. A top-level const is not a property of the
 * context, so the test exports it by hand.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '../../public/js/capital-display.js'), 'utf8');

function fakeElement(tag) {
    return {
        tagName: tag.toUpperCase(), className: '', textContent: '', attributes: {}, children: [], markup: '',
        appendChild(child) { this.children.push(child); return child; },
        setAttribute(name, value) { this.attributes[name] = String(value); },
        replaceChildren(...nodes) { this.children = nodes; this.markup = ''; },
        querySelectorAll() { return []; },
        set innerHTML(html) { this.markup = html; this.children = []; },
        get innerHTML() { return this.markup; }
    };
}
const words = el => [el.textContent, ...el.children.map(words)].filter(Boolean).join(' ');

function load(answer) {
    const elements = { 'capital-grid': fakeElement('div'), 'capital-totals': fakeElement('div') };
    elements['capital-totals'].appendChild(fakeElement('span'));
    const notifications = [];
    const context = {
        console: { log() {}, error() {} },
        document: { getElementById: id => elements[id] || null, querySelector: () => null, createElement: fakeElement, addEventListener() {} },
        window: { addEventListener() {} },
        fetch: async () => answer,
        showNotification: (message, type) => notifications.push([message, type]),
        setInterval() {},
        clearInterval() {}
    };
    vm.createContext(context);
    vm.runInContext(SOURCE + '\n;globalThis.CapitalDisplay = CapitalDisplay;', context);
    return { CapitalDisplay: context.CapitalDisplay, elements, notifications };
}
const answer = body => ({ ok: true, json: async () => body });
const market = (overrides = {}) => ({ currency: 'GBP', initial: 10000, realized: 40, allocated: 1000, available: 9040, positions: 2, maxPositions: 10, ...overrides });
const cardTitles = html => [...html.matchAll(/<h4>(\w+)<\/h4>/g)].map(m => m[1]);

test('an account without a paper ledger is told why, with no error', async () => {
    const { CapitalDisplay, elements, notifications } = load(answer({ success: true, capital: {}, totals: { totalPositions: 0, maxTotalPositions: 30, utilizationPercent: '0.0' } }));
    await CapitalDisplay.refreshCapitalData();
    expect(notifications).toEqual([]);
    const [empty] = elements['capital-grid'].children;
    expect(empty.className).toBe('sa-empty');
    expect(words(empty)).toMatch(/No paper capital yet/);
    const link = empty.children.find(c => c.tagName === 'A');
    expect(link).toMatchObject({ href: '/index.html', textContent: 'Open the Scanner' });
    expect(elements['capital-totals'].children).toEqual([]);
});

test('a ledger with some markets shows those markets only', async () => {
    const { CapitalDisplay, elements, notifications } = load(answer({ success: true, capital: { UK: market() }, totals: { totalPositions: 2, maxTotalPositions: 30, utilizationPercent: '6.7' } }));
    await CapitalDisplay.refreshCapitalData();
    expect(notifications).toEqual([]);
    expect(cardTitles(elements['capital-grid'].innerHTML)).toEqual(['UK']);
    expect(elements['capital-grid'].innerHTML).toMatch(/£9,040/);
    // the bar's width is data for the stylesheet (--capital-fill), never an inline style (rule 21)
    expect(elements['capital-grid'].innerHTML).toMatch(/class="progress-fill success" data-fill="20"/);
    expect(elements['capital-grid'].innerHTML).not.toMatch(/style=/);
    expect(elements['capital-totals'].innerHTML).toMatch(/2\/30/);
});

test('all three markets render in the page\'s order', async () => {
    const { CapitalDisplay, elements } = load(answer({ success: true, capital: { US: market({ currency: 'USD' }), India: market({ currency: 'INR' }), UK: market() }, totals: { totalPositions: 6, maxTotalPositions: 30, utilizationPercent: '20.0' } }));
    await CapitalDisplay.refreshCapitalData();
    expect(cardTitles(elements['capital-grid'].innerHTML)).toEqual(['India', 'UK', 'US']);
});

test('a failed request still says so', async () => {
    const { CapitalDisplay, notifications } = load({ ok: false, json: async () => ({}) });
    await CapitalDisplay.refreshCapitalData();
    expect(notifications).toEqual([['Failed to refresh capital data', 'error']]);
});
