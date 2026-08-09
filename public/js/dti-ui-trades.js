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
/**
 * Create an element with a class and text content (v3 renderer helper).
 */
function saEl(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
}

/**
 * Build one v3 signal card (sa-pos grammar) for a scan opportunity.
 */
function buildSignalCard(opportunity, winRate) {
    const { stock, trade } = opportunity;
    const currency = getCurrencySymbolForDisplay(stock.symbol);
    const market = getMarketFromSymbol(stock.symbol);
    const entryPrice = trade.entryPrice;
    const tpInput = document.getElementById('take-profit');
    const slInput = document.getElementById('stop-loss');
    const tp = tpInput ? parseFloat(tpInput.value) || 8 : 8;
    const sl = slInput ? parseFloat(slInput.value) || 5 : 5;
    const target = typeof entryPrice === 'number' ? entryPrice * (1 + tp / 100) : null;
    const stop = typeof entryPrice === 'number' ? entryPrice * (1 - sl / 100) : null;
    const money = v => (v === null || isNaN(v)) ? 'N/A' : currency + v.toFixed(2);

    const card = saEl('div', 'sa-pos sc-signal opportunity-card');

    const top = saEl('div', 'sa-pos__top');
    const idBlock = saEl('div');
    idBlock.appendChild(saEl('div', 'sa-pos__sym', stock.symbol));
    idBlock.appendChild(saEl('div', 'sa-pos__name', stock.name + ' \u00b7 ' + market));
    top.appendChild(idBlock);
    const tone = winRate > 75 ? 'gain' : winRate >= 50 ? 'neutral' : 'warn';
    const record = winRate > 75 ? 'Strong record' : winRate >= 50 ? 'Mixed record' : 'Weak record';
    top.appendChild(saEl('span', 'sa-badge sa-badge--' + tone, record));
    card.appendChild(top);

    const grid = saEl('div', 'sa-pos__grid');
    [['Buy around', money(entryPrice), ''],
     ['Sells at +' + tp + '%', money(target), ' is-gain'],
     ['Stops at \u2212' + sl + '%', money(stop), ' is-loss']].forEach(pair => {
        const cell = saEl('div');
        cell.appendChild(saEl('span', 'sa-pos__k', pair[0]));
        cell.appendChild(saEl('span', 'sa-pos__v' + pair[2], pair[1]));
        grid.appendChild(cell);
    });
    card.appendChild(grid);

    const conf = saEl('div');
    const confMeta = saEl('div', 'sa-prog__meta');
    confMeta.appendChild(saEl('span', null, 'Similar setups worked ' + Math.round(winRate) + '% of the time'));
    conf.appendChild(confMeta);
    const track = saEl('div', 'sa-prog__track');
    const fill = saEl('div', 'sa-prog__fill');
    fill.style.width = Math.max(0, Math.min(100, winRate)) + '%';
    track.appendChild(fill);
    conf.appendChild(track);
    card.appendChild(conf);

    const foot = saEl('div', 'sa-pos__foot');
    const signalledOn = trade.entryDate ? DateFormatter.format(trade.entryDate) : '';
    const nowBit = trade.currentPrice ? ' \u00b7 now ' + currency + trade.currentPrice.toFixed(2) : '';
    foot.appendChild(saEl('span', 'sc-signal__foot-note',
        'Signalled ' + signalledOn + nowBit + '. Based on 5 years of this stock\u2019s history.'));
    const actions = saEl('div', 'sa-row');
    const mkBtn = (cls, icon, label) => {
        const b = saEl('button', cls);
        b.type = 'button';
        b.setAttribute('data-symbol', stock.symbol);
        if (icon) {
            const i = saEl('span', 'material-symbols-rounded', icon);
            i.setAttribute('aria-hidden', 'true');
            b.appendChild(i);
        }
        b.appendChild(document.createTextNode(label));
        return b;
    };
    actions.appendChild(mkBtn('sa-btn sa-btn--quiet sa-btn--sm ai-insights-btn', 'monitoring', 'AI insights'));
    actions.appendChild(mkBtn('sa-btn sa-btn--secondary sa-btn--sm view-details-btn', 'search', 'Look closer'));
    actions.appendChild(mkBtn('sa-btn sa-btn--primary sa-btn--sm take-trade-btn', null, 'Take this signal'));
    foot.appendChild(actions);
    card.appendChild(foot);

    return card;
}

