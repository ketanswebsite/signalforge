/**
 * Market Cap Service
 * Market caps for the scan universe from Yahoo's v7 quote endpoint, 50 symbols a request
 * (lib/shared/yahoo-client.js), cached in stock_market_caps. The 7 AM scan ranks its signals by
 * them (and the 1 PM executor books them in that order), the executor logs them and the trade
 * dialog shows the size badge.
 *
 * Until 2026-09 the refresh read meta.marketCap from the v8 chart endpoint, one request per
 * symbol. That answer has no market-cap field, so every weekday ~5,000 requests stored nothing,
 * silently. The v7 quote carries marketCap, though not for every symbol (RELIANCE.NS came back
 * without one on 2026-09-24), so every run ends with one line that counts, by market, what it
 * stored and why the rest was not.
 */

const TradeDB = require('../../database-postgres');
const YahooClient = require('./yahoo-client');
// The dead-ticker record (GAPS #10): which symbols Yahoo's quote answer knows, noted from the requests made anyway
const TickerHealth = require('./ticker-health');

// Exchange rates for USD conversion (approximate, updated periodically)
const EXCHANGE_RATES = {
    'USD': 1.0,
    'GBP': 1.27,
    'GBX': 0.0127,  // British pence to USD
    'INR': 0.012,
    'EUR': 1.08
};

/**
 * Categorize market cap based on USD value
 * @param {number} marketCapUSD - Market cap in USD
 * @returns {string} Category: 'mega', 'large', 'mid', 'small', or 'micro'
 */
function categorizeMarketCap(marketCapUSD) {
    if (!marketCapUSD || marketCapUSD <= 0) return null;
    if (marketCapUSD >= 200e9) return 'mega';      // > $200B
    if (marketCapUSD >= 10e9) return 'large';      // $10B - $200B
    if (marketCapUSD >= 2e9) return 'mid';         // $2B - $10B
    if (marketCapUSD >= 300e6) return 'small';     // $300M - $2B
    return 'micro';                                 // < $300M
}

/**
 * Convert market cap to USD for cross-market comparison
 * @param {number} marketCap - Market cap in local currency
 * @param {string} currency - Currency code
 * @returns {number} Market cap in USD
 */
function convertToUSD(marketCap, currency) {
    if (!marketCap) return null;
    const rate = EXCHANGE_RATES[currency] || 1;
    return marketCap * rate;
}

/**
 * Format market cap for display
 * @param {number} marketCapUSD - Market cap in USD
 * @returns {string} Formatted string (e.g., "$2.5T", "$150B", "$25M")
 */
function formatMarketCap(marketCapUSD) {
    if (!marketCapUSD) return 'N/A';
    if (marketCapUSD >= 1e12) return `$${(marketCapUSD / 1e12).toFixed(2)}T`;
    if (marketCapUSD >= 1e9) return `$${(marketCapUSD / 1e9).toFixed(2)}B`;
    if (marketCapUSD >= 1e6) return `$${(marketCapUSD / 1e6).toFixed(2)}M`;
    return `$${marketCapUSD.toLocaleString()}`;
}

/**
 * The row to store for one v7 quote, or why there is none.
 *
 * Yahoo states a London line's market cap in pounds even though it quotes the price in pence:
 * VOD.L on 2026-09-24 had currency GBp, price 125 and marketCap 28,887,914,496, which is its
 * 23,110,332,966 shares at £1.25. So a GBp (or GBX) cap is stored as GBP.
 * @param {object} quote - one quote object of Yahoo's v7 answer
 * @returns {{row: {marketCap: number, marketCapUSD: number, currency: string, category: string}}
 *   | {skip: 'noCap'|'unknownCurrency'}}
 */
function capFromQuote(quote) {
    const marketCap = Number(quote && quote.marketCap);
    if (!Number.isFinite(marketCap) || marketCap <= 0) return { skip: 'noCap' };
    const quoted = quote.currency || 'USD';
    const currency = (quoted === 'GBp' || quoted === 'GBX') ? 'GBP' : quoted;
    // A cap in a currency without a rate here would be ranked as if it were dollars
    if (!EXCHANGE_RATES[currency]) return { skip: 'unknownCurrency' };
    const marketCapUSD = convertToUSD(marketCap, currency);
    return { row: { marketCap, marketCapUSD, currency, category: categorizeMarketCap(marketCapUSD) } };
}

const marketOf = symbol => (symbol.endsWith('.NS') ? 'India' : symbol.endsWith('.L') ? 'UK' : 'US');

// Three failed quote requests in a row (Yahoo down, no crumb, throttled) end the run: the rest
// of the universe is skipped rather than hammered
const MAX_FAILED_REQUESTS_IN_A_ROW = 3;

