/**
 * Admin RBAC - Role-Based Access Control
 * Phase 5: Advanced Features
 *
 * Features:
 * - Role management (create, edit, delete roles)
 * - Permission management
 * - User role assignment
 * - Access control checks
 * - Permission inheritance
 * - Role hierarchies
 *
 * Dependencies: AdminComponentsV2
 */

const AdminRBAC = {
    // State management
    state: {
        roles: [],
        permissions: [],
        userRoles: new Map(),
        currentUser: null
    },

    // Permission definitions
    permissions: {
        // User management
        'users.view': 'View users',
        'users.create': 'Create users',
        'users.edit': 'Edit users',
        'users.delete': 'Delete users',
        'users.impersonate': 'Impersonate users',

        // Subscription management
        'subscriptions.view': 'View subscriptions',
        'subscriptions.create': 'Create subscriptions',
        'subscriptions.edit': 'Edit subscriptions',
        'subscriptions.cancel': 'Cancel subscriptions',

        // Payment management
        'payments.view': 'View payments',
        'payments.refund': 'Process refunds',
        'payments.export': 'Export payment data',

        // Analytics
        'analytics.view': 'View analytics',
        'analytics.export': 'Export analytics data',
        'analytics.reports': 'Manage custom reports',

        // Database
        'database.view': 'View database',
        'database.query': 'Execute queries',
        'database.backup': 'Backup database',
        'database.restore': 'Restore database',

        // Settings
        'settings.view': 'View settings',
        'settings.edit': 'Edit settings',

        // Audit log
        'audit.view': 'View audit log',
        'audit.export': 'Export audit log',

        // System
        'system.admin': 'System administrator',
        'system.support': 'Support access'
    },

    // Default roles
    defaultRoles: {
        superadmin: {
            name: 'Super Admin',
            description: 'Full system access',
            permissions: ['*'], // All permissions
            color: '#ef4444',
            priority: 100
        },
        admin: {
            name: 'Admin',
            description: 'Administrative access',
            permissions: [
                'users.*',
                'subscriptions.*',
                'payments.*',
                'analytics.view',
                'analytics.export',
                'settings.view',
                'settings.edit',
                'audit.view'
            ],
            color: '#f97316',
            priority: 90
        },
        manager: {
            name: 'Manager',
            description: 'Management access',
            permissions: [
                'users.view',
                'users.edit',
                'subscriptions.view',
                'subscriptions.edit',
                'payments.view',
                'analytics.view',
                'audit.view'
            ],
            color: '#3b82f6',
            priority: 70
        },
        support: {
            name: 'Support',
            description: 'Customer support access',
            permissions: [
                'users.view',
                'users.edit',
                'subscriptions.view',
                'payments.view',
                'system.support'
            ],
            color: '#22c55e',
            priority: 50
        },
        analyst: {
            name: 'Analyst',
            description: 'Analytics and reporting',
            permissions: [
                'analytics.view',
                'analytics.export',
                'analytics.reports',
                'users.view',
                'subscriptions.view',
                'payments.view'
            ],
            color: '#8b5cf6',
            priority: 40
        },
        viewer: {
            name: 'Viewer',
            description: 'Read-only access',
            permissions: [
                'users.view',
                'subscriptions.view',
                'payments.view',
                'analytics.view'
            ],
            color: '#6b7280',
            priority: 10
        }
    },

    /**
     * Initialize RBAC system
     */
    async init() {
        console.log('[RBAC] Initializing RBAC system...');

        try {
            // Load roles and permissions
            await this.loadRoles();
            await this.loadUserRoles();

            // Set current user
            await this.loadCurrentUser();

            console.log('[RBAC] RBAC system initialized');
        } catch (error) {
            console.error('[RBAC] Failed to initialize:', error);
        }
    },

    /**
     * Load roles from backend
     */
    async loadRoles() {
        try {
            const response = await fetch('/api/admin/rbac/roles');

            if (!response.ok) {
                // Use default roles if backend not ready
                this.state.roles = Object.entries(this.defaultRoles).map(([id, role]) => ({
                    id,
                    ...role
                }));
                return;
            }

            const data = await response.json();
            this.state.roles = data.roles || [];
        } catch (error) {
            console.error('[RBAC] Error loading roles:', error);
            // Fallback to default roles
            this.state.roles = Object.entries(this.defaultRoles).map(([id, role]) => ({
                id,
                ...role
            }));
        }
    },

    /**
     * Load user roles
     */
    async loadUserRoles() {
        try {
            const response = await fetch('/api/admin/rbac/user-roles');

            if (response.ok) {
                const data = await response.json();
                this.state.userRoles = new Map(Object.entries(data.userRoles || {}));
            }
        } catch (error) {
            console.error('[RBAC] Error loading user roles:', error);
        }
    },

    /**
     * Load current user info
     */
    async loadCurrentUser() {
        try {
            const response = await fetch('/api/admin/current-user');

            if (response.ok) {
                const data = await response.json();
                this.state.currentUser = data.user;
            }
        } catch (error) {
            console.error('[RBAC] Error loading current user:', error);
        }
    },

    /**
     * Check if current user has permission
     * @param {string} permission - Permission to check
     * @returns {boolean} - Has permission
     */
    hasPermission(permission) {
        if (!this.state.currentUser) return false;

        const userRoles = this.getUserRoles(this.state.currentUser.email);

        for (const roleId of userRoles) {
            if (this.roleHasPermission(roleId, permission)) {
                return true;
            }
        }

        return false;
    },

    /**
     * Check if role has permission
     * @param {string} roleId - Role ID
     * @param {string} permission - Permission to check
     * @returns {boolean} - Has permission
     */
    roleHasPermission(roleId, permission) {
        const role = this.state.roles.find(r => r.id === roleId);
        if (!role) return false;

        // Check for wildcard (all permissions)
        if (role.permissions.includes('*')) return true;

        // Check for exact match
        if (role.permissions.includes(permission)) return true;

        // Check for wildcard category (e.g., users.*)
        const category = permission.split('.')[0];
        if (role.permissions.includes(`${category}.*`)) return true;

        return false;
    },

    /**
     * Get user roles
     * @param {string} userEmail - User email
     * @returns {Array} - Array of role IDs
     */
    getUserRoles(userEmail) {
        return this.state.userRoles.get(userEmail) || [];
    },

    /**
     * Assign role to user
     * @param {string} userEmail - User email
     * @param {string} roleId - Role ID
     */
    async assignRole(userEmail, roleId) {
        try {
            const response = await fetch('/api/admin/rbac/assign-role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userEmail, roleId })
            });

            if (!response.ok) {
                throw new Error('Failed to assign role');
            }

            // Update local state
            const currentRoles = this.getUserRoles(userEmail);
            if (!currentRoles.includes(roleId)) {
                currentRoles.push(roleId);
                this.state.userRoles.set(userEmail, currentRoles);
            }

            AdminComponentsV2.toast({
                type: 'success',
                message: 'Role assigned successfully'
            });
        } catch (error) {
            console.error('[RBAC] Error assigning role:', error);
            AdminComponentsV2.toast({
                type: 'error',
                message: `Failed to assign role: ${error.message}`
            });
        }
    },

    /**
     * Remove role from user
     * @param {string} userEmail - User email
     * @param {string} roleId - Role ID
     */
    async removeRole(userEmail, roleId) {
        try {
            const response = await fetch('/api/admin/rbac/remove-role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userEmail, roleId })
            });

            if (!response.ok) {
                throw new Error('Failed to remove role');
            }

            // Update local state
            const currentRoles = this.getUserRoles(userEmail);
            const index = currentRoles.indexOf(roleId);
            if (index > -1) {
                currentRoles.splice(index, 1);
                this.state.userRoles.set(userEmail, currentRoles);
            }

            AdminComponentsV2.toast({
                type: 'success',
                message: 'Role removed successfully'
            });
        } catch (error) {
            console.error('[RBAC] Error removing role:', error);
            AdminComponentsV2.toast({
                type: 'error',
                message: `Failed to remove role: ${error.message}`
            });
        }
    },

    /**
     * Show role management UI
     * @param {string} containerId - Container element ID
     */
    async showRoleManagement(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="rbac-container">
                <!-- Header -->
                <div class="rbac-header">
                    <h2>Role Management</h2>
                    <button class="btn btn-primary" onclick="AdminRBAC.showCreateRoleDialog()">
                        ➕ Create Role
                    </button>
                </div>

                <!-- Roles Grid -->
                <div class="roles-grid" id="roles-grid">
                    ${AdminComponentsV2.skeleton({ type: 'card', rows: 3 })}
                </div>
            </div>
        `;

        // Load and render roles
        await this.loadRoles();
        this.renderRoles();
    },

    /**
     * Render roles grid
     */
    renderRoles() {
        const container = document.getElementById('roles-grid');
        if (!container) return;

        const html = this.state.roles.map(role => `
            <div class="role-card" style="border-left: 4px solid ${role.color}">
                <div class="role-card-header">
                    <div>
                        <h3 class="role-name">${role.name}</h3>
                        <span class="role-badge" style="background: ${role.color}">
                            Priority: ${role.priority}
                        </span>
                    </div>
                    <div class="role-actions">
                        <button class="btn-icon" onclick="AdminRBAC.editRole('${role.id}')" title="Edit">
                            ✏️
                        </button>
                        <button class="btn-icon" onclick="AdminRBAC.deleteRole('${role.id}')" title="Delete">
                            🗑️
                        </button>
                    </div>
                </div>
                <div class="role-card-body">
                    <p class="role-description">${role.description}</p>
                    <div class="role-permissions">
                        <strong>Permissions (${role.permissions.length}):</strong>
                        <div class="permission-tags">
                            ${role.permissions.slice(0, 5).map(perm =>
                                `<span class="permission-tag">${perm}</span>`
                            ).join('')}
                            ${role.permissions.length > 5 ?
                                `<span class="permission-tag">+${role.permissions.length - 5} more</span>` :
                                ''
                            }
                        </div>
                    </div>
                    <div class="role-stats">
                        <span>👥 ${this.getRoleUserCount(role.id)} users</span>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    },

    /**
     * Get user count for role
     * @param {string} roleId - Role ID
     * @returns {number} - User count
     */
    getRoleUserCount(roleId) {
        let count = 0;
        for (const roles of this.state.userRoles.values()) {
            if (roles.includes(roleId)) count++;
        }
        return count;
    },

    /**
     * Show create role dialog
     */
    showCreateRoleDialog() {
        const permissionCheckboxes = Object.entries(this.permissions)
            .map(([key, label]) => `
                <label class="permission-checkbox">
                    <input type="checkbox" name="permission" value="${key}">
                    <span>${label}</span>
                </label>
            `).join('');

        const modal = AdminComponentsV2.modal({
            title: 'Create New Role',
            content: `
                <form id="create-role-form" class="role-form">
                    <div class="form-group">
                        <label for="role-name">Role Name *</label>
                        <input type="text" id="role-name" required>
                    </div>

                    <div class="form-group">
                        <label for="role-description">Description</label>
                        <textarea id="role-description" rows="3"></textarea>
                    </div>

                    <div class="form-group">
                        <label for="role-color">Color</label>
                        <input type="color" id="role-color" value="#3b82f6">
                    </div>

                    <div class="form-group">
                        <label for="role-priority">Priority (0-100)</label>
                        <input type="number" id="role-priority" min="0" max="100" value="50">
                    </div>

                    <div class="form-group">
                        <label>Permissions *</label>
                        <div class="permissions-list">
                            ${permissionCheckboxes}
                        </div>
                    </div>
                </form>
            `,
            actions: [
                {
                    text: 'Cancel',
                    variant: 'secondary',
                    onClick: () => modal.close()
                },
                {
                    text: 'Create Role',
                    variant: 'primary',
                    onClick: () => this.saveRole(null, modal)
                }
            ]
        });

        modal.show();
    },

    /**
     * Save role (create or update)
     */
    async saveRole(roleId, modal) {
        const form = document.getElementById('create-role-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const name = document.getElementById('role-name').value;
        const description = document.getElementById('role-description').value;
        const color = document.getElementById('role-color').value;
        const priority = parseInt(document.getElementById('role-priority').value);

        const permissions = Array.from(document.querySelectorAll('input[name="permission"]:checked'))
            .map(cb => cb.value);

        if (permissions.length === 0) {
            AdminComponentsV2.toast({
                type: 'error',
                message: 'Please select at least one permission'
            });
            return;
        }

        const roleData = {
            id: roleId || name.toLowerCase().replace(/\s+/g, '_'),
            name,
            description,
            color,
            priority,
            permissions
        };

        try {
            const url = roleId ? `/api/admin/rbac/roles/${roleId}` : '/api/admin/rbac/roles';
            const method = roleId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(roleData)
            });

            if (!response.ok) {
                throw new Error('Failed to save role');
            }

            AdminComponentsV2.toast({
                type: 'success',
                message: `Role ${roleId ? 'updated' : 'created'} successfully`
            });

            modal.close();
            await this.loadRoles();
            this.renderRoles();
        } catch (error) {
            AdminComponentsV2.toast({
                type: 'error',
                message: `Failed to save role: ${error.message}`
            });
        }
    },

    /**
     * Edit role
     */
    editRole(roleId) {
        // TODO: Implement edit role dialog
        console.log('Edit role:', roleId);
    },

    /**
     * Delete role
     */
    async deleteRole(roleId) {
        const confirmed = await AdminComponentsV2.confirm({
            title: 'Delete Role',
            message: 'Are you sure you want to delete this role? Users with this role will lose their permissions.',
            danger: true
        });

        if (!confirmed) return;

        try {
            const response = await fetch(`/api/admin/rbac/roles/${roleId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete role');
            }

            AdminComponentsV2.toast({
                type: 'success',
                message: 'Role deleted successfully'
            });

            await this.loadRoles();
            this.renderRoles();
        } catch (error) {
            AdminComponentsV2.toast({
                type: 'error',
                message: `Failed to delete role: ${error.message}`
            });
        }
    },

    /**
     * Show user role assignment UI
     */
    showUserRoleAssignment(userEmail) {
        const userRoles = this.getUserRoles(userEmail);

        const roleOptions = this.state.roles.map(role => {
            const isAssigned = userRoles.includes(role.id);
            return `
                <div class="role-option ${isAssigned ? 'assigned' : ''}">
                    <div class="role-option-info">
                        <div class="role-option-name" style="border-left: 3px solid ${role.color}">
                            ${role.name}
                        </div>
                        <div class="role-option-description">${role.description}</div>
                    </div>
                    <button class="btn btn-sm ${isAssigned ? 'btn-danger' : 'btn-primary'}"
                            onclick="AdminRBAC.${isAssigned ? 'removeRole' : 'assignRole'}('${userEmail}', '${role.id}')">
                        ${isAssigned ? 'Remove' : 'Assign'}
                    </button>
                </div>
            `;
        }).join('');

        const modal = AdminComponentsV2.modal({
            title: `Manage Roles: ${userEmail}`,
            content: `
                <div class="user-roles-container">
                    <div class="current-roles">
                        <h4>Current Roles</h4>
                        ${userRoles.length > 0 ?
                            userRoles.map(roleId => {
                                const role = this.state.roles.find(r => r.id === roleId);
                                return role ? `
                                    <span class="role-badge" style="background: ${role.color}">
                                        ${role.name}
                                    </span>
                                ` : '';
                            }).join('') :
                            '<p class="text-muted">No roles assigned</p>'
                        }
                    </div>
                    <div class="available-roles">
                        <h4>Available Roles</h4>
                        ${roleOptions}
                    </div>
                </div>
            `,
            size: 'large'
        });

        modal.show();
    }
};

// Make available globally
window.AdminRBAC = AdminRBAC;
