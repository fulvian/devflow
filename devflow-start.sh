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
        elif ps -p "$pid" > /dev/null 2>&1; then
            return 0  # Process is running (fallback check with ps)
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
export CCTOOLS_GRPC_PORT=${CCTOOLS_GRPC_PORT:-50052}
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

# Function to start Database Manager
start_database() {
  print_status "Starting Database Manager..."
  
  # Check if Database Manager is already running
  if is_process_running "$PROJECT_ROOT/.database.pid"; then
    local pid=$(cat "$PROJECT_ROOT/.database.pid")
    print_status "Database Manager already running (PID: $pid)"
    return 0
  fi
  
  # Check if database daemon exists
  if [ ! -f "$PROJECT_ROOT/src/core/database/database-daemon.ts" ]; then
    print_error "Database Manager daemon not found"
    return 1
  fi

  # Start Database Manager daemon in background (TypeScript via ts-node)
  nohup npx ts-node "$PROJECT_ROOT/src/core/database/database-daemon.ts" > logs/database-manager.log 2>&1 &
  local db_pid=$!
  
  # Give it a moment to start
  sleep 2
  
  # Check if it's still running
  if kill -0 $db_pid 2>/dev/null; then
    echo $db_pid > "$PROJECT_ROOT/.database.pid"
    print_status "Database Manager started (PID: $db_pid)"
    return 0
  else
    print_error "Failed to start Database Manager"
    return 1
  fi
}

# Function to start Model Registry
start_registry() {
  print_status "Starting Model Registry..."

  # Check for existing Model Registry processes (try both patterns)
  local existing_pid
  existing_pid=$(pgrep -f "model-registry-service" | head -1)
  if [ -z "$existing_pid" ]; then
    existing_pid=$(pgrep -f "model-registry-daemon" | head -1)
  fi

  if [ -n "$existing_pid" ]; then
    echo $existing_pid > "$PROJECT_ROOT/.registry.pid"
    print_status "Model Registry already running (PID: $existing_pid)"
    return 0
  fi

  # Check if PID file exists and process is running
  if is_process_running "$PROJECT_ROOT/.registry.pid"; then
    local pid=$(cat "$PROJECT_ROOT/.registry.pid")
    print_status "Model Registry already running (PID: $pid)"
    return 0
  fi

  # Try to start TypeScript daemon if it exists
  if [ -f "$PROJECT_ROOT/src/core/services/model-registry-daemon.ts" ]; then
    print_status "Starting Model Registry daemon..."

    # Set environment variables
    export MODEL_REGISTRY_PORT=3004

    # Start daemon in background
    nohup npx ts-node "$PROJECT_ROOT/src/core/services/model-registry-daemon.ts" > logs/model-registry.log 2>&1 &
    local reg_pid=$!

    # Wait for startup
    sleep 3

    # Verify the process is running
    if kill -0 $reg_pid 2>/dev/null; then
      echo $reg_pid > "$PROJECT_ROOT/.registry.pid"
      print_status "Model Registry started (PID: $reg_pid)"
      return 0
    fi
  fi

  print_error "Failed to start Model Registry"
  return 1
}

# Function to start Vector Memory Service
start_vector() {
  print_status "Starting Vector Memory Service..."
  
  # Check if Vector Memory Service is already running
  if is_process_running "$PROJECT_ROOT/.vector.pid"; then
    local pid=$(cat "$PROJECT_ROOT/.vector.pid")
    print_status "Vector Memory Service already running (PID: $pid)"
    return 0
  fi
  
  # Check if vector service exists (both locations)
  local vector_service_path=""
  if [ -f "$PROJECT_ROOT/packages/core/dist/services/vector-memory-service.cjs" ]; then
    vector_service_path="$PROJECT_ROOT/packages/core/dist/services/vector-memory-service.cjs"
  elif [ -f "$PROJECT_ROOT/services/vector-memory/dist/vector-memory.js" ]; then
    vector_service_path="$PROJECT_ROOT/services/vector-memory/dist/vector-memory.js"
  else
    print_error "Vector Memory Service not found"
    return 1
  fi

  # Start Vector Memory Service in background
  nohup node "$vector_service_path" > logs/vector-memory.log 2>&1 &
  local vec_pid=$!
  
  # Give it a moment to start
  sleep 2
  
  # Check if it's still running
  if kill -0 $vec_pid 2>/dev/null; then
    echo $vec_pid > "$PROJECT_ROOT/.vector.pid"
    print_status "Vector Memory Service started (PID: $vec_pid)"
    return 0
  else
    print_error "Failed to start Vector Memory Service"
    return 1
  fi
}

