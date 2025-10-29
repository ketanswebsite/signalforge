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
        status VARCHAR(20),
        profit_loss DECIMAL(12, 4),
        profit_loss_percentage DECIMAL(8, 4),
        entry_reason TEXT,
        exit_reason TEXT,
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

    // Create payment_refunds table for tracking refunded payments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_refunds (
        id SERIAL PRIMARY KEY,
        transaction_id VARCHAR(255) NOT NULL,
        user_email VARCHAR(255) NOT NULL,
        refund_amount DECIMAL(12, 2) NOT NULL,
        currency VARCHAR(10) NOT NULL,
        refund_reason TEXT,
        status VARCHAR(50) DEFAULT 'completed',
        refunded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create high_conviction_portfolio table for tracking high conviction trades
    await pool.query(`
      CREATE TABLE IF NOT EXISTS high_conviction_portfolio (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(50) NOT NULL,
        name VARCHAR(255),
        market VARCHAR(50),
        signal_date DATE NOT NULL,
        entry_date DATE NOT NULL,
        entry_price DECIMAL(12, 4) NOT NULL,
        current_price DECIMAL(12, 4),
        target_price DECIMAL(12, 4) NOT NULL,
        stop_loss_price DECIMAL(12, 4) NOT NULL,
        square_off_date DATE NOT NULL,
        investment_gbp DECIMAL(12, 4),
        investment_inr DECIMAL(12, 4),
        investment_usd DECIMAL(12, 4),
        shares DECIMAL(12, 6),
        currency_symbol VARCHAR(10),
        status VARCHAR(20) DEFAULT 'active',
        exit_date DATE,
        exit_price DECIMAL(12, 4),
        exit_reason VARCHAR(100),
        pl_percent DECIMAL(8, 4),
        pl_amount_gbp DECIMAL(12, 4),
        pl_amount_inr DECIMAL(12, 4),
        pl_amount_usd DECIMAL(12, 4),
        win_rate DECIMAL(8, 4),
        total_backtest_trades INT,
        entry_dti DECIMAL(8, 4),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create pending_signals table for 7 AM signal integration
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pending_signals (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(50) NOT NULL,
        signal_date DATE NOT NULL,
        entry_price DECIMAL(12, 4) NOT NULL,
        target_price DECIMAL(12, 4) NOT NULL,
        stop_loss DECIMAL(12, 4) NOT NULL,
        square_off_date DATE NOT NULL,
        market VARCHAR(50) NOT NULL CHECK(market IN ('India', 'UK', 'US')),
        win_rate DECIMAL(8, 4) NOT NULL CHECK(win_rate >= 0 AND win_rate <= 100),
        historical_signal_count INTEGER NOT NULL CHECK(historical_signal_count >= 0),
        entry_dti DECIMAL(8, 4),
        entry_7day_dti DECIMAL(8, 4),
        prev_dti DECIMAL(8, 4),
        prev_7day_dti DECIMAL(8, 4),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'pending' CHECK(status IN ('pending', 'added', 'dismissed', 'expired')),
        dismissed_at TIMESTAMP,
        added_to_trade_id BIGINT REFERENCES trades(id) ON DELETE SET NULL,
        UNIQUE(symbol, signal_date)
      )
    `);

    // Create portfolio_capital table for capital tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS portfolio_capital (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255),
        market VARCHAR(50) NOT NULL CHECK(market IN ('India', 'UK', 'US')),
        currency VARCHAR(10) NOT NULL CHECK(currency IN ('INR', 'GBP', 'USD')),
        initial_capital DECIMAL(12, 4) NOT NULL CHECK(initial_capital >= 0),
        realized_pl DECIMAL(12, 4) DEFAULT 0,
        allocated_capital DECIMAL(12, 4) DEFAULT 0,
        available_capital DECIMAL(12, 4) DEFAULT 0,
        active_positions INTEGER DEFAULT 0 CHECK(active_positions >= 0),
        max_positions INTEGER DEFAULT 10 CHECK(max_positions > 0),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, market)
      )
    `);

    // Note: Portfolio capital is now initialized per-user during signup
    // See ensureUserInDatabase() in server.js for user capital initialization

    // Create trade_exit_checks table for exit condition tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trade_exit_checks (
        id SERIAL PRIMARY KEY,
        trade_id BIGINT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
        check_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        current_price DECIMAL(12, 4) NOT NULL,
        pl_percent DECIMAL(8, 4) NOT NULL,
        days_held INTEGER NOT NULL,
        target_reached BOOLEAN DEFAULT false,
        stop_loss_hit BOOLEAN DEFAULT false,
        max_days_reached BOOLEAN DEFAULT false,
        dti_exit_triggered BOOLEAN DEFAULT false,
        alert_sent BOOLEAN DEFAULT false,
        alert_type VARCHAR(50)
      )
    `);

    // Create user_settings table for user preferences (Phase 6)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL DEFAULT 'default',
        setting_key VARCHAR(100) NOT NULL,
        setting_value TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, setting_key)
      )
    `);

    // Initialize default settings for default user
    await pool.query(`
      INSERT INTO user_settings (user_id, setting_key, setting_value) VALUES
      ('default', 'default_stop_loss_percent', '5'),
      ('default', 'default_target_percent', '8'),
      ('default', 'max_positions_total', '30'),
      ('default', 'max_positions_per_market', '10'),
      ('default', 'telegram_alerts_enabled', 'true'),
      ('default', 'telegram_alert_types', 'target,stoploss,manual,conviction'),
      ('default', 'auto_add_signals', 'false'),
      ('default', 'min_dti_threshold', '-40'),
      ('default', 'initial_capital_india', '500000'),
      ('default', 'initial_capital_uk', '4000'),
      ('default', 'initial_capital_us', '5000')
      ON CONFLICT (user_id, setting_key) DO NOTHING
    `);

    // Add new columns to trades table for signal tracking
    try {
      await pool.query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS win_rate DECIMAL(8, 4)`);
      await pool.query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS historical_signal_count INTEGER`);
      await pool.query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS signal_date DATE`);
      await pool.query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS market VARCHAR(50) CHECK(market IN ('India', 'UK', 'US'))`);
      await pool.query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS auto_added BOOLEAN DEFAULT false`);
      await pool.query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS trade_size DECIMAL(12, 4)`);
      await pool.query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS prev_dti DECIMAL(8, 4)`);
      await pool.query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS entry_dti DECIMAL(8, 4)`);
      await pool.query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS prev_7day_dti DECIMAL(8, 4)`);
      await pool.query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS entry_7day_dti DECIMAL(8, 4)`);
    } catch (err) {
      // Columns might already exist
    }

    // Create index on user_id for better performance
    await pool.query('CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_trades_signal_date ON trades(signal_date)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_telegram_subscribers_chat_id ON telegram_subscribers(chat_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_telegram_subscribers_active ON telegram_subscribers(is_active)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_high_conviction_symbol ON high_conviction_portfolio(symbol)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_high_conviction_status ON high_conviction_portfolio(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_high_conviction_signal_date ON high_conviction_portfolio(signal_date)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_pending_signals_status ON pending_signals(status)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_pending_signals_date ON pending_signals(signal_date DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_pending_signals_symbol ON pending_signals(symbol)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_portfolio_capital_market ON portfolio_capital(market)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_exit_checks_trade ON trade_exit_checks(trade_id, check_time DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_settings_user_key ON user_settings(user_id, setting_key)');

    // Migrate existing users from trades table
    await migrateExistingUsers();

    // Migrate trades to primary user (one-time migration)
    await migrateTradesToPrimaryUser();

    // Backfill signal data to existing trades (one-time migration)
    await backfillSignalDataToTrades();

    // Fix portfolio capital duplicates (one-time migration)
    await fixPortfolioCapitalDuplicates();

    // Sync active_positions count with actual trades (one-time migration)
    await syncActivePositions();

    // Populate investment_amount for existing trades (one-time migration)
    await populateInvestmentAmount();

    // Backfill allocated capital for existing trades (one-time migration)
    await backfillAllocatedCapital();

    // Recalculate allocated capital after investment amounts are populated (one-time migration)
    await recalculateAllocatedCapital();

    // Backfill historical realized P/L from closed trades (one-time migration)
    await backfillHistoricalRealizedPL();

    // Reactivate user's Telegram subscription (one-time migration)
    await reactivateTelegramSubscription();

    // Add unified audit log columns if they don't exist (for admin portal compatibility)
    try {
      await pool.query(`ALTER TABLE trade_audit_log ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50) DEFAULT 'trade'`);
      await pool.query(`ALTER TABLE trade_audit_log ADD COLUMN IF NOT EXISTS entity_id VARCHAR(255)`);
      await pool.query(`ALTER TABLE trade_audit_log ADD COLUMN IF NOT EXISTS changes JSONB`);

      // Populate entity_id from trade_id for existing records
      await pool.query(`UPDATE trade_audit_log SET entity_id = trade_id::VARCHAR WHERE entity_id IS NULL`);

      // Create indexes for new columns
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_trade_audit_entity_type ON trade_audit_log(entity_type)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_trade_audit_entity_id ON trade_audit_log(entity_id)`);
    } catch (err) {
      // Table might not exist yet or columns already added - this is OK
    }

    // Create schema_migrations table for tracking applied migrations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Mark migrations 008 and 009 as applied (they were run through database initialization)
    await pool.query(`
      INSERT INTO schema_migrations (filename, applied_at)
      VALUES
        ('008_create_admin_activity_log.sql', NOW()),
        ('009_add_unified_audit_columns.sql', NOW())
      ON CONFLICT (filename) DO NOTHING
    `);

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

