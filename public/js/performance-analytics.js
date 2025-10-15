/**
 * Performance Analytics Module
 * Calculates and displays advanced trading statistics
 */

const PerformanceAnalytics = (function() {

    /**
     * Calculate comprehensive statistics
     */
    function calculateStats(trades) {
        const closedTrades = trades.filter(t => t.status === 'closed');

        if (closedTrades.length === 0) {
            return {
                totalTrades: 0,
                winRate: 0,
                avgWin: 0,
                avgLoss: 0,
                profitFactor: 0,
                sharpeRatio: 0,
                maxDrawdown: 0,
                avgHoldingDays: 0,
                totalReturn: 0
            };
        }

        // Basic stats
        const wins = closedTrades.filter(t => (t.profitLossPercentage || 0) > 0);
        const losses = closedTrades.filter(t => (t.profitLossPercentage || 0) <= 0);
        const winRate = (wins.length / closedTrades.length) * 100;

        // Average win/loss
        const avgWin = wins.length > 0
            ? wins.reduce((sum, t) => sum + (t.profitLossPercentage || 0), 0) / wins.length
            : 0;
        const avgLoss = losses.length > 0
            ? losses.reduce((sum, t) => sum + Math.abs(t.profitLossPercentage || 0), 0) / losses.length
            : 0;

        // Profit factor
        const totalWins = wins.reduce((sum, t) => sum + (t.profitLossPercentage || 0), 0);
        const totalLosses = losses.reduce((sum, t) => sum + Math.abs(t.profitLossPercentage || 0), 0);
        const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

        // Total return
        const totalReturn = closedTrades.reduce((sum, t) => sum + (t.profitLossPercentage || 0), 0);

        // Sharpe ratio (simplified - annualized)
        const returns = closedTrades.map(t => t.profitLossPercentage || 0);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);
        const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

        // Max drawdown
        let peak = 0;
        let maxDrawdown = 0;
        let cumReturn = 0;

        closedTrades.forEach(trade => {
            cumReturn += (trade.profitLossPercentage || 0);
            if (cumReturn > peak) peak = cumReturn;
            const drawdown = peak - cumReturn;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        });

        // Average holding period
        const avgHoldingDays = closedTrades.reduce((sum, t) => {
            if (!t.entryDate || !t.exitDate) return sum;
            const entry = new Date(t.entryDate);
            const exit = new Date(t.exitDate);
            const days = (exit - entry) / (1000 * 60 * 60 * 24);
            return sum + days;
        }, 0) / closedTrades.length;

        return {
            totalTrades: closedTrades.length,
            winRate: winRate.toFixed(1),
            avgWin: avgWin.toFixed(2),
            avgLoss: avgLoss.toFixed(2),
            profitFactor: profitFactor.toFixed(2),
            sharpeRatio: sharpeRatio.toFixed(2),
            maxDrawdown: maxDrawdown.toFixed(2),
            avgHoldingDays: avgHoldingDays.toFixed(1),
            totalReturn: totalReturn.toFixed(2),
            wins: wins.length,
            losses: losses.length
        };
    }

    /**
     * Calculate per-market statistics
     */
    function calculateMarketStats(trades) {
        const markets = {
            india: trades.filter(t => t.symbol && t.symbol.includes('.NS')),
            uk: trades.filter(t => t.symbol && t.symbol.includes('.L')),
            us: trades.filter(t => t.symbol && !t.symbol.includes('.NS') && !t.symbol.includes('.L'))
        };

        return {
            india: calculateStats(markets.india),
            uk: calculateStats(markets.uk),
            us: calculateStats(markets.us)
        };
    }

    /**
     * Calculate monthly performance
     */
    function calculateMonthlyPerformance(trades) {
        const closedTrades = trades.filter(t => t.status === 'closed' && t.exitDate);
        const monthlyData = {};

        closedTrades.forEach(trade => {
            const exitDate = new Date(trade.exitDate);
            const monthKey = `${exitDate.getFullYear()}-${String(exitDate.getMonth() + 1).padStart(2, '0')}`;

            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    trades: 0,
                    wins: 0,
                    totalReturn: 0
                };
            }

            monthlyData[monthKey].trades++;
            if ((trade.profitLossPercentage || 0) > 0) {
                monthlyData[monthKey].wins++;
            }
            monthlyData[monthKey].totalReturn += (trade.profitLossPercentage || 0);
        });

        // Convert to array and sort by date
        return Object.entries(monthlyData)
            .map(([month, data]) => ({
                month,
                ...data,
                winRate: data.trades > 0 ? ((data.wins / data.trades) * 100).toFixed(1) : 0
            }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }

    /**
     * Display analytics on page
     */
    function displayAnalytics(trades) {
        const stats = calculateStats(trades);
        const marketStats = calculateMarketStats(trades);

        const container = document.getElementById('performance-analytics');
        if (!container) {
            console.warn('Performance analytics container not found');
            return;
        }

        container.innerHTML = `
            <div class="analytics-section">
                <h3>📈 Overall Performance</h3>
                <div class="stats-grid">
                    <div class="stat-card">
                        <span class="stat-label">Total Trades</span>
                        <span class="stat-value">${stats.totalTrades}</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Win Rate</span>
                        <span class="stat-value">${stats.winRate}%</span>
                        <span class="stat-subtext">${stats.wins}W / ${stats.losses}L</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Avg Win</span>
                        <span class="stat-value positive">+${stats.avgWin}%</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Avg Loss</span>
                        <span class="stat-value negative">-${stats.avgLoss}%</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Profit Factor</span>
                        <span class="stat-value ${parseFloat(stats.profitFactor) > 1 ? 'positive' : 'negative'}">${stats.profitFactor}</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Sharpe Ratio</span>
                        <span class="stat-value">${stats.sharpeRatio}</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Max Drawdown</span>
                        <span class="stat-value negative">${stats.maxDrawdown}%</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Avg Hold Days</span>
                        <span class="stat-value">${stats.avgHoldingDays}</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Total Return</span>
                        <span class="stat-value ${parseFloat(stats.totalReturn) >= 0 ? 'positive' : 'negative'}">${parseFloat(stats.totalReturn) >= 0 ? '+' : ''}${stats.totalReturn}%</span>
                    </div>
                </div>
            </div>

            <div class="analytics-section">
                <h3>🌍 Market Breakdown</h3>
                <div class="market-stats">
                    ${renderMarketCard('India 🇮🇳', marketStats.india)}
                    ${renderMarketCard('UK 🇬🇧', marketStats.uk)}
                    ${renderMarketCard('US 🇺🇸', marketStats.us)}
                </div>
            </div>
        `;
    }

    /**
     * Render individual market card
     */
    function renderMarketCard(marketName, stats) {
        if (stats.totalTrades === 0) {
            return `
                <div class="market-card">
                    <h4>${marketName}</h4>
                    <p class="no-data">No trades yet</p>
                </div>
            `;
        }

        return `
            <div class="market-card">
                <h4>${marketName}</h4>
                <div class="market-stat-row">
                    <span>Win Rate:</span>
                    <span class="stat-highlight">${stats.winRate}%</span>
                </div>
                <div class="market-stat-row">
                    <span>Trades:</span>
                    <span>${stats.totalTrades}</span>
                </div>
                <div class="market-stat-row">
                    <span>Profit Factor:</span>
                    <span class="${parseFloat(stats.profitFactor) > 1 ? 'positive' : 'negative'}">${stats.profitFactor}</span>
                </div>
                <div class="market-stat-row">
                    <span>Total Return:</span>
                    <span class="${parseFloat(stats.totalReturn) >= 0 ? 'positive' : 'negative'}">${parseFloat(stats.totalReturn) >= 0 ? '+' : ''}${stats.totalReturn}%</span>
                </div>
            </div>
        `;
    }

    /**
     * Get statistics object (for external use)
     */
    function getStats(trades) {
        return {
            overall: calculateStats(trades),
            markets: calculateMarketStats(trades),
            monthly: calculateMonthlyPerformance(trades)
        };
    }

    // Public API
    return {
        calculateStats,
        calculateMarketStats,
        calculateMonthlyPerformance,
        displayAnalytics,
        getStats
    };
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.PerformanceAnalytics = PerformanceAnalytics;
}
