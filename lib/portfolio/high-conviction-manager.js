/**
 * High Conviction Portfolio Manager
 * Manages high conviction trades portfolio with multi-currency P&L tracking
 * Generates weekly reports for Telegram broadcast
 */

const axios = require('axios');
const TradeDB = require('../../database-postgres');
const { broadcastToSubscribers } = require('../telegram/telegram-bot');

// Exchange rates (can be updated with real-time API)
const EXCHANGE_RATES = {
    GBP_TO_INR: 105.0,
    GBP_TO_USD: 1.27,
    USD_TO_GBP: 0.79,
    USD_TO_INR: 83.0,
    INR_TO_GBP: 0.0095,
    INR_TO_USD: 0.012
};

// Default investment amounts per market
const DEFAULT_INVESTMENTS = {
    'UK': { gbp: 250, inr: 26250, usd: 318 },
    'India': { gbp: 238, inr: 25000, usd: 301 },
    'US': { gbp: 236, inr: 24900, usd: 300 },
    'International': { gbp: 250, inr: 26250, usd: 318 }
};

class HighConvictionPortfolioManager {
    constructor() {
        this.portfolioCache = null;
        this.lastUpdateTime = null;
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
     * Get currency symbol for market
     */
    getCurrencySymbol(market) {
        switch(market) {
            case 'India': return '₹';
            case 'UK': return '£';
            case 'US': return '$';
            default: return '$';
        }
    }

    /**
     * Calculate multi-currency investment amounts
     */
    calculateInvestments(market) {
        return DEFAULT_INVESTMENTS[market] || DEFAULT_INVESTMENTS['International'];
    }

    /**
     * Calculate shares based on investment amount
     */
    calculateShares(investment, entryPrice) {
        return investment / entryPrice;
    }

    /**
     * Calculate P&L in all currencies
     */
    calculatePL(entryPrice, currentPrice, shares, market) {
        const plPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
        const investments = this.calculateInvestments(market);

        // Calculate P&L in the native currency first
        let nativePL = 0;
        if (market === 'UK') {
            nativePL = (currentPrice - entryPrice) * shares;
        } else if (market === 'India') {
            nativePL = (currentPrice - entryPrice) * shares;
        } else { // US and International
            nativePL = (currentPrice - entryPrice) * shares;
        }

        // Convert to all three currencies
        let plGBP, plINR, plUSD;

        if (market === 'UK') {
            plGBP = nativePL;
            plINR = nativePL * EXCHANGE_RATES.GBP_TO_INR;
            plUSD = nativePL * EXCHANGE_RATES.GBP_TO_USD;
        } else if (market === 'India') {
            plINR = nativePL;
            plGBP = nativePL * EXCHANGE_RATES.INR_TO_GBP;
            plUSD = nativePL * EXCHANGE_RATES.INR_TO_USD;
        } else { // US
            plUSD = nativePL;
            plGBP = nativePL * EXCHANGE_RATES.USD_TO_GBP;
            plINR = nativePL * EXCHANGE_RATES.USD_TO_INR;
        }

        return {
            plPercent,
            plGBP,
            plINR,
            plUSD
        };
    }

    /**
     * Add high conviction trade from scan result
     */
    async addTradeFromScan(opportunity) {
        try {
            const stock = opportunity.stock;
            const trade = opportunity.trade;
            const market = this.getMarketFromSymbol(stock.symbol);
            const investments = this.calculateInvestments(market);

            // Determine investment based on market
            let investmentAmount;
            if (market === 'UK') {
                investmentAmount = investments.gbp;
            } else if (market === 'India') {
                investmentAmount = investments.inr;
            } else {
                investmentAmount = investments.usd;
            }

            const shares = this.calculateShares(investmentAmount, trade.entryPrice);
            const targetPrice = trade.entryPrice * 1.08; // 8% target
            const stopLossPrice = trade.entryPrice * 0.95; // 5% stop loss

            // Calculate square off date (30 days from entry)
            const entryDate = new Date(trade.signalDate || trade.entryDate);
            const squareOffDate = new Date(entryDate);
            squareOffDate.setDate(entryDate.getDate() + 30);

            // Check if trade already exists
            const exists = await TradeDB.highConvictionTradeExists(
                stock.symbol,
                entryDate.toISOString().split('T')[0]
            );

            if (exists) {
                console.log(`[HIGH CONVICTION] Trade already exists: ${stock.symbol}`);
                return { success: false, reason: 'duplicate' };
            }

            const tradeData = {
                symbol: stock.symbol,
                name: stock.name,
                market: market,
                signalDate: entryDate.toISOString().split('T')[0],
                entryDate: entryDate.toISOString().split('T')[0],
                entryPrice: trade.entryPrice,
                currentPrice: trade.currentPrice || trade.entryPrice,
                targetPrice: targetPrice,
                stopLossPrice: stopLossPrice,
                squareOffDate: squareOffDate.toISOString().split('T')[0],
                investmentGBP: investments.gbp,
                investmentINR: investments.inr,
                investmentUSD: investments.usd,
                shares: shares,
                currencySymbol: this.getCurrencySymbol(market),
                winRate: trade.winRate,
                totalBacktestTrades: trade.totalTrades,
                entryDTI: trade.entryDTI
            };

            const result = await TradeDB.addHighConvictionTrade(tradeData);
            console.log(`[HIGH CONVICTION] Added trade: ${stock.symbol} (${market})`);

            return { success: true, trade: result };
        } catch (error) {
            console.error(`[HIGH CONVICTION] Error adding trade:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Fetch current price for a symbol
     */
    async fetchCurrentPrice(symbol) {
        try {
            const endDate = Math.floor(Date.now() / 1000);
            const startDate = endDate - (7 * 24 * 60 * 60); // Last 7 days

            const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
            const proxyUrl = `${baseUrl}/yahoo/history?symbol=${symbol}&period1=${startDate}&period2=${endDate}&interval=1d`;

            const response = await axios.get(proxyUrl, {
                timeout: 10000,
                headers: { 'Accept': 'text/csv' }
            });

            if (response.status !== 200) return null;

            const csvText = response.data;
            const rows = csvText.trim().split('\n');

            if (rows.length < 2) return null;

            // Get the last row (most recent price)
            const lastRow = rows[rows.length - 1];
            const values = lastRow.split(',');

            if (values.length >= 5) {
                return parseFloat(values[4]); // Close price
            }

            return null;
        } catch (error) {
            console.error(`[HIGH CONVICTION] Error fetching price for ${symbol}:`, error.message);
            return null;
        }
    }

    /**
     * Update all active trades with current prices and P&L
     */
    async updateAllActiveTrades() {
        try {
            const activeTrades = await TradeDB.getActiveHighConvictionTrades();
            console.log(`[HIGH CONVICTION] Updating ${activeTrades.length} active trades...`);

            const updates = [];
            const closures = [];

            for (const trade of activeTrades) {
                const currentPrice = await this.fetchCurrentPrice(trade.symbol);

                if (!currentPrice) {
                    console.log(`[HIGH CONVICTION] Could not fetch price for ${trade.symbol}`);
                    continue;
                }

                const market = trade.market;
                const shares = parseFloat(trade.shares);
                const entryPrice = parseFloat(trade.entry_price);
                const targetPrice = parseFloat(trade.target_price);
                const stopLossPrice = parseFloat(trade.stop_loss_price);
                const squareOffDate = new Date(trade.square_off_date);
                const today = new Date();

                // Calculate P&L
                const pl = this.calculatePL(entryPrice, currentPrice, shares, market);

                // Check exit conditions
                let exitReason = null;

                if (pl.plPercent >= 8) {
                    exitReason = 'Take Profit (8%)';
                } else if (pl.plPercent <= -5) {
                    exitReason = 'Stop Loss (5%)';
                } else if (today >= squareOffDate) {
                    exitReason = 'Max Days (30 days)';
                }

                if (exitReason) {
                    // Close the trade
                    closures.push({
                        symbol: trade.symbol,
                        name: trade.name,
                        market: market,
                        currencySymbol: trade.currency_symbol,
                        entryPrice: entryPrice,
                        entryDate: trade.entry_date,
                        exitData: {
                            exitDate: today.toISOString().split('T')[0],
                            exitPrice: currentPrice,
                            exitReason: exitReason,
                            plPercent: pl.plPercent,
                            plAmountGBP: pl.plGBP,
                            plAmountINR: pl.plINR,
                            plAmountUSD: pl.plUSD
                        }
                    });
                    console.log(`[HIGH CONVICTION] Closing ${trade.symbol}: ${exitReason} (${pl.plPercent.toFixed(2)}%)`);
                } else {
                    // Update the trade
                    updates.push({
                        symbol: trade.symbol,
                        updateData: {
                            currentPrice: currentPrice,
                            plPercent: pl.plPercent,
                            plAmountGBP: pl.plGBP,
                            plAmountINR: pl.plINR,
                            plAmountUSD: pl.plUSD
                        }
                    });
                }

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Execute updates
            for (const update of updates) {
                await TradeDB.updateHighConvictionTrade(update.symbol, update.updateData);
            }

            // Execute closures and send alerts
            for (const closure of closures) {
                await TradeDB.closeHighConvictionTrade(closure.symbol, closure.exitData);

                // Send exit alert to all subscribers
                await this.sendExitAlert(closure);
            }

            console.log(`[HIGH CONVICTION] Updated ${updates.length} trades, closed ${closures.length} trades`);

            return {
                updated: updates.length,
                closed: closures.length,
                closures: closures
            };
        } catch (error) {
            console.error(`[HIGH CONVICTION] Error updating trades:`, error);
            return { error: error.message };
        }
    }

    /**
     * Send exit alert to all Telegram subscribers
     */
    async sendExitAlert(closure) {
        try {
            const { symbol, name, market, currencySymbol, entryPrice, entryDate, exitData } = closure;

            // Determine alert type and emoji based on exit reason
            let alertEmoji = '📊';
            let alertType = 'TRADE EXIT';
            let reasonEmoji = '⏰';

            if (exitData.exitReason.includes('Take Profit')) {
                alertEmoji = '🎯';
                alertType = 'PROFIT TARGET REACHED';
                reasonEmoji = '✅';
            } else if (exitData.exitReason.includes('Stop Loss')) {
                alertEmoji = '🛑';
                alertType = 'STOP LOSS HIT';
                reasonEmoji = '⚠️';
            } else if (exitData.exitReason.includes('Max Days')) {
                alertEmoji = '⏰';
                alertType = 'TIME SQUARE OFF';
                reasonEmoji = '📅';
            }

            // Calculate holding period
            const entry = new Date(entryDate);
            const exit = new Date(exitData.exitDate);
            const holdingDays = Math.floor((exit - entry) / (24 * 60 * 60 * 1000));

            // Format the alert message
            const message =
                `${alertEmoji} *HIGH CONVICTION ${alertType}*\n\n` +
                `🏢 *Stock:* ${name}\n` +
                `📊 *Symbol:* ${symbol}\n` +
                `🌍 *Market:* ${market}\n\n` +
                `*📈 TRADE DETAILS*\n` +
                `Entry Price: ${currencySymbol}${parseFloat(entryPrice).toFixed(2)}\n` +
                `Exit Price: ${currencySymbol}${parseFloat(exitData.exitPrice).toFixed(2)}\n` +
                `Entry Date: ${new Date(entryDate).toLocaleDateString('en-GB')}\n` +
                `Exit Date: ${new Date(exitData.exitDate).toLocaleDateString('en-GB')}\n` +
                `Holding Period: ${holdingDays} days\n\n` +
                `*💹 PROFIT/LOSS*\n` +
                `P&L %: ${exitData.plPercent >= 0 ? '+' : ''}${exitData.plPercent.toFixed(2)}%\n` +
                `£ GBP: ${this.formatNumber(exitData.plAmountGBP)}\n` +
                `₹ INR: ${this.formatNumber(exitData.plAmountINR)}\n` +
                `$ USD: ${this.formatNumber(exitData.plAmountUSD)}\n\n` +
                `${reasonEmoji} *Exit Reason:* ${exitData.exitReason}\n\n` +
                `🕐 *Time:* ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })} UK`;

            // Broadcast to all subscribers
            console.log(`[HIGH CONVICTION] Broadcasting exit alert for ${symbol}...`);
            const results = await broadcastToSubscribers({
                type: 'custom',
                message: message
            });

            console.log(`[HIGH CONVICTION] Exit alert sent to ${results.length} subscribers`);

            return { success: true, subscribers: results.length };
        } catch (error) {
            console.error(`[HIGH CONVICTION] Error sending exit alert:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate weekly report
     */
    async generateWeeklyReport() {
        try {
            // Get date range for the past week
            const today = new Date();
            const oneWeekAgo = new Date(today);
            oneWeekAgo.setDate(today.getDate() - 7);

            // Get P&L summary
            const summary = await TradeDB.getHighConvictionPLSummary();

            // Get all trades for the week
            const weekTrades = await TradeDB.getAllHighConvictionTrades(
                oneWeekAgo.toISOString().split('T')[0],
                today.toISOString().split('T')[0]
            );

            // Get active trades
            const activeTrades = await TradeDB.getActiveHighConvictionTrades();

            // Get closed trades from this week
            const closedThisWeek = weekTrades.filter(t =>
                t.status === 'closed' &&
                new Date(t.exit_date) >= oneWeekAgo
            );

            // Format report message
            const message = this.formatWeeklyReportMessage({
                summary,
                activeTrades,
                closedThisWeek,
                weekStart: oneWeekAgo,
                weekEnd: today
            });

            return message;
        } catch (error) {
            console.error(`[HIGH CONVICTION] Error generating weekly report:`, error);
            return null;
        }
    }

    /**
     * Format weekly report message for Telegram
     */
    formatWeeklyReportMessage(data) {
        const { summary, activeTrades, closedThisWeek, weekStart, weekEnd } = data;

        let message = `📊 *HIGH CONVICTION WEEKLY REPORT*\n\n`;
        message += `Week: ${weekStart.toLocaleDateString('en-GB')} - ${weekEnd.toLocaleDateString('en-GB')}\n\n`;

        // Overall Summary
        message += `*📈 PORTFOLIO SUMMARY*\n`;
        message += `Active Trades: ${summary.active_trades || 0}\n`;
        message += `Closed Trades (Total): ${summary.closed_trades || 0}\n`;
        message += `Winning Trades: ${summary.winning_trades || 0}\n`;
        message += `Losing Trades: ${summary.losing_trades || 0}\n`;

        if (summary.closed_trades > 0) {
            const winRate = (summary.winning_trades / summary.closed_trades * 100).toFixed(1);
            message += `Win Rate: ${winRate}%\n`;
        }
        message += `\n`;

        // Open P&L
        message += `*💹 OPEN P&L (Active Trades)*\n`;
        message += `£ GBP: ${this.formatNumber(summary.open_pl_gbp || 0)}\n`;
        message += `₹ INR: ${this.formatNumber(summary.open_pl_inr || 0)}\n`;
        message += `$ USD: ${this.formatNumber(summary.open_pl_usd || 0)}\n\n`;

        // Closed P&L
        message += `*✅ CLOSED P&L (All Time)*\n`;
        message += `£ GBP: ${this.formatNumber(summary.total_pl_gbp || 0)}\n`;
        message += `₹ INR: ${this.formatNumber(summary.total_pl_inr || 0)}\n`;
        message += `$ USD: ${this.formatNumber(summary.total_pl_usd || 0)}\n\n`;

        // Trades closed this week
        if (closedThisWeek.length > 0) {
            message += `*🔔 TRADES CLOSED THIS WEEK*\n`;
            closedThisWeek.forEach((trade, index) => {
                const plSymbol = trade.pl_percent > 0 ? '🟢' : '🔴';
                message += `${index + 1}. ${plSymbol} ${trade.name} (${trade.symbol})\n`;
                message += `   Exit: ${trade.currency_symbol}${parseFloat(trade.exit_price).toFixed(2)}\n`;
                message += `   P&L: ${trade.pl_percent > 0 ? '+' : ''}${parseFloat(trade.pl_percent).toFixed(2)}%\n`;
                message += `   Reason: ${trade.exit_reason}\n`;
            });
            message += `\n`;
        }

        // Active trades
        if (activeTrades.length > 0) {
            message += `*📍 ACTIVE POSITIONS*\n`;
            activeTrades.slice(0, 5).forEach((trade, index) => {
                const plPercent = trade.pl_percent || 0;
                const plSymbol = plPercent >= 0 ? '🟢' : '🔴';
                message += `${index + 1}. ${plSymbol} ${trade.name} (${trade.symbol})\n`;
                message += `   Entry: ${trade.currency_symbol}${parseFloat(trade.entry_price).toFixed(2)}\n`;
                message += `   Current: ${trade.currency_symbol}${parseFloat(trade.current_price).toFixed(2)}\n`;
                message += `   P&L: ${plPercent >= 0 ? '+' : ''}${plPercent.toFixed(2)}%\n`;
            });

            if (activeTrades.length > 5) {
                message += `...and ${activeTrades.length - 5} more\n`;
            }
            message += `\n`;
        }

        message += `*📅 Next Report*\n`;
        const nextSaturday = new Date(weekEnd);
        nextSaturday.setDate(nextSaturday.getDate() + (6 - nextSaturday.getDay() + 7) % 7);
        message += `${nextSaturday.toLocaleDateString('en-GB')} at 10:00 AM UK\n\n`;

        message += `🎯 Trading with discipline and data-driven decisions!`;

        return message;
    }

    /**
     * Format number with proper sign and 2 decimals
     */
    formatNumber(num) {
        const value = parseFloat(num) || 0;
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(2)}`;
    }

    /**
     * Send weekly report to all subscribers
     */
    async sendWeeklyReport() {
        try {
            console.log(`[HIGH CONVICTION] Generating weekly report...`);

            // Update all trades before generating report
            await this.updateAllActiveTrades();

            // Generate report
            const message = await this.generateWeeklyReport();

            if (!message) {
                console.error(`[HIGH CONVICTION] Failed to generate report`);
                return { success: false, error: 'Failed to generate report' };
            }

            // Broadcast to all subscribers
            console.log(`[HIGH CONVICTION] Broadcasting weekly report...`);
            const results = await broadcastToSubscribers({
                type: 'custom',
                message: message
            });

            console.log(`[HIGH CONVICTION] Weekly report sent to ${results.length} subscribers`);

            return { success: true, subscribers: results.length };
        } catch (error) {
            console.error(`[HIGH CONVICTION] Error sending weekly report:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get portfolio status
     */
    async getPortfolioStatus() {
        try {
            const activeTrades = await TradeDB.getActiveHighConvictionTrades();
            const summary = await TradeDB.getHighConvictionPLSummary();

            return {
                activeTrades: activeTrades.length,
                totalTrades: (summary.active_trades || 0) + (summary.closed_trades || 0),
                openPL: {
                    gbp: summary.open_pl_gbp || 0,
                    inr: summary.open_pl_inr || 0,
                    usd: summary.open_pl_usd || 0
                },
                closedPL: {
                    gbp: summary.total_pl_gbp || 0,
                    inr: summary.total_pl_inr || 0,
                    usd: summary.total_pl_usd || 0
                },
                winRate: summary.closed_trades > 0
                    ? (summary.winning_trades / summary.closed_trades * 100).toFixed(1)
                    : 0
            };
        } catch (error) {
            console.error(`[HIGH CONVICTION] Error getting portfolio status:`, error);
            return null;
        }
    }
}

module.exports = HighConvictionPortfolioManager;