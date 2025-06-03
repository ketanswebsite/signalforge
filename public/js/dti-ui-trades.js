/**
 * DTI Backtester - UI Trade Display Module
 * Handles display of statistics, trade tables, and trade opportunities
 */

// Create TradeDisplay namespace
DTIUI.TradeDisplay = (function() {
    /**
     * Create buying opportunities section if it doesn't exist
     */
    function createBuyingOpportunitiesSection() {
        // Create container if it doesn't exist
        if (!document.getElementById('buying-opportunities')) {
            const opportunitiesSection = document.createElement('div');
            opportunitiesSection.className = 'card buying-opportunities-section';
            opportunitiesSection.id = 'buying-opportunities';
            opportunitiesSection.innerHTML = `
                <h3 class="card-title">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="14 2 18 6 7 17 3 17 3 13 14 2"></polygon>
                        <line x1="3" y1="22" x2="21" y2="22"></line>
                    </svg>
                    Current Buying Opportunities
                </h3>
                <p class="no-opportunities">No active buying opportunities found. Try adjusting parameters or running a full scan.</p>
            `;
            
            // Add to main content, after backtest results
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.appendChild(opportunitiesSection);
            }
        }
    }
    
    /**
     * Display active trade opportunities with "Take a Trade" button
     */
function displayBuyingOpportunities() {
    console.log("Display function called, opportunities:", 
        DTIBacktester.activeTradeOpportunities ? 
        DTIBacktester.activeTradeOpportunities.length : 0);
    
    // Send direct alerts for current opportunities
    if (DTIBacktester.activeTradeOpportunities && DTIBacktester.activeTradeOpportunities.length > 0) {
        console.log("🔔 Sending direct alerts for current opportunities...");
        setTimeout(() => {
            sendDirectOpportunityAlerts(DTIBacktester.activeTradeOpportunities);
        }, 1000);
    }
    
    const opportunitiesContainer = document.getElementById('buying-opportunities');
    
    if (!opportunitiesContainer) {
        console.error("Opportunities container not found in DOM");
        return;
    }
    
    // Get scan type for display
    const scanTypeSelector = document.getElementById('scan-type-selector');
    const scanType = scanTypeSelector ? scanTypeSelector.value : 'current';
    const scanTypeName = scanTypeSelector && scanType !== 'current' 
        ? scanTypeSelector.options[scanTypeSelector.selectedIndex].text 
        : (DTIBacktester.currentStockIndex === 'nifty50' ? 'Nifty 50' : 
           DTIBacktester.currentStockIndex === 'niftyNext50' ? 'Nifty Next 50' : 
           DTIBacktester.currentStockIndex === 'niftyMidcap150' ? 'Nifty Midcap 150' :
           DTIBacktester.currentStockIndex === 'ftse100' ? 'FTSE 100' :
           DTIBacktester.currentStockIndex === 'ftse250' ? 'FTSE 250' :
           DTIBacktester.currentStockIndex === 'usStocks' ? 'US Stocks' :
           DTIBacktester.currentStockIndex === 'indices' ? 'Market Indices' : 'Nifty 50');
    
    if (!DTIBacktester.activeTradeOpportunities || DTIBacktester.activeTradeOpportunities.length === 0) {
        console.log("No opportunities found, displaying empty state");
        opportunitiesContainer.innerHTML = `
            <h3 class="card-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="14 2 18 6 7 17 3 17 3 13 14 2"></polygon>
                    <line x1="3" y1="22" x2="21" y2="22"></line>
                </svg>
                ${scanType !== 'current' ? 'Multi-Index Scan: ' : ''}${scanTypeName} Buying Opportunities
            </h3>
            <p class="no-opportunities">No active buying opportunities found. Try adjusting parameters or running a full scan.</p>
        `;
        return;
    }

    console.log("Processing opportunities for display...");
    
         
        // Calculate win rates for each stock
        const stockWinRates = DTIUI.calculateStockWinRates();
        
        // Group opportunities by conviction level
        const highConvictionOpportunities = [];
        const moderateConvictionOpportunities = [];
        const lowConvictionOpportunities = [];
        
        DTIBacktester.activeTradeOpportunities.forEach(opportunity => {
            const winRate = stockWinRates[opportunity.stock.symbol] || 0;
            
            if (winRate > 75) {
                highConvictionOpportunities.push(opportunity);
            } else if (winRate >= 50) {
                moderateConvictionOpportunities.push(opportunity);
            } else {
                lowConvictionOpportunities.push(opportunity);
            }
        });
        
        // Sort opportunities within each group by recency
        const sortByDate = (a, b) => b.trade.signalDate - a.trade.signalDate;
        
        highConvictionOpportunities.sort(sortByDate);
        moderateConvictionOpportunities.sort(sortByDate);
        lowConvictionOpportunities.sort(sortByDate);
        
        // Create HTML content
        let html = `
            <h3 class="card-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="14 2 18 6 7 17 3 17 3 13 14 2"></polygon>
                    <line x1="3" y1="22" x2="21" y2="22"></line>
                </svg>
                ${scanType !== 'current' ? 'Multi-Index Scan: ' : ''}${scanTypeName} Buying Opportunities (${DTIBacktester.activeTradeOpportunities.length})
            </h3>
        `;
        
        // Add scan summary if multi-index scan
        if (scanType !== 'current') {
            const indexCounts = {};
            
            // Count opportunities by index
            DTIBacktester.activeTradeOpportunities.forEach(opp => {
                const indexName = DTIUI.getIndexDisplayNameFromSymbol(opp.stock.symbol);
                indexCounts[indexName] = (indexCounts[indexName] || 0) + 1;
            });
            
            // Create summary HTML
            html += `<div class="scan-summary">`;
            
            Object.keys(indexCounts).forEach(indexName => {
                html += `<span class="index-tag">${indexName}: ${indexCounts[indexName]}</span>`;
            });
            
            html += `</div>`;
            
            // Add style for scan summary
            const style = document.createElement('style');
            style.textContent = `
                .scan-summary {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-bottom: 15px;
                    padding: 8px 12px;
                    background: rgba(99, 102, 241, 0.08);
                    border-radius: 6px;
                }
                .index-tag {
                    background: rgba(99, 102, 241, 0.15);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #4f46e5;
                    font-weight: 500;
                }
                .stock-index-badge {
                    display: inline-block;
                    font-size: 11px;
                    padding: 2px 6px;
                    border-radius: 4px;
                    background: rgba(99, 102, 241, 0.1);
                    color: #4f46e5;
                    margin-left: 6px;
                    vertical-align: middle;
                }
                .opportunity-card {
                    position: relative;
                }
                .opportunity-card.high-conviction {
                    border-left: 4px solid #10b981;
                }
                .opportunity-card.moderate-conviction {
                    border-left: 4px solid #f59e0b;
                }
                .opportunity-card.low-conviction {
                    border-left: 4px solid #ef4444;
                }
                .detail-value.high-conviction {
                    color: #10b981;
                    font-weight: bold;
                }
                .detail-value.moderate-conviction {
                    color: #f59e0b;
                    font-weight: bold;
                }
                .detail-value.low-conviction {
                    color: #ef4444;
                    font-weight: bold;
                }
            `;
            document.head.appendChild(style);
        }
        
        // Function to create opportunity cards for a conviction level
        const createOpportunitySection = (title, opportunities, levelClass) => {
            if (opportunities.length === 0) return '';
            
            let section = `
                <div class="opportunity-section">
                    <h4 class="section-title">${title} (${opportunities.length})</h4>
                    <div class="opportunity-cards">
            `;
            
            opportunities.forEach((opportunity, index) => {
                const { stock, trade } = opportunity;
                const entryDate = new Date(trade.entryDate).toLocaleDateString();
                const days = trade.holdingDays;
                const currentPrice = trade.currentPrice ? trade.currentPrice.toFixed(2) : 'N/A';
                const entryPrice = trade.entryPrice ? trade.entryPrice.toFixed(2) : 'N/A';
                const plPercentClass = trade.currentPlPercent >= 0 ? 'positive' : 'negative';
                const plPercent = trade.currentPlPercent ? trade.currentPlPercent.toFixed(2) : '0.00';
                
                // Get index display name for multi-index scan
                const indexDisplay = scanType !== 'current' ? 
                    `<span class="stock-index-badge">${DTIUI.getIndexDisplayNameFromSymbol(stock.symbol)}</span>` : '';
                
                // Get the appropriate currency symbol for this specific stock
                const stockCurrencySymbol = getCurrencySymbolForDisplay(stock.symbol);
                
                // Get the win rate for this stock
                const winRate = stockWinRates[stock.symbol] || 0;
                const winRateClass = winRate > 75 ? 'high-conviction' : winRate >= 50 ? 'moderate-conviction' : 'low-conviction';

                section += `
                    <div class="opportunity-card ${levelClass}" style="opacity: 0; transform: translateY(20px);" data-index="${index}">
                        <div class="opportunity-header">
                            <div class="stock-name">${stock.name}${indexDisplay}</div>
                            <div class="stock-symbol ${DTIBacktester.currentStockIndex}">${stock.symbol}</div>
                        </div>
                        <div class="opportunity-details">
                            <div class="detail-row">
                                <span class="detail-label">Win Rate:</span>
                                <span class="detail-value ${winRateClass}">${winRate.toFixed(1)}%</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Entry Date:</span>
                                <span class="detail-value">${entryDate}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Days Open:</span>
                                <span class="detail-value">${days}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Entry Price:</span>
                                <span class="detail-value">${stockCurrencySymbol}${entryPrice}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Current Price:</span>
                                <span class="detail-value">${stockCurrencySymbol}${currentPrice}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">P/L:</span>
                                <span class="detail-value ${plPercentClass}">${plPercent}%</span>
                            </div>
                        </div>
                        <div class="opportunity-actions">
                            <button class="ai-insights-btn" data-symbol="${stock.symbol}" title="Get AI/ML analysis for ${stock.symbol}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                </svg>
                                AI Insights
                            </button>
                            <button class="view-details-btn" data-symbol="${stock.symbol}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                                View Details
                            </button>
                            <button class="take-trade-btn" data-symbol="${stock.symbol}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                </svg>
                                Take a Trade
                            </button>
                        </div>
                    </div>
                `;
            });
            
            section += `
                    </div>
                </div>
            `;
            
            return section;
        };
        
        // Add sections for each conviction level
        html += createOpportunitySection('High Conviction (Win Rate > 75%)', highConvictionOpportunities, 'high-conviction');
        html += createOpportunitySection('Moderate Conviction (Win Rate 50-75%)', moderateConvictionOpportunities, 'moderate-conviction');
        html += createOpportunitySection('Low Conviction (Win Rate < 50%)', lowConvictionOpportunities, 'low-conviction');
        
        // Display on the page
        opportunitiesContainer.innerHTML = html;
        
        // Animate cards appearing
        const cards = opportunitiesContainer.querySelectorAll('.opportunity-card');
        cards.forEach((card, index) => {
            setTimeout(() => {
                card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, 50 * index); // Stagger the animations
        });
        
        // Add event listeners to the "AI Insights" buttons
        const aiInsightsButtons = opportunitiesContainer.querySelectorAll('.ai-insights-btn');
        aiInsightsButtons.forEach(button => {
            button.addEventListener('click', function() {
                const symbol = this.getAttribute('data-symbol');
                
                // Check if MLInsightsUI is available
                if (typeof MLInsightsUI !== 'undefined' && MLInsightsUI.showMLInsights) {
                    // Show the modal and pass the symbol directly
                    MLInsightsUI.showMLInsights(symbol);
                } else {
                    console.error('ML Insights UI not available. Make sure ml-insights-ui.js is loaded.');
                    // Fallback notification
                    if (typeof DTIBacktester !== 'undefined' && DTIBacktester.utils && DTIBacktester.utils.showNotification) {
                        DTIBacktester.utils.showNotification('AI Insights feature is not available. Please refresh the page.', 'error');
                    } else {
                        alert('AI Insights feature is not available. Please refresh the page.');
                    }
                }
            });
        });
        
        // Add event listeners to the "View Details" buttons
        const viewButtons = opportunitiesContainer.querySelectorAll('.view-details-btn');
        viewButtons.forEach(button => {
            button.addEventListener('click', function() {
                const symbol = this.getAttribute('data-symbol');
                
                // Set flag to prevent clearing opportunities
                DTIUI.isViewingOpportunityDetails = true;
                
                // Set timeout to clear flag after the operation is complete
                setTimeout(() => {
                    DTIUI.isViewingOpportunityDetails = false;
                }, 1000);
                
                // Find which index this stock belongs to
                const indexIdentifier = DTIUI.getIndexIdentifierFromSymbol(symbol);
                
                // Set the index selector to the correct index
                const indexSelector = document.getElementById('index-selector');
                if (indexSelector && indexIdentifier) {
                    indexSelector.value = indexIdentifier;
                    // Trigger the change event to update the stock selector
                    const event = new Event('change');
                    indexSelector.dispatchEvent(event);
                    
                    // Wait for the stock selector to update before continuing
                    setTimeout(() => {
                        // Now find the selected stock in the updated dropdown
                        const stockSelector = document.getElementById('stock-selector');
                        if (stockSelector) {
                            stockSelector.value = symbol;
                            // Fetch and display data for this stock
                            document.getElementById('fetch-data-btn').click();
                        }
                    }, 100); // Short delay to ensure the stock selector has updated
                }
            });
        });
        
        // Add event listeners to the "Take a Trade" buttons
        const takeTradeButtons = opportunitiesContainer.querySelectorAll('.take-trade-btn');
        takeTradeButtons.forEach(button => {
            button.addEventListener('click', function() {
                const symbol = this.getAttribute('data-symbol');
                const opportunity = DTIBacktester.activeTradeOpportunities.find(opp => opp.stock.symbol === symbol);
                
                if (opportunity) {
                    // Open the trade modal with the opportunity data
                    if (typeof window.openTradeModal === 'function') {
                        const modalData = {
                            name: opportunity.stock.name,
                            symbol: opportunity.stock.symbol,
                            currentPrice: opportunity.trade.currentPrice
                        };
                        window.openTradeModal(modalData);
                    } else {
                        console.error('Trade modal function not found. Make sure trade-modal.js is loaded.');
                        DTIBacktester.utils.showNotification('Trade entry is not available. Please make sure all required scripts are loaded.', 'error');
                    }
                }
            });
        });
        
        // Update active trades count in the navigation
        DTIBacktester.updateActiveTradesCount();
    }
    
    /**
     * Display trade statistics
     * @param {Array} trades - Array of trade objects
     */
    function displayStatistics(trades) {
        // Filter out active trades (those without exit info)
        const completedTrades = trades.filter(trade => trade.exitDate && trade.exitReason);
        
        // Send backtest alerts for completed backtests if BacktestAlerts module is available
        if (typeof BacktestAlerts !== 'undefined' && completedTrades.length > 0) {
            console.log("🔔 Processing backtest results for alerts...");
            setTimeout(() => {
                const backtestData = {
                    trades: completedTrades,
                    totalReturn: completedTrades.reduce((sum, t) => sum + t.plPercent, 0),
                    winRate: completedTrades.filter(t => t.plPercent > 0).length / completedTrades.length * 100
                };
                BacktestAlerts.processBacktestResults(backtestData);
            }, 1000); // Small delay to ensure all data is ready
        }
        
        const totalTrades = completedTrades.length;
        let winningTrades = 0;
        let losingTrades = 0;
        let totalProfit = 0;
        let avgHoldingDays = 0;
        
        let takeProfitCount = 0;
        let stopLossCount = 0;
        let timeExitCount = 0;
        let endOfDataCount = 0;
        
        completedTrades.forEach(trade => {
            // Count winning/losing trades
            if (trade.plPercent > 0) {
                winningTrades++;
            } else {
                losingTrades++;
            }
            
            // Calculate total profit
            totalProfit += trade.plPercent;
            
            // Calculate holding period
            const entryDate = new Date(trade.entryDate);
            const exitDate = new Date(trade.exitDate);
            const holdingDays = Math.floor((exitDate - entryDate) / (24 * 60 * 60 * 1000));
            avgHoldingDays += holdingDays;
            
            // Count exit reasons
            switch(trade.exitReason) {
                case 'Take Profit':
                    takeProfitCount++;
                    break;
                case 'Stop Loss':
                    stopLossCount++;
                    break;
                case 'Time Exit':
                    timeExitCount++;
                    break;
                case 'End of Data':
                    endOfDataCount++;
                    break;
            }
        });
        
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades * 100).toFixed(2) : 0;
        const avgProfit = totalTrades > 0 ? (totalProfit / totalTrades).toFixed(2) : 0;
        avgHoldingDays = totalTrades > 0 ? (avgHoldingDays / totalTrades).toFixed(1) : 0;
        
        // Update statistics card
        const statsContainer = document.getElementById('statistics');
        
        if (totalTrades === 0) {
            statsContainer.innerHTML = `
                <div class="stat-item">
                    <div class="stat-value">0</div>
                    <div class="stat-label">Total Trades</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">0%</div>
                    <div class="stat-label">Win Rate</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">0%</div>
                    <div class="stat-label">Avg. Profit/Trade</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">0%</div>
                    <div class="stat-label">Total Return</div>
                </div>
            `;
            return;
        }
        
        // Add success/danger classes based on outcomes
        const winRateClass = winRate >= 50 ? 'success' : '';
        const avgProfitClass = avgProfit > 0 ? 'success' : avgProfit < 0 ? 'danger' : '';
        const totalReturnClass = totalProfit > 0 ? 'success' : totalProfit < 0 ? 'danger' : '';
        
        // Create HTML for each type of exit
        const exitTypesHTML = `
            <div class="stat-item">
                <div class="stat-value">${takeProfitCount}</div>
                <div class="stat-label">Target Hits <span class="positive">(${Math.round(takeProfitCount/totalTrades*100)}%)</span></div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${stopLossCount}</div>
                <div class="stat-label">Stop Losses <span class="negative">(${Math.round(stopLossCount/totalTrades*100)}%)</span></div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${timeExitCount}</div>
                <div class="stat-label">Time Exits <span>(${Math.round(timeExitCount/totalTrades*100)}%)</span></div>
            </div>
        `;
        
        statsContainer.innerHTML = `
            <div class="stat-item">
                <div class="stat-value">${totalTrades}</div>
                <div class="stat-label">Total Trades</div>
            </div>
            <div class="stat-item ${winRateClass}">
                <div class="stat-value">${winRate}%</div>
                <div class="stat-label">Win Rate (${winningTrades}/${totalTrades})</div>
            </div>
            <div class="stat-item ${avgProfitClass}">
                <div class="stat-value ${avgProfit > 0 ? 'positive' : avgProfit < 0 ? 'negative' : ''}">${avgProfit}%</div>
                <div class="stat-label">Avg. Profit/Trade</div>
            </div>
            <div class="stat-item ${totalReturnClass}">
                <div class="stat-value ${totalProfit > 0 ? 'positive' : totalProfit < 0 ? 'negative' : ''}">${totalProfit.toFixed(2)}%</div>
                <div class="stat-label">Total Return</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${avgHoldingDays}</div>
                <div class="stat-label">Avg. Holding Days</div>
            </div>
            ${exitTypesHTML}
        `;
        
        // Add animation to the stats cards
        const statItems = statsContainer.querySelectorAll('.stat-item');
        statItems.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                item.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                item.style.opacity = '1';
                item.style.transform = 'translateY(0)';
            }, 100 + (index * 50));
        });
    }
    
    /**
     * Display trades table
     * @param {Array} trades - Array of trade objects
     */
    function displayTrades(trades) {
        // Filter out active trades for the table
        const completedTrades = trades.filter(trade => trade.exitDate && trade.exitReason);
        
        const tbody = document.querySelector('#trades-table tbody');
        tbody.innerHTML = '';
        
        if (completedTrades.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="9" class="no-data">No completed trades found with current parameters</td>';
            tbody.appendChild(row);
            return;
        }
        
        // Get the currency symbol based on the current index first
        let defaultCurrencySymbol = getCurrencySymbolForDisplay(DTIBacktester.currentStockIndex);
        
        // Sort trades by entry date
        completedTrades.sort((a, b) => new Date(a.entryDate) - new Date(b.entryDate));
        
        completedTrades.forEach((trade, index) => {
            const row = document.createElement('tr');
            
            // Create exit reason tag
            let exitTagClass = '';
            switch(trade.exitReason) {
                case 'Take Profit':
                    exitTagClass = 'tp-tag';
                    break;
                case 'Stop Loss':
                    exitTagClass = 'sl-tag';
                    break;
                case 'Time Exit':
                    exitTagClass = 'time-tag';
                    break;
                case 'End of Data':
                    exitTagClass = 'end-tag';
                    break;
            }
            
            // Calculate holding period days
            const entryDate = new Date(trade.entryDate);
            const exitDate = new Date(trade.exitDate);
            const holdingDays = Math.floor((exitDate - entryDate) / (24 * 60 * 60 * 1000));
            
            // Use the default currency symbol from the current index
            const tradeCurrencySymbol = defaultCurrencySymbol;

            row.innerHTML = `
                <td>${DTIBacktester.utils.formatDate(trade.entryDate)}</td>
                <td>${tradeCurrencySymbol}${trade.entryPrice.toFixed(2)}</td>
                <td>${trade.entryDTI.toFixed(2)}</td>
                <td>${trade.entry7DayDTI ? trade.entry7DayDTI.toFixed(2) : 'N/A'}</td>
                <td>${DTIBacktester.utils.formatDate(trade.exitDate)}</td>
                <td>${tradeCurrencySymbol}${trade.exitPrice.toFixed(2)}</td>
                <td>${holdingDays}</td>
                <td class="${trade.plPercent >= 0 ? 'positive' : 'negative'}">${trade.plPercent.toFixed(2)}%</td>
                <td><span class="exit-tag ${exitTagClass}">${trade.exitReason}</span></td>
            `;
            
            // Add row animation
            row.style.opacity = '0';
            tbody.appendChild(row);
            
            setTimeout(() => {
                row.style.transition = 'opacity 0.3s ease';
                row.style.opacity = '1';
            }, 30 * index);
        });
        
        // If there's an active trade, show it
        const activeTrade = trades.find(trade => !trade.exitDate || !trade.exitReason);
        if (activeTrade) {
            const row = document.createElement('tr');
            row.className = 'active-trade-row';
            
            // Use the same default currency symbol for active trade
            const activeTradeCurrencySymbol = defaultCurrencySymbol;

            row.innerHTML = `
                <td>${DTIBacktester.utils.formatDate(activeTrade.entryDate)}</td>
                <td>${activeTradeCurrencySymbol}${activeTrade.entryPrice.toFixed(2)}</td>
                <td>${activeTrade.entryDTI.toFixed(2)}</td>
                <td>${activeTrade.entry7DayDTI ? activeTrade.entry7DayDTI.toFixed(2) : 'N/A'}</td>
                <td colspan="5" class="active-trade-cell">
                    <div class="active-trade-info">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        ACTIVE TRADE (${activeTrade.holdingDays} days) - Current P/L: 
                        <span class="${activeTrade.currentPlPercent >= 0 ? 'positive' : 'negative'}">${activeTrade.currentPlPercent ? activeTrade.currentPlPercent.toFixed(2) : '0.00'}%</span>
                    </div>
                </td>
            `;
            
            // Add row with animation after a delay
            row.style.opacity = '0';
            tbody.appendChild(row);
            
            setTimeout(() => {
                row.style.transition = 'opacity 0.5s ease, background-color 0.5s ease';
                row.style.opacity = '1';
                row.style.backgroundColor = 'rgba(16, 185, 129, 0.05)';
            }, completedTrades.length * 30 + 100);
        }
    }

    // Export functions for external use
    return {
        createBuyingOpportunitiesSection,
        displayBuyingOpportunities,
        displayStatistics,
        displayTrades
    };
})();

