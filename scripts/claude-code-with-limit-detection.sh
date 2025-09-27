#!/bin/bash

# Wrapper for Claude Code that detects session limits and notifies the retry system

# Start the session retry service if not already running
if ! pgrep -f "session-retry-service" > /dev/null; then
    echo "🔄 Starting session retry service..."
    nohup node "$(dirname "$0")/../src/core/session/session-retry-service.js" > logs/session-retry.log 2>&1 &
    sleep 3
fi

# Simple approach: just run Claude normally for interactive mode
if [ $# -eq 0 ]; then
    echo "🚀 Starting Claude Code with limit detection system active..."
    echo "📝 The system will automatically detect session limits in the background."
    echo "🛑 Press Ctrl+C to exit Claude Code."
    echo ""
    
    # For interactive mode, just run Claude directly
    # The limit detection will work through log monitoring
    claude
else
    # For command mode, we can safely use pipes
    claude "$@" 2>&1 | node "$(dirname "$0")/../.claude/hooks/session-limit-detector.js"
fi