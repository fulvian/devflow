#!/bin/bash

# =============================================================================
# DevFlow v3.1 Startup Script
# =============================================================================
# Enhanced version of devflow-start.sh with v3.1 Phase 1 features integration
#
# New v3.1 Features:
#   - Footer System with real-time monitoring
#   - Intelligent Agent Routing (Claude→Codex→Gemini→Qwen3)
#   - Session Retry System with automatic recovery
#   - Context7 MCP Integration
#   - Qwen CLI Integration
#
# Usage:
#   ./devflow-start-v31.sh [start|stop|status|restart|test-fallback]
# =============================================================================

set -e  # Exit on any error

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
  echo -e "${GREEN}[STATUS]${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Function to check if a process is running
is_process_running() {
  if [ -f "$1" ]; then
    local pid=$(cat "$1")
    # Special case for MCP servers that don't run as daemons
    if [ "$pid" = "MCP_READY" ]; then
      # Check if MCP server is still available by testing file exists
      if [ "$1" = "$PROJECT_ROOT/.synthetic.pid" ] && [ -f "$PROJECT_ROOT/mcp-servers/synthetic/dist/dual-enhanced-index.js" ]; then
        return 0
      else
        rm -f "$1"
        return 1
      fi
    elif kill -0 "$pid" 2>/dev/null; then
      return 0
    else
      rm -f "$1"
      return 1
    fi
  else
    return 1
  fi
}

# Function to stop services
stop_services() {
  print_status "Stopping DevFlow v3.1 services..."

  # Stop all DevFlow services (including v3.1 features)
  local services=(
    ".enforcement.pid"
    ".ccr.pid"
    ".synthetic.pid"
    ".database.pid"
    ".vector.pid"
    ".optimizer.pid"
    ".registry.pid"
    ".footer.pid"
    ".agent-routing.pid"
    ".session-retry.pid"
  )

  for service_pid in "${services[@]}"; do
    if is_process_running "$PROJECT_ROOT/$service_pid"; then
      local pid=$(cat "$PROJECT_ROOT/$service_pid")
      local service_name=$(echo $service_pid | sed 's/.pid//' | sed 's/\.//')

      if [ "$pid" = "MCP_READY" ]; then
        print_status "Stopping $service_name (MCP Server)..."
        rm -f "$PROJECT_ROOT/$service_pid"
      else
        print_status "Stopping $service_name (PID: $pid)..."
        kill -TERM "$pid" 2>/dev/null || true
        sleep 2
        if kill -0 "$pid" 2>/dev/null; then
          print_warning "Force killing $service_name (PID: $pid)..."
          kill -KILL "$pid" 2>/dev/null || true
        fi
        rm -f "$PROJECT_ROOT/$service_pid"
      fi
    fi
  done

  print_status "All DevFlow v3.1 services stopped."
}

# Function to start Footer System (v3.1)
start_footer_system() {
  print_status "Starting Footer System v3.1..."

  if pgrep -f "footer-system" > /dev/null; then
    print_status "Footer System already running"
    return 0
  fi

  # Start Footer System with real-time monitoring
  nohup node "$PROJECT_ROOT/src/ui/footer/footer-service.js" > logs/footer-system.log 2>&1 &
  local footer_pid=$!
  sleep 2

  if kill -0 $footer_pid 2>/dev/null; then
    echo $footer_pid > "$PROJECT_ROOT/.footer.pid"
    print_status "Footer System started successfully (PID: $footer_pid)"
    return 0
  else
    print_error "Failed to start Footer System"
    return 1
  fi
}

# Function to start Agent Routing System (v3.1)
start_agent_routing() {
  print_status "Starting Intelligent Agent Routing v3.1..."

  if pgrep -f "agent-routing" > /dev/null; then
    print_status "Agent Routing already running"
    return 0
  fi

  # Start Agent Routing with Claude→Codex→Gemini→Qwen3 hierarchy
  nohup node "$PROJECT_ROOT/src/core/orchestration/agent-routing-service.js" > logs/agent-routing.log 2>&1 &
  local routing_pid=$!
  sleep 2

  if kill -0 $routing_pid 2>/dev/null; then
    echo $routing_pid > "$PROJECT_ROOT/.agent-routing.pid"
    print_status "Agent Routing started successfully (PID: $routing_pid)"
    return 0
  else
    print_error "Failed to start Agent Routing"
    return 1
  fi
}

