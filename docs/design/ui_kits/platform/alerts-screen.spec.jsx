// Spec reference only — renamed from AlertsScreen.jsx so the design-system compiler ignores it.
const { Card, Button, Switch, Select, Callout, Badge, Stat, EmptyState, Icon, Field } = window.SutrAlgoDesignSystem_eaaf37;

function Step({ n, title, children, done }) {
  return (
    <div className="sa-row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 'var(--s-3)' }}>
      <span className="sa-avatar" style={{ width: 30, height: 30, fontSize: 13, background: done ? 'var(--gain-soft)' : 'var(--accent-soft)', color: done ? 'var(--gain)' : 'var(--accent)' }}>
        {done ? <Icon name="check" size={18} /> : n}
      </span>
      <div>
        <div style={{ fontWeight: 'var(--w-medium)', color: 'var(--text)' }}>{title}</div>
        <p style={{ fontSize: 'var(--size-sm)', marginTop: 2 }}>{children}</p>
      </div>
    </div>
  );
}

function AlertsScreen() {
  const [linked, setLinked] = React.useState(false);
  const [prefs, setPrefs] = React.useState({ signals: true, morning: true, exits: true, weekly: false });
  const set = k => e => setPrefs({ ...prefs, [k]: e.target.checked });

  return (
    <>
      <PageHead title="Alerts"
        sub="Get told when something happens instead of checking the app." />

      <div className="sa-grid sa-grid--split">
        <div className="sa-stack">
          <Card title="Telegram" hint={linked ? 'Connected — messages are on their way.' : 'Three steps, about a minute.'}
            actions={linked ? <Badge tone="gain" icon="check">Connected</Badge> : null}>
            {linked ? (
              <Callout tone="gain" title="You're all set">
                Messages go to <strong>@ketanj</strong>. Connected on 7 August 2026.
              </Callout>
            ) : (
              <div className="sa-stack" style={{ gap: 'var(--s-4)' }}>
                <Step n="1" title="Open the bot">Tap the button below and Telegram will open on this device.</Step>
                <Step n="2" title="Send /start">The bot replies straight away to confirm it's you.</Step>
                <Step n="3" title="That's it">Alerts start with the next scan. Nothing else to set up.</Step>
                <div className="sa-row">
                  <Button icon="send" onClick={() => setLinked(true)}>Open Telegram</Button>
                  <Button variant="quiet" icon="refresh">I've already done it</Button>
                </div>
                <p style={{ fontSize: 'var(--size-xs)', color: 'var(--text-3)' }}>
                  Prefer to search? The bot is <strong style={{ fontFamily: 'var(--font-mono)' }}>@MySignalForgeBot</strong>.
                </p>
              </div>
            )}
          </Card>

          <Card title="What you want to hear about" hint="Changes save as you make them.">
            <div className="sa-stack" style={{ gap: 'var(--s-4)' }}>
              <Switch checked={prefs.signals} onChange={set('signals')} label="New signals"
                description="A message as soon as the scanner finds a setup, with the buy price, target and stop." />
              <Switch checked={prefs.morning} onChange={set('morning')} label="The 07:00 round-up"
                description="One message every weekday morning with the strongest setups overnight." />
              <Switch checked={prefs.exits} onChange={set('exits')} label="When something sells"
                description="Told the moment a position hits its target, its stop, or day 30." />
              <Switch checked={prefs.weekly} onChange={set('weekly')} label="Weekly summary"
                description="Sunday evening: what you made, what you lost, what's still open." />
            </div>
          </Card>
        </div>

        <div className="sa-stack">
          <Card title="What a message looks like" hint="Nothing to decode — the numbers are already worked out." tone="sunk">
            <div style={{ background: 'var(--surface)', border: '2px solid var(--frame)', padding: 'var(--s-4)', fontSize: 'var(--size-sm)', boxShadow: 'var(--shadow-1)' }}>
              <div className="sa-row" style={{ gap: 8, marginBottom: 10 }}>
                <span className="sa-avatar" style={{ width: 26, height: 26, fontSize: 11 }}>SA</span>
                <strong style={{ fontSize: 'var(--size-sm)' }}>SutrAlgo</strong>
                <span style={{ color: 'var(--text-3)', fontSize: 'var(--size-xs)', marginLeft: 'auto' }}>07:00</span>
              </div>
              <p style={{ color: 'var(--text)', marginBottom: 8 }}>New setup — <strong>BAJFINANCE.NS</strong> (Bajaj Finance)</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 'var(--size-xs)', color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
                <span>Buy around</span><strong style={{ textAlign: 'right' }}>₹7,215.40</strong>
                <span>Sells at (+8%)</span><strong style={{ textAlign: 'right', color: 'var(--gain)' }}>₹7,792.63</strong>
                <span>Stops at (−5%)</span><strong style={{ textAlign: 'right', color: 'var(--loss)' }}>₹6,854.63</strong>
                <span>Sells anyway</span><strong style={{ textAlign: 'right' }}>6 Sep</strong>
              </div>
              <p style={{ fontSize: 'var(--size-xs)', color: 'var(--text-3)', marginTop: 10 }}>
                Similar setups worked 78% of the time over five years. Educational only — not advice.
              </p>
            </div>
          </Card>

          <Card title="Recent alerts">
            <div className="sa-stack" style={{ gap: 'var(--s-3)' }}>
              {[['New setup — GSK.L', 'Today, 07:00', 'accent'],
                ['Sold RELIANCE.NS at +8.00%', 'Yesterday, 10:14', 'gain'],
                ['Sold MSFT at −5.00%', '26 Feb, 15:32', 'loss']].map(([t, when, tone]) => (
                <div key={t} className="sa-row" style={{ justifyContent: 'space-between', gap: 'var(--s-3)' }}>
                  <span style={{ fontSize: 'var(--size-sm)', color: 'var(--text)' }}>{t}</span>
                  <span style={{ fontSize: 'var(--size-xs)', color: 'var(--text-3)' }}>{when}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
Object.assign(window, { AlertsScreen, Step });
