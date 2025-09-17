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
const FrontendBacktestCalculator = require('../shared/frontend-backtest-calculator');
const BacktestCalculator = require('../shared/backtest-calculator');

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

        // Schedule daily scan at 7 AM UK time
        const dailyScanJob = cron.schedule('0 7 * * *', async () => {

            // Check if Telegram is configured at runtime
            if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
                return;
            }

            try {
                // Run high conviction pattern scan (same as successful manual scan)
                await this.runHighConvictionScan();
            } catch (error) {
            }
        }, {
            timezone: "Europe/London",
            scheduled: true  // Explicitly set scheduled to true
        });

        this.scheduledJobs.push(dailyScanJob);

        // Add verification to ensure job is really scheduled

        // Add next run time calculation for debugging
        const now = new Date();
        const ukNow = new Date(now.toLocaleString("en-US", {timeZone: "Europe/London"}));
        const next7am = new Date(ukNow);
        next7am.setHours(7, 0, 0, 0);
        if (next7am <= ukNow) {
            next7am.setDate(next7am.getDate() + 1);
        }

        // Add debug cron job if enabled
        if (process.env.DEBUG_CRON === 'true') {
            const testJob = cron.schedule('* * * * *', () => {
            }, {
                timezone: "Europe/London",
                scheduled: true
            });
            this.scheduledJobs.push(testJob);
        }

        // Add hourly heartbeat to verify cron is still running
        const heartbeatJob = cron.schedule('0 * * * *', () => {
            const ukTime = new Date().toLocaleString("en-GB", {timeZone: "Europe/London"});

            // Check if next run is 7 AM
            const hour = new Date().getHours();
            if (hour === 6) {
            }
        }, {
            timezone: "Europe/London",
            scheduled: true
        });
        this.scheduledJobs.push(heartbeatJob);

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
                await broadcastToSubscribers({
                    type: 'custom',
                    message: `🔍 *High Conviction Pattern Scan Started*\n\nScanning all global stocks for high conviction opportunities...`
                }, 'scans');
            } else if (targetChatId) {
                // Single user test
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
            if (alertOpportunities.length > 0) {
                const message = this.formatHighConvictionMessage(alertOpportunities, highConvictionOpportunities.length);
                
                if (isBroadcast) {
                    // Broadcast conviction trades to subscribers
                    await broadcastToSubscribers({
                        type: 'custom',
                        message: `🌅 *7 AM Conviction Trades*\n\n${message}`
                    }, 'conviction');
                } else {
                    await sendTelegramAlert(targetChatId, {
                        type: 'custom',
                        message: message
                    });
                }
            } else {
                const noResultsMessage = `📊 *High Conviction Scan Complete*\n\nNo recent high conviction opportunities found.\n\nScanned: ${allStocks.length} stocks\nHigh conviction found: ${highConvictionOpportunities.length}\nRecent signals (last 2 days): ${recentOpportunities.length}`;
                
                if (isBroadcast) {
                    await broadcastToSubscribers({
                        type: 'custom',
                        message: `🌅 *7 AM Conviction Trades*\n\n${noResultsMessage}`
                    }, 'conviction');
                } else {
                    await sendTelegramAlert(targetChatId, {
                        type: 'custom',
                        message: noResultsMessage
                    });
                }
            }

            this.scanResults = alertOpportunities;
            return {
                success: true,
                opportunities: alertOpportunities,
                totalScanned: allStocks.length,
                highConvictionFound: highConvictionOpportunities.length,
                recentOpportunities: recentOpportunities.length,
                alertsSent: alertOpportunities.length
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