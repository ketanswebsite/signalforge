/**
 * Stock Scanner Module
 * Automated scanning of global stocks using DTI Backtest logic
 */

const cron = require('node-cron');
const { sendTelegramAlert } = require('./telegram-bot');
const { scanAllStocks, formatOpportunitiesMessage } = require('./dti-scanner');

class StockScanner {
    constructor() {
        this.scanResults = [];
        this.isScanning = false;
        this.scheduledJobs = [];
    }

    /**
     * Initialize the scanner with scheduled jobs
     */
    initialize() {
        console.log('📊 Initializing Stock Scanner...');
        
        // Schedule daily scan at 7 AM UK time (BST/GMT)
        const dailyScanJob = cron.schedule('0 7 * * *', async () => {
            console.log('⏰ Running scheduled global stock scan at 7 AM UK time');
            console.log(`[CRON] Scheduled scan triggered at: ${new Date().toISOString()}`);
            console.log(`[CRON] UK time: ${new Date().toLocaleString("en-GB", {timeZone: "Europe/London"})}`);
            console.log(`[CRON] Using chat ID: ${process.env.TELEGRAM_CHAT_ID || 'NOT SET'}`);
            
            try {
                // Run scan without specific chatId to use default from environment
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
        
        // Add a test cron job that runs every minute for debugging
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
        
        console.log('✅ Stock Scanner initialized with daily scan at 7 AM UK time');
    }

    /**
     * Run a global scan using the same logic as the working manual "Scan All Global Stocks" button
     */
    async runGlobalScan(chatId = null) {
        console.log(`[runGlobalScan] Called with chatId: ${chatId || 'null (will use default)'}`);
        console.log(`[runGlobalScan] Current time: ${new Date().toISOString()}`);
        console.log(`[runGlobalScan] Environment TELEGRAM_CHAT_ID: ${process.env.TELEGRAM_CHAT_ID || 'NOT SET'}`);
        
        if (this.isScanning) {
            console.log('⚠️ Scan already in progress');
            return;
        }

        this.isScanning = true;
        this.scanResults = [];
        
        try {
            console.log('🔍 Starting global stock scan using the same logic as manual scan...');
            
            // Use provided chatId or default from environment
            const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;
            
            if (!targetChatId) {
                console.error('❌ No Telegram chat ID configured for scan results');
                return;
            }

            // Send scan start notification
            await sendTelegramAlert(targetChatId, {
                type: 'custom',
                message: `🔍 *Daily High Conviction Scan*\n\nScanning all global stocks for opportunities...`
            });

            // Call the actual backend DTI scanner directly - same as manual scan
            // This bypasses the problematic dti-scanner.js and uses the working frontend logic
            console.log('🔄 Using backend DTI scan logic...');
            
            // Import the actual DTI scanner
            const { scanAllStocks, formatOpportunitiesMessage } = require('./dti-scanner');
            
            // Scan with same parameters as manual scan
            const opportunities = await scanAllStocks({
                entryThreshold: 0,
                takeProfitPercent: 8,
                stopLossPercent: 5,
                maxHoldingDays: 30
            });
            
            this.scanResults = opportunities;
            
            console.log(`📊 Found ${opportunities.length} total opportunities before filtering`);
            
            // Format and send results with the same filtering logic
            const message = formatOpportunitiesMessage(opportunities);
            await sendTelegramAlert(targetChatId, {
                type: 'custom',
                message: message
            });
            
            console.log(`✅ Global scan completed successfully`);
            
        } catch (error) {
            console.error('❌ Error during global scan:', error);
            console.error('❌ Stack trace:', error.stack);
            
            // Send error notification
            if (chatId || process.env.TELEGRAM_CHAT_ID) {
                await sendTelegramAlert(chatId || process.env.TELEGRAM_CHAT_ID, {
                    type: 'custom',
                    message: `❌ *Scan Error*\n\nFailed to complete global scan:\n${error.message}`
                });
            }
        } finally {
            this.isScanning = false;
        }
    }


    /**
     * Get scan status
     */
    getStatus() {
        return {
            isScanning: this.isScanning,
            lastResults: this.scanResults,
            scheduledJobs: this.scheduledJobs.length
        };
    }

    /**
     * Stop all scheduled jobs
     */
    stop() {
        this.scheduledJobs.forEach(job => job.stop());
        this.scheduledJobs = [];
        console.log('🛑 Stock Scanner stopped');
    }
}

// Create singleton instance
const stockScanner = new StockScanner();

module.exports = stockScanner;