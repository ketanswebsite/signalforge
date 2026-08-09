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

const cheerio = require('cheerio');
const Sentiment = require('sentiment');
const headlineSentiment = new Sentiment();

const convictionCache = new Map();          // symbol → {expires, payload}
const CONVICTION_TTL_MS = 15 * 60 * 1000;

let yahooSession = null;                    // {cookie, crumb, expires}

const YAHOO_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function getYahooSession() {
    if (yahooSession && yahooSession.expires > Date.now()) return yahooSession;
    const probe = await axios.get('https://fc.yahoo.com', {
        headers: { 'User-Agent': YAHOO_UA },
        validateStatus: () => true,
        timeout: 15000
    });
    const setCookie = probe.headers['set-cookie'] || [];
    const cookie = setCookie.map(c => c.split(';')[0]).join('; ');
    if (!cookie) throw new Error('No Yahoo cookie');
    const crumbRes = await axios.get('https://query1.finance.yahoo.com/v1/test/getcrumb', {
        headers: { 'User-Agent': YAHOO_UA, 'Cookie': cookie },
        timeout: 15000
    });
    const crumb = typeof crumbRes.data === 'string' ? crumbRes.data.trim() : '';
    if (!crumb || crumb.includes('<')) throw new Error('No Yahoo crumb');
    yahooSession = { cookie, crumb, expires: Date.now() + 30 * 60 * 1000 };
    return yahooSession;
}

const clampScore = v => Math.round(Math.max(1, Math.min(10, v)) * 10) / 10;
const pct = v => (v >= 0 ? '+' : '') + v.toFixed(1) + '%';

async function scoreTechnical(symbol) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
    const { data } = await axios.get(url, {
        params: { range: '6mo', interval: '1d' },
        headers: { 'User-Agent': YAHOO_UA, 'Accept': 'application/json' },
        timeout: 20000
    });
    const result = data && data.chart && data.chart.result && data.chart.result[0];
    if (!result || !result.indicators.quote[0]) throw new Error('No price history');
    const q = result.indicators.quote[0];
    const bars = [];
    for (let i = 0; i < (result.timestamp || []).length; i++) {
        if (q.close[i] != null && q.high[i] != null && q.low[i] != null) {
            bars.push({ close: q.close[i], high: q.high[i], low: q.low[i] });
        }
    }
    if (bars.length < 55) throw new Error('Not enough price history');

    const last = bars[bars.length - 1].close;
    const at = n => bars[bars.length - 1 - n].close;
    const mom21 = (last / at(21) - 1) * 100;
    const mom5 = (last / at(5) - 1) * 100;
    const ma50 = bars.slice(-50).reduce((s, b) => s + b.close, 0) / 50;
    const vsMa50 = (last / ma50 - 1) * 100;
    const adr20 = bars.slice(-20).reduce((s, b) => s + (b.high - b.low) / b.close, 0) / 20 * 100;
    const stopFitDays = adr20 > 0 ? 5 / adr20 : 99;

    let score = 5;
    const evidence = [];
    if (mom21 > 6) score += 2; else if (mom21 > 2) score += 1;
    else if (mom21 < -6) score -= 2; else if (mom21 < -2) score -= 1;
    evidence.push(`21-day move ${pct(mom21)}`);
    if (mom5 > 2) score += 1; else if (mom5 < -2) score -= 1;
    evidence.push(`5-day move ${pct(mom5)}`);
    if (vsMa50 > 2) score += 1; else if (vsMa50 < -2) score -= 1;
    evidence.push(`Price ${pct(vsMa50)} vs its 50-day average`);
    // Moderator, not a veto: how many typical days' range sits before the −5% stop
    if (stopFitDays < 1.25) score -= 1; else if (stopFitDays > 2.5) score += 0.5;
    evidence.push(`Typical daily range ${adr20.toFixed(1)}% — the −5% stop is ~${stopFitDays.toFixed(1)} days of range`);

    return { score: clampScore(score), evidence };
}

