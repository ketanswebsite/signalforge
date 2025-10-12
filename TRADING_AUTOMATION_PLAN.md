# Automated Trading System - Development Plan
## SignalForge: Trading212 + IIFL Integration

---

## 📋 Executive Summary

**Project Goal:** Extend SignalForge portfolio simulator to execute real trades automatically using:
- **Trading212** for UK & US stocks (FTSE100, FTSE250, S&P 500)
- **IIFL Securities (Blaze API)** for Indian stocks (Nifty50, Nifty Next 50, Nifty Midcap 150)

**Timeline:** 12 weeks (3 months)
**Estimated Effort:** 200-300 development hours
**Risk Level:** HIGH (real money trading, regulatory compliance, API stability)

**Key Success Metrics:**
- ✅ 100% signal-to-execution accuracy
- ✅ <5 second order placement latency
- ✅ Zero unauthorized trades
- ✅ Paper trading success for 1 month before live
- ✅ 99.9% uptime during market hours

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    SignalForge Web UI                    │
│  (Existing: Portfolio Simulator, Backtester, Signals)   │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
    ┌────▼────┐            ┌────▼────┐
    │  Signal │            │  Live   │
    │Generator│            │ Monitor │
    │  (New)  │            │Dashboard│
    └────┬────┘            └─────────┘
         │
    ┌────▼──────────────────────────────────┐
    │      Trade Execution Service          │
    │  - Signal Validation                  │
    │  - Position Sizing                    │
    │  - Order Routing                      │
    │  - Risk Management                    │
    └────┬──────────────┬───────────────────┘
         │              │
    ┌────▼────┐    ┌────▼────┐
    │Trading  │    │  IIFL   │
    │  212    │    │  Blaze  │
    │  API    │    │  API    │
    └─────────┘    └─────────┘
```

---

## 📊 Current System Status

### ✅ Already Built
- DTI indicator calculation
- Backtesting engine (5-year historical data)
- High conviction stock filtering (>75% win rate)
- Signal generation (entry/exit conditions)
- Portfolio simulator (day-by-day simulation)
- Dynamic position sizing
- Force-close logic (30-day max holding)
- Multi-market support (India, UK, US)
- CSV export functionality

### 🚧 Needs Building
- Broker API integrations
- Live signal monitoring
- Order placement & tracking
- Real-time position sync
- Safety checks & circuit breakers
- Monitoring dashboard
- Notification system

---

# PHASE 1: Foundation & Infrastructure
**Timeline:** Week 1-2 (10-15 hours)
**Status:** 🔴 NOT STARTED

## Objectives
- Set up database schema for trade execution
- Create broker API abstraction layer
- Implement secure credential management
- Establish error handling framework
- Set up development/testing environment

---

## Task 1.1: Database Schema Design ⏳
**Priority:** CRITICAL | **Estimated Time:** 3 hours

### Tables to Create

#### 1.1.1 broker_accounts
```sql
CREATE TABLE broker_accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  broker_name VARCHAR(50) NOT NULL,  -- 'trading212' or 'iifl'
  account_id VARCHAR(100),           -- Broker's account identifier
  api_key_encrypted TEXT NOT NULL,
  api_secret_encrypted TEXT NOT NULL,
  api_endpoint VARCHAR(255),         -- 'demo' or 'live' URL
  is_active BOOLEAN DEFAULT false,
  is_paper_trading BOOLEAN DEFAULT true,
  max_positions INTEGER DEFAULT 10,  -- Per-broker position limit
  daily_loss_limit DECIMAL(10,2),    -- Kill switch threshold
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_connected_at TIMESTAMP,
  UNIQUE(user_id, broker_name)
);

CREATE INDEX idx_broker_accounts_user ON broker_accounts(user_id);
CREATE INDEX idx_broker_accounts_active ON broker_accounts(is_active) WHERE is_active = true;
```

**Checklist:**
- [ ] Create migration file: `migrations/009_create_broker_accounts.sql`
- [ ] Add rollback script
- [ ] Test migration on dev database
- [ ] Document table purpose and fields

#### 1.1.2 executed_orders
```sql
CREATE TABLE executed_orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  broker_account_id INTEGER REFERENCES broker_accounts(id),
  signal_id VARCHAR(100),            -- Reference to originating signal
  broker_order_id VARCHAR(100),      -- Broker's order ID
  symbol VARCHAR(20) NOT NULL,
  market VARCHAR(10) NOT NULL,       -- 'India', 'UK', 'US'
  side VARCHAR(10) NOT NULL,         -- 'BUY', 'SELL'
  order_type VARCHAR(20) DEFAULT 'MARKET',  -- 'MARKET', 'LIMIT', 'STOP'
  quantity INTEGER NOT NULL,
  requested_price DECIMAL(10,2),     -- For limit orders
  filled_quantity INTEGER DEFAULT 0,
  filled_price DECIMAL(10,2),
  status VARCHAR(20) NOT NULL,       -- 'PENDING', 'FILLED', 'PARTIAL', 'REJECTED', 'CANCELLED'
  rejection_reason TEXT,
  commission DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  submitted_at TIMESTAMP,
  filled_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  metadata JSONB,                    -- Store broker-specific data
  CONSTRAINT valid_side CHECK (side IN ('BUY', 'SELL')),
  CONSTRAINT valid_status CHECK (status IN ('PENDING', 'FILLED', 'PARTIAL', 'REJECTED', 'CANCELLED'))
);

CREATE INDEX idx_orders_user ON executed_orders(user_id);
CREATE INDEX idx_orders_broker ON executed_orders(broker_account_id);
CREATE INDEX idx_orders_symbol ON executed_orders(symbol);
CREATE INDEX idx_orders_status ON executed_orders(status);
CREATE INDEX idx_orders_created ON executed_orders(created_at DESC);
```

**Checklist:**
- [ ] Create migration file
- [ ] Add indexes for query optimization
- [ ] Add constraints for data integrity
- [ ] Test with sample data

#### 1.1.3 positions
```sql
CREATE TABLE positions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  broker_account_id INTEGER REFERENCES broker_accounts(id),
  symbol VARCHAR(20) NOT NULL,
  market VARCHAR(10) NOT NULL,
  quantity INTEGER NOT NULL,
  avg_entry_price DECIMAL(10,2) NOT NULL,
  current_price DECIMAL(10,2),
  unrealized_pl DECIMAL(10,2),
  unrealized_pl_percent DECIMAL(10,2),
  entry_date DATE NOT NULL,
  entry_order_id INTEGER REFERENCES executed_orders(id),
  days_held INTEGER GENERATED ALWAYS AS (
    EXTRACT(DAY FROM (NOW() - entry_date))
  ) STORED,
  signal_metadata JSONB,             -- DTI values, win rate, etc.
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(broker_account_id, symbol)
);

CREATE INDEX idx_positions_user ON positions(user_id);
CREATE INDEX idx_positions_broker ON positions(broker_account_id);
CREATE INDEX idx_positions_days_held ON positions(days_held);
```

**Checklist:**
- [ ] Create migration file
- [ ] Add computed column for days_held
- [ ] Add unique constraint to prevent duplicates
- [ ] Test position updates

#### 1.1.4 trade_logs
```sql
CREATE TABLE trade_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  broker_account_id INTEGER REFERENCES broker_accounts(id),
  event_type VARCHAR(50) NOT NULL,   -- 'SIGNAL_GENERATED', 'ORDER_PLACED', 'ORDER_FILLED', 'ERROR', 'KILL_SWITCH'
  severity VARCHAR(20) DEFAULT 'INFO', -- 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'
  message TEXT,
  data JSONB,                        -- Full event data
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_severity CHECK (severity IN ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'))
);

CREATE INDEX idx_logs_user ON trade_logs(user_id);
CREATE INDEX idx_logs_event ON trade_logs(event_type);
CREATE INDEX idx_logs_severity ON trade_logs(severity);
CREATE INDEX idx_logs_created ON trade_logs(created_at DESC);
```

**Checklist:**
- [ ] Create migration file
- [ ] Add log retention policy (delete after 90 days)
- [ ] Create view for recent errors
- [ ] Test log insertion performance

---

## Task 1.2: Broker Abstraction Layer 🏗️
**Priority:** CRITICAL | **Estimated Time:** 4 hours

### File Structure
```
lib/
├── brokers/
│   ├── base-broker.js              # Abstract base class
│   ├── trading212-client.js        # Trading212 implementation
│   ├── iifl-client.js              # IIFL Blaze implementation
│   └── broker-factory.js           # Factory pattern for instantiation
├── services/
│   ├── trade-executor.js           # Main execution service
│   ├── order-manager.js            # Order lifecycle management
│   ├── position-tracker.js         # Position sync & monitoring
│   └── signal-processor.js         # Signal validation & routing
└── utils/
    ├── encryption.js               # API key encryption/decryption
    ├── rate-limiter.js             # API rate limit handling
    └── error-handler.js            # Centralized error handling
```

### 1.2.1 Base Broker Interface
**File:** `lib/brokers/base-broker.js`

```javascript
/**
 * Abstract Base Class for Broker Integrations
 * Defines the contract that all brokers must implement
 */
class BaseBroker {
  constructor(config) {
    if (this.constructor === BaseBroker) {
      throw new Error("Cannot instantiate abstract class");
    }
    this.config = config;
    this.isAuthenticated = false;
  }

