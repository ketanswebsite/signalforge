/**
 * DTI Backtester - Core Module
 * Main entry point and core application setup
 */

// Global state for the application
const DTIBacktester = {
    // Core state
    currentStockIndex: 'nifty50', // Default to Nifty 50

    // Charts
    priceChart: null,
    dtiChart: null,
    sevenDayDTIChart: null,
    
    // Utils container 
    utils: {
        // Robust date formatter that handles all edge cases
        formatDate: function(dateInput) {
            if (!dateInput) return 'N/A';
            
            try {
                // Handle different input types
                let date;
                if (dateInput instanceof Date) {
                    date = dateInput;
                } else if (typeof dateInput === 'string') {
                    date = new Date(dateInput);
                } else {
                    return String(dateInput); // Return as string if not a recognized format
                }
                
                // Verify it's a valid date
                if (isNaN(date.getTime())) {
                    return String(dateInput); // Return original value as string if invalid date
                }

                return window.DateFormatter ? window.DateFormatter.format(date) : date.toLocaleDateString();
            } catch (error) {
                return String(dateInput); // Fallback to string representation
            }
        },
        
        // Show notification (delegates to NotificationManager)
        showNotification: function(message, type = 'info') {
            if (typeof window.NotificationManager !== 'undefined') {
                window.NotificationManager.show(message, type);
            } else if (typeof window.showNotification === 'function') {
                window.showNotification(message, type);
            } else {
                console[type === 'error' ? 'error' : 'log'](`[${type.toUpperCase()}] ${message}`);
            }
        }
    },
    
    // Application initialization
    init: function() {

        // Add page load animations
        this.addPageLoadAnimations();

        // Update app description with warm-up period info
        this.updateAppDescription();

        // Update active trades count in navigation on page load
        this.updateActiveTradesCount();

        // Set up periodic updates of active trades count
        setInterval(this.updateActiveTradesCount.bind(this), 30000); // Update every 30 seconds

    },
    
    // Add page load animations
    addPageLoadAnimations: function() {
        // Animate cards
        const cards = document.querySelectorAll('.card');
        if (cards.length > 0) {
            cards.forEach((card, index) => {
                card.classList.add('is-entering');
                setTimeout(() => {
                    card.classList.remove('is-entering');
                    card.classList.add('is-entered');
                }, 100 + (index * 100));
            });
        }
    },

    // Update app description with warm-up period info
    updateAppDescription: function() {
        const appDescription = document.querySelector('.app-description');
        if (appDescription) {
            appDescription.innerHTML = `
                Simulate historical portfolio performance using high conviction DTI signals with realistic position management.
                See how a diversified portfolio would have performed across global markets.
                <span class="warmup-note">Note: The first 6 months of data are used as a warm-up period for the indicators; no trades will be taken during this time.</span>
            `;

            // Add CSS for the warm-up note

        }
    },
    
    // Update active trades count in navigation
    updateActiveTradesCount: async function() {
        // Check if we have the badge element
        const badge = document.getElementById('active-trades-count');
        if (!badge) return;
        
        try {
            // Check if TradeAPI is available
            if (typeof TradeAPI !== 'undefined') {
                const activeTrades = await TradeAPI.getActiveTrades();
                badge.textContent = activeTrades.length;
                badge
            } else {
                // Fallback to localStorage if API not available yet
                const storedTrades = localStorage.getItem('dti_backtester_trades');
                if (storedTrades) {
                    try {
                        const trades = JSON.parse(storedTrades);
                        const activeTrades = trades.filter(trade => trade.status === 'active');
                        
                        badge.textContent = activeTrades.length;
                        badge
                    } catch (e) {
                        badge
                    }
                } else {
                    badge
                }
            }
        } catch (error) {
            badge
        }
    }
};

// Export the DTIBacktester object to make it globally available
window.DTIBacktester = DTIBacktester;

// Initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the DTI Backtester
    DTIBacktester.init();
    
    // Add file name display style
    
});

// Global function to show notifications, making it accessible from outside
window.showNotification = function(message, type = 'info') {
    DTIBacktester.utils.showNotification(message, type);
};