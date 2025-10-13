/**
 * Advanced Chart Features
 * Pan & Zoom, Drawing Tools, Time Range Selector, Export
 */

class AdvancedChartFeatures {
    constructor() {
        this.charts = new Map();
        this.crosshair = null;
        this.timeRangeSelector = null;
        this.drawingTools = new Map();
        
        this.init();
    }

    init() {
        // Wait for charts to be initialized
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                this.initializeFeatures();
            }, 1000);
        });
    }

    initializeFeatures() {
        // Find all chart canvases
        const chartCanvases = document.querySelectorAll('canvas');
        
        chartCanvases.forEach(canvas => {
            const chartInstance = Chart.getChart(canvas);
            if (chartInstance) {
                const chartId = canvas.id;
                this.charts.set(chartId, chartInstance);
                
                // Only add features if they haven't been added already
                if (!chartInstance.advancedInteraction) {
                    // Add pan & zoom
                    this.addPanZoom(chartInstance);
                    
                    // Add drawing tools
                    this.addDrawingTools(chartInstance);
                }
            }
        });
        
        // Initialize synchronized crosshair only if not already initialized
        if (this.charts.size > 0 && !this.crosshair) {
            this.crosshair = new SynchronizedCrosshair(Array.from(this.charts.values()));
        }
        
        // Initialize time range selector only if not already initialized
        if (this.charts.size > 0 && !this.timeRangeSelector) {
            this.timeRangeSelector = new TimeRangeSelector(Array.from(this.charts.values()));
        }
    }

    addPanZoom(chart) {
        const interaction = new AdvancedChartInteraction(chart);
        chart.advancedInteraction = interaction;
    }

    addDrawingTools(chart) {
        const tools = new ChartDrawingTools(chart);
        this.drawingTools.set(chart.canvas.id, tools);
    }
}

/**
 * Advanced Chart Interaction (Pan & Zoom)
 */
class AdvancedChartInteraction {
    constructor(chart) {
        this.chart = chart;
        this.isPanning = false;
        this.startX = 0;
        this.startY = 0;
        this.zoomLevel = 1;
        this.panOffset = { x: 0, y: 0 };
        
        this.initializeInteractions();
        this.createZoomControls();
    }

