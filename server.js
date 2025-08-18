const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const session = require('express-session');

// Load environment variables
require('dotenv').config();

console.log('\n=== STARTING NEW APP.JS SERVER - UPDATED SCHEMA ===\n');

// Run diagnostic info on Render
if (process.env.RENDER) {
  console.log('Running on Render - Diagnostic Info:');
  console.log('- Working directory:', process.cwd());
  console.log('- NODE_ENV:', process.env.NODE_ENV);
  console.log('- Using PostgreSQL database (no local storage needed)');
}

// Load database - PostgreSQL only
let TradeDB;
try {
  TradeDB = require('./database-postgres');
  console.log('✓ Database module loaded: PostgreSQL');
  
  // Check if actually connected
  if (!TradeDB.isConnected()) {
    console.error('✗ PostgreSQL not configured. Please set up your database connection.');
    console.log('📋 Visit /migrate-to-postgres.html to set up PostgreSQL database');
    process.exit(1);
  }
} catch (err) {
  console.error('✗ PostgreSQL database module failed to load:', err.message);
  console.error('✗ No database available! Please configure PostgreSQL.');
  process.exit(1);
}

// Load Telegram bot
let telegramBot;
try {
  console.log('🔍 Loading Telegram bot module...');
  console.log('  TELEGRAM_BOT_TOKEN exists:', !!process.env.TELEGRAM_BOT_TOKEN);
  console.log('  TELEGRAM_CHAT_ID exists:', !!process.env.TELEGRAM_CHAT_ID);
  
  telegramBot = require('./lib/telegram/telegram-bot');
  console.log('✓ Telegram bot module loaded successfully');
  console.log('  Module exports:', Object.keys(telegramBot));
  
  // Initialize bot if token is provided
  if (process.env.TELEGRAM_BOT_TOKEN) {
    console.log('🚀 Initializing telegram bot...');
    telegramBot.initializeTelegramBot();
    console.log('✓ Telegram bot initialized');
    console.log('  telegramBot variable type:', typeof telegramBot);
    console.log('  sendTelegramAlert available:', typeof telegramBot.sendTelegramAlert);
  } else {
    console.log('ℹ Telegram bot token not found, alerts disabled');
    telegramBot = null; // Explicitly set to null if no token
  }
} catch (err) {
  console.log('ℹ Telegram bot module not available:', err.message);
  console.log('ℹ Setting telegramBot to null');
  telegramBot = null;
}

// Load Stock Scanner Service
let stockScanner;
try {
  const StockScanner = require('./lib/scanner/scanner');
  stockScanner = new StockScanner();
  
  // Initialize scanner if Telegram bot is available
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    stockScanner.initialize();
    console.log('✓ Stock Scanner Service initialized with daily scans at 7 AM UK time');
    console.log('✓ Scanner uses clean, unified DTI logic from shared modules');
  } else {
    console.log('ℹ Stock Scanner Service disabled - Telegram not configured');
  }
} catch (err) {
  console.log('ℹ Stock Scanner Service not available:', err.message);
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
  console.log('✓ Authentication module loaded');
} catch (error) {
  console.error('✗ Authentication module failed to load:', error.message);
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
  console.log('✓ Subscription middleware loaded');
} catch (error) {
  console.error('✗ Subscription middleware failed to load:', error.message);
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
    
    console.log('✓ Auth middleware configured');
  } catch (error) {
    console.error('✗ Failed to configure auth middleware:', error);
    authEnabled = false;
  }
}

// Request logging with enhanced user tracking
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (req.url.includes('auth') || req.url === '/') {
    console.log('Session ID:', req.sessionID);
    console.log('Is Authenticated:', req.isAuthenticated ? req.isAuthenticated() : 'N/A');
    console.log('User:', req.user);
  }
  
  // Enhanced user tracking: capture authenticated users who might not be in database
  if (req.isAuthenticated && req.isAuthenticated() && req.user && req.user.email) {
    // Async capture user without blocking request
    setImmediate(async () => {
      try {
        await ensureUserInDatabase(req.user);
      } catch (error) {
        console.error('Background user capture failed:', error);
      }
    });
  }
  
  next();
});

