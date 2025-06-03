#!/usr/bin/env node

// Migration script specifically for Render PostgreSQL
const fs = require('fs').promises;
const path = require('path');

// Force PostgreSQL connection
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://signalforge_db_user:Xcipr9Wa1KeSWCNPjM9ymyMbD0SENf4R@dpg-d0vgkl95pdvs738glu0g-a/signalforge_db';

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrateToPostgres() {
  console.log('🚀 Starting PostgreSQL migration on Render...\n');
  console.log(`📊 Database: ${process.env.DATABASE_URL.split('@')[1]}\n`);
  
  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Connected to PostgreSQL\n');
    
    // Read backup data
    console.log('📂 Reading backup-trades.json...');
    const backupPath = path.join(__dirname, 'backup-trades.json');
    const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
    
    console.log(`   - Found ${backupData.trades?.length || 0} trades`);
    console.log(`   - Found ${backupData.alert_preferences?.length || 0} alert preferences\n`);
    
    // Initialize database schema
    console.log('🔧 Checking database schema...');
    try {
      const TradeDB = require('./database-postgres');
      await TradeDB.init();
      console.log('✅ Database schema created\n');
    } catch (err) {
      if (err.code === '23505' || err.code === '42P07') {
        console.log('✅ Database schema already exists\n');
      } else {
        throw err;
      }
    }
    
    // Migrate trades
    if (backupData.trades && backupData.trades.length > 0) {
      console.log(`📤 Migrating ${backupData.trades.length} trades...`);
      
      // Clear existing trades first
      await pool.query('DELETE FROM trades');
      
      let successCount = 0;
      for (const trade of backupData.trades) {
        try {
          // Map fields to PostgreSQL schema - INCLUDING ALL FIELDS
          const mappedTrade = {
            symbol: trade.symbol,
            name: trade.stockName || trade.name || null,
            stockIndex: trade.stockIndex || null,
            entryDate: trade.entryDate,
            entryPrice: trade.entryPrice,
            quantity: trade.shares || trade.quantity || null,
            positionSize: trade.investmentAmount || trade.positionSize || null,
            stopLoss: trade.stopLossPrice || trade.stopLoss || null,
            targetPrice: trade.targetPrice || null,
            exitDate: trade.exitDate || trade.squareOffDate || null,
            exitPrice: trade.exitPrice || null,
            status: trade.status || 'active',
            profitLoss: trade.profit || trade.profitLoss || null,
            profitLossPercentage: trade.percentGain || trade.profitLossPercentage || null,
            notes: trade.notes || trade.entryReason || null,
            currencySymbol: trade.currencySymbol || '₹',
            stopLossPercent: trade.stopLossPercent || 5,
            takeProfitPercent: trade.takeProfitPercent || 8,
            investmentAmount: trade.investmentAmount || trade.positionSize || null,
            userId: trade.user_id || 'default'
          };
          
          await pool.query(
            `INSERT INTO trades (
              symbol, name, stock_index, entry_date, entry_price, 
              quantity, position_size, stop_loss, target_price, 
              exit_date, exit_price, status, profit_loss, profit_loss_percentage,
              notes, currency_symbol, stop_loss_percent, take_profit_percent, 
              investment_amount, user_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
            [
              mappedTrade.symbol,
              mappedTrade.name,
              mappedTrade.stockIndex,
              mappedTrade.entryDate,
              mappedTrade.entryPrice,
              mappedTrade.quantity,
              mappedTrade.positionSize,
              mappedTrade.stopLoss,
              mappedTrade.targetPrice,
              mappedTrade.exitDate,
              mappedTrade.exitPrice,
              mappedTrade.status,
              mappedTrade.profitLoss,
              mappedTrade.profitLossPercentage,
              mappedTrade.notes,
              mappedTrade.currencySymbol,
              mappedTrade.stopLossPercent,
              mappedTrade.takeProfitPercent,
              mappedTrade.investmentAmount,
              mappedTrade.userId
            ]
          );
          successCount++;
        } catch (err) {
          console.error(`   ❌ Failed to migrate trade ${trade.symbol}:`, err.message);
        }
      }
      console.log(`   ✅ Successfully migrated ${successCount}/${backupData.trades.length} trades\n`);
    }
    
    // Migrate alert preferences
    if (backupData.alert_preferences && backupData.alert_preferences.length > 0) {
      console.log(`📤 Migrating ${backupData.alert_preferences.length} alert preferences...`);
      
      for (const prefs of backupData.alert_preferences) {
        try {
          await pool.query(
            `INSERT INTO alert_preferences (
              user_id, telegram_enabled, telegram_chat_id, email_enabled, email_address,
              alert_on_buy, alert_on_sell, alert_on_target, alert_on_stoploss,
              alert_on_time_exit, market_open_alert, market_close_alert
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (user_id) DO UPDATE SET
              telegram_enabled = $2,
              telegram_chat_id = $3,
              email_enabled = $4,
              email_address = $5,
              alert_on_buy = $6,
              alert_on_sell = $7,
              alert_on_target = $8,
              alert_on_stoploss = $9,
              alert_on_time_exit = $10,
              market_open_alert = $11,
              market_close_alert = $12,
              updated_at = CURRENT_TIMESTAMP`,
            [
              prefs.user_id,
              prefs.telegram_enabled || false,
              prefs.telegram_chat_id || null,
              prefs.email_enabled || false,
              prefs.email_address || null,
              prefs.alert_on_buy !== false,
              prefs.alert_on_sell !== false,
              prefs.alert_on_target !== false,
              prefs.alert_on_stoploss !== false,
              prefs.alert_on_time_exit !== false,
              prefs.market_open_alert || false,
              prefs.market_close_alert || false
            ]
          );
          console.log(`   ✅ Migrated preferences for ${prefs.user_id}`);
        } catch (err) {
          console.error(`   ❌ Failed to migrate preferences for ${prefs.user_id}:`, err.message);
        }
      }
    }
    
    // Verify migration
    console.log('\n📊 Verifying migration...');
    const tradeCount = await pool.query('SELECT COUNT(*) FROM trades');
    const alertCount = await pool.query('SELECT COUNT(*) FROM alert_preferences');
    
    console.log(`   - Trades in PostgreSQL: ${tradeCount.rows[0].count}`);
    console.log(`   - Alert preferences in PostgreSQL: ${alertCount.rows[0].count}`);
    
    // Show some sample data
    const sampleTrades = await pool.query('SELECT symbol, status, user_id FROM trades LIMIT 5');
    console.log('\n📋 Sample trades:');
    sampleTrades.rows.forEach(trade => {
      console.log(`   - ${trade.symbol} (${trade.status}) - User: ${trade.user_id}`);
    });
    
    console.log('\n✅ Migration complete!');
    console.log('\n📌 Next steps:');
    console.log('1. Deploy this to Render');
    console.log('2. Run this script on Render using the console');
    console.log('3. Your app will now use PostgreSQL exclusively');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run migration
migrateToPostgres();