    initializeInteractions() {
        const canvas = this.chart.canvas;
        
        // Prevent default chart.js interactions
        this.chart.options.interaction = {
            ...this.chart.options.interaction,
            mode: 'nearest',
            intersect: false
        };
        
        // Mouse wheel zoom
        canvas.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const zoomAmount = e.deltaY > 0 ? 0.9 : 1.1;
                this.zoomAtPoint(x, y, zoomAmount);
            }
        });
        
        // Touch pinch zoom
        this.initializeTouchZoom(canvas);
        
        // Pan functionality
        this.initializePan(canvas);
        
        // Double click to reset
        canvas.addEventListener('dblclick', () => {
            this.resetZoom();
        });
    }

    initializeTouchZoom(canvas) {
        let lastDistance = 0;
        let touches = [];
        
        canvas.addEventListener('touchstart', (e) => {
            touches = Array.from(e.touches);
            if (touches.length === 2) {
                lastDistance = this.getTouchDistance(touches);
            }
        });
        
        canvas.addEventListener('touchmove', (e) => {
            touches = Array.from(e.touches);
            if (touches.length === 2) {
                e.preventDefault();
                const distance = this.getTouchDistance(touches);
                const scale = distance / lastDistance;
                
                // Get center point between touches
                const centerX = (touches[0].clientX + touches[1].clientX) / 2;
                const centerY = (touches[0].clientY + touches[1].clientY) / 2;
                
                const rect = canvas.getBoundingClientRect();
                this.zoomAtPoint(
                    centerX - rect.left,
                    centerY - rect.top,
                    scale
                );
                
                lastDistance = distance;
            }
        });
    }

    getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    initializePan(canvas) {
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let startMinX, startMaxX, startMinY, startMaxY;
        
        canvas.addEventListener('mousedown', (e) => {
            if (e.shiftKey) {
                isDragging = true;
                canvas.style.cursor = 'grabbing';
                
                startX = e.clientX;
                startY = e.clientY;
                
                // Store initial scale bounds
                startMinX = this.chart.scales.x.options.min;
                startMaxX = this.chart.scales.x.options.max;
                startMinY = this.chart.scales.y.options.min;
                startMaxY = this.chart.scales.y.options.max;
            }
        });
        
        canvas.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                
                // Calculate pan amount in data coordinates
                const xScale = this.chart.scales.x;
                const yScale = this.chart.scales.y;
                
                const xRange = xScale.max - xScale.min;
                const yRange = yScale.max - yScale.min;
                
                const xPan = (deltaX / canvas.width) * xRange;
                const yPan = (deltaY / canvas.height) * yRange;
                
                // Update scales
                xScale.options.min = startMinX - xPan;
                xScale.options.max = startMaxX - xPan;
                yScale.options.min = startMinY + yPan;
                yScale.options.max = startMaxY + yPan;
                
                this.chart.update('none');
            }
        });
        
        canvas.addEventListener('mouseup', () => {
            isDragging = false;
            canvas.style.cursor = 'default';
        });
        
        canvas.addEventListener('mouseleave', () => {
            isDragging = false;
            canvas.style.cursor = 'default';
        });
    }

    zoomAtPoint(x, y, zoomAmount) {
        const chart = this.chart;
        
        // Skip if no scales
        if (!chart.scales.x || !chart.scales.y) return;
        
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;
        
        // Calculate the point in data coordinates
        const dataX = xScale.getValueForPixel(x);
        const dataY = yScale.getValueForPixel(y);
        
        // Apply zoom
        const newZoom = Math.max(0.5, Math.min(10, this.zoomLevel * zoomAmount));
        const zoomDelta = newZoom / this.zoomLevel;
        
        // Update scale ranges
        const xRange = xScale.max - xScale.min;
        const yRange = yScale.max - yScale.min;
        
        const newXRange = xRange / zoomDelta;
        const newYRange = yRange / zoomDelta;
        
        // Center the zoom on the cursor position
        const xRatio = x / chart.width;
        const yRatio = y / chart.height;
        
        xScale.options.min = dataX - xRatio * newXRange;
        xScale.options.max = dataX + (1 - xRatio) * newXRange;
        
        yScale.options.min = dataY - (1 - yRatio) * newYRange;
        yScale.options.max = dataY + yRatio * newYRange;
        
        this.zoomLevel = newZoom;
        chart.update('none');
        
        // Show zoom level indicator
        this.showZoomIndicator(newZoom);
    }

    resetZoom() {
        // Remove min/max constraints to show all data
        delete this.chart.scales.x.options.min;
        delete this.chart.scales.x.options.max;
        delete this.chart.scales.y.options.min;
        delete this.chart.scales.y.options.max;
        
        this.zoomLevel = 1;
        this.chart.update();
        
        this.showZoomIndicator(1);
    }

    createZoomControls() {
        // Find the chart wrapper (should be .chart-wrapper)
        let container = this.chart.canvas.parentElement;
        
        // If the parent isn't the chart-wrapper, look for it
        if (!container.classList.contains('chart-wrapper')) {
            const wrapper = container.closest('.chart-wrapper');
            if (wrapper) {
                container = wrapper;
            }
        }
        
        // Check if controls already exist
        if (container.querySelector('.chart-zoom-controls')) return;
        
        const controls = document.createElement('div');
        controls.className = 'chart-zoom-controls';
        controls.innerHTML = `
            <button class="zoom-btn" id="zoom-in" title="Zoom In">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                    <line x1="11" y1="8" x2="11" y2="14"></line>
                    <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
            </button>
            <button class="zoom-btn" id="zoom-out" title="Zoom Out">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                    <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
            </button>
            <button class="zoom-btn" id="zoom-reset" title="Reset Zoom">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
            </button>
        `;
        
        container.style.position = 'relative';
        container.appendChild(controls);
        
        // Add event listeners
        controls.querySelector('#zoom-in').addEventListener('click', () => {
            const centerX = this.chart.width / 2;
            const centerY = this.chart.height / 2;
            this.zoomAtPoint(centerX, centerY, 1.2);
        });
        
        controls.querySelector('#zoom-out').addEventListener('click', () => {
            const centerX = this.chart.width / 2;
            const centerY = this.chart.height / 2;
            this.zoomAtPoint(centerX, centerY, 0.8);
        });
        
        controls.querySelector('#zoom-reset').addEventListener('click', () => {
            this.resetZoom();
        });
    }

    showZoomIndicator(zoomLevel) {
        let indicator = document.getElementById('zoom-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'zoom-indicator';
            indicator.className = 'zoom-indicator';
            document.body.appendChild(indicator);
        }
        
        indicator.textContent = `${Math.round(zoomLevel * 100)}%`;
        indicator.style.opacity = '1';
        
        clearTimeout(this.zoomIndicatorTimeout);
        this.zoomIndicatorTimeout = setTimeout(() => {
            indicator.style.opacity = '0';
        }, 1500);
    }
}

