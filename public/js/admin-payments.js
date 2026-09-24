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

    // Every visit renders the Transactions sub-tab, so the highlighted button must say so
    this.currentTab = 'transactions';
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
               Transactions
            </button>
            <button class="btn ${this.currentTab === 'verification' ? 'btn-primary' : 'btn-secondary'}" onclick="AdminPayments.switchTab('verification')">
               Verification Queue
            </button>
            <button class="btn ${this.currentTab === 'refunds' ? 'btn-primary' : 'btn-secondary'}" onclick="AdminPayments.switchTab('refunds')">
               Refunds
            </button>
            <button class="btn ${this.currentTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}" onclick="AdminPayments.switchTab('analytics')">
               Analytics
            </button>
          </div>
        </div>
      </div>

      <!-- Transactions Tab (the sub-tab ids carry a payments- prefix: the Subscriptions tab has its own analytics-tab) -->
      <div id="payments-transactions-tab">
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
      <div id="payments-verification-tab" class="hidden">
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
      <div id="payments-refunds-tab" class="hidden">
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
      <div id="payments-analytics-tab" class="hidden">
        <div class="metrics-grid" id="payment-metrics">
          ${AdminComponents.spinner({ text: 'Loading analytics...' })}
        </div>

        <div class="admin-card mt-2">
          <div class="admin-card-header">
            <h2 class="admin-card-title">Completed Payments by Provider</h2>
          </div>
          <div class="admin-card-body" id="provider-revenue-body"></div>
        </div>

        <div class="admin-card mt-2">
          <div class="admin-card-header">
            <h2 class="admin-card-title">Payment Success Rate (last 7 days)</h2>
          </div>
          <div class="admin-card-body" id="success-rate-body"></div>
        </div>
      </div>
    `;
  },

  /**
   * Switch between tabs
   */
  switchTab(tab) {
    this.currentTab = tab;

    // Show the selected sub-tab, hide the others
    ['transactions', 'verification', 'refunds', 'analytics'].forEach(t => {
      const el = document.getElementById(`payments-${t}-tab`);
      if (el) el.classList.toggle('hidden', t !== tab);
    });

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
          render: (amount, payment) =>AdminComponents.formatCurrency(amount, payment.currency)
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
          render: (date) =>DateFormatter.format(date)
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
          label: 'Record refund',
          className: 'btn-warning',
          onClick: (payment) => `AdminPayments.initiateRefund('${payment.transaction_id}')`,
          disabled: (payment) => payment.status !== 'completed'
        }
      ]
    });

    document.getElementById('transactions-container').innerHTML = tableHTML;

    // Render pagination
    if (pagination && pagination.pages >1) {
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
                 Approve
              </button>
              <button class="btn btn-danger btn-sm" onclick="AdminPayments.verifyPayment('${payment.transaction_id}', false)">
                 Reject
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
          render: (amount, refund) =>AdminComponents.formatCurrency(amount, refund.currency)
        },
        {
          label: 'Reason',
          key: 'refund_reason',
          render: (reason) => reason || '-'
        },
        {
          label: 'Status',
          key: 'status',
          render: (status) =>AdminComponents.badge({
            text: status.charAt(0).toUpperCase() + status.slice(1),
            type: status === 'completed' ? 'success' : 'warning'
          })
        },
        {
          label: 'Date',
          key: 'created_at',
          render: (date) =>DateFormatter.format(date)
        }
      ],
      data: refunds
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
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to load payment analytics');
      }
      this.renderAnalyticsMetrics(data.data);
      this.renderProviderChart(data.data.byProvider || []);
      this.renderSuccessRateChart(data.data.successRateDaily || []);
    } catch (error) {
      document.getElementById('payment-metrics')
        .replaceChildren(AdminComponents.noteEl(`Payment analytics could not be read: ${error.message}`));
    }
  },

  /**
   * Render analytics metrics: revenue per currency, never added together. The changes shown under
   * them (+15%, +23, +2%, -1%) were made up, and the revenue added every currency up as pounds.
   */
  renderAnalyticsMetrics(analytics) {
    const revenue = (analytics.revenue || []).map(entry => ({ amount: entry.revenue, currency: entry.currency }));
    document.getElementById('payment-metrics').replaceChildren(
      AdminComponents.metricCardEl('Completed Payments', AdminComponents.moneyText(revenue), 'All time, per currency'),
      AdminComponents.metricCardEl('Transactions', AdminComponents.formatNumber(analytics.totalTransactions || 0), 'Every status'),
      AdminComponents.metricCardEl('Success Rate', `${analytics.successRate || 0}%`, 'Completed of all transactions'),
      AdminComponents.metricCardEl('Refund Rate', `${analytics.refundRate || 0}%`, 'Refunded of all transactions')
    );
  },

  /**
   * A fresh canvas in a card body, with the old chart destroyed; or a note when there is nothing to plot
   */
  chartCanvas(bodyId, chartKey, empty, emptyText) {
    const body = document.getElementById(bodyId);
    if (!body) return null;
    if (this[chartKey]) {
      this[chartKey].destroy();
      this[chartKey] = null;
    }
    if (empty) {
      body.replaceChildren(AdminComponents.noteEl(emptyText));
      return null;
    }
    const canvas = document.createElement('canvas');
    canvas.height = 80;
    body.replaceChildren(canvas);
    return canvas;
  },

  /**
   * Render completed payments by provider: one bar per provider and currency. It used to plot
   * made-up amounts (5000, 3000, 2000) when there were no payments.
   */
  renderProviderChart(providerData) {
    const canvas = this.chartCanvas('provider-revenue-body', 'providerChart', providerData.length === 0, 'No completed payments yet.');
    if (!canvas) return;

    this.providerChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: providerData.map(d => `${d.provider} (${d.currency})`),
        datasets: [{
          label: 'Completed payments',
          data: providerData.map(d => d.revenue),
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => AdminComponents.formatCurrency(context.parsed.y, providerData[context.dataIndex].currency)
            }
          }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  },

  /**
   * Render success rate chart: the last 7 days that had payments. It used to plot made-up rates
   * (95%, 97%...) when there were none.
   */
  renderSuccessRateChart(successData) {
    const canvas = this.chartCanvas('success-rate-body', 'successChart', successData.length === 0, 'No payments in the last 7 days.');
    if (!canvas) return;

    this.successChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: successData.map(d => d.date),
        datasets: [{
          label: 'Success Rate (%)',
          data: successData.map(d => Number(d.rate)),
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
          <strong>Date:</strong> ${DateFormatter.formatTime(payment.created_at)}
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
   * Record a refund. It marks the payment refunded and files the reason: no money moves here, the
   * refund itself is made in the payment provider (the Stripe dashboard). This used to say "Refund
   * processed successfully".
   */
  async initiateRefund(transactionId) {
    const reason = prompt('Record a refund made in the payment provider. This marks the payment refunded; ' +
      'it moves no money. Reason:');
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
        message: 'Refund recorded. No money moved here: refund the payment in the payment provider if that is not done yet.',
        autoDismiss: 6000
      });

      this.loadTransactions();

    } catch (error) {
      AdminComponents.alert({
        type: 'error',
        message: `The refund was not recorded: ${AdminComponents.escapeHtml(error.message)}`,
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
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.AdminPayments = AdminPayments;
}
