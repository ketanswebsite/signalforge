/**
 * Chart Performance Optimizer
 * Uses requestAnimationFrame for smooth chart updates and rendering
 */

(function() {
    'use strict';

    /**
     * Chart Performance Manager
     */
    window.ChartPerformance = {
        /**
         * Pending chart updates queue
         */
        pendingUpdates: new Map(),
        rafId: null,

        /**
         * Schedule a chart update using requestAnimationFrame
         * @param {string} chartId - Unique identifier for the chart
         * @param {Function} updateFn - Function to execute for update
         * @param {number} throttleMs - Optional throttle time in milliseconds
         */
        scheduleUpdate(chartId, updateFn, throttleMs = 0) {
            // Cancel existing update for this chart if any
            if (this.pendingUpdates.has(chartId)) {
                const existing = this.pendingUpdates.get(chartId);
                if (existing.timeoutId) {
                    clearTimeout(existing.timeoutId);
                }
            }

            // Throttle if requested
            if (throttleMs > 0) {
                const timeoutId = setTimeout(() => {
                    this.pendingUpdates.set(chartId, { updateFn, timeoutId: null });
                    this.requestUpdate();
                }, throttleMs);

                this.pendingUpdates.set(chartId, { updateFn, timeoutId });
            } else {
                this.pendingUpdates.set(chartId, { updateFn, timeoutId: null });
                this.requestUpdate();
            }
        },

        /**
         * Request animation frame for pending updates
         */
        requestUpdate() {
            if (this.rafId) return; // Already scheduled

            this.rafId = requestAnimationFrame(() => {
                this.processPendingUpdates();
            });
        },

        /**
         * Process all pending chart updates
         */
        processPendingUpdates() {
            const updates = Array.from(this.pendingUpdates.entries());

            // Clear pending updates
            this.pendingUpdates.clear();
            this.rafId = null;

            // Execute all updates in batches
            const BATCH_SIZE = 3; // Update max 3 charts per frame
            let processed = 0;

            updates.forEach(([chartId, { updateFn }]) => {
                if (processed < BATCH_SIZE) {
                    try {
                        updateFn();
                        processed++;
                    } catch (error) {
                        console.error(`[ChartPerformance] Error updating chart ${chartId}:`, error);
                    }
                } else {
                    // Re-schedule remaining updates for next frame
                    this.pendingUpdates.set(chartId, { updateFn, timeoutId: null });
                }
            });

            // If there are remaining updates, schedule next frame
            if (this.pendingUpdates.size > 0) {
                this.requestUpdate();
            }
        },

        /**
         * Debounce chart updates
         * @param {string} chartId - Chart identifier
         * @param {Function} updateFn - Update function
         * @param {number} delay - Debounce delay in ms
         * @returns {Function} Debounced function
         */
        debounce(chartId, updateFn, delay = 250) {
            let timeoutId = null;

            return (...args) => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    this.scheduleUpdate(chartId, () => updateFn(...args));
                }, delay);
            };
        },

        /**
         * Optimize Chart.js chart updates
         * @param {Chart} chart - Chart.js instance
         * @param {Object} options - Update options
         */
        optimizeChartUpdate(chart, options = {}) {
            if (!chart) return;

            const chartId = chart.canvas.id || `chart-${Math.random()}`;
            const updateFn = () => {
                // Use Chart.js update with animation disabled for better performance
                chart.update({
                    duration: options.animate ? 300 : 0,
                    lazy: true, // Only update visible elements
                    ...options
                });
            };

            this.scheduleUpdate(chartId, updateFn, options.throttle || 0);
        },

        /**
         * Batch multiple chart updates together
         * @param {Array<{chart: Chart, options: Object}>} charts - Array of charts to update
         */
        batchUpdate(charts) {
            if (!Array.isArray(charts) || charts.length === 0) return;

            const batchId = `batch-${Date.now()}`;

            this.scheduleUpdate(batchId, () => {
                charts.forEach(({ chart, options = {} }) => {
                    if (chart && typeof chart.update === 'function') {
                        chart.update({
                            duration: options.animate ? 300 : 0,
                            lazy: true,
                            ...options
                        });
                    }
                });
            });
        },

        /**
         * Create optimized chart animation
         * @param {Function} animationFn - Animation function
         * @param {number} duration - Animation duration in ms
         */
        animate(animationFn, duration = 1000) {
            const startTime = performance.now();

            const step = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Easing function (ease-out)
                const eased = 1 - Math.pow(1 - progress, 3);

                animationFn(eased, progress === 1);

                if (progress < 1) {
                    requestAnimationFrame(step);
                }
            };

            requestAnimationFrame(step);
        },

        /**
         * Monitor chart rendering performance
         * @param {string} chartId - Chart identifier
         * @param {Function} renderFn - Render function
         * @returns {Promise} Render promise with performance metrics
         */
        async measurePerformance(chartId, renderFn) {
            const startTime = performance.now();

            try {
                const result = await renderFn();
                const endTime = performance.now();
                const duration = endTime - startTime;

                console.log(`[ChartPerformance] ${chartId} rendered in ${duration.toFixed(2)}ms`);

                return { result, duration };
            } catch (error) {
                const endTime = performance.now();
                const duration = endTime - startTime;

                console.error(`[ChartPerformance] ${chartId} failed after ${duration.toFixed(2)}ms:`, error);

                throw error;
            }
        },

        /**
         * Create performance-optimized chart wrapper
         * @param {HTMLCanvasElement} canvas - Canvas element
         * @param {Object} config - Chart configuration
         * @returns {Chart} Optimized Chart.js instance
         */
        createOptimizedChart(canvas, config) {
            if (typeof Chart === 'undefined') {
                console.error('[ChartPerformance] Chart.js not loaded');
                return null;
            }

            // Add performance optimizations to config
            const optimizedConfig = {
                ...config,
                options: {
                    ...config.options,
                    animation: {
                        duration: 0, // Disable animations by default for performance
                        ...config.options?.animation
                    },
                    responsive: true,
                    maintainAspectRatio: false,
                    // Use efficient parsing
                    parsing: {
                        xAxisKey: 'x',
                        yAxisKey: 'y'
                    },
                    // Optimize plugins
                    plugins: {
                        ...config.options?.plugins,
                        decimation: {
                            enabled: true,
                            algorithm: 'lttb', // Largest-Triangle-Three-Buckets algorithm
                            samples: 500
                        }
                    }
                }
            };

            return new Chart(canvas, optimizedConfig);
        },

        /**
         * Cleanup
         */
        destroy() {
            // Cancel pending updates
            this.pendingUpdates.forEach(({ timeoutId }) => {
                if (timeoutId) clearTimeout(timeoutId);
            });

            this.pendingUpdates.clear();

            if (this.rafId) {
                cancelAnimationFrame(this.rafId);
                this.rafId = null;
            }
        }
    };

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        ChartPerformance.destroy();
    });

    console.log('[ChartPerformance] Chart performance optimizer initialized');
})();
