/**
 * Admin Analytics V2 - Advanced Analytics Module
 *
 * Features:
 * - Cohort Analysis
 * - Funnel Visualization
 * - Retention Curves
 * - Custom Report Builder
 * - Data Export
 *
 * Dependencies: Chart.js, AdminComponentsV2, AdminChartsV2
 */

const AdminAnalyticsV2 = {
    // State management
    state: {
        cohortData: null,
        funnelData: null,
        retentionData: null,
        reports: [],
        activeReport: null
    },

    // Chart instances for cleanup
    charts: {
        cohort: null,
        funnel: null,
        retention: null
    },

    /**
     * Initialize analytics module
     */
    init(containerId = 'analytics-page') {
        console.log('Initializing Advanced Analytics V2...');
        this.containerId = containerId;
        this.loadAnalytics();
    },

    /**
     * Cleanup function
     */
    cleanup() {
        // Destroy all chart instances
        Object.keys(this.charts).forEach(key => {
            if (this.charts[key]) {
                this.charts[key].destroy();
                this.charts[key] = null;
            }
        });
    },

    /**
     * Load analytics page content
     */
    async loadAnalytics() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = `
            <!-- Analytics Tabs -->
            <div class="analytics-tabs">
                <button class="analytics-tab active" data-tab="cohort">
                    📊 Cohort Analysis
                </button>
                <button class="analytics-tab" data-tab="funnel">
                    🎯 Funnel Analysis
                </button>
                <button class="analytics-tab" data-tab="retention">
                    📈 Retention Curves
                </button>
                <button class="analytics-tab" data-tab="reports">
                    📋 Custom Reports
                </button>
            </div>

            <!-- Tab Content -->
            <div id="cohort-tab" class="analytics-tab-content active">
                ${AdminComponentsV2.skeleton({ type: 'card', rows: 5 })}
            </div>

            <div id="funnel-tab" class="analytics-tab-content">
                ${AdminComponentsV2.skeleton({ type: 'card', rows: 5 })}
            </div>

            <div id="retention-tab" class="analytics-tab-content">
                ${AdminComponentsV2.skeleton({ type: 'card', rows: 5 })}
            </div>

            <div id="reports-tab" class="analytics-tab-content">
                ${AdminComponentsV2.skeleton({ type: 'card', rows: 5 })}
            </div>
        `;

        // Setup tab switching
        this.setupTabs();

        // Load initial tab
        await this.loadCohortAnalysis();
    },

    /**
     * Setup tab switching
     */
    setupTabs() {
        const tabs = document.querySelectorAll('.analytics-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', async (e) => {
                const tabName = e.target.dataset.tab;

                // Update active tab
                tabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');

                // Update active content
                document.querySelectorAll('.analytics-tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`${tabName}-tab`).classList.add('active');

                // Load tab content
                switch(tabName) {
                    case 'cohort':
                        await this.loadCohortAnalysis();
                        break;
                    case 'funnel':
                        await this.loadFunnelAnalysis();
                        break;
                    case 'retention':
                        await this.loadRetentionAnalysis();
                        break;
                    case 'reports':
                        await this.loadCustomReports();
                        break;
                }
            });
        });
    },

    /**
     * Load Cohort Analysis
     */
    async loadCohortAnalysis() {
        const container = document.getElementById('cohort-tab');
        if (!container) return;

        try {
            // Fetch cohort data
            const response = await fetch('/api/admin/analytics/cohort');

            if (!response.ok) {
                throw new Error('Failed to fetch cohort data');
            }

            const data = await response.json();
            this.state.cohortData = data;

            // Render cohort analysis
            container.innerHTML = `
                <div class="admin-card">
                    <div class="admin-card-header">
                        <h2 class="admin-card-title">Cohort Analysis</h2>
                        <div>
                            <button class="btn btn-secondary btn-sm" onclick="AdminAnalyticsV2.exportCohortData()">
                                📥 Export CSV
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="AdminAnalyticsV2.refreshCohortData()">
                                🔄 Refresh
                            </button>
                        </div>
                    </div>
                    <div class="admin-card-body">
                        <!-- Date Range Selector -->
                        <div class="cohort-filters">
                            <label>
                                Cohort Period:
                                <select id="cohort-period" onchange="AdminAnalyticsV2.changeCohortPeriod(this.value)">
                                    <option value="week">Weekly</option>
                                    <option value="month" selected>Monthly</option>
                                    <option value="quarter">Quarterly</option>
                                </select>
                            </label>
                            <label>
                                Metric:
                                <select id="cohort-metric" onchange="AdminAnalyticsV2.changeCohortMetric(this.value)">
                                    <option value="retention">Retention Rate</option>
                                    <option value="revenue">Revenue</option>
                                    <option value="activity">Activity Rate</option>
                                </select>
                            </label>
                        </div>

                        <!-- Cohort Table -->
                        <div id="cohort-table-container" class="cohort-table-container">
                            ${this.renderCohortTable(data)}
                        </div>

                        <!-- Cohort Visualization -->
                        <div style="margin-top: 2rem;">
                            <h3>Retention Heatmap</h3>
                            <canvas id="cohort-chart" height="400"></canvas>
                        </div>
                    </div>
                </div>
            `;

            // Render cohort chart
            this.renderCohortChart(data);

        } catch (error) {
            console.error('Error loading cohort analysis:', error);
            container.innerHTML = `
                <div class="admin-card">
                    <div class="admin-card-body">
                        <div class="error-state">
                            <div class="error-state-icon">⚠️</div>
                            <div class="error-state-title">Failed to Load Cohort Analysis</div>
                            <div class="error-state-message">${error.message}</div>
                            <button class="btn btn-primary" onclick="AdminAnalyticsV2.loadCohortAnalysis()">
                                Try Again
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    },

    /**
     * Render cohort table
     */
    renderCohortTable(data) {
        if (!data || !data.cohorts || data.cohorts.length === 0) {
            return '<div class="empty-state">No cohort data available</div>';
        }

        const maxPeriods = Math.max(...data.cohorts.map(c => c.periods.length));

        let html = '<table class="cohort-table">';

        // Header
        html += '<thead><tr>';
        html += '<th>Cohort</th>';
        html += '<th>Size</th>';
        for (let i = 0; i < maxPeriods; i++) {
            html += `<th>Period ${i}</th>`;
        }
        html += '</tr></thead>';

        // Body
        html += '<tbody>';
        data.cohorts.forEach(cohort => {
            html += '<tr>';
            html += `<td><strong>${cohort.name}</strong></td>`;
            html += `<td>${cohort.size}</td>`;

            cohort.periods.forEach((value, index) => {
                const percentage = ((value / cohort.size) * 100).toFixed(1);
                const color = this.getCohortColor(percentage);
                html += `<td class="cohort-cell" style="background-color: ${color}">
                    <span class="cohort-value">${percentage}%</span>
                    <span class="cohort-count">(${value})</span>
                </td>`;
            });

            // Fill empty cells
            for (let i = cohort.periods.length; i < maxPeriods; i++) {
                html += '<td class="cohort-cell cohort-cell-empty">-</td>';
            }

            html += '</tr>';
        });
        html += '</tbody>';
        html += '</table>';

        return html;
    },

    /**
     * Get cohort cell color based on percentage
     */
    getCohortColor(percentage) {
        if (percentage >= 80) return 'rgba(34, 197, 94, 0.3)';
        if (percentage >= 60) return 'rgba(34, 197, 94, 0.2)';
        if (percentage >= 40) return 'rgba(251, 191, 36, 0.2)';
        if (percentage >= 20) return 'rgba(239, 68, 68, 0.2)';
        return 'rgba(239, 68, 68, 0.3)';
    },

    /**
     * Render cohort chart
     */
    renderCohortChart(data) {
        const canvas = document.getElementById('cohort-chart');
        if (!canvas) return;

        // Destroy existing chart
        if (this.charts.cohort) {
            this.charts.cohort.destroy();
        }

        const datasets = data.cohorts.map((cohort, index) => ({
            label: cohort.name,
            data: cohort.periods.map((value, periodIndex) => ({
                x: periodIndex,
                y: ((value / cohort.size) * 100).toFixed(1)
            })),
            borderColor: this.getChartColor(index),
            backgroundColor: this.getChartColor(index, 0.1),
            tension: 0.4
        }));

        this.charts.cohort = new Chart(canvas, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Cohort Retention Over Time'
                    },
                    legend: {
                        display: true,
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: ${context.parsed.y}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: 'Periods Since Cohort Start'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Retention Rate (%)'
                        },
                        min: 0,
                        max: 100
                    }
                }
            }
        });
    },

    /**
     * Load Funnel Analysis
     */
    async loadFunnelAnalysis() {
        const container = document.getElementById('funnel-tab');
        if (!container) return;

        try {
            // Fetch funnel data
            const response = await fetch('/api/admin/analytics/funnel');

            if (!response.ok) {
                throw new Error('Failed to fetch funnel data');
            }

            const data = await response.json();
            this.state.funnelData = data;

            // Render funnel analysis
            container.innerHTML = `
                <div class="admin-card">
                    <div class="admin-card-header">
                        <h2 class="admin-card-title">Conversion Funnel Analysis</h2>
                        <div>
                            <button class="btn btn-secondary btn-sm" onclick="AdminAnalyticsV2.exportFunnelData()">
                                📥 Export CSV
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="AdminAnalyticsV2.refreshFunnelData()">
                                🔄 Refresh
                            </button>
                        </div>
                    </div>
                    <div class="admin-card-body">
                        <!-- Funnel Selector -->
                        <div class="funnel-filters">
                            <label>
                                Funnel:
                                <select id="funnel-type" onchange="AdminAnalyticsV2.changeFunnelType(this.value)">
                                    <option value="signup">User Signup</option>
                                    <option value="subscription">Subscription Purchase</option>
                                    <option value="onboarding">User Onboarding</option>
                                </select>
                            </label>
                            ${AdminComponentsV2.dateRangePicker({
                                containerId: 'funnel-date-range',
                                onSelect: (start, end) => {
                                    AdminAnalyticsV2.updateFunnelDateRange(start, end);
                                }
                            })}
                        </div>

                        <!-- Funnel Visualization -->
                        <div class="funnel-container">
                            ${this.renderFunnelVisualization(data)}
                        </div>

                        <!-- Funnel Metrics -->
                        <div class="funnel-metrics">
                            ${this.renderFunnelMetrics(data)}
                        </div>

                        <!-- Funnel Chart -->
                        <div style="margin-top: 2rem;">
                            <canvas id="funnel-chart" height="300"></canvas>
                        </div>
                    </div>
                </div>
            `;

            // Render funnel chart
            this.renderFunnelChart(data);

        } catch (error) {
            console.error('Error loading funnel analysis:', error);
            container.innerHTML = `
                <div class="admin-card">
                    <div class="admin-card-body">
                        <div class="error-state">
                            <div class="error-state-icon">⚠️</div>
                            <div class="error-state-title">Failed to Load Funnel Analysis</div>
                            <div class="error-state-message">${error.message}</div>
                            <button class="btn btn-primary" onclick="AdminAnalyticsV2.loadFunnelAnalysis()">
                                Try Again
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    },

    /**
     * Render funnel visualization
     */
    renderFunnelVisualization(data) {
        if (!data || !data.steps || data.steps.length === 0) {
            return '<div class="empty-state">No funnel data available</div>';
        }

        let html = '<div class="funnel-steps">';

        data.steps.forEach((step, index) => {
            const percentage = index === 0 ? 100 : ((step.count / data.steps[0].count) * 100).toFixed(1);
            const dropoff = index === 0 ? 0 : data.steps[index - 1].count - step.count;
            const dropoffPercentage = index === 0 ? 0 : ((dropoff / data.steps[index - 1].count) * 100).toFixed(1);

            html += `
                <div class="funnel-step">
                    <div class="funnel-step-bar" style="width: ${percentage}%;">
                        <div class="funnel-step-content">
                            <div class="funnel-step-name">${step.name}</div>
                            <div class="funnel-step-count">${step.count.toLocaleString()} users</div>
                            <div class="funnel-step-percentage">${percentage}%</div>
                        </div>
                    </div>
                    ${index > 0 ? `
                        <div class="funnel-dropoff">
                            <span class="funnel-dropoff-icon">⬇</span>
                            <span class="funnel-dropoff-text">${dropoff.toLocaleString()} dropped (${dropoffPercentage}%)</span>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        html += '</div>';
        return html;
    },

    /**
     * Render funnel metrics
     */
    renderFunnelMetrics(data) {
        if (!data || !data.steps) return '';

        const totalUsers = data.steps[0].count;
        const convertedUsers = data.steps[data.steps.length - 1].count;
        const conversionRate = ((convertedUsers / totalUsers) * 100).toFixed(1);
        const avgTimeToConvert = data.avgTimeToConvert || 0;

        return `
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-icon">👥</div>
                    <div class="metric-content">
                        <div class="metric-title">Total Users</div>
                        <div class="metric-value">${totalUsers.toLocaleString()}</div>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon">✅</div>
                    <div class="metric-content">
                        <div class="metric-title">Converted</div>
                        <div class="metric-value">${convertedUsers.toLocaleString()}</div>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon">📊</div>
                    <div class="metric-content">
                        <div class="metric-title">Conversion Rate</div>
                        <div class="metric-value">${conversionRate}%</div>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon">⏱️</div>
                    <div class="metric-content">
                        <div class="metric-title">Avg. Time</div>
                        <div class="metric-value">${this.formatDuration(avgTimeToConvert)}</div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render funnel chart
     */
    renderFunnelChart(data) {
        const canvas = document.getElementById('funnel-chart');
        if (!canvas) return;

        // Destroy existing chart
        if (this.charts.funnel) {
            this.charts.funnel.destroy();
        }

        const labels = data.steps.map(step => step.name);
        const counts = data.steps.map(step => step.count);
        const percentages = counts.map((count, index) =>
            index === 0 ? 100 : ((count / counts[0]) * 100).toFixed(1)
        );

        this.charts.funnel = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Users',
                    data: counts,
                    backgroundColor: 'rgba(99, 102, 241, 0.5)',
                    borderColor: 'rgba(99, 102, 241, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Funnel Step Performance'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const count = context.parsed.y;
                                const percentage = percentages[context.dataIndex];
                                return `${count.toLocaleString()} users (${percentage}%)`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Users'
                        }
                    }
                }
            }
        });
    },

    /**
     * Load Retention Analysis
     */
    async loadRetentionAnalysis() {
        const container = document.getElementById('retention-tab');
        if (!container) return;

        try {
            // Fetch retention data
            const response = await fetch('/api/admin/analytics/retention');

            if (!response.ok) {
                throw new Error('Failed to fetch retention data');
            }

            const data = await response.json();
            this.state.retentionData = data;

            // Render retention analysis
            container.innerHTML = `
                <div class="admin-card">
                    <div class="admin-card-header">
                        <h2 class="admin-card-title">User Retention Analysis</h2>
                        <div>
                            <button class="btn btn-secondary btn-sm" onclick="AdminAnalyticsV2.exportRetentionData()">
                                📥 Export CSV
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="AdminAnalyticsV2.refreshRetentionData()">
                                🔄 Refresh
                            </button>
                        </div>
                    </div>
                    <div class="admin-card-body">
                        <!-- Retention Filters -->
                        <div class="retention-filters">
                            <label>
                                Time Period:
                                <select id="retention-period" onchange="AdminAnalyticsV2.changeRetentionPeriod(this.value)">
                                    <option value="daily">Daily</option>
                                    <option value="weekly" selected>Weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                            </label>
                            <label>
                                User Segment:
                                <select id="retention-segment" onchange="AdminAnalyticsV2.changeRetentionSegment(this.value)">
                                    <option value="all">All Users</option>
                                    <option value="premium">Premium Users</option>
                                    <option value="free">Free Users</option>
                                    <option value="new">New Users (< 30 days)</option>
                                </select>
                            </label>
                        </div>

                        <!-- Retention Metrics -->
                        <div class="retention-metrics">
                            ${this.renderRetentionMetrics(data)}
                        </div>

                        <!-- Retention Chart -->
                        <div style="margin-top: 2rem;">
                            <canvas id="retention-chart" height="400"></canvas>
                        </div>

                        <!-- N-Day Retention Table -->
                        <div style="margin-top: 2rem;">
                            <h3>N-Day Retention</h3>
                            ${this.renderRetentionTable(data)}
                        </div>
                    </div>
                </div>
            `;

            // Render retention chart
            this.renderRetentionChart(data);

        } catch (error) {
            console.error('Error loading retention analysis:', error);
            container.innerHTML = `
                <div class="admin-card">
                    <div class="admin-card-body">
                        <div class="error-state">
                            <div class="error-state-icon">⚠️</div>
                            <div class="error-state-title">Failed to Load Retention Analysis</div>
                            <div class="error-state-message">${error.message}</div>
                            <button class="btn btn-primary" onclick="AdminAnalyticsV2.loadRetentionAnalysis()">
                                Try Again
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    },

    /**
     * Render retention metrics
     */
    renderRetentionMetrics(data) {
        const day1 = data.retention?.day1 || 0;
        const day7 = data.retention?.day7 || 0;
        const day30 = data.retention?.day30 || 0;
        const day90 = data.retention?.day90 || 0;

        return `
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-icon">1️⃣</div>
                    <div class="metric-content">
                        <div class="metric-title">Day 1 Retention</div>
                        <div class="metric-value">${day1.toFixed(1)}%</div>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon">7️⃣</div>
                    <div class="metric-content">
                        <div class="metric-title">Day 7 Retention</div>
                        <div class="metric-value">${day7.toFixed(1)}%</div>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon">3️⃣0️⃣</div>
                    <div class="metric-content">
                        <div class="metric-title">Day 30 Retention</div>
                        <div class="metric-value">${day30.toFixed(1)}%</div>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon">9️⃣0️⃣</div>
                    <div class="metric-content">
                        <div class="metric-title">Day 90 Retention</div>
                        <div class="metric-value">${day90.toFixed(1)}%</div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render retention table
     */
    renderRetentionTable(data) {
        if (!data || !data.curve || data.curve.length === 0) {
            return '<div class="empty-state">No retention data available</div>';
        }

        let html = '<table class="retention-table">';
        html += '<thead><tr><th>Day</th><th>Retention Rate</th><th>Users Retained</th></tr></thead>';
        html += '<tbody>';

        data.curve.forEach(point => {
            html += `
                <tr>
                    <td>Day ${point.day}</td>
                    <td>
                        <div class="retention-bar-container">
                            <div class="retention-bar" style="width: ${point.rate}%"></div>
                            <span class="retention-bar-label">${point.rate.toFixed(1)}%</span>
                        </div>
                    </td>
                    <td>${point.count.toLocaleString()}</td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        return html;
    },

    /**
     * Render retention chart
     */
    renderRetentionChart(data) {
        const canvas = document.getElementById('retention-chart');
        if (!canvas) return;

        // Destroy existing chart
        if (this.charts.retention) {
            this.charts.retention.destroy();
        }

        const labels = data.curve.map(point => `Day ${point.day}`);
        const rates = data.curve.map(point => point.rate);

        this.charts.retention = new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Retention Rate',
                    data: rates,
                    borderColor: 'rgba(34, 197, 94, 1)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Retention Curve Over Time'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `Retention: ${context.parsed.y.toFixed(1)}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Retention Rate (%)'
                        }
                    }
                }
            }
        });
    },

    /**
     * Load Custom Reports
     */
    async loadCustomReports() {
        const container = document.getElementById('reports-tab');
        if (!container) return;

        try {
            // Fetch saved reports
            const response = await fetch('/api/admin/analytics/reports');

            if (!response.ok) {
                throw new Error('Failed to fetch reports');
            }

            const data = await response.json();
            this.state.reports = data.reports || [];

            // Render custom reports
            container.innerHTML = `
                <div class="admin-card">
                    <div class="admin-card-header">
                        <h2 class="admin-card-title">Custom Reports</h2>
                        <button class="btn btn-primary btn-sm" onclick="AdminAnalyticsV2.showReportBuilder()">
                            ➕ Create New Report
                        </button>
                    </div>
                    <div class="admin-card-body">
                        ${this.renderReportsList()}
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('Error loading custom reports:', error);
            container.innerHTML = `
                <div class="admin-card">
                    <div class="admin-card-body">
                        <div class="error-state">
                            <div class="error-state-icon">⚠️</div>
                            <div class="error-state-title">Failed to Load Custom Reports</div>
                            <div class="error-state-message">${error.message}</div>
                            <button class="btn btn-primary" onclick="AdminAnalyticsV2.loadCustomReports()">
                                Try Again
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    },

    /**
     * Render reports list
     */
    renderReportsList() {
        if (!this.state.reports || this.state.reports.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <div class="empty-state-title">No Custom Reports</div>
                    <div class="empty-state-message">Create your first custom report to get started</div>
                    <button class="btn btn-primary" onclick="AdminAnalyticsV2.showReportBuilder()">
                        Create Report
                    </button>
                </div>
            `;
        }

        let html = '<div class="reports-grid">';

        this.state.reports.forEach(report => {
            html += `
                <div class="report-card">
                    <div class="report-card-header">
                        <h3>${report.name}</h3>
                        <div class="report-card-actions">
                            <button class="btn-icon" onclick="AdminAnalyticsV2.runReport('${report.id}')" title="Run Report">
                                ▶️
                            </button>
                            <button class="btn-icon" onclick="AdminAnalyticsV2.editReport('${report.id}')" title="Edit">
                                ✏️
                            </button>
                            <button class="btn-icon" onclick="AdminAnalyticsV2.deleteReport('${report.id}')" title="Delete">
                                🗑️
                            </button>
                        </div>
                    </div>
                    <div class="report-card-body">
                        <div class="report-description">${report.description || 'No description'}</div>
                        <div class="report-meta">
                            <span>📊 ${report.type}</span>
                            <span>📅 Last run: ${DateFormatter.format(report.lastRun, 'Never')}</span>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    },

    /**
     * Show report builder
     */
    showReportBuilder(reportId = null) {
        const report = reportId ? this.state.reports.find(r => r.id === reportId) : null;
        const isEdit = !!report;

        const modal = AdminComponentsV2.modal({
            title: isEdit ? 'Edit Report' : 'Create New Report',
            content: `
                <form id="report-builder-form" class="report-builder-form">
                    <div class="form-group">
                        <label for="report-name">Report Name *</label>
                        <input type="text" id="report-name" value="${report?.name || ''}" required>
                    </div>

                    <div class="form-group">
                        <label for="report-description">Description</label>
                        <textarea id="report-description" rows="3">${report?.description || ''}</textarea>
                    </div>

                    <div class="form-group">
                        <label for="report-type">Report Type *</label>
                        <select id="report-type" required>
                            <option value="user-activity" ${report?.type === 'user-activity' ? 'selected' : ''}>User Activity</option>
                            <option value="revenue" ${report?.type === 'revenue' ? 'selected' : ''}>Revenue Analysis</option>
                            <option value="subscription" ${report?.type === 'subscription' ? 'selected' : ''}>Subscription Metrics</option>
                            <option value="custom-query" ${report?.type === 'custom-query' ? 'selected' : ''}>Custom Query</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="report-metrics">Metrics (comma-separated)</label>
                        <input type="text" id="report-metrics" value="${report?.metrics?.join(', ') || ''}"
                               placeholder="e.g., total_users, revenue, churn_rate">
                    </div>

                    <div class="form-group">
                        <label for="report-filters">Filters (JSON format)</label>
                        <textarea id="report-filters" rows="5" placeholder='{"status": "active", "plan": "premium"}'>${report?.filters ? JSON.stringify(report.filters, null, 2) : ''}</textarea>
                    </div>

                    <div class="form-group">
                        <label for="report-schedule">Schedule</label>
                        <select id="report-schedule">
                            <option value="manual" ${!report?.schedule || report.schedule === 'manual' ? 'selected' : ''}>Manual Only</option>
                            <option value="daily" ${report?.schedule === 'daily' ? 'selected' : ''}>Daily</option>
                            <option value="weekly" ${report?.schedule === 'weekly' ? 'selected' : ''}>Weekly</option>
                            <option value="monthly" ${report?.schedule === 'monthly' ? 'selected' : ''}>Monthly</option>
                        </select>
                    </div>
                </form>
            `,
            actions: [
                {
                    text: 'Cancel',
                    variant: 'secondary',
                    onClick: () => modal.close()
                },
                {
                    text: isEdit ? 'Update Report' : 'Create Report',
                    variant: 'primary',
                    onClick: () => this.saveReport(reportId, modal)
                }
            ]
        });

        modal.show();
    },

    /**
     * Save report
     */
    async saveReport(reportId, modal) {
        const form = document.getElementById('report-builder-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const reportData = {
            name: document.getElementById('report-name').value,
            description: document.getElementById('report-description').value,
            type: document.getElementById('report-type').value,
            metrics: document.getElementById('report-metrics').value.split(',').map(m => m.trim()).filter(m => m),
            filters: document.getElementById('report-filters').value ? JSON.parse(document.getElementById('report-filters').value) : {},
            schedule: document.getElementById('report-schedule').value
        };

        try {
            const url = reportId ? `/api/admin/analytics/reports/${reportId}` : '/api/admin/analytics/reports';
            const method = reportId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reportData)
            });

            if (!response.ok) {
                throw new Error('Failed to save report');
            }

            AdminComponentsV2.toast({
                type: 'success',
                message: `Report ${reportId ? 'updated' : 'created'} successfully!`
            });

            modal.close();
            this.loadCustomReports();

        } catch (error) {
            AdminComponentsV2.toast({
                type: 'error',
                message: `Failed to save report: ${error.message}`
            });
        }
    },

    /**
     * Run report
     */
    async runReport(reportId) {
        AdminComponentsV2.toast({
            type: 'info',
            message: 'Running report...'
        });

        try {
            const response = await fetch(`/api/admin/analytics/reports/${reportId}/run`, {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error('Failed to run report');
            }

            const data = await response.json();

            // Show report results in a modal
            const modal = AdminComponentsV2.modal({
                title: data.name,
                content: this.renderReportResults(data),
                size: 'large'
            });

            modal.show();

        } catch (error) {
            AdminComponentsV2.toast({
                type: 'error',
                message: `Failed to run report: ${error.message}`
            });
        }
    },

    /**
     * Render report results
     */
    renderReportResults(data) {
        // This would be customized based on report type
        return `
            <div class="report-results">
                <pre>${JSON.stringify(data.results, null, 2)}</pre>
            </div>
        `;
    },

    /**
     * Delete report
     */
    async deleteReport(reportId) {
        const confirmed = await AdminComponentsV2.confirm({
            title: 'Delete Report',
            message: 'Are you sure you want to delete this report?',
            danger: true
        });

        if (!confirmed) return;

        try {
            const response = await fetch(`/api/admin/analytics/reports/${reportId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete report');
            }

            AdminComponentsV2.toast({
                type: 'success',
                message: 'Report deleted successfully'
            });

            this.loadCustomReports();

        } catch (error) {
            AdminComponentsV2.toast({
                type: 'error',
                message: `Failed to delete report: ${error.message}`
            });
        }
    },

    // Utility functions

    /**
     * Get chart color with optional alpha
     */
    getChartColor(index, alpha = 1) {
        const colors = [
            `rgba(99, 102, 241, ${alpha})`,   // Indigo
            `rgba(34, 197, 94, ${alpha})`,    // Green
            `rgba(251, 191, 36, ${alpha})`,   // Yellow
            `rgba(239, 68, 68, ${alpha})`,    // Red
            `rgba(168, 85, 247, ${alpha})`,   // Purple
            `rgba(236, 72, 153, ${alpha})`,   // Pink
            `rgba(14, 165, 233, ${alpha})`,   // Sky
            `rgba(249, 115, 22, ${alpha})`    // Orange
        ];
        return colors[index % colors.length];
    },

    /**
     * Format duration
     */
    formatDuration(seconds) {
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
        return `${Math.floor(seconds / 86400)}d`;
    },

    // Data export functions
    exportCohortData() {
        if (!this.state.cohortData) return;
        // TODO: Implement CSV export
        AdminComponentsV2.toast({ type: 'info', message: 'Exporting cohort data...' });
    },

    exportFunnelData() {
        if (!this.state.funnelData) return;
        // TODO: Implement CSV export
        AdminComponentsV2.toast({ type: 'info', message: 'Exporting funnel data...' });
    },

    exportRetentionData() {
        if (!this.state.retentionData) return;
        // TODO: Implement CSV export
        AdminComponentsV2.toast({ type: 'info', message: 'Exporting retention data...' });
    },

    // Refresh functions
    refreshCohortData() {
        this.loadCohortAnalysis();
    },

    refreshFunnelData() {
        this.loadFunnelAnalysis();
    },

    refreshRetentionData() {
        this.loadRetentionAnalysis();
    },

    // Filter change handlers
    changeCohortPeriod(period) {
        console.log('Changing cohort period to:', period);
        // TODO: Implement period change
    },

    changeCohortMetric(metric) {
        console.log('Changing cohort metric to:', metric);
        // TODO: Implement metric change
    },

    changeFunnelType(type) {
        console.log('Changing funnel type to:', type);
        // TODO: Implement funnel type change
    },

    updateFunnelDateRange(start, end) {
        console.log('Updating funnel date range:', start, end);
        // TODO: Implement date range update
    },

    changeRetentionPeriod(period) {
        console.log('Changing retention period to:', period);
        // TODO: Implement period change
    },

    changeRetentionSegment(segment) {
        console.log('Changing retention segment to:', segment);
        // TODO: Implement segment change
    },

    editReport(reportId) {
        this.showReportBuilder(reportId);
    }
};

// Make available globally
window.AdminAnalyticsV2 = AdminAnalyticsV2;
