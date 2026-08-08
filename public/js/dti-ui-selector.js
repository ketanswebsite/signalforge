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
        scanTypeSelectorDiv.className = 'sa-field';

        const scanTypeLabel = document.createElement('label');
        scanTypeLabel.htmlFor = 'scan-type-selector';
        scanTypeLabel.className = 'sa-field__label';
        scanTypeLabel.textContent = 'Watchlist';

        const scanTypeSelect = document.createElement('select');
        scanTypeSelect.id = 'scan-type-selector';
        scanTypeSelect.className = 'sa-select';

        // Add scan type options
        const scanTypes = [
            { value: 'indian', text: 'Every Indian stock (2,187)' },
            { value: 'uk', text: 'Every UK stock (842)' },
            { value: 'us', text: 'Every US stock (2,000)' },
            { value: 'all', text: 'All three markets (5,029)' }
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
        helpText.className = 'sa-field__hint';
        helpText.textContent = 'Which market the scan checks. Every stock in it gets tested.';
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

        // One label, always. The watchlist select says what gets scanned.
        batchButton.replaceChildren();
        const icon = document.createElement('span');
        icon.className = 'material-symbols-rounded';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = 'play_arrow';
        batchButton.appendChild(icon);
        batchButton.appendChild(document.createTextNode(' Run the scan'));
    }

    /**
     * Initialize the stock selector UI
     */
    function initStockSelector() {
        // Create scan type selector
        const scanTypeSelector = createScanTypeSelector();

        // Append scan type selector to container
        const scanTypeContainer = document.getElementById('stock-index-selector-container');
        if (scanTypeContainer) {
            scanTypeContainer.appendChild(scanTypeSelector);
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
        batchButton.className = 'sa-btn sa-btn--primary';
        batchButton.innerHTML = `
            <span class="material-symbols-rounded" aria-hidden="true">play_arrow</span>
            Run the scan
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
        <span class="sa-btn__spin" aria-hidden="true"></span>
        Checking…
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

        // Button goes in the page head; the progress block gets its own row below
        const batchContainer = document.getElementById('batch-process-container');
        const statusContainer = document.getElementById('data-fetch-status');

        if (batchContainer) {
            batchContainer.appendChild(batchButton);
        }
        if (statusContainer) {
            statusContainer.appendChild(batchStatus);
        } else if (batchContainer) {
            batchContainer.appendChild(batchStatus);
        }
    }

    // Export public functions
    return {
        initStockSelector,
        getStocksForSelectedScanType
    };
})();