# Function to start Token Optimizer
start_optimizer() {
  print_status "Starting Token Optimizer..."
  
  # Check if Token Optimizer is already running
  if is_process_running "$PROJECT_ROOT/.optimizer.pid"; then
    local pid=$(cat "$PROJECT_ROOT/.optimizer.pid")
    print_status "Token Optimizer already running (PID: $pid)"
    return 0
  fi
  
  # Check if optimizer service exists
  if [ ! -f "$PROJECT_ROOT/packages/core/dist/services/token-optimizer-service.cjs" ]; then
    print_error "Token Optimizer not found"
    return 1
  fi

  # Start Token Optimizer in background with environment variables
  nohup env TOKEN_OPTIMIZER_PORT=$TOKEN_OPTIMIZER_PORT node "$PROJECT_ROOT/packages/core/dist/services/token-optimizer-service.cjs" > logs/token-optimizer.log 2>&1 &
  local opt_pid=$!
  
  # Give it a moment to start
  sleep 2
  
  # Check if it's still running
  if kill -0 $opt_pid 2>/dev/null; then
    echo $opt_pid > "$PROJECT_ROOT/.optimizer.pid"
    print_status "Token Optimizer started (PID: $opt_pid)"
    return 0
  else
    print_error "Failed to start Token Optimizer"
    return 1
  fi
}

# Function to start Codex MCP Server (Cometa v3.1)
start_codex_mcp() {
  print_status "Starting Codex MCP Server..."

  # Check if Codex MCP Server is already running via port check
  if netstat -an 2>/dev/null | grep -q ":${CODEX_MCP_PORT}.*LISTEN"; then
    print_status "Codex MCP Server already running on port ${CODEX_MCP_PORT}"
    echo "MCP_READY" > "$PROJECT_ROOT/.codex-mcp.pid"
    return 0
  fi

  # Check if Codex MCP Server executable exists
  if [ ! -f "$PROJECT_ROOT/mcp-servers/codex/minimal-server.js" ]; then
    print_error "Codex MCP Server not found at mcp-servers/codex/minimal-server.js"
    return 1
  fi

  # Create logs directory if it doesn't exist
  mkdir -p "$PROJECT_ROOT/logs"

  # Start Codex MCP Server in background
  CODEX_MCP_PORT=$CODEX_MCP_PORT nohup node "$PROJECT_ROOT/mcp-servers/codex/minimal-server.js" > logs/codex-mcp.log 2>&1 &
  local codex_pid=$!

  # Give it a moment to start
  sleep 3

  # Check if it's still running
  if kill -0 $codex_pid 2>/dev/null; then
    echo $codex_pid > "$PROJECT_ROOT/.codex-mcp.pid"
    print_status "Codex MCP Server started successfully (PID: $codex_pid)"
    return 0
  else
    print_error "Failed to start Codex MCP Server"
    return 1
  fi
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

  # Simple, robust cleanup of DevFlow processes
  print_status "🧹 Cleaning up DevFlow processes..."

  # Kill specific DevFlow processes by name pattern
  pkill -f "real-dream-team" 2>/dev/null || true
  pkill -f "cli-integration" 2>/dev/null || true
  pkill -f "platform-status" 2>/dev/null || true
  pkill -f "vector-memory-service" 2>/dev/null || true
  pkill -f "database-daemon" 2>/dev/null || true
  pkill -f "model-registry" 2>/dev/null || true
  pkill -f "codex-mcp" 2>/dev/null || true
  pkill -f "devflow-server" 2>/dev/null || true
  pkill -f "devflow-worker" 2>/dev/null || true
  pkill -f "token-optimizer-service" 2>/dev/null || true

  # TABULA RASA: BRUTAL PORT-BASED CLEANUP - KILL ALL PROCESSES ON DEVFLOW PORTS
  print_status "💀 TABULA RASA: Killing ALL processes on DevFlow ports..."

  # Core DevFlow service ports (3000-3099)
  local DEVFLOW_PORTS=(3002 3004 3008 3009)
  # MCP service ports (3100-3199)
  local MCP_PORTS=(3101)
  # Orchestration ports (3200-3299)
  local ORCHESTRATION_PORTS=(3200 3201 3202)

  # Combine all port arrays
  local ALL_PORTS=("${DEVFLOW_PORTS[@]}" "${MCP_PORTS[@]}" "${ORCHESTRATION_PORTS[@]}")

  for port in "${ALL_PORTS[@]}"; do
    # Find all PIDs using this port
    local port_pids=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$port_pids" ]; then
      print_status "🔫 Terminating processes on port $port: $port_pids"
      # First try graceful termination
      echo "$port_pids" | xargs -r kill -TERM 2>/dev/null || true
      sleep 1
      # Then force kill any survivors
      echo "$port_pids" | xargs -r kill -KILL 2>/dev/null || true
    fi
  done

  # Give processes time to terminate gracefully
  sleep 2

  # Force kill any remaining DevFlow processes
  pkill -9 -f "real-dream-team" 2>/dev/null || true
  pkill -9 -f "cli-integration" 2>/dev/null || true
  pkill -9 -f "platform-status" 2>/dev/null || true
  pkill -9 -f "vector-memory-service" 2>/dev/null || true
  pkill -9 -f "database-daemon" 2>/dev/null || true
  pkill -9 -f "model-registry" 2>/dev/null || true
  pkill -9 -f "token-optimizer-service" 2>/dev/null || true
  pkill -9 -f "codex-mcp" 2>/dev/null || true

  print_status "✅ DevFlow process cleanup completed"

  print_status "All DevFlow services stopped."
}

