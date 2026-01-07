/**
 * Stock Scanner Service
 * Clean, unified scanner implementation using shared modules
 * Replaces the multiple duplicate scanner files
 */

const axios = require('axios');
const cron = require('node-cron');
const { sendTelegramAlert, broadcastToSubscribers } = require('../telegram/telegram-bot');
const { getAllStocks, getStocksByMarket } = require('../shared/stock-data');
const { analyzeStock, calculateDTI, calculate7DayDTI } = require('../shared/dti-calculator');
const MarketCapService = require('../shared/market-cap-service');
const FrontendBacktestCalculator = require('../shared/frontend-backtest-calculator');
const BacktestCalculator = require('../shared/backtest-calculator');
const HighConvictionPortfolioManager = require('../portfolio/high-conviction-manager');

// Push notification service (lazy loaded)
let pushService = null;
function getPushService() {
    if (!pushService) {
        try {
            const PushService = require('../push/push-service');
            const TradeDB = require('../../database-postgres');
            pushService = new PushService(TradeDB);
        } catch (e) {
            console.warn('[SCANNER] Push service not available:', e.message);
        }
    }
    return pushService;
}

class StockScanner {
    constructor() {
        this.isScanning = false;
        this.scheduledJobs = [];
        this.scanResults = [];
        this.portfolioManager = new HighConvictionPortfolioManager();
    }

    /**
     * Send push notification broadcast
     */
    async sendPushBroadcast(title, body, options = {}) {
        const push = getPushService();
        if (!push || !push.isConfigured) {
            return { sent: 0, failed: 0 };
        }

        try {
            const payload = {
                title,
                body,
                icon: '/images/favicon.PNG',
                badge: '/images/favicon.PNG',
                tag: options.tag || `scanner-${Date.now()}`,
                url: options.url || '/account',
                requireInteraction: options.requireInteraction || false
            };

            return await push.broadcast(payload);
        } catch (error) {
            console.error('[SCANNER] Push broadcast error:', error.message);
            return { sent: 0, failed: 0 };
        }
    }

