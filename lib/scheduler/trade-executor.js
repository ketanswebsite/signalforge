/**
 * Automated Trade Executor
 * Executes pending signals at 1 PM in each market timezone
 */

const TradeDB = require('../../database-postgres');
const CapitalManager = require('../portfolio/capital-manager');
const cron = require('node-cron');

class TradeExecutor {
    constructor() {
        this.isInitialized = false;
        this.executionLogs = [];
    }

    /**
     * Initialize cron jobs for each market
     */
    initialize() {
        if (this.isInitialized) {
            console.log('⚠️  Trade Executor already initialized');
            return;
        }

        console.log('\n🚀 Initializing Trade Executor...');

        // India Market: 1 PM IST = 7:30 AM UTC
        // Runs Monday-Friday at 1:00 PM IST
        cron.schedule('30 7 * * 1-5', async () => {
            console.log('🇮🇳 [INDIA] Starting 1 PM trade execution...');
            await this.executeMarketSignals('India');
        }, {
            timezone: "Asia/Kolkata"
        });
        console.log('   ✓ India cron job scheduled: 1:00 PM IST (Mon-Fri)');

        // UK Market: 1 PM GMT/BST
        // Runs Monday-Friday at 1:00 PM UK time
        cron.schedule('0 13 * * 1-5', async () => {
            console.log('🇬🇧 [UK] Starting 1 PM trade execution...');
            await this.executeMarketSignals('UK');
        }, {
            timezone: "Europe/London"
        });
        console.log('   ✓ UK cron job scheduled: 1:00 PM GMT/BST (Mon-Fri)');

        // US Market: 1 PM EST/EDT
        // Runs Monday-Friday at 1:00 PM US Eastern time
        cron.schedule('0 13 * * 1-5', async () => {
            console.log('🇺🇸 [US] Starting 1 PM trade execution...');
            await this.executeMarketSignals('US');
        }, {
            timezone: "America/New_York"
        });
        console.log('   ✓ US cron job scheduled: 1:00 PM EST/EDT (Mon-Fri)');

        this.isInitialized = true;
        console.log('\n✅ Trade Executor initialized successfully');
        console.log('   Automated execution active for all 3 markets\n');
    }

