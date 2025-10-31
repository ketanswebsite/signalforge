/**
 * Database Integration Tests
 * Tests for database operations and data integrity
 */

const assert = require('assert');
const TradeDB = require('../database-postgres');

// Test user for database operations
const TEST_USER = 'test@example.com';

console.log('🧪 Starting Database Integration Tests...\n');

/**
 * Test Suite: Pending Signals
 */
async function testPendingSignals() {
    console.log('📋 Testing Pending Signals...');

    try {
        // Test 1: Store new signal
        const testSignal = {
            symbol: 'TEST.NS',
            signalDate: '2025-01-15',
            entryPrice: 150.25,
            targetPrice: 165.00,
            stopLoss: 142.50,
            squareOffDate: '2025-02-15',
            market: 'India',
            winRate: 65.5,
            historicalSignalCount: 15,
            entryDTI: -45.5
        };

        const result = await TradeDB.storePendingSignal(testSignal);
        assert.ok(result && result.id, 'Signal should be stored with ID');
        console.log('  ✅ Signal stored successfully');

        // Test 2: Retrieve signal
        const retrieved = await TradeDB.getPendingSignal(testSignal.symbol, testSignal.signalDate);
        assert.ok(retrieved, 'Signal should be retrievable');
        assert.strictEqual(retrieved.symbol, testSignal.symbol, 'Symbol should match');
        console.log('  ✅ Signal retrieved successfully');

        // Test 3: Get all pending signals
        const allSignals = await TradeDB.getPendingSignals('pending');
        assert.ok(Array.isArray(allSignals), 'Should return array');
        assert.ok(allSignals.length > 0, 'Should have at least one signal');
        console.log(`  ✅ Retrieved ${allSignals.length} pending signals`);

        // Test 4: Update signal status
        const updated = await TradeDB.updateSignalStatus(result.id, 'dismissed');
        assert.ok(updated, 'Signal status should update');
        console.log('  ✅ Signal status updated');

        console.log('✅ Pending Signals tests passed\n');
        return true;
    } catch (error) {
        console.error('❌ Pending Signals test failed:', error.message);
        return false;
    }
}

/**
 * Test Suite: User Settings
 */
async function testUserSettings() {
    console.log('⚙️  Testing User Settings...');

    try {
        const testUserId = 'test_user_' + Date.now();

        // Test 1: Set a setting
        await TradeDB.updateUserSetting(testUserId, 'default_stop_loss_percent', '7');
        console.log('  ✅ Setting created');

        // Test 2: Get setting
        const setting = await TradeDB.getUserSetting(testUserId, 'default_stop_loss_percent');
        assert.ok(setting, 'Setting should exist');
        assert.strictEqual(setting.setting_value, '7', 'Value should match');
        console.log('  ✅ Setting retrieved');

        // Test 3: Update setting
        await TradeDB.updateUserSetting(testUserId, 'default_stop_loss_percent', '8');
        const updated = await TradeDB.getUserSetting(testUserId, 'default_stop_loss_percent');
        assert.strictEqual(updated.setting_value, '8', 'Value should be updated');
        console.log('  ✅ Setting updated');

        // Test 4: Get all settings
        await TradeDB.updateUserSetting(testUserId, 'default_target_percent', '10');
        const allSettings = await TradeDB.getAllUserSettings(testUserId);
        assert.ok(allSettings.length >= 2, 'Should have multiple settings');
        console.log(`  ✅ Retrieved ${allSettings.length} settings`);

        // Test 5: Delete setting
        const deleted = await TradeDB.deleteUserSetting(testUserId, 'default_stop_loss_percent');
        assert.ok(deleted, 'Setting should be deleted');
        console.log('  ✅ Setting deleted');

        console.log('✅ User Settings tests passed\n');
        return true;
    } catch (error) {
        console.error('❌ User Settings test failed:', error.message);
        return false;
    }
}

/**
 * Test Suite: Portfolio Capital
 */
