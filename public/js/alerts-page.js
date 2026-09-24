/* Alerts page: per-alert-type switches bound to /api/alerts/preferences.
   Same fields and endpoints the alerts modal uses; changes save as made. */
(function () {
  'use strict';

  /* Every switch here is honoured by lib/shared/alert-policy.js. They cover the
     messages about the subscriber's OWN positions; the shared channel is muted
     with /stop in the bot. Do not add a switch no sender can honour. */
  const FIELDS = [
    { key: 'telegram_enabled', label: 'Your own alerts', help: "While it's off, nothing about your own positions is sent: no buys, no sells, no evening summary. The shared SutrAlgo channel keeps posting. Send /stop to the bot to mute that." },
    { key: 'alert_on_buy', label: 'Trades booked for you', help: "Told at each market's 1 PM when the day's signals are bought into your portfolio, with the size and price." },
    { key: 'alert_on_target', label: 'Hit the +8% target', help: 'Told when a position reaches its sell price.' },
    { key: 'alert_on_stoploss', label: 'Hit the −5% stop', help: 'Told when the stop cuts a position.' },
    { key: 'alert_on_time_exit', label: 'Ran out of time', help: 'Told when day 30 sells a position.' }
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
      input.checked = prefs[field.key] !== false; /* same rule the server applies: only an explicit false is off */
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
