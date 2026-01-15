/**
 * Admin Payment Management Module
 * Handles payment transactions, verification, refunds, and analytics
 */

const AdminPayments = {
  // Store current state
  currentTab: 'transactions',
  pagination: null,
  filterStatus: 'all',
  filterProvider: 'all',

  /**
   * Initialize payment management page
   */
  async init() {
    // Initialize pagination
    this.pagination = PaginationManager.create({
      pageSize: 50,
      sortBy: 'created_at',
      sortOrder: 'desc',
      onLoad: () => this.loadTransactions()
    });

    this.render();
    await this.loadTransactions();
  },

  /**
   * Render payment management UI
   */
  render() {
    const container = document.getElementById('payments-page');
    container.innerHTML = `
      <!-- Tab Navigation -->
      <div class="admin-card mb-2">
        <div class="admin-card-body">
          <div class="flex gap-2">
            <button class="btn ${this.currentTab === 'transactions' ? 'btn-primary' : 'btn-secondary'}" onclick="AdminPayments.switchTab('transactions')">
              💰 Transactions
            </button>
            <button class="btn ${this.currentTab === 'verification' ? 'btn-primary' : 'btn-secondary'}" onclick="AdminPayments.switchTab('verification')">
              ✅ Verification Queue
            </button>
            <button class="btn ${this.currentTab === 'refunds' ? 'btn-primary' : 'btn-secondary'}" onclick="AdminPayments.switchTab('refunds')">
              💸 Refunds
            </button>
            <button class="btn ${this.currentTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}" onclick="AdminPayments.switchTab('analytics')">
              📊 Analytics
            </button>
          </div>
        </div>
      </div>

      <!-- Transactions Tab -->
      <div id="transactions-tab" >
        <div class="admin-card">
          <div class="admin-card-header flex-between">
            <h2 class="admin-card-title">Payment Transactions</h2>
            <div class="flex gap-2">
              <select class="form-control" id="payment-status-filter" onchange="AdminPayments.handleStatusFilter(event)">
                <option value="all" ${this.filterStatus === 'all' ? 'selected' : ''}>All Status</option>
                <option value="completed" ${this.filterStatus === 'completed' ? 'selected' : ''}>Completed</option>
                <option value="pending" ${this.filterStatus === 'pending' ? 'selected' : ''}>Pending</option>
                <option value="failed" ${this.filterStatus === 'failed' ? 'selected' : ''}>Failed</option>
                <option value="refunded" ${this.filterStatus === 'refunded' ? 'selected' : ''}>Refunded</option>
              </select>
              <select class="form-control" id="payment-provider-filter" onchange="AdminPayments.handleProviderFilter(event)">
                <option value="all" ${this.filterProvider === 'all' ? 'selected' : ''}>All Providers</option>
                <option value="stripe" ${this.filterProvider === 'stripe' ? 'selected' : ''}>Stripe</option>
                <option value="paypal" ${this.filterProvider === 'paypal' ? 'selected' : ''}>PayPal</option>
                <option value="razorpay" ${this.filterProvider === 'razorpay' ? 'selected' : ''}>Razorpay</option>
              </select>
              <button class="btn btn-secondary btn-sm" onclick="AdminPayments.exportTransactions()">
                📥 Export
              </button>
            </div>
          </div>
          <div class="admin-card-body">
            <div id="transactions-container">
              ${AdminComponents.spinner({ text: 'Loading transactions...' })}
            </div>
          </div>
        </div>
        <div id="transactions-pagination"></div>
      </div>

      <!-- Verification Queue Tab -->
      <div id="verification-tab" >
        <div class="admin-card">
          <div class="admin-card-header">
            <h2 class="admin-card-title">Payment Verification Queue</h2>
          </div>
          <div class="admin-card-body">
            <div id="verification-container">
              ${AdminComponents.spinner({ text: 'Loading verification queue...' })}
            </div>
          </div>
        </div>
      </div>

      <!-- Refunds Tab -->
      <div id="refunds-tab" >
        <div class="admin-card">
          <div class="admin-card-header">
            <h2 class="admin-card-title">Refund Management</h2>
          </div>
          <div class="admin-card-body">
            <div id="refunds-container">
              ${AdminComponents.spinner({ text: 'Loading refunds...' })}
            </div>
          </div>
        </div>
      </div>

      <!-- Analytics Tab -->
      <div id="analytics-tab" >
        <div class="metrics-grid" id="payment-metrics">
          ${AdminComponents.spinner({ text: 'Loading analytics...' })}
        </div>

        <div class="admin-card mt-2">
          <div class="admin-card-header">
            <h2 class="admin-card-title">Revenue by Provider</h2>
          </div>
          <div class="admin-card-body">
            <canvas id="provider-revenue-chart" height="80"></canvas>
          </div>
        </div>

        <div class="admin-card mt-2">
          <div class="admin-card-header">
            <h2 class="admin-card-title">Payment Success Rate</h2>
          </div>
          <div class="admin-card-body">
            <canvas id="success-rate-chart" height="80"></canvas>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Switch between tabs
   */
  switchTab(tab) {
    this.currentTab = tab;

    // Hide all tabs
    ['transactions', 'verification', 'refunds', 'analytics'].forEach(t => {
      document.getElementById(`${t}-tab`)
    });

    // Show selected tab
    document.getElementById(`${tab}-tab`)

    // Update buttons
    document.querySelectorAll('#payments-page .btn').forEach(btn => {
      if (btn.onclick && btn.onclick.toString().includes(tab)) {
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
      } else if (btn.onclick && btn.onclick.toString().includes('switchTab')) {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
      }
    });

    // Load data for selected tab
    if (tab === 'transactions') {
      this.loadTransactions();
    } else if (tab === 'verification') {
      this.loadVerificationQueue();
    } else if (tab === 'refunds') {
      this.loadRefunds();
    } else if (tab === 'analytics') {
      this.loadAnalytics();
    }
  },

  /**
   * Load payment transactions
   */
  async loadTransactions() {
    const params = this.pagination.getParams();

    if (this.filterStatus !== 'all') {
      params.status = this.filterStatus;
    }

    if (this.filterProvider !== 'all') {
      params.provider = this.filterProvider;
    }

    await ApiClient.fetchAndRender({
      endpoint: '/api/admin/payments',
      params,
      containerId: 'transactions-container',
      renderFn: (data) => this.renderTransactions(data.items || [], data.pagination),
      retryFn: 'AdminPayments.loadTransactions()',
      loadingText: 'Loading transactions...',
      errorMessage: 'Failed to load transactions'
    });
  },

  /**
   * Render transactions table
   */
  renderTransactions(transactions, pagination) {
    if (transactions.length === 0) {
      document.getElementById('transactions-container').innerHTML = `
        <div class="text-center text-muted">
          <p>No payment transactions found</p>
        </div>
      `;
      return;
    }

    const tableHTML = AdminComponents.dataTable({
      columns: [
        {
          label: 'Transaction ID',
          key: 'transaction_id',
          render: (id) => `<code>${id.substring(0, 12)}...</code>`
        },
        {
          label: 'User',
          key: 'user_email',
          render: (email) => `<strong>${email}</strong>`
        },
        {
          label: 'Amount',
          key: 'amount',
          render: (amount, payment) => AdminComponents.formatCurrency(amount, payment.currency)
        },
        {
          label: 'Provider',
          key: 'payment_provider',
          render: (provider) => {
            const badges = {
              stripe: 'info',
              paypal: 'primary',
              razorpay: 'success'
            };
            return AdminComponents.badge({
              text: provider.charAt(0).toUpperCase() + provider.slice(1),
              type: badges[provider] || 'gray'
            });
          }
        },
        {
          label: 'Status',
          key: 'status',
          render: (status) => {
            const statusColors = {
              completed: 'success',
              pending: 'warning',
              failed: 'danger',
              refunded: 'gray'
            };
            return AdminComponents.badge({
              text: status.charAt(0).toUpperCase() + status.slice(1),
              type: statusColors[status] || 'gray'
            });
          }
        },
        {
          label: 'Date',
          key: 'created_at',
          render: (date) => DateFormatter.format(date)
        }
      ],
      data: transactions,
      actions: [
        {
          label: 'View',
          className: 'btn-secondary',
          onClick: (payment) => `AdminPayments.viewPayment('${payment.transaction_id}')`
        },
        {
          label: 'Refund',
          className: 'btn-warning',
          onClick: (payment) => `AdminPayments.initiateRefund('${payment.transaction_id}')`,
          disabled: (payment) => payment.status !== 'completed'
        }
      ]
    });

    document.getElementById('transactions-container').innerHTML = tableHTML;

    // Render pagination
    if (pagination && pagination.pages > 1) {
      const paginationHTML = AdminComponents.pagination({
        currentPage: pagination.page,
        totalPages: pagination.pages,
        onPageChange: (page) => `AdminPayments.goToPage(${page})`
      });
      document.getElementById('transactions-pagination').innerHTML = paginationHTML;
    }
  },

  /**
   * Load verification queue
   */
  async loadVerificationQueue() {
    await ApiClient.fetchAndRender({
      endpoint: '/api/admin/payments/verification-queue',
      containerId: 'verification-container',
      renderFn: (data) => this.renderVerificationQueue(data.queue || []),
      retryFn: 'AdminPayments.loadVerificationQueue()',
      loadingText: 'Loading verification queue...',
      errorMessage: 'Failed to load verification queue'
    });
  },

  /**
   * Render verification queue
   */
  renderVerificationQueue(queue) {
    if (queue.length === 0) {
      document.getElementById('verification-container').innerHTML = `
        <div class="text-center text-muted">
          <p>No payments pending verification</p>
        </div>
      `;
      return;
    }

    const queueHTML = queue.map(payment => `
      <div class="admin-card mb-2">
        <div class="admin-card-body">
          <div class="flex-between">
            <div>
              <strong>${payment.user_email}</strong><br>
              <small class="text-muted">${AdminComponents.formatCurrency(payment.amount, payment.currency)} via ${payment.payment_provider}</small><br>
              <small class="text-muted">Transaction: <code>${payment.transaction_id}</code></small>
            </div>
            <div class="flex gap-1">
              <button class="btn btn-success btn-sm" onclick="AdminPayments.verifyPayment('${payment.transaction_id}', true)">
                ✅ Approve
              </button>
              <button class="btn btn-danger btn-sm" onclick="AdminPayments.verifyPayment('${payment.transaction_id}', false)">
                ❌ Reject
              </button>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    document.getElementById('verification-container').innerHTML = queueHTML;
  },

  /**
   * Load refunds
   */
  async loadRefunds() {
    await ApiClient.fetchAndRender({
      endpoint: '/api/admin/payments/refunds',
      containerId: 'refunds-container',
      renderFn: (data) => this.renderRefunds(data.refunds || []),
      retryFn: 'AdminPayments.loadRefunds()',
      loadingText: 'Loading refunds...',
      errorMessage: 'Failed to load refunds'
    });
  },

  /**
   * Render refunds table
   */
  renderRefunds(refunds) {
    if (refunds.length === 0) {
      document.getElementById('refunds-container').innerHTML = `
        <div class="text-center text-muted">
          <p>No refunds found</p>
        </div>
      `;
      return;
    }

    const tableHTML = AdminComponents.dataTable({
      columns: [
        {
          label: 'Original Transaction',
          key: 'transaction_id',
          render: (id) => `<code>${id.substring(0, 12)}...</code>`
        },
        {
          label: 'User',
          key: 'user_email'
        },
        {
          label: 'Amount',
          key: 'refund_amount',
          render: (amount, refund) => AdminComponents.formatCurrency(amount, refund.currency)
        },
        {
          label: 'Reason',
          key: 'refund_reason',
          render: (reason) => reason || '-'
        },
        {
          label: 'Status',
          key: 'status',
          render: (status) => AdminComponents.badge({
            text: status.charAt(0).toUpperCase() + status.slice(1),
            type: status === 'completed' ? 'success' : 'warning'
          })
        },
        {
          label: 'Date',
          key: 'created_at',
          render: (date) => DateFormatter.format(date)
        }
      ],
      data: refunds,
      actions: [
        {
          label: 'View',
          className: 'btn-secondary',
          onClick: (refund) => `AdminPayments.viewRefund('${refund.id}')`
        }
      ]
    });

    document.getElementById('refunds-container').innerHTML = tableHTML;
  },

  /**
   * Load payment analytics
   */
  async loadAnalytics() {
    try {
      const response = await fetch('/api/admin/payment-analytics');
      const data = await response.json();

      if (data.success) {
        this.renderAnalyticsMetrics(data.data);
        this.renderProviderChart(data.data.byProvider || []);
        this.renderSuccessRateChart(data.data.successRate || []);
      }

    } catch (error) {
    }
  },

  /**
   * Render analytics metrics
   */
  renderAnalyticsMetrics(analytics) {
    const metricsHTML = `
      ${AdminComponents.metricCard({
        title: 'Total Revenue',
        value: AdminComponents.formatCurrency(analytics.totalRevenue || 0, 'GBP'),
        change: analytics.revenueChange || '+0%',
        changeType: 'positive',
        icon: '💰'
      })}
      ${AdminComponents.metricCard({
        title: 'Transactions',
        value: AdminComponents.formatNumber(analytics.totalTransactions || 0),
        change: analytics.transactionChange || '+0',
        changeType: 'positive',
        icon: '📊'
      })}
      ${AdminComponents.metricCard({
        title: 'Success Rate',
        value: (analytics.successRate || 0) + '%',
        change: analytics.successRateChange || '+0%',
        changeType: 'positive',
        icon: '✅'
      })}
      ${AdminComponents.metricCard({
        title: 'Refund Rate',
        value: (analytics.refundRate || 0) + '%',
        change: analytics.refundRateChange || '-0%',
        changeType: 'negative',
        icon: '💸'
      })}
    `;

    document.getElementById('payment-metrics').innerHTML = metricsHTML;
  },

  /**
   * Render provider revenue chart
   */
  renderProviderChart(providerData) {
    const ctx = document.getElementById('provider-revenue-chart');
    if (!ctx) return;

    const labels = providerData.length > 0 ? providerData.map(d => d.provider) : ['Stripe', 'PayPal', 'Razorpay'];
    const data = providerData.length > 0 ? providerData.map(d => d.revenue) : [5000, 3000, 2000];

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Revenue (£)',
          data,
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false }
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
   * Render success rate chart
   */
  renderSuccessRateChart(successData) {
    const ctx = document.getElementById('success-rate-chart');
    if (!ctx) return;

    const labels = successData.length > 0 ? successData.map(d => d.date) : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const data = successData.length > 0 ? successData.map(d => d.rate) : [95, 97, 94, 96, 98, 95, 97];

    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Success Rate (%)',
          data,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          }
        }
      }
    });
  },

  /**
   * Handle filters
   */
  handleStatusFilter(event) {
    this.filterStatus = event.target.value;
    this.pagination.reset();
    this.loadTransactions();
  },

  handleProviderFilter(event) {
    this.filterProvider = event.target.value;
    this.pagination.reset();
    this.loadTransactions();
  },

  /**
   * Go to page (delegates to PaginationManager)
   */
  goToPage(page) {
    this.pagination.goToPage(page);
  },

  /**
   * View payment details
   */
  async viewPayment(transactionId) {
    try {
      const response = await fetch(`/api/admin/payments/${transactionId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to load payment');
      }

      const payment = data.data;
      this.showPaymentModal(payment);

    } catch (error) {
      AdminComponents.alert({
        type: 'error',
        message: `Failed to load payment: ${error.message}`,
        autoDismiss: 5000
      });
    }
  },

  /**
   * Show payment modal
   */
  showPaymentModal(payment) {
    const content = `
      <div>
        <div class="mb-2">
          <strong>Transaction ID:</strong><br>
          <code>${payment.transaction_id}</code>
        </div>
        <div class="mb-2">
          <strong>User:</strong> ${payment.user_email}
        </div>
        <div class="mb-2">
          <strong>Amount:</strong> ${AdminComponents.formatCurrency(payment.amount, payment.currency)}
        </div>
        <div class="mb-2">
          <strong>Provider:</strong> ${payment.payment_provider}
        </div>
        <div class="mb-2">
          <strong>Status:</strong> ${AdminComponents.badge({
            text: payment.status.charAt(0).toUpperCase() + payment.status.slice(1),
            type: payment.status === 'completed' ? 'success' : payment.status === 'failed' ? 'danger' : 'warning'
          })}
        </div>
        <div class="mb-2">
          <strong>Date:</strong> ${new Date(payment.created_at).toLocaleString()}
        </div>
        ${payment.description ? `<div class="mb-2"><strong>Description:</strong> ${payment.description}</div>` : ''}
      </div>
    `;

    AdminComponents.modal({
      id: 'payment-modal',
      title: 'Payment Details',
      content,
      footer: `<button class="btn btn-secondary" onclick="AdminComponents.closeModal('payment-modal')">Close</button>`,
      size: 'medium'
    });
  },

  /**
   * Initiate refund
   */
  async initiateRefund(transactionId) {
    const reason = prompt('Enter refund reason:');
    if (!reason) return;

    try {
      const response = await fetch(`/api/admin/payments/${transactionId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to process refund');
      }

      AdminComponents.alert({
        type: 'success',
        message: 'Refund processed successfully',
        autoDismiss: 3000
      });

      this.loadTransactions();

    } catch (error) {
      AdminComponents.alert({
        type: 'error',
        message: `Failed to process refund: ${error.message}`,
        autoDismiss: 5000
      });
    }
  },

  /**
   * Verify payment
   */
  async verifyPayment(transactionId, approved) {
    try {
      const response = await fetch(`/api/admin/payments/${transactionId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to verify payment');
      }

      AdminComponents.alert({
        type: 'success',
        message: `Payment ${approved ? 'approved' : 'rejected'} successfully`,
        autoDismiss: 3000
      });

      this.loadVerificationQueue();

    } catch (error) {
      AdminComponents.alert({
        type: 'error',
        message: `Failed to verify payment: ${error.message}`,
        autoDismiss: 5000
      });
    }
  },

  /**
   * View refund details
   */
  async viewRefund(refundId) {
    AdminComponents.alert({
      type: 'info',
      message: 'Refund details coming soon...',
      autoDismiss: 3000
    });
  },

  /**
   * Export transactions
   */
  async exportTransactions() {
    AdminComponents.alert({
      type: 'info',
      message: 'Exporting transactions to CSV...',
      autoDismiss: 3000
    });
    // TODO: Implement CSV export
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.AdminPayments = AdminPayments;
}
