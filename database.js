const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { DB_PATH } = require('./database-config');

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
console.log('Database path:', DB_PATH);
console.log('Database directory:', dbDir);

try {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('Created database directory:', dbDir);
  }
  
  // Check if we have write permissions
  fs.accessSync(dbDir, fs.constants.W_OK);
  console.log('Database directory is writable');
} catch (error) {
  console.error('Database directory error:', error);
  console.error('Current working directory:', process.cwd());
  console.error('__dirname:', __dirname);
}

// Create or open the database
let db;
try {
  db = new Database(DB_PATH);
  console.log('Database initialized successfully at:', DB_PATH);
  
  // Test write
  db.prepare('SELECT 1').get();
  console.log('Database connection test passed');
} catch (error) {
  console.error('Failed to initialize database at:', DB_PATH);
  console.error('Error:', error.message);
  
  // If on Render and disk not available, use in-memory database
  if (process.env.RENDER && error.message.includes('ENOENT')) {
    console.log('Falling back to in-memory database (data will not persist)');
    db = new Database(':memory:');
    console.log('In-memory database initialized');
  } else {
    throw error;
  }
}

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
        user_id TEXT NOT NULL DEFAULT 'default',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

  // Create index for faster queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
    CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
    CREATE INDEX IF NOT EXISTS idx_trades_entryDate ON trades(entryDate);
    CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
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

  // Add user_id column if it doesn't exist
  try {
    const testUserQuery = db.prepare('SELECT user_id FROM trades LIMIT 1');
    testUserQuery.get();
  } catch (e) {
    console.log('Adding user_id column to trades table...');
    db.exec(`
      ALTER TABLE trades ADD COLUMN user_id TEXT NOT NULL DEFAULT 'default';
      CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
    `);
    console.log('user_id column added successfully');
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
  getAllTrades: db.prepare('SELECT * FROM trades WHERE user_id = ? ORDER BY entryDate DESC'),
  getAllTradesNoFilter: db.prepare('SELECT * FROM trades ORDER BY entryDate DESC'),
  getActiveTrades: db.prepare('SELECT * FROM trades WHERE status = ? AND user_id = ?'),
  getTradeById: db.prepare('SELECT * FROM trades WHERE id = ? AND user_id = ?'),
  getTradesBySymbol: db.prepare('SELECT * FROM trades WHERE symbol = ? AND user_id = ?'),
  insertTrade: db.prepare(`
    INSERT INTO trades (symbol, entryDate, entryPrice, exitDate, exitPrice, shares, status, profit, percentGain, 
                       entryReason, exitReason, stockIndex, stopLossPrice, targetPrice, squareOffDate, notes, 
                       stockName, investmentAmount, currencySymbol, stopLossPercent, takeProfitPercent, user_id)
    VALUES (@symbol, @entryDate, @entryPrice, @exitDate, @exitPrice, @shares, @status, @profit, @percentGain, 
            @entryReason, @exitReason, @stockIndex, @stopLossPrice, @targetPrice, @squareOffDate, @notes,
            @stockName, @investmentAmount, @currencySymbol, @stopLossPercent, @takeProfitPercent, @user_id)
  `),
  updateTrade: db.prepare(`
    UPDATE trades 
    SET exitDate = @exitDate, exitPrice = @exitPrice, status = @status, 
        profit = @profit, percentGain = @percentGain, exitReason = @exitReason,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = @id AND user_id = @user_id
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
    WHERE id = @id AND user_id = @user_id
  `),
  deleteTrade: db.prepare('DELETE FROM trades WHERE id = ? AND user_id = ?'),
  deleteAllTrades: db.prepare('DELETE FROM trades WHERE user_id = ?'),
  
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
  getAllActiveAlerts: db.prepare('SELECT * FROM alert_preferences WHERE telegram_enabled = 1 OR email_enabled = 1'),
  
  // Admin queries
  getUserStats: db.prepare(`
    SELECT 
      user_id,
      COUNT(*) as total_trades,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_trades,
      SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_trades,
      MIN(created_at) as first_trade_date,
      MAX(created_at) as last_trade_date
    FROM trades
    WHERE user_id != 'default'
    GROUP BY user_id
    ORDER BY total_trades DESC
  `),
  getTotalUsers: db.prepare(`
    SELECT COUNT(DISTINCT user_id) as total_users 
    FROM trades 
    WHERE user_id != 'default'
  `),
  getSystemStats: db.prepare(`
    SELECT 
      COUNT(*) as total_trades,
      COUNT(DISTINCT user_id) as total_users,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_trades,
      SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_trades
    FROM trades
    WHERE user_id != 'default'
  `)
};

