const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'trades.db');
console.log('Exporting trades from:', dbPath);

try {
  const db = new Database(dbPath, { readonly: true });
  
  // Get all trades
  const trades = db.prepare('SELECT * FROM trades').all();
  console.log(`Found ${trades.length} trades to export`);
  
  // Get all alert preferences
  const alertPrefs = db.prepare('SELECT * FROM alert_preferences').all();
  console.log(`Found ${alertPrefs.length} alert preferences`);
  
  // Create export object
  const exportData = {
    trades: trades,
    alert_preferences: alertPrefs,
    exportDate: new Date().toISOString(),
    totalTrades: trades.length
  };
  
  // Write to file
  const exportPath = path.join(__dirname, 'trades-export.json');
  fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
  
  console.log(`\nExport successful!`);
  console.log(`File saved to: ${exportPath}`);
  console.log(`\nYou can now:`);
  console.log(`1. Commit and push this file to GitHub`);
  console.log(`2. Import it on Render using the import endpoint`);
  
  db.close();
} catch (error) {
  console.error('Export failed:', error.message);
}