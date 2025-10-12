// Cookie Consent Management for UK GDPR Compliance
class CookieConsent {
    constructor() {
        this.consentKey = 'signalforge-cookie-consent';
        this.consentStatus = this.loadConsent();
        this.init();
    }

    init() {
        // Only show banner if consent not given
        if (!this.consentStatus || !this.consentStatus.timestamp) {
            this.showConsentBanner();
        }
        
        // Apply consent choices
        this.applyConsentChoices();
    }

    loadConsent() {
        try {
            const stored = localStorage.getItem(this.consentKey);
            return stored ? JSON.parse(stored) : null;
        } catch (e) {
            return null;
        }
    }

    saveConsent(consent) {
        const consentData = {
            essential: true, // Always required
            analytics: consent.analytics || false,
            functional: consent.functional || false,
            timestamp: new Date().toISOString(),
            version: '1.0'
        };
        
        localStorage.setItem(this.consentKey, JSON.stringify(consentData));
        this.consentStatus = consentData;
        this.applyConsentChoices();
        
        // Send consent to server for GDPR records
        this.recordConsentServer(consentData);
    }

    async recordConsentServer(consentData) {
        try {
            await fetch('/api/privacy/consent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(consentData)
            });
        } catch (error) {
        }
    }

    showConsentBanner() {
        const banner = document.createElement('div');
        banner.className = 'cookie-consent-banner';
        banner.innerHTML = `
            <div class="cookie-consent-content">
                <div class="cookie-consent-text">
                    <h3>🍪 Cookie Consent</h3>
                    <p>We use cookies to provide essential functionality and improve your learning experience. Under UK GDPR, we need your consent for certain cookies.</p>
                    
                    <details class="cookie-details">
                        <summary>Learn more about our cookies</summary>
                        <div class="cookie-categories">
                            <div class="cookie-category">
                                <h4>Essential Cookies (Required)</h4>
                                <p>These cookies are necessary for the website to function properly, including authentication and security features.</p>
                            </div>
                            <div class="cookie-category">
                                <h4>Functional Cookies</h4>
                                <p>These cookies remember your preferences (like theme settings) to enhance your experience.</p>
                            </div>
                            <div class="cookie-category">
                                <h4>Analytics Cookies</h4>
                                <p>These cookies help us understand how you use our educational platform to improve it.</p>
                            </div>
                        </div>
                    </details>
                </div>
                
                <div class="cookie-consent-options">
                    <label class="cookie-option">
                        <input type="checkbox" id="consent-functional" checked>
                        <span>Functional Cookies</span>
                    </label>
                    <label class="cookie-option">
                        <input type="checkbox" id="consent-analytics">
                        <span>Analytics Cookies</span>
                    </label>
                </div>
                
                <div class="cookie-consent-actions">
                    <button class="btn-cookie-settings" onclick="window.cookieConsent.showSettings()">Cookie Settings</button>
                    <button class="btn-cookie-reject" onclick="window.cookieConsent.rejectAll()">Reject Optional</button>
                    <button class="btn-cookie-accept" onclick="window.cookieConsent.acceptSelected()">Accept Selected</button>
                    <button class="btn-cookie-accept-all" onclick="window.cookieConsent.acceptAll()">Accept All</button>
                </div>
                
                <div class="cookie-consent-links">
                    <a href="/privacy.html" target="_blank">Privacy Policy</a> • 
                    <a href="/terms.html" target="_blank">Terms of Service</a>
                </div>
            </div>
        `;
        
        document.body.appendChild(banner);
        
        // Animate in
        setTimeout(() => banner.classList.add('show'), 100);
    }

    hideBanner() {
        const banner = document.querySelector('.cookie-consent-banner');
        if (banner) {
            banner.classList.remove('show');
            setTimeout(() => banner.remove(), 300);
        }
    }

    acceptAll() {
        this.saveConsent({
            analytics: true,
            functional: true
        });
        this.hideBanner();
        this.showNotification('All cookies accepted');
    }

    acceptSelected() {
        const functional = document.getElementById('consent-functional')?.checked || false;
        const analytics = document.getElementById('consent-analytics')?.checked || false;
        
        this.saveConsent({
            analytics: analytics,
            functional: functional
        });
        this.hideBanner();
        this.showNotification('Cookie preferences saved');
    }

    rejectAll() {
        this.saveConsent({
            analytics: false,
            functional: false
        });
        this.hideBanner();
        this.showNotification('Optional cookies rejected');
    }

    showSettings() {
        // Create a modal for detailed cookie settings
        const modal = document.createElement('div');
        modal.className = 'cookie-settings-modal';
        modal.innerHTML = `
            <div class="cookie-settings-content">
                <div class="cookie-settings-header">
                    <h2>Cookie Settings</h2>
                    <button class="close-btn" onclick="window.cookieConsent.closeSettings()">&times;</button>
                </div>
                
                <div class="cookie-settings-body">
                    <p>Manage your cookie preferences for SignalForge. Essential cookies cannot be disabled as they are required for the platform to function.</p>
                    
                    <div class="cookie-setting-item">
                        <div class="cookie-setting-header">
                            <h3>Essential Cookies</h3>
                            <span class="cookie-badge required">Always Active</span>
                        </div>
                        <p>Required for authentication, security, and basic functionality. These include session cookies and CSRF protection.</p>
                    </div>
                    
                    <div class="cookie-setting-item">
                        <div class="cookie-setting-header">
                            <h3>Functional Cookies</h3>
                            <label class="cookie-toggle">
                                <input type="checkbox" id="settings-functional" ${this.consentStatus?.functional ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        <p>Remember your preferences such as theme selection (dark/light mode) and language settings.</p>
                    </div>
                    
                    <div class="cookie-setting-item">
                        <div class="cookie-setting-header">
                            <h3>Analytics Cookies</h3>
                            <label class="cookie-toggle">
                                <input type="checkbox" id="settings-analytics" ${this.consentStatus?.analytics ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                        <p>Help us understand how you use the platform to improve the educational experience. No personal data is shared with third parties.</p>
                    </div>
                    
                    <div class="cookie-info">
                        <h3>Your Rights</h3>
                        <p>Under UK GDPR, you have the right to:</p>
                        <ul>
                            <li>Withdraw consent at any time</li>
                            <li>Access your personal data</li>
                            <li>Request deletion of your data</li>
                            <li>Data portability</li>
                        </ul>
                        <p>For more information, see our <a href="/privacy.html" target="_blank">Privacy Policy</a>.</p>
                    </div>
                </div>
                
                <div class="cookie-settings-footer">
                    <button class="btn-secondary" onclick="window.cookieConsent.closeSettings()">Cancel</button>
                    <button class="btn-primary" onclick="window.cookieConsent.saveSettings()">Save Settings</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);
    }

    closeSettings() {
        const modal = document.querySelector('.cookie-settings-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        }
    }

    saveSettings() {
        const functional = document.getElementById('settings-functional')?.checked || false;
        const analytics = document.getElementById('settings-analytics')?.checked || false;
        
        this.saveConsent({
            analytics: analytics,
            functional: functional
        });
        this.closeSettings();
        this.showNotification('Cookie settings updated');
    }

    applyConsentChoices() {
        if (!this.consentStatus) return;
        
        // Block analytics if not consented
        if (!this.consentStatus.analytics) {
            // Disable any analytics scripts
            window['ga-disable-GA_MEASUREMENT_ID'] = true;
            
            // Remove any analytics cookies
            this.deleteAnalyticsCookies();
        }
        
        // Handle functional cookies
        if (!this.consentStatus.functional) {
            // Only essential functionality
            // Theme will default to system preference
        }
    }

    deleteAnalyticsCookies() {
        // Delete common analytics cookies
        const analyticsCookies = ['_ga', '_gid', '_gat', '__utma', '__utmb', '__utmc', '__utmz'];
        analyticsCookies.forEach(name => {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname}`;
        });
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'cookie-notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Check if analytics consent is given
    hasAnalyticsConsent() {
        return this.consentStatus?.analytics === true;
    }

    // Check if functional consent is given
    hasFunctionalConsent() {
        return this.consentStatus?.functional === true;
    }

    // Revoke all consent (for user data deletion)
    revokeAllConsent() {
        localStorage.removeItem(this.consentKey);
        this.consentStatus = null;
        this.deleteAnalyticsCookies();
        window.location.reload();
    }
}

// Initialize cookie consent when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.cookieConsent = new CookieConsent();
    });
} else {
    window.cookieConsent = new CookieConsent();
}