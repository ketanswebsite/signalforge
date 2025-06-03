# PostgreSQL Setup for SignalForge

## Overview
SignalForge now uses PostgreSQL as its primary database. This provides better performance, reliability, and scalability compared to file-based databases.

## Setting up PostgreSQL on Render

### 1. Create a PostgreSQL Database
1. Go to your Render dashboard
2. Click "New +" → "PostgreSQL"
3. Choose a name (e.g., "signalforge-db")
4. Select your plan (Starter plan includes PostgreSQL)
5. Click "Create Database"

### 2. Get Your Database URL
1. Once created, go to your PostgreSQL service
2. Copy the "External Database URL" (starts with `postgresql://`)
3. It will look like: `postgresql://username:password@host:5432/database_name`

### 3. Add Database URL to Your Web Service
1. Go to your SignalForge web service on Render
2. Go to "Environment" tab
3. Add a new environment variable:
   - Key: `DATABASE_URL`
   - Value: (paste your PostgreSQL URL)
4. Save changes

## Migration Process

### 1. Deploy the PostgreSQL Version
Deploy the latest code that includes PostgreSQL support.

### 2. Access the Migration Tool
1. Go to: `https://your-app.onrender.com/migrate-to-postgres.html`
2. Follow the on-screen steps:
   - Check current data
   - Download backup (IMPORTANT!)
   - Test PostgreSQL connection
   - Initialize database
   - Migrate data
   - Verify migration

### 3. Verify Everything Works
- Check that all your trades appear
- Test creating/editing trades
- Verify alerts work

## Local Development

### 1. Install PostgreSQL Locally
- **Windows**: Download from https://www.postgresql.org/download/windows/
- **Mac**: `brew install postgresql`
- **Linux**: `sudo apt-get install postgresql`

### 2. Create Local Database
```bash
psql -U postgres
CREATE DATABASE signalforge;
\q
```

### 3. Set Environment Variable
Add to your `.env` file:
```
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/signalforge
```

## Database Schema

### Trades Table
```sql
CREATE TABLE trades (
  id BIGSERIAL PRIMARY KEY,
  symbol VARCHAR(50) NOT NULL,
  name VARCHAR(255),
  stock_index VARCHAR(50),
  entry_date DATE,
  entry_price DECIMAL(10, 2),
  quantity INTEGER,
  position_size DECIMAL(10, 2),
  stop_loss DECIMAL(10, 2),
  target_price DECIMAL(10, 2),
  exit_date DATE,
  exit_price DECIMAL(10, 2),
  status VARCHAR(20),
  profit_loss DECIMAL(10, 2),
  profit_loss_percentage DECIMAL(5, 2),
  notes TEXT,
  user_id VARCHAR(255) NOT NULL DEFAULT 'default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Alert Preferences Table
```sql
CREATE TABLE alert_preferences (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE NOT NULL,
  telegram_enabled BOOLEAN DEFAULT false,
  telegram_chat_id VARCHAR(100),
  email_enabled BOOLEAN DEFAULT false,
  email_address VARCHAR(255),
  alert_on_buy BOOLEAN DEFAULT true,
  alert_on_sell BOOLEAN DEFAULT true,
  alert_on_target BOOLEAN DEFAULT true,
  alert_on_stoploss BOOLEAN DEFAULT true,
  alert_on_time_exit BOOLEAN DEFAULT true,
  market_open_alert BOOLEAN DEFAULT false,
  market_close_alert BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Troubleshooting

### Connection Errors
- Ensure DATABASE_URL is set correctly
- Check if PostgreSQL service is running on Render
- Verify the URL includes `?sslmode=require` for production

### Migration Issues
- Always download backup before migrating
- If migration fails, restore from backup
- Check Render logs for specific errors

### Performance
- PostgreSQL indexes are automatically created on:
  - user_id
  - status
  - symbol
- This ensures fast queries even with many trades

## Benefits of PostgreSQL

1. **Reliability**: ACID compliance ensures data integrity
2. **Performance**: Better query performance for complex operations
3. **Scalability**: Can handle millions of trades
4. **Concurrent Access**: Multiple users can access simultaneously
5. **Backups**: Render automatically backs up PostgreSQL databases
6. **SQL Features**: Advanced queries and analytics possible

## Need Help?

If you encounter issues:
1. Check the Render logs
2. Verify DATABASE_URL is set
3. Ensure you're on a paid Render plan that includes PostgreSQL
4. The migration tool at `/migrate-to-postgres.html` has built-in diagnostics