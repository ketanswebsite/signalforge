# 🧠 CLAUDE AI BEHAVIORAL GUIDELINES & PROJECT STRUCTURE

## 🚨 MANDATORY READING FOR CLAUDE - READ BEFORE EVERY TASK

**This document contains CRITICAL behavioral rules and project structure that MUST be followed at ALL times.**

---

# 🤖 CLAUDE BEHAVIORAL RULES

## 🎯 CORE BEHAVIORAL DIRECTIVES

### 1. 🧠 **EXTENDED THINKING MODE - ALWAYS ON**
- **NEVER** rush to solutions
- **ALWAYS** think deeply about the problem before coding
- **ANALYZE** all implications of changes
- **CONSIDER** edge cases and potential conflicts
- **PLAN** the implementation thoroughly before starting
- **THINK** about how changes affect the entire system

### 2. 🚫 **ZERO DUPLICATION TOLERANCE**
- **NEVER** create duplicate files, functions, or logic
- **ALWAYS** check if functionality already exists
- **REUSE** existing code through proper imports/requires
- **EXTRACT** common logic to shared modules
- **CONSOLIDATE** similar functionality into single sources

### 3. 🎯 **SOLUTION-FIRST MINDSET**
- **SOLVE** problems, don't create workarounds
- **FIX** the root cause, not symptoms
- **AVOID** fallback solutions unless absolutely necessary
- **IMPLEMENT** proper solutions even if they take more effort
- **REFACTOR** existing code when needed for proper integration

### 4. 📖 **REFERENCE INTEGRITY**
- **VERIFY** all file paths and imports before coding
- **UPDATE** all references when moving/renaming files
- **MAINTAIN** consistent naming conventions
- **CHECK** that all modules can find their dependencies
- **TEST** imports/requires work correctly

### 5. 🔍 **THOROUGH ANALYSIS BEFORE ACTION**
- **READ** this entire document before starting ANY task
- **UNDERSTAND** the existing project structure
- **IDENTIFY** all affected files and dependencies
- **PLAN** the complete implementation approach
- **ANTICIPATE** potential issues and conflicts

---

# 📁 DEFINITIVE PROJECT STRUCTURE

## 🏗️ DIRECTORY HIERARCHY (FINAL VERSION)

```
stock-proxy/
├── 📂 lib/                          # Backend modules (ORGANIZED STRUCTURE)
│   ├── 📂 scanner/
│   │   └── scanner.js               # ✅ SINGLE unified scanner service
│   ├── 📂 shared/
│   │   ├── stock-data.js           # ✅ SHARED stock lists (2,381 stocks)
│   │   └── dti-calculator.js       # ✅ SHARED DTI calculation logic
│   └── 📂 telegram/
│       └── telegram-bot.js         # ✅ Telegram integration
├── 📂 public/js/                    # Frontend modules (WORKING CORRECTLY)
│   ├── dti-core.js                 # ✅ Main DTI application core
│   ├── dti-backtest.js             # ✅ Backtesting logic
│   ├── dti-data.js                 # ✅ Frontend data management
│   ├── dti-indicators.js           # ✅ DTI calculation for frontend
│   ├── dti-ui-*.js                 # ✅ UI components
│   └── trade-*.js                  # ✅ Trading interface
├── 📂 config/                       # Configuration
│   ├── auth.js                     # Authentication config
│   └── security.js                 # Security middleware
├── 📂 middleware/                   # Express middleware
│   ├── subscription.js             # Subscription validation
│   └── validation.js               # Input validation
├── 📂 routes/                       # API routes
│   ├── auth.js                     # Authentication routes
│   └── gdpr.js                     # GDPR compliance
├── 📂 ml/                           # Machine learning features
├── server.js                       # ✅ Main Express server
├── database-postgres.js            # PostgreSQL database
├── package.json                    # Dependencies
├── render.yaml                     # Render deployment config
├── deploy-to-render.bat            # Deployment script
└── README-DEPLOYMENT.md            # Deployment guide
```

