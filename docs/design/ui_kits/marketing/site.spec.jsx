// Spec reference only — renamed from Site.jsx so the design-system compiler ignores it.
const { Wordmark, Button, ThemeToggle, IconButton, LegalNote, Icon } = window.SutrAlgoDesignSystem_eaaf37;

function SiteBar({ route, onNavigate }) {
  return (
    <header className="sa-appbar">
      <div className="sa-appbar__in" style={{ maxWidth: 'var(--page-max)' }}>
        <a className="sa-appbar__brand" href="#" onClick={e => { e.preventDefault(); onNavigate('home'); }}>
          <Wordmark size={19} showMark />
        </a>
        <nav className="sa-appbar__nav" aria-label="Main" style={{ justifyContent: 'flex-start', marginLeft: 'var(--s-5)' }}>
          <a className="sa-appbar__link" href="#" aria-current={route === 'home' ? 'page' : undefined}
            onClick={e => { e.preventDefault(); onNavigate('home'); }}>How it works</a>
          <a className="sa-appbar__link" href="#" aria-current={route === 'pricing' ? 'page' : undefined}
            onClick={e => { e.preventDefault(); onNavigate('pricing'); }}>Pricing</a>
        </nav>
        <div className="sa-appbar__end">
          <ThemeToggle defaultTheme="light" />
          <Button variant="secondary" size="sm" onClick={() => onNavigate('signin')}>Sign in</Button>
          <Button size="sm" onClick={() => onNavigate('signin')}>Start free</Button>
        </div>
      </div>
    </header>
  );
}

function SiteFoot({ onNavigate }) {
  return (
    <footer style={{ borderTop: '2.5px solid var(--frame)', background: 'var(--surface)', marginTop: 'var(--s-9)' }}>
      <div style={{ maxWidth: 'var(--page-max)', margin: '0 auto', padding: 'var(--s-7) var(--gutter)' }}>
        <div className="sa-grid" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 'var(--s-6)' }}>
          <div>
            <Wordmark size={20} />
            <p style={{ marginTop: 10, fontSize: 'var(--size-sm)', maxWidth: '34ch' }}>
              One formula, three exit rules, and a message when something turns up.
            </p>
          </div>
          <FootCol title="Product" links={[['How it works', 'home'], ['Pricing', 'pricing'], ['Sign in', 'signin']]} onNavigate={onNavigate} />
          <FootCol title="Company" links={[['Terms'], ['Privacy'], ['Your data']]} onNavigate={onNavigate} />
          <FootCol title="Markets" links={[['India'], ['United Kingdom'], ['United States']]} onNavigate={onNavigate} />
        </div>
        <div style={{ marginTop: 'var(--s-6)' }}><LegalNote /></div>
        <p style={{ marginTop: 'var(--s-4)', fontSize: 'var(--size-xs)', color: 'var(--text-3)' }}>© 2026 SutrAlgo</p>
      </div>
    </footer>
  );
}

function FootCol({ title, links, onNavigate }) {
  return (
    <div>
      <h4 style={{ fontSize: 'var(--size-sm)', marginBottom: 10 }}>{title}</h4>
      <div style={{ display: 'grid', gap: 8 }}>
        {links.map(([label, r]) => (
          <a key={label} href="#" style={{ fontSize: 'var(--size-sm)', color: 'var(--text-2)' }}
            onClick={e => { e.preventDefault(); if (r) onNavigate(r); }}>{label}</a>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { SiteBar, SiteFoot, FootCol });
