const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const session = require('express-session');
const rateLimit = require('express-rate-limit');

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

// Load Push Notification Service
let pushService;
try {
  const PushService = require('./lib/push/push-service');
  pushService = new PushService(TradeDB);
  console.log('✅ Push Notification Service loaded');
} catch (err) {
  console.warn('⚠️  Push Service not loaded:', err.message);
  pushService = null;
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

// Load Market Cap Updater for 6 AM market cap refresh
let marketCapUpdater;
try {
  marketCapUpdater = require('./lib/scheduler/market-cap-updater');

  // Initialize market cap updates (6 AM UK time, before 7 AM scanner)
  marketCapUpdater.initialize();

  console.log('✅ Market Cap Updater loaded successfully');
} catch (err) {
  console.error('⚠️  Failed to load Market Cap Updater:', err.message);
  marketCapUpdater = null;
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

// Load Capital Manager for capital allocation/release
const CapitalManager = require('./lib/portfolio/capital-manager');

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
// Express 5 leaves req.body undefined when a request has no body (Express 4 gave {}). Handlers
// that destructure it crashed with 500 instead of answering 400: 22 routes, pinned by the
// endpoint harness (tests/endpoints). Restore the Express 4 default.
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});

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

// Telegram webhook secret for verification (prevents spoofed requests)
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

// Rate limiter for Telegram webhook (prevents DoS attacks)
// Telegram sends max 30 updates/second, so we allow 50/second with some buffer
const telegramWebhookLimiter = rateLimit({
  windowMs: 1000, // 1 second window
  max: 50, // Max 50 requests per second
  message: 'Too many webhook requests',
  standardHeaders: true,
  legacyHeaders: false,
});