/**
 * Chart Drawing Tools
 */
class ChartDrawingTools {
    constructor(chart) {
        this.chart = chart;
        this.currentTool = null;
        this.drawings = [];
        this.isDrawing = false;
        this.selectedDrawing = null;
        
        this.initializeToolbar();
        this.initializeDrawingLayer();
    }

    initializeToolbar() {
        // Find the chart wrapper (should be .chart-wrapper)
        let container = this.chart.canvas.parentElement;
        
        // If the parent isn't the chart-wrapper, look for it
        if (!container.classList.contains('chart-wrapper')) {
            const wrapper = container.closest('.chart-wrapper');
            if (wrapper) {
                container = wrapper;
            }
        }
        
        // Check if toolbar already exists
        if (container.querySelector('.chart-toolbar')) return;
        
        const toolbar = document.createElement('div');
        toolbar.className = 'chart-toolbar';
        toolbar.innerHTML = `
            <div class="tool-group">
                <button class="tool-btn active" data-tool="pointer" title="Select/Move (V)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path>
                    </svg>
                </button>
                <button class="tool-btn" data-tool="trendline" title="Trendline (T)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="3" y1="20" x2="21" y2="4"></line>
                    </svg>
                </button>
                <button class="tool-btn" data-tool="horizontal" title="Horizontal Line (H)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                    </svg>
                </button>
                <button class="tool-btn" data-tool="text" title="Text Note (A)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                </button>
            </div>
            <div class="tool-group">
                <button class="tool-btn" id="clear-drawings" title="Clear All">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `;
        
        container.appendChild(toolbar);
        this.attachToolbarEvents(toolbar);
    }

    initializeDrawingLayer() {
        // Find the chart wrapper
        let container = this.chart.canvas.parentElement;
        
        // Create overlay canvas for drawings
        const drawingCanvas = document.createElement('canvas');
        drawingCanvas.className = 'drawing-overlay';
        drawingCanvas.width = this.chart.canvas.width;
        drawingCanvas.height = this.chart.canvas.height;
        
        // Position it over the chart canvas
        const canvasRect = this.chart.canvas.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Dynamic positioning
        drawingCanvas.style.position = 'absolute';
        drawingCanvas.style.top = `${canvasRect.top - containerRect.top}px`;
        drawingCanvas.style.left = `${canvasRect.left - containerRect.left}px`;
        drawingCanvas.style.width = `${this.chart.canvas.offsetWidth}px`;
        drawingCanvas.style.height = `${this.chart.canvas.offsetHeight}px`;
        drawingCanvas.style.pointerEvents = 'none';
        drawingCanvas.style.zIndex = '10';
        
        container.appendChild(drawingCanvas);
        this.drawingCanvas = drawingCanvas;
        this.drawingCtx = drawingCanvas.getContext('2d');
        
        // Update drawing canvas size when chart resizes
        const resizeObserver = new ResizeObserver(() => {
            drawingCanvas.width = this.chart.canvas.width;
            drawingCanvas.height = this.chart.canvas.height;
            this.redrawAll();
        });
        resizeObserver.observe(this.chart.canvas);
    }

