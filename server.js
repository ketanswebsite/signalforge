const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const session = require('express-session');

// Load environment variables
require('dotenv').config();



// Load database - PostgreSQL only
let TradeDB;
try {
  TradeDB = require('./database-postgres');
  
  // Check if actually connected
  if (!TradeDB.isConnected()) {
    process.exit(1);
  }
} catch (err) {
  process.exit(1);
}

// Load Telegram bot
let telegramBot;
try {
  
  telegramBot = require('./lib/telegram/telegram-bot');
  
  // Initialize bot if token is provided
  if (process.env.TELEGRAM_BOT_TOKEN) {
    telegramBot.initializeTelegramBot();
  } else {
    telegramBot = null; // Explicitly set to null if no token
  }
} catch (err) {
  telegramBot = null;
}

// Load Stock Scanner Service
let stockScanner;
try {
  const StockScanner = require('./lib/scanner/scanner');
  stockScanner = new StockScanner();

  // Always initialize scanner - it will check for Telegram at runtime
  stockScanner.initialize();

  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
  } else {
  }
} catch (err) {
}

// Load Trade Executor for automated 1 PM execution
let tradeExecutor;
try {
  tradeExecutor = require('./lib/scheduler/trade-executor');

  // Initialize automated execution
  tradeExecutor.initialize();

  console.log('✅ Trade Executor loaded successfully');
} catch (err) {
  console.error('⚠️  Failed to load Trade Executor:', err.message);
  tradeExecutor = null;
}

// Load Exit Monitor for automated exit alerts
let exitMonitor;
try {
  exitMonitor = require('./lib/portfolio/exit-monitor');

  // Initialize exit monitoring
  exitMonitor.initialize();

  console.log('✅ Exit Monitor loaded successfully');
} catch (err) {
  console.error('⚠️  Failed to load Exit Monitor:', err.message);
  exitMonitor = null;
}

const app = express();
const PORT = process.env.PORT || 3000;

// Admin email constant
const ADMIN_EMAIL = 'ketanjoshisahs@gmail.com';

// Load authentication configuration with error handling
let passport, sessionConfig, ensureAuthenticated, ensureAuthenticatedAPI, authRoutes;
let authEnabled = false;

try {
  const authModule = require('./config/auth');
  passport = authModule.passport;
  sessionConfig = authModule.sessionConfig;
  ensureAuthenticated = authModule.ensureAuthenticated;
  ensureAuthenticatedAPI = authModule.ensureAuthenticatedAPI;
  authRoutes = require('./routes/auth');
  authEnabled = true;
} catch (error) {
  // Create dummy middleware that doesn't require auth
  ensureAuthenticated = (req, res, next) => next();
  ensureAuthenticatedAPI = (req, res, next) => next();
}

// Load subscription middleware
let ensureSubscriptionActive, ensurePremiumSubscription;
let subscriptionEnabled = false;

try {
  const subscriptionModule = require('./middleware/subscription');
  ensureSubscriptionActive = subscriptionModule.ensureSubscriptionActive;
  ensurePremiumSubscription = subscriptionModule.ensurePremiumSubscription;
  subscriptionEnabled = true;
} catch (error) {
  // Create dummy middleware that doesn't check subscriptions
  ensureSubscriptionActive = (req, res, next) => next();
  ensurePremiumSubscription = (req, res, next) => next();
}

// Middleware
app.use(cors());
app.use(express.json());

// Session and passport middleware only if auth is enabled
if (authEnabled) {
  try {
    // Session middleware (must come before passport)
    app.use(session(sessionConfig));
    
    // Passport middleware
    app.use(passport.initialize());
    app.use(passport.session());
    
    // Authentication routes (no auth required for these)
    app.use('/', authRoutes);
    
  } catch (error) {
    authEnabled = false;
  }
}

// Request logging with enhanced user tracking
app.use((req, res, next) => {
  
  // Enhanced user tracking: capture authenticated users who might not be in database
  if (req.isAuthenticated && req.isAuthenticated() && req.user && req.user.email) {
    // Async capture user without blocking request
    setImmediate(async () => {
      try {
        await ensureUserInDatabase(req.user);
      } catch (error) {
      }
    });
  }
  
  next();
});

// Enhanced user capture function - using shared database connection
async function ensureUserInDatabase(user) {
  try {
    if (!user || !user.email) return;
    
    // Use the shared database module instead of creating new connections
    await TradeDB.ensureUserExists(user);
    
  } catch (error) {
  }
}

// === API ROUTES ===

// IMPORTANT: Telegram webhook must come BEFORE authentication middleware!
// Telegram webhook endpoint for production (NO AUTH REQUIRED)
app.post('/api/telegram/webhook', express.json(), (req, res) => {
  console.log('📨 [WEBHOOK] Received update from Telegram');

  try {
    const update = req.body;
    console.log('📨 [WEBHOOK] Update type:', Object.keys(update).join(', '));

    if (update.message) {
      console.log('📨 [WEBHOOK] Message from:', update.message.from.first_name, '- Text:', update.message.text);
    }

    if (telegramBot && typeof telegramBot.processUpdate === 'function') {
      telegramBot.processUpdate(update);
      console.log('✅ [WEBHOOK] Update processed successfully');
    } else {
      console.error('❌ [WEBHOOK] Telegram bot not available');
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ [WEBHOOK] Error processing webhook:', error.message);
    console.error('❌ [WEBHOOK] Stack:', error.stack);
    res.status(500).send('Error processing webhook');
  }
});

// Protect all API routes except auth routes and telegram webhook
app.use('/api', ensureAuthenticatedAPI);

// ML routes
try {
  const mlRoutes = require('./ml/ml-routes');
  app.use('/api/ml', mlRoutes);
} catch (error) {
}

// Admin routes (with its own authentication middleware)
try {
  const adminRoutes = require('./routes/admin');
  app.use('/api/admin', adminRoutes);
  console.log('✓ Admin routes loaded successfully');
} catch (error) {
  console.error('✗ Failed to load admin routes:', error.message);
}

// Subscription routes (public and authenticated user endpoints)
try {
  const subscriptionRoutes = require('./routes/subscription');
  app.use('/api', subscriptionRoutes);
  console.log('✓ Subscription routes loaded successfully');
} catch (error) {
  console.error('✗ Failed to load subscription routes:', error.message);
}

// Stripe payment routes
try {
  const { initializeStripe, isStripeConfigured } = require('./config/stripe');

  // Initialize Stripe if configured
  initializeStripe();

  if (isStripeConfigured()) {
    const stripeRoutes = require('./routes/stripe');
    app.use('/api/stripe', stripeRoutes);
    console.log('✓ Stripe payment routes loaded successfully');
  } else {
    console.warn('⚠️  Stripe not configured. Payment routes will not be available.');
  }
} catch (error) {
  console.error('✗ Failed to load Stripe routes:', error.message);
}

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    message: 'API test endpoint is working!',
    server: 'app.js',
    timestamp: new Date().toISOString()
  });
});

// User endpoint for authentication check
app.get('/api/user', ensureAuthenticatedAPI, (req, res) => {
  res.json({
    authenticated: true,
    user: {
      ...req.user,
      isAdmin: req.user.email === ADMIN_EMAIL  // Add admin flag
    }
  });
});

// Debug endpoint to check all trades (admin only)
app.get('/api/debug/all-trades', ensureAuthenticatedAPI, async (req, res) => {
  // Check if user is admin
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  
  try {
    // For JSON database, get raw data
    if (typeof TradeDB.getAllTradesNoFilter === 'function') {
      const allTrades = await TradeDB.getAllTradesNoFilter();
      res.json({
        totalTrades: allTrades.length,
        trades: allTrades,
        database: 'Using getAllTradesNoFilter'
      });
    } else {
      res.status(500).json({
        error: 'Database method not available',
        totalTrades: 0,
        trades: []
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint for admin
app.get('/api/test-admin', ensureAuthenticatedAPI, async (req, res) => {
  try {
    
    // Test if database queries work
    const testResults = {};
    
    try {
      const trades = await TradeDB.getAllTrades(req.user?.email || 'default');
      testResults.getAllTrades = { success: true, count: trades.length };
    } catch (e) {
      testResults.getAllTrades = { success: false, error: e.message };
    }
    
    try {
      const userStats = await TradeDB.getUserStatistics();
      testResults.getUserStatistics = { success: true, count: userStats.length };
    } catch (e) {
      testResults.getUserStatistics = { success: false, error: e.message };
    }
    
    try {
      const systemStats = await TradeDB.getSystemStatistics();
      testResults.getSystemStatistics = { success: true, data: systemStats };
    } catch (e) {
      testResults.getSystemStatistics = { success: false, error: e.message };
    }
    
    res.json({
      user: req.user?.email,
      isAdmin: req.user?.email === ADMIN_EMAIL,
      testResults
    });
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Admin routes - restricted to specific admin email

app.get('/admin', ensureAuthenticated, (req, res) => {
  // Check if user is admin
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).send('Access denied. Admin privileges required.');
  }
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// New admin portal
app.get('/admin-portal', ensureAuthenticated, (req, res) => {
  // Check if user is admin
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).send('Access denied. Admin privileges required.');
  }
  res.sendFile(path.join(__dirname, 'public', 'admin-portal.html'));
});

// New admin portal v2 (revamped)
app.get('/admin-v2', ensureAuthenticated, (req, res) => {
  // Check if user is admin
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).send('Access denied. Admin privileges required.');
  }
  res.sendFile(path.join(__dirname, 'public', 'admin-v2.html'));
});

// API endpoint to get all Telegram subscribers (admin only)
app.get('/api/admin/subscribers', ensureAuthenticatedAPI, async (req, res) => {
  // Check if user is admin
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  try {
    // Get all subscribers (both active and inactive)
    const subscribers = await TradeDB.getAllActiveSubscribers();

    res.json({
      success: true,
      total: subscribers.length,
      subscribers: subscribers
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subscribers', details: error.message });
  }
});

// API endpoint to get all OAuth users (admin only)
app.get('/api/admin/users', ensureAuthenticatedAPI, async (req, res) => {
  // Check if user is admin
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  try {
    // Use TradeDB's pool connection
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // First check if telegram columns exist, if not add them
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(100)`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(100)`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS linking_token VARCHAR(100)`);
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMP`);
    } catch (migrationError) {
      // Columns might already exist, that's fine
      console.log('Migration check:', migrationError.message);
    }

    // Get all registered users from the users table with Telegram link status
    const result = await pool.query(`
      SELECT
        u.email,
        u.name,
        u.first_login,
        u.last_login,
        u.created_at,
        u.telegram_chat_id,
        u.telegram_username,
        u.telegram_linked_at,
        COUNT(t.id) as trade_count,
        MAX(t.created_at) as last_trade_date
      FROM users u
      LEFT JOIN trades t ON u.email = t.user_id
      GROUP BY u.email, u.name, u.first_login, u.last_login, u.created_at,
               u.telegram_chat_id, u.telegram_username, u.telegram_linked_at
      ORDER BY u.last_login DESC
    `);

    await pool.end(); // Close the connection

    res.json({
      success: true,
      total: result.rows.length,
      users: result.rows
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users', details: error.message });
  }
});

// OAuth-Telegram Linking Endpoints
// Generate linking token for current user
app.post('/api/user/generate-telegram-link', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const email = req.user.email;
    const token = await TradeDB.generateLinkingToken(email);
    const deepLink = `https://t.me/${process.env.TELEGRAM_BOT_USERNAME || 'MySignalForgeBot'}?start=link_${token}`;

    res.json({
      success: true,
      token,
      deepLink
    });
  } catch (error) {
    console.error('Error generating link:', error);
    res.status(500).json({ error: 'Failed to generate linking token' });
  }
});

// Check Telegram linking status for current user
app.get('/api/user/telegram-status', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const email = req.user.email;
    const status = await TradeDB.getUserTelegramStatus(email);
    res.json(status);
  } catch (error) {
    console.error('Error checking status:', error);
    res.status(500).json({ error: 'Failed to check linking status' });
  }
});

// Unlink Telegram from current user
app.post('/api/user/unlink-telegram', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const email = req.user.email;
    await TradeDB.unlinkTelegram(email);
    res.json({ success: true });
  } catch (error) {
    console.error('Error unlinking:', error);
    res.status(500).json({ error: 'Failed to unlink Telegram account' });
  }
});

// ===== GDPR DATA MANAGEMENT ENDPOINTS =====

// Get user data summary (GDPR Article 15 - Right of Access)
app.get('/api/user/data-summary', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const email = req.user.email;
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Get user basic info
    const userResult = await pool.query(
      'SELECT created_at, email, name FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      await pool.end();
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get trade counts
    const tradesResult = await pool.query(
      `SELECT
        COUNT(*) as total_trades,
        MAX(created_at) as last_trade_date
       FROM trades
       WHERE user_id = $1`,
      [email]
    );

    // Get active signals (alert preferences count)
    const alertsResult = await pool.query(
      `SELECT COUNT(*) as active_signals
       FROM alert_preferences
       WHERE user_id = $1 AND (telegram_enabled = true OR email_enabled = true)`,
      [email]
    );

    await pool.end();

    // Determine last activity
    const lastActivity = user.last_login || tradesResult.rows[0]?.last_trade_date || user.created_at;

    res.json({
      created_at: user.created_at,
      email: user.email,
      name: user.name,
      total_trades: parseInt(tradesResult.rows[0]?.total_trades || 0),
      active_signals: parseInt(alertsResult.rows[0]?.active_signals || 0),
      last_activity: lastActivity
    });

  } catch (error) {
    console.error('Error fetching user data summary:', error);
    res.status(500).json({ error: 'Failed to fetch user data summary' });
  }
});