function displayBuyingOpportunities() {

    // Send direct alerts for current opportunities — but never when the page
    // is re-rendering a scan restored from storage (that would re-send the
    // same Telegram alerts on every visit).
    if (DTIBacktester.activeTradeOpportunities && DTIBacktester.activeTradeOpportunities.length > 0 &&
        !DTIBacktester.restoredFromStore) {
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
        const empty = saEl('div', 'sa-empty');
        const iconBox = saEl('div', 'sa-empty__icon');
        const iconGlyph = saEl('span', 'material-symbols-rounded', 'radar');
        iconGlyph.setAttribute('aria-hidden', 'true');
        iconBox.appendChild(iconGlyph);
        empty.appendChild(iconBox);
        empty.appendChild(saEl('div', 'sa-empty__title', 'No setups today'));
        empty.appendChild(saEl('p', null,
            'The scan checked ' + scanTypeName + ' and nothing lined up. A quiet day is normal \u2014 the formula waits.'));
        opportunitiesContainer.replaceChildren(empty);
        requestAnimationFrame(() => {
            opportunitiesContainer.classList.add('revealed');
        });
        return;
    }

    // Only strong records (win rate > 75%) get shown — same bar as the
    // performance modal and the Telegram "high conviction" alerts.
    const stockWinRates = DTIUI.calculateStockWinRates();
    const allFound = DTIBacktester.activeTradeOpportunities.length;
    const ranked = DTIBacktester.activeTradeOpportunities
        .filter(opp => (stockWinRates[opp.stock.symbol] || 0) > 75)
        .sort((a, b) => (stockWinRates[b.stock.symbol] || 0) - (stockWinRates[a.stock.symbol] || 0));

    if (ranked.length === 0) {
        const empty = saEl('div', 'sa-empty');
        const iconBox = saEl('div', 'sa-empty__icon');
        const iconGlyph = saEl('span', 'material-symbols-rounded', 'radar');
        iconGlyph.setAttribute('aria-hidden', 'true');
        iconBox.appendChild(iconGlyph);
        empty.appendChild(iconBox);
        empty.appendChild(saEl('div', 'sa-empty__title', 'No strong records today'));
        empty.appendChild(saEl('p', null,
            'The scan found ' + allFound + (allFound === 1 ? ' setup' : ' setups') + ' in ' + scanTypeName +
            ', but none with the strong five-year record the formula insists on. The formula waits.'));
        opportunitiesContainer.replaceChildren(empty);
        requestAnimationFrame(() => {
            opportunitiesContainer.classList.add('revealed');
        });
        return;
    }

    const frag = document.createDocumentFragment();
    frag.appendChild(saEl('div', 'sc-results-meta',
        ranked.length + (ranked.length === 1 ? ' setup' : ' setups') + ' with a strong record found in ' + scanTypeName +
        '. Every card here won more than 75% of its backtested trades.'));

    if (scanType !== 'current') {
        const counts = {};
        ranked.forEach(opp => {
            const indexName = DTIUI.getIndexDisplayNameFromSymbol(opp.stock.symbol);
            counts[indexName] = (counts[indexName] || 0) + 1;
        });
        const tags = saEl('div', 'sc-tags');
        Object.keys(counts).forEach(name => {
            tags.appendChild(saEl('span', 'sa-badge sa-badge--neutral', name + ': ' + counts[name]));
        });
        frag.appendChild(tags);
    }

    const signalGrid = saEl('div', 'sc-signalgrid');
    ranked.forEach(opportunity => {
        signalGrid.appendChild(buildSignalCard(opportunity, stockWinRates[opportunity.stock.symbol] || 0));
    });
    frag.appendChild(signalGrid);

    opportunitiesContainer.replaceChildren(frag);

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

                    // Reveal the chart section BEFORE creating charts — Chart.js
                    // sizes canvases at creation, and a hidden parent gives them
                    // zero dimensions.
                    const chartSectionEl = document.querySelector('.chart-section');
                    if (chartSectionEl) chartSectionEl.hidden = false;

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

                    // The chart section sits at the top of the page — bring it
                    // into view now the backtest is loaded (all viewports).
                    if (chartSectionEl) {
                        chartSectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        
        // Update statistics card (v3 sa-stat markup)
        const statsContainer = document.getElementById('statistics');

        const buildStat = (label, value, context, tone) => {
            const cardEl = saEl('div', 'sa-card sa-card--sunk');
            const stat = saEl('div', 'sa-stat');
            stat.appendChild(saEl('span', 'sa-stat__label', label));
            stat.appendChild(saEl('span', 'sa-stat__value' + (tone ? ' sa-stat__value--' + tone : ''), value));
            stat.appendChild(saEl('span', 'sa-stat__context', context));
            cardEl.appendChild(stat);
            return cardEl;
        };

        if (totalTrades === 0) {
            statsContainer.replaceChildren(
                buildStat('Total trades', '0', 'Every trade this stock\u2019s five-year backtest would have made.'),
                buildStat('Win rate', '0%', 'How many of them made money.'),
                buildStat('Average per trade', '0%', 'The mean result of one trade, before costs.'),
                buildStat('All trades together', '0%', 'Every result added up, before costs.')
            );
            return;
        }

        const winTone = parseFloat(winRate) >= 50 ? 'gain' : 'loss';
        const avgTone = avgProfit > 0 ? 'gain' : avgProfit < 0 ? 'loss' : undefined;
        const totalTone = totalProfit > 0 ? 'gain' : totalProfit < 0 ? 'loss' : undefined;

        statsContainer.replaceChildren(
            buildStat('Total trades', String(totalTrades), 'Every trade this stock\u2019s five-year backtest would have made.'),
            buildStat('Win rate', winRate + '%', winningTrades + ' of ' + totalTrades + ' made money.', winTone),
            buildStat('Average per trade', avgProfit + '%', 'The mean result of one trade, before costs.', avgTone),
            buildStat('All trades together', totalProfit.toFixed(2) + '%', 'Every result added up, before costs.', totalTone),
            buildStat('Average hold', avgHoldingDays + ' days', 'How long the money was in each trade.'),
            buildStat('Hit the target', String(takeProfitCount), Math.round(takeProfitCount / totalTrades * 100) + '% of trades sold at +8%.', 'gain'),
            buildStat('Hit the stop', String(stopLossCount), Math.round(stopLossCount / totalTrades * 100) + '% were cut at \u22125%.', 'loss'),
            buildStat('Ran out of time', String(timeExitCount), Math.round(timeExitCount / totalTrades * 100) + '% sold on day 30.')
        );
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

        tbody.replaceChildren();
        const cardsContainer = document.getElementById('trades-table-cards');
        if (cardsContainer) cardsContainer.replaceChildren();

        const exitLabel = reason =>
            reason === 'Take Profit' ? 'Hit the +8% target' :
            reason === 'Stop Loss' ? 'Hit the \u22125% stop' :
            reason === 'Time Exit' ? 'Ran out of time' :
            reason === 'End of Data' ? 'Backtest ended' : reason;
        const exitTone = reason =>
            reason === 'Take Profit' ? 'gain' :
            reason === 'Stop Loss' ? 'loss' : 'neutral';
        const mkTd = (text, cls) => saEl('td', cls || null, text);

        if (completedTrades.length === 0) {
            const row = document.createElement('tr');
            const cell = saEl('td', 'sa-table__empty', 'No completed trades with the current rule.');
            cell.colSpan = 9;
            row.appendChild(cell);
            tbody.appendChild(row);
            return;
        }

        // Get the currency symbol based on the current index first
        let defaultCurrencySymbol = getCurrencySymbolForDisplay(DTIBacktester.currentStockIndex);

        // Sort trades by entry date
        completedTrades.sort((a, b) => new Date(a.entryDate) - new Date(b.entryDate));

        completedTrades.forEach((trade, index) => {
            const row = document.createElement('tr');
            const entryDate = new Date(trade.entryDate);
            const exitDate = new Date(trade.exitDate);
            const holdingDays = Math.floor((exitDate - entryDate) / (24 * 60 * 60 * 1000));
            const plTone = trade.plPercent >= 0 ? 'gain' : 'loss';

            row.appendChild(mkTd(DTIBacktester.utils.formatDate(trade.entryDate)));
            row.appendChild(mkTd(defaultCurrencySymbol + trade.entryPrice.toFixed(2), 'num'));
            row.appendChild(mkTd(trade.entryDTI.toFixed(2), 'num'));
            row.appendChild(mkTd(trade.entry7DayDTI ? trade.entry7DayDTI.toFixed(2) : 'N/A', 'num'));
            row.appendChild(mkTd(DTIBacktester.utils.formatDate(trade.exitDate)));
            row.appendChild(mkTd(defaultCurrencySymbol + trade.exitPrice.toFixed(2), 'num'));
            row.appendChild(mkTd(holdingDays + ' days', 'num'));
            row.appendChild(mkTd(trade.plPercent.toFixed(2) + '%', 'num ' + plTone));
            const reasonTd = document.createElement('td');
            reasonTd.appendChild(saEl('span', 'sa-badge sa-badge--' + exitTone(trade.exitReason), exitLabel(trade.exitReason)));
            row.appendChild(reasonTd);
            tbody.appendChild(row);

            if (cardsContainer) {
                const rc = saEl('div', 'sa-rowcard');
                const rcTop = saEl('div', 'sa-rowcard__top');
                rcTop.appendChild(saEl('strong', null, 'Bought ' + DTIBacktester.utils.formatDate(trade.entryDate)));
                rcTop.appendChild(saEl('span', 'sa-rowcard__v ' + plTone, trade.plPercent.toFixed(2) + '%'));
                rc.appendChild(rcTop);
                const rcGrid = saEl('div', 'sa-rowcard__grid');
                [['Bought at', defaultCurrencySymbol + trade.entryPrice.toFixed(2)],
                 ['Sold at', defaultCurrencySymbol + trade.exitPrice.toFixed(2)],
                 ['Sold on', DTIBacktester.utils.formatDate(trade.exitDate)],
                 ['Held for', holdingDays + ' days'],
                 ['Why it sold', exitLabel(trade.exitReason)]].forEach(pair => {
                    rcGrid.appendChild(saEl('span', 'sa-rowcard__k', pair[0]));
                    rcGrid.appendChild(saEl('span', 'sa-rowcard__v', pair[1]));
                });
                rc.appendChild(rcGrid);
                cardsContainer.appendChild(rc);
            }
        });

        // If there's an active trade, show it
        const activeTrade = trades.find(trade => !trade.exitDate || !trade.exitReason);
        if (activeTrade) {
            const row = document.createElement('tr');
            row.appendChild(mkTd(DTIBacktester.utils.formatDate(activeTrade.entryDate)));
            row.appendChild(mkTd(defaultCurrencySymbol + activeTrade.entryPrice.toFixed(2), 'num'));
            row.appendChild(mkTd(activeTrade.entryDTI.toFixed(2), 'num'));
            row.appendChild(mkTd(activeTrade.entry7DayDTI ? activeTrade.entry7DayDTI.toFixed(2) : 'N/A', 'num'));
            const openCell = document.createElement('td');
            openCell.colSpan = 5;
            openCell.appendChild(saEl('span', 'sa-badge sa-badge--accent', 'Still open \u2014 day ' + activeTrade.holdingDays));
            openCell.appendChild(saEl('span', 'num ' + ((activeTrade.currentPlPercent || 0) >= 0 ? 'gain' : 'loss'),
                ' ' + (activeTrade.currentPlPercent ? activeTrade.currentPlPercent.toFixed(2) : '0.00') + '% so far'));
            row.appendChild(openCell);
            tbody.appendChild(row);
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