/**
 * Sentiment Analysis AI Module
 * Analyzes news and social media sentiment for stocks
 * Uses NLP and sentiment scoring for trading signals
 */

const natural = require('natural');
const Sentiment = require('sentiment');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

class SentimentAnalysisAI {
    constructor() {
        this.sentiment = new Sentiment();
        this.tokenizer = new natural.WordTokenizer();
        this.tfidf = new natural.TfIdf();
        this.sentimentHistory = new Map();
        this.newsCache = new Map();
        this.initialize();
    }

    /**
     * Initialize sentiment analysis components
     */
    initialize() {
        // Add financial terms to sentiment analyzer
        this.addFinancialLexicon();
        
        // Initialize NLP components
        this.classifier = new natural.BayesClassifier();
        this.trainClassifier();
        
        console.log('Sentiment Analysis AI initialized');
    }

    /**
     * Add financial-specific terms to sentiment lexicon
     */
    addFinancialLexicon() {
        const financialTerms = {
            // Positive terms
            'bullish': 3, 'rally': 2, 'surge': 3, 'soar': 3, 'boom': 3,
            'upgrade': 2, 'outperform': 2, 'breakout': 2, 'momentum': 1,
            'growth': 2, 'profit': 2, 'earnings beat': 3, 'dividend': 1,
            'expansion': 2, 'recovery': 2, 'upturn': 2, 'gain': 2,
            
            // Negative terms
            'bearish': -3, 'crash': -3, 'plunge': -3, 'collapse': -3,
            'downgrade': -2, 'underperform': -2, 'breakdown': -2,
            'loss': -2, 'deficit': -2, 'earnings miss': -3, 'bankruptcy': -4,
            'recession': -3, 'decline': -2, 'slump': -2, 'volatility': -1,
            
            // Neutral/context-dependent
            'consolidation': 0, 'sideways': 0, 'range-bound': 0,
            'hold': 0, 'neutral': 0, 'unchanged': 0
        };

        // Register custom lexicon
        Object.entries(financialTerms).forEach(([term, score]) => {
            this.sentiment.registerLanguage('en', {
                labels: { [term]: score }
            });
        });
    }

    /**
     * Train classifier for financial news categorization
     */
    trainClassifier() {
        // Training data for news classification
        const trainingData = [
            { text: 'Company reports record earnings beat analyst expectations', category: 'positive' },
            { text: 'Stock plunges after disappointing guidance', category: 'negative' },
            { text: 'Markets consolidate ahead of Fed decision', category: 'neutral' },
            { text: 'Upgrade to buy rating with higher price target', category: 'positive' },
            { text: 'Bankruptcy fears send shares tumbling', category: 'negative' },
            { text: 'Trading volume remains average', category: 'neutral' }
        ];

        trainingData.forEach(item => {
            this.classifier.addDocument(item.text, item.category);
        });

        this.classifier.train();
    }

    /**
     * Analyze sentiment for a specific stock
     * @param {string} symbol - Stock symbol
     * @param {Object} options - Analysis options
     * @returns {Object} - Sentiment analysis results
     */
    async analyzeStockSentiment(symbol, options = {}) {
        const sources = options.sources || ['news', 'social'];
        const results = {
            symbol,
            timestamp: new Date().toISOString(),
            overall: { score: 0, magnitude: 0, trend: 'neutral' },
            sources: {}
        };

        // Analyze each source
        if (sources.includes('news')) {
            results.sources.news = await this.analyzeNewsSentiment(symbol);
        }
        
        if (sources.includes('social')) {
            results.sources.social = await this.analyzeSocialSentiment(symbol);
        }

        // Calculate overall sentiment
        results.overall = this.calculateOverallSentiment(results.sources);
        
        // Generate trading signal
        results.signal = this.generateSentimentSignal(results.overall);
        
        // Store in history
        this.updateSentimentHistory(symbol, results);

        return results;
    }

