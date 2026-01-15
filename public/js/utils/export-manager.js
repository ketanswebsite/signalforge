/**
 * ExportManager - Centralized data export utility
 * Consolidates CSV, JSON, and file download logic across 7+ files
 */
window.ExportManager = (function() {
  'use strict';

  /**
   * Generate timestamp for filenames
   * @returns {string} Formatted timestamp (YYYY-MM-DD-HHmmss)
   */
  function getTimestamp() {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0].replace(/:/g, '');
    return `${date}-${time}`;
  }

  /**
   * Escape a value for CSV (handle commas, quotes, newlines)
   * @param {any} value - Value to escape
   * @returns {string} CSV-safe string
   */
  function escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Convert array of objects to CSV string
   * @param {Array<Object>} data - Array of objects
   * @param {Array<string>} columns - Column keys to include (optional, defaults to all keys)
   * @param {Object} columnLabels - Map of key to display label (optional)
   * @returns {string} CSV string
   */
  function objectsToCSV(data, columns = null, columnLabels = null) {
    if (!data || data.length === 0) return '';

    // Get columns from first object if not specified
    const cols = columns || Object.keys(data[0]);

    // Create header row
    const headers = cols.map(col => escapeCSV(columnLabels?.[col] || col));

    // Create data rows
    const rows = data.map(item =>
      cols.map(col => escapeCSV(item[col])).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Convert 2D array to CSV string
   * @param {Array<Array>} data - 2D array (first row can be headers)
   * @returns {string} CSV string
   */
  function arrayToCSV(data) {
    if (!data || data.length === 0) return '';
    return data.map(row =>
      row.map(cell => escapeCSV(cell)).join(',')
    ).join('\n');
  }

  /**
   * Trigger file download
   * @param {string} content - File content
   * @param {string} filename - Filename with extension
   * @param {string} mimeType - MIME type (default: text/csv)
   */
  function downloadFile(content, filename, mimeType = 'text/csv;charset=utf-8;') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  /**
   * Export data as CSV file
   * @param {Object} config - Export configuration
   * @param {Array} config.data - Data to export (array of objects or 2D array)
   * @param {string} config.filename - Base filename (without extension)
   * @param {Array<string>} config.columns - Column keys to include (optional)
   * @param {Object} config.columnLabels - Map of key to display label (optional)
   * @param {boolean} config.includeTimestamp - Add timestamp to filename (default: true)
   */
  function exportCSV(config) {
    const {
      data,
      filename = 'export',
      columns = null,
      columnLabels = null,
      includeTimestamp = true
    } = config;

    if (!data || data.length === 0) {
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.warning('No data to export');
      } else {
        alert('No data to export');
      }
      return;
    }

    // Determine if data is objects or arrays
    const isObjectArray = typeof data[0] === 'object' && !Array.isArray(data[0]);
    const csvContent = isObjectArray
      ? objectsToCSV(data, columns, columnLabels)
      : arrayToCSV(data);

    const fullFilename = includeTimestamp
      ? `${filename}-${getTimestamp()}.csv`
      : `${filename}.csv`;

    downloadFile(csvContent, fullFilename);

    if (typeof NotificationManager !== 'undefined') {
      NotificationManager.success(`Exported ${data.length} rows to ${fullFilename}`);
    }
  }

  /**
   * Export data as JSON file
   * @param {Object} config - Export configuration
   * @param {any} config.data - Data to export
   * @param {string} config.filename - Base filename (without extension)
   * @param {boolean} config.pretty - Pretty print JSON (default: true)
   * @param {boolean} config.includeTimestamp - Add timestamp to filename (default: true)
   */
  function exportJSON(config) {
    const {
      data,
      filename = 'export',
      pretty = true,
      includeTimestamp = true
    } = config;

    if (!data) {
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.warning('No data to export');
      } else {
        alert('No data to export');
      }
      return;
    }

    const jsonContent = pretty
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);

    const fullFilename = includeTimestamp
      ? `${filename}-${getTimestamp()}.json`
      : `${filename}.json`;

    downloadFile(jsonContent, fullFilename, 'application/json');

    if (typeof NotificationManager !== 'undefined') {
      NotificationManager.success(`Exported data to ${fullFilename}`);
    }
  }

  /**
   * Export HTML table element to CSV
   * @param {string|HTMLElement} tableOrId - Table element or ID
   * @param {string} filename - Base filename
   */
  function exportTableToCSV(tableOrId, filename = 'table-export') {
    const table = typeof tableOrId === 'string'
      ? document.getElementById(tableOrId)
      : tableOrId;

    if (!table) {
      console.error('ExportManager: Table not found');
      return;
    }

    const rows = [];
    const tableRows = table.querySelectorAll('tr');

    tableRows.forEach(row => {
      const cells = row.querySelectorAll('th, td');
      const rowData = Array.from(cells).map(cell => cell.textContent.trim());
      rows.push(rowData);
    });

    exportCSV({ data: rows, filename, includeTimestamp: true });
  }

  return {
    getTimestamp,
    escapeCSV,
    objectsToCSV,
    arrayToCSV,
    downloadFile,
    exportCSV,
    exportJSON,
    exportTableToCSV
  };
})();
