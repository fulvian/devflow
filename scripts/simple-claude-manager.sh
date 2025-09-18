#!/bin/bash

# Simple Claude Code Session Manager
# Automatically detects limits and schedules resume

echo "🚀 Claude Code Session Manager"
echo "============================="
echo "👉 Use this script instead of 'claude' command"
echo "👉 It will automatically detect session limits"
echo "👉 And resume work at the right time"
echo ""

# Check if session retry service is running
if ! pgrep -f "session-retry-service" > /dev/null; then
    echo "🔄 Starting session retry service..."
    nohup node src/core/session/session-retry-service.js > logs/session-retry.log 2>&1 &
    sleep 2
fi

echo "✅ Session retry service running"
echo ""
echo " Claude Code starting..."
echo "========================"
echo ""

# Run Claude Code normally
claude

echo ""
echo " Claude Code session ended"
echo "=========================="

# Check if there was a limit message in the recent output
# (This would require saving the session output to a temp file)