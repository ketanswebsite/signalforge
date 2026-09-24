/**
 * Alert policy — which personal Telegram DMs a subscriber's Alerts page withholds
 * (lib/shared/alert-policy.js)
 *
 * Until this module no sender read alert_preferences, so every switch on the
 * Alerts page was decorative. The rule has one bias, and these tests pin it:
 * everything ambiguous SENDS. A DM to someone who already gets them costs nothing;
 * a stop-loss DM silently withheld from a paying subscriber is a failure they
 * cannot report. Only an explicit `false` withholds.
 *
 * The trap this guards against: telegram_enabled used to DEFAULT false, and the
 * page POSTs the whole preferences object, so flipping any switch stored an
 * opt-out nobody chose. "No row" must therefore mean "everything on".
 */

const fs = require('fs');
const path = require('path');
const {
    shouldSendOwnerAlert,
    ownerWantsAlert,
    SWITCH_FOR_EVENT,
    MASTER_SWITCH
} = require('../../lib/shared/alert-policy');

const EVENTS = Object.keys(SWITCH_FOR_EVENT);
const ALL_ON = {
    telegram_enabled: true,
    alert_on_buy: true,
    alert_on_target: true,
    alert_on_stoploss: true,
    alert_on_time_exit: true
};

describe('a subscriber who never saved a row gets everything', () => {
    test.each([...EVENTS, 'eod', 'an_exit_type_nobody_has_mapped'])('%s sends with no row', (event) => {
        expect(shouldSendOwnerAlert(null, event)).toBe(true);
        expect(shouldSendOwnerAlert(undefined, event)).toBe(true);
    });
});

describe('the master switch', () => {
    test.each([...EVENTS, 'eod', 'an_exit_type_nobody_has_mapped'])('off withholds %s', (event) => {
        expect(shouldSendOwnerAlert({ ...ALL_ON, [MASTER_SWITCH]: false }, event)).toBe(false);
    });

    test('off wins over a per-event switch that is on', () => {
        expect(shouldSendOwnerAlert({ ...ALL_ON, telegram_enabled: false, alert_on_target: true }, 'target_reached')).toBe(false);
    });

    test('a NULL master column is not an opt-out', () => {
        expect(shouldSendOwnerAlert({ ...ALL_ON, telegram_enabled: null }, 'stop_loss')).toBe(true);
        const { telegram_enabled, ...withoutMaster } = ALL_ON;
        expect(shouldSendOwnerAlert(withoutMaster, 'stop_loss')).toBe(true);
    });
});

describe('the per-event switches', () => {
    test.each(Object.entries(SWITCH_FOR_EVENT))('%s is withheld by %s, and only by it', (event, column) => {
        expect(shouldSendOwnerAlert({ ...ALL_ON, [column]: false }, event)).toBe(false);

        const everyOtherSwitchOff = Object.fromEntries(
            Object.keys(ALL_ON).map(key => [key, key === column || key === MASTER_SWITCH])
        );
        expect(shouldSendOwnerAlert(everyOtherSwitchOff, event)).toBe(true);
    });

    test('a trailing stop is a stop: it answers to the stop switch', () => {
        expect(SWITCH_FOR_EVENT.trailing_stop).toBe(SWITCH_FOR_EVENT.stop_loss);
    });

    test('day 30 and the square-off date are the same promise on the page', () => {
        expect(SWITCH_FOR_EVENT.max_days).toBe('alert_on_time_exit');
        expect(SWITCH_FOR_EVENT.square_off).toBe('alert_on_time_exit');
    });

    test('a NULL per-event column is not an opt-out', () => {
        expect(shouldSendOwnerAlert({ ...ALL_ON, alert_on_stoploss: null }, 'stop_loss')).toBe(true);
        expect(shouldSendOwnerAlert({ telegram_enabled: true }, 'stop_loss')).toBe(true);
    });
});

describe('events with no switch of their own answer to the master switch alone', () => {
    const everyEventOff = {
        telegram_enabled: true,
        alert_on_buy: false,
        alert_on_target: false,
        alert_on_stoploss: false,
        alert_on_time_exit: false
    };

    test('the evening summary ignores the per-event switches', () => {
        expect(shouldSendOwnerAlert(everyEventOff, 'eod')).toBe(true);
    });

    test('an exit type this table has never heard of still sends', () => {
        expect(shouldSendOwnerAlert(everyEventOff, 'an_exit_type_nobody_has_mapped')).toBe(true);
    });
});

describe('ownerWantsAlert — what the senders call', () => {
    beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
    afterEach(() => jest.restoreAllMocks());

    test('decides from the loaded row', async () => {
        await expect(ownerWantsAlert(async () => ({ ...ALL_ON, alert_on_target: false }), 'target_reached')).resolves.toBe(false);
        await expect(ownerWantsAlert(async () => ({ ...ALL_ON, alert_on_target: false }), 'stop_loss')).resolves.toBe(true);
        await expect(ownerWantsAlert(async () => null, 'stop_loss')).resolves.toBe(true);
    });

    test('a failed read sends, and says so — it never withholds', async () => {
        const failing = async () => { throw new Error('connection terminated'); };
        await expect(ownerWantsAlert(failing, 'stop_loss')).resolves.toBe(true);
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('connection terminated'));
    });
});

describe('the table keeps up with the code around it', () => {
    const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', '..', ...parts), 'utf8');

    // Read as text: requiring database-postgres.js opens a pool and runs the schema
    test('every switch is a real alert_preferences column', () => {
        const schema = read('database-postgres.js');
        for (const column of [MASTER_SWITCH, ...Object.values(SWITCH_FOR_EVENT)]) {
            expect(schema).toMatch(new RegExp(`\\b${column} BOOLEAN\\b`));
        }
    });

    // An unmapped exit type still sends (fail-open), but adding one should be a
    // decision someone makes, not something that happens by omission
    test('every exit type the exit monitor can produce has been given a switch', () => {
        const exitTypes = [...read('lib', 'portfolio', 'exit-monitor.js').matchAll(/exitType = '([a-z_]+)'/g)].map(m => m[1]);
        expect(exitTypes.length).toBeGreaterThanOrEqual(4);
        for (const exitType of exitTypes) {
            expect(SWITCH_FOR_EVENT).toHaveProperty(exitType);
        }
    });

    test('the Alerts page offers exactly the switches this module honours', () => {
        const pageKeys = [...read('public', 'js', 'alerts-page.js').matchAll(/\{ key: '([a-z_]+)'/g)].map(m => m[1]);
        const honoured = new Set([MASTER_SWITCH, ...Object.values(SWITCH_FOR_EVENT)]);
        expect(new Set(pageKeys)).toEqual(honoured);
    });
});
