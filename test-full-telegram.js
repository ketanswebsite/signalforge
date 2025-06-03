// Full test of Telegram functionality
require('dotenv').config();
const axios = require('axios');

const LOCAL_URL = 'http://localhost:3000';
const RENDER_URL = 'https://stock-proxy.onrender.com';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '6168209389';

async function testTelegramFull(useRender = false) {
    const baseUrl = useRender ? RENDER_URL : LOCAL_URL;
    console.log(`\n🧪 Testing Telegram on ${useRender ? 'Render' : 'Local'}: ${baseUrl}\n`);
    
    try {
        // Test 1: Direct Telegram bot test
        console.log('1. Testing direct Telegram bot...');
        if (!useRender) {
            const telegramBot = require('./telegram-bot');
            telegramBot.initializeTelegramBot();
            
            const success = await telegramBot.sendTelegramAlert(CHAT_ID, {
                type: 'custom',
                message: '✅ Direct bot test successful!'
            });
            console.log(`   Direct bot test: ${success ? '✅ Success' : '❌ Failed'}`);
        }
        
        // Test 2: Custom alert endpoint (no auth required)
        console.log('\n2. Testing custom alert endpoint...');
        try {
            const response = await axios.post(`${baseUrl}/api/alerts/send-custom`, {
                chatId: CHAT_ID,
                message: {
                    type: 'opportunity_scan',
                    title: '🎯 TEST BUYING OPPORTUNITIES',
                    text: 'Found 3 Strong Buy Signals',
                    fields: [
                        { label: 'Total Scanned', value: '50' },
                        { label: 'Strong Signals', value: '3' },
                        { label: 'Test Time', value: new Date().toLocaleString() }
                    ]
                }
            }, {
                validateStatus: () => true
            });
            
            console.log(`   Status: ${response.status}`);
            console.log(`   Response:`, response.data);
            
            if (response.status === 200) {
                // Send a buy opportunity too
                const buyResponse = await axios.post(`${baseUrl}/api/alerts/send-custom`, {
                    chatId: CHAT_ID,
                    message: {
                        type: 'buy_opportunity',
                        title: 'STRONG BUY SIGNAL',
                        stock: 'AAPL',
                        fields: [
                            { label: 'DTI Signal', value: '92.50' },
                            { label: 'Current Price', value: '$185.25' },
                            { label: '7-Day DTI', value: '88.75' },
                            { label: 'Signal Date', value: new Date().toLocaleDateString() }
                        ],
                        action: 'Consider adding to portfolio'
                    }
                });
                console.log(`   Buy opportunity sent: ${buyResponse.status === 200 ? '✅' : '❌'}`);
            }
        } catch (error) {
            console.error(`   ❌ Error:`, error.message);
        }
        
        // Test 3: Check database for alert preferences
        if (!useRender) {
            console.log('\n3. Checking database for alert preferences...');
            const TradeDB = require('./database-postgres').isConnected() 
                ? require('./database-postgres') 
                : require('./database-json');
            
            const prefs = await TradeDB.getAlertPreferences('default');
            if (prefs) {
                console.log('   Alert preferences found:');
                console.log(`   - Telegram enabled: ${prefs.telegram_enabled}`);
                console.log(`   - Chat ID: ${prefs.telegram_chat_id}`);
            } else {
                console.log('   ❌ No alert preferences found for user');
                
                // Save default preferences
                console.log('   📝 Saving default preferences...');
                await TradeDB.saveAlertPreferences({
                    user_id: 'default',
                    telegram_enabled: true,
                    telegram_chat_id: CHAT_ID,
                    alert_on_buy: true,
                    alert_on_sell: true,
                    alert_on_target: true,
                    alert_on_stoploss: true,
                    alert_on_time_exit: true
                });
                console.log('   ✅ Default preferences saved');
            }
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run test
const useRender = process.argv[2] === 'render';
testTelegramFull(useRender);