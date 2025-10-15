/**
 * System Verification Script
 * Comprehensive verification of all system components
 *
 * Runs:
 * 1. Database integration tests
 * 2. Performance tests
 * 3. Health checks
 * 4. System integrity verification
 *
 * Usage: node scripts/verify-system.js [--quick]
 */

const { performance } = require('perf_hooks');
const { spawn } = require('child_process');
const path = require('path');

// Verification results
const verificationResults = {
    startTime: new Date().toISOString(),
    endTime: null,
    duration: null,
    overall: 'pass',
    suites: {
        database: { status: 'pending', errors: [], output: '' },
        performance: { status: 'pending', errors: [], output: '' },
        health: { status: 'pending', errors: [], output: '' }
    },
    summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0
    }
};

// Quick mode (skips performance tests)
const QUICK_MODE = process.argv.includes('--quick');

/**
 * Helper: Log with formatting
 */
function log(emoji, message, type = 'info') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    if (type === 'error') {
        console.error(`[${timestamp}] ${emoji} ${message}`);
    } else if (type === 'warn') {
        console.warn(`[${timestamp}] ${emoji} ${message}`);
    } else {
        console.log(`[${timestamp}] ${emoji} ${message}`);
    }
}

/**
 * Helper: Run a test script
 */
function runTestScript(scriptPath, suiteName) {
    return new Promise((resolve, reject) => {
        log('🚀', `Running ${suiteName}...`);
        const start = performance.now();

        const child = spawn('node', [scriptPath], {
            cwd: path.resolve(__dirname, '..'),
            stdio: 'pipe'
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            const output = data.toString();
            stdout += output;
            // Print output in real-time for better UX
            process.stdout.write(output);
        });

        child.stderr.on('data', (data) => {
            const output = data.toString();
            stderr += output;
            process.stderr.write(output);
        });

        child.on('close', (code) => {
            const duration = performance.now() - start;

            if (code === 0) {
                log('✅', `${suiteName} passed (${duration.toFixed(0)}ms)`);
                resolve({
                    passed: true,
                    duration,
                    stdout,
                    stderr
                });
            } else {
                log('❌', `${suiteName} failed with exit code ${code}`, 'error');
                resolve({
                    passed: false,
                    duration,
                    stdout,
                    stderr,
                    exitCode: code
                });
            }
        });

        child.on('error', (error) => {
            log('❌', `Error running ${suiteName}: ${error.message}`, 'error');
            resolve({
                passed: false,
                error: error.message,
                stdout,
                stderr
            });
        });
    });
}

/**
 * Verify: Database Tests
 */
async function verifyDatabase() {
    verificationResults.suites.database.status = 'running';

    try {
        const result = await runTestScript(
            path.join(__dirname, '../tests/database.test.js'),
            'Database Integration Tests'
        );

        if (result.passed) {
            verificationResults.suites.database.status = 'pass';
            verificationResults.summary.passed++;
        } else {
            verificationResults.suites.database.status = 'fail';
            verificationResults.suites.database.errors.push(
                result.error || `Exit code: ${result.exitCode}`
            );
            verificationResults.summary.failed++;
            verificationResults.overall = 'fail';
        }

        verificationResults.suites.database.output = result.stdout;
        verificationResults.summary.total++;

        return result.passed;
    } catch (error) {
        log('❌', `Database verification error: ${error.message}`, 'error');
        verificationResults.suites.database.status = 'fail';
        verificationResults.suites.database.errors.push(error.message);
        verificationResults.summary.failed++;
        verificationResults.summary.total++;
        verificationResults.overall = 'fail';
        return false;
    }
}

/**
 * Verify: Performance Tests
 */
