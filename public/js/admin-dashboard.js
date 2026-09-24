/**
 * Admin Dashboard Module
 * The dashboard's figures and the audit log. A figure that cannot be read shows '—', never a made-up
 * value: until 2026-09-24 the revenue chart plotted random numbers, every figure read 0 (the metrics
 * were read from the wrong level of the answer), and the changes under them were hard-coded.
 */

const AdminDashboard = {
  // The 60-second metrics refresh (startMetricsRefresh)
  metricsTimer: null,

  /**
   * Initialize dashboard
   */
  async init() {
    await Promise.all([this.loadMetrics(), this.loadRecentActivity()]);
    this.startMetricsRefresh();
  },

  /**
   * MRR per currency ("£9.99 · $12.99"): amounts in different currencies are never added together.
   * '—' when it could not be read, 0 when no subscription pays.
   */
  formatMrr(mrr) {
    if (!Array.isArray(mrr)) return '—';
    return AdminComponents.moneyText(mrr.map(entry => ({ amount: entry.mrr, currency: entry.currency })));
  },

  /**
   * Load dashboard metrics
   */
  async loadMetrics() {
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    const count = value => (Number.isInteger(value) ? AdminComponents.formatNumber(value) : '—');

    let metrics = {};
    try {
      const envelope = await ApiClient.get('/api/admin/dashboard/metrics');
      metrics = envelope.data || {};
    } catch (error) {
      // Every figure shows '—' below
    }

    set('metric-mrr', this.formatMrr(metrics.mrr));
    set('metric-users', count(metrics.totalUsers));
    set('metric-subs', count(metrics.activeSubscriptions));
    set('metric-trades', count(metrics.totalTrades));
  },

  /**
   * Load the audit log: account deletions, by the account's owner or by an admin
   */
  async loadRecentActivity() {
    const container = document.getElementById('recent-activity');
    if (!container) return;

    let answer;
    try {
      answer = (await ApiClient.get('/api/admin/audit/logs', { limit: 10 })).data || {};
    } catch (error) {
      container.replaceChildren(AdminComponents.noteEl('The audit log could not be read.'));
      return;
    }

    const logs = answer.logs || [];
    if (answer.missing) {
      container.replaceChildren(AdminComponents.noteEl('This database has no audit log table.'));
      return;
    }
    if (logs.length === 0) {
      container.replaceChildren(AdminComponents.noteEl('Nothing recorded yet. Account deletions are recorded here.'));
      return;
    }

    container.replaceChildren(AdminComponents.tableEl(['When', 'What', 'Account', 'By'], logs.map(log => [
      DateFormatter.formatTime(log.created_at), log.description, log.target_id || '—', log.admin_email
    ])));
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
