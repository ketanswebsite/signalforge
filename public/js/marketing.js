/* Marketing surface behaviour: theme toggle, mobile menu, legal note,
   FAQ accordion, and the pricing region switcher. No frameworks. */
(function () {
  'use strict';

  // ---------- theme (light-first; persisted) ----------
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
      var menu = document.querySelector('.mk-menu');
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

    var faq = e.target.closest('.mk-faq__q');
    if (faq) {
      faq.setAttribute('aria-expanded', faq.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
      return;
    }

    var seg = e.target.closest('.sa-seg__opt[data-region]');
    if (seg) { setRegion(seg.getAttribute('data-region')); }
  });

  // ---------- pricing region (prices are data, never typed into markup) ----------
  var PLANS = [
    { id: 'explorer', name: 'Explorer', blurb: 'Try the whole thing before you pay anything.',
      price: { UK: ['£', '0'], US: ['$', '0'], India: ['₹', '0'] }, period: 'for 90 days',
      features: ['Every signal, every market', 'Alerts on Telegram', 'Full history to test against', 'No card needed'],
      cta: 'Start free', note: 'No card needed.' },
    { id: 'trader', name: 'Trader', blurb: 'Keep the signals coming after your 90 days.',
      price: { UK: ['£', '24'], US: ['$', '29'], India: ['₹', '999'] }, period: 'a month', featured: true,
      ribbon: 'Most people start here',
      features: ['Everything in Explorer', 'Priority support', 'Cancel any time', 'Price fixed for 12 months'],
      cta: 'Choose Trader', note: 'Cancel any time from your account.' }
  ];

  function setRegion(region) {
    try { localStorage.setItem('sa-region', region); } catch (e) {}
    document.querySelectorAll('.sa-seg__opt[data-region]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-region') === region ? 'true' : 'false');
    });
    PLANS.forEach(function (p) {
      var card = document.querySelector('[data-plan="' + p.id + '"]');
      if (!card) return;
      var cur = card.querySelector('[data-plan-currency]');
      var amt = card.querySelector('[data-plan-amount]');
      if (cur) cur.textContent = p.price[region][0];
      if (amt) amt.textContent = p.price[region][1];
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    syncThemeButton();
    if (document.querySelector('[data-plan]')) {
      var region = 'UK';
      try { region = localStorage.getItem('sa-region') || 'UK'; } catch (e) {}
      if (['UK', 'US', 'India'].indexOf(region) === -1) region = 'UK';
      setRegion(region);
    }
  });
})();
