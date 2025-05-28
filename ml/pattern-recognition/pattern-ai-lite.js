/**
 * Pattern Recognition AI Module (Lightweight Version)
 * Uses rule-based algorithms and statistical analysis for pattern detection
 * No heavy dependencies required
 */

const technicalIndicators = require('technicalindicators');
const ss = require('simple-statistics');

class PatternRecognitionAI {
    constructor() {
        this.detectedPatterns = [];
        this.candlestickPatterns = this.initializeCandlestickPatterns();
    }

    /**
     * Initialize candlestick pattern definitions
     */
    initializeCandlestickPatterns() {
        return {
            bullish: [
                'hammer', 'inverted_hammer', 'bullish_engulfing', 
                'piercing_line', 'morning_star', 'three_white_soldiers'
            ],
            bearish: [
                'hanging_man', 'shooting_star', 'bearish_engulfing',
                'dark_cloud_cover', 'evening_star', 'three_black_crows'
            ],
            neutral: ['doji', 'spinning_top']
        };
    }

    /**
     * Detect chart patterns in price data using statistical analysis
     * @param {Array} prices - Array of {date, open, high, low, close, volume}
     * @returns {Array} - Detected patterns with confidence scores
     */
    async detectChartPatterns(prices) {
        if (prices.length < 50) return [];

        const patterns = [];

        try {
            // Detect various chart patterns
            patterns.push(...this.detectHeadAndShoulders(prices));
            patterns.push(...this.detectDoubleTopBottom(prices));
            patterns.push(...this.detectTriangles(prices));
            patterns.push(...this.detectFlags(prices));
            patterns.push(...this.detectWedges(prices));
        } catch (error) {
            console.error('Chart pattern detection error:', error);
            return [];
        }

        return patterns.filter(p => p.confidence > 0.6);
    }

    /**
     * Detect Head and Shoulders pattern
     */
    detectHeadAndShoulders(prices) {
        const patterns = [];
        const window = 20;
        const closes = prices.map(p => p.close);
        
        for (let i = window; i < prices.length - window; i++) {
            const leftData = closes.slice(i - window, i);
            const centerData = closes.slice(i - 5, i + 5);
            const rightData = closes.slice(i, i + window);
            
            const leftPeak = Math.max(...leftData);
            const centerPeak = Math.max(...centerData);
            const rightPeak = Math.max(...rightData);
            
            // Check if center is higher than sides (head higher than shoulders)
            if (centerPeak > leftPeak * 1.02 && centerPeak > rightPeak * 1.02) {
                const leftShoulder = leftData.indexOf(leftPeak);
                const rightShoulder = rightData.indexOf(rightPeak);
                
                // Check symmetry
                const symmetry = Math.abs(leftShoulder - rightShoulder) / window;
                const heightRatio = Math.min(leftPeak, rightPeak) / Math.max(leftPeak, rightPeak);
                
                if (symmetry < 0.3 && heightRatio > 0.9) {
                    patterns.push({
                        type: 'head_shoulders',
                        confidence: (heightRatio * (1 - symmetry)) * 0.8,
                        startDate: prices[i - window].date,
                        endDate: prices[i + window].date,
                        priceRange: {
                            low: Math.min(...closes.slice(i - window, i + window)),
                            high: centerPeak
                        },
                        recommendation: 'Bearish reversal pattern - Consider selling or shorting'
                    });
                }
            }
        }
        
        return patterns;
    }

