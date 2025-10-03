/**
 * DTI Backtester - Data Module
 * Handles data management, fetching, and processing
 * Uses shared stock data module - NO DUPLICATION
 */

// Create DTIData module
const DTIData = (function() {
    // Get stock lists from shared module (SINGLE SOURCE OF TRUTH)
    const stockLists = window.StockData.getStockLists();
    const nifty50Stocks = stockLists.nifty50;
    const niftyNext50Stocks = stockLists.niftyNext50;
    const niftyMidcap150Stocks = stockLists.niftyMidcap150;
    const ftse100Stocks = stockLists.ftse100;
    const ftse250Stocks = stockLists.ftse250;
    const usStocks = stockLists.usStocks;
    const marketIndices = stockLists.indices;

    // Data caching
    const dataCache = new Map();
    
    // Constants
    const MAX_RETRIES = 1;
    const CONCURRENT_REQUESTS_LIMIT = 5; // Limit concurrent requests to avoid overwhelming Yahoo Finance API

    // Blocklist for known problematic stocks (now empty - all problematic stocks removed from source data)
    const STOCK_BLOCKLIST = new Set([
        // All problematic stocks have been completely removed from the stock data files
        // This blocklist is maintained for future use if new problematic stocks are discovered
    ]);

    // Track failed stocks for better reporting
    const failedStocks = new Map();
    
    /**
     * Get the current stock list based on selection
     * @returns {Array} List of stock objects
     */
    function getCurrentStockList() {
        switch (DTIBacktester.currentStockIndex) {
            case 'nifty50':
                return nifty50Stocks;
            case 'niftyNext50':
                return niftyNext50Stocks;
            case 'niftyMidcap150':
                return niftyMidcap150Stocks;
            case 'ftse100':
                return ftse100Stocks;
            case 'ftse250':
                return ftse250Stocks;
            case 'usStocks':
                return usStocks;
            case 'indices':
                return marketIndices;
            default:
                return nifty50Stocks;
        }
    }
    
    /**
     * Get stock lists for multi-index scan
     * @param {string} scanType - Type of scan to perform
     * @returns {Array} Combined list of stock objects
     */
    function getStocksForScanType(scanType) {
        if (typeof DTIUI !== 'undefined' && DTIUI.getStocksForSelectedScanType) {
            return DTIUI.getStocksForSelectedScanType();
        }
        
        switch(scanType) {
            case 'all':
                return [
                    ...nifty50Stocks,
                    ...niftyNext50Stocks,
                    ...niftyMidcap150Stocks,
                    ...ftse100Stocks,
                    ...ftse250Stocks,
                    ...usStocks
                ];
            case 'indian':
                return [
                    ...nifty50Stocks,
                    ...niftyNext50Stocks,
                    ...niftyMidcap150Stocks
                ];
            case 'uk':
                return [
                    ...ftse100Stocks,
                    ...ftse250Stocks
                ];
            case 'us':
                return usStocks;
            default:
                return getCurrentStockList();
        }
    }
    
    /**
     * Helper function to deduplicate stocks in combined lists
     * @param {Array} stockList - Combined list of stock objects
     * @returns {Array} Deduplicated list of stock objects
     */
    function deduplicateStocks(stockList) {
        const symbolSet = new Set();
        const uniqueStocks = [];
        
        for (const stock of stockList) {
            if (!symbolSet.has(stock.symbol)) {
                symbolSet.add(stock.symbol);
                uniqueStocks.push(stock);
            }
        }
        
        return uniqueStocks;
    }
    
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
        console.log(`Skipping blocklisted stock: ${symbol} - ${reason}`);
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
        
        // Update status element
        const statusElement = document.getElementById('data-fetch-status');
        if (statusElement) {
            statusElement.innerHTML = `
                <div class="data-fetch-loading">
                    <svg class="spinner" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="2" x2="12" y2="6"></line>
                        <line x1="12" y1="18" x2="12" y2="22"></line>
                        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                        <line x1="2" y1="12" x2="6" y2="12"></line>
                        <line x1="18" y1="12" x2="22" y2="12"></line>
                        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                    </svg>
                    Fetching data for ${symbol}...
                </div>
            `;
            statusElement.style.display = 'block';
        }

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
                console.warn(`Stock ${symbol} failed with 500 error - adding to failed stocks list`);
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
        
        // Update status on success
        if (statusElement) {
            statusElement.innerHTML = `
                <div class="data-fetch-success">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Data fetched successfully for ${symbol}
                </div>
            `;
            
            // Hide after 3 seconds
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 3000);
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

        // Update status on error
        const statusElement = document.getElementById('data-fetch-status');
        if (statusElement) {
            const isServerError = error.message.includes('500');
            const errorClass = isServerError ? 'data-fetch-warning' : 'data-fetch-error';
            const errorMessage = isServerError ?
                `Stock ${symbol} may be delisted or renamed (500 error)` :
                `Error fetching data for ${symbol}: ${error.message}`;

            statusElement.innerHTML = `
                <div class="${errorClass}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        ${isServerError ?
                            '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>' :
                            '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>'
                        }
                    </svg>
                    ${errorMessage}
                </div>
            `;
        }
        
        // Implement retry logic
        if (retryCount < MAX_RETRIES) {
            
            // Update status to show retry
            if (statusElement) {
                statusElement.innerHTML = `
                    <div class="data-fetch-warning">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        Retrying data fetch for ${symbol} (${retryCount + 1}/${MAX_RETRIES})...
                    </div>
                `;
            }
            
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
     * Process stocks in batches with a throttled approach
     * @param {Array} stockList - List of stocks to process
     * @param {function} progressCallback - Callback to update progress
     * @param {string} period - Time period
     * @returns {Promise<Array>} - Array of processed stock data
     */
    async function processStocksBatch(stockList, progressCallback, period = '5y') {
        const processedData = [];
        let successCount = 0;
        let errorCount = 0;
        let totalProcessed = 0;
        
        // Process stocks in batches to avoid overwhelming the API
        const batchSize = CONCURRENT_REQUESTS_LIMIT;
        const batches = [];
        
        // Split the stock list into batches
        for (let i = 0; i < stockList.length; i += batchSize) {
            batches.push(stockList.slice(i, i + batchSize));
        }
        
        // Process each batch sequentially
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            const batchPromises = batch.map(stock => 
                fetchStockData(stock.symbol, period)
                .then(data => {
                    if (!data || data.length <= 1) {
                        errorCount++;
                        return null;
                    }
                    
                    const parsed = processStockCSV(data, stock);
                    if (parsed) {
                        successCount++;
                        return parsed;
                    } else {
                        errorCount++;
                        return null;
                    }
                })
                .catch(error => {
                    errorCount++;
                    return null;
                })
                .finally(() => {
                    totalProcessed++;
                    if (progressCallback) {
                        progressCallback(totalProcessed, stockList.length, successCount, errorCount);
                    }
                })
            );
            
            // Wait for all promises in the batch to resolve
            const batchResults = await Promise.all(batchPromises);
            
            // Add valid results to the processed data array
            batchResults.forEach(result => {
                if (result) {
                    processedData.push(result);
                }
            });
            
            // Add a delay between batches to avoid overwhelming the API and prevent rate limiting
            if (batchIndex < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        return processedData;
    }
    
    /**
     * Fetch data for all stocks in the current index or selected scan type
     * @returns {Promise} Promise that resolves when all data is fetched
     */
    async function fetchAllStocksData() {
        // Prevent multiple runs
        if (DTIBacktester.isProcessing) {
            DTIBacktester.utils.showNotification('Scan already in progress, please wait', 'info');
            return Promise.reject(new Error('Process already running'));
        }
        
        DTIBacktester.isProcessing = true;
        
        // Get the selected period from the dropdown
        const periodSelector = document.getElementById('period-selector');
        const period = periodSelector ? periodSelector.value : '5y';
        
        // Check for scan type selector (for multi-index scans)
        const scanTypeSelector = document.getElementById('scan-type-selector');
        const scanType = scanTypeSelector ? scanTypeSelector.value : 'current';
        
        // Get stock list based on scan type
        let stockList;
        if (scanType === 'current') {
            stockList = getCurrentStockList();
        } else {
            stockList = getStocksForScanType(scanType);
            // Deduplicate in case there are overlapping stocks
            stockList = deduplicateStocks(stockList);
        }
        
        // Get display name for the current scan
        let scanDisplayName;
        if (scanType === 'current') {
            scanDisplayName = 
                DTIBacktester.currentStockIndex === 'nifty50' ? 'Nifty 50' : 
                DTIBacktester.currentStockIndex === 'niftyNext50' ? 'Nifty Next 50' : 
                DTIBacktester.currentStockIndex === 'niftyMidcap150' ? 'Nifty Midcap 150' : 
                DTIBacktester.currentStockIndex === 'ftse100' ? 'FTSE 100' :
                DTIBacktester.currentStockIndex === 'ftse250' ? 'FTSE 250' :
                DTIBacktester.currentStockIndex === 'usStocks' ? 'US Stocks' :
                DTIBacktester.currentStockIndex === 'indices' ? 'Market Indices' : 'Selected Stocks';
        } else {
            scanDisplayName = scanTypeSelector.options[scanTypeSelector.selectedIndex].text;
        }
        
        // Show batch processing status
        const statusDiv = document.getElementById('batch-status');
        if (statusDiv) {
            statusDiv.innerHTML = `
                <div>Processing ${scanDisplayName} (${stockList.length} stocks): 0/${stockList.length}</div>
                <div class="progress-bar"><div class="progress" style="width: 0%"></div></div>
            `;
            statusDiv.style.display = 'block';
        }
        
        // Clear previous active trade opportunities
        DTIBacktester.activeTradeOpportunities = [];
        DTIBacktester.allStocksData = [];
        
        // Process stocks with progress updates
        return new Promise(async (resolve, reject) => {
            try {
                // Create a progress callback function
                const updateProgress = (processed, total, successes, errors) => {
                    if (statusDiv) {
                        const percentComplete = Math.round((processed / total) * 100);
                        statusDiv.innerHTML = `
                            <div>Processing ${scanDisplayName} (${stockList.length} stocks): ${processed}/${total}</div>
                            <div class="progress-bar"><div class="progress" style="width: ${percentComplete}%"></div></div>
                            <div style="margin-top: 8px; font-size: 12px;">
                                ${successes} succeeded, ${errors} failed, ${processed} processed
                            </div>
                        `;
                    }
                };
                
                // Process stocks in batches
                const processedData = await processStocksBatch(stockList, updateProgress, period);
                
                // Store the stock data
                DTIBacktester.allStocksData = processedData;
                
                // Extract active trade opportunities
                processedData.forEach(data => {
                    if (data.activeTrade) {
                        DTIBacktester.activeTradeOpportunities.push({
                            stock: data.stock,
                            trade: data.activeTrade,
                            data: data
                        });
                    }
                });
                
                // Update status when complete
                if (statusDiv) {
                    const failedReport = getFailedStocksReport();
                    const totalSkipped = failedReport.summary.blocklisted + failedReport.summary.failed_500 + failedReport.summary.failed_other;

                    statusDiv.innerHTML = `
                        <div class="batch-complete">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            Completed processing ${processedData.length} of ${stockList.length} stocks
                        </div>
                        <div class="progress-bar"><div class="progress" style="width: 100%"></div></div>
                        <div style="margin-top: 8px; font-size: 12px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                <span>${processedData.length} stocks processed successfully</span>
                                <span>${DTIBacktester.activeTradeOpportunities.length} active trading opportunities found</span>
                            </div>
                            ${totalSkipped > 0 ? `
                            <div style="color: #888; font-size: 11px;">
                                ${totalSkipped} stocks skipped: ${failedReport.summary.blocklisted} blocklisted, ${failedReport.summary.failed_500} likely delisted/renamed
                                ${failedReport.summary.failed_other > 0 ? `, ${failedReport.summary.failed_other} other errors` : ''}
                            </div>
                            ` : ''}
                        </div>
                    `;
                }
                
                // Display active trade opportunities
                if (typeof DTIUI !== 'undefined' && DTIUI.displayBuyingOpportunities) {
                    DTIUI.displayBuyingOpportunities();
                }
                
                // Reset processing flag
                DTIBacktester.isProcessing = false;
                
                // Show notification
                DTIBacktester.utils.showNotification(
                    `Scan complete: Found ${DTIBacktester.activeTradeOpportunities.length} opportunities in ${processedData.length} stocks`, 
                    'success'
                );
                
                resolve(DTIBacktester.allStocksData);
            } catch (error) {
                if (statusDiv) {
                    statusDiv.innerHTML = `
                        <div class="batch-error">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="15" y1="9" x2="9" y2="15"></line>
                                <line x1="9" y1="9" x2="15" y2="15"></line>
                            </svg>
                            Error in batch processing: ${error.message}
                        </div>
                    `;
                }
                
                // Reset processing flag
                DTIBacktester.isProcessing = false;
                
                // Show notification
                DTIBacktester.utils.showNotification(`Scan failed: ${error.message}`, 'error');
                
                reject(error);
            }
        });
    }
    
    /**
     * Process CSV data from a file upload
     * @param {Object} results - Papa Parse results
     */
    function processCSV(results) {
        // Prevent multiple processing
        if (DTIBacktester.isProcessing) {
            DTIBacktester.utils.showNotification('Processing in progress, please wait', 'info');
            return;
        }
        
        DTIBacktester.isProcessing = true;

        // Show loading indicator for process button using LoadingStates utility
        const processBtn = document.getElementById('process-btn');
        if (typeof LoadingStates !== 'undefined') {
            LoadingStates.setLoading(processBtn, 'Processing...');
        } else {
            // Fallback if LoadingStates not loaded
            processBtn.disabled = true;
        }
        
        try {
            const data = results.data;
            
            // Check if data is empty
            if (!data || data.length < 2) {
                throw new Error('CSV file appears to be empty or invalid');
            }
            
            // Detect CSV format
            const formatInfo = detectCSVFormat(data);
            
            // Display CSV format info
            const csvInfoElement = document.getElementById('csv-info');
            csvInfoElement.style.display = 'block';
            csvInfoElement.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                    <div>
                        <strong>CSV Format:</strong> ${formatInfo.format === 'new' ? 'New Format' : 'Original Format'}<br>
                        <strong>Columns:</strong> ${formatInfo.headers.join(', ')}
                    </div>
                </div>
            `;
            
            // Extract columns
            let parsedData = [];
            
            // Skip header row and process data
            for (let i = 1; i < data.length; i++) {
                if (!data[i] || !Array.isArray(data[i])) {
                    continue; // Skip invalid rows
                }
                
                if (data[i].length <= Math.max(formatInfo.dateIndex, formatInfo.openIndex, formatInfo.highIndex, formatInfo.lowIndex, formatInfo.closeIndex)) {
                    continue; // Skip rows with insufficient columns
                }
                
                // Convert strings to numbers, handling possible invalid data
                const dateStr = data[i][formatInfo.dateIndex];
                
                if (!dateStr) continue; // Skip rows without a date
                
                // Special handling for date format like "22-Apr-25"
                let dateObj;
                if (typeof dateStr === 'string' && dateStr.includes('-')) {
                    // Handle format like "22-Apr-25"
                    const dateParts = dateStr.split('-');
                    if (dateParts.length === 3) {
                        const day = parseInt(dateParts[0], 10);
                        const month = DTIBacktester.utils.parseMonth(dateParts[1]);
                        // Handle 2-digit year, assume 20xx
                        let year = parseInt(dateParts[2], 10);
                        if (year < 100) {
                            year += 2000;
                        }
                        
                        // Create date object
                        dateObj = new Date(year, month, day);
                    } else {
                        dateObj = new Date(dateStr);
                    }
                } else {
                    dateObj = new Date(dateStr);
                }
                
                // Try to parse numeric values, handling strings that might have commas
                const openVal = DTIBacktester.utils.parseFloatSafe(data[i][formatInfo.openIndex]);
                const highVal = DTIBacktester.utils.parseFloatSafe(data[i][formatInfo.highIndex]);
                const lowVal = DTIBacktester.utils.parseFloatSafe(data[i][formatInfo.lowIndex]);
                const closeVal = DTIBacktester.utils.parseFloatSafe(data[i][formatInfo.closeIndex]);
                
                if (isNaN(openVal) || isNaN(highVal) || isNaN(lowVal) || isNaN(closeVal)) {
                    continue; // Skip rows with invalid numeric data
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
            
            // Check if we have enough data points
            if (dates.length < 30) {
                throw new Error('Not enough valid data points found in CSV. Please ensure you have at least 30 valid rows.');
            }
            
            // Get parameters for DTI calculation (fixed values)
            const r = 14;
            const s = 10;
            const u = 5;
            
            // Calculate daily DTI - using DTIIndicators module
            const dti = DTIIndicators.calculateDTI(high, low, r, s, u);
            
            // Calculate 7-day DTI - using DTIIndicators module
            const sevenDayDTIData = DTIIndicators.calculate7DayDTI(dates, high, low, r, s, u);
            
            // Run backtest - using DTIBacktest module
            const { completedTrades, activeTrade } = DTIBacktest.backtestWithActiveDetection(dates, close, dti, sevenDayDTIData);
            const allTrades = [...completedTrades];
            if (activeTrade) allTrades.push(activeTrade);
            
            // Store OHLC data globally for chart access
            DTIBacktester.ohlcData = {
                dates: dates,
                open: open,
                high: high,
                low: low,
                close: close
            };
            
            // Display results with animation using DTIUI module
            setTimeout(() => {
                if (typeof DTIUI !== 'undefined') {
                    // Pass OHLC data structure instead of just close prices
                    DTIUI.createCharts(dates, close, dti, sevenDayDTIData, { open, high, low });
                    DTIUI.displayStatistics(allTrades);
                    DTIUI.displayTrades(allTrades);
                }
                
                // Show success notification
                DTIBacktester.utils.showNotification(`Backtest completed with ${completedTrades.length} trades`, 'success');
            }, 200);
        } catch (error) {
            DTIBacktester.utils.showNotification('Error processing CSV file: ' + error.message, 'error');
        } finally {
            // Reset button state using LoadingStates utility
            setTimeout(() => {
                if (typeof LoadingStates !== 'undefined') {
                    LoadingStates.clearLoading(processBtn);
                } else {
                    processBtn.disabled = false;
                }
                DTIBacktester.isProcessing = false;
            }, 500);
        }
    }
    
    /**
     * Detect CSV format and extract data
     * @param {Array} data - CSV data
     * @returns {Object} - Format information
     */
    function detectCSVFormat(data) {
        if (!data || data.length < 2) {
            throw new Error('CSV file appears to be empty or invalid');
        }
        
        const headers = data[0].map(h => (h || '').toString().trim().toLowerCase());
        const formatInfo = { headers: headers };
        
        
        // For the new format with named columns
        if (headers.includes('open') || headers.includes('high') || headers.includes('low') || 
            headers.includes('close') || headers.includes('ltp')) {
            formatInfo.format = 'new';
            
            // Find indices with fallbacks for different possible names
            formatInfo.dateIndex = headers.indexOf('date');
            formatInfo.openIndex = headers.indexOf('open');
            formatInfo.highIndex = headers.indexOf('high');
            formatInfo.lowIndex = headers.indexOf('low');
            
            // Try both 'close' and 'ltp' for closing price
            if (headers.indexOf('close') !== -1) {
                formatInfo.closeIndex = headers.indexOf('close');
            } else if (headers.indexOf('ltp') !== -1) {
                formatInfo.closeIndex = headers.indexOf('ltp');
            } else {
                // Default to the 7th column (index 6) if 'close' is not found
                formatInfo.closeIndex = 6;
            }
        } 
        // Original format with fixed positions
        else if (headers.length >= 6) {
            formatInfo.format = 'original';
            formatInfo.dateIndex = 1;  // Date in second column
            formatInfo.openIndex = 2;  // Open in third column
            formatInfo.highIndex = 3;  // High in fourth column
            formatInfo.lowIndex = 4;   // Low in fifth column
            formatInfo.closeIndex = 5; // Close in sixth column
        } 
        else {
            throw new Error('Unrecognized CSV format. Please ensure your data includes date, open, high, low, close columns.');
        }
        
        
        return formatInfo;
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
        console.log('Failed stocks tracking cleared');
    }

    /**
     * Add stock to blocklist
     * @param {string} symbol - Stock symbol to add
     */
    function addToBlocklist(symbol) {
        STOCK_BLOCKLIST.add(symbol);
        console.log(`Added ${symbol} to blocklist`);
    }

    /**
     * Remove stock from blocklist
     * @param {string} symbol - Stock symbol to remove
     */
    function removeFromBlocklist(symbol) {
        STOCK_BLOCKLIST.delete(symbol);
        console.log(`Removed ${symbol} from blocklist`);
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
        console.log('=== DTI Stock Debugging Helper ===\n');

        // Show failed stocks report
        const failedReport = getFailedStocksReport();
        console.log('Failed Stocks Report:');
        console.log(`- Total failed: ${failedReport.count}`);
        console.log(`- Blocklisted: ${failedReport.summary.blocklisted}`);
        console.log(`- Failed with 500 (likely delisted): ${failedReport.summary.failed_500}`);
        console.log(`- Other errors: ${failedReport.summary.failed_other}\n`);

        if (failedReport.stocks.length > 0) {
            console.log('Recent failures:');
            failedReport.stocks.slice(0, 10).forEach(stock => {
                console.log(`  ${stock.symbol}: ${stock.reason}`);
            });
            console.log('');
        }

        console.log('Available commands:');
        console.log('- DTIData.getFailedStocksReport() - Get detailed failed stocks report');
        console.log('- DTIData.clearFailedStocks() - Clear failed stocks tracking');
        console.log('- DTIData.addToBlocklist("SYMBOL") - Add symbol to blocklist');
        console.log('- DTIData.removeFromBlocklist("SYMBOL") - Remove symbol from blocklist');
        console.log('- DTIData.validateStockSymbol("SYMBOL") - Test if a symbol is valid');
        console.log('- DTIData.findAlternativeSymbols({name: "Company Name", symbol: "SYM"}) - Find alternatives');
        console.log('- DTIData.validateStockList(stockArray) - Validate a list of stocks');
        console.log('- DTIData.clearDataCache() - Clear all cached data\n');

        console.log('Current blocklist:', Array.from(STOCK_BLOCKLIST));
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
            console.log(`Imported ${config.blocklist.length} blocklisted symbols`);
        }

        if (config.failedStocks) {
            config.failedStocks.forEach(([symbol, info]) => failedStocks.set(symbol, info));
            console.log(`Imported ${config.failedStocks.length} failed stock records`);
        }
    }

    // Return public API
    return {
        getCurrentStockList,
        fetchStockData,
	fetchCurrentQuote,
        arrayToCSV,
        processStockCSV,
        fetchAllStocksData,
        processCSV,
        detectCSVFormat,
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
        importConfiguration,
        
        // Stock lists exposed for access by other modules
        getStockLists() {
            return {
                nifty50: nifty50Stocks,
                niftyNext50: niftyNext50Stocks,
                niftyMidcap150: niftyMidcap150Stocks,
                ftse100: ftse100Stocks,
                ftse250: ftse250Stocks,
                usStocks: usStocks,
                indices: marketIndices
            };
        }
    };
})();

// Make DTIData available globally
window.DTIData = DTIData;