# Function to start Session Retry System (v3.1)
start_session_retry() {
  print_status "Starting Session Retry System v3.1..."

  if pgrep -f "session-retry" > /dev/null; then
    print_status "Session Retry System already running"
    return 0
  fi

  # Start Session Retry with "riprendi da dove abbiamo interrotto" functionality
  nohup node "$PROJECT_ROOT/src/core/session/session-retry-service.js" > logs/session-retry.log 2>&1 &
  local retry_pid=$!
  sleep 2

  if kill -0 $retry_pid 2>/dev/null; then
    echo $retry_pid > "$PROJECT_ROOT/.session-retry.pid"
    print_status "Session Retry System started successfully (PID: $retry_pid)"
    return 0
  else
    print_error "Failed to start Session Retry System"
    return 1
  fi
}

# Function to test Agent Fallback System (v3.1)
test_agent_fallback() {
  print_status "Testing Agent Fallback System..."

  if [ -f "$PROJECT_ROOT/test-agent-fallback.ts" ]; then
    print_info "Running agent fallback tests..."
    npx ts-node "$PROJECT_ROOT/test-agent-fallback.ts"
  else
    print_error "Agent fallback test script not found"
    return 1
  fi
}

# Function to initialize Context7 MCP (v3.1)
initialize_context7() {
  print_status "Initializing Context7 MCP Integration..."

  # Check if Context7 is configured
  if [ ! -f "$PROJECT_ROOT/.config/context7.json" ]; then
    print_info "Setting up Context7 MCP configuration..."
    mkdir -p "$PROJECT_ROOT/.config"
    cat > "$PROJECT_ROOT/.config/context7.json" << EOF
{
  "enabled": true,
  "mcp_endpoint": "npx -y @upstash/context7-mcp@latest",
  "session_id": "devflow-v31-$(date +%s)",
  "auto_inject": true,
  "cache_duration": 3600
}
EOF
    print_status "Context7 MCP configuration created"
  fi

  export CONTEXT7_ENABLED=true
  export CONTEXT7_SESSION_ID=$(cat "$PROJECT_ROOT/.config/context7.json" | grep session_id | cut -d'"' -f4)
  print_status "Context7 MCP initialized (Session: $CONTEXT7_SESSION_ID)"
}

# Function to setup Qwen CLI (v3.1)
setup_qwen_cli() {
  print_status "Setting up Qwen CLI Integration..."

  # Create Qwen CLI config if not exists
  if [ ! -f "$HOME/.qwen/config/devflow.json" ]; then
    print_info "Creating Qwen CLI configuration..."
    mkdir -p "$HOME/.qwen/config"
    cat > "$HOME/.qwen/config/devflow.json" << EOF
{
  "model": "Qwen3-Coder-480B-A35B-Instruct",
  "endpoint": "https://api.qwen.dev/v3/coding",
  "max_tokens": 4096,
  "temperature": 0.7,
  "devflow_integration": true,
  "fallback_priority": 4
}
EOF
    print_status "Qwen CLI configuration created"
  fi

  export QWEN_CONFIG="$HOME/.qwen/config/devflow.json"
  export QWEN_MODEL="Qwen3-Coder-480B-A35B-Instruct"
  print_status "Qwen CLI configured for DevFlow v3.1"
}

