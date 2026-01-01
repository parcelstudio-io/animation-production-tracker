#!/bin/bash

# Google Cloud Deployment Script for Animation Production Tracker
# Usage: ./deploy.sh [environment]

set -e  # Exit on any error

# Set environment variables for gcloud
export PATH=/opt/homebrew/share/google-cloud-sdk/bin:"$PATH"
export CLOUDSDK_CONFIG=/tmp/gcloud_config

# Configuration
PROJECT_ID="thebreakfastfam"
REGION="us-central1"
SERVICE_NAME="animation-production-tracker"
IMAGE_NAME="gcr.io/${PROJECT_ID}/animation-tracker"
DB_INSTANCE_NAME="animation-db"
DB_NAME="production_tracker"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if gcloud is installed and authenticated
check_gcloud() {
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n 1 &> /dev/null; then
        log_error "gcloud is not authenticated. Please run 'gcloud auth login'"
        exit 1
    fi
    
    log_success "gcloud CLI is installed and authenticated"
}

# Set project and enable APIs
setup_project() {
    log_info "Setting up Google Cloud project: ${PROJECT_ID}"
    
    gcloud config set project ${PROJECT_ID}
    
    log_info "Enabling required Google Cloud APIs..."
    gcloud services enable cloudsql.googleapis.com
    gcloud services enable run.googleapis.com
    gcloud services enable cloudbuild.googleapis.com
    gcloud services enable secretmanager.googleapis.com
    gcloud services enable storage.googleapis.com
    
    log_success "Project setup completed"
}

# Create Cloud SQL instance if it doesn't exist
setup_database() {
    log_info "Setting up Cloud SQL database..."
    
    # Check if instance exists
    if gcloud sql instances describe ${DB_INSTANCE_NAME} --region=${REGION} &> /dev/null; then
        log_warning "Cloud SQL instance ${DB_INSTANCE_NAME} already exists"
    else
        log_info "Creating Cloud SQL instance: ${DB_INSTANCE_NAME}"
        gcloud sql instances create ${DB_INSTANCE_NAME} \
            --database-version=POSTGRES_15 \
            --cpu=1 \
            --memory=3840MB \
            --region=${REGION} \
            --storage-type=SSD \
            --storage-size=20GB \
            --storage-auto-increase
        
        log_success "Cloud SQL instance created"
    fi
    
    # Check if database exists
    if gcloud sql databases describe ${DB_NAME} --instance=${DB_INSTANCE_NAME} &> /dev/null; then
        log_warning "Database ${DB_NAME} already exists"
    else
        log_info "Creating database: ${DB_NAME}"
        gcloud sql databases create ${DB_NAME} --instance=${DB_INSTANCE_NAME}
        log_success "Database created"
    fi
    
    # Create database user (you'll need to set the password manually)
    log_info "Creating database user..."
    if ! gcloud sql users describe app-user --instance=${DB_INSTANCE_NAME} &> /dev/null; then
        log_warning "Please create database user manually:"
        echo "  gcloud sql users create app-user --instance=${DB_INSTANCE_NAME} --password=YOUR_SECURE_PASSWORD"
    else
        log_success "Database user already exists"
    fi
}

# Create service account
setup_service_account() {
    log_info "Setting up service account..."
    
    SA_NAME="animation-tracker-sa"
    SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
    
    if gcloud iam service-accounts describe ${SA_EMAIL} &> /dev/null; then
        log_warning "Service account ${SA_EMAIL} already exists"
    else
        log_info "Creating service account: ${SA_EMAIL}"
        gcloud iam service-accounts create ${SA_NAME} \
            --display-name="Animation Tracker Service Account"
        log_success "Service account created"
    fi
    
    # Grant necessary permissions
    log_info "Granting permissions to service account..."
    gcloud projects add-iam-policy-binding ${PROJECT_ID} \
        --member="serviceAccount:${SA_EMAIL}" \
        --role="roles/cloudsql.client"
    
    gcloud projects add-iam-policy-binding ${PROJECT_ID} \
        --member="serviceAccount:${SA_EMAIL}" \
        --role="roles/storage.admin"
    
    log_success "Service account permissions granted"
}

# Create secrets (placeholder - you'll need to add actual values)
setup_secrets() {
    log_info "Setting up secrets..."
    
    # Database credentials secret
    if gcloud secrets describe db-credentials &> /dev/null; then
        log_warning "Secret 'db-credentials' already exists"
    else
        log_warning "Please create database credentials secret manually:"
        echo '  echo "{"username":"app-user","password":"YOUR_SECURE_PASSWORD"}" | gcloud secrets create db-credentials --data-file=-'
    fi
    
    # Sync configuration secret  
    if gcloud secrets describe sync-config &> /dev/null; then
        log_warning "Secret 'sync-config' already exists"
    else
        log_warning "Please create sync configuration secret manually:"
        echo '  echo "{"webhook-secret":"YOUR_WEBHOOK_SECRET"}" | gcloud secrets create sync-config --data-file=-'
    fi
}

# Build and push Docker image
build_image() {
    log_info "Building Docker image..."
    
    # Build image using Cloud Build
    gcloud builds submit --tag ${IMAGE_NAME} .
    
    log_success "Docker image built and pushed to ${IMAGE_NAME}"
}

# Deploy to Cloud Run
deploy_service() {
    log_info "Deploying to Cloud Run..."
    
    gcloud run deploy ${SERVICE_NAME} \
        --image ${IMAGE_NAME} \
        --platform managed \
        --region ${REGION} \
        --allow-unauthenticated \
        --service-account animation-tracker-sa@${PROJECT_ID}.iam.gserviceaccount.com \
        --add-cloudsql-instances ${PROJECT_ID}:${REGION}:${DB_INSTANCE_NAME} \
        --memory 1Gi \
        --cpu 1 \
        --timeout 900 \
        --max-instances 10 \
        --min-instances 1
    
    # Get service URL
    SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region=${REGION} --format="value(status.url)")
    
    log_success "Service deployed successfully!"
    log_info "Service URL: ${SERVICE_URL}"
}

# Run database migration
run_migration() {
    log_info "Running database migration..."
    
    # Set environment variables for migration
    export DB_HOST="/cloudsql/${PROJECT_ID}:${REGION}:${DB_INSTANCE_NAME}"
    export DB_NAME="${DB_NAME}"
    export DB_USER="app-user"
    export NODE_ENV="production"
    
    log_warning "Please run migration manually with proper credentials:"
    echo "  DB_PASS=YOUR_PASSWORD npm run migrate"
}

# Main deployment function
main() {
    log_info "Starting deployment of Animation Production Tracker"
    log_info "Project: ${PROJECT_ID}"
    log_info "Region: ${REGION}"
    
    check_gcloud
    setup_project
    setup_database
    setup_service_account
    setup_secrets
    build_image
    deploy_service
    run_migration
    
    log_success "Deployment completed!"
    log_info "Next steps:"
    echo "  1. Set database password in secrets"
    echo "  2. Set webhook secret in secrets" 
    echo "  3. Run database migration"
    echo "  4. Test the application"
}

# Run main function
main "$@"