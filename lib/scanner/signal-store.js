/**
 * Stores the 7 AM scan's signals in pending_signals, in process.
 *
 * The scanner used to POST them to /api/signals/from-scan. That route had to
 * sit in front of the /api sign-in gate for the scanner to reach it, so it
 * stored anyone's signals, including a 'GO' AI verdict that the 1 PM executor
 * trusts and would book and broadcast. Nothing else ever called the route.
 * It is gone; this is the same logic, run inside the process that scans.
 *
 * Semantics are the route's, unchanged:
 * - one row per symbol and signal date: an existing row is reported as a
 *   duplicate and left exactly as it is;
 * - each signal is stored as the scanner built it, status and AI verdict
 *   included ('dismissed' when the gate said no);
 * - a failure on one signal is recorded and the rest still go in.
 */

async function storeScanSignals(signals) {
    // Required here, not at load: requiring the DB module initialises it.
    const TradeDB = require('../../database-postgres');

    const stored = [];
    const duplicates = [];
    const errors = [];

    for (const raw of signals || []) {
        try {
            // The same values the route received over HTTP: JSON turns NaN and
            // Infinity into null, Dates into ISO strings, and drops undefined.
            const signal = JSON.parse(JSON.stringify(raw));
            const existing = await TradeDB.getPendingSignal(signal.symbol, signal.signalDate);
            if (existing) {
                duplicates.push({ symbol: signal.symbol, reason: 'Signal already exists for today' });
                continue;
            }

            // No active-position check here: the 1 PM executor validates in
            // real time, because a position open at 7 AM may close by 1 PM.
            const result = await TradeDB.storePendingSignal(signal);
            stored.push({ id: result.id, symbol: signal.symbol });
        } catch (error) {
            errors.push({ symbol: raw && raw.symbol, reason: error.message });
        }
    }

    console.log(`[7 AM Signal Storage] Stored: ${stored.length}, Duplicates: ${duplicates.length}, Errors: ${errors.length}`);
    if (stored.length > 0) {
        console.log(`[7 AM Signal Storage] Stored symbols: ${stored.map(s => s.symbol).join(', ')}`);
    }

    return {
        created: stored.length,
        duplicates: duplicates.length,
        errors: errors.length,
        details: { storedSignals: stored, duplicateSignals: duplicates, errorSignals: errors }
    };
}

module.exports = { storeScanSignals };
