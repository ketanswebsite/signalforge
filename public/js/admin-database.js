/**
 * Admin Database Tools Module
 * Handles database management, migrations, backups, query runner, and health monitoring
 */

const AdminDatabase = {
    currentTab: 'health',
    queryHistory: [],
    queryMode: 'readonly',

    /**
     * Initialize the database module
     */
    async init() {
        this.render();
        await this.loadTab(this.currentTab);
    },

    /**
     * Render the main database interface
     */
    render() {
        const container = document.getElementById('database-page');

        container.innerHTML = `
            <div class="admin-card mb-2">
                <div class="admin-card-header">
                    <h2 class="admin-card-title">Database Tools</h2>
                    <div class="status-indicator">
                        <span class="status-dot status-success"></span>
                        <span class="status-text" id="db-status-text">Connected</span>
                    </div>
                </div>

                <div class="admin-card-body">
                    <!-- Tab Navigation -->
                    <div class="tab-navigation mb-2">
                        <button
                            class="tab-btn ${this.currentTab === 'health' ? 'active' : ''}"
                            onclick="AdminDatabase.switchTab('health')"
                        >
                            🏥 Health Monitor
                        </button>
                        <button
                            class="tab-btn ${this.currentTab === 'migrations' ? 'active' : ''}"
                            onclick="AdminDatabase.switchTab('migrations')"
                        >
                            📦 Migrations
                        </button>
                        <button
                            class="tab-btn ${this.currentTab === 'query' ? 'active' : ''}"
                            onclick="AdminDatabase.switchTab('query')"
                        >
                            ⚡ Query Runner
                        </button>
                        <button
                            class="tab-btn ${this.currentTab === 'backup' ? 'active' : ''}"
                            onclick="AdminDatabase.switchTab('backup')"
                        >
                            💾 Backups
                        </button>
                        <button
                            class="tab-btn ${this.currentTab === 'maintenance' ? 'active' : ''}"
                            onclick="AdminDatabase.switchTab('maintenance')"
                        >
                            🔧 Maintenance
                        </button>
                    </div>

                    <!-- Tab Content -->
                    <div id="database-tab-content">
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
        const content = document.getElementById('database-tab-content');
        content.innerHTML = '<div class="spinner-container spinner-medium"><div class="spinner"></div></div>';

        try {
            switch (tabName) {
                case 'health':
                    await this.loadHealthMonitor();
                    break;
                case 'migrations':
                    await this.loadMigrations();
                    break;
                case 'query':
                    this.loadQueryRunner();
                    break;
                case 'backup':
                    await this.loadBackups();
                    break;
                case 'maintenance':
                    await this.loadMaintenance();
                    break;
            }
        } catch (error) {
            content.innerHTML = '<p class="text-center text-danger">Failed to load database tools.</p>';
        }
    },

    /**
     * Load database health monitor
     */
    async loadHealthMonitor() {
        const response = await fetch('/api/admin/system/health');
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error?.message || 'Failed to load health data');
        }

        this.renderHealthMonitor(data.data);
    },

    /**
     * Render health monitor
     */
    renderHealthMonitor(health) {
        const content = document.getElementById('database-tab-content');

        const passCount = health.checks.filter(c => c.status === 'pass').length;
        const failCount = health.checks.filter(c => c.status === 'fail').length;

        content.innerHTML = `
            <!-- Overall Health Status -->
            <div class="admin-card mb-2">
                <div class="admin-card-header">
                    <h3>System Health Status</h3>
                    <div class="status-indicator">
                        <span class="status-dot ${health.overall === 'healthy' ? 'status-success' : 'status-danger'}"></span>
                        <span class="status-text">${health.overall.toUpperCase()}</span>
                    </div>
                </div>
                <div class="admin-card-body">
                    <div class="metrics-grid mb-2">
                        <div class="metric-card">
                            <div class="metric-icon">✅</div>
                            <div class="metric-content">
                                <div class="metric-title">Checks Passed</div>
                                <div class="metric-value">${passCount}</div>
                            </div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-icon">❌</div>
                            <div class="metric-content">
                                <div class="metric-title">Checks Failed</div>
                                <div class="metric-value">${failCount}</div>
                            </div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-icon">⚠️</div>
                            <div class="metric-content">
                                <div class="metric-title">Warnings</div>
                                <div class="metric-value">${health.warnings.length}</div>
                            </div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-icon">🕐</div>
                            <div class="metric-content">
                                <div class="metric-title">Last Check</div>
                                <div class="metric-value">${new Date(health.timestamp).toLocaleTimeString()}</div>
                            </div>
                        </div>
                    </div>

                    <div class="flex gap-2">
                        <button class="btn btn-primary" onclick="AdminDatabase.refreshHealthCheck()">
                            🔄 Refresh Health Check
                        </button>
                        <button class="btn btn-secondary" onclick="AdminDatabase.showTestRunner()">
                            🧪 Run Tests
                        </button>
                    </div>
                </div>
            </div>

            <!-- Health Checks Results -->
            <div class="admin-card mb-2">
                <div class="admin-card-header">
                    <h3>Health Check Results</h3>
                </div>
                <div class="admin-card-body">
                    ${health.checks.length > 0 ? `
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Check</th>
                                    <th>Status</th>
                                    <th>Message</th>
                                    <th>Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${health.checks.map(check => `
                                    <tr>
                                        <td><strong>${check.name}</strong></td>
                                        <td>
                                            ${check.status === 'pass'
                                                ? '<span class="badge badge-success">✓ Pass</span>'
                                                : '<span class="badge badge-danger">✗ Fail</span>'}
                                        </td>
                                        <td>${check.message}</td>
                                        <td>${check.duration || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p class="text-muted">No health checks available</p>'}
                </div>
            </div>

            <!-- Warnings -->
            ${health.warnings.length > 0 ? `
                <div class="admin-card">
                    <div class="admin-card-header">
                        <h3>⚠️ Warnings</h3>
                    </div>
                    <div class="admin-card-body">
                        <div class="alert alert-warning">
                            <ul class="mb-0">
                                ${health.warnings.map(warning => `<li>${warning}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            ` : ''}
        `;
    },

    /**
     * Load migrations
     */
    async loadMigrations() {
        const response = await fetch('/api/admin/database/migrations');
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error?.message || 'Failed to load migrations');
        }

        this.renderMigrations(data.data);
    },

    /**
     * Render migrations
     */
    renderMigrations(migrations) {
        const content = document.getElementById('database-tab-content');

        const applied = migrations.applied || [];
        const pending = migrations.pending || [];

        content.innerHTML = `
            <div class="admin-card mb-2">
                <div class="admin-card-header">
                    <h3>Migration Status</h3>
                    <div>
                        ${pending.length > 0 ? `
                            <button class="btn btn-primary btn-sm" onclick="AdminDatabase.runPendingMigrations()">
                                Run Pending Migrations (${pending.length})
                            </button>
                        ` : ''}
                    </div>
                </div>
                <div class="admin-card-body">
                    <div class="metrics-grid mb-2">
                        <div class="metric-card">
                            <div class="metric-icon">✅</div>
                            <div class="metric-content">
                                <div class="metric-title">Applied</div>
                                <div class="metric-value">${applied.length}</div>
                            </div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-icon">⏳</div>
                            <div class="metric-content">
                                <div class="metric-title">Pending</div>
                                <div class="metric-value">${pending.length}</div>
                            </div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-icon">📅</div>
                            <div class="metric-content">
                                <div class="metric-title">Last Migration</div>
                                <div class="metric-value">${migrations.lastMigration || 'None'}</div>
                            </div>
                        </div>
                    </div>

                    ${pending.length > 0 ? `
                        <div class="alert alert-info mb-2">
                            <strong>⚠️ Pending Migrations:</strong> ${pending.length} migration(s) need to be applied
                        </div>
                    ` : `
                        <div class="alert alert-success mb-2">
                            <strong>✓ All migrations applied</strong>
                        </div>
                    `}
                </div>
            </div>

            ${pending.length > 0 ? `
                <div class="admin-card mb-2">
                    <div class="admin-card-header">
                        <h3>Pending Migrations</h3>
                    </div>
                    <div class="admin-card-body">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Migration File</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${pending.map(migration => `
                                    <tr>
                                        <td><code>${migration}</code></td>
                                        <td>
                                            <button class="btn btn-sm btn-primary" onclick="AdminDatabase.runMigration('${migration}')">
                                                Run
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}

            <div class="admin-card">
                <div class="admin-card-header">
                    <h3>Applied Migrations</h3>
                </div>
                <div class="admin-card-body">
                    ${applied.length > 0 ? `
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Migration File</th>
                                    <th>Applied At</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${applied.map(migration => `
                                    <tr>
                                        <td><code>${migration.filename || migration}</code></td>
                                        <td>${migration.applied_at ? new Date(migration.applied_at).toLocaleString() : 'Unknown'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p class="text-muted">No migrations applied yet.</p>'}
                </div>
            </div>
        `;
    },

    /**
     * Load query runner
     */
    loadQueryRunner() {
        const content = document.getElementById('database-tab-content');

        content.innerHTML = `
            <div class="admin-card mb-2">
                <div class="admin-card-header">
                    <h3>SQL Query Runner</h3>
                    <div class="flex gap-2">
                        <select id="query-mode" onchange="AdminDatabase.setQueryMode(this.value)" class="form-control">
                            <option value="readonly">Read-Only Mode</option>
                            <option value="write">Write Mode (Caution!)</option>
                        </select>
                    </div>
                </div>
                <div class="admin-card-body">
                    <div class="alert alert-warning mb-2">
                        <strong>⚠️ Warning:</strong> Be careful when executing queries. Write operations can modify your database.
                    </div>

                    <div class="form-group">
                        <label>SQL Query:</label>
                        <textarea
                            id="sql-query"
                            class="form-control font-mono"
                            rows="10"
                            placeholder="Enter your SQL query here...&#10;Example: SELECT * FROM users LIMIT 10;"
                        ></textarea>
                    </div>

                    <div class="flex gap-2 mb-2">
                        <button class="btn btn-primary" onclick="AdminDatabase.executeQuery()">
                            ▶️ Run Query
                        </button>
                        <button class="btn btn-secondary" onclick="AdminDatabase.explainQuery()">
                            📊 Explain
                        </button>
                        <button class="btn btn-secondary" onclick="AdminDatabase.formatQuery()">
                            ✨ Format
                        </button>
                        <button class="btn btn-secondary" onclick="AdminDatabase.clearQuery()">
                            🗑️ Clear
                        </button>
                    </div>

                    <!-- Saved Queries -->
                    <div class="form-group">
                        <label>Saved Queries:</label>
                        <select id="saved-queries" class="form-control" onchange="AdminDatabase.loadSavedQuery(this.value)">
                            <option value="">-- Select a saved query --</option>
                            <option value="active-users">Active users by plan</option>
                            <option value="revenue-30">Revenue last 30 days</option>
                            <option value="failed-payments">Failed payments this week</option>
                            <option value="users-no-trades">Users without trades</option>
                            <option value="top-traders">Top traders by P/L</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Query Results -->
            <div class="admin-card" id="query-results-card" >
                <div class="admin-card-header">
                    <h3>Query Results</h3>
                    <button class="btn btn-secondary btn-sm" onclick="AdminDatabase.exportResults()">
                        📥 Export Results
                    </button>
                </div>
                <div class="admin-card-body">
                    <div id="query-results"></div>
                </div>
            </div>

            <!-- Query History -->
            <div class="admin-card mt-2">
                <div class="admin-card-header">
                    <h3>Query History</h3>
                    <button class="btn btn-secondary btn-sm" onclick="AdminDatabase.clearQueryHistory()">
                        Clear History
                    </button>
                </div>
                <div class="admin-card-body">
                    <div id="query-history">
                        <p class="text-muted">No queries executed yet.</p>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Load backups
     */
    async loadBackups() {
        const response = await fetch('/api/admin/database/backups');
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error?.message || 'Failed to load backups');
        }

        this.renderBackups(data.data);
    },

    /**
     * Render backups
     */
    renderBackups(backups) {
        const content = document.getElementById('database-tab-content');

        const formatSize = (bytes) => {
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            if (bytes === 0) return '0 Bytes';
            const i = Math.floor(Math.log(bytes) / Math.log(1024));
            return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
        };

        content.innerHTML = `
            <div class="admin-card mb-2">
                <div class="admin-card-header">
                    <h3>Create Backup</h3>
                </div>
                <div class="admin-card-body">
                    <div class="alert alert-info mb-2">
                        <strong>ℹ️ Backup Information:</strong>
                        <ul>
                            <li>Backups include all tables and data</li>
                            <li>Automatic backups run daily at 2 AM UTC</li>
                            <li>Retention: 7 daily, 4 weekly, 12 monthly</li>
                        </ul>
                    </div>

                    <button class="btn btn-primary" onclick="AdminDatabase.createBackup()">
                        💾 Create Manual Backup Now
                    </button>
                </div>
            </div>

            <div class="admin-card">
                <div class="admin-card-header">
                    <h3>Available Backups</h3>
                </div>
                <div class="admin-card-body">
                    ${(backups.backups && backups.backups.length > 0) ? `
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Filename</th>
                                    <th>Size</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${backups.backups.map(backup => `
                                    <tr>
                                        <td><code>${backup.filename}</code></td>
                                        <td>${formatSize(backup.size || 0)}</td>
                                        <td>${new Date(backup.created_at).toLocaleString()}</td>
                                        <td>
                                            <button class="btn btn-sm btn-secondary" onclick="AdminDatabase.downloadBackup('${backup.filename}')">
                                                📥 Download
                                            </button>
                                            <button class="btn btn-sm btn-warning" onclick="AdminDatabase.confirmRestore('${backup.filename}')">
                                                ↩️ Restore
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p class="text-muted">No backups available.</p>'}
                </div>
            </div>
        `;
    },

    /**
     * Load maintenance
     */
    async loadMaintenance() {
        const response = await fetch('/api/admin/database/maintenance-status');
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error?.message || 'Failed to load maintenance status');
        }

        this.renderMaintenance(data.data);
    },

    /**
     * Render maintenance
     */
    renderMaintenance(maintenance) {
        const content = document.getElementById('database-tab-content');

        content.innerHTML = `
            <div class="admin-card mb-2">
                <div class="admin-card-header">
                    <h3>Maintenance Tasks</h3>
                </div>
                <div class="admin-card-body">
                    <div class="metrics-grid mb-2">
                        <div class="metric-card">
                            <div class="metric-icon">🧹</div>
                            <div class="metric-content">
                                <div class="metric-title">Last VACUUM</div>
                                <div class="metric-value">${maintenance.lastVacuum || 'Never'}</div>
                            </div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-icon">📊</div>
                            <div class="metric-content">
                                <div class="metric-title">Last ANALYZE</div>
                                <div class="metric-value">${maintenance.lastAnalyze || 'Never'}</div>
                            </div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-icon">🔧</div>
                            <div class="metric-content">
                                <div class="metric-title">Last REINDEX</div>
                                <div class="metric-value">${maintenance.lastReindex || 'Never'}</div>
                            </div>
                        </div>
                    </div>

                    <div class="grid-3col">
                        <div>
                            <button class="btn btn-primary btn-full" onclick="AdminDatabase.runVacuum()">
                                🧹 Run VACUUM
                            </button>
                            <p class="text-muted text-sm mt-1">
                                Reclaim storage occupied by dead tuples
                            </p>
                        </div>
                        <div>
                            <button class="btn btn-primary btn-full" onclick="AdminDatabase.runAnalyze()">
                                📊 Run ANALYZE
                            </button>
                            <p class="text-muted text-sm mt-1">
                                Update table statistics for query planner
                            </p>
                        </div>
                        <div>
                            <button class="btn btn-primary btn-full" onclick="AdminDatabase.runReindex()">
                                🔧 Run REINDEX
                            </button>
                            <p class="text-muted text-sm mt-1">
                                Rebuild all indexes for optimal performance
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Index Usage -->
            <div class="admin-card">
                <div class="admin-card-header">
                    <h3>Index Usage Statistics</h3>
                </div>
                <div class="admin-card-body">
                    ${(maintenance.indexes && maintenance.indexes.length > 0) ? `
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Index Name</th>
                                    <th>Table</th>
                                    <th>Index Scans</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${maintenance.indexes.map(index => `
                                    <tr>
                                        <td><code>${index.indexname}</code></td>
                                        <td>${index.tablename}</td>
                                        <td>${(index.idx_scan || 0).toLocaleString()}</td>
                                        <td>
                                            ${index.idx_scan > 100 ?
                                                AdminComponents.badge('Healthy', 'success') :
                                                AdminComponents.badge('Low Usage', 'warning')
                                            }
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p class="text-muted">No index statistics available.</p>'}
                </div>
            </div>
        `;
    },

    /**
     * Execute SQL query
     */
    async executeQuery() {
        const query = document.getElementById('sql-query').value.trim();

        if (!query) {
            AdminComponents.alert({
                type: 'error',
                message: 'Please enter a query',
                autoDismiss: 3000
            });
            return;
        }

        try {
            AdminComponents.alert({
                type: 'info',
                message: 'Executing query...',
                autoDismiss: false
            });

            const response = await fetch('/api/admin/database/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    mode: this.queryMode
                })
            });

            const data = await response.json();

            AdminComponents.alert({
                type: 'success',
                message: `Query executed successfully (${data.data.executionTime}ms)`,
                autoDismiss: 3000
            });

            this.displayQueryResults(data.data);
            this.addToQueryHistory(query, data.data);

        } catch (error) {
            AdminComponents.alert({
                type: 'error',
                message: `Query failed: ${error.message}`,
                autoDismiss: 5000
            });
        }
    },

    /**
     * Display query results
     */
    displayQueryResults(results) {
        const card = document.getElementById('query-results-card');
        const container = document.getElementById('query-results');

        card

        if (!results.rows || results.rows.length === 0) {
            container.innerHTML = '<p class="text-muted">Query returned no results.</p>';
            return;
        }

        const columns = Object.keys(results.rows[0]);

        let html = `
            <div class="mb-2">
                <strong>Rows returned:</strong> ${results.rowCount} |
                <strong>Execution time:</strong> ${results.executionTime}ms
            </div>
            <div class="table-responsive">
                <table class="table table-sm">
                    <thead>
                        <tr>
                            ${columns.map(col => `<th>${col}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${results.rows.slice(0, 100).map(row => `
                            <tr>
                                ${columns.map(col => `<td>${row[col] !== null ? row[col] : '<em>null</em>'}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${results.rowCount > 100 ? '<p class="text-muted">Showing first 100 rows</p>' : ''}
        `;

        container.innerHTML = html;
        this.currentResults = results;
    },

    /**
     * Add query to history
     */
    addToQueryHistory(query, results) {
        this.queryHistory.unshift({
            query,
            timestamp: new Date(),
            rowCount: results.rowCount,
            executionTime: results.executionTime
        });

        if (this.queryHistory.length > 10) {
            this.queryHistory = this.queryHistory.slice(0, 10);
        }

        this.updateQueryHistoryDisplay();
    },

    /**
     * Update query history display
     */
    updateQueryHistoryDisplay() {
        const container = document.getElementById('query-history');

        if (this.queryHistory.length === 0) {
            container.innerHTML = '<p class="text-muted">No queries executed yet.</p>';
            return;
        }

        container.innerHTML = this.queryHistory.map((item, index) => `
            <div class="query-history-item">
                <div class="flex-between mb-1">
                    <small class="text-muted">${item.timestamp.toLocaleString()}</small>
                    <small class="text-muted">${item.rowCount} rows • ${item.executionTime}ms</small>
                </div>
                <code class="code-block">${item.query}</code>
                <button class="btn btn-sm btn-secondary mt-1" onclick="AdminDatabase.rerunQuery(${index})">
                    ▶️ Re-run
                </button>
            </div>
        `).join('');
    },

    /**
     * Set query mode
     */
    setQueryMode(mode) {
        this.queryMode = mode;

        if (mode === 'write') {
            AdminComponents.alert({
                type: 'warning',
                message: '⚠️ Write mode enabled - use caution!',
                autoDismiss: 5000
            });
        }
    },

    /**
     * Load saved query
     */
    loadSavedQuery(queryType) {
        const queries = {
            'active-users': `SELECT
    sp.plan_name,
    COUNT(*) as subscribers,
    SUM(us.amount_paid) as total_revenue
FROM user_subscriptions us
JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE us.status = 'active'
GROUP BY sp.plan_name
ORDER BY total_revenue DESC;`,
            'revenue-30': `SELECT
    DATE(payment_date) as date,
    COUNT(*) as transactions,
    SUM(amount) as revenue
FROM payment_transactions
WHERE payment_date >= NOW() - INTERVAL '30 days'
  AND status = 'completed'
GROUP BY DATE(payment_date)
ORDER BY date DESC;`,
            'failed-payments': `SELECT
    user_email,
    amount,
    currency,
    payment_provider,
    created_at,
    error_message
FROM payment_transactions
WHERE status = 'failed'
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;`,
            'users-no-trades': `SELECT
    u.email,
    u.name,
    u.first_login,
    u.last_login
FROM users u
LEFT JOIN trades t ON u.email = t.user_email
WHERE t.id IS NULL
ORDER BY u.first_login DESC;`,
            'top-traders': `SELECT
    user_email,
    COUNT(*) as total_trades,
    ROUND(AVG(profit_loss_percentage), 2) as avg_pl_pct,
    SUM(CASE WHEN profit_loss_percentage > 0 THEN 1 ELSE 0 END) as winning_trades
FROM trades
WHERE status = 'closed'
GROUP BY user_email
ORDER BY avg_pl_pct DESC
LIMIT 10;`
        };

        if (queries[queryType]) {
            document.getElementById('sql-query').value = queries[queryType];
        }
    },

    /**
     * Utilities
     */
    formatQuery() {
        AdminComponents.alert({
            type: 'info',
            message: 'Query formatting coming soon',
            autoDismiss: 2000
        });
    },

    clearQuery() {
        document.getElementById('sql-query').value = '';
        document.getElementById('saved-queries').value = '';
    },

    clearQueryHistory() {
        this.queryHistory = [];
        this.updateQueryHistoryDisplay();
    },

    rerunQuery(index) {
        const item = this.queryHistory[index];
        document.getElementById('sql-query').value = item.query;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    async explainQuery() {
        AdminComponents.alert({
            type: 'info',
            message: 'Query explanation coming soon',
            autoDismiss: 2000
        });
    },

    async exportResults() {
        if (!this.currentResults) return;

        const csv = this.resultsToCSV(this.currentResults.rows);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `query-results-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    },

    resultsToCSV(rows) {
        if (!rows || rows.length === 0) return '';

        const columns = Object.keys(rows[0]);
        let csv = columns.join(',') + '\n';

        rows.forEach(row => {
            csv += columns.map(col => {
                const value = row[col];
                return value !== null ? `"${value}"` : '';
            }).join(',') + '\n';
        });

        return csv;
    },

    /**
     * Migration actions
     */
    async runPendingMigrations() {
        if (!confirm('Run all pending migrations? This cannot be undone.')) return;

        try {
            AdminComponents.alert({
                type: 'info',
                message: 'Running migrations...',
                autoDismiss: false
            });

            const response = await fetch('/api/admin/database/migrations/run', {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                AdminComponents.alert({
                    type: 'success',
                    message: 'Migrations completed successfully',
                    autoDismiss: 3000
                });
                await this.loadMigrations();
            } else {
                throw new Error(data.error?.message || 'Migration failed');
            }
        } catch (error) {
            AdminComponents.alert({
                type: 'error',
                message: `Migration failed: ${error.message}`,
                autoDismiss: 5000
            });
        }
    },

    async runMigration(filename) {
        if (!confirm(`Run migration: ${filename}?`)) return;

        try {
            const response = await fetch('/api/admin/database/migrations/run-single', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            });

            const data = await response.json();

            if (data.success) {
                AdminComponents.alert({
                    type: 'success',
                    message: 'Migration completed',
                    autoDismiss: 3000
                });
                await this.loadMigrations();
            }
        } catch (error) {
            AdminComponents.alert({
                type: 'error',
                message: `Migration failed: ${error.message}`,
                autoDismiss: 5000
            });
        }
    },

    /**
     * Backup actions
     */
    async createBackup() {
        if (!confirm('Create a manual backup? This may take a few minutes.')) return;

        try {
            AdminComponents.alert({
                type: 'info',
                message: 'Creating backup...',
                autoDismiss: false
            });

            const response = await fetch('/api/admin/database/backups/create', {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                AdminComponents.alert({
                    type: 'success',
                    message: 'Backup created successfully',
                    autoDismiss: 3000
                });
                await this.loadBackups();
            }
        } catch (error) {
            AdminComponents.alert({
                type: 'error',
                message: `Backup failed: ${error.message}`,
                autoDismiss: 5000
            });
        }
    },

    async downloadBackup(filename) {
        window.location.href = `/api/admin/database/backups/download/${filename}`;
    },

    confirmRestore(filename) {
        const confirmed = prompt(`⚠️ WARNING: Restoring will overwrite the current database!\\n\\nType "RESTORE" to confirm restoration of ${filename}:`);

        if (confirmed === 'RESTORE') {
            this.restoreBackup(filename);
        }
    },

    async restoreBackup(filename) {
        try {
            AdminComponents.alert({
                type: 'info',
                message: 'Restoring backup...',
                autoDismiss: false
            });

            const response = await fetch('/api/admin/database/backups/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            });

            const data = await response.json();

            if (data.success) {
                AdminComponents.alert({
                    type: 'success',
                    message: 'Backup restored successfully',
                    autoDismiss: 5000
                });
            }
        } catch (error) {
            AdminComponents.alert({
                type: 'error',
                message: `Restore failed: ${error.message}`,
                autoDismiss: 5000
            });
        }
    },

    /**
     * Maintenance actions
     */
    async runVacuum() {
        if (!confirm('Run VACUUM on all tables? This may take a while.')) return;

        try {
            AdminComponents.alert({
                type: 'info',
                message: 'Running VACUUM...',
                autoDismiss: false
            });

            const response = await fetch('/api/admin/database/maintenance/vacuum', {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                AdminComponents.alert({
                    type: 'success',
                    message: 'VACUUM completed successfully',
                    autoDismiss: 3000
                });
                await this.loadMaintenance();
            }
        } catch (error) {
            AdminComponents.alert({
                type: 'error',
                message: `VACUUM failed: ${error.message}`,
                autoDismiss: 5000
            });
        }
    },

    async runAnalyze() {
        if (!confirm('Run ANALYZE on all tables?')) return;

        try {
            AdminComponents.alert({
                type: 'info',
                message: 'Running ANALYZE...',
                autoDismiss: false
            });

            const response = await fetch('/api/admin/database/maintenance/analyze', {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                AdminComponents.alert({
                    type: 'success',
                    message: 'ANALYZE completed successfully',
                    autoDismiss: 3000
                });
                await this.loadMaintenance();
            }
        } catch (error) {
            AdminComponents.alert({
                type: 'error',
                message: `ANALYZE failed: ${error.message}`,
                autoDismiss: 5000
            });
        }
    },

    async runReindex() {
        if (!confirm('Rebuild all indexes? This may take a while and will lock tables.')) return;

        try {
            AdminComponents.alert({
                type: 'info',
                message: 'Running REINDEX...',
                autoDismiss: false
            });

            const response = await fetch('/api/admin/database/maintenance/reindex', {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                AdminComponents.alert({
                    type: 'success',
                    message: 'REINDEX completed successfully',
                    autoDismiss: 3000
                });
                await this.loadMaintenance();
            }
        } catch (error) {
            AdminComponents.alert({
                type: 'error',
                message: `REINDEX failed: ${error.message}`,
                autoDismiss: 5000
            });
        }
    },

    async analyzeTable(tableName) {
        try {
            const response = await fetch('/api/admin/database/maintenance/analyze-table', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tableName })
            });

            const data = await response.json();

            if (data.success) {
                AdminComponents.alert({
                    type: 'success',
                    message: `Table ${tableName} analyzed successfully`,
                    autoDismiss: 2000
                });
            }
        } catch (error) {
            AdminComponents.alert({
                type: 'error',
                message: `Analysis failed: ${error.message}`,
                autoDismiss: 3000
            });
        }
    },

    /**
     * Refresh health check
     */
    async refreshHealthCheck() {
        try {
            AdminComponents.alert({
                type: 'info',
                message: 'Refreshing health check...',
                autoDismiss: 2000
            });

            await this.loadHealthMonitor();

            AdminComponents.alert({
                type: 'success',
                message: 'Health check refreshed',
                autoDismiss: 2000
            });
        } catch (error) {
            AdminComponents.alert({
                type: 'error',
                message: `Failed to refresh: ${error.message}`,
                autoDismiss: 3000
            });
        }
    },

    /**
     * Show test runner modal
     */
    showTestRunner() {
        const content = document.getElementById('database-tab-content');

        content.innerHTML = `
            <div class="admin-card mb-2">
                <div class="admin-card-header">
                    <h3>Test Suite Runner</h3>
                    <button class="btn btn-secondary btn-sm" onclick="AdminDatabase.loadHealthMonitor()">
                        ← Back to Health Monitor
                    </button>
                </div>
                <div class="admin-card-body">
                    <div class="alert alert-info mb-2">
                        <strong>ℹ️ Test Suite Information:</strong>
                        <ul class="mb-0">
                            <li>Database Tests: Verify database integrity and operations</li>
                            <li>Performance Tests: Measure system performance and benchmarks</li>
                            <li>System Verification: Run complete system health check</li>
                        </ul>
                    </div>

                    <!-- Test Options -->
                    <div class="grid-3col mb-2">
                        <div>
                            <button class="btn btn-primary btn-full" onclick="AdminDatabase.runDatabaseTests()">
                                🗄️ Run Database Tests
                            </button>
                            <p class="text-muted text-sm mt-1">
                                Tests database connections, queries, and data integrity
                            </p>
                        </div>
                        <div>
                            <button class="btn btn-primary btn-full" onclick="AdminDatabase.runPerformanceTests()">
                                ⚡ Run Performance Tests
                            </button>
                            <p class="text-muted text-sm mt-1">
                                Tests system performance and response times
                            </p>
                        </div>
                        <div>
                            <button class="btn btn-success btn-full" onclick="AdminDatabase.runSystemVerification()">
                                ✓ Full System Verification
                            </button>
                            <p class="text-muted text-sm mt-1">
                                Comprehensive verification of all components
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Test Output -->
            <div class="admin-card" id="test-output-card" style="display: none;">
                <div class="admin-card-header">
                    <h3>Test Results</h3>
                    <button class="btn btn-secondary btn-sm" onclick="AdminDatabase.clearTestOutput()">
                        Clear Output
                    </button>
                </div>
                <div class="admin-card-body">
                    <div id="test-output-status" class="mb-2"></div>
                    <div id="test-output-content" class="code-block" style="max-height: 500px; overflow-y: auto; background: #1e1e1e; color: #d4d4d4; padding: 15px; border-radius: 4px; font-family: 'Roboto Mono', monospace; font-size: 12px; white-space: pre-wrap;"></div>
                </div>
            </div>
        `;
    },

    /**
     * Run database tests
     */
    async runDatabaseTests() {
        this.showTestOutput();
        this.setTestStatus('Running database tests...', 'info');

        try {
            const response = await fetch('/api/admin/tests/database', {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                this.setTestStatus('✅ Database tests passed!', 'success');
            } else {
                this.setTestStatus(`❌ Database tests failed (exit code: ${data.exitCode})`, 'error');
            }

            this.appendTestOutput(data.output);
            if (data.errors) {
                this.appendTestOutput('\n--- ERRORS ---\n' + data.errors);
            }

            AdminComponents.alert({
                type: data.success ? 'success' : 'error',
                message: data.success ? 'Database tests passed' : 'Database tests failed',
                autoDismiss: 5000
            });
        } catch (error) {
            this.setTestStatus('❌ Error running tests', 'error');
            this.appendTestOutput('Error: ' + error.message);

            AdminComponents.alert({
                type: 'error',
                message: `Test error: ${error.message}`,
                autoDismiss: 5000
            });
        }
    },

    /**
     * Run performance tests
     */
    async runPerformanceTests() {
        this.showTestOutput();
        this.setTestStatus('Running performance tests... (this may take a while)', 'info');

        try {
            const response = await fetch('/api/admin/tests/performance', {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                this.setTestStatus('✅ Performance tests passed!', 'success');
            } else {
                this.setTestStatus(`❌ Performance tests failed (exit code: ${data.exitCode})`, 'error');
            }

            this.appendTestOutput(data.output);
            if (data.errors) {
                this.appendTestOutput('\n--- ERRORS ---\n' + data.errors);
            }

            AdminComponents.alert({
                type: data.success ? 'success' : 'error',
                message: data.success ? 'Performance tests passed' : 'Performance tests failed',
                autoDismiss: 5000
            });
        } catch (error) {
            this.setTestStatus('❌ Error running tests', 'error');
            this.appendTestOutput('Error: ' + error.message);

            AdminComponents.alert({
                type: 'error',
                message: `Test error: ${error.message}`,
                autoDismiss: 5000
            });
        }
    },

    /**
     * Run system verification
     */
    async runSystemVerification(quick = false) {
        this.showTestOutput();
        this.setTestStatus('Running system verification... (this may take a few minutes)', 'info');

        try {
            const response = await fetch('/api/admin/tests/verify-system', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quick })
            });

            const data = await response.json();

            if (data.success) {
                this.setTestStatus('✅ System verification passed!', 'success');
            } else {
                this.setTestStatus(`⚠️ System verification completed with warnings (exit code: ${data.exitCode})`, 'warning');
            }

            this.appendTestOutput(data.output);
            if (data.errors) {
                this.appendTestOutput('\n--- ERRORS ---\n' + data.errors);
            }

            AdminComponents.alert({
                type: data.success ? 'success' : 'warning',
                message: data.success ? 'System verification passed' : 'System verification completed with warnings',
                autoDismiss: 5000
            });
        } catch (error) {
            this.setTestStatus('❌ Error running verification', 'error');
            this.appendTestOutput('Error: ' + error.message);

            AdminComponents.alert({
                type: 'error',
                message: `Verification error: ${error.message}`,
                autoDismiss: 5000
            });
        }
    },

    /**
     * Show test output card
     */
    showTestOutput() {
        const card = document.getElementById('test-output-card');
        if (card) {
            card.style.display = 'block';
            const content = document.getElementById('test-output-content');
            if (content) content.textContent = '';
        }
    },

    /**
     * Set test status
     */
    setTestStatus(message, type) {
        const statusEl = document.getElementById('test-output-status');
        if (!statusEl) return;

        const alertClass = type === 'success' ? 'alert-success' :
                          type === 'error' ? 'alert-danger' :
                          type === 'warning' ? 'alert-warning' : 'alert-info';

        statusEl.innerHTML = `<div class="alert ${alertClass}">${message}</div>`;
    },

    /**
     * Append test output
     */
    appendTestOutput(text) {
        const outputEl = document.getElementById('test-output-content');
        if (outputEl) {
            outputEl.textContent += text;
            outputEl.scrollTop = outputEl.scrollHeight;
        }
    },

    /**
     * Clear test output
     */
    clearTestOutput() {
        const card = document.getElementById('test-output-card');
        if (card) {
            card.style.display = 'none';
        }
    }
};