// Migration function to update trades from wrong user to primary user
async function migrateTradesToPrimaryUser() {
  try {
    // Check if this migration has already been applied
    const migrationCheck = await pool.query(`
      SELECT filename FROM schema_migrations WHERE filename = '010_migrate_trades_to_primary_user.sql'
    `);

    if (migrationCheck.rows.length > 0) {
      // Migration already applied, skip
      return;
    }

    // Update all trades from deepak.joshi2898@gmail.com to ketanjoshisahs@gmail.com
    const result = await pool.query(`
      UPDATE trades
      SET user_id = 'ketanjoshisahs@gmail.com'
      WHERE user_id = 'deepak.joshi2898@gmail.com'
      RETURNING id
    `);

    const migratedCount = result.rowCount;

    if (migratedCount > 0) {
      console.log(`✅ Migrated ${migratedCount} trades to primary user (ketanjoshisahs@gmail.com)`);
    }

    // Mark migration as applied
    await pool.query(`
      INSERT INTO schema_migrations (filename, applied_at)
      VALUES ('010_migrate_trades_to_primary_user.sql', NOW())
      ON CONFLICT (filename) DO NOTHING
    `);

  } catch (error) {
    // Silent fail - migration might not be needed
  }
}

// Migration function to backfill signal data to existing trades
async function backfillSignalDataToTrades() {
  try {
    // Check if this migration has already been applied
    const migrationCheck = await pool.query(`
      SELECT filename FROM schema_migrations WHERE filename = '011_backfill_signal_data_to_trades.sql'
    `);

    if (migrationCheck.rows.length > 0) {
      // Migration already applied, skip
      return;
    }

    // Update existing trades with signal data from pending_signals
    const result = await pool.query(`
      UPDATE trades t
      SET
        win_rate = ps.win_rate,
        historical_signal_count = ps.historical_signal_count,
        signal_date = ps.signal_date,
        market = ps.market,
        auto_added = true,
        entry_dti = ps.entry_dti,
        entry_7day_dti = ps.entry_7day_dti,
        prev_dti = ps.prev_dti,
        prev_7day_dti = ps.prev_7day_dti
      FROM pending_signals ps
      WHERE ps.added_to_trade_id = t.id
        AND t.win_rate IS NULL
      RETURNING t.id
    `);

    const backfilledCount = result.rowCount;

    if (backfilledCount > 0) {
      console.log(`✅ Backfilled signal data for ${backfilledCount} trades`);
    }

    // Mark migration as applied
    await pool.query(`
      INSERT INTO schema_migrations (filename, applied_at)
      VALUES ('011_backfill_signal_data_to_trades.sql', NOW())
      ON CONFLICT (filename) DO NOTHING
    `);

  } catch (error) {
    // Silent fail - migration might not be needed
  }
}

// Migration function to fix portfolio capital duplicates
async function fixPortfolioCapitalDuplicates() {
  try {
    // Check if this migration has already been applied
    const migrationCheck = await pool.query(`
      SELECT filename FROM schema_migrations WHERE filename = '012_fix_portfolio_capital_duplicates.sql'
    `);

    if (migrationCheck.rows.length > 0) {
      // Migration already applied, skip
      return;
    }

    // Get the current state for each market (use the row with most recent activity)
    await pool.query(`
      CREATE TEMP TABLE IF NOT EXISTS portfolio_capital_latest AS
      SELECT DISTINCT ON (market)
        market,
        currency,
        initial_capital,
        realized_pl,
        allocated_capital,
        available_capital,
        active_positions,
        max_positions
      FROM portfolio_capital
      WHERE user_id IS NULL
      ORDER BY market, active_positions DESC, allocated_capital DESC, id DESC
    `);

    // Delete ALL existing rows with NULL user_id
    const deleteResult = await pool.query(`DELETE FROM portfolio_capital WHERE user_id IS NULL`);
    const deletedCount = deleteResult.rowCount;

    // Insert the cleaned data using 'system' as the user_id
    await pool.query(`
      INSERT INTO portfolio_capital (user_id, market, currency, initial_capital, realized_pl, allocated_capital, available_capital, active_positions, max_positions)
      SELECT
        'system' as user_id,
        market,
        currency,
        initial_capital,
        realized_pl,
        allocated_capital,
        available_capital,
        active_positions,
        max_positions
      FROM portfolio_capital_latest
    `);

    console.log(`✅ Fixed portfolio_capital duplicates (removed ${deletedCount} duplicate rows, kept 3)`);

    // Mark migration as applied
    await pool.query(`
      INSERT INTO schema_migrations (filename, applied_at)
      VALUES ('012_fix_portfolio_capital_duplicates.sql', NOW())
      ON CONFLICT (filename) DO NOTHING
    `);

  } catch (error) {
    // Silent fail - migration might not be needed
    console.error('Portfolio capital duplicate fix warning:', error.message);
  }
}

// Migration function to sync active_positions count with actual trades
async function syncActivePositions() {
  try {
    // Check if this migration has already been applied
    const migrationCheck = await pool.query(`
      SELECT filename FROM schema_migrations WHERE filename = '013_sync_active_positions.sql'
    `);

    if (migrationCheck.rows.length > 0) {
      // Migration already applied, skip
      return;
    }

    // Update India market (.NS stocks)
    const indiaResult = await pool.query(`
      UPDATE portfolio_capital
      SET active_positions = (
        SELECT COUNT(*)
        FROM trades
        WHERE status = 'active'
        AND symbol LIKE '%.NS'
        AND user_id = 'ketanjoshisahs@gmail.com'
      )
      WHERE user_id = 'system' AND market = 'India'
      RETURNING active_positions
    `);

    // Update UK market (.L stocks)
    const ukResult = await pool.query(`
      UPDATE portfolio_capital
      SET active_positions = (
        SELECT COUNT(*)
        FROM trades
        WHERE status = 'active'
        AND symbol LIKE '%.L'
        AND user_id = 'ketanjoshisahs@gmail.com'
      )
      WHERE user_id = 'system' AND market = 'UK'
      RETURNING active_positions
    `);

    // Update US market (no suffix)
    const usResult = await pool.query(`
      UPDATE portfolio_capital
      SET active_positions = (
        SELECT COUNT(*)
        FROM trades
        WHERE status = 'active'
        AND symbol NOT LIKE '%.NS'
        AND symbol NOT LIKE '%.L'
        AND user_id = 'ketanjoshisahs@gmail.com'
      )
      WHERE user_id = 'system' AND market = 'US'
      RETURNING active_positions
    `);

    const indiaCount = indiaResult.rows[0]?.active_positions || 0;
    const ukCount = ukResult.rows[0]?.active_positions || 0;
    const usCount = usResult.rows[0]?.active_positions || 0;

    console.log(`✅ Synced active_positions: India=${indiaCount}, UK=${ukCount}, US=${usCount}`);

    // Mark migration as applied
    await pool.query(`
      INSERT INTO schema_migrations (filename, applied_at)
      VALUES ('013_sync_active_positions.sql', NOW())
      ON CONFLICT (filename) DO NOTHING
    `);

  } catch (error) {
    // Silent fail - migration might not be needed
    console.error('Active positions sync warning:', error.message);
  }
}

