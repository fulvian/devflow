#!/bin/bash

# Complete test for smart session retry system

echo "🧪 Complete Test for Smart Session Retry System"
echo "==============================================="

# Create test directories if they don't exist
mkdir -p .devflow/sessions logs

# Start the session retry service in background
echo "🚀 Starting session retry service..."
node src/core/session/session-retry-service.js > logs/session-retry-test.log 2>&1 &
SERVICE_PID=$!

# Wait for service to start
sleep 5

# Check if service is running
if kill -0 $SERVICE_PID 2>/dev/null; then
    echo "✅ Session retry service is running (PID: $SERVICE_PID)"
else
    echo "❌ Session retry service failed to start"
    cat logs/session-retry-test.log
    exit 1
fi

# Test the limit notification
echo "🔔 Testing limit notification..."
node src/core/session/notify-limit.js "5-hour limit reached ∙ resets 3am"

# Wait a moment for processing
sleep 2

# Check the logs
echo "📋 Checking logs..."
tail -10 logs/session-retry-test.log

# Stop the service
echo "🛑 Stopping session retry service..."
kill $SERVICE_PID

echo "✅ Test completed!"