    /**
     * Detect Double Top/Bottom patterns
     */
    detectDoubleTopBottom(prices) {
        const patterns = [];
        const window = 15;
        const closes = prices.map(p => p.close);
        
        for (let i = window; i < prices.length - window; i++) {
            const data = closes.slice(i - window, i + window);
            const peaks = this.findLocalExtrema(data, 'max', 5);
            const troughs = this.findLocalExtrema(data, 'min', 5);
            
            // Double Top
            if (peaks.length >= 2) {
                const [peak1, peak2] = peaks.slice(-2);
                const heightDiff = Math.abs(peak1.price - peak2.price) / peak1.price;
                const timeDiff = Math.abs(peak1.index - peak2.index);
                
                if (heightDiff < 0.03 && timeDiff > 5 && timeDiff < 20) {
                    patterns.push({
                        type: 'double_top',
                        confidence: (1 - heightDiff) * 0.7,
                        startDate: prices[i - window + peak1.index].date,
                        endDate: prices[i - window + peak2.index].date,
                        priceRange: {
                            low: Math.min(...data),
                            high: Math.max(peak1.price, peak2.price)
                        },
                        recommendation: 'Bearish reversal - Wait for neckline break to sell'
                    });
                }
            }
            
            // Double Bottom
            if (troughs.length >= 2) {
                const [trough1, trough2] = troughs.slice(-2);
                const heightDiff = Math.abs(trough1.price - trough2.price) / trough1.price;
                const timeDiff = Math.abs(trough1.index - trough2.index);
                
                if (heightDiff < 0.03 && timeDiff > 5 && timeDiff < 20) {
                    patterns.push({
                        type: 'double_bottom',
                        confidence: (1 - heightDiff) * 0.7,
                        startDate: prices[i - window + trough1.index].date,
                        endDate: prices[i - window + trough2.index].date,
                        priceRange: {
                            low: Math.min(trough1.price, trough2.price),
                            high: Math.max(...data)
                        },
                        recommendation: 'Bullish reversal - Wait for neckline break to buy'
                    });
                }
            }
        }
        
        return patterns;
    }

    /**
     * Detect Triangle patterns
     */
    detectTriangles(prices) {
        const patterns = [];
        const window = 25;
        
        for (let i = window; i < prices.length - 10; i++) {
            const data = prices.slice(i - window, i);
            const highs = data.map(p => p.high);
            const lows = data.map(p => p.low);
            
            // Calculate trend lines
            const highTrend = this.calculateTrendLine(highs);
            const lowTrend = this.calculateTrendLine(lows);
            
            if (highTrend && lowTrend) {
                const convergence = Math.abs(highTrend.slope + lowTrend.slope);
                
                // Ascending Triangle
                if (Math.abs(highTrend.slope) < 0.001 && lowTrend.slope > 0.01) {
                    patterns.push({
                        type: 'ascending_triangle',
                        confidence: Math.min(convergence * 20, 0.8),
                        startDate: data[0].date,
                        endDate: data[data.length - 1].date,
                        priceRange: {
                            low: Math.min(...lows),
                            high: Math.max(...highs)
                        },
                        recommendation: 'Bullish continuation - Buy on breakout above resistance'
                    });
                }
                
                // Descending Triangle
                if (Math.abs(lowTrend.slope) < 0.001 && highTrend.slope < -0.01) {
                    patterns.push({
                        type: 'descending_triangle',
                        confidence: Math.min(convergence * 20, 0.8),
                        startDate: data[0].date,
                        endDate: data[data.length - 1].date,
                        priceRange: {
                            low: Math.min(...lows),
                            high: Math.max(...highs)
                        },
                        recommendation: 'Bearish continuation - Sell on breakdown below support'
                    });
                }
                
                // Symmetrical Triangle
                if (highTrend.slope < -0.005 && lowTrend.slope > 0.005 && convergence > 0.01) {
                    patterns.push({
                        type: 'symmetrical_triangle',
                        confidence: Math.min(convergence * 15, 0.75),
                        startDate: data[0].date,
                        endDate: data[data.length - 1].date,
                        priceRange: {
                            low: Math.min(...lows),
                            high: Math.max(...highs)
                        },
                        recommendation: 'Neutral - Wait for breakout direction'
                    });
                }
            }
        }
        
        return patterns;
    }

