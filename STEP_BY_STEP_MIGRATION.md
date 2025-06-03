# Step-by-Step PostgreSQL Migration Guide

## Current Situation
- ✅ Telegram is working
- ❌ Your PostgreSQL database gets cleared on each deployment
- ✅ You have 29 trades in backup-trades.json
- ✅ You have alert preferences configured

## Step 1: Push Latest Code to GitHub
Run these commands in your terminal:

```bash
git add .
git commit -m "Complete Telegram fixes and PostgreSQL migration"
git push
```

## Step 2: Wait for Render Deployment
1. Go to https://dashboard.render.com
2. Click on your "stock-proxy" service
3. Wait for the deployment to complete (green "Live" status)

## Step 3: Open Render Shell
1. In your Render dashboard, click on your "stock-proxy" service
2. Click on the "Shell" tab at the top
3. Wait for the shell to connect

## Step 4: Run Migration in Render Shell
Copy and paste this command in the Render shell:

```bash
node migrate-to-postgres-render.js
```

You should see output like:
```
🚀 Starting PostgreSQL migration on Render...
✅ Connected to PostgreSQL
📂 Reading backup-trades.json...
   - Found 29 trades
   - Found 1 alert preferences
✅ Database schema already exists
📤 Migrating 29 trades...
✅ Successfully migrated 29/29 trades
✅ Migration complete!
```

## Step 5: Verify Migration Success
In the same Render shell, run this command to check your data:

```bash
node -e "const {Pool} = require('pg'); const p = new Pool({connectionString: process.env.DATABASE_URL}); p.query('SELECT COUNT(*) FROM trades').then(r => console.log('Trades:', r.rows[0].count)); p.query('SELECT COUNT(*) FROM alert_preferences').then(r => console.log('Alerts:', r.rows[0].count)).then(() => p.end());"
```

You should see:
```
Trades: 29
Alerts: 3
```

## Step 6: Test Your Application
1. Go to https://stock-proxy.onrender.com
2. Login with your Google account
3. Check that your trades are visible
4. Run a scan to test Telegram alerts

## What This Migration Does

### Before Migration:
- Database uses JSON files locally
- PostgreSQL is empty on Render
- Each deployment clears the database

### After Migration:
- All 29 trades are in PostgreSQL
- Telegram alerts are configured for all users
- Data persists between deployments
- No more dependency on JSON files

## Troubleshooting

### If migration fails with "permission denied":
The backup-trades.json file might not be deployed. Check your .gitignore

### If you see 0 trades after migration:
1. Make sure backup-trades.json is in your deployment
2. Check the migration output for errors

### If Telegram still shows "not configured":
1. Clear your browser cache
2. Logout and login again
3. The preferences should now load from PostgreSQL

## Important Notes

1. **One-time process**: You only need to run this migration once
2. **Backup exists**: Your backup-trades.json remains unchanged
3. **No data loss**: The migration doesn't delete your JSON backup
4. **Future deployments**: After this migration, all future deployments will keep your data

## Next Steps

After successful migration:
1. Your app now uses PostgreSQL exclusively
2. Telegram alerts will work for buying opportunities
3. You can deploy updates without losing data
4. Consider deleting local JSON files (optional)

## Quick Summary

1. Push code: `git push`
2. Wait for deployment to finish
3. Open Render Shell
4. Run: `node migrate-to-postgres-render.js`
5. Verify with the count command
6. Test your app

That's it! Your data is now safely in PostgreSQL.