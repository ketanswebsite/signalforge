/**
 * DTI Backtester - Charts UI Module
 * Handles all chart rendering and visualizations
 * Theme-aware with Black & Gold design
 */

// Create Charts module
window.TradeUIModules = window.TradeUIModules || {};
window.TradeUIModules.charts = (function() {
    // Private variables for chart instances
    let equityChart = null;
    let drawdownChart = null;
    let plDistributionChart = null;
    let winLossPieChart = null;
    let monthlyPerformanceChart = null;
    let marketComparisonChart = null;
    let sizeVsReturnChart = null;
    let holdingTimeChart = null;

    /**
     * Get theme-aware colors based on current theme
     * Returns color palette optimized for Black & Gold theme
     */
    function getThemeColors() {
        const isDark = document.body.classList.contains('dark-theme') ||
                       !document.body.classList.contains('light-theme');

        return {
            // Primary gold colors
            primary: 'rgba(212, 175, 55, 1)',           // --accent-gold
            primaryLight: 'rgba(212, 175, 55, 0.8)',
            primaryVeryLight: 'rgba(212, 175, 55, 0.2)',
            primaryUltraLight: 'rgba(212, 175, 55, 0.05)',

            // Amber accent
            amber: 'rgba(255, 165, 0, 1)',              // --accent-amber
            amberLight: 'rgba(255, 165, 0, 0.8)',

            // Success colors (green)
            success: 'rgba(34, 197, 94, 1)',            // --success
            successLight: 'rgba(34, 197, 94, 0.7)',
            successVeryLight: 'rgba(34, 197, 94, 0.2)',

            // Error colors (red)
            error: 'rgba(220, 38, 38, 1)',              // --error
            errorLight: 'rgba(220, 38, 38, 0.7)',
            errorVeryLight: 'rgba(220, 38, 38, 0.2)',
            errorUltraLight: 'rgba(220, 38, 38, 0.05)',

            // Text colors
            textPrimary: isDark ? '#ffffff' : '#000000',
            textSecondary: isDark ? '#D1D1D1' : '#2B2B2B',
            textMuted: isDark ? '#737373' : '#525252',

            // Background colors
            bgPrimary: isDark ? '#000000' : '#E5E5E5',
            bgSecondary: isDark ? '#1C1C1C' : '#ffffff',
            bgSurface: isDark ? '#2B2B2B' : '#E5E5E5',

            // Grid and borders
            gridColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            borderColor: isDark ? 'rgba(212, 175, 55, 0.15)' : 'rgba(0, 0, 0, 0.1)',

            // Tooltip
            tooltipBg: isDark ? 'rgba(28, 28, 28, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            tooltipText: isDark ? '#ffffff' : '#111827',
            tooltipBorder: isDark ? 'rgba(212, 175, 55, 0.3)' : 'rgba(0, 0, 0, 0.15)',

            // Point colors
            pointBg: isDark ? 'rgba(28, 28, 28, 1)' : 'rgba(255, 255, 255, 1)',
            pointBorder: 'rgba(212, 175, 55, 1)'
        };
    }

    /**
     * Initialize the charts module
     */
    function init() {
        // Listen for theme changes to re-render charts
        window.addEventListener('themechange', function() {
            renderAllCharts();
        });
    }
    
    /**
     * Render all available charts
     */
    function renderAllCharts() {
        try {
            renderEquityCurve();
        } catch (error) {
            console.error('Error rendering equity curve:', error);
        }

        try {
            renderDrawdownChart();
        } catch (error) {
            console.error('Error rendering drawdown chart:', error);
        }

        try {
            renderPLDistribution();
        } catch (error) {
            console.error('Error rendering P/L distribution:', error);
        }

        try {
            renderWinLossPieChart();
        } catch (error) {
            console.error('Error rendering win/loss pie chart:', error);
        }

        try {
            renderMonthlyPerformance();
        } catch (error) {
            console.error('Error rendering monthly performance:', error);
        }

        try {
            renderMarketComparison();
        } catch (error) {
            console.error('Error rendering market comparison:', error);
        }

        try {
            renderTradeSizeVsReturn();
        } catch (error) {
            console.error('Error rendering trade size vs return:', error);
        }

        try {
            renderHoldingPeriodAnalysis();
        } catch (error) {
            console.error('Error rendering holding period analysis:', error);
        }
    }
    
    /**
     * Render equity curve chart with gold gradient
     */
    function renderEquityCurve() {
        const container = document.getElementById('equity-curve-chart');
        if (!container) {
            return;
        }

        const data = TradeCore.getEquityCurveData();

        if (data.length === 0) {
            container.innerHTML = '<div class="no-data-message">No trade data available for equity curve</div>';
            return;
        }

        // Clear previous chart if it exists
        if (equityChart) {
            equityChart.destroy();
        }

        // Get theme colors
        const colors = getThemeColors();

        // Prepare data
        const labels = data.map(d => new Date(d.date).toLocaleDateString());
        const equityData = data.map(d => d.percentGain);

        // Calculate min/max for better y-axis scaling with padding
        const minValue = Math.min(...equityData);
        const maxValue = Math.max(...equityData);
        const yPadding = Math.max(1, (maxValue - minValue) * 0.1);

        // Create gold gradient for area fill
        const ctx = container.getContext('2d');
        const gradientFill = ctx.createLinearGradient(0, 0, 0, container.clientHeight);
        gradientFill.addColorStop(0, colors.primaryVeryLight);
        gradientFill.addColorStop(1, colors.primaryUltraLight);

        // Create chart
        equityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Portfolio Growth (%)',
                    data: equityData,
                    borderColor: colors.primary,
                    backgroundColor: gradientFill,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    pointBackgroundColor: colors.pointBg,
                    pointBorderColor: colors.pointBorder,
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            color: colors.textPrimary,
                            font: {
                                family: "'Exo 2', sans-serif",
                                weight: 'bold',
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: colors.tooltipBg,
                        titleColor: colors.tooltipText,
                        bodyColor: colors.tooltipText,
                        borderColor: colors.tooltipBorder,
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: {
                            family: "'Work Sans', sans-serif",
                            weight: '600',
                            size: 13
                        },
                        bodyFont: {
                            family: "'Roboto Mono', monospace",
                            weight: '500',
                            size: 12
                        },
                        callbacks: {
                            label: function(context) {
                                return `Growth: ${context.parsed.y.toFixed(2)}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: colors.textSecondary,
                            maxTicksLimit: Math.min(10, labels.length),
                            font: {
                                family: "'Work Sans', sans-serif",
                                size: 11
                            }
                        }
                    },
                    y: {
                        min: Math.floor(minValue - yPadding),
                        max: Math.ceil(maxValue + yPadding),
                        grid: {
                            color: colors.gridColor
                        },
                        border: {
                            dash: [4, 4]
                        },
                        ticks: {
                            color: colors.textSecondary,
                            callback: function(value) {
                                return value + '%';
                            },
                            font: {
                                family: "'Roboto Mono', monospace",
                                size: 11
                            }
                        }
                    }
                },
                elements: {
                    line: {
                        borderJoinStyle: 'round'
                    }
                }
            }
        });
    }
    
    /**
     * Render drawdown chart with theme-aware colors
     */
    function renderDrawdownChart() {
        const container = document.getElementById('drawdown-chart');
        if (!container) return;

        const data = TradeCore.getDrawdownChartData();

        if (data.length === 0) {
            container.innerHTML = '<div class="no-data-message">No trade data available for drawdown chart</div>';
            return;
        }

        // Clear previous chart if it exists
        if (drawdownChart) {
            drawdownChart.destroy();
        }

        // Get theme colors
        const colors = getThemeColors();

        // Prepare data - Keep as positive values but invert the y-axis
        const labels = data.map(d => new Date(d.date).toLocaleDateString());
        const drawdownData = data.map(d => d.drawdown);

        // Find maximum drawdown for scale setting
        const maxDrawdown = Math.max(...drawdownData, 5);

        // Create red gradient for area fill
        const ctx = container.getContext('2d');
        const gradientFill = ctx.createLinearGradient(0, 0, 0, container.clientHeight);
        gradientFill.addColorStop(0, colors.errorUltraLight);
        gradientFill.addColorStop(0.5, colors.errorVeryLight);
        gradientFill.addColorStop(1, 'rgba(220, 38, 38, 0.3)');

        // Create chart
        drawdownChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Drawdown (%)',
                    data: drawdownData,
                    borderColor: colors.error,
                    backgroundColor: gradientFill,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.2,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: colors.pointBg,
                    pointBorderColor: colors.error,
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            color: colors.textPrimary,
                            font: {
                                family: "'Exo 2', sans-serif",
                                weight: 'bold',
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: colors.tooltipBg,
                        titleColor: colors.tooltipText,
                        bodyColor: colors.tooltipText,
                        borderColor: colors.tooltipBorder,
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: {
                            family: "'Work Sans', sans-serif",
                            weight: '600',
                            size: 13
                        },
                        bodyFont: {
                            family: "'Roboto Mono', monospace",
                            weight: '500',
                            size: 12
                        },
                        callbacks: {
                            label: function(context) {
                                return `Drawdown: ${context.parsed.y.toFixed(2)}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: colors.textSecondary,
                            maxTicksLimit: Math.min(10, labels.length),
                            font: {
                                family: "'Work Sans', sans-serif",
                                size: 11
                            }
                        }
                    },
                    y: {
                        min: 0,
                        max: Math.ceil(maxDrawdown * 1.1),
                        reverse: true,
                        grid: {
                            color: colors.gridColor
                        },
                        border: {
                            dash: [4, 4]
                        },
                        ticks: {
                            color: colors.textSecondary,
                            callback: function(value) {
                                return value + '%';
                            },
                            font: {
                                family: "'Roboto Mono', monospace",
                                size: 11
                            }
                        }
                    }
                },
                elements: {
                    line: {
                        borderJoinStyle: 'round'
                    }
                }
            }
        });
    }
    
    /**
     * Render P&L distribution histogram
     */
    function renderPLDistribution() {
        const container = document.getElementById('pl-distribution-chart');
        if (!container) return;
        
        const { bins, counts } = TradeCore.getPLDistributionData();
        
        if (bins.length === 0) {
            container.innerHTML = '<div class="no-data-message">No closed trades available for P&L distribution</div>';
            return;
        }
        
        // Clear previous chart if it exists
        if (plDistributionChart) {
            plDistributionChart.destroy();
        }
        
        // Use the bin labels directly from the data
        const binLabels = bins;
        
        // Prepare color array based on whether bin represents positive or negative range
        const colors = bins.map(bin => {
            // Check if this bin is for negative returns
            return bin.includes('-') && !bin.startsWith('-0.0%') ? 'rgba(239, 68, 68, 0.7)' : 'rgba(34, 197, 94, 0.7)';
        });
        const borderColors = colors.map(color => 
            color.includes('239, 68, 68') ? 'rgb(220, 38, 38)' : 'rgb(22, 163, 74)'
        );
        
        // Create chart
        const ctx = container.getContext('2d');
        plDistributionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: binLabels,
                datasets: [{
                    label: 'Number of Trades',
                    data: counts,
                    backgroundColor: colors,
                    borderColor: borderColors,
                    borderWidth: 1
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
                            title: function(tooltipItems) {
                                return tooltipItems[0].label;
                            },
                            label: function(context) {
                                return `Trades: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Return Range (%)'
                        },
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            font: {
                                size: 10
                            }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Number of Trades'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            stepSize: 1,
                            precision: 0
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Render win/loss pie chart with gold accent colors
     */
    function renderWinLossPieChart() {
        const container = document.getElementById('win-loss-pie-chart');
        if (!container) return;

        const data = TradeCore.getWinLossPieChartData();

        if (data.data.length === 0 || data.data.every(d => d === 0)) {
            container.innerHTML = '<div class="no-data-message">No closed trades available for win/loss breakdown</div>';
            return;
        }

        // Clear previous chart if it exists
        if (winLossPieChart) {
            winLossPieChart.destroy();
        }

        // Get theme colors
        const colors = getThemeColors();

        // Use gold for wins, red for losses, no gray
        const customColors = [
            colors.success,         // Green for winning trades
            colors.error,           // Red for losing trades
            colors.primaryLight     // Gold for breakeven (if any) instead of gray
        ];

        // Create chart
        const ctx = container.getContext('2d');
        winLossPieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.data,
                    backgroundColor: customColors,
                    borderColor: colors.bgSecondary,
                    borderWidth: 2,
                    borderRadius: 4,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                layout: {
                    padding: 15
                },
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            color: colors.textPrimary,
                            font: {
                                family: "'Exo 2', sans-serif",
                                size: 13,
                                weight: 'bold'
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: colors.tooltipBg,
                        titleColor: colors.tooltipText,
                        bodyColor: colors.tooltipText,
                        borderColor: colors.tooltipBorder,
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: {
                            family: "'Work Sans', sans-serif",
                            weight: '600',
                            size: 13
                        },
                        bodyFont: {
                            family: "'Roboto Mono', monospace",
                            weight: '500',
                            size: 12
                        },
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${context.label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                },
                animation: {
                    animateRotate: true,
                    animateScale: true
                }
            }
        });

        // Add centered text showing win rate percentage if there's enough space
        if (container.clientWidth > 300 && container.clientHeight > 300) {
            // Calculate win rate
            const winIndex = data.labels.findIndex(label => label.includes('Win'));
            const totalTrades = data.data.reduce((a, b) => a + b, 0);
            const winRate = winIndex >= 0 ? Math.round((data.data[winIndex] / totalTrades) * 100) : 0;

            // Create and add center text
            const centerTextPlugin = {
                id: 'centerText',
                afterDraw: function(chart) {
                    const width = chart.width;
                    const height = chart.height;
                    const ctx = chart.ctx;
                    const themeColors = getThemeColors();

                    ctx.restore();

                    // Win Rate Text
                    ctx.font = "bold 18px 'Roboto Mono', monospace";
                    ctx.fillStyle = themeColors.primary;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(`${winRate}%`, width / 2, height / 2 - 10);

                    // Label Text
                    ctx.font = "12px 'Work Sans', sans-serif";
                    ctx.fillStyle = themeColors.textSecondary;
                    ctx.fillText('Win Rate', width / 2, height / 2 + 14);

                    ctx.save();
                }
            };

            // Add plugin
            Chart.register(centerTextPlugin);
        }
    }
    
    /**
     * Render monthly performance chart with gold trade count line
     */
    function renderMonthlyPerformance() {
        const container = document.getElementById('monthly-performance-chart');
        if (!container) return;

        const data = TradeCore.getMonthlyPerformanceData();

        if (data.length === 0) {
            container.innerHTML = '<div class="no-data-message">No closed trades available for monthly performance</div>';
            return;
        }

        // Clear previous chart if it exists
        if (monthlyPerformanceChart) {
            monthlyPerformanceChart.destroy();
        }

        // Get theme colors
        const colors = getThemeColors();

        // Prepare data
        const labels = data.map(d => `${d.monthName} ${d.year}`);
        const performanceData = data.map(d => d.totalPL);
        const tradeCountData = data.map(d => d.trades);

        // Calculate min/max for better y-axis scaling
        const maxValue = Math.max(...performanceData, 5);
        const minValue = Math.min(...performanceData, -5);
        const absMax = Math.max(Math.abs(minValue), Math.abs(maxValue));

        // Create improved colors for bars
        const barColors = performanceData.map(val => {
            if (val > 0) {
                // Green gradient for positive values
                const intensity = Math.min(0.9, 0.4 + (val / maxValue) * 0.5);
                return `rgba(34, 197, 94, ${intensity})`;
            } else {
                // Red gradient for negative values
                const intensity = Math.min(0.9, 0.4 + (Math.abs(val) / Math.abs(minValue)) * 0.5);
                return `rgba(220, 38, 38, ${intensity})`;
            }
        });

        // Create chart
        const ctx = container.getContext('2d');
        monthlyPerformanceChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Monthly P&L (%)',
                    data: performanceData,
                    backgroundColor: barColors,
                    borderColor: barColors.map(c => c.replace(/[0-9].[0-9]/, '1')),
                    borderWidth: 1,
                    borderRadius: 4,
                    maxBarThickness: 40
                }, {
                    label: 'Trade Count',
                    data: tradeCountData,
                    type: 'line',
                    yAxisID: 'y1',
                    borderColor: colors.primary,
                    backgroundColor: colors.primaryVeryLight,
                    borderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: colors.pointBg,
                    pointBorderColor: colors.pointBorder,
                    pointBorderWidth: 2,
                    tension: 0.2,
                    order: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            color: colors.textPrimary,
                            font: {
                                family: "'Exo 2', sans-serif",
                                weight: 'bold',
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: colors.tooltipBg,
                        titleColor: colors.tooltipText,
                        bodyColor: colors.tooltipText,
                        borderColor: colors.tooltipBorder,
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: {
                            family: "'Work Sans', sans-serif",
                            weight: '600',
                            size: 13
                        },
                        bodyFont: {
                            family: "'Roboto Mono', monospace",
                            weight: '500',
                            size: 12
                        },
                        callbacks: {
                            label: function(context) {
                                if (context.dataset.label === 'Monthly P&L (%)') {
                                    const value = context.parsed.y;
                                    return value !== null && value !== undefined 
                                        ? `P&L: ${value.toFixed(2)}%` 
                                        : 'P&L: N/A';
                                } else if (context.dataset.label === 'Trade Count') {
                                    const value = context.parsed.y;
                                    return value !== null && value !== undefined 
                                        ? `Trades: ${value}` 
                                        : 'Trades: N/A';
                                }
                            },
                            afterBody: function(tooltipItems) {
                                if (!tooltipItems || tooltipItems.length === 0) return [];
                                const dataIndex = tooltipItems[0].dataIndex;
                                const monthData = data[dataIndex];
                                if (!monthData || monthData.winRate === null || monthData.winRate === undefined) {
                                    return ['Win Rate: N/A'];
                                }
                                return [`Win Rate: ${monthData.winRate.toFixed(2)}%`];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: colors.textSecondary,
                            maxRotation: 45,
                            minRotation: 45,
                            font: {
                                family: "'Work Sans', sans-serif",
                                size: 11
                            }
                        }
                    },
                    y: {
                        position: 'left',
                        title: {
                            display: true,
                            text: 'P&L (%)',
                            color: colors.textPrimary,
                            font: {
                                family: "'Exo 2', sans-serif",
                                weight: 'bold',
                                size: 12
                            }
                        },
                        min: -Math.ceil(absMax * 1.1),
                        max: Math.ceil(absMax * 1.1),
                        grid: {
                            color: colors.gridColor
                        },
                        border: {
                            dash: [4, 4]
                        },
                        ticks: {
                            color: colors.textSecondary,
                            callback: function(value) {
                                return value + '%';
                            },
                            font: {
                                family: "'Roboto Mono', monospace",
                                size: 11
                            }
                        },
                        // Add a zero line
                        afterFit: function(scaleInstance) {
                            scaleInstance.chart.ctx.save();
                            const yScale = scaleInstance;
                            const ctx = scaleInstance.chart.ctx;
                            const zeroLineY = yScale.getPixelForValue(0);
                            
                            ctx.beginPath();
                            ctx.moveTo(yScale.left, zeroLineY);
                            ctx.lineTo(yScale.right, zeroLineY);
                            ctx.lineWidth = 2;
                            ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
                            ctx.stroke();
                            ctx.restore();
                        }
                    },
                    y1: {
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Trade Count',
                            color: colors.textPrimary,
                            font: {
                                family: "'Exo 2', sans-serif",
                                weight: 'bold',
                                size: 12
                            }
                        },
                        min: 0,
                        suggestedMax: Math.max(...tradeCountData) * 1.2,
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            color: colors.textSecondary,
                            stepSize: 1,
                            precision: 0,
                            font: {
                                family: "'Roboto Mono', monospace",
                                size: 11
                            }
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Render market comparison chart with gold win rate line
     */
    function renderMarketComparison() {
        const container = document.getElementById('market-comparison-chart');
        if (!container) return;

        const data = TradeCore.getPerformanceByMarket();

        if (data.length === 0) {
            container.innerHTML = '<div class="no-data-message">No closed trades available for market comparison</div>';
            return;
        }

        // Clear previous chart if it exists
        if (marketComparisonChart) {
            marketComparisonChart.destroy();
        }

        // Get theme colors
        const colors = getThemeColors();

        // Prepare data
        const labels = data.map(d => d.name);
        const plData = data.map(d => d.avgPL);
        const tradeCountData = data.map(d => d.trades);
        const winRateData = data.map(d => d.winRate);

        // Calculate the max/min values for better scaling
        const maxPL = Math.max(...plData, 5);
        const minPL = Math.min(...plData, -5);
        const absMaxPL = Math.max(Math.abs(maxPL), Math.abs(minPL));

        // Create improved gradient colors based on performance
        const barColors = plData.map(pl => {
            if (pl >= 0) {
                // Green gradient for positive values
                const intensity = Math.min(0.9, 0.5 + (pl / maxPL) * 0.4);
                return `rgba(34, 197, 94, ${intensity})`;
            } else {
                // Red gradient for negative values
                const intensity = Math.min(0.9, 0.5 + (Math.abs(pl) / Math.abs(minPL)) * 0.4);
                return `rgba(220, 38, 38, ${intensity})`;
            }
        });

        // Create chart
        const ctx = container.getContext('2d');
        marketComparisonChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Average P&L (%)',
                        data: plData,
                        backgroundColor: barColors,
                        borderColor: barColors.map(c => c.replace(/[0-9].[0-9]/, '1')),
                        borderWidth: 1,
                        borderRadius: 4,
                        yAxisID: 'y',
                        maxBarThickness: 40
                    },
                    {
                        label: 'Win Rate (%)',
                        data: winRateData,
                        type: 'line',
                        borderColor: colors.primary,
                        backgroundColor: colors.primaryVeryLight,
                        borderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointBackgroundColor: colors.pointBg,
                        pointBorderColor: colors.pointBorder,
                        pointBorderWidth: 2,
                        tension: 0.2,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Trade Count',
                        data: tradeCountData,
                        type: 'bar',
                        backgroundColor: 'rgba(168, 162, 158, 0.2)',
                        borderColor: 'rgba(168, 162, 158, 0.8)',
                        borderWidth: 1,
                        borderRadius: 4,
                        yAxisID: 'y2',
                        maxBarThickness: 15,
                        barPercentage: 0.4,
                        categoryPercentage: 0.5,
                        hidden: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            color: colors.textPrimary,
                            font: {
                                family: "'Exo 2', sans-serif",
                                weight: 'bold',
                                size: 12
                            }
                        },
                        onClick: function(e, legendItem, legend) {
                            const index = legendItem.datasetIndex;
                            const chart = legend.chart;

                            if (index === 1) {
                                // Toggle trade count visibility when clicking on win rate
                                const isTradeCountVisible = chart.isDatasetVisible(2);
                                chart.setDatasetVisibility(2, !isTradeCountVisible);
                                chart.update();
                            } else {
                                // Normal legend toggle behavior for other items
                                const meta = chart.getDatasetMeta(index);
                                meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null;
                                chart.update();
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: colors.tooltipBg,
                        titleColor: colors.tooltipText,
                        bodyColor: colors.tooltipText,
                        borderColor: colors.tooltipBorder,
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: {
                            family: "'Work Sans', sans-serif",
                            weight: '600',
                            size: 13
                        },
                        bodyFont: {
                            family: "'Roboto Mono', monospace",
                            weight: '500',
                            size: 12
                        },
                        callbacks: {
                            label: function(context) {
                                const datasetLabel = context.dataset.label;
                                const value = context.parsed.y;
                                
                                if (datasetLabel === 'Average P&L (%)') {
                                    return `Avg P&L: ${value.toFixed(2)}%`;
                                } else if (datasetLabel === 'Win Rate (%)') {
                                    return `Win Rate: ${value.toFixed(2)}%`;
                                } else if (datasetLabel === 'Trade Count') {
                                    return `Trades: ${value}`;
                                }
                                
                                return `${datasetLabel}: ${value}`;
                            },
                            afterBody: function(tooltipItems) {
                                const dataIndex = tooltipItems[0].dataIndex;
                                const marketData = data[dataIndex];
                                return [`Total Trades: ${marketData.trades}`, `Total P/L: ${marketData.totalPL.toFixed(2)}`];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: 11,
                                weight: 'bold'
                            }
                        }
                    },
                    y: {
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Average P&L (%)',
                            font: {
                                weight: 'bold',
                                size: 12
                            }
                        },
                        min: -Math.ceil(absMaxPL * 1.1),
                        max: Math.ceil(absMaxPL * 1.1),
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        border: {
                            dash: [4, 4]
                        },
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            },
                            font: {
                                size: 11
                            }
                        },
                        // Add a zero line
                        afterFit: function(scaleInstance) {
                            scaleInstance.chart.ctx.save();
                            const yScale = scaleInstance;
                            const ctx = scaleInstance.chart.ctx;
                            const zeroLineY = yScale.getPixelForValue(0);
                            
                            ctx.beginPath();
                            ctx.moveTo(yScale.left, zeroLineY);
                            ctx.lineTo(yScale.right, zeroLineY);
                            ctx.lineWidth = 2;
                            ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
                            ctx.stroke();
                            ctx.restore();
                        }
                    },
                    y1: {
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Win Rate (%)',
                            font: {
                                weight: 'bold',
                                size: 12
                            }
                        },
                        min: 0,
                        max: 100,
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            },
                            font: {
                                size: 11
                            }
                        }
                    },
                    y2: {
                        position: 'right',
                        title: {
                            display: false
                        },
                        min: 0,
                        grid: {
                            drawOnChartArea: false,
                            drawTicks: false,
                            drawBorder: false
                        },
                        ticks: {
                            display: false
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Render trade size vs return chart with gold win rate line
     */
    function renderTradeSizeVsReturn() {
        const container = document.getElementById('size-vs-return-chart');
        if (!container) return;

        const data = TradeCore.getTradeSizeVsReturnData();

        if (data.length === 0) {
            container.innerHTML = '<div class="no-data-message">No closed trades available for size vs return analysis</div>';
            return;
        }

        // Clear previous chart if it exists
        if (sizeVsReturnChart) {
            sizeVsReturnChart.destroy();
        }

        // Get theme colors
        const colors = getThemeColors();
        
        // Group trades by investment size buckets
        const buckets = {
            'Small (<$2.5k)': { range: [0, 2500], trades: [], totalReturn: 0, avgReturn: 0, wins: 0, losses: 0 },
            'Medium ($2.5k-$5k)': { range: [2500, 5000], trades: [], totalReturn: 0, avgReturn: 0, wins: 0, losses: 0 },
            'Large ($5k-$10k)': { range: [5000, 10000], trades: [], totalReturn: 0, avgReturn: 0, wins: 0, losses: 0 },
            'Extra Large (>$10k)': { range: [10000, Infinity], trades: [], totalReturn: 0, avgReturn: 0, wins: 0, losses: 0 }
        };
        
        // Categorize trades into buckets
        data.forEach(trade => {
            for (const [bucketName, bucket] of Object.entries(buckets)) {
                if (trade.size >= bucket.range[0] && trade.size < bucket.range[1]) {
                    bucket.trades.push(trade);
                    bucket.totalReturn += trade.return;
                    if (trade.return > 0) bucket.wins++;
                    else if (trade.return < 0) bucket.losses++;
                    break;
                }
            }
        });
        
        // Calculate averages and prepare chart data
        const labels = [];
        const avgReturns = [];
        const tradeCounts = [];
        const winRates = [];
        const barColors = [];

        Object.entries(buckets).forEach(([bucketName, bucket]) => {
            if (bucket.trades.length > 0) {
                labels.push(bucketName);
                bucket.avgReturn = bucket.totalReturn / bucket.trades.length;
                avgReturns.push(bucket.avgReturn);
                tradeCounts.push(bucket.trades.length);
                winRates.push((bucket.wins / bucket.trades.length) * 100);

                // Color based on average return
                if (bucket.avgReturn > 0) {
                    barColors.push(colors.successLight);
                } else {
                    barColors.push(colors.errorLight);
                }
            }
        });

        // Create the bar chart
        const ctx = container.getContext('2d');
        sizeVsReturnChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Average Return (%)',
                    data: avgReturns,
                    backgroundColor: barColors,
                    borderColor: barColors.map(c => c.replace('0.7', '1')),
                    borderWidth: 2,
                    borderRadius: 6,
                    yAxisID: 'y'
                }, {
                    label: 'Win Rate (%)',
                    data: winRates,
                    type: 'line',
                    borderColor: colors.primary,
                    backgroundColor: colors.primaryVeryLight,
                    borderWidth: 3,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointBackgroundColor: colors.pointBg,
                    pointBorderColor: colors.pointBorder,
                    pointBorderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'y1',
                    order: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            color: colors.textPrimary,
                            font: {
                                family: "'Exo 2', sans-serif",
                                weight: 'bold',
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: colors.tooltipBg,
                        titleColor: colors.tooltipText,
                        bodyColor: colors.tooltipText,
                        borderColor: colors.tooltipBorder,
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: {
                            family: "'Work Sans', sans-serif",
                            weight: '600',
                            size: 13
                        },
                        bodyFont: {
                            family: "'Roboto Mono', monospace",
                            weight: '500',
                            size: 12
                        },
                        callbacks: {
                            afterTitle: function(tooltipItems) {
                                const index = tooltipItems[0].dataIndex;
                                return `${tradeCounts[index]} trades in this range`;
                            },
                            label: function(context) {
                                if (context.dataset.label === 'Average Return (%)') {
                                    const value = context.parsed.y;
                                    return value !== null && value !== undefined 
                                        ? `Avg Return: ${value.toFixed(2)}%` 
                                        : 'Avg Return: N/A';
                                } else if (context.dataset.label === 'Win Rate (%)') {
                                    const value = context.parsed.y;
                                    return value !== null && value !== undefined 
                                        ? `Win Rate: ${value.toFixed(1)}%` 
                                        : 'Win Rate: N/A';
                                }
                            },
                            afterBody: function(tooltipItems) {
                                const index = tooltipItems[0].dataIndex;
                                const bucketName = labels[index];
                                const bucket = Object.values(buckets).find(b => 
                                    bucketName.includes(Object.keys(buckets).find(k => buckets[k] === b))
                                );
                                
                                if (bucket && bucket.trades.length > 0) {
                                    return [
                                        `Wins: ${bucket.wins}`,
                                        `Losses: ${bucket.losses}`,
                                        `Best: ${Math.max(...bucket.trades.map(t => t.return)).toFixed(2)}%`,
                                        `Worst: ${Math.min(...bucket.trades.map(t => t.return)).toFixed(2)}%`
                                    ];
                                }
                                return [];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Average Return (%)',
                            font: {
                                weight: 'bold',
                                size: 12
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Win Rate (%)',
                            font: {
                                weight: 'bold',
                                size: 12
                            }
                        },
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        min: 0,
                        max: 100
                    }
                }
            }
        });
    }
    
    /**
     * Render holding period analysis chart with gold win rate line
     */
    function renderHoldingPeriodAnalysis() {
        const container = document.getElementById('holding-period-chart');
        if (!container) return;

        const holdingStats = TradeCore.getHoldingPeriodStats();

        // Check if we have data
        const hasData = holdingStats.shortTerm.count > 0 ||
                         holdingStats.mediumTerm.count > 0 ||
                         holdingStats.longTerm.count > 0;

        if (!hasData) {
            container.innerHTML = '<div class="no-data-message">No closed trades available for holding period analysis</div>';
            return;
        }

        // Clear previous chart if it exists
        if (holdingTimeChart) {
            holdingTimeChart.destroy();
        }

        // Get theme colors
        const colors = getThemeColors();

        // Prepare data
        const labels = ['Short Term (0-10 days)', 'Medium Term (11-20 days)', 'Long Term (21+ days)'];
        const countData = [
            holdingStats.shortTerm.count,
            holdingStats.mediumTerm.count,
            holdingStats.longTerm.count
        ];
        const plData = [
            holdingStats.shortTerm.avgPLPercent || 0,
            holdingStats.mediumTerm.avgPLPercent || 0,
            holdingStats.longTerm.avgPLPercent || 0
        ];
        const winRateData = [
            holdingStats.shortTerm.winRate,
            holdingStats.mediumTerm.winRate,
            holdingStats.longTerm.winRate
        ];

        // Create bar colors based on P&L values
        const barColors = plData.map(pl => pl >= 0 ? colors.successLight : colors.errorLight);

        // Create chart
        const ctx = container.getContext('2d');
        holdingTimeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Average P&L (%)',
                        data: plData,
                        backgroundColor: barColors,
                        borderColor: barColors.map(c => c.replace('0.7', '1')),
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Win Rate (%)',
                        data: winRateData,
                        type: 'line',
                        borderColor: colors.primary,
                        backgroundColor: colors.primaryVeryLight,
                        borderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointBackgroundColor: colors.pointBg,
                        pointBorderColor: colors.pointBorder,
                        pointBorderWidth: 2,
                        fill: false,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: colors.textPrimary,
                            font: {
                                family: "'Exo 2', sans-serif",
                                weight: 'bold',
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: colors.tooltipBg,
                        titleColor: colors.tooltipText,
                        bodyColor: colors.tooltipText,
                        borderColor: colors.tooltipBorder,
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: {
                            family: "'Work Sans', sans-serif",
                            weight: '600',
                            size: 13
                        },
                        bodyFont: {
                            family: "'Roboto Mono', monospace",
                            weight: '500',
                            size: 12
                        },
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed.y;
                                const datasetIndex = context.datasetIndex;

                                if (datasetIndex === 0) {
                                    return `Average P&L: ${value.toFixed(2)}%`;
                                } else if (datasetIndex === 1) {
                                    return `Win Rate: ${value.toFixed(2)}%`;
                                }

                                return `${context.dataset.label}: ${value}`;
                            },
                            afterBody: function(tooltipItems) {
                                const dataIndex = tooltipItems[0].dataIndex;
                                return [`Trade Count: ${countData[dataIndex]}`];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: colors.textSecondary,
                            font: {
                                family: "'Work Sans', sans-serif",
                                size: 11
                            }
                        }
                    },
                    y: {
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Average P&L (%)',
                            color: colors.textPrimary,
                            font: {
                                family: "'Exo 2', sans-serif",
                                weight: 'bold',
                                size: 12
                            }
                        },
                        grid: {
                            color: colors.gridColor
                        },
                        ticks: {
                            color: colors.textSecondary,
                            callback: function(value) {
                                return value + '%';
                            },
                            font: {
                                family: "'Roboto Mono', monospace",
                                size: 11
                            }
                        }
                    },
                    y1: {
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Win Rate (%)',
                            color: colors.textPrimary,
                            font: {
                                family: "'Exo 2', sans-serif",
                                weight: 'bold',
                                size: 12
                            }
                        },
                        min: 0,
                        max: 100,
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            color: colors.textSecondary,
                            callback: function(value) {
                                return value + '%';
                            },
                            font: {
                                family: "'Roboto Mono', monospace",
                                size: 11
                            }
                        }
                    }
                }
            }
        });
    }

    // Return public API
    return {
        init,
        renderAllCharts,
        renderEquityCurve,
        renderDrawdownChart,
        renderPLDistribution,
        renderWinLossPieChart,
        renderMonthlyPerformance,
        renderMarketComparison,
        renderTradeSizeVsReturn,
        renderHoldingPeriodAnalysis
    };
})();