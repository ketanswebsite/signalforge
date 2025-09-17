/**
 * Frontend-Based Backtest Calculator
 * This is an exact replica of the frontend's backtestWithActiveDetection algorithm
 * that produces proven accurate win rates
 */

/**
 * Calculates days between two dates
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
 * Frontend-based backtest function that detects active trades
 * This is an exact replica of the frontend's backtestWithActiveDetection algorithm
 * @param {Array} dates - Array of date strings
 * @param {Array} prices - Close prices
 * @param {Array} dti - DTI values
 * @param {Object} sevenDayDTIData - 7-day DTI data
 * @param {Object} params - Trading parameters
 * @returns {Object} - Object containing completed trades and active trade
 */
function backtestWithActiveDetection(dates, prices, dti, sevenDayDTIData, params = {}) {
    // Validate inputs
    if (!validateBacktestInputs(dates, prices, dti, sevenDayDTIData)) {
        return { completedTrades: [], activeTrade: null };
    }
    
    // Set default parameters (same as frontend defaults)
    const tradingParams = {
        entryThreshold: params.entryThreshold || 0,
        takeProfitPercent: params.takeProfitPercent || 8,
        stopLossPercent: params.stopLossPercent || 5,
        maxHoldingDays: params.maxHoldingDays || 30,
        enable7DayDTI: params.enable7DayDTI !== undefined ? params.enable7DayDTI : true
    };
    
    const { daily7DayDTI, sevenDayData, sevenDayDTI } = sevenDayDTIData;
    
    // Calculate the earliest allowed trade date (6 months after the first date)
    const firstDate = new Date(dates[0]);
    const earliestAllowableDate = new Date(firstDate);
    earliestAllowableDate.setMonth(firstDate.getMonth() + 6);
    
    // Initialize result variables
    let completedTrades = [];
    let activeTrade = null;
    let previousTradeCompleted = false;
    
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
            const processedTrade = processExitConditions(activeTrade, currentDate, currentPrice, tradingParams);
            
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
                tradingParams
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
 * Calculate performance metrics from completed trades
 * @param {Array} completedTrades - Array of completed trades
 * @returns {Object} - Performance metrics
 */
function calculatePerformanceMetrics(completedTrades) {
    if (!completedTrades || completedTrades.length === 0) {
        return {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            winRate: 0,
            totalReturn: 0,
            avgReturn: 0
        };
    }
    
    let winningTrades = 0;
    let totalReturn = 0;
    
    completedTrades.forEach(trade => {
        if (trade.plPercent > 0) {
            winningTrades++;
        }
        totalReturn += trade.plPercent;
    });
    
    const winRate = (winningTrades / completedTrades.length) * 100;
    const avgReturn = totalReturn / completedTrades.length;
    
    return {
        totalTrades: completedTrades.length,
        winningTrades: winningTrades,
        losingTrades: completedTrades.length - winningTrades,
        winRate: winRate,
        totalReturn: totalReturn,
        avgReturn: avgReturn
    };
}

/**
 * Run complete backtest and return results with metrics (like original backend function)
 * @param {Object} stockData - Stock data with dates, close, dti, sevenDayDTI
 * @param {Object} params - Trading parameters
 * @returns {Object} - Backtest results with trades, metrics, dti, sevenDayDTI
 */
function runBacktest(stockData, params = {}) {
    if (!stockData || !stockData.dates || !stockData.close) {
        return null;
    }
    
    // Use the frontend-based backtest algorithm
    const { completedTrades, activeTrade } = backtestWithActiveDetection(
        stockData.dates, 
        stockData.close, 
        stockData.dti, 
        stockData.sevenDayDTI, 
        params
    );
    
    // Combine completed and active trades
    const allTrades = [...completedTrades];
    if (activeTrade) {
        // Mark active trade
        allTrades.push({ ...activeTrade, isOpen: true });
    }
    
    // Calculate metrics from completed trades only
    const metrics = calculatePerformanceMetrics(completedTrades);
    
    return {
        trades: allTrades,
        metrics: metrics,
        dti: stockData.dti,
        sevenDayDTI: stockData.sevenDayDTI
    };
}

/**
 * Check if stock currently has an entry opportunity (like original backend function)
 * @param {Object} stockData - Stock data
 * @param {Object} params - Trading parameters
 * @returns {Object|null} - Opportunity details or null
 */
function checkForOpportunity(stockData, params = {}) {
    const backtest = runBacktest(stockData, params);
    if (!backtest) return null;

    const lastIndex = stockData.dti.length - 1;
    const currentDTI = stockData.dti[lastIndex];
    const current7DayDTI = stockData.sevenDayDTI.daily7DayDTI[lastIndex];
    const prevDTI = lastIndex > 0 ? stockData.dti[lastIndex - 1] : currentDTI;

    // Check for entry signal using same logic as backtest
    const prev7DayDTI = lastIndex > 0 ? stockData.sevenDayDTI.daily7DayDTI[lastIndex - 1] : null;
    const sevenDayConditionMet = prev7DayDTI !== null ? current7DayDTI > prev7DayDTI : true;
    
    const entryThreshold = params.entryThreshold || 0;
    const isOpportunity = currentDTI < entryThreshold && 
                         currentDTI > prevDTI && 
                         sevenDayConditionMet;

    if (isOpportunity) {
        return {
            symbol: stockData.symbol,
            currentPrice: stockData.close[lastIndex],
            currentDTI: currentDTI,
            current7DayDTI: current7DayDTI,
            signalDate: stockData.dates[lastIndex],
            winRate: backtest.metrics.winRate,
            totalTrades: backtest.metrics.totalTrades,
            backtest: backtest
        };
    }

    return null;
}

// Export for Node.js (backend)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runBacktest,
        checkForOpportunity,
        backtestWithActiveDetection,
        calculatePerformanceMetrics,
        calculateDaysBetween
    };
}

// Export for Browser (frontend) - though this won't be used there
if (typeof window !== 'undefined') {
    window.FrontendBacktestCalculator = {
        runBacktest,
        checkForOpportunity,
        backtestWithActiveDetection,
        calculatePerformanceMetrics,
        calculateDaysBetween
    };
}