// Spec reference only — renamed from CheckoutFlow.jsx so the design-system compiler ignores it.
const { Button, Badge, Callout, LegalNote, SegmentedControl, Wordmark, Icon } = window.SutrAlgoDesignSystem_eaaf37;

function CheckoutBar({ note }) {
  return (
    <header className="sa-appbar">
      <div className="sa-appbar__in" style={{ maxWidth: 'var(--page-max)' }}>
        <span className="sa-appbar__brand"><Wordmark size={19} showMark /></span>
        <div className="sa-appbar__end">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--bg)', opacity: .8, fontSize: 'var(--size-xs)', fontWeight: 700 }}>
            <Icon name="lock" size={16} />{note}
          </span>
        </div>
      </div>
    </header>
  );
}

function Receipt({ rows, total }) {
  return (
    <div className="sa-receipt">
      {rows.map(([k, v]) => (
        <div className="sa-receipt__row" key={k}><span className="sa-receipt__k">{k}</span><span className="sa-receipt__v">{v}</span></div>
      ))}
      <div className="sa-receipt__row sa-receipt__row--total"><span className="sa-receipt__k">{total[0]}</span><span className="sa-receipt__v">{total[1]}</span></div>
    </div>
  );
}

function PayFrame({ provider, state }) {
  return (
    <div className={'sa-payframe' + (state === 'error' ? ' sa-payframe--error' : '')}>
      <div className="sa-payframe__head">
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.02em' }}>Card details</span>
        <Badge tone="neutral" icon="lock">Handled by {provider}</Badge>
      </div>
      <div className="sa-payframe__slot" aria-label={provider + ' payment element'}>
        {state === 'processing' ? (
          <><span className="sa-btn__spin" style={{ width: 22, height: 22, color: 'var(--accent)' }} /><span>Confirming with your bank…</span></>
        ) : (
          <>
            <Icon name="credit_card" size={26} />
            <span>{provider}'s own card element mounts here —<br />number, expiry and CVC never touch SutrAlgo.</span>
          </>
        )}
      </div>
    </div>
  );
}

function CheckoutScreen({ region, setRegion, feed, state, onPay, onFailDemo }) {
  const price = feed.currency + feed.amount;
  return (
    <main className="sa-page sa-page--narrow">
      <div className="sa-spread" style={{ marginBottom: 'var(--s-5)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--size-h2)' }}>Checkout</h1>
          <p style={{ marginTop: 6 }}>Trader plan, billed monthly. This is the only screen with a card form in it.</p>
        </div>
        <SegmentedControl value={region} onChange={setRegion} label="Region" options={['UK', 'US', 'India']} />
      </div>

      <div className="sa-grid sa-grid--split" style={{ alignItems: 'start' }}>
        <div className="sa-stack" style={{ gap: 'var(--s-4)' }}>
          {state === 'error' ? (
            <Callout tone="loss" title="The payment didn't go through">
              Your bank declined the card and nothing was charged. Trying a different card usually fixes it — or see <a href="#" onClick={e => { e.preventDefault(); onFailDemo(); }}>why payments fail</a>.
            </Callout>
          ) : null}
          <PayFrame provider={feed.provider} state={state} />
          <p style={{ fontSize: 'var(--size-xs)', color: 'var(--text-3)' }}>{window.SACheckout.agreeing}</p>
          <Button size="lg" block loading={state === 'processing'} onClick={onPay}>
            {state === 'processing' ? 'Confirming…' : 'Pay ' + price + ' a month'}
          </Button>
        </div>

        <div className="sa-stack" style={{ gap: 'var(--s-4)' }}>
          <Receipt
            rows={[['Plan', 'Trader — monthly'], ['Free days used', '48 of 90'], ['First payment', window.SACheckout.paidOn], [feed.tax, '—']]}
            total={['Due today', price]} />
          <Callout tone="neutral" icon="event_repeat">
            Then {price} on the 8th of each month. Next billing {feed.nextBilling}.
          </Callout>
        </div>
      </div>
      <div style={{ marginTop: 'var(--s-8)' }}><LegalNote /></div>
    </main>
  );
}

