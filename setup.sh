#!/bin/bash

echo "===================================="
echo "DTI Stock Trading Backtester Setup"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null
then
    echo -e "${RED}[ERROR] Node.js is not installed!${NC}"
    echo ""
    echo "Please install Node.js from: https://nodejs.org/"
    echo "Download the LTS version and run the installer."
    echo ""
    echo "For Ubuntu/Debian: sudo apt-get install nodejs npm"
    echo "For macOS with Homebrew: brew install node"
    echo ""
    exit 1
fi

echo -e "${GREEN}[OK] Node.js is installed${NC}"
node --version
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null
then
    echo -e "${RED}[ERROR] npm is not installed!${NC}"
    echo ""
    exit 1
fi

echo -e "${GREEN}[OK] npm is installed${NC}"
npm --version
echo ""

# Install dependencies
echo "Installing dependencies..."
echo "This may take a few minutes..."
echo ""
npm install

if [ $? -ne 0 ]; then
    echo ""
    echo -e "${RED}[ERROR] Failed to install dependencies!${NC}"
    echo "Please check your internet connection and try again."
    exit 1
fi

echo ""
echo "===================================="
echo -e "${GREEN}Setup completed successfully!${NC}"
echo "===================================="
echo ""
echo "To start the application, run: ./start.sh"
echo "Or type: npm start"
echo ""
echo "The application will be available at:"
echo "http://localhost:3000"
echo ""