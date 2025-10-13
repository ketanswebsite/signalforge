/**
 * Account Page JavaScript
 * Manages subscription and payment information
 */

class AccountPage {
    constructor() {
        this.subscription = null;
        this.payments = [];

        this.init();
    }

    async init() {
        try {
            await Promise.all([
                this.loadSubscription(),
                this.loadPaymentHistory()
            ]);

            this.setupEventListeners();
        } catch (error) {
            console.error('Account page initialization error:', error);
        }
    }

    async loadSubscription() {
        try {
            const response = await fetch('/api/user/subscription');
            const data = await response.json();

            const contentDiv = document.getElementById('subscription-content');
            const statusBadge = document.getElementById('subscription-status-badge');

            if (data.success && data.hasSubscription) {
                this.subscription = data.subscription;
                this.renderSubscription();
                this.renderStatusBadge(statusBadge);
            } else {
                contentDiv.innerHTML = this.renderNoSubscription();
            }
        } catch (error) {
            console.error('Error loading subscription:', error);
            document.getElementById('subscription-content').innerHTML = this.renderError('Failed to load subscription');
        }
    }

    async loadPaymentHistory() {
        try {
            const response = await fetch('/api/user/payments');
            const data = await response.json();

            const contentDiv = document.getElementById('payment-history-content');

            if (data.success && data.payments && data.payments.length > 0) {
                this.payments = data.payments;
                this.renderPaymentHistory();
            } else {
                contentDiv.innerHTML = this.renderEmptyPayments();
            }
        } catch (error) {
            console.error('Error loading payment history:', error);
            document.getElementById('payment-history-content').innerHTML = this.renderError('Failed to load payment history');
        }
    }

    renderSubscription() {
        const sub = this.subscription;
        const isTrial = sub.status === 'trial';
        const isCancelled = sub.status === 'cancelled';
        const isActive = sub.status === 'active';
        const isExpired = sub.status === 'expired';

        const currencySymbol = this.getCurrencySymbol(sub.currency);
        const nextBillingDate = new Date(sub.subscription_end_date);
        const daysUntilRenewal = Math.ceil((nextBillingDate - new Date()) / (1000 * 60 * 60 * 24));

        let alertHTML = '';
        if (isTrial) {
            alertHTML = `
                <div class="alert alert-info">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    <div>
                        <strong>Free Trial Active</strong><br>
                        You have ${daysUntilRenewal} days remaining in your trial. No payment required until ${nextBillingDate.toLocaleDateString()}.
                    </div>
                </div>
            `;
        } else if (isCancelled) {
            alertHTML = `
                <div class="alert alert-warning">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <div>
                        <strong>Subscription Cancelled</strong><br>
                        You'll continue to have access until ${nextBillingDate.toLocaleDateString()}. You can reactivate anytime before this date.
                        ${sub.cancellation_reason ? `<br><small>Reason: ${sub.cancellation_reason}</small>` : ''}
                    </div>
                </div>
            `;
        } else if (isExpired) {
            alertHTML = `
                <div class="alert alert-danger">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                    <div>
                        <strong>Subscription Expired</strong><br>
                        Your subscription expired on ${nextBillingDate.toLocaleDateString()}. Renew now to regain access to all features.
                    </div>
                </div>
            `;
        }

        const html = `
            ${alertHTML}

            <div class="subscription-card">
                <div class="plan-name-large">${sub.plan_name}</div>
                ${sub.amount_paid > 0 ? `
                    <div class="plan-price-large">
                        ${currencySymbol}${sub.amount_paid.toFixed(2)} / ${sub.billing_period || 'month'}
                    </div>
                ` : ''}

                <div class="detail-grid">
                    <div class="detail-row">
                        <span class="detail-label">Status</span>
                        <span class="detail-value">${this.formatStatus(sub.status)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Start Date</span>
                        <span class="detail-value">${new Date(sub.subscription_start_date).toLocaleDateString()}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">${isTrial ? 'Trial Ends' : (isCancelled || isExpired) ? 'Access Until' : 'Next Billing Date'}</span>
                        <span class="detail-value">${nextBillingDate.toLocaleDateString()}</span>
                    </div>
                    ${sub.billing_period ? `
                    <div class="detail-row">
                        <span class="detail-label">Billing Period</span>
                        <span class="detail-value">${sub.billing_period.charAt(0).toUpperCase() + sub.billing_period.slice(1)}</span>
                    </div>
                    ` : ''}
                    ${sub.auto_renew !== undefined ? `
                    <div class="detail-row">
                        <span class="detail-label">Auto-Renew</span>
                        <span class="detail-value">${sub.auto_renew ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    ` : ''}
                </div>
            </div>

            ${this.renderSubscriptionActions()}
        `;

        document.getElementById('subscription-content').innerHTML = html;
    }

    renderSubscriptionActions() {
        const sub = this.subscription;
        const isTrial = sub.status === 'trial';
        const isCancelled = sub.status === 'cancelled';
        const isActive = sub.status === 'active';
        const isExpired = sub.status === 'expired';

        let actionsHTML = '<div class="btn-group">';

        if (isExpired) {
            actionsHTML += `
                <a href="/pricing.html" class="btn btn-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="1 4 1 10 7 10"/>
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                    </svg>
                    Renew Subscription
                </a>
            `;
        } else if (isCancelled) {
            actionsHTML += `
                <button class="btn btn-primary" id="reactivate-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23 4 23 10 17 10"/>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                    </svg>
                    Reactivate Subscription
                </button>
            `;
        } else if (isActive || isTrial) {
            actionsHTML += `
                <a href="/pricing.html" class="btn btn-secondary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                        <line x1="12" y1="2" x2="12" y2="22"/>
                    </svg>
                    Change Plan
                </a>
                <button class="btn btn-danger" id="cancel-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                    Cancel Subscription
                </button>
            `;
        }

        actionsHTML += '</div>';
        return actionsHTML;
    }

    renderPaymentHistory() {
        const tableHTML = `
            <table class="payment-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Transaction ID</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.payments.map(payment => `
                        <tr>
                            <td>${new Date(payment.payment_date).toLocaleDateString()}</td>
                            <td>${payment.plan_name || 'SignalForge Subscription'}</td>
                            <td>${this.getCurrencySymbol(payment.currency)}${payment.amount.toFixed(2)}</td>
                            <td>
                                <span class="payment-status ${payment.status}">
                                    ${this.formatPaymentStatus(payment.status)}
                                </span>
                            </td>
                            <td class="font-mono text-sm text-muted">
                                ${payment.transaction_id ? payment.transaction_id.substring(0, 12) + '...' : 'N/A'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        document.getElementById('payment-history-content').innerHTML = tableHTML;
    }

    renderStatusBadge(container) {
        const sub = this.subscription;
        const statusClass = sub.status === 'trial' ? 'trial' :
                           sub.status === 'active' ? 'active' :
                           sub.status === 'cancelled' ? 'cancelled' : 'expired';

        container.innerHTML = `
            <div class="status-badge ${statusClass}">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                </svg>
                ${this.formatStatus(sub.status)}
            </div>
        `;
    }

    renderNoSubscription() {
        return `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <p>You don't have an active subscription</p>
                <a href="/pricing.html" class="btn btn-primary mt-2">
                    View Plans
                </a>
            </div>
        `;
    }

    renderEmptyPayments() {
        return `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                    <line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
                <p>No payment history available</p>
            </div>
        `;
    }

    renderError(message) {
        return `
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p>${message}</p>
                <button class="btn btn-secondary mt-2" onclick="location.reload()">
                    Retry
                </button>
            </div>
        `;
    }

    setupEventListeners() {
        // Cancel subscription button
        const cancelBtn = document.getElementById('cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                document.getElementById('cancel-modal').classList.add('active');
            });
        }

        // Confirm cancellation
        const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
        if (confirmCancelBtn) {
            confirmCancelBtn.addEventListener('click', () => {
                this.cancelSubscription();
            });
        }

        // Reactivate subscription button
        const reactivateBtn = document.getElementById('reactivate-btn');
        if (reactivateBtn) {
            reactivateBtn.addEventListener('click', () => {
                this.reactivateSubscription();
            });
        }
    }

