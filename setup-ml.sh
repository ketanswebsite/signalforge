#!/bin/bash

echo
echo "========================================"
echo "SignalForge ML/AI Setup"
echo "========================================"
echo

echo "Installing ML/AI dependencies..."
echo
echo "This should complete quickly with lightweight ML libraries."
echo

npm install

if [ $? -ne 0 ]; then
    echo
    echo "ERROR: Failed to install dependencies"
    echo "Please check your internet connection and try again"
    exit 1
fi

echo
echo "Creating ML models directory..."
mkdir -p ml/models

echo
echo "========================================"
echo "ML/AI Setup Complete!"
echo "========================================"
echo
echo "The following AI features are now available:"
echo
echo "1. Risk Management AI"
echo "   - Dynamic stop-loss/take-profit optimization"
echo "   - Portfolio risk assessment with Monte Carlo"
echo "   - Market anomaly detection"
echo
echo "2. Pattern Recognition"
echo "   - Chart pattern detection (Head & Shoulders, Triangles, etc.)"
echo "   - Candlestick pattern recognition"
echo "   - Support/resistance level prediction"
echo
echo "3. Sentiment Analysis"
echo "   - News sentiment analysis"
echo "   - Social media sentiment tracking"
echo "   - Trading signal generation"
echo
echo "To access AI features, look for the 'AI Insights' button in the app."
echo