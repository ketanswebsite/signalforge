/**
 * The 7 AM scan stores its signals in process (lib/scanner/signal-store.js).
 *
 * They used to travel through POST /api/signals/from-scan, a route in front of
 * the /api sign-in gate that stored anyone's signals, AI verdict included, for
 * the 1 PM executor to book and broadcast. These tests pin the store's
 * semantics (the route's, unchanged) and that the route and the HTTP hop are
 * gone for good.
 */

jest.mock('../../database-postgres', () => ({
    getPendingSignal: jest.fn(),
    storePendingSignal: jest.fn()
}));

const fs = require('fs');
const path = require('path');
const TradeDB = require('../../database-postgres');
const { storeScanSignals } = require('../../lib/scanner/signal-store');

const signal = (symbol, extra = {}) => ({ symbol, signalDate: '2026-09-24', status: 'pending', ...extra });

beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

describe('storeScanSignals', () => {
    test('stores a new signal exactly as the scanner built it, status and AI verdict included', async () => {
        TradeDB.getPendingSignal.mockResolvedValue(null);
        TradeDB.storePendingSignal.mockResolvedValue({ id: 7 });
        const s = signal('AAA.L', { status: 'dismissed', convictionVerdict: 'WATCH' });

        const r = await storeScanSignals([s]);

        expect(TradeDB.getPendingSignal).toHaveBeenCalledWith('AAA.L', '2026-09-24');
        expect(TradeDB.storePendingSignal).toHaveBeenCalledWith(s);
        expect(r).toMatchObject({ created: 1, duplicates: 0, errors: 0 });
        expect(r.details.storedSignals).toEqual([{ id: 7, symbol: 'AAA.L' }]);
    });

    test('leaves an existing signal for the same symbol and date untouched and reports a duplicate', async () => {
        TradeDB.getPendingSignal.mockResolvedValue({ id: 3, symbol: 'AAA.L' });

        const r = await storeScanSignals([signal('AAA.L')]);

        expect(TradeDB.storePendingSignal).not.toHaveBeenCalled();
        expect(r).toMatchObject({ created: 0, duplicates: 1, errors: 0 });
        expect(r.details.duplicateSignals).toEqual([{ symbol: 'AAA.L', reason: 'Signal already exists for today' }]);
    });

    test('a failure on one signal is recorded and the others are still stored', async () => {
        TradeDB.getPendingSignal.mockResolvedValue(null);
        TradeDB.storePendingSignal
            .mockRejectedValueOnce(new Error('value too long'))
            .mockResolvedValueOnce({ id: 9 });

        const r = await storeScanSignals([signal('BAD.NS'), signal('GOOD.NS')]);

        expect(r).toMatchObject({ created: 1, duplicates: 0, errors: 1 });
        expect(r.details.errorSignals).toEqual([{ symbol: 'BAD.NS', reason: 'value too long' }]);
        expect(r.details.storedSignals).toEqual([{ id: 9, symbol: 'GOOD.NS' }]);
    });

    test('values reach the database as they did over HTTP: a NaN score is stored as null, not NaN', async () => {
        TradeDB.getPendingSignal.mockResolvedValue(null);
        TradeDB.storePendingSignal.mockResolvedValue({ id: 5 });

        await storeScanSignals([signal('NAN.L', { convictionScore: NaN, winRate: Infinity, extra: undefined })]);

        const stored = TradeDB.storePendingSignal.mock.calls[0][0];
        expect(stored.convictionScore).toBeNull();
        expect(stored.winRate).toBeNull();
        expect('extra' in stored).toBe(false);
    });

    test('an empty or missing list stores nothing', async () => {
        expect(await storeScanSignals([])).toMatchObject({ created: 0, duplicates: 0, errors: 0 });
        expect(await storeScanSignals(undefined)).toMatchObject({ created: 0, duplicates: 0, errors: 0 });
        expect(TradeDB.storePendingSignal).not.toHaveBeenCalled();
    });
});

describe('the anonymous route and the HTTP hop are gone', () => {
    const read = rel => fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8');

    test('server.js defines no POST /api/signals/from-scan (control: GET /api/signals/pending is still there)', () => {
        const src = read('server.js');
        expect(src).not.toMatch(/app\.post\(\s*['"`]\/api\/signals\/from-scan/);
        expect(src).toMatch(/app\.get\(\s*['"`]\/api\/signals\/pending/);
    });

    test('the scanner stores in process instead of POSTing to itself', () => {
        const src = read('lib/scanner/scanner.js');
        expect(src).not.toMatch(/axios\.post\(\s*signalsUrl/);
        expect(src).not.toMatch(/const signalsUrl\b/);
        expect(src).toMatch(/await storeScanSignals\(signalsToStore\)/);
    });
});
