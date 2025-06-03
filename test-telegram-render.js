// Test Telegram bot on Render deployment
const axios = require('axios');

const RENDER_URL = 'https://stock-proxy.onrender.com';
const CHAT_ID = '6168209389'; // Your chat ID from environment

async function testTelegramOnRender() {
    console.log('Testing Telegram bot on Render...\n');
    
    try {
        // Test 1: Send custom alert (this might work without auth)
        console.log('1. Testing custom alert endpoint...');
        const alertResponse = await axios.post(`${RENDER_URL}/api/alerts/send-custom`, {
            chatId: CHAT_ID,
            type: 'backtest_complete',
            data: {
                strategy: 'Test Strategy',
                winRate: 85,
                totalTrades: 10,
                timestamp: new Date().toISOString()
            }
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            validateStatus: () => true // Accept any status
        });
        
        console.log(`   Status: ${alertResponse.status}`);
        console.log(`   Response:`, alertResponse.data);
        
        // Test 2: Direct message using test endpoint
        console.log('\n2. Testing Telegram connection...');
        const testResponse = await axios.post(`${RENDER_URL}/api/alerts/test-telegram`, {
            chatId: CHAT_ID
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            validateStatus: () => true
        });
        
        console.log(`   Status: ${testResponse.status}`);
        console.log(`   Response:`, testResponse.data);
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testTelegramOnRender();