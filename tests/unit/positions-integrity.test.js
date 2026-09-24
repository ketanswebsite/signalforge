/**
 * Positions integrity (database-postgres.js editActiveTrade, closeTradeAndRelease,
 * deleteTrade, deleteAllTrades; the routes are POST, PUT and DELETE /api/trades*
 * in server.js)
 *
 * The stale-save race. The Positions edit dialog opens on an active trade. Before it
 * is saved, the exit monitor closes the position: closeTradeAndRelease writes status
 * 'closed' and the exit fields, and hands the trade's capital back to the ledger. The
 * dialog used to PUT its whole cached copy of the trade, and TradeDB.updateTrade wrote
 * every field it was given with no status check, so that save put status 'active' and
 * empty exit fields back: the trade reopened, and its next close released the same
 * capital a second time. editActiveTrade writes the price paid and the notes only,
 * and only while the trade is still active.
 *
 * The fake database below executes the UPDATEs it is sent, assignment by assignment
 * and condition by condition, and refuses any statement it does not know. A version
 * that writes status or an exit field, or drops the status guard, fails here.
 *
 * Deletes. deleteTrade and deleteAllTrades take the trade out of the ledger in the
 * same statement, using the amounts POST /api/ops/reconcile-capital derives from the
 * trades table (CapitalManager.reconcileReport, pinned below). What that SQL does on a
 * real Postgres is checked by the endpoint harness: trading.json ends with a reconcile
 * dry run after the trade deletes and requires zero drift.
 */
const fs = require('fs');
const path = require('path');

jest.mock('pg', () => {
    const query = jest.fn();
    const connect = jest.fn();
    return { Pool: jest.fn(() => ({ query, connect })), __query: query, __connect: connect };
});

