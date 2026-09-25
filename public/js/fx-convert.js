/**
 * Dated exchange rates for a page (GAPS #11, README.md section 1): rupees, pounds and dollars converted at the rate
 * of a given day, from GET /api/fx/rates (every calendar day of a window with the rate in force that day, the last
 * stored daily close on or before it: lib/shared/fx-rates.js).
 *
 * The Positions page adds its three markets' money in pounds with it (TradeCore.inPounds): a sold trade at its
 * sell day's rate, an open position at the latest. A day outside the loaded window takes the nearer end. Until the
 * rates are loaded, or when the server has none (a new database before its first refresh, a failed request), the
 * old fixed approximate rates apply.
 */
const FxConvert = (function () {
    'use strict';

    // Units of each currency per pound: the fixed approximate rates, only while no dated rate is loaded
    const FIXED_PER_POUND = Object.freeze({ GBP: 1, INR: 105.0, USD: 1.27 });
    // A trade's market, as the executor books it, and its currency
    const MARKET_CURRENCY = Object.freeze({ India: 'INR', UK: 'GBP', US: 'USD' });
    const SYMBOL_CURRENCY = Object.freeze({ '₹': 'INR', '£': 'GBP', '$': 'USD' });
    // GET /api/fx/rates serves at most 4000 days a request: an older day converts at the window's first one
    const MAX_WINDOW_DAYS = 4000;
    const DAY_MS = 24 * 60 * 60 * 1000;

    // The loaded rates: day -> [GBPINR, GBPUSD], the window's first and last day, and the day it was asked from
    let dated = null;
    let loadedFrom = null;
    let pending = null;

    /** A day as YYYY-MM-DD: a Date's UTC day (the server's day for a stored timestamp), or a day string's first ten characters. */
    function dayOf(value) {
        if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
        return null;
    }

    /**
     * Load the dated rates from a day to today, once: a later call reuses them unless it needs an earlier day.
     * Never throws; without them the fixed rates apply.
     * @param {Date|string|null} fromDay  the oldest day to convert at (no day: today only)
     * @returns {Promise<{source: 'dated'|'fixed', first: string|null, last: string|null}>}
     */
    function load(fromDay) {
        const today = new Date().toISOString().slice(0, 10);
        const earliest = new Date(Date.now() - (MAX_WINDOW_DAYS - 1) * DAY_MS).toISOString().slice(0, 10);
        let from = dayOf(fromDay) || today;
        if (from > today) from = today;
        if (from < earliest) from = earliest;
        if (dated && loadedFrom <= from) return Promise.resolve(source());
        if (pending) return pending;
        pending = fetch(`/api/fx/rates?from=${encodeURIComponent(from)}`, { credentials: 'same-origin' })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then(data => {
                const days = data && Array.isArray(data.days) ? data.days : [];
                const rows = days.filter(row => Array.isArray(row) && dayOf(row[0]) && Number(row[1]) > 0 && Number(row[2]) > 0);
                if (rows.length > 0) {
                    dated = {
                        byDay: new Map(rows.map(([day, gbpInr, gbpUsd]) => [day, [Number(gbpInr), Number(gbpUsd)]])),
                        first: rows[0][0],
                        last: rows[rows.length - 1][0]
                    };
                    loadedFrom = from;
                }
            })
            .catch(error => {
                console.warn('[FX] Dated exchange rates unavailable, converting at the fixed rates:', error.message);
            })
            .then(() => {
                pending = null;
                return source();
            });
        return pending;
    }

    /** Which rates convert now: 'dated' with the loaded window's ends, or 'fixed'. */
    function source() {
        return dated ? { source: 'dated', first: dated.first, last: dated.last } : { source: 'fixed', first: null, last: null };
    }

    /** Units of each currency per pound on a day ({GBP, INR, USD}); no day: the latest loaded. */
    function perPound(day) {
        if (!dated) return FIXED_PER_POUND;
        const key = dayOf(day) || dated.last;
        const edge = key < dated.first ? dated.first : (key > dated.last ? dated.last : key);
        const pair = dated.byDay.get(edge);
        return pair ? { GBP: 1, INR: pair[0], USD: pair[1] } : FIXED_PER_POUND;
    }

    /** An amount in pounds at a day's rate (no day: the latest). An unknown currency counts as dollars. */
    function toPounds(amount, currency, day) {
        const value = Number(amount);
        if (!Number.isFinite(value)) return 0;
        const per = perPound(day);
        return value / (per[currency] || per.USD);
    }

    /** A trade's currency: its market, else its currency symbol, else its symbol's exchange (.NS/.BO rupees, .L pounds, dollars). */
    function currencyOf(trade) {
        if (!trade) return 'USD';
        if (MARKET_CURRENCY[trade.market]) return MARKET_CURRENCY[trade.market];
        if (SYMBOL_CURRENCY[trade.currencySymbol]) return SYMBOL_CURRENCY[trade.currencySymbol];
        const symbol = String(trade.symbol || '').toUpperCase();
        if (symbol.endsWith('.NS') || symbol.endsWith('.BO')) return 'INR';
        if (symbol.endsWith('.L')) return 'GBP';
        return 'USD';
    }

    return { load, source, perPound, toPounds, currencyOf, dayOf, FIXED_PER_POUND };
})();

window.FxConvert = FxConvert;
