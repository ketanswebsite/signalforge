/**
 * Enhanced Trade Import Functionality
 * This module provides a more robust solution for importing trades from PostgreSQL database
 * with better error handling, validation, and user feedback.
 * Note: JSON file import is no longer supported.
 */

// TradeImporter object with improved functionality
const TradeImporter = (function() {
    // Private variables
    let importData = null;
    let validationErrors = [];
    let processingStatus = {
        total: 0,
        processed: 0,
        added: 0,
        updated: 0,
        errors: 0,
        skipped: 0
    };
    
    // DOM element references
    let dialogElement = null;
    let fileInputElement = null;
    let previewElement = null;
    let statusElement = null;
    let progressElement = null;
    let confirmButton = null;
    let selectedFilenameElement = null;
    
    /**
     * Initialize the importer
     */
    function init() {
        console.log("TradeImporter initializing...");
        
        // Get dialog elements
        dialogElement = document.getElementById('import-trades-dialog');
        
        if (!dialogElement) {
            console.error("Import dialog not found, creating one");
            createImportDialog();
            dialogElement = document.getElementById('import-trades-dialog');
        }
        
        // Get other elements
        fileInputElement = document.getElementById('import-file-input');
        previewElement = document.getElementById('import-preview');
        statusElement = document.getElementById('import-status');
        progressElement = document.getElementById('import-progress');
        confirmButton = document.getElementById('import-dialog-confirm');
        selectedFilenameElement = document.getElementById('selected-filename');
        
        // Set up event listeners
        setupEventListeners();
        
        console.log("TradeImporter initialized successfully");
    }
    
    /**
     * Create import dialog if it doesn't exist
     */
    function createImportDialog() {
        const dialogOverlay = document.createElement('div');
        dialogOverlay.id = 'import-trades-dialog';
        dialogOverlay.className = 'dialog-overlay';
        
        dialogOverlay.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3 class="dialog-title">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        Import Trades
                    </h3>
                    <button class="dialog-close" id="import-dialog-x" aria-label="Close dialog">&times;</button>
                </div>
                <div class="dialog-body">
                    <p>Import trades from a JSON file. This will allow you to restore your trades if you clear your browser data.</p>
                    
                    <div class="file-upload-container">
                        <label for="import-file-input" class="file-upload-label">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                                <polyline points="13 2 13 9 20 9"></polyline>
                            </svg>
                            <span>Choose File</span>
                        </label>
                        <input type="file" id="import-file-input" accept=".json" style="display: none;">
                        <span id="selected-filename">No file selected</span>
                    </div>
                    
                    <div id="validation-errors" class="validation-errors" style="display: none;">
                        <h4>Validation Errors</h4>
                        <ul id="errors-list"></ul>
                    </div>
                    
                    <div id="import-preview" class="import-preview" style="display: none;">
                        <h4>File Preview</h4>
                        <div class="preview-stats">
                            <div class="preview-stat">
                                <span class="preview-label">Total Trades:</span>
                                <span id="preview-total" class="preview-value">0</span>
                            </div>
                            <div class="preview-stat">
                                <span class="preview-label">Active Trades:</span>
                                <span id="preview-active" class="preview-value">0</span>
                            </div>
                            <div class="preview-stat">
                                <span class="preview-label">Closed Trades:</span>
                                <span id="preview-closed" class="preview-value">0</span>
                            </div>
                            <div class="preview-stat">
                                <span class="preview-label">Export Date:</span>
                                <span id="preview-date" class="preview-value">-</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="import-options">
                        <h4>Import Options</h4>
                        <div class="radio-option">
                            <input type="radio" id="import-mode-merge" name="import-mode" value="merge" checked>
                            <label for="import-mode-merge">Merge with existing trades (update existing, add new)</label>
                        </div>
                        <div class="radio-option">
                            <input type="radio" id="import-mode-add" name="import-mode" value="add">
                            <label for="import-mode-add">Add all as new trades (avoids conflicts)</label>
                        </div>
                        <div class="radio-option">
                            <input type="radio" id="import-mode-replace" name="import-mode" value="replace">
                            <label for="import-mode-replace">Replace all trades</label>
                        </div>
                        <div class="checkbox-option" id="keep-active-container" style="margin-left: 25px; margin-top: 8px; display: none;">
                            <input type="checkbox" id="keep-active-trades" name="keep-active-trades" checked>
                            <label for="keep-active-trades">Keep current active trades</label>
                        </div>
                        
                        <div class="checkbox-option" style="margin-top: 15px;">
                            <input type="checkbox" id="fix-dates" name="fix-dates" checked>
                            <label for="fix-dates">Attempt to fix invalid dates</label>
                        </div>
                        <div class="checkbox-option">
                            <input type="checkbox" id="validate-fields" name="validate-fields" checked>
                            <label for="validate-fields">Validate and fix missing fields</label>
                        </div>
                    </div>
                    
                    <div id="import-status" class="import-status" style="display: none;">
                        <div class="status-message" id="import-status-message"></div>
                        <div class="progress-bar">
                            <div class="progress-fill" id="import-progress"></div>
                        </div>
                    </div>
                </div>
                <div class="dialog-actions">
                    <button id="import-dialog-cancel" class="btn-secondary">Cancel</button>
                    <button id="import-dialog-confirm" class="btn-primary" disabled>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        Import Trades
                    </button>
                </div>
            </div>
        `;
        
        // Append to the body
        document.body.appendChild(dialogOverlay);
    }
    
    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        if (!dialogElement) return;
        
        // File input change event
        if (fileInputElement) {
            fileInputElement.addEventListener('change', function(event) {
                handleFileSelected(event);
            });
        }
        
        // Import mode radio buttons
        const radioButtons = document.querySelectorAll('input[name="import-mode"]');
        if (radioButtons.length > 0) {
            radioButtons.forEach(radio => {
                radio.addEventListener('change', function() {
                    // Show/hide keep active trades option
                    const keepActiveContainer = document.getElementById('keep-active-container');
                    if (keepActiveContainer) {
                        keepActiveContainer.style.display = this.value === 'replace' ? 'block' : 'none';
                    }
                });
            });
        }
        
        // Close buttons
        const closeBtn = document.getElementById('import-dialog-x');
        const cancelBtn = document.getElementById('import-dialog-cancel');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                closeDialog();
            });
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                closeDialog();
            });
        }
        
        // Import button
        if (confirmButton) {
            confirmButton.addEventListener('click', function() {
                startImport();
            });
        }
        
        // Close on background click
        dialogElement.addEventListener('click', function(e) {
            if (e.target === dialogElement) {
                closeDialog();
            }
        });
        
        // Add escape key handler
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && dialogElement.classList.contains('active')) {
                closeDialog();
            }
        });
    }
    
    /**
     * Handle file selection
     * @param {Event} event - File input change event
     */
    function handleFileSelected(event) {
        resetValidation();
        
        const file = event.target.files[0];
        if (!file) {
            selectedFilenameElement.textContent = 'No file selected';
            previewElement.style.display = 'none';
            confirmButton.disabled = true;
            return;
        }
        
        selectedFilenameElement.textContent = file.name;
        
        // Show loading status
        showStatus('Reading file...', 10);
        
        // Read and validate the file
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const jsonString = e.target.result;
                // First try parsing the JSON
                importData = parseJSON(jsonString);
                
                if (!importData) {
                    showValidationError('Invalid JSON format. The file could not be parsed.');
                    hideStatus();
                    return;
                }
                
                // Validate the structure
                const validationResult = validateImportData(importData);
                
                if (!validationResult.valid) {
                    showValidationErrors(validationResult.errors);
                    
                    // Check if we can still proceed with warnings
                    if (validationResult.canProceed) {
                        showStatus('File has issues but can be imported with warnings', 30);
                        confirmButton.disabled = false;
                    } else {
                        showStatus('File cannot be imported due to critical errors', 100, 'error');
                        confirmButton.disabled = true;
                    }
                } else {
                    // Update preview with file info
                    updatePreview(importData);
                    showStatus('File validation successful', 100, 'success');
                    setTimeout(hideStatus, 1500);
                    confirmButton.disabled = false;
                }
            } catch (error) {
                console.error('Error processing import file:', error);
                showValidationError('Error processing file: ' + error.message);
                showStatus('Error processing file', 100, 'error');
                confirmButton.disabled = true;
            }
        };
        
        reader.onerror = function() {
            console.error('Error reading file');
            showValidationError('Error reading file. Please try again with a different file.');
            showStatus('Error reading file', 100, 'error');
            confirmButton.disabled = true;
        };
        
        reader.readAsText(file);
    }
    
    /**
     * Parse JSON string with error handling
     * @param {string} jsonString - JSON string to parse
     * @returns {Object|null} - Parsed object or null if error
     */
    function parseJSON(jsonString) {
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            console.error('Error parsing JSON:', error);
            return null;
        }
    }
    
    /**
     * Validate import data structure and content
     * @param {Object} data - Data to validate
     * @returns {Object} - Validation result with errors and whether to proceed
     */
    function validateImportData(data) {
        const errors = [];
        let canProceed = true;
        
        // Check for basic structure
        if (!data) {
            errors.push('Import data is empty or null');
            canProceed = false;
        } else {
            // Check for metadata
            if (!data.metadata) {
                errors.push('Missing metadata section (warning: will use defaults)');
                // We can still proceed without metadata
            } else {
                // Check metadata fields if present
                if (!data.metadata.version) {
                    errors.push('Missing metadata.version (warning: will use current version)');
                }
                
                if (!data.metadata.exportDate) {
                    errors.push('Missing metadata.exportDate (warning: will use current date)');
                }
            }
            
            // Check for trades array (critical)
            if (!data.trades) {
                errors.push('Missing trades array (critical: cannot proceed)');
                canProceed = false;
            } else if (!Array.isArray(data.trades)) {
                errors.push('Trades property is not an array (critical: cannot proceed)');
                canProceed = false;
            } else if (data.trades.length === 0) {
                errors.push('Trades array is empty (warning: nothing to import)');
                // We can still proceed with empty trades, though it's pointless
            } else {
                // Validate the first trade as a sample
                const sampleTrade = data.trades[0];
                
                // Check required fields
                const requiredFields = ['stockName', 'symbol', 'entryPrice', 'status'];
                const missingFields = requiredFields.filter(field => !(field in sampleTrade));
                
                if (missingFields.length > 0) {
                    errors.push(`Missing required fields in trade: ${missingFields.join(', ')} (warning: will attempt to fix)`);
                    // We can try to fix missing fields
                }
                
                // Check if all trades have IDs
                const missingIdCount = data.trades.filter(trade => !trade.id).length;
                if (missingIdCount > 0) {
                    errors.push(`${missingIdCount} trades missing ID (warning: will generate new IDs)`);
                    // We can generate IDs
                }
                
                // Check for date fields
                const dateFields = ['entryDate', 'exitDate', 'squareOffDate'];
                dateFields.forEach(field => {
                    const invalidDateCount = data.trades.filter(
                        trade => trade[field] && isInvalidDate(trade[field])
                    ).length;
                    
                    if (invalidDateCount > 0) {
                        errors.push(`${invalidDateCount} trades have invalid ${field} (warning: will attempt to fix)`);
                        // We can try to fix dates
                    }
                });
            }
        }
        
        // Store validation errors
        validationErrors = errors;
        
        return {
            valid: errors.length === 0,
            errors: errors,
            canProceed: canProceed
        };
    }
    
    /**
     * Check if a date string or object is invalid
     * @param {string|Object} dateValue - Date value to check
     * @returns {boolean} - True if date is invalid
     */
    function isInvalidDate(dateValue) {
        if (!dateValue) return true;
        
        if (typeof dateValue === 'string') {
            const date = new Date(dateValue);
            return isNaN(date.getTime());
        } else if (dateValue instanceof Date) {
            return isNaN(dateValue.getTime());
        }
        
        return true;
    }
    
    /**
     * Update preview with import data
     * @param {Object} data - Import data
     */
    function updatePreview(data) {
        if (!previewElement) return;
        
        previewElement.style.display = 'block';
        
        // Get active and closed trade counts
        const totalTrades = data.trades ? data.trades.length : 0;
        const activeTrades = data.trades ? data.trades.filter(t => t.status === 'active').length : 0;
        const closedTrades = data.trades ? data.trades.filter(t => t.status !== 'active').length : 0;
        
        // Update preview elements
        document.getElementById('preview-total').textContent = totalTrades;
        document.getElementById('preview-active').textContent = activeTrades;
        document.getElementById('preview-closed').textContent = closedTrades;
        
        // Format export date
        let exportDate = 'Unknown';
        if (data.metadata && data.metadata.exportDate) {
            const date = new Date(data.metadata.exportDate);
            if (!isNaN(date.getTime())) {
                exportDate = date.toLocaleString();
            } else {
                exportDate = data.metadata.exportDate; // Just use the raw value if not a valid date
            }
        }
        document.getElementById('preview-date').textContent = exportDate;
    }
    
    /**
     * Show validation errors in the UI
     * @param {Array} errors - Array of error messages
     */
    function showValidationErrors(errors) {
        const errorsContainer = document.getElementById('validation-errors');
        const errorsList = document.getElementById('errors-list');
        
        if (!errorsContainer || !errorsList) return;
        
        // Clear previous errors
        errorsList.innerHTML = '';
        
        // Add each error as a list item
        errors.forEach(error => {
            const li = document.createElement('li');
            
            // Highlight critical errors
            if (error.includes('critical')) {
                li.className = 'critical-error';
            }
            
            li.textContent = error;
            errorsList.appendChild(li);
        });
        
        // Show errors container
        errorsContainer.style.display = 'block';
    }
    
    /**
     * Show a single validation error
     * @param {string} errorMessage - Error message to show
     */
    function showValidationError(errorMessage) {
        showValidationErrors([errorMessage]);
    }
    
    /**
     * Reset validation state
     */
    function resetValidation() {
        const errorsContainer = document.getElementById('validation-errors');
        const errorsList = document.getElementById('errors-list');
        
        if (errorsContainer) errorsContainer.style.display = 'none';
        if (errorsList) errorsList.innerHTML = '';
        
        validationErrors = [];
    }
    
    /**
     * Show status message and update progress
     * @param {string} message - Status message
     * @param {number} progress - Progress percentage (0-100)
     * @param {string} type - Status type ('info', 'success', 'error')
     */
    function showStatus(message, progress, type = 'info') {
        if (!statusElement || !progressElement) return;
        
        // Show status container
        statusElement.style.display = 'block';
        
        // Update message
        const statusMessage = document.getElementById('import-status-message');
        if (statusMessage) {
            statusMessage.textContent = message;
            statusMessage.className = 'status-message'; // Reset class
            
            if (type === 'error') {
                statusMessage.classList.add('status-error');
            } else if (type === 'success') {
                statusMessage.classList.add('status-success');
            }
        }
        
        // Update progress bar
        progressElement.style.width = `${progress}%`;
        
        // Change progress bar color based on type
        if (type === 'error') {
            progressElement.style.backgroundColor = 'var(--danger-color)';
        } else if (type === 'success') {
            progressElement.style.backgroundColor = 'var(--success-color)';
        } else {
            progressElement.style.backgroundColor = 'var(--primary-color)';
        }
    }
    
    /**
     * Hide status container
     */
    function hideStatus() {
        if (statusElement) {
            statusElement.style.display = 'none';
        }
    }
    
    /**
     * Start the import process
     */
    function startImport() {
        if (!importData || !importData.trades) {
            showStatus('No valid import data', 100, 'error');
            return;
        }
        
        // Get import options
        const importMode = document.querySelector('input[name="import-mode"]:checked')?.value || 'merge';
        const keepActive = document.getElementById('keep-active-trades')?.checked || false;
        const fixDates = document.getElementById('fix-dates')?.checked || false;
        const validateFields = document.getElementById('validate-fields')?.checked || false;
        
        // Set loading state
        confirmButton.disabled = true;
        confirmButton.innerHTML = `
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
            Importing...
        `;
        
        // Show initial status
        showStatus('Preparing import...', 10);
        
        // Prepare options for processImport
        const options = {
            mode: importMode,
            keepActive: keepActive,
            fixDates: fixDates,
            validateFields: validateFields
        };
        
        // Process import in chunks to avoid blocking the UI
        setTimeout(() => {
            processImport(importData, options);
        }, 100);
    }
    
    /**
     * Process the import data
     * @param {Object} data - Import data
     * @param {Object} options - Import options
     */
    function processImport(data, options) {
        try {
            // Reset processing status
            processingStatus = {
                total: data.trades.length,
                processed: 0,
                added: 0,
                updated: 0,
                errors: 0,
                skipped: 0
            };
            
            // Pre-process trades if needed
            if (options.fixDates || options.validateFields) {
                showStatus('Pre-processing trades...', 20);
                data.trades = preProcessTrades(data.trades, options);
            }
            
            showStatus('Importing trades...', 40);
            
            // Call TradeCore's import function with processed data
            try {
                const results = TradeCore.importTradesFromJSON(data, {
                    mode: options.mode,
                    keepActive: options.keepActive
                });
                
                // Update processing status with results
                processingStatus.added = results.added || 0;
                processingStatus.updated = results.updated || 0;
                processingStatus.errors = results.errors || 0;
                processingStatus.processed = processingStatus.total;
                
                // Show success message
                showStatus(
                    `Import complete: Added ${results.added}, Updated ${results.updated}${results.errors > 0 ? `, Errors: ${results.errors}` : ''}`, 
                    100, 
                    results.errors > 0 ? 'warning' : 'success'
                );
                
                // Close dialog after short delay
                setTimeout(() => {
                    showNotification(`Imported ${processingStatus.total} trades (${processingStatus.added} new, ${processingStatus.updated} updated)`, 'success');
                    closeDialog();
                    
                    // Refresh UI if TradeUI is available
                    if (typeof TradeUI !== 'undefined') {
                        TradeUI.renderTrades();
                        TradeUI.updateStatistics();
                        TradeUI.refreshAllCharts();
                    }
                }, 1500);
            } catch (error) {
                console.error('Error during import:', error);
                showStatus(`Error importing trades: ${error.message}`, 100, 'error');
                
                // Reset confirm button after error
                resetConfirmButton();
            }
        } catch (error) {
            console.error('Error in import process:', error);
            showStatus(`Error in import process: ${error.message}`, 100, 'error');
            
            // Reset confirm button after error
            resetConfirmButton();
        }
    }
    
    /**
     * Pre-process trades to fix issues
     * @param {Array} trades - Trades to process
     * @param {Object} options - Processing options
     * @returns {Array} - Processed trades
     */
    function preProcessTrades(trades, options) {
        return trades.map(trade => {
            const processedTrade = { ...trade };
            
            // Fix missing IDs
            if (!processedTrade.id) {
                processedTrade.id = generateTradeId();
            }
            
            // Fix dates if needed
            if (options.fixDates) {
                if (processedTrade.entryDate) {
                    try {
                        processedTrade.entryDate = fixDateValue(processedTrade.entryDate);
                    } catch (e) {
                        processedTrade.entryDate = new Date(); // Fallback to current date
                    }
                } else {
                    processedTrade.entryDate = new Date(); // Default to current date
                }
                
                if (processedTrade.exitDate) {
                    try {
                        processedTrade.exitDate = fixDateValue(processedTrade.exitDate);
                    } catch (e) {
                        // For exit date, leave it undefined if invalid
                        delete processedTrade.exitDate;
                    }
                }
                
                if (processedTrade.squareOffDate) {
                    try {
                        processedTrade.squareOffDate = fixDateValue(processedTrade.squareOffDate);
                    } catch (e) {
                        // Default square off date to entry date + 30 days
                        const squareOffDate = new Date(processedTrade.entryDate);
                        squareOffDate.setDate(squareOffDate.getDate() + 30);
                        processedTrade.squareOffDate = squareOffDate;
                    }
                } else {
                    // Default square off date to entry date + 30 days
                    const squareOffDate = new Date(processedTrade.entryDate);
                    squareOffDate.setDate(squareOffDate.getDate() + 30);
                    processedTrade.squareOffDate = squareOffDate;
                }
            }
            
            // Validate and fix required fields
            if (options.validateFields) {
                // Check required fields
                if (!processedTrade.stockName) {
                    // Default to symbol if available
                    processedTrade.stockName = processedTrade.symbol || 'Unknown Stock';
                }
                
                if (!processedTrade.symbol) {
                    // Generate a symbol from stock name
                    processedTrade.symbol = processedTrade.stockName ? 
                        processedTrade.stockName.replace(/[^A-Z0-9]/gi, '').substring(0, 5).toUpperCase() : 
                        'UNKWN';
                }
                
                if (!processedTrade.status) {
                    // Default to active if no exit date, otherwise closed
                    processedTrade.status = processedTrade.exitDate ? 'closed' : 'active';
                }
                
                // Convert all numeric fields to numbers
                const numericFields = [
                    'entryPrice', 'exitPrice', 'currentPrice', 'stopLossPrice', 'targetPrice',
                    'investmentAmount', 'shares', 'plPercent', 'plValue', 'currentPLPercent',
                    'currentPLValue', 'currentValue', 'stopLossPercent', 'takeProfitPercent'
                ];
                
                numericFields.forEach(field => {
                    if (processedTrade[field] !== undefined) {
                        const value = parseFloat(processedTrade[field]);
                        processedTrade[field] = isNaN(value) ? 0 : value;
                    }
                });
                
                // Fix or set currency symbol
                if (!processedTrade.currencySymbol) {
                    if (typeof TradeCore !== 'undefined' && TradeCore.getCurrencySymbol) {
                        processedTrade.currencySymbol = TradeCore.getCurrencySymbol(processedTrade.symbol);
                    } else {
                        // Fallback logic for currency
                        if (processedTrade.symbol.endsWith('.L')) {
                            processedTrade.currencySymbol = '£';
                        } else if (processedTrade.symbol.includes('.NS')) {
                            processedTrade.currencySymbol = '₹';
                        } else if (!processedTrade.symbol.includes('.')) {
                            processedTrade.currencySymbol = '$';
                        } else {
                            processedTrade.currencySymbol = '₹';
                        }
                    }
                }
                
                // Calculate missing values for active trades
                if (processedTrade.status === 'active') {
                    // If entry price but no shares or investment
                    if (processedTrade.entryPrice && (!processedTrade.shares || !processedTrade.investmentAmount)) {
                        if (processedTrade.shares && !processedTrade.investmentAmount) {
                            processedTrade.investmentAmount = processedTrade.shares * processedTrade.entryPrice;
                        } else if (processedTrade.investmentAmount && !processedTrade.shares) {
                            processedTrade.shares = processedTrade.investmentAmount / processedTrade.entryPrice;
                        } else {
                            // Default values
                            processedTrade.investmentAmount = 10000;
                            processedTrade.shares = processedTrade.investmentAmount / processedTrade.entryPrice;
                        }
                    }
                    
                    // Set current price to entry price if missing
                    if (!processedTrade.currentPrice) {
                        processedTrade.currentPrice = processedTrade.entryPrice;
                    }
                    
                    // Calculate P&L
                    processedTrade.currentValue = processedTrade.shares * processedTrade.currentPrice;
                    processedTrade.currentPLPercent = ((processedTrade.currentPrice - processedTrade.entryPrice) / processedTrade.entryPrice) * 100;
                    processedTrade.currentPLValue = processedTrade.currentValue - (processedTrade.shares * processedTrade.entryPrice);
                    
                    // Calculate stop loss and target prices if missing
                    if (!processedTrade.stopLossPrice) {
                        processedTrade.stopLossPercent = processedTrade.stopLossPercent || 5;
                        processedTrade.stopLossPrice = processedTrade.entryPrice * (1 - (processedTrade.stopLossPercent / 100));
                    }
                    
                    if (!processedTrade.targetPrice) {
                        processedTrade.takeProfitPercent = processedTrade.takeProfitPercent || 8;
                        processedTrade.targetPrice = processedTrade.entryPrice * (1 + (processedTrade.takeProfitPercent / 100));
                    }
                } else if (processedTrade.status === 'closed') {
                    // For closed trades, calculate P&L if missing
                    if (!processedTrade.plPercent && processedTrade.entryPrice && processedTrade.exitPrice) {
                        processedTrade.plPercent = ((processedTrade.exitPrice - processedTrade.entryPrice) / processedTrade.entryPrice) * 100;
                    }
                    
                    if (!processedTrade.plValue && processedTrade.shares && processedTrade.entryPrice && processedTrade.exitPrice) {
                        processedTrade.plValue = (processedTrade.shares * processedTrade.exitPrice) - (processedTrade.shares * processedTrade.entryPrice);
                    }
                    
                    // Set exit reason if missing
                    if (!processedTrade.exitReason) {
                        if (processedTrade.plPercent > 0) {
                            processedTrade.exitReason = 'Target Reached';
                        } else {
                            processedTrade.exitReason = 'Stop Loss Hit';
                        }
                    }
                }
            }
            
            return processedTrade;
        });
    }
    
    /**
     * Fix a date value
     * @param {string|Date} dateValue - Date value to fix
     * @returns {Date} - Fixed date
     */
    function fixDateValue(dateValue) {
        if (dateValue instanceof Date) {
            if (isNaN(dateValue.getTime())) {
                throw new Error('Invalid date object');
            }
            return dateValue;
        }
        
        if (typeof dateValue === 'string') {
            // Try multiple date formats
            const formats = [
                // ISO format
                (str) => new Date(str),
                // MM/DD/YYYY
                (str) => {
                    const parts = str.split('/');
                    if (parts.length === 3) {
                        return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
                    }
                    throw new Error('Invalid date format');
                },
                // DD/MM/YYYY
                (str) => {
                    const parts = str.split('/');
                    if (parts.length === 3) {
                        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                    }
                    throw new Error('Invalid date format');
                },
                // YYYY-MM-DD
                (str) => {
                    const parts = str.split('-');
                    if (parts.length === 3) {
                        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    }
                    throw new Error('Invalid date format');
                },
                // Unix timestamp (milliseconds)
                (str) => {
                    const timestamp = parseInt(str);
                    if (!isNaN(timestamp)) {
                        return new Date(timestamp);
                    }
                    throw new Error('Invalid timestamp');
                }
            ];
            
            // Try each format in order
            for (const format of formats) {
                try {
                    const date = format(dateValue);
                    if (!isNaN(date.getTime())) {
                        return date;
                    }
                } catch (e) {
                    // Continue to next format
                }
            }
        }
        
        // If all else fails, return current date
        throw new Error('Could not parse date');
    }
    
    /**
     * Generate a unique trade ID
     * @returns {string} - Unique ID
     */
    function generateTradeId() {
        return 'trade_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    }
    
    /**
     * Reset confirm button to initial state
     */
    function resetConfirmButton() {
        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Import Trades
            `;
        }
    }
    
    /**
     * Close the import dialog
     */
    function closeDialog() {
        if (dialogElement) {
            dialogElement.classList.remove('active');
            resetDialog();
        }
    }
    
    /**
     * Reset dialog to initial state
     */
    function resetDialog() {
        // Reset file input
        if (fileInputElement) fileInputElement.value = '';
        
        // Reset text
        if (selectedFilenameElement) selectedFilenameElement.textContent = 'No file selected';
        
        // Reset preview and status
        if (previewElement) previewElement.style.display = 'none';
        hideStatus();
        
        // Reset validation
        resetValidation();
        
        // Reset import data
        importData = null;
        
        // Reset confirm button
        resetConfirmButton();
        if (confirmButton) confirmButton.disabled = true;
        
        // Reset radio buttons to default
        const mergeMode = document.getElementById('import-mode-merge');
        if (mergeMode) mergeMode.checked = true;
        
        // Hide keep active option
        const keepActiveContainer = document.getElementById('keep-active-container');
        if (keepActiveContainer) keepActiveContainer.style.display = 'none';
        
        // Reset checkboxes
        const keepActive = document.getElementById('keep-active-trades');
        if (keepActive) keepActive.checked = true;
        
        const fixDates = document.getElementById('fix-dates');
        if (fixDates) fixDates.checked = true;
        
        const validateFields = document.getElementById('validate-fields');
        if (validateFields) validateFields.checked = true;
    }
    
    /**
     * Open the import dialog
     */
    function openDialog() {
        if (dialogElement) {
            resetDialog();
            dialogElement.classList.add('active');
        } else {
            console.error("Import dialog not found");
            init();
            setTimeout(openDialog, 100);
        }
    }
    
    /**
     * Show a notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type
     */
    function showNotification(message, type) {
        if (typeof TradeCore !== 'undefined' && typeof TradeCore.showNotification === 'function') {
            TradeCore.showNotification(message, type);
        } else if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
        } else {
            console.log(`[${type}] ${message}`);
            alert(message);
        }
    }
    
    // Add CSS styles for new UI elements
    function addStyles() {
        const styleElement = document.getElementById('trade-importer-styles');
        if (styleElement) return;  // Styles already added
        
        const style = document.createElement('style');
        style.id = 'trade-importer-styles';
        style.textContent = `
            /* Validation errors */
            .validation-errors {
                background-color: #fff5f5;
                border-left: 3px solid var(--danger-color);
                padding: 12px 15px;
                margin: 15px 0;
                border-radius: var(--radius-sm);
            }
            
            .validation-errors h4 {
                margin-top: 0;
                margin-bottom: 8px;
                color: var(--danger-color);
                font-size: 16px;
            }
            
            .validation-errors ul {
                margin: 0;
                padding-left: 20px;
            }
            
            .validation-errors li {
                margin-bottom: 6px;
                color: #666;
            }
            
            .validation-errors li.critical-error {
                color: var(--danger-color);
                font-weight: 500;
            }
            
            /* Status styling */
            .status-message {
                margin-bottom: 8px;
                font-size: 14px;
            }
            
            .status-message.status-error {
                color: var(--danger-color);
                font-weight: 500;
            }
            
            .status-message.status-success {
                color: var(--success-color);
                font-weight: 500;
            }
            
            /* Import preview enhancements */
            .import-preview {
                background-color: var(--primary-lightest);
                border-radius: var(--radius);
                padding: 15px;
                margin: 15px 0;
                box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            }
            
            .import-preview h4 {
                margin-top: 0;
                margin-bottom: 10px;
                font-size: 16px;
                color: var(--primary-color);
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .import-preview h4::before {
                content: '';
                display: inline-block;
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background-color: var(--primary-color);
            }
            
            /* Import options improvements */
            .import-options {
                margin: 20px 0;
                background-color: #f9fafb;
                padding: 15px;
                border-radius: var(--radius);
            }
            
            .import-options h4 {
                margin-top: 0;
                margin-bottom: 12px;
                font-size: 16px;
                color: var(--primary-color);
                border-bottom: 1px solid var(--border-color);
                padding-bottom: 8px;
            }
            
            /* Checkbox and radio option enhancements */
            .radio-option, .checkbox-option {
                display: flex;
                align-items: center;
                margin-bottom: 10px;
                font-size: 14px;
            }
            
            .radio-option input, .checkbox-option input {
                margin-right: 10px;
            }
            
            .radio-option label, .checkbox-option label {
                cursor: pointer;
            }
            
            /* Hover effect for options */
            .radio-option:hover, .checkbox-option:hover {
                background-color: rgba(0,0,0,0.02);
                border-radius: 4px;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // Initialize and add styles when loaded
    document.addEventListener('DOMContentLoaded', function() {
        addStyles();
    });
    
    // Return public API
    return {
        init,
        openDialog,
        closeDialog,
        showNotification
    };
})();

// Initialize when script is loaded
document.addEventListener('DOMContentLoaded', function() {
    TradeImporter.init();
    
    // Replace the existing import button click handler
    const importBtn = document.getElementById('btn-import-trades');
    if (importBtn) {
        importBtn.removeEventListener('click', window.openImportDialog);
        importBtn.addEventListener('click', function() {
            TradeImporter.openDialog();
        });
    }
});

// Export global method for opening the import dialog
window.openImportDialog = function() {
    TradeImporter.openDialog();
};
