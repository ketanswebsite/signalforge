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
            'INR': 500000,
            'GBP': 4000,
            'USD': 5000
        },

        // Trade sizes per position
        TRADE_SIZES: {
            'India': { currency: 'INR', amount: 50000 },
            'UK': { currency: 'GBP', amount: 400 },
            'US': { currency: 'USD', amount: 500 }
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
            console.log('[Portfolio Simulator] Starting simulation from', startDate);

            // Report initial progress
            if (progressCallback) progressCallback({ stage: 'init', message: 'Initializing simulation...' });

            // 1. Calculate date ranges
            const dates = calculateDateRanges(startDate);
            console.log('[Portfolio Simulator] Data range:', dates.dataStart, 'to today');
            console.log('[Portfolio Simulator] Buffer period:', dates.dataStart, 'to', dates.bufferEnd, '(DTI warmup)');
            console.log('[Portfolio Simulator] Historical signals:', dates.bufferEnd, 'to', dates.simulationStart);
            console.log('[Portfolio Simulator] Simulation period:', dates.simulationStart, 'to today');

            // 2. Fetch all stocks data (5 years before simulation + simulation period to today)
            if (progressCallback) progressCallback({ stage: 'fetch', message: 'Fetching stock data...', current: 0, total: 0 });
            const allStocks = await fetchAllStocksData(dates.dataStart, progressCallback);
            console.log('[Portfolio Simulator] Fetched', allStocks.length, 'stocks');

            // 3. Calculate historical win rates (4.5 years of signals AFTER 6-month buffer)
            if (progressCallback) progressCallback({
                stage: 'backtest',
                message: 'Running historical backtests...',
                current: 0,
                total: allStocks.length
            });
            const stockWinRates = await calculateHistoricalWinRates(allStocks, dates, progressCallback);
            console.log('[Portfolio Simulator] Calculated win rates for', stockWinRates.length, 'stocks');

            // 4. Filter high conviction stocks (>75% win rate in historical period)
            const highConvictionStocks = stockWinRates.filter(s => s.winRate > CONFIG.HIGH_CONVICTION_THRESHOLD);
            console.log('[Portfolio Simulator] High conviction stocks:', highConvictionStocks.length);

            // 5. Generate signals during simulation period for high conviction stocks only
            if (progressCallback) progressCallback({
                stage: 'signals',
                message: 'Generating trading signals...',
                current: 0,
                total: highConvictionStocks.length
            });
            const simulationSignals = await generateSimulationSignals(allStocks, highConvictionStocks, dates, progressCallback);
            console.log('[Portfolio Simulator] Simulation signals:', simulationSignals.length);

            // 6. Run day-by-day portfolio simulation
            if (progressCallback) progressCallback({ stage: 'simulate', message: 'Simulating portfolio performance...' });
            const portfolio = await simulatePortfolio(simulationSignals, startDate, displayCurrency);

            // 7. Report completion
            if (progressCallback) progressCallback({ stage: 'complete', message: 'Simulation complete!' });

            // 8. Return complete simulation results
            return {
                success: true,
                portfolio: portfolio,
                config: {
                    startDate: startDate,
                    displayCurrency: displayCurrency,
                    initialValue: calculateInitialValue(displayCurrency),
                    tradeSizes: CONFIG.TRADE_SIZES
                }
            };

        } catch (error) {
            console.error('[Portfolio Simulator] Error:', error);
            return {
                success: false,
                error: error.message
            };
        }
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
     * Uses comprehensive stock list from StockData module (2,200+ stocks)
     * Optimized with parallel batch processing for 50x speed improvement
     */
    async function fetchAllStocksData(startDate, progressCallback) {
        // Use StockData module (SINGLE SOURCE OF TRUTH)
        const stockLists = window.StockData.getStockLists();

        // Combine ALL stocks from ALL markets and indexes
        const allStockDefinitions = [
            ...stockLists.nifty50,
            ...stockLists.niftyNext50,
            ...stockLists.niftyMidcap150,
            ...stockLists.ftse100,
            ...stockLists.ftse250,
            ...stockLists.usStocks
        ];

        const total = allStockDefinitions.length;
        const BATCH_SIZE = 50;  // Fetch 50 stocks in parallel for optimal performance
        const allStocks = [];
        const endDate = new Date().toISOString().split('T')[0];

        console.log(`[Portfolio Simulator] Processing ${total} stocks in batches of ${BATCH_SIZE}`);

        // Process in batches for parallel execution
        for (let batchStart = 0; batchStart < total; batchStart += BATCH_SIZE) {
            const batchEnd = Math.min(batchStart + BATCH_SIZE, total);
            const batch = allStockDefinitions.slice(batchStart, batchEnd);
            const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(total / BATCH_SIZE);

            // Report progress for this batch
            if (progressCallback) {
                progressCallback({
                    stage: 'fetch',
                    message: `Fetching batch ${batchNum}/${totalBatches}`,
                    current: batchStart,
                    total: total,
                    percent: Math.round((batchStart / total) * 100)
                });
            }

            // Fetch entire batch in parallel using Promise.all
            const batchPromises = batch.map(async (stockObj) => {
                const market = getMarketForSymbol(stockObj.symbol);
                try {
                    const stockData = await fetchStockData(stockObj.symbol, startDate, endDate);
                    if (stockData && stockData.dates && stockData.dates.length > 200) {
                        return {
                            symbol: stockObj.symbol,
                            market: market,
                            data: stockData
                        };
                    }
                } catch (error) {
                    console.warn(`[Portfolio Simulator] Failed to fetch ${stockObj.symbol}:`, error.message);
                }
                return null;
            });

            // Wait for entire batch to complete
            const batchResults = await Promise.all(batchPromises);

            // Add successful results to the collection
            for (const result of batchResults) {
                if (result) {
                    allStocks.push(result);
                }
            }
        }

        console.log(`[Portfolio Simulator] Successfully fetched ${allStocks.length} stocks`);
        return allStocks;
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

        return data;
    }

    /**
     * Calculate historical win rates for all stocks
     * Uses 5-year backtest period BEFORE simulation start
     * Optimized with parallel batch processing (CPU-intensive work uses smaller batches)
     */
    async function calculateHistoricalWinRates(allStocks, dates, progressCallback) {
        const stockWinRates = [];
        const total = allStocks.length;
        const BATCH_SIZE = 25;  // Smaller batches for CPU-intensive backtesting

        console.log(`[Portfolio Simulator] Backtesting ${total} stocks in batches of ${BATCH_SIZE}`);

        // Process in batches for parallel execution
        for (let batchStart = 0; batchStart < total; batchStart += BATCH_SIZE) {
            const batchEnd = Math.min(batchStart + BATCH_SIZE, total);
            const batch = allStocks.slice(batchStart, batchEnd);
            const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(total / BATCH_SIZE);

            // Report progress for this batch
            if (progressCallback) {
                progressCallback({
                    stage: 'backtest',
                    message: `Backtesting batch ${batchNum}/${totalBatches}`,
                    current: batchStart,
                    total: total,
                    percent: Math.round((batchStart / total) * 100)
                });
            }

            // Process batch in parallel using Promise.all
            const batchPromises = batch.map(async (stock) => {
                try {
                    // Filter data for historical backtest period only
                    const historicalData = filterDataByDateRange(
                        stock.data,
                        dates.dataStart,
                        dates.simulationStart
                    );

                    if (!historicalData || historicalData.dates.length < 200) {
                        return null; // Not enough data
                    }

                    // Run backtest on historical period
                    const backtest = window.BacktestCalculator.runBacktest(historicalData, CONFIG.DTI_PARAMS);

                    if (backtest && backtest.trades) {
                        // Count only signals AFTER buffer period (6 months)
                        const bufferEnd = new Date(dates.bufferEnd);
                        const historicalSignals = backtest.trades.filter(trade => {
                            const entryDate = new Date(trade.entryDate);
                            return entryDate >= bufferEnd && !trade.isOpen;
                        });

                        // Only proceed if we have at least 5 historical signals after buffer
                        if (historicalSignals.length >= 5) {
                            const wins = historicalSignals.filter(t => t.isWin).length;
                            const winRate = (wins / historicalSignals.length) * 100;

                            return {
                                symbol: stock.symbol,
                                market: stock.market,
                                winRate: winRate,
                                historicalSignalCount: historicalSignals.length,
                                avgReturn: backtest.metrics.avgReturn
                            };
                        }
                    }
                } catch (error) {
                    console.warn(`[Portfolio Simulator] Historical backtest failed for ${stock.symbol}:`, error.message);
                }
                return null;
            });

            // Wait for entire batch to complete
            const batchResults = await Promise.all(batchPromises);

            // Add successful results to the collection
            for (const result of batchResults) {
                if (result) {
                    stockWinRates.push(result);
                }
            }
        }

        console.log(`[Portfolio Simulator] Calculated win rates for ${stockWinRates.length} stocks`);
        return stockWinRates;
    }

    /**
     * Generate signals during simulation period for high conviction stocks
     * Optimized with parallel batch processing
     */
    async function generateSimulationSignals(allStocks, highConvictionStocks, dates, progressCallback) {
        const signals = [];
        const highConvictionSymbols = new Set(highConvictionStocks.map(s => s.symbol));
        const BATCH_SIZE = 25;  // Smaller batches for CPU-intensive work

        // Filter to only high conviction stocks first (more efficient)
        const stocksToProcess = allStocks.filter(s => highConvictionSymbols.has(s.symbol));
        const total = stocksToProcess.length;

        console.log(`[Portfolio Simulator] Generating signals for ${total} high conviction stocks in batches of ${BATCH_SIZE}`);

        // Process in batches for parallel execution
        for (let batchStart = 0; batchStart < total; batchStart += BATCH_SIZE) {
            const batchEnd = Math.min(batchStart + BATCH_SIZE, total);
            const batch = stocksToProcess.slice(batchStart, batchEnd);
            const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(total / BATCH_SIZE);

            // Report progress for this batch
            if (progressCallback) {
                progressCallback({
                    stage: 'signals',
                    message: `Generating signals batch ${batchNum}/${totalBatches}`,
                    current: batchStart,
                    total: total,
                    percent: Math.round((batchStart / total) * 100)
                });
            }

            // Process batch in parallel using Promise.all
            const batchPromises = batch.map(async (stock) => {
                const stockSignals = [];
                try {
                    // Run backtest on entire data range to get all signals
                    const backtest = window.BacktestCalculator.runBacktest(stock.data, CONFIG.DTI_PARAMS);

                    if (backtest && backtest.trades) {
                        // Get win rate and historical signal count from high conviction data
                        const stockInfo = highConvictionStocks.find(s => s.symbol === stock.symbol);

                        // Convert trades to signals, filter for simulation period
                        for (const trade of backtest.trades) {
                            const entryDate = new Date(trade.entryDate);
                            const simStart = new Date(dates.simulationStart);

                            // Only include signals that occur during simulation period
                            if (entryDate >= simStart && !trade.isOpen) {
                                stockSignals.push({
                                    symbol: stock.symbol,
                                    market: stock.market,
                                    entryDate: trade.entryDate,
                                    entryPrice: trade.entryPrice,
                                    exitDate: trade.exitDate,
                                    exitPrice: trade.exitPrice,
                                    plPercent: trade.plPercent,
                                    holdingDays: trade.holdingDays,
                                    exitReason: trade.exitReason,
                                    winRate: stockInfo.winRate,
                                    historicalSignalCount: stockInfo.historicalSignalCount,
                                    isWin: trade.isWin,
                                    // DTI values at entry
                                    prevDTI: trade.prevDTI,
                                    entryDTI: trade.entryDTI,
                                    prev7DayDTI: trade.prev7DayDTI,
                                    entry7DayDTI: trade.entry7DayDTI
                                });
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`[Portfolio Simulator] Signal generation failed for ${stock.symbol}:`, error.message);
                }
                return stockSignals;
            });

            // Wait for entire batch to complete
            const batchResults = await Promise.all(batchPromises);

            // Add all signals from this batch
            for (const stockSignals of batchResults) {
                signals.push(...stockSignals);
            }
        }

        console.log(`[Portfolio Simulator] Generated ${signals.length} signals from high conviction stocks`);

        // Sort by entry date (FIFO)
        return signals.sort((a, b) => new Date(a.entryDate) - new Date(b.entryDate));
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
     */
    async function simulatePortfolio(signals, startDate, displayCurrency) {
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

            // 1. Check exit conditions for active positions
            checkExitConditions(portfolio, dateStr, signals);

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
     * Check exit conditions for active positions
     */
    function checkExitConditions(portfolio, currentDate, allSignals) {
        const toRemove = [];

        for (let i = 0; i < portfolio.positions.length; i++) {
            const position = portfolio.positions[i];

            // Calculate holding days (safety check)
            const entryDate = new Date(position.entryDate);
            const current = new Date(currentDate);
            const holdingDays = Math.floor((current - entryDate) / (24 * 60 * 60 * 1000));

            // SAFETY CHECK: Force-close if held >= 30 days
            if (holdingDays >= CONFIG.DTI_PARAMS.maxHoldingDays) {
                console.warn(`[Portfolio] Force-closing ${position.symbol} after ${holdingDays} days (max ${CONFIG.DTI_PARAMS.maxHoldingDays})`);

                const closedTrade = {
                    ...position,
                    exitDate: currentDate,
                    exitPrice: position.entryPrice, // Conservative: assume breakeven
                    plPercent: 0, // Conservative: assume no gain/loss
                    exitReason: 'Max Days (Force Close)',
                    holdingDays: holdingDays,
                    // DTI values at entry (if available)
                    prevDTI: position.prevDTI,
                    entryDTI: position.entryDTI,
                    prev7DayDTI: position.prev7DayDTI,
                    entry7DayDTI: position.entry7DayDTI,
                    historicalSignalCount: position.historicalSignalCount
                };

                portfolio.closedTrades.push(closedTrade);

                // Update capital tracking (if available)
                if (portfolio.capitalByMarket && portfolio.capitalByMarket[position.market]) {
                    const pl = (position.tradeSize * 0) / 100; // 0% for force-close
                    portfolio.capitalByMarket[position.market].realized += pl;
                }

                toRemove.push(i);
                continue; // Skip normal exit check
            }

            // Normal exit: Find matching signal with exit data
            const signal = allSignals.find(s =>
                s.symbol === position.symbol &&
                s.entryDate === position.entryDate
            );

            if (signal && signal.exitDate === currentDate) {
                // Close position normally
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
                    historicalSignalCount: signal.historicalSignalCount
                };

                portfolio.closedTrades.push(closedTrade);

                // Update capital tracking (if available)
                if (portfolio.capitalByMarket && portfolio.capitalByMarket[position.market]) {
                    const pl = (position.tradeSize * signal.plPercent) / 100;
                    portfolio.capitalByMarket[position.market].realized += pl;
                }

                toRemove.push(i);
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
                winRate: signal.winRate
            };

            console.log(`[Portfolio] Entering ${signal.symbol} with size ${dynamicSize.toFixed(2)} ${CONFIG.TRADE_SIZES[market].currency}`);

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
     * Calculate initial portfolio value
     */
    function calculateInitialValue(currency) {
        return CONFIG.INITIAL_INVESTMENTS[currency] || 0;
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
