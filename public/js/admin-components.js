/**
 * Admin UI Components Library
 * Reusable components for admin portal
 */

const AdminComponents = {
  /**
   * Create metric card
   */
  metricCard({ title, value, change, changeType = 'positive', icon, loading = false }) {
    const changeClass = changeType === 'positive' ? 'metric-change-positive' : 'metric-change-negative';
    const changeIcon = changeType === 'positive' ? '↑' : '↓';

    return `
      <div class="metric-card ${loading ? 'loading' : ''}">
        ${icon ? `<div class="metric-icon">${icon}</div>` : ''}
        <div class="metric-content">
          <div class="metric-title">${title}</div>
          <div class="metric-value">${loading ? '<div class="skeleton skeleton-text"></div>' : value}</div>
          ${change ? `<div class="metric-change ${changeClass}">${changeIcon} ${change}</div>` : ''}
        </div>
      </div>
    `;
  },

  /**
   * Create data table
   */
  dataTable({ columns, data, actions = [], emptyMessage = 'No data available', loading = false }) {
    if (loading) {
      return `
        <div class="data-table loading">
          <div class="skeleton skeleton-table"></div>
        </div>
      `;
    }

    if (data.length === 0) {
      return `
        <div class="data-table-empty">
          <div class="empty-icon">📋</div>
          <p>${emptyMessage}</p>
        </div>
      `;
    }

    const headers = columns.map(col => `<th>${col.label}</th>`).join('');
    const actionsHeader = actions.length > 0 ? '<th class="actions-column">Actions</th>' : '';

    const rows = data.map(row => {
      const cells = columns.map(col => {
        const value = col.render ? col.render(row[col.key], row) : row[col.key];
        return `<td data-label="${col.label}">${value || '-'}</td>`;
      }).join('');

      const actionButtons = actions.map(action => {
        const disabled = action.disabled && action.disabled(row) ? 'disabled' : '';
        const className = action.className || 'btn-secondary';
        return `<button class="btn btn-sm ${className}" onclick="${action.onClick(row)}" ${disabled}>${action.label}</button>`;
      }).join('');

      const actionsCell = actions.length > 0 ? `<td class="actions-column">${actionButtons}</td>` : '';

      return `<tr>${cells}${actionsCell}</tr>`;
    }).join('');

    return `
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>${headers}${actionsHeader}</tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  },

  /**
   * Create modal
   */
  modal({ id, title, content, footer, size = 'medium', onClose }) {
    const existingModal = document.getElementById(id);
    if (existingModal) {
      existingModal.remove();
    }

    const modalHTML = `
      <div class="modal-overlay" id="${id}">
        <div class="modal-dialog modal-${size}">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
            <button class="modal-close" onclick="AdminComponents.closeModal('${id}')">&times;</button>
          </div>
          <div class="modal-body">
            ${content}
          </div>
          ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add close on overlay click
    document.getElementById(id).addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.closeModal(id);
        if (onClose) onClose();
      }
    });

    // Add escape key handler
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeModal(id);
        if (onClose) onClose();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);

    return id;
  },

  /**
   * Close modal
   */
  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.remove();
    }
  },

  /**
   * Create alert
   */
  alert({ type = 'info', message, dismissible = true, icon, autoDismiss = 0 }) {
    const icons = {
      success: '✓',
      error: '✗',
      warning: '⚠',
      info: 'ℹ'
    };

    const alertIcon = icon || icons[type];
    const alertId = 'alert-' + Date.now();

    const alertHTML = `
      <div class="alert alert-${type} ${dismissible ? 'alert-dismissible' : ''}" id="${alertId}">
        <div class="alert-content">
          ${alertIcon ? `<span class="alert-icon">${alertIcon}</span>` : ''}
          <span class="alert-message">${message}</span>
        </div>
        ${dismissible ? `<button class="alert-dismiss" onclick="AdminComponents.dismissAlert('${alertId}')">&times;</button>` : ''}
      </div>
    `;

    const container = document.getElementById('alert-container') || this.createAlertContainer();
    container.insertAdjacentHTML('beforeend', alertHTML);

    if (autoDismiss > 0) {
      setTimeout(() => this.dismissAlert(alertId), autoDismiss);
    }

    return alertId;
  },

  /**
   * Create alert container if it doesn't exist
   */
  createAlertContainer() {
    const container = document.createElement('div');
    container.id = 'alert-container';
    container.className = 'alert-container';
    document.body.appendChild(container);
    return container;
  },

  /**
   * Dismiss alert
   */
  dismissAlert(id) {
    const alert = document.getElementById(id);
    if (alert) {
      alert.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => alert.remove(), 300);
    }
  },

  /**
   * Create badge
   */
  badge({ text, type = 'default', size = 'medium' }) {
    return `<span class="badge badge-${type} badge-${size}">${text}</span>`;
  },

  /**
   * Create status indicator
   */
  statusIndicator({ status, text }) {
    const statusMap = {
      active: { color: 'success', label: 'Active' },
      inactive: { color: 'danger', label: 'Inactive' },
      pending: { color: 'warning', label: 'Pending' },
      cancelled: { color: 'gray', label: 'Cancelled' },
      trial: { color: 'info', label: 'Trial' },
      expired: { color: 'danger', label: 'Expired' }
    };

    const statusInfo = statusMap[status] || { color: 'default', label: text || status };

    return `
      <div class="status-indicator">
        <span class="status-dot status-${statusInfo.color}"></span>
        <span class="status-text">${text || statusInfo.label}</span>
      </div>
    `;
  },

  /**
   * Create loading spinner
   */
  spinner({ size = 'medium', text }) {
    return `
      <div class="spinner-container spinner-${size}">
        <div class="spinner"></div>
        ${text ? `<p class="spinner-text">${text}</p>` : ''}
      </div>
    `;
  },

  /**
   * Create progress bar
   */
  progressBar({ value, max = 100, label, color = 'primary' }) {
    const percentage = (value / max) * 100;

    return `
      <div class="progress-bar-container">
        ${label ? `<div class="progress-label">${label}</div>` : ''}
        <div class="progress-bar">
          <div class="progress-fill progress-${color}" style="width: ${percentage}%"></div>
        </div>
        <div class="progress-value">${value}/${max}</div>
      </div>
    `;
  },

  /**
   * Create form field
   */
  formField({ type = 'text', name, label, value = '', placeholder = '', required = false, disabled = false, options = [], help }) {
    const requiredAttr = required ? 'required' : '';
    const disabledAttr = disabled ? 'disabled' : '';
    const fieldId = 'field-' + name;

    let input;

    if (type === 'select') {
      const optionsHTML = options.map(opt =>
        `<option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>`
      ).join('');

      input = `<select class="form-control" id="${fieldId}" name="${name}" ${requiredAttr} ${disabledAttr}>${optionsHTML}</select>`;
    } else if (type === 'textarea') {
      input = `<textarea class="form-control" id="${fieldId}" name="${name}" placeholder="${placeholder}" ${requiredAttr} ${disabledAttr}>${value}</textarea>`;
    } else if (type === 'checkbox') {
      input = `
        <div class="form-checkbox">
          <input type="checkbox" id="${fieldId}" name="${name}" ${value ? 'checked' : ''} ${disabledAttr}>
          <label for="${fieldId}">${label}</label>
        </div>
      `;
    } else {
      input = `<input type="${type}" class="form-control" id="${fieldId}" name="${name}" value="${value}" placeholder="${placeholder}" ${requiredAttr} ${disabledAttr}>`;
    }

    return `
      <div class="form-field">
        ${type !== 'checkbox' && label ? `<label for="${fieldId}" class="form-label">${label} ${required ? '<span class="required">*</span>' : ''}</label>` : ''}
        ${input}
        ${help ? `<small class="form-help">${help}</small>` : ''}
      </div>
    `;
  },

  /**
   * Create pagination
   */
  pagination({ currentPage, totalPages, onPageChange }) {
    if (totalPages <= 1) return '';

    const pages = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    const pageButtons = pages.map(page => {
      if (page === '...') {
        return '<span class="pagination-ellipsis">...</span>';
      }

      const isActive = page === currentPage;
      return `
        <button
          class="pagination-btn ${isActive ? 'active' : ''}"
          onclick="${onPageChange(page)}"
          ${isActive ? 'disabled' : ''}
        >${page}</button>
      `;
    }).join('');

    return `
      <div class="pagination">
        <button
          class="pagination-btn"
          onclick="${onPageChange(currentPage - 1)}"
          ${currentPage === 1 ? 'disabled' : ''}
        >← Previous</button>
        ${pageButtons}
        <button
          class="pagination-btn"
          onclick="${onPageChange(currentPage + 1)}"
          ${currentPage === totalPages ? 'disabled' : ''}
        >Next →</button>
      </div>
    `;
  },

  /**
   * Create activity feed item
   */
  activityItem({ icon, title, description, timestamp, user }) {
    const timeAgo = this.timeAgo(new Date(timestamp));

    return `
      <div class="activity-item">
        <div class="activity-icon">${icon}</div>
        <div class="activity-content">
          <div class="activity-title">${title}</div>
          <div class="activity-description">${description}</div>
          <div class="activity-meta">
            ${user ? `<span class="activity-user">${user}</span> • ` : ''}
            <span class="activity-time">${timeAgo}</span>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Time ago helper
   */
  timeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
      second: 1
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
      }
    }

    return 'just now';
  },

  /**
   * Format currency
   */
  formatCurrency(amount, currency = 'GBP') {
    const symbols = {
      GBP: '£',
      USD: '$',
      INR: '₹',
      EUR: '€'
    };

    const symbol = symbols[currency] || currency;
    return `${symbol}${parseFloat(amount).toFixed(2)}`;
  },

  /**
   * Format number
   */
  formatNumber(num) {
    return new Intl.NumberFormat().format(num);
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.AdminComponents = AdminComponents;
}
