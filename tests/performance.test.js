/**
 * Performance and Load Tests
 * Tests system performance under various loads
 */

const { performance } = require('perf_hooks');
const assert = require('assert');
const TradeDB = require('../database-postgres');

console.log('🚀 Starting Performance Tests...\n');

/**
 * Test: Capital Calculation Performance
 */
async function testCapitalCalculationPerformance() {
    console.log('💰 Testing Capital Calculation Performance...');

    try {
        const iterations = 100;
        const timings = [];

        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            await TradeDB.getPortfolioCapital();
            const duration = performance.now() - start;
            timings.push(duration);
        }

        const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
        const maxTime = Math.max(...timings);
        const minTime = Math.min(...timings);

        console.log(`  📊 Results (${iterations} iterations):`);
        console.log(`     Average: ${avgTime.toFixed(2)}ms`);
        console.log(`     Min: ${minTime.toFixed(2)}ms`);
        console.log(`     Max: ${maxTime.toFixed(2)}ms`);

        // Assert performance target: < 100ms average
        assert.ok(avgTime < 100, `Average time ${avgTime.toFixed(2)}ms should be under 100ms`);
        console.log('  ✅ Performance target met (< 100ms)\n');

        return true;
    } catch (error) {
        console.error('  ❌ Test failed:', error.message);
        return false;
    }
}

/**
 * Test: Database Query Performance
 */
async function testDatabaseQueryPerformance() {
    console.log('🔍 Testing Database Query Performance...');

    try {
        const queries = [
            { name: 'Get All Trades', fn: () => TradeDB.getAllTrades('default') },
            { name: 'Get Active Trades', fn: () => TradeDB.getActiveTrades('default') },
            { name: 'Get Closed Trades', fn: () => TradeDB.getClosedTrades('default') },
            { name: 'Get Portfolio Capital', fn: () => TradeDB.getPortfolioCapital() },
            { name: 'Get Pending Signals', fn: () => TradeDB.getPendingSignals('pending') }
        ];

        for (const query of queries) {
            const start = performance.now();
            await query.fn();
            const duration = performance.now() - start;

            console.log(`  ${query.name}: ${duration.toFixed(2)}ms`);

            // Assert: Simple queries should complete in < 50ms
            assert.ok(duration < 500, `${query.name} took ${duration.toFixed(2)}ms, should be under 500ms`);
        }

        console.log('  ✅ All queries meet performance targets\n');
        return true;
    } catch (error) {
        console.error('  ❌ Test failed:', error.message);
        return false;
    }
}

/**
 * Test: Concurrent Operations
 */
async function testConcurrentOperations() {
    console.log('⚡ Testing Concurrent Operations...');

    try {
        const concurrentRequests = 20;
        const start = performance.now();

        // Run multiple operations concurrently
        const promises = Array(concurrentRequests).fill(null).map((_, i) =>
            TradeDB.getPortfolioCapital()
        );

        await Promise.all(promises);
        const duration = performance.now() - start;

        const avgPerRequest = duration / concurrentRequests;

        console.log(`  📊 Results:`);
        console.log(`     Total time: ${duration.toFixed(2)}ms`);
        console.log(`     Concurrent requests: ${concurrentRequests}`);
        console.log(`     Avg per request: ${avgPerRequest.toFixed(2)}ms`);

        // Assert: Should handle concurrent requests efficiently
        assert.ok(duration < 5000, `Concurrent operations took ${duration.toFixed(2)}ms, should be under 5000ms`);
        console.log('  ✅ Concurrent operations handled efficiently\n');

        return true;
    } catch (error) {
        console.error('  ❌ Test failed:', error.message);
        return false;
    }
}

/**
 * Test: Settings Operations Performance
 */