// Download all user data (GDPR Article 20 - Right to Data Portability)
app.get('/api/user/download-data', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const email = req.user.email;
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Get all user data
    const userData = {};

    // 1. User profile
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    userData.profile = userResult.rows[0] || {};

    // 2. All trades
    const tradesResult = await pool.query(
      'SELECT * FROM trades WHERE user_id = $1 ORDER BY created_at DESC',
      [email]
    );
    userData.trades = tradesResult.rows;

    // 3. Alert preferences
    const alertsResult = await pool.query(
      'SELECT * FROM alert_preferences WHERE user_id = $1',
      [email]
    );
    userData.alertPreferences = alertsResult.rows[0] || null;

    // 4. Subscription info
    try {
      const subsResult = await pool.query(
        'SELECT * FROM user_subscriptions WHERE user_email = $1',
        [email]
      );
      userData.subscription = subsResult.rows[0] || null;
    } catch (e) {
      userData.subscription = null;
    }

    // 5. Payment history (anonymized sensitive data)
    try {
      const paymentsResult = await pool.query(
        `SELECT
          transaction_id, amount, currency, status, payment_method,
          payment_date, created_at, updated_at
         FROM payment_transactions
         WHERE user_email = $1
         ORDER BY created_at DESC`,
        [email]
      );
      userData.paymentHistory = paymentsResult.rows;
    } catch (e) {
      userData.paymentHistory = [];
    }

    await pool.end();

    // Add metadata
    userData.exportDate = new Date().toISOString();
    userData.exportedBy = email;
    userData.dataRetentionPolicy = {
      accountData: "Until deletion requested + 30 days",
      financialRecords: "6 years (UK financial regulations)",
      usageLogs: "12 months maximum",
      supportCommunications: "3 years"
    };

    // Set headers for download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="sutralgo-data-${email}-${Date.now()}.json"`);
    res.json(userData);

  } catch (error) {
    console.error('Error downloading user data:', error);
    res.status(500).json({ error: 'Failed to download user data' });
  }
});

// Export trade history as CSV
app.get('/api/trades/export', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const email = req.user.email;
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Get all trades
    const result = await pool.query(
      `SELECT
        symbol, name, entry_date, entry_price, exit_date, exit_price,
        shares, status, profit_loss, profit_loss_percentage,
        entry_reason, exit_reason, target_price, stop_loss_percent,
        investment_amount, currency_symbol, created_at
       FROM trades
       WHERE user_id = $1
       ORDER BY entry_date DESC`,
      [email]
    );

    await pool.end();

    // Build CSV
    const csvHeader = 'Symbol,Name,Entry Date,Entry Price,Exit Date,Exit Price,Shares,Status,Profit/Loss,Profit/Loss %,Entry Reason,Exit Reason,Target Price,Stop Loss %,Investment Amount,Currency,Created At\n';

    const csvRows = result.rows.map(row => {
      return [
        row.symbol || '',
        `"${(row.name || '').replace(/"/g, '""')}"`,
        row.entry_date ? new Date(row.entry_date).toISOString().split('T')[0] : '',
        row.entry_price || '',
        row.exit_date ? new Date(row.exit_date).toISOString().split('T')[0] : '',
        row.exit_price || '',
        row.shares || '',
        row.status || '',
        row.profit_loss || '',
        row.profit_loss_percentage || '',
        `"${(row.entry_reason || '').replace(/"/g, '""')}"`,
        `"${(row.exit_reason || '').replace(/"/g, '""')}"`,
        row.target_price || '',
        row.stop_loss_percent || '',
        row.investment_amount || '',
        row.currency_symbol || '',
        row.created_at ? new Date(row.created_at).toISOString() : ''
      ].join(',');
    }).join('\n');

    const csv = csvHeader + csvRows;

    // Set headers for download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="sutralgo-trades-${email}-${Date.now()}.csv"`);
    res.send(csv);

  } catch (error) {
    console.error('Error exporting trades:', error);
    res.status(500).json({ error: 'Failed to export trades' });
  }
});