function SuccessScreen({ feed, onScanner }) {
  const price = feed.currency + feed.amount;
  return (
    <main className="sa-page sa-page--narrow" style={{ maxWidth: 660 }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--s-5)' }}>
        <span className="sa-empty__icon" style={{ margin: '0 auto var(--s-3)', background: 'var(--gain-soft)' }}><Icon name="check" size={26} /></span>
        <h1 style={{ fontSize: 'var(--size-h2)' }}>You're on Trader</h1>
        <p style={{ marginTop: 6 }}>A copy of this receipt is on its way to your email.</p>
      </div>
      <Receipt
        rows={[['Plan', 'Trader — monthly'], ['Paid', window.SACheckout.paidOn], ['Payment method', window.SACheckout.card.brand + ' ···· ' + window.SACheckout.card.last4], ['Next billing', feed.nextBilling]]}
        total={['Paid today', price]} />
      <div className="sa-card" style={{ marginTop: 'var(--s-4)' }}>
        <h3 className="sa-card__title" style={{ marginBottom: 'var(--s-3)' }}>What happens next</h3>
        <div className="sa-stack" style={{ gap: 'var(--s-3)' }}>
          <span style={{ display: 'flex', gap: 10, fontSize: 'var(--size-sm)', color: 'var(--text-2)' }}><Icon name="schedule" size={19} style={{ color: 'var(--accent)' }} />Signals resume with tomorrow's 07:00 UK scan — nothing to set up.</span>
          <span style={{ display: 'flex', gap: 10, fontSize: 'var(--size-sm)', color: 'var(--text-2)' }}><Icon name="send" size={19} style={{ color: 'var(--accent)' }} />Not on Telegram yet? Connecting takes a minute and the signals come to your phone.</span>
        </div>
        <div className="sa-row" style={{ marginTop: 'var(--s-4)' }}>
          <Button icon="radar" onClick={onScanner}>Go to the Scanner</Button>
          <Button variant="secondary" icon="send">Connect Telegram</Button>
        </div>
      </div>
      <div style={{ marginTop: 'var(--s-8)' }}><LegalNote /></div>
    </main>
  );
}

function FailureScreen({ onRetry }) {
  return (
    <main className="sa-page sa-page--narrow" style={{ maxWidth: 660 }}>
      <h1 style={{ fontSize: 'var(--size-h2)', marginBottom: 6 }}>The payment didn't complete</h1>
      <p style={{ marginBottom: 'var(--s-5)' }}>Nothing was charged. It's almost always one of these three.</p>
      <div className="sa-stack" style={{ gap: 'var(--s-3)', marginBottom: 'var(--s-5)' }}>
        {window.SACheckout.failures.map((fl, i) => (
          <div key={fl.id} className="sa-dl">
            <span className="sa-dl__icon" style={{ background: 'var(--loss-soft)' }}><span style={{ fontFamily: 'var(--font-display)', fontSize: 15 }}>{i + 1}</span></span>
            <span className="sa-dl__meta">
              <span className="sa-dl__name">{fl.title}</span>
              <span className="sa-dl__hint" style={{ display: 'block' }}>{fl.what}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="sa-row">
        <Button size="lg" icon="refresh" onClick={onRetry}>Try the payment again</Button>
        <Button size="lg" variant="secondary">Use a different card</Button>
      </div>
      <p style={{ fontSize: 'var(--size-sm)', color: 'var(--text-3)', marginTop: 'var(--s-4)' }}>Your free days keep counting in the meantime — you lose nothing by trying tomorrow.</p>
      <div style={{ marginTop: 'var(--s-8)' }}><LegalNote /></div>
    </main>
  );
}

function CheckoutApp() {
  const [route, setRoute] = React.useState('pay');
  const [region, setRegion] = React.useState('UK');
  const [state, setState] = React.useState('idle');
  const feed = window.SACheckout.regions[region];
  const pay = () => {
    setState('processing');
    setTimeout(() => {
      if (window.__sa_fail) { setState('error'); window.__sa_fail = false; }
      else { setState('idle'); setRoute('success'); }
    }, 1400);
  };
  const note = route === 'pay' ? 'Secure checkout' : route === 'success' ? 'Receipt' : 'Payment';
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <CheckoutBar note={note} />
      {route === 'pay' ? <CheckoutScreen region={region} setRegion={setRegion} feed={feed} state={state} onPay={pay} onFailDemo={() => setRoute('failure')} /> :
       route === 'success' ? <SuccessScreen feed={feed} onScanner={() => { setRoute('pay'); setState('idle'); }} /> :
       <FailureScreen onRetry={() => { setRoute('pay'); setState('idle'); }} />}
      <div style={{ position: 'fixed', bottom: 10, right: 10, opacity: .55 }}>
        <button className="sa-btn sa-btn--quiet sa-btn--sm" onClick={() => { window.__sa_fail = true; setRoute('pay'); }}>Demo: next payment fails</button>
      </div>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<CheckoutApp />);
