#!/bin/bash

echo "==============================================="
echo "    RENDER BUILD SCRIPT"
echo "==============================================="

# Exit on any error
set -e

echo "✓ Starting build process..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if package.json has a build script, if so run it
if npm run | grep -q "build"; then
    echo "🔨 Running build script..."
    npm run build
else
    echo "ℹ️  No build script found in package.json, skipping..."
fi

# Note: No local directories needed - using PostgreSQL database

# Check environment variables
echo "🔧 Checking environment variables..."
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  WARNING: DATABASE_URL not set"
else
    echo "✓ DATABASE_URL is configured"
fi

if [ -z "$NODE_ENV" ]; then
    echo "⚠️  WARNING: NODE_ENV not set, defaulting to production"
    export NODE_ENV=production
else
    echo "✓ NODE_ENV is set to: $NODE_ENV"
fi

# Verify critical files exist
echo "📋 Verifying critical files..."
if [ ! -f "server.js" ]; then
    echo "❌ ERROR: server.js not found!"
    exit 1
fi

if [ ! -f "database-postgres.js" ]; then
    echo "❌ ERROR: database-postgres.js not found!"
    exit 1
fi

if [ ! -f "package.json" ]; then
    echo "❌ ERROR: package.json not found!"
    exit 1
fi

echo "✅ All critical files found"

# Test database connection (optional, comment out if causing issues)
echo "🔗 Testing database connection..."
node -e "
const db = require('./database-postgres');
if (db.isConnected()) {
    console.log('✓ Database connection test passed');
} else {
    console.log('⚠️  Database connection test failed - this may be expected during build');
}
" || echo "⚠️  Database test skipped (connection may not be available during build)"

echo "✅ Build completed successfully!"
echo "==============================================="