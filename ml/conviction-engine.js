/**
 * Conviction Engine — the three-pillar AI check for screened stocks.
 *
 * Extracted from ml-routes.js so the same engine serves three consumers:
 *   - GET /api/ml/conviction/:symbol (the UI insights panel)
 *   - the 7 AM scanner gate (signals must score GO before they are stored
 *     as pending / booked to the high-conviction portfolio)
 *   - the 1 PM trade executor safety net (signals without a stored verdict
 *     are scored live before any capital moves)
 *
 * Framework (fixed — mirrored by the cloud ntfy routine, change both places):
 *   Technical 45% (momentum positive, stop-vs-ADR fit is a moderator, not a veto)
 *   Fundamental 30% (Yahoo quoteSummary via cookie+crumb; missing data = neutral 5)
 *   Information 25% (Google News RSS; earnings inside the 30d window caps the pillar)
 *   Blended confidence: >6.0 = GO, 5-6 = WATCH, <5 = PASS.
 *   Backtest win rate is context only — never part of the score.
 *
 * Every pillar degrades to neutral 5 on failure, so a dead data source yields
 * WATCH rather than an exception — callers treat that as "no AI confirmation".
 */

const axios = require('axios');
const cheerio = require('cheerio');
const Sentiment = require('sentiment');
const headlineSentiment = new Sentiment();

// Verdicts are scored by the WEEKEND SWEEP (Saturday, full universe) and
// reused for the whole following week — by the 7 AM scanner, the 1 PM
// executor, the insights panel and the simulator alike, so every surface
// sees the same verdict and the engine (and Gemini) runs at most once per
// symbol per week. A symbol the sweep missed is scored on demand and then
// sticks for the same window. CONVICTION_MAX_AGE_DAYS (default 7) sets how
// old a stored verdict may be; CONVICTION_CACHE_TTL_MIN shortens the
// in-memory layer. NOTE: the 7 PM EOD summary reads fetchRecentHeadlines
// directly and is NOT cached — it always reports the day's fresh news.
const convictionCache = new Map();          // symbol → {expires, payload}
const inFlight = new Map();                 // symbol → Promise (dedup concurrent scoring)

const NEUTRAL_RETRY_MS = 30 * 60 * 1000;    // all-sources-failed results retry after 30 min

function maxAgeDays() {
    const days = parseInt(process.env.CONVICTION_MAX_AGE_DAYS, 10);
    return days > 0 ? days : 7;
}

function cacheExpiryMs() {
    const ttlMin = parseInt(process.env.CONVICTION_CACHE_TTL_MIN, 10);
    if (ttlMin > 0) return Date.now() + ttlMin * 60 * 1000;
    // Default: rest of the current UTC day (the DB row carries the verdict
    // across days within the week window)
    const now = new Date();
    const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    return midnight;
}

function todayUTC() {
    return new Date().toISOString().split('T')[0];
}

function oldestAcceptedUTC() {
    const cutoff = new Date(Date.now() - (maxAgeDays() - 1) * 24 * 60 * 60 * 1000);
    return cutoff.toISOString().split('T')[0];
}

/**
 * A result where every pillar came back exactly neutral with no Gemini
 * layer almost always means the data sources were unreachable (each pillar
 * degrades to 5 on failure). Persisting that for a week would block trades
 * on healthy stocks — so it is kept only briefly in memory and retried.
 */
function isAllNeutral(payload) {
    const p = payload.pillars || {};
    return payload.engine === 'rule-based' &&
        p.technical && p.technical.score === 5 &&
        p.fundamental && p.fundamental.score === 5 &&
        p.information && p.information.score === 5;
}

// Lazy DB handle — the engine must keep working even if the DB is down
// (fails open to a fresh computation)
function getDB() {
    try {
        return require('../database-postgres');
    } catch (e) {
        return null;
    }
}

async function readDailyVerdict(symbol) {
    try {
        const db = getDB();
        if (!db || !db.pool) return null;
        const result = await db.pool.query(
            `SELECT payload FROM conviction_daily
             WHERE symbol = $1 AND score_date >= $2
             ORDER BY score_date DESC LIMIT 1`,
            [symbol, oldestAcceptedUTC()]
        );
        return result.rows[0] ? result.rows[0].payload : null;
    } catch (e) {
        return null;
    }
}

async function writeDailyVerdict(symbol, payload) {
    try {
        const db = getDB();
        if (!db || !db.pool) return;
        await db.pool.query(
            `INSERT INTO conviction_daily (symbol, score_date, confidence, verdict, engine, payload)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (symbol, score_date) DO NOTHING`,
            [symbol, todayUTC(), payload.confidence, payload.verdict, payload.engine, JSON.stringify(payload)]
        );
    } catch (e) {
        // Persistence is best-effort; the in-memory cache still applies
    }
}

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

/**
 * Fetch recent Google News headlines for a stock with sentiment tones.
 * Shared by the information pillar (30-day window) and the EOD portfolio
 * summary (1-day window). Throws on feed failure — callers decide the
 * degraded behavior.
 * Returns { headlines: [{title, date, tone}], pos, neg, earningsSoon }.
 */
