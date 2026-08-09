/**
 * Scan persistence (IndexedDB).
 *
 * A finished scan survives page navigation: dti-data.js saves a trimmed
 * copy of the results here, and the Scanner rehydrates them on the next
 * visit instead of forcing a rescan. Trimmed = stock + trades +
 * activeTrade only — everything the signal cards, the win-rate maths and
 * the performance modal need. "Look closer" refetches full history anyway.
 *
 * IndexedDB rather than sessionStorage because an all-markets scan's
 * trade history runs to many megabytes.
 */
const ScanStore = (function () {
    const DB_NAME = 'sutralgo';
    const STORE = 'scans';
    const KEY = 'last-scan';
    const MAX_AGE_MS = 20 * 60 * 60 * 1000; // signals are day-relevant

    function openDb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => {
                if (!req.result.objectStoreNames.contains(STORE)) {
                    req.result.createObjectStore(STORE);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function liteTrade(t) {
        if (!t) return null;
        return {
            entryDate: t.entryDate,
            exitDate: t.exitDate,
            entryPrice: t.entryPrice,
            exitPrice: t.exitPrice,
            currentPrice: t.currentPrice,
            plPercent: t.plPercent,
            currentPlPercent: t.currentPlPercent,
            holdingDays: t.holdingDays,
            exitReason: t.exitReason,
            signalDate: t.signalDate,
            entryDTI: t.entryDTI,
            entry7DayDTI: t.entry7DayDTI
        };
    }

    async function save() {
        try {
            if (typeof DTIBacktester === 'undefined' ||
                !DTIBacktester.allStocksData || DTIBacktester.allStocksData.length === 0) return;

            const selector = document.getElementById('scan-type-selector');
            const payload = {
                savedAt: Date.now(),
                scanType: selector ? selector.value : null,
                currentStockIndex: DTIBacktester.currentStockIndex || null,
                opportunities: (DTIBacktester.activeTradeOpportunities || []).map(o => ({
                    stock: o.stock,
                    trade: liteTrade(o.trade)
                })),
                stocks: DTIBacktester.allStocksData.map(d => ({
                    stock: d.stock,
                    trades: (d.trades || []).map(liteTrade),
                    activeTrade: liteTrade(d.activeTrade)
                }))
            };

            const db = await openDb();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE, 'readwrite');
                tx.objectStore(STORE).put(payload, KEY);
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
            });
            db.close();
        } catch (e) {
            console.warn('[ScanStore] save failed:', e && e.message);
        }
    }

    async function load() {
        try {
            const db = await openDb();
            const payload = await new Promise((resolve, reject) => {
                const req = db.transaction(STORE).objectStore(STORE).get(KEY);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            db.close();
            if (!payload || (Date.now() - payload.savedAt) > MAX_AGE_MS) return null;
            return payload;
        } catch (e) {
            return null;
        }
    }

    async function clear() {
        try {
            const db = await openDb();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE, 'readwrite');
                tx.objectStore(STORE).delete(KEY);
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
            });
            db.close();
        } catch (e) { /* nothing to clear */ }
    }

    /**
     * Rehydrate the Scanner from the stored scan, if one is fresh.
     * Runs only on the Scanner page, and only while no scan has happened.
     */
    async function restoreIntoPage() {
        if (!document.getElementById('buying-opportunities')) return;
        if (typeof DTIBacktester === 'undefined' || typeof DTIUI === 'undefined') return;
        if (DTIBacktester.activeTradeOpportunities && DTIBacktester.activeTradeOpportunities.length > 0) return;

        const payload = await load();
        if (!payload || !payload.stocks || payload.stocks.length === 0) return;

        DTIBacktester.allStocksData = payload.stocks;
        DTIBacktester.activeTradeOpportunities = payload.opportunities || [];
        if (payload.currentStockIndex) DTIBacktester.currentStockIndex = payload.currentStockIndex;
        DTIBacktester.restoredFromStore = true; // suppresses re-sending alerts

        // The scan-type selector is built by page JS after load — sync it when it appears.
        if (payload.scanType) {
            let tries = 0;
            const sync = setInterval(() => {
                const sel = document.getElementById('scan-type-selector');
                if (sel) {
                    sel.value = payload.scanType;
                    clearInterval(sync);
                } else if (++tries > 20) {
                    clearInterval(sync);
                }
            }, 150);
        }

        if (DTIUI.TradeDisplay && DTIUI.TradeDisplay.displayBuyingOpportunities) {
            DTIUI.TradeDisplay.displayBuyingOpportunities();
        } else if (DTIUI.displayBuyingOpportunities) {
            DTIUI.displayBuyingOpportunities();
        }

        // Say where these results came from, next to the scan controls.
        // (Appended — page JS parks a hidden #batch-status in this container,
        // and a real scan's progress UI replaces the whole container anyway.)
        const statusDiv = document.getElementById('data-fetch-status');
        if (statusDiv && !document.getElementById('scan-restore-note')) {
            const note = document.createElement('div');
            note.id = 'scan-restore-note';
            note.className = 'sa-callout sa-callout--info';
            const icon = document.createElement('span');
            icon.className = 'material-symbols-rounded';
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = 'history';
            const text = document.createElement('div');
            const when = new Date(payload.savedAt);
            const strong = document.createElement('strong');
            strong.textContent = 'Restored your scan from ' +
                when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const span = document.createElement('span');
            span.textContent = 'Prices move — run the scan again for fresh signals.';
            text.appendChild(strong);
            text.appendChild(span);
            note.appendChild(icon);
            note.appendChild(text);
            statusDiv.appendChild(note);
        }
    }

    document.addEventListener('DOMContentLoaded', () => { restoreIntoPage(); });

    return { save, load, clear, restoreIntoPage };
})();
