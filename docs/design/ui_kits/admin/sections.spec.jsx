// Spec reference only — renamed from Sections.jsx so the design-system compiler ignores it.
const { Card, Button, Stat, DataTable, Badge, Tabs, SegmentedControl, Field, Select, Switch, Checkbox,
        Callout, ChartFrame, EmptyState, Sheet, ProgressBar, Icon, IconButton } = window.SutrAlgoDesignSystem_eaaf37;

const statusTone = s => s === 'Active' || s === 'Paid' ? 'gain'
  : s === 'Past due' || s === 'Failed' ? 'loss'
  : s === 'Trial' ? 'accent' : 'neutral';

/* ---------- Analytics ---------- */
function Analytics({ theme }) {
  return (
    <>
      <AdminHead title="Analytics" sub="How the business is doing this month, in the fewest numbers that tell the story."
        actions={<SegmentedControl label="Range" options={['7d', '30d', '90d']} defaultValue="30d" />} />
      <div className="sa-grid sa-grid--4" style={{ marginBottom: 'var(--s-5)' }}>
        <Card><Stat label="Paying customers" value="412" tone="gain" context="Up 38 this month. Churn was 9." /></Card>
        <Card><Stat label="People on trial" value="196" context="Of these, 71 have taken at least one signal." /></Card>
        <Card><Stat label="Trial → paid" value="31.4%" tone="gain" benchmark={{ percent: 31.4 }} context="Above the 26% average for the last six months." /></Card>
        <Card><Stat label="Monthly revenue" value="£9,240" tone="gain" context="Converted to GBP at today's rate." /></Card>
      </div>
      <div className="sa-grid sa-grid--2" style={{ marginBottom: 'var(--s-5)' }}>
        <Card>
          <ChartFrame title="New sign-ups a day"
            readAs="Each point is one day. The step up at day 12 is when the Telegram bot went live."
            legend={[{ label: 'Sign-ups', color: 'var(--accent)' }]}>
            <LineChart data={window.SAAdmin.signups} theme={theme} height={210} />
          </ChartFrame>
        </Card>
        <Card>
          <ChartFrame title="Where customers are"
            readAs="Paying customers by region. India is the largest market by count, the UK by revenue.">
            <Bars horizontal theme={theme} height={210} labels={['India', 'UK', 'US']} values={[196, 121, 95]}
              colors={['var(--accent)', 'var(--accent)', 'var(--accent)']} />
          </ChartFrame>
        </Card>
      </div>
      <Card flush title="Needs a look" hint="Things that will cost money if nobody touches them.">
        <DataTable primaryKey="what"
          columns={[
            { key: 'what', header: 'What' }, { key: 'count', header: 'How many', numeric: true, lead: true },
            { key: 'why', header: 'Why it matters' }
          ]}
          rows={[
            { what: 'Failed payments', count: '7', why: 'Cards declined in the last 7 days. Retry runs nightly.' },
            { what: 'Trials ending this week', count: '23', why: 'No card on file. A reminder email is scheduled.' },
            { what: 'Telegram unlinked', count: '48', why: 'Paying but not receiving alerts — they will churn.' }
          ]} />
      </Card>
    </>
  );
}

/* ---------- Users ---------- */
function Users() {
  const [q, setQ] = React.useState('');
  const [plan, setPlan] = React.useState('All');
  const [selected, setSelected] = React.useState(null);
  const rows = window.SAAdmin.users.filter(u =>
    (plan === 'All' || u.plan === plan) &&
    (u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase())));

  return (
    <>
      <AdminHead title="Users" sub="Everyone with an account. 1,284 in total."
        actions={<><Button variant="quiet" icon="download">Export CSV</Button><Button icon="person_add">Invite</Button></>} />
      <Card flush
        actions={<SegmentedControl value={plan} onChange={setPlan} label="Plan" options={['All', 'Explorer', 'Trader']} />}
        title="Find someone"
        hint="Search by name or email.">
        <div style={{ padding: '0 var(--s-5) var(--s-4)' }}>
          <Field icon="search" placeholder="Search 1,284 people…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <DataTable primaryKey="name"
          columns={[
            { key: 'name', header: 'Person', render: u => (<span><strong>{u.name}</strong><br /><span style={{ color: 'var(--text-3)', fontSize: 'var(--size-xs)' }}>{u.email}</span></span>) },
            { key: 'plan', header: 'Plan' },
            { key: 'region', header: 'Region' },
            { key: 'joined', header: 'Joined' },
            { key: 'positions', header: 'Open', numeric: true },
            { key: 'status', header: 'Status', lead: true, render: u => <Badge tone={statusTone(u.status)}>{u.status}</Badge> },
            { key: 'act', header: '', render: u => <Button size="sm" variant="quiet" onClick={() => setSelected(u)}>Open</Button> }
          ]}
          rows={rows} empty="Nobody matches that search." />
      </Card>

      {selected ? (
        <Sheet title={selected.name} onClose={() => setSelected(null)} width={560}
          footer={<><Button variant="secondary" onClick={() => setSelected(null)}>Close</Button><Button>Save changes</Button></>}>
          <div className="sa-grid sa-grid--3">
            <Stat size="sm" label="Plan" value={selected.plan} />
            <Stat size="sm" label="Region" value={selected.region} />
            <Stat size="sm" label="Open positions" value={String(selected.positions)} />
          </div>
          <Select label="Plan" defaultValue={selected.plan} options={['Explorer', 'Trader']} />
          <Field label="Complimentary access until" type="date" hint="Leave empty for none." />
          <Switch defaultChecked label="Telegram alerts allowed" description="Turning this off stops all bot messages for this person." />
          <Callout tone="warn" title="Changes are logged">Every edit here is written to the audit log with your email against it.</Callout>
        </Sheet>
      ) : null}
    </>
  );
}