// Migration function to populate investment_amount for existing trades
async function populateInvestmentAmount() {
  try {
    // Check if this migration has already been applied
    const migrationCheck = await pool.query(`
      SELECT filename FROM schema_migrations WHERE filename = '015_populate_investment_amount.sql'
    `);

    if (migrationCheck.rows.length > 0) {
      // Migration already applied, skip
      return;
    }

    // Standard trade sizes per market (from capital-manager.js)
    const tradeSizes = {
      India: 50000,   // ₹50,000 per trade
      UK: 400,        // £400 per trade
      US: 500         // $500 per trade
    };

    // Update India market trades (.NS stocks)
    const indiaResult = await pool.query(`
      UPDATE trades
      SET
        investment_amount = $1,
        trade_size = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE status = 'active'
      AND symbol LIKE '%.NS'
      AND user_id = 'ketanjoshisahs@gmail.com'
      AND investment_amount IS NULL
      RETURNING id
    `, [tradeSizes.India]);

    // Update UK market trades (.L stocks)
    const ukResult = await pool.query(`
      UPDATE trades
      SET
        investment_amount = $1,
        trade_size = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE status = 'active'
      AND symbol LIKE '%.L'
      AND user_id = 'ketanjoshisahs@gmail.com'
      AND investment_amount IS NULL
      RETURNING id
    `, [tradeSizes.UK]);

    // Update US market trades (no suffix)
    const usResult = await pool.query(`
      UPDATE trades
      SET
        investment_amount = $1,
        trade_size = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE status = 'active'
      AND symbol NOT LIKE '%.NS'
      AND symbol NOT LIKE '%.L'
      AND user_id = 'ketanjoshisahs@gmail.com'
      AND investment_amount IS NULL
      RETURNING id
    `, [tradeSizes.US]);

    const indiaCount = indiaResult.rowCount || 0;
    const ukCount = ukResult.rowCount || 0;
    const usCount = usResult.rowCount || 0;

    console.log(`✅ Populated investment_amount: India=${indiaCount} trades (₹50K each), UK=${ukCount} trades (£400 each), US=${usCount} trades ($500 each)`);

    // Mark migration as applied
    await pool.query(`
      INSERT INTO schema_migrations (filename, applied_at)
      VALUES ('015_populate_investment_amount.sql', NOW())
      ON CONFLICT (filename) DO NOTHING
    `);

  } catch (error) {
    // Silent fail - migration might not be needed
    console.error('Investment amount population warning:', error.message);
  }
}

// Migration function to backfill allocated capital for existing trades
async function backfillAllocatedCapital() {
  try {
    // Check if this migration has already been applied
    const migrationCheck = await pool.query(`
      SELECT filename FROM schema_migrations WHERE filename = '014_backfill_allocated_capital.sql'
    `);

    if (migrationCheck.rows.length > 0) {
      // Migration already applied, skip
      return;
    }

    // Update each market separately
    const markets = [
      { name: 'India', symbol_pattern: '%.NS' },
      { name: 'UK', symbol_pattern: '%.L' },
      { name: 'US', not_patterns: ['%.NS', '%.L'] }
    ];

    for (const market of markets) {
      let query;
      if (market.name === 'US') {
        query = `
          UPDATE portfolio_capital
          SET
            allocated_capital = COALESCE((
              SELECT SUM(investment_amount)
              FROM trades
              WHERE status = 'active'
              AND symbol NOT LIKE '%.NS'
              AND symbol NOT LIKE '%.L'
              AND user_id = 'ketanjoshisahs@gmail.com'
              AND investment_amount IS NOT NULL
            ), 0),
            available_capital = initial_capital + realized_pl - COALESCE((
              SELECT SUM(investment_amount)
              FROM trades
              WHERE status = 'active'
              AND symbol NOT LIKE '%.NS'
              AND symbol NOT LIKE '%.L'
              AND user_id = 'ketanjoshisahs@gmail.com'
              AND investment_amount IS NOT NULL
            ), 0),
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = 'system' AND market = 'US'
          RETURNING allocated_capital, available_capital
        `;
      } else {
        query = `
          UPDATE portfolio_capital
          SET
            allocated_capital = COALESCE((
              SELECT SUM(investment_amount)
              FROM trades
              WHERE status = 'active'
              AND symbol LIKE '${market.symbol_pattern}'
              AND user_id = 'ketanjoshisahs@gmail.com'
              AND investment_amount IS NOT NULL
            ), 0),
            available_capital = initial_capital + realized_pl - COALESCE((
              SELECT SUM(investment_amount)
              FROM trades
              WHERE status = 'active'
              AND symbol LIKE '${market.symbol_pattern}'
              AND user_id = 'ketanjoshisahs@gmail.com'
              AND investment_amount IS NOT NULL
            ), 0),
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = 'system' AND market = '${market.name}'
          RETURNING allocated_capital, available_capital
        `;
      }

      await pool.query(query);
    }

    // Get final values for logging
    const result = await pool.query(`
      SELECT market, allocated_capital, available_capital
      FROM portfolio_capital
      WHERE user_id = 'system'
      ORDER BY market
    `);

    const logData = result.rows.map(r => `${r.market}: Allocated=${r.allocated_capital}, Available=${r.available_capital}`).join(', ');
    console.log(`✅ Backfilled allocated capital: ${logData}`);

    // Mark migration as applied
    await pool.query(`
      INSERT INTO schema_migrations (filename, applied_at)
      VALUES ('014_backfill_allocated_capital.sql', NOW())
      ON CONFLICT (filename) DO NOTHING
    `);

  } catch (error) {
    // Silent fail - migration might not be needed
    console.error('Allocated capital backfill warning:', error.message);
  }
}

// Migration function to recalculate allocated capital after investment_amount is populated
async function recalculateAllocatedCapital() {
  try {
    // Check if this migration has already been applied
    const migrationCheck = await pool.query(`
      SELECT filename FROM schema_migrations WHERE filename = '016_recalculate_allocated_capital.sql'
    `);

    if (migrationCheck.rows.length > 0) {
      // Migration already applied, skip
      return;
    }

    // Update each market separately
    const markets = [
      { name: 'India', symbol_pattern: '%.NS' },
      { name: 'UK', symbol_pattern: '%.L' },
      { name: 'US', not_patterns: ['%.NS', '%.L'] }
    ];

    for (const market of markets) {
      let query;
      if (market.name === 'US') {
        query = `
          UPDATE portfolio_capital
          SET
            allocated_capital = COALESCE((
              SELECT SUM(investment_amount)
              FROM trades
              WHERE status = 'active'
              AND symbol NOT LIKE '%.NS'
              AND symbol NOT LIKE '%.L'
              AND user_id = 'ketanjoshisahs@gmail.com'
              AND investment_amount IS NOT NULL
            ), 0),
            available_capital = initial_capital + realized_pl - COALESCE((
              SELECT SUM(investment_amount)
              FROM trades
              WHERE status = 'active'
              AND symbol NOT LIKE '%.NS'
              AND symbol NOT LIKE '%.L'
              AND user_id = 'ketanjoshisahs@gmail.com'
              AND investment_amount IS NOT NULL
            ), 0),
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = 'system' AND market = 'US'
          RETURNING allocated_capital, available_capital
        `;
      } else {
        query = `
          UPDATE portfolio_capital
          SET
            allocated_capital = COALESCE((
              SELECT SUM(investment_amount)
              FROM trades
              WHERE status = 'active'
              AND symbol LIKE '${market.symbol_pattern}'
              AND user_id = 'ketanjoshisahs@gmail.com'
              AND investment_amount IS NOT NULL
            ), 0),
            available_capital = initial_capital + realized_pl - COALESCE((
              SELECT SUM(investment_amount)
              FROM trades
              WHERE status = 'active'
              AND symbol LIKE '${market.symbol_pattern}'
              AND user_id = 'ketanjoshisahs@gmail.com'
              AND investment_amount IS NOT NULL
            ), 0),
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = 'system' AND market = '${market.name}'
          RETURNING allocated_capital, available_capital
        `;
      }

      await pool.query(query);
    }

    // Get final values for logging
    const result = await pool.query(`
      SELECT market, allocated_capital, available_capital
      FROM portfolio_capital
      WHERE user_id = 'system'
      ORDER BY market
    `);

    const logData = result.rows.map(r => `${r.market}: Allocated=${r.allocated_capital}, Available=${r.available_capital}`).join(', ');
    console.log(`✅ Recalculated allocated capital: ${logData}`);

    // Mark migration as applied
    await pool.query(`
      INSERT INTO schema_migrations (filename, applied_at)
      VALUES ('016_recalculate_allocated_capital.sql', NOW())
      ON CONFLICT (filename) DO NOTHING
    `);

  } catch (error) {
    // Silent fail - migration might not be needed
    console.error('Allocated capital recalculation warning:', error.message);
  }
}

