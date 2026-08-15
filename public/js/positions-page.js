/* Positions page behaviour: the "Holding now / Already sold" top tabs, their
   count chips, and the per-position chart dialog (the scanner's "Look closer"
   charts reused for an open holding). Everything else inside the panels is
   rendered by TradeUI. */
(function () {
  'use strict';

  function selectTab(which) {
    const holdingTab = document.getElementById('tab-holding');
    const soldTab = document.getElementById('tab-sold');
    const holdingCard = document.getElementById('holding-card');
    const soldCard = document.getElementById('sold-card');
    if (!holdingTab || !soldTab || !holdingCard || !soldCard) return;

    const holding = which === 'holding';
    holdingTab.setAttribute('aria-selected', holding ? 'true' : 'false');
    soldTab.setAttribute('aria-selected', holding ? 'false' : 'true');
    holdingCard.hidden = !holding;
    soldCard.hidden = holding;
    fillCounts();
  }

  async function fillCounts() {
    if (typeof TradeCore === 'undefined' || !TradeCore.getTrades) return;
    try {
      const open = TradeCore.getTrades('active') || [];
      const closed = TradeCore.getTrades('closed') || [];
      const openCount = document.getElementById('tab-open-count');
      const closedCount = document.getElementById('tab-closed-count');
      if (openCount) {
        openCount.textContent = String(open.length);
        openCount.hidden = open.length === 0;
      }
      if (closedCount) {
        closedCount.textContent = String(closed.length);
        closedCount.hidden = closed.length === 0;
      }
    } catch (e) { /* counts stay hidden */ }
  }

  /* ---------- Position chart dialog ---------- */

  function closePositionChart() {
    const dialog = document.getElementById('position-chart-dialog');
    if (dialog) dialog.classList.remove('active');
  }

  async function openPositionChart(symbol, displayName) {
    const dialog = document.getElementById('position-chart-dialog');
    if (!dialog || typeof DTIData === 'undefined' || typeof DTIUI === 'undefined') return;

    const titleEl = document.getElementById('position-chart-title');
    const loading = document.getElementById('position-chart-loading');
    const grid = document.getElementById('position-chart-grid');

    const loadingText = document.getElementById('position-chart-loading-text');

    if (titleEl) titleEl.textContent = displayName ? displayName + ' — ' + symbol : symbol;
    if (loading) {
      loading.hidden = false;
      if (loadingText) loadingText.textContent = 'Loading five years of price history…';
    }
    if (grid) grid.hidden = true;
    dialog.classList.add('active');

    try {
      const data = await DTIData.fetchStockData(symbol, '5y');
      if (!data) throw new Error('No data returned');

      const processed = DTIData.processStockCSV(data, { symbol: symbol, name: displayName || symbol });
      if (!processed) throw new Error('Could not process data');

      // Store OHLC data globally — the chart module reads it for candlesticks
      if (typeof DTIBacktester !== 'undefined') {
        DTIBacktester.ohlcData = {
          dates: processed.dates,
          open: processed.open || processed.close,
          high: processed.high || processed.close,
          low: processed.low || processed.close,
          close: processed.close
        };
      }

      // Reveal the canvases BEFORE creating charts — Chart.js sizes canvases
      // at creation, and a hidden parent gives them zero dimensions.
      if (grid) grid.hidden = false;
      if (loading) loading.hidden = true;

      DTIUI.createCharts(
        processed.dates,
        processed.close,
        processed.dti,
        processed.sevenDayDTIData,
        {
          open: processed.open || processed.close,
          high: processed.high || processed.close,
          low: processed.low || processed.close
        }
      );
    } catch (e) {
      if (loading) {
        loading.hidden = false;
        const failText = document.getElementById('position-chart-loading-text');
        if (failText) {
          failText.textContent = 'Could not load the chart for ' + symbol + '. Close this and try again in a moment.';
        }
      }
      if (grid) grid.hidden = true;
    }
  }

  function setupChartDialog() {
    const dialog = document.getElementById('position-chart-dialog');
    if (!dialog) return;

    const closeBtn = document.getElementById('position-chart-x');
    if (closeBtn) closeBtn.addEventListener('click', closePositionChart);

    // Click on the scrim closes; clicks inside the content do not
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) closePositionChart();
    });

    // One delegated listener covers every render path that builds cards
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('.btn-chart-trade');
      if (!btn) return;
      const card = btn.closest('.trade-card');
      if (!card || typeof TradeCore === 'undefined' || !TradeCore.getTrades) return;

      const tradeId = card.dataset.tradeId;
      const trade = (TradeCore.getTrades('active') || []).find(function (t) {
        return String(t.id) === String(tradeId);
      });
      if (!trade) return;

      const name = (window.CompanyNames && window.CompanyNames.getCompanyName)
        ? window.CompanyNames.getCompanyName(trade.symbol)
        : (trade.stockName || trade.symbol);
      openPositionChart(trade.symbol, name);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    const holdingTab = document.getElementById('tab-holding');
    const soldTab = document.getElementById('tab-sold');
    if (holdingTab) holdingTab.addEventListener('click', function () { selectTab('holding'); });
    if (soldTab) soldTab.addEventListener('click', function () { selectTab('sold'); });

    setupChartDialog();

    // TradeCore loads trades asynchronously; poll briefly for the counts.
    let tries = 0;
    const timer = setInterval(function () {
      tries++;
      if (typeof TradeCore !== 'undefined' && TradeCore.getTrades) {
        const list = TradeCore.getTrades('all') || [];
        if (list.length > 0 || tries > 20) {
          clearInterval(timer);
          fillCounts();
          return;
        }
      }
      if (tries > 20) clearInterval(timer);
    }, 500);
  });
})();
