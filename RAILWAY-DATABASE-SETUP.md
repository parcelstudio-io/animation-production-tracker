# Railway Database Configuration

## Current Status
Your app is currently configured for Google Cloud SQL, but you're deploying to Railway. Let's fix this.

## Railway PostgreSQL Setup

### 1. Add PostgreSQL Service to Railway
1. Go to your Railway dashboard: https://railway.app/
2. Open your `animation-tracker-production` project  
3. Click **"+ New Service"**
4. Select **"PostgreSQL"**
5. Railway will automatically create a PostgreSQL database

### 2. Environment Variables Railway Provides
Railway automatically sets these variables when you add PostgreSQL:
- `DATABASE_URL` - Complete connection string (Railway manages this)
- `PGHOST` - Database host
- `PGPORT` - Database port  
- `PGDATABASE` - Database name
- `PGUSER` - Database user
- `PGPASSWORD` - Database password

### 3. Required Environment Variables in Railway
Set these manually in your Railway dashboard:

```bash
# Application
NODE_ENV=production
PORT=3000

# Local Server Sync (for ngrok tunnel)
LOCAL_SERVER_URL=https://nonconfirming-kaiden-nonoily.ngrok-free.dev
LOCAL_SERVER_API_KEY=ParcelStudio2025

# Security  
WEBHOOK_SECRET=ParcelStudio2025

# Feature Flags
ENABLE_CLOUD_SYNC=true
ENABLE_LOCAL_EXCEL=false
AUTO_BACKUP_EXCEL=false
```

### 4. Database Migration
After adding PostgreSQL, run the database migration:

```bash
# Option 1: Through Railway CLI
railway run npm run migrate

# Option 2: Connect to Railway and run migration
# The migration will create the necessary tables
```

## How the Database Connection Works

Your `database/db.js` is already configured to handle Railway:

```javascript
// Checks for DATABASE_URL first (Railway style)
const dbConfig = process.env.DATABASE_URL ? {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
} : {
    // Fallback to individual variables
    host: process.env.DB_HOST || process.env.PGHOST,
    database: process.env.DB_NAME || process.env.PGDATABASE,
    // ...
};
```

## Verification Steps

### 1. Check Database Connection
Add this endpoint to test your database:

```javascript
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await db.pool.query('SELECT NOW()');
    res.json({ 
      success: true, 
      message: 'Database connected successfully',
      timestamp: result.rows[0].now 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
```

### 2. Test After Deployment
Visit: `https://animation-tracker-production.up.railway.app/api/db-test`

Should return:
```json
{
  "success": true,
  "message": "Database connected successfully", 
  "timestamp": "2026-01-01T..."
}
```

## Migration Commands

The migration script will create these tables:
- `production_summary` - Main production data
- `sync_log` - Sync operation history  

## Troubleshooting

### Connection Issues
1. Verify PostgreSQL service is running in Railway
2. Check that `DATABASE_URL` is available in Railway variables
3. Ensure SSL is enabled (`ssl: { rejectUnauthorized: false }`)

### Migration Failures  
1. Check Railway logs: `railway logs`
2. Verify database permissions
3. Run migration manually: `railway run npm run migrate`