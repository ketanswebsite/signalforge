/**
 * Display formatting that people read.
 *
 * 1. /health's UK clock. The old code shifted a Date to UK wall time and then formatted that
 *    in London again, so during British Summer Time it ran an hour ahead and announced the
 *    7 AM scan as 08:00. Pinned to real instants on both sides of the clock change.
 * 2. The EOD summary's signed percentage: a tiny loss printed "-0.00%".
 */

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../database-postgres', () => ({ pool: { query: jest.fn() } }));
// Under jsdom, jest resolves cheerio's "browser" build, which is ESM and will not parse.
// Only the EOD news reader uses cheerio; nothing here goes near it.
jest.mock('cheerio', () => ({ load: jest.fn() }));

const { formatUKClock, nextUKWeekdayRun } = require('../../lib/shared/date-format');
const { pct } = require('../../lib/portfolio/eod-summary');

describe('formatUKClock - the time in London', () => {
    test('British Summer Time: 22:44 UTC is 23:44 in London, not 00:44', () => {
        expect(formatUKClock(new Date('2026-09-23T22:44:49Z'))).toBe('23/09/2026, 23:44:49');
    });

    test('Greenwich Mean Time: London and UTC agree', () => {
        expect(formatUKClock(new Date('2026-12-04T06:30:00Z'))).toBe('04/12/2026, 06:30:00');
    });

    test('just after midnight in London reads 00, never 24', () => {
        expect(formatUKClock(new Date('2026-09-23T23:30:00Z'))).toBe('24/09/2026, 00:30:00');
    });
});

describe('nextUKWeekdayRun - when the 7 AM scan runs next', () => {
    test.each([
        ['a BST evening, Wednesday: Thursday', '2026-09-23T22:44:49Z', '24/09/2026, 07:00:00'],
        ['06:59 in London (05:59 UTC, BST), Thursday: today', '2026-09-24T05:59:00Z', '24/09/2026, 07:00:00'],
        ['07:00 in London (06:00 UTC, BST): today\'s run has started', '2026-09-24T06:00:00Z', '25/09/2026, 07:00:00'],
        ['Friday after the run: Monday', '2026-09-25T07:30:00Z', '28/09/2026, 07:00:00'],
        ['Saturday: Monday', '2026-09-26T10:00:00Z', '28/09/2026, 07:00:00'],
        ['the Sunday the clocks go back: Monday', '2026-10-25T01:30:00Z', '26/10/2026, 07:00:00'],
        ['06:30 GMT, Friday: today', '2026-12-04T06:30:00Z', '04/12/2026, 07:00:00']
    ])('%s', (_, now, expected) => {
        expect(nextUKWeekdayRun(new Date(now), 7)).toBe(expected);
    });
});

describe('pct - the EOD summary\'s signed percentage', () => {
    test.each([
        [-0.001, '+0.00%'],
        [-0.004, '+0.00%'],
        [-0.006, '-0.01%'],
        [0, '+0.00%'],
        [1.234, '+1.23%'],
        [0.126, '+0.13%'],
        [-12.5, '-12.50%'],
        [7, '+7.00%']
    ])('%p prints %s', (v, expected) => {
        expect(pct(v)).toBe(expected);
    });

    test('NaN stays visible', () => {
        expect(pct(NaN)).toBe('NaN%');
    });
});
