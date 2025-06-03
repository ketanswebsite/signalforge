# API-Frontend Mismatch Detection Prompt

## System Analysis Request

I need you to analyze my full-stack application for API-frontend field mismatches and data flow issues. Please perform a systematic analysis following these steps:

### 1. API Response Analysis
- Find all API endpoints that return data (GET routes, POST routes that return data)
- For each endpoint, identify the exact field names returned in the response
- Look for database query results and how they're mapped to response objects
- Pay special attention to field name transformations (e.g., snake_case to camelCase)

### 2. Frontend Data Consumption Analysis
- Trace how API responses are consumed in the frontend
- Identify where the frontend expects certain field names
- Look for places where the frontend:
  - Accesses properties that might not exist
  - Recalculates values that are already provided by the API
  - Uses fallback values or default values
  - Shows console warnings/errors about missing data

### 3. Common Mismatch Patterns to Look For

#### Field Name Mismatches
- API returns `quantity` but frontend expects `shares`
- API returns `investment_amount` but frontend expects `investmentAmount`
- Snake_case vs camelCase inconsistencies
- Plural vs singular naming (e.g., `trade` vs `trades`)

#### Data Type Mismatches
- API returns string but frontend expects number
- API returns null but frontend doesn't handle null values
- Date format inconsistencies

#### Structural Mismatches
- API returns nested objects but frontend expects flat structure
- API returns array but frontend expects single object
- Missing intermediate null checks

#### Business Logic Duplication
- Frontend recalculating values that API already provides
- Frontend applying transformations that should happen server-side
- Inconsistent calculation methods between frontend and backend

### 4. Specific Areas to Check

1. **Database to API Mapping**
   - Check how database column names map to API response fields
   - Look for ORM/query result transformations
   - Identify any fields that get lost in translation

2. **API to Frontend Flow**
   - Check fetch/axios calls and response handling
   - Look for response data transformations
   - Identify any assumptions about data structure

3. **Console Error Patterns**
   - "Cannot read property X of undefined"
   - "Invalid value for field Y"
   - "Expected number but got string"
   - Custom console warnings about missing data

### 5. Testing Approach

Create a diagnostic script that:
1. Makes API calls to all data endpoints
2. Logs the exact structure and field names of responses
3. Compares against what the frontend code expects
4. Identifies mismatches

### 6. Fix Strategy

For each mismatch found:
1. Decide whether to fix in API or frontend
2. Ensure consistency across the entire codebase
3. Add validation to prevent future mismatches
4. Update any related documentation

## Example Analysis Output

```
MISMATCH FOUND:
- Location: trade-core.js:290
- Issue: Frontend expects 'shares' but API returns 'quantity'
- Impact: Trade shares show as 0, breaking investment calculations
- Fix: Update frontend to check for both fields with fallback

MISMATCH FOUND:
- Location: database-postgres.js:176
- Issue: Database column 'investment_amount' returned as string, frontend expects number
- Impact: Mathematical operations fail silently
- Fix: Add parseFloat() in API response mapping
```

## Priority Focus Areas

1. Financial calculations (investment amounts, profits, percentages)
2. User-facing data (names, symbols, dates)
3. Critical business logic (buy/sell signals, alerts)
4. Data visualization inputs (charts, graphs)

Please analyze the codebase systematically and provide a detailed report of all mismatches found.