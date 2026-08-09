/**
 * Portfolio Simulator
 * Simulates historical portfolio performance using high conviction DTI signals
 * with realistic position management and FIFO entry logic
 */

const PortfolioSimulator = (function() {
    'use strict';

    // Configuration
    const CONFIG = {
        // Position limits
        MAX_POSITIONS_TOTAL: 30,
        MAX_POSITIONS_PER_MARKET: 10,

        // Default investment amounts (for display)
        INITIAL_INVESTMENTS: {
            'INR': 1000000,  // 10 lakhs
            'GBP': 10000,    // 10k
            'USD': 15000     // 15k
        },

        // Trade sizes per position
        TRADE_SIZES: {
            'India': { currency: 'INR', amount: 50000 },  // 50k per trade
            'UK': { currency: 'GBP', amount: 400 },       // 400 per trade
            'US': { currency: 'USD', amount: 500 }        // 500 per trade
        },

        // High conviction threshold
        HIGH_CONVICTION_THRESHOLD: 75,

        // DTI parameters
        DTI_PARAMS: {
            r: 14,
            s: 10,
            u: 5,
            entryThreshold: 0,
            takeProfitPercent: 8,
            stopLossPercent: 5,
            maxHoldingDays: 30
        },

        // Data buffer (months)
        DATA_BUFFER: {
            warmup: 6,
            safety: 6
        },

        // Exchange rates
        EXCHANGE_RATES: {
            GBP_TO_INR: 105.0,
            GBP_TO_USD: 1.27,
            USD_TO_GBP: 0.79,
            USD_TO_INR: 83.0,
            INR_TO_GBP: 0.0095,
            INR_TO_USD: 0.012
        }
    };

    /**
     * Main simulation function
     * @param {string} startDate - Simulation start date
     * @param {string} displayCurrency - Currency for display (GBP, INR, USD)
     * @param {function} progressCallback - Optional callback for progress updates
     */
    async function runSimulation(startDate, displayCurrency = 'GBP', progressCallback = null) {
        try {
            // Layer 5: Initialize statistics tracking
            const stats = {
                staleDataStocks: 0,
                openTradesIncluded: 0,
                fuzzyMatches: 0,
                forceClosedTotal: 0,
                forceClosedWithRealPrice: 0,
                forceClosedWithFallback: 0,
                unmatchedPositions: []
            };

            // Report initial progress
            if (progressCallback) progressCallback({ stage: 'init', message: 'Initializing simulation...' });

            // 1. Calculate date ranges
            const dates = calculateDateRanges(startDate);

            // 2-5. One streaming pass: each stock is fetched, backtested for
            // its win rate and (if strong) mined for simulation signals, then
            // its price arrays are released. The old three-stage pipeline held
            // every stock's full 6-year OHLCV in memory at once (~1GB), which
            // iOS Safari kills the tab for.
            if (progressCallback) progressCallback({ stage: 'fetch', message: 'Checking stocks...', current: 0, total: 0 });
            const stream = await streamStocksAndSignals(dates, progressCallback);
            const simulationSignals = stream.signals;
            stats.staleDataStocks = stream.totals.stale;

            // 6. Run day-by-day portfolio simulation
            if (progressCallback) progressCallback({ stage: 'simulate', message: 'Simulating portfolio performance...' });
            const portfolio = await simulatePortfolio(simulationSignals, startDate, displayCurrency, stats);

            // 7. Report completion
            if (progressCallback) progressCallback({ stage: 'complete', message: 'Simulation complete!' });

            // 8. Return complete simulation results with metadata
            return {
                success: true,
                portfolio: portfolio,
                config: {
                    startDate: startDate,
                    displayCurrency: displayCurrency,
                    initialValue: calculateInitialValue(displayCurrency),
                    tradeSizes: CONFIG.TRADE_SIZES
                },
                stats: stats,  // Include statistics in results
                metadata: {
                    // Date ranges
                    dates: {
                        simulationStart: dates.simulationStart,
                        simulationEnd: dates.simulationEnd,
                        dataStart: dates.dataStart,
                        bufferEnd: dates.bufferEnd
                    },
                    // Processing stats
                    processing: {
                        totalStocksProcessed: stream.totals.processed,
                        stocksWithWinRates: stream.totals.withWinRates,
                        highConvictionStocks: stream.totals.highConviction,
                        processingMode: 'streaming',
                        concurrencyLevels: {
                            fetch: stream.totals.concurrency,
                            backtest: stream.totals.concurrency,
                            signals: stream.totals.concurrency
                        }
                    },
                    // Signal stats
                    signals: {
                        totalSignalsGenerated: simulationSignals.length,
                        openTradesIncluded: stats.openTradesIncluded,
                        fuzzyMatches: stats.fuzzyMatches,
                        unmatchedPositions: stats.unmatchedPositions.length,
                        unmatchedSymbols: stats.unmatchedPositions.join(', ')
                    },
                    // Data quality
                    dataQuality: {
                        staleDataStocks: stats.staleDataStocks,
                        staleDataPercent: ((stats.staleDataStocks / (stream.totals.processed || 1)) * 100).toFixed(1)
                    },
                    // Force-close stats
                    forceClose: {
                        total: stats.forceClosedTotal,
                        withRealPrice: stats.forceClosedWithRealPrice,
                        withRealPricePercent: stats.forceClosedTotal > 0 ? ((stats.forceClosedWithRealPrice / stats.forceClosedTotal) * 100).toFixed(1) : '0',
                        withFallback: stats.forceClosedWithFallback,
                        withFallbackPercent: stats.forceClosedTotal > 0 ? ((stats.forceClosedWithFallback / stats.forceClosedTotal) * 100).toFixed(1) : '0'
                    }
                }
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Process items concurrently with a worker pool pattern
     * Maintains constant concurrency - starts new work as soon as any task finishes
     * @param {Array} items - Items to process
     * @param {number} concurrency - Number of items to process simultaneously
     * @param {function} processor - Async function to process each item
     */
    async function processConcurrently(items, concurrency, processor) {
        const results = [];
        let index = 0;

        // Create worker pool
        const workers = Array(Math.min(concurrency, items.length)).fill(null).map(async () => {
            while (index < items.length) {
                const currentIndex = index++;
                const item = items[currentIndex];
                try {
                    const result = await processor(item, currentIndex);
                    results.push(result);
                } catch (error) {
                    // Continue processing even if individual item fails
                }
            }
        });

        // Wait for all workers to complete
        await Promise.all(workers);
        return results;
    }

    /**
     * Calculate date ranges for backtest and simulation
     * Data fetch: 5 years before simulation start
     * Buffer period: First 6 months of data (for DTI warmup only, no signals counted)
     * Historical signals: From 6 months after data start to simulation start (4.5 years)
     * Simulation period: simulation start to today
     */
    function calculateDateRanges(simulationStart) {
        const simStart = new Date(simulationStart);

        // Data start: 5 years before simulation start
        const dataStart = new Date(simStart);
        dataStart.setFullYear(dataStart.getFullYear() - 5);

        // Buffer end: 6 months after data start (DTI warmup period)
        const bufferEnd = new Date(dataStart);
        bufferEnd.setMonth(bufferEnd.getMonth() + 6);

        return {
            dataStart: dataStart.toISOString().split('T')[0],          // Data fetch start (5 years before sim)
            bufferEnd: bufferEnd.toISOString().split('T')[0],          // End of buffer period (6 months after data start)
            simulationStart: simStart.toISOString().split('T')[0],     // Simulation start (user selected)
            simulationEnd: new Date().toISOString().split('T')[0]      // Today
        };
    }

    /**
     * Fetch all stocks data from all markets
     * Uses comprehensive stock list from StockData module (3,605 unique stocks)
     * Uses concurrent processing (worker pool) - starts new stocks as soon as any finish
     */
    /**
     * Devices where holding lots of price data or fetching wide kills the
     * tab — iPhones and iPads (Safari's per-tab memory budget) and anything
     * reporting small RAM.
     */
    function isConstrainedDevice() {
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS masquerades as a Mac
        const smallMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4;
        return iOS || smallMemory;
    }

    /**
     * The whole scan as one streaming pass. Per stock: fetch → historical
     * backtest for the win rate → (only if strong) full-range backtest for
     * simulation-period signals → the stock's arrays go out of scope.
     * Peak memory is one stock's data per worker, not the whole market.
     */
    async function streamStocksAndSignals(dates, progressCallback) {
        // Use StockData module (SINGLE SOURCE OF TRUTH)
        const stockLists = window.StockData.getStockLists();

        // Combine ALL stocks from ALL markets (deduplicated)
        // Note: allIndian contains complete NSE list (nifty50/niftyNext50/niftyMidcap150 are aliases)
        const allStockDefinitions = [
            ...stockLists.allIndian,
            ...stockLists.ftse100,
            ...stockLists.ftse250,
            ...stockLists.usStocks
        ];

        const total = allStockDefinitions.length;
        const endDate = new Date().toISOString().split('T')[0];
        const CONCURRENCY = isConstrainedDevice() ? 12 : 40;

        const signals = [];
        const totals = { processed: 0, stale: 0, withWinRates: 0, highConviction: 0, concurrency: CONCURRENCY };
        const simStart = new Date(dates.simulationStart);
        const bufferEnd = new Date(dates.bufferEnd);
        let completed = 0;

        await processConcurrently(allStockDefinitions, CONCURRENCY, async (stockObj) => {
            const market = getMarketForSymbol(stockObj.symbol);

            try {
                const stockData = await fetchStockData(stockObj.symbol, dates.dataStart, endDate);
                if (stockData && stockData.dates && stockData.dates.length > 200) {
                    totals.processed++;
                    if (stockData.isStale) totals.stale++;

                    // Win rate over the historical window only
                    const historicalData = filterDataByDateRange(stockData, dates.dataStart, dates.simulationStart);
                    if (historicalData && historicalData.dates.length >= 200) {
                        const backtest = window.BacktestCalculator.runBacktest(historicalData, CONFIG.DTI_PARAMS);

                        if (backtest && backtest.trades) {
                            // Count only signals AFTER buffer period (6 months)
                            const historicalSignals = backtest.trades.filter(trade => {
                                const entryDate = new Date(trade.entryDate);
                                return entryDate >= bufferEnd && !trade.isOpen;
                            });

                            // Only strong records with at least 5 historical signals go on
                            if (historicalSignals.length >= 5) {
                                const wins = historicalSignals.filter(t => t.isWin).length;
                                const winRate = (wins / historicalSignals.length) * 100;
                                totals.withWinRates++;

                                if (winRate > CONFIG.HIGH_CONVICTION_THRESHOLD) {
                                    totals.highConviction++;

                                    // Full-range backtest to get simulation-period signals
                                    const fullBacktest = window.BacktestCalculator.runBacktest(stockData, CONFIG.DTI_PARAMS);
                                    if (fullBacktest && fullBacktest.trades) {
                                        for (const trade of fullBacktest.trades) {
                                            const entryDate = new Date(trade.entryDate);

                                            // Layer 2: Include completed trades OR open trades that entered during simulation
                                            if (entryDate >= simStart && (!trade.isOpen || shouldIncludeOpenTrade(trade, dates))) {
                                                signals.push({
                                                    symbol: stockObj.symbol,
                                                    market: market,
                                                    entryDate: trade.entryDate,
                                                    entryPrice: trade.entryPrice,
                                                    exitDate: trade.exitDate,
                                                    exitPrice: trade.exitPrice,
                                                    plPercent: trade.plPercent,
                                                    holdingDays: trade.holdingDays,
                                                    exitReason: trade.exitReason,
                                                    winRate: winRate,
                                                    historicalSignalCount: historicalSignals.length,
                                                    isWin: trade.isWin,
                                                    isOpen: trade.isOpen || false,
                                                    // DTI values at entry
                                                    prevDTI: trade.prevDTI,
                                                    entryDTI: trade.entryDTI,
                                                    prev7DayDTI: trade.prev7DayDTI,
                                                    entry7DayDTI: trade.entry7DayDTI
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                // Silently skip failed stocks
            }

            // Report progress after each completion
            completed++;
            if (progressCallback) {
                progressCallback({
                    stage: 'fetch',
                    message: `Checking stocks (${CONCURRENCY} at a time)...`,
                    current: completed,
                    total: total,
                    percent: Math.round((completed / total) * 100)
                });
            }
        });

        // Sort by entry date (FIFO)
        signals.sort((a, b) => new Date(a.entryDate) - new Date(b.entryDate));
        return { signals, totals };
    }

    /**
     * Get market from symbol suffix
     */
    function getMarketForSymbol(symbol) {
        if (symbol.endsWith('.NS') || symbol.endsWith('.BO')) return 'India';
        if (symbol.endsWith('.L')) return 'UK';
        return 'US';
    }

    /**
     * Fetch individual stock data
     */
    async function fetchStockData(symbol, startDate, endDate) {
        const start = Math.floor(new Date(startDate).getTime() / 1000);
        const end = Math.floor(new Date(endDate).getTime() / 1000);

        const url = `/yahoo/history?symbol=${symbol}&period1=${start}&period2=${end}&interval=1d`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const csvText = await response.text();
        return parseCSVData(csvText, symbol);
    }

    /**
     * Parse CSV data into stock data object
     * Layer 1: Validates data freshness to ensure quality
     */
    function parseCSVData(csvText, symbol) {
        const rows = csvText.trim().split('\n');
        if (rows.length < 2) return null;

        const data = {
            symbol: symbol,
            dates: [],
            open: [],
            high: [],
            low: [],
            close: [],
            volume: []
        };

        for (let i = 1; i < rows.length; i++) {
            const values = rows[i].split(',');
            if (values.length >= 6) {
                data.dates.push(values[0]);
                data.open.push(parseFloat(values[1]));
                data.high.push(parseFloat(values[2]));
                data.low.push(parseFloat(values[3]));
                data.close.push(parseFloat(values[4]));
                data.volume.push(parseFloat(values[5]));
            }
        }

        // Layer 1: Validate data freshness
        if (data.dates.length > 0) {
            const lastDate = new Date(data.dates[data.dates.length - 1]);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            lastDate.setHours(0, 0, 0, 0);

            const daysSinceLastData = Math.floor((today - lastDate) / (24 * 60 * 60 * 1000));

            // Mark data as stale if > 7 days old
            if (daysSinceLastData > 7) {
                data.isStale = true;
                data.daysSinceLastData = daysSinceLastData;
            } else {
                data.isStale = false;
                data.daysSinceLastData = daysSinceLastData;
            }
        }

        return data;
    }

    /**
     * Layer 2: Check if an open trade should be included as a signal
     * Include open trades that entered during simulation period - they need proper exit handling
     */
    function shouldIncludeOpenTrade(trade, dates) {
        if (!trade.isOpen) return false;

        const entryDate = new Date(trade.entryDate);
        const simStart = new Date(dates.simulationStart);

        // Include open trades that entered during simulation period
        // These likely have incomplete data but represent real entry opportunities
        return entryDate >= simStart;
    }

    /**
     * Filter stock data by date range
     */
    function filterDataByDateRange(data, startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        const filtered = {
            symbol: data.symbol,
            dates: [],
            open: [],
            high: [],
            low: [],
            close: [],
            volume: []
        };

        for (let i = 0; i < data.dates.length; i++) {
            const date = new Date(data.dates[i]);
            if (date >= start && date <= end) {
                filtered.dates.push(data.dates[i]);
                filtered.open.push(data.open[i]);
                filtered.high.push(data.high[i]);
                filtered.low.push(data.low[i]);
                filtered.close.push(data.close[i]);
                filtered.volume.push(data.volume[i]);
            }
        }

        return filtered;
    }

    /**
     * Main portfolio simulation (day by day)
     * Layer 5: Tracks statistics during simulation
     */
    async function simulatePortfolio(signals, startDate, displayCurrency, stats = null) {
        const portfolio = {
            cash: 0, // Track cash (not used for trades, just for display)
            positions: [],
            closedTrades: [],
            dailyValues: [],
            currency: displayCurrency,
            // Capital tracking per market for dynamic position sizing
            capitalByMarket: {
                'India': {
                    initial: CONFIG.INITIAL_INVESTMENTS['INR'],
                    realized: 0,
                    currency: 'INR'
                },
                'UK': {
                    initial: CONFIG.INITIAL_INVESTMENTS['GBP'],
                    realized: 0,
                    currency: 'GBP'
                },
                'US': {
                    initial: CONFIG.INITIAL_INVESTMENTS['USD'],
                    realized: 0,
                    currency: 'USD'
                }
            }
        };

        // Group signals by entry date for efficient processing
        const signalsByDate = groupSignalsByDate(signals);

        // Get date range
        const start = new Date(startDate);
        const today = new Date();

        // Simulate day by day
        for (let date = new Date(start); date <= today; date.setDate(date.getDate() + 1)) {
            const dateStr = date.toISOString().split('T')[0];

            // Skip weekends
            if (date.getDay() === 0 || date.getDay() === 6) continue;

            // 1. Check exit conditions for active positions (Layer 4: async for price fetching)
            await checkExitConditions(portfolio, dateStr, signals, stats);

            // 2. Process new entry signals for this date
            const todaySignals = signalsByDate[dateStr] || [];
            processEntrySignals(portfolio, todaySignals, dateStr);

            // 3. Calculate and store daily portfolio value
            const portfolioValue = calculatePortfolioValue(portfolio, displayCurrency);
            portfolio.dailyValues.push({
                date: dateStr,
                value: portfolioValue,
                activePositions: portfolio.positions.length,
                positionsByMarket: countPositionsByMarket(portfolio.positions)
            });
        }

        return portfolio;
    }

    /**
     * Group signals by entry date
     */
    function groupSignalsByDate(signals) {
        const grouped = {};
        for (const signal of signals) {
            const date = signal.entryDate;
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(signal);
        }
        return grouped;
    }

    /**
     * Layer 4: Fetch actual price for a stock at a specific date
     * Used for calculating real P/L when force-closing positions without signals
     */
    async function fetchPriceAtDate(symbol, targetDate) {
        try {
            // Fetch data for a small range around the target date (7 days before and after)
            const target = new Date(targetDate);
            const startDate = new Date(target);
            startDate.setDate(startDate.getDate() - 7);
            const endDate = new Date(target);
            endDate.setDate(endDate.getDate() + 7);

            const start = Math.floor(startDate.getTime() / 1000);
            const end = Math.floor(endDate.getTime() / 1000);

            const url = `/yahoo/history?symbol=${symbol}&period1=${start}&period2=${end}&interval=1d`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const csvText = await response.text();
            const rows = csvText.trim().split('\n');

            if (rows.length < 2) {
                throw new Error('No data returned');
            }

            // Find the closest date to target
            let closestPrice = null;
            let closestDateDiff = Infinity;

            for (let i = 1; i < rows.length; i++) {
                const values = rows[i].split(',');
                if (values.length >= 5) {
                    const rowDate = new Date(values[0]);
                    const dateDiff = Math.abs((rowDate - target) / (24 * 60 * 60 * 1000));

                    if (dateDiff < closestDateDiff) {
                        const price = parseFloat(values[4]); // close price
                        // Only use valid prices (reject NaN, null, or non-positive values)
                        if (!isNaN(price) && price > 0) {
                            closestDateDiff = dateDiff;
                            closestPrice = price;
                        }
                    }
                }
            }

            if (closestPrice === null || isNaN(closestPrice)) {
                throw new Error('No valid price found');
            }

            return closestPrice;

        } catch (error) {
            throw error;
        }
    }

    /**
     * Layer 3: Find matching signal for a position with fuzzy fallback
     * Primary: Exact symbol + entry date match
     * Fallback: Fuzzy match (symbol + entry date ±3 days + price ±2%)
     */
    function findMatchingSignal(position, allSignals) {
        // Try exact match first (existing logic)
        let signal = allSignals.find(s =>
            s.symbol === position.symbol &&
            s.entryDate === position.entryDate
        );

        if (signal) {
            return { signal, matchType: 'exact' };
        }

        // Fallback: Fuzzy match for cases where dates/prices differ slightly
        signal = allSignals.find(s => {
            if (s.symbol !== position.symbol) return false;

            const posEntryDate = new Date(position.entryDate);
            const sigEntryDate = new Date(s.entryDate);
            const daysDiff = Math.abs((posEntryDate - sigEntryDate) / (24 * 60 * 60 * 1000));

            const priceDiff = Math.abs((s.entryPrice - position.entryPrice) / position.entryPrice) * 100;

            // Match if within ±3 days AND ±2% price
            return daysDiff <= 3 && priceDiff <= 2;
        });

        if (signal) {
            return { signal, matchType: 'fuzzy' };
        }

        return { signal: null, matchType: 'none' };
    }

    /**
     * Check exit conditions for active positions
     * Layer 3: Uses fuzzy matching as fallback
     * Layer 4: Fetches real prices for force-close (async)
     * Layer 5: Tracks statistics
     */
    async function checkExitConditions(portfolio, currentDate, allSignals, stats = null) {
        const toRemove = [];

        for (let i = 0; i < portfolio.positions.length; i++) {
            const position = portfolio.positions[i];

            // Calculate holding days (safety check)
            const entryDate = new Date(position.entryDate);
            const current = new Date(currentDate);
            const holdingDays = Math.floor((current - entryDate) / (24 * 60 * 60 * 1000));

            // SAFETY CHECK: Force-close if held >= 30 days
            // Layer 4: Fetch REAL price to calculate actual P/L (not 0%)
            if (holdingDays >= CONFIG.DTI_PARAMS.maxHoldingDays) {
                let exitPrice = position.entryPrice;  // Fallback: assume breakeven
                let plPercent = 0;                     // Fallback: assume no gain/loss
                let exitReason = 'Max Days (Force Close - No Price)';

                try {
                    // Try to fetch actual price at exit date
                    exitPrice = await fetchPriceAtDate(position.symbol, currentDate);
                    plPercent = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;
                    exitReason = 'Max Days (Calculated)';

                    // Layer 5: Track successful real price fetch
                    if (stats) stats.forceClosedWithRealPrice++;

                } catch (error) {
                    // Keep default values (0% P/L)

                    // Layer 5: Track fallback to 0%
                    if (stats) stats.forceClosedWithFallback++;
                }

                // Layer 5: Track total force-closes
                if (stats) stats.forceClosedTotal++;

                const closedTrade = {
                    ...position,
                    exitDate: currentDate,
                    exitPrice: exitPrice,
                    plPercent: plPercent,
                    exitReason: exitReason,
                    holdingDays: holdingDays,
                    // DTI values at entry (if available)
                    prevDTI: position.prevDTI,
                    entryDTI: position.entryDTI,
                    prev7DayDTI: position.prev7DayDTI,
                    entry7DayDTI: position.entry7DayDTI,
                    historicalSignalCount: position.historicalSignalCount
                };

                portfolio.closedTrades.push(closedTrade);

                // Update capital tracking with REAL P/L (not 0%)
                if (portfolio.capitalByMarket && portfolio.capitalByMarket[position.market]) {
                    const pl = (position.tradeSize * plPercent) / 100;
                    portfolio.capitalByMarket[position.market].realized += pl;
                }

                toRemove.push(i);
                continue; // Skip normal exit check
            }

            // Normal exit: Find matching signal with exit data (Layer 3: fuzzy matching)
            const matchResult = findMatchingSignal(position, allSignals);

            if (matchResult.signal) {
                const signal = matchResult.signal;

                // Layer 5: Track fuzzy matches
                if (matchResult.matchType === 'fuzzy' && stats) {
                    stats.fuzzyMatches++;
                }

                // CRITICAL: Skip signals marked as open - they shouldn't trigger position closes
                // Open trades have exitDate/exitPrice set but are not actually complete
                if (signal.isOpen === true) {
                    continue; // Don't close this position based on an open signal
                }

                // Check if exit date has passed (handles weekends/holidays)
                const signalExitDate = new Date(signal.exitDate);
                const current = new Date(currentDate);

                // Close if exit date has passed or is today
                // This handles weekend/holiday exits that simulation loop skipped
                if (signalExitDate <= current) {
                    // Close position with actual P/L from signal
                    const closedTrade = {
                        ...position,
                        exitDate: signal.exitDate,
                        exitPrice: signal.exitPrice,
                        plPercent: signal.plPercent,
                        exitReason: signal.exitReason,
                        holdingDays: signal.holdingDays,
                        // DTI values at entry
                        prevDTI: signal.prevDTI,
                        entryDTI: signal.entryDTI,
                        prev7DayDTI: signal.prev7DayDTI,
                        entry7DayDTI: signal.entry7DayDTI,
                        historicalSignalCount: signal.historicalSignalCount,
                        // Preserve isOpen flag for defensive filtering
                        isOpen: signal.isOpen || false
                    };

                    portfolio.closedTrades.push(closedTrade);

                    // Update capital tracking with REAL P/L (not 0%)
                    if (portfolio.capitalByMarket && portfolio.capitalByMarket[position.market]) {
                        const pl = (position.tradeSize * signal.plPercent) / 100;
                        portfolio.capitalByMarket[position.market].realized += pl;
                    }

                    toRemove.push(i);
                }
            } else {
                // Layer 3 & 5: Track when no matching signal found
                if (holdingDays >= 20) {  // Only track if getting close to force-close
                    // Track unmatched position (avoid duplicates)
                    if (stats && !stats.unmatchedPositions.includes(position.symbol)) {
                        stats.unmatchedPositions.push(position.symbol);
                    }
                }
            }
        }

        // Remove closed positions (reverse order to maintain indices)
        for (let i = toRemove.length - 1; i >= 0; i--) {
            portfolio.positions.splice(toRemove[i], 1);
        }
    }

    /**
     * Calculate dynamic trade size based on accumulated capital
     * Trade size grows with profits (compounding), shrinks with losses
     */
    function calculateDynamicTradeSize(portfolio, market) {
        if (!portfolio.capitalByMarket || !portfolio.capitalByMarket[market]) {
            // Fallback to static sizing if capital tracking not available
            return CONFIG.TRADE_SIZES[market].amount;
        }

        const marketCap = portfolio.capitalByMarket[market];
        const totalCapital = marketCap.initial + marketCap.realized;

        // Divide by max positions per market for equal allocation
        // This ensures we can always fill all 10 positions per market
        const dynamicSize = totalCapital / CONFIG.MAX_POSITIONS_PER_MARKET;

        // Safety floor: Don't go below 10% of initial per-trade amount
        const minSize = CONFIG.TRADE_SIZES[market].amount * 0.1;

        return Math.max(dynamicSize, minSize);
    }

    /**
     * Process new entry signals
     */
    function processEntrySignals(portfolio, signals, date) {
        // Count current positions per market
        const positionCounts = countPositionsByMarket(portfolio.positions);

        // Track symbols already in portfolio to prevent duplicates
        const activeSymbols = new Set(portfolio.positions.map(p => p.symbol));

        // Process signals in order (FIFO)
        for (const signal of signals) {
            const market = signal.market;

            // Check position limits
            if (portfolio.positions.length >= CONFIG.MAX_POSITIONS_TOTAL) {
                break; // Portfolio full
            }

            if (positionCounts[market] >= CONFIG.MAX_POSITIONS_PER_MARKET) {
                continue; // Market limit reached
            }

            // Prevent duplicate positions in the same stock
            if (activeSymbols.has(signal.symbol)) {
                continue; // Skip - already have a position in this stock
            }

            // Calculate dynamic trade size (grows with profits, shrinks with losses)
            const dynamicSize = calculateDynamicTradeSize(portfolio, market);

            // Enter position
            const position = {
                symbol: signal.symbol,
                market: market,
                entryDate: date,
                entryPrice: signal.entryPrice,
                tradeSize: dynamicSize,
                currency: CONFIG.TRADE_SIZES[market].currency,
                winRate: signal.winRate,
                // Copy DTI values and historical signal count from signal (for force-close scenarios)
                prevDTI: signal.prevDTI,
                entryDTI: signal.entryDTI,
                prev7DayDTI: signal.prev7DayDTI,
                entry7DayDTI: signal.entry7DayDTI,
                historicalSignalCount: signal.historicalSignalCount
            };

            portfolio.positions.push(position);
            positionCounts[market]++;
            activeSymbols.add(signal.symbol); // Track this symbol
        }
    }

    /**
     * Count positions by market
     */
    function countPositionsByMarket(positions) {
        const counts = {
            'India': 0,
            'UK': 0,
            'US': 0
        };

        for (const position of positions) {
            counts[position.market]++;
        }

        return counts;
    }

    /**
     * Calculate current portfolio value
     * Portfolio value = Initial Capital + Realized P/L from closed trades
     * Active positions are valued at cost (capital allocated)
     */
    function calculatePortfolioValue(portfolio, displayCurrency) {
        // Start with initial capital
        const initialCapital = calculateInitialValue(displayCurrency);
        let totalValue = initialCapital;

        // Add closed trades P/L (realized gains/losses)
        for (const trade of portfolio.closedTrades) {
            const pl = (trade.tradeSize * trade.plPercent) / 100;
            const convertedPL = convertCurrency(
                pl,
                trade.currency,
                displayCurrency
            );
            totalValue += convertedPL;
        }

        return totalValue;
    }

    /**
     * Convert currency
     */
    function convertCurrency(amount, fromCurrency, toCurrency) {
        if (fromCurrency === toCurrency) return amount;

        const rates = CONFIG.EXCHANGE_RATES;

        if (fromCurrency === 'GBP' && toCurrency === 'INR') return amount * rates.GBP_TO_INR;
        if (fromCurrency === 'GBP' && toCurrency === 'USD') return amount * rates.GBP_TO_USD;
        if (fromCurrency === 'USD' && toCurrency === 'GBP') return amount * rates.USD_TO_GBP;
        if (fromCurrency === 'USD' && toCurrency === 'INR') return amount * rates.USD_TO_INR;
        if (fromCurrency === 'INR' && toCurrency === 'GBP') return amount * rates.INR_TO_GBP;
        if (fromCurrency === 'INR' && toCurrency === 'USD') return amount * rates.INR_TO_USD;

        return amount;
    }

    /**
     * Calculate initial portfolio value for selected display currency
     * Returns the initial capital for that currency's market only
     */
    function calculateInitialValue(displayCurrency) {
        return CONFIG.INITIAL_INVESTMENTS[displayCurrency] || 0;
    }

    /**
     * Get currency symbol
     */
    function getCurrencySymbol(currency) {
        const symbols = {
            'GBP': '£',
            'USD': '$',
            'INR': '₹'
        };
        return symbols[currency] || '';
    }

    // Public API
    return {
        runSimulation,
        getCurrencySymbol,
        CONFIG
    };
})();

// Make available globally
window.PortfolioSimulator = PortfolioSimulator;