  /**
   * Authenticate with broker API
   * @returns {Promise<boolean>} Success status
   */
  async authenticate() {
    throw new Error("Method 'authenticate()' must be implemented");
  }

  /**
   * Place a market order
   * @param {Object} order - { symbol, side, quantity }
   * @returns {Promise<Object>} Order confirmation
   */
  async placeMarketOrder(order) {
    throw new Error("Method 'placeMarketOrder()' must be implemented");
  }

  /**
   * Get current positions
   * @returns {Promise<Array>} List of positions
   */
  async getPositions() {
    throw new Error("Method 'getPositions()' must be implemented");
  }

  /**
   * Get order status
   * @param {string} orderId - Broker's order ID
   * @returns {Promise<Object>} Order status
   */
  async getOrderStatus(orderId) {
    throw new Error("Method 'getOrderStatus()' must be implemented");
  }

  /**
   * Cancel an order
   * @param {string} orderId - Broker's order ID
   * @returns {Promise<boolean>} Success status
   */
  async cancelOrder(orderId) {
    throw new Error("Method 'cancelOrder()' must be implemented");
  }

  /**
   * Get account balance
   * @returns {Promise<Object>} Balance info
   */
  async getAccountBalance() {
    throw new Error("Method 'getAccountBalance()' must be implemented");
  }

