/**
 * GAPS #14: every trade and position records the version of the trading rules it was booked under
 * (lib/shared/strategy-version.js, written by the INSERTs in database-postgres.js).
 *
 *   1. The stamp is STRATEGY_VERSION, plus the name of each rule switch that is on, read the way the code it
 *      switches reads it.
 *   2. The only statements that create a trade or a position are the three INSERTs in database-postgres.js, and
 *      each names strategy_version: an INSERT into either table anywhere else in the server code fails here.
 *   3. insertTrade, bulkInsertTrades and addHighConvictionTrade send strategyVersion() and never a version from the
 *      object they are handed (POST /api/trades spreads the request body into it).
 *   4. Every trade the trade API returns carries strategyVersion, benchmarkSymbol and benchmarkReturnPercent.
 * What the INSERTs do on a real Postgres is checked by the endpoint harness (POST /api/trades answers the stamp).
 */
const fs = require('fs');
const path = require('path');

jest.mock('pg', () => {
    const query = jest.fn();
    const connect = jest.fn();
    return { Pool: jest.fn(() => ({ query, connect })), __query: query, __connect: connect };
});

const { STRATEGY_VERSION, strategyVersion } = require('../../lib/shared/strategy-version');

const ROOT = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const squash = sql => sql.replace(/\s+/g, ' ').trim();

describe('the stamp', () => {
    test('is the version alone while no rule switch is on', () => {
        expect(STRATEGY_VERSION).toMatch(/^v\d+$/);
        expect(strategyVersion({})).toBe(STRATEGY_VERSION);
        expect(strategyVersion({
            PRICE_UNIT_REPAIR: 'false', STALE_FILL_REPAIR: '', AI_CONVICTION_GATE: 'true', MAX_ENTRY_DRIFT_PERCENT: '3'
        })).toBe(STRATEGY_VERSION);
        // an unreadable drift setting is the default, as it is for the executor
        expect(strategyVersion({ MAX_ENTRY_DRIFT_PERCENT: 'abc' })).toBe(STRATEGY_VERSION);
    });

    test('names each switch that is on, always in the same order', () => {
        expect(strategyVersion({ PRICE_UNIT_REPAIR: 'true' })).toBe(`${STRATEGY_VERSION}+unit-repair`);
        expect(strategyVersion({ STALE_FILL_REPAIR: 'TRUE' })).toBe(`${STRATEGY_VERSION}+stale-fill`);
        expect(strategyVersion({ AI_CONVICTION_GATE: 'false' })).toBe(`${STRATEGY_VERSION}+no-ai-gate`);
        expect(strategyVersion({ MAX_ENTRY_DRIFT_PERCENT: '2' })).toBe(`${STRATEGY_VERSION}+drift=2`);
        expect(strategyVersion({ SKIP_DEAD_TICKERS: 'true' })).toBe(`${STRATEGY_VERSION}+skip-dead`);
        const all = strategyVersion({
            MAX_ENTRY_DRIFT_PERCENT: '1.5', AI_CONVICTION_GATE: 'false', STALE_FILL_REPAIR: 'true', PRICE_UNIT_REPAIR: 'true'
        });
        expect(all).toBe(`${STRATEGY_VERSION}+unit-repair+stale-fill+no-ai-gate+drift=1.5`);
        expect(all.length).toBeLessThanOrEqual(64); // strategy_version is VARCHAR(64)
    });

    test('reads each switch exactly as the code it switches does', () => {
        const unitRepair = require('../../lib/shared/price-unit-repair');
        const staleFill = require('../../lib/shared/stale-fill-repair');
        for (const value of ['true', ' True ', 'yes', '1', 'false', '']) {
            expect(strategyVersion({ PRICE_UNIT_REPAIR: value }).includes('+unit-repair'))
                .toBe(unitRepair.isRepairEnabled({ PRICE_UNIT_REPAIR: value }));
            expect(strategyVersion({ STALE_FILL_REPAIR: value }).includes('+stale-fill'))
                .toBe(staleFill.isRepairEnabled({ STALE_FILL_REPAIR: value }));
        }
        // The AI gate is off only for exactly 'false', and the drift guard's default is 3, in every reader. If one
        // of these lines changes, the rules changed: bump STRATEGY_VERSION and keep strategy-version.js in step.
        const tickerHealth = require('../../lib/shared/ticker-health');
        for (const value of ['true', ' True ', 'TRUE', 'yes', '1', 'false', '']) {
            expect(strategyVersion({ SKIP_DEAD_TICKERS: value }).includes('+skip-dead'))
                .toBe(tickerHealth.skipEnabled({ SKIP_DEAD_TICKERS: value }));
        }
        const executor = read('lib/scheduler/trade-executor.js');
        const highConviction = read('lib/portfolio/high-conviction-manager.js');
        expect(executor).toContain('const MAX_ENTRY_DRIFT_PERCENT = parseFloat(process.env.MAX_ENTRY_DRIFT_PERCENT) || 3;');
        expect(highConviction).toContain('const MAX_ENTRY_DRIFT_PERCENT = parseFloat(process.env.MAX_ENTRY_DRIFT_PERCENT) || 3;');
        expect(read('lib/scanner/scanner.js')).toContain("if (process.env.AI_CONVICTION_GATE === 'false') {");
        expect(executor).toContain("if (process.env.AI_CONVICTION_GATE !== 'false') {");
    });
});