/**
 * Send direct alerts for current buying opportunities
 */
async function sendDirectOpportunityAlerts(opportunities) {
    try {
        console.log(`📤 Sending alerts for ${opportunities.length} opportunities...`);
        
        // Get alert preferences
        const prefsResponse = await fetch('/api/alerts/preferences', {
            credentials: 'include' // Include cookies for authentication
        });
        if (!prefsResponse.ok) {
            console.log('❌ Failed to fetch alert preferences');
            return;
        }
        
        const prefs = await prefsResponse.json();
        if (!prefs.telegram_enabled || !prefs.telegram_chat_id) {
            console.log('❌ Telegram alerts not configured');
            return;
        }
        
        // Use existing high conviction filtering logic
        const stockWinRates = DTIUI.calculateStockWinRates();
        
        // Filter for high conviction opportunities (win rate > 75%)
        const highConvictionOpportunities = opportunities.filter(opportunity => {
            const winRate = stockWinRates[opportunity.stock.symbol] || 0;
            return winRate > 75;
        });
        
        // Filter for opportunities from last 2 trading days only
        const recentOpportunities = highConvictionOpportunities.filter(opp => {
            const signalDate = new Date(opp.trade.signalDate || opp.trade.entryDate);
            const isRecent = isWithinTradingDays(signalDate, 2); // Changed to 2 days
            
            // Debug logging
            if (!isRecent && highConvictionOpportunities.indexOf(opp) < 5) {
                const today = new Date();
                const daysDiff = Math.floor((today - signalDate) / (1000 * 60 * 60 * 24));
                console.log(`📅 ${opp.stock.symbol} signal from ${signalDate.toLocaleDateString()} (${daysDiff} days ago) - excluded`);
            }
            
            return isRecent;
        });
        
        // Take up to 5 recent high conviction opportunities
        const alertOpportunities = recentOpportunities.slice(0, 5);
        
        console.log(`📊 Total opportunities: ${opportunities.length}`);
        console.log(`⭐ High conviction opportunities: ${highConvictionOpportunities.length}`);
        console.log(`📅 Recent high conviction opportunities: ${recentOpportunities.length}`);
        console.log(`📤 Sending alerts for: ${alertOpportunities.length}`);
        
        // Log which opportunities are being sent
        alertOpportunities.forEach(opp => {
            const signalDate = new Date(opp.trade.signalDate || opp.trade.entryDate);
            console.log(`✅ Including ${opp.stock.symbol} - signal from ${signalDate.toLocaleDateString()}`);
        });
        
        if (alertOpportunities.length === 0) {
            console.log('❌ No recent high conviction opportunities found - skipping alerts');
            return;
        }
        
        // Send summary
        const summaryMessage = {
            type: 'opportunity_scan',
            title: '🎯 TECHNICAL PATTERNS FOUND',
            text: `Found ${alertOpportunities.length} Strong Technical Patterns`,
            fields: [
                { label: 'Total Opportunities Scanned', value: opportunities.length },
                { label: 'Top Patterns Selected', value: alertOpportunities.length },
                { label: 'Scan Date', value: new Date().toLocaleDateString() }
            ]
        };
        
        await sendTelegramMessage(prefs.telegram_chat_id, summaryMessage);
        
        // Send individual opportunities with simplified format
        for (const opp of alertOpportunities) {
            // Calculate target and stop loss based on entry price
            const entryPrice = opp.trade?.currentPrice || opp.trade?.entryPrice || 0;
            const targetPrice = entryPrice * 1.08; // 8% profit target
            const stopLossPrice = entryPrice * 0.95; // 5% stop loss
            const currencySymbol = getCurrencySymbol(opp.stock.symbol);
            
            // Use actual signal date, not today
            const signalDate = new Date(opp.trade.signalDate || opp.trade.entryDate);
            const exitDate = new Date(signalDate);
            exitDate.setDate(exitDate.getDate() + 30); // 30 days from signal date
            
            const oppMessage = {
                type: 'buy_opportunity',
                title: 'HIGH CONFIDENCE PATTERN',
                stock: opp.stock.symbol,
                fields: [
                    { label: 'Stock', value: opp.stock.name || opp.stock.symbol },
                    { label: 'Entry Price', value: `${currencySymbol}${entryPrice.toFixed(2)}` },
                    { label: 'Target Price', value: `${currencySymbol}${targetPrice.toFixed(2)}` },
                    { label: 'Stop Loss', value: `${currencySymbol}${stopLossPrice.toFixed(2)}` },
                    { label: 'Entry Date', value: signalDate.toLocaleDateString() },
                    { label: 'Exit Date', value: exitDate.toLocaleDateString() }
                ]
            };
            
            await sendTelegramMessage(prefs.telegram_chat_id, oppMessage);
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }
        
        console.log('✅ All opportunity alerts sent successfully');
        
    } catch (error) {
        console.error('❌ Error sending opportunity alerts:', error);
    }
}

