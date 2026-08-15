/**
 * ML API Routes
 * Provides endpoints for ML features
 */

const express = require('express');
const router = express.Router();
const mlIntegration = require('./ml-integration');
const axios = require('axios');

// Load subscription middleware
let ensureSubscriptionActive;
try {
  const subscriptionModule = require('../middleware/subscription');
  ensureSubscriptionActive = subscriptionModule.ensureSubscriptionActive;
} catch (error) {
  console.error('ML Routes: Subscription middleware not available:', error.message);
  ensureSubscriptionActive = (req, res, next) => next();
}

// Initialize ML models on startup
mlIntegration.initialize().catch(console.error);

/**
 * GET /api/ml/analysis/:symbol
 * Get comprehensive ML analysis for a stock
 */
router.get('/analysis/:symbol', ensureSubscriptionActive, async (req, res) => {
    try {
        const { symbol } = req.params;
        const { days = 100 } = req.query;
        
        // Fetch historical data
        const endDate = Math.floor(Date.now() / 1000);
        const startDate = endDate - (days * 24 * 60 * 60);
        
        const response = await axios.get(`http://localhost:${process.env.PORT || 3000}/yahoo/history`, {
            params: {
                symbol,
                period1: startDate,
                period2: endDate,
                interval: '1d'
            }
        });
        
        // Parse CSV data
        const priceData = parseCSVData(response.data);
        
        // Get current market state
        const currentState = {
            priceChange: calculatePriceChange(priceData),
            volumeRatio: calculateVolumeRatio(priceData),
            volatility: calculateVolatility(priceData),
            rsi: calculateRSI(priceData),
            holdingDays: 0
        };
        
        // Get ML analysis
        const analysis = await mlIntegration.getMLAnalysis(symbol, priceData, currentState);
        
        res.json(analysis);
    } catch (error) {
        console.error('ML analysis error:', error);
        res.status(500).json({ error: error.message });
    }
});

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

/**
 * POST /api/ml/risk-params
 * Get optimal risk parameters for current market conditions
 */
router.post('/risk-params', ensureSubscriptionActive, async (req, res) => {
    try {
        const { marketState } = req.body;
        
        if (!marketState) {
            return res.status(400).json({ error: 'Market state required' });
        }
        
        const riskParams = await mlIntegration.riskAI.getOptimalRiskParams(marketState);
        
        res.json(riskParams);
    } catch (error) {
        console.error('Risk params error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/ml/detect-patterns
 * Detect patterns in provided price data
 */
router.post('/detect-patterns', ensureSubscriptionActive, async (req, res) => {
    try {
        const { priceData } = req.body;
        
        if (!priceData || !Array.isArray(priceData)) {
            return res.status(400).json({ error: 'Price data array required' });
        }
        
        const patterns = await mlIntegration.analyzePatterns(priceData);
        
        res.json(patterns);
    } catch (error) {
        console.error('Pattern detection error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/ml/sentiment/:symbol
 * Get sentiment analysis for a stock
 */
router.get('/sentiment/:symbol', ensureSubscriptionActive, async (req, res) => {
    try {
        const { symbol } = req.params;
        const { sources } = req.query;
        
        const sentiment = await mlIntegration.sentimentAI.analyzeStockSentiment(
            symbol,
            { sources: sources ? sources.split(',') : undefined }
        );
        
        res.json(sentiment);
    } catch (error) {
        console.error('Sentiment analysis error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/ml/portfolio-risk
 * Analyze portfolio risk using Monte Carlo simulation
 */
router.post('/portfolio-risk', ensureSubscriptionActive, async (req, res) => {
    try {
        const { portfolio, days = 30, iterations = 1000 } = req.body;
        
        if (!portfolio || !Array.isArray(portfolio)) {
            return res.status(400).json({ error: 'Portfolio array required' });
        }
        
        const riskAnalysis = await mlIntegration.riskAI.monteCarloRiskSimulation(
            portfolio,
            days,
            iterations
        );
        
        res.json(riskAnalysis);
    } catch (error) {
        console.error('Portfolio risk error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/ml/alerts
 * Get ML-based alerts for positions
 */
router.post('/alerts', ensureSubscriptionActive, async (req, res) => {
    try {
        const { positions } = req.body;
        
        if (!positions || !Array.isArray(positions)) {
            return res.status(400).json({ error: 'Positions array required' });
        }
        
        const alerts = await mlIntegration.getMLAlerts(positions);
        
        res.json(alerts);
    } catch (error) {
        console.error('ML alerts error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/ml/train
 * Train ML models with historical data
 */
router.post('/train', ensureSubscriptionActive, async (req, res) => {
    try {
        const { trainingData } = req.body;
        
        if (!trainingData) {
            return res.status(400).json({ error: 'Training data required' });
        }
        
        await mlIntegration.trainModels(trainingData);
        await mlIntegration.saveModels();
        
        res.json({ message: 'ML models trained successfully' });
    } catch (error) {
        console.error('ML training error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper functions
function parseCSVData(csvString) {
    const lines = csvString.trim().split('\n');
    const headers = lines[0].split(',');
    
    return lines.slice(1).map(line => {
        const values = line.split(',');
        return {
            date: values[0],
            open: parseFloat(values[1]),
            high: parseFloat(values[2]),
            low: parseFloat(values[3]),
            close: parseFloat(values[4]),
            volume: parseInt(values[6])
        };
    });
}

function calculatePriceChange(priceData) {
    if (priceData.length < 2) return 0;
    
    const lastPrice = priceData[priceData.length - 1].close;
    const prevPrice = priceData[priceData.length - 2].close;
    
    return ((lastPrice - prevPrice) / prevPrice) * 100;
}

function calculateVolumeRatio(priceData) {
    if (priceData.length < 20) return 1;
    
    const recentVolume = priceData[priceData.length - 1].volume;
    const avgVolume = priceData.slice(-20).reduce((sum, d) => sum + d.volume, 0) / 20;
    
    return avgVolume > 0 ? recentVolume / avgVolume : 1;
}

function calculateVolatility(priceData) {
    if (priceData.length < 20) return 20;
    
    const returns = [];
    for (let i = 1; i < priceData.length; i++) {
        const ret = (priceData[i].close - priceData[i-1].close) / priceData[i-1].close;
        returns.push(ret);
    }
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev * Math.sqrt(252) * 100; // Annualized volatility
}

function calculateRSI(priceData, period = 14) {
    if (priceData.length < period + 1) return 50;
    
    const closes = priceData.map(d => d.close);
    let gains = 0;
    let losses = 0;
    
    // Calculate initial average gain/loss
    for (let i = 1; i <= period; i++) {
        const change = closes[i] - closes[i-1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    // Calculate subsequent values using smoothing
    for (let i = period + 1; i < closes.length; i++) {
        const change = closes[i] - closes[i-1];
        
        if (change > 0) {
            avgGain = (avgGain * (period - 1) + change) / period;
            avgLoss = (avgLoss * (period - 1)) / period;
        } else {
            avgGain = (avgGain * (period - 1)) / period;
            avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
        }
    }
    
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return rsi;
}

module.exports = router;