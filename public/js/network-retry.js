/**
 * Network Retry Logic with Exponential Backoff
 * Automatically retries failed network requests
 */

(function() {
    'use strict';

    /**
     * Network Retry Manager
     */
    class NetworkRetry {
        constructor() {
            this.defaultOptions = {
                maxRetries: 3,
                baseDelay: 1000, // 1 second
                maxDelay: 10000, // 10 seconds
                retryOn: [408, 429, 500, 502, 503, 504], // HTTP status codes to retry
                shouldRetry: null, // Custom retry condition function
                onRetry: null // Callback for retry attempts
            };
        }

        /**
         * Calculate exponential backoff delay
         * @param {number} attempt - Current attempt number (0-based)
         * @param {number} baseDelay - Base delay in milliseconds
         * @param {number} maxDelay - Maximum delay in milliseconds
         * @returns {number} Delay in milliseconds
         */
        calculateBackoff(attempt, baseDelay, maxDelay) {
            // Exponential backoff: baseDelay * 2^attempt + random jitter
            const exponentialDelay = baseDelay * Math.pow(2, attempt);
            const jitter = Math.random() * 1000; // Add 0-1s random jitter
            const delay = Math.min(exponentialDelay + jitter, maxDelay);
            return delay;
        }

        /**
         * Sleep for specified duration
         * @param {number} ms - Milliseconds to sleep
         * @returns {Promise<void>}
         */
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        /**
         * Fetch with automatic retry and exponential backoff
         * @param {string} url - URL to fetch
         * @param {Object} fetchOptions - Fetch options
         * @param {Object} retryOptions - Retry configuration
         * @returns {Promise<Response>} Fetch response
         */
        async fetch(url, fetchOptions = {}, retryOptions = {}) {
            const options = { ...this.defaultOptions, ...retryOptions };
            let lastError = null;

            for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
                try {
                    const response = await fetch(url, fetchOptions);

                    // Check if we should retry based on status code
                    const shouldRetryStatus = options.retryOn.includes(response.status);
                    const shouldRetryCustom = options.shouldRetry ? options.shouldRetry(response, attempt) : false;

                    if (!response.ok && (shouldRetryStatus || shouldRetryCustom) && attempt < options.maxRetries) {
                        const delay = this.calculateBackoff(attempt, options.baseDelay, options.maxDelay);

                        console.warn(`[NetworkRetry] Attempt ${attempt + 1}/${options.maxRetries} failed with status ${response.status}. Retrying in ${Math.round(delay)}ms...`);

                        // Call retry callback if provided
                        if (options.onRetry) {
                            options.onRetry(attempt + 1, delay, response.status, url);
                        }

                        await this.sleep(delay);
                        continue;
                    }

                    // Success or non-retryable error
                    return response;

                } catch (error) {
                    lastError = error;

                    // Don't retry on AbortError
                    if (error.name === 'AbortError') {
                        throw error;
                    }

                    // Check if this is the last attempt
                    if (attempt >= options.maxRetries) {
                        console.error(`[NetworkRetry] All ${options.maxRetries} retry attempts failed for ${url}:`, error);
                        throw error;
                    }

                    const delay = this.calculateBackoff(attempt, options.baseDelay, options.maxDelay);

                    console.warn(`[NetworkRetry] Attempt ${attempt + 1}/${options.maxRetries} failed with error: ${error.message}. Retrying in ${Math.round(delay)}ms...`);

                    // Call retry callback if provided
                    if (options.onRetry) {
                        options.onRetry(attempt + 1, delay, error.message, url);
                    }

                    await this.sleep(delay);
                }
            }

            // Should never reach here, but throw last error just in case
            throw lastError;
        }

        /**
         * Fetch JSON with retry logic
         * @param {string} url - URL to fetch
         * @param {Object} fetchOptions - Fetch options
         * @param {Object} retryOptions - Retry configuration
         * @returns {Promise<any>} Parsed JSON response
         */
        async fetchJSON(url, fetchOptions = {}, retryOptions = {}) {
            const response = await this.fetch(url, fetchOptions, retryOptions);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        }

        /**
         * Create a retry-enabled fetch wrapper with custom options
         * @param {Object} customOptions - Default retry options for this wrapper
         * @returns {Function} Configured fetch function
         */
        createWrapper(customOptions = {}) {
            const options = { ...this.defaultOptions, ...customOptions };
            return (url, fetchOptions = {}) => this.fetch(url, fetchOptions, options);
        }
    }

    // Create global instance
    window.NetworkRetry = new NetworkRetry();

    // Create a convenient shorthand
    window.retryFetch = (url, fetchOptions = {}, retryOptions = {}) => {
        return window.NetworkRetry.fetch(url, fetchOptions, retryOptions);
    };

    console.log('[NetworkRetry] Network retry manager initialized');
})();
