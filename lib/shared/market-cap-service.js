/**
 * Market Cap Service
 * Fetches and caches market cap data from Yahoo Finance
 * Used to prioritize stocks by company size during scanning and trade execution
 */

const axios = require('axios');
const TradeDB = require('../../database-postgres');

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
 * Fetch market cap data from Yahoo Finance for a single stock
 * @param {string} symbol - Stock symbol (e.g., 'AAPL', 'RELIANCE.NS', 'VOD.L')
 * @returns {Promise<object|null>} Market cap data or null if fetch fails
 */
async function fetchMarketCap(symbol) {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;

        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            },
            timeout: 10000
        });

        const data = response.data;
        if (data.chart && data.chart.result && data.chart.result.length > 0) {
            const meta = data.chart.result[0].meta;
            const marketCap = meta.marketCap || null;
            const currency = meta.currency || 'USD';

            if (marketCap && marketCap > 0) {
                const marketCapUSD = convertToUSD(marketCap, currency);
                const category = categorizeMarketCap(marketCapUSD);

                return {
                    symbol,
                    marketCap,
                    marketCapUSD,
                    currency,
                    category
                };
            }
        }

        return null;
    } catch (error) {
        // Silently fail for individual stock errors - common for delisted stocks
        return null;
    }
}

/**
 * Fetch and store market cap for a single stock
 * @param {string} symbol - Stock symbol
 * @returns {Promise<object|null>} Stored market cap data or null
 */
async function fetchAndStoreMarketCap(symbol) {
    try {
        const data = await fetchMarketCap(symbol);

        if (data && data.marketCapUSD) {
            await TradeDB.storeMarketCap(
                symbol,
                data.marketCap,
                data.marketCapUSD,
                data.category,
                data.currency
            );
            return data;
        }

        return null;
    } catch (error) {
        console.error(`[MARKET CAP] Error fetching/storing for ${symbol}:`, error.message);
        return null;
    }
}

/**
 * Update market caps for multiple stocks in batches
 * @param {string[]} symbols - Array of stock symbols
 * @param {number} batchSize - Number of stocks to process in each batch
 * @param {number} delayMs - Delay between API calls in milliseconds
 * @returns {Promise<object>} Result with updated and failed counts
 */
async function updateMarketCaps(symbols, batchSize = 50, delayMs = 100) {
    const results = { updated: 0, failed: 0, skipped: 0 };

    console.log(`[MARKET CAP] Starting update for ${symbols.length} stocks...`);

    for (let i = 0; i < symbols.length; i++) {
        const symbol = symbols[i];

        try {
            const data = await fetchAndStoreMarketCap(symbol);

            if (data) {
                results.updated++;
            } else {
                results.failed++;
            }

            // Log progress every 100 stocks
            if ((i + 1) % 100 === 0) {
                console.log(`[MARKET CAP] Progress: ${i + 1}/${symbols.length} (Updated: ${results.updated}, Failed: ${results.failed})`);
            }

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, delayMs));

        } catch (error) {
            results.failed++;
        }
    }

    console.log(`[MARKET CAP] Update complete: ${results.updated} updated, ${results.failed} failed`);
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
    fetchMarketCap,
    fetchAndStoreMarketCap,
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
