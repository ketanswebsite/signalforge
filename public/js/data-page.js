/* Your data page (v3.1) — summary counts, exports, typed-DELETE account removal.
   Endpoints: /api/user/data-summary, /api/user/download-data, /api/trades/export,
   DELETE /api/user/delete-account (routes/gdpr.js). */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }

  document.addEventListener('DOMContentLoaded', async function () {
    try {
      var r = await fetch('/api/user/data-summary');
      if (r.status === 401) {
        $('signin-note').hidden = false;
        $('data-grid').style.opacity = '.45';
        $('open-delete').disabled = true;
        return;
      }
      if (r.ok) {
        var sb = await r.json();
        var s = (sb && sb.data) || sb;
        if (s.total_trades != null) $('sz-trades').textContent = s.total_trades + ' rows';
        $('sz-json').textContent = 'everything';
      }
    } catch (e) { /* counts are decoration; downloads still work */ }
  });

  document.addEventListener('click', function (e) {
    if (e.target.closest('#open-delete')) {
      $('delete-confirm').value = '';
      $('confirm-delete').disabled = true;
      $('delete-error').hidden = true;
      $('delete-scrim').hidden = false;
      $('delete-confirm').focus();
    }
    if (e.target.closest('#close-delete') || e.target.closest('#keep-account') || e.target === $('delete-scrim')) {
      $('delete-scrim').hidden = true;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('delete-scrim').hidden) $('delete-scrim').hidden = true;
  });

  document.addEventListener('input', function (e) {
    if (e.target.id === 'delete-confirm') {
      var v = e.target.value;
      $('confirm-delete').disabled = v !== 'DELETE';
      $('delete-hint').textContent = v && v !== 'DELETE' ? 'Capital letters — exactly DELETE.' : 'This is deliberate friction.';
    }
  });

  document.addEventListener('click', async function (e) {
    if (!e.target.closest('#confirm-delete')) return;
    var btn = $('confirm-delete');
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      var r = await fetch('/api/user/delete-account', { method: 'DELETE' });
      var out = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(out.error || 'Deletion failed. Try again, or email privacy@sutralgo.com.');
      location.href = '/';
    } catch (err) {
      $('delete-error-text').textContent = err.message;
      $('delete-error').hidden = false;
      btn.disabled = false;
    }
  });
})();
