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
        const dailyScanJob = cron.schedule('0 7 * * *', () => {
            console.log('⏰ Running scheduled global stock scan at 7 AM UK time');
            this.runGlobalScan();
        }, {
            timezone: "Europe/London"
        });
        
        this.scheduledJobs.push(dailyScanJob);
        console.log('✅ Stock Scanner initialized with daily scan at 7 AM UK time');
    }

    /**
     * Run a global scan of all configured stocks using DTI Backtest logic
     */
    async runGlobalScan(chatId = null) {
        if (this.isScanning) {
            console.log('⚠️ Scan already in progress');
            return;
        }

        this.isScanning = true;
        this.scanResults = [];
        
        try {
            console.log('🔍 Starting DTI global stock scan...');
            
            // Use provided chatId or default from environment
            const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;
            
            if (!targetChatId) {
                console.error('❌ No Telegram chat ID configured for scan results');
                return;
            }

            // Send scan start notification
            await sendTelegramAlert(targetChatId, {
                type: 'custom',
                message: `🔍 *DTI Backtest Scan Started*\n\n` +
                         `Using high conviction DTI strategy parameters:\n` +
                         `• Entry Threshold: 0\n` +
                         `• Take Profit: 8%\n` +
                         `• Stop Loss: 5%\n` +
                         `• Max Holding: 30 days\n\n` +
                         `Scanning all global stocks for opportunities...\n\n` +
                         `⏳ This may take several minutes...`
            });

            // Use DTI scanner with default parameters
            const opportunities = await scanAllStocks({
                entryThreshold: 0,
                takeProfitPercent: 8,
                stopLossPercent: 5,
                maxHoldingDays: 30
            });
            
            this.scanResults = opportunities;
            
            // Format and send results
            const message = formatOpportunitiesMessage(opportunities);
            await sendTelegramAlert(targetChatId, {
                type: 'custom',
                message: message
            });
            
            console.log(`✅ DTI scan completed. Found ${opportunities.length} high conviction opportunities`);
            
        } catch (error) {
            console.error('❌ Error during DTI scan:', error);
            
            // Send error notification
            if (chatId || process.env.TELEGRAM_CHAT_ID) {
                await sendTelegramAlert(chatId || process.env.TELEGRAM_CHAT_ID, {
                    type: 'custom',
                    message: `❌ *Scan Error*\n\nFailed to complete DTI scan:\n${error.message}`
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