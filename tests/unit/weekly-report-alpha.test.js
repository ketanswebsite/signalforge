/**
 * The weekly report's alpha (GAPS #15): each position closed that week shows its market index's return over the same
 * days (benchmark_return_percent, filled nightly by lib/portfolio/benchmark-fill.js) and its lead in points, and the
 * week shows the average alpha - over the positions whose index return is known. A position without one yet (its
 * exit day's index close not final, or a failed fill) shows none, and a week with none shows no alpha line.
 */
'use strict';

jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('../../lib/telegram/telegram-bot', () => ({ broadcastToSubscribers: jest.fn(), sendTelegramAlert: jest.fn() }));
jest.mock('pg', () => ({ Pool: jest.fn(() => ({ query: jest.fn(), connect: jest.fn() })) }));
jest.mock('../../database-postgres', () => ({ pool: { query: jest.fn() } }));

const HighConvictionPortfolioManager = require('../../lib/portfolio/high-conviction-manager');
const format = data => Object.create(HighConvictionPortfolioManager.prototype).formatWeeklyReportMessage({
    summary: { active_trades: 0, closed_trades: 2, winning_trades: 1, losing_trades: 1 },
    activeTrades: [],
    weekStart: new Date('2026-09-19T09:00:00Z'),
    weekEnd: new Date('2026-09-26T09:00:00Z'),
    ...data
});
const closed = extra => ({ name: 'Harness plc', symbol: 'HARNESS.L', currency_symbol: '£', exit_price: '104', pl_percent: '4.5', exit_reason: 'Take Profit', ...extra });

test('a closed position with its index return: the index, its return and the lead in points; the week\'s alpha', () => {
    const text = format({ closedThisWeek: [
        closed({ benchmark_symbol: '^FTSE', benchmark_return_percent: '1.2' }),
        closed({ symbol: 'LOSS.NS', pl_percent: '-5', benchmark_symbol: '^NSEI', benchmark_return_percent: '-0.8' })
    ] });
    expect(text).toContain('   vs FTSE 100: +1.20% (+3.30 pts)\n');
    expect(text).toContain('   vs NIFTY 50: -0.80% (-4.20 pts)\n');
    // average own (4.5 - 5) / 2 = -0.25; average index (1.2 - 0.8) / 2 = 0.2; alpha -0.45
    expect(text).toContain('Alpha this week: -0.45 pts (average -0.25% against the index\'s +0.20%, 2 of 2 closed)\n');
});

test('a position whose index return is not known yet shows none, and counts out of the week\'s alpha', () => {
    const text = format({ closedThisWeek: [
        closed({ benchmark_symbol: '^GSPC', benchmark_return_percent: '2' }),
        closed({ symbol: 'NEW.L', benchmark_symbol: null, benchmark_return_percent: null })
    ] });
    expect(text.match(/vs S&P 500: \+2\.00% \(\+2\.50 pts\)/g)).toHaveLength(1);
    expect(text).toContain('Alpha this week: +2.50 pts (average +4.50% against the index\'s +2.00%, 1 of 2 closed)');
});

test('a week with no index returns: no vs lines and no alpha line, the report as before', () => {
    const text = format({ closedThisWeek: [closed({ benchmark_return_percent: null })] });
    expect(text).not.toMatch(/vs |Alpha this week/);
    expect(text).toContain('Reason: Take Profit');
});
