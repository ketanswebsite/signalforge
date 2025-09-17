const TelegramBot = require('node-telegram-bot-api');
const TradeDB = require('../../database-postgres');

// Bot configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
if (!BOT_TOKEN) {
}

// Create bot instance - disable polling on Render to avoid conflicts
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER || process.env.TELEGRAM_WEBHOOK_MODE;
const bot = BOT_TOKEN ? new TelegramBot(BOT_TOKEN, { 
    polling: !isProduction  // Only use polling in development
}) : null;

// Store user chat IDs (in production, this should be in database)
const userChatIds = new Map();

// Initialize with default chat ID if provided
if (DEFAULT_CHAT_ID) {
    userChatIds.set('default', DEFAULT_CHAT_ID);
}

// Initialize bot
function initializeTelegramBot() {
  if (!bot) {
    return;
  }
  
  
  // Clear any existing webhooks to prevent conflicts
  if (bot && !isProduction) {
    bot.deleteWebHook().catch(() => {});
  }
  
  // Add error handling
  if (!isProduction) {
    bot.on('polling_error', (error) => {
    });

    bot.on('error', (error) => {
    });
  }
  
  // Set up command handlers (works in both polling and webhook modes)
  // Note: In production, these handlers work via webhooks
    // Handle /start command with deep link support
    bot.onText(/\/start(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name;
    const parameter = match[1] ? match[1].trim() : '';
    
    // Store chat ID for user (legacy support)
    userChatIds.set(userId, chatId);
    
    try {
      let subscriptionType = 'all';
      let referralSource = null;
      let welcomeMessage = '';
      
      // Parse deep link parameters
      if (parameter) {
        const params = parameter.toLowerCase();
        
        if (params === 'subscribe' || params === 'all') {
          subscriptionType = 'all';
          welcomeMessage = `🎯 *Welcome to SignalForge Trading Signals!*\n\n` +
            `Hello ${username}! You're now subscribed to receive:\n` +
            `• 📈 7 AM Conviction Trades\n` +
            `• 🔍 High Conviction Scan Results\n` +
            `• 📊 All Trading Alerts\n\n`;
        } else if (params === 'conviction' || params === 'morning_conviction' || params === 'morning') {
          subscriptionType = 'conviction';
          welcomeMessage = `🌅 *Welcome to Morning Conviction Trades!*\n\n` +
            `Hello ${username}! You're subscribed to receive:\n` +
            `• 📈 7 AM Daily Conviction Trades\n` +
            `• ⭐ High-probability trading opportunities\n\n`;
        } else if (params === 'scans' || params === 'high_conviction_scans' || params === 'scan_results') {
          subscriptionType = 'scans';
          welcomeMessage = `🔍 *Welcome to High Conviction Scans!*\n\n` +
            `Hello ${username}! You're subscribed to receive:\n` +
            `• 🎯 High Conviction Scan Results\n` +
            `• 📊 Market Opportunity Alerts\n\n`;
        } else {
          // Handle referral or custom parameters
          referralSource = params;
          welcomeMessage = `🎯 *Welcome to SignalForge Trading Signals!*\n\n` +
            `Hello ${username}! Thanks for joining via: ${referralSource}\n\n` +
            `You're now subscribed to receive all our premium signals!\n\n`;
        }
      } else {
        // Default welcome for regular /start
        welcomeMessage = `🎯 *Welcome to SignalForge Trading Signals!*\n\n` +
          `Hello ${username}! I'll send you real-time trading signals.\n\n`;
      }
      
      // Add subscriber to database
      await TradeDB.addTelegramSubscriber(chatId, {
        id: userId,
        username: msg.from.username,
        first_name: msg.from.first_name,
        last_name: msg.from.last_name
      }, subscriptionType, referralSource);
      
      // Complete welcome message
      welcomeMessage += 
        `✅ *Subscription Active*\n` +
        `Type: ${subscriptionType.toUpperCase()}\n` +
        `Chat ID: \`${chatId}\`\n\n` +
        `*Available Commands:*\n` +
        `/status - Check subscription status\n` +
        `/change - Change subscription type\n` +
        `/stop - Unsubscribe from alerts\n` +
        `/help - Show help information\n\n` +
        `🚀 *You're all set!* Trading signals will arrive automatically.`;
      
      await bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
      
      
    } catch (error) {
      await bot.sendMessage(chatId, 
        `❌ Error setting up your subscription. Please try again or contact support.`, 
        { parse_mode: 'Markdown' }
      );
    }
  });
  
  // Handle /stop command
  bot.onText(/\/stop/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name;
    
    try {
      // Remove from legacy storage
      userChatIds.delete(userId);
      
      // Remove from database
      await TradeDB.removeTelegramSubscriber(chatId);
      
      await bot.sendMessage(chatId, 
        '🛑 *Unsubscribed Successfully*\n\n' +
        'You will no longer receive trading signals.\n\n' +
        '📧 Use /start to subscribe again anytime!\n\n' +
        'Thanks for being part of SignalForge community! 👋',
        { parse_mode: 'Markdown' }
      );
      
      
    } catch (error) {
      await bot.sendMessage(chatId, 
        '❌ Error processing unsubscribe request. Please try again.'
      );
    }
  });
  
  // Handle /status command
  bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name;
    
    try {
      // Update activity in database
      await TradeDB.updateSubscriberActivity(chatId);
      
      // Legacy support
      userChatIds.set(userId, chatId);
      
      // Get subscriber info from database
      const subscribers = await TradeDB.getAllActiveSubscribers();
      const subscriber = subscribers.find(sub => sub.chat_id === chatId.toString());
      
      if (subscriber) {
        await bot.sendMessage(chatId, 
          `📊 *Subscription Status*\n\n` +
          `Status: ✅ Active\n` +
          `Type: ${subscriber.subscription_type.toUpperCase()}\n` +
          `Subscribed: ${new Date(subscriber.subscribed_at).toLocaleDateString()}\n` +
          `Chat ID: \`${chatId}\`\n\n` +
          `🎯 *What you'll receive:*\n` +
          (subscriber.subscription_type === 'all' || subscriber.subscription_type === 'conviction' ? `• 📈 7 AM Conviction Trades\n` : '') +
          (subscriber.subscription_type === 'all' || subscriber.subscription_type === 'scans' ? `• 🔍 High Conviction Scan Results\n` : '') +
          (subscriber.subscription_type === 'all' ? `• 📊 All Trading Alerts\n` : '') +
          `\n🚀 You're all set to receive signals!`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await bot.sendMessage(chatId, 
          `⚠️ *Not Subscribed*\n\n` +
          `You're not currently subscribed to alerts.\n\n` +
          `Use /start to subscribe to trading signals!`,
          { parse_mode: 'Markdown' }
        );
      }
      
      
    } catch (error) {
      await bot.sendMessage(chatId, 
        `❌ Error checking status. Please try again.`
      );
    }
  });
  
  // Handle /change command
  bot.onText(/\/change/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      await bot.sendMessage(chatId, 
        `🔄 *Change Subscription Type*\n\n` +
        `Choose your subscription preference:\n\n` +
        `📈 /start conviction - Only 7 AM conviction trades\n` +
        `🔍 /start scans - Only high conviction scan results\n` +
        `📊 /start all - All trading signals\n\n` +
        `Just click on any option above to change your subscription!`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
    }
  });
  
  // Handle /help command
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    
    bot.sendMessage(chatId, 
      `🤖 *SignalForge Trading Bot Help*\n\n` +
      `Get premium trading signals directly to your Telegram!\n\n` +
      `*🎯 Available Subscriptions:*\n` +
      `• **All Signals** - Everything included\n` +
      `• **Conviction Trades** - 7 AM daily opportunities\n` +
      `• **High Conviction Scans** - Market scan results\n\n` +
      `*📱 Commands:*\n` +
      `/start - Subscribe to all signals\n` +
      `/start conviction - Only morning trades\n` +
      `/start scans - Only scan results\n` +
      `/status - Check subscription status\n` +
      `/change - Change subscription type\n` +
      `/stop - Unsubscribe from alerts\n` +
      `/help - Show this help\n\n` +
      `*🔗 Share Links:*\n` +
      `🎯 All: t.me/${process.env.TELEGRAM_BOT_USERNAME || 'YourBot'}?start=all\n` +
      `📈 Conviction: t.me/${process.env.TELEGRAM_BOT_USERNAME || 'YourBot'}?start=conviction\n` +
      `🔍 Scans: t.me/${process.env.TELEGRAM_BOT_USERNAME || 'YourBot'}?start=scans\n\n` +
      `*📊 Signal Types:*\n` +
      `• 🌅 7 AM conviction trades\n` +
      `• 🎯 High conviction opportunities\n` +
      `• 📈 Buy/sell signals\n` +
      `• 🛑 Risk management alerts`,
      { parse_mode: 'Markdown' }
    );
  });
  
  // Set webhook for production mode
  if (isProduction && process.env.RENDER_EXTERNAL_URL) {
    const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/api/telegram/webhook`;

    bot.setWebHook(webhookUrl).then(() => {
    }).catch(error => {
    });
  } else if (isProduction) {
  }
  
}

// Send alert to user
async function sendTelegramAlert(chatId, alert) {
  // Check if bot is available
  if (!bot) {
    return false;
  }
  
  // Use default chat ID if none provided
  if (!chatId && DEFAULT_CHAT_ID) {
    chatId = DEFAULT_CHAT_ID;
  }
  
  if (!chatId) {
    return false;
  }
  
  try {
    let emoji = '📊';
    let urgency = '';
    
    // Handle custom formatted messages
    if (alert.type === 'custom' && alert.message) {

      const result = await bot.sendMessage(chatId, alert.message, {
        parse_mode: 'Markdown'
      });
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
    
    return true;
  } catch (error) {
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
  if (!bot) {
    return null;
  }
  
  try {
    const info = await bot.getMe();
    return {
      username: info.username,
      firstName: info.first_name,
      id: info.id,
      canReadAllGroupMessages: info.can_read_all_group_messages
    };
  } catch (error) {
    return null;
  }
}

// Test connection
async function testConnection(chatId) {
  if (!bot) {
    return false;
  }
  
  try {
    await bot.sendMessage(chatId, 
      '✅ *Connection Test Successful!*\n\n' +
      'Your Telegram alerts are properly configured.\n' +
      'You will now receive trading signals from SignalForge.',
      { parse_mode: 'Markdown' }
    );
    return true;
  } catch (error) {
    return false;
  }
}

// Broadcast message to all subscribers
async function broadcastToSubscribers(alert, subscriptionType = null) {
  if (!bot) {
    return [];
  }
  
  try {
    // Get all active subscribers
    const subscribers = await TradeDB.getAllActiveSubscribers(subscriptionType);
    
    if (subscribers.length === 0) {
      return [];
    }
    
    const results = [];
    const batchSize = 30; // Telegram rate limit
    
    // Process subscribers in batches to avoid rate limiting
    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (subscriber) => {
        try {
          const success = await sendTelegramAlert(subscriber.chat_id, alert);
          if (success) {
            // Update last activity
            await TradeDB.updateSubscriberActivity(subscriber.chat_id);
          }
          return { chatId: subscriber.chat_id, success, username: subscriber.username };
        } catch (error) {
          return { chatId: subscriber.chat_id, success: false, error: error.message };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Rate limiting delay between batches
      if (i + batchSize < subscribers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    
    return results;
  } catch (error) {
    return [];
  }
}

// Process webhook updates (for production mode)
function processUpdate(update) {
  if (!bot) {
    return;
  }
  
  try {
    bot.processUpdate(update);
  } catch (error) {
  }
}

module.exports = {
  initializeTelegramBot,
  sendTelegramAlert,
  sendBulkAlerts,
  getBotInfo,
  testConnection,
  broadcastToSubscribers,
  processUpdate,
  userChatIds
};