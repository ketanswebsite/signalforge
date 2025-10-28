/**
 * Account Page JavaScript
 * Manages tabs, subscription, payment information, and user settings
 */

/**
 * Tab Manager
 * Handles tab switching and URL hash navigation
 */
class TabManager {
    constructor() {
        this.tabs = document.querySelectorAll('.tab-item');
        this.panels = document.querySelectorAll('.tab-panel');

        this.init();
    }

    init() {
        this.tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });

        window.addEventListener('hashchange', () => {
            this.handleHashChange();
        });

        this.handleHashChange();
    }

    switchTab(tabName) {
        this.tabs.forEach(tab => {
            const isActive = tab.dataset.tab === tabName;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive);
        });

        this.panels.forEach(panel => {
            const panelId = panel.id.replace('-panel', '');
            panel.classList.toggle('active', panelId === tabName);
        });

        window.location.hash = tabName;
    }

    handleHashChange() {
        const hash = window.location.hash.replace('#', '') || 'overview';
        const validTabs = ['overview', 'billing', 'settings', 'account'];

        if (validTabs.includes(hash)) {
            this.switchTab(hash);
        }
    }
}

/**
 * Collapsible Section Manager
 * Handles expanding/collapsing settings sections
 */
class CollapsibleManager {
    constructor() {
        this.sections = document.querySelectorAll('.collapsible-section');
        this.init();
    }

    init() {
        this.sections.forEach(section => {
            const header = section.querySelector('.collapsible-header');

            header.addEventListener('click', () => {
                this.toggle(section);
            });
        });
    }

    toggle(section) {
        section.classList.toggle('expanded');
    }
}

/**
 * Settings Manager
 * Handles all user preferences and settings
 */
class SettingsManager {
    constructor() {
        this.defaults = {
            darkMode: this.isDarkModePreferred(),
            reduceAnimations: false,
            highContrast: false,
            fontSize: 'medium',
            emailNotifications: true,
            browserNotifications: false,
            tradeAlerts: true,
            newsletterSubscription: false,
            analyticsTracking: true,
            cookieConsent: true,
            savePreferences: true,
            screenReaderMode: false,
            keyboardShortcuts: true,
            focusIndicators: true,
            autoPlayDisable: false,
            chartTheme: 'auto',
            showGrid: true,
            smoothAnimations: true,
            defaultTimeframe: '1M',
            language: 'en',
            timezone: 'Asia/Kolkata',
            currency: 'INR'
        };

        this.currentSettings = this.loadSettings();
        this.init();
    }

    isDarkModePreferred() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    init() {
        this.applySettings();
        this.setupSettingsListeners();
        this.syncSettingsToUI();
    }

    loadSettings() {
        const stored = localStorage.getItem('userSettings');
        if (stored) {
            try {
                return { ...this.defaults, ...JSON.parse(stored) };
            } catch (e) {
                console.error('Error parsing stored settings:', e);
            }
        }
        return { ...this.defaults };
    }

    saveSettings() {
        if (this.currentSettings.savePreferences) {
            localStorage.setItem('userSettings', JSON.stringify(this.currentSettings));
            this.showNotification('Settings saved successfully!', 'success');
        }
    }

