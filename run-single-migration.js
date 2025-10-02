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

    const migrationPath = path.join(__dirname, 'migrations', migrationFile);
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

const migrationFile = process.argv[2] || '008_create_admin_activity_log.sql';
runSingleMigration(migrationFile);
