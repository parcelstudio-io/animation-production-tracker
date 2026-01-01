# Animation Production Tracker - Deployment Guide

This guide walks you through deploying the Animation Production Tracker to Google Cloud with bidirectional sync between cloud and local environments.

## 🏗️ Architecture Overview

```
[Local Machine] ←→ [ngrok tunnel] ←→ [Google Cloud Run]
       ↓                                      ↓
[production_summary.xlsx]              [Cloud SQL PostgreSQL]
```

## 🔑 Prerequisites & Credentials Needed

### 1. Google Cloud Setup

- **Google Cloud Project ID**: `thebreakfastfam` ✅
- **Region**: `us-central1` ✅
- Google Cloud account with billing enabled
- gcloud CLI installed and authenticated

### 2. Required Credentials (NEEDED FROM YOU)

#### Database Password

```bash
# You'll need to create a secure password for the database
DB_PASSWORD="ParcelStudio2025"
```

#### ngrok Account

```bash
# Sign up at https://ngrok.com and get your auth token
NGROK_AUTH_TOKEN="37dy9pRwBq90hthNeNjcHarWbHk_3ZU1bYJeza3sUjXUSqQrd"
```

#### Webhook Secret (for security)

```bash
# Generate a random secret for webhook validation
WEBHOOK_SECRET="ParcelStudio2025"
```

#### Optional: Custom ngrok Domain

```bash
# If you have ngrok Pro/Business plan
NGROK_DOMAIN="nonconfirming-kaiden-nonoily.ngrok-free.dev"
```

## 🚀 Deployment Steps

### Step 1: Install Prerequisites

```bash
# Install Google Cloud CLI (if not already installed)
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Install ngrok (if not already installed)
npm install -g ngrok
# OR download from https://ngrok.com/

# Install dependencies
cd webapp
npm install
```

### Step 2: Authenticate with Google Cloud

```bash
gcloud auth login
gcloud config set project thebreakfastfam
```

### Step 3: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

**Required .env configurations:**

```env
# Database
DB_PASS=your_secure_database_password_here

# ngrok
NGROK_WEBHOOK_SECRET=your_random_webhook_secret_here

# Optional: Custom domain
NGROK_DOMAIN=thebreakfastfam.ngrok.io
```

### Step 4: Deploy to Google Cloud

```bash
# Make deploy script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

The deployment script will:

1. ✅ Create Google Cloud resources
2. ✅ Set up Cloud SQL PostgreSQL instance
3. ✅ Create service accounts and permissions
4. ✅ Build and deploy Docker container
5. ⚠️ **Prompt you to set secrets manually**

### Step 5: Set Google Cloud Secrets

After deployment completes, you'll need to manually set the secrets:

```bash
# Database credentials
echo '{"username":"app-user","password":"your_secure_database_password_here"}' | \
gcloud secrets create db-credentials --data-file=-

# Webhook secret
echo '{"webhook-secret":"your_random_webhook_secret_here"}' | \
gcloud secrets create sync-config --data-file=-
```

### Step 6: Run Database Migration

```bash
# Set environment for migration
export DB_HOST="/cloudsql/thebreakfastfam:us-central1:animation-db"
export DB_NAME="production_tracker"
export DB_USER="app-user"
export DB_PASS="your_secure_database_password_here"
export NODE_ENV="production"

# Run migration
npm run migrate
```

### Step 7: Start Local Sync

```bash
# Configure ngrok authentication
ngrok authtoken your_ngrok_auth_token_here

# Start local sync server
./start-local-sync.sh
```

## 🔧 Post-Deployment Configuration

### Get Your Cloud Service URL

```bash
# Get the deployed service URL
gcloud run services describe animation-production-tracker \
  --region=us-central1 \
  --format="value(status.url)"
```

### Configure Cloud → Local Sync

1. Copy the ngrok URL from the local sync startup
2. Add it to your cloud service environment:

```bash
# Update cloud service with ngrok webhook URL
gcloud run services update animation-production-tracker \
  --region=us-central1 \
  --update-env-vars NGROK_WEBHOOK_URL=https://your-ngrok-url.ngrok.io
```

### Test the Setup

1. **Local Interface**: http://localhost:3000
2. **Cloud Interface**: Your Cloud Run service URL
3. **ngrok Inspector**: http://localhost:4040

## 📊 Verification Checklist

- [ ] Cloud Run service is deployed and accessible
- [ ] Database connection is working
- [ ] Local server starts successfully
- [ ] ngrok tunnel is active
- [ ] Excel file updates sync to cloud database
- [ ] Cloud database updates sync to local Excel file
- [ ] Directory scanning works for episodes/scenes/shots

## 🔍 Monitoring & Logs

### Cloud Logs

```bash
# View Cloud Run logs
gcloud logs read --service=animation-production-tracker --region=us-central1

# View Cloud SQL logs
gcloud sql operations list --instance=animation-db
```

### Local Logs

```bash
# View local server logs
npm run dev

# View ngrok logs
ngrok http 3000 --log=stdout
```

## 🛠️ Troubleshooting

### Database Connection Issues

```bash
# Test database connection
gcloud sql connect animation-db --user=app-user --database=production_tracker
```

### ngrok Issues

```bash
# Check ngrok status
curl http://localhost:4040/api/tunnels

# Restart ngrok
pkill ngrok
./start-local-sync.sh
```

### Sync Issues

```bash
# Check sync status via API
curl http://localhost:3000/api/sync/status
curl https://your-cloud-url/api/sync/status

# Force full sync
curl -X POST http://localhost:3000/api/sync/full
```

## 🔒 Security Considerations

- Database password should be strong (20+ characters)
- Webhook secret should be randomly generated
- ngrok tunnel should use HTTPS
- Cloud Run service uses service accounts with minimal permissions
- All secrets are stored in Google Secret Manager

## 💰 Cost Estimates

**Monthly costs (approximate):**

- Cloud Run: $5-20 (depending on usage)
- Cloud SQL: $25-50 (small instance)
- Storage: $1-5 (for backups)
- **Total**: ~$30-75/month

## 📞 Support

If you encounter issues:

1. Check the logs first
2. Verify all secrets are set correctly
3. Test database connectivity
4. Check ngrok tunnel status
5. Review firewall/network settings

## 🎯 Next Steps After Deployment

1. ✅ Test all functionality thoroughly
2. ✅ Set up monitoring and alerts
3. ✅ Configure automated backups
4. ✅ Train team on new workflow
5. ✅ Document team-specific procedures
