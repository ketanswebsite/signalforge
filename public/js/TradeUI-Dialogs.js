/**
 * DTI Backtester - Dialogs UI Module
 * Handles all dialog creation, opening, and interactions
 */

// Create Dialogs module
window.TradeUIModules = window.TradeUIModules || {};
window.TradeUIModules.dialogs = (function() {
    /**
     * Initialize the dialogs module
     */
    function init() {
        // Initialization will happen in setupAllDialogs
    }
    
    /**
     * Setup all dialog functionality
     */
    function setupAllDialogs() {
        // Setup trade action dialogs
        setupCloseTradeDialog();
        setupEditTradeDialog();
        setupDeleteTradeDialog();
        setupClearHistoryDialog();
        
    }
    
    /**
     * Setup close trade dialog
     */
    function setupCloseTradeDialog() {
        const dialog = document.getElementById('close-trade-dialog');
        if (!dialog) return;
        
        // Setup close button
        const closeBtn = document.getElementById('close-dialog-x');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                dialog.classList.remove('active');
            });
        }
        
        // Setup cancel button
        const cancelBtn = document.getElementById('close-dialog-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                dialog.classList.remove('active');
            });
        }
        
        // Setup confirm button
        const confirmBtn = document.getElementById('close-dialog-confirm');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', function() {
                handleTradeClose();
            });
        }
        
        // Close on background click
        dialog.addEventListener('click', function(e) {
            if (e.target === dialog) {
                dialog.classList.remove('active');
            }
        });
        
        // Add escape key handler
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && dialog.classList.contains('active')) {
                dialog.classList.remove('active');
            }
        });
    }
    
    /**
     * Setup edit trade dialog
     */
    function setupEditTradeDialog() {
        const dialog = document.getElementById('edit-trade-dialog');
        if (!dialog) {
            createEditTradeDialog();
            return;
        }
        
        // Setup close button
        const closeBtn = document.getElementById('edit-dialog-x');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                dialog.classList.remove('active');
            });
        }
        
        // Setup cancel button
        const cancelBtn = document.getElementById('edit-dialog-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                dialog.classList.remove('active');
            });
        }
        
        // Setup confirm button
        const confirmBtn = document.getElementById('edit-dialog-confirm');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', function() {
                handleTradeEdit();
            });
        }
        
        // Close on background click
        dialog.addEventListener('click', function(e) {
            if (e.target === dialog) {
                dialog.classList.remove('active');
            }
        });
        
        // Add escape key handler
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && dialog.classList.contains('active')) {
                dialog.classList.remove('active');
            }
        });
    }
    
    /**
     * Create edit trade dialog dynamically if it doesn't exist in the HTML
     */
    function createEditTradeDialog() {
        const dialogOverlay = document.createElement('div');
        dialogOverlay.id = 'edit-trade-dialog';
        dialogOverlay.className = 'dialog-overlay';
        
        dialogOverlay.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3 class="dialog-title">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Edit Trade
                    </h3>
                    <button class="dialog-close" id="edit-dialog-x" aria-label="Close dialog">&times;</button>
                </div>
                <div class="dialog-body">
                    <div class="trade-info">
                        <h4 id="edit-stock-name">Stock Name</h4>
                        <div class="trade-details">
                            <div class="detail-row">
                                <span class="detail-label">Entry Date:</span>
                                <span id="edit-entry-date" class="detail-value">-</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Current P/L:</span>
                                <span id="edit-current-pl" class="detail-value">-</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="parameter-group">
                        <label for="edit-entry-price-input">Entry Price</label>
                        <input type="number" id="edit-entry-price-input" step="0.01" min="0">
                        <span class="form-hint" id="edit-entry-price-hint">Current: -</span>
                    </div>
                    
                    <div class="parameter-group">
                        <label for="edit-stop-loss">Stop Loss Price</label>
                        <input type="number" id="edit-stop-loss" step="0.01" min="0">
                        <span class="form-hint" id="edit-stop-loss-hint">Current: -</span>
                    </div>
                    
                    <div class="parameter-group">
                        <label for="edit-target">Target Price</label>
                        <input type="number" id="edit-target" step="0.01" min="0">
                        <span class="form-hint" id="edit-target-hint">Current: -</span>
                    </div>
                    
                    <div class="parameter-group">
                        <label for="edit-square-off-date">Square Off Date</label>
                        <input type="date" id="edit-square-off-date">
                        <span class="form-hint" id="edit-square-off-hint">Current: -</span>
                    </div>
                    
                    <div class="parameter-group">
                        <label for="edit-notes">Notes (Optional)</label>
                        <textarea id="edit-notes" rows="3" placeholder="Add any notes or observations about this trade"></textarea>
                    </div>
                </div>
                <div class="dialog-actions">
                    <button id="edit-dialog-cancel" class="btn-secondary">Cancel</button>
                    <button id="edit-dialog-confirm" class="btn-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                            <polyline points="17 21 17 13 7 13 7 21"></polyline>
                            <polyline points="7 3 7 8 15 8"></polyline>
                        </svg>
                        Save Changes
                    </button>
                </div>
            </div>
        `;
        
        // Append to the body
        document.body.appendChild(dialogOverlay);
        
        // Set up event listeners
        setupEditTradeDialog();
    }
    
    /**
     * Setup delete trade dialog
     */
    function setupDeleteTradeDialog() {
        const dialog = document.getElementById('delete-trade-dialog');
        if (!dialog) {
            createDeleteTradeDialog();
            return;
        }
        
        // Setup close button
        const closeBtn = document.getElementById('delete-dialog-x');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                dialog.classList.remove('active');
            });
        }
        
        // Setup cancel button
        const cancelBtn = document.getElementById('delete-dialog-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                dialog.classList.remove('active');
            });
        }
        
        // Setup confirm button
        const confirmBtn = document.getElementById('delete-dialog-confirm');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', function() {
                handleTradeDelete();
            });
        }
        
        // Close on background click
        dialog.addEventListener('click', function(e) {
            if (e.target === dialog) {
                dialog.classList.remove('active');
            }
        });
        
        // Add escape key handler
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && dialog.classList.contains('active')) {
                dialog.classList.remove('active');
            }
        });
    }
    
    /**
     * Create delete trade dialog dynamically if it doesn't exist in the HTML
     */
    function createDeleteTradeDialog() {
        const dialogOverlay = document.createElement('div');
        dialogOverlay.id = 'delete-trade-dialog';
        dialogOverlay.className = 'dialog-overlay';
        
        dialogOverlay.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3 class="dialog-title">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                        Delete Trade
                    </h3>
                    <button class="dialog-close" id="delete-dialog-x" aria-label="Close dialog">&times;</button>
                </div>
                <div class="dialog-body">
                    <p>Are you sure you want to delete this trade? This action cannot be undone.</p>
                    <div id="delete-trade-info" class="trade-info">
                        <div class="detail-row">
                            <span class="detail-label">Stock:</span>
                            <span id="delete-stock-name" class="detail-value">-</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Entry Date:</span>
                            <span id="delete-entry-date" class="detail-value">-</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Investment:</span>
                            <span id="delete-investment" class="detail-value">-</span>
                        </div>
                    </div>
                </div>
                <div class="dialog-actions">
                    <button id="delete-dialog-cancel" class="btn-secondary">Cancel</button>
                    <button id="delete-dialog-confirm" class="btn-danger">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                        Delete Trade
                    </button>
                </div>
            </div>
        `;
        
        // Append to the body
        document.body.appendChild(dialogOverlay);
        
        // Set up event listeners
        setupDeleteTradeDialog();
    }
    
    /**
     * Setup clear history dialog
     */
    function setupClearHistoryDialog() {
        const dialog = document.getElementById('clear-history-dialog');
        if (!dialog) return;
        
        // Setup close button
        const closeBtn = document.getElementById('clear-dialog-x');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                dialog.classList.remove('active');
            });
        }
        
        // Setup cancel button
        const cancelBtn = document.getElementById('clear-dialog-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                dialog.classList.remove('active');
            });
        }
        
        // Setup confirm button
        const confirmBtn = document.getElementById('clear-dialog-confirm');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', function() {
                // Set loading state
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
                    Clearing History...
                `;
                
                // Small delay for better UX
                setTimeout(() => {
                    TradeCore.clearTradeHistory();
                    dialog.classList.remove('active');
                    
                    // Reset button state
                    this.disabled = false;
                    this.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                        Delete All History
                    `;
                }, 500);
            });
        }
        
        // Setup trigger button
        const clearHistoryBtn = document.getElementById('btn-clear-history');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', function() {
                dialog.classList.add('active');
            });
        }
        
        // Close on background click
        dialog.addEventListener('click', function(e) {
            if (e.target === dialog) {
                dialog.classList.remove('active');
            }
        });
        
        // Add escape key handler
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && dialog.classList.contains('active')) {
                dialog.classList.remove('active');
            }
        });
    }
    
    /**
     * Create import trades dialog
     */
    function createImportTradesDialog() {
        // Check if dialog already exists
        if (document.getElementById('import-trades-dialog')) return;
        
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
                        <div class="checkbox-option" id="keep-active-container" style="margin-left: 25px; margin-top: 8px;">
                            <input type="checkbox" id="keep-active-trades" name="keep-active-trades" checked>
                            <label for="keep-active-trades">Keep current active trades</label>
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
     * Setup import dialog event listeners
     */
    function setupImportDialog() {
        // Make sure dialog is created first
        createImportTradesDialog();
        
        const dialog = document.getElementById('import-trades-dialog');
        if (!dialog) return;
        
        const fileInput = document.getElementById('import-file-input');
        const selectedFilename = document.getElementById('selected-filename');
        const importPreview = document.getElementById('import-preview');
        const confirmBtn = document.getElementById('import-dialog-confirm');
        const keepActiveContainer = document.getElementById('keep-active-container');
        
        // Setup file input change event
        if (fileInput) {
            fileInput.addEventListener('change', function(event) {
                const file = event.target.files[0];
                if (!file) {
                    selectedFilename.textContent = 'No file selected';
                    importPreview.style.display = 'none';
                    confirmBtn.disabled = true;
                    return;
                }
                
                selectedFilename.textContent = file.name;
                
                // Parse and preview the file
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const jsonData = JSON.parse(e.target.result);
                        
                        // Validate data format
                        if (!jsonData.metadata || !jsonData.trades || !Array.isArray(jsonData.trades)) {
                            throw new Error('Invalid file format');
                        }
                        
                        // Display preview
                        document.getElementById('preview-total').textContent = jsonData.trades.length;
                        document.getElementById('preview-active').textContent = jsonData.trades.filter(t => t.status === 'active').length;
                        document.getElementById('preview-closed').textContent = jsonData.trades.filter(t => t.status !== 'active').length;
                        
                        // Format date
                        const exportDate = new Date(jsonData.metadata.exportDate);
                        document.getElementById('preview-date').textContent = isNaN(exportDate) ? 
                            jsonData.metadata.exportDate : 
                            exportDate.toLocaleString();
                        
                        // Show preview and enable import button
                        importPreview.style.display = 'block';
                        confirmBtn.disabled = false;
                    } catch (error) {
                        console.error('Error parsing import file:', error);
                        selectedFilename.textContent = 'Error: Invalid JSON file format';
                        importPreview.style.display = 'none';
                        confirmBtn.disabled = true;
                    }
                };
                
                reader.readAsText(file);
            });
        }
        
        // Setup import mode change event
        const radioButtons = document.querySelectorAll('input[name="import-mode"]');
        radioButtons.forEach(radio => {
            radio.addEventListener('change', function() {
                // Only show keep active trades option for replace mode
                keepActiveContainer.style.display = this.value === 'replace' ? 'block' : 'none';
            });
        });
        
        // Setup close button
        const closeBtn = document.getElementById('import-dialog-x');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                dialog.classList.remove('active');
                resetImportDialog();
            });
        }
        
        // Setup cancel button
        const cancelBtn = document.getElementById('import-dialog-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                dialog.classList.remove('active');
                resetImportDialog();
            });
        }
        
        // Setup confirm button
        if (confirmBtn) {
            confirmBtn.addEventListener('click', function() {
                handleTradeImport();
            });
        }
        
        // Close on background click
        dialog.addEventListener('click', function(e) {
            if (e.target === dialog) {
                dialog.classList.remove('active');
                resetImportDialog();
            }
        });
        
        // Add escape key handler
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && dialog.classList.contains('active')) {
                dialog.classList.remove('active');
                resetImportDialog();
            }
        });
    }
    
    /**
     * Reset import dialog to initial state
     */
    function resetImportDialog() {
        const fileInput = document.getElementById('import-file-input');
        const selectedFilename = document.getElementById('selected-filename');
        const importPreview = document.getElementById('import-preview');
        const confirmBtn = document.getElementById('import-dialog-confirm');
        const importStatus = document.getElementById('import-status');
        const progress = document.getElementById('import-progress');
        
        // Reset file input
        if (fileInput) fileInput.value = '';
        
        // Reset text
        if (selectedFilename) selectedFilename.textContent = 'No file selected';
        
        // Hide preview and status
        if (importPreview) importPreview.style.display = 'none';
        if (importStatus) importStatus.style.display = 'none';
        
        // Reset progress
        if (progress) progress.style.width = '0%';
        
        // Disable import button
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Import Trades
            `;
        }
        
        // Set merge mode as default
        const mergeMode = document.getElementById('import-mode-merge');
        if (mergeMode) mergeMode.checked = true;
        
        // Hide keep active option by default
        const keepActiveContainer = document.getElementById('keep-active-container');
        if (keepActiveContainer) keepActiveContainer.style.display = 'none';
        
        // Check the keep active checkbox by default
        const keepActive = document.getElementById('keep-active-trades');
        if (keepActive) keepActive.checked = true;
    }
    
    /**
     * Handle trade close action
     */
    function handleTradeClose() {
        const tradeId = TradeCore.getSelectedTradeId();
        if (!tradeId) {
            console.error("No trade selected for closing");
            return;
        }
        
        const exitPriceInput = document.getElementById('close-trade-price');
        const reasonSelect = document.getElementById('close-trade-reason');
        const notesInput = document.getElementById('close-trade-notes');
        const confirmButton = document.getElementById('close-dialog-confirm');
        
        if (!exitPriceInput || !reasonSelect) {
            console.error("Required close trade form elements not found");
            TradeCore.showNotification('Error: Could not find form elements', 'error');
            return;
        }
        
        const exitPrice = parseFloat(exitPriceInput.value);
        const reason = reasonSelect.value;
        const notes = notesInput ? notesInput.value : '';
        
        if (isNaN(exitPrice) || exitPrice <= 0) {
            // Add error styling
            exitPriceInput.classList.add('error');
            const formHint = exitPriceInput.nextElementSibling;
            if (formHint) {
                formHint.textContent = 'Please enter a valid exit price';
                formHint.classList.add('error-hint');
            } else {
                // Create a hint if it doesn't exist
                const hint = document.createElement('span');
                hint.className = 'form-hint error-hint';
                hint.textContent = 'Please enter a valid exit price';
                exitPriceInput.parentNode.insertBefore(hint, exitPriceInput.nextSibling);
            }
            return;
        }
        
        // Set loading state
        if (confirmButton) {
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
                Closing Trade...
            `;
        }
        
        // Add a small delay for better UX
        setTimeout(async () => {
            try {
                // Close the trade
                const closeData = {
                    exitPrice: exitPrice,
                    exitReason: reason,
                    notes: notes
                };
                const success = await TradeCore.closeTrade(tradeId, closeData);
                
                if (success) {
                    // Close dialog
                    const closeTradeDialog = document.getElementById('close-trade-dialog');
                    if (closeTradeDialog) {
                        closeTradeDialog.classList.remove('active');
                    }
                }
            } catch (error) {
                console.error("Error closing trade:", error);
                TradeCore.showNotification('Error closing trade: ' + error.message, 'error');
                
                // Reset button state
                if (confirmButton) {
                    confirmButton.disabled = false;
                    confirmButton.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34"></path>
                            <path d="M3 15h10"></path>
                            <polyline points="17 8 22 12 17 16"></polyline>
                        </svg>
                        Close Trade
                    `;
                }
            }
        }, 500);
    }
    
    /**
     * Handle trade edit action
     */
    function handleTradeEdit() {
        const tradeId = TradeCore.getSelectedTradeId();
        if (!tradeId) {
            console.error("No trade selected for editing");
            return;
        }
        
        const entryPriceInput = document.getElementById('edit-entry-price-input');
        const stopLossInput = document.getElementById('edit-stop-loss');
        const targetInput = document.getElementById('edit-target');
        const squareOffDateInput = document.getElementById('edit-square-off-date');
        const notesInput = document.getElementById('edit-notes');
        const confirmButton = document.getElementById('edit-dialog-confirm');
        
        if (!entryPriceInput || !stopLossInput || !targetInput || !squareOffDateInput) {
            console.error("Required edit trade form elements not found");
            TradeCore.showNotification('Error: Could not find form elements', 'error');
            return;
        }
        
        const entryPrice = parseFloat(entryPriceInput.value);
        const stopLossPrice = parseFloat(stopLossInput.value);
        const targetPrice = parseFloat(targetInput.value);
        const squareOffDate = squareOffDateInput.value ? new Date(squareOffDateInput.value) : null;
        const notes = notesInput ? notesInput.value : '';
        
        // Validate inputs
        let isValid = true;
        
        if (isNaN(entryPrice) || entryPrice <= 0) {
            entryPriceInput.classList.add('error');
            document.getElementById('edit-entry-price-hint').classList.add('error-hint');
            document.getElementById('edit-entry-price-hint').textContent = 'Please enter a valid entry price';
            isValid = false;
        } else {
            entryPriceInput.classList.remove('error');
            document.getElementById('edit-entry-price-hint').classList.remove('error-hint');
        }
        
        if (isNaN(stopLossPrice) || stopLossPrice <= 0) {
            stopLossInput.classList.add('error');
            document.getElementById('edit-stop-loss-hint').classList.add('error-hint');
            document.getElementById('edit-stop-loss-hint').textContent = 'Please enter a valid stop loss price';
            isValid = false;
        } else {
            stopLossInput.classList.remove('error');
            document.getElementById('edit-stop-loss-hint').classList.remove('error-hint');
        }
        
        if (isNaN(targetPrice) || targetPrice <= 0) {
            targetInput.classList.add('error');
            document.getElementById('edit-target-hint').classList.add('error-hint');
            document.getElementById('edit-target-hint').textContent = 'Please enter a valid target price';
            isValid = false;
        } else {
            targetInput.classList.remove('error');
            document.getElementById('edit-target-hint').classList.remove('error-hint');
        }
        
        if (!squareOffDate || isNaN(squareOffDate.getTime())) {
            squareOffDateInput.classList.add('error');
            document.getElementById('edit-square-off-hint').classList.add('error-hint');
            document.getElementById('edit-square-off-hint').textContent = 'Please enter a valid date';
            isValid = false;
        } else {
            squareOffDateInput.classList.remove('error');
            document.getElementById('edit-square-off-hint').classList.remove('error-hint');
        }
        
        if (!isValid) {
            return;
        }
        
        // Set loading state
        if (confirmButton) {
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
                Saving Changes...
            `;
        }
        
        // Get the current trade to preserve all fields
        const currentTrade = TradeCore.getTradeById(tradeId);
        if (!currentTrade) {
            console.error("Trade not found:", tradeId);
            TradeCore.showNotification('Error: Trade not found', 'error');
            return;
        }
        
        // Prepare updated data - include all fields to avoid API errors
        const updatedData = {
            ...currentTrade,  // Include all existing fields
            entryPrice: entryPrice,
            stopLossPrice: stopLossPrice,
            targetPrice: targetPrice,
            squareOffDate: squareOffDate,
            notes: notes,
            exitDate: currentTrade.exitDate || null,  // Ensure exitDate is included
            exitPrice: currentTrade.exitPrice || null  // Ensure exitPrice is included
        };
        
        // Add a small delay for better UX
        setTimeout(async () => {
            try {
                // Edit the trade
                const success = await TradeCore.updateTrade(tradeId, updatedData);
                
                if (success) {
                    // Close dialog
                    const editTradeDialog = document.getElementById('edit-trade-dialog');
                    if (editTradeDialog) {
                        editTradeDialog.classList.remove('active');
                    }
                }
            } catch (error) {
                console.error("Error editing trade:", error);
                TradeCore.showNotification('Error editing trade: ' + error.message, 'error');
                
                // Reset button state
                if (confirmButton) {
                    confirmButton.disabled = false;
                    confirmButton.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                            <polyline points="17 21 17 13 7 13 7 21"></polyline>
                            <polyline points="7 3 7 8 15 8"></polyline>
                        </svg>
                        Save Changes
                    `;
                }
            }
        }, 500);
    }
    
    /**
     * Handle trade delete action
     */
    function handleTradeDelete() {
        const tradeId = TradeCore.getSelectedTradeId();
        if (!tradeId) {
            console.error("No trade selected for deletion");
            return;
        }
        
        const confirmButton = document.getElementById('delete-dialog-confirm');
        
        // Set loading state
        if (confirmButton) {
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
                Deleting...
            `;
        }
        
        // Add a small delay for better UX
        setTimeout(() => {
            try {
                // Delete the trade
                const success = TradeCore.deleteTrade(tradeId);
                
                if (success) {
                    // Close dialog
                    const deleteTradeDialog = document.getElementById('delete-trade-dialog');
                    if (deleteTradeDialog) {
                        deleteTradeDialog.classList.remove('active');
                    }
                }
            } catch (error) {
                console.error("Error deleting trade:", error);
                TradeCore.showNotification('Error deleting trade: ' + error.message, 'error');
                
                // Reset button state
                if (confirmButton) {
                    confirmButton.disabled = false;
                    confirmButton.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                        Delete Trade
                    `;
                }
            }
        }, 500);
    }
    
    /**
     * Handle trade import
     */
    function handleTradeImport() {
        const dialog = document.getElementById('import-trades-dialog');
        const fileInput = document.getElementById('import-file-input');
        const importStatus = document.getElementById('import-status');
        const statusMessage = document.getElementById('import-status-message');
        const progress = document.getElementById('import-progress');
        const confirmBtn = document.getElementById('import-dialog-confirm');
        
        // Get selected file
        const file = fileInput.files[0];
        if (!file) {
            TradeCore.showNotification('No file selected for import', 'error');
            return;
        }
        
        // Get import options
        const modeElement = document.querySelector('input[name="import-mode"]:checked');
        const keepActiveElement = document.getElementById('keep-active-trades');
        
        const mode = modeElement ? modeElement.value : 'merge';
        const keepActive = keepActiveElement ? keepActiveElement.checked : true;
        
        // Show import status
        importStatus.style.display = 'block';
        statusMessage.textContent = 'Reading import file...';
        progress.style.width = '10%';
        
        // Disable confirm button during import
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `
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
        
        // Read the file
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const jsonData = JSON.parse(e.target.result);
                
                // Update progress
                statusMessage.textContent = 'Validating import data...';
                progress.style.width = '30%';
                
                // Short delay to show progress
                setTimeout(() => {
                    try {
                        // Update progress
                        statusMessage.textContent = 'Importing trades...';
                        progress.style.width = '60%';
                        
                        // Import the trades
                        const results = TradeCore.importTradesFromJSON(jsonData, {
                            mode: mode,
                            keepActive: keepActive
                        });
                        
                        // Update progress to complete
                        statusMessage.textContent = 'Import completed successfully!';
                        progress.style.width = '100%';
                        
                        // Show result summary
                        setTimeout(() => {
                            if (results.error) {
                                statusMessage.textContent = `Error: ${results.error}`;
                                statusMessage.style.color = 'var(--danger-color)';
                            } else {
                                statusMessage.textContent = `Import complete: Added ${results.added}, Updated ${results.updated}`;
                                
                                // Close dialog after short delay
                                setTimeout(() => {
                                    dialog.classList.remove('active');
                                    resetImportDialog();
                                }, 1500);
                            }
                        }, 500);
                    } catch (importError) {
                        console.error('Error during import:', importError);
                        statusMessage.textContent = `Error: ${importError.message}`;
                        statusMessage.style.color = 'var(--danger-color)';
                        progress.style.width = '100%';
                        progress.style.backgroundColor = 'var(--danger-color)';
                        
                        // Reset confirm button
                        confirmBtn.disabled = false;
                        confirmBtn.innerHTML = `
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                            Retry Import
                        `;
                    }
                }, 300);
            } catch (parseError) {
                console.error('Error parsing import file:', parseError);
                statusMessage.textContent = 'Error: Invalid JSON file format';
                statusMessage.style.color = 'var(--danger-color)';
                progress.style.width = '100%';
                progress.style.backgroundColor = 'var(--danger-color)';
                
                // Reset confirm button
                confirmBtn.disabled = true;
                confirmBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    Import Trades
                `;
            }
        };
        
        reader.onerror = function() {
            console.error('Error reading file');
            statusMessage.textContent = 'Error reading file';
            statusMessage.style.color = 'var(--danger-color)';
            progress.style.width = '100%';
            progress.style.backgroundColor = 'var(--danger-color)';
            
            // Reset confirm button
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Retry Import
            `;
        };
        
        reader.readAsText(file);
    }
    
    /**
     * Open the close trade dialog for a specific trade
     * @param {string} tradeId - ID of the trade to close
     */
    function openCloseTradeDialog(tradeId) {
        const trade = TradeCore.getTradeById(tradeId);
        if (!trade) {
            console.error("Trade not found:", tradeId);
            return;
        }
        
        // Set the selected trade ID
        TradeCore.setSelectedTradeId(tradeId);
        
        const dialog = document.getElementById('close-trade-dialog');
        if (!dialog) {
            console.error("Close trade dialog not found");
            return;
        }
        
        const exitPriceInput = document.getElementById('close-trade-price');
        const reasonSelect = document.getElementById('close-trade-reason');
        const notesInput = document.getElementById('close-trade-notes');
        
        if (!exitPriceInput || !reasonSelect) {
            console.error("Dialog form elements not found");
            return;
        }
        
        // Clear any error styling
        exitPriceInput.classList.remove('error');
        const formHint = exitPriceInput.nextElementSibling;
        if (formHint && formHint.classList.contains('error-hint')) {
            formHint.textContent = '';
            formHint.classList.remove('error-hint');
        }
        
        // Reset confirm button
        const confirmButton = document.getElementById('close-dialog-confirm');
        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34"></path>
                    <path d="M3 15h10"></path>
                    <polyline points="17 8 22 12 17 16"></polyline>
                </svg>
                Close Trade
            `;
        }
        
        // Pre-fill with current price
        exitPriceInput.value = (trade.currentPrice || trade.entryPrice).toFixed(2);
        
        // Set exit reason based on current P&L
        const currentPLPercent = trade.currentPLPercent || trade.percentChange || 0;
        if (currentPLPercent >= (trade.takeProfitPercent || 10)) {
            reasonSelect.value = 'Target Reached';
        } else if (currentPLPercent <= -(trade.stopLossPercent || 5)) {
            reasonSelect.value = 'Stop Loss Hit';
        } else {
            reasonSelect.value = 'Manual Exit';
        }
        
        // Pre-fill notes if they exist
        if (notesInput) {
            notesInput.value = trade.notes || '';
        }
        
        // Update dialog title with stock name
        const dialogTitle = dialog.querySelector('.dialog-title');
        if (dialogTitle) {
            dialogTitle.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34"></path>
                    <path d="M3 15h10"></path>
                    <polyline points="17 8 22 12 17 16"></polyline>
                </svg>
                Close Trade: ${trade.stockName}
            `;
        }
        
        // Show P&L info in the dialog
        const dialogBody = dialog.querySelector('.dialog-body');
        if (dialogBody) {
            const plInfoElement = dialogBody.querySelector('.pl-info');
            if (plInfoElement) {
                // Update existing P&L info
                const currentPLPercent = trade.currentPLPercent || trade.percentChange || 0;
                const currentPLValue = trade.currentPLValue || trade.unrealizedPL || 0;
                plInfoElement.innerHTML = `
                    <div class="trade-pl-info ${currentPLPercent >= 0 ? 'positive' : 'negative'}">
                        Current P&L: ${currentPLPercent.toFixed(2)}% (${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${currentPLValue.toFixed(2)})
                    </div>
                `;
            } else {
                // Create P&L info element if it doesn't exist
                const plInfo = document.createElement('div');
                plInfo.className = 'pl-info';
                const currentPLPercent = trade.currentPLPercent || trade.percentChange || 0;
                const currentPLValue = trade.currentPLValue || trade.unrealizedPL || 0;
                plInfo.innerHTML = `
                    <div class="trade-pl-info ${currentPLPercent >= 0 ? 'positive' : 'negative'}">
                        Current P&L: ${currentPLPercent.toFixed(2)}% (${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${currentPLValue.toFixed(2)})
                    </div>
                `;
                dialogBody.insertBefore(plInfo, dialogBody.firstChild);
            }
        }
        
        // Show dialog with animation
        dialog.classList.add('active');
        
        // Focus on exit price input
        setTimeout(() => {
            exitPriceInput.focus();
            exitPriceInput.select();
        }, 300);
    }
    
    /**
     * Open the edit trade dialog for a specific trade
     * @param {string} tradeId - ID of the trade to edit
     */
    function openEditTradeDialog(tradeId) {
        const trade = TradeCore.getTradeById(tradeId);
        if (!trade) {
            console.error("Trade not found:", tradeId);
            return;
        }
        
        // Set the selected trade ID
        TradeCore.setSelectedTradeId(tradeId);
        
        // Make sure dialog exists
        let dialog = document.getElementById('edit-trade-dialog');
        if (!dialog) {
            createEditTradeDialog();
            dialog = document.getElementById('edit-trade-dialog');
        }
        
        if (!dialog) {
            console.error("Edit trade dialog not found");
            return;
        }
        
        // Get form elements
        const entryPriceInput = document.getElementById('edit-entry-price-input');
        const stopLossInput = document.getElementById('edit-stop-loss');
        const targetInput = document.getElementById('edit-target');
        const squareOffDateInput = document.getElementById('edit-square-off-date');
        const notesInput = document.getElementById('edit-notes');
        
        if (!entryPriceInput || !stopLossInput || !targetInput || !squareOffDateInput) {
            console.error("Dialog form elements not found");
            return;
        }
        
        // Clear any error styling
        entryPriceInput.classList.remove('error');
        stopLossInput.classList.remove('error');
        targetInput.classList.remove('error');
        squareOffDateInput.classList.remove('error');
        
        const entryPriceHint = document.getElementById('edit-entry-price-hint');
        const stopLossHint = document.getElementById('edit-stop-loss-hint');
        const targetHint = document.getElementById('edit-target-hint');
        const squareOffHint = document.getElementById('edit-square-off-hint');
        
        if (entryPriceHint) {
            entryPriceHint.classList.remove('error-hint');
            entryPriceHint.textContent = `Current: ${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${trade.entryPrice.toFixed(2)}`;
        }
        
        if (stopLossHint) {
            stopLossHint.classList.remove('error-hint');
            stopLossHint.textContent = `Current: ${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${trade.stopLossPrice.toFixed(2)}`;
        }
        
        if (targetHint) {
            targetHint.classList.remove('error-hint');
            targetHint.textContent = `Current: ${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${trade.targetPrice.toFixed(2)}`;
        }
        
        if (squareOffHint) {
            squareOffHint.classList.remove('error-hint');
            squareOffHint.textContent = `Current: ${TradeCore.formatDate(trade.squareOffDate)}`;
        }
        
        // Reset confirm button
        const confirmButton = document.getElementById('edit-dialog-confirm');
        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                Save Changes
            `;
        }
        
        // Update stock info
        const stockNameElement = document.getElementById('edit-stock-name');
        const entryDateElement = document.getElementById('edit-entry-date');
        const currentPLElement = document.getElementById('edit-current-pl');
        
        if (stockNameElement) stockNameElement.textContent = trade.stockName;
        if (entryDateElement) entryDateElement.textContent = TradeCore.formatDate(trade.entryDate);
        
        if (currentPLElement) {
            currentPLElement.textContent = `${trade.currentPLPercent.toFixed(2)}%`;
            currentPLElement.className = `detail-value ${trade.currentPLPercent >= 0 ? 'positive' : 'negative'}`;
        }
        
        // Pre-fill form with current values
        entryPriceInput.value = trade.entryPrice.toFixed(2);
        stopLossInput.value = trade.stopLossPrice.toFixed(2);
        targetInput.value = trade.targetPrice.toFixed(2);
        
        // Format date for the date input (YYYY-MM-DD)
        const squareOffDate = new Date(trade.squareOffDate);
        const formattedDate = squareOffDate.toISOString().split('T')[0];
        squareOffDateInput.value = formattedDate;
        
        // Pre-fill notes if they exist
        if (notesInput) {
            notesInput.value = trade.notes || '';
        }
        
        // Update dialog title with stock name
        const dialogTitle = dialog.querySelector('.dialog-title');
        if (dialogTitle) {
            dialogTitle.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                Edit Trade: ${trade.stockName}
            `;
        }
        
        // Show dialog with animation
        dialog.classList.add('active');
        
        // Focus on entry price input
        setTimeout(() => {
            entryPriceInput.focus();
            entryPriceInput.select();
        }, 300);
    }
    
    /**
     * Open the delete trade dialog for a specific trade
     * @param {string} tradeId - ID of the trade to delete
     */
    function openDeleteTradeDialog(tradeId) {
        const trade = TradeCore.getTradeById(tradeId);
        if (!trade) {
            console.error("Trade not found:", tradeId);
            return;
        }
        
        // Set the selected trade ID
        TradeCore.setSelectedTradeId(tradeId);
        
        // Make sure dialog exists
        let dialog = document.getElementById('delete-trade-dialog');
        if (!dialog) {
            createDeleteTradeDialog();
            dialog = document.getElementById('delete-trade-dialog');
        }
        
        if (!dialog) {
            console.error("Delete trade dialog not found");
            return;
        }
        
        // Reset confirm button
        const confirmButton = document.getElementById('delete-dialog-confirm');
        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
                Delete Trade
            `;
        }
        
        // Update trade info in the dialog
        const stockNameElement = document.getElementById('delete-stock-name');
        const entryDateElement = document.getElementById('delete-entry-date');
        const investmentElement = document.getElementById('delete-investment');
        
        if (stockNameElement) stockNameElement.textContent = trade.stockName;
        if (entryDateElement) entryDateElement.textContent = TradeCore.formatDate(trade.entryDate);
        if (investmentElement) investmentElement.textContent = `${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${trade.investmentAmount.toFixed(2)}`;
        
        // Update dialog title
        const dialogTitle = dialog.querySelector('.dialog-title');
        if (dialogTitle) {
            dialogTitle.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
                Delete Trade: ${trade.stockName}
            `;
        }
        
        // Show dialog with animation
        dialog.classList.add('active');
    }
    
    /**
     * Open import dialog
     */
    function openImportDialog() {
        // Make sure dialog exists
        setupImportDialog();
        
        const dialog = document.getElementById('import-trades-dialog');
        if (!dialog) {
            console.error("Import dialog not found");
            return;
        }
        
        // Reset dialog state
        resetImportDialog();
        
        // Show dialog
        dialog.classList.add('active');
    }

    // Return public API
    return {
        init,
        setupAllDialogs,
        openCloseTradeDialog,
        openEditTradeDialog,
        openDeleteTradeDialog
    };
})();