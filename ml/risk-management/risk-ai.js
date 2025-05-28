/**
 * Risk Management AI Module
 * Uses Reinforcement Learning for dynamic stop-loss and take-profit optimization
 * Includes Monte Carlo simulations for portfolio risk assessment
 */

const tf = require('@tensorflow/tfjs-node');
const ss = require('simple-statistics');

class RiskManagementAI {
    constructor() {
        this.model = null;
        this.episodeMemory = [];
        this.learningRate = 0.001;
        this.gamma = 0.95; // Discount factor
        this.epsilon = 0.1; // Exploration rate
    }

    /**
     * Initialize the RL model for stop-loss/take-profit optimization
     */
    async initializeModel() {
        // State: [price_change%, volume_ratio, volatility, rsi, holding_days]
        // Action: [stop_loss%, take_profit%]
        
        this.model = tf.sequential({
            layers: [
                tf.layers.dense({ inputShape: [5], units: 64, activation: 'relu' }),
                tf.layers.dropout({ rate: 0.2 }),
                tf.layers.dense({ units: 32, activation: 'relu' }),
                tf.layers.dense({ units: 2, activation: 'sigmoid' }) // Output: SL and TP percentages
            ]
        });

        this.model.compile({
            optimizer: tf.train.adam(this.learningRate),
            loss: 'meanSquaredError'
        });

        console.log('Risk Management AI model initialized');
    }

    /**
     * Get optimal stop-loss and take-profit based on current market conditions
     * @param {Object} marketState - Current market conditions
     * @returns {Object} - Optimal SL and TP percentages with multi-timeframe analysis
     */
    async getOptimalRiskParams(marketState) {
        const { priceChange, volumeRatio, volatility, rsi, holdingDays } = marketState;
        
        // Normalize inputs
        const input = tf.tensor2d([[
            priceChange / 100,
            Math.min(volumeRatio, 5) / 5,
            volatility / 100,
            rsi / 100,
            Math.min(holdingDays, 30) / 30
        ]]);

        // Get prediction
        const prediction = await this.model.predict(input).data();
        
        // Scale outputs to reasonable ranges
        const stopLoss = 2 + (prediction[0] * 8); // 2-10%
        const takeProfit = 5 + (prediction[1] * 15); // 5-20%

        input.dispose();
        
        // Calculate multi-timeframe analysis
        const timeframes = this.calculateTimeframeRisks(marketState);
        
        // Calculate win rate for Kelly Criterion
        const winRate = this.calculateWinRate(marketState);

        return {
            stopLoss: parseFloat(stopLoss.toFixed(2)),
            takeProfit: parseFloat(takeProfit.toFixed(2)),
            confidence: this.calculateConfidence(marketState),
            timeframes,
            winRate,
            valueAtRisk95: this.calculateVaR(marketState, 0.95),
            expectedShortfall: this.calculateExpectedShortfall(marketState)
        };
    }
    
    /**
     * Calculate risk parameters for different timeframes
     */
    calculateTimeframeRisks(marketState) {
        const { volatility } = marketState;
        
        // Intraday (high frequency)
        const intradayVol = volatility * 0.5; // Lower volatility for shorter timeframe
        const intraday = {
            stopLoss: Math.max(1, 2 * (intradayVol / 20)),
            takeProfit: Math.max(3, 5 * (intradayVol / 20)),
            confidence: 85 - (intradayVol / 2),
            volatility: intradayVol > 25 ? 'HIGH' : intradayVol > 15 ? 'MEDIUM' : 'LOW',
            recommendation: intradayVol > 25 ? 'Quick exits recommended' : 'Normal intraday parameters'
        };
        
        // Swing (2-7 days)
        const swingVol = volatility * 0.8;
        const swing = {
            stopLoss: Math.max(3, 5 * (swingVol / 20)),
            takeProfit: Math.max(8, 12 * (swingVol / 20)),
            confidence: 78 - (swingVol / 3),
            volatility: swingVol > 20 ? 'HIGH' : swingVol > 12 ? 'MEDIUM' : 'LOW',
            recommendation: 'Standard risk parameters'
        };
        
        // Position (7-30 days)
        const positionVol = volatility;
        const position = {
            stopLoss: Math.max(5, 8 * (positionVol / 20)),
            takeProfit: Math.max(15, 20 * (positionVol / 20)),
            confidence: 72 - (positionVol / 4),
            volatility: positionVol > 18 ? 'HIGH' : positionVol > 10 ? 'MEDIUM' : 'LOW',
            recommendation: 'Wider stops for trends'
        };
        
        return {
            intraday: {
                stopLoss: parseFloat(intraday.stopLoss.toFixed(1)),
                takeProfit: parseFloat(intraday.takeProfit.toFixed(1)),
                confidence: parseFloat(intraday.confidence.toFixed(0)),
                volatility: intraday.volatility,
                recommendation: intraday.recommendation
            },
            swing: {
                stopLoss: parseFloat(swing.stopLoss.toFixed(1)),
                takeProfit: parseFloat(swing.takeProfit.toFixed(1)),
                confidence: parseFloat(swing.confidence.toFixed(0)),
                volatility: swing.volatility,
                recommendation: swing.recommendation
            },
            position: {
                stopLoss: parseFloat(position.stopLoss.toFixed(1)),
                takeProfit: parseFloat(position.takeProfit.toFixed(1)),
                confidence: parseFloat(position.confidence.toFixed(0)),
                volatility: position.volatility,
                recommendation: position.recommendation
            }
        };
    }
    
