/**
 * DateFormatter - Centralized date formatting utility
 * Replaces scattered date formatting across 47+ files
 */
window.DateFormatter = (function() {
  'use strict';

  /**
   * Parse date input to Date object
   * @param {string|number|Date} date - Date input
   * @returns {Date|null} Parsed date or null if invalid
   */
  function parseDate(date) {
    if (!date) return null;
    if (date instanceof Date) return isNaN(date.getTime()) ? null : date;
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  /**
   * Format date as DD-MM-YYYY (the app-wide display standard).
   * Built manually — toLocaleDateString('en-GB') can only produce slashes.
   * @param {string|number|Date} date - Date input
   * @param {string} fallback - Fallback value if date is invalid
   * @returns {string} Formatted date
   */
  function format(date, fallback = '-') {
    const parsed = parseDate(date);
    if (!parsed) return fallback;
    const dd = String(parsed.getDate()).padStart(2, '0');
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${parsed.getFullYear()}`;
  }

  /**
   * Format date as short string (e.g., "15-01-26")
   * @param {string|number|Date} date - Date input
   * @param {string} fallback - Fallback value if date is invalid
   * @returns {string} Formatted date
   */
  function formatShort(date, fallback = '-') {
    const parsed = parseDate(date);
    if (!parsed) return fallback;
    const dd = String(parsed.getDate()).padStart(2, '0');
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const yy = String(parsed.getFullYear() % 100).padStart(2, '0');
    return `${dd}-${mm}-${yy}`;
  }

  /**
   * Format date with time (e.g., "15-01-2026, 2:30 pm")
   * @param {string|number|Date} date - Date input
   * @param {string} fallback - Fallback value if date is invalid
   * @returns {string} Formatted date and time
   */
  function formatTime(date, fallback = '-') {
    const parsed = parseDate(date);
    if (!parsed) return fallback;
    const time = parsed.toLocaleTimeString('en-GB', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return `${format(parsed)}, ${time}`;
  }

  /**
   * Format date as relative time (e.g., "2 hours ago", "3 days ago")
   * @param {string|number|Date} date - Date input
   * @param {string} fallback - Fallback value if date is invalid
   * @returns {string} Relative time string
   */
  function relative(date, fallback = '-') {
    const parsed = parseDate(date);
    if (!parsed) return fallback;

    const now = new Date();
    const diffMs = now - parsed;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
    if (diffHour < 24) return diffHour === 1 ? '1 hour ago' : `${diffHour} hours ago`;
    if (diffDay < 7) return diffDay === 1 ? '1 day ago' : `${diffDay} days ago`;
    if (diffWeek < 4) return diffWeek === 1 ? '1 week ago' : `${diffWeek} weeks ago`;
    if (diffMonth < 12) return diffMonth === 1 ? '1 month ago' : `${diffMonth} months ago`;

    return format(date, fallback);
  }

  /**
   * Format date for input fields (YYYY-MM-DD)
   * @param {string|number|Date} date - Date input
   * @param {string} fallback - Fallback value if date is invalid
   * @returns {string} ISO date string for inputs
   */
  function formatForInput(date, fallback = '') {
    const parsed = parseDate(date);
    if (!parsed) return fallback;
    return parsed.toISOString().split('T')[0];
  }

  return {
    format,
    formatShort,
    formatTime,
    relative,
    formatForInput,
    parseDate
  };
})();
