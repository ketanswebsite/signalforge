/**
 * Global Error Handler
 * Catches unhandled promise rejections and other errors
 */

(function() {
    'use strict';

    // Track if we've already shown an error to prevent spam
    let lastErrorTime = 0;
    const ERROR_THROTTLE_MS = 3000; // Don't show same error within 3 seconds

    /**
     * Handle unhandled promise rejections
     */
    window.addEventListener('unhandledrejection', function(event) {
        console.error('[UnhandledRejection]', event.reason);

        const now = Date.now();
        if (now - lastErrorTime < ERROR_THROTTLE_MS) {
            return; // Throttle errors
        }
        lastErrorTime = now;

        // Extract useful error message
        let message = 'An unexpected error occurred';

        if (event.reason) {
            if (event.reason.message) {
                message = event.reason.message;
            } else if (typeof event.reason === 'string') {
                message = event.reason;
            }
        }

        // Handle specific error types
        if (message.includes('401') || message.includes('Unauthorized')) {
            message = 'Your session has expired. Please log in again.';
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
        } else if (message.includes('403') || message.includes('Forbidden')) {
            message = 'You don\'t have permission to perform this action.';
        } else if (message.includes('404') || message.includes('Not Found')) {
            message = 'The requested resource was not found.';
        } else if (message.includes('500') || message.includes('Internal Server Error')) {
            message = 'Server error. Please try again later.';
        } else if (message.includes('NetworkError') || message.includes('Failed to fetch')) {
            message = 'Network error. Please check your connection and try again.';
        }

        // Show notification to user
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, 'error');
        } else if (window.TradeCore && window.TradeCore.showNotification) {
            window.TradeCore.showNotification(message, 'error');
        } else if (window.DTIBacktester && window.DTIBacktester.utils && window.DTIBacktester.utils.showNotification) {
            window.DTIBacktester.utils.showNotification(message, 'error');
        } else {
            // Fallback to alert if no notification system
            console.error(message);
        }

        // Mark as handled
        event.preventDefault();
    });

    /**
     * Handle global errors
     */
    window.addEventListener('error', function(event) {
        // Ignore script loading errors and third-party errors
        if (event.filename && (
            event.filename.includes('chrome-extension://') ||
            event.filename.includes('cdn.') ||
            event.filename.includes('google') ||
            event.filename === ''
        )) {
            return;
        }

        console.error('[GlobalError]', event.message, event.filename, event.lineno, event.colno);

        const now = Date.now();
        if (now - lastErrorTime < ERROR_THROTTLE_MS) {
            return; // Throttle errors
        }
        lastErrorTime = now;

        // Don't show technical errors to users in production
        const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1');
        if (isProduction) {
            return;
        }

        // Show notification for development
        const message = `Error: ${event.message} at ${event.filename}:${event.lineno}`;
        if (window.TradeCore && window.TradeCore.showNotification) {
            window.TradeCore.showNotification('An error occurred. Please refresh the page.', 'error');
        }
    });

    /**
     * Log API fetch errors with better context
     */
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        try {
            const response = await originalFetch.apply(this, args);

            // Log failed requests
            if (!response.ok) {
                const url = typeof args[0] === 'string' ? args[0] : args[0].url;
                console.error(`[FetchError] ${response.status} ${response.statusText} - ${url}`);

                // Clone response to read body without consuming it
                const clonedResponse = response.clone();
                try {
                    const errorData = await clonedResponse.json();
                    console.error('[FetchError] Response:', errorData);
                } catch (e) {
                    // Response is not JSON, that's fine
                }
            }

            return response;
        } catch (error) {
            const url = typeof args[0] === 'string' ? args[0] : args[0].url;
            console.error(`[FetchError] Network error - ${url}:`, error);
            throw error;
        }
    };

    /**
     * Provide a global showNotification function if none exists
     */
    if (typeof window.showNotification !== 'function') {
        window.showNotification = function(message, type = 'info') {
            // Try TradeCore first
            if (window.TradeCore && window.TradeCore.showNotification) {
                window.TradeCore.showNotification(message, type);
                return;
            }

            // Try DTIBacktester
            if (window.DTIBacktester && window.DTIBacktester.utils && window.DTIBacktester.utils.showNotification) {
                window.DTIBacktester.utils.showNotification(message, type);
                return;
            }

            // Create simple notification
            const notification = document.createElement('div');
            notification.className = `global-notification ${type}`;
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
                color: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10001;
                font-size: 14px;
                max-width: 400px;
                animation: slideIn 0.3s ease;
            `;

            document.body.appendChild(notification);

            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }, 5000);
        };

        // Add animation styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    console.log('[ErrorHandler] Global error handler initialized');
})();
