/**
 * Trade Analytics Metric Cards
 * Compact metric cards with sparklines for analytics dashboard
 */

const TradeUIMetricCards = (function() {
    'use strict';

    /**
     * Show error message in container
     * @param {HTMLElement} container - Container element
     * @param {string} message - Error message to display
     */
    function showError(container, message) {
        if (!container) return;
        container.innerHTML = `
            <div class="chart-error-state" style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 200px;
                padding: var(--spacing-lg);
                text-align: center;
                color: var(--error);
            ">
                <span class="material-icons" style="font-size: 48px; margin-bottom: var(--spacing-md); opacity: 0.5;">error_outline</span>
                <div style="font-size: 0.875rem; color: var(--text-secondary);">${message}</div>
            </div>
        `;
    }

    /**
     * Show loading state in container
     * @param {HTMLElement} container - Container element
     */
    function showLoading(container) {
        if (!container) return;
        container.innerHTML = `
            <div class="chart-loading-state" style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 200px;
                padding: var(--spacing-lg);
            ">
                <div class="loading-spinner" style="
                    width: 40px;
                    height: 40px;
                    border: 3px solid var(--border-color);
                    border-top-color: var(--accent-gold);
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                "></div>
                <div style="margin-top: var(--spacing-md); font-size: 0.875rem; color: var(--text-secondary);">Loading calendar...</div>
            </div>
        `;
    }

    /**
     * Show empty state in container
     * @param {HTMLElement} container - Container element
     * @param {string} message - Message to display
     */
    function showEmptyState(container, message = "No trade data available") {
        if (!container) return;
        container.innerHTML = `
            <div class="chart-empty-state" style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 200px;
                padding: var(--spacing-lg);
                text-align: center;
            ">
                <span class="material-icons" style="font-size: 48px; margin-bottom: var(--spacing-md); opacity: 0.3; color: var(--text-muted);">calendar_today</span>
                <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: var(--spacing-xs);">${message}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">Add trades to see the calendar heatmap</div>
            </div>
        `;
    }

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

        // Max Drawdown - Use portfolio-based calculation from TradeCore
        let maxDrawdown = '0%';
        let drawdownData = [];
        if (window.TradeCore && typeof window.TradeCore.getAdvancedMetrics === 'function') {
            const advancedMetrics = window.TradeCore.getAdvancedMetrics();
            maxDrawdown = advancedMetrics.maxDrawdown > 0
                ? advancedMetrics.maxDrawdown.toFixed(2) + '%'
                : '0%';

            // Get drawdown trend data from equity curve
            const equityCurve = window.TradeCore.getEquityCurveData ? window.TradeCore.getEquityCurveData() : [];
            if (equityCurve.length > 1) {
                let peak = equityCurve[0].equity;
                drawdownData = equityCurve.map(point => {
                    if (point.equity > peak) peak = point.equity;
                    return ((peak - point.equity) / peak) * 100;
                });
            }
        }

        // Trend data (last 30 days)
        const last30Days = closedTrades.slice(-30);
        const winRateData = calculateTrend(last30Days, 'winRate');
        const plData = calculateTrend(last30Days, 'pl');
        const returnData = calculateTrend(last30Days, 'return');
        const tradeCountData = calculateTrend(trades.slice(-30), 'count');

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

        // Get theme colors from CSS variables instead of hardcoded values
        const styles = getComputedStyle(document.documentElement);
        const successColor = styles.getPropertyValue('--success').trim() || '#22C55E';
        const errorColor = styles.getPropertyValue('--error').trim() || '#DC2626';
        const infoColor = styles.getPropertyValue('--info').trim() || '#D4AF37';

        ctx.clearRect(0, 0, width, height);
        ctx.beginPath();
        ctx.strokeStyle = type === 'positive' ? successColor : type === 'negative' ? errorColor : infoColor;
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
     * @throws {Error} If calendar rendering fails
     */
    function renderCompactCalendar(trades, year = new Date().getFullYear()) {
        const container = document.getElementById('compact-calendar-container');
        if (!container) {
            console.warn('Compact calendar container not found');
            return;
        }

        // Validate trades data
        if (!trades) {
            showError(container, 'No trade data provided');
            return;
        }

        if (!Array.isArray(trades)) {
            showError(container, 'Invalid trade data format');
            return;
        }

        // Show empty state if no trades
        if (trades.length === 0) {
            showEmptyState(container, 'No trades to display on calendar');
            return;
        }

        // Show loading state briefly
        showLoading(container);

        // Wrap rendering in try-catch for error handling
        try {
            // Small delay to show loading state (makes UX feel more responsive)
            setTimeout(() => {
                try {
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

                    // Add legend at bottom with auto-detected currency
                    const legend = createCalendarLegend(trades);
                    container.appendChild(legend);
                } catch (error) {
                    console.error('Error rendering calendar:', error);
                    showError(container, 'Failed to render calendar');
                }
            }, 100);
        } catch (error) {
            console.error('Error initializing calendar render:', error);
            showError(container, 'Failed to initialize calendar');
        }
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
                <button class="year-nav-btn" id="prev-year" data-year="${currentYear - 1}" aria-label="Previous year (${currentYear - 1})" title="Go to ${currentYear - 1}">
                    <span class="material-icons" aria-hidden="true">chevron_left</span>
                </button>
                <select id="calendar-year-select" class="year-select" aria-label="Select year to view trades">
                    ${years.map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('')}
                </select>
                <button class="year-nav-btn" id="next-year" data-year="${currentYear + 1}" aria-label="Next year (${currentYear + 1})" title="Go to ${currentYear + 1}">
                    <span class="material-icons" aria-hidden="true">chevron_right</span>
                </button>
            </div>
            <div id="calendar-year-announcement" class="sr-only" aria-live="polite" aria-atomic="true"></div>
        `;

        // Helper function to announce year changes for screen readers
        const announceYearChange = (year) => {
            const announcement = document.getElementById('calendar-year-announcement');
            if (announcement) {
                announcement.textContent = `Calendar updated to show trades for year ${year}`;
                // Clear announcement after a delay so it can be repeated
                setTimeout(() => {
                    announcement.textContent = '';
                }, 1000);
            }
        };

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
                        announceYearChange(year);
                    }
                });
            }

            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    const year = parseInt(prevBtn.dataset.year);
                    if (window.TradeCore) {
                        const trades = window.TradeCore.getTrades();
                        renderCompactCalendar(trades, year);
                        announceYearChange(year);
                    }
                });
            }

            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    const year = parseInt(nextBtn.dataset.year);
                    if (window.TradeCore) {
                        const trades = window.TradeCore.getTrades();
                        renderCompactCalendar(trades, year);
                        announceYearChange(year);
                    }
                });
            }
        }, 100);

        return header;
    }

    /**
     * Create calendar legend with auto-detected currency
     * @param {Array} trades - Array of trade objects to detect currencies from
     * @returns {HTMLElement} Legend element
     */
    function createCalendarLegend(trades = []) {
        const legend = document.createElement('div');
        legend.className = 'calendar-legend';

        // Auto-detect currencies from trades
        const markets = new Set();
        trades.forEach(trade => {
            if (trade.market) {
                markets.add(trade.market);
            }
        });

        // Determine currency symbols and ranges
        let currencyInfo = [];
        if (markets.has('India')) {
            currencyInfo.push({ symbol: '₹', lowHigh: '1-300', medHigh: '300-1K', highPlus: '1K+' });
        }
        if (markets.has('US')) {
            currencyInfo.push({ symbol: '$', lowHigh: '1-100', medHigh: '100-500', highPlus: '500+' });
        }
        if (markets.has('UK')) {
            currencyInfo.push({ symbol: '£', lowHigh: '1-100', medHigh: '100-500', highPlus: '500+' });
        }

        // Default to India if no markets detected
        if (currencyInfo.length === 0) {
            currencyInfo = [{ symbol: '₹', lowHigh: '1-300', medHigh: '300-1K', highPlus: '1K+' }];
        }

        // Format legend ranges (combine multiple currencies if needed)
        const formatRange = (rangeKey) => {
            return currencyInfo.map(c => `${c.symbol}${c[rangeKey]}`).join(' | ');
        };

        legend.innerHTML = `
            <div class="legend-title">Daily P&L</div>
            <div class="legend-items">
                <div class="legend-group">
                    <div class="legend-label">Profit:</div>
                    <div class="legend-item">
                        <div class="legend-color profit-low"></div>
                        <span>${formatRange('lowHigh')}</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color profit-medium"></div>
                        <span>${formatRange('medHigh')}</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color profit-high"></div>
                        <span>${formatRange('highPlus')}</span>
                    </div>
                </div>
                <div class="legend-group">
                    <div class="legend-label">Loss:</div>
                    <div class="legend-item">
                        <div class="legend-color loss-low"></div>
                        <span>-${formatRange('lowHigh')}</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color loss-medium"></div>
                        <span>-${formatRange('medHigh')}</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color loss-high"></div>
                        <span>-${formatRange('highPlus')}</span>
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

            // Accessibility: Make focusable for keyboard navigation
            dayCell.setAttribute('tabindex', '0');
            dayCell.setAttribute('role', 'button');

            if (tradesByDate[dateStr]) {
                const dayPL = tradesByDate[dateStr].reduce((sum, t) => sum + parseFloat(t.profitLoss || t.plValue || 0), 0);
                const tradeCount = tradesByDate[dateStr].length;
                const plType = dayPL > 0 ? 'profit' : 'loss';

                // Format P&L with currency symbol
                const formattedPL = '₹' + Math.abs(dayPL).toFixed(2);

                if (dayPL > 0) {
                    if (dayPL > 1000) dayCell.classList.add('profit-high');
                    else if (dayPL > 300) dayCell.classList.add('profit-medium');
                    else dayCell.classList.add('profit-low');
                } else if (dayPL < 0) {
                    if (dayPL < -1000) dayCell.classList.add('loss-high');
                    else if (dayPL < -300) dayCell.classList.add('loss-medium');
                    else dayCell.classList.add('loss-low');
                }

                // Accessibility: Add descriptive ARIA label
                dayCell.setAttribute('aria-label', `${dateStr}: ${plType} of ${formattedPL}, ${tradeCount} ${tradeCount === 1 ? 'trade' : 'trades'}`);
                dayCell.title = `${dateStr}: ${dayPL > 0 ? '+' : ''}₹${dayPL.toFixed(2)} (${tradeCount} trades)`;

                // Add keyboard event handler for Enter and Space keys
                dayCell.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        // Trigger the same action as a click (could be extended to show trade details)
                        dayCell.click();

                        // Optional: Show a visual feedback
                        dayCell.style.transform = 'scale(0.95)';
                        setTimeout(() => {
                            dayCell.style.transform = '';
                        }, 100);
                    }
                });
            } else {
                dayCell.classList.add('no-trades');
                dayCell.setAttribute('aria-label', `${dateStr}: No trades`);
                dayCell.setAttribute('tabindex', '-1'); // Don't tab to empty days
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