    /**
     * Execute all pending signals for a specific market
     */
    async executeMarketSignals(market) {
        const startTime = new Date();
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📊 [${market}] EXECUTION STARTED`);
        console.log(`   Time: ${startTime.toISOString()}`);
        console.log(`${'='.repeat(60)}\n`);

        try {
            // Get today's date
            const today = new Date().toISOString().split('T')[0];

            // Get pending signals for this market from today only
            const signals = await TradeDB.getPendingSignals('pending', market);
            const todaySignals = signals.filter(s => {
                const signalDateStr = new Date(s.signal_date).toISOString().split('T')[0];
                return signalDateStr === today;
            });

            console.log(`   📈 Found ${signals.length} pending signals total`);
            console.log(`   🎯 ${todaySignals.length} signals from today to execute\n`);

            if (todaySignals.length === 0) {
                console.log(`   ✓ No signals to execute for ${market} today`);
                console.log(`${'='.repeat(60)}\n`);
                return {
                    success: true,
                    market,
                    executed: 0,
                    failed: 0,
                    skipped: 0
                };
            }

            const results = {
                executed: [],
                failed: [],
                skipped: []
            };

            // Execute each signal
            for (let i = 0; i < todaySignals.length; i++) {
                const signal = todaySignals[i];
                console.log(`   [${i + 1}/${todaySignals.length}] Processing ${signal.symbol}...`);

                try {
                    const result = await this.executeSingleSignal(signal, market);

                    if (result.success) {
                        results.executed.push(result);
                        console.log(`      ✓ Trade created (ID: ${result.tradeId}, Size: ${result.tradeSize})`);
                    } else {
                        if (result.reason.includes('limit') || result.reason.includes('capital')) {
                            results.skipped.push({ signal: signal.symbol, reason: result.reason });
                            console.log(`      ⊗ Skipped - ${result.reason}`);
                        } else {
                            results.failed.push({ signal: signal.symbol, error: result.reason });
                            console.log(`      ✗ Failed - ${result.reason}`);
                        }
                    }
                } catch (error) {
                    results.failed.push({ signal: signal.symbol, error: error.message });
                    console.log(`      ✗ Error - ${error.message}`);
                }
            }

            const summary = {
                success: true,
                market,
                total: todaySignals.length,
                executed: results.executed.length,
                failed: results.failed.length,
                skipped: results.skipped.length,
                duration: Date.now() - startTime.getTime()
            };

            console.log(`\n${'='.repeat(60)}`);
            console.log(`📈 [${market}] EXECUTION SUMMARY`);
            console.log(`${'='.repeat(60)}`);
            console.log(`   Total Signals:    ${summary.total}`);
            console.log(`   ✓ Executed:       ${summary.executed}`);
            console.log(`   ⊗ Skipped:        ${summary.skipped}`);
            console.log(`   ✗ Failed:         ${summary.failed}`);
            console.log(`   ⏱  Duration:       ${summary.duration}ms`);
            console.log(`${'='.repeat(60)}\n`);

            // Send Telegram notification
            if (summary.executed > 0 || summary.failed > 0) {
                await this.sendExecutionNotification(market, summary, results);
            }

            // Log execution
            this.executionLogs.push({
                timestamp: new Date(),
                market,
                summary
            });

            return summary;

        } catch (error) {
            console.error(`❌ [${market}] Execution error:`, error);
            console.log(`${'='.repeat(60)}\n`);
            return {
                success: false,
                market,
                error: error.message
            };
        }
    }

    /**
     * Execute a single signal
     */
    async executeSingleSignal(signal, market) {
        try {
            const userId = 'default'; // Single user system

            // Step 1: Validate capital and position limits
            const validation = await CapitalManager.validateTradeEntry(market, signal.symbol);

            if (!validation.valid) {
                // Mark signal as dismissed
                await TradeDB.updateSignalStatus(signal.id, 'dismissed');
                return {
                    success: false,
                    reason: validation.reason,
                    code: validation.code
                };
            }

            // Step 2: Allocate capital
            await TradeDB.allocateCapital(market, validation.tradeSize);

            // Step 3: Create trade
            const trade = {
                symbol: signal.symbol,
                entryDate: new Date(),
                entryPrice: signal.entry_price,
                targetPrice: signal.target_price,
                stopLossPercent: 5,
                status: 'active',
                notes: `Auto-executed at 1 PM ${market} time - Win Rate: ${signal.win_rate}%`,
                market: signal.market,
                tradeSize: validation.tradeSize,
                signalDate: signal.signal_date,
                winRate: signal.win_rate,
                historicalSignalCount: signal.historical_signal_count,
                autoAdded: true,
                entryDTI: signal.entry_dti,
                entry7DayDTI: signal.entry_7day_dti,
                prevDTI: signal.prev_dti,
                prev7DayDTI: signal.prev_7day_dti
            };

            const newTrade = await TradeDB.insertTrade(trade, userId);

            // Step 4: Update signal status
            await TradeDB.updateSignalStatus(signal.id, 'added', newTrade.id);

            return {
                success: true,
                tradeId: newTrade.id,
                symbol: signal.symbol,
                tradeSize: validation.tradeSize
            };

        } catch (error) {
            console.error(`      Error executing signal ${signal.symbol}:`, error);
            return {
                success: false,
                reason: error.message
            };
        }
    }

    /**
     * Send Telegram notification about execution
     */
    async sendExecutionNotification(market, summary, results) {
        try {
            const telegramBot = require('../telegram/telegram-bot');

            if (!telegramBot || typeof telegramBot.broadcastToSubscribers !== 'function') {
                console.log('   ℹ Telegram not configured - skipping notification');
                return;
            }

            const flag = market === 'India' ? '🇮🇳' : market === 'UK' ? '🇬🇧' : '🇺🇸';

            let message = `${flag} *${market} Market - 1 PM Execution Complete*\n\n`;
            message += `📊 Total Signals: ${summary.total}\n`;
            message += `✓ Executed: ${summary.executed} trades\n`;

            if (summary.executed > 0) {
                message += `\n*Trades Added:*\n`;
                results.executed.forEach(r => {
                    message += `✓ ${r.symbol} (${r.tradeSize.toFixed(0)})\n`;
                });
            }

            if (summary.skipped > 0) {
                message += `\n⊗ Skipped: ${summary.skipped} (limits/capital)\n`;
            }

            if (summary.failed > 0) {
                message += `\n✗ Failed: ${summary.failed}\n`;
                results.failed.slice(0, 3).forEach(f => {
                    message += `  • ${f.signal}: ${f.error.substring(0, 50)}\n`;
                });
            }

            message += `\n⏱ Duration: ${(summary.duration / 1000).toFixed(1)}s`;

            await telegramBot.broadcastToSubscribers({
                type: 'custom',
                message
            }, 'execution');

            console.log('   ✓ Telegram notification sent');

        } catch (error) {
            console.error('   ✗ Error sending Telegram notification:', error.message);
        }
    }

    /**
     * Manual execution trigger (for testing)
     */
    async manualExecute(market) {
        console.log(`🔧 Manual execution triggered for ${market}`);
        return await this.executeMarketSignals(market);
    }

    /**
     * Get execution history
     */
    getExecutionLogs(limit = 10) {
        return this.executionLogs.slice(-limit);
    }
}

module.exports = new TradeExecutor();
