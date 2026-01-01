# 🚀 Render.com Free Deployment Guide

Deploy your Animation Production Tracker to Render.com with full PostgreSQL database - completely free!

## 🎯 What You Get (100% Free)

- ✅ **750 hours/month** web service (25 hours/day)
- ✅ **PostgreSQL database** (1GB storage, 1M rows)
- ✅ **Automatic deployments** from GitHub
- ✅ **Custom SSL certificates**
- ✅ **No credit card** required for free tier
- ✅ **Professional URL**: `https://your-app-name.onrender.com`

## 📋 **Step-by-Step Deployment**

### Step 1: Create GitHub Repository

First, we need to push your code to GitHub so Render can access it.

**You'll need to:**
1. Go to https://github.com/new
2. Repository name: `animation-production-tracker`
3. Make it **Public** (required for free tier)
4. Don't initialize with README (we have files already)
5. Click "Create repository"

### Step 2: Push Code to GitHub

```bash
# Navigate to your project
cd "/Users/jaewoojang/Parcel Studio Dropbox/Parcel Studio Team Folder/Creative_Projects/THE BREAKFAST FAM/management/production/webapp"

# Initialize git if not already done
git init
git add .
git commit -m "🎬 Animation Production Tracker - Ready for Render deployment

Features:
- Clean webapp for animation production tracking
- PostgreSQL database with Excel sync
- Directory scanning for episodes/scenes/shots  
- Weekly summaries with navigation
- Real-time bidirectional sync
- Delete functionality with confirmations"

# Add your GitHub repository (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/animation-production-tracker.git
git branch -M main
git push -u origin main
```

### Step 3: Deploy to Render

1. **Sign up at Render**: https://render.com/
   - Click "Sign Up" 
   - Choose "Sign up with GitHub"
   - Authorize Render to access your repositories

2. **Create PostgreSQL Database**:
   - In Render dashboard, click "New +"
   - Select "PostgreSQL"
   - Database Name: `animation-tracker-db`
   - Database User: `app_user` 
   - Plan: **Free** (1GB storage)
   - Click "Create Database"
   - **Save the connection details** (Database URL, Host, etc.)

3. **Create Web Service**:
   - Click "New +" again
   - Select "Web Service"
   - Connect your GitHub repository: `animation-production-tracker`
   - Configuration:
     - **Name**: `animation-tracker`
     - **Environment**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Plan**: **Free** (750 hours/month)

4. **Add Environment Variables**:
   In the web service settings, add these environment variables:

   ```env
   NODE_ENV=production
   ENABLE_CLOUD_SYNC=true
   ENABLE_LOCAL_EXCEL=false
   AUTO_BACKUP_EXCEL=true
   WEBHOOK_SECRET=ParcelStudio2025
   
   # Database connection (from your PostgreSQL service)
   DATABASE_URL=[Copy from your PostgreSQL service]
   DB_HOST=[Copy from PostgreSQL service]
   DB_NAME=animation-tracker-db
   DB_USER=app_user
   DB_PASS=[Copy from PostgreSQL service]
   DB_PORT=5432
   ```

### Step 4: Run Database Migration

1. **Connect via Render Shell**:
   - In your web service, go to "Shell" tab
   - Run: `npm run migrate`

   **OR manually via connection string:**
   ```bash
   # Install PostgreSQL client locally
   brew install postgresql
   
   # Connect to your Render database
   psql [YOUR_DATABASE_URL_FROM_RENDER]
   
   # Run the schema from database/schema.sql
   \i database/schema.sql
   ```

### Step 5: Access Your Live App

Your app will be available at: `https://animation-tracker.onrender.com`

## 🔗 **Setting Up Local Sync (Optional)**

To sync between your local Excel file and the cloud database:

1. **Update your local .env**:
   ```env
   CLOUD_WEBAPP_URL=https://animation-tracker.onrender.com
   ENABLE_CLOUD_SYNC=true
   ENABLE_LOCAL_EXCEL=true
   ```

2. **Start local sync**:
   ```bash
   ./start-local-sync.sh
   ```

3. **Configure webhook in Render**:
   - Add environment variable: `NGROK_WEBHOOK_URL=https://your-ngrok-url.ngrok.io`
   - Restart the service

## 💰 **Cost Breakdown**

- **Web Service**: FREE (750 hours/month)
- **PostgreSQL**: FREE (1GB storage, 1M rows)  
- **SSL Certificate**: FREE
- **Custom Domain**: FREE
- **Total**: **$0/month** 🎉

## 📊 **Free Tier Limits**

- **Web Service**: 750 hours/month (sleeps after 15 min inactivity)
- **Database**: 1GB storage, 1 million rows
- **Bandwidth**: 100GB/month
- **Build minutes**: 500/month

*Perfect for a team production tracker!*

## 🛠️ **Managing Your App**

### View Logs
- Go to Render dashboard → Your service → "Logs" tab

### Restart Service  
- Go to "Settings" → "Manual Deploy" → "Deploy Latest Commit"

### Update App
1. Push changes to GitHub: `git push`
2. Render automatically redeploys! 🚀

### Add Custom Domain
1. In service settings → "Custom Domains"
2. Add your domain (e.g., `tracker.thebreakfastfam.com`)
3. Update DNS records as shown

## 🎯 **What's Next**

1. ✅ Create GitHub repository
2. ✅ Deploy to Render
3. ✅ Set up database
4. ✅ Run migration
5. ✅ Test the application
6. ✅ Configure local sync (if needed)
7. ✅ Share with your team!

**Ready to start? Let me know when you've created the GitHub repository and I'll help you with the next steps!**