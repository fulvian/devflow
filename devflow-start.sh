#!/bin/bash

# DevFlow Start Script v3.0.0 Production with Complete Orchestration
# This script starts all DevFlow services for complete production system
# INCLUDING: Multi-account monitoring, MCP delegation, cascade fallback
# NO MOCKS - NO STUBS - NO PLACEHOLDERS - REAL IMPLEMENTATION ONLY

set -e  # Exit on any error

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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
    # Special case for limit detection system (not a real process)
    elif [ "$pid" = "AVAILABLE" ]; then
      # Check if required files exist
      if [ -f "$PROJECT_ROOT/.claude/hooks/session-limit-detector.js" ] && [ -f "$PROJECT_ROOT/scripts/claude-code-with-limit-detection.sh" ]; then
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

  # Stop all DevFlow services (including enforcement, session retry, limit detection, fallback monitoring, and Real Dream Team Orchestrator)
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
      print_error "MCP configuration not found. Looked for Claude Code config (~/.claude.json or ~/.claude/) or local .mcp.json."
      return 1
    fi
  fi

  # Test that the server can load without errors and API key is properly configured
  cd "$PROJECT_ROOT/mcp-servers/synthetic"
  # Enhanced test that verifies both server load and API key configuration
  if SERVER_OUTPUT=$(SYNTHETIC_API_BASE_URL="$SYNTHETIC_API_BASE_URL" SYNTHETIC_API_KEY="$SYNTHETIC_API_KEY" node -e "
    try {
      console.log('Testing MCP server...');
      require('./dist/dual-enhanced-index.js');
      console.log('MCP server validation successful');
      process.exit(0);
    } catch(e) {
      console.error('Server load error:', e.message);
      process.exit(1);
    }
  " 2>&1) && echo "$SERVER_OUTPUT" | grep -q -- "- API Key: syn_" && ! echo "$SERVER_OUTPUT" | grep -q -- "NOT LOADED"; then
    cd "$PROJECT_ROOT"
    print_status "Synthetic MCP Server ready for Claude Code integration"
    # Create a dummy PID file for status checking
    echo "MCP_READY" > "$PROJECT_ROOT/.synthetic.pid"
    return 0
  else
    cd "$PROJECT_ROOT"
    print_error "Synthetic MCP Server failed validation"
    return 1
  fi
}

# Function to start Database Manager (real production system)
start_database() {
  print_status "Starting Database Manager..."

  if pgrep -f "database-manager" > /dev/null; then
    # Ensure PID file exists/updated
    local pid
    pid=$(pgrep -f -n "packages/core/dist/services/database-manager.cjs" || true)
    if [ -n "$pid" ]; then
      echo "$pid" > "$PROJECT_ROOT/.database.pid"
      print_status "Database Manager already running (PID: $pid)"
    else
      print_status "Database Manager already running"
    fi
    return 0
  fi

  # Start Database Manager (production service)
  nohup node "$PROJECT_ROOT/packages/core/dist/services/database-manager.cjs" > logs/database-manager.log 2>&1 &
  local db_pid=$!
  sleep 3

  if kill -0 $db_pid 2>/dev/null; then
    echo $db_pid > "$PROJECT_ROOT/.database.pid"
    print_status "Database Manager started (PID: $db_pid)"
    return 0
  else
    print_error "Failed to start Database Manager"
    return 1
  fi
}

# Function to start Vector Memory Service (real production system)
start_vector() {
  print_status "Starting Vector Memory Service..."

  if pgrep -f "vector-memory-service" > /dev/null; then
    local pid
    pid=$(pgrep -f -n "packages/core/dist/services/vector-memory-service.cjs" || true)
    if [ -n "$pid" ]; then
      echo "$pid" > "$PROJECT_ROOT/.vector.pid"
      print_status "Vector Memory Service already running (PID: $pid)"
    else
      print_status "Vector Memory Service already running"
    fi
    return 0
  fi

  # Start Vector Memory Service with EmbeddingGemma
  nohup node "$PROJECT_ROOT/packages/core/dist/services/vector-memory-service.cjs" > logs/vector-memory.log 2>&1 &
  local vector_pid=$!
  sleep 3

  if kill -0 $vector_pid 2>/dev/null; then
    echo $vector_pid > "$PROJECT_ROOT/.vector.pid"
    print_status "Vector Memory Service started (PID: $vector_pid)"
    return 0
  else
    print_error "Failed to start Vector Memory Service"
    return 1
  fi
}

