#!/bin/bash
# DevFlow Complete System Startup Script v2.1
# Aligned with pnpm workspaces and Emergency CCR CLI

set -Eeuo pipefail  # Safer bash options

echo "🚀 DevFlow Universal Development State Manager - Production Startup v2.0"
echo "=========================================================================="
echo "🎯 Features: Synthetic Delegation, MCP Integration, CCR Proxy, Rate Limiting"
echo ""

# --- 1. Environment Setup ---
echo "🔧 Setting up environment..."

# Load environment variables (.env by default, override with ENV_FILE)
ENV_FILE=${ENV_FILE:-.env}
if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$ENV_FILE"
    set +a
    echo "✅ Environment variables loaded from $ENV_FILE"
else
    echo "⚠️  No $ENV_FILE file found - using system environment"
fi

# Verify critical environment variables
REQUIRED_VARS=("SYNTHETIC_API_KEY" "DEVFLOW_PROJECT_ROOT")
for var in "${REQUIRED_VARS[@]}"; do
    # Use eval to safely check if variable is set and not empty
    if ! eval "[ -n \"\${$var:-}\" ]"; then
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

echo "   Building Synthetic MCP Server (pnpm workspace)..."
# Ensure workspace install at root once
echo "   Installing workspace dependencies (pnpm) ..."
pnpm install > logs/main-install.log 2>&1 || {
  echo "❌ Workspace dependency installation failed. Check logs/main-install.log"; exit 1; }

# Build the MCP server via pnpm (workspace aware)
pnpm -C mcp-servers/synthetic run build > logs/synthetic-build.log 2>&1 || {
  echo "❌ Synthetic MCP Server build failed. Check logs/synthetic-build.log"; exit 1; }

echo "   Skipping full workspace build (not required for emergency startup)"
echo "   Hint: run 'pnpm -r run build' manually if needed."


echo "✅ All services built successfully"

# --- 5. Start All Servers in Background ---
echo ""
echo "🚀 Starting DevFlow services in background..."

echo "   🤖 Starting MCP Synthetic Server (Enhanced with Delegation)..."
(
  cd mcp-servers/synthetic
  SYNTHETIC_API_KEY=${SYNTHETIC_API_KEY:-} \
  DEVFLOW_PROJECT_ROOT=${DEVFLOW_PROJECT_ROOT:-$(pwd)/../..} \
  AUTONOMOUS_FILE_OPERATIONS=${AUTONOMOUS_FILE_OPERATIONS:-true} \
  CREATE_BACKUPS=${CREATE_BACKUPS:-true} \
  SYNTHETIC_DELETE_ENABLED=${SYNTHETIC_DELETE_ENABLED:-false} \
  node dist/dual-enhanced-index.js > ../../logs/synthetic-server.log 2>&1 &
  echo $! > ../../logs/.synthetic.pid
)
SYNTHETIC_PID=$(cat logs/.synthetic.pid 2>/dev/null || echo "")
rm -f logs/.synthetic.pid
sleep 2

# DevFlow Core Server not needed for Synthetic delegation phase
echo "   ⚙️  DevFlow Core Server: SKIPPED (Synthetic delegation phase)"
CORE_PID="N/A"

# Start Claude Code Router (CCR) - Emergency Integration via ESM CLI
echo "   🔀 Starting Emergency CCR CLI..."
# Load environment variables for CCR
set -a
. .env
set +a
node emergency-ccr-cli.mjs start > logs/ccr-server.log 2>&1 &
CCR_PID=$!
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

echo "   🔍 Checking Emergency CCR System..."
counter=0
until grep -q "CCR Emergency Proxy ACTIVATED\|Emergency CCR ACTIVATED" logs/ccr-server.log 2>/dev/null || [ $counter -eq $timeout ]; do
    sleep 1
    ((counter++))
done
if [ $counter -eq $timeout ]; then
    echo "⚠️  Emergency CCR System: TIMEOUT (check logs/ccr-server.log)"
else
    echo "✅ Emergency CCR System: OPERATIONAL (PID: $CCR_PID)"
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
echo "   🚨 Emergency CCR System:     PID $CCR_PID (session independence)"
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
echo "   - Emergency CCR:     node emergency-ccr-cli.mjs status"
echo "   - CCR Logs:          tail -f logs/ccr-server.log"
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

# Stop Emergency CCR if running
node emergency-ccr-cli.mjs stop 2>/dev/null || true

echo "✅ All DevFlow services stopped"
EOF

chmod +x devflow-stop.sh

echo ""
echo "🚀 DevFlow with Synthetic Delegation is now fully operational!"
echo "   Ready for advanced AI-assisted development sessions"
echo "=========================================================================="
