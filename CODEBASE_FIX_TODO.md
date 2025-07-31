# Stock Proxy Codebase Fix TODO

**Objective**: Transform the codebase to be error-free, secure, and production-ready with NO fallbacks. Each task must be completed thoroughly and tested before moving to the next.

## Progress: 1/25 Tasks Completed (4%)

---

## ✅ COMPLETED TASKS

### 1. ✅ CRITICAL: Remove eval() usage in dti-scanner.js:25 
- **Status**: COMPLETED ✅
- **Fix Applied**: Replaced `eval(arrayStr)` with safe JSON parsing using proper string cleaning and `JSON.parse()`
- **Files Modified**: `dti-scanner.js:25-39`
- **Testing**: ✅ Verified with module loading test - successfully loaded 2,377 stocks
- **Security Impact**: **CRITICAL** vulnerability eliminated - no more arbitrary code execution risk

---

## 🚨 CRITICAL TASKS (Must Fix Immediately)

### 2. 🔴 CRITICAL: Remove weak fallback session secret
- **File**: `config/auth.js:83`
- **Issue**: `secret: process.env.SESSION_SECRET || 'your-secret-key-change-this'`
- **Fix Required**: Remove fallback, require strong SESSION_SECRET, fail fast if not provided
- **Impact**: Session hijacking vulnerability in production
- **Testing Required**: 
  - Start server without SESSION_SECRET - should fail with clear error
  - Start server with weak SESSION_SECRET - should fail with validation error
  - Start server with strong SESSION_SECRET - should work normally

### 3. 🔴 CRITICAL: Remove hardcoded admin email
- **File**: `server.js:73`
- **Issue**: `const ADMIN_EMAIL = 'ketanjoshisahs@gmail.com';`
- **Fix Required**: Move to required environment variable `ADMIN_EMAIL`
- **Impact**: Security through obscurity compromised
- **Testing Required**:
  - Start server without ADMIN_EMAIL env var - should fail
  - Verify admin functionality works with env var

### 4. 🔴 CRITICAL: Update vulnerable dependencies
- **Issue**: 9 total vulnerabilities (2 critical, 4 moderate, 3 low)
- **Fix Required**: Run `npm audit fix --force` and resolve all vulnerabilities
- **Critical Vulnerabilities**:
  - `form-data`: Unsafe random function vulnerability
  - `node-telegram-bot-api`: Multiple vulnerabilities via deprecated request package
- **Testing Required**:
  - Run `npm audit` - should show 0 vulnerabilities
  - Test all functionality still works after updates

### 5. 🔴 CRITICAL: Downgrade Express from beta to stable
- **File**: `package.json`
- **Issue**: Using Express v5.1.0 (beta) in production
- **Fix Required**: Downgrade to stable Express v4.x
- **Impact**: Production instability risk
- **Testing Required**:
  - All API endpoints still work
  - Middleware compatibility maintained
  - Performance benchmarks

### 6. 🔴 CRITICAL: Remove SQLite fallback
- **Files**: `server.js`, `database-postgres.js`
- **Issue**: Complex fallback logic between PostgreSQL and SQLite
- **Fix Required**: Use PostgreSQL only, fail fast if not configured
- **Impact**: Database inconsistency and connection issues
- **Testing Required**:
  - Server fails gracefully without PostgreSQL config
  - All database operations work with PostgreSQL only
  - No SQLite code remains

---

## 🔥 HIGH PRIORITY TASKS

### 7. 🟠 Add comprehensive input validation middleware
- **Files**: `server.js`, `routes/*.js`
- **Issue**: Multiple API endpoints vulnerable to injection/corruption
- **Fix Required**: Add validation middleware to all endpoints
- **Testing Required**: Test all endpoints with malicious inputs

### 8. 🟠 Add rate limiting middleware
- **Issue**: API endpoints vulnerable to abuse
- **Fix Required**: Implement express-rate-limit middleware
- **Testing Required**: Verify rate limits work correctly

### 9. 🟠 Fix unsafe DOM manipulation
- **File**: `public/js/trade-core.js:234`
- **Issue**: `document.innerHTML = userInput;` - XSS vulnerability
- **Fix Required**: Add proper sanitization
- **Testing Required**: Test with XSS payloads

### 10. 🟠 Remove all fallback error messages
- **Files**: Throughout codebase
- **Issue**: Generic "Something went wrong" messages
- **Fix Required**: Implement specific error handling with proper codes
- **Testing Required**: All error scenarios return meaningful messages

### 11. 🟠 Fix database connection management
- **Files**: `server.js`, `database-postgres.js`
- **Issue**: Potential connection leaks, poor pooling
- **Fix Required**: Implement proper connection pooling and cleanup
- **Testing Required**: Connection load testing

### 12. 🟠 Remove circular dependencies
- **Files**: `server.js`, `telegram-bot.js`, `stock-scanner-v2.js`
- **Issue**: `server.js → telegram-bot.js → stock-scanner-v2.js → server.js`
- **Fix Required**: Break circular dependency chain
- **Testing Required**: Module loading and functionality tests

### 13. 🟠 Add null/undefined checks
- **Files**: Throughout codebase
- **Issue**: Missing validation for user inputs and API responses
- **Fix Required**: Add comprehensive null/undefined checking
- **Testing Required**: Test with null/undefined inputs

### 14. 🟠 Fix division by zero errors
- **File**: `dti-scanner.js:156` and similar locations
- **Issue**: `const average = totalValue / count;` - count could be 0
- **Fix Required**: Add proper zero checks
- **Testing Required**: Test with edge case data

### 15. 🟠 Fix array access without bounds checking
- **Files**: Throughout codebase
- **Issue**: `const latestPrice = prices[prices.length - 1];` - array could be empty
- **Fix Required**: Add bounds checking for all array access
- **Testing Required**: Test with empty arrays

---

## ⚠️ MEDIUM PRIORITY TASKS

### 16-23. Various quality improvements
- Structured logging implementation
- Dead code removal
- Async pattern standardization
- Timer cleanup
- Module refactoring
- N+1 query fixes
- Health check endpoints
- Environment-specific code removal

---

## 📋 LOW PRIORITY TASKS

### 24-25. Testing and documentation
- Comprehensive test suite
- API documentation

---

## Testing Protocol

For each completed task:

1. **Unit Testing**: Test the specific functionality fixed
2. **Integration Testing**: Ensure the fix doesn't break related functionality
3. **Security Testing**: Verify the security issue is resolved
4. **Performance Testing**: Ensure no performance regression
5. **Edge Case Testing**: Test with boundary conditions and error scenarios

## Current Status

- **Next Task**: Task #2 - Remove weak fallback session secret
- **Current Focus**: Critical security vulnerabilities
- **Target**: Complete all critical tasks within 48 hours

---

**Last Updated**: 2025-07-31
**Progress Tracking**: This file will be updated after each completed task