    attachToolbarEvents(toolbar) {
        // Tool selection
        toolbar.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectTool(btn.dataset.tool);
                
                // Update active state
                toolbar.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        
        // Clear all drawings
        toolbar.querySelector('#clear-drawings').addEventListener('click', () => {
            if (confirm('Clear all drawings?')) {
                this.clearAll();
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            switch(e.key.toLowerCase()) {
                case 'v': this.selectTool('pointer'); break;
                case 't': this.selectTool('trendline'); break;
                case 'h': this.selectTool('horizontal'); break;
                case 'a': this.selectTool('text'); break;
                case 'delete': this.deleteSelected(); break;
            }
        });
    }

    selectTool(toolName) {
        this.currentTool = toolName;
        this.chart.canvas.style.cursor = toolName === 'pointer' ? 'default' : 'crosshair';
        
        // Enable/disable chart pan based on tool
        if (this.chart.advancedInteraction) {
            this.chart.canvas.style.pointerEvents = toolName === 'pointer' ? 'auto' : 'none';
        }
    }

    addDrawing(drawing) {
        drawing.id = Date.now();
        this.drawings.push(drawing);
        this.redrawAll();
    }

    clearAll() {
        this.drawings = [];
        this.selectedDrawing = null;
        this.redrawAll();
    }

    deleteSelected() {
        if (this.selectedDrawing) {
            this.drawings = this.drawings.filter(d => d.id !== this.selectedDrawing.id);
            this.selectedDrawing = null;
            this.redrawAll();
        }
    }

    redrawAll() {
        this.drawingCtx.clearRect(0, 0, this.drawingCanvas.width, this.drawingCanvas.height);
        
        this.drawings.forEach(drawing => {
            this.drawDrawing(drawing);
        });
    }

    drawDrawing(drawing) {
        const ctx = this.drawingCtx;
        ctx.save();
        
        switch(drawing.type) {
            case 'trendline':
                this.drawTrendline(ctx, drawing);
                break;
            case 'horizontal':
                this.drawHorizontalLine(ctx, drawing);
                break;
            case 'text':
                this.drawTextNote(ctx, drawing);
                break;
        }
        
        ctx.restore();
    }

    drawTrendline(ctx, drawing) {
        const { startPoint, endPoint, style } = drawing;
        
        // Convert data points to pixel coordinates
        const x1 = this.chart.scales.x.getPixelForValue(startPoint.x);
        const y1 = this.chart.scales.y.getPixelForValue(startPoint.y);
        const x2 = this.chart.scales.x.getPixelForValue(endPoint.x);
        const y2 = this.chart.scales.y.getPixelForValue(endPoint.y);
        
        ctx.strokeStyle = style.color || '#2563eb';
        ctx.lineWidth = style.width || 2;
        ctx.setLineDash(style.dash || []);
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        
        // Draw endpoints if selected
        if (this.selectedDrawing && this.selectedDrawing.id === drawing.id) {
            this.drawHandle(ctx, x1, y1);
            this.drawHandle(ctx, x2, y2);
        }
    }

    drawHandle(ctx, x, y) {
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
}

/**
 * Synchronized Crosshair
 */
class SynchronizedCrosshair {
    constructor(charts) {
        this.charts = charts;
        this.currentPosition = null;
        this.activeChart = null;
        
        this.initializeCrosshair();
    }

    initializeCrosshair() {
        this.charts.forEach(chart => {
            const canvas = chart.canvas;
            
            canvas.addEventListener('mousemove', (e) => {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                this.updateCrosshair(chart, x, y);
            });
            
            canvas.addEventListener('mouseleave', () => {
                this.hideCrosshair();
            });
        });
    }

    updateCrosshair(activeChart, x, y) {
        this.activeChart = activeChart;
        
        // Get data value at cursor position
        const dataX = activeChart.scales.x.getValueForPixel(x);
        
        // Update all charts
        this.charts.forEach(chart => {
            this.drawCrosshairOnChart(chart, dataX, chart === activeChart ? y : null);
        });
    }

    hideCrosshair() {
        this.charts.forEach(chart => {
            const overlay = chart.canvas.parentElement.querySelector('.crosshair-overlay');
            if (overlay) {
                overlay.style.display = 'none';
            }
        });
    }

    drawCrosshairOnChart(chart, dataX, mouseY) {
        // Check if chart has scales initialized
        if (!chart.scales || !chart.scales.x) {
            return;
        }
        
        let overlay = chart.canvas.parentElement.querySelector('.crosshair-overlay');
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'crosshair-overlay';
            chart.canvas.parentElement.appendChild(overlay);
        }
        
        overlay.style.display = 'block';
        
        // Calculate pixel position for the data value
        const x = chart.scales.x.getPixelForValue(dataX);
        const chartArea = chart.chartArea;
        
        // Clear previous crosshair
        overlay.innerHTML = '';
        
        // Vertical line
        const vLine = document.createElement('div');
        vLine.className = 'crosshair-line vertical';
        vLine.style.left = `${x}px`;
        vLine.style.top = `${chartArea.top}px`;
        vLine.style.height = `${chartArea.bottom - chartArea.top}px`;
        overlay.appendChild(vLine);
        
        // Horizontal line (only on active chart)
        if (mouseY !== null) {
            const hLine = document.createElement('div');
            hLine.className = 'crosshair-line horizontal';
            hLine.style.left = `${chartArea.left}px`;
            hLine.style.top = `${mouseY}px`;
            hLine.style.width = `${chartArea.right - chartArea.left}px`;
            overlay.appendChild(hLine);
        }
        
        // Data value labels
        this.drawDataLabels(chart, overlay, dataX, x);
    }

    drawDataLabels(chart, overlay, dataX, pixelX) {
        const datasets = chart.data.datasets;
        
        datasets.forEach((dataset, index) => {
            if (dataset.hidden) return;
            
            // Find closest data point
            const dataIndex = this.findClosestDataIndex(dataset.data, dataX);
            if (dataIndex === -1) return;
            
            const value = dataset.data[dataIndex];
            const y = chart.scales.y.getPixelForValue(value);
            
            // Create label
            const label = document.createElement('div');
            label.className = 'crosshair-label';
            label.style.left = `${pixelX + 5}px`;
            label.style.top = `${y - 10}px`;
            label.style.background = dataset.borderColor || dataset.backgroundColor;
            label.textContent = this.formatValue(value);
            overlay.appendChild(label);
            
            // Add dot on line
            const dot = document.createElement('div');
            dot.className = 'crosshair-dot';
            dot.style.left = `${pixelX - 4}px`;
            dot.style.top = `${y - 4}px`;
            dot.style.background = dataset.borderColor || dataset.backgroundColor;
            overlay.appendChild(dot);
        });
    }

    findClosestDataIndex(data, targetX) {
        // Simple linear search - could be optimized with binary search
        let closestIndex = -1;
        let closestDistance = Infinity;
        
        data.forEach((point, index) => {
            const distance = Math.abs(index - targetX);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = index;
            }
        });
        
        return closestIndex;
    }

