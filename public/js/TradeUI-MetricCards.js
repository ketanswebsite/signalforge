/**
 * Trade Analytics Metric Cards
 * Compact metric cards with sparklines for analytics dashboard
 */

const TradeUIMetricCards = (function() {
    'use strict';

    /**
     * Render all analytics metric cards
     */
    function renderMetricCards(trades) {
        const container = document.getElementById('analytics-metrics-grid');
        if (!container) return;

        const metrics = calculateMetrics(trades);
        container.innerHTML = '';

        const cards = [
            createMetricCard('Win Rate', metrics.winRate, 'positive', 'trending_up', metrics.winRateTrend, metrics.winRateData),
            createMetricCard('Total P&L', metrics.totalPL, metrics.totalPLSign >= 0 ? 'positive' : 'negative', 'account_balance', metrics.plTrend, metrics.plData),
            createMetricCard('Avg Return', metrics.avgReturn, parseFloat(metrics.avgReturn) >= 0 ? 'positive' : 'negative', 'percent', metrics.returnTrend, metrics.returnData),
            createMetricCard('Total Trades', metrics.totalTrades, 'neutral', 'bar_chart', null, metrics.tradeCountData),
            createMetricCard('Best Market', metrics.bestMarket.name, 'positive', 'public', `${metrics.bestMarket.winRate}% WR`),
            createMetricCard('Avg Duration', metrics.avgDuration, 'neutral', 'schedule', `${metrics.avgDuration} days`),
            createMetricCard('Main Exit', metrics.mainExit.reason, metrics.mainExit.type, 'exit_to_app', `${metrics.mainExit.count} exits`),
            createMetricCard('Max Drawdown', metrics.maxDrawdown, 'negative', 'trending_down', null, metrics.drawdownData)
        ];

        cards.forEach(card => container.appendChild(card));
    }

    /**
     * Calculate all metrics from trades data
     */
    function calculateMetrics(trades) {
        if (!trades || trades.length === 0) {
            return getEmptyMetrics();
        }

        const closedTrades = trades.filter(t => t.status === 'closed');
        const winningTrades = closedTrades.filter(t => parseFloat(t.profitLossPercentage || t.plPercent || 0) > 0);
        const losingTrades = closedTrades.filter(t => parseFloat(t.profitLossPercentage || t.plPercent || 0) < 0);

        // Win Rate
        const winRate = closedTrades.length > 0
            ? ((winningTrades.length / closedTrades.length) * 100).toFixed(1) + '%'
            : '0%';

        // Total P&L - Separate by market to handle multiple currencies
        const indiaTrades = closedTrades.filter(t => t.market === 'India');
        const usTrades = closedTrades.filter(t => t.market === 'US');

        const indiaPL = indiaTrades.reduce((sum, t) => sum + parseFloat(t.profitLoss || t.plValue || 0), 0);
        const usPL = usTrades.reduce((sum, t) => sum + parseFloat(t.profitLoss || t.plValue || 0), 0);

        // Format with currency symbols
        const indiaPLFormatted = '₹' + indiaPL.toLocaleString('en-IN', { maximumFractionDigits: 0 });
        const usPLFormatted = '$' + usPL.toLocaleString('en-US', { maximumFractionDigits: 0 });

        // Combined display showing both markets
        let totalPLFormatted;
        if (indiaTrades.length > 0 && usTrades.length > 0) {
            totalPLFormatted = `${indiaPLFormatted} | ${usPLFormatted}`;
        } else if (indiaTrades.length > 0) {
            totalPLFormatted = indiaPLFormatted;
        } else if (usTrades.length > 0) {
            totalPLFormatted = usPLFormatted;
        } else {
            totalPLFormatted = '₹0';
        }

        // Average Return
        const avgReturn = closedTrades.length > 0
            ? (closedTrades.reduce((sum, t) => sum + parseFloat(t.profitLossPercentage || t.plPercent || 0), 0) / closedTrades.length).toFixed(2) + '%'
            : '0%';

        // Best Market
        const marketStats = {};
        closedTrades.forEach(t => {
            // Determine market from symbol suffix (.NS for India, .L for UK, default to US)
            let market = 'US';
            if (t.symbol) {
                if (t.symbol.endsWith('.NS')) market = 'India';
                else if (t.symbol.endsWith('.L')) market = 'UK';
            }
            if (!marketStats[market]) {
                marketStats[market] = { wins: 0, total: 0 };
            }
            marketStats[market].total++;
            if (parseFloat(t.profitLossPercentage || t.plPercent || 0) > 0) {
                marketStats[market].wins++;
            }
        });

        let bestMarket = { name: 'N/A', winRate: 0 };
        Object.keys(marketStats).forEach(market => {
            const winRate = (marketStats[market].wins / marketStats[market].total) * 100;
            if (winRate > bestMarket.winRate) {
                bestMarket = { name: market, winRate: winRate.toFixed(0) };
            }
        });

        // Average Duration
        const durations = closedTrades
            .filter(t => t.entryDate && t.exitDate)
            .map(t => {
                const entry = new Date(t.entryDate);
                const exit = new Date(t.exitDate);
                return Math.floor((exit - entry) / (1000 * 60 * 60 * 24));
            });
        const avgDuration = durations.length > 0
            ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
            : 0;

        // Main Exit Reason
        const exitReasons = {};
        closedTrades.forEach(t => {
            const reason = t.exitReason || 'Unknown';
            exitReasons[reason] = (exitReasons[reason] || 0) + 1;
        });

        let mainExit = { reason: 'N/A', count: 0, type: 'neutral' };
        Object.keys(exitReasons).forEach(reason => {
            if (exitReasons[reason] > mainExit.count) {
                let type = 'neutral';
                if (reason.toLowerCase().includes('profit') || reason.toLowerCase().includes('target')) {
                    type = 'positive';
                } else if (reason.toLowerCase().includes('stop') || reason.toLowerCase().includes('loss')) {
                    type = 'negative';
                }
                mainExit = {
                    reason: reason.length > 12 ? reason.substring(0, 12) + '...' : reason,
                    count: exitReasons[reason],
                    type: type
                };
            }
        });

        // Max Drawdown (largest drop from peak in cumulative returns)
        const drawdowns = calculateDrawdowns(closedTrades);
        const maxDrawdown = drawdowns.length > 0
            ? Math.max(...drawdowns).toFixed(1) + '%'
            : '0%';

        // Trend data (last 30 days)
        const last30Days = closedTrades.slice(-30);
        const winRateData = calculateTrend(last30Days, 'winRate');
        const plData = calculateTrend(last30Days, 'pl');
        const returnData = calculateTrend(last30Days, 'return');
        const tradeCountData = calculateTrend(trades.slice(-30), 'count');
        const drawdownData = drawdowns.slice(-30);

        // Calculate trends
        const winRateTrend = winRateData.length >= 2
            ? (winRateData[winRateData.length - 1] > winRateData[0] ? '+' : '') +
              ((winRateData[winRateData.length - 1] - winRateData[0])).toFixed(1) + '%'
            : null;

        const plTrend = plData.length >= 2
            ? (plData[plData.length - 1] > plData[0] ? '+' : '') +
              ((plData[plData.length - 1] - plData[0]) / 1000).toFixed(1) + 'K'
            : null;

        const returnTrend = returnData.length >= 2
            ? (returnData[returnData.length - 1] > returnData[0] ? '+' : '') +
              ((returnData[returnData.length - 1] - returnData[0])).toFixed(1) + '%'
            : null;

        // Determine overall P&L sign for color (prioritize India market if both exist)
        const totalPLSign = indiaTrades.length > 0 ? indiaPL : usPL;

        return {
            winRate,
            winRateTrend,
            winRateData,
            totalPL: totalPLFormatted,
            totalPLSign,
            plTrend,
            plData,
            avgReturn,
            returnTrend,
            returnData,
            totalTrades: closedTrades.length, // Show only closed trades count
            tradeCountData,
            bestMarket,
            avgDuration,
            mainExit,
            maxDrawdown,
            drawdownData
        };
    }

    /**
     * Calculate drawdowns from trades using cumulative percentage returns
     * This matches the formula from advanced metrics (performance-analytics.js)
     */
    function calculateDrawdowns(trades) {
        let peak = 0;
        let cumReturn = 0;
        const drawdowns = [];

        trades.forEach(t => {
            cumReturn += parseFloat(t.profitLossPercentage || t.plPercent || 0);
            if (cumReturn > peak) peak = cumReturn;
            const drawdown = peak - cumReturn;
            drawdowns.push(drawdown);
        });

        return drawdowns;
    }

    /**
     * Calculate trend data for sparklines
     */
    function calculateTrend(trades, type) {
        if (type === 'winRate') {
            const data = [];
            let wins = 0, total = 0;
            trades.forEach(t => {
                if (t.status === 'closed') {
                    total++;
                    if (parseFloat(t.profitLossPercentage || t.plPercent || 0) > 0) wins++;
                    data.push((wins / total) * 100);
                }
            });
            return data;
        } else if (type === 'pl') {
            let cumulative = 0;
            return trades.map(t => {
                cumulative += parseFloat(t.profitLoss || t.plValue || 0);
                return cumulative;
            });
        } else if (type === 'return') {
            const data = [];
            let sum = 0, count = 0;
            trades.forEach(t => {
                if (t.status === 'closed') {
                    sum += parseFloat(t.profitLossPercentage || t.plPercent || 0);
                    count++;
                    data.push(sum / count);
                }
            });
            return data;
        } else if (type === 'count') {
            return trades.map((_, i) => i + 1);
        }
        return [];
    }

    /**
     * Create a metric card element
     */
    function createMetricCard(label, value, valueType, icon, changeText, sparklineData) {
        const card = document.createElement('div');
        card.className = 'metric-card';

        const iconHtml = icon ? `<span class="material-icons metric-card-icon">${icon}</span>` : '';

        const sparklineHtml = sparklineData && sparklineData.length > 0
            ? `<div class="metric-card-sparkline"><canvas id="sparkline-${label.replace(/\s/g, '-').toLowerCase()}"></canvas></div>`
            : '';

        const changeHtml = changeText
            ? `<div class="metric-card-change ${valueType}">${changeText}</div>`
            : '';

        card.innerHTML = `
            <div class="metric-card-header">
                <div class="metric-card-label">${label}</div>
                ${iconHtml}
            </div>
            <div class="metric-card-value ${valueType}">${value}</div>
            ${sparklineData && sparklineData.length > 0 ? `
            <div class="metric-card-footer">
                ${sparklineHtml}
            </div>
            ` : (changeHtml ? `<div class="metric-card-detail">${changeHtml}</div>` : '')}
        `;

        // Render sparkline after adding to DOM
        if (sparklineData && sparklineData.length > 0) {
            setTimeout(() => {
                renderSparkline(`sparkline-${label.replace(/\s/g, '-').toLowerCase()}`, sparklineData, valueType);
            }, 100);
        }

        return card;
    }

    /**
     * Render a miniature sparkline chart
     */
    function renderSparkline(canvasId, data, type) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.parentElement.clientWidth;
        const height = canvas.parentElement.clientHeight;

        canvas.width = width;
        canvas.height = height;

        const max = Math.max(...data);
        const min = Math.min(...data);
        const range = max - min || 1;

        ctx.clearRect(0, 0, width, height);
        ctx.beginPath();
        ctx.strokeStyle = type === 'positive' ? '#22C55E' : type === 'negative' ? '#DC2626' : '#D4AF37';
        ctx.lineWidth = 1.5;

        data.forEach((value, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - ((value - min) / range) * height;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();
    }

    /**
     * Render compact calendar heatmap (12 mini grids)
     */
    function renderCompactCalendar(trades, year = new Date().getFullYear()) {
        const container = document.getElementById('compact-calendar-container');
        if (!container) return;

        // Create calendar header with year selector and legend
        const header = createCalendarHeader(trades, year);

        container.innerHTML = '';
        container.appendChild(header);

        // Create calendar grid container
        const gridWrapper = document.createElement('div');
        gridWrapper.innerHTML = '<div class="compact-calendar-grid" id="compact-calendar-grid"></div>';
        container.appendChild(gridWrapper);

        const grid = document.getElementById('compact-calendar-grid');

        // Create data map for quick lookup
        const tradesByDate = {};
        trades.filter(t => t.exitDate).forEach(t => {
            const date = new Date(t.exitDate).toISOString().split('T')[0];
            if (!tradesByDate[date]) {
                tradesByDate[date] = [];
            }
            tradesByDate[date].push(t);
        });

        // Render 12 months
        for (let month = 0; month < 12; month++) {
            const monthGrid = createMonthMiniGrid(year, month, tradesByDate);
            grid.appendChild(monthGrid);
        }

        // Add legend at bottom
        const legend = createCalendarLegend();
        container.appendChild(legend);
    }

    /**
     * Create calendar header with year selector
     */
    function createCalendarHeader(trades, currentYear) {
        const header = document.createElement('div');
        header.className = 'calendar-header';

        // Get available years from trades
        const years = [...new Set(trades
            .filter(t => t.exitDate)
            .map(t => new Date(t.exitDate).getFullYear())
        )].sort((a, b) => b - a);

        if (years.length === 0) {
            years.push(new Date().getFullYear());
        }

        header.innerHTML = `
            <div class="calendar-year-selector">
                <button class="year-nav-btn" id="prev-year" data-year="${currentYear - 1}">
                    <span class="material-icons">chevron_left</span>
                </button>
                <select id="calendar-year-select" class="year-select">
                    ${years.map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('')}
                </select>
                <button class="year-nav-btn" id="next-year" data-year="${currentYear + 1}">
                    <span class="material-icons">chevron_right</span>
                </button>
            </div>
        `;

        // Add event listeners for year navigation
        setTimeout(() => {
            const yearSelect = document.getElementById('calendar-year-select');
            const prevBtn = document.getElementById('prev-year');
            const nextBtn = document.getElementById('next-year');

            if (yearSelect) {
                yearSelect.addEventListener('change', (e) => {
                    const year = parseInt(e.target.value);
                    if (window.TradeCore) {
                        const trades = window.TradeCore.getTrades();
                        renderCompactCalendar(trades, year);
                    }
                });
            }

            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    const year = parseInt(prevBtn.dataset.year);
                    if (window.TradeCore) {
                        const trades = window.TradeCore.getTrades();
                        renderCompactCalendar(trades, year);
                    }
                });
            }

            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    const year = parseInt(nextBtn.dataset.year);
                    if (window.TradeCore) {
                        const trades = window.TradeCore.getTrades();
                        renderCompactCalendar(trades, year);
                    }
                });
            }
        }, 100);

        return header;
    }

    /**
     * Create calendar legend
     */
    function createCalendarLegend() {
        const legend = document.createElement('div');
        legend.className = 'calendar-legend';

        legend.innerHTML = `
            <div class="legend-title">Daily P&L</div>
            <div class="legend-items">
                <div class="legend-group">
                    <div class="legend-label">Profit:</div>
                    <div class="legend-item">
                        <div class="legend-color profit-low"></div>
                        <span>₹1-300</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color profit-medium"></div>
                        <span>₹300-1K</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color profit-high"></div>
                        <span>₹1K+</span>
                    </div>
                </div>
                <div class="legend-group">
                    <div class="legend-label">Loss:</div>
                    <div class="legend-item">
                        <div class="legend-color loss-low"></div>
                        <span>-₹1-300</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color loss-medium"></div>
                        <span>-₹300-1K</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color loss-high"></div>
                        <span>-₹1K+</span>
                    </div>
                </div>
                <div class="legend-group">
                    <div class="legend-item">
                        <div class="legend-color no-trades"></div>
                        <span>No Trades</span>
                    </div>
                </div>
            </div>
        `;

        return legend;
    }

    /**
     * Create a mini calendar grid for one month
     */
    function createMonthMiniGrid(year, month, tradesByDate) {
        const monthEl = document.createElement('div');
        monthEl.className = 'month-mini-grid';

        const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'short' });
        monthEl.innerHTML = `<div class="month-mini-header">${monthName}</div>`;

        const daysGrid = document.createElement('div');
        daysGrid.className = 'month-mini-days';

        // Add empty cells for days before first day of month
        const firstDay = new Date(year, month, 1).getDay();
        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'mini-day-cell empty';
            daysGrid.appendChild(emptyCell);
        }

        // Add day cells
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayCell = document.createElement('div');
            dayCell.className = 'mini-day-cell';

            if (tradesByDate[dateStr]) {
                const dayPL = tradesByDate[dateStr].reduce((sum, t) => sum + parseFloat(t.profitLoss || t.plValue || 0), 0);

                if (dayPL > 0) {
                    if (dayPL > 1000) dayCell.classList.add('profit-high');
                    else if (dayPL > 300) dayCell.classList.add('profit-medium');
                    else dayCell.classList.add('profit-low');
                } else if (dayPL < 0) {
                    if (dayPL < -1000) dayCell.classList.add('loss-high');
                    else if (dayPL < -300) dayCell.classList.add('loss-medium');
                    else dayCell.classList.add('loss-low');
                }

                dayCell.title = `${dateStr}: ₹${dayPL.toFixed(2)} (${tradesByDate[dateStr].length} trades)`;
            } else {
                dayCell.classList.add('no-trades');
            }

            daysGrid.appendChild(dayCell);
        }

        monthEl.appendChild(daysGrid);
        return monthEl;
    }

    /**
     * Get empty metrics for when there's no data
     */
    function getEmptyMetrics() {
        return {
            winRate: '0%',
            winRateTrend: null,
            winRateData: [],
            totalPL: '₹0',
            totalPLSign: 0,
            plTrend: null,
            plData: [],
            avgReturn: '0%',
            returnTrend: null,
            returnData: [],
            totalTrades: 0,
            tradeCountData: [],
            bestMarket: { name: 'N/A', winRate: 0 },
            avgDuration: 0,
            mainExit: { reason: 'N/A', count: 0, type: 'neutral' },
            maxDrawdown: '0%',
            drawdownData: []
        };
    }

    return {
        renderMetricCards,
        renderCompactCalendar
    };
})();

// Make available globally
window.TradeUIMetricCards = TradeUIMetricCards;
