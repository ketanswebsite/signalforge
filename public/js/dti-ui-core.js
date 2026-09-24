/**
 * DTI Backtester - UI Core Module
 * Foundation for UI components with global initialization
 */

// Helper function to get currency symbol based on stock or market
function getCurrencySymbolForDisplay(symbolOrMarket) {
    if (typeof TradeCore !== 'undefined' && TradeCore.getCurrencySymbol) {
        return TradeCore.getCurrencySymbol(symbolOrMarket);
    }
    
    // Fallback logic if TradeCore is not available
    if (typeof symbolOrMarket === 'string') {
        if (symbolOrMarket === 'ftse100' || symbolOrMarket.endsWith('.L')) {
            return '£';
        } else if (symbolOrMarket === 'usStocks' || !symbolOrMarket.includes('.')) {
            return '$';
        }
    }
    
    // Default to Indian Rupee
    return '₹';
}

/**
 * Format a chart price with the right currency for the CURRENT chart's stock.
 * Prefix symbol for ₹/$ markets; pence SUFFIX for LSE symbols, because Yahoo
 * quotes .L prices in pence and a £ prefix would overstate them 100×.
 */
function formatChartPrice(value, symbolOrMarket) {
    const target = symbolOrMarket !== undefined
        ? symbolOrMarket
        : (typeof DTIBacktester !== 'undefined' ? DTIBacktester.currentStockIndex : undefined);
    const sym = getCurrencySymbolForDisplay(target);
    const n = Number(value);
    if (!isFinite(n)) return '—';
    return sym === '£' ? n.toFixed(2) + 'p' : sym + n.toFixed(2);
}

// Create DTIUI module
const DTIUI = (function() {
    // Initialize module references for delayed loading
    function initializeModules() {
        // Hook into DTIBacktester initialization
        const originalInit = DTIBacktester.init || function() {};
        DTIBacktester.init = function() {
            // Call original init function
            originalInit.apply(this, arguments);
            
            // Add chart controls
            if (typeof DTIChartControls !== 'undefined') {
                DTIChartControls.addChartControls();
            }
        };

        // Add properties for chart interactivity
        DTIBacktester.tradeData = []; // Stores trade data for interactions
        DTIBacktester.annotations = {}; // Stores chart annotations
    }

    // Export public API for core functions
    return {
        initializeModules
    };
})();

// Initialize the modules
DTIUI.initializeModules();

// Make DTIUI available globally
window.DTIUI = DTIUI;
window.getCurrencySymbolForDisplay = getCurrencySymbolForDisplay;