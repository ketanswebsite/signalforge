#!/usr/bin/env node

// Script to check what fields are actually in PostgreSQL
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://signalforge_db_user:Xcipr9Wa1KeSWCNPjM9ymyMbD0SENf4R@dpg-d0vgkl95pdvs738glu0g-a/signalforge_db';

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkFields() {
  console.log('🔍 Checking PostgreSQL fields...\n');
  
  try {
    // Get a sample trade
    const result = await pool.query(`
      SELECT 
        id, symbol, investment_amount, currency_symbol, 
        stop_loss_percent, take_profit_percent, position_size
      FROM trades 
      LIMIT 5
    `);
    
    console.log(`Found ${result.rows.length} trades\n`);
    
    result.rows.forEach((row, index) => {
      console.log(`Trade ${index + 1} (${row.symbol}):`);
      console.log(`  - investment_amount: ${row.investment_amount}`);
      console.log(`  - currency_symbol: ${row.currency_symbol}`);
      console.log(`  - stop_loss_percent: ${row.stop_loss_percent}`);
      console.log(`  - take_profit_percent: ${row.take_profit_percent}`);
      console.log(`  - position_size: ${row.position_size}`);
      console.log('');
    });
    
    // Check for NULL values
    const nullCheck = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(investment_amount) as has_investment,
        COUNT(currency_symbol) as has_currency,
        COUNT(stop_loss_percent) as has_stop_loss_percent,
        COUNT(take_profit_percent) as has_take_profit_percent
      FROM trades
    `);
    
    const stats = nullCheck.rows[0];
    console.log('📊 Field Statistics:');
    console.log(`Total trades: ${stats.total}`);
    console.log(`Has investment_amount: ${stats.has_investment} (${Math.round(stats.has_investment/stats.total*100)}%)`);
    console.log(`Has currency_symbol: ${stats.has_currency} (${Math.round(stats.has_currency/stats.total*100)}%)`);
    console.log(`Has stop_loss_percent: ${stats.has_stop_loss_percent} (${Math.round(stats.has_stop_loss_percent/stats.total*100)}%)`);
    console.log(`Has take_profit_percent: ${stats.has_take_profit_percent} (${Math.round(stats.has_take_profit_percent/stats.total*100)}%)`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkFields();