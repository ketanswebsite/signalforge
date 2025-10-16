/**
 * Performance Benchmarking Utility
 * Phase 6: Testing & Polish
 *
 * Benchmarks for testing performance of critical operations
 */

class PerformanceBenchmark {
    constructor() {
        this.results = [];
        this.thresholds = {
            componentRender: 50, // ms
            apiCall: 200, // ms
            dataProcessing: 100, // ms
            chartRender: 100, // ms
            tableRender: 150, // ms
            virtualScrollInit: 100, // ms
            cacheOperation: 5 // ms
        };
    }

    /**
     * Run a benchmark test
     */
    async run(name, fn, iterations = 100) {
        console.log(`\n🔬 Benchmarking: ${name}`);
        console.log(`Iterations: ${iterations}`);

        const times = [];

        // Warm-up run
        await fn();

        // Actual benchmark runs
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            await fn();
            const end = performance.now();
            times.push(end - start);
        }

        const results = this.calculateStats(times);
        results.name = name;

        this.results.push(results);

        this.printResults(results);

        return results;
    }

    /**
     * Calculate statistics from timing data
     */
    calculateStats(times) {
        const sorted = times.sort((a, b) => a - b);

        return {
            min: Math.min(...times),
            max: Math.max(...times),
            mean: times.reduce((a, b) => a + b, 0) / times.length,
            median: sorted[Math.floor(sorted.length / 2)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)],
            iterations: times.length
        };
    }

    /**
     * Print benchmark results
     */
    printResults(results) {
        console.log(`\n📊 Results for: ${results.name}`);
        console.log(`   Min:     ${results.min.toFixed(2)}ms`);
        console.log(`   Max:     ${results.max.toFixed(2)}ms`);
        console.log(`   Mean:    ${results.mean.toFixed(2)}ms`);
        console.log(`   Median:  ${results.median.toFixed(2)}ms`);
        console.log(`   P95:     ${results.p95.toFixed(2)}ms`);
        console.log(`   P99:     ${results.p99.toFixed(2)}ms`);

        // Check against thresholds
        const category = this.getCategoryFromName(results.name);
        if (category && this.thresholds[category]) {
            const threshold = this.thresholds[category];
            const passed = results.p95 < threshold;
            const status = passed ? '✅ PASS' : '❌ FAIL';
            console.log(`   Threshold: ${threshold}ms - ${status}`);
        }
    }

    /**
     * Get category from benchmark name
     */
    getCategoryFromName(name) {
        const lowerName = name.toLowerCase();

        if (lowerName.includes('render')) {
            if (lowerName.includes('chart')) return 'chartRender';
            if (lowerName.includes('table')) return 'tableRender';
            return 'componentRender';
        }
        if (lowerName.includes('api')) return 'apiCall';
        if (lowerName.includes('cache')) return 'cacheOperation';
        if (lowerName.includes('virtual')) return 'virtualScrollInit';
        if (lowerName.includes('process')) return 'dataProcessing';

        return null;
    }

    /**
     * Generate summary report
     */
    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📋 PERFORMANCE BENCHMARK SUMMARY');
        console.log('='.repeat(60));

        this.results.forEach(result => {
            const category = this.getCategoryFromName(result.name);
            const threshold = category ? this.thresholds[category] : null;
            const status = threshold && result.p95 < threshold ? '✅' : '❌';

            console.log(`\n${status} ${result.name}`);
            console.log(`   P95: ${result.p95.toFixed(2)}ms${threshold ? ` (threshold: ${threshold}ms)` : ''}`);
        });

        console.log('\n' + '='.repeat(60));
    }

    /**
     * Export results as JSON
     */
    exportResults(filename = 'benchmark-results.json') {
        const report = {
            timestamp: new Date().toISOString(),
            environment: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                cores: navigator.hardwareConcurrency || 'unknown'
            },
            thresholds: this.thresholds,
            results: this.results
        };

        const json = JSON.stringify(report, null, 2);

        console.log(`\n💾 Exporting results to ${filename}`);
        console.log(json);

        return report;
    }
}