// Migration function to backfill historical realized P/L from closed trades
async function backfillHistoricalRealizedPL() {
  try {
    // Check if this migration has already been applied
    const migrationCheck = await pool.query(`
      SELECT filename FROM schema_migrations WHERE filename = '018_backfill_historical_realized_pl.sql'
    `);

    if (migrationCheck.rows.length > 0) {
      // Migration already applied, skip
      return;
    }

    // Update US Market (stocks without .NS or .L suffix)
    const usResult = await pool.query(`
      UPDATE portfolio_capital
      SET realized_pl = (
          SELECT COALESCE(SUM(profit_loss), 0)
          FROM trades
          WHERE status = 'closed'
            AND user_id = 'ketanjoshisahs@gmail.com'
            AND symbol NOT LIKE '%.NS'
            AND symbol NOT LIKE '%.L'
            AND profit_loss IS NOT NULL
      ),
      available_capital = initial_capital + (
          SELECT COALESCE(SUM(profit_loss), 0)
          FROM trades
          WHERE status = 'closed'
            AND user_id = 'ketanjoshisahs@gmail.com'
            AND symbol NOT LIKE '%.NS'
            AND symbol NOT LIKE '%.L'
            AND profit_loss IS NOT NULL
      ) - allocated_capital,
      updated_at = CURRENT_TIMESTAMP
      WHERE user_id = 'system' AND market = 'US'
      RETURNING realized_pl, available_capital
    `);

    // Update India Market (.NS suffix stocks)
    const indiaResult = await pool.query(`
      UPDATE portfolio_capital
      SET realized_pl = (
          SELECT COALESCE(SUM(profit_loss), 0)
          FROM trades
          WHERE status = 'closed'
            AND user_id = 'ketanjoshisahs@gmail.com'
            AND symbol LIKE '%.NS'
            AND profit_loss IS NOT NULL
      ),
      available_capital = initial_capital + (
          SELECT COALESCE(SUM(profit_loss), 0)
          FROM trades
          WHERE status = 'closed'
            AND user_id = 'ketanjoshisahs@gmail.com'
            AND symbol LIKE '%.NS'
            AND profit_loss IS NOT NULL
      ) - allocated_capital,
      updated_at = CURRENT_TIMESTAMP
      WHERE user_id = 'system' AND market = 'India'
      RETURNING realized_pl, available_capital
    `);

    // Update UK Market (.L suffix stocks)
    const ukResult = await pool.query(`
      UPDATE portfolio_capital
      SET realized_pl = (
          SELECT COALESCE(SUM(profit_loss), 0)
          FROM trades
          WHERE status = 'closed'
            AND user_id = 'ketanjoshisahs@gmail.com'
            AND symbol LIKE '%.L'
            AND profit_loss IS NOT NULL
      ),
      available_capital = initial_capital + (
          SELECT COALESCE(SUM(profit_loss), 0)
          FROM trades
          WHERE status = 'closed'
            AND user_id = 'ketanjoshisahs@gmail.com'
            AND symbol LIKE '%.L'
            AND profit_loss IS NOT NULL
      ) - allocated_capital,
      updated_at = CURRENT_TIMESTAMP
      WHERE user_id = 'system' AND market = 'UK'
      RETURNING realized_pl, available_capital
    `);

    const usData = usResult.rows[0] || {};
    const indiaData = indiaResult.rows[0] || {};
    const ukData = ukResult.rows[0] || {};

    console.log(`✅ Backfilled historical realized P/L: US=$${usData.realized_pl || 0} (Available: $${usData.available_capital || 0}), India=₹${indiaData.realized_pl || 0} (Available: ₹${indiaData.available_capital || 0}), UK=£${ukData.realized_pl || 0} (Available: £${ukData.available_capital || 0})`);

    // Mark migration as applied
    await pool.query(`
      INSERT INTO schema_migrations (filename, applied_at)
      VALUES ('018_backfill_historical_realized_pl.sql', NOW())
      ON CONFLICT (filename) DO NOTHING
    `);

  } catch (error) {
    // Silent fail - migration might not be needed
    console.error('Historical realized P/L backfill warning:', error.message);
  }
}

// Migration function to reactivate user's Telegram subscription
async function reactivateTelegramSubscription() {
  try {
    // Check if this migration has already been applied
    const migrationCheck = await pool.query(`
      SELECT filename FROM schema_migrations WHERE filename = '019_reactivate_user_telegram_subscription.sql'
    `);

    if (migrationCheck.rows.length > 0) {
      // Migration already applied, skip
      return;
    }

    // Reactivate user's Telegram subscription
    const result = await pool.query(`
      UPDATE telegram_subscribers
      SET is_active = true
      WHERE chat_id = '6168209389'
      RETURNING chat_id, is_active
    `);

    if (result.rows.length > 0) {
      console.log(`✅ Reactivated Telegram subscription for chat_id: ${result.rows[0].chat_id}`);
    }

    // Mark migration as applied
    await pool.query(`
      INSERT INTO schema_migrations (filename, applied_at)
      VALUES ('019_reactivate_user_telegram_subscription.sql', NOW())
      ON CONFLICT (filename) DO NOTHING
    `);

  } catch (error) {
    // Silent fail - migration might not be needed
    console.error('Telegram subscription reactivation warning:', error.message);
  }
}

// Auto-migration: Migrate 'system' capital to primary user (one-time)
async function migrateSystemCapitalToUser() {
  if (!dbConnected || !pool) return;

  try {
    // Check if migration already applied
    const migrationCheck = await pool.query(`
      SELECT * FROM schema_migrations
      WHERE filename = '020_migrate_system_capital_to_user.sql'
    `);

    if (migrationCheck.rows.length > 0) {
      console.log('✅ Capital migration already applied');
      return;
    }

    console.log('🔄 Running auto-migration: Migrating system capital to primary user...');

    // Check if 'system' capital exists
    const systemCapital = await pool.query(`
      SELECT COUNT(*) as count FROM portfolio_capital WHERE user_id = 'system'
    `);

    if (systemCapital.rows[0].count === '0') {
      console.log('⏭️  No system capital found - skipping migration');
      // Mark as applied anyway
      await pool.query(`
        INSERT INTO schema_migrations (filename, applied_at)
        VALUES ('020_migrate_system_capital_to_user.sql', NOW())
      `);
      return;
    }

    // Migrate 'system' to primary user
    await pool.query(`
      UPDATE portfolio_capital
      SET user_id = 'ketanjoshisahs@gmail.com'
      WHERE user_id = 'system'
    `);

    console.log('✅ Migrated system capital to ketanjoshisahs@gmail.com');

    // Add NOT NULL constraint
    try {
      await pool.query(`
        ALTER TABLE portfolio_capital ALTER COLUMN user_id SET NOT NULL
      `);
      console.log('✅ Added NOT NULL constraint to user_id');
    } catch (err) {
      // Constraint might already exist
      console.log('ℹ️  NOT NULL constraint may already exist');
    }

    // Mark migration as applied
    await pool.query(`
      INSERT INTO schema_migrations (filename, applied_at)
      VALUES ('020_migrate_system_capital_to_user.sql', NOW())
    `);

    console.log('✅ Capital migration complete!');

  } catch (error) {
    console.error('❌ Capital migration error:', error.message);
    // Don't throw - let server continue starting
  }
}

// Auto-backfill: Initialize capital for existing users who don't have it (one-time)
async function backfillExistingUsersCapital() {
  if (!dbConnected || !pool) return;

  try {
    // Check if migration already applied
    const migrationCheck = await pool.query(`
      SELECT * FROM schema_migrations
      WHERE filename = '021_backfill_existing_users_capital.sql'
    `);

    if (migrationCheck.rows.length > 0) {
      console.log('✅ Capital backfill already applied');
      return;
    }

    console.log('🔄 Running auto-migration: Backfilling capital for existing users...');

    // Find users without capital
    const usersWithoutCapital = await pool.query(`
      SELECT u.email
      FROM users u
      LEFT JOIN portfolio_capital pc ON u.email = pc.user_id
      WHERE pc.user_id IS NULL
      GROUP BY u.email
    `);

    if (usersWithoutCapital.rows.length === 0) {
      console.log('⏭️  All users already have capital - skipping backfill');
      // Mark as applied anyway
      await pool.query(`
        INSERT INTO schema_migrations (filename, applied_at)
        VALUES ('021_backfill_existing_users_capital.sql', NOW())
      `);
      return;
    }

    console.log(`📝 Found ${usersWithoutCapital.rows.length} users without capital`);

    // Initialize capital for each user
    for (const user of usersWithoutCapital.rows) {
      await pool.query(`
        INSERT INTO portfolio_capital (user_id, market, currency, initial_capital, available_capital)
        VALUES
          ($1, 'India', 'INR', 1000000, 1000000),
          ($1, 'UK', 'GBP', 10000, 10000),
          ($1, 'US', 'USD', 15000, 15000)
      `, [user.email]);
      console.log(`  ✅ Initialized capital for ${user.email}`);
    }

    console.log(`✅ Backfilled capital for ${usersWithoutCapital.rows.length} users`);

    // Mark migration as applied
    await pool.query(`
      INSERT INTO schema_migrations (filename, applied_at)
      VALUES ('021_backfill_existing_users_capital.sql', NOW())
    `);

    console.log('✅ Capital backfill complete!');

  } catch (error) {
    console.error('❌ Capital backfill error:', error.message);
    // Don't throw - let server continue starting
  }
}

