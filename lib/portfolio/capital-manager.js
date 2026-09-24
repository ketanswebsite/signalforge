/**
 * Portfolio Capital Manager
 * Checks a new trade against the paper-capital ledger (portfolio_capital) and
 * works out what the ledger should hold from the trades table (reconcileReport).
 */

const TradeDB = require('../../database-postgres');

class CapitalManager {
    constructor() {
        this.CONFIG = {
            TRADE_SIZES: {
                'India': { currency: 'INR', amount: 50000 },
                'UK': { currency: 'GBP', amount: 400 },
                'US': { currency: 'USD', amount: 500 }
            },
            MAX_POSITIONS_TOTAL: 30,
            MAX_POSITIONS_PER_MARKET: 10
        };
    }

    /**
     * Get current capital status for all markets
     * @param {string} userId - User email for capital isolation
     */
    async getCapitalStatus(userId) {
        const capital = await TradeDB.getPortfolioCapital(null, userId);

        // Calculate totals
        const totalPositions = Object.values(capital)
            .reduce((sum, m) => sum + m.positions, 0);

        const utilizationPercent = (totalPositions / this.CONFIG.MAX_POSITIONS_TOTAL) * 100;

        return {
            capital,
            totals: {
                totalPositions,
                maxTotalPositions: this.CONFIG.MAX_POSITIONS_TOTAL,
                utilizationPercent: utilizationPercent.toFixed(1)
            }
        };
    }

    /**
     * Calculate dynamic trade size based on capital
     */
    calculateTradeSize(market, capital) {
        const marketCap = capital[market];
        if (!marketCap) return this.CONFIG.TRADE_SIZES[market].amount;

        // Dynamic sizing: divide available capital by max positions
        const totalCapital = marketCap.initial + marketCap.realized;
        const dynamicSize = totalCapital / this.CONFIG.MAX_POSITIONS_PER_MARKET;

        // Floor: don't go below 10% of standard size
        const minSize = this.CONFIG.TRADE_SIZES[market].amount * 0.1;

        return Math.max(dynamicSize, minSize);
    }

    /**
     * Validate if trade can be added
     * @param {string} userId - User email for capital isolation
     */
    async validateTradeEntry(market, symbol, userId) {
        // Get current capital status
        const capital = await TradeDB.getPortfolioCapital(null, userId);
        const status = await this.getCapitalStatus(userId);

        // Check 1: Total position limit
        if (status.totals.totalPositions >= this.CONFIG.MAX_POSITIONS_TOTAL) {
            return {
                valid: false,
                reason: `Total portfolio limit reached (${status.totals.totalPositions}/30)`,
                code: 'TOTAL_LIMIT'
            };
        }

        // Check 2: Market position limit
        const marketCap = capital[market];
        if (!marketCap) {
            return {
                valid: false,
                reason: `Market ${market} not found`,
                code: 'MARKET_NOT_FOUND'
            };
        }

        if (marketCap.positions >= this.CONFIG.MAX_POSITIONS_PER_MARKET) {
            return {
                valid: false,
                reason: `Market limit reached for ${market} (${marketCap.positions}/10)`,
                code: 'MARKET_LIMIT'
            };
        }

        // Check 3: Capital availability
        const requiredCapital = this.calculateTradeSize(market, capital);
        if (marketCap.available < requiredCapital) {
            return {
                valid: false,
                reason: `Insufficient capital in ${market} market`,
                details: {
                    required: requiredCapital,
                    available: marketCap.available,
                    shortfall: requiredCapital - marketCap.available
                },
                code: 'INSUFFICIENT_CAPITAL'
            };
        }

        // Check 4: Duplicate position check (must be scoped to the booking user —
        // without userId this queried user_id='default' and never matched anything)
        const existingTrade = await TradeDB.getActiveTradeBySymbol(symbol, userId);
        if (existingTrade) {
            return {
                valid: false,
                reason: `Already have active position in ${symbol}`,
                code: 'DUPLICATE_POSITION',
                existingTradeId: existingTrade.id
            };
        }

        // All checks passed
        return {
            valid: true,
            tradeSize: requiredCapital,
            currency: marketCap.currency
        };
    }

    /**
     * The ledger as the trades table says it should be, one entry per
     * portfolio_capital row: what the row holds (before), what it should hold
     * (after) and the difference, trades minus ledger (drift). Only automatic
     * trades count: manual trades never allocate. Reads only.
     *
     * The one computation behind POST /api/ops/reconcile-capital (server.js),
     * which writes `after` back with ?apply=true, and the nightly drift check
     * (ledger-drift-check.js), which only reports. deleteTradesAndSettle in
     * database-postgres.js settles a delete with these same amounts.
     */
    async reconcileReport() {
        const { rows } = await TradeDB.pool.query(`
            SELECT pc.user_id, pc.market, pc.currency,
                   pc.initial_capital::float,
                   pc.realized_pl::float        AS ledger_realized,
                   pc.allocated_capital::float  AS ledger_allocated,
                   pc.available_capital::float  AS ledger_available,
                   pc.active_positions          AS ledger_positions,
                   COALESCE(t.realized, 0)::float  AS trades_realized,
                   COALESCE(t.allocated, 0)::float AS trades_allocated,
                   COALESCE(t.open_count, 0)::int  AS trades_positions
            FROM portfolio_capital pc
            LEFT JOIN (
              SELECT user_id, market,
                     SUM(CASE WHEN status = 'closed' THEN COALESCE(
                           profit_loss,
                           (exit_price - entry_price) * shares,
                           COALESCE(investment_amount, trade_size) * profit_loss_percentage / 100,
                           0) ELSE 0 END) AS realized,
                     SUM(CASE WHEN status = 'active' THEN COALESCE(investment_amount, trade_size, 0) ELSE 0 END) AS allocated,
                     COUNT(*) FILTER (WHERE status = 'active') AS open_count
              FROM trades
              WHERE auto_added = true AND market IS NOT NULL
              GROUP BY user_id, market
            ) t ON t.user_id = pc.user_id AND t.market = pc.market
            ORDER BY pc.user_id, pc.market
        `);

        return rows.map(r => {
            const targetAvailable = r.initial_capital + r.trades_realized - r.trades_allocated;
            return {
                user_id: r.user_id,
                market: r.market,
                currency: r.currency,
                before: {
                    realized: r.ledger_realized,
                    allocated: r.ledger_allocated,
                    available: r.ledger_available,
                    positions: r.ledger_positions
                },
                after: {
                    realized: r.trades_realized,
                    allocated: r.trades_allocated,
                    available: targetAvailable,
                    positions: r.trades_positions
                },
                drift: {
                    realized: +(r.trades_realized - r.ledger_realized).toFixed(2),
                    allocated: +(r.trades_allocated - r.ledger_allocated).toFixed(2),
                    available: +(targetAvailable - r.ledger_available).toFixed(2),
                    positions: r.trades_positions - r.ledger_positions
                }
            };
        });
    }
}

module.exports = new CapitalManager();
