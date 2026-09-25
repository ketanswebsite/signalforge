const express = require('express');
const path = require('path');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const Input = require('./lib/shared/input');
// Who the admin is (ADMIN_EMAIL): AdminIdentity.isAdmin() is the one definition of "admin"
const AdminIdentity = require('./config/admin');
// The ops tokens (ANALYSIS_API_TOKEN, and ANALYSIS_READ_TOKEN for the read-only GET /api/ops probes)
const { requireOpsToken } = require('./lib/shared/ops-auth');

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

// The paid checkout (Stripe) and its one switch, off unless STRIPE_CHECKOUT=true, STRIPE_SECRET_KEY and
// STRIPE_WEBHOOK_SECRET are all set (config/stripe.js). Off, nothing under /api/stripe exists. On, Stripe's webhook
// comes first: before the JSON parser, because Stripe signs the raw bytes, and before the /api sign-in gate, because
// Stripe has no session and its signature is its only credential. The checkout routes are mounted behind the gate
// further down.
const StripeConfig = require('./config/stripe');
let stripeRoutes = null;
if (StripeConfig.checkoutEnabled()) {
  try {
    stripeRoutes = require('./routes/stripe');
    app.post('/api/stripe/webhook', express.raw({ type: () => true, limit: '1mb' }), stripeRoutes.webhook);
  } catch (error) {
    stripeRoutes = null;
    console.error('✗ The paid checkout is switched on, but its routes failed to load:', error.message);
  }
} else {
  console.log('Paid checkout off: it needs STRIPE_CHECKOUT=true, STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET');
}

