/**
 * Portfolio Export
 * Handles exporting portfolio data to CSV format
 */

const PortfolioExport = (function() {
    'use strict';

    /**
     * Export trades to CSV
     */
    function exportToCSV(trades) {
        if (!trades || trades.length === 0) {
            alert('No trades to export');
            return;
        }

        // Create CSV content
        const csvContent = generateCSVContent(trades);

        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `portfolio-backtest-${getTimestamp()}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log('[Portfolio Export] Exported', trades.length, 'trades to CSV');
    }

    /**
     * Generate CSV content from trades
     */
    function generateCSVContent(trades) {
        const headers = [
            'Symbol',
            'Name',
            'Market',
            'Entry Date',
            'Entry Price',
            'Entry Currency',
            'Exit Date',
            'Exit Price',
            'Holding Days',
            'P/L %',
            'P/L (INR)',
            'P/L (GBP)',
            'P/L (USD)',
            'Exit Reason',
            'Win Rate',
            'Trade Size'
        ];

        const rows = [headers];

        for (const trade of trades) {
            // Calculate P/L in all currencies
            const plNative = (trade.tradeSize * trade.plPercent) / 100;
            const plINR = convertToINR(plNative, trade.currency);
            const plGBP = convertToGBP(plNative, trade.currency);
            const plUSD = convertToUSD(plNative, trade.currency);

            const row = [
                trade.symbol,
                trade.symbol.split('.')[0], // Name (simplified)
                trade.market,
                trade.entryDate,
                trade.entryPrice.toFixed(2),
                trade.currency,
                trade.exitDate,
                trade.exitPrice.toFixed(2),
                trade.holdingDays,
                trade.plPercent.toFixed(2),
                plINR.toFixed(2),
                plGBP.toFixed(2),
                plUSD.toFixed(2),
                trade.exitReason,
                trade.winRate ? trade.winRate.toFixed(2) : 'N/A',
                trade.tradeSize.toFixed(2)
            ];

            rows.push(row);
        }

        // Convert to CSV string
        return rows.map(row =>
            row.map(cell => {
                // Escape quotes and wrap in quotes if contains comma
                const cellStr = String(cell);
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                    return '"' + cellStr.replace(/"/g, '""') + '"';
                }
                return cellStr;
            }).join(',')
        ).join('\n');
    }

    /**
     * Currency conversion helpers
     */
    function convertToINR(amount, fromCurrency) {
        const rates = window.PortfolioSimulator.CONFIG.EXCHANGE_RATES;
        if (fromCurrency === 'INR') return amount;
        if (fromCurrency === 'GBP') return amount * rates.GBP_TO_INR;
        if (fromCurrency === 'USD') return amount * rates.USD_TO_INR;
        return amount;
    }

    function convertToGBP(amount, fromCurrency) {
        const rates = window.PortfolioSimulator.CONFIG.EXCHANGE_RATES;
        if (fromCurrency === 'GBP') return amount;
        if (fromCurrency === 'USD') return amount * rates.USD_TO_GBP;
        if (fromCurrency === 'INR') return amount * rates.INR_TO_GBP;
        return amount;
    }

    function convertToUSD(amount, fromCurrency) {
        const rates = window.PortfolioSimulator.CONFIG.EXCHANGE_RATES;
        if (fromCurrency === 'USD') return amount;
        if (fromCurrency === 'GBP') return amount * rates.GBP_TO_USD;
        if (fromCurrency === 'INR') return amount * rates.INR_TO_USD;
        return amount;
    }

    /**
     * Get timestamp for filename
     */
    function getTimestamp() {
        const now = new Date();
        return now.toISOString().split('T')[0] + '_' +
               now.toTimeString().split(' ')[0].replace(/:/g, '-');
    }

    // Public API
    return {
        exportToCSV
    };
})();

// Make available globally
window.PortfolioExport = PortfolioExport;
