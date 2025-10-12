/**
 * XSS Protection Utilities
 * Simple text sanitization to prevent XSS attacks
 */

(function() {
    'use strict';

// Trusted HTML patterns (be very selective here)
const TRUSTED_HTML_PATTERNS = [
    // SVG icons (safe as they're from trusted sources)
    /<svg[\s\S]*?<\/svg>/i,
    // Button/UI elements with specific safe patterns
    /<button[^>]*class="[^"]*btn[^"]*"[^>]*>/i,
    // Specific safe inline styles (no JavaScript)
    /style="[^"]*(?:display|color|background|width|height|margin|padding|border)[^"]*"/i
];

/**
 * Check if HTML contains only trusted patterns
 * @param {string} html - HTML to check
 * @returns {boolean}
 */
function isTrustedHTML(html) {
    if (!html || typeof html !== 'string') return false;

    // Check if it's from our own controlled templates
    if (html.includes('data-trusted') || html.includes('data-safe')) {
        return true;
    }

    return false;
}

/**
 * Get sanitization level based on content
 * @param {string} html
 * @returns {string} 'none'|'basic'|'strict'
 */
function getSanitizationLevel(html) {
    // If it's trusted, no sanitization
    if (isTrustedHTML(html)) return 'none';

    // If it contains scripts, strict sanitization
    if (/<script|javascript:|on\w+\s*=/i.test(html)) return 'strict';

    // Basic sanitization for other HTML
    return 'basic';
}

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
    },

    /**
     * Advanced sanitization with different levels
     * @param {string} html - HTML to sanitize
     * @param {string} level - Sanitization level
     * @returns {string}
     */
    sanitizeHTML(html, level = 'basic') {
        if (!html) return '';

        if (level === 'none') return html;

        if (level === 'strict') {
            // Remove all HTML tags
            return this.sanitize(html);
        }

        // Basic sanitization - remove dangerous patterns
        let sanitized = html;

        // Remove script tags
        sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

        // Remove event handlers
        sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
        sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');

        // Remove javascript: URLs
        sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');

        // Remove data: URLs (can be used for XSS)
        sanitized = sanitized.replace(/src\s*=\s*["']data:[^"']*["']/gi, '');

        return sanitized;
    },

    /**
     * Scan for XSS vulnerabilities in code
     * @param {string} html - HTML to scan
     * @returns {Object} Scan results
     */
    scanForXSS(html) {
        const threats = [];

        if (/<script/i.test(html)) {
            threats.push({ type: 'script_tag', severity: 'high', pattern: '<script>' });
        }

        if (/on\w+\s*=/i.test(html)) {
            threats.push({ type: 'event_handler', severity: 'high', pattern: 'on*=' });
        }

        if (/javascript:/i.test(html)) {
            threats.push({ type: 'javascript_url', severity: 'high', pattern: 'javascript:' });
        }

        if (/<iframe/i.test(html)) {
            threats.push({ type: 'iframe', severity: 'medium', pattern: '<iframe>' });
        }

        if (/<embed|<object/i.test(html)) {
            threats.push({ type: 'embed_object', severity: 'medium', pattern: '<embed>/<object>' });
        }

        return {
            safe: threats.length === 0,
            threats: threats,
            level: getSanitizationLevel(html)
        };
    }
};

// Enable innerHTML monitoring in development (set XSS_DEBUG=true in console)
if (typeof window !== 'undefined' && window.XSS_DEBUG) {
    // Monitor innerHTML assignments
    const originalInnerHTMLSetter = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML').set;

    Object.defineProperty(Element.prototype, 'innerHTML', {
        set: function(value) {
            const scan = window.XSSProtection.scanForXSS(value);

            // Apply sanitization based on level
            const sanitized = window.XSSProtection.sanitizeHTML(value, scan.level);
            originalInnerHTMLSetter.call(this, sanitized);
        },
        get: function() {
            return this.innerHTML;
        }
    });

}


})();