/**
 * Send telegram message
 */
async function sendTelegramMessage(chatId, messageData) {
    console.log(`📤 Sending to Telegram (${chatId}):`, messageData);
    
    const response = await fetch('/api/alerts/send-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
            chatId: chatId,
            message: messageData
        })
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Telegram send failed: ${response.status} - ${errorText}`);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ Telegram response:', result);
}

/**
 * Check if a date is within the last N trading days
 */
function isWithinTradingDays(signalDate, daysToCheck = 2, currentDate = new Date()) {
    const signal = new Date(signalDate);
    const today = new Date(currentDate);
    
    // Reset time to start of day for accurate comparison
    signal.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    // Signal must be before or equal to today
    if (signal > today) return false;
    
    // Count trading days between signal and today
    let tradingDays = 0;
    let tempDate = new Date(today);
    
    while (tempDate >= signal && tradingDays <= daysToCheck) {
        const dayOfWeek = tempDate.getDay();
        
        // Count if it's a weekday
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            tradingDays++;
        }
        
        // Check if we've found the signal date
        if (tempDate.getTime() === signal.getTime()) {
            // Subtract 1 because we don't count today if checking "within last N days"
            return tradingDays <= daysToCheck;
        }
        
        // Go back one day
        tempDate.setDate(tempDate.getDate() - 1);
    }
    
    // Signal is older than our check range
    return false;
}

/**
 * Get currency symbol for stock
 */
function getCurrencySymbol(symbol) {
    if (symbol.includes('.NS')) return '₹';
    if (symbol.includes('.L')) return '£';
    return '$';
}

/**
 * Get market name for stock
 */
function getMarketName(symbol) {
    if (symbol.includes('.NS')) return 'Indian';
    if (symbol.includes('.L')) return 'UK';
    return 'US';
}