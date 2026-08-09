/**
 * Account Page JavaScript
 * Manages tabs, subscription, payment information, and user settings
 */

/**
 * Create an element with a class and text content (v3 renderer helper).
 */
function acEl(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
}

/**
 * Build one v3 stat card: label, value, context sentence, optional bar.
 */
function acStat(label, value, context, options) {
    const opts = options || {};
    const card = acEl('div', 'sa-card sa-card--sunk statistic-card');
    const stat = acEl('div', 'sa-stat');
    stat.appendChild(acEl('span', 'sa-stat__label', label));
    stat.appendChild(acEl('span', 'sa-stat__value' + (opts.small ? ' sa-stat__value--sm' : '') + (opts.tone ? ' sa-stat__value--' + opts.tone : ''), value));
    if (typeof opts.barPercent === 'number') {
        const bar = acEl('div', 'sa-stat__bar');
        const fill = acEl('i');
        fill.style.width = Math.max(0, Math.min(100, opts.barPercent)) + '%';
        bar.appendChild(fill);
        stat.appendChild(bar);
    }
    stat.appendChild(acEl('span', 'sa-stat__context', context));
    card.appendChild(stat);
    return card;
}

/**
 * Build a v3 callout.
 */
function acCallout(tone, icon, title, bodyText, actionEl) {
    const box = acEl('div', 'sa-callout sa-callout--' + tone + ' ac-callout');
    const iconEl = acEl('span', 'material-symbols-rounded', icon);
    iconEl.setAttribute('aria-hidden', 'true');
    box.appendChild(iconEl);
    const textWrap = acEl('div', 'ac-callout__text');
    if (title) textWrap.appendChild(acEl('strong', null, title));
    if (bodyText) textWrap.appendChild(acEl('span', null, bodyText));
    box.appendChild(textWrap);
    if (actionEl) {
        const actions = acEl('div', 'ac-callout__action');
        actions.appendChild(actionEl);
        box.appendChild(actions);
    }
    return box;
}

/**
 * Build an sa-empty block.
 */
