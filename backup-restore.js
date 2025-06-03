#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// Load database module
let TradeDB;
try {
  TradeDB = require('./database-postgres');
  if (!TradeDB.isConnected()) {
    TradeDB = require('./database-json');
  }
} catch (err) {
  TradeDB = require('./database-json');
}

async function backupData() {
  console.log('📦 Backing up data...');
  
  try {
    // Get all trades
    const trades = await TradeDB.getAllTrades ? await TradeDB.getAllTrades() : [];
    
    // Get ALL alert preferences (not just active ones)
    let alertPrefs = [];
    try {
      // Try to get all users' preferences
      const users = ['default', 'ketanjoshisahs@gmail.com', 'ketan.g.joshi@hotmail.com'];
      for (const userId of users) {
        const prefs = await TradeDB.getAlertPreferences(userId);
        if (prefs) {
          alertPrefs.push(prefs);
        }
      }
    } catch (err) {
      console.log('Using getAllActiveAlertUsers fallback');
      alertPrefs = await TradeDB.getAllActiveAlertUsers();
    }
    
    const backup = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      trades: trades,
      alertPreferences: alertPrefs
    };
    
    const backupPath = path.join(__dirname, 'backup-data.json');
    await fs.writeFile(backupPath, JSON.stringify(backup, null, 2));
    
    console.log(`✅ Backup created: ${backupPath}`);
    console.log(`   - ${trades.length} trades`);
    console.log(`   - ${alertPrefs.length} alert preferences`);
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

async function restoreData() {
  console.log('📥 Restoring data...');
  
  try {
    const backupPath = path.join(__dirname, 'backup-data.json');
    const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
    
    console.log(`📅 Backup from: ${backupData.timestamp}`);
    
    // Restore trades
    if (backupData.trades && backupData.trades.length > 0) {
      console.log(`\n🔄 Restoring ${backupData.trades.length} trades...`);
      
      // Clear existing trades first
      await TradeDB.deleteAllTrades();
      
      // Bulk insert trades
      await TradeDB.bulkInsertTrades(backupData.trades);
      console.log('✅ Trades restored');
    }
    
    // Restore alert preferences
    if (backupData.alertPreferences && backupData.alertPreferences.length > 0) {
      console.log(`\n🔄 Restoring ${backupData.alertPreferences.length} alert preferences...`);
      
      for (const prefs of backupData.alertPreferences) {
        await TradeDB.saveAlertPreferences(prefs);
      }
      console.log('✅ Alert preferences restored');
    }
    
    console.log('\n✅ Restore complete!');
    
  } catch (error) {
    console.error('❌ Restore failed:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const command = process.argv[2];

if (command === 'backup') {
  backupData();
} else if (command === 'restore') {
  restoreData();
} else {
  console.log('Usage:');
  console.log('  node backup-restore.js backup   - Create a backup');
  console.log('  node backup-restore.js restore  - Restore from backup');
}