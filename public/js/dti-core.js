/**
 * DTI Backtester - Core Module
 * Main entry point and core application setup
 */

// Global state for the application
const DTIBacktester = {
    // Core state
    isProcessing: false,
    allStocksData: [],
    activeTradeOpportunities: [],
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
                
                return date.toLocaleDateString();
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
        },
        
        // Parse month abbreviation to month number (0-11)
        parseMonth: function(monthStr) {
            const months = {
                'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
                'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
            };
            return months[monthStr.toLowerCase()];
        },
        
        // Safely parse float values, handling commas in number strings
        parseFloatSafe: function(value) {
            if (typeof value === 'number') return value;
            if (!value) return NaN;
            
            // Handle string values that might contain commas as thousand separators
            const cleanedValue = value.toString().replace(/,/g, '');
            return parseFloat(cleanedValue);
        }
    },
    
    // Application initialization
    init: function() {

        // Add page load animations
        this.addPageLoadAnimations();

        // Initialize stock selector
        this.initStockSelector();

        // Create buying opportunities section
        this.createBuyingOpportunitiesSection();

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
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }, 100 + (index * 100));
            });
        }
        
        // Animate parameter sections
        const paramSections = document.querySelectorAll('.parameters-section');
        if (paramSections.length > 0) {
            paramSections.forEach((section, index) => {
                section.style.opacity = '0';
                section.style.transform = 'translateY(10px)';
                setTimeout(() => {
                    section.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                    section.style.opacity = '1';
                    section.style.transform = 'translateY(0)';
                }, 200 + (index * 100));
            });
        }
    },

    // Initialize stock selector UI
    initStockSelector: function() {
        // This will be fully implemented in dti-ui.js
        // Just a placeholder for now - will be overridden by the UI module
    },
    
    // Create buying opportunities section if it doesn't exist
    createBuyingOpportunitiesSection: function() {
        // This will be fully implemented in dti-ui.js
        // Just a placeholder for now - will be overridden by the UI module
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