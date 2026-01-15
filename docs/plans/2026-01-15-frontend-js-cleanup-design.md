# Frontend JS Incremental Cleanup Design

## Problem Statement

The `public/js/` directory contains 54,126 lines across 93 files with significant duplication:
- **38 files** repeat identical fetch-error-render patterns
- **56+ files** have competing notification systems
- **47 files** format dates independently
- **20+ files** recreate modal event handling

This causes maintenance difficulty, inconsistent patterns, and scattered code duplication.

## Solution

Create three shared utility modules that existing files can adopt incrementally. No breaking changes - new utilities are opt-in.

---

## Utility 1: Date Formatter

**File:** `public/js/utils/date-formatter.js`

**API:**
```javascript
window.DateFormatter = {
  format(date, fallback = '-'),      // "Jan 15, 2026"
  formatShort(date, fallback = '-'), // "15/01/26"
  formatTime(date, fallback = '-'),  // "Jan 15, 2026, 2:30 PM"
  relative(date)                      // "2 hours ago"
}
```

**Before:**
```javascript
render: (date) => date ? new Date(date).toLocaleDateString() : '-'
```

**After:**
```javascript
render: (date) => DateFormatter.format(date)
```

**Impact:** 47 files, ~2 lines saved per usage

---

## Utility 2: API Client

**File:** `public/js/utils/api-client.js`

**API:**
```javascript
window.ApiClient = {
  async fetch(endpoint, options = {}),
  async fetchAndRender({
    endpoint,
    params,
    containerId,
    renderFn,
    retryFn,
    loadingText
  })
}
```

**Before:**
```javascript
async loadUsers() {
  try {
    const params = new URLSearchParams({...});
    const response = await fetch(`/api/admin/users?${params}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error?.message || 'Failed to load');
    this.renderUsersTable(data.data.items, data.data.pagination);
  } catch (error) {
    document.getElementById('users-table-container').innerHTML = `
      <div class="text-center text-muted">
        <p>Failed to load users</p>
        <button onclick="AdminUsers.loadUsers()">Retry</button>
      </div>`;
  }
}
```

**After:**
```javascript
async loadUsers() {
  await ApiClient.fetchAndRender({
    endpoint: '/api/admin/users',
    params: this.getFilterParams(),
    containerId: 'users-table-container',
    renderFn: (data) => this.renderUsersTable(data.items, data.pagination),
    retryFn: () => this.loadUsers(),
    loadingText: 'Loading users...'
  });
}
```

**Impact:** 38 files, ~15 lines saved per usage

---

## Utility 3: Notification Manager

**File:** `public/js/utils/notifications.js`

**Problem:** Three competing implementations in error-handler.js, dti-core.js, and trade-core.js

**API:**
```javascript
window.NotificationManager = {
  show(message, type = 'info', duration = 5000),
  success(message),
  error(message),
  warning(message),
  info(message)
}

// Backward compatibility
window.showNotification = (msg, type) => NotificationManager.show(msg, type);
```

**Migration:**
1. Create notifications.js as canonical implementation
2. Load early in HTML (before other scripts)
3. Update error-handler.js to delegate to NotificationManager
4. Update dti-core.js and trade-core.js to delegate
5. Remove redundant implementations

**Impact:** 56+ files, single source of truth for notifications

---

## File Structure

```
public/js/
├── utils/                    # NEW - shared utilities
│   ├── date-formatter.js     # ~40 lines
│   ├── api-client.js         # ~80 lines
│   └── notifications.js      # ~60 lines
├── admin-*.js                # Existing - migrate gradually
├── trade-*.js                # Existing - migrate gradually
└── ...
```

## HTML Script Loading Order

```html
<!-- Utilities first -->
<script src="/js/utils/date-formatter.js"></script>
<script src="/js/utils/api-client.js"></script>
<script src="/js/utils/notifications.js"></script>

<!-- Then existing modules -->
<script src="/js/admin-components.js"></script>
...
```

---

## Implementation Phases

| Phase | Utility | Files Affected | Effort |
|-------|---------|----------------|--------|
| 1 | date-formatter.js | 47 files | Low |
| 2 | api-client.js | 38 files | Medium |
| 3 | notifications.js | 56+ files | Medium |

## Success Criteria

- No breaking changes to existing functionality
- Each utility works standalone
- Migration can pause/resume at any point
- Measurable line count reduction after each phase

## Migration Strategy

1. Create utility file
2. Add script tag to HTML files (before other scripts)
3. Update consuming files one-by-one using find-replace
4. Each file change is independent - can be done over time
5. Old code keeps working until migrated