    /**
     * Analyze news sentiment
     */
    async analyzeNewsSentiment(symbol) {
        try {
            const news = await this.fetchNewsArticles(symbol);
            const sentiments = [];
            
            for (const article of news) {
                const sentiment = this.analyzeText(article.title + ' ' + article.content);
                sentiments.push({
                    ...sentiment,
                    source: article.source,
                    date: article.date,
                    url: article.url
                });
            }

            return {
                articles: sentiments.length,
                averageScore: this.calculateAverageScore(sentiments),
                trend: this.calculateSentimentTrend(sentiments),
                topStories: sentiments.slice(0, 5).map(s => ({
                    title: s.source,
                    score: s.score,
                    impact: this.calculateImpact(s)
                }))
            };
        } catch (error) {
            console.error('News sentiment analysis failed:', error);
            return { error: error.message };
        }
    }

    /**
     * Analyze social media sentiment
     */
    async analyzeSocialSentiment(symbol) {
        try {
            // Simulated social media data (in production, would use real APIs)
            const socialPosts = await this.fetchSocialMedia(symbol);
            const sentiments = [];
            
            for (const post of socialPosts) {
                const sentiment = this.analyzeText(post.content);
                sentiments.push({
                    ...sentiment,
                    platform: post.platform,
                    engagement: post.engagement,
                    author: post.author
                });
            }

            // Calculate weighted sentiment based on engagement
            const weightedScore = this.calculateWeightedSentiment(sentiments);
            
            return {
                posts: sentiments.length,
                averageScore: weightedScore,
                platforms: this.groupByPlatform(sentiments),
                influencers: this.identifyInfluencers(sentiments),
                virality: this.calculateVirality(sentiments)
            };
        } catch (error) {
            console.error('Social sentiment analysis failed:', error);
            return { error: error.message };
        }
    }

    /**
     * Analyze text sentiment
     */
    analyzeText(text) {
        // Basic sentiment
        const result = this.sentiment.analyze(text);
        
        // Tokenize and analyze
        const tokens = this.tokenizer.tokenize(text.toLowerCase());
        
        // Check for financial keywords
        const financialKeywords = this.extractFinancialKeywords(tokens);
        
        // Classify text
        const category = this.classifier.classify(text);
        
        // Calculate confidence
        const confidence = this.calculateConfidence(result, category);
        
        return {
            score: result.score,
            comparative: result.comparative,
            category,
            confidence,
            keywords: financialKeywords,
            positive: result.positive,
            negative: result.negative
        };
    }

    /**
     * Extract financial keywords from tokens
     */
    extractFinancialKeywords(tokens) {
        const keywords = [
            'earnings', 'revenue', 'profit', 'loss', 'growth', 'decline',
            'upgrade', 'downgrade', 'beat', 'miss', 'guidance', 'forecast',
            'bullish', 'bearish', 'target', 'rating', 'analyst', 'sec'
        ];
        
        return tokens.filter(token => keywords.includes(token));
    }

    /**
     * Calculate sentiment confidence
     */
    calculateConfidence(sentimentResult, category) {
        const scoreStrength = Math.abs(sentimentResult.comparative);
        
        // Base confidence on score strength
        let confidence = Math.min(scoreStrength * 100, 100);
        
        // Adjust based on category alignment
        if ((sentimentResult.score > 0 && category === 'positive') ||
            (sentimentResult.score < 0 && category === 'negative') ||
            (Math.abs(sentimentResult.score) < 2 && category === 'neutral')) {
            confidence = Math.min(confidence + 20, 100);
        }
        
        return Math.round(confidence);
    }

    /**
     * Fetch news articles (simulated - in production use news APIs)
     */
    async fetchNewsArticles(symbol) {
        const cacheKey = `news_${symbol}`;
        
        // Check cache
        if (this.newsCache.has(cacheKey)) {
            const cached = this.newsCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 300000) { // 5 minutes
                return cached.data;
            }
        }
        
        // Simulate news fetching
        const news = [
            {
                title: `${symbol} beats earnings expectations`,
                content: 'Company reports strong quarterly results with revenue growth',
                source: 'Financial Times',
                date: new Date(),
                url: '#'
            },
            {
                title: `Analysts upgrade ${symbol} to buy`,
                content: 'Multiple analysts raise price targets citing improving fundamentals',
                source: 'Reuters',
                date: new Date(),
                url: '#'
            }
        ];
        
        // Cache results
        this.newsCache.set(cacheKey, { data: news, timestamp: Date.now() });
        
