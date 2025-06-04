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
  telegramBot = require('./telegram-bot');
  // Initialize bot if token is provided
  if (process.env.TELEGRAM_BOT_TOKEN) {
    telegramBot.initializeTelegramBot();
    console.log('✓ Telegram bot initialized');
  } else {
    console.log('ℹ Telegram bot token not found, alerts disabled');
  }
} catch (err) {
  console.log('ℹ Telegram bot module not available:', err.message);
}

// Load Stock Scanner
let stockScanner;
try {
  stockScanner = require('./stock-scanner');
  // Initialize scanner if Telegram bot is available
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    stockScanner.initialize();
    console.log('✓ Stock scanner initialized with daily scans at 7 AM UK time');
  } else {
    console.log('ℹ Stock scanner disabled - Telegram not configured');
  }
} catch (err) {
  console.log('ℹ Stock scanner module not available:', err.message);
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

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (req.url.includes('auth') || req.url === '/') {
    console.log('Session ID:', req.sessionID);
    console.log('Is Authenticated:', req.isAuthenticated ? req.isAuthenticated() : 'N/A');
    console.log('User:', req.user);
  }
  next();
});

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

// Import from export file (admin only)
app.post('/api/admin/import', ensureAuthenticatedAPI, async (req, res) => {
  // Check if user is admin
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  
  try {
    // Import from PostgreSQL export data only
    // Note: This endpoint now requires data to be provided in the request body
    // rather than reading from a static JSON file
    return res.status(400).json({ 
      error: 'JSON file import no longer supported. Please use the database export/import functionality.' 
    });
    console.log(`Importing ${exportData.trades.length} trades from export file`);
    
    // Import trades
    let importedCount = 0;
    for (const trade of exportData.trades) {
      try {
        // Ensure user_id is set correctly
        const userId = trade.user_id || 'default';
        await TradeDB.insertTrade(trade, userId);
        importedCount++;
      } catch (err) {
        console.error(`Failed to import trade ${trade.id}:`, err.message);
      }
    }
    
    // Import alert preferences
    if (exportData.alert_preferences) {
      for (const pref of exportData.alert_preferences) {
        try {
          await TradeDB.saveAlertPreferences(pref);
        } catch (err) {
          console.error('Failed to import alert preference:', err.message);
        }
      }
    }
    
    res.json({ 
      message: `Import complete! Imported ${importedCount} of ${exportData.trades.length} trades`,
      totalTrades: importedCount,
      exportDate: exportData.exportDate
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import from uploaded backup data (admin only)
app.post('/api/admin/import-backup', ensureAuthenticatedAPI, async (req, res) => {
  // Check if user is admin
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  
  try {
    const { trades, alert_preferences } = req.body;
    
    if (!trades || !Array.isArray(trades)) {
      return res.status(400).json({ error: 'Invalid backup data: trades array required' });
    }
    
    console.log(`Importing ${trades.length} trades from uploaded backup`);
    
    // Import trades
    let importedCount = 0;
    for (const trade of trades) {
      try {
        // Debug logging for TBCG.L trade
        if (trade.symbol === 'TBCG.L') {
          console.log('=== TBCG.L BULK IMPORT DEBUG ===');
          console.log('Original trade data:', trade);
        }
        
        // Ensure user_id is set correctly
        const userId = trade.user_id || req.user.email;
        await TradeDB.insertTrade(trade, userId);
        importedCount++;
      } catch (err) {
        console.error(`Failed to import trade ${trade.id}:`, err.message);
        console.error('Trade data:', trade);
      }
    }
    
    // Import alert preferences
    if (alert_preferences && Array.isArray(alert_preferences)) {
      for (const pref of alert_preferences) {
        try {
          await TradeDB.saveAlertPreferences({
            ...pref,
            user_id: pref.user_id || req.user.email
          });
        } catch (err) {
          console.error('Failed to import alert preference:', err.message);
        }
      }
    }
    
    res.json({ 
      message: `Import complete! Imported ${importedCount} of ${trades.length} trades`,
      totalTrades: importedCount,
      userId: req.user.email
    });
  } catch (error) {
    console.error('Import backup error:', error);
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
    
    if (!telegramBot) {
      return res.status(400).json({ error: 'Telegram bot not initialized' });
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
    
    await telegramBot.sendTelegramAlert(chatId, {
      type: 'custom',
      message: formattedMessage
    });
    
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
    
    // Run scan asynchronously
    stockScanner.runGlobalScan(chatId);
    
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
    res.json(status);
  } catch (error) {
    console.error('Error getting scanner status:', error);
    res.status(500).json({ error: 'Failed to get scanner status' });
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
  
  // Run initial alert check
  if (telegramBot) {
    console.log('\n🔔 Alert System: Active');
    checkTradeAlerts();
  }
  
  console.log('\n=================================\n');
});