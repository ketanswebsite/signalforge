# Testing Infrastructure
**Admin Portal V2 - Phase 6: Testing & Polish**

This directory contains the comprehensive testing infrastructure for the Admin Portal V2, including unit tests, integration tests, performance benchmarks, and audit checklists.

---

## 📁 Directory Structure

```
tests/
├── setup.js                    # Jest test setup and mocks
├── __mocks__/                  # Mock files
│   ├── styleMock.js           # CSS module mock
│   └── fileMock.js            # File/image mock
├── unit/                       # Unit tests
│   ├── admin-components-v2.test.js
│   ├── admin-performance.test.js
│   └── admin-virtual-scroll.test.js
├── integration/                # Integration tests
│   └── api-interactions.test.js
├── performance/                # Performance benchmarks
│   └── benchmark.js
└── audits/                     # Audit checklists
    ├── security-audit.md
    └── accessibility-audit.md
```

---

## 🚀 Quick Start

### Install Dependencies

```bash
npm install
```

This will install Jest and other testing dependencies listed in `package.json`.

### Run All Tests

```bash
npm test
```

### Run Unit Tests Only

```bash
npm run test:unit
```

### Run Integration Tests Only

```bash
npm run test:integration
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Generate Coverage Report

```bash
npm run test:coverage
```

Coverage reports will be generated in the `coverage/` directory.

### Run Performance Benchmarks

```bash
npm run benchmark
```

---

## 📝 Unit Tests

Unit tests focus on testing individual modules in isolation. Each module has comprehensive test coverage for its core functionality.

### Covered Modules:

- **AdminComponentsV2** (`admin-components-v2.test.js`)
  - Enhanced metric cards
  - Toast notifications
  - Confirmation dialogs
  - Modals
  - Skeleton loaders
  - Searchable dropdowns
  - Date range pickers

- **AdminPerformance** (`admin-performance.test.js`)
  - Module lazy loading
  - Response caching
  - Request batching
  - Performance metrics
  - Cache operations
  - Image lazy loading

- **AdminVirtualScroll** (`admin-virtual-scroll.test.js`)
  - Virtual scroll table creation
  - Virtual scroll list creation
  - Data updates
  - Scroll to index
  - Visible range calculation
  - Instance management
  - Performance characteristics

### Writing New Unit Tests

```javascript
describe('ModuleName', () => {
    beforeEach(() => {
        // Setup
    });

    describe('functionName', () => {
        it('should do something', () => {
            // Test
            expect(result).toBe(expected);
        });
    });
});
```

---

## 🔗 Integration Tests

Integration tests verify that different parts of the system work together correctly, especially API interactions.

### Covered APIs:

- **User Management API**
  - Fetch user list
  - Fetch user details
  - Update user
  - Error handling

- **Analytics API**
  - Cohort analysis
  - Funnel visualization
  - Retention metrics

- **Database API**
  - Schema fetching
  - Query execution
  - Query validation

- **Communication Hub API**
  - Channel management
  - Notification sending
  - History tracking

- **RBAC API**
  - Role management
  - Permission assignment

- **2FA API**
  - Secret generation
  - Enablement/disablement
  - Verification

### Adding Integration Tests

```javascript
describe('API Integration Tests', () => {
    beforeEach(() => {
        global.fetch.mockClear();
    });

    it('should fetch data from API', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: 'test' })
        });

        const response = await fetch('/api/endpoint');
        const data = await response.json();

        expect(data).toEqual({ data: 'test' });
    });
});
```

---

## ⚡ Performance Benchmarking

The performance benchmarking suite measures execution time of critical operations and compares against defined thresholds.

### Benchmark Categories:

- **Component Rendering** (threshold: 50ms)
  - Metric cards
  - Toast notifications
  - Modals

- **Data Processing** (threshold: 100ms)
  - Array filtering (10K items)
  - Array sorting (10K items)
  - Array mapping (10K items)
  - Object transformation (1K items)

- **Table Rendering** (threshold: 150ms)
  - 100 rows
  - 1000 rows

- **Cache Operations** (threshold: 5ms)
  - Write
  - Read (hit/miss)
  - Delete

- **Virtual Scroll** (threshold: 100ms)
  - Initialization (10K items)
  - Update visible rows

### Running Benchmarks

```bash
npm run benchmark
```

Results include:
- Minimum, maximum, mean, median
- P95 and P99 percentiles
- Pass/fail against thresholds
- Exportable JSON report

### Benchmark Thresholds

```javascript
thresholds: {
    componentRender: 50,    // ms
    apiCall: 200,           // ms
    dataProcessing: 100,    // ms
    chartRender: 100,       // ms
    tableRender: 150,       // ms
    virtualScrollInit: 100, // ms
    cacheOperation: 5       // ms
}
```

---

## 🔒 Security Audit

The security audit checklist (`audits/security-audit.md`) covers:

1. **Authentication & Authorization**
   - Password requirements
   - Session management
   - 2FA implementation
   - RBAC enforcement

2. **Input Validation & Sanitization**
   - XSS protection
   - SQL injection prevention
   - Command injection prevention

3. **Data Protection**
   - Data in transit (HTTPS, TLS)
   - Data at rest (encryption)
   - Data privacy (GDPR)

4. **API Security**
   - Rate limiting
   - Authentication
   - CORS configuration

5. **Frontend Security**
   - Client-side security
   - Dependency management

6. **Communication Hub Security**
   - Credential protection
   - Message sanitization

7. **Database Security**
   - Query validation
   - Access control

8. **Audit Logging**
   - Activity logging
   - Sensitive data handling

9. **Error Handling**
   - Secure error messages
   - No stack trace exposure

10. **Security Headers**
    - CSP, X-Frame-Options, etc.

### Severity Levels:
- 🔴 **Critical**: Immediate fix required
- 🟠 **High**: Fix soon
- 🟡 **Medium**: Should fix
- 🟢 **Low**: Nice to have

---

## ♿ Accessibility Audit

The accessibility audit checklist (`audits/accessibility-audit.md`) targets **WCAG 2.1 Level AA compliance**.

### Four Principles (POUR):

1. **Perceivable**
   - Text alternatives
   - Adaptable content
   - Distinguishable (contrast, sizing)

2. **Operable**
   - Keyboard accessible
   - Sufficient time
   - Navigable
   - Input modalities

3. **Understandable**
   - Readable
   - Predictable
   - Input assistance

4. **Robust**
   - Compatible with assistive technologies
   - Valid HTML
   - Proper ARIA usage

### Component-Specific Checks:
- Forms
- Data tables
- Modals & dialogs
- Dropdowns & menus
- Tabs
- Toast notifications
- Charts & visualizations
- Virtual scroll tables

### Testing Tools:
- axe DevTools
- Lighthouse
- WAVE
- Pa11y
- Screen readers (NVDA, JAWS, VoiceOver)

### Quick Wins:
1. Add alt text to images
2. Fix heading hierarchy
3. Add focus indicators
4. Label form inputs
5. Ensure contrast ratios
6. Keyboard accessibility
7. Add skip links
8. Fix tab order
9. Add ARIA labels
10. Keyboard testing

---

## 📊 Coverage Goals

| Metric | Target | Current |
|--------|--------|---------|
| Statements | 70% | TBD |
| Branches | 70% | TBD |
| Functions | 70% | TBD |
| Lines | 70% | TBD |

Run `npm run test:coverage` to see current coverage.

---

## 🛠️ Testing Tools

### Installed:
- **Jest**: Test framework
- **jest-environment-jsdom**: DOM environment for tests
- **@testing-library/jest-dom**: Additional matchers

### Recommended (not installed):
- **Playwright** or **Cypress**: E2E testing
- **axe-core**: Accessibility testing
- **Lighthouse CI**: Performance/accessibility CI
- **Snyk**: Security vulnerability scanning

---

## 🎯 Best Practices

### Unit Tests:
- Test one thing at a time
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies
- Aim for 70%+ coverage

### Integration Tests:
- Test realistic scenarios
- Mock external services
- Test error handling
- Verify API contracts

### Performance Tests:
- Test with realistic data sizes
- Set meaningful thresholds
- Run on consistent hardware
- Track trends over time

### Accessibility:
- Test with keyboard only
- Use screen readers
- Check color contrast
- Validate HTML
- Test responsive design

### Security:
- Never commit secrets
- Sanitize all inputs
- Use parameterized queries
- Implement rate limiting
- Log security events

---

## 📚 Resources

- [Jest Documentation](https://jestjs.io/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [MDN Web Docs - Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [Web.dev - Performance](https://web.dev/performance/)

---

## 🤝 Contributing

When adding new features:

1. ✅ Write unit tests for new modules
2. ✅ Add integration tests for new APIs
3. ✅ Update benchmarks for performance-critical code
4. ✅ Run security audit checklist
5. ✅ Run accessibility audit checklist
6. ✅ Ensure all tests pass
7. ✅ Maintain >70% coverage

---

## 📞 Support

For questions or issues with the testing infrastructure:
- Check existing test files for examples
- Refer to Jest documentation
- Review audit checklists for standards
- Consult Phase 6 documentation in `ADMIN_V2_CHANGELOG.md`

---

**Last Updated:** 2025-01-16
**Phase:** 6 - Testing & Polish
**Status:** ✅ Complete
