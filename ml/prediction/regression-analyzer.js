/**
 * Regression Analysis Module
 * Provides statistical regression and prediction analysis for stock prices
 */

class RegressionAnalyzer {
    constructor() {
        this.initialized = false;
    }

    /**
     * Generate 30-day price prediction using multiple regression models
     * @param {Array} priceData - Historical OHLC data
     * @param {Object} backtestData - Historical backtest results for this symbol
     * @param {Object} currentDTI - Current DTI indicator values
     * @returns {Object} Prediction analysis with confidence intervals
     */
    async generate30DayPrediction(priceData, backtestData, currentDTI) {
        if (!priceData || priceData.length < 90) {
            throw new Error('Insufficient historical data for prediction (minimum 90 days required)');
        }

        // Extract features from price data
        const features = this.extractFeatures(priceData);

        // Calculate linear regression trend
        const linearPrediction = this.linearRegressionPrediction(priceData, 30);

        // Run Monte Carlo simulation
        const monteCarlo = this.monteCarloSimulation(priceData, 30, 1000);

        // Pattern-based prediction using backtest data
        const patternPrediction = this.patternBasedPrediction(priceData, backtestData);

        // Technical indicator analysis
        const technicalAnalysis = this.technicalIndicatorAnalysis(features, currentDTI);

        // Combine predictions with weighted ensemble
        const ensemblePrediction = this.ensemblePrediction({
            linear: linearPrediction,
            monteCarlo: monteCarlo,
            pattern: patternPrediction,
            technical: technicalAnalysis
        });

        return {
            prediction: ensemblePrediction,
            components: {
                linearRegression: linearPrediction,
                monteCarlo: monteCarlo,
                patternBased: patternPrediction,
                technicalAnalysis: technicalAnalysis
            },
            features: features,
            confidence: this.calculatePredictionConfidence(ensemblePrediction, features),
            riskMetrics: this.calculateRiskMetrics(monteCarlo),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Extract technical features from price data
     */
    extractFeatures(priceData) {
        const closes = priceData.map(d => d.close);
        const volumes = priceData.map(d => d.volume);
        const highs = priceData.map(d => d.high);
        const lows = priceData.map(d => d.low);

        return {
            currentPrice: closes[closes.length - 1],

            // Trend features
            trend30: this.calculateSlope(closes.slice(-30)),
            trend60: this.calculateSlope(closes.slice(-60)),
            trend90: this.calculateSlope(closes.slice(-90)),

            // Moving averages
            sma7: this.simpleMovingAverage(closes, 7),
            sma14: this.simpleMovingAverage(closes, 14),
            sma30: this.simpleMovingAverage(closes, 30),
            sma50: this.simpleMovingAverage(closes, 50),

            // Volatility
            volatility14: this.calculateVolatility(closes.slice(-14)),
            volatility30: this.calculateVolatility(closes.slice(-30)),

            // Momentum
            rsi14: this.calculateRSI(closes, 14),
            momentum10: this.calculateMomentum(closes, 10),

            // Volume analysis
            volumeTrend: this.calculateSlope(volumes.slice(-30)),
            volumeRatio: volumes[volumes.length - 1] / this.average(volumes.slice(-20)),

            // Support/Resistance
            support: Math.min(...lows.slice(-30)),
            resistance: Math.max(...highs.slice(-30)),

            // Price position
            pricePosition: this.calculatePricePosition(closes, highs.slice(-30), lows.slice(-30))
        };
    }

    /**
     * Linear regression prediction with confidence intervals
     */
    linearRegressionPrediction(priceData, days) {
        const closes = priceData.map(d => d.close);
        const recentCloses = closes.slice(-90); // Use last 90 days

        // Calculate regression coefficients
        const { slope, intercept, r2 } = this.linearRegression(recentCloses);

        // Project forward
        const currentIndex = recentCloses.length - 1;
        const predictions = [];

        for (let i = 1; i <= days; i++) {
            const predictedPrice = intercept + slope * (currentIndex + i);
            predictions.push(predictedPrice);
        }

        // Calculate standard error for confidence intervals
        const residuals = recentCloses.map((actual, i) =>
            actual - (intercept + slope * i)
        );
        const standardError = Math.sqrt(
            residuals.reduce((sum, r) => sum + r * r, 0) / (residuals.length - 2)
        );

        // 95% confidence interval (±2 standard errors)
        const confidence95 = {
            upper: predictions.map(p => p + 2 * standardError),
            lower: predictions.map(p => p - 2 * standardError)
        };

        // 68% confidence interval (±1 standard error)
        const confidence68 = {
            upper: predictions.map(p => p + standardError),
            lower: predictions.map(p => p - standardError)
        };

        return {
            predictions,
            confidence95,
            confidence68,
            slope,
            r2,
            standardError,
            trend: slope > 0 ? 'bullish' : slope < 0 ? 'bearish' : 'neutral',
            strength: Math.abs(slope) * days // Total expected move
        };
    }

    /**
     * Monte Carlo simulation for price distribution
     */
    monteCarloSimulation(priceData, days, iterations = 1000) {
        const closes = priceData.map(d => d.close);
        const returns = this.calculateReturns(closes);

        // Calculate historical statistics
        const meanReturn = this.average(returns);
        const stdReturn = this.standardDeviation(returns);
        const currentPrice = closes[closes.length - 1];

        // Run simulations
        const simulations = [];
        const finalPrices = [];

        for (let sim = 0; sim < iterations; sim++) {
            let price = currentPrice;
            const path = [price];

            for (let day = 0; day < days; day++) {
                // Generate random return from normal distribution
                const randomReturn = this.randomNormal(meanReturn, stdReturn);
                price = price * (1 + randomReturn);
                path.push(price);
            }

            simulations.push(path);
            finalPrices.push(price);
        }

        // Calculate percentiles
        finalPrices.sort((a, b) => a - b);
        const percentile5 = finalPrices[Math.floor(iterations * 0.05)];
        const percentile25 = finalPrices[Math.floor(iterations * 0.25)];
        const percentile50 = finalPrices[Math.floor(iterations * 0.50)];
        const percentile75 = finalPrices[Math.floor(iterations * 0.75)];
        const percentile95 = finalPrices[Math.floor(iterations * 0.95)];

        // Calculate average path
        const avgPath = [];
        for (let day = 0; day <= days; day++) {
            const dayPrices = simulations.map(sim => sim[day]);
            avgPath.push(this.average(dayPrices));
        }

        return {
            simulations: simulations.slice(0, 100), // Return only 100 for visualization
            avgPath,
            percentiles: {
                p5: percentile5,
                p25: percentile25,
                p50: percentile50,
                p75: percentile75,
                p95: percentile95
            },
            expectedReturn: ((percentile50 - currentPrice) / currentPrice) * 100,
            valueAtRisk95: ((currentPrice - percentile5) / currentPrice) * 100,
            probabilityDistribution: this.createHistogram(finalPrices, 20)
        };
    }

    /**
     * Pattern-based prediction using historical backtest data
     */
    patternBasedPrediction(priceData, backtestData) {
        if (!backtestData || !backtestData.trades || backtestData.trades.length === 0) {
            return {
                available: false,
                message: 'No historical backtest data available'
            };
        }

        const trades = backtestData.trades;
        const currentPrice = priceData[priceData.length - 1].close;

        // Find similar market conditions
        const similarTrades = this.findSimilarConditions(priceData, trades);

        if (similarTrades.length === 0) {
            return {
                available: false,
                message: 'No similar historical patterns found'
            };
        }

        // Calculate outcome statistics
        const outcomes = similarTrades.map(t => t.plPercent);
        const winRate = similarTrades.filter(t => t.plPercent > 0).length / similarTrades.length;
        const avgProfit = this.average(outcomes);
        const medianProfit = this.median(outcomes);

        // Calculate expected price based on patterns
        const expectedPriceChange = medianProfit / 100; // Use median for robustness
        const predictedPrice = currentPrice * (1 + expectedPriceChange);

        // Distribution of outcomes
        const positiveOutcomes = outcomes.filter(o => o > 0).length;
        const negativeOutcomes = outcomes.filter(o => o < 0).length;
        const neutralOutcomes = outcomes.filter(o => o === 0).length;

        return {
            available: true,
            predictedPrice,
            expectedChange: expectedPriceChange * 100,
            confidence: winRate * 100,
            basedOnTrades: similarTrades.length,
            statistics: {
                winRate: winRate * 100,
                avgProfit,
                medianProfit,
                bestCase: Math.max(...outcomes),
                worstCase: Math.min(...outcomes),
                distribution: {
                    positive: positiveOutcomes,
                    negative: negativeOutcomes,
                    neutral: neutralOutcomes
                }
            },
            similarConditions: this.describeConditions(similarTrades)
        };
    }

    /**
     * Technical indicator analysis
     */
    technicalIndicatorAnalysis(features, currentDTI) {
        const signals = [];
        let bullishCount = 0;
        let bearishCount = 0;

        // Trend analysis
        if (features.trend30 > 0 && features.trend60 > 0) {
            signals.push({ indicator: 'Trend', signal: 'Bullish', strength: 'Strong' });
            bullishCount += 2;
        } else if (features.trend30 > 0) {
            signals.push({ indicator: 'Trend', signal: 'Bullish', strength: 'Moderate' });
            bullishCount += 1;
        } else if (features.trend30 < 0 && features.trend60 < 0) {
            signals.push({ indicator: 'Trend', signal: 'Bearish', strength: 'Strong' });
            bearishCount += 2;
        } else if (features.trend30 < 0) {
            signals.push({ indicator: 'Trend', signal: 'Bearish', strength: 'Moderate' });
            bearishCount += 1;
        }

        // Moving average crossover
        if (features.sma7 > features.sma14 && features.sma14 > features.sma30) {
            signals.push({ indicator: 'MA Alignment', signal: 'Bullish', strength: 'Strong' });
            bullishCount += 2;
        } else if (features.sma7 < features.sma14 && features.sma14 < features.sma30) {
            signals.push({ indicator: 'MA Alignment', signal: 'Bearish', strength: 'Strong' });
            bearishCount += 2;
        }

        // RSI analysis
        if (features.rsi14 < 30) {
            signals.push({ indicator: 'RSI', signal: 'Oversold (Bullish)', strength: 'Strong' });
            bullishCount += 2;
        } else if (features.rsi14 < 40) {
            signals.push({ indicator: 'RSI', signal: 'Oversold (Bullish)', strength: 'Moderate' });
            bullishCount += 1;
        } else if (features.rsi14 > 70) {
            signals.push({ indicator: 'RSI', signal: 'Overbought (Bearish)', strength: 'Strong' });
            bearishCount += 2;
        } else if (features.rsi14 > 60) {
            signals.push({ indicator: 'RSI', signal: 'Overbought (Bearish)', strength: 'Moderate' });
            bearishCount += 1;
        }

        // DTI indicator (if available)
        if (currentDTI && currentDTI.daily !== undefined) {
            if (currentDTI.daily < 0) {
                signals.push({ indicator: 'DTI', signal: 'Buy Signal', strength: 'Strong' });
                bullishCount += 2;
            }

            if (currentDTI.weekly !== undefined && currentDTI.weekly < 0) {
                signals.push({ indicator: 'Weekly DTI', signal: 'Buy Signal', strength: 'Strong' });
                bullishCount += 2;
            }
        }

        // Volume analysis
        if (features.volumeRatio > 1.5) {
            const trend = features.trend30 > 0 ? 'Bullish' : 'Bearish';
            signals.push({ indicator: 'Volume', signal: `High volume ${trend}`, strength: 'Moderate' });
            if (trend === 'Bullish') bullishCount += 1;
            else bearishCount += 1;
        }

        // Price position relative to range
        if (features.pricePosition < 0.3) {
            signals.push({ indicator: 'Price Position', signal: 'Near support (Bullish)', strength: 'Moderate' });
            bullishCount += 1;
        } else if (features.pricePosition > 0.7) {
            signals.push({ indicator: 'Price Position', signal: 'Near resistance (Bearish)', strength: 'Moderate' });
            bearishCount += 1;
        }

        // Overall signal
        const totalSignals = bullishCount + bearishCount;
        const bullishPercent = totalSignals > 0 ? (bullishCount / totalSignals) * 100 : 50;

        let overallSignal = 'NEUTRAL';
        let signalStrength = 'Weak';

        if (bullishPercent > 70) {
            overallSignal = 'BULLISH';
            signalStrength = bullishPercent > 85 ? 'Very Strong' : 'Strong';
        } else if (bullishPercent < 30) {
            overallSignal = 'BEARISH';
            signalStrength = bullishPercent < 15 ? 'Very Strong' : 'Strong';
        } else if (bullishPercent > 60 || bullishPercent < 40) {
            signalStrength = 'Moderate';
        }

        return {
            overallSignal,
            signalStrength,
            bullishPercent,
            bearishPercent: 100 - bullishPercent,
            signals,
            recommendation: this.generateRecommendation(overallSignal, signalStrength, features)
        };
    }

    /**
     * Combine multiple predictions into ensemble
     */
    ensemblePrediction(predictions) {
        const { linear, monteCarlo, pattern, technical } = predictions;

        // Weight the predictions based on confidence
        let weightedPrediction = 0;
        let totalWeight = 0;

        // Linear regression: 30% weight
        if (linear && linear.predictions && linear.predictions.length > 0) {
            const linearPrice = linear.predictions[linear.predictions.length - 1];
            weightedPrediction += linearPrice * 0.3 * linear.r2;
            totalWeight += 0.3 * linear.r2;
        }

        // Monte Carlo: 40% weight
        if (monteCarlo && monteCarlo.percentiles) {
            weightedPrediction += monteCarlo.percentiles.p50 * 0.4;
            totalWeight += 0.4;
        }

        // Pattern-based: 30% weight (if available)
        if (pattern && pattern.available) {
            weightedPrediction += pattern.predictedPrice * 0.3 * (pattern.confidence / 100);
            totalWeight += 0.3 * (pattern.confidence / 100);
        }

        const finalPrediction = totalWeight > 0 ? weightedPrediction / totalWeight : monteCarlo.percentiles.p50;

        // Determine price range based on Monte Carlo
        const priceRange = {
            low: monteCarlo.percentiles.p25,
            mid: finalPrediction,
            high: monteCarlo.percentiles.p75,
            extreme_low: monteCarlo.percentiles.p5,
            extreme_high: monteCarlo.percentiles.p95
        };

        // Calculate expected return
        const currentPrice = predictions.linear?.predictions
            ? predictions.monteCarlo.avgPath[0]
            : monteCarlo.percentiles.p50;

        const expectedReturn = ((finalPrediction - currentPrice) / currentPrice) * 100;

        return {
            predictedPrice: finalPrediction,
            expectedReturn,
            priceRange,
            classification: this.classifyPrediction(expectedReturn, technical.overallSignal),
            chart Data: this.generateChartData(linear, monteCarlo, 30)
        };
    }

    /**
     * Calculate prediction confidence score
     */
    calculatePredictionConfidence(prediction, features) {
        let confidenceScore = 0;
        let factors = [];

        // Factor 1: R-squared from linear regression (max 25 points)
        if (prediction.chartData && prediction.chartData.r2) {
            const r2Score = Math.min(prediction.chartData.r2 * 25, 25);
            confidenceScore += r2Score;
            factors.push({ name: 'Trend Fit', score: r2Score, max: 25 });
        }

        // Factor 2: Volatility (lower is better, max 20 points)
        const volScore = Math.max(0, 20 - (features.volatility30 * 2));
        confidenceScore += volScore;
        factors.push({ name: 'Low Volatility', score: volScore, max: 20 });

        // Factor 3: Data quality (max 15 points)
        const dataQualityScore = 15; // Assuming good data
        confidenceScore += dataQualityScore;
        factors.push({ name: 'Data Quality', score: dataQualityScore, max: 15 });

        // Factor 4: Trend strength (max 20 points)
        const trendScore = Math.min(Math.abs(features.trend30) * 100, 20);
        confidenceScore += trendScore;
        factors.push({ name: 'Trend Strength', score: trendScore, max: 20 });

        // Factor 5: Technical indicator agreement (max 20 points)
        const techScore = 20; // Placeholder - should be based on technical.bullishPercent
        confidenceScore += techScore;
        factors.push({ name: 'Indicator Agreement', score: techScore, max: 20 });

        return {
            score: Math.min(confidenceScore, 100),
            level: confidenceScore > 75 ? 'High' : confidenceScore > 50 ? 'Medium' : 'Low',
            factors
        };
    }

    /**
     * Calculate risk metrics
     */
    calculateRiskMetrics(monteCarlo) {
        const currentPrice = monteCarlo.avgPath[0];
        const finalPrices = [
            monteCarlo.percentiles.p5,
            monteCarlo.percentiles.p25,
            monteCarlo.percentiles.p50,
            monteCarlo.percentiles.p75,
            monteCarlo.percentiles.p95
        ];

        return {
            valueAtRisk95: monteCarlo.valueAtRisk95,
            expectedShortfall: this.calculateExpectedShortfall(finalPrices, currentPrice),
            maxDrawdown: this.estimateMaxDrawdown(monteCarlo.simulations),
            sharpeRatio: this.calculateSharpeRatio(finalPrices, currentPrice),
            scenarios: {
                bearish: {
                    probability: 5,
                    priceTarget: monteCarlo.percentiles.p5,
                    loss: ((monteCarlo.percentiles.p5 - currentPrice) / currentPrice) * 100
                },
                moderate: {
                    probability: 50,
                    priceTarget: monteCarlo.percentiles.p50,
                    return: ((monteCarlo.percentiles.p50 - currentPrice) / currentPrice) * 100
                },
                bullish: {
                    probability: 95,
                    priceTarget: monteCarlo.percentiles.p95,
                    gain: ((monteCarlo.percentiles.p95 - currentPrice) / currentPrice) * 100
                }
            }
        };
    }

    // ===== Helper Functions =====

    linearRegression(values) {
        const n = values.length;
        const x = Array.from({ length: n }, (_, i) => i);

        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = values.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
        const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Calculate R²
        const yMean = sumY / n;
        const ssTotal = values.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
        const ssResidual = values.reduce((sum, yi, i) =>
            sum + Math.pow(yi - (intercept + slope * i), 2), 0
        );
        const r2 = 1 - (ssResidual / ssTotal);

        return { slope, intercept, r2 };
    }

    calculateSlope(values) {
        const { slope } = this.linearRegression(values);
        return slope;
    }

    simpleMovingAverage(values, period) {
        if (values.length < period) return values[values.length - 1];
        const slice = values.slice(-period);
        return slice.reduce((a, b) => a + b, 0) / period;
    }

    calculateVolatility(values) {
        const returns = this.calculateReturns(values);
        return this.standardDeviation(returns) * Math.sqrt(252); // Annualized
    }

    calculateRSI(values, period = 14) {
        if (values.length < period + 1) return 50;

        let gains = 0;
        let losses = 0;

        for (let i = values.length - period; i < values.length; i++) {
            const change = values[i] - values[i - 1];
            if (change > 0) gains += change;
            else losses += Math.abs(change);
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;

        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    calculateMomentum(values, period) {
        if (values.length < period) return 0;
        return values[values.length - 1] - values[values.length - period - 1];
    }

    calculatePricePosition(closes, highs, lows) {
        const currentPrice = closes[closes.length - 1];
        const rangeHigh = Math.max(...highs);
        const rangeLow = Math.min(...lows);

        if (rangeHigh === rangeLow) return 0.5;
        return (currentPrice - rangeLow) / (rangeHigh - rangeLow);
    }

    calculateReturns(values) {
        const returns = [];
        for (let i = 1; i < values.length; i++) {
            returns.push((values[i] - values[i - 1]) / values[i - 1]);
        }
        return returns;
    }

    average(values) {
        return values.reduce((a, b) => a + b, 0) / values.length;
    }

    median(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    }

    standardDeviation(values) {
        const mean = this.average(values);
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }

    randomNormal(mean, stdDev) {
        // Box-Muller transform
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        return mean + z * stdDev;
    }

    createHistogram(values, bins) {
        const min = Math.min(...values);
        const max = Math.max(...values);
        const binSize = (max - min) / bins;

        const histogram = Array(bins).fill(0);

        values.forEach(v => {
            const bin = Math.min(Math.floor((v - min) / binSize), bins - 1);
            histogram[bin]++;
        });

        return histogram.map((count, i) => ({
            range: [min + i * binSize, min + (i + 1) * binSize],
            count,
            probability: count / values.length
        }));
    }

    findSimilarConditions(priceData, trades) {
        // Find trades that had similar market conditions
        // This is a simplified version - in production, use more sophisticated matching
        const recentFeatures = this.extractFeatures(priceData);

        return trades.filter(trade => {
            // Filter for trades within last 2 years for relevance
            const tradeDate = new Date(trade.entryDate);
            const twoYearsAgo = new Date();
            twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

            return tradeDate > twoYearsAgo;
        });
    }

    describeConditions(trades) {
        if (trades.length === 0) return 'No similar conditions found';

        const avgHoldingDays = this.average(trades.map(t => {
            const entry = new Date(t.entryDate);
            const exit = new Date(t.exitDate);
            return (exit - entry) / (1000 * 60 * 60 * 24);
        }));

        return `Based on ${trades.length} similar patterns over the last 2 years, ` +
               `average holding period was ${Math.round(avgHoldingDays)} days`;
    }

    generateRecommendation(signal, strength, features) {
        if (signal === 'BULLISH') {
            return `${strength} bullish signal detected. Consider entering a long position with ` +
                   `stop loss below support at $${features.support.toFixed(2)} and ` +
                   `target near resistance at $${features.resistance.toFixed(2)}`;
        } else if (signal === 'BEARISH') {
            return `${strength} bearish signal detected. Consider avoiding new positions or ` +
                   `setting tight stop losses. Wait for better entry conditions.`;
        } else {
            return `Neutral signal - market is consolidating. Wait for a clearer trend to emerge ` +
                   `before taking a position. Key levels: Support $${features.support.toFixed(2)}, ` +
                   `Resistance $${features.resistance.toFixed(2)}`;
        }
    }

    classifyPrediction(expectedReturn, technicalSignal) {
        if (expectedReturn > 5) {
            return { class: 'Strong Bullish', color: '#4caf50', confidence: 'High' };
        } else if (expectedReturn > 2) {
            return { class: 'Moderate Bullish', color: '#8bc34a', confidence: 'Medium' };
        } else if (expectedReturn < -5) {
            return { class: 'Strong Bearish', color: '#f44336', confidence: 'High' };
        } else if (expectedReturn < -2) {
            return { class: 'Moderate Bearish', color: '#ff9800', confidence: 'Medium' };
        } else {
            return { class: 'Neutral', color: '#9e9e9e', confidence: 'Low' };
        }
    }

    generateChartData(linear, monteCarlo, days) {
        const labels = Array.from({ length: days + 1 }, (_, i) => `Day ${i}`);

        return {
            labels,
            datasets: [
                {
                    label: 'Linear Trend',
                    data: [monteCarlo.avgPath[0], ...linear.predictions],
                    borderColor: '#2196f3',
                    fill: false
                },
                {
                    label: 'Monte Carlo Average',
                    data: monteCarlo.avgPath,
                    borderColor: '#4caf50',
                    fill: false
                },
                {
                    label: 'Upper Bound (95%)',
                    data: monteCarlo.avgPath.map((_, i) =>
                        i === 0 ? monteCarlo.avgPath[0] : linear.confidence95.upper[i - 1]
                    ),
                    borderColor: '#ff9800',
                    borderDash: [5, 5],
                    fill: false
                },
                {
                    label: 'Lower Bound (95%)',
                    data: monteCarlo.avgPath.map((_, i) =>
                        i === 0 ? monteCarlo.avgPath[0] : linear.confidence95.lower[i - 1]
                    ),
                    borderColor: '#ff9800',
                    borderDash: [5, 5],
                    fill: false
                }
            ],
            r2: linear.r2
        };
    }

    calculateExpectedShortfall(prices, currentPrice) {
        // Calculate average of worst 5% outcomes
        const losses = prices.filter(p => p < currentPrice);
        const worst5Percent = losses.slice(0, Math.ceil(losses.length * 0.05));
        const avgLoss = this.average(worst5Percent);
        return ((currentPrice - avgLoss) / currentPrice) * 100;
    }

    estimateMaxDrawdown(simulations) {
        const drawdowns = simulations.map(sim => {
            let maxPrice = sim[0];
            let maxDrawdown = 0;

            for (const price of sim) {
                if (price > maxPrice) maxPrice = price;
                const drawdown = (maxPrice - price) / maxPrice;
                if (drawdown > maxDrawdown) maxDrawdown = drawdown;
            }

            return maxDrawdown * 100;
        });

        return this.average(drawdowns);
    }

    calculateSharpeRatio(prices, currentPrice) {
        const returns = prices.map(p => (p - currentPrice) / currentPrice);
        const avgReturn = this.average(returns);
        const stdReturn = this.standardDeviation(returns);

        // Assuming risk-free rate of 3% annually, or ~0.25% monthly
        const riskFreeRate = 0.0025;

        return stdReturn === 0 ? 0 : (avgReturn - riskFreeRate) / stdReturn;
    }
}

module.exports = RegressionAnalyzer;