async function fetchRecentHeadlines(symbol, name, windowDays = 30) {
    const market = symbol.endsWith('.NS') ? { hl: 'en-IN', gl: 'IN', ceid: 'IN:en' }
        : symbol.endsWith('.L') ? { hl: 'en-GB', gl: 'GB', ceid: 'GB:en' }
        : { hl: 'en-US', gl: 'US', ceid: 'US:en' };
    const cleanName = (name || symbol.replace(/\.(NS|L)$/, ''))
        .replace(/\b(plc|ltd|limited|inc|corp|corporation|group)\b\.?/gi, '').trim();
    const query = `"${cleanName}" stock when:${windowDays}d`;

    const { data } = await axios.get('https://news.google.com/rss/search', {
        params: { q: query, hl: market.hl, gl: market.gl, ceid: market.ceid },
        headers: { 'User-Agent': YAHOO_UA },
        timeout: 20000
    });
    const $ = cheerio.load(data, { xmlMode: true });
    const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    let items = [];
    $('item').each((_, el) => {
        const title = $(el).find('title').first().text().trim();
        const pub = new Date($(el).find('pubDate').first().text());
        if (title && !isNaN(pub) && pub.getTime() >= cutoff) {
            items.push({ title, date: pub });
        }
    });
    items = items.slice(0, 12);

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

    return { headlines, pos, neg, earningsSoon };
}

async function scoreInformation(symbol, name) {
    let feed;
    try {
        feed = await fetchRecentHeadlines(symbol, name, 30);
    } catch (e) {
        return { score: 5, evidence: ['News feed unavailable — scored neutral (5)'], headlines: [], earningsCap: false };
    }

    if (feed.headlines.length === 0) {
        return { score: 5, evidence: ['No notable headlines in the last 30 days — neutral'], headlines: [], earningsCap: false };
    }

    const { headlines, pos, neg, earningsSoon } = feed;
    const items = headlines;

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
 * Optional Gemini layer. When GEMINI_API_KEY is set, the deterministic
 * collectors' facts are handed to Gemini, which re-scores each pillar under
 * the same framework and writes a short summary. Scores are clamped and the
 * confidence blend is always recomputed server-side — the model never does
 * the maths. Any failure falls back to the rule-based scores.
 */
const GEMINI_MODEL = 'gemini-2.5-flash';

async function geminiConviction({ symbol, name, technical, fundamental, information, winRate }) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;

    const facts = {
        stock: { symbol, name: name || symbol },
        technicalFacts: technical.evidence,
        fundamentalFacts: fundamental.evidence,
        newsFacts: information.evidence,
        headlines: (information.headlines || []).map(h => `${h.date}: ${h.title}`),
        earningsInsideNewsWindow: !!information.earningsCap,
        backtestWinRatePercent: winRate
    };

    const prompt =
        'You are the conviction checker for a swing-trade scanner (entry now, +8% target, −5% stop, 30-day limit).\n' +
        'Score three pillars from 1 to 10 using ONLY the facts given:\n' +
        '- technical (weight 45%): price behaviour. Momentum counts POSITIVE. The stop-vs-daily-range fit is a moderator, never a veto.\n' +
        '- fundamental (weight 30%): business quality. If facts say data is unavailable, score exactly 5.\n' +
        '- information (weight 25%): the news tone. If earningsInsideNewsWindow is true, this pillar is capped at 5.\n' +
        'backtestWinRatePercent is CONTEXT ONLY — it must not move any score.\n' +
        'For each pillar give 2-4 evidence lines; every line must contain a number or cite a headline. ' +
        'Neither cheerlead nor auto-sceptic — follow the facts. ' +
        'Also write a 2-3 sentence plain-English summary of the overall picture.\n\n' +
        'Facts:\n' + JSON.stringify(facts, null, 2);

    const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: {
                type: 'object',
                properties: {
                    technical: {
                        type: 'object',
                        properties: {
                            score: { type: 'number' },
                            evidence: { type: 'array', items: { type: 'string' } }
                        },
                        required: ['score', 'evidence']
                    },
                    fundamental: {
                        type: 'object',
                        properties: {
                            score: { type: 'number' },
                            evidence: { type: 'array', items: { type: 'string' } }
                        },
                        required: ['score', 'evidence']
                    },
                    information: {
                        type: 'object',
                        properties: {
                            score: { type: 'number' },
                            evidence: { type: 'array', items: { type: 'string' } }
                        },
                        required: ['score', 'evidence']
                    },
                    summary: { type: 'string' }
                },
                required: ['technical', 'fundamental', 'information', 'summary']
            }
        }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const { data } = await axios.post(url, body, {
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        timeout: 30000
    });

    const text = data && data.candidates && data.candidates[0] &&
        data.candidates[0].content && data.candidates[0].content.parts &&
        data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
    if (!text) throw new Error('Empty Gemini response');

    const parsed = JSON.parse(text);
    const pillar = (p, fallback) => ({
        score: clampScore(typeof p.score === 'number' ? p.score : fallback.score),
        evidence: Array.isArray(p.evidence) && p.evidence.length ? p.evidence.slice(0, 4) : fallback.evidence
    });

    const gTech = pillar(parsed.technical, technical);
    const gFund = pillar(parsed.fundamental, fundamental);
    // The earnings cap is a hard framework rule — re-apply it whatever the model said
    const gInfo = pillar(parsed.information, information);
    if (information.earningsCap && gInfo.score > 5) gInfo.score = 5;

    return {
        technical: gTech,
        fundamental: gFund,
        information: { ...gInfo, headlines: information.headlines, earningsCap: information.earningsCap },
        summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 600) : null
    };
}

