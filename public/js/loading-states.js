/**
 * Loading States Manager
 * Handles button loading states and prevents duplicate submissions
 */

window.LoadingStates = {
    /**
     * Set button to loading state
     * @param {HTMLButtonElement} button - Button element
     * @param {string} loadingText - Optional text to show during loading
     */
    setLoading(button, loadingText = 'Loading...') {
        if (!button) return;

        // Store original content
        button.dataset.originalContent = button.innerHTML;
        button.dataset.originalText = button.textContent;

        // Disable button
        button.disabled = true;
        button.classList.add('loading');

        // Add spinner and text
        button.innerHTML = `
            <svg class="spinner" width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <circle class="spinner-track" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" opacity="0.25"/>
                <circle class="spinner-head" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" opacity="0.75" stroke-dasharray="31.4" stroke-dashoffset="0"/>
            </svg>
            <span class="loading-text">${loadingText}</span>
        `;
    },

    /**
     * Reset button from loading state
     * @param {HTMLButtonElement} button - Button element
     */
    clearLoading(button) {
        if (!button) return;

        // Restore original content
        if (button.dataset.originalContent) {
            button.innerHTML = button.dataset.originalContent;
            delete button.dataset.originalContent;
            delete button.dataset.originalText;
        }

        // Re-enable button
        button.disabled = false;
        button.classList.remove('loading');
    },

    /**
     * Wrap async function with loading state
     * @param {HTMLButtonElement} button - Button element
     * @param {Function} asyncFn - Async function to execute
     * @param {string} loadingText - Optional loading text
     * @returns {Promise}
     */
    async withLoading(button, asyncFn, loadingText = 'Loading...') {
        if (!button || button.disabled) return;

        this.setLoading(button, loadingText);

        try {
            const result = await asyncFn();
            return result;
        } catch (error) {
            throw error;
        } finally {
            this.clearLoading(button);
        }
    },

    /**
     * Show global loading overlay
     * @param {string} message - Loading message
     */
    showGlobalLoading(message = 'Processing...') {
        let overlay = document.getElementById('global-loading-overlay');

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'global-loading-overlay';
            overlay.className = 'global-loading-overlay';
            overlay.innerHTML = `
                <div class="global-loading-content">
                    <svg class="spinner-large" width="48" height="48" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <circle class="spinner-track" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" opacity="0.25"/>
                        <circle class="spinner-head" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" opacity="0.75" stroke-dasharray="31.4" stroke-dashoffset="0"/>
                    </svg>
                    <div class="global-loading-message">${message}</div>
                </div>
            `;
            document.body.appendChild(overlay);
        } else {
            const messageEl = overlay.querySelector('.global-loading-message');
            if (messageEl) messageEl.textContent = message;
        }

        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    /**
     * Hide global loading overlay
     */
    hideGlobalLoading() {
        const overlay = document.getElementById('global-loading-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    /**
     * Show inline loading indicator
     * @param {HTMLElement} container - Container element
     * @param {string} message - Loading message
     * @returns {HTMLElement} - Loading indicator element
     */
    showInlineLoading(container, message = 'Loading...') {
        if (!container) return null;

        const loader = document.createElement('div');
        loader.className = 'inline-loader';
        loader.innerHTML = `
            <svg class="spinner-small" width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <circle class="spinner-track" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" opacity="0.25"/>
                <circle class="spinner-head" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" opacity="0.75" stroke-dasharray="31.4" stroke-dashoffset="0"/>
            </svg>
            <span class="inline-loader-message">${message}</span>
        `;

        container.appendChild(loader);
        return loader;
    },

    /**
     * Remove inline loading indicator
     * @param {HTMLElement} loader - Loading indicator element
     */
    hideInlineLoading(loader) {
        if (loader && loader.parentElement) {
            loader.remove();
        }
    }
};

// Add CSS styles dynamically

