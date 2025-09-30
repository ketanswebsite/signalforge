const { Pool } = require('pg');

// PostgreSQL database connection
let pool = null;
let dbConnected = false;

// Check if DATABASE_URL is provided
if (!process.env.DATABASE_URL) {
} else {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    dbConnected = true;
  } catch (error) {
  }
}

// Initialize database tables
async function initializeDatabase() {
  if (!dbConnected || !pool) {
    return;
  }
  
  try {
    // Create trades table if it doesn't exist (DO NOT DROP EXISTING TABLE!)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trades (
        id BIGSERIAL PRIMARY KEY,
        symbol VARCHAR(50) NOT NULL,
        name VARCHAR(255),
        stock_index VARCHAR(50),
        entry_date TIMESTAMP,
        entry_price DECIMAL(12, 4),
        exit_date TIMESTAMP,
        exit_price DECIMAL(12, 4),
        shares DECIMAL(12, 6),
        quantity DECIMAL(12, 6),
        status VARCHAR(20),
        profit DECIMAL(12, 4),
        profit_loss DECIMAL(12, 4),
        percent_gain DECIMAL(8, 4),
        profit_loss_percentage DECIMAL(8, 4),
        entry_reason TEXT,
        exit_reason TEXT,
        stop_loss_price DECIMAL(12, 4),
        stop_loss DECIMAL(12, 4),
        target_price DECIMAL(12, 4),
        square_off_date TIMESTAMP,
        notes TEXT,
        stock_name VARCHAR(255),
        investment_amount DECIMAL(12, 4),
        position_size DECIMAL(12, 4),
        currency_symbol VARCHAR(10),
        stop_loss_percent DECIMAL(8, 4),
        take_profit_percent DECIMAL(8, 4),
        user_id VARCHAR(255) NOT NULL DEFAULT 'default',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create users table to track all registered users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        google_id VARCHAR(255),
        picture VARCHAR(500),
        telegram_chat_id VARCHAR(100),
        telegram_username VARCHAR(100),
        linking_token VARCHAR(100),
        telegram_linked_at TIMESTAMP,
        first_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add columns if they don't exist (for existing databases)
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(100)`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(100)`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS linking_token VARCHAR(100)`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMP`);
    } catch (err) {
      // Columns might already exist
    }

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

    // Create telegram_subscribers table for broadcast functionality
    await pool.query(`
      CREATE TABLE IF NOT EXISTS telegram_subscribers (
        id SERIAL PRIMARY KEY,
        chat_id VARCHAR(100) UNIQUE NOT NULL,
        user_id VARCHAR(100),
        username VARCHAR(100),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        subscription_type VARCHAR(50) DEFAULT 'all',
        is_active BOOLEAN DEFAULT true,
        subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        referral_source VARCHAR(100)
      )
    `);

    // Create index on user_id for better performance
    await pool.query('CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_telegram_subscribers_chat_id ON telegram_subscribers(chat_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_telegram_subscribers_active ON telegram_subscribers(is_active)');

    // Migrate existing users from trades table
    await migrateExistingUsers();

  } catch (error) {
    throw error;
  }
}

// Helper function to check database connection
function checkConnection() {
  if (!dbConnected || !pool) {
    throw new Error('PostgreSQL not configured. Please set DATABASE_URL environment variable and visit /migrate-to-postgres.html for setup instructions.');
  }
}

