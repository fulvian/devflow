#!/bin/bash

# DevFlow Start Script
# This script starts all DevFlow services including CCR integration

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
    if kill -0 "$pid" 2>/dev/null; then
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
  print_status "Stopping DevFlow services..."
  
  # Stop CCR if running
  if is_process_running "$PROJECT_ROOT/.ccr.pid"; then
    local ccr_pid=$(cat "$PROJECT_ROOT/.ccr.pid")
    print_status "Stopping CCR (PID: $ccr_pid)..."
    kill -TERM "$ccr_pid" 2>/dev/null || true
    sleep 2
    if kill -0 "$ccr_pid" 2>/dev/null; then
      print_warning "Force killing CCR (PID: $ccr_pid)..."
      kill -KILL "$ccr_pid" 2>/dev/null || true
    fi
    rm -f "$PROJECT_ROOT/.ccr.pid"
  fi
  
  # Stop Orchestrator if running
  if is_process_running "$PROJECT_ROOT/.orchestrator.pid"; then
    local orchestrator_pid=$(cat "$PROJECT_ROOT/.orchestrator.pid")
    print_status "Stopping Orchestrator (PID: $orchestrator_pid)..."
    kill -TERM "$orchestrator_pid" 2>/dev/null || true
    sleep 2
    if kill -0 "$orchestrator_pid" 2>/dev/null; then
      print_warning "Force killing Orchestrator (PID: $orchestrator_pid)..."
      kill -KILL "$orchestrator_pid" 2>/dev/null || true
    fi
    rm -f "$PROJECT_ROOT/.orchestrator.pid"
  fi
  
  # Stop Proxy if running
  if is_process_running "$PROJECT_ROOT/.proxy.pid"; then
    local proxy_pid=$(cat "$PROJECT_ROOT/.proxy.pid")
    print_status "Stopping Proxy (PID: $proxy_pid)..."
    kill -TERM "$proxy_pid" 2>/dev/null || true
    sleep 2
    if kill -0 "$proxy_pid" 2>/dev/null; then
      print_warning "Force killing Proxy (PID: $proxy_pid)..."
      kill -KILL "$proxy_pid" 2>/dev/null || true
    fi
    rm -f "$PROJECT_ROOT/.proxy.pid"
  fi
  
  print_status "All services stopped."
}

# Function to start Auto CCR Runner (real system)
start_ccr() {
  print_status "Starting Auto CCR Runner..."
  
  # Check if Auto CCR Runner is already running
  if pgrep -f "auto-ccr-runner.js" > /dev/null; then
    print_status "Auto CCR Runner already running"
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
  print_status "Starting Synthetic MCP Server..."
  
  # Check if Synthetic MCP is already running
  if pgrep -f "synthetic.*dist.*index.js" > /dev/null; then
    print_status "Synthetic MCP Server already running"
    return 0
  fi
  
  # Check if Synthetic MCP exists
  if [ ! -f "$PROJECT_ROOT/mcp-servers/synthetic/dist/dual-enhanced-index.js" ]; then
    print_error "Synthetic MCP Server not found"
    return 1
  fi
  
  # Start Synthetic MCP Server
  cd "$PROJECT_ROOT/mcp-servers/synthetic"
  nohup node dist/dual-enhanced-index.js > ../../logs/synthetic-server.log 2>&1 &
  local synthetic_pid=$!
  cd "$PROJECT_ROOT"
  
  # Give it a moment to start
  sleep 2
  
  # Check if it's still running
  if kill -0 $synthetic_pid 2>/dev/null; then
    echo $synthetic_pid > "$PROJECT_ROOT/.synthetic.pid"
    print_status "Synthetic MCP Server started successfully (PID: $synthetic_pid)"
    return 0
  else
    print_error "Failed to start Synthetic MCP Server"
    return 1
  fi
}

# Function to start CTIR Router MCP (real system)  
start_router() {
  print_status "Starting CTIR Router MCP..."
  
  # Check if CTIR Router is already running
  if pgrep -f "ctir-router-mcp.*index.js" > /dev/null; then
    print_status "CTIR Router MCP already running"
    return 0
  fi
  
  # Check if CTIR Router exists
  if [ ! -f "/Users/fulvioventura/Desktop/ctir/mcp/ctir-router-mcp/dist/index.js" ]; then
    print_warning "CTIR Router MCP not found - skipping"
    return 0
  fi
  
  # Start CTIR Router MCP
  nohup node "/Users/fulvioventura/Desktop/ctir/mcp/ctir-router-mcp/dist/index.js" > logs/ctir-router.log 2>&1 &
  local router_pid=$!
  
  # Give it a moment to start
  sleep 2
  
  # Check if it's still running
  if kill -0 $router_pid 2>/dev/null; then
    echo $router_pid > "$PROJECT_ROOT/.router.pid"
    print_status "CTIR Router MCP started successfully (PID: $router_pid)"
    return 0
  else
    print_warning "Failed to start CTIR Router MCP - continuing without it"
    return 0
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
      print_status "DevFlow Services Status:"
      if is_process_running "$PROJECT_ROOT/.ccr.pid"; then
        print_status "CCR: Running (PID: $(cat "$PROJECT_ROOT/.ccr.pid"))"
      else
        print_status "CCR: Stopped"
      fi
      
      if is_process_running "$PROJECT_ROOT/.orchestrator.pid"; then
        print_status "Orchestrator: Running (PID: $(cat "$PROJECT_ROOT/.orchestrator.pid"))"
      else
        print_status "Orchestrator: Stopped"
      fi
      
      if is_process_running "$PROJECT_ROOT/.proxy.pid"; then
        print_status "Proxy: Running (PID: $(cat "$PROJECT_ROOT/.proxy.pid"))"
      else
        print_status "Proxy: Stopped"
      fi
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
  
  # Start services in order (real architecture)
  if start_synthetic; then
    print_status "Synthetic MCP service started successfully"
  else
    print_warning "Synthetic MCP service failed to start - continuing without it"
  fi
  
  if start_ccr; then
    print_status "Auto CCR Runner started successfully"
  else
    print_warning "Auto CCR Runner failed to start - continuing without it"
  fi
  
  if start_router; then
    print_status "CTIR Router MCP started successfully" 
  else
    print_warning "CTIR Router MCP failed to start - continuing without it"
  fi
  
  print_status "All DevFlow services started successfully!"
  print_status "Auto CCR Runner is monitoring for Claude limits and will trigger fallback automatically."
}

# Trap SIGINT and SIGTERM to stop services gracefully
trap stop_services SIGINT SIGTERM

# Run main function
main "$@"