describe('the three INSERTs are the only way a trade or a position is created, and each is stamped', () => {
    const INSERT = /INSERT\s+INTO\s+(trades|high_conviction_portfolio)\b/gi;

    // Every server-side script: the app, its modules, its routes and the repo's tools (never the pages or tests)
    function serverFiles() {
        const out = ['server.js', 'database-postgres.js'];
        const walk = dir => {
            for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
                const rel = path.join(dir, entry.name);
                if (entry.isDirectory()) walk(rel);
                else if (entry.name.endsWith('.js')) out.push(rel);
            }
        };
        for (const dir of ['lib', 'routes', 'ml', 'middleware', 'config', 'scripts']) {
            if (fs.existsSync(path.join(ROOT, dir))) walk(dir);
        }
        return out;
    }

    test('no server file but database-postgres.js inserts into trades or high_conviction_portfolio', () => {
        const files = serverFiles();
        expect(files).toEqual(expect.arrayContaining(['server.js', path.join('lib', 'scheduler', 'trade-executor.js')]));
        const found = files.flatMap(file => [...read(file).matchAll(INSERT)].map(() => file));
        // positive control: the three known statements are seen
        expect(found.filter(file => file === 'database-postgres.js')).toHaveLength(3);
        expect(found.filter(file => file !== 'database-postgres.js')).toEqual([]);
    });

    test('each of them names strategy_version, and the module stamps it three times', () => {
        const source = read('database-postgres.js');
        const statements = [...source.matchAll(INSERT)]
            .map(match => source.slice(match.index, source.indexOf(')', source.indexOf('VALUES', match.index))));
        expect(statements).toHaveLength(3);
        for (const statement of statements) expect(statement).toMatch(/\bstrategy_version\b/);
        expect(source.match(/strategyVersion\(\)/g)).toHaveLength(3);
    });
});

