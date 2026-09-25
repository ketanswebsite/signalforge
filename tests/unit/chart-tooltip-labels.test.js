/**
 * The Positions page's charts word their own tooltips (public/js/TradeUI-Charts.js, README.md section 1).
 *
 * The month-by-month, market comparison and return-by-size charts pick a tooltip line by the dataset's name. The
 * 15 August 2026 copy pass renamed the datasets ('Monthly P&L (%)' became 'Monthly result (%)', 'Trade Count' became
 * 'Trades', 'Win Rate (%)' became 'Win rate (%)', 'Average Return (%)' became 'Average return (%)') but not the names
 * the tooltips looked for, so six of the seven checks never matched: Chart.js showed the raw series name and an
 * unrounded value instead of the chart's own line. Every name a tooltip looks for must be a name the file gives a
 * dataset.
 */
const fs = require('fs');
const path = require('path');

const SOURCE = fs.readFileSync(path.join(__dirname, '../../public/js/TradeUI-Charts.js'), 'utf8');

describe('Positions chart tooltips', () => {
    const datasetNames = new Set([...SOURCE.matchAll(/^\s*label: '([^']+)',?\r?$/gm)].map(m => m[1]));
    const checked = [...SOURCE.matchAll(/(?:dataset\.label|datasetLabel)\s*===\s*'([^']+)'/g)].map(m => m[1]);

    test('every name a tooltip looks for is the name of a dataset in the same file', () => {
        expect(checked).toHaveLength(7);
        expect(checked.filter(name => !datasetNames.has(name))).toEqual([]);
    });

    test('the month-by-month and holding-period lines say Result and Average result, like their series', () => {
        expect(SOURCE).toContain("context.dataset.label === 'Monthly result (%)'");
        expect(SOURCE).toContain('? `Result: ${value.toFixed(2)}%`');
        expect(SOURCE).toContain('return `Average result: ${value.toFixed(2)}%`;');
        expect(SOURCE).not.toMatch(/P&L: \$\{value/);
    });
});
