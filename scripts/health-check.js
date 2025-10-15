/**
 * System Health Monitoring Utility
 * Checks various system components and reports health status
 *
 * Usage: node scripts/health-check.js [--verbose]
 */

const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');
const TradeDB = require('../database-postgres');

// Configuration
const CONFIG = {
    server: {
        protocol: process.env.SERVER_PROTOCOL || 'http',
        host: process.env.SERVER_HOST || 'localhost',
        port: process.env.PORT || 3000
    },
    thresholds: {
        responseTime: 1000,        // ms
        memoryUsagePercent: 80,    // %
        dbQueryTime: 500,          // ms
        errorRate: 1               // %
    }
};

// Health check results
const healthStatus = {
    overall: 'healthy',
    checks: [],
    timestamp: new Date().toISOString(),
    errors: [],
    warnings: []
};

// Verbose mode
const VERBOSE = process.argv.includes('--verbose');

/**
 * Helper: Log with emoji
 */
function log(emoji, message, type = 'info') {
    if (type === 'error') {
        console.error(`${emoji} ${message}`);
    } else if (type === 'warn') {
        console.warn(`${emoji} ${message}`);
    } else {
        console.log(`${emoji} ${message}`);
    }
}

/**
 * Helper: Add check result
 */
function addCheckResult(name, passed, message, duration = null) {
    const result = {
        name,
        status: passed ? 'pass' : 'fail',
        message,
        duration: duration ? `${duration.toFixed(2)}ms` : null
    };

    healthStatus.checks.push(result);

    if (!passed) {
        healthStatus.errors.push(`${name}: ${message}`);
        healthStatus.overall = 'unhealthy';
        log('❌', `${name}: ${message}`, 'error');
    } else if (VERBOSE) {
        log('✅', `${name}: ${message}`);
    }

    return passed;
}

/**
 * Helper: Add warning
 */
function addWarning(name, message) {
    healthStatus.warnings.push(`${name}: ${message}`);
    log('⚠️', `${name}: ${message}`, 'warn');
}

/**
 * Check: Database Connection
 */
async function checkDatabaseConnection() {
    try {
        const start = performance.now();
        const isConnected = TradeDB.isConnected();
        const duration = performance.now() - start;

        if (!isConnected) {
            return addCheckResult('Database Connection', false, 'Not connected', duration);
        }

        // Try a simple query
        await TradeDB.getAllUserSettings('default');
        const queryDuration = performance.now() - start;

        if (queryDuration > CONFIG.thresholds.dbQueryTime) {
            addWarning('Database Performance', `Query took ${queryDuration.toFixed(2)}ms (threshold: ${CONFIG.thresholds.dbQueryTime}ms)`);
        }

        return addCheckResult('Database Connection', true, 'Connected and responsive', queryDuration);
    } catch (error) {
        return addCheckResult('Database Connection', false, error.message);
    }
}

/**
 * Check: Database Tables
 */
async function checkDatabaseTables() {
    try {
        const requiredTables = [
            'trades',
            'pending_signals',
            'user_settings'
        ];

        for (const table of requiredTables) {
            const query = `SELECT COUNT(*) FROM ${table}`;
            await TradeDB.pool.query(query);
        }

        return addCheckResult('Database Tables', true, 'All required tables exist');
    } catch (error) {
        return addCheckResult('Database Tables', false, error.message);
    }
}

/**
 * Check: API Endpoints
 */
async function checkAPIEndpoints() {
    const endpoints = [
        { path: '/api/test', method: 'GET' },
        { path: '/api/settings', method: 'GET' }
    ];

    let allPassed = true;

    for (const endpoint of endpoints) {
        try {
            const start = performance.now();
            const result = await makeRequest(endpoint.path, endpoint.method);
            const duration = performance.now() - start;

            if (result.statusCode >= 200 && result.statusCode < 500) {
                if (duration > CONFIG.thresholds.responseTime) {
                    addWarning(`API ${endpoint.path}`, `Slow response: ${duration.toFixed(2)}ms`);
                }
                addCheckResult(`API ${endpoint.path}`, true, `Responded in ${duration.toFixed(2)}ms`, duration);
            } else {
                addCheckResult(`API ${endpoint.path}`, false, `Status code: ${result.statusCode}`, duration);
                allPassed = false;
            }
        } catch (error) {
            addCheckResult(`API ${endpoint.path}`, false, error.message);
            allPassed = false;
        }
    }

    return allPassed;
}

/**
 * Helper: Make HTTP request
 */
