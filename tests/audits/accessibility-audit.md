# Accessibility Audit Checklist
**Phase 6: Testing & Polish**
**Target: WCAG 2.1 Level AA Compliance**
**Date:** 2025-01-16

---

## 1. Perceivable

### ✅ Text Alternatives (1.1)
- [ ] All images have alt text
- [ ] Decorative images have empty alt (`alt=""`)
- [ ] Icons have aria-labels or sr-only text
- [ ] Charts have text descriptions
- [ ] Data visualizations have accessible alternatives
- [ ] Sparklines have accessible labels

### ✅ Time-Based Media (1.2)
- [ ] Video content has captions (if applicable)
- [ ] Audio content has transcripts (if applicable)
- [ ] No auto-playing media with sound

### ✅ Adaptable (1.3)
- [ ] Proper heading hierarchy (H1-H6)
- [ ] Semantic HTML used (header, nav, main, aside, footer)
- [ ] Tables use proper markup (thead, tbody, th, td)
- [ ] Forms use proper labels and fieldsets
- [ ] Lists use ul/ol/dl appropriately
- [ ] Reading order is logical
- [ ] Information not conveyed by color alone
- [ ] Form instructions programmatically associated

### ✅ Distinguishable (1.4)
- [ ] Text contrast ratio ≥ 4.5:1 (normal text)
- [ ] Text contrast ratio ≥ 3:1 (large text 18pt+)
- [ ] UI component contrast ratio ≥ 3:1
- [ ] Text can be resized to 200% without loss of functionality
- [ ] No text in images (except logos)
- [ ] Background audio can be paused/muted
- [ ] Visual focus indicator visible
- [ ] Content readable without horizontal scroll at 320px width

---

## 2. Operable

### ✅ Keyboard Accessible (2.1)
- [ ] All functionality available via keyboard
- [ ] No keyboard traps
- [ ] Keyboard shortcuts documented
- [ ] Tab order is logical
- [ ] Enter/Space activate buttons
- [ ] Escape closes modals/dropdowns
- [ ] Arrow keys navigate menus/tabs
- [ ] Skip links available

### ✅ Enough Time (2.2)
- [ ] Session timeouts have warnings
- [ ] Users can extend timeouts
- [ ] Auto-refresh can be disabled
- [ ] Moving content can be paused
- [ ] No time limits on reading (or can be extended)

### ✅ Seizures and Physical Reactions (2.3)
- [ ] No content flashes more than 3 times per second
- [ ] Animations respect `prefers-reduced-motion`
- [ ] No parallax effects (or can be disabled)

### ✅ Navigable (2.4)
- [ ] Page titles are descriptive
- [ ] Links have descriptive text (not "click here")
- [ ] Multiple navigation mechanisms
- [ ] Breadcrumb navigation (where appropriate)
- [ ] Clear focus indicators
- [ ] Heading structure provides outline
- [ ] Current page indicated in navigation
- [ ] Search functionality available

### ✅ Input Modalities (2.5)
- [ ] Touch targets ≥ 44x44px
- [ ] Pointer gestures have alternatives
- [ ] Drag-and-drop has keyboard alternative
- [ ] Motion actuation has alternatives
- [ ] Context menus accessible via keyboard

---

## 3. Understandable

### ✅ Readable (3.1)
- [ ] Page language set (`<html lang="en">`)
- [ ] Language changes marked (`lang` attribute)
- [ ] Abbreviations/acronyms explained
- [ ] Reading level appropriate
- [ ] Pronunciation provided for ambiguous words

### ✅ Predictable (3.2)
- [ ] Focus doesn't cause unexpected changes
- [ ] Input doesn't cause unexpected changes
- [ ] Navigation consistent across pages
- [ ] Components used consistently
- [ ] Changes on request (submit buttons, etc.)

### ✅ Input Assistance (3.3)
- [ ] Error messages are clear
- [ ] Form validation provides suggestions
- [ ] Labels and instructions provided
- [ ] Required fields marked
- [ ] Error prevention for critical actions
- [ ] Confirmation for data submission
- [ ] Ability to review and correct before submission

---

## 4. Robust

### ✅ Compatible (4.1)
- [ ] Valid HTML (no parsing errors)
- [ ] Elements have complete start/end tags
- [ ] No duplicate IDs
- [ ] ARIA attributes used correctly
- [ ] ARIA roles appropriate
- [ ] Name, role, value exposed for custom controls
- [ ] Status messages use aria-live

---

## Component-Specific Checks

### ✅ Forms
- [ ] All inputs have associated labels
- [ ] Required fields indicated
- [ ] Error messages associated with inputs
- [ ] Fieldsets used for related inputs
- [ ] Legends describe fieldset purpose
- [ ] Help text programmatically associated
- [ ] Inline validation accessible
- [ ] Form submission confirmation

### ✅ Data Tables
- [ ] Table has caption or aria-label
- [ ] Headers use `<th>` with scope attribute
- [ ] Complex tables use headers/id association
- [ ] Sort controls accessible
- [ ] Filter controls accessible
- [ ] Pagination accessible
- [ ] Row selection accessible

### ✅ Modals & Dialogs
- [ ] Modal traps focus
- [ ] Modal can be closed with Escape
- [ ] Focus returns to trigger on close
- [ ] Modal has aria-modal="true"
- [ ] Modal has aria-labelledby/aria-describedby
- [ ] Background content inert (aria-hidden)