// Migration function to dismiss old pending signals from October 28
async function dismissOldPendingSignals() {
  if (!dbConnected || !pool) return;

  try {
    // Check if migration already applied
    const migrationCheck = await pool.query(`
      SELECT * FROM schema_migrations
      WHERE filename = '022_dismiss_old_pending_signals_oct28.sql'
    `);

    if (migrationCheck.rows.length > 0) {
      return;
    }

    console.log('🧹 Running auto-migration: Dismissing old pending signals from October 28...');

    // Check if there are any pending signals from Oct 28
    const pendingSignals = await pool.query(`
      SELECT COUNT(*) as count FROM pending_signals
      WHERE signal_date = '2025-10-28'
        AND status = 'pending'
    `);

    if (pendingSignals.rows[0].count === '0') {
      console.log('⏭️  No old pending signals found - skipping dismissal');
      // Mark as applied anyway
      await pool.query(`
        INSERT INTO schema_migrations (filename, applied_at)
        VALUES ('022_dismiss_old_pending_signals_oct28.sql', NOW())
      `);
      return;
    }

    // Dismiss all pending signals from Oct 28
    const result = await pool.query(`
      UPDATE pending_signals
      SET status = 'dismissed',
          dismissed_at = NOW()
      WHERE signal_date = '2025-10-28'
        AND status = 'pending'
      RETURNING id, symbol, market
    `);

    console.log(`✅ Dismissed ${result.rows.length} old pending signals from October 28:`);
    result.rows.forEach(s => {
      console.log(`   • ID ${s.id}: ${s.symbol} (${s.market})`);
    });

    // Mark migration as applied
    await pool.query(`
      INSERT INTO schema_migrations (filename, applied_at)
      VALUES ('022_dismiss_old_pending_signals_oct28.sql', NOW())
    `);

    console.log('✅ Old signals dismissal complete!');

  } catch (error) {
    console.error('❌ Old signals dismissal error:', error.message);
    // Don't throw - let server continue starting
  }
}

