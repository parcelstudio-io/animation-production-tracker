# Local Production Tracker Server

A local server that syncs with the Railway-deployed production tracker web application and provides real-time bidirectional synchronization.

## Features

- **Excel-based Storage**: Uses production_summary.xlsx as the authoritative data source
- **Real-time Bidirectional Sync**: Immediate synchronization between local server and Railway app
- **Animation Duration Analysis**: Automatic FFmpeg-based video duration checking
- **REST API**: Full CRUD operations for production records with real-time sync
- **Railway Integration**: Seamless sync with Railway PostgreSQL database
- **Directory Scanning**: Automatic project structure detection from filesystem
- **Authentication**: API key authentication for secure access
- **Frontend Integration**: Direct support for frontend table operations

## Manual Server Startup

### Prerequisites

1. **Install Node.js** (version 16 or higher)
2. **Install Dependencies**
   ```bash
   npm install
   ```

### Environment Configuration

Create a `.env` file in the root directory with the following variables:

```bash
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration (PostgreSQL)
DATABASE_URL=your_postgres_connection_string
ENABLE_CLOUD_SYNC=true

# Railway Integration (optional)
RAILWAY_APP_URL=https://your-railway-app.railway.app
LOCAL_SERVER_API_KEY=your_secret_api_key
API_SECRET=your_api_secret

# Sync Configuration
SYNC_INTERVAL_MINUTES=5
ENABLE_AUTO_SYNC=true
ENABLE_LOCAL_EXCEL=true
```

### Manual Startup Steps

1. **Navigate to Project Directory**
   ```bash
   cd /path/to/production/management/production
   ```

2. **Install Dependencies** (if not already done)
   ```bash
   npm install
   ```

3. **Start the Server**
   ```bash
   npm start
   ```

   **Alternative: Development Mode with Auto-Restart**
   ```bash
   npm run dev
   ```

4. **Verify Server is Running**
   - Server will be available at: `http://localhost:3001`
   - Health check: `http://localhost:3001/api/health`

### Server Output on Startup

You should see output similar to:
```
🚀 Initializing Animation Production Tracker...
✅ Database connection established
📁 Directory structure scanned successfully
🌐 Server URL: http://localhost:3001
📊 Database: Connected (PostgreSQL)
```

## Configuration

### Environment Variables

| Variable                | Description               | Default               |
| ----------------------- | ------------------------- | --------------------- |
| `PORT`                  | Server port               | 3001                  |
| `DATABASE_URL`          | PostgreSQL connection     | -                     |
| `API_SECRET`            | API authentication key    | -                     |
| `RAILWAY_APP_URL`       | URL of your Railway app   | -                     |
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

### Directory Structure

- `GET /api/structure` - Get project directory structure (episodes, scenes, shots)
- `GET /api/structure/lists` - Get simplified episode/project lists for dropdowns
- `GET /api/structure/:projectName/scenes` - Get scenes for specific project
- `GET /api/structure/:projectName/scenes/:sceneName/shots` - Get shots for specific scene

### Frontend API (Real-time Sync Enabled)

- `GET /api/production-data` - Get all records in frontend format
- `POST /api/production-data` - Create record with immediate bidirectional sync
- `PUT /api/production-data/:id` - Update record with immediate bidirectional sync
- `DELETE /api/production-data/:id` - Delete record with immediate bidirectional sync

### Sync Operations

- `POST /api/sync/railway-database` - Manual sync from Railway database
- `POST /api/sync/from-railway` - Receive updates from Railway app
- `GET /api/sync/excel-data` - Export Excel data for Railway app
- `GET /api/sync/status` - Get sync status and timing

### Utility

- `GET /` - Server information and endpoint list
- `GET /api/health` - Health check
- `GET /api/excel-export` - Download Excel file
- `GET /api/excel-status` - Check Excel file status

## Authentication

All API endpoints require authentication via the `x-api-key` header:

```bash
curl -H "x-api-key: your-secret-key" http://localhost:3001/api/productions
```

## Integration with Railway App

### Environment Variables for Railway App

Configure the Railway app to connect to your local server:

```bash
LOCAL_SERVER_URL=http://your-local-server-url:3001
LOCAL_SERVER_API_KEY=your_secret_api_key
```

### Key Endpoints for Railway App

```javascript
// 1. Get Excel data for Railway sync
const response = await fetch(`${LOCAL_SERVER_URL}/api/sync/excel-data`);
const result = await response.json();

// 2. Get directory structure
const structureResponse = await fetch(`${LOCAL_SERVER_URL}/api/structure`);
const structure = await structureResponse.json();

// 3. Sync updates from Railway app to local server
const syncResponse = await fetch(`${LOCAL_SERVER_URL}/api/sync/from-railway`, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'x-api-key': 'your_api_key'
  },
  body: JSON.stringify({
    action: 'create', // or 'update', 'delete'
    data: {
      animator: 'John Doe',
      project_type: 'long-form',
      episode_title: 'Episode_06',
      scene: 'SC_01',
      shot: 'SH_01',
      week_yyyymmdd: '20250103',
      status: 'submitted',
      notes: 'Test entry'
    }
  })
});
```

### Real-time Sync Architecture

The system operates with bidirectional sync between Railway app and local server:

1. **Railway App First Visit**: Fetches project structure and Excel data from local server
2. **Railway App Updates**: Automatically notifies local server of changes via `/api/sync/from-railway`
3. **Local Server**: Maintains Excel file and PostgreSQL database as data sources
4. **Directory Structure**: Automatically scanned from filesystem and provided to Railway app

## Data Sync Flow

### Railway App → Local Server Sync

When users make changes in the Railway app:
1. Railway app saves to its PostgreSQL database
2. Railway app calls local server `/api/sync/from-railway` endpoint
3. Local server updates its database and Excel file
4. Both systems remain synchronized

### Local Server → Railway App Sync

When Railway app loads for the first time:
1. Railway app calls local server `/api/production-data/with-local-sync`
2. Local server provides Excel data (authoritative source)
3. Railway app updates its database with local Excel data
4. Railway app receives directory structure from local filesystem

## Directory Structure Detection

The server automatically scans project directories to detect:

- **Episodes**: `Episode_01`, `Episode_02`, etc.
- **Scenes**: Extracted from audio files (`SC_XX_SH_YY_Audio.wav`)
- **Shots**: Extracted from animation files (`SC_XX_SH_YY_animation_vXXX.mp4`)
- **Short Forms**: Content in `Short-Forms` directory

This structure is provided to the Railway app for dropdown population.

## Database Schema

Local PostgreSQL database contains:

- `production_summary` - Main production records
- `sync_log` - Sync operation history
- `server_status` - Server status and monitoring

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
4. **Database Issues**: Check database connection and credentials
5. **Directory Scanning**: Ensure project files are in expected locations