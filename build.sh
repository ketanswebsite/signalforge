#!/bin/bash

# Build script for Render deployment
echo "🚀 Starting build process for Render..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install better-sqlite3 with proper build flags for Render
echo "📦 Reinstalling better-sqlite3 for Render environment..."
npm uninstall better-sqlite3
npm install better-sqlite3 --build-from-source

echo "✅ Build complete!"