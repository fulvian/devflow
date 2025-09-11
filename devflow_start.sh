#!/bin/bash
# DevFlow Complete System Startup Script

echo "🚀 DevFlow Universal Development State Manager - Production Startup"
echo "=================================================================="

# --- 1. Port and Process Cleanup ---
echo "🔍 Checking and clearing required ports (3000, 8000, 8001, 3456)..."
for port in 3000 8000 8001 3456; do
  if lsof -ti:$port >/dev/null 2>&1; then
    echo "⚠️  Port $port is in use. Terminating the process..."
    kill -9 $(lsof -ti:$port) 2>/dev/null || true
    sleep 1
  fi
done
echo "✅ All required ports are available."

# --- 2. Create Logs Directory ---
mkdir -p logs

# --- 3. Start All Servers in Background ---
echo ""
echo "🚀 Starting all DevFlow services in background..."

# Start MCP Server Synthetic
cd mcp-servers/synthetic
npm start > ../../logs/synthetic-server.log 2>&1 &
SYNTHETIC_PID=$!
cd ../..
echo "  - Started MCP Synthetic Server (PID: $SYNTHETIC_PID)"

# Start DevFlow Core Server
node start-devflow.mjs > logs/devflow-core.log 2>&1 &
CORE_PID=$!
echo "  - Started DevFlow Core Server (PID: $CORE_PID)"

# Start Claude Code Router (CCR) Server
npm run claude:ccr:start > logs/ccr-server.log 2>&1 &
CCR_PID=$!
echo "  - Started Claude Code Router (CCR) Server (PID: $CCR_PID)"

# --- 4. Health Checks ---
echo ""
echo "⏳ Waiting for all services to initialize..."

# Health Check for MCP Synthetic Server
until grep -q "DevFlow Synthetic MCP server running" logs/synthetic-server.log
do
  sleep 1
done
echo "✅ MCP Synthetic Server is running."

# Health Check for DevFlow Core Server
until grep -q "DevFlow is ready for Claude Code sessions!" logs/devflow-core.log
do
  sleep 1
done
echo "✅ DevFlow Core Server is running."

# Health Check for CCR Server
until grep -q "CCR ATTIVO" logs/ccr-server.log
do
  sleep 1
done
echo "✅ Claude Code Router (CCR) is running."

# --- 5. Final Status ---
echo ""
echo "🎉 DevFlow System Status: 100% OPERATIONAL"
echo "=================================================================="
echo "📊 Active Services:"
echo "  - MCP Synthetic Server: PID $SYNTHETIC_PID"
echo "  - DevFlow Core Server:  PID $CORE_PID"
echo "  - CCR Server:           PID $CCR_PID"
echo ""
echo "📝 Available MCP Tools:"
echo "  - synthetic_code (Qwen3-Coder-480B)"
echo "  - synthetic_reasoning (DeepSeek-V3)"
echo "  - synthetic_context (Qwen2.5-Coder-32B)"
echo "  - synthetic_auto (Intelligent Selection)"
echo "  - devflow_search, devflow_handoff, devflow_analytics"
echo ""
echo "🖥️  HOW TO START CLAUDE CODE SESSIONS:"
echo "=================================================================="
echo ""
echo "🟢 Start a new session using the CCR proxy:"
echo "   npm run claude:coder"
echo ""
echo "   (The CCR server is already running in the background)"
echo ""
echo "📋 Logs:"
echo "  - MCP Synthetic: tail -f logs/synthetic-server.log"
echo "  - DevFlow Core:  tail -f logs/devflow-core.log"
echo "  - CCR Server:    tail -f logs/ccr-server.log"
echo ""
echo "🛑 To stop all servers, run: ./devflow_stop.sh"

# --- 6. Save PIDs for Cleanup ---
echo "$SYNTHETIC_PID $CORE_PID $CCR_PID" > .devflow_pids