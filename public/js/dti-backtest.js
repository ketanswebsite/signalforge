/**
 * DTI Backtester - Enhanced Backtesting Module
 * Handles backtesting logic, trade signal generation, and performance analysis
 * with improved structure, performance, and maintainability
 */

// Create DTIBacktest module
const DTIBacktest = (function() {
    // Private constants
    const DEFAULT_PARAM_RANGES = {
        r: [7, 14, 21],
        s: [5, 10, 15],
        u: [3, 5, 7],
        entryThreshold: [-50, -40, -30],
        takeProfitPercent: [5, 8, 10],
        stopLossPercent: [3, 5, 7],
        maxHoldingDays: [15, 30, 45]
    };

    // Private state
    let warmupInfo = {
        startDate: null,
        endDate: null,
        enabled: true
    };

    /**
     * Retrieves trading parameters from the UI
     * @returns {Object} Trading parameters
     */
    function getTradingParameters() {
        return {
            entryThreshold: parseFloat(document.getElementById('entry-threshold').value),
            takeProfitPercent: parseFloat(document.getElementById('take-profit').value),
            stopLossPercent: parseFloat(document.getElementById('stop-loss').value),
            maxHoldingDays: parseInt(document.getElementById('max-days').value),
            enable7DayDTI: true // Always enabled
        };
    }

    /**
     * Sets trading parameters in the UI
     * @param {Object} params - Parameters to set
     */
    function setTradingParameters(params) {
        const paramMappers = {
            r: (val) => document.getElementById('r').value = val,
            s: (val) => document.getElementById('s').value = val,
            u: (val) => {}, // Fixed at 5
            entryThreshold: (val) => document.getElementById('entry-threshold').value = val,
            takeProfitPercent: (val) => document.getElementById('take-profit').value = val,
            stopLossPercent: (val) => document.getElementById('stop-loss').value = val,
            maxHoldingDays: (val) => document.getElementById('max-days').value = val
        };

        Object.entries(params).forEach(([key, value]) => {
            if (paramMappers[key]) {
                paramMappers[key](value);
            }
        });
    }

    /**
     * Calculates the number of days between two dates
     * @param {Date|string} startDate - Start date
     * @param {Date|string} endDate - End date
     * @returns {number} - Number of days
     */
    function calculateDaysBetween(startDate, endDate) {
        const start = startDate instanceof Date ? startDate : new Date(startDate);
        const end = endDate instanceof Date ? endDate : new Date(endDate);
        return Math.floor((end - start) / (24 * 60 * 60 * 1000));
    }
    
    /**
     * Calculates profit/loss percentage
     * @param {number} currentPrice - Current price
     * @param {number} entryPrice - Entry price
     * @returns {number} - P/L percentage
     */
    function calculatePLPercent(currentPrice, entryPrice) {
        return (currentPrice - entryPrice) / entryPrice * 100;
    }

    /**
     * Validates input data for backtesting
     * @param {Array} dates - Array of date strings
     * @param {Array} prices - Close prices
     * @param {Array} dti - DTI values
     * @param {Object} sevenDayDTIData - 7-day DTI data
     * @returns {boolean} - True if valid, false otherwise
     */
    function validateBacktestInputs(dates, prices, dti, sevenDayDTIData) {
        if (!Array.isArray(dates) || !Array.isArray(prices) || !Array.isArray(dti)) {
            console.error('Backtest inputs must be arrays');
            return false;
        }

        if (!sevenDayDTIData || typeof sevenDayDTIData !== 'object') {
            console.error('Invalid sevenDayDTIData');
            return false;
        }

        if (dates.length !== prices.length || dates.length !== dti.length) {
            console.error('Input arrays must have the same length');
            return false;
        }

        if (!sevenDayDTIData.daily7DayDTI || !sevenDayDTIData.sevenDayData || !sevenDayDTIData.sevenDayDTI) {
            console.error('sevenDayDTIData missing required properties');
            return false;
        }

        return true;
    }

    /**
     * Processes exit conditions for an active trade
     * @param {Object} trade - Active trade
     * @param {string} currentDate - Current date
     * @param {number} currentPrice - Current price
     * @param {Object} params - Trading parameters
     * @returns {Object|null} - Completed trade or null if trade is still active
     */
    function processExitConditions(trade, currentDate, currentPrice, params) {
        const { takeProfitPercent, stopLossPercent, maxHoldingDays } = params;
        
        // Calculate holding period in days
        const holdingDays = calculateDaysBetween(trade.entryDate, currentDate);
        
        // Calculate profit/loss percentage
        const plPercent = calculatePLPercent(currentPrice, trade.entryPrice);
        
        // Update current trade state
        const updatedTrade = {
            ...trade,
            currentPrice,
            currentPlPercent: plPercent,
            holdingDays
        };
        
        // Check exit conditions
        if (plPercent >= takeProfitPercent) {
            return {
                ...updatedTrade,
                exitDate: currentDate,
                exitPrice: currentPrice,
                plPercent,
                exitReason: 'Take Profit'
            };
        } else if (plPercent <= -stopLossPercent) {
            return {
                ...updatedTrade,
                exitDate: currentDate,
                exitPrice: currentPrice,
                plPercent,
                exitReason: 'Stop Loss'
            };
        } else if (holdingDays >= maxHoldingDays) {
            return {
                ...updatedTrade,
                exitDate: currentDate,
                exitPrice: currentPrice,
                plPercent,
                exitReason: 'Time Exit'
            };
        }
        
        // Trade still active
        return updatedTrade;
    }

    /**
     * Checks if entry conditions are met for a new trade
     * @param {number} currentDTI - Current DTI value
     * @param {number} previousDTI - Previous DTI value
     * @param {number} current7DayDTI - Current 7-day DTI
     * @param {number} previous7DayDTI - Previous 7-day DTI
     * @param {Date} currentDateObj - Current date
     * @param {Date} earliestAllowableDate - Earliest allowable date
     * @param {boolean} previousTradeCompleted - Whether previous trade is completed
     * @param {number} totalTrades - Total number of completed trades
     * @param {Object} params - Trading parameters
     * @returns {boolean} - True if entry conditions are met
     */
    function checkEntryConditions(
        currentDTI, 
        previousDTI, 
        current7DayDTI, 
        previous7DayDTI, 
        currentDateObj, 
        earliestAllowableDate, 
        previousTradeCompleted, 
        totalTrades,
        params
    ) {
        const { entryThreshold, enable7DayDTI } = params;
        
        // Check 7-day DTI condition if enabled
        let sevenDayConditionMet = true;
        if (enable7DayDTI && previous7DayDTI !== null) {
            sevenDayConditionMet = current7DayDTI > previous7DayDTI;
        }
        
        return (
            currentDTI < entryThreshold && 
            currentDTI > previousDTI && 
            sevenDayConditionMet && 
            (totalTrades === 0 || previousTradeCompleted) &&
            currentDateObj >= earliestAllowableDate
        );
    }

    /**
     * Find previous 7-day DTI value
     * @param {number} currentIndex - Current data index
     * @param {Array} sevenDayData - 7-day period data
     * @param {Array} sevenDayDTI - 7-day DTI values
     * @returns {number|null} - Previous 7-day DTI or null
     */
    function findPrevious7DayDTI(currentIndex, sevenDayData, sevenDayDTI) {
        // Find which 7-day period the current day belongs to
        let currentPeriodIndex = -1;
        
        for (let p = 0; p < sevenDayData.length; p++) {
            if (currentIndex >= sevenDayData[p].startIndex && currentIndex <= sevenDayData[p].endIndex) {
                currentPeriodIndex = p;
                break;
            }
        }
        
        // Get previous 7-day period's DTI if available
        if (currentPeriodIndex > 0) {
            return sevenDayDTI[currentPeriodIndex - 1];
        }
        
        return null;
    }

    /**
     * Modified backtest function that detects active trades
     * @param {Array} dates - Array of date strings
     * @param {Array} prices - Close prices
     * @param {Array} dti - DTI values
     * @param {Object} sevenDayDTIData - 7-day DTI data
     * @returns {Object} - Object containing completed trades and active trade
     */
    function backtestWithActiveDetection(dates, prices, dti, sevenDayDTIData) {
        // Validate inputs
        if (!validateBacktestInputs(dates, prices, dti, sevenDayDTIData)) {
            return { completedTrades: [], activeTrade: null };
        }
        
        // Get trading parameters
        const params = getTradingParameters();
        
        const { daily7DayDTI, sevenDayData, sevenDayDTI } = sevenDayDTIData;
        
        // Calculate the earliest allowed trade date (6 months after the first date)
        const firstDate = new Date(dates[0]);
        const earliestAllowableDate = new Date(firstDate);
        earliestAllowableDate.setMonth(firstDate.getMonth() + 6);
        
        // Initialize result variables
        let completedTrades = [];
        let activeTrade = null;
        let previousTradeCompleted = false;
        
        // Store the warm-up period info for visualization
        warmupInfo = {
            startDate: firstDate,
            endDate: earliestAllowableDate,
            enabled: true
        };
        
        // Main backtesting loop
        for (let i = 1; i < dti.length; i++) {
            const currentDate = dates[i];
            const currentPrice = prices[i];
            const currentDTI = dti[i];
            const previousDTI = dti[i-1];
            
            // Get current 7-day DTI value
            const current7DayDTI = daily7DayDTI[i];
            
            // Find previous 7-day period's DTI
            const previous7DayDTI = findPrevious7DayDTI(i, sevenDayData, sevenDayDTI);
            
            // Process active trade
            if (activeTrade) {
                const processedTrade = processExitConditions(activeTrade, currentDate, currentPrice, params);
                
                // Check if trade was completed
                if (processedTrade.exitDate) {
                    completedTrades.push(processedTrade);
                    activeTrade = null;
                    previousTradeCompleted = true;
                } else {
                    activeTrade = processedTrade;
                }
            } else {
                // Check for new trade entry
                const currentDateObj = new Date(currentDate);
                const entryConditionsMet = checkEntryConditions(
                    currentDTI, 
                    previousDTI, 
                    current7DayDTI, 
                    previous7DayDTI, 
                    currentDateObj, 
                    earliestAllowableDate, 
                    previousTradeCompleted, 
                    completedTrades.length,
                    params
                );
                
                if (entryConditionsMet) {
                    // Enter new trade
                    activeTrade = {
                        entryDate: currentDate,
                        entryPrice: currentPrice,
                        currentPrice: currentPrice,
                        entryDTI: currentDTI,
                        entry7DayDTI: current7DayDTI,
                        currentPlPercent: 0,
                        holdingDays: 0,
                        signalDate: new Date(currentDate)
                    };
                    
                    previousTradeCompleted = false;
                }
            }
        }
        
        return {
            completedTrades,
            activeTrade
        };
    }
    
    /**
     * Original backtest function for backward compatibility
     * @param {Array} dates - Array of date strings
     * @param {Array} prices - Close prices
     * @param {Array} dti - DTI values
     * @param {Object} sevenDayDTIData - 7-day DTI data
     * @returns {Array} - Array of all trades (completed and active)
     */
    function backtest(dates, prices, dti, sevenDayDTIData) {
        const result = backtestWithActiveDetection(dates, prices, dti, sevenDayDTIData);
        return [...result.completedTrades, ...(result.activeTrade ? [result.activeTrade] : [])];
    }
    
    /**
     * Calculate performance metrics for a set of trades
     * @param {Array} trades - Array of trade objects
     * @returns {Object} - Performance metrics
     */
    function calculatePerformanceMetrics(trades) {
        // Default metrics object
        const defaultMetrics = {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            winRate: 0,
            avgProfit: 0,
            totalReturn: 0,
            profitFactor: 0,
            maxDrawdown: 0,
            avgHoldingPeriod: 0,
            takeProfitCount: 0,
            stopLossCount: 0,
            timeExitCount: 0,
            endOfDataCount: 0,
            equityCurve: [100] // Start with $100
        };
        
        // Return default metrics if no trades
        if (!trades || trades.length === 0) {
            return defaultMetrics;
        }
        
        // Filter out active trades (those without exit info)
        const completedTrades = trades.filter(trade => trade.exitDate && trade.exitReason);
        
        if (completedTrades.length === 0) {
            return defaultMetrics;
        }
        
        // Initialize calculation variables
        let winningTrades = 0;
        let losingTrades = 0;
        let totalProfit = 0;
        let grossProfit = 0;
        let grossLoss = 0;
        let totalHoldingDays = 0;
        let takeProfitCount = 0;
        let stopLossCount = 0;
        let timeExitCount = 0;
        let endOfDataCount = 0;
        
        // Equity curve tracking
        let peak = 100; // Start with $100
        let maxDrawdown = 0;
        const equityCurve = [100];
        
        // Process each completed trade
        completedTrades.forEach(trade => {
            // Categorize trade result
            if (trade.plPercent > 0) {
                winningTrades++;
                grossProfit += trade.plPercent;
            } else {
                losingTrades++;
                grossLoss += Math.abs(trade.plPercent);
            }
            
            // Add to total profit
            totalProfit += trade.plPercent;
            
            // Update equity curve
            const equityChange = equityCurve[equityCurve.length - 1] * (1 + (trade.plPercent / 100));
            equityCurve.push(equityChange);
            
            // Update peak and calculate drawdown
            if (equityChange > peak) {
                peak = equityChange;
            }
            
            const drawdown = peak > 0 ? (peak - equityChange) / peak * 100 : 0;
            maxDrawdown = Math.max(maxDrawdown, drawdown);
            
            // Calculate holding period
            const holdingDays = calculateDaysBetween(trade.entryDate, trade.exitDate);
            totalHoldingDays += holdingDays;
            
            // Count exit reasons
            switch(trade.exitReason) {
                case 'Take Profit': takeProfitCount++; break;
                case 'Stop Loss': stopLossCount++; break;
                case 'Time Exit': timeExitCount++; break;
                case 'End of Data': endOfDataCount++; break;
            }
        });
        
        // Calculate final metrics
        const totalTrades = completedTrades.length;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades * 100) : 0;
        const avgProfit = totalTrades > 0 ? (totalProfit / totalTrades) : 0;
        const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? Infinity : 0);
        const avgHoldingPeriod = totalTrades > 0 ? (totalHoldingDays / totalTrades) : 0;
        
        return {
            totalTrades,
            winningTrades,
            losingTrades,
            winRate,
            avgProfit,
            totalReturn: totalProfit,
            profitFactor,
            maxDrawdown,
            avgHoldingPeriod,
            takeProfitCount,
            stopLossCount,
            timeExitCount,
            endOfDataCount,
            equityCurve
        };
    }
    
    /**
     * Custom entry point style (arrow up in circle) for chart
     * @param {Object} context - Chart.js drawing context
     */
    function customEntryPointStyle(context) {
        const { chart, x, y, raw } = context;
        const ctx = chart.ctx;
        const radius = raw ? Math.max(6, Math.min(10, Math.abs(raw / 50))) : 6;
        
        // Draw circle
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(16, 185, 129, 1)';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw arrow up
        ctx.beginPath();
        ctx.moveTo(x, y - radius/2);
        ctx.lineTo(x, y + radius/2);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(x - radius/2, y);
        ctx.lineTo(x, y - radius/2);
        ctx.lineTo(x + radius/2, y);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
    
    /**
     * Custom exit point style (circle with x) for chart
     * @param {Object} context - Chart.js drawing context
     */
    function customExitPointStyle(context) {
        const { chart, x, y, raw } = context;
        const ctx = chart.ctx;
        const radius = raw ? Math.max(6, Math.min(10, Math.abs(raw / 50))) : 6;
        
        // Draw circle
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 1)';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw X
        ctx.beginPath();
        ctx.moveTo(x - radius/2, y - radius/2);
        ctx.lineTo(x + radius/2, y + radius/2);
        ctx.moveTo(x + radius/2, y - radius/2);
        ctx.lineTo(x - radius/2, y + radius/2);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
    
    /**
     * Custom active entry point style (orange circle with dot) for chart
     * @param {Object} context - Chart.js drawing context
     */
    function customActiveEntryPointStyle(context) {
        const { chart, x, y, raw } = context;
        const ctx = chart.ctx;
        const radius = raw ? Math.max(6, Math.min(10, Math.abs(raw / 50))) : 6;
        
        // Draw circle
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(249, 115, 22, 1)'; // Orange color
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw inner dot
        ctx.beginPath();
        ctx.arc(x, y, radius/3, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
    }
    
    /**
     * Generate connection line between entry and exit points
     * @param {number} startIdx - Entry index
     * @param {number} endIdx - Exit index
     * @param {Array} prices - Price data
     * @param {number} plPercent - Profit/loss percentage
     * @returns {Array} - Connection line data
     */
    function generateConnectionLine(startIdx, endIdx, prices, plPercent) {
        return Array.from({ length: endIdx - startIdx + 1 }, (_, i) => ({
            x: startIdx + i,
            y: prices[startIdx + i],
            plPercent
        }));
    }
    
    /**
     * Generate trade markers for charts
     * @param {Array} dates - Array of date strings
     * @param {Array} prices - Close prices
     * @param {Array} trades - Array of trade objects
     * @returns {Object} - Chart markers and metadata
     */
    function generateTradeMarkers(dates, prices, trades) {
        // Initialize arrays for markers
        const entryMarkers = Array(dates.length).fill(null);
        const exitMarkers = Array(dates.length).fill(null);
        const activeEntryMarkers = Array(dates.length).fill(null);
        const tradeConnections = [];
        const tradeProfitLoss = [];
        const tradeMetadata = [];
        
        // Process each trade
        trades.forEach(trade => {
            const entryIndex = dates.indexOf(trade.entryDate);
            
            if (entryIndex !== -1) {
                // Check if trade is completed or active
                if (trade.exitDate && trade.exitReason) {
                    // Completed trade - mark with green entry and red exit
                    const exitIndex = dates.indexOf(trade.exitDate);
                    
                    if (exitIndex !== -1) {
                        // Store entry/exit points
                        entryMarkers[entryIndex] = prices[entryIndex];
                        exitMarkers[exitIndex] = prices[exitIndex];
                        
                        // Store trade data for tooltips
                        tradeMetadata[entryIndex] = {
                            type: 'entry',
                            price: trade.entryPrice,
                            date: trade.entryDate,
                            plPercent: trade.plPercent,
                            holdingDays: calculateDaysBetween(trade.entryDate, trade.exitDate)
                        };
                        
                        tradeMetadata[exitIndex] = {
                            type: 'exit',
                            price: trade.exitPrice,
                            date: trade.exitDate,
                            plPercent: trade.plPercent,
                            exitReason: trade.exitReason
                        };
                        
                        // Generate connection line data
                        const connectionData = generateConnectionLine(
                            entryIndex, 
                            exitIndex, 
                            prices, 
                            trade.plPercent
                        );
                        tradeConnections.push(...connectionData);
                        
                        // Store if trade was profit or loss for coloring
                        for (let i = entryIndex; i <= exitIndex; i++) {
                            tradeProfitLoss[i] = trade.plPercent;
                        }
                    }
                } else {
                    // Active trade - mark with orange entry
                    activeEntryMarkers[entryIndex] = prices[entryIndex];
                    
                    // Store active trade data for tooltips
                    tradeMetadata[entryIndex] = {
                        type: 'active_entry',
                        price: trade.entryPrice,
                        date: trade.entryDate,
                        isActive: true
                    };
                }
            }
        });
        
        return {
            entryMarkers,
            exitMarkers,
            activeEntryMarkers,
            tradeConnections,
            tradeProfitLoss,
            tradeMetadata
        };
    }
    
    /**
     * Validate trading parameters
     * @returns {Object} - Validation results
     */
    function validateParameters() {
        const paramDefinitions = [
            { id: 'r', name: 'EMA Period (r)', validate: val => !isNaN(val) && val > 0, type: 'positive number' },
            { id: 's', name: 'EMA Period (s)', validate: val => !isNaN(val) && val > 0, type: 'positive number' },
            { id: 'u', name: 'EMA Period (u)', validate: val => !isNaN(val) && val > 0, type: 'positive number' },
            { id: 'entry-threshold', name: 'Entry Threshold', validate: val => !isNaN(val), type: 'number' },
            { id: 'take-profit', name: 'Take Profit', validate: val => !isNaN(val) && val > 0, type: 'positive number' },
            { id: 'stop-loss', name: 'Stop Loss', validate: val => !isNaN(val) && val > 0, type: 'positive number' },
            { id: 'max-days', name: 'Max Holding Period', validate: val => !isNaN(val) && val > 0, type: 'positive number' }
        ];
        
        const errors = [];
        
        // Validate each parameter
        paramDefinitions.forEach(param => {
            const value = parseFloat(document.getElementById(param.id).value);
            if (!param.validate(value)) {
                errors.push(`${param.name} must be a ${param.type}`);
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    
    /**
     * Execute a backtest with specific parameters
     * @param {Array} dates - Array of date strings
     * @param {Array} high - High prices
     * @param {Array} low - Low prices
     * @param {Array} close - Close prices
     * @param {Object} params - Parameters to use
     * @returns {Object} - Backtest results
     */
    function executeBacktestWithParams(dates, high, low, close, params) {
        // Save original parameters
        const originalParams = {
            r: document.getElementById('r').value,
            s: document.getElementById('s').value,
            u: 5, // Fixed value
            entryThreshold: document.getElementById('entry-threshold').value,
            takeProfitPercent: document.getElementById('take-profit').value,
            stopLossPercent: document.getElementById('stop-loss').value,
            maxHoldingDays: document.getElementById('max-days').value,
        };
        
        try {
            // Set parameters for test
            setTradingParameters(params);
            
            // Calculate DTI with current parameters
            const dti = DTIIndicators.calculateDTI(high, low, params.r, params.s, params.u);
            const sevenDayDTIData = DTIIndicators.calculate7DayDTI(dates, high, low, params.r, params.s, params.u);
            
            // Run backtest
            const { completedTrades } = backtestWithActiveDetection(dates, close, dti, sevenDayDTIData);
            
            // Calculate metrics
            const metrics = calculatePerformanceMetrics(completedTrades);
            
            return {
                params,
                metrics,
                completedTrades
            };
        } finally {
            // Restore original parameters
            setTradingParameters(originalParams);
        }
    }
    
    /**
     * Find optimal parameters using a simple grid search
     * @param {Array} dates - Array of date strings
     * @param {Array} high - High prices
     * @param {Array} low - Low prices
     * @param {Array} close - Close prices
     * @param {Object} paramRanges - Parameter ranges to test
     * @returns {Object} - Optimal parameters and results
     */
    function findOptimalParameters(dates, high, low, close, paramRanges) {
        // Use default parameter ranges if not provided
        const ranges = paramRanges || DEFAULT_PARAM_RANGES;
        
        // Initialize results
        let bestResult = {
            params: null,
            metrics: {
                totalReturn: -Infinity,
                winRate: 0,
                profitFactor: 0
            }
        };
        
        let allResults = [];
        
        // Generate parameter combinations
        const paramCombinations = [];
        
        // Create all combinations more efficiently
        for (const r of ranges.r) {
            for (const s of ranges.s) {
                for (const u of ranges.u) {
                    for (const entryThreshold of ranges.entryThreshold) {
                        for (const takeProfitPercent of ranges.takeProfitPercent) {
                            for (const stopLossPercent of ranges.stopLossPercent) {
                                for (const maxHoldingDays of ranges.maxHoldingDays) {
                                    paramCombinations.push({
                                        r, s, u, 
                                        entryThreshold, 
                                        takeProfitPercent, 
                                        stopLossPercent, 
                                        maxHoldingDays
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Execute backtest for each combination
        paramCombinations.forEach(params => {
            const result = executeBacktestWithParams(dates, high, low, close, params);
            allResults.push(result);
            
            // Update best result if this is better
            // Using a scoring system: totalReturn * winRate * profitFactor
            const currentScore = result.metrics.totalReturn * 
                                (result.metrics.winRate / 100) * 
                                result.metrics.profitFactor;
                                
            const bestScore = bestResult.metrics.totalReturn * 
                             (bestResult.metrics.winRate / 100) * 
                             bestResult.metrics.profitFactor;
            
            if (currentScore > bestScore && result.metrics.totalTrades >= 5) {
                bestResult = {
                    params: result.params,
                    metrics: result.metrics
                };
            }
        });
        
        return {
            bestResult,
            allResults
        };
    }
    
    // Return public API
    return {
        // Expose public methods
        backtestWithActiveDetection,
        backtest,
        calculatePerformanceMetrics,
        customEntryPointStyle,
        customExitPointStyle,
        customActiveEntryPointStyle,
        generateTradeMarkers,
        validateParameters,
        findOptimalParameters,
        
        // Add getter for warmupInfo
        get warmupInfo() {
            return warmupInfo;
        },
        
        // Add setter for warmupInfo
        set warmupInfo(info) {
            warmupInfo = info;
        }
    };
})();

// Make DTIBacktest available globally
window.DTIBacktest = DTIBacktest;