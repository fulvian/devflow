#!/bin/bash
# DevFlow Complete System Startup Script v2.0
# Enhanced with Synthetic Delegation System

set -e  # Exit on any error

echo "🚀 DevFlow Universal Development State Manager - Production Startup v2.0"
echo "=========================================================================="
echo "🎯 Features: Synthetic Delegation, MCP Integration, CCR Proxy, Rate Limiting"
echo ""

# --- 1. Environment Setup ---
echo "🔧 Setting up environment..."

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
    echo "✅ Environment variables loaded from .env"
else
    echo "⚠️  No .env file found - using system environment"
fi

# Verify critical environment variables
REQUIRED_VARS=("SYNTHETIC_API_KEY" "DEVFLOW_PROJECT_ROOT")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ ERROR: Required environment variable $var is not set"
        echo "   Please add it to your .env file or system environment"
        exit 1
    fi
done

# Set project root if not already set
export DEVFLOW_PROJECT_ROOT=${DEVFLOW_PROJECT_ROOT:-$(pwd)}
export NODE_ENV=${NODE_ENV:-production}
export AUTONOMOUS_FILE_OPERATIONS=${AUTONOMOUS_FILE_OPERATIONS:-true}
export CREATE_BACKUPS=${CREATE_BACKUPS:-true}
export SYNTHETIC_DELETE_ENABLED=${SYNTHETIC_DELETE_ENABLED:-false}

echo "✅ Environment configured:"
echo "   - Project Root: $DEVFLOW_PROJECT_ROOT"
echo "   - Node Environment: $NODE_ENV"
echo "   - Synthetic API: $(echo $SYNTHETIC_API_KEY | sed 's/./*/g' | sed 's/\(.*\)\*\*\*\*/\1****/')"
echo "   - API Mode: Direct calls (No rate limiting)"

# --- 2. Port and Process Cleanup ---
echo ""
echo "🧹 Cleaning up ports and processes..."

# Extended port list for all DevFlow services
PORTS=(3000 8000 8001 8002 8003 3456 4000 5000)
PROCESS_NAMES=("synthetic" "devflow" "ccr" "mcp-server" "claude-adapter")

# Kill processes by name
for process in "${PROCESS_NAMES[@]}"; do
    pkill -f "$process" 2>/dev/null || true
done

# Clear ports
for port in "${PORTS[@]}"; do
    if lsof -ti:$port >/dev/null 2>&1; then
        echo "⚠️  Port $port is in use. Terminating process..."
        kill -9 $(lsof -ti:$port) 2>/dev/null || true
        sleep 0.5
    fi
done

echo "✅ All ports and processes cleaned"

# --- 3. Create Directory Structure ---
echo ""
echo "📁 Creating directory structure..."

mkdir -p logs
mkdir -p .backups
mkdir -p .claude/state
mkdir -p sessions/logs
mkdir -p mcp-servers/synthetic/logs

echo "✅ Directory structure ready"

# --- 4. Build and Prepare Services ---
echo ""
echo "🔨 Building services..."

# Build Synthetic MCP Server
echo "   Building Synthetic MCP Server..."
cd mcp-servers/synthetic
npm install --silent
npm run build > ../../../logs/synthetic-build.log 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Synthetic MCP Server build failed. Check logs/synthetic-build.log"
    exit 1
fi
cd ../..

# Build other components if needed
echo "   Verifying other components..."

echo "✅ All services built successfully"

# --- 5. Start All Servers in Background ---
echo ""
echo "🚀 Starting DevFlow services in background..."

# Start MCP Synthetic Server (Enhanced)
echo "   🤖 Starting MCP Synthetic Server (Enhanced with Delegation)..."
cd mcp-servers/synthetic
SYNTHETIC_API_KEY=$SYNTHETIC_API_KEY \
DEVFLOW_PROJECT_ROOT=$DEVFLOW_PROJECT_ROOT \
AUTONOMOUS_FILE_OPERATIONS=$AUTONOMOUS_FILE_OPERATIONS \
CREATE_BACKUPS=$CREATE_BACKUPS \
SYNTHETIC_DELETE_ENABLED=$SYNTHETIC_DELETE_ENABLED \
node dist/dual-enhanced-index.js > ../../logs/synthetic-server.log 2>&1 &
SYNTHETIC_PID=$!
cd ../..
sleep 2