// Migration function to populate users table from existing trades
async function migrateExistingUsers() {
  try {
    // Get unique user_ids from trades table
    const result = await pool.query(`
      SELECT DISTINCT user_id, MIN(created_at) as first_trade
      FROM trades 
      WHERE user_id IS NOT NULL 
      GROUP BY user_id
    `);
    
    for (const row of result.rows) {
      const userId = row.user_id === 'default' ? 'ketanjoshisahs@gmail.com' : row.user_id;
      
      // Check if user already exists in users table
      const existingUser = await pool.query('SELECT email FROM users WHERE email = $1', [userId]);
      
      if (existingUser.rows.length === 0) {
        // Insert user with minimal info
        await pool.query(`
          INSERT INTO users (email, name, first_login, last_login)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (email) DO NOTHING
        `, [userId, null, row.first_trade, row.first_trade]);
        
      }
    }
  } catch (error) {
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
        exitDate: row.exit_date,
        exitPrice: row.exit_price ? parseFloat(row.exit_price) : null,
        shares: row.quantity ? parseFloat(row.quantity) : (row.shares ? parseFloat(row.shares) : null),
        status: row.status,
        profitLoss: row.profit_loss ? parseFloat(row.profit_loss) : null,
        percentGain: row.percent_gain ? parseFloat(row.percent_gain) : null,
        profitLossPercentage: row.profit_loss_percentage ? parseFloat(row.profit_loss_percentage) : null,
        entryReason: row.entry_reason,
        exitReason: row.exit_reason,
        stopLossPrice: row.stop_loss_price ? parseFloat(row.stop_loss_price) : null,
        stopLoss: row.stop_loss ? parseFloat(row.stop_loss) : null,
        targetPrice: row.target_price ? parseFloat(row.target_price) : null,
        squareOffDate: row.square_off_date,
        notes: row.notes,
        stockName: row.stock_name,
        investmentAmount: row.investment_amount ? parseFloat(row.investment_amount) : null,
        positionSize: row.position_size ? parseFloat(row.position_size) : null,
        currencySymbol: row.currency_symbol,
        stopLossPercent: row.stop_loss_percent ? parseFloat(row.stop_loss_percent) : null,
        takeProfitPercent: row.take_profit_percent ? parseFloat(row.take_profit_percent) : null,
        user_id: row.user_id,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
    } catch (error) {
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
        exitDate: row.exit_date,
        exitPrice: row.exit_price ? parseFloat(row.exit_price) : null,
        shares: row.quantity ? parseFloat(row.quantity) : (row.shares ? parseFloat(row.shares) : null),
        status: row.status,
        profitLoss: row.profit_loss ? parseFloat(row.profit_loss) : null,
        percentGain: row.percent_gain ? parseFloat(row.percent_gain) : null,
        profitLossPercentage: row.profit_loss_percentage ? parseFloat(row.profit_loss_percentage) : null,
        entryReason: row.entry_reason,
        exitReason: row.exit_reason,
        stopLossPrice: row.stop_loss_price ? parseFloat(row.stop_loss_price) : null,
        stopLoss: row.stop_loss ? parseFloat(row.stop_loss) : null,
        targetPrice: row.target_price ? parseFloat(row.target_price) : null,
        squareOffDate: row.square_off_date,
        notes: row.notes,
        stockName: row.stock_name,
        investmentAmount: row.investment_amount ? parseFloat(row.investment_amount) : null,
        positionSize: row.position_size ? parseFloat(row.position_size) : null,
        currencySymbol: row.currency_symbol,
        stopLossPercent: row.stop_loss_percent ? parseFloat(row.stop_loss_percent) : null,
        takeProfitPercent: row.take_profit_percent ? parseFloat(row.take_profit_percent) : null,
        user_id: row.user_id
      }));
    } catch (error) {
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
        exitDate: row.exit_date,
        exitPrice: row.exit_price ? parseFloat(row.exit_price) : null,
        shares: row.quantity ? parseFloat(row.quantity) : (row.shares ? parseFloat(row.shares) : null),
        status: row.status,
        // Fix: Use consistent field names matching getAllTrades
        profitLoss: row.profit_loss ? parseFloat(row.profit_loss) : null,
        percentGain: row.percent_gain ? parseFloat(row.percent_gain) : null,
        // Fix: Add missing fields
        exitReason: row.exit_reason,
        investmentAmount: row.investment_amount ? parseFloat(row.investment_amount) : null,
        currencySymbol: row.currency_symbol,
        stockName: row.stock_name,
        // Keep these for backward compatibility
        positionSize: row.position_size ? parseFloat(row.position_size) : null,
        stopLoss: row.stop_loss ? parseFloat(row.stop_loss) : null,
        stopLossPrice: row.stop_loss_price ? parseFloat(row.stop_loss_price) : null,
        targetPrice: row.target_price ? parseFloat(row.target_price) : null,
        profitLossPercentage: row.profit_loss_percentage ? parseFloat(row.profit_loss_percentage) : null,
        notes: row.notes,
        user_id: row.user_id,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
    } catch (error) {
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
        shares: row.quantity ? parseFloat(row.quantity) : (row.shares ? parseFloat(row.shares) : null),
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
      return null;
    }
  },

  // Insert a new trade
  async insertTrade(trade, userId = 'default') {
    try {
      const result = await pool.query(
        `INSERT INTO trades (
          symbol, name, stock_index, entry_date, entry_price, exit_date, exit_price,
          shares, quantity, status, profit, profit_loss, percent_gain, profit_loss_percentage,
          entry_reason, exit_reason, stop_loss_price, stop_loss, target_price,
          square_off_date, notes, stock_name, investment_amount, position_size,
          currency_symbol, stop_loss_percent, take_profit_percent, user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28) 
        RETURNING *`,
        [
          trade.symbol,
          trade.name || trade.stockName || null,
          trade.stockIndex || null,
          trade.entryDate,
          trade.entryPrice,
          trade.exitDate || null,
          trade.exitPrice || null,
          trade.shares || null,
          trade.quantity || trade.shares || null,
          trade.status || 'active',
          trade.profit || null,
          trade.profitLoss || trade.profit || null,
          trade.percentGain || null,
          trade.profitLossPercentage || trade.percentGain || null,
          trade.entryReason || null,
          trade.exitReason || null,
          trade.stopLossPrice || null,
          trade.stopLoss || trade.stopLossPrice || null,
          trade.targetPrice || null,
          trade.squareOffDate || null,
          trade.notes || null,
          trade.stockName || null,
          trade.investmentAmount || null,
          trade.positionSize || trade.investmentAmount || null,
          trade.currencySymbol || null,
          trade.stopLossPercent || null,
          trade.takeProfitPercent || null,
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
        exitDate: row.exit_date,
        exitPrice: row.exit_price ? parseFloat(row.exit_price) : null,
        shares: row.quantity ? parseFloat(row.quantity) : (row.shares ? parseFloat(row.shares) : null),
        status: row.status,
        profitLoss: row.profit_loss ? parseFloat(row.profit_loss) : null,
        percentGain: row.percent_gain ? parseFloat(row.percent_gain) : null,
        profitLossPercentage: row.profit_loss_percentage ? parseFloat(row.profit_loss_percentage) : null,
        entryReason: row.entry_reason,
        exitReason: row.exit_reason,
        stopLossPrice: row.stop_loss_price ? parseFloat(row.stop_loss_price) : null,
        stopLoss: row.stop_loss ? parseFloat(row.stop_loss) : null,
        targetPrice: row.target_price ? parseFloat(row.target_price) : null,
        squareOffDate: row.square_off_date,
        notes: row.notes,
        stockName: row.stock_name,
        investmentAmount: row.investment_amount ? parseFloat(row.investment_amount) : null,
        positionSize: row.position_size ? parseFloat(row.position_size) : null,
        currencySymbol: row.currency_symbol,
        stopLossPercent: row.stop_loss_percent ? parseFloat(row.stop_loss_percent) : null,
        takeProfitPercent: row.take_profit_percent ? parseFloat(row.take_profit_percent) : null,
        user_id: row.user_id,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    } catch (error) {
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
        profit: updates.profit,
        profit_loss: updates.profitLoss || updates.profit,
        percent_gain: updates.percentGain,
        profit_loss_percentage: updates.profitLossPercentage || updates.percentGain,
        exit_reason: updates.exitReason,
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
      return null;
    }
  },

  // User management functions
  async saveOrUpdateUser(userData) {
    checkConnection();
    try {
      const { email, name, google_id, picture } = userData;
      
      // Try to insert, on conflict update last_login
      const result = await pool.query(`
        INSERT INTO users (email, name, google_id, picture)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (email) 
        DO UPDATE SET 
          name = EXCLUDED.name,
          picture = EXCLUDED.picture,
          last_login = CURRENT_TIMESTAMP
        RETURNING *
      `, [email, name, google_id, picture]);
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Admin functions
  async getUserStatistics() {
    try {
      // Get all registered users with their trade statistics and subscription info
      const result = await pool.query(`
        SELECT 
          u.email as user_id,
          u.name,
          u.first_login,
          u.last_login,
          COALESCE(t.total_trades, 0) as total_trades,
          COALESCE(t.active_trades, 0) as active_trades,
          COALESCE(t.closed_trades, 0) as closed_trades,
          t.first_trade_date,
          t.last_trade_date,
          s.plan_name as subscription_plan,
          s.status as subscription_status,
          s.trial_start_date,
          s.trial_end_date,
          s.start_date as subscription_start_date,
          s.end_date as subscription_end_date
        FROM users u
        LEFT JOIN (
          SELECT 
            user_id,
            COUNT(*) as total_trades,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_trades,
            COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_trades,
            MIN(created_at) as first_trade_date,
            MAX(created_at) as last_trade_date
          FROM trades
          GROUP BY user_id
        ) t ON u.email = t.user_id
        LEFT JOIN user_subscriptions s ON u.email = s.user_email
        ORDER BY u.last_login DESC
      `);
      
      return result.rows.map(row => ({
        user_id: row.user_id,
        name: row.name,
        total_trades: parseInt(row.total_trades) || 0,
        active_trades: parseInt(row.active_trades) || 0,
        closed_trades: parseInt(row.closed_trades) || 0,
        first_trade_date: row.first_trade_date,
        last_trade_date: row.last_trade_date,
        first_login: row.first_login,
        last_login: row.last_login,
        subscription_plan: row.subscription_plan,
        subscription_status: row.subscription_status,
        trial_start_date: row.trial_start_date,
        trial_end_date: row.trial_end_date,
        subscription_start_date: row.subscription_start_date,
        subscription_end_date: row.subscription_end_date
      }));
    } catch (error) {
      return [];
    }
  },

  async getSystemStatistics() {
    try {
      // Get total registered users from users table
      const usersResult = await pool.query('SELECT COUNT(*) as total_users FROM users');
      
      // Get trade statistics
      const tradesResult = await pool.query(`
        SELECT 
          COUNT(*) as total_trades,
          COUNT(DISTINCT user_id) as users_with_trades,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_trades,
          COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_trades
        FROM trades
      `);
      
      // Get subscription statistics
      let subscriptionStats = {
        total_subscriptions: 0,
        active_subscriptions: 0,
        trial_subscriptions: 0,
        premium_subscriptions: 0
      };
      
      try {
        const subscriptionsResult = await pool.query(`
          SELECT 
            COUNT(*) as total_subscriptions,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_subscriptions,
            COUNT(CASE WHEN status = 'trial' THEN 1 END) as trial_subscriptions,
            COUNT(CASE WHEN plan_name = 'Premium' THEN 1 END) as premium_subscriptions
          FROM user_subscriptions
        `);
        subscriptionStats = {
          total_subscriptions: parseInt(subscriptionsResult.rows[0].total_subscriptions) || 0,
          active_subscriptions: parseInt(subscriptionsResult.rows[0].active_subscriptions) || 0,
          trial_subscriptions: parseInt(subscriptionsResult.rows[0].trial_subscriptions) || 0,
          premium_subscriptions: parseInt(subscriptionsResult.rows[0].premium_subscriptions) || 0
        };
      } catch (e) {
      }
      
      const usersRow = usersResult.rows[0];
      const tradesRow = tradesResult.rows[0];
      return {
        total_trades: parseInt(tradesRow.total_trades),
        total_users: parseInt(usersRow.total_users),
        active_trades: parseInt(tradesRow.active_trades),
        closed_trades: parseInt(tradesRow.closed_trades),
        users_with_trades: parseInt(tradesRow.users_with_trades),
        ...subscriptionStats
      };
    } catch (error) {
      return {
        total_trades: 0,
        total_users: 0,
        active_trades: 0,
        closed_trades: 0,
        total_subscriptions: 0,
        active_subscriptions: 0,
        trial_subscriptions: 0,
        premium_subscriptions: 0
      };
    }
  },

  // Ensure user exists in database (prevents connection pool exhaustion)
  async ensureUserExists(user) {
    if (!dbConnected || !pool || !user || !user.email) return;
    
    try {
      const client = await pool.connect();
      try {
        const existingUser = await client.query('SELECT email FROM users WHERE email = $1', [user.email]);
        
        if (existingUser.rows.length === 0) {
          // User not in database, add them
          
          await client.query(`
            INSERT INTO users (email, name, google_id, picture, first_login, last_login)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (email) DO UPDATE SET 
              name = EXCLUDED.name,
              picture = EXCLUDED.picture,
              last_login = CURRENT_TIMESTAMP
          `, [
            user.email,
            user.name || user.email.split('@')[0],
            user.id || user.google_id || null,
            user.picture || null
          ]);
          
        } else {
          // User exists, update last_login
          await client.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE email = $1', [user.email]);
        }
      } finally {
        client.release(); // Important: release connection back to pool
      }
    } catch (error) {
    }
  },

  // Telegram Subscribers Management
  async addTelegramSubscriber(chatId, userData = {}, subscriptionType = 'all', referralSource = null) {
    checkConnection();
    try {
      const result = await pool.query(`
        INSERT INTO telegram_subscribers 
          (chat_id, user_id, username, first_name, last_name, subscription_type, referral_source)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (chat_id) 
        DO UPDATE SET 
          user_id = EXCLUDED.user_id,
          username = EXCLUDED.username,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          subscription_type = EXCLUDED.subscription_type,
          is_active = true,
          last_activity = CURRENT_TIMESTAMP,
          referral_source = EXCLUDED.referral_source
        RETURNING *
      `, [
        chatId.toString(),
        userData.id?.toString() || null,
        userData.username || null,
        userData.first_name || null,
        userData.last_name || null,
        subscriptionType,
        referralSource
      ]);
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },

  async removeTelegramSubscriber(chatId) {
    checkConnection();
    try {
      const result = await pool.query(`
        UPDATE telegram_subscribers 
        SET is_active = false, last_activity = CURRENT_TIMESTAMP
        WHERE chat_id = $1
        RETURNING *
      `, [chatId.toString()]);
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },

  async getAllActiveSubscribers(subscriptionType = null) {
    checkConnection();
    try {
      let query = `
        SELECT chat_id, username, first_name, subscription_type, subscribed_at
        FROM telegram_subscribers 
        WHERE is_active = true
      `;
      let params = [];
      
      if (subscriptionType) {
        query += ` AND (subscription_type = $1 OR subscription_type = 'all')`;
        params.push(subscriptionType);
      }
      
      query += ` ORDER BY subscribed_at DESC`;
      
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      throw error;
    }
  },

  async getSubscriberStats() {
    checkConnection();
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total_subscribers,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_subscribers,
          COUNT(CASE WHEN subscription_type = 'all' THEN 1 END) as all_subscription,
          COUNT(CASE WHEN subscription_type = 'conviction' THEN 1 END) as conviction_subscription,
          COUNT(CASE WHEN subscription_type = 'scans' THEN 1 END) as scans_subscription
        FROM telegram_subscribers
      `);
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },

  async updateSubscriberActivity(chatId) {
    checkConnection();
    try {
      await pool.query(`
        UPDATE telegram_subscribers
        SET last_activity = CURRENT_TIMESTAMP
        WHERE chat_id = $1 AND is_active = true
      `, [chatId.toString()]);
    } catch (error) {
    }
  },

  // ===== TELEGRAM-OAUTH LINKING FUNCTIONS =====

  // Generate a unique linking token for a user
  async generateLinkingToken(email) {
    checkConnection();
    try {
      const token = require('crypto').randomBytes(16).toString('hex');
      await pool.query(`
        UPDATE users
        SET linking_token = $1
        WHERE email = $2
      `, [token, email]);
      return token;
    } catch (error) {
      throw error;
    }
  },

  // Link Telegram account to OAuth user
  async linkTelegramToUser(token, telegramData) {
    checkConnection();
    try {
      const result = await pool.query(`
        UPDATE users
        SET
          telegram_chat_id = $1,
          telegram_username = $2,
          telegram_linked_at = CURRENT_TIMESTAMP,
          linking_token = NULL
        WHERE linking_token = $3
        RETURNING email, name
      `, [
        telegramData.chatId.toString(),
        telegramData.username,
        token
      ]);

      if (result.rows.length === 0) {
        return { success: false, error: 'Invalid or expired linking token' };
      }

      // Also update telegram_subscribers table with user_id
      await pool.query(`
        UPDATE telegram_subscribers
        SET user_id = $1
        WHERE chat_id = $2
      `, [result.rows[0].email, telegramData.chatId.toString()]);

      return {
        success: true,
        user: result.rows[0]
      };
    } catch (error) {
      throw error;
    }
  },

  // Check if user has Telegram linked
  async getUserTelegramStatus(email) {
    checkConnection();
    try {
      const result = await pool.query(`
        SELECT
          telegram_chat_id,
          telegram_username,
          telegram_linked_at
        FROM users
        WHERE email = $1
      `, [email]);

      if (result.rows.length === 0) {
        return { linked: false };
      }

      const user = result.rows[0];
      return {
        linked: !!user.telegram_chat_id,
        chatId: user.telegram_chat_id,
        username: user.telegram_username,
        linkedAt: user.telegram_linked_at
      };
    } catch (error) {
      throw error;
    }
  },

  // Unlink Telegram from user
  async unlinkTelegram(email) {
    checkConnection();
    try {
      await pool.query(`
        UPDATE users
        SET
          telegram_chat_id = NULL,
          telegram_username = NULL,
          telegram_linked_at = NULL
        WHERE email = $1
      `, [email]);

      return { success: true };
    } catch (error) {
      throw error;
    }
  },

  // Close connection
  async close() {
    await pool.end();
  }
};

// Initialize database on module load
TradeDB.init().catch(() => {});

module.exports = TradeDB;