        return news;
    }

    /**
     * Fetch social media posts (simulated)
     */
    async fetchSocialMedia(symbol) {
        // Simulate social media data
        return [
            {
                content: `$${symbol} looking bullish! Strong breakout incoming 🚀`,
                platform: 'twitter',
                engagement: 150,
                author: 'trader123'
            },
            {
                content: `Just bought more ${symbol}, fundamentals are solid`,
                platform: 'reddit',
                engagement: 89,
                author: 'investing_pro'
            }
        ];
    }

    /**
     * Calculate average sentiment score
     */
    calculateAverageScore(sentiments) {
        if (sentiments.length === 0) return 0;
        
        const sum = sentiments.reduce((acc, s) => acc + s.score, 0);
        return sum / sentiments.length;
    }

    /**
     * Calculate sentiment trend
     */
    calculateSentimentTrend(sentiments) {
        if (sentiments.length < 2) return 'stable';
        
        // Sort by date
        sentiments.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Compare recent vs older sentiment
        const midpoint = Math.floor(sentiments.length / 2);
        const recentAvg = this.calculateAverageScore(sentiments.slice(midpoint));
        const olderAvg = this.calculateAverageScore(sentiments.slice(0, midpoint));
        
        const change = recentAvg - olderAvg;
        
        if (change > 2) return 'improving';
        if (change < -2) return 'deteriorating';
        return 'stable';
    }

    /**
     * Calculate weighted sentiment based on engagement
     */
    calculateWeightedSentiment(sentiments) {
        const totalEngagement = sentiments.reduce((sum, s) => sum + s.engagement, 0);
        
        if (totalEngagement === 0) return 0;
        
        const weightedSum = sentiments.reduce((sum, s) => {
            return sum + (s.score * s.engagement);
        }, 0);
        
        return weightedSum / totalEngagement;
    }

    /**
     * Group sentiments by platform
     */
    groupByPlatform(sentiments) {
        const platforms = {};
        
        sentiments.forEach(s => {
            if (!platforms[s.platform]) {
                platforms[s.platform] = {
                    count: 0,
                    totalScore: 0,
                    totalEngagement: 0
                };
            }
            
            platforms[s.platform].count++;
            platforms[s.platform].totalScore += s.score;
            platforms[s.platform].totalEngagement += s.engagement;
        });
        
        // Calculate averages
        Object.keys(platforms).forEach(platform => {
            platforms[platform].averageScore = 
                platforms[platform].totalScore / platforms[platform].count;
        });
        
        return platforms;
    }

    /**
     * Identify influential authors
     */
    identifyInfluencers(sentiments) {
        const authors = {};
        
        sentiments.forEach(s => {
            if (!authors[s.author]) {
                authors[s.author] = {
                    posts: 0,
                    totalEngagement: 0,
                    averageSentiment: 0
                };
            }
            
            authors[s.author].posts++;
            authors[s.author].totalEngagement += s.engagement;
            authors[s.author].averageSentiment += s.score;
        });
        
        // Sort by influence (engagement)
        return Object.entries(authors)
            .map(([author, data]) => ({
                author,
                influence: data.totalEngagement,
                sentiment: data.averageSentiment / data.posts
            }))
            .sort((a, b) => b.influence - a.influence)
            .slice(0, 5);
    }

    /**
     * Calculate virality score
     */
    calculateVirality(sentiments) {
        const recentSentiments = sentiments.filter(s => {
            const hoursSince = (Date.now() - new Date(s.date)) / (1000 * 60 * 60);
            return hoursSince < 24;
        });
        
        const totalEngagement = recentSentiments.reduce((sum, s) => sum + s.engagement, 0);
        const avgEngagement = totalEngagement / recentSentiments.length || 0;
        
        // Virality score based on engagement rate
        if (avgEngagement > 1000) return 'viral';
        if (avgEngagement > 500) return 'trending';
        if (avgEngagement > 100) return 'active';
        return 'normal';
    }

    /**
     * Calculate sentiment impact
     */
    calculateImpact(sentiment) {
        const scoreImpact = Math.abs(sentiment.score) / 10;
        const keywordImpact = sentiment.keywords.length / 5;
        const confidenceImpact = sentiment.confidence / 100;
        
        return Math.min((scoreImpact + keywordImpact + confidenceImpact) / 3 * 100, 100);
    }

    /**
     * Calculate overall sentiment from all sources
     */
    calculateOverallSentiment(sources) {
        const scores = [];
        const weights = { news: 0.6, social: 0.4 }; // News has higher weight
        
        Object.entries(sources).forEach(([source, data]) => {
            if (data && !data.error && data.averageScore !== undefined) {
                scores.push({
                    score: data.averageScore,
                    weight: weights[source] || 0.5
                });
            }
        });
        
        if (scores.length === 0) {
            return { score: 0, magnitude: 0, trend: 'neutral' };
        }
        
        // Calculate weighted average
        const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
        const weightedScore = scores.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight;
        
        // Calculate magnitude (strength of sentiment)
        const magnitude = Math.abs(weightedScore);
        
        // Determine trend
        let trend = 'neutral';
        if (weightedScore > 5) trend = 'positive';
        else if (weightedScore < -5) trend = 'negative';
        
        return {
            score: parseFloat(weightedScore.toFixed(2)),
            magnitude: parseFloat(magnitude.toFixed(2)),
            trend
        };
    }

    /**
     * Generate trading signal based on sentiment
     */
    generateSentimentSignal(sentiment) {
        const { score, magnitude, trend } = sentiment;
        
        // Check historical sentiment for context
        const historicalTrend = this.getHistoricalTrend();
        
        let signal = {
            action: 'hold',
            strength: 'weak',
            confidence: magnitude,
            reason: ''
        };
        
        // Strong positive sentiment
        if (score > 10 && magnitude > 10) {
            signal.action = 'buy';
            signal.strength = 'strong';
            signal.reason = 'Strong positive sentiment across sources';
        }
        // Moderate positive sentiment
        else if (score > 5 && magnitude > 5) {
            signal.action = 'buy';
            signal.strength = 'moderate';
            signal.reason = 'Positive sentiment building';
        }
        // Strong negative sentiment
        else if (score < -10 && magnitude > 10) {
            signal.action = 'sell';
            signal.strength = 'strong';
            signal.reason = 'Strong negative sentiment detected';
        }
        // Moderate negative sentiment
        else if (score < -5 && magnitude > 5) {
            signal.action = 'sell';
            signal.strength = 'moderate';
            signal.reason = 'Negative sentiment emerging';
        }
        
        // Adjust for historical context
        if (historicalTrend === 'improving' && signal.action === 'hold') {
            signal.action = 'buy';
            signal.strength = 'weak';
            signal.reason = 'Sentiment trend improving';
        } else if (historicalTrend === 'deteriorating' && signal.action === 'hold') {
            signal.action = 'sell';
            signal.strength = 'weak';
            signal.reason = 'Sentiment trend deteriorating';
        }
        
        return signal;
    }

    /**
     * Update sentiment history
     */
    updateSentimentHistory(symbol, results) {
        if (!this.sentimentHistory.has(symbol)) {
            this.sentimentHistory.set(symbol, []);
        }
        
        const history = this.sentimentHistory.get(symbol);
        history.push({
            timestamp: results.timestamp,
            score: results.overall.score,
            magnitude: results.overall.magnitude
        });
        
        // Keep last 100 entries
        if (history.length > 100) {
            history.shift();
        }
    }

    /**
     * Get historical sentiment trend
     */
    getHistoricalTrend(symbol) {
        const history = this.sentimentHistory.get(symbol);
        if (!history || history.length < 10) return 'insufficient_data';
        
        // Compare recent average to older average
        const recent = history.slice(-5);
        const older = history.slice(-10, -5);
        
        const recentAvg = recent.reduce((sum, h) => sum + h.score, 0) / recent.length;
        const olderAvg = older.reduce((sum, h) => sum + h.score, 0) / older.length;
        
        const change = recentAvg - olderAvg;
        
        if (change > 2) return 'improving';
        if (change < -2) return 'deteriorating';
        return 'stable';
    }

    /**
     * Get real-time sentiment alerts
     */
    async getSentimentAlerts(symbols) {
        const alerts = [];
        
        for (const symbol of symbols) {
            const sentiment = await this.analyzeStockSentiment(symbol);
            
            // Check for significant sentiment events
            if (Math.abs(sentiment.overall.score) > 15) {
                alerts.push({
                    symbol,
                    type: sentiment.overall.score > 0 ? 'positive_surge' : 'negative_surge',
                    score: sentiment.overall.score,
                    signal: sentiment.signal,
                    sources: sentiment.sources,
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        return alerts;
    }
}

module.exports = SentimentAnalysisAI;