async function verifyPerformance() {
    if (QUICK_MODE) {
        log('⏩', 'Skipping performance tests (quick mode)');
        verificationResults.suites.performance.status = 'skipped';
        return true;
    }

    verificationResults.suites.performance.status = 'running';

    try {
        const result = await runTestScript(
            path.join(__dirname, '../tests/performance.test.js'),
            'Performance Tests'
        );

        if (result.passed) {
            verificationResults.suites.performance.status = 'pass';
            verificationResults.summary.passed++;
        } else {
            verificationResults.suites.performance.status = 'fail';
            verificationResults.suites.performance.errors.push(
                result.error || `Exit code: ${result.exitCode}`
            );
            verificationResults.summary.failed++;
            verificationResults.overall = 'fail';
        }

        verificationResults.suites.performance.output = result.stdout;
        verificationResults.summary.total++;

        return result.passed;
    } catch (error) {
        log('❌', `Performance verification error: ${error.message}`, 'error');
        verificationResults.suites.performance.status = 'fail';
        verificationResults.suites.performance.errors.push(error.message);
        verificationResults.summary.failed++;
        verificationResults.summary.total++;
        verificationResults.overall = 'fail';
        return false;
    }
}

/**
 * Verify: System Health
 */
async function verifyHealth() {
    verificationResults.suites.health.status = 'running';

    try {
        const result = await runTestScript(
            path.join(__dirname, 'health-check.js'),
            'System Health Check'
        );

        if (result.passed) {
            verificationResults.suites.health.status = 'pass';
            verificationResults.summary.passed++;
        } else {
            verificationResults.suites.health.status = 'fail';
            verificationResults.suites.health.errors.push(
                result.error || `Exit code: ${result.exitCode}`
            );
            verificationResults.summary.failed++;

            // Health check failure is a warning, not a critical failure
            if (verificationResults.overall !== 'fail') {
                verificationResults.overall = 'warning';
            }
            verificationResults.summary.warnings++;
        }

        verificationResults.suites.health.output = result.stdout;
        verificationResults.summary.total++;

        return result.passed;
    } catch (error) {
        log('⚠️', `Health check error: ${error.message}`, 'warn');
        verificationResults.suites.health.status = 'fail';
        verificationResults.suites.health.errors.push(error.message);
        verificationResults.summary.warnings++;
        verificationResults.summary.total++;
        return false;
    }
}

/**
 * Verify: File Structure
 */
function verifyFileStructure() {
    log('📁', 'Verifying file structure...');

    const fs = require('fs');
    const requiredFiles = [
        'server.js',
        'database-postgres.js',
        'package.json',
        'public/index.html',
        'public/trades.html',
        'public/settings.html',
        'public/js/trades-ui.js',
        'public/js/settings-ui.js',
        'public/css/main.css',
        'lib/settings/settings-manager.js',
        'tests/database.test.js',
        'tests/performance.test.js',
        'scripts/health-check.js',
        'DEPLOYMENT.md',
        'BUGS.md'
    ];

    const missingFiles = [];
    for (const file of requiredFiles) {
        const fullPath = path.join(__dirname, '..', file);
        if (!fs.existsSync(fullPath)) {
            missingFiles.push(file);
        }
    }

    if (missingFiles.length > 0) {
        log('❌', `Missing files: ${missingFiles.join(', ')}`, 'error');
        return false;
    }

    log('✅', 'All required files present');
    return true;
}

/**
 * Print Final Report
 */
