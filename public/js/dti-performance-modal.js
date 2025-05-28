/**
 * DTI Performance Modal Module
 * Shows previous month's trading performance when scanning stocks
 */

DTIUI.PerformanceModal = (function() {
    // Store the current selected month offset (2 = two months ago, 3 = three months ago, etc.)
    let currentMonthOffset = 2;
    
    /**
     * Get the entry month date range based on offset
     * @param {number} monthsAgo - Number of months ago (2, 3, or 4)
     * @returns {Object} Object with startDate, endDate, and month info
     */
    function getEntryMonthRange(monthsAgo = currentMonthOffset) {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // 0-indexed
        
        // Get first day of specified months ago
        const startDate = new Date(year, month - monthsAgo, 1);
        
        // Get last day of specified months ago
        const endDate = new Date(year, month - monthsAgo + 1, 0);
        
        // Get month names for display
        const entryMonthName = startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const currentMonthName = now.toLocaleDateString('en-US', { month: 'long' });
        
        // Get previous and next month names for navigation
        const prevMonthName = monthsAgo < 4 ? new Date(year, month - (monthsAgo + 1), 1).toLocaleDateString('en-US', { month: 'long' }) : null;
        const nextMonthName = monthsAgo > 2 ? new Date(year, month - (monthsAgo - 1), 1).toLocaleDateString('en-US', { month: 'long' }) : null;
        
        return { 
            startDate, 
            endDate, 
            entryMonthName,
            currentMonthName,
            prevMonthName,
            nextMonthName,
            monthsAgo
        };
    }
    
    /**
     * Filter trades that were signals generated in the entry month
     * @param {Array} allStocksData - All processed stock data
     * @param {number} monthsAgo - Number of months ago to filter
     * @returns {Array} Filtered trades from entry month
     */
    function filterEntryMonthTrades(allStocksData, monthsAgo = currentMonthOffset) {
        const { startDate, endDate } = getEntryMonthRange(monthsAgo);
        const entryMonthTrades = [];
        
        allStocksData.forEach(stockData => {
            if (stockData.trades && stockData.trades.length > 0) {
                stockData.trades.forEach(trade => {
                    const entryDate = new Date(trade.entryDate);
                    // Check if the trade entry was in the entry month (2 months ago)
                    if (entryDate >= startDate && entryDate <= endDate) {
                        // Add additional analysis data
                        const exitDate = trade.exitDate ? new Date(trade.exitDate) : null;
                        const holdingDays = trade.holdingDays || 0;
                        
                        // Determine exit month
                        let exitMonth = 'Still Active';
                        let exitMonthClass = 'active';
                        if (exitDate) {
                            exitMonth = exitDate.toLocaleDateString('en-US', { month: 'long' });
                            exitMonthClass = getExitMonthClass(exitDate);
                        }
                        
                        entryMonthTrades.push({
                            stock: stockData.stock,
                            trade: {
                                ...trade,
                                holdingDays,
                                exitMonth,
                                exitMonthClass,
                                status: exitDate ? 'Closed' : 'Still Active'
                            }
                        });
                    }
                });
            }
        });
        
        // Sort trades by entry date in ascending order (earliest first)
        entryMonthTrades.sort((a, b) => {
            const dateA = new Date(a.trade.entryDate);
            const dateB = new Date(b.trade.entryDate);
            return dateA - dateB;
        });
        
        return entryMonthTrades;
    }
    
    /**
     * Get CSS class for exit month coloring
     * @param {Date} exitDate - Exit date
     * @returns {string} CSS class name
     */
    function getExitMonthClass(exitDate) {
        const now = new Date();
        const monthsAgo = (now.getFullYear() - exitDate.getFullYear()) * 12 + (now.getMonth() - exitDate.getMonth());
        
        if (monthsAgo === 0) return 'current-month';
        if (monthsAgo === 1) return 'last-month';
        if (monthsAgo === 2) return 'entry-month';
        return 'older-month';
    }
    
    /**
     * Filter only high conviction trades
     * @param {Array} trades - Array of trades
     * @param {Array} allStocksData - All stocks data for conviction calculation
     * @returns {Array} Filtered high conviction trades
     */
    function filterHighConvictionTrades(trades, allStocksData) {
        return trades.filter(({ stock, trade }) => {
            // Calculate stock win rate from historical trades
            const stockData = allStocksData.find(data => data.stock.name === stock.name);
            let winRate = 0;
            
            if (stockData && stockData.trades && stockData.trades.length > 0) {
                const completedTrades = stockData.trades.filter(t => t.exitDate);
                if (completedTrades.length > 0) {
                    const winningTrades = completedTrades.filter(t => t.plPercent > 0).length;
                    winRate = (winningTrades / completedTrades.length) * 100;
                }
            }
            
            // Return only high conviction trades (win rate > 75%)
            return winRate > 75;
        });
    }
    
    /**
     * Calculate enhanced performance metrics for the trades
     * @param {Array} trades - Array of trades from entry month
     * @param {Array} allStocksData - All stocks data for conviction calculation
     * @returns {Object} Enhanced performance metrics
     */
    function calculatePerformanceMetrics(trades, allStocksData) {
        if (trades.length === 0) {
            return {
                totalTrades: 0,
                profitableTrades: 0,
                lossTrades: 0,
                activeTrades: 0,
                winRate: 0,
                avgProfit: 0,
                avgLoss: 0,
                totalReturn: 0,
                avgHoldingDays: 0,
                exitReasons: {},
                exitTimeline: {},
                durationBreakdown: {},
                convictionCounts: {
                    high: 0,
                    moderate: 0,
                    low: 0
                },
                convictionMetrics: {
                    high: {
                        totalTrades: 0,
                        profitableTrades: 0,
                        lossTrades: 0,
                        activeTrades: 0,
                        completedTrades: 0,
                        winRate: 0,
                        avgProfit: 0,
                        avgLoss: 0,
                        totalProfit: 0,
                        totalLoss: 0,
                        totalReturn: 0
                    },
                    moderate: {
                        totalTrades: 0,
                        profitableTrades: 0,
                        lossTrades: 0,
                        activeTrades: 0,
                        completedTrades: 0,
                        winRate: 0,
                        avgProfit: 0,
                        avgLoss: 0,
                        totalProfit: 0,
                        totalLoss: 0,
                        totalReturn: 0
                    },
                    low: {
                        totalTrades: 0,
                        profitableTrades: 0,
                        lossTrades: 0,
                        activeTrades: 0,
                        completedTrades: 0,
                        winRate: 0,
                        avgProfit: 0,
                        avgLoss: 0,
                        totalProfit: 0,
                        totalLoss: 0,
                        totalReturn: 0
                    }
                }
            };
        }
        
        let profitableTrades = 0;
        let lossTrades = 0;
        let activeTrades = 0;
        let totalProfit = 0;
        let totalLoss = 0;
        let totalReturn = 0;
        let totalHoldingDays = 0;
        let exitReasons = {};
        let exitTimeline = {};
        let durationBreakdown = { short: 0, medium: 0, long: 0 };
        let convictionCounts = { high: 0, moderate: 0, low: 0 };
        let convictionMetrics = {
            high: {
                totalTrades: 0,
                profitableTrades: 0,
                lossTrades: 0,
                activeTrades: 0,
                totalProfit: 0,
                totalLoss: 0,
                totalReturn: 0
            },
            moderate: {
                totalTrades: 0,
                profitableTrades: 0,
                lossTrades: 0,
                activeTrades: 0,
                totalProfit: 0,
                totalLoss: 0,
                totalReturn: 0
            },
            low: {
                totalTrades: 0,
                profitableTrades: 0,
                lossTrades: 0,
                activeTrades: 0,
                totalProfit: 0,
                totalLoss: 0,
                totalReturn: 0
            }
        };
        
        trades.forEach(({ stock, trade }) => {
            const plPercent = trade.plPercent || 0;
            const holdingDays = trade.holdingDays || 0;
            const exitReason = trade.exitReason || 'Still Active';
            const exitMonth = trade.exitMonth || 'Still Active';
            
            // Calculate conviction level for this stock
            const stockData = allStocksData.find(data => data.stock.name === stock.name);
            let winRate = 0;
            
            if (stockData && stockData.trades && stockData.trades.length > 0) {
                const completedTrades = stockData.trades.filter(t => t.exitDate);
                if (completedTrades.length > 0) {
                    const winningTrades = completedTrades.filter(t => t.plPercent > 0).length;
                    winRate = (winningTrades / completedTrades.length) * 100;
                }
            }
            
            // Determine conviction level
            let convictionLevel;
            if (winRate > 75) {
                convictionLevel = 'high';
                convictionCounts.high++;
            } else if (winRate >= 50) {
                convictionLevel = 'moderate';
                convictionCounts.moderate++;
            } else {
                convictionLevel = 'low';
                convictionCounts.low++;
            }
            
            // Update conviction metrics
            convictionMetrics[convictionLevel].totalTrades++;
            convictionMetrics[convictionLevel].totalReturn += plPercent;
            
            totalReturn += plPercent;
            totalHoldingDays += holdingDays;
            
            // Count by status
            if (trade.status === 'Still Active') {
                activeTrades++;
                convictionMetrics[convictionLevel].activeTrades++;
            } else if (plPercent > 0) {
                profitableTrades++;
                totalProfit += plPercent;
                convictionMetrics[convictionLevel].profitableTrades++;
                convictionMetrics[convictionLevel].totalProfit += plPercent;
            } else if (plPercent < 0) {
                lossTrades++;
                totalLoss += plPercent;
                convictionMetrics[convictionLevel].lossTrades++;
                convictionMetrics[convictionLevel].totalLoss += plPercent;
            }
            
            // Exit reasons
            exitReasons[exitReason] = (exitReasons[exitReason] || 0) + 1;
            
            // Exit timeline
            exitTimeline[exitMonth] = (exitTimeline[exitMonth] || 0) + 1;
            
            // Duration breakdown
            if (holdingDays <= 10) {
                durationBreakdown.short++;
            } else if (holdingDays <= 20) {
                durationBreakdown.medium++;
            } else {
                durationBreakdown.long++;
            }
        });
        
        const completedTrades = trades.length - activeTrades;
        
        // Calculate metrics for each conviction level
        Object.keys(convictionMetrics).forEach(level => {
            const metrics = convictionMetrics[level];
            metrics.completedTrades = metrics.totalTrades - metrics.activeTrades;
            
            if (metrics.completedTrades > 0) {
                metrics.winRate = ((metrics.profitableTrades / metrics.completedTrades) * 100).toFixed(1);
            }
            
            if (metrics.profitableTrades > 0) {
                metrics.avgProfit = (metrics.totalProfit / metrics.profitableTrades).toFixed(2);
            }
            
            if (metrics.lossTrades > 0) {
                metrics.avgLoss = (metrics.totalLoss / metrics.lossTrades).toFixed(2);
            }
            
            metrics.totalReturn = metrics.totalReturn.toFixed(2);
        });
        
        return {
            totalTrades: trades.length,
            profitableTrades,
            lossTrades,
            activeTrades,
            completedTrades,
            winRate: completedTrades > 0 ? (profitableTrades / completedTrades * 100).toFixed(1) : 0,
            avgProfit: profitableTrades > 0 ? (totalProfit / profitableTrades).toFixed(2) : 0,
            avgLoss: lossTrades > 0 ? (totalLoss / lossTrades).toFixed(2) : 0,
            totalReturn: totalReturn.toFixed(2),
            avgHoldingDays: trades.length > 0 ? (totalHoldingDays / trades.length).toFixed(1) : 0,
            exitReasons,
            exitTimeline,
            durationBreakdown,
            convictionCounts,
            convictionMetrics
        };
    }
    
    /**
     * Create and show the performance modal
     * @param {Array} allStocksData - All processed stock data
     * @param {string} indexName - Name of the scanned index
     */
    function showPerformanceModal(allStocksData, indexName) {
        // Store data for month navigation
        window.performanceModalData = { allStocksData, indexName };
        
        // Reset to default month offset (2 months ago)
        currentMonthOffset = 2;
        
        // Show modal with current month data
        updateModalContent();
    }
    
    /**
     * Update modal content for the selected month
     */
    function updateModalContent() {
        const { allStocksData, indexName } = window.performanceModalData;
        
        // Filter entry month trades for current offset
        let entryMonthTrades = filterEntryMonthTrades(allStocksData, currentMonthOffset);
        
        // For "All Global Stocks", filter only high conviction trades
        const isAllGlobalIndices = indexName === 'All Global Stocks';
        if (isAllGlobalIndices) {
            entryMonthTrades = filterHighConvictionTrades(entryMonthTrades, allStocksData);
        }
        
        const metrics = calculatePerformanceMetrics(entryMonthTrades, allStocksData);
        const { entryMonthName, currentMonthName, prevMonthName, nextMonthName, monthsAgo } = getEntryMonthRange();
        
        // Check if modal already exists
        let modalOverlay = document.getElementById('performance-modal-overlay');
        let modalContent;
        
        if (modalOverlay) {
            // Update existing modal
            modalContent = modalOverlay.querySelector('.modal-content');
        } else {
            // Create new modal
            modalOverlay = document.createElement('div');
            modalOverlay.className = 'modal-overlay';
            modalOverlay.id = 'performance-modal-overlay';
            
            modalContent = document.createElement('div');
            modalContent.className = 'modal-content performance-modal';
            modalOverlay.appendChild(modalContent);
            document.body.appendChild(modalOverlay);
        }
        
        // Build exit timeline analysis
        const exitTimelineHTML = Object.keys(metrics.exitTimeline).length > 0 ? `
            <div class="exit-timeline">
                <h4>Exit Timeline Analysis</h4>
                <div class="timeline-breakdown">
                    ${Object.entries(metrics.exitTimeline).map(([month, count]) => `
                        <div class="timeline-item">
                            <span class="timeline-month">${month}:</span>
                            <span class="timeline-count">${count} trade${count !== 1 ? 's' : ''}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : '';

        // Build exit reasons analysis
        const exitReasonsHTML = Object.keys(metrics.exitReasons).length > 0 ? `
            <div class="exit-reasons">
                <h4>Exit Reasons Breakdown</h4>
                <div class="reasons-breakdown">
                    ${Object.entries(metrics.exitReasons).map(([reason, count]) => `
                        <div class="reason-item">
                            <span class="reason-label">${reason}:</span>
                            <span class="reason-count">${count} trade${count !== 1 ? 's' : ''}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : '';

        // Build trades list HTML
        let tradesListHTML = '';
        if (entryMonthTrades.length > 0) {
            tradesListHTML = `
                <div class="performance-trades-list">
                    <table class="performance-trades-table">
                        <thead>
                            <tr>
                                <th>Stock</th>
                                <th>Entry Date</th>
                                <th>Exit Date</th>
                                <th>Days Held</th>
                                <th>Exit Month</th>
                                <th>P/L %</th>
                                <th>Exit Reason</th>
                                <th>Status</th>
                                <th>Win Rate</th>
                                ${!isAllGlobalIndices ? '<th>Conviction</th>' : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${entryMonthTrades.map(({ stock, trade }) => {
                                // Calculate stock win rate from historical trades
                                const stockData = allStocksData.find(data => data.stock.name === stock.name);
                                let winRate = 0;
                                
                                if (stockData && stockData.trades && stockData.trades.length > 0) {
                                    const completedTrades = stockData.trades.filter(t => t.exitDate);
                                    if (completedTrades.length > 0) {
                                        const winningTrades = completedTrades.filter(t => t.plPercent > 0).length;
                                        winRate = (winningTrades / completedTrades.length) * 100;
                                    }
                                }
                                
                                // Determine conviction level
                                let convictionLevel = 'Low';
                                let convictionClass = 'low-conviction';
                                if (winRate > 75) {
                                    convictionLevel = 'High';
                                    convictionClass = 'high-conviction';
                                } else if (winRate >= 50) {
                                    convictionLevel = 'Moderate';
                                    convictionClass = 'moderate-conviction';
                                }
                                
                                return `
                                <tr class="${trade.plPercent >= 0 ? 'profit' : (trade.plPercent < 0 ? 'loss' : 'neutral')} ${trade.exitMonthClass}">
                                    <td>${stock.name}</td>
                                    <td>${DTIBacktester.utils.formatDate(trade.entryDate)}</td>
                                    <td>${trade.exitDate ? DTIBacktester.utils.formatDate(trade.exitDate) : '-'}</td>
                                    <td>${trade.holdingDays} days</td>
                                    <td class="exit-month ${trade.exitMonthClass}">${trade.exitMonth}</td>
                                    <td class="${trade.plPercent >= 0 ? 'profit' : (trade.plPercent < 0 ? 'loss' : 'neutral')}">${trade.plPercent ? trade.plPercent.toFixed(2) + '%' : '-'}</td>
                                    <td>${trade.exitReason || 'Still Active'}</td>
                                    <td class="status-${trade.status.toLowerCase().replace(' ', '-')}">${trade.status}</td>
                                    <td>${winRate.toFixed(1)}%</td>
                                    ${!isAllGlobalIndices ? `<td class="${convictionClass}">${convictionLevel}</td>` : ''}
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            tradesListHTML = `
                <div class="no-trades-message">
                    <p>${isAllGlobalIndices ? 
                        `No high conviction trading signals were generated across global indices in ${entryMonthName}.` : 
                        `No trading signals were generated for ${indexName} stocks in ${entryMonthName}.`
                    }</p>
                </div>
            `;
        }
        
        modalContent.innerHTML = `
            <div class="modal-header">
                <h2>${isAllGlobalIndices ? 'High Conviction Trades' : 'Performance Report'}: ${entryMonthName} Entry Signals</h2>
                <div class="month-navigation">
                    ${prevMonthName ? `
                        <button class="month-nav-btn" onclick="DTIUI.PerformanceModal.navigateMonth(${monthsAgo + 1})" title="View ${prevMonthName} signals">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                            ${prevMonthName}
                        </button>
                    ` : '<div class="month-nav-spacer"></div>'}
                    
                    <span class="current-month-label">${entryMonthName}</span>
                    
                    ${nextMonthName ? `
                        <button class="month-nav-btn" onclick="DTIUI.PerformanceModal.navigateMonth(${monthsAgo - 1})" title="View ${nextMonthName} signals">
                            ${nextMonthName}
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </button>
                    ` : '<div class="month-nav-spacer"></div>'}
                </div>
                <button class="modal-close" onclick="DTIUI.PerformanceModal.closeModal()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            
            <div class="modal-body">
                <div class="performance-summary">
                    <p class="summary-intro">
                        ${isAllGlobalIndices ? 
                            `This strategy generated <strong>${metrics.totalTrades}</strong> high conviction trading signals across all global indices in <strong>${entryMonthName}</strong>. 
                            ${metrics.completedTrades > 0 ? `Of these, <strong>${metrics.completedTrades}</strong> trades have been completed and <strong>${metrics.activeTrades}</strong> are still active.` : ''}` 
                            : 
                            `This strategy generated <strong>${metrics.convictionCounts.high}</strong> high conviction trades, 
                            <strong>${metrics.convictionCounts.moderate}</strong> moderate conviction trades, and 
                            <strong>${metrics.convictionCounts.low}</strong> low conviction trading signals for ${indexName} stocks in <strong>${entryMonthName}</strong>. 
                            ${metrics.completedTrades > 0 ? `Of these, <strong>${metrics.completedTrades}</strong> trades have been completed and <strong>${metrics.activeTrades}</strong> are still active.` : ''}`
                        }
                    </p>
                    
                    ${metrics.totalTrades > 0 ? `
                        <div class="performance-metrics">
                            <div class="metric-card">
                                <div class="metric-value">${metrics.totalTrades}</div>
                                <div class="metric-label">Total Signals</div>
                            </div>
                            <div class="metric-card">
                                <div class="metric-value">${metrics.completedTrades}</div>
                                <div class="metric-label">Completed</div>
                            </div>
                            <div class="metric-card">
                                <div class="metric-value">${metrics.winRate}%</div>
                                <div class="metric-label">Win Rate</div>
                            </div>
                            <div class="metric-card">
                                <div class="metric-value">${metrics.avgHoldingDays}</div>
                                <div class="metric-label">Avg Days</div>
                            </div>
                            <div class="metric-card profit">
                                <div class="metric-value">${metrics.profitableTrades}</div>
                                <div class="metric-label">Profitable</div>
                            </div>
                            <div class="metric-card loss">
                                <div class="metric-value">${metrics.lossTrades}</div>
                                <div class="metric-label">Loss Making</div>
                            </div>
                            ${metrics.activeTrades > 0 ? `
                                <div class="metric-card active">
                                    <div class="metric-value">${metrics.activeTrades}</div>
                                    <div class="metric-label">Still Active</div>
                                </div>
                            ` : ''}
                        </div>
                        
                        <div class="performance-details">
                            <div class="detail-row">
                                <span>Average Profit per Winning Trade:</span>
                                <span class="profit">+${metrics.avgProfit}%</span>
                            </div>
                            <div class="detail-row">
                                <span>Average Loss per Losing Trade:</span>
                                <span class="loss">${metrics.avgLoss}%</span>
                            </div>
                            <div class="detail-row">
                                <span>Average Holding Period:</span>
                                <span>${metrics.avgHoldingDays} days</span>
                            </div>
                            <div class="detail-row total">
                                <span>Total Return from Completed Trades:</span>
                                <span class="${metrics.totalReturn >= 0 ? 'profit' : 'loss'}">${metrics.totalReturn >= 0 ? '+' : ''}${metrics.totalReturn}%</span>
                            </div>
                        </div>
                        
                        <div class="analysis-sections">
                            <!-- Conviction Performance Analysis -->
                            ${!isAllGlobalIndices ? `
                            <div class="conviction-performance-analysis">
                                <h4>Performance by Conviction Level</h4>
                                <div class="conviction-performance-cards">
                                    ${metrics.convictionMetrics.high.totalTrades > 0 ? `
                                        <div class="conviction-perf-card high-conviction">
                                            <h5>High Conviction Trades</h5>
                                            <div class="conviction-metrics-grid">
                                                <div class="metric-item">
                                                    <span class="metric-label">Total Trades:</span>
                                                    <span class="metric-value">${metrics.convictionMetrics.high.totalTrades}</span>
                                                </div>
                                                <div class="metric-item">
                                                    <span class="metric-label">Win Rate:</span>
                                                    <span class="metric-value">${metrics.convictionMetrics.high.winRate}%</span>
                                                </div>
                                                <div class="metric-item">
                                                    <span class="metric-label">Profitable:</span>
                                                    <span class="metric-value profit">${metrics.convictionMetrics.high.profitableTrades}</span>
                                                </div>
                                                <div class="metric-item">
                                                    <span class="metric-label">Loss:</span>
                                                    <span class="metric-value loss">${metrics.convictionMetrics.high.lossTrades}</span>
                                                </div>
                                                ${metrics.convictionMetrics.high.activeTrades > 0 ? `
                                                    <div class="metric-item">
                                                        <span class="metric-label">Active:</span>
                                                        <span class="metric-value active">${metrics.convictionMetrics.high.activeTrades}</span>
                                                    </div>
                                                ` : ''}
                                                <div class="metric-item">
                                                    <span class="metric-label">Avg Profit:</span>
                                                    <span class="metric-value profit">+${metrics.convictionMetrics.high.avgProfit}%</span>
                                                </div>
                                                <div class="metric-item">
                                                    <span class="metric-label">Avg Loss:</span>
                                                    <span class="metric-value loss">${metrics.convictionMetrics.high.avgLoss}%</span>
                                                </div>
                                                <div class="metric-item total">
                                                    <span class="metric-label">Total Return:</span>
                                                    <span class="metric-value ${metrics.convictionMetrics.high.totalReturn >= 0 ? 'profit' : 'loss'}">
                                                        ${metrics.convictionMetrics.high.totalReturn >= 0 ? '+' : ''}${metrics.convictionMetrics.high.totalReturn}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ` : ''}
                                    
                                    ${metrics.convictionMetrics.moderate.totalTrades > 0 ? `
                                        <div class="conviction-perf-card moderate-conviction">
                                            <h5>Moderate Conviction Trades</h5>
                                            <div class="conviction-metrics-grid">
                                                <div class="metric-item">
                                                    <span class="metric-label">Total Trades:</span>
                                                    <span class="metric-value">${metrics.convictionMetrics.moderate.totalTrades}</span>
                                                </div>
                                                <div class="metric-item">
                                                    <span class="metric-label">Win Rate:</span>
                                                    <span class="metric-value">${metrics.convictionMetrics.moderate.winRate}%</span>
                                                </div>
                                                <div class="metric-item">
                                                    <span class="metric-label">Profitable:</span>
                                                    <span class="metric-value profit">${metrics.convictionMetrics.moderate.profitableTrades}</span>
                                                </div>
                                                <div class="metric-item">
                                                    <span class="metric-label">Loss:</span>
                                                    <span class="metric-value loss">${metrics.convictionMetrics.moderate.lossTrades}</span>
                                                </div>
                                                ${metrics.convictionMetrics.moderate.activeTrades > 0 ? `
                                                    <div class="metric-item">
                                                        <span class="metric-label">Active:</span>
                                                        <span class="metric-value active">${metrics.convictionMetrics.moderate.activeTrades}</span>
                                                    </div>
                                                ` : ''}
                                                <div class="metric-item">
                                                    <span class="metric-label">Avg Profit:</span>
                                                    <span class="metric-value profit">+${metrics.convictionMetrics.moderate.avgProfit}%</span>
                                                </div>
                                                <div class="metric-item">
                                                    <span class="metric-label">Avg Loss:</span>
                                                    <span class="metric-value loss">${metrics.convictionMetrics.moderate.avgLoss}%</span>
                                                </div>
                                                <div class="metric-item total">
                                                    <span class="metric-label">Total Return:</span>
                                                    <span class="metric-value ${metrics.convictionMetrics.moderate.totalReturn >= 0 ? 'profit' : 'loss'}">
                                                        ${metrics.convictionMetrics.moderate.totalReturn >= 0 ? '+' : ''}${metrics.convictionMetrics.moderate.totalReturn}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ` : ''}
                                    
                                    ${metrics.convictionMetrics.low.totalTrades > 0 ? `
                                        <div class="conviction-perf-card low-conviction">
                                            <h5>Low Conviction Trades</h5>
                                            <div class="conviction-metrics-grid">
                                                <div class="metric-item">
                                                    <span class="metric-label">Total Trades:</span>
                                                    <span class="metric-value">${metrics.convictionMetrics.low.totalTrades}</span>
                                                </div>
                                                <div class="metric-item">
                                                    <span class="metric-label">Win Rate:</span>
                                                    <span class="metric-value">${metrics.convictionMetrics.low.winRate}%</span>
                                                </div>
                                                <div class="metric-item">
                                                    <span class="metric-label">Profitable:</span>
                                                    <span class="metric-value profit">${metrics.convictionMetrics.low.profitableTrades}</span>
                                                </div>
                                                <div class="metric-item">
                                                    <span class="metric-label">Loss:</span>
                                                    <span class="metric-value loss">${metrics.convictionMetrics.low.lossTrades}</span>
                                                </div>
                                                ${metrics.convictionMetrics.low.activeTrades > 0 ? `
                                                    <div class="metric-item">
                                                        <span class="metric-label">Active:</span>
                                                        <span class="metric-value active">${metrics.convictionMetrics.low.activeTrades}</span>
                                                    </div>
                                                ` : ''}
                                                <div class="metric-item">
                                                    <span class="metric-label">Avg Profit:</span>
                                                    <span class="metric-value profit">+${metrics.convictionMetrics.low.avgProfit}%</span>
                                                </div>
                                                <div class="metric-item">
                                                    <span class="metric-label">Avg Loss:</span>
                                                    <span class="metric-value loss">${metrics.convictionMetrics.low.avgLoss}%</span>
                                                </div>
                                                <div class="metric-item total">
                                                    <span class="metric-label">Total Return:</span>
                                                    <span class="metric-value ${metrics.convictionMetrics.low.totalReturn >= 0 ? 'profit' : 'loss'}">
                                                        ${metrics.convictionMetrics.low.totalReturn >= 0 ? '+' : ''}${metrics.convictionMetrics.low.totalReturn}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                            ` : ''}
                            
                            ${exitTimelineHTML}
                            ${exitReasonsHTML}
                        </div>
                    ` : ''}
                </div>
                
                ${tradesListHTML}
            </div>
            
            <div class="modal-footer">
                <button class="btn-secondary" onclick="DTIUI.PerformanceModal.closeModal()">Close</button>
                <button class="btn-primary" onclick="DTIUI.PerformanceModal.navigateToOpportunities()">
                    View Current Opportunities
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 8px;">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                </button>
            </div>
        `;
        
        // Add fade-in effect only for new modals
        if (!modalOverlay.classList.contains('active')) {
            setTimeout(() => {
                modalOverlay.classList.add('active');
            }, 10);
        }
    }
    
    /**
     * Navigate to a different month
     * @param {number} monthsAgo - Number of months ago to navigate to
     */
    function navigateMonth(monthsAgo) {
        // Validate month range (2-4 months ago)
        if (monthsAgo < 2 || monthsAgo > 4) return;
        
        currentMonthOffset = monthsAgo;
        updateModalContent();
    }
    
    /**
     * Close the performance modal
     */
    function closeModal() {
        const modalOverlay = document.getElementById('performance-modal-overlay');
        if (modalOverlay) {
            modalOverlay.classList.remove('active');
            setTimeout(() => {
                modalOverlay.remove();
            }, 300);
        }
    }
    
    /**
     * Navigate to buying opportunities section
     */
    function navigateToOpportunities() {
        closeModal();
        
        // Scroll to buying opportunities section
        const opportunitiesSection = document.getElementById('buying-opportunities');
        if (opportunitiesSection) {
            opportunitiesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Add a highlight effect
            opportunitiesSection.classList.add('highlight');
            setTimeout(() => {
                opportunitiesSection.classList.remove('highlight');
            }, 2000);
        }
    }
    
    // Export public functions
    return {
        showPerformanceModal,
        closeModal,
        navigateToOpportunities,
        navigateMonth
    };
})();