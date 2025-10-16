/**
 * Enhanced Active Trades Filter and Sort Module
 * Adds filtering, sorting, and search capabilities to the active trades section
 */

// Create TradeFilter module within TradeUIModules namespace
window.TradeUIModules = window.TradeUIModules || {};
window.TradeUIModules.filters = (function() {
    // Private variables for filter/sort states
    let currentFilter = 'all';      // Current filter selection
    let currentSort = 'entry-desc';  // Current sort selection (default: newest first)
    let searchQuery = '';           // Current search term
    
    /**
     * Initialize the module
     */
    function init() {
        // Add filter UI to the DOM if not already present
        createFilterUI();
    }
    
    /**
     * Create and inject the filter UI components
     */
    function createFilterUI() {
        // Find the card with "Active Trades" title using standard DOM methods
        const cardTitles = document.querySelectorAll('.card h3.card-title');
        let activesCard = null;
        
        // Find the card with the "Active Signals" title
        for (const title of cardTitles) {
            if (title.textContent.includes('Active Signals')) {
                activesCard = title.closest('.card');
                break;
            }
        }
        
        if (!activesCard) {
            // Don't return here, let it continue
        }
        
        // Find the section right after the header, before the trades container
        const tradesContainer = document.getElementById('active-trades-container');
        if (!tradesContainer) {
            return;
        }
        
        // Create filter container
        const filterContainer = document.createElement('div');
        filterContainer.className = 'trades-filter-container';
        filterContainer.innerHTML = `
            <div class="trades-filter-row">
                <div class="search-container">
                    <input type="text" id="trade-search" placeholder="Search by name or symbol..." class="trade-search">
                    <button id="clear-search" class="clear-search" title="Clear search">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="filter-controls">
                    <div class="filter-select-container">
                        <label for="trade-filter">Filter:</label>
                        <select id="trade-filter" class="trade-filter">
                            <option value="all">All Trades</option>
                            <option value="profit">In Profit</option>
                            <option value="loss">In Loss</option>
                            <option value="target-near">Near Target (>80%)</option>
                            <option value="stop-near">Near Stop Loss (<120%)</option>
                            <option value="expiring">Expiring Soon (7 days)</option>
                        </select>
                    </div>
                    <div class="filter-select-container">
                        <label for="trade-sort">Sort By:</label>
                        <select id="trade-sort" class="trade-sort">
                            <option value="entry-desc">Entry Date (Newest)</option>
                            <option value="entry-asc">Entry Date (Oldest)</option>
                            <option value="pl-desc">P/L % (Highest)</option>
                            <option value="pl-asc">P/L % (Lowest)</option>
                            <option value="investment-desc">Investment (Highest)</option>
                            <option value="investment-asc">Investment (Lowest)</option>
                            <option value="expiry-asc">Expiry (Soonest)</option>
                            <option value="expiry-desc">Expiry (Latest)</option>
                        </select>
                    </div>
                </div>
            </div>
            <div id="filter-summary" class="filter-summary"></div>
        `;
        
        // Insert filter container before trades container
        if (activesCard && tradesContainer) {
            activesCard.insertBefore(filterContainer, tradesContainer);
        } else if (tradesContainer && tradesContainer.parentNode) {
            // If no activesCard, insert before tradesContainer
            tradesContainer.parentNode.insertBefore(filterContainer, tradesContainer);
        } else {
            return;
        }
        
        // Set up event listeners after creating the UI
        setupFilterEventListeners();
        

    }
    
    /**
     * Set up event listeners for filter components
     */
    function setupFilterEventListeners() {
        // Filter dropdown change event
        const filterSelect = document.getElementById('trade-filter');
        if (filterSelect) {
            filterSelect.addEventListener('change', function() {
                currentFilter = this.value;
                applyFiltersAndSort();
                updateFilterSummary();
            });
        }
        
        // Sort dropdown change event
        const sortSelect = document.getElementById('trade-sort');
        if (sortSelect) {
            sortSelect.addEventListener('change', function() {
                currentSort = this.value;
                applyFiltersAndSort();
                updateFilterSummary();
            });
        }
        
        // Search input event
        const searchInput = document.getElementById('trade-search');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                searchQuery = this.value.trim().toLowerCase();
                applyFiltersAndSort();
                updateFilterSummary();
                
                // Show/hide clear button based on whether there's a search query
                const clearButton = document.getElementById('clear-search');
                if (clearButton) {
                    clearButton.style.display = searchQuery ? 'block' : 'none';
                }
            });
            
            // Add keydown event to reset on Escape key
            searchInput.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    this.value = '';
                    searchQuery = '';
                    applyFiltersAndSort();
                    updateFilterSummary();
                    
                    const clearButton = document.getElementById('clear-search');
                    if (clearButton) {
                        clearButton.style.display = 'none';
                    }
                }
            });
        }
        
        // Clear search button
        const clearButton = document.getElementById('clear-search');
        if (clearButton) {
            clearButton.style.display = 'none'; // Initially hidden
            clearButton.addEventListener('click', function() {
                const searchInput = document.getElementById('trade-search');
                if (searchInput) {
                    searchInput.value = '';
                    searchQuery = '';
                    applyFiltersAndSort();
                    updateFilterSummary();
                    this.style.display = 'none';
                }
            });
        }
        
        // Listen for trade events to reapply filters
        document.addEventListener('tradeAdded', applyFiltersAndSort);
        document.addEventListener('tradeEdited', applyFiltersAndSort);
        
        // For tradesUpdated, check if it's a silent update (price only)
        document.addEventListener('tradesUpdated', function(e) {
            // Skip filter reapplication for silent updates
            if (e.detail && e.detail.silent) {
                return;
            }
            applyFiltersAndSort();
        });
        
        // Initialize with current values
        applyFiltersAndSort();
        updateFilterSummary();
    }
    
    /**
     * Apply filters and sorting to active trades
     */
    function applyFiltersAndSort() {
        // Get all trades first
        const activeTrades = TradeCore.getTrades('active');
        
        // Apply filters
        const filteredTrades = filterTrades(activeTrades);
        
        // Apply sorting
        const sortedTrades = sortTrades(filteredTrades);
        
        // Render the filtered and sorted trades
        renderFilteredTrades(sortedTrades);
    }
    
    /**
     * Filter trades based on current filter and search query
     * @param {Array} trades - Array of trades to filter
     * @returns {Array} - Filtered array of trades
     */
    function filterTrades(trades) {
        // First filter by search term if present
        let filtered = trades.filter(trade => {
            if (searchQuery) {
                const stockNameMatch = trade.stockName.toLowerCase().includes(searchQuery);
                const symbolMatch = trade.symbol.toLowerCase().includes(searchQuery);
                return stockNameMatch || symbolMatch;
            }
            return true;
        });
        
        // Then apply the categorical filter
        switch (currentFilter) {
            case 'profit':
                return filtered.filter(trade => trade.currentPLPercent > 0);
            case 'loss':
                return filtered.filter(trade => trade.currentPLPercent <= 0);
            case 'target-near':
                // Trades that have reached at least 80% of the way to their target
                return filtered.filter(trade => {
                    const targetMovement = trade.targetPrice - trade.entryPrice;
                    const currentMovement = trade.currentPrice - trade.entryPrice;
                    return (currentMovement / targetMovement) >= 0.8 && currentMovement > 0;
                });
            case 'stop-near':
                // Trades that are within 120% of their stop loss level
                return filtered.filter(trade => {
                    const stopMovement = trade.entryPrice - trade.stopLossPrice;
                    const currentMovement = trade.entryPrice - trade.currentPrice;
                    return (currentMovement / stopMovement) >= 0.8 && currentMovement > 0;
                });
            case 'expiring':
                // Trades expiring in the next 7 days
                const sevenDaysFromNow = new Date();
                sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
                return filtered.filter(trade => trade.squareOffDate <= sevenDaysFromNow);
            case 'all':
            default:
                return filtered;
        }
    }
    
    /**
     * Sort trades based on current sort setting
     * @param {Array} trades - Array of trades to sort
     * @returns {Array} - Sorted array of trades
     */
    function sortTrades(trades) {
        const sortedTrades = [...trades]; // Create a copy to avoid modifying the original
        
        switch (currentSort) {
            case 'entry-desc': // Newest first (default)
                return sortedTrades.sort((a, b) => b.entryDate - a.entryDate);
            case 'entry-asc': // Oldest first
                return sortedTrades.sort((a, b) => a.entryDate - b.entryDate);
            case 'pl-desc': // Highest P/L first
                return sortedTrades.sort((a, b) => b.currentPLPercent - a.currentPLPercent);
            case 'pl-asc': // Lowest P/L first
                return sortedTrades.sort((a, b) => a.currentPLPercent - b.currentPLPercent);
            case 'investment-desc': // Highest investment first
                return sortedTrades.sort((a, b) => b.investmentAmount - a.investmentAmount);
            case 'investment-asc': // Lowest investment first
                return sortedTrades.sort((a, b) => a.investmentAmount - b.investmentAmount);
            case 'expiry-asc': // Soonest expiry first
                return sortedTrades.sort((a, b) => a.squareOffDate - b.squareOffDate);
            case 'expiry-desc': // Latest expiry first
                return sortedTrades.sort((a, b) => b.squareOffDate - a.squareOffDate);
            default:
                return sortedTrades;
        }
    }
    
    /**
     * Render the filtered and sorted trades
     * Uses a similar approach to TradeUI's renderActiveTrades 
     * but only shows the filtered trades
     * @param {Array} trades - Filtered and sorted trades to display
     */
    function renderFilteredTrades(trades) {
        const container = document.getElementById('active-trades-container');
        const noActiveTradesMsg = document.getElementById('no-active-trades');
        
        if (!container || !noActiveTradesMsg) {
            return;
        }
        
        if (trades.length === 0) {
            // Show a custom message for when no trades match the filter
            if (currentFilter !== 'all' || searchQuery) {
                // Custom message for when filters are applied but no matches
                noActiveTradesMsg.style.display = 'block';
                noActiveTradesMsg.querySelector('.empty-state-message').textContent = 'No trades match your filters';
                const emptyStateDesc = noActiveTradesMsg.querySelector('p');
                if (emptyStateDesc) {
                    emptyStateDesc.textContent = 'Try changing your filter criteria';
                }
            } else {
                // Default message when there are genuinely no active trades
                noActiveTradesMsg.style.display = 'block';
                noActiveTradesMsg.querySelector('.empty-state-message').textContent = 'No active trades';
                const emptyStateDesc = noActiveTradesMsg.querySelector('p');
                if (emptyStateDesc) {
                    emptyStateDesc.textContent = 'Return to the backtester to find and take new trades';
                }
            }
            
            // Remove any existing trade cards
            const existingCards = container.querySelectorAll('.trade-card');
            existingCards.forEach(card => card.remove());
            return;
        }
        
        // Hide empty state message
        noActiveTradesMsg.style.display = 'none';

        // Remove any existing trade cards
        const existingCards = container.querySelectorAll('.trade-card');
        existingCards.forEach(card => card.remove());
        
        // Get the template
        const template = document.getElementById('active-trade-template');
        if (!template) {
            return;
        }
        
        // Create cards for each filtered trade
        trades.forEach((trade, index) => {
            try {
                // Clone the template
                const card = template.content.cloneNode(true).querySelector('.trade-card');
                
                // Set trade ID
                card.dataset.tradeId = trade.id;
                
                // Add animation delay for staggered entry
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px)';
                
                // Stock info - Show proper company name with ticker below
                const stockNameElement = card.querySelector('.stock-name');
                const stockSymbolElement = card.querySelector('.stock-symbol');
                
                // Get company name from mapping
                const companyName = window.CompanyNames ? 
                    window.CompanyNames.getCompanyName(trade.symbol) : 
                    trade.stockName || trade.symbol;
                
                stockNameElement.textContent = companyName;
                stockSymbolElement.textContent = trade.symbol;
                
                // P&L Status
                const plElement = card.querySelector('.current-pl');
                const plValue = trade.currentPLPercent || 0;
                plElement.textContent = `${plValue.toFixed(2)}%`;
                
                if (plValue > 0) {
                    plElement.classList.add('positive');
                    card.classList.add('profit');
                    card.classList.remove('active', 'loss');
                    card.querySelector('.trade-status').className = 'trade-status status-profit';
                    card.querySelector('.trade-status').textContent = 'Profit';
                } else if (plValue < 0) {
                    plElement.classList.add('negative');
                    card.classList.add('loss');
                    card.classList.remove('active', 'profit');
                    card.querySelector('.trade-status').className = 'trade-status status-loss';
                    card.querySelector('.trade-status').textContent = 'Loss';
                }
                
                // Entry info
                card.querySelector('.entry-date').textContent = TradeCore.formatDate(trade.entryDate);
                // For UK stocks, prices are in pence
                if (trade.symbol && trade.symbol.endsWith('.L')) {
                    card.querySelector('.entry-price').textContent = `${(trade.entryPrice || 0).toFixed(2)}p`;
                    card.querySelector('.current-price').textContent = `${(trade.currentPrice || 0).toFixed(2)}p`;
                    card.querySelector('.investment').textContent = `${trade.currencySymbol || '£'}${((trade.investmentAmount || 0) / 100).toFixed(2)}`;
                    card.querySelector('.current-value').textContent = `${trade.currencySymbol || '£'}${((trade.currentValue || 0) / 100).toFixed(2)}`;
                    card.querySelector('.stop-loss').textContent = `${(trade.stopLossPrice || 0).toFixed(2)}p`;
                    card.querySelector('.target').textContent = `${(trade.targetPrice || 0).toFixed(2)}p`;
                } else {
                    card.querySelector('.entry-price').textContent = `${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${(trade.entryPrice || 0).toFixed(2)}`;
                    card.querySelector('.current-price').textContent = `${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${(trade.currentPrice || 0).toFixed(2)}`;
                    card.querySelector('.investment').textContent = `${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${(trade.investmentAmount || 0).toFixed(2)}`;
                    card.querySelector('.current-value').textContent = `${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${(trade.currentValue || 0).toFixed(2)}`;
                    card.querySelector('.stop-loss').textContent = `${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${(trade.stopLossPrice || 0).toFixed(2)}`;
                    card.querySelector('.target').textContent = `${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${(trade.targetPrice || 0).toFixed(2)}`;
                }
                card.querySelector('.shares').textContent = (trade.shares || 0).toLocaleString();
                // Calculate holding days
                let holdingDays = 0;
                if (trade.entryDate) {
                    const entryDate = trade.entryDate instanceof Date ? trade.entryDate : new Date(trade.entryDate);
                    const currentDate = new Date();
                    if (!isNaN(entryDate.getTime())) {
                        holdingDays = Math.floor((currentDate - entryDate) / (1000 * 60 * 60 * 24));
                        if (holdingDays < 0) holdingDays = 0;
                    }
                }
                card.querySelector('.holding-days').textContent = `${holdingDays} days`;
                card.querySelector('.square-off-date').textContent = TradeCore.formatDate(trade.squareOffDate);
                
                // Days remaining
                const daysRemaining = Math.max(0, Math.floor((trade.squareOffDate - new Date()) / (1000 * 60 * 60 * 24)));
                card.querySelector('.days-remaining').textContent = daysRemaining;
                
                // Add highlighting for trades matching filter
                if (currentFilter === 'target-near' && trade.currentPLPercent > 0) {
                    // Add a special highlight for near-target trades
                    card.classList.add('near-target');
                } else if (currentFilter === 'stop-near' && trade.currentPLPercent < 0) {
                    // Add a special highlight for near-stop trades
                    card.classList.add('near-stop');
                } else if (currentFilter === 'expiring' && daysRemaining <= 7) {
                    // Add a special highlight for expiring trades
                    card.classList.add('expiring-soon');
                }
                
                // Close button event
                const closeBtn = card.querySelector('.btn-close-trade');
                if (closeBtn) {
                    closeBtn.addEventListener('click', function() {
                        if (window.TradeUI && window.TradeUI.openCloseTradeDialog) {
                            window.TradeUI.openCloseTradeDialog(trade.id);
                        }
                    });
                }
                
                // Edit button event
                const editBtn = card.querySelector('.btn-edit-trade');
                if (editBtn) {
                    editBtn.addEventListener('click', function() {
                        if (window.TradeUI && window.TradeUI.openEditTradeDialog) {
                            window.TradeUI.openEditTradeDialog(trade.id);
                        }
                    });
                }
                
                // Delete button event
                const deleteBtn = card.querySelector('.btn-delete-trade');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', function() {
                        if (window.TradeUI && window.TradeUI.openDeleteTradeDialog) {
                            window.TradeUI.openDeleteTradeDialog(trade.id);
                        }
                    });
                }
                
                // Add search highlight if needed
                if (searchQuery) {
                    // Highlight matching text in stock name and symbol
                    highlightSearchMatches(card, '.stock-name', trade.stockName, searchQuery);
                    highlightSearchMatches(card, '.stock-symbol', trade.symbol, searchQuery);
                }
                
                // Add the card to the container with animation
                container.appendChild(card);
                
                // Trigger animation after a short delay (staggered)
                setTimeout(() => {
                    card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }, 50 * index); // Stagger the animations
            } catch (error) {
                TradeCore.showNotification('Error displaying a trade card', 'error');
            }
        });
    }

    /**
     * Highlight search matches in text
     * @param {Element} card - The trade card element
     * @param {string} selector - CSS selector for the element containing text
     * @param {string} text - Original text content
     * @param {string} query - Search query to highlight
     */
    function highlightSearchMatches(card, selector, text, query) {
        const element = card.querySelector(selector);
        if (!element || !text || !query) return;
        
        // Case insensitive search
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const highlightedText = text.replace(regex, '<span class="search-highlight">$1</span>');
        element.innerHTML = highlightedText;
    }
    
    /**
     * Update the filter summary text
     * Shows info about current filter and number of matches
     */
    function updateFilterSummary() {
        const summaryElement = document.getElementById('filter-summary');
        if (!summaryElement) return;
        
        const totalActiveTrades = TradeCore.getTrades('active').length;
        const filteredTrades = document.querySelectorAll('#active-trades-container .trade-card').length;
        
        // Create summary text based on current filter/search
        let summaryText = '';
        
        if (searchQuery) {
            summaryText += `Search: "${searchQuery}" • `;
        }
        
        if (currentFilter !== 'all') {
            const filterLabels = {
                'profit': 'In Profit',
                'loss': 'In Loss',
                'target-near': 'Near Target',
                'stop-near': 'Near Stop Loss',
                'expiring': 'Expiring Soon'
            };
            
            summaryText += `Filter: ${filterLabels[currentFilter]} • `;
        }
        
        // Add count of filtered trades
        summaryText += `Showing ${filteredTrades} of ${totalActiveTrades} active trades`;
        
        // Add a clear all button if filters are applied
        if (currentFilter !== 'all' || searchQuery) {
            summaryText += ` • <button id="clear-all-filters" class="clear-all-btn">Clear All</button>`;
        }
        
        // Update the summary element
        summaryElement.innerHTML = summaryText;
        
        // Add event listener to clear all button if it exists
        const clearAllBtn = document.getElementById('clear-all-filters');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', function() {
                // Reset filter dropdown
                const filterSelect = document.getElementById('trade-filter');
                if (filterSelect) filterSelect.value = 'all';
                currentFilter = 'all';
                
                // Reset search
                const searchInput = document.getElementById('trade-search');
                if (searchInput) searchInput.value = '';
                searchQuery = '';
                
                // Hide clear search button
                const clearSearchBtn = document.getElementById('clear-search');
                if (clearSearchBtn) clearSearchBtn.style.display = 'none';
                
                // Re-apply (now reset) filters
                applyFiltersAndSort();
                updateFilterSummary();
            });
        }
    }
    

    // Return public API
    return {
        init,
        applyFiltersAndSort
    };
})();

// Initialize the module when TradeUI is ready
document.addEventListener('DOMContentLoaded', function() {
    const checkTradeUIReady = setInterval(() => {
        if (window.TradeUI && window.TradeUI.init) {
            clearInterval(checkTradeUIReady);
            // Add a small delay to ensure TradeUI has initialized
            setTimeout(() => {
                if (window.TradeUIModules.filters) {
                    window.TradeUIModules.filters.init();
                }
            }, 500);
        }
    }, 100);
});