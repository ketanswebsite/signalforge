/**
 * Dated exchange rates (lib/shared/fx-rates.js, GAPS #11) against the harness's real Postgres: the store's table, the
 * refresh's upsert (a close already stored is not written again, a revised one is), the high-conviction restamp's
 * UPDATE, and GET /api/fx/rates serving what was stored.
 *
 * The harness server never refreshes (FX_RATES_REFRESH=false, cron stubbed, no network), so the refresh runs here, in
 * the test process, on the scratch database, with currency series made here (fetchChart is injected): no request
 * leaves the machine. Its rows are deleted afterwards and the seeded positions get their own figures back.
 */
'use strict';

const { Pool } = require('pg');
const h = require('./harness/client');
const FxRates = require('../../lib/shared/fx-rates');

const DAY = 86400 * 1000;
const isoDay = d => d.toISOString().slice(0, 10);
// The last 20 weekdays up to yesterday (UTC), each bar at 12:00 UTC: the same calendar day in London
function weekdays() {
    const days = [];
    const d = new Date(); d.setUTCHours(12, 0, 0, 0);
    while (days.length < 20) {
        d.setTime(d.getTime() - DAY);
        if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) days.unshift(new Date(d));
    }
    return days;
}
const DAYS = weekdays();
const inrOf = i => 115 + i * 0.25;
const usdOf = i => 1.3 + i * 0.002;
function series(symbol, bump = 0) {
    const of = symbol === 'GBPINR=X' ? inrOf : usdOf;
    return {
        chart: {
            result: [{
                meta: { symbol, exchangeTimezoneName: 'Europe/London' },
                timestamp: DAYS.map(d => Math.floor(d.getTime() / 1000)),
                indicators: { quote: [{ close: DAYS.map((d, i) => of(i) + (i === DAYS.length - 1 ? bump : 0)) }] }
            }],
            error: null
        }
    };
}
const COLUMNS = 'investment_gbp::float8 AS investment_gbp, investment_inr::float8 AS investment_inr, investment_usd::float8 AS investment_usd, ' +
    'pl_amount_gbp::float8 AS pl_amount_gbp, pl_amount_inr::float8 AS pl_amount_inr, pl_amount_usd::float8 AS pl_amount_usd';

let pool;
let before = [];
const ids = {};

beforeAll(async () => {
    // the refresh's one summary line per run is expected here
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    pool = new Pool({ connectionString: h.state().env.DATABASE_URL });
    // the seeded positions' figures, to give them back afterwards: the restamp covers the whole book
    before = (await pool.query(`SELECT id, ${COLUMNS} FROM high_conviction_portfolio`)).rows;
    // a UK position closed on DAYS[12] with a £20 gain, its rupees and dollars at the old fixed rates
    ids.closed = (await pool.query(`
        INSERT INTO high_conviction_portfolio (symbol, name, market, signal_date, entry_date, entry_price, target_price, stop_loss_price,
                                               square_off_date, investment_gbp, investment_inr, investment_usd, status, exit_date,
                                               exit_price, exit_reason, pl_percent, pl_amount_gbp, pl_amount_inr, pl_amount_usd)
        VALUES ('HARNESSFX.L', 'Harness FX', 'UK', $1, $1, 100, 108, 95, $2, 250, 26250, 318, 'closed', $3, 108, 'Harness', 8, 20, 2100, 25.4)
        RETURNING id`, [isoDay(DAYS[5]), isoDay(new Date(DAYS[5].getTime() + 30 * DAY)), isoDay(DAYS[12])])).rows[0].id;
});

afterAll(async () => {
    if (pool) {
        await pool.query('DELETE FROM high_conviction_portfolio WHERE id = $1', [ids.closed || 0]);
        for (const row of before) {
            await pool.query(`UPDATE high_conviction_portfolio SET investment_gbp = $2, investment_inr = $3, investment_usd = $4,
                                     pl_amount_gbp = $5, pl_amount_inr = $6, pl_amount_usd = $7 WHERE id = $1`,
            [row.id, row.investment_gbp, row.investment_inr, row.investment_usd, row.pl_amount_gbp, row.pl_amount_inr, row.pl_amount_usd]);
        }
        await pool.query(`SELECT to_regclass('public.fx_rates') IS NOT NULL AS present`).then(async ({ rows: [t] }) => {
            if (t.present) await pool.query('DELETE FROM fx_rates');
        });
        await pool.end();
    }
    jest.restoreAllMocks();
});

const stored = async () => (await pool.query(`SELECT pair, to_char(day, 'YYYY-MM-DD') AS day, rate::float8 AS rate FROM fx_rates ORDER BY pair, day`)).rows;

