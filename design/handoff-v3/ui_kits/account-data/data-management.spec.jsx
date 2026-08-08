// Spec reference only — renamed from DataManagement.jsx so the design-system compiler ignores it.
const { Button, Badge, Callout, LegalNote, Sheet, Field, Wordmark, Icon, Card } = window.SutrAlgoDesignSystem_eaaf37;

function DataApp() {
  const [confirm, setConfirm] = React.useState(false);
  const [typed, setTyped] = React.useState('');
  const D = window.SAData;
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header className="sa-appbar"><div className="sa-appbar__in" style={{ maxWidth: 'var(--page-max)' }}>
        <span className="sa-appbar__brand"><Wordmark size={19} showMark /></span>
        <div className="sa-appbar__end"><Badge tone="neutral" icon="shield">Your data</Badge></div>
      </div></header>

      <main className="sa-page sa-page--narrow">
        <h1 style={{ fontSize: 'var(--size-h2)', marginBottom: 6 }}>Your data</h1>
        <p style={{ marginBottom: 'var(--s-6)', maxWidth: '58ch' }}>Everything SutrAlgo holds about you, ready to take away — and the way to delete all of it.</p>

        <div className="sa-grid sa-grid--split" style={{ alignItems: 'start' }}>
          <div className="sa-stack" style={{ gap: 'var(--s-4)' }}>
            <div className="sa-spread">
              <h3 className="sa-card__title">Take it with you</h3>
              <Button icon="download">Download everything</Button>
            </div>
            <div className="sa-stack" style={{ gap: 'var(--s-3)' }}>
              {D.exports.map(x => (
                <div className="sa-dl" key={x.file}>
                  <span className="sa-dl__icon"><Icon name={x.icon} size={20} /></span>
                  <span className="sa-dl__meta">
                    <span className="sa-dl__name">{x.file}</span>
                    <span className="sa-dl__hint" style={{ display: 'block' }}>{x.what}</span>
                  </span>
                  <span className="sa-dl__size">{x.size}</span>
                  <Button size="sm" variant="quiet" icon="download">CSV</Button>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 'var(--size-xs)', color: 'var(--text-3)' }}>Files are generated fresh when you ask — the sizes above are from this morning's data. JSON versions of each are in "Download everything".</p>
          </div>

          <div className="sa-stack" style={{ gap: 'var(--s-4)' }}>
            <Card tone="sunk">
              <h3 className="sa-card__title" style={{ marginBottom: 'var(--s-3)' }}>What we store, and why</h3>
              <div className="sa-stack" style={{ gap: 'var(--s-3)' }}>
                {D.stored.map(s => (
                  <div key={s.what} style={{ borderBottom: '1.5px solid var(--line)', paddingBottom: 'var(--s-3)' }}>
                    <strong style={{ fontSize: 'var(--size-sm)' }}>{s.what}</strong>
                    <p style={{ fontSize: 'var(--size-xs)', color: 'var(--text-3)', marginTop: 2 }}>{s.why}</p>
                  </div>
                ))}
                <p style={{ fontSize: 'var(--size-xs)', color: 'var(--text-3)' }}>{D.notStored}</p>
              </div>
            </Card>

            <Card>
              <h3 className="sa-card__title" style={{ marginBottom: 6 }}>Delete the account</h3>
              <p className="sa-card__hint" style={{ marginBottom: 'var(--s-4)' }}>Removes everything above, permanently, within 30 days. Export first — there is no undo.</p>
              <Button variant="danger" icon="delete_forever" onClick={() => { setConfirm(true); setTyped(''); }}>Delete my account</Button>
            </Card>
          </div>
        </div>
        <div style={{ marginTop: 'var(--s-8)' }}><LegalNote summary="Exports are your personal data under UK GDPR. Deletion is permanent." paragraphs={["Exports cover everything SutrAlgo holds that is personal to you.", "Deletion removes your account and data within 30 days; backups age out within 90. Payment records the law requires us to keep are retained by the payment provider, not by SutrAlgo."]} /></div>
      </main>

      {confirm ? (
        <Sheet title="Delete this account?" width={480} onClose={() => setConfirm(false)}
          footer={<>
            <Button variant="secondary" onClick={() => setConfirm(false)}>Keep my account</Button>
            <Button variant="danger" disabled={typed !== 'DELETE'} icon="delete_forever" onClick={() => setConfirm(false)}>Delete permanently</Button>
          </>}>
          <Callout tone="loss" title="This cannot be undone">Positions, trades, signals and settings are all removed. Your exports keep working for 24 hours, then the links die too.</Callout>
          <Field label="Type DELETE to confirm" placeholder="DELETE" value={typed} onChange={e => setTyped(e.target.value)}
            hint={typed && typed !== 'DELETE' ? 'Capital letters — exactly DELETE.' : 'This is deliberate friction.'} />
        </Sheet>
      ) : null}
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<DataApp />);
