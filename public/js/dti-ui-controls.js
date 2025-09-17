/**
 * DTI Backtester - UI Controls Module
 * Handles chart controls, annotations, and trade detail modals
 */

// Create Controls namespace
DTIUI.Controls = (function() {
    // Chart control variables
    let isAnnotationMode = false;
    let tradeDetailChart = null;

    /**
     * Add chart control UI elements to the page
     */
    function addChartControls() {
        // Create chart controls container
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'chart-controls-container';
        controlsContainer.innerHTML = `
            <div class="chart-controls">
                <div class="control-group date-range-controls">
                    <span class="control-label">Time Range:</span>
                    <button class="range-btn" data-range="1m">1M</button>
                    <button class="range-btn" data-range="3m">3M</button>
                    <button class="range-btn" data-range="6m">6M</button>
                    <button class="range-btn" data-range="1y">1Y</button>
                    <button class="range-btn active" data-range="all">All</button>
                </div>
                
                <div class="control-group visibility-controls">
                    <span class="control-label">Display:</span>
                    <label class="toggle-control">
                        <input type="checkbox" data-series="price" checked>
                        <span class="toggle-label">Price</span>
                    </label>
                    <label class="toggle-control">
                        <input type="checkbox" data-series="entries" checked>
                        <span class="toggle-label">Entries</span>
                    </label>
                    <label class="toggle-control">
                        <input type="checkbox" data-series="exits" checked>
                        <span class="toggle-label">Exits</span>
                    </label>
                </div>
                
                <div class="control-group button-controls">
                    <button class="control-btn reset-zoom-btn" title="Reset Zoom">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"></path>
                            <path d="M3 9V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"></path>
                            <path d="M12 14v3"></path>
                        </svg>
                        <span class="btn-text">Reset Zoom</span>
                    </button>
                    
                    <button class="control-btn export-chart-btn" title="Export Chart">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        <span class="btn-text">Export Chart</span>
                    </button>
                    
                    <button class="control-btn annotate-btn" title="Add Annotation">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 20h9"></path>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                        <span class="btn-text">Annotate</span>
                    </button>
                </div>
            </div>
        `;
        
        // Add the control panel to the page
        const chartContainer = document.querySelector('.chart-section');
        if (chartContainer) {
            chartContainer.prepend(controlsContainer);
        } else {
            // Fallback: Add to the first chart wrapper
            const firstChartWrapper = document.querySelector('.chart-wrapper');
            if (firstChartWrapper) {
                firstChartWrapper.parentNode.insertBefore(controlsContainer, firstChartWrapper);
            }
        }
        
        // Add CSS for chart controls
        const style = document.createElement('style');
        style.textContent = `
            .chart-controls-container {
                margin-bottom: 15px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            
            .chart-controls {
                display: flex;
                flex-wrap: wrap;
                gap: 15px;
                padding: 12px 15px;
                align-items: center;
                justify-content: space-between;
            }
            
            .control-group {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .control-label {
                font-size: 12px;
                font-weight: 500;
                color: #64748b;
                margin-right: 4px;
            }
            
            .range-btn {
                background: #f1f5f9;
                border: none;
                border-radius: 4px;
                padding: 5px 10px;
                font-size: 12px;
                font-weight: 500;
                color: #475569;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .range-btn:hover {
                background: #e2e8f0;
            }
            
            .range-btn.active {
                background: #3b82f6;
                color: white;
            }
            
            .toggle-control {
                display: flex;
                align-items: center;
                gap: 5px;
                cursor: pointer;
            }
            
            .toggle-label {
                font-size: 12px;
                color: #475569;
            }
            
            .control-btn {
                display: flex;
                align-items: center;
                gap: 6px;
                background: #f1f5f9;
                border: none;
                border-radius: 4px;
                padding: 5px 10px;
                font-size: 12px;
                font-weight: 500;
                color: #475569;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .control-btn:hover {
                background: #e2e8f0;
            }
            
            .control-btn svg {
                width: 14px;
                height: 14px;
            }
            
            .export-chart-btn {
                background-color: #10b981;
                color: white;
            }
            
            .export-chart-btn:hover {
                background-color: #059669;
            }
            
            .annotate-btn {
                background-color: #8b5cf6;
                color: white;
            }
            
            .annotate-btn:hover {
                background-color: #7c3aed;
            }
            
            /* Dark mode styles */
            [data-theme="dark"] .chart-controls-container {
                background: #1e293b;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            }
            
            [data-theme="dark"] .control-label {
                color: #cbd5e1;
            }
            
            [data-theme="dark"] .range-btn {
                background: #334155;
                color: #e2e8f0;
                border-color: #475569;
            }
            
            [data-theme="dark"] .range-btn:hover,
            [data-theme="dark"] .range-btn.active {
                background: #2563eb;
                color: white;
                border-color: #2563eb;
            }
            
            [data-theme="dark"] .control-btn {
                background: #334155;
                color: #e2e8f0;
            }
            
            [data-theme="dark"] .control-btn:hover {
                background: #475569;
            }
            
            [data-theme="dark"] .export-chart-btn {
                background-color: #10b981;
                color: white;
            }
            
            [data-theme="dark"] .export-chart-btn:hover {
                background-color: #059669;
            }
            
            [data-theme="dark"] .annotate-btn {
                background-color: #8b5cf6;
                color: white;
            }
            
            [data-theme="dark"] .annotate-btn:hover {
                background-color: #7c3aed;
            }
            
            [data-theme="dark"] .chart-type-toggle {
                background: #334155;
                color: #e2e8f0;
            }
            
            [data-theme="dark"] .chart-type-toggle:hover {
                background: #475569;
                color: white;
            }
            
            [data-theme="dark"] .toggle-control input[type="checkbox"] {
                accent-color: #2563eb;
            }
            
            [data-theme="dark"] .toggle-label {
                color: #cbd5e1;
            }
            
            /* Mobile Optimizations */
            @media (max-width: 768px) {
                .chart-controls-container {
                    margin-bottom: 8px;
                }
                
                .chart-controls {
                    flex-direction: column;
                    gap: 8px;
                    padding: 8px 10px;
                }
                
                .control-group {
                    gap: 4px;
                    flex-wrap: wrap;
                    justify-content: center;
                }
                
                .control-label {
                    font-size: 10px;
                    margin-right: 2px;
                }
                
                .range-btn {
                    padding: 3px 6px;
                    font-size: 10px;
                    border-radius: 3px;
                }
                
                .control-btn {
                    padding: 3px 6px;
                    font-size: 10px;
                    gap: 3px;
                }
                
                .control-btn svg {
                    width: 10px;
                    height: 10px;
                }
                
                .toggle-control {
                    gap: 3px;
                }
                
                .toggle-label {
                    font-size: 10px;
                }
                
                /* Hide text labels on very small screens, keep only icons */
                .control-btn .btn-text {
                    display: none;
                }
            }
            
            @media (max-width: 576px) {
                .chart-controls {
                    padding: 4px 6px;
                    gap: 4px;
                }
                
                .control-group {
                    gap: 2px;
                }
                
                .range-btn {
                    padding: 1px 3px;
                    font-size: 8px;
                }
                
                .control-btn {
                    padding: 2px 3px;
                    font-size: 8px;
                }
                
                .control-btn svg {
                    width: 8px;
                    height: 8px;
                }
                
                .control-label {
                    font-size: 8px;
                }
                
                .toggle-label {
                    font-size: 8px;
                }
                
                /* Hide some control groups on very small screens */
                .visibility-controls {
                    display: none;
                }
                
                /* Make date range controls more compact */
                .date-range-controls .control-label {
                    display: none;
                }
            }
            
            /* Trade detail modal styles */
            .trade-detail-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.3s, visibility 0.3s;
            }
            
            .trade-detail-modal.visible {
                opacity: 1;
                visibility: visible;
            }
            
            .modal-content {
                background: white;
                border-radius: 8px;
                width: 90%;
                max-width: 500px;
                max-height: 90vh;
                overflow-y: auto;
                padding: 20px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                transform: translateY(20px);
                transition: transform 0.3s;
            }
            
            .trade-detail-modal.visible .modal-content {
                transform: translateY(0);
            }
            
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid #e2e8f0;
            }
            
            .modal-title {
                font-size: 18px;
                font-weight: 600;
                color: #1e293b;
            }
            
            .close-modal {
                background: none;
                border: none;
                cursor: pointer;
                color: #64748b;
                padding: 5px;
            }
            
            .close-modal:hover {
                color: #1e293b;
            }
            
            .trade-details {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 15px;
            }
            
            .detail-group {
                margin-bottom: 10px;
            }
            
            .detail-label {
                font-size: 12px;
                color: #64748b;
                margin-bottom: 4px;
            }
            
            .detail-value {
                font-size: 14px;
                font-weight: 500;
                color: #1e293b;
            }
            
            .detail-value.positive {
                color: #10b981;
            }
            
            .detail-value.negative {
                color: #ef4444;
            }
            
            .trade-chart-mini {
                margin-top: 15px;
                height: 200px;
                width: 100%;
            }
            
            /* Annotation tooltip */
            .annotation-tooltip {
                position: absolute;
                background: white;
                border-radius: 4px;
                padding: 8px 12px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                font-size: 12px;
                pointer-events: none;
                z-index: 100;
                display: none;
            }
            
            /* Highlight mode for annotations */
            .annotation-mode .chart-wrapper {
                cursor: crosshair !important;
                position: relative;
            }
            
            .annotation-mode .chart-wrapper::after {
                content: 'Click on chart to add annotation';
                position: absolute;
                top: 10px;
                right: 10px;
                background: rgba(139, 92, 246, 0.9);
                color: white;
                padding: 6px 10px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 500;
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);
        
        // Add the trade detail modal
        if (!document.querySelector('.trade-detail-modal')) {
            const tradeDetailModal = document.createElement('div');
            tradeDetailModal.className = 'trade-detail-modal';
            tradeDetailModal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">Trade Details</h3>
                        <button class="close-modal">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div class="trade-details">
                        <!-- Trade details will be inserted here -->
                    </div>
                    <div class="trade-chart-mini">
                        <canvas id="trade-detail-chart"></canvas>
                    </div>
                </div>
            `;
            document.body.appendChild(tradeDetailModal);
        }
        
        // Add annotation tooltip if not already present
        if (!document.querySelector('.annotation-tooltip')) {
            const annotationTooltip = document.createElement('div');
            annotationTooltip.className = 'annotation-tooltip';
            document.body.appendChild(annotationTooltip);
        }
        
        // Initialize chart controls
        initChartControls();
    }

    /**
     * Initialize chart control event handlers
     */
    function initChartControls() {
        // Date range buttons
        const rangeButtons = document.querySelectorAll('.range-btn');
        rangeButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Remove active class from all buttons
                rangeButtons.forEach(btn => btn.classList.remove('active'));
                // Add active class to clicked button
                this.classList.add('active');
                
                // Update chart date range
                const range = this.getAttribute('data-range');
                updateChartDateRange(range);
            });
        });
        
        // Toggle visibility checkboxes
        const toggleControls = document.querySelectorAll('.visibility-controls input[type="checkbox"]');
        toggleControls.forEach(toggle => {
            toggle.addEventListener('change', function() {
                const series = this.getAttribute('data-series');
                const visible = this.checked;
                toggleChartSeries(series, visible);
            });
        });
        
        // Reset zoom button
        const resetZoomBtn = document.querySelector('.reset-zoom-btn');
        if (resetZoomBtn) {
            resetZoomBtn.addEventListener('click', function() {
                resetChartZoom();
            });
        }
        
        // Export chart button (only for control buttons, not chart-specific ones)
        const exportChartBtn = document.querySelector('.export-chart-btn.control-btn');
        if (exportChartBtn) {
            exportChartBtn.addEventListener('click', function() {
                exportChartAsImage();
            });
        }
        
        // Annotation button
        const annotateBtn = document.querySelector('.annotate-btn');
        if (annotateBtn) {
            annotateBtn.addEventListener('click', function() {
                toggleAnnotationMode();
            });
        }
        
        // Close modal button
        const closeModalBtn = document.querySelector('.close-modal');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', function() {
                const modal = document.querySelector('.trade-detail-modal');
                modal.classList.remove('visible');
            });
        }
        
        // Close modal when clicking outside
        const modal = document.querySelector('.trade-detail-modal');
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === this) {
                    this.classList.remove('visible');
                }
            });
        }
    }

    /**
     * Update charts based on selected date range
     * @param {string} range - Date range (1m, 3m, 6m, 1y, all)
     */
    function updateChartDateRange(range) {
        if (!DTIBacktester.priceChart || !DTIBacktester.dtiChart || !DTIBacktester.sevenDayDTIChart) {
            return;
        }
        
        const charts = [
            DTIBacktester.priceChart, 
            DTIBacktester.dtiChart, 
            DTIBacktester.sevenDayDTIChart
        ];
        
        // Get all data points
        const allDates = DTIBacktester.priceChart.data.labels;
        if (!allDates || allDates.length === 0) {
            return;
        }
        
        // If 'all' is selected, explicitly reset scales on all charts
        if (range === 'all') {
            charts.forEach(chart => {
                if (chart.options && chart.options.scales && chart.options.scales.x) {
                    // Explicitly remove min/max constraints
                    chart.options.scales.x.min = undefined;
                    chart.options.scales.x.max = undefined;
                    chart.update();
                }
            });
            
            // Also try the resetZoom method as backup
            charts.forEach(chart => {
                if (chart.resetZoom) {
                    chart.resetZoom();
                }
            });
            
            DTIBacktester.utils.showNotification('Showing all available data', 'success');
            return;
        }
        
        // Get the last date in the dataset
        const lastDateStr = allDates[allDates.length - 1];
        const lastDate = new Date(lastDateStr);
        
        // Calculate start date based on range
        let startDate;
        switch(range) {
            case '1m':
                startDate = new Date(lastDate);
                startDate.setMonth(lastDate.getMonth() - 1);
                break;
            case '3m':
                startDate = new Date(lastDate);
                startDate.setMonth(lastDate.getMonth() - 3);
                break;
            case '6m':
                startDate = new Date(lastDate);
                startDate.setMonth(lastDate.getMonth() - 6);
                break;
            case '1y':
                startDate = new Date(lastDate);
                startDate.setFullYear(lastDate.getFullYear() - 1);
                break;
            default:
                return;
        }
        
        // Find indices for start and end dates (use numeric indices for Chart.js)
        let startIndex = -1;
        for (let i = 0; i < allDates.length; i++) {
            const currentDate = new Date(allDates[i]);
            if (currentDate >= startDate) {
                startIndex = i;
                break;
            }
        }
        
        if (startIndex === -1) {
            startIndex = 0; // If no date matches, start from beginning
        }
        
        // Update all charts with the new min and max values
        charts.forEach(chart => {
            // Get chart options
            if (!chart.options) {
                return;
            }
            
            // Set min and max for x-axis
            if (!chart.options.scales) chart.options.scales = {};
            if (!chart.options.scales.x) chart.options.scales.x = {};
            
            chart.options.scales.x.min = startIndex;
            chart.options.scales.x.max = allDates.length - 1;
            
            // Update the chart with animation
            chart.update();
        });
        
        DTIBacktester.utils.showNotification(`Chart range updated to ${range.toUpperCase()}`, 'success');
    }

    /**
     * Toggle visibility of chart data series
     * @param {string} series - Series name (price, entries, exits)
     * @param {boolean} visible - Whether the series should be visible
     */
    function toggleChartSeries(series, visible) {
        if (!DTIBacktester.priceChart) return;
        
        switch(series) {
            case 'price':
                DTIBacktester.priceChart.data.datasets[0].hidden = !visible;
                break;
            case 'entries':
                // Find entry points dataset
                const entryDataset = DTIBacktester.priceChart.data.datasets.find(
                    d => d.label === 'Entry Point'
                );
                if (entryDataset) {
                    entryDataset.hidden = !visible;
                }
                break;
            case 'exits':
                // Find exit points dataset
                const exitDataset = DTIBacktester.priceChart.data.datasets.find(
                    d => d.label === 'Exit Point'
                );
                if (exitDataset) {
                    exitDataset.hidden = !visible;
                }
                break;
        }
        
        DTIBacktester.priceChart.update();
    }

    /**
     * Reset zoom level on all charts
     */
    function resetChartZoom() {
        if (DTIBacktester.priceChart && DTIBacktester.priceChart.resetZoom) {
            DTIBacktester.priceChart.resetZoom();
        }
        
        if (DTIBacktester.dtiChart && DTIBacktester.dtiChart.resetZoom) {
            DTIBacktester.dtiChart.resetZoom();
        }
        
        if (DTIBacktester.sevenDayDTIChart && DTIBacktester.sevenDayDTIChart.resetZoom) {
            DTIBacktester.sevenDayDTIChart.resetZoom();
        }
        
        // Set all range buttons to default state
        const rangeButtons = document.querySelectorAll('.range-btn');
        rangeButtons.forEach(btn => btn.classList.remove('active'));
        document.querySelector('.range-btn[data-range="all"]').classList.add('active');
        
        DTIBacktester.utils.showNotification('Chart zoom reset', 'info');
    }

    /**
     * Export the price chart as an image
     */
    function exportChartAsImage() {
        if (!DTIBacktester.priceChart) return;
        
        // Create a temporary link element
        const link = document.createElement('a');
        link.download = 'dti-price-chart.png';
        
        // Convert chart canvas to data URL
        const dataUrl = document.getElementById('price-chart').toDataURL('image/png');
        link.href = dataUrl;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        DTIBacktester.utils.showNotification('Chart exported as image', 'success');
    }

    /**
     * Toggle annotation mode for adding chart annotations
     */
    function toggleAnnotationMode() {
        const body = document.body;
        isAnnotationMode = body.classList.contains('annotation-mode');
        
        if (isAnnotationMode) {
            // Exit annotation mode
            body.classList.remove('annotation-mode');
            removeAnnotationListeners();
            DTIBacktester.utils.showNotification('Annotation mode disabled', 'info');
        } else {
            // Enter annotation mode
            body.classList.add('annotation-mode');
            addAnnotationListeners();
            DTIBacktester.utils.showNotification('Click on chart to add annotation', 'info');
        }
    }

    /**
     * Add event listeners for annotation mode
     */
    function addAnnotationListeners() {
        const priceChartCanvas = document.getElementById('price-chart');
        const dtiChartCanvas = document.getElementById('dti-chart');
        const sevenDayChartCanvas = document.getElementById('weekly-dti-chart');
        
        [priceChartCanvas, dtiChartCanvas, sevenDayChartCanvas].forEach(canvas => {
            if (canvas) {
                canvas.addEventListener('click', handleAnnotationClick);
            }
        });
    }

    /**
     * Remove event listeners for annotation mode
     */
    function removeAnnotationListeners() {
        const priceChartCanvas = document.getElementById('price-chart');
        const dtiChartCanvas = document.getElementById('dti-chart');
        const sevenDayChartCanvas = document.getElementById('weekly-dti-chart');
        
        [priceChartCanvas, dtiChartCanvas, sevenDayChartCanvas].forEach(canvas => {
            if (canvas) {
                canvas.removeEventListener('click', handleAnnotationClick);
            }
        });
    }

    /**
     * Handle click on chart when in annotation mode
     * @param {Event} event - Click event
     */
    function handleAnnotationClick(event) {
        // Identify which chart was clicked
        const canvas = event.currentTarget;
        let chart;
        
        if (canvas.id === 'price-chart') {
            chart = DTIBacktester.priceChart;
        } else if (canvas.id === 'dti-chart') {
            chart = DTIBacktester.dtiChart;
        } else if (canvas.id === 'weekly-dti-chart') {
            chart = DTIBacktester.sevenDayDTIChart;
        } else {
            return;
        }
        
        // Get click position relative to the chart
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Get data point nearest to click
        const point = chart.getElementsAtEventForMode(event, 'nearest', { intersect: false }, true)[0];
        if (!point) return;
        
        // Get data value at that point
        const dataIndex = point.index;
        const dateValue = chart.data.labels[dataIndex];
        
        // Ask user for annotation text
        const annotationText = prompt('Enter annotation text:');
        if (!annotationText) return;
        
        // Add annotation to chart
        addChartAnnotation(chart, dataIndex, dateValue, annotationText);
        
        // Exit annotation mode
        document.body.classList.remove('annotation-mode');
        removeAnnotationListeners();
        
        DTIBacktester.utils.showNotification('Annotation added', 'success');
    }

    /**
     * Add an annotation to a chart
     * @param {Chart} chart - Chart.js instance
     * @param {number} dataIndex - Index of data point
     * @param {string} dateValue - Date value
     * @param {string} text - Annotation text
     */
    function addChartAnnotation(chart, dataIndex, dateValue, text) {
        // Initialize annotations array if needed
        if (!chart.options.plugins.annotation) {
            chart.options.plugins.annotation = {
                annotations: {}
            };
        }
        
        // Generate unique ID for the annotation
        const id = 'annotation_' + Date.now();
        
        // Get y value for positioning
        const yValue = chart.data.datasets[0].data[dataIndex];
        
        // Create annotation object
        chart.options.plugins.annotation.annotations[id] = {
            type: 'point',
            xValue: dateValue,
            yValue: yValue,
            backgroundColor: 'rgba(255, 99, 132, 1)',
            borderColor: 'white',
            borderWidth: 2,
            radius: 6,
            content: text,
            label: {
                display: true,
                content: text,
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
        
        // Save annotations for persistence
        if (!DTIBacktester.annotations) {
            DTIBacktester.annotations = {};
        }
        
        DTIBacktester.annotations[id] = {
            chartId: chart.canvas.id,
            xValue: dateValue,
            yValue: yValue,
            text: text
        };
        
        // Update the chart
        chart.update();
    }

    /**
     * Display trade details in a modal
     * @param {Object} trade - Trade object
     */
    function showTradeDetails(trade) {
        if (!trade) return;
        
        const modal = document.querySelector('.trade-detail-modal');
        const detailsContainer = modal.querySelector('.trade-details');
        
        // Format date
        const formatDate = date => {
            return new Date(date).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        };
        
        // Get currency symbol
        const currencySymbol = getCurrencySymbolForDisplay(DTIBacktester.currentStockIndex);
        
        // Calculate holding period
        const entryDate = new Date(trade.entryDate);
        const exitDate = trade.exitDate ? new Date(trade.exitDate) : new Date();
        const holdingDays = Math.floor((exitDate - entryDate) / (1000 * 60 * 60 * 24));
        
        // Populate details
        detailsContainer.innerHTML = `
            <div class="detail-group">
                <div class="detail-label">Entry Date</div>
                <div class="detail-value">${formatDate(trade.entryDate)}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Entry Price</div>
                <div class="detail-value">${currencySymbol}${trade.entryPrice.toFixed(2)}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Entry DTI</div>
                <div class="detail-value">${trade.entryDTI.toFixed(2)}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">7-Day DTI at Entry</div>
                <div class="detail-value">${trade.entry7DayDTI ? trade.entry7DayDTI.toFixed(2) : 'N/A'}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Exit Date</div>
                <div class="detail-value">${trade.exitDate ? formatDate(trade.exitDate) : 'Active Trade'}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Exit Price</div>
                <div class="detail-value">${trade.exitPrice ? currencySymbol + trade.exitPrice.toFixed(2) : currencySymbol + trade.currentPrice.toFixed(2) + ' (Current)'}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">P/L</div>
                <div class="detail-value ${(trade.plPercent || trade.currentPlPercent) >= 0 ? 'positive' : 'negative'}">
                    ${trade.plPercent ? trade.plPercent.toFixed(2) : trade.currentPlPercent.toFixed(2)}%
                </div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Holding Period</div>
                <div class="detail-value">${holdingDays} days</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Exit Reason</div>
                <div class="detail-value">${trade.exitReason || 'Active Trade'}</div>
            </div>
        `;
        
        // Show modal
        modal.classList.add('visible');
        
        // Create mini chart of trade
        createTradeDetailChart(trade);
    }

    /**
     * Create a mini chart showing just the trade period
     * @param {Object} trade - Trade object
     */
    function createTradeDetailChart(trade) {
        // Clean up existing chart
        if (tradeDetailChart) {
            tradeDetailChart.destroy();
        }
        
        // Get the data for this trade period
        const allDates = DTIBacktester.priceChart.data.labels;
        const allPrices = DTIBacktester.priceChart.data.datasets[0].data;

        const entryIndex = allDates.indexOf(trade.entryDate);
        const exitIndex = trade.exitDate ? allDates.indexOf(trade.exitDate) : allDates.length - 1;
        
        if (entryIndex === -1) return;
        
        // Get a few days before and after for context
        const buffer = Math.min(10, Math.floor((exitIndex - entryIndex) / 2));
        const startIndex = Math.max(0, entryIndex - buffer);
        const endIndex = Math.min(allDates.length - 1, exitIndex + buffer);
        
        const dates = allDates.slice(startIndex, endIndex + 1);
        const prices = allPrices.slice(startIndex, endIndex + 1);
        
        // Create entry and exit markers
        const entryMarker = Array(dates.length).fill(null);
        entryMarker[entryIndex - startIndex] = prices[entryIndex - startIndex];
        
        const exitMarker = Array(dates.length).fill(null);
        if (trade.exitDate && exitIndex !== -1) {
            exitMarker[exitIndex - startIndex] = prices[exitIndex - startIndex];
        }
        
        // Create chart
        const ctx = document.getElementById('trade-detail-chart').getContext('2d');
        
        tradeDetailChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Price',
                    data: prices,
                    borderColor: 'rgba(37, 99, 235, 1)',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderWidth: 2,
                    fill: true
                }, {
                    label: 'Entry',
                    data: entryMarker,
                    backgroundColor: 'rgba(16, 185, 129, 1)',
                    borderColor: 'white',
                    borderWidth: 2,
                    pointRadius: 6,
                    pointStyle: 'circle',
                    showLine: false
                }, {
                    label: 'Exit',
                    data: exitMarker,
                    backgroundColor: 'rgba(239, 68, 68, 1)',
                    borderColor: 'white',
                    borderWidth: 2,
                    pointRadius: 6,
                    pointStyle: 'circle',
                    showLine: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxTicksLimit: 5,
                            maxRotation: 0
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            callback: function(value) {
                                // Get currency symbol
                                const currencySymbol = getCurrencySymbolForDisplay(DTIBacktester.currentStockIndex);
                                
                                return currencySymbol + value.toFixed(2);
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: true
                    }
                }
            }
        });
    }

    // Export functions for external use
    return {
        addChartControls,
        showTradeDetails
    };
})();

// Make chart controls available globally
window.DTIChartControls = {
    addChartControls: DTIUI.Controls.addChartControls,
    showTradeDetails: DTIUI.Controls.showTradeDetails
};