/**
 * AbortController Manager
 * Manages request cancellation for long-running operations
 */

(function() {
    'use strict';

    /**
     * AbortController Manager for handling request cancellation
     */
    class AbortControllerManager {
        constructor() {
            this.controllers = new Map(); // operationId -> AbortController
        }

        /**
         * Create a new AbortController for an operation
         * @param {string} operationId - Unique identifier for the operation
         * @param {number} timeout - Optional timeout in milliseconds
         * @returns {AbortSignal} The abort signal to use with fetch
         */
        createController(operationId, timeout = null) {
            // Cancel any existing operation with the same ID
            this.abort(operationId);

            const controller = new AbortController();
            this.controllers.set(operationId, controller);

            // Set timeout if specified
            if (timeout) {
                setTimeout(() => {
                    this.abort(operationId, 'Operation timed out');
                }, timeout);
            }

            return controller.signal;
        }

        /**
         * Abort an operation
         * @param {string} operationId - Operation to abort
         * @param {string} reason - Optional reason for abortion
         */
        abort(operationId, reason = 'Operation cancelled') {
            const controller = this.controllers.get(operationId);
            if (controller) {
                controller.abort(reason);
                this.controllers.delete(operationId);
            }
        }

        /**
         * Abort all operations
         * @param {string} reason - Optional reason for abortion
         */
        abortAll(reason = 'All operations cancelled') {
            this.controllers.forEach((controller, operationId) => {
                controller.abort(reason);
            });
            this.controllers.clear();
        }

        /**
         * Check if an operation is active
         * @param {string} operationId - Operation to check
         * @returns {boolean} True if operation is active
         */
        isActive(operationId) {
            return this.controllers.has(operationId);
        }

        /**
         * Fetch with automatic abort control
         * @param {string} operationId - Unique operation ID
         * @param {string} url - URL to fetch
         * @param {Object} options - Fetch options
         * @param {number} timeout - Optional timeout in milliseconds
         * @returns {Promise<Response>} Fetch response
         */
        async fetch(operationId, url, options = {}, timeout = null) {
            const signal = this.createController(operationId, timeout);

            try {
                const response = await fetch(url, {
                    ...options,
                    signal
                });

                // Clean up controller on success
                this.controllers.delete(operationId);

                return response;
            } catch (error) {
                // Clean up controller on error
                this.controllers.delete(operationId);

                // Re-throw the error for handling upstream
                throw error;
            }
        }

        /**
         * Create a cancel button for an operation
         * @param {string} operationId - Operation to cancel
         * @param {string} buttonText - Button text (default: "Cancel")
         * @returns {HTMLElement} Cancel button element
         */
        createCancelButton(operationId, buttonText = 'Cancel') {
            const button = document.createElement('button');
            button.className = 'btn btn-secondary btn-sm cancel-operation-btn';
            button.textContent = buttonText;
            button.onclick = () => this.abort(operationId);
            return button;
        }
    }

    // Create global instance
    window.AbortManager = new AbortControllerManager();

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        window.AbortManager.abortAll('Page unloading');
    });

})();