    /**
     * Detect Flag patterns
     */
    detectFlags(prices) {
        const patterns = [];
        const window = 15;
        
        for (let i = window; i < prices.length - 10; i++) {
            const beforeFlag = prices.slice(i - window - 10, i - window);
            const flagData = prices.slice(i - window, i);
            
            // Check for strong trend before flag
            const trendStrength = this.calculateTrendStrength(beforeFlag);
            
            if (Math.abs(trendStrength) > 0.05) {
                // Check flag characteristics
                const flagRange = Math.max(...flagData.map(p => p.high)) - Math.min(...flagData.map(p => p.low));
                const beforeRange = Math.max(...beforeFlag.map(p => p.high)) - Math.min(...beforeFlag.map(p => p.low));
                
                // Flag should be smaller than the preceding move
                if (flagRange < beforeRange * 0.5) {
                    const flagTrend = this.calculateTrendStrength(flagData);
                    
                    // Flag should trend against the main move
                    if ((trendStrength > 0 && flagTrend < 0) || (trendStrength < 0 && flagTrend > 0)) {
                        patterns.push({
                            type: 'flag',
                            confidence: Math.min(Math.abs(trendStrength) * 10, 0.8),
                            startDate: flagData[0].date,
                            endDate: flagData[flagData.length - 1].date,
                            priceRange: {
                                low: Math.min(...flagData.map(p => p.low)),
                                high: Math.max(...flagData.map(p => p.high))
                            },
                            recommendation: 'Continuation pattern - Trade in direction of prior trend'
                        });
                    }
                }
            }
        }
        
        return patterns;
    }

    /**
     * Detect Wedge patterns
     */
    detectWedges(prices) {
        const patterns = [];
        const window = 20;
        
        for (let i = window; i < prices.length - 10; i++) {
            const data = prices.slice(i - window, i);
            const highs = data.map(p => p.high);
            const lows = data.map(p => p.low);
            
            const highTrend = this.calculateTrendLine(highs);
            const lowTrend = this.calculateTrendLine(lows);
            
            if (highTrend && lowTrend) {
                // Rising Wedge (bearish)
                if (highTrend.slope > 0 && lowTrend.slope > 0 && highTrend.slope < lowTrend.slope) {
                    patterns.push({
                        type: 'rising_wedge',
                        confidence: 0.7,
                        startDate: data[0].date,
                        endDate: data[data.length - 1].date,
                        priceRange: {
                            low: Math.min(...lows),
                            high: Math.max(...highs)
                        },
                        recommendation: 'Bearish reversal pattern - Consider selling'
                    });
                }
                
                // Falling Wedge (bullish)
                if (highTrend.slope < 0 && lowTrend.slope < 0 && highTrend.slope > lowTrend.slope) {
                    patterns.push({
                        type: 'falling_wedge',
                        confidence: 0.7,
                        startDate: data[0].date,
                        endDate: data[data.length - 1].date,
                        priceRange: {
                            low: Math.min(...lows),
                            high: Math.max(...highs)
                        },
                        recommendation: 'Bullish reversal pattern - Consider buying'
                    });
                }
            }
        }
        
        return patterns;
    }

    /**
     * Detect candlestick patterns using technical indicators library
     */
    detectCandlestickPatterns(prices) {
        if (prices.length < 5) return [];

        const patterns = [];
        const ohlc = {
            open: prices.map(p => p.open),
            high: prices.map(p => p.high),
            low: prices.map(p => p.low),
            close: prices.map(p => p.close)
        };

        // Check for various candlestick patterns
        const patternChecks = [
            { name: 'hammer', func: (ohlc) => this.checkHammer(ohlc) },
            { name: 'hanging_man', func: (ohlc) => this.checkHangingMan(ohlc) },
            { name: 'doji', func: (ohlc) => this.checkDoji(ohlc) },
            { name: 'bullish_engulfing', func: (ohlc) => this.checkBullishEngulfing(ohlc) },
            { name: 'bearish_engulfing', func: (ohlc) => this.checkBearishEngulfing(ohlc) },
        ];

        patternChecks.forEach(({ name, func }) => {
            const result = func(ohlc);
            if (result) {
                const patternType = this.getPatternType(name);
                patterns.push({
                    pattern: name,
                    type: patternType,
                    date: prices[prices.length - 1].date,
                    confidence: this.calculatePatternConfidence(name, prices),
                    recommendation: this.getCandlestickRecommendation(name, patternType)
                });
            }
        });

        return patterns;
    }