// Yahoo throttles some networks with 429s (the server's 06:00 run on 2026-09-25 met them on all three requests while
// the chart endpoint still answered it): a throttled request waits and asks again, twice (60 s, then 120 s), before
// it counts as failed
const THROTTLE_BACKOFF_MS = 60000;
const THROTTLE_RETRIES = 2;
const isThrottled = error => Number(error && error.response && error.response.status) === 429;

async function quotesWithBackoff(batch, backoffMs, results) {
    for (let attempt = 0; ; attempt++) {
        try {
            return await YahooClient.fetchQuotes(batch);
        } catch (error) {
            if (!isThrottled(error) || attempt >= THROTTLE_RETRIES) throw error;
            results.throttled++;
            const wait = backoffMs * (attempt + 1);
            console.warn(`[MARKET CAP] Yahoo answered 429 at the ${error.yahooStep || 'quote'} step; asking again in ${Math.round(wait / 1000)} s`);
            if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
        }
    }
}

/** The run in one line, e.g. "Update complete: 2741 of 5029 stored (India 0/2187, UK 780/842, US 1961/2000); ..." */
function summarizeUpdate(results) {
    const markets = Object.entries(results.byMarket).map(([market, c]) => `${market} ${c.updated}/${c.requested}`).join(', ');
    return `Update complete: ${results.updated} of ${results.requested} stored (${markets}); ` +
        `no cap ${results.noCap}, unknown currency ${results.unknownCurrency}, not quoted ${results.notQuoted}, ` +
        `failed ${results.failed}, skipped ${results.skipped}; ` +
        `${results.requests} quote requests, ${results.failedRequests} failed` +
        (results.error ? `; last error: ${results.error}` : '');
}

/**
 * Refresh the stored market caps: Yahoo's v7 quote, `batchSize` symbols a request (at most 50),
 * `delayMs` apart. A request Yahoo throttles (429) waits and asks again twice (`throttleBackoffMs`, then twice
 * that); a request that still fails (after the client's one retry on a 401) counts its symbols as failed, and
 * three in a row stop the run. Never throws for Yahoo's sake. Ends with one
 * summary line, logged as an error when nothing was stored.
 *
 * Every requested symbol lands in exactly one count:
 *   updated          stored
 *   noCap            quoted, but without a market cap
 *   unknownCurrency  a cap in a currency with no rate in EXCHANGE_RATES
 *   notQuoted        missing from Yahoo's answer (a symbol Yahoo does not know)
 *   failed           its request failed, or the database refused its row
 *   skipped          never requested: the run stopped after failed requests
 * The same answers go to the dead-ticker record (lib/shared/ticker-health.js): quoted (with the day of the last trade),
 * not quoted, or in a request that failed. That write never throws and does not change the counts.
 * @param {string[]} symbols - Array of stock symbols
 * @param {number} batchSize - Symbols per quote request (1-50)
 * @param {number} delayMs - Pause between quote requests in milliseconds
 * @param {{throttleBackoffMs?: number}} [options]
 * @returns {Promise<object>} the counts, requests and failedRequests, throttled (429s met and waited out), byMarket
 *   ({India|UK|US: {requested, updated}}), error (the last failure's message, or null) and errorStep (the step
 *   Yahoo refused: cookie, crumb or quote, or null)
 */
