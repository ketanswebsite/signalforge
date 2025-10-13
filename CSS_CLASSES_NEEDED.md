# CSS Classes Required for Rebuild

This document lists all CSS classes that need to be implemented after removing inline styles from JavaScript files.

## Layout Classes

### Flexbox
- `.flex` - Display flex
- `.flex-between` - Justify content space-between + align items center
- `.gap-2` - Gap 0.5rem
- `.gap-1` - Gap 0.25rem

### Grid
- `.grid-2col` - 2 column grid with 1rem gap
- `.grid-3col` - 3 column grid with 1rem gap

## Spacing Classes

### Margin
- `.mt-1` - Margin top 0.5rem
- `.mt-2` - Margin top 1rem
- `.mb-1` - Margin bottom 0.5rem
- `.mb-2` - Margin bottom 1rem

## Typography Classes

- `.text-sm` - Font size 0.875rem
- `.text-lg` - Font size 1.25rem
- `.font-mono` - Font family monospace

## Utility Classes

### Color Classes
- `.positive` - Green color for positive values (profits, gains)
  ```css
  .positive {
      color: #10b981;
  }
  ```
- `.negative` - Red color for negative values (losses)
  ```css
  .negative {
      color: #ef4444;
  }
  ```

## Component Classes

### Buttons
- `.btn-full` - Width 100%
- `.btn-icon-right` - Margin-left 8px for right-aligned button icons
  ```css
  .btn-icon-right {
      margin-left: 8px;
  }
  ```

### Tables
- `.table-responsive` - Overflow-x auto for responsive tables

### Code Blocks
- `.code-block` - Background #f9fafb, padding, border-radius
- `.code-pre` - For pre-formatted code display
- `.font-mono` - Monospace font family

### Cards
- `.plan-card` - For subscription plan cards with dynamic borders
- `.query-history-item` - For database query history items

### Animations
- `.float-up-animation` - Animation floatUp 2s ease-out forwards with z-index 1000
  ```css
  .float-up-animation {
      animation: floatUp 2s ease-out forwards;
      z-index: 1000;
  }

  @keyframes floatUp {
      0% {
          opacity: 1;
          transform: translateY(0);
      }
      100% {
          opacity: 0;
          transform: translateY(-30px);
      }
  }
  ```
- `.pnl-change-indicator` - Fixed position indicator for P/L changes
  ```css
  .pnl-change-indicator {
      position: fixed;
      font-size: 14px;
      font-weight: 600;
      pointer-events: none;
  }
  ```

### Metrics
- `.metrics-grid-spaced` - Margin-top 20px for spaced metric grids
  ```css
  .metrics-grid-spaced {
      margin-top: 20px;
  }
  ```

### Typography
- `.symbol-subdued` - Font-size 12px, color #6b7280 for subdued symbols
  ```css
  .symbol-subdued {
      font-size: 12px;
      color: #6b7280;
  }
  ```
- `.trade-summary-note` - Text-align center, font-style italic, color #6b7280, margin-top 15px
  ```css
  .trade-summary-note {
      text-align: center;
      font-style: italic;
      color: #6b7280;
      margin-top: 15px;
  }
  ```

## Form Classes

### Form Controls
- Form controls that previously had `width: 200px` or `width: 150px` should use width classes or specific selectors

## Dynamic Styles (KEPT in JS)

These styles remain in JavaScript because they're conditional/dynamic:

1. **Conditional Display:**
   - `style="display: ${condition ? 'block' : 'none'};"`
   - Used for: bulk actions bar, query results, analytics panels

2. **Dynamic Borders:**
   - `style="border: 2px solid ${plan.is_active ? '#10b981' : '#d1d5db'};"`
   - Used for: plan status indicators

3. **Progress Bars:**
   - `style="width: ${percentage}%"`
   - Used for: progress indicators

## Files Modified

### Admin Files
1. admin-users.js
2. admin-settings.js
3. admin-database.js
4. admin-subscriptions.js
5. admin-payments.js
6. admin-audit.js
7. admin-analytics.js
8. admin-components.js (already clean)

### Trading UI Files
9. TradeUI-Trades.js
10. TradeUI-Export-Metrics.js

### DTI Files
11. dti-data.js
12. dti-ui-charts.js
13. dti-performance-modal.js

### Portfolio Files
14. portfolio-ui.js

### Core UI Files
15. real-time-prices.js
16. loading-states.js
17. alerts-ui.js
18. unified-navbar.js
19. account.js

## Additional Files to Check

These files still contain inline CSS that should be reviewed:

- xss-protection.js (1 occurrence)
- ml-insights-ui.js (37 occurrences)
- dti-ui-trades.js (16 occurrences)
- TradeUI-Dialogs.js (27 occurrences)
- checkout.js (4 occurrences)
- trade-modal.js (1 occurrence)
- trade-filters.js (13 occurrences)
- trade-core.js (4 occurrences)
- portfolio-export.js (1 occurrence)
- mobile-nav.js (11 occurrences)
- market-status-manager.js (9 occurrences)
- error-handler.js (2 occurrences)
- dti-ui-selector.js (12 occurrences)
- dti-core.js (28 occurrences)
- advanced-charts.js (16 occurrences)
- accessibility-enhancer.js (3 occurrences)
- TradeUI-Core.js (22 occurrences)
- admin-components.js (2 occurrences)

Note: Many of these occurrences are dynamic styles (e.g., `style="width: ${value}%"`) which should remain in JavaScript.
Files that still need review for static inline CSS should be prioritized.
