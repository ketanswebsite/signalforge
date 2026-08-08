/* Alerts page: per-alert-type switches bound to /api/alerts/preferences.
   Same fields and endpoints the alerts modal uses; changes save as made. */
(function () {
  'use strict';

  const FIELDS = [
    { key: 'telegram_enabled', label: 'Telegram alerts', help: "The master switch. Nothing sends while it's off." },
    { key: 'alert_on_buy', label: 'New signals', help: 'A message the moment the scanner finds a setup, with the buy price, target and stop.' },
    { key: 'alert_on_target', label: 'Hit the +8% target', help: 'Told when a position reaches its sell price.' },
    { key: 'alert_on_stoploss', label: 'Hit the −5% stop', help: 'Told when the stop cuts a position.' },
    { key: 'alert_on_time_exit', label: 'Ran out of time', help: 'Told when day 30 sells a position.' },
    { key: 'alert_on_sell', label: 'Sold by hand', help: 'Told when a manual sell is recorded.' },
    { key: 'market_open_alert', label: 'Market opens', help: 'A nudge when each market opens.' },
    { key: 'market_close_alert', label: 'Market closes', help: 'A nudge when each market closes.' }
  ];

  let prefs = null;
  let statusTimer = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function setStatus(message) {
    const status = document.getElementById('alert-prefs-status');
    if (!status) return;
    status.textContent = message;
    clearTimeout(statusTimer);
    if (message) statusTimer = setTimeout(function () { status.textContent = ''; }, 2500);
  }

  async function save() {
    try {
      const response = await fetch('/api/alerts/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs)
      });
      setStatus(response.ok ? 'Saved.' : 'That change did not save. Try again.');
    } catch (e) {
      setStatus('That change did not save. Try again.');
    }
  }

  function render() {
    const box = document.getElementById('alert-switches');
    if (!box) return;
    box.replaceChildren();

    FIELDS.forEach(function (field) {
      const item = el('div', 'setting-item');
      const label = el('label', 'sa-switch');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = prefs[field.key] !== undefined
        ? Boolean(prefs[field.key])
        : field.key.indexOf('market_') !== 0; /* alert_* default on, market_* default off */
      input.setAttribute('aria-label', field.label);
      input.addEventListener('change', function () {
        prefs[field.key] = input.checked;
        save();
      });
      label.appendChild(input);
      label.appendChild(el('span', 'sa-switch__track'));
      label.appendChild(el('span', 'sa-switch__text', field.label));
      item.appendChild(label);
      item.appendChild(el('span', 'setting-help', field.help));
      box.appendChild(item);
    });
  }

  document.addEventListener('DOMContentLoaded', async function () {
    try {
      const response = await fetch('/api/alerts/preferences');
      if (!response.ok) return; // signed out — leave the card hidden
      prefs = await response.json();
      const card = document.getElementById('alert-prefs-card');
      if (card) card.hidden = false;
      render();
    } catch (e) { /* leave hidden */ }
  });
})();