async function updateMarketCaps(symbols, batchSize = YahooClient.QUOTE_BATCH_MAX, delayMs = 1000, { throttleBackoffMs = THROTTLE_BACKOFF_MS } = {}) {
    const size = Math.max(1, Math.min(YahooClient.QUOTE_BATCH_MAX, batchSize));
    const results = {
        requested: symbols.length, updated: 0, noCap: 0, unknownCurrency: 0, notQuoted: 0, failed: 0, skipped: 0,
        requests: 0, failedRequests: 0, throttled: 0, byMarket: {}, error: null, errorStep: null
    };
    for (const symbol of symbols) {
        const counts = results.byMarket[marketOf(symbol)] || (results.byMarket[marketOf(symbol)] = { requested: 0, updated: 0 });
        counts.requested++;
    }

    console.log(`[MARKET CAP] Starting update for ${symbols.length} stocks, ${size} a quote request...`);
    const health = TickerHealth.startRun('market-caps');

    let failedInARow = 0;
    for (let i = 0; i < symbols.length; i += size) {
        if (failedInARow >= MAX_FAILED_REQUESTS_IN_A_ROW) {
            results.skipped = symbols.length - i;
            break;
        }
        const batch = symbols.slice(i, i + size);
        if (i > 0 && delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));

        results.requests++;
        let quotes;
        try {
            quotes = await quotesWithBackoff(batch, throttleBackoffMs, results);
            failedInARow = 0;
        } catch (error) {
            results.failedRequests++;
            results.failed += batch.length;
            results.error = error.message;
            results.errorStep = error.yahooStep || null;
            failedInARow++;
            // a failed request says nothing about any one of its symbols: noted as a passing failure
            health.requestFailed(batch, error);
            continue;
        }

        // File each quote under the symbol as asked, whatever case Yahoo writes it in
        const asked = new Map(batch.map(symbol => [symbol.toUpperCase(), symbol]));
        const answered = new Set();
        for (const quote of quotes) {
            const symbol = asked.get(String(quote && quote.symbol).toUpperCase());
            if (!symbol || answered.has(symbol)) continue;
            answered.add(symbol);
            health.quoted(symbol, quote);

            const cap = capFromQuote(quote);
            if (cap.skip) {
                results[cap.skip]++;
                continue;
            }
            try {
                await TradeDB.storeMarketCap(symbol, cap.row.marketCap, cap.row.marketCapUSD, cap.row.category, cap.row.currency);
                results.updated++;
                results.byMarket[marketOf(symbol)].updated++;
            } catch (error) {
                results.failed++;
                results.error = error.message;
            }
        }
        results.notQuoted += batch.length - answered.size;
        for (const symbol of batch) if (!answered.has(symbol)) health.notQuoted(symbol);
    }

    const summary = `[MARKET CAP] ${summarizeUpdate(results)}`;
    if (results.updated === 0 && results.requested > 0) console.error(summary);
    else console.log(summary);
    await health.flush();
    return results;
}

/**
 * Get market cap from cache (database)
 * @param {string} symbol - Stock symbol
 * @returns {Promise<object|null>} Cached market cap data or null
 */
async function getMarketCap(symbol) {
    return await TradeDB.getMarketCap(symbol);
}

/**
 * Get market caps for multiple symbols from cache
 * @param {string[]} symbols - Array of stock symbols
 * @returns {Promise<object>} Map of symbol to market cap data
 */
async function getMarketCaps(symbols) {
    return await TradeDB.getMarketCaps(symbols);
}

/**
 * Enrich opportunities with market cap data
 * @param {object[]} opportunities - Array of trade opportunities
 * @returns {Promise<object[]>} Opportunities enriched with market cap data
 */
async function enrichOpportunitiesWithMarketCap(opportunities) {
    if (!opportunities || opportunities.length === 0) return opportunities;

    // Get all symbols from opportunities
    const symbols = opportunities.map(opp => {
        // Handle different opportunity structures
        return opp.stock?.symbol || opp.symbol || opp.trade?.symbol;
    }).filter(Boolean);

    // Bulk fetch market caps
    const marketCaps = await getMarketCaps(symbols);

    // Enrich each opportunity
    return opportunities.map(opp => {
        const symbol = opp.stock?.symbol || opp.symbol || opp.trade?.symbol;
        const capData = marketCaps[symbol];

        if (capData) {
            opp.marketCapUSD = capData.marketCapUSD;
            opp.marketCapCategory = capData.category;
            opp.marketCapFormatted = formatMarketCap(capData.marketCapUSD);
        } else {
            opp.marketCapUSD = null;
            opp.marketCapCategory = null;
            opp.marketCapFormatted = 'N/A';
        }

        return opp;
    });
}

/**
 * Sort opportunities by market cap (highest first)
 * @param {object[]} opportunities - Array of trade opportunities
 * @returns {object[]} Sorted opportunities with market cap rank
 */
function sortByMarketCap(opportunities) {
    // Sort by market cap USD (descending), nulls last
    const sorted = [...opportunities].sort((a, b) => {
        const capA = a.marketCapUSD || 0;
        const capB = b.marketCapUSD || 0;

        // Primary sort: market cap (highest first)
        if (capB !== capA) {
            return capB - capA;
        }

        // Secondary sort: win rate (highest first)
        const winRateA = a.trade?.winRate || a.winRate || 0;
        const winRateB = b.trade?.winRate || b.winRate || 0;
        return winRateB - winRateA;
    });

    // Add market cap rank (1 = highest market cap)
    return sorted.map((opp, index) => {
        opp.marketCapRank = index + 1;
        return opp;
    });
}

/**
 * Get market cap statistics
 * @returns {Promise<object>} Statistics about cached market caps
 */
async function getStats() {
    return await TradeDB.getMarketCapStats();
}

module.exports = {
    capFromQuote,
    updateMarketCaps,
    getMarketCap,
    getMarketCaps,
    enrichOpportunitiesWithMarketCap,
    sortByMarketCap,
    formatMarketCap,
    categorizeMarketCap,
    convertToUSD,
    getStats,
    EXCHANGE_RATES
};
