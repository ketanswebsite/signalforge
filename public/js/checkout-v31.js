/* Checkout (v3.1 Poster) — single-screen flow over the existing Stripe rails:
   /api/subscription-plans/:code  → price/currency for the receipt
   /api/stripe/config             → publishable key
   /api/stripe/create-subscription→ clientSecret
   stripe.confirmCardPayment      → 3DS + charge, then /checkout-success.html */
(function () {
  'use strict';

  var stripe = null, card = null, planCode = null, plan = null, busy = false;

  function $(id) { return document.getElementById(id); }

  function fail(msg) {
    var box = $('card-errors');
    if (msg) $('card-errors-text').textContent = msg;
    box.hidden = false;
    $('payframe').classList.add('sa-payframe--error');
  }
  function clearFail() {
    $('card-errors').hidden = true;
    $('payframe').classList.remove('sa-payframe--error');
  }

  function money(amount, currency) {
    var sym = { GBP: '£', USD: '$', INR: '₹' }[currency] || (currency + ' ');
    return sym + Number(amount).toLocaleString(undefined, { minimumFractionDigits: Number(amount) % 1 ? 2 : 0 });
  }

  function planPrice() {
    if (!plan) return '';
    return money(plan.price_monthly || plan.priceMonthly || plan.price || plan.amount,
      (plan.currency || 'GBP').toUpperCase());
  }

  function setButton(label, disabled, spinning) {
    var b = $('submit-button'), l = $('submit-label');
    b.disabled = disabled;
    l.textContent = '';
    if (spinning) {
      var spin = document.createElement('span');
      spin.className = 'sa-btn__spin';
      spin.style.marginRight = '8px';
      l.appendChild(spin);
    }
    l.appendChild(document.createTextNode(label));
  }

  async function loadPlan() {
    // Plan code from ?plan=…; fall back to the user's region via their subscription.
    planCode = new URLSearchParams(location.search).get('plan');
    if (!planCode) {
      try {
        var subR = await fetch('/api/user/subscription');
        if (subR.status === 401) { location.href = '/login.html'; return; }
        var subBody = await subR.json();
        var sub = (subBody && subBody.data) || subBody;
        var region = (sub && (sub.region || (sub.subscription && sub.subscription.region))) || 'UK';
        planCode = { UK: 'BASIC_UK', US: 'BASIC_US', India: 'BASIC_IN' }[region] || 'BASIC_UK';
      } catch (e) { planCode = 'BASIC_UK'; }
    }
    var r = await fetch('/api/subscription-plans/' + encodeURIComponent(planCode));
    if (!r.ok) throw new Error('Could not load the plan. Refresh to try again.');
    var body = await r.json();
    var env = body && body.data ? body.data : body;
    plan = (env && env.plan) || env || {};
    var price = planPrice();
    var currency = (plan.currency || 'GBP').toUpperCase();

    $('r-plan').textContent = (plan.plan_name || plan.name || 'Trader') + ' — monthly';
    $('r-total').textContent = price;
    $('r-tax-k').textContent = currency === 'INR' ? 'GST' : currency === 'GBP' ? 'VAT' : 'Sales tax';
    $('r-tax-v').textContent = currency === 'USD' ? 'Not added' : 'Included';
    var d = new Date();
    $('r-first').textContent = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    var nb = new Date(d); nb.setMonth(nb.getMonth() + 1);
    $('r-recurring').textContent = 'Then ' + price + ' a month. Next billing ' +
      nb.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + '.';
    try {
      var sb = await (await fetch('/api/user/subscription')).json();
      var s = (sb && sb.data) || sb;
      var used = s && s.trialDaysUsed != null ? s.trialDaysUsed : (s && s.subscription && s.subscription.trialDaysUsed);
      $('r-trial').textContent = used != null ? used + ' of 90' : '—';
    } catch (e) { /* leave the dash */ }
  }

  async function mountStripe() {
    var cfg = await (await fetch('/api/stripe/config')).json();
    if (!cfg || !cfg.publishableKey) throw new Error('Payments are not configured. Nothing was charged.');
    stripe = Stripe(cfg.publishableKey);
    var slot = $('card-element');
    slot.textContent = '';
    slot.classList.add('is-mounted');
    card = stripe.elements({ appearance: { theme: 'stripe' } }).create('card', { hidePostalCode: false });
    card.mount('#card-element');
    card.on('change', function (ev) {
      if (ev.error) fail(ev.error.message); else clearFail();
    });
  }

  async function pay() {
    if (busy || !stripe || !card || !plan) return;
    busy = true;
    clearFail();
    setButton('Confirming…', true, true);
    try {
      var create = await fetch('/api/stripe/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode: planCode })
      });
      var created = await create.json();
      if (!create.ok || created.error) throw new Error(created.error || 'The subscription could not be created. Nothing was charged.');
      var clientSecret = created.clientSecret || (created.data && created.data.clientSecret);
      if (!clientSecret) throw new Error('The payment could not be started. Nothing was charged.');

      var result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: card, billing_details: { name: $('card-holder-name').value || undefined } }
      });
      if (result.error) throw new Error(result.error.message);
      if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
        location.href = '/checkout-success.html';
        return;
      }
      throw new Error('The payment did not complete. Nothing was charged.');
    } catch (e) {
      fail(e.message);
      setButton('Pay ' + planPrice() + ' a month', false, false);
    } finally {
      busy = false;
    }
  }

  document.addEventListener('DOMContentLoaded', async function () {
    $('submit-button').addEventListener('click', pay);
    try {
      await loadPlan();
      await mountStripe();
      setButton('Pay ' + planPrice() + ' a month', false, false);
    } catch (e) {
      fail(e.message);
      setButton('Unavailable', true, false);
    }
  });
})();