    formatValue(value) {
        if (typeof value === 'number') {
            return value.toFixed(2);
        }
        return value;
    }
}

/**
 * Time Range Selector
 */
class TimeRangeSelector {
    constructor(charts) {
        this.charts = charts;
        this.currentRange = 'ALL';
        this.fullData = new Map();
        
        this.ranges = {
            '1D': { days: 1, label: '1D' },
            '1W': { days: 7, label: '1W' },
            '1M': { days: 30, label: '1M' },
            '3M': { days: 90, label: '3M' },
            '6M': { days: 180, label: '6M' },
            '1Y': { days: 365, label: '1Y' },
            'ALL': { days: null, label: 'ALL' }
        };
        
        this.createSelector();
    }

    createSelector() {
        const chartContainer = document.querySelector('.charts-container');
        if (!chartContainer) return;
        
        const selector = document.createElement('div');
        selector.className = 'time-range-selector';
        selector.innerHTML = `
            <div class="range-buttons">
                ${Object.entries(this.ranges).map(([key, range]) => `
                    <button class="range-btn ${key === 'ALL' ? 'active' : ''}" 
                            data-range="${key}">
                        ${range.label}
                    </button>
                `).join('')}
            </div>
        `;
        
        // Insert at the top of charts container
        chartContainer.insertBefore(selector, chartContainer.firstChild);
        
        this.attachEvents(selector);
    }

