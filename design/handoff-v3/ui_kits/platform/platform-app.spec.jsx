// Spec reference only — renamed from PlatformApp.jsx so the design-system compiler ignores it.
function App() {
  const [route, setRoute] = React.useState('scanner');
  const [theme, setTheme] = React.useState('light');
  const go = r => { setRoute(r); window.scrollTo({ top: 0 }); };
  return (
    <Shell route={route} onNavigate={go} onTheme={setTheme}>
      {route === 'scanner' ? <ScannerScreen theme={theme} onNavigate={go} /> :
       route === 'positions' ? <PositionsScreen theme={theme} onNavigate={go} /> :
       route === 'simulator' ? <SimulatorScreen theme={theme} /> :
       route === 'alerts' ? <AlertsScreen /> :
       <AccountScreen />}
    </Shell>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