    /**
     * Check for Hammer pattern
     */
    checkHammer(ohlc) {
        const lastIndex = ohlc.close.length - 1;
        const open = ohlc.open[lastIndex];
        const high = ohlc.high[lastIndex];
        const low = ohlc.low[lastIndex];
        const close = ohlc.close[lastIndex];
        
        const bodySize = Math.abs(close - open);
        const upperShadow = high - Math.max(open, close);
        const lowerShadow = Math.min(open, close) - low;
        
        // Hammer: small body, long lower shadow, short upper shadow
        return bodySize < (high - low) * 0.3 && 
               lowerShadow > bodySize * 2 && 
               upperShadow < bodySize;
    }

    /**
     * Check for Hanging Man pattern
     */
    checkHangingMan(ohlc) {
        // Same structure as hammer but appears after uptrend
        return this.checkHammer(ohlc);
    }

    /**
     * Check for Doji pattern
     */
    checkDoji(ohlc) {
        const lastIndex = ohlc.close.length - 1;
        const open = ohlc.open[lastIndex];
        const close = ohlc.close[lastIndex];
        const high = ohlc.high[lastIndex];
        const low = ohlc.low[lastIndex];
        
        const bodySize = Math.abs(close - open);
        const totalRange = high - low;
        
        // Doji: very small body relative to range
        return bodySize < totalRange * 0.1;
    }

    /**
     * Check for Bullish Engulfing pattern
     */
    checkBullishEngulfing(ohlc) {
        if (ohlc.close.length < 2) return false;
        
        const current = ohlc.close.length - 1;
        const previous = current - 1;
        
        // Previous candle is bearish
        const prevBearish = ohlc.close[previous] < ohlc.open[previous];
        // Current candle is bullish
        const currBullish = ohlc.close[current] > ohlc.open[current];
        // Current engulfs previous
        const engulfs = ohlc.open[current] < ohlc.close[previous] && 
                       ohlc.close[current] > ohlc.open[previous];
        
        return prevBearish && currBullish && engulfs;
    }

    /**
     * Check for Bearish Engulfing pattern
     */
    checkBearishEngulfing(ohlc) {
        if (ohlc.close.length < 2) return false;
        
        const current = ohlc.close.length - 1;
        const previous = current - 1;
        
        // Previous candle is bullish
        const prevBullish = ohlc.close[previous] > ohlc.open[previous];
        // Current candle is bearish
        const currBearish = ohlc.close[current] < ohlc.open[current];
        // Current engulfs previous
        const engulfs = ohlc.open[current] > ohlc.close[previous] && 
                       ohlc.close[current] < ohlc.open[previous];
        
        return prevBullish && currBearish && engulfs;
    }

    /**
     * Predict support and resistance levels
     */
    predictSupportResistance(prices) {
        if (prices.length < 20) return { support: [], resistance: [] };

        const highs = prices.map(p => p.high);
        const lows = prices.map(p => p.low);
        
        // Find local maxima and minima
        const resistanceLevels = this.findLocalExtrema(highs, 'max');
        const supportLevels = this.findLocalExtrema(lows, 'min');
        
        // Cluster nearby levels
        const clusteredResistance = this.clusterLevels(resistanceLevels);
        const clusteredSupport = this.clusterLevels(supportLevels);
        
        // Calculate strength of each level
        const resistance = clusteredResistance.map(level => ({
            price: level.price,
            strength: this.calculateLevelStrength(level, prices, 'resistance'),
            touches: level.touches,
            lastTouch: level.lastTouch
        }));
        
        const support = clusteredSupport.map(level => ({
            price: level.price,
            strength: this.calculateLevelStrength(level, prices, 'support'),
            touches: level.touches,
            lastTouch: level.lastTouch
        }));
        
        // Sort by strength
        resistance.sort((a, b) => b.strength - a.strength);
        support.sort((a, b) => b.strength - a.strength);
        
        return {
            support: support.slice(0, 3),
            resistance: resistance.slice(0, 3),
            currentPrice: prices[prices.length - 1].close
        };
    }

