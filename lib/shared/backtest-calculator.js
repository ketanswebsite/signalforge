/**
 * Shared Backtest Calculator Module
 * Core backtesting logic used by both frontend and backend
 * Provides real historical performance analysis for DTI strategy
 */

// For Node.js (backend), require the DTI calculator
// For browser (frontend), use the already loaded DTICalculator
const DTICalc = (typeof window !== 'undefined' && window.DTICalculator) 
    ? window.DTICalculator 
    : require('./dti-calculator');

/**
 * Run complete backtest on stock data
 * @param {Object} stockData - Stock data with dates, high, low, close arrays
 * @param {Object} params - Trading parameters
 * @returns {Object} - Backtest results with trades and performance metrics
 */
function runBacktest(stockData, params = {}) {
    const {
        r = 14,
        s = 10,
        u = 5,
        entryThreshold = -40,
        takeProfitPercent = 8,
        stopLossPercent = 5,
        maxHoldingDays = 30
    } = params;

    if (!stockData || !stockData.dates || !stockData.high || !stockData.low || !stockData.close) {
        return null;
    }

    // Calculate DTI and 7-day DTI
    const dti = DTICalc.calculateDTI(stockData.high, stockData.low, r, s, u);
    const sevenDayDTIData = DTICalc.calculate7DayDTI(
        stockData.dates, 
        stockData.high, 
        stockData.low, 
        r, s, u
    );

    // Run backtest simulation
    const trades = [];
    let currentTrade = null;

    for (let i = 1; i < stockData.dates.length; i++) {
        const currentDate = stockData.dates[i];
        const currentPrice = stockData.close[i];
        const currentDTI = dti[i];
        const current7DayDTI = sevenDayDTIData.daily7DayDTI[i];
        const prevDTI = dti[i - 1];
        const prev7DayDTI = sevenDayDTIData.daily7DayDTI[i - 1];

        // Check for entry signal
        if (!currentTrade) {
            // Entry conditions: DTI crosses above threshold AND 7-day DTI is positive
            if (prevDTI <= entryThreshold && currentDTI > entryThreshold && current7DayDTI > 0) {
                currentTrade = {
                    entryDate: currentDate,
                    entryPrice: currentPrice,
                    entryDTI: currentDTI,
                    entry7DayDTI: current7DayDTI,
                    entryIndex: i
                };
            }
        } 
        // Check for exit conditions
        else {
            const holdingDays = calculateDaysBetween(currentTrade.entryDate, currentDate);
            const plPercent = ((currentPrice - currentTrade.entryPrice) / currentTrade.entryPrice) * 100;

            let exitReason = null;
            
            // Check exit conditions
            if (plPercent >= takeProfitPercent) {
                exitReason = 'Take Profit';
            } else if (plPercent <= -stopLossPercent) {
                exitReason = 'Stop Loss';
            } else if (holdingDays >= maxHoldingDays) {
                exitReason = 'Max Days';
            } else if (prev7DayDTI > 0 && current7DayDTI <= 0) {
                exitReason = '7-Day DTI Exit';
            }

            if (exitReason) {
                trades.push({
                    ...currentTrade,
                    exitDate: currentDate,
                    exitPrice: currentPrice,
                    exitDTI: currentDTI,
                    exit7DayDTI: current7DayDTI,
                    exitIndex: i,
                    plPercent: plPercent,
                    holdingDays: holdingDays,
                    exitReason: exitReason,
                    isWin: plPercent > 0
                });
                currentTrade = null;
            }
        }
    }

    // Add any open trade
    if (currentTrade) {
        const lastIndex = stockData.dates.length - 1;
        const lastPrice = stockData.close[lastIndex];
        const plPercent = ((lastPrice - currentTrade.entryPrice) / currentTrade.entryPrice) * 100;
        
        trades.push({
            ...currentTrade,
            exitDate: stockData.dates[lastIndex],
            exitPrice: lastPrice,
            exitDTI: dti[lastIndex],
            exit7DayDTI: sevenDayDTIData.daily7DayDTI[lastIndex],
            exitIndex: lastIndex,
            plPercent: plPercent,
            holdingDays: calculateDaysBetween(currentTrade.entryDate, stockData.dates[lastIndex]),
            exitReason: 'Open',
            isWin: plPercent > 0,
            isOpen: true
        });
    }

    // Calculate performance metrics
    const completedTrades = trades.filter(t => !t.isOpen);
    const wins = completedTrades.filter(t => t.isWin).length;
    const losses = completedTrades.length - wins;
    const winRate = completedTrades.length > 0 ? (wins / completedTrades.length) * 100 : 0;
    
    const totalReturn = trades.reduce((sum, trade) => sum + (trade.plPercent || 0), 0);
    const avgReturn = trades.length > 0 ? totalReturn / trades.length : 0;

    return {
        trades: trades,
        metrics: {
            totalTrades: trades.length,
            completedTrades: completedTrades.length,
            openTrades: trades.filter(t => t.isOpen).length,
            wins: wins,
            losses: losses,
            winRate: winRate,
            totalReturn: totalReturn,
            avgReturn: avgReturn
        },
        dti: dti,
        sevenDayDTI: sevenDayDTIData
    };
}

