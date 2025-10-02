/**
 * Admin Dashboard Module
 * Handles dashboard metrics, charts, and real-time updates
 */

const AdminDashboard = {
  // Store SSE connection
  eventSource: null,

  // Store chart instance
  revenueChart: null,

  /**
   * Initialize dashboard
   */
  async init() {
    try {
      await this.loadMetrics();
      await this.loadRecentActivity();
      this.initRevenueChart();
      this.setupSSE();
      this.startMetricsRefresh();
    } catch (error) {
      console.error('Dashboard initialization failed:', error);
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
      const response = await fetch('/api/admin/dashboard/metrics');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to load metrics');
      }

      const metrics = data.data;

      // Update MRR
      document.getElementById('metric-mrr').textContent = AdminComponents.formatCurrency(metrics.mrr, 'GBP');
      document.getElementById('metric-mrr-change').textContent = metrics.changes?.mrr || '+0%';

      // Update Users
      document.getElementById('metric-users').textContent = AdminComponents.formatNumber(metrics.totalUsers);
      document.getElementById('metric-users-change').textContent = metrics.changes?.users || '+0';

      // Update Subscriptions
      document.getElementById('metric-subs').textContent = AdminComponents.formatNumber(metrics.activeSubscriptions);
      document.getElementById('metric-subs-change').textContent = metrics.changes?.subscriptions || '+0';

      // Update Payments
      document.getElementById('metric-payments').textContent = AdminComponents.formatNumber(metrics.paymentsThisMonth);
      document.getElementById('metric-payments-change').textContent = metrics.changes?.payments || '+0';

    } catch (error) {
      console.error('Failed to load metrics:', error);

      // Show placeholder values
      document.getElementById('metric-mrr').textContent = '£0.00';
      document.getElementById('metric-users').textContent = '0';
      document.getElementById('metric-subs').textContent = '0';
      document.getElementById('metric-payments').textContent = '0';
    }
  },

  /**
   * Load recent activity
   */
  async loadRecentActivity() {
    try {
      const response = await fetch('/api/admin/audit/logs?limit=10');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to load activity');
      }

      const logs = data.data.logs || [];
      const activityContainer = document.getElementById('recent-activity');

      if (logs.length === 0) {
        activityContainer.innerHTML = '<p class="text-muted text-center">No recent activity</p>';
        return;
      }

      // Map activity types to icons
      const activityIcons = {
        login: '🔐',
        logout: '🚪',
        user_created: '👤',
        user_updated: '✏️',
        user_deleted: '🗑️',
        subscription_created: '💳',
        subscription_updated: '📝',
        subscription_cancelled: '❌',
        payment_verified: '✅',
        payment_rejected: '❌',
        refund_issued: '💸',
        settings_updated: '⚙️',
        database_query_executed: '🗄️'
      };

      const activityHTML = logs.map(log => {
        const icon = activityIcons[log.activity_type] || '📋';
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
      console.error('Failed to load recent activity:', error);
      document.getElementById('recent-activity').innerHTML =
        '<p class="text-muted text-center">Failed to load activity</p>';
    }
  },

  /**
   * Setup Server-Sent Events for real-time updates
   */
  setupSSE() {
    if (this.eventSource) {
      this.eventSource.close();
    }

    try {
      this.eventSource = new EventSource('/api/admin/events');

      this.eventSource.addEventListener('connected', (event) => {
        console.log('SSE connected:', event.data);
      });

      this.eventSource.addEventListener('activity', (event) => {
        const data = JSON.parse(event.data);
        console.log('New activity:', data);
        // Reload recent activity
        this.loadRecentActivity();
      });

      this.eventSource.addEventListener('metrics', (event) => {
        const data = JSON.parse(event.data);
        console.log('Metrics update:', data);
        // Update metrics without full reload
        this.updateMetricsDisplay(data);
      });

      this.eventSource.addEventListener('heartbeat', () => {
        // Just to keep connection alive
      });

      this.eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        this.eventSource.close();

        // Retry connection after 30 seconds
        setTimeout(() => this.setupSSE(), 30000);
      };

    } catch (error) {
      console.error('Failed to setup SSE:', error);
    }
  },

  /**
   * Update metrics display from SSE data
   */
  updateMetricsDisplay(metrics) {
    if (metrics.mrr !== undefined) {
      document.getElementById('metric-mrr').textContent = AdminComponents.formatCurrency(metrics.mrr, 'GBP');
    }
    if (metrics.totalUsers !== undefined) {
      document.getElementById('metric-users').textContent = AdminComponents.formatNumber(metrics.totalUsers);
    }
    if (metrics.activeSubscriptions !== undefined) {
      document.getElementById('metric-subs').textContent = AdminComponents.formatNumber(metrics.activeSubscriptions);
    }
    if (metrics.paymentsThisMonth !== undefined) {
      document.getElementById('metric-payments').textContent = AdminComponents.formatNumber(metrics.paymentsThisMonth);
    }
  },

  /**
   * Start periodic metrics refresh (fallback if SSE fails)
   */
  startMetricsRefresh() {
    // Refresh metrics every 60 seconds as fallback
    setInterval(() => {
      if (!this.eventSource || this.eventSource.readyState !== EventSource.OPEN) {
        this.loadMetrics();
      }
    }, 60000);
  },

  /**
   * Initialize revenue trend chart
   */
  initRevenueChart() {
    const ctx = document.getElementById('revenue-chart');
    if (!ctx) return;

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
  },

  /**
   * Change chart period
   */
  changeChartPeriod(period) {
    console.log('Change chart period to:', period);
    // TODO: Implement period change (fetch different data range)
    AdminComponents.alert({
      type: 'info',
      message: `Chart period changed to ${period}`,
      autoDismiss: 3000
    });
  },

  /**
   * Cleanup on page unload
   */
  cleanup() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
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
