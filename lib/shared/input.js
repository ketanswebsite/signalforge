/**
 * Small input checks for request handlers. Each returns the clean value, or null when the input is
 * not acceptable, so a handler can answer 400 before a malformed value reaches Postgres - which throws
 * on it, and the handler's catch used to turn that into a 500.
 */

/** A real calendar date written YYYY-MM-DD (so 2026-02-30 is not one), else null. */
function isoDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y, m, d] = value.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? value : null;
}

/**
 * A point in time Postgres will read without complaint: a YYYY-MM-DD date, or an ISO 8601 date-time on
 * such a date (what a date input or toISOString() produces), else null.
 */
function isoTimestamp(value) {
    if (typeof value !== 'string') return null;
    const m = value.match(/^(\d{4}-\d{2}-\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/);
    return m && isoDate(m[1]) && !Number.isNaN(Date.parse(value.replace(' ', 'T'))) ? value : null;
}

function toNumber(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '') return Number(value.trim());
    return NaN;
}

/** A finite number above zero, given as a number or a numeric string, else null. */
function positiveNumber(value) {
    const n = toNumber(value);
    return Number.isFinite(n) && n > 0 ? n : null;
}

/** A finite number of zero or more, given as a number or a numeric string, else null. */
function nonNegativeNumber(value) {
    const n = toNumber(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
}

/** A whole number of zero or more, given as a number or a numeric string, else null. */
function nonNegativeInteger(value) {
    const n = toNumber(value);
    return Number.isInteger(n) && n >= 0 ? n : null;
}

/**
 * A Telegram chat id: a whole number (groups and channels are negative), given as a number or a string
 * of digits. Returned as a string, which is how node-postgres hands BIGINT columns back, else null.
 */
function chatId(value) {
    const s = typeof value === 'number' && Number.isSafeInteger(value) ? String(value)
        : typeof value === 'string' ? value.trim() : '';
    return /^-?\d{1,20}$/.test(s) ? s : null;
}

module.exports = { isoDate, isoTimestamp, positiveNumber, nonNegativeNumber, nonNegativeInteger, chatId };