---

# ❌ FORBIDDEN FILES & ACTIONS

## 🚫 **NEVER CREATE THESE FILES**
These files were **DELETED** and must **NEVER** be recreated:
- `dti-scanner.js` (root) - ❌ DELETED PERMANENTLY
- `stock-scanner.js` (root) - ❌ DELETED PERMANENTLY
- `stock-scanner-v2.js` (root) - ❌ DELETED PERMANENTLY
- Any variation of scanner files in root directory

## 🚫 **FORBIDDEN ACTIONS**
- **NEVER** create fallback scanner implementations
- **NEVER** duplicate DTI calculation logic
- **NEVER** create backup/temp versions of files
- **NEVER** add scanner logic to `server.js` directly
- **NEVER** create workaround solutions for existing functionality

---

# ✅ MANDATORY PATTERNS

## 🔄 **PROPER IMPORT PATTERNS**

### Backend Imports (Node.js)
```javascript
// Scanner service
const StockScanner = require('./lib/scanner/scanner');

// Shared modules
const { getAllStocks } = require('./lib/shared/stock-data');
const { analyzeStock } = require('./lib/shared/dti-calculator');

// Telegram
const { sendTelegramAlert } = require('./lib/telegram/telegram-bot');
```

### Frontend Imports (Browser)
```javascript
// Shared modules (loaded via script tags)
const stockLists = window.StockData.getStockLists();
const analysis = window.DTICalculator.analyzeStock(data, params);
```

## 🎯 **PROPER EXTENSION PATTERNS**

### Adding Scanner Features
```javascript
// ✅ CORRECT: Extend existing scanner
// File: lib/scanner/scanner.js
class StockScanner {
    // Add new methods here
    async newScanFeature() {
        // Implementation
    }
}
```

### Adding Shared Logic
```javascript
// ✅ CORRECT: Add to shared modules
// File: lib/shared/dti-calculator.js
function newDTIFeature() {
    // Implementation
}
```

---

# 🔧 FUNCTIONAL GUIDELINES

## 📊 **DTI Logic Sources**
- **Primary Source**: `lib/shared/dti-calculator.js`
- **Frontend Interface**: `public/js/dti-indicators.js`
- **Rule**: Always use shared module for calculations

## 📈 **Stock Data Sources**
- **Primary Source**: `lib/shared/stock-data.js`
- **Contains**: 2,381 stocks across all markets
- **Rule**: Never hardcode stock lists elsewhere

## 🤖 **Scanner Service**
- **Primary Service**: `lib/scanner/scanner.js`
- **Features**: Daily scans, manual triggers, Telegram alerts
- **Rule**: All scanning goes through this single service

## 📱 **Telegram Integration**
- **Primary Module**: `lib/telegram/telegram-bot.js`
- **Integration**: Connected to scanner service
- **Rule**: Never duplicate telegram logic

---

# 🚨 PRE-TASK CHECKLIST FOR CLAUDE

## ✅ **BEFORE STARTING ANY TASK:**

1. **📖 READ** this entire document completely
2. **🧠 ENABLE** extended thinking mode
3. **🔍 ANALYZE** the task requirements thoroughly
4. **📁 UNDERSTAND** which files will be affected
5. **🔄 CHECK** for existing functionality
6. **📝 PLAN** the complete implementation
7. **⚠️ IDENTIFY** potential conflicts or duplications
8. **✅ VERIFY** the approach follows these guidelines

## ✅ **DURING IMPLEMENTATION:**

1. **🚫 NEVER** create duplicate files or functions
2. **🔗 MAINTAIN** all import/require references
3. **🎯 SOLVE** the root problem, not symptoms
4. **📖 FOLLOW** the established project structure
5. **🔍 TEST** that all references work correctly

## ✅ **AFTER IMPLEMENTATION:**

1. **🔄 VERIFY** all imports/requires are correct
2. **🧪 CHECK** that functionality works end-to-end
3. **📝 UPDATE** documentation if needed
4. **🚫 ENSURE** no duplications were created
5. **✅ CONFIRM** the solution is proper, not a workaround