    // Helper methods
    findLocalExtrema(data, type, window = 5) {
        const extrema = [];
        
        for (let i = window; i < data.length - window; i++) {
            const subset = data.slice(i - window, i + window + 1);
            const current = data[i];
            
            if (type === 'max' && current === Math.max(...subset)) {
                extrema.push({ index: i, price: current });
            } else if (type === 'min' && current === Math.min(...subset)) {
                extrema.push({ index: i, price: current });
            }
        }
        
        return extrema;
    }

    clusterLevels(levels, threshold = 0.02) {
        const clusters = [];
        
        levels.forEach(level => {
            let added = false;
            
            for (const cluster of clusters) {
                if (Math.abs(cluster.price - level.price) / cluster.price < threshold) {
                    cluster.prices.push(level.price);
                    cluster.indices.push(level.index);
                    cluster.price = cluster.prices.reduce((a, b) => a + b) / cluster.prices.length;
                    added = true;
                    break;
                }
            }
            
            if (!added) {
                clusters.push({
                    price: level.price,
                    prices: [level.price],
                    indices: [level.index],
                    touches: 1,
                    lastTouch: level.index
                });
            }
        });
        
        clusters.forEach(cluster => {
            cluster.touches = cluster.indices.length;
            cluster.lastTouch = Math.max(...cluster.indices);
        });
        
        return clusters;
    }

    calculateLevelStrength(level, prices, type) {
        let strength = level.touches * 20;
        
        const daysSinceTouch = prices.length - level.lastTouch;
        strength += Math.max(0, 20 - daysSinceTouch);
        
        const currentPrice = prices[prices.length - 1].close;
        const distance = Math.abs(currentPrice - level.price) / currentPrice;
        
        if (distance < 0.05) {
            strength += 30;
        } else if (distance < 0.1) {
            strength += 15;
        }
        
        return Math.min(strength, 100);
    }

    calculateTrendLine(data) {
        if (data.length < 2) return null;
        
        const xValues = data.map((_, i) => i);
        const regression = ss.linearRegression(xValues.map((x, i) => [x, data[i]]));
        
        return {
            slope: regression.m,
            intercept: regression.b,
            rSquared: ss.rSquared(xValues.map((x, i) => [x, data[i]]), regression)
        };
    }

    calculateTrendStrength(prices) {
        if (prices.length < 2) return 0;
        
        const firstPrice = prices[0].close;
        const lastPrice = prices[prices.length - 1].close;
        
        return (lastPrice - firstPrice) / firstPrice;
    }

    getPatternType(patternName) {
        if (this.candlestickPatterns.bullish.includes(patternName)) return 'bullish';
        if (this.candlestickPatterns.bearish.includes(patternName)) return 'bearish';
        return 'neutral';
    }

    calculatePatternConfidence(pattern, prices) {
        let confidence = 70;
        
        const avgVolume = prices.slice(0, -1).reduce((sum, p) => sum + p.volume, 0) / (prices.length - 1);
        const lastVolume = prices[prices.length - 1].volume;
        
        if (lastVolume > avgVolume * 1.5) {
            confidence += 15;
        } else if (lastVolume > avgVolume) {
            confidence += 5;
        }
        
        return Math.min(confidence, 95);
    }

    getCandlestickRecommendation(pattern, type) {
        if (type === 'bullish') {
            return 'Bullish signal - Consider buying if confirmed by next candle';
        } else if (type === 'bearish') {
            return 'Bearish signal - Consider selling if confirmed by next candle';
        }
        return 'Neutral pattern - Wait for additional signals';
    }

    async saveModel() {
        console.log('Pattern Recognition model saved (rule-based, no training required)');
    }

    async loadModel() {
        console.log('Pattern Recognition model loaded (rule-based system)');
    }
}

module.exports = PatternRecognitionAI;