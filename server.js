const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const session = require('express-session');

// Load environment variables
require('dotenv').config();

console.log('\n=== STARTING NEW APP.JS SERVER ===\n');

// Run diagnostic info on Render
if (process.env.RENDER) {
  console.log('Running on Render - Diagnostic Info:');
  console.log('- Working directory:', process.cwd());
  console.log('- NODE_ENV:', process.env.NODE_ENV);
  console.log('- Checking /var/data:', require('fs').existsSync('/var/data') ? 'EXISTS' : 'NOT FOUND');
}

// Load database
let TradeDB;
try {
  TradeDB = require('./database');
  console.log('✓ Database loaded: better-sqlite3');
} catch (err) {
  try {
    TradeDB = require('./database-sqlite3');
    console.log('✓ Database loaded: sqlite3');
  } catch (err2) {
    try {
      TradeDB = require('./database-json');
      console.log('✓ Database loaded: JSON fallback');
    } catch (err3) {
      console.error('✗ No database module available!');
      process.exit(1);
    }
  }
}

// Load Telegram bot
let telegramBot;
try {
  telegramBot = require('./telegram-bot');
  // Initialize bot if token is provided
  if (process.env.TELEGRAM_BOT_TOKEN || true) { // Remove "|| true" in production
    telegramBot.initializeTelegramBot();
    console.log('✓ Telegram bot initialized');
  } else {
    console.log('ℹ Telegram bot token not found, alerts disabled');
  }
} catch (err) {
  console.log('ℹ Telegram bot module not available:', err.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

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

// Get all trades
app.get('/api/trades', async (req, res) => {
  console.log('>>> /api/trades endpoint hit!');
  try {
    const trades = await TradeDB.getAllTrades();
    console.log(`>>> Returning ${trades.length} trades`);
    res.json(trades);
  } catch (error) {
    console.error('>>> Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get active trades
app.get('/api/trades/active', async (req, res) => {
  try {
    const trades = await TradeDB.getActiveTrades();
    res.json(trades);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get closed trades  
app.get('/api/trades/closed', async (req, res) => {
  try {
    const trades = await TradeDB.getClosedTrades();
    res.json(trades);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get trade by ID
app.get('/api/trades/:id', async (req, res) => {
  try {
    const trade = await TradeDB.getTradeById(req.params.id);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    res.json(trade);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create trade
app.post('/api/trades', async (req, res) => {
  try {
    const trade = await TradeDB.insertTrade(req.body);
    res.status(201).json(trade);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update trade
app.put('/api/trades/:id', async (req, res) => {
  try {
    console.log('>>> UPDATE TRADE REQUEST:', {
      id: req.params.id,
      body: req.body,
      hasEntryPrice: 'entryPrice' in req.body,
      entryPrice: req.body.entryPrice
    });
    
    const success = await TradeDB.updateTrade(req.params.id, req.body);
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
app.delete('/api/trades/:id', async (req, res) => {
  try {
    const success = await TradeDB.deleteTrade(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    res.json({ message: 'Trade deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete all trades
app.delete('/api/trades', async (req, res) => {
  try {
    const count = await TradeDB.deleteAllTrades();
    res.json({ message: `Deleted ${count} trades` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk import
app.post('/api/trades/bulk', async (req, res) => {
  try {
    const { trades } = req.body;
    const count = await TradeDB.bulkInsertTrades(trades);
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
app.post('/api/prices', async (req, res) => {
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
app.get('/api/alerts/preferences', async (req, res) => {
  try {
    const prefs = await TradeDB.getAlertPreferences('default');
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

app.post('/api/alerts/preferences', async (req, res) => {
  try {
    // First, try to create the table if it doesn't exist
    try {
      const db = require('better-sqlite3')('trades.db');
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
      db.close();
      console.log('Alert preferences table created/verified');
    } catch (tableError) {
      console.error('Could not create table:', tableError.message);
    }
    
    const saved = await TradeDB.saveAlertPreferences({
      user_id: 'default',
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
app.post('/api/alerts/test-telegram', async (req, res) => {
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
app.get('/api/alerts/bot-info', async (req, res) => {
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
app.post('/api/alerts/send-custom', async (req, res) => {
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
    
    // Get all active trades
    const activeTrades = await TradeDB.getActiveTrades();
    
    for (const user of alertUsers) {
      if (!user.telegram_enabled || !user.telegram_chat_id) continue;
      
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
    const trades = await TradeDB.getAllTrades();
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