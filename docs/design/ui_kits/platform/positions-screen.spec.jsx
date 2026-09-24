// Spec reference only — renamed from PositionsScreen.jsx so the design-system compiler ignores it.
const { Card, Button, PositionCard, DataTable, Stat, Tabs, SegmentedControl, EmptyState, Sheet, Badge, Callout } = window.SutrAlgoDesignSystem_eaaf37;

function PositionsScreen({ theme, onNavigate }) {
  const [tab, setTab] = React.useState('open');
  const [filter, setFilter] = React.useState('all');
  const [selling, setSelling] = React.useState(null);
  const [open, setOpen] = React.useState(window.SA.positions);

  const closed = window.SA.closed.filter(r =>
    filter === 'all' ? true : filter === 'won' ? !r.pl.startsWith('-') : r.pl.startsWith('-'));

  const totalPl = open.reduce((a, p) => a + p.plPercent, 0) / (open.length || 1);

  return (
    <>
      <PageHead title="Positions"
        sub="What you're holding now, and everything the formula has already sold."
        actions={<Button variant="secondary" icon="add" onClick={() => onNavigate('scanner')}>Find a new one</Button>} />

      <div className="sa-grid sa-grid--4" style={{ marginBottom: 'var(--s-5)' }}>
        <Card><Stat label="Holding right now" value={String(open.length)} context={'Out of a maximum of 10 at a time.'} /></Card>
        <Card><Stat label="Open profit and loss" value={(totalPl >= 0 ? '+' : '') + totalPl.toFixed(2) + '%'} tone={totalPl >= 0 ? 'gain' : 'loss'}
          context="Across everything you're holding. Nothing is locked in until it sells." /></Card>
        <Card><Stat label="Win rate so far" value="63.4%" tone="gain" benchmark={{ percent: 63.4 }}
          context="Above the 55% long-run average for this formula." /></Card>
        <Card><Stat label="Closed this year" value="248" context="Average hold was 15 days." /></Card>
      </div>

      <Tabs value={tab} onChange={setTab} style={{ marginBottom: 'var(--s-5)' }}
        tabs={[{ id: 'open', label: 'Holding now', count: open.length }, { id: 'closed', label: 'Already sold', count: window.SA.closed.length }]} />

      {tab === 'open' ? (
        open.length ? (
          <div className="sa-grid sa-grid--2">
            {open.map(p => (
              <PositionCard key={p.symbol} {...p}
                actions={<Button size="sm" variant="secondary" onClick={() => setSelling(p)}>Sell now</Button>} />
            ))}
          </div>
        ) : (
          <Card flush><EmptyState icon="account_balance_wallet" title="Nothing open"
            action={<Button icon="radar" onClick={() => onNavigate('scanner')}>Run the scanner</Button>}>
            When you take a signal it appears here with its sell price and stop already set.
          </EmptyState></Card>
        )
      ) : (
        <Card flush
          title="Everything the formula has sold"
          actions={<SegmentedControl value={filter} onChange={setFilter} label="Filter"
            options={[{ value: 'all', label: 'All' }, { value: 'won', label: 'Made money' }, { value: 'lost', label: 'Lost money' }]} />}>
          <DataTable primaryKey="symbol"
            columns={[
              { key: 'symbol', header: 'Stock', render: r => (<span><strong>{r.symbol}</strong><br /><span style={{ color: 'var(--text-3)', fontSize: 'var(--size-xs)' }}>{r.name}</span></span>) },
              { key: 'closed', header: 'Sold on' },
              { key: 'held', header: 'Held for' },
              { key: 'money', header: 'Result', numeric: true, tone: r => r.pl.startsWith('-') ? 'loss' : 'gain' },
              { key: 'pl', header: 'Change', numeric: true, lead: true, tone: r => r.pl.startsWith('-') ? 'loss' : 'gain' },
              { key: 'reason', header: 'Why it sold', render: r => <Badge tone={r.reason.includes('target') ? 'gain' : r.reason.includes('stop') ? 'loss' : 'neutral'}>{r.reason}</Badge> }
            ]}
            rows={closed} empty="No trades match this filter." />
        </Card>
      )}

      {selling ? (
        <Sheet title={'Sell ' + selling.symbol + ' now?'} onClose={() => setSelling(null)}
          footer={<>
            <Button variant="secondary" onClick={() => setSelling(null)}>Keep holding</Button>
            <Button onClick={() => { setOpen(open.filter(x => x !== selling)); setSelling(null); }}>Sell now</Button>
          </>}>
          <Callout tone={selling.plPercent >= 0 ? 'gain' : 'warn'}>
            You're {selling.plPercent >= 0 ? 'up' : 'down'} {Math.abs(selling.plPercent).toFixed(2)}% ({selling.plLabel}).
            The formula would normally hold until +8%, −5%, or day 30 — {30 - selling.daysHeld} days from now.
          </Callout>
          <p style={{ fontSize: 'var(--size-sm)' }}>Selling early is always your call. The app just records it.</p>
        </Sheet>
      ) : null}
    </>
  );
}
Object.assign(window, { PositionsScreen });
