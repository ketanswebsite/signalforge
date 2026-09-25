/**
 * DTI Backtester - Dialogs UI Module
 * Handles all dialog creation, opening, and interactions
 */

// Create Dialogs module
window.TradeUIModules = window.TradeUIModules || {};
window.TradeUIModules.dialogs = (function() {
    // Track if global escape handler is already set up
    let globalEscapeHandlerAttached = false;

    /**
     * Initialize the dialogs module
     */
    function init() {
        // Initialization will happen in setupAllDialogs
        setupGlobalEscapeHandler();
    }

    /**
     * Setup global escape key handler (ONCE for all dialogs)
     * This prevents memory leaks from multiple event listeners
     */
    function setupGlobalEscapeHandler() {
        if (globalEscapeHandlerAttached) return;

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                // Close any active dialog
                const activeDialogs = document.querySelectorAll('.dialog-overlay.active');
                activeDialogs.forEach(dialog => {
                    dialog.classList.remove('active');
                });
            }
        });

        globalEscapeHandlerAttached = true;
    }

    /**
     * Setup all dialog functionality
     */
    function setupAllDialogs() {
        // Ensure global escape handler is set up
        setupGlobalEscapeHandler();

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

        // Note: Escape key handler is now global - see setupGlobalEscapeHandler()
    }

    /**
     * Setup edit trade dialog
     */
    function setupEditTradeDialog() {
        const dialog = document.getElementById('edit-trade-dialog');
        if (!dialog) {
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
        
        // The read-only exit-rule rows follow the price being typed
        const entryPriceInput = document.getElementById('edit-entry-price-input');
        if (entryPriceInput) {
            entryPriceInput.addEventListener('input', function() {
                const trade = TradeCore.getTradeById(TradeCore.getSelectedTradeId());
                if (trade) {
                    renderEditExitRule(trade, parseFloat(entryPriceInput.value));
                }
            });
        }
        
        // Close on background click
        dialog.addEventListener('click', function(e) {
            if (e.target === dialog) {
                dialog.classList.remove('active');
            }
        });

        // Note: Escape key handler is now global - see setupGlobalEscapeHandler()
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

        // Note: Escape key handler is now global - see setupGlobalEscapeHandler()
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
                setTimeout(async () => {
                    await TradeCore.deleteAllTrades();
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

        // Note: Escape key handler is now global - see setupGlobalEscapeHandler()
    }

    /**
     * Import. The file is the one "Export everything" saves ({ metadata, trades });
     * { trades } or a plain array of trades reads too. Its trades go to POST
     * /api/trades/bulk, which checks every one and adds them all or none, as trades
     * entered by hand. A trade already on this page (same symbol, day bought and
     * price paid) is left out, so importing an export again adds nothing twice.
     */
    let importDialogReady = false;
    let importCandidates = null; // the file's trades still to add, in the bulk route's shape

    // A date as ISO text (the bulk route reads dates as text); anything else goes as it is, for the route to refuse
    function importDateText(value) {
        if (value === undefined || value === null || value === '') return null;
        const date = new Date(value);
        return isNaN(date.getTime()) ? value : date.toISOString();
    }

    // What makes two trades the same trade: symbol, the day bought and the price paid
    function importTradeKey(symbol, entryDate, entryPrice) {
        const day = new Date(entryDate);
        const price = Number(entryPrice);
        if (typeof symbol !== 'string' || !symbol.trim() || isNaN(day.getTime()) || !Number.isFinite(price)) return null;
        return symbol.trim().toUpperCase() + '|' + day.toISOString().slice(0, 10) + '|' + price.toFixed(4);
    }

    // The file's trades, in the shape POST /api/trades/bulk takes: each field a trade entered by hand
    // carries, as GET /api/trades gave it, so an exported trade comes back as it was. Only a sold trade
    // carries exit fields. What the server decides (id, owner, automatic or not, rules' version) is not sent.
    function tradesFromImportFile(json) {
        const list = Array.isArray(json) ? json : (json && Array.isArray(json.trades) ? json.trades : null);
        if (!list || list.length === 0) throw new Error('There are no trades in this file');
        return list.map(item => {
            const t = item && typeof item === 'object' ? item : {};
            const sold = t.status === 'closed';
            return {
                symbol: t.symbol,
                name: t.name || null,
                stockName: t.stockName || null,
                stockIndex: t.stockIndex || null,
                market: t.market || null,
                currencySymbol: t.currencySymbol || null,
                status: t.status || 'active',
                entryDate: importDateText(t.entryDate),
                entryPrice: t.entryPrice,
                shares: t.shares || null,
                investmentAmount: t.investmentAmount || null,
                positionSize: t.positionSize || null,
                targetPrice: t.targetPrice || null,
                stopLossPercent: t.stopLossPercent || null,
                takeProfitPercent: t.takeProfitPercent || null,
                squareOffDate: importDateText(t.squareOffDate),
                exitDate: sold ? importDateText(t.exitDate) : null,
                exitPrice: sold ? t.exitPrice : null,
                exitReason: sold ? (t.exitReason || null) : null,
                profitLoss: sold ? (t.profitLoss ?? null) : null,
                profitLossPercentage: sold ? (t.profitLossPercentage ?? null) : null,
                entryReason: t.entryReason || null,
                notes: t.notes || null
            };
        });
    }

    /**
     * Setup import dialog event listeners (once: the dialog is in trades.html)
     */
    function setupImportDialog() {
        const dialog = document.getElementById('import-trades-dialog');
        if (!dialog || importDialogReady) return;
        importDialogReady = true;

        const fileInput = document.getElementById('import-file-input');
        const selectedFilename = document.getElementById('selected-filename');
        const importPreview = document.getElementById('import-preview');
        const confirmBtn = document.getElementById('import-dialog-confirm');

        fileInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            importCandidates = null;
            importPreview.hidden = true;
            confirmBtn.disabled = true;
            if (!file) {
                selectedFilename.textContent = 'No file selected';
                return;
            }
            selectedFilename.textContent = file.name;

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const json = JSON.parse(e.target.result);
                    const trades = tradesFromImportFile(json);
                    const onPage = new Set(TradeCore.getTrades('all').map(t => importTradeKey(t.symbol, t.entryDate, t.entryPrice)));
                    importCandidates = trades.filter(t => {
                        const key = importTradeKey(t.symbol, t.entryDate, t.entryPrice);
                        return key === null || !onPage.has(key);
                    });

                    document.getElementById('preview-total').textContent = trades.length;
                    document.getElementById('preview-active').textContent = trades.filter(t => t.status === 'active').length;
                    document.getElementById('preview-closed').textContent = trades.filter(t => t.status === 'closed').length;
                    document.getElementById('preview-skipped').textContent = trades.length - importCandidates.length;
                    const exportDate = new Date(json && json.metadata ? json.metadata.exportDate : NaN);
                    document.getElementById('preview-date').textContent = isNaN(exportDate.getTime()) ? '-' :
                        (window.DateFormatter ? window.DateFormatter.formatTime(exportDate) : exportDate.toLocaleString());

                    importPreview.hidden = false;
                    confirmBtn.disabled = importCandidates.length === 0;
                } catch (error) {
                    importCandidates = null;
                    selectedFilename.textContent = error instanceof SyntaxError ? 'This file is not JSON' : error.message;
                }
            };
            reader.readAsText(file);
        });

        const close = function() {
            dialog.classList.remove('active');
            resetImportDialog();
        };
        document.getElementById('import-dialog-x').addEventListener('click', close);
        document.getElementById('import-dialog-cancel').addEventListener('click', close);
        confirmBtn.addEventListener('click', handleTradeImport);

        // Close on background click
        dialog.addEventListener('click', function(e) {
            if (e.target === dialog) close();
        });
        // Escape closes every dialog (setupGlobalEscapeHandler); opening the dialog resets it
    }

    /**
     * Reset import dialog to initial state
     */
    function resetImportDialog() {
        importCandidates = null;
        const fileInput = document.getElementById('import-file-input');
        const selectedFilename = document.getElementById('selected-filename');
        const importPreview = document.getElementById('import-preview');
        const importStatus = document.getElementById('import-status');
        const statusMessage = document.getElementById('import-status-message');
        const progress = document.getElementById('import-progress');
        const confirmBtn = document.getElementById('import-dialog-confirm');

        if (fileInput) fileInput.value = '';
        if (selectedFilename) selectedFilename.textContent = 'No file selected';
        if (importPreview) importPreview.hidden = true;
        if (importStatus) importStatus.hidden = true;
        if (statusMessage) {
            statusMessage.textContent = '';
            statusMessage.classList.remove('is-error');
        }
        if (progress) {
            progress.dataset.progress = '0';
            progress.classList.remove('is-error');
        }
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Import';
        }
    }
    
    /**
     * Handle trade close action
     */
    function handleTradeClose() {
        const tradeId = TradeCore.getSelectedTradeId();
        if (!tradeId) {
            return;
        }
        
        const exitPriceInput = document.getElementById('close-trade-price');
        const reasonSelect = document.getElementById('close-trade-reason');
        const notesInput = document.getElementById('close-trade-notes');
        const confirmButton = document.getElementById('close-dialog-confirm');
        
        if (!exitPriceInput || !reasonSelect) {
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
            confirmButton.replaceChildren();
            (function(){
                const spin = document.createElement('span');
                spin.className = 'sa-btn__spin';
                spin.setAttribute('aria-hidden', 'true');
                confirmButton.appendChild(spin);
                confirmButton.appendChild(document.createTextNode(' Selling\u2026'));
            })();
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
                } else {
                    // Refused, and TradeCore.closeTrade has said why: most likely the exit
                    // monitor sold the position first (409). Free the button and reload.
                    if (confirmButton) {
                        confirmButton.disabled = false;
                        confirmButton.textContent = 'Sell now';
                    }
                    if (TradeCore.refreshData) {
                        await TradeCore.refreshData();
                        if (TradeCore.refreshUI) {
                            TradeCore.refreshUI();
                        }
                    }
                }
            } catch (error) {
                TradeCore.showNotification('Error closing trade: ' + error.message, 'error');
                
                // Reset button state
                if (confirmButton) {
                    confirmButton.disabled = false;
                    confirmButton.textContent = 'Sell now';
                }
            }
        }, 500);
    }
    
    /**
     * Handle trade edit action. Sends only what the dialog can change: the price
     * paid (when it was changed) and the notes. The exit rule is shown read-only,
     * and the server writes nothing else, so a save can never reopen a trade that
     * closed while the dialog was open: it answers 409 and nothing is written.
     */
    function handleTradeEdit() {
        const tradeId = TradeCore.getSelectedTradeId();
        const trade = tradeId ? TradeCore.getTradeById(tradeId) : null;
        if (!trade) {
            return;
        }

        const entryPriceInput = document.getElementById('edit-entry-price-input');
        const entryPriceHint = document.getElementById('edit-entry-price-hint');
        const notesInput = document.getElementById('edit-notes');
        const confirmButton = document.getElementById('edit-dialog-confirm');

        if (!entryPriceInput) {
            TradeCore.showNotification('Error: Could not find form elements', 'error');
            return;
        }

        const entryPrice = parseFloat(entryPriceInput.value);
        if (isNaN(entryPrice) || entryPrice <= 0) {
            entryPriceInput.classList.add('error');
            if (entryPriceHint) {
                entryPriceHint.classList.add('error-hint');
                entryPriceHint.textContent = 'Please enter a valid entry price';
            }
            return;
        }
        entryPriceInput.classList.remove('error');
        if (entryPriceHint) {
            entryPriceHint.classList.remove('error-hint');
        }

        // The input shows the price to 2 decimals: send it only when it was changed,
        // so saving a note never rounds the stored price
        const priceChanged = entryPriceInput.value.trim() !== trade.entryPrice.toFixed(2);
        const updatedData = {};
        if (priceChanged) {
            updatedData.entryPrice = entryPrice;
        }
        if (notesInput) {
            updatedData.notes = notesInput.value;
        }

        // Set loading state
        if (confirmButton) {
            confirmButton.disabled = true;
            confirmButton.replaceChildren();
            (function(){
                const spin = document.createElement('span');
                spin.className = 'sa-btn__spin';
                spin.setAttribute('aria-hidden', 'true');
                confirmButton.appendChild(spin);
                confirmButton.appendChild(document.createTextNode(' Saving…'));
            })();
        }

        // Add a small delay for better UX
        setTimeout(async () => {
            // TradeCore.updateTrade shows the server's reason itself when it fails
            const success = await TradeCore.updateTrade(tradeId, updatedData);

            if (success) {
                const editTradeDialog = document.getElementById('edit-trade-dialog');
                if (editTradeDialog) {
                    editTradeDialog.classList.remove('active');
                }
            } else if (confirmButton) {
                confirmButton.disabled = false;
                confirmButton.textContent = 'Save changes';
            }

            // Reload from the server when the page's copy is now out of date: a new
            // price paid moves the stored target with it, and a refused save most
            // likely means the position has just been closed
            if ((!success || priceChanged) && TradeCore.refreshData) {
                await TradeCore.refreshData();
                if (TradeCore.refreshUI) {
                    TradeCore.refreshUI();
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
            return;
        }
        
        const confirmButton = document.getElementById('delete-dialog-confirm');
        
        // Set loading state
        if (confirmButton) {
            confirmButton.disabled = true;
            confirmButton.replaceChildren();
            (function(){
                const spin = document.createElement('span');
                spin.className = 'sa-btn__spin';
                spin.setAttribute('aria-hidden', 'true');
                confirmButton.appendChild(spin);
                confirmButton.appendChild(document.createTextNode(' Deleting\u2026'));
            })();
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
                TradeCore.showNotification('Error deleting trade: ' + error.message, 'error');
                
                // Reset button state
                if (confirmButton) {
                    confirmButton.disabled = false;
                    confirmButton.textContent = 'Delete it';
                }
            }
        }, 500);
    }
    
    /**
     * Handle trade import: the file's new trades go to POST /api/trades/bulk in one
     * request, then the page reloads its trades
     */
    async function handleTradeImport() {
        const dialog = document.getElementById('import-trades-dialog');
        const importStatus = document.getElementById('import-status');
        const statusMessage = document.getElementById('import-status-message');
        const progress = document.getElementById('import-progress');
        const confirmBtn = document.getElementById('import-dialog-confirm');
        const trades = importCandidates;
        if (!trades || trades.length === 0) return;

        importStatus.hidden = false;
        statusMessage.classList.remove('is-error');
        progress.classList.remove('is-error');
        statusMessage.textContent = `Importing ${trades.length} trade${trades.length === 1 ? '' : 's'}…`;
        progress.dataset.progress = '30';
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Importing…';

        try {
            const result = await TradeAPI.bulkImportTrades(trades);
            importCandidates = null;
            progress.dataset.progress = '100';
            statusMessage.textContent = `Imported ${result.count} trade${result.count === 1 ? '' : 's'}`;
            TradeCore.showNotification(statusMessage.textContent, 'success');
            await TradeCore.refreshData();
            TradeCore.refreshUI();
            setTimeout(() => {
                dialog.classList.remove('active');
                resetImportDialog();
            }, 1500);
        } catch (error) {
            progress.dataset.progress = '100';
            progress.classList.add('is-error');
            // The route names a refused trade by its place in the request: name it by its symbol
            const refused = /^trades\[(\d+)\]: (.*)$/.exec(error.message);
            const reason = refused && trades[Number(refused[1])] ? `${trades[Number(refused[1])].symbol}: ${refused[2]}` : error.message;
            statusMessage.textContent = 'Nothing was imported. ' + reason;
            statusMessage.classList.add('is-error');
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Try again';
        }
    }
    
    /**
     * Open the close trade dialog for a specific trade
     * @param {string} tradeId - ID of the trade to close
     */
    function openCloseTradeDialog(tradeId) {
        const trade = TradeCore.getTradeById(tradeId);
        if (!trade) {
            return;
        }
        
        // Set the selected trade ID
        TradeCore.setSelectedTradeId(tradeId);
        
        const dialog = document.getElementById('close-trade-dialog');
        if (!dialog) {
            return;
        }
        
        const exitPriceInput = document.getElementById('close-trade-price');
        const reasonSelect = document.getElementById('close-trade-reason');
        const notesInput = document.getElementById('close-trade-notes');
        
        if (!exitPriceInput || !reasonSelect) {
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
            confirmButton.textContent = 'Sell now';
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
            dialogTitle.textContent = 'Sell ' + trade.stockName + ' now?';
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
                        Current P&L: ${currentPLPercent.toFixed(2)}% (${currentPLValue < 0 ? '−' : ''}${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${Math.abs(currentPLValue).toFixed(2)})
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
                        Current P&L: ${currentPLPercent.toFixed(2)}% (${currentPLValue < 0 ? '−' : ''}${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${Math.abs(currentPLValue).toFixed(2)})
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
    
    // The exit rule the exit monitor applies to every open position (lib/shared/strategy-params.js,
    // loaded by the page before this file). The edit dialog shows it read-only.
    const EXIT_RULE = {
        targetPercent: window.StrategyParams.TAKE_PROFIT_PERCENT,
        stopPercent: window.StrategyParams.STOP_LOSS_PERCENT,
        maxHoldingDays: window.StrategyParams.MAX_HOLDING_DAYS
    };

    // A price the way the position card shows it: London prices are in pence
    function formatEditPrice(trade, price) {
        if (trade.symbol && trade.symbol.endsWith('.L')) {
            return `${price.toFixed(2)}p`;
        }
        return `${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${price.toFixed(2)}`;
    }

    /**
     * Fill the edit dialog's read-only exit-rule rows: where the rule stops and
     * sells this position, counted from the price paid (the one being typed, so
     * the rows follow an edit), and the last day it can be held.
     */
    function renderEditExitRule(trade, entryPrice) {
        const priced = Number.isFinite(entryPrice) && entryPrice > 0;
        const stopElement = document.getElementById('edit-rule-stop');
        const targetElement = document.getElementById('edit-rule-target');
        const dateElement = document.getElementById('edit-rule-date');

        if (stopElement) {
            stopElement.textContent = priced ? formatEditPrice(trade, entryPrice * (1 - EXIT_RULE.stopPercent / 100)) : '-';
        }
        if (targetElement) {
            targetElement.textContent = priced ? formatEditPrice(trade, entryPrice * (1 + EXIT_RULE.targetPercent / 100)) : '-';
        }
        if (dateElement) {
            // The holding limit, or the trade's own square-off date when that is sooner
            const lastDay = new Date(trade.entryDate);
            lastDay.setDate(lastDay.getDate() + EXIT_RULE.maxHoldingDays);
            const squareOff = trade.squareOffDate ? new Date(trade.squareOffDate) : null;
            const sellBy = squareOff && !isNaN(squareOff.getTime()) && squareOff < lastDay ? squareOff : lastDay;
            dateElement.textContent = isNaN(sellBy.getTime()) ? '-' : TradeCore.formatDate(sellBy);
        }
    }

    /**
     * Open the edit trade dialog for a specific trade: the price paid and the
     * notes can be changed; the exit rule is shown, read-only.
     * @param {string} tradeId - ID of the trade to edit
     */
    function openEditTradeDialog(tradeId) {
        const trade = TradeCore.getTradeById(tradeId);
        if (!trade) {
            return;
        }

        const dialog = document.getElementById('edit-trade-dialog');
        const entryPriceInput = document.getElementById('edit-entry-price-input');
        const notesInput = document.getElementById('edit-notes');
        if (!dialog || !entryPriceInput) {
            return;
        }

        // Set the selected trade ID
        TradeCore.setSelectedTradeId(tradeId);

        // Clear any error styling
        entryPriceInput.classList.remove('error');
        const entryPriceHint = document.getElementById('edit-entry-price-hint');
        if (entryPriceHint) {
            entryPriceHint.classList.remove('error-hint');
            entryPriceHint.textContent = `Current: ${formatEditPrice(trade, trade.entryPrice)}`;
        }

        // Reset confirm button
        const confirmButton = document.getElementById('edit-dialog-confirm');
        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.textContent = 'Save changes';
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

        // Pre-fill what can be changed
        entryPriceInput.value = trade.entryPrice.toFixed(2);
        if (notesInput) {
            notesInput.value = trade.notes || '';
        }

        // The exit rule, read-only
        renderEditExitRule(trade, trade.entryPrice);

        // Update dialog title with stock name
        const dialogTitle = dialog.querySelector('.dialog-title');
        if (dialogTitle) {
            dialogTitle.textContent = 'Change ' + trade.stockName;
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
            return;
        }
        
        // Reset confirm button
        const confirmButton = document.getElementById('delete-dialog-confirm');
        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.textContent = 'Delete it';
        }
        
        // Update trade info in the dialog
        const stockNameElement = document.getElementById('delete-stock-name');
        const entryDateElement = document.getElementById('delete-entry-date');
        const investmentElement = document.getElementById('delete-investment');
        
        if (stockNameElement) stockNameElement.textContent = trade.stockName;
        if (entryDateElement) entryDateElement.textContent = TradeCore.formatDate(trade.entryDate);
        if (investmentElement) investmentElement.textContent = `${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${trade.investmentAmount.toFixed(2)}`;
        
        // Update dialog title (as text: a trade's name is data)
        const dialogTitle = dialog.querySelector('.dialog-title');
        if (dialogTitle) {
            dialogTitle.textContent = 'Delete ' + trade.stockName + '?';
        }
        
        // Show dialog with animation
        dialog.classList.add('active');
    }
    
    /**
     * Open import dialog
     */
    function openImportDialog() {
        const dialog = document.getElementById('import-trades-dialog');
        if (!dialog) {
            return;
        }
        setupImportDialog();
        resetImportDialog();
        dialog.classList.add('active');
    }

    // Return public API
    return {
        init,
        setupAllDialogs,
        openCloseTradeDialog,
        openEditTradeDialog,
        openDeleteTradeDialog,
        openImportDialog
    };
})();