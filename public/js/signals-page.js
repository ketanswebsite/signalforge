/**
 * Scanner page — the 7 AM scan's recent output + personal auto-trading toggle.
 *
 * Data: GET /api/signals/recent (7 AM scan rows with AI verdicts + outcomes),
 * GET/POST /api/user/auto-trading. Everything renders via DOM methods with
 * textContent — signal fields come from the DB but stay treated as data.
 */
(function () {
    'use strict';

    const FLAGS = { India: '🇮🇳', UK: '🇬🇧', US: '🇺🇸' };
    const CURRENCY = { India: '₹', UK: '£', US: '$' };

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    function fmtDate(value) {
        return window.DateFormatter ? window.DateFormatter.format(value) : String(value);
    }

    function companyName(symbol) {
        if (window.CompanyNames && typeof window.CompanyNames.getCompanyName === 'function') {
            const name = window.CompanyNames.getCompanyName(symbol);
            if (name && name !== symbol) return name;
        }
        return null;
    }

    // ---- personal auto-trading card ----

    function renderAutoTrading(status) {
        const off = document.getElementById('at-off');
        const on = document.getElementById('at-on');
        const badge = document.getElementById('at-badge');
        if (!off || !on) return;
        off.hidden = !!status.enabled;
        on.hidden = !status.enabled;
        badge.hidden = !status.enabled;
        if (status.enabled) {
            document.getElementById('at-since').textContent = status.startedAt ? fmtDate(status.startedAt) : 'today';
        }
    }

    function setStatusNote(text) {
        const note = document.getElementById('at-status');
        if (!note) return;
        note.textContent = text || '';
        note.hidden = !text;
    }

    async function loadAutoTrading() {
        try {
            const response = await fetch('/api/user/auto-trading');
            const data = await response.json();
            if (data.success) renderAutoTrading(data);
        } catch (error) {
            console.error('Auto-trading status failed:', error);
        }
    }

    async function setAutoTrading(enabled) {
        try {
            setStatusNote(enabled ? 'Switching on…' : 'Switching off…');
            const response = await fetch('/api/user/auto-trading', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: enabled })
            });
            const data = await response.json();
            if (data.success) {
                renderAutoTrading(data);
                setStatusNote(enabled
                    ? 'Done — from the next 1 PM execution, GO signals are booked to your portfolio.'
                    : 'Auto-trading stopped. Open positions are still managed to their exits.');
            } else {
                setStatusNote(data.error || 'That did not work — try again.');
            }
        } catch (error) {
            setStatusNote('That did not work — try again. (' + error.message + ')');
        }
    }

    // ---- signals feed ----

    function verdictBadge(signal) {
        const verdict = signal.conviction_verdict;
        const score = signal.conviction_score != null ? parseFloat(signal.conviction_score) : null;
        if (!verdict) return el('span', 'sa-badge', 'AI —');
        const label = 'AI ' + verdict + (score != null ? ' ' + score.toFixed(1) + '/10' : '');
        if (verdict === 'GO') return el('span', 'sa-badge sa-badge--gain', label);
        if (verdict === 'PASS') return el('span', 'sa-badge sa-badge--loss', label);
        return el('span', 'sa-badge', label);
    }

    function statusBadge(signal) {
        switch (signal.status) {
            case 'added': return el('span', 'sa-badge sa-badge--accent', 'Traded');
            case 'pending': return el('span', 'sa-badge', 'Awaiting 1 PM');
            case 'expired': return el('span', 'sa-badge', 'Expired');
            default: return el('span', 'sa-badge', 'Not taken');
        }
    }

    function renderSignalRow(signal) {
        const row = el('article', 'sg-row');
        const c = CURRENCY[signal.market] || '';

        const main = el('div', 'sg-main');
        const title = el('div');
        title.appendChild(el('strong', null, signal.symbol));
        const name = companyName(signal.symbol);
        if (name) {
            title.appendChild(document.createTextNode(' '));
            title.appendChild(el('span', 'sg-name', name));
        }
        title.appendChild(document.createTextNode(' ' + (FLAGS[signal.market] || '')));
        main.appendChild(title);

        const entry = parseFloat(signal.entry_price);
        const target = parseFloat(signal.target_price);
        const stop = parseFloat(signal.stop_loss);
        const winRate = parseFloat(signal.win_rate);
        const bits = [];
        if (isFinite(entry)) bits.push('Buy ' + c + entry.toFixed(2));
        if (isFinite(target)) bits.push('Target ' + c + target.toFixed(2));
        if (isFinite(stop)) bits.push('Stop ' + c + stop.toFixed(2));
        if (isFinite(winRate)) bits.push('Backtest ' + winRate.toFixed(0) + '% wins');
        main.appendChild(el('div', 'sg-prices', bits.join(' · ')));
        row.appendChild(main);

        const badges = el('div', 'sg-badges');
        badges.appendChild(verdictBadge(signal));
        badges.appendChild(statusBadge(signal));
        row.appendChild(badges);

        // What triggered it — the DTI readings at signal time
        const entryDti = signal.entry_dti != null ? parseFloat(signal.entry_dti) : null;
        if (entryDti != null && isFinite(entryDti)) {
            const fmtDti = v => (v > 0 ? '+' : '') + Number(v).toFixed(1);
            const prevDti = signal.prev_dti != null ? parseFloat(signal.prev_dti) : null;
            const entry7 = signal.entry_7day_dti != null ? parseFloat(signal.entry_7day_dti) : null;
            const prev7 = signal.prev_7day_dti != null ? parseFloat(signal.prev_7day_dti) : null;
            let triggerText = 'Trigger · Daily DTI '
                + (prevDti != null && isFinite(prevDti) ? fmtDti(prevDti) + ' → ' : '')
                + fmtDti(entryDti);
            if (entry7 != null && isFinite(entry7)) {
                triggerText += ' · Weekly '
                    + (prev7 != null && isFinite(prev7) ? fmtDti(prev7) + ' → ' : '')
                    + fmtDti(entry7);
            }
            const triggerLine = el('p', 'sg-summary', triggerText);
            triggerLine.title = 'The formula buys when the daily DTI turns up from below its trigger and the weekly DTI agrees.';
            row.appendChild(triggerLine);
        }

        if (signal.conviction_summary) {
            row.appendChild(el('p', 'sg-summary', String(signal.conviction_summary).slice(0, 260)));
        }
        return row;
    }

    function renderFeed(signals) {
        const feed = document.getElementById('signals-feed');
        feed.replaceChildren();

        if (!signals || signals.length === 0) {
            feed.appendChild(el('p', 'sg-empty',
                'Nothing in the last week — the scan runs every weekday at 7 AM UK, and quiet stretches are normal. Signals appear here the moment one is found.'));
            return;
        }

        const todayKey = fmtDate(new Date());
        const groups = new Map();
        signals.forEach(s => {
            const key = fmtDate(s.signal_date);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(s);
        });

        groups.forEach((daySignals, dateKey) => {
            const heading = dateKey === todayKey ? 'Today — ' + dateKey : dateKey;
            feed.appendChild(el('h3', 'sg-day', heading));
            daySignals.forEach(s => feed.appendChild(renderSignalRow(s)));
        });
    }

    async function loadSignals() {
        try {
            const response = await fetch('/api/signals/recent?days=7');
            const data = await response.json();
            if (data.success) {
                renderFeed(data.signals);
            } else {
                throw new Error(data.error || 'Request failed');
            }
        } catch (error) {
            const feed = document.getElementById('signals-feed');
            feed.replaceChildren(el('p', 'sg-empty', 'Could not load the recent scans: ' + error.message));
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        loadAutoTrading();
        loadSignals();

        const enableBtn = document.getElementById('at-enable');
        const disableBtn = document.getElementById('at-disable');
        if (enableBtn) {
            enableBtn.addEventListener('click', function () {
                if (confirm('Book every GO signal to your own portfolio at 1 PM, starting today?\n\nPaper capital: ₹10,00,000 / £10,000 / $15,000. Targets +8%, stops −5%, 30-day max hold.')) {
                    setAutoTrading(true);
                }
            });
        }
        if (disableBtn) {
            disableBtn.addEventListener('click', function () {
                if (confirm('Stop booking new signals to your portfolio?\n\nOpen positions keep being managed to their exits.')) {
                    setAutoTrading(false);
                }
            });
        }
    });
})();
