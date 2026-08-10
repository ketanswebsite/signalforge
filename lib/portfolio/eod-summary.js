/**
 * End-of-day AI portfolio summary — 7 PM UK, weekdays.
 *
 * For every open position (trades with status 'active'):
 *   - the position itself (shares, entry, size, days held)
 *   - that day's price movement (latest close/price vs previous close)
 *   - that day's news headlines (1-day Google News window, sentiment-tagged)
 * Optionally one Gemini call turns the collected facts into per-position
 * summaries plus a portfolio overview (rule-based lines otherwise).
 * Delivered via Telegram broadcast (type 'portfolio' → reaches 'all'
 * subscribers) and web push.
 *
 * Cron lives in lib/scanner/scanner.js (the cron hub); manual trigger is
 * POST /api/ops/eod-summary?token=ANALYSIS_API_TOKEN.
 */

const axios = require('axios');
const TradeDB = require('../../database-postgres');
const { fetchRecentHeadlines } = require('../../ml/conviction-engine');

const YAHOO_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const GEMINI_MODEL = 'gemini-2.5-flash';

const CURRENCY = { India: '₹', UK: '£', US: '$' };

// Telegram Markdown (legacy mode) breaks on stray *_`[ characters in
// third-party headline text — strip them rather than risk a failed send.
const sanitize = s => String(s || '').replace(/[*_`\[\]]/g, '').trim();

const pct = v => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';

/**
 * Latest price + previous distinct-day close from the Yahoo 5-day chart.
 * At 7 PM UK: India/UK bars are final closes; the US bar is the live
 * mid-session price — "today's movement so far", which is what we want.
 */
async function fetchDayMove(symbol) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
    const { data } = await axios.get(url, {
        params: { range: '5d', interval: '1d' },
        headers: { 'User-Agent': YAHOO_UA, 'Accept': 'application/json' },
        timeout: 15000
    });
    const result = data && data.chart && data.chart.result && data.chart.result[0];
    if (!result || !result.indicators.quote[0]) throw new Error('No chart data');

    const closes = [];
    const q = result.indicators.quote[0];
    for (let i = 0; i < (result.timestamp || []).length; i++) {
        if (q.close[i] != null) closes.push(q.close[i]);
    }
    if (closes.length < 2) throw new Error('Not enough bars');

    const current = result.meta && result.meta.regularMarketPrice
        ? result.meta.regularMarketPrice
        : closes[closes.length - 1];
    const prevClose = closes[closes.length - 2];
    return {
        current: parseFloat(current),
        prevClose: parseFloat(prevClose),
        dayMovePct: (current / prevClose - 1) * 100
    };
}

/**
 * One Gemini call for the whole portfolio: 1-2 sentence summary per position
 * plus a 2-3 sentence overall picture. Returns null (rule-based fallback)
 * when no key is configured or the call fails.
 */
async function geminiPortfolioSummary(positions) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;

    const facts = positions.map(p => ({
        symbol: p.symbol,
        market: p.market,
        daysHeld: p.daysHeld,
        dayMovePercent: p.day ? +p.day.dayMovePct.toFixed(2) : null,
        sinceEntryPercent: p.sinceEntryPct != null ? +p.sinceEntryPct.toFixed(2) : null,
        percentToTarget: p.toTargetPct != null ? +p.toTargetPct.toFixed(2) : null,
        todaysHeadlines: p.news ? p.news.headlines.map(h => h.title) : []
    }));

    const prompt =
        'You are writing the end-of-day note for a swing-trade portfolio ' +
        '(+8% target, −5% stop, 30-day max hold per position).\n' +
        'For each position, write a 1-2 sentence factual summary of its day using ONLY the facts given ' +
        '(day move, progress since entry, distance to target, today\'s headlines). ' +
        'Every sentence must contain a number or cite a headline. ' +
        'Neither cheerlead nor auto-sceptic. ' +
        'Then write a 2-3 sentence overall portfolio picture.\n\n' +
        'Facts:\n' + JSON.stringify(facts, null, 2);

    const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: {
                type: 'object',
                properties: {
                    positions: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                symbol: { type: 'string' },
                                summary: { type: 'string' }
                            },
                            required: ['symbol', 'summary']
                        }
                    },
                    overall: { type: 'string' }
                },
                required: ['positions', 'overall']
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
    const bySymbol = {};
    (parsed.positions || []).forEach(p => {
        if (p && p.symbol && typeof p.summary === 'string') {
            bySymbol[p.symbol.toUpperCase()] = p.summary.slice(0, 400);
        }
    });
    return {
        bySymbol,
        overall: typeof parsed.overall === 'string' ? parsed.overall.slice(0, 600) : null
    };
}

class EODSummary {
    constructor() {
        this.isRunning = false;
    }

    /**
     * Collect facts for one open trade. Data failures degrade per-field
     * (position still appears in the summary, with what we could fetch).
     */
    async collectPosition(trade) {
        const symbol = trade.symbol;
        const entryPrice = parseFloat(trade.entry_price);
        const entryDate = new Date(trade.entry_date);
        const daysHeld = Math.max(0, Math.round((Date.now() - entryDate.getTime()) / (24 * 60 * 60 * 1000)));

        const position = {
            symbol,
            name: trade.name || trade.stock_name || null,
            market: trade.market,
            currency: trade.currency_symbol || CURRENCY[trade.market] || '',
            entryPrice,
            entryDate,
            daysHeld,
            shares: trade.shares != null ? parseFloat(trade.shares) : null,
            size: trade.trade_size != null ? parseFloat(trade.trade_size)
                : (trade.investment_amount != null ? parseFloat(trade.investment_amount) : null),
            targetPrice: trade.target_price != null ? parseFloat(trade.target_price) : null,
            day: null,
            sinceEntryPct: null,
            toTargetPct: null,
            news: null
        };

        try {
            position.day = await fetchDayMove(symbol);
            position.sinceEntryPct = (position.day.current / entryPrice - 1) * 100;
            if (position.targetPrice) {
                position.toTargetPct = (position.targetPrice / position.day.current - 1) * 100;
            }
        } catch (e) {
            console.log(`   ⚠️ [EOD] Price data unavailable for ${symbol}: ${e.message}`);
        }

        try {
            position.news = await fetchRecentHeadlines(symbol, position.name, 1);
        } catch (e) {
            console.log(`   ⚠️ [EOD] News unavailable for ${symbol}: ${e.message}`);
        }

        return position;
    }

    formatPosition(p, aiSummary) {
        const flag = p.market === 'India' ? '🇮🇳' : p.market === 'UK' ? '🇬🇧' : p.market === 'US' ? '🇺🇸' : '📌';
        const c = p.currency;

        let block = `${flag} *${sanitize(p.name || p.symbol)}* (${p.symbol})\n`;
        block += `Position: ${p.shares != null ? p.shares.toFixed(p.shares >= 100 ? 0 : 2) + ' shares' : 'size n/a'}`
            + ` @ ${c}${p.entryPrice.toFixed(2)}`
            + (p.size != null ? ` — ${c}${Math.round(p.size).toLocaleString('en-GB')}` : '')
            + ` | held ${p.daysHeld}d\n`;

        if (p.day) {
            block += `Today: ${c}${p.day.current.toFixed(2)} (${pct(p.day.dayMovePct)})`
                + ` | Since entry: ${pct(p.sinceEntryPct)}`
                + (p.toTargetPct != null ? ` | To target: ${pct(p.toTargetPct)}` : '')
                + `\n`;
        } else {
            block += `Today: price data unavailable\n`;
        }

        if (p.news && p.news.headlines.length > 0) {
            block += `News today: ${p.news.headlines.length} headline${p.news.headlines.length === 1 ? '' : 's'}`
                + ` (${p.news.pos} pos / ${p.news.neg} neg)\n`;
            p.news.headlines.slice(0, 3).forEach(h => {
                const icon = h.tone === 'pos' ? '🟢' : h.tone === 'neg' ? '🔴' : '⚪';
                block += `${icon} ${sanitize(h.title).slice(0, 90)}\n`;
            });
        } else {
            block += `News today: none found\n`;
        }

        if (aiSummary) {
            block += `🤖 ${sanitize(aiSummary)}\n`;
        }
        return block;
    }

    /**
     * Rule-based per-position line when Gemini is not available.
     */
    ruleBasedLine(p) {
        if (!p.day) return null;
        const bits = [`Day ${pct(p.day.dayMovePct)}`, `since entry ${pct(p.sinceEntryPct)}`];
        if (p.toTargetPct != null) bits.push(`${pct(p.toTargetPct)} to target`);
        if (p.news && p.news.headlines.length > 0) {
            bits.push(`${p.news.headlines.length} headlines (${p.news.pos}+/${p.news.neg}−)`);
        }
        return bits.join(', ') + '.';
    }

    async sendEODSummary() {
        if (this.isRunning) {
            return { error: 'EOD summary already running' };
        }
        this.isRunning = true;

        try {
            const dateStr = new Date().toLocaleDateString('en-GB', { timeZone: 'Europe/London' });
            console.log(`\n🌆 [EOD] Building end-of-day summary for ${dateStr}...`);

            const { rows: trades } = await TradeDB.pool.query(`
                SELECT id, symbol, name, stock_name, market, currency_symbol,
                       entry_date, entry_price, shares, trade_size, investment_amount,
                       target_price
                FROM trades
                WHERE status = 'active'
                ORDER BY market, symbol
            `);

            console.log(`🌆 [EOD] ${trades.length} open position(s)`);

            const { broadcastToSubscribers } = require('../telegram/telegram-bot');

            if (trades.length === 0) {
                const msg = `🌆 *EOD Portfolio Summary — ${dateStr}*\n\nNo open positions.`;
                await broadcastToSubscribers({ type: 'custom', message: msg }, 'portfolio');
                return { success: true, positions: 0 };
            }

            // Collect sequentially — a handful of positions, and it keeps the
            // Yahoo/news request rate polite.
            const positions = [];
            for (const trade of trades) {
                positions.push(await this.collectPosition(trade));
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            // One AI pass over the whole portfolio (optional)
            let ai = null;
            try {
                ai = await geminiPortfolioSummary(positions);
                if (ai) console.log(`🌆 [EOD] Gemini summary generated (${Object.keys(ai.bySymbol).length} positions)`);
            } catch (e) {
                console.log(`   ⚠️ [EOD] Gemini unavailable, using rule-based lines: ${e.message}`);
            }

            // Compose message, chunking at position boundaries under the
            // 4096-char Telegram limit.
            const header = `🌆 *EOD Portfolio Summary — ${dateStr}*\n${positions.length} open position${positions.length === 1 ? '' : 's'}\n\n`;
            const blocks = positions.map(p => {
                const summary = ai ? ai.bySymbol[p.symbol.toUpperCase()] : this.ruleBasedLine(p);
                return this.formatPosition(p, summary);
            });
            if (ai && ai.overall) {
                blocks.push(`📊 *Overall*: ${sanitize(ai.overall)}\n`);
            }

            const chunks = [];
            let current = header;
            for (const block of blocks) {
                if ((current + block).length > 3800) {
                    chunks.push(current.trimEnd());
                    current = '';
                }
                current += block + '\n';
            }
            if (current.trim()) chunks.push(current.trimEnd());

            for (const chunk of chunks) {
                await broadcastToSubscribers({ type: 'custom', message: chunk }, 'portfolio');
            }
            console.log(`🌆 [EOD] Sent ${chunks.length} Telegram message(s)`);

            // Push notification
            try {
                const PushService = require('../push/push-service');
                const pushService = new PushService(TradeDB);
                if (pushService.isConfigured) {
                    await pushService.broadcast({
                        title: '🌆 EOD Portfolio Summary',
                        body: `${positions.length} open position(s) — day recap ready`,
                        icon: '/images/favicon.PNG',
                        badge: '/images/favicon.PNG',
                        tag: 'eod-summary',
                        url: '/account'
                    });
                }
            } catch (e) {
                console.log(`   ⚠️ [EOD] Push notification failed: ${e.message}`);
            }

            return {
                success: true,
                positions: positions.length,
                messages: chunks.length,
                engine: ai ? GEMINI_MODEL : 'rule-based'
            };
        } catch (error) {
            console.error('🌆 [EOD] Failed:', error);
            return { success: false, error: error.message };
        } finally {
            this.isRunning = false;
        }
    }
}

module.exports = new EODSummary();