    async cancelSubscription() {
        const reason = document.getElementById('cancel-reason').value.trim();
        const confirmBtn = document.getElementById('confirm-cancel-btn');

        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Cancelling...';

        try {
            const response = await fetch('/api/user/subscription/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason })
            });

            const data = await response.json();

            if (data.success) {
                // Close modal
                document.getElementById('cancel-modal').classList.remove('active');

                // Show success message
                alert('Your subscription has been cancelled successfully. You will continue to have access until ' + new Date(data.accessUntil).toLocaleDateString());

                // Reload subscription details
                await this.loadSubscription();
            } else {
                throw new Error(data.error?.message || 'Failed to cancel subscription');
            }
        } catch (error) {
            console.error('Error cancelling subscription:', error);
            alert('Failed to cancel subscription: ' + error.message);
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirm Cancellation';
        }
    }

    async reactivateSubscription() {
        const reactivateBtn = document.getElementById('reactivate-btn');

        if (!confirm('Are you sure you want to reactivate your subscription?')) {
            return;
        }

        reactivateBtn.disabled = true;
        reactivateBtn.textContent = 'Reactivating...';

        try {
            const response = await fetch('/api/user/subscription/reactivate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (data.success) {
                alert('Your subscription has been reactivated successfully!');
                await this.loadSubscription();
            } else {
                throw new Error(data.error?.message || 'Failed to reactivate subscription');
            }
        } catch (error) {
            console.error('Error reactivating subscription:', error);
            alert('Failed to reactivate subscription: ' + error.message);
            reactivateBtn.disabled = false;
            reactivateBtn.textContent = 'Reactivate Subscription';
        }
    }

    getCurrencySymbol(currency) {
        const symbols = {
            'GBP': '£',
            'USD': '$',
            'INR': '₹',
            'EUR': '€'
        };
        return symbols[currency] || '$';
    }

    formatStatus(status) {
        const statusMap = {
            'active': 'Active',
            'trial': 'Free Trial',
            'cancelled': 'Cancelled',
            'expired': 'Expired',
            'pending': 'Pending'
        };
        return statusMap[status] || status;
    }

    formatPaymentStatus(status) {
        const statusMap = {
            'completed': 'Completed',
            'success': 'Success',
            'pending': 'Pending',
            'failed': 'Failed',
            'refunded': 'Refunded'
        };
        return statusMap[status] || status;
    }
}

// Initialize account page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new AccountPage();
});