/**
 * Calculate win rate for a stock based on historical backtest
 * @param {Object} stockData - Stock data
 * @param {Object} params - Trading parameters
 * @returns {number} - Win rate percentage (0-100)
 */
function calculateWinRate(stockData, params = {}) {
    const backtest = runBacktest(stockData, params);
    if (!backtest || !backtest.metrics) {
        return 0;
    }
    return backtest.metrics.winRate;
}

/**
 * Check if stock currently has an entry opportunity
 * @param {Object} stockData - Stock data
 * @param {Object} params - Trading parameters
 * @returns {Object|null} - Opportunity details or null
 */
function checkForOpportunity(stockData, params = {}) {
    const {
        entryThreshold = -40
    } = params;

    const backtest = runBacktest(stockData, params);
    if (!backtest) return null;

    const lastIndex = backtest.dti.length - 1;
    const currentDTI = backtest.dti[lastIndex];
    const current7DayDTI = backtest.sevenDayDTI.daily7DayDTI[lastIndex];
    const prevDTI = lastIndex > 0 ? backtest.dti[lastIndex - 1] : currentDTI;

    // Check for entry signal
    const isOpportunity = prevDTI <= entryThreshold && 
                         currentDTI > entryThreshold && 
                         current7DayDTI > 0;

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

/**
 * Calculate days between two dates
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @returns {number} - Number of days
 */
function calculateDaysBetween(startDate, endDate) {
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    return Math.floor((end - start) / (24 * 60 * 60 * 1000));
}

/**
 * Check if date is within last N trading days
 * @param {string|Date} signalDate - Signal date
 * @param {number} daysToCheck - Number of days to check
 * @param {Date} currentDate - Current date (default: now)
 * @returns {boolean} - True if within range
 */
function isWithinTradingDays(signalDate, daysToCheck = 2, currentDate = new Date()) {
    const signal = new Date(signalDate);
    const today = new Date(currentDate);
    
    // Reset time to start of day
    signal.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    // Signal must be before or equal to today
    if (signal > today) return false;
    
    // Count trading days between signal and today
    let tradingDays = 0;
    let tempDate = new Date(today);
    
    while (tempDate >= signal && tradingDays <= daysToCheck) {
        const dayOfWeek = tempDate.getDay();
        
        // Count if it's a weekday
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            tradingDays++;
        }
        
        // Check if we've found the signal date
        if (tempDate.getTime() === signal.getTime()) {
            return tradingDays <= daysToCheck;
        }
        
        // Go back one day
        tempDate.setDate(tempDate.getDate() - 1);
    }
    
    return false;
}

// Export module
const BacktestCalculator = {
    runBacktest,
    calculateWinRate,
    checkForOpportunity,
    isWithinTradingDays,
    calculateDaysBetween
};

// Export for Node.js (backend)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BacktestCalculator;
}

// Export for Browser (frontend)
if (typeof window !== 'undefined') {
    window.BacktestCalculator = BacktestCalculator;
}