async function scoreFundamental(symbol) {
    const neutral = { score: 5, evidence: ['Fundamental data unavailable — scored neutral (5)'] };
    let summary;
    try {
        const session = await getYahooSession();
        const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`;
        const { data } = await axios.get(url, {
            params: { modules: 'summaryDetail,financialData,defaultKeyStatistics', crumb: session.crumb },
            headers: { 'User-Agent': YAHOO_UA, 'Cookie': session.cookie, 'Accept': 'application/json' },
            timeout: 20000
        });
        summary = data && data.quoteSummary && data.quoteSummary.result && data.quoteSummary.result[0];
    } catch (e) {
        return neutral;
    }
    if (!summary) return neutral;

    const raw = v => (v && typeof v.raw === 'number') ? v.raw : null;
    const fin = summary.financialData || {};
    const det = summary.summaryDetail || {};
    const margins = raw(fin.profitMargins);
    const revGrowth = raw(fin.revenueGrowth);
    const roe = raw(fin.returnOnEquity);
    const de = raw(fin.debtToEquity);            // already in percent (e.g. 82.4)
    const trailingPE = raw(det.trailingPE);
    const forwardPE = raw(det.forwardPE) || raw(fin.forwardPE);

    if ([margins, revGrowth, roe, de, trailingPE, forwardPE].every(v => v === null)) return neutral;

    let score = 5;
    const evidence = [];
    if (margins !== null) {
        if (margins > 0.10) score += 1; else if (margins < 0) score -= 1.5;
        evidence.push(`Profit margin ${(margins * 100).toFixed(1)}%`);
    }
    if (revGrowth !== null) {
        if (revGrowth > 0.08) score += 1; else if (revGrowth < 0) score -= 1;
        evidence.push(`Revenue growth ${pct(revGrowth * 100)}`);
    }
    if (roe !== null) {
        if (roe > 0.15) score += 1;
        evidence.push(`Return on equity ${(roe * 100).toFixed(1)}%`);
    }
    if (de !== null) {
        if (de < 80) score += 0.5; else if (de > 200) score -= 1;
        evidence.push(`Debt/equity ${de.toFixed(0)}%`);
    }
    if (trailingPE !== null && forwardPE !== null && forwardPE < trailingPE) {
        score += 0.5;
        evidence.push(`Forward P/E ${forwardPE.toFixed(1)} under trailing ${trailingPE.toFixed(1)} — earnings expected to grow`);
    } else if (trailingPE !== null) {
        evidence.push(`Trailing P/E ${trailingPE.toFixed(1)}`);
    }
    if (trailingPE !== null && trailingPE > 60) score -= 0.5;

    return { score: clampScore(score), evidence };
}

async function scoreInformation(symbol, name) {
    const market = symbol.endsWith('.NS') ? { hl: 'en-IN', gl: 'IN', ceid: 'IN:en' }
        : symbol.endsWith('.L') ? { hl: 'en-GB', gl: 'GB', ceid: 'GB:en' }
        : { hl: 'en-US', gl: 'US', ceid: 'US:en' };
    const cleanName = (name || symbol.replace(/\.(NS|L)$/, ''))
        .replace(/\b(plc|ltd|limited|inc|corp|corporation|group)\b\.?/gi, '').trim();
    const query = `"${cleanName}" stock when:30d`;

    let items = [];
    try {
        const { data } = await axios.get('https://news.google.com/rss/search', {
            params: { q: query, hl: market.hl, gl: market.gl, ceid: market.ceid },
            headers: { 'User-Agent': YAHOO_UA },
            timeout: 20000
        });
        const $ = cheerio.load(data, { xmlMode: true });
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        $('item').each((_, el) => {
            const title = $(el).find('title').first().text().trim();
            const pub = new Date($(el).find('pubDate').first().text());
            if (title && !isNaN(pub) && pub.getTime() >= cutoff) {
                items.push({ title, date: pub });
            }
        });
        items = items.slice(0, 12);
    } catch (e) {
        return { score: 5, evidence: ['News feed unavailable — scored neutral (5)'], headlines: [], earningsCap: false };
    }

    if (items.length === 0) {
        return { score: 5, evidence: ['No notable headlines in the last 30 days — neutral'], headlines: [], earningsCap: false };
    }

    let pos = 0, neg = 0;
    const earningsRe = /\b(earnings|results|q[1-4]|quarterly|half-year|interim|trading update|guidance)\b/i;
    let earningsSoon = false;
    const headlines = items.map(it => {
        const comparative = headlineSentiment.analyze(it.title).comparative;
        const tone = comparative > 0.1 ? 'pos' : comparative < -0.1 ? 'neg' : 'neutral';
        if (tone === 'pos') pos++; else if (tone === 'neg') neg++;
        if (earningsRe.test(it.title)) earningsSoon = true;
        return { title: it.title, date: it.date.toISOString().split('T')[0], tone };
    });

    let score = 5 + Math.max(-3, Math.min(3, pos - neg));
    const evidence = [`${items.length} headlines in 30 days — ${pos} read positive, ${neg} negative`];
    let earningsCap = false;
    if (earningsSoon && score > 5) {
        score = 5;
        earningsCap = true;
        evidence.push('Earnings/results inside the 30-day window — pillar capped at 5');
    } else if (earningsSoon) {
        evidence.push('Earnings/results inside the 30-day window');
    }

    return { score: clampScore(score), evidence, headlines: headlines.slice(0, 4), earningsCap };
}

/**
 * GET /api/ml/conviction/:symbol?name=&winRate=
 * Three-pillar conviction check for one screened stock.
 */
router.get('/conviction/:symbol', ensureSubscriptionActive, async (req, res) => {
    try {
        const symbol = req.params.symbol.toUpperCase();
        const { name } = req.query;
        const winRate = req.query.winRate !== undefined ? parseFloat(req.query.winRate) : null;

        const cached = convictionCache.get(symbol);
        if (cached && cached.expires > Date.now()) {
            return res.json({ ...cached.payload, context: { ...cached.payload.context, winRate } });
        }

        const [technical, fundamental, information] = await Promise.all([
            scoreTechnical(symbol),
            scoreFundamental(symbol),
            scoreInformation(symbol, name)
        ]);

        const confidence = Math.round(
            (technical.score * 0.45 + fundamental.score * 0.30 + information.score * 0.25) * 10
        ) / 10;
        const verdict = confidence > 6 ? 'GO' : confidence >= 5 ? 'WATCH' : 'PASS';

        const payload = {
            success: true,
            symbol,
            name: name || symbol,
            confidence,
            verdict,
            pillars: {
                technical: { ...technical, weight: 45 },
                fundamental: { ...fundamental, weight: 30 },
                information: { ...information, weight: 25 }
            },
            context: {
                winRate,
                note: 'Backtest win rate is context only — it is never part of the score.'
            },
            generatedAt: new Date().toISOString()
        };

        convictionCache.set(symbol, { expires: Date.now() + CONVICTION_TTL_MS, payload });
        res.json(payload);
    } catch (error) {
        console.error('Conviction check error:', error.message);
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