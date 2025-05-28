/**
 * ML Integration Module
 * Combines all ML features and provides unified API
 */

const RiskManagementAI = require('./risk-management/risk-ai-lite');
const PatternRecognitionAI = require('./pattern-recognition/pattern-ai-lite');
const SentimentAnalysisAI = require('./sentiment-analysis/sentiment-ai');

class MLIntegration {
    constructor() {
        this.riskAI = new RiskManagementAI();
        this.patternAI = new PatternRecognitionAI();
        this.sentimentAI = new SentimentAnalysisAI();
        this.initialized = false;
    }

    /**
     * Initialize all ML models
     */
    async initialize() {
        try {
            console.log('Initializing ML models...');
            
            // Initialize models
            await Promise.all([
                this.riskAI.initializeModel(),
                // Pattern AI doesn't need async initialization
                // Sentiment AI initializes in constructor
            ]);

            // Load saved models if available
            await Promise.all([
                this.riskAI.loadModel(),
                this.patternAI.loadModel()
            ]);

            this.initialized = true;
            console.log('ML models initialized successfully');
        } catch (error) {
            console.error('Failed to initialize ML models:', error);
            throw error;
        }
    }

    /**
     * Get comprehensive ML analysis for a stock
     * @param {string} symbol - Stock symbol
     * @param {Array} priceData - Historical price data
     * @param {Object} currentState - Current market state
     */
    async getMLAnalysis(symbol, priceData, currentState) {
        if (!this.initialized) {
            await this.initialize();
        }

        const analysis = {
            symbol,
            timestamp: new Date().toISOString(),
            recommendations: []
        };

        try {
            // 1. Risk Management Analysis
            const riskAnalysis = await this.analyzeRisk(currentState);
            analysis.risk = riskAnalysis;
            
            if (riskAnalysis.recommendation) {
                analysis.recommendations.push({
                    source: 'risk_ai',
                    action: riskAnalysis.recommendation,
                    confidence: riskAnalysis.confidence
                });
            }

            // 2. Pattern Recognition
            const patterns = await this.analyzePatterns(priceData);
            analysis.patterns = patterns;
            
            if (patterns.signals.length > 0) {
                patterns.signals.forEach(signal => {
                    analysis.recommendations.push({
                        source: 'pattern_ai',
                        action: signal.recommendation,
                        confidence: signal.confidence
                    });
                });
            }

            // 3. Sentiment Analysis
            const sentiment = await this.analyzeSentiment(symbol);
            analysis.sentiment = sentiment;
            
            if (sentiment.signal) {
                analysis.recommendations.push({
                    source: 'sentiment_ai',
                    action: sentiment.signal.reason,
                    confidence: sentiment.signal.confidence
                });
            }

            // 4. Combined Signal
            analysis.combinedSignal = this.generateCombinedSignal(analysis);

        } catch (error) {
            console.error('ML analysis error:', error);
            analysis.error = error.message;
        }

        return analysis;
    }

    /**
     * Analyze risk using Risk Management AI
     */
    async analyzeRisk(currentState) {
        // Get optimal risk parameters
        const optimalParams = await this.riskAI.getOptimalRiskParams(currentState);
        
        // Detect anomalies
        const historicalStates = []; // In production, fetch from database
        const anomalies = this.riskAI.detectAnomalies(currentState, historicalStates);
        
        return {
            stopLoss: optimalParams.stopLoss,
            takeProfit: optimalParams.takeProfit,
            confidence: optimalParams.confidence,
            anomalies: anomalies,
            recommendation: anomalies.isAnomaly ? 
                'Reduce position size due to anomalies' : 
                `Use SL: ${optimalParams.stopLoss}%, TP: ${optimalParams.takeProfit}%`
        };
    }

    /**
     * Analyze patterns using Pattern Recognition AI
     */
    async analyzePatterns(priceData) {
        // Detect chart patterns
        const chartPatterns = await this.patternAI.detectChartPatterns(priceData);
        
        // Detect candlestick patterns
        const recentData = priceData.slice(-10);
        const candlestickPatterns = this.patternAI.detectCandlestickPatterns(recentData);
        
        // Predict support/resistance
        const levels = this.patternAI.predictSupportResistance(priceData);
        
        // Generate signals
        const signals = [];
        
        // Add high-confidence chart patterns
        chartPatterns.filter(p => p.confidence > 0.8).forEach(pattern => {
            signals.push({
                type: 'chart_pattern',
                pattern: pattern.type,
                confidence: pattern.confidence,
                recommendation: pattern.recommendation
            });
        });
        
        // Add candlestick patterns
        candlestickPatterns.forEach(pattern => {
            signals.push({
                type: 'candlestick',
                pattern: pattern.pattern,
                confidence: pattern.confidence,
                recommendation: pattern.recommendation
            });
        });
        
        return {
            chartPatterns,
            candlestickPatterns,
            supportResistance: levels,
            signals
        };
    }