async function testPortfolioCapital() {
    console.log('💰 Testing Portfolio Capital...');

    try {
        // Test 1: Get capital for all markets
        const capital = await TradeDB.getPortfolioCapital(null, TEST_USER);
        assert.ok(capital, 'Capital data should exist');
        assert.ok(capital.India, 'India capital should exist');
        assert.ok(capital.UK, 'UK capital should exist');
        assert.ok(capital.US, 'US capital should exist');
        console.log('  ✅ Capital retrieved for all markets');

        // Test 2: Check capital structure
        assert.ok(capital.India.currency === 'INR', 'India currency should be INR');
        assert.ok(capital.UK.currency === 'GBP', 'UK currency should be GBP');
        assert.ok(capital.US.currency === 'USD', 'US currency should be USD');
        console.log('  ✅ Capital structure valid');

        // Test 3: Check position limits
        const canAdd = await TradeDB.canAddPosition('India', 50000, TEST_USER);
        assert.ok('canAdd' in canAdd, 'Should return canAdd property');
        console.log('  ✅ Position limit check working');

        console.log('✅ Portfolio Capital tests passed\n');
        return true;
    } catch (error) {
        console.error('❌ Portfolio Capital test failed:', error.message);
        return false;
    }
}

/**
 * Test Suite: Trade Operations
 */
async function testTradeOperations() {
    console.log('📊 Testing Trade Operations...');

    try {
        const testUserId = 'test_user_' + Date.now();

        // Test 1: Get all trades (should work even if empty)
        const allTrades = await TradeDB.getAllTrades(testUserId);
        assert.ok(Array.isArray(allTrades), 'Should return array');
        console.log(`  ✅ Retrieved ${allTrades.length} trades`);

        // Test 2: Get active trades
        const activeTrades = await TradeDB.getActiveTrades(testUserId);
        assert.ok(Array.isArray(activeTrades), 'Should return array');
        console.log(`  ✅ Retrieved ${activeTrades.length} active trades`);

        // Test 3: Get closed trades
        const closedTrades = await TradeDB.getClosedTrades(testUserId);
        assert.ok(Array.isArray(closedTrades), 'Should return array');
        console.log(`  ✅ Retrieved ${closedTrades.length} closed trades`);

        console.log('✅ Trade Operations tests passed\n');
        return true;
    } catch (error) {
        console.error('❌ Trade Operations test failed:', error.message);
        return false;
    }
}

/**
 * Test Suite: Database Connection
 */
async function testDatabaseConnection() {
    console.log('🔌 Testing Database Connection...');

    try {
        // Test 1: Check if connected
        const isConnected = TradeDB.isConnected();
        assert.ok(isConnected, 'Database should be connected');
        console.log('  ✅ Database connected');

        // Test 2: Check pool availability
        assert.ok(TradeDB.pool, 'Database pool should exist');
        console.log('  ✅ Database pool available');

        console.log('✅ Database Connection tests passed\n');
        return true;
    } catch (error) {
        console.error('❌ Database Connection test failed:', error.message);
        return false;
    }
}

/**
 * Run all tests
 */
async function runAllTests() {
    console.log('═══════════════════════════════════════');
    console.log('  DATABASE INTEGRATION TEST SUITE');
    console.log('═══════════════════════════════════════\n');

    const results = {
        total: 0,
        passed: 0,
        failed: 0
    };

    // Run test suites
    const tests = [
        { name: 'Database Connection', fn: testDatabaseConnection },
        { name: 'Portfolio Capital', fn: testPortfolioCapital },
        { name: 'Trade Operations', fn: testTradeOperations },
        { name: 'Pending Signals', fn: testPendingSignals },
        { name: 'User Settings', fn: testUserSettings }
    ];

    for (const test of tests) {
        results.total++;
        const passed = await test.fn();
        if (passed) {
            results.passed++;
        } else {
            results.failed++;
        }
    }

    // Print summary
    console.log('═══════════════════════════════════════');
    console.log('  TEST SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Total Tests: ${results.total}`);
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log('═══════════════════════════════════════\n');

    if (results.failed === 0) {
        console.log('🎉 All database tests passed!');
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