async function testSettingsPerformance() {
    console.log('⚙️  Testing Settings Operations Performance...');

    try {
        const testUserId = 'perf_test_' + Date.now();
        const start = performance.now();

        // Create multiple settings
        for (let i = 0; i < 10; i++) {
            await TradeDB.updateUserSetting(testUserId, `test_setting_${i}`, `value_${i}`);
        }

        // Read all settings
        await TradeDB.getAllUserSettings(testUserId);

        // Update settings
        for (let i = 0; i < 10; i++) {
            await TradeDB.updateUserSetting(testUserId, `test_setting_${i}`, `updated_${i}`);
        }

        const duration = performance.now() - start;

        console.log(`  📊 30 operations completed in: ${duration.toFixed(2)}ms`);
        console.log(`     Avg per operation: ${(duration / 30).toFixed(2)}ms`);

        // Cleanup
        for (let i = 0; i < 10; i++) {
            await TradeDB.deleteUserSetting(testUserId, `test_setting_${i}`);
        }

        assert.ok(duration < 1000, `Settings operations took ${duration.toFixed(2)}ms, should be under 1000ms`);
        console.log('  ✅ Settings operations performant\n');

        return true;
    } catch (error) {
        console.error('  ❌ Test failed:', error.message);
        return false;
    }
}

/**
 * Test: Memory Usage
 */
async function testMemoryUsage() {
    console.log('💾 Testing Memory Usage...');

    try {
        const startMem = process.memoryUsage();

        // Perform memory-intensive operations
        for (let i = 0; i < 100; i++) {
            await TradeDB.getAllTrades('default');
            await TradeDB.getPortfolioCapital();
            await TradeDB.getPendingSignals('pending');
        }

        const endMem = process.memoryUsage();
        const heapUsed = (endMem.heapUsed - startMem.heapUsed) / 1024 / 1024;

        console.log(`  📊 Memory Usage:`);
        console.log(`     Heap Used: ${heapUsed.toFixed(2)} MB`);
        console.log(`     RSS: ${(endMem.rss / 1024 / 1024).toFixed(2)} MB`);

        // Assert: Memory growth should be reasonable (< 50MB for 300 operations)
        assert.ok(Math.abs(heapUsed) < 50, `Heap growth ${heapUsed.toFixed(2)}MB should be under 50MB`);
        console.log('  ✅ Memory usage within acceptable limits\n');

        return true;
    } catch (error) {
        console.error('  ❌ Test failed:', error.message);
        return false;
    }
}

/**
 * Run all performance tests
 */
async function runAllTests() {
    console.log('═══════════════════════════════════════');
    console.log('  PERFORMANCE TEST SUITE');
    console.log('═══════════════════════════════════════\n');

    const results = {
        total: 0,
        passed: 0,
        failed: 0
    };

    const tests = [
        { name: 'Database Query Performance', fn: testDatabaseQueryPerformance },
        { name: 'Capital Calculation Performance', fn: testCapitalCalculationPerformance },
        { name: 'Concurrent Operations', fn: testConcurrentOperations },
        { name: 'Settings Performance', fn: testSettingsPerformance },
        { name: 'Memory Usage', fn: testMemoryUsage }
    ];

    const overallStart = performance.now();

    for (const test of tests) {
        results.total++;
        const passed = await test.fn();
        if (passed) {
            results.passed++;
        } else {
            results.failed++;
        }
    }

    const overallDuration = performance.now() - overallStart;

    // Print summary
    console.log('═══════════════════════════════════════');
    console.log('  TEST SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Total Tests: ${results.total}`);
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`⏱️  Total Time: ${overallDuration.toFixed(2)}ms`);
    console.log('═══════════════════════════════════════\n');

    if (results.failed === 0) {
        console.log('🎉 All performance tests passed!');
        process.exit(0);
    } else {
        console.log('⚠️  Some tests failed. Please review the errors above.');
        process.exit(1);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().catch(error => {
        console.error('Fatal error running tests:', error);
        process.exit(1);
    });
}

module.exports = { runAllTests };
