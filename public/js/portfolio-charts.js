/**
 * Portfolio Charts
 * Handles all chart rendering for portfolio backtest visualizations
 */

const PortfolioCharts = (function() {
    'use strict';

    // Resolve a design-system token at chart-build time (poster palette).
    function chartVar(name, fallback) {
        const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return value || fallback;
    }

    let charts = {}; // Store chart instances

    /**
     * Initialize all charts with portfolio data
     */
    function initializeCharts(portfolio, analytics, currency) {
        // Destroy existing charts
        destroyAllCharts();

        // Create new charts
        createPortfolioValueChart(portfolio.dailyValues, currency);
        createMonthlyReturnsChart(analytics.monthlyReturns);
        createTradesByMarketChart(analytics.tradesByMarket);
        createPLByMarketChart(analytics.plByMarket, currency);
        createReturnDistributionChart(portfolio.closedTrades);
        createExitReasonChart(analytics.exitReasonBreakdown);
        createDrawdownChart(portfolio.dailyValues);
    }

    /**
     * Portfolio Value Chart (Main Line Chart)
     */
    function createPortfolioValueChart(dailyValues, currency) {
        const ctx = document.getElementById('portfolio-value-chart');
        if (!ctx) return;

        const dates = dailyValues.map(d => d.date);
        const values = dailyValues.map(d => d.value);

        const currencySymbol = window.PortfolioSimulator.getCurrencySymbol(currency);

        charts.portfolioValue = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: `Portfolio Value (${currencySymbol})`,
                    data: values,
                    borderColor: chartVar('--accent', '#8A6912'),
                    backgroundColor: chartVar('--accent-soft', '#F7EBC4'),
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${currencySymbol}${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    },
                    zoom: {
                        pan: {
                            enabled: true,
                            mode: 'x'
                        },
                        zoom: {
                            wheel: {
                                enabled: true
                            },
                            pinch: {
                                enabled: true
                            },
                            mode: 'x'
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: `Value (${currencySymbol})`
                        }
                    }
                }
            }
        });
    }

    /**
     * Monthly Returns Bar Chart
     */
    function createMonthlyReturnsChart(monthlyReturns) {
        const ctx = document.getElementById('monthly-returns-chart');
        if (!ctx) return;

        const labels = monthlyReturns.map(m => m.month);
        const returns = monthlyReturns.map(m => m.return);

        // Color bars based on positive/negative
        const backgroundColors = returns.map(r => r >= 0 ? chartVar('--gain', '#177A4C') : chartVar('--loss', '#C22B1F'));

        charts.monthlyReturns = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Monthly Return %',
                    data: returns,
                    backgroundColor: backgroundColors,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Return: ${context.parsed.y.toFixed(2)}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Month'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Return %'
                        }
                    }
                }
            }
        });
    }

    /**
     * Trades by Market Pie Chart
     */
    function createTradesByMarketChart(tradesByMarket) {
        const ctx = document.getElementById('trades-by-market-chart');
        if (!ctx) return;

        const markets = Object.keys(tradesByMarket);
        const counts = Object.values(tradesByMarket);

        charts.tradesByMarket = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: markets,
                datasets: [{
                    data: counts,
                    backgroundColor: [
                        chartVar('--gold-brand', '#D4AF37'),  // India
                        chartVar('--gold-deep', '#8A6912'),   // UK
                        chartVar('--stone-50', '#8B8371')     // US
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} trades (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * P/L by Market Bar Chart
     */
    function createPLByMarketChart(plByMarket, currency) {
        const ctx = document.getElementById('pl-by-market-chart');
        if (!ctx) return;

        const markets = Object.keys(plByMarket);
        const plValues = Object.values(plByMarket);

        const backgroundColors = plValues.map(v => v >= 0 ? chartVar('--gain', '#177A4C') : chartVar('--loss', '#C22B1F'));
        const currencySymbol = window.PortfolioSimulator.getCurrencySymbol(currency);

        charts.plByMarket = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: markets,
                datasets: [{
                    label: `P/L (${currencySymbol})`,
                    data: plValues,
                    backgroundColor: backgroundColors,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `P/L: ${currencySymbol}${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Market'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: `P/L (${currencySymbol})`
                        }
                    }
                }
            }
        });
    }

    /**
     * Return Distribution Histogram
     */
    function createReturnDistributionChart(closedTrades) {
        const ctx = document.getElementById('return-distribution-chart');
        if (!ctx) return;

        // Create bins for histogram
        const returns = closedTrades.map(t => t.plPercent);
        const bins = createHistogramBins(returns, 20);

        charts.returnDistribution = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: bins.labels,
                datasets: [{
                    label: 'Number of Trades',
                    data: bins.counts,
                    backgroundColor: chartVar('--accent', '#8A6912'),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Trades: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Return %'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Frequency'
                        }
                    }
                }
            }
        });
    }

    /**
     * Exit Reason Breakdown Pie Chart
     */
    function createExitReasonChart(exitReasonBreakdown) {
        const ctx = document.getElementById('exit-reason-chart');
        if (!ctx) return;

        const reasons = Object.keys(exitReasonBreakdown).filter(r => exitReasonBreakdown[r] > 0);
        const counts = reasons.map(r => exitReasonBreakdown[r]);

        charts.exitReason = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: reasons,
                datasets: [{
                    data: counts,
                    backgroundColor: [
                        chartVar('--gain', '#177A4C'),   // Hit the target
                        chartVar('--loss', '#C22B1F'),   // Hit the stop
                        chartVar('--warn', '#8A5A00'),   // Ran out of time
                        chartVar('--stone-50', '#8B8371')  // Everything else
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Drawdown Chart
     */
    function createDrawdownChart(dailyValues) {
        const ctx = document.getElementById('drawdown-chart');
        if (!ctx) return;

        // Calculate drawdown series
        const drawdowns = calculateDrawdownSeries(dailyValues);
        const dates = dailyValues.map(d => d.date);

        charts.drawdown = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Drawdown %',
                    data: drawdowns,
                    borderColor: chartVar('--loss', '#C22B1F'),
                    backgroundColor: chartVar('--loss-soft', '#FAE8E4'),
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Drawdown: ${context.parsed.y.toFixed(2)}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Drawdown %'
                        },
                        reverse: true // Show drawdowns as negative going down
                    }
                }
            }
        });
    }

    /**
     * Calculate drawdown series
     */
    function calculateDrawdownSeries(dailyValues) {
        const drawdowns = [];
        let peak = dailyValues[0].value;

        for (const day of dailyValues) {
            if (day.value > peak) {
                peak = day.value;
            }
            const drawdown = ((peak - day.value) / peak) * 100;
            drawdowns.push(drawdown);
        }

        return drawdowns;
    }

    /**
     * Create histogram bins
     */
    function createHistogramBins(values, numBins) {
        if (values.length === 0) {
            return { labels: [], counts: [] };
        }

        const min = Math.min(...values);
        const max = Math.max(...values);
        const binWidth = (max - min) / numBins;

        const bins = Array(numBins).fill(0);
        const labels = [];

        // Create bin labels
        for (let i = 0; i < numBins; i++) {
            const binStart = min + i * binWidth;
            const binEnd = binStart + binWidth;
            labels.push(`${binStart.toFixed(1)}`);
        }

        // Count values in each bin
        for (const value of values) {
            const binIndex = Math.min(Math.floor((value - min) / binWidth), numBins - 1);
            bins[binIndex]++;
        }

        return {
            labels: labels,
            counts: bins
        };
    }

    /**
     * Destroy all chart instances
     */
    function destroyAllCharts() {
        for (const key in charts) {
            if (charts[key]) {
                charts[key].destroy();
                delete charts[key];
            }
        }
    }

    // Public API
    return {
        initializeCharts,
        destroyAllCharts
    };
})();

// Make available globally
window.PortfolioCharts = PortfolioCharts;