// IMPORTANT: Telegram webhook must come BEFORE authentication middleware!
// Telegram webhook endpoint for production (NO AUTH REQUIRED but SECRET VERIFIED)
app.post('/api/telegram/webhook', telegramWebhookLimiter, express.json(), (req, res) => {
  // The secret Telegram sends with every update: the bot module's (TELEGRAM_WEBHOOK_SECRET, or one
  // derived from the bot token once Telegram has accepted it), else the environment's alone.
  const expectedSecret = (telegramBot && typeof telegramBot.getWebhookSecret === 'function' && telegramBot.getWebhookSecret())
    || TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
    if (secretHeader !== expectedSecret) {
      console.warn('⚠️ [WEBHOOK] Invalid or missing secret token - rejecting request');
      return res.status(403).send('Forbidden');
    }
  }

  console.log('📨 [WEBHOOK] Received verified update from Telegram');

  try {
    const update = req.body;
    // The update type only: never a user's name or message text: account-link tokens arrive as "/start link_..."
    console.log('📨 [WEBHOOK] Update type:', Object.keys(update).join(', '));

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

// Auth status endpoint (public - no auth required) - MUST be before authentication middleware
app.get('/api/auth/status', (req, res) => {
  // Check if user is authenticated via session
  const isAuthenticated = req.isAuthenticated && req.isAuthenticated();

  if (isAuthenticated) {
    res.json({
      authenticated: true,
      user: {
        email: req.user.email,
        name: req.user.name,
        isAdmin: req.user.email === ADMIN_EMAIL
      }
    });
  } else {
    res.json({
      authenticated: false
    });
  }
});

// Token-guarded read of today's screened signals — for the external AI-analysis
// routine (cloud Claude Code). Registered before the blanket /api auth guard:
// guarded by ANALYSIS_API_TOKEN instead of a Google OAuth session so a
// headless cloud job can read. Read-only.
app.get('/api/signals/screened-today', async (req, res) => {
  try {
    const token = req.query.token || req.get('x-analysis-token');
    if (!process.env.ANALYSIS_API_TOKEN || token !== process.env.ANALYSIS_API_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const today = new Date().toISOString().split('T')[0];
    // All of today's screened signals regardless of status — the AI gate stores
    // non-GO signals as 'dismissed', and the analysis routine should see those
    // too (status + conviction fields tell it what was traded vs filtered).
    const todays = await TradeDB.getSignalsForDate(today);

    const signals = todays.map(s => ({
      symbol: s.symbol,
      market: s.market,
      signalDate: new Date(s.signal_date).toISOString().split('T')[0],
      entryPrice: parseFloat(s.entry_price),
      targetPrice: parseFloat(s.target_price),
      stopLoss: parseFloat(s.stop_loss),
      squareOffDate: s.square_off_date,
      winRate: parseFloat(s.win_rate),
      historicalSignalCount: parseInt(s.historical_signal_count) || 0,
      entryDTI: s.entry_dti != null ? parseFloat(s.entry_dti) : null,
      entry7DayDTI: s.entry_7day_dti != null ? parseFloat(s.entry_7day_dti) : null,
      marketCapUSD: s.market_cap_usd != null ? parseFloat(s.market_cap_usd) : null,
      marketCapRank: s.market_cap_rank != null ? parseInt(s.market_cap_rank) : null,
      status: s.status,
      conviction: s.conviction_verdict ? {
        score: s.conviction_score != null ? parseFloat(s.conviction_score) : null,
        verdict: s.conviction_verdict,
        engine: s.conviction_engine,
        summary: s.conviction_summary,
        checkedAt: s.conviction_checked_at
      } : null
    }));

    res.json({ success: true, date: today, count: signals.length, signals });
  } catch (error) {
    console.error('Error getting screened-today signals:', error);
    res.status(500).json({ error: error.message });
  }
});

// Token-guarded manual scan trigger (ops/testing) — same ANALYSIS_API_TOKEN
// guard as screened-today. Fire-and-forget: responds immediately, the scan
// runs in the background and reports through logs/Telegram as usual.
app.post('/api/scanner/run', (req, res) => {
  const token = req.query.token || req.get('x-analysis-token');
  if (!process.env.ANALYSIS_API_TOKEN || token !== process.env.ANALYSIS_API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!stockScanner) {
    return res.status(503).json({ error: 'Scanner not loaded' });
  }
  if (stockScanner.isScanning) {
    return res.status(409).json({ error: 'Scan already in progress' });
  }
  stockScanner.runHighConvictionScan()
    .then(r => console.log('[MANUAL SCAN] finished:', r && r.success ? `success, alertsSent=${r.alertsSent}` : JSON.stringify(r)))
    .catch(e => console.error('[MANUAL SCAN] failed:', e.message));
  res.json({ success: true, started: true, note: 'Scan running in background — watch logs/Telegram. Typically 15-40 min.' });
});

// Token-guarded one-day trade reset (ops) — undoes a day's AUTO-ADDED bookings:
// releases each trade's capital (P/L 0), deletes the trade, dismisses that
// day's 'added' pending_signals, and removes that day's active HC-portfolio
// rows. Manual trades are never touched. Built to unwind 2026-08-10 (the last
// indicator-only day before the AI conviction gate); kept for future ops.
// Manually start (or check on) the monthly AI conviction sweep.
// Fire-and-forget: responds immediately, the sweep runs in the background;
// progress via GET /api/ml/conviction/sweep-status.
app.post('/api/ops/conviction-sweep', async (req, res) => {
  const token = req.query.token || req.get('x-analysis-token');
  if (!process.env.ANALYSIS_API_TOKEN || token !== process.env.ANALYSIS_API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const { runConvictionSweep, getSweepStatus } = require('./ml/conviction-sweep');
    const current = getSweepStatus();
    if (current.running) {
      return res.status(409).json({ started: false, reason: 'Sweep already running', sweep: current });
    }
    runConvictionSweep().catch(err => console.error('❌ [AI SWEEP] Background run failed:', err.message));
    res.json({ started: true, note: 'Sweep running in background — poll /api/ml/conviction/sweep-status' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Token-guarded, READ-ONLY probe for the AI verdict store (conviction_daily).
// Counts and dates only. Answers "did the monthly sweep really re-score the
// universe?": a genuine sweep is a universe-sized spike on one date, verdicts
// scored on demand are a smear of small counts. ?days=N widens the history;
// ?day=YYYY-MM-DD adds that date's writes per 10 minutes (how a run ended).
app.get('/api/ops/conviction-stats', async (req, res) => {
  const token = req.query.token || req.get('x-analysis-token');
  if (!process.env.ANALYSIS_API_TOKEN || token !== process.env.ANALYSIS_API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const { getVerdictStats, getSweepStatus } = require('./ml/conviction-sweep');
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 120, 1), 730);
    const day = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.day || '')) ? req.query.day : null;
    res.json({ success: true, sweep: getSweepStatus(), ...(await getVerdictStats(days, { day })) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/ops/reset-day-trades', async (req, res) => {
  const token = req.query.token || req.get('x-analysis-token');
  if (!process.env.ANALYSIS_API_TOKEN || token !== process.env.ANALYSIS_API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    }

    const { rows: trades } = await TradeDB.pool.query(`
      SELECT id, symbol, market, user_id, entry_price,
             COALESCE(trade_size, investment_amount) AS size
      FROM trades
      WHERE status = 'active' AND auto_added = true AND signal_date = $1
    `, [date]);

    const deletedTrades = [];
    for (const t of trades) {
      if (t.size != null && parseFloat(t.size) > 0) {
        await TradeDB.releaseCapital(t.market, parseFloat(t.size), 0, t.user_id);
      }
      await TradeDB.pool.query('DELETE FROM trades WHERE id = $1', [t.id]);
      deletedTrades.push({ id: t.id, symbol: t.symbol, market: t.market, size: t.size != null ? parseFloat(t.size) : null });
      console.log(`[RESET ${date}] Deleted trade ${t.id} ${t.symbol} (${t.market}), released ${t.size}`);
    }

    const { rows: dismissedSignals } = await TradeDB.pool.query(`
      UPDATE pending_signals
      SET status = 'dismissed', dismissed_at = CURRENT_TIMESTAMP
      WHERE signal_date = $1 AND status = 'added'
      RETURNING symbol
    `, [date]);

    const { rows: deletedHC } = await TradeDB.pool.query(`
      DELETE FROM high_conviction_portfolio
      WHERE signal_date = $1 AND status = 'active'
      RETURNING symbol
    `, [date]);

    const userIds = [...new Set(trades.map(t => t.user_id))];
    const capitalAfter = userIds.length > 0
      ? (await TradeDB.pool.query(
          `SELECT user_id, market, allocated_capital, available_capital, active_positions
           FROM portfolio_capital WHERE user_id = ANY($1) ORDER BY market`, [userIds])).rows
      : [];

    console.log(`[RESET ${date}] Done: ${deletedTrades.length} trades, ${dismissedSignals.length} signals dismissed, ${deletedHC.length} HC rows`);
    res.json({
      success: true,
      date,
      deletedTrades,
      signalsDismissed: dismissedSignals.map(r => r.symbol),
      hcPositionsDeleted: deletedHC.map(r => r.symbol),
      capitalAfter
    });
  } catch (error) {
    console.error('[RESET] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Token-guarded capital-ledger reconciliation. Recomputes portfolio_capital
// from the trades table (auto trades only — manual trades never allocate) and
// reports the drift. Dry-run by default; pass ?apply=true to write.
app.post('/api/ops/reconcile-capital', async (req, res) => {
  const token = req.query.token || req.get('x-analysis-token');
  if (!process.env.ANALYSIS_API_TOKEN || token !== process.env.ANALYSIS_API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const apply = req.query.apply === 'true';

    const { rows } = await TradeDB.pool.query(`
      SELECT pc.user_id, pc.market, pc.currency,
             pc.initial_capital::float,
             pc.realized_pl::float        AS ledger_realized,
             pc.allocated_capital::float  AS ledger_allocated,
             pc.available_capital::float  AS ledger_available,
             pc.active_positions          AS ledger_positions,
             COALESCE(t.realized, 0)::float  AS trades_realized,
             COALESCE(t.allocated, 0)::float AS trades_allocated,
             COALESCE(t.open_count, 0)::int  AS trades_positions
      FROM portfolio_capital pc
      LEFT JOIN (
        SELECT user_id, market,
               SUM(CASE WHEN status = 'closed' THEN COALESCE(
                     profit_loss,
                     (exit_price - entry_price) * shares,
                     COALESCE(investment_amount, trade_size) * profit_loss_percentage / 100,
                     0) ELSE 0 END) AS realized,
               SUM(CASE WHEN status = 'active' THEN COALESCE(investment_amount, trade_size, 0) ELSE 0 END) AS allocated,
               COUNT(*) FILTER (WHERE status = 'active') AS open_count
        FROM trades
        WHERE auto_added = true AND market IS NOT NULL
        GROUP BY user_id, market
      ) t ON t.user_id = pc.user_id AND t.market = pc.market
      ORDER BY pc.user_id, pc.market
    `);

    const report = rows.map(r => {
      const targetAvailable = r.initial_capital + r.trades_realized - r.trades_allocated;
      return {
        user_id: r.user_id,
        market: r.market,
        currency: r.currency,
        before: {
          realized: r.ledger_realized,
          allocated: r.ledger_allocated,
          available: r.ledger_available,
          positions: r.ledger_positions
        },
        after: {
          realized: r.trades_realized,
          allocated: r.trades_allocated,
          available: targetAvailable,
          positions: r.trades_positions
        },
        drift: {
          realized: +(r.trades_realized - r.ledger_realized).toFixed(2),
          allocated: +(r.trades_allocated - r.ledger_allocated).toFixed(2),
          positions: r.trades_positions - r.ledger_positions
        }
      };
    });

    if (apply) {
      for (const r of report) {
        await TradeDB.pool.query(`
          UPDATE portfolio_capital
          SET realized_pl = $1,
              allocated_capital = $2,
              available_capital = initial_capital + $1 - $2,
              active_positions = $3,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $4 AND market = $5
        `, [r.after.realized, r.after.allocated, r.after.positions, r.user_id, r.market]);
        console.log(`[RECONCILE] ${r.user_id}/${r.market}: realized ${r.before.realized} → ${r.after.realized}, allocated ${r.before.allocated} → ${r.after.allocated}, positions ${r.before.positions} → ${r.after.positions}`);
      }
    }

    res.json({ success: true, applied: apply, markets: report });
  } catch (error) {
    console.error('[RECONCILE] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Token-guarded deploy/version probe — Render injects RENDER_GIT_COMMIT, so
// this answers "which commit is actually live?" after a push.
app.get('/api/ops/version', (req, res) => {
  const token = req.query.token || req.get('x-analysis-token');
  if (!process.env.ANALYSIS_API_TOKEN || token !== process.env.ANALYSIS_API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({
    success: true,
    commit: process.env.RENDER_GIT_COMMIT || null,
    node: process.version,
    uptimeSeconds: Math.round(process.uptime())
  });
});

// Token-guarded, READ-ONLY probe for the Alerts page switches (alert_preferences).
// Counts only — no emails, no chat ids. No sender reads this table today, so
// this answers "who would honouring it affect?" BEFORE anything does:
// telegram_enabled DEFAULTs false and the page POSTs the whole object, so a
// stored false is not proof of an opt-out — `audience.masterOff` is how many
// linked subscribers a naive master-switch check would silence.
app.get('/api/ops/alert-prefs-stats', async (req, res) => {
  const token = req.query.token || req.get('x-analysis-token');
  if (!process.env.ANALYSIS_API_TOKEN || token !== process.env.ANALYSIS_API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const pool = TradeDB.pool;
    const adminEmail = process.env.ADMIN_EMAIL || 'ketanjoshisahs@gmail.com';
    const toNumbers = (row) => Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, /^\d+$/.test(String(value)) ? Number(value) : value])
    );

    const { rows: [table] } = await pool.query(`
      SELECT count(*) AS "rows",
             count(*) FILTER (WHERE telegram_enabled) AS "masterOn",
             count(*) FILTER (WHERE telegram_enabled IS NOT TRUE) AS "masterOff",
             count(*) FILTER (WHERE alert_on_buy IS FALSE) AS "buyOff",
             count(*) FILTER (WHERE alert_on_target IS FALSE) AS "targetOff",
             count(*) FILTER (WHERE alert_on_stoploss IS FALSE) AS "stoplossOff",
             count(*) FILTER (WHERE alert_on_time_exit IS FALSE) AS "timeExitOff",
             count(*) FILTER (WHERE telegram_chat_id IS NOT NULL) AS "legacyChatIdSet",
             min(updated_at) AS "oldestUpdate",
             max(updated_at) AS "newestUpdate"
      FROM alert_preferences
    `);

    // The audience: everyone who can receive a personal DM today — a linked
    // Telegram (users.telegram_chat_id) and not the admin, whose trades
    // broadcast publicly instead
    const { rows: [audience] } = await pool.query(`
      SELECT count(*) AS "linkedNonAdmin",
             count(*) FILTER (WHERE u.auto_trading_enabled) AS "autoTrading",
             count(ap.user_id) AS "withPrefsRow",
             count(*) FILTER (WHERE ap.user_id IS NULL) AS "withoutPrefsRow",
             count(*) FILTER (WHERE ap.user_id IS NOT NULL AND ap.telegram_enabled IS NOT TRUE) AS "masterOff",
             count(*) FILTER (WHERE ap.alert_on_buy IS FALSE) AS "buyOff",
             count(*) FILTER (WHERE ap.alert_on_target IS FALSE) AS "targetOff",
             count(*) FILTER (WHERE ap.alert_on_stoploss IS FALSE) AS "stoplossOff",
             count(*) FILTER (WHERE ap.alert_on_time_exit IS FALSE) AS "timeExitOff"
      FROM users u
      LEFT JOIN alert_preferences ap ON ap.user_id = u.email
      WHERE u.telegram_chat_id IS NOT NULL AND u.email <> $1
    `, [adminEmail]);

    const { rows: [open] } = await pool.query(`
      SELECT count(DISTINCT t.user_id) AS "owners",
             count(*) AS "positions"
      FROM trades t
      JOIN users u ON u.email = t.user_id
      WHERE t.status = 'active' AND u.telegram_chat_id IS NOT NULL AND u.email <> $1
    `, [adminEmail]);

    res.json({
      success: true,
      table: toNumbers(table),
      audience: toNumbers(audience),
      audienceOpenPositions: toNumbers(open)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Token-guarded, READ-ONLY size probe for the two exit-check tables (GAPS #13).
// The exit monitor writes one row per open position per minute and the HC
// manager one per position per 10 minutes, so these are the tables that grow
// with subscriber count. Fixed queries only — nothing here takes SQL from the
// caller. Measures before/after any retention change.
app.get('/api/ops/exit-checks-stats', async (req, res) => {
  const token = req.query.token || req.get('x-analysis-token');
  if (!process.env.ANALYSIS_API_TOKEN || token !== process.env.ANALYSIS_API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const pool = TradeDB.pool;

    // keyColumn is what each table's duplicate-alert guard looks rows up by
    const tableStats = async (table, keyColumn) => {
      // high_conviction_exit_checks comes from a standalone migration, not the
      // boot-time schema, so it may legitimately be absent
      const { rows: [found] } = await pool.query('SELECT to_regclass($1) AS oid', [table]);
      if (!found.oid) {
        return { exists: false };
      }

      const { rows: [size] } = await pool.query(`
        SELECT pg_total_relation_size($1::regclass) AS total_bytes,
               pg_size_pretty(pg_total_relation_size($1::regclass)) AS total,
               pg_size_pretty(pg_relation_size($1::regclass)) AS heap,
               pg_size_pretty(pg_indexes_size($1::regclass)) AS indexes
      `, [table]);

      const { rows: [counts] } = await pool.query(`
        SELECT count(*) AS rows,
               count(*) FILTER (WHERE alert_sent) AS alert_rows,
               count(*) FILTER (WHERE alert_type IS NOT NULL AND NOT alert_sent) AS unsent_exit_rows,
               count(DISTINCT ${keyColumn}) AS distinct_keys,
               count(DISTINCT check_time::date) AS days_with_rows,
               min(check_time) AS oldest,
               max(check_time) AS newest
        FROM ${table}
      `);

      const { rows: perDay } = await pool.query(`
        SELECT to_char(check_time::date, 'YYYY-MM-DD') AS day,
               count(*) AS rows,
               count(DISTINCT ${keyColumn}) AS positions
        FROM ${table}
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT 30
      `);

      const { rows: [vacuum] } = await pool.query(`
        SELECT n_live_tup, n_dead_tup, last_autovacuum, last_autoanalyze
        FROM pg_stat_user_tables
        WHERE relname = $1
      `, [table]);

      const rows = Number(counts.rows);
      const totalBytes = Number(size.total_bytes);
      return {
        exists: true,
        rows,
        alertRows: Number(counts.alert_rows),
        unsentExitRows: Number(counts.unsent_exit_rows),
        routineRows: rows - Number(counts.alert_rows) - Number(counts.unsent_exit_rows),
        distinctKeys: Number(counts.distinct_keys),
        daysWithRows: Number(counts.days_with_rows),
        oldest: counts.oldest,
        newest: counts.newest,
        totalBytes,
        total: size.total,
        heap: size.heap,
        indexes: size.indexes,
        bytesPerRow: rows > 0 ? Math.round(totalBytes / rows) : null,
        liveTuples: vacuum ? Number(vacuum.n_live_tup) : null,
        deadTuples: vacuum ? Number(vacuum.n_dead_tup) : null,
        lastAutovacuum: vacuum ? vacuum.last_autovacuum : null,
        perDay: perDay.map(d => ({ day: d.day, rows: Number(d.rows), positions: Number(d.positions) }))
      };
    };

    const tradeChecks = await tableStats('trade_exit_checks', 'trade_id');
    const hcChecks = await tableStats('high_conviction_exit_checks', 'symbol');

    const { rows: [db] } = await pool.query(`
      SELECT pg_database_size(current_database()) AS bytes,
             pg_size_pretty(pg_database_size(current_database())) AS pretty
    `);
    const { rows: [openTrades] } = await pool.query(`
      SELECT count(*) AS active, count(DISTINCT user_id) AS owners, count(DISTINCT symbol) AS symbols
      FROM trades WHERE status = 'active'
    `);
    const { rows: [openHC] } = await pool.query(`
      SELECT count(*) AS active FROM high_conviction_portfolio WHERE status = 'active'
    `);

    // The HC guard is keyed by SYMBOL, so an alert row left by an earlier trade
    // also matches a later re-entry of the same symbol. List open HC positions
    // that already carry such a row from before they were entered.
    let hcStaleGuards = [];
    if (hcChecks.exists) {
      const { rows } = await pool.query(`
        SELECT p.symbol,
               to_char(p.entry_date, 'YYYY-MM-DD') AS entry_date,
               c.alert_type,
               to_char(max(c.check_time), 'YYYY-MM-DD') AS alerted_on
        FROM high_conviction_portfolio p
        JOIN high_conviction_exit_checks c
          ON c.symbol = p.symbol AND c.alert_sent = true AND c.check_time < p.entry_date
        WHERE p.status = 'active'
        GROUP BY p.symbol, p.entry_date, c.alert_type
        ORDER BY p.symbol
      `);
      hcStaleGuards = rows;
    }

    // Closes the database refused (exit-monitor.js handleCloseFailure). Every
    // failed pass leaves a row with an exit type and alert_sent = false. On a
    // trade that is STILL active such rows mean its close is failing — or was:
    // compare lastFailed with measuredAt. (A trade closed elsewhere leaves one
    // such row too, but it is no longer active, so it is not listed.)
    // ownerTelegramLinked answers "could the owner alert be delivered at all?"
    // — a yes/no only, never the chat id.
    let closeFailureAlerts = { ...require('./lib/portfolio/close-failure-alerts').getConfig() };
    if (tradeChecks.exists) {
      const { rows: [owner] } = await pool.query(
        'SELECT count(*) AS linked FROM users WHERE email = $1 AND telegram_chat_id IS NOT NULL',
        [process.env.ADMIN_EMAIL || 'ketanjoshisahs@gmail.com']
      );
      const { rows: failedCloses } = await pool.query(`
        SELECT c.trade_id, t.symbol, t.market, c.alert_type,
               count(*) AS failed_passes,
               min(c.check_time) AS first_failed,
               max(c.check_time) AS last_failed,
               (array_agg(c.pl_percent ORDER BY c.check_time DESC, c.id DESC))[1] AS last_pl_percent
        FROM trade_exit_checks c
        JOIN trades t ON t.id = c.trade_id
        WHERE c.alert_type IS NOT NULL AND c.alert_sent = false AND t.status = 'active'
        GROUP BY c.trade_id, t.symbol, t.market, c.alert_type
        ORDER BY max(c.check_time) DESC
      `);
      closeFailureAlerts = {
        ...closeFailureAlerts,
        ownerTelegramLinked: Number(owner.linked) > 0,
        failedCloses: failedCloses.map(f => ({
          tradeId: Number(f.trade_id),
          symbol: f.symbol,
          market: f.market,
          exitType: f.alert_type,
          failedPasses: Number(f.failed_passes),
          firstFailed: f.first_failed,
          lastFailed: f.last_failed,
          lastPlPercent: Number(f.last_pl_percent)
        }))
      };
    }

    // The daily rollup the retention job writes before it prunes. The
    // self-check recomputes every complete day that is still fully present in
    // the raw table and counts disagreements with its rollup row; a day whose
    // raw rows have been pruned (fewer rows left than the rollup counted) is
    // reported as pruned, not compared.
    let rollup = { exists: false };
    const { rows: [rollupFound] } = await pool.query(`SELECT to_regclass('trade_exit_checks_daily') AS oid`);
    if (rollupFound.oid && tradeChecks.exists) {
      const { rows: [totals] } = await pool.query(`
        SELECT count(*) AS rows,
               count(DISTINCT trade_id) AS trades,
               to_char(min(day), 'YYYY-MM-DD') AS first_day,
               to_char(max(day), 'YYYY-MM-DD') AS last_day,
               coalesce(sum(checks), 0) AS checks_summarised,
               pg_size_pretty(pg_total_relation_size('trade_exit_checks_daily')) AS total
        FROM trade_exit_checks_daily
      `);
      const { rows: [verdict] } = await pool.query(`
        WITH raw AS (
          SELECT trade_id, check_time::date AS day, count(*) AS checks,
                 max(current_price) AS high_price, min(current_price) AS low_price,
                 max(pl_percent) AS high_pl, min(pl_percent) AS low_pl
          FROM trade_exit_checks
          WHERE check_time < CURRENT_DATE
          GROUP BY 1, 2
        )
        SELECT count(*) FILTER (WHERE d.trade_id IS NULL) AS not_rolled_up,
               count(*) FILTER (WHERE raw.checks = d.checks) AS verified,
               count(*) FILTER (WHERE raw.checks = d.checks
                                  AND (raw.high_price <> d.high_price OR raw.low_price <> d.low_price
                                       OR raw.high_pl <> d.high_pl_percent OR raw.low_pl <> d.low_pl_percent)) AS mismatched,
               count(*) FILTER (WHERE raw.checks > d.checks) AS grew_after_rollup,
               count(*) FILTER (WHERE raw.checks < d.checks) AS pruned
        FROM raw
        LEFT JOIN trade_exit_checks_daily d ON d.trade_id = raw.trade_id AND d.day = raw.day
      `);
      rollup = {
        exists: true,
        rows: Number(totals.rows),
        trades: Number(totals.trades),
        firstDay: totals.first_day,
        lastDay: totals.last_day,
        checksSummarised: Number(totals.checks_summarised),
        total: totals.total,
        selfCheck: {
          notRolledUp: Number(verdict.not_rolled_up),
          verified: Number(verdict.verified),
          mismatched: Number(verdict.mismatched),
          grewAfterRollup: Number(verdict.grew_after_rollup),
          pruned: Number(verdict.pruned)
        }
      };
    }

    res.json({
      success: true,
      measuredAt: new Date().toISOString(),
      rollup,
      database: { bytes: Number(db.bytes), pretty: db.pretty },
      openPositions: {
        trades: Number(openTrades.active),
        tradeOwners: Number(openTrades.owners),
        tradeSymbols: Number(openTrades.symbols),
        highConviction: Number(openHC.active)
      },
      closeFailureAlerts,
      tradeExitChecks: tradeChecks,
      highConvictionExitChecks: hcChecks,
      hcStaleGuards
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Token-guarded manual run of the exit-check retention job — the same job the
// 11:20 PM UK cron runs: roll complete days up into trade_exit_checks_daily,
// then prune minute rows older than the window (never alert rows). Pass
// dryRun=true to only report; EXIT_CHECK_PRUNE=false on the server is the kill
// switch and turns every run into a dry run.
app.post('/api/ops/prune-exit-checks', async (req, res) => {
  const token = req.query.token || req.get('x-analysis-token');
  if (!process.env.ANALYSIS_API_TOKEN || token !== process.env.ANALYSIS_API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { pruneExitChecks } = require('./lib/portfolio/exit-check-retention');
  const result = await pruneExitChecks({ dryRun: req.query.dryRun === 'true' });
  res.status(result.error ? 500 : 200).json({ success: !result.error, ...result });
});

// Token-guarded manual EOD-summary trigger (ops/testing) — same job the
// 7 PM UK cron runs. Fire-and-forget.
app.post('/api/ops/eod-summary', (req, res) => {
  const token = req.query.token || req.get('x-analysis-token');
  if (!process.env.ANALYSIS_API_TOKEN || token !== process.env.ANALYSIS_API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const eodSummary = require('./lib/portfolio/eod-summary');
  eodSummary.sendEODSummary()
    .then(r => console.log('[MANUAL EOD] finished:', JSON.stringify(r)))
    .catch(e => console.error('[MANUAL EOD] failed:', e.message));
  res.json({ success: true, started: true, note: 'EOD summary running in background — watch logs/Telegram.' });
});

// Protect all API routes except auth routes and telegram webhook
app.use('/api', ensureAuthenticatedAPI);

// ML routes
try {
  const mlRoutes = require('./ml/ml-routes');
  app.use('/api/ml', mlRoutes);
} catch (error) {
  console.error('\u2717 Failed to load ML routes:', error.message);
}

// Everything under /api/admin needs an admin, whether or not routes/admin.js
// loads. The inline /api/admin/* routes further down used to rely on that
// router's middleware alone: had it failed to load, they would have been open
// to any signed-in account. If the admin check itself cannot load, the whole
// admin API answers 503 - closed, never open.
let requireAdmin;
try {
  requireAdmin = require('./middleware/admin-auth').ensureAdminAPI;
} catch (error) {
  console.error('✗ Failed to load admin auth - the admin API is closed:', error.message);
  requireAdmin = (req, res) => res.status(503).json({ success: false, error: 'Admin API unavailable' });
}
app.use('/api/admin', requireAdmin);

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

// Admin routes - restricted to specific admin email

// The admin portal (public/admin-v2.html) — /admin is the only admin URL;
// the legacy /admin-portal and /admin-v2 paths redirect here.
app.get('/admin', ensureAuthenticated, (req, res) => {
  if (process.env.ADMIN_DEV_BYPASS === 'true' && process.env.NODE_ENV !== 'production') {
    return res.sendFile(path.join(__dirname, 'public', 'admin-v2.html'));
  }
  if (req.user?.email !== ADMIN_EMAIL) {
    return res.status(403).send('Access denied. Admin privileges required.');
  }
  res.sendFile(path.join(__dirname, 'public', 'admin-v2.html'));
});

app.get(['/admin-portal', '/admin-v2'], (req, res) => {
  res.redirect(301, '/admin');
});

// API endpoint to get all Telegram subscribers (admin only)
app.get('/api/admin/subscribers', ensureAuthenticatedAPI, async (req, res) => {
  // Check if user is admin (ADMIN_DEV_BYPASS covers local no-auth dev, never production)
  const devBypass = process.env.ADMIN_DEV_BYPASS === 'true' && process.env.NODE_ENV !== 'production';
  if (!devBypass && (!req.user || req.user.email !== ADMIN_EMAIL)) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  try {
    // Get all subscribers (both active and inactive) with linked-account info
    const subscribers = await TradeDB.getAllSubscribersWithLinks();

    res.json({
      success: true,
      total: subscribers.length,
      active: subscribers.filter(s => s.is_active).length,
      linked: subscribers.filter(s => s.linked_email).length,
      subscribers: subscribers
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subscribers', details: error.message });
  }
});

// Note: /api/admin/users endpoint is now handled by routes/admin.js with proper pagination

// ===== PER-USER AUTO-TRADING =====

// Where the user stands: is the 1 PM engine booking signals to their portfolio?
app.get('/api/user/auto-trading', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const email = req.user ? req.user.email : 'default';
    const status = await TradeDB.getAutoTradingStatus(email);
    res.json({ success: true, enabled: status.enabled, startedAt: status.startedAt });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Flip personal auto-trading on/off. Enabling seeds the paper-capital ledger
// if it is somehow missing; disabling stops NEW entries only — open positions
// keep being managed to their exits.
app.post('/api/user/auto-trading', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    const email = req.user ? req.user.email : 'default';
    const enabled = req.body && req.body.enabled === true;
    const status = await TradeDB.setAutoTrading(email, enabled);
    if (!status) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    console.log(`[AUTO-TRADING] ${email} ${enabled ? 'ENABLED' : 'disabled'} personal auto-trading`);
    res.json({ success: true, enabled: status.enabled, startedAt: status.startedAt });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// The 7 AM scan's recent output — feeds the Scanner page's signals feed
app.get('/api/signals/recent', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const days = Math.min(30, Math.max(1, parseInt(req.query.days, 10) || 7));
    const signals = await TradeDB.getRecentSignals(days);
    res.json({ success: true, days, signals });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// OAuth-Telegram Linking Endpoints
// Generate linking token for current user
app.post('/api/user/generate-telegram-link', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const email = req.user?.email || 'default';
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
    const email = req.user?.email || 'default';
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
    const email = req.user?.email || 'default';
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
app.get('/api/check-subscription-setup', requireAdmin, async (req, res) => {
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

    // Check if trade is being closed (status changing from 'active' to 'closed')
    const isBeingClosed = existingTrade.status === 'active' && req.body.status === 'closed';

    if (isBeingClosed) {
      // Close + capital release in ONE transaction against the live DB row.
      // (The old path released from the pre-update trade object, which lacked
      // investmentAmount/market — it released 0 and leaked the ledger.)
      console.log(`[TRADE UPDATE] Trade ${req.params.id} (${existingTrade.symbol}) closing via closeTradeAndRelease`);
      const closeResult = await TradeDB.closeTradeAndRelease(req.params.id, {
        exitDate: req.body.exitDate,
        exitPrice: req.body.exitPrice,
        profitLoss: req.body.profitLoss,
        profitLossPercent: req.body.profitLossPercentage !== undefined ? req.body.profitLossPercentage : req.body.profitLossPercent,
        exitReason: req.body.exitReason
      }, userId);

      if (!closeResult.closed) {
        return res.status(409).json({ error: 'Trade is no longer active' });
      }
      if (req.body.notes !== undefined) {
        await TradeDB.updateTrade(req.params.id, { notes: req.body.notes }, userId);
      }
      return res.json({ message: 'Trade updated successfully' });
    }

    // Update the trade
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

// Get portfolio capital status
app.get('/api/portfolio/capital', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const userId = req.user?.email || 'default';
    const capital = await TradeDB.getPortfolioCapital(null, userId);

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

// ===== SIGNALS ENDPOINTS =====
// The 7 AM scan stores its signals in process (lib/scanner/signal-store.js).

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

// ============================================
// MARKET CAP API ENDPOINTS
// ============================================

// Get market cap statistics
app.get('/api/admin/market-cap/stats', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const stats = await TradeDB.getMarketCapStats();
    const updaterStatus = marketCapUpdater ? marketCapUpdater.getStatus() : { isInitialized: false };

    res.json({
      stats,
      updater: updaterStatus
    });
  } catch (error) {
    console.error('Error fetching market cap stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Trigger manual market cap refresh (admin only)
app.post('/api/admin/refresh-market-caps', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const { market } = req.body;

    if (!marketCapUpdater) {
      return res.status(503).json({ error: 'Market Cap Updater not available' });
    }

    console.log(`📊 [MARKET CAP] Manual refresh triggered by ${req.user?.email || 'user'}`);

    let result;
    if (market && ['India', 'UK', 'US'].includes(market)) {
      result = await marketCapUpdater.updateMarketCapsByMarket(market);
    } else {
      result = await marketCapUpdater.updateAllMarketCaps();
    }

    res.json({
      success: true,
      message: market ? `Market cap update completed for ${market}` : 'Full market cap update completed',
      ...result
    });
  } catch (error) {
    console.error('Error refreshing market caps:', error);
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

    // Recent auto-executions (last 7 days) — shown when today is quiet
    const recentTrades = await TradeDB.pool.query(`
      SELECT
        symbol,
        market,
        entry_date,
        entry_price,
        trade_size,
        win_rate,
        signal_date
      FROM trades
      WHERE entry_date >= NOW() - INTERVAL '7 days'
        AND auto_added = true
      ORDER BY entry_date DESC
      LIMIT 25
    `);

    res.json({
      success: true,
      today,
      executionLogs: logs,
      todayTrades: todayTrades.rows,
      recentTrades: recentTrades.rows
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

const { repairYahooChartResult, describeReport, isRepairEnabled: isPriceUnitRepairEnabled } = require('./lib/shared/price-unit-repair');
const unitRepairsLogged = new Set();
const staleFillRepair = require('./lib/shared/stale-fill-repair');
const staleFillsLogged = new Set();

// Yahoo Finance proxy - Historical data
app.get('/yahoo/history', async (req, res) => {
  try {
    const { symbol, period1, period2, interval } = req.query;
    
    if (!symbol) {
      return res.status(400).send('Symbol is required');
    }
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
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
    let quotes = result.indicators.quote[0] || {};
    let adjclose = result.indicators.adjclose ? result.indicators.adjclose[0].adjclose : null;
    // The series in ONE unit, whether or not that repair is the one being served
    let unitView = null;

    // Yahoo steps some lines (mostly London) between pence and pounds inside one series,
    // which a backtest reads as -99% / +9900% days. Every history consumer - scanner,
    // simulator, charts, ML - reads this route, so it is the one place to repair it.
    // Detect-only until PRICE_UNIT_REPAIR=true: applying it changes which stocks clear
    // the scanner's >75% win-rate bar, and that is the owner's call.
    try {
      const unitRepair = repairYahooChartResult(result);
      if (unitRepair.report.status !== 'clean') {
        const enabled = isPriceUnitRepairEnabled();
        const applied = enabled && unitRepair.report.status === 'repaired';
        if (unitRepair.report.status === 'repaired') {
          unitView = { quote: unitRepair.quote, adjclose: unitRepair.adjclose, served: applied };
        }
        if (applied) {
          quotes = unitRepair.quote;
          adjclose = unitRepair.adjclose;
        }
        const summary = `${describeReport(unitRepair.report)}; applied=${applied}`;
        res.set('X-Price-Unit-Repair', summary);
        if (!unitRepairsLogged.has(symbol)) {
          unitRepairsLogged.add(symbol);
          console.log(`[yahoo/history] ${symbol} price units: ${summary}`);
        }
      }
    } catch (repairError) {
      console.warn(`[yahoo/history] ${symbol} price-unit repair failed, serving raw data: ${repairError.message}`);
    }

    // A rarer artefact the unit repair cannot see: no-trade days filled with a price no
    // trade ever printed (HOME.L shows its 38.05p suspension price between trades at 10p).
    // It is judged on the one-unit view so the two repairs never claim the same bar, which
    // also means it can only be served on top of that view. Detect-only until
    // STALE_FILL_REPAIR=true, for the same reason: it changes what the scanner selects.
    try {
      const staleFills = staleFillRepair.repairYahooChartStaleFills(result, unitView);
      if (staleFills.report.status !== 'clean') {
        const onServedView = !unitView || unitView.served;
        const applied = staleFillRepair.isRepairEnabled() && staleFills.report.status === 'repaired' && onServedView;
        if (applied) {
          quotes = staleFills.quote;
          adjclose = staleFills.adjclose;
        }
        const summary = `${staleFillRepair.describeReport(staleFills.report)}; applied=${applied}`;
        res.set('X-Stale-Fill-Repair', summary);
        if (!staleFillsLogged.has(symbol)) {
          staleFillsLogged.add(symbol);
          console.log(`[yahoo/history] ${symbol} stale fills: ${summary}`);
        }
      }
    } catch (repairError) {
      console.warn(`[yahoo/history] ${symbol} stale-fill repair failed, serving data without it: ${repairError.message}`);
    }

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
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;

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

// Short-lived per-symbol price cache. The Positions page polls every second;
// this keeps our load on Yahoo to at most one request per symbol per second
// (and one shared request across tabs), while still serving fresh ticks.
const livePriceCache = new Map();
const LIVE_PRICE_CACHE_TTL_MS = 1000;

function getCachedPrice(symbol) {
  const entry = livePriceCache.get(symbol);
  if (entry && (Date.now() - entry.at) < LIVE_PRICE_CACHE_TTL_MS) {
    return entry.data;
  }
  return null;
}

function setCachedPrice(symbol, data) {
  livePriceCache.set(symbol, { at: Date.now(), data });
  // Keep the cache from growing unbounded across many symbols
  if (livePriceCache.size > 500) {
    const oldest = livePriceCache.keys().next().value;
    livePriceCache.delete(oldest);
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
        const cached = getCachedPrice(symbol);
        if (cached) {
          priceData[symbol] = cached;
          return;
        }

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
          setCachedPrice(symbol, priceData[symbol]);
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

// The columns TradeDB.saveAlertPreferences writes, besides user_id.
const ALERT_PREFERENCE_FIELDS = [
  'telegram_enabled', 'telegram_chat_id', 'email_enabled', 'email_address',
  'alert_on_buy', 'alert_on_sell', 'alert_on_target', 'alert_on_stoploss',
  'alert_on_time_exit', 'market_open_alert', 'market_close_alert'
];
app.post('/api/alerts/preferences', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    const userId = req.user ? req.user.email : 'default';
    // Only the preference columns come from the body, and user_id comes from
    // the session and is applied last. The body used to be spread after
    // user_id, so a body user_id overwrote another user's row.
    const body = req.body || {};
    const prefs = {};
    for (const key of ALERT_PREFERENCE_FIELDS) {
      if (key in body) prefs[key] = body[key];
    }
    const saved = await TradeDB.saveAlertPreferences({ ...prefs, user_id: userId });
    
    if (saved) {
      res.json({ message: 'Alert preferences saved successfully' });
    } else {
      res.status(500).json({ error: 'Failed to save preferences' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== Push Notification Endpoints ====================

// Get VAPID public key for client
app.get('/api/push/vapid-public-key', (req, res) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(503).json({ error: 'Push notifications not configured' });
  }
  res.json({ publicKey });
});

// Subscribe to push notifications
app.post('/api/push/subscribe', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const { subscription, userAgent } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Invalid subscription data' });
    }

    const userEmail = req.user.email;
    await TradeDB.savePushSubscription(userEmail, subscription, userAgent);

    console.log(`[PUSH] User ${userEmail} subscribed to push notifications`);
    res.json({ success: true, message: 'Subscribed successfully' });
  } catch (error) {
    console.error('[PUSH] Subscribe error:', error.message);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// Unsubscribe from push notifications
app.post('/api/push/unsubscribe', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint required' });
    }

    // Only the caller's own subscription: an endpoint alone used to be enough
    // to remove anyone's.
    await TradeDB.pool.query(
      'DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_email = $2',
      [endpoint, req.user.email]
    );

    console.log(`[PUSH] User ${req.user.email} unsubscribed from push notifications`);
    res.json({ success: true, message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('[PUSH] Unsubscribe error:', error.message);
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

// Get push subscription status for current user
app.get('/api/push/status', ensureAuthenticatedAPI, async (req, res) => {
  try {
    if (!req.user) {
      // Auth disabled (local dev) — report unsubscribed instead of crashing.
      return res.json({ subscribed: false, subscriptions: 0, configured: !!process.env.VAPID_PUBLIC_KEY });
    }
    const userEmail = req.user.email;
    const subscriptions = await TradeDB.countPushSubscriptions(userEmail);
    const hasSubscription = await TradeDB.hasPushSubscription(userEmail);

    res.json({
      subscribed: hasSubscription,
      subscriptions: subscriptions,
      configured: !!process.env.VAPID_PUBLIC_KEY
    });
  } catch (error) {
    console.error('[PUSH] Status error:', error.message);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// Send test push notification
app.post('/api/push/test', ensureAuthenticatedAPI, async (req, res) => {
  try {
    if (!pushService) {
      return res.status(503).json({ error: 'Push service not available' });
    }

    const userEmail = req.user.email;
    const result = await pushService.sendTestNotification(userEmail);

    if (result.sent > 0) {
      res.json({ success: true, message: 'Test notification sent', ...result });
    } else {
      res.status(400).json({
        error: 'No active subscriptions found. Please enable push notifications first.',
        ...result
      });
    }
  } catch (error) {
    console.error('[PUSH] Test notification error:', error.message);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

// Admin endpoint: broadcast notification to all users
app.post('/api/admin/push/broadcast', ensureAuthenticatedAPI, async (req, res) => {
  try {
    // Check if user is admin
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
    if (!adminEmails.includes(req.user.email.toLowerCase())) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!pushService) {
      return res.status(503).json({ error: 'Push service not available' });
    }

    const { title, body, url } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body required' });
    }

    const payload = {
      title,
      body,
      icon: '/images/favicon.PNG',
      badge: '/images/favicon.PNG',
      url: url || '/account',
      requireInteraction: false
    };

    const result = await pushService.broadcast(payload);

    res.json({
      success: true,
      message: `Broadcast sent to ${result.sent} devices`,
      ...result
    });
  } catch (error) {
    console.error('[PUSH] Broadcast error:', error.message);
    res.status(500).json({ error: 'Failed to broadcast' });
  }
});

const { formatUKClock, nextUKWeekdayRun } = require('./lib/shared/date-format');

// Health check with detailed info including cron status
app.get('/health', (req, res) => {
  const healthInfo = {
    status: 'ok',
    version: '3.0',
    auth: authEnabled ? 'enabled' : 'disabled',
    environment: process.env.NODE_ENV || 'development',
    render: !!process.env.RENDER,
    // The store express-session really uses. None is configured, so it is the in-memory default.
    sessionStore: authEnabled ? (sessionConfig && sessionConfig.store ? sessionConfig.store.constructor.name : 'memory') : 'none',
    timestamp: new Date().toISOString()
  };

  // Add cron status if scanner is available
  if (stockScanner) {
    try {
      const scannerStatus = stockScanner.getStatus();
      const now = new Date();

      healthInfo.cron = {
        active: true,
        scheduledJobs: scannerStatus.scheduledJobs,
        telegramConfigured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
        currentUKTime: formatUKClock(now),
        nextScheduledRun: nextUKWeekdayRun(now, 7), // the 7 AM scan
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

// Favicon
app.get('/favicon.ico', (req, res) => {
  res.sendStatus(204);
});

// lib/ is server source. Only the few files the pages load are served (the browser
// backtests with the server's own code), and only to signed-in users, like the pages.
const { browserLib } = require('./middleware/browser-lib');
app.use('/lib', ensureAuthenticated, browserLib(path.join(__dirname, 'lib')));

// Root route - serve landing page for unauthenticated users, redirect to dashboard for authenticated users
app.get('/', (req, res) => {
  if (authEnabled && req.isAuthenticated()) {
    // Authenticated users go to dashboard
    res.redirect('/index.html');
  } else {
    // Unauthenticated users see landing page
    res.sendFile(path.join(__dirname, 'public', 'landing.html'));
  }
});

// Protect static files except the public pages and their assets
app.use((req, res, next) => {
  // Allow access to the public marketing surface (landing, pricing, sign-in,
  // legal pages), its design-system assets and PWA assets without
  // authentication
  if (req.path === '/landing.html' ||
      req.path === '/login.html' ||
      req.path === '/pricing.html' ||
      req.path === '/terms.html' ||
      req.path === '/privacy.html' ||
      req.path === '/data-management.html' ||
      req.path === '/css/marketing.css' ||
      req.path === '/css/commerce.css' ||
      req.path === '/js/legal-doc.js' ||
      req.path === '/js/data-page.js' ||
      req.path.startsWith('/css/design-system/') ||
      req.path === '/js/marketing.js' ||
      req.path === '/service-worker.js' ||
      req.path === '/manifest.json' ||
      req.path === '/js/push-notifications.js' ||
      req.path.startsWith('/images/')) {
    return next();
  }
  // The admin portal's HTML is admin-only even as a static file
  if (req.path === '/admin-v2.html' || req.path === '/admin.html') {
    if (req.user?.email === (process.env.ADMIN_EMAIL || 'ketanjoshisahs@gmail.com')) return next();
    return res.redirect('/');
  }
  // All other static files require authentication
  ensureAuthenticated(req, res, next);
});

// Static files (MUST BE LAST!)
// Disable automatic index.html serving - we handle root route explicitly above
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

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

    // Closed by row id and only while still active. If the automatic exit pass
    // closed this position between the lookup above and here, nothing comes
    // back — it has already sent the alert, so this request must not send another
    const result = await TradeDB.closeHighConvictionTrade(trade.id, exitData);
    if (!result) {
      return res.status(409).json({ error: 'Trade was already closed - no alert sent' });
    }

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
    const alert = await stockScanner.portfolioManager.sendExitAlert(closure);

    res.json({ success: true, trade: result, alertSent: Boolean(alert && alert.success), alertDeliveredTo: alert ? alert.subscribers : 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(`[ERROR HANDLER] ${req.method} ${req.path}:`, err.status || '', err.message, err.stack ? '\n' + err.stack.split('\n').slice(0, 4).join('\n') : '');
  res.status(err.status || 500).json({
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
const server = app.listen(PORT, async () => {

  // Run migration for trade_alerts_sent table on startup
  try {
    console.log('🔧 [MIGRATION] Checking trade_alerts_sent table...');

    // Check if table exists
    const tableCheck = await TradeDB.pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'trade_alerts_sent'
    `);

    if (tableCheck.rows.length === 0) {
      console.log('🔧 [MIGRATION] Creating trade_alerts_sent table...');

      // Create table
      await TradeDB.pool.query(`
        CREATE TABLE IF NOT EXISTS trade_alerts_sent (
          id SERIAL PRIMARY KEY,
          trade_id INTEGER NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          alert_type VARCHAR(50) NOT NULL,
          current_price DECIMAL(15, 2),
          pl_percent DECIMAL(10, 2),
          sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_trade_alert UNIQUE(trade_id, user_id, alert_type)
        )
      `);

      // Create indexes
      await TradeDB.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_trade_alerts_trade_user
        ON trade_alerts_sent(trade_id, user_id, alert_type)
      `);
      await TradeDB.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_trade_alerts_sent_at
        ON trade_alerts_sent(sent_at DESC)
      `);

      // Add comments
      await TradeDB.pool.query(`
        COMMENT ON TABLE trade_alerts_sent IS 'Tracks sent Telegram alerts to prevent duplicates from checkTradeAlerts() function'
      `);

      console.log('✅ [MIGRATION] trade_alerts_sent table created successfully');
    } else {
      console.log('✅ [MIGRATION] trade_alerts_sent table already exists');
    }
  } catch (error) {
    console.error('❌ [MIGRATION] Failed to create trade_alerts_sent table:', error.message);
  }

  // Run migration to fix missing shares and profit_loss values
  try {
    console.log('🔧 [MIGRATION] Fixing missing shares and profit_loss values...');

    // Step 1: Calculate and populate shares for trades where shares is NULL
    const sharesUpdate = await TradeDB.pool.query(`
      UPDATE trades
      SET shares = trade_size / entry_price
      WHERE shares IS NULL
        AND trade_size IS NOT NULL
        AND entry_price IS NOT NULL
        AND entry_price > 0
      RETURNING id, symbol, trade_size, entry_price, shares
    `);

    if (sharesUpdate.rows.length > 0) {
      console.log(`✅ [MIGRATION] Updated ${sharesUpdate.rows.length} trades with calculated shares`);
    }

    // Step 2: Populate investment_amount where missing
    const investmentUpdate = await TradeDB.pool.query(`
      UPDATE trades
      SET investment_amount = trade_size
      WHERE investment_amount IS NULL
        AND trade_size IS NOT NULL
      RETURNING id, symbol
    `);

    if (investmentUpdate.rows.length > 0) {
      console.log(`✅ [MIGRATION] Updated ${investmentUpdate.rows.length} trades with investment_amount`);
    }

    // Step 3: Calculate and populate profit_loss for closed trades
    const profitLossUpdate = await TradeDB.pool.query(`
      UPDATE trades
      SET profit_loss = (exit_price - entry_price) * shares
      WHERE status = 'closed'
        AND profit_loss IS NULL
        AND exit_price IS NOT NULL
        AND entry_price IS NOT NULL
        AND shares IS NOT NULL
      RETURNING id, symbol, profit_loss, profit_loss_percentage
    `);

    if (profitLossUpdate.rows.length > 0) {
      console.log(`✅ [MIGRATION] Updated ${profitLossUpdate.rows.length} closed trades with profit_loss`);
      profitLossUpdate.rows.forEach(row => {
        const plValue = parseFloat(row.profit_loss).toFixed(2);
        const plPercent = row.profit_loss_percentage ? parseFloat(row.profit_loss_percentage).toFixed(2) : 'N/A';
        console.log(`   - ${row.symbol} (ID ${row.id}): $${plValue} (${plPercent}%)`);
      });
    }

    console.log('✅ [MIGRATION] Shares and profit_loss migration completed');
  } catch (error) {
    console.error('❌ [MIGRATION] Failed to fix shares and profit_loss:', error.message);
  }

  // Run migration to sync active_positions counters
  try {
    console.log('🔧 [MIGRATION] Syncing active_positions counters...');

    const syncResult = await TradeDB.pool.query(`
      UPDATE portfolio_capital pc
      SET active_positions = (
        SELECT COUNT(*)
        FROM trades t
        WHERE t.status = 'active'
          AND t.user_id = pc.user_id
          AND t.market = pc.market
      )
      WHERE EXISTS (
        SELECT 1
        FROM trades t
        WHERE t.user_id = pc.user_id
          AND t.market = pc.market
          AND t.status = 'active'
        GROUP BY t.user_id, t.market
        HAVING COUNT(*) != pc.active_positions
      )
      RETURNING market, active_positions
    `);

    if (syncResult.rows.length > 0) {
      console.log(`✅ [MIGRATION] Synced ${syncResult.rows.length} market counters:`);
      syncResult.rows.forEach(row => {
        console.log(`   - ${row.market}: updated to ${row.active_positions} active positions`);
      });
    } else {
      console.log('✅ [MIGRATION] All counters already in sync');
    }
  } catch (error) {
    console.error('❌ [MIGRATION] Failed to sync active_positions:', error.message);
  }

  try {
    const trades = await TradeDB.getAllTrades('default');
  } catch (error) {
  }

  // Run automatic user recovery on startup
  try {
    await autoRecoverUsers();
  } catch (error) {
  }

  // Clean up old pending signals on startup
  try {
    console.log('🧹 [STARTUP] Cleaning up old pending signals...');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const result = await TradeDB.pool.query(`
      DELETE FROM pending_signals
      WHERE status = 'pending'
        AND signal_date < $1
      RETURNING symbol, signal_date, market
    `, [yesterdayStr]);

    if (result.rows.length > 0) {
      console.log(`🧹 [STARTUP] Removed ${result.rows.length} old pending signals:`);
      result.rows.forEach(row => {
        console.log(`   - ${row.symbol} (${row.market}) from ${row.signal_date}`);
      });
    } else {
      console.log(`🧹 [STARTUP] No old pending signals to remove`);
    }
  } catch (error) {
    console.error('🧹 [STARTUP] Error cleaning up old signals:', error.message);
  }
  
});

// Process rails (lib/shared/process-guards.js): an unhandled rejection is reported to the owner
// instead of crashing the server (sessions are in memory, so a crash signs everyone out), a crash
// reports before it exits, and a deploy's SIGTERM closes the server and exits within 20 s
require('./lib/shared/process-guards').installProcessGuards({
  server,
  notifyOwner: text => require('./lib/portfolio/close-failure-alerts').notifyOwner(text, {
    TradeDB,
    telegramBot: require('./lib/telegram/telegram-bot')
  })
});