// Benchmark suite
const benchmarkSuite = {
    /**
     * Component rendering benchmarks
     */
    async testComponentRendering(benchmark) {
        console.log('\n🎨 Component Rendering Benchmarks');
        console.log('='.repeat(60));

        // Metric card rendering
        await benchmark.run('Enhanced Metric Card Render', () => {
            const container = document.createElement('div');
            container.innerHTML = `
                <div class="enhanced-metric-card">
                    <div class="metric-title">Test Metric</div>
                    <div class="metric-value">1234</div>
                    <canvas class="metric-sparkline"></canvas>
                </div>
            `;
            document.body.appendChild(container);
            document.body.removeChild(container);
        }, 100);

        // Toast notification
        await benchmark.run('Toast Notification Render', () => {
            const toast = document.createElement('div');
            toast.className = 'toast-notification';
            toast.innerHTML = '<div class="toast-content">Test message</div>';
            document.body.appendChild(toast);
            document.body.removeChild(toast);
        }, 100);

        // Modal rendering
        await benchmark.run('Modal Dialog Render', () => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-dialog">
                    <div class="modal-header">Title</div>
                    <div class="modal-body">Content</div>
                    <div class="modal-footer">Actions</div>
                </div>
            `;
            document.body.appendChild(modal);
            document.body.removeChild(modal);
        }, 100);
    },

    /**
     * Data processing benchmarks
     */
    async testDataProcessing(benchmark) {
        console.log('\n⚙️ Data Processing Benchmarks');
        console.log('='.repeat(60));

        // Array filtering
        await benchmark.run('Filter 10K items', () => {
            const data = Array.from({ length: 10000 }, (_, i) => ({
                id: i,
                value: Math.random()
            }));
            const filtered = data.filter(item => item.value > 0.5);
            return filtered.length;
        }, 50);

        // Array sorting
        await benchmark.run('Sort 10K items', () => {
            const data = Array.from({ length: 10000 }, () => Math.random());
            data.sort((a, b) => a - b);
        }, 50);

        // Array mapping
        await benchmark.run('Map 10K items', () => {
            const data = Array.from({ length: 10000 }, (_, i) => i);
            const mapped = data.map(x => x * 2);
            return mapped.length;
        }, 50);

        // Object transformation
        await benchmark.run('Transform 1K objects', () => {
            const data = Array.from({ length: 1000 }, (_, i) => ({
                id: i,
                name: `Item ${i}`,
                value: Math.random()
            }));
            const transformed = data.map(item => ({
                ...item,
                doubled: item.value * 2,
                label: `${item.name} (${item.value.toFixed(2)})`
            }));
            return transformed.length;
        }, 50);
    },

    /**
     * Table rendering benchmarks
     */
    async testTableRendering(benchmark) {
        console.log('\n📊 Table Rendering Benchmarks');
        console.log('='.repeat(60));

        // Render small table
        await benchmark.run('Render 100 rows table', () => {
            const table = document.createElement('table');
            for (let i = 0; i < 100; i++) {
                const row = table.insertRow();
                for (let j = 0; j < 5; j++) {
                    const cell = row.insertCell();
                    cell.textContent = `Cell ${i},${j}`;
                }
            }
            document.body.appendChild(table);
            document.body.removeChild(table);
        }, 50);

        // Render medium table
        await benchmark.run('Render 1000 rows table', () => {
            const table = document.createElement('table');
            for (let i = 0; i < 1000; i++) {
                const row = table.insertRow();
                for (let j = 0; j < 5; j++) {
                    const cell = row.insertCell();
                    cell.textContent = `Cell ${i},${j}`;
                }
            }
            document.body.appendChild(table);
            document.body.removeChild(table);
        }, 10);
    },

    /**
     * Cache operations benchmarks
     */
    async testCacheOperations(benchmark) {
        console.log('\n💾 Cache Operations Benchmarks');
        console.log('='.repeat(60));

        const cache = new Map();

        // Cache write
        await benchmark.run('Cache write operation', () => {
            cache.set(`key-${Math.random()}`, { data: 'test', timestamp: Date.now() });
        }, 1000);

        // Cache read (hit)
        cache.set('test-key', { data: 'test-data', timestamp: Date.now() });
        await benchmark.run('Cache read (hit)', () => {
            const value = cache.get('test-key');
            return value;
        }, 1000);

        // Cache read (miss)
        await benchmark.run('Cache read (miss)', () => {
            const value = cache.get('nonexistent-key');
            return value;
        }, 1000);

        // Cache delete
        await benchmark.run('Cache delete operation', () => {
            cache.delete('test-key');
        }, 1000);
    },

    /**
     * Virtual scroll benchmarks
     */
    async testVirtualScroll(benchmark) {
        console.log('\n📜 Virtual Scroll Benchmarks');
        console.log('='.repeat(60));

        // Virtual scroll initialization
        await benchmark.run('Virtual scroll init (10K items)', () => {
            const container = document.createElement('div');
            container.style.height = '600px';
            container.style.overflow = 'auto';

            const content = document.createElement('div');
            content.style.height = `${10000 * 50}px`;

            container.appendChild(content);
            document.body.appendChild(container);
            document.body.removeChild(container);
        }, 50);

        // Virtual scroll update
        await benchmark.run('Virtual scroll update visible rows', () => {
            const visibleRows = 20;
            const fragment = document.createDocumentFragment();

            for (let i = 0; i < visibleRows; i++) {
                const row = document.createElement('div');
                row.textContent = `Row ${i}`;
                fragment.appendChild(row);
            }

            const container = document.createElement('div');
            container.appendChild(fragment);
        }, 100);
    },

    /**
     * Run all benchmarks
     */
    async runAll() {
        const benchmark = new PerformanceBenchmark();

        await this.testComponentRendering(benchmark);
        await this.testDataProcessing(benchmark);
        await this.testTableRendering(benchmark);
        await this.testCacheOperations(benchmark);
        await this.testVirtualScroll(benchmark);

        benchmark.generateReport();

        return benchmark.exportResults();
    }
};

// Export for use in tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PerformanceBenchmark, benchmarkSuite };
}

// Allow running directly in browser
if (typeof window !== 'undefined') {
    window.PerformanceBenchmark = PerformanceBenchmark;
    window.benchmarkSuite = benchmarkSuite;
}
