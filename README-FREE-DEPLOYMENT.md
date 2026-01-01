# 🆓 Free Deployment Guide - Animation Production Tracker

This guide shows you how to deploy the webapp completely FREE using Railway.app.

## 🎯 What You Get (100% Free)

- ✅ **Full Node.js webapp** with all features
- ✅ **PostgreSQL database** (1GB free)
- ✅ **500 hours/month** execution time
- ✅ **Custom domain** support
- ✅ **Automatic deployments** from GitHub
- ✅ **Built-in monitoring**
- ✅ **No credit card required**

## 🚀 Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `animation-production-tracker`
3. Make it **Public** (required for free tier)
4. Click "Create repository"

## 📤 Step 2: Push Code to GitHub

```bash
cd "/Users/jaewoojang/Parcel Studio Dropbox/Parcel Studio Team Folder/Creative_Projects/THE BREAKFAST FAM/management/production/webapp"

# Initialize git repository
git init
git add .
git commit -m "Initial commit - Animation Production Tracker"

# Add GitHub remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/animation-production-tracker.git
git branch -M main
git push -u origin main
```

## 🚂 Step 3: Deploy to Railway

1. **Sign up**: Go to https://railway.app/
   - Click "Sign up with GitHub"
   - Authorize Railway to access your repositories

2. **Create new project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose `animation-production-tracker`

3. **Add PostgreSQL database**:
   - In your project dashboard, click "New"
   - Select "Database" → "PostgreSQL"
   - Railway will create a free PostgreSQL instance

4. **Configure environment variables**:
   - Click on your service
   - Go to "Variables" tab
   - Add these variables:

```env
NODE_ENV=production
PORT=3000
ENABLE_CLOUD_SYNC=true
ENABLE_LOCAL_EXCEL=false
DB_HOST=${{Postgres.PGHOST}}
DB_NAME=${{Postgres.PGDATABASE}}
DB_USER=${{Postgres.PGUSER}}
DB_PASS=${{Postgres.PGPASSWORD}}
DB_PORT=${{Postgres.PGPORT}}
WEBHOOK_SECRET=ParcelStudio2025
```

## 🔄 Step 4: Run Database Migration

1. **Connect to Railway CLI**:
   ```bash
   npm install -g @railway/cli
   railway login
   railway link
   ```

2. **Run migration**:
   ```bash
   railway run npm run migrate
   ```

## 🌐 Step 5: Access Your Webapp

1. **Get your URL**:
   - In Railway dashboard, click your service
   - Go to "Settings" tab
   - Click "Generate Domain"
   - Your app will be available at: `https://your-app-name.up.railway.app`

## 🔗 Step 6: Set Up Local Sync (Optional)

If you want bidirectional sync between local Excel and cloud database:

1. **Update your local .env**:
   ```env
   CLOUD_WEBAPP_URL=https://your-app-name.up.railway.app
   ENABLE_CLOUD_SYNC=true
   ```

2. **Start local server with ngrok**:
   ```bash
   ./start-local-sync.sh
   ```

3. **Configure webhook in Railway**:
   - Add environment variable: `NGROK_WEBHOOK_URL=https://your-ngrok-url.ngrok.io`

## 💰 Cost Breakdown

- **Railway hosting**: FREE (500 hours/month)
- **PostgreSQL database**: FREE (1GB storage)
- **Domain**: FREE (.railway.app subdomain)
- **ngrok**: FREE (basic plan)
- **Total**: $0/month 🎉

## 📊 Usage Limits (Free Tier)

- **Execution time**: 500 hours/month (≈16 hours/day)
- **Database storage**: 1GB
- **Bandwidth**: Fair use policy
- **Custom domains**: 1 free

*Should be more than enough for a team production tracker!*

## 🛠️ Troubleshooting

### App not starting?
```bash
railway logs
```

### Database connection issues?
```bash
railway variables
```

### Need to restart?
```bash
railway redeploy
```

## 🎯 Next Steps

1. ✅ Test the webapp thoroughly
2. ✅ Set up your team with the URL
3. ✅ Configure local sync if needed
4. ✅ Add custom domain (optional)

## 🔄 Updates

To update your app:
1. Make changes locally
2. `git add .`
3. `git commit -m "Update description"`
4. `git push`
5. Railway auto-deploys! 🚀

**Your webapp will be live at**: `https://your-app-name.up.railway.app`