/* ---------- Subscriptions ---------- */
function Subscriptions() {
  return (
    <>
      <AdminHead title="Subscriptions" sub="Plans, payments and anything that needs chasing."
        actions={<Button variant="quiet" icon="sync">Retry failed payments</Button>} />
      <div className="sa-grid sa-grid--4" style={{ marginBottom: 'var(--s-5)' }}>
        <Card><Stat label="Active subscriptions" value="412" tone="gain" context="Renewing on their own." /></Card>
        <Card><Stat label="Failed this month" value="7" tone="loss" context="Worth £168 a month if all recover." /></Card>
        <Card><Stat label="Cancelled this month" value="9" context="Six said the trial was enough." /></Card>
        <Card><Stat label="Average revenue per user" value="£22.40" context="Blended across the three regions." /></Card>
      </div>
      <Card flush title="Recent payments">
        <DataTable primaryKey="user"
          columns={[
            { key: 'date', header: 'Date' }, { key: 'user', header: 'Person' }, { key: 'plan', header: 'Plan' },
            { key: 'method', header: 'Paid with' }, { key: 'amount', header: 'Amount', numeric: true },
            { key: 'status', header: 'Status', lead: true, render: p => <Badge tone={statusTone(p.status)}>{p.status}</Badge> }
          ]}
          rows={window.SAAdmin.payments} />
      </Card>
    </>
  );
}

/* ---------- Signal testing ---------- */
function SignalTesting({ theme }) {
  const [running, setRunning] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const go = () => {
    setRunning(true); setProgress(0);
    let p = 0;
    const t = setInterval(() => { p += 14; setProgress(Math.min(p, 100)); if (p >= 100) { clearInterval(t); setRunning(false); } }, 180);
  };
  return (
    <>
      <AdminHead title="Signal testing" sub="Try the formula's parameters against history before pushing them to everyone."
        actions={<Button icon="play_arrow" loading={running} onClick={go}>Run test</Button>} />
      <Card title="Parameters" hint="These are the live values. Changing them here does not publish them." style={{ marginBottom: 'var(--s-5)' }}>
        <div className="sa-grid sa-grid--4">
          <Field label="Profit target" defaultValue="8" hint="Percent above entry." />
          <Field label="Stop loss" defaultValue="5" hint="Percent below entry." />
          <Field label="Maximum hold" defaultValue="30" hint="Days before it sells anyway." />
          <Select label="Watchlist" defaultValue="All markets" options={['All markets', 'India', 'UK', 'US']} />
        </div>
        <div className="sa-row" style={{ marginTop: 'var(--s-4)', gap: 'var(--s-5)' }}>
          <Checkbox label="Require weekly confirmation" defaultChecked />
          <Checkbox label="Exclude illiquid stocks" defaultChecked />
        </div>
        {running ? <ProgressBar style={{ marginTop: 'var(--s-4)' }} label="Replaying 5 years" value={progress} detail={Math.round(progress * 11) + ' of 1,142 stocks' } /> : null}
      </Card>
      <div className="sa-grid sa-grid--2" style={{ marginBottom: 'var(--s-5)' }}>
        <Card><Stat label="Win rate with these settings" value="64.1%" tone="gain" benchmark={{ percent: 64.1 }} context="Live settings score 63.4%. A 0.7 point improvement." /></Card>
        <Card><Stat label="Trades it would generate" value="412" context="Against 389 on the live settings — 6% more activity." /></Card>
      </div>
      <Card flush title="Stocks triggering right now">
        <DataTable primaryKey="symbol"
          columns={[
            { key: 'symbol', header: 'Stock' }, { key: 'market', header: 'Market' },
            { key: 'trigger', header: 'Indicator', numeric: true },
            { key: 'weekly', header: 'Weekly', render: r => <Badge tone={r.weekly === 'Confirmed' ? 'gain' : 'warn'}>{r.weekly}</Badge> },
            { key: 'trades', header: 'Past trades', numeric: true },
            { key: 'winRate', header: 'Hit rate', numeric: true, lead: true, tone: () => 'gain' }
          ]}
          rows={window.SAAdmin.signalTests} />
      </Card>
    </>
  );
}

