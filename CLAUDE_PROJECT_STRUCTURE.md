# Stock Proxy - DTI Backtester Project Structure

## 🚨 CRITICAL INSTRUCTIONS FOR CLAUDE

**READ THIS FIRST** - This file contains the definitive project structure and guidelines. **ALWAYS** consult this file before making changes to understand the codebase organization.

## 📁 Project Directory Structure

```
stock-proxy/
├── 📂 lib/                          # Backend modules (NEW - REORGANIZED)
│   ├── 📂 scanner/
│   │   └── scanner.js               # ✅ SINGLE unified scanner service
│   ├── 📂 shared/
│   │   ├── stock-data.js           # ✅ SHARED stock lists (backend + frontend)
│   │   └── dti-calculator.js       # ✅ SHARED DTI calculation logic
│   └── 📂 telegram/
│       └── telegram-bot.js         # ✅ MOVED from root for organization
├── 📂 public/js/                    # Frontend modules (CORRECT IMPLEMENTATION)
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
│   ├── ml-integration.js
│   ├── ml-routes.js
│   └── 📂 pattern-recognition/
├── server.js                       # ✅ UPDATED - Main Express server
├── database-postgres.js            # PostgreSQL database
└── package.json                    # Dependencies
```

## 🔥 MAJOR REORGANIZATION COMPLETED

### ❌ REMOVED DUPLICATE FILES
These files were **DELETED** as they contained duplicate logic:
- `dti-scanner.js` (root) - ❌ DELETED
- `stock-scanner.js` (root) - ❌ DELETED  
- `stock-scanner-v2.js` (root) - ❌ DELETED
- `telegram-bot.js` (root) - ❌ MOVED to `lib/telegram/`

### ✅ NEW CLEAN STRUCTURE

#### 1. **Backend Scanner Service**
- **Location**: `lib/scanner/scanner.js`
- **Purpose**: Single, unified scanner service
- **Features**:
  - Scheduled daily scans at 7 AM UK time
  - Manual scan API endpoints
  - Uses shared modules for consistency
  - Clean, maintainable code

#### 2. **Shared Modules**
- **Stock Data**: `lib/shared/stock-data.js`
  - Contains ALL stock lists (Nifty 50, FTSE 100, US stocks, etc.)
  - Used by both backend and frontend
  - Single source of truth for stock data

- **DTI Calculator**: `lib/shared/dti-calculator.js`
  - Contains DTI calculation logic
  - 7-Day DTI calculation
  - Signal detection algorithms
  - Used by both backend and frontend

#### 3. **Frontend Files** (UNCHANGED - WORKING CORRECTLY)
- **Location**: `public/js/dti-*.js`
- **Status**: ✅ LEFT INTACT - These contain the CORRECT implementation
- **Why**: Frontend DTI logic is proven and working properly

## 🎯 CORE FUNCTIONALITY PRESERVED

### ✅ DTI Logic
- **Frontend**: `public/js/dti-indicators.js` - CORRECT implementation
- **Backend**: `lib/shared/dti-calculator.js` - Extracted from frontend
- **Status**: INTACT and FUNCTIONAL

### ✅ Stock Scanner
- **New Service**: `lib/scanner/scanner.js`
- **Features**: 
  - Daily automated scans
  - Manual scan triggers
  - Telegram notifications
  - Uses shared DTI logic

### ✅ Telegram Alerts
- **Location**: `lib/telegram/telegram-bot.js` (moved from root)
- **Status**: FULLY FUNCTIONAL
- **Integration**: Connected to new scanner service

### ✅ Middleware & Authentication
- **Subscription**: `middleware/subscription.js` - INTACT
- **Validation**: `middleware/validation.js` - INTACT
- **Auth**: `config/auth.js` - INTACT

## 🚨 CRITICAL RULES FOR FUTURE CHANGES

### 1. **NO DUPLICATION**
- Never create duplicate scanner files
- Use shared modules in `lib/shared/` for common logic
- If logic exists in frontend, extract to shared before duplicating

### 2. **SINGLE SCANNER SERVICE**
- All backend scanning goes through `lib/scanner/scanner.js`
- NO new scanner files in root directory
- Extend existing service instead of creating new ones

### 3. **SHARED MODULE USAGE**
- Stock data: Use `lib/shared/stock-data.js`
- DTI calculations: Use `lib/shared/dti-calculator.js`
- Keep shared modules framework-agnostic (work in both Node.js and browser)

### 4. **FRONTEND PRESERVATION**
- `public/js/dti-*.js` files contain CORRECT implementation
- DO NOT duplicate their logic elsewhere
- When extracting logic, move to `lib/shared/` and update both frontend and backend to use it

### 5. **FILE ORGANIZATION**
- Backend modules: `lib/*/`
- Frontend modules: `public/js/`
- Shared modules: `lib/shared/`
- Configuration: `config/`
- Routes: `routes/`
- Middleware: `middleware/`

## 📊 SERVER.JS UPDATES

The main `server.js` file has been updated to:
- Use `lib/scanner/scanner.js` instead of multiple duplicate scanners
- Use `lib/telegram/telegram-bot.js` for Telegram functionality
- Eliminate all references to deleted duplicate files

## 🔄 RENDER DEPLOYMENT

### Updated for Clean Structure
- `render.yaml`: Updated to use `npm install` instead of removed build scripts
- Database: PostgreSQL only (SQLite files removed)
- Environment: Production-ready configuration

## 💡 DEBUGGING & MAINTENANCE

### When Issues Arise:
1. **Scanner Problems**: Check `lib/scanner/scanner.js`
2. **DTI Calculation Issues**: Check `lib/shared/dti-calculator.js`
3. **Stock Data Issues**: Check `lib/shared/stock-data.js`
4. **Frontend Issues**: Check `public/js/dti-*.js` (original working files)

### Adding New Features:
1. **Backend features**: Extend `lib/scanner/scanner.js` or create new modules in `lib/`
2. **Shared logic**: Add to appropriate file in `lib/shared/`
3. **Frontend features**: Add to `public/js/` following existing patterns

## 🎯 PERFORMANCE & SCALABILITY

### Benefits of New Structure:
- **Eliminated Code Duplication**: Single source of truth for each feature
- **Improved Maintainability**: Clear separation of concerns
- **Better Testing**: Isolated modules easier to test
- **Reduced Bundle Size**: No duplicate code
- **Consistent Logic**: Shared modules ensure consistency

### Memory & Performance:
- Removed redundant scanner processes
- Single scanner service handles all scanning
- Shared modules reduce memory footprint
- Clean async/await patterns throughout

## 🚨 FINAL REMINDERS FOR CLAUDE

1. **NEVER** recreate the deleted scanner files (`dti-scanner.js`, `stock-scanner.js`, `stock-scanner-v2.js`)
2. **ALWAYS** use the new unified structure in `lib/`
3. **PRESERVE** the working frontend files in `public/js/`
4. **EXTEND** existing services instead of creating duplicates
5. **REFER** to this document before making structural changes

---

**Last Updated**: $(date)
**Structure Version**: 2.0 (Post-Reorganization)
**Status**: ✅ PRODUCTION READY