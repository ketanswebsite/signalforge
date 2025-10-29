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
            { value: 'indian', text: 'All Indian Stocks (2,187 stocks)' },
            { value: 'uk', text: 'All UK Stocks (842 stocks)' },
            { value: 'us', text: 'All US Stocks (2,000 stocks)' },
            { value: 'all', text: 'All Global Stocks (5,029 stocks)' }
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
            DTIBacktester.utils.showNotification(`Market selected: ${this.options[this.selectedIndex].text}`, 'info');
        });
        
        scanTypeSelectorDiv.appendChild(scanTypeLabel);
        scanTypeSelectorDiv.appendChild(scanTypeSelect);
        
        // Add help text
        const helpText = document.createElement('span');
        helpText.className = 'form-hint';
        helpText.textContent = 'Select which market to scan for trading opportunities';
        scanTypeSelectorDiv.appendChild(helpText);
        
        return scanTypeSelectorDiv;
    }
    
    /**
     * Get stocks for the selected scan type
     * @returns {Array} Combined list of stocks based on scan type
     */
    function getStocksForSelectedScanType() {
        const scanTypeSelector = document.getElementById('scan-type-selector');
        if (!scanTypeSelector) return [];

        const scanType = scanTypeSelector.value;
        const stockLists = DTIData.getStockLists();

        switch(scanType) {
            case 'indian':
                // Complete NSE list - 2,187 stocks
                return stockLists.allIndian || stockLists.nifty50;
            case 'uk':
                // Complete LSE list (validated) - 842 stocks
                return stockLists.allUK || stockLists.ftse100;
            case 'us':
                // US stocks - 2,000 stocks
                return stockLists.usStocks;
            case 'all':
                // All global stocks - 5,029 stocks (2,187 + 842 + 2,000)
                return [
                    ...(stockLists.allIndian || stockLists.nifty50),
                    ...(stockLists.allUK || stockLists.ftse100),
                    ...stockLists.usStocks
                ];
            default:
                return [];
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
                buttonText = 'Scan Stocks';
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
        // Create scan type selector
        const scanTypeSelector = createScanTypeSelector();

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

        // Append elements to the new scan control panel containers
        const scanTypeContainer = document.getElementById('stock-index-selector-container');
        const periodContainer = document.getElementById('period-selector-container');

        // Add scan type selector and period selector to their respective containers
        if (scanTypeContainer) {
            scanTypeContainer.appendChild(scanTypeSelector);
        }

        if (periodContainer) {
            periodContainer.appendChild(periodDiv);
        }

        // Add batch process button
        addBatchProcessButton();
    }


    /**
     * Add a "Batch Process" button
     */
    function addBatchProcessButton() {
        // Create button
        const batchButton = document.createElement('button');
        batchButton.id = 'batch-process-btn';
        batchButton.className = 'btn btn-primary';
        batchButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="17 1 21 5 17 9"></polyline>
                <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                <polyline points="7 23 3 19 7 15"></polyline>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
            </svg>
            Scan All Indian Stocks
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
    const scanType = scanTypeSelector ? scanTypeSelector.value : 'indian';
    const scanTypeName = scanTypeSelector ? scanTypeSelector.options[scanTypeSelector.selectedIndex].text : 'All Indian Stocks';

    // Override the stock list in DTIData for market-wise scanning
    const originalGetCurrentStockList = DTIData.getCurrentStockList;
    DTIData.getCurrentStockList = getStocksForSelectedScanType;
    DTIBacktester.utils.showNotification(`Preparing to scan ${scanTypeName}...`, 'info');

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
        // Reset the active trade opportunities
        DTIBacktester.activeTradeOpportunities = [];

        // Perform the batch scan
        await DTIData.fetchAllStocksData();

        // Restore original getCurrentStockList method
        DTIData.getCurrentStockList = originalGetCurrentStockList;

        // Show the performance modal with previous month's results
        if (DTIBacktester.allStocksData && DTIBacktester.allStocksData.length > 0) {
            // Show the performance modal
            if (typeof DTIUI.PerformanceModal !== 'undefined' &&
                typeof DTIUI.PerformanceModal.showPerformanceModal === 'function') {
                DTIUI.PerformanceModal.showPerformanceModal(DTIBacktester.allStocksData, scanTypeName);
            }
        }

        // Explicitly call the display function after a short delay
        setTimeout(() => {
            if (typeof DTIUI.TradeDisplay !== 'undefined' &&
                typeof DTIUI.TradeDisplay.displayBuyingOpportunities === 'function') {
                DTIUI.TradeDisplay.displayBuyingOpportunities();
            }
        }, 500);

        // Update the UI to show the scan completed for the selected scan type
        DTIBacktester.utils.showNotification(`${scanTypeName} scan completed with ${DTIBacktester.activeTradeOpportunities.length} opportunities found`, 'success');
    } catch (error) {
        DTIBacktester.utils.showNotification('Error processing stocks: ' + error.message, 'error');

        // Restore original getCurrentStockList method on error
        DTIData.getCurrentStockList = originalGetCurrentStockList;
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

        // Append button to the new batch process container
        const batchContainer = document.getElementById('batch-process-container');
        const statusContainer = document.getElementById('data-fetch-status');

        if (batchContainer) {
            batchContainer.appendChild(batchButton);
            batchContainer.appendChild(batchStatus);
        }
    }

    // Export public functions
    return {
        initStockSelector,
        getStocksForSelectedScanType
    };
})();