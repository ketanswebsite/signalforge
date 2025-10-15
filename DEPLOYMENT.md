# Deployment Checklist

Complete deployment guide for the SutrAlgo Trading Signals Integration system.

## Pre-Deployment Checklist

### Code Quality
- [ ] All tests passing (`node tests/database.test.js`)
- [ ] Performance tests passing (`node tests/performance.test.js`)
- [ ] No console errors in browser
- [ ] Code reviewed and approved
- [ ] Git repository up to date

### Database
- [ ] Database backup created
- [ ] Database migrations tested
- [ ] All indexes created
- [ ] Constraints verified
- [ ] Default data populated

### Environment
- [ ] Environment variables configured
  - [ ] `DATABASE_URL` set
  - [ ] `TELEGRAM_BOT_TOKEN` set
  - [ ] `NODE_ENV` set to 'production'
  - [ ] Port configuration verified
- [ ] API keys validated
- [ ] SSL certificates up to date (if applicable)

### Services
- [ ] Telegram bot tested and responding
- [ ] Yahoo Finance API accessible
- [ ] Email service configured (if used)
- [ ] Backup strategy in place

---

## Deployment Steps

### 1. Pre-Deployment

```bash
# Create database backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Or for SQLite
cp database.db database_backup_$(date +%Y%m%d_%H%M%S).db
```

### 2. Stop Services

```bash
# Stop any running cron jobs
# On Render, no action needed (will restart automatically)

# Locally, stop Node process
pm2 stop all  # if using PM2
# or
pkill -f node  # if running directly
```

### 3. Deploy Code

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install --production

# Verify installation
npm list
```

### 4. Database Migrations

```bash
# Run migrations (if any)
# Database schema is auto-initialized on first run

# Verify database connection
node -e "const db = require('./database-postgres'); console.log('DB Connected:', db.isConnected());"
```

### 5. Test Basic Functionality

```bash
# Run health check
node tests/database.test.js

# Start server in test mode
NODE_ENV=production node server.js &
SERVER_PID=$!

# Wait for server to start
sleep 5

# Test API endpoint
curl http://localhost:3000/api/test

# Stop test server
kill $SERVER_PID
```

### 6. Start Services

```bash
# Start server (production)
NODE_ENV=production node server.js

# Or with PM2
pm2 start server.js --name sutralgo

# Or on Render (automatic)
# Push to GitHub and Render will auto-deploy
```

### 7. Verify Deployment

- [ ] Server responding to requests
- [ ] Database queries working
- [ ] Telegram bot responding
- [ ] Cron jobs scheduled
- [ ] Logs being written correctly

### 8. Monitor

```bash
# Check logs
tail -f logs/app.log  # if file logging enabled
# or
pm2 logs sutralgo
# or on Render
# Check Render dashboard logs
```

---

## Post-Deployment Verification

### Immediate Checks (First Hour)

- [ ] Server status: Running
- [ ] HTTP requests: Responding
- [ ] Database: Connected
- [ ] Memory usage: Normal
- [ ] No error logs
- [ ] API endpoints accessible

### 24-Hour Checks

- [ ] Cron jobs executed successfully
  - [ ] 7 AM signal scan completed
  - [ ] Exit monitor running every 5 minutes
- [ ] Telegram alerts sent correctly
- [ ] No memory leaks detected
- [ ] Performance metrics normal
- [ ] User reports reviewed

### Weekly Checks

- [ ] Performance metrics reviewed
- [ ] Database size monitored
- [ ] Log rotation working
- [ ] Backup verification
- [ ] Security audit passed

---

## Rollback Plan

If deployment fails or critical issues arise:

### 1. Immediate Rollback

```bash
# Stop current server
pm2 stop sutralgo
# or
pkill -f node

# Checkout previous version
git checkout [previous-commit-hash]

# Restore database backup (if needed)
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql

# Restart server
pm2 start server.js --name sutralgo
```

### 2. Verify Rollback

- [ ] Server running on previous version
- [ ] Database restored successfully
- [ ] All services functioning
- [ ] Users notified of rollback

### 3. Document Issue

- [ ] Add to BUGS.md
- [ ] Create GitHub issue
- [ ] Document steps to reproduce
- [ ] Plan fix for next deployment

---

## Render-Specific Deployment

### Auto-Deployment via GitHub

1. Push code to GitHub:
   ```bash
   git add -A
   git commit -m "Deployment: Description"
   git push origin main
   ```

2. Render automatically:
   - Detects the push
   - Builds the application
   - Runs `npm install`
   - Restarts the service

3. Monitor deployment:
   - Check Render dashboard
   - View build logs
   - Verify deploy status

### Manual Deployment on Render

1. Log into Render dashboard
2. Select your service
3. Click "Manual Deploy"
4. Select "Clear build cache & deploy" if needed
5. Monitor deployment logs

---

## Environment Variables (Render)

Configure in Render Dashboard → Service → Environment:

```
DATABASE_URL=postgresql://user:pass@host:port/dbname
TELEGRAM_BOT_TOKEN=your_bot_token_here
NODE_ENV=production
PORT=3000
SESSION_SECRET=your_secret_here
```

---

## Health Monitoring

### Endpoints to Monitor

- `GET /api/test` - Basic health check
- `GET /api/trades` - Database connectivity
- `GET /api/settings` - Settings system

### Expected Response Times

- Simple queries: < 50ms
- Complex queries: < 500ms
- Capital calculation: < 100ms
- Exit check: < 5000ms

### Alert Thresholds

- Response time > 1000ms
- Memory usage > 80%
- Error rate > 1%
- Database connection failures

---

## Troubleshooting

### Server Won't Start

1. Check environment variables
2. Verify database connection
3. Check port availability
4. Review error logs
5. Verify Node version (>= 16.x)

### Database Connection Issues

1. Verify `DATABASE_URL` format
2. Check database server status
3. Test connection manually
4. Verify network/firewall rules
5. Check database credentials

### Telegram Bot Not Responding

1. Verify `TELEGRAM_BOT_TOKEN`
2. Check bot status with BotFather
3. Test webhook endpoint
4. Review Telegram API logs
5. Verify network connectivity

### Performance Degradation

1. Run performance tests
2. Check database query times
3. Monitor memory usage
4. Review slow query logs
5. Optimize indexes if needed

---

## Contact

For deployment issues or questions:
- Check BUGS.md for known issues
- Review error logs first
- Test in development environment
- Document steps to reproduce

---

*Last Updated: 2025-01-15*
*Version: Phase 7 - Testing & Refinement*
