/**
 * Admin UI Components Library V2
 * Enhanced components for modern admin portal
 * Phase 2: UI/UX Improvements
 */

const AdminComponentsV2 = {
  /**
   * Enhanced Metric Card with Sparkline and Trends
   * @param {Object} options - Card options
   * @param {string} options.title - Card title
   * @param {string|number} options.value - Main metric value
   * @param {string} options.change - Change text (e.g., "+12%")
   * @param {string} options.changeType - "positive" or "negative"
   * @param {string} options.icon - Emoji icon
   * @param {Array} options.sparklineData - Array of numbers for mini chart
   * @param {string} options.comparison - Comparison text (e.g., "vs last month")
   * @param {Function} options.onClick - Click handler for drill-down
   * @param {boolean} options.loading - Loading state
   */
  enhancedMetricCard({
    title,
    value,
    change,
    changeType = 'positive',
    icon,
    sparklineData = [],
    comparison = '',
    onClick,
    loading = false
  }) {
    const changeClass = changeType === 'positive' ? 'metric-change-positive' : 'metric-change-negative';
    const changeIcon = changeType === 'positive' ? '↑' : '↓';
    const sparklineId = 'sparkline-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const clickable = onClick ? 'metric-card-clickable' : '';

    const cardHTML = `
      <div class="metric-card metric-card-enhanced ${clickable} ${loading ? 'loading' : ''}"
           ${onClick ? `onclick="${onClick}"` : ''}>
        ${icon ? `<div class="metric-icon">${icon}</div>` : ''}
        <div class="metric-content">
          <div class="metric-title">${title}</div>
          <div class="metric-value ${loading ? 'skeleton skeleton-text' : ''}"
               data-final-value="${value}">
            ${loading ? '' : value}
          </div>
          ${change ? `
            <div class="metric-change ${changeClass}">
              <span class="metric-change-icon">${changeIcon}</span>
              <span class="metric-change-text">${change}</span>
              ${comparison ? `<span class="metric-comparison">${comparison}</span>` : ''}
            </div>
          ` : ''}
        </div>
        ${sparklineData.length > 0 ? `
          <div class="sparkline-container">
            <canvas id="${sparklineId}" class="sparkline" width="100" height="30"></canvas>
          </div>
        ` : ''}
      </div>
    `;

    // Render sparkline after DOM insertion
    if (sparklineData.length > 0) {
      setTimeout(() => this.renderSparkline(sparklineId, sparklineData, changeType), 0);
    }

    return cardHTML;
  },

  /**
   * Render sparkline mini chart
   */
  renderSparkline(canvasId, data, changeType = 'positive') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = 2;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate points
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    const points = data.map((val, i) => ({
      x: (i / (data.length - 1)) * (width - 2 * padding) + padding,
      y: height - padding - ((val - min) / range) * (height - 2 * padding)
    }));

    // Draw line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    points.forEach(point => {
      ctx.lineTo(point.x, point.y);
    });

    ctx.strokeStyle = changeType === 'positive' ? '#22C55E' : '#DC2626';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw area fill
    ctx.lineTo(points[points.length - 1].x, height);
    ctx.lineTo(points[0].x, height);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    if (changeType === 'positive') {
      gradient.addColorStop(0, 'rgba(34, 197, 94, 0.2)');
      gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(220, 38, 38, 0.2)');
      gradient.addColorStop(1, 'rgba(220, 38, 38, 0)');
    }
    ctx.fillStyle = gradient;
    ctx.fill();
  },

  /**
   * Animate counter from 0 to final value
   */
  animateCounter(elementId, finalValue, duration = 1000) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const startValue = 0;
    const startTime = Date.now();
    const isNumber = !isNaN(parseFloat(finalValue));

    if (!isNumber) {
      element.textContent = finalValue;
      return;
    }

    const numericValue = parseFloat(finalValue.toString().replace(/[^0-9.-]/g, ''));
    const prefix = finalValue.toString().match(/^[^0-9]*/)[0];
    const suffix = finalValue.toString().match(/[^0-9]*$/)[0];

    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);

      // Easing function (easeOutCubic)
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (numericValue - startValue) * eased;

      element.textContent = prefix + current.toFixed(2) + suffix;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        element.textContent = finalValue;
      }
    };

    requestAnimationFrame(animate);
  },

  /**
   * Toast Notification
   * @param {Object} options - Toast options
   */
  toast({
    type = 'info',
    message,
    duration = 3000,
    position = 'top-right',
    action = null
  }) {
    const icons = {
      success: '',
      error: '',
      warning: '',
      info: 'ℹ'
    };

    const toastId = 'toast-' + Date.now();
    const toastIcon = icons[type];

    const toastHTML = `
      <div class="toast toast-${type}" id="${toastId}">
        <div class="toast-content">
          <span class="toast-icon">${toastIcon}</span>
          <span class="toast-message">${message}</span>
        </div>
        ${action ? `
          <button class="toast-action" onclick="${action.onClick}">
            ${action.label}
          </button>
        ` : ''}
        <button class="toast-close" onclick="AdminComponentsV2.closeToast('${toastId}')">&times;</button>
      </div>
    `;

    let container = document.getElementById(`toast-container-${position}`);
    if (!container) {
      container = document.createElement('div');
      container.id = `toast-container-${position}`;
      container.className = `toast-container toast-${position}`;
      document.body.appendChild(container);
    }

    container.insertAdjacentHTML('beforeend', toastHTML);

    // Auto dismiss
    if (duration > 0) {
      setTimeout(() => this.closeToast(toastId), duration);
    }

    return toastId;
  },

  /**
   * Close toast
   */
  closeToast(id) {
    const toast = document.getElementById(id);
    if (toast) {
      toast.classList.add('toast-closing');
      setTimeout(() => toast.remove(), 300);
    }
  },

  /**
   * Confirmation Dialog
   */
  confirm({
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    danger = false,
    onConfirm,
    onCancel
  }) {
    const confirmId = 'confirm-' + Date.now();

    const confirmHTML = `
      <div class="confirm-overlay" id="${confirmId}">
        <div class="confirm-dialog ${danger ? 'confirm-danger' : ''}">
          <div class="confirm-header">
            <h3 class="confirm-title">${title}</h3>
          </div>
          <div class="confirm-body">
            <p class="confirm-message">${message}</p>
          </div>
          <div class="confirm-footer">
            <button class="btn btn-secondary" id="${confirmId}-cancel">
              ${cancelText}
            </button>
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="${confirmId}-confirm">
              ${confirmText}
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', confirmHTML);

    // Handle confirm
    document.getElementById(`${confirmId}-confirm`).addEventListener('click', async () => {
      if (onConfirm) {
        await onConfirm();
      }
      this.closeConfirm(confirmId);
    });

    // Handle cancel
    document.getElementById(`${confirmId}-cancel`).addEventListener('click', () => {
      if (onCancel) {
        onCancel();
      }
      this.closeConfirm(confirmId);
    });

    // Handle overlay click
    document.getElementById(confirmId).addEventListener('click', (e) => {
      if (e.target.classList.contains('confirm-overlay')) {
        if (onCancel) {
          onCancel();
        }
        this.closeConfirm(confirmId);
      }
    });

    // Handle escape key
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        if (onCancel) {
          onCancel();
        }
        this.closeConfirm(confirmId);
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  },

  /**
   * Close confirmation dialog
   */
  closeConfirm(id) {
    const confirm = document.getElementById(id);
    if (confirm) {
      confirm.remove();
    }
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.AdminComponentsV2 = AdminComponentsV2;
}
