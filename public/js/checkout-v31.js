/* Checkout (v3.1 Poster): the plan summary here, the card on Stripe's own secure page.
   GET  /api/subscription-plans/:code    the plan's price and currency for the summary
   GET  /api/stripe/config               answers only while the paid checkout is switched on
   POST /api/stripe/create-subscription  { planCode, billingPeriod } -> { url }: Stripe's payment page, which comes
                                         back to /checkout-success.html when paid, or here with ?cancelled=1
   Every answer is an envelope: { success, message, data } or { success: false, error: { code, message } }. */
(function () {
  'use strict';

  // This page sells the monthly price: the summary, the button and the request all say so
  var BILLING_PERIOD = 'monthly';
  var planCode = null, plan = null, busy = false;

  function $(id) { return document.getElementById(id); }

  function fail(msg, title) {
    var box = $('card-errors');
    $('card-errors-title').textContent = title || "The payment didn't go through";
    if (msg) $('card-errors-text').textContent = msg;
    box.hidden = false;
    $('payframe').classList.add('sa-payframe--error');
  }
  function clearFail() {
    $('card-errors').hidden = true;
    $('payframe').classList.remove('sa-payframe--error');
  }

  // The message of an error envelope, else the fallback
  function errorText(body, fallback) {
    var error = body && body.error;
    return (error && typeof error === 'object' && error.message) || fallback;
  }

  function money(amount, currency) {
    var sym = { GBP: '£', USD: '$', INR: '₹' }[currency] || (currency + ' ');
    return sym + Number(amount).toLocaleString(undefined, { minimumFractionDigits: Number(amount) % 1 ? 2 : 0 });
  }

  function planPrice() {
    if (!plan) return '';
    return money(plan.price_monthly, (plan.currency || 'GBP').toUpperCase());
  }

  // The spinner goes beside the label, where the button's own gap spaces it (no inline style)
  function setButton(label, disabled, spinning) {
    var b = $('submit-button'), l = $('submit-label');
    b.disabled = disabled;
    var old = b.querySelector('.sa-btn__spin');
    if (old) old.remove();
    if (spinning) {
      var spin = document.createElement('span');
      spin.className = 'sa-btn__spin';
      spin.setAttribute('aria-hidden', 'true');
      b.insertBefore(spin, l);
    }
    l.textContent = label;
  }

  function longDate(d) {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // GET /api/user/subscription's data: { hasSubscription, isAdmin, region?, subscription? }
  async function readAccount() {
    var r = await fetch('/api/user/subscription');
    if (r.status === 401) { location.href = '/login.html'; return null; }
    var body = await r.json().catch(function () { return null; });
    return (body && body.data) || null;
  }

  async function loadPlan() {
    var account = null;
    try { account = await readAccount(); } catch (e) { /* the plan still loads */ }
    var sub = account && account.subscription;

    // Plan code from ?plan=…, else the region's Trader plan
    planCode = new URLSearchParams(location.search).get('plan');
    if (!planCode) {
      var region = (account && (account.region || (sub && sub.region))) || 'UK';
      planCode = { UK: 'BASIC_UK', US: 'BASIC_US', India: 'BASIC_IN' }[region] || 'BASIC_UK';
    }
    var r = await fetch('/api/subscription-plans/' + encodeURIComponent(planCode));
    if (!r.ok) throw new Error('Could not load the plan. Refresh to try again.');
    var body = await r.json();
    plan = (body && body.data && body.data.plan) || null;
    if (!plan) throw new Error('Could not load the plan. Refresh to try again.');
    var price = planPrice();
    var currency = (plan.currency || 'GBP').toUpperCase();

    $('r-plan').textContent = (plan.plan_name || 'Trader') + ' — monthly';
    $('r-total').textContent = price;
    $('r-tax-k').textContent = currency === 'INR' ? 'GST' : currency === 'GBP' ? 'VAT' : 'Sales tax';
    $('r-tax-v').textContent = currency === 'USD' ? 'Not added' : 'Included';
    var d = new Date();
    $('r-first').textContent = longDate(d);
    var nb = new Date(d); nb.setMonth(nb.getMonth() + 1);
    $('r-recurring').textContent = 'Then ' + price + ' a month. Next billing ' + longDate(nb) + '.';

    // Free days used, from the trial row's own dates
    if (sub && sub.trial_start_date && sub.trial_end_date) {
      var total = Math.round((new Date(sub.trial_end_date) - new Date(sub.trial_start_date)) / 864e5);
      var used = Math.min(total, Math.max(0, Math.floor((Date.now() - new Date(sub.trial_start_date)) / 864e5)));
      $('r-trial').textContent = used + ' of ' + total;
    }
  }

  // While the paid checkout is switched off, /api/stripe/config does not exist (404). That is not a failed
  // payment, so the banner says so in its title.
  var NOT_OPEN = 'Payments are not open yet. Nothing was charged.';
  function failOrClosed(message) {
    if (message === NOT_OPEN) fail('Nothing was charged.', 'Payments are not open yet');
    else fail(message);
  }
  async function checkoutOpen() {
    var r = await fetch('/api/stripe/config');
    var body = await r.json().catch(function () { return null; });
    if (!r.ok || !(body && body.data && body.data.open)) throw new Error(NOT_OPEN);
  }

  async function pay() {
    if (busy || !plan) return;
    busy = true;
    clearFail();
    setButton('Opening the secure payment page…', true, true);
    try {
      var r = await fetch('/api/stripe/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode: planCode, billingPeriod: BILLING_PERIOD })
      });
      if (r.status === 401) { location.href = '/login.html'; return; }
      if (r.status === 404) throw new Error(NOT_OPEN);
      var body = await r.json().catch(function () { return null; });
      var url = r.ok && body && body.data && body.data.url;
      if (!url) throw new Error(errorText(body, 'The payment page could not be opened. Nothing was charged.'));
      // Stripe takes the card on its own page, then sends the browser back to the receipt
      location.assign(url);
    } catch (e) {
      failOrClosed(e.message);
      setButton('Pay ' + planPrice() + ' a month', false, false);
      busy = false;
    }
  }

  // Back from Stripe's page through the browser's back button: the page comes from the cache, still busy
  window.addEventListener('pageshow', function (ev) {
    if (ev.persisted && plan) {
      busy = false;
      setButton('Pay ' + planPrice() + ' a month', false, false);
    }
  });

  document.addEventListener('DOMContentLoaded', async function () {
    $('submit-button').addEventListener('click', pay);
    try {
      await loadPlan();
      await checkoutOpen();
      if (new URLSearchParams(location.search).get('cancelled')) {
        fail('You left the payment page before paying. Nothing was charged.');
      }
      setButton('Pay ' + planPrice() + ' a month', false, false);
    } catch (e) {
      failOrClosed(e.message);
      setButton('Unavailable', true, false);
    }
  });
})();
