/**
 * Market Status Initializer
 * Populates the market status container on page load
 */

(function() {
    'use strict';

    /**
     * Initialize market status display
     */
    function initializeMarketStatus() {
        const container = document.getElementById('market-status-container');
        if (!container) {
            return;
        }

        // Wait for required dependencies
        if (typeof getEnhancedMarketStatus !== 'function' || typeof createMarketStatusBadge !== 'function') {
            setTimeout(initializeMarketStatus, 500);
            return;
        }

        // Get active trades to count per market
        const getTradeCountByMarket = async () => {
            const marketCounts = { US: 0, India: 0, UK: 0 };

            try {
                if (typeof TradeCore !== 'undefined' && TradeCore.getActiveTrades) {
                    const activeTrades = await TradeCore.getActiveTrades();
                    activeTrades.forEach(trade => {
                        if (trade.symbol) {
                            if (trade.symbol.endsWith('.NS')) {
                                marketCounts.India++;
                            } else if (trade.symbol.endsWith('.L')) {
                                marketCounts.UK++;
                            } else {
                                marketCounts.US++;
                            }
                        }
                    });
                }
            } catch (error) {
            }

            return marketCounts;
        };

        // Update market status displays
        const updateMarketStatus = async () => {
            container.innerHTML = ''; // Clear existing content

            const marketCounts = await getTradeCountByMarket();

            // Markets to display (in order)
            const markets = [
                { symbol: 'AAPL', key: 'US' },
                { symbol: 'RELIANCE.NS', key: 'India' },
                { symbol: 'BP.L', key: 'UK' }
            ];

            // Create badges for each market
            markets.forEach(market => {
                try {
                    const status = getEnhancedMarketStatus(market.symbol);
                    if (status) {
                        const tradeCount = marketCounts[market.key] || 0;
                        const badge = createMarketStatusBadge(status, tradeCount);
                        container.appendChild(badge);
                    }
                } catch (error) {
                }
            });
        };

        // Initial update
        updateMarketStatus();

        // Update every minute
        setInterval(updateMarketStatus, 60000);

    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeMarketStatus);
    } else {
        initializeMarketStatus();
    }
})();
