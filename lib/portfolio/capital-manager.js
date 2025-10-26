/**
 * Portfolio Capital Manager
 * Handles capital tracking, allocation, and validation
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
     */
    async getCapitalStatus() {
        const capital = await TradeDB.getPortfolioCapital();

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
     */
    async validateTradeEntry(market, symbol) {
        // Get current capital status
        const capital = await TradeDB.getPortfolioCapital();
        const status = await this.getCapitalStatus();

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

        // Check 4: Duplicate position check
        const existingTrade = await TradeDB.getActiveTradeBySymbol(symbol);
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
     * Allocate capital for new trade
     */
    async allocateForTrade(market, symbol, entryPrice) {
        // Validate first
        const validation = await this.validateTradeEntry(market, symbol);
        if (!validation.valid) {
            throw new Error(validation.reason);
        }

        // Allocate capital
        await TradeDB.allocateCapital(market, validation.tradeSize);

        return {
            allocated: validation.tradeSize,
            currency: validation.currency,
            market: market
        };
    }

    /**
     * Release capital when trade closes
     */
    async releaseFromTrade(trade) {
        // Determine market from symbol if not provided
        const market = trade.market || this.getMarketFromSymbol(trade.symbol);

        // Get investment amount (handle both camelCase and snake_case)
        const investmentAmount = trade.investment_amount || trade.trade_size || 0;

        // Use actual profit_loss if available (most accurate), otherwise calculate from percentage
        let plAmount;
        if (trade.profit_loss !== undefined && trade.profit_loss !== null) {
            plAmount = parseFloat(trade.profit_loss);
        } else {
            // Fallback: calculate from percentage (handle both parameter name variations)
            const plPercent = trade.profitLossPercent || trade.profit_loss_percentage || 0;
            plAmount = (investmentAmount * plPercent) / 100;
        }

        console.log(`[CAPITAL] Releasing capital: market=${market}, investment=${investmentAmount}, plAmount=${plAmount}, symbol=${trade.symbol}`);

        // Release capital back to market (updates realized_pl in portfolio_capital table)
        await TradeDB.releaseCapital(market, investmentAmount, plAmount);

        return {
            released: investmentAmount,
            pl: plAmount,
            currency: trade.currency,
            market: market
        };
    }

    /**
     * Get capital summary for display
     */
    async getCapitalSummary() {
        const status = await this.getCapitalStatus();
        const capital = status.capital;

        return {
            india: {
                currency: '₹',
                available: capital.India.available.toLocaleString('en-IN'),
                positions: capital.India.positions,
                maxPositions: capital.India.maxPositions,
                utilizationPercent: ((capital.India.positions / capital.India.maxPositions) * 100).toFixed(0)
            },
            uk: {
                currency: '£',
                available: capital.UK.available.toLocaleString('en-GB'),
                positions: capital.UK.positions,
                maxPositions: capital.UK.maxPositions,
                utilizationPercent: ((capital.UK.positions / capital.UK.maxPositions) * 100).toFixed(0)
            },
            us: {
                currency: '$',
                available: capital.US.available.toLocaleString('en-US'),
                positions: capital.US.positions,
                maxPositions: capital.US.maxPositions,
                utilizationPercent: ((capital.US.positions / capital.US.maxPositions) * 100).toFixed(0)
            },
            totals: status.totals
        };
    }

    /**
     * Get market from symbol
     */
    getMarketFromSymbol(symbol) {
        if (symbol.endsWith('.NS') || symbol.endsWith('.BO')) return 'India';
        if (symbol.endsWith('.L')) return 'UK';
        return 'US';
    }
}

module.exports = new CapitalManager();
