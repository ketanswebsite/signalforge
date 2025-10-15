/**
 * Capital Display Component
 * Shows portfolio capital status on trades page
 */

const CapitalDisplay = (function() {
    let capitalData = null;
    let refreshInterval = null;

    /**
     * Initialize capital display
     */
    async function init() {
        console.log('📊 Initializing capital display...');

        // Create capital display container
        createCapitalContainer();

        // Load initial data
        await refreshCapitalData();

        // Set up auto-refresh (every 30 seconds)
        refreshInterval = setInterval(refreshCapitalData, 30000);

        // Clean up on page unload
        window.addEventListener('beforeunload', () => {
            if (refreshInterval) clearInterval(refreshInterval);
        });
    }

    /**
     * Create capital display HTML
     */
    function createCapitalContainer() {
        // Find insertion point (before active trades section)
        const activeTradesCard = document.querySelector('#active-trades-container');
        if (!activeTradesCard) {
            console.error('Could not find active trades container');
            return;
        }

        const activeTradesParent = activeTradesCard.closest('.card');
        if (!activeTradesParent) {
            console.error('Could not find active trades card');
            return;
        }

        // Create capital overview card
        const capitalCard = document.createElement('div');
        capitalCard.className = 'card capital-overview-card';
        capitalCard.innerHTML = `
            <h3 class="card-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23"></line>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
                Portfolio Capital
                <button class="btn-icon" id="refresh-capital-btn" title="Refresh capital">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                </button>
            </h3>

            <div class="capital-grid" id="capital-grid">
                <!-- Capital cards will be inserted here -->
            </div>

            <div class="capital-totals" id="capital-totals">
                <!-- Total positions info will be inserted here -->
            </div>
        `;

        // Insert before active trades
        activeTradesParent.parentNode.insertBefore(capitalCard, activeTradesParent);

        // Add event listener for refresh button
        document.getElementById('refresh-capital-btn').addEventListener('click', async (e) => {
            e.preventDefault();
            await refreshCapitalData();
        });
    }

    /**
     * Fetch capital data from API
     */
    async function refreshCapitalData() {
        try {
            const response = await fetch('/api/portfolio/capital');
            if (!response.ok) throw new Error('Failed to fetch capital data');

            const data = await response.json();
            capitalData = data;

            // Update display
            renderCapitalDisplay();

        } catch (error) {
            console.error('Error refreshing capital:', error);
            if (typeof showNotification === 'function') {
                showNotification('Failed to refresh capital data', 'error');
            }
        }
    }

    /**
     * Render capital display
     */
    function renderCapitalDisplay() {
        if (!capitalData) return;

        const { capital, totals } = capitalData;

        // Render market cards
        const gridHtml = `
            ${renderMarketCard('India', capital.India, '₹')}
            ${renderMarketCard('UK', capital.UK, '£')}
            ${renderMarketCard('US', capital.US, '$')}
        `;

        document.getElementById('capital-grid').innerHTML = gridHtml;

        // Render totals
        const utilizationClass = totals.utilizationPercent > 80 ? 'warning' : '';
        const totalsHtml = `
            <div class="capital-total-item">
                <span class="label">Total Positions:</span>
                <span class="value ${utilizationClass}">
                    ${totals.totalPositions}/${totals.maxTotalPositions}
                </span>
            </div>
            <div class="capital-total-item">
                <span class="label">Utilization:</span>
                <span class="value ${utilizationClass}">
                    ${totals.utilizationPercent}%
                </span>
            </div>
        `;

        document.getElementById('capital-totals').innerHTML = totalsHtml;
    }

    /**
     * Render individual market card
     */
    function renderMarketCard(marketName, marketData, currencySymbol) {
        const utilization = (marketData.positions / marketData.maxPositions) * 100;
        const utilizationClass = utilization > 80 ? 'warning' : utilization > 50 ? 'info' : 'success';

        // Calculate total capital
        const totalCapital = marketData.initial + marketData.realized;
        const plClass = marketData.realized >= 0 ? 'positive' : 'negative';
        const plSign = marketData.realized >= 0 ? '+' : '';

        return `
            <div class="capital-market-card">
                <div class="market-header">
                    <h4>${marketName}</h4>
                    <span class="market-flag">${getMarketFlag(marketName)}</span>
                </div>

                <div class="capital-info">
                    <div class="capital-row">
                        <span class="capital-label">Available:</span>
                        <span class="capital-value highlighted">
                            ${currencySymbol}${formatNumber(marketData.available)}
                        </span>
                    </div>

                    <div class="capital-row">
                        <span class="capital-label">Allocated:</span>
                        <span class="capital-value">
                            ${currencySymbol}${formatNumber(marketData.allocated)}
                        </span>
                    </div>

                    <div class="capital-row">
                        <span class="capital-label">Realized P/L:</span>
                        <span class="capital-value ${plClass}">
                            ${plSign}${currencySymbol}${formatNumber(Math.abs(marketData.realized))}
                        </span>
                    </div>

                    <div class="capital-row">
                        <span class="capital-label">Total Capital:</span>
                        <span class="capital-value">
                            ${currencySymbol}${formatNumber(totalCapital)}
                        </span>
                    </div>
                </div>

                <div class="positions-bar">
                    <div class="positions-label">
                        Positions: ${marketData.positions}/${marketData.maxPositions}
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${utilizationClass}"
                             style="width: ${utilization}%">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get market flag emoji
     */
    function getMarketFlag(market) {
        const flags = {
            'India': '🇮🇳',
            'UK': '🇬🇧',
            'US': '🇺🇸'
        };
        return flags[market] || '';
    }

    /**
     * Format number with commas
     */
    function formatNumber(num) {
        return Math.round(num).toLocaleString();
    }

    /**
     * Get current capital data (for other modules)
     */
    function getCapitalData() {
        return capitalData;
    }

    // Public API
    return {
        init,
        refreshCapitalData,
        getCapitalData
    };
})();

// Auto-initialize on trades page
if (document.getElementById('active-trades-container')) {
    document.addEventListener('DOMContentLoaded', () => {
        CapitalDisplay.init();
    });
}
