const crypto = require('crypto');
const TelegramBot = require('node-telegram-bot-api');
const TradeDB = require('../../database-postgres');
const { formatDateDDMMYYYY, formatDateTimeUK } = require('../shared/date-format');
// Every message the bot sends is counted: sent, or why Telegram refused it (GAPS #12)
const DeliveryCounts = require('./delivery-counts');
const { markdownSafe } = require('./markdown');

// Bot configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
if (!BOT_TOKEN) {
}

// Production (Render) receives updates through the webhook. Anywhere else, polling is opt-in:
// getUpdates cannot run while a webhook is set, so a polling boot deletes the webhook - and with
// the real token that is PROD's webhook, which then stops receiving bot commands until prod's
// next boot. Set TELEGRAM_POLLING=true only with a separate test bot's token.
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER || process.env.TELEGRAM_WEBHOOK_MODE;
const polling = !isProduction && process.env.TELEGRAM_POLLING === 'true';
const bot = BOT_TOKEN ? new TelegramBot(BOT_TOKEN, { polling }) : null;

// The secret Telegram must send with every webhook update: TELEGRAM_WEBHOOK_SECRET when it is set,
// otherwise one derived from the bot token, so the webhook is never open to forged updates.
// Telegram accepts 1-256 characters of A-Z, a-z, 0-9, _ and -; a hex digest fits.
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET
    || (BOT_TOKEN ? crypto.createHash('sha256').update('signalforge-telegram-webhook:' + BOT_TOKEN).digest('hex') : null);
// Enforced as soon as Telegram holds it: at once for the environment's secret (an earlier boot
// registered it), and for a derived one only after setWebHook succeeds, so a failed registration
// can never lock the bot's own updates out.
let webhookSecretActive = Boolean(process.env.TELEGRAM_WEBHOOK_SECRET);
function getWebhookSecret() {
    return webhookSecretActive ? WEBHOOK_SECRET : null;
}

