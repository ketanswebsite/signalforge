/**
 * Admin Audit Log Module
 * Handles unified audit log viewing, filtering, and detailed change tracking
 */

const AdminAudit = {
    currentPage: 1,
    pageSize: 50,
    filterEntity: 'all',
    filterAction: 'all',
    filterUser: '',
    dateFrom: '',
    dateTo: '',
    searchQuery: '',

    /**
     * Initialize the audit log module
     */
    async init() {
        this.render();
        await this.loadAuditLogs();
    },

    /**
     * Render the main audit log interface
     */
    render() {
        const container = document.getElementById('audit-page');

        container.innerHTML = `
            <div class="admin-card mb-2">
                <div class="admin-card-header">
                    <h2 class="admin-card-title">Audit Log</h2>
                    <div>
                        <button class="btn btn-secondary btn-sm" onclick="AdminAudit.exportLogs()">
                            📥 Export Logs
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="AdminAudit.loadAnalytics()">
                            📊 View Analytics
                        </button>
                    </div>
                </div>

                <div class="admin-card-body">
                    <!-- Filters -->
                    <div class="filters-row mb-2">
                        <div class="filter-group">
                            <label>Entity Type:</label>
                            <select id="filter-entity" onchange="AdminAudit.applyFilters()">
                                <option value="all">All Entities</option>
                                <option value="trades">Trades</option>
                                <option value="users">Users</option>
                                <option value="subscriptions">Subscriptions</option>
                                <option value="payments">Payments</option>
                                <option value="admin">Admin Actions</option>
                            </select>
                        </div>

                        <div class="filter-group">
                            <label>Action Type:</label>
                            <select id="filter-action" onchange="AdminAudit.applyFilters()">
                                <option value="all">All Actions</option>
                                <option value="CREATE">Create</option>
                                <option value="UPDATE">Update</option>
                                <option value="DELETE">Delete</option>
                                <option value="LOGIN">Login</option>
                                <option value="LOGOUT">Logout</option>
                                <option value="VERIFY">Verify</option>
                                <option value="REFUND">Refund</option>
                            </select>
                        </div>

                        <div class="filter-group">
                            <label>User:</label>
                            <input
                                type="text"
                                id="filter-user"
                                placeholder="Filter by user email..."
                                onchange="AdminAudit.applyFilters()"
                            />
                        </div>

                        <div class="filter-group">
                            <label>Date From:</label>
                            <input
                                type="date"
                                id="filter-date-from"
                                onchange="AdminAudit.applyFilters()"
                            />
                        </div>

                        <div class="filter-group">
                            <label>Date To:</label>
                            <input
                                type="date"
                                id="filter-date-to"
                                onchange="AdminAudit.applyFilters()"
                            />
                        </div>

                        <div class="filter-group">
                            <button class="btn btn-secondary btn-sm" onclick="AdminAudit.clearFilters()">
                                Clear Filters
                            </button>
                        </div>
                    </div>

                    <!-- Search -->
                    <div class="mb-2">
                        <input
                            type="text"
                            id="audit-search"
                            class="search-input"
                            placeholder="Search audit logs..."
                            onkeyup="AdminAudit.handleSearch(event)"
                        />
                    </div>

                    <!-- Audit Log Table -->
                    <div id="audit-log-table">
                        <div class="spinner-container spinner-medium">
                            <div class="spinner"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Analytics Panel (hidden by default) -->
            <div id="audit-analytics-panel" ></div>
        `;
    },

    /**
     * Load audit logs from API
     */
    async loadAuditLogs() {
        try {
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.pageSize
            });

            if (this.filterEntity !== 'all') params.append('entity', this.filterEntity);
            if (this.filterAction !== 'all') params.append('action', this.filterAction);
            if (this.filterUser) params.append('user', this.filterUser);
            if (this.dateFrom) params.append('dateFrom', this.dateFrom);
            if (this.dateTo) params.append('dateTo', this.dateTo);
            if (this.searchQuery) params.append('search', this.searchQuery);

            const response = await fetch(`/api/admin/audit/unified?${params}`);
            const data = await response.json();

            if (data.success) {
                this.renderAuditTable(data.data.items, data.data.pagination);
            } else {
                throw new Error(data.error?.message || 'Failed to load audit logs');
            }
        } catch (error) {
            AdminComponents.alert({
                type: 'error',
                message: `Failed to load audit logs: ${error.message}`,
                autoDismiss: 5000
            });
        }
    },

    /**
     * Render audit log table
     */
    renderAuditTable(logs, pagination) {
        const container = document.getElementById('audit-log-table');

        if (!logs || logs.length === 0) {
            container.innerHTML = '<p class="text-center text-muted">No audit log entries found.</p>';
            return;
        }

        const tableHTML = AdminComponents.dataTable({
            columns: [
                {
                    label: 'Time',
                    key: 'created_at',
                    render: (timestamp) => {
                        const date = new Date(timestamp);
                        const now = new Date();
                        const diff = Math.floor((now - date) / 1000);

                        if (diff < 60) return `${diff}s ago`;
                        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
                        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
                        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }
                },
                {
                    label: 'Entity',
                    key: 'entity_type',
                    render: (entity) => {
                        const icons = {
                            trades: '📊',
                            users: '👤',
                            subscriptions: '💳',
                            payments: '💰',
                            admin: '🔧'
                        };
                        const icon = icons[entity] || '📝';
                        return `<span>${icon} ${entity.charAt(0).toUpperCase() + entity.slice(1)}</span>`;
                    }
                },
                {
                    label: 'Action',
                    key: 'action',
                    render: (action) => {
                        const colors = {
                            CREATE: 'success',
                            UPDATE: 'info',
                            DELETE: 'danger',
                            LOGIN: 'primary',
                            LOGOUT: 'secondary',
                            VERIFY: 'success',
                            REFUND: 'warning'
                        };
                        return AdminComponents.badge(action, colors[action] || 'secondary');
                    }
                },
                { label: 'User', key: 'user_email' },
                {
                    label: 'Entity ID',
                    key: 'entity_id',
                    render: (id) => id ? `<code>${id.toString().substring(0, 20)}${id.toString().length > 20 ? '...' : ''}</code>` : '-'
                },
                {
                    label: 'IP Address',
                    key: 'ip_address',
                    render: (ip) => ip ? `<code>${ip}</code>` : '-'
                }
            ],
            actions: [
                {
                    label: 'View Details',
                    onClick: (log) => `AdminAudit.viewLogDetails(${log.id})`,
                    className: 'btn-sm'
                }
            ],
            data: logs
        });

        const paginationHTML = AdminComponents.pagination({
            currentPage: pagination.page,
            totalPages: pagination.pages,
            onPageChange: (page) => `AdminAudit.changePage(${page})`
        });

        container.innerHTML = tableHTML + paginationHTML;
    },

    /**
     * View detailed log entry
     */
    async viewLogDetails(logId) {
        try {
            const response = await fetch(`/api/admin/audit/${logId}`);
            const data = await response.json();

            if (data.success) {
                this.showLogDetailModal(data.data);
            } else {
                throw new Error(data.error?.message || 'Failed to load log details');
            }
        } catch (error) {
            AdminComponents.alert({
                type: 'error',
                message: `Failed to load log details: ${error.message}`,
                autoDismiss: 5000
            });
        }
    },

    /**
     * Show log detail modal
     */
    showLogDetailModal(log) {
        const date = new Date(log.created_at);

        let changesHTML = '<p class="text-muted">No changes recorded.</p>';
        if (log.changes && Object.keys(log.changes).length > 0) {
            changesHTML = '<table class="table table-sm"><thead><tr><th>Field</th><th>Old Value</th><th>New Value</th></tr></thead><tbody>';
            for (const [field, values] of Object.entries(log.changes)) {
                changesHTML += `
                    <tr>
                        <td><strong>${field}</strong></td>
                        <td><code>${JSON.stringify(values.old)}</code></td>
                        <td><code>${JSON.stringify(values.new)}</code></td>
                    </tr>
                `;
            }
            changesHTML += '</tbody></table>';
        }

        const modalHTML = `
            <div class="modal-backdrop" onclick="AdminComponents.closeModal()"></div>
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Audit Log Entry #${log.id}</h3>
                        <button class="btn-close" onclick="AdminComponents.closeModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="audit-detail-grid">
                            <div class="audit-detail-item">
                                <strong>📅 Timestamp:</strong>
                                <span>${date.toLocaleString()}</span>
                            </div>
                            <div class="audit-detail-item">
                                <strong>👤 User:</strong>
                                <span>${log.user_email || 'System'}</span>
                            </div>
                            <div class="audit-detail-item">
                                <strong>🔧 Action:</strong>
                                <span>${AdminComponents.badge(log.action, 'primary')}</span>
                            </div>
                            <div class="audit-detail-item">
                                <strong>📦 Entity Type:</strong>
                                <span>${log.entity_type}</span>
                            </div>
                            <div class="audit-detail-item">
                                <strong>🆔 Entity ID:</strong>
                                <span><code>${log.entity_id || 'N/A'}</code></span>
                            </div>
                            <div class="audit-detail-item">
                                <strong>🌍 IP Address:</strong>
                                <span><code>${log.ip_address || 'N/A'}</code></span>
                            </div>
                            <div class="audit-detail-item">
                                <strong>💻 User Agent:</strong>
                                <span class="text-sm">${log.user_agent || 'N/A'}</span>
                            </div>
                        </div>

                        <hr />

                        <h4>Changed Fields:</h4>
                        ${changesHTML}

                        ${log.old_data ? `
                            <hr />
                            <details>
                                <summary><strong>📄 Old Data Snapshot</strong></summary>
                                <pre class="code-pre">${JSON.stringify(log.old_data, null, 2)}</pre>
                            </details>
                        ` : ''}

                        ${log.new_data ? `
                            <details>
                                <summary><strong>📄 New Data Snapshot</strong></summary>
                                <pre class="code-pre">${JSON.stringify(log.new_data, null, 2)}</pre>
                            </details>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="AdminComponents.closeModal()">Close</button>
                        <button class="btn btn-primary" onclick="AdminAudit.exportLogEntry(${log.id})">Export Entry</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('modal-container').innerHTML = modalHTML;
    },

    /**
     * Apply filters
     */
    applyFilters() {
        this.filterEntity = document.getElementById('filter-entity').value;
        this.filterAction = document.getElementById('filter-action').value;
        this.filterUser = document.getElementById('filter-user').value;
        this.dateFrom = document.getElementById('filter-date-from').value;
        this.dateTo = document.getElementById('filter-date-to').value;
        this.currentPage = 1;
        this.loadAuditLogs();
    },

    /**
     * Clear all filters
     */
    clearFilters() {
        this.filterEntity = 'all';
        this.filterAction = 'all';
        this.filterUser = '';
        this.dateFrom = '';
        this.dateTo = '';
        this.searchQuery = '';
        this.currentPage = 1;

        document.getElementById('filter-entity').value = 'all';
        document.getElementById('filter-action').value = 'all';
        document.getElementById('filter-user').value = '';
        document.getElementById('filter-date-from').value = '';
        document.getElementById('filter-date-to').value = '';
        document.getElementById('audit-search').value = '';

        this.loadAuditLogs();
    },

    /**
     * Handle search input
     */
    handleSearch(event) {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.searchQuery = event.target.value;
            this.currentPage = 1;
            this.loadAuditLogs();
        }, 300);
    },

    /**
     * Change page
     */
    changePage(page) {
        this.currentPage = page;
        this.loadAuditLogs();
    },

    /**
     * Load audit analytics
     */
    async loadAnalytics() {
        try {
            const response = await fetch('/api/admin/audit/analytics');
            const data = await response.json();

            if (data.success) {
                this.renderAnalytics(data.data);
            } else {
                throw new Error(data.error?.message || 'Failed to load analytics');
            }
        } catch (error) {
            AdminComponents.alert({
                type: 'error',
                message: `Failed to load analytics: ${error.message}`,
                autoDismiss: 5000
            });
        }
    },

    /**
     * Render audit analytics
     */
    renderAnalytics(analytics) {
        const panel = document.getElementById('audit-analytics-panel');
        panel

        const activityHTML = analytics.mostActiveUsers.map((user, index) => `
            <div class="flex-between mb-1">
                <span>${index + 1}. ${user.user_email || 'System'}</span>
                <strong>${user.action_count} actions</strong>
            </div>
        `).join('');

        const actionHTML = Object.entries(analytics.actionDistribution).map(([action, count]) => `
            <div class="flex-between mb-1">
                <span>${action}</span>
                <strong>${count} (${((count / analytics.totalActions) * 100).toFixed(1)}%)</strong>
            </div>
        `).join('');

        panel.innerHTML = `
            <div class="admin-card">
                <div class="admin-card-header">
                    <h2 class="admin-card-title">Audit Analytics</h2>
                    <button class="btn btn-secondary btn-sm" onclick="document.getElementById('audit-analytics-panel')                        Close
                    </button>
                </div>
                <div class="admin-card-body">
                    <div class="grid-3col">
                        <!-- Most Active Users -->
                        <div>
                            <h4>Most Active Users</h4>
                            ${activityHTML}
                        </div>

                        <!-- Action Distribution -->
                        <div>
                            <h4>Action Distribution</h4>
                            ${actionHTML}
                        </div>

                        <!-- Suspicious Activity -->
                        <div>
                            <h4>Recent Activity Summary</h4>
                            <div class="flex-between mb-1">
                                <span>Total Actions</span>
                                <strong>${analytics.totalActions}</strong>
                            </div>
                            <div class="flex-between mb-1">
                                <span>Unique Users</span>
                                <strong>${analytics.mostActiveUsers.length}</strong>
                            </div>
                            <div class="flex-between mb-1">
                                <span>Last 24 Hours</span>
                                <strong>${analytics.last24Hours || 0}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Export logs to CSV
     */
    async exportLogs() {
        try {
            const params = new URLSearchParams({
                format: 'csv'
            });

            if (this.filterEntity !== 'all') params.append('entity', this.filterEntity);
            if (this.filterAction !== 'all') params.append('action', this.filterAction);
            if (this.filterUser) params.append('user', this.filterUser);
            if (this.dateFrom) params.append('dateFrom', this.dateFrom);
            if (this.dateTo) params.append('dateTo', this.dateTo);

            const response = await fetch(`/api/admin/audit/export?${params}`);
            const blob = await response.blob();

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            AdminComponents.alert({
                type: 'success',
                message: 'Audit logs exported successfully',
                autoDismiss: 3000
            });
        } catch (error) {
            AdminComponents.alert({
                type: 'error',
                message: `Failed to export logs: ${error.message}`,
                autoDismiss: 5000
            });
        }
    },

    /**
     * Export single log entry
     */
    async exportLogEntry(logId) {
        try {
            const response = await fetch(`/api/admin/audit/${logId}/export`);
            const data = await response.json();

            const dataStr = JSON.stringify(data.data, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audit-log-${logId}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            AdminComponents.alert({
                type: 'success',
                message: 'Log entry exported successfully',
                autoDismiss: 3000
            });
        } catch (error) {
            AdminComponents.alert({
                type: 'error',
                message: `Failed to export log entry: ${error.message}`,
                autoDismiss: 5000
            });
        }
    }
};
