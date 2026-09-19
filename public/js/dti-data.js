/**
 * DTI Backtester - Data Module
 * Handles data management, fetching, and processing
 */

// Create DTIData module
const DTIData = (function() {
    // Data caching
    const dataCache = new Map();
    
    // Constants
    const MAX_RETRIES = 1;

    // Blocklist for known problematic stocks (delisted, renamed, or consistently unavailable)
    const STOCK_BLOCKLIST = new Set([
        // US stocks with 500 errors (likely delisted)
        'SAGE', 'BPMC', 'HES', 'TGI', 'FARO',

        // UK stock with 500 error
        'INDV.L',

        // Indian stock with persistent failures
        'SESHAPAPER.NS'
    ]);

    // Track failed stocks for better reporting
    const failedStocks = new Map();
    
/**
 * Fetch historical data from Yahoo Finance API through our proxy server
 * @param {string} symbol - Stock symbol
 * @param {string} period - Time period (e.g. '5y')
 * @param {string} interval - Data interval (e.g. '1d')
 * @param {number} retryCount - Current retry attempt
 * @returns {Promise<Array>} - Array of price data
 */
async function fetchStockData(symbol, period = '5y', interval = '1d', retryCount = 0) {
    // Check if stock is in blocklist
    if (STOCK_BLOCKLIST.has(symbol)) {
        const reason = 'Stock is in blocklist (likely delisted, renamed, or data unavailable)';
        failedStocks.set(symbol, { reason, error: 'BLOCKLISTED', timestamp: new Date() });
        return null;
    }

    // Check cache first
    const cacheKey = `${symbol}_${period}_${interval}`;
    if (dataCache.has(cacheKey)) {
        return dataCache.get(cacheKey);
    }
    
    try {
        // Use our local proxy server instead of cors-anywhere
        // Calculate Unix timestamps for period if needed
        const endDate = Math.floor(Date.now() / 1000);
        let startDate;
        
// In dti-data.js, find the fetchStockData function and update this section:
// Convert period to Unix timestamp
if (period === '5y') {
    startDate = endDate - (5 * 365 * 24 * 60 * 60); // 5 years in seconds
} else if (period === '2y') {
    startDate = endDate - (2 * 365 * 24 * 60 * 60); // 2 years in seconds
} else if (period === '1y') {
    startDate = endDate - (365 * 24 * 60 * 60); // 1 year in seconds
} else if (period === '6mo') {
    startDate = endDate - (182 * 24 * 60 * 60); // 6 months in seconds
} else if (period === '3mo') {
    startDate = endDate - (91 * 24 * 60 * 60); // 3 months in seconds
} else if (period === '1mo') {
    startDate = endDate - (30 * 24 * 60 * 60); // 1 month in seconds
} else if (period === 'max') {
    startDate = 0; // Far in the past for maximum available data
} else {
    // Default to 5 years if period format is not recognized
    startDate = endDate - (5 * 365 * 24 * 60 * 60);
}
        
        // Local proxy URL for historical data
        const proxyUrl = `/yahoo/history?symbol=${symbol}&period1=${startDate}&period2=${endDate}&interval=${interval}`;

        // Status messages disabled - they cluttered the UI during batch scans
        // const statusElement = document.getElementById('data-fetch-status');
        // if (statusElement) {
        //     statusElement.innerHTML = `
        //         <div class="data-fetch-loading">
        //             <svg class="spinner" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        //                 <line x1="12" y1="2" x2="12" y2="6"></line>
        //                 <line x1="12" y1="18" x2="12" y2="22"></line>
        //                 <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
        //                 <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
        //                 <line x1="2" y1="12" x2="6" y2="12"></line>
        //                 <line x1="18" y1="12" x2="22" y2="12"></line>
        //                 <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
        //                 <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
        //             </svg>
        //             Fetching data for ${symbol}...
        //         </div>
        //     `;
        //     statusElement.classList.remove('hidden');
        // }

        // Use AbortManager for cancellable requests
        const operationId = `fetch-historical-${symbol}-${period}-${interval}`;
        const response = typeof AbortManager !== 'undefined'
            ? await AbortManager.fetch(operationId, proxyUrl, {}, 45000) // 45s timeout to match server
            : await fetch(proxyUrl);

        if (!response.ok) {
            const errorMessage = `HTTP ${response.status}: ${response.statusText}`;

            // Handle 500 errors specially - likely indicates delisted/invalid stock
            if (response.status === 500) {
                const reason = 'Data source returned 500 error - stock may be delisted, renamed, or data unavailable';
                failedStocks.set(symbol, { reason, error: `HTTP_${response.status}`, timestamp: new Date() });
            }

            throw new Error(errorMessage);
        }

        // Our proxy now returns CSV data directly
        const csvText = await response.text();
        
        // Process the CSV text into the format we need
        const rows = csvText.trim().split('\n');
        const headers = rows[0].toLowerCase().split(',');
        
        // Create a 2D array similar to what we'd get from Papa.parse
        const csvData = [headers];
        
        for (let i = 1; i < rows.length; i++) {
            if (rows[i].trim()) {
                csvData.push(rows[i].split(','));
            }
        }

        // Store in cache
        dataCache.set(cacheKey, csvData);
        
        return csvData;
    } catch (error) {
        // Track failed stock
        const reason = error.message.includes('500') ?
            'Data source error - stock may be delisted or renamed' :
            error.message;
        failedStocks.set(symbol, { reason, error: error.message, timestamp: new Date() });

        // Status messages disabled - they cluttered the UI during batch scans
        // const statusElement = document.getElementById('data-fetch-status');
        // if (statusElement) {
        //     const isServerError = error.message.includes('500');
        //     const errorClass = isServerError ? 'data-fetch-warning' : 'data-fetch-error';
        //     const errorMessage = isServerError ?
        //         `Stock ${symbol} may be delisted or renamed (500 error)` :
        //         `Error fetching data for ${symbol}: ${error.message}`;

        //     statusElement.innerHTML = `
        //         <div class="${errorClass}">
        //             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        //                 ${isServerError ?
        //                     '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>' :
        //                     '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>'
        //                 }
        //             </svg>
        //             ${errorMessage}
        //         </div>
        //     `;
        // }

        // Implement retry logic
        if (retryCount < MAX_RETRIES) {

            // Status messages disabled - they cluttered the UI during batch scans
            // if (statusElement) {
            //     statusElement.innerHTML = `
            //         <div class="data-fetch-warning">
            //             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            //                 <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            //                 <line x1="12" y1="9" x2="12" y2="13"></line>
            //                 <line x1="12" y1="17" x2="12.01" y2="17"></line>
            //             </svg>
            //             Retrying data fetch for ${symbol} (${retryCount + 1}/${MAX_RETRIES})...
            //         </div>
            //     `;
            // }
            
            // Exponential backoff
            const delay = Math.pow(2, retryCount) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchStockData(symbol, period, interval, retryCount + 1);
        }

        // Only show error notification for non-500 errors (500 errors are expected for delisted stocks)
        if (!error.message.includes('500')) {
            DTIBacktester.utils.showNotification(`Failed to fetch data for ${symbol}: ${error.message}`, 'error');
        }
        return null;
    }
}
    
/**
 * Fetch current stock quote data
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - Current stock data
 */
async function fetchCurrentQuote(symbol) {
    try {
        const proxyUrl = `/yahoo/quote?symbol=${symbol}`;

        // Use AbortManager for cancellable requests
        const operationId = `fetch-quote-${symbol}`;
        const response = typeof AbortManager !== 'undefined'
            ? await AbortManager.fetch(operationId, proxyUrl, {}, 45000) // 45s timeout to match server
            : await fetch(proxyUrl);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        DTIBacktester.utils.showNotification(`Failed to fetch quote for ${symbol}: ${error.message}`, 'error');
        return null;
    }
}


    /**
     * Process Yahoo Finance data into CSV format
     * @param {Object} yahooData - Yahoo Finance API response
     * @returns {Array} - Array of price data
     */
    function processYahooFinanceData(yahooData) {
        const result = yahooData.chart.result[0];
        const quotes = result.indicators.quote[0];
        const timestamps = result.timestamp;
        
        // Create CSV data
        let csvData = [
            ['date', 'open', 'high', 'low', 'close', 'volume']
        ];
        
        for (let i = 0; i < timestamps.length; i++) {
            const date = new Date(timestamps[i] * 1000);
            const dateString = date.toISOString().split('T')[0];
            
            // Skip points with null/undefined values
            if (quotes.open[i] === null || quotes.high[i] === null || 
                quotes.low[i] === null || quotes.close[i] === null) {
                continue;
            }
            
            csvData.push([
                dateString,
                quotes.open[i],
                quotes.high[i],
                quotes.low[i],
                quotes.close[i],
                quotes.volume[i]
            ]);
        }
        
        return csvData;
    }
    
    /**
     * Convert array data to CSV string
     * @param {Array} data - Array of data
     * @returns {string} - CSV string
     */
    function arrayToCSV(data) {
        return data.map(row => row.join(',')).join('\n');
    }
    
    /**
     * Process CSV data for a single stock
     * @param {Array} data - CSV data
     * @param {Object} stock - Stock object
     * @returns {Object|null} - Processed stock data or null if error
     */
    function processStockCSV(data, stock) {
        try {
            if (!data || data.length < 2) {
                return null;
            }
            
            // Extract columns
            const headers = data[0];
            const dateIndex = headers.indexOf('date');
            const openIndex = headers.indexOf('open');
            const highIndex = headers.indexOf('high');
            const lowIndex = headers.indexOf('low');
            const closeIndex = headers.indexOf('close');
            
            if (dateIndex === -1 || openIndex === -1 || highIndex === -1 || 
                lowIndex === -1 || closeIndex === -1) {
                return null;
            }
            
            // Process data rows
            let parsedData = [];
            
            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                
                if (!row || row.length <= Math.max(dateIndex, openIndex, highIndex, lowIndex, closeIndex)) {
                    continue;
                }
                
                const dateStr = row[dateIndex];
                if (!dateStr) continue;
                
                const dateObj = new Date(dateStr);
                const openVal = parseFloat(row[openIndex]);
                const highVal = parseFloat(row[highIndex]);
                const lowVal = parseFloat(row[lowIndex]);
                const closeVal = parseFloat(row[closeIndex]);
                
                if (isNaN(openVal) || isNaN(highVal) || isNaN(lowVal) || isNaN(closeVal)) {
                    continue;
                }
                
                parsedData.push({
                    date: dateObj,
                    dateStr: dateStr,
                    open: openVal,
                    high: highVal,
                    low: lowVal,
                    close: closeVal
                });
            }
            
            // Sort data chronologically
            parsedData.sort((a, b) => a.date - b.date);
            
            // Extract sorted arrays
            const dates = parsedData.map(item => item.dateStr);
            const open = parsedData.map(item => item.open);
            const high = parsedData.map(item => item.high);
            const low = parsedData.map(item => item.low);
            const close = parsedData.map(item => item.close);
            
            // Get DTI parameters (fixed values)
            const r = 14;
            const s = 10;
            const u = 5;
            
            // Calculate daily DTI - calling function from DTI indicators module
            const dti = DTIIndicators.calculateDTI(high, low, r, s, u);
            const sevenDayDTIData = DTIIndicators.calculate7DayDTI(dates, high, low, r, s, u);
            
            // Run backtest with active trade detection - calling from backtest module
            const { completedTrades, activeTrade } = DTIBacktest.backtestWithActiveDetection(dates, close, dti, sevenDayDTIData);
            
            return {
                stock: stock,
                dates: dates,
                open: open,
                high: high,
                low: low,
                close: close,
                dti: dti,
                sevenDayDTIData: sevenDayDTIData,
                trades: completedTrades,
                activeTrade: activeTrade
            };
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Clear data cache
     * Useful for freeing memory after large scans
     */
    function clearDataCache() {
        dataCache.clear();
        DTIBacktester.utils.showNotification("Data cache cleared", "info");
    }

    /**
     * Get failed stocks report
     * @returns {Object} Report of failed stocks with reasons
     */
    function getFailedStocksReport() {
        const failed = Array.from(failedStocks.entries()).map(([symbol, info]) => ({
            symbol,
            ...info
        }));

        return {
            count: failed.length,
            stocks: failed,
            blocklisted: Array.from(STOCK_BLOCKLIST),
            summary: {
                blocklisted: Array.from(STOCK_BLOCKLIST).length,
                failed_500: failed.filter(s => s.error.includes('500')).length,
                failed_other: failed.filter(s => !s.error.includes('500') && s.error !== 'BLOCKLISTED').length
            }
        };
    }

    /**
     * Clear failed stocks tracking
     */
    function clearFailedStocks() {
        failedStocks.clear();
    }

    /**
     * Add stock to blocklist
     * @param {string} symbol - Stock symbol to add
     */
    function addToBlocklist(symbol) {
        STOCK_BLOCKLIST.add(symbol);
    }

    /**
     * Remove stock from blocklist
     * @param {string} symbol - Stock symbol to remove
     */
    function removeFromBlocklist(symbol) {
        STOCK_BLOCKLIST.delete(symbol);
    }

    /**
     * Validate a stock symbol by attempting to fetch a quote
     * @param {string} symbol - Stock symbol to validate
     * @returns {Promise<Object>} Validation result with isValid and error info
     */
    async function validateStockSymbol(symbol) {
        try {
            const proxyUrl = `/yahoo/quote?symbol=${symbol}`;

            // Use AbortManager for cancellable requests
            const operationId = `validate-symbol-${symbol}`;
            const response = typeof AbortManager !== 'undefined'
                ? await AbortManager.fetch(operationId, proxyUrl, {}, 45000) // 45s timeout to match server
                : await fetch(proxyUrl);

            if (response.ok) {
                const data = await response.json();
                return {
                    isValid: true,
                    symbol,
                    data: data.quoteResponse?.result?.[0] || null
                };
            } else {
                return {
                    isValid: false,
                    symbol,
                    error: `HTTP ${response.status}: ${response.statusText}`,
                    reason: response.status === 500 ? 'likely_delisted' : 'api_error'
                };
            }
        } catch (error) {
            return {
                isValid: false,
                symbol,
                error: error.message,
                reason: 'network_error'
            };
        }
    }

    /**
     * Attempt to find alternative symbols for a failed stock
     * @param {Object} stock - Stock object with name and symbol
     * @returns {Promise<Array>} Array of potential alternative symbols
     */
    async function findAlternativeSymbols(stock) {
        const alternatives = [];
        const baseName = stock.name.toLowerCase();

        // Known symbol mappings for common renamings/mergers
        const symbolMappings = {
            // All problematic stocks have been removed from source data
            // This mapping system is maintained for future symbol changes or alternatives

            // Example format for future use:
            // 'old company name': ['NEW.SYMBOL'], // Alternative or updated symbol
        };

        const mapping = symbolMappings[baseName];
        if (mapping) {
            for (const altSymbol of mapping) {
                const validation = await validateStockSymbol(altSymbol);
                if (validation.isValid) {
                    alternatives.push({
                        symbol: altSymbol,
                        reason: 'Known alternative symbol',
                        confidence: 'high'
                    });
                }
            }
        }

        return alternatives;
    }

    /**
     * Check and update problematic stocks in stock lists
     * @param {Array} stockList - List of stocks to check
     * @returns {Promise<Object>} Report of validation results
     */
    async function validateStockList(stockList) {
        const results = {
            valid: [],
            invalid: [],
            alternatives: [],
            total: stockList.length
        };

        for (const stock of stockList.slice(0, 10)) { // Limit to first 10 for testing
            const validation = await validateStockSymbol(stock.symbol);

            if (validation.isValid) {
                results.valid.push({ stock, validation });
            } else {
                results.invalid.push({ stock, validation });

                // Try to find alternatives for invalid stocks
                const alternatives = await findAlternativeSymbols(stock);
                if (alternatives.length > 0) {
                    results.alternatives.push({ stock, alternatives });
                }
            }

            // Add delay to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        return results;
    }

    /**
     * Console helper function for debugging stock issues
     * Available globally as DTIData.debugStocks()
     */
    function debugStocks() {

        // Show failed stocks report
        const failedReport = getFailedStocksReport();

        if (failedReport.stocks.length > 0) {
            failedReport.stocks.slice(0, 10).forEach(stock => {
            });
        }


    }

    /**
     * Export current configuration for backup/sharing
     */
    function exportConfiguration() {
        return {
            timestamp: new Date().toISOString(),
            blocklist: Array.from(STOCK_BLOCKLIST),
            failedStocks: Array.from(failedStocks.entries()),
            version: '1.0'
        };
    }

    /**
     * Import configuration from backup
     * @param {Object} config - Configuration object from exportConfiguration()
     */
    function importConfiguration(config) {
        if (config.blocklist) {
            config.blocklist.forEach(symbol => STOCK_BLOCKLIST.add(symbol));
        }

        if (config.failedStocks) {
            config.failedStocks.forEach(([symbol, info]) => failedStocks.set(symbol, info));
        }
    }

    // Return public API
    return {
        fetchStockData,
	fetchCurrentQuote,
        arrayToCSV,
        processStockCSV,
        clearDataCache,
        getFailedStocksReport,
        clearFailedStocks,
        addToBlocklist,
        removeFromBlocklist,
        validateStockSymbol,
        findAlternativeSymbols,
        validateStockList,
        debugStocks,
        exportConfiguration,
        importConfiguration
    };
})();

// Make DTIData available globally
window.DTIData = DTIData;