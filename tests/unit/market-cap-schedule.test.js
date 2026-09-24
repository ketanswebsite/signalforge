/**
 * The market-cap refresh schedule (lib/scheduler/market-cap-updater.js) and the monthly AI sweep.
 *
 * The sweep starts at 08:00 UK on the first Saturday of the month and reads Yahoo's chart
 * endpoint for every symbol. The Saturday refresh walked the same endpoint for every symbol at
 * the same minute, for 40-55 minutes, and two walks at once get throttled: a throttled sweep
 * stores nothing. Pinned down here:
 *   1. The Saturday 08:00 refresh stands aside on sweep day, judged by the sweep's own
 *      isSweepDay() - so the two cannot disagree about which Saturday it is - and runs on
 *      every other Saturday.
 *   2. With the sweep switched off (CONVICTION_SWEEP=false) there is nothing to make room
 *      for: the refresh runs on the first Saturday too.
 *   3. The weekday 06:00 refresh never asks.
 *   4. A sweep module that cannot answer never costs the refresh, and nothing escapes the
 *      cron callback (an unhandled rejection kills the whole web process on Node 22).
 */

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../database-postgres', () => ({ pool: { query: jest.fn() }, storeMarketCap: jest.fn() }));
jest.mock('../../ml/conviction-sweep', () => ({ isSweepDay: jest.fn() }));

const cron = require('node-cron');
const ConvictionSweep = require('../../ml/conviction-sweep');
const updater = require('../../lib/scheduler/market-cap-updater');

const envAtStart = process.env.CONVICTION_SWEEP;

function initialize() {
    cron.schedule.mockImplementation(() => ({ stop: jest.fn() }));   // restoreMocks wipes it before every test
    updater.isInitialized = false;                                     // the module is a singleton
    updater.initialize();
}
const cronAt = expression => cron.schedule.mock.calls.find(([e]) => e === expression);
const logged = () => console.log.mock.calls.flat().join('\n');

beforeEach(() => {
    delete process.env.CONVICTION_SWEEP;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(updater, 'updateAllMarketCaps').mockResolvedValue({ updated: 0, failed: 0 });
});

afterAll(() => {
    if (envAtStart === undefined) delete process.env.CONVICTION_SWEEP;
    else process.env.CONVICTION_SWEEP = envAtStart;
});

test('the Saturday 08:00 refresh stands aside on sweep day, and runs on every other Saturday', async () => {
    initialize();
    const [, fire, options] = cronAt('0 8 * * 6');
    expect(options).toMatchObject({ timezone: 'Europe/London' });

    ConvictionSweep.isSweepDay.mockReturnValue(true);
    await fire();
    expect(updater.updateAllMarketCaps).not.toHaveBeenCalled();
    expect(logged()).toMatch(/Weekend update skipped: sweep day/);

    ConvictionSweep.isSweepDay.mockReturnValue(false);
    await fire();
    expect(updater.updateAllMarketCaps).toHaveBeenCalledTimes(1);
});

test('the sweep switched off (CONVICTION_SWEEP=false): the refresh runs on the first Saturday too', async () => {
    process.env.CONVICTION_SWEEP = 'false';
    initialize();
    const [, fire] = cronAt('0 8 * * 6');
    ConvictionSweep.isSweepDay.mockReturnValue(true);

    await fire();

    expect(updater.updateAllMarketCaps).toHaveBeenCalledTimes(1);
});

test('the weekday 06:00 refresh never asks about the sweep', async () => {
    initialize();
    const [, fire, options] = cronAt('0 6 * * 1-5');
    expect(options).toMatchObject({ timezone: 'Europe/London' });
    ConvictionSweep.isSweepDay.mockReturnValue(true);

    await fire();

    expect(updater.updateAllMarketCaps).toHaveBeenCalledTimes(1);
    expect(ConvictionSweep.isSweepDay).not.toHaveBeenCalled();
});

test('a sweep module that cannot answer never costs the refresh, and nothing escapes the cron', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    initialize();
    const [, fire] = cronAt('0 8 * * 6');
    ConvictionSweep.isSweepDay.mockImplementation(() => { throw new Error('boom'); });

    await expect(fire()).resolves.toBeUndefined();

    expect(updater.updateAllMarketCaps).toHaveBeenCalledTimes(1);
});

test('the one question it asks is the sweep\'s own isSweepDay(), about now', () => {
    ConvictionSweep.isSweepDay.mockReturnValue(true);
    const now = new Date('2026-10-03T07:00:00Z');                    // Sat 3 Oct, 08:00 UK

    expect(updater.yieldsToSweep(now)).toBe(true);
    expect(ConvictionSweep.isSweepDay).toHaveBeenCalledWith(now);
});
