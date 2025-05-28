# Complete Guide to Deploy Stock Proxy on Render.com (Free)

## Overview
This guide will help you deploy your stock trading system to Render.com's free tier with persistent SQLite database support.

## Prerequisites
- GitHub account (free)
- Render account (free)
- Git installed on your computer

## Step 1: Prepare Your Code

### 1.1 Update Database Path for Cloud
Create a new file `database-config.js`:

```javascript
const path = require('path');

// Use persistent storage on Render, local path otherwise
const DB_PATH = process.env.RENDER 
  ? '/var/data/trades.db' 
  : path.join(__dirname, 'trades.db');

module.exports = { DB_PATH };
```

### 1.2 Update database.js
Modify your `database.js` to use the cloud-compatible path:

```javascript
const Database = require('better-sqlite3');
const { DB_PATH } = require('./database-config');

// Initialize database with cloud path
const db = new Database(DB_PATH);
```

### 1.3 Update render.yaml
The `render.yaml` file has been created with:
- Node.js runtime
- 1GB persistent disk storage
- Automatic build and start commands

## Step 2: Push to GitHub

### 2.1 Initialize Git Repository
```bash
cd "stock-proxy"
git init
git add .
git commit -m "Initial commit for Render deployment"
```

### 2.2 Create GitHub Repository
1. Go to https://github.com/new
2. Create a new repository named `stock-proxy`
3. Keep it public (required for free Render deployment)
4. Don't initialize with README

### 2.3 Push Your Code
```bash
git remote add origin https://github.com/YOUR_USERNAME/stock-proxy.git
git branch -M main
git push -u origin main
```

## Step 3: Deploy on Render

### 3.1 Sign Up for Render
1. Go to https://render.com
2. Sign up with GitHub (recommended)
3. Authorize Render to access your repositories

### 3.2 Create New Web Service
1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Select `stock-proxy` repository
4. Render will auto-detect `render.yaml`

### 3.3 Configure Service
Render will automatically use settings from `render.yaml`:
- **Name**: stock-proxy
- **Region**: Choose closest to you
- **Branch**: main
- **Runtime**: Node
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Instance Type**: Free

### 3.4 Add Environment Variables
Click "Environment" tab and add:
- `NODE_ENV` = `production`
- `TELEGRAM_BOT_TOKEN` = your token (if using Telegram)
- `TELEGRAM_CHAT_ID` = your chat ID (if using Telegram)

### 3.5 Deploy
1. Click "Create Web Service"
2. Wait for deployment (5-10 minutes first time)
3. Your app will be available at: `https://stock-proxy.onrender.com`

## Step 4: Configure Persistent Database

### 4.1 Database Location
Your SQLite database is stored at `/var/data/trades.db` with 1GB storage.

### 4.2 Database Migrations
Add this to your `server.js` to handle database initialization:

```javascript
const fs = require('fs');
const { DB_PATH } = require('./database-config');

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
```

## Step 5: Handle Free Tier Limitations

### 5.1 Auto-Sleep Prevention
Render free tier sleeps after 15 minutes of inactivity. Solutions:

1. **UptimeRobot** (Recommended):
   - Sign up at https://uptimerobot.com (free)
   - Add monitor for `https://stock-proxy.onrender.com`
   - Set check interval to 5 minutes

2. **Add Health Check Endpoint**:
```javascript
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});
```

### 5.2 Cold Starts
First request after sleep takes 30-50 seconds. Add loading indicator:

```javascript
// In your frontend
async function fetchWithRetry(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Request timed out, server might be waking up...');
    }
    throw error;
  }
}
```

## Step 6: Update Frontend URLs

### 6.1 Create config.js
```javascript
// public/js/config.js
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000' 
  : 'https://stock-proxy.onrender.com';

window.API_CONFIG = { API_BASE_URL };
```

### 6.2 Update API Calls
In all your frontend files, replace hardcoded URLs:

```javascript
// Before
fetch('http://localhost:3000/api/trades')

// After
fetch(`${window.API_CONFIG.API_BASE_URL}/api/trades`)
```

## Step 7: Monitor Your App

### 7.1 View Logs
1. Go to Render dashboard
2. Click on your service
3. Click "Logs" tab

### 7.2 Check Metrics
- CPU usage
- Memory usage
- Disk usage (1GB limit)

## Step 8: Troubleshooting

### Common Issues:

1. **Database not persisting**
   - Ensure using `/var/data/trades.db` path
   - Check disk usage in Render dashboard

2. **Build failures**
   - Check if all dependencies are in package.json
   - Remove package-lock.json and retry

3. **App crashes**
   - Check logs for errors
   - Ensure PORT uses `process.env.PORT || 3000`

4. **Telegram bot not working**
   - Add environment variables in Render
   - Check bot token is correct

## Step 9: Optional Enhancements

### 9.1 Custom Domain
1. Go to Settings → Custom Domains
2. Add your domain
3. Update DNS records

### 9.2 Auto-Deploy
Already enabled! Every push to main branch auto-deploys.

### 9.3 Database Backups
Add backup endpoint:

```javascript
app.get('/api/backup', (req, res) => {
  const backup = db.prepare('VACUUM INTO ?').run('/var/data/backup.db');
  res.json({ success: true, message: 'Backup created' });
});
```

## Step 10: Going Live Checklist

- [ ] Environment variables set
- [ ] Database path updated
- [ ] Frontend URLs updated
- [ ] Health check endpoint added
- [ ] UptimeRobot configured
- [ ] Tested all features
- [ ] Checked logs for errors

## Useful Commands

```bash
# View remote logs
git log --oneline

# Force rebuild on Render
git commit --allow-empty -m "Force rebuild"
git push

# Check deployment status
# Visit: https://dashboard.render.com
```

## Support Resources

- Render Docs: https://render.com/docs
- Render Community: https://community.render.com
- Your App URL: https://stock-proxy.onrender.com
- Health Check: https://stock-proxy.onrender.com/health

## Next Steps

1. Complete all code modifications above
2. Push to GitHub
3. Deploy on Render
4. Set up monitoring
5. Test all features

Your app will be live and free! The main limitation is the 15-minute sleep, which UptimeRobot helps mitigate.