/**
 * AI check UI ("AI insights" button on scan cards).
 *
 * Renders the three-pillar conviction check served by /api/ml/conviction —
 * the same framework the daily Claude analysis routine uses:
 * Technical 45% + Fundamental 30% + Information 25% → CONFIDENCE 1-10
 * (>6 GO, 5-6 WATCH, <5 PASS). Backtest win rate is context only.
 *
 * All content is inserted with textContent (headlines are external data).
 */

const MLInsightsUI = (function() {
    let activeSymbol = null;
    let activeName = null;
    let activeWinRate = null;

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    function init() {
        if (document.getElementById('ml-insights-modal')) return;

        const modal = el('div', 'dialog-overlay');
        modal.id = 'ml-insights-modal';
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');

        const content = el('div', 'dialog-content ai-check');

        const header = el('div', 'dialog-header');
        const title = el('h3', 'dialog-title');
        const icon = el('span', 'material-symbols-rounded', 'monitoring');
        icon.setAttribute('aria-hidden', 'true');
        title.appendChild(icon);
        title.appendChild(document.createTextNode('AI check'));
        const close = el('button', 'dialog-close', '×');
        close.type = 'button';
        close.setAttribute('aria-label', 'Close dialog');
        close.addEventListener('click', hideModal);
        header.appendChild(title);
        header.appendChild(close);

        const body = el('div', 'dialog-body');
        const slot = el('div');
        slot.id = 'ml-insights-content';
        body.appendChild(slot);

        content.appendChild(header);
        content.appendChild(body);
        modal.appendChild(content);

        modal.addEventListener('click', function(e) {
            if (e.target === modal) hideModal();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') hideModal();
        });

        document.body.appendChild(modal);
    }

    function showMLInsights(symbol) {
        init();
        const modal = document.getElementById('ml-insights-modal');
        modal.style.display = 'flex';
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');

        if (!symbol) return;
        activeSymbol = symbol;

        // Company name + backtested win rate come from the scan already on the page.
        activeName = null;
        activeWinRate = null;
        try {
            const opp = (DTIBacktester.activeTradeOpportunities || [])
                .find(o => o.stock.symbol === symbol);
            if (opp) activeName = opp.stock.name;
            const rates = DTIUI.calculateStockWinRates();
            if (rates && rates[symbol] !== undefined) {
                activeWinRate = Math.round(rates[symbol] * 10) / 10;
            }
        } catch (e) { /* scanner data not on this page — the check still runs */ }

        analyzeSymbol(symbol);
    }

    function hideModal() {
        const modal = document.getElementById('ml-insights-modal');
        if (!modal) return;
        modal.style.display = 'none';
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
    }

    function renderLoading(symbol) {
        const slot = document.getElementById('ml-insights-content');
        const box = el('div', 'ai-loading');
        const spin = el('span', 'material-symbols-rounded spinner', 'progress_activity');
        spin.setAttribute('aria-hidden', 'true');
        box.appendChild(spin);
        box.appendChild(el('p', null, 'Checking ' + symbol + ' against the three pillars…'));
        box.appendChild(el('p', 'ai-loading-hint', 'Price action, fundamentals and the last 30 days of news.'));
        slot.replaceChildren(box);
    }

    function renderError(symbol, message) {
        const slot = document.getElementById('ml-insights-content');
        const box = el('div', 'ai-error');
        box.appendChild(el('p', null, 'The check for ' + symbol + ' did not finish: ' + message));
        const retry = el('button', 'sa-btn sa-btn--secondary sa-btn--sm', 'Try again');
        retry.type = 'button';
        retry.addEventListener('click', function() { analyzeSymbol(); });
        box.appendChild(retry);
        slot.replaceChildren(box);
    }

    async function analyzeSymbol(providedSymbol) {
        const symbol = providedSymbol || activeSymbol;
        if (!symbol) return;
        activeSymbol = symbol;
        renderLoading(symbol);

        try {
            const params = new URLSearchParams();
            if (activeName) params.set('name', activeName);
            if (activeWinRate !== null) params.set('winRate', String(activeWinRate));
            const qs = params.toString();
            const response = await fetch('/api/ml/conviction/' + encodeURIComponent(symbol) + (qs ? '?' + qs : ''), {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('the server answered ' + response.status);
            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'no result');
            renderAnalysis(data);
        } catch (error) {
            renderError(symbol, error.message);
        }
    }

    function verdictMeaning(verdict) {
        if (verdict === 'GO') return 'The three checks line up. Worth a close look today.';
        if (verdict === 'WATCH') return 'Mixed evidence. Watch it rather than chase it.';
        return 'The evidence leans against this one right now.';
    }

    function pillarTitle(key) {
        if (key === 'technical') return 'Technical';
        if (key === 'fundamental') return 'Fundamental';
        return 'Information';
    }

    function pillarHint(key) {
        if (key === 'technical') return 'How the price has been behaving';
        if (key === 'fundamental') return 'What the business earns and owes';
        return 'What the news said in the last 30 days';
    }

    function renderAnalysis(data) {
        const slot = document.getElementById('ml-insights-content');
        const frag = document.createDocumentFragment();

        // Who this is about
        const head = el('div', 'ai-head');
        const idBlock = el('div');
        idBlock.appendChild(el('div', 'ai-head__name', data.name || data.symbol));
        idBlock.appendChild(el('div', 'ai-head__sym', data.symbol));
        head.appendChild(idBlock);
        frag.appendChild(head);

        // Verdict banner
        const tone = data.verdict === 'GO' ? 'go' : data.verdict === 'WATCH' ? 'watch' : 'pass';
        const banner = el('div', 'ai-verdict ai-verdict--' + tone);
        const bLeft = el('div');
        bLeft.appendChild(el('div', 'ai-verdict__word', data.verdict));
        bLeft.appendChild(el('div', 'ai-verdict__meaning', verdictMeaning(data.verdict)));
        banner.appendChild(bLeft);
        const bScore = el('div', 'ai-verdict__score');
        bScore.appendChild(el('span', 'ai-verdict__num', data.confidence.toFixed(1)));
        bScore.appendChild(el('span', 'ai-verdict__den', '/ 10'));
        banner.appendChild(bScore);
        frag.appendChild(banner);

        // Gemini's plain-English read of the whole picture
        if (data.summary) {
            frag.appendChild(el('p', 'ai-summary', data.summary));
        }

        // The three pillars
        ['technical', 'fundamental', 'information'].forEach(function(key) {
            const p = data.pillars[key];
            if (!p) return;
            const row = el('div', 'ai-pillar');
            const top = el('div', 'ai-pillar__top');
            const nameWrap = el('div');
            const nameLine = el('div', 'ai-pillar__name');
            nameLine.appendChild(document.createTextNode(pillarTitle(key)));
            nameLine.appendChild(el('span', 'ai-pillar__weight', String(p.weight) + '%'));
            nameWrap.appendChild(nameLine);
            nameWrap.appendChild(el('div', 'ai-pillar__hint', pillarHint(key)));
            top.appendChild(nameWrap);
            top.appendChild(el('div', 'ai-pillar__score', p.score.toFixed(1)));
            row.appendChild(top);

            const track = el('div', 'sa-prog__track');
            const fill = el('div', 'sa-prog__fill');
            fill.style.width = Math.max(0, Math.min(100, p.score * 10)) + '%';
            track.appendChild(fill);
            row.appendChild(track);

            const list = el('ul', 'ai-pillar__evidence');
            (p.evidence || []).forEach(function(line) {
                list.appendChild(el('li', null, line));
            });
            row.appendChild(list);

            if (key === 'information' && p.headlines && p.headlines.length > 0) {
                const news = el('div', 'ai-news');
                p.headlines.forEach(function(h) {
                    const item = el('div', 'ai-news__item');
                    item.appendChild(el('span', 'ai-news__date', h.date));
                    item.appendChild(el('span', 'ai-news__title ai-news__title--' + (h.tone || 'neutral'), h.title));
                    news.appendChild(item);
                });
                row.appendChild(news);
            }

            frag.appendChild(row);
        });

        // Context — never scored
        const context = el('div', 'ai-context');
        if (data.context && data.context.winRate !== null && data.context.winRate !== undefined && !isNaN(data.context.winRate)) {
            context.appendChild(el('div', null,
                'This stock’s backtested win rate: ' + data.context.winRate + '% — shown for context, never scored.'));
        } else {
            context.appendChild(el('div', null, 'Backtest win rate is context only — it is never part of the score.'));
        }
        if (data.engine) {
            context.appendChild(el('div', 'ai-context__engine',
                data.engine === 'rule-based'
                    ? 'Rule-based check. Add a Gemini API key on the server for AI-written analysis.'
                    : 'Analysed by ' + data.engine + ' from the same price, fundamentals and news facts.'));
        }
        context.appendChild(el('div', 'ai-context__legal', 'Educational tool, not investment advice. Your capital is at risk.'));
        frag.appendChild(context);

        slot.replaceChildren(frag);
    }

    // Public API
    return {
        init,
        showMLInsights,
        hideModal,
        analyzeSymbol
    };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', MLInsightsUI.init);
} else {
    MLInsightsUI.init();
}
