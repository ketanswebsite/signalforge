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
        console.log('Initializing capital display...');

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

        // Only an account on its own trading signals has a paper ledger (a row per market). This threw on every
        // other account, so the page said "Failed to refresh capital data" every 30 seconds.
        if (!capital || Object.keys(capital).length === 0) {
            renderNoLedger();
            return;
        }

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
     * No paper ledger (GET /api/portfolio/capital answers capital {}): say why, and where to switch it on
     */
    function renderNoLedger() {
        const make = (tag, className, text) => {
            const node = document.createElement(tag);
            if (className) node.className = className;
            if (text) node.textContent = text;
            return node;
        };
        const empty = make('div', 'sa-empty');
        const icon = make('div', 'sa-empty__icon');
        const glyph = make('span', 'material-symbols-rounded', 'account_balance');
        glyph.setAttribute('aria-hidden', 'true');
        icon.appendChild(glyph);
        empty.appendChild(icon);
        empty.appendChild(make('div', 'sa-empty__title', 'No paper capital yet'));
        empty.appendChild(make('p', null, 'Switch on your own trading signals on the Scanner, and every GO signal is booked to a paper portfolio of your own, sized to its capital.'));
        const link = make('a', 'sa-btn sa-btn--sm sa-btn--secondary', 'Open the Scanner');
        link.href = '/index.html';
        empty.appendChild(link);
        // The grid's auto-fit track gives a single item the whole width
        document.getElementById('capital-grid').replaceChildren(empty);
        document.getElementById('capital-totals').replaceChildren();
    }

    /**
     * Render individual market card (a ledger holds only the markets it trades: none for a missing one)
     */
    function renderMarketCard(marketName, marketData, currencySymbol) {
        if (!marketData) return '';
        const utilization = (marketData.positions / marketData.maxPositions) * 100;
        const utilizationClass = utilization > 80 ? 'warning' : utilization > 50 ? 'info' : 'success';

        // Calculate total capital
        const totalCapital = marketData.initial + marketData.realized;
        const plClass = marketData.realized >= 0 ? 'positive' : 'negative';
        const plSign = marketData.realized >= 0 ? '+' : '−';

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
        // v3 Poster: no emoji anywhere — the market name carries the meaning.
        return '';
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
