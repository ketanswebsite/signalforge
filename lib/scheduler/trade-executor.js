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

        // Daily cleanup job: Remove old pending signals (runs at midnight UTC)
        cron.schedule('0 0 * * *', async () => {
            console.log('🧹 [CLEANUP] Starting daily cleanup of old pending signals...');
            await this.cleanupOldPendingSignals();
        }, {
            timezone: "UTC"
        });
        console.log('   ✓ Daily cleanup job scheduled: Midnight UTC');

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
            console.log(`   📅 Today's date: ${today}`);
            console.log(`   ⏰ Server time: ${new Date().toISOString()}`);
            console.log(`   🌍 Market: ${market}\n`);

            // Get pending signals for this market from today only
            const signals = await TradeDB.getPendingSignals('pending', market);
            console.log(`   📈 Found ${signals.length} pending signals total (status='pending', market='${market}')`);

            // Enhanced logging for date filtering
            if (signals.length > 0) {
                console.log(`\n   📊 SIGNAL DATE ANALYSIS (Critical for execution)`);
                console.log(`   ${'─'.repeat(50)}`);

                const signalDates = [...new Set(signals.map(s => new Date(s.signal_date).toISOString().split('T')[0]))];
                signalDates.sort().reverse(); // Most recent first

                signalDates.forEach(date => {
                    const dateSignals = signals.filter(s => new Date(s.signal_date).toISOString().split('T')[0] === date);
                    const count = dateSignals.length;
                    const isToday = date === today;
                    const daysDiff = Math.floor((new Date(today) - new Date(date)) / (1000 * 60 * 60 * 24));

                    const icon = isToday ? '✓' : '○';
                    const status = isToday ? 'WILL EXECUTE' : `SKIPPED (${daysDiff} days old)`;
                    const highlight = isToday ? '→' : ' ';

                    console.log(`   ${highlight} ${icon} ${date}: ${count} signals - ${status}`);

                    if (isToday && count > 0) {
                        console.log(`      Symbols: ${dateSignals.map(s => s.symbol).join(', ')}`);
                    }
                });

                console.log(`   ${'─'.repeat(50)}\n`);
            }

            const todaySignals = signals.filter(s => {
                const signalDateStr = new Date(s.signal_date).toISOString().split('T')[0];
                return signalDateStr === today;
            });

            console.log(`\n   🎯 ${todaySignals.length} signals from today to execute\n`);

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

            // Execute each signal with detailed logging
            console.log(`\n   🔄 EXECUTING ${todaySignals.length} SIGNALS\n`);

            for (let i = 0; i < todaySignals.length; i++) {
                const signal = todaySignals[i];
                console.log(`   ┌─ [${i + 1}/${todaySignals.length}] ${signal.symbol} (${market})`);
                console.log(`   │  Entry Price: ${parseFloat(signal.entry_price || 0).toFixed(2)}`);
                console.log(`   │  Target: ${parseFloat(signal.target_price || 0).toFixed(2)}`);
                console.log(`   │  Win Rate: ${parseFloat(signal.win_rate || 0).toFixed(1)}%`);
                console.log(`   │  Signal Date: ${new Date(signal.signal_date).toISOString().split('T')[0]}`);

                try {
                    const result = await this.executeSingleSignal(signal, market);

                    if (result.success) {
                        results.executed.push(result);
                        console.log(`   │  ✅ SUCCESS`);
                        console.log(`   │  Trade ID: ${result.tradeId}`);
                        console.log(`   │  Trade Size: ${result.tradeSize?.toFixed(0)}`);
                        console.log(`   └─ Status: Added to portfolio`);
                    } else {
                        if (result.reason.includes('limit') || result.reason.includes('capital')) {
                            results.skipped.push({ signal: signal.symbol, reason: result.reason, code: result.code });
                            console.log(`   │  ⊗ SKIPPED`);
                            console.log(`   │  Code: ${result.code || 'N/A'}`);
                            console.log(`   │  Reason: ${result.reason}`);
                            console.log(`   └─ Status: Dismissed (limits exceeded)`);
                        } else {
                            results.failed.push({ signal: signal.symbol, error: result.reason, code: result.code });
                            console.log(`   │  ✗ FAILED`);
                            console.log(`   │  Code: ${result.code || 'ERROR'}`);
                            console.log(`   │  Reason: ${result.reason}`);
                            console.log(`   └─ Status: Dismissed (validation failed)`);
                        }
                    }
                } catch (error) {
                    results.failed.push({ signal: signal.symbol, error: error.message });
                    console.log(`   │  ✗ EXCEPTION`);
                    console.log(`   │  Error: ${error.message}`);
                    console.log(`   └─ Status: Failed (unexpected error)`);
                }

                console.log(''); // Blank line between signals
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
            // Use primary user email for single user system
            // TODO: Make this configurable via environment variable
            const userId = 'ketanjoshisahs@gmail.com';

            // Step 1: Validate capital and position limits
            console.log(`   │  🔍 Validating...`);
            const validation = await CapitalManager.validateTradeEntry(market, signal.symbol);

            if (!validation.valid) {
                console.log(`   │  ❌ Validation Failed`);
                console.log(`   │     Code: ${validation.code}`);
                console.log(`   │     Details: ${JSON.stringify(validation.details || {}, null, 6).replace(/\n/g, '\n   │     ')}`);

                // Mark signal as dismissed
                await TradeDB.updateSignalStatus(signal.id, 'dismissed');
                return {
                    success: false,
                    reason: validation.reason,
                    code: validation.code
                };
            }

            console.log(`   │  ✅ Validation Passed`);
            console.log(`   │     Trade Size: ${validation.tradeSize?.toFixed(0)}`);
            console.log(`   │     Currency: ${validation.currency}`);

            // Step 2: Allocate capital
            await TradeDB.allocateCapital(market, validation.tradeSize);

            // Step 3: Create trade
            // Convert string values to numbers (database returns strings)
            const trade = {
                symbol: signal.symbol,
                entryDate: new Date(),
                entryPrice: parseFloat(signal.entry_price),
                targetPrice: parseFloat(signal.target_price),
                stopLossPercent: 5,
                status: 'active',
                notes: `Auto-executed at 1 PM ${market} time - Win Rate: ${parseFloat(signal.win_rate).toFixed(1)}%`,
                market: signal.market,
                tradeSize: validation.tradeSize,
                signalDate: signal.signal_date,
                winRate: parseFloat(signal.win_rate),
                historicalSignalCount: parseInt(signal.historical_signal_count) || 0,
                autoAdded: true,
                entryDTI: parseFloat(signal.entry_dti) || 0,
                entry7DayDTI: parseFloat(signal.entry_7day_dti) || 0,
                prevDTI: parseFloat(signal.prev_dti) || 0,
                prev7DayDTI: parseFloat(signal.prev_7day_dti) || 0
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

    /**
     * Clean up old pending signals (older than 1 day)
     * Runs daily at midnight UTC
     */
    async cleanupOldPendingSignals() {
        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            console.log(`🧹 [CLEANUP] Removing pending signals older than ${yesterdayStr}...`);

            // Delete old pending signals
            const result = await TradeDB.pool.query(`
                DELETE FROM pending_signals
                WHERE status = 'pending'
                  AND signal_date < $1
                RETURNING symbol, signal_date, market
            `, [yesterdayStr]);

            if (result.rows.length > 0) {
                console.log(`🧹 [CLEANUP] Removed ${result.rows.length} old pending signals:`);
                result.rows.forEach(row => {
                    console.log(`   - ${row.symbol} (${row.market}) from ${row.signal_date}`);
                });
            } else {
                console.log(`🧹 [CLEANUP] No old pending signals to remove`);
            }

            return {
                removed: result.rows.length,
                signals: result.rows
            };
        } catch (error) {
            console.error('🧹 [CLEANUP] Error cleaning up old signals:', error.message);
            return { error: error.message };
        }
    }
}

module.exports = new TradeExecutor();
