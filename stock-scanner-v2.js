/**
 * Stock Scanner V2 Module
 * Automated scanning that mimics the exact browser-based "Scan All Global Stocks" behavior
 */

const cron = require('node-cron');
const axios = require('axios');
const { sendTelegramAlert } = require('./telegram-bot');

class StockScannerV2 {
    constructor() {
        this.isScanning = false;
        this.scheduledJobs = [];
    }

    /**
     * Initialize the scanner with scheduled jobs
     */
    initialize() {
        console.log('📊 Initializing Stock Scanner V2...');
        
        // Schedule daily scan at 7 AM UK time (BST/GMT)
        const dailyScanJob = cron.schedule('0 7 * * *', async () => {
            console.log('⏰ Running scheduled global stock scan at 7 AM UK time');
            console.log(`[CRON] Scheduled scan triggered at: ${new Date().toISOString()}`);
            console.log(`[CRON] UK time: ${new Date().toLocaleString("en-GB", {timeZone: "Europe/London"})}`);
            
            try {
                await this.runManualScanSimulation();
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
        
        console.log('✅ Stock Scanner V2 initialized with daily scan at 7 AM UK time');
    }

    /**
     * Run a scan that simulates exactly what happens when the manual button is clicked
     */
    async runManualScanSimulation(chatId = null) {
        console.log(`[runManualScanSimulation] Starting scan simulation...`);
        console.log(`[runManualScanSimulation] Chat ID: ${chatId || process.env.TELEGRAM_CHAT_ID || 'NOT SET'}`);
        
        if (this.isScanning) {
            console.log('⚠️ Scan already in progress');
            return;
        }

        this.isScanning = true;
        
        try {
            // Skip the API calls and use environment variables directly for system scans
            console.log('🔧 Using direct environment configuration for system scan...');
            
            // For system-triggered scans, bypass API authentication and use env vars directly
            const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;
            
            // Check if Telegram is configured via environment
            if (!process.env.TELEGRAM_BOT_TOKEN) {
                console.log('❌ Telegram bot token not configured in environment');
                return;
            }
            
            if (!targetChatId) {
                console.error('❌ No Telegram chat ID configured for scan results');
                return;
            }

            console.log(`✅ Using chat ID: ${targetChatId}`);

            // Send start notification
            await this.sendCustomAlert(targetChatId, {
                type: 'opportunity_scan',
                title: '🎯 AUTOMATED DAILY SCAN',
                text: 'Scanning 2,381 global stocks for technical patterns...',
                fields: [
                    { label: 'Scan Time', value: new Date().toLocaleString("en-GB", {timeZone: "Europe/London"}) },
                    { label: 'Markets', value: 'Indian (NSE), UK (LSE), US (NYSE/NASDAQ)' },
                    { label: 'Total Stocks', value: '2,381' }
                ]
            });

            // Use direct DTI scanner instead of API calls to avoid authentication issues
            console.log('🔍 Running direct DTI scan (bypassing authentication)...');
            
            // Import and use the DTI scanner directly
            const { scanAllStocks } = require('./dti-scanner');
            
            // Execute with exact same parameters as browser manual scan
            const allOpportunities = await scanAllStocks({
                entryThreshold: 0,           // Same as browser (DTI < 0)
                takeProfitPercent: 8,        // Same as browser defaults
                stopLossPercent: 5,          // Same as browser defaults
                maxHoldingDays: 30           // Same as browser defaults
            });
            
            console.log(`📊 Server-side DTI scan complete: ${allOpportunities.length} total opportunities found`);
            
            // Filter for recent opportunities (last 2 trading days like browser does)
            const ukNow = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/London"}));
            const today = new Date(ukNow);
            today.setHours(0, 0, 0, 0);
            
            const opportunities = allOpportunities.filter(opp => {
                if (!opp.activeTrade || !opp.activeTrade.entryDate) return false;
                
                const entryDate = new Date(opp.activeTrade.entryDate);
                entryDate.setHours(0, 0, 0, 0);
                
                // Calculate days difference (excluding weekends)
                let tradingDays = 0;
                let tempDate = new Date(today);
                
                while (tempDate >= entryDate && tradingDays < 3) {
                    const dayOfWeek = tempDate.getDay();
                    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not weekend
                        tradingDays++;
                    }
                    tempDate.setDate(tempDate.getDate() - 1);
                    
                    if (tempDate < entryDate) break;
                }
                
                return tradingDays <= 2; // Only last 2 trading days
            });
            
            const totalScanned = 2381; // Actual count from comprehensive stock lists
            const errors = 0;
            
            console.log(`📊 Scan complete: ${opportunities.length} opportunities from ${totalScanned} stocks`);

            // Send results using same format as browser-based alerts
            if (opportunities.length > 0) {
                // Send summary first
                await this.sendCustomAlert(targetChatId, {
                    type: 'opportunity_scan',
                    title: '🎯 TECHNICAL SCAN COMPLETE',
                    text: `Found ${opportunities.length} Strong Technical Patterns`,
                    fields: [
                        { label: 'Total Stocks Scanned', value: totalScanned },
                        { label: 'Strong Patterns Found', value: opportunities.length },
                        { label: 'Signal Strength', value: 'DTI < 0 (Oversold with momentum reversal)' },
                        { label: 'Scan Date', value: new Date().toLocaleDateString() }
                    ]
                });

                // Send individual opportunities (max 5 like browser does)
                const topOpportunities = opportunities.slice(0, 5);
                for (const opp of topOpportunities) {
                    await this.sendOpportunityAlert(targetChatId, opp);
                    // Small delay between messages
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                // If more than 5 opportunities, send a summary
                if (opportunities.length > 5) {
                    await this.sendCustomAlert(targetChatId, {
                        type: 'custom',
                        message: `📊 *Additional Opportunities*\n\nPlus ${opportunities.length - 5} more technical patterns identified. Check the web interface for full details.`
                    });
                }
            } else {
                await this.sendCustomAlert(targetChatId, {
                    type: 'custom',
                    message: '📊 *No Strong Patterns Found*\n\nNo stocks currently meet the oversold momentum reversal criteria. Will scan again tomorrow.'
                });
            }

        } catch (error) {
            console.error('❌ Error during scan simulation:', error);
            
            // Send error notification
            const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;
            if (targetChatId) {
                await this.sendCustomAlert(targetChatId, {
                    type: 'custom',
                    message: `❌ *Scan Error*\n\nFailed to complete automated scan:\n${error.message}`
                });
            }
        } finally {
            this.isScanning = false;
        }
    }

    /**
     * Send opportunity alert in same format as browser
     */
    async sendOpportunityAlert(chatId, opportunity) {
        // DTI scanner returns: {stock: {symbol, name}, activeTrade: {entryDTI, entryPrice}, currentPrice}
        const symbol = opportunity.stock.symbol;
        const price = opportunity.currentPrice || opportunity.activeTrade.entryPrice;
        const signal = opportunity.activeTrade.entryDTI;
        
        // Get currency symbol based on the stock symbol
        const currencySymbol = symbol.includes('.NS') ? '₹' : 
                              symbol.includes('.L') ? '£' : '$';
        
        const convictionLevel = signal < -50 ? '⭐⭐⭐ VERY HIGH' : 
                               signal < -40 ? '⭐⭐⭐ HIGH' : 
                               '⭐⭐ MODERATE';
        
        await this.sendCustomAlert(chatId, {
            type: 'buy_opportunity',
            title: '🎯 STRONG TECHNICAL PATTERN',
            stock: symbol,
            fields: [
                { label: 'DTI Signal', value: signal.toFixed(2) },
                { label: 'Current Price', value: `${currencySymbol}${price.toFixed(2)}` },
                { label: 'Signal Strength', value: convictionLevel },
                { label: 'Signal Date', value: new Date(opportunity.activeTrade.entryDate).toLocaleDateString() },
                { label: 'Market', value: symbol.includes('.NS') ? 'Indian' : symbol.includes('.L') ? 'UK' : 'US' }
            ],
            action: 'Technical pattern identified for analysis'
        });
    }

    /**
     * Send custom alert directly via Telegram bot (bypass API authentication)
     */
    async sendCustomAlert(chatId, messageData) {
        try {
            // Use the telegram bot directly to send alerts
            const { sendTelegramAlert } = require('./telegram-bot');
            
            await sendTelegramAlert(chatId, messageData);
            console.log('✅ Alert sent successfully via direct Telegram bot');
        } catch (error) {
            console.error('❌ Failed to send alert:', error.message);
        }
    }

    /**
     * Stop all scheduled jobs
     */
    stop() {
        this.scheduledJobs.forEach(job => job.stop());
        this.scheduledJobs = [];
        console.log('🛑 Stock Scanner V2 stopped');
    }
}

// Create singleton instance
const stockScannerV2 = new StockScannerV2();

module.exports = stockScannerV2;