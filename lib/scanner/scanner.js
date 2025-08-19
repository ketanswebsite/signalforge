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
const BacktestCalculator = require('../shared/backtest-calculator');

class StockScanner {
    constructor() {
        this.isScanning = false;
        this.scheduledJobs = [];
        this.scanResults = [];
        this.allStocksBacktestResults = []; // Store historical results like frontend's DTIBacktester.allStocksData
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
                // Run high conviction pattern scan (same as successful manual scan)
                await this.runHighConvictionScan();
                console.log('[CRON] High conviction scan completed successfully');
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
     * Run high conviction pattern scan - same logic as successful manual scan
     */
    async runHighConvictionScan(chatId = null) {
        console.log(`[runHighConvictionScan] Starting high conviction scan with chatId: ${chatId || 'default'}`);
        
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
                message: `🔍 *High Conviction Pattern Scan Started*\n\nScanning all global stocks for high conviction opportunities...`
            });

            // Get all stocks using comprehensive data (matches frontend)
            const allStocks = this.getComprehensiveStockList();
            console.log(`📊 Scanning ${allStocks.length} stocks across all markets`);

            // First: Process all stocks and store historical backtest results (like frontend)
            console.log('📊 Running comprehensive backtest analysis on all stocks...');
            await this.processAllStocksForBacktest(allStocks);
            console.log(`✅ Stored backtest results for ${this.allStocksBacktestResults.length} stocks`);
            
            // Second: Find all opportunities using individual stock analysis
            const allOpportunities = await this.findAllDTIOpportunities(allStocks);
            console.log(`📈 Total opportunities found: ${allOpportunities.length}`);
            
            // Third: Calculate win rates from stored historical data (like frontend)
            const stockWinRates = this.calculateStockWinRates();
            console.log(`📊 Calculated win rates for ${Object.keys(stockWinRates).length} stocks`);
            
            // Fourth: Filter for high conviction using calculated win rates (like frontend)
            const highConvictionOpportunities = allOpportunities.filter(opp => {
                const winRate = stockWinRates[opp.stock.symbol] || 0;
                return winRate > 75;
            });
            console.log(`⭐ High conviction opportunities (>75% win rate): ${highConvictionOpportunities.length}`);

            // Filter for opportunities from last 2 trading days only
            const recentOpportunities = highConvictionOpportunities.filter(opp => {
                const signalDate = opp.trade.signalDate || opp.trade.entryDate;
                return BacktestCalculator.isWithinTradingDays(signalDate, 2);
            });
            console.log(`📅 Recent high conviction opportunities: ${recentOpportunities.length}`);

            // Take up to 5 recent high conviction opportunities (same as frontend)
            const alertOpportunities = recentOpportunities.slice(0, 5);
            console.log(`📤 Sending alerts for: ${alertOpportunities.length}`);

            // Log which opportunities are being sent (same as frontend)
            alertOpportunities.forEach(opp => {
                const signalDate = new Date(opp.trade.signalDate || opp.trade.entryDate);
                console.log(`✅ Including ${opp.stock.symbol} - signal from ${signalDate.toLocaleDateString()}`);
            });

