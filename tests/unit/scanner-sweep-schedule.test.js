/**
 * How the scanner cron hub (lib/scanner/scanner.js) wires the monthly AI sweep - GAPS #21.
 *
 *   1. The Saturday 08:00 cron runs the sweep only on sweep day, as the 'monthly' run,
 *      judged by the same isSweepDay() the restart pick-up uses - so the two cannot
 *      disagree about which Saturday it is.
 *   2. Nothing the sweep throws escapes the cron callback (an unhandled rejection kills
 *      the whole web process on Node 22).
 *   3. Boot schedules the restart check once; CONVICTION_SWEEP=false schedules neither.
 */

jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
// Under jsdom, jest resolves cheerio's "browser" build, which is ESM and will not parse
jest.mock('cheerio', () => ({ load: jest.fn() }));
jest.mock('../../database-postgres', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../lib/telegram/telegram-bot', () => ({
    sendTelegramAlert: jest.fn(),
    broadcastToSubscribers: jest.fn()
}));
jest.mock('../../ml/conviction-sweep', () => ({
    isSweepDay: jest.fn(),
    runConvictionSweep: jest.fn(),
    scheduleResumeCheck: jest.fn()
}));

const cron = require('node-cron');
const ConvictionSweep = require('../../ml/conviction-sweep');
const StockScanner = require('../../lib/scanner/scanner');

const envAtStart = process.env.CONVICTION_SWEEP;

function initialize() {
    cron.schedule.mockImplementation(() => ({ stop: jest.fn() }));   // restoreMocks wipes it before every test
    new StockScanner().initialize();
}
const sweepCron = () => cron.schedule.mock.calls.find(([expression]) => expression === '0 8 * * 6');

beforeEach(() => {
    delete process.env.CONVICTION_SWEEP;
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
    if (envAtStart === undefined) delete process.env.CONVICTION_SWEEP;
    else process.env.CONVICTION_SWEEP = envAtStart;
});

test('the Saturday 08:00 cron runs the sweep only on sweep day, as the monthly run', async () => {
    initialize();
    const [, fire, options] = sweepCron();
    expect(options).toMatchObject({ timezone: 'Europe/London' });

    ConvictionSweep.isSweepDay.mockReturnValue(false);
    await fire();
    expect(ConvictionSweep.runConvictionSweep).not.toHaveBeenCalled();

    ConvictionSweep.isSweepDay.mockReturnValue(true);
    ConvictionSweep.runConvictionSweep.mockResolvedValue({ started: true });
    await fire();
    expect(ConvictionSweep.runConvictionSweep).toHaveBeenCalledTimes(1);
    expect(ConvictionSweep.runConvictionSweep).toHaveBeenCalledWith({ trigger: 'monthly' });
});

test('a sweep that throws never escapes the cron callback', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    initialize();
    const [, fire] = sweepCron();
    ConvictionSweep.isSweepDay.mockReturnValue(true);
    ConvictionSweep.runConvictionSweep.mockRejectedValue(new Error('boom'));

    await expect(fire()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith('❌ [CRON] Conviction sweep failed:', 'boom');
});

test('boot schedules the restart check, once', () => {
    initialize();

    expect(ConvictionSweep.scheduleResumeCheck).toHaveBeenCalledTimes(1);
});

test('CONVICTION_SWEEP=false: no monthly cron and no restart check', () => {
    process.env.CONVICTION_SWEEP = 'false';
    initialize();

    expect(sweepCron()).toBeUndefined();
    expect(ConvictionSweep.scheduleResumeCheck).not.toHaveBeenCalled();
});
