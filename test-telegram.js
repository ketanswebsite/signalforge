// Test script for Telegram bot functionality
require('dotenv').config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

console.log('=== Telegram Bot Test ===\n');
console.log('Environment Variables:');
console.log('- TELEGRAM_BOT_TOKEN:', BOT_TOKEN ? '✓ Set' : '✗ Not set');
console.log('- TELEGRAM_CHAT_ID:', CHAT_ID ? '✓ Set' : '✗ Not set');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('- RENDER:', process.env.RENDER || 'not set');

if (!BOT_TOKEN) {
  console.error('\n❌ TELEGRAM_BOT_TOKEN not found in .env file');
  process.exit(1);
}

// Load the telegram bot module
const telegramBot = require('./telegram-bot');

// Initialize the bot
console.log('\nInitializing bot...');
telegramBot.initializeTelegramBot();

// Test sending a message
async function testBot() {
  console.log('\nTesting bot functionality...');
  
  // Get bot info
  console.log('\n1. Getting bot info...');
  const botInfo = await telegramBot.getBotInfo();
  if (botInfo) {
    console.log('✓ Bot info retrieved:');
    console.log(`  - Username: @${botInfo.username}`);
    console.log(`  - Name: ${botInfo.firstName}`);
    console.log(`  - ID: ${botInfo.id}`);
  } else {
    console.log('✗ Failed to get bot info');
  }
  
  // Test sending a message if chat ID is available
  if (CHAT_ID) {
    console.log('\n2. Testing message send...');
    
    const testAlert = {
      type: 'custom',
      message: '✅ *Telegram Bot Test*\n\nThis is a test message from your SignalForge system.\n\nIf you receive this, your Telegram integration is working correctly!'
    };
    
    const success = await telegramBot.sendTelegramAlert(CHAT_ID, testAlert);
    
    if (success) {
      console.log('✓ Test message sent successfully!');
      console.log(`  Check your Telegram chat (ID: ${CHAT_ID})`);
    } else {
      console.log('✗ Failed to send test message');
    }
  } else {
    console.log('\n2. Skipping message test (no CHAT_ID in .env)');
    console.log('   To test sending messages, add TELEGRAM_CHAT_ID to your .env file');
  }
  
  console.log('\n=== Test Complete ===');
  
  // Keep the script running for a few seconds to allow any async operations to complete
  setTimeout(() => {
    process.exit(0);
  }, 3000);
}

// Run the test
testBot().catch(console.error);