/**
 * Run the full three-pillar conviction check for one stock.
 * Returns the same payload shape the /api/ml/conviction/:symbol route serves.
 * 15-minute in-memory cache per symbol (winRate in context is always fresh).
 */
async function getConviction({ symbol, name, winRate = null }) {
    symbol = symbol.toUpperCase();

    const cached = convictionCache.get(symbol);
    if (cached && cached.expires > Date.now()) {
        return { ...cached.payload, context: { ...cached.payload.context, winRate } };
    }

    // Someone already scored today (another request, the 7 AM scan, or a
    // previous process before a restart) — reuse their verdict
    const stored = await readDailyVerdict(symbol);
    if (stored) {
        convictionCache.set(symbol, { expires: cacheExpiryMs(), payload: stored });
        return { ...stored, context: { ...stored.context, winRate } };
    }

    // Dedup concurrent requests for the same symbol (batch scoring can ask
    // for one symbol from several callers at once)
    if (inFlight.has(symbol)) {
        const payload = await inFlight.get(symbol);
        return { ...payload, context: { ...payload.context, winRate } };
    }

    const scoring = computeConviction({ symbol, name, winRate });
    inFlight.set(symbol, scoring);
    try {
        return await scoring;
    } finally {
        inFlight.delete(symbol);
    }
}

async function computeConviction({ symbol, name, winRate = null }) {
    // Each pillar degrades to neutral on its own — one source being down
    // must never take the whole check with it.
    const [technical, fundamental, information] = await Promise.all([
        scoreTechnical(symbol).catch(e => ({
            score: 5,
            evidence: ['Price history unavailable — scored neutral (5)']
        })),
        scoreFundamental(symbol),
        scoreInformation(symbol, name)
    ]);

    // Gemini re-scores the same facts when a key is configured
    let pillars = { technical, fundamental, information };
    let summary = null;
    let engine = 'rule-based';
    try {
        const gemini = await geminiConviction({ symbol, name, technical, fundamental, information, winRate });
        if (gemini) {
            pillars = { technical: gemini.technical, fundamental: gemini.fundamental, information: gemini.information };
            summary = gemini.summary;
            engine = GEMINI_MODEL;
        }
    } catch (e) {
        console.error(`Gemini conviction failed for ${symbol} (falling back to rule-based):`, e.message);
    }

    const confidence = Math.round(
        (pillars.technical.score * 0.45 + pillars.fundamental.score * 0.30 + pillars.information.score * 0.25) * 10
    ) / 10;
    const verdict = confidence > 6 ? 'GO' : confidence >= 5 ? 'WATCH' : 'PASS';

    const payload = {
        success: true,
        symbol,
        name: name || symbol,
        confidence,
        verdict,
        engine,
        summary,
        pillars: {
            technical: { ...pillars.technical, weight: 45 },
            fundamental: { ...pillars.fundamental, weight: 30 },
            information: { ...pillars.information, weight: 25 }
        },
        context: {
            winRate,
            note: 'Backtest win rate is context only — it is never part of the score.'
        },
        generatedAt: new Date().toISOString()
    };

    if (isAllNeutral(payload)) {
        // Sources were likely all down — hold briefly and retry, never
        // persist a blind verdict for the whole week
        convictionCache.set(symbol, { expires: Date.now() + NEUTRAL_RETRY_MS, payload });
    } else {
        convictionCache.set(symbol, { expires: cacheExpiryMs(), payload });
        await writeDailyVerdict(symbol, payload);
    }
    return payload;
}

/**
 * One-line audit string for storage/alerts: the Gemini summary when present,
 * otherwise the first evidence line of each pillar.
 */
function summarizeConviction(payload) {
    if (payload.summary) return payload.summary.slice(0, 500);
    const p = payload.pillars || {};
    return ['technical', 'fundamental', 'information']
        .map(k => p[k] && p[k].evidence && p[k].evidence[0] ? `${k[0].toUpperCase()}${k.slice(1)}: ${p[k].evidence[0]}` : null)
        .filter(Boolean)
        .join(' | ')
        .slice(0, 500);
}

module.exports = { getConviction, summarizeConviction, fetchRecentHeadlines };
