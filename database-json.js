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

// Database operations matching the PostgreSQL interface
const TradeDB = {
  // Check if database is connected (always true for JSON)
  isConnected() {
    return true;
  },

  // Get all trades for a user
  async getAllTrades(userId = 'default') {
    try {
      const userTrades = memoryDB.trades.filter(trade => {
        const tradeUserId = trade.user_id || 'default';
        return tradeUserId === userId;
      });
      console.log(`Database: getAllTrades returned ${userTrades.length} trades for user ${userId}`);
      return userTrades.sort((a, b) => 
        new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()
      );
    } catch (error) {
      console.error('Database: Error in getAllTrades:', error);
      return [];
    }
  },

  // Get active trades for a user
  async getActiveTrades(userId = 'default') {
    return memoryDB.trades.filter(t => 
      t.status === 'active' && (t.user_id || 'default') === userId
    );
  },

  // Get closed trades for a user
  async getClosedTrades(userId = 'default') {
    return memoryDB.trades.filter(t => 
      t.status === 'closed' && (t.user_id || 'default') === userId
    );
  },

  // Get trade by ID for a user
  async getTradeById(id, userId = 'default') {
    // Handle both string and number IDs
    const numId = typeof id === 'string' ? parseFloat(id) : id;
    return memoryDB.trades.find(t => 
      (t.id === id || t.id === numId || t.id === String(id)) && 
      (t.user_id || 'default') === userId
    );
  },

  // Get trades by symbol for a user
  async getTradesBySymbol(symbol, userId = 'default') {
    return memoryDB.trades.filter(t => 
      t.symbol === symbol && (t.user_id || 'default') === userId
    );
  },

  // Insert a new trade for a user
  async insertTrade(trade, userId = 'default') {
    try {
      const newTrade = {
        ...trade,
        user_id: userId,
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

  // Update a trade for a user
  async updateTrade(id, updates, userId = 'default') {
    try {
      console.log('>>> Database updateTrade called:', {
        id,
        idType: typeof id,
        userId,
        hasEntryPrice: 'entryPrice' in updates,
        entryPrice: updates.entryPrice,
        updatesKeys: Object.keys(updates)
      });
      
      // Handle both string and number IDs
      const numId = typeof id === 'string' ? parseFloat(id) : id;
      const index = memoryDB.trades.findIndex(t => 
        (t.id === id || t.id === numId || t.id === String(id)) && 
        (t.user_id || 'default') === userId
      );
      
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
      console.log('>>> Update result: trade not found for id:', id, 'user:', userId);
      return false;
    } catch (error) {
      console.error('Error updating trade:', error);
      throw error;
    }
  },

  // Delete a trade for a user
  async deleteTrade(id, userId = 'default') {
    try {
      // Handle both string and number IDs
      const numId = typeof id === 'string' ? parseFloat(id) : id;
      const index = memoryDB.trades.findIndex(t => 
        (t.id === id || t.id === numId || t.id === String(id)) && 
        (t.user_id || 'default') === userId
      );
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

  // Delete all trades for a user
  async deleteAllTrades(userId = 'default') {
    try {
      const userTrades = memoryDB.trades.filter(t => 
        (t.user_id || 'default') === userId
      );
      const count = userTrades.length;
      memoryDB.trades = memoryDB.trades.filter(t => 
        (t.user_id || 'default') !== userId
      );
      saveDatabase();
      return count;
    } catch (error) {
      console.error('Error deleting all trades:', error);
      throw error;
    }
  },

  // Bulk insert trades for a user
  async bulkInsertTrades(trades, userId = 'default') {
    try {
      const newTrades = trades.map(trade => ({
        ...trade,
        user_id: userId,
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

  // Get user by email
  async getUserByEmail(email) {
    try {
      // Check alert preferences for user data
      return memoryDB.alert_preferences.find(p => p.user_id === email) || null;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return null;
    }
  },

  // Admin functions
  async getUserStatistics() {
    try {
      // Group trades by user_id
      const userStats = {};
      
      memoryDB.trades.forEach(trade => {
        const userId = trade.user_id || 'default';
        // Map default to admin email
        const displayUserId = userId === 'default' ? 'ketanjoshisahs@gmail.com' : userId;
        
        if (!userStats[displayUserId]) {
          userStats[displayUserId] = {
            user_id: displayUserId,
            total_trades: 0,
            active_trades: 0,
            closed_trades: 0,
            first_trade_date: trade.created_at || trade.entryDate,
            last_trade_date: trade.created_at || trade.entryDate
          };
        }
        
        userStats[displayUserId].total_trades++;
        if (trade.status === 'active') {
          userStats[displayUserId].active_trades++;
        } else {
          userStats[displayUserId].closed_trades++;
        }
        
        // Update first and last trade dates
        const tradeDate = new Date(trade.created_at || trade.entryDate);
        const firstDate = new Date(userStats[displayUserId].first_trade_date);
        const lastDate = new Date(userStats[displayUserId].last_trade_date);
        
        if (tradeDate < firstDate) {
          userStats[displayUserId].first_trade_date = trade.created_at || trade.entryDate;
        }
        if (tradeDate > lastDate) {
          userStats[displayUserId].last_trade_date = trade.created_at || trade.entryDate;
        }
      });
      
      // Convert to array and sort by total trades
      return Object.values(userStats).sort((a, b) => b.total_trades - a.total_trades);
    } catch (error) {
      console.error('Error getting user statistics:', error);
      return [];
    }
  },

  async getSystemStatistics() {
    try {
      const stats = {
        total_trades: 0,
        total_users: new Set(),
        active_trades: 0,
        closed_trades: 0
      };
      
      memoryDB.trades.forEach(trade => {
        const userId = trade.user_id || 'default';
        // Map default to admin email
        const displayUserId = userId === 'default' ? 'ketanjoshisahs@gmail.com' : userId;
        
        stats.total_trades++;
        stats.total_users.add(displayUserId);
        
        if (trade.status === 'active') {
          stats.active_trades++;
        } else {
          stats.closed_trades++;
        }
      });
      
      return {
        total_trades: stats.total_trades,
        total_users: stats.total_users.size,
        active_trades: stats.active_trades,
        closed_trades: stats.closed_trades
      };
    } catch (error) {
      console.error('Error getting system statistics:', error);
      return {
        total_trades: 0,
        total_users: 0,
        active_trades: 0,
        closed_trades: 0
      };
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