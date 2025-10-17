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

            // Handle authentication errors
            if (response.status === 401) {
                showError('Authentication required', 'Please log in to view signals');
                return;
            }

            // Handle server errors
            if (response.status >= 500) {
                showError('Server error', 'Unable to fetch signals. Please try again later.');
                return;
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch signals: ${response.statusText}`);
            }

            const data = await response.json();

            // Handle error response from API
            if (data.error) {
                showError('API Error', data.error);
                return;
            }

            pendingSignals = data.signals || [];

            // Clear any previous errors
            clearError();

            // Update UI
            renderSignals();

        } catch (error) {
            console.error('Error fetching signals:', error);
            showError('Connection error', 'Unable to connect to server. Check your internet connection.');
        }
    }

    /**
     * Show error message to user
     */
    function showError(title, message) {
        const grid = document.getElementById('signals-grid');
        if (!grid) return;

        grid.innerHTML = `
            <div class="signals-error">
                <div class="error-icon">⚠️</div>
                <div class="error-title">${title}</div>
                <div class="error-message">${message}</div>
                <button class="btn btn-secondary" onclick="SignalsDisplay.refreshSignals()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                    Retry
                </button>
            </div>
        `;
    }

    /**
     * Clear error message
     */
    function clearError() {
        // Errors are cleared by rendering signals normally
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
                if (countdown.overdue) {
                    const overdueHours = Math.floor(countdown.overdueMinutes / 60);
                    const overdueMinutes = countdown.overdueMinutes % 60;

                    if (overdueHours > 0) {
                        element.textContent = `Executed ${overdueHours}h ${overdueMinutes}m ago`;
                    } else {
                        element.textContent = `Executed ${overdueMinutes}m ago`;
                    }
                    element.classList.add('overdue');
                    element.parentElement.parentElement.classList.add('overdue');
                } else {
                    element.textContent = 'Executing now...';
                    element.classList.add('executing');
                    element.parentElement.parentElement.classList.add('executing');
                }
            } else if (countdown.hours < 1) {
                element.textContent = `Executes in ${countdown.minutes}m`;
                element.classList.add('imminent');
                element.parentElement.parentElement.classList.add('imminent');
            } else if (countdown.hours < 6) {
                element.textContent = `Executes in ${countdown.hours}h ${countdown.minutes}m`;
                element.classList.add('soon');
            } else {
                element.textContent = `Executes in ${countdown.hours}h ${countdown.minutes}m`;
            }
        });
    }

    /**
     * Calculate time until 1 PM execution for a market
     * Uses IANA timezone identifiers to properly handle daylight saving time (BST/EDT)
     */
    function calculateTimeUntilExecution(market) {
        // Map market names to IANA timezone identifiers
        const timezoneMap = {
            'India': 'Asia/Kolkata',
            'UK': 'Europe/London',      // Automatically handles GMT/BST
            'US': 'America/New_York'    // Automatically handles EST/EDT
        };

        const timezone = timezoneMap[market];
        if (!timezone) {
            console.error(`Unknown market: ${market}`);
            return { expired: false, hours: 0, minutes: 0, seconds: 0 };
        }

        try {
            // Get current time
            const now = new Date();

            // Get current time in market timezone as a string, then parse it
            const marketTimeStr = now.toLocaleString('en-US', {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });

            // Parse the market time string (format: "MM/DD/YYYY, HH:mm:ss")
            const [datePart, timePart] = marketTimeStr.split(', ');
            const [month, day, year] = datePart.split('/');
            const [hours, minutes, seconds] = timePart.split(':');

            // Create Date object representing current time in market timezone
            const marketNow = new Date(year, month - 1, day, hours, minutes, seconds);

            // Create Date object for 1 PM today in market timezone
            const executionTime = new Date(year, month - 1, day, 13, 0, 0);

            // Calculate difference in milliseconds
            const diffMs = executionTime - marketNow;

            // If execution time has passed (negative difference)
            if (diffMs < 0) {
                const overdueMs = Math.abs(diffMs);
                const overdueMinutes = Math.floor(overdueMs / (1000 * 60));

                return {
                    expired: true,
                    overdue: true,
                    overdueMinutes: overdueMinutes
                };
            }

            // Calculate hours and minutes remaining
            const hoursRemaining = Math.floor(diffMs / (1000 * 60 * 60));
            const minutesRemaining = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

            return {
                expired: false,
                hours: hoursRemaining,
                minutes: minutesRemaining,
                seconds: 0
            };

        } catch (error) {
            console.error(`Error calculating execution time for ${market}:`, error);
            return { expired: false, hours: 0, minutes: 0, seconds: 0 };
        }
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
        // Map to IANA timezone identifiers
        const timezoneMap = {
            'India': 'Asia/Kolkata',
            'UK': 'Europe/London',
            'US': 'America/New_York'
        };

        const timezone = timezoneMap[market];
        if (!timezone) {
            return '';
        }

        try {
            // Get current date in the market timezone
            const now = new Date();
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                timeZoneName: 'short'
            });

            // Extract the timezone abbreviation (e.g., "GMT", "BST", "IST", "EST", "EDT")
            const parts = formatter.formatToParts(now);
            const timeZonePart = parts.find(part => part.type === 'timeZoneName');

            return timeZonePart ? timeZonePart.value : '';
        } catch (error) {
            // Fallback to static timezone names
            const fallbackTimezones = {
                'India': 'IST',
                'UK': 'GMT',
                'US': 'EST'
            };
            return fallbackTimezones[market] || '';
        }
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
        refreshSignals,
        showError,
        clearError
    };
})();

// Auto-initialize on trades page
if (document.getElementById('active-trades-container')) {
    document.addEventListener('DOMContentLoaded', () => {
        SignalsDisplay.init();
    });
}
