/**
 * Stock Scanner Module
 * Automated scanning of global stocks with configurable alerts
 */

const axios = require('axios');
const cron = require('node-cron');
const { sendTelegramAlert } = require('./telegram-bot');

// Load stock lists from DTI data
const fs = require('fs');
const path = require('path');

// Function to load stock lists from DTI data file
function loadStockLists() {
    try {
        // Read the DTI data file
        const dtiDataPath = path.join(__dirname, 'public', 'js', 'dti-data.js');
        const dtiDataContent = fs.readFileSync(dtiDataPath, 'utf8');
        
        // Extract stock lists using regex
        const nifty50Match = dtiDataContent.match(/const nifty50Stocks = \[([\s\S]*?)\];/);
        const niftyNext50Match = dtiDataContent.match(/const niftyNext50Stocks = \[([\s\S]*?)\];/);
        const niftyMidcap150Match = dtiDataContent.match(/const niftyMidcap150Stocks = \[([\s\S]*?)\];/);
        const ftse100Match = dtiDataContent.match(/const ftse100Stocks = \[([\s\S]*?)\];/);
        const ftse250Match = dtiDataContent.match(/const ftse250Stocks = \[([\s\S]*?)\];/);
        const usStocksMatch = dtiDataContent.match(/const usStocks = \[([\s\S]*?)\];/);
        
        // Parse the stock lists
        const parseStockList = (match) => {
            if (!match) return [];
            try {
                // Extract symbols from the match
                const symbols = [];
                const regex = /symbol:\s*"([^"]+)"/g;
                let symbolMatch;
                while ((symbolMatch = regex.exec(match[1])) !== null) {
                    symbols.push(symbolMatch[1]);
                }
                return symbols;
            } catch (e) {
                console.error('Error parsing stock list:', e);
                return [];
            }
        };
        
        // Combine all Indian stocks
        const nseStocks = [
            ...parseStockList(nifty50Match),
            ...parseStockList(niftyNext50Match),
            ...parseStockList(niftyMidcap150Match)
        ].filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates
        
        // Combine all UK stocks
        const ukStocks = [
            ...parseStockList(ftse100Match),
            ...parseStockList(ftse250Match)
        ].filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates
        
        // US stocks
        const usStocksList = parseStockList(usStocksMatch);
        
        console.log(`Loaded stock lists: ${nseStocks.length} NSE, ${ukStocks.length} UK, ${usStocksList.length} US stocks`);
        
        return {
            NSE: nseStocks,
            UK: ukStocks,
            US: usStocksList
        };
    } catch (error) {
        console.error('Error loading stock lists from DTI data:', error);
        // Fallback to empty lists
        return {
            NSE: [],
            UK: [],
            US: []
        };
    }
}

// Load stock lists
const STOCK_LISTS = loadStockLists();