    /**
     * Calculate historical win rate
     */
    calculateWinRate(marketState) {
        // Simplified win rate calculation based on RSI and trend
        const { rsi, priceChange } = marketState;
        
        let baseWinRate = 0.5;
        
        // RSI factors
        if (rsi < 30) baseWinRate += 0.1; // Oversold
        else if (rsi > 70) baseWinRate -= 0.1; // Overbought
        
        // Trend factors
        if (priceChange > 0) baseWinRate += 0.05;
        else baseWinRate -= 0.05;
        
        return Math.max(0.3, Math.min(0.7, baseWinRate));
    }
    
    /**
     * Calculate Value at Risk
     */
    calculateVaR(marketState, confidence) {
        const { volatility } = marketState;
        const zScore = confidence === 0.95 ? 1.645 : 2.326; // 95% or 99% confidence
        const dailyVol = volatility / Math.sqrt(252);
        const var95 = 1000 * dailyVol * zScore * Math.sqrt(5); // 5-day VaR on $1000
        return Math.round(var95);
    }
    
    /**
     * Calculate Expected Shortfall (CVaR)
     */
    calculateExpectedShortfall(marketState) {
        const var95 = this.calculateVaR(marketState, 0.95);
        // ES is typically 1.2-1.4x VaR for normal distributions
        return Math.round(var95 * 1.3);
    }

    /**
     * Calculate confidence score based on market conditions
     */
    calculateConfidence(marketState) {
        const { volatility, volumeRatio, rsi } = marketState;
        
        // Lower confidence in high volatility
        const volatilityScore = 1 - Math.min(volatility / 50, 1);
        
        // Higher confidence with normal volume
        const volumeScore = volumeRatio > 0.8 && volumeRatio < 1.5 ? 1 : 0.5;
        
        // Higher confidence when RSI is not extreme
        const rsiScore = rsi > 30 && rsi < 70 ? 1 : 0.5;
        
        return parseFloat(((volatilityScore + volumeScore + rsiScore) / 3 * 100).toFixed(1));
    }

    /**
     * Train the model with trading results
     */
    async train(tradingHistory) {
        if (tradingHistory.length < 10) return;

        const states = [];
        const rewards = [];

        tradingHistory.forEach(trade => {
            states.push([
                trade.priceChange / 100,
                Math.min(trade.volumeRatio, 5) / 5,
                trade.volatility / 100,
                trade.rsi / 100,
                Math.min(trade.holdingDays, 30) / 30
            ]);

            // Calculate reward based on trade outcome
            const reward = this.calculateReward(trade);
            rewards.push([
                trade.actualStopLoss / 10,
                trade.actualTakeProfit / 20
            ]);
        });

        const xs = tf.tensor2d(states);
        const ys = tf.tensor2d(rewards);

        await this.model.fit(xs, ys, {
            epochs: 10,
            batchSize: 32,
            verbose: 0
        });

        xs.dispose();
        ys.dispose();
    }

    /**
     * Calculate reward for reinforcement learning
     */
    calculateReward(trade) {
        const { profit, maxDrawdown, holdingDays } = trade;
        
        // Reward profitable trades
        let reward = profit;
        
        // Penalty for large drawdowns
        reward -= maxDrawdown * 0.5;
        
        // Small penalty for long holding periods
        reward -= holdingDays * 0.01;
        
        return reward;
    }

    /**
     * Monte Carlo simulation for portfolio risk assessment
     * @param {Array} portfolio - Current portfolio positions
     * @param {Number} days - Simulation period in days
     * @param {Number} iterations - Number of simulations
     */
    async monteCarloRiskSimulation(portfolio, days = 30, iterations = 1000) {
        const results = [];
        
        for (let i = 0; i < iterations; i++) {
            let portfolioValue = portfolio.reduce((sum, pos) => sum + pos.value, 0);
            const dailyReturns = [];
            
            for (let day = 0; day < days; day++) {
                let dailyChange = 0;
                
                portfolio.forEach(position => {
                    // Simulate price movement based on historical volatility
                    const randomReturn = this.generateRandomReturn(position.volatility);
                    const positionChange = position.value * randomReturn;
                    dailyChange += positionChange;
                });
                
                portfolioValue += dailyChange;
                dailyReturns.push(dailyChange / portfolioValue);
            }
            
            results.push({
                finalValue: portfolioValue,
                returns: dailyReturns,
                maxDrawdown: this.calculateMaxDrawdown(dailyReturns)
            });
        }

        return this.analyzeSimulationResults(results, portfolio);
    }

