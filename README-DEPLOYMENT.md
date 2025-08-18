# 🚀 Stock Proxy - Render Deployment Guide

## Quick Deploy

Run the deployment script:
```bash
./deploy-to-render.bat
```

This script will:
1. ✅ Check your environment
2. ✅ Commit any changes
3. ✅ Push to GitHub
4. ✅ Provide deployment instructions

## 📋 Prerequisites

### 1. GitHub Repository
- Create a GitHub repository for your project
- Add it as origin: `git remote add origin https://github.com/yourusername/your-repo.git`

### 2. Render Account
- Sign up at [render.com](https://render.com)
- Connect your GitHub account

## 🔧 Render Setup

### 1. Create Web Service
1. Go to Render Dashboard
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure settings:

### 2. Build & Start Commands
```
Build Command: npm install
Start Command: npm start
Environment: Node
Region: Choose closest to your users
```

### 3. Environment Variables

#### Required Variables:
```env
DATABASE_URL=postgresql://user:pass@host:port/dbname
SESSION_SECRET=your-super-secure-session-secret-at-least-32-chars
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
NODE_ENV=production
```

#### Optional Variables:
```env
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-telegram-chat-id
DEBUG_CRON=false
DTI_DEBUG=false
```

## 🗄️ Database Setup

### 1. Create PostgreSQL Database
1. In Render Dashboard, click "New" → "PostgreSQL"
2. Choose a name and region
3. Copy the "External Database URL"

### 2. Configure Database
1. Paste the Database URL into `DATABASE_URL` environment variable
2. The application will automatically create tables on first startup

## 🔐 Google OAuth Setup

### 1. Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable "Google+ API"
4. Create OAuth 2.0 credentials

### 2. OAuth Configuration
```
Authorized JavaScript origins:
https://your-app-name.onrender.com

Authorized redirect URIs:
https://your-app-name.onrender.com/auth/google/callback
```

## 📱 Telegram Bot Setup (Optional)

### 1. Create Bot
1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Use `/newbot` command
3. Save the bot token

### 2. Get Chat ID
1. Message your bot
2. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Find your chat ID in the response

## 🚀 Deployment Process

### Automatic Deployment
Every push to your main branch will trigger automatic deployment on Render.

### Manual Deployment
Use the `deploy-to-render.bat` script for easy deployment with proper git management.

## ✅ Verification

After deployment, check:

1. **Health Check**: Visit `https://your-app.onrender.com`
2. **Authentication**: Test Google login
3. **Database**: Check if tables are created
4. **Scanner**: Check logs for scheduler initialization
5. **Telegram**: Test alerts (if configured)

## 🐛 Troubleshooting

### Common Issues:

#### Build Failures
- Check `package.json` dependencies
- Verify Node.js version compatibility
- Check build logs in Render dashboard

#### Database Connection
- Verify `DATABASE_URL` format
- Check PostgreSQL service status
- Ensure database allows external connections

#### Authentication Issues
- Verify Google OAuth credentials
- Check redirect URIs match exactly
- Ensure `SESSION_SECRET` is set

#### Scanner Not Working
- Check `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
- Verify cron job initialization in logs
- Test manual scan endpoints

## 📊 Monitoring

### Render Dashboard
- View application logs
- Monitor resource usage
- Check deployment status

### Application Health
- Visit `/health` endpoint (if implemented)
- Check DTI scanner logs
- Monitor database performance

## 🔄 Updates

### Code Updates
1. Make changes locally
2. Run `deploy-to-render.bat`
3. Render automatically deploys

### Environment Variables
1. Update in Render dashboard
2. Restart service if needed

## 📈 Scaling

### Free Tier Limits
- 750 hours/month
- Spins down after 15 minutes of inactivity
- Limited concurrent requests

### Paid Plans
- Always-on services
- Better performance
- More concurrent requests
- Custom domains

## 🔒 Security

### Best Practices
- Use strong `SESSION_SECRET`
- Enable HTTPS (automatic on Render)
- Regularly update dependencies
- Monitor access logs

### Environment Security
- Never commit secrets to git
- Use environment variables for all sensitive data
- Regularly rotate tokens and secrets

---

## 📞 Support

If you encounter issues:
1. Check Render logs first
2. Review this deployment guide
3. Check `CLAUDE_PROJECT_STRUCTURE.md` for codebase understanding
4. Verify environment variables are set correctly

Your Stock Proxy application is now ready for production deployment on Render! 🎉