#!/usr/bin/env node

/**
 * Database Migration Runner
 * Runs all migration files in order against your Render PostgreSQL database
 *
 * Usage:
 *   node run-migrations.js
 *
 * Environment Variables Required:
 *   DATABASE_URL - Your Render PostgreSQL connection string
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
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

async function runMigrations() {
  // Check for DATABASE_URL
  if (!process.env.DATABASE_URL) {
    log('❌ ERROR: DATABASE_URL environment variable not found', 'red');
    log('\nPlease set your Render PostgreSQL URL:', 'yellow');
    log('  export DATABASE_URL="postgresql://user:pass@host:5432/dbname"', 'yellow');
    log('\nOr add it to your .env file:', 'yellow');
    log('  DATABASE_URL=postgresql://user:pass@host:5432/dbname', 'yellow');
    process.exit(1);
  }

  log('🔗 Connecting to database...', 'cyan');
  log(`   ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`, 'cyan');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Test connection
    const client = await pool.connect();
    const result = await client.query('SELECT version()');
    log('✅ Connected to PostgreSQL', 'green');
    log(`   ${result.rows[0].version.split(',')[0]}`, 'cyan');
    client.release();

    // Get migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql') && f.match(/^\d{3}_/))
      .sort();

    if (files.length === 0) {
      log('⚠️  No migration files found in migrations/', 'yellow');
      process.exit(0);
    }

    log(`\n📦 Found ${files.length} migration files`, 'cyan');

    // Ask for confirmation
    header('⚠️  IMPORTANT: This will modify your database schema');
    log('Migrations to run:', 'yellow');
    files.forEach((file, i) => {
      log(`  ${i + 1}. ${file}`, 'yellow');
    });
    log('\n✅ Make sure you have a backup of your database!', 'green');
    log('Press Ctrl+C to cancel, or wait 5 seconds to continue...', 'yellow');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Run migrations
    header('🚀 Starting Migrations');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.join(migrationsDir, file);

      log(`\n[${i + 1}/${files.length}] Running: ${file}`, 'bright');

      try {
        // Read migration file
        const sql = fs.readFileSync(filePath, 'utf8');

        // Execute migration
        const startTime = Date.now();
        await pool.query(sql);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        log(`✅ Completed in ${duration}s`, 'green');
      } catch (error) {
        log(`❌ FAILED: ${file}`, 'red');
        log(`\nError: ${error.message}`, 'red');

        if (error.hint) {
          log(`Hint: ${error.hint}`, 'yellow');
        }

        if (error.detail) {
          log(`Detail: ${error.detail}`, 'yellow');
        }

        log('\n🔄 Check the rollback section in the migration file', 'yellow');
        log(`   File: migrations/${file}`, 'yellow');

        process.exit(1);
      }
    }

    // Success summary
    header('🎉 All Migrations Completed Successfully!');
    log(`✅ ${files.length} migrations executed`, 'green');
    log('\n📋 Next Steps:', 'cyan');
    log('  1. Update application code (see DATABASE_IMPROVEMENTS.md)', 'cyan');
    log('  2. Test all functionality', 'cyan');
    log('  3. Monitor application logs', 'cyan');
    log('  4. Check database performance', 'cyan');

  } catch (error) {
    log(`\n❌ Connection Error: ${error.message}`, 'red');

    if (error.code === 'ENOTFOUND') {
      log('\n⚠️  Database host not found. Check your DATABASE_URL', 'yellow');
    } else if (error.code === 'ECONNREFUSED') {
      log('\n⚠️  Connection refused. Is the database running?', 'yellow');
    } else if (error.code === '28P01') {
      log('\n⚠️  Authentication failed. Check username/password', 'yellow');
    }

    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  log(`\n❌ Unhandled Error: ${error.message}`, 'red');
  process.exit(1);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  log('\n\n⚠️  Migration cancelled by user', 'yellow');
  process.exit(0);
});

// Run migrations
log('╔════════════════════════════════════════════════════════════════╗', 'cyan');
log('║          DATABASE MIGRATION RUNNER - Stock Proxy               ║', 'cyan');
log('╚════════════════════════════════════════════════════════════════╝', 'cyan');

runMigrations();
