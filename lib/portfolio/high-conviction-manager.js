/**
 * High Conviction Portfolio Manager
 * Manages high conviction trades portfolio with multi-currency P&L tracking
 * Generates weekly reports for Telegram broadcast
 */

const YahooClient = require('../shared/yahoo-client');
const TradeDB = require('../../database-postgres');
const telegramBot = require('../telegram/telegram-bot');
const { broadcastToSubscribers } = telegramBot;
const CloseFailures = require('./close-failure-alerts');
const { formatDateDDMMYYYY } = require('../shared/date-format');

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

// Entry drift guard: if the live price at booking time has moved more than
// this from the scan price, the signal's setup is gone — skip the trade.
const MAX_ENTRY_DRIFT_PERCENT = parseFloat(process.env.MAX_ENTRY_DRIFT_PERCENT) || 3;

// A close the database refuses is reported to the owner (close-failure-alerts.js).
// high_conviction_portfolio.id is its own sequence — row 12 here and trade 12
// in `trades` are different positions — so these failures are tracked as 'hc'
const hcCloseFailures = CloseFailures.namespaced('hc');
// Those messages print trade.user_id as the portfolio; these rows have no user
const asOwnerAlertTrade = closure => ({ id: closure.tradeId, symbol: closure.symbol, user_id: 'High Conviction' });

