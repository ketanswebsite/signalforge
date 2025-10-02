#!/usr/bin/env node

/**
 * Fix orphaned data before running constraints migration
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

async function fixOrphanedData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    log('\n🔍 Checking for orphaned data...', 'cyan');

    // Check for default user
    const userCheck = await pool.query("SELECT email FROM users WHERE email = 'default'");

    if (userCheck.rows.length === 0) {
      log('  Creating default user...', 'yellow');

      await pool.query(`
        INSERT INTO users (email, name, created_at, first_login, last_login)
        VALUES ('default', 'Default User', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (email) DO NOTHING
      `);

      log('  ✅ Default user created', 'green');
    } else {
      log('  ✅ Default user already exists', 'green');
    }

    // Check for orphaned alert_preferences
    const orphanedAlerts = await pool.query(`
      SELECT ap.user_id, COUNT(*) as count
      FROM alert_preferences ap
      LEFT JOIN users u ON ap.user_id = u.email
      WHERE u.email IS NULL
      GROUP BY ap.user_id
    `);

    if (orphanedAlerts.rows.length > 0) {
      log('\n  Found orphaned alert preferences:', 'yellow');
      orphanedAlerts.rows.forEach(row => {
        log(`    - user_id: ${row.user_id} (${row.count} records)`, 'yellow');
      });

      // Create users for orphaned records or delete them
      for (const row of orphanedAlerts.rows) {
        if (row.user_id && row.user_id !== 'default') {
          log(`  Creating user: ${row.user_id}`, 'cyan');
          await pool.query(`
            INSERT INTO users (email, name, created_at, first_login, last_login)
            VALUES ($1, $1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (email) DO NOTHING
          `, [row.user_id]);
        }
      }

      log('  ✅ Fixed orphaned alert preferences', 'green');
    } else {
      log('  ✅ No orphaned alert preferences', 'green');
    }

    // Check for orphaned trades
    const orphanedTrades = await pool.query(`
      SELECT t.user_id, COUNT(*) as count
      FROM trades t
      LEFT JOIN users u ON t.user_id = u.email
      WHERE u.email IS NULL
      GROUP BY t.user_id
    `);

    if (orphanedTrades.rows.length > 0) {
      log('\n  Found orphaned trades:', 'yellow');
      orphanedTrades.rows.forEach(row => {
        log(`    - user_id: ${row.user_id} (${row.count} trades)`, 'yellow');
      });

      // Create users for orphaned trades
      for (const row of orphanedTrades.rows) {
        if (row.user_id) {
          log(`  Creating user: ${row.user_id}`, 'cyan');
          await pool.query(`
            INSERT INTO users (email, name, created_at, first_login, last_login)
            VALUES ($1, $1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (email) DO NOTHING
          `, [row.user_id]);
        }
      }

      log('  ✅ Fixed orphaned trades', 'green');
    } else {
      log('  ✅ No orphaned trades', 'green');
    }

    log('\n✅ All orphaned data has been fixed!', 'green');
    log('You can now re-run the migrations.', 'cyan');

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixOrphanedData();
