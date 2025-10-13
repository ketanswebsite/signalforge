/**
 * DTI Backtester - UI Stock Selector Module
 * Handles stock and index selection, data fetching, and batch processing
 */

// Create StockSelector namespace
DTIUI.StockSelector = (function() {
    /**
     * Create a scan type selector for multi-index scanning
     * @returns {HTMLElement} The scan type selector element
     */
    function createScanTypeSelector() {
        const scanTypeSelectorDiv = document.createElement('div');
        scanTypeSelectorDiv.className = 'parameter-group';
        
        const scanTypeLabel = document.createElement('label');
        scanTypeLabel.htmlFor = 'scan-type-selector';
        scanTypeLabel.textContent = 'Scan Type';
        
        const scanTypeSelect = document.createElement('select');
        scanTypeSelect.id = 'scan-type-selector';
        
        // Add scan type options
        const scanTypes = [
            { value: 'current', text: 'Current Index Only' },
            { value: 'indian', text: 'All Indian Stocks (Nifty)' },
            { value: 'uk', text: 'All UK Stocks (FTSE)' },
            { value: 'us', text: 'All US Stocks' },
            { value: 'all', text: 'All Global Stocks' }
        ];
        
        scanTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.value;
            option.textContent = type.text;
            scanTypeSelect.appendChild(option);
        });
        
        // Add event listener for scan type change
        scanTypeSelect.addEventListener('change', function() {
            updateBatchButtonText();

            // Show/hide index selector based on scan type
            const indexSelectorDiv = document.getElementById('index-selector').parentNode;
            const stockSelectorDiv = document.getElementById('stock-selector').parentNode;

            if (this.value === 'current') {
                indexSelectorDiv.style.display = 'block';
                stockSelectorDiv.style.display = 'block';
            } else {
                indexSelectorDiv.style.display = 'none';
                stockSelectorDiv.style.display = 'none';
            }

            // Show notification for multi-index scans
            if (this.value !== 'current') {
                DTIBacktester.utils.showNotification(`Multi-index scan selected: ${this.options[this.selectedIndex].text}`, 'info');
            }
        });
        
        scanTypeSelectorDiv.appendChild(scanTypeLabel);
        scanTypeSelectorDiv.appendChild(scanTypeSelect);
        
        // Add help text
        const helpText = document.createElement('span');
        helpText.className = 'form-hint';
        helpText.textContent = 'Select which indices to scan for trading opportunities';
        scanTypeSelectorDiv.appendChild(helpText);
        
        return scanTypeSelectorDiv;
    }
    
    /**
     * Get stocks for the selected scan type
     * @returns {Array} Combined list of stocks based on scan type
     */
    function getStocksForSelectedScanType() {
        const scanTypeSelector = document.getElementById('scan-type-selector');
        if (!scanTypeSelector) return DTIData.getCurrentStockList();
        
        const scanType = scanTypeSelector.value;
        const stockLists = DTIData.getStockLists();
        
        switch(scanType) {
            case 'current':
                return DTIData.getCurrentStockList();
            case 'indian':
                return [
                    ...stockLists.nifty50,
                    ...stockLists.niftyNext50,
                    ...stockLists.niftyMidcap150
                ];
            case 'uk':
                return [
                    ...stockLists.ftse100,
                    ...stockLists.ftse250
                ];
            case 'us':
                return stockLists.usStocks;
            case 'all':
                return [
                    ...stockLists.nifty50,
                    ...stockLists.niftyNext50,
                    ...stockLists.niftyMidcap150,
                    ...stockLists.ftse100,
                    ...stockLists.ftse250,
                    ...stockLists.usStocks
                ];
            default:
                return DTIData.getCurrentStockList();
        }
    }
    
    /**
     * Update batch button text based on scan type
     */
    function updateBatchButtonText() {
        const batchButton = document.getElementById('batch-process-btn');
        if (!batchButton) return;
        
        const scanTypeSelector = document.getElementById('scan-type-selector');
        if (!scanTypeSelector) return;
        
        const scanType = scanTypeSelector.value;
        let buttonText = '';
        
        switch(scanType) {
            case 'current':
                const indexName = 
                    DTIBacktester.currentStockIndex === 'nifty50' ? 'Nifty 50' : 
                    DTIBacktester.currentStockIndex === 'niftyNext50' ? 'Nifty Next 50' : 
                    DTIBacktester.currentStockIndex === 'niftyMidcap150' ? 'Nifty Midcap 150' :
                    DTIBacktester.currentStockIndex === 'ftse100' ? 'FTSE 100' :
                    DTIBacktester.currentStockIndex === 'ftse250' ? 'FTSE 250' :
                    DTIBacktester.currentStockIndex === 'usStocks' ? 'US Stocks' :
                    DTIBacktester.currentStockIndex === 'indices' ? 'Market Indices' : 'Nifty 50';
                buttonText = `Scan All ${indexName}`;
                break;
            case 'indian':
                buttonText = 'Scan All Indian Stocks';
                break;
            case 'uk':
                buttonText = 'Scan All UK Stocks';
                break;
            case 'us':
                buttonText = 'Scan All US Stocks';
                break;
            case 'all':
                buttonText = 'Scan All Global Stocks';
                break;
            default:
                buttonText = 'Scan Selected Stocks';
        }
        
        batchButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="17 1 21 5 17 9"></polyline>
                <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                <polyline points="7 23 3 19 7 15"></polyline>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
            </svg>
            ${buttonText}
        `;
    }

    /**
     * Initialize the stock selector UI
     */
    function initStockSelector() {
        // Create scan type selector first (new addition)
        const scanTypeSelector = createScanTypeSelector();
        
        // Create index selector element
        const indexSelectorDiv = document.createElement('div');
        indexSelectorDiv.className = 'parameter-group';
        
        const indexLabel = document.createElement('label');
        indexLabel.htmlFor = 'index-selector';
        indexLabel.textContent = 'Select Stock Index';
        
        const indexSelect = document.createElement('select');
        indexSelect.id = 'index-selector';
        
        // Add index options
        const niftyOption = document.createElement('option');
        niftyOption.value = 'nifty50';
        niftyOption.textContent = 'Nifty 50 (India)';
        niftyOption.selected = true;
        indexSelect.appendChild(niftyOption);
        
        // Add Nifty Next 50 option
        const niftyNextOption = document.createElement('option');
        niftyNextOption.value = 'niftyNext50';
        niftyNextOption.textContent = 'Nifty Next 50 (India)';
        indexSelect.appendChild(niftyNextOption);
        
        const ftseOption = document.createElement('option');
        ftseOption.value = 'ftse100';
        ftseOption.textContent = 'FTSE 100 (UK)';
        indexSelect.appendChild(ftseOption);

        const ftse250Option = document.createElement('option');
        ftse250Option.value = 'ftse250';
        ftse250Option.textContent = 'FTSE 250 (UK)';
        indexSelect.appendChild(ftse250Option);

        const niftyMidcapOption = document.createElement('option');
        niftyMidcapOption.value = 'niftyMidcap150';
        niftyMidcapOption.textContent = 'Nifty Midcap 150 (India)';
        indexSelect.appendChild(niftyMidcapOption);

        // Add this new code right after
        const usStocksOption = document.createElement('option');
        usStocksOption.value = 'usStocks';
        usStocksOption.textContent = 'US Stocks (NYSE/NASDAQ)';
        indexSelect.appendChild(usStocksOption);
        
        // Add Market Indices option
        const indicesOption = document.createElement('option');
        indicesOption.value = 'indices';
        indicesOption.textContent = 'Market Indices';
        indexSelect.appendChild(indicesOption);
        
        // Add event listener for index change
        indexSelect.addEventListener('change', function() {
            DTIBacktester.currentStockIndex = this.value;
            updateStockSelector();
            updateBatchButtonText(); // Update batch button text when index changes
            
            // Update index tabs if they exist
            const indexTabs = document.querySelectorAll('.index-tab');
            indexTabs.forEach(tab => {
                if (tab.getAttribute('data-index') === DTIBacktester.currentStockIndex) {
                    tab.classList.add('active');
                } else {
                    tab.classList.remove('active');
                }
            });
            
            // Show relevant content
            const indexContents = document.querySelectorAll('.index-content');
            indexContents.forEach(content => {
                content.style.display = 'none';
            });

            const selectedContent = document.getElementById(`${DTIBacktester.currentStockIndex}-content`);
            if (selectedContent) {
                selectedContent.style.display = 'block';
            }
        });
        
        indexSelectorDiv.appendChild(indexLabel);
        indexSelectorDiv.appendChild(indexSelect);
        
        // Create stock selector element
        const stockSelectorDiv = document.createElement('div');
        stockSelectorDiv.className = 'parameter-group';
        
        const label = document.createElement('label');
        label.htmlFor = 'stock-selector';
        label.textContent = 'Select Stock';
        
        const select = document.createElement('select');
        select.id = 'stock-selector';
        
        stockSelectorDiv.appendChild(label);
        stockSelectorDiv.appendChild(select);
        
        // Populate the stock selector
        populateStockSelector(select);
        
        // Create fetch button
        const fetchButton = document.createElement('button');
        fetchButton.id = 'fetch-data-btn';
        fetchButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Fetch Stock Data
        `;

        // Add event listener for fetch button
        fetchButton.addEventListener('click', async function() {
            const symbol = select.value;
            
            if (!symbol) {
                DTIBacktester.utils.showNotification('Please select a stock first', 'warning');
                return;
            }
            
            // Prevent multiple clicks
            if (DTIBacktester.isProcessing) {
                DTIBacktester.utils.showNotification('Data fetching in progress, please wait', 'info');
                return;
            }
            
            DTIBacktester.isProcessing = true;
            
            // Show loading state
            this.disabled = true;
            this.innerHTML = `
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
                Fetching Data...
            `;
            
            try {
                // Get period from selector
                const periodSelector = document.getElementById('period-selector');
                const period = periodSelector ? periodSelector.value : '5y';
                
                // Find stock name for notification
                const stockList = DTIData.getCurrentStockList();
                const selectedStock = stockList.find(stock => stock.symbol === symbol);
                const stockName = selectedStock ? selectedStock.name : symbol;
                
                // Fetch stock data 
                const data = await DTIData.fetchStockData(symbol, period);
                
                if (!data) {
                    throw new Error('Failed to fetch stock data');
                }
                
                // Convert to CSV
                const csvString = DTIData.arrayToCSV(data);
                
                // Create a Blob and File object
                const blob = new Blob([csvString], { type: 'text/csv' });
                const file = new File([blob], `${symbol}.csv`, { type: 'text/csv' });
                
                // Create a FileList-like object
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                
                // Set the file input's files
                const fileInput = document.getElementById('csv-upload');
                fileInput.files = dataTransfer.files;
                
                // Trigger the file change event
                const event = new Event('change');
                fileInput.dispatchEvent(event);
                
                // Run the backtest
                document.getElementById('process-btn').click();
                
                // Show success notification
                DTIBacktester.utils.showNotification(`Data for ${stockName} loaded successfully`, 'success');
                
            } catch (error) {
                DTIBacktester.utils.showNotification(`Error: ${error.message}`, 'error');
            } finally {
                // Reset button state
                this.disabled = false;
                this.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Fetch Stock Data
                `;
                DTIBacktester.isProcessing = false;
            }
        });
        
        stockSelectorDiv.appendChild(fetchButton);
        
        // Add the period selector
        const periodDiv = document.createElement('div');
        periodDiv.className = 'parameter-group';
        
        const periodLabel = document.createElement('label');
        periodLabel.htmlFor = 'period-selector';
        periodLabel.textContent = 'Data Period';
        
        const periodSelect = document.createElement('select');
        periodSelect.id = 'period-selector';
        
        // Add period options
        const periods = [
            { value: '1mo', text: '1 Month' },
            { value: '3mo', text: '3 Months' },
            { value: '6mo', text: '6 Months' },
            { value: '1y', text: '1 Year' },
            { value: '2y', text: '2 Years' },
            { value: '5y', text: '5 Years' },
            { value: 'max', text: 'Max Available' }
        ];
        
        periods.forEach(period => {
            const option = document.createElement('option');
            option.value = period.value;
            option.textContent = period.text;
            if (period.value === '5y') {
                option.selected = true;
            }
            periodSelect.appendChild(option);
        });
        
        periodDiv.appendChild(periodLabel);
        periodDiv.appendChild(periodSelect);

        // Append elements to the Data Import section
        const dataImportSection = document.querySelector('.sidebar-section:last-child .param-controls');

        // Add scan type selector first, then index selector, then stock selector
        dataImportSection.insertBefore(scanTypeSelector, dataImportSection.firstChild);
        dataImportSection.insertBefore(indexSelectorDiv, dataImportSection.firstChild);
        dataImportSection.insertBefore(stockSelectorDiv, dataImportSection.firstChild);
        dataImportSection.insertBefore(periodDiv, stockSelectorDiv.nextSibling);
        
        // Add batch process button
        addBatchProcessButton();
        
        // Create status indicator
        const statusDiv = document.createElement('div');
        statusDiv.id = 'data-fetch-status';
        statusDiv.className = 'csv-info';
        statusDiv.style.display = 'none';

        dataImportSection.appendChild(statusDiv);
        
        // Add spinner animation style
        
    }

    /**
     * Helper function to populate the stock selector based on current index
     * @param {HTMLElement} selectElement - The select element to populate
     */
    function populateStockSelector(selectElement) {
        // Clear existing options
        selectElement.innerHTML = '';
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a stock...';
        selectElement.appendChild(defaultOption);
        
        // Get current stock list
        const stockList = DTIData.getCurrentStockList();
        
        // Add stocks from the current index
        stockList.forEach(stock => {
            const option = document.createElement('option');
            option.value = stock.symbol;
            option.textContent = stock.name;
            selectElement.appendChild(option);
        });
    }

    /**
     * Update the stock selector when the index changes
     */
    function updateStockSelector() {
        const stockSelector = document.getElementById('stock-selector');
        if (stockSelector) {
            populateStockSelector(stockSelector);
        }
        
        // Update batch process button text
        updateBatchButtonText();
        
        // MODIFIED: Only clear opportunities if not viewing details from opportunities list
        if (!DTIUI.isViewingOpportunityDetails) {
            const opportunitiesContainer = document.getElementById('buying-opportunities');
            if (opportunitiesContainer) {
                opportunitiesContainer.innerHTML = `
                    <h3 class="card-title">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="14 2 18 6 7 17 3 17 3 13 14 2"></polygon>
                            <line x1="3" y1="22" x2="21" y2="22"></line>
                        </svg>
                        Current Buying Opportunities
                    </h3>
                    <p class="no-opportunities">No active buying opportunities found. Try adjusting parameters or running a full scan.</p>
                `;
            }
        }
    }

    /**
     * Add a "Batch Process" button
     */
    function addBatchProcessButton() {
        // Create button
        const batchButton = document.createElement('button');
        batchButton.id = 'batch-process-btn';
        const indexName = 
            DTIBacktester.currentStockIndex === 'nifty50' ? 'Nifty 50' : 
            DTIBacktester.currentStockIndex === 'niftyNext50' ? 'Nifty Next 50' : 
            DTIBacktester.currentStockIndex === 'niftyMidcap150' ? 'Nifty Midcap 150' :
            DTIBacktester.currentStockIndex === 'ftse100' ? 'FTSE 100' :
            DTIBacktester.currentStockIndex === 'ftse250' ? 'FTSE 250' :
            DTIBacktester.currentStockIndex === 'usStocks' ? 'US Stocks' :
            DTIBacktester.currentStockIndex === 'indices' ? 'Market Indices' : 'Nifty 50';            
        batchButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="17 1 21 5 17 9"></polyline>
                <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                <polyline points="7 23 3 19 7 15"></polyline>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
            </svg>
            Scan All ${indexName}
        `;

        // Add event listener
batchButton.addEventListener('click', async function() {
    if (DTIBacktester.isProcessing) {
        DTIBacktester.utils.showNotification('Scan already in progress, please wait', 'info');
        return;
    }
    
    this.disabled = true;
    
    // Get scan type and update text accordingly
    const scanTypeSelector = document.getElementById('scan-type-selector');
    const scanType = scanTypeSelector ? scanTypeSelector.value : 'current';
    const scanTypeName = scanTypeSelector ? scanTypeSelector.options[scanTypeSelector.selectedIndex].text : 'Current Index';
    
    // Override the stock list in DTIData temporarily for multi-index scan
    const originalGetCurrentStockList = DTIData.getCurrentStockList;
    
    if (scanType !== 'current') {
        // Override the getCurrentStockList method for multi-index scanning
        DTIData.getCurrentStockList = getStocksForSelectedScanType;
        DTIBacktester.utils.showNotification(`Preparing to scan ${scanTypeName}...`, 'info');
    }
    
    // Set button loading state
    this.innerHTML = `
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
        Processing ${scanTypeName}...
    `;
    
    try {
        // Store original index for restoration after scan
        const originalIndex = DTIBacktester.currentStockIndex;
        
        // Reset the active trade opportunities
        DTIBacktester.activeTradeOpportunities = [];
        
        // Perform the batch scan
        await DTIData.fetchAllStocksData();
        
        
        // Restore original getCurrentStockList method
        if (scanType !== 'current') {
            DTIData.getCurrentStockList = originalGetCurrentStockList;
            DTIBacktester.currentStockIndex = originalIndex;
        }
        
        // Show the performance modal with previous month's results
        if (DTIBacktester.allStocksData && DTIBacktester.allStocksData.length > 0) {
            // Determine the display name based on scan type
            const indexName = 
                DTIBacktester.currentStockIndex === 'nifty50' ? 'Nifty 50' : 
                DTIBacktester.currentStockIndex === 'niftyNext50' ? 'Nifty Next 50' : 
                DTIBacktester.currentStockIndex === 'niftyMidcap150' ? 'Nifty Midcap 150' :
                DTIBacktester.currentStockIndex === 'ftse100' ? 'FTSE 100' :
                DTIBacktester.currentStockIndex === 'ftse250' ? 'FTSE 250' :
                DTIBacktester.currentStockIndex === 'usStocks' ? 'US Stocks' :
                DTIBacktester.currentStockIndex === 'indices' ? 'Market Indices' : 'Selected Stocks';
            
            const displayName = scanType === 'current' ? indexName : scanTypeName;
            
            // Show the performance modal
            if (typeof DTIUI.PerformanceModal !== 'undefined' && 
                typeof DTIUI.PerformanceModal.showPerformanceModal === 'function') {
                DTIUI.PerformanceModal.showPerformanceModal(DTIBacktester.allStocksData, displayName);
            }
        }
        
        // Explicitly call the display function after a short delay
        setTimeout(() => {
            if (typeof DTIUI.TradeDisplay !== 'undefined' && 
                typeof DTIUI.TradeDisplay.displayBuyingOpportunities === 'function') {
                DTIUI.TradeDisplay.displayBuyingOpportunities();
            } else {
            }
        }, 500);
        
        // Update the UI to show the scan completed for the selected scan type
        DTIBacktester.utils.showNotification(`${scanTypeName} scan completed with ${DTIBacktester.activeTradeOpportunities.length} opportunities found`, 'success');
    } catch (error) {
        DTIBacktester.utils.showNotification('Error processing stocks: ' + error.message, 'error');
        
        // Restore original getCurrentStockList method on error
        if (scanType !== 'current') {
            DTIData.getCurrentStockList = originalGetCurrentStockList;
        }
    } finally {
        this.disabled = false;
        // Update button text after scan
        updateBatchButtonText();
    }
});

        
        // Add batch status indicator
        const batchStatus = document.createElement('div');
        batchStatus.id = 'batch-status';
        batchStatus.className = 'batch-status';
        batchStatus.style.display = 'none';

        // Append button to the UI
        const dataImportSection = document.querySelector('.sidebar-section:last-child .param-controls');
        if (dataImportSection) {
            dataImportSection.appendChild(batchButton);
            dataImportSection.appendChild(batchStatus);
        }
    }

    // Export public functions
    return {
        initStockSelector,
        populateStockSelector,
        updateStockSelector,
        getStocksForSelectedScanType
    };
})();