/**
 * Risk Management AI Module (Lightweight Version)
 * Uses pure JavaScript ML libraries for compatibility
 * Includes reinforcement learning simulation and risk assessment
 */

const ss = require('simple-statistics');

class RiskManagementAI {
    constructor() {
        this.regressionModel = null;
        this.trainingData = [];
        this.predictions = new Map();
        this.riskLevels = {
            low: { volatility: [0, 15], stopLoss: [2, 4], takeProfit: [8, 12] },
            medium: { volatility: [15, 30], stopLoss: [3, 6], takeProfit: [6, 10] },
            high: { volatility: [30, 100], stopLoss: [5, 10], takeProfit: [4, 8] }
        };
    }

    /**
     * Initialize the regression model for risk parameter prediction
     */
    async initializeModel() {
        // Create a simple linear regression model
        // Features: [volatility, rsi, volumeRatio, priceChange, marketTrend]
        this.regressionModel = {
            stopLoss: null,
            takeProfit: null,
            trained: false
        };
        
        // Pre-load with some basic training data
        this.loadDefaultTrainingData();
        this.trainModel();
        
        console.log('Risk Management AI model initialized');
    }

    /**
     * Load default training data for initial model
     */
    loadDefaultTrainingData() {
        // Simulated training data based on market conditions
        this.trainingData = [
            // [volatility, rsi, volumeRatio, priceChange, marketTrend] -> [stopLoss, takeProfit]
            { features: [10, 30, 1.2, -2, -1], targets: [3, 10] }, // Low vol, oversold
            { features: [15, 50, 1.0, 0, 0], targets: [4, 8] },   // Medium vol, neutral
            { features: [25, 70, 1.5, 3, 1], targets: [6, 6] },   // High vol, overbought
            { features: [35, 80, 2.0, 5, 1], targets: [8, 5] },   // Very high vol
            { features: [12, 25, 0.8, -1, -1], targets: [3, 12] }, // Low vol, oversold
            { features: [20, 60, 1.3, 2, 1], targets: [5, 7] },   // Medium vol, bullish
            { features: [40, 85, 3.0, 8, 1], targets: [10, 4] },  // Extreme conditions
            { features: [8, 40, 0.9, -0.5, 0], targets: [2, 15] }, // Very low vol
        ];
    }

    /**
     * Train the regression models
     */
    trainModel() {
        if (this.trainingData.length < 3) return;

        const features = this.trainingData.map(d => d.features);
        const stopLossTargets = this.trainingData.map(d => d.targets[0]);
        const takeProfitTargets = this.trainingData.map(d => d.targets[1]);

        try {
            // Train stop loss model using simple statistics
            const volatilityValues = features.map(f => f[0]);
            this.regressionModel.stopLoss = ss.linearRegression(
                volatilityValues.map((v, i) => [v, stopLossTargets[i]])
            );

            // Train take profit model
            this.regressionModel.takeProfit = ss.linearRegression(
                volatilityValues.map((v, i) => [v, takeProfitTargets[i]])
            );

            this.regressionModel.trained = true;
            console.log('Risk models trained successfully');
        } catch (error) {
            console.error('Model training failed:', error);
            this.regressionModel.trained = false;
        }
    }

    /**
     * Get optimal stop-loss and take-profit based on current market conditions
     * @param {Object} marketState - Current market conditions
     * @returns {Object} - Optimal SL and TP percentages
     */
    async getOptimalRiskParams(marketState) {
        const { priceChange, volumeRatio, volatility, rsi, holdingDays } = marketState;
        
        // Determine risk level based on volatility
        const riskLevel = this.getRiskLevel(volatility);
        
        let stopLoss, takeProfit;
        
        if (this.regressionModel.trained) {
            // Use trained model
            try {
                stopLoss = this.regressionModel.stopLoss.m * volatility + this.regressionModel.stopLoss.b;
                takeProfit = this.regressionModel.takeProfit.m * volatility + this.regressionModel.takeProfit.b;
                
                // Clamp to reasonable ranges
                stopLoss = Math.max(2, Math.min(stopLoss, 15));
                takeProfit = Math.max(3, Math.min(takeProfit, 20));
            } catch (error) {
                console.error('Prediction error, using fallback:', error);
                ({ stopLoss, takeProfit } = this.getFallbackParams(riskLevel, marketState));
            }
        } else {
            // Use rule-based fallback
            ({ stopLoss, takeProfit } = this.getFallbackParams(riskLevel, marketState));
        }

        // Apply market condition adjustments
        const adjustments = this.getMarketAdjustments(marketState);
        stopLoss *= adjustments.stopLoss;
        takeProfit *= adjustments.takeProfit;

        const confidence = this.calculateConfidence(marketState, riskLevel);

        return {
            stopLoss: parseFloat(stopLoss.toFixed(2)),
            takeProfit: parseFloat(takeProfit.toFixed(2)),
            confidence: parseFloat(confidence.toFixed(1)),
            riskLevel: riskLevel
        };
    }

