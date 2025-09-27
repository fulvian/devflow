#!/bin/bash

# Test script for smart session retry system

echo "🧪 Testing Smart Session Retry System"

# Start the session retry service
echo "🚀 Starting session retry service..."
node src/core/session/session-retry-service.js &

# Wait a bit for the service to start
sleep 3

# Send a test limit notification
echo "🔔 Sending test limit notification..."
node src/core/session/notify-limit.js "5-hour limit reached ∙ resets 3am"

echo "✅ Test completed. Check logs for results."