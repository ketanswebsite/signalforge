/**
 * Admin Analytics Module
 * Revenue, sign-in, subscription and trading figures, all read from the database. Until 2026-09-24
 * several were made up (MRR growth, week and month growth, feature usage, upgrades and downgrades, a
 * "profile completed" stage) and a Generate Report button started a report nothing ever made.
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
                    <h2 class="admin-card-title">Analytics</h2>
                </div>

                <div class="admin-card-body">
                    <!-- Tab Navigation -->
                    <div class="tab-navigation mb-2">
                        <button
                            class="tab-btn ${this.currentTab === 'revenue' ? 'active' : ''}"
                            onclick="AdminAnalytics.switchTab('revenue')"
                        >
                             Revenue
                        </button>
                        <button
                            class="tab-btn ${this.currentTab === 'engagement' ? 'active' : ''}"
                            onclick="AdminAnalytics.switchTab('engagement')"
                        >
                             User Engagement
                        </button>
                        <button
                            class="tab-btn ${this.currentTab === 'subscription' ? 'active' : ''}"
                            onclick="AdminAnalytics.switchTab('subscription')"
                        >
                             Subscription Health
                        </button>
                        <button
                            class="tab-btn ${this.currentTab === 'trading' ? 'active' : ''}"
                            onclick="AdminAnalytics.switchTab('trading')"
                        >
                             Trading Activity
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
     * Render revenue analytics: MRR per currency (Stripe subscriptions included), what each plan brings
     * in, and completed payments per month
     */
    renderRevenueAnalytics(analytics) {
        const content = document.getElementById('analytics-tab-content');
        const mrr = analytics.mrr || [];
        const paying = mrr.reduce((sum, entry) => sum + entry.subscriptions, 0);

        const metrics = document.createElement('div');
        metrics.className = 'metrics-grid mb-2';
        metrics.append(
            AdminComponents.metricCardEl('Monthly Recurring Revenue',
                AdminComponents.moneyText(mrr.map(entry => ({ amount: entry.mrr, currency: entry.currency }))), 'Paying subscriptions, per currency'),
            AdminComponents.metricCardEl('Annual Run Rate',
                AdminComponents.moneyText(mrr.map(entry => ({ amount: entry.mrr * 12, currency: entry.currency }))), 'MRR × 12'),
            AdminComponents.metricCardEl('Revenue per Subscriber',
                AdminComponents.moneyText(mrr.map(entry => ({ amount: entry.subscriptions ? entry.mrr / entry.subscriptions : 0, currency: entry.currency }))),
                'MRR ÷ paying subscriptions'),
            AdminComponents.metricCardEl('Paying Subscriptions', String(paying), 'Active and inside the paid period')
        );

        const trend = analytics.trend || [];
        const canvas = document.createElement('canvas');
        canvas.id = 'revenue-trend-chart';
        canvas.height = 80;

        const breakdown = analytics.breakdown || [];
        const byPlan = breakdown.length
            ? AdminComponents.tableEl(['Plan', 'Region', 'Subscriptions', 'MRR'], breakdown.map(row => [
                row.plan_name || '—', row.region, String(row.subscriptions), AdminComponents.formatCurrency(row.mrr, row.currency)
            ]))
            : AdminComponents.noteEl('No subscription pays at the moment.');

        content.replaceChildren(
            metrics,
            AdminComponents.cardEl('Completed Payments per Month (last 12 months)',
                trend.length ? canvas : AdminComponents.noteEl('No completed payments in the last 12 months.')),
            AdminComponents.cardEl('MRR by Plan', byPlan)
        );

        if (trend.length) this.initRevenueTrendChart(trend);
    },

    /**
     * Initialize revenue trend chart: one line per currency
     */
    initRevenueTrendChart(trend) {
        const canvas = document.getElementById('revenue-trend-chart');
        if (!canvas) return;

        // Destroy existing chart
        if (this.revenueChart) {
            this.revenueChart.destroy();
        }

        const months = [...new Set(trend.map(row => row.month))];
        const currencies = [...new Set(trend.map(row => row.currency))];
        const colours = ['#2563eb', '#10b981', '#f59e0b'];
        const datasets = currencies.map((currency, i) => ({
            label: currency,
            data: months.map(month => {
                const hit = trend.find(row => row.month === month && row.currency === currency);
                return hit ? hit.revenue : 0;
            }),
            borderColor: colours[i % colours.length],
            fill: false,
            tension: 0.3
        }));

        this.revenueChart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { labels: months, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: currencies.length > 1
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => AdminComponents.formatCurrency(context.parsed.y, context.dataset.label)
                        }
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
                    <div class="metric-icon"></div>
                    <div class="metric-content">
                        <div class="metric-title">Daily Active Users</div>
                        <div class="metric-value">${analytics.dau || 0}</div>
                        <div class="metric-change metric-change-neutral">
                            Signed in today
                        </div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon"></div>
                    <div class="metric-content">
                        <div class="metric-title">Weekly Active Users</div>
                        <div class="metric-value">${analytics.wau || 0}</div>
                        <div class="metric-change metric-change-neutral">
                            Signed in within 7 days
                        </div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon"></div>
                    <div class="metric-content">
                        <div class="metric-title">Monthly Active Users</div>
                        <div class="metric-value">${analytics.mau || 0}</div>
                        <div class="metric-change metric-change-neutral">
                            Signed in within 30 days
                        </div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon"></div>
                    <div class="metric-content">
                        <div class="metric-title">Inactive Users</div>
                        <div class="metric-value">${analytics.inactive || 0}</div>
                        <div class="metric-change metric-change-neutral">
                            No sign-in for 30+ days
                        </div>
                    </div>
                </div>
            </div>

            <!-- Users by the day of their last sign-in: the only activity a users row records -->
            <div class="admin-card mb-2">
                <div class="admin-card-header">
                    <h3>Users by Day of Last Sign-in (last 30 days)</h3>
                </div>
                <div class="admin-card-body">
                    <canvas id="engagement-chart" height="80"></canvas>
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
        const data = activityData.map(d => Number(d.active_users));

        this.engagementChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Users',
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
                    <div class="metric-icon"></div>
                    <div class="metric-content">
                        <div class="metric-title">Trial Conversion Rate</div>
                        <div class="metric-value">${analytics.trialConversion || 0}%</div>
                        <div class="metric-change metric-change-neutral">
                            Accounts with a trial that pay now
                        </div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon"></div>
                    <div class="metric-content">
                        <div class="metric-title">Churn Rate</div>
                        <div class="metric-value">${analytics.churnRate || 0}%</div>
                        <div class="metric-change metric-change-neutral">
                            Cancelled in the last 30 days
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
                    <h3>Paying Subscriptions by Age</h3>
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
            { key: 'signups', label: 'Sign Ups', icon: '' },
            { key: 'trialStarted', label: 'Trial Started', icon: '' },
            { key: 'converted', label: 'Converted to Paid', icon: '' }
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
                                <div ></div>
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
     * Render trading analytics. Built as DOM: a manual trade's symbol is whatever its owner typed.
     */
    renderTradingAnalytics(analytics) {
        const content = document.getElementById('analytics-tab-content');

        const metrics = document.createElement('div');
        metrics.className = 'metrics-grid mb-2';
        metrics.append(
            AdminComponents.metricCardEl('Total Trades', String(analytics.totalTrades || 0), 'All time'),
            AdminComponents.metricCardEl('Win Rate', `${analytics.winRate || 0}%`, `${analytics.winningTrades || 0} winning trades`),
            AdminComponents.metricCardEl('Avg P/L per Trade', `${analytics.avgPL || 0}%`, 'Closed trades'),
            AdminComponents.metricCardEl('Avg Trades per User', String(analytics.avgTradesPerUser || 0), 'Accounts with trades')
        );

        const symbols = analytics.topSymbols || [];
        const signed = value => `${Number(value) >= 0 ? '+' : ''}${value}%`;
        content.replaceChildren(
            metrics,
            AdminComponents.cardEl('Most Traded Symbols (closed trades)', symbols.length
                ? AdminComponents.tableEl(['Rank', 'Symbol', 'Trades', 'Win Rate', 'Avg P/L'], symbols.map((row, index) => [
                    String(index + 1), row.symbol, String(row.count), `${row.win_rate}%`, signed(row.avg_pl)
                ]))
                : AdminComponents.noteEl('No closed trades yet.'))
        );
    }
};
