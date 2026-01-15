/**
 * ApiClient - Centralized API request handling
 * Replaces scattered fetch-error-render patterns across 38+ files
 */
window.ApiClient = (function() {
  'use strict';

  /**
   * Make a fetch request with standard error handling
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Response data
   */
  async function request(endpoint, options = {}) {
    const response = await fetch(endpoint, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error?.message || 'Request failed');
    }

    return data;
  }

  /**
   * GET request with query parameters
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Response data
   */
  async function get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return request(url);
  }

  /**
   * POST request with JSON body
   * @param {string} endpoint - API endpoint
   * @param {Object} body - Request body
   * @returns {Promise<Object>} Response data
   */
  async function post(endpoint, body = {}) {
    return request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  /**
   * PUT request with JSON body
   * @param {string} endpoint - API endpoint
   * @param {Object} body - Request body
   * @returns {Promise<Object>} Response data
   */
  async function put(endpoint, body = {}) {
    return request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  /**
   * DELETE request
   * @param {string} endpoint - API endpoint
   * @returns {Promise<Object>} Response data
   */
  async function del(endpoint) {
    return request(endpoint, { method: 'DELETE' });
  }

  /**
   * Create error UI HTML for containers
   * @param {string} message - Error message to display
   * @param {string} retryFn - JavaScript function call for retry button
   * @returns {string} HTML string
   */
  function createErrorUI(message, retryFn) {
    return `
      <div class="text-center text-muted" style="padding: 2rem;">
        <p>${message}</p>
        ${retryFn ? `<button class="btn btn-primary btn-sm" onclick="${retryFn}">Retry</button>` : ''}
      </div>
    `;
  }

  /**
   * Create loading UI HTML for containers
   * @param {string} text - Loading text to display
   * @returns {string} HTML string
   */
  function createLoadingUI(text = 'Loading...') {
    // Use AdminComponents spinner if available, otherwise simple text
    if (typeof AdminComponents !== 'undefined' && AdminComponents.spinner) {
      return AdminComponents.spinner({ text });
    }
    return `
      <div class="text-center text-muted" style="padding: 2rem;">
        <p>${text}</p>
      </div>
    `;
  }

  /**
   * Fetch data and render to a container with loading/error states
   * @param {Object} config - Configuration object
   * @param {string} config.endpoint - API endpoint
   * @param {Object} config.params - Query parameters
   * @param {string} config.containerId - DOM container ID
   * @param {Function} config.renderFn - Function to render data (receives data.data)
   * @param {string} config.retryFn - JavaScript function call for retry
   * @param {string} config.loadingText - Loading message
   * @param {string} config.errorMessage - Custom error message
   * @returns {Promise<Object|null>} Response data or null on error
   */
  async function fetchAndRender(config) {
    const {
      endpoint,
      params = {},
      containerId,
      renderFn,
      retryFn,
      loadingText = 'Loading...',
      errorMessage = 'Failed to load data'
    } = config;

    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`ApiClient: Container #${containerId} not found`);
      return null;
    }

    // Show loading state
    container.innerHTML = createLoadingUI(loadingText);

    try {
      const data = await get(endpoint, params);

      // Call render function with the data
      if (renderFn) {
        renderFn(data.data);
      }

      return data;
    } catch (error) {
      console.error(`ApiClient error for ${endpoint}:`, error);
      container.innerHTML = createErrorUI(errorMessage, retryFn);
      return null;
    }
  }

  /**
   * Submit form data and handle response
   * @param {Object} config - Configuration object
   * @param {string} config.endpoint - API endpoint
   * @param {string} config.method - HTTP method (POST, PUT, DELETE)
   * @param {Object} config.body - Request body
   * @param {Function} config.onSuccess - Success callback
   * @param {Function} config.onError - Error callback
   * @returns {Promise<Object|null>} Response data or null on error
   */
  async function submitForm(config) {
    const {
      endpoint,
      method = 'POST',
      body = {},
      onSuccess,
      onError
    } = config;

    try {
      const data = await request(endpoint, {
        method,
        body: JSON.stringify(body)
      });

      if (onSuccess) {
        onSuccess(data);
      }

      return data;
    } catch (error) {
      console.error(`ApiClient submit error for ${endpoint}:`, error);

      if (onError) {
        onError(error);
      } else if (typeof AdminComponents !== 'undefined' && AdminComponents.alert) {
        AdminComponents.alert({
          type: 'error',
          message: error.message,
          autoDismiss: 5000
        });
      }

      return null;
    }
  }

  return {
    request,
    get,
    post,
    put,
    delete: del,
    fetchAndRender,
    submitForm,
    createErrorUI,
    createLoadingUI
  };
})();
