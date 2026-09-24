/**
 * Admin Database Tools Module
 * Health, the migration files, the SQL console and table maintenance. Until 2026-09-24 it also
 * offered backups (create, download, restore) and "run migration" buttons that did nothing and
 * reported success, and a header that always said "Connected".
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
                </div>

                <div class="admin-card-body">
                    <!-- Tab Navigation -->
                    <div class="tab-navigation mb-2">
                        <button
                            class="tab-btn ${this.currentTab === 'health' ? 'active' : ''}"
                            onclick="AdminDatabase.switchTab('health')"
                        >
                             Health Monitor
                        </button>
                        <button
                            class="tab-btn ${this.currentTab === 'migrations' ? 'active' : ''}"
                            onclick="AdminDatabase.switchTab('migrations')"
                        >
                             Migrations
                        </button>
                        <button
                            class="tab-btn ${this.currentTab === 'query' ? 'active' : ''}"
                            onclick="AdminDatabase.switchTab('query')"
                        >
                             Query Runner
                        </button>
                        <button
                            class="tab-btn ${this.currentTab === 'maintenance' ? 'active' : ''}"
                            onclick="AdminDatabase.switchTab('maintenance')"
                        >
                             Maintenance
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
                            <div class="metric-icon"></div>
                            <div class="metric-content">
                                <div class="metric-title">Checks Passed</div>
                                <div class="metric-value">${passCount}</div>
                            </div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-icon"></div>
                            <div class="metric-content">
                                <div class="metric-title">Checks Failed</div>
                                <div class="metric-value">${failCount}</div>
                            </div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-icon"></div>
                            <div class="metric-content">
                                <div class="metric-title">Warnings</div>
                                <div class="metric-value">${health.warnings.length}</div>
                            </div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-icon"></div>
                            <div class="metric-content">
                                <div class="metric-title">Last Check</div>
                                <div class="metric-value">${new Date(health.timestamp).toLocaleTimeString()}</div>
                            </div>
                        </div>
                    </div>

                    <div class="flex gap-2">
                        <button class="btn btn-primary" onclick="AdminDatabase.refreshHealthCheck()">
                             Refresh Health Check
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
                    ${health.checks.length >0 ? `
                        <div class="table-responsive"><table class="table">
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
                                                ? '<span class="badge badge-success">Pass</span>'
                                                : '<span class="badge badge-danger">Fail</span>'}
                                        </td>
                                        <td>${check.message}</td>
                                        <td>${check.duration || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table></div>
                    ` : '<p class="text-muted">No health checks available</p>'}
                </div>
            </div>

            <!-- Warnings -->
            ${health.warnings.length >0 ? `
                <div class="admin-card">
                    <div class="admin-card-header">
                        <h3>Warnings</h3>
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
     * Render migrations: the files, and which of them schema_migrations records. Nothing here applies
     * one: they are applied by hand, and run-single-migration.js does not record them.
     */
    renderMigrations(migrations) {
        const content = document.getElementById('database-tab-content');
        const recorded = migrations.recorded || [];
        const unrecorded = migrations.unrecorded || [];

        const metrics = document.createElement('div');
        metrics.className = 'metrics-grid mb-2';
        metrics.append(
            AdminComponents.metricCardEl('Recorded', String(recorded.length), 'In schema_migrations'),
            AdminComponents.metricCardEl('Not recorded', String(unrecorded.length), 'Applied by hand, or never')
        );

        content.replaceChildren(
            AdminComponents.cardEl('Migration Files', metrics,
                AdminComponents.noteEl('Migrations are applied by hand with run-single-migration.js, which does not record them. ' +
                    'A file listed as not recorded may well be applied: this page cannot tell, and it applies nothing.')),
            AdminComponents.cardEl('Not Recorded', unrecorded.length
                ? AdminComponents.tableEl(['Migration file'], unrecorded.map(name => [name]))
                : AdminComponents.noteEl('Every migration file is recorded.')),
            AdminComponents.cardEl('Recorded (newest first)', recorded.length
                ? AdminComponents.tableEl(['Migration file', 'Recorded at'], recorded.map(migration => [
                    migration.filename, migration.applied_at ? DateFormatter.formatTime(migration.applied_at) : 'Unknown'
                ]))
                : AdminComponents.noteEl('schema_migrations records nothing.'))
        );
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
                        Read-only mode runs one statement at a time in a read-only transaction: the database refuses any change.
                        Write mode runs the text as given and can change or delete data.
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
                            ▶ Run Query
                        </button>
                        <button class="btn btn-secondary" onclick="AdminDatabase.clearQuery()">
                             Clear
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
                         Export Results
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
                            <div class="metric-icon"></div>
                            <div class="metric-content">
                                <div class="metric-title">Last VACUUM</div>
                                <div class="metric-value">${maintenance.lastVacuum || 'Never'}</div>
                            </div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-icon"></div>
                            <div class="metric-content">
                                <div class="metric-title">Last ANALYZE</div>
                                <div class="metric-value">${maintenance.lastAnalyze || 'Never'}</div>
                            </div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-icon"></div>
                            <div class="metric-content">
                                <div class="metric-title">Last REINDEX</div>
                                <div class="metric-value">${maintenance.lastReindex || 'Never'}</div>
                            </div>
                        </div>
                    </div>

                    <div class="grid-3col">
                        <div>
                            <button class="btn btn-primary btn-full" onclick="AdminDatabase.runVacuum()">
                                 Run VACUUM
                            </button>
                            <p class="text-muted text-sm mt-1">
                                Reclaim storage occupied by dead tuples
                            </p>
                        </div>
                        <div>
                            <button class="btn btn-primary btn-full" onclick="AdminDatabase.runAnalyze()">
                                 Run ANALYZE
                            </button>
                            <p class="text-muted text-sm mt-1">
                                Update table statistics for query planner
                            </p>
                        </div>
                        <div>
                            <button class="btn btn-primary btn-full" onclick="AdminDatabase.runReindex()">
                                 Run REINDEX
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
                    ${(maintenance.indexes && maintenance.indexes.length >0) ? `
                        <div class="table-responsive"><table class="table">
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
                                            ${index.idx_scan >100 ?
                                                AdminComponents.badge({ text: 'Healthy', type: 'success' }) :
                                                AdminComponents.badge({ text: 'Low Usage', type: 'warning' })
                                            }
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table></div>
                    ` : '<p class="text-muted">No index statistics available.</p>'}
                </div>
            </div>
        `;
    },

    /**
     * Execute SQL query. A refusal shows the server's reason: it used to announce success before
     * reading the answer.
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
            const response = await fetch('/api/admin/database/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    mode: this.queryMode
                })
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error?.message || `The query failed (${response.status})`);
            }

            AdminComponents.alert({
                type: 'success',
                message: `Query ran in ${data.data.executionTime} ms`,
                autoDismiss: 3000
            });

            this.displayQueryResults(data.data);
            this.addToQueryHistory(query, data.data);

        } catch (error) {
            // The last query's rows must not stay on screen under a query that failed
            this.currentResults = null;
            const container = document.getElementById('query-results');
            if (container) container.replaceChildren(AdminComponents.noteEl(`The query failed: ${error.message}`));
            // alert() takes markup, and a Postgres message can quote a stored value
            AdminComponents.alert({
                type: 'error',
                message: `Query failed: ${AdminComponents.escapeHtml(error.message)}`,
                autoDismiss: 8000
            });
        }
    },

    /**
     * Display query results, as text: a value is whatever the table holds
     */
    displayQueryResults(results) {
        const container = document.getElementById('query-results');
        this.currentResults = results;

        if (!results.rows || results.rows.length === 0) {
            const affected = Number.isInteger(results.rowCount) ? ` (${results.rowCount} rows affected)` : '';
            container.replaceChildren(AdminComponents.noteEl(`The statement returned no rows${affected}.`));
            return;
        }

        const columns = Object.keys(results.rows[0]);
        const text = value => (value === null ? 'null' : (typeof value === 'object' ? JSON.stringify(value) : String(value)));
        const shown = results.rows.slice(0, 100);
        container.replaceChildren(
            AdminComponents.noteEl(`${results.rowCount} row${results.rowCount === 1 ? '' : 's'} in ${results.executionTime} ms` +
                (results.rows.length > shown.length ? `; the first ${shown.length} are shown` : '')),
            AdminComponents.tableEl(columns, shown.map(row => columns.map(column => text(row[column]))))
        );
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

        if (this.queryHistory.length >10) {
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
                    <small class="text-muted">${DateFormatter.formatTime(item.timestamp)}</small>
                    <small class="text-muted">${item.rowCount} rows • ${item.executionTime}ms</small>
                </div>
                <code class="code-block">${item.query}</code>
                <button class="btn btn-sm btn-secondary mt-1" onclick="AdminDatabase.rerunQuery(${index})">
                    ▶ Re-run
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
                message: ' Write mode enabled - use caution!',
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
    COALESCE(us.plan_name, sp.plan_name) as plan_name,
    us.currency,
    COUNT(*) as subscribers,
    SUM(us.amount_paid) as total_paid
FROM user_subscriptions us
LEFT JOIN subscription_plans sp ON sp.id = us.plan_id OR (us.plan_id IS NULL AND sp.plan_code = us.plan_code)
WHERE us.status = 'active'
GROUP BY 1, 2
ORDER BY total_paid DESC;`,
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
LEFT JOIN trades t ON u.email = t.user_id
WHERE t.id IS NULL
ORDER BY u.first_login DESC;`,
            'top-traders': `SELECT
    user_id,
    COUNT(*) as total_trades,
    ROUND(AVG(profit_loss_percentage), 2) as avg_pl_pct,
    SUM(CASE WHEN profit_loss_percentage >0 THEN 1 ELSE 0 END) as winning_trades
FROM trades
WHERE status = 'closed'
GROUP BY user_id
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
     * Maintenance actions. Each shows what the server answered: a failure used to show nothing, and a
     * REINDEX that failed on every table said "completed successfully".
     */
    async runMaintenance(task, question) {
        if (!confirm(question)) return;

        const running = AdminComponents.alert({
            type: 'info',
            message: `Running ${task.toUpperCase()}...`,
            autoDismiss: 0
        });

        try {
            const response = await fetch(`/api/admin/database/maintenance/${task}`, {
                method: 'POST'
            });
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error?.message || `${task.toUpperCase()} failed (${response.status})`);
            }

            // VACUUM and ANALYZE put their message in data; REINDEX in the answer, with the failed tables
            const failed = (data.data && data.data.failed) || [];
            const message = (data.data && data.data.message) || data.message;
            const text = failed.length ? `${message}: ${failed.map(f => f.table).join(', ')}` : message;
            AdminComponents.alert({
                type: failed.length ? 'warning' : 'success',
                message: AdminComponents.escapeHtml(text),
                autoDismiss: failed.length ? 0 : 4000
            });
            await this.loadMaintenance();
        } catch (error) {
            AdminComponents.alert({
                type: 'error',
                message: `${task.toUpperCase()} failed: ${AdminComponents.escapeHtml(error.message)}`,
                autoDismiss: 6000
            });
        } finally {
            AdminComponents.dismissAlert(running);
        }
    },

    runVacuum() {
        return this.runMaintenance('vacuum', 'Run VACUUM on all tables? This may take a while.');
    },

    runAnalyze() {
        return this.runMaintenance('analyze', 'Run ANALYZE on all tables?');
    },

    runReindex() {
        return this.runMaintenance('reindex', 'Rebuild all indexes? This may take a while and will lock tables.');
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
    }
};