// Enhanced user capture function
async function ensureUserInDatabase(user) {
  try {
    if (!user || !user.email) return;
    
    // Check if user exists in database
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    const existingUser = await pool.query('SELECT email FROM users WHERE email = $1', [user.email]);
    
    if (existingUser.rows.length === 0) {
      // User not in database, add them
      console.log(`🔄 Capturing missing user: ${user.email}`);
      
      await pool.query(`
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
      
      console.log(`✅ Successfully captured user: ${user.email}`);
    } else {
      // User exists, update last_login
      await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE email = $1', [user.email]);
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error in ensureUserInDatabase:', error);
  }
}

// === API ROUTES ===

// Protect all API routes except auth routes
app.use('/api', ensureAuthenticatedAPI);

// ML routes
try {
  const mlRoutes = require('./ml/ml-routes');
  app.use('/api/ml', mlRoutes);
  console.log('✓ ML routes loaded');
} catch (error) {
  console.log('ℹ ML module not available:', error.message);
}

// Test endpoint
app.get('/api/test', (req, res) => {
  console.log('>>> /api/test endpoint hit!');
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
    console.log('Test admin endpoint - User:', req.user?.email);
    
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
    console.error('Test admin error:', error);
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

app.get('/api/admin/stats', ensureAuthenticatedAPI, async (req, res) => {
  // Check if user is admin
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  
  try {
    console.log('Fetching admin statistics for:', req.user.email);
    
    const userStats = await TradeDB.getUserStatistics();
    console.log('User statistics count:', userStats ? userStats.length : 'null');
    console.log('User statistics sample:', userStats ? userStats.slice(0, 2) : 'null');
    
    const systemStats = await TradeDB.getSystemStatistics();
    console.log('System statistics:', systemStats);
    
    const response = {
      system: systemStats,
      users: userStats,
      currentUser: req.user.email
    };
    
    console.log('Sending admin response - users count:', response.users ? response.users.length : 'null');
    
    res.json(response);
  } catch (error) {
    console.error('Error getting admin stats:', error);
    console.error('Error stack:', error.stack);
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
    console.error('Error getting user analytics:', error);
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
    console.error('Error querying users table:', error);
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
      console.log('Alert preferences recovery skipped:', alertError.message);
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
    console.error('Error in comprehensive user recovery:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Auto-recovery function that runs on server startup
async function autoRecoverUsers() {
  try {
    console.log('🔄 Running comprehensive automatic user recovery...');
    
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
      console.log(`📊 Found ${missingUserCount} users in trades table not in users table`);
      
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
      console.log(`✅ Recovered ${result.rowCount} users from trades table`);
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
        console.log(`🔔 Found ${alertUserCount} users in alert preferences not in users table`);
        
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
        console.log(`✅ Recovered ${alertResult.rowCount} users from alert preferences`);
      }
    } catch (alertError) {
      console.log('ℹ️ Alert preferences table not available for recovery');
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
        console.log(`✅ Ensured admin user is tracked: ${adminEmail}`);
      }
    } catch (adminError) {
      console.log('ℹ️ Admin user recovery skipped');
    }
    
    // Get final user count
    const finalCount = await pool.query('SELECT COUNT(*) as total FROM users');
    console.log(`👥 Total users in database: ${finalCount.rows[0].total}`);
    
    if (totalRecovered > 0) {
      console.log(`🎉 Successfully recovered ${totalRecovered} users total`);
    } else {
      console.log('✅ No missing users found - all users are properly tracked');
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error in auto user recovery:', error);
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
    console.error('Error checking subscription setup:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all trades
app.get('/api/trades', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  console.log('>>> /api/trades endpoint hit!');
  try {
    const userId = req.user ? req.user.email : 'default';
    const trades = await TradeDB.getAllTrades(userId);
    console.log(`>>> Returning ${trades.length} trades for user ${userId}`);
    res.json(trades);
  } catch (error) {
    console.error('>>> Error:', error.message);
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
      console.log('=== TBCG.L POST /api/trades DEBUG ===');
      console.log('Raw trade data:', req.body);
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
    console.log('>>> UPDATE TRADE REQUEST:', {
      id: req.params.id,
      idType: typeof req.params.id,
      user: req.user?.email,
      body: req.body,
      hasEntryPrice: 'entryPrice' in req.body,
      entryPrice: req.body.entryPrice
    });
    
    const userId = req.user ? req.user.email : 'default';
    
    // First check if trade exists
    const existingTrade = await TradeDB.getTradeById(req.params.id, userId);
    if (!existingTrade) {
      console.log('>>> Trade not found:', {
        requestedId: req.params.id,
        userId: userId
      });
      return res.status(404).json({ error: 'Trade not found' });
    }
    
    const success = await TradeDB.updateTrade(req.params.id, req.body, userId);
    if (!success) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    res.json({ message: 'Trade updated successfully' });
  } catch (error) {
    console.error('>>> UPDATE TRADE ERROR:', error);
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
    console.error('Yahoo proxy error:', error.message);
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
    console.error('Yahoo proxy error:', error.message);
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
        console.error(`Error fetching price for ${symbol}:`, error.message);
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
    console.error('Price fetch error:', error.message);
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
    console.error('Alert preferences save error:', error);
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
    console.log('🔍 /api/alerts/send-custom - Debug info:');
    console.log('  telegramBot exists:', !!telegramBot);
    console.log('  telegramBot type:', typeof telegramBot);
    console.log('  telegramBot methods:', telegramBot ? Object.keys(telegramBot) : 'N/A');
    console.log('  TELEGRAM_BOT_TOKEN set:', !!process.env.TELEGRAM_BOT_TOKEN);
    console.log('  TELEGRAM_CHAT_ID set:', !!process.env.TELEGRAM_CHAT_ID);
    
    if (!telegramBot) {
      console.error('❌ telegramBot is falsy:', telegramBot);
      return res.status(400).json({ error: 'Telegram bot not initialized' });
    }
    
    if (typeof telegramBot.sendTelegramAlert !== 'function') {
      console.error('❌ sendTelegramAlert method not available');
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
    }
    
    console.log('📤 Attempting to send telegram alert to:', chatId);
    console.log('📝 Message preview:', formattedMessage.substring(0, 100) + '...');
    
    const result = await telegramBot.sendTelegramAlert(chatId, {
      type: 'custom',
      message: formattedMessage
    });
    
    console.log('📤 Telegram alert result:', result);
    
    if (result === false) {
      return res.status(400).json({ error: 'Failed to send telegram alert - check bot configuration' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending custom alert:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check with detailed info
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
  res.json(healthInfo);
});

// Favicon
app.get('/favicon.ico', (req, res) => {
  res.sendStatus(204);
});

// Protect static files except login page
app.use((req, res, next) => {
  // Allow access to login page and its assets without authentication
  if (req.path === '/login.html' || 
      req.path === '/styles.css' || 
      req.path.startsWith('/js/theme-toggle.js')) {
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
          console.error(`Failed to check alerts for ${trade.symbol}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error('Error in checkTradeAlerts:', error);
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
    
    // Run scan asynchronously using V2 scanner (mimics exact manual button behavior)
    stockScanner.runManualScanSimulation(chatId);
    
    res.json({ 
      success: true, 
      message: 'Global scan started. Results will be sent to your Telegram.' 
    });
  } catch (error) {
    console.error('Error starting scan:', error);
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
    console.error('Error getting scanner status:', error);
    res.status(500).json({ error: 'Failed to get scanner status' });
  }
});

// Test endpoint for 7 AM scan - simulates the exact cron job behavior
app.post('/api/test-7am-scan', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    if (!stockScanner) {
      return res.status(503).json({ error: 'Stock scanner not available' });
    }
    
    if (!process.env.TELEGRAM_CHAT_ID) {
      return res.status(400).json({ error: 'TELEGRAM_CHAT_ID not configured in environment variables' });
    }
    
    console.log('📧 Test 7 AM scan triggered by user:', req.user.email);
    console.log('[TEST 7AM] Simulating scheduled scan at:', new Date().toISOString());
    console.log('[TEST 7AM] UK time:', new Date().toLocaleString("en-GB", {timeZone: "Europe/London"}));
    console.log('[TEST 7AM] Using default TELEGRAM_CHAT_ID:', process.env.TELEGRAM_CHAT_ID);
    
    // Run scan exactly as the cron job would - without passing a specific chatId
    // This simulates the 7 AM scheduled behavior using new V2 scanner
    stockScanner.runManualScanSimulation();
    
    res.json({ 
      success: true, 
      message: '7 AM scan test initiated. This simulates the exact behavior of the scheduled scan. Check your Telegram for results.',
      details: {
        ukTime: new Date().toLocaleString("en-GB", {timeZone: "Europe/London"}),
        telegramChatId: process.env.TELEGRAM_CHAT_ID ? 'Configured' : 'Not configured'
      }
    });
  } catch (error) {
    console.error('Error in 7 AM scan test:', error);
    res.status(500).json({ error: 'Failed to start 7 AM scan test' });
  }
});

