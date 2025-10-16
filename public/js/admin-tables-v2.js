/**
 * Admin Tables V2 - Advanced Data Table Component
 * Phase 2: Advanced filtering, sorting, export, and inline editing
 */

const AdminTablesV2 = {
  tables: {},

  /**
   * Create advanced data table
   * @param {string} containerId - Container element ID
   * @param {Object} config - Table configuration
   */
  create(containerId, config) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container #${containerId} not found`);
      return null;
    }

    const tableId = containerId + '-table';
    const table = {
      id: tableId,
      containerId,
      config: {
        columns: config.columns || [],
        data: config.data || [],
        sortable: config.sortable !== false,
        filterable: config.filterable !== false,
        exportable: config.exportable !== false,
        editable: config.editable || false,
        selectable: config.selectable || false,
        pagination: config.pagination !== false,
        pageSize: config.pageSize || 10
      },
      state: {
        currentPage: 1,
        sortColumn: null,
        sortDirection: 'asc',
        filters: {},
        selectedRows: new Set(),
        visibleColumns: config.columns.map(col => col.key)
      },
      originalData: [...(config.data || [])]
    };

    this.tables[tableId] = table;
    this.render(tableId);

    return tableId;
  },

  /**
   * Render table
   */
  render(tableId) {
    const table = this.tables[tableId];
    if (!table) return;

    const container = document.getElementById(table.containerId);
    if (!container) return;

    let html = '';

    // Actions bar
    if (table.config.exportable || table.config.selectable) {
      html += this.renderActionsBar(table);
    }

    // Filters
    if (table.config.filterable) {
      html += this.renderFilters(table);
    }

    // Table
    html += this.renderTable(table);

    // Pagination
    if (table.config.pagination) {
      html += this.renderPagination(table);
    }

    container.innerHTML = html;
    this.attachEventListeners(tableId);
  },

  /**
   * Render actions bar
   */
  renderActionsBar(table) {
    const selectedCount = table.state.selectedRows.size;

    return `
      <div class="table-actions-bar">
        <div class="table-actions-left">
          ${table.config.selectable && selectedCount > 0 ? `
            <div class="bulk-select-info">
              ${selectedCount} row${selectedCount > 1 ? 's' : ''} selected
            </div>
            <button class="btn btn-sm btn-secondary" data-action="clear-selection">
              Clear Selection
            </button>
          ` : ''}
        </div>
        <div class="table-actions-right">
          ${table.config.exportable ? `
            <button class="btn btn-sm btn-secondary" data-action="export-csv">
              📊 Export CSV
            </button>
            <button class="btn btn-sm btn-secondary" data-action="export-excel">
              📗 Export Excel
            </button>
          ` : ''}
          <div class="column-manager">
            <button class="btn btn-sm btn-secondary" data-action="toggle-columns">
              ⚙️ Columns
            </button>
            <div class="column-manager-dropdown" id="${table.id}-column-manager">
              ${table.config.columns.map(col => `
                <label class="column-manager-item">
                  <input
                    type="checkbox"
                    data-column="${col.key}"
                    ${table.state.visibleColumns.includes(col.key) ? 'checked' : ''}
                  >
                  <span>${col.label}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Render filters
   */
  renderFilters(table) {
    return `
      <div class="table-filters">
        ${table.config.columns.map(col => {
          if (col.filterable === false) return '';

          const filterType = col.filterType || 'text';
          const filterId = `${table.id}-filter-${col.key}`;

          if (filterType === 'select') {
            return `
              <div class="table-filter-item">
                <label class="table-filter-label" for="${filterId}">${col.label}</label>
                <select
                  id="${filterId}"
                  class="table-filter-input"
                  data-filter-column="${col.key}"
                >
                  <option value="">All</option>
                  ${col.filterOptions?.map(opt => `
                    <option value="${opt.value}">${opt.label}</option>
                  `).join('') || ''}
                </select>
              </div>
            `;
          }

          if (filterType === 'date') {
            return `
              <div class="table-filter-item">
                <label class="table-filter-label" for="${filterId}">${col.label}</label>
                <input
                  type="date"
                  id="${filterId}"
                  class="table-filter-input"
                  data-filter-column="${col.key}"
                >
              </div>
            `;
          }

          return `
            <div class="table-filter-item">
              <label class="table-filter-label" for="${filterId}">${col.label}</label>
              <input
                type="text"
                id="${filterId}"
                class="table-filter-input"
                placeholder="Filter ${col.label}..."
                data-filter-column="${col.key}"
              >
            </div>
          `;
        }).join('')}
        ${Object.keys(table.state.filters).length > 0 ? `
          <div class="table-filter-item" style="display: flex; align-items: flex-end;">
            <button class="btn btn-secondary" data-action="clear-filters">
              Clear Filters
            </button>
          </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * Render table
   */
  renderTable(table) {
    const filteredData = this.getFilteredData(table);
    const sortedData = this.getSortedData(table, filteredData);
    const paginatedData = this.getPaginatedData(table, sortedData);

    return `
      <div class="data-table-wrapper">
        <table class="data-table-v2">
          <thead>
            <tr>
              ${table.config.selectable ? `
                <th style="width: 50px;">
                  <input
                    type="checkbox"
                    data-action="select-all"
                    ${table.state.selectedRows.size === filteredData.length && filteredData.length > 0 ? 'checked' : ''}
                  >
                </th>
              ` : ''}
              ${table.config.columns
                .filter(col => table.state.visibleColumns.includes(col.key))
                .map(col => {
                  const isSorted = table.state.sortColumn === col.key;
                  const sortIcon = isSorted
                    ? (table.state.sortDirection === 'asc' ? '↑' : '↓')
                    : '↕';

                  return `
                    <th
                      class="${table.config.sortable && col.sortable !== false ? 'sortable' : ''} ${isSorted ? 'sorted' : ''}"
                      data-column="${col.key}"
                      data-action="${table.config.sortable && col.sortable !== false ? 'sort' : ''}"
                    >
                      ${col.label}
                      ${table.config.sortable && col.sortable !== false ? `<span class="sort-icon">${sortIcon}</span>` : ''}
                    </th>
                  `;
                }).join('')}
            </tr>
          </thead>
          <tbody>
            ${paginatedData.length === 0 ? `
              <tr>
                <td colspan="${table.state.visibleColumns.length + (table.config.selectable ? 1 : 0)}" style="text-align: center; padding: 40px;">
                  No data available
                </td>
              </tr>
            ` : paginatedData.map((row, index) => `
              <tr data-row-index="${index}">
                ${table.config.selectable ? `
                  <td>
                    <input
                      type="checkbox"
                      data-action="select-row"
                      data-row-id="${row.id || index}"
                      ${table.state.selectedRows.has(row.id || index) ? 'checked' : ''}
                    >
                  </td>
                ` : ''}
                ${table.config.columns
                  .filter(col => table.state.visibleColumns.includes(col.key))
                  .map(col => {
                    const value = row[col.key];
                    const displayValue = col.render ? col.render(value, row) : value;
                    const isEditable = table.config.editable && col.editable !== false;

                    return `
                      <td
                        class="${isEditable ? 'editable-cell' : ''}"
                        data-column="${col.key}"
                        data-row-id="${row.id || index}"
                        ${isEditable ? `data-action="edit-cell"` : ''}
                      >
                        ${displayValue || '-'}
                      </td>
                    `;
                  }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  /**
   * Render pagination
   */
  renderPagination(table) {
    const filteredData = this.getFilteredData(table);
    const totalPages = Math.ceil(filteredData.length / table.config.pageSize);

    if (totalPages <= 1) return '';

    return AdminComponents.pagination({
      currentPage: table.state.currentPage,
      totalPages: totalPages,
      onPageChange: (page) => `AdminTablesV2.goToPage('${table.id}', ${page})`
    });
  },

  /**
   * Attach event listeners
   */
  attachEventListeners(tableId) {
    const table = this.tables[tableId];
    if (!table) return;

    const container = document.getElementById(table.containerId);
    if (!container) return;

    // Delegate all events
    container.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      this.handleAction(tableId, action, target, e);
    });

    // Filter inputs (debounced)
    container.addEventListener('input', this.debounce((e) => {
      const target = e.target;
      if (target.dataset.filterColumn) {
        this.applyFilter(tableId, target.dataset.filterColumn, target.value);
      }
    }, 300));

    // Filter selects (immediate)
    container.addEventListener('change', (e) => {
      const target = e.target;
      if (target.dataset.filterColumn && target.tagName === 'SELECT') {
        this.applyFilter(tableId, target.dataset.filterColumn, target.value);
      }
    });
  },

  /**
   * Handle action
   */
  handleAction(tableId, action, target, event) {
    const table = this.tables[tableId];
    if (!table) return;

    switch (action) {
      case 'sort':
        const column = target.dataset.column;
        this.sortByColumn(tableId, column);
        break;

      case 'export-csv':
        this.exportAsCSV(tableId);
        break;

      case 'export-excel':
        this.exportAsExcel(tableId);
        break;

      case 'toggle-columns':
        const dropdown = document.getElementById(`${tableId}-column-manager`);
        dropdown.classList.toggle('show');
        break;

      case 'clear-filters':
        this.clearFilters(tableId);
        break;

      case 'select-all':
        this.toggleSelectAll(tableId, target.checked);
        break;

      case 'select-row':
        const rowId = target.dataset.rowId;
        this.toggleSelectRow(tableId, rowId, target.checked);
        break;

      case 'clear-selection':
        this.clearSelection(tableId);
        break;

      case 'edit-cell':
        this.startCellEdit(tableId, target);
        break;
    }

    // Handle column visibility toggle
    if (target.type === 'checkbox' && target.dataset.column) {
      this.toggleColumn(tableId, target.dataset.column, target.checked);
    }
  },

  /**
   * Sort by column
   */
  sortByColumn(tableId, column) {
    const table = this.tables[tableId];
    if (!table) return;

    if (table.state.sortColumn === column) {
      table.state.sortDirection = table.state.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      table.state.sortColumn = column;
      table.state.sortDirection = 'asc';
    }

    this.render(tableId);
  },

  /**
   * Apply filter
   */
  applyFilter(tableId, column, value) {
    const table = this.tables[tableId];
    if (!table) return;

    if (value) {
      table.state.filters[column] = value;
    } else {
      delete table.state.filters[column];
    }

    table.state.currentPage = 1; // Reset to first page
    this.render(tableId);
  },

  /**
   * Clear filters
   */
  clearFilters(tableId) {
    const table = this.tables[tableId];
    if (!table) return;

    table.state.filters = {};
    table.state.currentPage = 1;
    this.render(tableId);
  },

  /**
   * Toggle column visibility
   */
  toggleColumn(tableId, column, visible) {
    const table = this.tables[tableId];
    if (!table) return;

    if (visible) {
      if (!table.state.visibleColumns.includes(column)) {
        table.state.visibleColumns.push(column);
      }
    } else {
      table.state.visibleColumns = table.state.visibleColumns.filter(col => col !== column);
    }

    this.render(tableId);
  },

  /**
   * Toggle select all
   */
  toggleSelectAll(tableId, checked) {
    const table = this.tables[tableId];
    if (!table) return;

    const filteredData = this.getFilteredData(table);

    if (checked) {
      filteredData.forEach(row => {
        table.state.selectedRows.add(row.id || row);
      });
    } else {
      table.state.selectedRows.clear();
    }

    this.render(tableId);
  },

  /**
   * Toggle select row
   */
  toggleSelectRow(tableId, rowId, checked) {
    const table = this.tables[tableId];
    if (!table) return;

    if (checked) {
      table.state.selectedRows.add(rowId);
    } else {
      table.state.selectedRows.delete(rowId);
    }

    this.render(tableId);
  },

  /**
   * Clear selection
   */
  clearSelection(tableId) {
    const table = this.tables[tableId];
    if (!table) return;

    table.state.selectedRows.clear();
    this.render(tableId);
  },

  /**
   * Export as CSV
   */
  exportAsCSV(tableId) {
    const table = this.tables[tableId];
    if (!table) return;

    const data = table.state.selectedRows.size > 0
      ? this.getSelectedRows(tableId)
      : this.getFilteredData(table);

    const csv = this.dataToCSV(table, data);

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `export-${Date.now()}.csv`;
    link.href = url;
    link.click();
    window.URL.revokeObjectURL(url);

    AdminComponentsV2.toast({
      type: 'success',
      message: `Exported ${data.length} rows to CSV`,
      duration: 3000
    });
  },

  /**
   * Export as Excel (CSV format with .xlsx extension)
   */
  exportAsExcel(tableId) {
    const table = this.tables[tableId];
    if (!table) return;

    const data = table.state.selectedRows.size > 0
      ? this.getSelectedRows(tableId)
      : this.getFilteredData(table);

    const csv = this.dataToCSV(table, data);

    const blob = new Blob([csv], { type: 'application/vnd.ms-excel' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `export-${Date.now()}.xlsx`;
    link.href = url;
    link.click();
    window.URL.revokeObjectURL(url);

    AdminComponentsV2.toast({
      type: 'success',
      message: `Exported ${data.length} rows to Excel`,
      duration: 3000
    });
  },

  /**
   * Convert data to CSV
   */
  dataToCSV(table, data) {
    const visibleColumns = table.config.columns.filter(col =>
      table.state.visibleColumns.includes(col.key)
    );

    let csv = '';

    // Header
    csv += visibleColumns.map(col => `"${col.label}"`).join(',') + '\n';

    // Rows
    data.forEach(row => {
      csv += visibleColumns.map(col => {
        const value = row[col.key];
        const displayValue = typeof value === 'string' ? value.replace(/"/g, '""') : value;
        return `"${displayValue || ''}"`;
      }).join(',') + '\n';
    });

    return csv;
  },

  /**
   * Get filtered data
   */
  getFilteredData(table) {
    let data = [...table.originalData];

    Object.keys(table.state.filters).forEach(column => {
      const filterValue = table.state.filters[column].toLowerCase();
      data = data.filter(row => {
        const cellValue = String(row[column] || '').toLowerCase();
        return cellValue.includes(filterValue);
      });
    });

    return data;
  },

  /**
   * Get sorted data
   */
  getSortedData(table, data) {
    if (!table.state.sortColumn) return data;

    return [...data].sort((a, b) => {
      const aVal = a[table.state.sortColumn];
      const bVal = b[table.state.sortColumn];

      let comparison = 0;
      if (aVal > bVal) comparison = 1;
      if (aVal < bVal) comparison = -1;

      return table.state.sortDirection === 'asc' ? comparison : -comparison;
    });
  },

  /**
   * Get paginated data
   */
  getPaginatedData(table, data) {
    if (!table.config.pagination) return data;

    const start = (table.state.currentPage - 1) * table.config.pageSize;
    const end = start + table.config.pageSize;

    return data.slice(start, end);
  },

  /**
   * Get selected rows
   */
  getSelectedRows(tableId) {
    const table = this.tables[tableId];
    if (!table) return [];

    return table.originalData.filter(row =>
      table.state.selectedRows.has(row.id || row)
    );
  },

  /**
   * Go to page
   */
  goToPage(tableId, page) {
    const table = this.tables[tableId];
    if (!table) return;

    table.state.currentPage = page;
    this.render(tableId);
  },

  /**
   * Debounce utility
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Start cell edit
   */
  startCellEdit(tableId, cell) {
    const table = this.tables[tableId];
    if (!table) return;

    const column = cell.dataset.column;
    const rowId = cell.dataset.rowId;
    const currentValue = cell.textContent.trim();

    cell.classList.add('editing');
    cell.innerHTML = `<input type="text" value="${currentValue}" data-original="${currentValue}">`;

    const input = cell.querySelector('input');
    input.focus();
    input.select();

    // Save on Enter, cancel on Escape
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.saveCellEdit(tableId, cell, column, rowId, input.value);
      } else if (e.key === 'Escape') {
        this.cancelCellEdit(cell, input.dataset.original);
      }
    });

    // Save on blur
    input.addEventListener('blur', () => {
      this.saveCellEdit(tableId, cell, column, rowId, input.value);
    });
  },

  /**
   * Save cell edit
   */
  saveCellEdit(tableId, cell, column, rowId, newValue) {
    const table = this.tables[tableId];
    if (!table) return;

    // Update data
    const row = table.originalData.find(r => (r.id || r) == rowId);
    if (row) {
      row[column] = newValue;

      // Emit custom event
      const event = new CustomEvent('table-cell-updated', {
        detail: { tableId, column, rowId, newValue, row }
      });
      document.dispatchEvent(event);
    }

    cell.classList.remove('editing');
    cell.textContent = newValue;
  },

  /**
   * Cancel cell edit
   */
  cancelCellEdit(cell, originalValue) {
    cell.classList.remove('editing');
    cell.textContent = originalValue;
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.AdminTablesV2 = AdminTablesV2;
}
