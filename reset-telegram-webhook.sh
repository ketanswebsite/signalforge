#!/bin/bash

# Script to reset Telegram webhook and clear pending updates
# Run this after deploying webhook fixes
#
# SECURITY: Bot token should be passed as environment variable, NOT hardcoded
# Usage: TELEGRAM_BOT_TOKEN=your_token ./reset-telegram-webhook.sh

# Check if BOT_TOKEN is set
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "❌ Error: TELEGRAM_BOT_TOKEN environment variable is not set"
    echo ""
    echo "Usage: TELEGRAM_BOT_TOKEN=your_token ./reset-telegram-webhook.sh"
    echo "   or: export TELEGRAM_BOT_TOKEN=your_token && ./reset-telegram-webhook.sh"
    exit 1
fi

BOT_TOKEN="$TELEGRAM_BOT_TOKEN"
WEBHOOK_URL="${RENDER_EXTERNAL_URL:-https://stock-proxy.onrender.com}/api/telegram/webhook"
WEBHOOK_SECRET="$TELEGRAM_WEBHOOK_SECRET"

echo "🔧 Resetting Telegram Webhook..."
echo ""

# Step 1: Delete existing webhook (clears pending updates)
echo "1️⃣ Deleting existing webhook and clearing pending updates..."
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook?drop_pending_updates=true" | jq .
echo ""

# Step 2: Set new webhook with optional secret token
echo "2️⃣ Setting new webhook URL: ${WEBHOOK_URL}"
if [ -n "$WEBHOOK_SECRET" ]; then
    echo "   🔐 Using secret token for verification"
    curl -s "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${WEBHOOK_URL}&secret_token=${WEBHOOK_SECRET}" | jq .
else
    echo "   ⚠️  No secret token configured (TELEGRAM_WEBHOOK_SECRET not set)"
    curl -s "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${WEBHOOK_URL}" | jq .
fi
echo ""

# Step 3: Verify webhook is set
echo "3️⃣ Verifying webhook status..."
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | jq .
echo ""

echo "✅ Webhook reset complete!"
echo ""
echo "Check for:"
echo "  - url: ${WEBHOOK_URL} ✅"
echo "  - pending_update_count: 0 ✅"
echo "  - last_error_message: should be absent ✅"
echo ""
echo "Now test by sending /start to your bot in Telegram"