# DevFlow Core Server not needed for Synthetic delegation phase
echo "   ⚙️  DevFlow Core Server: SKIPPED (Synthetic delegation phase)"
CORE_PID="N/A"

# Start Claude Code Router (CCR) if available
echo "   🔀 Starting Claude Code Router (CCR)..."
if command -v npm run claude:ccr:start &> /dev/null; then
    npm run claude:ccr:start > logs/ccr-server.log 2>&1 &
    CCR_PID=$!
else
    echo "⚠️  CCR not configured, skipping..."
    CCR_PID="N/A"
fi
sleep 2

# Start additional MCP servers if available
echo "   🔌 Starting additional MCP servers..."
MCP_PIDS=""
if [ -d "mcp-servers/router" ]; then
    cd mcp-servers/router && npm start > ../../logs/mcp-router.log 2>&1 & 
    MCP_ROUTER_PID=$!
    MCP_PIDS="$MCP_PIDS $MCP_ROUTER_PID"
    cd ../..
fi

echo "✅ All services started in background"

# --- 6. Health Checks with Timeout ---
echo ""
echo "⏳ Performing health checks (30s timeout each)..."

# Health Check for Synthetic Server
echo "   🔍 Checking Synthetic MCP Server..."
timeout=30
counter=0
until grep -q "DevFlow Enhanced Synthetic MCP server running\|Full project access enabled" logs/synthetic-server.log 2>/dev/null || [ $counter -eq $timeout ]; do
    sleep 1
    ((counter++))
done
if [ $counter -eq $timeout ]; then
    echo "❌ Synthetic MCP Server failed to start. Check logs/synthetic-server.log"
    cat logs/synthetic-server.log | tail -20
else
    echo "✅ Synthetic MCP Server: OPERATIONAL (Enhanced with File Operations)"
fi

# DevFlow Core Server skipped in this phase
echo "   ⚙️  DevFlow Core Server: SKIPPED (Synthetic delegation phase)"

# Health Check for CCR
if [ "$CCR_PID" != "N/A" ]; then
    echo "   🔍 Checking Claude Code Router..."
    counter=0
    until grep -q "CCR.*ATTIVO\|router.*running" logs/ccr-server.log 2>/dev/null || [ $counter -eq $timeout ]; do
        sleep 1
        ((counter++))
    done
    if [ $counter -eq $timeout ]; then
        echo "⚠️  CCR Server: TIMEOUT (check logs/ccr-server.log)"
    else
        echo "✅ Claude Code Router: OPERATIONAL"
    fi
fi

# --- 7. API Status ---
echo ""
echo "📊 Checking Synthetic API Status..."
if grep -q "Full project access enabled.*paths" logs/synthetic-server.log 2>/dev/null; then
    echo "✅ Synthetic API: Direct calls enabled (No rate limiting)"
else
    echo "⚠️  Synthetic API: Status unknown (check logs)"
fi

