#!/bin/bash

# DevFlow Unified System v1.0 - Simplified Startup Script
# Optimized and simplified version of devflow-start.sh
# Architecture: Unified Orchestrator v1.0 compliant

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
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
        if kill -0 "$pid" 2>/dev/null; then
            return 0  # Process is running
        else
            rm -f "$pid_file"  # Clean up stale PID file
            return 1  # Process not running
        fi
    else
        return 1  # PID file doesn't exist
    fi
}

# Load environment variables from .env
load_environment() {
    if [ -f .env ]; then
        # Use secure method that handles spaces and special characters
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
}

# Set default values for core services
set_defaults() {
    export ORCHESTRATOR_PORT=${ORCHESTRATOR_PORT:-3005}
    export DB_MANAGER_PORT=${DB_MANAGER_PORT:-3002}
    export VECTOR_MEMORY_PORT=${VECTOR_MEMORY_PORT:-3008}

    # Set DevFlow defaults
    export DEVFLOW_ENABLED=${DEVFLOW_ENABLED:-true}
    export DEVFLOW_DB_PATH=${DEVFLOW_DB_PATH:-./data/devflow_unified.sqlite}
    export DEVFLOW_AUTO_INJECT=${DEVFLOW_AUTO_INJECT:-true}
    export DEVFLOW_HANDOFF_ENABLED=${DEVFLOW_HANDOFF_ENABLED:-true}
    export DEVFLOW_VERBOSE=${DEVFLOW_VERBOSE:-false}
    export DEVFLOW_PROJECT_ROOT=${DEVFLOW_PROJECT_ROOT:-$(pwd)}

    print_info "Core services - Orchestrator: $ORCHESTRATOR_PORT, Database: $DB_MANAGER_PORT, Vector Memory: $VECTOR_MEMORY_PORT"
    print_info "DevFlow config - DB: $DEVFLOW_DB_PATH, Project Root: $DEVFLOW_PROJECT_ROOT"
}

# Clean up DevFlow processes and ports
cleanup_services() {
    print_status "🧹 Cleaning up existing DevFlow processes..."

    # Clean up PID files first
    local pid_files=(".orchestrator.pid" ".database.pid" ".vector.pid")
    for pid_file in "${pid_files[@]}"; do
        if [ -f "$PROJECT_ROOT/$pid_file" ]; then
            local pid=$(cat "$PROJECT_ROOT/$pid_file")
            if kill -0 "$pid" 2>/dev/null; then
                print_status "Stopping process $pid from $pid_file"
                kill -TERM "$pid" 2>/dev/null || true
                sleep 1
                kill -KILL "$pid" 2>/dev/null || true
            fi
            rm -f "$PROJECT_ROOT/$pid_file"
        fi
    done

    # Force kill processes by pattern
    pkill -f "unified-orchestrator" 2>/dev/null || true
    pkill -f "database-daemon" 2>/dev/null || true
    pkill -f "vector-memory-service" 2>/dev/null || true

    # Clean up ports brutally
    local DEVFLOW_PORTS=($ORCHESTRATOR_PORT $DB_MANAGER_PORT $VECTOR_MEMORY_PORT)

    for port in "${DEVFLOW_PORTS[@]}"; do
        local port_pids=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$port_pids" ]; then
            print_status "🔫 Terminating processes on port $port: $port_pids"
            echo "$port_pids" | xargs -r kill -TERM 2>/dev/null || true
            sleep 1
            echo "$port_pids" | xargs -r kill -KILL 2>/dev/null || true
        fi
    done

    print_status "✅ Cleanup completed"
}

# Start Database Manager
start_database() {
    print_status "Starting Database Manager..."

    # Check if already running
    if curl -sf --max-time 2 "http://localhost:${DB_MANAGER_PORT}/health" >/dev/null 2>&1; then
        print_status "Database Manager already running on port $DB_MANAGER_PORT"
        return 0
    fi

    # Check if database daemon exists
    if [ ! -f "$PROJECT_ROOT/src/core/database/database-daemon.ts" ]; then
        print_error "Database Manager daemon not found at src/core/database/database-daemon.ts"
        return 1
    fi

    # Create logs directory
    mkdir -p "$PROJECT_ROOT/logs"

    # Start Database Manager daemon in background (TypeScript via ts-node)
    nohup env DB_MANAGER_PORT=$DB_MANAGER_PORT DEVFLOW_DB_PATH="$DEVFLOW_DB_PATH" DEVFLOW_ENABLED="$DEVFLOW_ENABLED" npx ts-node "$PROJECT_ROOT/src/core/database/database-daemon.ts" > "$PROJECT_ROOT/logs/database-manager.log" 2>&1 &
    local db_pid=$!

    # Give it time to start
    sleep 3

    # Verify it's running
    if kill -0 $db_pid 2>/dev/null; then
        # Health check validation
        local health_attempts=0
        while [ $health_attempts -lt 10 ]; do
            if curl -sf --max-time 2 "http://localhost:${DB_MANAGER_PORT}/health" >/dev/null 2>&1; then
                echo $db_pid > "$PROJECT_ROOT/.database.pid"
                print_status "✅ Database Manager started (PID: $db_pid, Port: $DB_MANAGER_PORT)"
                return 0
            fi
            sleep 2
            health_attempts=$((health_attempts + 1))
        done

        print_error "Database Manager started but health check failed"
        return 1
    else
        print_error "Failed to start Database Manager"
        return 1
    fi
}

