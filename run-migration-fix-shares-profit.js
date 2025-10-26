/**
 * Migration: Fix Missing Shares and Profit Loss Values
 *
 * This migration fixes critical missing data in the trades table:
 * 1. Calculates and populates shares for all trades where shares is NULL
 * 2. Populates investment_amount where missing (from trade_size)
 * 3. Calculates and populates profit_loss for closed trades
 *
 * Run: node run-migration-fix-shares-profit.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🔧 Starting migration: Fix Missing Shares and Profit Loss');
    console.log('');

    await client.query('BEGIN');

    // Step 1: Calculate and populate shares for all trades where shares is NULL
    console.log('📊 Step 1: Calculating missing shares...');
    const sharesUpdate = await client.query(`
      UPDATE trades
      SET shares = trade_size / entry_price
      WHERE shares IS NULL
        AND trade_size IS NOT NULL
        AND entry_price IS NOT NULL
        AND entry_price > 0
      RETURNING id, symbol, trade_size, entry_price, shares
    `);

    if (sharesUpdate.rows.length > 0) {
      console.log(`✅ Updated ${sharesUpdate.rows.length} trades with calculated shares:`);
      sharesUpdate.rows.forEach(row => {
        console.log(`   - ${row.symbol} (ID ${row.id}): ${row.shares.toFixed(2)} shares (${row.trade_size} / ${row.entry_price})`);
      });
    } else {
      console.log('   ℹ No trades needed shares calculation');
    }
    console.log('');

    // Step 2: Populate investment_amount where missing (copy from trade_size)
    console.log('💰 Step 2: Populating missing investment_amount...');
    const investmentUpdate = await client.query(`
      UPDATE trades
      SET investment_amount = trade_size
      WHERE investment_amount IS NULL
        AND trade_size IS NOT NULL
      RETURNING id, symbol, trade_size, investment_amount
    `);

    if (investmentUpdate.rows.length > 0) {
      console.log(`✅ Updated ${investmentUpdate.rows.length} trades with investment_amount:`);
      investmentUpdate.rows.forEach(row => {
        console.log(`   - ${row.symbol} (ID ${row.id}): ${row.investment_amount}`);
      });
    } else {
      console.log('   ℹ No trades needed investment_amount update');
    }
    console.log('');

    // Step 3: Calculate and populate profit_loss for closed trades
    console.log('📈 Step 3: Calculating profit_loss for closed trades...');
    const profitLossUpdate = await client.query(`
      UPDATE trades
      SET profit_loss = (exit_price - entry_price) * shares
      WHERE status = 'closed'
        AND profit_loss IS NULL
        AND exit_price IS NOT NULL
        AND entry_price IS NOT NULL
        AND shares IS NOT NULL
      RETURNING id, symbol, entry_price, exit_price, shares, profit_loss, profit_loss_percentage
    `);

    if (profitLossUpdate.rows.length > 0) {
      console.log(`✅ Updated ${profitLossUpdate.rows.length} closed trades with profit_loss:`);
      profitLossUpdate.rows.forEach(row => {
        const percentageStr = row.profit_loss_percentage ? `${parseFloat(row.profit_loss_percentage).toFixed(2)}%` : 'N/A';
        console.log(`   - ${row.symbol} (ID ${row.id}):`);
        console.log(`      Entry: $${parseFloat(row.entry_price).toFixed(2)}, Exit: $${parseFloat(row.exit_price).toFixed(2)}`);
        console.log(`      Shares: ${parseFloat(row.shares).toFixed(2)}`);
        console.log(`      Profit/Loss: $${parseFloat(row.profit_loss).toFixed(2)} (${percentageStr})`);
      });
    } else {
      console.log('   ℹ No closed trades needed profit_loss calculation');
    }
    console.log('');

    await client.query('COMMIT');

    console.log('✅ Migration completed successfully!');
    console.log('');

    // Step 4: Verify the results
    console.log('🔍 Verification:');

    const verifyQuery = await client.query(`
      SELECT
        status,
        COUNT(*) as total,
        COUNT(shares) as has_shares,
        COUNT(CASE WHEN shares IS NULL THEN 1 END) as missing_shares,
        COUNT(CASE WHEN status = 'closed' AND profit_loss IS NOT NULL THEN 1 END) as closed_with_profit_loss,
        COUNT(CASE WHEN status = 'closed' AND profit_loss IS NULL THEN 1 END) as closed_missing_profit_loss
      FROM trades
      GROUP BY status
    `);

    console.log('');
    verifyQuery.rows.forEach(row => {
      console.log(`${row.status.toUpperCase()} TRADES:`);
      console.log(`   Total: ${row.total}`);
      console.log(`   Has shares: ${row.has_shares}`);
      console.log(`   Missing shares: ${row.missing_shares}`);
      if (row.status === 'closed') {
        console.log(`   Has profit_loss: ${row.closed_with_profit_loss}`);
        console.log(`   Missing profit_loss: ${row.closed_missing_profit_loss}`);
      }
      console.log('');
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
