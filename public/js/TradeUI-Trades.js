/**
 * v3 Poster bits on a cloned position card: the stop-to-target rail,
 * the days bar, and the exit-rule badge. Shared by every template cloner.
 */
window.applyPosterPositionBits = function (card, plValue, holdingDays, daysRemaining) {
    const railFill = card.querySelector('.sa-pos__fill');
    if (railFill) {
        const clamped = Math.max(-5, Math.min(8, plValue));
        railFill.style.width = (((clamped + 5) / 13) * 100).toFixed(2) + '%';
        railFill.classList.toggle('is-gain', plValue >= 0);
        railFill.classList.toggle('is-loss', plValue < 0);
    }
    const daysBar = card.querySelector('.pos-daysbar i');
    if (daysBar) {
        daysBar.style.width = Math.max(0, Math.min(100, (holdingDays / 30) * 100)).toFixed(1) + '%';
    }
    const exitBadge = card.querySelector('.pos-exit-badge');
    if (exitBadge) {
        exitBadge.textContent = 'Day ' + holdingDays + ' of 30 \u2014 sells itself in '
            + daysRemaining + (daysRemaining === 1 ? ' day' : ' days');
        exitBadge.classList.toggle('sa-badge--warn', daysRemaining <= 5);
        exitBadge.classList.toggle('sa-badge--neutral', daysRemaining > 5);
    }
};

/**
 * v3 Poster renderer helpers (safe DOM construction).
 */
function posEl(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
}

function posExitLabel(reason) {
    switch (reason) {
        case 'Take Profit':
        case 'Target Reached': return 'Hit the +8% target';
        case 'Stop Loss':
        case 'Stop Loss Hit': return 'Hit the \u22125% stop';
        case 'Time Exit': return 'Ran out of time';
        case 'Manual Exit': return 'Sold by hand';
        case 'Strategy Change': return 'The rule changed';
        case 'End of Data': return 'Backtest ended';
        default: return reason || 'Unknown';
    }
}

