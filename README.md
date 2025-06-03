# SignalForge - AI-Powered Stock Trading System

SignalForge is a comprehensive stock trading platform that combines technical analysis, AI-driven insights, and automated signal management. The system supports both Indian (NSE) and US stock markets with real-time price tracking and sophisticated backtesting capabilities.

## 🚀 Features

### Core Trading Features

- **Multi-Market Support**: Trade Indian stocks (NSE) and US stocks with automatic currency handling
- **Real-Time Price Updates**: Live stock price tracking with market hours awareness
- **Signal Management**: Create, track, and manage trading signals with entry, target, and stop-loss levels
- **Portfolio Tracking**: Monitor active positions, P&L, and overall portfolio performance
- **Trade History**: Complete audit trail of all trades with performance metrics

### Advanced Analytics

- **AI-Powered Insights**:
  - Sentiment analysis for market trends
  - Risk assessment for individual trades
  - Pattern recognition for technical analysis
- **DTI (Directional Trend Index) Backtesting**:
  - High conviction trading strategy using DTI indicators
  - 7-day DTI analysis for trend confirmation
  - Automated scanning of all global stocks
  - Daily Telegram alerts at 7 AM UK time
- **Comprehensive Backtesting**:
  - Test strategies on historical data
  - Support for multiple technical indicators (EMA, RSI, MACD, Bollinger Bands)
  - Detailed performance metrics and win/loss analysis
  - Visual charts with entry/exit points
- **Market Status Tracking**: Real-time market open/close status with holiday calendar

### Automated Alerts

- **Telegram Integration**:
  - Daily DTI scan results at 7 AM UK time
  - High conviction trade opportunities
  - Real-time trade signals
  - Portfolio updates and alerts

### Technical Features

- **Secure Authentication**: Google OAuth2 integration with user access control
- **Responsive Design**: Mobile-friendly interface with dark/light theme support
- **Data Persistence**: SQLite database for reliable data storage
- **Export Capabilities**: Download trades and performance data in CSV format

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Database**: SQLite with better-sqlite3
- **Authentication**: Passport.js with Google OAuth2
- **Charts**: Plotly.js for interactive visualizations
- **AI/ML**: Custom lightweight ML models for pattern recognition and risk analysis
- **Deployment**: Optimized for Render.com with persistent storage

## 📋 Prerequisites

- Node.js 16+ and npm
- Google Cloud Console account (for OAuth2)
- Git for version control

## 🔧 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/ketanswebsite/signalforge.git
cd signalforge
```

### 2. Install Dependencies

```bash
npm install
```

Or use the setup script:

```bash
# Windows
setup.bat

# Linux/Mac
chmod +x setup.sh
./setup.sh
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# OAuth2 Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
CALLBACK_URL=http://localhost:3000/auth/google/callback
SESSION_SECRET=your_random_session_secret_min_32_chars
ALLOWED_USERS=email1@gmail.com,email2@gmail.com

# Application Configuration
PORT=3000
NODE_ENV=development

# Telegram Bot Configuration (Optional)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

### 4. Set Up Google OAuth2

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth2 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3000/auth/google/callback` (development)
   - `https://stock-proxy.com/auth/google/callback` (production)

### 5. Start the Application

```bash
npm start
```

Or use the start script:

```bash
# Windows
start.bat

# Linux/Mac
./start.sh
```

Visit `http://localhost:3000` in your browser.

## 📱 Usage Guide

### Getting Started

1. **Login**: Click "Sign in with Google" using an authorized email
2. **Navigate**: Use the main navigation to access different features

### Backtesting

1. Select a stock symbol (e.g., RELIANCE for NSE, AAPL for US)
2. Choose your strategy and indicators
3. Set backtest parameters (capital, dates, etc.)
4. Run backtest to see results with detailed metrics

### Signal Management

1. **Create Signal**: Enter stock symbol, entry price, target, and stop-loss
2. **Monitor**: Track real-time P&L and price movements
3. **Close**: Mark signals as completed when targets are hit

### Using AI Insights

- **Sentiment Analysis**: Get AI-powered market sentiment for stocks
- **Risk Assessment**: Evaluate trade risk before entering positions
- **Pattern Recognition**: Identify technical patterns automatically

## 🚀 Deployment

### Deploy to Render.com

1. **Push to GitHub**:

```bash
git push origin main
```

2. **Set Environment Variables in Render**:

   - All variables from `.env` file
   - Set `NODE_ENV=production`
   - Update `CALLBACK_URL` to your Render URL

3. **Deploy**:

```bash
# Windows
deploy-to-render.bat

# Manual deployment via Render dashboard also supported
```

## 📊 API Endpoints

### Public Endpoints

- `GET /health` - Health check
- `GET /login` - Login page
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - OAuth callback

### Protected Endpoints (Require Authentication)

- `GET /api/trades` - Get all trades
- `POST /api/trades` - Create new trade
- `PUT /api/trades/:id` - Update trade
- `GET /api/prices/:symbols` - Get stock prices
- `GET /api/ml/sentiment/:symbol` - Get AI sentiment analysis
- `POST /api/ml/risk-assessment` - Get risk assessment

## 🔒 Security Features

- OAuth2 authentication with Google
- Session-based security with encrypted cookies
- User whitelist via `ALLOWED_USERS` environment variable
- HTTPS enforcement in production
- Input validation and sanitization
- SQL injection protection with parameterized queries

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is proprietary software. All rights reserved.

**Note**: This system is for educational and analytical purposes. Always do your own research before making investment decisions.