const USER = 'owner@e2e.invalid';
const squash = sql => sql.replace(/\s+/g, ' ').trim();
const SERVER = squash(fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8'));
const CAPITAL_MANAGER = squash(fs.readFileSync(path.join(__dirname, '../../lib/portfolio/capital-manager.js'), 'utf8'));

let TradeDB;
let pgQuery;
let pgConnect;

beforeAll(async () => {
    const pg = require('pg');
    pgQuery = pg.__query;
    pgConnect = pg.__connect;
    pgQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // The real module, over the mocked driver
    const previousUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgres://unit-test/none';
    TradeDB = require('../../database-postgres');
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;

    // It runs its boot-time schema block as it loads: let that drain against the
    // mocked driver so it cannot interleave with a test
    let seen;
    do {
        seen = pgQuery.mock.calls.length;
        await new Promise(resolve => setTimeout(resolve, 0));
    } while (pgQuery.mock.calls.length !== seen);
});

beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

// Splits "a = $1, notes = COALESCE($7, notes)" at the commas outside brackets
function assignments(list) {
    const parts = [];
    let depth = 0;
    let current = '';
    for (const ch of list) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if (ch === ',' && depth === 0) {
            parts.push(current.trim());
            current = '';
            continue;
        }
        current += ch;
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
}

function updateTrades(db, setList, whereList, params) {
    const param = n => params[Number(n) - 1];
    const conditions = whereList.split(' AND ').map(c => c.trim());
    const matches = row => conditions.every(c => {
        let m;
        if ((m = c.match(/^id = \$(\d+)$/))) return String(row.id) === String(param(m[1]));
        if ((m = c.match(/^user_id = \$(\d+)$/))) return row.user_id === param(m[1]);
        if (c === "status = 'active'") return row.status === 'active';
        throw new Error(`fake database: unexpected condition: ${c}`);
    });
    const rows = db.trades.filter(matches);
    for (const row of rows) {
        const old = { ...row }; // right-hand sides read the row as it was
        for (const assignment of assignments(setList)) {
            let m;
            if ((m = assignment.match(/^(\w+) = \$(\d+)$/))) {
                row[m[1]] = param(m[2]);
            } else if ((m = assignment.match(/^(\w+) = '([^']*)'$/))) {
                row[m[1]] = m[2];
            } else if (assignment === 'updated_at = CURRENT_TIMESTAMP') {
                row.updated_at = 'now';
            } else if ((m = assignment.match(/^notes = COALESCE\(\$(\d+), notes\)$/))) {
                row.notes = param(m[1]) === null || param(m[1]) === undefined ? old.notes : param(m[1]);
            } else if ((m = assignment.match(/^target_price = CASE WHEN entry_price > 0 THEN target_price \* \$(\d+)::numeric \/ entry_price ELSE target_price END$/))) {
                row.target_price = old.entry_price > 0 && old.target_price !== null
                    ? old.target_price * Number(param(m[1])) / old.entry_price
                    : old.target_price;
            } else {
                throw new Error(`fake database: unexpected assignment: ${assignment}`);
            }
        }
    }
    return { rows: rows.map(r => ({ ...r })), rowCount: rows.length };
}

const RELEASE = 'UPDATE portfolio_capital SET allocated_capital = allocated_capital - $1, realized_pl = realized_pl + $2, '
    + 'available_capital = initial_capital + (realized_pl + $2) - (allocated_capital - $1), '
    + 'active_positions = GREATEST(active_positions - 1, 0), updated_at = CURRENT_TIMESTAMP '
    + 'WHERE market = $3 AND user_id = $4 RETURNING *';

/**
 * One automatic UK trade (500 allocated) and its ledger, and the statements the real
 * module sends to close and to edit it. Anything else is refused.
 */
function fakeDatabase() {
    const db = {
        trades: [{
            id: 7, user_id: USER, symbol: 'HARNESS.L', status: 'active', auto_added: true, market: 'UK',
            entry_date: new Date('2026-09-15T12:00:00Z'), entry_price: 100, shares: 5,
            investment_amount: 500, trade_size: 500, target_price: 108, stop_loss_percent: 5,
            square_off_date: '2026-10-15', exit_date: null, exit_price: null, exit_reason: null,
            profit_loss: null, profit_loss_percentage: null, notes: 'Auto-executed at 1 PM UK time'
        }],
        ledger: [{
            user_id: USER, market: 'UK', initial_capital: 10000, realized_pl: 0,
            allocated_capital: 500, available_capital: 9500, active_positions: 1
        }],
        statements: []
    };

    const run = async (sql, params = []) => {
        const text = squash(sql);
        db.statements.push(text);
        if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(text)) return { rows: [], rowCount: 0 };

        if (text === "SELECT * FROM trades WHERE id = $1 AND user_id = $2 AND status = 'active' FOR UPDATE") {
            const rows = db.trades
                .filter(t => String(t.id) === String(params[0]) && t.user_id === params[1] && t.status === 'active')
                .map(t => ({ ...t }));
            return { rows, rowCount: rows.length };
        }

        const update = text.match(/^UPDATE trades SET (.+) WHERE (.+?)( RETURNING \*)?$/);
        if (update) return updateTrades(db, update[1], update[2], params);

        if (text === RELEASE) {
            const rows = db.ledger.filter(l => l.market === params[2] && l.user_id === params[3]);
            for (const l of rows) {
                l.allocated_capital -= Number(params[0]);
                l.realized_pl += Number(params[1]);
                l.available_capital = l.initial_capital + l.realized_pl - l.allocated_capital;
                l.active_positions = Math.max(l.active_positions - 1, 0);
            }
            return { rows: rows.map(l => ({ ...l })), rowCount: rows.length };
        }

        throw new Error(`fake database: unexpected statement: ${text}`);
    };

    pgQuery.mockImplementation(run);
    pgConnect.mockImplementation(async () => ({ query: run, release: () => {} }));
    return db;
}

// What the dialog had on screen: the whole trade, as the page loaded it
const staleCopy = () => ({
    id: 7, symbol: 'HARNESS.L', status: 'active', entryPrice: 100, shares: 5,
    exitDate: null, exitPrice: null, exitReason: null, profitLoss: 0, profitLossPercentage: 0,
    stopLossPrice: 95, targetPrice: 108, squareOffDate: '2026-10-15', notes: 'Auto-executed at 1 PM UK time'
});

// The exit monitor's close (lib/portfolio/exit-monitor.js closeTrade)
const monitorClose = (exitPrice, day) => TradeDB.closeTradeAndRelease(7, {
    exitDate: new Date(`2026-09-${day}T14:00:00Z`),
    exitPrice,
    profitLoss: (exitPrice - 100) * 5,
    profitLossPercent: exitPrice - 100,
    exitReason: `Stop loss hit: ${(exitPrice - 100).toFixed(2)}%`
}, USER);

