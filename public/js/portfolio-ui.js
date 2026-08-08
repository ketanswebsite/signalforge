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
            btn.innerHTML = '<span class="sa-btn__spin" aria-hidden="true"></span> Running\u2026';
            statusDiv.classList.remove('hidden');
            statusDiv.className = 'simulation-status info';

            // Progress callback to update UI
            const updateProgress = (progress) => {
                let message = progress.message || 'Working\u2026';
                let html = '<div class="sa-prog"><div class="sa-prog__meta"><span></span>'
                    + (progress.percent !== undefined ? '<span>' + progress.percent + '%</span>' : '')
                    + '</div>';

                if (progress.percent !== undefined) {
                    html += '<div class="sa-prog__track"><div class="sa-prog__fill" style="width: '
                        + progress.percent + '%"></div></div>'
                        + '<div class="sa-prog__detail">' + (progress.current || 0) + ' of ' + (progress.total || 0) + ' checked</div>';
                }
                html += '</div>';

                statusDiv.innerHTML = html;
                const messageEl = statusDiv.querySelector('.sa-prog__meta span');
                if (messageEl) messageEl.textContent = message;
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
            statusDiv.textContent = 'Done. The results are below.';
            statusDiv.className = 'simulation-status success';

            setTimeout(() => {
                statusDiv.classList.add('hidden');
            }, 3000);

            // Display results
            displayResults(result, analytics, currency);

        } catch (error) {
            statusDiv.textContent = 'The simulation stopped: ' + error.message;
            statusDiv.className = 'simulation-status error';
            showNotification('Simulation failed: ' + error.message, 'error');
        } finally {
            // Re-enable button
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">play_arrow</span> Run it again';
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
        const totalReturnEl = document.getElementById('total-return');
        totalReturnEl.classList.toggle('positive', analytics.totalReturn >= 0);
        totalReturnEl.classList.toggle('negative', analytics.totalReturn < 0);
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
     * Fetch current price for a stock symbol
     * Returns the most recent close price available
     */
    async function fetchCurrentPrice(symbol) {
        try {
            // Fetch last 7 days of data to get most recent price
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);

            const start = Math.floor(startDate.getTime() / 1000);
            const end = Math.floor(endDate.getTime() / 1000);

            const url = `/yahoo/history?symbol=${symbol}&period1=${start}&period2=${end}&interval=1d`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const csvText = await response.text();
            const rows = csvText.trim().split('\n');

            if (rows.length < 2) {
                throw new Error('No data returned');
            }

            // Get the most recent row (last row in CSV)
            const lastRow = rows[rows.length - 1];
            const values = lastRow.split(',');

            if (values.length >= 5) {
                const price = parseFloat(values[4]); // close price
                if (!isNaN(price) && price > 0) {
                    return price;
                }
            }

            throw new Error('No valid price found');

        } catch (error) {
            console.error(`Failed to fetch current price for ${symbol}:`, error);
            return null; // Return null on failure
        }
    }

    /**
     * Exit reasons in words (v3 Poster vocabulary).
     */
    function exitReasonLabel(reason) {
        switch (reason) {
            case 'Take Profit':
            case 'Target Reached': return 'Hit the +8% target';
            case 'Stop Loss':
            case 'Stop Loss Hit': return 'Hit the \u22125% stop';
            case 'Max Days':
            case 'Time Exit': return 'Ran out of time';
            case 'Force Closed':
            case 'End of Simulation':
            case 'Simulation End': return 'Simulation ended';
            default: return reason || 'Unknown';
        }
    }

    function exitReasonTone(reason) {
        switch (reason) {
            case 'Take Profit':
            case 'Target Reached': return 'gain';
            case 'Stop Loss':
            case 'Stop Loss Hit': return 'loss';
            default: return 'neutral';
        }
    }

    /**
     * Render active trades table
     */
    async function renderActiveTrades(positions, currency) {
        const tbody = document.getElementById('active-trades-body');
        const countSpan = document.getElementById('active-count');

        // Filter to only show truly active positions (no exit data)
        const activePositions = positions.filter(position => {
            // Must NOT have exit data (exitDate or exitPrice)
            return !position.exitDate && (position.exitPrice === undefined || position.exitPrice === null);
        });

        countSpan.textContent = activePositions.length;

        if (activePositions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="no-data sa-table__empty">Nothing was still open.</td></tr>';
            const emptyCards = document.getElementById('active-cards-body');
            if (emptyCards) emptyCards.replaceChildren();
            return;
        }

        // Show loading state
        tbody.innerHTML = '<tr><td colspan="9" class="no-data sa-table__empty">Fetching current prices\u2026</td></tr>';

        // Fetch current prices for all positions concurrently
        const pricePromises = activePositions.map(position =>
            fetchCurrentPrice(position.symbol).then(price => ({ position, currentPrice: price }))
        );

        const positionsWithPrices = await Promise.all(pricePromises);

        // Clear loading state
        tbody.innerHTML = '';
        const activeCards = document.getElementById('active-cards-body');
        if (activeCards) activeCards.replaceChildren();

        // Render each position with real P&L
        for (const { position, currentPrice } of positionsWithPrices) {
            const row = document.createElement('tr');

            // Calculate current P/L with fetched price
            let plPercent = 0;
            let plValue = 0;
            let displayPrice = position.entryPrice; // Fallback to entry price

            if (currentPrice !== null && currentPrice > 0) {
                displayPrice = currentPrice;
                plPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
                plValue = (position.tradeSize * plPercent) / 100;
            }

            const daysHeld = Math.floor((new Date() - new Date(position.entryDate)) / (24 * 60 * 60 * 1000));

            row.innerHTML = `
                <td><code>${position.symbol}</code></td>
                <td>${position.symbol.split('.')[0]}</td>
                <td><span class="market-badge market-${position.market.toLowerCase()}">${position.market}</span></td>
                <td>${formatDate(position.entryDate)}</td>
                <td class="num">${position.currency}${position.entryPrice.toFixed(2)}</td>
                <td class="num">${position.currency}${displayPrice.toFixed(2)}</td>
                <td class="num">${daysHeld} days</td>
                <td class="num ${plPercent >= 0 ? 'gain' : 'loss'}">${plPercent.toFixed(2)}%</td>
                <td class="num ${plValue >= 0 ? 'gain' : 'loss'}">${position.currency}${plValue.toFixed(2)}</td>
            `;

            tbody.appendChild(row);

            if (activeCards) {
                const rc = document.createElement('div');
                rc.className = 'sa-rowcard';
                rc.innerHTML = `
                    <div class="sa-rowcard__top"><strong>${position.symbol}</strong>
                        <span class="sa-rowcard__v ${plPercent >= 0 ? 'gain' : 'loss'}">${plPercent.toFixed(2)}%</span></div>
                    <div class="sa-rowcard__grid">
                        <span class="sa-rowcard__k">Market</span><span class="sa-rowcard__v">${position.market}</span>
                        <span class="sa-rowcard__k">Bought at</span><span class="sa-rowcard__v">${position.currency}${position.entryPrice.toFixed(2)}</span>
                        <span class="sa-rowcard__k">Now</span><span class="sa-rowcard__v">${position.currency}${displayPrice.toFixed(2)}</span>
                        <span class="sa-rowcard__k">Held</span><span class="sa-rowcard__v">${daysHeld} days</span>
                        <span class="sa-rowcard__k">Result</span><span class="sa-rowcard__v ${plValue >= 0 ? 'gain' : 'loss'}">${position.currency}${plValue.toFixed(2)}</span>
                    </div>`;
                activeCards.appendChild(rc);
            }
        }
    }

    /**
     * Render completed trades table
     */
    function renderCompletedTrades(trades, currency) {
        const tbody = document.getElementById('completed-trades-body');
        const countSpan = document.getElementById('completed-count');

        // Filter out trades without exit dates (only show truly completed trades)
        // Exclude open trades (isOpen flag) and trades with invalid exit data
        const completedTrades = trades.filter(trade => {
            // Exclude if explicitly marked as open
            if (trade.isOpen === true) return false;

            // Must have both exitDate and a valid exitPrice (not null, not undefined)
            return trade.exitDate &&
                   trade.exitPrice !== undefined &&
                   trade.exitPrice !== null &&
                   !isNaN(trade.exitPrice);
        });

        countSpan.textContent = completedTrades.length;

        if (completedTrades.length === 0) {
            tbody.innerHTML = '<tr><td colspan="18" class="no-data sa-table__empty">No completed trades.</td></tr>';
            const emptyCards2 = document.getElementById('completed-cards-body');
            if (emptyCards2) emptyCards2.replaceChildren();
            return;
        }

        // Apply filters
        const filteredTrades = getFilteredTrades(completedTrades);

        tbody.innerHTML = '';
        const completedCards = document.getElementById('completed-cards-body');
        if (completedCards) completedCards.replaceChildren();

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
                <td class="num">${trade.currency}${trade.entryPrice.toFixed(2)}</td>
                <td>${formatDate(trade.exitDate)}</td>
                <td class="num">${trade.currency}${trade.exitPrice.toFixed(2)}</td>
                <td class="num">${trade.holdingDays} days</td>
                <td class="num">${trade.prevDTI !== undefined ? trade.prevDTI.toFixed(2) : 'N/A'}</td>
                <td class="num">${trade.entryDTI !== undefined ? trade.entryDTI.toFixed(2) : 'N/A'}</td>
                <td class="num">${trade.prev7DayDTI !== undefined ? trade.prev7DayDTI.toFixed(2) : 'N/A'}</td>
                <td class="num">${trade.entry7DayDTI !== undefined ? trade.entry7DayDTI.toFixed(2) : 'N/A'}</td>
                <td class="num">${trade.historicalSignalCount || 0}</td>
                <td class="num ${trade.plPercent >= 0 ? 'gain' : 'loss'}">${trade.plPercent.toFixed(2)}%</td>
                <td class="num ${plINR >= 0 ? 'gain' : 'loss'}">\u20b9${plINR.toFixed(2)}</td>
                <td class="num ${plGBP >= 0 ? 'gain' : 'loss'}">\u00a3${plGBP.toFixed(2)}</td>
                <td class="num ${plUSD >= 0 ? 'gain' : 'loss'}">$${plUSD.toFixed(2)}</td>
                <td><span class="sa-badge sa-badge--${exitReasonTone(trade.exitReason)} exit-reason-badge">${exitReasonLabel(trade.exitReason)}</span></td>
            `;

            tbody.appendChild(row);

            if (completedCards) {
                const rc = document.createElement('div');
                rc.className = 'sa-rowcard';
                rc.innerHTML = `
                    <div class="sa-rowcard__top"><strong>${trade.symbol}</strong>
                        <span class="sa-rowcard__v ${trade.plPercent >= 0 ? 'gain' : 'loss'}">${trade.plPercent.toFixed(2)}%</span></div>
                    <div class="sa-rowcard__grid">
                        <span class="sa-rowcard__k">Market</span><span class="sa-rowcard__v">${trade.market}</span>
                        <span class="sa-rowcard__k">Sold on</span><span class="sa-rowcard__v">${formatDate(trade.exitDate)}</span>
                        <span class="sa-rowcard__k">Held</span><span class="sa-rowcard__v">${trade.holdingDays} days</span>
                        <span class="sa-rowcard__k">Why it sold</span><span class="sa-rowcard__v">${exitReasonLabel(trade.exitReason)}</span>
                    </div>`;
                completedCards.appendChild(rc);
            }
        }

        if (filteredTrades.length === 0) {
            tbody.innerHTML = '<tr><td colspan="18" class="no-data sa-table__empty">No trades match this filter.</td></tr>';
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
