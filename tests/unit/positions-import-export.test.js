/**
 * @jest-environment node
 *
 * The Positions page's Import trades and Export buttons, and the open-positions filter summary.
 *
 * Until 2026-09-25 "Import trades" threw (the dialogs module never exported openImportDialog, and the
 * TradeCore.importTradesFromJSON it called never existed); "Export sold trades" and "Export everything"
 * called TradeCore functions that never existed either; and the filter summary put the search text,
 * as typed, into innerHTML.
 *
 * The scripts run in jsdom on the page's own markup (public/trades.html), with TradeCore and TradeAPI
 * stubbed: TradeAPI.bulkImportTrades is POST /api/trades/bulk.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
// jsdom is jest-environment-jsdom's own dependency (the declared package): resolved from there
const { JSDOM } = require(require.resolve('jsdom', { paths: [path.dirname(require.resolve('jest-environment-jsdom/package.json'))] }));

const PUBLIC = path.join(__dirname, '../../public');
const read = rel => fs.readFileSync(path.join(PUBLIC, rel), 'utf8');
const PAGE = read('trades.html');
const BODY = PAGE.slice(PAGE.indexOf('<body'), PAGE.lastIndexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');

const doms = [];
afterEach(() => { while (doms.length) doms.pop().window.close(); });

function load(scripts, { trades = [], api = {} } = {}) {
    const dom = new JSDOM(`<!doctype html><html><head></head>${BODY}</body></html>`,
        { runScripts: 'outside-only', url: 'http://localhost/trades.html' });
    doms.push(dom);
    const { window } = dom;
    const notes = [];
    window.TradeCore = {
        getTrades: (type = 'all') => type === 'all' ? trades : trades.filter(t => (type === 'active') === (t.status === 'active')),
        showNotification: (message, type) => notes.push([type, message]),
        refreshData: jest.fn(async () => {}),
        refreshUI: jest.fn(),
        formatDate: d => String(d),
        formatDateForFilename: () => '2026-09-25',
        CURRENCY_SYMBOL: '$'
    };
    window.TradeAPI = { bulkImportTrades: jest.fn(async list => ({ success: true, count: list.length })), getAllTrades: jest.fn(async () => []), ...api };
    const context = dom.getInternalVMContext();
    // trades.html loads the strategy's parameters before these scripts
    for (const script of ['../lib/shared/strategy-params.js', ...scripts]) vm.runInContext(read(script), context, { filename: script });
    return { window, document: window.document, notes };
}

const until = async (check, what) => {
    for (let i = 0; i < 100; i++) {
        if (check()) return;
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('timed out waiting for ' + what);
};

async function chooseFile(window, content, name = 'trades.json') {
    const input = window.document.getElementById('import-file-input');
    Object.defineProperty(input, 'files', { value: [new window.File([content], name, { type: 'application/json' })], configurable: true });
    input.dispatchEvent(new window.Event('change'));
}

const readBlob = (window, blob) => new Promise(resolve => {
    const reader = new window.FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsText(blob);
});

const ON_PAGE = [{ symbol: 'HARNESS.L', status: 'active', entryDate: new Date('2026-09-20T08:00:00Z'), entryPrice: 100 }];
const FILE = {
    metadata: { exportDate: '2026-09-25T20:00:00.000Z', trades: 3 },
    trades: [
        { symbol: 'HARNESS.L', status: 'active', entryDate: '2026-09-20T08:00:00.000Z', entryPrice: 100, shares: 4 },
        { symbol: 'TCS.NS', stockName: 'Tata Consultancy', status: 'closed', entryDate: '2026-09-01T09:00:00.000Z', entryPrice: 3500,
          shares: 14, investmentAmount: 49000, exitDate: '2026-09-10T09:00:00.000Z', exitPrice: 3780, profitLoss: 3920,
          profitLossPercentage: 8, exitReason: 'Target hit: +8.00%', autoAdded: true },
        { symbol: 'NVDA', status: 'active', entryDate: '2026-09-22T14:00:00.000Z', entryPrice: 125, shares: 4, positionSize: 500,
          exitDate: '2026-10-22T14:00:00.000Z', exitPrice: 130, squareOffDate: '2026-10-22T14:00:00.000Z' }
    ]
};

describe('Import trades', () => {
    const DIALOGS = ['js/TradeUI-Dialogs.js'];

    test('the dialogs module exports the opener TradeUI.openImportDialog calls, and the page has every element it uses', () => {
        const { window, document } = load(DIALOGS);
        expect(typeof window.TradeUIModules.dialogs.openImportDialog).toBe('function');
        expect(read('js/TradeUI-Core.js')).toMatch(/openImportDialog: function\(\) \{\s*if \(modules\.dialogs\) modules\.dialogs\.openImportDialog\(\);/);
        for (const id of ['import-trades-dialog', 'import-file-input', 'selected-filename', 'import-preview', 'preview-total', 'preview-active',
            'preview-closed', 'preview-skipped', 'preview-date', 'import-status', 'import-status-message', 'import-progress',
            'import-dialog-x', 'import-dialog-cancel', 'import-dialog-confirm']) {
            expect([id, Boolean(document.getElementById(id))]).toEqual([id, true]);
        }
        // shown and hidden by the hidden attribute
        expect(document.getElementById('import-preview').hidden).toBe(true);
        expect(document.getElementById('import-status').hidden).toBe(true);
    });

    test("the file's new trades go to POST /api/trades/bulk in one request; one already on the page is left out", async () => {
        const { window, document } = load(DIALOGS, { trades: ON_PAGE });
        window.TradeUIModules.dialogs.openImportDialog();
        expect(document.getElementById('import-trades-dialog').classList.contains('active')).toBe(true);
        await chooseFile(window, JSON.stringify(FILE));
        await until(() => !document.getElementById('import-preview').hidden, 'the preview');

        const text = id => document.getElementById(id).textContent;
        expect([text('preview-total'), text('preview-active'), text('preview-closed'), text('preview-skipped')]).toEqual(['3', '2', '1', '1']);
        expect(text('preview-date')).not.toBe('-');
        const confirm = document.getElementById('import-dialog-confirm');
        expect(confirm.disabled).toBe(false);

        confirm.click();
        await until(() => window.TradeCore.refreshUI.mock.calls.length === 1, 'the reload');
        expect(window.TradeAPI.bulkImportTrades).toHaveBeenCalledTimes(1);
        expect(window.TradeAPI.bulkImportTrades.mock.calls[0][0]).toEqual([
            { symbol: 'TCS.NS', stockName: 'Tata Consultancy', stockIndex: null, status: 'closed', entryDate: '2026-09-01T09:00:00.000Z',
              entryPrice: 3500, shares: 14, investmentAmount: 49000, targetPrice: null, stopLossPercent: null,
              exitDate: '2026-09-10T09:00:00.000Z', exitPrice: 3780, profitLoss: 3920, profitLossPercentage: 8, notes: null },
            // an open trade carries no exit fields (and never its squareOffDate, which bulkInsertTrades would store as exit_date)
            { symbol: 'NVDA', stockName: null, stockIndex: null, status: 'active', entryDate: '2026-09-22T14:00:00.000Z',
              entryPrice: 125, shares: 4, investmentAmount: 500, targetPrice: null, stopLossPercent: null,
              exitDate: null, exitPrice: null, profitLoss: null, profitLossPercentage: null, notes: null }
        ]);
        expect(window.TradeCore.refreshData).toHaveBeenCalledTimes(1);
        expect(text('import-status-message')).toBe('Imported 2 trades');
        expect(document.getElementById('import-status').hidden).toBe(false);
    });

    test('opening the dialog again adds no second set of listeners: one click is one request', async () => {
        const { window, document } = load(DIALOGS);
        for (let i = 0; i < 3; i++) {
            window.TradeUIModules.dialogs.openImportDialog();
            document.getElementById('import-dialog-cancel').click();
        }
        window.TradeUIModules.dialogs.openImportDialog();
        await chooseFile(window, JSON.stringify([FILE.trades[2]]));
        await until(() => !document.getElementById('import-dialog-confirm').disabled, 'the confirm button');
        document.getElementById('import-dialog-confirm').click();
        await until(() => window.TradeCore.refreshUI.mock.calls.length > 0, 'the reload');
        expect(window.TradeAPI.bulkImportTrades).toHaveBeenCalledTimes(1);
    });

    test('a refused import names the trade by its symbol, and the page is not reloaded', async () => {
        const bulkImportTrades = jest.fn(async () => { throw new Error('trades[1]: entryPrice must be a positive number'); });
        const { window, document } = load(DIALOGS, { api: { bulkImportTrades } });
        window.TradeUIModules.dialogs.openImportDialog();
        await chooseFile(window, JSON.stringify({ trades: [FILE.trades[2], { symbol: 'BAD.L', status: 'active', entryDate: '2026-09-23' }] }));
        await until(() => !document.getElementById('import-dialog-confirm').disabled, 'the confirm button');
        document.getElementById('import-dialog-confirm').click();
        await until(() => document.getElementById('import-status-message').classList.contains('is-error'), 'the error');
        expect(document.getElementById('import-status-message').textContent)
            .toBe('Nothing was imported. BAD.L: entryPrice must be a positive number');
        expect(document.getElementById('import-dialog-confirm').disabled).toBe(false);
        expect(window.TradeCore.refreshData).not.toHaveBeenCalled();
    });

    test.each([
        ['a file that is not JSON', 'not json at all', 'This file is not JSON'],
        ['a file with no trades', JSON.stringify({ metadata: {}, trades: [] }), 'There are no trades in this file']
    ])('%s cannot be imported', async (_, content, message) => {
        const { window, document } = load(DIALOGS);
        window.TradeUIModules.dialogs.openImportDialog();
        await chooseFile(window, content);
        await until(() => document.getElementById('selected-filename').textContent === message, message);
        expect(document.getElementById('import-preview').hidden).toBe(true);
        expect(document.getElementById('import-dialog-confirm').disabled).toBe(true);
    });

    test('a file whose trades are all on the page already has nothing to import', async () => {
        const { window, document } = load(DIALOGS, { trades: ON_PAGE });
        window.TradeUIModules.dialogs.openImportDialog();
        await chooseFile(window, JSON.stringify({ trades: [FILE.trades[0]] }));
        await until(() => !document.getElementById('import-preview').hidden, 'the preview');
        expect(document.getElementById('preview-skipped').textContent).toBe('1');
        expect(document.getElementById('import-dialog-confirm').disabled).toBe(true);
    });
});

describe("a trade's name in the dialogs", () => {
    test('the delete dialog names the trade as text, never as markup', () => {
        const { window, document } = load(['js/TradeUI-Dialogs.js']);
        const trade = { id: 5, symbol: 'X', stockName: '<img src=x onerror="window.hit=1">', entryDate: new Date('2026-09-21T14:00:00Z'),
            investmentAmount: 500, currencySymbol: '$' };
        window.TradeCore.getTradeById = id => (id === 5 ? trade : undefined);
        window.TradeCore.setSelectedTradeId = () => {};
        window.TradeUIModules.dialogs.openDeleteTradeDialog(5);
        const title = document.querySelector('#delete-trade-dialog .dialog-title');
        expect(title.textContent).toBe('Delete <img src=x onerror="window.hit=1">?');
        expect(title.querySelector('img')).toBeNull();
        expect(document.getElementById('delete-stock-name').textContent).toBe(trade.stockName);
    });
});

describe('Export sold trades and Export everything', () => {
    function exporting(options) {
        const loaded = load(['js/TradeUI-Export-Metrics.js'], options);
        const { window } = loaded;
        const files = [];
        window.URL.createObjectURL = blob => { files.push({ blob }); return 'blob:' + files.length; };
        window.URL.revokeObjectURL = () => {};
        window.HTMLAnchorElement.prototype.click = function () { files[files.length - 1].name = this.getAttribute('download'); };
        window.TradeUIModules.export.setupExportButtons();
        return { ...loaded, files };
    }

    test('Export sold trades: a CSV of the sold trades, one row each, each amount in its own currency', async () => {
        const sold = [
            { symbol: 'TCS.NS', stockName: 'Tata, "Consultancy"', status: 'closed', entryDate: new Date('2026-09-01T09:00:00Z'),
              entryPrice: 3500, exitDate: new Date('2026-09-10T09:00:00Z'), exitPrice: 3780, shares: 14, investmentAmount: 49000,
              currencySymbol: '₹', profitLoss: 3920, profitLossPercentage: 8, exitReason: 'Target hit: +8.00%' },
            { symbol: 'AAPL', stockName: '=HYPERLINK("x")', status: 'closed', entryDate: new Date('2026-09-02T14:00:00Z'),
              entryPrice: 200, exitDate: new Date('2026-09-12T14:00:00Z'), exitPrice: 190, shares: 2.5, investmentAmount: 500,
              currencySymbol: '$', profitLoss: -25, profitLossPercentage: -5, exitReason: 'Stop loss hit: -5.00%' }
        ];
        const { window, document, files } = exporting({ trades: [{ symbol: 'MSFT', status: 'active' }, ...sold] });
        document.getElementById('btn-export-history').click();
        await until(() => files.length === 1 && files[0].name, 'the download');
        expect(files[0].name).toBe('dti_trades_history_2026-09-25.csv');
        const csv = (await readBlob(window, files[0].blob)).replace(/^﻿/, '');
        expect(csv.split('\r\n')).toEqual([
            'Symbol,Name,Bought on,Price paid,Sold on,Sold at,Shares,Put in,Currency,Result,Result %,Why it sold',
            '"TCS.NS","Tata, ""Consultancy""",2026-09-01,3500,2026-09-10,3780,14,49000,"₹",3920,8,"Target hit: +8.00%"',
            // a leading = is kept as text, so a spreadsheet does not run it
            '"AAPL","\'=HYPERLINK(""x"")",2026-09-02,200,2026-09-12,190,2.5,500,"$",-25,-5,"Stop loss hit: -5.00%"',
            ''
        ]);
    });

    test('Export everything: JSON of every trade as GET /api/trades gives it, which the Import dialog reads back', async () => {
        const fromServer = [
            { id: 7, symbol: 'NVDA', stockName: null, name: 'NVIDIA', status: 'active', entryDate: '2026-09-22T14:00:00.000Z', entryPrice: 125,
              shares: 4, investmentAmount: null, positionSize: 500, market: null, currencySymbol: null, targetPrice: null,
              stopLossPercent: null, exitDate: null, exitPrice: null, profitLoss: null, profitLossPercentage: null, autoAdded: false }
        ];
        const { window, document, files } = exporting({ trades: fromServer, api: { getAllTrades: jest.fn(async () => fromServer) } });
        document.getElementById('btn-export-all-trades').click();
        await until(() => files.length === 1 && files[0].name, 'the download');
        expect(files[0].name).toBe('dti_all_trades_2026-09-25.json');
        const file = JSON.parse(await readBlob(window, files[0].blob));
        expect(file.metadata.trades).toBe(1);
        expect(file.trades).toEqual([{
            symbol: 'NVDA', stockName: 'NVIDIA', stockIndex: null, market: null, currencySymbol: null, status: 'active',
            entryDate: '2026-09-22T14:00:00.000Z', entryPrice: 125, shares: 4, investmentAmount: 500, targetPrice: null,
            stopLossPercent: null, exitDate: null, exitPrice: null, profitLoss: null, profitLossPercentage: null,
            entryReason: null, exitReason: null, notes: null
        }]);
    });
});

describe('the open-positions filter summary', () => {
    const TRADE = {
        id: 1, symbol: 'MSFT', stockName: '<b>Micro</b>soft', status: 'active', entryDate: new Date('2026-09-21T14:00:00Z'),
        squareOffDate: new Date('2026-10-21T14:00:00Z'), entryPrice: 400, currentPrice: 404, shares: 1.25, investmentAmount: 500,
        currentValue: 505, stopLossPrice: 380, targetPrice: 432, currencySymbol: '$', currentPLPercent: 1
    };

    test('shows the search text exactly as typed, never as markup, and its button clears the search', () => {
        const { window, document } = load(['js/trade-filters.js'], { trades: [TRADE] });
        window.TradeUIModules.filters.init();
        const search = document.getElementById('trade-search');
        search.value = '<img src=x onerror="window.hit=1">';
        search.dispatchEvent(new window.Event('input'));

        const summary = document.getElementById('filter-summary');
        expect(summary.textContent).toBe('Search: "<img src=x onerror="window.hit=1">" • Showing 0 of 1 open positions • Clear filters');
        expect(summary.querySelector('img')).toBeNull();
        document.getElementById('clear-all-filters').click();
        expect(search.value).toBe('');
        expect(summary.textContent).toBe('Showing 1 of 1 open positions');
    });

    test("a match is highlighted inside the trade's name, which stays text", () => {
        const { window, document, notes } = load(['js/trade-filters.js'], { trades: [TRADE] });
        window.TradeUIModules.filters.init();
        const search = document.getElementById('trade-search');
        search.value = 'micro';
        search.dispatchEvent(new window.Event('input'));
        expect(notes).toEqual([]);
        const name = document.querySelector('#active-trades-container .trade-card .stock-name');
        expect(name.textContent).toBe('<b>Micro</b>soft');
        expect(name.querySelector('b')).toBeNull();
        expect([...name.querySelectorAll('.search-highlight')].map(mark => mark.textContent)).toEqual(['Micro']);
    });
});
