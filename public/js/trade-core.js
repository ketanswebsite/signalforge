/**
 * DTI Backtester - Enhanced Trade Core Module (API Version)
 * Updated to use SQLite backend instead of localStorage
 */

// Create TradeCore module
const TradeCore = (function() {
    // Private variables
    let allTrades = [];
    let activeTrades = [];
    let closedTrades = [];
    let selectedTradeId = null;
    let equityCurveData = null; // Cached equity curve data
    let drawdownData = null; // Cached drawdown data
    
    /**
     * Show notification helper
     */
    function showNotification(message, type = 'info') {
        // Check if DTIBacktester is available
        if (typeof DTIBacktester !== 'undefined' && DTIBacktester.utils && DTIBacktester.utils.showNotification) {
            DTIBacktester.utils.showNotification(message, type);
        } else {
            // Fallback to console
            console[type === 'error' ? 'error' : 'log'](`[${type.toUpperCase()}] ${message}`);
        }
    }

    // Constants
    const DATA_VERSION = '1.0.0'; // For versioning the exported data format
    const PRICE_UPDATE_INTERVAL = 1000; // Update prices every 1 second
    const MAX_RETRIES = 3; // Maximum retries for fetching data
    
    /**
     * Get currency symbol based on market index or stock symbol
     * @param {string} market - Market index name or stock symbol
     * @returns {string} - Currency symbol
     */
    function getCurrencySymbol(market) {
        // If a specific market index is provided
        if (market === 'usStocks') return '$';
        if (market === 'ftse100') return '£';
        if (market === 'nifty50' || market === 'niftyNext50' || market === 'indices') return '₹';
        
        // If a stock symbol is provided
        if (typeof market === 'string' && market.includes('.')) {
            if (market.endsWith('.L')) return '£';  // London Stock Exchange
            if (market.includes('.NS')) return '₹'; // National Stock Exchange (India)
            return '₹'; // Default for other exchanges with dots
        }
        
        // If no dot in symbol, assume US market
        if (typeof market === 'string' && !market.includes('.')) return '$';
        
        // If nothing specified, check the global setting
        if (typeof DTIBacktester !== 'undefined' && DTIBacktester.currentStockIndex) {
            return getCurrencySymbol(DTIBacktester.currentStockIndex);
        }
        
        // Fallback default
        return '₹';
    }
    
    // For backward compatibility, we keep CURRENCY_SYMBOL as a property but make it use the function
    const CURRENCY_SYMBOL = getCurrencySymbol();
    
    /**
     * Format price based on market (convert pence to pounds for UK stocks)
     * @param {number} price - The price value
     * @param {string} symbol - The stock symbol
     * @returns {number} - Formatted price
     */
    function formatPrice(price, symbol) {
        if (typeof symbol === 'string' && symbol.endsWith('.L')) {
            // UK stocks: convert pence to pounds
            return price / 100;
        }
        return price;
    }
    
    /**
     * Parse price for storage (convert pounds to pence for UK stocks)
     * @param {number} price - The price value in display format
     * @param {string} symbol - The stock symbol
     * @returns {number} - Price for storage
     */
    function parsePrice(price, symbol) {
        if (typeof symbol === 'string' && symbol.endsWith('.L')) {
            // UK stocks: convert pounds to pence for storage
            return price * 100;
        }
        return price;
    }
    
    /**
     * Show notification helper
     * @param {string} message - The message to display
     * @param {string} type - The type of notification (success, error, warning, info)
     */
    function showNotification(message, type = 'info') {
        // Try to use DTIBacktester's notification system if available
        if (typeof DTIBacktester !== 'undefined' && DTIBacktester.utils && DTIBacktester.utils.showNotification) {
            DTIBacktester.utils.showNotification(message, type);
        } else if (typeof window.showNotification === 'function') {
            // Use global showNotification if available
            window.showNotification(message, type);
        } else {
            // Fallback to console
            const prefix = type.toUpperCase();
            console[type === 'error' ? 'error' : 'log'](`[${prefix}] ${message}`);
        }
    }
    
    /**
     * Format date helper - compatible with DTIBacktester.utils.formatDate
     * @param {Date|string} dateInput - The date to format
     * @returns {string} - Formatted date string
     */
    function formatDate(dateInput) {
        // Use DTIBacktester's formatDate if available
        if (typeof DTIBacktester !== 'undefined' && DTIBacktester.utils && DTIBacktester.utils.formatDate) {
            return DTIBacktester.utils.formatDate(dateInput);
        }
        
        // Otherwise, implement our own
        if (!dateInput) return 'N/A';
        
        try {
            // Handle different input types
            let date;
            if (dateInput instanceof Date) {
                date = dateInput;
            } else if (typeof dateInput === 'string') {
                date = new Date(dateInput);
            } else {
                return String(dateInput); // Return as string if not a recognized format
            }
            
            // Verify it's a valid date
            if (isNaN(date.getTime())) {
                return String(dateInput); // Return original value as string if invalid date
            }
            
            return date.toLocaleDateString();
        } catch (error) {
            console.warn("Error formatting date:", error, dateInput);
            return String(dateInput); // Fallback to string representation
        }
    }
    
    /**
     * Format date for use in filenames (YYYY-MM-DD)
     * @param {Date|string} date - Date object or date string
     * @returns {string} Formatted date string safe for filenames
     */
    function formatDateForFilename(date) {
        if (!date) return '';
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return '';
        
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    }
    
    /**
     * Initialize the trade management system
     */
    async function init() {
        
        try {
            // First, attempt to migrate any existing localStorage data
            const migrationResult = await TradeAPI.migrateFromLocalStorage();
            if (migrationResult.migrated) {
                showNotification(`Migrated ${migrationResult.count} trades from local storage to database`, 'success');
            }
            
            // Load trades from API
            await loadTradesFromAPI();
            
            // Set up dynamic price updates if we're on the trades page
            if (isTradesPage()) {
                // Start market status monitoring
                startMarketMonitoring();
                
                // Clean up intervals when navigating away
                window.addEventListener('beforeunload', function() {
                    stopMarketMonitoring();
                });
            }
            
        } catch (error) {
            console.error('Error initializing TradeCore:', error);
            showNotification('Error initializing trade system: ' + error.message, 'error');
        }
    }
    
    /**
     * Check if current page is the trades page
     * @returns {boolean} - True if on trades page
     */
    function isTradesPage() {
        return document.getElementById('active-trades-container') !== null;
    }
    
    /**
     * Load trades from API with improved error handling
     */
    async function loadTradesFromAPI() {
        try {
            allTrades = await TradeAPI.getAllTrades();
            
            // Debug: Log sample trade from SQLite
            if (allTrades.length > 0) {
                
                // Check for UK trades specifically
                const ukTrades = allTrades.filter(t => t.symbol && t.symbol.endsWith('.L'));
                if (ukTrades.length > 0) {
                }
            }
            
            // Convert date strings back to Date objects and ensure all properties exist
            allTrades.forEach(trade => {
                try {
                    trade.entryDate = new Date(trade.entryDate);
                    
                    // Handle squareOffDate properly
                    if (trade.squareOffDate && trade.squareOffDate !== 'null' && trade.squareOffDate !== 'undefined') {
                        trade.squareOffDate = new Date(trade.squareOffDate);
                        // Validate the parsed date
                        if (isNaN(trade.squareOffDate.getTime())) {
                            console.warn(`Invalid squareOffDate for ${trade.symbol}, using default`);
                            trade.squareOffDate = new Date(trade.entryDate);
                            trade.squareOffDate.setDate(trade.squareOffDate.getDate() + 30);
                        }
                    } else {
                        // If no square off date, set it to 30 days from entry date
                        trade.squareOffDate = new Date(trade.entryDate);
                        trade.squareOffDate.setDate(trade.squareOffDate.getDate() + 30);
                        
                        if (trade.status === 'active') {
                        }
                    }
                    
                    if (trade.exitDate) {
                        trade.exitDate = new Date(trade.exitDate);
                    }
                } catch (dateError) {
                    console.warn("Error parsing date for trade:", dateError, trade);
                    // Use fallback values if date parsing fails
                    if (!(trade.entryDate instanceof Date)) trade.entryDate = new Date();
                    if (!(trade.squareOffDate instanceof Date)) {
                        trade.squareOffDate = new Date();
                        trade.squareOffDate.setDate(trade.squareOffDate.getDate() + 30); // Default to 30 days
                    }
                }
                
                // Ensure currency symbol is set
                if (!trade.currencySymbol) {
                    // Deduce market from symbol suffix
                    if (trade.symbol.endsWith('.L')) {
                        trade.currencySymbol = '£'; // FTSE
                    } else if (trade.symbol.includes('.NS')) {
                        trade.currencySymbol = '₹'; // NSE
                    } else if (!trade.symbol.includes('.')) {
                        trade.currencySymbol = '$'; // US market (no dot)
                    } else {
                        trade.currencySymbol = '₹'; // Default
                    }
                }
                
                // Ensure numeric values are numbers, not strings
                trade.entryPrice = parseFloat(trade.entryPrice) || 0;
                trade.exitPrice = parseFloat(trade.exitPrice) || 0;
                
                // Debug shares parsing for UK stocks
                if (trade.symbol && trade.symbol.endsWith('.L')) {
                }
                
                // API now always returns standardized 'shares' field
                trade.shares = parseFloat(trade.shares) || 0;
                
                // For UK stocks, check if shares need adjustment
                // If the calculated investment is 100x too small, adjust shares
                if (trade.symbol && trade.symbol.endsWith('.L') && trade.shares > 0 && trade.shares < 1) {
                    const testInvestment = trade.entryPrice * trade.shares;
                    if (testInvestment < 100) { // Likely in wrong units
                        trade.shares = trade.shares * 100;
                    }
                }
                
                // API now returns standardized profitLoss field
                trade.profitLoss = parseFloat(trade.profitLoss) || 0;
                trade.percentGain = parseFloat(trade.percentGain) || 0;
                
                // API now always provides investmentAmount field
                trade.investmentAmount = parseFloat(trade.investmentAmount) || 0;
                
                // Debug investment amount calculation for UK stocks
                if (trade.symbol && trade.symbol.endsWith('.L')) {
                }
                trade.currentPrice = trade.currentPrice || trade.entryPrice; // Default to entry price
                trade.currentValue = trade.currentValue || (trade.currentPrice * trade.shares);
                trade.stopLossPrice = trade.stopLossPrice || (trade.entryPrice * 0.95); // Default 5% stop loss
                trade.targetPrice = trade.targetPrice || (trade.entryPrice * 1.10); // Default 10% target
                
                // Map database fields to UI expected fields
                if (trade.status === 'closed') {
                    // For closed trades, use profit and percentGain from database
                    trade.plValue = trade.profit || 0;
                    trade.plPercent = trade.percentGain || 0;
                    
                    // Debug logging for closed UK trades
                    if (trade.symbol && trade.symbol.endsWith('.L')) {
                    }
                    
                    // If percentGain is missing but we have prices, calculate it
                    if (!trade.percentGain && trade.exitPrice && trade.entryPrice) {
                        trade.plPercent = ((trade.exitPrice - trade.entryPrice) / trade.entryPrice * 100);
                        trade.percentGain = trade.plPercent;
                    }
                    
                    // If profit is missing but we have prices, calculate it
                    if (!trade.profit && trade.exitPrice && trade.entryPrice && trade.shares) {
                        trade.plValue = (trade.exitPrice - trade.entryPrice) * trade.shares;
                        trade.profit = trade.plValue;
                    }
                } else {
                    // For active trades, ensure currentPrice is set
                    if (!trade.currentPrice || trade.currentPrice === 0) {
                        trade.currentPrice = trade.entryPrice; // Default to entry price if not set
                    }
                    
                    // Always calculate unrealized P&L based on current or last known price
                    trade.unrealizedPL = (trade.currentPrice - trade.entryPrice) * trade.shares;
                    trade.percentChange = ((trade.currentPrice - trade.entryPrice) / trade.entryPrice * 100);
                    trade.plValue = trade.unrealizedPL || 0;
                    trade.plPercent = trade.percentChange || 0;
                    trade.currentPLPercent = trade.percentChange; // For UI compatibility
                    trade.currentValue = trade.currentPrice * trade.shares;
                    
                    // Store last update time
                    if (!trade.lastPriceUpdate) {
                        trade.lastPriceUpdate = new Date();
                    }
                    
                    // Debug logging for UK stocks during load
                    if (trade.symbol && trade.symbol.endsWith('.L')) {
                    }
                }
                
                // Set stockName and companyName
                if (!trade.stockName) {
                    trade.stockName = trade.symbol || 'Unknown'; // Use symbol as default stock name
                }
                
                // Get proper company name from mapping
                if (window.CompanyNames) {
                    trade.companyName = window.CompanyNames.getCompanyName(trade.symbol);
                }
                
                // Set currency symbol based on market
                if (!trade.currencySymbol) {
                    trade.currencySymbol = getCurrencySymbol(trade.stockIndex || trade.symbol);
                }
                
                // Calculate missing fields (API now provides investmentAmount)
                
                if (!trade.currentPrice) {
                    trade.currentPrice = trade.entryPrice; // Default to entry price until updated
                }
                
                if (!trade.currentValue && trade.currentPrice && trade.shares) {
                    trade.currentValue = trade.currentPrice * trade.shares;
                }
                
                if (!trade.stopLossPrice) {
                    trade.stopLossPrice = trade.entryPrice * 0.95; // Default 5% stop loss
                }
                
                if (!trade.targetPrice) {
                    trade.targetPrice = trade.entryPrice * 1.08; // Default 8% target
                }
                
                if (!trade.squareOffDate && trade.entryDate) {
                    const entryDate = new Date(trade.entryDate);
                    const squareOffDate = new Date(entryDate);
                    squareOffDate.setMonth(squareOffDate.getMonth() + 1);
                    trade.squareOffDate = squareOffDate; // Default 1 month
                }
                
                if (!trade.currentPLPercent && trade.currentPrice && trade.entryPrice) {
                    trade.currentPLPercent = ((trade.currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
                }
            });
            
            // Sort trades with active ones first, then by date (newest first)
            allTrades.sort((a, b) => {
                if (a.status === 'active' && b.status !== 'active') return -1;
                if (a.status !== 'active' && b.status === 'active') return 1;
                return b.entryDate - a.entryDate;
            });
            
            // Separate active and closed trades
            activeTrades = allTrades.filter(trade => trade.status === 'active');
            closedTrades = allTrades.filter(trade => trade.status !== 'active');
            
            
            // Update prices for active trades immediately after loading
            if (activeTrades.length > 0 && typeof updatePrices === 'function') {
                try {
                    await updatePrices();
                } catch (error) {
                    console.warn('Initial price update failed:', error);
                }
            }
            
            // Notify UI to update after trades are loaded
            if (typeof window.TradeUI !== 'undefined') {
                if (window.TradeUI.renderTradeHistory) {
                    window.TradeUI.renderTradeHistory();
                }
                if (window.TradeUI.updateStatistics) {
                    window.TradeUI.updateStatistics();
                }
                // Also trigger chart rendering after trades are loaded
                if (window.TradeUIModules && window.TradeUIModules.charts && window.TradeUIModules.charts.renderAllCharts) {
                    window.TradeUIModules.charts.renderAllCharts();
                }
                if (window.TradeUIModules && window.TradeUIModules.metrics) {
                    if (window.TradeUIModules.metrics.renderAdvancedMetricsCards) {
                        window.TradeUIModules.metrics.renderAdvancedMetricsCards();
                    }
                    if (window.TradeUIModules.metrics.initializeCalendarHeatmap) {
                        window.TradeUIModules.metrics.initializeCalendarHeatmap();
                    }
                }
            }
        } catch (error) {
            console.error('Error loading trades from API:', error);
            showNotification('Error loading trades from database. ' + error.message, 'error');
            
            // Initialize empty arrays if there was an error
            allTrades = [];
            activeTrades = [];
            closedTrades = [];
        }
    }
    
    /**
     * Add a new trade to the system
     * @param {Object} trade - The trade object to add
     * @returns {Promise<boolean>} - True if successful
     */
    async function addTrade(trade) {
        try {
            // Set currency symbol based on market
            trade.currencySymbol = getCurrencySymbol(trade.stockIndex || trade.symbol);
            
            // Transform trade data to match database schema
            const dbTrade = {
                symbol: trade.symbol,
                entryDate: trade.entryDate,
                entryPrice: trade.entryPrice,
                exitDate: trade.exitDate || null,
                exitPrice: trade.exitPrice || null,
                shares: trade.shares,
                status: trade.status || 'active',
                profit: trade.profit || null,
                percentGain: trade.percentGain || null,
                entryReason: trade.entryReason || trade.notes || null,
                exitReason: trade.exitReason || null,
                stockIndex: trade.stockIndex || null,
                stopLossPrice: trade.stopLossPrice || null,
                targetPrice: trade.targetPrice || null,
                squareOffDate: trade.squareOffDate || null,
                notes: trade.notes || null,
                stockName: trade.stockName || null,
                investmentAmount: trade.investmentAmount || null,
                currencySymbol: trade.currencySymbol || null,
                stopLossPercent: trade.stopLossPercent || null,
                takeProfitPercent: trade.takeProfitPercent || null
            };
            
            // Add to database
            const newTrade = await TradeAPI.createTrade(dbTrade);
            
            // Add to local arrays with database-generated ID
            trade.id = newTrade.id;
            allTrades.unshift(trade);
            
            if (trade.status === 'active') {
                activeTrades.unshift(trade);
            } else {
                closedTrades.unshift(trade);
            }
            
            // Clear cached analytics data
            equityCurveData = null;
            drawdownData = null;
            
            // Trigger UI refresh
            refreshUI();
            
            return true;
        } catch (error) {
            console.error('Error adding trade:', error);
            showNotification('Error adding trade: ' + error.message, 'error');
            return false;
        }
    }
    
    /**
     * Update an existing trade
     * @param {number} tradeId - The ID of the trade to update
     * @param {Object} updates - The updates to apply
     * @returns {Promise<boolean>} - True if successful
     */
    async function updateTrade(tradeId, updates) {
        try {
            // Debug logging for UK stock updates
            const trade = allTrades.find(t => t.id === tradeId);
            if (trade && trade.symbol && trade.symbol.endsWith('.L') && updates.status === 'closed') {
            }
            
            await TradeAPI.updateTrade(tradeId, updates);
            
            // Update local copy
            if (trade) {
                Object.assign(trade, updates);
                
                // Re-categorize if status changed
                if (updates.status) {
                    activeTrades = allTrades.filter(t => t.status === 'active');
                    closedTrades = allTrades.filter(t => t.status !== 'active');
                }
            }
            
            // Clear cached analytics data
            equityCurveData = null;
            drawdownData = null;
            
            // Trigger UI refresh
            refreshUI();
            
            return true;
        } catch (error) {
            console.error('Error updating trade:', error);
            showNotification('Error updating trade: ' + error.message, 'error');
            return false;
        }
    }
    
    /**
     * Close a trade by setting exit details
     * @param {number} tradeId - The ID of the trade to close
     * @param {Object} closeData - The closing data (exitPrice, exitDate, exitReason, etc.)
     * @returns {Promise<boolean>} - True if successful
     */
    async function closeTrade(tradeId, closeData) {
        try {
            const trade = allTrades.find(t => t.id === tradeId);
            if (!trade) {
                throw new Error('Trade not found');
            }
            
            // Calculate profit and percentage gain
            const exitPrice = parseFloat(closeData.exitPrice);
            const entryPrice = parseFloat(trade.entryPrice);
            const shares = parseFloat(trade.shares);
            
            // Debug logging for UK stocks
            if (trade.symbol && trade.symbol.endsWith('.L')) {
            }
            
            const profit = (exitPrice - entryPrice) * shares;
            const percentGain = ((exitPrice - entryPrice) / entryPrice) * 100;
            
            // Debug logging for calculation results
            if (trade.symbol && trade.symbol.endsWith('.L')) {
            }
            
            // Prepare update data
            const updates = {
                exitDate: closeData.exitDate || new Date().toISOString(),
                exitPrice: exitPrice,
                status: 'closed',
                profit: profit,
                percentGain: percentGain,
                exitReason: closeData.exitReason || 'Manual Exit'
            };
            
            // Update in database
            const success = await updateTrade(tradeId, updates);
            
            if (success) {
                showNotification(`Trade closed successfully. ${profit >= 0 ? 'Profit' : 'Loss'}: ${trade.currencySymbol || '$'}${Math.abs(profit).toFixed(2)} (${percentGain.toFixed(2)}%)`, profit >= 0 ? 'success' : 'info');
            }
            
            return success;
        } catch (error) {
            console.error('Error closing trade:', error);
            showNotification('Error closing trade: ' + error.message, 'error');
            return false;
        }
    }
    
    /**
     * Delete a trade
     * @param {number} tradeId - The ID of the trade to delete
     * @returns {Promise<boolean>} - True if successful
     */
    async function deleteTrade(tradeId) {
        try {
            await TradeAPI.deleteTrade(tradeId);
            
            // Remove from local arrays
            allTrades = allTrades.filter(t => t.id !== tradeId);
            activeTrades = activeTrades.filter(t => t.id !== tradeId);
            closedTrades = closedTrades.filter(t => t.id !== tradeId);
            
            // Clear cached analytics data
            equityCurveData = null;
            drawdownData = null;
            
            // Clear selected trade if it was the deleted one
            if (selectedTradeId === tradeId) {
                selectedTradeId = null;
            }
            
            // Trigger UI refresh
            refreshUI();
            
            return true;
        } catch (error) {
            console.error('Error deleting trade:', error);
            showNotification('Error deleting trade: ' + error.message, 'error');
            return false;
        }
    }
    
    /**
     * Refresh UI components after data changes
     */
    function refreshUI() {
        try {
            // Trigger trades updated event
            const event = new CustomEvent('tradesUpdated', { 
                detail: { 
                    silent: false,
                    type: 'data-changed'
                } 
            });
            document.dispatchEvent(event);
            
            // Update UI modules if available
            if (typeof window.TradeUI !== 'undefined') {
                if (window.TradeUI.renderTradeHistory) {
                    window.TradeUI.renderTradeHistory();
                }
                if (window.TradeUI.updateStatistics) {
                    window.TradeUI.updateStatistics();
                }
                if (window.TradeUI.renderActiveTrades) {
                    window.TradeUI.renderActiveTrades();
                }
                // Also trigger chart rendering after trades are updated
                if (window.TradeUIModules && window.TradeUIModules.charts && window.TradeUIModules.charts.renderAllCharts) {
                    window.TradeUIModules.charts.renderAllCharts();
                }
                if (window.TradeUIModules && window.TradeUIModules.metrics) {
                    if (window.TradeUIModules.metrics.renderAdvancedMetricsCards) {
                        window.TradeUIModules.metrics.renderAdvancedMetricsCards();
                    }
                    if (window.TradeUIModules.metrics.initializeCalendarHeatmap) {
                        window.TradeUIModules.metrics.initializeCalendarHeatmap();
                    }
                }
            }
            
        } catch (error) {
            console.warn('Error refreshing UI:', error);
        }
    }
    
    /**
     * Delete all trades
     * @returns {Promise<boolean>} - True if successful
     */
    async function deleteAllTrades() {
        try {
            await TradeAPI.deleteAllTrades();
            
            // Clear local arrays
            allTrades = [];
            activeTrades = [];
            closedTrades = [];
            
            // Clear cached analytics data
            equityCurveData = null;
            drawdownData = null;
            
            // Clear selected trade
            selectedTradeId = null;
            
            // Trigger UI refresh
            refreshUI();
            
            return true;
        } catch (error) {
            console.error('Error deleting all trades:', error);
            showNotification('Error deleting all trades: ' + error.message, 'error');
            return false;
        }
    }
    
    // Track update state to prevent animation conflicts
    let isUpdating = false;
    let lastUpdateTime = 0;
    let updateTimeouts = new Set();
    
    // Track price update interval
    let priceUpdateInterval = null;
    let marketCheckInterval = null;
    
    /**
     * Start market monitoring
     */
    function startMarketMonitoring() {
        // Clear any existing intervals
        stopMarketMonitoring();
        
        // Always fetch prices once on startup to get current values
        if (activeTrades && activeTrades.length > 0) {
            updatePricesOnce().then(() => {
                // After initial fetch, check if we should continue monitoring
                const hasOpenMarkets = activeTrades.some(trade => {
                    const status = getMarketStatus(trade.symbol);
                    return status.isOpen || (status.isExtendedHours && status.status === 'pre-market');
                });
                
                if (hasOpenMarkets) {
                    // Set up regular price updates every second for open markets
                    priceUpdateInterval = setInterval(updatePrices, PRICE_UPDATE_INTERVAL);
                } else {
                }
            });
        }
        
        // Set up market status checks every minute
        marketCheckInterval = setInterval(() => {
            checkMarketStatusAndAdjustUpdates();
        }, 60 * 1000); // Check every minute
        
    }
    
    /**
     * Check if any markets are open and update prices if needed
     * @returns {boolean} - True if any markets are open
     */
    function checkAndUpdatePrices() {
        if (!activeTrades || activeTrades.length === 0) return false;
        
        const hasOpenMarkets = activeTrades.some(trade => {
            const status = getMarketStatus(trade.symbol);
            return status.isOpen || (status.isExtendedHours && status.status === 'pre-market');
        });
        
        if (hasOpenMarkets) {
            updatePrices();
        }
        
        return hasOpenMarkets;
    }
    
    /**
     * Stop market monitoring
     */
    function stopMarketMonitoring() {
        if (priceUpdateInterval) {
            clearInterval(priceUpdateInterval);
            priceUpdateInterval = null;
        }
        
        if (marketCheckInterval) {
            clearInterval(marketCheckInterval);
            marketCheckInterval = null;
        }
        
        // Clear all pending timeouts
        updateTimeouts.forEach(timeout => clearTimeout(timeout));
        updateTimeouts.clear();
        
    }
    
    /**
     * Check market status and adjust update frequency
     */
    function checkMarketStatusAndAdjustUpdates() {
        
        if (!activeTrades || activeTrades.length === 0) {
            // No trades to monitor, stop price updates
            if (priceUpdateInterval) {
                clearInterval(priceUpdateInterval);
                priceUpdateInterval = null;
            }
            return;
        }
        
        const hasOpenMarkets = activeTrades.some(trade => {
            const status = getMarketStatus(trade.symbol);
            return status.isOpen || (status.isExtendedHours && status.status === 'pre-market');
        });
        
        if (hasOpenMarkets && !priceUpdateInterval) {
            // Markets just opened - fetch latest prices and start regular updates
            updatePricesOnce().then(() => {
                priceUpdateInterval = setInterval(updatePrices, PRICE_UPDATE_INTERVAL);
            });
        } else if (!hasOpenMarkets && priceUpdateInterval) {
            // Markets just closed - stop price updates
            clearInterval(priceUpdateInterval);
            priceUpdateInterval = null;
        }
        
        // Also trigger UI update for market status badges
        if (typeof document !== 'undefined') {
            const event = new CustomEvent('marketStatusChanged');
            document.dispatchEvent(event);
        }
    }
    
    /**
     * Get market status for a specific market
     * @param {string} market - Market identifier (e.g., 'NYSE', 'NASDAQ', 'NSE', 'LSE')
     * @returns {Object} Market status object
     */
    function getMarketStatus(symbol) {
        // Determine market from symbol
        let marketKey = 'US';
        let marketName = 'US Market';
        let timezone = 'America/New_York';
        let marketCode = 'NYSE';
        
        if (symbol.endsWith('.NS')) {
            marketKey = 'IN';
            marketName = 'India (NSE)';
            timezone = 'Asia/Kolkata';
            marketCode = 'NSE';
        } else if (symbol.endsWith('.L')) {
            marketKey = 'UK';
            marketName = 'UK (LSE)';
            timezone = 'Europe/London';
            marketCode = 'LSE';
        }
        
        // Get current time in market timezone
        const now = new Date();
        let marketTime;
        let hours, minutes, day;
        
        try {
            // This method might not work in all browsers
            const marketTimeStr = now.toLocaleString("en-US", {timeZone: timezone});
            marketTime = new Date(marketTimeStr);
            hours = marketTime.getHours();
            minutes = marketTime.getMinutes();
            day = marketTime.getDay(); // 0 = Sunday, 6 = Saturday
        } catch (e) {
            console.warn(`Timezone conversion failed for ${timezone}, using local time`, e);
            // Fallback to local time
            marketTime = now;
            hours = now.getHours();
            minutes = now.getMinutes();
            day = now.getDay();
        }
        
        // Market hours in local market time
        const marketHours = {
            'NYSE': { open: 9.5, close: 16, preOpen: 4, postClose: 20, days: [1,2,3,4,5] }, // 9:30 AM - 4:00 PM EST
            'NASDAQ': { open: 9.5, close: 16, preOpen: 4, postClose: 20, days: [1,2,3,4,5] },
            'NSE': { open: 9.25, close: 15.5, preOpen: 9, postClose: 16, days: [1,2,3,4,5] }, // 9:15 AM - 3:30 PM IST
            'BSE': { open: 9.25, close: 15.5, preOpen: 9, postClose: 16, days: [1,2,3,4,5] },
            'LSE': { open: 8, close: 16.5, preOpen: 5.5, postClose: 17.5, days: [1,2,3,4,5] }, // 8:00 AM - 4:30 PM GMT
            'FTSE': { open: 8, close: 16.5, preOpen: 5.5, postClose: 17.5, days: [1,2,3,4,5] }
        };
        
        const schedule = marketHours[marketCode] || { open: 9, close: 17, preOpen: 8, postClose: 18, days: [1,2,3,4,5] };
        
        // Check for early close days
        let earlyCloseInfo = null;
        if (window.MarketHolidays && window.MarketHolidays.getEarlyCloseInfo) {
            earlyCloseInfo = window.MarketHolidays.getEarlyCloseInfo(marketTime, marketKey);
            if (earlyCloseInfo) {
                schedule.close = earlyCloseInfo.closeTime;
            }
        }
        
        const currentTime = hours + (minutes / 60);
        
        let status = 'closed';
        let statusText = 'Closed';
        let isOpen = false;
        let isExtendedHours = false;
        let nextOpen = null;
        let nextClose = null;
        let holidayInfo = null;
        
        // Check if today is a holiday
        const isHoliday = window.MarketHolidays && window.MarketHolidays.isMarketHoliday 
            ? window.MarketHolidays.isMarketHoliday(marketTime, marketKey) 
            : false;
        
        if (isHoliday) {
            statusText = 'Holiday - Closed';
            // Get next holiday info if available
            if (window.MarketHolidays && window.MarketHolidays.getNextHoliday) {
                const nextHoliday = window.MarketHolidays.getNextHoliday(marketTime, marketKey);
                if (nextHoliday) {
                    holidayInfo = nextHoliday;
                }
            }
            
            // Calculate next trading day
            if (window.MarketHolidays && window.MarketHolidays.getNextTradingDay) {
                const nextTradingDay = window.MarketHolidays.getNextTradingDay(marketTime, marketKey);
                nextOpen = new Date(nextTradingDay);
                nextOpen.setHours(Math.floor(schedule.open), (schedule.open % 1) * 60, 0, 0);
            } else {
                // Fallback to simple next day calculation
                nextOpen = new Date(marketTime);
                nextOpen.setDate(nextOpen.getDate() + 1);
                nextOpen.setHours(Math.floor(schedule.open), (schedule.open % 1) * 60, 0, 0);
            }
        } else if (!schedule.days.includes(day)) {
            // Weekend
            statusText = 'Weekend - Closed';
            
            // Calculate next trading day (considering holidays)
            if (window.MarketHolidays && window.MarketHolidays.getNextTradingDay) {
                const nextTradingDay = window.MarketHolidays.getNextTradingDay(marketTime, marketKey);
                nextOpen = new Date(nextTradingDay);
                nextOpen.setHours(Math.floor(schedule.open), (schedule.open % 1) * 60, 0, 0);
            } else {
                // Fallback to next Monday
                const daysUntilMonday = (8 - day) % 7 || 7;
                nextOpen = new Date(marketTime);
                nextOpen.setDate(nextOpen.getDate() + daysUntilMonday);
                nextOpen.setHours(Math.floor(schedule.open), (schedule.open % 1) * 60, 0, 0);
            }
        } else {
            // It's a weekday and not a holiday
            if (currentTime >= schedule.open && currentTime < schedule.close) {
                status = 'open';
                statusText = earlyCloseInfo ? 'Open (Early Close)' : 'Open';
                isOpen = true;
                // Calculate next close time
                nextClose = new Date(marketTime);
                nextClose.setHours(Math.floor(schedule.close), (schedule.close % 1) * 60, 0, 0);
            } else if (currentTime >= schedule.preOpen && currentTime < schedule.open) {
                status = 'pre-market';
                statusText = 'Pre-Market';
                isExtendedHours = true;
                // Calculate next open time
                nextOpen = new Date(marketTime);
                nextOpen.setHours(Math.floor(schedule.open), (schedule.open % 1) * 60, 0, 0);
            } else if (currentTime >= schedule.close && currentTime < schedule.postClose) {
                status = 'post-market';
                statusText = 'After Hours';
                isExtendedHours = true;
                
                // Calculate next open time (next trading day)
                if (window.MarketHolidays && window.MarketHolidays.getNextTradingDay) {
                    const nextTradingDay = window.MarketHolidays.getNextTradingDay(marketTime, marketKey);
                    nextOpen = new Date(nextTradingDay);
                    nextOpen.setHours(Math.floor(schedule.open), (schedule.open % 1) * 60, 0, 0);
                } else {
                    // Fallback to tomorrow
                    nextOpen = new Date(marketTime);
                    nextOpen.setDate(nextOpen.getDate() + 1);
                    nextOpen.setHours(Math.floor(schedule.open), (schedule.open % 1) * 60, 0, 0);
                }
            } else {
                // Outside all trading hours
                statusText = 'Closed';
                if (currentTime < schedule.preOpen) {
                    // Before pre-market today
                    nextOpen = new Date(marketTime);
                    nextOpen.setHours(Math.floor(schedule.preOpen), (schedule.preOpen % 1) * 60, 0, 0);
                } else {
                    // After post-market, next open is next trading day
                    if (window.MarketHolidays && window.MarketHolidays.getNextTradingDay) {
                        const nextTradingDay = window.MarketHolidays.getNextTradingDay(marketTime, marketKey);
                        nextOpen = new Date(nextTradingDay);
                        nextOpen.setHours(Math.floor(schedule.preOpen), (schedule.preOpen % 1) * 60, 0, 0);
                    } else {
                        // Fallback to tomorrow
                        nextOpen = new Date(marketTime);
                        nextOpen.setDate(nextOpen.getDate() + 1);
                        nextOpen.setHours(Math.floor(schedule.preOpen), (schedule.preOpen % 1) * 60, 0, 0);
                    }
                }
            }
        }
        
        // Get upcoming holiday info
        if (!holidayInfo && window.MarketHolidays && window.MarketHolidays.getNextHoliday) {
            const upcomingHoliday = window.MarketHolidays.getNextHoliday(marketTime, marketKey);
            if (upcomingHoliday) {
                // Only show if within next 7 days
                const daysUntil = Math.ceil((upcomingHoliday.date - marketTime) / (1000 * 60 * 60 * 24));
                if (daysUntil <= 7) {
                    holidayInfo = upcomingHoliday;
                }
            }
        }
        
        return {
            status: status,
            statusText: statusText,
            marketName: marketName,
            timezone: timezone,
            currentMarketTime: marketTime,
            isOpen: isOpen,
            isExtendedHours: isExtendedHours,
            nextOpen: nextOpen,
            nextClose: nextClose,
            isHoliday: isHoliday,
            holidayInfo: holidayInfo,
            earlyCloseInfo: earlyCloseInfo
        };
    }
    
    /**
     * Update prices once for all active trades (used on initial load)
     * Fetches prices regardless of market status
     */
    async function updatePricesOnce() {
        if (!activeTrades || activeTrades.length === 0) return;
        
        
        try {
            // Process all trades in batches
            const BATCH_SIZE = 5;
            const batches = [];
            
            for (let i = 0; i < activeTrades.length; i += BATCH_SIZE) {
                batches.push(activeTrades.slice(i, i + BATCH_SIZE));
            }
            
            // Process batches sequentially
            for (const batch of batches) {
                await Promise.all(batch.map(trade => updateSingleTradePrice(trade)));
                
                // Small delay between batches
                if (batches.indexOf(batch) < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            
            // Trigger UI update
            const event = new CustomEvent('tradesUpdated', { detail: { silent: true } });
            document.dispatchEvent(event);
            
        } catch (error) {
            console.error('Error fetching initial prices:', error);
        }
    }
    
    /**
     * Update current prices for active trades
     * Uses Yahoo Finance API via CORS proxy
     * Optimized for 1-second updates
     */
    async function updatePrices() {
        if (activeTrades.length === 0) return;
        
        // First, check if any markets are open or in pre-market
        const tradesToUpdate = activeTrades.filter(trade => {
            const status = getMarketStatus(trade.symbol);
            // Only update prices if market is open or in pre-market
            return status.isOpen || (status.isExtendedHours && status.status === 'pre-market');
        });
        
        if (tradesToUpdate.length === 0) {
            // Even though we're not updating prices, ensure P&L is calculated with last known prices
            activeTrades.forEach(trade => {
                if (trade.currentPrice && trade.currentPrice !== trade.entryPrice) {
                    // Recalculate P&L with existing prices
                    trade.unrealizedPL = (trade.currentPrice - trade.entryPrice) * trade.shares;
                    trade.percentChange = ((trade.currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
                    trade.currentPLPercent = trade.percentChange;
                    trade.currentValue = trade.currentPrice * trade.shares;
                }
            });
            return;
        }
        
        // Prevent overlapping updates
        const now = Date.now();
        if (now - lastUpdateTime < PRICE_UPDATE_INTERVAL / 2) {
            return;
        }
        
        if (isUpdating) {
            return;
        }
        
        isUpdating = true;
        lastUpdateTime = now;
        
        
        try {
            // Process trades in smaller batches to avoid overwhelming the API
            const BATCH_SIZE = 5;
            const batches = [];
            
            for (let i = 0; i < tradesToUpdate.length; i += BATCH_SIZE) {
                batches.push(tradesToUpdate.slice(i, i + BATCH_SIZE));
            }
            
            // Process batches sequentially with minimal delay
            for (const batch of batches) {
                await Promise.all(batch.map(trade => updateSingleTradePrice(trade)));
                
                // Minimal delay between batches (50ms)
                if (batches.indexOf(batch) < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
        } catch (error) {
            console.error('Error in batch price update:', error);
        } finally {
            isUpdating = false;
        }
    }
    
    /**
     * Update price for a single trade with optimized retry logic
     */
    async function updateSingleTradePrice(trade, retryCount = 0) {
        try {
            const response = await fetch(`/yahoo/quote?symbol=${trade.symbol}`, {
                signal: AbortSignal.timeout(2000) // 2 second timeout
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data && data.chart && data.chart.result && data.chart.result[0]) {
                const quote = data.chart.result[0];
                const meta = quote.meta;
                const currentPrice = meta.regularMarketPrice;
                
                if (currentPrice && !isNaN(currentPrice)) {
                    // Note: For UK stocks (.L), prices from API are already in pence
                    // and our stored prices are also in pence, so no conversion needed here
                    const profitLoss = (currentPrice - trade.entryPrice) * trade.shares;
                    const percentChange = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
                    
                    // Update trade object
                    trade.currentPrice = currentPrice;
                    trade.currentValue = currentPrice * trade.shares;
                    trade.unrealizedPL = profitLoss;
                    trade.percentChange = percentChange;
                    trade.currentPLPercent = percentChange; // Add this for UI compatibility
                    trade.lastUpdated = new Date();
                    trade.lastPriceUpdate = new Date(); // Track when price was last updated
                    
                    // Update UI without animations during rapid updates
                    updateTradePriceUI(trade, false);
                }
            }
        } catch (error) {
            if (retryCount < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, 500 * (retryCount + 1)));
                return updateSingleTradePrice(trade, retryCount + 1);
            } else {
                console.error(`Failed to update ${trade.symbol} after ${MAX_RETRIES} retries:`, error.message);
            }
        }
    }
    
    /**
     * Update trade price in UI with minimal DOM manipulation
     */
    function updateTradePriceUI(trade, animate = true) {
        const tradeCard = document.querySelector(`[data-trade-id="${trade.id}"]`);
        if (!tradeCard) return;
        
        // Use requestAnimationFrame for smooth updates
        requestAnimationFrame(() => {
            // Update current price
            const priceElement = tradeCard.querySelector('.current-price');
            if (priceElement) {
                const oldPrice = parseFloat(priceElement.textContent.replace(/[^0-9.-]/g, ''));
                priceElement.textContent = `${trade.currencySymbol}${trade.currentPrice.toFixed(2)}`;
                
                if (animate && oldPrice !== trade.currentPrice) {
                    // Flash effect for price changes
                    priceElement.style.transition = 'none';
                    priceElement.style.backgroundColor = trade.currentPrice > oldPrice ? '#10b98133' : '#ef444433';
                    
                    const timeout = setTimeout(() => {
                        priceElement.style.transition = 'background-color 0.5s ease';
                        priceElement.style.backgroundColor = 'transparent';
                        updateTimeouts.delete(timeout);
                    }, 100);
                    updateTimeouts.add(timeout);
                }
            }
            
            // Update profit/loss percentage
            const plElement = tradeCard.querySelector('.current-pl');
            if (plElement) {
                const plValue = trade.currentPLPercent || 0;
                plElement.textContent = `${plValue.toFixed(2)}%`;
                
                // Update color classes
                plElement.classList.remove('positive', 'negative');
                if (plValue > 0) {
                    plElement.classList.add('positive');
                } else if (plValue < 0) {
                    plElement.classList.add('negative');
                }
            }
            
            // Update current value
            const valueElement = tradeCard.querySelector('.current-value');
            if (valueElement) {
                valueElement.textContent = `${trade.currencySymbol}${trade.currentValue.toFixed(2)}`;
            }
            
            // Update last updated time
            const timeElement = tradeCard.querySelector('.last-updated');
            if (timeElement && trade.lastUpdated) {
                timeElement.textContent = `Updated: ${new Date(trade.lastUpdated).toLocaleTimeString()}`;
            }
        });
    }
    
    /**
     * Get trades by type - for backward compatibility
     * @param {string} type - 'all', 'active', or 'closed'
     * @returns {Array} - Array of trades
     */
    function getTrades(type = 'all') {
        switch(type) {
            case 'active':
                return activeTrades;
            case 'closed':
                return closedTrades;
            case 'all':
            default:
                return allTrades;
        }
    }
    
    /**
     * Get equity curve data for charting
     * @returns {Array} Array of equity curve data points
     */
    function getEquityCurveData() {
        // Safety check for initialization
        if (!allTrades || !Array.isArray(allTrades)) {
            return [];
        }
        
        if (allTrades.length === 0) return [];
        
        // Create events for both entry and exit points
        const events = [];
        
        allTrades.forEach(trade => {
            // Add entry event
            if (trade.entryDate) {
                events.push({
                    date: new Date(trade.entryDate),
                    type: 'entry',
                    trade: trade
                });
            }
            
            // Add exit event for closed trades
            if (trade.status === 'closed' && trade.exitDate) {
                events.push({
                    date: new Date(trade.exitDate),
                    type: 'exit',
                    trade: trade,
                    profit: trade.profit || 0
                });
            }
        });
        
        // Sort events chronologically
        events.sort((a, b) => a.date - b.date);
        
        const equityData = [];
        let runningCapital = 100000; // Starting capital (can be made configurable)
        let runningProfit = 0;
        let closedTradeCount = 0;
        
        // Add initial point
        if (events.length > 0) {
            const firstDate = new Date(events[0].date);
            firstDate.setDate(firstDate.getDate() - 1);
            equityData.push({
                date: firstDate,
                equity: runningCapital,
                profit: 0,
                percentGain: 0,
                tradeCount: 0
            });
        }
        
        // Process each event
        events.forEach(event => {
            if (event.type === 'exit') {
                // Update capital and profit for exits
                runningProfit += event.profit;
                runningCapital += event.profit;
                closedTradeCount++;
            }
            
            // Add data point
            equityData.push({
                date: event.date,
                equity: runningCapital,
                profit: runningProfit,
                percentGain: ((runningCapital - 100000) / 100000) * 100,
                tradeCount: closedTradeCount,
                trade: {
                    symbol: event.trade.symbol,
                    action: event.type,
                    status: event.trade.status,
                    profit: event.type === 'exit' ? event.profit : undefined
                }
            });
        });
        
        // Add current point with unrealized P&L
        const currentDate = new Date();
        let unrealizedPL = 0;
        activeTrades.forEach(trade => {
            unrealizedPL += (trade.unrealizedPL || 0);
        });
        
        equityData.push({
            date: currentDate,
            equity: runningCapital + unrealizedPL,
            profit: runningProfit + unrealizedPL,
            percentGain: ((runningCapital + unrealizedPL - 100000) / 100000) * 100,
            tradeCount: closedTradeCount,
            isCurrentValue: true,
            unrealizedPL: unrealizedPL
        });
        
        return equityData;
    }
    
    /**
     * Get drawdown data for charting
     * @returns {Array} Array of drawdown data points
     */
    function getDrawdownData() {
        const equityData = getEquityCurveData();
        if (equityData.length === 0) return [];
        
        const drawdownData = [];
        let peak = equityData[0].equity;
        
        equityData.forEach(point => {
            if (point.equity > peak) {
                peak = point.equity;
            }
            
            const drawdown = ((peak - point.equity) / peak) * 100;
            drawdownData.push({
                date: point.date,
                drawdown: drawdown,
                drawdownAmount: peak - point.equity,
                equity: point.equity,
                peak: peak
            });
        });
        
        return drawdownData;
    }
    
    /**
     * Get P&L distribution data for histogram chart
     * @returns {Object} Object with bins and counts for histogram
     */
    function getPLDistributionData() {
        // Safety check for initialization
        if (!allTrades || !Array.isArray(allTrades)) {
            return { bins: [], counts: [] };
        }
        
        const closedTrades = allTrades.filter(trade => trade.status === 'closed' && trade.profit !== undefined);
        
        if (closedTrades.length === 0) {
            return { bins: [], counts: [] };
        }
        
        // Get all profit percentages
        const profitPercentages = closedTrades.map(trade => {
            // Use investmentAmount if available, otherwise calculate
            const investment = trade.investmentAmount || (trade.entryPrice * trade.shares);
            if (!investment || investment === 0) {
                console.warn('Invalid investment amount for trade:', trade);
                return 0;
            }
            const profitPercent = (trade.profit / investment) * 100;
            return isFinite(profitPercent) ? profitPercent : 0;
        }).filter(p => isFinite(p)); // Filter out any remaining invalid values
        
        // Check if we have valid profit percentages after filtering
        if (profitPercentages.length === 0) {
            return { bins: [], counts: [] };
        }
        
        // Calculate min and max
        const minProfit = Math.min(...profitPercentages);
        const maxProfit = Math.max(...profitPercentages);
        
        // Create bins
        const binCount = Math.min(10, closedTrades.length); // Max 10 bins or fewer if less trades
        const binSize = (maxProfit - minProfit) / binCount || 1;
        
        const bins = [];
        const counts = new Array(binCount).fill(0);
        
        // Create bin ranges
        for (let i = 0; i < binCount; i++) {
            const binStart = minProfit + (i * binSize);
            const binEnd = minProfit + ((i + 1) * binSize);
            bins.push({
                range: `${binStart.toFixed(1)}% to ${binEnd.toFixed(1)}%`,
                min: binStart,
                max: binEnd,
                count: 0
            });
        }
        
        // Count trades in each bin
        profitPercentages.forEach(profitPercent => {
            // Skip invalid profit percentages
            if (!isFinite(profitPercent)) {
                console.warn('Invalid profit percentage:', profitPercent);
                return;
            }
            
            const binIndex = Math.min(
                Math.max(0, Math.floor((profitPercent - minProfit) / binSize)),
                binCount - 1
            );
            
            // Safety check for bin index
            if (binIndex >= 0 && binIndex < binCount && bins[binIndex]) {
                counts[binIndex]++;
                bins[binIndex].count++;
            } else {
                console.warn('Invalid bin index:', binIndex, 'for profit:', profitPercent);
            }
        });
        
        return {
            bins: bins.map(b => b.range),
            counts: counts,
            binDetails: bins,
            totalTrades: closedTrades.length,
            minProfit: minProfit,
            maxProfit: maxProfit,
            avgProfit: profitPercentages.reduce((a, b) => a + b, 0) / profitPercentages.length
        };
    }
    
    /**
     * Get monthly performance data
     * @returns {Object} Monthly performance statistics
     */
    function getMonthlyPerformanceData() {
        // Safety check for initialization
        if (!closedTrades || !Array.isArray(closedTrades)) {
            return [];
        }
        
        const monthlyData = {};
        
        // Process all closed trades
        closedTrades.forEach(trade => {
            if (trade.exitDate) {
                const date = new Date(trade.exitDate);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                
                if (!monthlyData[monthKey]) {
                    monthlyData[monthKey] = {
                        month: monthKey,
                        trades: 0,
                        profit: 0,
                        investment: 0,
                        wins: 0,
                        losses: 0
                    };
                }
                
                monthlyData[monthKey].trades++;
                monthlyData[monthKey].profit += (trade.profit || 0);
                monthlyData[monthKey].investment += (trade.entryPrice * trade.shares);
                
                if (trade.profit > 0) {
                    monthlyData[monthKey].wins++;
                } else if (trade.profit < 0) {
                    monthlyData[monthKey].losses++;
                }
            }
        });
        
        // Convert to array and sort by month
        const months = Object.keys(monthlyData).sort();
        
        // Month names for display
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        const data = months.map(month => {
            const [year, monthNum] = month.split('-');
            const monthIndex = parseInt(monthNum) - 1;
            
            // Calculate total P&L percentage based on actual investment
            const totalPLPercent = monthlyData[month].investment > 0 
                ? (monthlyData[month].profit / monthlyData[month].investment * 100)
                : 0;
            
            return {
                ...monthlyData[month],
                monthName: monthNames[monthIndex],
                year: parseInt(year),
                totalPL: totalPLPercent,
                winRate: monthlyData[month].trades > 0 
                    ? (monthlyData[month].wins / monthlyData[month].trades * 100) 
                    : 0
            };
        });
        
        return data;
    }
    
    /**
     * Get win/loss data for pie chart
     * @returns {Object} Win/loss statistics for pie chart
     */
    function getWinLossPieChartData() {
        // Safety check for initialization
        if (!closedTrades || !Array.isArray(closedTrades)) {
            return {
                labels: [],
                data: [],
                stats: {
                    wins: 0,
                    losses: 0,
                    breakeven: 0,
                    totalTrades: 0,
                    winRate: 0,
                    lossRate: 0,
                    breakevenRate: 0
                }
            };
        }
        
        const stats = {
            wins: 0,
            losses: 0,
            breakeven: 0,
            totalTrades: closedTrades.length
        };
        
        closedTrades.forEach(trade => {
            if (trade.profit > 0) {
                stats.wins++;
            } else if (trade.profit < 0) {
                stats.losses++;
            } else {
                stats.breakeven++;
            }
        });
        
        // Return in the format expected by the UI
        const labels = [];
        const data = [];
        
        if (stats.wins > 0) {
            labels.push(`Winning Trades (${stats.wins})`);
            data.push(stats.wins);
        }
        
        if (stats.losses > 0) {
            labels.push(`Losing Trades (${stats.losses})`);
            data.push(stats.losses);
        }
        
        if (stats.breakeven > 0) {
            labels.push(`Breakeven Trades (${stats.breakeven})`);
            data.push(stats.breakeven);
        }
        
        return {
            labels: labels,
            data: data,
            stats: {
                wins: stats.wins,
                losses: stats.losses,
                breakeven: stats.breakeven,
                totalTrades: stats.totalTrades,
                winRate: stats.totalTrades > 0 ? (stats.wins / stats.totalTrades * 100) : 0,
                lossRate: stats.totalTrades > 0 ? (stats.losses / stats.totalTrades * 100) : 0,
                breakevenRate: stats.totalTrades > 0 ? (stats.breakeven / stats.totalTrades * 100) : 0
            }
        };
    }
    
    /**
     * Get trade size vs return data for scatter plot
     * @returns {Array} Array of data points for scatter plot
     */
    function getTradeSizeVsReturnData() {
        // Safety check for initialization
        if (!allTrades || !Array.isArray(allTrades)) {
            return [];
        }
        
        const data = [];
        
        allTrades.forEach(trade => {
            if (trade.status === 'closed' && trade.profit !== undefined) {
                // Calculate holding days
                let holdingDays = 0;
                if (trade.entryDate && trade.exitDate) {
                    const entryTime = new Date(trade.entryDate).getTime();
                    const exitTime = new Date(trade.exitDate).getTime();
                    holdingDays = Math.round((exitTime - entryTime) / (1000 * 60 * 60 * 24));
                }
                
                // Determine currency symbol
                let currencySymbol = '$'; // Default
                if (trade.symbol && typeof trade.symbol === 'string') {
                    if (trade.symbol.endsWith('.NS') || trade.symbol.endsWith('.BO')) {
                        currencySymbol = '₹';
                    } else if (trade.symbol.endsWith('.L')) {
                        currencySymbol = '£';
                    }
                }
                
                data.push({
                    size: trade.investmentAmount || (trade.entryPrice * trade.shares),
                    return: trade.percentGain || ((trade.profit / (trade.entryPrice * trade.shares)) * 100),
                    symbol: trade.symbol,
                    stockName: trade.symbol, // Could be enhanced with actual names
                    profit: trade.profit,
                    entryDate: trade.entryDate,
                    exitDate: trade.exitDate,
                    holdingDays: holdingDays,
                    currencySymbol: currencySymbol,
                    exitReason: trade.exitReason || 'Manual Exit'
                });
            }
        });
        
        return data;
    }
    
    /**
     * Get performance data by market/exchange for comparison chart
     * @returns {Array} Array of market performance data
     */
    function getPerformanceByMarket() {
        // Safety check for initialization
        if (!allTrades || !Array.isArray(allTrades)) {
            return [];
        }
        
        const closedTrades = allTrades.filter(trade => trade.status === 'closed' && trade.profit !== undefined);
        
        if (closedTrades.length === 0) {
            return [];
        }
        
        // Group trades by market/exchange (derived from symbol)
        const marketData = {};
        
        closedTrades.forEach(trade => {
            let market = 'Other';
            
            // Determine market based on symbol patterns
            if (trade.symbol && typeof trade.symbol === 'string') {
                const symbol = trade.symbol.toUpperCase();
                if (symbol.endsWith('.NS') || symbol.endsWith('.BO')) {
                    market = 'NSE/BSE';
                } else if (symbol.match(/^[A-Z]{1,4}$/)) {
                    market = 'NASDAQ/NYSE';
                } else if (symbol.endsWith('.L')) {
                    market = 'LSE';
                } else if (symbol.includes('.')) {
                    market = 'International';
                } else {
                    market = 'Domestic';
                }
            }
            
            if (!marketData[market]) {
                marketData[market] = {
                    name: market,
                    trades: 0,
                    totalPL: 0,
                    wins: 0,
                    losses: 0
                };
            }
            
            marketData[market].trades++;
            marketData[market].totalPL += trade.profit;
            
            if (trade.profit > 0) {
                marketData[market].wins++;
            } else if (trade.profit < 0) {
                marketData[market].losses++;
            }
        });
        
        // Convert to array and calculate derived metrics
        return Object.values(marketData).map(market => ({
            name: market.name,
            trades: market.trades,
            avgPL: market.totalPL / market.trades,
            winRate: (market.wins / market.trades) * 100,
            totalPL: market.totalPL
        })).sort((a, b) => b.totalPL - a.totalPL); // Sort by total P&L descending
    }
    
    /**
     * Get holding period statistics for analysis
     * @returns {Object} Holding period stats with shortTerm, mediumTerm, longTerm categories
     */
    function getHoldingPeriodStats() {
        // Safety check for initialization
        if (!allTrades || !Array.isArray(allTrades)) {
            return {
                shortTerm: { count: 0, avgPL: 0, winRate: 0, totalPL: 0, wins: 0 },
                mediumTerm: { count: 0, avgPL: 0, winRate: 0, totalPL: 0, wins: 0 },
                longTerm: { count: 0, avgPL: 0, winRate: 0, totalPL: 0, wins: 0 }
            };
        }
        
        const closedTrades = allTrades.filter(trade => 
            trade.status === 'closed' && 
            trade.profit !== undefined &&
            trade.entryDate && 
            trade.exitDate
        );
        
        const stats = {
            shortTerm: { count: 0, avgPL: 0, avgPLPercent: 0, winRate: 0, totalPL: 0, totalInvestment: 0, wins: 0 },
            mediumTerm: { count: 0, avgPL: 0, avgPLPercent: 0, winRate: 0, totalPL: 0, totalInvestment: 0, wins: 0 },
            longTerm: { count: 0, avgPL: 0, avgPLPercent: 0, winRate: 0, totalPL: 0, totalInvestment: 0, wins: 0 }
        };
        
        closedTrades.forEach(trade => {
            const entryDate = new Date(trade.entryDate);
            const exitDate = new Date(trade.exitDate);
            const holdingDays = Math.ceil((exitDate - entryDate) / (1000 * 60 * 60 * 24));
            
            let category;
            if (holdingDays <= 10) {
                category = 'shortTerm';  // 0-10 days
            } else if (holdingDays <= 20) {
                category = 'mediumTerm'; // 11-20 days
            } else {
                category = 'longTerm';   // 21+ days
            }
            
            const investment = trade.entryPrice * trade.shares;
            
            stats[category].count++;
            stats[category].totalPL += trade.profit;
            stats[category].totalInvestment += investment;
            
            if (trade.profit > 0) {
                stats[category].wins++;
            }
        });
        
        // Calculate derived metrics
        ['shortTerm', 'mediumTerm', 'longTerm'].forEach(category => {
            const categoryStats = stats[category];
            if (categoryStats.count > 0) {
                categoryStats.avgPL = categoryStats.totalPL / categoryStats.count;
                categoryStats.avgPLPercent = categoryStats.totalInvestment > 0 
                    ? (categoryStats.totalPL / categoryStats.totalInvestment) * 100 
                    : 0;
                categoryStats.winRate = (categoryStats.wins / categoryStats.count) * 100;
            }
        });
        
        return stats;
    }
    
    /**
     * Get advanced trading metrics for analysis
     * @returns {Object} Advanced metrics including Sharpe ratio, max drawdown, profit factor, etc.
     */
    function getAdvancedMetrics() {
        // Safety check for initialization
        if (!allTrades || !Array.isArray(allTrades)) {
            return {
                sharpeRatio: 0,
                maxDrawdown: 0,
                maxDrawdownDuration: 0,
                profitFactor: 0,
                expectancy: 0,
                avgTradeDuration: 0,
                annualizedReturn: 0,
                streakInfo: {
                    currentStreak: { type: 'none', count: 0 },
                    longestWinStreak: 0,
                    longestLossStreak: 0
                }
            };
        }
        
        const closedTrades = allTrades.filter(trade => 
            trade.status === 'closed' && 
            trade.profit !== undefined
        );
        
        if (closedTrades.length === 0) {
            return {
                sharpeRatio: 0,
                maxDrawdown: 0,
                maxDrawdownDuration: 0,
                profitFactor: 0,
                expectancy: 0,
                avgTradeDuration: 0,
                annualizedReturn: 0,
                streakInfo: {
                    currentStreak: { type: 'none', count: 0 },
                    longestWinStreak: 0,
                    longestLossStreak: 0
                }
            };
        }
        
        // Calculate basic metrics
        const totalProfit = closedTrades.reduce((sum, trade) => sum + trade.profit, 0);
        const profits = closedTrades.filter(trade => trade.profit > 0);
        const losses = closedTrades.filter(trade => trade.profit < 0);
        
        const grossProfit = profits.reduce((sum, trade) => sum + trade.profit, 0);
        const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.profit, 0));
        
        // Profit Factor
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? grossProfit : 0;
        
        // Expectancy in percentage terms
        const winRate = profits.length / closedTrades.length;
        
        // Calculate average win/loss percentages
        let avgWinPercent = 0;
        let avgLossPercent = 0;
        
        if (profits.length > 0) {
            const totalWinPercent = profits.reduce((sum, trade) => {
                const investment = trade.entryPrice * trade.shares;
                return sum + (trade.profit / investment * 100);
            }, 0);
            avgWinPercent = totalWinPercent / profits.length;
        }
        
        if (losses.length > 0) {
            const totalLossPercent = losses.reduce((sum, trade) => {
                const investment = trade.entryPrice * trade.shares;
                return sum + Math.abs(trade.profit / investment * 100);
            }, 0);
            avgLossPercent = totalLossPercent / losses.length;
        }
        
        // Expectancy as percentage per trade
        const expectancy = (winRate * avgWinPercent) - ((1 - winRate) * avgLossPercent);
        
        // Average trade duration
        let totalDuration = 0;
        let validDurationTrades = 0;
        
        closedTrades.forEach(trade => {
            if (trade.entryDate && trade.exitDate) {
                const duration = (new Date(trade.exitDate) - new Date(trade.entryDate)) / (1000 * 60 * 60 * 24);
                totalDuration += duration;
                validDurationTrades++;
            }
        });
        
        const avgTradeDuration = validDurationTrades > 0 ? totalDuration / validDurationTrades : 0;
        
        // Calculate drawdown using equity curve
        const equityData = getEquityCurveData();
        let maxDrawdown = 0;
        let maxDrawdownDuration = 0;
        
        if (equityData.length > 1) {
            let peak = equityData[0].equity;
            let peakDate = new Date(equityData[0].date);
            let drawdownStart = null;
            
            equityData.forEach(point => {
                if (point.equity > peak) {
                    peak = point.equity;
                    peakDate = new Date(point.date);
                    drawdownStart = null;
                } else {
                    if (drawdownStart === null) {
                        drawdownStart = peakDate;
                    }
                    
                    const drawdown = ((peak - point.equity) / peak) * 100;
                    if (drawdown > maxDrawdown) {
                        maxDrawdown = drawdown;
                        maxDrawdownDuration = Math.ceil((new Date(point.date) - drawdownStart) / (1000 * 60 * 60 * 24));
                    }
                }
            });
        }
        
        // Calculate Sharpe Ratio (simplified)
        const returns = [];
        for (let i = 1; i < equityData.length; i++) {
            const prevEquity = equityData[i-1].equity;
            const currentEquity = equityData[i].equity;
            const returnRate = (currentEquity - prevEquity) / prevEquity;
            returns.push(returnRate);
        }
        
        let sharpeRatio = 0;
        if (returns.length > 1) {
            const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
            const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
            const stdDev = Math.sqrt(variance);
            sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized
        }
        
        // Calculate streaks
        const streakInfo = calculateStreaks(closedTrades);
        
        // Annualized return (simplified)
        const totalInvested = closedTrades.reduce((sum, trade) => sum + (trade.entryPrice * trade.shares), 0);
        const totalReturn = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
        const yearsOfTrading = validDurationTrades > 0 ? (totalDuration / validDurationTrades / 365) : 1;
        const annualizedReturn = yearsOfTrading > 0 ? totalReturn / yearsOfTrading : totalReturn;
        
        return {
            sharpeRatio,
            maxDrawdown,
            maxDrawdownDuration,
            profitFactor,
            expectancy,
            avgTradeDuration,
            annualizedReturn,
            streakInfo
        };
    }
    
    /**
     * Get exit reason breakdown for closed trades
     * @returns {Array} Array of exit reason statistics
     */
    function getExitReasonBreakdown() {
        // Safety check for initialization
        if (!closedTrades || !Array.isArray(closedTrades)) {
            return [];
        }
        
        if (closedTrades.length === 0) {
            return [];
        }
        
        // Group trades by exit reason
        const reasonGroups = {};
        
        closedTrades.forEach(trade => {
            const reason = trade.exitReason || 'Manual Exit';
            
            if (!reasonGroups[reason]) {
                reasonGroups[reason] = {
                    reason: reason,
                    count: 0,
                    totalPL: 0,
                    totalPLPercent: 0,
                    wins: 0,
                    trades: []
                };
            }
            
            reasonGroups[reason].count++;
            reasonGroups[reason].trades.push(trade);
            
            // Calculate P&L percentage for this trade
            const investment = trade.entryPrice * trade.shares;
            const plPercent = (trade.profit / investment) * 100;
            reasonGroups[reason].totalPLPercent += plPercent;
            
            if (trade.profit > 0) {
                reasonGroups[reason].wins++;
            }
        });
        
        // Calculate statistics for each reason
        const results = [];
        const totalClosedTrades = closedTrades.length;
        
        Object.values(reasonGroups).forEach(group => {
            results.push({
                reason: group.reason,
                count: group.count,
                percentage: (group.count / totalClosedTrades) * 100,
                avgPL: group.totalPLPercent / group.count,
                winRate: (group.wins / group.count) * 100
            });
        });
        
        // Sort by count descending
        results.sort((a, b) => b.count - a.count);
        
        return results;
    }
    
    /**
     * Calculate win/loss streaks
     * @param {Array} trades - Array of closed trades
     * @returns {Object} Streak information
     */
    function calculateStreaks(trades) {
        if (trades.length === 0) {
            return {
                currentStreak: { type: 'none', count: 0 },
                longestWinStreak: 0,
                longestLossStreak: 0
            };
        }
        
        let currentStreak = { type: 'none', count: 0 };
        let longestWinStreak = 0;
        let longestLossStreak = 0;
        let currentWinStreak = 0;
        let currentLossStreak = 0;
        
        // Sort trades by exit date
        const sortedTrades = trades.filter(t => t.exitDate).sort((a, b) => new Date(a.exitDate) - new Date(b.exitDate));
        
        sortedTrades.forEach(trade => {
            if (trade.profit > 0) {
                currentWinStreak++;
                currentLossStreak = 0;
                longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
                currentStreak = { type: 'win', count: currentWinStreak };
            } else if (trade.profit < 0) {
                currentLossStreak++;
                currentWinStreak = 0;
                longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
                currentStreak = { type: 'loss', count: currentLossStreak };
            }
        });
        
        return {
            currentStreak,
            longestWinStreak,
            longestLossStreak
        };
    }
    
    /**
     * Get calendar heatmap data for a specific year
     * @param {number} year - Year to get data for
     * @returns {Array} Array of daily trading data for heatmap
     */
    function getCalendarHeatmapData(year = new Date().getFullYear()) {
        // Safety check for initialization
        if (!allTrades || !Array.isArray(allTrades)) {
            return [];
        }
        
        const yearTrades = allTrades.filter(trade => {
            if (!trade.exitDate) return false;
            const exitYear = new Date(trade.exitDate).getFullYear();
            return exitYear === year;
        });
        
        // Group trades by date
        const dailyData = {};
        
        yearTrades.forEach(trade => {
            if (trade.exitDate && trade.profit !== undefined) {
                const date = new Date(trade.exitDate).toISOString().split('T')[0];
                
                if (!dailyData[date]) {
                    dailyData[date] = {
                        date: date,
                        dateObj: date,
                        profit: 0,
                        trades: 0,
                        wins: 0,
                        losses: 0,
                        totalValue: 0,
                        totalInvestment: 0
                    };
                }
                
                dailyData[date].profit += trade.profit;
                dailyData[date].totalValue += trade.profit || 0;
                dailyData[date].totalInvestment += trade.investmentAmount || (trade.entryPrice * trade.shares);
                dailyData[date].trades++;
                
                if (trade.profit > 0) {
                    dailyData[date].wins++;
                } else if (trade.profit < 0) {
                    dailyData[date].losses++;
                }
            }
        });
        
        // Calculate percentage value for each day
        Object.values(dailyData).forEach(day => {
            if (day.totalInvestment > 0) {
                day.value = (day.profit / day.totalInvestment) * 100;
            } else {
                day.value = 0;
            }
        });
        
        // Convert to array and sort by date
        return Object.values(dailyData).sort((a, b) => new Date(a.date) - new Date(b.date));
    }
    
    /**
     * Get trade statistics grouped by currency
     * @returns {Object} Statistics object with currency-based breakdowns
     */
    function getTradeStatisticsByCurrency() {
        const currencies = {};
        const overall = {
            totalTrades: 0,
            activeTrades: 0,
            closedTrades: 0,
            totalProfit: 0,
            totalInvested: 0,
            winningTrades: 0,
            losingTrades: 0,
            unrealizedPL: 0,
            currentValue: 0
        };
        
        // Process all trades
        allTrades.forEach(trade => {
            const currency = trade.currencySymbol || getCurrencySymbol(trade.symbol);
            
            if (!currencies[currency]) {
                currencies[currency] = {
                    totalTrades: 0,
                    activeTrades: 0,
                    closedTrades: 0,
                    totalProfit: 0,
                    totalInvested: 0,
                    winningTrades: 0,
                    losingTrades: 0,
                    unrealizedPL: 0,
                    currentValue: 0
                };
            }
            
            // Update currency-specific stats
            currencies[currency].totalTrades++;
            overall.totalTrades++;
            
            if (trade.status === 'active') {
                currencies[currency].activeTrades++;
                overall.activeTrades++;
                const invested = trade.entryPrice * trade.shares;
                currencies[currency].totalInvested += invested;
                overall.totalInvested += invested;
                
                // Add unrealized P&L if available
                if (trade.unrealizedPL !== undefined) {
                    currencies[currency].unrealizedPL += trade.unrealizedPL;
                    overall.unrealizedPL = (overall.unrealizedPL || 0) + trade.unrealizedPL;
                }
                if (trade.currentValue !== undefined) {
                    currencies[currency].currentValue += trade.currentValue;
                    overall.currentValue = (overall.currentValue || 0) + trade.currentValue;
                }
                
                // For active trades, recalculate unrealized P&L if we have current price
                if (trade.currentPrice !== undefined && trade.currentPrice > 0) {
                    const calculatedUnrealizedPL = (trade.currentPrice - trade.entryPrice) * trade.shares;
                    const calculatedCurrentValue = trade.currentPrice * trade.shares;
                    
                    // Debug logging for UK stocks - commented out to reduce console noise
                    // if (trade.symbol && trade.symbol.endsWith('.L')) {
                    //     console.log(`UK Stock ${trade.symbol}:`, {
                    //         entryPrice: trade.entryPrice,
                    //         currentPrice: trade.currentPrice,
                    //         shares: trade.shares,
                    //         invested: invested,
                    //         currentValue: calculatedCurrentValue,
                    //         unrealizedPL: calculatedUnrealizedPL,
                    //         plPercent: ((trade.currentPrice - trade.entryPrice) / trade.entryPrice * 100).toFixed(2) + '%'
                    //     });
                    // }
                    
                    // Update the running totals with the calculated values
                    if (!trade.unrealizedPL || Math.abs(calculatedUnrealizedPL - trade.unrealizedPL) > 0.01) {
                        currencies[currency].unrealizedPL = (currencies[currency].unrealizedPL || 0) - (trade.unrealizedPL || 0) + calculatedUnrealizedPL;
                        overall.unrealizedPL = (overall.unrealizedPL || 0) - (trade.unrealizedPL || 0) + calculatedUnrealizedPL;
                        trade.unrealizedPL = calculatedUnrealizedPL;
                    }
                    
                    if (!trade.currentValue || Math.abs(calculatedCurrentValue - trade.currentValue) > 0.01) {
                        currencies[currency].currentValue = (currencies[currency].currentValue || 0) - (trade.currentValue || 0) + calculatedCurrentValue;
                        overall.currentValue = (overall.currentValue || 0) - (trade.currentValue || 0) + calculatedCurrentValue;
                        trade.currentValue = calculatedCurrentValue;
                    }
                }
            } else {
                currencies[currency].closedTrades++;
                overall.closedTrades++;
                const profit = trade.profit || 0;
                currencies[currency].totalProfit += profit;
                overall.totalProfit += profit;
                
                if (profit > 0) {
                    currencies[currency].winningTrades++;
                    overall.winningTrades++;
                } else if (profit < 0) {
                    currencies[currency].losingTrades++;
                    overall.losingTrades++;
                }
            }
        });
        
        // Calculate win rates
        Object.keys(currencies).forEach(currency => {
            const s = currencies[currency];
            s.winRate = s.closedTrades > 0 ? (s.winningTrades / s.closedTrades * 100) : 0;
            s.profitFactor = s.losingTrades > 0 ? Math.abs(s.winningTrades / s.losingTrades) : s.winningTrades;
        });
        
        overall.winRate = overall.closedTrades > 0 ? (overall.winningTrades / overall.closedTrades * 100) : 0;
        overall.profitFactor = overall.losingTrades > 0 ? Math.abs(overall.winningTrades / overall.losingTrades) : overall.winningTrades;
        
        // Calculate openPLPercent for overall stats
        overall.openPL = overall.unrealizedPL || 0;
        // Use current value vs invested for more accurate calculation
        if (overall.totalInvested > 0 && overall.currentValue !== undefined && overall.currentValue > 0) {
            overall.openPLPercent = ((overall.currentValue - overall.totalInvested) / overall.totalInvested) * 100;
        } else if (overall.totalInvested > 0 && overall.openPL !== 0) {
            overall.openPLPercent = (overall.openPL / overall.totalInvested) * 100;
        } else {
            overall.openPLPercent = 0;
        }
        overall.totalClosed = overall.closedTrades;
        overall.totalActive = overall.activeTrades; // Add totalActive for UI compatibility
        // Calculate average profit percentage
        let totalProfitPercent = 0;
        let closedTradesWithPercent = 0;
        closedTrades.forEach(trade => {
            if (trade.percentGain !== undefined && trade.percentGain !== null) {
                totalProfitPercent += trade.percentGain;
                closedTradesWithPercent++;
            }
        });
        overall.avgProfit = closedTradesWithPercent > 0 ? (totalProfitPercent / closedTradesWithPercent) : 0;
        
        // Add openPLPercent and avgProfit to each currency
        Object.keys(currencies).forEach(currency => {
            const s = currencies[currency];
            s.openPL = s.unrealizedPL || 0;
            // Ensure we have valid values for the calculation
            if (s.totalInvested > 0 && s.currentValue !== undefined && s.currentValue > 0) {
                // Calculate open PL percentage based on current value vs invested amount
                s.openPLPercent = ((s.currentValue - s.totalInvested) / s.totalInvested) * 100;
            } else if (s.totalInvested > 0 && s.openPL !== 0) {
                // Fallback to using openPL if currentValue is not available
                s.openPLPercent = (s.openPL / s.totalInvested) * 100;
            } else {
                s.openPLPercent = 0;
            }
            
            // Debug logging for UK currency stats - commented out to reduce console noise
            // if (currency === '£') {
            //     console.log(`UK Currency Stats:`, {
            //         currency: currency,
            //         totalInvested: s.totalInvested,
            //         currentValue: s.currentValue,
            //         unrealizedPL: s.unrealizedPL,
            //         openPL: s.openPL,
            //         openPLPercent: s.openPLPercent.toFixed(2) + '%',
            //         activeTrades: s.activeTrades
            //     });
            // }
            
            s.totalClosed = s.closedTrades;
            s.totalActive = s.activeTrades; // Add totalActive for UI compatibility
            
            // Calculate average profit percentage per currency
            let currencyProfitPercent = 0;
            let currencyClosedCount = 0;
            closedTrades.forEach(trade => {
                const tradeCurrency = trade.currencySymbol || getCurrencySymbol(trade.symbol);
                if (tradeCurrency === currency && trade.percentGain !== undefined && trade.percentGain !== null) {
                    currencyProfitPercent += trade.percentGain;
                    currencyClosedCount++;
                }
            });
            s.avgProfit = currencyClosedCount > 0 ? (currencyProfitPercent / currencyClosedCount) : 0;
        });
        
        return {
            currencies: currencies,
            overall: overall
        };
    }
    
    // Export functions and data
    return {
        init,
        getCurrencySymbol,
        formatDate, // Export formatDate for UI components
        formatDateForFilename, // Export formatDateForFilename for exports
        addTrade,
        updateTrade,
        closeTrade,
        deleteTrade,
        deleteAllTrades,
        getAllTrades: () => allTrades,
        getActiveTrades: () => activeTrades,
        getClosedTrades: () => closedTrades,
        getTrades, // For backward compatibility
        getTradeById: (id) => allTrades.find(t => t.id === id),
        getTradeStatisticsByCurrency, // For statistics display
        getEquityCurveData, // For equity curve chart
        getDrawdownData, // For drawdown chart
        getDrawdownChartData: getDrawdownData, // Alias for backward compatibility
        getPLDistributionData, // For P&L distribution chart
        getMonthlyPerformanceData, // For monthly performance analysis
        getWinLossPieChartData, // For win/loss pie chart
        getTradeSizeVsReturnData, // For trade size vs return scatter plot
        getPerformanceByMarket, // For market comparison chart
        getHoldingPeriodStats, // For holding period analysis
        getAdvancedMetrics, // For advanced metrics display
        getCalendarHeatmapData, // For calendar heatmap visualization
        getExitReasonBreakdown, // For exit reason analysis
        getMarketStatus, // For market status display
        startMarketMonitoring,
        stopMarketMonitoring,
        refreshData: loadTradesFromAPI, // Expose refresh function
        showNotification, // Export showNotification for external use
        CURRENCY_SYMBOL, // Export for backward compatibility
        // UI helper functions
        setSelectedTradeId: (id) => { selectedTradeId = id; },
        getSelectedTradeId: () => selectedTradeId,
        clearSelectedTrade: () => { selectedTradeId = null; },
        refreshUI: refreshUI // Export for manual UI refresh
    };
})();

// Export to global scope
window.TradeCore = TradeCore;

// Export addNewTrade function for trade-modal.js compatibility
window.addNewTrade = async function(tradeData) {
    try {
        // Ensure all required fields are present
        if (!tradeData.symbol) {
            throw new Error('Stock symbol is required');
        }
        if (!tradeData.entryPrice || tradeData.entryPrice <= 0) {
            throw new Error('Valid entry price is required');
        }
        if (!tradeData.shares || tradeData.shares <= 0) {
            throw new Error('Number of shares must be greater than 0');
        }
        
        // Validate shares based on market type
        const isIndianMarket = tradeData.symbol.includes('.NS') || tradeData.symbol.includes('.BO') || 
                              (!tradeData.symbol.includes('.') && tradeData.currencySymbol === '₹');
        
        if (isIndianMarket && tradeData.shares !== Math.floor(tradeData.shares)) {
            throw new Error('Indian markets require whole number of shares');
        }
        
        const result = await TradeCore.addTrade(tradeData);
        if (result) {
            // Return a trade ID for backward compatibility
            // The trade should now have an ID assigned by the database
            return tradeData.id || Date.now();
        }
        return null;
    } catch (error) {
        console.error('Error in addNewTrade wrapper:', error);
        throw error; // Re-throw to let the caller handle it
    }
};

// Initialize when DOM is ready if we're on the trades page
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.location.pathname.includes('trades.html')) {
            TradeCore.init();
        }
    });
} else if (window.location.pathname.includes('trades.html')) {
    TradeCore.init();
}