function acEmpty(icon, title, bodyText, actionEl) {
    const empty = acEl('div', 'sa-empty empty-state');
    const iconBox = acEl('div', 'sa-empty__icon');
    const glyph = acEl('span', 'material-symbols-rounded', icon);
    glyph.setAttribute('aria-hidden', 'true');
    iconBox.appendChild(glyph);
    empty.appendChild(iconBox);
    empty.appendChild(acEl('div', 'sa-empty__title', title));
    if (bodyText) empty.appendChild(acEl('p', null, bodyText));
    if (actionEl) empty.appendChild(actionEl);
    return empty;
}

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
        // The shell's theme toggle (sa-theme) is the source of truth at load —
        // the checkbox mirrors it rather than fighting it.
        try {
            const saTheme = localStorage.getItem('sa-theme');
            if (saTheme) this.currentSettings.darkMode = saTheme === 'dark';
        } catch (e) {}
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

        // Sync push notification status with server
        this.syncPushNotificationStatus();
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
            if (checked) {
                // Use PushNotifications library if available
                if (typeof PushNotifications !== 'undefined') {
                    try {
                        const result = await PushNotifications.subscribe();
                        if (result.success) {
                            this.currentSettings.browserNotifications = true;
                            this.showNotification('Push notifications enabled!', 'success');
                        } else {
                            this.currentSettings.browserNotifications = false;
                            this.showNotification(result.error || 'Failed to enable notifications', 'error');
                            // Uncheck the toggle
                            const toggle = document.getElementById('browser-notifications');
                            if (toggle) toggle.checked = false;
                        }
                    } catch (error) {
                        console.error('[PUSH] Subscribe error:', error);
                        this.currentSettings.browserNotifications = false;
                        this.showNotification('Failed to enable push notifications', 'error');
                        const toggle = document.getElementById('browser-notifications');
                        if (toggle) toggle.checked = false;
                    }
                } else if ('Notification' in window) {
                    // Fallback to basic notification permission
                    const permission = await Notification.requestPermission();
                    this.currentSettings.browserNotifications = permission === 'granted';
                }
            } else {
                // Unsubscribe from push notifications
                if (typeof PushNotifications !== 'undefined') {
                    try {
                        await PushNotifications.unsubscribe();
                        this.showNotification('Push notifications disabled', 'info');
                    } catch (error) {
                        console.error('[PUSH] Unsubscribe error:', error);
                    }
                }
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
        // Drive the v3 theme (data-theme on <html>, persisted as sa-theme) and
        // keep the legacy body classes for anything still reading them.
        if (this.currentSettings.darkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.body.classList.add('dark-theme');
            document.body.classList.remove('light-theme');
        } else {
            document.documentElement.removeAttribute('data-theme');
            document.body.classList.add('light-theme');
            document.body.classList.remove('dark-theme');
        }
        try { localStorage.setItem('sa-theme', this.currentSettings.darkMode ? 'dark' : 'light'); } catch (e) {}
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

    async syncPushNotificationStatus() {
        // Check if push notifications library is available
        if (typeof PushNotifications === 'undefined') {
            return;
        }

        try {
            // Initialize PushNotifications if not already done
            await PushNotifications.init();

            // Check if user is subscribed
            const isSubscribed = await PushNotifications.isSubscribed();
            const toggle = document.getElementById('browser-notifications');

            if (toggle) {
                toggle.checked = isSubscribed;
                this.currentSettings.browserNotifications = isSubscribed;
            }

            // Also check server status if authenticated
            try {
                const status = await PushNotifications.getServerStatus();
                if (status && toggle) {
                    toggle.checked = status.subscribed;
                    this.currentSettings.browserNotifications = status.subscribed;
                }
            } catch (e) {
                // Server status check failed, use local status
            }
        } catch (error) {
            console.warn('[PUSH] Error syncing push notification status:', error);
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
            const response = await fetch('/api/user/delete-account', {
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
        const notification = acEl('div', 'notification notification-' + type + ' notification--floating', message);
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('fade-out');
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
        const heroEl = document.getElementById('subscription-hero');
        const detailsEl = document.getElementById('subscription-full-details');
        try {
            const response = await fetch('/api/user/subscription');

            if (response.status === 401) {
                heroEl.replaceChildren(this.renderLoginRequired());
                detailsEl.replaceChildren(this.renderLoginRequired());
                return;
            }

            const data = await response.json();

            // Store admin status
            this.isAdmin = (data.data && data.data.isAdmin) || false;

            if (this.isAdmin) {
                heroEl.replaceChildren(this.renderAdminStatus());
                detailsEl.replaceChildren(this.renderAdminStatus());
            } else if (data.success && data.data && data.data.hasSubscription) {
                this.subscription = data.data.subscription;
                this.renderHeroSubscriptionCard();
                this.renderFullSubscriptionDetails();
                this.renderQuickStats();
            } else {
                heroEl.replaceChildren(this.renderNoSubscription());
                detailsEl.replaceChildren(this.renderNoSubscription());
            }
        } catch (error) {
            console.error('Error loading subscription:', error);
            heroEl.replaceChildren(this.renderError('Your plan would not load. Try again in a minute.'));
            detailsEl.replaceChildren(this.renderError('Your plan would not load. Try again in a minute.'));
        } finally {
            heroEl.classList.remove('loading-state');
            detailsEl.classList.remove('loading-state');
        }
    }

    async loadPaymentHistory() {
        const contentDiv = document.getElementById('payment-history-content');
        try {
            const response = await fetch('/api/user/payments');

            if (response.status === 401) {
                contentDiv.replaceChildren(this.renderLoginRequired());
                return;
            }

            const data = await response.json();
            // The API wraps payloads as {success, message, data}
            const payments = (data.data && data.data.payments) || data.payments || [];

            if (data.success && payments.length > 0) {
                this.payments = payments;
                this.renderPaymentHistory();
                this.renderRecentPayment();
            } else if (data.success) {
                contentDiv.replaceChildren(this.renderEmptyPayments());
            } else {
                contentDiv.replaceChildren(this.renderError('Payments would not load. Try again in a minute.'));
            }
        } catch (error) {
            console.error('Error loading payment history:', error);
            contentDiv.replaceChildren(this.renderError('Payments would not load. Try again in a minute.'));
        } finally {
            contentDiv.classList.remove('loading-state');
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
        const daysUntilRenewal = Math.max(0, Math.ceil((nextBillingDate - new Date()) / (1000 * 60 * 60 * 24)));
        const amountPaid = parseFloat(sub.amount_paid) || 0;
        const endDateText = nextBillingDate.toLocaleDateString();

        const frag = document.createDocumentFragment();

        const seePlans = acEl('a', 'sa-btn sa-btn--secondary sa-btn--sm', 'See plans');
        seePlans.href = '/pricing.html';

        if (isTrial) {
            frag.appendChild(acCallout('warn', 'schedule',
                'Your free days end on ' + endDateText,
                "That's " + daysUntilRenewal + (daysUntilRenewal === 1 ? ' day' : ' days') +
                ' away. After that the scanner stops sending signals \u2014 your history stays either way.',
                seePlans));
        } else if (isCancelled) {
            frag.appendChild(acCallout('warn', 'schedule',
                'Your plan is cancelled',
                'You keep everything until ' + endDateText + '. Reactivate any time before then.'));
        } else if (isExpired) {
            frag.appendChild(acCallout('loss', 'error',
                'Your plan has ended',
                'The scanner has stopped sending signals. Choose a plan to start it again.',
                seePlans));
        }

        const grid = acEl('div', 'ac-statgrid');
        const planContext = amountPaid > 0
            ? currencySymbol + amountPaid.toFixed(2) + ' a ' + (sub.billing_period || 'month') + '.'
            : 'Free for now \u2014 no card on file.';
        grid.appendChild(acStat('Current plan', sub.plan_name || 'Explorer', planContext, { small: true }));
        grid.appendChild(acStat('Days left', String(daysUntilRenewal),
            (isTrial ? 'Trial ends ' : isCancelled || isExpired ? 'Access until ' : 'Renews ') + endDateText + '.',
            { barPercent: (daysUntilRenewal / 90) * 100 }));
        grid.appendChild(acStat('Markets you can see', '3',
            'India, the UK and the US \u2014 the same on every plan.', { small: true }));
        frag.appendChild(grid);

        frag.appendChild(this.renderSubscriptionActions());

        document.getElementById('subscription-hero').replaceChildren(frag);
        this.setupSubscriptionButtons();
    }

    renderQuickStats() {
        const sub = this.subscription;
        if (!sub) return;

        const startDate = new Date(sub.subscription_start_date);
        const daysSinceMember = Math.floor((new Date() - startDate) / (1000 * 60 * 60 * 24));

        const grid = document.getElementById('quick-stats');
        grid.replaceChildren(acStat('With the formula since', startDate.toLocaleDateString(),
            daysSinceMember + (daysSinceMember === 1 ? ' day' : ' days') + ' so far.', { small: true }));
        document.getElementById('quick-stats-section').hidden = false;
    }

    renderRecentPayment() {
        if (!this.payments || this.payments.length === 0) return;

        const recentPayment = this.payments[0];
        const paymentDate = new Date(recentPayment.payment_date);

        document.getElementById('recent-payment-card').replaceChildren(
            acStat('Last payment',
                this.getCurrencySymbol(recentPayment.currency) + recentPayment.amount.toFixed(2),
                paymentDate.toLocaleDateString() + ' \u00b7 ' + this.formatPaymentStatus(recentPayment.status) + '.',
                { small: true }));
        document.getElementById('recent-payment-section').hidden = false;
    }

    renderFullSubscriptionDetails() {
        const sub = this.subscription;
        const isTrial = sub.status === 'trial';
        const isCancelled = sub.status === 'cancelled';
        const isExpired = sub.status === 'expired';

        const currencySymbol = this.getCurrencySymbol(sub.currency);
        const nextBillingDate = new Date(sub.subscription_end_date);
        const amountPaid = parseFloat(sub.amount_paid) || 0;

        const wrap = acEl('div', 'trade-details ac-details');
        const addRow = (label, value) => {
            const row = acEl('div', 'detail-row');
            row.appendChild(acEl('span', 'detail-label', label));
            row.appendChild(acEl('span', 'detail-value', value));
            wrap.appendChild(row);
        };

        addRow('Plan', sub.plan_name || 'Explorer');
        if (amountPaid > 0) addRow('Price', currencySymbol + amountPaid.toFixed(2) + ' a ' + (sub.billing_period || 'month'));
        addRow('Status', this.formatStatus(sub.status));
        addRow('Started', DateFormatter.format(sub.subscription_start_date));
        addRow(isTrial ? 'Trial ends' : (isCancelled || isExpired) ? 'Access until' : 'Renews on', nextBillingDate.toLocaleDateString());
        if (sub.auto_renew !== undefined) addRow('Renews itself', sub.auto_renew ? 'Yes' : 'No');

        document.getElementById('subscription-full-details').replaceChildren(wrap);

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

        const row = acEl('div', 'sa-row btn-group ac-actions');

        if (isExpired) {
            const renew = acEl('a', 'sa-btn sa-btn--primary', 'Choose a plan');
            renew.href = '/pricing.html';
            row.appendChild(renew);
        } else if (isCancelled) {
            const reactivate = acEl('button', 'sa-btn sa-btn--primary', 'Reactivate my plan');
            reactivate.id = 'reactivate-btn';
            reactivate.type = 'button';
            row.appendChild(reactivate);
        } else if (isActive || isTrial) {
            const change = acEl('a', 'sa-btn sa-btn--secondary sa-btn--sm', 'Change plan');
            change.href = '/pricing.html';
            row.appendChild(change);
            const cancel = acEl('button', 'sa-btn sa-btn--quiet sa-btn--sm', 'Cancel my plan');
            cancel.id = 'cancel-btn';
            cancel.type = 'button';
            row.appendChild(cancel);
        }

        return row;
    }

    renderPaymentHistory() {
        const wrap = document.createDocumentFragment();

        const tableWrap = acEl('div', 'sa-table-wrap');
        const table = acEl('table', 'sa-table payment-table');
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        [['Date', null], ['What for', null], ['Amount', 'num'], ['Status', null], ['Reference', null]].forEach(pair => {
            const th = acEl('th', pair[1], pair[0]);
            headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');

        const cards = acEl('div', 'sa-table__cards');

        this.payments.forEach(payment => {
            const amountText = this.getCurrencySymbol(payment.currency) + payment.amount.toFixed(2);
            const statusText = this.formatPaymentStatus(payment.status);
            const reference = payment.transaction_id ? payment.transaction_id.substring(0, 12) + '\u2026' : 'N/A';
            const what = payment.plan_name || 'SutrAlgo subscription';
            const dateText = DateFormatter.format(payment.payment_date);

            const row = document.createElement('tr');
            row.appendChild(acEl('td', null, dateText));
            row.appendChild(acEl('td', null, what));
            row.appendChild(acEl('td', 'num', amountText));
            const statusTd = document.createElement('td');
            statusTd.appendChild(acEl('span', 'sa-badge sa-badge--' + (payment.status === 'completed' || payment.status === 'succeeded' ? 'gain' : payment.status === 'failed' ? 'loss' : 'neutral') + ' payment-status', statusText));
            row.appendChild(statusTd);
            row.appendChild(acEl('td', 'ac-ref', reference));
            tbody.appendChild(row);

            const rc = acEl('div', 'sa-rowcard');
            const top = acEl('div', 'sa-rowcard__top');
            top.appendChild(acEl('strong', null, dateText));
            top.appendChild(acEl('span', 'sa-rowcard__v', amountText));
            rc.appendChild(top);
            const grid = acEl('div', 'sa-rowcard__grid');
            [['What for', what], ['Status', statusText], ['Reference', reference]].forEach(pair => {
                grid.appendChild(acEl('span', 'sa-rowcard__k', pair[0]));
                grid.appendChild(acEl('span', 'sa-rowcard__v', pair[1]));
            });
            rc.appendChild(grid);
            cards.appendChild(rc);
        });

        table.appendChild(tbody);
        tableWrap.appendChild(table);
        wrap.appendChild(tableWrap);
        wrap.appendChild(cards);

        document.getElementById('payment-history-content').replaceChildren(wrap);
    }

    renderStatusBadge(container) {
        const sub = this.subscription;
        const tone = sub.status === 'active' ? 'gain' :
                     sub.status === 'trial' ? 'accent' :
                     sub.status === 'cancelled' ? 'warn' : 'loss';
        container.replaceChildren(acEl('span', 'sa-badge sa-badge--' + tone + ' status-badge', this.formatStatus(sub.status)));
    }

    renderNoSubscription() {
        const view = acEl('a', 'sa-btn sa-btn--primary', 'See the plans');
        view.href = '/pricing.html';
        return acEmpty('credit_card', 'No plan yet',
            'Pick one and the scanner starts working for you. The first 90 days are free.', view);
    }

    renderEmptyPayments() {
        return acEmpty('receipt_long', 'No payments yet',
            "Nothing has been charged \u2014 you're on the free plan.");
    }

    renderError(message) {
        const retry = acEl('button', 'sa-btn sa-btn--secondary sa-btn--sm', 'Try again');
        retry.type = 'button';
        retry.addEventListener('click', () => location.reload());
        return acEmpty('error', 'Something went wrong', message, retry);
    }

    renderLoginRequired() {
        const login = acEl('a', 'sa-btn sa-btn--primary', 'Sign in');
        login.href = '/login';
        return acEmpty('lock', 'Signed out', 'Sign in to see this.', login);
    }

    renderAdminStatus() {
        const frag = acEl('div', 'ac-adminwrap');
        const adminLink = acEl('a', 'sa-btn sa-btn--primary sa-btn--sm', 'Open the admin portal');
        adminLink.href = '/admin-v2';
        frag.appendChild(acCallout('gain', 'shield_person', 'Admin access',
            'Full access to everything, with nothing to renew.', adminLink));
        const grid = acEl('div', 'ac-statgrid');
        grid.appendChild(acStat('Current plan', 'Administrator', 'Every feature, every market.', { small: true }));
        grid.appendChild(acStat('Days left', '\u221e', 'Admin access does not expire.', { small: true }));
        grid.appendChild(acStat('Markets you can see', '3', 'India, the UK and the US.', { small: true }));
        frag.appendChild(grid);
        return frag;
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
        confirmBtn.textContent = 'Cancelling\u2026';

        try {
            const response = await fetch('/api/user/subscription/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason })
            });

            const data = await response.json();

            if (data.success) {
                document.getElementById('cancel-modal').classList.remove('active');
                alert('Your plan is cancelled. You keep access until ' + DateFormatter.format((data.data && data.data.accessUntil) || data.accessUntil));
                await this.loadSubscription();
            } else {
                throw new Error(data.error?.message || 'Failed to cancel subscription');
            }
        } catch (error) {
            console.error('Error cancelling subscription:', error);
            alert('Failed to cancel subscription: ' + error.message);
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Cancel it';
        }
    }

    async reactivateSubscription() {
        const reactivateBtn = document.getElementById('reactivate-btn');

        if (!confirm('Are you sure you want to reactivate your subscription?')) {
            return;
        }

        reactivateBtn.disabled = true;
        reactivateBtn.textContent = 'Reactivating\u2026';

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
            reactivateBtn.textContent = 'Reactivate my plan';
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
