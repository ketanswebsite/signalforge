/**
 * Jest configuration for the unit suites (npm test). The endpoint harness has its own:
 * tests/endpoints/jest.config.js (npm run test:endpoints).
 */

module.exports = {
    // Test environment
    testEnvironment: 'jsdom',

    // Setup files
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

    // Test match patterns
    testMatch: [
        '**/tests/unit/**/*.test.js'
    ],

    // Coverage configuration
    collectCoverageFrom: [
        'public/js/admin-*.js',
        '!public/js/admin-*.test.js',
        '!**/node_modules/**',
        '!**/vendor/**'
    ],

    coverageDirectory: 'coverage',

    coverageReporters: ['text', 'lcov', 'html'],

    // Module paths
    moduleDirectories: ['node_modules', 'public/js'],

    // Transform files (if using babel)
    transform: {},

    // Mock static assets
    moduleNameMapper: {
        '\\.(css|less|scss|sass)$': '<rootDir>/tests/__mocks__/styleMock.js',
        '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/tests/__mocks__/fileMock.js'
    },

    // Test timeout
    testTimeout: 10000,

    // Verbose output
    verbose: true,

    // Clear mocks between tests
    clearMocks: true,

    // Restore mocks between tests
    restoreMocks: true
};
