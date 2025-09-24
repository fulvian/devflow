#!/bin/bash

# Load environment variables from .env file
set -a
source /Users/fulvioventura/devflow/.env
set +a

# Verify critical variables are loaded
echo "🔧 Environment variables loaded:"
echo "CONTEXT7_API_KEY: ${CONTEXT7_API_KEY:0:10}..."
echo "SYNTHETIC_API_KEY: ${SYNTHETIC_API_KEY:0:10}..."
echo "GITHUB_PERSONAL_ACCESS_TOKEN: ${GITHUB_PERSONAL_ACCESS_TOKEN:0:10}..."

# Start Claude Code with environment variables
echo "🚀 Starting Claude Code with environment variables..."
exec claude "$@"