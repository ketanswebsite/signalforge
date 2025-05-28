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

// Create DTIUI module
const DTIUI = (function() {
    // Add flag to track "View Details" clicks - FIX FOR OPPORTUNITY LIST DISAPPEARING
    let isViewingOpportunityDetails = false;
    
    /**
     * Helper to get index display name from stock symbol
     * @param {string} symbol - Stock symbol
     * @returns {string} - Index display name
     */
    function getIndexDisplayNameFromSymbol(symbol) {
        if (!symbol) return 'Unknown';
        
        if (symbol.endsWith('.NS')) {
            if (DTIData.getStockLists().nifty50.some(stock => stock.symbol === symbol)) {
                return 'Nifty 50';
            } else if (DTIData.getStockLists().niftyNext50.some(stock => stock.symbol === symbol)) {
                return 'Nifty Next 50';
            } else if (DTIData.getStockLists().niftyMidcap150.some(stock => stock.symbol === symbol)) {
                return 'Nifty Midcap 150';
            }
            return 'India';
        } else if (symbol.endsWith('.L')) {
            if (DTIData.getStockLists().ftse100.some(stock => stock.symbol === symbol)) {
                return 'FTSE 100';
            } else if (DTIData.getStockLists().ftse250.some(stock => stock.symbol === symbol)) {
                return 'FTSE 250';
            }
            return 'UK';
        } else if (!symbol.includes('.')) {
            return 'US Stocks';
        }
        
        return 'Unknown';
    }
    
    /**
     * Helper function to get index identifier from stock symbol
     * @param {string} symbol - Stock symbol
     * @returns {string} - Index identifier (e.g., 'nifty50', 'ftse100')
     */
    function getIndexIdentifierFromSymbol(symbol) {
        if (!symbol) return null;
        
        if (symbol.endsWith('.NS')) {
            if (DTIData.getStockLists().nifty50.some(stock => stock.symbol === symbol)) {
                return 'nifty50';
            } else if (DTIData.getStockLists().niftyNext50.some(stock => stock.symbol === symbol)) {
                return 'niftyNext50';
            } else if (DTIData.getStockLists().niftyMidcap150.some(stock => stock.symbol === symbol)) {
                return 'niftyMidcap150';
            }
            return 'nifty50'; // Default to nifty50 if not found in specific lists
        } else if (symbol.endsWith('.L')) {
            if (DTIData.getStockLists().ftse100.some(stock => stock.symbol === symbol)) {
                return 'ftse100';
            } else if (DTIData.getStockLists().ftse250.some(stock => stock.symbol === symbol)) {
                return 'ftse250';
            }
            return 'ftse100'; // Default to ftse100 if not found in specific lists
        } else if (!symbol.includes('.')) {
            return 'usStocks';
        } else if (symbol.startsWith('^')) {
            return 'indices';
        }
        
        return null;
    }
    
    /**
     * Calculate win rates for all stocks based on historical trades
     * @returns {Object} - Object mapping stock symbols to win rates
     */
    function calculateStockWinRates() {
        const winRates = {};
        
        // Go through allStocksData to calculate win rates
        if (DTIBacktester.allStocksData && DTIBacktester.allStocksData.length > 0) {
            DTIBacktester.allStocksData.forEach(data => {
                if (data && data.stock && data.trades && data.trades.length > 0) {
                    const symbol = data.stock.symbol;
                    const completedTrades = data.trades;
                    
                    // Calculate win rate
                    let winningTrades = 0;
                    let totalTrades = completedTrades.length;
                    
                    if (totalTrades > 0) {
                        completedTrades.forEach(trade => {
                            if (trade.plPercent > 0) {
                                winningTrades++;
                            }
                        });
                        
                        const winRate = (winningTrades / totalTrades) * 100;
                        winRates[symbol] = winRate;
                    } else {
                        winRates[symbol] = 0;
                    }
                }
            });
        }
        
        return winRates;
    }

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

        // Override the existing stubs with full implementations
        DTIBacktester.initStockSelector = function() {
            if (typeof DTIUI.StockSelector !== 'undefined') {
                DTIUI.StockSelector.initStockSelector();
            }
        };

        DTIBacktester.createBuyingOpportunitiesSection = function() {
            if (typeof DTIUI.TradeDisplay !== 'undefined') {
                DTIUI.TradeDisplay.createBuyingOpportunitiesSection();
            }
        };

        // Add properties for chart interactivity
        DTIBacktester.tradeData = []; // Stores trade data for interactions
        DTIBacktester.annotations = {}; // Stores chart annotations

        // Initialize parameter change listeners when DOM is loaded
        document.addEventListener('DOMContentLoaded', function() {
            if (typeof DTIUI.Charts !== 'undefined') {
                DTIUI.Charts.initParameterChangeListeners();
            }
        });
        
        // Connect data processing results to UI display
        if (typeof DTIData !== 'undefined') {
            // Store original processCSV function
            const originalProcessCSV = DTIData.processCSV;
            
            // Override processCSV to update UI after processing
            DTIData.processCSV = function(results) {
                // Call original processing function
                originalProcessCSV.apply(this, arguments);
                
                // After processing, update the buying opportunities
                if (DTIBacktester.activeTradeOpportunities && 
                    typeof DTIUI.TradeDisplay !== 'undefined' && 
                    typeof DTIUI.TradeDisplay.displayBuyingOpportunities === 'function') {
                    DTIUI.TradeDisplay.displayBuyingOpportunities();
                }
            };
        }
        
        // Also hook into fetchAllStocksData to update opportunities after batch processing
        if (typeof DTIData !== 'undefined' && DTIData.fetchAllStocksData) {
            const originalFetchAllStocks = DTIData.fetchAllStocksData;
            
            DTIData.fetchAllStocksData = async function() {
                // Call original function
                const result = await originalFetchAllStocks.apply(this, arguments);
                
                // After processing, update the buying opportunities
                if (DTIBacktester.activeTradeOpportunities && 
                    typeof DTIUI.TradeDisplay !== 'undefined' && 
                    typeof DTIUI.TradeDisplay.displayBuyingOpportunities === 'function') {
                    DTIUI.TradeDisplay.displayBuyingOpportunities();
                }
                
                return result;
            };
        }
    }

    // Export public API for core functions
    return {
        isViewingOpportunityDetails,
        getIndexDisplayNameFromSymbol,
        getIndexIdentifierFromSymbol,
        calculateStockWinRates,
        initializeModules
    };
})();

// Initialize the modules
DTIUI.initializeModules();

// Make DTIUI available globally
window.DTIUI = DTIUI;
window.getCurrencySymbolForDisplay = getCurrencySymbolForDisplay;