// Delete user account (GDPR Article 17 - Right to Erasure)
app.delete('/api/user/delete-account', ensureAuthenticatedAPI, async (req, res) => {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  const client = await pool.connect();

  try {
    const email = req.user.email;

    await client.query('BEGIN');

    // 1. Create audit log entry BEFORE deletion
    try {
      await client.query(`
        INSERT INTO admin_activity_log (admin_email, activity_type, description, target_type, target_id, metadata, ip_address, success)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        email,
        'account_deletion',
        'User requested account deletion',
        'user',
        email,
        JSON.stringify({
          reason: 'User requested account deletion via data management page',
          timestamp: new Date().toISOString()
        }),
        req.ip || req.connection.remoteAddress,
        true
      ]);
    } catch (auditError) {
      // Log but don't fail if audit table doesn't exist
      console.error('Failed to create audit log:', auditError);
    }

    // 2. Archive financial records (REQUIRED for 6 years per UK law)
    // Create archive table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS deleted_user_financial_records (
        id SERIAL PRIMARY KEY,
        user_email VARCHAR(255) NOT NULL,
        deletion_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        retention_until TIMESTAMP NOT NULL,
        financial_data JSONB NOT NULL,
        deletion_requested_by VARCHAR(255),
        deletion_ip_address INET,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get financial records
    const financialRecords = {
      paymentTransactions: [],
      paymentRefunds: [],
      subscriptions: []
    };

    try {
      const paymentsResult = await client.query(
        'SELECT * FROM payment_transactions WHERE user_email = $1',
        [email]
      );
      financialRecords.paymentTransactions = paymentsResult.rows;
    } catch (e) {}

    try {
      const refundsResult = await client.query(
        'SELECT * FROM payment_refunds WHERE user_email = $1',
        [email]
      );
      financialRecords.paymentRefunds = refundsResult.rows;
    } catch (e) {}

    try {
      const subsResult = await client.query(
        'SELECT * FROM user_subscriptions WHERE user_email = $1',
        [email]
      );
      financialRecords.subscriptions = subsResult.rows;
    } catch (e) {}

    // Archive financial records for 6 years
    if (financialRecords.paymentTransactions.length > 0 ||
        financialRecords.paymentRefunds.length > 0 ||
        financialRecords.subscriptions.length > 0) {

      const retentionDate = new Date();
      retentionDate.setFullYear(retentionDate.getFullYear() + 6);

      await client.query(`
        INSERT INTO deleted_user_financial_records (user_email, retention_until, financial_data, deletion_requested_by, deletion_ip_address)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        email,
        retentionDate,
        JSON.stringify(financialRecords),
        email,
        req.ip || req.connection.remoteAddress
      ]);
    }

    // 3. Delete user data (in order to respect foreign key constraints)

    // Delete alert preferences
    await client.query('DELETE FROM alert_preferences WHERE user_id = $1', [email]);

    // Delete all trades
    await client.query('DELETE FROM trades WHERE user_id = $1', [email]);

    // Unlink Telegram (but keep telegram subscriber record for their chat)
    const telegramResult = await client.query(
      'SELECT telegram_chat_id FROM users WHERE email = $1',
      [email]
    );

    if (telegramResult.rows.length > 0 && telegramResult.rows[0].telegram_chat_id) {
      const chatId = telegramResult.rows[0].telegram_chat_id;
      await client.query(
        'UPDATE telegram_subscribers SET user_id = NULL WHERE chat_id = $1',
        [chatId]
      );
    }

    // Mark subscriptions as deleted (don't actually delete for financial records)
    try {
      await client.query(`
        UPDATE user_subscriptions
        SET status = 'deleted',
            updated_at = CURRENT_TIMESTAMP
        WHERE user_email = $1
      `, [email]);
    } catch (e) {}

    // Delete payment transactions (already archived)
    try {
      await client.query('DELETE FROM payment_transactions WHERE user_email = $1', [email]);
    } catch (e) {}

    try {
      await client.query('DELETE FROM payment_refunds WHERE user_email = $1', [email]);
    } catch (e) {}

    // 4. Finally, delete the user record
    await client.query('DELETE FROM users WHERE email = $1', [email]);

    await client.query('COMMIT');

    // 5. Logout the user (destroy session)
    if (req.logout) {
      req.logout((err) => {
        if (err) console.error('Error during logout:', err);
      });
    }

    if (req.session) {
      req.session.destroy();
    }

    res.json({
      success: true,
      message: 'Account successfully deleted',
      details: {
        email: email,
        deletionDate: new Date().toISOString(),
        financialRecordsRetained: financialRecords.paymentTransactions.length > 0 ||
                                   financialRecords.paymentRefunds.length > 0 ||
                                   financialRecords.subscriptions.length > 0,
        retentionPeriod: '6 years as required by UK financial regulations'
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting account:', error);
    res.status(500).json({
      error: 'Failed to delete account',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
    await pool.end();
  }
});

// Admin-only: Manually link Telegram to OAuth user
app.post('/api/admin/manual-link', ensureAuthenticatedAPI, async (req, res) => {
  // Check if user is admin
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  try {
    const { email, chatId } = req.body;

    if (!email || !chatId) {
      return res.status(400).json({ error: 'Email and Chat ID are required' });
    }

    const result = await TradeDB.manualLinkTelegramToUser(email, chatId);

    if (result.success) {
      res.json({
        success: true,
        message: `Linked ${result.telegram.username || result.telegram.first_name} to ${result.user.email}`,
        user: result.user,
        telegram: result.telegram
      });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error manual linking:', error);
    res.status(500).json({ error: 'Failed to link accounts', details: error.message });
  }
});

// Admin-only: Manually unlink Telegram from OAuth user
app.post('/api/admin/manual-unlink', ensureAuthenticatedAPI, async (req, res) => {
  // Check if user is admin
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    await TradeDB.unlinkTelegram(email);
    res.json({
      success: true,
      message: `Unlinked Telegram from ${email}`
    });
  } catch (error) {
    console.error('Error manual unlinking:', error);
    res.status(500).json({ error: 'Failed to unlink account', details: error.message });
  }
});

// Admin-only: Remove Telegram subscriber completely
app.post('/api/admin/remove-telegram-user', ensureAuthenticatedAPI, async (req, res) => {
  // Check if user is admin
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  try {
    const { chatId } = req.body;

    if (!chatId) {
      return res.status(400).json({ error: 'Chat ID is required' });
    }

    // Remove from telegram_subscribers (this also unlinks from OAuth via database function)
    await TradeDB.removeTelegramSubscriber(chatId);

    res.json({
      success: true,
      message: `Removed Telegram user ${chatId} from subscribers`
    });
  } catch (error) {
    console.error('Error removing Telegram user:', error);
    res.status(500).json({ error: 'Failed to remove user', details: error.message });
  }
});

// Admin-only: Remove OAuth user completely
app.post('/api/admin/remove-oauth-user', ensureAuthenticatedAPI, async (req, res) => {
  // Check if user is admin
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Use TradeDB's pool connection
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // First, unlink any Telegram account
    await TradeDB.unlinkTelegram(email);

    // Delete all trades for this user
    await pool.query(`DELETE FROM trades WHERE user_id = $1`, [email]);

    // Delete the user
    await pool.query(`DELETE FROM users WHERE email = $1`, [email]);

    await pool.end();

    res.json({
      success: true,
      message: `Removed user ${email} and all associated data`
    });
  } catch (error) {
    console.error('Error removing OAuth user:', error);
    res.status(500).json({ error: 'Failed to remove user', details: error.message });
  }
});

app.get('/api/admin/stats', ensureAuthenticatedAPI, async (req, res) => {
  // Check if user is admin
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  
  try {

    const userStats = await TradeDB.getUserStatistics();

    const systemStats = await TradeDB.getSystemStatistics();
    
    const response = {
      system: systemStats,
      users: userStats,
      currentUser: req.user.email
    };
    
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// System Health Check API endpoint
app.get('/api/admin/system/health', ensureAuthenticatedAPI, async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  try {
    const { performance } = require('perf_hooks');

    const healthStatus = {
      timestamp: new Date().toISOString(),
      overall: 'healthy',
      checks: [],
      warnings: []
    };

    // Check 1: Database Connection
    try {
      const start = performance.now();
      const isConnected = TradeDB.isConnected();
      const duration = performance.now() - start;

      if (isConnected) {
        await TradeDB.getAllUserSettings('default');
        healthStatus.checks.push({
          name: 'Database Connection',
          status: 'pass',
          message: 'Connected and responsive',
          duration: `${duration.toFixed(2)}ms`
        });
      } else {
        throw new Error('Not connected');
      }
    } catch (error) {
      healthStatus.checks.push({
        name: 'Database Connection',
        status: 'fail',
        message: error.message
      });
      healthStatus.overall = 'unhealthy';
    }

    // Check 2: Database Tables
    try {
      const tables = ['trades', 'pending_signals', 'user_settings'];
      for (const table of tables) {
        await TradeDB.pool.query(`SELECT COUNT(*) FROM ${table}`);
      }
      healthStatus.checks.push({
        name: 'Database Tables',
        status: 'pass',
        message: 'All required tables exist'
      });
    } catch (error) {
      healthStatus.checks.push({
        name: 'Database Tables',
        status: 'fail',
        message: error.message
      });
      healthStatus.overall = 'unhealthy';
    }

    // Check 3: Portfolio Capital Calculation
    try {
      const start = performance.now();
      const capital = await TradeDB.getPortfolioCapital();
      const duration = performance.now() - start;

      if (!capital.India || !capital.UK || !capital.US) {
        throw new Error('Missing market data');
      }

      healthStatus.checks.push({
        name: 'Portfolio Capital',
        status: 'pass',
        message: `All markets calculated in ${duration.toFixed(2)}ms`,
        duration: `${duration.toFixed(2)}ms`
      });
    } catch (error) {
      healthStatus.checks.push({
        name: 'Portfolio Capital',
        status: 'fail',
        message: error.message
      });
      healthStatus.overall = 'unhealthy';
    }

    // Check 4: Settings System
    try {
      const start = performance.now();
      const settings = await TradeDB.getAllUserSettings('default');
      const duration = performance.now() - start;

      healthStatus.checks.push({
        name: 'Settings System',
        status: 'pass',
        message: `${settings.length} settings loaded in ${duration.toFixed(2)}ms`,
        duration: `${duration.toFixed(2)}ms`
      });
    } catch (error) {
      healthStatus.checks.push({
        name: 'Settings System',
        status: 'fail',
        message: error.message
      });
      healthStatus.overall = 'unhealthy';
    }

    // Check 5: Memory Usage
    const usage = process.memoryUsage();
    const heapUsedMB = (usage.heapUsed / 1024 / 1024).toFixed(2);
    const heapTotalMB = (usage.heapTotal / 1024 / 1024).toFixed(2);
    const percentUsed = ((usage.heapUsed / usage.heapTotal) * 100).toFixed(2);

    healthStatus.checks.push({
      name: 'Memory Usage',
      status: 'pass',
      message: `Heap: ${heapUsedMB}/${heapTotalMB} MB (${percentUsed}%)`
    });

    if (percentUsed > 80) {
      healthStatus.warnings.push('High memory usage detected');
    }

    // Check 6: Environment Variables
    const requiredVars = ['DATABASE_URL', 'NODE_ENV'];
    const missing = requiredVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
      healthStatus.checks.push({
        name: 'Environment Variables',
        status: 'fail',
        message: `Missing: ${missing.join(', ')}`
      });
      healthStatus.overall = 'unhealthy';
    } else {
      healthStatus.checks.push({
        name: 'Environment Variables',
        status: 'pass',
        message: 'All required variables present'
      });
    }

    res.json({
      success: true,
      data: healthStatus
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Run Database Tests API endpoint
app.post('/api/admin/tests/database', ensureAuthenticatedAPI, async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  try {
    const { spawn } = require('child_process');
    const path = require('path');

    const testProcess = spawn('node', [path.join(__dirname, 'tests/database.test.js')]);

    let output = '';
    let errors = '';

    testProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    testProcess.stderr.on('data', (data) => {
      errors += data.toString();
    });

    testProcess.on('close', (code) => {
      res.json({
        success: code === 0,
        exitCode: code,
        output: output,
        errors: errors
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Run Performance Tests API endpoint
app.post('/api/admin/tests/performance', ensureAuthenticatedAPI, async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  try {
    const { spawn } = require('child_process');
    const path = require('path');

    const testProcess = spawn('node', [path.join(__dirname, 'tests/performance.test.js')]);

    let output = '';
    let errors = '';

    testProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    testProcess.stderr.on('data', (data) => {
      errors += data.toString();
    });

    testProcess.on('close', (code) => {
      res.json({
        success: code === 0,
        exitCode: code,
        output: output,
        errors: errors
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Run System Verification API endpoint
app.post('/api/admin/tests/verify-system', ensureAuthenticatedAPI, async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  try {
    const { spawn } = require('child_process');
    const path = require('path');

    const quick = req.body.quick || false;
    const args = quick ? ['--quick'] : [];

    const testProcess = spawn('node', [path.join(__dirname, 'scripts/verify-system.js'), ...args]);

    let output = '';
    let errors = '';

    testProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    testProcess.stderr.on('data', (data) => {
      errors += data.toString();
    });

    testProcess.on('close', (code) => {
      res.json({
        success: code === 0,
        exitCode: code,
        output: output,
        errors: errors
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User analytics endpoint - basic user statistics (no admin required)
app.get('/api/user-analytics', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const systemStats = await TradeDB.getSystemStatistics();
    
    // Return basic user statistics without sensitive details
    const userAnalytics = {
      totalUsers: systemStats.total_users || 0,
      usersWithTrades: systemStats.users_with_trades || 0,
      usersWithoutTrades: (systemStats.total_users || 0) - (systemStats.users_with_trades || 0),
      systemInfo: {
        totalTrades: systemStats.total_trades || 0,
        activeTrades: systemStats.active_trades || 0,
        closedTrades: systemStats.closed_trades || 0
      },
      lastUpdated: new Date().toISOString()
    };
    
    res.json(userAnalytics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user analytics' });
  }
});

// Debug endpoint to check users table directly
app.get('/api/debug/users', ensureAuthenticatedAPI, async (req, res) => {
  try {
    // Direct query to users table
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    const result = await pool.query('SELECT id, email, name, first_login, last_login FROM users ORDER BY last_login DESC');
    
    res.json({
      totalUsersInTable: result.rows.length,
      users: result.rows,
      currentUser: req.user.email,
      debugInfo: {
        tableExists: true,
        queryExecuted: true
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      debugInfo: {
        tableExists: false,
        queryExecuted: false
      }
    });
  }
});


// User recovery endpoint - comprehensive recovery for all user types
app.get('/api/recover-users', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    let recoveredUsers = [];
    let errors = [];
    
    // 1. Recover users from trades table
    const missingUsersQuery = `
      SELECT DISTINCT t.user_id, MIN(t.created_at) as first_trade_date, MAX(t.created_at) as last_trade_date, COUNT(*) as trade_count
      FROM trades t
      LEFT JOIN users u ON t.user_id = u.email
      WHERE u.email IS NULL AND t.user_id IS NOT NULL AND t.user_id != '' AND t.user_id != 'default'
      GROUP BY t.user_id
      ORDER BY first_trade_date ASC
    `;
    
    const missingUsers = await pool.query(missingUsersQuery);
    
    for (const user of missingUsers.rows) {
      try {
        await pool.query(`
          INSERT INTO users (email, name, google_id, first_login, last_login, created_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (email) DO NOTHING
        `, [
          user.user_id,
          user.user_id.split('@')[0],
          null,
          user.first_trade_date,
          user.last_trade_date,
          user.first_trade_date
        ]);
        
        recoveredUsers.push({
          email: user.user_id,
          source: 'trades',
          firstActivity: user.first_trade_date,
          lastActivity: user.last_trade_date,
          tradeCount: user.trade_count
        });
      } catch (err) {
        errors.push({ email: user.user_id, error: err.message, source: 'trades' });
      }
    }
    
    // 2. Recover users from alert preferences
    try {
      const alertUsersQuery = `
        SELECT DISTINCT a.user_email, COUNT(*) as alert_count
        FROM alert_preferences a
        LEFT JOIN users u ON a.user_email = u.email
        WHERE u.email IS NULL AND a.user_email IS NOT NULL AND a.user_email != ''
        GROUP BY a.user_email
      `;
      
      const alertUsers = await pool.query(alertUsersQuery);
      
      for (const user of alertUsers.rows) {
        try {
          await pool.query(`
            INSERT INTO users (email, name, google_id, first_login, last_login, created_at)
            VALUES ($1, $2, null, CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '30 days')
            ON CONFLICT (email) DO NOTHING
          `, [user.user_email, user.user_email.split('@')[0]]);
          
          recoveredUsers.push({
            email: user.user_email,
            source: 'alerts',
            firstActivity: 'Estimated (30 days ago)',
            lastActivity: 'Estimated (7 days ago)',
            alertCount: user.alert_count
          });
        } catch (err) {
          errors.push({ email: user.user_email, error: err.message, source: 'alerts' });
        }
      }
    } catch (alertError) {
    }
    
    // 3. Ensure admin user is tracked
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        await pool.query(`
          INSERT INTO users (email, name, google_id, first_login, last_login, created_at)
          VALUES ($1, $2, null, CURRENT_TIMESTAMP - INTERVAL '90 days', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP - INTERVAL '90 days')
          ON CONFLICT (email) DO UPDATE SET last_login = CURRENT_TIMESTAMP
        `, [adminEmail, adminEmail.split('@')[0]]);
        
        recoveredUsers.push({
          email: adminEmail,
          source: 'admin',
          firstActivity: 'System admin user',
          lastActivity: 'Current',
          role: 'admin'
        });
      }
    } catch (adminError) {
      errors.push({ email: process.env.ADMIN_EMAIL, error: adminError.message, source: 'admin' });
    }
    
    // Get updated user count
    const updatedCount = await pool.query('SELECT COUNT(*) as total FROM users');
    
    res.json({
      success: true,
      message: 'Comprehensive user recovery completed',
      recoveredUsers: recoveredUsers,
      totalRecovered: recoveredUsers.length,
      breakdown: {
        fromTrades: recoveredUsers.filter(u => u.source === 'trades').length,
        fromAlerts: recoveredUsers.filter(u => u.source === 'alerts').length,
        fromAdmin: recoveredUsers.filter(u => u.source === 'admin').length
      },
      errors: errors,
      newTotalUsers: parseInt(updatedCount.rows[0].total),
      executedBy: req.user.email
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Auto-recovery function that runs on server startup
async function autoRecoverUsers() {
  try {
    
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    let totalRecovered = 0;
    
    // 1. Recover users from trades table
    const missingUsersQuery = `
      SELECT COUNT(DISTINCT t.user_id) as missing_count
      FROM trades t
      LEFT JOIN users u ON t.user_id = u.email
      WHERE u.email IS NULL AND t.user_id IS NOT NULL AND t.user_id != '' AND t.user_id != 'default'
    `;
    
    const missingCount = await pool.query(missingUsersQuery);
    const missingUserCount = parseInt(missingCount.rows[0].missing_count);
    
    if (missingUserCount > 0) {
      
      const recoveryQuery = `
        INSERT INTO users (email, name, google_id, first_login, last_login, created_at)
        SELECT 
          t.user_id as email,
          SPLIT_PART(t.user_id, '@', 1) as name,
          null as google_id,
          MIN(t.created_at) as first_login,
          MAX(t.created_at) as last_login,
          MIN(t.created_at) as created_at
        FROM trades t
        LEFT JOIN users u ON t.user_id = u.email
        WHERE u.email IS NULL AND t.user_id IS NOT NULL AND t.user_id != '' AND t.user_id != 'default'
        GROUP BY t.user_id
        ON CONFLICT (email) DO NOTHING
      `;
      
      const result = await pool.query(recoveryQuery);
      totalRecovered += result.rowCount;
    }
    
    // 2. Recover users from alert preferences (users who set up alerts but might not have trades)
    try {
      const alertUsersQuery = `
        SELECT COUNT(DISTINCT a.user_email) as alert_users_count
        FROM alert_preferences a
        LEFT JOIN users u ON a.user_email = u.email
        WHERE u.email IS NULL AND a.user_email IS NOT NULL AND a.user_email != ''
      `;
      
      const alertCount = await pool.query(alertUsersQuery);
      const alertUserCount = parseInt(alertCount.rows[0].alert_users_count);
      
      if (alertUserCount > 0) {
        
        const alertRecoveryQuery = `
          INSERT INTO users (email, name, google_id, first_login, last_login, created_at)
          SELECT 
            a.user_email as email,
            SPLIT_PART(a.user_email, '@', 1) as name,
            null as google_id,
            CURRENT_TIMESTAMP - INTERVAL '30 days' as first_login,
            CURRENT_TIMESTAMP - INTERVAL '7 days' as last_login,
            CURRENT_TIMESTAMP - INTERVAL '30 days' as created_at
          FROM alert_preferences a
          LEFT JOIN users u ON a.user_email = u.email
          WHERE u.email IS NULL AND a.user_email IS NOT NULL AND a.user_email != ''
          GROUP BY a.user_email
          ON CONFLICT (email) DO NOTHING
        `;
        
        const alertResult = await pool.query(alertRecoveryQuery);
        totalRecovered += alertResult.rowCount;
      }
    } catch (alertError) {
    }
    
    // 3. Add known admin user if not present
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        await pool.query(`
          INSERT INTO users (email, name, google_id, first_login, last_login, created_at)
          VALUES ($1, $2, null, CURRENT_TIMESTAMP - INTERVAL '90 days', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP - INTERVAL '90 days')
          ON CONFLICT (email) DO NOTHING
        `, [adminEmail, adminEmail.split('@')[0]]);
      }
    } catch (adminError) {
    }
    
    // Get final user count
    const finalCount = await pool.query('SELECT COUNT(*) as total FROM users');

    if (totalRecovered > 0) {

    } else {

    }
    
    await pool.end();
  } catch (error) {
  }
}

// Check subscription setup endpoint
app.get('/api/check-subscription-setup', async (req, res) => {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    const results = {};

    // Check subscription_plans table
    try {
      const plansColumns = await pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'subscription_plans'
      `);
      
      const plans = await pool.query('SELECT * FROM subscription_plans ORDER BY region');
      
      results.subscription_plans = {
        exists: true,
        columns: plansColumns.rows.length,
        count: plans.rows.length,
        plans: plans.rows
      };
    } catch (e) {
      results.subscription_plans = { exists: false };
    }

    // Check user_subscriptions table
    try {
      const subsColumns = await pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions'
      `);
      
      const subsCount = await pool.query('SELECT COUNT(*) as count FROM user_subscriptions');
      
      results.user_subscriptions = {
        exists: true,
        columns: subsColumns.rows.length,
        count: parseInt(subsCount.rows[0].count)
      };
    } catch (e) {
      results.user_subscriptions = { exists: false };
    }

    // Check payment tables
    try {
      const transColumns = await pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'payment_transactions'
      `);
      
      const queueColumns = await pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'payment_verification_queue'
      `);
      
      const transCount = await pool.query('SELECT COUNT(*) as count FROM payment_transactions');
      const pendingCount = await pool.query(`
        SELECT COUNT(*) as count FROM payment_verification_queue 
        WHERE verification_status = 'pending'
      `);
      
      results.payment_tables = {
        transactions_exists: true,
        transactions_columns: transColumns.rows.length,
        transactions_count: parseInt(transCount.rows[0].count),
        queue_exists: true,
        queue_columns: queueColumns.rows.length,
        pending_verifications: parseInt(pendingCount.rows[0].count)
      };
    } catch (e) {
      results.payment_tables = {
        transactions_exists: false,
        queue_exists: false
      };
    }

    // Check users table modifications
    try {
      const usersCols = await pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name IN ('region', 'subscription_status', 'subscription_end_date', 'is_premium')
      `);
      
      results.users_table = {
        subscription_columns: usersCols.rows.map(row => row.column_name)
      };
    } catch (e) {
      results.users_table = { subscription_columns: [] };
    }

    await pool.end();
    res.json(results);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all trades
app.get('/api/trades', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    const userId = req.user ? req.user.email : 'default';
    const trades = await TradeDB.getAllTrades(userId);
    res.json(trades);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active trades
app.get('/api/trades/active', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    const userId = req.user ? req.user.email : 'default';
    const trades = await TradeDB.getActiveTrades(userId);
    res.json(trades);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get closed trades  
app.get('/api/trades/closed', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    const userId = req.user ? req.user.email : 'default';
    const trades = await TradeDB.getClosedTrades(userId);
    res.json(trades);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get trade by ID
app.get('/api/trades/:id', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    const userId = req.user ? req.user.email : 'default';
    const trade = await TradeDB.getTradeById(req.params.id, userId);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    res.json(trade);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create trade
app.post('/api/trades', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    const userId = req.user ? req.user.email : 'default';
    
    // Debug logging for TBCG.L trade
    if (req.body.symbol === 'TBCG.L') {
    }
    
    const trade = await TradeDB.insertTrade(req.body, userId);
    res.status(201).json(trade);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update trade
app.put('/api/trades/:id', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    
    const userId = req.user ? req.user.email : 'default';
    
    // First check if trade exists
    const existingTrade = await TradeDB.getTradeById(req.params.id, userId);
    if (!existingTrade) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    
    const success = await TradeDB.updateTrade(req.params.id, req.body, userId);
    if (!success) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    res.json({ message: 'Trade updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete trade
app.delete('/api/trades/:id', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    const userId = req.user ? req.user.email : 'default';
    const success = await TradeDB.deleteTrade(req.params.id, userId);
    if (!success) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    res.json({ message: 'Trade deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete all trades
app.delete('/api/trades', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    const userId = req.user ? req.user.email : 'default';
    const count = await TradeDB.deleteAllTrades(userId);
    res.json({ message: `Deleted ${count} trades` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk import
app.post('/api/trades/bulk', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    const { trades } = req.body;
    const userId = req.user ? req.user.email : 'default';
    const count = await TradeDB.bulkInsertTrades(trades, userId);
    res.json({ message: `Imported ${count} trades` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PORTFOLIO CAPITAL ENDPOINTS =====

// Initialize portfolio capital
app.post('/api/portfolio/initialize-capital', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const { india, uk, us } = req.body;

    // Validate inputs
    if (!india || !uk || !us || india < 0 || uk < 0 || us < 0) {
      return res.status(400).json({ error: 'Invalid capital amounts' });
    }

    // Update capital for each market
    await TradeDB.updatePortfolioCapital('India', 'INR', india);
    await TradeDB.updatePortfolioCapital('UK', 'GBP', uk);
    await TradeDB.updatePortfolioCapital('US', 'USD', us);

    // Get updated capital status
    const capital = await TradeDB.getPortfolioCapital();

    res.json({ success: true, capital });
  } catch (error) {
    console.error('Error initializing capital:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get portfolio capital status
app.get('/api/portfolio/capital', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const capital = await TradeDB.getPortfolioCapital();

    // Calculate totals
    const totals = {
      totalPositions: Object.values(capital).reduce((sum, m) => sum + m.positions, 0),
      maxTotalPositions: 30,
      utilizationPercent: 0
    };
    totals.utilizationPercent = ((totals.totalPositions / totals.maxTotalPositions) * 100).toFixed(1);

    res.json({ success: true, capital, totals });
  } catch (error) {
    console.error('Error getting capital:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check exit conditions for all active trades
app.post('/api/portfolio/check-exits', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const userId = req.user ? req.user.email : 'default';
    const activeTrades = await TradeDB.getActiveTrades(userId);

    const exits = [];
    let checked = 0;

    for (const trade of activeTrades) {
      checked++;

      // Calculate days held
      const entryDate = new Date(trade.entryDate);
      const today = new Date();
      const daysHeld = Math.floor((today - entryDate) / (1000 * 60 * 60 * 24));

      // Get current price (would need real-time price feed)
      // For now, skip the actual exit check implementation
      // This would be implemented in Phase 5
    }

    res.json({
      success: true,
      checked,
      exitsTriggered: exits.length,
      exits
    });
  } catch (error) {
    console.error('Error checking exits:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== SIGNALS ENDPOINTS =====

// Store signals from scan (called by scanner)
// NOTE: No authentication required - this is an internal service-to-service call
app.post('/api/signals/from-scan', async (req, res) => {
  try {
    const { signals } = req.body;

    if (!signals || !Array.isArray(signals)) {
      return res.status(400).json({ error: 'Invalid signals data' });
    }

    const stored = [];
    const duplicates = [];
    const errors = [];

    for (const signal of signals) {
      try {
        // Check if signal already exists
        const existing = await TradeDB.getPendingSignal(signal.symbol, signal.signalDate);

        if (existing) {
          duplicates.push({
            symbol: signal.symbol,
            reason: 'Signal already exists for today'
          });
          continue;
        }

        // Check if user already has active position
        const activePosition = await TradeDB.getActiveTradeBySymbol(signal.symbol);
        if (activePosition) {
          duplicates.push({
            symbol: signal.symbol,
            reason: 'Already have active position'
          });
          continue;
        }

        // Store signal
        const result = await TradeDB.storePendingSignal(signal);
        stored.push({ id: result.id, symbol: signal.symbol });
      } catch (error) {
        // Actual errors (not duplicates) go into errors array
        errors.push({
          symbol: signal.symbol,
          reason: error.message
        });
      }
    }

    res.json({
      success: true,
      created: stored.length,
      duplicates: duplicates.length,
      errors: errors.length,
      details: {
        storedSignals: stored,
        duplicateSignals: duplicates,
        errorSignals: errors
      }
    });
  } catch (error) {
    console.error('Error storing signals:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get pending signals
app.get('/api/signals/pending', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const { market, status } = req.query;
    const signals = await TradeDB.getPendingSignals(status || 'pending', market);

    // Enhance signals with additional info
    const enhancedSignals = signals.map(signal => ({
      id: signal.id,
      symbol: signal.symbol,
      signalDate: signal.signal_date,
      entryPrice: parseFloat(signal.entry_price),
      targetPrice: parseFloat(signal.target_price),
      stopLoss: parseFloat(signal.stop_loss),
      squareOffDate: signal.square_off_date,
      market: signal.market,
      winRate: parseFloat(signal.win_rate),
      historicalSignalCount: signal.historical_signal_count,
      status: signal.status,
      createdAt: signal.created_at,
      entryDTI: signal.entry_dti ? parseFloat(signal.entry_dti) : null,
      entry7DayDTI: signal.entry_7day_dti ? parseFloat(signal.entry_7day_dti) : null,
      canAdd: signal.status === 'pending',
      canAddReason: signal.status !== 'pending' ? `Status is ${signal.status}` : null
    }));

    res.json({
      success: true,
      signals: enhancedSignals,
      count: enhancedSignals.length
    });
  } catch (error) {
    console.error('Error getting pending signals:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add signal to portfolio
app.post('/api/signals/add-to-portfolio/:signalId', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const { signalId } = req.params;
    const { notes } = req.body;
    const userId = req.user ? req.user.email : 'default';

    // Get signal
    const signal = await TradeDB.getPendingSignal(null, null);
    const allSignals = await TradeDB.getPendingSignals('pending');
    const selectedSignal = allSignals.find(s => s.id == signalId);

    if (!selectedSignal) {
      return res.status(404).json({ error: 'Signal not found' });
    }

    // Determine market and trade size
    const marketSizes = {
      'India': 50000,
      'UK': 400,
      'US': 500
    };
    const tradeSize = marketSizes[selectedSignal.market];

    // Check if can add position
    const canAdd = await TradeDB.canAddPosition(selectedSignal.market, tradeSize);
    if (!canAdd.canAdd) {
      return res.status(400).json({
        success: false,
        error: canAdd.reason
      });
    }

    // Get capital before
    const capitalBefore = await TradeDB.getPortfolioCapital(selectedSignal.market);
    const marketCapBefore = capitalBefore[selectedSignal.market];

    // Create trade
    const trade = {
      symbol: selectedSignal.symbol,
      entryDate: new Date(),
      entryPrice: selectedSignal.entry_price,
      targetPrice: selectedSignal.target_price,
      stopLossPercent: 5,
      status: 'active',
      notes: notes || `Auto-added from 7 AM signal - Win Rate: ${selectedSignal.win_rate}%`,
      market: selectedSignal.market,
      tradeSize: tradeSize,
      signalDate: selectedSignal.signal_date,
      winRate: selectedSignal.win_rate,
      historicalSignalCount: selectedSignal.historical_signal_count,
      autoAdded: true,
      entryDTI: selectedSignal.entry_dti,
      entry7DayDTI: selectedSignal.entry_7day_dti
    };

    const newTrade = await TradeDB.insertTrade(trade, userId);

    // Allocate capital
    await TradeDB.allocateCapital(selectedSignal.market, tradeSize);

    // Update signal status
    await TradeDB.updateSignalStatus(signalId, 'added', newTrade.id);

    // Get capital after
    const capitalAfter = await TradeDB.getPortfolioCapital(selectedSignal.market);
    const marketCapAfter = capitalAfter[selectedSignal.market];

    res.json({
      success: true,
      trade: newTrade,
      capital: {
        market: selectedSignal.market,
        availableBefore: marketCapBefore.available,
        allocated: tradeSize,
        availableAfter: marketCapAfter.available,
        positions: marketCapAfter.positions
      }
    });
  } catch (error) {
    console.error('Error adding signal to portfolio:', error);
    res.status(500).json({ error: error.message });
  }
});

// Dismiss signal
app.post('/api/signals/dismiss/:signalId', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const { signalId } = req.params;

    const result = await TradeDB.updateSignalStatus(signalId, 'dismissed');

    if (!result) {
      return res.status(404).json({ error: 'Signal not found' });
    }

    res.json({
      success: true,
      signalId: parseInt(signalId),
      status: 'dismissed'
    });
  } catch (error) {
    console.error('Error dismissing signal:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual execution trigger (for testing)
app.post('/api/executor/manual-execute/:market', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const { market } = req.params;

    // Validate market
    if (!['India', 'UK', 'US'].includes(market)) {
      return res.status(400).json({ error: 'Invalid market. Must be India, UK, or US' });
    }

    if (!tradeExecutor) {
      return res.status(503).json({ error: 'Trade Executor not available' });
    }

    console.log(`🔧 Manual execution triggered for ${market} by ${req.user?.email || 'user'}`);

    // Execute market signals
    const result = await tradeExecutor.manualExecute(market);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error in manual execution:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get execution logs
app.get('/api/executor/logs', ensureAuthenticatedAPI, async (req, res) => {
  try {
    if (!tradeExecutor) {
      return res.status(503).json({ error: 'Trade Executor not available' });
    }

    const logs = tradeExecutor.getExecutionLogs();

    res.json({
      success: true,
      logs
    });
  } catch (error) {
    console.error('Error getting execution logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== SIGNAL TESTING & DIAGNOSTICS ENDPOINTS =====

// Test 7 AM scan manually
app.post('/api/admin/test-scan', ensureAuthenticatedAPI, async (req, res) => {
  try {
    if (!stockScanner) {
      return res.status(503).json({ error: 'Stock Scanner not available' });
    }

    console.log(`🧪 [TEST] Manual 7 AM scan triggered by ${req.user?.email || 'user'}`);

    // Run the high conviction scan (same as 7 AM cron job)
    const result = await stockScanner.runHighConvictionScan();

    res.json({
      success: true,
      message: 'Signal scan completed',
      ...result
    });
  } catch (error) {
    console.error('❌ [TEST] Scan failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test 1 PM execution manually (for specific market)
app.post('/api/admin/test-execution', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const { market } = req.body;

    // Validate market
    if (!market || !['India', 'UK', 'US'].includes(market)) {
      return res.status(400).json({ error: 'Invalid market. Must be India, UK, or US' });
    }

    if (!tradeExecutor) {
      return res.status(503).json({ error: 'Trade Executor not available' });
    }

    console.log(`🧪 [TEST] Manual 1 PM execution triggered for ${market} by ${req.user?.email || 'user'}`);

    // Execute market signals
    const result = await tradeExecutor.manualExecute(market);

    res.json({
      success: true,
      message: `Execution completed for ${market}`,
      ...result
    });
  } catch (error) {
    console.error(`❌ [TEST] Execution failed:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Get pending signals with detailed information
app.get('/api/admin/pending-signals', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const { status, market } = req.query;

    // Get all pending signals
    const signals = await TradeDB.getPendingSignals(status || 'pending', market || null);

    // Get today's date for comparison
    const today = new Date().toISOString().split('T')[0];

    // Enrich signals with diagnostic info
    const enrichedSignals = signals.map(signal => {
      const signalDateStr = new Date(signal.signal_date).toISOString().split('T')[0];
      const isToday = signalDateStr === today;
      const daysDiff = Math.floor((new Date() - new Date(signal.signal_date)) / (1000 * 60 * 60 * 24));

      return {
        ...signal,
        signal_date_formatted: signalDateStr,
        is_today: isToday,
        days_old: daysDiff,
        will_execute: isToday && signal.status === 'pending'
      };
    });

    // Group by status and market
    const grouped = {
      byStatus: {},
      byMarket: {},
      byDate: {}
    };

    enrichedSignals.forEach(signal => {
      // Group by status
      if (!grouped.byStatus[signal.status]) {
        grouped.byStatus[signal.status] = [];
      }
      grouped.byStatus[signal.status].push(signal);

      // Group by market
      if (!grouped.byMarket[signal.market]) {
        grouped.byMarket[signal.market] = [];
      }
      grouped.byMarket[signal.market].push(signal);

      // Group by date
      if (!grouped.byDate[signal.signal_date_formatted]) {
        grouped.byDate[signal.signal_date_formatted] = [];
      }
      grouped.byDate[signal.signal_date_formatted].push(signal);
    });

    res.json({
      success: true,
      today,
      total: enrichedSignals.length,
      signals: enrichedSignals,
      grouped
    });
  } catch (error) {
    console.error('Error fetching pending signals:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get detailed execution logs with diagnostics
app.get('/api/admin/execution-logs', ensureAuthenticatedAPI, async (req, res) => {
  try {
    if (!tradeExecutor) {
      return res.status(503).json({ error: 'Trade Executor not available' });
    }

    const logs = tradeExecutor.getExecutionLogs();

    // Get today's auto-added trades
    const today = new Date().toISOString().split('T')[0];
    const todayTrades = await TradeDB.pool.query(`
      SELECT
        symbol,
        market,
        entry_date,
        entry_price,
        trade_size,
        win_rate,
        signal_date
      FROM trades
      WHERE DATE(entry_date) = $1
        AND auto_added = true
      ORDER BY entry_date DESC
    `, [today]);

    res.json({
      success: true,
      today,
      executionLogs: logs,
      todayTrades: todayTrades.rows
    });
  } catch (error) {
    console.error('Error fetching execution logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get signal diagnostics (why signals not executing)
app.get('/api/admin/signal-diagnostics', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const CapitalManager = require('./lib/portfolio/capital-manager');

    // Get pending signals
    const pendingSignals = await TradeDB.getPendingSignals('pending', null);
    const todaySignals = pendingSignals.filter(s => {
      const signalDateStr = new Date(s.signal_date).toISOString().split('T')[0];
      return signalDateStr === today;
    });

    // Get capital status
    const capitalStatus = await CapitalManager.getCapitalStatus();

    // Get dismissed signals from today
    const dismissedToday = await TradeDB.pool.query(`
      SELECT
        symbol,
        market,
        signal_date,
        win_rate,
        status,
        dismissed_at,
        created_at
      FROM pending_signals
      WHERE status = 'dismissed'
        AND DATE(dismissed_at) = $1
      ORDER BY dismissed_at DESC
    `, [today]);

    // Validate each pending signal
    const validationResults = [];
    for (const signal of todaySignals) {
      const validation = await CapitalManager.validateTradeEntry(signal.market, signal.symbol);
      validationResults.push({
        symbol: signal.symbol,
        market: signal.market,
        win_rate: signal.win_rate,
        valid: validation.valid,
        reason: validation.reason || 'Valid',
        code: validation.code || 'OK'
      });
    }

    // Get cron status
    const cronStatus = {
      scannerInitialized: !!stockScanner,
      executorInitialized: !!tradeExecutor,
      serverTime: new Date().toISOString(),
      serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ukTime: new Date().toLocaleString("en-GB", {timeZone: "Europe/London"}),
      indiaTime: new Date().toLocaleString("en-IN", {timeZone: "Asia/Kolkata"}),
      usTime: new Date().toLocaleString("en-US", {timeZone: "America/New_York"})
    };

    res.json({
      success: true,
      today,
      diagnostics: {
        pendingSignalsTotal: pendingSignals.length,
        pendingSignalsToday: todaySignals.length,
        dismissedToday: dismissedToday.rows.length,
        capitalStatus: capitalStatus,
        validationResults: validationResults,
        dismissedSignals: dismissedToday.rows,
        cronStatus: cronStatus
      }
    });
  } catch (error) {
    console.error('Error getting signal diagnostics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual exit check trigger (for testing)
app.post('/api/exit-monitor/check-exits', ensureAuthenticatedAPI, async (req, res) => {
  try {
    if (!exitMonitor) {
      return res.status(503).json({ error: 'Exit Monitor not available' });
    }

    console.log(`🔧 Manual exit check triggered by ${req.user?.email || 'user'}`);

    // Check all exits
    const result = await exitMonitor.checkAllExits();

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error in manual exit check:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check single trade for exit
app.post('/api/exit-monitor/check-trade/:tradeId', ensureAuthenticatedAPI, async (req, res) => {
  try {
    if (!exitMonitor) {
      return res.status(503).json({ error: 'Exit Monitor not available' });
    }

    const { tradeId } = req.params;
    const userId = req.user?.email || 'default';
    const trade = await TradeDB.getTradeById(tradeId, userId);

    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    console.log(`🔧 Manual exit check for trade ${tradeId} (${trade.symbol})`);

    const result = await exitMonitor.checkTradeExit(trade);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error checking trade exit:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== SETTINGS API ENDPOINTS (Phase 6) =====

const SettingsManager = require('./lib/settings/settings-manager');

// Get user settings
app.get('/api/settings', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const userId = req.user?.email || 'default';
    const settings = await SettingsManager.getAllSettings(userId);
    res.json(settings);
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user settings
app.put('/api/settings', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const userId = req.user?.email || 'default';
    const settings = req.body;

    // Validate all settings
    for (const [key, value] of Object.entries(settings)) {
      if (!SettingsManager.validateSetting(key, value)) {
        return res.status(400).json({ error: `Invalid value for ${key}` });
      }
    }

    // Update settings
    await SettingsManager.updateSettings(userId, settings);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset settings to defaults
app.post('/api/settings/reset', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const userId = req.user?.email || 'default';
    await SettingsManager.resetToDefaults(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error resetting settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Yahoo Finance proxy - Historical data
app.get('/yahoo/history', async (req, res) => {
  try {
    const { symbol, period1, period2, interval } = req.query;
    
    if (!symbol) {
      return res.status(400).send('Symbol is required');
    }
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    const params = {
      period1: period1 || Math.floor(Date.now() / 1000) - (365 * 24 * 60 * 60),
      period2: period2 || Math.floor(Date.now() / 1000),
      interval: interval || '1d',
      includeAdjustedClose: true
    };

    const response = await axios.get(url, {
      params,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: 45000
    });
    
    const jsonData = response.data;
    
    if (!jsonData.chart || !jsonData.chart.result || jsonData.chart.result.length === 0) {
      return res.status(404).send('No data found for this symbol');
    }
    
    const result = jsonData.chart.result[0];
    const timestamps = result.timestamp || [];
    const quotes = result.indicators.quote[0] || {};
    const adjclose = result.indicators.adjclose ? result.indicators.adjclose[0].adjclose : null;
    
    let csvData = 'Date,Open,High,Low,Close,Adj Close,Volume\n';
    
    for (let i = 0; i < timestamps.length; i++) {
      const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
      const open = quotes.open ? quotes.open[i] || '' : '';
      const high = quotes.high ? quotes.high[i] || '' : '';
      const low = quotes.low ? quotes.low[i] || '' : '';
      const close = quotes.close ? quotes.close[i] || '' : '';
      const adjClose = adjclose ? adjclose[i] || close : close;
      const volume = quotes.volume ? quotes.volume[i] || '' : '';
      
      csvData += `${date},${open},${high},${low},${close},${adjClose},${volume}\n`;
    }
    
    res.set('Content-Type', 'text/csv');
    res.send(csvData);
  } catch (error) {
    res.status(500).send(`Proxy error: ${error.message}`);
  }
});

// Yahoo Finance proxy - Quote
app.get('/yahoo/quote', async (req, res) => {
  try {
    const { symbol } = req.query;
    
    if (!symbol) {
      return res.status(400).send('Symbol is required');
    }
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: 45000
    });
    
    res.json(response.data);
  } catch (error) {
    res.status(500).send(`Proxy error: ${error.message}`);
  }
});

// Helper function to check if market is open for a symbol
function isMarketOpen(symbol) {
  const now = new Date();
  
  // Determine market from symbol
  let timezone = 'America/New_York';
  let marketHours = { open: 9.5, close: 16, preOpen: 4, postClose: 20, days: [1,2,3,4,5] };
  
  if (symbol.endsWith('.NS')) {
    timezone = 'Asia/Kolkata';
    marketHours = { open: 9.25, close: 15.5, preOpen: 9, postClose: 16, days: [1,2,3,4,5] };
  } else if (symbol.endsWith('.L')) {
    timezone = 'Europe/London';
    marketHours = { open: 8, close: 16.5, preOpen: 5.5, postClose: 17.5, days: [1,2,3,4,5] };
  }
  
  try {
    // Get current time in market timezone
    const marketTimeStr = now.toLocaleString("en-US", {timeZone: timezone});
    const marketTime = new Date(marketTimeStr);
    const hours = marketTime.getHours();
    const minutes = marketTime.getMinutes();
    const day = marketTime.getDay();
    const currentTime = hours + (minutes / 60);
    
    // Check if it's a weekday
    if (!marketHours.days.includes(day)) {
      return false;
    }
    
    // Check if within market hours (including extended hours)
    return currentTime >= marketHours.preOpen && currentTime < marketHours.postClose;
  } catch (e) {
    // If timezone conversion fails, assume market is open
    return true;
  }
}

// Get real-time prices for multiple symbols
app.post('/api/prices', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    const { symbols } = req.body;
    
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: 'Symbols array is required' });
    }
    
    const priceData = {};
    
    // Fetch prices for each symbol
    const promises = symbols.map(async (symbol) => {
      try {
        // Check if market is open for this symbol
        const marketOpen = isMarketOpen(symbol);
        
        // Add market status to response
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
        
        const response = await axios.get(url, { 
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          },
          timeout: 5000
        });
        
        const data = response.data;
        if (data.chart && data.chart.result && data.chart.result.length > 0) {
          const result = data.chart.result[0];
          const meta = result.meta;
          const quote = result.indicators.quote[0];
          
          // Get the latest price
          const currentPrice = meta.regularMarketPrice || (quote.close ? quote.close[quote.close.length - 1] : 0);
          const previousClose = meta.previousClose || meta.chartPreviousClose || currentPrice;
          
          priceData[symbol] = {
            symbol: symbol,
            price: currentPrice,
            previousClose: previousClose,
            change: currentPrice - previousClose,
            changePercent: ((currentPrice - previousClose) / previousClose) * 100,
            volume: quote.volume ? quote.volume[quote.volume.length - 1] : 0,
            timestamp: new Date().toISOString(),
            marketOpen: marketOpen
          };
        }
      } catch (error) {
        // Return null price data for failed symbols
        priceData[symbol] = {
          symbol: symbol,
          price: 0,
          previousClose: 0,
          change: 0,
          changePercent: 0,
          volume: 0,
          error: true,
          timestamp: new Date().toISOString(),
          marketOpen: isMarketOpen(symbol)
        };
      }
    });
    
    await Promise.all(promises);
    
    res.json(priceData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Alert preferences endpoints
app.get('/api/alerts/preferences', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    const userId = req.user ? req.user.email : 'default';
    const prefs = await TradeDB.getAlertPreferences(userId);
    res.json(prefs || {
      telegram_enabled: false,
      telegram_chat_id: null,
      email_enabled: false,
      email_address: null,
      alert_on_buy: true,
      alert_on_sell: true,
      alert_on_target: true,
      alert_on_stoploss: true,
      alert_on_time_exit: true,
      market_open_alert: false,
      market_close_alert: false
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/alerts/preferences', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    const userId = req.user ? req.user.email : 'default';
    const saved = await TradeDB.saveAlertPreferences({
      user_id: userId,
      ...req.body
    });
    
    if (saved) {
      res.json({ message: 'Alert preferences saved successfully' });
    } else {
      res.status(500).json({ error: 'Failed to save preferences' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test Telegram connection
app.post('/api/alerts/test-telegram', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    const { chatId } = req.body;
    
    if (!telegramBot) {
      return res.status(400).json({ error: 'Telegram bot not initialized' });
    }
    
    const success = await telegramBot.testConnection(chatId);
    
    if (success) {
      res.json({ message: 'Test message sent successfully' });
    } else {
      res.status(400).json({ error: 'Failed to send test message' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get bot info
app.get('/api/alerts/bot-info', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    if (!telegramBot) {
      return res.status(400).json({ error: 'Telegram bot not initialized' });
    }
    
    const info = await telegramBot.getBotInfo();
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send custom alert message
app.post('/api/alerts/send-custom', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    const { chatId, message } = req.body;
    
    // Enhanced debugging for telegram bot initialization
    
    if (!telegramBot) {
      return res.status(400).json({ error: 'Telegram bot not initialized' });
    }
    
    if (typeof telegramBot.sendTelegramAlert !== 'function') {
      return res.status(400).json({ error: 'Telegram bot sendTelegramAlert method not available' });
    }
    
    if (!chatId || !message) {
      return res.status(400).json({ error: 'Missing chatId or message' });
    }
    
    // Format the message based on type
    let formattedMessage = '';
    
    if (message.type === 'backtest_complete' || message.type === 'opportunity_scan') {
      formattedMessage = `📊 *${message.title}*\n${message.text}\n\n`;
      message.fields.forEach(field => {
        formattedMessage += `${field.label}: *${field.value}*\n`;
      });
    } else if (message.type === 'buy_opportunity') {
      formattedMessage = `🎯 *${message.title}*\n\n`;
      formattedMessage += `📊 *Stock:* ${message.stock}\n`;
      message.fields.forEach(field => {
        formattedMessage += `${field.label}: *${field.value}*\n`;
      });
      if (message.action) {
        formattedMessage += `\n💡 *Action:* ${message.action}`;
      }
    } else if (message.type === 'custom') {
      // Handle custom messages - just use the message string directly
      formattedMessage = message.message || '';
    } else {
      // Fallback for unknown message types
      formattedMessage = typeof message === 'string' ? message : JSON.stringify(message);
    }
    
    
    const result = await telegramBot.sendTelegramAlert(chatId, {
      type: 'custom',
      message: formattedMessage
    });
    
    
    if (result === false) {
      return res.status(400).json({ error: 'Failed to send telegram alert - check bot configuration' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check with detailed info including cron status
app.get('/health', (req, res) => {
  const healthInfo = {
    status: 'ok',
    version: '3.0',
    auth: authEnabled ? 'enabled' : 'disabled',
    environment: process.env.NODE_ENV || 'development',
    render: !!process.env.RENDER,
    sessionStore: authEnabled ? 'SQLite' : 'none',
    timestamp: new Date().toISOString()
  };

  // Add cron status if scanner is available
  if (stockScanner) {
    try {
      const scannerStatus = stockScanner.getStatus();
      const ukNow = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/London"}));

      // Calculate next 7 AM weekday
      const next7am = new Date(ukNow);
      next7am.setHours(7, 0, 0, 0);
      if (next7am <= ukNow) {
        next7am.setDate(next7am.getDate() + 1);
      }
      // Skip to next weekday if weekend
      while (next7am.getDay() === 0 || next7am.getDay() === 6) {
        next7am.setDate(next7am.getDate() + 1);
      }

      healthInfo.cron = {
        active: true,
        scheduledJobs: scannerStatus.scheduledJobs,
        telegramConfigured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
        currentUKTime: ukNow.toLocaleString("en-GB", {timeZone: "Europe/London"}),
        nextScheduledRun: next7am.toLocaleString("en-GB", {timeZone: "Europe/London"}),
        serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
    } catch (error) {
      healthInfo.cron = { active: false, error: error.message };
    }
  } else {
    healthInfo.cron = { active: false, error: 'Scanner not initialized' };
  }

  res.json(healthInfo);
});

// Scanner status endpoint - check if cron jobs are active
app.get('/api/scanner/cron-status', (req, res) => {
  try {
    if (!stockScanner) {
      return res.status(503).json({
        error: 'Scanner not initialized',
        cronActive: false
      });
    }

    const status = stockScanner.getStatus();
    const ukNow = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/London"}));

    // Calculate next 7 AM weekday
    const next7am = new Date(ukNow);
    next7am.setHours(7, 0, 0, 0);
    if (next7am <= ukNow) {
      next7am.setDate(next7am.getDate() + 1);
    }
    // Skip to next weekday if weekend
    while (next7am.getDay() === 0 || next7am.getDay() === 6) {
      next7am.setDate(next7am.getDate() + 1);
    }

    res.json({
      cronActive: true,
      scheduledJobs: status.scheduledJobs,
      telegramConfigured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      currentUKTime: ukNow.toLocaleString("en-GB", {timeZone: "Europe/London"}),
      nextScheduledRun: next7am.toLocaleString("en-GB", {timeZone: "Europe/London"}),
      serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      lastScanResults: status.lastScanResults || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message, cronActive: false });
  }
});

// Favicon
app.get('/favicon.ico', (req, res) => {
  res.sendStatus(204);
});

// Serve lib directory for frontend shared modules (BEFORE auth middleware)
app.use('/lib', express.static(path.join(__dirname, 'lib')));

// Protect static files except login page and lib directory
app.use((req, res, next) => {
  // Allow access to login page, lib directory, and specific assets without authentication
  if (req.path === '/login.html' ||
      req.path === '/styles.css' ||
      req.path === '/css/main.css' ||
      req.path === '/js/modern-effects.js' ||
      req.path === '/js/theme-toggle.js' ||
      req.path.startsWith('/lib/')) {
    return next();
  }
  // All other static files require authentication
  ensureAuthenticated(req, res, next);
});

// Static files (MUST BE LAST!)
app.use(express.static(path.join(__dirname, 'public')));

// Alert checking function
async function checkTradeAlerts() {
  if (!telegramBot) return;
  
  try {
    // Get all active alert users
    const alertUsers = await TradeDB.getAllActiveAlertUsers();
    if (alertUsers.length === 0) return;
    
    for (const user of alertUsers) {
      if (!user.telegram_enabled || !user.telegram_chat_id) continue;
      
      // Get active trades for this specific user
      const activeTrades = await TradeDB.getActiveTrades(user.user_id);
      
      // Check each active trade for alert conditions
      for (const trade of activeTrades) {
        // Get current price (you'll need to implement this based on your price fetching logic)
        try {
          const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${trade.symbol}?interval=1d&range=1d`, {
            headers: {
              'User-Agent': 'Mozilla/5.0',
              'Accept': 'application/json'
            },
            timeout: 5000
          });
          
          const data = response.data;
          if (data.chart && data.chart.result && data.chart.result.length > 0) {
            const result = data.chart.result[0];
            const currentPrice = result.meta.regularMarketPrice;
            
            // Calculate P/L
            const percentGain = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
            
            // Check alert conditions
            let shouldAlert = false;
            let alertType = '';
            let reason = '';
            
            // Target reached
            if (user.alert_on_target && trade.targetPrice && currentPrice >= trade.targetPrice) {
              shouldAlert = true;
              alertType = 'target_reached';
              reason = 'Target price reached';
            }
            
            // Stop loss hit
            if (user.alert_on_stoploss && trade.stopLoss && currentPrice <= trade.stopLoss) {
              shouldAlert = true;
              alertType = 'stop_loss';
              reason = 'Stop loss triggered';
            }
            
            // Time exit (example: 30 days)
            const daysSinceEntry = Math.floor((Date.now() - new Date(trade.entryDate).getTime()) / (1000 * 60 * 60 * 24));
            if (user.alert_on_time_exit && daysSinceEntry >= 30) {
              shouldAlert = true;
              alertType = 'time_exit';
              reason = `${daysSinceEntry} days holding period`;
            }
            
            if (shouldAlert) {
              await telegramBot.sendTelegramAlert(user.telegram_chat_id, {
                type: alertType,
                stock: trade.symbol,
                price: currentPrice.toFixed(2),
                entryPrice: trade.entryPrice.toFixed(2),
                targetPrice: trade.targetPrice?.toFixed(2),
                stopLoss: trade.stopLoss?.toFixed(2),
                profitLoss: percentGain.toFixed(2),
                reason: reason,
                currencySymbol: trade.stockIndex === 'usStocks' ? '$' : '₹'
              });
            }
          }
        } catch (error) {
        }
      }
    }
  } catch (error) {
  }
}

// Check alerts every 5 minutes
setInterval(checkTradeAlerts, 5 * 60 * 1000);

// Stock scanner endpoints
app.post('/api/scanner/run', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    if (!stockScanner) {
      return res.status(503).json({ error: 'Stock scanner not available' });
    }
    
    // Use user's Telegram chat ID if available
    const user = await TradeDB.getUserByEmail(req.user.email);
    const chatId = user?.telegram_chat_id || process.env.TELEGRAM_CHAT_ID;
    
    if (!chatId) {
      return res.status(400).json({ error: 'No Telegram chat ID configured' });
    }
    
    // Run high conviction scan (same as successful manual scan logic)
    stockScanner.runHighConvictionScan(chatId);
    
    res.json({ 
      success: true, 
      message: 'Global scan started. Results will be sent to your Telegram.' 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start scan' });
  }
});

app.get('/api/scanner/status', ensureAuthenticatedAPI, ensureSubscriptionActive, (req, res) => {
  try {
    if (!stockScanner) {
      return res.status(503).json({ error: 'Stock scanner not available' });
    }
    
    const status = stockScanner.getStatus();
    status.telegramConfigured = !!process.env.TELEGRAM_CHAT_ID;
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get scanner status' });
  }
});

// Test endpoint for 7 AM scan - simulates the exact cron job behavior
app.post('/api/test-7am-scan', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    if (!stockScanner) {
      return res.status(503).json({ error: 'Stock scanner not available' });
    }

    console.log('🧪 [TEST] Manual 7 AM scan test triggered');
    console.log('🧪 [TEST] UK Time:', new Date().toLocaleString("en-GB", {timeZone: "Europe/London"}));
    console.log('🧪 [TEST] This will broadcast to ALL subscribers');

    // Run high conviction scan WITHOUT chatId to broadcast to all subscribers
    // This simulates the exact behavior of the 7 AM cron job
    stockScanner.runHighConvictionScan();

    res.json({
      success: true,
      message: '7 AM scan test initiated. This simulates the exact behavior of the scheduled scan. Check your Telegram for results.',
      details: {
        ukTime: new Date().toLocaleString("en-GB", {timeZone: "Europe/London"}),
        telegramChatId: process.env.TELEGRAM_CHAT_ID ? 'Configured' : 'Not configured'
      }
    });
  } catch (error) {
    console.error('🧪 [TEST] Failed to start test:', error.message);
    res.status(500).json({ error: 'Failed to start 7 AM scan test' });
  }
});

// Manual execution endpoint - execute pending signals for a market NOW
app.post('/api/execute-signals/:market', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const { market } = req.params;

    // Validate market
    if (!['India', 'UK', 'US'].includes(market)) {
      return res.status(400).json({ error: 'Invalid market. Must be India, UK, or US' });
    }

    // Check if user is admin
    if (req.user.email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Admin privileges required' });
    }

    if (!tradeExecutor) {
      return res.status(503).json({ error: 'Trade executor not available' });
    }

    console.log(`🔧 [MANUAL] Manual execution triggered for ${market} by ${req.user.email}`);
    const result = await tradeExecutor.manualExecute(market);

    res.json({
      success: true,
      message: `Manual execution completed for ${market}`,
      result
    });
  } catch (error) {
    console.error(`❌ [MANUAL] Manual execution failed:`, error.message);
    res.status(500).json({ error: 'Failed to execute signals', details: error.message });
  }
});

// Health check endpoint - shows cron status and recent execution history
app.get('/api/health/trading-automation', ensureAuthenticatedAPI, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Admin privileges required' });
    }

    const now = new Date();
    const ukNow = new Date(now.toLocaleString("en-US", {timeZone: "Europe/London"}));
    const istNow = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));

    // Get pending signals for each market
    const indiaPending = await TradeDB.getPendingSignals('pending', 'India');
    const ukPending = await TradeDB.getPendingSignals('pending', 'UK');
    const usPending = await TradeDB.getPendingSignals('pending', 'US');

    // Get today's signals
    const today = new Date().toISOString().split('T')[0];
    const todayIndia = indiaPending.filter(s => new Date(s.signal_date).toISOString().split('T')[0] === today);
    const todayUK = ukPending.filter(s => new Date(s.signal_date).toISOString().split('T')[0] === today);
    const todayUS = usPending.filter(s => new Date(s.signal_date).toISOString().split('T')[0] === today);

    // Get execution logs
    const executionLogs = tradeExecutor ? tradeExecutor.getExecutionLogs(5) : [];

    res.json({
      success: true,
      timestamp: now.toISOString(),
      serverTime: {
        utc: now.toISOString(),
        uk: ukNow.toLocaleString("en-GB", {timeZone: "Europe/London"}),
        india: istNow.toLocaleString("en-IN", {timeZone: "Asia/Kolkata"}),
        us: now.toLocaleString("en-US", {timeZone: "America/New_York"})
      },
      todayDate: today,
      pendingSignals: {
        India: {
          total: indiaPending.length,
          today: todayIndia.length,
          nextExecution: '1:00 PM IST (Mon-Fri)'
        },
        UK: {
          total: ukPending.length,
          today: todayUK.length,
          nextExecution: '1:00 PM GMT/BST (Mon-Fri)'
        },
        US: {
          total: usPending.length,
          today: todayUS.length,
          nextExecution: '1:00 PM EST/EDT (Mon-Fri)'
        }
      },
      cronJobs: {
        scanner: {
          active: stockScanner ? stockScanner.scheduledJobs.length > 0 : false,
          nextRun: '7:00 AM UK Time (Mon-Fri)'
        },
        tradeExecutor: {
          active: tradeExecutor ? tradeExecutor.isInitialized : false,
          markets: ['India', 'UK', 'US']
        }
      },
      recentExecutions: executionLogs.map(log => ({
        timestamp: log.timestamp,
        market: log.market,
        executed: log.summary.executed,
        failed: log.summary.failed,
        skipped: log.summary.skipped,
        duration: log.summary.duration
      })),
      diagnostics: {
        databaseConnected: TradeDB.isConnected(),
        telegramConfigured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
        scannerInitialized: stockScanner ? true : false,
        tradeExecutorInitialized: tradeExecutor ? tradeExecutor.isInitialized : false
      }
    });
  } catch (error) {
    console.error('❌ [HEALTH] Health check failed:', error.message);
    res.status(500).json({ error: 'Failed to get health status', details: error.message });
  }
});

// Force trigger cron job (admin only) - useful for debugging on Render
app.post('/api/force-cron-trigger', ensureAuthenticatedAPI, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Admin privileges required' });
    }

    if (!stockScanner) {
      return res.status(503).json({ error: 'Stock scanner not available' });
    }

    console.log('⚡ [FORCE TRIGGER] Admin manually triggered cron job');
    console.log('⚡ [FORCE TRIGGER] User:', req.user.email);
    console.log('⚡ [FORCE TRIGGER] UK Time:', new Date().toLocaleString("en-GB", {timeZone: "Europe/London"}));

    // Run the scan without chatId to trigger broadcast to all subscribers
    const result = await stockScanner.runHighConvictionScan();

    res.json({
      success: true,
      message: 'Cron job triggered successfully. Messages sent to all subscribers.',
      result: result,
      ukTime: new Date().toLocaleString("en-GB", {timeZone: "Europe/London"})
    });
  } catch (error) {
    console.error('⚡ [FORCE TRIGGER] Failed:', error.message);
    res.status(500).json({ error: 'Failed to trigger cron job', details: error.message });
  }
});

// Debug DTI scan endpoint - for testing with detailed logging
app.post('/api/debug-dti-scan', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {

    // Set debug mode environment variable
    process.env.DTI_DEBUG = 'true';

    // Use new scanner service for debug scan
    
    if (!stockScanner) {
      throw new Error('Stock Scanner Service not available');
    }
    
    const result = await stockScanner.runHighConvictionScan();
    
    const opportunities = result.opportunities || [];
    
    // Reset debug mode
    delete process.env.DTI_DEBUG;
    
    
    res.json({ 
      success: true, 
      message: `Debug DTI scan completed. Found ${opportunities.length} opportunities.`,
      opportunities: opportunities.map(opp => ({
        symbol: opp.stock.symbol,
        name: opp.stock.name,
        entryDate: opp.activeTrade.entryDate,
        entryPrice: opp.activeTrade.entryPrice,
        entryDTI: opp.activeTrade.entryDTI,
        currentPrice: opp.currentPrice,
        currentDTI: opp.currentDTI
      })),
      details: {
        totalOpportunities: opportunities.length,
        debugMode: true,
        stocksProcessed: 'First 10 stocks only'
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to run debug DTI scan', details: error.message });
  }
});

// Backend alerts endpoint - sends alerts using same system as 7AM scan
app.post('/api/send-backend-alerts', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  
  try {
    const { opportunities } = req.body;
    
    if (!opportunities || !Array.isArray(opportunities)) {
      return res.status(400).json({ error: 'Invalid opportunities data' });
    }
    
    if (!process.env.TELEGRAM_CHAT_ID) {
      return res.status(400).json({ error: 'TELEGRAM_CHAT_ID not configured in environment variables' });
    }
    
    // Check if scanner service is available (contains message formatting)
    if (!stockScanner) {
      return res.status(503).json({ error: 'Stock scanner service not available' });
    }
    
    // Check if telegram bot is available
    if (!telegramBot || typeof telegramBot.sendTelegramAlert !== 'function') {
      return res.status(503).json({ error: 'Telegram bot service not available' });
    }
    
    
    // Filter for opportunities from last 2 trading days (same as 7AM scan)
    const ukNow = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/London"}));
    const today = new Date(ukNow);
    today.setHours(0, 0, 0, 0);
    
    const recentOpportunities = opportunities.filter(opp => {
        if (!opp.trade || !opp.trade.entryDate) return false;
        
        const entryDate = new Date(opp.trade.entryDate);
        entryDate.setHours(0, 0, 0, 0);
        
        // Calculate days difference (excluding weekends)
        let tradingDays = 0;
        let tempDate = new Date(today);
        
        while (tempDate >= entryDate && tradingDays < 3) {
            const dayOfWeek = tempDate.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not weekend
                tradingDays++;
            }
            tempDate.setDate(tempDate.getDate() - 1);
            
            if (tempDate < entryDate) break;
        }
        
        return tradingDays <= 2; // Only last 2 trading days
    });
    
    
    if (recentOpportunities.length === 0) {
      // Send "no opportunities" message
      await telegramBot.sendTelegramAlert(process.env.TELEGRAM_CHAT_ID, {
        type: 'custom',
        message: `📊 *Manual Scan Complete*\n\nNo high conviction opportunities from last 2 days found.\n\nScan completed at: ${ukNow.toLocaleString("en-GB", {timeZone: "Europe/London"})}`
      });
    } else {
      // Convert format to match scanner service expectations
      const formattedOpportunities = recentOpportunities.map(opp => ({
        stock: opp.stock,
        activeTrade: opp.trade,
        currentPrice: opp.data?.currentPrice || opp.trade.entryPrice
      }));
      
      // Use scanner service's message formatting method (following project structure)
      const message = stockScanner.formatOpportunitiesMessage(formattedOpportunities);
      
      // Send via telegram bot service
      await telegramBot.sendTelegramAlert(process.env.TELEGRAM_CHAT_ID, {
        type: 'custom',
        message: message
      });
    }
    
    res.json({ 
      success: true, 
      message: `Alerts sent for ${recentOpportunities.length} opportunities`,
      details: {
        totalOpportunities: opportunities.length,
        filteredOpportunities: recentOpportunities.length,
        telegramChatId: process.env.TELEGRAM_CHAT_ID ? 'Configured' : 'Not configured'
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to send backend alerts', details: error.message });
  }
});

// Global scan endpoint for scheduled scanner
app.post('/api/scan/global', async (req, res) => {
  try {
    
    const { scanType, period, source } = req.body;
    
    // Use the new scanner service for global scan
    
    if (!stockScanner) {
      throw new Error('Stock Scanner Service not available');
    }
    
    // Execute high conviction scan with same logic as successful manual scan
    const result = await stockScanner.runHighConvictionScan();
    
    const opportunities = result.opportunities || [];
    
    
    // Filter for recent opportunities (last 2 trading days like browser does)
    const ukNow = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/London"}));
    const today = new Date(ukNow);
    today.setHours(0, 0, 0, 0);
    
    const recentOpportunities = opportunities.filter(opp => {
      if (!opp.activeTrade || !opp.activeTrade.entryDate) return false;
      
      const entryDate = new Date(opp.activeTrade.entryDate);
      entryDate.setHours(0, 0, 0, 0);
      
      // Calculate days difference (excluding weekends)
      let tradingDays = 0;
      let tempDate = new Date(today);
      
      while (tempDate >= entryDate && tradingDays < 3) {
        const dayOfWeek = tempDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not weekend
          tradingDays++;
        }
        tempDate.setDate(tempDate.getDate() - 1);
        
        if (tempDate < entryDate) break;
      }
      
      return tradingDays <= 2; // Only last 2 trading days
    });
    
    
    // Convert to format expected by the V2 scanner
    const formattedOpportunities = recentOpportunities.slice(0, 5).map(opp => ({
      symbol: opp.stock.symbol,
      name: opp.stock.name,
      currentPrice: opp.currentPrice || opp.activeTrade.entryPrice,
      dti: opp.activeTrade.entryDTI,
      date: opp.activeTrade.entryDate,
      trade: {
        entryDate: opp.activeTrade.entryDate,
        entryPrice: opp.activeTrade.entryPrice,
        entryDTI: opp.activeTrade.entryDTI,
        currentPrice: opp.currentPrice || opp.activeTrade.entryPrice
      }
    }));
    
    res.json({
      success: true,
      opportunities: formattedOpportunities,
      totalScanned: 2381, // Actual count from comprehensive stock lists
      errors: 0,
      source: source || 'api',
      scanTime: new Date().toISOString(),
      filtering: 'Recent opportunities from last 2 trading days only'
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete scan', details: error.message });
  }
});

// ===== HIGH CONVICTION PORTFOLIO ENDPOINTS =====

// Get portfolio status (admin only)
app.get('/api/portfolio/status', ensureAuthenticatedAPI, async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    if (!stockScanner || !stockScanner.portfolioManager) {
      return res.status(500).json({ error: 'Portfolio manager not initialized' });
    }

    const status = await stockScanner.portfolioManager.getPortfolioStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all active high conviction trades
app.get('/api/portfolio/trades/active', ensureAuthenticatedAPI, async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const trades = await TradeDB.getActiveHighConvictionTrades();
    res.json({ trades });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all high conviction trades (with date filter)
app.get('/api/portfolio/trades/all', ensureAuthenticatedAPI, async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { startDate, endDate } = req.query;
    const trades = await TradeDB.getAllHighConvictionTrades(startDate, endDate);
    res.json({ trades });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get P&L summary
app.get('/api/portfolio/pl-summary', ensureAuthenticatedAPI, async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { startDate, endDate } = req.query;
    const summary = await TradeDB.getHighConvictionPLSummary(startDate, endDate);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update all active trades (manual trigger)
app.post('/api/portfolio/update-trades', ensureAuthenticatedAPI, async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    if (!stockScanner || !stockScanner.portfolioManager) {
      return res.status(500).json({ error: 'Portfolio manager not initialized' });
    }

    const result = await stockScanner.portfolioManager.updateAllActiveTrades();
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate and send weekly report (manual trigger)
app.post('/api/portfolio/send-weekly-report', ensureAuthenticatedAPI, async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    if (!stockScanner || !stockScanner.portfolioManager) {
      return res.status(500).json({ error: 'Portfolio manager not initialized' });
    }

    const result = await stockScanner.portfolioManager.sendWeeklyReport();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Preview weekly report (without sending)
app.get('/api/portfolio/preview-report', ensureAuthenticatedAPI, async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    if (!stockScanner || !stockScanner.portfolioManager) {
      return res.status(500).json({ error: 'Portfolio manager not initialized' });
    }

    const message = await stockScanner.portfolioManager.generateWeeklyReport();
    res.json({ message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Close a specific trade manually
app.post('/api/portfolio/close-trade/:symbol', ensureAuthenticatedAPI, async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { symbol } = req.params;
    const { exitPrice, exitReason } = req.body;

    if (!exitPrice || !exitReason) {
      return res.status(400).json({ error: 'exitPrice and exitReason required' });
    }

    // Get the active trade
    const activeTrades = await TradeDB.getActiveHighConvictionTrades();
    const trade = activeTrades.find(t => t.symbol === symbol);

    if (!trade) {
      return res.status(404).json({ error: 'Active trade not found' });
    }

    // Calculate P&L
    const market = trade.market;
    const shares = parseFloat(trade.shares);
    const entryPrice = parseFloat(trade.entry_price);

    if (!stockScanner || !stockScanner.portfolioManager) {
      return res.status(500).json({ error: 'Portfolio manager not initialized' });
    }

    const pl = stockScanner.portfolioManager.calculatePL(entryPrice, exitPrice, shares, market);

    const exitData = {
      exitDate: new Date().toISOString().split('T')[0],
      exitPrice: exitPrice,
      exitReason: exitReason,
      plPercent: pl.plPercent,
      plAmountGBP: pl.plGBP,
      plAmountINR: pl.plINR,
      plAmountUSD: pl.plUSD
    };

    const result = await TradeDB.closeHighConvictionTrade(symbol, exitData);

    // Send exit alert to all subscribers
    const closure = {
      symbol: trade.symbol,
      name: trade.name,
      market: trade.market,
      currencySymbol: trade.currency_symbol,
      entryPrice: entryPrice,
      entryDate: trade.entry_date,
      exitData: exitData
    };
    await stockScanner.portfolioManager.sendExitAlert(closure);

    res.json({ success: true, trade: result, alertSent: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
    path: req.path
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    path: req.path 
  });
});

// Start server
app.listen(PORT, async () => {
  
  try {
    const trades = await TradeDB.getAllTrades('default');
  } catch (error) {
  }
  
  // Run automatic user recovery on startup
  try {
    await autoRecoverUsers();
  } catch (error) {
  }
  
  // Run initial alert check
  if (telegramBot) {
    if (telegramBot) {
    checkTradeAlerts();
  }
  }
  
});