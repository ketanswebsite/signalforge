#!/usr/bin/env node

/**
 * Fix Migration Tracking Records
 * Inserts missing tracking records for migrations 001-007
 * These migrations were already applied but weren't tracked in schema_migrations table
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

async function fixMigrationTracking() {
  if (!process.env.DATABASE_URL) {
    log('❌ ERROR: DATABASE_URL environment variable not found', 'red');
    log('\nSet your database URL:', 'yellow');
    log('  export DATABASE_URL="postgresql://user:pass@host:5432/dbname"', 'yellow');
    process.exit(1);
  }

  log('🔗 Connecting to database...', 'cyan');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    const client = await pool.connect();
    log('✅ Connected successfully', 'green');

    // Check current state
    const currentResult = await client.query(
      'SELECT filename FROM schema_migrations ORDER BY id'
    );

    log('\n📋 Current tracked migrations:', 'cyan');
    currentResult.rows.forEach(row => {
      log(`   ✓ ${row.filename}`, 'green');
    });

    // Insert missing tracking records
    log('\n🔧 Inserting missing tracking records...', 'cyan');

    const insertResult = await client.query(`
      INSERT INTO schema_migrations (filename, applied_at) VALUES
        ('001_add_critical_indexes.sql', '2025-10-06 22:40:00'::timestamp),
        ('002_add_constraints.sql', '2025-10-06 22:41:00'::timestamp),
        ('003_create_subscription_tables.sql', '2025-10-06 22:42:00'::timestamp),
        ('004_consolidate_columns.sql', '2025-10-06 22:43:00'::timestamp),
        ('005_add_ui_columns.sql', '2025-10-06 22:44:00'::timestamp),
        ('006_optimize_data_types.sql', '2025-10-06 22:45:00'::timestamp),
        ('007_add_audit_logging.sql', '2025-10-06 22:45:30'::timestamp)
      ON CONFLICT (filename) DO NOTHING
      RETURNING id, filename
    `);

    if (insertResult.rowCount > 0) {
      log(`✅ Successfully inserted ${insertResult.rowCount} tracking records`, 'green');
      insertResult.rows.forEach(row => {
        log(`   ✓ ${row.filename}`, 'green');
      });
    } else {
      log('ℹ️  All records already exist (no changes needed)', 'yellow');
    }

    // Show final state
    const finalResult = await client.query(
      'SELECT id, filename, applied_at FROM schema_migrations ORDER BY id'
    );

    log('\n📊 Final migration tracking status:', 'cyan');
    log(`   Total tracked migrations: ${finalResult.rowCount}`, 'cyan');
    finalResult.rows.forEach(row => {
      log(`   ${row.id}. ${row.filename} (${row.applied_at.toISOString()})`, 'cyan');
    });

    log('\n✅ Migration tracking fixed successfully!', 'green');
    log('   Your admin panel should now show 0 pending migrations', 'green');

    client.release();
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    if (error.detail) {
      log(`   Detail: ${error.detail}`, 'yellow');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the fix
log('╔════════════════════════════════════════════════════════════════╗', 'cyan');
log('║           FIX MIGRATION TRACKING - Stock Proxy                 ║', 'cyan');
log('╚════════════════════════════════════════════════════════════════╝', 'cyan');

fixMigrationTracking();
