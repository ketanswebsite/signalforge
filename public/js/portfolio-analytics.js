/**
 * Portfolio Analytics Calculator
 * Calculates comprehensive performance metrics, risk metrics, and trade statistics
 */

const PortfolioAnalytics = (function() {
    'use strict';

    /**
     * Calculate all analytics metrics
     */
    function calculateMetrics(portfolio, config) {
        const closedTrades = portfolio.closedTrades || [];
        const dailyValues = portfolio.dailyValues || [];

        return {
            // Performance Metrics
            totalReturn: calculateTotalReturn(dailyValues),
            annualizedReturn: calculateAnnualizedReturn(dailyValues, config.startDate),
            sharpeRatio: calculateSharpeRatio(dailyValues),
            sortinoRatio: calculateSortinoRatio(dailyValues),
            calmarRatio: calculateCalmarRatio(dailyValues),

            // Risk Metrics
            maxDrawdown: calculateMaxDrawdown(dailyValues),
            volatility: calculateVolatility(dailyValues),

            // Trade Statistics
            totalTrades: closedTrades.length,
            winningTrades: countWinningTrades(closedTrades),
            losingTrades: countLosingTrades(closedTrades),
            winRate: calculateWinRate(closedTrades),
            avgWin: calculateAvgWin(closedTrades),
            avgLoss: calculateAvgLoss(closedTrades),
            profitFactor: calculateProfitFactor(closedTrades),
            expectancy: calculateExpectancy(closedTrades),

            // Holding Period Analysis
            avgHoldingPeriod: calculateAvgHoldingPeriod(closedTrades),
            medianHoldingPeriod: calculateMedianHoldingPeriod(closedTrades),

            // Market Breakdown
            tradesByMarket: groupTradesByMarket(closedTrades),
            plByMarket: calculatePLByMarket(closedTrades, portfolio.currency),
            winRateByMarket: calculateWinRateByMarket(closedTrades),

            // Monthly Analysis
            monthlyReturns: calculateMonthlyReturns(dailyValues),
            bestMonth: findBestMonth(dailyValues),
            worstMonth: findWorstMonth(dailyValues),

            // Exit Reason Analysis
            exitReasonBreakdown: analyzeExitReasons(closedTrades)
        };
    }

    /**
     * Calculate total return percentage
     */
    function calculateTotalReturn(dailyValues) {
        if (!dailyValues || dailyValues.length < 2) return 0;

        const initialValue = dailyValues[0].value;
        const finalValue = dailyValues[dailyValues.length - 1].value;

        if (initialValue === 0) return 0;

        return ((finalValue - initialValue) / initialValue) * 100;
    }

    /**
     * Calculate annualized return
     */
    function calculateAnnualizedReturn(dailyValues, startDate) {
        if (!dailyValues || dailyValues.length < 2) return 0;

        const totalReturn = calculateTotalReturn(dailyValues);
        const start = new Date(startDate);
        const end = new Date(dailyValues[dailyValues.length - 1].date);
        const years = (end - start) / (365.25 * 24 * 60 * 60 * 1000);

        if (years <= 0) return totalReturn;

        return (Math.pow(1 + totalReturn / 100, 1 / years) - 1) * 100;
    }

    /**
     * Calculate Sharpe Ratio (assuming risk-free rate of 2%)
     */
    function calculateSharpeRatio(dailyValues) {
        if (!dailyValues || dailyValues.length < 2) return 0;

        const returns = calculateDailyReturns(dailyValues);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const stdDev = calculateStdDev(returns);

        if (stdDev === 0) return 0;

        const riskFreeRate = 0.02 / 252; // Daily risk-free rate (2% annual)
        return ((avgReturn - riskFreeRate) / stdDev) * Math.sqrt(252); // Annualized
    }

    /**
     * Calculate Sortino Ratio (downside deviation)
     */
    function calculateSortinoRatio(dailyValues) {
        if (!dailyValues || dailyValues.length < 2) return 0;

        const returns = calculateDailyReturns(dailyValues);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

        // Calculate downside deviation
        const negativeReturns = returns.filter(r => r < 0);
        if (negativeReturns.length === 0) return 99.99; // Very high if no negative returns

        const downsideDev = Math.sqrt(
            negativeReturns.reduce((sum, r) => sum + r * r, 0) / negativeReturns.length
        );

        if (downsideDev === 0) return 99.99;

        const riskFreeRate = 0.02 / 252;
        return ((avgReturn - riskFreeRate) / downsideDev) * Math.sqrt(252);
    }

    /**
     * Calculate daily returns
     */
    function calculateDailyReturns(dailyValues) {
        const returns = [];
        for (let i = 1; i < dailyValues.length; i++) {
            const prevValue = dailyValues[i - 1].value;
            const currValue = dailyValues[i].value;
            if (prevValue > 0) {
                returns.push((currValue - prevValue) / prevValue);
            }
        }
        return returns;
    }

    /**
     * Calculate standard deviation
     */
    function calculateStdDev(values) {
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
        const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
        return Math.sqrt(variance);
    }

    /**
     * Calculate maximum drawdown
     */
    function calculateMaxDrawdown(dailyValues) {
        if (!dailyValues || dailyValues.length < 2) return 0;

        let maxDrawdown = 0;
        let peak = dailyValues[0].value;

        for (const day of dailyValues) {
            if (day.value > peak) {
                peak = day.value;
            }
            const drawdown = ((peak - day.value) / peak) * 100;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }

        return maxDrawdown;
    }

    /**
     * Calculate volatility (annualized standard deviation of returns)
     */
    function calculateVolatility(dailyValues) {
        if (!dailyValues || dailyValues.length < 2) return 0;

        const returns = calculateDailyReturns(dailyValues);
        const stdDev = calculateStdDev(returns);
        return stdDev * Math.sqrt(252) * 100; // Annualized percentage
    }

    /**
     * Calculate Calmar Ratio (Return / Max Drawdown)
     */
    function calculateCalmarRatio(dailyValues) {
        const annualizedReturn = calculateAnnualizedReturn(dailyValues, dailyValues[0].date);
        const maxDrawdown = calculateMaxDrawdown(dailyValues);

        if (maxDrawdown === 0) return 99.99;

        return annualizedReturn / maxDrawdown;
    }

    /**
     * Count winning trades
     */
    function countWinningTrades(trades) {
        return trades.filter(t => t.plPercent > 0).length;
    }

    /**
     * Count losing trades
     */
    function countLosingTrades(trades) {
        return trades.filter(t => t.plPercent <= 0).length;
    }

    /**
     * Calculate win rate
     */
    function calculateWinRate(trades) {
        if (trades.length === 0) return 0;
        return (countWinningTrades(trades) / trades.length) * 100;
    }

    /**
     * Calculate average win
     */
    function calculateAvgWin(trades) {
        const winners = trades.filter(t => t.plPercent > 0);
        if (winners.length === 0) return 0;
        return winners.reduce((sum, t) => sum + t.plPercent, 0) / winners.length;
    }

    /**
     * Calculate average loss
     */
    function calculateAvgLoss(trades) {
        const losers = trades.filter(t => t.plPercent <= 0);
        if (losers.length === 0) return 0;
        return losers.reduce((sum, t) => sum + t.plPercent, 0) / losers.length;
    }

    /**
     * Calculate profit factor
     */
    function calculateProfitFactor(trades) {
        const grossProfit = trades
            .filter(t => t.plPercent > 0)
            .reduce((sum, t) => sum + t.plPercent, 0);

        const grossLoss = Math.abs(
            trades
                .filter(t => t.plPercent <= 0)
                .reduce((sum, t) => sum + t.plPercent, 0)
        );

        if (grossLoss === 0) return grossProfit > 0 ? 99.99 : 0;

        return grossProfit / grossLoss;
    }

    /**
     * Calculate expectancy (average P/L per trade)
     */
    function calculateExpectancy(trades) {
        if (trades.length === 0) return 0;
        return trades.reduce((sum, t) => sum + t.plPercent, 0) / trades.length;
    }

    /**
     * Calculate average holding period
     */
    function calculateAvgHoldingPeriod(trades) {
        if (trades.length === 0) return 0;
        return trades.reduce((sum, t) => sum + t.holdingDays, 0) / trades.length;
    }

    /**
     * Calculate median holding period
     */
    function calculateMedianHoldingPeriod(trades) {
        if (trades.length === 0) return 0;

        const sorted = trades.map(t => t.holdingDays).sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);

        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        }
        return sorted[mid];
    }

    /**
     * Group trades by market
     */
    function groupTradesByMarket(trades) {
        const grouped = {
            'India': 0,
            'UK': 0,
            'US': 0
        };

        for (const trade of trades) {
            grouped[trade.market]++;
        }

        return grouped;
    }

    /**
     * Calculate P/L by market
     */
    function calculatePLByMarket(trades, displayCurrency) {
        const plByMarket = {
            'India': 0,
            'UK': 0,
            'US': 0
        };

        for (const trade of trades) {
            const pl = (trade.tradeSize * trade.plPercent) / 100;
            const convertedPL = convertCurrency(pl, trade.currency, displayCurrency);
            plByMarket[trade.market] += convertedPL;
        }

        return plByMarket;
    }

    /**
     * Calculate win rate by market
     */
    function calculateWinRateByMarket(trades) {
        const markets = ['India', 'UK', 'US'];
        const winRates = {};

        for (const market of markets) {
            const marketTrades = trades.filter(t => t.market === market);
            winRates[market] = calculateWinRate(marketTrades);
        }

        return winRates;
    }

    /**
     * Calculate monthly returns
     */
    function calculateMonthlyReturns(dailyValues) {
        if (!dailyValues || dailyValues.length < 2) return [];

        const monthlyReturns = [];
        let currentMonth = null;
        let monthStart = null;

        for (const day of dailyValues) {
            const date = new Date(day.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (currentMonth !== monthKey) {
                if (monthStart !== null) {
                    // Calculate previous month's return
                    const prevDay = dailyValues[dailyValues.indexOf(day) - 1];
                    const returnPct = ((prevDay.value - monthStart.value) / monthStart.value) * 100;
                    monthlyReturns.push({
                        month: currentMonth,
                        return: returnPct
                    });
                }
                currentMonth = monthKey;
                monthStart = day;
            }
        }

        // Add last month
        if (monthStart) {
            const lastDay = dailyValues[dailyValues.length - 1];
            const returnPct = ((lastDay.value - monthStart.value) / monthStart.value) * 100;
            monthlyReturns.push({
                month: currentMonth,
                return: returnPct
            });
        }

        return monthlyReturns;
    }

    /**
     * Find best month
     */
    function findBestMonth(dailyValues) {
        const monthlyReturns = calculateMonthlyReturns(dailyValues);
        if (monthlyReturns.length === 0) return { month: '-', return: 0 };

        return monthlyReturns.reduce((best, current) =>
            current.return > best.return ? current : best
        );
    }

    /**
     * Find worst month
     */
    function findWorstMonth(dailyValues) {
        const monthlyReturns = calculateMonthlyReturns(dailyValues);
        if (monthlyReturns.length === 0) return { month: '-', return: 0 };

        return monthlyReturns.reduce((worst, current) =>
            current.return < worst.return ? current : worst
        );
    }

    /**
     * Analyze exit reasons
     */
    function analyzeExitReasons(trades) {
        const reasons = {
            'Take Profit': 0,
            'Stop Loss': 0,
            'Max Days': 0,
            'Other': 0
        };

        for (const trade of trades) {
            const reason = trade.exitReason || 'Other';
            if (reason.includes('Take Profit') || reason.includes('Profit')) {
                reasons['Take Profit']++;
            } else if (reason.includes('Stop Loss') || reason.includes('Loss')) {
                reasons['Stop Loss']++;
            } else if (reason.includes('Max Days') || reason.includes('Time')) {
                reasons['Max Days']++;
            } else {
                reasons['Other']++;
            }
        }

        return reasons;
    }

    /**
     * Convert currency (reuse from simulator)
     */
    function convertCurrency(amount, fromCurrency, toCurrency) {
        if (window.PortfolioSimulator && window.PortfolioSimulator.CONFIG) {
            const rates = window.PortfolioSimulator.CONFIG.EXCHANGE_RATES;

            if (fromCurrency === toCurrency) return amount;
            if (fromCurrency === 'GBP' && toCurrency === 'INR') return amount * rates.GBP_TO_INR;
            if (fromCurrency === 'GBP' && toCurrency === 'USD') return amount * rates.GBP_TO_USD;
            if (fromCurrency === 'USD' && toCurrency === 'GBP') return amount * rates.USD_TO_GBP;
            if (fromCurrency === 'USD' && toCurrency === 'INR') return amount * rates.USD_TO_INR;
            if (fromCurrency === 'INR' && toCurrency === 'GBP') return amount * rates.INR_TO_GBP;
            if (fromCurrency === 'INR' && toCurrency === 'USD') return amount * rates.INR_TO_USD;
        }

        return amount;
    }

    // Public API
    return {
        calculateMetrics
    };
})();

// Make available globally
window.PortfolioAnalytics = PortfolioAnalytics;