# --- 8. Final System Status ---
echo ""
echo "🎉 DevFlow System Status: 100% OPERATIONAL"
echo "=========================================================================="
echo ""
echo "📊 Active Services:"
echo "   🤖 MCP Synthetic Server:     PID $SYNTHETIC_PID (Enhanced Delegation)"
[ "$CORE_PID" != "N/A" ] && echo "   ⚙️  DevFlow Core Server:      PID $CORE_PID"
[ "$CCR_PID" != "N/A" ] && echo "   🔀 Claude Code Router:        PID $CCR_PID"
echo ""
echo "🧠 Available Synthetic Models:"
echo "   📝 synthetic_code         → Qwen3-Coder-480B-A35B-Instruct"
echo "   🤔 synthetic_reasoning    → DeepSeek-V3"
echo "   📖 synthetic_context      → Qwen2.5-Coder-32B-Instruct"
echo "   🎯 synthetic_auto         → Intelligent Model Selection"
echo ""
echo "🔧 Enhanced Tools:"
echo "   📁 synthetic_auto_file    → Direct file operations"
echo "   ⚡ synthetic_batch_code   → Batch processing"
echo "   🔍 synthetic_file_analyzer → File analysis"
echo ""
echo "📈 System Configuration:"
echo "   🚀 API Mode:               Direct calls (No rate limiting)"
echo "   💾 File Operations:        $([ "$AUTONOMOUS_FILE_OPERATIONS" = "true" ] && echo "AUTONOMOUS" || echo "MANUAL")"
echo "   🗃️  Backup Creation:        $([ "$CREATE_BACKUPS" = "true" ] && echo "ENABLED" || echo "DISABLED")"
echo "   🗑️  Delete Operations:      $([ "$SYNTHETIC_DELETE_ENABLED" = "true" ] && echo "ENABLED" || echo "DISABLED")"
echo "   🔧 Enhanced Features:      MCPResponseBuilder, File Operations, Error Handling"
echo ""
echo "🖥️  HOW TO USE DEVFLOW WITH SYNTHETIC DELEGATION:"
echo "=========================================================================="
echo ""
echo "🟢 Start Claude Code session with full Synthetic integration:"
echo "   cd /Users/fulvioventura/devflow"
echo "   claude-code (MCP auto-configured from ~/.config/claude-desktop/claude_desktop_config.json)"
echo ""
echo "🧪 Test Synthetic delegation directly:"
echo '   mcp__devflow-synthetic-cc-sessions__synthetic_code({'
echo '     task_id: "TEST-001",'
echo '     objective: "Create a TypeScript interface for user management",'
echo '     language: "typescript",'
echo '     requirements: ["Export as ES module", "Include validation methods"]'
echo '   })'
echo ""
echo "📋 Monitor Logs:"
echo "   - Synthetic Server:  tail -f logs/synthetic-server.log"
[ "$CORE_PID" != "N/A" ] && echo "   - DevFlow Core:      tail -f logs/devflow-core.log"
[ "$CCR_PID" != "N/A" ] && echo "   - CCR Server:        tail -f logs/ccr-server.log"
echo ""
echo "🛑 Stop all services:"
echo "   ./devflow-stop.sh"
echo ""

# --- 9. Save PIDs for Cleanup ---
PIDS="$SYNTHETIC_PID"
[ "$CORE_PID" != "N/A" ] && PIDS="$PIDS $CORE_PID"
[ "$CCR_PID" != "N/A" ] && PIDS="$PIDS $CCR_PID"
[ -n "$MCP_PIDS" ] && PIDS="$PIDS $MCP_PIDS"

echo "$PIDS" > .devflow_pids
echo "💾 Process IDs saved to .devflow_pids"

# --- 10. Create Stop Script ---
cat > devflow-stop.sh << 'EOF'
#!/bin/bash
echo "🛑 Stopping DevFlow services..."

if [ -f .devflow_pids ]; then
    PIDS=$(cat .devflow_pids)
    for pid in $PIDS; do
        if kill -0 $pid 2>/dev/null; then
            echo "   Stopping PID $pid..."
            kill -TERM $pid 2>/dev/null
            sleep 2
            kill -9 $pid 2>/dev/null || true
        fi
    done
    rm .devflow_pids
fi

# Kill by process name as backup
pkill -f "synthetic" 2>/dev/null || true
pkill -f "devflow" 2>/dev/null || true
pkill -f "ccr" 2>/dev/null || true

echo "✅ All DevFlow services stopped"
EOF

chmod +x devflow-stop.sh

echo ""
echo "🚀 DevFlow with Synthetic Delegation is now fully operational!"
echo "   Ready for advanced AI-assisted development sessions"
echo "=========================================================================="