# Function to start Token Optimizer (real production system)
start_optimizer() {
  print_status "Starting Token Optimizer..."

  if pgrep -f "token-optimizer-service" > /dev/null; then
    local pid
    pid=$(pgrep -f -n "packages/core/dist/services/token-optimizer-service.cjs" || true)
    if [ -n "$pid" ]; then
      echo "$pid" > "$PROJECT_ROOT/.optimizer.pid"
      print_status "Token Optimizer already running (PID: $pid)"
    else
      print_status "Token Optimizer already running"
    fi
    return 0
  fi

  # Start Token Optimizer with real algorithms
  nohup node "$PROJECT_ROOT/packages/core/dist/services/token-optimizer-service.cjs" > logs/token-optimizer.log 2>&1 &
  local opt_pid=$!
  sleep 3

  if kill -0 $opt_pid 2>/dev/null; then
    echo $opt_pid > "$PROJECT_ROOT/.optimizer.pid"
    print_status "Token Optimizer started (PID: $opt_pid)"
    return 0
  else
    print_error "Failed to start Token Optimizer"
    return 1
  fi
}

# Function to start Model Registry (real production system)
start_registry() {
  print_status "Starting Model Registry..."

  if pgrep -f "model-registry-service" > /dev/null; then
    local pid
    pid=$(pgrep -f -n "packages/core/dist/services/model-registry-service.cjs" || true)
    if [ -n "$pid" ]; then
      echo "$pid" > "$PROJECT_ROOT/.registry.pid"
      print_status "Model Registry already running (PID: $pid)"
    else
      print_status "Model Registry already running"
    fi
    return 0
  fi

  # Start Model Registry with auto-selection
  nohup node "$PROJECT_ROOT/packages/core/dist/services/model-registry-service.cjs" > logs/model-registry.log 2>&1 &
  local reg_pid=$!
  sleep 3

  if kill -0 $reg_pid 2>/dev/null; then
    echo $reg_pid > "$PROJECT_ROOT/.registry.pid"
    print_status "Model Registry started (PID: $reg_pid)"
    return 0
  else
    print_error "Failed to start Model Registry"
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
  local pid_file_actual="$PROJECT_ROOT/devflow-enforcement-daemon.pid"
  if [ -f "$pid_file_actual" ]; then
    local actual_pid=$(cat "$pid_file_actual")
    # Check if the process is actually running
    if ! kill -0 $actual_pid 2>/dev/null; then
      # Process is not running, remove stale PID file
      print_warning "Removing stale daemon PID file..."
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

# Function to start Smart Session Retry System (real system)
start_session_retry() {
  print_status "Starting Smart Session Retry System..."

  if pgrep -f "session-retry-service" > /dev/null; then
    local pid
    pid=$(pgrep -f -n "session-retry-service" || true)
    if [ -n "$pid" ]; then
      echo "$pid" > "$PROJECT_ROOT/.session-retry.pid"
      print_status "Smart Session Retry System already running (PID: $pid)"
    else
      print_status "Smart Session Retry System already running"
    fi
    return 0
  fi

  # Check if session retry service exists
  if [ ! -f "$PROJECT_ROOT/src/core/session/session-retry-service.js" ]; then
    print_error "session-retry-service.js not found in src/core/session/"
    return 1
  fi

  # Start Smart Session Retry System in background
  nohup node "$PROJECT_ROOT/src/core/session/session-retry-service.js" > logs/session-retry.log 2>&1 &
  local retry_pid=$!

  # Give it a moment to start
  sleep 3

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

# Function to start Claude Code Limit Detection System
start_limit_detection() {
  print_status "Starting Claude Code Limit Detection System..."

  # Check if limit detection hook exists
  if [ ! -f "$PROJECT_ROOT/.claude/hooks/session-limit-detector.js" ]; then
    print_warning "Limit detection hook not found - creating symlink..."
    mkdir -p "$PROJECT_ROOT/.claude/hooks"
    if [ -f "$PROJECT_ROOT/src/core/session/session-limit-detector.js" ]; then
      ln -sf "$PROJECT_ROOT/src/core/session/session-limit-detector.js" "$PROJECT_ROOT/.claude/hooks/session-limit-detector.js"
    elif [ ! -f "$PROJECT_ROOT/.claude/hooks/session-limit-detector.js" ]; then
      print_warning "Limit detection hook not found - limit detection will not be available"
      return 0
    fi
  fi

  # Check if Claude Code wrapper exists
  if [ ! -f "$PROJECT_ROOT/scripts/claude-code-with-limit-detection.sh" ]; then
    print_warning "Claude Code wrapper not found - limit detection will not be available"
    return 0
  fi

  # Create global alias for quick limit notification
  if [ -d "/usr/local/bin" ] && [ -w "/usr/local/bin" ]; then
    ln -sf "$PROJECT_ROOT/scripts/quick-limit-notify.sh" /usr/local/bin/retry-claude 2>/dev/null && \
      print_status "✅ Global alias 'retry-claude' created" || \
      print_warning "⚠️  Could not create global alias"
  else
    # Try with sudo if we have it
    if command_exists sudo && [ -d "/usr/local/bin" ]; then
      if sudo -n true 2>/dev/null; then
        sudo ln -sf "$PROJECT_ROOT/scripts/quick-limit-notify.sh" /usr/local/bin/retry-claude 2>/dev/null && \
          print_status "✅ Global alias 'retry-claude' created (with sudo)" || \
          print_warning "⚠️  Could not create global alias (sudo failed)"
      else
        print_warning "⚠️  sudo required for global alias - run: sudo ln -sf $PROJECT_ROOT/scripts/quick-limit-notify.sh /usr/local/bin/retry-claude"
      fi
    else
      print_warning "⚠️  /usr/local/bin not writable - global alias not created"
      print_status "💡 Tip: Create alias manually with: sudo ln -sf $PROJECT_ROOT/scripts/quick-limit-notify.sh /usr/local/bin/retry-claude"
    fi
  fi

  print_status "Claude Code Limit Detection System ready"
  return 0
}

# Function to start Fallback Monitoring System (Dream Team monitoring)
start_fallback_monitoring() {
  print_status "Starting Dream Team Fallback Monitoring System..."

  # Check if fallback monitoring is already running
  if pgrep -f "fallback-monitoring-bootstrap.js" > /dev/null; then
    local pid
    pid=$(pgrep -f -n "fallback-monitoring-bootstrap.js" || true)
    if [ -n "$pid" ]; then
      echo "$pid" > "$PROJECT_ROOT/.fallback.pid"
      print_status "Fallback Monitoring already running (PID: $pid)"
    else
      print_status "Fallback Monitoring already running"
    fi
    return 0
  fi

  # Check if fallback monitoring bootstrap exists
  if [ ! -f "$PROJECT_ROOT/src/core/orchestration/fallback/fallback-monitoring-bootstrap.js" ]; then
    print_error "fallback-monitoring-bootstrap.js not found"
    return 1
  fi

  # Create logs directory if it doesn't exist
  mkdir -p "$PROJECT_ROOT/logs"

  # Start fallback monitoring in background
  cd "$PROJECT_ROOT"
  nohup node src/core/orchestration/fallback/fallback-monitoring-bootstrap.js > logs/fallback-monitoring.log 2>&1 &
  local fallback_pid=$!

  # Give it a moment to start
  sleep 3

  # Check if it's still running
  if kill -0 $fallback_pid 2>/dev/null; then
    echo $fallback_pid > "$PROJECT_ROOT/.fallback.pid"
    print_status "Dream Team Fallback Monitoring started successfully (PID: $fallback_pid)"
    return 0
  else
    print_error "Failed to start Fallback Monitoring System"
    return 1
  fi
}

# Function to start CC-Tools gRPC Server
start_cctools() {
  print_status "Starting CC-Tools gRPC Server..."

  # Check if CC-Tools server is already running
  if pgrep -f "cc-tools-server" > /dev/null; then
    local pid
    pid=$(pgrep -f -n "cc-tools-server" || true)
    if [ -n "$pid" ]; then
      echo "$pid" > "$PROJECT_ROOT/.cctools.pid"
      print_status "CC-Tools gRPC Server already running (PID: $pid)"
    else
      print_status "CC-Tools gRPC Server already running"
    fi
    return 0
  fi

  # Resolve binary (support debug mode via CC_TOOLS_USE_DEBUG=true)
  local use_debug=${CC_TOOLS_USE_DEBUG:-false}
  local bin_name="cc-tools-server"
  if [ "$use_debug" = "true" ]; then
    if [ -f "$PROJECT_ROOT/go-server/cc-tools-server-debug" ]; then
      bin_name="cc-tools-server-debug"
      print_status "Using debug binary ($bin_name) with reflection enabled"
    else
      print_warning "Debug binary requested but not found; falling back to cc-tools-server"
    fi
  fi

  # Check if resolved binary exists
  if [ ! -f "$PROJECT_ROOT/go-server/$bin_name" ]; then
    print_error "CC-Tools server binary not found at go-server/$bin_name"
    return 1
  fi

  # Create logs directory if it doesn't exist
  mkdir -p "$PROJECT_ROOT/logs"

  # Start CC-Tools server in background
  cd "$PROJECT_ROOT/go-server"
  nohup "./$bin_name" > ../logs/cc-tools-server.log 2>&1 &
  local cctools_pid=$!
  cd "$PROJECT_ROOT"

  # Give it a moment to start
  sleep 3

  # Check if it's still running
  if kill -0 $cctools_pid 2>/dev/null; then
    echo $cctools_pid > "$PROJECT_ROOT/.cctools.pid"
    local cctools_port=${GRPC_PORT:-50051}
    print_status "CC-Tools gRPC Server started successfully (PID: $cctools_pid) on port $cctools_port"
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
  if curl -sf --max-time 2 "http://localhost:3005/health" >/dev/null 2>&1; then
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
      if curl -sf --max-time 2 "http://localhost:3005/health" >/dev/null 2>&1; then
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
  sleep 3

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
  nohup npx ts-node "$PROJECT_ROOT/src/core/ui/platform-status-tracker.ts" > logs/platform-status-tracker.log 2>&1 &
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

# Function to check prerequisites
check_prerequisites() {
  print_status "Checking prerequisites..."
  
  # Check Node.js
  if ! command_exists node; then
    print_error "Node.js is required but not found. Please install Node.js."
    exit 1
  fi
  
  # Check npm
  if ! command_exists npm; then
    print_error "npm is required but not found. Please install npm."
    exit 1
  fi
  
  # Check if project is built
  if [ ! -d "$PROJECT_ROOT/packages/core/dist" ]; then
    print_warning "Project not built. Building now..."
    cd "$PROJECT_ROOT"
    npm run build
    if [ $? -ne 0 ]; then
      print_error "Build failed"
      exit 1
    fi
  fi
  
  print_status "All prerequisites met."
}

# Load environment variables from .env file
if [ -f "$PROJECT_ROOT/.env" ]; then
    while IFS= read -r line; do
        if [[ ! "$line" =~ ^# ]] && [[ -n "$line" ]]; then
            export "$line"
        fi
    done < "$PROJECT_ROOT/.env"
    echo "[STATUS] Loaded environment variables from .env"
fi

# Ensure correct Synthetic API URL is used (override any system-level environment variable)
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
  
  # Check prerequisites
  check_prerequisites
  
  # Start services in order (v2.1.0 production architecture)
  print_status "Starting DevFlow v2.1.0 Production Services..."

  # Core infrastructure services (REQUIRED)
  if ! start_database; then
    print_error "Database Manager failed to start - CRITICAL ERROR"
    exit 1
  fi

  if ! start_registry; then
    print_error "Model Registry failed to start - CRITICAL ERROR"
    exit 1
  fi

  if ! start_vector; then
    print_error "Vector Memory Service failed to start - CRITICAL ERROR"
    exit 1
  fi

  if ! start_optimizer; then
    print_error "Token Optimizer failed to start - CRITICAL ERROR"
    exit 1
  fi

  # Integration services (REQUIRED)
  if ! start_synthetic; then
    print_error "Synthetic MCP service failed to start - CRITICAL ERROR"
    exit 1
  fi

  if ! start_ccr; then
    print_error "Auto CCR Runner failed to start - CRITICAL ERROR"
    exit 1
  fi

  # Start smart session retry system (optional - graceful degradation)
  if ! start_session_retry; then
    print_warning "Smart Session Retry System failed to start - CONTINUING WITHOUT SESSION RETRY"
  fi

  # Start Claude Code limit detection system (optional - enhances session retry)
  if ! start_limit_detection; then
    print_warning "Claude Code Limit Detection System failed to start - limit detection will not be available"
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

  # Start CC-Tools gRPC Server (required for validation hooks)
  if ! start_cctools; then
    print_error "CC-Tools gRPC Server failed to start - CRITICAL ERROR"
    exit 1
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
  print_status "✅ CC-Tools gRPC Server: Running (Port 50051)"
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
