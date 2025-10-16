/**
 * Admin Performance Utilities - Phase 4
 *
 * Features:
 * - Lazy Module Loading
 * - Request Batching
 * - Response Caching
 * - Performance Monitoring
 * - Resource Optimization
 *
 * Dependencies: None (standalone utility)
 */

const AdminPerformance = {
    // State management
    state: {
        loadedModules: new Set(),
        moduleLoadPromises: new Map(),
        cache: new Map(),
        batchQueue: new Map(),
        metrics: {
            moduleLoadTimes: {},
            requestCounts: {},
            cacheHits: 0,
            cacheMisses: 0
        }
    },

    // Configuration
    config: {
        cacheTTL: 5 * 60 * 1000, // 5 minutes
        batchDelay: 50, // ms
        maxBatchSize: 10,
        enableMetrics: true
    },

    /**
     * Lazy load a JavaScript module
     * @param {string} moduleName - Name of the module
     * @param {string} modulePath - Path to the module file
     * @returns {Promise} - Resolves when module is loaded
     */
    async loadModule(moduleName, modulePath) {
        // Check if already loaded
        if (this.state.loadedModules.has(moduleName)) {
            console.log(`[Performance] Module ${moduleName} already loaded`);
            return Promise.resolve();
        }

        // Check if loading in progress
        if (this.state.moduleLoadPromises.has(moduleName)) {
            console.log(`[Performance] Module ${moduleName} loading in progress, waiting...`);
            return this.state.moduleLoadPromises.get(moduleName);
        }

        // Start loading
        const startTime = performance.now();
        console.log(`[Performance] Loading module: ${moduleName}`);

        const loadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = modulePath;
            script.async = true;

            script.onload = () => {
                const loadTime = performance.now() - startTime;
                this.state.loadedModules.add(moduleName);
                this.state.moduleLoadPromises.delete(moduleName);

                if (this.config.enableMetrics) {
                    this.state.metrics.moduleLoadTimes[moduleName] = loadTime;
                    console.log(`[Performance] Module ${moduleName} loaded in ${loadTime.toFixed(2)}ms`);
                }

                resolve();
            };

            script.onerror = () => {
                this.state.moduleLoadPromises.delete(moduleName);
                reject(new Error(`Failed to load module: ${moduleName}`));
            };

            document.head.appendChild(script);
        });

        this.state.moduleLoadPromises.set(moduleName, loadPromise);
        return loadPromise;
    },

    /**
     * Preload multiple modules
     * @param {Array<{name: string, path: string}>} modules - Array of modules to preload
     * @returns {Promise} - Resolves when all modules are loaded
     */
    async preloadModules(modules) {
        console.log(`[Performance] Preloading ${modules.length} modules...`);
        const startTime = performance.now();

        try {
            await Promise.all(
                modules.map(({ name, path }) => this.loadModule(name, path))
            );

            const totalTime = performance.now() - startTime;
            console.log(`[Performance] All modules preloaded in ${totalTime.toFixed(2)}ms`);
        } catch (error) {
            console.error('[Performance] Error preloading modules:', error);
            throw error;
        }
    },

    /**
     * Get data from cache or fetch if not cached
     * @param {string} key - Cache key
     * @param {Function} fetchFn - Function to fetch data if not cached
     * @param {number} ttl - Time to live in milliseconds (optional)
     * @returns {Promise} - Cached or fetched data
     */
    async getCached(key, fetchFn, ttl = this.config.cacheTTL) {
        const cached = this.state.cache.get(key);

        // Check if cached and not expired
        if (cached && Date.now() - cached.timestamp < ttl) {
            if (this.config.enableMetrics) {
                this.state.metrics.cacheHits++;
                console.log(`[Performance] Cache hit for: ${key} (${this.state.metrics.cacheHits} hits)`);
            }
            return cached.data;
        }

        // Cache miss or expired
        if (this.config.enableMetrics) {
            this.state.metrics.cacheMisses++;
            console.log(`[Performance] Cache miss for: ${key} (${this.state.metrics.cacheMisses} misses)`);
        }

        // Fetch new data
        const startTime = performance.now();
        const data = await fetchFn();
        const fetchTime = performance.now() - startTime;

        // Cache the data
        this.state.cache.set(key, {
            data,
            timestamp: Date.now()
        });

        console.log(`[Performance] Fetched and cached ${key} in ${fetchTime.toFixed(2)}ms`);
        return data;
    },

    /**
     * Clear cache entry or entire cache
     * @param {string} key - Cache key to clear (optional, clears all if not provided)
     */
    clearCache(key = null) {
        if (key) {
            this.state.cache.delete(key);
            console.log(`[Performance] Cleared cache for: ${key}`);
        } else {
            this.state.cache.clear();
            console.log('[Performance] Cleared entire cache');
        }
    },

    /**
     * Invalidate cache entries matching a pattern
     * @param {RegExp|string} pattern - Pattern to match cache keys
     */
    invalidateCache(pattern) {
        const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
        let count = 0;

        for (const key of this.state.cache.keys()) {
            if (regex.test(key)) {
                this.state.cache.delete(key);
                count++;
            }
        }

        console.log(`[Performance] Invalidated ${count} cache entries matching: ${pattern}`);
    },

    /**
     * Batch multiple API requests
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Request parameters
     * @returns {Promise} - Promise that resolves with the response
     */
    batchRequest(endpoint, params = {}) {
        return new Promise((resolve, reject) => {
            // Create batch key
            const batchKey = endpoint;

            // Get or create batch queue for this endpoint
            if (!this.state.batchQueue.has(batchKey)) {
                this.state.batchQueue.set(batchKey, {
                    requests: [],
                    timeout: null
                });
            }

            const batch = this.state.batchQueue.get(batchKey);

            // Add request to batch
            batch.requests.push({ params, resolve, reject });

            // Clear existing timeout
            if (batch.timeout) {
                clearTimeout(batch.timeout);
            }

            // Set new timeout to execute batch
            batch.timeout = setTimeout(() => {
                this.executeBatch(batchKey);
            }, this.config.batchDelay);

            // Execute immediately if batch is full
            if (batch.requests.length >= this.config.maxBatchSize) {
                clearTimeout(batch.timeout);
                this.executeBatch(batchKey);
            }
        });
    },

    /**
     * Execute a batch of requests
     * @param {string} batchKey - Batch queue key
     */
    async executeBatch(batchKey) {
        const batch = this.state.batchQueue.get(batchKey);
        if (!batch || batch.requests.length === 0) return;

        const requests = batch.requests;
        this.state.batchQueue.delete(batchKey);

        console.log(`[Performance] Executing batch of ${requests.length} requests to ${batchKey}`);
        const startTime = performance.now();

        try {
            // Collect all parameters
            const allParams = requests.map(r => r.params);

            // Make batched API call
            const response = await fetch(batchKey, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batch: allParams })
            });

            if (!response.ok) {
                throw new Error(`Batch request failed: ${response.statusText}`);
            }

            const results = await response.json();
            const batchTime = performance.now() - startTime;

            console.log(`[Performance] Batch completed in ${batchTime.toFixed(2)}ms`);

            // Resolve individual promises
            if (Array.isArray(results)) {
                requests.forEach((request, index) => {
                    if (results[index]) {
                        request.resolve(results[index]);
                    } else {
                        request.reject(new Error('No result for request'));
                    }
                });
            } else {
                // Single response for all requests
                requests.forEach(request => request.resolve(results));
            }

        } catch (error) {
            console.error('[Performance] Batch execution failed:', error);

            // Reject all promises
            requests.forEach(request => request.reject(error));
        }
    },

    /**
     * Debounce function calls
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} - Debounced function
     */
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle function calls
     * @param {Function} func - Function to throttle
     * @param {number} limit - Limit in milliseconds
     * @returns {Function} - Throttled function
     */
    throttle(func, limit = 200) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Measure function performance
     * @param {Function} func - Function to measure
     * @param {string} label - Label for the measurement
     * @returns {Function} - Wrapped function with performance measurement
     */
    measure(func, label) {
        return async (...args) => {
            const startTime = performance.now();
            try {
                const result = await func(...args);
                const duration = performance.now() - startTime;
                console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
                return result;
            } catch (error) {
                const duration = performance.now() - startTime;
                console.error(`[Performance] ${label} failed after ${duration.toFixed(2)}ms:`, error);
                throw error;
            }
        };
    },

    /**
     * Get performance metrics
     * @returns {Object} - Performance metrics
     */
    getMetrics() {
        const cacheHitRate = this.state.metrics.cacheHits + this.state.metrics.cacheMisses > 0
            ? ((this.state.metrics.cacheHits / (this.state.metrics.cacheHits + this.state.metrics.cacheMisses)) * 100).toFixed(2)
            : 0;

        return {
            loadedModules: Array.from(this.state.loadedModules),
            moduleLoadTimes: this.state.metrics.moduleLoadTimes,
            cacheSize: this.state.cache.size,
            cacheHits: this.state.metrics.cacheHits,
            cacheMisses: this.state.metrics.cacheMisses,
            cacheHitRate: `${cacheHitRate}%`,
            requestCounts: this.state.metrics.requestCounts
        };
    },

    /**
     * Log performance metrics to console
     */
    logMetrics() {
        console.group('[Performance] Metrics Summary');
        console.table(this.getMetrics());
        console.groupEnd();
    },

    /**
     * Reset all metrics
     */
    resetMetrics() {
        this.state.metrics = {
            moduleLoadTimes: {},
            requestCounts: {},
            cacheHits: 0,
            cacheMisses: 0
        };
        console.log('[Performance] Metrics reset');
    },

    /**
     * Prefetch resources
     * @param {Array<string>} urls - URLs to prefetch
     */
    prefetch(urls) {
        urls.forEach(url => {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = url;
            document.head.appendChild(link);
        });
        console.log(`[Performance] Prefetching ${urls.length} resources`);
    },

    /**
     * Preload critical resources
     * @param {Array<{url: string, as: string}>} resources - Resources to preload
     */
    preload(resources) {
        resources.forEach(({ url, as }) => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = url;
            link.as = as;
            document.head.appendChild(link);
        });
        console.log(`[Performance] Preloading ${resources.length} critical resources`);
    },

    /**
     * Optimize images by lazy loading
     * @param {string} selector - CSS selector for images to lazy load
     */
    lazyLoadImages(selector = 'img[data-src]') {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        observer.unobserve(img);
                    }
                });
            });

            document.querySelectorAll(selector).forEach(img => {
                imageObserver.observe(img);
            });

            console.log('[Performance] Lazy loading enabled for images');
        } else {
            // Fallback for browsers without IntersectionObserver
            document.querySelectorAll(selector).forEach(img => {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
            });
        }
    },

    /**
     * Initialize performance monitoring
     */
    init() {
        console.log('[Performance] Performance utilities initialized');

        // Monitor page performance
        if (window.performance && window.performance.timing) {
            window.addEventListener('load', () => {
                setTimeout(() => {
                    const timing = performance.timing;
                    const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
                    const domReady = timing.domContentLoadedEventEnd - timing.navigationStart;

                    console.group('[Performance] Page Load Metrics');
                    console.log(`Page Load Time: ${pageLoadTime}ms`);
                    console.log(`DOM Ready: ${domReady}ms`);
                    console.log(`DNS Lookup: ${timing.domainLookupEnd - timing.domainLookupStart}ms`);
                    console.log(`TCP Connection: ${timing.connectEnd - timing.connectStart}ms`);
                    console.log(`Server Response: ${timing.responseEnd - timing.requestStart}ms`);
                    console.log(`DOM Processing: ${timing.domComplete - timing.domLoading}ms`);
                    console.groupEnd();
                }, 0);
            });
        }

        // Clean up expired cache entries periodically
        setInterval(() => {
            const now = Date.now();
            let cleaned = 0;

            for (const [key, value] of this.state.cache.entries()) {
                if (now - value.timestamp > this.config.cacheTTL) {
                    this.state.cache.delete(key);
                    cleaned++;
                }
            }

            if (cleaned > 0) {
                console.log(`[Performance] Cleaned ${cleaned} expired cache entries`);
            }
        }, 60000); // Clean every minute
    }
};

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AdminPerformance.init());
} else {
    AdminPerformance.init();
}

// Make available globally
window.AdminPerformance = AdminPerformance;
