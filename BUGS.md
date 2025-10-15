# Known Issues and Bugs

This document tracks bugs, issues, and their resolutions for the SutrAlgo Trading Signals Integration system.

## Critical (P0)

*Issues that cause system failure or data loss*

- [ ] None currently

## High Priority (P1)

*Issues that significantly impact functionality*

- [ ] None currently

## Medium Priority (P2)

*Issues that cause inconvenience but have workarounds*

- [ ] None currently

## Low Priority (P3)

*Minor issues, cosmetic problems, or nice-to-have fixes*

- [ ] None currently

---

## Fixed Issues

### Phase 6 - Settings System
- [x] **Settings not persisting on page reload** (Fixed: 2025-01-15)
  - **Component**: Settings UI
  - **Description**: Settings form wasn't loading saved values on page load
  - **Fix**: Added initializeSettings() call in DOMContentLoaded event

### Phase 5 - Trade Management
- [x] **CSV export missing headers** (Fixed: 2025-01-15)
  - **Component**: Trade Management
  - **Description**: CSV export was missing column headers
  - **Fix**: Added headers array to exportToCSV() function

### Phase 4 - Exit Monitoring
- [x] **Exit monitor not checking square-off date** (Fixed: 2025-01-14)
  - **Component**: Exit Monitor
  - **Description**: Square-off date condition wasn't being checked
  - **Fix**: Added square-off date check to checkTradeExit() function

---

## Issue Template

Use this template when reporting new bugs:

### [Bug Title]
**Priority**: P1/P2/P3
**Component**: Component Name
**Discovered**: YYYY-MM-DD
**Status**: Open/In Progress/Fixed

**Description**:
Clear description of the bug

**Steps to Reproduce**:
1. Step 1
2. Step 2
3. Step 3

**Expected Behavior**:
What should happen

**Actual Behavior**:
What actually happens

**Environment**:
- Browser/Node Version:
- Database: PostgreSQL/SQLite
- Operating System:

**Screenshots/Logs**:
Include any relevant screenshots or error logs

**Fix** (if resolved):
Description of how the bug was fixed

**Fixed Date**: YYYY-MM-DD

---

## Testing Notes

- Run `node tests/database.test.js` to verify database integrity
- Run `node tests/performance.test.js` to check performance benchmarks
- Check server logs for unexpected errors
- Monitor memory usage for leaks
- Verify Telegram alerts are being sent correctly

## Reporting Bugs

1. Check if the bug already exists in this document
2. Try to reproduce the bug consistently
3. Gather relevant information (logs, screenshots, steps)
4. Create a new entry using the template above
5. Assign appropriate priority level
6. Test the fix thoroughly before marking as resolved

---

*Last Updated: 2025-01-15*
