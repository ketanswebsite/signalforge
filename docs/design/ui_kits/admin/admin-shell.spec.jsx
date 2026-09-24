// Spec reference only — renamed from AdminShell.jsx so the design-system compiler ignores it.
const { SideNav, UserMenu, ThemeToggle, Wordmark, Badge, IconButton, Field } = window.SutrAlgoDesignSystem_eaaf37;

function AdminShell({ section, onNavigate, onTheme, children }) {
  const flat = window.SAAdmin.sections.flatMap(s => s.items);
  const current = flat.find(i => i.id === section) || flat[0];
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <header className="sa-appbar">
        <div className="sa-appbar__in" style={{ maxWidth: 'none' }}>
          <span className="sa-appbar__brand"><Wordmark size={18} showMark /></span>
          <Badge tone="accent">Admin</Badge>
          <div className="sa-appbar__end">
            <ThemeToggle defaultTheme="light" onChange={onTheme} />
            <UserMenu user={window.SAAdmin.admin} items={[
              { icon: 'open_in_new', label: 'Back to the app' },
              { icon: 'logout', label: 'Sign out' }
            ]} />
          </div>
        </div>
      </header>
      <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', minHeight: 0 }} className="sa-admin-body">
        <SideNav sections={window.SAAdmin.sections} active={section} onNavigate={onNavigate} />
        <main style={{ flex: 1, minWidth: 0, padding: 'var(--s-6) var(--gutter) var(--s-9)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

function AdminHead({ title, sub, actions }) {
  return (
    <div className="sa-spread" style={{ marginBottom: 'var(--s-5)' }}>
      <div>
        <h1 style={{ fontSize: 'var(--size-h2)' }}>{title}</h1>
        {sub ? <p style={{ marginTop: 6, maxWidth: '62ch' }}>{sub}</p> : null}
      </div>
      {actions ? <div className="sa-row" style={{ gap: 'var(--s-2)' }}>{actions}</div> : null}
    </div>
  );
}

Object.assign(window, { AdminShell, AdminHead });
