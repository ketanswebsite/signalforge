/**
 * Stock Scanner Service
 * Clean, unified scanner implementation using shared modules
 * Replaces the multiple duplicate scanner files
 */

const YahooClient = require('../shared/yahoo-client');
// The dead-ticker record (GAPS #10): each symbol's Yahoo answer during a scan, and the skip that is off by default
const TickerHealth = require('../shared/ticker-health');
const cron = require('../shared/job-runs').cronFor('scanner'); // node-cron; named jobs record each run (job_runs)
const { sendTelegramAlert, broadcastToSubscribers } = require('../telegram/telegram-bot');
const { getAllStocks, getStocksByMarket } = require('../shared/stock-data');
const { analyzeStock, calculateDTI, calculate7DayDTI } = require('../shared/dti-calculator');
const MarketCapService = require('../shared/market-cap-service');
const { formatDateDDMMYYYY } = require('../shared/date-format');
const FrontendBacktestCalculator = require('../shared/frontend-backtest-calculator');
const BacktestCalculator = require('../shared/backtest-calculator');
const HighConvictionPortfolioManager = require('../portfolio/high-conviction-manager');
const { getConviction, summarizeConviction } = require('../../ml/conviction-engine');

// The strategy's numbers: the win-rate bar, the DTI periods, the target, the stop, the holding limit (GAPS #9)
const StrategyParams = require('../shared/strategy-params');

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
        // While a scan asks Yahoo: the run that notes each symbol's answer for the dead-ticker record, else null
        this.tickerHealthRun = null;
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
                icon: '/images/brand/app-icon.png',
                badge: '/images/brand/app-icon.png',
                tag: options.tag || `scanner-${Date.now()}`,
                url: options.url || '/account.html',
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

        // Monthly AI conviction sweep: FIRST Saturday of the month, 8 AM UK,
        // scores the full universe once; the verdicts serve the whole
        // following month's trades and simulations (read window
        // CONVICTION_MAX_AGE_DAYS covers the gap until the next sweep).
        // The cron fires every Saturday; isSweepDay() keeps only the first
        // one — explicit, rather than relying on cron day-of-month/day-of-week
        // combination semantics. Disable with CONVICTION_SWEEP=false. The
        // 8 AM is mirrored by SWEEP_HOUR_UK in ml/conviction-sweep.js.
        if (process.env.CONVICTION_SWEEP !== 'false') {
            const sweepJob = cron.schedule('0 8 * * 6', async () => {
                try {
                    const { isSweepDay, runConvictionSweep } = require('../../ml/conviction-sweep');
                    if (!isSweepDay()) {
                        console.log('🧠 [CRON] Saturday check: not the first Saturday of the month — monthly AI sweep skipped');
                        return;
                    }
                    console.log('🧠 [CRON] First Saturday of the month — monthly AI conviction sweep starting...');
                    await runConvictionSweep({ trigger: 'monthly' });
                } catch (error) {
                    console.error('❌ [CRON] Conviction sweep failed:', error.message);
                }
            }, {
                timezone: "Europe/London",
                scheduled: true
            });
            this.scheduledJobs.push(sweepJob);
            console.log('🧠 [SCANNER] Monthly AI sweep scheduled: first Saturday of each month, 8:00 AM UK (full universe, verdicts reused all month)');

            // A restart on sweep day picks up the run it cut short (GAPS #21)
            try {
                require('../../ml/conviction-sweep').scheduleResumeCheck();
            } catch (error) {
                console.error('❌ [SCANNER] Could not schedule the AI sweep restart check:', error.message);
            }

            // Sweep-day watchdog: every 30 minutes on Saturdays, 09:00-20:30 UK.
            // runSweepWatchdog() acts on sweep day from 09:00 to 20:00 only: it
            // picks up a run that ended short while this process lived on (the
            // restart check above covers a process that died)
            const sweepWatchdogJob = cron.schedule('*/30 9-20 * * 6', async () => {
                try {
                    await require('../../ml/conviction-sweep').runSweepWatchdog();
                } catch (error) {
                    console.error('❌ [CRON] AI sweep watchdog failed:', error.message);
                }
            }, {
                timezone: "Europe/London",
                scheduled: true
            });
            this.scheduledJobs.push(sweepWatchdogJob);
            console.log('🧠 [SCANNER] AI sweep watchdog scheduled: sweep day, every 30 min from 09:00 to 20:00 UK');
        }

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

        // EOD AI portfolio summary at 7 PM UK time (after US market's UK-day
        // session is well underway; India/UK closed) — every open position,
        // its day movement, and that day's news
        const eodSummaryJob = cron.schedule('0 19 * * 1-5', async () => {
            console.log('🌆 [EOD] 7 PM UK trigger — building portfolio summary');
            try {
                const eodSummary = require('../portfolio/eod-summary');
                const result = await eodSummary.sendEODSummary();
                console.log('✅ [EOD] Summary complete:', JSON.stringify(result));
            } catch (error) {
                console.error('❌ [EOD] Summary failed:', error);
            }
        }, {
            timezone: "Europe/London",
            scheduled: true
        });
        this.scheduledJobs.push(eodSummaryJob);
        console.log('🌆 [EOD] Daily AI portfolio summary scheduled for 7 PM UK (Mon-Fri)');

        // Intraday high-conviction exit checks (supplements the 4 PM full refresh
        // so take-profit/stop-loss exits aren't only caught once a day).
        // Interval in minutes (2-59), override with HC_EXIT_CHECK_INTERVAL_MIN.
        const hcIntervalMin = Math.max(2, Math.min(59, parseInt(process.env.HC_EXIT_CHECK_INTERVAL_MIN, 10) || 10));
        const hcIntradayJob = cron.schedule(`*/${hcIntervalMin} * * * *`, async () => {
            const ukParts = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Europe/London', weekday: 'short', hour: 'numeric', hour12: false
            }).formatToParts(new Date());
            const dayMap = {Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6};
            const ukDay = dayMap[ukParts.find(p => p.type === 'weekday').value];
            const ukHour = parseInt(ukParts.find(p => p.type === 'hour').value);
            // Same extended market window as the exit monitor (2 AM - 10 PM UK, Mon-Fri)
            if (ukDay >= 1 && ukDay <= 5 && ukHour >= 2 && ukHour < 22) {
                try {
                    await this.portfolioManager.updateAllActiveTrades();
                } catch (error) {
                    console.error('❌ [PORTFOLIO] Intraday exit check failed:', error.message);
                }
            }
        }, {
            timezone: "Europe/London",
            scheduled: true
        });
        this.scheduledJobs.push(hcIntradayJob);
        console.log(`📊 [PORTFOLIO] Intraday high-conviction exit checks every ${hcIntervalMin} min (2 AM - 10 PM UK, Mon-Fri)`);

        // Ledger drift check (GAPS #6) at 10:30 PM UK, Monday to Friday: every market
        // has closed and the exit monitor stopped at 10 PM, so no scheduled job books,
        // closes or releases while it reads. It runs the reconcile's dry run and
        // messages the owner about drift; it never writes the ledger. Off with
        // LEDGER_DRIFT_CHECK=false. CRON_EXPRESSION in ledger-drift-check.js mirrors
        // this expression.
        const ledgerDriftJob = cron.schedule('30 22 * * 1-5', async () => {
            try {
                await require('../portfolio/ledger-drift-check').runLedgerDriftCheck();
            } catch (error) {
                console.error('❌ [LEDGER DRIFT] Check failed:', error.message);
            }
        }, {
            timezone: "Europe/London",
            scheduled: true
        });
        this.scheduledJobs.push(ledgerDriftJob);
        console.log('📒 [LEDGER DRIFT] Drift check scheduled for 10:30 PM UK (Mon-Fri)');

        // Exit-check retention (GAPS #13) at 11:20 PM UK, every day — outside the
        // 2 AM - 10 PM exit-monitor window, so the DELETE never competes with the
        // per-minute inserts. It prunes by default; EXIT_CHECK_PRUNE=false makes
        // every run a dry run that writes nothing.
        const exitCheckPruneJob = cron.schedule('20 23 * * *', async () => {
            try {
                const { pruneExitChecks } = require('../portfolio/exit-check-retention');
                await pruneExitChecks();
            } catch (error) {
                console.error('❌ [EXIT CHECKS] Retention job failed:', error);
            }
        }, {
            timezone: "Europe/London",
            scheduled: true
        });
        this.scheduledJobs.push(exitCheckPruneJob);
        console.log('🧹 [EXIT CHECKS] Retention job scheduled for 11:20 PM UK (daily)');

        // Benchmark fill (GAPS #15) at 11:40 PM UK, every day: every market has closed, so the day's index
        // closes are final. It writes each closed position's index return over its holding window
        // (lib/portfolio/benchmark-fill.js), with at most one Yahoo request per market; a market whose
        // request fails waits for the next night. A missed run is caught up by the next one, so it has no
        // deploy window. BENCHMARK_FILL=false turns it off. CRON_EXPRESSION in benchmark-fill.js mirrors
        // this expression. The summary it returns is kept in job_runs.
        const benchmarkFillJob = cron.schedule('40 23 * * *', async () => {
            try {
                return await require('../portfolio/benchmark-fill').runBenchmarkFill();
            } catch (error) {
                console.error('[BENCHMARK] Fill job failed:', error.message);
                return undefined;
            }
        }, {
            timezone: "Europe/London",
            scheduled: true
        });
        this.scheduledJobs.push(benchmarkFillJob);
        console.log('[BENCHMARK] Benchmark fill scheduled for 11:40 PM UK (daily)');

        // Dated exchange rates (GAPS #11) at 00:15 UK, every day: the daily closes of GBPINR=X and GBPUSD=X up to
        // yesterday into fx_rates (lib/shared/fx-rates.js), one Yahoo request per pair, then the high-conviction
        // book's converted figures restamped at their own day's rate. A missed night is caught up by the next run and
        // by a boot, so it has no deploy window. FX_RATES_REFRESH=false turns it off. CRON_EXPRESSION in fx-rates.js
        // mirrors this expression. The summary it returns is kept in job_runs.
        const fxRatesJob = cron.schedule('15 0 * * *', async () => {
            try {
                return await require('../shared/fx-rates').refreshFxRates();
            } catch (error) {
                console.error('[FX] Exchange rates job failed:', error.message);
                return undefined;
            }
        }, {
            timezone: "Europe/London",
            scheduled: true
        });
        this.scheduledJobs.push(fxRatesJob);
        console.log('[FX] Exchange rates refresh scheduled for 00:15 UK (daily)');

        // A boot refreshes a store that is empty (the first deploy) or days behind, a minute after it starts
        try {
            require('../shared/fx-rates').scheduleBootCatchUp();
        } catch (error) {
            console.error('[FX] Could not schedule the exchange rates boot catch-up:', error.message);
        }

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

        // Determine if this is a broadcast (scheduled 7AM scan) or single user test.
        // Declared before try so the catch block can reference them too.
        const isBroadcast = !chatId; // No specific chatId means broadcast to all subscribers
        const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;

        try {

            // Send scan start notification
            if (isBroadcast) {
                // Broadcast to all subscribers who want scans or all signals
                console.log('📤 [SCANNER] Sending scan start notification to subscribers...');
                const startResults = await broadcastToSubscribers({
                    type: 'custom',
                    kind: 'scan',
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
            // The whole universe. Dead tickers are left out only with SKIP_DEAD_TICKERS=true (off unless the owner
            // sets it: GAPS #10, lib/shared/ticker-health.js), and a record that cannot be read leaves nothing out
            const { stocks: allStocks, skipped: deadTickersSkipped } = await TickerHealth.scanList(this.getComprehensiveStockList());

            // Step 1: Find ALL current opportunities (same as frontend scan)
            const allCurrentOpportunities = await this.findCurrentOpportunities(allStocks);
            
            // Step 2: Filter for high conviction (a backtest win rate above StrategyParams.WIN_RATE_BAR_PERCENT)
            const highConvictionOpportunities = allCurrentOpportunities.filter(opp => {
                const winRate = opp.trade?.winRate || 0;
                return winRate > StrategyParams.WIN_RATE_BAR_PERCENT;
            });
            
            // Step 3: Filter for recent signals (the last RECENT_SIGNAL_TRADING_DAYS trading days, today included)
            const recentOpportunities = highConvictionOpportunities.filter(opp => {
                const signalDate = opp.trade.signalDate || opp.trade.entryDate;
                const isRecent = BacktestCalculator.isWithinTradingDays(signalDate, StrategyParams.RECENT_SIGNAL_TRADING_DAYS);
                return isRecent;
            });
            
            // Step 4: Send ALL recent high conviction opportunities (no limit)
            const alertOpportunities = recentOpportunities;

            // Log which opportunities are being sent (same as frontend)
            alertOpportunities.forEach(opp => {
                const signalDate = new Date(opp.trade.signalDate || opp.trade.entryDate);
            });

            // Send results using same format as successful manual scan
            // Declared outside the if-block: the no-results path below still assigns
            // this.scanResults and builds the return value from it.
            let sortedOpportunities = [];
            let goOpportunities = [];
            let filteredOpportunities = [];
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

                // Step 5.5: AI conviction gate — indicator + AI must BOTH agree.
                // Every signal is scored (3-pillar check); only GO invests. Non-GO
                // signals are still stored (as dismissed, with their verdict) and
                // still appear in alerts, but no capital ever moves on them.
                const gate = await this.runConvictionGate(sortedOpportunities);
                goOpportunities = gate.go;
                filteredOpportunities = gate.filtered;

                // Store ALL signals (GO → pending for 1 PM execution, filtered →
                // dismissed with conviction data as the audit trail)
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
                // AI gate applies here too: only GO signals are booked.
                // Observation mode: signals are still stored + alerted, but no bookings.
                if (process.env.AUTO_EXECUTE === 'false') {
                    console.log('⏸ [PORTFOLIO] AUTO_EXECUTE=false — observation mode, not adding paper trades');
                } else {
                    console.log(`💼 [PORTFOLIO] Adding ${goOpportunities.length} AI-approved trades to portfolio` +
                        (filteredOpportunities.length ? ` (${filteredOpportunities.length} filtered by AI gate)` : '') + '...');
                    for (const opportunity of goOpportunities) {
                        const result = await this.portfolioManager.addTradeFromScan(opportunity);
                        if (result.success) {
                            console.log('✅ [PORTFOLIO] Added:', opportunity.stock.symbol);
                        } else if (result.reason === 'duplicate') {
                            console.log('⚠️ [PORTFOLIO] Skipped (duplicate):', opportunity.stock.symbol);
                        }
                    }
                }

                const message = this.formatHighConvictionMessage(goOpportunities, highConvictionOpportunities.length, filteredOpportunities);

                if (isBroadcast) {
                    // Broadcast conviction trades to subscribers
                    console.log(`📤 [SCANNER] Sending ${sortedOpportunities.length} conviction trades to subscribers...`);
                    const convictionResults = await broadcastToSubscribers({
                        type: 'custom',
                        kind: 'scan',
                        message: `🌅 *7 AM Conviction Trades*\n\n${message}`
                    }, 'conviction');
                    console.log(`✅ [SCANNER] Conviction trades sent to ${convictionResults.length} subscribers`);

                    // Also send push notifications
                    const symbols = goOpportunities.slice(0, 3).map(o => o.stock.symbol).join(', ');
                    const pushBody = goOpportunities.length > 0
                        ? `${goOpportunities.length} AI-approved signals: ${symbols}${goOpportunities.length > 3 ? '...' : ''}` +
                          (filteredOpportunities.length ? ` (${filteredOpportunities.length} filtered)` : '')
                        : `AI gate filtered all ${filteredOpportunities.length} indicator signals — nothing to execute`;
                    const pushResult = await this.sendPushBroadcast(
                        '7 AM Conviction Trades',
                        pushBody,
                        { tag: 'scan-results', requireInteraction: goOpportunities.length > 0 }
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
                        kind: 'scan',
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
                deadTickersSkipped: deadTickersSkipped.length,
                highConvictionFound: highConvictionOpportunities.length,
                recentOpportunities: recentOpportunities.length,
                aiPassed: goOpportunities.length,
                aiFiltered: filteredOpportunities.length,
                alertsSent: sortedOpportunities.length
            };

        } catch (error) {
            
            const errorMessage = `❌ *Scan Error*\n\nHigh conviction scan failed: ${error.message}`;
            
            if (!chatId) {
                // Broadcast error to all subscribers
                await broadcastToSubscribers({
                    type: 'custom',
                    kind: 'scan',
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
     * AI conviction gate: score every screened opportunity with the shared
     * three-pillar engine and split GO (invest) from the rest (store only).
     *
     * Policy: verdict GO (confidence > 6.0) invests; WATCH/PASS do not.
     * If the engine itself errors, the signal is treated as WATCH (fail-closed:
     * no AI confirmation = no trade). Set AI_CONVICTION_GATE=false to disable
     * the gate entirely (signals then flow exactly as before this feature).
     *
     * Each opportunity gets `.conviction` attached for storage + alerts.
     */
    async runConvictionGate(opportunities) {
        if (process.env.AI_CONVICTION_GATE === 'false') {
            console.log('⚠️ [AI GATE] AI_CONVICTION_GATE=false — gate disabled, all indicator signals pass');
            return { go: opportunities, filtered: [] };
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log(`🤖 [AI GATE] Running conviction check on ${opportunities.length} signals`);
        console.log(`${'='.repeat(60)}`);

        const go = [];
        const filtered = [];

        for (let i = 0; i < opportunities.length; i++) {
            const opp = opportunities[i];
            const symbol = opp.stock.symbol;
            try {
                opp.conviction = await getConviction({
                    symbol,
                    name: opp.stock.name,
                    winRate: opp.trade?.winRate || null
                });
            } catch (error) {
                // Fail-closed: an unscored signal must not invest
                console.error(`   ⚠️ [AI GATE] Engine error for ${symbol}: ${error.message}`);
                opp.conviction = {
                    symbol,
                    confidence: 5,
                    verdict: 'WATCH',
                    engine: 'error-fallback',
                    summary: `Conviction engine error: ${error.message}`.slice(0, 300),
                    pillars: null
                };
            }

            const c = opp.conviction;
            const icon = c.verdict === 'GO' ? '✅' : c.verdict === 'WATCH' ? '👀' : '⛔';
            console.log(`   [${i + 1}/${opportunities.length}] ${icon} ${symbol} — ${c.verdict} ${c.confidence}/10 (${c.engine})`);

            if (c.verdict === 'GO') {
                go.push(opp);
            } else {
                filtered.push(opp);
            }

            // Be gentle on the data sources between checks
            if (i < opportunities.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 250));
            }
        }

        console.log(`${'='.repeat(60)}`);
        console.log(`🤖 [AI GATE] Result: ${go.length} GO (will invest) / ${filtered.length} filtered (stored only)`);
        console.log(`${'='.repeat(60)}\n`);

        return { go, filtered };
    }

    /**
     * Store signals in pending_signals table for automated 1 PM execution
     */
    async storeSignalsForExecution(opportunities) {
        try {
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
                const targetPrice = StrategyParams.targetPrice(entryPrice);
                const stopLoss = StrategyParams.stopLossPrice(entryPrice);
                // FIX: Use TODAY's date, not historical signal date from backtest
                const signalDate = todayDate; // Changed from: opp.trade.signalDate || opp.trade.entryDate
                const squareOffDate = new Date(signalDate);
                squareOffDate.setDate(squareOffDate.getDate() + StrategyParams.MAX_HOLDING_DAYS); // the holding limit

                const historicalDate = opp.trade.signalDate || opp.trade.entryDate;

                // AI conviction gate result (absent when AI_CONVICTION_GATE=false)
                const conviction = opp.conviction || null;
                const signalStatus = conviction && conviction.verdict !== 'GO' ? 'dismissed' : 'pending';

                // Enhanced logging for each signal
                console.log(`   [${index + 1}/${opportunities.length}] 📝 ${symbol}`);
                console.log(`      Market: ${market} (detected from symbol suffix)`);
                console.log(`      Entry Price: ${entryPrice.toFixed(2)}`);
                console.log(`      Win Rate: ${(opp.trade?.winRate || 0).toFixed(1)}%`);
                if (conviction) {
                    console.log(`      AI Conviction: ${conviction.verdict} ${conviction.confidence}/10 → stored as '${signalStatus}'`);
                }
                console.log(`      Signal Date: ${signalDate} ← TODAY (executor will look for this)`);
                console.log(`      Historical Date: ${historicalDate} (from backtest, not used)`);
                console.log(`      Square Off: ${squareOffDate.toISOString().split('T')[0]} (${StrategyParams.MAX_HOLDING_DAYS} days from today)`);

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
                    marketCapRank: opp.marketCapRank || null,
                    convictionScore: conviction ? conviction.confidence : null,
                    convictionVerdict: conviction ? conviction.verdict : null,
                    convictionSummary: conviction ? summarizeConviction(conviction) : null,
                    convictionEngine: conviction ? conviction.engine : null,
                    status: signalStatus
                };
            });

            // Stored in process. This used to be an HTTP POST to
            // /api/signals/from-scan, a route that had to sit in front of the
            // sign-in gate and so stored anyone's signals - including a 'GO'
            // verdict the 1 PM executor would then book and broadcast.
            const { storeScanSignals } = require('./signal-store');
            const { created, duplicates, errors } = await storeScanSignals(signalsToStore);

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
                
                // The strategy's parameters (lib/shared/strategy-params.js). The target, stop and holding limit
                // below are copies that tests/unit/strategy-params.test.js holds equal to the module
                const params = {
                    ...StrategyParams.DTI_PERIODS,
                    entryThreshold: StrategyParams.ENTRY_THRESHOLD,
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
                
                // The strategy's parameters (lib/shared/strategy-params.js). The target, stop and holding limit
                // below are copies that tests/unit/strategy-params.test.js holds equal to the module
                const params = {
                    ...StrategyParams.DTI_PERIODS,
                    entryThreshold: StrategyParams.ENTRY_THRESHOLD,
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
        // Every symbol's Yahoo answer is noted for the dead-ticker record (lib/shared/ticker-health.js) and written in
        // one go when the loop is done. The write never throws and takes at most 15 s: it cannot fail the scan
        const healthRun = TickerHealth.startRun('scan');
        this.tickerHealthRun = healthRun;
        try {
            for (let i = 0; i < allStocks.length; i += batchSize) {
                const batch = allStocks.slice(i, i + batchSize);
                const batchResults = await this.scanStockBatchForOpportunities(batch);
                opportunities.push(...batchResults);

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        } finally {
            this.tickerHealthRun = null;
            await healthRun.flush();
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
     * Calculate square off date (the entry plus the holding limit, StrategyParams.MAX_HOLDING_DAYS)
     */
    calculateSquareOffDate(entryDate) {
        const entry = new Date(entryDate);
        const squareOff = new Date(entry);
        squareOff.setDate(entry.getDate() + StrategyParams.MAX_HOLDING_DAYS); // Max holding period
        return formatDateDDMMYYYY(squareOff);
    }

    /**
     * Format high conviction message with detailed information
     */
    formatHighConvictionMessage(alertOpportunities, totalOpportunities, filteredOpportunities = []) {
        if ((!alertOpportunities || alertOpportunities.length === 0) && filteredOpportunities.length === 0) {
            return '📊 *High Conviction Scan Complete*\n\nNo high conviction opportunities found.';
        }

        // Everything the indicator found was filtered out by the AI gate
        if (!alertOpportunities || alertOpportunities.length === 0) {
            let msg = `📊 *High Conviction Scan Complete*\n\n`;
            msg += `The indicator found ${filteredOpportunities.length} signal${filteredOpportunities.length === 1 ? '' : 's'}, `;
            msg += `but the AI conviction check approved none — *no trades will be taken today*.\n`;
            msg += this.formatAiFilteredSection(filteredOpportunities);
            return msg;
        }

        let message = `📊 *🎯 HIGH CONVICTION TRADING OPPORTUNITIES*\n`;
        message += `Found ${alertOpportunities.length} Active Trades (indicator + AI approved)\n`;
        message += `Scan Date: *${formatDateDDMMYYYY(new Date())}*\n\n`;
        
        // Add individual opportunities with complete details
        alertOpportunities.forEach((opp, index) => {
            const stockName = opp.stock?.name || 'Unknown';
            const stockCode = opp.stock.symbol;
            const market = this.getMarketFromSymbol(stockCode);
            
            const currentPrice = opp.trade?.currentPrice || opp.trade?.entryPrice || 0;
            const targetPrice = StrategyParams.targetPrice(currentPrice).toFixed(2);
            const stopLossPrice = StrategyParams.stopLossPrice(currentPrice).toFixed(2);
            
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
            message += `Backtested Trades: ${totalTrades} (${StrategyParams.BACKTEST_HISTORY_YEARS} years)\n`;
            if (opp.conviction) {
                message += `AI Check: ✅ ${opp.conviction.verdict} ${opp.conviction.confidence}/10\n`;
            }

            if (index < alertOpportunities.length - 1) message += `\n`;
        });

        message += `\n📈 Total Scanned: ${totalOpportunities || 'All'} stocks`;
        message += this.formatAiFilteredSection(filteredOpportunities);

        return message;
    }

    /**
     * Compact Telegram section listing signals the AI conviction gate filtered
     * out (indicator fired, AI said WATCH/PASS — stored for audit, not traded)
     */
    formatAiFilteredSection(filteredOpportunities) {
        if (!filteredOpportunities || filteredOpportunities.length === 0) return '';

        let section = `\n\n🤖 *AI Conviction Gate — ${filteredOpportunities.length} filtered (not traded):*\n`;
        filteredOpportunities.forEach(opp => {
            const c = opp.conviction || {};
            const icon = c.verdict === 'PASS' ? '⛔' : '👀';
            section += `${icon} ${opp.stock.symbol} — ${c.verdict || '?'} ${c.confidence != null ? c.confidence : '?'}/10\n`;
        });
        return section;
    }

    /**
     * Fetch stock data from Yahoo Finance API (same method as frontend)
     */
    async fetchStockData(symbol) {
        try {
            // Calculate date range (StrategyParams.BACKTEST_HISTORY_YEARS of daily bars)
            const endDate = Math.floor(Date.now() / 1000);
            const startDate = endDate - (StrategyParams.BACKTEST_HISTORY_YEARS * 365 * 24 * 60 * 60);
            
            // Yahoo in process (lib/shared/yahoo-client.js): the very CSV GET /yahoo/history serves,
            // through the same repairs, without an HTTP call back into this server
            let history;
            try {
                history = await YahooClient.fetchHistoryCsv(symbol, { period1: startDate, period2: endDate, interval: '1d' }, { timeout: 10000 });
            } catch (error) {
                // During a scan the failure is noted for the dead-ticker record: a 404 is Yahoo's "no such symbol",
                // a timeout or a 429 says nothing either way
                if (this.tickerHealthRun) this.tickerHealthRun.failed(symbol, error);
                return null;
            }
            // ...and so is what came back: the newest bar's date, or no bars at all
            if (this.tickerHealthRun) this.tickerHealthRun.history(symbol, history);
            if (!history) {
                return null;
            }

            // Frontend expects CSV data, so we need to parse the response accordingly
            const csvText = history.csv;
            
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
                            volume: parseInt(values[6]) // Date,Open,High,Low,Close,Adj Close,Volume
                        });
                    }
                }
            }
            
            // Extract price arrays for DTI calculation
            const high = stockData.prices.map(p => p.high);
            const low = stockData.prices.map(p => p.low);
            const close = stockData.prices.map(p => p.close);
            
            // The DTI's periods (lib/shared/strategy-params.js)
            const { r, s, u } = StrategyParams.DTI_PERIODS;
            
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