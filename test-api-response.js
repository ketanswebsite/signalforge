#!/usr/bin/env node

// Test what the API is actually returning
const TradeDB = require('./database-postgres');

async function testAPIResponse() {
  console.log('🔍 Testing API response for trades...\n');
  
  try {
    // Test getActiveTrades function
    const activeTrades = await TradeDB.getActiveTrades('ketanjoshisahs@gmail.com');
    
    console.log(`Found ${activeTrades.length} active trades\n`);
    
    if (activeTrades.length > 0) {
      console.log('First active trade full response:');
      console.log(JSON.stringify(activeTrades[0], null, 2));
      
      console.log('\n📊 Key fields check:');
      activeTrades.slice(0, 3).forEach(trade => {
        console.log(`\n${trade.symbol}:`);
        console.log(`  - investmentAmount: ${trade.investmentAmount}`);
        console.log(`  - currencySymbol: ${trade.currencySymbol}`);
        console.log(`  - stopLossPercent: ${trade.stopLossPercent}`);
        console.log(`  - takeProfitPercent: ${trade.takeProfitPercent}`);
        console.log(`  - positionSize: ${trade.positionSize}`);
      });
    }
    
    // Also test getAllTrades
    console.log('\n\nTesting getAllTrades...');
    const allTrades = await TradeDB.getAllTrades('ketanjoshisahs@gmail.com');
    console.log(`Total trades: ${allTrades.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the connection
    if (TradeDB.pool) {
      await TradeDB.pool.end();
    }
  }
}

testAPIResponse();