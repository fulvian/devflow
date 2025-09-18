#!/bin/bash

# Resume Claude Code session
# This script attempts to resume Claude Code using various methods

SESSION_NAME="$1"

if [ -z "$SESSION_NAME" ]; then
    echo "Usage: $0 <session_name>"
    echo "Example: $0 my-task"
    exit 1
fi

echo "🔄 Resuming Claude Code session: $SESSION_NAME"

# Method 1: Try direct Claude Code resume
if command -v claude-code &> /dev/null; then
    echo "🔧 Using claude-code resume command..."
    claude-code --resume "$SESSION_NAME" 2>&1
    exit $?
fi

# Method 2: Try cc-tools if available
if command -v cc-tools &> /dev/null; then
    echo "🔧 Using cc-tools resume command..."
    cc-tools resume "$SESSION_NAME" 2>&1
    exit $?
fi

# Method 3: Try devflow resume if available
if command -v devflow &> /dev/null; then
    echo "🔧 Using devflow resume command..."
    devflow resume "$SESSION_NAME" 2>&1
    exit $?
fi

# Method 4: Try to restart Claude Code with the session
echo "🔧 Attempting to restart Claude Code..."
claude-code --session "$SESSION_NAME" 2>&1

echo "❌ No resume method found or successful"
exit 1