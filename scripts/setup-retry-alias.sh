#!/bin/bash

# Setup script for retry-claude global alias

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🔧 Setting up retry-claude global alias..."

if [ -d "/usr/local/bin" ]; then
    if sudo ln -sf "$PROJECT_ROOT/scripts/quick-limit-notify.sh" /usr/local/bin/retry-claude; then
        echo "✅ Global alias 'retry-claude' created successfully!"
        echo "💡 You can now use 'retry-claude' from anywhere instead of the full path"
    else
        echo "❌ Failed to create global alias"
        echo "💡 You can still use the full path: $PROJECT_ROOT/scripts/quick-limit-notify.sh"
    fi
else
    echo "❌ /usr/local/bin directory not found"
    echo "💡 You can still use the full path: $PROJECT_ROOT/scripts/quick-limit-notify.sh"
fi