    /**
     * Initialize the scanner with scheduled jobs
     */
    initialize() {
        console.log('🔍 [SCANNER] Initializing Stock Scanner...');

        // Schedule daily scan at 7 AM UK time (weekdays only: Monday-Friday)
        const dailyScanJob = cron.schedule('0 7 * * 1-5', async () => {
            const ukTime = new Date().toLocaleString("en-GB", {timeZone: "Europe/London"});
            console.log('🔔 [CRON TRIGGER] 7 AM scan triggered at UK time:', ukTime);
            console.log('🔔 [CRON TRIGGER] Server time:', new Date().toISOString());

            // Check if Telegram is configured at runtime
            if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
                console.log('⚠️ [CRON] Skipping scan - Telegram not configured');
                console.log('⚠️ [CRON] TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'SET' : 'NOT SET');
                console.log('⚠️ [CRON] TELEGRAM_CHAT_ID:', process.env.TELEGRAM_CHAT_ID ? 'SET' : 'NOT SET');
                return;
            }

            console.log('✅ [CRON] Starting high conviction scan...');
            try {
                // Run high conviction pattern scan (same as successful manual scan)
                const result = await this.runHighConvictionScan();
                console.log('✅ [CRON] Scan completed successfully:', JSON.stringify(result, null, 2));
            } catch (error) {
                console.error('❌ [CRON] Scan failed:', error.message);
                console.error('❌ [CRON] Stack:', error.stack);
            }
        }, {
            timezone: "Europe/London",
            scheduled: true  // Explicitly set scheduled to true
        });

        this.scheduledJobs.push(dailyScanJob);

        // Calculate and log next run time
        const now = new Date();
        const ukNow = new Date(now.toLocaleString("en-US", {timeZone: "Europe/London"}));
        const next7am = new Date(ukNow);
        next7am.setHours(7, 0, 0, 0);
        if (next7am <= ukNow) {
            next7am.setDate(next7am.getDate() + 1);
        }
        // Skip to next weekday if weekend
        while (next7am.getDay() === 0 || next7am.getDay() === 6) {
            next7am.setDate(next7am.getDate() + 1);
        }

        console.log('📅 [SCANNER] Next 7 AM scan scheduled for (UK time):', next7am.toLocaleString("en-GB", {timeZone: "Europe/London"}));
        console.log('📅 [SCANNER] Current UK time:', ukNow.toLocaleString("en-GB", {timeZone: "Europe/London"}));
        console.log('📅 [SCANNER] Server timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);

        // Add debug cron job if enabled (every minute for testing)
        if (process.env.DEBUG_CRON === 'true') {
            console.log('🐛 [DEBUG] Debug cron enabled - will run every minute');
            const testJob = cron.schedule('* * * * *', () => {
                const ukTime = new Date().toLocaleString("en-GB", {timeZone: "Europe/London"});
                console.log('🐛 [DEBUG CRON] Heartbeat at UK time:', ukTime);
            }, {
                timezone: "Europe/London",
                scheduled: true
            });
            this.scheduledJobs.push(testJob);
        }

        // Add hourly heartbeat to verify cron is still running
        const heartbeatJob = cron.schedule('0 * * * *', () => {
            const ukTime = new Date().toLocaleString("en-GB", {timeZone: "Europe/London"});
            const ukHour = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/London"})).getHours();
            console.log('💓 [HEARTBEAT] Scanner alive - UK time:', ukTime, '- Hour:', ukHour);

            // Check if next run is 7 AM
            if (ukHour === 6) {
                console.log('⏰ [HEARTBEAT] Next scan in 1 hour at 7 AM UK time');
            }
        }, {
            timezone: "Europe/London",
            scheduled: true
        });
        this.scheduledJobs.push(heartbeatJob);

        // Schedule daily portfolio update at 4 PM UK time (after market close)
        const dailyUpdateJob = cron.schedule('0 16 * * 1-5', async () => {
            console.log('📊 [PORTFOLIO] Daily update triggered at 4 PM UK time');
            try {
                const result = await this.portfolioManager.updateAllActiveTrades();
                console.log('✅ [PORTFOLIO] Daily update completed:', result);
            } catch (error) {
                console.error('❌ [PORTFOLIO] Daily update failed:', error);
            }
        }, {
            timezone: "Europe/London",
            scheduled: true
        });
        this.scheduledJobs.push(dailyUpdateJob);

        // Schedule weekly report at 10 AM UK time on Saturdays
        const weeklyReportJob = cron.schedule('0 10 * * 6', async () => {
            console.log('📈 [WEEKLY REPORT] Generating weekly report at 10 AM Saturday UK time');
            try {
                const result = await this.portfolioManager.sendWeeklyReport();
                console.log('✅ [WEEKLY REPORT] Report sent:', result);
            } catch (error) {
                console.error('❌ [WEEKLY REPORT] Failed:', error);
            }
        }, {
            timezone: "Europe/London",
            scheduled: true
        });
        this.scheduledJobs.push(weeklyReportJob);

        console.log('✅ [SCANNER] Scanner initialized with', this.scheduledJobs.length, 'scheduled jobs');
        console.log('✅ [SCANNER] Telegram configured:', !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID));
        console.log('📊 [PORTFOLIO] Daily updates scheduled for 4 PM UK (Mon-Fri)');
        console.log('📈 [PORTFOLIO] Weekly reports scheduled for 10 AM UK (Saturday)');
    }

