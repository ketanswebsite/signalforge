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

    // Any other click closes an open user menu
    if (!e.target.closest('.app-usermenu')) closeUserMenu();
  });

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