    attachEvents(selector) {
        selector.querySelectorAll('.range-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const range = btn.dataset.range;
                this.applyRange(range);
                
                // Update active state
                selector.querySelectorAll('.range-btn').forEach(b => 
                    b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    applyRange(rangeKey) {
        const range = this.ranges[rangeKey];
        const days = range.days;
        
        this.charts.forEach(chart => {
            // Store full data if not already stored
            if (!this.fullData.has(chart)) {
                this.fullData.set(chart, {
                    labels: [...chart.data.labels],
                    datasets: chart.data.datasets.map(ds => ({
                        ...ds,
                        data: [...ds.data]
                    }))
                });
            }
            
            const fullData = this.fullData.get(chart);
            
            if (days === null) {
                // Show all data
                chart.data.labels = [...fullData.labels];
                chart.data.datasets.forEach((dataset, i) => {
                    dataset.data = [...fullData.datasets[i].data];
                });
            } else {
                // Filter to last N days
                const numPoints = Math.min(days, fullData.labels.length);
                const startIndex = fullData.labels.length - numPoints;
                
                chart.data.labels = fullData.labels.slice(startIndex);
                chart.data.datasets.forEach((dataset, i) => {
                    dataset.data = fullData.datasets[i].data.slice(startIndex);
                });
            }
            
            // Reset zoom when changing range
            if (chart.advancedInteraction) {
                chart.advancedInteraction.resetZoom();
            }
            
            chart.update('active');
        });
    }
}

/**
 * Chart Export Functionality
 */
class ChartExporter {
    static exportChart(chart, options = {}) {
        const {
            format = 'png',
            width = 1920,
            height = 1080,
            quality = 1.0,
            filename = `chart_${new Date().toISOString().slice(0,10)}`
        } = options;

        if (format === 'png') {
            this.exportAsPNG(chart, { width, height, quality, filename });
        } else if (format === 'svg') {
            this.exportAsSVG(chart, { filename });
        }
    }

    static exportAsPNG(chart, options) {
        const { width, height, quality, filename } = options;

        // Create offscreen canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Calculate scale to fit chart
        const scale = Math.min(
            (width - 100) / chart.width,
            (height - 100) / chart.height
        );

        // Center the chart
        const offsetX = (width - chart.width * scale) / 2;
        const offsetY = (height - chart.height * scale) / 2;

        // Draw scaled chart
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
        
        // Draw the chart
        const chartCanvas = chart.canvas;
        ctx.drawImage(chartCanvas, 0, 0);
        
        ctx.restore();

        // Add title and metadata
        ctx.font = 'bold 24px Inter';
        ctx.fillStyle = '#111827';
        ctx.textAlign = 'center';
        ctx.fillText(chart.options.plugins?.title?.text || 'Chart Export', width / 2, 40);

        // Add timestamp
        ctx.font = '14px Inter';
        ctx.fillStyle = '#6b7280';
        ctx.textAlign = 'right';
        ctx.fillText(`Exported: ${new Date().toLocaleString()}`, width - 20, height - 20);

        // Add watermark
        ctx.font = '14px Inter';
        ctx.fillStyle = '#6b7280';
        ctx.textAlign = 'left';
        ctx.fillText('SignalForge Trading Platform', 20, height - 20);

        // Convert to blob and download
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}.png`;
            a.click();
            URL.revokeObjectURL(url);
        }, 'image/png', quality);
    }

    static exportAsSVG(chart, options) {
        // For SVG export, we would need to recreate the chart using SVG elements
        // This is a simplified version
        alert('SVG export is not yet implemented. Please use PNG export.');
    }
}

// Initialize when ready
const advancedCharts = new AdvancedChartFeatures();

// Make exporter globally available
window.ChartExporter = ChartExporter;