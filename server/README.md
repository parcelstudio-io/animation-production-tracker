# Local Production Tracker Server

A local server that syncs with the Railway-deployed production tracker web application and provides real-time bidirectional synchronization.

## Features

- **Excel-based Storage**: Uses production_summary.xlsx which uses the remote database hosted Railway as the canonical source.
- **Real-time Bidirectional Sync**: Immediate synchronization on all data changes
- **Animation Duration Analysis**: Automatic FFmpeg-based video duration checking
- **REST API**: Full CRUD operations for production records with real-time sync
- **Railway Integration**: Seamless sync with Railway PostgreSQL database
- **Auto-sync**: Configurable automatic synchronization intervals
- **Authentication**: API key authentication for secure access
- **Frontend Integration**: Direct support for frontend table operations

## Quick Start

1. **Setup**

   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

2. **Configure Environment**

   - Copy `.env.example` to `.env`
   - Set your Railway app URL and API secret

3. **Start Server**
   ```bash
   npm start
   ```

The server will be available at `http://localhost:3001`

## Configuration

### Environment Variables

| Variable                | Description               | Default               |
| ----------------------- | ------------------------- | --------------------- |
| `PORT`                  | Server port               | 3001                  |
| `RAILWAY_APP_URL`       | URL of your Railway app   | -                     |
| `API_SECRET`            | API authentication key    | -                     |
| `DATABASE_PATH`         | SQLite database file path | ./local_production.db |
| `SYNC_INTERVAL_MINUTES` | Auto-sync interval        | 5                     |
| `ENABLE_AUTO_SYNC`      | Enable automatic sync     | true                  |

## API Endpoints

### Productions

- `GET /api/productions` - Get all production records
- `GET /api/productions/short-form` - Get short-form content only
- `GET /api/productions/long-form` - Get long-form content only
- `POST /api/productions` - Create new production record (with real-time sync)
- `PUT /api/productions/:id` - Update existing production record (with real-time sync)
- `DELETE /api/productions/:id` - Delete production record (with real-time sync)

### Frontend API (Real-time Sync Enabled)

- `GET /api/production-data` - Get all records in frontend format
- `POST /api/production-data` - Create record with immediate bidirectional sync
- `PUT /api/production-data/:id` - Update record with immediate bidirectional sync
- `DELETE /api/production-data/:id` - Delete record with immediate bidirectional sync

### Sync Operations

- `POST /api/sync/railway-database` - Manual sync from Railway database (authoritative)
- `POST /api/sync/to-railway` - Push local changes to Railway
- `GET /api/sync/status` - Get sync status and timing

### Utility

- `GET /` - Server information and endpoint list
- `GET /api/health` - Health check

## Authentication

All API endpoints require authentication via the `x-api-key` header:

```bash
curl -H "x-api-key: your-secret-key" http://localhost:3001/api/productions
```

## Data Sync

The server supports real-time bidirectional synchronization:

1. **Real-time Sync**: Every CRUD operation immediately syncs to Railway and pulls back latest data
2. **Local → Railway → Local**: Creates, updates, and deletes trigger immediate bidirectional sync
3. **Animation Duration Analysis**: Automatically checks video durations during Railway sync
4. **Auto-sync**: Runs every 5 minutes (configurable) to ensure consistency
5. **Graceful Degradation**: Local operations succeed even if Railway sync fails

### Real-time Sync Process

1. Frontend operation (create/update/delete) → Local Excel file updated
2. Immediate sync to Railway database (push local changes)
3. Immediate pull from Railway database (get concurrent updates)
4. Frontend receives sync status and updated data
5. Duration analysis runs automatically during sync operations

### Animation Duration Checking

**Long-form Content (Episodes):**

- Path: `Episode_XX/03_Production/Shots/sc_XX/sh_XX/Playblasts/animation/`
- Backup: `Episode_XX/For lineup/`
- Analysis: FFmpeg video duration analysis

**Short-form Content:**

- Path: `contents/short_forms/XX_title/01_scan/SH_XX/`
- Analysis: Image sequence frame counting (24fps)

## Database Schema

Local SQLite database mirrors the Railway PostgreSQL schema:

- `production_summary` - Main production records
- `sync_log` - Sync operation history
- `server_status` - Server status and monitoring

## Real-time Sync Response Format

Frontend operations receive detailed sync status:

```javascript
{
  "success": true,
  "message": "Entry created and synced successfully",
  "data": { /* created/updated record */ },
  "sync_status": {
    "railway_push": "completed",     // or "failed"
    "railway_pull": "completed",     // or "failed"
    "duration_ms": 1250,             // sync time in milliseconds
    "changes_pushed": 1,             // number of changes sent to Railway
    "changes_pulled": 0              // number of changes received from Railway
  }
}
```

## Integration with Railway App

### Excel Data Access via Public API

**Public URL (via ngrok):** `https://nonconfirming-kaiden-nonoily.ngrok-free.dev`

**Railway App Environment Variables:**

```bash
LOCAL_SERVER_URL=https://nonconfirming-kaiden-nonoily.ngrok-free.dev
LOCAL_SERVER_API_KEY=ParcelStudio2025
```

### Key Endpoints for Railway App

```javascript
// 1. Get Excel data in Railway format (NO AUTH REQUIRED)
const response = await fetch(
  "https://nonconfirming-kaiden-nonoily.ngrok-free.dev/api/sync/excel-data"
);
const result = await response.json();
// Returns: { success: true, data: [...], count: N, excel_file_available: true }

// 2. Check Excel file status (WITH AUTH)
const statusResponse = await fetch(
  "https://nonconfirming-kaiden-nonoily.ngrok-free.dev/api/excel-status",
  {
    headers: { "x-api-key": "ParcelStudio2025" },
  }
);

// 3. Download Excel file directly (WITH AUTH)
const fileResponse = await fetch(
  "https://nonconfirming-kaiden-nonoily.ngrok-free.dev/api/excel-export",
  {
    headers: { "x-api-key": "ParcelStudio2025" },
  }
);
const blob = await fileResponse.blob(); // Excel file as blob

// 4. Get production data in frontend format
const frontendResponse = await fetch(
  "https://nonconfirming-kaiden-nonoily.ngrok-free.dev/api/production-data"
);
const productionData = await frontendResponse.json();
```

### Real-time Sync Architecture

The system now operates with immediate bidirectional sync:

```javascript
// Frontend operations automatically trigger real-time sync
// No manual sync calls needed - happens automatically on every CRUD operation

// Create new entry (automatic real-time sync)
const createResponse = await fetch(
  "https://nonconfirming-kaiden-nonoily.ngrok-free.dev/api/production-data",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      Animator: "John Doe",
      "Project Type": "long-form",
      "Episode/Title": "Episode_06",
      Scene: "sc_01",
      Shot: "sh_01",
      "Week (YYYYMMDD)": "20250103",
      Status: "submitted",
      Notes: "Test entry",
    }),
  }
);
const result = await createResponse.json();
console.log("Sync status:", result.sync_status);
```

## Monitoring

- Check `/api/health` for server status
- Check `/api/sync/status` for sync timing
- Review `sync_log` table for sync history
- Monitor console logs for sync operations

## Development

```bash
# Development with auto-restart
npm run dev

# Create new database migration
node database/migrate.js
```

## Troubleshooting

1. **Connection Issues**: Verify Railway URL and network connectivity
2. **Authentication Errors**: Check API_SECRET configuration
3. **Sync Failures**: Review sync_log table for error details
4. **Database Issues**: Check database file permissions and disk space
