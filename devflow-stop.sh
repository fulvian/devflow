#!/bin/bash

# DevFlow Stop Script v2.1.0 Production
# This script stops all DevFlow services using individual PID files (aligned with devflow-start.sh)

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

print_status "🛑 Stopping DevFlow v3.1 services..."

# Stop all DevFlow services (including orchestrator) - aligned with devflow-start.sh v3.1
services=(".enforcement.pid" ".ccr.pid" ".synthetic.pid" ".orchestrator.pid" ".database.pid" ".vector.pid" ".optimizer.pid" ".registry.pid")

for service_pid in "${services[@]}"; do
  if is_process_running "$PROJECT_ROOT/$service_pid"; then
    pid=$(cat "$PROJECT_ROOT/$service_pid")
    service_name=$(echo $service_pid | sed 's/.pid//' | sed 's/\.//')

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

# Legacy cleanup - remove old devflow_pids file if it exists
if [ -f .devflow_pids ]; then
    print_warning "Removing legacy .devflow_pids file..."
    rm .devflow_pids
fi

# Kill by process name as backup (robustness)
print_status "Running backup cleanup..."
pkill -f "claude-code-bootstrap" 2>/dev/null || true
pkill -f "synthetic" 2>/dev/null || true
pkill -f "devflow" 2>/dev/null || true
pkill -f "ccr" 2>/dev/null || true

# Stop CCR Services
if [ -f "scripts/ccr-services.sh" ]; then
    print_status "Stopping CCR services script..."
    ./scripts/ccr-services.sh stop 2>/dev/null || true
fi

# Stop Emergency CCR if running
if [ -f "emergency-ccr-cli.mjs" ]; then
    print_status "Stopping emergency CCR..."
    node emergency-ccr-cli.mjs stop 2>/dev/null || true
fi

print_status "✅ All DevFlow services stopped"
