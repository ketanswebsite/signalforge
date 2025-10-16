/**
 * Admin Communication Hub - Multi-Channel Notifications
 * Phase 5: Advanced Features
 *
 * Features:
 * - Email notifications (SMTP, SendGrid, etc.)
 * - SMS notifications (Twilio, etc.)
 * - Telegram notifications
 * - In-app notifications
 * - Push notifications
 * - Webhook integrations
 * - Template management
 * - Notification history and analytics
 * - Bulk messaging
 * - Scheduled notifications
 *
 * Dependencies: AdminComponentsV2, AdminTablesV2
 */

const AdminCommunicationHub = {
    // State management
    state: {
        channels: {
            email: { enabled: false, configured: false },
            sms: { enabled: false, configured: false },
            telegram: { enabled: false, configured: false },
            inApp: { enabled: true, configured: true },
            push: { enabled: false, configured: false },
            webhook: { enabled: false, configured: false }
        },
        templates: [],
        history: [],
        stats: {
            sent: 0,
            delivered: 0,
            failed: 0,
            pending: 0
        }
    },

    /**
     * Initialize communication hub
     */
    async init() {
        console.log('[CommunicationHub] Initializing communication hub...');

        try {
            await Promise.all([
                this.loadChannelStatus(),
                this.loadTemplates(),
                this.loadStats()
            ]);
            console.log('[CommunicationHub] Communication hub initialized');
        } catch (error) {
            console.error('[CommunicationHub] Failed to initialize:', error);
        }
    },

    /**
     * Load channel status
     */
    async loadChannelStatus() {
        try {
            const response = await fetch('/api/admin/communication/channels');

            if (response.ok) {
                const data = await response.json();
                this.state.channels = { ...this.state.channels, ...data.channels };
            }
        } catch (error) {
            console.error('[CommunicationHub] Error loading channels:', error);
        }
    },

    /**
     * Load notification templates
     */
    async loadTemplates() {
        try {
            const response = await fetch('/api/admin/communication/templates');

            if (response.ok) {
                const data = await response.json();
                this.state.templates = data.templates || [];
            }
        } catch (error) {
            console.error('[CommunicationHub] Error loading templates:', error);
        }
    },

    /**
     * Load statistics
     */
    async loadStats() {
        try {
            const response = await fetch('/api/admin/communication/stats');

            if (response.ok) {
                const data = await response.json();
                this.state.stats = { ...this.state.stats, ...data.stats };
            }
        } catch (error) {
            console.error('[CommunicationHub] Error loading stats:', error);
        }
    },

    /**
     * Show communication hub UI
     * @param {string} containerId - Container element ID
     */
    async showCommunicationHub(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Load data if not already loaded
        if (Object.keys(this.state.channels).length === 0) {
            await this.init();
        }

        container.innerHTML = `
            <div class="communication-hub-container">
                <!-- Header -->
                <div class="communication-hub-header">
                    <h2>📢 Communication Hub</h2>
                    <div class="hub-actions">
                        <button class="btn btn-primary" onclick="AdminCommunicationHub.sendNotification()">
                            ✉️ Send Notification
                        </button>
                        <button class="btn btn-secondary" onclick="AdminCommunicationHub.refreshData()">
                            🔄 Refresh
                        </button>
                    </div>
                </div>

                <!-- Stats Overview -->
                <div class="communication-stats">
                    ${AdminComponentsV2.enhancedMetricCard({
                        title: 'Sent',
                        value: this.state.stats.sent,
                        change: null,
                        sparklineData: []
                    })}
                    ${AdminComponentsV2.enhancedMetricCard({
                        title: 'Delivered',
                        value: this.state.stats.delivered,
                        change: null,
                        sparklineData: []
                    })}
                    ${AdminComponentsV2.enhancedMetricCard({
                        title: 'Failed',
                        value: this.state.stats.failed,
                        change: null,
                        sparklineData: []
                    })}
                    ${AdminComponentsV2.enhancedMetricCard({
                        title: 'Pending',
                        value: this.state.stats.pending,
                        change: null,
                        sparklineData: []
                    })}
                </div>

                <!-- Tabs -->
                <div class="hub-tabs">
                    <button class="hub-tab active" onclick="AdminCommunicationHub.switchTab('channels')" data-tab="channels">
                        📡 Channels
                    </button>
                    <button class="hub-tab" onclick="AdminCommunicationHub.switchTab('templates')" data-tab="templates">
                        📝 Templates
                    </button>
                    <button class="hub-tab" onclick="AdminCommunicationHub.switchTab('history')" data-tab="history">
                        📊 History
                    </button>
                    <button class="hub-tab" onclick="AdminCommunicationHub.switchTab('webhooks')" data-tab="webhooks">
                        🔗 Webhooks
                    </button>
                </div>

                <!-- Tab Content -->
                <div class="hub-content">
                    <div class="hub-tab-content active" data-content="channels">
                        ${this.renderChannelsView()}
                    </div>
                    <div class="hub-tab-content" data-content="templates">
                        ${this.renderTemplatesView()}
                    </div>
                    <div class="hub-tab-content" data-content="history">
                        ${this.renderHistoryView()}
                    </div>
                    <div class="hub-tab-content" data-content="webhooks">
                        ${this.renderWebhooksView()}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render channels view
     */
    renderChannelsView() {
        const channelInfo = {
            email: {
                icon: '📧',
                name: 'Email',
                description: 'Send emails via SMTP or third-party services',
                features: ['Templates', 'HTML support', 'Attachments', 'Scheduling']
            },
            sms: {
                icon: '📱',
                name: 'SMS',
                description: 'Send text messages via Twilio or similar services',
                features: ['Global reach', 'High delivery rate', 'URL shortening']
            },
            telegram: {
                icon: '✈️',
                name: 'Telegram',
                description: 'Send messages via Telegram Bot API',
                features: ['Rich formatting', 'Buttons', 'Media support', 'Groups']
            },
            inApp: {
                icon: '🔔',
                name: 'In-App',
                description: 'Show notifications within the application',
                features: ['Real-time', 'Action buttons', 'Read receipts']
            },
            push: {
                icon: '📲',
                name: 'Push',
                description: 'Browser and mobile push notifications',
                features: ['Background delivery', 'Rich media', 'Actions']
            },
            webhook: {
                icon: '🔗',
                name: 'Webhooks',
                description: 'POST notifications to custom endpoints',
                features: ['Custom payloads', 'Authentication', 'Retries']
            }
        };

        return `
            <div class="channels-grid">
                ${Object.entries(this.state.channels).map(([key, channel]) => {
                    const info = channelInfo[key];
                    return `
                        <div class="channel-card ${channel.enabled ? 'enabled' : 'disabled'}">
                            <div class="channel-header">
                                <div class="channel-icon">${info.icon}</div>
                                <div class="channel-info">
                                    <h3>${info.name}</h3>
                                    <p>${info.description}</p>
                                </div>
                                <div class="channel-status">
                                    ${channel.configured
                                        ? `<span class="status-badge status-success">✓ Configured</span>`
                                        : `<span class="status-badge status-warning">⚠ Not Configured</span>`
                                    }
                                </div>
                            </div>

                            <div class="channel-features">
                                ${info.features.map(feature => `
                                    <span class="feature-tag">${feature}</span>
                                `).join('')}
                            </div>

                            <div class="channel-actions">
                                <label class="toggle-switch">
                                    <input type="checkbox"
                                           ${channel.enabled ? 'checked' : ''}
                                           ${!channel.configured ? 'disabled' : ''}
                                           onchange="AdminCommunicationHub.toggleChannel('${key}', this.checked)">
                                    <span class="toggle-slider"></span>
                                </label>
                                <button class="btn btn-secondary btn-sm"
                                        onclick="AdminCommunicationHub.configureChannel('${key}')">
                                    ${channel.configured ? '⚙️ Configure' : '🔧 Setup'}
                                </button>
                                ${channel.configured ? `
                                    <button class="btn btn-secondary btn-sm"
                                            onclick="AdminCommunicationHub.testChannel('${key}')">
                                        🧪 Test
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    /**
     * Render templates view
     */
    renderTemplatesView() {
        return `
            <div class="templates-view">
                <div class="templates-header">
                    <h3>Notification Templates</h3>
                    <button class="btn btn-primary" onclick="AdminCommunicationHub.createTemplate()">
                        ➕ New Template
                    </button>
                </div>

                ${this.state.templates.length > 0 ? `
                    <div class="templates-grid">
                        ${this.state.templates.map(template => `
                            <div class="template-card">
                                <div class="template-header">
                                    <h4>${template.name}</h4>
                                    <span class="template-type">${template.type}</span>
                                </div>
                                <div class="template-body">
                                    <p class="template-subject">${template.subject || 'No subject'}</p>
                                    <p class="template-preview">${template.preview || 'No preview available'}</p>
                                </div>
                                <div class="template-footer">
                                    <span class="template-channels">
                                        ${template.channels.map(ch => this.getChannelIcon(ch)).join(' ')}
                                    </span>
                                    <div class="template-actions">
                                        <button class="btn-icon" onclick="AdminCommunicationHub.editTemplate('${template.id}')" title="Edit">
                                            ✏️
                                        </button>
                                        <button class="btn-icon" onclick="AdminCommunicationHub.duplicateTemplate('${template.id}')" title="Duplicate">
                                            📋
                                        </button>
                                        <button class="btn-icon" onclick="AdminCommunicationHub.deleteTemplate('${template.id}')" title="Delete">
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="empty-state">
                        <div class="empty-state-icon">📝</div>
                        <h3>No Templates Yet</h3>
                        <p>Create your first notification template to get started</p>
                        <button class="btn btn-primary" onclick="AdminCommunicationHub.createTemplate()">
                            Create Template
                        </button>
                    </div>
                `}
            </div>
        `;
    },

    /**
     * Render history view
     */
    renderHistoryView() {
        return `
            <div class="history-view">
                <div class="history-filters">
                    <input type="text"
                           placeholder="Search notifications..."
                           oninput="AdminCommunicationHub.filterHistory(this.value)">
                    <select onchange="AdminCommunicationHub.filterByChannel(this.value)">
                        <option value="">All Channels</option>
                        <option value="email">Email</option>
                        <option value="sms">SMS</option>
                        <option value="telegram">Telegram</option>
                        <option value="inApp">In-App</option>
                        <option value="push">Push</option>
                    </select>
                    <select onchange="AdminCommunicationHub.filterByStatus(this.value)">
                        <option value="">All Status</option>
                        <option value="sent">Sent</option>
                        <option value="delivered">Delivered</option>
                        <option value="failed">Failed</option>
                        <option value="pending">Pending</option>
                    </select>
                </div>

                <div id="notification-history-table">
                    ${AdminComponentsV2.skeleton({ type: 'table', rows: 5 })}
                </div>
            </div>
        `;
    },

    /**
     * Render webhooks view
     */
    renderWebhooksView() {
        return `
            <div class="webhooks-view">
                <div class="webhooks-header">
                    <h3>Webhook Endpoints</h3>
                    <button class="btn btn-primary" onclick="AdminCommunicationHub.addWebhook()">
                        ➕ Add Webhook
                    </button>
                </div>

                <div class="webhooks-info">
                    <p>Configure webhooks to receive notifications about events in your system.</p>
                    <p>Webhooks will receive POST requests with JSON payloads.</p>
                </div>

                <div id="webhooks-list">
                    ${AdminComponentsV2.skeleton({ type: 'card', rows: 3 })}
                </div>
            </div>
        `;
    },

    /**
     * Switch tab
     */
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.hub-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            }
        });

        // Update content
        document.querySelectorAll('.hub-tab-content').forEach(content => {
            content.classList.remove('active');
            if (content.dataset.content === tabName) {
                content.classList.add('active');
            }
        });

        // Load data for specific tabs
        if (tabName === 'history') {
            this.loadHistory();
        } else if (tabName === 'webhooks') {
            this.loadWebhooks();
        }
    },

    /**
     * Send notification
     */
    async sendNotification() {
        const modal = AdminComponentsV2.modal({
            title: '✉️ Send Notification',
            content: `
                <form id="send-notification-form">
                    <div class="form-group">
                        <label>Recipients</label>
                        <select id="recipient-type" onchange="AdminCommunicationHub.updateRecipientField(this.value)">
                            <option value="user">Single User</option>
                            <option value="segment">User Segment</option>
                            <option value="all">All Users</option>
                            <option value="custom">Custom List</option>
                        </select>
                    </div>

                    <div class="form-group" id="recipient-field">
                        <label>User Email</label>
                        <input type="email" id="recipient-value" required>
                    </div>

                    <div class="form-group">
                        <label>Channels</label>
                        <div class="channel-checkboxes">
                            ${Object.entries(this.state.channels)
                                .filter(([_, ch]) => ch.configured && ch.enabled)
                                .map(([key, _]) => `
                                    <label class="checkbox-label">
                                        <input type="checkbox" name="channels" value="${key}">
                                        ${this.getChannelIcon(key)} ${this.getChannelName(key)}
                                    </label>
                                `).join('')}
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Template (Optional)</label>
                        <select id="notification-template">
                            <option value="">None - Custom Message</option>
                            ${this.state.templates.map(t => `
                                <option value="${t.id}">${t.name}</option>
                            `).join('')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Subject</label>
                        <input type="text" id="notification-subject" required>
                    </div>

                    <div class="form-group">
                        <label>Message</label>
                        <textarea id="notification-message" rows="6" required></textarea>
                        <small>Supports markdown formatting</small>
                    </div>

                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="notification-scheduled">
                            Schedule for later
                        </label>
                    </div>

                    <div class="form-group" id="schedule-field" style="display: none;">
                        <label>Send At</label>
                        <input type="datetime-local" id="notification-schedule-time">
                    </div>
                </form>
            `,
            size: 'large',
            actions: [
                { text: 'Cancel', variant: 'secondary', onClick: () => modal.close() },
                {
                    text: 'Send',
                    variant: 'primary',
                    onClick: async () => {
                        await this.submitNotification(modal);
                    }
                }
            ]
        });

        modal.show();

        // Setup event listeners
        document.getElementById('notification-scheduled')?.addEventListener('change', (e) => {
            const scheduleField = document.getElementById('schedule-field');
            if (scheduleField) {
                scheduleField.style.display = e.target.checked ? 'block' : 'none';
            }
        });
    },

    /**
     * Update recipient field based on type
     */
    updateRecipientField(type) {
        const field = document.getElementById('recipient-field');
        if (!field) return;

        let html = '';
        switch (type) {
            case 'user':
                html = `
                    <label>User Email</label>
                    <input type="email" id="recipient-value" required>
                `;
                break;
            case 'segment':
                html = `
                    <label>User Segment</label>
                    <select id="recipient-value" required>
                        <option value="active">Active Users</option>
                        <option value="premium">Premium Subscribers</option>
                        <option value="trial">Trial Users</option>
                        <option value="inactive">Inactive Users</option>
                    </select>
                `;
                break;
            case 'all':
                html = `
                    <label>All Users</label>
                    <p class="text-muted">Notification will be sent to all users</p>
                `;
                break;
            case 'custom':
                html = `
                    <label>Email List (comma-separated)</label>
                    <textarea id="recipient-value" rows="3" required></textarea>
                `;
                break;
        }

        field.innerHTML = html;
    },

    /**
     * Submit notification
     */
    async submitNotification(modal) {
        const form = document.getElementById('send-notification-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const channels = Array.from(document.querySelectorAll('input[name="channels"]:checked'))
            .map(ch => ch.value);

        if (channels.length === 0) {
            AdminComponentsV2.toast({
                type: 'error',
                message: 'Please select at least one channel'
            });
            return;
        }

        const data = {
            recipientType: document.getElementById('recipient-type').value,
            recipients: document.getElementById('recipient-value')?.value,
            channels,
            subject: document.getElementById('notification-subject').value,
            message: document.getElementById('notification-message').value,
            scheduled: document.getElementById('notification-scheduled').checked,
            scheduleTime: document.getElementById('notification-schedule-time')?.value
        };

        try {
            const response = await fetch('/api/admin/communication/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error('Failed to send notification');
            }

            const result = await response.json();

            AdminComponentsV2.toast({
                type: 'success',
                message: data.scheduled
                    ? 'Notification scheduled successfully'
                    : `Notification sent to ${result.sent || 0} recipients`
            });

            modal.close();
            await this.refreshData();
        } catch (error) {
            console.error('[CommunicationHub] Error sending notification:', error);
            AdminComponentsV2.toast({
                type: 'error',
                message: `Failed to send: ${error.message}`
            });
        }
    },

    /**
     * Toggle channel
     */
    async toggleChannel(channelKey, enabled) {
        try {
            const response = await fetch(`/api/admin/communication/channels/${channelKey}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            });

            if (!response.ok) {
                throw new Error('Failed to update channel');
            }

            this.state.channels[channelKey].enabled = enabled;

            AdminComponentsV2.toast({
                type: 'success',
                message: `${this.getChannelName(channelKey)} ${enabled ? 'enabled' : 'disabled'}`
            });
        } catch (error) {
            console.error('[CommunicationHub] Error toggling channel:', error);
            AdminComponentsV2.toast({
                type: 'error',
                message: `Failed to toggle channel: ${error.message}`
            });
        }
    },

    /**
     * Configure channel
     */
    configureChannel(channelKey) {
        const channelName = this.getChannelName(channelKey);

        const configForms = {
            email: `
                <div class="form-group">
                    <label>SMTP Host</label>
                    <input type="text" id="email-host" placeholder="smtp.example.com" required>
                </div>
                <div class="form-group">
                    <label>SMTP Port</label>
                    <input type="number" id="email-port" placeholder="587" required>
                </div>
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" id="email-username" required>
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="email-password" required>
                </div>
                <div class="form-group">
                    <label>From Address</label>
                    <input type="email" id="email-from" required>
                </div>
            `,
            sms: `
                <div class="form-group">
                    <label>Provider</label>
                    <select id="sms-provider">
                        <option value="twilio">Twilio</option>
                        <option value="nexmo">Nexmo</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Account SID</label>
                    <input type="text" id="sms-sid" required>
                </div>
                <div class="form-group">
                    <label>Auth Token</label>
                    <input type="password" id="sms-token" required>
                </div>
                <div class="form-group">
                    <label>From Number</label>
                    <input type="tel" id="sms-from" placeholder="+1234567890" required>
                </div>
            `,
            telegram: `
                <div class="form-group">
                    <label>Bot Token</label>
                    <input type="text" id="telegram-token" required>
                    <small>Get from @BotFather</small>
                </div>
                <div class="form-group">
                    <label>Default Chat ID (Optional)</label>
                    <input type="text" id="telegram-chat-id">
                </div>
            `
        };

        const modal = AdminComponentsV2.modal({
            title: `⚙️ Configure ${channelName}`,
            content: `
                <form id="configure-channel-form">
                    ${configForms[channelKey] || '<p>Configuration not available for this channel.</p>'}
                </form>
            `,
            actions: [
                { text: 'Cancel', variant: 'secondary', onClick: () => modal.close() },
                {
                    text: 'Save',
                    variant: 'primary',
                    onClick: async () => {
                        await this.saveChannelConfig(channelKey, modal);
                    }
                }
            ]
        });

        modal.show();
    },

    /**
     * Save channel configuration
     */
    async saveChannelConfig(channelKey, modal) {
        // Collect form data
        const form = document.getElementById('configure-channel-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const config = {};
        form.querySelectorAll('input, select').forEach(input => {
            const key = input.id.replace(`${channelKey}-`, '');
            config[key] = input.value;
        });

        try {
            const response = await fetch(`/api/admin/communication/channels/${channelKey}/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            if (!response.ok) {
                throw new Error('Failed to save configuration');
            }

            this.state.channels[channelKey].configured = true;

            AdminComponentsV2.toast({
                type: 'success',
                message: `${this.getChannelName(channelKey)} configured successfully`
            });

            modal.close();
            await this.refreshData();
        } catch (error) {
            console.error('[CommunicationHub] Error saving config:', error);
            AdminComponentsV2.toast({
                type: 'error',
                message: `Failed to save configuration: ${error.message}`
            });
        }
    },

    /**
     * Test channel
     */
    async testChannel(channelKey) {
        const channelName = this.getChannelName(channelKey);

        const confirmed = await AdminComponentsV2.confirm({
            title: `Test ${channelName}`,
            message: `Send a test notification via ${channelName}?`
        });

        if (!confirmed) return;

        try {
            const response = await fetch(`/api/admin/communication/channels/${channelKey}/test`, {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error('Test failed');
            }

            AdminComponentsV2.toast({
                type: 'success',
                message: `Test notification sent via ${channelName}`
            });
        } catch (error) {
            console.error('[CommunicationHub] Test failed:', error);
            AdminComponentsV2.toast({
                type: 'error',
                message: `Test failed: ${error.message}`
            });
        }
    },

    /**
     * Create template
     */
    createTemplate() {
        // Implementation for template creation
        AdminComponentsV2.toast({
            type: 'info',
            message: 'Template editor opening...'
        });
    },

    /**
     * Load notification history
     */
    async loadHistory() {
        try {
            const response = await fetch('/api/admin/communication/history');

            if (!response.ok) {
                throw new Error('Failed to load history');
            }

            const data = await response.json();
            this.state.history = data.history || [];

            // Render history table
            const container = document.getElementById('notification-history-table');
            if (container && window.AdminTablesV2) {
                AdminTablesV2.create('notification-history-table', {
                    data: this.state.history,
                    columns: [
                        { key: 'timestamp', label: 'Time', sortable: true },
                        { key: 'channel', label: 'Channel', sortable: true },
                        { key: 'recipient', label: 'Recipient', sortable: true },
                        { key: 'subject', label: 'Subject' },
                        { key: 'status', label: 'Status', sortable: true },
                        { key: 'actions', label: 'Actions' }
                    ],
                    pagination: { enabled: true, pageSize: 25 },
                    search: { enabled: true },
                    export: { enabled: true }
                });
            }
        } catch (error) {
            console.error('[CommunicationHub] Error loading history:', error);
        }
    },

    /**
     * Load webhooks
     */
    async loadWebhooks() {
        // Implementation for loading webhooks
        AdminComponentsV2.toast({
            type: 'info',
            message: 'Loading webhooks...'
        });
    },

    /**
     * Refresh all data
     */
    async refreshData() {
        await this.init();

        // Re-render if container exists
        const container = document.querySelector('.communication-hub-container')?.parentElement;
        if (container) {
            await this.showCommunicationHub(container.id);
        }
    },

    /**
     * Helper: Get channel icon
     */
    getChannelIcon(channelKey) {
        const icons = {
            email: '📧',
            sms: '📱',
            telegram: '✈️',
            inApp: '🔔',
            push: '📲',
            webhook: '🔗'
        };
        return icons[channelKey] || '❓';
    },

    /**
     * Helper: Get channel name
     */
    getChannelName(channelKey) {
        const names = {
            email: 'Email',
            sms: 'SMS',
            telegram: 'Telegram',
            inApp: 'In-App',
            push: 'Push',
            webhook: 'Webhook'
        };
        return names[channelKey] || channelKey;
    }
};

// Make available globally
window.AdminCommunicationHub = AdminCommunicationHub;
