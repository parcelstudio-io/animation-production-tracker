#!/bin/bash

# Simple Google Cloud Deployment Script for Free Tier
# This script deploys using free tier quotas and manual steps

set -e

# Set environment variables
export PATH=/opt/homebrew/share/google-cloud-sdk/bin:"$PATH"
export CLOUDSDK_CONFIG=/tmp/gcloud_config

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuration for Free Tier
PROJECT_ID="thebreakfastfam"
REGION="us-central1"
SERVICE_NAME="animation-tracker"

log_info "🚀 Starting Free Tier Deployment"
log_info "Project: ${PROJECT_ID}"
log_info "Region: ${REGION}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed. Please install Docker Desktop first."
    log_info "Download from: https://www.docker.com/products/docker-desktop/"
    exit 1
fi

# Build Docker image locally
log_info "🐳 Building Docker image locally..."
docker build -t gcr.io/${PROJECT_ID}/${SERVICE_NAME} .

log_success "Docker image built successfully"

# Configure Docker for GCR
log_info "🔧 Configuring Docker for Google Container Registry..."
gcloud auth configure-docker --quiet

# Push image to GCR
log_info "📤 Pushing image to Google Container Registry..."
docker push gcr.io/${PROJECT_ID}/${SERVICE_NAME}

log_success "Image pushed successfully"

# Create Cloud SQL instance (Free Tier: db-f1-micro)
log_info "💾 Creating Cloud SQL instance (free tier)..."
if ! gcloud sql instances describe animation-db-free --region=${REGION} &> /dev/null; then
    gcloud sql instances create animation-db-free \
        --database-version=POSTGRES_13 \
        --tier=db-f1-micro \
        --region=${REGION} \
        --storage-type=HDD \
        --storage-size=10GB \
        --no-storage-auto-increase \
        --no-backup
    
    log_success "Cloud SQL instance created (free tier)"
else
    log_warning "Cloud SQL instance already exists"
fi

# Create database
log_info "📊 Creating database..."
if ! gcloud sql databases describe production_tracker --instance=animation-db-free &> /dev/null; then
    gcloud sql databases create production_tracker --instance=animation-db-free
    log_success "Database created"
else
    log_warning "Database already exists"
fi

# Create database user
log_info "👤 Creating database user..."
if ! gcloud sql users describe app-user --instance=animation-db-free &> /dev/null; then
    gcloud sql users create app-user \
        --instance=animation-db-free \
        --password=ParcelStudio2025
    log_success "Database user created"
else
    log_warning "Database user already exists"
fi

# Deploy to Cloud Run (Free Tier)
log_info "🚀 Deploying to Cloud Run (free tier)..."
gcloud run deploy ${SERVICE_NAME} \
    --image gcr.io/${PROJECT_ID}/${SERVICE_NAME} \
    --platform managed \
    --region ${REGION} \
    --allow-unauthenticated \
    --memory 512Mi \
    --cpu 1 \
    --timeout 300 \
    --max-instances 10 \
    --set-env-vars="NODE_ENV=production" \
    --set-env-vars="PORT=8080" \
    --set-env-vars="PROJECT_ID=${PROJECT_ID}" \
    --set-env-vars="REGION=${REGION}" \
    --set-env-vars="DB_HOST=/cloudsql/${PROJECT_ID}:${REGION}:animation-db-free" \
    --set-env-vars="DB_NAME=production_tracker" \
    --set-env-vars="DB_USER=app-user" \
    --set-env-vars="DB_PASS=ParcelStudio2025" \
    --set-env-vars="ENABLE_CLOUD_SYNC=true" \
    --set-env-vars="ENABLE_LOCAL_EXCEL=true" \
    --add-cloudsql-instances ${PROJECT_ID}:${REGION}:animation-db-free

# Get service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region=${REGION} --format="value(status.url)")

log_success "🎉 Deployment completed!"
log_info "📱 Service URL: ${SERVICE_URL}"

echo ""
echo "=================================================="
echo "🎯 Free Tier Deployment Summary"
echo "=================================================="
echo ""
echo "✅ Docker image: gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
echo "✅ Cloud SQL: animation-db-free (db-f1-micro)"
echo "✅ Cloud Run: ${SERVICE_NAME}"
echo "✅ Service URL: ${SERVICE_URL}"
echo ""
echo "💰 Cost: Should stay within free tier limits"
echo ""
echo "🔄 Next steps:"
echo "1. Run database migration:"
echo "   export DB_HOST=\"/cloudsql/${PROJECT_ID}:${REGION}:animation-db-free\""
echo "   export DB_NAME=\"production_tracker\""
echo "   export DB_USER=\"app-user\""
echo "   export DB_PASS=\"ParcelStudio2025\""
echo "   npm run migrate"
echo ""
echo "2. Test the application:"
echo "   curl ${SERVICE_URL}/api/debug"
echo ""
echo "=================================================="