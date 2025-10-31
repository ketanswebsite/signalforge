/**
 * Migration Script: Fix India Market Position Count
 *
 * Issue: portfolio_capital.active_positions shows 10 but actual active trades = 9
 * Cause: JSWINFRA.NS stop loss closure failed to decrement counter (missing userId bug)
 *
 * This script:
 * 1. Counts actual active trades for India market
 * 2. Compares with portfolio_capital.active_positions
 * 3. Updates if mismatch found
 *
 * USAGE:
 * - Add this as an API endpoint in server.js
 * - OR deploy to production and run: node fix-india-position-count.js
 * - OR run via browser: GET /api/admin/fix-position-count
 */

const TradeDB = require('./database-postgres');

// Ensure database is connected
if (!TradeDB.pool) {
    console.error('❌ Database not connected. Make sure DATABASE_URL is set.');
    console.error('   Run this script on production or add to server.js as an admin endpoint.');
    if (require.main === module) {
        process.exit(1);
    }
}

async function fixIndiaPositionCount() {
    console.log('🔧 [MIGRATION] Fixing India market position count...\n');

    try {
        const userId = 'ketanjoshisahs@gmail.com';

        // Step 1: Count actual active trades for India
        console.log('📊 Step 1: Counting active trades...');
        const activeTrades = await TradeDB.pool.query(`
            SELECT COUNT(*) as count,
                   COALESCE(SUM(investment_amount), 0) as total_allocated
            FROM trades
            WHERE status = 'active'
              AND market = 'India'
              AND user_id = $1
        `, [userId]);

        const actualCount = parseInt(activeTrades.rows[0].count);
        const actualAllocated = parseFloat(activeTrades.rows[0].total_allocated);

        console.log(`   ✅ Found ${actualCount} active trades`);
        console.log(`   ✅ Total allocated: ₹${actualAllocated.toLocaleString()}\n`);

        // Step 2: Get current portfolio_capital count
        console.log('📊 Step 2: Checking portfolio_capital table...');
        const capitalRow = await TradeDB.pool.query(`
            SELECT active_positions, allocated_capital
            FROM portfolio_capital
            WHERE market = 'India'
              AND user_id = $1
        `, [userId]);

        if (capitalRow.rows.length === 0) {
            console.error('   ❌ No portfolio_capital row found for India market');
            return false;
        }

        const currentCount = parseInt(capitalRow.rows[0].active_positions);
        const currentAllocated = parseFloat(capitalRow.rows[0].allocated_capital);

        console.log(`   Current active_positions: ${currentCount}`);
        console.log(`   Current allocated_capital: ₹${currentAllocated.toLocaleString()}\n`);

        // Step 3: Check if update needed
        if (currentCount === actualCount && currentAllocated === actualAllocated) {
            console.log('✅ [MIGRATION] Position count is already correct! No update needed.\n');
            return true;
        }

        console.log('⚠️  [MIGRATION] Mismatch detected!');
        console.log(`   Database shows: ${currentCount} positions, ₹${currentAllocated.toLocaleString()} allocated`);
        console.log(`   Actual count:   ${actualCount} positions, ₹${actualAllocated.toLocaleString()} allocated`);
        console.log(`   Difference:     ${currentCount - actualCount} positions, ₹${(currentAllocated - actualAllocated).toLocaleString()}\n`);

        // Step 4: Update portfolio_capital
        console.log('🔄 Step 3: Updating portfolio_capital...');
        const updateResult = await TradeDB.pool.query(`
            UPDATE portfolio_capital
            SET active_positions = $1,
                allocated_capital = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE market = 'India'
              AND user_id = $3
            RETURNING *
        `, [actualCount, actualAllocated, userId]);

        if (updateResult.rows.length === 0) {
            console.error('   ❌ Update failed - no rows affected');
            return false;
        }

        const updated = updateResult.rows[0];
        console.log(`   ✅ Updated successfully!`);
        console.log(`   New active_positions: ${updated.active_positions}`);
        console.log(`   New allocated_capital: ₹${parseFloat(updated.allocated_capital).toLocaleString()}\n`);

        // Step 5: Verify
        console.log('✅ Step 4: Verifying update...');
        const verify = await TradeDB.pool.query(`
            SELECT active_positions, allocated_capital
            FROM portfolio_capital
            WHERE market = 'India'
              AND user_id = $1
        `, [userId]);

        const verifyCount = parseInt(verify.rows[0].active_positions);
        const verifyAllocated = parseFloat(verify.rows[0].allocated_capital);

        if (verifyCount === actualCount && verifyAllocated === actualAllocated) {
            console.log(`   ✅ Verification passed!`);
            console.log(`   Position count now matches actual trades: ${verifyCount}/${10}\n`);
            console.log('🎉 [MIGRATION] Complete! India position count fixed.\n');
            return true;
        } else {
            console.error('   ❌ Verification failed - counts still don\'t match');
            return false;
        }

    } catch (error) {
        console.error('❌ [MIGRATION] Error:', error.message);
        console.error(error);
        return false;
    }
}

// Run migration if called directly
if (require.main === module) {
    fixIndiaPositionCount()
        .then(success => {
            if (success) {
                console.log('✅ Migration completed successfully');
                process.exit(0);
            } else {
                console.error('❌ Migration failed');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('❌ Migration crashed:', error);
            process.exit(1);
        });
}

module.exports = fixIndiaPositionCount;
