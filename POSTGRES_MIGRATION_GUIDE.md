# PostgreSQL Migration Guide for Render

## Steps to Complete Migration

### 1. Deploy Updated Code
First, deploy the latest code with all the fixes:
```bash
git add .
git commit -m "Fix Telegram alerts and add PostgreSQL migration"
git push
```

### 2. Run Migration on Render Console
After deployment completes:

1. Go to your Render dashboard
2. Click on your web service (stock-proxy)
3. Go to the "Shell" tab
4. Run the migration command:
```bash
node migrate-to-postgres-render.js
```

### 3. Verify Migration
In the Render shell, verify the data:
```bash
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT COUNT(*) as count FROM trades').then(r => console.log('Trades:', r.rows[0].count));
pool.query('SELECT COUNT(*) as count FROM alert_preferences').then(r => console.log('Alert prefs:', r.rows[0].count));
pool.end();
"
```

### 4. What This Migration Does

1. **Preserves All Data**: 
   - All your trades from backup-trades.json
   - All Telegram alert preferences

2. **Fixes Database Persistence**: 
   - Data will persist between deployments
   - No more blank database after deploy

3. **Enables Telegram Alerts**:
   - Alert preferences are properly configured
   - Frontend can now send alerts with authentication

### 5. Important Notes

- The migration uses your internal DATABASE_URL automatically
- It will clear existing PostgreSQL data and replace with backup
- Alert preferences include your Telegram chat ID (6168209389)
- All users (default, ketanjoshisahs@gmail.com, ketan.g.joshi@hotmail.com) will have Telegram enabled

### 6. After Migration

Your app will now:
- Use PostgreSQL exclusively (no more JSON fallback)
- Send Telegram alerts for buying opportunities
- Persist all data between deployments
- Have proper authentication for all API calls

### 7. Troubleshooting

If migration fails:
1. Check DATABASE_URL is set in Render environment
2. Ensure backup-trades.json exists in deployment
3. Check PostgreSQL service is running on Render

If Telegram alerts still don't work:
1. Clear browser cache and reload
2. Check browser console for "Telegram alerts configured" message
3. Verify you're logged in when scanning for opportunities