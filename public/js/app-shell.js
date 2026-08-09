/* App-surface shell behaviour for the signed-in v3 "Poster" pages
   (Scanner, Positions, Simulator, Alerts, Account): theme toggle, mobile
   menu, legal note, user menu, and the Positions nav count. Mirrors
   js/marketing.js for the marketing surface. No frameworks. */
(function () {
  'use strict';

  // ---------- theme (light-first; persisted as sa-theme) ----------
  var saved = null;
  try { saved = localStorage.getItem('sa-theme'); } catch (e) {}
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

  function syncThemeButton() {
    var btn = document.querySelector('[data-theme-toggle]');
    if (!btn) return;
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    var icon = btn.querySelector('.material-symbols-rounded');
    if (icon) icon.textContent = dark ? 'light_mode' : 'dark_mode';
  }

  function closeUserMenu() {
    var wrap = document.querySelector('.app-usermenu');
    if (!wrap) return;
    wrap.classList.remove('is-open');
    var btn = wrap.querySelector('[data-usermenu-toggle]');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-theme-toggle]');
    if (t) {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (dark) document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', 'dark');
      try { localStorage.setItem('sa-theme', dark ? 'light' : 'dark'); } catch (err) {}
      syncThemeButton();
      return;
    }

    var burger = e.target.closest('[data-menu-toggle]');
    if (burger) {
      var menu = document.querySelector('.app-menu');
      if (menu) {
        var open = menu.classList.toggle('is-open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      return;
    }

    var legal = e.target.closest('.sa-legal__btn');
    if (legal) {
      var body = legal.parentElement.querySelector('.sa-legal__body');
      var expanded = legal.getAttribute('aria-expanded') === 'true';
      legal.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      if (body) body.hidden = expanded;
      return;
    }

    var userBtn = e.target.closest('[data-usermenu-toggle]');
    if (userBtn) {
      var wrap = userBtn.closest('.app-usermenu');
      var open = wrap.classList.toggle('is-open');
      userBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      return;
    }

    var formulaBtn = e.target.closest('[data-formula-info]');
    if (formulaBtn) {
      closeUserMenu();
      openFormulaModal();
      return;
    }

    // Any other click closes an open user menu
    if (!e.target.closest('.app-usermenu')) closeUserMenu();
  });

  // ---------- "How the formula works" — in-app explainer, no page leave ----------
  function fmEl(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function fmSection(title, lines) {
    var box = fmEl('div', 'fm-section');
    box.appendChild(fmEl('h4', 'fm-section__title', title));
    lines.forEach(function (line) {
      box.appendChild(fmEl('p', 'fm-section__body', line));
    });
    return box;
  }

  function openFormulaModal() {
    var existing = document.getElementById('formula-modal');
    if (existing) {
      existing.classList.add('active');
      return;
    }

    var overlay = fmEl('div', 'modal-overlay');
    overlay.id = 'formula-modal';

    var content = fmEl('div', 'modal-content fm-modal');

    var header = fmEl('div', 'modal-header');
    header.appendChild(fmEl('h2', 'modal-title', 'How the formula works'));
    var close = fmEl('button', 'modal-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    header.appendChild(close);
    content.appendChild(header);

    var body = fmEl('div', 'modal-body');
    body.appendChild(fmSection('The setup it hunts', [
      'The scanner watches one momentum reading (the DTI) on every stock on your watchlist. ' +
      'A setup starts when the daily reading turns up from below its trigger — and it only counts ' +
      'when the same check on the weekly chart agrees.'
    ]));
    body.appendChild(fmSection('The record it insists on', [
      'Before a signal reaches you, the formula replays five years of that stock’s history. ' +
      'Only stocks where the identical setup made money more than 75% of the time — a strong ' +
      'record — get shown.'
    ]));
    body.appendChild(fmSection('The exit rule (it never changes)', [
      'Every position sells at whichever comes first: the +8% target, the −5% stop, or the 30-day clock. ' +
      'No judgement calls, no holding and hoping.'
    ]));
    body.appendChild(fmSection('The AI check on top', [
      'Each signal can be put through three further checks — how the price has been behaving (45%), ' +
      'what the business earns and owes (30%), and what the news said in the last 30 days (25%). ' +
      'They blend into one confidence score: above 6 is a GO, 5–6 a WATCH, below 5 a PASS.'
    ]));
    var legal = fmEl('p', 'fm-legal',
      'Educational tool, not investment advice. Past performance is not a reliable indicator of future results. ' +
      'Your capital is at risk.');
    body.appendChild(legal);
    content.appendChild(body);

    var footer = fmEl('div', 'modal-footer');
    var ok = fmEl('button', 'btn btn-primary', 'Got it');
    ok.type = 'button';
    footer.appendChild(ok);
    content.appendChild(footer);

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    function closeModal() {
      overlay.classList.remove('active');
    }
    close.addEventListener('click', closeModal);
    ok.addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });

    setTimeout(function () {
      overlay.classList.add('active');
    }, 10);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeUserMenu();
  });

  // ---------- who is signed in (fills the user menu; degrades quietly) ----------
  function initials(name, email) {
    var src = (name || email || '?').trim();
    var parts = src.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return src.slice(0, 2).toUpperCase();
  }

  async function loadUser() {
    try {
      var res = await fetch('/api/user');
      if (!res.ok) return;
      var data = await res.json();
      var user = data && data.user;
      if (!user) return;

      document.querySelectorAll('[data-user-name]').forEach(function (el) {
        el.textContent = user.name || user.email || '';
      });
      document.querySelectorAll('[data-user-email]').forEach(function (el) {
        el.textContent = user.email || '';
      });
      document.querySelectorAll('.sa-avatar[data-user-avatar]').forEach(function (el) {
        el.textContent = initials(user.name, user.email);
      });
      if (user.isAdmin) {
        document.querySelectorAll('[data-admin-only]').forEach(function (el) {
          el.hidden = false;
        });
      }
    } catch (e) { /* signed-out or auth disabled locally — menu still works */ }
  }

  // ---------- positions count on the nav chip ----------
  function paintPositionsCount(count) {
    document.querySelectorAll('[data-positions-count]').forEach(function (el) {
      el.textContent = String(count);
      el.hidden = !(count > 0);
    });
  }

  async function loadPositionsCount() {
    // Prefer TradeCore when the page already ships it (Scanner, Positions).
    for (var i = 0; i < 10; i++) {
      if (typeof TradeCore !== 'undefined' && TradeCore.getActiveTrades) {
        try {
          var trades = await TradeCore.getActiveTrades();
          paintPositionsCount(trades ? trades.length : 0);
        } catch (e) { /* leave hidden */ }
        return;
      }
      if (i === 0 && !document.querySelector('script[src*="trade-core"]')) break;
      await new Promise(function (r) { setTimeout(r, 500); });
    }
    // Lighter pages ask the API directly.
    try {
      var res = await fetch('/api/trades/active');
      if (!res.ok) return;
      var data = await res.json();
      var list = Array.isArray(data) ? data : (data.trades || data.data || []);
      paintPositionsCount(Array.isArray(list) ? list.length : 0);
    } catch (e) { /* leave hidden */ }
  }

  document.addEventListener('DOMContentLoaded', function () {
    syncThemeButton();
    loadUser();
    loadPositionsCount();
  });
})();
