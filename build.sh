#!/bin/bash

# Build script for Render deployment

echo "🚀 Starting build process..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create data directory for SQLite
echo "📁 Creating data directory..."
mkdir -p /var/data

# Move existing database if it exists
if [ -f "trades.db" ]; then
    echo "📂 Moving existing database to persistent storage..."
    cp trades.db /var/data/trades.db
fi

# Create symbolic link to database in persistent storage
echo "🔗 Creating database link..."
ln -sf /var/data/trades.db trades.db

echo "✅ Build complete!"