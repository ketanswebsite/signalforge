/**
 * Endpoint harness: every HTTP route, exercised against a real server process.
 * Run from a git-archive export of the commit under test:  npm run test:endpoints
 * (see tests/endpoints/harness/global-setup.js).
 */
module.exports = {
    rootDir: '../..',
    testMatch: ['<rootDir>/tests/endpoints/**/*.test.js'],
    testEnvironment: 'node',
    globalSetup: '<rootDir>/tests/endpoints/harness/global-setup.js',
    globalTeardown: '<rootDir>/tests/endpoints/harness/global-teardown.js',
    maxWorkers: 1,
    testTimeout: 30000
};