describe('database-postgres.js over a mocked driver', () => {
    let TradeDB;
    let pgQuery;
    let pgConnect;
    let bootStatements;

    beforeAll(async () => {
        const pg = require('pg');
        pgQuery = pg.__query;
        pgConnect = pg.__connect;
        pgQuery.mockResolvedValue({ rows: [], rowCount: 0 });
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});

        const previousUrl = process.env.DATABASE_URL;
        process.env.DATABASE_URL = 'postgres://unit-test/none';
        TradeDB = require('../../database-postgres');
        if (previousUrl === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = previousUrl;

        // It runs its boot schema block as it loads: let that drain against the mocked driver first
        let seen;
        do {
            seen = pgQuery.mock.calls.length;
            await new Promise(resolve => setTimeout(resolve, 0));
        } while (pgQuery.mock.calls.length !== seen);
        bootStatements = pgQuery.mock.calls.map(([sql]) => squash(String(sql)));
    });

    // No rule switch on: every INSERT must stamp the bare version
    const SWITCH_ENV = ['PRICE_UNIT_REPAIR', 'STALE_FILL_REPAIR', 'AI_CONVICTION_GATE', 'MAX_ENTRY_DRIFT_PERCENT', 'SKIP_DEAD_TICKERS'];
    let savedSwitches;
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        savedSwitches = SWITCH_ENV.map(name => [name, process.env[name]]);
        for (const name of SWITCH_ENV) delete process.env[name];
    });
    afterEach(() => {
        for (const [name, value] of savedSwitches) {
            if (value === undefined) delete process.env[name];
            else process.env[name] = value;
        }
    });

    // A stored row as Postgres returns it (numeric columns as text)
    const storedRow = (extra = {}) => ({
        id: '42', symbol: 'HARNESS.L', user_id: 'owner@e2e.invalid', status: 'closed', market: 'UK', entry_price: '100',
        position_size: '400', strategy_version: 'v1', benchmark_symbol: '^FTSE', benchmark_return_percent: '-1.2345', ...extra
    });

    test('boot adds the three columns to both tables, idempotently', () => {
        for (const table of ['trades', 'high_conviction_portfolio']) {
            expect(bootStatements).toContain(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS strategy_version VARCHAR(64)`);
            expect(bootStatements).toContain(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS benchmark_symbol VARCHAR(20)`);
            expect(bootStatements).toContain(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS benchmark_return_percent DECIMAL(12, 4)`);
        }
    });

    test('insertTrade stamps the current version and ignores one the caller sends', async () => {
        pgQuery.mockReset();
        pgQuery.mockResolvedValue({ rows: [storedRow({ status: 'active', benchmark_symbol: null, benchmark_return_percent: null })], rowCount: 1 });
        // what POST /api/trades hands it: the request body, spread
        const trade = await TradeDB.insertTrade({
            symbol: 'HARNESS.L', entryDate: '2026-09-21', entryPrice: 100, shares: 4, autoAdded: false,
            strategyVersion: 'forged', strategy_version: 'forged', benchmarkReturnPercent: 99
        }, 'owner@e2e.invalid');
        const [sql, params] = pgQuery.mock.calls[0];
        expect(squash(sql)).toMatch(/entry_7day_dti, strategy_version \) VALUES \(.*\$33, \$34\)/);
        expect(params).toHaveLength(34);
        expect(params[33]).toBe(STRATEGY_VERSION);
        expect(params).not.toContain('forged');
        expect(params).not.toContain(99);
        expect(trade).toMatchObject({ strategyVersion: 'v1', benchmarkSymbol: null, benchmarkReturnPercent: null });
    });

    test('bulkInsertTrades stamps every imported trade', async () => {
        const clientQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 1 });
        pgConnect.mockResolvedValue({ query: clientQuery, release: jest.fn() });
        const count = await TradeDB.bulkInsertTrades([
            { symbol: 'A.L', entryDate: '2026-09-01', entryPrice: 10, strategyVersion: 'forged' },
            { symbol: 'B.L', entryDate: '2026-09-02', entryPrice: 20, status: 'closed', exitDate: '2026-09-05', exitPrice: 21 }
        ], 'owner@e2e.invalid');
        expect(count).toBe(2);
        const inserts = clientQuery.mock.calls.filter(([sql]) => /INSERT INTO trades/.test(sql));
        expect(inserts).toHaveLength(2);
        for (const [sql, params] of inserts) {
            expect(squash(sql)).toMatch(/notes, user_id, strategy_version \) VALUES \(.*\$16, \$17\)/);
            expect(params).toHaveLength(17);
            expect(params[16]).toBe(STRATEGY_VERSION);
            expect(params).not.toContain('forged');
        }
    });

    test('addHighConvictionTrade stamps the position', async () => {
        pgQuery.mockReset();
        pgQuery.mockResolvedValue({ rows: [{ id: 5, strategy_version: 'v1' }], rowCount: 1 });
        await TradeDB.addHighConvictionTrade({
            symbol: 'HARNESSH.L', market: 'UK', signalDate: '2026-09-21', entryDate: '2026-09-21', entryPrice: 100,
            targetPrice: 108, stopLossPrice: 95, squareOffDate: '2026-10-21', strategyVersion: 'forged'
        });
        const [sql, params] = pgQuery.mock.calls[0];
        expect(squash(sql)).toMatch(/entry_dti, strategy_version \) VALUES \(.*\$18, \$19\) RETURNING \*/);
        expect(params).toHaveLength(19);
        expect(params[18]).toBe(STRATEGY_VERSION);
        expect(params).not.toContain('forged');
    });

    test('every trade the trade API reads carries its provenance', async () => {
        pgQuery.mockReset();
        pgQuery.mockResolvedValue({ rows: [storedRow()], rowCount: 1 });
        const expected = { strategyVersion: 'v1', benchmarkSymbol: '^FTSE', benchmarkReturnPercent: -1.2345 };
        expect((await TradeDB.getAllTrades('owner@e2e.invalid'))[0]).toMatchObject(expected);
        expect((await TradeDB.getActiveTrades('owner@e2e.invalid'))[0]).toMatchObject(expected);
        expect((await TradeDB.getActiveTrades())[0]).toMatchObject(expected);
        expect((await TradeDB.getClosedTrades('owner@e2e.invalid'))[0]).toMatchObject(expected);
        expect(await TradeDB.getTradeById('42', 'owner@e2e.invalid')).toMatchObject(expected);
    });

    test('a row from before versioning reads null, and a benchmark of 0 stays 0', async () => {
        pgQuery.mockReset();
        pgQuery.mockResolvedValue({ rows: [storedRow({ strategy_version: null, benchmark_symbol: '^NSEI', benchmark_return_percent: '0.0000' })], rowCount: 1 });
        expect(await TradeDB.getTradeById('42', 'owner@e2e.invalid')).toMatchObject({
            strategyVersion: null, benchmarkSymbol: '^NSEI', benchmarkReturnPercent: 0
        });
        pgQuery.mockResolvedValue({ rows: [storedRow({ strategy_version: null, benchmark_symbol: null, benchmark_return_percent: null })], rowCount: 1 });
        expect((await TradeDB.getClosedTrades('owner@e2e.invalid'))[0]).toMatchObject({
            strategyVersion: null, benchmarkSymbol: null, benchmarkReturnPercent: null
        });
    });
});