test('a failed request writes nothing, and the run still ends normally', async () => {
    const summary = await FxRates.refreshFxRates({ pool, env: {}, fetchChart: async () => { throw new Error('harness: no network'); } });
    expect(summary).toMatchObject({ enabled: true, requested: 2, stored: 0, pairs: null, failedPairs: 'GBPINR,GBPUSD', restamped: 0 });
    expect(summary.error).toBeUndefined();
    expect(await stored()).toEqual([]);
});

test('the refresh stores every final close, one request per pair, and a second run writes nothing new', async () => {
    const asked = [];
    const summary = await FxRates.refreshFxRates({ pool, env: {}, fetchChart: async (symbol, params) => { asked.push({ symbol, params }); return series(symbol); } });
    expect(summary.error).toBeUndefined();
    expect(asked.map(a => a.symbol)).toEqual(['GBPINR=X', 'GBPUSD=X']);
    for (const { params } of asked) expect(params.period1).toBe(Math.floor(Date.parse(FxRates.HISTORY_START + 'T00:00:00Z') / 1000));
    expect(summary).toMatchObject({ requested: 2, stored: 2 * DAYS.length, pairs: 'GBPINR,GBPUSD', failedPairs: null, newestDay: isoDay(DAYS[DAYS.length - 1]) });
    const rows = await stored();
    expect(rows.filter(r => r.pair === 'GBPINR').map(r => [r.day, r.rate])).toEqual(DAYS.map((d, i) => [isoDay(d), inrOf(i)]));
    expect(rows.filter(r => r.pair === 'GBPUSD').map(r => [r.day, r.rate])).toEqual(DAYS.map((d, i) => [isoDay(d), Math.round(usdOf(i) * 1e8) / 1e8]));

    // the same closes again: nothing written (NUMERIC(18, 8) compares equal); the next request starts LEAD_DAYS back
    const asked2 = [];
    const again = await FxRates.refreshFxRates({ pool, env: {}, fetchChart: async (symbol, params) => { asked2.push(params); return series(symbol); } });
    expect(again).toMatchObject({ stored: 0, failedPairs: null });
    const newest = Date.parse(isoDay(DAYS[DAYS.length - 1]) + 'T00:00:00Z');
    for (const params of asked2) expect(params.period1 * 1000).toBe(newest - FxRates.LEAD_DAYS * DAY);

    // a revised close is written over the old one
    const revised = await FxRates.refreshFxRates({ pool, env: {}, fetchChart: async symbol => series(symbol, symbol === 'GBPINR=X' ? 0.5 : 0) });
    expect(revised).toMatchObject({ stored: 1 });
    expect((await stored()).find(r => r.pair === 'GBPINR' && r.day === isoDay(DAYS[DAYS.length - 1])).rate).toBe(inrOf(DAYS.length - 1) + 0.5);
});

test('the high-conviction book is restamped at each position\'s own day, the pound column untouched', async () => {
    const { rows: [row] } = await pool.query(`SELECT ${COLUMNS} FROM high_conviction_portfolio WHERE id = $1`, [ids.closed]);
    // invested £250 on DAYS[5], made £20 by DAYS[12]
    expect(row).toEqual({
        investment_gbp: 250,
        investment_inr: Math.round(250 * inrOf(5) * 1e4) / 1e4,
        investment_usd: Math.round(250 * usdOf(5) * 1e4) / 1e4,
        pl_amount_gbp: 20,
        pl_amount_inr: Math.round(20 * inrOf(12) * 1e4) / 1e4,
        pl_amount_usd: Math.round(20 * usdOf(12) * 1e4) / 1e4
    });
});

test('GET /api/fx/rates serves every calendar day of the window with the rates in force that day', async () => {
    // from two days before the first stored close to the eighth: a day before the first close takes the first
    const from = isoDay(new Date(DAYS[0].getTime() - 2 * DAY));
    const to = isoDay(DAYS[7]);
    const r = await h.request('user', 'GET', `/api/fx/rates?from=${from}&to=${to}`);
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ success: true, from, to, source: 'dated', firstStoredDay: isoDay(DAYS[0]), columns: ['day', 'GBPINR', 'GBPUSD'] });
    const expectedDays = [];
    for (let t = Date.parse(from + 'T00:00:00Z'); t <= Date.parse(to + 'T00:00:00Z'); t += DAY) {
        const day = isoDay(new Date(t));
        // the last stored weekday on or before it; before the first stored day, the first
        const i = Math.max(0, DAYS.map(isoDay).filter(d => d <= day).length - 1);
        expectedDays.push([day, inrOf(i), Math.round(usdOf(i) * 1e8) / 1e8]);
    }
    expect(r.json.days).toEqual(expectedDays);
});