// Database operations
const TradeDB = {
  // Get all trades for a user
  async getAllTrades(userId = 'default') {
    try {
      const trades = statements.getAllTrades.all(userId);
      console.log(`Database: getAllTrades returned ${trades.length} trades for user ${userId}`);
      return trades;
    } catch (error) {
      console.error('Database: Error in getAllTrades:', error);
      return [];
    }
  },

  // Get active trades for a user
  async getActiveTrades(userId = 'default') {
    return statements.getActiveTrades.all('active', userId);
  },

  // Get closed trades for a user
  async getClosedTrades(userId = 'default') {
    return statements.getActiveTrades.all('closed', userId);
  },

  // Get trade by ID for a user
  async getTradeById(id, userId = 'default') {
    return statements.getTradeById.get(id, userId);
  },

  // Get trades by symbol for a user
  async getTradesBySymbol(symbol, userId = 'default') {
    return statements.getTradesBySymbol.all(symbol, userId);
  },

  // Insert a new trade for a user
  async insertTrade(trade, userId = 'default') {
    try {
      const tradeWithUser = { ...trade, user_id: userId };
      const info = statements.insertTrade.run(tradeWithUser);
      return { id: info.lastInsertRowid, ...tradeWithUser };
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
        userId,
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
        const info = statements.updateTradeDetails.run({ ...updates, id, user_id: userId });
        console.log('>>> Update result:', { changes: info.changes });
        return info.changes > 0;
      } else {
        console.log('>>> Using simple updateTrade statement');
        // Otherwise use the simpler updateTrade for closing trades
        const info = statements.updateTrade.run({ ...updates, id, user_id: userId });
        console.log('>>> Update result:', { changes: info.changes });
        return info.changes > 0;
      }
    } catch (error) {
      console.error('Error updating trade:', error);
      throw error;
    }
  },

  // Delete a trade for a user
  async deleteTrade(id, userId = 'default') {
    try {
      const info = statements.deleteTrade.run(id, userId);
      return info.changes > 0;
    } catch (error) {
      console.error('Error deleting trade:', error);
      throw error;
    }
  },

  // Delete all trades for a user
  async deleteAllTrades(userId = 'default') {
    try {
      const info = statements.deleteAllTrades.run(userId);
      return info.changes;
    } catch (error) {
      console.error('Error deleting all trades:', error);
      throw error;
    }
  },

  // Bulk insert trades for a user (for migration from localStorage)
  async bulkInsertTrades(trades, userId = 'default') {
    const insertMany = db.transaction((trades) => {
      for (const trade of trades) {
        statements.insertTrade.run({ ...trade, user_id: userId });
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

  // Admin functions
  async getUserStatistics() {
    try {
      return statements.getUserStats.all();
    } catch (error) {
      console.error('Error getting user statistics:', error);
      return [];
    }
  },

  async getSystemStatistics() {
    try {
      return statements.getSystemStats.get() || {
        total_trades: 0,
        total_users: 0,
        active_trades: 0,
        closed_trades: 0
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

  // Close the database connection
  close() {
    db.close();
  }
};

module.exports = TradeDB;