#!/bin/bash

# DevFlow v3.1.0 Cometa Production Startup Script
# Comprehensive system with Real Dream Team Orchestrator, CLI Integration Manager, and Platform Status Tracker

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# Color codes for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
print_status() {
    echo -e "${GREEN}[STATUS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if process is running using PID file
is_process_running() {
    local pid_file="$1"
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if [ "$pid" = "MCP_READY" ] || [ "$pid" = "AVAILABLE" ]; then
            return 0  # Consider these as running
        elif kill -0 "$pid" 2>/dev/null; then
            return 0  # Process is running
        else
            rm -f "$pid_file"  # Clean up stale PID file
            return 1  # Process not running
        fi
    else
        return 1  # PID file doesn't exist
    fi
}

# Load environment variables from .env if it exists
if [ -f .env ]; then
  # Use a more secure method that handles spaces and special characters
  while IFS='=' read -r key value || [ -n "$key" ]; do
    # Skip empty lines and comments
    [[ -z "$key" || "$key" =~ ^#.*$ ]] && continue
    
    # Remove leading/trailing whitespace and quotes
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | xargs | sed 's/^["'\'']//' | sed 's/["'\'']$//')
    
    # Only export if the key is valid (alphanumeric + underscore)
    if [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      export "$key=$value"
    fi
  done < .env
  print_status "Loaded environment variables from .env"
else
  print_warning ".env file not found - using defaults"
fi

# Set default values for core services
export DB_MANAGER_PORT=${DB_MANAGER_PORT:-3002}
export VECTOR_MEMORY_PORT=${VECTOR_MEMORY_PORT:-3003}
export MODEL_REGISTRY_PORT=${MODEL_REGISTRY_PORT:-3004}
export ORCHESTRATOR_PORT=${ORCHESTRATOR_PORT:-3005}
export TOKEN_OPTIMIZER_PORT=${TOKEN_OPTIMIZER_PORT:-3006}
export REAL_DREAM_TEAM_ORCHESTRATOR_PORT=${REAL_DREAM_TEAM_ORCHESTRATOR_PORT:-3200}
export CLI_INTEGRATION_MANAGER_PORT=${CLI_INTEGRATION_MANAGER_PORT:-3201}
export PLATFORM_STATUS_TRACKER_PORT=${PLATFORM_STATUS_TRACKER_PORT:-3202}
export DASHBOARD_PORT=${DASHBOARD_PORT:-3202}
export WS_PORT=${WS_PORT:-3203}
export CCTOOLS_GRPC_PORT=${CCTOOLS_GRPC_PORT:-50051}
export CODEX_MCP_PORT=${CODEX_MCP_PORT:-3101}

# Function to clean up stale processes and prepare for startup
cleanup_and_prepare() {
    print_status "🚀 DevFlow v3.1.0 Auto-Cleanup: Preparing for clean start..."
    
    # Cleanup Real Dream Team Orchestrator processes
    print_status "🧹 Auto-cleanup: Checking Real Dream Team Orchestrator..."
    local real_dream_pids=$(pgrep -f "real-dream-team" 2>/dev/null || true)
    if [ -n "$real_dream_pids" ]; then
        print_warning "Stopping existing Real Dream Team processes..."
        echo "$real_dream_pids" | xargs -r kill -TERM 2>/dev/null || true
        sleep 2
        echo "$real_dream_pids" | xargs -r kill -KILL 2>/dev/null || true
    fi
    
    # Cleanup Codex MCP processes  
    print_status "🧹 Auto-cleanup: Checking Codex MCP Server..."
    if netstat -an 2>/dev/null | grep -q ":${CODEX_MCP_PORT}.*LISTEN"; then
        print_warning "Port ${CODEX_MCP_PORT} is occupied - stopping existing Codex MCP"
        local codex_pids=$(lsof -ti:${CODEX_MCP_PORT} 2>/dev/null || true)
        if [ -n "$codex_pids" ]; then
            echo "$codex_pids" | xargs -r kill -TERM 2>/dev/null || true
            sleep 2
            echo "$codex_pids" | xargs -r kill -KILL 2>/dev/null || true
            print_status "Stopped existing Codex MCP (PID: $codex_pids)"
        fi
    fi
    
    # Cleanup CLI Integration Manager processes
    print_status "🧹 Auto-cleanup: Checking CLI Integration Manager..."
    local cli_pids=$(pgrep -f "cli-integration-manager" 2>/dev/null || true)
    if [ -n "$cli_pids" ]; then
        print_warning "Stopping existing CLI Integration processes..."
        echo "$cli_pids" | xargs -r kill -TERM 2>/dev/null || true
        sleep 2
        echo "$cli_pids" | xargs -r kill -KILL 2>/dev/null || true
    fi
    
    print_status "✅ Auto-cleanup completed - ready for clean service start"
}

# Function to stop services with robust cleanup
stop_services() {
  print_status "Stopping DevFlow v2.1.0 services..."

  # Remove global alias if it exists
  if [ -f "/usr/local/bin/retry-claude" ]; then
    if [ -w "/usr/local/bin" ]; then
      rm -f /usr/local/bin/retry-claude 2>/dev/null && \
        print_status "✅ Global alias 'retry-claude' removed" || \
        print_status "ℹ️  Global alias 'retry-claude' not removed"
    else
      # Need sudo to remove, but don't force it
      print_status "ℹ️  Global alias 'retry-claude' may require manual removal (sudo)"
    fi
  fi

  # First pass: Stop services using PID files (traditional method)
  local services=(".enforcement.pid" ".ccr.pid" ".synthetic.pid" ".database.pid" ".vector.pid" ".optimizer.pid" ".registry.pid" ".orchestrator.pid" ".session-retry.pid" ".limit-detection.pid" ".fallback.pid" ".cctools.pid" ".real-dream-team-orchestrator.pid" ".cli-integration-manager.pid" ".platform-status-tracker.pid")

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

  # Second pass: Use robust cleanup for orphan processes
  if [ -f "$PROJECT_ROOT/scripts/robust-process-cleanup.sh" ]; then
    print_status "🧹 Running robust cleanup for orphan processes..."
    bash "$PROJECT_ROOT/scripts/robust-process-cleanup.sh" --verbose 2>/dev/null || true
  else
    print_warning "Robust cleanup script not found - using basic cleanup"
    # Basic orphan cleanup
    pkill -f "devflow\|real-dream-team\|cli-integration-manager\|platform-status-tracker\|codex-mcp" 2>/dev/null || true
  fi

  print_status "All DevFlow services stopped."
}

# Function to start Real Dream Team Orchestrator (Cometa v3.1)
start_real_dream_team_orchestrator() {
  print_status "Starting Real Dream Team Orchestrator..."

  # Check if Real Dream Team Orchestrator is already running
  if pgrep -f "real-dream-team-orchestrator" > /dev/null; then
    local pid
    pid=$(pgrep -f -n "real-dream-team-orchestrator" || true)
    if [ -n "$pid" ]; then
      echo "$pid" > "$PROJECT_ROOT/.real-dream-team-orchestrator.pid"
      print_status "Real Dream Team Orchestrator already running (PID: $pid)"
    else
      print_status "Real Dream Team Orchestrator already running"
    fi
    return 0
  fi

  # Check if Real Dream Team Orchestrator exists
  if [ ! -f "$PROJECT_ROOT/src/core/orchestration/real-dream-team-orchestrator.ts" ]; then
    print_error "Real Dream Team Orchestrator not found"
    return 1
  fi

  # Create logs directory if it doesn't exist
  mkdir -p "$PROJECT_ROOT/logs"

  # Start Real Dream Team Orchestrator in background (TypeScript via ts-node)
  nohup npx ts-node "$PROJECT_ROOT/src/core/orchestration/real-dream-team-daemon.ts" > logs/real-dream-team-orchestrator.log 2>&1 &
  local orchestrator_pid=$!

  # Give it a moment to start
  sleep 5

  # Check if it's still running
  if kill -0 $orchestrator_pid 2>/dev/null; then
    echo $orchestrator_pid > "$PROJECT_ROOT/.real-dream-team-orchestrator.pid"
    print_status "Real Dream Team Orchestrator started successfully (PID: $orchestrator_pid)"
    return 0
  else
    print_error "Failed to start Real Dream Team Orchestrator"
    return 1
  fi
}

# Main execution
main() {
  # Handle script arguments
  case "$1" in
    stop)
      stop_services
      exit 0
      ;;
    restart)
      stop_services
      # Continue to start services
      ;;
    test-cleanup)
      cleanup_and_prepare
      exit 0
      ;;
    help)
      echo "Usage: $0 [start|stop|restart|test-cleanup|help]"
      echo "  start        - Start all DevFlow services (default)"
      echo "  stop         - Stop all DevFlow services"
      echo "  restart      - Restart all DevFlow services"
      echo "  test-cleanup - Test the cleanup system only"
      echo "  help         - Show this help message"
      exit 0
      ;;
  esac
  
  print_status "Starting DevFlow services..."

  # Auto-cleanup existing Real Dream Team components before starting
  cleanup_and_prepare

  # Test just the Real Dream Team Orchestrator for now
  if ! start_real_dream_team_orchestrator; then
    print_error "Real Dream Team Orchestrator failed to start - CRITICAL ERROR"
    exit 1
  fi

  print_status "🎉 DevFlow Real Dream Team Orchestrator Test Completed!"
  if is_process_running "$PROJECT_ROOT/.real-dream-team-orchestrator.pid"; then
    print_status "✅ Real Dream Team Orchestrator: Running (Cometa v3.1)"
  else
    print_error "❌ Real Dream Team Orchestrator: Not Running (CRITICAL)"
  fi
}

# Run main function
main "$@"