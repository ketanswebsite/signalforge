// Spec reference only — renamed from TrialLifecycle.jsx so the design-system compiler ignores it.
const { Button, Badge, Callout, LegalNote, SegmentedControl, Wordmark, Icon, Card, Stat } = window.SutrAlgoDesignSystem_eaaf37;

const STATES = {
  day0:  { label: 'Day 1',        days: 90, tone: null },
  day76: { label: '14 days left', days: 14, tone: 'accent' },
  day85: { label: '5 days left',  days: 5,  tone: 'warn' },
  day91: { label: 'Expired',      days: 0,  tone: null }
};

function MockBar({ chip }) {
  return (
    <header className="sa-appbar" style={{ position: 'static' }}>
      <div className="sa-appbar__in">
        <span className="sa-appbar__brand"><Wordmark size={19} showMark /></span>
        <nav className="sa-appbar__nav">
          {[['radar', 'Scanner'], ['account_balance_wallet', 'Positions'], ['science', 'Simulator']].map(([ic, l], i) => (
            <a key={l} className="sa-appbar__link" href="#" aria-current={i === 0 ? 'page' : undefined} onClick={e => e.preventDefault()}><Icon name={ic} size={19} />{l}</a>
          ))}
        </nav>
        <div className="sa-appbar__end">{chip}</div>
      </div>
    </header>
  );
}

function Countdown({ days, warn }) {
  return (
    <span className={'sa-countdown' + (warn ? ' sa-countdown--warn' : '')}>
      <span className="sa-countdown__num">{days}</span>
      free days left · <a href="#" onClick={e => e.preventDefault()}>keep the signals</a>
    </span>
  );
}

function Day0() {
  return (
    <section style={{ background: 'var(--text)', borderBottom: '3px solid var(--frame)' }}>
      <div className="sa-page sa-page--narrow" style={{ textAlign: 'center', paddingTop: 'var(--s-8)', paddingBottom: 'var(--s-8)' }}>
        <span style={{ display: 'inline-block', background: 'var(--gold-on-band)', color: 'var(--text)', fontSize: 'var(--size-xs)', fontWeight: 700, letterSpacing: 'var(--track-label)', textTransform: 'uppercase', padding: '5px 11px', marginBottom: 'var(--s-4)' }}>Explorer · free</span>
        <h1 style={{ fontSize: 'var(--size-hero)', color: 'var(--bg)', marginBottom: 'var(--s-3)' }}>Your 90 days start now</h1>
        <p style={{ color: 'var(--bg)', opacity: .85, fontSize: 'var(--size-body-lg)', maxWidth: '44ch', margin: '0 auto var(--s-5)' }}>
          8 August to 6 November 2026. Every signal, every market, nothing held back — long enough to judge the rule properly.
        </p>
        <div className="sa-row" style={{ justifyContent: 'center' }}>
          <Button size="lg" icon="radar" style={{ background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--bg)', boxShadow: '4px 4px 0 var(--gold-on-band)' }}>Go to the Scanner</Button>
          <Button size="lg" variant="secondary" icon="send" style={{ color: 'var(--bg)', borderColor: 'var(--bg)' }}>Connect Telegram</Button>
        </div>
        <p style={{ color: 'var(--bg)', opacity: .6, fontSize: 'var(--size-sm)', marginTop: 'var(--s-4)' }}>The first scan for you runs at 07:00 UK tomorrow. No card on file — day 91 simply asks.</p>
      </div>
    </section>
  );
}

function Counting({ days, warn }) {
  return (
    <>
      <MockBar chip={<Countdown days={days} warn={warn} />} />
      <main className="sa-page sa-page--narrow">
        <Callout tone={warn ? 'warn' : 'neutral'} icon="hourglass_top"
          title={days + ' free days left'}
          action={<Button size="sm">See plans</Button>}>
          {warn
            ? 'After 6 November the scanner stops sending you signals. Your positions and history stay exactly as they are.'
            : 'No action needed yet — this is just so day 91 is never a surprise. Upgrading now changes nothing until the free days run out.'}
        </Callout>
        <p style={{ fontSize: 'var(--size-sm)', color: 'var(--text-3)', marginTop: 'var(--s-4)' }}>
          The chip in the header appears at 14 days and turns amber at 5. It links straight to plans and never blocks the screen.
        </p>
        <div style={{ marginTop: 'var(--s-8)' }}><LegalNote /></div>
      </main>
    </>
  );
}

function Expired() {
  return (
    <>
      <MockBar chip={<Badge tone="neutral" icon="lock">Read-only</Badge>} />
      <main className="sa-page sa-page--narrow">
        <div className="sa-grid sa-grid--split" style={{ alignItems: 'start' }}>
          <div className="sa-stack" style={{ gap: 'var(--s-4)' }}>
            <h1 style={{ fontSize: 'var(--size-h2)' }}>Your 90 days are done</h1>
            <p>The scanner has stopped sending you signals, and the app is read-only. Nothing was deleted — every trade, position and simulation is still here, and picking up where you left off is one step.</p>
            <div className="sa-row">
              <Button size="lg" icon="workspace_premium">Choose Trader</Button>
            </div>
            <p style={{ fontSize: 'var(--size-sm)', color: 'var(--text-3)' }}>Prefer to leave? Your data page can export everything first.</p>
          </div>
          <Card tone="sunk">
            <h3 className="sa-card__title" style={{ marginBottom: 'var(--s-4)' }}>What your 90 days did</h3>
            <div className="sa-stack" style={{ gap: 'var(--s-4)' }}>
              <Stat size="sm" label="Signals sent to you" value="61" context="Across India, the UK and the US." />
              <Stat size="sm" label="Positions you took" value="17" tone="gain" context="11 hit the target, 4 stopped, 2 timed out." />
              <Stat size="sm" label="Your result" value="+4.6%" tone="gain" context="On the money you put into signals. Not a promise about the next 90." />
            </div>
          </Card>
        </div>
        <div style={{ marginTop: 'var(--s-8)' }}><LegalNote /></div>
      </main>
    </>
  );
}

function LifecycleApp() {
  const [st, setSt] = React.useState('day0');
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '2px solid var(--frame)', padding: '10px var(--gutter)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 'var(--track-label)' }}>Trial arc</span>
        <SegmentedControl value={st} onChange={setSt} label="State" options={Object.keys(STATES).map(k => ({ value: k, label: STATES[k].label }))} />
      </div>
      {st === 'day0' ? <><Day0 /><main className="sa-page sa-page--narrow"><LegalNote /></main></> :
       st === 'day76' ? <Counting days={14} warn={false} /> :
       st === 'day85' ? <Counting days={5} warn={true} /> :
       <Expired />}
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<LifecycleApp />);
