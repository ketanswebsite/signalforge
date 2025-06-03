#!/usr/bin/env node

// Script to fix missing fields in PostgreSQL
const fs = require('fs').promises;
const path = require('path');

// Force PostgreSQL connection
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://signalforge_db_user:Xcipr9Wa1KeSWCNPjM9ymyMbD0SENf4R@dpg-d0vgkl95pdvs738glu0g-a/signalforge_db';

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixPostgresData() {
  console.log('🔧 Fixing PostgreSQL data fields...\n');
  
  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Connected to PostgreSQL\n');
    
    // Read backup data to get missing fields
    console.log('📂 Reading backup-trades.json for reference...');
    const backupPath = path.join(__dirname, 'backup-trades.json');
    const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
    
    // Create a map of trades by symbol and user_id for quick lookup
    const backupMap = {};
    backupData.trades.forEach(trade => {
      const key = `${trade.symbol}-${trade.user_id}`;
      backupMap[key] = trade;
    });
    
    // Get current trades from PostgreSQL
    const currentTrades = await pool.query('SELECT id, symbol, user_id FROM trades');
    console.log(`\n📊 Found ${currentTrades.rows.length} trades in PostgreSQL\n`);
    
    // Update each trade with missing fields
    let updateCount = 0;
    for (const trade of currentTrades.rows) {
      const key = `${trade.symbol}-${trade.user_id}`;
      const backupTrade = backupMap[key];
      
      if (backupTrade) {
        try {
          await pool.query(
            `UPDATE trades SET 
              currency_symbol = $1,
              stop_loss_percent = $2,
              take_profit_percent = $3,
              investment_amount = $4,
              shares = $5,
              stock_name = $6,
              square_off_date = $7,
              stop_loss_price = $8
            WHERE id = $9`,
            [
              backupTrade.currencySymbol || '₹',
              backupTrade.stopLossPercent || 5,
              backupTrade.takeProfitPercent || 8,
              backupTrade.investmentAmount || backupTrade.positionSize,
              backupTrade.shares || backupTrade.quantity,
              backupTrade.stockName || backupTrade.name,
              backupTrade.squareOffDate || backupTrade.exitDate,
              backupTrade.stopLossPrice || backupTrade.stopLoss,
              trade.id
            ]
          );
          updateCount++;
          console.log(`✅ Updated ${trade.symbol} with missing fields`);
        } catch (err) {
          console.error(`❌ Failed to update ${trade.symbol}:`, err.message);
        }
      } else {
        console.log(`⚠️  No backup data found for ${trade.symbol} (${trade.user_id})`);
      }
    }
    
    console.log(`\n✅ Updated ${updateCount} trades with missing fields`);
    
    // Verify the fix
    console.log('\n📊 Verifying data...');
    const sampleTrade = await pool.query(`
      SELECT symbol, investment_amount, currency_symbol, stop_loss_percent, take_profit_percent 
      FROM trades 
      WHERE investment_amount IS NOT NULL 
      LIMIT 3
    `);
    
    console.log('\nSample trades with fixed data:');
    sampleTrade.rows.forEach(trade => {
      console.log(`- ${trade.symbol}: ${trade.currency_symbol}${trade.investment_amount} (SL: ${trade.stop_loss_percent}%, TP: ${trade.take_profit_percent}%)`);
    });
    
    console.log('\n✅ Data fix complete!');
    
  } catch (error) {
    console.error('\n❌ Fix failed:', error);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run fix
fixPostgresData();