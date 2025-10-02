#!/usr/bin/env node

/**
 * Cleanup partially created tables from failed migrations
 */

const { Pool } = require('pg');
require('dotenv').config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function cleanup() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    log('\n🧹 Cleaning up partial subscription tables...', 'cyan');

    // Drop subscription tables in reverse dependency order
    const tablesToDrop = [
      'subscription_history',
      'payment_verification_queue',
      'payment_transactions',
      'user_subscriptions',
      'subscription_plans'
    ];

    for (const table of tablesToDrop) {
      try {
        await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        log(`  ✅ Dropped ${table}`, 'green');
      } catch (error) {
        log(`  ⚠️  Could not drop ${table}: ${error.message}`, 'yellow');
      }
    }

    // Drop related functions
    try {
      await pool.query('DROP FUNCTION IF EXISTS update_updated_at_column CASCADE');
      log('  ✅ Dropped update_updated_at_column function', 'green');
    } catch (error) {
      log(`  ⚠️  Could not drop function: ${error.message}`, 'yellow');
    }

    // Drop related views
    try {
      await pool.query('DROP VIEW IF EXISTS v_active_subscriptions CASCADE');
      log('  ✅ Dropped v_active_subscriptions view', 'green');
    } catch (error) {
      log(`  ⚠️  Could not drop view: ${error.message}`, 'yellow');
    }

    log('\n✅ Cleanup complete! You can now re-run migrations.', 'green');

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

cleanup();
