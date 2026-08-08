// Spec reference only — renamed from ScannerScreen.jsx so the design-system compiler ignores it.
const { Card, Button, Field, Select, SegmentedControl, Checkbox, Stat, ProgressBar, MarketStatus,
        EmptyState, Badge, Callout, Sheet, ChartFrame, Icon } = window.SutrAlgoDesignSystem_eaaf37;

function SignalRow({ s, onTake }) {
  return (
    <div className="sa-pos" style={{ gap: 'var(--s-3)' }}>
      <div className="sa-pos__top">
        <div>
          <div className="sa-pos__sym">{s.symbol}</div>
          <div className="sa-pos__name">{s.name} · {s.market}</div>
        </div>
        <Badge tone={s.confirmed ? 'gain' : 'warn'} icon={s.confirmed ? 'check' : 'schedule'}>
          {s.confirmed ? 'Weekly confirmed' : 'Waiting on weekly'}
        </Badge>
      </div>
      <div className="sa-pos__grid">
        <div><span className="sa-pos__k">Buy around</span><span className="sa-pos__v">{s.price}</span></div>
        <div><span className="sa-pos__k">Sells at +8%</span><span className="sa-pos__v" style={{ color: 'var(--gain)' }}>{s.target}</span></div>
        <div><span className="sa-pos__k">Stops at −5%</span><span className="sa-pos__v" style={{ color: 'var(--loss)' }}>{s.stop}</span></div>
      </div>
      <div>
        <div className="sa-prog__meta"><span>Similar setups worked {s.confidence}% of the time</span></div>
        <div className="sa-prog__track" style={{ marginTop: 4 }}><div className="sa-prog__fill" style={{ width: s.confidence + '%' }} /></div>
      </div>
      <div className="sa-pos__foot">
        <span className="sa-stat__context">Based on 5 years of this stock's history.</span>
        <Button size="sm" onClick={() => onTake(s)}>Take this signal</Button>
      </div>
    </div>
  );
}

function ScannerScreen({ theme, onNavigate }) {
  const [state, setState] = React.useState('idle');
  const [progress, setProgress] = React.useState(0);
  const [taking, setTaking] = React.useState(null);
  const [amount, setAmount] = React.useState('500');

  const run = () => {
    setState('running'); setProgress(0);
    let p = 0;
    const t = setInterval(() => {
      p += 12; setProgress(Math.min(p, 100));
      if (p >= 100) { clearInterval(t); setState('done'); }
    }, 180);
  };

  return (
    <>
      <PageHead title="Scanner"
        sub="One button. It checks every stock on your watchlist for the setup the formula looks for."
        actions={<Button icon={state === 'running' ? undefined : 'play_arrow'} loading={state === 'running'} onClick={run}>
          {state === 'running' ? 'Checking…' : 'Run the scan'}</Button>} />

      <div className="sa-row" style={{ marginBottom: 'var(--s-5)' }}>
        {window.SA.markets.map(m => <MarketStatus key={m.market} {...m} />)}
      </div>

      <Card title="What to look at" hint="Change these and run the scan again." style={{ marginBottom: 'var(--s-5)' }}>
        <div className="sa-grid sa-grid--3">
          <Select label="Watchlist" defaultValue="NIFTY 500" options={['NIFTY 50', 'NIFTY 500', 'FTSE 100', 'FTSE 250', 'S&P 500']} />
          <Field label="How much per trade" icon="payments" defaultValue={amount} onChange={e => setAmount(e.target.value)}
            hint="The same amount goes into every signal." />
          <div className="sa-field">
            <span className="sa-field__label">Only show</span>
            <SegmentedControl options={[{ value: 'strong', label: 'Strong setups' }, { value: 'all', label: 'Everything' }]} />
          </div>
        </div>
        <div className="sa-row" style={{ marginTop: 'var(--s-4)', gap: 'var(--s-5)' }}>
          <Checkbox label="Wait for the weekly chart to agree" defaultChecked />
          <Checkbox label="Skip anything I already hold" defaultChecked />
        </div>
      </Card>

      {state === 'running' ? (
        <Card style={{ marginBottom: 'var(--s-5)' }}>
          <ProgressBar label="Checking NIFTY 500" value={progress} detail={Math.round(progress * 5) + ' of 500 stocks checked'} />
        </Card>
      ) : null}

      {state === 'done' ? (
        <>
          <div className="sa-grid sa-grid--3" style={{ marginBottom: 'var(--s-5)' }}>
            <Card><Stat label="Setups found today" value="3" context="Out of 500 stocks checked. A quiet day is normal." /></Card>
            <Card><Stat label="Average for this watchlist" value="4.1" size="sm" context="Over the last 90 trading days." /></Card>
            <Card><Stat label="Next automatic scan" value="07:00" size="sm" context="Tomorrow morning, UK time. You'll get a Telegram message." /></Card>
          </div>

          <Card title="What the scan found" hint="Each one already has its sell price and stop worked out." flush>
            <div className="sa-grid sa-grid--2" style={{ padding: '0 var(--s-5) var(--s-5)' }}>
              {window.SA.signals.map(s => <SignalRow key={s.symbol} s={s} onTake={setTaking} />)}
            </div>
          </Card>
        </>
      ) : state === 'idle' ? (
        <Card flush>
          <EmptyState icon="radar" title="Nothing scanned yet"
            action={<Button icon="play_arrow" onClick={run}>Run the scan</Button>}>
            The scan checks every stock on your watchlist against the formula. It takes about ten seconds.
          </EmptyState>
        </Card>
      ) : null}

      {taking ? (
        <Sheet title={'Take the ' + taking.symbol + ' signal?'} onClose={() => setTaking(null)}
          footer={<>
            <Button variant="secondary" onClick={() => setTaking(null)}>Not now</Button>
            <Button onClick={() => { setTaking(null); onNavigate('positions'); }}>Add to positions</Button>
          </>}>
          <Callout tone="info">This records the trade so the app can track it. It does not place a real order with your broker.</Callout>
          <Field label="How much are you putting in" icon="payments" defaultValue={amount} />
          <div className="sa-grid sa-grid--3">
            <Stat size="sm" label="Buy around" value={taking.price} />
            <Stat size="sm" label="Sells at" value={taking.target} tone="gain" context="+8%" />
            <Stat size="sm" label="Stops at" value={taking.stop} tone="loss" context="−5%" />
          </div>
          <p style={{ fontSize: 'var(--size-sm)' }}>If neither price is reached, it sells automatically on day 30.</p>
        </Sheet>
      ) : null}
    </>
  );
}
Object.assign(window, { ScannerScreen, SignalRow });
