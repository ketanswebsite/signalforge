// Spec reference only — renamed from MarketingApp.jsx so the design-system compiler ignores it.
function SiteApp() {
  const [route, setRoute] = React.useState('home');
  const go = r => { setRoute(r); window.scrollTo({ top: 0 }); };
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <SiteBar route={route} onNavigate={go} />
      <main style={{ flex: 1 }}>
        {route === 'home' ? <HomeScreen onNavigate={go} /> :
         route === 'pricing' ? <PricingScreen onNavigate={go} /> :
         <SignInScreen onNavigate={go} />}
      </main>
      <SiteFoot onNavigate={go} />
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<SiteApp />);
