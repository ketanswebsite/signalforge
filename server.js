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
    user: req.user
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
      timeout: 10000
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
      timeout: 10000
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
      req.path.startsWith('/js/theme-toggle.js') ||
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