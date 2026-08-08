// Spec reference only — renamed from PricingScreen.jsx so the design-system compiler ignores it.
const { Button, PricingCard, SectionHeader, SegmentedControl, Card, Badge, Icon } = window.SutrAlgoDesignSystem_eaaf37;

function Faq({ q, a }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ borderBottom: '1px solid var(--line)' }}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} style={{
        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        background: 'none', border: 0, padding: 'var(--s-4) 0', cursor: 'pointer', textAlign: 'left',
        fontFamily: 'var(--font-sans)', fontSize: 'var(--size-body)', fontWeight: 'var(--w-medium)',
        color: 'var(--text)', minHeight: 'var(--tap-min)'
      }}>
        {q}
        <Icon name="expand_more" size={20} style={{ color: 'var(--text-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform var(--dur-2) var(--ease-out)' }} />
      </button>
      {open ? <p style={{ paddingBottom: 'var(--s-4)', maxWidth: 'var(--reading-max)', fontSize: 'var(--size-sm)' }}>{a}</p> : null}
    </div>
  );
}

function PricingScreen({ onNavigate }) {
  const [region, setRegion] = React.useState('UK');
  const plans = window.SAMkt.plans.map(p => ({
    id: p.id, name: p.name, blurb: p.blurb, currency: p.price[region][0], price: p.price[region][1],
    period: p.period, featured: p.featured, ribbon: p.ribbon, features: p.features, cta: p.cta
  }));

  return (
    <div style={{ maxWidth: 'var(--page-max)', margin: '0 auto', padding: 'var(--s-8) var(--gutter)' }}>
      <SectionHeader align="center" eyebrow="Pricing" title="Two plans. The second one is the same as the first, but it keeps going."
        style={{ marginBottom: 'var(--s-5)' }}>
        Everyone gets every signal and every market. The only difference is how long it lasts.
      </SectionHeader>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--s-6)' }}>
        <SegmentedControl value={region} onChange={setRegion} label="Region" options={['UK', 'US', 'India']} />
      </div>

      <div className="sa-grid sa-grid--2" style={{ maxWidth: 780, margin: '0 auto var(--s-8)', alignItems: 'start' }}>
        {plans.map(p => (
          <PricingCard key={p.id} {...p}
            note={p.id === 'explorer' ? 'No card needed.' : 'Cancel any time from your account.'}
            action={<Button block variant={p.featured ? 'primary' : 'secondary'} onClick={() => onNavigate('signin')}>{p.cta}</Button>} />
        ))}
      </div>

      <Card style={{ maxWidth: 780, margin: '0 auto var(--s-8)' }} title="Why the price differs by country"
        hint="Same product, priced against local purchasing power.">
        <p style={{ fontSize: 'var(--size-sm)' }}>
          A single global price would put SutrAlgo out of reach in India and undercharge in the US. You are billed in your
          local currency at the rate shown when you sign up, and it is fixed for twelve months.
        </p>
      </Card>

      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        <h2 style={{ marginBottom: 'var(--s-3)' }}>Questions people actually ask</h2>
        {window.SAMkt.faq.map(([q, a]) => <Faq key={q} q={q} a={a} />)}
      </div>
    </div>
  );
}
Object.assign(window, { PricingScreen, Faq });
