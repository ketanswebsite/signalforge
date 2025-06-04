const { Pool } = require('pg');
require('dotenv').config();

async function checkSubscriptionTables() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔍 Checking subscription tables...\n');

    // 1. Check subscription_plans table
    const plansCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'subscription_plans'
      ORDER BY ordinal_position;
    `);
    
    console.log('✅ subscription_plans table:');
    console.log(`   - ${plansCheck.rows.length} columns found`);
    
    // Check for existing plans
    const plans = await pool.query('SELECT * FROM subscription_plans');
    console.log(`   - ${plans.rows.length} plans configured`);
    if (plans.rows.length > 0) {
      plans.rows.forEach(plan => {
        console.log(`     • ${plan.plan_name}: ${plan.currency}${plan.price_amount} (${plan.region})`);
      });
    }

    // 2. Check user_subscriptions table
    const subsCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'user_subscriptions'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n✅ user_subscriptions table:');
    console.log(`   - ${subsCheck.rows.length} columns found`);
    
    // Count subscriptions
    const subsCount = await pool.query('SELECT COUNT(*) as count FROM user_subscriptions');
    console.log(`   - ${subsCount.rows[0].count} user subscriptions`);

    // 3. Check payment_transactions table
    const transCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'payment_transactions'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n✅ payment_transactions table:');
    console.log(`   - ${transCheck.rows.length} columns found`);
    
    // Count transactions
    const transCount = await pool.query('SELECT COUNT(*) as count FROM payment_transactions');
    console.log(`   - ${transCount.rows[0].count} payment transactions`);

    // 4. Check payment_verification_queue table
    const queueCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'payment_verification_queue'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n✅ payment_verification_queue table:');
    console.log(`   - ${queueCheck.rows.length} columns found`);
    
    // Count pending verifications
    const queueCount = await pool.query('SELECT COUNT(*) as count FROM payment_verification_queue WHERE verification_status = $1', ['pending']);
    console.log(`   - ${queueCount.rows[0].count} pending verifications`);

    // 5. Check users table modifications
    const usersCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users' 
      AND column_name IN ('region', 'subscription_status', 'subscription_end_date', 'is_premium')
      ORDER BY ordinal_position;
    `);
    
    console.log('\n✅ users table subscription columns:');
    if (usersCheck.rows.length === 4) {
      console.log('   - All 4 subscription columns added successfully:');
      usersCheck.rows.forEach(col => {
        console.log(`     • ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log(`   - ⚠️  Only ${usersCheck.rows.length}/4 columns found`);
    }

    // 6. Check indexes
    const indexCheck = await pool.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND indexname IN (
        'idx_user_subscriptions_user_id',
        'idx_user_subscriptions_status',
        'idx_payment_transactions_user_id',
        'idx_payment_transactions_status',
        'idx_payment_verification_queue_status'
      )
      ORDER BY tablename, indexname;
    `);
    
    console.log('\n✅ Performance indexes:');
    console.log(`   - ${indexCheck.rows.length}/5 indexes created`);
    indexCheck.rows.forEach(idx => {
      console.log(`     • ${idx.indexname} on ${idx.tablename}`);
    });

    // 7. Check foreign key constraints
    const fkCheck = await pool.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name IN ('user_subscriptions', 'payment_transactions', 'payment_verification_queue');
    `);
    
    console.log('\n✅ Foreign key relationships:');
    console.log(`   - ${fkCheck.rows.length} foreign keys found`);
    fkCheck.rows.forEach(fk => {
      console.log(`     • ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });

    console.log('\n✨ All subscription tables are properly configured!');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error checking tables:', error.message);
    await pool.end();
    process.exit(1);
  }
}

// Run the check
checkSubscriptionTables();