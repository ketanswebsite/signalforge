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
        
        // Show notification
        showNotification: function(message, type = 'info') {
            // Look for notification container
            let container = document.getElementById('notification-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'notification-container';
                document.body.appendChild(container);
            }
            
            // Create notification element
            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;
            
            // Add appropriate icon based on type
            let icon = '';
            switch (type) {
                case 'success':
                    icon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>`;
                    break;
                case 'error':
                    icon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>`;
                    break;
                case 'warning':
                    icon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>`;
                    break;
                default: // info
                    icon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="16"></line>
                            <line x1="12" y1="16" x2="12" y2="16"></line>
                        </svg>`;
            }
            
            notification.innerHTML = `
                <div class="notification-icon">${icon}</div>
                <div class="notification-content">${message}</div>
            `;
            
            // Add to notification container
            container.appendChild(notification);
            
            // Add entrance animation
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(40px)';
            
            setTimeout(() => {
                notification.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                notification.style.opacity = '1';
                notification.style.transform = 'translateX(0)';
            }, 10);
            
            // Remove after 3 seconds
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(40px)';
                
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 4000);
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
                Based on William Blau's DTI indicator as described in "Momentum, Direction and Divergence" (1995).
                This tool backtests a long-only strategy using daily & weekly DTI signals on historical stock data.
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