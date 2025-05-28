# SignalForge Telegram Alerts Setup Guide

## Quick Setup (5 minutes)

### Step 1: Create Your Telegram Bot
1. Open Telegram and search for `@BotFather`
2. Send `/newbot` to BotFather
3. Choose a name for your bot (e.g., "My SignalForge Alerts")
4. Choose a username ending in `bot` (e.g., `MySignalForgeBot`)
5. Copy the bot token that BotFather gives you

### Step 2: Configure Your Bot Token
1. Open `telegram-bot.js` 
2. Replace `YOUR_BOT_TOKEN_HERE` with your actual bot token:
   ```javascript
   const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_ACTUAL_TOKEN_HERE';
   ```

### Step 3: Install Dependencies
```bash
npm install
```

### Step 4: Start the Server
```bash
npm start
```

### Step 5: Connect Your Telegram
1. Open your bot in Telegram (search for the username you created)
2. Click "Start" or send `/start`
3. The bot will send you your Chat ID
4. Go to SignalForge website and click the "Alerts" button
5. Enter your Chat ID and enable Telegram alerts
6. Click "Test Connection" to verify

## Available Commands
- `/start` - Get your Chat ID and subscribe to alerts
- `/stop` - Unsubscribe from alerts
- `/status` - Check your subscription status
- `/help` - Show help message

## Alert Types
- 📈 **Buy Signals** - When a new buy opportunity is detected
- 📉 **Sell Signals** - When it's time to exit a position
- 🎯 **Target Reached** - When your profit target is hit
- 🛑 **Stop Loss** - When stop loss is triggered
- ⏰ **Time Exit** - When holding period expires
- 🔔 **Market Open/Close** - Daily market status updates

## Security Notes
- Never share your bot token publicly
- For production, use environment variables:
  ```bash
  TELEGRAM_BOT_TOKEN=your_token_here npm start
  ```
- The bot only responds to users who have explicitly started it

## Troubleshooting

### Bot not responding?
1. Check that the bot token is correct
2. Ensure the server is running
3. Try sending `/start` again

### Not receiving alerts?
1. Verify Telegram alerts are enabled in settings
2. Check that your Chat ID is correct
3. Ensure you have active trades

### Connection test failed?
1. Make sure the bot is running
2. Check your internet connection
3. Verify the Chat ID is numeric

## Advanced Configuration

### Custom Alert Times
Edit `server.js` to change the alert checking interval:
```javascript
// Check alerts every 5 minutes (default)
setInterval(checkTradeAlerts, 5 * 60 * 1000);

// Change to every 1 minute for more frequent alerts
setInterval(checkTradeAlerts, 60 * 1000);
```

### Multiple Users
The system supports multiple users. Each user needs to:
1. Start the bot to get their Chat ID
2. Configure their own alert preferences in SignalForge

## Support
If you encounter issues:
1. Check the server console for error messages
2. Verify all setup steps were completed
3. Restart the server and try again

Happy Trading! 🚀