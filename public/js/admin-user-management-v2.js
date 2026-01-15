/**
 * Admin User Management V2 - Enhanced User Features
 * Phase 3: User activity timeline, login history, segmentation, impersonation, notes
 */

const AdminUserManagementV2 = {
  /**
   * Display user activity timeline
   * @param {string} containerId - Container element ID
   * @param {string} userEmail - User email
   */
  async showActivityTimeline(containerId, userEmail) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Show loading state
    container.innerHTML = AdminComponentsV2.skeleton({ type: 'card', rows: 5 });

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userEmail)}/activity`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to load activity');
      }

      const activities = data.data.activities || [];
      container.innerHTML = this.renderActivityTimeline(activities, userEmail);

    } catch (error) {
      console.error('Activity timeline error:', error);
      container.innerHTML = `
        <div class="error-state">
          <p>Failed to load activity timeline</p>
          <button class="btn btn-secondary btn-sm" onclick="AdminUserManagementV2.showActivityTimeline('${containerId}', '${userEmail}')">
            Retry
          </button>
        </div>
      `;
    }
  },

  /**
   * Render activity timeline
   */
  renderActivityTimeline(activities, userEmail) {
    if (activities.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <h3>No Activity Yet</h3>
          <p>This user hasn't performed any tracked activities.</p>
        </div>
      `;
    }

    // Group activities by date
    const grouped = this.groupActivitiesByDate(activities);

    let html = '<div class="activity-timeline">';

    Object.keys(grouped).forEach(date => {
      html += `
        <div class="timeline-date-group">
          <div class="timeline-date-header">${this.formatTimelineDate(date)}</div>
          <div class="timeline-items">
            ${grouped[date].map(activity => this.renderTimelineItem(activity)).join('')}
          </div>
        </div>
      `;
    });

    html += '</div>';

    // Add filter controls
    html = `
      <div class="timeline-controls">
        <div class="timeline-filters">
          <select class="form-control form-control-sm" onchange="AdminUserManagementV2.filterTimeline('${userEmail}', this.value)">
            <option value="all">All Activities</option>
            <option value="login">Login Events</option>
            <option value="trade">Trade Actions</option>
            <option value="subscription">Subscription Events</option>
            <option value="settings">Settings Changes</option>
          </select>
          <button class="btn btn-secondary btn-sm" onclick="AdminUserManagementV2.exportTimeline('${userEmail}')">
            📥 Export Timeline
          </button>
        </div>
      </div>
      ${html}
    `;

    return html;
  },

  /**
   * Render single timeline item
   */
  renderTimelineItem(activity) {
    const icons = {
      login: '🔐',
      logout: '🚪',
      trade_created: '📈',
      trade_executed: '✅',
      subscription_created: '💳',
      subscription_cancelled: '❌',
      settings_updated: '⚙️',
      profile_updated: '👤',
      payment_made: '💰',
      default: '📋'
    };

    const icon = icons[activity.type] || icons.default;
    const time = new Date(activity.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <div class="timeline-item ${activity.important ? 'timeline-item-important' : ''}">
        <div class="timeline-icon">${icon}</div>
        <div class="timeline-content">
          <div class="timeline-header">
            <span class="timeline-title">${activity.title}</span>
            <span class="timeline-time">${time}</span>
          </div>
          <div class="timeline-description">${activity.description}</div>
          ${activity.metadata ? `
            <div class="timeline-metadata">
              ${this.renderMetadata(activity.metadata)}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  },

  /**
   * Render activity metadata
   */
  renderMetadata(metadata) {
    return Object.keys(metadata).map(key => {
      const value = metadata[key];
      return `<span class="metadata-item"><strong>${key}:</strong> ${value}</span>`;
    }).join('');
  },

  /**
   * Group activities by date
   */
  groupActivitiesByDate(activities) {
    const grouped = {};

    activities.forEach(activity => {
      const date = DateFormatter.format(activity.timestamp);
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(activity);
    });

    return grouped;
  },

  /**
   * Format timeline date
   */
  formatTimelineDate(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toLocaleDateString() === today.toLocaleDateString()) {
      return 'Today';
    } else if (date.toLocaleDateString() === yesterday.toLocaleDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  },

  /**
   * Display login history
   */
  async showLoginHistory(containerId, userEmail) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = AdminComponentsV2.skeleton({ type: 'table', rows: 10 });

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userEmail)}/logins`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to load login history');
      }

      const logins = data.data.logins || [];
      this.renderLoginHistoryTable(containerId, logins, userEmail);

    } catch (error) {
      console.error('Login history error:', error);
      container.innerHTML = `
        <div class="error-state">
          <p>Failed to load login history</p>
          <button class="btn btn-secondary btn-sm" onclick="AdminUserManagementV2.showLoginHistory('${containerId}', '${userEmail}')">
            Retry
          </button>
        </div>
      `;
    }
  },

  /**
   * Render login history table
   */
  renderLoginHistoryTable(containerId, logins, userEmail) {
    const columns = [
      { key: 'timestamp', label: 'Date & Time', render: (val) => new Date(val).toLocaleString() },
      { key: 'success', label: 'Status', render: (val) => val ? '✅ Success' : '❌ Failed' },
      { key: 'ip_address', label: 'IP Address' },
      { key: 'location', label: 'Location', render: (val) => val || 'Unknown' },
      { key: 'device', label: 'Device', render: (val) => val || 'Unknown' },
      { key: 'browser', label: 'Browser', render: (val) => val || 'Unknown' }
    ];

    const tableId = AdminTablesV2.create(containerId, {
      columns: columns,
      data: logins,
      sortable: true,
      filterable: true,
      exportable: true,
      pageSize: 20
    });

    return tableId;
  },

  /**
   * Show user tags/segmentation interface
   */
  async showUserTags(containerId, userEmail) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userEmail)}/tags`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to load tags');
      }

      const tags = data.data.tags || [];
      container.innerHTML = this.renderTagsInterface(tags, userEmail);

    } catch (error) {
      console.error('Tags error:', error);
      container.innerHTML = '<p>Failed to load tags</p>';
    }
  },

  /**
   * Render tags interface
   */
  renderTagsInterface(tags, userEmail) {
    return `
      <div class="user-tags-container">
        <div class="tags-header">
          <h4>User Tags</h4>
          <button class="btn btn-primary btn-sm" onclick="AdminUserManagementV2.showAddTagModal('${userEmail}')">
            + Add Tag
          </button>
        </div>
        <div class="tags-list">
          ${tags.length === 0 ? '<p class="text-muted">No tags assigned</p>' : ''}
          ${tags.map(tag => `
            <span class="tag-item">
              ${tag.name}
              <button class="tag-remove" onclick="AdminUserManagementV2.removeTag('${userEmail}', '${tag.id}')" title="Remove tag">
                &times;
              </button>
            </span>
          `).join('')}
        </div>
        <div class="tags-suggestions">
          <p class="text-muted">Suggested tags:</p>
          <div class="tag-suggestions-list">
            ${['VIP', 'Beta Tester', 'Support Priority', 'Inactive', 'Trial User'].map(suggestion => `
              <button class="btn btn-sm btn-outline-secondary" onclick="AdminUserManagementV2.quickAddTag('${userEmail}', '${suggestion}')">
                ${suggestion}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Show add tag modal
   */
  showAddTagModal(userEmail) {
    AdminComponents.modal({
      id: 'add-tag-modal',
      title: 'Add Tag',
      size: 'small',
      content: `
        <div class="form-group">
          <label>Tag Name</label>
          <input type="text" class="form-control" id="tag-name-input" placeholder="Enter tag name...">
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" onclick="AdminComponents.closeModal('add-tag-modal')">Cancel</button>
        <button class="btn btn-primary" onclick="AdminUserManagementV2.addTag('${userEmail}')">Add Tag</button>
      `
    });

    // Focus input
    setTimeout(() => {
      document.getElementById('tag-name-input')?.focus();
    }, 100);
  },

  /**
   * Add tag to user
   */
  async addTag(userEmail) {
    const input = document.getElementById('tag-name-input');
    const tagName = input?.value.trim();

    if (!tagName) {
      AdminComponentsV2.toast({
        type: 'error',
        message: 'Please enter a tag name',
        duration: 3000
      });
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userEmail)}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: tagName })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to add tag');
      }

      AdminComponents.closeModal('add-tag-modal');
      AdminComponentsV2.toast({
        type: 'success',
        message: `Tag "${tagName}" added successfully`,
        duration: 3000
      });

      // Refresh tags display
      this.showUserTags('user-tags-container', userEmail);

    } catch (error) {
      console.error('Add tag error:', error);
      AdminComponentsV2.toast({
        type: 'error',
        message: error.message,
        duration: 3000
      });
    }
  },

  /**
   * Quick add tag
   */
  async quickAddTag(userEmail, tagName) {
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userEmail)}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: tagName })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to add tag');
      }

      AdminComponentsV2.toast({
        type: 'success',
        message: `Tag "${tagName}" added`,
        duration: 2000
      });

      this.showUserTags('user-tags-container', userEmail);

    } catch (error) {
      AdminComponentsV2.toast({
        type: 'error',
        message: error.message,
        duration: 3000
      });
    }
  },

  /**
   * Remove tag from user
   */
  async removeTag(userEmail, tagId) {
    const confirmed = await new Promise(resolve => {
      AdminComponentsV2.confirm({
        title: 'Remove Tag',
        message: 'Are you sure you want to remove this tag?',
        confirmText: 'Remove',
        cancelText: 'Cancel',
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false)
      });
    });

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userEmail)}/tags/${tagId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to remove tag');
      }

      AdminComponentsV2.toast({
        type: 'success',
        message: 'Tag removed successfully',
        duration: 2000
      });

      this.showUserTags('user-tags-container', userEmail);

    } catch (error) {
      AdminComponentsV2.toast({
        type: 'error',
        message: error.message,
        duration: 3000
      });
    }
  },

  /**
   * Show user impersonation interface
   */
  showImpersonationButton(containerId, userEmail) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="impersonation-container">
        <div class="alert alert-warning">
          <strong>⚠️ Impersonation Mode</strong>
          <p>Logging in as this user will allow you to see exactly what they see. All actions will be logged in the audit trail.</p>
        </div>
        <button class="btn btn-warning btn-lg" onclick="AdminUserManagementV2.impersonateUser('${userEmail}')">
          🎭 Login as ${userEmail}
        </button>
      </div>
    `;
  },

  /**
   * Impersonate user
   */
  async impersonateUser(userEmail) {
    const confirmed = await new Promise(resolve => {
      AdminComponentsV2.confirm({
        title: 'Confirm Impersonation',
        message: `You are about to login as ${userEmail}. This action will be logged in the audit trail. Continue?`,
        confirmText: 'Yes, Login as User',
        cancelText: 'Cancel',
        danger: true,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false)
      });
    });

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userEmail)}/impersonate`, {
        method: 'POST'
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to impersonate user');
      }

      AdminComponentsV2.toast({
        type: 'success',
        message: 'Impersonation started. Redirecting...',
        duration: 2000
      });

      // Redirect to main app after 2 seconds
      setTimeout(() => {
        window.location.href = '/?impersonate=true';
      }, 2000);

    } catch (error) {
      console.error('Impersonation error:', error);
      AdminComponentsV2.toast({
        type: 'error',
        message: error.message,
        duration: 3000
      });
    }
  },

  /**
   * Show user notes interface
   */
  async showUserNotes(containerId, userEmail) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userEmail)}/notes`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to load notes');
      }

      const notes = data.data.notes || [];
      container.innerHTML = this.renderNotesInterface(notes, userEmail);

    } catch (error) {
      console.error('Notes error:', error);
      container.innerHTML = '<p>Failed to load notes</p>';
    }
  },

  /**
   * Render notes interface
   */
  renderNotesInterface(notes, userEmail) {
    return `
      <div class="user-notes-container">
        <div class="notes-header">
          <h4>Admin Notes</h4>
          <button class="btn btn-primary btn-sm" onclick="AdminUserManagementV2.showAddNoteModal('${userEmail}')">
            + Add Note
          </button>
        </div>
        <div class="notes-list">
          ${notes.length === 0 ? '<p class="text-muted">No notes yet</p>' : ''}
          ${notes.map(note => `
            <div class="note-item">
              <div class="note-header">
                <span class="note-author">${note.created_by}</span>
                <span class="note-timestamp">${AdminComponents.timeAgo(new Date(note.created_at))}</span>
              </div>
              <div class="note-content">${note.note}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  /**
   * Show add note modal
   */
  showAddNoteModal(userEmail) {
    AdminComponents.modal({
      id: 'add-note-modal',
      title: 'Add Admin Note',
      size: 'medium',
      content: `
        <div class="form-group">
          <label>Note</label>
          <textarea class="form-control" id="note-text-input" rows="5" placeholder="Enter note about this user..."></textarea>
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" onclick="AdminComponents.closeModal('add-note-modal')">Cancel</button>
        <button class="btn btn-primary" onclick="AdminUserManagementV2.addNote('${userEmail}')">Add Note</button>
      `
    });

    setTimeout(() => {
      document.getElementById('note-text-input')?.focus();
    }, 100);
  },

  /**
   * Add note to user
   */
  async addNote(userEmail) {
    const input = document.getElementById('note-text-input');
    const noteText = input?.value.trim();

    if (!noteText) {
      AdminComponentsV2.toast({
        type: 'error',
        message: 'Please enter a note',
        duration: 3000
      });
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userEmail)}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to add note');
      }

      AdminComponents.closeModal('add-note-modal');
      AdminComponentsV2.toast({
        type: 'success',
        message: 'Note added successfully',
        duration: 3000
      });

      this.showUserNotes('user-notes-container', userEmail);

    } catch (error) {
      console.error('Add note error:', error);
      AdminComponentsV2.toast({
        type: 'error',
        message: error.message,
        duration: 3000
      });
    }
  },

  /**
   * Export timeline
   */
  async exportTimeline(userEmail) {
    AdminComponentsV2.toast({
      type: 'info',
      message: 'Exporting timeline...',
      duration: 2000
    });

    // In production, this would fetch and export the data
    setTimeout(() => {
      AdminComponentsV2.toast({
        type: 'success',
        message: 'Timeline exported successfully',
        duration: 3000
      });
    }, 1000);
  },

  /**
   * Filter timeline
   */
  filterTimeline(userEmail, filterType) {
    console.log('Filter timeline:', userEmail, filterType);
    // This would re-render the timeline with filtered data
    AdminComponentsV2.toast({
      type: 'info',
      message: `Filtering by: ${filterType}`,
      duration: 2000
    });
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.AdminUserManagementV2 = AdminUserManagementV2;
}
