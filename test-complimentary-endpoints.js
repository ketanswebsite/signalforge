#!/usr/bin/env node

/**
 * Test script for complimentary access endpoints
 *
 * This script tests the new admin API endpoints for granting/revoking complimentary access
 *
 * Prerequisites:
 * - Server must be running (npm start)
 * - You must be logged in as admin
 * - Test user must exist in database
 *
 * Usage:
 *   node test-complimentary-endpoints.js
 */

const TEST_USER_EMAIL = 'test@example.com';
const ADMIN_BASE_URL = 'http://localhost:3000/api/admin';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(message) {
  console.log('');
  log('━'.repeat(80), 'cyan');
  log(message, 'bright');
  log('━'.repeat(80), 'cyan');
  console.log('');
}

async function testEndpoint(name, method, url, body = null) {
  log(`\nTesting: ${name}`, 'cyan');
  log(`${method} ${url}`, 'cyan');

  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        // Note: In a real test, you'd need to include authentication cookies/headers
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
      log(`Body: ${JSON.stringify(body, null, 2)}`, 'yellow');
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (response.ok) {
      log('✅ SUCCESS', 'green');
      log(`Response: ${JSON.stringify(data, null, 2)}`, 'green');
      return { success: true, data };
    } else {
      log('❌ FAILED', 'red');
      log(`Status: ${response.status}`, 'red');
      log(`Error: ${JSON.stringify(data, null, 2)}`, 'red');
      return { success: false, data };
    }
  } catch (error) {
    log('❌ ERROR', 'red');
    log(`Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function runTests() {
  header('🧪 Testing Complimentary Access Endpoints');

  log('⚠️  IMPORTANT: This script requires:', 'yellow');
  log('  1. Server running (npm start)', 'yellow');
  log('  2. Admin authentication', 'yellow');
  log('  3. Test user exists in database', 'yellow');
  log(`  4. Test user email: ${TEST_USER_EMAIL}`, 'yellow');
  console.log('');

  const tests = [
    {
      name: 'Test 1: Grant Lifetime Access',
      method: 'POST',
      url: `${ADMIN_BASE_URL}/users/${TEST_USER_EMAIL}/grant-access`,
      body: {
        type: 'lifetime',
        reason: 'Testing lifetime access grant'
      }
    },
    {
      name: 'Test 2: Get Complimentary Users List',
      method: 'GET',
      url: `${ADMIN_BASE_URL}/users/complimentary`,
      body: null
    },
    {
      name: 'Test 3: Grant Temporary Access (30 days)',
      method: 'POST',
      url: `${ADMIN_BASE_URL}/users/${TEST_USER_EMAIL}/grant-access`,
      body: {
        type: 'temporary',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        reason: 'Testing temporary access grant'
      }
    },
    {
      name: 'Test 4: Revoke Access',
      method: 'POST',
      url: `${ADMIN_BASE_URL}/users/${TEST_USER_EMAIL}/revoke-access`,
      body: {
        reason: 'Testing access revocation'
      }
    },
    {
      name: 'Test 5: Extend Subscription (requires subscription ID)',
      method: 'POST',
      url: `${ADMIN_BASE_URL}/subscriptions/1/extend`,
      body: {
        days: 30,
        reason: 'Testing subscription extension'
      },
      note: 'Note: This test will fail if subscription ID 1 does not exist'
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    if (test.note) {
      log(`ℹ️  ${test.note}`, 'yellow');
    }

    const result = await testEndpoint(test.name, test.method, test.url, test.body);

    if (result.success) {
      passed++;
    } else {
      failed++;
    }

    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  header('📊 Test Summary');
  log(`Total Tests: ${tests.length}`, 'cyan');
  log(`✅ Passed: ${passed}`, passed > 0 ? 'green' : 'reset');
  log(`❌ Failed: ${failed}`, failed > 0 ? 'red' : 'reset');

  if (failed === 0) {
    log('\n🎉 All tests passed!', 'green');
  } else if (failed === tests.length) {
    log('\n⚠️  All tests failed. Check if:', 'yellow');
    log('  - Server is running', 'yellow');
    log('  - You are authenticated as admin', 'yellow');
    log('  - Test user exists', 'yellow');
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  log(`\n❌ Unhandled Error: ${error.message}`, 'red');
  process.exit(1);
});

// Run tests
log('╔════════════════════════════════════════════════════════════════╗', 'cyan');
log('║   Complimentary Access Endpoints Test Suite                   ║', 'cyan');
log('╚════════════════════════════════════════════════════════════════╝', 'cyan');

runTests();
