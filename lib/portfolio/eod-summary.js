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
const { repairYahooChartResult, alignToQuoteUnit, describeReport } = require('../shared/price-unit-repair');
const { formatDateDDMMYYYY } = require('../shared/date-format');
const AlertPolicy = require('../shared/alert-policy');

const YAHOO_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const GEMINI_MODEL = 'gemini-2.5-flash';

const CURRENCY = { India: '₹', UK: '£', US: '$' };

// Telegram Markdown (legacy mode) breaks on stray *_`[ characters in
// third-party headline text — strip them rather than risk a failed send.
const sanitize = s => String(s || '').replace(/[*_`\[\]]/g, '').trim();

// Round to the two decimals shown BEFORE choosing the sign: -0.001 prints "+0.00%", never "-0.00%".
// NaN stays visible ("NaN%") rather than passing for a flat day.
const pct = v => {
    const r = Math.round(v * 100) / 100;
    return (r >= 0 ? '+' : '') + r.toFixed(2) + '%';
};

/**
 * The window's closes, in the unit of the live quote.
 *
 * Yahoo steps London lines between pence and pounds inside one series, and a 5-day window
 * can also sit wholly in pounds under a quote in pence - no step in the bars to find, and
 * GVMH.L read as a "+9900%" day. So: repair the steps inside the window, then bring the
 * window into the quote's unit. Display only, which is why this does not wait for the
 * PRICE_UNIT_REPAIR switch the way the conviction gate and /yahoo/history do.
 */
function closesInQuoteUnit(result, symbol) {
    const rawCloses = result.indicators.quote[0].close;
    try {
        const { quote, report } = repairYahooChartResult(result);
        const aligned = alignToQuoteUnit(quote.close, result.meta && result.meta.regularMarketPrice);
        if (report.status !== 'clean' || aligned.factor !== 1) {
            console.log(`   ℹ️ [EOD] ${symbol} price units: ${describeReport(report)}; bars x${aligned.factor} to match the live quote`);
        }
        return aligned.prices;
    } catch (e) {
        console.log(`   ⚠️ [EOD] Price-unit repair failed for ${symbol}, using raw bars: ${e.message}`);
        return rawCloses;
    }
}

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
    const close = closesInQuoteUnit(result, symbol);
    for (let i = 0; i < (result.timestamp || []).length; i++) {
        if (close[i] != null) closes.push(close[i]);
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
     * `cache` (Map symbol → {day, news}) makes day-move + news cost one
     * network round per SYMBOL even when many subscribers hold the same stock.
     */
    async collectPosition(trade, cache) {
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

        let shared = cache ? cache.get(symbol) : null;
        if (!shared) {
            shared = { day: null, news: null };
            try {
                shared.day = await fetchDayMove(symbol);
            } catch (e) {
                console.log(`   ⚠️ [EOD] Price data unavailable for ${symbol}: ${e.message}`);
            }
            try {
                shared.news = await fetchRecentHeadlines(symbol, position.name, 1);
            } catch (e) {
                console.log(`   ⚠️ [EOD] News unavailable for ${symbol}: ${e.message}`);
            }
            if (cache) cache.set(symbol, shared);
        }

        position.day = shared.day;
        position.news = shared.news;
        if (position.day) {
            position.sinceEntryPct = (position.day.current / entryPrice - 1) * 100;
            if (position.targetPrice) {
                position.toTargetPct = (position.targetPrice / position.day.current - 1) * 100;
            }
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
            const now = new Date();
            const dateStr = formatDateDDMMYYYY(now);
            // London calendar day as YYYY-MM-DD — stable whatever TZ the server runs
            const todayLondon = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(now);
            console.log(`\n🌆 [EOD] Building end-of-day summary for ${dateStr}...`);

            const adminEmail = process.env.ADMIN_EMAIL || 'ketanjoshisahs@gmail.com';

            const { rows: trades } = await TradeDB.pool.query(`
                SELECT id, user_id, symbol, name, stock_name, market, currency_symbol,
                       entry_date, entry_price, shares, trade_size, investment_amount,
                       target_price
                FROM trades
                WHERE status = 'active'
                ORDER BY market, symbol
            `);

            // Trades that completed today — the realized side of the story.
            // Half-open range matches both midnight date-only exit_dates from the
            // exit monitor and full timestamps from manual closes; COALESCE covers
            // historic rows whose absolute profit_loss was never persisted.
            const { rows: closedTodayAll } = await TradeDB.pool.query(`
                SELECT user_id, symbol, name, stock_name, market, currency_symbol, shares,
                       entry_price, exit_price, exit_reason,
                       COALESCE(profit_loss, (exit_price - entry_price) * shares) AS pl_amount,
                       COALESCE(profit_loss_percentage,
                                CASE WHEN entry_price > 0 THEN (exit_price / entry_price - 1) * 100 END) AS pl_pct
                FROM trades
                WHERE status = 'closed'
                  AND exit_date >= $1::date AND exit_date < $1::date + INTERVAL '1 day'
                ORDER BY market, symbol
            `, [todayLondon]);

            // Subscribers whose own portfolios get a personal DM
            const subscribers = (await TradeDB.getAutoTradingUsers())
                .filter(u => u.email !== adminEmail);

            // Capital rows for the admin (public broadcast) + every subscriber
            const capitalUserIds = [adminEmail, ...subscribers.map(u => u.email)];
            const { rows: capitalRowsAll } = await TradeDB.pool.query(`
                SELECT user_id, market, currency,
                       initial_capital::float,
                       realized_pl::float,
                       available_capital::float,
                       active_positions::int
                FROM portfolio_capital
                WHERE user_id = ANY($1)
                ORDER BY user_id, market
            `, [capitalUserIds]);

            // The PUBLIC broadcast stays the admin/system portfolio, exactly as
            // before per-user auto-trading existed; subscriber rows feed DMs.
            const closedToday = closedTodayAll.filter(t => t.user_id === adminEmail || t.user_id === 'default');
            const capitalRows = capitalRowsAll.filter(r => r.user_id === adminEmail);
            const adminTrades = trades.filter(t => t.user_id === adminEmail || t.user_id === 'default');

            console.log(`🌆 [EOD] ${adminTrades.length} system position(s), ${closedToday.length} closed today, ${subscribers.length} subscriber(s)`);

            const { broadcastToSubscribers, sendTelegramAlert } = require('../telegram/telegram-bot');

            // Collect sequentially — the per-symbol cache means each symbol
            // costs one Yahoo + one news round no matter how many portfolios
            // hold it, and the pacing keeps the request rate polite.
            const symbolCache = new Map();
            const positionsByUser = new Map();
            const positions = []; // admin/system positions — the broadcast + Gemini input
            for (const trade of trades) {
                const fresh = !symbolCache.has(trade.symbol);
                const p = await this.collectPosition(trade, symbolCache);
                const isAdmin = trade.user_id === adminEmail || trade.user_id === 'default';
                if (isAdmin) positions.push(p);
                else {
                    if (!positionsByUser.has(trade.user_id)) positionsByUser.set(trade.user_id, []);
                    positionsByUser.get(trade.user_id).push(p);
                }
                if (fresh) await new Promise(resolve => setTimeout(resolve, 200));
            }

            // One AI pass over the whole portfolio (optional)
            let ai = null;
            if (positions.length > 0) {
                try {
                    ai = await geminiPortfolioSummary(positions);
                    if (ai) console.log(`🌆 [EOD] Gemini summary generated (${Object.keys(ai.bySymbol).length} positions)`);
                } catch (e) {
                    console.log(`   ⚠️ [EOD] Gemini unavailable, using rule-based lines: ${e.message}`);
                }
            }

            const flagFor = m => m === 'India' ? '🇮🇳' : m === 'UK' ? '🇬🇧' : m === 'US' ? '🇺🇸' : '📌';
            const money = (c, v) => (v < 0 ? '-' : '') + c + Math.abs(Math.round(v)).toLocaleString('en-GB');

            // Compose message, chunking at position boundaries under the
            // 4096-char Telegram limit.
            const header = `🌆 *EOD Portfolio Summary — ${dateStr}*\n`
                + `${positions.length} open position${positions.length === 1 ? '' : 's'}`
                + ` · ${closedToday.length} closed today\n\n`;
            const blocks = [];

            // Closed-today section first — the day's realized outcomes.
            // Each trade is its own block so the chunker can split between them
            // (one giant block could silently blow Telegram's 4096-char limit).
            if (closedToday.length > 0) {
                blocks.push(`🔒 *Closed today (${closedToday.length})*\n`);
                for (const t of closedToday) {
                    const c = t.currency_symbol || CURRENCY[t.market] || '';
                    const plAmount = t.pl_amount != null ? parseFloat(t.pl_amount) : null;
                    const plPct = t.pl_pct != null ? parseFloat(t.pl_pct) : null;
                    blocks.push(`${flagFor(t.market)} *${sanitize(t.name || t.stock_name || t.symbol)}* (${t.symbol})\n`
                        + `${c}${parseFloat(t.entry_price).toFixed(2)} → ${t.exit_price != null ? c + parseFloat(t.exit_price).toFixed(2) : 'n/a'}`
                        + (plAmount != null ? ` | P/L: ${plAmount >= 0 ? '+' : ''}${money(c, plAmount)}` : '')
                        + (plPct != null ? ` (${pct(plPct)})` : '')
                        + (t.exit_reason ? ` | ${sanitize(t.exit_reason)}` : '')
                        + '\n');
                }
            }

            if (positions.length === 0) {
                blocks.push('No open positions.\n');
            }
            positions.forEach(p => {
                const summary = ai ? ai.bySymbol[p.symbol.toUpperCase()] : this.ruleBasedLine(p);
                blocks.push(this.formatPosition(p, summary));
            });

            // Portfolio growth vs the starting capital — realized only, so it
            // moves when trades complete (the number the owner asked to see)
            if (capitalRows.length > 0) {
                let pb = `📊 *Portfolio*\n`;
                for (const r of capitalRows) {
                    const c = CURRENCY[r.market] || '';
                    const total = r.initial_capital + r.realized_pl;
                    const growthPct = r.initial_capital > 0 ? (r.realized_pl / r.initial_capital) * 100 : 0;
                    pb += `${flagFor(r.market)} ${r.market}: ${money(c, total)} (${pct(growthPct)} vs ${money(c, r.initial_capital)} start)`
                        + ` | Realized: ${r.realized_pl >= 0 ? '+' : ''}${money(c, r.realized_pl)}`
                        + ` | ${r.active_positions} open\n`;
                }
                blocks.push(pb);
            }

            if (ai && ai.overall) {
                blocks.push(`🤖 *Overall*: ${sanitize(ai.overall)}\n`);
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

            // Personal EOD DM for every auto-trading subscriber with a linked
            // Telegram: THEIR positions, THEIR closes, THEIR portfolio growth.
            // Rule-based lines only (the shared symbol cache already holds the
            // day moves and news counts — no extra network, no extra Gemini).
            let subscriberDMs = 0;
            for (const sub of subscribers) {
                if (!sub.telegram_chat_id) continue;
                try {
                    const myPositions = positionsByUser.get(sub.email) || [];
                    const myClosed = closedTodayAll.filter(t => t.user_id === sub.email);
                    const myCapital = capitalRowsAll.filter(r => r.user_id === sub.email);
                    if (myPositions.length === 0 && myClosed.length === 0) continue;
                    // No switch of its own: the evening summary answers to the
                    // master switch ("Your own alerts") alone
                    if (!(await AlertPolicy.ownerWantsAlert(() => TradeDB.getAlertPreferences(sub.email), 'eod'))) continue;

                    let dm = `🌆 *Your EOD Summary — ${dateStr}*\n`
                        + `${myPositions.length} open · ${myClosed.length} closed today\n\n`;

                    if (myClosed.length > 0) {
                        dm += `🔒 *Closed today*\n`;
                        for (const t of myClosed) {
                            const c = t.currency_symbol || CURRENCY[t.market] || '';
                            const plAmount = t.pl_amount != null ? parseFloat(t.pl_amount) : null;
                            const plPct = t.pl_pct != null ? parseFloat(t.pl_pct) : null;
                            dm += `${flagFor(t.market)} *${sanitize(t.name || t.stock_name || t.symbol)}*`
                                + (plAmount != null ? ` — P/L ${plAmount >= 0 ? '+' : ''}${money(c, plAmount)}` : '')
                                + (plPct != null ? ` (${pct(plPct)})` : '')
                                + (t.exit_reason ? ` | ${sanitize(t.exit_reason)}` : '')
                                + `\n`;
                        }
                        dm += `\n`;
                    }

                    for (const p of myPositions) {
                        dm += `${flagFor(p.market)} *${sanitize(p.name || p.symbol)}*: `
                            + (p.day
                                ? `${p.currency}${p.day.current.toFixed(2)} (${pct(p.day.dayMovePct)}) | since entry ${pct(p.sinceEntryPct)}`
                                : 'price data unavailable')
                            + ` | held ${p.daysHeld}d\n`;
                    }

                    if (myCapital.length > 0) {
                        dm += `\n📊 *Your portfolio*\n`;
                        for (const r of myCapital) {
                            const c = CURRENCY[r.market] || '';
                            const total = r.initial_capital + r.realized_pl;
                            const growthPct = r.initial_capital > 0 ? (r.realized_pl / r.initial_capital) * 100 : 0;
                            dm += `${flagFor(r.market)} ${r.market}: ${money(c, total)} (${pct(growthPct)}) | ${r.active_positions} open\n`;
                        }
                    }

                    // Split defensively at line boundaries under the 4096 limit
                    if (dm.length <= 3900) {
                        await sendTelegramAlert(sub.telegram_chat_id, { type: 'custom', message: dm });
                    } else {
                        let part = '';
                        for (const line of dm.split('\n')) {
                            if ((part + line).length > 3800) {
                                await sendTelegramAlert(sub.telegram_chat_id, { type: 'custom', message: part.trimEnd() });
                                part = '';
                            }
                            part += line + '\n';
                        }
                        if (part.trim()) {
                            await sendTelegramAlert(sub.telegram_chat_id, { type: 'custom', message: part.trimEnd() });
                        }
                    }
                    subscriberDMs++;
                } catch (e) {
                    console.log(`   ⚠️ [EOD] Subscriber DM failed for ${sub.email}: ${e.message}`);
                }
            }
            if (subscribers.length > 0) {
                console.log(`🌆 [EOD] Personal DMs sent to ${subscriberDMs}/${subscribers.length} subscriber(s)`);
            }

            // Push notification
            try {
                const PushService = require('../push/push-service');
                const pushService = new PushService(TradeDB);
                if (pushService.isConfigured) {
                    await pushService.broadcast({
                        title: '🌆 EOD Portfolio Summary',
                        body: `${positions.length} open position(s) — day recap ready`,
                        icon: '/images/brand/app-icon.png',
                        badge: '/images/brand/app-icon.png',
                        tag: 'eod-summary',
                        url: '/account.html'
                    });
                }
            } catch (e) {
                console.log(`   ⚠️ [EOD] Push notification failed: ${e.message}`);
            }

            return {
                success: true,
                positions: positions.length,
                closedToday: closedToday.length,
                subscriberDMs,
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
module.exports.fetchDayMove = fetchDayMove;
module.exports.pct = pct;