### ✅ Dropdowns & Menus
- [ ] Dropdown accessible via keyboard
- [ ] Arrow keys navigate menu items
- [ ] Enter selects item
- [ ] Escape closes menu
- [ ] Current selection indicated
- [ ] aria-expanded state toggled
- [ ] aria-haspopup used appropriately

### ✅ Tabs
- [ ] Tab list has role="tablist"
- [ ] Tabs have role="tab"
- [ ] Panels have role="tabpanel"
- [ ] Active tab has aria-selected="true"
- [ ] Arrow keys navigate tabs
- [ ] Tab controls associated panel (aria-controls)
- [ ] Panel associated with tab (aria-labelledby)

### ✅ Toast Notifications
- [ ] Use aria-live for announcements
- [ ] Role="alert" for important messages
- [ ] Sufficient time to read (or can be paused)
- [ ] Action buttons accessible
- [ ] Close button accessible

### ✅ Charts & Visualizations
- [ ] Chart has descriptive title
- [ ] Data available in table format
- [ ] Color not sole means of conveying info
- [ ] Pattern/texture used with color
- [ ] Tooltips accessible (keyboard focus)
- [ ] Legend accessible

### ✅ Virtual Scroll Tables
- [ ] Screen reader support
- [ ] Keyboard navigation works
- [ ] Row count announced
- [ ] Current position announced
- [ ] Jump to row functionality

---

## Admin Portal Specific

### ✅ Dashboard
- [ ] Metrics have descriptive labels
- [ ] Charts have alt descriptions
- [ ] Quick actions keyboard accessible
- [ ] Activity feed readable by screen readers

### ✅ User Management
- [ ] Bulk actions accessible
- [ ] Filters keyboard accessible
- [ ] Search has clear label
- [ ] User details modal accessible
- [ ] Impersonate action has warning

### ✅ Analytics
- [ ] Tab navigation accessible
- [ ] Chart controls keyboard accessible
- [ ] Date range picker accessible
- [ ] Export functions labeled

### ✅ Database Tools
- [ ] Query builder keyboard accessible
- [ ] Schema viewer navigable
- [ ] Table selection accessible
- [ ] Results table accessible

### ✅ Communication Hub
- [ ] Channel toggle switches accessible
- [ ] Template editor accessible
- [ ] Notification form accessible
- [ ] History filters accessible

---

## Testing Tools

### Automated Tools
- [ ] axe DevTools
- [ ] Lighthouse Accessibility Audit
- [ ] WAVE (Web Accessibility Evaluation Tool)
- [ ] Pa11y
- [ ] HTML Validator
- [ ] Color Contrast Analyzer

### Manual Testing
- [ ] Keyboard-only navigation
- [ ] Screen reader testing (NVDA, JAWS, VoiceOver)
- [ ] Zoom to 200%
- [ ] Responsive at 320px width
- [ ] High contrast mode
- [ ] Dark mode
- [ ] Reduced motion preference

### Assistive Technology Testing
- [ ] NVDA (Windows)
- [ ] JAWS (Windows)
- [ ] VoiceOver (macOS, iOS)
- [ ] TalkBack (Android)
- [ ] ChromeVox (Chrome)

---

## Severity Levels

- **🔴 Critical**: Blocks user completely (Level A violations)
- **🟠 High**: Major barrier (Level AA violations)
- **🟡 Medium**: Moderate difficulty (Usability issues)
- **🟢 Low**: Minor issue (Enhancement)

---

## Action Items

### Critical (Fix Immediately)
- [ ] List any critical accessibility blockers

### High Priority (Fix This Week)
- [ ] List high priority issues

### Medium Priority (Fix This Month)
- [ ] List medium priority issues

### Low Priority (Enhancement)
- [ ] List nice-to-have improvements

---

## Compliance Status

| WCAG Principle | Level A | Level AA | Level AAA |
|---|---|---|---|
| Perceivable | ⬜ Pass ⬜ Fail | ⬜ Pass ⬜ Fail | ⬜ Pass ⬜ Fail |
| Operable | ⬜ Pass ⬜ Fail | ⬜ Pass ⬜ Fail | ⬜ Pass ⬜ Fail |
| Understandable | ⬜ Pass ⬜ Fail | ⬜ Pass ⬜ Fail | ⬜ Pass ⬜ Fail |
| Robust | ⬜ Pass ⬜ Fail | ⬜ Pass ⬜ Fail | ⬜ Pass ⬜ Fail |

---

## Quick Wins

Easy fixes that provide significant accessibility improvements:

1. [ ] Add alt text to all images
2. [ ] Fix heading hierarchy
3. [ ] Add focus indicators
4. [ ] Label all form inputs
5. [ ] Ensure 4.5:1 contrast ratio
6. [ ] Make all buttons keyboard accessible
7. [ ] Add skip links
8. [ ] Fix tab order
9. [ ] Add ARIA labels where needed
10. [ ] Test with keyboard only

---

## Sign-Off

**Audited By:** ___________________________
**Date:** ___________________________
**WCAG Level:** ⬜ A ⬜ AA ⬜ AAA
**Status:** ⬜ Pass ⬜ Pass with Conditions ⬜ Fail

**Notes:**