  /**
   * Validate order before submission
   * @param {Object} order - Order details
   * @returns {Object} { valid: boolean, errors: [] }
   */
  validateOrder(order) {
    const errors = [];

    if (!order.symbol) errors.push('Symbol is required');
    if (!order.side || !['BUY', 'SELL'].includes(order.side)) {
      errors.push('Side must be BUY or SELL');
    }
    if (!order.quantity || order.quantity <= 0) {
      errors.push('Quantity must be positive');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Health check - verify broker connection
   * @returns {Promise<boolean>} Connection status
   */
  async healthCheck() {
    try {
      await this.getAccountBalance();
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = BaseBroker;
```

**Checklist:**
- [ ] Create base-broker.js
- [ ] Define all required methods
- [ ] Add JSDoc documentation
- [ ] Create unit tests for validation methods
- [ ] Document expected return types

---

## Task 1.3: Security & Encryption 🔒
**Priority:** CRITICAL | **Estimated Time:** 2 hours

### 1.3.1 Environment Variables
**File:** `.env.template` (create this, DO NOT commit real .env)

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/signalforge

# Encryption
API_ENCRYPTION_KEY=your-32-byte-base64-key-here  # Generate with: openssl rand -base64 32

# Trading212 Configuration
TRADING212_API_KEY=
TRADING212_API_SECRET=
TRADING212_API_URL=https://demo.trading212.com/api/v0  # or live.trading212.com

# IIFL Configuration
IIFL_API_KEY=
IIFL_API_SECRET=
IIFL_CLIENT_CODE=
IIFL_API_URL=https://ttblaze.iifl.com

# Safety Limits
MAX_POSITIONS_TOTAL=30
MAX_POSITIONS_PER_MARKET=10
MAX_ORDERS_PER_DAY=50
MAX_DAILY_LOSS_PERCENT=5
ENABLE_AUTO_TRADING=false  # Master kill switch

# Monitoring
NOTIFICATION_EMAIL=your-email@example.com
TELEGRAM_BOT_TOKEN=  # Optional
TELEGRAM_CHAT_ID=    # Optional

# Market Hours (UTC)
MARKET_HOURS_UK_OPEN=08:00
MARKET_HOURS_UK_CLOSE=16:30
MARKET_HOURS_US_OPEN=14:30
MARKET_HOURS_US_CLOSE=21:00
MARKET_HOURS_INDIA_OPEN=03:45
MARKET_HOURS_INDIA_CLOSE=10:00
```

**Checklist:**
- [ ] Create .env.template
- [ ] Add .env to .gitignore
- [ ] Generate encryption key
- [ ] Document each variable

### 1.3.2 Encryption Utility
**File:** `lib/utils/encryption.js`

```javascript
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.API_ENCRYPTION_KEY, 'base64');

/**
 * Encrypt sensitive data (API keys, secrets)
 * @param {string} text - Plain text to encrypt
 * @returns {string} Encrypted text with IV and auth tag
 */
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 * @param {string} encryptedText - Encrypted text with IV and auth tag
 * @returns {string} Decrypted plain text
 */
function decrypt(encryptedText) {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

module.exports = { encrypt, decrypt };
```

**Checklist:**
- [ ] Create encryption.js
- [ ] Test encryption/decryption
- [ ] Handle errors gracefully
- [ ] Add key rotation support (future)

---

## Task 1.4: Error Handling Framework 🚨
**Priority:** HIGH | **Estimated Time:** 2 hours

### 1.4.1 Custom Error Classes
**File:** `lib/utils/errors.js`

```javascript
class TradingError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
  }
}

class BrokerAPIError extends TradingError {
  constructor(message, broker, statusCode, details) {
    super(message, 'BROKER_API_ERROR', { broker, statusCode, ...details });
  }
}

class OrderRejectionError extends TradingError {
  constructor(message, reason, order) {
    super(message, 'ORDER_REJECTED', { reason, order });
  }
}

class InsufficientFundsError extends TradingError {
  constructor(required, available, broker) {
    super(
      `Insufficient funds: required ${required}, available ${available}`,
      'INSUFFICIENT_FUNDS',
      { required, available, broker }
    );
  }
}

class PositionLimitError extends TradingError {
  constructor(current, max, market) {
    super(
      `Position limit reached: ${current}/${max} in ${market}`,
      'POSITION_LIMIT',
      { current, max, market }
    );
  }
}

class CircuitBreakerError extends TradingError {
  constructor(reason, threshold) {
    super(
      `Circuit breaker triggered: ${reason}`,
      'CIRCUIT_BREAKER',
      { reason, threshold }
    );
  }
}

module.exports = {
  TradingError,
  BrokerAPIError,
  OrderRejectionError,
  InsufficientFundsError,
  PositionLimitError,
  CircuitBreakerError
};
```

**Checklist:**
- [ ] Create error classes
- [ ] Add to centralized error handler
- [ ] Log all errors to trade_logs
- [ ] Send critical errors to notifications

---

## Phase 1 Completion Checklist

### Database
- [ ] All 4 tables created
- [ ] Migration files tested
- [ ] Rollback scripts verified
- [ ] Sample data inserted for testing

### Code Structure
- [ ] Base broker class created
- [ ] Broker factory implemented
- [ ] Encryption utilities working
- [ ] Error classes defined

### Security
- [ ] .env.template created
- [ ] Encryption key generated
- [ ] API keys encrypted in database
- [ ] Security audit completed

### Testing
- [ ] Unit tests for encryption (>90% coverage)
- [ ] Database schema validation
- [ ] Error handling tests
- [ ] Performance benchmarks

### Documentation
- [ ] README updated with setup instructions
- [ ] API documentation started
- [ ] Database schema documented
- [ ] Security practices documented

---

# PHASE 2: Trading212 Integration
**Timeline:** Week 3-4 (15-20 hours)
**Status:** 🔴 NOT STARTED

## Objectives
- Implement Trading212 API client
- Support UK & US stock orders
- Handle demo/live environment switching
- Implement order tracking & status updates
- Test thoroughly in demo mode

---

## Task 2.1: Trading212 Client Implementation 📡
**Priority:** CRITICAL | **Estimated Time:** 8 hours

### 2.1.1 Install Dependencies
```bash
npm install trading212-api axios axios-retry
```

**Checklist:**
- [ ] Install trading212-api package
- [ ] Add to package.json
- [ ] Update package-lock.json
- [ ] Test import in Node.js

### 2.1.2 Trading212 Client Class
**File:** `lib/brokers/trading212-client.js`

```javascript
const BaseBroker = require('./base-broker');
const axios = require('axios');
const axiosRetry = require('axios-retry');

class Trading212Client extends BaseBroker {
  constructor(config) {
    super(config);
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.baseURL = config.baseURL; // demo or live
    this.client = this.createClient();
  }

  createClient() {
    const client = axios.create({
      baseURL: this.baseURL,
      auth: {
        username: this.apiKey,
        password: this.apiSecret
      },
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 seconds
    });

    // Retry on network errors or 5xx responses
    axiosRetry(client, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               (error.response && error.response.status >= 500);
      }
    });

    return client;
  }

  async authenticate() {
    try {
      // Test authentication by fetching account info
      const response = await this.client.get('/account/cash');
      this.isAuthenticated = true;
      console.log('[Trading212] Authentication successful');
      return true;
    } catch (error) {
      console.error('[Trading212] Authentication failed:', error.message);
      this.isAuthenticated = false;
      throw new BrokerAPIError(
        'Trading212 authentication failed',
        'trading212',
        error.response?.status,
        { error: error.message }
      );
    }
  }

  async placeMarketOrder(order) {
    const validation = this.validateOrder(order);
    if (!validation.valid) {
      throw new OrderRejectionError(
        'Order validation failed',
        validation.errors.join(', '),
        order
      );
    }

    // Trading212 API format
    const payload = {
      ticker: order.symbol,
      quantity: order.quantity,
      // Note: Trading212 beta API only supports MARKET orders
      timeValidity: 'DAY'
    };

    try {
      const endpoint = order.side === 'BUY'
        ? '/equity/orders/market/buy'
        : '/equity/orders/market/sell';

      const response = await this.client.post(endpoint, payload);

      console.log(`[Trading212] ${order.side} order placed:`, response.data);

      return {
        brokerOrderId: response.data.id,
        status: 'PENDING',
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('[Trading212] Order placement failed:', error.message);
      throw new BrokerAPIError(
        'Trading212 order placement failed',
        'trading212',
        error.response?.status,
        {
          error: error.message,
          order: payload
        }
      );
    }
  }

  async getPositions() {
    try {
      const response = await this.client.get('/equity/portfolio');

      return response.data.map(position => ({
        symbol: position.ticker,
        quantity: position.quantity,
        avgEntryPrice: position.averagePrice,
        currentPrice: position.currentPrice,
        unrealizedPL: position.ppl,
        unrealizedPLPercent: (position.ppl / (position.averagePrice * position.quantity)) * 100,
        market: this.determineMarket(position.ticker)
      }));
    } catch (error) {
      console.error('[Trading212] Failed to fetch positions:', error.message);
      throw new BrokerAPIError(
        'Failed to fetch Trading212 positions',
        'trading212',
        error.response?.status,
        { error: error.message }
      );
    }
  }

  async getOrderStatus(orderId) {
    try {
      const response = await this.client.get(`/equity/orders/${orderId}`);

      return {
        brokerOrderId: response.data.id,
        status: this.mapOrderStatus(response.data.status),
        filledQuantity: response.data.filledQuantity || 0,
        filledPrice: response.data.fillPrice,
        timestamp: new Date(response.data.dateCreated)
      };
    } catch (error) {
      console.error('[Trading212] Failed to fetch order status:', error.message);
      throw new BrokerAPIError(
        'Failed to fetch Trading212 order status',
        'trading212',
        error.response?.status,
        { error: error.message, orderId }
      );
    }
  }

  async cancelOrder(orderId) {
    try {
      await this.client.delete(`/equity/orders/${orderId}`);
      console.log(`[Trading212] Order ${orderId} cancelled`);
      return true;
    } catch (error) {
      console.error('[Trading212] Failed to cancel order:', error.message);
      return false;
    }
  }

  async getAccountBalance() {
    try {
      const response = await this.client.get('/account/cash');

      return {
        currency: 'GBP', // Trading212 UK accounts
        total: response.data.total,
        free: response.data.free,
        blocked: response.data.blocked,
        invested: response.data.invested,
        ppl: response.data.ppl // Profit/Loss
      };
    } catch (error) {
      console.error('[Trading212] Failed to fetch balance:', error.message);
      throw new BrokerAPIError(
        'Failed to fetch Trading212 balance',
        'trading212',
        error.response?.status,
        { error: error.message }
      );
    }
  }

  mapOrderStatus(t212Status) {
    const statusMap = {
      'NEW': 'PENDING',
      'FILLED': 'FILLED',
      'PARTIALLY_FILLED': 'PARTIAL',
      'CANCELLED': 'CANCELLED',
      'REJECTED': 'REJECTED'
    };
    return statusMap[t212Status] || 'UNKNOWN';
  }

  determineMarket(symbol) {
    // Simple heuristic - improve as needed
    if (symbol.endsWith('.L')) return 'UK';
    return 'US'; // Default to US for NYSE/NASDAQ
  }
}

module.exports = Trading212Client;
```

**Checklist:**
- [ ] Implement all BaseBroker methods
- [ ] Add retry logic for network failures
- [ ] Handle rate limits (Trading212 has strict limits)
- [ ] Test authentication
- [ ] Test order placement in demo
- [ ] Test position fetching
- [ ] Add comprehensive error handling
- [ ] Log all API calls

---

## Task 2.2: Trading212 Testing Suite 🧪
**Priority:** HIGH | **Estimated Time:** 4 hours

### 2.2.1 Unit Tests
**File:** `test/brokers/trading212-client.test.js`

```javascript
const Trading212Client = require('../../lib/brokers/trading212-client');
const { expect } = require('chai');

describe('Trading212Client', () => {
  let client;

  before(() => {
    client = new Trading212Client({
      apiKey: process.env.TRADING212_API_KEY,
      apiSecret: process.env.TRADING212_API_SECRET,
      baseURL: 'https://demo.trading212.com/api/v0' // Use demo
    });
  });

  describe('Authentication', () => {
    it('should authenticate successfully with valid credentials', async () => {
      const result = await client.authenticate();
      expect(result).to.be.true;
      expect(client.isAuthenticated).to.be.true;
    });

    it('should throw error with invalid credentials', async () => {
      const badClient = new Trading212Client({
        apiKey: 'invalid',
        apiSecret: 'invalid',
        baseURL: 'https://demo.trading212.com/api/v0'
      });

      try {
        await badClient.authenticate();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.name).to.equal('BrokerAPIError');
      }
    });
  });

  describe('Order Validation', () => {
    it('should validate correct order', () => {
      const order = {
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 10
      };
      const result = client.validateOrder(order);
      expect(result.valid).to.be.true;
    });

    it('should reject order without symbol', () => {
      const order = {
        side: 'BUY',
        quantity: 10
      };
      const result = client.validateOrder(order);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Symbol is required');
    });
  });

  describe('Market Order Placement', () => {
    it('should place BUY market order', async () => {
      const order = {
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 1
      };

      const result = await client.placeMarketOrder(order);
      expect(result).to.have.property('brokerOrderId');
      expect(result.status).to.equal('PENDING');
      expect(result.symbol).to.equal('AAPL');
    });

    // Add more tests for SELL, error cases, etc.
  });

  describe('Position Fetching', () => {
    it('should fetch current positions', async () => {
      const positions = await client.getPositions();
      expect(positions).to.be.an('array');
      // Positions may be empty in demo
    });
  });

  describe('Account Balance', () => {
    it('should fetch account balance', async () => {
      const balance = await client.getAccountBalance();
      expect(balance).to.have.property('total');
      expect(balance).to.have.property('free');
      expect(balance.currency).to.equal('GBP');
    });
  });
});
```

**Checklist:**
- [ ] Write authentication tests
- [ ] Write order placement tests
- [ ] Write position fetching tests
- [ ] Write error handling tests
- [ ] Achieve >80% code coverage
- [ ] Test with demo account
- [ ] Document test setup

---

## Task 2.3: Trading212 Integration Testing 🔬
**Priority:** HIGH | **Estimated Time:** 4 hours

### 2.3.1 End-to-End Test Script
**File:** `scripts/test-trading212-integration.js`

```javascript
const Trading212Client = require('../lib/brokers/trading212-client');
const db = require('../config/database');

async function testTrading212Integration() {
  console.log('=== Trading212 Integration Test ===\n');

  // 1. Initialize client
  console.log('1. Initializing Trading212 client...');
  const client = new Trading212Client({
    apiKey: process.env.TRADING212_API_KEY,
    apiSecret: process.env.TRADING212_API_SECRET,
    baseURL: process.env.TRADING212_API_URL
  });

  try {
    // 2. Authenticate
    console.log('2. Authenticating...');
    await client.authenticate();
    console.log('   ✅ Authentication successful\n');

    // 3. Check account balance
    console.log('3. Fetching account balance...');
    const balance = await client.getAccountBalance();
    console.log('   Balance:', balance);
    console.log(`   Free cash: £${balance.free}\n`);

    // 4. Fetch existing positions
    console.log('4. Fetching existing positions...');
    const positions = await client.getPositions();
    console.log(`   Current positions: ${positions.length}`);
    positions.forEach(pos => {
      console.log(`   - ${pos.symbol}: ${pos.quantity} @ £${pos.avgEntryPrice}`);
    });
    console.log();

    // 5. Test order placement (use small quantity for safety)
    console.log('5. Testing order placement (1 share of AAPL)...');
    const testOrder = {
      symbol: 'AAPL',
      side: 'BUY',
      quantity: 1
    };

    const orderResult = await client.placeMarketOrder(testOrder);
    console.log('   ✅ Order placed:', orderResult);
    console.log(`   Order ID: ${orderResult.brokerOrderId}\n`);

    // 6. Wait 5 seconds then check order status
    console.log('6. Waiting 5 seconds for order to fill...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const orderStatus = await client.getOrderStatus(orderResult.brokerOrderId);
    console.log('   Order status:', orderStatus);
    console.log(`   Status: ${orderStatus.status}`);
    console.log(`   Filled: ${orderStatus.filledQuantity}\n`);

    // 7. Cancel order if still pending
    if (orderStatus.status === 'PENDING') {
      console.log('7. Cancelling pending order...');
      await client.cancelOrder(orderResult.brokerOrderId);
      console.log('   ✅ Order cancelled\n');
    }

    // 8. Health check
    console.log('8. Running health check...');
    const isHealthy = await client.healthCheck();
    console.log(`   Health status: ${isHealthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}\n`);

    console.log('=== All tests passed! ===');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('   Details:', error);
  }
}

// Run if called directly
if (require.main === module) {
  testTrading212Integration()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = testTrading212Integration;
```

**Checklist:**
- [ ] Test authentication flow
- [ ] Test balance fetching
- [ ] Test position sync
- [ ] Test order placement
- [ ] Test order status tracking
- [ ] Test order cancellation
- [ ] Test error scenarios
- [ ] Document results

---

## Phase 2 Completion Checklist

### Implementation
- [ ] Trading212Client fully implemented
- [ ] All BaseBroker methods working
- [ ] Error handling comprehensive
- [ ] Logging in place

### Testing
- [ ] Unit tests passing (>80% coverage)
- [ ] Integration tests successful
- [ ] Demo account tested
- [ ] Edge cases handled

### Documentation
- [ ] API methods documented
- [ ] Error codes documented
- [ ] Setup guide written
- [ ] Troubleshooting guide created

### Validation
- [ ] Can authenticate
- [ ] Can place orders
- [ ] Can fetch positions
- [ ] Can check order status
- [ ] Can cancel orders
- [ ] Handles network errors
- [ ] Respects rate limits

---

# PHASE 3: IIFL Integration
**Timeline:** Week 5-6 (20-25 hours)
**Status:** 🔴 NOT STARTED

## Objectives
- Implement IIFL Blaze API client
- Support Indian stock orders (NSE/BSE)
- Handle session management & authentication
- Implement WebSocket for real-time updates
- Test thoroughly in IIFL test environment

---

## Task 3.1: IIFL Research & Setup 📚
**Priority:** CRITICAL | **Estimated Time:** 3 hours

### 3.1.1 IIFL Account Setup

**Steps:**
1. Open IIFL Demat account (if not already done)
2. Email rms.trading@iiflsecurities.com with:
   - Subject: "API Access Request - Client ID: [YOUR_ID]"
   - Request: XTS API activation for algorithmic trading
   - Purpose: Automated trading based on technical indicators
3. Wait for API credentials (3-5 business days)
4. Access IIFL Blaze dashboard: https://ttblaze.iifl.com

**Checklist:**
- [ ] IIFL account opened
- [ ] API access requested
- [ ] Credentials received
- [ ] Test environment access confirmed
- [ ] Documentation downloaded

### 3.1.2 IIFL API Documentation Review

**Key Resources:**
- API Portal: https://api.iiflsecurities.com/
- Blaze Documentation: https://ttblaze.iifl.com/doc/
- Market Data API: https://ttblaze.iifl.com/doc/marketdata/
- Interactive API: https://ttblaze.iifl.com/doc/interactive/

**Checklist:**
- [ ] Read authentication flow
- [ ] Understand order types
- [ ] Review position tracking
- [ ] Check rate limits
- [ ] Note exchange codes (NSE vs BSE)

---

## Task 3.2: IIFL Client Implementation 📡
**Priority:** CRITICAL | **Estimated Time:** 12 hours

### 3.2.1 Install Dependencies
```bash
npm install axios ws
```

### 3.2.2 IIFL Client Class
**File:** `lib/brokers/iifl-client.js`

```javascript
const BaseBroker = require('./base-broker');
const axios = require('axios');
const WebSocket = require('ws');
const crypto = require('crypto');

class IIFLClient extends BaseBroker {
  constructor(config) {
    super(config);
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.clientCode = config.clientCode;
    this.baseURL = config.baseURL; // https://ttblaze.iifl.com
    this.token = null;
    this.ws = null;
  }

  /**
   * IIFL uses session-based authentication
   * Generate token that expires after 24 hours
   */
  async authenticate() {
    try {
      // Step 1: Login to get session token
      const loginPayload = {
        secretKey: this.apiSecret,
        appKey: this.apiKey,
        source: 'WebAPI'
      };

      const response = await axios.post(
        `${this.baseURL}/interactive/user/session`,
        loginPayload,
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (response.data.type === 'success') {
        this.token = response.data.result.token;
        this.isAuthenticated = true;
        console.log('[IIFL] Authentication successful');

        // Auto-refresh token before expiry (23 hours)
        this.scheduleTokenRefresh();

        return true;
      } else {
        throw new Error(response.data.description || 'Authentication failed');
      }
    } catch (error) {
      console.error('[IIFL] Authentication failed:', error.message);
      this.isAuthenticated = false;
      throw new BrokerAPIError(
        'IIFL authentication failed',
        'iifl',
        error.response?.status,
        { error: error.message }
      );
    }
  }

  scheduleTokenRefresh() {
    // Refresh token after 23 hours (1 hour before expiry)
    setTimeout(() => {
      console.log('[IIFL] Refreshing authentication token...');
      this.authenticate();
    }, 23 * 60 * 60 * 1000);
  }

  /**
   * Make authenticated API call
   */
  async apiCall(method, endpoint, data = null) {
    if (!this.token) {
      throw new Error('Not authenticated - call authenticate() first');
    }

    const config = {
      method,
      url: `${this.baseURL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.token
      }
    };

    if (data) {
      config.data = data;
    }

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error(`[IIFL] API call failed: ${method} ${endpoint}`, error.message);
      throw new BrokerAPIError(
        `IIFL API call failed: ${endpoint}`,
        'iifl',
        error.response?.status,
        { error: error.message, endpoint }
      );
    }
  }

  async placeMarketOrder(order) {
    const validation = this.validateOrder(order);
    if (!validation.valid) {
      throw new OrderRejectionError(
        'Order validation failed',
        validation.errors.join(', '),
        order
      );
    }

    // IIFL order payload
    const payload = {
      exchangeSegment: this.getExchangeSegment(order.symbol),
      exchangeInstrumentID: await this.getInstrumentId(order.symbol),
      productType: 'NRML', // Normal (intraday would be 'MIS')
      orderType: 'MARKET',
      orderSide: order.side === 'BUY' ? 'Buy' : 'Sell',
      timeInForce: 'DAY',
      disclosedQuantity: 0,
      orderQuantity: order.quantity,
      limitPrice: 0,
      stopPrice: 0,
      orderUniqueIdentifier: this.generateOrderId()
    };

    try {
      const result = await this.apiCall(
        'POST',
        '/interactive/orders',
        payload
      );

      if (result.type === 'success') {
        console.log(`[IIFL] ${order.side} order placed:`, result);

        return {
          brokerOrderId: result.result.AppOrderID,
          status: 'PENDING',
          symbol: order.symbol,
          side: order.side,
          quantity: order.quantity,
          timestamp: new Date()
        };
      } else {
        throw new OrderRejectionError(
          'IIFL order rejected',
          result.description,
          order
        );
      }
    } catch (error) {
      console.error('[IIFL] Order placement failed:', error.message);
      throw error;
    }
  }

  async getPositions() {
    try {
      const result = await this.apiCall('GET', '/interactive/portfolio/positions');

      if (result.type === 'success') {
        return result.result.map(position => ({
          symbol: this.parseSymbol(position.TradingSymbol),
          quantity: position.Quantity,
          avgEntryPrice: position.BuyAveragePrice || position.SellAveragePrice,
          currentPrice: position.LastTradedPrice,
          unrealizedPL: position.RealizedProfitLoss + position.UnrealizedProfitLoss,
          unrealizedPLPercent: ((position.LastTradedPrice - position.BuyAveragePrice) / position.BuyAveragePrice) * 100,
          market: 'India',
          exchange: position.ExchangeSegment
        }));
      } else {
        throw new Error(result.description || 'Failed to fetch positions');
      }
    } catch (error) {
      console.error('[IIFL] Failed to fetch positions:', error.message);
      throw new BrokerAPIError(
        'Failed to fetch IIFL positions',
        'iifl',
        error.response?.status,
        { error: error.message }
      );
    }
  }

  async getOrderStatus(orderId) {
    try {
      const result = await this.apiCall('GET', `/interactive/orders?appOrderID=${orderId}`);

      if (result.type === 'success' && result.result.length > 0) {
        const order = result.result[0];

        return {
          brokerOrderId: order.AppOrderID,
          status: this.mapOrderStatus(order.OrderStatus),
          filledQuantity: order.CumulativeQuantity || 0,
          filledPrice: order.OrderAverageTradedPrice,
          timestamp: new Date(order.ExchangeTransactTime)
        };
      } else {
        throw new Error('Order not found');
      }
    } catch (error) {
      console.error('[IIFL] Failed to fetch order status:', error.message);
      throw new BrokerAPIError(
        'Failed to fetch IIFL order status',
        'iifl',
        error.response?.status,
        { error: error.message, orderId }
      );
    }
  }

  async cancelOrder(orderId) {
    try {
      const result = await this.apiCall('DELETE', `/interactive/orders?appOrderID=${orderId}`);

      if (result.type === 'success') {
        console.log(`[IIFL] Order ${orderId} cancelled`);
        return true;
      } else {
        console.error(`[IIFL] Failed to cancel order: ${result.description}`);
        return false;
      }
    } catch (error) {
      console.error('[IIFL] Failed to cancel order:', error.message);
      return false;
    }
  }

  async getAccountBalance() {
    try {
      const result = await this.apiCall('GET', '/interactive/user/balance');

      if (result.type === 'success') {
        const balance = result.result;

        return {
          currency: 'INR',
          total: balance.availableBalance + balance.blockedAmount,
          free: balance.availableBalance,
          blocked: balance.blockedAmount,
          invested: balance.realizedMTM + balance.unrealizedMTM,
          ppl: balance.realizedPnl + balance.unrealizedPnl
        };
      } else {
        throw new Error(result.description || 'Failed to fetch balance');
      }
    } catch (error) {
      console.error('[IIFL] Failed to fetch balance:', error.message);
      throw new BrokerAPIError(
        'Failed to fetch IIFL balance',
        'iifl',
        error.response?.status,
        { error: error.message }
      );
    }
  }

  /**
   * Get exchange segment for symbol
   * @param {string} symbol - Stock symbol (e.g., 'RELIANCE.NS')
   */
  getExchangeSegment(symbol) {
    if (symbol.endsWith('.NS')) return 'NSECM'; // NSE Capital Market
    if (symbol.endsWith('.BO')) return 'BSECM'; // BSE Capital Market
    return 'NSECM'; // Default to NSE
  }

  /**
   * Get instrument ID for symbol (required by IIFL)
   * This requires querying IIFL's master data or maintaining a cache
   */
  async getInstrumentId(symbol) {
    // TODO: Implement instrument ID lookup
    // For now, return mock - need to build master data cache
    // IIFL provides master data download: /interactive/instruments/master

    console.warn('[IIFL] Using mock instrument ID - implement master data lookup');
    return 12345; // Placeholder
  }

  parseSymbol(tradingSymbol) {
    // Convert IIFL's trading symbol back to our format
    // E.g., "RELIANCE-EQ" -> "RELIANCE.NS"
    const base = tradingSymbol.split('-')[0];
    return `${base}.NS`; // Assume NSE for now
  }

  generateOrderId() {
    // Generate unique order identifier
    return `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  mapOrderStatus(iiflStatus) {
    const statusMap = {
      'New': 'PENDING',
      'PartiallyFilled': 'PARTIAL',
      'Filled': 'FILLED',
      'Cancelled': 'CANCELLED',
      'Rejected': 'REJECTED',
      'Replaced': 'PENDING'
    };
    return statusMap[iiflStatus] || 'UNKNOWN';
  }

  /**
   * Connect to IIFL WebSocket for real-time updates
   * (Optional but recommended for live trading)
   */
  async connectWebSocket() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[IIFL] WebSocket already connected');
      return;
    }

    const wsUrl = `${this.baseURL.replace('https', 'wss')}/interactive/market`;

    this.ws = new WebSocket(wsUrl, {
      headers: {
        'Authorization': this.token
      }
    });

    this.ws.on('open', () => {
      console.log('[IIFL] WebSocket connected');
    });

    this.ws.on('message', (data) => {
      const message = JSON.parse(data);
      this.handleWebSocketMessage(message);
    });

    this.ws.on('error', (error) => {
      console.error('[IIFL] WebSocket error:', error);
    });

    this.ws.on('close', () => {
      console.log('[IIFL] WebSocket closed - will reconnect');
      // Auto-reconnect after 5 seconds
      setTimeout(() => this.connectWebSocket(), 5000);
    });
  }

  handleWebSocketMessage(message) {
    // Handle real-time market data or order updates
    console.log('[IIFL] WebSocket message:', message);
    // TODO: Implement message handling
  }
}

module.exports = IIFLClient;
```

**Checklist:**
- [ ] Implement session authentication
- [ ] Handle token refresh (24-hour expiry)
- [ ] Implement all BaseBroker methods
- [ ] Add instrument ID lookup (master data)
- [ ] Handle NSE vs BSE symbol differences
- [ ] Implement WebSocket connection (optional)
- [ ] Add comprehensive error handling
- [ ] Test with IIFL test environment

---

## Task 3.3: IIFL Master Data Manager 📊
**Priority:** HIGH | **Estimated Time:** 4 hours

**File:** `lib/brokers/iifl-master-data.js`

```javascript
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

/**
 * Manages IIFL instrument master data
 * Downloads and caches symbol-to-instrumentID mappings
 */
class IIFLMasterData {
  constructor(token, baseURL) {
    this.token = token;
    this.baseURL = baseURL;
    this.cache = new Map();
    this.cacheFile = path.join(__dirname, '../../data/iifl-instruments.json');
  }

  /**
   * Download master data from IIFL
   */
  async downloadMasterData() {
    try {
      console.log('[IIFL] Downloading master data...');

      const response = await axios.get(
        `${this.baseURL}/interactive/master`,
        {
          headers: { 'Authorization': this.token }
        }
      );

      const instruments = response.data.result;
      console.log(`[IIFL] Downloaded ${instruments.length} instruments`);

      // Build cache: symbol -> instrumentID
      instruments.forEach(inst => {
        const symbol = this.normalizeSymbol(inst.Name, inst.ExchangeSegment);
        this.cache.set(symbol, {
          instrumentID: inst.ExchangeInstrumentID,
          name: inst.Name,
          exchange: inst.ExchangeSegment,
          series: inst.Series,
          tickSize: inst.TickSize,
          lotSize: inst.LotSize
        });
      });

      // Save to disk
      await this.saveCacheToFile();

      return instruments.length;
    } catch (error) {
      console.error('[IIFL] Failed to download master data:', error.message);
      throw error;
    }
  }

  /**
   * Load cached master data from file
   */
  async loadCacheFromFile() {
    try {
      const data = await fs.readFile(this.cacheFile, 'utf8');
      const cacheData = JSON.parse(data);

      this.cache = new Map(Object.entries(cacheData.instruments));
      console.log(`[IIFL] Loaded ${this.cache.size} instruments from cache`);

      return true;
    } catch (error) {
      console.log('[IIFL] No cached master data found');
      return false;
    }
  }

  /**
   * Save cache to file
   */
  async saveCacheToFile() {
    try {
      const cacheData = {
        lastUpdated: new Date().toISOString(),
        instruments: Object.fromEntries(this.cache)
      };

      await fs.writeFile(
        this.cacheFile,
        JSON.stringify(cacheData, null, 2),
        'utf8'
      );

      console.log('[IIFL] Master data cache saved');
    } catch (error) {
      console.error('[IIFL] Failed to save cache:', error.message);
    }
  }

  /**
   * Get instrument ID for symbol
   */
  getInstrumentId(symbol) {
    const normalized = this.normalizeSymbol(symbol);
    const instrument = this.cache.get(normalized);

    if (!instrument) {
      throw new Error(`Instrument not found: ${symbol}`);
    }

    return instrument.instrumentID;
  }

  /**
   * Normalize symbol format
   */
  normalizeSymbol(symbol, exchange = 'NSECM') {
    // Convert "RELIANCE.NS" to "RELIANCE-EQ-NSECM" format
    let base = symbol.replace(/\.(NS|BO)$/, '');

    if (exchange.includes('NSE')) {
      return `${base}-EQ-NSECM`;
    } else if (exchange.includes('BSE')) {
      return `${base}-EQ-BSECM`;
    }

    return base;
  }

  /**
   * Check if cache needs refresh (older than 7 days)
   */
  async isCacheStale() {
    try {
      const stats = await fs.stat(this.cacheFile);
      const ageInDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
      return ageInDays > 7;
    } catch (error) {
      return true; // No cache file = stale
    }
  }
}

module.exports = IIFLMasterData;
```

**Checklist:**
- [ ] Implement master data download
- [ ] Create caching mechanism
- [ ] Handle symbol normalization
- [ ] Add cache staleness check
- [ ] Test symbol-to-ID lookup
- [ ] Create data directory
- [ ] Schedule weekly refresh

---

## Phase 3 Completion Checklist

### Implementation
- [ ] IIFLClient fully implemented
- [ ] Session authentication working
- [ ] Master data management in place
- [ ] All BaseBroker methods working

### Testing
- [ ] Unit tests passing
- [ ] Integration tests successful
- [ ] Test environment validated
- [ ] Master data sync working

### Documentation
- [ ] IIFL setup guide written
- [ ] API methods documented
- [ ] Symbol format documented
- [ ] Troubleshooting guide created

### Validation
- [ ] Can authenticate & maintain session
- [ ] Can place orders on NSE
- [ ] Can fetch positions
- [ ] Can check order status
- [ ] Can cancel orders
- [ ] WebSocket connection stable
- [ ] Master data stays in sync

---

# PHASE 4: Signal-to-Order Pipeline
**Timeline:** Week 7-8 (20 hours)
**Status:** 🔴 NOT STARTED

## Objectives
- Build live signal generation from existing backtester
- Create signal validation & filtering logic
- Implement position sizing calculator
- Build order routing & execution service
- Add comprehensive logging

---

## Task 4.1: Live Signal Generator 🎯
**Priority:** CRITICAL | **Estimated Time:** 6 hours

**File:** `lib/services/signal-generator.js`

```javascript
const BacktestCalculator = require('../shared/backtest-calculator');
const db = require('../../config/database');

class SignalGenerator {
  constructor() {
    this.isRunning = false;
    this.lastCheck = null;
  }

  /**
   * Check for new signals across all high-conviction stocks
   * This should run every 15 minutes during market hours
   */
  async generateLiveSignals() {
    console.log('[Signal Generator] Checking for new signals...');

    try {
      // 1. Get list of high-conviction stocks (>75% win rate)
      const stocks = await this.getHighConvictionStocks();
      console.log(`[Signal Generator] Monitoring ${stocks.length} high-conviction stocks`);

      // 2. Fetch latest price data for all stocks
      const signals = [];

      for (const stock of stocks) {
        try {
          // Fetch last 100 days of data for DTI calculation
          const priceData = await this.fetchRecentPriceData(stock.symbol);

          // Check for entry signal
          const signal = await this.checkForEntrySignal(stock, priceData);

          if (signal) {
            signals.push(signal);
          }
        } catch (error) {
          console.error(`[Signal Generator] Error checking ${stock.symbol}:`, error.message);
        }
      }

      // 3. Log generation event
      await this.logSignalGeneration(signals.length);

      console.log(`[Signal Generator] Found ${signals.length} new signals`);
      return signals;

    } catch (error) {
      console.error('[Signal Generator] Failed to generate signals:', error);
      throw error;
    }
  }

  /**
   * Get high-conviction stocks from database
   * These were identified during historical backtest
   */
  async getHighConvictionStocks() {
    const query = `
      SELECT
        symbol,
        market,
        win_rate,
        historical_signal_count,
        avg_return
      FROM high_conviction_stocks
      WHERE win_rate > 75
        AND is_active = true
      ORDER BY win_rate DESC
    `;

    const result = await db.query(query);
    return result.rows;
  }

  /**
   * Fetch recent price data for signal detection
   */
  async fetchRecentPriceData(symbol) {
    // Use existing Yahoo Finance integration
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 100); // Last 100 days

    const response = await fetch(
      `/yahoo/history?symbol=${symbol}&period1=${Math.floor(startDate/1000)}&period2=${Math.floor(endDate/1000)}&interval=1d`
    );

    const csvText = await response.text();
    return this.parseCSV(csvText);
  }

  /**
   * Check if stock has entry signal (DTI-based)
   */
  async checkForEntrySignal(stock, priceData) {
    // Calculate DTI
    const dti = BacktestCalculator.calculateDTI(
      priceData.high,
      priceData.low,
      14, 10, 5 // r, s, u parameters
    );

    const sevenDayDTI = BacktestCalculator.calculate7DayDTI(
      priceData.dates,
      priceData.high,
      priceData.low,
      14, 10, 5
    );

    const lastIndex = dti.length - 1;
    const prevIndex = lastIndex - 1;

    const currentDTI = dti[lastIndex];
    const prevDTI = dti[prevIndex];
    const current7DayDTI = sevenDayDTI.daily7DayDTI[lastIndex];
    const prev7DayDTI = sevenDayDTI.daily7DayDTI[prevIndex];

    // Entry conditions (from backtester):
    // 1. DTI < 0 (threshold)
    // 2. DTI trending up
    // 3. 7-day DTI trending up
    const hasEntrySignal =
      currentDTI < 0 &&
      currentDTI > prevDTI &&
      current7DayDTI > prev7DayDTI;

    if (hasEntrySignal) {
      return {
        symbol: stock.symbol,
        market: stock.market,
        signalType: 'ENTRY',
        signalDate: priceData.dates[lastIndex],
        currentPrice: priceData.close[lastIndex],
        dti: {
          current: currentDTI,
          previous: prevDTI,
          current7Day: current7DayDTI,
          previous7Day: prev7DayDTI
        },
        metadata: {
          winRate: stock.win_rate,
          historicalSignalCount: stock.historical_signal_count,
          avgReturn: stock.avg_return
        },
        createdAt: new Date()
      };
    }

    return null;
  }

  /**
   * Check existing positions for exit signals
   */
  async checkExitSignals() {
    console.log('[Signal Generator] Checking for exit signals...');

    // Get all open positions
    const positions = await db.query(`
      SELECT * FROM positions
      WHERE quantity > 0
    `);

    const exitSignals = [];

    for (const position of positions.rows) {
      try {
        // Fetch recent price data
        const priceData = await this.fetchRecentPriceData(position.symbol);
        const lastPrice = priceData.close[priceData.close.length - 1];

        // Calculate current P/L
        const plPercent = ((lastPrice - position.avg_entry_price) / position.avg_entry_price) * 100;
        const daysHeld = Math.floor((new Date() - new Date(position.entry_date)) / (1000 * 60 * 60 * 24));

        // Check exit conditions
        let exitReason = null;

        if (plPercent >= 8) {
          exitReason = 'Take Profit';
        } else if (plPercent <= -5) {
          exitReason = 'Stop Loss';
        } else if (daysHeld >= 30) {
          exitReason = 'Max Days';
        } else {
          // Check 7-day DTI exit
          const dti = BacktestCalculator.calculateDTI(priceData.high, priceData.low, 14, 10, 5);
          const sevenDayDTI = BacktestCalculator.calculate7DayDTI(
            priceData.dates,
            priceData.high,
            priceData.low,
            14, 10, 5
          );

          const lastIndex = dti.length - 1;
          const current7DayDTI = sevenDayDTI.daily7DayDTI[lastIndex];
          const prev7DayDTI = sevenDayDTI.daily7DayDTI[lastIndex - 1];

          if (prev7DayDTI > 0 && current7DayDTI <= 0) {
            exitReason = '7-Day DTI Exit';
          }
        }

        if (exitReason) {
          exitSignals.push({
            positionId: position.id,
            symbol: position.symbol,
            market: position.market,
            signalType: 'EXIT',
            exitReason: exitReason,
            currentPrice: lastPrice,
            plPercent: plPercent,
            daysHeld: daysHeld,
            quantity: position.quantity,
            createdAt: new Date()
          });
        }
      } catch (error) {
        console.error(`[Signal Generator] Error checking exit for ${position.symbol}:`, error.message);
      }
    }

    console.log(`[Signal Generator] Found ${exitSignals.length} exit signals`);
    return exitSignals;
  }

  parseCSV(csvText) {
    const rows = csvText.trim().split('\n');
    const data = {
      dates: [],
      open: [],
      high: [],
      low: [],
      close: [],
      volume: []
    };

    for (let i = 1; i < rows.length; i++) {
      const values = rows[i].split(',');
      if (values.length >= 6) {
        data.dates.push(values[0]);
        data.open.push(parseFloat(values[1]));
        data.high.push(parseFloat(values[2]));
        data.low.push(parseFloat(values[3]));
        data.close.push(parseFloat(values[4]));
        data.volume.push(parseFloat(values[5]));
      }
    }

    return data;
  }

  async logSignalGeneration(signalCount) {
    await db.query(`
      INSERT INTO trade_logs (event_type, severity, message, data)
      VALUES ($1, $2, $3, $4)
    `, [
      'SIGNAL_GENERATION',
      'INFO',
      `Generated ${signalCount} new signals`,
      JSON.stringify({ count: signalCount, timestamp: new Date() })
    ]);
  }
}

module.exports = new SignalGenerator();
```

**Checklist:**
- [ ] Implement live signal detection
- [ ] Use existing DTI calculator
- [ ] Fetch recent price data
- [ ] Check entry conditions
- [ ] Check exit conditions for open positions
- [ ] Log all signal generation events
- [ ] Handle errors gracefully

---

## Task 4.2: Signal Validator & Router 🔀
**Priority:** CRITICAL | **Estimated Time:** 6 hours

**File:** `lib/services/signal-processor.js`

```javascript
const db = require('../../config/database');
const { PositionLimitError, InsufficientFundsError } = require('../utils/errors');

class SignalProcessor {
  /**
   * Process and validate signal before routing to execution
   */
  async processSignal(signal, userConfig) {
    console.log(`[Signal Processor] Processing ${signal.signalType} signal for ${signal.symbol}`);

    try {
      // 1. Validate signal
      await this.validateSignal(signal, userConfig);

      // 2. Calculate position size
      const positionSize = await this.calculatePositionSize(signal, userConfig);

      // 3. Check broker availability
      const broker = this.selectBroker(signal.market, userConfig);

      // 4. Create order object
      const order = {
        symbol: signal.symbol,
        market: signal.market,
        side: signal.signalType === 'ENTRY' ? 'BUY' : 'SELL',
        quantity: positionSize,
        price: signal.currentPrice,
        brokerName: broker.broker_name,
        brokerAccountId: broker.id,
        signalId: signal.id,
        metadata: {
          signalData: signal,
          dti: signal.dti,
          winRate: signal.metadata?.winRate
        }
      };

      console.log(`[Signal Processor] Order created:`, order);
      return order;

    } catch (error) {
      console.error(`[Signal Processor] Failed to process signal:`, error);

      // Log failure
      await this.logFailure(signal, error);

      throw error;
    }
  }

  /**
   * Validate signal against user configuration and limits
   */
  async validateSignal(signal, userConfig) {
    const userId = userConfig.userId;

    // Check if auto-trading is enabled
    if (!userConfig.enableAutoTrading) {
      throw new Error('Auto-trading is disabled');
    }

    // Check market hours
    if (!this.isMarketOpen(signal.market)) {
      throw new Error(`Market ${signal.market} is closed`);
    }

    if (signal.signalType === 'ENTRY') {
      // Check position limits
      const currentPositions = await this.getCurrentPositionCount(userId);

      if (currentPositions.total >= userConfig.maxPositionsTotal) {
        throw new PositionLimitError(
          currentPositions.total,
          userConfig.maxPositionsTotal,
          'Total'
        );
      }

      if (currentPositions[signal.market] >= userConfig.maxPositionsPerMarket) {
        throw new PositionLimitError(
          currentPositions[signal.market],
          userConfig.maxPositionsPerMarket,
          signal.market
        );
      }

      // Check if already have position in this symbol
      const existingPosition = await this.hasExistingPosition(userId, signal.symbol);
      if (existingPosition) {
        throw new Error(`Already have position in ${signal.symbol}`);
      }

      // Check daily order limit
      const todayOrderCount = await this.getTodayOrderCount(userId);
      if (todayOrderCount >= userConfig.maxOrdersPerDay) {
        throw new Error(`Daily order limit reached: ${todayOrderCount}/${userConfig.maxOrdersPerDay}`);
      }
    } else if (signal.signalType === 'EXIT') {
      // Verify we have the position to exit
      const position = await db.query(
        'SELECT * FROM positions WHERE id = $1 AND user_id = $2',
        [signal.positionId, userId]
      );

      if (position.rows.length === 0) {
        throw new Error(`Position ${signal.positionId} not found`);
      }
    }

    return true;
  }

  /**
   * Calculate position size based on available capital
   */
  async calculatePositionSize(signal, userConfig) {
    const broker = this.selectBroker(signal.market, userConfig);

    // Get broker account balance
    const brokerClient = await this.getBrokerClient(broker);
    const balance = await brokerClient.getAccountBalance();

    // Base position size from config
    let baseSize;
    if (signal.market === 'India') {
      baseSize = userConfig.tradeSizes.India.amount; // e.g., 50000 INR
    } else if (signal.market === 'UK') {
      baseSize = userConfig.tradeSizes.UK.amount; // e.g., 400 GBP
    } else if (signal.market === 'US') {
      baseSize = userConfig.tradeSizes.US.amount; // e.g., 500 USD
    }

    // Calculate quantity based on current price
    const quantity = Math.floor(baseSize / signal.currentPrice);

    // Verify sufficient funds
    const requiredAmount = quantity * signal.currentPrice;

    if (requiredAmount > balance.free) {
      throw new InsufficientFundsError(
        requiredAmount,
        balance.free,
        broker.broker_name
      );
    }

    return quantity;
  }

  /**
   * Select appropriate broker for market
   */
  selectBroker(market, userConfig) {
    const brokers = userConfig.brokerAccounts.filter(
      b => b.is_active && !b.is_paper_trading
    );

    if (market === 'India') {
      const iifl = brokers.find(b => b.broker_name === 'iifl');
      if (!iifl) throw new Error('No active IIFL account found');
      return iifl;
    } else {
      const trading212 = brokers.find(b => b.broker_name === 'trading212');
      if (!trading212) throw new Error('No active Trading212 account found');
      return trading212;
    }
  }

  async getCurrentPositionCount(userId) {
    const result = await db.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN market = 'India' THEN 1 ELSE 0 END) as "India",
        SUM(CASE WHEN market = 'UK' THEN 1 ELSE 0 END) as "UK",
        SUM(CASE WHEN market = 'US' THEN 1 ELSE 0 END) as "US"
      FROM positions
      WHERE user_id = $1 AND quantity > 0
    `, [userId]);

    return {
      total: parseInt(result.rows[0].total),
      India: parseInt(result.rows[0].India || 0),
      UK: parseInt(result.rows[0].UK || 0),
      US: parseInt(result.rows[0].US || 0)
    };
  }

