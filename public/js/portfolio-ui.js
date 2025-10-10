/**
 * Portfolio UI Controller
 * Handles all user interactions, table rendering, and UI updates
 */

const PortfolioUI = (function() {
    'use strict';

    let currentResults = null; // Store simulation results

    /**
     * Initialize UI
     */
    function init() {
        console.log('[Portfolio UI] Initializing...');

        // Set default date (1 year ago)
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        document.getElementById('simulation-start-date').value = oneYearAgo.toISOString().split('T')[0];

        // Event listeners
        document.getElementById('run-simulation-btn').addEventListener('click', runSimulation);
        document.getElementById('export-csv-btn').addEventListener('click', exportToCSV);

        // Filter listeners
        document.getElementById('market-filter').addEventListener('change', applyFilters);
        document.getElementById('outcome-filter').addEventListener('change', applyFilters);

        // Analytics tab switching
        const analyticsTabs = document.querySelectorAll('.analytics-tab');
        analyticsTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                switchAnalyticsTab(this.dataset.tab);
            });
        });

        console.log('[Portfolio UI] Initialized');
    }

    /**
     * Run simulation
     */
    async function runSimulation() {
        const startDate = document.getElementById('simulation-start-date').value;
        const currency = document.getElementById('display-currency').value;

        if (!startDate) {
            showNotification('Please select a start date', 'error');
            return;
        }

        const btn = document.getElementById('run-simulation-btn');
        const statusDiv = document.getElementById('simulation-status');

        try {
            // Disable button and show loading
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Running Simulation...';
            statusDiv.style.display = 'block';
            statusDiv.className = 'simulation-status info';

            // Progress callback to update UI
            const updateProgress = (progress) => {
                let message = progress.message || 'Processing...';
                let html = `<div class="progress-message">${message}</div>`;

                // Add progress bar if percentage is available
                if (progress.percent !== undefined) {
                    html += `
                        <div class="progress-info">
                            <span>${progress.current || 0} / ${progress.total || 0}</span>
                            <span>${progress.percent}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress.percent}%"></div>
                        </div>
                    `;
                }

                statusDiv.innerHTML = html;
            };

            // Run simulation with progress updates
            const result = await window.PortfolioSimulator.runSimulation(
                startDate,
                currency,
                updateProgress  // Pass progress callback
            );

            if (!result.success) {
                throw new Error(result.error || 'Simulation failed');
            }

            // Store results
            currentResults = result;

            // Calculate analytics
            const analytics = window.PortfolioAnalytics.calculateMetrics(
                result.portfolio,
                result.config
            );

            // Update UI
            statusDiv.innerHTML = '✅ Simulation completed successfully!';
            statusDiv.className = 'simulation-status success';

            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 3000);

            // Display results
            displayResults(result, analytics, currency);

        } catch (error) {
            console.error('[Portfolio UI] Simulation error:', error);
            statusDiv.innerHTML = `❌ Simulation failed: ${error.message}`;
            statusDiv.className = 'simulation-status error';
            showNotification('Simulation failed: ' + error.message, 'error');
        } finally {
            // Re-enable button
            btn.disabled = false;
            btn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Run Simulation
            `;
        }
    }

    /**
     * Display simulation results
     */
    function displayResults(result, analytics, currency) {
        // Show all result sections
        document.getElementById('portfolio-summary').style.display = 'block';
        document.getElementById('portfolio-chart-card').style.display = 'block';
        document.getElementById('analytics-dashboard').style.display = 'block';
        document.getElementById('active-trades-card').style.display = 'block';
        document.getElementById('completed-trades-card').style.display = 'block';

        // Update summary metrics
        updateSummaryMetrics(result, analytics, currency);

        // Initialize charts
        window.PortfolioCharts.initializeCharts(result.portfolio, analytics, currency);

        // Update analytics metrics
        updateAnalyticsMetrics(analytics);

        // Render tables
        renderActiveTrades(result.portfolio.positions, currency);
        renderCompletedTrades(result.portfolio.closedTrades, currency);

        // Scroll to results
        document.getElementById('portfolio-summary').scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * Update summary metrics cards
     */
    function updateSummaryMetrics(result, analytics, currency) {
        const currencySymbol = window.PortfolioSimulator.getCurrencySymbol(currency);
        const dailyValues = result.portfolio.dailyValues;

        const initialValue = dailyValues.length > 0 ? dailyValues[0].value : 0;
        const finalValue = dailyValues.length > 0 ? dailyValues[dailyValues.length - 1].value : 0;

        document.getElementById('initial-value').textContent = `${currencySymbol}${initialValue.toFixed(2)}`;
        document.getElementById('final-value').textContent = `${currencySymbol}${finalValue.toFixed(2)}`;
        document.getElementById('total-return').textContent = `${analytics.totalReturn.toFixed(2)}%`;
        document.getElementById('total-return').className = 'metric-value ' + (analytics.totalReturn >= 0 ? 'positive' : 'negative');
        document.getElementById('win-rate').textContent = `${analytics.winRate.toFixed(1)}%`;
        document.getElementById('total-trades').textContent = analytics.totalTrades;
        document.getElementById('max-drawdown').textContent = `-${analytics.maxDrawdown.toFixed(2)}%`;
    }

    /**
     * Update analytics metrics
     */
    function updateAnalyticsMetrics(analytics) {
        document.getElementById('annualized-return').textContent = `${analytics.annualizedReturn.toFixed(2)}%`;
        document.getElementById('sharpe-ratio').textContent = analytics.sharpeRatio.toFixed(2);
        document.getElementById('sortino-ratio').textContent = analytics.sortinoRatio.toFixed(2);
        document.getElementById('profit-factor').textContent = analytics.profitFactor.toFixed(2);
        document.getElementById('expectancy').textContent = `${analytics.expectancy.toFixed(2)}%`;
        document.getElementById('calmar-ratio').textContent = analytics.calmarRatio.toFixed(2);
    }

    /**
     * Render active trades table
     */
    function renderActiveTrades(positions, currency) {
        const tbody = document.getElementById('active-trades-body');
        const countSpan = document.getElementById('active-count');

        countSpan.textContent = positions.length;

        if (positions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="no-data">No active positions</td></tr>';
            return;
        }

        tbody.innerHTML = '';

        for (const position of positions) {
            const row = document.createElement('tr');

            // Calculate current P/L (assuming current price equals entry for simulation)
            const plPercent = 0; // This would need live prices
            const plValue = 0;

            const daysHeld = Math.floor((new Date() - new Date(position.entryDate)) / (24 * 60 * 60 * 1000));

            row.innerHTML = `
                <td><code>${position.symbol}</code></td>
                <td>${position.symbol.split('.')[0]}</td>
                <td><span class="market-badge market-${position.market.toLowerCase()}">${position.market}</span></td>
                <td>${formatDate(position.entryDate)}</td>
                <td>${position.currency}${position.entryPrice.toFixed(2)}</td>
                <td>${position.currency}${position.entryPrice.toFixed(2)}</td>
                <td>${daysHeld}</td>
                <td class="${plPercent >= 0 ? 'positive' : 'negative'}">${plPercent.toFixed(2)}%</td>
                <td class="${plValue >= 0 ? 'positive' : 'negative'}">${position.currency}${plValue.toFixed(2)}</td>
            `;

            tbody.appendChild(row);
        }
    }

    /**
     * Render completed trades table
     */
    function renderCompletedTrades(trades, currency) {
        const tbody = document.getElementById('completed-trades-body');
        const countSpan = document.getElementById('completed-count');

        countSpan.textContent = trades.length;

        if (trades.length === 0) {
            tbody.innerHTML = '<tr><td colspan="13" class="no-data">No completed trades</td></tr>';
            return;
        }

        // Apply filters
        const filteredTrades = getFilteredTrades(trades);

        tbody.innerHTML = '';

        for (const trade of filteredTrades) {
            const row = document.createElement('tr');

            // Calculate P/L in all currencies
            const plNative = (trade.tradeSize * trade.plPercent) / 100;
            const plINR = convertToINR(plNative, trade.currency);
            const plGBP = convertToGBP(plNative, trade.currency);
            const plUSD = convertToUSD(plNative, trade.currency);

            row.innerHTML = `
                <td><code>${trade.symbol}</code></td>
                <td>${trade.symbol.split('.')[0]}</td>
                <td><span class="market-badge market-${trade.market.toLowerCase()}">${trade.market}</span></td>
                <td>${formatDate(trade.entryDate)}</td>
                <td>${trade.currency}${trade.entryPrice.toFixed(2)}</td>
                <td>${formatDate(trade.exitDate)}</td>
                <td>${trade.currency}${trade.exitPrice.toFixed(2)}</td>
                <td>${trade.holdingDays}</td>
                <td class="${trade.plPercent >= 0 ? 'positive' : 'negative'}">${trade.plPercent.toFixed(2)}%</td>
                <td class="${plINR >= 0 ? 'positive' : 'negative'}">₹${plINR.toFixed(2)}</td>
                <td class="${plGBP >= 0 ? 'positive' : 'negative'}">£${plGBP.toFixed(2)}</td>
                <td class="${plUSD >= 0 ? 'positive' : 'negative'}">$${plUSD.toFixed(2)}</td>
                <td><span class="exit-reason-badge">${trade.exitReason}</span></td>
            `;

            tbody.appendChild(row);
        }

        if (filteredTrades.length === 0) {
            tbody.innerHTML = '<tr><td colspan="13" class="no-data">No trades match the selected filters</td></tr>';
        }
    }

    /**
     * Get filtered trades based on filters
     */
    function getFilteredTrades(trades) {
        const marketFilter = document.getElementById('market-filter').value;
        const outcomeFilter = document.getElementById('outcome-filter').value;

        return trades.filter(trade => {
            // Market filter
            if (marketFilter !== 'all' && trade.market !== marketFilter) {
                return false;
            }

            // Outcome filter
            if (outcomeFilter === 'winners' && trade.plPercent <= 0) {
                return false;
            }
            if (outcomeFilter === 'losers' && trade.plPercent > 0) {
                return false;
            }

            return true;
        });
    }

    /**
     * Apply filters
     */
    function applyFilters() {
        if (currentResults) {
            const currency = document.getElementById('display-currency').value;
            renderCompletedTrades(currentResults.portfolio.closedTrades, currency);
        }
    }

    /**
     * Switch analytics tab
     */
    function switchAnalyticsTab(tabId) {
        // Update tab buttons
        const tabs = document.querySelectorAll('.analytics-tab');
        tabs.forEach(tab => tab.classList.remove('active'));
        event.target.classList.add('active');

        // Update tab content
        const contents = document.querySelectorAll('.analytics-tab-content');
        contents.forEach(content => content.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
    }

    /**
     * Export to CSV
     */
    function exportToCSV() {
        if (!currentResults) {
            showNotification('No simulation results to export', 'error');
            return;
        }

        window.PortfolioExport.exportToCSV(currentResults.portfolio.closedTrades);
    }

    /**
     * Currency conversion helpers
     */
    function convertToINR(amount, fromCurrency) {
        const rates = window.PortfolioSimulator.CONFIG.EXCHANGE_RATES;
        if (fromCurrency === 'INR') return amount;
        if (fromCurrency === 'GBP') return amount * rates.GBP_TO_INR;
        if (fromCurrency === 'USD') return amount * rates.USD_TO_INR;
        return amount;
    }

    function convertToGBP(amount, fromCurrency) {
        const rates = window.PortfolioSimulator.CONFIG.EXCHANGE_RATES;
        if (fromCurrency === 'GBP') return amount;
        if (fromCurrency === 'USD') return amount * rates.USD_TO_GBP;
        if (fromCurrency === 'INR') return amount * rates.INR_TO_GBP;
        return amount;
    }

    function convertToUSD(amount, fromCurrency) {
        const rates = window.PortfolioSimulator.CONFIG.EXCHANGE_RATES;
        if (fromCurrency === 'USD') return amount;
        if (fromCurrency === 'GBP') return amount * rates.GBP_TO_USD;
        if (fromCurrency === 'INR') return amount * rates.INR_TO_USD;
        return amount;
    }

    /**
     * Format date
     */
    function formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }

    /**
     * Show notification
     */
    function showNotification(message, type = 'info') {
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            alert(message);
        }
    }

    // Public API
    return {
        init
    };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', PortfolioUI.init);
} else {
    PortfolioUI.init();
}

// Make available globally
window.PortfolioUI = PortfolioUI;