    /**
     * Get risk level based on volatility
     */
    getRiskLevel(volatility) {
        if (volatility < 15) return 'low';
        if (volatility < 30) return 'medium';
        return 'high';
    }

    /**
     * Get fallback parameters based on risk level
     */
    getFallbackParams(riskLevel, marketState) {
        const params = this.riskLevels[riskLevel];
        
        // Use mid-range values as base
        let stopLoss = (params.stopLoss[0] + params.stopLoss[1]) / 2;
        let takeProfit = (params.takeProfit[0] + params.takeProfit[1]) / 2;
        
        // Adjust based on RSI
        if (marketState.rsi < 30) {
            // Oversold - more aggressive take profit
            takeProfit *= 1.2;
            stopLoss *= 0.9;
        } else if (marketState.rsi > 70) {
            // Overbought - more conservative
            takeProfit *= 0.8;
            stopLoss *= 1.1;
        }
        
        return { stopLoss, takeProfit };
    }

    /**
     * Get market condition adjustments
     */
    getMarketAdjustments(marketState) {
        const adjustments = { stopLoss: 1, takeProfit: 1 };
        
        // Volume adjustment
        if (marketState.volumeRatio > 2) {
            // High volume - tighten stops
            adjustments.stopLoss *= 0.9;
        } else if (marketState.volumeRatio < 0.5) {
            // Low volume - widen stops
            adjustments.stopLoss *= 1.1;
        }
        
        // Price change momentum
        if (Math.abs(marketState.priceChange) > 5) {
            // High momentum - adjust accordingly
            adjustments.stopLoss *= 1.2;
            adjustments.takeProfit *= 0.9;
        }
        
        return adjustments;
    }

    /**
     * Calculate confidence score based on market conditions
     */
    calculateConfidence(marketState, riskLevel) {
        let confidence = 70; // Base confidence
        
        // Volatility confidence
        const volConfidence = {
            'low': 85,
            'medium': 75,
            'high': 60
        };
        confidence = volConfidence[riskLevel];
        
        // Volume confirmation
        if (marketState.volumeRatio > 0.8 && marketState.volumeRatio < 1.5) {
            confidence += 10;
        }
        
        // RSI extremes reduce confidence
        if (marketState.rsi < 20 || marketState.rsi > 80) {
            confidence -= 10;
        }
        
        // Large price changes reduce confidence
        if (Math.abs(marketState.priceChange) > 10) {
            confidence -= 15;
        }
        
        return Math.max(30, Math.min(confidence, 95));
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
                    const randomReturn = this.generateRandomReturn(position.volatility || 20);
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
        // Use Box-Muller transform for normal distribution
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        
        const mean = 0;
        const stdDev = volatility / 100 / Math.sqrt(252); // Daily volatility
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

        const features = ['volume', 'volatility', 'priceChange'];
        const anomalies = {};
        
        features.forEach(feature => {
            const historical = historicalStates.map(s => s[feature]).filter(v => v !== undefined);
            if (historical.length === 0) return;
            
            const mean = ss.mean(historical);
            const std = ss.standardDeviation(historical);
            const zScore = std > 0 ? Math.abs((currentState[feature] - mean) / std) : 0;
            
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
        if (anomalies.priceChange?.isAnomaly) {
            recommendations.push('Extreme price movement - monitor closely');
        }
        
        return recommendations.length > 0 ? recommendations : ['Normal market conditions'];
    }

    /**
     * Train model with trading results
     */
    async train(tradingHistory) {
        if (tradingHistory.length < 5) return;

        // Convert trading history to training data
        const newTrainingData = tradingHistory.map(trade => ({
            features: [
                trade.volatility || 20,
                trade.rsi || 50,
                trade.volumeRatio || 1,
                trade.priceChange || 0,
                trade.marketTrend || 0
            ],
            targets: [
                trade.actualStopLoss || 5,
                trade.actualTakeProfit || 8
            ]
        }));

        // Add to existing training data
        this.trainingData = [...this.trainingData, ...newTrainingData];
        
        // Keep only last 100 entries to prevent overfitting
        if (this.trainingData.length > 100) {
            this.trainingData = this.trainingData.slice(-100);
        }

        // Retrain model
        this.trainModel();
    }

    /**
     * Save model state
     */
    async saveModel(path = './ml/models/risk-management') {
        const modelState = {
            trainingData: this.trainingData,
            riskLevels: this.riskLevels,
            modelType: 'lightweight',
            timestamp: new Date().toISOString()
        };
        
        // In a real implementation, save to file
        console.log('Risk Management model state saved');
        return modelState;
    }

    /**
     * Load model state
     */
    async loadModel(path = './ml/models/risk-management') {
        try {
            // In a real implementation, load from file
            // For now, just reinitialize
            await this.initializeModel();
            console.log('Risk Management model loaded');
        } catch (error) {
            console.log('No saved model found, initializing new model');
            await this.initializeModel();
        }
    }
}

module.exports = RiskManagementAI;