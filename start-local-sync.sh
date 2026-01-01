#!/bin/bash

# Local Sync Startup Script for Animation Production Tracker
# This script starts the local development server with ngrok tunnel

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Check if required tools are installed
check_dependencies() {
    log_info "Checking dependencies..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    # Check ngrok
    if ! command -v ngrok &> /dev/null; then
        log_error "ngrok is not installed. Please install it:"
        echo "  npm install -g ngrok"
        echo "  or download from https://ngrok.com/"
        exit 1
    fi
    
    log_success "All dependencies are installed"
}

# Setup environment
setup_environment() {
    log_info "Setting up local environment..."
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        log_warning ".env file not found. Creating from .env.example..."
        cp .env.example .env
        log_warning "Please edit .env file with your configuration before continuing"
        return 1
    fi
    
    # Load environment variables
    set -a
    source .env
    set +a
    
    log_success "Environment setup completed"
}

# Install dependencies
install_dependencies() {
    log_info "Installing npm dependencies..."
    npm install
    log_success "Dependencies installed"
}

# Start ngrok tunnel
start_ngrok() {
    log_info "Starting ngrok tunnel..."
    
    # Kill any existing ngrok processes
    pkill -f ngrok || true
    
    # Start ngrok in background
    if [ -n "$NGROK_DOMAIN" ]; then
        log_info "Starting ngrok with custom domain: $NGROK_DOMAIN"
        ngrok http 3000 --domain=$NGROK_DOMAIN --log=stdout &
    else
        log_info "Starting ngrok with auto-generated domain"
        ngrok http 3000 --log=stdout &
    fi
    
    NGROK_PID=$!
    
    # Wait for ngrok to start
    sleep 3
    
    # Get ngrok public URL
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url' 2>/dev/null || echo "")
    
    if [ -n "$NGROK_URL" ] && [ "$NGROK_URL" != "null" ]; then
        log_success "ngrok tunnel started: $NGROK_URL"
        echo "NGROK_PUBLIC_URL=$NGROK_URL" >> .env
        
        # Update cloud service with ngrok URL (if configured)
        if [ -n "$CLOUD_WEBAPP_URL" ]; then
            log_info "Notifying cloud service of ngrok URL..."
            curl -X POST "$CLOUD_WEBAPP_URL/webhook/register-local" \
                -H "Content-Type: application/json" \
                -d "{\"ngrok_url\": \"$NGROK_URL\"}" \
                --silent || log_warning "Failed to notify cloud service"
        fi
    else
        log_error "Failed to get ngrok URL"
        kill $NGROK_PID 2>/dev/null || true
        exit 1
    fi
}

# Start local server
start_server() {
    log_info "Starting local development server..."
    
    # Set development environment
    export NODE_ENV=development
    export ENABLE_CLOUD_SYNC=true
    export ENABLE_LOCAL_EXCEL=true
    
    # Start server
    npm run dev &
    SERVER_PID=$!
    
    # Wait for server to start
    sleep 2
    
    # Test server health
    if curl -s http://localhost:3000/api/debug > /dev/null; then
        log_success "Local server started successfully"
        log_info "Server running on http://localhost:3000"
    else
        log_error "Failed to start local server"
        kill $SERVER_PID 2>/dev/null || true
        kill $NGROK_PID 2>/dev/null || true
        exit 1
    fi
}

# Display status
show_status() {
    echo ""
    echo "=================================================="
    echo "🚀 Animation Production Tracker - Local Sync Mode"
    echo "=================================================="
    echo ""
    echo "📱 Local Server:    http://localhost:3000"
    echo "🌐 ngrok Tunnel:    $NGROK_URL"
    echo "🔍 ngrok Inspector: http://localhost:4040"
    echo ""
    echo "🔄 Sync Status:"
    echo "   ✅ Local Excel:   Enabled"
    echo "   ☁️  Cloud Sync:    $([ -n "$CLOUD_WEBAPP_URL" ] && echo "Enabled" || echo "Disabled")"
    echo "   🔗 Webhook URL:   $NGROK_URL/webhook/sync-from-cloud"
    echo ""
    echo "📝 To configure cloud webhook, set:"
    echo "   NGROK_WEBHOOK_URL=$NGROK_URL"
    echo ""
    echo "Press Ctrl+C to stop all services"
    echo "=================================================="
}

# Cleanup function
cleanup() {
    log_warning "Shutting down services..."
    
    # Kill ngrok
    if [ -n "$NGROK_PID" ]; then
        kill $NGROK_PID 2>/dev/null || true
    fi
    pkill -f ngrok || true
    
    # Kill server
    if [ -n "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null || true
    fi
    
    log_success "Cleanup completed"
    exit 0
}

# Set trap for cleanup
trap cleanup SIGINT SIGTERM

# Main function
main() {
    log_info "Starting Animation Production Tracker with local sync..."
    
    check_dependencies
    
    if ! setup_environment; then
        exit 1
    fi
    
    install_dependencies
    start_ngrok
    start_server
    show_status
    
    # Keep script running
    while true; do
        # Check if ngrok is still running
        if ! pgrep -f ngrok > /dev/null; then
            log_error "ngrok stopped running"
            cleanup
        fi
        
        # Check if server is still running
        if ! pgrep -f "node.*server.js" > /dev/null; then
            log_error "Server stopped running"
            cleanup
        fi
        
        sleep 5
    done
}

# Run main function
main "$@"