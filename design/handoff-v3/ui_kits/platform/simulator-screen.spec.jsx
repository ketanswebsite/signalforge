// Spec reference only — renamed from SimulatorScreen.jsx so the design-system compiler ignores it.
const { Card, Button, Select, Field, SegmentedControl, Stat, ChartFrame, DataTable, Badge, Callout, Icon } = window.SutrAlgoDesignSystem_eaaf37;

function SimulatorScreen({ theme }) {
  const [ran, setRan] = React.useState(true);
  const [range, setRange] = React.useState('1Y');

  return (
    <>
      <PageHead title="Simulator"
        sub="Run the formula over real past prices and see every trade it would have made. Nothing here involves real money."
        actions={<Button icon="play_arrow" onClick={() => setRan(true)}>Run it again</Button>} />

      <Card title="Set it up" hint="Three choices, then run." style={{ marginBottom: 'var(--s-5)' }}>
        <div className="sa-grid sa-grid--3">
          <Select label="Start from" defaultValue="One year ago" options={['Six months ago', 'One year ago', 'Three years ago', 'Five years ago']} />
          <Field label="Money per trade" icon="payments" defaultValue="500" hint="The same amount for every signal." />
          <Select label="Show amounts in" defaultValue="Pounds (£)" options={['Pounds (£)', 'Rupees (₹)', 'Dollars ($)']} />
        </div>
      </Card>

      {ran ? (
        <>
          <Callout tone="info" title="This is a simulation" style={{ marginBottom: 'var(--s-5)' }}>
            Real trading has costs, delays and slippage that this doesn't model. Treat it as a sense-check on the rule, not a forecast.
          </Callout>

          <div className="sa-grid sa-grid--4" style={{ marginBottom: 'var(--s-5)' }}>
            <Card><Stat label="What £10,000 became" value="£11,824" tone="gain" size="xl" context="Over one year, following every signal." /></Card>
            <Card><Stat label="Trades it would have made" value="412" context="About 8 a week across the three markets." /></Card>
            <Card><Stat label="How many made money" value="64.1%" tone="gain" benchmark={{ percent: 64.1 }} context="264 of 412 hit the +8% target." /></Card>
            <Card><Stat label="Worst stretch" value="−7.8%" tone="loss" context="The deepest fall from a high. It took 21 days to recover." /></Card>
          </div>

          <div className="sa-grid sa-grid--2" style={{ marginBottom: 'var(--s-5)' }}>
            <Card>
              <ChartFrame title="How the money grew"
                readAs="Each point is one trading day. The line is what £10,000 would be worth if you had taken every signal."
                legend={[{ label: 'Simulated portfolio', color: 'var(--accent)' }]}
                actions={<SegmentedControl value={range} onChange={setRange} label="Range" options={['3M', '1Y', '3Y', 'All']} />}>
                <LineChart data={window.SA.equity} theme={theme} height={230} />
              </ChartFrame>
            </Card>
            <Card>
              <ChartFrame title="Why each trade ended"
                readAs="Every trade ends one of three ways. Most reached the profit target; the stop did its job on about a quarter."
                legend={[{ label: 'Hit +8% target', color: 'var(--gain)' }, { label: 'Hit −5% stop', color: 'var(--loss)' }, { label: 'Ran out of time', color: 'var(--accent)' }]}>
                <Bars horizontal theme={theme} height={230}
                  labels={['Hit target', 'Hit stop', 'Ran out of time']}
                  values={[264, 96, 52]}
                  colors={['var(--gain)', 'var(--loss)', 'var(--accent)']} />
              </ChartFrame>
            </Card>
          </div>

          <div className="sa-grid sa-grid--2" style={{ marginBottom: 'var(--s-5)' }}>
            <Card>
              <ChartFrame title="Where the trades were"
                readAs="How the 412 trades split across the three markets the formula covers."
                height={180}>
                <Bars theme={theme} height={180} labels={['India', 'UK', 'US']} values={[196, 108, 108]}
                  colors={['var(--accent)', 'var(--accent)', 'var(--accent)']} />
              </ChartFrame>
            </Card>
            <Card>
              <ChartFrame title="How big the wins and losses were"
                readAs="Each bar is a band of results. Losses cluster at −5% because the stop cuts them there; wins cluster at +8% for the same reason."
                height={180}>
                <Bars theme={theme} height={180}
                  labels={['−5%', '−4 to 0%', '0 to 4%', '4 to 8%', '+8%']}
                  values={[96, 52, 44, 56, 164]}
                  colors={['var(--loss)', 'var(--loss)', 'var(--accent)', 'var(--gain)', 'var(--gain)']} />
              </ChartFrame>
            </Card>
          </div>

          <Card flush title="Every simulated trade" actions={<Button size="sm" variant="quiet" icon="download">Download CSV</Button>}>
            <DataTable primaryKey="symbol"
              caption="The first six of 412. Download the CSV for the rest."
              columns={[
                { key: 'symbol', header: 'Stock' },
                { key: 'closed', header: 'Sold on' },
                { key: 'held', header: 'Held for' },
                { key: 'money', header: 'Result', numeric: true, tone: r => r.pl.startsWith('-') ? 'loss' : 'gain' },
                { key: 'pl', header: 'Change', numeric: true, lead: true, tone: r => r.pl.startsWith('-') ? 'loss' : 'gain' },
                { key: 'reason', header: 'Why it sold' }
              ]}
              rows={window.SA.closed} />
          </Card>
        </>
      ) : null}
    </>
  );
}
Object.assign(window, { SimulatorScreen });