// The bot's answer to a command (/start and account linking, /stop, /status, /change, /help):
// bot.sendMessage, counted as a 'bot-reply' delivery. It resolves and rejects as sendMessage does.
async function reply(to, text, options) {
  try {
    const sent = await bot.sendMessage(to, text, options);
    DeliveryCounts.sent('bot-reply');
    return sent;
  } catch (error) {
    DeliveryCounts.failed('bot-reply', error);
    throw error;
  }
}

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
  
  
  // Polling needs the webhook gone (see TELEGRAM_POLLING above); nothing else may delete it
  if (polling) {
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
    // Every text below is legacy Markdown: a name with _ or * made Telegram refuse the whole welcome
    const name = markdownSafe(username);
    
    // Store chat ID for user (legacy support)
    userChatIds.set(userId, chatId);
    
    try {
      let subscriptionType = 'all';
      let referralSource = null;
      let welcomeMessage = '';
      let linkedEmail = null;
      
      // Parse deep link parameters
      if (parameter) {
        const params = parameter.toLowerCase();

        // Check if it's a linking token (format: link_xxxxx)
        if (params.startsWith('link_')) {
          const token = params.substring(5); // Remove 'link_' prefix

          try {
            const linkResult = await TradeDB.linkTelegramToUser(token, {
              chatId: chatId,
              username: msg.from.username
            });

            if (linkResult.success) {
              welcomeMessage = `🔗 *Account Linked Successfully!*\n\n` +
                `Hello ${markdownSafe(linkResult.user.name || linkResult.user.email)}!\n\n` +
                `Your Telegram account has been linked to your SignalForge account.\n\n` +
                `✅ You'll now receive:\n` +
                `• 📧 Alerts sent to your linked account\n` +
                `• 📱 Telegram notifications for all trades\n` +
                `• 🎯 Subscription benefits via both platforms\n\n` +
                `Email: ${markdownSafe(linkResult.user.email)}\n` +
                `Telegram: @${markdownSafe(msg.from.username || 'You')}\n\n`;

              // Also subscribe them to Telegram alerts
              subscriptionType = 'all';
              linkedEmail = linkResult.user.email;
            } else {
              await reply(chatId,
                `❌ *Linking Failed*\n\n` +
                `${markdownSafe(linkResult.error)}\n\n` +
                `The linking token may be invalid or expired. Please generate a new one from your account settings.`,
                { parse_mode: 'Markdown' }
              );
              return;
            }
          } catch (error) {
            await reply(chatId,
              `❌ *Linking Error*\n\n` +
              `An error occurred while linking your account. Please try again or contact support.`,
              { parse_mode: 'Markdown' }
            );
            return;
          }
        } else if (params === 'subscribe' || params === 'all') {
          subscriptionType = 'all';
          welcomeMessage = `🎯 *Welcome to SignalForge Trading Signals!*\n\n` +
            `Hello ${name}! You're now subscribed to receive:\n` +
            `• 📈 7 AM Conviction Trades\n` +
            `• 🔍 High Conviction Scan Results\n` +
            `• 📊 All Trading Alerts\n\n`;
        } else if (params === 'conviction' || params === 'morning_conviction' || params === 'morning') {
          subscriptionType = 'conviction';
          welcomeMessage = `🌅 *Welcome to Morning Conviction Trades!*\n\n` +
            `Hello ${name}! You're subscribed to receive:\n` +
            `• 📈 7 AM Daily Conviction Trades\n` +
            `• ⭐ High-probability trading opportunities\n\n`;
        } else if (params === 'scans' || params === 'high_conviction_scans' || params === 'scan_results') {
          subscriptionType = 'scans';
          welcomeMessage = `🔍 *Welcome to High Conviction Scans!*\n\n` +
            `Hello ${name}! You're subscribed to receive:\n` +
            `• 🎯 High Conviction Scan Results\n` +
            `• 📊 Market Opportunity Alerts\n\n`;
        } else {
          // Handle referral or custom parameters
          referralSource = params;
          welcomeMessage = `🎯 *Welcome to SignalForge Trading Signals!*\n\n` +
            `Hello ${name}! Thanks for joining via: ${markdownSafe(referralSource)}\n\n` +
            `You're now subscribed to receive all our premium signals!\n\n`;
        }
      } else {
        // Default welcome for regular /start
        welcomeMessage = `🎯 *Welcome to SignalForge Trading Signals!*\n\n` +
          `Hello ${name}! I'll send you real-time trading signals.\n\n`;
      }
      
      // Add subscriber to database
      await TradeDB.addTelegramSubscriber(chatId, {
        id: userId,
        username: msg.from.username,
        first_name: msg.from.first_name,
        last_name: msg.from.last_name
      }, subscriptionType, referralSource);

      // If this /start carried a link token, stamp the app account onto the
      // subscriber row AFTER the upsert (a first-time subscriber's row only
      // exists now, so linkTelegramToUser's earlier update had nothing to hit)
      if (linkedEmail) {
        try {
          await TradeDB.pool.query(
            'UPDATE telegram_subscribers SET user_id = $1 WHERE chat_id = $2',
            [linkedEmail, chatId.toString()]
          );
        } catch (e) {
          console.error('[TELEGRAM] Could not stamp linked email on subscriber row:', e.message);
        }
      }
      
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
      
      await reply(chatId, welcomeMessage, { parse_mode: 'Markdown' });
      
      
    } catch (error) {
      await reply(chatId, 
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
      // Update activity before unsubscribing
      await TradeDB.updateSubscriberActivity(chatId);

      // Remove from legacy storage
      userChatIds.delete(userId);

      // Remove from database
      await TradeDB.removeTelegramSubscriber(chatId);
      
      await reply(chatId, 
        '🛑 *Unsubscribed Successfully*\n\n' +
        'You will no longer receive trading signals.\n\n' +
        '📧 Use /start to subscribe again anytime!\n\n' +
        'Thanks for being part of SignalForge community! 👋',
        { parse_mode: 'Markdown' }
      );
      
      
    } catch (error) {
      await reply(chatId, 
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
        await reply(chatId, 
          `📊 *Subscription Status*\n\n` +
          `Status: ✅ Active\n` +
          `Type: ${subscriber.subscription_type.toUpperCase()}\n` +
          `Subscribed: ${formatDateDDMMYYYY(subscriber.subscribed_at)}\n` +
          `Chat ID: \`${chatId}\`\n\n` +
          `🎯 *What you'll receive:*\n` +
          (subscriber.subscription_type === 'all' || subscriber.subscription_type === 'conviction' ? `• 📈 7 AM Conviction Trades\n` : '') +
          (subscriber.subscription_type === 'all' || subscriber.subscription_type === 'scans' ? `• 🔍 High Conviction Scan Results\n` : '') +
          (subscriber.subscription_type === 'all' ? `• 📊 All Trading Alerts\n` : '') +
          `\n🚀 You're all set to receive signals!`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await reply(chatId, 
          `⚠️ *Not Subscribed*\n\n` +
          `You're not currently subscribed to alerts.\n\n` +
          `Use /start to subscribe to trading signals!`,
          { parse_mode: 'Markdown' }
        );
      }
      
      
    } catch (error) {
      await reply(chatId, 
        `❌ Error checking status. Please try again.`
      );
    }
  });
  
  // Handle /change command
  bot.onText(/\/change/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      // Update activity in database
      await TradeDB.updateSubscriberActivity(chatId);

      await reply(chatId, 
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
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    // A bot's name usually ends in _bot, which legacy Markdown would read as italics
    const botName = markdownSafe(process.env.TELEGRAM_BOT_USERNAME || 'YourBot');

    try {
      // Update activity in database
      await TradeDB.updateSubscriberActivity(chatId);
    } catch (error) {
      // Continue even if activity update fails
    }

    reply(chatId, 
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
      `🎯 All: t.me/${botName}?start=all\n` +
      `📈 Conviction: t.me/${botName}?start=conviction\n` +
      `🔍 Scans: t.me/${botName}?start=scans\n\n` +
      `*📊 Signal Types:*\n` +
      `• 🌅 7 AM conviction trades\n` +
      `• 🎯 High conviction opportunities\n` +
      `• 📈 Buy/sell signals\n` +
      `• 🛑 Risk management alerts`,
      { parse_mode: 'Markdown' }
    );
  });
  
  // Set webhook for production mode with secret token verification
  if (isProduction && process.env.RENDER_EXTERNAL_URL) {
    const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/api/telegram/webhook`;
    // Always with a secret (see WEBHOOK_SECRET): forged updates are refused with 403
    const webhookOptions = { secret_token: WEBHOOK_SECRET };
    console.log(`🔐 [TELEGRAM] Setting webhook with secret token verification (${process.env.TELEGRAM_WEBHOOK_SECRET ? 'TELEGRAM_WEBHOOK_SECRET' : 'derived from the bot token'})`);

    bot.setWebHook(webhookUrl, webhookOptions).then(() => {
      webhookSecretActive = true;
      console.log('✅ [TELEGRAM] Webhook set successfully:', webhookUrl);
    }).catch(error => {
      console.error('❌ [TELEGRAM] Failed to set webhook:', error.message);
    });
  } else if (isProduction) {
    console.warn('⚠️ [TELEGRAM] Production mode but RENDER_EXTERNAL_URL not set');
  }
  
}

// Send alert to user. alert.kind labels the message for the delivery counts (lib/telegram/delivery-counts.js;
// no label counts as 'other'). Answers true when Telegram took it; a failure is counted and logged, and answers false.
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

      await bot.sendMessage(chatId, alert.message, {
        parse_mode: 'Markdown'
      });
      DeliveryCounts.sent(alert.kind);
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
      `🕐 *Time:* ${formatDateTimeUK(new Date())}\n\n` +
      (alert.notes ? `💭 *Notes:* ${alert.notes}` : '');
    
    // Send message without inline keyboard (localhost URLs not supported)
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown'
    });
    DeliveryCounts.sent(alert.kind);
    return true;
  } catch (error) {
    // Counted with Telegram's reason, and logged with the kind and the reason: never the chat or the text
    DeliveryCounts.failed(alert && alert.kind, error);
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

// Broadcast message to all subscribers; each send is counted under alert.kind (see sendTelegramAlert)
async function broadcastToSubscribers(alert, subscriptionType = null) {
  if (!bot) {
    console.log(`⚠️ [TELEGRAM] Cannot broadcast - bot not initialized`);
    return [];
  }

  try {
    // Get all active subscribers
    const subscribers = await TradeDB.getAllActiveSubscribers(subscriptionType);

    if (subscribers.length === 0) {
      console.log(`⚠️ [TELEGRAM] No active subscribers found for type: ${subscriptionType || 'all'}`);
      return [];
    }

    console.log(`📤 [TELEGRAM] Broadcasting to ${subscribers.length} subscribers (type: ${subscriptionType || 'all'})`);

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
          console.log(`⚠️ [TELEGRAM] Failed to send to ${subscriber.chat_id}: ${error.message}`);
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

    console.log(`✅ [TELEGRAM] Broadcast complete: ${successCount} success, ${failCount} failed`);

    return results;
  } catch (error) {
    console.error(`❌ [TELEGRAM] Broadcast error: ${error.message}`);
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
  broadcastToSubscribers,
  processUpdate,
  getWebhookSecret,
  userChatIds
};