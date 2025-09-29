/**
 * Test script for scanner cron job
 * Tests the scheduler initialization and logs timing information
 */

require('dotenv').config();
const StockScanner = require('./lib/scanner/scanner.js');

console.log('=== SCANNER CRON TEST ===\n');

// Create and initialize scanner
const scanner = new StockScanner();
scanner.initialize();

console.log('\n=== TEST COMPLETE ===');
console.log('Scanner is now running with scheduled jobs.');
console.log('Check the logs above for timing information.');
console.log('\nPress Ctrl+C to exit.');

// Keep the process alive for 10 seconds
setTimeout(() => {
    console.log('\n=== SHUTTING DOWN ===');
    scanner.stop();
    process.exit(0);
}, 10000);