function makeRequest(path, method = 'GET') {
    return new Promise((resolve, reject) => {
        const protocol = CONFIG.server.protocol === 'https' ? https : http;
        const options = {
            hostname: CONFIG.server.host,
            port: CONFIG.server.port,
            path: path,
            method: method,
            timeout: 5000
        };

        const req = protocol.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    data: data
                });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

/**
 * Check: Memory Usage
 */
function checkMemoryUsage() {
    const usage = process.memoryUsage();
    const heapUsedMB = (usage.heapUsed / 1024 / 1024).toFixed(2);
    const heapTotalMB = (usage.heapTotal / 1024 / 1024).toFixed(2);
    const rssMB = (usage.rss / 1024 / 1024).toFixed(2);
    const percentUsed = ((usage.heapUsed / usage.heapTotal) * 100).toFixed(2);

    if (percentUsed > CONFIG.thresholds.memoryUsagePercent) {
        addWarning('Memory Usage', `High memory usage: ${percentUsed}%`);
    }

    return addCheckResult(
        'Memory Usage',
        true,
        `Heap: ${heapUsedMB}/${heapTotalMB} MB (${percentUsed}%), RSS: ${rssMB} MB`
    );
}

/**
 * Check: Portfolio Capital Calculation
 */
async function checkPortfolioCapital() {
    try {
        const start = performance.now();
        const capital = await TradeDB.getPortfolioCapital();
        const duration = performance.now() - start;

        // Verify structure
        if (!capital.India || !capital.UK || !capital.US) {
            return addCheckResult('Portfolio Capital', false, 'Missing market data', duration);
        }

        // Check for required fields
        const markets = ['India', 'UK', 'US'];
        for (const market of markets) {
            if (!capital[market].initial || !capital[market].allocated || !capital[market].available) {
                return addCheckResult('Portfolio Capital', false, `Incomplete data for ${market}`, duration);
            }
        }

        if (duration > 100) {
            addWarning('Portfolio Capital', `Calculation took ${duration.toFixed(2)}ms (target: <100ms)`);
        }

        return addCheckResult('Portfolio Capital', true, `All markets calculated in ${duration.toFixed(2)}ms`, duration);
    } catch (error) {
        return addCheckResult('Portfolio Capital', false, error.message);
    }
}

/**
 * Check: Settings System
 */
async function checkSettingsSystem() {
    try {
        const start = performance.now();
        const settings = await TradeDB.getAllUserSettings('default');
        const duration = performance.now() - start;

        // Verify default settings exist
        const requiredSettings = [
            'default_stop_loss_percent',
            'default_target_percent',
            'max_positions_total',
            'initial_capital_india',
            'initial_capital_uk',
            'initial_capital_us'
        ];

        const settingKeys = settings.map(s => s.setting_key);
        const missingSettings = requiredSettings.filter(key => !settingKeys.includes(key));

        if (missingSettings.length > 0) {
            return addCheckResult('Settings System', false, `Missing settings: ${missingSettings.join(', ')}`, duration);
        }

        return addCheckResult('Settings System', true, `${settings.length} settings loaded in ${duration.toFixed(2)}ms`, duration);
    } catch (error) {
        return addCheckResult('Settings System', false, error.message);
    }
}

/**
 * Check: Environment Variables
 */
function checkEnvironmentVariables() {
    const requiredVars = [
        'DATABASE_URL',
        'NODE_ENV'
    ];

    const optionalVars = [
        'TELEGRAM_BOT_TOKEN',
        'SESSION_SECRET'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
        return addCheckResult('Environment Variables', false, `Missing required vars: ${missing.join(', ')}`);
    }

    const missingOptional = optionalVars.filter(varName => !process.env[varName]);
    if (missingOptional.length > 0) {
        addWarning('Environment Variables', `Missing optional vars: ${missingOptional.join(', ')}`);
    }

    return addCheckResult('Environment Variables', true, 'All required variables present');
}

/**
 * Print Health Report
 */
function printHealthReport() {
    console.log('\n═══════════════════════════════════════');
    console.log('  SYSTEM HEALTH REPORT');
    console.log('═══════════════════════════════════════');
    console.log(`Timestamp: ${healthStatus.timestamp}`);
    console.log(`Overall Status: ${healthStatus.overall.toUpperCase()}`);
    console.log('───────────────────────────────────────');

    if (!VERBOSE) {
        // Summary mode - only show failures and warnings
        if (healthStatus.errors.length > 0) {
            console.log('\n❌ Errors:');
            healthStatus.errors.forEach(error => console.log(`  - ${error}`));
        }

        if (healthStatus.warnings.length > 0) {
            console.log('\n⚠️  Warnings:');
            healthStatus.warnings.forEach(warning => console.log(`  - ${warning}`));
        }

        if (healthStatus.errors.length === 0 && healthStatus.warnings.length === 0) {
            console.log('\n✅ All checks passed!');
        }
    } else {
        // Verbose mode - show all checks
        console.log('\nCheck Results:');
        healthStatus.checks.forEach(check => {
            const icon = check.status === 'pass' ? '✅' : '❌';
            const duration = check.duration ? ` (${check.duration})` : '';
            console.log(`  ${icon} ${check.name}: ${check.message}${duration}`);
        });
    }

    console.log('\n═══════════════════════════════════════');

    // Summary counts
    const passed = healthStatus.checks.filter(c => c.status === 'pass').length;
    const failed = healthStatus.checks.filter(c => c.status === 'fail').length;
    console.log(`Total Checks: ${healthStatus.checks.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Warnings: ${healthStatus.warnings.length}`);
    console.log('═══════════════════════════════════════\n');
}

/**
 * Run All Health Checks
 */
async function runHealthChecks() {
    console.log('🏥 Starting System Health Check...\n');

    try {
        // Environment checks (synchronous)
        log('🔧', 'Checking environment variables...');
        checkEnvironmentVariables();
        checkMemoryUsage();

        // Database checks
        log('💾', 'Checking database...');
        await checkDatabaseConnection();
        await checkDatabaseTables();

        // Application checks
        log('⚙️', 'Checking application components...');
        await checkPortfolioCapital();
        await checkSettingsSystem();

        // API checks (requires server to be running)
        log('🌐', 'Checking API endpoints...');
        await checkAPIEndpoints();

        // Print report
        printHealthReport();

        // Exit with appropriate code
        if (healthStatus.overall === 'healthy') {
            console.log('🎉 System is healthy!\n');
            process.exit(0);
        } else {
            console.log('⚠️  System has issues that need attention.\n');
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Fatal error during health check:', error);
        process.exit(1);
    }
}

// Run health checks if executed directly
if (require.main === module) {
    runHealthChecks().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { runHealthChecks, healthStatus };
