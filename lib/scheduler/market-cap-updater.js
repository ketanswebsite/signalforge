/**
 * Market Cap Updater Scheduler
 * Runs daily at 6 AM UK time to update market cap data for all stocks
 * This runs before the 7 AM scanner to ensure fresh market cap data is available
 */

const cron = require('node-cron');
const { getAllStocks } = require('../shared/stock-data');
const MarketCapService = require('../shared/market-cap-service');
const TradeDB = require('../../database-postgres');

class MarketCapUpdater {
    constructor() {
        this.isInitialized = false;
        this.isUpdating = false;
        this.lastUpdateResult = null;
    }

    /**
     * Initialize the scheduler
     */
    initialize() {
        if (this.isInitialized) {
            console.log('[MARKET CAP UPDATER] Already initialized');
            return;
        }

        console.log('\n📊 Initializing Market Cap Updater...');

        // Schedule daily update at 6 AM UK time (before 7 AM scanner)
        cron.schedule('0 6 * * 1-5', async () => {
            const ukTime = new Date().toLocaleString("en-GB", { timeZone: "Europe/London" });
            console.log(`\n📊 [MARKET CAP] Daily update triggered at UK time: ${ukTime}`);
            await this.updateAllMarketCaps();
        }, {
            timezone: "Europe/London",
            scheduled: true
        });

        console.log('   ✓ Daily update scheduled: 6:00 AM UK (Mon-Fri)');

        // Also schedule a weekend update on Saturday morning for good measure,
        // except on sweep day: the monthly AI sweep starts at the same 08:00 and
        // reads the same Yahoo chart endpoint for every symbol, and this walk
        // takes 40-55 minutes. Both at once get throttled, and a throttled sweep
        // stores nothing (blind verdicts). Monday's 06:00 update refreshes the
        // caps before the next scan.
        cron.schedule('0 8 * * 6', async () => {
            if (this.yieldsToSweep()) {
                console.log('📊 [MARKET CAP] Weekend update skipped: sweep day, the monthly AI sweep has Yahoo this morning');
                return;
            }
            const ukTime = new Date().toLocaleString("en-GB", { timeZone: "Europe/London" });
            console.log(`\n📊 [MARKET CAP] Weekend update triggered at UK time: ${ukTime}`);
            await this.updateAllMarketCaps();
        }, {
            timezone: "Europe/London",
            scheduled: true
        });

        console.log('   ✓ Weekend update scheduled: 8:00 AM UK (Saturday, except sweep day)');

        this.isInitialized = true;
        console.log('✅ Market Cap Updater initialized\n');
    }

    /**
     * Does the Saturday update stand aside for the monthly AI sweep? Yes on
     * sweep day, judged by the sweep's own isSweepDay() (ml/conviction-sweep.js),
     * the one definition every sweep job uses. No when CONVICTION_SWEEP=false.
     * Never throws: if the sweep module cannot answer, the update runs.
     * @param {Date} [now]
     * @returns {boolean}
     */
    yieldsToSweep(now = new Date()) {
        if (process.env.CONVICTION_SWEEP === 'false') return false;
        try {
            return require('../../ml/conviction-sweep').isSweepDay(now) === true;
        } catch (error) {
            console.error('[MARKET CAP] Could not ask the AI sweep whether today is sweep day:', error.message);
            return false;
        }
    }

    /**
     * Update market caps for all stocks
     * @returns {Promise<object>} Update results
     */
    async updateAllMarketCaps() {
        if (this.isUpdating) {
            console.log('[MARKET CAP] Update already in progress, skipping...');
            return { error: 'Update already in progress' };
        }

        this.isUpdating = true;
        const startTime = Date.now();

        console.log('\n' + '='.repeat(60));
        console.log('📊 MARKET CAP UPDATE STARTED');
        console.log('='.repeat(60));

        try {
            // Get all stocks from all markets
            const allStocks = getAllStocks();
            const symbols = allStocks.map(s => s.symbol);

            console.log(`📈 Total stocks to update: ${symbols.length}`);

            // Update in batches with rate limiting
            const result = await MarketCapService.updateMarketCaps(symbols, 50, 150);

            const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

            console.log('\n' + '='.repeat(60));
            console.log('📊 MARKET CAP UPDATE COMPLETED');
            console.log('='.repeat(60));
            console.log(`   ✓ Updated: ${result.updated}`);
            console.log(`   ✗ Failed: ${result.failed}`);
            console.log(`   ⏱ Duration: ${duration} minutes`);
            console.log('='.repeat(60) + '\n');

            this.lastUpdateResult = {
                ...result,
                timestamp: new Date().toISOString(),
                duration: `${duration} minutes`
            };

            return result;

        } catch (error) {
            console.error('[MARKET CAP] Update failed:', error.message);
            return { error: error.message };
        } finally {
            this.isUpdating = false;
        }
    }

    /**
     * Update market caps for a specific market only
     * @param {string} market - Market name ('India', 'UK', or 'US')
     * @returns {Promise<object>} Update results
     */
    async updateMarketCapsByMarket(market) {
        if (this.isUpdating) {
            return { error: 'Update already in progress' };
        }

        this.isUpdating = true;

        try {
            const { getStocksByMarket } = require('../shared/stock-data');
            const stocks = getStocksByMarket(market);
            const symbols = stocks.map(s => s.symbol);

            console.log(`📊 [MARKET CAP] Updating ${symbols.length} ${market} stocks...`);

            const result = await MarketCapService.updateMarketCaps(symbols, 50, 150);

            console.log(`✅ [MARKET CAP] ${market} update complete: ${result.updated} updated, ${result.failed} failed`);

            return result;
        } catch (error) {
            console.error(`[MARKET CAP] ${market} update failed:`, error.message);
            return { error: error.message };
        } finally {
            this.isUpdating = false;
        }
    }

    /**
     * Get current update status
     * @returns {object} Status information
     */
    getStatus() {
        return {
            isUpdating: this.isUpdating,
            lastUpdate: this.lastUpdateResult,
            isInitialized: this.isInitialized
        };
    }

    /**
     * Get market cap statistics
     * @returns {Promise<object>} Statistics
     */
    async getStats() {
        return await MarketCapService.getStats();
    }
}

// Export singleton instance
module.exports = new MarketCapUpdater();
