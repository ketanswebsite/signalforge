#!/bin/bash

# Script to reset Telegram webhook and clear pending updates
# Run this after deploying webhook fixes

BOT_TOKEN="7628504638:AAG_ehLISYdCT4JEMdHJh2tSTCVl0Df5JR0"
WEBHOOK_URL="https://stock-proxy.onrender.com/api/telegram/webhook"

echo "🔧 Resetting Telegram Webhook..."
echo ""

# Step 1: Delete existing webhook (clears pending updates)
echo "1️⃣ Deleting existing webhook and clearing pending updates..."
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook?drop_pending_updates=true" | jq .
echo ""

# Step 2: Set new webhook
echo "2️⃣ Setting new webhook URL: ${WEBHOOK_URL}"
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${WEBHOOK_URL}" | jq .
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
echo "Now test by sending /start to @MySignalForgeBot in Telegram"