  async hasExistingPosition(userId, symbol) {
    const result = await db.query(
      'SELECT id FROM positions WHERE user_id = $1 AND symbol = $2 AND quantity > 0',
      [userId, symbol]
    );
    return result.rows.length > 0;
  }

  async getTodayOrderCount(userId) {
    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM executed_orders
      WHERE user_id = $1
        AND DATE(created_at) = CURRENT_DATE
    `, [userId]);

    return parseInt(result.rows[0].count);
  }

  isMarketOpen(market) {
    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const utcTime = utcHours * 60 + utcMinutes;

    // Market hours in UTC
    const hours = {
      'India': { open: 3*60 + 45, close: 10*60 },     // 3:45-10:00 UTC
      'UK': { open: 8*60, close: 16*60 + 30 },        // 8:00-16:30 UTC
      'US': { open: 14*60 + 30, close: 21*60 }        // 14:30-21:00 UTC
    };

    const marketHours = hours[market];
    return utcTime >= marketHours.open && utcTime <= marketHours.close;
  }

  async logFailure(signal, error) {
    await db.query(`
      INSERT INTO trade_logs (event_type, severity, message, data)
      VALUES ($1, $2, $3, $4)
    `, [
      'SIGNAL_VALIDATION_FAILED',
      'ERROR',
      error.message,
      JSON.stringify({ signal, error: error.message })
    ]);
  }
}

module.exports = new SignalProcessor();
```

**Checklist:**
- [ ] Implement signal validation
- [ ] Check position limits
- [ ] Check capital availability
- [ ] Calculate position size
- [ ] Route to correct broker
- [ ] Validate market hours
- [ ] Log all failures

---

## Task 4.3: Order Executor 🎯
**Priority:** CRITICAL | **Estimated Time:** 6 hours

**File:** `lib/services/trade-executor.js`

```javascript
const db = require('../../config/database');
const BrokerFactory = require('../brokers/broker-factory');
const SignalProcessor = require('./signal-processor');
const { encrypt, decrypt } = require('../utils/encryption');

class TradeExecutor {
  constructor() {
    this.brokerClients = new Map();
  }

  /**
   * Execute trade from validated order
   */
  async executeTrade(order, userConfig) {
    console.log(`[Trade Executor] Executing ${order.side} order for ${order.symbol}`);

    let executedOrder = null;

    try {
      // 1. Get broker client
      const broker = await this.getBrokerClient(order.brokerAccountId);

      // 2. Place order with broker
      const brokerResponse = await broker.placeMarketOrder({
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity
      });

      // 3. Save to database
      executedOrder = await this.saveExecutedOrder(order, brokerResponse, userConfig.userId);

      // 4. Log success
      await this.logExecution(executedOrder, 'SUCCESS');

      // 5. Send notification
      await this.sendNotification(executedOrder, userConfig);

      console.log(`[Trade Executor] Order executed successfully:`, executedOrder.id);
      return executedOrder;

    } catch (error) {
      console.error(`[Trade Executor] Execution failed:`, error);

      // Log failure
      await this.logExecution(order, 'FAILED', error);

      // Save rejected order
      if (!executedOrder) {
        executedOrder = await this.saveExecutedOrder(
          order,
          { status: 'REJECTED', rejection_reason: error.message },
          userConfig.userId
        );
      }

      throw error;
    }
  }

  /**
   * Get or create broker client
   */
  async getBrokerClient(brokerAccountId) {
    // Check cache first
    if (this.brokerClients.has(brokerAccountId)) {
      return this.brokerClients.get(brokerAccountId);
    }

    // Fetch from database
    const result = await db.query(
      'SELECT * FROM broker_accounts WHERE id = $1',
      [brokerAccountId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Broker account ${brokerAccountId} not found`);
    }

    const account = result.rows[0];

    // Decrypt credentials
    const apiKey = decrypt(account.api_key_encrypted);
    const apiSecret = decrypt(account.api_secret_encrypted);

    // Create broker client
    const client = BrokerFactory.createBroker(account.broker_name, {
      apiKey,
      apiSecret,
      clientCode: account.account_id,
      baseURL: account.api_endpoint
    });

    // Authenticate
    await client.authenticate();

    // Cache client
    this.brokerClients.set(brokerAccountId, client);

    return client;
  }

  /**
   * Save executed order to database
   */
  async saveExecutedOrder(order, brokerResponse, userId) {
    const query = `
      INSERT INTO executed_orders (
        user_id,
        broker_account_id,
        signal_id,
        broker_order_id,
        symbol,
        market,
        side,
        order_type,
        quantity,
        requested_price,
        filled_quantity,
        filled_price,
        status,
        rejection_reason,
        submitted_at,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;

    const values = [
      userId,
      order.brokerAccountId,
      order.signalId,
      brokerResponse.brokerOrderId,
      order.symbol,
      order.market,
      order.side,
      'MARKET',
      order.quantity,
      order.price,
      brokerResponse.filledQuantity || 0,
      brokerResponse.filledPrice || null,
      brokerResponse.status || 'REJECTED',
      brokerResponse.rejection_reason || null,
      new Date(),
      JSON.stringify(order.metadata)
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Update position after order fills
   */
  async updatePosition(executedOrder) {
    if (executedOrder.side === 'BUY') {
      // Create or update position
      await db.query(`
        INSERT INTO positions (
          user_id,
          broker_account_id,
          symbol,
          market,
          quantity,
          avg_entry_price,
          entry_date,
          entry_order_id,
          signal_metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (broker_account_id, symbol)
        DO UPDATE SET
          quantity = positions.quantity + EXCLUDED.quantity,
          avg_entry_price = (
            (positions.avg_entry_price * positions.quantity) +
            (EXCLUDED.avg_entry_price * EXCLUDED.quantity)
          ) / (positions.quantity + EXCLUDED.quantity)
      `, [
        executedOrder.user_id,
        executedOrder.broker_account_id,
        executedOrder.symbol,
        executedOrder.market,
        executedOrder.filled_quantity,
        executedOrder.filled_price,
        new Date(),
        executedOrder.id,
        executedOrder.metadata
      ]);
    } else if (executedOrder.side === 'SELL') {
      // Reduce or close position
      await db.query(`
        UPDATE positions
        SET quantity = quantity - $1
        WHERE broker_account_id = $2
          AND symbol = $3
      `, [
        executedOrder.filled_quantity,
        executedOrder.broker_account_id,
        executedOrder.symbol
      ]);

      // Delete if quantity = 0
      await db.query(`
        DELETE FROM positions
        WHERE broker_account_id = $1
          AND symbol = $2
          AND quantity = 0
      `, [
        executedOrder.broker_account_id,
        executedOrder.symbol
      ]);
    }
  }

  async logExecution(order, status, error = null) {
    await db.query(`
      INSERT INTO trade_logs (
        user_id,
        broker_account_id,
        event_type,
        severity,
        message,
        data
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      order.user_id || null,
      order.brokerAccountId,
      status === 'SUCCESS' ? 'ORDER_EXECUTED' : 'ORDER_FAILED',
      status === 'SUCCESS' ? 'INFO' : 'ERROR',
      status === 'SUCCESS'
        ? `${order.side} order executed for ${order.symbol}`
        : `Order failed: ${error?.message}`,
      JSON.stringify({ order, error: error?.message })
    ]);
  }

  async sendNotification(order, userConfig) {
    // TODO: Implement email/Telegram notification
    console.log(`[Notification] Order ${order.id} executed for user ${userConfig.userId}`);
  }
}

