/**
 * /api/ml: the AI conviction check - one symbol, a batch, and the monthly sweep's status.
 * Scoring lives in conviction-engine.js. The legacy ML toolkit that also lived here (analysis,
 * risk-params, detect-patterns, sentiment, portfolio-risk, alerts, train) was removed on
 * 2026-09-23: nothing called it, and it loaded its models at every boot.
 */

const express = require('express');
const router = express.Router();

// Load subscription middleware
let ensureSubscriptionActive;
try {
  const subscriptionModule = require('../middleware/subscription');
  ensureSubscriptionActive = subscriptionModule.ensureSubscriptionActive;
} catch (error) {
  console.error('ML Routes: Subscription middleware not available:', error.message);
  ensureSubscriptionActive = (req, res, next) => next();
}

// ---------------------------------------------------------------------------
// Conviction check — same framework as the external Claude analysis routine:
// three pillars scored 1-10, blended Technical 45% / Fundamental 30% /
// Information 25% into CONFIDENCE (>6 GO, 5-6 WATCH, <5 PASS).
// Momentum counts positive; stop-vs-ADR fit is a moderator, not a veto.
// Missing fundamentals = neutral 5. Earnings inside the 30-day news window
// caps the information pillar. Backtest win rate is context only, never scored.
// ---------------------------------------------------------------------------

const { getConviction } = require('./conviction-engine');

/**
 * GET /api/ml/conviction/:symbol?name=&winRate=
 * Three-pillar conviction check for one screened stock.
 * Scoring lives in conviction-engine.js (shared with the 7 AM scanner gate
 * and the 1 PM executor safety net) — this route is a thin auth'd wrapper.
 */
/**
 * GET /api/ml/conviction/sweep-status
 * Weekend sweep progress + weekly verdict coverage — rendered on the
 * Simulator page so it is visible that the week's AI scores are in place.
 * MUST be registered before /conviction/:symbol or it matches as a symbol.
 */
router.get('/conviction/sweep-status', ensureSubscriptionActive, async (req, res) => {
    try {
        const { getSweepStatus, getCoverage } = require('./conviction-sweep');
        const sweep = getSweepStatus();
        const coverage = await getCoverage();
        res.json({ success: true, sweep, coverage });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/conviction/:symbol', ensureSubscriptionActive, async (req, res) => {
    try {
        const symbol = req.params.symbol.toUpperCase();
        const { name } = req.query;
        const winRate = req.query.winRate !== undefined ? parseFloat(req.query.winRate) : null;

        const payload = await getConviction({ symbol, name, winRate });
        res.json(payload);
    } catch (error) {
        console.error('Conviction check error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/ml/conviction/batch  { signals: [{symbol, name, winRate}, ...] }
 * Score up to 100 symbols with bounded concurrency. Same engine and daily
 * cache as the single endpoint — cached symbols return instantly, uncached
 * ones are scored 5 at a time. Used by the portfolio simulator so a run
 * doesn't crawl through symbols one at a time.
 */
router.post('/conviction/batch', ensureSubscriptionActive, async (req, res) => {
    try {
        const signals = Array.isArray(req.body && req.body.signals) ? req.body.signals : null;
        if (!signals || signals.length === 0) {
            return res.status(400).json({ success: false, error: 'signals array is required' });
        }
        if (signals.length > 100) {
            return res.status(400).json({ success: false, error: 'At most 100 signals per batch' });
        }

        // Dedup by symbol, keep the first name/winRate seen
        const bySymbol = new Map();
        for (const s of signals) {
            if (!s || typeof s.symbol !== 'string' || !s.symbol.trim()) continue;
            const symbol = s.symbol.trim().toUpperCase();
            if (!bySymbol.has(symbol)) {
                bySymbol.set(symbol, {
                    symbol,
                    name: typeof s.name === 'string' ? s.name : undefined,
                    winRate: s.winRate != null && !isNaN(parseFloat(s.winRate)) ? parseFloat(s.winRate) : null
                });
            }
        }

        const queue = [...bySymbol.values()];
        const results = {};
        const CONCURRENCY = 5;

        async function worker() {
            while (queue.length > 0) {
                const item = queue.shift();
                try {
                    const payload = await getConviction(item);
                    results[item.symbol] = {
                        symbol: item.symbol,
                        verdict: payload.verdict,
                        confidence: payload.confidence,
                        engine: payload.engine
                    };
                } catch (error) {
                    // Fail-closed marker — the caller must treat this as no-trade
                    results[item.symbol] = { symbol: item.symbol, error: true };
                }
            }
        }

        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, bySymbol.size) }, worker));
        res.json({ success: true, results });
    } catch (error) {
        console.error('Batch conviction error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;