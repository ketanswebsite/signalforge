const { Pool } = require('pg');

// Database connection with fallback
let pool = null;
let dbConnected = false;

// Check if DATABASE_URL is provided
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  console.error('📝 Please set up PostgreSQL database and add DATABASE_URL');
  console.error('📋 Visit /migrate-to-postgres.html for setup instructions');
} else {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    dbConnected = true;
    console.log('✓ PostgreSQL connection configured');
  } catch (error) {
    console.error('❌ Failed to configure PostgreSQL:', error.message);
  }
}

// Initialize database tables
async function initializeDatabase() {
  if (!dbConnected || !pool) {
    console.log('⚠️ Skipping database initialization - PostgreSQL not configured');
    return;
  }
  
  try {
    // Create trades table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trades (
        id BIGSERIAL PRIMARY KEY,
        symbol VARCHAR(50) NOT NULL,
        name VARCHAR(255),
        stock_index VARCHAR(50),
        entry_date DATE,
        entry_price DECIMAL(10, 2),
        quantity INTEGER,
        position_size DECIMAL(10, 2),
        stop_loss DECIMAL(10, 2),
        target_price DECIMAL(10, 2),
        exit_date DATE,
        exit_price DECIMAL(10, 2),
        status VARCHAR(20),
        profit_loss DECIMAL(10, 2),
        profit_loss_percentage DECIMAL(5, 2),
        notes TEXT,
        user_id VARCHAR(255) NOT NULL DEFAULT 'default',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create alert_preferences table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS alert_preferences (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) UNIQUE NOT NULL,
        telegram_enabled BOOLEAN DEFAULT false,
        telegram_chat_id VARCHAR(100),
        email_enabled BOOLEAN DEFAULT false,
        email_address VARCHAR(255),
        alert_on_buy BOOLEAN DEFAULT true,
        alert_on_sell BOOLEAN DEFAULT true,
        alert_on_target BOOLEAN DEFAULT true,
        alert_on_stoploss BOOLEAN DEFAULT true,
        alert_on_time_exit BOOLEAN DEFAULT true,
        market_open_alert BOOLEAN DEFAULT false,
        market_close_alert BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index on user_id for better performance
    await pool.query('CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol)');

    console.log('✅ PostgreSQL database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Helper function to check database connection
function checkConnection() {
  if (!dbConnected || !pool) {
    throw new Error('PostgreSQL not configured. Please set DATABASE_URL environment variable and visit /migrate-to-postgres.html for setup instructions.');
  }
}

// Database operations
const TradeDB = {
  // Initialize database on module load
  async init() {
    await initializeDatabase();
  },
  
  // Check if database is connected
  isConnected() {
    return dbConnected && pool !== null;
  },

  // Get all trades for a user
  async getAllTrades(userId = 'default') {
    checkConnection();
    try {
      const result = await pool.query(
        'SELECT * FROM trades WHERE user_id = $1 ORDER BY entry_date DESC',
        [userId]
      );
      return result.rows.map(row => ({
        id: row.id,
        symbol: row.symbol,
        name: row.name,
        stockIndex: row.stock_index,
        entryDate: row.entry_date,
        entryPrice: parseFloat(row.entry_price),
        quantity: row.quantity,
        positionSize: parseFloat(row.position_size),
        stopLoss: row.stop_loss ? parseFloat(row.stop_loss) : null,
        targetPrice: row.target_price ? parseFloat(row.target_price) : null,
        exitDate: row.exit_date,
        exitPrice: row.exit_price ? parseFloat(row.exit_price) : null,
        status: row.status,
        profitLoss: row.profit_loss ? parseFloat(row.profit_loss) : null,
        profitLossPercentage: row.profit_loss_percentage ? parseFloat(row.profit_loss_percentage) : null,
        notes: row.notes,
        user_id: row.user_id,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
    } catch (error) {
      console.error('Error getting all trades:', error);
      return [];
    }
  },

  // Get active trades for a user
  async getActiveTrades(userId = 'default') {
    try {
      const result = await pool.query(
        'SELECT * FROM trades WHERE user_id = $1 AND status = $2 ORDER BY entry_date DESC',
        [userId, 'active']
      );
      return result.rows.map(row => ({
        id: row.id,
        symbol: row.symbol,
        name: row.name,
        stockIndex: row.stock_index,
        entryDate: row.entry_date,
        entryPrice: parseFloat(row.entry_price),
        quantity: row.quantity,
        positionSize: parseFloat(row.position_size),
        stopLoss: row.stop_loss ? parseFloat(row.stop_loss) : null,
        targetPrice: row.target_price ? parseFloat(row.target_price) : null,
        status: row.status,
        notes: row.notes,
        user_id: row.user_id
      }));
    } catch (error) {
      console.error('Error getting active trades:', error);
      return [];
    }
  },

  // Get closed trades for a user
  async getClosedTrades(userId = 'default') {
    try {
      const result = await pool.query(
        'SELECT * FROM trades WHERE user_id = $1 AND status = $2 ORDER BY exit_date DESC',
        [userId, 'closed']
      );
      return result.rows.map(row => ({
        id: row.id,
        symbol: row.symbol,
        name: row.name,
        stockIndex: row.stock_index,
        entryDate: row.entry_date,
        entryPrice: parseFloat(row.entry_price),
        quantity: row.quantity,
        positionSize: parseFloat(row.position_size),
        stopLoss: row.stop_loss ? parseFloat(row.stop_loss) : null,
        targetPrice: row.target_price ? parseFloat(row.target_price) : null,
        exitDate: row.exit_date,
        exitPrice: row.exit_price ? parseFloat(row.exit_price) : null,
        status: row.status,
        profitLoss: row.profit_loss ? parseFloat(row.profit_loss) : null,
        profitLossPercentage: row.profit_loss_percentage ? parseFloat(row.profit_loss_percentage) : null,
        notes: row.notes,
        user_id: row.user_id
      }));
    } catch (error) {
      console.error('Error getting closed trades:', error);
      return [];
    }
  },

  // Get trade by ID for a user
  async getTradeById(id, userId = 'default') {
    try {
      const result = await pool.query(
        'SELECT * FROM trades WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      return {
        id: row.id,
        symbol: row.symbol,
        name: row.name,
        stockIndex: row.stock_index,
        entryDate: row.entry_date,
        entryPrice: parseFloat(row.entry_price),
        quantity: row.quantity,
        positionSize: parseFloat(row.position_size),
        stopLoss: row.stop_loss ? parseFloat(row.stop_loss) : null,
        targetPrice: row.target_price ? parseFloat(row.target_price) : null,
        exitDate: row.exit_date,
        exitPrice: row.exit_price ? parseFloat(row.exit_price) : null,
        status: row.status,
        profitLoss: row.profit_loss ? parseFloat(row.profit_loss) : null,
        profitLossPercentage: row.profit_loss_percentage ? parseFloat(row.profit_loss_percentage) : null,
        notes: row.notes,
        user_id: row.user_id
      };
    } catch (error) {
      console.error('Error getting trade by ID:', error);
      return null;
    }
  },

  // Insert a new trade
  async insertTrade(trade, userId = 'default') {
    try {
      const result = await pool.query(
        `INSERT INTO trades (
          symbol, name, stock_index, entry_date, entry_price, 
          quantity, position_size, stop_loss, target_price, 
          exit_date, exit_price, status, profit_loss, profit_loss_percentage,
          notes, user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
        RETURNING *`,
        [
          trade.symbol,
          trade.name || null,
          trade.stockIndex || null,
          trade.entryDate,
          trade.entryPrice,
          trade.quantity || null,
          trade.positionSize || null,
          trade.stopLoss || null,
          trade.targetPrice || null,
          trade.exitDate || null,
          trade.exitPrice || null,
          trade.status || 'active',
          trade.profitLoss || null,
          trade.profitLossPercentage || null,
          trade.notes || null,
          userId
        ]
      );
      
      const row = result.rows[0];
      return {
        id: row.id,
        symbol: row.symbol,
        name: row.name,
        stockIndex: row.stock_index,
        entryDate: row.entry_date,
        entryPrice: parseFloat(row.entry_price),
        quantity: row.quantity,
        positionSize: row.position_size ? parseFloat(row.position_size) : null,
        stopLoss: row.stop_loss ? parseFloat(row.stop_loss) : null,
        targetPrice: row.target_price ? parseFloat(row.target_price) : null,
        exitDate: row.exit_date,
        exitPrice: row.exit_price ? parseFloat(row.exit_price) : null,
        status: row.status,
        profitLoss: row.profit_loss ? parseFloat(row.profit_loss) : null,
        profitLossPercentage: row.profit_loss_percentage ? parseFloat(row.profit_loss_percentage) : null,
        notes: row.notes,
        user_id: row.user_id,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    } catch (error) {
      console.error('Error inserting trade:', error);
      throw error;
    }
  },

  // Update a trade
  async updateTrade(id, updates, userId = 'default') {
    try {
      const setClauses = [];
      const values = [];
      let paramIndex = 1;

      // Build dynamic SET clause
      const fields = {
        symbol: updates.symbol,
        name: updates.name,
        stock_index: updates.stockIndex,
        entry_date: updates.entryDate,
        entry_price: updates.entryPrice,
        quantity: updates.quantity,
        position_size: updates.positionSize,
        stop_loss: updates.stopLoss,
        target_price: updates.targetPrice,
        exit_date: updates.exitDate,
        exit_price: updates.exitPrice,
        status: updates.status,
        profit_loss: updates.profitLoss,
        profit_loss_percentage: updates.profitLossPercentage,
        notes: updates.notes
      };

      for (const [dbField, value] of Object.entries(fields)) {
        if (value !== undefined) {
          setClauses.push(`${dbField} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }

      if (setClauses.length === 0) return true;

      // Add updated_at
      setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

      // Add WHERE clause parameters
      values.push(id, userId);

      const query = `
        UPDATE trades 
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      `;

      const result = await pool.query(query, values);
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error updating trade:', error);
      throw error;
    }
  },

  // Delete a trade
  async deleteTrade(id, userId = 'default') {
    try {
      const result = await pool.query(
        'DELETE FROM trades WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting trade:', error);
      throw error;
    }
  },

  // Delete all trades for a user
  async deleteAllTrades(userId = 'default') {
    try {
      const result = await pool.query(
        'DELETE FROM trades WHERE user_id = $1',
        [userId]
      );
      return result.rowCount;
    } catch (error) {
      console.error('Error deleting all trades:', error);
      throw error;
    }
  },

  // Bulk insert trades
  async bulkInsertTrades(trades, userId = 'default') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      let insertedCount = 0;
      for (const trade of trades) {
        // Map backup fields to PostgreSQL schema (same as in server.js)
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
          notes: trade.notes || trade.entryReason || null
        };
        
        await client.query(
          `INSERT INTO trades (
            symbol, name, stock_index, entry_date, entry_price, 
            quantity, position_size, stop_loss, target_price, 
            exit_date, exit_price, status, profit_loss, profit_loss_percentage,
            notes, user_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
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
            userId
          ]
        );
        insertedCount++;
      }
      
      await client.query('COMMIT');
      return insertedCount;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in bulk insert:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  // Alert preferences methods
  async getAlertPreferences(userId = 'default') {
    try {
      const result = await pool.query(
        'SELECT * FROM alert_preferences WHERE user_id = $1',
        [userId]
      );
      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      return {
        user_id: row.user_id,
        telegram_enabled: row.telegram_enabled,
        telegram_chat_id: row.telegram_chat_id,
        email_enabled: row.email_enabled,
        email_address: row.email_address,
        alert_on_buy: row.alert_on_buy,
        alert_on_sell: row.alert_on_sell,
        alert_on_target: row.alert_on_target,
        alert_on_stoploss: row.alert_on_stoploss,
        alert_on_time_exit: row.alert_on_time_exit,
        market_open_alert: row.market_open_alert,
        market_close_alert: row.market_close_alert
      };
    } catch (error) {
      console.error('Error getting alert preferences:', error);
      return null;
    }
  },

  async saveAlertPreferences(prefs) {
    try {
      const result = await pool.query(
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
          updated_at = CURRENT_TIMESTAMP
        RETURNING *`,
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
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error saving alert preferences:', error);
      throw error;
    }
  },

  async getAllActiveAlertUsers() {
    try {
      const result = await pool.query(
        'SELECT * FROM alert_preferences WHERE telegram_enabled = true OR email_enabled = true'
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting active alert users:', error);
      return [];
    }
  },

  async getUserByEmail(email) {
    try {
      const result = await pool.query(
        'SELECT * FROM alert_preferences WHERE user_id = $1',
        [email]
      );
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return null;
    }
  },

  // Admin functions
  async getUserStatistics() {
    try {
      const result = await pool.query(`
        SELECT 
          user_id,
          COUNT(*) as total_trades,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_trades,
          COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_trades,
          MIN(created_at) as first_trade_date,
          MAX(created_at) as last_trade_date
        FROM trades
        GROUP BY user_id
        ORDER BY total_trades DESC
      `);
      
      return result.rows.map(row => ({
        user_id: row.user_id === 'default' ? 'ketanjoshisahs@gmail.com' : row.user_id,
        total_trades: parseInt(row.total_trades),
        active_trades: parseInt(row.active_trades),
        closed_trades: parseInt(row.closed_trades),
        first_trade_date: row.first_trade_date,
        last_trade_date: row.last_trade_date
      }));
    } catch (error) {
      console.error('Error getting user statistics:', error);
      return [];
    }
  },

  async getSystemStatistics() {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total_trades,
          COUNT(DISTINCT user_id) as total_users,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_trades,
          COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_trades
        FROM trades
      `);
      
      const row = result.rows[0];
      return {
        total_trades: parseInt(row.total_trades),
        total_users: parseInt(row.total_users),
        active_trades: parseInt(row.active_trades),
        closed_trades: parseInt(row.closed_trades)
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

  // Close connection
  async close() {
    await pool.end();
    console.log('PostgreSQL connection closed');
  }
};

// Initialize database on module load
TradeDB.init().catch(console.error);

module.exports = TradeDB;