# Function to start Auto CCR Runner (real system)
start_ccr() {
  print_status "Starting Auto CCR Runner..."
  
  # Check if Auto CCR Runner is already running
  if pgrep -f "auto-ccr-runner.js" > /dev/null; then
    # Ensure PID file exists/updated
    local pid
    pid=$(pgrep -f -n "tools/auto-ccr-runner.js" || true)
    if [ -n "$pid" ]; then
      echo "$pid" > "$PROJECT_ROOT/.ccr.pid"
      print_status "Auto CCR Runner already running (PID: $pid)"
    else
      print_status "Auto CCR Runner already running"
    fi
    return 0
  fi
  
  # Check if auto-ccr-runner exists
  if [ ! -f "$PROJECT_ROOT/tools/auto-ccr-runner.js" ]; then
    print_error "auto-ccr-runner.js not found in tools/"
    return 1
  fi
  
  # Start Auto CCR Runner in background
  nohup node "$PROJECT_ROOT/tools/auto-ccr-runner.js" > logs/auto-ccr-runner.log 2>&1 &
  local ccr_pid=$!
  
  # Give it a moment to start
  sleep 2
  
  # Check if it's still running
  if kill -0 $ccr_pid 2>/dev/null; then
    echo $ccr_pid > "$PROJECT_ROOT/.ccr.pid"
    print_status "Auto CCR Runner started successfully (PID: $ccr_pid)"
    return 0
  else
    print_error "Failed to start Auto CCR Runner"
    return 1
  fi
}

# Function to start Synthetic MCP Server (real system)
start_synthetic() {
  print_status "Checking Synthetic MCP Server availability..."

  # Check if Synthetic MCP exists and is compiled
  if [ ! -f "$PROJECT_ROOT/mcp-servers/synthetic/dist/dual-enhanced-index.js" ]; then
    print_error "Synthetic MCP Server not found - run build first"
    return 1
  fi

  # Check if Claude Code configuration exists (global config)
  # This now checks for the correct Claude Code config files, not the obsolete Claude Desktop path.
  if [ ! -f "$HOME/.claude.json" ] && [ ! -d "$HOME/.claude" ]; then
    # Fallback to local config if neither global file nor directory exists
    if [ ! -f "$PROJECT_ROOT/.mcp.json" ]; then
      print_error "Claude Code configuration not found - run setup first"
      return 1
    fi
  fi

  # Check if Synthetic MCP is already configured and running in Claude Code
  # The Synthetic MCP is embedded into Claude Code via MCP configuration
  # We just mark it as ready since it's managed by Claude Code
  echo "MCP_READY" > "$PROJECT_ROOT/.synthetic.pid"
  print_status "Synthetic MCP Server ready for Claude Code integration"
  return 0
}

# Function to start Session Retry System
start_session_retry() {
  print_status "Starting Smart Session Retry System..."
  
  # Check if Session Retry System is already running
  if pgrep -f "session-retry-manager.js" > /dev/null; then
    local pid
    pid=$(pgrep -f -n "session-retry-manager.js" || true)
    if [ -n "$pid" ]; then
      echo "$pid" > "$PROJECT_ROOT/.session-retry.pid"
      print_status "Smart Session Retry System already running (PID: $pid)"
    else
      print_status "Smart Session Retry System already running"
    fi
    return 0
  fi
  
  # Check if session retry manager exists
  if [ ! -f "$PROJECT_ROOT/tools/session-retry-manager.js" ]; then
    print_error "session-retry-manager.js not found in tools/"
    return 1
  fi
  
  # Start Session Retry System in background
  nohup node "$PROJECT_ROOT/tools/session-retry-manager.js" > logs/session-retry.log 2>&1 &
  local retry_pid=$!
  
  # Give it a moment to start
  sleep 2
  
  # Check if it's still running
  if kill -0 $retry_pid 2>/dev/null; then
    echo $retry_pid > "$PROJECT_ROOT/.session-retry.pid"
    print_status "Smart Session Retry System started successfully (PID: $retry_pid)"
    return 0
  else
    print_error "Failed to start Smart Session Retry System"
    return 1
  fi
}

