#!/bin/bash

# Telegram Bot Setup Script
echo "🤖 Setting up Telegram Bot..."

# The token comes from the environment, never the command line (shell history and the process list would keep it),
# and is never printed.
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "Usage: TELEGRAM_BOT_TOKEN=your_token ./scripts/setup-bot.sh"
    echo "Get your bot token from @BotFather"
    exit 1
fi

BOT_TOKEN="$TELEGRAM_BOT_TOKEN"

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