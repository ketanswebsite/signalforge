/**
 * Accessibility Enhancer
 * Adds ARIA labels and improves accessibility across the application
 */

(function() {
    'use strict';

    /**
     * Accessibility enhancement utilities
     */
    window.AccessibilityEnhancer = {
        /**
         * Add ARIA label to an element
         * @param {HTMLElement} element - Element to enhance
         * @param {string} label - ARIA label text
         * @param {Object} options - Additional ARIA attributes
         */
        addLabel(element, label, options = {}) {
            if (!element) return;

            element.setAttribute('aria-label', label);

            // Add optional ARIA attributes
            if (options.role) element.setAttribute('role', options.role);
            if (options.describedby) element.setAttribute('aria-describedby', options.describedby);
            if (options.controls) element.setAttribute('aria-controls', options.controls);
            if (options.expanded !== undefined) element.setAttribute('aria-expanded', options.expanded);
            if (options.pressed !== undefined) element.setAttribute('aria-pressed', options.pressed);
            if (options.live) element.setAttribute('aria-live', options.live);
            if (options.atomic !== undefined) element.setAttribute('aria-atomic', options.atomic);
        },

        /**
         * Enhance form inputs with proper labels and descriptions
         * @param {HTMLElement} form - Form element or container
         */
        enhanceForm(form) {
            if (!form) return;

            // Enhance inputs
            const inputs = form.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                const id = input.id;
                const label = form.querySelector(`label[for="${id}"]`);

                // Add aria-label if no visible label exists
                if (!label && id) {
                    const labelText = this.generateLabelFromId(id);
                    this.addLabel(input, labelText);
                }

                // Add aria-required for required fields
                if (input.hasAttribute('required')) {
                    input.setAttribute('aria-required', 'true');
                }

                // Add aria-invalid for validation
                if (input.classList.contains('error') || input.classList.contains('invalid')) {
                    input.setAttribute('aria-invalid', 'true');
                }
            });
        },

        /**
         * Generate human-readable label from element ID
         * @param {string} id - Element ID
         * @returns {string} Human-readable label
         */
        generateLabelFromId(id) {
            return id
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        },

        /**
         * Enhance buttons with descriptive labels
         */
        enhanceButtons() {
            const buttons = document.querySelectorAll('button:not([aria-label])');

            buttons.forEach(button => {
                // Skip if already has aria-label
                if (button.hasAttribute('aria-label')) return;

                // Get button text or title
                const text = button.textContent.trim() || button.title || button.getAttribute('data-action');

                if (text) {
                    this.addLabel(button, text);
                }

                // Add role=button for elements that look like buttons
                if (!button.getAttribute('role') && button.classList.contains('btn')) {
                    button.setAttribute('role', 'button');
                }
            });
        },

        /**
         * Enhance interactive elements (links, tabs, etc.)
         */
        enhanceInteractive() {
            // Enhance tabs
            const tabs = document.querySelectorAll('[data-tab], [role="tab"]');
            tabs.forEach(tab => {
                if (!tab.getAttribute('role')) {
                    tab.setAttribute('role', 'tab');
                }

                const isActive = tab.classList.contains('active');
                tab.setAttribute('aria-selected', isActive.toString());

                const panel = tab.getAttribute('data-tab');
                if (panel) {
                    tab.setAttribute('aria-controls', panel);
                }
            });

            // Enhance dialogs/modals
            const dialogs = document.querySelectorAll('.dialog-overlay, .modal, [role="dialog"]');
            dialogs.forEach(dialog => {
                if (!dialog.getAttribute('role')) {
                    dialog.setAttribute('role', 'dialog');
                }

                const isVisible = dialog.classList.contains('active') || dialog.style.display !== 'none';
                dialog.setAttribute('aria-hidden', (!isVisible).toString());
                dialog.setAttribute('aria-modal', 'true');
            });
        },

        /**
         * Enhance status/notification regions
         */
        enhanceStatusRegions() {
            // Notification areas
            const notifications = document.querySelectorAll('.notification, .alert, .toast, [data-notification]');
            notifications.forEach(notif => {
                if (!notif.getAttribute('role')) {
                    notif.setAttribute('role', 'status');
                }
                notif.setAttribute('aria-live', 'polite');
                notif.setAttribute('aria-atomic', 'true');
            });

            // Loading indicators
            const loaders = document.querySelectorAll('.loading, .spinner, [data-loading]');
            loaders.forEach(loader => {
                if (!loader.getAttribute('role')) {
                    loader.setAttribute('role', 'status');
                }
                loader.setAttribute('aria-live', 'polite');
                loader.setAttribute('aria-label', 'Loading');
            });
        },

        /**
         * Enhance data tables
         */
        enhanceTables() {
            const tables = document.querySelectorAll('table:not([role])');
            tables.forEach(table => {
                table.setAttribute('role', 'table');

                // Add caption if missing
                if (!table.querySelector('caption')) {
                    const caption = document.createElement('caption');
                    caption.className = 'sr-only';
                    caption.textContent = table.getAttribute('data-caption') || 'Data Table';
                    table.insertBefore(caption, table.firstChild);
                }
            });
        },

        /**
         * Add keyboard navigation hints
         */
        addKeyboardHints(element, hint) {
            if (!element) return;

            element.setAttribute('title', hint);
            element.setAttribute('aria-keyshortcuts', hint.split('(')[1]?.replace(')', '') || '');
        },

        /**
         * Run all enhancements
         */
        enhanceAll() {
            this.enhanceButtons();
            this.enhanceInteractive();
            this.enhanceStatusRegions();
            this.enhanceTables();

            // Enhance all forms
            const forms = document.querySelectorAll('form');
            forms.forEach(form => this.enhanceForm(form));

        },

        /**
         * Initialize and observe for dynamic content
         */
        init() {
            // Run initial enhancement
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.enhanceAll());
            } else {
                this.enhanceAll();
            }

            // Observe for dynamically added elements
            if (typeof MutationObserver !== 'undefined' && document.body) {
                const observer = new MutationObserver((mutations) => {
                    let shouldEnhance = false;

                    mutations.forEach(mutation => {
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === 1) { // Element node
                                shouldEnhance = true;
                            }
                        });
                    });

                    if (shouldEnhance) {
                        // Debounce enhancements
                        clearTimeout(this._enhanceTimeout);
                        this._enhanceTimeout = setTimeout(() => {
                            this.enhanceAll();
                        }, 100);
                    }
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });

                this._observer = observer;
            }

        },

        /**
         * Cleanup
         */
        destroy() {
            if (this._observer) {
                this._observer.disconnect();
            }
            clearTimeout(this._enhanceTimeout);
        }
    };

    // Auto-initialize
    AccessibilityEnhancer.init();
})();
