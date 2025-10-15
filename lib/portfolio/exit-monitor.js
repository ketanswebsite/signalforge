/**
 * Exit Monitoring System
 * Checks active trades for exit conditions and sends Telegram alerts
 */

const cron = require('node-cron');
const TradeDB = require('../../database-postgres');
const CapitalManager = require('./capital-manager');
const axios = require('axios');

class ExitMonitor {
    constructor() {
        this.isMonitoring = false;
        this.monitoringJobs = [];

        this.CONFIG = {
            TARGET_PERCENT: 8,
            STOP_LOSS_PERCENT: 5,
            MAX_HOLDING_DAYS: 30,
            CHECK_INTERVAL_MINUTES: 5
        };
    }

    /**
     * Initialize exit monitoring
     */
    initialize() {
        console.log('\n🔍 [EXIT MONITOR] Initializing...');

        // Schedule checks every 5 minutes during market hours
        // UK: 8 AM - 4:30 PM (Mon-Fri)
        // India: 9:15 AM - 3:30 PM (Mon-Fri)
        // US: 2:30 PM - 9 PM UK time (Mon-Fri)

        const checkJob = cron.schedule('*/5 * * * *', async () => {
            const ukTime = new Date().toLocaleString("en-GB", {timeZone: "Europe/London"});
            const ukHour = new Date(ukTime).getHours();
            const ukDay = new Date(ukTime).getDay();

            // Only run during market hours (weekdays, 8 AM - 9 PM UK time)
            if (ukDay >= 1 && ukDay <= 5 && ukHour >= 8 && ukHour < 21) {
                console.log('🔍 [EXIT MONITOR] Checking exits at', ukTime);
                await this.checkAllExits();
            }
        }, {
            timezone: "Europe/London",
            scheduled: true
        });

        this.monitoringJobs.push(checkJob);

        console.log('✅ [EXIT MONITOR] Initialized');
        console.log('📅 [EXIT MONITOR] Checking every 5 minutes during market hours (8 AM - 9 PM UK time)\n');
    }

    /**
     * Check all active trades for exit conditions
     */
    async checkAllExits() {
        if (this.isMonitoring) {
            console.log('⚠️ [EXIT MONITOR] Already checking, skipping...');
            return;
        }

        this.isMonitoring = true;

        try {
            // Get all active trades
            const activeTrades = await TradeDB.getActiveTrades();
            console.log(`🔍 [EXIT MONITOR] Checking ${activeTrades.length} active trades`);

            if (activeTrades.length === 0) {
                return { checked: 0, exitsTriggered: 0, exits: [] };
            }

            const exitsTriggered = [];

            // Check each trade
            for (const trade of activeTrades) {
                const exitResult = await this.checkTradeExit(trade);

                if (exitResult.shouldExit) {
                    exitsTriggered.push(exitResult);
                }
            }

            console.log(`✅ [EXIT MONITOR] Checked ${activeTrades.length} trades, ${exitsTriggered.length} exits triggered`);

            return {
                checked: activeTrades.length,
                exitsTriggered: exitsTriggered.length,
                exits: exitsTriggered
            };

        } catch (error) {
            console.error('❌ [EXIT MONITOR] Error:', error);
            return { error: error.message };
        } finally {
            this.isMonitoring = false;
        }
    }

