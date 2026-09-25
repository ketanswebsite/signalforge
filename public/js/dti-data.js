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

/**
 * Fetch historical data from Yahoo Finance API through our proxy server
 * @param {string} symbol - Stock symbol
 * @param {string} period - Time period (e.g. '5y')
 * @param {string} interval - Data interval (e.g. '1d')
 * @param {number} retryCount - Current retry attempt
 * @returns {Promise<Array>} - Array of price data
 */
async function fetchStockData(symbol, period = '5y', interval = '1d', retryCount = 0) {
    // Check if stock is in blocklist (likely delisted, renamed, or data unavailable)
    if (STOCK_BLOCKLIST.has(symbol)) {
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
        const proxyUrl = `/yahoo/history?symbol=${encodeURIComponent(symbol)}&period1=${startDate}&period2=${endDate}&interval=${interval}`;

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
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
            
            // The DTI's periods (lib/shared/strategy-params.js, loaded by the page)
            const { r, s, u } = window.StrategyParams.DTI_PERIODS;
            
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
    
    // Return public API: the Positions chart dialog (positions-page.js) uses both
    return {
        fetchStockData,
        processStockCSV
    };
})();

// Make DTIData available globally
window.DTIData = DTIData;