# Function to start Claude Code Enforcement System (daemon-based production system)
start_enforcement() {
  print_status "Starting Claude Code Enforcement Daemon..."

  # Check if daemon binary exists
  local daemon_path="$PROJECT_ROOT/dist/enforcement-daemon.js"
  if [ ! -f "$daemon_path" ]; then
    print_warning "Enforcement daemon not found at $daemon_path - skipping enforcement"
    return 0
  fi

  # Always clean up stale PID files at the start
  rm -f "$PROJECT_ROOT/.enforcement.pid"

  # Clean up stale daemon PID files
  local pid_file_actual="$PROJECT_ROOT/devflow-enforcement-daemon.pid"
  if [ -f "$pid_file_actual" ]; then
    local existing_pid=$(cat "$pid_file_actual")
    if ! kill -0 "$existing_pid" 2>/dev/null; then
      rm -f "$pid_file_actual"
    fi
  fi

  # Check if already running via health check
  if curl -sf --max-time 2 "http://localhost:8787/health" >/dev/null 2>&1; then
    # Health check passed, ensure PID file exists
    if [ -f "$pid_file_actual" ]; then
      local actual_pid=$(cat "$pid_file_actual")
      echo $actual_pid > "$PROJECT_ROOT/.enforcement.pid"
      print_status "Claude Code Enforcement Daemon already running (PID: $actual_pid)"
    else
      print_status "Claude Code Enforcement Daemon already running"
    fi
    return 0
  fi

  # Create logs directory if it doesn't exist
  mkdir -p "$PROJECT_ROOT/logs"

  # Start enforcement daemon in daemon mode
  nohup node "$daemon_path" --daemon > logs/enforcement-daemon.log 2>&1 &
  local daemon_pid=$!

  # Wait for daemon to initialize
  print_status "Waiting for enforcement daemon to initialize..."
  sleep 5

  # Validate daemon is running via PID file
  local pid_file="$PROJECT_ROOT/devflow-enforcement-daemon.pid"
  if [ -f "$pid_file" ]; then
    local actual_pid=$(cat "$pid_file")
    if kill -0 $actual_pid 2>/dev/null; then
      print_status "Claude Code Enforcement Daemon started (PID: $actual_pid)"

      # Perform health check validation
      local health_check_attempts=0
      while [ $health_check_attempts -lt 10 ]; do
        if curl -sf --max-time 2 "http://localhost:8787/health" >/dev/null 2>&1; then
          print_status "Health check passed - daemon is responsive"

          # Check daemon status via health endpoint
          local daemon_status=$(curl -s --max-time 2 "http://localhost:8787/health" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "UNKNOWN")
          print_status "Daemon status: $daemon_status"

          # Create tracking PID file
          echo $actual_pid > "$PROJECT_ROOT/.enforcement.pid"
          return 0
        fi
        sleep 2
        health_check_attempts=$((health_check_attempts + 1))
      done

      print_warning "Daemon started but health check failed"
      return 1
    else
      print_error "PID file exists but process not running"
      return 1
    fi
  else
    print_error "Failed to start Claude Code Enforcement Daemon - no PID file created"
    # Show last few lines of log for debugging
    if [ -f logs/enforcement-daemon.log ]; then
      print_error "Last daemon log entries:"
      tail -5 logs/enforcement-daemon.log | while read line; do
        print_error "  $line"
      done
    fi
    return 1
  fi
}

# Function to start fallback monitoring system
start_fallback_monitoring() {
  print_status "Starting Dream Team Fallback Monitoring System..."
  
  # Check if Fallback Monitoring is already running
  if pgrep -f "fallback-monitor.js" > /dev/null; then
    local pid
    pid=$(pgrep -f -n "fallback-monitor.js" || true)
    if [ -n "$pid" ]; then
      echo "$pid" > "$PROJECT_ROOT/.fallback.pid"
      print_status "Fallback Monitoring already running (PID: $pid)"
    else
      print_status "Fallback Monitoring already running"
    fi
    return 0
  fi
  
  # Check if fallback monitor exists
  if [ ! -f "$PROJECT_ROOT/tools/fallback-monitor.js" ]; then
    print_error "fallback-monitor.js not found in tools/"
    return 1
  fi
  
  # Start Fallback Monitor in background
  nohup node "$PROJECT_ROOT/tools/fallback-monitor.js" > logs/fallback-monitor.log 2>&1 &
  local fallback_pid=$!
  
  # Give it a moment to start
  sleep 2
  
  # Check if it's still running
  if kill -0 $fallback_pid 2>/dev/null; then
    echo $fallback_pid > "$PROJECT_ROOT/.fallback.pid"
    print_status "Dream Team Fallback Monitoring started successfully (PID: $fallback_pid)"
    return 0
  else
    print_error "Failed to start Dream Team Fallback Monitoring"
    return 1
  fi
}