    /**
     * Check individual trade for exit conditions
     */
    async checkTradeExit(trade) {
        try {
            // Fetch current price
            const currentPrice = await this.fetchCurrentPrice(trade.symbol);
            if (!currentPrice) {
                console.log(`⚠️ [EXIT MONITOR] Could not fetch price for ${trade.symbol}`);
                return { shouldExit: false };
            }

            // Calculate P/L
            const plPercent = ((currentPrice - trade.entry_price) / trade.entry_price) * 100;

            // Calculate holding days
            const entryDate = new Date(trade.entry_date);
            const today = new Date();
            const holdingDays = Math.floor((today - entryDate) / (24 * 60 * 60 * 1000));

            // Check exit conditions
            let exitType = null;
            let exitReason = null;

            // 1. Target reached
            if (plPercent >= this.CONFIG.TARGET_PERCENT) {
                exitType = 'target_reached';
                exitReason = `Target reached: +${plPercent.toFixed(2)}%`;
            }
            // 2. Stop loss hit
            else if (plPercent <= -this.CONFIG.STOP_LOSS_PERCENT) {
                exitType = 'stop_loss';
                exitReason = `Stop loss hit: ${plPercent.toFixed(2)}%`;
            }
            // 3. Max holding days reached
            else if (holdingDays >= this.CONFIG.MAX_HOLDING_DAYS) {
                exitType = 'max_days';
                exitReason = `Max holding period reached: ${holdingDays} days`;
            }
            // 4. Square-off date reached
            else if (trade.square_off_date) {
                const squareOffDate = new Date(trade.square_off_date);
                if (today >= squareOffDate) {
                    exitType = 'square_off';
                    exitReason = `Square-off date reached`;
                }
            }

            // No exit condition met
            if (!exitType) {
                // Record check in database
                await this.recordExitCheck(trade.id, currentPrice, plPercent, holdingDays, false);
                return { shouldExit: false };
            }

            // Exit condition met - check if alert already sent
            const alertAlreadySent = await this.checkAlertSent(trade.id, exitType);
            if (alertAlreadySent) {
                console.log(`⚠️ [EXIT MONITOR] Alert already sent for ${trade.symbol} (${exitType})`);
                return { shouldExit: false };
            }

            // Close the trade
            await this.closeTrade(trade, currentPrice, plPercent, exitType, exitReason);

            // Send Telegram alert
            await this.sendExitAlert(trade, currentPrice, plPercent, exitType, exitReason);

            // Record exit check with alert sent
            await this.recordExitCheck(trade.id, currentPrice, plPercent, holdingDays, true, exitType);

            return {
                shouldExit: true,
                tradeId: trade.id,
                symbol: trade.symbol,
                exitType: exitType,
                entryPrice: trade.entry_price,
                exitPrice: currentPrice,
                plPercent: plPercent,
                exitReason: exitReason,
                alertSent: true
            };

        } catch (error) {
            console.error(`❌ [EXIT MONITOR] Error checking ${trade.symbol}:`, error);
            return { shouldExit: false, error: error.message };
        }
    }

    /**
     * Fetch current price for symbol
     */
    async fetchCurrentPrice(symbol) {
        try {
            const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
            const proxyUrl = `${baseUrl}/yahoo/quote?symbol=${symbol}`;

            const response = await axios.get(proxyUrl, { timeout: 5000 });

            if (response.data && response.data.regularMarketPrice) {
                return response.data.regularMarketPrice;
            }

            return null;
        } catch (error) {
            console.error(`Error fetching price for ${symbol}:`, error.message);
            return null;
        }
    }

    /**
     * Close trade in database
     */
    async closeTrade(trade, exitPrice, plPercent, exitType, exitReason) {
        try {
            // Update trade as closed
            await TradeDB.closeTrade(trade.id, {
                exitDate: new Date().toISOString().split('T')[0],
                exitPrice: exitPrice,
                profitLossPercent: plPercent,
                exitReason: exitReason
            });

            // Release capital
            await CapitalManager.releaseFromTrade({
                ...trade,
                profitLossPercent: plPercent
            });

            console.log(`✅ [EXIT MONITOR] Closed trade ${trade.symbol} (${exitType})`);
        } catch (error) {
            console.error(`❌ [EXIT MONITOR] Error closing trade ${trade.symbol}:`, error);
            throw error;
        }
    }

