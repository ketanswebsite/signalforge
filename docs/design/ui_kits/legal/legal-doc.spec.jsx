// Spec reference only — renamed from LegalDoc.jsx so the design-system compiler ignores it.
const { Button, LegalNote, SegmentedControl, Wordmark, Badge } = window.SutrAlgoDesignSystem_eaaf37;

function LegalApp() {
  const [docId, setDocId] = React.useState('terms');
  const [active, setActive] = React.useState(null);
  const doc = window.SALegal[docId];
  const go = id => {
    setActive(id);
    const el = document.getElementById('sec-' + id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 76, behavior: 'smooth' });
  };
  React.useEffect(() => { setActive(doc.sections[0].id); window.scrollTo(0, 0); }, [docId]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header className="sa-appbar"><div className="sa-appbar__in" style={{ maxWidth: 'var(--page-max)' }}>
        <span className="sa-appbar__brand"><Wordmark size={19} showMark /></span>
        <div className="sa-appbar__end">
          <SegmentedControl value={docId} onChange={setDocId} label="Document"
            options={[{ value: 'terms', label: 'Terms' }, { value: 'privacy', label: 'Privacy' }]} />
        </div>
      </div></header>

      <div className="sa-doc">
        <nav className="sa-toc" aria-label="Contents">
          <span className="sa-toc__title">Contents</span>
          {doc.sections.map((s, i) => (
            <button key={s.id} type="button" className="sa-toc__item" aria-current={active === s.id ? 'true' : undefined} onClick={() => go(s.id)}>
              <span className="sa-toc__n">{String(i + 1).padStart(2, '0')}</span>{s.heading}
            </button>
          ))}
        </nav>
        <article className="sa-doc__body">
          <h1 style={{ fontSize: 'var(--size-h1)', marginBottom: 10 }}>{doc.title}</h1>
          <p className="sa-doc__updated">{doc.updated} · Written to be read, not skimmed past.</p>
          {doc.sections.map((s, i) => (
            <section key={s.id} id={'sec-' + s.id}>
              <div className="sa-doc__sec">
                <span className="sa-doc__secnum">{String(i + 1).padStart(2, '0')}</span>
                <h2>{s.heading}</h2>
              </div>
              {s.body.map((p, j) => <p key={j}>{p}</p>)}
            </section>
          ))}
          <div style={{ marginTop: 'var(--s-8)' }}><LegalNote summary="Questions about either document: privacy@sutralgo.com." paragraphs={["We answer within two working days. If the answer changes a document, the change lands here with a fresh date."]} /></div>
        </article>
      </div>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<LegalApp />);
