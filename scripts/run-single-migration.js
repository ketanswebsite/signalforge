#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

async function runSingleMigration(migrationFile) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log(`Running migration: ${migrationFile}`);

    const migrationPath = path.join(__dirname, '..', 'migrations', migrationFile);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    await pool.query(sql);

    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// No default: with no argument this used to apply 008_create_admin_activity_log.sql to whatever DATABASE_URL named.
const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node scripts/run-single-migration.js NNN_name.sql   (a file in migrations/; DATABASE_URL from .env)');
  process.exit(1);
}
runSingleMigration(migrationFile);