// Middleware
// No cors(): every page is served from this origin, and nothing calls this server from a browser
// on another one (the AI routine, Telegram and Stripe call it server to server, where CORS does
// not apply). It answered every response with Access-Control-Allow-Origin: *, so any website's
// scripts could read the anonymous routes - the Yahoo proxy among them - through their visitors.
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
        isAdmin: AdminIdentity.isAdmin(req.user.email)
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
// headless cloud job can read. Read-only, but not an ops probe: the full token
// only (header, or ?token= until the routine sends the header), never the read token.
app.get('/api/signals/screened-today', requireOpsToken({ query: true }), async (req, res) => {
  try {
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
app.post('/api/scanner/run', requireOpsToken({ query: true }), (req, res) => {
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
app.post('/api/ops/conviction-sweep', requireOpsToken({ query: true }), async (req, res) => {
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
app.get('/api/ops/conviction-stats', requireOpsToken({ query: true, read: true }), async (req, res) => {
  try {
    const { getVerdictStats, getSweepStatus } = require('./ml/conviction-sweep');
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 120, 1), 730);
    // A malformed or impossible day (2026-02-30) is ignored, like no day at all
    const day = Input.isoDate(String(req.query.day || ''));
    res.json({ success: true, sweep: getSweepStatus(), ...(await getVerdictStats(days, { day })) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/ops/reset-day-trades', requireOpsToken({ query: true }), async (req, res) => {
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
// The computation is CapitalManager.reconcileReport(), which the nightly drift
// check (lib/portfolio/ledger-drift-check.js, 22:30 UK on weekdays) runs too.
// That check only reports; `nightlyCheck` in the answer is its last run.
app.post('/api/ops/reconcile-capital', requireOpsToken({ query: true }), async (req, res) => {
  try {
    const apply = req.query.apply === 'true';

    const report = await CapitalManager.reconcileReport();

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

    res.json({
      success: true,
      applied: apply,
      markets: report,
      nightlyCheck: require('./lib/portfolio/ledger-drift-check').getStatus()
    });
  } catch (error) {
    console.error('[RECONCILE] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Token-guarded deploy/version probe — Render injects RENDER_GIT_COMMIT, so
// this answers "which commit is actually live?" after a push. Read-only: the read
// token opens it too. adminEmailConfigured says whether ADMIN_EMAIL is set (while it
// is not, config/admin.js falls back to a built-in address), adminEmailMatchesFallback
// whether it names that same account (then the fallback can go); never the address.
// stripeCheckout: the paid checkout's switch and what it needs, as booleans and the key's mode; never a key.
app.get('/api/ops/version', requireOpsToken({ query: true, read: true }), (req, res) => {
  res.json({
    success: true,
    commit: process.env.RENDER_GIT_COMMIT || null,
    node: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    adminEmailConfigured: AdminIdentity.adminEmailConfigured(),
    adminEmailMatchesFallback: AdminIdentity.adminEmailMatchesFallback(),
    stripeCheckout: StripeConfig.checkoutStatus()
  });
});

// Token-guarded (header only), READ-ONLY: the Postgres session store at work
// (lib/shared/pg-session-store.js). Counts only, never a session id or its contents.
app.get('/api/ops/sessions-stats', requireOpsToken({ read: true }), async (req, res) => {
  const store = authEnabled && sessionConfig && sessionConfig.store ? sessionConfig.store.constructor.name : 'memory';
  try {
    const { rows: [probe] } = await TradeDB.pool.query("SELECT to_regclass('public.user_sessions') IS NOT NULL AS exists");
    if (!probe.exists) return res.json({ success: true, store, table: false });
    const { rows: [counts] } = await TradeDB.pool.query(`
      SELECT count(*) FILTER (WHERE expire > NOW())::int AS active,
             count(*) FILTER (WHERE expire <= NOW())::int AS expired
      FROM user_sessions
    `);
    res.json({ success: true, store, table: true, ...counts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Token-guarded (header only), READ-ONLY: what each scheduled job left in the database on one UK day, so a run
// can be checked without its logs (the 1 PM executor keeps its log in memory, and a deploy wipes it). Counts and
// London times only. ?day=YYYY-MM-DD is a UK date; the default is today.
app.get('/api/ops/schedule-stats', requireOpsToken({ read: true }), async (req, res) => {
  const day = req.query.day === undefined
    ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    : require('./lib/shared/input').isoDate(req.query.day);
  if (!day) return res.status(400).json({ error: 'day must be a date written YYYY-MM-DD' });
  // Timestamps without a zone are written in the server's own zone: read them as London time
  const london = column => `((${column}) AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'Europe/London'`;
  const clock = column => `to_char(${london(column)}, 'YYYY-MM-DD HH24:MI:SS')`;
  const rows = (sql, params = [day]) => TradeDB.pool.query(sql, params).then(result => result.rows);
  // The executor's main pass books the house portfolio under the admin's account ('default' is the pre-2026 owner)
  const house = [day, AdminIdentity.adminEmail()];
  try {
    const [scan, opened, [bookings], closed, [exitChecks], [marketCaps], [highConviction]] = await Promise.all([
      // 7 AM scan: the signals it stored for the day, and what the executor made of them
      rows(`SELECT market, status, count(*)::int AS signals, ${clock('min(created_at)')} AS "firstStoredAt", ${clock('max(created_at)')} AS "lastStoredAt"
            FROM pending_signals WHERE signal_date = $1 GROUP BY market, status ORDER BY market, status`),
      // 1 PM executor: automatic trades booked that day, for the house portfolio and for subscribers, by the
      // rules' version they were stamped with (GAPS #14; null = not stamped)
      rows(`SELECT market, CASE WHEN user_id IN ('default', $2) THEN 'house' ELSE 'subscribers' END AS book,
                   strategy_version AS "strategyVersion", count(*)::int AS trades, count(DISTINCT user_id)::int AS accounts
            FROM trades WHERE auto_added = true AND (${london('entry_date')})::date = $1 GROUP BY 1, 2, 3 ORDER BY 1, 2, 3`, house),
      // the same symbol booked twice into one account on one day should never happen
      rows(`SELECT count(*)::int AS "duplicateBookings" FROM (
              SELECT user_id, symbol FROM trades WHERE auto_added = true AND (${london('entry_date')})::date = $1
              GROUP BY user_id, symbol HAVING count(*) > 1) twice`),
      // exit monitor: automatic trades it closed that day, by reason
      rows(`SELECT market, exit_reason AS "exitReason", count(*)::int AS trades
            FROM trades WHERE auto_added = true AND status = 'closed' AND (${london('exit_date')})::date = $1 GROUP BY 1, 2 ORDER BY 1, 2`),
      rows(`SELECT count(*)::int AS checks, ${clock('max(check_time)')} AS "lastCheckAt"
            FROM trade_exit_checks WHERE (${london('check_time')})::date = $1`),
      rows(`SELECT count(*) FILTER (WHERE (${london('last_updated')})::date = $1)::int AS refreshed,
                   ${clock("max(last_updated) FILTER (WHERE (" + london('last_updated') + ")::date = $1)")} AS "lastRefreshAt",
                   count(*)::int AS rows, ${clock('max(last_updated)')} AS "lastRefreshEver"
            FROM stock_market_caps`),
      rows(`SELECT count(*) FILTER (WHERE entry_date = $1)::int AS entered, count(*) FILTER (WHERE exit_date = $1)::int AS exited,
                   count(*) FILTER (WHERE status = 'active')::int AS open, ${clock('max(updated_at)')} AS "lastUpdateAt"
            FROM high_conviction_portfolio`)
    ]);
    // Every named scheduled job's runs that day (lib/shared/job-runs.js); the table appears with the first run
    const { rows: [jobTable] } = await TradeDB.pool.query("SELECT to_regclass('public.job_runs') IS NOT NULL AS present");
    const jobRuns = jobTable.present ? await rows(`
      SELECT job, to_char(started_at AT TIME ZONE 'Europe/London', 'YYYY-MM-DD HH24:MI:SS') AS "startedAt",
             to_char(finished_at AT TIME ZONE 'Europe/London', 'YYYY-MM-DD HH24:MI:SS') AS "finishedAt", ok, summary
      FROM job_runs WHERE (started_at AT TIME ZONE 'Europe/London')::date = $1 ORDER BY started_at`) : [];
    res.json({ success: true, day, scan, executor: { opened, ...bookings }, exitMonitor: { ...exitChecks, closed }, marketCaps, highConviction, jobRuns });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Token-guarded (header only), READ-ONLY: the bot's Telegram messages (GAPS #12, lib/telegram/delivery-counts.js).
// For one UK day (?day=YYYY-MM-DD, default today) the messages sent and not delivered by kind, with Telegram's
// reason for each failure; for the ?days=N UK days up to it (1-90, default 14) the daily totals. Counts only: the
// table holds no chat id and no message text.
app.get('/api/ops/telegram-stats', requireOpsToken({ read: true }), async (req, res) => {
  const DeliveryCounts = require('./lib/telegram/delivery-counts');
  const day = req.query.day === undefined ? DeliveryCounts.ukDay() : Input.isoDate(req.query.day);
  if (!day) return res.status(400).json({ error: 'day must be a date written YYYY-MM-DD' });
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 14, 1), DeliveryCounts.RETENTION_DAYS);
  try {
    res.json({ success: true, ...(await DeliveryCounts.report(TradeDB.pool, { day, days })) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Token-guarded, READ-ONLY probe for the Alerts page switches (alert_preferences).
// Counts only — no emails, no chat ids. The senders read this table since 2026-09-24 (lib/shared/alert-policy.js:
// only an explicit false withholds); this still answers "who does honouring it affect?":
// telegram_enabled DEFAULTs false and the page POSTs the whole object, so a
// stored false is not proof of an opt-out — `audience.masterOff` is how many
// linked subscribers a naive master-switch check would silence.
app.get('/api/ops/alert-prefs-stats', requireOpsToken({ query: true, read: true }), async (req, res) => {
  try {
    const pool = TradeDB.pool;
    const adminEmail = AdminIdentity.adminEmail();
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

// Token-guarded, READ-ONLY size probe for trade_exit_checks (GAPS #13): the exit
// monitor writes one row per open position per minute, so it is the table that
// grows with subscriber count. Fixed queries only — nothing here takes SQL from
// the caller. Measures before/after any retention change. It also counts
// duplicate open positions (duplicateActive), which must read 0 on production
// before a unique index can make one open row per position a database rule.
app.get('/api/ops/exit-checks-stats', requireOpsToken({ query: true, read: true }), async (req, res) => {
  try {
    const pool = TradeDB.pool;

    // keyColumn is what the table's duplicate-alert guard looks rows up by
    const tableStats = async (table, keyColumn) => {
      // Created at boot; a database the server has never initialised has none
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

    // Duplicate open positions: two or more ACTIVE rows for one symbol in one
    // portfolio. In trades that is one user's portfolio: the automatic booking
    // refuses a symbol the user already holds, a manual trade does not. The
    // high-conviction book is a single portfolio with no user column. Nothing in
    // the schema forbids a pair yet; a unique partial index is the follow-up once
    // this reads 0 on production. Row ids only, never whose they are.
    const { rows: tradeDuplicates } = await pool.query(`
      SELECT symbol, array_agg(id ORDER BY id) AS ids,
             count(*) FILTER (WHERE auto_added) AS automatic
      FROM trades
      WHERE status = 'active'
      GROUP BY user_id, symbol
      HAVING count(*) > 1
      ORDER BY symbol, min(id)
    `);
    const { rows: hcDuplicates } = await pool.query(`
      SELECT symbol, array_agg(id ORDER BY id) AS ids
      FROM high_conviction_portfolio
      WHERE status = 'active'
      GROUP BY symbol
      HAVING count(*) > 1
      ORDER BY symbol
    `);
    // The unique indexes on open positions (database-postgres.js, built at boot unless duplicates exist)
    const { rows: uniqueIndexRows } = await pool.query(
      "SELECT indexname FROM pg_indexes WHERE indexname IN ('uq_high_conviction_active_symbol', 'uq_trades_active_auto_symbol')");
    const uniqueIndexNames = uniqueIndexRows.map(r => r.indexname);
    // Open positions in a symbol containing "&" (M&M.NS, J&KBANK.NS, ...). The server's own Yahoo calls sent
    // "?symbol=M&M.NS" unencoded, which parses as "M", so these were priced on another company's chart. Public
    // tickers and row ids only.
    const { rows: ampersandOpen } = await pool.query(`
      SELECT 'trades' AS book, id, symbol, market, entry_price::float AS "entryPrice", auto_added AS automatic
      FROM trades WHERE status = 'active' AND symbol LIKE '%&%'
      UNION ALL
      SELECT 'highConviction', id, symbol, market, entry_price::float, true
      FROM high_conviction_portfolio WHERE status = 'active' AND symbol LIKE '%&%'
      ORDER BY 1, 3, 2
    `);
    // count = duplicated positions; surplusRows = the rows beyond the first of each
    const duplicateSummary = groups => ({
      count: groups.length,
      surplusRows: groups.reduce((sum, g) => sum + g.ids.length - 1, 0),
      groups
    });

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
        [AdminIdentity.adminEmail()]
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
      duplicateActive: {
        trades: duplicateSummary(tradeDuplicates.map(g => ({ symbol: g.symbol, ids: g.ids.map(Number), automatic: Number(g.automatic) }))),
        highConviction: duplicateSummary(hcDuplicates.map(g => ({ symbol: g.symbol, ids: g.ids.map(Number) })))
      },
      ampersandOpen: ampersandOpen.map(r => ({ ...r, id: Number(r.id) })),
      uniqueIndexes: {
        highConvictionActiveSymbol: uniqueIndexNames.includes('uq_high_conviction_active_symbol'),
        tradesActiveAutoSymbol: uniqueIndexNames.includes('uq_trades_active_auto_symbol')
      },
      closeFailureAlerts,
      tradeExitChecks: tradeChecks
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Token-guarded (header only), READ-ONLY: the dead-ticker record (GAPS #10, lib/shared/ticker-health.js). The 7 AM
// scan and the 06:00 market-cap refresh note what Yahoo answered for every symbol they already ask about; this lists
// the symbols Yahoo has stopped serving (dead: 5 "not found" or "no bars" answers in a row over at least 7 days),
// those whose newest bar is over 14 days old (stale) and those failing for another reason, each with its evidence.
// It never calls Yahoo. The scan leaves the dead out only with SKIP_DEAD_TICKERS=true, which is the owner's call.
app.get('/api/ops/dead-tickers', requireOpsToken({ read: true }), async (req, res) => {
  try {
    const report = await require('./lib/shared/ticker-health').report();
    res.json({ success: true, measuredAt: new Date().toISOString(), ...report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Token-guarded (the full token, header only: it asks Yahoo, so never the read token): one fresh Yahoo handshake and
// one quote for three symbols, step by step - what Yahoo answers this server right now. The 06:00 market-cap refresh
// met 429s here on 2026-09-25 while the chart endpoint answered; this names the step. At most seven requests; no
// database writes.
app.post('/api/ops/yahoo-check', requireOpsToken(), async (req, res) => {
  try {
    const report = await require('./lib/shared/yahoo-client').checkSession();
    res.json({ success: true, measuredAt: new Date().toISOString(), ...report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Token-guarded manual run of the exit-check retention job — the same job the
// 11:20 PM UK cron runs: roll complete days up into trade_exit_checks_daily,
// then prune minute rows older than the window (never alert rows). Pass
// dryRun=true to only report; EXIT_CHECK_PRUNE=false on the server is the kill
// switch and turns every run into a dry run.
app.post('/api/ops/prune-exit-checks', requireOpsToken({ query: true }), async (req, res) => {
  const { pruneExitChecks } = require('./lib/portfolio/exit-check-retention');
  const result = await pruneExitChecks({ dryRun: req.query.dryRun === 'true' });
  res.status(result.error ? 500 : 200).json({ success: !result.error, ...result });
});

// Token-guarded manual EOD-summary trigger (ops/testing) — same job the
// 7 PM UK cron runs. Fire-and-forget.
app.post('/api/ops/eod-summary', requireOpsToken({ query: true }), (req, res) => {
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

// The paid checkout's routes (GET /api/stripe/config, POST /api/stripe/create-subscription), behind the sign-in
// gate: mounted with the webhook near the top of this file, by the same switch
if (stripeRoutes) {
  app.use('/api/stripe', stripeRoutes);
  console.log(`✓ Paid checkout on (Stripe ${StripeConfig.checkoutStatus().keyMode} mode)`);
}

// Admin routes - restricted to specific admin email

// The admin portal (public/admin-v2.html) — /admin is the only admin URL;
// the legacy /admin-portal and /admin-v2 paths redirect here.
app.get('/admin', ensureAuthenticated, (req, res) => {
  if (process.env.ADMIN_DEV_BYPASS === 'true' && process.env.NODE_ENV !== 'production') {
    return res.sendFile(path.join(__dirname, 'public', 'admin-v2.html'));
  }
  if (!AdminIdentity.isAdmin(req.user?.email)) {
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
  if (!devBypass && (!req.user || !AdminIdentity.isAdmin(req.user.email))) {
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
    const pool = TradeDB.pool;

    // Get user basic info
    const userResult = await pool.query(
      'SELECT created_at, email, name, last_login FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
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

    // Saved settings, and browsers registered for push notifications
    const settingsResult = await pool.query(
      'SELECT COUNT(*) AS settings FROM user_settings WHERE user_id = $1',
      [email]
    );
    const pushResult = await pool.query(
      'SELECT COUNT(*) AS push_subscriptions FROM push_subscriptions WHERE user_email = $1',
      [email]
    );

    // Determine last activity
    const lastActivity = user.last_login || tradesResult.rows[0]?.last_trade_date || user.created_at;

    res.json({
      created_at: user.created_at,
      email: user.email,
      name: user.name,
      total_trades: parseInt(tradesResult.rows[0]?.total_trades || 0),
      active_signals: parseInt(alertsResult.rows[0]?.active_signals || 0),
      settings: parseInt(settingsResult.rows[0]?.settings || 0),
      push_subscriptions: parseInt(pushResult.rows[0]?.push_subscriptions || 0),
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
    const pool = TradeDB.pool;
    // The subscription and payment tables come from migrations/, not the boot DDL. A table or
    // column this database never got exports as an empty section; any other error fails the download.
    const rowsOf = async (section, sql) => {
      try {
        return (await pool.query(sql, [email])).rows;
      } catch (error) {
        if (error.code !== '42P01' && error.code !== '42703') throw error;   // undefined table / column
        console.warn(`[GDPR] export section ${section} skipped: ${error.message}`);
        return [];
      }
    };

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

    // 4. Settings
    userData.settings = await rowsOf('settings',
      'SELECT setting_key, setting_value, created_at, updated_at FROM user_settings WHERE user_id = $1 ORDER BY setting_key');

    // 5. Browsers registered for push notifications (their encryption keys stay out of the file)
    userData.pushSubscriptions = await rowsOf('pushSubscriptions',
      'SELECT endpoint, user_agent, is_active, created_at, last_used_at FROM push_subscriptions WHERE user_email = $1 ORDER BY created_at');

    // 6. Paper-capital ledgers, one per market
    userData.paperCapital = await rowsOf('paperCapital',
      `SELECT market, currency, initial_capital, realized_pl, allocated_capital, available_capital,
              active_positions, max_positions, updated_at
       FROM portfolio_capital WHERE user_id = $1 ORDER BY market`);

    // 7. Subscriptions: every one the account has had (newest first), their history and any complimentary access
    userData.subscriptions = await rowsOf('subscriptions',
      'SELECT * FROM user_subscriptions WHERE user_email = $1 ORDER BY created_at DESC');
    userData.subscription = userData.subscriptions[0] || null;
    userData.subscriptionHistory = await rowsOf('subscriptionHistory',
      `SELECT event_type, old_status, new_status, description, created_at
       FROM subscription_history WHERE user_email = $1 ORDER BY created_at`);
    userData.accessGrants = await rowsOf('accessGrants',
      `SELECT grant_type, expires_at, reason, granted_at, revoked_at, revoke_reason
       FROM subscription_grants WHERE user_email = $1 ORDER BY granted_at`);

    // 8. Payment history (anonymized sensitive data) and refunds
    userData.paymentHistory = await rowsOf('paymentHistory',
      `SELECT
        transaction_id, amount, currency, status, payment_method,
        payment_date, created_at, updated_at
       FROM payment_transactions
       WHERE user_email = $1
       ORDER BY created_at DESC`);
    userData.refunds = await rowsOf('refunds',
      `SELECT transaction_id, refund_amount, currency, refund_reason, status, refunded_at, created_at
       FROM payment_refunds WHERE user_email = $1 ORDER BY created_at DESC`);

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
    const pool = TradeDB.pool; // the app's one pool (it used to open a new one per call)

    // Get all trades
    const result = await pool.query(
      `SELECT
        symbol, name, entry_date, entry_price, exit_date, exit_price,
        shares, status, profit_loss, profit_loss_percentage,
        entry_reason, exit_reason, target_price, stop_loss_percent,
        investment_amount, currency_symbol, created_at,
        strategy_version, benchmark_symbol, benchmark_return_percent
       FROM trades
       WHERE user_id = $1
       ORDER BY entry_date DESC`,
      [email]
    );


    // Build CSV
    const csvHeader = 'Symbol,Name,Entry Date,Entry Price,Exit Date,Exit Price,Shares,Status,Profit/Loss,Profit/Loss %,Entry Reason,Exit Reason,Target Price,Stop Loss %,Investment Amount,Currency,Created At,Strategy Version,Benchmark,Benchmark Return %\n';

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
        row.created_at ? new Date(row.created_at).toISOString() : '',
        row.strategy_version || '',
        row.benchmark_symbol || '',
        row.benchmark_return_percent ?? ''
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
//
// lib/shared/account-deletion.js does the deletion, as it does for the admin's DELETE
// /api/admin/users/:email: one transaction archives the payment records the law makes us keep
// (6 years), deletes every row the account owns, then the account itself.
const AccountDeletion = require('./lib/shared/account-deletion');
app.delete('/api/user/delete-account', ensureAuthenticatedAPI, async (req, res) => {
  const email = req.user && req.user.email;
  if (!email) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  // The admin account owns the house portfolio (the executor books every signal to it).
  if (AccountDeletion.isProtectedAccount(email)) {
    return res.status(403).json({ error: 'The admin account cannot be deleted from the app' });
  }

  let result;
  try {
    result = await AccountDeletion.deleteAccount({
      pool: TradeDB.pool,
      email,
      requestedBy: email,
      ipAddress: AccountDeletion.clientAddress(req)
    });
  } catch (error) {
    // A paid plan Stripe still renews is ended there first; when Stripe cannot be told, nothing is deleted
    if (error.code === 'PAYMENT_PROVIDER') {
      console.error('Account deletion stopped:', error.message);
      return res.status(502).json({
        error: 'Your paid plan could not be ended with the payment provider, so nothing was deleted. Try again in a few minutes.'
      });
    }
    console.error('Error deleting account:', error);
    return res.status(500).json({
      error: 'Failed to delete account',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }

  // End the account's sessions. The account is already gone, so a failure here is only logged.
  try {
    // passport 0.7's logout saves, then regenerates, the session in callbacks: the session may be
    // destroyed only after it has finished. Destroying it first (as this route did) makes passport's
    // callback throw outside any try/catch, which kills the process.
    if (typeof req.logout === 'function') {
      await new Promise((resolve) => req.logout((err) => {
        if (err) console.error('Error during logout:', err);
        resolve();
      }));
    }
    // Sessions on the account's other devices
    await AccountDeletion.endAccountSessions(req.sessionStore, email);
    if (req.session) {
      await new Promise((resolve) => req.session.destroy(() => resolve()));
    }
  } catch (error) {
    console.error('Error ending sessions after account deletion:', error);
  }

  res.json({
    success: true,
    message: 'Account successfully deleted',
    details: {
      email: email,
      deletionDate: new Date().toISOString(),
      financialRecordsRetained: result.financialRecordsRetained,
      retentionPeriod: result.financialRecordsRetained ? '6 years as required by UK financial regulations' : null
    }
  });
});

// Admin-only: Manually link Telegram to OAuth user
app.post('/api/admin/manual-link', ensureAuthenticatedAPI, async (req, res) => {
  // Check if user is admin
  if (!AdminIdentity.isAdmin(req.user.email)) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  try {
    const { email } = req.body;
    // A whole number, as Telegram issues them: anything else reached the chat_id column and failed with 500
    const chatId = Input.chatId(req.body.chatId);

    if (!email || !chatId) {
      return res.status(400).json({ error: 'Email and a numeric Chat ID are required' });
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
  if (!AdminIdentity.isAdmin(req.user.email)) {
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
  if (!AdminIdentity.isAdmin(req.user.email)) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  try {
    // A whole number, as Telegram issues them: anything else reached the chat_id column and failed with 500
    const chatId = Input.chatId(req.body.chatId);

    if (!chatId) {
      return res.status(400).json({ error: 'A numeric Chat ID is required' });
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

// Auto-recovery function that runs on server startup
async function autoRecoverUsers() {
  try {
    
    const pool = TradeDB.pool; // the app's one pool (it used to open a new one per call)
    
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
    
    // 3. Add known admin user if not present (only when ADMIN_EMAIL names one, as before)
    try {
      const adminEmail = AdminIdentity.adminEmailConfigured() ? AdminIdentity.adminEmail() : null;
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
    
  } catch (error) {
  }
}

// Check subscription setup endpoint
app.get('/api/check-subscription-setup', requireAdmin, async (req, res) => {
  try {
    const pool = TradeDB.pool; // the app's one pool (it used to open a new one per call)

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

// ===== POSITIONS: the trade journal =====
// A trade is its owner's row, but an automatic trade (auto_added) also holds
// capital in portfolio_capital, so every write below keeps the two in step:
// - create and bulk import only ever make manual trades, which never touch the
//   ledger, so no request can mint a position whose close or delete would
//   release capital it never allocated;
// - a close goes through closeTradeAndRelease (one transaction, only while active);
// - an edit writes only the price paid and the notes, and only while active;
// - a delete takes the trade out of the ledger in the same statement.
const TRADE_MARKETS = ['India', 'UK', 'US'];
const MAX_TRADE_AMOUNT = 99999999; // the price and size columns are DECIMAL(12, 4)

// A number above zero (a number, or numeric text) that fits those columns, else null
function tradeAmount(value) {
  const n = typeof value === 'number' ? value
    : (typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN);
  return Number.isFinite(n) && n > 0 && n <= MAX_TRADE_AMOUNT ? n : null;
}

// A point in time written as text (ISO, or a plain YYYY-MM-DD), else null
function tradeDate(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// A percentage above zero that fits its DECIMAL(8, 4) column, else null
function tradePercent(value) {
  const n = tradeAmount(value);
  return n !== null && n < 10000 ? n : null;
}

// The text a manual trade may carry, and the most characters its column holds (0: TEXT, no limit)
const TRADE_TEXT_FIELDS = { name: 255, stockName: 255, currencySymbol: 10, entryReason: 0, exitReason: 0, notes: 0 };

// Why a new manual trade cannot be stored, or null. It checks what the trades
// table would otherwise refuse: the NOT NULL symbol, the status and market
// CHECKs, a closed trade's exit price and date (not before the entry), and every
// amount, percentage, date and text a trade may carry, so a refusal names the
// field (and, on a bulk import, the trade) instead of passing on Postgres's words.
function tradeInputError(t) {
  if (!t || typeof t !== 'object' || Array.isArray(t)) return 'a trade must be a JSON object';
  if (typeof t.symbol !== 'string' || !t.symbol.trim() || t.symbol.trim().length > 50) {
    return 'symbol is required (at most 50 characters)';
  }
  if (tradeAmount(t.entryPrice) === null) return 'entryPrice must be a positive number';
  const entryDate = tradeDate(t.entryDate);
  if (!entryDate) return 'entryDate must be a date';
  if (t.shares && tradeAmount(t.shares) === null) return 'shares must be a positive number';
  for (const field of ['investmentAmount', 'positionSize', 'targetPrice']) {
    if (t[field] && tradeAmount(t[field]) === null) return `${field} must be a positive number`;
  }
  for (const field of ['stopLossPercent', 'takeProfitPercent']) {
    if (t[field] && tradePercent(t[field]) === null) return `${field} must be a positive number below 10000`;
  }
  if (t.squareOffDate && !tradeDate(t.squareOffDate)) return 'squareOffDate must be a date';
  for (const [field, max] of Object.entries(TRADE_TEXT_FIELDS)) {
    const value = t[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string' || (max > 0 && value.length > max)) {
      return max > 0 ? `${field} must be text of at most ${max} characters` : `${field} must be text`;
    }
  }
  if (t.market && !TRADE_MARKETS.includes(t.market)) return 'market must be India, UK or US';
  const status = t.status === undefined || t.status === null ? 'active' : t.status;
  if (status !== 'active' && status !== 'closed') return "status must be 'active' or 'closed'";
  if (status === 'closed') {
    if (tradeAmount(t.exitPrice) === null) return 'a closed trade needs a positive exitPrice';
    const exitDate = tradeDate(t.exitDate);
    if (!exitDate) return 'a closed trade needs an exitDate';
    if (exitDate < entryDate) return 'exitDate is before entryDate';
  }
  return null;
}

// Postgres refusing a value (bad number or date text, out of range, too long,
// NULL where required, a CHECK constraint) is bad input, not a server fault
const PG_BAD_INPUT = new Set(['22001', '22003', '22007', '22008', '22P02', '23502', '23514']);
const isBadTradeInput = (error) => Boolean(error && PG_BAD_INPUT.has(error.code));

// Create a manual trade (the add-position form). The session decides whose, and
// the body can never make it automatic.
app.post('/api/trades', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    const userId = req.user ? req.user.email : 'default';
    const problem = tradeInputError(req.body);
    if (problem) {
      return res.status(400).json({ error: problem });
    }
    const trade = await TradeDB.insertTrade({ ...req.body, symbol: req.body.symbol.trim(), autoAdded: false }, userId);
    res.status(201).json(trade);
  } catch (error) {
    if (isBadTradeInput(error)) {
      return res.status(400).json({ error: 'Invalid trade: ' + error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update a trade. Two kinds of change, and a stale copy of the trade drives neither:
// - a close ({ status: 'closed', exitPrice, exitDate?, exitReason?, notes? }) goes
//   through closeTradeAndRelease: one transaction that closes the row only while it
//   is active and settles the ledger. The P/L is worked out from the trade's own
//   entry price and shares, never taken from the body.
// - anything else edits the price paid and the notes, only while the trade is
//   active (TradeDB.editActiveTrade). Every other field in the body is ignored:
//   status, the exit fields, stop, target and dates.
// The Positions dialog used to send its whole cached copy of the trade, so a save
// that landed after the exit monitor had closed the position wrote status 'active'
// and empty exit fields back: the trade reopened, and its capital, already
// released, was released again at the next close. That save now gets a 409.
app.put('/api/trades/:id', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    const userId = req.user ? req.user.email : 'default';
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};

    const existingTrade = await TradeDB.getTradeById(req.params.id, userId);
    if (!existingTrade) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    if (existingTrade.status !== 'active') {
      return res.status(409).json({ error: 'Trade is no longer active' });
    }
    if (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') {
      return res.status(400).json({ error: 'notes must be text' });
    }

    if (body.status === 'closed') {
      const exitPrice = tradeAmount(body.exitPrice);
      if (exitPrice === null) {
        return res.status(400).json({ error: 'exitPrice must be a positive number' });
      }
      const exitDate = body.exitDate === undefined || body.exitDate === null ? new Date() : tradeDate(body.exitDate);
      if (!exitDate) {
        return res.status(400).json({ error: 'exitDate must be a date' });
      }
      if (existingTrade.entryDate && exitDate < new Date(existingTrade.entryDate)) {
        return res.status(400).json({ error: 'exitDate is before the entry date' });
      }
      console.log(`[TRADE UPDATE] Trade ${req.params.id} (${existingTrade.symbol}) closing via closeTradeAndRelease`);
      const closeResult = await TradeDB.closeTradeAndRelease(req.params.id, {
        exitDate,
        exitPrice,
        exitReason: typeof body.exitReason === 'string' && body.exitReason.trim() ? body.exitReason.trim() : 'Manual Exit',
        notes: body.notes
      }, userId);
      if (!closeResult.closed) {
        // Closed (or deleted) since it was read above: nothing was written
        return res.status(409).json({ error: 'Trade is no longer active' });
      }
      return res.json({
        success: true,
        message: 'Trade closed',
        profitLoss: closeResult.profitLoss,
        profitLossPercentage: closeResult.profitLossPercent,
        capitalReleased: closeResult.investmentReleased
      });
    }

    const edit = {};
    if (body.entryPrice !== undefined) {
      const entryPrice = tradeAmount(body.entryPrice);
      if (entryPrice === null) {
        return res.status(400).json({ error: 'entryPrice must be a positive number' });
      }
      edit.entryPrice = entryPrice;
    }
    if (body.notes !== undefined) {
      edit.notes = body.notes;
    }
    if (Object.keys(edit).length === 0) {
      return res.status(400).json({ error: 'Nothing to change: an edit sends entryPrice or notes, a close sends status "closed" and exitPrice' });
    }

    const updated = await TradeDB.editActiveTrade(req.params.id, edit, userId);
    if (!updated) {
      // Closed (or deleted) since it was read above: nothing was written
      return res.status(409).json({ error: 'Trade is no longer active' });
    }
    res.json({ success: true, message: 'Trade updated' });
  } catch (error) {
    if (isBadTradeInput(error)) {
      return res.status(400).json({ error: 'Invalid trade: ' + error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete a trade. An automatic trade leaves the ledger in the same statement
// (TradeDB.deleteTrade): an open one hands back its allocation and its slot, a
// closed one takes its realized P/L back out, so the ledger still reconciles.
app.delete('/api/trades/:id', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    const userId = req.user ? req.user.email : 'default';
    // Trade ids are whole numbers; anything else names no trade (and Postgres
    // would refuse to compare it with the id column: a 500)
    if (!/^\d{1,18}$/.test(req.params.id)) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    const result = await TradeDB.deleteTrade(req.params.id, userId);
    if (result.deleted === 0) {
      return res.status(404).json({ error: 'Trade not found' });
    }
    res.json({ success: true, message: 'Trade deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete all of the caller's trades, settling the ledger the same way
app.delete('/api/trades', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    const userId = req.user ? req.user.email : 'default';
    const result = await TradeDB.deleteAllTrades(userId);
    res.json({ success: true, count: result.deleted, message: `Deleted ${result.deleted} trades` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk import: the Positions page's Import trades (the file Export everything
// saves, which is GET /api/trades) and the one-off move of the trades the old app
// kept in localStorage (TradeAPI.migrateFromLocalStorage clears its copy once this
// answers success). All or nothing, and manual trades only: bulkInsertTrades
// stores each trade as POST /api/trades would, with auto_added false, so an
// exported trade comes back with its name, market, currency symbol, amounts,
// reasons and notes, and never touches the capital ledger.
app.post('/api/trades/bulk', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    const userId = req.user ? req.user.email : 'default';
    const trades = req.body && !Array.isArray(req.body) ? req.body.trades : undefined;
    if (!Array.isArray(trades) || trades.length === 0) {
      return res.status(400).json({ error: 'trades must be a non-empty array' });
    }
    for (let i = 0; i < trades.length; i++) {
      const problem = tradeInputError(trades[i]);
      if (problem) {
        return res.status(400).json({ error: `trades[${i}]: ${problem}` });
      }
    }
    const count = await TradeDB.bulkInsertTrades(trades.map(t => ({ ...t, symbol: t.symbol.trim() })), userId);
    res.json({ success: true, count, message: `Imported ${count} trades` });
  } catch (error) {
    if (isBadTradeInput(error)) {
      return res.status(400).json({ error: 'Invalid trade: ' + error.message });
    }
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

    // Run the high conviction scan (same as 7 AM cron job). The scanner catches its own failures and
    // answers { error } ("Scan already in progress", or what went wrong); this route used to report
    // those as "Signal scan completed" with success: true.
    const result = await stockScanner.runHighConvictionScan();
    if (!result || result.error) {
      return res.status(500).json({ error: (result && result.error) || 'The scan returned nothing' });
    }

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

    // The house book: the account the 1 PM executor books every signal to (lib/scheduler/trade-executor.js).
    // Without it the capital lookup failed (getPortfolioCapital needs an account), the ledger read as empty
    // and every signal showed MARKET_NOT_FOUND.
    const houseAccount = AdminIdentity.adminEmail();
    const capitalStatus = await CapitalManager.getCapitalStatus(houseAccount);

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
      const validation = await CapitalManager.validateTradeEntry(signal.market, signal.symbol, houseAccount);
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
        account: houseAccount,
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

// Yahoo Finance for the signed-in pages: the Positions chart (dti-data.js) and the Simulator
// (portfolio-simulator.js, portfolio-ui.js). The server's own modules - the scanner, the
// high-conviction manager, the exit monitor - read Yahoo in process (lib/shared/yahoo-client.js),
// so this route no longer answers anonymous callers: signed out, it gets 401 like the API.
const YahooClient = require('./lib/shared/yahoo-client');

// Yahoo Finance proxy - Historical data (CSV, through the price-unit and stale-fill repairs)
app.get('/yahoo/history', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const { symbol, period1, period2, interval } = req.query;

    if (!symbol) {
      return res.status(400).send('Symbol is required');
    }

    const history = await YahooClient.fetchHistoryCsv(symbol, { period1, period2, interval });
    if (!history) {
      return res.status(404).send('No data found for this symbol');
    }
    if (history.priceUnitRepair) res.set('X-Price-Unit-Repair', history.priceUnitRepair);
    if (history.staleFillRepair) res.set('X-Stale-Fill-Repair', history.staleFillRepair);

    res.set('Content-Type', 'text/csv');
    res.send(history.csv);
  } catch (error) {
    res.status(500).send(`Proxy error: ${error.message}`);
  }
});

// Dated exchange rates for the Simulator (GAPS #11): every calendar day from ?from to ?to (YYYY-MM-DD; by default the
// 365 days up to today in London) with the rates in force that day, the last stored daily close on or before it
// (lib/shared/fx-rates.js). Nothing stored yet: no days, and the page converts at its fixed approximate rates.
const FxRates = require('./lib/shared/fx-rates');
app.get('/api/fx/rates', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  const range = FxRates.parseWindow(req.query);
  if (range.error) {
    return res.status(400).json({ success: false, error: range.error });
  }
  await FxRates.ensureLoaded();
  res.json({ success: true, ...FxRates.dailySeries(range.from, range.to) });
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

// Get real-time prices for multiple symbols. Every symbol the one-second cache does not hold is a
// Yahoo request, so one call takes at most 100 (the Positions page sends its open positions'
// symbols 100 at a time: trade-core.js).
const MAX_PRICE_SYMBOLS = 100;

app.post('/api/prices', ensureAuthenticatedAPI, ensureSubscriptionActive, async (req, res) => {
  try {
    const { symbols } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: 'Symbols array is required' });
    }
    if (symbols.length > MAX_PRICE_SYMBOLS) {
      return res.status(400).json({ error: `At most ${MAX_PRICE_SYMBOLS} symbols a request` });
    }
    // A number crashed isMarketOpen() (symbol.endsWith) and the whole request answered 500
    if (!symbols.every(s => typeof s === 'string' && s.trim() !== '')) {
      return res.status(400).json({ error: 'Every symbol must be a non-empty string' });
    }

    const priceData = {};

    // Fetch prices for each symbol, once each
    const promises = [...new Set(symbols)].map(async (symbol) => {
      try {
        const cached = getCachedPrice(symbol);
        if (cached) {
          priceData[symbol] = cached;
          return;
        }

        // Check if market is open for this symbol
        const marketOpen = isMarketOpen(symbol);

        // The one-day chart. The symbol is URL-encoded into Yahoo's path (it went in raw, so a
        // "/" or "../" in it steered the request to another Yahoo path)
        const data = await YahooClient.fetchQuoteChart(symbol, { timeout: 5000 });
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
    // No row = never opened the Alerts page = everything on, the master switch
    // included: linking Telegram is all the page asks of a subscriber. This used
    // to default to false, and because the page POSTs the whole object back,
    // flipping ANY switch then stored an opt-out the user had never chosen.
    res.json(prefs || {
      telegram_enabled: true,
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
// The on/off columns: true, false or null (null leaves the column empty)
const ALERT_PREFERENCE_SWITCHES = ALERT_PREFERENCE_FIELDS.filter(key => key !== 'telegram_chat_id' && key !== 'email_address');
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
    // Wrong types reached Postgres and failed with 500 ("banana" for a switch, an object for a text field)
    const notSwitch = ALERT_PREFERENCE_SWITCHES.filter(key => key in prefs && prefs[key] !== null && typeof prefs[key] !== 'boolean');
    const notText = ['telegram_chat_id', 'email_address'].filter(key => key in prefs && prefs[key] !== null && !['string', 'number'].includes(typeof prefs[key]));
    if (notSwitch.length || notText.length) {
      return res.status(400).json({ error: [
        ...(notSwitch.length ? [`${notSwitch.join(', ')} must be true or false`] : []),
        ...(notText.length ? [`${notText.join(', ')} must be text`] : [])
      ].join('; ') });
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

// Subscribe to push notifications. Only a browser push service is a valid endpoint, and an account keeps its
// newest subscriptions (lib/push/endpoint-policy.js): each send is a POST from this server to the endpoint.
const { isAllowedPushEndpoint, prunePushSubscriptions } = require('./lib/push/endpoint-policy');
app.post('/api/push/subscribe', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const { subscription, userAgent } = req.body;

    // The INSERT needs all three as text: an empty keys object reached the NOT NULL
    // keys_p256dh column and crashed with 500 instead of answering 400.
    const isText = v => typeof v === 'string' && v.length > 0;
    if (!subscription || !isText(subscription.endpoint) || !subscription.keys ||
        !isText(subscription.keys.p256dh) || !isText(subscription.keys.auth)) {
      return res.status(400).json({ error: 'Invalid subscription data' });
    }
    if (!isAllowedPushEndpoint(subscription.endpoint)) {
      return res.status(400).json({ error: 'Unsupported push service' });
    }

    const userEmail = req.user.email;
    // user_agent is VARCHAR(500): a longer value crashed the INSERT with 500.
    const agent = typeof userAgent === 'string' ? userAgent.slice(0, 500) : null;
    await TradeDB.savePushSubscription(userEmail, subscription, agent);
    await prunePushSubscriptions(TradeDB.pool, userEmail);

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

// Admin endpoint: broadcast a notification to every subscribed browser (the admin portal's Settings tab).
// The /api/admin guard above decides who is an admin. This route also required the email to be in
// ADMIN_EMAILS, an environment variable nothing else reads, so the admin could be refused by it.
app.post('/api/admin/push/broadcast', ensureAuthenticatedAPI, async (req, res) => {
  try {
    const { title, body, url } = req.body;
    const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
    if (!text(title, 100) || !text(body, 500)) {
      return res.status(400).json({ error: 'A title (up to 100 characters) and a message (up to 500) are required' });
    }
    // Where a click on the notification opens: a page of this site, never another one ("//host" and
    // "/\host" are other sites to a browser)
    const sitePath = v => typeof v === 'string' && v.length <= 200 && /^\/(?![\/\\])[^\\\s]*$/.test(v);
    if (url !== undefined && url !== '' && !sitePath(url)) {
      return res.status(400).json({ error: 'url must be a path on this site, such as /index.html' });
    }

    if (!pushService || !pushService.isConfigured) {
      return res.status(503).json({ error: 'Web push is not configured on this server (VAPID keys are not set)' });
    }

    const payload = {
      title: title.trim(),
      body: body.trim(),
      icon: '/images/brand/app-icon.png',
      badge: '/images/brand/app-icon.png',
      url: url || '/account.html',
      requireInteraction: false
    };

    const result = await pushService.broadcast(payload);

    res.json({
      success: true,
      message: `Sent to ${result.sent} device${result.sent === 1 ? '' : 's'}` + (result.failed ? `; ${result.failed} failed` : ''),
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
    // The store express-session really uses: PgSessionStore (lib/shared/pg-session-store.js); 'memory' only if none is configured
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

// Push notifications used to open /account, a page that never existed (404). The ones already
// delivered still carry that link, so it leads to the Account page; signed out, to the sign-in page.
app.get('/account', ensureAuthenticated, (req, res) => {
  res.redirect('/account.html');
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
    if (AdminIdentity.isAdmin(req.user?.email)) return next();
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
  if (!AdminIdentity.isAdmin(req.user.email)) {
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
  if (!AdminIdentity.isAdmin(req.user.email)) {
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
// Date filters on the high-conviction admin API: absent, empty, or real dates written YYYY-MM-DD.
// Anything else reached Postgres, which threw, and the route answered 500. Returns the error text or null.
function badDateFilter(filters) {
  for (const [name, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '' && !Input.isoDate(value)) return `${name} must be a date written YYYY-MM-DD`;
  }
  return null;
}

app.get('/api/portfolio/trades/all', ensureAuthenticatedAPI, async (req, res) => {
  if (!AdminIdentity.isAdmin(req.user.email)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { startDate, endDate } = req.query;
    const badDate = badDateFilter({ startDate, endDate });
    if (badDate) return res.status(400).json({ error: badDate });
    const trades = await TradeDB.getAllHighConvictionTrades(startDate, endDate);
    res.json({ trades });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get P&L summary
app.get('/api/portfolio/pl-summary', ensureAuthenticatedAPI, async (req, res) => {
  if (!AdminIdentity.isAdmin(req.user.email)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { startDate, endDate } = req.query;
    const badDate = badDateFilter({ startDate, endDate });
    if (badDate) return res.status(400).json({ error: badDate });
    const summary = await TradeDB.getHighConvictionPLSummary(startDate, endDate);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update all active trades (manual trigger)
app.post('/api/portfolio/update-trades', ensureAuthenticatedAPI, async (req, res) => {
  if (!AdminIdentity.isAdmin(req.user.email)) {
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
  if (!AdminIdentity.isAdmin(req.user.email)) {
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
  if (!AdminIdentity.isAdmin(req.user.email)) {
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
  if (!AdminIdentity.isAdmin(req.user.email)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { symbol } = req.params;
    const { exitReason } = req.body;
    // A price above zero, as a number or a numeric string: 'not-a-price' used to reach the DECIMAL column (500)
    const exitPrice = Input.positiveNumber(req.body.exitPrice);

    if (!exitPrice || !exitReason) {
      return res.status(400).json({ error: 'exitPrice (a number above zero) and exitReason required' });
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

    // In the other two currencies at today's dated rates (GAPS #11), as the automatic pass converts
    await FxRates.ensureLoaded();
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

  // Run migration to sync active_positions counters. A position is an open
  // AUTOMATIC trade, as in POST /api/ops/reconcile-capital and
  // closeTradeAndRelease: manual trades never allocate, so they never take a
  // slot. (This used to count manual trades too, so after every boot they took
  // automatic-trading slots, and it skipped markets with nothing open, so a
  // slot leaked there survived every boot.)
  try {
    console.log('🔧 [MIGRATION] Syncing active_positions counters...');

    const syncResult = await TradeDB.pool.query(`
      UPDATE portfolio_capital pc
      SET active_positions = counted.open_count
      FROM (
        SELECT p.user_id, p.market, COUNT(t.id)::int AS open_count
        FROM portfolio_capital p
        LEFT JOIN trades t
          ON t.user_id = p.user_id AND t.market = p.market
         AND t.status = 'active' AND t.auto_added = true
        GROUP BY p.user_id, p.market
      ) counted
      WHERE counted.user_id = pc.user_id AND counted.market = pc.market
        AND pc.active_positions IS DISTINCT FROM counted.open_count
      RETURNING pc.market, pc.active_positions
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

// Telegram delivery counts (lib/telegram/delivery-counts.js): the table exists from boot, so
// GET /api/ops/telegram-stats reads it before the first message is counted
require('./lib/telegram/delivery-counts').ensureTable(TradeDB.pool)
  .catch(error => console.error('⚠️ [TELEGRAM DELIVERIES] Could not create the table:', error.message));