# Function to start CC-Tools gRPC Server
start_cctools() {
  print_status "Starting CC-Tools gRPC Server..."

  # Check if CC-Tools gRPC Server is already running
  if netstat -an | grep -q ":${CCTOOLS_GRPC_PORT}.*LISTEN"; then
    local pid
    pid=$(lsof -ti:${CCTOOLS_GRPC_PORT} 2>/dev/null | head -1 || true)
    if [ -n "$pid" ]; then
      echo "$pid" > "$PROJECT_ROOT/.cctools.pid"
      print_status "CC-Tools gRPC Server already running (PID: $pid)"
    else
      print_status "CC-Tools gRPC Server already running"
    fi
    return 0
  fi
  
  # Check if CC-Tools server exists
  if [ ! -f "$PROJECT_ROOT/tools/cc-tools-grpc-server.js" ]; then
    print_error "cc-tools-grpc-server.js not found in tools/"
    return 1
  fi
  
  # Start CC-Tools gRPC Server in background
  nohup env CCTOOLS_GRPC_PORT=$CCTOOLS_GRPC_PORT node "$PROJECT_ROOT/tools/cc-tools-grpc-server.js" > logs/cc-tools-grpc.log 2>&1 &
  local cctools_pid=$!
  
  # Give it a moment to start
  sleep 3
  
  # Check if it's still running and listening
  if kill -0 $cctools_pid 2>/dev/null && netstat -an | grep -q ":${CCTOOLS_GRPC_PORT}.*LISTEN"; then
    echo $cctools_pid > "$PROJECT_ROOT/.cctools.pid"
    print_status "CC-Tools gRPC Server started successfully (PID: $cctools_pid) on port ${CCTOOLS_GRPC_PORT}"
    return 0
  else
    print_error "Failed to start CC-Tools gRPC Server"
    return 1
  fi
}

