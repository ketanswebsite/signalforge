/**
 * Admin Signal Testing Component
 * Provides comprehensive testing and diagnostics for 7 AM signal → 1 PM execution flow
 */

const AdminSignalTesting = {
    // State
    state: {
        pendingSignals: [],
        executionLogs: [],
        diagnostics: null,
        isScanning: false,
        isExecuting: {},
        logEntries: []
    },

    /**
     * Initialize the signal testing page
     */
    async init() {
        console.log('🧪 Initializing Signal Testing page...');

        // Create page HTML
        const pageHTML = this.renderPage();
        document.getElementById('signal-testing-page').innerHTML = pageHTML;

        // Attach event listeners
        this.attachEventListeners();

        // Load initial data
        await this.refreshAll();

        console.log('✅ Signal Testing page initialized');
    },

    /**
     * Render the complete page HTML
     */
    renderPage() {
        return `
            <div class="signal-testing-container">
                <!-- Testing Controls -->
                <div class="admin-card">
                    <div class="admin-card-header">
                        <h2 class="admin-card-title">🧪 Manual Testing Controls</h2>
                        <button class="btn btn-secondary btn-sm" onclick="AdminSignalTesting.refreshAll()">
                            🔄 Refresh All
                        </button>
                    </div>
                    <div class="admin-card-body">
                        <div class="testing-controls-grid">
                            <!-- 7 AM Scan Test -->
                            <div class="test-control-card">
                                <h3>📊 7 AM Signal Scan</h3>
                                <p>Triggers the high conviction scanner that runs at 7 AM UK time</p>
                                <button class="btn btn-primary" onclick="AdminSignalTesting.testScan()" id="test-scan-btn">
                                    🔬 Run 7 AM Scan
                                </button>
                            </div>

                            <!-- 1 PM Execution Tests -->
                            <div class="test-control-card">
                                <h3>⚡ 1 PM Trade Execution</h3>
                                <p>Triggers trade execution for a specific market</p>
                                <div class="execution-buttons">
                                    <button class="btn btn-success btn-sm" onclick="AdminSignalTesting.testExecution('India')" id="test-exec-india">
                                        🇮🇳 Execute India (1 PM IST)
                                    </button>
                                    <button class="btn btn-success btn-sm" onclick="AdminSignalTesting.testExecution('UK')" id="test-exec-uk">
                                        🇬🇧 Execute UK (1 PM GMT)
                                    </button>
                                    <button class="btn btn-success btn-sm" onclick="AdminSignalTesting.testExecution('US')" id="test-exec-us">
                                        🇺🇸 Execute US (1 PM EST)
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Real-time Logs -->
                        <div class="log-display" id="test-log-display">
                            <div class="log-header">
                                <h4>📋 Real-time Logs</h4>
                                <button class="btn btn-secondary btn-sm" onclick="AdminSignalTesting.clearLogs()">Clear</button>
                            </div>
                            <div class="log-content" id="log-content">
                                <div class="log-entry log-info">Ready to test. Click a button above to start.</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Diagnostics Panel -->
                <div class="admin-card">
                    <div class="admin-card-header">
                        <h2 class="admin-card-title">🔍 System Diagnostics</h2>
                        <button class="btn btn-secondary btn-sm" onclick="AdminSignalTesting.loadDiagnostics()">
                            🔄 Refresh
                        </button>
                    </div>
                    <div class="admin-card-body">
                        <div id="diagnostics-content">
                            <div class="spinner-container spinner-medium">
                                <div class="spinner"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Pending Signals Table -->
                <div class="admin-card">
                    <div class="admin-card-header">
                        <h2 class="admin-card-title">📊 Pending Signals</h2>
                        <div class="filter-controls">
                            <select id="signal-status-filter" class="form-select" onchange="AdminSignalTesting.loadPendingSignals()">
                                <option value="pending">Pending</option>
                                <option value="added">Added</option>
                                <option value="dismissed">Dismissed</option>
                                <option value="">All</option>
                            </select>
                            <select id="signal-market-filter" class="form-select" onchange="AdminSignalTesting.loadPendingSignals()">
                                <option value="">All Markets</option>
                                <option value="India">India</option>
                                <option value="UK">UK</option>
                                <option value="US">US</option>
                            </select>
                            <button class="btn btn-secondary btn-sm" onclick="AdminSignalTesting.loadPendingSignals()">
                                🔄 Refresh
                            </button>
                        </div>
                    </div>
                    <div class="admin-card-body">
                        <div id="pending-signals-content">
                            <div class="spinner-container spinner-medium">
                                <div class="spinner"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Execution History -->
                <div class="admin-card">
                    <div class="admin-card-header">
                        <h2 class="admin-card-title">📈 Execution History</h2>
                        <button class="btn btn-secondary btn-sm" onclick="AdminSignalTesting.loadExecutionLogs()">
                            🔄 Refresh
                        </button>
                    </div>
                    <div class="admin-card-body">
                        <div id="execution-logs-content">
                            <div class="spinner-container spinner-medium">
                                <div class="spinner"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                .signal-testing-container {
                    padding: 20px;
                }

                .testing-controls-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 20px;
                    margin-bottom: 20px;
                }

                .test-control-card {
                    padding: 20px;
                    border: 2px solid var(--border-color, #ddd);
                    border-radius: 8px;
                    background: var(--card-bg, #fff);
                }

                .test-control-card h3 {
                    margin-top: 0;
                    color: var(--text-color, #333);
                }

                .test-control-card p {
                    color: var(--text-secondary, #666);
                    margin-bottom: 15px;
                }

                .execution-buttons {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .log-display {
                    margin-top: 20px;
                    border: 1px solid var(--border-color, #ddd);
                    border-radius: 8px;
                    overflow: hidden;
                }

                .log-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 15px;
                    background: var(--bg-secondary, #f5f5f5);
                    border-bottom: 1px solid var(--border-color, #ddd);
                }

                .log-header h4 {
                    margin: 0;
                }

                .log-content {
                    padding: 15px;
                    max-height: 400px;
                    overflow-y: auto;
                    font-family: 'Roboto Mono', monospace;
                    font-size: 13px;
                    background: var(--bg-dark, #1e1e1e);
                    color: var(--text-light, #f0f0f0);
                }

                .log-entry {
                    padding: 5px 10px;
                    margin: 2px 0;
                    border-left: 3px solid transparent;
                    border-radius: 3px;
                }

                .log-entry.log-info {
                    border-left-color: #0dcaf0;
                    background: rgba(13, 202, 240, 0.1);
                }

                .log-entry.log-success {
                    border-left-color: #198754;
                    background: rgba(25, 135, 84, 0.1);
                }

                .log-entry.log-warning {
                    border-left-color: #ffc107;
                    background: rgba(255, 193, 7, 0.1);
                }

                .log-entry.log-error {
                    border-left-color: #dc3545;
                    background: rgba(220, 53, 69, 0.1);
                }

                .diagnostics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 15px;
                }

                .diagnostic-card {
                    padding: 15px;
                    border: 1px solid var(--border-color, #ddd);
                    border-radius: 6px;
                    background: var(--card-bg, #fff);
                }

                .diagnostic-card h4 {
                    margin-top: 0;
                    font-size: 14px;
                    color: var(--text-secondary, #666);
                    text-transform: uppercase;
                }

                .diagnostic-value {
                    font-size: 24px;
                    font-weight: bold;
                    color: var(--primary-color, #0d6efd);
                }

                .diagnostic-detail {
                    font-size: 12px;
                    color: var(--text-secondary, #666);
                    margin-top: 5px;
                }

                .signals-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }

                .signals-table th,
                .signals-table td {
                    padding: 10px;
                    text-align: left;
                    border-bottom: 1px solid var(--border-color, #ddd);
                }

                .signals-table th {
                    background: var(--bg-secondary, #f5f5f5);
                    font-weight: 600;
                    font-size: 12px;
                    text-transform: uppercase;
                }

                .signals-table tr:hover {
                    background: var(--bg-hover, #f9f9f9);
                }

                .badge {
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .badge-pending {
                    background: #ffc107;
                    color: #000;
                }

                .badge-added {
                    background: #198754;
                    color: #fff;
                }

                .badge-dismissed {
                    background: #6c757d;
                    color: #fff;
                }

                .badge-today {
                    background: #0dcaf0;
                    color: #000;
                }

                .badge-old {
                    background: #dc3545;
                    color: #fff;
                }

                .filter-controls {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }

                .form-select {
                    padding: 6px 12px;
                    border: 1px solid var(--border-color, #ddd);
                    border-radius: 4px;
                    background: var(--bg-white, #fff);
                    color: var(--text-color, #333);
                }

                .validation-result {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .validation-result.valid {
                    color: #198754;
                }

                .validation-result.invalid {
                    color: #dc3545;
                }
            </style>
        `;
    },

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Auto-scroll logs to bottom when new entries added
        const logContent = document.getElementById('log-content');
        if (logContent) {
            const observer = new MutationObserver(() => {
                logContent.scrollTop = logContent.scrollHeight;
            });
            observer.observe(logContent, { childList: true });
        }
    },

    /**
     * Refresh all data
     */
    async refreshAll() {
        await Promise.all([
            this.loadPendingSignals(),
            this.loadExecutionLogs(),
            this.loadDiagnostics()
        ]);
    },

    /**
     * Test 7 AM scan
     */
    async testScan() {
        const btn = document.getElementById('test-scan-btn');
        if (this.state.isScanning) return;

        this.state.isScanning = true;
        btn.disabled = true;
        btn.textContent = '🔬 Scanning...';

        this.addLog('info', '🔬 Starting 7 AM signal scan...');

        try {
            const response = await fetch('/api/admin/test-scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                this.addLog('success', `✅ Scan completed successfully`);
                this.addLog('info', `📊 Total scanned: ${data.totalScanned || 0} stocks`);
                this.addLog('info', `🎯 High conviction found: ${data.highConvictionFound || 0}`);
                this.addLog('info', `📈 Recent signals: ${data.recentOpportunities || 0}`);
                this.addLog('info', `📤 Alerts sent: ${data.alertsSent || 0}`);

                // Refresh signals table
                await this.loadPendingSignals();

                AdminComponentsV2.toast({
                    type: 'success',
                    message: 'Signal scan completed successfully!',
                    duration: 5000
                });
            } else {
                throw new Error(data.error || 'Scan failed');
            }
        } catch (error) {
            this.addLog('error', `❌ Scan failed: ${error.message}`);
            AdminComponentsV2.toast({
                type: 'error',
                message: `Scan failed: ${error.message}`,
                duration: 5000
            });
        } finally {
            this.state.isScanning = false;
            btn.disabled = false;
            btn.textContent = '🔬 Run 7 AM Scan';
        }
    },

    /**
     * Test 1 PM execution for a specific market
     */
    async testExecution(market) {
        const btn = document.getElementById(`test-exec-${market.toLowerCase()}`);
        if (this.state.isExecuting[market]) return;

        this.state.isExecuting[market] = true;
        btn.disabled = true;
        btn.textContent = '⚡ Executing...';

        this.addLog('info', `⚡ Starting 1 PM execution for ${market} market...`);

        try {
            const response = await fetch('/api/admin/test-execution', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ market })
            });

            const data = await response.json();

            if (data.success) {
                this.addLog('success', `✅ Execution completed for ${market}`);
                this.addLog('info', `📊 Total signals: ${data.total || 0}`);
                this.addLog('info', `✓ Executed: ${data.executed || 0} trades`);
                this.addLog('info', `⊗ Skipped: ${data.skipped || 0}`);
                this.addLog('info', `✗ Failed: ${data.failed || 0}`);

                // Refresh data
                await Promise.all([
                    this.loadPendingSignals(),
                    this.loadExecutionLogs(),
                    this.loadDiagnostics()
                ]);

                AdminComponentsV2.toast({
                    type: 'success',
                    message: `${market} execution completed!`,
                    duration: 5000
                });
            } else {
                throw new Error(data.error || 'Execution failed');
            }
        } catch (error) {
            this.addLog('error', `❌ Execution failed: ${error.message}`);
            AdminComponentsV2.toast({
                type: 'error',
                message: `Execution failed: ${error.message}`,
                duration: 5000
            });
        } finally {
            this.state.isExecuting[market] = false;
            const flag = market === 'India' ? '🇮🇳' : market === 'UK' ? '🇬🇧' : '🇺🇸';
            btn.disabled = false;
            btn.textContent = `${flag} Execute ${market} (1 PM)`;
        }
    },

    /**
     * Load pending signals
     */
    async loadPendingSignals() {
        const content = document.getElementById('pending-signals-content');
        if (!content) return;

        try {
            const statusFilter = document.getElementById('signal-status-filter')?.value || 'pending';
            const marketFilter = document.getElementById('signal-market-filter')?.value || '';

            const params = new URLSearchParams();
            if (statusFilter) params.append('status', statusFilter);
            if (marketFilter) params.append('market', marketFilter);

            const response = await fetch(`/api/admin/pending-signals?${params}`);
            const data = await response.json();

            if (data.success) {
                this.state.pendingSignals = data.signals;
                content.innerHTML = this.renderPendingSignals(data);
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            content.innerHTML = `<div class="alert alert-error">Error loading signals: ${error.message}</div>`;
        }
    },

    /**
     * Render pending signals table
     */
    renderPendingSignals(data) {
        if (!data.signals || data.signals.length === 0) {
            return '<div class="alert alert-info">No signals found matching the selected filters.</div>';
        }

        let html = `
            <div class="signals-summary">
                <div class="summary-item">
                    <strong>Total:</strong> ${data.total}
                </div>
                <div class="summary-item">
                    <strong>Today's Date:</strong> ${data.today}
                </div>
            </div>

            <table class="signals-table">
                <thead>
                    <tr>
                        <th>Symbol</th>
                        <th>Market</th>
                        <th>Signal Date</th>
                        <th>Status</th>
                        <th>Win Rate</th>
                        <th>Entry Price</th>
                        <th>Will Execute?</th>
                    </tr>
                </thead>
                <tbody>
        `;

        data.signals.forEach(signal => {
            const statusClass = `badge-${signal.status}`;
            const dateClass = signal.is_today ? 'badge-today' : (signal.days_old > 5 ? 'badge-old' : '');

            html += `
                <tr>
                    <td><strong>${signal.symbol}</strong></td>
                    <td>${signal.market}</td>
                    <td>
                        ${signal.signal_date_formatted}
                        ${signal.days_old > 0 ? `<span class="badge ${dateClass}">${signal.days_old} days old</span>` : '<span class="badge badge-today">Today</span>'}
                    </td>
                    <td><span class="badge ${statusClass}">${signal.status}</span></td>
                    <td>${signal.win_rate?.toFixed(1)}%</td>
                    <td>${signal.entry_price?.toFixed(2)}</td>
                    <td>${signal.will_execute ? '✅ Yes' : '❌ No'}</td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        return html;
    },

    /**
     * Load execution logs
     */
    async loadExecutionLogs() {
        const content = document.getElementById('execution-logs-content');
        if (!content) return;

        try {
            const response = await fetch('/api/admin/execution-logs');
            const data = await response.json();

            if (data.success) {
                this.state.executionLogs = data.executionLogs;
                content.innerHTML = this.renderExecutionLogs(data);
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            content.innerHTML = `<div class="alert alert-error">Error loading logs: ${error.message}</div>`;
        }
    },

    /**
     * Render execution logs
     */
    renderExecutionLogs(data) {
        let html = `<h4>Today's Auto-Added Trades (${data.today})</h4>`;

        if (!data.todayTrades || data.todayTrades.length === 0) {
            html += '<div class="alert alert-info">No trades executed today yet.</div>';
        } else {
            html += `
                <table class="signals-table">
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th>Market</th>
                            <th>Entry Time</th>
                            <th>Entry Price</th>
                            <th>Trade Size</th>
                            <th>Win Rate</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            data.todayTrades.forEach(trade => {
                const entryTime = new Date(trade.entry_date).toLocaleTimeString();
                html += `
                    <tr>
                        <td><strong>${trade.symbol}</strong></td>
                        <td>${trade.market}</td>
                        <td>${entryTime}</td>
                        <td>${trade.entry_price?.toFixed(2)}</td>
                        <td>${trade.trade_size?.toFixed(0)}</td>
                        <td>${trade.win_rate?.toFixed(1)}%</td>
                    </tr>
                `;
            });

            html += `
                    </tbody>
                </table>
            `;
        }

        if (data.executionLogs && data.executionLogs.length > 0) {
            html += '<h4 style="margin-top: 30px;">Recent Execution History</h4>';
            html += '<div class="execution-logs-list">';

            data.executionLogs.forEach(log => {
                const timestamp = new Date(log.timestamp).toLocaleString();
                html += `
                    <div class="log-card">
                        <div class="log-card-header">
                            <strong>${log.market} Market</strong>
                            <span>${timestamp}</span>
                        </div>
                        <div class="log-card-body">
                            <div>Total: ${log.summary?.total || 0}</div>
                            <div>✓ Executed: ${log.summary?.executed || 0}</div>
                            <div>⊗ Skipped: ${log.summary?.skipped || 0}</div>
                            <div>✗ Failed: ${log.summary?.failed || 0}</div>
                        </div>
                    </div>
                `;
            });

            html += '</div>';
        }

        return html;
    },

    /**
     * Load diagnostics
     */
    async loadDiagnostics() {
        const content = document.getElementById('diagnostics-content');
        if (!content) return;

        try {
            const response = await fetch('/api/admin/signal-diagnostics');
            const data = await response.json();

            if (data.success) {
                this.state.diagnostics = data.diagnostics;
                content.innerHTML = this.renderDiagnostics(data);
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            content.innerHTML = `<div class="alert alert-error">Error loading diagnostics: ${error.message}</div>`;
        }
    },

    /**
     * Render diagnostics
     */
    renderDiagnostics(data) {
        const d = data.diagnostics;

        let html = '<div class="diagnostics-grid">';

        // System Status
        html += `
            <div class="diagnostic-card">
                <h4>System Status</h4>
                <div class="diagnostic-value">${d.cronStatus.scannerInitialized && d.cronStatus.executorInitialized ? '✅ Online' : '⚠️ Partial'}</div>
                <div class="diagnostic-detail">
                    Scanner: ${d.cronStatus.scannerInitialized ? '✓' : '✗'}<br>
                    Executor: ${d.cronStatus.executorInitialized ? '✓' : '✗'}
                </div>
            </div>
        `;

        // Pending Signals
        html += `
            <div class="diagnostic-card">
                <h4>Pending Signals</h4>
                <div class="diagnostic-value">${d.pendingSignalsToday}</div>
                <div class="diagnostic-detail">
                    Today's signals that will execute<br>
                    Total pending: ${d.pendingSignalsTotal}
                </div>
            </div>
        `;

        // Dismissed Today
        html += `
            <div class="diagnostic-card">
                <h4>Dismissed Today</h4>
                <div class="diagnostic-value">${d.dismissedToday}</div>
                <div class="diagnostic-detail">
                    Signals dismissed due to limits or validation failures
                </div>
            </div>
        `;

        // Capital Status
        const capital = d.capitalStatus.capital;
        ['India', 'UK', 'US'].forEach(market => {
            if (capital[market]) {
                const cap = capital[market];
                html += `
                    <div class="diagnostic-card">
                        <h4>${market} Capital</h4>
                        <div class="diagnostic-value">${cap.available.toFixed(0)}</div>
                        <div class="diagnostic-detail">
                            Positions: ${cap.positions}/${cap.maxPositions}<br>
                            Currency: ${cap.currency}
                        </div>
                    </div>
                `;
            }
        });

        html += '</div>';

        // Timezone Info
        html += `
            <div style="margin-top: 20px;">
                <h4>⏰ Timezone Information</h4>
                <div class="timezone-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                    <div><strong>Server:</strong> ${d.cronStatus.serverTime}</div>
                    <div><strong>UK Time:</strong> ${d.cronStatus.ukTime}</div>
                    <div><strong>India Time:</strong> ${d.cronStatus.indiaTime}</div>
                    <div><strong>US Time:</strong> ${d.cronStatus.usTime}</div>
                </div>
            </div>
        `;

        // Validation Results
        if (d.validationResults && d.validationResults.length > 0) {
            html += `
                <div style="margin-top: 20px;">
                    <h4>🔍 Validation Results for Today's Signals</h4>
                    <table class="signals-table">
                        <thead>
                            <tr>
                                <th>Symbol</th>
                                <th>Market</th>
                                <th>Win Rate</th>
                                <th>Status</th>
                                <th>Reason</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            d.validationResults.forEach(result => {
                const statusClass = result.valid ? 'valid' : 'invalid';
                const icon = result.valid ? '✅' : '❌';
                html += `
                    <tr>
                        <td><strong>${result.symbol}</strong></td>
                        <td>${result.market}</td>
                        <td>${result.win_rate?.toFixed(1)}%</td>
                        <td class="validation-result ${statusClass}">${icon} ${result.valid ? 'Valid' : 'Invalid'}</td>
                        <td>${result.reason}</td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }

        return html;
    },

    /**
     * Add log entry
     */
    addLog(type, message) {
        const timestamp = new Date().toLocaleTimeString();
        const logContent = document.getElementById('log-content');
        if (!logContent) return;

        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.textContent = `[${timestamp}] ${message}`;

        logContent.appendChild(logEntry);

        // Auto-scroll to bottom
        logContent.scrollTop = logContent.scrollHeight;

        // Keep only last 100 log entries
        while (logContent.children.length > 100) {
            logContent.removeChild(logContent.firstChild);
        }
    },

    /**
     * Clear logs
     */
    clearLogs() {
        const logContent = document.getElementById('log-content');
        if (logContent) {
            logContent.innerHTML = '<div class="log-entry log-info">Logs cleared. Ready to test.</div>';
        }
    }
};

// Make it globally available
window.AdminSignalTesting = AdminSignalTesting;
