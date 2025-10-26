/**
 * Manual Migration Runner for trade_alerts_sent table
 * Run this once to create the table: node run-migration-trade-alerts.js
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
    console.log('🔧 Running migration: add_trade_alerts_sent_table.sql');
    console.log('');

    // Create table
    console.log('Creating trade_alerts_sent table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS trade_alerts_sent (
        id SERIAL PRIMARY KEY,
        trade_id INTEGER NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        alert_type VARCHAR(50) NOT NULL,
        current_price DECIMAL(15, 2),
        pl_percent DECIMAL(10, 2),
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_trade_alert UNIQUE(trade_id, user_id, alert_type)
      )
    `);
    console.log('✅ Table created');

    // Create first index
    console.log('Creating index: idx_trade_alerts_trade_user...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_trade_alerts_trade_user
      ON trade_alerts_sent(trade_id, user_id, alert_type)
    `);
    console.log('✅ Index created');

    // Create second index
    console.log('Creating index: idx_trade_alerts_sent_at...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_trade_alerts_sent_at
      ON trade_alerts_sent(sent_at DESC)
    `);
    console.log('✅ Index created');

    // Add comments
    console.log('Adding table comments...');
    await client.query(`
      COMMENT ON TABLE trade_alerts_sent IS 'Tracks sent Telegram alerts to prevent duplicates from checkTradeAlerts() function'
    `);
    await client.query(`
      COMMENT ON COLUMN trade_alerts_sent.trade_id IS 'Reference to trades.id'
    `);
    await client.query(`
      COMMENT ON COLUMN trade_alerts_sent.user_id IS 'User identifier (email)'
    `);
    await client.query(`
      COMMENT ON COLUMN trade_alerts_sent.alert_type IS 'Type: target_reached, stop_loss, time_exit'
    `);
    console.log('✅ Comments added');

    console.log('');
    console.log('✅ Migration completed successfully!');
    console.log('');

    // Verify table exists
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'trade_alerts_sent'
    `);

    if (result.rows.length > 0) {
      console.log('✓ Verified: trade_alerts_sent table exists');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