class HighConvictionPortfolioManager {
    constructor() {
        this.portfolioCache = null;
        this.lastUpdateTime = null;
        this.isUpdating = false;
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

            // Defense in depth: the scanner only passes GO opportunities, but
            // this writer must never book an AI-rejected signal on its own.
            if (opportunity.conviction && opportunity.conviction.verdict !== 'GO') {
                console.log(`[HIGH CONVICTION] Refusing non-GO signal: ${stock.symbol} (${opportunity.conviction.verdict})`);
                return { success: false, reason: 'ai_rejected' };
            }

            // Determine investment based on market
            let investmentAmount;
            if (market === 'UK') {
                investmentAmount = investments.gbp;
            } else if (market === 'India') {
                investmentAmount = investments.inr;
            } else {
                investmentAmount = investments.usd;
            }

            // Entry price is the price actually available NOW, not the scan
            // price (which is usually the previous session's close). If the
            // live price is unavailable or has drifted beyond the guard, the
            // trade is skipped — never entered at a stale price.
            const signalPrice = parseFloat(trade.entryPrice);
            const livePrice = await this.fetchCurrentPrice(stock.symbol);

            if (!livePrice || livePrice <= 0) {
                console.log(`[HIGH CONVICTION] No live price for ${stock.symbol} — skipping (no stale-price entries)`);
                return { success: false, reason: 'no_live_price' };
            }

            const driftPercent = ((livePrice - signalPrice) / signalPrice) * 100;
            if (Math.abs(driftPercent) > MAX_ENTRY_DRIFT_PERCENT) {
                console.log(`[HIGH CONVICTION] ${stock.symbol} drifted ${driftPercent.toFixed(2)}% since signal (limit ±${MAX_ENTRY_DRIFT_PERCENT}%) — skipping`);
                return { success: false, reason: 'price_drift', driftPercent };
            }

            const entryPrice = livePrice;
            const shares = this.calculateShares(investmentAmount, entryPrice);
            const targetPrice = entryPrice * 1.08; // 8% target from actual entry
            const stopLossPrice = entryPrice * 0.95; // 5% stop from actual entry

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

            // A re-triggered signal on a later date must not book the same stock
            // twice while a position in it is still open (symbol+signal_date
            // dedupe above only catches the SAME day's signal)
            const activeExists = await TradeDB.activeHighConvictionTradeExists(stock.symbol);
            if (activeExists) {
                console.log(`[HIGH CONVICTION] Already holding an active position in ${stock.symbol} — skipping re-book`);
                return { success: false, reason: 'duplicate' };
            }

            const tradeData = {
                symbol: stock.symbol,
                name: stock.name,
                market: market,
                signalDate: entryDate.toISOString().split('T')[0],
                entryDate: entryDate.toISOString().split('T')[0],
                entryPrice: entryPrice,
                currentPrice: entryPrice,
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

            // Yahoo in process (lib/shared/yahoo-client.js): the very CSV GET /yahoo/history serves,
            // without an HTTP call back into this server
            const history = await YahooClient.fetchHistoryCsv(symbol, { period1: startDate, period2: endDate, interval: '1d' }, { timeout: 10000 });
            if (!history) return null;

            const csvText = history.csv;
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
        // Guard: this now runs intraday as well as at 4 PM; overlapping runs
        // would double-fetch prices and race on trade closures.
        if (this.isUpdating) {
            return { skipped: true, reason: 'update already in progress' };
        }
        this.isUpdating = true;
        try {
            const activeTrades = await TradeDB.getActiveHighConvictionTrades();
            console.log(`[HIGH CONVICTION] Updating ${activeTrades.length} active trades...`);

            const updates = [];
            const closures = [];

            for (const trade of activeTrades) {
                // A signal the AI rejected was never actually taken — it must
                // not be monitored for stop-loss / target hits, and no exit
                // alert should ever fire for it. Retire it quietly.
                const rejectedSignal = await this.getRejectedSignalFor(trade);
                if (rejectedSignal) {
                    await this.markTradeNotTaken(trade, rejectedSignal);
                    continue;
                }

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
                let exitType = null;

                if (pl.plPercent >= 8) {
                    exitReason = 'Take Profit (8%)';
                    exitType = 'take_profit';
                } else if (pl.plPercent <= -5) {
                    exitReason = 'Stop Loss (5%)';
                    exitType = 'stop_loss';
                } else if (today >= squareOffDate) {
                    exitReason = 'Max Days (30 days)';
                    exitType = 'max_days';
                }

                // Calculate holding period
                const entryDate = new Date(trade.entry_date);
                const holdingDays = Math.floor((today - entryDate) / (24 * 60 * 60 * 1000));

                if (exitReason) {
                    // Queue the close. There is deliberately no "alert already
                    // sent" lookup: a close is keyed by this portfolio row and
                    // only succeeds while the row is still active, and that one
                    // atomic UPDATE is the duplicate-alert guard (see below)
                    closures.push({
                        tradeId: trade.id,
                        symbol: trade.symbol,
                        name: trade.name,
                        market: market,
                        currencySymbol: trade.currency_symbol,
                        entryPrice: entryPrice,
                        entryDate: trade.entry_date,
                        exitType: exitType,
                        holdingDays: holdingDays,
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
                    // No exit condition met - just update the trade, by its row
                    updates.push({
                        tradeId: trade.id,
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

            // Execute updates, each by its portfolio row: a symbol can be booked
            // again, so it does not identify a position
            for (const update of updates) {
                await TradeDB.updateHighConvictionTrade(update.tradeId, update.updateData);
            }

            // Execute closures and send alerts. The close is the duplicate-alert
            // guard: it is keyed by the portfolio ROW (a symbol can be re-entered
            // later, so a symbol does not identify a position) and only matches
            // a row that is still active. Whoever closes the row sends its one
            // alert; finding nothing left to close means someone else already did
            const closed = [];
            for (const closure of closures) {
                let closeResult;
                try {
                    // Close the trade in database
                    closeResult = await TradeDB.closeHighConvictionTrade(closure.tradeId, closure.exitData);
                } catch (error) {
                    // The database refused the close: the row is still active,
                    // past its exit, and the next pass retries it. Tell the owner
                    // (throttled) — and send NO exit alert: nothing was closed
                    await this.handleCloseFailure(closure, error);
                    continue;
                }

                // Closed, here or elsewhere: a close that had been failing is over
                await this.handleCloseRecovered(closure, closeResult ? 'closed' : 'closed elsewhere');

                if (!closeResult) {
                    console.log(`[HIGH CONVICTION] ${closure.symbol} (id ${closure.tradeId}) was already closed elsewhere - no alert sent`);
                    continue;
                }

                console.log(`[HIGH CONVICTION] ✅ Trade closed in database: ${closure.symbol}`);
                closed.push(closure);

                // Send exit alert to all subscribers
                await this.sendExitAlert(closure);
            }

            console.log(`[HIGH CONVICTION] Updated ${updates.length} trades, closed ${closed.length} trades`);

            return {
                updated: updates.length,
                closed: closed.length,
                closures: closed
            };
        } catch (error) {
            console.error(`[HIGH CONVICTION] Error updating trades:`, error);
            return { error: error.message };
        } finally {
            this.isUpdating = false;
        }
    }

    /**
     * The database refused a close. Never throws — it runs inside the pass.
     *
     * The row stays active past its exit and the next pass retries the close.
     * The owner is told, privately and throttled (close-failure-alerts.js);
     * subscribers are told nothing, because nothing was closed. There is no
     * evidence row (high-conviction positions have no exit-check table), so
     * this log line and the owner's message are the record.
     */
    async handleCloseFailure(closure, closeError) {
        try {
            const failure = hcCloseFailures.recordFailure(closure.tradeId, {
                error: closeError,
                exitType: closure.exitType,
                plPercent: closure.exitData.plPercent
            });
            // closeHighConvictionTrade does not log what it threw — this line must
            console.error(`[HIGH CONVICTION] ❌ Close FAILED for ${closure.symbol} (id ${closure.tradeId}, ${closure.exitType}) — ` +
                `${failure.kind} error${failure.code ? ` ${failure.code}` : ''}, attempt ${failure.attempts}, position still open:`, closeError);

            if (!CloseFailures.getConfig().enabled || !CloseFailures.resolveShouldNotify(failure)) {
                return;
            }

            const message = CloseFailures.formatFailureMessage(asOwnerAlertTrade(closure), {
                exitReason: closure.exitData.exitReason,
                plPercent: closure.exitData.plPercent,
                currentPrice: closure.exitData.exitPrice,
                currencySymbol: closure.currencySymbol
            }, failure, closeError);
            if (await CloseFailures.notifyOwner(message, { TradeDB, telegramBot })) {
                hcCloseFailures.markNotified(closure.tradeId);
                console.log(`[HIGH CONVICTION] 📣 Owner told about the failed close of ${closure.symbol}`);
            }
        } catch (error) {
            console.error(`[HIGH CONVICTION] ❌ Could not report the failed close of ${closure.symbol}:`, error.message);
        }
    }

    /**
     * The row is closed (by this pass or elsewhere). If its close had been
     * failing AND the owner had been told, tell them it is over. Never throws.
     */
    async handleCloseRecovered(closure, outcome) {
        try {
            const episode = hcCloseFailures.resolveEpisode(closure.tradeId);
            if (episode && episode.notifications > 0 && CloseFailures.getConfig().enabled) {
                await CloseFailures.notifyOwner(
                    CloseFailures.formatRecoveryMessage(asOwnerAlertTrade(closure), episode, outcome), { TradeDB, telegramBot });
            }
        } catch (error) {
            console.error(`[HIGH CONVICTION] ❌ Could not report the recovered close of ${closure.symbol}:`, error.message);
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
                `Entry Date: ${formatDateDDMMYYYY(entryDate)}\n` +
                `Exit Date: ${formatDateDDMMYYYY(exitData.exitDate)}\n` +
                `Holding Period: ${holdingDays} days\n\n` +
                `*💹 PROFIT/LOSS*\n` +
                `P&L %: ${exitData.plPercent >= 0 ? '+' : ''}${exitData.plPercent.toFixed(2)}%\n` +
                `£ GBP: ${this.formatNumber(exitData.plAmountGBP)}\n` +
                `₹ INR: ${this.formatNumber(exitData.plAmountINR)}\n` +
                `$ USD: ${this.formatNumber(exitData.plAmountUSD)}\n\n` +
                `${reasonEmoji} *Exit Reason:* ${exitData.exitReason}\n\n` +
                `🕐 *Time:* ${require('../shared/date-format').formatDateTimeUK(new Date())} UK`;

            // Broadcast to all subscribers
            console.log(`[HIGH CONVICTION] Broadcasting exit alert for ${symbol}...`);
            const results = await broadcastToSubscribers({
                type: 'custom',
                message: message
            });

            // A failed send still counts as attempted, and a failed broadcast returns [] - count deliveries
            const delivered = results.filter(r => r && r.success).length;
            console.log(`[HIGH CONVICTION] Exit alert delivered to ${delivered} of ${results.length} subscribers`);
            if (delivered === 0) {
                await CloseFailures.notifyOwner(
                    `⚠️ *High-conviction exit alert reached nobody:* ${CloseFailures.markdownSafe(symbol)} (${results.length} sends attempted). The trade is closed; the subscribers were not told.`,
                    { TradeDB, telegramBot });
            }

            return { success: delivered > 0, subscribers: delivered, attempted: results.length };
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
        message += `Week: ${formatDateDDMMYYYY(weekStart)} - ${formatDateDDMMYYYY(weekEnd)}\n\n`;

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
        message += `${formatDateDDMMYYYY(nextSaturday)} at 10:00 AM UK\n\n`;

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

            const delivered = results.filter(r => r && r.success).length;
            console.log(`[HIGH CONVICTION] Weekly report delivered to ${delivered} of ${results.length} subscribers`);
            if (delivered === 0) {
                await CloseFailures.notifyOwner(
                    `⚠️ *The weekly high-conviction report reached nobody* (${results.length} sends attempted).`,
                    { TradeDB, telegramBot });
            }

            return { success: delivered > 0, subscribers: delivered, attempted: results.length };
        } catch (error) {
            console.error(`[HIGH CONVICTION] Error sending weekly report:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Look up the originating signal for a portfolio trade and return it if
     * the AI conviction gate rejected it (non-GO verdict). Pre-gate signals
     * (no verdict stored) return null — we cannot infer a verdict for them.
     */
    async getRejectedSignalFor(trade) {
        try {
            const result = await TradeDB.pool.query(`
                SELECT conviction_verdict, conviction_score
                FROM pending_signals
                WHERE symbol = $1 AND signal_date = $2
                LIMIT 1
            `, [trade.symbol, trade.signal_date]);

            const row = result.rows[0];
            if (row && row.conviction_verdict && row.conviction_verdict !== 'GO') {
                return row;
            }
            return null;
        } catch (error) {
            console.error(`[HIGH CONVICTION] Error checking signal verdict for ${trade.symbol}:`, error);
            return null;
        }
    }

    /**
     * Retire a trade whose signal the AI rejected: it was never taken, so it
     * leaves active tracking without touching closed-trade P&L statistics
     * and without sending any exit alert.
     */
    async markTradeNotTaken(trade, rejectedSignal) {
        try {
            const verdict = rejectedSignal.conviction_verdict;
            const score = rejectedSignal.conviction_score != null ? `${rejectedSignal.conviction_score}/10` : 'n/a';
            await TradeDB.pool.query(`
                UPDATE high_conviction_portfolio
                SET status = 'not_taken',
                    exit_reason = $2,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [trade.id, `AI conviction ${verdict} (${score}) — trade never taken`]);
            console.log(`[HIGH CONVICTION] Retired ${trade.symbol}: AI verdict ${verdict} — not taken, tracking stopped`);
        } catch (error) {
            console.error(`[HIGH CONVICTION] Error retiring untaken trade ${trade.symbol}:`, error);
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