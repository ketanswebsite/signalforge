/**
 * Stock Scanner Service
 * Clean, unified scanner implementation using shared modules
 * Replaces the multiple duplicate scanner files
 */

const axios = require('axios');
const cron = require('node-cron');
const { sendTelegramAlert } = require('../telegram/telegram-bot');
const { getAllStocks, getStocksByMarket } = require('../shared/stock-data');
const { analyzeStock } = require('../shared/dti-calculator');

class StockScanner {
    constructor() {
        this.isScanning = false;
        this.scheduledJobs = [];
        this.scanResults = [];
    }

    /**
     * Initialize the scanner with scheduled jobs
     */
    initialize() {
        console.log('📊 Initializing Stock Scanner Service...');
        
        // Schedule daily scan at 7 AM UK time
        const dailyScanJob = cron.schedule('0 7 * * *', async () => {
            console.log('⏰ Running scheduled global stock scan at 7 AM UK time');
            console.log(`[CRON] Scheduled scan triggered at: ${new Date().toISOString()}`);
            console.log(`[CRON] UK time: ${new Date().toLocaleString("en-GB", {timeZone: "Europe/London"})}`);
            
            try {
                await this.runGlobalScan();
                console.log('[CRON] Scheduled scan completed successfully');
            } catch (error) {
                console.error('[CRON] Error in scheduled scan:', error);
                console.error('[CRON] Stack trace:', error.stack);
            }
        }, {
            timezone: "Europe/London"
        });
        
        this.scheduledJobs.push(dailyScanJob);
        
        // Add debug cron job if enabled
        if (process.env.DEBUG_CRON === 'true') {
            const testJob = cron.schedule('* * * * *', () => {
                console.log(`[CRON TEST] Cron is working! Time: ${new Date().toISOString()}`);
                console.log(`[CRON TEST] UK time: ${new Date().toLocaleString("en-GB", {timeZone: "Europe/London"})}`);
            }, {
                timezone: "Europe/London"
            });
            this.scheduledJobs.push(testJob);
            console.log('🔍 Debug cron job added (runs every minute)');
        }
        
        console.log('✅ Stock Scanner Service initialized with daily scan at 7 AM UK time');
    }

