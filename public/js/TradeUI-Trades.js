/**
 * DTI Backtester - Trades UI Module
 * Handles rendering trades and statistics
 */

// Create Trades module
window.TradeUIModules = window.TradeUIModules || {};
window.TradeUIModules.trades = (function() {
    /**
     * Initialize the trades module
     */
    function init() {
        // No specific initialization needed yet
    }
    
/**
 * Modified TradeUI-Trades.js renderActiveTrades function
 * To integrate with the new filtering system
 */

/**
 * Render active trades with enhanced UI
 * Modified to work with the filtering system
 */
function renderActiveTrades() {
    const container = document.getElementById('active-trades-container');
    const noActiveTradesMsg = document.getElementById('no-active-trades');
    
    if (!container || !noActiveTradesMsg) {
        return;
    }
    
    // Check if the filter module is available
    if (window.TradeUIModules.filters && window.TradeUIModules.filters.applyFiltersAndSort) {
        // Let the filter module handle rendering
        window.TradeUIModules.filters.applyFiltersAndSort();
        return;
    }
    
    // Fallback to original implementation if filters aren't available
    const activeTrades = TradeCore.getTrades('active');
    
    if (activeTrades.length === 0) {
        noActiveTradesMsg.style.display = 'block';
        // Remove any existing trade cards
        const existingCards = container.querySelectorAll('.trade-card');
        existingCards.forEach(card => card.remove());
        return;
    }
    
    // Hide empty state message
    noActiveTradesMsg.style.display = 'none';
    
    // Remove any existing trade cards and clean up subscriptions
    const existingCards = container.querySelectorAll('.trade-card');
    existingCards.forEach(card => {
        // Unsubscribe from price updates if available
        if (card.dataset.unsubscribe && typeof window[card.dataset.unsubscribe] === 'function') {
            window[card.dataset.unsubscribe]();
        }
        card.remove();
    });
    
    // Get the template
    const template = document.getElementById('active-trade-template');
    if (!template) {
        console.error("Active trade card template not found");
        return;
    }
    
    // Create cards for each active trade
    activeTrades.forEach((trade, index) => {
        try {
            // Clone the template
            const card = template.content.cloneNode(true).querySelector('.trade-card');
            
            // Set trade ID and data attributes for real-time updates
            card.dataset.tradeId = trade.id;
            card.dataset.entryPrice = trade.entryPrice;
            card.dataset.shares = trade.shares || Math.floor(trade.investment / trade.entryPrice);
            card.dataset.investment = trade.investment;
            
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
            
            // Add price movement badge
            const cardHeader = card.querySelector('.trade-card-header');
            if (cardHeader) {
                const badge = document.createElement('div');
                badge.className = 'price-movement-badge';
                badge.style.opacity = '0';
                cardHeader.appendChild(badge);
            }
            
            // Add sparkline container
            const priceContainer = card.querySelector('.current-price').parentElement;
            if (priceContainer) {
                const sparklineContainer = document.createElement('div');
                sparklineContainer.className = 'sparkline-container';
                sparklineContainer.style.display = 'inline-block';
                sparklineContainer.style.verticalAlign = 'middle';
                priceContainer.appendChild(sparklineContainer);
                
                // Initialize sparkline if price service is available
                if (window.RealTimePriceService) {
                    window.RealTimePriceService.createSparkline(sparklineContainer, trade.symbol);
                }
            }
            
            // Set up real-time price updates
            if (window.RealTimePriceService) {
                const calculator = new window.LivePnLCalculator(card);
                
                // Subscribe to price updates
                const unsubscribe = window.RealTimePriceService.subscribe(trade.symbol, (priceData) => {
                    calculator.updatePrice(priceData.price, priceData.change, priceData.changePercent);
                });
                
                // Store unsubscribe function on the card for cleanup
                card.dataset.unsubscribe = unsubscribe;
            }
            
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
            } else {
                card.querySelector('.entry-price').textContent = `${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${(trade.entryPrice || 0).toFixed(2)}`;
                card.querySelector('.current-price').textContent = `${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${(trade.currentPrice || 0).toFixed(2)}`;
                card.querySelector('.investment').textContent = `${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${(trade.investmentAmount || 0).toFixed(2)}`;
            }
            
            // Special handling for shares
            const sharesElement = card.querySelector('.shares');
            if (trade.shares === 0 || !trade.shares) {
                sharesElement.textContent = '⚠️ 0';
                sharesElement.style.color = '#ff6b6b';
                sharesElement.title = 'No shares recorded - please edit this trade';
            } else {
                sharesElement.textContent = (trade.shares || 0).toLocaleString();
            }
            
            // Handle UK stocks pricing (pence to pounds conversion)
            if (trade.symbol && trade.symbol.endsWith('.L')) {
                card.querySelector('.current-value').textContent = `${trade.currencySymbol || '£'}${((trade.currentValue || 0) / 100).toFixed(2)}`;
                card.querySelector('.stop-loss').textContent = `${(trade.stopLossPrice || 0).toFixed(2)}p`;
                card.querySelector('.target').textContent = `${(trade.targetPrice || 0).toFixed(2)}p`;
            } else {
                card.querySelector('.current-value').textContent = `${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${(trade.currentValue || 0).toFixed(2)}`;
                card.querySelector('.stop-loss').textContent = `${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${(trade.stopLossPrice || 0).toFixed(2)}`;
                card.querySelector('.target').textContent = `${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${(trade.targetPrice || 0).toFixed(2)}`;
            }
            
            // Calculate holding days for active trades
            let holdingDays = 0;
            let holdingDaysText = '0 days'; // Default text
            
            if (trade.entryDate) {
                try {
                    const entryDate = trade.entryDate instanceof Date ? trade.entryDate : new Date(trade.entryDate);
                    const currentDate = new Date();
                    
                    if (!isNaN(entryDate.getTime())) {
                        holdingDays = Math.floor((currentDate - entryDate) / (1000 * 60 * 60 * 24));
                        // Handle negative days (future entry dates)
                        if (holdingDays < 0) holdingDays = 0;
                        
                        holdingDaysText = `${holdingDays} days`;
                        
                        // Debug log for first trade
                        if (index === 0) {
                        }
                    } else {
                        console.error(`Invalid entry date for trade ${trade.symbol}:`, trade.entryDate);
                        holdingDaysText = '0 days';
                    }
                } catch (error) {
                    console.error(`Error calculating holding days for trade ${trade.symbol}:`, error);
                    holdingDaysText = '0 days';
                }
            } else {
                console.warn(`No entry date for trade ${trade.symbol}`);
                holdingDaysText = '0 days';
            }
            
            const holdingDaysElement = card.querySelector('.holding-days');
            if (holdingDaysElement) {
                // Clear any existing content first
                holdingDaysElement.innerHTML = '';
                // Use the calculated text
                holdingDaysElement.textContent = holdingDaysText;
                // Debug - make sure element was found and updated
                if (index === 0) {
                }
            } else {
                console.error('Could not find holding-days element in card for trade:', trade.symbol);
            }
            
            const squareOffDateElement = card.querySelector('.square-off-date');
            if (squareOffDateElement) {
                squareOffDateElement.textContent = TradeCore.formatDate(trade.squareOffDate);
            }
            
            // Days remaining
            let daysRemaining = 30; // Default
            if (trade.squareOffDate) {
                const squareOffDate = trade.squareOffDate instanceof Date ? trade.squareOffDate : new Date(trade.squareOffDate);
                
                if (!isNaN(squareOffDate.getTime())) {
                    const currentDate = new Date();
                    daysRemaining = Math.max(0, Math.floor((squareOffDate - currentDate) / (1000 * 60 * 60 * 24)));
                } else {
                    console.error(`Invalid square off date for trade ${trade.symbol}:`, trade.squareOffDate);
                }
            }
            
            const daysRemainingElement = card.querySelector('.days-remaining');
            if (daysRemainingElement) {
                daysRemainingElement.textContent = daysRemaining;
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
            
            // Add the card to the container with animation
            container.appendChild(card);
            
            // Trigger animation after a short delay (staggered)
            setTimeout(() => {
                card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, 50 * index); // Stagger the animations
        } catch (error) {
            console.error("Error rendering trade card:", error, trade);
            TradeCore.showNotification('Error displaying a trade card', 'error');
        }
    });
}

    /**
     * Render trade history tables with enhanced UI and scrolling
     */
    function renderTradeHistory() {
        // Check if we have trade history elements
        const noTradeHistory = document.getElementById('no-trade-history');
        const tradesHistoryTable = document.getElementById('trades-history-table');
        const noWinningTrades = document.getElementById('no-winning-trades');
        const winningTradesTable = document.getElementById('winning-trades-table');
        const noLosingTrades = document.getElementById('no-losing-trades');
        const losingTradesTable = document.getElementById('losing-trades-table');
        
        if (!noTradeHistory || !tradesHistoryTable) {
            return;
        }
        
        const closedTrades = TradeCore.getTrades('closed');
        
        if (closedTrades.length === 0) {
            noTradeHistory.style.display = 'block';
            tradesHistoryTable.style.display = 'none';
            
            if (noWinningTrades && winningTradesTable) {
                noWinningTrades.style.display = 'block';
                winningTradesTable.style.display = 'none';
            }
            
            if (noLosingTrades && losingTradesTable) {
                noLosingTrades.style.display = 'block';
                losingTradesTable.style.display = 'none';
            }
            return;
        }
        
        // Populate all trades table
        noTradeHistory.style.display = 'none';
        tradesHistoryTable.style.display = 'block';
        
        // Show P&L summary for all trades
        renderPLSummary(closedTrades, 'pl-summary-all');
        
        const allTableBody = document.getElementById('history-table-body');
        if (allTableBody) {
            allTableBody.innerHTML = '';
            
            closedTrades.forEach((trade, index) => {
                const row = createTradeHistoryRow(trade);
                
                // Add animation for each row
                row.style.opacity = '0';
                allTableBody.appendChild(row);
                
                // Trigger animation after a short delay (staggered)
                setTimeout(() => {
                    row.style.transition = 'opacity 0.3s ease';
                    row.style.opacity = '1';
                }, 30 * index); // Stagger the animations
            });
        }
        
        // Populate winning trades table
        if (noWinningTrades && winningTradesTable) {
            const winningTrades = closedTrades.filter(trade => (trade.profitLossPercentage || trade.profitLoss || 0) > 0);
            
            if (winningTrades.length === 0) {
                noWinningTrades.style.display = 'block';
                winningTradesTable.style.display = 'none';
            } else {
                noWinningTrades.style.display = 'none';
                winningTradesTable.style.display = 'block';
                
                // Show P&L summary for winning trades
                renderPLSummary(winningTrades, 'pl-summary-winning');
                
                const winningTableBody = document.getElementById('winning-table-body');
                if (winningTableBody) {
                    winningTableBody.innerHTML = '';
                    
                    winningTrades.forEach((trade, index) => {
                        const row = createTradeHistoryRow(trade);
                        
                        // Add animation for each row
                        row.style.opacity = '0';
                        winningTableBody.appendChild(row);
                        
                        // Trigger animation after a short delay (staggered)
                        setTimeout(() => {
                            row.style.transition = 'opacity 0.3s ease';
                            row.style.opacity = '1';
                        }, 30 * index); // Stagger the animations
                    });
                }
            }
        }
        
        // Populate losing trades table
        if (noLosingTrades && losingTradesTable) {
            const losingTrades = closedTrades.filter(trade => (trade.profitLossPercentage || trade.profitLoss || 0) <= 0);
            
            if (losingTrades.length === 0) {
                noLosingTrades.style.display = 'block';
                losingTradesTable.style.display = 'none';
            } else {
                noLosingTrades.style.display = 'none';
                losingTradesTable.style.display = 'block';
                
                // Show P&L summary for losing trades
                renderPLSummary(losingTrades, 'pl-summary-losing');
                
                const losingTableBody = document.getElementById('losing-table-body');
                if (losingTableBody) {
                    losingTableBody.innerHTML = '';
                    
                    losingTrades.forEach((trade, index) => {
                        const row = createTradeHistoryRow(trade);
                        
                        // Add animation for each row
                        row.style.opacity = '0';
                        losingTableBody.appendChild(row);
                        
                        // Trigger animation after a short delay (staggered)
                        setTimeout(() => {
                            row.style.transition = 'opacity 0.3s ease';
                            row.style.opacity = '1';
                        }, 30 * index); // Stagger the animations
                    });
                }
            }
        }
    }
    
    /**
     * Render P&L summary cards by currency
     * @param {Array} trades - Array of trades to analyze
     * @param {string} containerId - ID of container to render summary in
     */
    function renderPLSummary(trades, containerId) {
        const container = document.getElementById(containerId);
        if (!container || trades.length === 0) {
            if (container) container.style.display = 'none';
            return;
        }
        
        // Calculate P&L by currency
        const currencyStats = {};
        
        trades.forEach(trade => {
            const symbol = trade.symbol || '';
            const isUKStock = symbol.endsWith('.L');
            const isIndianStock = symbol.endsWith('.NS');
            const currencySymbol = trade.currencySymbol || 
                (isUKStock ? '£' : 
                 isIndianStock ? '₹' : '$');
            
            if (!currencyStats[currencySymbol]) {
                currencyStats[currencySymbol] = {
                    totalPL: 0,
                    totalProfit: 0,
                    totalLoss: 0,
                    tradeCount: 0,
                    profitTrades: 0,
                    lossTrades: 0
                };
            }
            
            const plValue = Number(trade.profitLoss || trade.plValue) || 0;
            // For UK stocks, convert from pence to pounds for display
            // Indian (₹) and US ($) stocks are already in their base currency units
            const displayPLValue = isUKStock ? plValue / 100 : plValue;
            
            currencyStats[currencySymbol].totalPL += displayPLValue;
            currencyStats[currencySymbol].tradeCount++;
            
            if (displayPLValue > 0) {
                currencyStats[currencySymbol].totalProfit += displayPLValue;
                currencyStats[currencySymbol].profitTrades++;
            } else if (displayPLValue < 0) {
                currencyStats[currencySymbol].totalLoss += Math.abs(displayPLValue);
                currencyStats[currencySymbol].lossTrades++;
            }
        });
        
        // Clear container and render cards
        container.innerHTML = '';
        
        Object.entries(currencyStats).forEach(([currency, stats]) => {
            const netPL = stats.totalPL;
            const isProfit = netPL > 0;
            const avgPL = stats.tradeCount > 0 ? netPL / stats.tradeCount : 0;
            
            const card = document.createElement('div');
            card.className = `pl-summary-card ${isProfit ? 'profit' : (netPL < 0 ? 'loss' : '')}`;
            card.innerHTML = `
                <div class="pl-summary-header">
                    <h4 class="pl-summary-title">${currency} Market P&L</h4>
                    <div class="pl-summary-icon">${isProfit ? '📈' : (netPL < 0 ? '📉' : '📊')}</div>
                </div>
                <div class="pl-summary-amount ${isProfit ? 'profit' : (netPL < 0 ? 'loss' : '')}">${currency}${Math.abs(netPL).toFixed(2)}</div>
                <div class="pl-summary-details">
                    <span class="pl-summary-trades">${stats.tradeCount} trades</span>
                    <span class="pl-summary-avg">Avg: ${currency}${avgPL.toFixed(2)}</span>
                </div>
                ${stats.totalProfit > 0 && stats.totalLoss > 0 ? `
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color); font-size: 12px; color: var(--text-secondary);">
                    <div style="display: flex; justify-content: space-between;">
                        <span>Profits: ${currency}${stats.totalProfit.toFixed(2)} (${stats.profitTrades})</span>
                        <span>Losses: ${currency}${stats.totalLoss.toFixed(2)} (${stats.lossTrades})</span>
                    </div>
                </div>
                ` : ''}
            `;
            
            container.appendChild(card);
        });
        
        container.style.display = 'grid';
        
        // Add animations to cards
        const cards = container.querySelectorAll('.pl-summary-card');
        cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            setTimeout(() => {
                card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, 100 + (index * 100));
        });
    }
    
    /**
     * Create a table row for a closed trade with enhanced UI
     * @param {Object} trade - Trade object
     * @returns {HTMLTableRowElement} - Table row element
     */
    function createTradeHistoryRow(trade) {
        const row = document.createElement('tr');
        
        // Calculate holding period
        const entryDate = new Date(trade.entryDate);
        const exitDate = new Date(trade.exitDate);
        const holdingDays = Math.floor((exitDate - entryDate) / (1000 * 60 * 60 * 24));
        
        // Create exit reason tag class
        let exitTagClass = '';
        switch(trade.exitReason) {
            case 'Take Profit':
            case 'Target Reached':
                exitTagClass = 'tp-tag';
                break;
            case 'Stop Loss Hit':
            case 'Stop Loss':
                exitTagClass = 'sl-tag';
                break;
            case 'Time Exit':
                exitTagClass = 'time-tag';
                break;
            default:
                exitTagClass = 'end-tag';
                break;
        }
        
        // Create cells
        try {
            // Debug logging for TW.L trade specifically
            if (trade.symbol === 'TW.L' && trade.status === 'closed') {
            }
            
            // Ensure all numeric values are valid - API now always provides investmentAmount
            const investmentAmount = Number(trade.investmentAmount) || 0;
            // API now provides consistent profitLoss and profitLossPercentage fields for all trade statuses
            // But trade-core.js also maps them to plPercent and plValue for backward compatibility
            const plPercent = Number(trade.profitLossPercentage || trade.plPercent) || 0;
            const plValue = Number(trade.profitLoss || trade.plValue) || 0;
            
            // Debug logging for TW.L calculations
            if (trade.symbol === 'TW.L' && trade.status === 'closed') {
            }
            
            // For UK stocks, convert investment amount from pence to pounds for display
            // Indian and US stocks are already in their base currency units
            const isUKStock = trade.symbol && trade.symbol.endsWith('.L');
            const displayInvestment = isUKStock ? investmentAmount / 100 : investmentAmount;
            const displayPLValue = isUKStock ? plValue / 100 : plValue;
            
            // Get company name from mapping
            const displayName = window.CompanyNames ? 
                window.CompanyNames.getCompanyName(trade.symbol) : 
                trade.stockName || trade.symbol || 'Unknown';
            
            row.innerHTML = `
                <td>${displayName} <span class="stock-symbol">${trade.symbol || ''}</span></td>
                <td>${TradeCore.formatDate(trade.entryDate)}</td>
                <td>${TradeCore.formatDate(trade.exitDate)}</td>
                <td>${holdingDays} days</td>
                <td>${trade.currencySymbol || TradeCore.getCurrencySymbol(trade.symbol)}${displayInvestment.toFixed(2)}</td>
                <td class="${plPercent > 0 ? 'positive' : 'negative'}">${plPercent.toFixed(2)}%</td>
                <td class="${plValue > 0 ? 'positive' : 'negative'}">${trade.currencySymbol || TradeCore.getCurrencySymbol(trade.symbol)}${displayPLValue.toFixed(2)}</td>
                <td><span class="exit-tag ${exitTagClass}">${trade.exitReason || 'Unknown'}</span></td>
            `;
        } catch (error) {
            console.error("Error creating trade history row:", error, trade);
            row.innerHTML = '<td colspan="8">Error displaying trade</td>';
        }
        
        return row;
    }
    
    /**
     * Create a statistics card for a specific currency
     * @param {Object} stats - Statistics for this currency
     * @param {string} currencySymbol - Currency symbol
     * @returns {HTMLElement} - Statistics card element
     */
    function createCurrencyStatCard(stats, currencySymbol) {
        const statCard = document.createElement('div');
        statCard.className = 'currency-stat-card';
        statCard.setAttribute('data-currency', currencySymbol);
        
        // Debug UK stats
        if (currencySymbol === '£') {
        }
        
        statCard.innerHTML = `
            <div class="currency-header">
                <h4 class="currency-title">${currencySymbol} Markets</h4>
            </div>
            <div class="currency-stats-grid">
                <div class="statistic-card">
                    <div class="statistic-value" data-stat="active">${stats.totalActive}</div>
                    <div class="statistic-label">Active Trades</div>
                </div>
                <div class="statistic-card">
                    <div class="statistic-value" data-stat="invested">${currencySymbol}${currencySymbol === '£' ? (stats.totalInvested / 100).toFixed(2) : stats.totalInvested.toFixed(2)}</div>
                    <div class="statistic-label">Total Invested</div>
                </div>
                <div class="statistic-card ${stats.openPLPercent > 0 ? 'success' : (stats.openPLPercent < 0 ? 'danger' : '')}">
                    <div class="statistic-value ${stats.openPLPercent >= 0 ? 'positive' : 'negative'}" data-stat="openPL">${stats.openPLPercent.toFixed(2)}%</div>
                    <div class="statistic-label">Open P&L</div>
                </div>
                <div class="statistic-card">
                    <div class="statistic-value" data-stat="closed">${stats.totalClosed}</div>
                    <div class="statistic-label">Closed Trades</div>
                </div>
                <div class="statistic-card ${stats.winRate >= 50 ? 'success' : ''}">
                    <div class="statistic-value ${stats.winRate >= 50 ? 'positive' : ''}" data-stat="winRate">${stats.winRate.toFixed(2)}%</div>
                    <div class="statistic-label">Win Rate</div>
                </div>
                <div class="statistic-card ${stats.avgProfit > 0 ? 'success' : (stats.avgProfit < 0 ? 'danger' : '')}">
                    <div class="statistic-value ${stats.avgProfit > 0 ? 'positive' : (stats.avgProfit < 0 ? 'negative' : '')}" data-stat="avgProfit">${stats.avgProfit.toFixed(2)}%</div>
                    <div class="statistic-label">Avg Profit/Trade</div>
                </div>
            </div>
        `;
        
        return statCard;
    }
    
    /**
     * Update trading statistics with enhanced UI and currency distinction
     */
    // Track if stats have been initialized
    let statsInitialized = false;
    
    function updateStatistics(quickUpdate = false) {
        // Get the trading statistics container
        const statsContainer = document.getElementById('trading-statistics');
        if (!statsContainer) {
            return;
        }
        
        // Get the currency-specific statistics
        const currencyStats = TradeCore.getTradeStatisticsByCurrency();
        
        // If doing a quick update and stats are already initialized, just update values
        if (quickUpdate && statsInitialized && statsContainer.children.length > 0) {
            updateStatisticsValues(currencyStats);
            return;
        }
        
        // Otherwise, do a full render
        statsInitialized = true;
        
        // Clear the existing statistics
        statsContainer.innerHTML = '';
        
        // If there are no currency-specific stats, use the overall stats
        if (Object.keys(currencyStats.currencies).length === 0) {
            renderOverallStatistics(statsContainer, currencyStats.overall);
            return;
        }
        
        // Add currency sections
        for (const currencySymbol in currencyStats.currencies) {
            const currencyStatCard = createCurrencyStatCard(
                currencyStats.currencies[currencySymbol], 
                currencySymbol
            );
            statsContainer.appendChild(currencyStatCard);
        }

        // Add animations to statistics cards
        const statCards = document.querySelectorAll('.statistic-card');
        if (statCards.length > 0) {
            statCards.forEach((card, index) => {
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }, 100 + (index * 30));
            });
        }
    }
    
    /**
     * Update only the statistic values without recreating DOM
     */
    function updateStatisticsValues(currencyStats) {
        // Update overall stats if present
        const activeCount = document.getElementById('active-trade-count');
        const totalInvested = document.getElementById('total-invested');
        const openPL = document.getElementById('open-pl');
        const closedCount = document.getElementById('closed-trades-count');
        const winRate = document.getElementById('win-rate');
        const avgProfit = document.getElementById('avg-profit');
        
        if (activeCount) {
            activeCount.textContent = currencyStats.overall.totalActive;
        }
        
        if (totalInvested) {
            // For mixed currency portfolios, we can't show a meaningful total
            // Check if we have multiple currencies
            const currencyCount = Object.keys(currencyStats.currencies).length;
            if (currencyCount > 1) {
                totalInvested.textContent = 'Multi-currency';
            } else if (currencyCount === 1) {
                // Single currency - show with proper conversion
                const currency = Object.keys(currencyStats.currencies)[0];
                const amount = currencyStats.overall.totalInvested;
                const displayAmount = currency === '£' ? (amount / 100).toFixed(2) : amount.toFixed(2);
                totalInvested.textContent = `${currency}${displayAmount}`;
            } else {
                totalInvested.textContent = `${TradeCore.CURRENCY_SYMBOL}0.00`;
            }
        }
        
        if (openPL) {
            const plValue = currencyStats.overall.openPLPercent;
            openPL.textContent = `${plValue.toFixed(2)}%`;
            openPL.className = plValue >= 0 ? 'positive' : 'negative';
            
            // Update card styling
            const plCard = openPL.closest('.statistic-card');
            if (plCard) {
                plCard.className = `statistic-card ${plValue > 0 ? 'success' : (plValue < 0 ? 'danger' : '')}`;
            }
        }
        
        if (closedCount) {
            closedCount.textContent = currencyStats.overall.totalClosed;
        }
        
        if (winRate) {
            const rate = currencyStats.overall.winRate;
            winRate.textContent = `${rate.toFixed(2)}%`;
            winRate.className = rate >= 50 ? 'positive' : '';
            
            // Update card styling
            const rateCard = winRate.closest('.statistic-card');
            if (rateCard) {
                rateCard.className = `statistic-card ${rate >= 50 ? 'success' : ''}`;
            }
        }
        
        if (avgProfit) {
            const profit = currencyStats.overall.avgProfit;
            avgProfit.textContent = `${profit.toFixed(2)}%`;
            avgProfit.className = profit > 0 ? 'positive' : (profit < 0 ? 'negative' : '');
            
            // Update card styling
            const profitCard = avgProfit.closest('.statistic-card');
            if (profitCard) {
                profitCard.className = `statistic-card ${profit > 0 ? 'success' : (profit < 0 ? 'danger' : '')}`;
            }
        }
        
        // Update currency-specific stats
        for (const currencySymbol in currencyStats.currencies) {
            const stats = currencyStats.currencies[currencySymbol];
            const section = document.querySelector(`[data-currency="${currencySymbol}"]`);
            
            if (section) {
                // Update values in this currency section
                const elements = {
                    active: section.querySelector('[data-stat="active"]'),
                    invested: section.querySelector('[data-stat="invested"]'),
                    openPL: section.querySelector('[data-stat="openPL"]'),
                    closed: section.querySelector('[data-stat="closed"]'),
                    winRate: section.querySelector('[data-stat="winRate"]'),
                    avgProfit: section.querySelector('[data-stat="avgProfit"]')
                };
                
                if (elements.active) elements.active.textContent = stats.totalActive;
                if (elements.invested) {
                    const displayInvested = currencySymbol === '£' ? (stats.totalInvested / 100).toFixed(2) : stats.totalInvested.toFixed(2);
                    elements.invested.textContent = `${currencySymbol}${displayInvested}`;
                }
                if (elements.openPL) {
                    elements.openPL.textContent = `${stats.openPLPercent.toFixed(2)}%`;
                    elements.openPL.className = stats.openPLPercent >= 0 ? 'positive' : 'negative';
                }
                if (elements.closed) elements.closed.textContent = stats.totalClosed;
                if (elements.winRate) {
                    elements.winRate.textContent = `${stats.winRate.toFixed(2)}%`;
                    elements.winRate.className = stats.winRate >= 50 ? 'positive' : '';
                }
                if (elements.avgProfit) {
                    elements.avgProfit.textContent = `${stats.avgProfit.toFixed(2)}%`;
                    elements.avgProfit.className = stats.avgProfit > 0 ? 'positive' : (stats.avgProfit < 0 ? 'negative' : '');
                }
            }
        }
    }
    
    /**
     * Render overall statistics (legacy style, for backward compatibility)
     * @param {HTMLElement} container - Container to render statistics in
     * @param {Object} stats - Overall statistics
     */
    function renderOverallStatistics(container, stats) {
        container.innerHTML = `
            <div class="statistic-card">
                <div class="statistic-value" id="active-trade-count">${stats.totalActive}</div>
                <div class="statistic-label">Active Trades</div>
            </div>
            <div class="statistic-card">
                <div class="statistic-value" id="total-invested">${TradeCore.CURRENCY_SYMBOL}${stats.totalInvested.toFixed(2)}</div>
                <div class="statistic-label">Total Invested</div>
            </div>
            <div class="statistic-card ${stats.openPLPercent > 0 ? 'success' : (stats.openPLPercent < 0 ? 'danger' : '')}">
                <div class="statistic-value ${stats.openPLPercent >= 0 ? 'positive' : 'negative'}" id="open-pl">${stats.openPLPercent.toFixed(2)}%</div>
                <div class="statistic-label">Open P&L</div>
            </div>
            <div class="statistic-card">
                <div class="statistic-value" id="closed-trades-count">${stats.totalClosed}</div>
                <div class="statistic-label">Closed Trades</div>
            </div>
            <div class="statistic-card ${stats.winRate >= 50 ? 'success' : ''}">
                <div class="statistic-value ${stats.winRate >= 50 ? 'positive' : ''}" id="win-rate">${stats.winRate.toFixed(2)}%</div>
                <div class="statistic-label">Win Rate</div>
            </div>
            <div class="statistic-card ${stats.avgProfit > 0 ? 'success' : (stats.avgProfit < 0 ? 'danger' : '')}">
                <div class="statistic-value ${stats.avgProfit > 0 ? 'positive' : (stats.avgProfit < 0 ? 'negative' : '')}" id="avg-profit">${stats.avgProfit.toFixed(2)}%</div>
                <div class="statistic-label">Avg Profit/Trade</div>
            </div>
        `;
    }

    // Return public API
    return {
        init,
        renderActiveTrades,
        renderTradeHistory,
        updateStatistics,
        updateStatisticsValues
    };
})();