# Start Vector Memory Service
start_vector() {
    print_status "Starting Vector Memory Service..."

    # Check if already running via port check
    if netstat -an 2>/dev/null | grep -q "${VECTOR_MEMORY_PORT}.*LISTEN"; then
        print_status "Vector Memory Service already running on port $VECTOR_MEMORY_PORT"
        return 0
    fi

    # Check if vector service exists
    if [ ! -f "$PROJECT_ROOT/packages/core/dist/services/vector-memory-service.cjs" ]; then
        print_error "Vector Memory Service not found at packages/core/dist/services/vector-memory-service.cjs"
        return 1
    fi

    # Create logs directory
    mkdir -p "$PROJECT_ROOT/logs"

    # Start Vector Memory Service in background
    nohup env VECTOR_MEMORY_PORT=$VECTOR_MEMORY_PORT DEVFLOW_DB_PATH="$DEVFLOW_DB_PATH" DEVFLOW_ENABLED="$DEVFLOW_ENABLED" node "$PROJECT_ROOT/packages/core/dist/services/vector-memory-service.cjs" > "$PROJECT_ROOT/logs/vector-memory.log" 2>&1 &
    local vec_pid=$!

    # Give it time to start
    sleep 3

    # Verify it's running
    if kill -0 $vec_pid 2>/dev/null; then
        # Port check validation
        local port_attempts=0
        while [ $port_attempts -lt 10 ]; do
            if netstat -an 2>/dev/null | grep -q "${VECTOR_MEMORY_PORT}.*LISTEN"; then
                echo $vec_pid > "$PROJECT_ROOT/.vector.pid"
                print_status "✅ Vector Memory Service started (PID: $vec_pid, Port: $VECTOR_MEMORY_PORT)"
                return 0
            fi
            sleep 2
            port_attempts=$((port_attempts + 1))
        done

        print_error "Vector Memory Service started but port check failed"
        return 1
    else
        print_error "Failed to start Vector Memory Service"
        return 1
    fi
}

# Start Unified Orchestrator
start_unified_orchestrator() {
    print_status "Starting DevFlow Unified Orchestrator v1.0..."

    # Check if already running
    if curl -sf --max-time 2 "http://localhost:${ORCHESTRATOR_PORT}/health" >/dev/null 2>&1; then
        print_status "Unified Orchestrator already running on port $ORCHESTRATOR_PORT"
        return 0
    fi

    # Check if orchestrator exists
    if [ ! -f "$PROJECT_ROOT/packages/orchestrator/unified/dist/server.js" ]; then
        print_error "Unified Orchestrator not found at packages/orchestrator/unified/dist/server.js"
        return 1
    fi

    # Create logs directory
    mkdir -p "$PROJECT_ROOT/logs"

    # Start orchestrator in background
    cd "$PROJECT_ROOT/packages/orchestrator/unified"
    nohup env ORCHESTRATOR_PORT=$ORCHESTRATOR_PORT DEVFLOW_DB_PATH="$DEVFLOW_DB_PATH" DEVFLOW_ENABLED="$DEVFLOW_ENABLED" npm start > "$PROJECT_ROOT/logs/unified-orchestrator.log" 2>&1 &
    local orchestrator_pid=$!
    cd "$PROJECT_ROOT"

    # Give it time to start
    sleep 3

    # Verify it's running
    if kill -0 $orchestrator_pid 2>/dev/null; then
        # Health check validation
        local health_attempts=0
        while [ $health_attempts -lt 10 ]; do
            if curl -sf --max-time 2 "http://localhost:${ORCHESTRATOR_PORT}/health" >/dev/null 2>&1; then
                echo $orchestrator_pid > "$PROJECT_ROOT/.orchestrator.pid"
                print_status "✅ Unified Orchestrator started (PID: $orchestrator_pid, Port: $ORCHESTRATOR_PORT)"
                return 0
            fi
            sleep 2
            health_attempts=$((health_attempts + 1))
        done

        print_error "Orchestrator started but health check failed"
        return 1
    else
        print_error "Failed to start Unified Orchestrator"
        return 1
    fi
}

