/**
 * Admin Dashboard Module
 * Handles dashboard metrics, the revenue chart and recent activity
 */

const AdminDashboard = {
  // Store chart instance
  revenueChart: null,
  // The 60-second metrics refresh (startMetricsRefresh)
  metricsTimer: null,

  /**
   * Initialize dashboard
   */
  async init() {
    try {
      await this.loadMetrics();
      await this.loadRecentActivity();
      this.initRevenueChart();
      this.startMetricsRefresh();
    } catch (error) {
      AdminComponents.alert({
        type: 'error',
        message: 'Failed to load dashboard data',
        autoDismiss: 5000
      });
    }
  },

  /**
   * Load dashboard metrics
   */
  async loadMetrics() {
    try {
      const data = await ApiClient.get('/api/admin/dashboard/metrics');
      const metrics = data;

      // Update MRR
      document.getElementById('metric-mrr').textContent = AdminComponents.formatCurrency(metrics.mrr, 'GBP');
      document.getElementById('metric-mrr-change').textContent = metrics.changes?.mrr || '+0%';

      // Update Users
      document.getElementById('metric-users').textContent = AdminComponents.formatNumber(metrics.totalUsers);
      document.getElementById('metric-users-change').textContent = metrics.changes?.users || '+0';

      // Update Subscriptions
      document.getElementById('metric-subs').textContent = AdminComponents.formatNumber(metrics.activeSubscriptions);
      document.getElementById('metric-subs-change').textContent = metrics.changes?.subscriptions || '+0';

      // Update Trades
      document.getElementById('metric-trades').textContent = AdminComponents.formatNumber(metrics.totalTrades);
      document.getElementById('metric-trades-change').textContent = metrics.changes?.trades || '+0';

    } catch (error) {
      // Show placeholder values
      document.getElementById('metric-mrr').textContent = '£0.00';
      document.getElementById('metric-users').textContent = '0';
      document.getElementById('metric-subs').textContent = '0';
      document.getElementById('metric-trades').textContent = '0';
    }
  },

  /**
   * Load recent activity
   */
  async loadRecentActivity() {
    try {
      const data = await ApiClient.get('/api/admin/audit/logs', { limit: 10 });
      const logs = data.logs || [];
      const activityContainer = document.getElementById('recent-activity');

      if (logs.length === 0) {
        activityContainer.innerHTML = '<p class="text-muted text-center">No recent activity</p>';
        return;
      }

      // Map activity types to icons
      const activityIcons = {
        login: '',
        logout: '',
        user_created: '',
        user_updated: '',
        user_deleted: '',
        subscription_created: '',
        subscription_updated: '',
        subscription_cancelled: '',
        payment_verified: '',
        payment_rejected: '',
        refund_issued: '',
        settings_updated: '',
        database_query_executed: ''
      };

      const activityHTML = logs.map(log => {
        const icon = activityIcons[log.activity_type] || '';
        return AdminComponents.activityItem({
          icon,
          title: log.description,
          description: log.activity_type.replace(/_/g, ' '),
          timestamp: log.created_at,
          user: log.admin_email
        });
      }).join('');

      activityContainer.innerHTML = activityHTML;

    } catch (error) {
      document.getElementById('recent-activity').innerHTML =
        '<p class="text-muted text-center">Failed to load activity</p>';
    }
  },

  /**
   * Initialize revenue trend chart
   */
  initRevenueChart() {
    const ctx = document.getElementById('revenue-chart');
    if (!ctx) return;

    // Get the canvas element and check if there's already a chart
    const canvas = ctx;

    // Destroy any existing chart instance on this canvas
    if (this.revenueChart) {
      try {
        this.revenueChart.destroy();
      } catch (e) {
      }
      this.revenueChart = null;
    }

    // Also check Chart.js global registry for any chart using this canvas
    const chartId = Chart.getChart(canvas);
    if (chartId) {
      try {
        chartId.destroy();
      } catch (e) {
      }
    }

    // Generate sample data for last 12 months
    const labels = [];
    const data = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
      // Sample data - replace with real data from API
      data.push(Math.floor(Math.random() * 5000) + 1000);
    }

    try {
      this.revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Revenue (£)',
            data: data,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            tension: 0.4,
            fill: true
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
                label: function(context) {
                  return '£' + context.parsed.y.toLocaleString();
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function(value) {
                  return '£' + value.toLocaleString();
                }
              }
            }
          }
        }
      });
    } catch (error) {
      this.revenueChart = null;
    }
  },

  /**
   * Change chart period
   */
  changeChartPeriod(period) {
    // TODO: Implement period change (fetch different data range)
    AdminComponents.alert({
      type: 'info',
      message: `Chart period changed to ${period}`,
      autoDismiss: 3000
    });
  },

  /**
   * Refresh the metrics every 60 seconds while the page is visible. The dashboard has no live feed:
   * the old event stream never carried a metric, and this refresh ran only while it was closed.
   */
  startMetricsRefresh() {
    if (this.metricsTimer) return;
    this.metricsTimer = setInterval(() => {
      if (document.visibilityState === "visible") this.loadMetrics();
    }, 60000);
  },

  /**
   * Cleanup on page unload
   */
  cleanup() {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
    if (this.revenueChart) {
      this.revenueChart.destroy();
      this.revenueChart = null;
    }
  }
};

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  AdminDashboard.cleanup();
});

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.AdminDashboard = AdminDashboard;
}
