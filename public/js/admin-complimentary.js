/**
 * Admin Complimentary Access Management
 * Handles granting, revoking, and managing complimentary access for users
 */

const AdminComplimentary = {
    /**
     * Initialize complimentary access management
     */
    init() {
        console.log('Initializing Complimentary Access Management');
        this.setupEventListeners();
        this.loadComplimentaryUsers();
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Access type selector - show/hide expiry date field
        const accessTypeSelect = document.getElementById('comp-access-type');
        const expiryGroup = document.getElementById('comp-expiry-group');

        if (accessTypeSelect && expiryGroup) {
            accessTypeSelect.addEventListener('change', (e) => {
                if (e.target.value === 'temporary') {
                    expiryGroup.classList.remove('hidden');
                } else {
                    expiryGroup.classList.add('hidden');
                }
            });
        }
    },

    /**
     * Grant complimentary access to a user
     */
    async grantAccess() {
        const email = document.getElementById('comp-user-email').value.trim();
        const accessType = document.getElementById('comp-access-type').value;
        const expiryDate = document.getElementById('comp-expiry-date').value;
        const reason = document.getElementById('comp-reason').value.trim();
        const statusEl = document.getElementById('comp-grant-status');

        // Validation
        if (!email) {
            this.showStatus(statusEl, 'Please enter a user email', 'error');
            return;
        }

        if (!reason) {
            this.showStatus(statusEl, 'Please provide a reason for granting access', 'error');
            return;
        }

        if (accessType === 'temporary' && !expiryDate) {
            this.showStatus(statusEl, 'Please select an expiry date for temporary access', 'error');
            return;
        }

        // Prepare request body
        const body = {
            type: accessType,
            expiryDate: accessType === 'temporary' ? expiryDate : null,
            reason: reason,
            grantedBy: 'Admin' // Will be set by backend to actual admin email
        };

        try {
            statusEl.className = 'status-message loading';
            statusEl.innerHTML = '<span class="material-icons rotating">refresh</span> Granting access...';

            const response = await fetch(`/api/admin/users/${encodeURIComponent(email)}/grant-access`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showStatus(statusEl, `Successfully granted ${accessType} access to ${email}`, 'success');

                // Clear form
                document.getElementById('comp-user-email').value = '';
                document.getElementById('comp-reason').value = '';
                document.getElementById('comp-expiry-date').value = '';

                // Refresh list
                setTimeout(() => {
                    this.loadComplimentaryUsers();
                }, 1000);
            } else {
                const errorMsg = data.error?.message || data.error || 'Failed to grant access';
                this.showStatus(statusEl, errorMsg, 'error');
            }
        } catch (error) {
            console.error('Error granting access:', error);
            this.showStatus(statusEl, 'An error occurred while granting access', 'error');
        }
    },

    /**
     * Revoke complimentary access from a user
     */
    async revokeAccess(email) {
        if (!confirm(`Are you sure you want to revoke complimentary access for ${email}?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/users/${encodeURIComponent(email)}/revoke-access`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            const data = await response.json();

            if (response.ok && data.success) {
                alert(`Successfully revoked complimentary access for ${email}`);
                this.loadComplimentaryUsers();
            } else {
                const errorMsg = data.error?.message || data.error || 'Failed to revoke access';
                alert(`Error: ${errorMsg}`);
            }
        } catch (error) {
            console.error('Error revoking access:', error);
            alert('An error occurred while revoking access');
        }
    },

    /**
     * Load list of users with complimentary access
     */
    async loadComplimentaryUsers() {
        await ApiClient.fetchAndRender({
            endpoint: '/api/admin/users/complimentary',
            containerId: 'complimentary-users-container',
            renderFn: (data) => this.renderComplimentaryUsers(data.users),
            retryFn: 'AdminComplimentary.loadComplimentaryUsers()',
            loadingText: 'Loading...',
            errorMessage: 'Failed to load complimentary users'
        });
    },

    /**
     * Render complimentary users table
     */
    renderComplimentaryUsers(users) {
        const container = document.getElementById('complimentary-users-container');

        if (!users || users.length === 0) {
            container.innerHTML = '<div class="empty-state"><span class="material-icons">person_off</span> No users with complimentary access</div>';
            return;
        }

        const tableHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Email</th>
                        <th>Access Type</th>
                        <th>Expiry Date</th>
                        <th>Reason</th>
                        <th>Granted By</th>
                        <th>Granted At</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => this.renderComplimentaryUserRow(user)).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = tableHTML;
    },

    /**
     * Render a single complimentary user row
     */
    renderComplimentaryUserRow(user) {
        const isLifetime = !user.complimentary_until;
        const expiryDate = DateFormatter.format(user.complimentary_until, 'Never');
        const grantedAt = DateFormatter.format(user.granted_at, 'N/A');
        const accessType = isLifetime ? 'Lifetime' : 'Temporary';
        const accessClass = isLifetime ? 'badge-success' : 'badge-warning';

        // Check if temporary access has expired
        const isExpired = !isLifetime && user.complimentary_until && new Date(user.complimentary_until) < new Date();
        const expiryClass = isExpired ? 'text-error' : '';

        return `
            <tr>
                <td><strong>${this.escapeHtml(user.email)}</strong></td>
                <td><span class="badge ${accessClass}">${accessType}</span></td>
                <td class="${expiryClass}">${expiryDate}</td>
                <td>${this.escapeHtml(user.complimentary_reason || 'N/A')}</td>
                <td>${this.escapeHtml(user.granted_by || 'N/A')}</td>
                <td>${grantedAt}</td>
                <td>
                    <button class="btn-danger btn-small" onclick="AdminComplimentary.revokeAccess('${this.escapeHtml(user.email)}')">
                        <span class="material-icons">block</span>
                        Revoke
                    </button>
                </td>
            </tr>
        `;
    },

    /**
     * Refresh complimentary users list
     */
    refresh() {
        this.loadComplimentaryUsers();
    },

    /**
     * Show status message
     */
    showStatus(element, message, type = 'info') {
        if (!element) return;

        const icons = {
            success: 'check_circle',
            error: 'error',
            info: 'info',
            loading: 'refresh'
        };

        element.className = `status-message ${type}`;
        element.innerHTML = `<span class="material-icons">${icons[type]}</span> ${message}`;

        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                element.style.opacity = '0';
                setTimeout(() => {
                    element.innerHTML = '';
                    element.style.opacity = '1';
                }, 300);
            }, 5000);
        }
    },

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Initialize when Users tab is opened
// This will be called by the tab switching logic in admin-v2.html