describe('a save from a dialog opened before the exit monitor closed the trade', () => {
    let db;
    beforeEach(() => { db = fakeDatabase(); });

    test('writes nothing: the trade stays closed and its capital was released once', async () => {
        const close = await monitorClose(94.5, 22);
        expect(close).toMatchObject({ closed: true, released: true, investmentReleased: 500 });
        const closedRow = { ...db.trades[0] };
        const ledgerAfterClose = { ...db.ledger[0] };
        expect(ledgerAfterClose).toMatchObject({ allocated_capital: 0, realized_pl: -27.5, active_positions: 0 });

        const saved = await TradeDB.editActiveTrade(7, { ...staleCopy(), entryPrice: 101, notes: 'bought a bit higher' }, USER);

        expect(saved).toBeNull();
        expect(db.trades[0]).toEqual(closedRow);
        expect(db.trades[0]).toMatchObject({ status: 'closed', exit_price: 94.5, profit_loss: -27.5 });
        expect(db.ledger[0]).toEqual(ledgerAfterClose);
    });

    test('so the next close finds nothing to close, and nothing is released twice', async () => {
        await monitorClose(94.5, 22);
        const ledgerAfterClose = { ...db.ledger[0] };
        await TradeDB.editActiveTrade(7, { ...staleCopy(), notes: 'late note' }, USER);

        const again = await monitorClose(90, 23);

        expect(again).toMatchObject({ closed: false, released: false });
        expect(db.ledger[0]).toEqual(ledgerAfterClose);
        expect(db.trades[0]).toMatchObject({ status: 'closed', exit_price: 94.5, notes: 'Auto-executed at 1 PM UK time' });
    });
});

describe('an edit of an active trade', () => {
    let db;
    beforeEach(() => { db = fakeDatabase(); });

    test('writes the price paid and the notes and nothing else, even when handed the whole trade', async () => {
        const saved = await TradeDB.editActiveTrade(7, {
            ...staleCopy(),
            status: 'closed', exitDate: '2026-09-20T10:00:00Z', exitPrice: 1, exitReason: 'forged',
            profitLoss: 99999, stopLossPercent: 50, targetPrice: 1, squareOffDate: '2030-01-01',
            autoAdded: false, investmentAmount: 1, shares: 500, entryPrice: 110, notes: 'fixed a typo'
        }, USER);

        expect(saved).not.toBeNull();
        expect(db.trades[0]).toMatchObject({
            status: 'active', exit_date: null, exit_price: null, exit_reason: null, profit_loss: null,
            stop_loss_percent: 5, square_off_date: '2026-10-15', auto_added: true, investment_amount: 500,
            shares: 5, entry_price: 110, notes: 'fixed a typo'
        });
        // The target keeps its +8% on the new price paid
        expect(db.trades[0].target_price).toBeCloseTo(118.8, 6);
        expect(db.ledger[0]).toMatchObject({ allocated_capital: 500, active_positions: 1 });
    });

    test("never touches another user's trade", async () => {
        const before = { ...db.trades[0] };
        expect(await TradeDB.editActiveTrade(7, { notes: 'not mine' }, 'someone-else@e2e.invalid')).toBeNull();
        expect(db.trades[0]).toEqual(before);
    });

    test('sends nothing when it is given nothing it may write', async () => {
        expect(await TradeDB.editActiveTrade(7, { status: 'closed', exitPrice: 1 }, USER)).toBeNull();
        expect(db.statements).toEqual([]);
    });

    test('a close can carry notes, written in the same UPDATE; without them the notes stay', async () => {
        await TradeDB.closeTradeAndRelease(7, {
            exitDate: new Date('2026-09-22T14:00:00Z'), exitPrice: 109, exitReason: 'Manual Exit', notes: 'sold before results'
        }, USER);
        // No P/L given: worked out from the row's own entry price and shares
        expect(db.trades[0]).toMatchObject({ status: 'closed', exit_price: 109, profit_loss: 45, notes: 'sold before results' });

        const other = fakeDatabase();
        await monitorClose(94.5, 22);
        expect(other.trades[0]).toMatchObject({ status: 'closed', notes: 'Auto-executed at 1 PM UK time' });
    });
});