    syncSettingsToUI() {
        Object.keys(this.currentSettings).forEach(key => {
            const element = document.getElementById(this.settingIdMap(key));
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = this.currentSettings[key];
                } else if (element.tagName === 'SELECT') {
                    element.value = this.currentSettings[key];
                }
            }
        });
    }

    settingIdMap(settingKey) {
        const map = {
            darkMode: 'dark-mode-setting',
            reduceAnimations: 'reduce-animations',
            highContrast: 'high-contrast',
            fontSize: 'font-size-setting',
            emailNotifications: 'email-notifications',
            browserNotifications: 'browser-notifications',
            tradeAlerts: 'trade-alerts',
            newsletterSubscription: 'newsletter-subscription',
            analyticsTracking: 'analytics-tracking',
            cookieConsent: 'cookie-consent',
            savePreferences: 'save-preferences',
            screenReaderMode: 'screen-reader-mode',
            keyboardShortcuts: 'keyboard-shortcuts',
            focusIndicators: 'focus-indicators',
            autoPlayDisable: 'auto-play-disable',
            chartTheme: 'chart-theme-setting',
            showGrid: 'show-grid',
            smoothAnimations: 'smooth-animations',
            defaultTimeframe: 'default-timeframe',
            language: 'language-setting',
            timezone: 'timezone-setting',
            currency: 'currency-setting'
        };
        return map[settingKey] || settingKey;
    }

    setupSettingsListeners() {
        this.addListener('dark-mode-setting', (checked) => {
            this.currentSettings.darkMode = checked;
            this.applyTheme();
        });

        this.addListener('reduce-animations', (checked) => {
            this.currentSettings.reduceAnimations = checked;
            this.applyAnimationPreferences();
        });

        this.addListener('high-contrast', (checked) => {
            this.currentSettings.highContrast = checked;
            this.applyHighContrast();
        });

        this.addSelectListener('font-size-setting', (value) => {
            this.currentSettings.fontSize = value;
            this.applyFontSize();
        });

        this.addListener('email-notifications', (checked) => {
            this.currentSettings.emailNotifications = checked;
        });

        this.addListener('browser-notifications', async (checked) => {
            if (checked && 'Notification' in window) {
                const permission = await Notification.requestPermission();
                this.currentSettings.browserNotifications = permission === 'granted';
            } else {
                this.currentSettings.browserNotifications = false;
            }
        });

        this.addListener('trade-alerts', (checked) => {
            this.currentSettings.tradeAlerts = checked;
        });

        this.addListener('newsletter-subscription', (checked) => {
            this.currentSettings.newsletterSubscription = checked;
        });

        this.addListener('analytics-tracking', (checked) => {
            this.currentSettings.analyticsTracking = checked;
        });

        this.addListener('cookie-consent', (checked) => {
            this.currentSettings.cookieConsent = checked;
        });

        this.addListener('save-preferences', (checked) => {
            this.currentSettings.savePreferences = checked;
        });

        this.addListener('screen-reader-mode', (checked) => {
            this.currentSettings.screenReaderMode = checked;
            this.applyAccessibilitySettings();
        });

        this.addListener('keyboard-shortcuts', (checked) => {
            this.currentSettings.keyboardShortcuts = checked;
        });

        this.addListener('focus-indicators', (checked) => {
            this.currentSettings.focusIndicators = checked;
            this.applyFocusIndicators();
        });

        this.addListener('auto-play-disable', (checked) => {
            this.currentSettings.autoPlayDisable = checked;
        });

        this.addSelectListener('chart-theme-setting', (value) => {
            this.currentSettings.chartTheme = value;
        });

        this.addListener('show-grid', (checked) => {
            this.currentSettings.showGrid = checked;
        });

        this.addListener('smooth-animations', (checked) => {
            this.currentSettings.smoothAnimations = checked;
        });

        this.addSelectListener('default-timeframe', (value) => {
            this.currentSettings.defaultTimeframe = value;
        });

        this.addSelectListener('language-setting', (value) => {
            this.currentSettings.language = value;
            this.showNotification('Language preference saved. Full translation coming soon!', 'info');
        });

        this.addSelectListener('timezone-setting', (value) => {
            this.currentSettings.timezone = value;
        });

        this.addSelectListener('currency-setting', (value) => {
            this.currentSettings.currency = value;
        });

        document.getElementById('save-settings-btn')?.addEventListener('click', () => {
            this.saveSettings();
        });

        document.getElementById('reset-settings-btn')?.addEventListener('click', () => {
            this.resetSettings();
        });

        document.getElementById('export-data-btn')?.addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('export-data-btn-settings')?.addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('clear-cache-btn')?.addEventListener('click', () => {
            this.clearCache();
        });

        document.getElementById('clear-cache-btn-settings')?.addEventListener('click', () => {
            this.clearCache();
        });

        document.getElementById('delete-account-btn')?.addEventListener('click', () => {
            document.getElementById('delete-account-modal').classList.add('active');
        });

        const deleteInput = document.getElementById('delete-confirmation');
        const deleteBtn = document.getElementById('confirm-delete-btn');

        deleteInput?.addEventListener('input', (e) => {
            deleteBtn.disabled = e.target.value !== 'DELETE';
        });

        deleteBtn?.addEventListener('click', () => {
            this.deleteAccount();
        });
    }

    addListener(id, callback) {
        const element = document.getElementById(id);
        if (element && element.type === 'checkbox') {
            element.addEventListener('change', (e) => {
                callback(e.target.checked);
                this.saveSettings();
            });
        }
    }

    addSelectListener(id, callback) {
        const element = document.getElementById(id);
        if (element && element.tagName === 'SELECT') {
            element.addEventListener('change', (e) => {
                callback(e.target.value);
                this.saveSettings();
            });
        }
    }

    applySettings() {
        this.applyTheme();
        this.applyFontSize();
        this.applyAnimationPreferences();
        this.applyHighContrast();
        this.applyFocusIndicators();
        this.applyAccessibilitySettings();
    }

    applyTheme() {
        if (this.currentSettings.darkMode) {
            document.body.classList.add('dark-theme');
            document.body.classList.remove('light-theme');
        } else {
            document.body.classList.add('light-theme');
            document.body.classList.remove('dark-theme');
        }
    }

    applyFontSize() {
        const root = document.documentElement;
        const sizes = {
            'small': '14px',
            'medium': '16px',
            'large': '18px',
            'extra-large': '20px'
        };
        root.style.fontSize = sizes[this.currentSettings.fontSize] || '16px';
    }

    applyAnimationPreferences() {
        if (this.currentSettings.reduceAnimations) {
            document.body.classList.add('reduce-motion');
        } else {
            document.body.classList.remove('reduce-motion');
        }
    }

    applyHighContrast() {
        if (this.currentSettings.highContrast) {
            document.body.classList.add('high-contrast');
        } else {
            document.body.classList.remove('high-contrast');
        }
    }

    applyFocusIndicators() {
        if (this.currentSettings.focusIndicators) {
            document.body.classList.add('enhanced-focus');
        } else {
            document.body.classList.remove('enhanced-focus');
        }
    }

    applyAccessibilitySettings() {
        if (this.currentSettings.screenReaderMode) {
            document.body.classList.add('screen-reader-mode');
        } else {
            document.body.classList.remove('screen-reader-mode');
        }
    }

    resetSettings() {
        if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
            this.currentSettings = { ...this.defaults };
            this.saveSettings();
            this.syncSettingsToUI();
            this.applySettings();
            this.showNotification('Settings reset to defaults', 'success');
        }
    }

    exportData() {
        const data = {
            settings: this.currentSettings,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sutralgo-settings-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification('Settings exported successfully', 'success');
    }

    clearCache() {
        if (confirm('This will clear all cached data. Are you sure?')) {
            if ('caches' in window) {
                caches.keys().then(names => {
                    names.forEach(name => caches.delete(name));
                });
            }
            this.showNotification('Cache cleared successfully', 'success');
        }
    }

    async deleteAccount() {
        try {
            const response = await fetch('/api/user/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (data.success) {
                localStorage.clear();
                sessionStorage.clear();
                alert('Your account has been deleted. You will be redirected to the home page.');
                window.location.href = '/';
            } else {
                throw new Error(data.error?.message || 'Failed to delete account');
            }
        } catch (error) {
            console.error('Error deleting account:', error);
            alert('Failed to delete account: ' + error.message);
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: var(--bg-secondary);
            border-left: 4px solid var(--${type === 'success' ? 'success' : type === 'error' ? 'error' : 'accent-gold'});
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            color: var(--text-primary);
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

class AccountPage {
    constructor() {
        this.subscription = null;
        this.payments = [];
        this.settingsManager = new SettingsManager();
        this.tabManager = new TabManager();
        this.collapsibleManager = new CollapsibleManager();

        this.init();
    }

    async init() {
        try {
            await Promise.all([
                this.loadSubscription(),
                this.loadPaymentHistory()
            ]);

            this.setupEventListeners();
        } catch (error) {
            console.error('Account page initialization error:', error);
        }
    }

    async loadSubscription() {
        try {
            const response = await fetch('/api/user/subscription');

            if (response.status === 401) {
                document.getElementById('subscription-hero').innerHTML = this.renderLoginRequired();
                document.getElementById('subscription-full-details').innerHTML = this.renderLoginRequired();
                return;
            }

            const data = await response.json();

            // Store admin status
            this.isAdmin = data.data.isAdmin || false;

            if (data.success && data.data.hasSubscription) {
                this.subscription = data.data.subscription;
                this.renderHeroSubscriptionCard();
                this.renderFullSubscriptionDetails();
                this.renderQuickStats();
            } else if (this.isAdmin) {
                // Admin with no subscription - show admin status
                document.getElementById('subscription-hero').innerHTML = this.renderAdminStatus();
                document.getElementById('subscription-full-details').innerHTML = this.renderAdminStatus();
            } else {
                document.getElementById('subscription-hero').innerHTML = this.renderNoSubscription();
                document.getElementById('subscription-full-details').innerHTML = this.renderNoSubscription();
            }
        } catch (error) {
            console.error('Error loading subscription:', error);
            document.getElementById('subscription-hero').innerHTML = this.renderError('Failed to load subscription');
            document.getElementById('subscription-full-details').innerHTML = this.renderError('Failed to load subscription');
        }
    }

    async loadPaymentHistory() {
        try {
            const response = await fetch('/api/user/payments');

            if (response.status === 401) {
                document.getElementById('payment-history-content').innerHTML = this.renderLoginRequired();
                return;
            }

            const data = await response.json();

            const contentDiv = document.getElementById('payment-history-content');

            if (data.success && data.payments && data.payments.length > 0) {
                this.payments = data.payments;
                this.renderPaymentHistory();
                this.renderRecentPayment();
            } else if (data.success) {
                contentDiv.innerHTML = this.renderEmptyPayments();
            } else {
                contentDiv.innerHTML = this.renderError('Unable to load payment history');
            }
        } catch (error) {
            console.error('Error loading payment history:', error);
            document.getElementById('payment-history-content').innerHTML = this.renderError('Failed to load payment history');
        }
    }

    renderHeroSubscriptionCard() {
        const sub = this.subscription;
        const isTrial = sub.status === 'trial';
        const isCancelled = sub.status === 'cancelled';
        const isActive = sub.status === 'active';
        const isExpired = sub.status === 'expired';

        const currencySymbol = this.getCurrencySymbol(sub.currency);
        const nextBillingDate = new Date(sub.subscription_end_date);
        const daysUntilRenewal = Math.ceil((nextBillingDate - new Date()) / (1000 * 60 * 60 * 24));

        const statusClass = isTrial ? 'trial' : isActive ? 'active' : isCancelled ? 'cancelled' : 'expired';
        const statusBadgeHTML = `
            <div class="status-badge ${statusClass}">
                <span class="material-icons" style="font-size: 1rem;">circle</span>
                ${this.formatStatus(sub.status)}
            </div>
        `;

        let alertHTML = '';
        if (this.isAdmin) {
            alertHTML = `
                <div class="alert alert-success" style="margin-bottom: 1.5rem;">
                    <span class="material-icons">verified_user</span>
                    <div>
                        <strong>Admin Access - Unlimited</strong><br>
                        You have administrator privileges with full access to all features.
                    </div>
                </div>
            `;
        } else if (isTrial) {
            alertHTML = `
                <div class="alert alert-info" style="margin-bottom: 1.5rem;">
                    <span class="material-icons">info</span>
                    <div>
                        <strong>Free Trial Active</strong><br>
                        You have ${daysUntilRenewal} days remaining in your trial.
                    </div>
                </div>
            `;
        } else if (isCancelled) {
            alertHTML = `
                <div class="alert alert-warning" style="margin-bottom: 1.5rem;">
                    <span class="material-icons">warning</span>
                    <div>
                        <strong>Subscription Cancelled</strong><br>
                        You'll have access until ${nextBillingDate.toLocaleDateString()}.
                    </div>
                </div>
            `;
        } else if (isExpired) {
            alertHTML = `
                <div class="alert alert-danger" style="margin-bottom: 1.5rem;">
                    <span class="material-icons">error</span>
                    <div>
                        <strong>Subscription Expired</strong><br>
                        Renew now to regain access to all features.
                    </div>
                </div>
            `;
        }

        const html = `
            ${alertHTML}
            <div class="hero-subscription-card">
                <div class="hero-subscription-header">
                    <div class="hero-plan-info">
                        <h2>${sub.plan_name}</h2>
                        ${sub.amount_paid > 0 ? `
                            <div class="plan-price">
                                <span class="currency">${currencySymbol}</span>${sub.amount_paid.toFixed(2)}
                                <span class="currency">/ ${sub.billing_period || 'month'}</span>
                            </div>
                        ` : '<div class="plan-price">Free Trial</div>'}
                    </div>
                    ${statusBadgeHTML}
                </div>

                <div class="hero-stats-grid">
                    <div class="hero-stat-item">
                        <div class="hero-stat-label">${isTrial ? 'Trial Ends' : (isCancelled || isExpired) ? 'Access Until' : 'Next Billing'}</div>
                        <div class="hero-stat-value highlight">${nextBillingDate.toLocaleDateString()}</div>
                    </div>
                    <div class="hero-stat-item">
                        <div class="hero-stat-label">Days Remaining</div>
                        <div class="hero-stat-value">${daysUntilRenewal > 0 ? daysUntilRenewal : 0}</div>
                    </div>
                    ${sub.auto_renew !== undefined ? `
                    <div class="hero-stat-item">
                        <div class="hero-stat-label">Auto-Renew</div>
                        <div class="hero-stat-value">${sub.auto_renew ? 'Enabled' : 'Disabled'}</div>
                    </div>
                    ` : ''}
                </div>

                ${this.renderSubscriptionActions()}
            </div>
        `;

        document.getElementById('subscription-hero').innerHTML = html;
        this.setupSubscriptionButtons();
    }

    renderQuickStats() {
        const sub = this.subscription;
        if (!sub) return;

        const startDate = new Date(sub.subscription_start_date);
        const daysSinceMember = Math.floor((new Date() - startDate) / (1000 * 60 * 60 * 24));

        const html = `
            <h3 style="margin-bottom: 1rem; color: var(--text-primary);">Quick Stats</h3>
            <div class="stat-card">
                <div class="stat-card-header">
                    <div class="stat-card-icon">
                        <span class="material-icons">event</span>
                    </div>
                    <div class="stat-card-title">Member Since</div>
                </div>
                <div class="stat-card-value">${startDate.toLocaleDateString()}</div>
                <div class="stat-card-subtitle">${daysSinceMember} days ago</div>
            </div>
        `;

        document.getElementById('quick-stats').innerHTML = html;
        document.getElementById('quick-stats-section').style.display = 'block';
    }

    renderRecentPayment() {
        if (!this.payments || this.payments.length === 0) return;

        const recentPayment = this.payments[0];
        const paymentDate = new Date(recentPayment.payment_date);

        const html = `
            <div class="stat-card">
                <div class="stat-card-header">
                    <div class="stat-card-icon">
                        <span class="material-icons">receipt</span>
                    </div>
                    <div class="stat-card-title">Last Payment</div>
                </div>
                <div class="stat-card-value">${this.getCurrencySymbol(recentPayment.currency)}${recentPayment.amount.toFixed(2)}</div>
                <div class="stat-card-subtitle">${paymentDate.toLocaleDateString()} - ${this.formatPaymentStatus(recentPayment.status)}</div>
            </div>
        `;

        document.getElementById('recent-payment-card').innerHTML = html;
        document.getElementById('recent-payment-section').style.display = 'block';
    }

    renderFullSubscriptionDetails() {
        const sub = this.subscription;
        const isTrial = sub.status === 'trial';
        const isCancelled = sub.status === 'cancelled';
        const isActive = sub.status === 'active';
        const isExpired = sub.status === 'expired';

        const currencySymbol = this.getCurrencySymbol(sub.currency);
        const nextBillingDate = new Date(sub.subscription_end_date);

        const html = `
            <div class="subscription-card">
                <div class="plan-name-large">${sub.plan_name}</div>
                ${sub.amount_paid > 0 ? `
                    <div class="plan-price-large">
                        ${currencySymbol}${sub.amount_paid.toFixed(2)} / ${sub.billing_period || 'month'}
                    </div>
                ` : ''}

                <div class="detail-grid">
                    <div class="detail-row">
                        <span class="detail-label">Status</span>
                        <span class="detail-value">${this.formatStatus(sub.status)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Start Date</span>
                        <span class="detail-value">${new Date(sub.subscription_start_date).toLocaleDateString()}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">${isTrial ? 'Trial Ends' : (isCancelled || isExpired) ? 'Access Until' : 'Next Billing Date'}</span>
                        <span class="detail-value">${nextBillingDate.toLocaleDateString()}</span>
                    </div>
                    ${sub.billing_period ? `
                    <div class="detail-row">
                        <span class="detail-label">Billing Period</span>
                        <span class="detail-value">${sub.billing_period.charAt(0).toUpperCase() + sub.billing_period.slice(1)}</span>
                    </div>
                    ` : ''}
                    ${sub.auto_renew !== undefined ? `
                    <div class="detail-row">
                        <span class="detail-label">Auto-Renew</span>
                        <span class="detail-value">${sub.auto_renew ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;

        document.getElementById('subscription-full-details').innerHTML = html;

        const statusBadge = document.getElementById('subscription-status-badge');
        if (statusBadge) {
            this.renderStatusBadge(statusBadge);
        }
    }

    renderSubscriptionActions() {
        const sub = this.subscription;
        const isTrial = sub.status === 'trial';
        const isCancelled = sub.status === 'cancelled';
        const isActive = sub.status === 'active';
        const isExpired = sub.status === 'expired';

        let actionsHTML = '<div class="btn-group">';

        if (isExpired) {
            actionsHTML += `
                <a href="/pricing.html" class="btn btn-primary">
                    <span class="material-icons icon-sm icon-mr-xs">refresh</span>
                    Renew Subscription
                </a>
            `;
        } else if (isCancelled) {
            actionsHTML += `
                <button class="btn btn-primary" id="reactivate-btn">
                    <span class="material-icons icon-sm icon-mr-xs">refresh</span>
                    Reactivate Subscription
                </button>
            `;
        } else if (isActive || isTrial) {
            actionsHTML += `
                <a href="/pricing.html" class="btn btn-secondary">
                    <span class="material-icons icon-sm icon-mr-xs">swap_horiz</span>
                    Change Plan
                </a>
                <button class="btn btn-danger" id="cancel-btn">
                    <span class="material-icons icon-sm icon-mr-xs">cancel</span>
                    Cancel Subscription
                </button>
            `;
        }

        actionsHTML += '</div>';
        return actionsHTML;
    }

    renderPaymentHistory() {
        const tableHTML = `
            <table class="payment-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Transaction ID</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.payments.map(payment => `
                        <tr>
                            <td>${new Date(payment.payment_date).toLocaleDateString()}</td>
                            <td>${payment.plan_name || 'SutrAlgo Subscription'}</td>
                            <td>${this.getCurrencySymbol(payment.currency)}${payment.amount.toFixed(2)}</td>
                            <td>
                                <span class="payment-status ${payment.status}">
                                    ${this.formatPaymentStatus(payment.status)}
                                </span>
                            </td>
                            <td class="font-mono text-sm text-muted">
                                ${payment.transaction_id ? payment.transaction_id.substring(0, 12) + '...' : 'N/A'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        document.getElementById('payment-history-content').innerHTML = tableHTML;
    }

    renderStatusBadge(container) {
        const sub = this.subscription;
        const statusClass = sub.status === 'trial' ? 'trial' :
                           sub.status === 'active' ? 'active' :
                           sub.status === 'cancelled' ? 'cancelled' : 'expired';

        container.innerHTML = `
            <div class="status-badge ${statusClass}">
                <span class="material-icons" style="font-size: 1rem;">circle</span>
                ${this.formatStatus(sub.status)}
            </div>
        `;
    }

    renderNoSubscription() {
        return `
            <div class="empty-state">
                <span class="material-icons" style="font-size: 64px; color: var(--accent-gold); margin-bottom: 1rem;">card_membership</span>
                <p>You don't have an active subscription</p>
                <a href="/pricing.html" class="btn btn-primary mt-2">
                    View Plans
                </a>
            </div>
        `;
    }

    renderEmptyPayments() {
        return `
            <div class="empty-state">
                <span class="material-icons" style="font-size: 64px; color: var(--accent-gold); margin-bottom: 1rem;">receipt</span>
                <p>No payment history available</p>
            </div>
        `;
    }

    renderError(message) {
        return `
            <div class="empty-state">
                <span class="material-icons" style="font-size: 64px; color: var(--error); margin-bottom: 1rem;">error</span>
                <p>${message}</p>
                <button class="btn btn-secondary mt-2" onclick="location.reload()">
                    Retry
                </button>
            </div>
        `;
    }

    renderLoginRequired() {
        return `
            <div class="empty-state">
                <span class="material-icons" style="font-size: 64px; color: var(--accent-gold); margin-bottom: 1rem;">lock</span>
                <p style="margin-bottom: 0.5rem;">Please log in to view this information</p>
                <a href="/login" class="btn btn-primary mt-2">
                    Log In
                </a>
            </div>
        `;
    }

    renderAdminStatus() {
        return `
            <div class="hero-subscription-card" style="border: 2px solid var(--success-color);">
                <div class="alert alert-success" style="margin-bottom: 1.5rem;">
                    <span class="material-icons">verified_user</span>
                    <div>
                        <strong>Admin Access - Unlimited</strong><br>
                        You have full access to all features with no restrictions.
                    </div>
                </div>
                <div class="hero-subscription-header">
                    <div class="hero-plan-info">
                        <h2>Administrator</h2>
                        <div class="plan-price">Unlimited Access</div>
                    </div>
                    <div class="status-badge active" style="background: var(--success-color); color: white;">
                        <span class="material-icons" style="font-size: 1rem;">admin_panel_settings</span>
                        Admin
                    </div>
                </div>
                <div class="hero-stats-grid">
                    <div class="hero-stat-item">
                        <div class="hero-stat-label">Access Level</div>
                        <div class="hero-stat-value highlight">Full Access</div>
                    </div>
                    <div class="hero-stat-item">
                        <div class="hero-stat-label">Expiry</div>
                        <div class="hero-stat-value">Never</div>
                    </div>
                    <div class="hero-stat-item">
                        <div class="hero-stat-label">Features</div>
                        <div class="hero-stat-value">All Unlocked</div>
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        this.setupSubscriptionButtons();
    }

    setupSubscriptionButtons() {
        const cancelBtn = document.getElementById('cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                document.getElementById('cancel-modal').classList.add('active');
            });
        }

        const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
        if (confirmCancelBtn) {
            confirmCancelBtn.addEventListener('click', () => {
                this.cancelSubscription();
            });
        }

        const reactivateBtn = document.getElementById('reactivate-btn');
        if (reactivateBtn) {
            reactivateBtn.addEventListener('click', () => {
                this.reactivateSubscription();
            });
        }
    }

    async cancelSubscription() {
        const reason = document.getElementById('cancel-reason').value.trim();
        const confirmBtn = document.getElementById('confirm-cancel-btn');

        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Cancelling...';

        try {
            const response = await fetch('/api/user/subscription/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason })
            });

            const data = await response.json();

            if (data.success) {
                document.getElementById('cancel-modal').classList.remove('active');
                alert('Your subscription has been cancelled successfully. You will continue to have access until ' + new Date(data.accessUntil).toLocaleDateString());
                await this.loadSubscription();
            } else {
                throw new Error(data.error?.message || 'Failed to cancel subscription');
            }
        } catch (error) {
            console.error('Error cancelling subscription:', error);
            alert('Failed to cancel subscription: ' + error.message);
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirm Cancellation';
        }
    }

    async reactivateSubscription() {
        const reactivateBtn = document.getElementById('reactivate-btn');

        if (!confirm('Are you sure you want to reactivate your subscription?')) {
            return;
        }

        reactivateBtn.disabled = true;
        reactivateBtn.textContent = 'Reactivating...';

        try {
            const response = await fetch('/api/user/subscription/reactivate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (data.success) {
                alert('Your subscription has been reactivated successfully!');
                await this.loadSubscription();
            } else {
                throw new Error(data.error?.message || 'Failed to reactivate subscription');
            }
        } catch (error) {
            console.error('Error reactivating subscription:', error);
            alert('Failed to reactivate subscription: ' + error.message);
            reactivateBtn.disabled = false;
            reactivateBtn.textContent = 'Reactivate Subscription';
        }
    }

    getCurrencySymbol(currency) {
        const symbols = {
            'GBP': '£',
            'USD': '$',
            'INR': '₹',
            'EUR': '€'
        };
        return symbols[currency] || '$';
    }

    formatStatus(status) {
        const statusMap = {
            'active': 'Active',
            'trial': 'Free Trial',
            'cancelled': 'Cancelled',
            'expired': 'Expired',
            'pending': 'Pending'
        };
        return statusMap[status] || status;
    }

    formatPaymentStatus(status) {
        const statusMap = {
            'completed': 'Completed',
            'success': 'Success',
            'pending': 'Pending',
            'failed': 'Failed',
            'refunded': 'Refunded'
        };
        return statusMap[status] || status;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AccountPage();
});
