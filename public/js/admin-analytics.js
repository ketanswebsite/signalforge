/**
 * Admin Analytics Module
 * Handles business intelligence, revenue analytics, engagement metrics, and custom reports
 */

const AdminAnalytics = {
    currentTab: 'revenue',
    revenueChart: null,
    engagementChart: null,
    subscriptionChart: null,

    /**
     * Initialize the analytics module
     */
    async init() {
        this.render();
        await this.loadTab(this.currentTab);
    },

    /**
     * Render the main analytics interface
     */
    render() {
        const container = document.getElementById('analytics-page');

        container.innerHTML = `
            <div class="admin-card mb-2">
                <div class="admin-card-header">
                    <h2 class="admin-card-title">Analytics & Reports</h2>
                    <button class="btn btn-primary btn-sm" onclick="AdminAnalytics.openReportGenerator()">
                        📄 Generate Report
                    </button>
                </div>

                <div class="admin-card-body">
                    <!-- Tab Navigation -->
                    <div class="tab-navigation mb-2">
                        <button
                            class="tab-btn ${this.currentTab === 'revenue' ? 'active' : ''}"
                            onclick="AdminAnalytics.switchTab('revenue')"
                        >
                            💰 Revenue
                        </button>
                        <button
                            class="tab-btn ${this.currentTab === 'engagement' ? 'active' : ''}"
                            onclick="AdminAnalytics.switchTab('engagement')"
                        >
                            📈 User Engagement
                        </button>
                        <button
                            class="tab-btn ${this.currentTab === 'subscription' ? 'active' : ''}"
                            onclick="AdminAnalytics.switchTab('subscription')"
                        >
                            💳 Subscription Health
                        </button>
                        <button
                            class="tab-btn ${this.currentTab === 'trading' ? 'active' : ''}"
                            onclick="AdminAnalytics.switchTab('trading')"
                        >
                            📊 Trading Activity
                        </button>
                    </div>

                    <!-- Tab Content -->
                    <div id="analytics-tab-content">
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
        const content = document.getElementById('analytics-tab-content');
        content.innerHTML = '<div class="spinner-container spinner-medium"><div class="spinner"></div></div>';

        try {
            switch (tabName) {
                case 'revenue':
                    await this.loadRevenueAnalytics();
                    break;
                case 'engagement':
                    await this.loadEngagementAnalytics();
                    break;
                case 'subscription':
                    await this.loadSubscriptionAnalytics();
                    break;
                case 'trading':
                    await this.loadTradingAnalytics();
                    break;
            }
        } catch (error) {
            content.innerHTML = '<p class="text-center text-danger">Failed to load analytics data.</p>';
        }
    },

    /**
     * Load revenue analytics
     */
    async loadRevenueAnalytics() {
        const response = await fetch('/api/admin/analytics/revenue');
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error?.message || 'Failed to load revenue analytics');
        }

        this.renderRevenueAnalytics(data.data);
    },

    /**
     * Render revenue analytics
     */
    renderRevenueAnalytics(analytics) {
        const content = document.getElementById('analytics-tab-content');

        const formatCurrency = (amount, currency = 'GBP') => {
            const symbols = { GBP: '£', USD: '$', INR: '₹' };
            return `${symbols[currency] || '$'}${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        };

        content.innerHTML = `
            <!-- Key Metrics -->
            <div class="metrics-grid mb-2">
                <div class="metric-card">
                    <div class="metric-icon">💰</div>
                    <div class="metric-content">
                        <div class="metric-title">Monthly Recurring Revenue</div>
                        <div class="metric-value">${formatCurrency(analytics.mrr)}</div>
                        <div class="metric-change metric-change-positive">
                            ${analytics.mrrGrowth > 0 ? '↑' : '↓'} ${Math.abs(analytics.mrrGrowth).toFixed(1)}% MoM
                        </div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon">📈</div>
                    <div class="metric-content">
                        <div class="metric-title">Annual Recurring Revenue</div>
                        <div class="metric-value">${formatCurrency(analytics.arr)}</div>
                        <div class="metric-change metric-change-neutral">
                            Projected from MRR
                        </div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon">📊</div>
                    <div class="metric-content">
                        <div class="metric-title">ARPU (Avg Revenue Per User)</div>
                        <div class="metric-value">${formatCurrency(analytics.arpu)}</div>
                        <div class="metric-change metric-change-neutral">
                            Per active user
                        </div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon">💳</div>
                    <div class="metric-content">
                        <div class="metric-title">Lifetime Value (LTV)</div>
                        <div class="metric-value">${formatCurrency(analytics.ltv)}</div>
                        <div class="metric-change metric-change-positive">
                            12-month average
                        </div>
                    </div>
                </div>
            </div>

            <!-- Revenue Trend Chart -->
            <div class="admin-card mb-2">
                <div class="admin-card-header">
                    <h3>Revenue Trend (Last 12 Months)</h3>
                </div>
                <div class="admin-card-body">
                    <canvas id="revenue-trend-chart" height="80"></canvas>
                </div>
            </div>

            <!-- Revenue Breakdown -->
            <div class="revenue-breakdown-grid">
                <!-- By Region -->
                <div class="admin-card">
                    <div class="admin-card-header">
                        <h3>Revenue by Region</h3>
                    </div>
                    <div class="admin-card-body">
                        ${Object.entries(analytics.byRegion || {}).map(([region, amount]) => `
                            <div>
                                <span>${region === 'UK' ? '🇬🇧 UK' : region === 'US' ? '🇺🇸 US' : region === 'India' ? '🇮🇳 India' : '🌍 ' + region}</span>
                                <strong>${formatCurrency(amount)}</strong>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- By Plan -->
                <div class="admin-card">
                    <div class="admin-card-header">
                        <h3>Revenue by Plan Type</h3>
                    </div>
                    <div class="admin-card-body">
                        ${Object.entries(analytics.byPlan || {}).map(([plan, amount]) => `
                            <div>
                                <span>${plan}</span>
                                <strong>${formatCurrency(amount)}</strong>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        // Initialize revenue trend chart
        this.initRevenueTrendChart(analytics.trend || []);
    },

    /**
     * Initialize revenue trend chart
     */
    initRevenueTrendChart(trendData) {
        const canvas = document.getElementById('revenue-trend-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Destroy existing chart
        if (this.revenueChart) {
            this.revenueChart.destroy();
        }

        const labels = trendData.map(d => d.month);
        const data = trendData.map(d => parseFloat(d.revenue));

        this.revenueChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Revenue',
                    data,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `£${context.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => `£${value.toLocaleString()}`
                        }
                    }
                }
            }
        });
    },

    /**
     * Load engagement analytics
     */
    async loadEngagementAnalytics() {
        const response = await fetch('/api/admin/analytics/engagement');
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error?.message || 'Failed to load engagement analytics');
        }

        this.renderEngagementAnalytics(data.data);
    },

    /**
     * Render engagement analytics
     */
    renderEngagementAnalytics(analytics) {
        const content = document.getElementById('analytics-tab-content');

        content.innerHTML = `
            <!-- Key Metrics -->
            <div class="metrics-grid mb-2">
                <div class="metric-card">
                    <div class="metric-icon">📅</div>
                    <div class="metric-content">
                        <div class="metric-title">Daily Active Users</div>
                        <div class="metric-value">${analytics.dau || 0}</div>
                        <div class="metric-change metric-change-neutral">
                            Last 24 hours
                        </div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon">📆</div>
                    <div class="metric-content">
                        <div class="metric-title">Weekly Active Users</div>
                        <div class="metric-value">${analytics.wau || 0}</div>
                        <div class="metric-change metric-change-positive">
                            ${analytics.wauGrowth > 0 ? '↑' : '↓'} ${Math.abs(analytics.wauGrowth || 0).toFixed(1)}% vs last week
                        </div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon">📊</div>
                    <div class="metric-content">
                        <div class="metric-title">Monthly Active Users</div>
                        <div class="metric-value">${analytics.mau || 0}</div>
                        <div class="metric-change metric-change-positive">
                            ${analytics.mauGrowth > 0 ? '↑' : '↓'} ${Math.abs(analytics.mauGrowth || 0).toFixed(1)}% vs last month
                        </div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon">💤</div>
                    <div class="metric-content">
                        <div class="metric-title">Inactive Users</div>
                        <div class="metric-value">${analytics.inactive || 0}</div>
                        <div class="metric-change metric-change-neutral">
                            30+ days
                        </div>
                    </div>
                </div>
            </div>

            <!-- User Activity Chart -->
            <div class="admin-card mb-2">
                <div class="admin-card-header">
                    <h3>User Activity (Last 30 Days)</h3>
                </div>
                <div class="admin-card-body">
                    <canvas id="engagement-chart" height="80"></canvas>
                </div>
            </div>

            <!-- Feature Usage -->
            <div class="admin-card">
                <div class="admin-card-header">
                    <h3>Feature Usage</h3>
                </div>
                <div class="admin-card-body">
                    <div class="feature-usage-grid">
                        ${Object.entries(analytics.featureUsage || {}).map(([feature, percentage]) => `
                            <div class="feature-usage-item">
                                <div class="feature-usage-header">
                                    <span>${feature}</span>
                                    <strong>${percentage}%</strong>
                                </div>
                                <div class="progress-bar-container">
                                    <div class="progress-bar-fill" style="width: ${percentage}%;"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        // Initialize engagement chart
        this.initEngagementChart(analytics.activityTrend || []);
    },

    /**
     * Initialize engagement chart
     */
    initEngagementChart(activityData) {
        const canvas = document.getElementById('engagement-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Destroy existing chart
        if (this.engagementChart) {
            this.engagementChart.destroy();
        }

        const labels = activityData.map(d => d.date);
        const data = activityData.map(d => d.activeUsers);

        this.engagementChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Active Users',
                    data,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    },

    /**
     * Load subscription analytics
     */
    async loadSubscriptionAnalytics() {
        const response = await fetch('/api/admin/analytics/subscriptions');
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error?.message || 'Failed to load subscription analytics');
        }

        this.renderSubscriptionAnalytics(data.data);
    },

    /**
     * Render subscription analytics
     */
    renderSubscriptionAnalytics(analytics) {
        const content = document.getElementById('analytics-tab-content');

        content.innerHTML = `
            <!-- Key Metrics -->
            <div class="metrics-grid mb-2">
                <div class="metric-card">
                    <div class="metric-icon">📈</div>
                    <div class="metric-content">
                        <div class="metric-title">Trial Conversion Rate</div>
                        <div class="metric-value">${analytics.trialConversion || 0}%</div>
                        <div class="metric-change ${analytics.trialConversion >= 60 ? 'metric-change-positive' : 'metric-change-negative'}">
                            ${analytics.trialConversion >= 60 ? 'Above' : 'Below'} target (60%)
                        </div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon">🔄</div>
                    <div class="metric-content">
                        <div class="metric-title">Churn Rate</div>
                        <div class="metric-value">${analytics.churnRate || 0}%</div>
                        <div class="metric-change ${analytics.churnRate <= 5 ? 'metric-change-positive' : 'metric-change-negative'}">
                            Industry avg: 5-7%
                        </div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon">⬆️</div>
                    <div class="metric-content">
                        <div class="metric-title">Upgrades This Month</div>
                        <div class="metric-value">${analytics.upgrades || 0}</div>
                        <div class="metric-change metric-change-neutral">
                            Plan upgrades
                        </div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon">⬇️</div>
                    <div class="metric-content">
                        <div class="metric-title">Downgrades This Month</div>
                        <div class="metric-value">${analytics.downgrades || 0}</div>
                        <div class="metric-change metric-change-neutral">
                            Plan downgrades
                        </div>
                    </div>
                </div>
            </div>

            <!-- Subscription Funnel -->
            <div class="admin-card mb-2">
                <div class="admin-card-header">
                    <h3>Subscription Funnel</h3>
                </div>
                <div class="admin-card-body">
                    ${this.renderFunnel(analytics.funnel || {})}
                </div>
            </div>

            <!-- Subscription Age Distribution -->
            <div class="admin-card">
                <div class="admin-card-header">
                    <h3>Subscription Age Distribution</h3>
                </div>
                <div class="admin-card-body">
                    <canvas id="subscription-chart" height="60"></canvas>
                </div>
            </div>
        `;

        // Initialize subscription chart
        this.initSubscriptionChart(analytics.ageDistribution || {});
    },

    /**
     * Render subscription funnel
     */
    renderFunnel(funnel) {
        const stages = [
            { key: 'signups', label: 'Sign Ups', icon: '👥' },
            { key: 'trialStarted', label: 'Trial Started', icon: '🎯' },
            { key: 'profileCompleted', label: 'Profile Completed', icon: '✅' },
            { key: 'converted', label: 'Converted to Paid', icon: '💳' }
        ];

        const total = funnel.signups || 1;

        return `
            <div>
                ${stages.map(stage => {
                    const count = funnel[stage.key] || 0;
                    const percentage = ((count / total) * 100).toFixed(1);
                    return `
                        <div>
                            <div>
                                <span>${stage.icon} ${stage.label}</span>
                                <strong>${count} users (${percentage}%)</strong>
                            </div>
                            <div>
                                <div style="width: ${percentage}%;"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    /**
     * Initialize subscription chart
     */
    initSubscriptionChart(ageDistribution) {
        const canvas = document.getElementById('subscription-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Destroy existing chart
        if (this.subscriptionChart) {
            this.subscriptionChart.destroy();
        }

        const labels = Object.keys(ageDistribution);
        const data = Object.values(ageDistribution);

        this.subscriptionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Subscriptions',
                    data,
                    backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    },

    /**
     * Load trading analytics
     */
    async loadTradingAnalytics() {
        const response = await fetch('/api/admin/analytics/trades');
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error?.message || 'Failed to load trading analytics');
        }

        this.renderTradingAnalytics(data.data);
    },

    /**
     * Render trading analytics
     */
    renderTradingAnalytics(analytics) {
        const content = document.getElementById('analytics-tab-content');

        content.innerHTML = `
            <!-- Key Metrics -->
            <div class="metrics-grid mb-2">
                <div class="metric-card">
                    <div class="metric-icon">📊</div>
                    <div class="metric-content">
                        <div class="metric-title">Total Trades</div>
                        <div class="metric-value">${analytics.totalTrades || 0}</div>
                        <div class="metric-change metric-change-neutral">
                            All time
                        </div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon">✅</div>
                    <div class="metric-content">
                        <div class="metric-title">Win Rate</div>
                        <div class="metric-value">${analytics.winRate || 0}%</div>
                        <div class="metric-change ${analytics.winRate >= 50 ? 'metric-change-positive' : 'metric-change-negative'}">
                            ${analytics.winningTrades || 0} winning trades
                        </div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon">💰</div>
                    <div class="metric-content">
                        <div class="metric-title">Avg P/L per Trade</div>
                        <div class="metric-value">${analytics.avgPL || 0}%</div>
                        <div class="metric-change metric-change-positive">
                            Platform average
                        </div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon">👥</div>
                    <div class="metric-content">
                        <div class="metric-title">Avg Trades per User</div>
                        <div class="metric-value">${analytics.avgTradesPerUser || 0}</div>
                        <div class="metric-change metric-change-neutral">
                            Active users
                        </div>
                    </div>
                </div>
            </div>

            <!-- Most Traded Symbols -->
            <div class="admin-card">
                <div class="admin-card-header">
                    <h3>Most Traded Symbols</h3>
                </div>
                <div class="admin-card-body">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Symbol</th>
                                <th>Trades</th>
                                <th>Win Rate</th>
                                <th>Avg P/L</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(analytics.topSymbols || []).map((symbol, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td><strong>${symbol.symbol}</strong></td>
                                    <td>${symbol.count}</td>
                                    <td>${symbol.winRate}%</td>
                                    <td class="${symbol.avgPL >= 0 ? 'text-success' : 'text-danger'}">
                                        ${symbol.avgPL >= 0 ? '+' : ''}${symbol.avgPL}%
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    /**
     * Open report generator modal
     */
    openReportGenerator() {
        const modalHTML = `
            <div class="modal-backdrop" onclick="AdminComponents.closeModal()"></div>
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Generate Custom Report</h3>
                        <button class="btn-close" onclick="AdminComponents.closeModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <form id="report-form">
                            <div class="form-group">
                                <label>Report Type:</label>
                                <select id="report-type" class="form-control">
                                    <option value="monthly">Monthly Business Review</option>
                                    <option value="revenue">Revenue Report</option>
                                    <option value="users">User Activity Report</option>
                                    <option value="subscriptions">Subscription Health Report</option>
                                    <option value="custom">Custom Report</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label>Date Range:</label>
                                <select id="report-period" class="form-control">
                                    <option value="last-7-days">Last 7 Days</option>
                                    <option value="last-30-days">Last 30 Days</option>
                                    <option value="last-month">Last Month</option>
                                    <option value="last-quarter">Last Quarter</option>
                                    <option value="last-year">Last Year</option>
                                    <option value="custom">Custom Range</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label>Include Sections:</label>
                                <div>
                                    <label><input type="checkbox" id="include-summary" checked> Executive Summary</label><br>
                                    <label><input type="checkbox" id="include-revenue" checked> Revenue Metrics</label><br>
                                    <label><input type="checkbox" id="include-users" checked> User Growth & Engagement</label><br>
                                    <label><input type="checkbox" id="include-subscriptions" checked> Subscription Health</label><br>
                                    <label><input type="checkbox" id="include-payments"> Payment Analytics</label><br>
                                    <label><input type="checkbox" id="include-trades"> Trading Activity</label><br>
                                    <label><input type="checkbox" id="include-audit"> Audit Trail Summary</label>
                                </div>
                            </div>

                            <div class="form-group">
                                <label>Export Format:</label>
                                <select id="report-format" class="form-control">
                                    <option value="pdf">PDF (formatted report)</option>
                                    <option value="excel">Excel (data + charts)</option>
                                    <option value="csv">CSV (raw data)</option>
                                    <option value="json">JSON (API format)</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label>Email To (optional):</label>
                                <input type="email" id="report-email" class="form-control" placeholder="admin@signalforge.com" />
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="AdminComponents.closeModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="AdminAnalytics.generateReport()">Generate Report</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('modal-container').innerHTML = modalHTML;
    },

    /**
     * Generate custom report
     */
    async generateReport() {
        const reportType = document.getElementById('report-type').value;
        const period = document.getElementById('report-period').value;
        const format = document.getElementById('report-format').value;
        const email = document.getElementById('report-email').value;

        const sections = {
            summary: document.getElementById('include-summary').checked,
            revenue: document.getElementById('include-revenue').checked,
            users: document.getElementById('include-users').checked,
            subscriptions: document.getElementById('include-subscriptions').checked,
            payments: document.getElementById('include-payments').checked,
            trades: document.getElementById('include-trades').checked,
            audit: document.getElementById('include-audit').checked
        };

        try {
            AdminComponents.closeModal();

            AdminComponents.alert({
                type: 'info',
                message: 'Generating report...',
                autoDismiss: false
            });

            const response = await fetch('/api/admin/analytics/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: reportType,
                    period,
                    format,
                    email,
                    sections
                })
            });

            const data = await response.json();

            if (data.success) {
                if (email) {
                    AdminComponents.alert({
                        type: 'success',
                        message: `Report generated and sent to ${email}`,
                        autoDismiss: 5000
                    });
                } else {
                    // Download report
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `report-${reportType}-${Date.now()}.${format}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);

                    AdminComponents.alert({
                        type: 'success',
                        message: 'Report downloaded successfully',
                        autoDismiss: 3000
                    });
                }
            } else {
                throw new Error(data.error?.message || 'Failed to generate report');
            }
        } catch (error) {
            AdminComponents.alert({
                type: 'error',
                message: `Failed to generate report: ${error.message}`,
                autoDismiss: 5000
            });
        }
    }
};