    /**
     * Run high conviction pattern scan - same logic as successful manual scan
     */
    async runHighConvictionScan(chatId = null) {
        
        if (this.isScanning) {
            return { error: 'Scan already in progress' };
        }

        this.isScanning = true;
        this.scanResults = [];
        
        try {
            // Determine if this is a broadcast (scheduled 7AM scan) or single user test
            const isBroadcast = !chatId; // No specific chatId means broadcast to all subscribers
            const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;
            

            // Send scan start notification
            if (isBroadcast) {
                // Broadcast to all subscribers who want scans or all signals
                console.log('📤 [SCANNER] Sending scan start notification to subscribers...');
                const startResults = await broadcastToSubscribers({
                    type: 'custom',
                    message: `🔍 *High Conviction Pattern Scan Started*\n\nScanning all global stocks for high conviction opportunities...`
                }, 'scans');
                console.log(`✅ [SCANNER] Scan start notification sent to ${startResults.length} subscribers`);
            } else if (targetChatId) {
                // Single user test
                console.log(`📤 [SCANNER] Sending scan start notification to ${targetChatId}...`);
                await sendTelegramAlert(targetChatId, {
                    type: 'custom',
                    message: `🔍 *High Conviction Pattern Scan Started*\n\nScanning all global stocks for high conviction opportunities...`
                });
            }

            // SIMPLE APPROACH: Exactly like frontend
            const allStocks = this.getComprehensiveStockList();

            // Step 1: Find ALL current opportunities (same as frontend scan)
            const allCurrentOpportunities = await this.findCurrentOpportunities(allStocks);
            
            // Step 2: Filter for high conviction (>75% win rate)
            const highConvictionOpportunities = allCurrentOpportunities.filter(opp => {
                const winRate = opp.trade?.winRate || 0;
                return winRate > 75;
            });
            
            // Step 3: Filter for recent signals (last 2 trading days) 
            const recentOpportunities = highConvictionOpportunities.filter(opp => {
                const signalDate = opp.trade.signalDate || opp.trade.entryDate;
                const isRecent = BacktestCalculator.isWithinTradingDays(signalDate, 2);
                return isRecent;
            });
            
            // Step 4: Send ALL recent high conviction opportunities (no limit)
            const alertOpportunities = recentOpportunities;

            // Log which opportunities are being sent (same as frontend)
            alertOpportunities.forEach(opp => {
                const signalDate = new Date(opp.trade.signalDate || opp.trade.entryDate);
            });

            // Send results using same format as successful manual scan
            let sortedOpportunities = [];
            if (alertOpportunities.length > 0) {
                // Step 5: Enrich with market cap data and sort by market cap (highest first)
                console.log('📊 [MARKET CAP] Enriching opportunities with market cap data...');
                const enrichedOpportunities = await MarketCapService.enrichOpportunitiesWithMarketCap(alertOpportunities);

                // Sort by market cap (highest first) and assign ranks
                sortedOpportunities = MarketCapService.sortByMarketCap(enrichedOpportunities);

                // Log market cap ranking
                console.log('📊 [MARKET CAP] Opportunities ranked by market cap:');
                sortedOpportunities.slice(0, 10).forEach((opp, idx) => {
                    const symbol = opp.stock?.symbol || opp.symbol;
                    const cap = opp.marketCapFormatted || 'N/A';
                    const category = opp.marketCapCategory || 'Unknown';
                    console.log(`   ${idx + 1}. ${symbol} - ${cap} (${category})`);
                });
                if (sortedOpportunities.length > 10) {
                    console.log(`   ... and ${sortedOpportunities.length - 10} more`);
                }

                // Store signals in pending_signals table for automated 1 PM execution
                console.log('📊 [SIGNALS] Storing', sortedOpportunities.length, 'signals for automated execution...');
                const storageResult = await this.storeSignalsForExecution(sortedOpportunities);

                // CRITICAL: Validate storage succeeded before continuing
                // Success criteria: created > 0 OR duplicates > 0 (signals are in database)
                // Fail only if: created = 0 AND duplicates = 0 (no signals in database at all)
                const totalInDatabase = (storageResult.created || 0) + (storageResult.duplicates || 0);

                if (!storageResult.success || totalInDatabase === 0) {
                    const errorMsg = `⚠️ Signal storage failed! Found ${sortedOpportunities.length} signals but none are in database. Created: ${storageResult.created || 0}, Duplicates: ${storageResult.duplicates || 0}, Errors: ${storageResult.errors || 0}`;
                    console.error(errorMsg);

                    // Throw error to prevent Telegram alerts being sent when signals weren't stored
                    throw new Error(`Signal storage failed - execution will have no signals to process. Created: ${storageResult.created || 0}, Duplicates: ${storageResult.duplicates || 0}, Errors: ${storageResult.errors || 0}, Message: ${storageResult.error || 'Unknown error'}`);
                }

                // Log storage validation results
                if (storageResult.created > 0) {
                    console.log(`✅ [SIGNALS] Storage validated: ${storageResult.created} new signals stored`);
                }
                if (storageResult.duplicates > 0) {
                    console.log(`✅ [SIGNALS] Duplicates validated: ${storageResult.duplicates} signals already in database (ready for execution)`);
                }
                console.log(`✅ [SIGNALS] Total signals ready for 1 PM execution: ${totalInDatabase}`);

                // Add trades to portfolio (legacy portfolio page functionality)
                console.log('💼 [PORTFOLIO] Adding', sortedOpportunities.length, 'trades to portfolio...');
                const portfolioResults = [];
                for (const opportunity of sortedOpportunities) {
                    const result = await this.portfolioManager.addTradeFromScan(opportunity);
                    portfolioResults.push(result);
                    if (result.success) {
                        console.log('✅ [PORTFOLIO] Added:', opportunity.stock.symbol);
                    } else if (result.reason === 'duplicate') {
                        console.log('⚠️ [PORTFOLIO] Skipped (duplicate):', opportunity.stock.symbol);
                    }
                }

                const message = this.formatHighConvictionMessage(sortedOpportunities, highConvictionOpportunities.length);

                if (isBroadcast) {
                    // Broadcast conviction trades to subscribers
                    console.log(`📤 [SCANNER] Sending ${sortedOpportunities.length} conviction trades to subscribers...`);
                    const convictionResults = await broadcastToSubscribers({
                        type: 'custom',
                        message: `🌅 *7 AM Conviction Trades*\n\n${message}`
                    }, 'conviction');
                    console.log(`✅ [SCANNER] Conviction trades sent to ${convictionResults.length} subscribers`);

                    // Also send push notifications
                    const symbols = sortedOpportunities.slice(0, 3).map(o => o.stock.symbol).join(', ');
                    const pushResult = await this.sendPushBroadcast(
                        '7 AM Conviction Trades',
                        `${sortedOpportunities.length} signals found: ${symbols}${sortedOpportunities.length > 3 ? '...' : ''}`,
                        { tag: 'scan-results', requireInteraction: true }
                    );
                    console.log(`📱 [SCANNER] Push notification: ${pushResult.sent} sent, ${pushResult.failed} failed`);
                } else {
                    console.log(`📤 [SCANNER] Sending ${sortedOpportunities.length} conviction trades to ${targetChatId}...`);
                    await sendTelegramAlert(targetChatId, {
                        type: 'custom',
                        message: message
                    });
                }
            } else {
                const noResultsMessage = `📊 *High Conviction Scan Complete*\n\nNo recent high conviction opportunities found.\n\nScanned: ${allStocks.length} stocks\nHigh conviction found: ${highConvictionOpportunities.length}\nRecent signals (last 2 days): ${recentOpportunities.length}`;

                if (isBroadcast) {
                    console.log('📤 [SCANNER] Sending "no results" notification to subscribers...');
                    const noResultsResults = await broadcastToSubscribers({
                        type: 'custom',
                        message: `🌅 *7 AM Conviction Trades*\n\n${noResultsMessage}`
                    }, 'conviction');
                    console.log(`✅ [SCANNER] "No results" notification sent to ${noResultsResults.length} subscribers`);

                    // Also send push notification for no results
                    const pushResult = await this.sendPushBroadcast(
                        '7 AM Scan Complete',
                        'No high conviction signals found today',
                        { tag: 'scan-results' }
                    );
                    console.log(`📱 [SCANNER] Push notification: ${pushResult.sent} sent, ${pushResult.failed} failed`);
                } else {
                    console.log(`📤 [SCANNER] Sending "no results" notification to ${targetChatId}...`);
                    await sendTelegramAlert(targetChatId, {
                        type: 'custom',
                        message: noResultsMessage
                    });
                }
            }

            this.scanResults = sortedOpportunities;
            return {
                success: true,
                opportunities: sortedOpportunities,
                totalScanned: allStocks.length,
                highConvictionFound: highConvictionOpportunities.length,
                recentOpportunities: recentOpportunities.length,
                alertsSent: sortedOpportunities.length
            };

        } catch (error) {
            
            const errorMessage = `❌ *Scan Error*\n\nHigh conviction scan failed: ${error.message}`;
            
            if (!chatId) {
                // Broadcast error to all subscribers
                await broadcastToSubscribers({
                    type: 'custom',
                    message: errorMessage
                });
            } else if (targetChatId) {
                // Send error to specific user
                await sendTelegramAlert(targetChatId, {
                    type: 'custom',
                    message: errorMessage
                });
            }
            
            return { error: error.message };
        } finally {
            this.isScanning = false;
        }
    }

