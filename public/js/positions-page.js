/* Positions page behaviour: the "Holding now / Already sold" top tabs and
   their count chips. Everything inside the panels is rendered by TradeUI. */
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

  document.addEventListener('DOMContentLoaded', function () {
    const holdingTab = document.getElementById('tab-holding');
    const soldTab = document.getElementById('tab-sold');
    if (holdingTab) holdingTab.addEventListener('click', function () { selectTab('holding'); });
    if (soldTab) soldTab.addEventListener('click', function () { selectTab('sold'); });

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
