const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkUsersTable() {
  try {
    // Check if users table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'users'
      );
    `);

    console.log('Users table exists:', tableCheck.rows[0].exists);

    if (tableCheck.rows[0].exists) {
      // Check table structure
      const columns = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position;
      `);

      console.log('\nUsers table columns:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });

      // Try the actual query that's failing
      const usersResult = await pool.query(`
        SELECT
          email,
          name,
          first_login,
          last_login,
          telegram_chat_id
        FROM users
        ORDER BY first_login DESC
        LIMIT 10
      `);

      console.log(`\n✅ Query successful! Found ${usersResult.rows.length} users`);
      console.log('Sample data:', usersResult.rows[0] || 'No users found');
    } else {
      console.log('\n❌ Users table does NOT exist!');
      console.log('Run: DATABASE_URL="your-url" node database-postgres.js to initialize');
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error checking users table:', error.message);
    console.error('Full error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkUsersTable();