            // Send results using same format as successful manual scan
            if (alertOpportunities.length > 0) {
                const message = this.formatHighConvictionMessage(alertOpportunities, highConvictionOpportunities.length);
                await sendTelegramAlert(targetChatId, {
                    type: 'custom',
                    message: message
                });
            } else {
                await sendTelegramAlert(targetChatId, {
                    type: 'custom',
                    message: `📊 *High Conviction Scan Complete*\n\nNo recent high conviction opportunities found.\n\nScanned: ${allStocks.length} stocks\nHigh conviction found: ${highConvictionOpportunities.length}\nRecent signals (last 2 days): ${recentOpportunities.length}`
                });
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
            console.error('❌ Error in high conviction scan:', error);
            
            const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;
            if (targetChatId) {
                await sendTelegramAlert(targetChatId, {
                    type: 'custom',
                    message: `❌ *Scan Error*\n\nHigh conviction scan failed: ${error.message}`
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
     * Process all stocks for backtest data storage (like frontend fetchAllStocksData)
     */
    async processAllStocksForBacktest(allStocks) {
        this.allStocksBacktestResults = []; // Clear previous results
        const batchSize = 10;
        
        for (let i = 0; i < allStocks.length; i += batchSize) {
            const batch = allStocks.slice(i, i + batchSize);
            const batchResults = await this.processStockBatchWithBacktest(batch);
            this.allStocksBacktestResults.push(...batchResults);
            
            // Progress update
            if (i % 100 === 0) {
                console.log(`🔄 Processed ${Math.min(i + batchSize, allStocks.length)}/${allStocks.length} stocks for backtest data`);
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log(`✅ Stored backtest data for ${this.allStocksBacktestResults.length} stocks`);
    }

    /**
     * Find all DTI opportunities across all stocks with REAL backtesting
     */
    async findAllDTIOpportunities(allStocks) {
        const opportunities = [];
        const batchSize = 10;
        
        for (let i = 0; i < allStocks.length; i += batchSize) {
            const batch = allStocks.slice(i, i + batchSize);
            const batchResults = await this.scanStockBatchWithBacktest(batch);
            opportunities.push(...batchResults);
            
            // Progress update
            if (i % 100 === 0) {
                console.log(`🔄 Scanned ${Math.min(i + batchSize, allStocks.length)}/${allStocks.length} stocks`);
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return opportunities;
    }

    /**
     * Process batch of stocks and store ALL backtest results (like frontend)
     */
    async processStockBatchWithBacktest(stocks) {
        const backtestResults = [];
        
        const promises = stocks.map(async (stock) => {
            try {
                const stockData = await this.fetchStockData(stock.symbol);
                if (!stockData) return null;
                
                // Use real backtest calculator with same parameters as frontend
                const params = {
                    r: 14,
                    s: 10,
                    u: 5,
                    entryThreshold: -40,  // Correct threshold for entry signals
                    takeProfitPercent: 8,
                    stopLossPercent: 5,
                    maxHoldingDays: 30
                };
                
                // Run complete backtest to get all trades (like frontend)
                const backtestResult = BacktestCalculator.runBacktest(stockData, params);
                
                if (backtestResult) {
                    return {
                        stock: {
                            symbol: stock.symbol,
                            name: stock.name
                        },
                        trades: backtestResult.trades, // Store all trades for win rate calculation
                        data: stockData,
                        backtest: backtestResult
                    };
                }
            } catch (error) {
                console.error(`Error processing ${stock.symbol}:`, error.message);
            }
            return null;
        });
        
        const results = await Promise.all(promises);
        return results.filter(result => result !== null);
    }

    /**
     * Scan a batch of stocks with REAL backtesting
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
                    entryThreshold: -40,  // Correct threshold for entry signals
                    takeProfitPercent: 8,
                    stopLossPercent: 5,
                    maxHoldingDays: 30
                };
                
                // Check for current opportunity with real backtesting
                const opportunity = BacktestCalculator.checkForOpportunity(stockData, params);
                
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
                console.error(`Error scanning ${stock.symbol}:`, error.message);
            }
            return null;
        });
        
        const results = await Promise.all(promises);
        return results.filter(result => result !== null);
    }


    /**
     * Calculate win rates for all stocks based on historical trades (matches frontend logic)
     * @returns {Object} - Object mapping stock symbols to win rates
     */
    calculateStockWinRates() {
        const winRates = {};
        
        // Go through allStocksBacktestResults to calculate win rates (same as frontend)
        if (this.allStocksBacktestResults && this.allStocksBacktestResults.length > 0) {
            this.allStocksBacktestResults.forEach(data => {
                if (data && data.stock && data.trades && data.trades.length > 0) {
                    const symbol = data.stock.symbol;
                    const completedTrades = data.trades;
                    
                    // Calculate win rate (exact frontend logic)
                    let winningTrades = 0;
                    let totalTrades = completedTrades.length;
                    
                    if (totalTrades > 0) {
                        completedTrades.forEach(trade => {
                            if (trade.plPercent > 0) {
                                winningTrades++;
                            }
                        });
                        
                        const winRate = (winningTrades / totalTrades) * 100;
                        winRates[symbol] = winRate;
                    } else {
                        winRates[symbol] = 0;
                    }
                }
            });
        }
        
        return winRates;
    }

    /**
     * Get comprehensive stock list (matches frontend 2000+ stocks)
     */
    getComprehensiveStockList() {
        // Use the comprehensive shared stock data (SINGLE SOURCE OF TRUTH)
        const { getAllStocks } = require('../shared/stock-data');
        const allStocks = getAllStocks();
        
        console.log(`✅ Using comprehensive stock data: ${allStocks.length} stocks from shared module`);
        console.log(`📊 Backend and frontend now synchronized with same stock count`);
        
        return allStocks;
    }


    /**
     * Format high conviction message (same format as successful manual scan)
     */
    formatHighConvictionMessage(alertOpportunities, totalOpportunities) {
        if (!alertOpportunities || alertOpportunities.length === 0) {
            return '📊 *High Conviction Scan Complete*\n\nNo high conviction opportunities found.';
        }

        let message = `📊 *🎯 TECHNICAL PATTERNS FOUND*\n`;
        message += `Found ${alertOpportunities.length} Strong Technical Patterns\n\n`;
        
        // Add summary stats (same as frontend)
        message += `Total Opportunities Scanned: *${totalOpportunities}*\n`;
        message += `Top Patterns Selected: *${alertOpportunities.length}*\n`;
        message += `Scan Date: *${new Date().toLocaleDateString()}*\n\n`;
        
        // Add individual opportunities with win rate info
        alertOpportunities.forEach((opp, index) => {
            const entryPrice = opp.trade?.currentPrice || opp.trade?.entryPrice || 0;
            const targetPrice = (entryPrice * 1.08).toFixed(2); // 8% profit target
            const stopLossPrice = (entryPrice * 0.95).toFixed(2); // 5% stop loss
            const currencySymbol = opp.stock.symbol.includes('.NS') ? '₹' : '$';
            const winRate = opp.trade?.winRate || 0;
            const totalTrades = opp.trade?.totalTrades || 0;
            
            message += `🎯 *${opp.stock.symbol}*\n`;
            message += `Entry: ${currencySymbol}${entryPrice.toFixed(2)}\n`;
            message += `Target: ${currencySymbol}${targetPrice}\n`;
            message += `Stop: ${currencySymbol}${stopLossPrice}\n`;
            message += `Win Rate: ${winRate.toFixed(1)}% (${totalTrades} trades)\n`;
            if (index < alertOpportunities.length - 1) message += `\n`;
        });
        
        return message;
    }

    /**
     * Fetch stock data from Yahoo Finance API (same method as frontend)
     */
    async fetchStockData(symbol) {
        try {
            // Calculate date range (last 6 months of data)
            const endDate = Math.floor(Date.now() / 1000);
            const startDate = endDate - (180 * 24 * 60 * 60); // 180 days ago
            
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
                console.error(`Error fetching data for ${symbol}: HTTP ${response.status}`);
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
            
            // Return data in format expected by DTI calculator
            return {
                symbol: symbol,
                dates: stockData.dates,
                high: stockData.prices.map(p => p.high),
                low: stockData.prices.map(p => p.low),
                close: stockData.prices.map(p => p.close),
                currentPrice: stockData.prices[stockData.prices.length - 1].close
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
        console.log('🛑 Stock Scanner Service stopped');
    }
}

module.exports = StockScanner;