---

# 🎯 COMMON TASK PATTERNS

## 🔧 **Adding New Scanner Features**
1. ✅ Extend `lib/scanner/scanner.js`
2. ✅ Use shared modules for data/calculations
3. ✅ Add proper error handling
4. ❌ **NEVER** create new scanner files

## 📊 **Adding DTI Features**
1. ✅ Add to `lib/shared/dti-calculator.js`
2. ✅ Update frontend to use shared logic
3. ✅ Maintain framework agnostic code
4. ❌ **NEVER** duplicate calculation logic

## 🔌 **Adding API Endpoints**
1. ✅ Add to appropriate route file in `routes/`
2. ✅ Use existing services (scanner, telegram, etc.)
3. ✅ Follow authentication/validation patterns
4. ❌ **NEVER** add complex logic directly to `server.js`

## 🎨 **Adding Frontend Features**
1. ✅ Add to appropriate file in `public/js/`
2. ✅ Use shared modules for calculations
3. ✅ Follow existing UI patterns
4. ❌ **NEVER** duplicate backend logic in frontend

---

# 🚀 PERFORMANCE & QUALITY RULES

## ⚡ **Performance Guidelines**
- **REUSE** existing modules and functions
- **AVOID** redundant calculations
- **OPTIMIZE** for single scanner service
- **CACHE** shared data when appropriate

## 🏗️ **Code Quality Rules**
- **MAINTAIN** consistent naming conventions
- **FOLLOW** established patterns
- **ADD** proper error handling
- **DOCUMENT** complex logic
- **TEST** all changes thoroughly

## 🔒 **Security Guidelines**
- **VALIDATE** all inputs
- **SANITIZE** user data
- **USE** existing middleware patterns
- **FOLLOW** authentication requirements

---

# 🚨 CRITICAL FAILURE POINTS TO AVOID

## ❌ **NEVER DO THESE:**

1. **Create scanner files in root directory**
2. **Duplicate DTI calculation logic**
3. **Add scanner logic directly to server.js**
4. **Create fallback implementations**
5. **Ignore existing shared modules**
6. **Rush to solutions without planning**
7. **Create workarounds instead of proper fixes**
8. **Break existing import/require chains**

## ✅ **ALWAYS DO THESE:**

1. **Use the established lib/ structure**
2. **Extend existing services**
3. **Leverage shared modules**
4. **Think through the complete solution**
5. **Maintain reference integrity**
6. **Solve root problems**
7. **Follow the zero-duplication rule**
8. **Test all changes thoroughly**

---

# 📞 WHEN IN DOUBT

## 🤔 **If Unsure About Implementation:**
1. **RE-READ** this document
2. **ANALYZE** existing code patterns
3. **IDENTIFY** the proper place for the change
4. **PLAN** the minimal viable solution
5. **AVOID** creating new files unless absolutely necessary

## 🔍 **If Functionality Seems Missing:**
1. **SEARCH** existing codebase thoroughly
2. **CHECK** shared modules first
3. **LOOK** for similar patterns
4. **EXTEND** existing functionality
5. **CREATE** new only if genuinely needed

---

# 🎯 SUCCESS METRICS

## ✅ **A Successful Implementation:**
- Uses existing project structure
- Follows zero-duplication principle
- Maintains all references correctly
- Solves the root problem
- Doesn't create workarounds
- Is thoroughly planned and executed

## ❌ **A Failed Implementation:**
- Creates duplicate files or logic
- Breaks existing functionality
- Uses workarounds instead of proper solutions
- Ignores established patterns
- Rushes without proper analysis

---

**🧠 REMEMBER: Think deeply, plan thoroughly, implement properly, avoid duplication at all costs.**

**📅 Last Updated**: December 2024  
**🔄 Version**: 3.0 (Claude Behavioral Guidelines)  
**📊 Status**: ✅ MANDATORY COMPLIANCE REQUIRED