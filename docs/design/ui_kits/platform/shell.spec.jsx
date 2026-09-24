// Spec reference only — renamed from Shell.jsx so the design-system compiler ignores it.
const { AppBar, BottomNav, UserMenu, ThemeToggle, LegalNote, Wordmark } = window.SutrAlgoDesignSystem_eaaf37;

function PageHead({ title, sub, actions }) {
  return (
    <div className="sa-spread" style={{ marginBottom: 'var(--s-5)' }}>
      <div>
        <h1>{title}</h1>
        {sub ? <p style={{ marginTop: 6, maxWidth: '58ch' }}>{sub}</p> : null}
      </div>
      {actions ? <div className="sa-row" style={{ gap: 'var(--s-2)' }}>{actions}</div> : null}
    </div>
  );
}

function Shell({ route, onNavigate, onTheme, children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <AppBar items={window.SA.nav} active={route} onNavigate={onNavigate}
        end={<>
          <ThemeToggle defaultTheme="light" onChange={onTheme} />
          <UserMenu user={window.SA.user} items={[
            { icon: 'person', label: 'Account', onClick: () => onNavigate('account') },
            { icon: 'help', label: 'How the formula works' },
            { icon: 'logout', label: 'Sign out' }
          ]} />
        </>} />
      <main className="sa-page" style={{ flex: 1, paddingBottom: 'calc(var(--s-9) + var(--tabbar-h))' }}>
        {children}
        <div style={{ marginTop: 'var(--s-8)' }}><LegalNote /></div>
      </main>
      <BottomNav items={window.SA.nav} active={route} onNavigate={onNavigate} />
    </div>
  );
}

Object.assign(window, { Shell, PageHead });
