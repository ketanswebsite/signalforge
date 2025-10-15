/**
 * 7 AM Signals Display Component
 * Shows pending signals with automated 1 PM execution countdown
 */

const SignalsDisplay = (function() {
    let pendingSignals = [];
    let refreshInterval = null;
    let countdownInterval = null;

    /**
     * Initialize signals display
     */
    async function init() {
        console.log('📈 Initializing signals display...');

        // Create signals container
        createSignalsContainer();

        // Load pending signals
        await refreshSignals();

        // Set up auto-refresh (every 60 seconds)
        refreshInterval = setInterval(refreshSignals, 60000);

        // Clean up on page unload
        window.addEventListener('beforeunload', () => {
            if (refreshInterval) clearInterval(refreshInterval);
            if (countdownInterval) clearInterval(countdownInterval);
        });
    }

    /**
     * Create signals container HTML
     */
    function createSignalsContainer() {
        // Find insertion point (after capital overview, before active trades)
        const capitalCard = document.querySelector('.capital-overview-card');
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

        // Create signals card
        const signalsCard = document.createElement('div');
        signalsCard.className = 'card signals-card';
        signalsCard.innerHTML = `
            <h3 class="card-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="8.5" cy="7" r="4"></circle>
                    <polyline points="17 11 19 13 23 9"></polyline>
                </svg>
                📊 7 AM Signals - Automated 1 PM Execution
                <span class="signal-count" id="signal-count" style="display: none;">0</span>
            </h3>

            <div class="signals-content" id="signals-content">
                <div class="signals-grid" id="signals-grid">
                    <!-- Signal cards will be inserted here -->
                </div>
            </div>
        `;

        // Insert before active trades
        activeTradesParent.parentNode.insertBefore(signalsCard, activeTradesParent);
    }

    /**
     * Fetch pending signals from API
     */
    async function refreshSignals() {
        try {
            const response = await fetch('/api/signals/pending?status=pending');
            if (!response.ok) throw new Error('Failed to fetch signals');

            const data = await response.json();
            pendingSignals = data.signals || [];

            // Update UI
            renderSignals();

        } catch (error) {
            console.error('Error fetching signals:', error);
        }
    }

    /**
     * Render signals
     */
    function renderSignals() {
        const grid = document.getElementById('signals-grid');
        const countBadge = document.getElementById('signal-count');

        // Update count badge
        countBadge.textContent = pendingSignals.length;
        countBadge.style.display = pendingSignals.length > 0 ? 'inline-block' : 'none';

        // Render signals
        if (pendingSignals.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <div class="empty-state-message">No pending signals</div>
                    <p>New high-conviction opportunities will appear here daily at 7 AM UK time</p>
                    <p style="margin-top: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                        Trades automatically execute at 1 PM in each market timezone
                    </p>
                </div>
            `;
            return;
        }

        // Render signal cards
        const signalCards = pendingSignals.map(renderSignalCard).join('');
        grid.innerHTML = signalCards;

        // Start countdown updates
        startCountdownUpdates();
    }

    /**
     * Render individual signal card
     */
    function renderSignalCard(signal) {
        const currency = getCurrencySymbol(signal.market);
        const signalAge = calculateSignalAge(signal.signalDate);
        const ageClass = signalAge === 0 ? 'new' : signalAge === 1 ? 'recent' : 'old';
        const winRateClass = signal.winRate >= 85 ? 'excellent' :
                            signal.winRate >= 80 ? 'good' :
                            signal.winRate >= 75 ? 'moderate' : 'low';

        return `
            <div class="signal-card" data-signal-id="${signal.id}">
                <div class="signal-header">
                    <div class="signal-title">
                        <h4>${signal.symbol}</h4>
                        <span class="signal-market">${signal.market} ${getMarketFlag(signal.market)}</span>
                    </div>
                    <span class="signal-age ${ageClass}">
                        ${signalAge === 0 ? '🆕 Today' : signalAge === 1 ? 'Yesterday' : signalAge + 'd ago'}
                    </span>
                </div>

                <div class="signal-info">
                    <div class="info-row">
                        <span class="info-label">Entry Price:</span>
                        <span class="info-value">${currency}${signal.entryPrice.toFixed(2)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Target (+8%):</span>
                        <span class="info-value success">${currency}${signal.targetPrice.toFixed(2)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Stop Loss (-5%):</span>
                        <span class="info-value danger">${currency}${signal.stopLoss.toFixed(2)}</span>
                    </div>
                </div>

                <div class="signal-stats">
                    <div class="stat-item">
                        <span class="stat-label">Win Rate:</span>
                        <span class="stat-value ${winRateClass}">${signal.winRate.toFixed(1)}%</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Historical:</span>
                        <span class="stat-value">${signal.historicalSignalCount} trades</span>
                    </div>
                </div>

                <div class="signal-scheduled-execution">
                    <div class="execution-status scheduled">
                        <div class="execution-icon">⏰</div>
                        <div class="execution-details">
                            <div class="execution-time">
                                Auto-executes at 1:00 PM ${getMarketTimezone(signal.market)}
                            </div>
                            <div class="execution-countdown" data-market="${signal.market}">
                                Calculating...
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Start countdown timer updates
     */
    function startCountdownUpdates() {
        // Clear any existing interval
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }

        // Update immediately
        updateCountdowns();

        // Update every second
        countdownInterval = setInterval(updateCountdowns, 1000);
    }

    /**
     * Update countdown timers for all signals
     */
    function updateCountdowns() {
        document.querySelectorAll('.execution-countdown').forEach(element => {
            const market = element.dataset.market;
            const countdown = calculateTimeUntilExecution(market);

            if (countdown.expired) {
                element.textContent = '⏰ Executing now...';
                element.classList.add('executing');
                element.parentElement.parentElement.classList.add('executing');
            } else if (countdown.hours < 1) {
                element.textContent = `⏰ Executes in ${countdown.minutes}m ${countdown.seconds}s`;
                element.classList.add('imminent');
                element.parentElement.parentElement.classList.add('imminent');
            } else if (countdown.hours < 6) {
                element.textContent = `⏰ Executes in ${countdown.hours}h ${countdown.minutes}m`;
                element.classList.add('soon');
            } else {
                element.textContent = `⏰ Executes in ${countdown.hours}h ${countdown.minutes}m`;
            }
        });
    }

    /**
     * Calculate time until 1 PM execution for a market
     */
    function calculateTimeUntilExecution(market) {
        const now = new Date();

        // Get 1 PM today in market timezone
        const executionTime = new Date(now);
        executionTime.setHours(13, 0, 0, 0);

        // Timezone offsets in minutes
        const timezoneOffsets = {
            'India': 330,  // IST is UTC+5:30
            'UK': 0,       // GMT is UTC+0 (BST would be +60, but we'll use local time)
            'US': -300     // EST is UTC-5 (EDT would be -240)
        };

        const offset = timezoneOffsets[market] || 0;
        const localOffset = now.getTimezoneOffset();
        executionTime.setMinutes(executionTime.getMinutes() + offset + localOffset);

        let diff = executionTime - now;

        // If time has passed today, it was for today but already happened
        if (diff < 0) {
            // Check if it happened within the last hour (might still be executing)
            if (Math.abs(diff) < 3600000) { // 1 hour in milliseconds
                return { expired: true };
            }
            // Otherwise, it's scheduled for tomorrow
            diff += 24 * 60 * 60 * 1000;
        }

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        return { expired: false, hours, minutes, seconds };
    }

    /**
     * Helper functions
     */
    function getCurrencySymbol(market) {
        const symbols = {
            'India': '₹',
            'UK': '£',
            'US': '$'
        };
        return symbols[market] || '';
    }

    function getMarketFlag(market) {
        const flags = {
            'India': '🇮🇳',
            'UK': '🇬🇧',
            'US': '🇺🇸'
        };
        return flags[market] || '';
    }

    function getMarketTimezone(market) {
        const timezones = {
            'India': 'IST',
            'UK': 'GMT',
            'US': 'EST'
        };
        return timezones[market] || '';
    }

    function calculateSignalAge(signalDate) {
        const now = new Date();
        const signal = new Date(signalDate);
        const diffTime = Math.abs(now - signal);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }

    // Public API
    return {
        init,
        refreshSignals
    };
})();

// Auto-initialize on trades page
if (document.getElementById('active-trades-container')) {
    document.addEventListener('DOMContentLoaded', () => {
        SignalsDisplay.init();
    });
}