    /**
     * Store signals in pending_signals table for automated 1 PM execution
     */
    async storeSignalsForExecution(opportunities) {
        try {
            const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
            const signalsUrl = `${baseUrl}/api/signals/from-scan`;

            // CRITICAL FIX: Use TODAY's date for signal_date so trade executor can find them
            const todayDate = new Date().toISOString().split('T')[0];
            const serverTime = new Date().toISOString();
            const ukTime = new Date().toLocaleString("en-GB", {timeZone: "Europe/London"});

            console.log(`\n${'='.repeat(60)}`);
            console.log(`📊 [SIGNALS] Storing ${opportunities.length} signals for execution`);
            console.log(`${'='.repeat(60)}`);
            console.log(`📅 Signal Date: ${todayDate} (TODAY'S DATE - critical for executor)`);
            console.log(`⏰ Server Time: ${serverTime}`);
            console.log(`🇬🇧 UK Time: ${ukTime}`);
            console.log(`${'='.repeat(60)}\n`);

            const signalsToStore = opportunities.map((opp, index) => {
                const symbol = opp.stock.symbol;
                const market = this.getMarketFromSymbol(symbol);
                const entryPrice = opp.trade?.currentPrice || opp.trade?.entryPrice || 0;
                const targetPrice = entryPrice * 1.08; // 8% profit target
                const stopLoss = entryPrice * 0.95; // 5% stop loss
                // FIX: Use TODAY's date, not historical signal date from backtest
                const signalDate = todayDate; // Changed from: opp.trade.signalDate || opp.trade.entryDate
                const squareOffDate = new Date(signalDate);
                squareOffDate.setDate(squareOffDate.getDate() + 30); // 30 day holding period

                const historicalDate = opp.trade.signalDate || opp.trade.entryDate;

                // Enhanced logging for each signal
                console.log(`   [${index + 1}/${opportunities.length}] 📝 ${symbol}`);
                console.log(`      Market: ${market} (detected from symbol suffix)`);
                console.log(`      Entry Price: ${entryPrice.toFixed(2)}`);
                console.log(`      Win Rate: ${(opp.trade?.winRate || 0).toFixed(1)}%`);
                console.log(`      Signal Date: ${signalDate} ← TODAY (executor will look for this)`);
                console.log(`      Historical Date: ${historicalDate} (from backtest, not used)`);
                console.log(`      Square Off: ${squareOffDate.toISOString().split('T')[0]} (30 days from today)`);

                return {
                    symbol,
                    signalDate,
                    entryPrice,
                    targetPrice,
                    stopLoss,
                    squareOffDate: squareOffDate.toISOString().split('T')[0],
                    market,
                    winRate: opp.trade?.winRate || 0,
                    historicalSignalCount: opp.trade?.totalTrades || 0,
                    entryDTI: opp.trade?.entryDTI || 0,
                    entry7DayDTI: opp.analysis?.current7DayDTI || 0,
                    prevDTI: opp.analysis?.prevDTI || 0,
                    prev7DayDTI: opp.analysis?.prev7DayDTI || 0,
                    historicalSignalDate: opp.trade.signalDate || opp.trade.entryDate, // Keep for reference
                    marketCapUSD: opp.marketCapUSD || null,
                    marketCapRank: opp.marketCapRank || null
                };
            });

            const response = await axios.post(signalsUrl, { signals: signalsToStore }, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                const { created, duplicates, errors } = response.data;

                console.log(`\n${'='.repeat(60)}`);
                console.log(`📊 [SIGNALS] Storage Results`);
                console.log(`${'='.repeat(60)}`);
                console.log(`✅ Created: ${created} new signals`);
                console.log(`⚠️ Duplicates: ${duplicates} signals already existed`);
                console.log(`❌ Errors: ${errors} signals failed`);
                console.log(`${'='.repeat(60)}`);

                if (created > 0) {
                    console.log(`\n🎯 ${created} new signals will be auto-executed at 1 PM in their respective markets:`);
                    console.log(`   🇮🇳 India: 1:00 PM IST`);
                    console.log(`   🇬🇧 UK: 1:00 PM GMT/BST`);
                    console.log(`   🇺🇸 US: 1:00 PM EST/EDT`);
                    console.log(`\n⏰ Executor will look for signals with signal_date = ${todayDate}`);
                }
                if (duplicates > 0) {
                    console.log(`\n⚠️ ${duplicates} signals were duplicates (UNIQUE constraint on symbol+date)`);
                }
                if (errors > 0) {
                    console.error(`\n❌ ${errors} signals failed to store - check API logs for details`);
                }

                console.log(`\n${'='.repeat(60)}\n`);

                return { success: true, created, duplicates, errors };
            } else {
                console.error(`\n${'='.repeat(60)}`);
                console.error(`❌ [SIGNALS] STORAGE FAILED`);
                console.error(`${'='.repeat(60)}`);
                console.error(`Status: ${response.status}`);
                console.error(`Error: ${response.statusText}`);
                console.error(`URL: ${signalsUrl}`);
                console.error(`${'='.repeat(60)}\n`);
                return { success: false, error: response.statusText };
            }

        } catch (error) {
            console.error(`\n${'='.repeat(60)}`);
            console.error(`❌ [SIGNALS] ERROR STORING SIGNALS`);
            console.error(`${'='.repeat(60)}`);
            console.error(`Error Message: ${error.message}`);
            console.error(`Error Type: ${error.name}`);

            if (error.response) {
                // HTTP error response from server
                console.error(`\n🔴 API Response Error:`);
                console.error(`   Status: ${error.response.status} ${error.response.statusText || ''}`);
                console.error(`   Data:`, JSON.stringify(error.response.data, null, 2));
                console.error(`   Headers:`, JSON.stringify(error.response.headers, null, 2));
            } else if (error.request) {
                // Request was made but no response received
                console.error(`\n🔴 No Response Received:`);
                console.error(`   The request was made but no response was received from the API`);
                console.error(`   URL: ${error.config?.url || 'unknown'}`);
                console.error(`   Method: ${error.config?.method || 'unknown'}`);
                console.error(`   Timeout: ${error.config?.timeout || 'unknown'}ms`);
            } else {
                // Something else happened
                console.error(`\n🔴 Request Setup Error:`);
                console.error(`   ${error.message}`);
            }

            if (error.code) {
                console.error(`\nError Code: ${error.code}`);
            }
            if (error.stack) {
                console.error(`\nStack Trace:\n${error.stack}`);
            }

            console.error(`${'='.repeat(60)}\n`);
            return { success: false, error: error.message, created: 0, errors: 1 };
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
                return null;
            }
        });
        
        const results = await Promise.all(promises);
        return results.filter(result => result !== null);
    }


    /**
     * Scan a batch of stocks for current opportunities (like frontend - simple and fast)
     * @param {Array} stocks - Stocks to scan
     * @returns {Array} Current opportunities (entry signals today)
     */
    async scanStockBatchForOpportunities(stocks) {
        const opportunities = [];
        
        const promises = stocks.map(async (stock) => {
            try {
                const stockData = await this.fetchStockData(stock.symbol);
                if (!stockData) return null;
                
                // Use same parameters as frontend
                const params = {
                    r: 14,
                    s: 10,
                    u: 5,
                    entryThreshold: 0,  // Matches frontend default value
                    takeProfitPercent: 8,
                    stopLossPercent: 5,
                    maxHoldingDays: 30
                };
                
                // Use the same logic as frontend: check for ACTIVE TRADES (not just entry signals)
                const backtest = FrontendBacktestCalculator.runBacktest(stockData, params);
                
                // Look for active trade (like frontend does)
                const activeTrade = backtest?.trades?.find(trade => trade.isOpen === true);
                
                let opportunity = null;
                if (activeTrade) {
                    // Convert active trade to opportunity format (same as checkForOpportunity)
                    opportunity = {
                        symbol: stockData.symbol,
                        currentPrice: activeTrade.currentPrice,
                        currentDTI: activeTrade.entryDTI,
                        current7DayDTI: activeTrade.entry7DayDTI,
                        signalDate: activeTrade.signalDate || activeTrade.entryDate,
                        winRate: backtest.metrics.winRate,
                        totalTrades: backtest.metrics.totalTrades,
                        backtest: backtest,
                        activeTrade: activeTrade
                    };
                }
                
                if (opportunity) {  // Found a current opportunity
                    return {
                        stock: {
                            symbol: stock.symbol,
                            name: stock.name
                        },
                        trade: {
                            entryDate: opportunity.signalDate,
                            signalDate: opportunity.signalDate,
                            entryPrice: opportunity.currentPrice,
                            entryDTI: opportunity.currentDTI,
                            currentPrice: opportunity.currentPrice,
                            winRate: opportunity.winRate,
                            totalTrades: opportunity.totalTrades
                        },
                        data: stockData,
                        analysis: opportunity
                    };
                }
            } catch (error) {
            }
            return null;
        });
        
        const results = await Promise.all(promises);
        return results.filter(result => result !== null);
    }

    /**
     * Scan a batch of stocks with REAL backtesting (legacy - keeping for reference)
     */
    async scanStockBatchWithBacktest(stocks) {
        const opportunities = [];
        
        const promises = stocks.map(async (stock) => {
            try {
                const stockData = await this.fetchStockData(stock.symbol);
                if (!stockData) return null;
                
                // Use real backtest calculator with same parameters as frontend
                const params = {
                    r: 14,
                    s: 10,
                    u: 5,
                    entryThreshold: 0,  // Matches frontend default value
                    takeProfitPercent: 8,
                    stopLossPercent: 5,
                    maxHoldingDays: 30
                };
                
                // Check for current opportunity using frontend-based algorithm
                const opportunity = FrontendBacktestCalculator.checkForOpportunity(stockData, params);
                
                // Debug: Log signal date info for first few stocks
                if (opportunity && stockData.dates) {
                    const latestDate = stockData.dates[stockData.dates.length - 1];
                }
                
                if (opportunity) {  // Collect ALL opportunities, filter by win rate later
                    return {
                        stock: {
                            symbol: stock.symbol,
                            name: stock.name
                        },
                        trade: {
                            entryDate: opportunity.signalDate,
                            signalDate: opportunity.signalDate,
                            entryPrice: opportunity.currentPrice,
                            entryDTI: opportunity.currentDTI,
                            currentPrice: opportunity.currentPrice,
                            winRate: opportunity.winRate,
                            totalTrades: opportunity.totalTrades
                        },
                        data: stockData,
                        analysis: opportunity
                    };
                }
            } catch (error) {
            }
            return null;
        });
        
        const results = await Promise.all(promises);
        return results.filter(result => result !== null);
    }


    /**
     * Find current opportunities (like frontend scan - no filtering)
     * @returns {Array} All current opportunities (with entry signals today)
     */
    async findCurrentOpportunities(allStocks) {
        const opportunities = [];
        const batchSize = 10;
        
        
        for (let i = 0; i < allStocks.length; i += batchSize) {
            const batch = allStocks.slice(i, i + batchSize);
            const batchResults = await this.scanStockBatchForOpportunities(batch);
            opportunities.push(...batchResults);
            
            // Progress update
            if (i % 100 === 0) {
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        return opportunities;
    }


    /**
     * Get comprehensive stock list (matches frontend 2000+ stocks)
     */
    getComprehensiveStockList() {
        // Use the comprehensive shared stock data (SINGLE SOURCE OF TRUTH)
        const { getAllStocks } = require('../shared/stock-data');
        const allStocks = getAllStocks();
        
        
        return allStocks;
    }


    /**
     * Determine market from stock symbol
     */
    getMarketFromSymbol(symbol) {
        if (symbol.includes('.NS')) return 'India';
        if (symbol.includes('.L')) return 'UK';
        if (!symbol.includes('.')) return 'US';
        return 'International';
    }

    /**
     * Calculate square off date (30 days from entry for max holding period)
     */
    calculateSquareOffDate(entryDate) {
        const entry = new Date(entryDate);
        const squareOff = new Date(entry);
        squareOff.setDate(entry.getDate() + 30); // Max holding period
        return squareOff.toLocaleDateString('en-GB');
    }

    /**
     * Format high conviction message with detailed information
     */
    formatHighConvictionMessage(alertOpportunities, totalOpportunities) {
        if (!alertOpportunities || alertOpportunities.length === 0) {
            return '📊 *High Conviction Scan Complete*\n\nNo high conviction opportunities found.';
        }

        let message = `📊 *🎯 HIGH CONVICTION TRADING OPPORTUNITIES*\n`;
        message += `Found ${alertOpportunities.length} Active Trades\n`;
        message += `Scan Date: *${new Date().toLocaleDateString('en-GB')}*\n\n`;
        
        // Add individual opportunities with complete details
        alertOpportunities.forEach((opp, index) => {
            const stockName = opp.stock?.name || 'Unknown';
            const stockCode = opp.stock.symbol;
            const market = this.getMarketFromSymbol(stockCode);
            
            const currentPrice = opp.trade?.currentPrice || opp.trade?.entryPrice || 0;
            const targetPrice = (currentPrice * 1.08).toFixed(2); // 8% profit target
            const stopLossPrice = (currentPrice * 0.95).toFixed(2); // 5% stop loss
            
            // Currency symbol based on market
            const currencySymbol = market === 'India' ? '₹' : market === 'UK' ? '£' : '$';
            
            const entryDate = opp.trade.signalDate || opp.trade.entryDate;
            const squareOffDate = this.calculateSquareOffDate(entryDate);
            
            const winRate = opp.trade?.winRate || 0;
            const totalTrades = opp.trade?.totalTrades || 0;
            
            // Debug log
            
            message += `🎯 *${stockName}*\n`;
            message += `Code: ${stockCode}\n`;
            message += `Market: ${market}\n`;
            message += `Current Price: ${currencySymbol}${currentPrice.toFixed(2)}\n`;
            message += `Target Price: ${currencySymbol}${targetPrice}\n`;
            message += `Stop Loss: ${currencySymbol}${stopLossPrice}\n`;
            message += `Square Off Date: ${squareOffDate}\n`;
            message += `Win Ratio: ${winRate.toFixed(1)}%\n`;
            message += `Backtested Trades: ${totalTrades} (5 years)\n`;
            
            if (index < alertOpportunities.length - 1) message += `\n`;
        });
        
        message += `\n📈 Total Scanned: ${totalOpportunities || 'All'} stocks`;
        
        return message;
    }

    /**
     * Fetch stock data from Yahoo Finance API (same method as frontend)
     */
    async fetchStockData(symbol) {
        try {
            // Calculate date range (5 years of data - same as frontend default)
            const endDate = Math.floor(Date.now() / 1000);
            const startDate = endDate - (5 * 365 * 24 * 60 * 60); // 5 years ago (same as frontend)
            
            // Construct absolute URL for backend API call
            const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
            const proxyUrl = `${baseUrl}/yahoo/history?symbol=${symbol}&period1=${startDate}&period2=${endDate}&interval=1d`;
            
            // Use axios for consistency with rest of codebase
            const response = await axios.get(proxyUrl, {
                timeout: 10000,
                headers: {
                    'Accept': 'text/csv'
                }
            });
            
            if (response.status !== 200) {
                return null;
            }

            // Frontend expects CSV data, so we need to parse the response accordingly
            const csvText = response.data;
            
            // Process the CSV text into the format we need (same as frontend)
            const rows = csvText.trim().split('\n');
            if (rows.length < 2) {
                return null;
            }
            
            const headers = rows[0].toLowerCase().split(',');
            
            // Create stock data object similar to frontend processing
            const stockData = {
                symbol: symbol,
                prices: [],
                dates: []
            };
            
            for (let i = 1; i < rows.length; i++) {
                if (rows[i].trim()) {
                    const values = rows[i].split(',');
                    if (values.length >= 6) {
                        stockData.dates.push(values[0]); // Date
                        stockData.prices.push({
                            date: values[0],
                            open: parseFloat(values[1]),
                            high: parseFloat(values[2]),
                            low: parseFloat(values[3]),
                            close: parseFloat(values[4]),
                            volume: parseInt(values[5])
                        });
                    }
                }
            }
            
            // Extract price arrays for DTI calculation
            const high = stockData.prices.map(p => p.high);
            const low = stockData.prices.map(p => p.low);
            const close = stockData.prices.map(p => p.close);
            
            // Calculate DTI using same parameters as frontend
            const r = 14;
            const s = 10;
            const u = 5;
            
            const dti = calculateDTI(high, low, r, s, u);
            const sevenDayDTI = calculate7DayDTI(stockData.dates, high, low, r, s, u);
            
            // Return data in format expected by frontend-based backtest calculator
            return {
                symbol: symbol,
                dates: stockData.dates,
                high: high,
                low: low,
                close: close,
                dti: dti,
                sevenDayDTI: sevenDayDTI,
                currentPrice: stockData.prices[stockData.prices.length - 1].close
            };
            
        } catch (error) {
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
     * Get scanner status (required by server endpoints)
     */
    getStatus() {
        return {
            isScanning: this.isScanning,
            lastScanResults: this.scanResults.length,
            scheduledJobs: this.scheduledJobs.length,
            scannerType: 'High Conviction Pattern Scanner'
        };
    }

    /**
     * Stop all scheduled jobs
     */
    stop() {
        this.scheduledJobs.forEach(job => job.destroy());
        this.scheduledJobs = [];
    }
}

module.exports = StockScanner;