#!/bin/bash

# DevFlow MCP Orchestrator Server Startup Script
echo "🚀 Starting DevFlow MCP Orchestrator Server..."

# Check if Redis is running
redis-cli ping > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "⚠️  Redis not running. Starting Redis..."
    redis-server --daemonize yes --port 6379
    sleep 2
fi

# Navigate to orchestrator directory
cd mcp-servers/orchestrator

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing orchestrator dependencies..."
    npm install
fi

# Build TypeScript
echo "🔨 Building orchestrator..."
npm run build

# Set environment variables
export PORT=3001
export REDIS_URL=redis://localhost:6379

# Start the orchestrator server
echo "🎯 Launching MCP Orchestrator Server on port $PORT..."
npm start &

# Store PID
ORCHESTRATOR_PID=$!
echo $ORCHESTRATOR_PID > .orchestrator.pid

echo "✅ MCP Orchestrator Server started (PID: $ORCHESTRATOR_PID)"
echo "🌐 WebSocket endpoint: ws://localhost:$PORT"
echo "📊 Health check: http://localhost:$PORT/health"
echo ""
echo "🎭 Models available:"
echo "   • Sonnet  → Primary orchestrator (max 40 prompts/5h)"
echo "   • Codex   → Implementation manager"
echo "   • Gemini  → Context analyst"
echo ""
echo "📋 Usage:"
echo "   curl http://localhost:$PORT/health"
echo "   ./stop-orchestrator.sh  # to stop"