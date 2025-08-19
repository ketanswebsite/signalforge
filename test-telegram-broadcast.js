#!/usr/bin/env node

/**
 * Test script for Telegram broadcast functionality
 * Tests the new multi-user subscription system
 */

const { broadcastToSubscribers } = require('./lib/telegram/telegram-bot');

async function testBroadcast() {
    console.log('🧪 Testing Telegram Broadcast System...\n');
    
    try {
        // Test message
        const testMessage = {
            type: 'custom',
            message: `🧪 *Test Broadcast Message*\n\n` +
                    `This is a test of the new multi-user subscription system.\n\n` +
                    `📊 Features Implemented:\n` +
                    `• ✅ Deep link subscriptions\n` +
                    `• ✅ Subscription type filtering\n` +
                    `• ✅ Batch broadcasting\n` +
                    `• ✅ Rate limiting\n\n` +
                    `🎯 **Links to test:**\n` +
                    `All signals: t.me/YourBot?start=all\n` +
                    `Conviction only: t.me/YourBot?start=conviction\n` +
                    `Scans only: t.me/YourBot?start=scans\n\n` +
                    `Time: ${new Date().toLocaleString()}`
        };
        
        console.log('📡 Broadcasting test message to all subscribers...');
        console.log('📝 Message preview:', testMessage.message.substring(0, 100) + '...\n');
        
        // Test broadcast to all subscribers
        const results = await broadcastToSubscribers(testMessage);
        
        console.log('📊 Broadcast Results:');
        console.log(`Total subscribers reached: ${results.length}`);
        
        if (results.length > 0) {
            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;
            
            console.log(`✅ Successful sends: ${successful}`);
            console.log(`❌ Failed sends: ${failed}`);
            
            // Show some details
            results.slice(0, 5).forEach(result => {
                const status = result.success ? '✅' : '❌';
                console.log(`  ${status} ${result.username || 'Unknown'} (${result.chatId})`);
            });
            
            if (results.length > 5) {
                console.log(`  ... and ${results.length - 5} more`);
            }
        } else {
            console.log('ℹ️  No active subscribers found.');
            console.log('📝 To test with subscribers:');
            console.log('   1. Start your Telegram bot in development mode');
            console.log('   2. Send /start to your bot');
            console.log('   3. Run this test again');
        }
        
        console.log('\n🎯 **Next steps:**');
        console.log('   • Share deep links to get subscribers');
        console.log('   • Test different subscription types');
        console.log('   • Monitor the 7 AM scheduled broadcasts');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        
        if (error.message.includes('PostgreSQL not configured')) {
            console.log('\n💡 Database not configured. This is expected in local development.');
            console.log('   The system will fall back to in-memory storage for testing.');
        }
        
        if (error.message.includes('TELEGRAM_BOT_TOKEN')) {
            console.log('\n💡 Telegram bot not configured. Set TELEGRAM_BOT_TOKEN environment variable.');
        }
    }
}

// Run the test
if (require.main === module) {
    testBroadcast().then(() => {
        console.log('\n✅ Test completed.');
        process.exit(0);
    }).catch(error => {
        console.error('💥 Test crashed:', error);
        process.exit(1);
    });
}

module.exports = { testBroadcast };