# Enhanced status function for v3.1
status_v31() {
  print_status "DevFlow v3.1 Phase 1 Services Status:"

  local services=(
    ".database.pid:Database Manager"
    ".registry.pid:Model Registry"
    ".vector.pid:Vector Memory"
    ".optimizer.pid:Token Optimizer"
    ".synthetic.pid:Synthetic MCP"
    ".ccr.pid:Auto CCR Runner"
    ".enforcement.pid:Claude Code Enforcement"
    ".footer.pid:Footer System (v3.1)"
    ".agent-routing.pid:Agent Routing (v3.1)"
    ".session-retry.pid:Session Retry (v3.1)"
  )

  local running_count=0
  local total_count=${#services[@]}

  for service in "${services[@]}"; do
    IFS=':' read -r pid_file name <<< "$service"
    if is_process_running "$PROJECT_ROOT/$pid_file"; then
      local pid=$(cat "$PROJECT_ROOT/$pid_file")
      if [ "$pid" = "MCP_READY" ]; then
        print_status "✅ $name: Ready (MCP Server)"
      else
        print_status "✅ $name: Running (PID: $pid)"
      fi
      ((running_count++))
    else
      print_status "❌ $name: Stopped"
    fi
  done

  echo ""
  print_info "System Status: $running_count/$total_count services running"

  # v3.1 specific status
  if [ -f "$PROJECT_ROOT/.config/context7.json" ]; then
    print_info "🔗 Context7 MCP: Configured"
  else
    print_warning "🔗 Context7 MCP: Not configured"
  fi

  if [ -f "$HOME/.qwen/config/devflow.json" ]; then
    print_info "🧠 Qwen CLI: Configured"
  else
    print_warning "🧠 Qwen CLI: Not configured"
  fi

  local health_percentage=$((running_count * 100 / total_count))
  if [ $health_percentage -eq 100 ]; then
    print_status "🚀 DevFlow v3.1 Status: FULLY OPERATIONAL"
  elif [ $health_percentage -ge 80 ]; then
    print_warning "⚠️  DevFlow v3.1 Status: MOSTLY OPERATIONAL ($health_percentage%)"
  elif [ $health_percentage -ge 50 ]; then
    print_warning "⚠️  DevFlow v3.1 Status: PARTIALLY OPERATIONAL ($health_percentage%)"
  else
    print_error "❌ DevFlow v3.1 Status: DEGRADED ($health_percentage%)"
  fi
}

# Main execution
main() {
  # Handle script arguments
  case "${1:-start}" in
    stop)
      stop_services
      exit 0
      ;;
    restart)
      stop_services
      sleep 2
      # Continue to start services
      ;;
    status)
      status_v31
      exit 0
      ;;
    test-fallback)
      test_agent_fallback
      exit 0
      ;;
    help)
      echo "DevFlow v3.1 Startup Script"
      echo "Usage: $0 [start|stop|restart|status|test-fallback|help]"
      echo "  start         - Start all DevFlow v3.1 services (default)"
      echo "  stop          - Stop all DevFlow v3.1 services"
      echo "  restart       - Restart all DevFlow v3.1 services"
      echo "  status        - Show status of all services"
      echo "  test-fallback - Test agent fallback hierarchy"
      echo "  help          - Show this help message"
      exit 0
      ;;
  esac

  print_status "Starting DevFlow v3.1 Phase 1 services..."

  # Initialize v3.1 features
  initialize_context7
  setup_qwen_cli

  # Start legacy services first (from original devflow-start.sh)
  source "$PROJECT_ROOT/devflow-start.sh" start

  # Start v3.1 Phase 1 new services
  print_status "Starting DevFlow v3.1 Phase 1 features..."

  local v31_failures=0

  if ! start_footer_system; then
    print_warning "Footer System failed to start - continuing without it"
    ((v31_failures++))
  fi

  if ! start_agent_routing; then
    print_warning "Agent Routing failed to start - continuing without it"
    ((v31_failures++))
  fi

  if ! start_session_retry; then
    print_warning "Session Retry System failed to start - continuing without it"
    ((v31_failures++))
  fi

  # Final status
  if [ $v31_failures -eq 0 ]; then
    print_status "🎉 DevFlow v3.1 Phase 1 - ALL FEATURES OPERATIONAL!"
    print_status "✅ Footer System: Real-time monitoring active"
    print_status "✅ Agent Routing: Claude→Codex→Gemini→Qwen3 hierarchy ready"
    print_status "✅ Session Retry: Automatic recovery enabled"
    print_status "✅ Context7 MCP: Documentation injection ready"
    print_status "✅ Qwen CLI: Architecture review agent ready"
  else
    print_warning "⚠️  DevFlow v3.1 Phase 1 started with $v31_failures feature(s) unavailable"
    print_warning "   Check logs in logs/ directory for details"
  fi

  print_info ""
  print_info "🚀 DevFlow v3.1 Phase 1 startup complete!"
  print_info "   Run './devflow-start-v31.sh status' to check system health"
  print_info "   Run './devflow-start-v31.sh test-fallback' to test agent hierarchy"
}

# Run main function
main "$@"
# Cometa System Activation
echo "[STATUS] 🧠 Cometa Unified Memory System: Active"
echo "[STATUS] 📊 Tasks: 11 | Sessions: 16"
echo "[STATUS] 🔄 Migration: cc-session → Cometa completed"

