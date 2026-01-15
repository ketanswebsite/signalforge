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

        // Show notification to user (NotificationManager provides window.showNotification)
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, 'error');
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
        if (typeof window.showNotification === 'function') {
            window.showNotification('An error occurred. Please refresh the page.', 'error');
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

                // Clone response to read body without consuming it
                const clonedResponse = response.clone();
                try {
                    const errorData = await clonedResponse.json();
                } catch (e) {
                    // Response is not JSON, that's fine
                }
            }

            return response;
        } catch (error) {
            const url = typeof args[0] === 'string' ? args[0] : args[0].url;
            throw error;
        }
    };

    // Note: window.showNotification is now provided by NotificationManager (utils/notifications.js)

})();
