/**
 * Automated Trade Executor
 * Executes pending signals at 1 PM in each market timezone
 */

const TradeDB = require('../../database-postgres');
const CapitalManager = require('../portfolio/capital-manager');
const cron = require('../shared/job-runs').cronFor('executor'); // node-cron; named jobs record each run (job_runs)
const YahooClient = require('../shared/yahoo-client');
const { getConviction, summarizeConviction } = require('../../ml/conviction-engine');
const AlertPolicy = require('../shared/alert-policy');

// Slippage guard: if the live 1 PM price has drifted more than this from the
// 7 AM signal price, the setup that generated the signal no longer exists —
// skip the trade instead of entering with a distorted risk/reward.
const MAX_ENTRY_DRIFT_PERCENT = parseFloat(process.env.MAX_ENTRY_DRIFT_PERCENT) || 3;

/**
 * Undo an allocation whose trade insert failed: the ledger must never hold capital for a booking that did not
 * happen (the unique index on open automatic positions can refuse an insert, and so can any database error).
 * Never throws - the caller is already handling the insert's error. A release that fails is logged, and the
 * nightly drift check (lib/portfolio/ledger-drift-check.js) reports the ledger row to the owner.
 */
async function releaseAllocation(market, amount, userId, symbol) {
    try {
        await TradeDB.releaseCapital(market, amount, 0, userId);
        console.error(`   ↩️ ${symbol}: the trade was not stored - its allocation of ${amount} was handed back`);
    } catch (error) {
        console.error(`   ❌ ${symbol}: the trade was not stored AND its allocation could not be handed back (${error.message}) - the ledger drift check will report it`);
    }
}

/**
 * Fetch live market price from Yahoo Finance
 * @param {string} symbol - Stock symbol
 * @returns {Promise<number|null>} Current market price or null if fetch fails
 */
