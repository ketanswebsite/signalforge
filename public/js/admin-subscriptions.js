/**
 * Admin Subscription Management Module
 * Handles subscription plans, active subscriptions, and lifecycle management
 */

const AdminSubscriptions = {
  // Store current state
  currentTab: 'plans',
  currentPage: 1,
  pageSize: 50,
  filterStatus: 'all',
  sortBy: 'created_at',
  sortOrder: 'desc',

  /**
   * Initialize subscription management page
   */
  async init() {
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
              📋 Plans
            </button>
            <button class="btn ${this.currentTab === 'subscriptions' ? 'btn-primary' : 'btn-secondary'}" onclick="AdminSubscriptions.switchTab('subscriptions')">
              💳 Active Subscriptions
            </button>
            <button class="btn ${this.currentTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}" onclick="AdminSubscriptions.switchTab('analytics')">
              📊 Analytics
            </button>
          </div>
        </div>
      </div>

      <!-- Plans Tab -->
      <div id="plans-tab" style="display: ${this.currentTab === 'plans' ? 'block' : 'none'};">
        <div class="admin-card">
          <div class="admin-card-header flex-between">
            <h2 class="admin-card-title">Subscription Plans</h2>
            <button class="btn btn-primary btn-sm" onclick="AdminSubscriptions.showCreatePlanModal()">
              ➕ Create Plan
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
      <div id="subscriptions-tab" style="display: ${this.currentTab === 'subscriptions' ? 'block' : 'none'};">
        <div class="admin-card">
          <div class="admin-card-header flex-between">
            <h2 class="admin-card-title">Active Subscriptions</h2>
            <div class="flex gap-2">
              <select class="form-control" id="sub-filter" onchange="AdminSubscriptions.handleFilter(event)" style="width: 200px;">
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
      <div id="analytics-tab" style="display: ${this.currentTab === 'analytics' ? 'block' : 'none'};">
        <div class="metrics-grid" id="sub-metrics">
          ${AdminComponents.spinner({ text: 'Loading analytics...' })}
        </div>

        <div class="admin-card mt-2">
          <div class="admin-card-header">
            <h2 class="admin-card-title">Subscription Growth</h2>
          </div>
          <div class="admin-card-body">
            <canvas id="subscription-growth-chart" height="80"></canvas>
          </div>
        </div>

        <div class="admin-card mt-2">
          <div class="admin-card-header">
            <h2 class="admin-card-title">Cohort Retention</h2>
          </div>
          <div class="admin-card-body">
            <div id="cohort-retention-container">
              <p class="text-muted">Cohort retention analysis coming soon...</p>
            </div>
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
    document.getElementById('plans-tab').style.display = 'none';
    document.getElementById('subscriptions-tab').style.display = 'none';
    document.getElementById('analytics-tab').style.display = 'none';

    // Show selected tab
    document.getElementById(`${tab}-tab`).style.display = 'block';

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
    try {
      const response = await fetch('/api/admin/subscription-plans');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to load plans');
      }

      this.renderPlans(data.data.plans || []);

    } catch (error) {
      console.error('Failed to load plans:', error);
      document.getElementById('plans-container').innerHTML = `
        <div class="text-center text-muted">
          <p>Failed to load plans</p>
          <button class="btn btn-primary btn-sm" onclick="AdminSubscriptions.loadPlans()">Retry</button>
        </div>
      `;
    }
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
          <div class="admin-card" style="border: 2px solid ${plan.is_active ? '#10b981' : '#d1d5db'};">
            <div class="admin-card-header flex-between">
              <h3 class="admin-card-title">${plan.plan_name}</h3>
              ${plan.is_active ?
                AdminComponents.badge({ text: 'Active', type: 'success' }) :
                AdminComponents.badge({ text: 'Inactive', type: 'gray' })
              }
            </div>
            <div class="admin-card-body">
              <div class="metric-value">${AdminComponents.formatCurrency(plan.price_monthly || 0, plan.currency || 'GBP')}</div>
              <div class="text-muted" style="font-size: 0.875rem;">/month</div>

              <div class="mt-2">
                <div class="text-muted" style="font-size: 0.875rem;">
                  <strong>Code:</strong> ${plan.plan_code}<br>
                  <strong>Region:</strong> ${plan.region}<br>
                  <strong>Subscribers:</strong> ${plan.subscriber_count || 0}
                </div>
              </div>

              <div class="mt-2 flex gap-1">
                <button class="btn btn-secondary btn-sm" onclick="AdminSubscriptions.editPlan(${plan.id})">Edit</button>
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
    try {
      const params = new URLSearchParams({
        page: this.currentPage,
        limit: this.pageSize
      });

      if (this.filterStatus !== 'all') {
        params.append('status', this.filterStatus);
      }

      const response = await fetch(`/api/admin/subscriptions?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to load subscriptions');
      }

      this.renderSubscriptions(data.data.items || [], data.data.pagination);

    } catch (error) {
      console.error('Failed to load subscriptions:', error);
      document.getElementById('subscriptions-container').innerHTML = `
        <div class="text-center text-muted">
          <p>Failed to load subscriptions</p>
          <button class="btn btn-primary btn-sm" onclick="AdminSubscriptions.loadSubscriptions()">Retry</button>
        </div>
      `;
    }
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
          key: 'plan_id',
          render: (planId) => `Plan ${planId}` // TODO: Map to plan name
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
          key: 'subscription_start_date',
          render: (date) => date ? new Date(date).toLocaleDateString() : '-'
        },
        {
          label: 'End Date',
          key: 'subscription_end_date',
          render: (date) => date ? new Date(date).toLocaleDateString() : '-'
        },
        {
          label: 'Trial End',
          key: 'trial_end_date',
          render: (date) => date ? new Date(date).toLocaleDateString() : '-'
        }
      ],
      data: subscriptions,
      actions: [
        {
          label: 'View',
          className: 'btn-secondary',
          onClick: (sub) => `AdminSubscriptions.viewSubscription(${sub.id})`
        },
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
    if (pagination && pagination.pages > 1) {
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
      console.error('Failed to load analytics:', error);
    }
  },

  /**
   * Render analytics metrics
   */
  renderAnalyticsMetrics(analytics) {
    const metricsHTML = `
      ${AdminComponents.metricCard({
        title: 'Monthly Recurring Revenue',
        value: AdminComponents.formatCurrency(analytics.mrr || 0, 'GBP'),
        change: analytics.mrr_change || '+0%',
        changeType: 'positive',
        icon: '💰'
      })}
      ${AdminComponents.metricCard({
        title: 'Annual Recurring Revenue',
        value: AdminComponents.formatCurrency((analytics.mrr || 0) * 12, 'GBP'),
        change: analytics.arr_change || '+0%',
        changeType: 'positive',
        icon: '📈'
      })}
      ${AdminComponents.metricCard({
        title: 'Churn Rate',
        value: (analytics.churn_rate || 0) + '%',
        change: analytics.churn_change || '-0%',
        changeType: 'negative',
        icon: '📉'
      })}
      ${AdminComponents.metricCard({
        title: 'Avg. LTV',
        value: AdminComponents.formatCurrency(analytics.avg_ltv || 0, 'GBP'),
        change: analytics.ltv_change || '+0%',
        changeType: 'positive',
        icon: '💎'
      })}
    `;

    document.getElementById('sub-metrics').innerHTML = metricsHTML;
  },

  /**
   * Render growth chart
   */
  renderGrowthChart(growthData) {
    const ctx = document.getElementById('subscription-growth-chart');
    if (!ctx) return;

    // Sample data if no real data
    const labels = growthData.length > 0 ? growthData.map(d => d.month) : [];
    const data = growthData.length > 0 ? growthData.map(d => d.count) : [];

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length > 0 ? labels : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{
          label: 'Active Subscriptions',
          data: data.length > 0 ? data : [5, 8, 12, 15, 20, 25],
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
    this.currentPage = 1;
    this.loadSubscriptions();
  },

  /**
   * Go to page
   */
  goToPage(page) {
    this.currentPage = page;
    this.loadSubscriptions();
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
   * Edit plan
   */
  async editPlan(planId) {
    AdminComponents.alert({
      type: 'info',
      message: 'Edit plan functionality coming soon...',
      autoDismiss: 3000
    });
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
   * View subscription details
   */
  async viewSubscription(subscriptionId) {
    AdminComponents.alert({
      type: 'info',
      message: 'View subscription details coming soon...',
      autoDismiss: 3000
    });
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
