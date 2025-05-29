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
        console.log("TradeUI Export module initializing...");
        
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
                
                // Show loading state
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
                    Generating CSV...
                `;
                
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
                            link.style.visibility = 'hidden';
                            
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            
                            TradeCore.showNotification(`Exported ${closedTrades.length} trade records successfully`, 'success');
                        }
                    } catch (error) {
                        console.error("Error exporting trade history:", error);
                        TradeCore.showNotification('Error exporting trade history: ' + error.message, 'error');
                    } finally {
                        // Reset button state
                        this.disabled = false;
                        this.innerHTML = `
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Export Trade History
                        `;
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
        
        // Show loading state
        if (exportBtn) {
            exportBtn.disabled = true;
            exportBtn.innerHTML = `
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
                Exporting...
            `;
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
                    link.style.visibility = 'hidden';
                    
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    
                    TradeCore.showNotification(`Exported ${allTrades.length} trades (${activeTrades} active, ${closedTrades} closed)`, 'success');
                }
            } catch (error) {
                console.error("Error exporting all trades:", error);
                TradeCore.showNotification('Error exporting trades: ' + error.message, 'error');
            } finally {
                // Reset button state
                if (exportBtn) {
                    exportBtn.disabled = false;
                    exportBtn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Export All Trades
                    `;
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
            console.warn(`Canvas with ID ${canvasId} not found`);
            return null;
        }
        
        // Get Chart.js instance from the canvas
        const chart = Chart.getChart(canvas);
        if (!chart) {
            console.warn(`Chart instance not found for canvas ${canvasId}`);
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
                console.warn(`Failed to get chart instance for ${chartTitle}`);
                return null;
            }
            
            // Ensure the chart is fully rendered
            chart.update('none'); // Update without animation
            
            // Get the canvas element
            const canvas = chart.canvas;
            if (!canvas) {
                console.warn(`Canvas not found for ${chartTitle}`);
                return null;
            }
            
            // Convert to data URL
            return canvas.toDataURL('image/png', 1.0); // High quality
        } catch (error) {
            console.error(`Error getting data URL for ${chartTitle}:`, error);
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
            
            let currentTabIndex = 0;
            
            function switchToNextTab() {
                if (currentTabIndex >= analyticsTabs.length) {
                    // All tabs processed, switch back to the originally active tab
                    const activeTab = document.querySelector('.analytics-tab.active');
                    if (activeTab) {
                        activeTab.click();
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
        
        // Show loading state
        if (exportChartsBtn) {
            exportChartsBtn.disabled = true;
            exportChartsBtn.innerHTML = `
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
                Preparing Charts...
            `;
        }
        
        // Ensure all charts are rendered first
        ensureChartsRendered().then(() => {
            try {
                // Create a new window for chart display
                const exportWindow = window.open('', '_blank');
                
                // Create HTML content for the export window
                const exportDate = new Date().toLocaleString();
                let htmlContent = `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Trading Analytics - ${exportDate}</title>
                        <style>
                            body {
                                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                                margin: 0;
                                padding: 20px;
                                background-color: #f9fafb;
                                color: #111827;
                            }
                            .header {
                                text-align: center;
                                margin-bottom: 30px;
                                padding-bottom: 20px;
                                border-bottom: 1px solid #e5e7eb;
                            }
                            .chart-container {
                                background-color: #fff;
                                border-radius: 8px;
                                box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
                                margin-bottom: 30px;
                                padding: 20px;
                                page-break-inside: avoid;
                            }
                            .chart-title {
                                font-size: 18px;
                                font-weight: 600;
                                margin-bottom: 15px;
                                color: #1f2937;
                            }
                            .chart-image {
                                width: 100%;
                                max-width: 800px;
                                margin: 0 auto;
                                display: block;
                            }
                            .actions {
                                text-align: center;
                                margin: 30px 0;
                            }
                            .download-all-btn {
                                background-color: #2563eb;
                                color: white;
                                border: none;
                                border-radius: 6px;
                                padding: 10px 20px;
                                font-size: 16px;
                                cursor: pointer;
                                transition: background-color 0.2s;
                            }
                            .download-all-btn:hover {
                                background-color: #1d4ed8;
                            }
                            .download-link {
                                display: inline-block;
                                margin-top: 15px;
                                color: #2563eb;
                                text-decoration: none;
                            }
                            .download-link:hover {
                                text-decoration: underline;
                            }
                            .footer {
                                text-align: center;
                                margin-top: 30px;
                                padding-top: 20px;
                                border-top: 1px solid #e5e7eb;
                                color: #6b7280;
                                font-size: 14px;
                            }
                            .section-divider {
                                margin: 40px 0 20px 0;
                                text-align: center;
                                font-size: 20px;
                                font-weight: 600;
                                color: #374151;
                                border-bottom: 2px solid #e5e7eb;
                                padding-bottom: 10px;
                            }
                            .table-container {
                                overflow-x: auto;
                                border-radius: 8px;
                                border: 1px solid #e5e7eb;
                            }
                            table {
                                width: 100%;
                                border-collapse: collapse;
                                font-size: 14px;
                                background-color: white;
                            }
                            th, td {
                                padding: 12px 15px;
                                text-align: left;
                                border-bottom: 1px solid #e5e7eb;
                            }
                            th {
                                background-color: #f3f4f6;
                                font-weight: 600;
                                color: #374151;
                            }
                            .exit-tag {
                                display: inline-block;
                                padding: 4px 8px;
                                border-radius: 4px;
                                font-size: 12px;
                                font-weight: 500;
                            }
                            .tp-tag {
                                background-color: rgba(16, 185, 129, 0.1);
                                color: #10b981;
                            }
                            .sl-tag {
                                background-color: rgba(239, 68, 68, 0.1);
                                color: #ef4444;
                            }
                            .time-tag {
                                background-color: rgba(245, 158, 11, 0.1);
                                color: #f59e0b;
                            }
                            .end-tag {
                                background-color: rgba(107, 114, 128, 0.1);
                                color: #6b7280;
                            }
                            @media print {
                                .actions, .download-link {
                                    display: none;
                                }
                                body {
                                    background-color: white;
                                }
                                .chart-container {
                                    box-shadow: none;
                                    border: 1px solid #e5e7eb;
                                }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h1>Trading Analytics Export</h1>
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
                        console.warn(`Failed to export chart: ${chartInfo.title}`);
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
                                <td style="color: ${reason.avgPL >= 0 ? '#10b981' : '#ef4444'}">${reason.avgPL.toFixed(2)}%</td>
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
                            <p>DTI Backtester Trading Analytics</p>
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
                console.error("Error exporting charts:", error);
                TradeCore.showNotification('Error exporting charts: ' + error.message, 'error');
            } finally {
                // Reset button state
                if (exportChartsBtn) {
                    exportChartsBtn.disabled = false;
                    exportChartsBtn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                        Export Charts
                    `;
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
        
        // Show loading state
        if (exportReportBtn) {
            exportReportBtn.disabled = true;
            exportReportBtn.innerHTML = `
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
                Generating Report...
            `;
        }
        
        // Ensure all charts are rendered first
        ensureChartsRendered().then(() => {
            try {
                // Create a new window for the report
                const reportWindow = window.open('', '_blank');
                
                // Get all the trading data we need for the report
                const stats = TradeCore.getTradeStatisticsByCurrency();
                const metrics = TradeCore.getAdvancedMetrics();
                const exportDate = new Date().toLocaleString();
                const timeFilter = document.getElementById('analytics-time-filter');
                const timePeriod = timeFilter ? timeFilter.options[timeFilter.selectedIndex].text : 'All Time';
                
                // Create HTML content for the export window with inline styles
                let htmlContent = `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>DTI Trading Report - ${exportDate}</title>
                        <style>
                            body {
                                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                                margin: 0;
                                padding: 20px;
                                background-color: #f9fafb;
                                color: #111827;
                                line-height: 1.5;
                            }
                            .report-header {
                                text-align: center;
                                margin-bottom: 30px;
                                padding-bottom: 20px;
                                border-bottom: 1px solid #e5e7eb;
                            }
                            .report-title {
                                font-size: 28px;
                                font-weight: 700;
                                margin-bottom: 5px;
                                color: #1f2937;
                            }
                            .report-subtitle {
                                font-size: 16px;
                                color: #6b7280;
                            }
                            .report-section {
                                background-color: #fff;
                                border-radius: 8px;
                                box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
                                margin-bottom: 30px;
                                padding: 25px;
                                page-break-inside: avoid;
                            }
                            .section-title {
                                font-size: 20px;
                                font-weight: 600;
                                margin-top: 0;
                                margin-bottom: 20px;
                                color: #1f2937;
                                border-bottom: 1px solid #e5e7eb;
                                padding-bottom: 10px;
                            }
                            .stats-grid {
                                display: grid;
                                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                                gap: 20px;
                                margin-bottom: 20px;
                            }
                            .stat-card {
                                border-radius: 6px;
                                border: 1px solid #e5e7eb;
                                padding: 15px;
                                background-color: #f9fafb;
                            }
                            .stat-title {
                                font-size: 14px;
                                color: #6b7280;
                                margin-bottom: 5px;
                            }
                            .stat-value {
                                font-size: 24px;
                                font-weight: 600;
                                color: #1f2937;
                            }
                            .positive {
                                color: #10b981;
                            }
                            .negative {
                                color: #ef4444;
                            }
                            .metrics-grid {
                                display: grid;
                                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                                gap: 20px;
                            }
                            .metric-card {
                                border-radius: 6px;
                                border: 1px solid #e5e7eb;
                                padding: 15px;
                                background-color: #f9fafb;
                            }
                            .metric-card.success {
                                border-left: 4px solid #10b981;
                            }
                            .metric-card.danger {
                                border-left: 4px solid #ef4444;
                            }
                            .metric-card.warning {
                                border-left: 4px solid #f59e0b;
                            }
                            .metric-card.neutral {
                                border-left: 4px solid #6b7280;
                            }
                            .metric-title {
                                font-size: 14px;
                                color: #6b7280;
                                margin-bottom: 5px;
                            }
                            .metric-value {
                                font-size: 20px;
                                font-weight: 600;
                                color: #1f2937;
                            }
                            .metric-desc {
                                font-size: 12px;
                                color: #6b7280;
                                margin-top: 5px;
                            }
                            .chart-container {
                                margin-top: 25px;
                                margin-bottom: 25px;
                            }
                            .chart-title {
                                font-size: 16px;
                                font-weight: 600;
                                margin-bottom: 15px;
                                color: #4b5563;
                            }
                            .chart-image {
                                width: 100%;
                                max-width: 800px;
                                margin: 0 auto;
                                display: block;
                                border: 1px solid #e5e7eb;
                                border-radius: 4px;
                            }
                            .actions {
                                text-align: center;
                                margin: 30px 0;
                            }
                            .print-btn {
                                background-color: #2563eb;
                                color: white;
                                border: none;
                                border-radius: 6px;
                                padding: 10px 20px;
                                font-size: 16px;
                                cursor: pointer;
                                transition: background-color 0.2s;
                            }
                            .print-btn:hover {
                                background-color: #1d4ed8;
                            }
                            .footer {
                                text-align: center;
                                margin-top: 30px;
                                padding-top: 20px;
                                border-top: 1px solid #e5e7eb;
                                color: #6b7280;
                                font-size: 14px;
                            }
                            .table-container {
                                overflow-x: auto;
                                margin-top: 20px;
                            }
                            table {
                                width: 100%;
                                border-collapse: collapse;
                                font-size: 14px;
                            }
                            th {
                                background-color: #f3f4f6;
                                text-align: left;
                                padding: 10px;
                                font-weight: 600;
                                color: #4b5563;
                                border-bottom: 1px solid #e5e7eb;
                            }
                            td {
                                padding: 10px;
                                border-bottom: 1px solid #e5e7eb;
                            }
                            .currency-section {
                                margin-bottom: 20px;
                                border-bottom: 1px solid #e5e7eb;
                                padding-bottom: 20px;
                            }
                            .currency-section:last-child {
                                border-bottom: none;
                                margin-bottom: 0;
                                padding-bottom: 0;
                            }
                            .currency-title {
                                font-size: 18px;
                                font-weight: 600;
                                margin-bottom: 15px;
                                color: #1f2937;
                            }
                            .exit-tag {
                                display: inline-block;
                                padding: 4px 8px;
                                border-radius: 4px;
                                font-size: 12px;
                                font-weight: 500;
                            }
                            .tp-tag {
                                background-color: rgba(16, 185, 129, 0.1);
                                color: #10b981;
                            }
                            .sl-tag {
                                background-color: rgba(239, 68, 68, 0.1);
                                color: #ef4444;
                            }
                            .time-tag {
                                background-color: rgba(245, 158, 11, 0.1);
                                color: #f59e0b;
                            }
                            .end-tag {
                                background-color: rgba(107, 114, 128, 0.1);
                                color: #6b7280;
                            }
                            @media print {
                                .actions {
                                    display: none;
                                }
                                body {
                                    background-color: white;
                                }
                                .report-section {
                                    box-shadow: none;
                                    border: 1px solid #e5e7eb;
                                    break-inside: avoid;
                                }
                                .page-break {
                                    page-break-before: always;
                                }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="report-header">
                            <h1 class="report-title">DTI Trading Performance Report</h1>
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
                                        <div class="stat-value ${currencyStats.avgProfit > 0 ? 'positive' : 'negative'}">${currencyStats.avgProfit.toFixed(2)}%</div>
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
                                <div class="stat-value ${stats.overall.avgProfit > 0 ? 'positive' : 'negative'}">${stats.overall.avgProfit.toFixed(2)}%</div>
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
                                    <div class="metric-title">Sharpe Ratio</div>
                                    <div class="metric-value">${metrics.sharpeRatio.toFixed(2)}</div>
                                    <div class="metric-desc">Risk-adjusted return (higher is better)</div>
                                </div>
                                <div class="metric-card ${metrics.maxDrawdown < 10 ? 'success' : metrics.maxDrawdown < 20 ? 'neutral' : 'danger'}">
                                    <div class="metric-title">Max Drawdown</div>
                                    <div class="metric-value">${metrics.maxDrawdown.toFixed(2)}%</div>
                                    <div class="metric-desc">Largest drop from peak (${metrics.maxDrawdownDuration} days)</div>
                                </div>
                                <div class="metric-card ${metrics.profitFactor >= 2 ? 'success' : metrics.profitFactor >= 1 ? 'neutral' : 'danger'}">
                                    <div class="metric-title">Profit Factor</div>
                                    <div class="metric-value">${metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}</div>
                                    <div class="metric-desc">Gross profit / gross loss</div>
                                </div>
                                <div class="metric-card ${metrics.expectancy > 0 ? 'success' : 'danger'}">
                                    <div class="metric-title">Expectancy</div>
                                    <div class="metric-value">${metrics.expectancy.toFixed(2)}%</div>
                                    <div class="metric-desc">Expected return per trade</div>
                                </div>
                                <div class="metric-card ${metrics.avgTradeDuration < 10 ? 'success' : metrics.avgTradeDuration < 20 ? 'neutral' : 'warning'}">
                                    <div class="metric-title">Avg Hold Time</div>
                                    <div class="metric-value">${metrics.avgTradeDuration.toFixed(1)} days</div>
                                    <div class="metric-desc">Average holding period</div>
                                </div>
                                <div class="metric-card ${metrics.annualizedReturn > 15 ? 'success' : metrics.annualizedReturn > 0 ? 'neutral' : 'danger'}">
                                    <div class="metric-title">Annualized Return</div>
                                    <div class="metric-value">${metrics.annualizedReturn.toFixed(2)}%</div>
                                    <div class="metric-desc">Return normalized to yearly basis</div>
                                </div>
                            </div>
                            
                            <div class="metrics-grid" style="margin-top: 20px;">
                                <div class="metric-card ${streakInfo.currentStreak.type === 'win' ? 'success' : streakInfo.currentStreak.type === 'loss' ? 'danger' : 'neutral'}">
                                    <div class="metric-title">Current Streak</div>
                                    <div class="metric-value">${streakInfo.currentStreak.count} ${streakInfo.currentStreak.type === 'win' ? 'Wins' : 'Losses'}</div>
                                    <div class="metric-desc">Most recent consecutive results</div>
                                </div>
                                <div class="metric-card success">
                                    <div class="metric-title">Longest Win Streak</div>
                                    <div class="metric-value">${streakInfo.longestWinStreak}</div>
                                    <div class="metric-desc">Most consecutive winning trades</div>
                                </div>
                                <div class="metric-card danger">
                                    <div class="metric-title">Longest Loss Streak</div>
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
                                <td>${trade.stockName} <span style="font-size: 12px; color: #6b7280;">${trade.symbol}</span></td>
                                <td>${TradeCore.formatDate(trade.entryDate)}</td>
                                <td>${TradeCore.formatDate(trade.exitDate)}</td>
                                <td>${holdingDays} days</td>
                                <td>${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${trade.investmentAmount.toFixed(2)}</td>
                                <td class="${trade.plPercent > 0 ? 'positive' : 'negative'}">${trade.plPercent.toFixed(2)}%</td>
                                <td class="${trade.plValue > 0 ? 'positive' : 'negative'}">${trade.currencySymbol || TradeCore.CURRENCY_SYMBOL}${trade.plValue.toFixed(2)}</td>
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
                            <p style="text-align: center; font-style: italic; color: #6b7280; margin-top: 15px;">
                                Showing 20 most recent trades out of ${closedTrades.length} total closed trades
                            </p>
                        `;
                    }
                    
                    htmlContent += `</div>`;
                }
                
                // Footer
                htmlContent += `
                        <div class="footer">
                            <p>DTI Backtester Trading Analytics Report • Generated on ${exportDate}</p>
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
                console.error("Error generating report:", error);
                TradeCore.showNotification('Error generating report: ' + error.message, 'error');
            } finally {
                // Reset button state
                if (exportReportBtn) {
                    exportReportBtn.disabled = false;
                    exportReportBtn.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                        Export Report
                    `;
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
    // Private variables
    let calendarHeatmap = null;
    
    /**
     * Initialize the metrics module
     */
    function init() {
        console.log("TradeUI Metrics module initializing...");
        // No specific initialization needed yet
    }
    
    /**
     * Render advanced metrics cards with proper styling
     */
    function renderAdvancedMetricsCards() {
        const advancedMetricsContainer = document.getElementById('advanced-metrics-container');
        if (!advancedMetricsContainer) {
            console.error("Advanced metrics container not found");
            return;
        }
        
        try {
            const metrics = TradeCore.getAdvancedMetrics();
            if (!metrics) {
                console.error("Failed to get advanced metrics data");
                return;
            }
            
            const streakInfo = metrics.streakInfo || {
                currentStreak: { type: 'none', count: 0 },
                longestWinStreak: 0,
                longestLossStreak: 0
            };
            
            console.log("Rendering advanced metrics with data:", metrics);
            
            // Clear previous content
            advancedMetricsContainer.innerHTML = '';
            
            // Create rows container
            const row1 = document.createElement('div');
            row1.className = 'metrics-row';
            
            // Create first row metrics
            const sharpeCard = createMetricCard(
                'Sharpe Ratio',
                metrics.sharpeRatio.toFixed(2),
                'Risk-adjusted return (higher is better)',
                metrics.sharpeRatio >= 1 ? 'success' : metrics.sharpeRatio >= 0 ? 'neutral' : 'danger'
            );
            
            const drawdownCard = createMetricCard(
                'Max Drawdown',
                metrics.maxDrawdown.toFixed(2) + '%',
                `Largest drop from peak (${metrics.maxDrawdownDuration} days)`,
                metrics.maxDrawdown < 10 ? 'success' : metrics.maxDrawdown < 20 ? 'neutral' : 'danger'
            );
            
            const profitFactorCard = createMetricCard(
                'Profit Factor',
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
                metrics.expectancy > 0 ? 'success' : 'danger'
            );
            
            const holdTimeCard = createMetricCard(
                'Avg Hold Time',
                metrics.avgTradeDuration.toFixed(1) + ' days',
                'Average holding period',
                metrics.avgTradeDuration < 10 ? 'success' : metrics.avgTradeDuration < 20 ? 'neutral' : 'warning'
            );
            
            const annualReturnCard = createMetricCard(
                'Annualized Return',
                metrics.annualizedReturn.toFixed(2) + '%',
                'Return normalized to yearly basis',
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
                'Current Streak',
                `${streakInfo.currentStreak.count} ${streakInfo.currentStreak.type === 'win' ? 'Wins' : 'Losses'}`,
                'Most recent consecutive results',
                streakInfo.currentStreak.type === 'win' ? 'success' : streakInfo.currentStreak.type === 'loss' ? 'danger' : 'neutral'
            );
            
            const winStreakCard = createMetricCard(
                'Longest Win Streak',
                streakInfo.longestWinStreak.toString(),
                'Most consecutive winning trades',
                'success'
            );
            
            const lossStreakCard = createMetricCard(
                'Longest Loss Streak',
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
            
            console.log("Advanced metrics rendering complete");
        } catch (error) {
            console.error("Error rendering advanced metrics:", error);
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
     * Initialize calendar heatmap for daily performance
     */
    function initializeCalendarHeatmap() {
        const container = document.getElementById('calendar-heatmap');
        if (!container) return;
        
        // Get current year
        const currentYear = new Date().getFullYear();
        
        // Create year selector
        const yearSelector = document.createElement('div');
        yearSelector.className = 'calendar-year-selector';
        yearSelector.innerHTML = `
            <button class="year-nav prev-year">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
            </button>
            <span class="current-year">${currentYear}</span>
            <button class="year-nav next-year">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </button>
        `;
        
        container.appendChild(yearSelector);
        
        // Create heatmap container
        const heatmapContainer = document.createElement('div');
        heatmapContainer.className = 'heatmap-container';
        container.appendChild(heatmapContainer);
        

        
        // Render initial heatmap
        renderCalendarHeatmap(currentYear);
        
        // Add event listeners for year navigation
        const prevYearBtn = container.querySelector('.prev-year');
        const nextYearBtn = container.querySelector('.next-year');
        const yearDisplay = container.querySelector('.current-year');
        
        prevYearBtn.addEventListener('click', function() {
            const currentYearValue = parseInt(yearDisplay.textContent);
            const newYear = currentYearValue - 1;
            yearDisplay.textContent = newYear;
            renderCalendarHeatmap(newYear);
        });
        
        nextYearBtn.addEventListener('click', function() {
            const currentYearValue = parseInt(yearDisplay.textContent);
            const newYear = currentYearValue + 1;
            if (newYear <= new Date().getFullYear()) {
                yearDisplay.textContent = newYear;
                renderCalendarHeatmap(newYear);
            }
        });
    }
    
    /**
     * Render calendar heatmap for a specific year
     * @param {number} year - Year to display
     */
function renderCalendarHeatmap(year) {
    const container = document.querySelector('.heatmap-container');
    if (!container) return;
    
    // Get heatmap data for the year
    const heatmapData = TradeCore.getCalendarHeatmapData(year);
    
    // Clear existing content
    container.innerHTML = '';
    
    // Check if we have enough data
    if (heatmapData.length === 0) {
        container.innerHTML = '<div class="no-data-message">No trade data available for this year</div>';
        return;
    }
    
    // Group data by month
    const monthsData = {};
    for (let month = 0; month < 12; month++) {
        monthsData[month] = [];
    }
    
    heatmapData.forEach(day => {
        const date = new Date(day.dateObj);
        const month = date.getMonth();
        monthsData[month].push(day);
    });
    
    // Get month names
    const monthNames = Array.from({length: 12}, (_, i) => 
        new Date(year, i, 1).toLocaleString('default', { month: 'short' }));
    
    // Weekday short names
    const weekdayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    
    // Create month columns
    monthNames.forEach((monthName, monthIndex) => {
        const monthColumn = document.createElement('div');
        monthColumn.className = 'month-column';
        
        // Month header
        const monthHeader = document.createElement('div');
        monthHeader.className = 'month-header';
        monthHeader.textContent = monthName;
        monthColumn.appendChild(monthHeader);
        
        // Create container for days
        const monthDays = document.createElement('div');
        monthDays.className = 'month-days';
        
        // Add weekday headers
        weekdayNames.forEach(name => {
            const weekdayHeader = document.createElement('div');
            weekdayHeader.className = 'weekday-header';
            weekdayHeader.textContent = name;
            monthDays.appendChild(weekdayHeader);
        });
        
        // Get first day of month and days in month
        const firstDay = new Date(year, monthIndex, 1).getDay();
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        
        // Add empty cells for days before the first day of month
        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'day-cell empty';
            monthDays.appendChild(emptyCell);
        }
        
        // Monthly stats
        let monthlyTradeCount = 0;
        let monthlyProfitLoss = 0;
        
        // Create day cells
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, monthIndex, day);
            const dateString = date.toISOString().split('T')[0];
            
            const dayCell = document.createElement('div');
            dayCell.className = 'day-cell';
            
            // Add day number
            const dayNumber = document.createElement('div');
            dayNumber.className = 'day-number';
            dayNumber.textContent = day;
            dayCell.appendChild(dayNumber);
            
            // Find data for this day
            const dayData = heatmapData.find(d => d.date === dateString);
            
            if (dayData && dayData.trades > 0) {
                // Add to monthly stats
                monthlyTradeCount += dayData.trades || 0;
                monthlyProfitLoss += dayData.value || 0;  // Use percentage value, not totalValue
                
                // Calculate color based on value
                const value = Number(dayData.value) || 0;
                
                if (value > 0) {
                    // Profit day
                    dayCell.classList.add('profit');
                    if (value > 5) dayCell.classList.add('high'); // High profit
                } else if (value < 0) {
                    // Loss day
                    dayCell.classList.add('loss');
                    if (value < -5) dayCell.classList.add('high'); // High loss
                } else {
                    // Zero
                    dayCell.classList.add('neutral');
                }
                
                // Add tooltip data
                dayCell.setAttribute('data-date', date.toLocaleDateString());
                dayCell.setAttribute('data-trades', dayData.trades || 0);
                dayCell.setAttribute('data-value', value.toFixed(2) + '%');
                
                // Add tooltip event listeners
                dayCell.addEventListener('mouseover', showTooltip);
                dayCell.addEventListener('mouseout', hideTooltip);
            } else {
                // No trades this day
                dayCell.classList.add('empty');
            }
            
            monthDays.appendChild(dayCell);
        }
        
        // Add month days to column
        monthColumn.appendChild(monthDays);
        
        // Add month summary if there were trades
        if (monthlyTradeCount > 0) {
            const monthSummary = document.createElement('div');
            monthSummary.className = 'month-summary';
            
            const profitLossClass = monthlyProfitLoss >= 0 ? 'positive' : 'negative';
            const profitLossPrefix = monthlyProfitLoss >= 0 ? '+' : '';
            
            monthSummary.innerHTML = `
                <span>Trades: <span class="total">${monthlyTradeCount}</span></span>
                <span>P/L: <span class="total ${profitLossClass}">${profitLossPrefix}${monthlyProfitLoss.toFixed(1)}%</span></span>
            `;
            
            monthColumn.appendChild(monthSummary);
        }
        
        container.appendChild(monthColumn);
    });
}
    
    /**
     * Show tooltip for calendar heatmap cell
     * @param {Event} e - Mouse event
     */
function showTooltip(e) {
    const cell = e.target;
    const date = cell.getAttribute('data-date');
    const trades = cell.getAttribute('data-trades');
    const value = cell.getAttribute('data-value');
    
    if (!date || !trades || !value) return;
    
    // Create tooltip
    let tooltip = document.getElementById('heatmap-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'heatmap-tooltip';
        document.body.appendChild(tooltip);
    }
    
    // Determine if profit or loss
    const valueNum = parseFloat(value);
    const valueClass = valueNum >= 0 ? 'positive' : 'negative';
    
    // Set content
    tooltip.innerHTML = `
        <div class="tooltip-date">${date}</div>
        <div class="tooltip-trades">
            <span class="tooltip-label">Trades:</span>
            <span class="tooltip-data">${trades}</span>
        </div>
        <div class="tooltip-value">
            <span class="tooltip-label">P&L:</span>
            <span class="tooltip-data ${valueClass}">${value}</span>
        </div>
    `;
    
    // Position tooltip - position above the cell for better visibility
    const rect = cell.getBoundingClientRect();
    tooltip.style.top = `${rect.top - tooltip.offsetHeight - 5 + window.scrollY}px`;
    tooltip.style.left = `${rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + window.scrollX}px`;
    
    // Show tooltip
    tooltip.style.display = 'block';
}
    
    /**
     * Hide tooltip for calendar heatmap cell
     */
    function hideTooltip() {
        const tooltip = document.getElementById('heatmap-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
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
        initializeCalendarHeatmap,
        renderExitReasonAnalysis
    };
})();