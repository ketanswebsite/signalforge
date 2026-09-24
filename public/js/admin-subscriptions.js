/**
 * Admin Subscription Management Module
 * Handles subscription plans, active subscriptions, and lifecycle management
 */

const AdminSubscriptions = {
  // Store current state
  currentTab: 'plans',
  pagination: null,
  filterStatus: 'all',
  growthChart: null,

  /**
   * Initialize subscription management page
   */
  async init() {
    // Initialize pagination
    this.pagination = PaginationManager.create({
      pageSize: 50,
      sortBy: 'created_at',
      sortOrder: 'desc',
      onLoad: () => this.loadSubscriptions()
    });

    // Every visit renders the Plans sub-tab, so the highlighted button must say so
    this.currentTab = 'plans';
    this.render();
    await this.loadPlans();
  },

  /**
   * Render subscription management UI
   */
  render() {
    const container = document.getElementById('subscriptions-page');
    container.innerHTML = `
      <!-- Tab Navigation -->
      <div class="admin-card mb-2">
        <div class="admin-card-body">
          <div class="flex gap-2">
            <button class="btn ${this.currentTab === 'plans' ? 'btn-primary' : 'btn-secondary'}" onclick="AdminSubscriptions.switchTab('plans')">
               Plans
            </button>
            <button class="btn ${this.currentTab === 'subscriptions' ? 'btn-primary' : 'btn-secondary'}" onclick="AdminSubscriptions.switchTab('subscriptions')">
               Active Subscriptions
            </button>
            <button class="btn ${this.currentTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}" onclick="AdminSubscriptions.switchTab('analytics')">
               Analytics
            </button>
          </div>
        </div>
      </div>

      <!-- Plans Tab (the sub-tab ids carry a subscriptions- prefix: the Payments tab has sub-tabs too) -->
      <div id="subscriptions-plans-tab">
        <div class="admin-card">
          <div class="admin-card-header flex-between">
            <h2 class="admin-card-title">Subscription Plans</h2>
            <button class="btn btn-primary btn-sm" onclick="AdminSubscriptions.showCreatePlanModal()">
               Create Plan
            </button>
          </div>
          <div class="admin-card-body">
            <div id="plans-container">
              ${AdminComponents.spinner({ text: 'Loading plans...' })}
            </div>
          </div>
        </div>
      </div>

      <!-- Subscriptions Tab -->
      <div id="subscriptions-subscriptions-tab" class="hidden">
        <div class="admin-card">
          <div class="admin-card-header flex-between">
            <h2 class="admin-card-title">Active Subscriptions</h2>
            <div class="flex gap-2">
              <select class="form-control" id="sub-filter" onchange="AdminSubscriptions.handleFilter(event)">
                <option value="all" ${this.filterStatus === 'all' ? 'selected' : ''}>All Status</option>
                <option value="active" ${this.filterStatus === 'active' ? 'selected' : ''}>Active</option>
                <option value="trial" ${this.filterStatus === 'trial' ? 'selected' : ''}>Trial</option>
                <option value="expired" ${this.filterStatus === 'expired' ? 'selected' : ''}>Expired</option>
                <option value="cancelled" ${this.filterStatus === 'cancelled' ? 'selected' : ''}>Cancelled</option>
              </select>
            </div>
          </div>
          <div class="admin-card-body">
            <div id="subscriptions-container">
              ${AdminComponents.spinner({ text: 'Loading subscriptions...' })}
            </div>
          </div>
        </div>
        <div id="subscriptions-pagination"></div>
      </div>

      <!-- Analytics Tab -->
      <div id="subscriptions-analytics-tab" class="hidden">
        <div class="metrics-grid" id="sub-metrics">
          ${AdminComponents.spinner({ text: 'Loading analytics...' })}
        </div>

        <div class="admin-card mt-2">
          <div class="admin-card-header">
            <h2 class="admin-card-title">Subscriptions Started per Month (trials included)</h2>
          </div>
          <div class="admin-card-body" id="subscription-growth-body"></div>
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
    ['plans', 'subscriptions', 'analytics'].forEach(t => {
      const el = document.getElementById(`subscriptions-${t}-tab`);
      if (el) el.classList.toggle('hidden', t !== tab);
    });

    // Update buttons
    document.querySelectorAll('#subscriptions-page .btn').forEach(btn => {
      if (btn.onclick && btn.onclick.toString().includes(tab)) {
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
      } else if (btn.onclick && btn.onclick.toString().includes('switchTab')) {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
      }
    });

    // Load data for selected tab
    if (tab === 'plans') {
      this.loadPlans();
    } else if (tab === 'subscriptions') {
      this.loadSubscriptions();
    } else if (tab === 'analytics') {
      this.loadAnalytics();
    }
  },

  /**
   * Load subscription plans
   */
  async loadPlans() {
    await ApiClient.fetchAndRender({
      endpoint: '/api/admin/subscription-plans',
      containerId: 'plans-container',
      renderFn: (data) => this.renderPlans(data.plans || []),
      retryFn: 'AdminSubscriptions.loadPlans()',
      loadingText: 'Loading plans...',
      errorMessage: 'Failed to load plans'
    });
  },

  /**
   * Render subscription plans
   */
  renderPlans(plans) {
    if (plans.length === 0) {
      document.getElementById('plans-container').innerHTML = `
        <div class="text-center text-muted">
          <p>No subscription plans found</p>
          <button class="btn btn-primary" onclick="AdminSubscriptions.showCreatePlanModal()">Create First Plan</button>
        </div>
      `;
      return;
    }

    const plansHTML = `
      <div class="metrics-grid">
        ${plans.map(plan => `
          <div class="admin-card plan-card" >
            <div class="admin-card-header flex-between">
              <h3 class="admin-card-title">${plan.plan_name}</h3>
              ${plan.is_active ?
                AdminComponents.badge({ text: 'Active', type: 'success' }) :
                AdminComponents.badge({ text: 'Inactive', type: 'gray' })
              }
            </div>
            <div class="admin-card-body">
              <div class="metric-value">${AdminComponents.formatCurrency(plan.price_monthly || 0, plan.currency || 'GBP')}</div>
              <div class="text-muted text-sm">/month</div>

              <div class="mt-2">
                <div class="text-muted text-sm">
                  <strong>Code:</strong> ${plan.plan_code}<br>
                  <strong>Region:</strong> ${plan.region}<br>
                  <strong>Subscribers now (trials included):</strong> ${plan.subscriber_count || 0}
                </div>
              </div>

              <div class="mt-2 flex gap-1">
                <button class="btn ${plan.is_active ? 'btn-warning' : 'btn-success'} btn-sm"
                  onclick="AdminSubscriptions.togglePlanStatus(${plan.id}, ${!plan.is_active})">
                  ${plan.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button class="btn btn-danger btn-sm" onclick="AdminSubscriptions.deletePlan(${plan.id})">Delete</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('plans-container').innerHTML = plansHTML;
  },

  /**
   * Load active subscriptions
   */
  async loadSubscriptions() {
    const params = this.pagination.getParams();

    if (this.filterStatus !== 'all') {
      params.status = this.filterStatus;
    }

    await ApiClient.fetchAndRender({
      endpoint: '/api/admin/subscriptions',
      params,
      containerId: 'subscriptions-container',
      renderFn: (data) => this.renderSubscriptions(data.items || [], data.pagination),
      retryFn: 'AdminSubscriptions.loadSubscriptions()',
      loadingText: 'Loading subscriptions...',
      errorMessage: 'Failed to load subscriptions'
    });
  },

  /**
   * Render subscriptions table
   */
  renderSubscriptions(subscriptions, pagination) {
    if (subscriptions.length === 0) {
      document.getElementById('subscriptions-container').innerHTML = `
        <div class="text-center text-muted">
          <p>No subscriptions found</p>
        </div>
      `;
      return;
    }

    const tableHTML = AdminComponents.dataTable({
      columns: [
        {
          label: 'User Email',
          key: 'user_email',
          render: (email) => `<strong>${email}</strong>`
        },
        {
          label: 'Plan',
          key: 'plan_name',
          render: (planName) => planName || '-'
        },
        {
          label: 'Status',
          key: 'status',
          render: (status) => {
            const statusColors = {
              active: 'success',
              trial: 'info',
              expired: 'danger',
              cancelled: 'gray'
            };
            return AdminComponents.badge({
              text: status.charAt(0).toUpperCase() + status.slice(1),
              type: statusColors[status] || 'gray'
            });
          }
        },
        {
          label: 'Start Date',
          key: 'start_date',
          render: (date) =>DateFormatter.format(date)
        },
        {
          label: 'End Date',
          key: 'end_date',
          render: (date) =>DateFormatter.format(date)
        },
        {
          label: 'Trial End',
          key: 'trial_end_date',
          render: (date) =>DateFormatter.format(date)
        }
      ],
      data: subscriptions,
      actions: [
        {
          label: 'Cancel',
          className: 'btn-danger',
          onClick: (sub) => `AdminSubscriptions.cancelSubscription(${sub.id})`,
          disabled: (sub) => sub.status === 'cancelled' || sub.status === 'expired'
        }
      ]
    });

    document.getElementById('subscriptions-container').innerHTML = tableHTML;

    // Render pagination
    if (pagination && pagination.pages >1) {
      const paginationHTML = AdminComponents.pagination({
        currentPage: pagination.page,
        totalPages: pagination.pages,
        onPageChange: (page) => `AdminSubscriptions.goToPage(${page})`
      });
      document.getElementById('subscriptions-pagination').innerHTML = paginationHTML;
    }
  },

  /**
   * Load analytics
   */
  async loadAnalytics() {
    try {
      // Load metrics
      const response = await fetch('/api/admin/subscription-analytics');
      const data = await response.json();

      if (data.success) {
        this.renderAnalyticsMetrics(data.data);
        this.renderGrowthChart(data.data.growth || []);
      }

    } catch (error) {
    }
  },

  /**
   * Render analytics metrics: MRR per currency from every paying subscription (Stripe ones included),
   * and churn. The trends shown under them (+12%, -2%, +15%) and the lifetime value were made up.
   */
  renderAnalyticsMetrics(analytics) {
    const mrr = (analytics.mrr || []).map(entry => ({ amount: entry.mrr, currency: entry.currency }));
    document.getElementById('sub-metrics').replaceChildren(
      AdminComponents.metricCardEl('Monthly Recurring Revenue', AdminComponents.moneyText(mrr), 'Per currency'),
      AdminComponents.metricCardEl('Annual Run Rate',
        AdminComponents.moneyText(mrr.map(entry => ({ amount: entry.amount * 12, currency: entry.currency }))), 'MRR × 12'),
      AdminComponents.metricCardEl('Churn Rate', `${analytics.churn_rate || 0}%`, 'Cancelled in the last 30 days')
    );
  },

  /**
   * Render growth chart: subscriptions started per month, trials included
   */
  renderGrowthChart(growthData) {
    const body = document.getElementById('subscription-growth-body');
    if (!body) return;
    if (this.growthChart) {
      this.growthChart.destroy();
      this.growthChart = null;
    }
    if (growthData.length === 0) {
      body.replaceChildren(AdminComponents.noteEl('No subscription started in the last 6 months.'));
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.height = 80;
    body.replaceChildren(canvas);

    this.growthChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: growthData.map(d => d.month),
        datasets: [{
          label: 'Subscriptions started',
          data: growthData.map(d => d.count),
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
          y: { beginAtZero: true }
        }
      }
    });
  },

  /**
   * Handle filter change
   */
  handleFilter(event) {
    this.filterStatus = event.target.value;
    this.pagination.reset();
    this.loadSubscriptions();
  },

  /**
   * Go to page (delegates to PaginationManager)
   */
  goToPage(page) {
    this.pagination.goToPage(page);
  },

  /**
   * Show create plan modal
   */
  showCreatePlanModal() {
    const content = `
      <div>
        ${AdminComponents.formField({
          label: 'Plan Name',
          name: 'plan_name',
          required: true,
          placeholder: 'Premium Plan'
        })}

        ${AdminComponents.formField({
          label: 'Plan Code',
          name: 'plan_code',
          required: true,
          placeholder: 'PREMIUM_UK',
          help: 'Unique identifier for this plan'
        })}

        ${AdminComponents.formField({
          label: 'Region',
          name: 'region',
          type: 'select',
          required: true,
          options: [
            { value: '', label: 'Select Region' },
            { value: 'UK', label: 'United Kingdom' },
            { value: 'US', label: 'United States' },
            { value: 'India', label: 'India' },
            { value: 'Global', label: 'Global' }
          ]
        })}

        ${AdminComponents.formField({
          label: 'Currency',
          name: 'currency',
          type: 'select',
          required: true,
          options: [
            { value: '', label: 'Select Currency' },
            { value: 'GBP', label: 'GBP (£)' },
            { value: 'USD', label: 'USD ($)' },
            { value: 'INR', label: 'INR (₹)' }
          ]
        })}

        ${AdminComponents.formField({
          label: 'Monthly Price',
          name: 'price_monthly',
          type: 'number',
          required: true,
          placeholder: '29.99'
        })}

        ${AdminComponents.formField({
          label: 'Trial Days',
          name: 'trial_days',
          type: 'number',
          placeholder: '7',
          help: 'Number of trial days (0 for no trial)'
        })}
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="AdminComponents.closeModal('create-plan-modal')">Cancel</button>
      <button class="btn btn-primary" onclick="AdminSubscriptions.createPlan()">Create Plan</button>
    `;

    AdminComponents.modal({
      id: 'create-plan-modal',
      title: 'Create Subscription Plan',
      content,
      footer,
      size: 'medium'
    });
  },

  /**
   * Create subscription plan
   */
  async createPlan() {
    const planData = {
      plan_name: document.querySelector('[name="plan_name"]').value,
      plan_code: document.querySelector('[name="plan_code"]').value,
      region: document.querySelector('[name="region"]').value,
      currency: document.querySelector('[name="currency"]').value,
      price_monthly: parseFloat(document.querySelector('[name="price_monthly"]').value),
      trial_days: parseInt(document.querySelector('[name="trial_days"]').value) || 0
    };

    if (!planData.plan_name || !planData.plan_code || !planData.region || !planData.currency || !planData.price_monthly) {
      AdminComponents.alert({
        type: 'error',
        message: 'Please fill in all required fields',
        autoDismiss: 3000
      });
      return;
    }

    try {
      const response = await fetch('/api/admin/subscription-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planData)
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to create plan');
      }

      AdminComponents.closeModal('create-plan-modal');
      AdminComponents.alert({
        type: 'success',
        message: 'Plan created successfully',
        autoDismiss: 3000
      });

      this.loadPlans();

    } catch (error) {
      AdminComponents.alert({
        type: 'error',
        message: `Failed to create plan: ${error.message}`,
        autoDismiss: 5000
      });
    }
  },

  /**
   * Toggle plan status
   */
  async togglePlanStatus(planId, isActive) {
    try {
      const response = await fetch(`/api/admin/subscription-plans/${planId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to update plan status');
      }

      AdminComponents.alert({
        type: 'success',
        message: `Plan ${isActive ? 'activated' : 'deactivated'} successfully`,
        autoDismiss: 3000
      });

      this.loadPlans();

    } catch (error) {
      AdminComponents.alert({
        type: 'error',
        message: `Failed to update plan: ${error.message}`,
        autoDismiss: 5000
      });
    }
  },

  /**
   * Delete plan
   */
  async deletePlan(planId) {
    if (!confirm('Are you sure you want to delete this plan?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/subscription-plans/${planId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to delete plan');
      }

      AdminComponents.alert({
        type: 'success',
        message: 'Plan deleted successfully',
        autoDismiss: 3000
      });

      this.loadPlans();

    } catch (error) {
      AdminComponents.alert({
        type: 'error',
        message: `Failed to delete plan: ${error.message}`,
        autoDismiss: 5000
      });
    }
  },

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId) {
    if (!confirm('Are you sure you want to cancel this subscription?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST'
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to cancel subscription');
      }

      AdminComponents.alert({
        type: 'success',
        message: 'Subscription cancelled successfully',
        autoDismiss: 3000
      });

      this.loadSubscriptions();

    } catch (error) {
      AdminComponents.alert({
        type: 'error',
        message: `Failed to cancel subscription: ${error.message}`,
        autoDismiss: 5000
      });
    }
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.AdminSubscriptions = AdminSubscriptions;
}
