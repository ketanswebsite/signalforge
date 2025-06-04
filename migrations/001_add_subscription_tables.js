const { Pool } = require('pg');

async function up(pool) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Create subscription_plans table
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id SERIAL PRIMARY KEY,
        plan_name VARCHAR(100) NOT NULL,
        region VARCHAR(10) NOT NULL,
        price_amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        duration_days INTEGER NOT NULL DEFAULT 30,
        trial_days INTEGER NOT NULL DEFAULT 15,
        qr_code_image_url VARCHAR(500),
        payment_instructions TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 2. Create user_subscriptions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        plan_id INTEGER REFERENCES subscription_plans(id),
        subscription_status VARCHAR(20) NOT NULL DEFAULT 'trial',
        trial_start_date TIMESTAMP,
        trial_end_date TIMESTAMP,
        subscription_start_date TIMESTAMP,
        subscription_end_date TIMESTAMP,
        auto_renew BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(email)
      )
    `);
    
    // 3. Create payment_transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        subscription_id INTEGER REFERENCES user_subscriptions(id),
        transaction_id VARCHAR(100) UNIQUE,
        payment_method VARCHAR(50),
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        payment_status VARCHAR(20) DEFAULT 'pending',
        payment_proof_url VARCHAR(500),
        payment_date TIMESTAMP,
        verification_date TIMESTAMP,
        verified_by VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(email)
      )
    `);
    
    // 4. Create payment_verification_queue table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_verification_queue (
        id SERIAL PRIMARY KEY,
        transaction_id INTEGER REFERENCES payment_transactions(id),
        user_email VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        verification_status VARCHAR(20) DEFAULT 'pending',
        admin_notes TEXT
      )
    `);
    
    // 5. Alter users table to add subscription fields
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS region VARCHAR(10) DEFAULT 'IN',
      ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'trial',
      ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false
    `);
    
    // 6. Create indexes for better performance
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(subscription_status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(payment_status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_payment_verification_queue_status ON payment_verification_queue(verification_status)');
    
    // 7. Insert default subscription plans
    await client.query(`
      INSERT INTO subscription_plans (plan_name, region, price_amount, currency, duration_days, trial_days, payment_instructions)
      VALUES 
      ('Monthly Subscription - India', 'IN', 1000.00, 'INR', 30, 15, 'Pay ₹1000 using UPI to the QR code shown. After payment, submit your UTR number for verification.'),
      ('Monthly Subscription - UK', 'UK', 10.00, 'GBP', 30, 15, 'Pay £10 using Revolut to the QR code shown. After payment, submit your transaction ID for verification.')
      ON CONFLICT DO NOTHING
    `);
    
    await client.query('COMMIT');
    console.log('✅ Subscription tables created successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating subscription tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function down(pool) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Drop tables in reverse order due to foreign key constraints
    await client.query('DROP TABLE IF EXISTS payment_verification_queue CASCADE');
    await client.query('DROP TABLE IF EXISTS payment_transactions CASCADE');
    await client.query('DROP TABLE IF EXISTS user_subscriptions CASCADE');
    await client.query('DROP TABLE IF EXISTS subscription_plans CASCADE');
    
    // Remove columns from users table
    await client.query(`
      ALTER TABLE users 
      DROP COLUMN IF EXISTS region,
      DROP COLUMN IF EXISTS subscription_status,
      DROP COLUMN IF EXISTS subscription_end_date,
      DROP COLUMN IF EXISTS is_premium
    `);
    
    await client.query('COMMIT');
    console.log('✅ Subscription tables dropped successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error dropping subscription tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Export for use in migration runner
module.exports = { up, down };

// If run directly, execute the migration
if (require.main === module) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  const command = process.argv[2];
  
  if (command === 'up') {
    up(pool)
      .then(() => {
        console.log('Migration completed successfully');
        process.exit(0);
      })
      .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
      });
  } else if (command === 'down') {
    down(pool)
      .then(() => {
        console.log('Rollback completed successfully');
        process.exit(0);
      })
      .catch((error) => {
        console.error('Rollback failed:', error);
        process.exit(1);
      });
  } else {
    console.log('Usage: node 001_add_subscription_tables.js [up|down]');
    process.exit(1);
  }
}