async function fetchLivePrice(symbol) {
    try {
        // The one-day chart from lib/shared/yahoo-client.js: the same request as before
        const data = await YahooClient.fetchQuoteChart(symbol, { timeout: 10000 }); // 10 second timeout
        if (data.chart && data.chart.result && data.chart.result.length > 0) {
            const result = data.chart.result[0];
            const meta = result.meta;
            const quote = result.indicators.quote[0];

            // Get the latest price
            const currentPrice = meta.regularMarketPrice || (quote.close ? quote.close[quote.close.length - 1] : null);

            if (currentPrice && currentPrice > 0) {
                return parseFloat(currentPrice);
            }
        }

        return null;
    } catch (error) {
        console.error(`   ⚠️  Failed to fetch live price for ${symbol}: ${error.message}`);
        return null;
    }
}

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

        // India Market: 1 PM IST
        // Runs Monday-Friday at 1:00 PM IST
        cron.schedule('0 13 * * 1-5', async () => {
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
        // Observation mode: scans and signal alerts continue, but nothing books.
        if (process.env.AUTO_EXECUTE === 'false') {
            console.log(`⏸ [${market}] AUTO_EXECUTE=false — observation mode, skipping trade execution`);
            return { success: true, market, executed: 0, failed: 0, skipped: 0, observationMode: true };
        }
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

            // Log market cap ranking info
            const signalsWithMarketCap = todaySignals.filter(s => s.market_cap_rank);
            if (signalsWithMarketCap.length > 0) {
                console.log(`   📊 MARKET CAP EXECUTION ORDER (highest first):`);
                console.log(`   ${'─'.repeat(50)}`);
                todaySignals.forEach((s, idx) => {
                    const rank = s.market_cap_rank || 'N/A';
                    const cap = s.market_cap_usd ? `$${(parseFloat(s.market_cap_usd) / 1e9).toFixed(2)}B` : 'N/A';
                    console.log(`   ${idx + 1}. ${s.symbol} - Rank: ${rank}, MCap: ${cap}`);
                });
                console.log(`   ${'─'.repeat(50)}\n`);
            }

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
                skipped: [],
                aiRejected: [],
                priceSkipped: [],
                duplicateSkipped: []
            };

            // Execute each signal with detailed logging.
            // adminOutcomes feeds the community pass below: it remembers each
            // signal's canonical result (AI verdict, price guard, fill price).
            console.log(`\n   🔄 EXECUTING ${todaySignals.length} SIGNALS\n`);
            const adminOutcomes = new Map();

            for (let i = 0; i < todaySignals.length; i++) {
                const signal = todaySignals[i];
                const marketCapDisplay = signal.market_cap_usd ? `$${(parseFloat(signal.market_cap_usd) / 1e9).toFixed(2)}B` : 'N/A';
                const marketCapRank = signal.market_cap_rank || 'N/A';
                console.log(`   ┌─ [${i + 1}/${todaySignals.length}] ${signal.symbol} (${market}) - MCap Rank: ${marketCapRank}`);
                console.log(`   │  Entry Price: ${parseFloat(signal.entry_price || 0).toFixed(2)}`);
                console.log(`   │  Target: ${parseFloat(signal.target_price || 0).toFixed(2)}`);
                console.log(`   │  Win Rate: ${parseFloat(signal.win_rate || 0).toFixed(1)}%`);
                console.log(`   │  Market Cap: ${marketCapDisplay}`);
                console.log(`   │  Signal Date: ${new Date(signal.signal_date).toISOString().split('T')[0]}`);

                try {
                    const result = await this.executeSingleSignal(signal, market);
                    adminOutcomes.set(signal.id, result);

                    if (result.success) {
                        results.executed.push(result);
                        console.log(`   │  ✅ SUCCESS`);
                        console.log(`   │  Trade ID: ${result.tradeId}`);
                        console.log(`   │  Trade Size: ${result.tradeSize?.toFixed(0)}`);
                        console.log(`   └─ Status: Added to portfolio`);
                    } else {
                        if (result.code === 'AI_GATE') {
                            results.aiRejected.push({ signal: signal.symbol, reason: result.reason });
                            console.log(`   │  🤖 AI REJECTED`);
                            console.log(`   │  Reason: ${result.reason}`);
                            console.log(`   └─ Status: Dismissed (AI conviction below GO)`);
                        } else if (result.code === 'PRICE_DRIFT' || result.code === 'NO_LIVE_PRICE') {
                            results.priceSkipped.push({ signal: signal.symbol, reason: result.reason });
                            console.log(`   │  ⊘ PRICE GUARD`);
                            console.log(`   │  Reason: ${result.reason}`);
                            console.log(`   └─ Status: Dismissed (entry price guard)`);
                        } else if (result.code === 'DUPLICATE_POSITION') {
                            results.duplicateSkipped.push({ signal: signal.symbol, reason: result.reason });
                            console.log(`   │  ♻ ALREADY HOLDING`);
                            console.log(`   │  Reason: ${result.reason}`);
                            console.log(`   └─ Status: Dismissed (active position exists)`);
                        } else if (result.reason.includes('limit') || result.reason.includes('capital')) {
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

            // Book the same eligible signals for every subscriber who enabled
            // personal auto-trading (their own capital, their own limits)
            const community = await this.executeForCommunity(todaySignals, market, adminOutcomes);

            const summary = {
                success: true,
                market,
                total: todaySignals.length,
                executed: results.executed.length,
                failed: results.failed.length,
                skipped: results.skipped.length,
                aiRejected: results.aiRejected.length,
                priceSkipped: results.priceSkipped.length,
                duplicateSkipped: results.duplicateSkipped.length,
                communityUsers: community.users,
                communityExecuted: community.executed,
                duration: Date.now() - startTime.getTime()
            };

            console.log(`\n${'='.repeat(60)}`);
            console.log(`📈 [${market}] EXECUTION SUMMARY`);
            console.log(`${'='.repeat(60)}`);
            console.log(`   Total Signals:    ${summary.total}`);
            console.log(`   ✓ Executed:       ${summary.executed}`);
            console.log(`   🤖 AI Rejected:   ${summary.aiRejected}`);
            console.log(`   ⊘ Price Guard:    ${summary.priceSkipped}`);
            console.log(`   ⊗ Skipped:        ${summary.skipped}`);
            console.log(`   ✗ Failed:         ${summary.failed}`);
            console.log(`   ⏱  Duration:       ${summary.duration}ms`);
            console.log(`${'='.repeat(60)}\n`);

            // Send Telegram notification (AI rejections and price-guard skips are
            // worth telling too — they explain why a 7 AM signal did not become
            // a 1 PM trade)
            if (summary.executed > 0 || summary.failed > 0 || summary.aiRejected > 0 || summary.priceSkipped > 0 || summary.duplicateSkipped > 0 || summary.communityExecuted > 0) {
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
            // Primary user email for this single-user system (override with ADMIN_EMAIL)
            const userId = process.env.ADMIN_EMAIL || 'ketanjoshisahs@gmail.com';

            // Step 0: AI conviction gate — no trade without a GO verdict.
            // The 7 AM scan stores non-GO signals as 'dismissed', so a pending
            // signal normally arrives here already GO. This safety net covers
            // signals that reached 'pending' without a verdict (stored before
            // the gate existed, or injected via /api/signals/from-scan) by
            // scoring them live. Disable with AI_CONVICTION_GATE=false.
            if (process.env.AI_CONVICTION_GATE !== 'false') {
                let verdict = signal.conviction_verdict;
                let confidence = signal.conviction_score != null ? parseFloat(signal.conviction_score) : null;

                if (!verdict) {
                    console.log(`   │  🤖 No stored AI verdict — running conviction check now...`);
                    try {
                        const conviction = await getConviction({
                            symbol: signal.symbol,
                            winRate: signal.win_rate != null ? parseFloat(signal.win_rate) : null
                        });
                        verdict = conviction.verdict;
                        confidence = conviction.confidence;
                        await TradeDB.updateSignalConviction(signal.id, {
                            confidence: conviction.confidence,
                            verdict: conviction.verdict,
                            summary: summarizeConviction(conviction),
                            engine: conviction.engine
                        });
                    } catch (error) {
                        // Fail-closed: no AI confirmation means no trade
                        console.log(`   │  ⚠️ Conviction check errored: ${error.message}`);
                        verdict = 'WATCH';
                        confidence = null;
                    }
                }

                if (verdict !== 'GO') {
                    console.log(`   │  🤖 AI Gate: ${verdict}${confidence != null ? ` ${confidence}/10` : ''} — trade blocked`);
                    await TradeDB.updateSignalStatus(signal.id, 'dismissed');
                    return {
                        success: false,
                        reason: `AI conviction ${verdict}${confidence != null ? ` (${confidence}/10)` : ''} — only GO signals invest`,
                        code: 'AI_GATE'
                    };
                }

                console.log(`   │  🤖 AI Gate: GO${confidence != null ? ` ${confidence}/10` : ''} — approved`);
            }

            // Step 1: Validate capital and position limits
            console.log(`   │  🔍 Validating...`);
            const validation = await CapitalManager.validateTradeEntry(market, signal.symbol, userId);

            if (!validation.valid) {
                console.log(`   │  ❌ Validation Failed`);
                console.log(`   │     Code: ${validation.code}`);
                console.log(`   │     Details: ${JSON.stringify(validation.details || {}, null, 6).replace(/\n/g, '\n   │     ')}`);

                // Mark signal as dismissed; for duplicates, record WHICH active
                // trade blocked the booking as an audit pointer
                await TradeDB.updateSignalStatus(signal.id, 'dismissed',
                    validation.code === 'DUPLICATE_POSITION' ? validation.existingTradeId : undefined);
                return {
                    success: false,
                    reason: validation.reason,
                    code: validation.code
                };
            }

            console.log(`   │  ✅ Validation Passed`);
            console.log(`   │     Trade Size: ${validation.tradeSize?.toFixed(0)}`);
            console.log(`   │     Currency: ${validation.currency}`);

            // Step 2: Fetch live market price at 1 PM execution time.
            // Fail-closed: without a live price we cannot verify slippage, so
            // we never fall back to the stale 7 AM signal price.
            console.log(`   │  📊 Fetching live price at execution time...`);
            const signalPrice = parseFloat(signal.entry_price);
            const livePrice = await fetchLivePrice(signal.symbol);

            if (!livePrice || livePrice <= 0) {
                console.log(`   │  ⚠️ Live price unavailable — skipping (no stale-price entries)`);
                await TradeDB.updateSignalStatus(signal.id, 'dismissed');
                return {
                    success: false,
                    reason: 'Live price unavailable at execution time — trade skipped rather than entered at the stale signal price',
                    code: 'NO_LIVE_PRICE'
                };
            }

            const driftPercent = ((livePrice - signalPrice) / signalPrice) * 100;
            const driftSign = driftPercent >= 0 ? '+' : '';
            console.log(`   │     Signal Price (7 AM): ${signalPrice.toFixed(2)}`);
            console.log(`   │     Live Price (1 PM): ${livePrice.toFixed(2)} (${driftSign}${driftPercent.toFixed(2)}%)`);

            if (Math.abs(driftPercent) > MAX_ENTRY_DRIFT_PERCENT) {
                console.log(`   │  ⚠️ Price drift ${driftSign}${driftPercent.toFixed(2)}% exceeds ±${MAX_ENTRY_DRIFT_PERCENT}% — trade skipped`);
                await TradeDB.updateSignalStatus(signal.id, 'dismissed');
                return {
                    success: false,
                    reason: `Price moved ${driftSign}${driftPercent.toFixed(2)}% between signal and execution (limit ±${MAX_ENTRY_DRIFT_PERCENT}%) — trade skipped`,
                    code: 'PRICE_DRIFT'
                };
            }

            const executionPrice = livePrice;
            console.log(`   │     ✓ Drift within ±${MAX_ENTRY_DRIFT_PERCENT}% — entering at live price`);

            // Step 3: Allocate capital
            await TradeDB.allocateCapital(market, validation.tradeSize, userId);

            // Step 4: Create trade.
            // Target and stop are anchored to the price actually paid, never
            // the 7 AM signal price, so +8%/−5% mean what they say.
            const entryDate = new Date();
            const squareOffDate = new Date(entryDate);
            squareOffDate.setDate(squareOffDate.getDate() + 30);
            const trade = {
                symbol: signal.symbol,
                entryDate: entryDate,
                entryPrice: executionPrice,
                targetPrice: executionPrice * 1.08,
                stopLossPercent: 5,
                takeProfitPercent: 8,
                squareOffDate: squareOffDate.toISOString().split('T')[0],
                status: 'active',
                notes: `Auto-executed at 1 PM ${market} time - Win Rate: ${parseFloat(signal.win_rate).toFixed(1)}% | Entry: live ${executionPrice.toFixed(2)} (signal ${signalPrice.toFixed(2)}, drift ${driftSign}${driftPercent.toFixed(2)}%)`,
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

            let newTrade;
            try {
                newTrade = await TradeDB.insertTrade(trade, userId);
            } catch (error) {
                await releaseAllocation(market, validation.tradeSize, userId, signal.symbol);
                throw error;
            }

            // Step 4: Update signal status
            await TradeDB.updateSignalStatus(signal.id, 'added', newTrade.id);

            return {
                success: true,
                tradeId: newTrade.id,
                symbol: signal.symbol,
                tradeSize: validation.tradeSize,
                executionPrice: executionPrice
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
     * Book today's eligible signals for every subscriber who enabled personal
     * auto-trading. The admin run stays canonical (signal statuses, buckets,
     * the public broadcast); this pass only writes subscriber trades and DMs
     * each subscriber their own bookings.
     *
     * Eligibility mirrors the admin run fail-closed: AI non-GO and price-guard
     * rejections block everyone. When the admin run produced a fill price it is
     * reused; when the admin skipped BEFORE the price fetch (their capital/
     * limits/duplicates), a fresh live price is fetched under the same ±drift
     * guard so subscribers aren't punished for the admin portfolio being full.
     */
    async executeForCommunity(todaySignals, market, adminOutcomes) {
        const empty = { users: 0, executed: 0, skipped: 0 };
        try {
            const adminEmail = process.env.ADMIN_EMAIL || 'ketanjoshisahs@gmail.com';
            const users = (await TradeDB.getAutoTradingUsers()).filter(u => u.email !== adminEmail);
            if (users.length === 0) return empty;

            console.log(`\n   👥 COMMUNITY PASS: ${users.length} subscriber(s) with auto-trading on`);

            const eligible = [];
            for (const signal of todaySignals) {
                const outcome = adminOutcomes.get(signal.id) || {};
                if (outcome.code === 'AI_GATE' || outcome.code === 'NO_LIVE_PRICE' || outcome.code === 'PRICE_DRIFT') {
                    continue; // fail-closed for everyone
                }
                let price = outcome.executionPrice || null;
                if (!price) {
                    const signalPrice = parseFloat(signal.entry_price);
                    const livePrice = await fetchLivePrice(signal.symbol);
                    if (!livePrice || livePrice <= 0) continue;
                    const drift = Math.abs(((livePrice - signalPrice) / signalPrice) * 100);
                    if (drift > MAX_ENTRY_DRIFT_PERCENT) continue;
                    price = livePrice;
                }
                eligible.push({ signal, price });
            }

            if (eligible.length === 0) {
                console.log(`   👥 No eligible signals for subscriber portfolios`);
                return { ...empty, users: users.length };
            }

            const results = { users: users.length, executed: 0, skipped: 0 };
            const bookedBySignal = new Map();
            for (const user of users) {
                const booked = [];
                for (const { signal, price } of eligible) {
                    let allocated = 0; // capital allocated for this booking and not yet held by a stored trade
                    try {
                        const validation = await CapitalManager.validateTradeEntry(market, signal.symbol, user.email);
                        if (!validation.valid) {
                            results.skipped++;
                            continue;
                        }
                        await TradeDB.allocateCapital(market, validation.tradeSize, user.email);
                        allocated = validation.tradeSize;

                        const entryDate = new Date();
                        const squareOffDate = new Date(entryDate);
                        squareOffDate.setDate(squareOffDate.getDate() + 30);
                        await TradeDB.insertTrade({
                            symbol: signal.symbol,
                            entryDate: entryDate,
                            entryPrice: price,
                            targetPrice: price * 1.08,
                            stopLossPercent: 5,
                            takeProfitPercent: 8,
                            squareOffDate: squareOffDate.toISOString().split('T')[0],
                            status: 'active',
                            notes: `Auto-executed at 1 PM ${market} time (subscriber portfolio) - Win Rate: ${parseFloat(signal.win_rate).toFixed(1)}%`,
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
                        }, user.email);

                        allocated = 0; // stored: the allocation belongs to the trade now
                        booked.push({ symbol: signal.symbol, size: validation.tradeSize, currency: validation.currency, price });
                        bookedBySignal.set(signal.id, (bookedBySignal.get(signal.id) || 0) + 1);
                        results.executed++;
                        console.log(`   👥 ✓ ${user.email}: ${signal.symbol} (${validation.tradeSize ? validation.tradeSize.toFixed(0) : '?'})`);
                    } catch (error) {
                        if (allocated) await releaseAllocation(market, allocated, user.email, signal.symbol);
                        results.skipped++;
                        console.error(`   👥 ✗ ${user.email}: ${signal.symbol} — ${error.message}`);
                    }
                }

                // The booking DM answers to the subscriber's Alerts page ("Trades
                // booked for you"). The trades themselves are booked either way.
                if (booked.length > 0 && user.telegram_chat_id) {
                    if (await AlertPolicy.ownerWantsAlert(() => TradeDB.getAlertPreferences(user.email), 'buy')) {
                        await this.sendSubscriberNotification(user.telegram_chat_id, market, booked);
                    } else {
                        console.log(`   👥 ${user.email} has booking alerts switched off — DM not sent`);
                    }
                }
            }

            // If subscribers took a signal the admin portfolio couldn't (full,
            // duplicate, out of capital), the feed should still say "Traded"
            for (const { signal } of eligible) {
                const outcome = adminOutcomes.get(signal.id) || {};
                if (!outcome.success && (bookedBySignal.get(signal.id) || 0) > 0) {
                    await TradeDB.updateSignalStatus(signal.id, 'added');
                }
            }

            console.log(`   👥 COMMUNITY PASS DONE: ${results.executed} trade(s) across ${users.length} subscriber(s)\n`);
            return results;
        } catch (error) {
            console.error(`   👥 Community pass failed: ${error.message}`);
            return empty;
        }
    }

    /**
     * DM one subscriber the trades just booked to THEIR portfolio
     */
    async sendSubscriberNotification(chatId, market, booked) {
        try {
            const { sendTelegramAlert } = require('../telegram/telegram-bot');
            const flag = market === 'India' ? '🇮🇳' : market === 'UK' ? '🇬🇧' : '🇺🇸';
            const symbols = { INR: '₹', GBP: '£', USD: '$' };
            let message = `${flag} *Your ${market} auto-trades — booked at 1 PM*\n\n`;
            booked.forEach(b => {
                const c = symbols[b.currency] || '';
                message += `✓ *${b.symbol}* — ${c}${Math.round(b.size).toLocaleString('en-GB')} @ ${c}${b.price.toFixed(2)}\n`;
            });
            message += `\nTarget +8%, stop −5%, 30-day max hold. They're on your Positions page.`;
            await sendTelegramAlert(chatId, { type: 'custom', message });
        } catch (error) {
            console.error(`   👥 Subscriber DM failed: ${error.message}`);
        }
    }

    /**
     * Send notification about execution (Telegram + Push)
     */
    async sendExecutionNotification(market, summary, results) {
        const flag = market === 'India' ? '🇮🇳' : market === 'UK' ? '🇬🇧' : '🇺🇸';

        // Build notification message
        let message = `${flag} *${market} Market - 1 PM Execution Complete*\n\n`;
        message += `📊 Total Signals: ${summary.total}\n`;
        message += `✓ Executed: ${summary.executed} trades\n`;

        if (summary.executed > 0) {
            message += `\n*Trades Added:*\n`;
            results.executed.forEach(r => {
                message += `✓ ${r.symbol} (${r.tradeSize.toFixed(0)})\n`;
            });
        }

        if (summary.aiRejected > 0) {
            message += `\n🤖 AI Gate blocked: ${summary.aiRejected}\n`;
            results.aiRejected.slice(0, 5).forEach(r => {
                message += `  • ${r.signal}: ${r.reason.substring(0, 60)}\n`;
            });
        }

        if (summary.priceSkipped > 0) {
            message += `\n⊘ Price guard skipped: ${summary.priceSkipped}\n`;
            results.priceSkipped.slice(0, 5).forEach(r => {
                message += `  • ${r.signal}: ${r.reason.substring(0, 70)}\n`;
            });
        }

        if (summary.duplicateSkipped > 0) {
            message += `\n♻ Already holding — skipped: ${summary.duplicateSkipped}\n`;
            results.duplicateSkipped.slice(0, 5).forEach(r => {
                message += `  • ${r.signal}\n`;
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

        if (summary.communityExecuted > 0) {
            message += `\n👥 Subscriber portfolios: ${summary.communityExecuted} trade${summary.communityExecuted === 1 ? '' : 's'} booked across ${summary.communityUsers} subscriber${summary.communityUsers === 1 ? '' : 's'}\n`;
        }

        message += `\n⏱ Duration: ${(summary.duration / 1000).toFixed(1)}s`;

        console.log(`   📤 [EXECUTOR] Sending execution notification for ${market} market...`);
        console.log(`   📋 [EXECUTOR] Notification details: ${summary.executed} trades executed, ${summary.skipped} skipped, ${summary.failed} failed`);

        // Send Telegram notification
        try {
            const telegramBot = require('../telegram/telegram-bot');

            if (telegramBot && typeof telegramBot.broadcastToSubscribers === 'function') {
                const executionResults = await telegramBot.broadcastToSubscribers({
                    type: 'custom',
                    message
                }, 'execution');

                const successCount = executionResults.filter(r => r.success).length;
                const failedCount = executionResults.filter(r => !r.success).length;

                console.log(`   ✅ [EXECUTOR] Telegram notification sent: ${successCount} success, ${failedCount} failed`);
            } else {
                console.log('   ⚠️ [EXECUTOR] Telegram not configured');
            }
        } catch (error) {
            console.error(`   ❌ [EXECUTOR] Telegram error: ${error.message}`);
        }

        // Send Push notifications
        try {
            const PushService = require('../push/push-service');
            const TradeDB = require('../../database-postgres');
            const pushService = new PushService(TradeDB);

            if (pushService.isConfigured) {
                const pushPayload = {
                    title: `${flag} ${market} Execution Complete`,
                    body: `${summary.executed} trades executed` +
                        (summary.aiRejected ? `, ${summary.aiRejected} AI-blocked` : '') +
                        (summary.priceSkipped ? `, ${summary.priceSkipped} price-guarded` : '') +
                        `, ${summary.skipped} skipped`,
                    icon: '/images/brand/app-icon.png',
                    badge: '/images/brand/app-icon.png',
                    tag: `execution-${market}-${Date.now()}`,
                    url: '/account.html',
                    requireInteraction: summary.executed > 0
                };

                const pushResult = await pushService.broadcast(pushPayload);
                console.log(`   📱 [EXECUTOR] Push notification sent: ${pushResult.sent} success, ${pushResult.failed} failed`);
            } else {
                console.log('   ⚠️ [EXECUTOR] Push service not configured');
            }
        } catch (error) {
            console.error(`   ❌ [EXECUTOR] Push notification error: ${error.message}`);
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
