#!/bin/bash

# Test script for Smart Session Retry System

echo "🧪 Testing Smart Session Retry System Integration"
echo "================================================="

# Start DevFlow services
echo "🚀 Starting DevFlow services..."
./devflow-start.sh start

# Wait a moment for services to start
sleep 5

# Check if session retry service is running
if pgrep -f "session-retry-service" > /dev/null; then
    echo "✅ Session Retry Service is running"
else
    echo "❌ Session Retry Service is not running"
    exit 1
fi

# Check if limit detection is available
if [ -f ".claude/hooks/session-limit-detector.js" ] && [ -f "scripts/claude-code-with-limit-detection.sh" ]; then
    echo "✅ Limit Detection System is available"
else
    echo "❌ Limit Detection System is not available"
fi

# Test limit notification
echo "🔔 Testing limit notification..."
node src/core/session/notify-limit.js "5-hour limit reached ∙ resets 3am"

# Check logs
echo "📋 Checking recent logs..."
tail -5 logs/session-retry.log

echo "✅ Integration test completed!"
echo ""
echo "To use the system:"
echo "1. Run Claude Code with limit detection: ./scripts/claude-code-with-limit-detection.sh"
echo "2. Or manually notify limits: node src/core/session/notify-limit.js \"message\"