// Debug DTI scan endpoint - for testing with detailed logging
app.post('/api/debug-dti-scan', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    console.log('🔍 Debug DTI scan triggered by user:', req.user.email);
    
    // Set debug mode environment variable
    process.env.DTI_DEBUG = 'true';
    
    // Use new scanner service for debug scan
    
    console.log('🚀 Starting debug DTI scan with detailed logging...');
    
    if (!stockScanner) {
      throw new Error('Stock Scanner Service not available');
    }
    
    const result = await stockScanner.runGlobalScan(null, {
      entryThreshold: 0,
      takeProfitPercent: 8,
      stopLossPercent: 5,
      maxHoldingDays: 30
    });
    
    const opportunities = result.opportunities || [];
    
    // Reset debug mode
    delete process.env.DTI_DEBUG;
    
    console.log(`✅ Debug scan complete: ${opportunities.length} opportunities found`);
    
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
    console.error('Error in debug DTI scan:', error);
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
    
    console.log(`📤 Backend alerts triggered by user: ${req.user.email} for ${opportunities.length} opportunities`);
    
    // Use scanner service for formatting opportunities message
    const { sendTelegramAlert } = require('./lib/telegram/telegram-bot');
    
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
    
    console.log(`📊 Filtered to ${recentOpportunities.length} opportunities from last 2 trading days`);
    
    if (recentOpportunities.length === 0) {
      // Send "no opportunities" message
      await sendTelegramAlert(process.env.TELEGRAM_CHAT_ID, {
        type: 'custom',
        message: `📊 *Manual Scan Complete*\n\nNo high conviction opportunities from last 2 days found.\n\nScan completed at: ${ukNow.toLocaleString("en-GB", {timeZone: "Europe/London"})}`
      });
    } else {
      // Convert format to match dti-scanner expectations
      const formattedOpportunities = recentOpportunities.map(opp => ({
        stock: opp.stock,
        activeTrade: opp.trade,
        currentPrice: opp.data?.currentPrice || opp.trade.entryPrice
      }));
      
      // Use same message formatting as 7AM scan
      const message = formatOpportunitiesMessage(formattedOpportunities);
      
      // Send via same Telegram system as 7AM scan
      await sendTelegramAlert(process.env.TELEGRAM_CHAT_ID, {
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
    console.error('Error sending backend alerts:', error);
    res.status(500).json({ error: 'Failed to send backend alerts', details: error.message });
  }
});

// Global scan endpoint for scheduled scanner
app.post('/api/scan/global', async (req, res) => {
  try {
    console.log('🌐 Global scan API called:', req.body);
    
    const { scanType, period, source } = req.body;
    
    // Use the new scanner service for global scan
    console.log('🔄 Using Stock Scanner Service for global scan...');
    
    if (!stockScanner) {
      throw new Error('Stock Scanner Service not available');
    }
    
    // Execute with exact same parameters as browser manual scan
    const result = await stockScanner.runGlobalScan(null, {
      entryThreshold: 0,           // Same as browser (DTI < 0)
      takeProfitPercent: 8,        // Same as browser defaults
      stopLossPercent: 5,          // Same as browser defaults
      maxHoldingDays: 30           // Same as browser defaults
    });
    
    const opportunities = result.opportunities || [];
    
    console.log(`📊 Server-side DTI scan complete: ${opportunities.length} total opportunities found`);
    
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
    
    console.log(`📊 Filtered to ${recentOpportunities.length} recent opportunities (last 2 trading days)`);
    
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
    console.error('Error in global scan:', error);
    res.status(500).json({ error: 'Failed to complete scan', details: error.message });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err.stack);
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
  console.log(`\n✓ Server running at http://localhost:${PORT}`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
  console.log(`✓ API test: http://localhost:${PORT}/api/test`);
  
  try {
    const trades = await TradeDB.getAllTrades('default');
    console.log(`\n📊 Database Status:`);
    console.log(`   Total trades: ${trades.length}`);
    console.log(`   Active: ${trades.filter(t => t.status === 'active').length}`);
    console.log(`   Closed: ${trades.filter(t => t.status === 'closed').length}`);
  } catch (error) {
    console.error('   Database error:', error.message);
  }
  
  // Run automatic user recovery on startup
  try {
    await autoRecoverUsers();
  } catch (error) {
    console.error('Error during startup user recovery:', error);
  }
  
  // Run initial alert check
  if (telegramBot) {
    console.log('\n🔔 Alert System: Active');
    checkTradeAlerts();
  }
  
  console.log('\n=================================\n');
});