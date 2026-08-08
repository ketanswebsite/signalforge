// Spec reference only — renamed from AdminApp.jsx so the design-system compiler ignores it.
function AdminApp() {
  const [section, setSection] = React.useState('analytics');
  const [theme, setTheme] = React.useState('light');
  const go = s => { setSection(s); window.scrollTo({ top: 0 }); };
  const view =
    section === 'analytics' ? <Analytics theme={theme} /> :
    section === 'users' ? <Users /> :
    section === 'subs' ? <Subscriptions /> :
    section === 'signals' ? <SignalTesting theme={theme} /> :
    section === 'broadcast' ? <Broadcast /> :
    section === 'database' ? <Database /> :
    section === 'audit' ? <Audit /> :
    <Settings />;
  return <AdminShell section={section} onNavigate={go} onTheme={setTheme}>{view}</AdminShell>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<AdminApp />);
