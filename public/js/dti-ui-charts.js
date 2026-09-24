/**
 * DTI Backtester - UI Charts Module
 * Handles chart creation, updates, and interactions
 */

// Create Charts namespace
DTIUI.Charts = (function() {
    // Add debounce timer and flag to prevent concurrent operations
    let chartCreationTimer = null;
    let isCreatingCharts = false;

    // Fills under the lines: one theme colour fading towards the axis, as [offset, alpha] stops
    const PRICE_FADE = [[0, 0.01], [0.3, 0.1], [0.6, 0.18], [1, 0.25]];
    const DTI_FADE = [[0, 0], [0.5, 0.08], [1, 0.15]];

    function fadeFill(gradient, color, stops) {
        stops.forEach(([offset, opacity]) => gradient.addColorStop(offset, window.ChartTheme.withAlpha(color, opacity)));
        return gradient;
    }

    /**
     * Create and update charts with enhanced interactive features
     * @param {Array} dates - Array of date strings
     * @param {Array} prices - Array of price values
     * @param {Array} dti - Array of DTI values
     * @param {Object} sevenDayDTIData - Object containing 7-day DTI data
     * @param {Object} ohlcData - Object containing open, high, low arrays (optional)
     */
    function createCharts(dates, prices, dti, sevenDayDTIData, ohlcData = null) {
        // Prevent concurrent chart creation
        if (isCreatingCharts) {
            console.log('[CHART FIX] Chart creation already in progress, queuing...');
            // Cancel previous timer if exists
            if (chartCreationTimer) {
                clearTimeout(chartCreationTimer);
            }
            // Debounce: wait 300ms before creating charts
            chartCreationTimer = setTimeout(() => {
                createCharts(dates, prices, dti, sevenDayDTIData, ohlcData);
            }, 300);
            return;
        }

        isCreatingCharts = true;
        console.log('[CHART FIX] Starting chart creation...');

        try {
            // Enhanced cleanup: destroy all existing charts
            console.log('[CHART FIX] Destroying existing charts...');
            if (DTIBacktester.priceChart) {
                DTIBacktester.priceChart.destroy();
                DTIBacktester.priceChart = null;
            }
            if (DTIBacktester.dtiChart) {
                DTIBacktester.dtiChart.destroy();
                DTIBacktester.dtiChart = null;
            }
            if (DTIBacktester.sevenDayDTIChart) {
                DTIBacktester.sevenDayDTIChart.destroy();
                DTIBacktester.sevenDayDTIChart = null;
            }

            // Clear any existing Chart instances on the canvases
            const priceCanvas = document.getElementById('price-chart');
            const dtiCanvas = document.getElementById('dti-chart');
            const weeklyCanvas = document.getElementById('weekly-dti-chart');

            if (priceCanvas) {
                const existingChart = Chart.getChart(priceCanvas);
                if (existingChart) existingChart.destroy();
            }
            if (dtiCanvas) {
                const existingChart = Chart.getChart(dtiCanvas);
                if (existingChart) existingChart.destroy();
            }
            if (weeklyCanvas) {
                const existingChart = Chart.getChart(weeklyCanvas);
                if (existingChart) existingChart.destroy();
            }

            // Enhanced cleanup: remove all chart wrappers, export buttons, and controls
            console.log('[CHART FIX] Cleaning up chart wrappers and buttons...');
            cleanupChartElements();
        } catch (error) {
            console.error('[CHART FIX] Error during chart cleanup:', error);
        } finally {
            // Continue with chart creation regardless of cleanup errors
            createChartsInternal(dates, prices, dti, sevenDayDTIData, ohlcData);
        }
    }

    /**
     * Enhanced cleanup function to remove all chart-related elements
     */
    function cleanupChartElements() {
        // Get all chart containers
        const chartIds = ['price-chart', 'dti-chart', 'weekly-dti-chart'];

        chartIds.forEach(chartId => {
            const canvas = document.getElementById(chartId);
            if (!canvas) return;

            // Unwrap canvas from chart-wrapper if it exists (chart wrappers no longer used for export buttons)
            const wrapper = canvas.closest('.chart-wrapper');
            if (wrapper) {
                const parent = wrapper.parentNode;
                if (parent) {
                    parent.insertBefore(canvas, wrapper);
                    wrapper.remove();
                    console.log(`[CHART FIX] Unwrapped ${chartId} from chart-wrapper`);
                }
            }
        });

        // Remove duplicate chart controls
        const controlsContainers = document.querySelectorAll('.chart-controls-container');
        if (controlsContainers.length > 1) {
            console.log(`[CHART FIX] Found ${controlsContainers.length} chart controls, keeping only one`);
            // Keep the first one, remove others
            for (let i = 1; i < controlsContainers.length; i++) {
                controlsContainers[i].remove();
            }
        }

        // Remove chart type toggle buttons from the DOM (they'll be recreated)
        const existingToggles = document.querySelectorAll('.chart-type-toggle');
        existingToggles.forEach(toggle => {
            toggle.remove();
            console.log('[CHART FIX] Removed existing chart type toggle');
        });
    }

    /**
     * Internal chart creation logic (separated for better error handling)
     */
    function createChartsInternal(dates, prices, dti, sevenDayDTIData, ohlcData) {
        try {

        // Check if Chart.js library is loaded
        if (typeof Chart === 'undefined') {
            console.error('[CHART ERROR] Chart.js library not loaded');
            DTIBacktester.utils.showNotification('Chart library not loaded. Please refresh the page.', 'error');
            return;
        }

        console.log('[CHART FIX] Starting chart creation');
        console.log('[CHART FIX] Chart.js version:', Chart.version);

        // Every colour comes from the page's theme (chart-theme.js): the axes, grid, legends
        // and tooltips through Chart.defaults, the series from these tokens. They are read at
        // each build, so the Line/Candlestick switch and every reopen follow a theme change.
        const colors = window.ChartTheme.colors();
        const alpha = window.ChartTheme.withAlpha;

        const daily7DayDTI = sevenDayDTIData.daily7DayDTI;
        
        // Get trades for chart markers
        const enable7DayDTI = true; // Always enabled
        
        // Validate data arrays have same length
        if (dates.length !== prices.length || dates.length !== dti.length) {
            // Truncate to minimum length to avoid errors
            const minLength = Math.min(dates.length, prices.length, dti.length);
            dates = dates.slice(0, minLength);
            prices = prices.slice(0, minLength);
            dti = dti.slice(0, minLength);
            if (ohlcData) {
                ohlcData.open = ohlcData.open.slice(0, minLength);
                ohlcData.high = ohlcData.high.slice(0, minLength);
                ohlcData.low = ohlcData.low.slice(0, minLength);
            }
        }
        
        let trades = [];
        let entryMarkers = [];
        let exitMarkers = [];
        let activeEntryMarkers = [];
        let tradeConnections = [];
        let tradeProfitLoss = [];
        let tradeMetadata = {};
        
        // Try to run backtest, but continue if it fails
        try {
            trades = DTIBacktest.backtest(dates, prices, dti, sevenDayDTIData);
            
            // Generate trade markers and metadata
            const markers = DTIBacktest.generateTradeMarkers(dates, prices, trades);
            entryMarkers = markers.entryMarkers;
            exitMarkers = markers.exitMarkers;
            activeEntryMarkers = markers.activeEntryMarkers;
            tradeConnections = markers.tradeConnections;
            tradeProfitLoss = markers.tradeProfitLoss;
            tradeMetadata = markers.tradeMetadata;
        } catch (error) {
        }
        
        // Create horizontal line at zero for DTI and entry threshold line
        const zeroLine = Array(dates.length).fill(0);
        const entryThresholdLine = Array(dates.length).fill(parseFloat(document.getElementById('entry-threshold').value));

        // Get warm-up period info from DTIBacktest module (which calculates it during backtest)
        const warmupInfo = DTIBacktest.warmupInfo || { enabled: false, startDate: null, endDate: null };

        // Calculate price percentage changes to enhance visualization
        const pricePercentageChange = prices.map((price, i) => {
            if (i === 0) return 0;
            return ((price - prices[i-1]) / prices[i-1]) * 100;
        });
        
        // Store trade data globally for click interactions
        DTIBacktester.tradeData = trades;
        
        // Store complete chart data for toggle recreation
        DTIBacktester.chartData = {
            dates,
            prices,
            dti,
            sevenDayDTIData,
            ohlcData
        };
        
        // Initialize default chart type if not set — candlestick everywhere.
        // createCharts falls back to line automatically when OHLC is missing,
        // so this default is safe on every surface.
        if (!DTIBacktester.chartType) {
            DTIBacktester.chartType = 'candlestick';
        }

        // Add chart type toggle button
        setTimeout(() => {
            addChartTypeToggle();
        }, 100);
        
        // Each chart's own annotation list, starting with the warm-up box. One list shared
        // by the three charts put a note pinned to the price chart on the DTI charts too,
        // at its price
        const chartAnnotations = () => ({
            annotations: (warmupInfo && warmupInfo.enabled && warmupInfo.endDate) ? {
                warmupBox: {
                    type: 'box',
                    xMin: 0,
                    xMax: dates.findIndex(d => new Date(d) >= warmupInfo.endDate),
                    backgroundColor: alpha(colors.muted, 0.12),
                    borderColor: alpha(colors.muted, 0.5),
                    borderWidth: 1,
                    borderDash: [4, 4],
                    label: {
                        display: true,
                        content: 'Warm-up Period (6 months)',
                        position: 'start',
                        // A box's label has no background of its own (the plugin
                        // forces it transparent): the text sits on the chart
                        color: colors.textColor,
                        padding: 6,
                        font: {
                            size: 11,
                            weight: 'bold'
                        }
                    }
                }
            } : {}
        });

        // Common chart options with enhanced styling and interactive features
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            devicePixelRatio: window.devicePixelRatio || 1,
            elements: {
                line: {
                    tension: 0.3, // Smoother curves
                    borderWidth: window.innerWidth <= 768 ? 1.5 : 2.5 // Thinner lines on mobile
                },
                point: {
                    radius: 0,
                    hitRadius: window.innerWidth <= 768 ? 8 : 10,
                    hoverRadius: window.innerWidth <= 768 ? 3 : 5
                }
            },
            scales: {
                x: {
                    type: 'category',
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        maxTicksLimit: window.innerWidth <= 768 ? 6 : 10,
                        maxRotation: 0,
                        font: {
                            size: window.innerWidth <= 768 ? 8 : 10,
                            weight: '500'
                        },
                        autoSkip: true,
                        autoSkipPadding: window.innerWidth <= 768 ? 20 : 10
                    }
                },
                y: {
                    type: 'linear',
                    position: 'left',
                    grid: {
                        drawBorder: false,
                        lineWidth: 1
                    },
                    border: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: window.innerWidth <= 768 ? 8 : 10,
                            weight: '500'
                        },
                        padding: window.innerWidth <= 768 ? 4 : 8,
                        maxTicksLimit: window.innerWidth <= 768 ? 6 : 8
                    }
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                // Zoom plugin configuration
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x',
                        modifierKey: 'shift',
                        threshold: 10
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                            modifierKey: 'ctrl'
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x',
                        drag: {
                            enabled: true,
                            backgroundColor: alpha(colors.accent, 0.2),
                            borderColor: alpha(colors.accent, 0.4),
                            borderWidth: 1
                        }
                    },
                    limits: {
                        x: {min: 'original', max: 'original'}
                    }
                },
                tooltip: {
                    enabled: true,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    padding: 12,
                    cornerRadius: 6,
                    displayColors: true,
                    borderWidth: 1,
                    boxPadding: 5,
                    usePointStyle: true,
                    callbacks: {
                        title: function(tooltipItems) {
                            const date = new Date(tooltipItems[0].label);
                            if (window.DateFormatter) return window.DateFormatter.format(date);
                            return date.toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                            });
                        },
                        label: function(context) {
                            const index = context.dataIndex;
                            const datasetIndex = context.datasetIndex;
                            
                            // If this is an entry or exit point
                            if (datasetIndex === 1 || datasetIndex === 2) {
                                const tradeData = tradeMetadata[index];
                                if (!tradeData) return '';
                                
                                // Get currency symbol based on current index
                                const currencySymbol = getCurrencySymbolForDisplay(DTIBacktester.currentStockIndex);
                                
                                if (tradeData.type === 'entry') {
                                    return [
                                        `Entry: ${formatChartPrice(tradeData.price)}`,
                                        `Date: ${DTIBacktester.utils.formatDate(tradeData.date)}`,
                                        `Holding Period: ${tradeData.holdingDays} days`,
                                        `Result: ${tradeData.plPercent.toFixed(2)}%`,
                                        ``, // Empty line for spacing
                                        `Click for details`
                                    ];
                                } else {
                                    return [
                                        `Exit: ${formatChartPrice(tradeData.price)}`,
                                        `Date: ${DTIBacktester.utils.formatDate(tradeData.date)}`,
                                        `Exit Reason: ${tradeData.exitReason}`,
                                        `P/L: ${tradeData.plPercent.toFixed(2)}%`,
                                        ``,
                                        `Click for details`
                                    ];
                                }
                            }
                            
                            // Enhanced tooltips for regular data points
                            const label = context.dataset.label || '';
                            const value = context.parsed.y;
                            const raw = context.raw;
                            
                            if (label === 'Price') {
                                // Get currency symbol
                                const currencySymbol = getCurrencySymbolForDisplay(DTIBacktester.currentStockIndex);
                                
                                // Check if this is candlestick data (bar chart with y array)
                                if (raw && typeof raw === 'object' && Array.isArray(raw.y)) {
                                    // This is a wick dataset, skip detailed tooltip
                                    if (label === 'Wick' || label === 'High Wick' || label === 'Low Wick') {
                                        return null;
                                    }
                                    
                                    // Find the corresponding candle data
                                    const candleDataset = context.chart.data.datasets.find(ds => ds.label === 'Price');
                                    const candleData = candleDataset?.data[index];
                                    
                                    if (candleData && candleData.open !== undefined) {
                                        const change = candleData.close - candleData.open;
                                        const changePercent = ((change / candleData.open) * 100).toFixed(2);
                                        const changeSign = change >= 0 ? '+' : '';
                                        
                                        // Add DTI values
                                        const dtiValue = dti[index] ? dti[index].toFixed(2) : 'N/A';
                                        const sevenDayValue = daily7DayDTI[index] ? daily7DayDTI[index].toFixed(2) : 'N/A';
                                        
                                        return [
                                            `Open: ${formatChartPrice(candleData.open)}`,
                                            `High: ${formatChartPrice(candleData.high)}`,
                                            `Low: ${formatChartPrice(candleData.low)}`,
                                            `Close: ${formatChartPrice(candleData.close)}`,
                                            `Change: ${changeSign}${formatChartPrice(Math.abs(change))} (${changeSign}${changePercent}%)`,
                                            ``,
                                            `DTI: ${dtiValue}`,
                                            `7-Day DTI: ${sevenDayValue}`
                                        ];
                                    }
                                } else if (raw && typeof raw === 'object' && raw.o !== undefined) {
                                    // Old candlestick data format (kept for compatibility)
                                    const change = raw.c - raw.o;
                                    const changePercent = ((change / raw.o) * 100).toFixed(2);
                                    const changeSign = change >= 0 ? '+' : '';
                                    
                                    // Add DTI values
                                    const dtiValue = dti[index] ? dti[index].toFixed(2) : 'N/A';
                                    const sevenDayValue = daily7DayDTI[index] ? daily7DayDTI[index].toFixed(2) : 'N/A';
                                    
                                    return [
                                        `Open: ${formatChartPrice(raw.o)}`,
                                        `High: ${formatChartPrice(raw.h)}`,
                                        `Low: ${formatChartPrice(raw.l)}`,
                                        `Close: ${formatChartPrice(raw.c)}`,
                                        `Change: ${changeSign}${formatChartPrice(Math.abs(change))} (${changeSign}${changePercent}%)`,
                                        ``,
                                        `DTI: ${dtiValue}`,
                                        `7-Day DTI: ${sevenDayValue}`
                                    ];
                                } else {
                                    // Line chart data
                                    // Calculate percent change from previous day if available
                                    let percentChange = '';
                                    if (index > 0 && pricePercentageChange[index]) {
                                        const change = pricePercentageChange[index];
                                        percentChange = ` (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)`;
                                    }
                                    
                                    // Add DTI value for this day
                                    const dtiValue = dti[index] ? dti[index].toFixed(2) : 'N/A';
                                    const sevenDayValue = daily7DayDTI[index] ? daily7DayDTI[index].toFixed(2) : 'N/A';
                                    
                                    return [
                                        `${label}: ${formatChartPrice(value)}${percentChange}`,
                                        `DTI: ${dtiValue}`,
                                        `7-Day DTI: ${sevenDayValue}`
                                    ];
                                }
                            }
                            
                            // For DTI charts, add corresponding price
                            if (label === 'Daily DTI' || label === '7-Day DTI') {
                                const priceValue = prices[index];
                                const currencySymbol = getCurrencySymbolForDisplay(DTIBacktester.currentStockIndex);
                                
                                return [
                                    `${label}: ${value.toFixed(2)}`,
                                    `Price: ${formatChartPrice(priceValue)}`
                                ];
                            }
                            
                            // Default formatting for other datasets
                            return `${label}: ${value !== null ? value.toFixed(2) : 'N/A'}`;
                        }
                    }
                },
                legend: {
                    position: 'top',
                    align: window.innerWidth <= 768 ? 'center' : 'end',
                    labels: {
                        boxWidth: window.innerWidth <= 768 ? 8 : 12,
                        padding: window.innerWidth <= 768 ? 8 : 15,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        font: {
                            size: window.innerWidth <= 768 ? 9 : 11,
                            weight: '500'
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        };
        
        // Create Enhanced Price Chart with dynamic background and professional styling
        const priceCanvasElement = document.getElementById('price-chart');
        if (!priceCanvasElement) {
            console.error('[CHART ERROR] Price chart canvas element not found in DOM');
            DTIBacktester.utils.showNotification('Unable to load price chart. Canvas element missing.', 'error');
            return;
        }
        const priceCtx = priceCanvasElement.getContext('2d');
        
        // Create gradient for price chart fill
        const priceGradientFill = fadeFill(priceCtx.createLinearGradient(0, 300, 0, 0), colors.accent, PRICE_FADE);

        // Check if we should use candlestick chart
        const useCandlestick = ohlcData && ohlcData.open && ohlcData.high && ohlcData.low &&
                               ohlcData.open.length === dates.length &&
                               ohlcData.high.length === dates.length &&
                               ohlcData.low.length === dates.length;
        const chartType = useCandlestick && DTIBacktester.chartType === 'candlestick' ? 'candlestick' : 'line';

        console.log('[CHART FEATURE] Chart creation - OHLC data available:', !!ohlcData);
        console.log('[CHART FEATURE] Chart creation - Use candlestick:', useCandlestick);
        console.log('[CHART FEATURE] Chart creation - Chart type:', chartType);
        console.log('[CHART FEATURE] Chart creation - Requested chart type:', DTIBacktester.chartType);
        
        // Prepare datasets based on chart type
        let priceDatasets = [];
        
        if (chartType === 'candlestick') {
            // Create candlestick visualization with custom wick drawing
            const candleData = [];
            
            dates.forEach((date, i) => {
                const open = ohlcData.open[i];
                const high = ohlcData.high[i];
                const low = ohlcData.low[i];
                const close = prices[i];
                
                // Skip invalid data points (NaN, null, zero, negative — a zero
                // open or low anchors a candle at ₹0 and wrecks the chart)
                if (!(open > 0) || !(high > 0) || !(low > 0) || !(close > 0)) {
                    candleData.push(null);
                    return;
                }
                
                // Candle body - floating bar from min(open,close) to max(open,close)
                const bodyTop = Math.max(open, close);
                const bodyBottom = Math.min(open, close);
                
                candleData.push({
                    x: i,
                    y: [bodyBottom, bodyTop],
                    backgroundColor: alpha(close >= open ? colors.gain : colors.loss, 0.9),
                    borderColor: close >= open ? colors.gain : colors.loss,
                    open: open,
                    close: close,
                    high: high,
                    low: low
                });
            });
            
            if (candleData.filter(d => d !== null).length > 0) {
                // Candle bodies
                priceDatasets.push({
                    label: 'Price',
                    type: 'bar',
                    data: candleData,
                    backgroundColor: candleData.map(d => d ? d.backgroundColor : 'transparent'),
                    borderColor: candleData.map(d => d ? d.borderColor : 'transparent'),
                    borderWidth: 1,
                    barPercentage: 0.8,
                    categoryPercentage: 0.9,
                    borderSkipped: false,
                    order: 1,
                    // The wick plugin reads OHLC from here — per chart, so a
                    // reopened dialog on another stock never uses stale data
                    _candleSource: candleData,
                    // ...and this build's theme colours, for the fill and the wicks
                    _themeColors: colors
                });
                
                // Add custom plugin to draw wicks
                if (!DTIBacktester.candlestickPlugin) {
                    DTIBacktester.candlestickPlugin = {
                        id: 'candlestickWicks',
                        // Gold gradient under the closes — long-range candle views
                        // get the same depth as the line chart. Reads the scales
                        // each draw, so zoom and the range buttons keep it correct.
                        beforeDatasetsDraw: function(chart) {
                            const dsIndex = chart.data.datasets.findIndex(d => d.label === 'Price');
                            const ds = dsIndex >= 0 ? chart.data.datasets[dsIndex] : null;
                            const candles = ds && ds._candleSource;
                            if (!candles || ds.hidden) return;
                            const xs = chart.scales.x;
                            const ys = chart.scales.y;
                            if (!xs || !ys || !chart.chartArea) return;

                            const start = Math.max(0, Math.floor(xs.min != null ? xs.min : 0));
                            const end = Math.min(candles.length - 1, Math.ceil(xs.max != null ? xs.max : candles.length - 1));

                            const ctx = chart.ctx;
                            const area = chart.chartArea;
                            ctx.save();
                            ctx.beginPath();
                            ctx.rect(area.left, area.top, area.right - area.left, area.bottom - area.top);
                            ctx.clip();

                            ctx.beginPath();
                            let started = false;
                            let firstX = null;
                            let lastX = null;
                            for (let i = start; i <= end; i++) {
                                const c = candles[i];
                                if (!c) continue;
                                const x = xs.getPixelForValue(i);
                                const y = ys.getPixelForValue(c.close);
                                if (!started) {
                                    ctx.moveTo(x, y);
                                    started = true;
                                    firstX = x;
                                } else {
                                    ctx.lineTo(x, y);
                                }
                                lastX = x;
                            }

                            if (started) {
                                const gradient = fadeFill(ctx.createLinearGradient(0, area.bottom, 0, area.top), ds._themeColors.accent, PRICE_FADE);
                                ctx.lineTo(lastX, area.bottom);
                                ctx.lineTo(firstX, area.bottom);
                                ctx.closePath();
                                ctx.fillStyle = gradient;
                                ctx.fill();
                            }
                            ctx.restore();
                        },
                        afterDatasetsDraw: function(chart) {
                            const ctx = chart.ctx;
                            const dsIndex = chart.data.datasets.findIndex(d => d.label === 'Price');
                            const meta = chart.getDatasetMeta(dsIndex);
                            const candles = dsIndex >= 0 ? chart.data.datasets[dsIndex]._candleSource : null;

                            if (!meta || !meta.data || !candles) return;

                            // Adaptive density: with more candles than pixels the
                            // 1px wicks merge into a solid mass. Skip wicks until
                            // there is at least ~2px per candle — zooming in or a
                            // shorter range button re-renders and brings them back.
                            const xScale = chart.scales.x;
                            if (xScale) {
                                const visibleCount = Math.max(1, (xScale.max - xScale.min) + 1);
                                const pxPerCandle = (xScale.right - xScale.left) / visibleCount;
                                if (pxPerCandle < 2) return;
                            }

                            ctx.save();
                            ctx.strokeStyle = chart.data.datasets[dsIndex]._themeColors.textColor;
                            ctx.lineWidth = 1;

                            meta.data.forEach((bar, index) => {
                                if (!bar || !candles[index]) return;

                                const x = bar.x;
                                const high = chart.scales.y.getPixelForValue(candles[index].high);
                                const low = chart.scales.y.getPixelForValue(candles[index].low);
                                // bar.base is the pixel of the body's other end;
                                // bar.y + bar.height misbehaves on floating bars
                                const bottomPx = bar.base !== undefined ? bar.base : bar.y + bar.height;
                                const barTop = Math.min(bar.y, bottomPx);
                                const barBottom = Math.max(bar.y, bottomPx);

                                // Draw upper wick
                                ctx.beginPath();
                                ctx.moveTo(x, barTop);
                                ctx.lineTo(x, high);
                                ctx.stroke();

                                // Draw lower wick
                                ctx.beginPath();
                                ctx.moveTo(x, barBottom);
                                ctx.lineTo(x, low);
                                ctx.stroke();
                            });

                            ctx.restore();
                        }
                    };
                }
            } else {
                // Fall back to line chart if OHLC data is invalid
                DTIBacktester.chartType = 'line';
                // Recursive call will use line chart
                return createCharts(dates, prices, dti, sevenDayDTIData, ohlcData);
            }
        } else {
            // Line chart dataset
            priceDatasets.push({
                label: 'Price',
                data: prices,
                borderColor: colors.accent,
                backgroundColor: priceGradientFill,
                borderWidth: window.innerWidth <= 768 ? 1.5 : 2.5,
                pointRadius: 0,
                pointHoverRadius: window.innerWidth <= 768 ? 4 : 6,
                pointHoverBackgroundColor: colors.accent,
                pointHoverBorderColor: colors.backgroundColor,
                pointHoverBorderWidth: window.innerWidth <= 768 ? 1 : 2,
                fill: true,
                tension: 0.3,
                z: 1
            });
        }
        
        // Add entry/exit markers - use line type for proper scatter points
        priceDatasets.push({
            label: 'Entry Point',
            type: 'line',
            data: entryMarkers,
            backgroundColor: colors.gain,
            borderColor: 'transparent',
            borderWidth: 0,
            pointRadius: window.innerWidth <= 768 ? 6 : 8,
            pointStyle: DTIBacktest.customEntryPointStyle || 'circle',
            pointBorderColor: colors.backgroundColor,
            pointBorderWidth: window.innerWidth <= 768 ? 2 : 3,
            showLine: false,
            pointHoverRadius: window.innerWidth <= 768 ? 8 : 10,
            order: 0  // Make sure points appear above everything
        }, {
            label: 'Exit Point',
            type: 'line',
            data: exitMarkers,
            backgroundColor: colors.loss,
            borderColor: 'transparent',
            borderWidth: 0,
            pointRadius: window.innerWidth <= 768 ? 6 : 8,
            pointStyle: DTIBacktest.customExitPointStyle || 'triangle',
            pointBorderColor: colors.backgroundColor,
            pointBorderWidth: window.innerWidth <= 768 ? 2 : 3,
            showLine: false,
            pointHoverRadius: window.innerWidth <= 768 ? 8 : 10,
            order: 0  // Make sure points appear above everything
        }, {
            label: 'Active Entry',
            type: 'line',
            data: activeEntryMarkers,
            backgroundColor: colors.warn,
            borderColor: 'transparent',
            borderWidth: 0,
            pointRadius: window.innerWidth <= 768 ? 6 : 8,
            pointStyle: DTIBacktest.customActiveEntryPointStyle || 'rectRounded',
            pointBorderColor: colors.backgroundColor,
            pointBorderWidth: window.innerWidth <= 768 ? 2 : 3,
            showLine: false,
            pointHoverRadius: window.innerWidth <= 768 ? 8 : 10,
            order: 0  // Make sure points appear above everything
        });
        
        // Try to create chart, use mixed type for candlestick
        try {
            // Register plugin if in candlestick mode
            const plugins = chartType === 'candlestick' && DTIBacktester.candlestickPlugin ? 
                [DTIBacktester.candlestickPlugin] : [];
            
            DTIBacktester.priceChart = new Chart(priceCtx, {
                type: chartType === 'candlestick' ? 'bar' : 'line', // Use bar for candlestick base
                data: {
                    labels: dates,
                    datasets: priceDatasets
                },
                plugins: plugins,
            options: {
                ...commonOptions,
                scales: {
                    ...commonOptions.scales,
                    y: {
                        beginAtZero: false,
                        grid: {
                            drawBorder: false,
                            lineWidth: 1
                        },
                        border: {
                            display: false
                        },
                        ticks: {
                            callback: function(value) {
                                // Get currency symbol
                                const currencySymbol = getCurrencySymbolForDisplay(DTIBacktester.currentStockIndex);
                                
                                return formatChartPrice(value);
                            },
                            font: {
                                size: window.innerWidth <= 768 ? 8 : 10,
                                weight: '500'
                            },
                            padding: window.innerWidth <= 768 ? 4 : 8,
                            maxTicksLimit: window.innerWidth <= 768 ? 6 : 8
                        }
                    }
                },
                // Enhanced interaction for price chart
                interaction: {
                    mode: 'index',
                    intersect: false,
                    axis: 'x'
                },
                plugins: {
                    ...commonOptions.plugins,
                    annotation: chartAnnotations(),
                    legend: {
                        ...commonOptions.plugins.legend,
                        position: 'top',
                        align: 'end',
                        labels: {
                            ...commonOptions.plugins.legend.labels,
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            filter: function(legendItem, chartData) {
                                // Hide wick-related labels in candlestick mode
                                if (chartType === 'candlestick' && 
                                    (legendItem.text === 'Wick' || legendItem.text === 'High' || legendItem.text === 'Low' || 
                                     legendItem.text === 'High Wick' || legendItem.text === 'Low Wick')) {
                                    return false;
                                }
                                return true;
                            }
                        }
                    }
                }
            }
        });
        } catch (error) {
            throw error;
        }
        
        // Create Enhanced Daily DTI Chart
        const dtiCanvasElement = document.getElementById('dti-chart');
        if (!dtiCanvasElement) {
            console.error('[CHART ERROR] DTI chart canvas element not found in DOM');
            DTIBacktester.utils.showNotification('Unable to load DTI chart. Canvas element missing.', 'error');
            return;
        }
        const dtiCtx = dtiCanvasElement.getContext('2d');
        
        // Create gradient for DTI chart
        const dtiGradientFill = fadeFill(dtiCtx.createLinearGradient(0, 300, 0, 0), colors.info, DTI_FADE);

        DTIBacktester.dtiChart = new Chart(dtiCtx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Daily DTI',
                    data: dti,
                    borderColor: colors.info,
                    backgroundColor: dtiGradientFill,
                    borderWidth: window.innerWidth <= 768 ? 1.5 : 2.5,
                    pointRadius: 0,
                    pointHoverRadius: window.innerWidth <= 768 ? 4 : 6,
                    pointHoverBackgroundColor: colors.info,
                    pointHoverBorderColor: colors.backgroundColor,
                    pointHoverBorderWidth: window.innerWidth <= 768 ? 1 : 2,
                    fill: true,
                    tension: 0.3
                }, {
                    label: 'Zero Line',
                    data: zeroLine,
                    borderColor: alpha(colors.muted, 0.8),
                    borderWidth: window.innerWidth <= 768 ? 1 : 1.5,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                }, {
                    label: 'Entry Threshold',
                    data: entryThresholdLine,
                    borderColor: alpha(colors.warn, 0.7),
                    borderWidth: window.innerWidth <= 768 ? 1 : 1.5,
                    borderDash: [3, 3],
                    pointRadius: 0,
                    fill: false
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    annotation: chartAnnotations()
                },
                scales: {
                    ...commonOptions.scales,
                    y: {
                        grid: {
                            drawBorder: false,
                            lineWidth: 1
                        },
                        border: {
                            display: false
                        },
                        ticks: {
                            callback: function(value) {
                                return value.toFixed(0);
                            },
                            font: {
                                size: 10,
                                weight: '500'
                            },
                            padding: 8
                        }
                    }
                }
            }
        });
        
        // Create Enhanced 7-Day DTI Chart
        const weeklyCanvasElement = document.getElementById('weekly-dti-chart');
        if (!weeklyCanvasElement) {
            console.error('[CHART ERROR] Weekly DTI chart canvas element not found in DOM');
            DTIBacktester.utils.showNotification('Unable to load weekly DTI chart. Canvas element missing.', 'error');
            return;
        }
        const sevenDayDTICtx = weeklyCanvasElement.getContext('2d');
        
        // Create gradient for 7-day DTI chart
        const sevenDayDTIGradientFill = fadeFill(sevenDayDTICtx.createLinearGradient(0, 300, 0, 0), colors.accent, DTI_FADE);

        DTIBacktester.sevenDayDTIChart = new Chart(sevenDayDTICtx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: '7-Day DTI',
                    data: daily7DayDTI,
                    borderColor: colors.accent,
                    backgroundColor: sevenDayDTIGradientFill,
                    borderWidth: window.innerWidth <= 768 ? 1.5 : 2.5,
                    pointRadius: 0,
                    pointHoverRadius: window.innerWidth <= 768 ? 4 : 6,
                    pointHoverBackgroundColor: colors.accent,
                    pointHoverBorderColor: colors.backgroundColor,
                    pointHoverBorderWidth: window.innerWidth <= 768 ? 1 : 2,
                    fill: true,
                    stepped: 'middle'  // Enhanced step visualization
                }, {
                    label: 'Zero Line',
                    data: zeroLine,
                    borderColor: alpha(colors.muted, 0.8),
                    borderWidth: window.innerWidth <= 768 ? 1 : 1.5,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                }, {
                    label: 'Entry Threshold',
                    data: entryThresholdLine,
                    borderColor: alpha(colors.warn, 0.7),
                    borderWidth: window.innerWidth <= 768 ? 1 : 1.5,
                    borderDash: [3, 3],
                    pointRadius: 0,
                    fill: false
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    annotation: chartAnnotations()
                },
                scales: {
                    ...commonOptions.scales,
                    y: {
                        grid: {
                            drawBorder: false,
                            lineWidth: 1
                        },
                        border: {
                            display: false
                        },
                        ticks: {
                            callback: function(value) {
                                return value.toFixed(0);
                            },
                            font: {
                                size: 10,
                                weight: '500'
                            },
                            padding: 8
                        }
                    }
                }
            }
        });

        // Add chart sync for zoom and pan
        syncChartsZoom([DTIBacktester.priceChart, DTIBacktester.dtiChart, DTIBacktester.sevenDayDTIChart]);
        
        // Add click handlers for trade points
        addTradePointClickHandlers();
        
        // Apply chart shadow effect to all chart canvases
        const chartCanvases = document.querySelectorAll('.chart-wrapper canvas');
        chartCanvases.forEach(canvas => {
            canvas.classList.add('chart-shadow');
        });

        // Clean up any existing chart controls to prevent duplication
        const existingControlsContainer = document.querySelector('.chart-controls-container');
        if (existingControlsContainer) {
            // Remove event listeners by cloning and replacing
            const newControlsContainer = existingControlsContainer.cloneNode(false);
            existingControlsContainer.parentNode.replaceChild(newControlsContainer, existingControlsContainer);
        }

        // Reset zoom state for all charts
        console.log('[CHART FEATURE] Resetting zoom state for all charts');
        if (DTIBacktester.priceChart && DTIBacktester.priceChart.resetZoom) {
            DTIBacktester.priceChart.resetZoom();
            console.log('[CHART FEATURE] Price chart zoom reset');
        }
        if (DTIBacktester.dtiChart && DTIBacktester.dtiChart.resetZoom) {
            DTIBacktester.dtiChart.resetZoom();
            console.log('[CHART FEATURE] DTI chart zoom reset');
        }
        if (DTIBacktester.sevenDayDTIChart && DTIBacktester.sevenDayDTIChart.resetZoom) {
            DTIBacktester.sevenDayDTIChart.resetZoom();
            console.log('[CHART FEATURE] 7-Day DTI chart zoom reset');
        }

        // Add chart controls - they will be freshly created
        if (typeof DTIChartControls !== 'undefined') {
            DTIChartControls.addChartControls();
        }

        // Restore any saved annotations
        restoreAnnotations();

        console.log('[CHART FIX] Chart creation completed successfully');
        } catch (error) {
            console.error('[CHART FIX] Error during chart creation:', error);
            if (typeof DTIBacktester !== 'undefined' && DTIBacktester.utils) {
                DTIBacktester.utils.showNotification('Error creating charts: ' + error.message, 'error');
            }
        } finally {
            // Always reset the flag to allow future chart creations
            isCreatingCharts = false;
            console.log('[CHART FIX] Chart creation flag reset');
        }
    }
    
    /**
     * Synchronize zoom and pan across multiple charts
     * @param {Array} charts - Array of Chart.js instances
     */
    function syncChartsZoom(charts) {
        if (!charts || charts.length <= 1) return;

        // Follow the chart the plugin zoomed or panned (context.chart). The three charts share
        // one zoom options object, so callbacks set per chart overwrote each other, and a zoom
        // on either DTI chart was put back to the price chart's range.
        const follow = function(context) {
            const source = context.chart;
            charts.forEach(otherChart => {
                if (otherChart && otherChart !== source) {
                    otherChart.zoomScale('x', {
                        min: source.scales.x.min,
                        max: source.scales.x.max
                    }, 'none');
                    otherChart.update('none');
                }
            });
        };

        charts.forEach(chart => {
            if (!chart || !chart.options || !chart.options.plugins || !chart.options.plugins.zoom) {
                return;
            }
            chart.options.plugins.zoom.zoom.onZoom = follow;
            chart.options.plugins.zoom.pan.onPan = follow;
        });
    }
    
    /**
     * Add click handlers for trade entry/exit points
     */
    function addTradePointClickHandlers() {
        // Add click handler for price chart
        const priceCanvas = document.getElementById('price-chart');
        if (priceCanvas && DTIBacktester.priceChart) {
            priceCanvas.onclick = function(evt) {
                const points = DTIBacktester.priceChart.getElementsAtEventForMode(
                    evt, 
                    'nearest', 
                    { intersect: true }, 
                    false
                );
                
                if (points.length > 0) {
                    const firstPoint = points[0];
                    const datasetIndex = firstPoint.datasetIndex;
                    const index = firstPoint.index;
                    
                    // Check if it's an entry or exit point (datasets 1 and 2)
                    if (datasetIndex === 1 || datasetIndex === 2) {
                        const trades = DTIBacktester.tradeData;
                        if (!trades || trades.length === 0) return;
                        
                        // Find the matching trade
                        const selectedDate = DTIBacktester.priceChart.data.labels[index];
                        
                        let selectedTrade;
                        for (const trade of trades) {
                            if (trade.entryDate === selectedDate || trade.exitDate === selectedDate) {
                                selectedTrade = trade;
                                break;
                            }
                        }
                        
                        if (selectedTrade && typeof DTIChartControls !== 'undefined') {
                            DTIChartControls.showTradeDetails(selectedTrade);
                        }
                    }
                }
            };
        }
    }
    
    /**
     * Restore saved annotations from previous session
     */
    function restoreAnnotations() {
        if (!DTIBacktester.annotations) return;
        
        for (const id in DTIBacktester.annotations) {
            const annotation = DTIBacktester.annotations[id];
            let chart;

            // A note belongs to the stock it was made on, not to every chart with that date
            if (annotation.symbol !== DTIBacktester.currentStockIndex) continue;

            // Find the matching chart
            switch (annotation.chartId) {
                case 'price-chart':
                    chart = DTIBacktester.priceChart;
                    break;
                case 'dti-chart':
                    chart = DTIBacktester.dtiChart;
                    break;
                case 'weekly-dti-chart':
                    chart = DTIBacktester.sevenDayDTIChart;
                    break;
                default:
                    continue;
            }
            
            // Skip if chart is not available
            if (!chart) continue;
            
            // Find nearest data point
            let dataIndex = -1;
            for (let i = 0; i < chart.data.labels.length; i++) {
                if (chart.data.labels[i] === annotation.xValue) {
                    dataIndex = i;
                    break;
                }
            }
            
            if (dataIndex === -1) continue;
            
            // Initialize annotation plugin if needed
            if (!chart.options.plugins.annotation) {
                chart.options.plugins.annotation = {
                    annotations: {}
                };
            }
            
            // Add annotation
            chart.options.plugins.annotation.annotations[id] = noteAnnotation(annotation.xValue, annotation.yValue, annotation.text);
        }

        // Update charts
        if (DTIBacktester.priceChart) DTIBacktester.priceChart.update();
        if (DTIBacktester.dtiChart) DTIBacktester.dtiChart.update();
        if (DTIBacktester.sevenDayDTIChart) DTIBacktester.sevenDayDTIChart.update();
    }

    /**
     * A note the Annotate button puts on a chart: its text on a label coloured like the
     * tooltips, with a callout in the theme's accent down to the day it was pinned to.
     * (A 'point' annotation draws no label in chartjs-plugin-annotation 2.x, so the old
     * notes showed a dot and never their text.)
     */
    function noteAnnotation(xValue, yValue, text) {
        const colors = window.ChartTheme.colors();
        return {
            type: 'label',
            drawTime: 'afterDraw', // above the candles' wicks
            xValue: xValue,
            yValue: yValue,
            yAdjust: -28,
            content: text,
            backgroundColor: colors.tooltipBg,
            color: colors.tooltipText,
            padding: 6,
            font: {
                size: 12,
                weight: 'bold'
            },
            callout: {
                display: true,
                position: 'bottom',
                borderColor: colors.accent
            }
        };
    }

    // IMPORTANT: Create these wrapper functions to expose on the DTIUI object
    
    // Expose createCharts directly on DTIUI object
    DTIUI.createCharts = createCharts;

    /**
     * Add chart type toggle button to chart controls
     */
    function addChartTypeToggle(retryCount = 0) {
        const MAX_RETRIES = 10; // Maximum 5 seconds of retries (10 * 500ms)

        // Check if chart controls exist
        const chartControls = document.querySelector('.chart-controls .button-controls');
        if (!chartControls) {
            // If no controls yet, wait and try again (up to max retries)
            if (retryCount < MAX_RETRIES) {
                setTimeout(() => addChartTypeToggle(retryCount + 1), 500);
            } else {
                console.warn('[CHART FEATURE] Chart controls not found after maximum retries');
            }
            return;
        }

        // Check if toggle already exists
        if (chartControls.querySelector('.chart-type-toggle')) return;
        
        // Create toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'control-btn chart-type-toggle';
        toggleBtn.innerHTML = `
            ${DTIBacktester.chartType === 'candlestick' ? 
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><line x1="7" y1="16" x2="7" y2="6"/><line x1="12" y1="20" x2="12" y2="9"/><line x1="17" y1="14" x2="17" y2="10"/></svg>' :
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="8" width="2" height="8" rx="1"/><rect x="11" y="4" width="2" height="12" rx="1"/><rect x="17" y="10" width="2" height="6" rx="1"/><line x1="6" y1="4" x2="6" y2="8"/><line x1="6" y1="16" x2="6" y2="20"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="16" x2="12" y2="22"/><line x1="18" y1="6" x2="18" y2="10"/><line x1="18" y1="16" x2="18" y2="18"/></svg>'}
            <span class="btn-text">${DTIBacktester.chartType === 'candlestick' ? 'Line' : 'Candlestick'}</span>
        `;
        toggleBtn.title = DTIBacktester.chartType === 'candlestick' ? 'Switch to Line Chart' : 'Switch to Candlestick Chart';
        
        // Add click handler
        toggleBtn.addEventListener('click', () => {
            console.log('[CHART FEATURE] Chart type toggle clicked - switching from', DTIBacktester.chartType);

            // Toggle chart type
            DTIBacktester.chartType = DTIBacktester.chartType === 'candlestick' ? 'line' : 'candlestick';
            console.log('[CHART FEATURE] Chart type switched to:', DTIBacktester.chartType);
            
            // Update button
            toggleBtn.innerHTML = `
                ${DTIBacktester.chartType === 'candlestick' ? 
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><line x1="7" y1="16" x2="7" y2="6"/><line x1="12" y1="20" x2="12" y2="9"/><line x1="17" y1="14" x2="17" y2="10"/></svg>' :
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="8" width="2" height="8" rx="1"/><rect x="11" y="4" width="2" height="12" rx="1"/><rect x="17" y="10" width="2" height="6" rx="1"/><line x1="6" y1="4" x2="6" y2="8"/><line x1="6" y1="16" x2="6" y2="20"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="16" x2="12" y2="22"/><line x1="18" y1="6" x2="18" y2="10"/><line x1="18" y1="16" x2="18" y2="18"/></svg>'}
                <span class="btn-text">${DTIBacktester.chartType === 'candlestick' ? 'Line' : 'Candlestick'}</span>
            `;
            toggleBtn.title = DTIBacktester.chartType === 'candlestick' ? 'Switch to Line Chart' : 'Switch to Candlestick Chart';
            
            // Recreate chart with new type
            if (DTIBacktester.chartData) {
                const { dates, prices, dti, sevenDayDTIData, ohlcData } = DTIBacktester.chartData;
                
                // Recreate charts with the complete stored data
                createCharts(dates, prices, dti, sevenDayDTIData, ohlcData);
            } else if (DTIBacktester.ohlcData) {
                // Fallback to old method if chartData not available
                const { dates, close, open, high, low } = DTIBacktester.ohlcData;
                
                // Try to construct minimal sevenDayDTIData
                const sevenDayDTIData = {
                    daily7DayDTI: [],
                    sevenDayData: {},
                    sevenDayDTI: []
                };
                
                createCharts(dates, close, [], sevenDayDTIData, { open, high, low });
            }
            
            DTIBacktester.utils.showNotification(`Switched to ${DTIBacktester.chartType} chart`, 'success');
        });
        
        // Find the annotate button and insert before it
        const annotateBtn = chartControls.querySelector('.annotate-btn');
        if (annotateBtn) {
            chartControls.insertBefore(toggleBtn, annotateBtn);
        } else {
            // If no annotate button, just append
            chartControls.appendChild(toggleBtn);
        }
    }

    // Export functions for external use
    return {
        createCharts,
        restoreAnnotations,
        noteAnnotation,
        addChartTypeToggle
    };
})();