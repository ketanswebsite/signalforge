const Database = require('better-sqlite3');
const path = require('path');

// Create or open the database
const db = new Database(path.join(__dirname, 'trades.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
function initializeDatabase() {
  try {
    // Create trades table
    db.exec(`
      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        entryDate TEXT NOT NULL,
        entryPrice REAL NOT NULL,
        exitDate TEXT,
        exitPrice REAL,
        shares REAL NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'closed')),
        profit REAL,
        percentGain REAL,
        entryReason TEXT,
        exitReason TEXT,
        stockIndex TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

  // Create index for faster queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
    CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
    CREATE INDEX IF NOT EXISTS idx_trades_entryDate ON trades(entryDate);
  `);

  // Add missing columns if they don't exist
  try {
    // Check if columns exist by trying to query them
    const testQuery = db.prepare('SELECT stopLossPrice FROM trades LIMIT 1');
    testQuery.get();
  } catch (e) {
    // If column doesn't exist, add missing columns
    console.log('Adding missing columns to trades table...');
    db.exec(`
      ALTER TABLE trades ADD COLUMN stopLossPrice REAL;
      ALTER TABLE trades ADD COLUMN targetPrice REAL;
      ALTER TABLE trades ADD COLUMN squareOffDate TEXT;
      ALTER TABLE trades ADD COLUMN notes TEXT;
      ALTER TABLE trades ADD COLUMN stockName TEXT;
      ALTER TABLE trades ADD COLUMN investmentAmount REAL;
      ALTER TABLE trades ADD COLUMN currencySymbol TEXT;
      ALTER TABLE trades ADD COLUMN stopLossPercent REAL;
      ALTER TABLE trades ADD COLUMN takeProfitPercent REAL;
    `);
    console.log('Missing columns added successfully');
  }

  // Create alert_preferences table
  db.exec(`
    CREATE TABLE IF NOT EXISTS alert_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE NOT NULL,
      telegram_enabled BOOLEAN DEFAULT 0,
      telegram_chat_id TEXT,
      email_enabled BOOLEAN DEFAULT 0,
      email_address TEXT,
      alert_on_buy BOOLEAN DEFAULT 1,
      alert_on_sell BOOLEAN DEFAULT 1,
      alert_on_target BOOLEAN DEFAULT 1,
      alert_on_stoploss BOOLEAN DEFAULT 1,
      alert_on_time_exit BOOLEAN DEFAULT 1,
      market_open_alert BOOLEAN DEFAULT 0,
      market_close_alert BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    
    // Try to check if alert_preferences table exists
    try {
      const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='alert_preferences'").get();
      console.log('Alert preferences table info:', tableInfo);
    } catch (e) {
      console.error('Could not check table info:', e);
    }
  }
}

// Initialize the database
initializeDatabase();

// Prepared statements for better performance
const statements = {
  getAllTrades: db.prepare('SELECT * FROM trades ORDER BY entryDate DESC'),
  getActiveTrades: db.prepare('SELECT * FROM trades WHERE status = ?'),
  getTradeById: db.prepare('SELECT * FROM trades WHERE id = ?'),
  getTradesBySymbol: db.prepare('SELECT * FROM trades WHERE symbol = ?'),
  insertTrade: db.prepare(`
    INSERT INTO trades (symbol, entryDate, entryPrice, exitDate, exitPrice, shares, status, profit, percentGain, 
                       entryReason, exitReason, stockIndex, stopLossPrice, targetPrice, squareOffDate, notes, 
                       stockName, investmentAmount, currencySymbol, stopLossPercent, takeProfitPercent)
    VALUES (@symbol, @entryDate, @entryPrice, @exitDate, @exitPrice, @shares, @status, @profit, @percentGain, 
            @entryReason, @exitReason, @stockIndex, @stopLossPrice, @targetPrice, @squareOffDate, @notes,
            @stockName, @investmentAmount, @currencySymbol, @stopLossPercent, @takeProfitPercent)
  `),
  updateTrade: db.prepare(`
    UPDATE trades 
    SET exitDate = @exitDate, exitPrice = @exitPrice, status = @status, 
        profit = @profit, percentGain = @percentGain, exitReason = @exitReason,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `),
  updateTradeDetails: db.prepare(`
    UPDATE trades 
    SET entryPrice = COALESCE(@entryPrice, entryPrice),
        exitDate = COALESCE(@exitDate, exitDate), 
        exitPrice = COALESCE(@exitPrice, exitPrice), 
        status = COALESCE(@status, status),
        profit = COALESCE(@profit, profit), 
        percentGain = COALESCE(@percentGain, percentGain), 
        exitReason = COALESCE(@exitReason, exitReason),
        entryReason = COALESCE(@entryReason, entryReason),
        shares = COALESCE(@shares, shares),
        stopLossPrice = COALESCE(@stopLossPrice, stopLossPrice),
        targetPrice = COALESCE(@targetPrice, targetPrice),
        squareOffDate = COALESCE(@squareOffDate, squareOffDate),
        notes = COALESCE(@notes, notes),
        stopLossPercent = COALESCE(@stopLossPercent, stopLossPercent),
        takeProfitPercent = COALESCE(@takeProfitPercent, takeProfitPercent),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `),
  deleteTrade: db.prepare('DELETE FROM trades WHERE id = ?'),
  deleteAllTrades: db.prepare('DELETE FROM trades'),
  
  // Alert preferences statements
  getAlertPrefs: db.prepare('SELECT * FROM alert_preferences WHERE user_id = ?'),
  upsertAlertPrefs: db.prepare(`
    INSERT INTO alert_preferences (user_id, telegram_enabled, telegram_chat_id, email_enabled, email_address,
      alert_on_buy, alert_on_sell, alert_on_target, alert_on_stoploss, alert_on_time_exit, 
      market_open_alert, market_close_alert)
    VALUES (@user_id, @telegram_enabled, @telegram_chat_id, @email_enabled, @email_address,
      @alert_on_buy, @alert_on_sell, @alert_on_target, @alert_on_stoploss, @alert_on_time_exit,
      @market_open_alert, @market_close_alert)
    ON CONFLICT(user_id) DO UPDATE SET
      telegram_enabled = @telegram_enabled,
      telegram_chat_id = @telegram_chat_id,
      email_enabled = @email_enabled,
      email_address = @email_address,
      alert_on_buy = @alert_on_buy,
      alert_on_sell = @alert_on_sell,
      alert_on_target = @alert_on_target,
      alert_on_stoploss = @alert_on_stoploss,
      alert_on_time_exit = @alert_on_time_exit,
      market_open_alert = @market_open_alert,
      market_close_alert = @market_close_alert,
      updated_at = CURRENT_TIMESTAMP
  `),
  getAllActiveAlerts: db.prepare('SELECT * FROM alert_preferences WHERE telegram_enabled = 1 OR email_enabled = 1')
};

// Database operations
const TradeDB = {
  // Get all trades
  async getAllTrades() {
    try {
      const trades = statements.getAllTrades.all();
      console.log(`Database: getAllTrades returned ${trades.length} trades`);
      return trades;
    } catch (error) {
      console.error('Database: Error in getAllTrades:', error);
      return [];
    }
  },

  // Get active trades
  async getActiveTrades() {
    return statements.getActiveTrades.all('active');
  },

  // Get closed trades
  async getClosedTrades() {
    return statements.getActiveTrades.all('closed');
  },

  // Get trade by ID
  async getTradeById(id) {
    return statements.getTradeById.get(id);
  },

  // Get trades by symbol
  async getTradesBySymbol(symbol) {
    return statements.getTradesBySymbol.all(symbol);
  },

  // Insert a new trade
  async insertTrade(trade) {
    try {
      const info = statements.insertTrade.run(trade);
      return { id: info.lastInsertRowid, ...trade };
    } catch (error) {
      console.error('Error inserting trade:', error);
      throw error;
    }
  },

  // Update a trade (usually when closing it)
  async updateTrade(id, updates) {
    try {
      console.log('>>> Database updateTrade called:', {
        id,
        hasEntryPrice: 'entryPrice' in updates,
        entryPrice: updates.entryPrice,
        updatesKeys: Object.keys(updates)
      });
      
      // If updating entry price or other core fields, use updateTradeDetails
      if (updates.entryPrice !== undefined || updates.shares !== undefined || updates.entryReason !== undefined ||
          updates.stopLossPrice !== undefined || updates.targetPrice !== undefined || 
          updates.squareOffDate !== undefined || updates.notes !== undefined ||
          updates.stopLossPercent !== undefined || updates.takeProfitPercent !== undefined) {
        console.log('>>> Using updateTradeDetails statement');
        const info = statements.updateTradeDetails.run({ ...updates, id });
        console.log('>>> Update result:', { changes: info.changes });
        return info.changes > 0;
      } else {
        console.log('>>> Using simple updateTrade statement');
        // Otherwise use the simpler updateTrade for closing trades
        const info = statements.updateTrade.run({ ...updates, id });
        console.log('>>> Update result:', { changes: info.changes });
        return info.changes > 0;
      }
    } catch (error) {
      console.error('Error updating trade:', error);
      throw error;
    }
  },

  // Delete a trade
  async deleteTrade(id) {
    try {
      const info = statements.deleteTrade.run(id);
      return info.changes > 0;
    } catch (error) {
      console.error('Error deleting trade:', error);
      throw error;
    }
  },

  // Delete all trades
  async deleteAllTrades() {
    try {
      const info = statements.deleteAllTrades.run();
      return info.changes;
    } catch (error) {
      console.error('Error deleting all trades:', error);
      throw error;
    }
  },

  // Bulk insert trades (for migration from localStorage)
  async bulkInsertTrades(trades) {
    const insertMany = db.transaction((trades) => {
      for (const trade of trades) {
        statements.insertTrade.run(trade);
      }
    });

    try {
      insertMany(trades);
      return trades.length;
    } catch (error) {
      console.error('Error in bulk insert:', error);
      throw error;
    }
  },

  // Get alert preferences for a user
  async getAlertPreferences(userId = 'default') {
    try {
      return statements.getAlertPrefs.get(userId) || null;
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
      
      // Convert boolean values to integers for SQLite
      Object.keys(finalPrefs).forEach(key => {
        if (typeof finalPrefs[key] === 'boolean') {
          finalPrefs[key] = finalPrefs[key] ? 1 : 0;
        }
      });
      
      console.log('Saving preferences:', finalPrefs);
      statements.upsertAlertPrefs.run(finalPrefs);
      return true;
    } catch (error) {
      console.error('Error saving alert preferences:', error);
      console.error('Preferences that failed:', prefs);
      throw error; // Re-throw to get better error info
    }
  },

  // Get all users with active alerts
  async getAllActiveAlertUsers() {
    try {
      return statements.getAllActiveAlerts.all();
    } catch (error) {
      console.error('Error getting active alert users:', error);
      return [];
    }
  },

  // Close the database connection
  close() {
    db.close();
  }
};

module.exports = TradeDB;