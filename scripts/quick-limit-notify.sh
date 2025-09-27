#!/bin/bash

# Quick Limit Notifier
# Simple way to notify session retry system about Claude Code limits

echo " Claude Code Limit Notifier"
echo "=========================="

# Show recent Claude Code sessions
echo "Recent sessions:"
ls -t .devflow/sessions/*.json 2>/dev/null | head -3 | sed 's/.devflow\/sessions\///' | sed 's/\.json$//' || echo "No recent sessions found"

echo ""
echo "Enter reset time (e.g., '3am', '9:30pm') or full message:"
echo "Examples:"
echo "  ➤ 3am"
echo "  ➤ 9:30pm" 
echo "  ➤ 5-hour limit reached ∙ resets 3am"
echo ""
read -p "Reset time: " reset_time

if [ -z "$reset_time" ]; then
    echo "❌ No time entered"
    exit 1
fi

# Create standard limit message
if [[ "$reset_time" =~ (am|pm)$ ]]; then
    limit_message="5-hour limit reached ∙ resets $reset_time"
else
    limit_message="$reset_time"
fi

echo "🔔 Notifying system: $limit_message"
node src/core/session/notify-limit.js "$limit_message"

echo "✅ Done! System will resume automatically at the right time"