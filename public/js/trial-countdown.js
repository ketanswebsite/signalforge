/* Trial countdown chip (v3.1 lifecycle spec): include on any app page.
   Fetches the user's subscription; if a trial has ≤14 days left, injects the
   chip into the app bar's end slot (amber at ≤5). Never blocks the screen. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', async function () {
    try {
      var r = await fetch('/api/user/subscription');
      if (!r.ok) return;
      var sb = await r.json();
      var s = (sb && sb.data) || sb;
      var sub = s.subscription || s;
      var status = (sub.status || '').toLowerCase();
      if (status !== 'trial' && status !== 'trialing' && status !== 'active_trial') return;
      var end = sub.trial_end_date || sub.trialEndDate || sub.current_period_end || sub.currentPeriodEnd;
      if (!end) return;
      var days = Math.ceil((new Date(end) - new Date()) / 86400000);
      if (days > 14 || days < 0) return;

      var slot = document.querySelector('.sa-appbar__end');
      if (!slot) return;
      var chip = document.createElement('span');
      chip.className = 'sa-countdown' + (days <= 5 ? ' sa-countdown--warn' : '');
      var num = document.createElement('span');
      num.className = 'sa-countdown__num';
      num.textContent = days;
      chip.appendChild(num);
      chip.appendChild(document.createTextNode(' free days left · '));
      var link = document.createElement('a');
      link.href = '/pricing.html';
      link.textContent = 'keep the signals';
      chip.appendChild(link);
      slot.insertBefore(chip, slot.firstChild);
    } catch (e) { /* the chip is optional chrome — never break the page */ }
  });
})();
