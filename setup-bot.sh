#!/bin/bash

# Telegram Bot Setup Script
echo "🤖 Setting up Telegram Bot..."

# Check if bot token is provided
if [ -z "$1" ]; then
    echo "Usage: ./setup-bot.sh YOUR_BOT_TOKEN"
    echo "Get your bot token from @BotFather"
    exit 1
fi

BOT_TOKEN=$1
echo "Using bot token: ${BOT_TOKEN:0:20}..."

# Set bot commands
echo "📝 Setting bot commands..."
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      {"command": "start", "description": "Subscribe to trading signals"},
      {"command": "status", "description": "Check subscription status"},
      {"command": "change", "description": "Change subscription type"},
      {"command": "stop", "description": "Unsubscribe from alerts"},
      {"command": "help", "description": "Show help information"}
    ]
  }'

echo -e "\n"

# Get bot info
echo "🔍 Getting bot information..."
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getMe" | jq .

echo -e "\n"

# Check current webhook status
echo "🔗 Checking webhook status..."
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | jq .

echo -e "\n✅ Bot setup commands sent!"
echo "📱 Test your bot by sending /start"
echo "🎯 Share link: https://t.me/$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getMe" | jq -r '.result.username')?start=all"