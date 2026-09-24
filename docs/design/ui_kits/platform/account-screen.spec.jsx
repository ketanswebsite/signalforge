// Spec reference only — renamed from AccountScreen.jsx so the design-system compiler ignores it.
const { Card, Button, Tabs, PricingCard, Stat, DataTable, Callout, Badge, Switch, Field, EmptyState, SegmentedControl } = window.SutrAlgoDesignSystem_eaaf37;

function AccountScreen() {
  const [tab, setTab] = React.useState('plan');
  const [region, setRegion] = React.useState('UK');

  // Prices come from the pricing feed — never typed into a screen.
  const feed = {
    UK:    { currency: '£', trader: '24' },
    US:    { currency: '$', trader: '29' },
    India: { currency: '₹', trader: '999' }
  }[region];

  const plans = window.SA.plans.map(p => ({
    ...p,
    currency: feed.currency,
    price: p.id === 'trader' ? feed.trader : p.price
  }));

  return (
    <>
      <PageHead title="Account" sub="Your plan, your billing, and everything we hold about you." />

      <Callout tone="warn" title="Your free 90 days end on 24 September"
        action={<Button size="sm" onClick={() => setTab('plan')}>See plans</Button>}
        style={{ marginBottom: 'var(--s-5)' }}>
        That's 42 days away. After that the scanner stops sending signals — your history stays either way.
      </Callout>

      <div className="sa-grid sa-grid--3" style={{ marginBottom: 'var(--s-5)' }}>
        <Card><Stat label="Current plan" value="Explorer" size="sm" context="Free for 90 days, no card on file." /></Card>
        <Card><Stat label="Days left" value="42" benchmark={{ percent: (42 / 90) * 100 }} context="Started 26 June 2026." /></Card>
        <Card><Stat label="Markets you can see" value="3" size="sm" context="India, the UK and the US — the same on every plan." /></Card>
      </div>

      <Tabs value={tab} onChange={setTab} style={{ marginBottom: 'var(--s-5)' }}
        tabs={[{ id: 'plan', label: 'Plan' }, { id: 'billing', label: 'Billing' }, { id: 'data', label: 'Your data' }]} />

      {tab === 'plan' ? (
        <>
          <div className="sa-row" style={{ marginBottom: 'var(--s-4)', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 'var(--size-sm)' }}>Prices follow where you are. Same product everywhere.</p>
            <SegmentedControl value={region} onChange={setRegion} label="Region" options={['UK', 'US', 'India']} />
          </div>
          <div className="sa-grid sa-grid--2" style={{ maxWidth: 860, alignItems: 'start' }}>
            {plans.map(p => (
              <PricingCard key={p.id} {...p}
                action={<Button block disabled={p.current} variant={p.featured ? 'primary' : 'secondary'}>{p.cta}</Button>} />
            ))}
          </div>
        </>
      ) : tab === 'billing' ? (
        <Card flush title="Payments" hint="Nothing has been charged — you're on the free plan.">
          <DataTable primaryKey="date"
            columns={[
              { key: 'date', header: 'Date' }, { key: 'what', header: 'What for' },
              { key: 'method', header: 'Paid with' }, { key: 'amount', header: 'Amount', numeric: true, lead: true },
              { key: 'status', header: 'Status' }
            ]}
            rows={[]} empty="No payments yet." />
        </Card>
      ) : (
        <div className="sa-grid sa-grid--2" style={{ alignItems: 'start' }}>
          <Card title="Take your data with you" hint="A single file with every trade, signal and setting.">
            <div className="sa-row"><Button variant="secondary" icon="download">Download everything</Button></div>
          </Card>
          <Card title="Close your account" hint="This removes your data permanently. It cannot be undone.">
            <div className="sa-stack" style={{ gap: 'var(--s-3)' }}>
              <Field label="Type DELETE to confirm" placeholder="DELETE" />
              <div className="sa-row"><Button variant="danger" icon="delete_forever">Close my account</Button></div>
            </div>
          </Card>
          <Card title="Email preferences">
            <div className="sa-stack" style={{ gap: 'var(--s-4)' }}>
              <Switch defaultChecked label="Service emails" description="Billing, security and anything that affects your account." />
              <Switch label="Product updates" description="Occasional notes when something new ships. Never more than monthly." />
            </div>
          </Card>
          <Card title="Signed in as">
            <div className="sa-stack" style={{ gap: 6 }}>
              <span style={{ color: 'var(--text)', fontWeight: 'var(--w-medium)' }}>{window.SA.user.name}</span>
              <span style={{ color: 'var(--text-3)', fontSize: 'var(--size-sm)' }}>{window.SA.user.email}</span>
              <span style={{ color: 'var(--text-3)', fontSize: 'var(--size-xs)' }}>Signed in with Google · session ends after 24 hours idle</span>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
Object.assign(window, { AccountScreen });
