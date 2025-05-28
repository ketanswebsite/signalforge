const TelegramBot = require('node-telegram-bot-api');

// Bot configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7628504638:AAG_ehLISYdCT4JEMdHJh2tSTCVl0Df5JR0';
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Store user chat IDs (in production, this should be in database)
const userChatIds = new Map();

// Initialize bot
function initializeTelegramBot() {
  console.log('🤖 Initializing Telegram bot...');
  
  // Handle /start command
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name;
    
    // Store chat ID for user
    userChatIds.set(userId, chatId);
    
    // Send welcome message
    bot.sendMessage(chatId, 
      `🎯 Welcome to SignalForge Alerts!\n\n` +
      `Hello ${username}, I'll send you real-time trading signals.\n\n` +
      `Your Chat ID: \`${chatId}\`\n` +
      `Your User ID: \`${userId}\`\n\n` +
      `Available commands:\n` +
      `/start - Start receiving alerts\n` +
      `/stop - Stop receiving alerts\n` +
      `/status - Check your alert status\n` +
      `/help - Show this help message\n\n` +
      `To connect this bot to your SignalForge account, go to Settings > Alerts and enter your Chat ID.\n\n` +
      `⚡ *Important*: Make sure to save your Chat ID in SignalForge settings to receive alerts even after server restarts.`,
      { parse_mode: 'Markdown' }
    );
    
    console.log(`New user registered: ${username} (${chatId})`);
  });
  
  // Handle /stop command
  bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    userChatIds.delete(userId);
    
    bot.sendMessage(chatId, 
      '🛑 You have been unsubscribed from SignalForge alerts.\n\n' +
      'Use /start to subscribe again.'
    );
  });
  
  // Handle /status command
  bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Always add user to active list when they check status
    userChatIds.set(userId, chatId);
    console.log(`Status check - activated user: ${userId} (${chatId})`);
    
    bot.sendMessage(chatId, 
      `📊 *Alert Status*\n\n` +
      `Status: ✅ Active\n` +
      `Chat ID: \`${chatId}\`\n` +
      `User ID: \`${userId}\`\n\n` +
      `✨ You're all set to receive alerts!\n` +
      `Make sure to save your Chat ID in SignalForge settings.`,
      { parse_mode: 'Markdown' }
    );
  });
  
  // Handle /help command
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    
    bot.sendMessage(chatId, 
      `🤖 *SignalForge Alert Bot Help*\n\n` +
      `This bot sends you real-time trading signals from SignalForge.\n\n` +
      `*Commands:*\n` +
      `/start - Start receiving alerts\n` +
      `/stop - Stop receiving alerts\n` +
      `/status - Check your alert status\n` +
      `/help - Show this help message\n\n` +
      `*Setup Instructions:*\n` +
      `1. Use /start to get your Chat ID\n` +
      `2. Go to SignalForge Settings > Alerts\n` +
      `3. Enter your Chat ID\n` +
      `4. Enable Telegram alerts\n\n` +
      `*Alert Types:*\n` +
      `• 📈 Buy signals\n` +
      `• 📉 Sell signals\n` +
      `• 🎯 Target reached\n` +
      `• 🛑 Stop loss hit\n` +
      `• ⏰ Time-based exits`,
      { parse_mode: 'Markdown' }
    );
  });
  
  console.log('✅ Telegram bot initialized successfully');
}

// Send alert to user
async function sendTelegramAlert(chatId, alert) {
  try {
    let emoji = '📊';
    let urgency = '';
    
    // Handle custom formatted messages
    if (alert.type === 'custom' && alert.message) {
      console.log(`📤 Attempting to send message to ${chatId}:`, alert.message.substring(0, 100) + '...');
      
      const result = await bot.sendMessage(chatId, alert.message, {
        parse_mode: 'Markdown'
      });
      
      console.log(`✅ Custom alert sent successfully to ${chatId}. Message ID:`, result.message_id);
      return true;
    }
    
    // Set emoji and urgency based on alert type
    switch (alert.type) {
      case 'buy_signal':
        emoji = '📈';
        urgency = '🟢 BUY SIGNAL';
        break;
      case 'sell_signal':
        emoji = '📉';
        urgency = '🔴 SELL SIGNAL';
        break;
      case 'target_reached':
        emoji = '🎯';
        urgency = '✅ TARGET REACHED';
        break;
      case 'stop_loss':
        emoji = '🛑';
        urgency = '⚠️ STOP LOSS';
        break;
      case 'time_exit':
        emoji = '⏰';
        urgency = '⏱️ TIME EXIT';
        break;
      case 'market_open':
        emoji = '🔔';
        urgency = '📢 MARKET OPEN';
        break;
      case 'market_close':
        emoji = '🔕';
        urgency = '📢 MARKET CLOSE';
        break;
    }
    
    // Format the message
    const message = `${emoji} *${urgency}*\n\n` +
      `📊 *Stock:* ${alert.stock}\n` +
      `💰 *Price:* ${alert.currencySymbol || '₹'}${alert.price}\n` +
      (alert.action ? `🎬 *Action:* ${alert.action}\n` : '') +
      (alert.entryPrice ? `📍 *Entry:* ${alert.currencySymbol || '₹'}${alert.entryPrice}\n` : '') +
      (alert.targetPrice ? `🎯 *Target:* ${alert.currencySymbol || '₹'}${alert.targetPrice}\n` : '') +
      (alert.stopLoss ? `🛑 *Stop Loss:* ${alert.currencySymbol || '₹'}${alert.stopLoss}\n` : '') +
      (alert.profitLoss ? `💹 *P/L:* ${alert.profitLoss}%\n` : '') +
      (alert.reason ? `📝 *Reason:* ${alert.reason}\n` : '') +
      `🕐 *Time:* ${new Date().toLocaleString()}\n\n` +
      (alert.notes ? `💭 *Notes:* ${alert.notes}` : '');
    
    // Send message without inline keyboard (localhost URLs not supported)
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown'
    });
    
    console.log(`✅ Alert sent to ${chatId}: ${alert.type} for ${alert.stock}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send Telegram alert to ${chatId}:`, error.message);
    return false;
  }
}

// Send bulk alerts
async function sendBulkAlerts(alerts) {
  const results = [];
  
  for (const alert of alerts) {
    if (alert.chatId) {
      const sent = await sendTelegramAlert(alert.chatId, alert);
      results.push({ chatId: alert.chatId, success: sent });
    }
  }
  
  return results;
}

// Get bot info
async function getBotInfo() {
  try {
    const info = await bot.getMe();
    return {
      username: info.username,
      firstName: info.first_name,
      id: info.id,
      canReadAllGroupMessages: info.can_read_all_group_messages
    };
  } catch (error) {
    console.error('Failed to get bot info:', error);
    return null;
  }
}

// Test connection
async function testConnection(chatId) {
  try {
    await bot.sendMessage(chatId, 
      '✅ *Connection Test Successful!*\n\n' +
      'Your Telegram alerts are properly configured.\n' +
      'You will now receive trading signals from SignalForge.',
      { parse_mode: 'Markdown' }
    );
    return true;
  } catch (error) {
    console.error('Connection test failed:', error);
    return false;
  }
}

module.exports = {
  initializeTelegramBot,
  sendTelegramAlert,
  sendBulkAlerts,
  getBotInfo,
  testConnection,
  userChatIds
};