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
    
    // Send direct alerts for current opportunities
    if (DTIBacktester.activeTradeOpportunities && DTIBacktester.activeTradeOpportunities.length > 0) {
        setTimeout(() => {
            sendDirectOpportunityAlerts(DTIBacktester.activeTradeOpportunities);
        }, 1000);
    }
    
    const opportunitiesContainer = document.getElementById('buying-opportunities');
    
    if (!opportunitiesContainer) {
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

        // Ensure the section is revealed (fix for scroll-reveal issue after scan)
        requestAnimationFrame(() => {
            opportunitiesContainer.classList.add('revealed');
        });

        return;
    }

    
         
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
            
            // Styles moved to CSS file - components.css
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
                const entryDate = DateFormatter.format(trade.entryDate);
                const days = trade.holdingDays;
                const currentPrice = trade.currentPrice ? trade.currentPrice.toFixed(2) : 'N/A';
                const entryPrice = trade.entryPrice ? trade.entryPrice.toFixed(2) : 'N/A';
                const plPercentClass = trade.currentPlPercent >= 0 ? 'positive' : 'negative';
                const plPercent = trade.currentPlPercent ? trade.currentPlPercent.toFixed(2) : '0.00';
                
                // Get market indicator based on symbol
                const market = getMarketFromSymbol(stock.symbol);

                // Get the appropriate currency symbol for this specific stock
                const stockCurrencySymbol = getCurrencySymbolForDisplay(stock.symbol);

                // Get the win rate for this stock
                const winRate = stockWinRates[stock.symbol] || 0;
                const winRateClass = winRate > 75 ? 'high-conviction' : winRate >= 50 ? 'moderate-conviction' : 'low-conviction';

                section += `
                    <div class="opportunity-card ${levelClass}" style="opacity: 0; transform: translateY(20px);" data-index="${index}">
                        <div class="opportunity-header">
                            <div class="stock-name">${stock.name}</div>
                            <div class="stock-badges">
                                <span class="market-badge">${market}</span>
                                <span class="stock-symbol ${DTIBacktester.currentStockIndex}">${stock.symbol}</span>
                            </div>
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
                            <button type="button" class="ai-insights-btn" data-symbol="${stock.symbol}" title="Get AI/ML analysis for ${stock.symbol}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                </svg>
                                AI Insights
                            </button>
                            <button type="button" class="view-details-btn" data-symbol="${stock.symbol}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                                View Details
                            </button>
                            <button type="button" class="take-trade-btn" data-symbol="${stock.symbol}">
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

        // Ensure the section is revealed (fix for scroll-reveal issue after scan)
        // The section may already be in viewport after scan completes, so manually add revealed class
        requestAnimationFrame(() => {
            opportunitiesContainer.classList.add('revealed');
        });

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
            // iOS Safari fix: Use touchend instead of click for iOS devices
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            const eventType = isIOS ? 'touchend' : 'click';
            
            button.addEventListener(eventType, function(e) {
                // Prevent default action and stop propagation to avoid page refresh on mobile
                e.preventDefault();
                e.stopPropagation();
                
                const symbol = this.getAttribute('data-symbol');
                
                // Check if MLInsightsUI is available
                if (typeof MLInsightsUI !== 'undefined' && MLInsightsUI.showMLInsights) {
                    // Show the modal and pass the symbol directly
                    MLInsightsUI.showMLInsights(symbol);
                } else {
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
            // iOS Safari fix: Use touchend instead of click for iOS devices
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            const eventType = isIOS ? 'touchend' : 'click';
            
            button.addEventListener(eventType, async function(e) {
                // Prevent default action and stop propagation to avoid page refresh on mobile
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation(); // Extra prevention for iOS Safari

                // Additional iOS Safari fix
                if (e.target && e.target.closest('a')) {
                    return false;
                }

                const symbol = this.getAttribute('data-symbol');

                console.log('[VIEW DETAILS FIX] View Details clicked for symbol:', symbol);

                // Set flag to prevent clearing opportunities - increased timeout for reliability
                DTIUI.isViewingOpportunityDetails = true;

                // Set timeout to clear flag after operation completes - increased to 5 seconds
                const clearFlagTimer = setTimeout(() => {
                    DTIUI.isViewingOpportunityDetails = false;
                    console.log('[VIEW DETAILS FIX] View details flag cleared');
                }, 5000);

                // Direct data processing without selector manipulation
                // The new simplified UI doesn't use index/stock selectors
                // Wrap everything in a timeout handler to catch stuck operations
                const operationTimeout = setTimeout(() => {
                    console.error('[VIEW DETAILS FIX] Operation timed out after 30 seconds');
                    DTIBacktester.utils.showNotification(`Operation timed out for ${symbol}. Please try again.`, 'error');
                    DTIUI.isViewingOpportunityDetails = false;
                    clearTimeout(clearFlagTimer);
                }, 30000); // 30 second timeout

                try {
                    console.log('[VIEW DETAILS DEBUG] Starting View Details workflow for symbol:', symbol);

                    // Show loading state
                    console.log('[VIEW DETAILS DEBUG] Showing loading notification');
                    DTIBacktester.utils.showNotification(`Loading data for ${symbol}...`, 'info');

                    // Use default period of 5 years (simplified UI no longer has period selector)
                    const period = '5y';
                    console.log('[VIEW DETAILS DEBUG] Using period:', period);

                    // Find the stock object from the opportunities array (not from current stock list)
                    console.log('[VIEW DETAILS DEBUG] Finding stock from opportunities array');
                    console.log('[VIEW DETAILS DEBUG] DTIBacktester.activeTradeOpportunities available:', !!DTIBacktester.activeTradeOpportunities);
                    console.log('[VIEW DETAILS DEBUG] Opportunities count:', DTIBacktester.activeTradeOpportunities?.length);

                    const opportunity = DTIBacktester.activeTradeOpportunities.find(opp => opp.stock.symbol === symbol);
                    console.log('[VIEW DETAILS DEBUG] Opportunity found:', !!opportunity);

                    if (!opportunity) {
                        throw new Error('Stock not found in opportunities list');
                    }

                    const selectedStock = opportunity.stock;
                    console.log('[VIEW DETAILS DEBUG] Selected stock:', selectedStock);

                    // Fetch stock data
                    console.log('[VIEW DETAILS DEBUG] Fetching stock data for:', symbol);
                    console.log('[VIEW DETAILS DEBUG] DTIData.fetchStockData available:', typeof DTIData?.fetchStockData === 'function');

                    const data = await DTIData.fetchStockData(symbol, period);
                    console.log('[VIEW DETAILS DEBUG] Stock data fetched:', data ? 'SUCCESS' : 'FAILED');
                    console.log('[VIEW DETAILS DEBUG] Data type:', typeof data);

                    if (!data) {
                        throw new Error('Failed to fetch stock data');
                    }

                    // Process data directly
                    console.log('[VIEW DETAILS DEBUG] Processing stock CSV data');
                    console.log('[VIEW DETAILS DEBUG] DTIData.processStockCSV available:', typeof DTIData?.processStockCSV === 'function');

                    const processedData = DTIData.processStockCSV(data, selectedStock);
                    console.log('[VIEW DETAILS DEBUG] Data processed:', processedData ? 'SUCCESS' : 'FAILED');
                    console.log('[VIEW DETAILS DEBUG] Processed data keys:', processedData ? Object.keys(processedData) : 'null');
                    console.log('[VIEW DETAILS DEBUG] Processed data trades count:', processedData?.trades?.length);

                    if (!processedData) {
                        throw new Error('Failed to process stock data');
                    }

                    // Combine all trades (completed + active)
                    console.log('[VIEW DETAILS DEBUG] Combining trades');
                    const allTrades = [...processedData.trades];
                    if (processedData.activeTrade) {
                        allTrades.push(processedData.activeTrade);
                    }
                    console.log('[VIEW DETAILS DEBUG] Total trades (including active):', allTrades.length);

                    // Store OHLC data globally for chart access
                    console.log('[VIEW DETAILS DEBUG] Storing OHLC data');
                    console.log('[VIEW DETAILS DEBUG] Checking for real OHLC data - open:', processedData.open ? 'available' : 'not available');

                    // Use real OHLC data if available, otherwise fall back to close prices
                    DTIBacktester.ohlcData = {
                        dates: processedData.dates,
                        open: processedData.open || processedData.close,
                        high: processedData.high || processedData.close,
                        low: processedData.low || processedData.close,
                        close: processedData.close
                    };
                    console.log('[VIEW DETAILS DEBUG] OHLC data stored, dates count:', processedData.dates?.length);
                    console.log('[VIEW DETAILS DEBUG] Using real OHLC data:', processedData.open ? 'YES' : 'NO (fallback to close)');

                    // Display results
                    console.log('[VIEW DETAILS DEBUG] Creating charts');
                    console.log('[VIEW DETAILS DEBUG] DTIUI available:', typeof DTIUI !== 'undefined');
                    console.log('[VIEW DETAILS DEBUG] DTIUI.createCharts available:', typeof DTIUI?.createCharts === 'function');

                    // Prepare OHLC data object for chart creation
                    const ohlcDataForCharts = {
                        open: processedData.open || processedData.close,
                        high: processedData.high || processedData.close,
                        low: processedData.low || processedData.close
                    };
                    console.log('[VIEW DETAILS DEBUG] Passing OHLC data to createCharts:', ohlcDataForCharts.open ? 'with real OHLC data' : 'with close prices');

                    DTIUI.createCharts(
                        processedData.dates,
                        processedData.close,
                        processedData.dti,
                        processedData.sevenDayDTIData,
                        ohlcDataForCharts
                    );
                    console.log('[VIEW DETAILS DEBUG] Charts created successfully');

                    console.log('[VIEW DETAILS DEBUG] Displaying statistics');
                    console.log('[VIEW DETAILS DEBUG] DTIUI.displayStatistics available:', typeof DTIUI?.displayStatistics === 'function');
                    DTIUI.displayStatistics(allTrades);
                    console.log('[VIEW DETAILS DEBUG] Statistics displayed');

                    console.log('[VIEW DETAILS DEBUG] Displaying trades table');
                    console.log('[VIEW DETAILS DEBUG] DTIUI.displayTrades available:', typeof DTIUI?.displayTrades === 'function');
                    DTIUI.displayTrades(allTrades);
                    console.log('[VIEW DETAILS DEBUG] Trades table displayed');

                    // Clear the timeout since operation completed successfully
                    clearTimeout(operationTimeout);
                    clearTimeout(clearFlagTimer);

                    // Show success notification
                    console.log('[VIEW DETAILS DEBUG] Showing success notification');
                    DTIBacktester.utils.showNotification(`Loaded ${symbol} successfully`, 'success');

                    // Scroll to top on mobile to see the results
                    if (window.innerWidth <= 768) {
                        console.log('[VIEW DETAILS DEBUG] Scrolling to top (mobile)');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }

                    console.log('[VIEW DETAILS DEBUG] View Details workflow completed successfully');

                } catch (error) {
                    // Clear the timeout on error
                    clearTimeout(operationTimeout);
                    clearTimeout(clearFlagTimer);

                    console.error('[VIEW DETAILS DEBUG] Error caught:', error);
                    console.error('[VIEW DETAILS DEBUG] Error message:', error.message);
                    console.error('[VIEW DETAILS DEBUG] Error stack:', error.stack);

                    // Provide more specific error messages
                    let errorMessage = error.message;
                    if (error.message.includes('Stock not found')) {
                        errorMessage = `Stock ${symbol} not found in the list. Please try scanning again.`;
                    } else if (error.message.includes('Failed to fetch')) {
                        errorMessage = `Failed to fetch data for ${symbol}. Please check your connection and try again.`;
                    } else if (error.message.includes('Failed to process')) {
                        errorMessage = `Failed to process data for ${symbol}. The data may be incomplete or invalid.`;
                    }

                    DTIBacktester.utils.showNotification(`Error: ${errorMessage}`, 'error');

                    // Clear the flag on error to allow future operations
                    DTIUI.isViewingOpportunityDetails = false;
                }
            });
        });
        
        // Add event listeners to the "Take a Trade" buttons
        const takeTradeButtons = opportunitiesContainer.querySelectorAll('.take-trade-btn');
        takeTradeButtons.forEach(button => {
            // iOS Safari fix: Use touchend instead of click for iOS devices
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            const eventType = isIOS ? 'touchend' : 'click';
            
            button.addEventListener(eventType, function(e) {
                // Prevent default action and stop propagation to avoid page refresh on mobile
                e.preventDefault();
                e.stopPropagation();
                
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
        console.log('[DEBUG] displayTrades called with trades:', trades);
        console.log('[DEBUG] trades length:', trades ? trades.length : 'undefined');

        // Filter out active trades for the table
        const completedTrades = trades.filter(trade => trade.exitDate && trade.exitReason);
        console.log('[DEBUG] completedTrades length:', completedTrades.length);

        const tbody = document.querySelector('#trades-table tbody');
        console.log('[DEBUG] tbody element:', tbody);

        if (!tbody) {
            console.error('[DEBUG] tbody element not found!');
            return;
        }

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
        
        // Get alert preferences
        const prefsResponse = await fetch('/api/alerts/preferences', {
            credentials: 'include' // Include cookies for authentication
        });
        if (!prefsResponse.ok) {
            return;
        }
        
        const prefs = await prefsResponse.json();
        
        // Check if user has configured Telegram alerts
        let telegramChatId = null;
        if (prefs.telegram_enabled && prefs.telegram_chat_id) {
            telegramChatId = prefs.telegram_chat_id;
        } else {
            // Fallback to backend environment Telegram chat ID (same as 7AM scan)
            // Send alerts via backend API instead of user preferences
            try {
                const backendResponse = await fetch('/api/send-backend-alerts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ opportunities }),
                    credentials: 'include'
                });
                
                if (backendResponse.ok) {
                } else {
                }
                return;
            } catch (error) {
                return;
            }
        }
        
        if (!telegramChatId) {
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
            }
            
            return isRecent;
        });
        
        // Send ALL recent high conviction opportunities (no limit)
        const alertOpportunities = recentOpportunities;
        
        
        // Log which opportunities are being sent
        alertOpportunities.forEach(opp => {
            const signalDate = new Date(opp.trade.signalDate || opp.trade.entryDate);
        });
        
        if (alertOpportunities.length === 0) {
            return;
        }
        
        // Create a single comprehensive message with all opportunities
        let message = `📊 *🎯 HIGH CONVICTION TRADING OPPORTUNITIES*\n`;
        message += `Found ${alertOpportunities.length} Active Trades\n`;
        message += `Scan Date: *${new Date().toLocaleDateString('en-GB')}*\n\n`;
        
        // Add individual opportunities with complete details
        for (let i = 0; i < alertOpportunities.length; i++) {
            const opp = alertOpportunities[i];
            const stockName = opp.stock?.name || 'Unknown';
            const stockCode = opp.stock.symbol;
            const market = getMarketFromSymbol(stockCode);
            
            const currentPrice = opp.trade?.currentPrice || opp.trade?.entryPrice || 0;
            const targetPrice = (currentPrice * 1.08).toFixed(2); // 8% profit target
            const stopLossPrice = (currentPrice * 0.95).toFixed(2); // 5% stop loss
            
            // Currency symbol based on market
            const currencySymbol = market === 'India' ? '₹' : market === 'UK' ? '£' : '$';
            
            const entryDate = opp.trade.signalDate || opp.trade.entryDate;
            const squareOffDate = calculateSquareOffDate(entryDate);
            
            // Calculate win rate from stock win rates
            const stockWinRates = DTIUI.calculateStockWinRates();
            const winRate = stockWinRates[stockCode] || 0;
            
            // Get total trades from the data
            const stockData = DTIBacktester.allStocksData?.find(s => s.stock.symbol === stockCode);
            const totalTrades = stockData?.trades?.filter(t => !t.isOpen)?.length || 0;
            
            message += `🎯 *${stockName}*\n`;
            message += `Code: ${stockCode}\n`;
            message += `Market: ${market}\n`;
            message += `Current Price: ${currencySymbol}${currentPrice.toFixed(2)}\n`;
            message += `Target Price: ${currencySymbol}${targetPrice}\n`;
            message += `Stop Loss: ${currencySymbol}${stopLossPrice}\n`;
            message += `Square Off Date: ${squareOffDate}\n`;
            message += `Win Ratio: ${winRate.toFixed(1)}%\n`;
            message += `Backtested Trades: ${totalTrades} (5 years)\n`;
            
            if (i < alertOpportunities.length - 1) message += `\n`;
        }
        
        message += `\n📈 Total Scanned: ${opportunities.length} stocks`;
        
        // Send single comprehensive message
        // Send just the message string for custom messages
        await sendTelegramMessage(prefs.telegram_chat_id, message);
        
        
    } catch (error) {
    }
}

/**
 * Send telegram message
 */
async function sendTelegramMessage(chatId, messageData) {
    
    // Handle both string and object messages
    const messagePayload = typeof messageData === 'string' 
        ? { type: 'custom', message: messageData }
        : messageData;
    
    const response = await fetch('/api/alerts/send-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
            chatId: chatId,
            message: messagePayload
        })
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
}

/**
 * Determine market from stock symbol
 */
function getMarketFromSymbol(symbol) {
    if (symbol.includes('.NS')) return 'India';
    if (symbol.includes('.L')) return 'UK';
    if (!symbol.includes('.')) return 'US';
    return 'International';
}

/**
 * Calculate square off date (30 days from entry for max holding period)
 */
function calculateSquareOffDate(entryDate) {
    const entry = new Date(entryDate);
    const squareOff = new Date(entry);
    squareOff.setDate(entry.getDate() + 30); // Max holding period
    return squareOff.toLocaleDateString('en-GB');
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