/* ---------- Broadcasts ---------- */
function Broadcast() {
  const [audience, setAudience] = React.useState('All');
  const [sent, setSent] = React.useState(false);
  const size = { All: 1284, Trader: 412, Explorer: 196 }[audience];
  return (
    <>
      <AdminHead title="Broadcasts" sub="Send one message to a group of people, by email or Telegram." />
      <div className="sa-grid sa-grid--split">
        <Card title="New broadcast">
          <div className="sa-stack" style={{ gap: 'var(--s-4)' }}>
            <div className="sa-field">
              <span className="sa-field__label">Who gets it</span>
              <SegmentedControl value={audience} onChange={setAudience} label="Audience" options={['All', 'Trader', 'Explorer']} />
              <span className="sa-field__hint">{size.toLocaleString()} people will receive this.</span>
            </div>
            <Field label="Subject" defaultValue="A change to how the scanner ranks signals" />
            <Field label="Message" multiline
              defaultValue={'From Monday the scanner will show a confidence figure next to every signal, based on how similar setups behaved over the last five years.\n\nNothing about the buy, target or stop rules changes.'} />
            <div className="sa-row" style={{ gap: 'var(--s-5)' }}>
              <Checkbox label="Send by email" defaultChecked />
              <Checkbox label="Send on Telegram" defaultChecked />
            </div>
            <Callout tone="warn" title="This cannot be unsent">Send a test to yourself first. Broadcasts go out immediately.</Callout>
            <div className="sa-row">
              <Button variant="secondary" icon="mail">Send me a test</Button>
              <Button icon="campaign" onClick={() => setSent(true)}>Send to {size.toLocaleString()} people</Button>
            </div>
            {sent ? <Callout tone="gain" title="Broadcast queued">Delivery started. Expect it to finish in about four minutes.</Callout> : null}
          </div>
        </Card>
        <Card flush title="Recent broadcasts">
          <DataTable primaryKey="subject"
            columns={[
              { key: 'subject', header: 'Subject' }, { key: 'when', header: 'Sent' },
              { key: 'to', header: 'To', numeric: true }, { key: 'open', header: 'Opened', numeric: true, lead: true }
            ]}
            rows={[
              { subject: 'Telegram alerts are live', when: '12 Jul', to: '1,102', open: '68%' },
              { subject: 'Pricing update for UK customers', when: '28 Jun', to: '392', open: '74%' },
              { subject: 'Scheduled maintenance, Sunday 02:00', when: '9 Jun', to: '1,041', open: '51%' }
            ]} />
        </Card>
      </div>
    </>
  );
}

