/**
 * XSS Protection Utilities
 * Simple text sanitization to prevent XSS attacks
 */

window.XSSProtection = {
    /**
     * Escape HTML special characters to prevent XSS
     * @param {string} text - Raw text input
     * @returns {string} - Sanitized text safe for innerHTML
     */
    escapeHTML(text) {
        if (text === null || text === undefined) return '';

        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Sanitize user input for display
     * @param {string} input - User input
     * @returns {string} - Sanitized string
     */
    sanitize(input) {
        if (typeof input !== 'string') return '';

        return input
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    },

    /**
     * Safely set text content (preferred method)
     * @param {HTMLElement} element - Target element
     * @param {string} text - Text to set
     */
    setText(element, text) {
        if (element) {
            element.textContent = text || '';
        }
    },

    /**
     * Safely set HTML with sanitization
     * @param {HTMLElement} element - Target element
     * @param {string} html - HTML string
     */
    setHTML(element, html) {
        if (element) {
            element.innerHTML = this.sanitize(html);
        }
    },

    /**
     * Create element with safe text
     * @param {string} tagName - Element tag name
     * @param {string} text - Text content
     * @param {string} className - Optional class name
     * @returns {HTMLElement}
     */
    createElement(tagName, text, className = '') {
        const el = document.createElement(tagName);
        if (text) el.textContent = text;
        if (className) el.className = className;
        return el;
    }
};
