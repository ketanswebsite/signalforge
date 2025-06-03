#!/bin/bash

# Build script for Render deployment
echo "🚀 Starting build process for Render..."

# Install dependencies (skip optional dependencies on Render)
echo "📦 Installing dependencies..."
if [ "$RENDER" = "true" ]; then
    echo "🔄 Render environment detected - installing without optional dependencies..."
    npm install --no-optional
else
    echo "📦 Installing all dependencies including optional ones..."
    npm install
fi

echo "✅ Build complete!"