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
            // Use the internal API endpoint to trigger scan exactly as browser would
            const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
            
            // First, get alert preferences (same as browser does)
            const prefsResponse = await axios.get(`${baseUrl}/api/alerts/preferences`);
            const prefs = prefsResponse.data;
            
            if (!prefs.telegram_enabled) {
                console.log('❌ Telegram alerts are disabled in preferences');
                return;
            }
            
            const targetChatId = chatId || prefs.telegram_chat_id || process.env.TELEGRAM_CHAT_ID;
            
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

            // Trigger the scan via the internal API (same endpoint browser would use)
            console.log('🔍 Triggering global scan via internal API...');
            const scanResponse = await axios.post(`${baseUrl}/api/scan/global`, {
                scanType: 'all',
                period: '5y',
                source: 'scheduled_7am'
            }, {
                timeout: 600000 // 10 minute timeout for large scan
            });

            const { opportunities, totalScanned, errors } = scanResponse.data;
            
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
        const symbol = opportunity.symbol;
        const price = opportunity.currentPrice;
        const signal = opportunity.dti;
        
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
                { label: 'Signal Date', value: new Date().toLocaleDateString() },
                { label: 'Market', value: symbol.includes('.NS') ? 'Indian' : symbol.includes('.L') ? 'UK' : 'US' }
            ],
            action: 'Technical pattern identified for analysis'
        });
    }

    /**
     * Send custom alert via API (same as browser does)
     */
    async sendCustomAlert(chatId, messageData) {
        try {
            const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
            
            const response = await axios.post(`${baseUrl}/api/alerts/send-custom`, {
                chatId: chatId,
                message: messageData
            });
            
            if (response.status === 200) {
                console.log('✅ Alert sent successfully');
            }
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