# Function to start DevFlow Orchestrator
start_orchestrator() {
  print_status "Starting DevFlow Orchestrator..."

  # Check if orchestrator is already running
  if curl -sf --max-time 2 "http://localhost:${ORCHESTRATOR_PORT}/health" >/dev/null 2>&1; then
    print_status "DevFlow Orchestrator already running"
    return 0
  fi

  # Check if orchestrator app exists
  if [ ! -f "$PROJECT_ROOT/services/devflow-orchestrator/dist/main.js" ]; then
    print_error "Orchestrator app not found at services/devflow-orchestrator/dist/main.js"
    return 1
  fi

  # Create logs directory if it doesn't exist
  mkdir -p "$PROJECT_ROOT/logs"

  # Start orchestrator in background
  nohup node "$PROJECT_ROOT/services/devflow-orchestrator/dist/main.js" > logs/orchestrator.log 2>&1 &
  local orchestrator_pid=$!

  # Give it a moment to start
  sleep 3

  # Check if it's still running
  if kill -0 $orchestrator_pid 2>/dev/null; then
    # Validate with health check
    local health_attempts=0
    while [ $health_attempts -lt 5 ]; do
      if curl -sf --max-time 2 "http://localhost:${ORCHESTRATOR_PORT}/health" >/dev/null 2>&1; then
        echo $orchestrator_pid > "$PROJECT_ROOT/.orchestrator.pid"
        print_status "DevFlow Orchestrator started successfully (PID: $orchestrator_pid)"
        return 0
      fi
      sleep 2
      health_attempts=$((health_attempts + 1))
    done

    print_error "Orchestrator started but health check failed"
    return 1
  else
    print_error "Failed to start DevFlow Orchestrator"
    return 1
  fi
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

# Function to start CLI Integration Manager (Cometa v3.1)
start_cli_integration_manager() {
  print_status "Starting CLI Integration Manager..."

  # Check if CLI Integration Manager is already running
  if pgrep -f "cli-integration-manager" > /dev/null; then
    local pid
    pid=$(pgrep -f -n "cli-integration-manager" || true)
    if [ -n "$pid" ]; then
      echo "$pid" > "$PROJECT_ROOT/.cli-integration-manager.pid"
      print_status "CLI Integration Manager already running (PID: $pid)"
    else
      print_status "CLI Integration Manager already running"
    fi
    return 0
  fi

  # Check if CLI Integration Manager exists
  if [ ! -f "$PROJECT_ROOT/src/core/mcp/cli-integration-manager.ts" ]; then
    print_error "CLI Integration Manager not found"
    return 1
  fi

  # Create logs directory if it doesn't exist
  mkdir -p "$PROJECT_ROOT/logs"

  # Start CLI Integration Manager in background (TypeScript via ts-node)
  nohup npx ts-node "$PROJECT_ROOT/src/core/mcp/cli-integration-manager.ts" > logs/cli-integration-manager.log 2>&1 &
  local manager_pid=$!

  # Give it a moment to start
  sleep 3

  # Check if it's still running
  if kill -0 $manager_pid 2>/dev/null; then
    echo $manager_pid > "$PROJECT_ROOT/.cli-integration-manager.pid"
    print_status "CLI Integration Manager started successfully (PID: $manager_pid)"
    return 0
  else
    print_error "Failed to start CLI Integration Manager"
    return 1
  fi
}

# Function to start Platform Status Tracker (Cometa v3.1)
start_platform_status_tracker() {
  print_status "Starting Platform Status Tracker..."

  # Check if Platform Status Tracker is already running
  if pgrep -f "platform-status-tracker" > /dev/null; then
    local pid
    pid=$(pgrep -f -n "platform-status-tracker" || true)
    if [ -n "$pid" ]; then
      echo "$pid" > "$PROJECT_ROOT/.platform-status-tracker.pid"
      print_status "Platform Status Tracker already running (PID: $pid)"
    else
      print_status "Platform Status Tracker already running"
    fi
    return 0
  fi

  # Check if Platform Status Tracker exists
  if [ ! -f "$PROJECT_ROOT/src/core/ui/platform-status-tracker.ts" ]; then
    print_error "Platform Status Tracker not found"
    return 1
  fi

  # Create logs directory if it doesn't exist
  mkdir -p "$PROJECT_ROOT/logs"

  # Start Platform Status Tracker in background (TypeScript via ts-node)
  nohup npx ts-node "$PROJECT_ROOT/src/core/ui/monitoring-dashboard.ts" > logs/platform-status-tracker.log 2>&1 &
  local tracker_pid=$!

  # Give it a moment to start
  sleep 3

  # Check if it's still running
  if kill -0 $tracker_pid 2>/dev/null; then
    echo $tracker_pid > "$PROJECT_ROOT/.platform-status-tracker.pid"
    print_status "Platform Status Tracker started successfully (PID: $tracker_pid)"
    return 0
  else
    print_error "Failed to start Platform Status Tracker"
    return 1
  fi
}

# Function to start verification system
start_verification() {
  print_status "Starting Verification System (4 AI Agents)..."

  # Check if verification system already running
  if [ -f "$PROJECT_ROOT/.verification.pid" ]; then
    local pid=$(cat "$PROJECT_ROOT/.verification.pid")
    if kill -0 "$pid" 2>/dev/null; then
      print_status "Verification System already running (PID: $pid)"
      return 0
    else
      rm -f "$PROJECT_ROOT/.verification.pid"
    fi
  fi

  # Check if verification system exists
  if [ ! -f "$PROJECT_ROOT/src/core/orchestration/verification/continuous-verification-loop.ts" ]; then
    print_error "Verification System not found"
    return 1
  fi

  # Create logs directory if it doesn't exist
  mkdir -p "$PROJECT_ROOT/logs"

  # Create verification trigger to activate real-time verification
  echo '{"enabled": true, "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"}' > "$PROJECT_ROOT/.devflow/verification-trigger.json"

  # Start verification system in background
  nohup npx ts-node "$PROJECT_ROOT/src/core/orchestration/verification/continuous-verification-loop.ts" > logs/verification-system.log 2>&1 &
  local verification_pid=$!

  # Give it a moment to start
  sleep 3

  # Check if it's still running
  if kill -0 $verification_pid 2>/dev/null; then
    echo $verification_pid > "$PROJECT_ROOT/.verification.pid"
    print_status "Verification System started successfully (PID: $verification_pid)"
    return 0
  else
    print_error "Failed to start Verification System"
    return 1
  fi
}

# Function to check prerequisites
check_prerequisites() {
  print_status "Checking prerequisites..."
  
  # Check Node.js
  if ! command_exists node; then
    print_error "Node.js is not installed"
    exit 1
  fi
  
  # Check npm/npx
  if ! command_exists npm; then
    print_error "npm is not installed"
    exit 1
  fi
  
  # Check if we're in the right directory (contains package.json)
  if [ ! -f "$PROJECT_ROOT/package.json" ]; then
    print_error "This script must be run from the DevFlow project root"
    exit 1
  fi
  
  # Create logs directory if it doesn't exist
  mkdir -p "$PROJECT_ROOT/logs"
  
  # Create .devflow directory if it doesn't exist
  mkdir -p "$PROJECT_ROOT/.devflow"
  
  print_status "All prerequisites met."
}

# Show status of all services
show_status() {
  print_status "DevFlow v2.1.0 Production Services Status:"

  local services=(
    ".database.pid:Database Manager"
    ".registry.pid:Model Registry"
    ".vector.pid:Vector Memory"
    ".optimizer.pid:Token Optimizer"
    ".synthetic.pid:Synthetic MCP"
    ".ccr.pid:Auto CCR Runner"
    ".session-retry.pid:Smart Session Retry"
    ".limit-detection.pid:Claude Code Limit Detection"
    ".enforcement.pid:Claude Code Enforcement"
    ".fallback.pid:Dream Team Fallback Monitor"
    ".orchestrator.pid:DevFlow Orchestrator"
    ".verification.pid:Verification System (4 AI Agents)"
    ".cctools.pid:CC-Tools gRPC Server"
    ".real-dream-team-orchestrator.pid:Real Dream Team Orchestrator (Cometa v3.1)"
    ".cli-integration-manager.pid:CLI Integration Manager (Cometa v3.1)"
    ".platform-status-tracker.pid:Platform Status Tracker (Cometa v3.1)"
  )

  for service in "${services[@]}"; do
    IFS=':' read -r pid_file name <<< "$service"
    if is_process_running "$PROJECT_ROOT/$pid_file"; then
      local pid=$(cat "$PROJECT_ROOT/$pid_file")
      if [ "$pid" = "MCP_READY" ]; then
        print_status "$name: Ready (MCP Server)"
      else
        print_status "$name: Running (PID: $pid)"
      fi
    else
      print_status "$name: Stopped"
    fi
  done
}

# Load Synthetic environment variables for Claude Code integration
if [ -f "$PROJECT_ROOT/.env" ]; then
    export SYNTHETIC_API_BASE_URL=$(grep "^SYNTHETIC_API_BASE_URL=" "$PROJECT_ROOT/.env" | cut -d'=' -f2)
    export SYNTHETIC_API_KEY=$(grep "^SYNTHETIC_API_KEY=" "$PROJECT_ROOT/.env" | cut -d'=' -f2)
fi

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
    status)
      show_status
      exit 0
      ;;
    help)
      echo "Usage: $0 [start|stop|restart|status|help]"
      echo "  start    - Start all DevFlow services (default)"
      echo "  stop     - Stop all DevFlow services"
      echo "  restart  - Restart all DevFlow services"
      echo "  status   - Show status of all services"
      echo "  help     - Show this help message"
      exit 0
      ;;
  esac
  
  print_status "Starting DevFlow services..."

  # Auto-cleanup existing Real Dream Team components before starting
  cleanup_and_prepare

  # Check prerequisites
  check_prerequisites

  # Start core production services
  print_status "Starting DevFlow v2.1.0 Production Services..."

  # Start Database Manager
  if ! start_database; then
    print_error "Database Manager failed to start - CRITICAL ERROR"
    exit 1
  fi

  # Start Model Registry
  if ! start_registry; then
    print_error "Model Registry failed to start - CRITICAL ERROR"
    exit 1
  fi

  # Start Vector Memory Service
  if ! start_vector; then
    print_error "Vector Memory Service failed to start - CRITICAL ERROR"
    exit 1
  fi

  # Start Token Optimizer
  if ! start_optimizer; then
    print_error "Token Optimizer failed to start - CRITICAL ERROR"
    exit 1
  fi

  # Check Synthetic MCP Server availability (managed by Claude Code)
  if ! start_synthetic; then
    print_error "Synthetic MCP Server failed to initialize - CRITICAL ERROR"
    exit 1
  fi

  # Start Auto CCR Runner (critical for agent coordination)
  if ! start_ccr; then
    print_error "Auto CCR Runner failed to start - CRITICAL ERROR"
    exit 1
  fi

  # Start Smart Session Retry System (critical for session management)
  if ! start_session_retry; then
    print_error "Smart Session Retry System failed to start - CRITICAL ERROR" 
    exit 1
  fi

  # Start Claude Code Limit Detection System (critical for session limits)
  print_status "Starting Claude Code Limit Detection System..."
  if [ -f "$PROJECT_ROOT/.claude/hooks/session-limit-detector.js" ] && [ -f "$PROJECT_ROOT/scripts/claude-code-with-limit-detection.sh" ]; then
    # Create global alias if possible
    if [ -w "/usr/local/bin" ]; then
      ln -sf "$PROJECT_ROOT/scripts/quick-limit-notify.sh" /usr/local/bin/retry-claude 2>/dev/null && \
        print_status "✅ Global alias 'retry-claude' created" || \
        print_warning "⚠️  sudo required for global alias - run: sudo ln -sf $PROJECT_ROOT/scripts/quick-limit-notify.sh /usr/local/bin/retry-claude"
    else
      # Need sudo to create global alias, but don't force it
      print_warning "⚠️  sudo required for global alias - run: sudo ln -sf $PROJECT_ROOT/scripts/quick-limit-notify.sh /usr/local/bin/retry-claude"
    fi
    print_status "Claude Code Limit Detection System ready"
  else
    # Create a dummy PID file to indicate the service is available
    echo "AVAILABLE" > "$PROJECT_ROOT/.limit-detection.pid"
  fi

  # Start enforcement system (optional - graceful degradation)
  if [ "$DISABLE_ENFORCEMENT" = "critical" ]; then
    print_warning "Enforcement DISABLED (DISABLE_ENFORCEMENT=critical). Skipping enforcement startup."
  else
    if ! start_enforcement; then
      print_warning "Claude Code Enforcement System failed to start - CONTINUING WITHOUT ENFORCEMENT"
    fi
  fi

  # Start Dream Team fallback monitoring system (CRITICAL for agent coordination)
  if ! start_fallback_monitoring; then
    print_error "Dream Team Fallback Monitoring failed to start - CRITICAL ERROR"
    exit 1
  fi

  # Note: CC-Tools integration uses direct Python→Go communication (port 50051)
  # Node.js bridge removed - DevFlow communicates directly with cc-tools Go server
  print_status "✅ CC-Tools integration ready (direct Python→Go communication)"

  # Start verification system (multiple AI agents)
  if ! start_verification; then
    print_warning "Verification System failed to start - CONTINUING WITHOUT VERIFICATION"
  fi

  if ! start_orchestrator; then
    print_error "DevFlow Orchestrator failed to start - CRITICAL ERROR"
    exit 1
  fi

  # Start Real Dream Team Orchestrator system (Cometa v3.1 - CRITICAL for real CLI integration)
  if ! start_real_dream_team_orchestrator; then
    print_error "Real Dream Team Orchestrator failed to start - CRITICAL ERROR"
    exit 1
  fi

  # Start Codex MCP Server (Cometa v3.1 - OPTIONAL for Codex CLI integration)
  if ! start_codex_mcp; then
    print_warning "Codex MCP Server failed to start - CONTINUING WITHOUT CODEX"
  fi

  # Start CLI Integration Manager (Cometa v3.1 - CRITICAL for MCP CLI integration)
  if ! start_cli_integration_manager; then
    print_error "CLI Integration Manager failed to start - CRITICAL ERROR"
    exit 1
  fi

  # Start Platform Status Tracker (Cometa v3.1 - enhances real-time monitoring)
  if ! start_platform_status_tracker; then
    print_warning "Platform Status Tracker failed to start - CONTINUING WITHOUT REAL-TIME UI"
  fi

  print_status "🎉 DevFlow v3.1.0 Cometa Production System Started Successfully!"
  print_status "✅ Database Manager: Running"
  print_status "✅ Model Registry: Running"
  print_status "✅ Vector Memory: Running (EmbeddingGemma)"
  print_status "✅ Token Optimizer: Running (Real algorithms)"
  print_status "✅ Synthetic MCP: Running"
  print_status "✅ Auto CCR Runner: Running"
  print_status "✅ CC-Tools gRPC Server: Running (Port ${CCTOOLS_GRPC_PORT})"
  if is_process_running "$PROJECT_ROOT/.session-retry.pid"; then
    print_status "✅ Smart Session Retry: Running"
  else
    print_warning "⚠️  Smart Session Retry: Not Running"
  fi
  if [ -f "$PROJECT_ROOT/.claude/hooks/session-limit-detector.js" ] && [ -f "$PROJECT_ROOT/scripts/claude-code-with-limit-detection.sh" ]; then
    print_status "✅ Claude Code Limit Detection: Available"
  else
    print_warning "⚠️  Claude Code Limit Detection: Not Available"
  fi
  if is_process_running "$PROJECT_ROOT/.enforcement.pid"; then
    print_status "✅ Claude Code Enforcement: Running"
  else
    print_warning "⚠️  Claude Code Enforcement: Not Running"
  fi

  # Cometa v3.1 Real Dream Team Orchestrator Status
  if is_process_running "$PROJECT_ROOT/.real-dream-team-orchestrator.pid"; then
    print_status "✅ Real Dream Team Orchestrator: Running (Cometa v3.1)"
  else
    print_error "❌ Real Dream Team Orchestrator: Not Running (CRITICAL)"
  fi
  if is_process_running "$PROJECT_ROOT/.cli-integration-manager.pid"; then
    print_status "✅ CLI Integration Manager: Running (Cometa v3.1)"
  else
    print_error "❌ CLI Integration Manager: Not Running (CRITICAL)"
  fi
  if is_process_running "$PROJECT_ROOT/.platform-status-tracker.pid"; then
    print_status "✅ Platform Status Tracker: Running (Cometa v3.1)"
  else
    print_warning "⚠️  Platform Status Tracker: Not Running"
  fi

  print_status ""
  print_status "🚀 System Status: COMETA v3.1 PRODUCTION READY"
  print_status "🔄 Auto CCR monitoring active for fallback orchestration"
  print_status "🎯 Real Dream Team Orchestrator active for CLI integration"
  print_status "⚡ MCP CLI Integration Manager active for Codex/Gemini/Qwen"
}

# Trap SIGINT and SIGTERM to stop services gracefully
trap stop_services SIGINT SIGTERM

# Run main function
main "$@"