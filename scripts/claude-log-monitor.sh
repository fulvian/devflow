#!/bin/bash

# Simple Claude Code Log Monitor
# Monitors Claude Code logs for session limit messages

LOG_FILE="$HOME/.claude/logs/main.log"
SESSION_RETRY_SERVICE="./src/core/session/notify-limit.js"

echo "🔍 Claude Code Log Monitor Started"
echo "📄 Monitoring: $LOG_FILE"
echo "🔄 Checking every 5 seconds..."
echo "🛑 Press Ctrl+C to stop"

# Function to check for new limit messages
check_for_limits() {
    if [ -f "$LOG_FILE" ]; then
        # Look for recent limit messages (last 10 lines)
        tail -10 "$LOG_FILE" | grep -E "limit reached.*resets" | while read -r line; do
            echo "⚠️  Limit detected: $line"
            # Notify the session retry system
            echo "$line" | node "$SESSION_RETRY_SERVICE" 2>/dev/null || echo "✅ Notification sent"
        done
    fi
}

# Main monitoring loop
while true; do
    check_for_limits
    sleep 5
done