    /**
     * Send Telegram alert for exit
     */
    async sendExitAlert(trade, exitPrice, plPercent, exitType, exitReason) {
        try {
            const telegramBot = require('../telegram/telegram-bot');

            if (!telegramBot || typeof telegramBot.broadcastToSubscribers !== 'function') {
                console.log('   ℹ Telegram not configured - skipping alert');
                return;
            }

            const currencySymbol = this.getCurrencySymbol(trade.market);
            const plSign = plPercent >= 0 ? '+' : '';
            const plAmount = Math.abs((trade.trade_size * plPercent / 100));
            const emoji = exitType === 'target_reached' ? '🎯' :
                         exitType === 'stop_loss' ? '🛑' :
                         exitType === 'square_off' ? '⏰' :
                         exitType === 'max_days' ? '📅' : '📤';

            const alertMessage = {
                type: 'custom',
                message:
                    `${emoji} *${exitType === 'target_reached' ? 'TARGET REACHED' :
                                 exitType === 'stop_loss' ? 'STOP LOSS HIT' :
                                 exitType === 'square_off' ? 'SQUARE-OFF TRIGGERED' :
                                 exitType === 'max_days' ? 'MAX DAYS EXIT' : 'EXIT TRIGGERED'}*\n\n` +
                    `📊 *Stock:* ${trade.symbol}\n` +
                    `📍 *Entry:* ${currencySymbol}${trade.entry_price.toFixed(2)}\n` +
                    `📤 *Exit:* ${currencySymbol}${exitPrice.toFixed(2)}\n` +
                    `💹 *P/L:* ${plSign}${plPercent.toFixed(2)}% (${plSign}${currencySymbol}${plAmount.toFixed(2)})\n` +
                    `📝 *Reason:* ${exitReason}\n` +
                    `🕐 *Time:* ${new Date().toLocaleString()}\n\n` +
                    `${exitType === 'target_reached' ? '🎉 Congratulations on the profitable trade!' :
                      exitType === 'stop_loss' ? '⚠️ Better luck next time!' :
                      '✅ Trade closed'}`
            };

            // Broadcast to all subscribers
            await telegramBot.broadcastToSubscribers(alertMessage, 'all');

            console.log(`✅ [EXIT MONITOR] Alert sent for ${trade.symbol}`);
        } catch (error) {
            console.error(`❌ [EXIT MONITOR] Error sending alert for ${trade.symbol}:`, error);
        }
    }

    /**
     * Record exit check in database
     */
    async recordExitCheck(tradeId, currentPrice, plPercent, daysHeld, alertSent, alertType = null) {
        try {
            const query = `
                INSERT INTO trade_exit_checks
                (trade_id, current_price, pl_percent, days_held,
                 target_reached, stop_loss_hit, max_days_reached,
                 alert_sent, alert_type)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `;

            await TradeDB.pool.query(query, [
                tradeId,
                currentPrice,
                plPercent,
                daysHeld,
                alertType === 'target_reached',
                alertType === 'stop_loss',
                alertType === 'max_days' || alertType === 'square_off',
                alertSent,
                alertType
            ]);
        } catch (error) {
            console.error('Error recording exit check:', error);
        }
    }

    /**
     * Check if alert already sent for this exit type
     */
    async checkAlertSent(tradeId, exitType) {
        try {
            const query = `
                SELECT * FROM trade_exit_checks
                WHERE trade_id = $1
                  AND alert_sent = true
                  AND alert_type = $2
                ORDER BY check_time DESC
                LIMIT 1
            `;

            const result = await TradeDB.pool.query(query, [tradeId, exitType]);
            return result.rows.length > 0;
        } catch (error) {
            console.error('Error checking alert sent:', error);
            return false;
        }
    }

    /**
     * Get currency symbol for market
     */
    getCurrencySymbol(market) {
        const symbols = {
            'India': '₹',
            'UK': '£',
            'US': '$'
        };
        return symbols[market] || '$';
    }

    /**
     * Stop all monitoring jobs
     */
    stop() {
        this.monitoringJobs.forEach(job => job.destroy());
        this.monitoringJobs = [];
        console.log('🛑 [EXIT MONITOR] Stopped');
    }
}

module.exports = new ExitMonitor();
