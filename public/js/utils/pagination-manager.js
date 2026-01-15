/**
 * PaginationManager - Reusable pagination state and behavior
 * Consolidates repeated pagination logic across 30+ admin files
 */
window.PaginationManager = (function() {
  'use strict';

  /**
   * Create a new pagination instance for a module
   * @param {Object} config - Configuration object
   * @param {number} config.pageSize - Items per page (default: 50)
   * @param {string} config.sortBy - Default sort field
   * @param {string} config.sortOrder - Default sort order ('asc' or 'desc')
   * @param {Function} config.onLoad - Function to call when data should be loaded
   * @param {number} config.searchDebounce - Debounce delay in ms (default: 500)
   * @returns {Object} Pagination instance
   */
  function create(config = {}) {
    const state = {
      currentPage: 1,
      pageSize: config.pageSize || 50,
      searchQuery: '',
      filterStatus: 'all',
      sortBy: config.sortBy || 'created_at',
      sortOrder: config.sortOrder || 'desc',
      searchTimeout: null,
      searchDebounce: config.searchDebounce || 500
    };

    const onLoad = config.onLoad || (() => {});

    return {
      /**
       * Get current pagination state
       */
      getState() {
        return { ...state };
      },

      /**
       * Get params object for API requests
       */
      getParams() {
        const params = {
          page: state.currentPage,
          limit: state.pageSize,
          sort: state.sortBy,
          order: state.sortOrder
        };

        if (state.searchQuery) {
          params.search = state.searchQuery;
        }

        if (state.filterStatus !== 'all') {
          params.filter = state.filterStatus;
        }

        return params;
      },

      /**
       * Handle search input with debounce
       * @param {Event|string} eventOrValue - Input event or search string
       */
      handleSearch(eventOrValue) {
        const value = typeof eventOrValue === 'string'
          ? eventOrValue
          : eventOrValue.target.value;

        state.searchQuery = value;
        state.currentPage = 1;

        clearTimeout(state.searchTimeout);
        state.searchTimeout = setTimeout(() => {
          onLoad();
        }, state.searchDebounce);
      },

      /**
       * Handle filter change
       * @param {Event|string} eventOrValue - Select event or filter value
       */
      handleFilter(eventOrValue) {
        const value = typeof eventOrValue === 'string'
          ? eventOrValue
          : eventOrValue.target.value;

        state.filterStatus = value;
        state.currentPage = 1;
        onLoad();
      },

      /**
       * Go to specific page
       * @param {number} page - Page number
       */
      goToPage(page) {
        state.currentPage = page;
        onLoad();
      },

      /**
       * Handle sort change
       * @param {string} field - Field to sort by
       */
      handleSort(field) {
        if (state.sortBy === field) {
          state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortBy = field;
          state.sortOrder = 'desc';
        }
        state.currentPage = 1;
        onLoad();
      },

      /**
       * Reset to initial state
       */
      reset() {
        state.currentPage = 1;
        state.searchQuery = '';
        state.filterStatus = 'all';
        onLoad();
      },

      /**
       * Set page size
       * @param {number} size - New page size
       */
      setPageSize(size) {
        state.pageSize = size;
        state.currentPage = 1;
        onLoad();
      },

      /**
       * Render pagination controls using AdminComponents
       * @param {Object} pagination - Pagination data from API response
       * @param {string} containerId - Container element ID
       * @param {string} callbackPrefix - Module name for onclick callbacks (e.g., 'AdminUsers')
       */
      renderPagination(pagination, containerId, callbackPrefix) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (pagination && pagination.pages > 1) {
          const paginationHTML = AdminComponents.pagination({
            currentPage: pagination.page,
            totalPages: pagination.pages,
            onPageChange: (page) => `${callbackPrefix}.goToPage(${page})`
          });
          container.innerHTML = paginationHTML;
        } else {
          container.innerHTML = '';
        }
      }
    };
  }

  return { create };
})();
