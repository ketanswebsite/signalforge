/**
 * DTI Backtester - Export and Metrics UI Module
 * Handles exports, reports, and advanced analytics
 */

// Create Export and Metrics module
window.TradeUIModules = window.TradeUIModules || {};
window.TradeUIModules.export = (function() {
    /**
     * Initialize the export module
     */
    function init() {
        
        // Add import/export UI components
        initializeImportExportUI();
    }
    
    /**
     * Initialize import/export UI components
     */
    function initializeImportExportUI() {
        // Ensure necessary buttons exist in the trade actions section
        addImportExportButtons();
    }
    
    /**
     * Add import/export buttons to the UI if they don't exist
     */
    function addImportExportButtons() {
        const tradeActions = document.querySelector('.trade-actions');
        
        if (tradeActions) {
            // Check if import button already exists
            if (!document.getElementById('btn-import-trades')) {
                const importButton = document.createElement('button');
                importButton.id = 'btn-import-trades';
                importButton.className = 'btn-primary';
                importButton.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    Import Trades
                `;
                
                // Insert import button after export button
                tradeActions.insertBefore(importButton, document.getElementById('btn-clear-history'));
            }
            
            // Check if export all button already exists
            if (!document.getElementById('btn-export-all-trades')) {
                const exportAllButton = document.createElement('button');
                exportAllButton.id = 'btn-export-all-trades';
                exportAllButton.className = 'btn-secondary';
                exportAllButton.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Export All Trades
                `;
                
                // Insert export all button before export history button
                const exportHistoryBtn = document.getElementById('btn-export-history');
                if (exportHistoryBtn) {
                    tradeActions.insertBefore(exportAllButton, exportHistoryBtn);
                } else {
                    // Fallback - add as first button
                    tradeActions.insertBefore(exportAllButton, tradeActions.firstChild);
                }
            }
        }
    }
    
    /**
     * Setup all export buttons
     */
    function setupExportButtons() {
        setupExportButton();
        setupExportChartsButton();
        setupExportReportButton();
        setupImportExportEvents();
    }
    
    /**
     * Setup export button
     */
    function setupExportButton() {
        const exportBtn = document.getElementById('btn-export-history');
        if (exportBtn) {
            exportBtn.addEventListener('click', function() {
                // Check if we have trades to export
                const closedTrades = TradeCore.getTrades('closed');
                if (closedTrades.length === 0) {
                    TradeCore.showNotification('No trade history to export', 'info');
                    return;
                }
                
                // Show loading state (keep the page's own label to restore)
                const originalChildren = Array.from(this.childNodes).map(n => n.cloneNode(true));
                this.disabled = true;
                this.textContent = 'Generating CSV…';

                // Small delay for better UX
                setTimeout(() => {
                    try {
                        // Generate CSV
                        const blob = TradeCore.exportTradeHistoryCSV();
                        
                        if (blob) {
                            // Create download link
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            
                            link.setAttribute('href', url);
                            link.setAttribute('download', `dti_trades_history_${TradeCore.formatDateForFilename(new Date())}.csv`);
                            link.hidden = true;
                            
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            
                            TradeCore.showNotification(`Exported ${closedTrades.length} trade records successfully`, 'success');
                        }
                    } catch (error) {
                        TradeCore.showNotification('Error exporting trade history: ' + error.message, 'error');
                    } finally {
                        // Reset button state to the page's own label
                        this.disabled = false;
                        this.replaceChildren(...originalChildren.map(n => n.cloneNode(true)));
                    }
                }, 500);
            });
        }
    }
    
    /**
     * Setup export charts button
     */
    function setupExportChartsButton() {
        const exportChartsBtn = document.getElementById('export-charts');
        if (exportChartsBtn) {
            exportChartsBtn.addEventListener('click', function() {
                handleExportCharts();
            });
        }
    }
    
    /**
     * Setup export report button
     */
    function setupExportReportButton() {
        const exportReportBtn = document.getElementById('export-report');
        if (exportReportBtn) {
            exportReportBtn.addEventListener('click', function() {
                handleExportReport();
            });
        }
    }
    
    /**
     * Setup import/export events
     */
    function setupImportExportEvents() {
        // Setup export all trades button
        const exportAllBtn = document.getElementById('btn-export-all-trades');
        if (exportAllBtn) {
            exportAllBtn.addEventListener('click', function() {
                handleExportAllTrades();
            });
        }
        
        // Setup import trades button
        const importBtn = document.getElementById('btn-import-trades');
        if (importBtn) {
            importBtn.addEventListener('click', function() {
                if (window.TradeUI && window.TradeUI.openImportDialog) {
                    window.TradeUI.openImportDialog();
                }
            });
        }
    }
    
    /**
     * Handle export all trades to JSON
     */
    function handleExportAllTrades() {
        const exportBtn = document.getElementById('btn-export-all-trades');
        
        // Check if we have trades to export
        const allTrades = TradeCore.getTrades('all');
        if (allTrades.length === 0) {
            TradeCore.showNotification('No trades to export', 'info');
            return;
        }
        
        // Show loading state (keep the page's own label to restore)
        const originalChildren = exportBtn ? Array.from(exportBtn.childNodes).map(n => n.cloneNode(true)) : [];
        if (exportBtn) {
            exportBtn.disabled = true;
            exportBtn.textContent = 'Exporting…';
        }
        
        // Small delay for better UX
        setTimeout(() => {
            try {
                // Generate JSON
                const blob = TradeCore.exportAllTradesJSON();
                
                if (blob) {
                    // Create download link
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    
                    const activeTrades = TradeCore.getTrades('active').length;
                    const closedTrades = TradeCore.getTrades('closed').length;
                    
                    link.setAttribute('href', url);
                    link.setAttribute('download', `dti_all_trades_${TradeCore.formatDateForFilename(new Date())}.json`);
                    link.hidden = true;
                    
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    
                    TradeCore.showNotification(`Exported ${allTrades.length} trades (${activeTrades} active, ${closedTrades} closed)`, 'success');
                }
            } catch (error) {
                TradeCore.showNotification('Error exporting trades: ' + error.message, 'error');
            } finally {
                // Reset button state to the page's own label
                if (exportBtn) {
                    exportBtn.disabled = false;
                    exportBtn.replaceChildren(...originalChildren.map(n => n.cloneNode(true)));
                }
            }
        }, 500);
    }
    
    /**
     * Get chart instance by canvas ID
     * @param {string} canvasId - Canvas element ID
     * @returns {Chart|null} - Chart.js instance or null
     */
    function getChartInstance(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            return null;
        }
        
        // Get Chart.js instance from the canvas
        const chart = Chart.getChart(canvas);
        if (!chart) {
            return null;
        }
        
        return chart;
    }
    
    /**
     * Ensure chart is rendered and get its canvas data URL
     * @param {string} canvasId - Canvas element ID
     * @param {string} chartTitle - Chart title for logging
     * @returns {string|null} - Data URL or null
     */
    function getChartDataUrl(canvasId, chartTitle) {
        try {
            const chart = getChartInstance(canvasId);
            if (!chart) {
                return null;
            }
            
            // Ensure the chart is fully rendered
            chart.update('none'); // Update without animation
            
            // Get the canvas element
            const canvas = chart.canvas;
            if (!canvas) {
                return null;
            }
            
            // Convert to data URL
            return canvas.toDataURL('image/png', 1.0); // High quality
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Ensure all charts are rendered by switching tabs and waiting
     * @returns {Promise} - Promise that resolves when all charts are rendered
     */
    function ensureChartsRendered() {
        return new Promise((resolve) => {
            const analyticsTabs = document.querySelectorAll('.analytics-tab');
            const tabContents = document.querySelectorAll('.analytics-tab-content');

            if (analyticsTabs.length === 0) {
                resolve();
                return;
            }

            // Remember which tab the user was on BEFORE cycling through them
            const originalTab = document.querySelector('.analytics-tab.active');

            let currentTabIndex = 0;

            function switchToNextTab() {
                if (currentTabIndex >= analyticsTabs.length) {
                    // All tabs processed, switch back to the originally active tab
                    if (originalTab) {
                        originalTab.click();
                    }
                    resolve();
                    return;
                }
                
                // Switch to current tab
                const tab = analyticsTabs[currentTabIndex];
                
                // Remove active class from all tabs and contents
                analyticsTabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Add active class to current tab
                tab.classList.add('active');
                
                // Show corresponding content
                const tabId = tab.getAttribute('data-tab');
                const tabContent = document.getElementById(tabId);
                if (tabContent) {
                    tabContent.classList.add('active');
                }
                
                // Wait for charts to render
                setTimeout(() => {
                    // Trigger resize to ensure charts are properly sized
                    window.dispatchEvent(new Event('resize'));
                    
                    // Move to next tab
                    currentTabIndex++;
                    setTimeout(switchToNextTab, 200);
                }, 300);
            }
            
            switchToNextTab();
        });
    }
    
    /**
     * Handle export charts action
     * Creates a new window with all charts for easy saving and printing
     */
    function handleExportCharts() {
        // Get the export button to show loading state
        const exportChartsBtn = document.getElementById('export-charts');

        // Show loading state (keep the page's own label to restore)
        const originalChildren = exportChartsBtn ? Array.from(exportChartsBtn.childNodes).map(n => n.cloneNode(true)) : [];
        if (exportChartsBtn) {
            exportChartsBtn.disabled = true;
            exportChartsBtn.textContent = 'Preparing charts…';
        }

        // Ensure all charts are rendered first
        ensureChartsRendered().then(() => {
            try {
                // Create a new window for chart display
                const exportWindow = window.open('', '_blank');
                if (!exportWindow) {
                    TradeCore.showNotification('Allow pop-ups for this site to export charts', 'info');
                    return;
                }
                
                // Create HTML content for the export window
                const exportDate = window.DateFormatter ? window.DateFormatter.formatTime(new Date()) : new Date().toLocaleString();
                let htmlContent = `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>SutrAlgo charts - ${exportDate}</title>
                        <link rel="stylesheet" href="${window.location.origin}/css/export.css">
                    </head>
                    <body class="export-charts">
                        <div class="header">
                            <h1>SutrAlgo charts export</h1>
                            <p>Generated on ${exportDate}</p>
                        </div>
                        <div class="actions">
                            <button class="download-all-btn" onclick="window.print()">Print / Save as PDF</button>
                        </div>
                `;
                
                // Define charts to export with their titles
                const chartsToExport = [
                    { id: 'equity-curve-chart', title: 'Equity Curve', section: 'Performance' },
                    { id: 'drawdown-chart', title: 'Drawdown Analysis', section: 'Performance' },
                    { id: 'monthly-performance-chart', title: 'Monthly Performance', section: 'Performance' },
                    { id: 'win-loss-pie-chart', title: 'Win/Loss Breakdown', section: 'Performance' },
                    { id: 'market-comparison-chart', title: 'Performance by Market', section: 'Market Analysis' },
                    { id: 'size-vs-return-chart', title: 'Size vs. Return Analysis', section: 'Market Analysis' },
                    { id: 'pl-distribution-chart', title: 'P&L Distribution', section: 'Patterns & Trends' },
                    { id: 'holding-period-chart', title: 'Holding Period Analysis', section: 'Patterns & Trends' }
                ];
                
                let currentSection = '';
                let exportedCharts = 0;
                
                // Process each chart
                chartsToExport.forEach(chartInfo => {
                    // Add section divider if needed
                    if (chartInfo.section !== currentSection) {
                        htmlContent += `<div class="section-divider">${chartInfo.section}</div>`;
                        currentSection = chartInfo.section;
                    }
                    
                    const dataUrl = getChartDataUrl(chartInfo.id, chartInfo.title);
                    
                    if (dataUrl) {
                        const chartFilename = chartInfo.title.replace(/\s+/g, '_').toLowerCase();
                        htmlContent += `
                            <div class="chart-container">
                                <div class="chart-title">${chartInfo.title}</div>
                                <img src="${dataUrl}" alt="${chartInfo.title}" class="chart-image">
                                <a href="${dataUrl}" download="${chartFilename}_${TradeCore.formatDateForFilename(new Date())}.png" class="download-link">Download this chart</a>
                            </div>
                        `;
                        exportedCharts++;
                    } else {
                    }
                });
                
                // Add Exit Reason Analysis table if available
                const exitReasons = TradeCore.getExitReasonBreakdown();
                if (exitReasons && exitReasons.length > 0) {
                    if (currentSection !== 'Patterns & Trends') {
                        htmlContent += `<div class="section-divider">Patterns & Trends</div>`;
                    }
                    
                    htmlContent += `
                        <div class="chart-container">
                            <div class="chart-title">Exit Reason Analysis</div>
                            <div class="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Exit Reason</th>
                                            <th>Count</th>
                                            <th>% of Trades</th>
                                            <th>Avg P&L</th>
                                            <th>Win Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                    `;
                    
                    exitReasons.forEach(reason => {
                        const reasonClass = getExitTagClassForExport(reason.reason);
                        htmlContent += `
                            <tr>
                                <td><span class="exit-tag ${reasonClass}">${reason.reason}</span></td>
                                <td>${reason.count}</td>
                                <td>${reason.percentage.toFixed(1)}%</td>
                                <td class="${reason.avgPL >= 0 ? 'positive' : 'negative'}">${reason.avgPL.toFixed(2)}%</td>
                                <td>${reason.winRate.toFixed(1)}%</td>
                            </tr>
                        `;
                    });
                    
                    htmlContent += `
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `;
                }
                
                // Close the HTML
                htmlContent += `
                        <div class="footer">
                            <p>SutrAlgo trading analytics</p>
                        </div>
                    </body>
                    </html>
                `;
                
                // Write the HTML to the new window
                exportWindow.document.write(htmlContent);
                exportWindow.document.close();
                
                if (exportedCharts > 0) {
                    TradeCore.showNotification(`Exported ${exportedCharts} charts successfully`, 'success');
                } else {
                    TradeCore.showNotification('No charts were available to export', 'warning');
                }
            } catch (error) {
                TradeCore.showNotification('Error exporting charts: ' + error.message, 'error');
            } finally {
                // Reset button state to the page's own label
                if (exportChartsBtn) {
                    exportChartsBtn.disabled = false;
                    exportChartsBtn.replaceChildren(...originalChildren.map(n => n.cloneNode(true)));
                }
            }
        });
    }
    
    /**
     * Handle export report action
     * Creates a comprehensive trading report with statistics, metrics and charts
     */
    function handleExportReport() {
        // Get the export button to show loading state
        const exportReportBtn = document.getElementById('export-report');

        // Show loading state (keep the page's own label to restore)
        const originalChildren = exportReportBtn ? Array.from(exportReportBtn.childNodes).map(n => n.cloneNode(true)) : [];
        if (exportReportBtn) {
            exportReportBtn.disabled = true;
            exportReportBtn.textContent = 'Generating report…';
        }

        // Ensure all charts are rendered first
        ensureChartsRendered().then(() => {
            try {
                // Create a new window for the report
                const reportWindow = window.open('', '_blank');
                if (!reportWindow) {
                    TradeCore.showNotification('Allow pop-ups for this site to export the report', 'info');
                    return;
                }

                // Get all the trading data we need for the report
                const stats = TradeCore.getTradeStatisticsByCurrency();
                const metrics = TradeCore.getAdvancedMetrics();
                const exportDate = window.DateFormatter ? window.DateFormatter.formatTime(new Date()) : new Date().toLocaleString();
                const timePeriod = 'Everything so far';
                
                // Create HTML content for the export window (styled by /css/export.css)
                let htmlContent = `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>SutrAlgo trading report - ${exportDate}</title>
                        <link rel="stylesheet" href="${window.location.origin}/css/export.css">
                    </head>
                    <body class="export-report">
                        <div class="report-header">
                            <h1 class="report-title">SutrAlgo trading performance report</h1>
                            <p class="report-subtitle">Report Period: ${timePeriod} • Generated on ${exportDate}</p>
                        </div>
                        
                        <div class="actions">
                            <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
                        </div>
                `;
                
                // 1. Trading Performance Summary Section
                htmlContent += `
                    <div class="report-section">
                        <h2 class="section-title">Trading Performance Summary</h2>
                `;
                
                // Add currency-specific statistics
                if (Object.keys(stats.currencies).length > 0) {
                    for (const currencySymbol in stats.currencies) {
                        const currencyStats = stats.currencies[currencySymbol];
                        
                        htmlContent += `
                            <div class="currency-section">
                                <h3 class="currency-title">${currencySymbol} Markets</h3>
                                <div class="stats-grid">
                                    <div class="stat-card">
                                        <div class="stat-title">Active Trades</div>
                                        <div class="stat-value">${currencyStats.totalActive}</div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-title">Total Invested</div>
                                        <div class="stat-value">${currencySymbol}${currencyStats.totalInvested.toFixed(2)}</div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-title">Open P&L</div>
                                        <div class="stat-value ${currencyStats.openPLPercent >= 0 ? 'positive' : 'negative'}">${currencyStats.openPLPercent.toFixed(2)}%</div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-title">Closed Trades</div>
                                        <div class="stat-value">${currencyStats.totalClosed}</div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-title">Win Rate</div>
                                        <div class="stat-value ${currencyStats.winRate >= 50 ? 'positive' : ''}">${currencyStats.winRate.toFixed(2)}%</div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-title">Avg Profit/Trade</div>
                                        <div class="stat-value ${currencyStats.avgProfit > 0 ? 'positive' : (currencyStats.avgProfit < 0 ? 'negative' : '')}">${currencyStats.avgProfit.toFixed(2)}%</div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                } else {
                    // Use overall stats if no currency-specific stats
                    htmlContent += `
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-title">Active Trades</div>
                                <div class="stat-value">${stats.overall.totalActive}</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-title">Total Invested</div>
                                <div class="stat-value">${TradeCore.CURRENCY_SYMBOL}${stats.overall.totalInvested.toFixed(2)}</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-title">Open P&L</div>
                                <div class="stat-value ${stats.overall.openPLPercent >= 0 ? 'positive' : 'negative'}">${stats.overall.openPLPercent.toFixed(2)}%</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-title">Closed Trades</div>
                                <div class="stat-value">${stats.overall.totalClosed}</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-title">Win Rate</div>
                                <div class="stat-value ${stats.overall.winRate >= 50 ? 'positive' : ''}">${stats.overall.winRate.toFixed(2)}%</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-title">Avg Profit/Trade</div>
                                <div class="stat-value ${stats.overall.avgProfit > 0 ? 'positive' : (stats.overall.avgProfit < 0 ? 'negative' : '')}">${stats.overall.avgProfit.toFixed(2)}%</div>
                            </div>
                        </div>
                    `;
                }
                
                htmlContent += `</div>`;
                
                // 2. Advanced Metrics Section
                if (metrics) {
                    const streakInfo = metrics.streakInfo || {
                        currentStreak: { type: 'none', count: 0 },
                        longestWinStreak: 0,
                        longestLossStreak: 0
                    };
                    
                    htmlContent += `
                        <div class="report-section">
                            <h2 class="section-title">Advanced Trading Metrics</h2>
                            <div class="metrics-grid">
                                <div class="metric-card ${metrics.sharpeRatio >= 1 ? 'success' : metrics.sharpeRatio >= 0 ? 'neutral' : 'danger'}">
                                    <div class="metric-title">Sharpe ratio</div>
                                    <div class="metric-value">${metrics.sharpeRatio.toFixed(2)}</div>
                                    <div class="metric-desc">Risk-adjusted return (higher is better)</div>
                                </div>
                                <div class="metric-card ${metrics.maxDrawdown < 10 ? 'success' : metrics.maxDrawdown < 20 ? 'neutral' : 'danger'}">
                                    <div class="metric-title">Max drawdown</div>
                                    <div class="metric-value">${metrics.maxDrawdown.toFixed(2)}%</div>
                                    <div class="metric-desc">Largest drop from peak (${metrics.maxDrawdownDuration} days)</div>
                                </div>
                                <div class="metric-card ${metrics.profitFactor >= 2 ? 'success' : metrics.profitFactor >= 1 ? 'neutral' : 'danger'}">
                                    <div class="metric-title">Profit factor</div>
                                    <div class="metric-value">${metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}</div>
                                    <div class="metric-desc">Gross profit / gross loss</div>
                                </div>
                                <div class="metric-card ${metrics.expectancy > 0 ? 'success' : 'danger'}">
                                    <div class="metric-title">Expectancy</div>
                                    <div class="metric-value">${metrics.expectancy.toFixed(2)}%</div>
                                    <div class="metric-desc">Expected return per trade</div>
                                </div>
                                <div class="metric-card ${metrics.avgTradeDuration < 10 ? 'success' : metrics.avgTradeDuration < 20 ? 'neutral' : 'warning'}">
                                    <div class="metric-title">Average hold time</div>
                                    <div class="metric-value">${metrics.avgTradeDuration.toFixed(1)} days</div>
                                    <div class="metric-desc">Average holding period</div>
                                </div>
                                <div class="metric-card ${metrics.annualizedReturn > 15 ? 'success' : metrics.annualizedReturn > 0 ? 'neutral' : 'danger'}">
                                    <div class="metric-title">Annualised return</div>
                                    <div class="metric-value">${metrics.annualizedReturn.toFixed(2)}%</div>
                                    <div class="metric-desc">The pace of returns stretched over a year</div>
                                </div>
                            </div>

                            <div class="metrics-grid metrics-grid-spaced">
                                <div class="metric-card ${streakInfo.currentStreak.type === 'win' ? 'success' : streakInfo.currentStreak.type === 'loss' ? 'danger' : 'neutral'}">
                                    <div class="metric-title">Current streak</div>
                                    <div class="metric-value">${streakInfo.currentStreak.count === 0 ? 'None yet' : streakInfo.currentStreak.count + (streakInfo.currentStreak.type === 'win' ? (streakInfo.currentStreak.count === 1 ? ' win' : ' wins') : (streakInfo.currentStreak.count === 1 ? ' loss' : ' losses'))}</div>
                                    <div class="metric-desc">Most recent consecutive results</div>
                                </div>
                                <div class="metric-card success">
                                    <div class="metric-title">Longest winning streak</div>
                                    <div class="metric-value">${streakInfo.longestWinStreak}</div>
                                    <div class="metric-desc">Most consecutive winning trades</div>
                                </div>
                                <div class="metric-card danger">
                                    <div class="metric-title">Longest losing streak</div>
                                    <div class="metric-value">${streakInfo.longestLossStreak}</div>
                                    <div class="metric-desc">Most consecutive losing trades</div>
                                </div>
                            </div>
                        </div>
                    `;
                }
                
                // 3. Charts Section - page break before this section
                htmlContent += `<div class="page-break"></div>`;
                
                // 3.1 Performance Charts
                htmlContent += `
                    <div class="report-section">
                        <h2 class="section-title">Performance Charts</h2>
                `;
                
                // Performance charts
                const performanceCharts = [
                    { id: 'equity-curve-chart', title: 'Equity Curve' },
                    { id: 'drawdown-chart', title: 'Drawdown Analysis' },
                    { id: 'monthly-performance-chart', title: 'Monthly Performance' },
                    { id: 'win-loss-pie-chart', title: 'Win/Loss Breakdown' }
                ];
                
                performanceCharts.forEach(chartInfo => {
                    const dataUrl = getChartDataUrl(chartInfo.id, chartInfo.title);
                    if (dataUrl) {
                        htmlContent += `
                            <div class="chart-container">
                                <div class="chart-title">${chartInfo.title}</div>
                                <img src="${dataUrl}" alt="${chartInfo.title}" class="chart-image">
                            </div>
                        `;
                    }
                });
                
                htmlContent += `</div>`;
                
                // 3.2 Market Analysis Charts - page break before this section
                htmlContent += `<div class="page-break"></div>`;
                
                const marketCharts = [
                    { id: 'market-comparison-chart', title: 'Performance by Market' },
                    { id: 'size-vs-return-chart', title: 'Size vs. Return Analysis' }
                ];
                
                let hasMarketCharts = false;
                let marketChartsHtml = '';
                
                marketCharts.forEach(chartInfo => {
                    const dataUrl = getChartDataUrl(chartInfo.id, chartInfo.title);
                    if (dataUrl) {
                        hasMarketCharts = true;
                        marketChartsHtml += `
                            <div class="chart-container">
                                <div class="chart-title">${chartInfo.title}</div>
                                <img src="${dataUrl}" alt="${chartInfo.title}" class="chart-image">
                            </div>
                        `;
                    }
                });
                
                if (hasMarketCharts) {
                    htmlContent += `
                        <div class="report-section">
                            <h2 class="section-title">Market Analysis</h2>
                            ${marketChartsHtml}
                        </div>
                    `;
                }
                
                // 3.3 Patterns & Trends Charts - page break before this section
                htmlContent += `<div class="page-break"></div>`;
                
                const patternsCharts = [
                    { id: 'pl-distribution-chart', title: 'P&L Distribution' },
                    { id: 'holding-period-chart', title: 'Holding Period Analysis' }
                ];
                
                let hasPatternsCharts = false;
                let patternsChartsHtml = '';
                
                patternsCharts.forEach(chartInfo => {
                    const dataUrl = getChartDataUrl(chartInfo.id, chartInfo.title);
                    if (dataUrl) {
                        hasPatternsCharts = true;
                        patternsChartsHtml += `
                            <div class="chart-container">
                                <div class="chart-title">${chartInfo.title}</div>
                                <img src="${dataUrl}" alt="${chartInfo.title}" class="chart-image">
                            </div>
                        `;
                    }
                });
                
                // Exit reason analysis - generate from TradeCore data
                const exitReasons = TradeCore.getExitReasonBreakdown();
                if (exitReasons && exitReasons.length > 0) {
                    hasPatternsCharts = true;
                    patternsChartsHtml += `
                        <div class="chart-container">
                            <div class="chart-title">Exit Reason Analysis</div>
                            <div class="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Exit Reason</th>
                                            <th>Count</th>
                                            <th>% of Trades</th>
                                            <th>Avg P&L</th>
                                            <th>Win Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                    `;
                    
                    exitReasons.forEach(reason => {
                        const reasonClass = getExitTagClassForExport(reason.reason);
                        patternsChartsHtml += `
                            <tr>
                                <td><span class="exit-tag ${reasonClass}">${reason.reason}</span></td>
                                <td>${reason.count}</td>
                                <td>${reason.percentage.toFixed(1)}%</td>
                                <td class="${reason.avgPL >= 0 ? 'positive' : 'negative'}">${reason.avgPL.toFixed(2)}%</td>
                                <td>${reason.winRate.toFixed(1)}%</td>
                            </tr>
                        `;
                    });
                    
                    patternsChartsHtml += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                    `;
                }
                
                if (hasPatternsCharts) {
                    htmlContent += `
                        <div class="report-section">
                            <h2 class="section-title">Patterns & Trends</h2>
                            ${patternsChartsHtml}
                        </div>
                    `;
                }
                
                // 4. Trade Statistics - Trade History Summary - page break before this section
                htmlContent += `<div class="page-break"></div>`;
                
                // Get closed trades data for report
                const closedTrades = TradeCore.getTrades('closed');
                
                if (closedTrades && closedTrades.length > 0) {
                    htmlContent += `
                        <div class="report-section">
                            <h2 class="section-title">Trade History Summary</h2>
                            <div class="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Stock</th>
                                            <th>Entry Date</th>
                                            <th>Exit Date</th>
                                            <th>Holding Days</th>
                                            <th>Investment</th>
                                            <th>P/L (%)</th>
                                            <th>P/L (Value)</th>
                                            <th>Exit Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                    `;
                    
                    // Only show the last 20 trades to keep the report manageable
                    const recentTrades = closedTrades.slice(0, 20);
                    
                    recentTrades.forEach(trade => {
                        // Calculate holding period
                        const holdingDays = Math.floor((trade.exitDate - trade.entryDate) / (1000 * 60 * 60 * 24));
                        
                        // Get exit reason tag class
                        const exitTagClass = getExitTagClassForExport(trade.exitReason);
                        
                        htmlContent += `
                            <tr>
                                <td>${trade.stockName} <span class="symbol-subdued">${trade.symbol}</span></td>
                                <td>${TradeCore.formatDate(trade.entryDate)}</td>
                                <td>${TradeCore.formatDate(trade.exitDate)}</td>
                                <td>${holdingDays} days</td>
                                <td>${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${trade.investmentAmount.toFixed(2)}</td>
                                <td class="${trade.plPercent > 0 ? 'positive' : (trade.plPercent < 0 ? 'negative' : '')}">${trade.plPercent.toFixed(2)}%</td>
                                <td class="${trade.plValue > 0 ? 'positive' : (trade.plValue < 0 ? 'negative' : '')}">${trade.plValue < 0 ? '−' : ''}${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${Math.abs(trade.plValue).toFixed(2)}</td>
                                <td><span class="exit-tag ${exitTagClass}">${trade.exitReason}</span></td>
                            </tr>
                        `;
                    });
                    
                    htmlContent += `
                                </tbody>
                            </table>
                        </div>
                    `;
                    
                    if (closedTrades.length > 20) {
                        htmlContent += `
                            <p class="trade-summary-note">
                                Showing 20 most recent trades out of ${closedTrades.length} total closed trades
                            </p>
                        `;
                    }
                    
                    htmlContent += `</div>`;
                }
                
                // Footer
                htmlContent += `
                        <div class="footer">
                            <p>SutrAlgo trading report • Generated on ${exportDate}</p>
                            <p>Report Period: ${timePeriod}</p>
                        </div>
                    </body>
                    </html>
                `;
                
                // Write the HTML to the new window
                reportWindow.document.write(htmlContent);
                reportWindow.document.close();
                
                TradeCore.showNotification('Trading report generated successfully', 'success');
            } catch (error) {
                TradeCore.showNotification('Error generating report: ' + error.message, 'error');
            } finally {
                // Reset button state to the page's own label
                if (exportReportBtn) {
                    exportReportBtn.disabled = false;
                    exportReportBtn.replaceChildren(...originalChildren.map(n => n.cloneNode(true)));
                }
            }
        });
    }
    
    /**
     * Helper function to get the CSS class for an exit reason tag in exports
     * @param {string} reason - Exit reason
     * @returns {string} - CSS class
     */
    function getExitTagClassForExport(reason) {
        switch(reason) {
            case 'Target Reached':
            case 'Take Profit':
                return 'tp-tag';
            case 'Stop Loss Hit':
            case 'Stop Loss':
                return 'sl-tag';
            case 'Time Exit':
                return 'time-tag';
            default:
                return 'end-tag';
        }
    }

    // Return public API
    return {
        init,
        setupExportButtons,
        handleExportReport,
        handleExportCharts
    };
})();

// Create Metrics module
window.TradeUIModules.metrics = (function() {
    /**
     * Initialize the metrics module
     */
    function init() {
        // No specific initialization needed yet
    }
    
    /**
     * Render advanced metrics cards with proper styling
     */
    function renderAdvancedMetricsCards() {
        const advancedMetricsContainer = document.getElementById('advanced-metrics-container');
        if (!advancedMetricsContainer) {
            return;
        }
        
        try {
            const metrics = TradeCore.getAdvancedMetrics();
            if (!metrics) {
                return;
            }
            
            const streakInfo = metrics.streakInfo || {
                currentStreak: { type: 'none', count: 0 },
                longestWinStreak: 0,
                longestLossStreak: 0
            };
            
            
            // Clear previous content
            advancedMetricsContainer.innerHTML = '';
            
            // Create rows container
            const row1 = document.createElement('div');
            row1.className = 'metrics-row';
            
            // Create first row metrics
            const sharpeCard = createMetricCard(
                'Sharpe ratio',
                metrics.sharpeRatio.toFixed(2),
                'Risk-adjusted return (higher is better)',
                metrics.sharpeRatio >= 1 ? 'success' : metrics.sharpeRatio >= 0 ? 'neutral' : 'danger'
            );
            
            const drawdownCard = createMetricCard(
                'Max drawdown',
                metrics.maxDrawdown.toFixed(2) + '%',
                `Largest drop from peak (${metrics.maxDrawdownDuration} days)`,
                metrics.maxDrawdown < 10 ? 'success' : metrics.maxDrawdown < 20 ? 'neutral' : 'danger'
            );
            
            const profitFactorCard = createMetricCard(
                'Profit factor',
                metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2),
                'Gross profit / gross loss',
                metrics.profitFactor >= 2 ? 'success' : metrics.profitFactor >= 1 ? 'neutral' : 'danger'
            );
            
            // Add cards to first row
            row1.appendChild(sharpeCard);
            row1.appendChild(drawdownCard);
            row1.appendChild(profitFactorCard);
            
            // Create second row
            const row2 = document.createElement('div');
            row2.className = 'metrics-row';
            
            // Create second row metrics
            const expectancyCard = createMetricCard(
                'Expectancy',
                metrics.expectancy.toFixed(2) + '%',
                'Expected return per trade',
                metrics.expectancy > 0 ? 'success' : (metrics.expectancy < 0 ? 'danger' : 'neutral')
            );
            
            const holdTimeCard = createMetricCard(
                'Average hold time',
                metrics.avgTradeDuration.toFixed(1) + ' days',
                'Average holding period',
                metrics.avgTradeDuration < 10 ? 'success' : metrics.avgTradeDuration < 20 ? 'neutral' : 'warning'
            );
            
            const annualReturnCard = createMetricCard(
                'Annualised return',
                metrics.annualizedReturn.toFixed(2) + '%',
                'The pace of returns stretched over a year',
                metrics.annualizedReturn > 15 ? 'success' : metrics.annualizedReturn > 0 ? 'neutral' : 'danger'
            );
            
            // Add cards to second row
            row2.appendChild(expectancyCard);
            row2.appendChild(holdTimeCard);
            row2.appendChild(annualReturnCard);
            
            // Create third row
            const row3 = document.createElement('div');
            row3.className = 'metrics-row';
            
            // Create third row metrics
            const currentStreakCard = createMetricCard(
                'Current streak',
                `${streakInfo.currentStreak.count === 0 ? 'None yet' : streakInfo.currentStreak.count + (streakInfo.currentStreak.type === 'win' ? (streakInfo.currentStreak.count === 1 ? ' win' : ' wins') : (streakInfo.currentStreak.count === 1 ? ' loss' : ' losses'))}`,
                'Most recent consecutive results',
                streakInfo.currentStreak.type === 'win' ? 'success' : streakInfo.currentStreak.type === 'loss' ? 'danger' : 'neutral'
            );
            
            const winStreakCard = createMetricCard(
                'Longest winning streak',
                streakInfo.longestWinStreak.toString(),
                'Most consecutive winning trades',
                'success'
            );
            
            const lossStreakCard = createMetricCard(
                'Longest losing streak',
                streakInfo.longestLossStreak.toString(),
                'Most consecutive losing trades',
                'danger'
            );
            
            // Add cards to third row
            row3.appendChild(currentStreakCard);
            row3.appendChild(winStreakCard);
            row3.appendChild(lossStreakCard);
            
            // Add all rows to container
            advancedMetricsContainer.appendChild(row1);
            advancedMetricsContainer.appendChild(row2);
            advancedMetricsContainer.appendChild(row3);
            
        } catch (error) {
            advancedMetricsContainer.innerHTML = `<div class="error-message">Error loading metrics: ${error.message}</div>`;
        }
    }
    
    /**
     * Helper function to create a metric card element
     */
    function createMetricCard(title, value, description, cardClass) {
        const card = document.createElement('div');
        card.className = `metric-card ${cardClass || ''}`;
        
        const titleEl = document.createElement('div');
        titleEl.className = 'metric-title';
        titleEl.textContent = title;
        
        const valueEl = document.createElement('div');
        valueEl.className = 'metric-value';
        valueEl.textContent = value;
        
        const descEl = document.createElement('div');
        descEl.className = 'metric-desc';
        descEl.textContent = description;
        
        card.appendChild(titleEl);
        card.appendChild(valueEl);
        card.appendChild(descEl);
        
        return card;
    }
    
    /**
     * Render exit reason analysis
     */
    function renderExitReasonAnalysis() {
        const container = document.getElementById('exit-reason-container');
        if (!container) return;
        
        const exitReasons = TradeCore.getExitReasonBreakdown();
        
        if (exitReasons.length === 0) {
            container.innerHTML = '<div class="no-data-message">No closed trades available for exit reason analysis</div>';
            return;
        }
        
        // Create a table for exit reason analysis
        container.innerHTML = `
            <table class="exit-reason-table">
                <thead>
                    <tr>
                        <th>Exit Reason</th>
                        <th>Count</th>
                        <th>% of Trades</th>
                        <th>Avg P&L</th>
                        <th>Win Rate</th>
                    </tr>
                </thead>
                <tbody>
                    ${exitReasons.map(reason => `
                        <tr>
                            <td>
                                <span class="exit-tag ${getExitTagClass(reason.reason)}">${reason.reason}</span>
                            </td>
                            <td>${reason.count}</td>
                            <td>${reason.percentage.toFixed(1)}%</td>
                            <td class="${reason.avgPL >= 0 ? 'positive' : 'negative'}">${reason.avgPL.toFixed(2)}%</td>
                            <td>${reason.winRate.toFixed(1)}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
    
    /**
     * Get the CSS class for an exit reason tag
     * @param {string} reason - Exit reason
     * @returns {string} - CSS class
     */
    function getExitTagClass(reason) {
        switch(reason) {
            case 'Target Reached':
            case 'Take Profit':
                return 'tp-tag';
            case 'Stop Loss Hit':
            case 'Stop Loss':
                return 'sl-tag';
            case 'Time Exit':
                return 'time-tag';
            default:
                return 'end-tag';
        }
    }

    // Return public API
    return {
        init,
        renderAdvancedMetricsCards,
        renderExitReasonAnalysis
    };
})();