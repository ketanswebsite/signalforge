#!/usr/bin/env node

// Post-deployment script to check and fix PostgreSQL data
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function postDeployCheck() {
  console.log('🔍 Post-Deployment Database Check\n');
  
  try {
    // Check if we have trades
    const tradeCount = await pool.query('SELECT COUNT(*) FROM trades');
    console.log(`📊 Total trades in database: ${tradeCount.rows[0].count}\n`);
    
    if (tradeCount.rows[0].count === '0') {
      console.log('⚠️  No trades found! Running full migration...\n');
      await runMigration();
      return;
    }
    
    // Check for NULL fields
    const nullCheck = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(investment_amount) as has_investment,
        COUNT(currency_symbol) as has_currency,
        COUNT(stop_loss_percent) as has_stop_loss_percent
      FROM trades
      WHERE user_id != 'default' OR user_id IS NULL
    `);
    
    const stats = nullCheck.rows[0];
    const missingData = stats.has_investment < stats.total || 
                       stats.has_currency < stats.total || 
                       stats.has_stop_loss_percent < stats.total;
    
    if (missingData) {
      console.log('⚠️  Missing data detected:');
      console.log(`   - Investment amounts: ${stats.has_investment}/${stats.total}`);
      console.log(`   - Currency symbols: ${stats.has_currency}/${stats.total}`);
      console.log(`   - Stop loss percents: ${stats.has_stop_loss_percent}/${stats.total}`);
      console.log('\n📝 Running migration to restore missing fields...\n');
      
      await runMigration();
    } else {
      console.log('✅ All data fields are present!');
      console.log('\n📊 Sample data:');
      
      const sample = await pool.query(`
        SELECT symbol, investment_amount, currency_symbol, stop_loss_percent 
        FROM trades 
        WHERE investment_amount IS NOT NULL 
        LIMIT 3
      `);
      
      sample.rows.forEach(row => {
        console.log(`   ${row.symbol}: ${row.currency_symbol}${row.investment_amount} (SL: ${row.stop_loss_percent}%)`);
      });
      
      console.log('\n✅ No migration needed - database is complete!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

async function runMigration() {
  console.log('🚀 Starting automatic migration...\n');
  
  try {
    // Import and run the migration
    require('./migrate-to-postgres-render.js');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\nPlease run manually: node migrate-to-postgres-render.js');
  }
}

// Run the check
postDeployCheck();