/* ---------- Database ---------- */
function Database() {
  const [table, setTable] = React.useState('users');
  const [sql, setSql] = React.useState('select plan, count(*) from users group by plan;');
  const [ran, setRan] = React.useState(false);
  return (
    <>
      <AdminHead title="Database" sub="Read-only access to the production tables. Every query is logged."
        actions={<Badge tone="warn" icon="lock">Read only</Badge>} />
      <div className="sa-grid sa-grid--rail">
        <Card flush title="Tables">
          <DataTable primaryKey="name"
            columns={[
              { key: 'name', header: 'Table', render: t => (
                <button className="sa-btn sa-btn--quiet sa-btn--sm" style={{ minHeight: 28, padding: '0 6px' }} onClick={() => setTable(t.name)}>{t.name}</button>) },
              { key: 'rows', header: 'Rows', numeric: true, lead: true }
            ]}
            rows={window.SAAdmin.tables} />
        </Card>
        <div className="sa-stack">
          <Card title="Query" hint={'Running against ' + table + '. Selects only.'}>
            <Field multiline value={sql} onChange={e => setSql(e.target.value)}
              inputStyle={{ background: 'var(--surface-2)', fontVariantNumeric: 'tabular-nums' }} />
            <div className="sa-row" style={{ marginTop: 'var(--s-3)' }}>
              <Button icon="play_arrow" onClick={() => setRan(true)}>Run query</Button>
              <Button variant="quiet" icon="download">Download result</Button>
            </div>
          </Card>
          {ran ? (
            <Card flush title="Result" hint="2 rows · 31 ms">
              <DataTable primaryKey="plan"
                columns={[{ key: 'plan', header: 'plan' }, { key: 'count', header: 'count', numeric: true, lead: true }]}
                rows={[{ plan: 'Trader', count: '412' }, { plan: 'Explorer', count: '872' }]} />
            </Card>
          ) : (
            <Card flush><EmptyState icon="database" title="No query run yet">Write a select statement and press Run. Results appear here and can be downloaded as CSV.</EmptyState></Card>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------- Audit ---------- */
function Audit() {
  const [who, setWho] = React.useState('Everyone');
  const rows = window.SAAdmin.audit.filter(r => who === 'Everyone' || (who === 'System' ? r.who === 'system' : r.who !== 'system'));
  return (
    <>
      <AdminHead title="Audit log" sub="Every change anyone made, including automated jobs. Kept for seven years."
        actions={<Button variant="quiet" icon="download">Export</Button>} />
      <Card flush title="Recent activity"
        actions={<SegmentedControl value={who} onChange={setWho} label="Who" options={['Everyone', 'People', 'System']} />}>
        <DataTable primaryKey="action"
          columns={[
            { key: 'when', header: 'When' },
            { key: 'who', header: 'Who' },
            { key: 'action', header: 'What they did', lead: true },
            { key: 'detail', header: 'Detail' },
            { key: 'ip', header: 'From', numeric: true }
          ]}
          rows={rows} />
      </Card>
    </>
  );
}

/* ---------- Settings & roles ---------- */
function Settings() {
  const [tab, setTab] = React.useState('general');
  return (
    <>
      <AdminHead title="Settings & roles" sub="Platform-wide switches and who can touch what." />
      <Tabs value={tab} onChange={setTab} style={{ marginBottom: 'var(--s-5)' }}
        tabs={[{ id: 'general', label: 'General' }, { id: 'roles', label: 'Roles' }, { id: 'danger', label: 'Danger zone' }]} />
      {tab === 'general' ? (
        <div className="sa-grid sa-grid--2" style={{ alignItems: 'start' }}>
          <Card title="Scanning">
            <div className="sa-stack" style={{ gap: 'var(--s-4)' }}>
              <Switch defaultChecked label="Morning scan" description="Runs at 07:00 UK every weekday and sends results." />
              <Switch defaultChecked label="Intraday scanning" description="Re-checks open markets every 15 minutes." />
              <Field label="Maximum open positions per person" defaultValue="10" />
            </div>
          </Card>
          <Card title="Sign-ups">
            <div className="sa-stack" style={{ gap: 'var(--s-4)' }}>
              <Switch defaultChecked label="Open registration" description="Turn off to make the product invite-only." />
              <Field label="Free trial length in days" defaultValue="90" />
              <Select label="Default region when unknown" defaultValue="UK" options={['UK', 'India', 'US']} />
            </div>
          </Card>
        </div>
      ) : tab === 'roles' ? (
        <Card flush title="Who can do what">
          <DataTable primaryKey="role"
            columns={[
              { key: 'role', header: 'Role' }, { key: 'people', header: 'People', numeric: true },
              { key: 'can', header: 'Can do', lead: false },
              { key: 'cannot', header: 'Cannot do' }
            ]}
            rows={[
              { role: 'Owner', people: '1', can: 'Everything, including billing and roles', cannot: '—' },
              { role: 'Operator', people: '3', can: 'Users, subscriptions, broadcasts', cannot: 'Change roles or run queries' },
              { role: 'Analyst', people: '2', can: 'Read analytics and run queries', cannot: 'Change any user data' },
              { role: 'Support', people: '4', can: 'View users, grant complimentary access', cannot: 'See payment details' }
            ]} />
        </Card>
      ) : (
        <div className="sa-stack" style={{ maxWidth: 720 }}>
          <Callout tone="loss" title="These actions affect everyone">Nothing here has a confirmation step beyond the one in front of you. Be certain.</Callout>
          <Card title="Pause all signals" hint="Stops scanning and alerts for every customer until turned back on.">
            <Button variant="danger" icon="pause">Pause the platform</Button>
          </Card>
          <Card title="Rotate API keys" hint="Invalidates the Telegram and Stripe keys immediately.">
            <Button variant="danger" icon="key">Rotate keys</Button>
          </Card>
        </div>
      )}
    </>
  );
}

Object.assign(window, { Analytics, Users, Subscriptions, SignalTesting, Broadcast, Database, Audit, Settings });
