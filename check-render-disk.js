const fs = require('fs');
const path = require('path');

console.log('=== Render Disk Check ===\n');

// Check if we're on Render
console.log('Environment:');
console.log('- RENDER:', process.env.RENDER ? 'Yes' : 'No');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- Working directory:', process.cwd());
console.log('');

// Check various disk locations
const pathsToCheck = [
  '/opt/render/project/src',  // Render's default persistent disk location
  '/var/data',                // Custom mount point
  process.cwd(),              // Current directory
  path.join(process.cwd(), 'database'),
  path.join(process.cwd(), 'trades.db'),
  '/opt/render/project/src/trades.db'
];

console.log('Checking disk locations:');
pathsToCheck.forEach(p => {
  try {
    const exists = fs.existsSync(p);
    if (exists) {
      const stats = fs.statSync(p);
      console.log(`✓ ${p}`);
      console.log(`  - Type: ${stats.isDirectory() ? 'Directory' : 'File'}`);
      console.log(`  - Size: ${stats.size} bytes`);
      
      // Check write permissions
      try {
        fs.accessSync(p, fs.constants.W_OK);
        console.log(`  - Writable: Yes`);
      } catch {
        console.log(`  - Writable: No`);
      }
    } else {
      console.log(`✗ ${p} - Not found`);
    }
  } catch (error) {
    console.log(`✗ ${p} - Error: ${error.message}`);
  }
  console.log('');
});

// Check database configuration
console.log('Database Configuration:');
console.log('- DB_PATH from config:', process.env.DB_PATH || 'Not set');

// Try to load database config
try {
  const dbConfig = require('./database-config');
  console.log('- DB_PATH from database-config.js:', dbConfig.DB_PATH);
} catch (e) {
  console.log('- Could not load database-config.js:', e.message);
}

// Check if SQLite can be loaded
console.log('\nSQLite Status:');
try {
  require('better-sqlite3');
  console.log('✓ better-sqlite3 can be loaded');
} catch (e) {
  console.log('✗ better-sqlite3 failed:', e.message);
}

// Show render.yaml configuration reminder
console.log('\n=== Action Items ===');
console.log('1. Check your Render dashboard for disk configuration');
console.log('2. Ensure your render.yaml has a disk mount:');
console.log('   disk:');
console.log('     name: stockproxy-data');
console.log('     mountPath: /var/data');
console.log('     sizeGB: 1');
console.log('3. Set environment variable: DB_PATH=/var/data/trades.db');
console.log('4. Rebuild with better-sqlite3 in package.json');