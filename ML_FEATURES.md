# SignalForge ML/AI Features

## Overview

SignalForge now includes advanced ML/AI capabilities to enhance your trading decisions with data-driven insights.

## Installation

### Windows
```bash
setup-ml.bat
```

### Linux/Mac
```bash
chmod +x setup-ml.sh
./setup-ml.sh
```

### Manual Installation
If the setup scripts don't work, you can install manually:
```bash
npm install
```

The ML features use lightweight JavaScript libraries instead of heavy TensorFlow, making installation much faster and more compatible.

## Features

### 1. Risk Management AI
- **Dynamic Stop-Loss/Take-Profit Optimization**: Uses reinforcement learning to suggest optimal risk parameters based on market conditions
- **Monte Carlo Risk Simulation**: Runs thousands of scenarios to assess portfolio risk
- **Anomaly Detection**: Identifies unusual market conditions and adjusts recommendations

### 2. Pattern Recognition
- **Chart Pattern Detection**: CNN-based detection of classic patterns:
  - Head and Shoulders
  - Double Top/Bottom
  - Triangles (Ascending, Descending, Symmetrical)
  - Flags and Pennants
  - Wedges
- **Candlestick Pattern Recognition**: Identifies bullish/bearish reversal and continuation patterns
- **Support/Resistance Prediction**: AI-powered identification of key price levels

### 3. Sentiment Analysis
- **News Sentiment**: Analyzes financial news for positive/negative sentiment
- **Social Media Tracking**: Monitors social sentiment from trading communities
- **Signal Generation**: Combines sentiment data to generate buy/sell signals

## Using AI Features

1. Click the **"AI Insights"** button in the main interface
2. Enter a stock symbol
3. Click "Analyze" to get comprehensive ML analysis
4. Review the AI recommendations from all three systems

## API Endpoints

The ML features expose the following API endpoints:

### Get Full ML Analysis
```
GET /api/ml/analysis/{symbol}?days=100
```

### Get Risk Parameters
```
POST /api/ml/risk-params
Body: { marketState: { priceChange, volumeRatio, volatility, rsi, holdingDays } }
```

### Detect Patterns
```
POST /api/ml/detect-patterns
Body: { priceData: [...] }
```

### Get Sentiment Analysis
```
GET /api/ml/sentiment/{symbol}?sources=news,social
```

### Portfolio Risk Analysis
```
POST /api/ml/portfolio-risk
Body: { portfolio: [...], days: 30, iterations: 1000 }
```

## Understanding the Output

### Combined Signal
The AI combines insights from all three systems to provide a unified trading signal:
- **BUY**: Strong positive indicators across multiple systems
- **SELL**: Strong negative indicators
- **HOLD**: Mixed or neutral signals

### Confidence Scores
Each recommendation includes a confidence percentage (0-100%):
- 80-100%: High confidence
- 60-79%: Moderate confidence
- Below 60%: Low confidence

### Risk Parameters
- **Stop Loss**: Suggested maximum loss percentage
- **Take Profit**: Suggested profit target
- **Confidence**: How certain the AI is about these parameters

## Best Practices

1. **Use AI as a Tool, Not a Crystal Ball**: AI insights should complement, not replace, your own analysis
2. **Consider Multiple Signals**: Look for confluence between different AI systems
3. **Monitor Anomalies**: Pay special attention when the AI detects unusual market conditions
4. **Regular Updates**: The AI models improve over time with more data

## Troubleshooting

### Installation Issues
- Ensure Node.js version 14+ is installed
- Check internet connection (TensorFlow is a large download)
- Try running setup script with administrator privileges

### Performance
- Initial analysis may take 10-30 seconds
- Subsequent analyses are faster due to caching
- GPU acceleration is automatically used if available

### Accuracy
- AI predictions are probabilistic, not guarantees
- Performance depends on market conditions
- Models work best with liquid stocks with good data availability

## Future Enhancements

- Real-time streaming analysis
- Custom model training with your trading history
- Multi-timeframe analysis
- Options trading signals
- Crypto market support