    /**
     * Generate random return based on volatility
     */
    generateRandomReturn(volatility) {
        // Use normal distribution with given volatility
        const mean = 0;
        const stdDev = volatility / 100 / Math.sqrt(252); // Daily volatility
        return this.normalRandom(mean, stdDev);
    }

    /**
     * Generate normal distribution random number
     */
    normalRandom(mean, stdDev) {
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        return z0 * stdDev + mean;
    }

    /**
     * Calculate maximum drawdown from returns
     */
    calculateMaxDrawdown(returns) {
        let peak = 1;
        let maxDrawdown = 0;
        let value = 1;
        
        returns.forEach(ret => {
            value *= (1 + ret);
            if (value > peak) peak = value;
            const drawdown = (peak - value) / peak;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        });
        
        return maxDrawdown * 100;
    }

    /**
     * Analyze Monte Carlo simulation results
     */
    analyzeSimulationResults(results, portfolio) {
        const initialValue = portfolio.reduce((sum, pos) => sum + pos.value, 0);
        const finalValues = results.map(r => r.finalValue);
        const drawdowns = results.map(r => r.maxDrawdown);
        
        return {
            initialValue,
            expectedValue: ss.mean(finalValues),
            valueAtRisk95: ss.quantile(finalValues, 0.05),
            valueAtRisk99: ss.quantile(finalValues, 0.01),
            expectedMaxDrawdown: ss.mean(drawdowns),
            worstCaseDrawdown: ss.max(drawdowns),
            probabilityOfLoss: results.filter(r => r.finalValue < initialValue).length / results.length * 100,
            sharpeRatio: this.calculateSharpeRatio(results)
        };
    }

    /**
     * Calculate Sharpe ratio from simulation results
     */
    calculateSharpeRatio(results) {
        const returns = results.map(r => {
            const totalReturn = r.returns.reduce((sum, ret) => sum + ret, 0);
            return totalReturn;
        });
        
        const meanReturn = ss.mean(returns);
        const stdReturn = ss.standardDeviation(returns);
        const riskFreeRate = 0.02 / 252; // Daily risk-free rate
        
        return stdReturn > 0 ? (meanReturn - riskFreeRate) / stdReturn * Math.sqrt(252) : 0;
    }

    /**
     * Detect anomalies in market conditions
     * @param {Object} currentState - Current market state
     * @param {Array} historicalStates - Historical market states
     */
    detectAnomalies(currentState, historicalStates) {
        if (historicalStates.length < 20) return { isAnomaly: false };

        const features = ['volume', 'volatility', 'priceChange', 'spread'];
        const anomalies = {};
        
        features.forEach(feature => {
            const historical = historicalStates.map(s => s[feature]);
            const mean = ss.mean(historical);
            const std = ss.standardDeviation(historical);
            const zScore = Math.abs((currentState[feature] - mean) / std);
            
            anomalies[feature] = {
                zScore,
                isAnomaly: zScore > 3,
                severity: zScore > 4 ? 'high' : zScore > 3 ? 'medium' : 'low'
            };
        });

        const isAnomaly = Object.values(anomalies).some(a => a.isAnomaly);
        
        return {
            isAnomaly,
            anomalies,
            recommendation: this.getAnomalyRecommendation(anomalies)
        };
    }

    /**
     * Get recommendation based on detected anomalies
     */
    getAnomalyRecommendation(anomalies) {
        const recommendations = [];
        
        if (anomalies.volume?.isAnomaly) {
            recommendations.push('Unusual volume detected - consider reducing position size');
        }
        if (anomalies.volatility?.isAnomaly) {
            recommendations.push('High volatility - widen stop-loss or reduce leverage');
        }
        if (anomalies.spread?.isAnomaly) {
            recommendations.push('Wide spread - use limit orders instead of market orders');
        }
        
        return recommendations.length > 0 ? recommendations : ['Normal market conditions'];
    }

    /**
     * Save model to disk
     */
    async saveModel(path = './ml/models/risk-management') {
        if (this.model) {
            await this.model.save(`file://${path}`);
            console.log('Risk Management model saved');
        }
    }

    /**
     * Load model from disk
     */
    async loadModel(path = './ml/models/risk-management') {
        try {
            this.model = await tf.loadLayersModel(`file://${path}/model.json`);
            console.log('Risk Management model loaded');
        } catch (error) {
            console.log('No saved model found, initializing new model');
            await this.initializeModel();
        }
    }
}

module.exports = RiskManagementAI;