// Database operations
const TradeDB = {
  // Initialize database on module load
  async init() {
    await initializeDatabase();
    await migrateSystemCapitalToUser();  // Auto-migrate on startup
    await backfillExistingUsersCapital(); // Backfill capital for existing users
    await dismissOldPendingSignals(); // Dismiss old pending signals from Oct 28
  },
  
  // Check if database is connected
  isConnected() {
    return dbConnected && pool !== null;
  },

  // Expose pool for direct queries (used by admin routes)
  get pool() {
    return pool;
  },

  /**
   * FIELD NAME TRANSFORMATION LAYER DOCUMENTATION
   * =============================================
   *
   * This module implements a dual naming convention:
   * - Database: snake_case (PostgreSQL convention)
   * - JavaScript/API: camelCase (JavaScript convention)
   *
   * All query functions automatically transform between conventions:
   *
   * DB → JS TRANSFORMATIONS (Query Results):
   * ----------------------------------------
   * entry_price → entryPrice
   * exit_price → exitPrice
   * entry_date → entryDate
   * exit_date → exitDate
   * profit_loss → profitLoss
   * profit_loss_percentage → profitLossPercentage
   * stop_loss_percent → stopLossPercent
   * take_profit_percent → takeProfitPercent
   * stock_index → stockIndex
   * stock_name → stockName
   * investment_amount → investmentAmount
   * position_size → positionSize
   * current_market_price → currentMarketPrice
   * unrealized_pl → unrealizedPL
   * unrealized_pl_percentage → unrealizedPLPercentage
   * win_rate → winRate
   * historical_signal_count → historicalSignalCount
   * signal_date → signalDate
   * auto_added → autoAdded
   * trade_size → tradeSize
   * prev_dti → prevDTI
   * entry_dti → entryDTI
   * prev_7day_dti → prev7DayDTI
   * entry_7day_dti → entry7DayDTI
   *
   * FIELDS KEPT AS snake_case:
   * --------------------------
   * user_id (consistent backend usage)
   * created_at (backend metadata)
   * updated_at (backend metadata)
   *
   * JS → DB TRANSFORMATIONS (Updates/Inserts):
   * ------------------------------------------
   * Same mappings in reverse (camelCase → snake_case)
   *
   * IMPORTANT NOTES:
   * ---------------
   * 1. All code should use camelCase when working with trade objects from these functions
   * 2. Direct SQL queries must use snake_case column names
   * 3. Admin panel queries should use this transformation layer for consistency
   * 4. When debugging field name issues, check both conventions in this mapping
   *
   * @see updateTrade - For JS → DB transformation example
   * @see getAllTrades - For DB → JS transformation example
   */

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
        shares: row.shares ? parseFloat(row.shares) : null,
        status: row.status,
        profitLoss: row.profit_loss ? parseFloat(row.profit_loss) : null,
        profitLossPercentage: row.profit_loss_percentage ? parseFloat(row.profit_loss_percentage) : null,
        entryReason: row.entry_reason,
        exitReason: row.exit_reason,
        stopLossPrice: row.entry_price && row.stop_loss_percent ? (row.entry_price * (1 - row.stop_loss_percent / 100)) : null,
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
        updated_at: row.updated_at,
        winRate: row.win_rate ? parseFloat(row.win_rate) : null,
        historicalSignalCount: row.historical_signal_count ? parseInt(row.historical_signal_count) : null,
        signalDate: row.signal_date,
        market: row.market,
        autoAdded: row.auto_added,
        tradeSize: row.trade_size ? parseFloat(row.trade_size) : null,
        prevDTI: row.prev_dti ? parseFloat(row.prev_dti) : null,
        entryDTI: row.entry_dti ? parseFloat(row.entry_dti) : null,
        prev7DayDTI: row.prev_7day_dti ? parseFloat(row.prev_7day_dti) : null,
        entry7DayDTI: row.entry_7day_dti ? parseFloat(row.entry_7day_dti) : null,
        // Missing field transformations added for standardization
        currentMarketPrice: row.current_market_price ? parseFloat(row.current_market_price) : null,
        unrealizedPL: row.unrealized_pl ? parseFloat(row.unrealized_pl) : null,
        unrealizedPLPercentage: row.unrealized_pl_percentage ? parseFloat(row.unrealized_pl_percentage) : null
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
        shares: row.shares ? parseFloat(row.shares) : null,
        status: row.status,
        profitLoss: row.profit_loss ? parseFloat(row.profit_loss) : null,
        profitLossPercentage: row.profit_loss_percentage ? parseFloat(row.profit_loss_percentage) : null,
        entryReason: row.entry_reason,
        exitReason: row.exit_reason,
        stopLossPrice: row.entry_price && row.stop_loss_percent ? (row.entry_price * (1 - row.stop_loss_percent / 100)) : null,
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
        winRate: row.win_rate ? parseFloat(row.win_rate) : null,
        historicalSignalCount: row.historical_signal_count ? parseInt(row.historical_signal_count) : null,
        signalDate: row.signal_date,
        market: row.market,
        autoAdded: row.auto_added,
        tradeSize: row.trade_size ? parseFloat(row.trade_size) : null,
        prevDTI: row.prev_dti ? parseFloat(row.prev_dti) : null,
        entryDTI: row.entry_dti ? parseFloat(row.entry_dti) : null,
        prev7DayDTI: row.prev_7day_dti ? parseFloat(row.prev_7day_dti) : null,
        entry7DayDTI: row.entry_7day_dti ? parseFloat(row.entry_7day_dti) : null,
        // Missing field transformations added for standardization
        currentMarketPrice: row.current_market_price ? parseFloat(row.current_market_price) : null,
        unrealizedPL: row.unrealized_pl ? parseFloat(row.unrealized_pl) : null,
        unrealizedPLPercentage: row.unrealized_pl_percentage ? parseFloat(row.unrealized_pl_percentage) : null
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
        shares: row.shares ? parseFloat(row.shares) : null,
        status: row.status,
        profitLoss: row.profit_loss ? parseFloat(row.profit_loss) : null,
        profitLossPercentage: row.profit_loss_percentage ? parseFloat(row.profit_loss_percentage) : null,
        exitReason: row.exit_reason,
        investmentAmount: row.investment_amount ? parseFloat(row.investment_amount) : null,
        currencySymbol: row.currency_symbol,
        stockName: row.stock_name,
        positionSize: row.position_size ? parseFloat(row.position_size) : null,
        stopLossPrice: row.entry_price && row.stop_loss_percent ? (row.entry_price * (1 - row.stop_loss_percent / 100)) : null,
        targetPrice: row.target_price ? parseFloat(row.target_price) : null,
        notes: row.notes,
        stopLossPercent: row.stop_loss_percent ? parseFloat(row.stop_loss_percent) : null,
        takeProfitPercent: row.take_profit_percent ? parseFloat(row.take_profit_percent) : null,
        user_id: row.user_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        winRate: row.win_rate ? parseFloat(row.win_rate) : null,
        historicalSignalCount: row.historical_signal_count ? parseInt(row.historical_signal_count) : null,
        signalDate: row.signal_date,
        market: row.market,
        autoAdded: row.auto_added,
        tradeSize: row.trade_size ? parseFloat(row.trade_size) : null,
        prevDTI: row.prev_dti ? parseFloat(row.prev_dti) : null,
        entryDTI: row.entry_dti ? parseFloat(row.entry_dti) : null,
        prev7DayDTI: row.prev_7day_dti ? parseFloat(row.prev_7day_dti) : null,
        entry7DayDTI: row.entry_7day_dti ? parseFloat(row.entry_7day_dti) : null,
        // Missing field transformations added for standardization
        currentMarketPrice: row.current_market_price ? parseFloat(row.current_market_price) : null,
        unrealizedPL: row.unrealized_pl ? parseFloat(row.unrealized_pl) : null,
        unrealizedPLPercentage: row.unrealized_pl_percentage ? parseFloat(row.unrealized_pl_percentage) : null
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
        shares: row.shares ? parseFloat(row.shares) : null,
        positionSize: parseFloat(row.position_size),
        stopLossPrice: row.entry_price && row.stop_loss_percent ? (row.entry_price * (1 - row.stop_loss_percent / 100)) : null,
        stopLossPercent: row.stop_loss_percent ? parseFloat(row.stop_loss_percent) : null,
        targetPrice: row.target_price ? parseFloat(row.target_price) : null,
        exitDate: row.exit_date,
        exitPrice: row.exit_price ? parseFloat(row.exit_price) : null,
        status: row.status,
        profitLoss: row.profit_loss ? parseFloat(row.profit_loss) : null,
        profitLossPercentage: row.profit_loss_percentage ? parseFloat(row.profit_loss_percentage) : null,
        notes: row.notes,
        user_id: row.user_id,
        // Missing field transformations added for standardization
        currentMarketPrice: row.current_market_price ? parseFloat(row.current_market_price) : null,
        unrealizedPL: row.unrealized_pl ? parseFloat(row.unrealized_pl) : null,
        unrealizedPLPercentage: row.unrealized_pl_percentage ? parseFloat(row.unrealized_pl_percentage) : null
      };
    } catch (error) {
      return null;
    }
  },

  // Insert a new trade
  async insertTrade(trade, userId = 'default') {
    try {
      // Auto-calculate shares if not provided but we have tradeSize and entryPrice
      if (!trade.shares && trade.tradeSize && trade.entryPrice && trade.entryPrice > 0) {
        trade.shares = trade.tradeSize / trade.entryPrice;
        console.log(`[DB] Auto-calculated shares for ${trade.symbol}: ${trade.shares.toFixed(2)} shares (${trade.tradeSize} / ${trade.entryPrice})`);
      }

      // Auto-populate investmentAmount from tradeSize if not provided
      if (!trade.investmentAmount && trade.tradeSize) {
        trade.investmentAmount = trade.tradeSize;
      }

      const result = await pool.query(
        `INSERT INTO trades (
          symbol, name, stock_index, entry_date, entry_price, exit_date, exit_price,
          shares, status, profit_loss, profit_loss_percentage,
          entry_reason, exit_reason, target_price,
          square_off_date, notes, stock_name, investment_amount, position_size,
          currency_symbol, stop_loss_percent, take_profit_percent, user_id,
          win_rate, historical_signal_count, signal_date, market, auto_added, trade_size,
          prev_dti, entry_dti, prev_7day_dti, entry_7day_dti
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
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
          trade.status || 'active',
          trade.profitLoss || null,
          trade.profitLossPercentage || null,
          trade.entryReason || null,
          trade.exitReason || null,
          trade.targetPrice || null,
          trade.squareOffDate || null,
          trade.notes || null,
          trade.stockName || null,
          trade.investmentAmount || null,
          trade.positionSize || trade.investmentAmount || null,
          trade.currencySymbol || null,
          trade.stopLossPercent || null,
          trade.takeProfitPercent || null,
          userId,
          trade.winRate || null,
          trade.historicalSignalCount || null,
          trade.signalDate || null,
          trade.market || null,
          trade.autoAdded !== undefined ? trade.autoAdded : null,
          trade.tradeSize || null,
          trade.prevDTI || null,
          trade.entryDTI || null,
          trade.prev7DayDTI || null,
          trade.entry7DayDTI || null
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
        shares: row.shares ? parseFloat(row.shares) : null,
        status: row.status,
        profitLoss: row.profit_loss ? parseFloat(row.profit_loss) : null,
        profitLossPercentage: row.profit_loss_percentage ? parseFloat(row.profit_loss_percentage) : null,
        entryReason: row.entry_reason,
        exitReason: row.exit_reason,
        stopLossPrice: row.entry_price && row.stop_loss_percent ? (row.entry_price * (1 - row.stop_loss_percent / 100)) : null,
        stopLossPercent: row.stop_loss_percent ? parseFloat(row.stop_loss_percent) : null,
        targetPrice: row.target_price ? parseFloat(row.target_price) : null,
        squareOffDate: row.square_off_date,
        notes: row.notes,
        stockName: row.stock_name,
        investmentAmount: row.investment_amount ? parseFloat(row.investment_amount) : null,
        positionSize: row.position_size ? parseFloat(row.position_size) : null,
        currencySymbol: row.currency_symbol,
        takeProfitPercent: row.take_profit_percent ? parseFloat(row.take_profit_percent) : null,
        user_id: row.user_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        winRate: row.win_rate ? parseFloat(row.win_rate) : null,
        historicalSignalCount: row.historical_signal_count ? parseInt(row.historical_signal_count) : null,
        signalDate: row.signal_date,
        market: row.market,
        autoAdded: row.auto_added,
        tradeSize: row.trade_size ? parseFloat(row.trade_size) : null,
        prevDTI: row.prev_dti ? parseFloat(row.prev_dti) : null,
        entryDTI: row.entry_dti ? parseFloat(row.entry_dti) : null,
        prev7DayDTI: row.prev_7day_dti ? parseFloat(row.prev_7day_dti) : null,
        entry7DayDTI: row.entry_7day_dti ? parseFloat(row.entry_7day_dti) : null
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
        shares: updates.shares,
        position_size: updates.positionSize,
        stop_loss_percent: updates.stopLossPercent,
        target_price: updates.targetPrice,
        exit_date: updates.exitDate,
        exit_price: updates.exitPrice,
        status: updates.status,
        profit_loss: updates.profitLoss,
        profit_loss_percentage: updates.profitLossPercentage,
        exit_reason: updates.exitReason,
        notes: updates.notes,
        // Missing field transformations added for standardization
        current_market_price: updates.currentMarketPrice,
        unrealized_pl: updates.unrealizedPL,
        unrealized_pl_percentage: updates.unrealizedPLPercentage
      };

      for (const [dbField, value] of Object.entries(fields)) {
        if (value !== undefined) {
          setClauses.push(`${dbField} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }

      if (setClauses.length === 0) return null;

      // Add updated_at
      setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

      // Add WHERE clause parameters
      values.push(id, userId);

      const query = `
        UPDATE trades
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
        RETURNING *
      `;

      const result = await pool.query(query, values);

      // Return the updated row if successful, null if no rows updated
      if (result.rowCount > 0) {
        return result.rows[0];
      }

      console.warn(`[DB] updateTrade failed: No trade found with id=${id} and user_id=${userId}`);
      return null;
    } catch (error) {
      console.error(`[DB] updateTrade error:`, error);
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
          shares: trade.shares || null,
          positionSize: trade.investmentAmount || trade.positionSize || null,
          stopLossPercent: trade.stopLossPercent || null,
          targetPrice: trade.targetPrice || null,
          exitDate: trade.exitDate || trade.squareOffDate || null,
          exitPrice: trade.exitPrice || null,
          status: trade.status || 'active',
          profitLoss: trade.profitLoss || null,
          profitLossPercentage: trade.profitLossPercentage || null,
          notes: trade.notes || trade.entryReason || null
        };

        await client.query(
          `INSERT INTO trades (
            symbol, name, stock_index, entry_date, entry_price,
            shares, position_size, stop_loss_percent, target_price,
            exit_date, exit_price, status, profit_loss, profit_loss_percentage,
            notes, user_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
          [
            mappedTrade.symbol,
            mappedTrade.name,
            mappedTrade.stockIndex,
            mappedTrade.entryDate,
            mappedTrade.entryPrice,
            mappedTrade.shares,
            mappedTrade.positionSize,
            mappedTrade.stopLossPercent,
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

          // Initialize capital for new user with standard amounts
          console.log(`Initializing capital for new user: ${user.email}`);
          await this.updatePortfolioCapital('India', 'INR', 1000000, user.email);
          await this.updatePortfolioCapital('UK', 'GBP', 10000, user.email);
          await this.updatePortfolioCapital('US', 'USD', 15000, user.email);
          console.log(`Capital initialized successfully for ${user.email}`);

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
        SELECT chat_id, username, first_name, last_name, subscription_type, subscribed_at, last_activity
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

  // Manual linking by admin (directly link chat_id to email)
  async manualLinkTelegramToUser(email, chatId) {
    checkConnection();
    try {
      // Get Telegram subscriber info
      const telegramResult = await pool.query(`
        SELECT username, first_name, last_name
        FROM telegram_subscribers
        WHERE chat_id = $1 AND is_active = true
      `, [chatId.toString()]);

      if (telegramResult.rows.length === 0) {
        return { success: false, error: 'Telegram user not found or not subscribed' };
      }

      const telegramUser = telegramResult.rows[0];

      // Update OAuth user with Telegram info
      const userResult = await pool.query(`
        UPDATE users
        SET
          telegram_chat_id = $1,
          telegram_username = $2,
          telegram_linked_at = CURRENT_TIMESTAMP
        WHERE email = $3
        RETURNING email, name
      `, [
        chatId.toString(),
        telegramUser.username,
        email
      ]);

      if (userResult.rows.length === 0) {
        return { success: false, error: 'OAuth user not found' };
      }

      // Update telegram_subscribers table with user_id
      await pool.query(`
        UPDATE telegram_subscribers
        SET user_id = $1
        WHERE chat_id = $2
      `, [email, chatId.toString()]);

      return {
        success: true,
        user: userResult.rows[0],
        telegram: telegramUser
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
      // Get the chat_id before unlinking
      const userResult = await pool.query(`
        SELECT telegram_chat_id FROM users WHERE email = $1
      `, [email]);

      if (userResult.rows.length > 0 && userResult.rows[0].telegram_chat_id) {
        const chatId = userResult.rows[0].telegram_chat_id;

        // Clear user_id in telegram_subscribers table
        await pool.query(`
          UPDATE telegram_subscribers
          SET user_id = NULL
          WHERE chat_id = $1
        `, [chatId]);
      }

      // Clear Telegram info from users table
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

  // ===== HIGH CONVICTION PORTFOLIO MANAGEMENT =====

  // Add high conviction trade to portfolio
  async addHighConvictionTrade(tradeData) {
    checkConnection();
    try {
      const result = await pool.query(`
        INSERT INTO high_conviction_portfolio (
          symbol, name, market, signal_date, entry_date, entry_price,
          current_price, target_price, stop_loss_price, square_off_date,
          investment_gbp, investment_inr, investment_usd, shares,
          currency_symbol, win_rate, total_backtest_trades, entry_dti
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *
      `, [
        tradeData.symbol,
        tradeData.name,
        tradeData.market,
        tradeData.signalDate,
        tradeData.entryDate,
        tradeData.entryPrice,
        tradeData.currentPrice || tradeData.entryPrice,
        tradeData.targetPrice,
        tradeData.stopLossPrice,
        tradeData.squareOffDate,
        tradeData.investmentGBP,
        tradeData.investmentINR,
        tradeData.investmentUSD,
        tradeData.shares,
        tradeData.currencySymbol,
        tradeData.winRate,
        tradeData.totalBacktestTrades,
        tradeData.entryDTI
      ]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Get all active high conviction trades
  async getActiveHighConvictionTrades() {
    checkConnection();
    try {
      const result = await pool.query(`
        SELECT * FROM high_conviction_portfolio
        WHERE status = 'active'
        ORDER BY signal_date DESC
      `);
      return result.rows;
    } catch (error) {
      throw error;
    }
  },

  // Get all high conviction trades (active and closed)
  async getAllHighConvictionTrades(startDate = null, endDate = null) {
    checkConnection();
    try {
      let query = `
        SELECT * FROM high_conviction_portfolio
        WHERE 1=1
      `;
      const params = [];

      if (startDate) {
        params.push(startDate);
        query += ` AND signal_date >= $${params.length}`;
      }

      if (endDate) {
        params.push(endDate);
        query += ` AND signal_date <= $${params.length}`;
      }

      query += ` ORDER BY signal_date DESC`;

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      throw error;
    }
  },

  // Update high conviction trade (daily price update)
  async updateHighConvictionTrade(symbol, updateData) {
    checkConnection();
    try {
      const result = await pool.query(`
        UPDATE high_conviction_portfolio
        SET
          current_price = $1,
          pl_percent = $2,
          pl_amount_gbp = $3,
          pl_amount_inr = $4,
          pl_amount_usd = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE symbol = $6 AND status = 'active'
        RETURNING *
      `, [
        updateData.currentPrice,
        updateData.plPercent,
        updateData.plAmountGBP,
        updateData.plAmountINR,
        updateData.plAmountUSD,
        symbol
      ]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Close high conviction trade
  async closeHighConvictionTrade(symbol, exitData) {
    checkConnection();
    try {
      const result = await pool.query(`
        UPDATE high_conviction_portfolio
        SET
          status = 'closed',
          exit_date = $1,
          exit_price = $2,
          exit_reason = $3,
          pl_percent = $4,
          pl_amount_gbp = $5,
          pl_amount_inr = $6,
          pl_amount_usd = $7,
          current_price = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE symbol = $8 AND status = 'active'
        RETURNING *
      `, [
        exitData.exitDate,
        exitData.exitPrice,
        exitData.exitReason,
        exitData.plPercent,
        exitData.plAmountGBP,
        exitData.plAmountINR,
        exitData.plAmountUSD,
        symbol
      ]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Get high conviction P&L summary
  async getHighConvictionPLSummary(startDate = null, endDate = null) {
    checkConnection();
    try {
      let query = `
        SELECT
          COUNT(*) FILTER (WHERE status = 'active') as active_trades,
          COUNT(*) FILTER (WHERE status = 'closed') as closed_trades,
          SUM(pl_amount_gbp) FILTER (WHERE status = 'closed') as total_pl_gbp,
          SUM(pl_amount_inr) FILTER (WHERE status = 'closed') as total_pl_inr,
          SUM(pl_amount_usd) FILTER (WHERE status = 'closed') as total_pl_usd,
          SUM(pl_amount_gbp) FILTER (WHERE status = 'active') as open_pl_gbp,
          SUM(pl_amount_inr) FILTER (WHERE status = 'active') as open_pl_inr,
          SUM(pl_amount_usd) FILTER (WHERE status = 'active') as open_pl_usd,
          AVG(pl_percent) FILTER (WHERE status = 'closed') as avg_return_percent,
          COUNT(*) FILTER (WHERE status = 'closed' AND pl_percent > 0) as winning_trades,
          COUNT(*) FILTER (WHERE status = 'closed' AND pl_percent < 0) as losing_trades
        FROM high_conviction_portfolio
        WHERE 1=1
      `;
      const params = [];

      if (startDate) {
        params.push(startDate);
        query += ` AND signal_date >= $${params.length}`;
      }

      if (endDate) {
        params.push(endDate);
        query += ` AND signal_date <= $${params.length}`;
      }

      const result = await pool.query(query, params);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Check if trade already exists (avoid duplicates)
  async highConvictionTradeExists(symbol, signalDate) {
    checkConnection();
    try {
      const result = await pool.query(`
        SELECT id FROM high_conviction_portfolio
        WHERE symbol = $1 AND signal_date = $2
      `, [symbol, signalDate]);
      return result.rows.length > 0;
    } catch (error) {
      return false;
    }
  },

  // ===== TRADING SIGNALS INTEGRATION FUNCTIONS =====

  // Store a pending signal
  async storePendingSignal(signal) {
    checkConnection();
    try {
      // Check if signal already exists for this symbol and date
      const existingSignal = await pool.query(`
        SELECT * FROM pending_signals
        WHERE symbol = $1 AND signal_date = $2
        LIMIT 1
      `, [signal.symbol, signal.signalDate]);

      if (existingSignal.rows.length > 0) {
        console.log(`[DB] Duplicate signal prevented: ${signal.symbol} for ${signal.signalDate} already exists`);
        return existingSignal.rows[0];
      }

      // Insert new signal if no duplicate found
      const result = await pool.query(`
        INSERT INTO pending_signals
        (symbol, signal_date, entry_price, target_price, stop_loss,
         square_off_date, market, win_rate, historical_signal_count,
         entry_dti, entry_7day_dti, prev_dti, prev_7day_dti)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        signal.symbol,
        signal.signalDate,
        signal.entryPrice,
        signal.targetPrice,
        signal.stopLoss,
        signal.squareOffDate,
        signal.market,
        signal.winRate,
        signal.historicalSignalCount,
        signal.entryDTI || null,
        signal.entry7DayDTI || null,
        signal.prevDTI || null,
        signal.prev7DayDTI || null
      ]);
      console.log(`[DB] New pending signal stored: ${signal.symbol} for ${signal.signalDate}`);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Check if signal already exists
  async getPendingSignal(symbol, signalDate) {
    checkConnection();
    try {
      const result = await pool.query(`
        SELECT * FROM pending_signals
        WHERE symbol = $1 AND signal_date = $2
      `, [symbol, signalDate]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      return null;
    }
  },

  // Get all pending signals
  async getPendingSignals(status = 'pending', market = null) {
    checkConnection();
    try {
      let query = `
        SELECT * FROM pending_signals
        WHERE status = $1
      `;
      const params = [status];

      if (market) {
        query += ' AND market = $2';
        params.push(market);
      }

      query += ' ORDER BY signal_date DESC, win_rate DESC';

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      return [];
    }
  },

  // Update signal status
  async updateSignalStatus(signalId, status, tradeId = null) {
    checkConnection();
    try {
      const result = await pool.query(`
        UPDATE pending_signals
        SET status = $1,
            dismissed_at = CASE WHEN $2 = 'dismissed' THEN CURRENT_TIMESTAMP ELSE dismissed_at END,
            added_to_trade_id = COALESCE($3, added_to_trade_id)
        WHERE id = $4
        RETURNING *
      `, [status, status, tradeId, signalId]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      throw error;
    }
  },

  // Get portfolio capital
  async getPortfolioCapital(market = null, userId = null) {
    checkConnection();
    try {
      // userId is required for per-user capital isolation
      if (!userId) {
        throw new Error('userId is required for getPortfolioCapital');
      }

      let query = 'SELECT * FROM portfolio_capital WHERE user_id = $1';
      const params = [userId];

      if (market) {
        query += ' AND market = $2';
        params.push(market);
      }

      const result = await pool.query(query, params);

      // Format as object keyed by market
      const capital = {};
      for (const row of result.rows) {
        capital[row.market] = {
          currency: row.currency,
          initial: parseFloat(row.initial_capital),
          realized: parseFloat(row.realized_pl),
          allocated: parseFloat(row.allocated_capital),
          available: parseFloat(row.available_capital),
          positions: parseInt(row.active_positions),
          maxPositions: parseInt(row.max_positions)
        };
      }

      return capital;
    } catch (error) {
      return {};
    }
  },

  // Update portfolio capital
  async updatePortfolioCapital(market, currency, initialCapital, userId = null) {
    checkConnection();
    try {
      // userId is required for per-user capital isolation
      if (!userId) {
        throw new Error('userId is required for updatePortfolioCapital');
      }

      const result = await pool.query(`
        INSERT INTO portfolio_capital (user_id, market, currency, initial_capital, available_capital)
        VALUES ($1, $2, $3, $4, $4)
        ON CONFLICT (user_id, market) DO UPDATE SET
          initial_capital = $4,
          available_capital = portfolio_capital.initial_capital + portfolio_capital.realized_pl - portfolio_capital.allocated_capital,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [userId, market, currency, initialCapital]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Allocate capital for new trade
  async allocateCapital(market, amount, userId = null) {
    checkConnection();
    try {
      // userId is required for per-user capital isolation
      if (!userId) {
        throw new Error('userId is required for allocateCapital');
      }

      const result = await pool.query(`
        UPDATE portfolio_capital
        SET allocated_capital = allocated_capital + $1,
            available_capital = initial_capital + realized_pl - (allocated_capital + $1),
            active_positions = active_positions + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE market = $2 AND user_id = $3
        RETURNING *
      `, [amount, market, userId]);
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  },

  // Release capital when trade closes
  async releaseCapital(market, allocatedAmount, plAmount, userId = null) {
    checkConnection();
    try {
      // userId is required for per-user capital isolation
      if (!userId) {
        throw new Error('userId is required for releaseCapital');
      }

      const result = await pool.query(`
        UPDATE portfolio_capital
        SET allocated_capital = allocated_capital - $1,
            realized_pl = realized_pl + $2,
            available_capital = initial_capital + (realized_pl + $2) - (allocated_capital - $1),
            active_positions = active_positions - 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE market = $3 AND user_id = $4
        RETURNING *
      `, [allocatedAmount, plAmount, market, userId]);
      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  },

  // Check if can add position
  async canAddPosition(market, requiredCapital, userId = null) {
    checkConnection();
    try {
      // userId is required for per-user capital isolation
      if (!userId) {
        throw new Error('userId is required for canAddPosition');
      }

      const capital = await this.getPortfolioCapital(market, userId);
      const marketCap = capital[market];

      if (!marketCap) {
        return { canAdd: false, reason: 'Market not found' };
      }

      // Check position limit for market
      if (marketCap.positions >= marketCap.maxPositions) {
        return {
          canAdd: false,
          reason: `Market limit reached (${marketCap.positions}/${marketCap.maxPositions})`
        };
      }

      // Check total position limit
      const totalPositions = Object.values(capital).reduce((sum, m) => sum + m.positions, 0);
      if (totalPositions >= 30) {
        return {
          canAdd: false,
          reason: `Total portfolio limit reached (${totalPositions}/30)`
        };
      }

      // Check capital availability
      if (marketCap.available < requiredCapital) {
        return {
          canAdd: false,
          reason: `Insufficient capital (need ${requiredCapital}, have ${marketCap.available})`
        };
      }

      return { canAdd: true };
    } catch (error) {
      return { canAdd: false, reason: error.message };
    }
  },

  // Get active trade by symbol
  async getActiveTradeBySymbol(symbol, userId = 'default') {
    checkConnection();
    try {
      const result = await pool.query(`
        SELECT * FROM trades
        WHERE symbol = $1 AND user_id = $2 AND status = 'active'
        LIMIT 1
      `, [symbol, userId]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      return null;
    }
  },

  // Store exit check
  async storeExitCheck(checkData) {
    checkConnection();
    try {
      const result = await pool.query(`
        INSERT INTO trade_exit_checks
        (trade_id, current_price, pl_percent, days_held, target_reached,
         stop_loss_hit, max_days_reached, dti_exit_triggered, alert_sent, alert_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        checkData.tradeId,
        checkData.currentPrice,
        checkData.plPercent,
        checkData.daysHeld,
        checkData.targetReached || false,
        checkData.stopLossHit || false,
        checkData.maxDaysReached || false,
        checkData.dtiExitTriggered || false,
        checkData.alertSent || false,
        checkData.alertType || null
      ]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Close trade (wrapper around updateTrade)
  async closeTrade(tradeId, exitData, userId = 'default') {
    checkConnection();
    try {
      console.log(`[DB] Attempting to close trade: id=${tradeId}, user_id=${userId}, exitPrice=${exitData.exitPrice}, reason=${exitData.exitReason}`);

      const result = await this.updateTrade(tradeId, {
        exitDate: exitData.exitDate,
        exitPrice: exitData.exitPrice,
        profitLossPercentage: exitData.profitLossPercent,
        exitReason: exitData.exitReason,
        status: 'closed'
      }, userId);

      if (result) {
        console.log(`[DB] ✅ Trade closed successfully: id=${tradeId}, symbol=${result.symbol}, status=${result.status}`);
      } else {
        console.error(`[DB] ❌ Failed to close trade: id=${tradeId}, user_id=${userId} - No matching row found`);
      }

      return result;
    } catch (error) {
      console.error(`[DB] ❌ Error closing trade id=${tradeId}:`, error);
      throw error;
    }
  },

  // ===== USER SETTINGS FUNCTIONS (Phase 6) =====

  // Get a single user setting
  async getUserSetting(userId, settingKey) {
    checkConnection();
    try {
      const result = await pool.query(`
        SELECT setting_value FROM user_settings
        WHERE user_id = $1 AND setting_key = $2
      `, [userId, settingKey]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      return null;
    }
  },

  // Get all user settings
  async getAllUserSettings(userId) {
    checkConnection();
    try {
      const result = await pool.query(`
        SELECT setting_key, setting_value
        FROM user_settings
        WHERE user_id = $1
      `, [userId]);
      return result.rows;
    } catch (error) {
      return [];
    }
  },

  // Update or insert a user setting
  async updateUserSetting(userId, settingKey, settingValue) {
    checkConnection();
    try {
      const result = await pool.query(`
        INSERT INTO user_settings (user_id, setting_key, setting_value, updated_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, setting_key)
        DO UPDATE SET
          setting_value = $3,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [userId, settingKey, settingValue]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Delete a user setting
  async deleteUserSetting(userId, settingKey) {
    checkConnection();
    try {
      const result = await pool.query(`
        DELETE FROM user_settings
        WHERE user_id = $1 AND setting_key = $2
      `, [userId, settingKey]);
      return result.rowCount > 0;
    } catch (error) {
      throw error;
    }
  },

  // Run raw SQL query (for migrations and admin operations)
  async runRawQuery(sql, params = []) {
    checkConnection();
    try {
      const result = await pool.query(sql, params);
      return result;
    } catch (error) {
      console.error('Raw query error:', error);
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