module.exports = new TradeExecutor();
```

**Checklist:**
- [ ] Implement order execution
- [ ] Handle broker responses
- [ ] Save to database
- [ ] Update positions table
- [ ] Log all executions
- [ ] Send notifications
- [ ] Handle partial fills
- [ ] Cache broker clients

---

## Task 4.4: Scheduled Signal Monitoring 🕐
**Priority:** HIGH | **Estimated Time:** 2 hours

**File:** `lib/services/signal-monitor.js`

```javascript
const cron = require('node-cron');
const SignalGenerator = require('./signal-generator');
const SignalProcessor = require('./signal-processor');
const TradeExecutor = require('./trade-executor');
const db = require('../../config/database');

class SignalMonitor {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
  }

  /**
   * Start monitoring for signals
   * Runs every 15 minutes during market hours
   */
  start() {
    if (this.isRunning) {
      console.log('[Signal Monitor] Already running');
      return;
    }

    console.log('[Signal Monitor] Starting...');

    // Schedule: Every 15 minutes
    this.cronJob = cron.schedule('*/15 * * * *', async () => {
      await this.checkAndExecuteSignals();
    });

    this.isRunning = true;
    console.log('[Signal Monitor] Started - checking every 15 minutes');
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.isRunning = false;
      console.log('[Signal Monitor] Stopped');
    }
  }

  /**
   * Main monitoring loop
   */
  async checkAndExecuteSignals() {
    console.log('\n=== Signal Monitor Cycle ===');

    try {
      // 1. Check if any market is open
      const anyMarketOpen = this.isAnyMarketOpen();
      if (!anyMarketOpen) {
        console.log('[Signal Monitor] All markets closed - skipping');
        return;
      }

      // 2. Generate new entry signals
      const entrySignals = await SignalGenerator.generateLiveSignals();

      // 3. Check exit signals for open positions
      const exitSignals = await SignalGenerator.checkExitSignals();

      // 4. Get user configurations
      const users = await this.getActiveUsers();

      // 5. Process signals for each user
      for (const user of users) {
        await this.processUserSignals(user, entrySignals, exitSignals);
      }

      console.log('[Signal Monitor] Cycle complete\n');

    } catch (error) {
      console.error('[Signal Monitor] Error in cycle:', error);
    }
  }

  /**
   * Process signals for a specific user
   */
  async processUserSignals(user, entrySignals, exitSignals) {
    console.log(`[Signal Monitor] Processing signals for user ${user.id}`);

    // Process entry signals
    for (const signal of entrySignals) {
      try {
        // Validate and create order
        const order = await SignalProcessor.processSignal(signal, user.config);

        // Execute trade
        await TradeExecutor.executeTrade(order, user.config);

        console.log(`[Signal Monitor] ✅ Executed ${signal.symbol} for user ${user.id}`);
      } catch (error) {
        console.error(`[Signal Monitor] ❌ Failed ${signal.symbol}:`, error.message);
      }
    }

    // Process exit signals
    for (const signal of exitSignals) {
      try {
        // Validate and create order
        const order = await SignalProcessor.processSignal(signal, user.config);

        // Execute trade
        await TradeExecutor.executeTrade(order, user.config);

        console.log(`[Signal Monitor] ✅ Exited ${signal.symbol} for user ${user.id}`);
      } catch (error) {
        console.error(`[Signal Monitor] ❌ Failed exit ${signal.symbol}:`, error.message);
      }
    }
  }

  async getActiveUsers() {
    const result = await db.query(`
      SELECT
        u.id,
        u.email,
        json_build_object(
          'userId', u.id,
          'enableAutoTrading', u.enable_auto_trading,
          'maxPositionsTotal', u.max_positions_total,
          'maxPositionsPerMarket', u.max_positions_per_market,
          'maxOrdersPerDay', u.max_orders_per_day,
          'maxDailyLossPercent', u.max_daily_loss_percent,
          'tradeSizes', json_build_object(
            'India', json_build_object('amount', 50000, 'currency', 'INR'),
            'UK', json_build_object('amount', 400, 'currency', 'GBP'),
            'US', json_build_object('amount', 500, 'currency', 'USD')
          ),
          'brokerAccounts', (
            SELECT json_agg(ba)
            FROM broker_accounts ba
            WHERE ba.user_id = u.id
          )
        ) as config
      FROM users u
      WHERE u.enable_auto_trading = true
    `);

    return result.rows;
  }

  isAnyMarketOpen() {
    const now = new Date();
    const utcHours = now.getUTCHours();

    // India: 3:45-10:00 UTC
    // UK: 8:00-16:30 UTC
    // US: 14:30-21:00 UTC

    return (
      (utcHours >= 3 && utcHours < 10) ||   // India
      (utcHours >= 8 && utcHours < 17) ||   // UK
      (utcHours >= 14 && utcHours < 22)     // US
    );
  }

  /**
   * Manual trigger for testing
   */
  async triggerManual() {
    console.log('[Signal Monitor] Manual trigger');
    await this.checkAndExecuteSignals();
  }
}

