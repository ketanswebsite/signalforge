const fs = require('fs');
const path = require('path');

// JSON file path - in memory for Render free tier
const JSON_DB_PATH = process.env.RENDER 
  ? path.join(process.cwd(), 'trades-db.json')
  : path.join(__dirname, 'trades-db.json');

// In-memory database for Render free tier
let memoryDB = {
  trades: [],
  alert_preferences: []
};

// Load data from JSON file if it exists
function loadDatabase() {
  try {
    if (fs.existsSync(JSON_DB_PATH)) {
      const data = fs.readFileSync(JSON_DB_PATH, 'utf8');
      memoryDB = JSON.parse(data);
      console.log(`Loaded ${memoryDB.trades.length} trades from JSON database`);
    }
  } catch (error) {
    console.error('Error loading JSON database:', error);
  }
}

// Save database to JSON file
function saveDatabase() {
  try {
    fs.writeFileSync(JSON_DB_PATH, JSON.stringify(memoryDB, null, 2));
  } catch (error) {
    console.error('Error saving JSON database:', error);
  }
}

// Initialize database
loadDatabase();

// Auto-save every 30 seconds
setInterval(saveDatabase, 30000);

// Database operations matching the SQLite interface
const TradeDB = {
  // Get all trades
  async getAllTrades() {
    try {
      console.log(`Database: getAllTrades returned ${memoryDB.trades.length} trades`);
      return memoryDB.trades.sort((a, b) => 
        new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()
      );
    } catch (error) {
      console.error('Database: Error in getAllTrades:', error);
      return [];
    }
  },

  // Get active trades
  async getActiveTrades() {
    return memoryDB.trades.filter(t => t.status === 'active');
  },

  // Get closed trades
  async getClosedTrades() {
    return memoryDB.trades.filter(t => t.status === 'closed');
  },

  // Get trade by ID
  async getTradeById(id) {
    return memoryDB.trades.find(t => t.id === id);
  },

  // Get trades by symbol
  async getTradesBySymbol(symbol) {
    return memoryDB.trades.filter(t => t.symbol === symbol);
  },

  // Insert a new trade
  async insertTrade(trade) {
    try {
      const newTrade = {
        ...trade,
        id: Date.now() + Math.random(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      memoryDB.trades.push(newTrade);
      saveDatabase();
      return newTrade;
    } catch (error) {
      console.error('Error inserting trade:', error);
      throw error;
    }
  },

  // Update a trade
  async updateTrade(id, updates) {
    try {
      console.log('>>> Database updateTrade called:', {
        id,
        hasEntryPrice: 'entryPrice' in updates,
        entryPrice: updates.entryPrice,
        updatesKeys: Object.keys(updates)
      });
      
      const index = memoryDB.trades.findIndex(t => t.id === id);
      if (index !== -1) {
        memoryDB.trades[index] = {
          ...memoryDB.trades[index],
          ...updates,
          updated_at: new Date().toISOString()
        };
        saveDatabase();
        console.log('>>> Update result: success');
        return true;
      }
      console.log('>>> Update result: trade not found');
      return false;
    } catch (error) {
      console.error('Error updating trade:', error);
      throw error;
    }
  },

  // Delete a trade
  async deleteTrade(id) {
    try {
      const index = memoryDB.trades.findIndex(t => t.id === id);
      if (index !== -1) {
        memoryDB.trades.splice(index, 1);
        saveDatabase();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting trade:', error);
      throw error;
    }
  },

  // Delete all trades
  async deleteAllTrades() {
    try {
      const count = memoryDB.trades.length;
      memoryDB.trades = [];
      saveDatabase();
      return count;
    } catch (error) {
      console.error('Error deleting all trades:', error);
      throw error;
    }
  },

  // Bulk insert trades
  async bulkInsertTrades(trades) {
    try {
      const newTrades = trades.map(trade => ({
        ...trade,
        id: Date.now() + Math.random(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      memoryDB.trades.push(...newTrades);
      saveDatabase();
      return trades.length;
    } catch (error) {
      console.error('Error in bulk insert:', error);
      throw error;
    }
  },

  // Get alert preferences for a user
  async getAlertPreferences(userId = 'default') {
    try {
      return memoryDB.alert_preferences.find(p => p.user_id === userId) || null;
    } catch (error) {
      console.error('Error getting alert preferences:', error);
      return null;
    }
  },

  // Save or update alert preferences
  async saveAlertPreferences(prefs) {
    try {
      const defaults = {
        user_id: 'default',
        telegram_enabled: 0,
        telegram_chat_id: null,
        email_enabled: 0,
        email_address: null,
        alert_on_buy: 1,
        alert_on_sell: 1,
        alert_on_target: 1,
        alert_on_stoploss: 1,
        alert_on_time_exit: 1,
        market_open_alert: 0,
        market_close_alert: 0
      };
      
      const finalPrefs = { ...defaults, ...prefs };
      
      // Convert boolean values to integers for consistency
      Object.keys(finalPrefs).forEach(key => {
        if (typeof finalPrefs[key] === 'boolean') {
          finalPrefs[key] = finalPrefs[key] ? 1 : 0;
        }
      });
      
      const index = memoryDB.alert_preferences.findIndex(p => p.user_id === finalPrefs.user_id);
      if (index !== -1) {
        memoryDB.alert_preferences[index] = {
          ...finalPrefs,
          updated_at: new Date().toISOString()
        };
      } else {
        memoryDB.alert_preferences.push({
          ...finalPrefs,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
      
      saveDatabase();
      console.log('Saving preferences:', finalPrefs);
      return true;
    } catch (error) {
      console.error('Error saving alert preferences:', error);
      console.error('Preferences that failed:', prefs);
      throw error;
    }
  },

  // Get all users with active alerts
  async getAllActiveAlertUsers() {
    try {
      return memoryDB.alert_preferences.filter(p => p.telegram_enabled === 1 || p.email_enabled === 1);
    } catch (error) {
      console.error('Error getting active alert users:', error);
      return [];
    }
  },

  // Close the database connection (no-op for JSON)
  close() {
    saveDatabase();
    console.log('JSON database saved and closed');
  }
};

// Save on exit
process.on('SIGINT', () => {
  saveDatabase();
  process.exit();
});

process.on('SIGTERM', () => {
  saveDatabase();
  process.exit();
});

module.exports = TradeDB;