/**
 * NotificationManager - Centralized notification system
 * Consolidates competing notification implementations across the codebase
 */
window.NotificationManager = (function() {
  'use strict';

  const CONTAINER_ID = 'notification-container';
  const DEFAULT_DURATION = 5000;

  // SVG icons for different notification types
  const icons = {
    success: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>`,
    error: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="15" y1="9" x2="9" y2="15"></line>
      <line x1="9" y1="9" x2="15" y2="15"></line>
    </svg>`,
    warning: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>`,
    info: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>`
  };

  /**
   * Get or create the notification container
   * @returns {HTMLElement} The notification container
   */
  function getContainer() {
    let container = document.getElementById(CONTAINER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = CONTAINER_ID;
      document.body.appendChild(container);
    }
    return container;
  }

  /**
   * Show a notification
   * @param {string} message - The message to display
   * @param {string} type - Notification type: 'success', 'error', 'warning', 'info'
   * @param {number} duration - How long to show the notification (ms)
   * @returns {HTMLElement} The notification element
   */
  function show(message, type = 'info', duration = DEFAULT_DURATION) {
    const container = getContainer();

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;

    // Add icon and message
    const icon = icons[type] || icons.info;
    notification.innerHTML = `
      <span class="notification-icon">${icon}</span>
      <span class="notification-message">${message}</span>
    `;

    // Add to container
    container.appendChild(notification);

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => {
        dismiss(notification);
      }, duration);
    }

    return notification;
  }

  /**
   * Dismiss a notification with fade-out animation
   * @param {HTMLElement} notification - The notification element to dismiss
   */
  function dismiss(notification) {
    if (!notification || !notification.parentNode) return;

    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    notification.style.transition = 'opacity 0.3s, transform 0.3s';

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }

  /**
   * Clear all notifications
   */
  function clearAll() {
    const container = document.getElementById(CONTAINER_ID);
    if (container) {
      container.innerHTML = '';
    }
  }

  // Convenience methods
  function success(message, duration) {
    return show(message, 'success', duration);
  }

  function error(message, duration) {
    return show(message, 'error', duration);
  }

  function warning(message, duration) {
    return show(message, 'warning', duration);
  }

  function info(message, duration) {
    return show(message, 'info', duration);
  }

  return {
    show,
    dismiss,
    clearAll,
    success,
    error,
    warning,
    info
  };
})();

// Backward compatibility: Set up global showNotification function
window.showNotification = function(message, type = 'info') {
  return window.NotificationManager.show(message, type);
};
