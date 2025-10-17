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
            statusDiv.classList.remove('hidden');
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
                statusDiv.classList.add('hidden');
            }, 3000);

            // Display results
            displayResults(result, analytics, currency);

        } catch (error) {
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
        document.getElementById('portfolio-summary').classList.remove('hidden');
        document.getElementById('simulation-details-card').classList.remove('hidden');
        document.getElementById('portfolio-chart-card').classList.remove('hidden');
        document.getElementById('analytics-dashboard').classList.remove('hidden');
        document.getElementById('active-trades-card').classList.remove('hidden');
        document.getElementById('completed-trades-card').classList.remove('hidden');

        // Update summary metrics
        updateSummaryMetrics(result, analytics, currency);

        // Update simulation details
        updateSimulationDetails(result);

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
     * Update simulation details section
     */
    function updateSimulationDetails(result) {
        if (!result.metadata) return;

        const meta = result.metadata;

        // Date ranges
        document.getElementById('detail-sim-start').textContent = formatDate(meta.dates.simulationStart);
        document.getElementById('detail-data-range').textContent = `${formatDate(meta.dates.dataStart)} to ${formatDate(meta.dates.simulationEnd)}`;
        document.getElementById('detail-buffer-period').textContent = `${formatDate(meta.dates.dataStart)} to ${formatDate(meta.dates.bufferEnd)}`;
        document.getElementById('detail-historical-signals').textContent = `${formatDate(meta.dates.bufferEnd)} to ${formatDate(meta.dates.simulationStart)}`;
        document.getElementById('detail-simulation-period').textContent = `${formatDate(meta.dates.simulationStart)} to ${formatDate(meta.dates.simulationEnd)}`;

        // Data quality
        document.getElementById('detail-stocks-processed').textContent = meta.processing.totalStocksProcessed;
        document.getElementById('detail-high-conviction').textContent = meta.processing.highConvictionStocks;
        document.getElementById('detail-stale-data').textContent = `${meta.dataQuality.staleDataStocks} (${meta.dataQuality.staleDataPercent}%)`;
        document.getElementById('detail-batches').textContent = `${meta.processing.totalBatches} batches of ${meta.processing.batchSize}`;

        // Signal processing
        document.getElementById('detail-signals-generated').textContent = meta.signals.totalSignalsGenerated;
        document.getElementById('detail-open-trades').textContent = meta.signals.openTradesIncluded;
        document.getElementById('detail-fuzzy-matches').textContent = meta.signals.fuzzyMatches;
        document.getElementById('detail-unmatched').textContent = meta.signals.unmatchedPositions > 0
            ? `${meta.signals.unmatchedPositions} (${meta.signals.unmatchedSymbols})`
            : '0';

        // Force-close events
        document.getElementById('detail-force-closed-total').textContent = meta.forceClose.total;
        document.getElementById('detail-force-closed-real').textContent = `${meta.forceClose.withRealPrice} (${meta.forceClose.withRealPricePercent}%)`;
        document.getElementById('detail-force-closed-fallback').textContent = `${meta.forceClose.withFallback} (${meta.forceClose.withFallbackPercent}%)`;
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

        // Filter out trades without exit dates (only show truly completed trades)
        const completedTrades = trades.filter(trade => trade.exitDate && trade.exitPrice !== undefined);

        countSpan.textContent = completedTrades.length;

        if (completedTrades.length === 0) {
            tbody.innerHTML = '<tr><td colspan="18" class="no-data">No completed trades</td></tr>';
            return;
        }

        // Apply filters
        const filteredTrades = getFilteredTrades(completedTrades);

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
                <td>${trade.prevDTI !== undefined ? trade.prevDTI.toFixed(2) : 'N/A'}</td>
                <td>${trade.entryDTI !== undefined ? trade.entryDTI.toFixed(2) : 'N/A'}</td>
                <td>${trade.prev7DayDTI !== undefined ? trade.prev7DayDTI.toFixed(2) : 'N/A'}</td>
                <td>${trade.entry7DayDTI !== undefined ? trade.entry7DayDTI.toFixed(2) : 'N/A'}</td>
                <td>${trade.historicalSignalCount || 0}</td>
                <td class="${trade.plPercent >= 0 ? 'positive' : 'negative'}">${trade.plPercent.toFixed(2)}%</td>
                <td class="${plINR >= 0 ? 'positive' : 'negative'}">₹${plINR.toFixed(2)}</td>
                <td class="${plGBP >= 0 ? 'positive' : 'negative'}">£${plGBP.toFixed(2)}</td>
                <td class="${plUSD >= 0 ? 'positive' : 'negative'}">$${plUSD.toFixed(2)}</td>
                <td><span class="exit-reason-badge">${trade.exitReason}</span></td>
            `;

            tbody.appendChild(row);
        }

        if (filteredTrades.length === 0) {
            tbody.innerHTML = '<tr><td colspan="18" class="no-data">No trades match the selected filters</td></tr>';
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