# Stop all services
stop_services() {
    print_status "🛑 Stopping DevFlow Unified System..."
    cleanup_services
    print_status "✅ All DevFlow services stopped"
}

# Start all services
start_services() {
    print_status "🚀 Starting DevFlow Unified System v1.0..."

    # Start Database Manager (infrastructure first)
    if ! start_database; then
        print_error "Failed to start Database Manager - CRITICAL ERROR"
        return 1
    fi

    # Start Vector Memory Service (depends on database)
    if ! start_vector; then
        print_error "Failed to start Vector Memory Service - CRITICAL ERROR"
        return 1
    fi

    # Start Unified Orchestrator (orchestrates other services)
    if ! start_unified_orchestrator; then
        print_error "Failed to start Unified Orchestrator - CRITICAL ERROR"
        return 1
    fi

    print_status "🎉 DevFlow Unified System v1.0 Started Successfully!"
    print_status "✅ Database Manager: Running on port $DB_MANAGER_PORT"
    print_status "✅ Vector Memory: Running on port $VECTOR_MEMORY_PORT"
    print_status "✅ Unified Orchestrator: Running on port $ORCHESTRATOR_PORT"
    print_status "📊 Health: http://localhost:$ORCHESTRATOR_PORT/health"
    print_status "🎛️  Mode: http://localhost:$ORCHESTRATOR_PORT/api/mode"
    print_status "📈 Metrics: http://localhost:$ORCHESTRATOR_PORT/api/metrics"
    print_status "🔄 System ready for task orchestration"

    return 0
}

# Show service status
show_status() {
    print_status "DevFlow Unified System v1.0 Status:"

    # Check Database Manager
    if curl -sf --max-time 2 "http://localhost:${DB_MANAGER_PORT}/health" >/dev/null 2>&1; then
        local db_health=$(curl -s "http://localhost:${DB_MANAGER_PORT}/health" 2>/dev/null)
        local db_status=$(echo "$db_health" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        print_status "✅ Database Manager: Running (Status: $db_status, Port: $DB_MANAGER_PORT)"
    else
        print_status "❌ Database Manager: Stopped"
    fi

    # Check Vector Memory Service
    if netstat -an 2>/dev/null | grep -q "${VECTOR_MEMORY_PORT}.*LISTEN"; then
        print_status "✅ Vector Memory: Running (Port: $VECTOR_MEMORY_PORT)"
    else
        print_status "❌ Vector Memory: Stopped"
    fi

    # Check Unified Orchestrator
    if curl -sf --max-time 2 "http://localhost:${ORCHESTRATOR_PORT}/health" >/dev/null 2>&1; then
        local health_data=$(curl -s "http://localhost:${ORCHESTRATOR_PORT}/health" 2>/dev/null)
        local status=$(echo "$health_data" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        local mode=$(echo "$health_data" | grep -o '"currentMode":"[^"]*"' | cut -d'"' -f4)
        print_status "✅ Unified Orchestrator: Running (Status: $status, Mode: $mode)"
    else
        print_status "❌ Unified Orchestrator: Stopped"
    fi
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."

    # Check Node.js
    if ! command_exists node; then
        print_error "Node.js is not installed"
        exit 1
    fi

    # Check npm
    if ! command_exists npm; then
        print_error "npm is not installed"
        exit 1
    fi

    # Check if we're in the right directory
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        print_error "This script must be run from the DevFlow project root"
        exit 1
    fi

    # Create necessary directories
    mkdir -p "$PROJECT_ROOT/logs"
    mkdir -p "$PROJECT_ROOT/.devflow"

    print_status "✅ All prerequisites met"
}

# Main execution
main() {
    # Handle arguments
    case "$1" in
        stop)
            stop_services
            exit 0
            ;;
        restart)
            load_environment
            set_defaults
            check_prerequisites
            stop_services
            sleep 2
            start_services
            exit $?
            ;;
        status)
            load_environment
            set_defaults
            show_status
            exit 0
            ;;
        start|"")
            load_environment
            set_defaults
            check_prerequisites
            start_services
            exit $?
            ;;
        help|--help|-h)
            echo "DevFlow Unified System v1.0 - Startup Script"
            echo ""
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  start    - Start all DevFlow services (default)"
            echo "  stop     - Stop all DevFlow services cleanly"
            echo "  restart  - Stop and start all services (clean restart)"
            echo "  status   - Show status of all services"
            echo "  help     - Show this help message"
            echo ""
            echo "Architecture: Unified Orchestrator v1.0"
            echo "Port mapping: See .env file for port assignments"
            exit 0
            ;;
        *)
            print_error "Unknown command: $1"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Trap signals for graceful shutdown
trap stop_services SIGINT SIGTERM

# Run main function
main "$@"