describe("a delete takes the trade out of the ledger in the same statement", () => {
    // The amounts POST /api/ops/reconcile-capital derives the ledger from
    // (CapitalManager.reconcileReport, which the nightly drift check runs too)
    const RECONCILE = [
        "SUM(CASE WHEN status = 'active' THEN COALESCE(investment_amount, trade_size, 0) ELSE 0 END)",
        "COUNT(*) FILTER (WHERE status = 'active')",
        "SUM(CASE WHEN status = 'closed' THEN COALESCE( profit_loss, (exit_price - entry_price) * shares, "
            + 'COALESCE(investment_amount, trade_size) * profit_loss_percentage / 100, 0) ELSE 0 END)',
        'WHERE auto_added = true AND market IS NOT NULL'
    ];

    beforeEach(() => {
        pgQuery.mockReset();
        pgQuery.mockResolvedValue({ rows: [{ deleted: 1, ledgers_settled: 1 }], rowCount: 1 });
    });

    // (the source checks below compare booleans and lists: a failing toContain on
    // server.js would print the whole file)
    test('control: the reconcile endpoint derives the ledger with exactly these expressions', () => {
        // The route asks CapitalManager.reconcileReport() and holds no SQL of its own:
        // the nightly drift check (ledger-drift-check.js) runs the same computation
        const start = SERVER.indexOf("app.post('/api/ops/reconcile-capital'");
        const route = start < 0 ? '' : SERVER.slice(start, SERVER.indexOf("app.get('/api/ops/version'", start));
        expect(route.includes('const report = await CapitalManager.reconcileReport();')).toBe(true);
        expect(route.includes('FROM portfolio_capital')).toBe(false);
        expect(CAPITAL_MANAGER.includes('async reconcileReport() {')).toBe(true);
        expect(RECONCILE.filter(expression => !CAPITAL_MANAGER.includes(expression))).toEqual([]);
    });

    test('deleteTrade: one statement deletes the row and settles its ledger with those amounts', async () => {
        expect(await TradeDB.deleteTrade(7, USER)).toEqual({ deleted: 1, ledgersSettled: 1 });

        expect(pgQuery).toHaveBeenCalledTimes(1);
        const [sql, params] = pgQuery.mock.calls[0];
        const text = squash(sql);
        expect(text).toMatch(/^WITH gone AS \( DELETE FROM trades WHERE id = \$1 AND user_id = \$2 RETURNING \* \)/);
        expect([
            ...RECONCILE,
            'allocated_capital = pc.allocated_capital - effect.allocated',
            'realized_pl = pc.realized_pl - effect.realized',
            'active_positions = GREATEST(pc.active_positions - effect.positions, 0)'
        ].filter(expression => !text.includes(expression))).toEqual([]);
        expect(params).toEqual([7, USER]);
    });

    test("deleteAllTrades: the same settle, scoped to the caller's rows", async () => {
        pgQuery.mockResolvedValue({ rows: [{ deleted: 3, ledgers_settled: 2 }], rowCount: 1 });

        expect(await TradeDB.deleteAllTrades(USER)).toEqual({ deleted: 3, ledgersSettled: 2 });

        expect(pgQuery).toHaveBeenCalledTimes(1);
        const [sql, params] = pgQuery.mock.calls[0];
        expect(squash(sql)).toMatch(/^WITH gone AS \( DELETE FROM trades WHERE user_id = \$1 RETURNING \* \)/);
        expect(params).toEqual([USER]);
    });

    test('a trade that is not there deletes nothing', async () => {
        pgQuery.mockResolvedValue({ rows: [{ deleted: 0, ledgers_settled: 0 }], rowCount: 1 });
        expect(await TradeDB.deleteTrade(999, USER)).toEqual({ deleted: 0, ledgersSettled: 0 });
    });
});

describe('server.js: the routes use only these writes', () => {
    test('nothing can write a whole trade object any more', () => {
        expect(TradeDB.updateTrade).toBeUndefined();
        expect(TradeDB.closeTrade).toBeUndefined();
        expect(SERVER.includes('TradeDB.updateTrade(')).toBe(false);
    });

    test('PUT edits through editActiveTrade and closes through closeTradeAndRelease, P/L never from the body', () => {
        const put = SERVER.slice(SERVER.indexOf("app.put('/api/trades/:id'"), SERVER.indexOf("app.delete('/api/trades/:id'"));
        expect([
            'TradeDB.editActiveTrade(req.params.id, edit, userId)',
            'TradeDB.closeTradeAndRelease(req.params.id, {'
        ].filter(call => !put.includes(call))).toEqual([]);
        expect(/body\.profitLoss/.test(put)).toBe(false);
    });

    test('create and bulk import only make manual trades; bulk answers { success, count }', () => {
        expect([
            'TradeDB.insertTrade({ ...req.body, symbol: req.body.symbol.trim(), autoAdded: false }, userId)',
            'res.json({ success: true, count, message: `Imported ${count} trades` })'
        ].filter(line => !SERVER.includes(line))).toEqual([]);
    });

    test('the boot position recount counts open automatic trades only, as the reconcile does', () => {
        const sync = SERVER.slice(SERVER.indexOf('Syncing active_positions counters'), SERVER.indexOf('All counters already in sync'));
        expect(sync.includes("t.status = 'active' AND t.auto_added = true")).toBe(true);
    });
});
