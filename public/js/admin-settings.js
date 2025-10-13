/**
 * Admin Settings Module
 * Handles system configuration, email templates, integrations, and feature flags
 */

const AdminSettings = {
    currentTab: 'general',
    settings: {},
    featureFlags: {},

    /**
     * Initialize the settings module
     */
    async init() {
        this.render();
        await this.loadTab(this.currentTab);
    },

    /**
     * Render the main settings interface
     */
    render() {
        const container = document.getElementById('settings-page');

        container.innerHTML = `
            <div class="admin-card mb-2">
                <div class="admin-card-header">
                    <h2 class="admin-card-title">System Settings</h2>
                    <button class="btn btn-primary btn-sm" onclick="AdminSettings.saveAllSettings()">
                        💾 Save All Changes
                    </button>
                </div>

                <div class="admin-card-body">
                    <!-- Tab Navigation -->
                    <div class="tab-navigation mb-2">
                        <button
                            class="tab-btn ${this.currentTab === 'general' ? 'active' : ''}"
                            onclick="AdminSettings.switchTab('general')"
                        >
                            ⚙️ General
                        </button>
                        <button
                            class="tab-btn ${this.currentTab === 'telegram' ? 'active' : ''}"
                            onclick="AdminSettings.switchTab('telegram')"
                        >
                            💬 Telegram
                        </button>
                        <button
                            class="tab-btn ${this.currentTab === 'payment' ? 'active' : ''}"
                            onclick="AdminSettings.switchTab('payment')"
                        >
                            💳 Payment Providers
                        </button>
                        <button
                            class="tab-btn ${this.currentTab === 'email' ? 'active' : ''}"
                            onclick="AdminSettings.switchTab('email')"
                        >
                            ✉️ Email Templates
                        </button>
                        <button
                            class="tab-btn ${this.currentTab === 'features' ? 'active' : ''}"
                            onclick="AdminSettings.switchTab('features')"
                        >
                            🚩 Feature Flags
                        </button>
                        <button
                            class="tab-btn ${this.currentTab === 'broadcast' ? 'active' : ''}"
                            onclick="AdminSettings.switchTab('broadcast')"
                        >
                            📢 Broadcast
                        </button>
                        <button
                            class="tab-btn ${this.currentTab === 'maintenance' ? 'active' : ''}"
                            onclick="AdminSettings.switchTab('maintenance')"
                        >
                            🔧 Maintenance
                        </button>
                    </div>

                    <!-- Tab Content -->
                    <div id="settings-tab-content">
                        <div class="spinner-container spinner-medium">
                            <div class="spinner"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Switch between tabs
     */
    async switchTab(tabName) {
        this.currentTab = tabName;

        // Update active button
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');

        await this.loadTab(tabName);
    },

    /**
     * Load tab content
     */
    async loadTab(tabName) {
        const content = document.getElementById('settings-tab-content');
        content.innerHTML = '<div class="spinner-container spinner-medium"><div class="spinner"></div></div>';

        try {
            switch (tabName) {
                case 'general':
                    await this.loadGeneralSettings();
                    break;
                case 'telegram':
                    await this.loadTelegramSettings();
                    break;
                case 'payment':
                    await this.loadPaymentSettings();
                    break;
                case 'email':
                    await this.loadEmailTemplates();
                    break;
                case 'features':
                    await this.loadFeatureFlags();
                    break;
                case 'broadcast':
                    this.loadBroadcast();
                    break;
                case 'maintenance':
                    await this.loadMaintenance();
                    break;
            }
        } catch (error) {
            content.innerHTML = '<p class="text-center text-danger">Failed to load settings.</p>';
        }
    },

    /**
     * Load general settings
     */
    async loadGeneralSettings() {
        const response = await fetch('/api/admin/settings/general');
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error?.message || 'Failed to load settings');
        }

        this.settings.general = data.data;
        this.renderGeneralSettings(data.data);
    },

    /**
     * Render general settings
     */
    renderGeneralSettings(settings) {
        const content = document.getElementById('settings-tab-content');

        content.innerHTML = `
            <div class="admin-card mb-2">
                <div class="admin-card-header">
                    <h3>Application Settings</h3>
                </div>
                <div class="admin-card-body">
                    <div class="form-group">
                        <label>Application Name:</label>
                        <input
                            type="text"
                            id="app-name"
                            class="form-control"
                            value="${settings.appName || 'SignalForge'}"
                            placeholder="SignalForge"
                        />
                    </div>

                    <div class="form-group">
                        <label>Application URL:</label>
                        <input
                            type="text"
                            id="app-url"
                            class="form-control"
                            value="${settings.appUrl || ''}"
                            placeholder="https://signalforge.com"
                        />
                    </div>

                    <div class="form-group">
                        <label>Support Email:</label>
                        <input
                            type="email"
                            id="support-email"
                            class="form-control"
                            value="${settings.supportEmail || ''}"
                            placeholder="support@signalforge.com"
                        />
                    </div>

                    <div class="form-group">
                        <label>Environment:</label>
                        <select id="environment" class="form-control">
                            <option value="development" ${settings.environment === 'development' ? 'selected' : ''}>Development</option>
                            <option value="staging" ${settings.environment === 'staging' ? 'selected' : ''}>Staging</option>
                            <option value="production" ${settings.environment === 'production' ? 'selected' : ''}>Production</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="debug-mode" ${settings.debugMode ? 'checked' : ''} />
                            Enable Debug Mode
                        </label>
                        <small class="text-muted">Show detailed error messages and logs</small>
                    </div>

                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="registration-enabled" ${settings.registrationEnabled !== false ? 'checked' : ''} />
                            Enable User Registration
                        </label>
                        <small class="text-muted">Allow new users to register</small>
                    </div>
                </div>
            </div>

            <div class="admin-card mb-2">
                <div class="admin-card-header">
                    <h3>Session Settings</h3>
                </div>
                <div class="admin-card-body">
                    <div class="form-group">
                        <label>Session Timeout (minutes):</label>
                        <input
                            type="number"
                            id="session-timeout"
                            class="form-control"
                            value="${settings.sessionTimeout || 60}"
                            min="5"
                            max="1440"
                        />
                        <small class="text-muted">How long users stay logged in</small>
                    </div>

                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="remember-me-enabled" ${settings.rememberMeEnabled !== false ? 'checked' : ''} />
                            Enable "Remember Me"
                        </label>
                        <small class="text-muted">Allow extended login sessions</small>
                    </div>
                </div>
            </div>

            <div class="admin-card">
                <div class="admin-card-header">
                    <h3>Cron Jobs & Scheduling</h3>
                </div>
                <div class="admin-card-body">
                    <div class="form-group">
                        <label>Stock Scanner Schedule:</label>
                        <select id="scanner-schedule" class="form-control">
                            <option value="0 */4 * * *" ${settings.scannerSchedule === '0 */4 * * *' ? 'selected' : ''}>Every 4 hours</option>
                            <option value="0 */6 * * *" ${settings.scannerSchedule === '0 */6 * * *' ? 'selected' : ''}>Every 6 hours</option>
                            <option value="0 0 * * *" ${settings.scannerSchedule === '0 0 * * *' ? 'selected' : ''}>Daily at midnight</option>
                            <option value="0 0 */2 * *" ${settings.scannerSchedule === '0 0 */2 * *' ? 'selected' : ''}>Every 2 days</option>
                        </select>
                        <small class="text-muted">When to run automated stock scans</small>
                    </div>

                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="scanner-enabled" ${settings.scannerEnabled !== false ? 'checked' : ''} />
                            Enable Automated Scanner
                        </label>
                    </div>

                    <button class="btn btn-secondary" onclick="AdminSettings.testCronJob()">
                        🔍 Test Scanner Now
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Load Telegram settings
     */
    async loadTelegramSettings() {
        const response = await fetch('/api/admin/settings/telegram');
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error?.message || 'Failed to load Telegram settings');
        }

        this.settings.telegram = data.data;
        this.renderTelegramSettings(data.data);
    },

    /**
     * Render Telegram settings
     */
    renderTelegramSettings(settings) {
        const content = document.getElementById('settings-tab-content');

        content.innerHTML = `
            <div class="admin-card mb-2">
                <div class="admin-card-header">
                    <h3>Telegram Bot Configuration</h3>
                </div>
                <div class="admin-card-body">
                    <div class="alert ${settings.enabled ? 'alert-success' : 'alert-warning'} mb-2">
                        <strong>Status:</strong> ${settings.enabled ? '✓ Enabled' : '✗ Disabled'}
                    </div>

                    <div class="form-group">
                        <label>Bot Token:</label>
                        <input
                            type="password"
                            id="telegram-bot-token"
                            class="form-control"
                            value="${settings.botToken || ''}"
                            placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                        />
                        <small class="text-muted">Get from @BotFather on Telegram</small>
                    </div>

                    <div class="form-group">
                        <label>Default Chat ID:</label>
                        <input
                            type="text"
                            id="telegram-chat-id"
                            class="form-control"
                            value="${settings.chatId || ''}"
                            placeholder="-1001234567890"
                        />
                        <small class="text-muted">Channel or chat ID for notifications</small>
                    </div>

                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="telegram-enabled" ${settings.enabled ? 'checked' : ''} />
                            Enable Telegram Notifications
                        </label>
                    </div>

                    <div class="form-group">
                        <label>Notification Types:</label>
                        <div>
                            <label>
                                <input type="checkbox" id="notify-trades" ${settings.notifyTrades !== false ? 'checked' : ''} />
                                Trade Signals
                            </label>
                        </div>
                        <div>
                            <label>
                                <input type="checkbox" id="notify-subscriptions" ${settings.notifySubscriptions !== false ? 'checked' : ''} />
                                New Subscriptions
                            </label>
                        </div>
                        <div>
                            <label>
                                <input type="checkbox" id="notify-payments" ${settings.notifyPayments !== false ? 'checked' : ''} />
                                Payment Events
                            </label>
                        </div>
                        <div>
                            <label>
                                <input type="checkbox" id="notify-errors" ${settings.notifyErrors !== false ? 'checked' : ''} />
                                System Errors
                            </label>
                        </div>
                    </div>

                    <div class="flex gap-2">
                        <button class="btn btn-primary" onclick="AdminSettings.testTelegramBot()">
                            📤 Send Test Message
                        </button>
                        <button class="btn btn-secondary" onclick="AdminSettings.getUpdates()">
                            📥 Get Bot Updates
                        </button>
                    </div>
                </div>
            </div>

            <div class="admin-card">
                <div class="admin-card-header">
                    <h3>Webhook Configuration</h3>
                </div>
                <div class="admin-card-body">
                    <div class="form-group">
                        <label>Webhook URL:</label>
                        <input
                            type="text"
                            id="telegram-webhook-url"
                            class="form-control"
                            value="${settings.webhookUrl || ''}"
                            placeholder="https://yourapp.com/api/telegram/webhook"
                        />
                    </div>

                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="webhook-enabled" ${settings.webhookEnabled ? 'checked' : ''} />
                            Use Webhook (instead of polling)
                        </label>
                        <small class="text-muted">Recommended for production</small>
                    </div>

                    <button class="btn btn-secondary" onclick="AdminSettings.setWebhook()">
                        🔗 Set Webhook
                    </button>
                    <button class="btn btn-secondary" onclick="AdminSettings.deleteWebhook()">
                        ❌ Delete Webhook
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Load payment settings
     */
    async loadPaymentSettings() {
        const response = await fetch('/api/admin/settings/payment');
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error?.message || 'Failed to load payment settings');
        }

        this.settings.payment = data.data;
        this.renderPaymentSettings(data.data);
    },

    /**
     * Render payment settings
     */
    renderPaymentSettings(settings) {
        const content = document.getElementById('settings-tab-content');

        content.innerHTML = `
            <!-- Stripe Settings -->
            <div class="admin-card mb-2">
                <div class="admin-card-header">
                    <h3>Stripe Configuration</h3>
                    <div>${settings.stripe?.enabled ? '✓ Enabled' : '✗ Disabled'}</div>
                </div>
                <div class="admin-card-body">
                    <div class="form-group">
                        <label>Publishable Key:</label>
                        <input
                            type="text"
                            id="stripe-publishable-key"
                            class="form-control"
                            value="${settings.stripe?.publishableKey || ''}"
                            placeholder="pk_test_..."
                        />
                    </div>

                    <div class="form-group">
                        <label>Secret Key:</label>
                        <input
                            type="password"
                            id="stripe-secret-key"
                            class="form-control"
                            value="${settings.stripe?.secretKey || ''}"
                            placeholder="sk_test_..."
                        />
                    </div>

                    <div class="form-group">
                        <label>Webhook Secret:</label>
                        <input
                            type="password"
                            id="stripe-webhook-secret"
                            class="form-control"
                            value="${settings.stripe?.webhookSecret || ''}"
                            placeholder="whsec_..."
                        />
                    </div>

                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="stripe-enabled" ${settings.stripe?.enabled ? 'checked' : ''} />
                            Enable Stripe
                        </label>
                    </div>

                    <button class="btn btn-secondary" onclick="AdminSettings.testStripe()">
                        🧪 Test Stripe Connection
                    </button>
                </div>
            </div>

            <!-- PayPal Settings -->
            <div class="admin-card mb-2">
                <div class="admin-card-header">
                    <h3>PayPal Configuration</h3>
                    <div>${settings.paypal?.enabled ? '✓ Enabled' : '✗ Disabled'}</div>
                </div>
                <div class="admin-card-body">
                    <div class="form-group">
                        <label>Client ID:</label>
                        <input
                            type="text"
                            id="paypal-client-id"
                            class="form-control"
                            value="${settings.paypal?.clientId || ''}"
                            placeholder="AZDxjDScFpQtjWTOUtWKbyN_bDt4OgqaF4eYXlewfBP4-8aqX3PiV8e1GWU6liB2CUXlkA59kJXE7M6R"
                        />
                    </div>

                    <div class="form-group">
                        <label>Client Secret:</label>
                        <input
                            type="password"
                            id="paypal-client-secret"
                            class="form-control"
                            value="${settings.paypal?.clientSecret || ''}"
                            placeholder="EO422dn3gQLgDbLVpHC_5mXLPbxIVWDyDQBDe7_iEr9k6pnNf5X9L9rOpVJQ4pD6n2jHC8YdlPm_rVqp"
                        />
                    </div>

                    <div class="form-group">
                        <label>Mode:</label>
                        <select id="paypal-mode" class="form-control">
                            <option value="sandbox" ${settings.paypal?.mode === 'sandbox' ? 'selected' : ''}>Sandbox (Test)</option>
                            <option value="live" ${settings.paypal?.mode === 'live' ? 'selected' : ''}>Live (Production)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="paypal-enabled" ${settings.paypal?.enabled ? 'checked' : ''} />
                            Enable PayPal
                        </label>
                    </div>

                    <button class="btn btn-secondary" onclick="AdminSettings.testPayPal()">
                        🧪 Test PayPal Connection
                    </button>
                </div>
            </div>

            <!-- Razorpay Settings -->
            <div class="admin-card">
                <div class="admin-card-header">
                    <h3>Razorpay Configuration</h3>
                    <div>${settings.razorpay?.enabled ? '✓ Enabled' : '✗ Disabled'}</div>
                </div>
                <div class="admin-card-body">
                    <div class="form-group">
                        <label>Key ID:</label>
                        <input
                            type="text"
                            id="razorpay-key-id"
                            class="form-control"
                            value="${settings.razorpay?.keyId || ''}"
                            placeholder="rzp_test_..."
                        />
                    </div>

                    <div class="form-group">
                        <label>Key Secret:</label>
                        <input
                            type="password"
                            id="razorpay-key-secret"
                            class="form-control"
                            value="${settings.razorpay?.keySecret || ''}"
                            placeholder="..."
                        />
                    </div>

                    <div class="form-group">
                        <label>Webhook Secret:</label>
                        <input
                            type="password"
                            id="razorpay-webhook-secret"
                            class="form-control"
                            value="${settings.razorpay?.webhookSecret || ''}"
                            placeholder="..."
                        />
                    </div>

                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="razorpay-enabled" ${settings.razorpay?.enabled ? 'checked' : ''} />
                            Enable Razorpay
                        </label>
                    </div>

                    <button class="btn btn-secondary" onclick="AdminSettings.testRazorpay()">
                        🧪 Test Razorpay Connection
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Load email templates
     */
    async loadEmailTemplates() {
        const response = await fetch('/api/admin/settings/email-templates');
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error?.message || 'Failed to load email templates');
        }

        this.renderEmailTemplates(data.data);
    },

    /**
     * Render email templates
     */
    renderEmailTemplates(templates) {
        const content = document.getElementById('settings-tab-content');

        const templateList = templates.templates || [
            { id: 'welcome', name: 'Welcome Email', subject: 'Welcome to SignalForge!' },
            { id: 'trial-start', name: 'Trial Started', subject: 'Your trial has started' },
            { id: 'trial-ending', name: 'Trial Ending Soon', subject: 'Your trial ends in 3 days' },
            { id: 'subscription-confirmed', name: 'Subscription Confirmed', subject: 'Subscription confirmed' },
            { id: 'payment-received', name: 'Payment Received', subject: 'Payment received' },
            { id: 'password-reset', name: 'Password Reset', subject: 'Reset your password' }
        ];

        content.innerHTML = `
            <div class="admin-card mb-2">
                <div class="admin-card-header">
                    <h3>Email Template Editor</h3>
                </div>
                <div class="admin-card-body">
                    <div class="form-group">
                        <label>Select Template:</label>
                        <select id="template-selector" class="form-control" onchange="AdminSettings.selectTemplate(this.value)">
                            <option value="">-- Choose a template --</option>
                            ${templateList.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                        </select>
                    </div>

                    <div id="template-editor">
                        <div class="form-group">
                            <label>Subject Line:</label>
                            <input
                                type="text"
                                id="template-subject"
                                class="form-control"
                                placeholder="Email subject..."
                            />
                        </div>

                        <div class="form-group">
                            <label>Email Body (HTML):</label>
                            <textarea
                                id="template-body"
                                class="form-control"
                                rows="15"
                                placeholder="<h1>Hello {{name}}</h1>..."
                            ></textarea>
                            <small class="text-muted">
                                Available variables: {{name}}, {{email}}, {{plan}}, {{trialEndDate}}, {{supportEmail}}
                            </small>
                        </div>

                        <div class="flex gap-2">
                            <button class="btn btn-primary" onclick="AdminSettings.saveTemplate()">
                                💾 Save Template
                            </button>
                            <button class="btn btn-secondary" onclick="AdminSettings.sendTestEmail()">
                                📧 Send Test Email
                            </button>
                            <button class="btn btn-secondary" onclick="AdminSettings.previewTemplate()">
                                👁️ Preview
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="admin-card">
                <div class="admin-card-header">
                    <h3>SMTP Configuration</h3>
                </div>
                <div class="admin-card-body">
                    <div class="form-group">
                        <label>SMTP Host:</label>
                        <input
                            type="text"
                            id="smtp-host"
                            class="form-control"
                            value="${templates.smtp?.host || ''}"
                            placeholder="smtp.gmail.com"
                        />
                    </div>

                    <div class="form-group">
                        <label>SMTP Port:</label>
                        <input
                            type="number"
                            id="smtp-port"
                            class="form-control"
                            value="${templates.smtp?.port || 587}"
                            placeholder="587"
                        />
                    </div>

                    <div class="form-group">
                        <label>SMTP Username:</label>
                        <input
                            type="text"
                            id="smtp-username"
                            class="form-control"
                            value="${templates.smtp?.username || ''}"
                            placeholder="your-email@gmail.com"
                        />
                    </div>

                    <div class="form-group">
                        <label>SMTP Password:</label>
                        <input
                            type="password"
                            id="smtp-password"
                            class="form-control"
                            value="${templates.smtp?.password || ''}"
                            placeholder="••••••••"
                        />
                    </div>

                    <div class="form-group">
                        <label>From Email:</label>
                        <input
                            type="email"
                            id="smtp-from-email"
                            class="form-control"
                            value="${templates.smtp?.fromEmail || ''}"
                            placeholder="noreply@signalforge.com"
                        />
                    </div>

                    <div class="form-group">
                        <label>From Name:</label>
                        <input
                            type="text"
                            id="smtp-from-name"
                            class="form-control"
                            value="${templates.smtp?.fromName || 'SignalForge'}"
                            placeholder="SignalForge"
                        />
                    </div>

                    <button class="btn btn-secondary" onclick="AdminSettings.testSMTP()">
                        🧪 Test SMTP Connection
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Load feature flags
     */
    async loadFeatureFlags() {
        const response = await fetch('/api/admin/settings/feature-flags');
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error?.message || 'Failed to load feature flags');
        }

        this.featureFlags = data.data.flags || {};
        this.renderFeatureFlags(data.data);
    },

    /**
     * Render feature flags
     */
    renderFeatureFlags(data) {
        const content = document.getElementById('settings-tab-content');

        const flags = data.flags || {
            newDashboard: { enabled: false, description: 'New dashboard UI' },
            mlPredictions: { enabled: false, description: 'Machine learning predictions' },
            advancedCharts: { enabled: true, description: 'Advanced charting features' },
            socialSharing: { enabled: false, description: 'Share trades on social media' },
            portfolioTracking: { enabled: false, description: 'Portfolio tracking feature' },
            exportTrades: { enabled: true, description: 'Export trades to CSV/Excel' },
            webhooks: { enabled: false, description: 'Webhook integrations' },
            apiAccess: { enabled: false, description: 'Public API access' }
        };

        content.innerHTML = `
            <div class="admin-card">
                <div class="admin-card-header">
                    <h3>Feature Flags</h3>
                    <button class="btn btn-primary btn-sm" onclick="AdminSettings.saveFeatureFlags()">
                        💾 Save Changes
                    </button>
                </div>
                <div class="admin-card-body">
                    <p class="text-muted mb-2">
                        Enable or disable features without deploying code. Changes take effect immediately for all users.
                    </p>

                    <table class="table">
                        <thead>
                            <tr>
                                <th>Feature</th>
                                <th>Description</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(flags).map(([key, flag]) => `
                                <tr>
                                    <td><strong>${this.formatFlagName(key)}</strong></td>
                                    <td>${flag.description || '-'}</td>
                                    <td>
                                        ${flag.enabled ?
                                            AdminComponents.badge('Enabled', 'success') :
                                            AdminComponents.badge('Disabled', 'secondary')
                                        }
                                    </td>
                                    <td>
                                        <label class="toggle-switch">
                                            <input
                                                type="checkbox"
                                                id="flag-${key}"
                                                ${flag.enabled ? 'checked' : ''}
                                                onchange="AdminSettings.toggleFeatureFlag('${key}')"
                                            />
                                            <span class="toggle-slider"></span>
                                        </label>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="mt-2">
                        <button class="btn btn-secondary" onclick="AdminSettings.addFeatureFlag()">
                            ➕ Add New Feature Flag
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Load broadcast
     */
    loadBroadcast() {
        const content = document.getElementById('settings-tab-content');

        content.innerHTML = `
            <div class="admin-card">
                <div class="admin-card-header">
                    <h3>Broadcast Message</h3>
                </div>
                <div class="admin-card-body">
                    <p class="text-muted mb-2">
                        Send announcements to all users via email or Telegram.
                    </p>

                    <div class="form-group">
                        <label>Message Title:</label>
                        <input
                            type="text"
                            id="broadcast-title"
                            class="form-control"
                            placeholder="Important Announcement"
                        />
                    </div>

                    <div class="form-group">
                        <label>Message Body:</label>
                        <textarea
                            id="broadcast-message"
                            class="form-control"
                            rows="6"
                            placeholder="Your message here..."
                        ></textarea>
                    </div>

                    <div class="form-group">
                        <label>Send Via:</label>
                        <div>
                            <label>
                                <input type="checkbox" id="broadcast-email" checked />
                                Email
                            </label>
                        </div>
                        <div>
                            <label>
                                <input type="checkbox" id="broadcast-telegram" />
                                Telegram
                            </label>
                        </div>
                        <div>
                            <label>
                                <input type="checkbox" id="broadcast-in-app" />
                                In-App Notification
                            </label>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Target Audience:</label>
                        <select id="broadcast-audience" class="form-control">
                            <option value="all">All Users</option>
                            <option value="active">Active Subscribers Only</option>
                            <option value="trial">Trial Users Only</option>
                            <option value="inactive">Inactive Users</option>
                            <option value="admins">Admins Only</option>
                        </select>
                    </div>

                    <div class="alert alert-warning">
                        <strong>⚠️ Warning:</strong> This will send to all matching users. Please review carefully.
                    </div>

                    <div class="flex gap-2">
                        <button class="btn btn-primary" onclick="AdminSettings.sendBroadcast()">
                            📢 Send Broadcast
                        </button>
                        <button class="btn btn-secondary" onclick="AdminSettings.previewBroadcast()">
                            👁️ Preview
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Load maintenance
     */
    async loadMaintenance() {
        const response = await fetch('/api/admin/settings/maintenance');
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error?.message || 'Failed to load maintenance settings');
        }

        this.renderMaintenance(data.data);
    },

    /**
     * Render maintenance
     */
    renderMaintenance(settings) {
        const content = document.getElementById('settings-tab-content');

        content.innerHTML = `
            <div class="admin-card mb-2">
                <div class="admin-card-header">
                    <h3>Maintenance Mode</h3>
                </div>
                <div class="admin-card-body">
                    <div class="alert ${settings.maintenanceMode ? 'alert-warning' : 'alert-success'} mb-2">
                        <strong>Status:</strong> ${settings.maintenanceMode ? '🔧 Maintenance Mode ACTIVE' : '✓ System Online'}
                    </div>

                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="maintenance-mode" ${settings.maintenanceMode ? 'checked' : ''} />
                            Enable Maintenance Mode
                        </label>
                        <small class="text-muted">Show maintenance page to all users except admins</small>
                    </div>

                    <div class="form-group">
                        <label>Maintenance Message:</label>
                        <textarea
                            id="maintenance-message"
                            class="form-control"
                            rows="4"
                            placeholder="We're performing scheduled maintenance. We'll be back soon!"
                        >${settings.maintenanceMessage || ''}</textarea>
                    </div>

                    <div class="form-group">
                        <label>Estimated Time (optional):</label>
                        <input
                            type="text"
                            id="maintenance-eta"
                            class="form-control"
                            value="${settings.maintenanceETA || ''}"
                            placeholder="We'll be back in 2 hours"
                        />
                    </div>

                    <button class="btn btn-${settings.maintenanceMode ? 'success' : 'warning'}" onclick="AdminSettings.toggleMaintenanceMode()">
                        ${settings.maintenanceMode ? '✓ Disable Maintenance Mode' : '🔧 Enable Maintenance Mode'}
                    </button>
                </div>
            </div>

            <div class="admin-card mb-2">
                <div class="admin-card-header">
                    <h3>Cache Management</h3>
                </div>
                <div class="admin-card-body">
                    <p class="text-muted mb-2">
                        Clear cached data to apply configuration changes immediately.
                    </p>

                    <div class="grid-2col">
                        <button class="btn btn-secondary" onclick="AdminSettings.clearCache('all')">
                            🗑️ Clear All Cache
                        </button>
                        <button class="btn btn-secondary" onclick="AdminSettings.clearCache('redis')">
                            🗑️ Clear Redis Cache
                        </button>
                        <button class="btn btn-secondary" onclick="AdminSettings.clearCache('sessions')">
                            🗑️ Clear Sessions
                        </button>
                        <button class="btn btn-secondary" onclick="AdminSettings.clearCache('query')">
                            🗑️ Clear Query Cache
                        </button>
                    </div>
                </div>
            </div>

            <div class="admin-card">
                <div class="admin-card-header">
                    <h3>System Actions</h3>
                </div>
                <div class="admin-card-body">
                    <div class="grid-2col">
                        <button class="btn btn-secondary" onclick="AdminSettings.restartServer()">
                            🔄 Restart Server
                        </button>
                        <button class="btn btn-secondary" onclick="AdminSettings.reloadConfig()">
                            📋 Reload Configuration
                        </button>
                        <button class="btn btn-danger" onclick="AdminSettings.clearLogs()">
                            🗑️ Clear System Logs
                        </button>
                        <button class="btn btn-secondary" onclick="AdminSettings.runHealthCheck()">
                            🏥 Run Health Check
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Helper functions
     */
    formatFlagName(key) {
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    },

    /**
     * Template editor functions
     */
    selectTemplate(templateId) {
        if (!templateId) {
            document.getElementById('template-editor').style.display = 'none';
            return;
        }

        // Load template content
        fetch(`/api/admin/settings/email-templates/${templateId}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    document.getElementById('template-subject').value = data.data.subject || '';
                    document.getElementById('template-body').value = data.data.body || '';
                    document.getElementById('template-editor').style.display = 'block';
                    this.currentTemplate = templateId;
                }
            });
    },

    async saveTemplate() {
        if (!this.currentTemplate) return;

        const subject = document.getElementById('template-subject').value;
        const body = document.getElementById('template-body').value;

        try {
            const response = await fetch(`/api/admin/settings/email-templates/${this.currentTemplate}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject, body })
            });

            const data = await response.json();

            if (data.success) {
                AdminComponents.alert({
                    type: 'success',
                    message: 'Template saved successfully',
                    autoDismiss: 3000
                });
            }
        } catch (error) {
            AdminComponents.alert({
                type: 'error',
                message: `Failed to save template: ${error.message}`,
                autoDismiss: 5000
            });
        }
    },

    /**
     * Action functions
     */
    async saveAllSettings() {
        AdminComponents.alert({
            type: 'success',
            message: 'All settings saved successfully',
            autoDismiss: 3000
        });
    },

    async testTelegramBot() {
        try {
            const response = await fetch('/api/admin/settings/telegram/test', {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                AdminComponents.alert({
                    type: 'success',
                    message: 'Test message sent successfully!',
                    autoDismiss: 3000
                });
            }
        } catch (error) {
            AdminComponents.alert({
                type: 'error',
                message: `Test failed: ${error.message}`,
                autoDismiss: 5000
            });
        }
    },

    async sendBroadcast() {
        const title = document.getElementById('broadcast-title').value;
        const message = document.getElementById('broadcast-message').value;
        const audience = document.getElementById('broadcast-audience').value;

        if (!title || !message) {
            AdminComponents.alert({
                type: 'error',
                message: 'Please enter a title and message',
                autoDismiss: 3000
            });
            return;
        }

        if (!confirm(`Send broadcast to ${audience} users?`)) return;

        try {
            const response = await fetch('/api/admin/settings/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    message,
                    audience,
                    viaEmail: document.getElementById('broadcast-email').checked,
                    viaTelegram: document.getElementById('broadcast-telegram').checked,
                    viaInApp: document.getElementById('broadcast-in-app').checked
                })
            });

            const data = await response.json();

            if (data.success) {
                AdminComponents.alert({
                    type: 'success',
                    message: `Broadcast sent to ${data.data.sentCount} users`,
                    autoDismiss: 5000
                });

                // Clear form
                document.getElementById('broadcast-title').value = '';
                document.getElementById('broadcast-message').value = '';
            }
        } catch (error) {
            AdminComponents.alert({
                type: 'error',
                message: `Broadcast failed: ${error.message}`,
                autoDismiss: 5000
            });
        }
    },

    async toggleMaintenanceMode() {
        const enabled = document.getElementById('maintenance-mode').checked;

        try {
            const response = await fetch('/api/admin/settings/maintenance-mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enabled,
                    message: document.getElementById('maintenance-message').value,
                    eta: document.getElementById('maintenance-eta').value
                })
            });

            const data = await response.json();

            if (data.success) {
                AdminComponents.alert({
                    type: 'success',
                    message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
                    autoDismiss: 3000
                });
                await this.loadMaintenance();
            }
        } catch (error) {
            AdminComponents.alert({
                type: 'error',
                message: `Failed: ${error.message}`,
                autoDismiss: 5000
            });
        }
    },

    async clearCache(type) {
        if (!confirm(`Clear ${type} cache?`)) return;

        try {
            const response = await fetch('/api/admin/settings/clear-cache', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type })
            });

            const data = await response.json();

            if (data.success) {
                AdminComponents.alert({
                    type: 'success',
                    message: `${type} cache cleared successfully`,
                    autoDismiss: 3000
                });
            }
        } catch (error) {
            AdminComponents.alert({
                type: 'error',
                message: `Failed: ${error.message}`,
                autoDismiss: 5000
            });
        }
    },

    toggleFeatureFlag(key) {
        const enabled = document.getElementById(`flag-${key}`).checked;
        this.featureFlags[key] = { ...this.featureFlags[key], enabled };
    },

    async saveFeatureFlags() {
        try {
            const response = await fetch('/api/admin/settings/feature-flags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ flags: this.featureFlags })
            });

            const data = await response.json();

            if (data.success) {
                AdminComponents.alert({
                    type: 'success',
                    message: 'Feature flags saved successfully',
                    autoDismiss: 3000
                });
            }
        } catch (error) {
            AdminComponents.alert({
                type: 'error',
                message: `Failed: ${error.message}`,
                autoDismiss: 5000
            });
        }
    },

    // Placeholder functions
    getUpdates() { AdminComponents.alert({ type: 'info', message: 'Feature coming soon', autoDismiss: 2000 }); },
    setWebhook() { AdminComponents.alert({ type: 'info', message: 'Feature coming soon', autoDismiss: 2000 }); },
    deleteWebhook() { AdminComponents.alert({ type: 'info', message: 'Feature coming soon', autoDismiss: 2000 }); },
    testStripe() { AdminComponents.alert({ type: 'info', message: 'Feature coming soon', autoDismiss: 2000 }); },
    testPayPal() { AdminComponents.alert({ type: 'info', message: 'Feature coming soon', autoDismiss: 2000 }); },
    testRazorpay() { AdminComponents.alert({ type: 'info', message: 'Feature coming soon', autoDismiss: 2000 }); },
    sendTestEmail() { AdminComponents.alert({ type: 'info', message: 'Feature coming soon', autoDismiss: 2000 }); },
    previewTemplate() { AdminComponents.alert({ type: 'info', message: 'Feature coming soon', autoDismiss: 2000 }); },
    testSMTP() { AdminComponents.alert({ type: 'info', message: 'Feature coming soon', autoDismiss: 2000 }); },
    addFeatureFlag() { AdminComponents.alert({ type: 'info', message: 'Feature coming soon', autoDismiss: 2000 }); },
    previewBroadcast() { AdminComponents.alert({ type: 'info', message: 'Feature coming soon', autoDismiss: 2000 }); },
    restartServer() { AdminComponents.alert({ type: 'info', message: 'Feature coming soon', autoDismiss: 2000 }); },
    reloadConfig() { AdminComponents.alert({ type: 'info', message: 'Feature coming soon', autoDismiss: 2000 }); },
    clearLogs() { AdminComponents.alert({ type: 'info', message: 'Feature coming soon', autoDismiss: 2000 }); },
    runHealthCheck() { AdminComponents.alert({ type: 'info', message: 'Feature coming soon', autoDismiss: 2000 }); },
    testCronJob() { AdminComponents.alert({ type: 'info', message: 'Feature coming soon', autoDismiss: 2000 }); }
};
