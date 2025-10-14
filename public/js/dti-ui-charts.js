/**
 * DTI Backtester - UI Charts Module
 * Handles chart creation, updates, and interactions
 */

// Create Charts namespace
DTIUI.Charts = (function() {
    /**
     * Create and update charts with enhanced interactive features
     * @param {Array} dates - Array of date strings
     * @param {Array} prices - Array of price values
     * @param {Array} dti - Array of DTI values
     * @param {Object} sevenDayDTIData - Object containing 7-day DTI data
     * @param {Object} ohlcData - Object containing open, high, low arrays (optional)
     */
    function createCharts(dates, prices, dti, sevenDayDTIData, ohlcData = null) {
        // Clear existing charts with proper cleanup
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
        
        // Initialize default chart type if not set
        if (!DTIBacktester.chartType) {
            DTIBacktester.chartType = 'line'; // Default to line chart
        }
        
        // Ensure we don't try candlestick on first load
        if (!DTIBacktester.hasLoadedOnce) {
            DTIBacktester.chartType = 'line';
            DTIBacktester.hasLoadedOnce = true;
        }
        
        // Add export buttons to charts if not already present
        addExportButtons();
        
        // Add chart type toggle button
        setTimeout(() => {
            addChartTypeToggle();
        }, 100);
        
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
                        color: '#64748b',
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
                        color: 'rgba(0, 0, 0, 0.03)',
                        drawBorder: false,
                        lineWidth: 1
                    },
                    border: {
                        display: false
                    },
                    ticks: {
                        color: '#64748b',
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
                            backgroundColor: 'rgba(212, 175, 55, 0.2)',
                            borderColor: 'rgba(212, 175, 55, 0.4)',
                            borderWidth: 1
                        }
                    },
                    limits: {
                        x: {min: 'original', max: 'original'}
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(17, 24, 39, 0.85)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
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
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    borderWidth: 1,
                    boxPadding: 5,
                    usePointStyle: true,
                    callbacks: {
                        title: function(tooltipItems) {
                            const date = new Date(tooltipItems[0].label);
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
                                        `Entry: ${currencySymbol}${tradeData.price.toFixed(2)}`,
                                        `Date: ${DTIBacktester.utils.formatDate(tradeData.date)}`,
                                        `Holding Period: ${tradeData.holdingDays} days`,
                                        `Result: ${tradeData.plPercent.toFixed(2)}%`,
                                        ``, // Empty line for spacing
                                        `Click for details`
                                    ];
                                } else {
                                    return [
                                        `Exit: ${currencySymbol}${tradeData.price.toFixed(2)}`,
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
                                            `Open: ${currencySymbol}${candleData.open.toFixed(2)}`,
                                            `High: ${currencySymbol}${candleData.high.toFixed(2)}`,
                                            `Low: ${currencySymbol}${candleData.low.toFixed(2)}`,
                                            `Close: ${currencySymbol}${candleData.close.toFixed(2)}`,
                                            `Change: ${changeSign}${currencySymbol}${Math.abs(change).toFixed(2)} (${changeSign}${changePercent}%)`,
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
                                        `Open: ${currencySymbol}${raw.o.toFixed(2)}`,
                                        `High: ${currencySymbol}${raw.h.toFixed(2)}`,
                                        `Low: ${currencySymbol}${raw.l.toFixed(2)}`,
                                        `Close: ${currencySymbol}${raw.c.toFixed(2)}`,
                                        `Change: ${changeSign}${currencySymbol}${Math.abs(change).toFixed(2)} (${changeSign}${changePercent}%)`,
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
                                        `${label}: ${currencySymbol}${value.toFixed(2)}${percentChange}`,
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
                                    `Price: ${currencySymbol}${priceValue.toFixed(2)}`
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
                },
                // Enhanced annotation plugin configuration
                annotation: {
                    annotations: (warmupInfo && warmupInfo.enabled && warmupInfo.endDate) ? {
                        warmupBox: {
                            type: 'box',
                            xMin: 0,
                            xMax: dates.findIndex(d => new Date(d) >= warmupInfo.endDate),
                            backgroundColor: 'rgba(203, 213, 225, 0.15)',
                            borderColor: 'rgba(148, 163, 184, 0.5)',
                            borderWidth: 1,
                            borderDash: [4, 4],
                            label: {
                                display: true,
                                content: 'Warm-up Period (6 months)',
                                position: 'start',
                                backgroundColor: 'rgba(148, 163, 184, 0.7)',
                                color: '#1e293b',
                                padding: 6,
                                font: {
                                    size: 11,
                                    weight: 'bold'
                                }
                            }
                        }
                    } : {}
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
            return;
        }
        const priceCtx = priceCanvasElement.getContext('2d');
        
        // Create gradient for price chart fill
        const priceGradientFill = priceCtx.createLinearGradient(0, 300, 0, 0);
        priceGradientFill.addColorStop(0, 'rgba(212, 175, 55, 0.01)');
        priceGradientFill.addColorStop(0.3, 'rgba(212, 175, 55, 0.1)');
        priceGradientFill.addColorStop(0.6, 'rgba(212, 175, 55, 0.18)');
        priceGradientFill.addColorStop(1, 'rgba(212, 175, 55, 0.25)');
        
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
                
                // Skip invalid data points
                if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close) || 
                    open === null || high === null || low === null || close === null) {
                    candleData.push(null);
                    return;
                }
                
                // Candle body - floating bar from min(open,close) to max(open,close)
                const bodyTop = Math.max(open, close);
                const bodyBottom = Math.min(open, close);
                
                candleData.push({
                    x: i,
                    y: [bodyBottom, bodyTop],
                    backgroundColor: close >= open ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)',
                    borderColor: close >= open ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)',
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
                    order: 1
                });
                
                // Add custom plugin to draw wicks
                if (!DTIBacktester.candlestickPlugin) {
                    DTIBacktester.candlestickPlugin = {
                        id: 'candlestickWicks',
                        afterDatasetsDraw: function(chart) {
                            const ctx = chart.ctx;
                            const meta = chart.getDatasetMeta(chart.data.datasets.findIndex(d => d.label === 'Price'));
                            
                            if (!meta || !meta.data) return;
                            
                            ctx.save();
                            ctx.strokeStyle = 'rgba(71, 85, 105, 1)';
                            ctx.lineWidth = 1;
                            
                            meta.data.forEach((bar, index) => {
                                if (!bar || !candleData[index]) return;
                                
                                const x = bar.x;
                                const high = chart.scales.y.getPixelForValue(candleData[index].high);
                                const low = chart.scales.y.getPixelForValue(candleData[index].low);
                                const barTop = bar.y;
                                const barBottom = bar.y + bar.height;
                                
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
                borderColor: 'rgba(212, 175, 55, 1)',
                backgroundColor: priceGradientFill,
                borderWidth: window.innerWidth <= 768 ? 1.5 : 2.5,
                pointRadius: 0,
                pointHoverRadius: window.innerWidth <= 768 ? 4 : 6,
                pointHoverBackgroundColor: 'rgba(212, 175, 55, 1)',
                pointHoverBorderColor: 'white',
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
            backgroundColor: 'rgba(16, 185, 129, 1)',
            borderColor: 'rgba(16, 185, 129, 0)',
            borderWidth: 0,
            pointRadius: window.innerWidth <= 768 ? 6 : 8,
            pointStyle: DTIBacktest.customEntryPointStyle || 'circle',
            pointBorderColor: 'white',
            pointBorderWidth: window.innerWidth <= 768 ? 2 : 3,
            showLine: false,
            pointHoverRadius: window.innerWidth <= 768 ? 8 : 10,
            order: 0  // Make sure points appear above everything
        }, {
            label: 'Exit Point',
            type: 'line',
            data: exitMarkers,
            backgroundColor: 'rgba(239, 68, 68, 1)',
            borderColor: 'rgba(239, 68, 68, 0)',
            borderWidth: 0,
            pointRadius: window.innerWidth <= 768 ? 6 : 8,
            pointStyle: DTIBacktest.customExitPointStyle || 'triangle',
            pointBorderColor: 'white',
            pointBorderWidth: window.innerWidth <= 768 ? 2 : 3,
            showLine: false,
            pointHoverRadius: window.innerWidth <= 768 ? 8 : 10,
            order: 0  // Make sure points appear above everything
        }, {
            label: 'Active Entry',
            type: 'line',
            data: activeEntryMarkers,
            backgroundColor: 'rgba(249, 115, 22, 1)',
            borderColor: 'rgba(249, 115, 22, 0)',
            borderWidth: 0,
            pointRadius: window.innerWidth <= 768 ? 6 : 8,
            pointStyle: DTIBacktest.customActiveEntryPointStyle || 'rectRounded',
            pointBorderColor: 'white',
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
                            color: 'rgba(0, 0, 0, 0.03)',
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
                                
                                return currencySymbol + value.toFixed(2);
                            },
                            color: '#64748b',
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
                    legend: {
                        ...commonOptions.plugins.legend,
                        position: 'top',
                        align: 'end',
                        labels: {
                            ...commonOptions.plugins.legend.labels,
                            padding: 15,
                            color: '#334155',
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
            return;
        }
        const dtiCtx = dtiCanvasElement.getContext('2d');
        
        // Create gradient for DTI chart
        const dtiGradientFill = dtiCtx.createLinearGradient(0, 300, 0, 0);
        dtiGradientFill.addColorStop(0, 'rgba(139, 92, 246, 0)');
        dtiGradientFill.addColorStop(0.5, 'rgba(139, 92, 246, 0.08)');
        dtiGradientFill.addColorStop(1, 'rgba(139, 92, 246, 0.15)');
        
        DTIBacktester.dtiChart = new Chart(dtiCtx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Daily DTI',
                    data: dti,
                    borderColor: 'rgba(139, 92, 246, 1)',
                    backgroundColor: dtiGradientFill,
                    borderWidth: window.innerWidth <= 768 ? 1.5 : 2.5,
                    pointRadius: 0,
                    pointHoverRadius: window.innerWidth <= 768 ? 4 : 6,
                    pointHoverBackgroundColor: 'rgba(139, 92, 246, 1)',
                    pointHoverBorderColor: 'white',
                    pointHoverBorderWidth: window.innerWidth <= 768 ? 1 : 2,
                    fill: true,
                    tension: 0.3
                }, {
                    label: 'Zero Line',
                    data: zeroLine,
                    borderColor: 'rgba(14, 165, 233, 0.7)',
                    borderWidth: window.innerWidth <= 768 ? 1 : 1.5,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                }, {
                    label: 'Entry Threshold',
                    data: entryThresholdLine,
                    borderColor: 'rgba(245, 158, 11, 0.7)',
                    borderWidth: window.innerWidth <= 768 ? 1 : 1.5,
                    borderDash: [3, 3],
                    pointRadius: 0,
                    fill: false
                }]
            },
            options: {
                ...commonOptions,
                scales: {
                    ...commonOptions.scales,
                    y: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.03)',
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
                            color: '#64748b',
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
            return;
        }
        const sevenDayDTICtx = weeklyCanvasElement.getContext('2d');
        
        // Create gradient for 7-day DTI chart
        const sevenDayDTIGradientFill = sevenDayDTICtx.createLinearGradient(0, 300, 0, 0);
        sevenDayDTIGradientFill.addColorStop(0, 'rgba(14, 165, 233, 0)');
        sevenDayDTIGradientFill.addColorStop(0.5, 'rgba(14, 165, 233, 0.08)');
        sevenDayDTIGradientFill.addColorStop(1, 'rgba(14, 165, 233, 0.15)');
        
        DTIBacktester.sevenDayDTIChart = new Chart(sevenDayDTICtx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: '7-Day DTI',
                    data: daily7DayDTI,
                    borderColor: 'rgba(14, 165, 233, 1)',
                    backgroundColor: sevenDayDTIGradientFill,
                    borderWidth: window.innerWidth <= 768 ? 1.5 : 2.5,
                    pointRadius: 0,
                    pointHoverRadius: window.innerWidth <= 768 ? 4 : 6,
                    pointHoverBackgroundColor: 'rgba(14, 165, 233, 1)',
                    pointHoverBorderColor: 'white',
                    pointHoverBorderWidth: window.innerWidth <= 768 ? 1 : 2,
                    fill: true,
                    stepped: 'middle'  // Enhanced step visualization
                }, {
                    label: 'Zero Line',
                    data: zeroLine,
                    borderColor: 'rgba(16, 185, 129, 0.7)',
                    borderWidth: window.innerWidth <= 768 ? 1 : 1.5,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                }, {
                    label: 'Entry Threshold',
                    data: entryThresholdLine,
                    borderColor: 'rgba(245, 158, 11, 0.7)',
                    borderWidth: window.innerWidth <= 768 ? 1 : 1.5,
                    borderDash: [3, 3],
                    pointRadius: 0,
                    fill: false
                }]
            },
            options: {
                ...commonOptions,
                scales: {
                    ...commonOptions.scales,
                    y: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.03)',
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
                            color: '#64748b',
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
    }
    
    /**
     * Synchronize zoom and pan across multiple charts
     * @param {Array} charts - Array of Chart.js instances
     */
    function syncChartsZoom(charts) {
        if (!charts || charts.length <= 1) return;
        
        // For each chart, attach zoom and pan events
        charts.forEach(mainChart => {
            if (!mainChart || !mainChart.options || !mainChart.options.plugins || !mainChart.options.plugins.zoom) {
                return;
            }
            
            // Override the zoom callback to sync all charts
            const originalZoom = mainChart.options.plugins.zoom.zoom.onZoom;
            mainChart.options.plugins.zoom.zoom.onZoom = function(context) {
                if (originalZoom) originalZoom(context);
                
                // Get the new scale
                const newScale = mainChart.scales.x;
                
                // Apply the same scale to all other charts
                charts.forEach(otherChart => {
                    if (otherChart !== mainChart) {
                        otherChart.zoomScale('x', {
                            min: newScale.min,
                            max: newScale.max
                        }, 'none');
                        otherChart.update('none');
                    }
                });
            };
            
            // Override the pan callback to sync all charts
            const originalPan = mainChart.options.plugins.zoom.pan.onPan;
            mainChart.options.plugins.zoom.pan.onPan = function(context) {
                if (originalPan) originalPan(context);
                
                // Get the new scale
                const newScale = mainChart.scales.x;
                
                // Apply the same scale to all other charts
                charts.forEach(otherChart => {
                    if (otherChart !== mainChart) {
                        otherChart.zoomScale('x', {
                            min: newScale.min,
                            max: newScale.max
                        }, 'none');
                        otherChart.update('none');
                    }
                });
            };
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
            chart.options.plugins.annotation.annotations[id] = {
                type: 'point',
                xValue: annotation.xValue,
                yValue: annotation.yValue,
                backgroundColor: 'rgba(255, 99, 132, 1)',
                borderColor: 'white',
                borderWidth: 2,
                radius: 6,
                content: annotation.text,
                label: {
                    display: true,
                    content: annotation.text,
                    position: 'top',
                    backgroundColor: 'rgba(255, 99, 132, 0.8)',
                    color: 'white',
                    padding: 6,
                    font: {
                        size: 12,
                        weight: 'bold'
                    }
                }
            };
        }
        
        // Update charts
        if (DTIBacktester.priceChart) DTIBacktester.priceChart.update();
        if (DTIBacktester.dtiChart) DTIBacktester.dtiChart.update();
        if (DTIBacktester.sevenDayDTIChart) DTIBacktester.sevenDayDTIChart.update();
    }
    
    /**
     * Update all charts after parameter changes
     */
    function updateChartsAfterParameterChange() {
        // Check if we have charts and data to update
        if (!DTIBacktester.priceChart || !DTIBacktester.dtiChart || !DTIBacktester.sevenDayDTIChart) {
            return;
        }
        
        // Get the current data
        const dates = DTIBacktester.priceChart.data.labels;
        const prices = DTIBacktester.priceChart.data.datasets[0].data;
        
        // Get parameters for DTI calculation
        const r = parseInt(document.getElementById('r').value);
        const s = parseInt(document.getElementById('s').value);
        const u = 5; // Fixed value
        
        // Calculate new DTI values
        const high = prices; // We don't have separate high values, use price as approximation
        const low = prices;  // We don't have separate low values, use price as approximation
        const dti = DTIIndicators.calculateDTI(high, low, r, s, u);
        const sevenDayDTIData = DTIIndicators.calculate7DayDTI(dates, high, low, r, s, u);
        
        // Run backtest with new parameters
        const daily7DayDTI = sevenDayDTIData.daily7DayDTI;
        const trades = DTIBacktest.backtest(dates, prices, dti, sevenDayDTIData);
        
        // Generate new trade markers
        const {
            entryMarkers,
            exitMarkers,
            activeEntryMarkers,
            tradeConnections,
            tradeProfitLoss,
            tradeMetadata
        } = DTIBacktest.generateTradeMarkers(dates, prices, trades);
        
        // Calculate new threshold line based on the entry threshold parameter
        const entryThresholdLine = Array(dates.length).fill(parseFloat(document.getElementById('entry-threshold').value));
        
        // Update price chart
        if (DTIBacktester.priceChart) {
            // Update entry/exit/active markers
            DTIBacktester.priceChart.data.datasets[1].data = entryMarkers;
            DTIBacktester.priceChart.data.datasets[2].data = exitMarkers;
            DTIBacktester.priceChart.data.datasets[3].data = activeEntryMarkers;
            DTIBacktester.priceChart.update();
        }
        
        // Update DTI chart
        if (DTIBacktester.dtiChart) {
            // Update DTI values
            DTIBacktester.dtiChart.data.datasets[0].data = dti;
            // Update threshold line
            DTIBacktester.dtiChart.data.datasets[2].data = entryThresholdLine;
            DTIBacktester.dtiChart.update();
        }
        
        // Update 7-day DTI chart
        if (DTIBacktester.sevenDayDTIChart) {
            // Update 7-day DTI values
            DTIBacktester.sevenDayDTIChart.data.datasets[0].data = daily7DayDTI;
            // Update threshold line
            DTIBacktester.sevenDayDTIChart.data.datasets[2].data = entryThresholdLine;
            DTIBacktester.sevenDayDTIChart.update();
        }
        
        // Store updated trade data for interactions
        DTIBacktester.tradeData = trades;
        
        // Update statistics and trades table
        if (typeof DTIUI.TradeDisplay !== 'undefined') {
            DTIUI.TradeDisplay.displayStatistics(trades);
            DTIUI.TradeDisplay.displayTrades(trades);
        }
    }

    /**
     * Initialize parameter change listeners
     */
    function initParameterChangeListeners() {
        // Get all parameter input elements
        const parameterInputs = document.querySelectorAll('#r, #s, #u, #entry-threshold, #take-profit, #stop-loss, #max-days, #enable-weekly-dti');
        
        // Add change event listeners
        parameterInputs.forEach(input => {
            input.addEventListener('change', function() {
                // Validate parameters first
                const validation = DTIBacktest.validateParameters();
                if (!validation.isValid) {
                    // Show error message
                    DTIBacktester.utils.showNotification('Invalid parameters: ' + validation.errors.join(', '), 'error');
                    return;
                }
                
                // Update charts with new parameters
                updateChartsAfterParameterChange();
                
                // Show success message
                DTIBacktester.utils.showNotification('Charts updated with new parameters', 'success');
            });
        });
    }

    // IMPORTANT: Create these wrapper functions to expose on the DTIUI object
    
    // Expose createCharts directly on DTIUI object
    DTIUI.createCharts = createCharts;

    // Create stub functions for displayStatistics and displayTrades that dynamically look for implementations
    if (!DTIUI.displayStatistics) {
        DTIUI.displayStatistics = function(trades) {
            // Check if TradeDisplay module is available at call time
            if (DTIUI.TradeDisplay && typeof DTIUI.TradeDisplay.displayStatistics === 'function') {
                return DTIUI.TradeDisplay.displayStatistics(trades);
            } else {
                // Try fallback to original statistics element if it exists
                const statsElement = document.getElementById('statistics');
                if (statsElement) {
                    // Basic stats display as fallback
                    let winCount = 0;
                    trades.forEach(trade => {
                        if (trade.plPercent > 0) winCount++;
                    });
                    
                    const winRate = trades.length > 0 ? (winCount / trades.length * 100).toFixed(2) : 0;
                    
                    statsElement.innerHTML = `
                        <div class="statistic">
                            <div class="statistic-value">${trades.length}</div>
                            <div class="statistic-label">Total Trades</div>
                        </div>
                        <div class="statistic">
                            <div class="statistic-value">${winCount}</div>
                            <div class="statistic-label">Winning Trades</div>
                        </div>
                        <div class="statistic">
                            <div class="statistic-value">${winRate}%</div>
                            <div class="statistic-label">Win Rate</div>
                        </div>
                    `;
                }
            }
        };
    }

if (!DTIUI.displayTrades) {
    DTIUI.displayTrades = function(trades) {
        // Check if TradeDisplay module is available at call time
        if (DTIUI.TradeDisplay && typeof DTIUI.TradeDisplay.displayTrades === 'function') {
            return DTIUI.TradeDisplay.displayTrades(trades);
        } else {
            // Try fallback to original trade table if it exists
            const tradesTable = document.getElementById('trades-table');
            if (tradesTable) {
                // Create a basic table header
                let tableHtml = `
                    <thead>
                        <tr>
                            <th>Entry Date</th>
                            <th>Exit Date</th>
                            <th>Entry Price</th>
                            <th>Exit Price</th>
                            <th>Holding Period Days</th>
                            <th>P/L %</th>
                            <th>Exit Reason</th>
                        </tr>
                    </thead>
                    <tbody>
                `;
                
                // Add rows for each trade
                trades.forEach(trade => {
                    const plClass = trade.plPercent > 0 ? 'profit' : 'loss';
                    
                    // Calculate holding period days
                    let holdingDays = '-';
                    if (trade.exitDate) {
                        // For completed trades
                        const entryDate = new Date(trade.entryDate);
                        const exitDate = new Date(trade.exitDate);
                        const diffTime = Math.abs(exitDate - entryDate);
                        holdingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    } else if (trade.entryDate) {
                        // For active trades - calculate days from entry to current date
                        const entryDate = new Date(trade.entryDate);
                        const currentDate = new Date();
                        const diffTime = Math.abs(currentDate - entryDate);
                        holdingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + ' (Active)';
                    }
                    
                    tableHtml += `
                        <tr>
                            <td>${trade.entryDate}</td>
                            <td>${trade.exitDate || 'Active'}</td>
                            <td>${trade.entryPrice.toFixed(2)}</td>
                            <td>${trade.exitPrice ? trade.exitPrice.toFixed(2) : '-'}</td>
                            <td>${holdingDays}</td>
                            <td class="${plClass}">${trade.plPercent.toFixed(2)}%</td>
                            <td>${trade.exitReason || '-'}</td>
                        </tr>
                    `;
                });
                
                tableHtml += `</tbody>`;
                tradesTable.innerHTML = tableHtml;
            }
        }
    };
}


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
    
    /**
     * Add export buttons to each chart
     */
    function addExportButtons() {
        const chartContainers = [
            { id: 'price-chart', title: 'Price Chart' },
            { id: 'dti-chart', title: 'Primary Indicator' },
            { id: 'weekly-dti-chart', title: 'Secondary Indicator' }
        ];
        
        chartContainers.forEach(({ id, title }) => {
            const canvas = document.getElementById(id);
            if (!canvas) return;

            // Check if canvas is already wrapped by looking up the DOM tree
            let container = canvas.closest('.chart-wrapper');

            // If not wrapped, check immediate parent
            if (!container) {
                container = canvas.parentElement;

                // Only wrap if not already inside a chart-wrapper
                if (!container.classList.contains('chart-wrapper')) {
                    // If no wrapper exists, wrap the canvas ONLY ONCE
                    const newWrapper = document.createElement('div');
                    newWrapper.className = 'chart-wrapper';
                    newWrapper.setAttribute('data-chart-id', id); // Mark wrapper to prevent re-wrapping
                    canvas.parentNode.insertBefore(newWrapper, canvas);
                    newWrapper.appendChild(canvas);
                    container = newWrapper;
                }
            }

            // Check if export button already exists - skip if it does
            const existingButton = container.querySelector('.export-chart-btn.chart-export-btn');
            if (existingButton) {
                return; // Skip this chart, button already exists
            }
            
            const exportBtn = document.createElement('button');
            exportBtn.className = 'export-chart-btn chart-export-btn'; // Add unique class
            exportBtn.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>Export</span>
            `;
            exportBtn.title = `Export ${title}`;
            
            exportBtn.addEventListener('click', () => {
                console.log('[CHART FEATURE] Export button clicked for:', title);
                const chart = Chart.getChart(canvas);
                if (chart) {
                    console.log('[CHART FEATURE] Exporting chart:', id);
                    // Use the existing export function
                    exportChartAsImage(chart, `${title.toLowerCase().replace(/\s+/g, '-')}_${new Date().toISOString().slice(0,10)}`);
                } else {
                    console.warn('[CHART FEATURE] Chart not found for export:', id);
                }
            });
            
            container.style.position = 'relative';
            container.appendChild(exportBtn);
        });
    }
    
    /**
     * Export chart as image
     */
    function exportChartAsImage(chart, filename = 'chart') {
        if (!chart) return;
        
        // Create a temporary link element
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = chart.toBase64Image('image/png', 1.0);
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        if (typeof DTIBacktester !== 'undefined' && DTIBacktester.utils) {
            DTIBacktester.utils.showNotification('Chart exported as image', 'success');
        }
    }

    // Export functions for external use
    return {
        createCharts,
        updateChartsAfterParameterChange,
        initParameterChangeListeners,
        restoreAnnotations,
        addExportButtons,
        addChartTypeToggle
    };
})();

// Make chart functions available globally
window.DTIChartHelpers = {
    updateChartsAfterParameterChange: DTIUI.Charts.updateChartsAfterParameterChange,
    initParameterChangeListeners: DTIUI.Charts.initParameterChangeListeners
};