function printFinalReport() {
    const duration = (performance.now() - verificationResults.duration) / 1000;
    verificationResults.endTime = new Date().toISOString();

    console.log('\n\n╔═══════════════════════════════════════╗');
    console.log('║   SYSTEM VERIFICATION REPORT          ║');
    console.log('╚═══════════════════════════════════════╝');
    console.log(`\nStart Time: ${verificationResults.startTime}`);
    console.log(`End Time: ${verificationResults.endTime}`);
    console.log(`Duration: ${duration.toFixed(2)}s`);
    console.log(`\nOverall Status: ${verificationResults.overall.toUpperCase()}`);

    console.log('\n┌───────────────────────────────────────┐');
    console.log('│ Test Suite Results                    │');
    console.log('└───────────────────────────────────────┘');

    const suites = verificationResults.suites;
    Object.keys(suites).forEach(suiteName => {
        const suite = suites[suiteName];
        let icon = '❓';
        if (suite.status === 'pass') icon = '✅';
        else if (suite.status === 'fail') icon = '❌';
        else if (suite.status === 'skipped') icon = '⏩';

        console.log(`  ${icon} ${suiteName.padEnd(15)} : ${suite.status.toUpperCase()}`);

        if (suite.errors.length > 0) {
            suite.errors.forEach(error => {
                console.log(`     - ${error}`);
            });
        }
    });

    console.log('\n┌───────────────────────────────────────┐');
    console.log('│ Summary                               │');
    console.log('└───────────────────────────────────────┘');
    console.log(`  Total Suites: ${verificationResults.summary.total}`);
    console.log(`  ✅ Passed: ${verificationResults.summary.passed}`);
    console.log(`  ❌ Failed: ${verificationResults.summary.failed}`);
    console.log(`  ⚠️  Warnings: ${verificationResults.summary.warnings}`);

    console.log('\n╔═══════════════════════════════════════╗');
    if (verificationResults.overall === 'pass') {
        console.log('║   🎉 SYSTEM VERIFICATION PASSED       ║');
        console.log('╚═══════════════════════════════════════╝\n');
        console.log('✅ All critical tests passed!');
        console.log('✅ System is ready for deployment.\n');
    } else if (verificationResults.overall === 'warning') {
        console.log('║   ⚠️  VERIFICATION PASSED WITH WARNINGS ║');
        console.log('╚═══════════════════════════════════════╝\n');
        console.log('⚠️  Core tests passed but some warnings were found.');
        console.log('⚠️  Review warnings before deployment.\n');
    } else {
        console.log('║   ❌ SYSTEM VERIFICATION FAILED        ║');
        console.log('╚═══════════════════════════════════════╝\n');
        console.log('❌ Critical tests failed!');
        console.log('❌ DO NOT deploy until issues are resolved.\n');
    }

    console.log('───────────────────────────────────────\n');
}

/**
 * Main Verification Flow
 */
async function runSystemVerification() {
    console.log('═══════════════════════════════════════');
    console.log('  SYSTEM VERIFICATION');
    console.log('═══════════════════════════════════════');
    console.log(`Mode: ${QUICK_MODE ? 'QUICK' : 'FULL'}`);
    console.log('═══════════════════════════════════════\n');

    verificationResults.duration = performance.now();

    try {
        // Step 1: Verify file structure
        log('📋', 'Step 1: File Structure Verification');
        const fileCheckPassed = verifyFileStructure();
        if (!fileCheckPassed) {
            log('❌', 'File structure check failed - aborting', 'error');
            verificationResults.overall = 'fail';
            printFinalReport();
            process.exit(1);
        }
        console.log('');

        // Step 2: Run database tests
        log('📋', 'Step 2: Database Integration Tests');
        await verifyDatabase();
        console.log('');

        // Step 3: Run performance tests (unless quick mode)
        if (!QUICK_MODE) {
            log('📋', 'Step 3: Performance Tests');
            await verifyPerformance();
            console.log('');
        }

        // Step 4: Run health checks
        log('📋', `Step ${QUICK_MODE ? '3' : '4'}: System Health Check`);
        await verifyHealth();
        console.log('');

        // Print final report
        printFinalReport();

        // Exit with appropriate code
        if (verificationResults.overall === 'pass') {
            process.exit(0);
        } else if (verificationResults.overall === 'warning') {
            process.exit(0); // Still exit successfully for warnings
        } else {
            process.exit(1);
        }
    } catch (error) {
        log('❌', `Fatal error during verification: ${error.message}`, 'error');
        console.error(error.stack);
        process.exit(1);
    }
}

// Run verification if executed directly
if (require.main === module) {
    runSystemVerification().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { runSystemVerification, verificationResults };
