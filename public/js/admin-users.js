/**
 * Admin User Management Module
 * Handles user listing, search, filtering, and bulk actions
 */

const AdminUsers = {
  // Store current state
  currentPage: 1,
  pageSize: 50,
  searchQuery: '',
  filterStatus: 'all',
  sortBy: 'first_login',
  sortOrder: 'desc',
  selectedUsers: new Set(),

  /**
   * Initialize user management page
   */
  async init() {
    // Check if we're on the admin-v2 page with existing HTML structure
    const existingContainer = document.getElementById('users-table-container');
    const searchInput = document.getElementById('user-search');

    if (existingContainer && searchInput) {
      // Use existing HTML structure - don't replace
      this.setupExistingEventListeners();
      await this.loadUsers();
    } else {
      // Fallback: render complete UI for standalone use
      this.render();
      await this.loadUsers();
    }
  },

  /**
   * Setup event listeners for existing HTML structure
   */
  setupExistingEventListeners() {
    const searchInput = document.getElementById('user-search');
    if (searchInput) {
      searchInput.addEventListener('keyup', (e) => this.handleSearch(e));
    }
  },

  /**
   * Render user management UI
   */
  render() {
    const container = document.getElementById('users-page');
    container.innerHTML = `
      <!-- Header with Actions -->
      <div class="admin-card">
        <div class="admin-card-header flex-between">
          <h2 class="admin-card-title">User Management</h2>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" onclick="AdminUsers.exportUsers()">
              📥 Export
            </button>
            <button class="btn btn-primary btn-sm" onclick="AdminUsers.showAddUserModal()">
              ➕ Add User
            </button>
          </div>
        </div>

        <!-- Search and Filters -->
        <div class="admin-card-body">
          <div class="flex gap-2 mb-2">
            <input
              type="text"
              class="form-control"
              placeholder="Search users by email or name..."
              id="user-search"
              value="${this.searchQuery}"
              onkeyup="AdminUsers.handleSearch(event)"
            >
            <select class="form-control" id="user-filter" onchange="AdminUsers.handleFilter(event)">
              <option value="all" ${this.filterStatus === 'all' ? 'selected' : ''}>All Users</option>
              <option value="active" ${this.filterStatus === 'active' ? 'selected' : ''}>Active</option>
              <option value="telegram" ${this.filterStatus === 'telegram' ? 'selected' : ''}>Telegram Users</option>
              <option value="oauth" ${this.filterStatus === 'oauth' ? 'selected' : ''}>OAuth Users</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Bulk Actions Bar (hidden by default) -->
      <div id="bulk-actions-bar"  class="admin-card mb-2">
        <div class="admin-card-body flex-between">
          <div>
            <span id="selected-count">0</span> users selected
          </div>
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" onclick="AdminUsers.clearSelection()">Clear</button>
            <button class="btn btn-warning btn-sm" onclick="AdminUsers.bulkSuspend()">Suspend</button>
            <button class="btn btn-success btn-sm" onclick="AdminUsers.bulkActivate()">Activate</button>
            <button class="btn btn-danger btn-sm" onclick="AdminUsers.bulkDelete()">Delete</button>
          </div>
        </div>
      </div>

      <!-- Users Table -->
      <div class="admin-card">
        <div class="admin-card-body">
          <div id="users-table-container">
            ${AdminComponents.spinner({ text: 'Loading users...' })}
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div id="users-pagination"></div>
    `;
  },

  /**
   * Load users from API
   */
  async loadUsers() {
    try {
      const params = new URLSearchParams({
        page: this.currentPage,
        limit: this.pageSize,
        sort: this.sortBy,
        order: this.sortOrder
      });

      if (this.searchQuery) {
        params.append('search', this.searchQuery);
      }

      if (this.filterStatus !== 'all') {
        params.append('filter', this.filterStatus);
      }

      const response = await fetch(`/api/admin/users?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to load users');
      }

      this.renderUsersTable(data.data.items, data.data.pagination);

    } catch (error) {
      document.getElementById('users-table-container').innerHTML = `
        <div class="text-center text-muted">
          <p>Failed to load users</p>
          <button class="btn btn-primary btn-sm" onclick="AdminUsers.loadUsers()">Retry</button>
        </div>
      `;
    }
  },

  /**
   * Render users table
   */
  renderUsersTable(users, pagination) {
    const tableHTML = AdminComponents.dataTable({
      columns: [
        {
          label: '<input type="checkbox" onchange="AdminUsers.toggleAll(event)">',
          key: 'select',
          render: (_, user) => `<input type="checkbox" class="user-checkbox" value="${user.email}" onchange="AdminUsers.toggleUser(event, '${user.email}')" ${this.selectedUsers.has(user.email) ? 'checked' : ''}>`
        },
        {
          label: 'Email',
          key: 'email',
          render: (email) => `<strong>${email}</strong>`
        },
        {
          label: 'Name',
          key: 'name',
          render: (name) => name || '-'
        },
        {
          label: 'First Login',
          key: 'first_login',
          render: (date) => date ? new Date(date).toLocaleDateString() : '-'
        },
        {
          label: 'Last Login',
          key: 'last_login',
          render: (date) => date ? new Date(date).toLocaleDateString() : '-'
        },
        {
          label: 'Telegram',
          key: 'telegram_chat_id',
          render: (chatId) => chatId ? AdminComponents.badge({ text: '✓ Connected', type: 'success' }) : AdminComponents.badge({ text: 'Not Connected', type: 'gray' })
        }
      ],
      data: users,
      actions: [
        {
          label: 'View',
          className: 'btn-secondary',
          onClick: (user) => `AdminUsers.viewUser('${user.email}')`
        },
        {
          label: 'Edit',
          className: 'btn-primary',
          onClick: (user) => `AdminUsers.editUser('${user.email}')`
        },
        {
          label: 'Delete',
          className: 'btn-danger',
          onClick: (user) => `AdminUsers.deleteUser('${user.email}')`
        }
      ]
    });

    document.getElementById('users-table-container').innerHTML = tableHTML;

    // Render pagination
    if (pagination && pagination.pages > 1) {
      const paginationHTML = AdminComponents.pagination({
        currentPage: pagination.page,
        totalPages: pagination.pages,
        onPageChange: (page) => `AdminUsers.goToPage(${page})`
      });
      document.getElementById('users-pagination').innerHTML = paginationHTML;
    } else {
      document.getElementById('users-pagination').innerHTML = '';
    }
  },

  /**
   * Handle search input
   */
  handleSearch(event) {
    this.searchQuery = event.target.value;
    this.currentPage = 1;

    // Debounce search
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.loadUsers();
    }, 500);
  },

  /**
   * Handle filter change
   */
  handleFilter(event) {
    this.filterStatus = event.target.value;
    this.currentPage = 1;
    this.loadUsers();
  },

  /**
   * Go to page
   */
  goToPage(page) {
    this.currentPage = page;
    this.loadUsers();
  },

  /**
   * Toggle user selection
   */
  toggleUser(event, email) {
    if (event.target.checked) {
      this.selectedUsers.add(email);
    } else {
      this.selectedUsers.delete(email);
    }
    this.updateBulkActionsBar();
  },

  /**
   * Toggle all users
   */
  toggleAll(event) {
    const checkboxes = document.querySelectorAll('.user-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.checked = event.target.checked;
      if (event.target.checked) {
        this.selectedUsers.add(checkbox.value);
      } else {
        this.selectedUsers.delete(checkbox.value);
      }
    });
    this.updateBulkActionsBar();
  },

  /**
   * Update bulk actions bar
   */
  updateBulkActionsBar() {
    const bar = document.getElementById('bulk-actions-bar');
    const count = document.getElementById('selected-count');

    if (this.selectedUsers.size > 0) {
      bar
      count.textContent = this.selectedUsers.size;
    } else {
      bar
    }
  },

  /**
   * Clear selection
   */
  clearSelection() {
    this.selectedUsers.clear();
    const checkboxes = document.querySelectorAll('.user-checkbox');
    checkboxes.forEach(checkbox => checkbox.checked = false);
    this.updateBulkActionsBar();
  },

  /**
   * View user details
   */
  async viewUser(email) {
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(email)}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to load user');
      }

      const user = data.data;
      this.showUserModal(user, 'view');

    } catch (error) {
      AdminComponents.alert({
        type: 'error',
        message: `Failed to load user: ${error.message}`,
        autoDismiss: 5000
      });
    }
  },

  /**
   * Edit user
   */
  async editUser(email) {
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(email)}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to load user');
      }

      const user = data.data;
      this.showUserModal(user, 'edit');

    } catch (error) {
      AdminComponents.alert({
        type: 'error',
        message: `Failed to load user: ${error.message}`,
        autoDismiss: 5000
      });
    }
  },

  /**
   * Show user modal
   */
  showUserModal(user, mode = 'view') {
    const isEditable = mode === 'edit';
    const title = mode === 'view' ? 'User Details' : 'Edit User';

    const content = `
      <div>
        ${AdminComponents.formField({
          label: 'Email',
          name: 'email',
          value: user.email,
          disabled: true
        })}

        ${AdminComponents.formField({
          label: 'Name',
          name: 'name',
          value: user.name || '',
          disabled: !isEditable
        })}

        ${AdminComponents.formField({
          label: 'First Login',
          name: 'first_login',
          value: user.first_login ? new Date(user.first_login).toLocaleString() : 'Never',
          disabled: true
        })}

        ${AdminComponents.formField({
          label: 'Last Login',
          name: 'last_login',
          value: user.last_login ? new Date(user.last_login).toLocaleString() : 'Never',
          disabled: true
        })}

        ${AdminComponents.formField({
          label: 'Telegram Chat ID',
          name: 'telegram_chat_id',
          value: user.telegram_chat_id || 'Not connected',
          disabled: true
        })}
      </div>
    `;

    const footer = isEditable ?
      `<button class="btn btn-secondary" onclick="AdminComponents.closeModal('user-modal')">Cancel</button>
       <button class="btn btn-primary" onclick="AdminUsers.saveUser('${user.email}')">Save</button>` :
      `<button class="btn btn-secondary" onclick="AdminComponents.closeModal('user-modal')">Close</button>`;

    AdminComponents.modal({
      id: 'user-modal',
      title,
      content,
      footer,
      size: 'medium'
    });
  },

  /**
   * Save user changes
   */
  async saveUser(email) {
    const name = document.querySelector('[name="name"]').value;

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(email)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to update user');
      }

      AdminComponents.closeModal('user-modal');
      AdminComponents.alert({
        type: 'success',
        message: 'User updated successfully',
        autoDismiss: 3000
      });

      this.loadUsers();

    } catch (error) {
      AdminComponents.alert({
        type: 'error',
        message: `Failed to update user: ${error.message}`,
        autoDismiss: 5000
      });
    }
  },

  /**
   * Delete user
   */
  async deleteUser(email) {
    if (!confirm(`Are you sure you want to delete user ${email}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(email)}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to delete user');
      }

      AdminComponents.alert({
        type: 'success',
        message: 'User deleted successfully',
        autoDismiss: 3000
      });

      this.loadUsers();

    } catch (error) {
      AdminComponents.alert({
        type: 'error',
        message: `Failed to delete user: ${error.message}`,
        autoDismiss: 5000
      });
    }
  },

  /**
   * Bulk actions
   */
  async bulkSuspend() {
    AdminComponents.alert({
      type: 'info',
      message: `Suspending ${this.selectedUsers.size} users...`,
      autoDismiss: 3000
    });
    // TODO: Implement bulk suspend API
  },

  async bulkActivate() {
    AdminComponents.alert({
      type: 'info',
      message: `Activating ${this.selectedUsers.size} users...`,
      autoDismiss: 3000
    });
    // TODO: Implement bulk activate API
  },

  async bulkDelete() {
    if (!confirm(`Are you sure you want to delete ${this.selectedUsers.size} users?`)) {
      return;
    }

    AdminComponents.alert({
      type: 'info',
      message: `Deleting ${this.selectedUsers.size} users...`,
      autoDismiss: 3000
    });
    // TODO: Implement bulk delete API
  },

  /**
   * Export users
   */
  async exportUsers() {
    AdminComponents.alert({
      type: 'info',
      message: 'Exporting users to CSV...',
      autoDismiss: 3000
    });
    // TODO: Implement export functionality
  },

  /**
   * Show add user modal
   */
  showAddUserModal() {
    const content = `
      <div>
        ${AdminComponents.formField({
          label: 'Email',
          name: 'new_email',
          type: 'email',
          required: true,
          placeholder: 'user@example.com'
        })}

        ${AdminComponents.formField({
          label: 'Name',
          name: 'new_name',
          required: true,
          placeholder: 'John Doe'
        })}
      </div>
    `;

    const footer = `
      <button class="btn btn-secondary" onclick="AdminComponents.closeModal('add-user-modal')">Cancel</button>
      <button class="btn btn-primary" onclick="AdminUsers.createUser()">Create User</button>
    `;

    AdminComponents.modal({
      id: 'add-user-modal',
      title: 'Add New User',
      content,
      footer,
      size: 'medium'
    });
  },

  /**
   * Create new user
   */
  async createUser() {
    const email = document.querySelector('[name="new_email"]').value;
    const name = document.querySelector('[name="new_name"]').value;

    if (!email || !name) {
      AdminComponents.alert({
        type: 'error',
        message: 'Please fill in all required fields',
        autoDismiss: 3000
      });
      return;
    }

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to create user');
      }

      AdminComponents.closeModal('add-user-modal');
      AdminComponents.alert({
        type: 'success',
        message: 'User created successfully',
        autoDismiss: 3000
      });

      this.loadUsers();

    } catch (error) {
      AdminComponents.alert({
        type: 'error',
        message: `Failed to create user: ${error.message}`,
        autoDismiss: 5000
      });
    }
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.AdminUsers = AdminUsers;
}