// Technical indicators configuration
const SCAN_CRITERIA = {
    // Price action patterns
    breakout: {
        name: 'Breakout Alert',
        check: (data) => {
            if (!data.prices || data.prices.length < 20) return false;
            const currentPrice = data.prices[data.prices.length - 1];
            const high20Day = Math.max(...data.prices.slice(-20));
            return currentPrice >= high20Day * 0.98; // Within 2% of 20-day high
        }
    },
    pullback: {
        name: 'Pullback Opportunity',
        check: (data) => {
            if (!data.prices || data.prices.length < 10) return false;
            const currentPrice = data.prices[data.prices.length - 1];
            const sma10 = data.prices.slice(-10).reduce((a, b) => a + b) / 10;
            const prevPrice = data.prices[data.prices.length - 2];
            return currentPrice < sma10 && prevPrice >= sma10; // Just crossed below SMA10
        }
    },
    volumeSpike: {
        name: 'Volume Spike',
        check: (data) => {
            if (!data.volumes || data.volumes.length < 20) return false;
            const currentVolume = data.volumes[data.volumes.length - 1];
            const avgVolume = data.volumes.slice(-20).reduce((a, b) => a + b) / 20;
            return currentVolume > avgVolume * 2; // Volume 2x average
        }
    },
    momentum: {
        name: 'Strong Momentum',
        check: (data) => {
            if (!data.prices || data.prices.length < 5) return false;
            const gain5Day = ((data.prices[data.prices.length - 1] - data.prices[data.prices.length - 6]) / data.prices[data.prices.length - 6]) * 100;
            return gain5Day > 5; // 5% gain in 5 days
        }
    },
    oversold: {
        name: 'Oversold Bounce',
        check: (data) => {
            if (!data.rsi) return false;
            return data.rsi < 30; // RSI below 30
        }
    }
};

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
     * Run a global scan of all configured stocks
     */
    async runGlobalScan(chatId = null) {
        if (this.isScanning) {
            console.log('⚠️ Scan already in progress');
            return;
        }

        this.isScanning = true;
        this.scanResults = [];
        
        try {
            console.log('🔍 Starting global stock scan...');
            
            // Use provided chatId or default from environment
            const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;
            
            if (!targetChatId) {
                console.error('❌ No Telegram chat ID configured for scan results');
                return;
            }

            // Send scan start notification
            await sendTelegramAlert(targetChatId, {
                type: 'custom',
                message: `🔍 *Global Stock Scan Started*\n\n` +
                         `📊 Scanning ${STOCK_LISTS.NSE.length} NSE stocks\n` +
                         `📊 Scanning ${STOCK_LISTS.UK.length} UK stocks\n` +
                         `📊 Scanning ${STOCK_LISTS.US.length} US stocks\n\n` +
                         `Total: ${STOCK_LISTS.NSE.length + STOCK_LISTS.UK.length + STOCK_LISTS.US.length} stocks\n\n` +
                         `⏳ This may take a few minutes...`
            });

            // Scan NSE stocks
            const nseResults = await this.scanMarket('NSE', STOCK_LISTS.NSE);
            
            // Scan UK stocks
            const ukResults = await this.scanMarket('UK', STOCK_LISTS.UK);
            
            // Scan US stocks
            const usResults = await this.scanMarket('US', STOCK_LISTS.US);
            
            // Combine results
            const allResults = [...nseResults, ...ukResults, ...usResults];
            this.scanResults = allResults;
            
            // Send results
            await this.sendScanResults(targetChatId, allResults);
            
            console.log(`✅ Global scan completed. Found ${allResults.length} opportunities`);
            
        } catch (error) {
            console.error('❌ Error during global scan:', error);
            
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
     * Scan a specific market
     */
    async scanMarket(market, symbols) {
        const results = [];
        const batchSize = 10; // Process in batches to avoid rate limits
        
        for (let i = 0; i < symbols.length; i += batchSize) {
            const batch = symbols.slice(i, i + batchSize);
            const batchPromises = batch.map(symbol => this.scanStock(market, symbol));
            
            const batchResults = await Promise.allSettled(batchPromises);
            
            batchResults.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    results.push(...result.value);
                }
            });
            
            // Small delay between batches
            if (i + batchSize < symbols.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        return results;
    }

    /**
     * Scan individual stock
     */
    async scanStock(market, symbol) {
        try {
            // Fetch stock data (you'll need to implement this based on your data source)
            const stockData = await this.fetchStockData(market, symbol);
            
            if (!stockData) return null;
            
            const alerts = [];
            
            // Check all criteria
            for (const [key, criterion] of Object.entries(SCAN_CRITERIA)) {
                if (criterion.check(stockData)) {
                    alerts.push({
                        symbol: symbol,
                        market: market,
                        type: key,
                        name: criterion.name,
                        price: stockData.currentPrice,
                        change: stockData.changePercent,
                        volume: stockData.volume
                    });
                }
            }
            
            return alerts;
            
        } catch (error) {
            console.error(`Error scanning ${symbol}:`, error.message);
            return null;
        }
    }

    /**
     * Fetch stock data from Yahoo Finance
     */
    async fetchStockData(market, symbol) {
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1mo`;
            
            const response = await axios.get(url, { 
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                },
                timeout: 5000
            });
            
            const data = response.data;
            if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
                return null;
            }
            
            const result = data.chart.result[0];
            const meta = result.meta;
            const quote = result.indicators.quote[0];
            
            // Extract price and volume data
            const prices = quote.close || [];
            const volumes = quote.volume || [];
            const currentPrice = meta.regularMarketPrice || prices[prices.length - 1];
            const previousClose = meta.previousClose || meta.chartPreviousClose;
            
            // Calculate RSI (simplified)
            let rsi = 50; // Default
            if (prices.length >= 14) {
                const changes = [];
                for (let i = 1; i < prices.length; i++) {
                    changes.push(prices[i] - prices[i - 1]);
                }
                const gains = changes.filter(c => c > 0);
                const losses = changes.filter(c => c < 0).map(c => Math.abs(c));
                const avgGain = gains.reduce((a, b) => a + b, 0) / 14;
                const avgLoss = losses.reduce((a, b) => a + b, 0) / 14;
                const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
                rsi = 100 - (100 / (1 + rs));
            }
            
            return {
                symbol: symbol,
                currentPrice: currentPrice,
                prices: prices,
                volumes: volumes,
                changePercent: ((currentPrice - previousClose) / previousClose) * 100,
                volume: volumes[volumes.length - 1] || 0,
                rsi: rsi
            };
        } catch (error) {
            console.error(`Error fetching data for ${symbol}:`, error.message);
            return null;
        }
    }

    /**
     * Send scan results via Telegram
     */
    async sendScanResults(chatId, results) {
        if (!results || results.length === 0) {
            await sendTelegramAlert(chatId, {
                type: 'custom',
                message: `📊 *Global Scan Complete*\n\n` +
                         `No significant opportunities found at this time.\n\n` +
                         `Next scan: Tomorrow at 7 AM UK time`
            });
            return;
        }

        // Group results by alert type
        const groupedResults = {};
        results.forEach(result => {
            if (!groupedResults[result.name]) {
                groupedResults[result.name] = [];
            }
            groupedResults[result.name].push(result);
        });

        // Build message
        let message = `🎯 *Global Scan Results*\n\n`;
        message += `Found ${results.length} opportunities:\n\n`;

        for (const [alertType, stocks] of Object.entries(groupedResults)) {
            message += `*${alertType}* (${stocks.length}):\n`;
            
            // Show top 5 for each category
            stocks.slice(0, 5).forEach(stock => {
                const emoji = stock.change > 0 ? '📈' : '📉';
                message += `${emoji} ${stock.symbol} (${stock.market}) - ${stock.change > 0 ? '+' : ''}${stock.change.toFixed(2)}%\n`;
            });
            
            if (stocks.length > 5) {
                message += `... and ${stocks.length - 5} more\n`;
            }
            
            message += '\n';
        }

        message += `\n⏰ Next scan: Tomorrow at 7 AM UK time`;

        // Send the results
        await sendTelegramAlert(chatId, {
            type: 'custom',
            message: message
        });
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