#!/usr/bin/env node

// Script to set up Telegram alerts directly in the database
require('dotenv').config();

// Load database module
let TradeDB;
try {
  TradeDB = require('./database-postgres');
  if (!TradeDB.isConnected()) {
    console.log('PostgreSQL not connected, using JSON database');
    TradeDB = require('./database-json');
  }
} catch (err) {
  console.log('Using JSON database');
  TradeDB = require('./database-json');
}

async function setupTelegramAlerts() {
  console.log('🔧 Setting up Telegram alerts...\n');
  
  const chatId = process.env.TELEGRAM_CHAT_ID || '6168209389';
  const users = ['default', 'ketanjoshisahs@gmail.com', 'ketan.g.joshi@hotmail.com'];
  
  for (const userId of users) {
    console.log(`\n📝 Setting up alerts for user: ${userId}`);
    
    try {
      // Check existing preferences
      const existing = await TradeDB.getAlertPreferences(userId);
      console.log(`   Current status: ${existing ? 'Has preferences' : 'No preferences'}`);
      
      if (existing) {
        console.log(`   - Telegram enabled: ${existing.telegram_enabled}`);
        console.log(`   - Chat ID: ${existing.telegram_chat_id}`);
      }
      
      // Save/update preferences
      const prefs = {
        user_id: userId,
        telegram_enabled: true,
        telegram_chat_id: chatId,
        email_enabled: false,
        email_address: userId.includes('@') ? userId : null,
        alert_on_buy: true,
        alert_on_sell: true,
        alert_on_target: true,
        alert_on_stoploss: true,
        alert_on_time_exit: true,
        market_open_alert: false,
        market_close_alert: false
      };
      
      await TradeDB.saveAlertPreferences(prefs);
      console.log(`   ✅ Telegram alerts enabled with chat ID: ${chatId}`);
      
    } catch (error) {
      console.error(`   ❌ Error setting up alerts for ${userId}:`, error.message);
    }
  }
  
  // Verify setup
  console.log('\n\n📊 Verifying setup...');
  const activeUsers = await TradeDB.getAllActiveAlertUsers();
  console.log(`Active alert users: ${activeUsers.length}`);
  
  for (const user of activeUsers) {
    console.log(`\n👤 ${user.user_id}:`);
    console.log(`   - Telegram: ${user.telegram_enabled ? '✅' : '❌'} (${user.telegram_chat_id || 'No chat ID'})`);
    console.log(`   - Email: ${user.email_enabled ? '✅' : '❌'} (${user.email_address || 'No email'})`);
  }
  
  console.log('\n✅ Setup complete!');
  
  // Test sending a message
  if (process.argv[2] === '--test') {
    console.log('\n📤 Sending test message...');
    const telegramBot = require('./telegram-bot');
    telegramBot.initializeTelegramBot();
    
    const success = await telegramBot.sendTelegramAlert(chatId, {
      type: 'custom',
      message: '✅ *Telegram Alerts Configured!*\n\nYour alerts are now active. You will receive:\n• Buy/Sell signals\n• Target/Stop loss alerts\n• Trading opportunities\n\nChat ID: `' + chatId + '`'
    });
    
    console.log(success ? '✅ Test message sent!' : '❌ Failed to send test message');
  }
}

setupTelegramAlerts().catch(console.error);