    /**
     * Analyze sentiment using Sentiment Analysis AI
     */
    async analyzeSentiment(symbol) {
        return await this.sentimentAI.analyzeStockSentiment(symbol);
    }

    /**
     * Generate combined signal from all ML models
     */
    generateCombinedSignal(analysis) {
        const { risk, patterns, sentiment } = analysis;
        
        // Weight each signal source
        const weights = {
            risk_ai: 0.3,
            pattern_ai: 0.4,
            sentiment_ai: 0.3
        };
        
        // Score each signal (-1 to 1)
        let totalScore = 0;
        let totalWeight = 0;
        
        // Risk signal
        if (risk && !risk.anomalies?.isAnomaly) {
            totalScore += 0.5 * weights.risk_ai; // Neutral to positive
            totalWeight += weights.risk_ai;
        }
        
        // Pattern signals
        if (patterns?.signals) {
            patterns.signals.forEach(signal => {
                let score = 0;
                if (signal.recommendation.toLowerCase().includes('buy')) score = 1;
                else if (signal.recommendation.toLowerCase().includes('sell')) score = -1;
                
                totalScore += score * weights.pattern_ai * (signal.confidence / 100);
                totalWeight += weights.pattern_ai;
            });
        }
        
        // Sentiment signal
        if (sentiment?.signal) {
            let score = 0;
            if (sentiment.signal.action === 'buy') score = 1;
            else if (sentiment.signal.action === 'sell') score = -1;
            
            totalScore += score * weights.sentiment_ai * (sentiment.signal.confidence / 100);
            totalWeight += weights.sentiment_ai;
        }
        
        // Calculate final score
        const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;
        
        // Generate signal
        let signal = 'HOLD';
        let confidence = Math.abs(finalScore) * 100;
        
        if (finalScore > 0.3) signal = 'BUY';
        else if (finalScore < -0.3) signal = 'SELL';
        
        return {
            signal,
            score: finalScore,
            confidence: Math.min(confidence, 95),
            components: {
                risk: risk?.confidence || 0,
                patterns: patterns?.signals?.length || 0,
                sentiment: sentiment?.overall?.magnitude || 0
            }
        };
    }

    /**
     * Get real-time ML alerts for active positions
     */
    async getMLAlerts(positions) {
        const alerts = [];
        
        for (const position of positions) {
            // Check sentiment alerts
            const sentimentAlerts = await this.sentimentAI.getSentimentAlerts([position.symbol]);
            
            sentimentAlerts.forEach(alert => {
                alerts.push({
                    type: 'sentiment',
                    ...alert,
                    position: position
                });
            });
            
            // Check risk alerts
            if (position.unrealizedPL) {
                const riskAlert = this.checkRiskAlert(position);
                if (riskAlert) {
                    alerts.push({
                        type: 'risk',
                        ...riskAlert,
                        position: position
                    });
                }
            }
        }
        
        return alerts;
    }

    /**
     * Check for risk-based alerts
     */
    checkRiskAlert(position) {
        const plPercent = (position.unrealizedPL / position.entryPrice) * 100;
        
        // Alert if approaching stop loss
        if (plPercent < -position.stopLoss * 0.8) {
            return {
                severity: 'high',
                message: 'Approaching stop loss level',
                action: 'Consider exiting position',
                currentPL: plPercent
            };
        }
        
        // Alert if approaching take profit
        if (plPercent > position.takeProfit * 0.9) {
            return {
                severity: 'medium',
                message: 'Approaching take profit level',
                action: 'Consider taking profits',
                currentPL: plPercent
            };
        }
        
        return null;
    }

    /**
     * Train ML models with historical data
     */
    async trainModels(trainingData) {
        console.log('Training ML models...');
        
        // Train risk management model
        if (trainingData.trades && trainingData.trades.length > 0) {
            await this.riskAI.train(trainingData.trades);
        }
        
        // Pattern recognition uses pre-trained CNN
        // Sentiment analysis uses rule-based approach
        
        console.log('ML models training completed');
    }

    /**
     * Save all models
     */
    async saveModels() {
        await Promise.all([
            this.riskAI.saveModel(),
            this.patternAI.saveModel()
        ]);
    }
}

// Export singleton instance
module.exports = new MLIntegration();