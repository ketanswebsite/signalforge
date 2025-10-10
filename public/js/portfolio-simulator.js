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
     */
    async function runSimulation(startDate, displayCurrency = 'GBP') {
        try {
            console.log('[Portfolio Simulator] Starting simulation from', startDate);

            // 1. Calculate data fetch start date (with buffer)
            const dataStartDate = calculateDataStartDate(startDate);
            console.log('[Portfolio Simulator] Data fetch start:', dataStartDate);

            // 2. Fetch all stocks data
            const allStocks = await fetchAllStocksData(dataStartDate);
            console.log('[Portfolio Simulator] Fetched', allStocks.length, 'stocks');

            // 3. Generate signals for all stocks
            const allSignals = await generateAllSignals(allStocks);
            console.log('[Portfolio Simulator] Generated', allSignals.length, 'total signals');

            // 4. Filter high conviction signals
            const highConvictionSignals = filterHighConviction(allSignals);
            console.log('[Portfolio Simulator] High conviction signals:', highConvictionSignals.length);

            // 5. Sort signals chronologically
            const sortedSignals = sortSignalsByDate(highConvictionSignals, startDate);
            console.log('[Portfolio Simulator] Signals after date filter:', sortedSignals.length);

            // 6. Run day-by-day simulation
            const portfolio = await simulatePortfolio(sortedSignals, startDate, displayCurrency);

            // 7. Return complete simulation results
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
     * Calculate data start date (add 12-month buffer)
     */
    function calculateDataStartDate(simulationStart) {
        const start = new Date(simulationStart);
        const bufferMonths = CONFIG.DATA_BUFFER.warmup + CONFIG.DATA_BUFFER.safety;
        start.setMonth(start.getMonth() - bufferMonths);
        return start.toISOString().split('T')[0];
    }

    /**
     * Fetch all stocks data from all markets
     */
    async function fetchAllStocksData(startDate) {
        // Get stock lists from all markets
        const stockLists = {
            'India': window.STOCK_INDEXES ? window.STOCK_INDEXES.nifty50 || [] : [],
            'UK': window.STOCK_INDEXES ? window.STOCK_INDEXES.ftse100 || [] : [],
            'US': window.STOCK_INDEXES ? window.STOCK_INDEXES.sp500 || [] : []
        };

        const allStocks = [];
        const endDate = new Date().toISOString().split('T')[0];

        // Fetch data for each market
        for (const [market, symbols] of Object.entries(stockLists)) {
            for (const symbol of symbols) {
                try {
                    const stockData = await fetchStockData(symbol, startDate, endDate);
                    if (stockData && stockData.dates && stockData.dates.length > 200) {
                        allStocks.push({
                            symbol: symbol,
                            market: market,
                            data: stockData
                        });
                    }
                } catch (error) {
                    console.warn(`[Portfolio Simulator] Failed to fetch ${symbol}:`, error.message);
                }
            }
        }

        return allStocks;
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
     * Generate signals for all stocks
     */
    async function generateAllSignals(allStocks) {
        const allSignals = [];

        for (const stock of allStocks) {
            try {
                // Run backtest using existing calculator
                const backtest = window.BacktestCalculator.runBacktest(stock.data, CONFIG.DTI_PARAMS);

                if (backtest && backtest.trades) {
                    // Convert trades to signals
                    for (const trade of backtest.trades) {
                        if (!trade.isOpen) { // Only completed trades
                            allSignals.push({
                                symbol: stock.symbol,
                                market: stock.market,
                                entryDate: trade.entryDate,
                                entryPrice: trade.entryPrice,
                                exitDate: trade.exitDate,
                                exitPrice: trade.exitPrice,
                                plPercent: trade.plPercent,
                                holdingDays: trade.holdingDays,
                                exitReason: trade.exitReason,
                                winRate: backtest.metrics.winRate,
                                isWin: trade.isWin
                            });
                        }
                    }
                }
            } catch (error) {
                console.warn(`[Portfolio Simulator] Backtest failed for ${stock.symbol}:`, error.message);
            }
        }

        return allSignals;
    }

    /**
     * Filter for high conviction signals (>75% win rate)
     */
    function filterHighConviction(signals) {
        return signals.filter(signal => signal.winRate > CONFIG.HIGH_CONVICTION_THRESHOLD);
    }

    /**
     * Sort signals by entry date and filter by simulation start
     */
    function sortSignalsByDate(signals, simulationStart) {
        const startDate = new Date(simulationStart);

        return signals
            .filter(signal => new Date(signal.entryDate) >= startDate)
            .sort((a, b) => new Date(a.entryDate) - new Date(b.entryDate));
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
            currency: displayCurrency
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

            // Find matching signal with exit data
            const signal = allSignals.find(s =>
                s.symbol === position.symbol &&
                s.entryDate === position.entryDate
            );

            if (signal && signal.exitDate === currentDate) {
                // Close position
                const closedTrade = {
                    ...position,
                    exitDate: signal.exitDate,
                    exitPrice: signal.exitPrice,
                    plPercent: signal.plPercent,
                    exitReason: signal.exitReason,
                    holdingDays: signal.holdingDays
                };

                portfolio.closedTrades.push(closedTrade);
                toRemove.push(i);
            }
        }

        // Remove closed positions (reverse order to maintain indices)
        for (let i = toRemove.length - 1; i >= 0; i--) {
            portfolio.positions.splice(toRemove[i], 1);
        }
    }

    /**
     * Process new entry signals
     */
    function processEntrySignals(portfolio, signals, date) {
        // Count current positions per market
        const positionCounts = countPositionsByMarket(portfolio.positions);

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

            // Enter position
            const position = {
                symbol: signal.symbol,
                market: market,
                entryDate: date,
                entryPrice: signal.entryPrice,
                tradeSize: CONFIG.TRADE_SIZES[market].amount,
                currency: CONFIG.TRADE_SIZES[market].currency,
                winRate: signal.winRate
            };

            portfolio.positions.push(position);
            positionCounts[market]++;
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
     */
    function calculatePortfolioValue(portfolio, displayCurrency) {
        let totalValue = 0;

        // Sum up all active positions
        for (const position of portfolio.positions) {
            const positionValue = position.tradeSize;
            const convertedValue = convertCurrency(
                positionValue,
                position.currency,
                displayCurrency
            );
            totalValue += convertedValue;
        }

        // Add closed trades P/L
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
