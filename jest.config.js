/**
 * Jest configuration for the unit suites (npm test). The endpoint harness has its own:
 * tests/endpoints/jest.config.js (npm run test:endpoints).
 */

module.exports = {
    // Test environment
    testEnvironment: 'jsdom',

    // Test match patterns
    testMatch: [
        '**/tests/unit/**/*.test.js'
    ],

    // Coverage configuration
    coverageDirectory: 'coverage',

    coverageReporters: ['text', 'lcov', 'html'],

    // No transform: the suites and the code they load run as written
    transform: {},

    // Test timeout
    testTimeout: 10000,

    // Verbose output
    verbose: true,

    // Clear mocks between tests
    clearMocks: true,

    // Restore mocks between tests
    restoreMocks: true
};
