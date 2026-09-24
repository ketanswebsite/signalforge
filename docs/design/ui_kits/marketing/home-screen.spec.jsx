// Spec reference only — renamed from HomeScreen.jsx so the design-system compiler ignores it.
const { Button, SectionHeader, FeatureCard, Card, Stat, Badge, Icon, MarketStatus } = window.SutrAlgoDesignSystem_eaaf37;

function RuleChip({ n, label, tone }) {
  return (
    <div style={{ flex: 1, minWidth: 170, border: '2px solid var(--frame)', padding: 'var(--s-4)', background: 'var(--surface)', boxShadow: 'var(--shadow-pop)' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--size-stat)', fontWeight: 400, letterSpacing: '-.01em', color: tone }}>{n}</div>
      <div style={{ fontSize: 'var(--size-sm)', color: 'var(--text-2)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function HomeScreen({ onNavigate }) {
  return (
    <>
      <section style={{ background: 'var(--text)', borderBottom: '3px solid var(--frame)', paddingBottom: 72 }}>
        <div className="sa-grid sa-grid--split" style={{ maxWidth: 'var(--page-max)', margin: '0 auto', padding: 'var(--s-8) var(--gutter) 0', gap: 'var(--s-8)', alignItems: 'center' }}>
          <div>
            <span style={{ display: 'inline-block', background: 'var(--gold-on-band)', color: 'var(--text)', fontSize: 'var(--size-xs)', fontWeight: 700, letterSpacing: 'var(--track-label)', textTransform: 'uppercase', padding: '5px 11px', marginBottom: 'var(--s-4)' }}>Educational tool · your capital is at risk</span>
            <h1 style={{ fontSize: 'var(--size-hero)', letterSpacing: '-.02em', marginBottom: 'var(--s-4)', color: 'var(--bg)' }}>
              One rule. Held in <span style={{ color: 'var(--gold-on-band)' }}>your head.</span>
            </h1>
            <p style={{ fontSize: 'var(--size-body-lg)', maxWidth: '46ch', marginBottom: 'var(--s-5)', color: 'var(--bg)', opacity: .85 }}>
              SutrAlgo watches the market for one specific setup. When it finds one, it tells you what to pay,
              what to sell at, and when to give up. Then it gets out of the way.
            </p>
            <div className="sa-row" style={{ gap: 'var(--s-3)', marginBottom: 'var(--s-5)' }}>
              <Button size="lg" onClick={() => onNavigate('signin')} style={{ background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--bg)', boxShadow: '4px 4px 0 var(--gold-on-band)' }}>Try it free for 90 days</Button>
              <Button size="lg" variant="secondary" trailingIcon="arrow_forward" onClick={() => onNavigate('pricing')} style={{ color: 'var(--bg)', borderColor: 'var(--bg)', background: 'transparent' }}>See what it costs</Button>
            </div>
            <p style={{ fontSize: 'var(--size-sm)', color: 'var(--bg)', opacity: .6 }}>No card. No broker connection. Cancel by closing the tab.</p>
          </div>

          <Card tone="raised" style={{ marginBottom: -72 }}>
            <div className="sa-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--s-4)' }}>
              <strong style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 14, textTransform: 'uppercase', letterSpacing: '.02em' }}>This morning's scan</strong>
              <Badge tone="gain" icon="check">3 setups</Badge>
            </div>
            <div className="sa-stack" style={{ gap: 'var(--s-3)' }}>
              {[['BAJFINANCE.NS', 'Bajaj Finance', '₹7,215.40', '₹7,792.63', '₹6,854.63'],
                ['GSK.L', 'GSK plc', '1,412.50p', '1,525.50p', '1,341.88p']].map(([sym, name, buy, sell, stop]) => (
                <div key={sym} style={{ border: '1.5px solid var(--line-strong)', padding: 'var(--s-3)' }}>
                  <div className="sa-row" style={{ justifyContent: 'space-between' }}>
                    <div><strong style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 14 }}>{sym}</strong>
                      <div style={{ fontSize: 'var(--size-xs)', color: 'var(--text-3)' }}>{name}</div></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 10 }}>
                    <div><span className="sa-pos__k">Buy around</span><span className="sa-pos__v">{buy}</span></div>
                    <div><span className="sa-pos__k">Sells at</span><span className="sa-pos__v" style={{ color: 'var(--gain)' }}>{sell}</span></div>
                    <div><span className="sa-pos__k">Stops at</span><span className="sa-pos__v" style={{ color: 'var(--loss)' }}>{stop}</span></div>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 'var(--size-xs)', color: 'var(--text-3)', marginTop: 'var(--s-3)' }}>
              Illustration of a real scan output. Not a recommendation.
            </p>
          </Card>
        </div>
      </section>

      <section style={{ maxWidth: 'var(--page-max)', margin: '0 auto', padding: 'calc(72px + var(--s-7)) var(--gutter) var(--s-8)' }}>
        <SectionHeader eyebrow="The whole system" title="Buy on one signal. Sell on one of three rules."
          style={{ marginBottom: 'var(--s-5)' }}>
          There is nothing else to learn. The exit is decided before you buy, which is the part most people get wrong.
        </SectionHeader>
        <div className="sa-row" style={{ gap: 'var(--s-4)', flexWrap: 'wrap' }}>
          <RuleChip n="+8%" label="It reaches the target and sells." tone="var(--gain)" />
          <RuleChip n="−5%" label="It goes the wrong way and sells to cap the loss." tone="var(--loss)" />
          <RuleChip n="30 days" label="Neither happened, so it sells anyway and frees up the money." tone="var(--text)" />
        </div>
      </section>

      <section style={{ maxWidth: 'var(--page-max)', margin: '0 auto', padding: 'var(--s-8) var(--gutter)' }}>
        <SectionHeader eyebrow="What you get" title="Four things, and no dashboard to learn"
          style={{ marginBottom: 'var(--s-5)' }} />
        <div className="sa-grid sa-grid--4">
          <FeatureCard icon="notifications" title="It tells you, you don't check" footnote="07:00 UK, every weekday.">
            A message lands on your phone with the price to pay, the price to sell at and the stop, already worked out.
          </FeatureCard>
          <FeatureCard icon="account_balance_wallet" title="See where every position stands">
            One screen shows how far each holding is from its target and its stop, and how many days it has left.
          </FeatureCard>
          <FeatureCard icon="science" title="Check it against the past" footnote="Cash markets only — no leverage.">
            Replay the rule over years of real prices and see every trade it would have made, good and bad.
          </FeatureCard>
          <FeatureCard icon="public" title="Three markets, one rule" footnote="India, the UK and the United States.">
            The same formula runs everywhere, so you are not learning a different system per market.
          </FeatureCard>
        </div>
      </section>

      <section style={{ maxWidth: 'var(--page-max)', margin: '0 auto', padding: 'var(--s-8) var(--gutter)' }}>
        <Card>
          <div className="sa-grid sa-grid--4">
            <Stat label="How often it worked" value="63.4%" tone="gain" benchmark={{ percent: 63.4 }}
              context="Of 248 closed trades this year. Not a promise about the next one." />
            <Stat label="Typical result per trade" value="+2.86%" tone="gain" context="Winners average +8%, losers −5%." />
            <Stat label="Typical hold" value="15 days" context="Half the trades close inside a fortnight." />
            <Stat label="Worst stretch" value="−7.8%" tone="loss" context="The deepest fall from a high, recovered in 21 days." />
          </div>
          <p style={{ fontSize: 'var(--size-xs)', color: 'var(--text-3)', marginTop: 'var(--s-4)' }}>
            Figures are from the simulator over the last 12 months and exclude dealing costs. Past performance is not a reliable indicator of future results.
          </p>
        </Card>
      </section>

      <section style={{ maxWidth: 'var(--page-max)', margin: '0 auto', padding: 'var(--s-8) var(--gutter) var(--s-9)', textAlign: 'center' }}>
        <h2 style={{ marginBottom: 'var(--s-3)' }}>Ninety days is long enough to judge it</h2>
        <p style={{ maxWidth: '52ch', margin: '0 auto var(--s-5)' }}>
          Watch it work, or watch it fail, on real signals in real markets. Then decide.
        </p>
        <Button size="lg" onClick={() => onNavigate('signin')}>Start free</Button>
      </section>
    </>
  );
}
Object.assign(window, { HomeScreen, RuleChip });