module.exports = new SignalMonitor();
```

**Checklist:**
- [ ] Implement cron scheduling
- [ ] Check market hours
- [ ] Process entry signals
- [ ] Process exit signals
- [ ] Handle multiple users
- [ ] Add manual trigger
- [ ] Log all cycles

---

## Phase 4 Completion Checklist

### Implementation
- [ ] Signal generator working
- [ ] Signal processor validating correctly
- [ ] Trade executor placing orders
- [ ] Signal monitor running on schedule

### Testing
- [ ] Generate test signals
- [ ] Validate signal filtering
- [ ] Test position sizing
- [ ] Test order execution
- [ ] Test with paper accounts

### Integration
- [ ] Connects to Trading212
- [ ] Connects to IIFL
- [ ] Updates database correctly
- [ ] Positions sync properly

### Monitoring
- [ ] Cron job running
- [ ] Logs comprehensive
- [ ] Errors caught and logged
- [ ] Notifications sent

---

# PHASE 5: Safety & Risk Management
**Timeline:** Week 9 (15 hours)
**Status:** 🔴 NOT STARTED

(Similar detailed breakdown for remaining phases...)

---

# Project Status Dashboard

## Overall Progress: 0% Complete

| Phase | Status | Progress | Est. Hours | Actual Hours |
|-------|--------|----------|------------|--------------|
| Phase 1: Foundation | 🔴 Not Started | 0/12 tasks | 15h | - |
| Phase 2: Trading212 | 🔴 Not Started | 0/8 tasks | 20h | - |
| Phase 3: IIFL | 🔴 Not Started | 0/10 tasks | 25h | - |
| Phase 4: Pipeline | 🔴 Not Started | 0/9 tasks | 20h | - |
| Phase 5: Safety | 🔴 Not Started | 0/7 tasks | 15h | - |
| Phase 6: Dashboard | 🔴 Not Started | 0/6 tasks | 15h | - |
| Phase 7: Testing | 🔴 Not Started | 0/5 tasks | 20h | - |

**Total Estimated:** 130 hours (3.25 months at 10 hours/week)

---

## Next Steps

1. ✅ Create development plan document (THIS FILE)
2. ⏭️ Set up development environment
3. ⏭️ Start Phase 1, Task 1.1 (Database Schema)

---

## Notes & Decisions Log

### 2025-10-12
- **Decision:** Focus on Trading212 + IIFL only (exclude Motilal Oswal for now)
- **Reason:** Reduce complexity, can add more brokers later
- **Impact:** Faster initial deployment

---

## Risk Register

| Risk | Severity | Mitigation | Status |
|------|----------|------------|--------|
| Trading212 API instability | HIGH | Test thoroughly in demo mode, have fallback | 🔴 Open |
| IIFL API access delay | MEDIUM | Apply early, use paper trading | 🔴 Open |
| Regulatory compliance issues | HIGH | Consult with broker, get proper approvals | 🔴 Open |
| Data quality issues (stale/incorrect) | HIGH | Implement staleness checks, validation | 🔴 Open |
| Network failures during execution | MEDIUM | Retry logic, comprehensive error handling | 🔴 Open |

---

**Document Version:** 1.0
**Last Updated:** 2025-10-12
**Maintained By:** SignalForge Development Team
