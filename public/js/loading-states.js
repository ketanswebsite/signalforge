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
const loadingStyles = document.createElement('style');
loadingStyles.textContent = `
    /* Button Loading State */
    button.loading {
        position: relative;
        pointer-events: none;
        opacity: 0.7;
    }

    /* Spinner Animation */
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    @keyframes spin-dash {
        0% { stroke-dashoffset: 0; }
        100% { stroke-dashoffset: -62.8; }
    }

    .spinner, .spinner-large, .spinner-small {
        display: inline-block;
        vertical-align: middle;
    }

    .spinner {
        animation: spin 1s linear infinite;
    }

    .spinner-large {
        animation: spin 1s linear infinite;
    }

    .spinner-small {
        animation: spin 1s linear infinite;
    }

    .spinner-head, .spinner-large .spinner-head, .spinner-small .spinner-head {
        animation: spin-dash 1.5s ease-in-out infinite;
    }

    /* Global Loading Overlay */
    .global-loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(15, 23, 42, 0.75);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
    }

    .global-loading-overlay.active {
        opacity: 1;
        pointer-events: all;
    }

    .global-loading-content {
        background: white;
        padding: 2rem;
        border-radius: 12px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
        text-align: center;
        min-width: 200px;
    }

    .global-loading-message {
        margin-top: 1rem;
        font-size: 1rem;
        font-weight: 500;
        color: #334155;
    }

    /* Inline Loader */
    .inline-loader {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        background: #f1f5f9;
        border-radius: 6px;
        font-size: 0.875rem;
        color: #475569;
        margin: 0.5rem 0;
    }

    .inline-loader-message {
        font-weight: 500;
    }

    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
        .global-loading-content {
            background: #1e293b;
        }

        .global-loading-message {
            color: #e2e8f0;
        }

        .inline-loader {
            background: #1e293b;
            color: #cbd5e1;
        }
    }

    /* Theme-aware styles */
    [data-theme="dark"] .global-loading-content {
        background: #1e293b;
    }

    [data-theme="dark"] .global-loading-message {
        color: #e2e8f0;
    }

    [data-theme="dark"] .inline-loader {
        background: #1e293b;
        color: #cbd5e1;
    }
`;

document.head.appendChild(loadingStyles);
