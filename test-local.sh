#!/bin/bash

# Test Local Setup Script
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting Animation Production Tracker (Local Test)${NC}"

# Start the server in background
npm start &
SERVER_PID=$!

echo -e "${GREEN}📊 Server started with PID: $SERVER_PID${NC}"

# Wait for server to start
sleep 3

# Test server health
if curl -s http://localhost:3000/api/debug > /dev/null; then
    echo -e "${GREEN}✅ Server is running successfully${NC}"
    echo -e "${BLUE}🌐 Access the webapp at: http://localhost:3000${NC}"
else
    echo -e "${RED}❌ Server failed to start${NC}"
    kill $SERVER_PID
    exit 1
fi

# Start ngrok in background
echo -e "${BLUE}🔗 Starting ngrok tunnel...${NC}"
ngrok http 3000 --log=stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!

# Wait for ngrok to start
sleep 3

# Get ngrok public URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "import sys, json; print(json.load(sys.stdin)['tunnels'][0]['public_url'])" 2>/dev/null || echo "")

if [ -n "$NGROK_URL" ] && [ "$NGROK_URL" != "null" ]; then
    echo -e "${GREEN}✅ ngrok tunnel started: $NGROK_URL${NC}"
else
    echo -e "${BLUE}ℹ️  Getting ngrok URL...${NC}"
    sleep 2
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "import sys, json; print(json.load(sys.stdin)['tunnels'][0]['public_url'])" 2>/dev/null || echo "")
    if [ -n "$NGROK_URL" ] && [ "$NGROK_URL" != "null" ]; then
        echo -e "${GREEN}✅ ngrok tunnel started: $NGROK_URL${NC}"
    else
        echo -e "${BLUE}ℹ️  Check ngrok status at: http://localhost:4040${NC}"
    fi
fi

echo ""
echo "=================================================="
echo "🎯 Animation Production Tracker - Test Mode"
echo "=================================================="
echo ""
echo "📱 Local Server:    http://localhost:3000"
echo "🌐 Public URL:      $NGROK_URL"
echo "🔍 ngrok Inspector: http://localhost:4040"
echo ""
echo "Press Ctrl+C to stop all services"
echo "=================================================="

# Cleanup function
cleanup() {
    echo -e "${BLUE}🛑 Stopping services...${NC}"
    kill $SERVER_PID 2>/dev/null || true
    kill $NGROK_PID 2>/dev/null || true
    echo -e "${GREEN}✅ Cleanup completed${NC}"
    exit 0
}

# Set trap for cleanup
trap cleanup SIGINT SIGTERM

# Keep script running
while true; do
    sleep 1
done