    /**
     * Run a global scan of all stocks
     */
    async runGlobalScan(chatId = null, options = {}) {
        console.log(`[runGlobalScan] Starting scan with chatId: ${chatId || 'default'}`);
        
        if (this.isScanning) {
            console.log('⚠️ Scan already in progress');
            return { error: 'Scan already in progress' };
        }

        this.isScanning = true;
        this.scanResults = [];
        
        try {
            const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;
            
            if (!targetChatId) {
                console.error('❌ No Telegram chat ID configured for scan results');
                return { error: 'No Telegram chat ID configured' };
            }

            // Send scan start notification
            await sendTelegramAlert(targetChatId, {
                type: 'custom',
                message: `🔍 *Global Stock Scan Started*\n\nScanning all global stocks for DTI opportunities...`
            });

            // Get all stocks
            const allStocks = getAllStocks();
            console.log(`📊 Scanning ${allStocks.length} stocks across all markets`);

            // Scan parameters
            const scanParams = {
                r: options.r || 14,
                s: options.s || 10,
                u: options.u || 5,
                entryThreshold: options.entryThreshold || -40,
                takeProfitPercent: options.takeProfitPercent || 8,
                stopLossPercent: options.stopLossPercent || 5,
                maxHoldingDays: options.maxHoldingDays || 30
            };

            // Scan stocks in batches to avoid overwhelming APIs
            const batchSize = 10;
            const opportunities = [];
            
            for (let i = 0; i < allStocks.length; i += batchSize) {
                const batch = allStocks.slice(i, i + batchSize);
                const batchResults = await this.scanStockBatch(batch, scanParams);
                opportunities.push(...batchResults);
                
                // Progress update
                if (i % 100 === 0) {
                    console.log(`🔄 Scanned ${Math.min(i + batchSize, allStocks.length)}/${allStocks.length} stocks`);
                }
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log(`✅ Scan complete: Found ${opportunities.length} opportunities`);

            // Send results
            if (opportunities.length > 0) {
                const message = this.formatOpportunitiesMessage(opportunities);
                await sendTelegramAlert(targetChatId, {
                    type: 'custom',
                    message: message
                });
            } else {
                await sendTelegramAlert(targetChatId, {
                    type: 'custom',
                    message: `📊 *Global Scan Complete*\n\nNo trading opportunities found at this time.\n\nScanned: ${allStocks.length} stocks`
                });
            }

            this.scanResults = opportunities;
            return {
                success: true,
                opportunities,
                totalScanned: allStocks.length,
                totalOpportunities: opportunities.length
            };

        } catch (error) {
            console.error('❌ Error in global scan:', error);
            
            const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;
            if (targetChatId) {
                await sendTelegramAlert(targetChatId, {
                    type: 'custom',
                    message: `❌ *Scan Error*\n\nGlobal stock scan failed: ${error.message}`
                });
            }
            
            return { error: error.message };
        } finally {
            this.isScanning = false;
        }
    }

    /**
     * Scan a batch of stocks
     */
    async scanStockBatch(stocks, params) {
        const opportunities = [];
        
        const promises = stocks.map(async (stock) => {
            try {
                const stockData = await this.fetchStockData(stock.symbol);
                if (!stockData) return null;
                
                const analysis = analyzeStock(stockData, params);
                if (!analysis) return null;
                
                if (analysis.isOpportunity) {
                    return {
                        symbol: stock.symbol,
                        name: stock.name,
                        currentPrice: analysis.currentPrice,
                        currentDTI: analysis.currentDTI,
                        current7DayDTI: analysis.current7DayDTI,
                        analysis: analysis.analysis
                    };
                }
                
                return null;
            } catch (error) {
                console.error(`Error scanning ${stock.symbol}:`, error.message);
                return null;
            }
        });
        
        const results = await Promise.all(promises);
        return results.filter(result => result !== null);
    }

    /**
     * Fetch stock data from Yahoo Finance API
     */
    async fetchStockData(symbol) {
        try {
            // Calculate date range (last 6 months of data)
            const endDate = Math.floor(Date.now() / 1000);
            const startDate = endDate - (180 * 24 * 60 * 60); // 180 days ago
            
            const url = `/yahoo/history?symbol=${symbol}&period1=${startDate}&period2=${endDate}&interval=1d`;
            const response = await axios.get(url, {
                baseURL: process.env.BASE_URL || 'http://localhost:3000',
                timeout: 10000
            });
            
            if (!response.data?.chart?.result?.[0]) {
                return null;
            }
            
            const chart = response.data.chart.result[0];
            const quotes = chart.indicators.quote[0];
            const timestamps = chart.timestamp;
            
            if (!quotes.high || !quotes.low || !quotes.close || !timestamps) {
                return null;
            }
            
            // Convert timestamps to dates
            const dates = timestamps.map(ts => new Date(ts * 1000).toISOString().split('T')[0]);
            
            return {
                symbol,
                dates,
                high: quotes.high,
                low: quotes.low,
                close: quotes.close,
                open: quotes.open,
                volume: quotes.volume
            };
            
        } catch (error) {
            console.error(`Error fetching data for ${symbol}:`, error.message);
            return null;
        }
    }

    /**
     * Format opportunities for Telegram message
     */
    formatOpportunitiesMessage(opportunities) {
        if (!opportunities || opportunities.length === 0) {
            return '📊 *Global Scan Complete*\n\nNo trading opportunities found.';
        }
        
        // Sort by DTI strength
        const sorted = opportunities.sort((a, b) => b.currentDTI - a.currentDTI);
        
        let message = `🎯 *${opportunities.length} Trading Opportunities Found*\n\n`;
        
        // Show top 10 opportunities
        const topOpportunities = sorted.slice(0, 10);
        
        topOpportunities.forEach((opp, index) => {
            message += `${index + 1}. **${opp.name}** (${opp.symbol})\n`;
            message += `   💰 Price: ${typeof opp.currentPrice === 'number' ? opp.currentPrice.toFixed(2) : 'N/A'}\n`;
            message += `   📈 DTI: ${typeof opp.currentDTI === 'number' ? opp.currentDTI.toFixed(1) : 'N/A'}\n`;
            message += `   📊 7D DTI: ${typeof opp.current7DayDTI === 'number' ? opp.current7DayDTI.toFixed(1) : 'N/A'}\n\n`;
        });
        
        if (opportunities.length > 10) {
            message += `...and ${opportunities.length - 10} more opportunities\n\n`;
        }
        
        message += `🕐 Scan Time: ${new Date().toLocaleString("en-GB", {timeZone: "Europe/London"})}`;
        
        return message;
    }

    /**
     * Get scan results
     */
    getScanResults() {
        return {
            isScanning: this.isScanning,
            results: this.scanResults,
            lastScanTime: this.lastScanTime || null
        };
    }

    /**
     * Stop all scheduled jobs
     */
    stop() {
        this.scheduledJobs.forEach(job => job.destroy());
        this.scheduledJobs = [];
        console.log('🛑 Stock Scanner Service stopped');
    }
}

module.exports = StockScanner;