function posExitTone(reason) {
    switch (reason) {
        case 'Take Profit':
        case 'Target Reached': return 'gain';
        case 'Stop Loss':
        case 'Stop Loss Hit': return 'loss';
        default: return 'neutral';
    }
}

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
                card.querySelector('.investment').textContent = `${trade.currencySymbol || '£'}${(trade.investmentAmount || 0).toFixed(2)}`;
            } else {
                card.querySelector('.entry-price').textContent = `${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${(trade.entryPrice || 0).toFixed(2)}`;
                card.querySelector('.current-price').textContent = `${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${(trade.currentPrice || 0).toFixed(2)}`;
                card.querySelector('.investment').textContent = `${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${(trade.investmentAmount || 0).toFixed(2)}`;
            }
            
            // Special handling for shares
            const sharesElement = card.querySelector('.shares');
            if (trade.shares === 0 || !trade.shares) {
                sharesElement.textContent = '0';
                sharesElement.classList.add('shares-warning');
                sharesElement.title = 'No shares recorded - please edit this trade';
            } else {
                sharesElement.textContent = (trade.shares || 0).toLocaleString();
            }
            
            // Handle UK stocks pricing (pence to pounds conversion)
            if (trade.symbol && trade.symbol.endsWith('.L')) {
                card.querySelector('.current-value').textContent = `${trade.currencySymbol || '£'}${(trade.currentValue || 0).toFixed(2)}`;
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
                        holdingDaysText = '0 days';
                    }
                } catch (error) {
                    holdingDaysText = '0 days';
                }
            } else {
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
                }
            }
            
            const daysRemainingElement = card.querySelector('.days-remaining');
            if (daysRemainingElement) {
                daysRemainingElement.textContent = daysRemaining;
            }

            window.applyPosterPositionBits(card, plValue, holdingDays, daysRemaining);
            
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
            allTableBody.replaceChildren();
            const cardsBox = document.getElementById('history-cards-body');
            if (cardsBox) cardsBox.replaceChildren();

            closedTrades.forEach((trade) => {
                allTableBody.appendChild(createTradeHistoryRow(trade));
                if (cardsBox) cardsBox.appendChild(createTradeHistoryCard(trade));
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
                    winningTableBody.replaceChildren();
                    const cardsBox = document.getElementById('winning-cards-body');
                    if (cardsBox) cardsBox.replaceChildren();

                    winningTrades.forEach((trade) => {
                        winningTableBody.appendChild(createTradeHistoryRow(trade));
                        if (cardsBox) cardsBox.appendChild(createTradeHistoryCard(trade));
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
                    losingTableBody.replaceChildren();
                    const cardsBox = document.getElementById('losing-cards-body');
                    if (cardsBox) cardsBox.replaceChildren();

                    losingTrades.forEach((trade) => {
                        losingTableBody.appendChild(createTradeHistoryRow(trade));
                        if (cardsBox) cardsBox.appendChild(createTradeHistoryCard(trade));
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
                (isUKStock ? '\u00a3' :
                 isIndianStock ? '\u20b9' : '$');

            if (!currencyStats[currencySymbol]) {
                currencyStats[currencySymbol] = {
                    totalPL: 0, totalProfit: 0, totalLoss: 0,
                    tradeCount: 0, profitTrades: 0, lossTrades: 0
                };
            }

            const plValue = Number(trade.profitLoss || trade.plValue) || 0;
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

        container.replaceChildren();

        Object.entries(currencyStats).forEach(([currency, stats]) => {
            const netPL = stats.totalPL;
            const tone = netPL > 0 ? 'gain' : (netPL < 0 ? 'loss' : '');
            const avgPL = stats.tradeCount > 0 ? netPL / stats.tradeCount : 0;

            const card = posEl('div', 'pl-summary-card statistic-card sa-card--sunk' + (tone ? ' ' + tone : ''));
            const stat = posEl('div', 'sa-stat');
            stat.appendChild(posEl('span', 'sa-stat__label', currency + ' markets'));
            stat.appendChild(posEl('span', 'sa-stat__value sa-stat__value--sm' + (tone ? ' sa-stat__value--' + tone : ''),
                (netPL < 0 ? '\u2212' : '') + currency + Math.abs(netPL).toFixed(2)));
            let context = stats.tradeCount + (stats.tradeCount === 1 ? ' trade' : ' trades')
                + ' \u00b7 average ' + (avgPL < 0 ? '\u2212' : '') + currency + Math.abs(avgPL).toFixed(2) + ' each';
            if (stats.totalProfit > 0 && stats.totalLoss > 0) {
                context += ' \u00b7 made ' + currency + stats.totalProfit.toFixed(2)
                    + ', lost ' + currency + stats.totalLoss.toFixed(2);
            }
            stat.appendChild(posEl('span', 'sa-stat__context', context));
            card.appendChild(stat);
            container.appendChild(card);
        });

        container.style.display = 'grid';
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

        try {
            const investmentAmount = Number(trade.investmentAmount) || 0;
            const plPercent = Number(trade.profitLossPercentage || trade.plPercent) || 0;
            const plValue = Number(trade.profitLoss || trade.plValue) || 0;
            const currency = trade.currencySymbol || TradeCore.getCurrencySymbol(trade.symbol);
            const tone = plPercent > 0 ? 'gain' : 'loss';

            const displayName = window.CompanyNames ?
                window.CompanyNames.getCompanyName(trade.symbol) :
                trade.stockName || trade.symbol || 'Unknown';

            const stockTd = document.createElement('td');
            stockTd.appendChild(posEl('strong', null, displayName));
            stockTd.appendChild(document.createTextNode(' '));
            stockTd.appendChild(posEl('span', 'stock-symbol', trade.symbol || ''));
            row.appendChild(stockTd);
            row.appendChild(posEl('td', null, TradeCore.formatDate(trade.entryDate)));
            row.appendChild(posEl('td', null, TradeCore.formatDate(trade.exitDate)));
            row.appendChild(posEl('td', 'num', holdingDays + ' days'));
            row.appendChild(posEl('td', 'num', currency + investmentAmount.toFixed(2)));
            row.appendChild(posEl('td', 'num ' + tone, plPercent.toFixed(2) + '%'));
            row.appendChild(posEl('td', 'num ' + (plValue > 0 ? 'gain' : 'loss'),
                (plValue < 0 ? '\u2212' : '') + currency + Math.abs(plValue).toFixed(2)));
            const reasonTd = document.createElement('td');
            reasonTd.appendChild(posEl('span', 'sa-badge sa-badge--' + posExitTone(trade.exitReason), posExitLabel(trade.exitReason)));
            row.appendChild(reasonTd);
        } catch (error) {
            const errTd = posEl('td', null, 'Error displaying trade');
            errTd.colSpan = 8;
            row.appendChild(errTd);
        }

        return row;
    }

    /**
     * Stacked card version of a closed trade for narrow screens.
     * @param {Object} trade - Trade object
     * @returns {HTMLElement}
     */
    function createTradeHistoryCard(trade) {
        const entryDate = new Date(trade.entryDate);
        const exitDate = new Date(trade.exitDate);
        const holdingDays = Math.floor((exitDate - entryDate) / (1000 * 60 * 60 * 24));
        const investmentAmount = Number(trade.investmentAmount) || 0;
        const plPercent = Number(trade.profitLossPercentage || trade.plPercent) || 0;
        const plValue = Number(trade.profitLoss || trade.plValue) || 0;
        const currency = trade.currencySymbol || TradeCore.getCurrencySymbol(trade.symbol);
        const displayName = window.CompanyNames ?
            window.CompanyNames.getCompanyName(trade.symbol) :
            trade.stockName || trade.symbol || 'Unknown';

        const rc = posEl('div', 'sa-rowcard');
        const top = posEl('div', 'sa-rowcard__top');
        const title = posEl('strong', null, trade.symbol || displayName);
        top.appendChild(title);
        top.appendChild(posEl('span', 'sa-rowcard__v ' + (plPercent > 0 ? 'gain' : 'loss'), plPercent.toFixed(2) + '%'));
        rc.appendChild(top);
        const grid = posEl('div', 'sa-rowcard__grid');
        [['Sold on', TradeCore.formatDate(trade.exitDate)],
         ['Held for', holdingDays + ' days'],
         ['Put in', currency + investmentAmount.toFixed(2)],
         ['Result', (plValue < 0 ? '\u2212' : '') + currency + Math.abs(plValue).toFixed(2)],
         ['Why it sold', posExitLabel(trade.exitReason)]].forEach(pair => {
            grid.appendChild(posEl('span', 'sa-rowcard__k', pair[0]));
            grid.appendChild(posEl('span', 'sa-rowcard__v', pair[1]));
        });
        rc.appendChild(grid);
        return rc;
    }
    
    /**
     * Create a statistics card for a specific currency
     * @param {Object} stats - Statistics for this currency
     * @param {string} currencySymbol - Currency symbol
     * @returns {HTMLElement} - Statistics card element
     */
    function createCurrencyStatCard(stats, currencySymbol) {
        const statCard = posEl('div', 'currency-stat-card');
        statCard.setAttribute('data-currency', currencySymbol);

        statCard.appendChild(posEl('h4', 'currency-title', currencySymbol + ' markets'));

        const grid = posEl('div', 'currency-stats-grid');
        const mk = (label, valueText, context, dataStat, valueTone, cardTone) => {
            const cardEl = posEl('div', 'statistic-card sa-card--sunk' + (cardTone ? ' ' + cardTone : ''));
            const stat = posEl('div', 'sa-stat');
            stat.appendChild(posEl('span', 'sa-stat__label', label));
            const value = posEl('span', 'sa-stat__value sa-stat__value--sm statistic-value' + (valueTone ? ' ' + valueTone : ''), valueText);
            value.setAttribute('data-stat', dataStat);
            stat.appendChild(value);
            stat.appendChild(posEl('span', 'sa-stat__context', context));
            cardEl.appendChild(stat);
            return cardEl;
        };

        grid.appendChild(mk('Holding now', String(stats.totalActive),
            'Positions open right now.', 'active'));
        grid.appendChild(mk('In the market', currencySymbol + stats.totalInvested.toFixed(2),
            'Money currently at work.', 'invested'));
        grid.appendChild(mk('Open profit and loss', stats.openPLPercent.toFixed(2) + '%',
            'Nothing is locked in until it sells.', 'openPL',
            stats.openPLPercent >= 0 ? 'positive' : 'negative',
            stats.openPLPercent > 0 ? 'success' : (stats.openPLPercent < 0 ? 'danger' : '')));
        grid.appendChild(mk('Already sold', String(stats.totalClosed),
            'Positions that have become trades.', 'closed'));
        grid.appendChild(mk('Win rate', stats.winRate.toFixed(2) + '%',
            'Closed trades that made money.', 'winRate',
            stats.winRate >= 50 ? 'positive' : '',
            stats.winRate >= 50 ? 'success' : ''));
        grid.appendChild(mk('Average per trade', stats.avgProfit.toFixed(2) + '%',
            'The mean result of one closed trade.', 'avgProfit',
            stats.avgProfit > 0 ? 'positive' : (stats.avgProfit < 0 ? 'negative' : ''),
            stats.avgProfit > 0 ? 'success' : (stats.avgProfit < 0 ? 'danger' : '')));

        statCard.appendChild(grid);
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
                // Single currency - display amount as-is (already in base currency)
                const currency = Object.keys(currencyStats.currencies)[0];
                const amount = currencyStats.overall.totalInvested;
                const displayAmount = amount.toFixed(2);
                totalInvested.textContent = `${currency}${displayAmount}`;
            } else {
                totalInvested.textContent = `${TradeCore.CURRENCY_SYMBOL}0.00`;
            }
        }
        
        if (openPL) {
            const plValue = currencyStats.overall.openPLPercent;
            openPL.textContent = `${plValue.toFixed(2)}%`;
            openPL.classList.toggle('positive', plValue >= 0);
            openPL.classList.toggle('negative', plValue < 0);
            
            // Update card styling
            const plCard = openPL.closest('.statistic-card');
            if (plCard) {
                plCard.classList.toggle('success', plValue > 0);
                plCard.classList.toggle('danger', plValue < 0);
            }
        }
        
        if (closedCount) {
            closedCount.textContent = currencyStats.overall.totalClosed;
        }
        
        if (winRate) {
            const newRate = currencyStats.overall.winRate;
            const oldRate = parseFloat(winRate.textContent) || 0;

            winRate.textContent = `${newRate.toFixed(2)}%`;
            winRate.classList.toggle('positive', newRate >= 50);

            // Add animation if value changed
            if (Math.abs(newRate - oldRate) > 0.01) {
                if (newRate > oldRate) {
                    winRate.classList.add('value-increase');
                    setTimeout(() => winRate.classList.remove('value-increase'), 800);
                } else if (newRate < oldRate) {
                    winRate.classList.add('value-decrease');
                    setTimeout(() => winRate.classList.remove('value-decrease'), 800);
                }
            }

            // Update card styling
            const rateCard = winRate.closest('.statistic-card');
            if (rateCard) {
                rateCard.classList.toggle('success', newRate >= 50);
            }
        }
        
        if (avgProfit) {
            const newProfit = currencyStats.overall.avgProfit;
            const oldProfit = parseFloat(avgProfit.textContent) || 0;

            avgProfit.textContent = `${newProfit.toFixed(2)}%`;
            avgProfit.classList.toggle('positive', newProfit > 0);
            avgProfit.classList.toggle('negative', newProfit < 0);

            // Add animation if value changed
            if (Math.abs(newProfit - oldProfit) > 0.01) {
                if (newProfit > oldProfit) {
                    avgProfit.classList.add('value-increase');
                    setTimeout(() => avgProfit.classList.remove('value-increase'), 800);
                } else if (newProfit < oldProfit) {
                    avgProfit.classList.add('value-decrease');
                    setTimeout(() => avgProfit.classList.remove('value-decrease'), 800);
                }
            }

            // Update card styling
            const profitCard = avgProfit.closest('.statistic-card');
            if (profitCard) {
                profitCard.classList.toggle('success', newProfit > 0);
                profitCard.classList.toggle('danger', newProfit < 0);
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
                    const displayInvested = stats.totalInvested.toFixed(2);
                    elements.invested.textContent = `${currencySymbol}${displayInvested}`;
                }
                if (elements.openPL) {
                    elements.openPL.textContent = `${stats.openPLPercent.toFixed(2)}%`;
                    elements.openPL.classList.toggle('positive', stats.openPLPercent >= 0);
                    elements.openPL.classList.toggle('negative', stats.openPLPercent < 0);
                }
                if (elements.closed) elements.closed.textContent = stats.totalClosed;
                if (elements.winRate) {
                    elements.winRate.textContent = `${stats.winRate.toFixed(2)}%`;
                    elements.winRate.classList.toggle('positive', stats.winRate >= 50);
                }
                if (elements.avgProfit) {
                    elements.avgProfit.textContent = `${stats.avgProfit.toFixed(2)}%`;
                    elements.avgProfit.classList.toggle('positive', stats.avgProfit > 0);
                    elements.avgProfit.classList.toggle('negative', stats.avgProfit < 0);
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
        container.replaceChildren();
        const mk = (label, valueText, context, id, valueTone, cardTone) => {
            const cardEl = posEl('div', 'statistic-card sa-card--sunk' + (cardTone ? ' ' + cardTone : ''));
            const stat = posEl('div', 'sa-stat');
            stat.appendChild(posEl('span', 'sa-stat__label', label));
            const value = posEl('span', 'sa-stat__value statistic-value' + (valueTone ? ' ' + valueTone : ''), valueText);
            value.id = id;
            stat.appendChild(value);
            stat.appendChild(posEl('span', 'sa-stat__context', context));
            cardEl.appendChild(stat);
            return cardEl;
        };

        container.appendChild(mk('Holding right now', String(stats.totalActive),
            'Positions the formula is tracking for you.', 'active-trade-count'));
        container.appendChild(mk('In the market', TradeCore.CURRENCY_SYMBOL + stats.totalInvested.toFixed(2),
            "Across everything you're holding.", 'total-invested'));
        container.appendChild(mk('Open profit and loss', stats.openPLPercent.toFixed(2) + '%',
            'Nothing is locked in until it sells.', 'open-pl',
            stats.openPLPercent >= 0 ? 'positive' : 'negative',
            stats.openPLPercent > 0 ? 'success' : (stats.openPLPercent < 0 ? 'danger' : '')));
        container.appendChild(mk('Already sold', String(stats.totalClosed),
            'Positions that have become trades.', 'closed-trades-count'));
        container.appendChild(mk('Win rate', stats.winRate.toFixed(2) + '%',
            'How many closed trades made money.', 'win-rate',
            stats.winRate >= 50 ? 'positive' : '',
            stats.winRate >= 50 ? 'success' : ''));
        container.appendChild(mk('Average per trade', stats.avgProfit.toFixed(2) + '%',
            'The mean result of one closed trade.', 'avg-profit',
            stats.avgProfit > 0 ? 'positive' : (stats.avgProfit < 0 ? 'negative' : ''),
            stats.avgProfit > 0 ? 'success' : (stats.avgProfit < 0 ? 'danger' : '')));
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