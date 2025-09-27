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

# Enhanced health check function (Context7 compliant)
wait_for_health_check() {
    local url=$1
    local service_name=$2
    local max_attempts=${3:-30}
    local attempt=1

    print_info "⏳ Waiting for $service_name health check..."

    while [ $attempt -le $max_attempts ]; do
        if curl -sf --max-time 5 "$url" > /dev/null 2>&1; then
            print_status "✅ $service_name is healthy"
            return 0
        fi

        if [ $((attempt % 5)) -eq 0 ]; then
            print_info "⏳ Waiting for $service_name health check (attempt $attempt/$max_attempts)..."
        fi

        sleep 2
        ((attempt++))
    done

    print_error "❌ $service_name health check failed after $max_attempts attempts"
    return 1
}

# Process health check for background services (Context7 pattern)
check_process_health() {
    local pid=$1
    local service_name=$2

    if kill -0 $pid 2>/dev/null; then
        print_status "✅ $service_name process is running (PID: $pid)"
        return 0
    else
        print_error "❌ $service_name process failed to start"
        return 1
    fi
}

# Multi-service health checker (inspired by goadesign/clue)
validate_service_dependencies() {
    local service_name=$1
    local dependencies=("${@:2}")

    print_info "🔍 Validating dependencies for $service_name..."

    for dep in "${dependencies[@]}"; do
        case $dep in
            "database")
                if ! curl -sf --max-time 2 "http://localhost:${DB_MANAGER_PORT}/health" >/dev/null 2>&1; then
                    print_error "❌ Dependency check failed: Database Manager not healthy"
                    return 1
                fi
                ;;
            "orchestrator")
                if ! curl -sf --max-time 2 "http://localhost:${ORCHESTRATOR_PORT}/health" >/dev/null 2>&1; then
                    print_error "❌ Dependency check failed: Unified Orchestrator not healthy"
                    return 1
                fi
                ;;
            "model_registry")
                if ! curl -sf --max-time 2 "http://localhost:${MODEL_REGISTRY_PORT}/health" >/dev/null 2>&1; then
                    print_error "❌ Dependency check failed: Model Registry not healthy"
                    return 1
                fi
                ;;
            "cli_integration")
                if ! curl -sf --max-time 2 "http://localhost:${CLI_INTEGRATION_PORT}/health" >/dev/null 2>&1; then
                    print_error "❌ Dependency check failed: CLI Integration not healthy"
                    return 1
                fi
                ;;
        esac
    done

    print_status "✅ All dependencies validated for $service_name"
    return 0
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
#
# IMPORTANTE: PROTOCOLLO GESTIONE PORTE PER SVILUPPATORI
# =======================================================
# REGOLA 1: Nessuna porta deve mai essere hardcoded nel codice
# REGOLA 2: Tutte le porte devono essere configurabili tramite .env
# REGOLA 3: Ogni porta deve avere un valore di default ragionevole
# REGOLA 4: Le porte di default devono evitare conflitti comuni
# REGOLA 5: Documentare ogni porta con commento esplicativo
#
# Convenzioni porte DevFlow:
# - 3000-3999: Servizi core DevFlow
# - 8000-8999: Servizi esterni/bridge (MCP servers, etc.)
# - Evitare: 3000, 8000, 8080 (porte comuni in conflitto)
#
set_defaults() {
    # Core DevFlow Services (range 3000-3999)
    export ORCHESTRATOR_PORT=${ORCHESTRATOR_PORT:-3005}        # Unified Orchestrator
    export DB_MANAGER_PORT=${DB_MANAGER_PORT:-3002}            # Database Manager
    export PROJECT_API_PORT=${PROJECT_API_PORT:-3003}          # Project Lifecycle API
    export MODEL_REGISTRY_PORT=${MODEL_REGISTRY_PORT:-3004}    # Model Registry Daemon
    export CONTEXT_BRIDGE_PORT=${CONTEXT_BRIDGE_PORT:-3007}    # Context Bridge Service (enhanced embedding)
    export VECTOR_MEMORY_PORT=${VECTOR_MEMORY_PORT:-3008}      # Vector Memory Service
    export ENHANCED_MEMORY_PORT=${ENHANCED_MEMORY_PORT:-3009}  # Enhanced Memory System (Phase 1-3)

    # Advanced Orchestration Services (range 3200-3299)
    export DREAM_TEAM_PORT=${DREAM_TEAM_PORT:-3200}            # Real Dream Team Orchestrator
    export CLI_INTEGRATION_PORT=${CLI_INTEGRATION_PORT:-3201}  # CLI Integration Daemon
    export DASHBOARD_PORT=${DASHBOARD_PORT:-3202}              # Monitoring Dashboard HTTP
    export WS_PORT=${WS_PORT:-3203}                            # Monitoring Dashboard WebSocket

    # External Bridge Services (range 8000-8999)
    export CODEX_SERVER_PORT=${CODEX_SERVER_PORT:-8013}        # OpenAI Codex MCP Server
    export ENFORCEMENT_DAEMON_PORT=${ENFORCEMENT_DAEMON_PORT:-8787}  # Claude Code Enforcement

    # Monitoring & Metrics Services (range 9000-9999)
    export DEVFLOW_METRICS_PORT=${DEVFLOW_METRICS_PORT:-9091}  # DevFlow Metrics Collector & Server

    # Set DevFlow defaults
    export DEVFLOW_ENABLED=${DEVFLOW_ENABLED:-true}
    export DEVFLOW_DB_PATH=${DEVFLOW_DB_PATH:-./data/devflow_unified.sqlite}
    export DEVFLOW_AUTO_INJECT=${DEVFLOW_AUTO_INJECT:-true}
    export DEVFLOW_HANDOFF_ENABLED=${DEVFLOW_HANDOFF_ENABLED:-true}
    export DEVFLOW_VERBOSE=${DEVFLOW_VERBOSE:-false}
    export DEVFLOW_PROJECT_ROOT=${DEVFLOW_PROJECT_ROOT:-$(pwd)}

    print_info "Core services - Orchestrator: $ORCHESTRATOR_PORT, Database: $DB_MANAGER_PORT, Project API: $PROJECT_API_PORT, Model Registry: $MODEL_REGISTRY_PORT"
    print_info "Advanced services - Context Bridge: $CONTEXT_BRIDGE_PORT, Vector Memory: $VECTOR_MEMORY_PORT, Enhanced Memory: $ENHANCED_MEMORY_PORT"
    print_info "Orchestration services - Dream Team: $DREAM_TEAM_PORT, CLI Integration: $CLI_INTEGRATION_PORT, Dashboard: $DASHBOARD_PORT/$WS_PORT"
    print_info "Bridge services - Codex Server: $CODEX_SERVER_PORT, Enforcement: $ENFORCEMENT_DAEMON_PORT"
    print_info "Monitoring services - Metrics: $DEVFLOW_METRICS_PORT"
    print_info "DevFlow config - DB: $DEVFLOW_DB_PATH, Project Root: $DEVFLOW_PROJECT_ROOT"
}

# Clean up DevFlow processes and ports
cleanup_services() {
    print_status "🧹 Cleaning up existing DevFlow processes..."

    # Clean up PID files first (including all missing services)
    local pid_files=(".orchestrator.pid" ".database.pid" ".context-bridge.pid" ".vector.pid" ".enhanced-memory.pid" ".enforcement.pid" ".codex.pid" ".embedding-scheduler.pid" ".metrics.pid" ".model-registry.pid" ".cli-integration.pid" ".dream-team.pid" ".progress-tracking.pid" ".project-api.pid" ".monitoring-dashboard.pid")
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

    # Clean up enforcement daemon PID file
    local enforcement_pid_file="$PROJECT_ROOT/devflow-enforcement-daemon.pid"
    if [ -f "$enforcement_pid_file" ]; then
        local pid=$(cat "$enforcement_pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            print_status "Stopping enforcement daemon (PID: $pid)"
            kill -TERM "$pid" 2>/dev/null || true
            sleep 2
            kill -KILL "$pid" 2>/dev/null || true
        fi
        rm -f "$enforcement_pid_file"
    fi

    # Force kill processes by pattern
    pkill -f "unified-orchestrator" 2>/dev/null || true
    pkill -f "database-daemon" 2>/dev/null || true
    pkill -f "context-bridge-service" 2>/dev/null || true
    pkill -f "vector-memory-service" 2>/dev/null || true
    pkill -f "enhanced-memory-service" 2>/dev/null || true
    pkill -f "enforcement-daemon" 2>/dev/null || true
    pkill -f "codex_server" 2>/dev/null || true
    pkill -f "embedding-scheduler-daemon" 2>/dev/null || true
    pkill -f "devflow-metrics-collector" 2>/dev/null || true

    # Clean up ports brutally (all configurable ports from .env)
    local DEVFLOW_PORTS=($ORCHESTRATOR_PORT $DB_MANAGER_PORT $PROJECT_API_PORT $MODEL_REGISTRY_PORT $CONTEXT_BRIDGE_PORT $VECTOR_MEMORY_PORT $ENHANCED_MEMORY_PORT $DREAM_TEAM_PORT $CLI_INTEGRATION_PORT $DASHBOARD_PORT $WS_PORT $CODEX_SERVER_PORT $ENFORCEMENT_DAEMON_PORT $DEVFLOW_METRICS_PORT)

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

# Start Claude Code Enforcement System (daemon-based production system)
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
    if curl -sf --max-time 2 "http://localhost:$ENFORCEMENT_DAEMON_PORT/health" >/dev/null 2>&1; then
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
                if curl -sf --max-time 2 "http://localhost:$ENFORCEMENT_DAEMON_PORT/health" >/dev/null 2>&1; then
                    print_status "Health check passed - daemon is responsive"

                    # Check daemon status via health endpoint
                    local daemon_status=$(curl -s --max-time 2 "http://localhost:$ENFORCEMENT_DAEMON_PORT/health" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "UNKNOWN")
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

# Start Model Registry Daemon (CRITICAL SERVICE)
start_model_registry() {
    print_status "Starting Model Registry Daemon..."

    # Validate dependencies first
    if ! validate_service_dependencies "Model Registry" "database"; then
        print_error "Model Registry dependency validation failed"
        return 1
    fi

    # Check if already running
    if curl -sf --max-time 2 "http://localhost:${MODEL_REGISTRY_PORT}/health" >/dev/null 2>&1; then
        print_status "Model Registry Daemon already running on port $MODEL_REGISTRY_PORT"
        return 0
    fi

    # Check if model registry daemon exists
    if [ ! -f "$PROJECT_ROOT/src/core/services/model-registry-daemon.ts" ]; then
        print_error "Model Registry Daemon not found at src/core/services/model-registry-daemon.ts"
        return 1
    fi

    # Create logs directory
    mkdir -p "$PROJECT_ROOT/logs"

    # Start Model Registry Daemon in background (TypeScript via ts-node)
    print_info "🤖 Starting AI Model Registry with capability tracking..."
    nohup env MODEL_REGISTRY_PORT=$MODEL_REGISTRY_PORT DEVFLOW_DB_PATH="$DEVFLOW_DB_PATH" DEVFLOW_ENABLED="$DEVFLOW_ENABLED" npx ts-node "$PROJECT_ROOT/src/core/services/model-registry-daemon.ts" > "$PROJECT_ROOT/logs/model-registry.log" 2>&1 &
    local registry_pid=$!

    # Give it time to start
    sleep 3

    # Verify it's running with process check
    if ! check_process_health $registry_pid "Model Registry Daemon"; then
        return 1
    fi

    # Enhanced health check validation with AI model availability
    if wait_for_health_check "http://localhost:${MODEL_REGISTRY_PORT}/health" "Model Registry"; then
        echo $registry_pid > "$PROJECT_ROOT/.model-registry.pid"
        print_status "✅ Model Registry Daemon started (PID: $registry_pid, Port: $MODEL_REGISTRY_PORT)"

        # Check AI model availability and capabilities
        local models_health=$(curl -s --max-time 3 "http://localhost:${MODEL_REGISTRY_PORT}/models" 2>/dev/null || echo '{"models": []}')
        local model_count=$(echo "$models_health" | grep -o '"models":\[.*\]' | grep -o ',' | wc -l 2>/dev/null || echo "0")
        model_count=$((model_count + 1))

        if [ "$model_count" -gt 1 ]; then
            print_status "✅ AI Model Registry: $model_count models registered with capability tracking"
        else
            print_warning "⚠️  AI Model Registry: Started but no models registered yet"
        fi
        return 0
    else
        print_error "Model Registry health check failed"
        return 1
    fi
}

# Start CLI Integration Daemon (CRITICAL SERVICE)
start_cli_integration() {
    print_status "Starting CLI Integration Daemon..."

    # Validate dependencies first
    if ! validate_service_dependencies "CLI Integration" "orchestrator"; then
        print_error "CLI Integration dependency validation failed"
        return 1
    fi

    # Check if already running
    if curl -sf --max-time 2 "http://localhost:${CLI_INTEGRATION_PORT}/health" >/dev/null 2>&1; then
        print_status "CLI Integration Daemon already running on port $CLI_INTEGRATION_PORT"
        return 0
    fi

    # Check if CLI integration daemon exists
    if [ ! -f "$PROJECT_ROOT/src/core/mcp/cli-integration-daemon.ts" ]; then
        print_error "CLI Integration Daemon not found at src/core/mcp/cli-integration-daemon.ts"
        return 1
    fi

    # Create logs directory
    mkdir -p "$PROJECT_ROOT/logs"

    # Start CLI Integration Daemon in background (TypeScript via ts-node)
    print_info "🔧 Starting CLI Integration with MCP connectivity..."
    nohup env CLI_INTEGRATION_PORT=$CLI_INTEGRATION_PORT DEVFLOW_DB_PATH="$DEVFLOW_DB_PATH" DEVFLOW_ENABLED="$DEVFLOW_ENABLED" ORCHESTRATOR_URL="http://localhost:$ORCHESTRATOR_PORT" npx ts-node "$PROJECT_ROOT/src/core/mcp/cli-integration-daemon.ts" > "$PROJECT_ROOT/logs/cli-integration.log" 2>&1 &
    local cli_pid=$!

    # Give it time to start
    sleep 3

    # Verify it's running with process check
    if ! check_process_health $cli_pid "CLI Integration Daemon"; then
        return 1
    fi

    # Enhanced health check validation with MCP connectivity
    if wait_for_health_check "http://localhost:${CLI_INTEGRATION_PORT}/health" "CLI Integration"; then
        echo $cli_pid > "$PROJECT_ROOT/.cli-integration.pid"
        print_status "✅ CLI Integration Daemon started (PID: $cli_pid, Port: $CLI_INTEGRATION_PORT)"

        # Check MCP connectivity and command execution capabilities
        local mcp_health=$(curl -s --max-time 3 "http://localhost:${CLI_INTEGRATION_PORT}/mcp/status" 2>/dev/null || echo '{"status": "unknown"}')
        local mcp_status=$(echo "$mcp_health" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "unknown")

        if [ "$mcp_status" = "connected" ] || [ "$mcp_status" = "ready" ]; then
            print_status "✅ MCP Integration: Command execution ready (Status: $mcp_status)"
        else
            print_warning "⚠️  MCP Integration: Started but connectivity status unclear ($mcp_status)"
        fi
        return 0
    else
        print_error "CLI Integration health check failed"
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

# Start Context Bridge Service
start_context_bridge() {
    print_status "Starting Context Bridge Service (Enhanced Embedding)..."

    # Check if already running
    if curl -sf --max-time 2 "http://localhost:${CONTEXT_BRIDGE_PORT}/health" >/dev/null 2>&1; then
        print_status "Context Bridge Service already running on port $CONTEXT_BRIDGE_PORT"
        return 0
    fi

    # Check if context bridge service exists
    if [ ! -f "$PROJECT_ROOT/src/services/context-bridge/start-context-bridge.ts" ]; then
        print_error "Context Bridge Service not found at src/services/context-bridge/start-context-bridge.ts"
        return 1
    fi

    # Create logs directory
    mkdir -p "$PROJECT_ROOT/logs"

    # Start Context Bridge Service in background (TypeScript via ts-node)
    nohup env CONTEXT_BRIDGE_PORT=$CONTEXT_BRIDGE_PORT DEVFLOW_DB_PATH="$DEVFLOW_DB_PATH" DEVFLOW_ENABLED="$DEVFLOW_ENABLED" npx ts-node "$PROJECT_ROOT/src/services/context-bridge/start-context-bridge.ts" > "$PROJECT_ROOT/logs/context-bridge.log" 2>&1 &
    local bridge_pid=$!

    # Give it time to start
    sleep 3

    # Verify it's running
    if kill -0 $bridge_pid 2>/dev/null; then
        # Health check validation
        local health_attempts=0
        while [ $health_attempts -lt 10 ]; do
            if curl -sf --max-time 2 "http://localhost:${CONTEXT_BRIDGE_PORT}/health" >/dev/null 2>&1; then
                echo $bridge_pid > "$PROJECT_ROOT/.context-bridge.pid"
                print_status "✅ Context Bridge Service started (PID: $bridge_pid, Port: $CONTEXT_BRIDGE_PORT)"
                return 0
            fi
            sleep 2
            health_attempts=$((health_attempts + 1))
        done

        print_error "Context Bridge Service started but health check failed"
        return 1
    else
        print_error "Failed to start Context Bridge Service"
        return 1
    fi
}

# Verify Enhanced Memory System Health
verify_enhanced_memory() {
    print_status "Verifying Enhanced Memory System..."

    # Check if memory bridge runner exists
    if [ ! -f "$PROJECT_ROOT/scripts/memory-bridge-runner.js" ]; then
        print_warning "Enhanced Memory bridge not found - memory features will be limited"
        return 1
    fi

    # Check if enhanced memory integration hook exists
    if [ ! -f "$PROJECT_ROOT/.claude/hooks/enhanced-memory-integration.py" ]; then
        print_warning "Enhanced Memory integration hook not found - hook-based features disabled"
        return 1
    fi

    # Test Node.js bridge health
    if command_exists node; then
        local health_result=$(node "$PROJECT_ROOT/scripts/memory-bridge-runner.js" health-check 2>/dev/null || echo '{"success":false}')
        local health_status=$(echo "$health_result" | grep -o '"success":[^,}]*' | cut -d':' -f2 | tr -d ' "')

        if [ "$health_status" = "true" ]; then
            print_status "✅ Enhanced Memory System: All components healthy"

            # Check Ollama embeddinggemma availability
            if curl -sf --max-time 3 "http://localhost:11434/api/tags" >/dev/null 2>&1; then
                local models=$(curl -s "http://localhost:11434/api/tags" 2>/dev/null | grep -o '"name":"embeddinggemma:300m"' || echo "")
                if [ -n "$models" ]; then
                    print_status "✅ Enhanced Memory: Ollama embeddinggemma:300m available"
                else
                    print_warning "⚠️  Enhanced Memory: embeddinggemma:300m model not found in Ollama"
                fi
            else
                print_warning "⚠️  Enhanced Memory: Ollama service not available"
            fi
        else
            print_warning "⚠️  Enhanced Memory System: Health check failed"
            return 1
        fi
    else
        print_warning "Node.js not available - Enhanced Memory bridge disabled"
        return 1
    fi

    return 0
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

    # Start orchestrator in background using the built server.js directly
    nohup env ORCHESTRATOR_PORT=$ORCHESTRATOR_PORT DEVFLOW_DB_PATH="$DEVFLOW_DB_PATH" DEVFLOW_ENABLED="$DEVFLOW_ENABLED" node "$PROJECT_ROOT/packages/orchestrator/unified/dist/server.js" > "$PROJECT_ROOT/logs/unified-orchestrator.log" 2>&1 &
    local orchestrator_pid=$!

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

# Start DevFlow Metrics Collector & Server (Native Monitoring Solution)
start_metrics_server() {
    print_status "Starting DevFlow Metrics Collector & Server..."

    # Check if already running
    if curl -sf --max-time 2 "http://localhost:${DEVFLOW_METRICS_PORT}/health" >/dev/null 2>&1; then
        print_status "DevFlow Metrics Server already running on port $DEVFLOW_METRICS_PORT"
        return 0
    fi

    # Check if metrics server exists
    if [ ! -f "$PROJECT_ROOT/src/monitoring/index.js" ]; then
        print_warning "DevFlow Metrics Server not found at src/monitoring/index.js - skipping monitoring"
        return 0
    fi

    # Create logs directory
    mkdir -p "$PROJECT_ROOT/logs"

    # Start metrics server in background
    nohup env DEVFLOW_METRICS_PORT=$DEVFLOW_METRICS_PORT DEVFLOW_DB_PATH="$DEVFLOW_DB_PATH" ORCHESTRATOR_URL="http://localhost:$ORCHESTRATOR_PORT" node "$PROJECT_ROOT/src/monitoring/index.js" start > "$PROJECT_ROOT/logs/devflow-metrics.log" 2>&1 &
    local metrics_pid=$!

    # Give it time to start
    sleep 3

    # Verify it's running
    if kill -0 $metrics_pid 2>/dev/null; then
        # Health check validation
        local health_attempts=0
        while [ $health_attempts -lt 10 ]; do
            if curl -sf --max-time 2 "http://localhost:${DEVFLOW_METRICS_PORT}/health" >/dev/null 2>&1; then
                echo $metrics_pid > "$PROJECT_ROOT/.metrics.pid"
                print_status "✅ DevFlow Metrics Server started (PID: $metrics_pid, Port: $DEVFLOW_METRICS_PORT)"

                # Brief metrics check
                local metrics_data=$(curl -s --max-time 2 "http://localhost:${DEVFLOW_METRICS_PORT}/json" 2>/dev/null | grep -o '"qualityScore":[0-9.]*' | cut -d':' -f2 || echo "0")
                if [ -n "$metrics_data" ] && [ "$metrics_data" != "0" ]; then
                    print_status "✅ Context7 quality metrics available: ${metrics_data}"
                fi
                return 0
            fi
            sleep 2
            health_attempts=$((health_attempts + 1))
        done

        print_error "Metrics Server started but health check failed"
        return 1
    else
        print_error "Failed to start DevFlow Metrics Server"
        return 1
    fi
}

# Start APScheduler Embedding Background Daemon (Context7 Robust Solution)
start_embedding_scheduler() {
    print_status "Starting APScheduler Embedding Background Daemon (Context7 Solution)..."

    # Check if APScheduler daemon exists
    if [ ! -f "$PROJECT_ROOT/.claude/hooks/apscheduler-embedding-daemon.py" ]; then
        print_warning "APScheduler embedding daemon not found - skipping background embedding processing"
        return 0
    fi

    # Check if Python 3 is available
    if ! command_exists python3; then
        print_warning "Python 3 not available - skipping embedding scheduler"
        return 0
    fi

    # Check if APScheduler is installed
    if ! python3 -c "import apscheduler" 2>/dev/null; then
        print_warning "APScheduler not installed - attempting installation..."
        if ! pip3 install --break-system-packages apscheduler 2>/dev/null; then
            print_error "Failed to install APScheduler - skipping embedding scheduler"
            return 0
        fi
        print_status "✅ APScheduler installed successfully"
    fi

    # Check if already running via process check
    if pgrep -f "apscheduler-embedding-daemon" >/dev/null 2>&1; then
        print_status "APScheduler embedding daemon already running"
        return 0
    fi

    # Create logs directory
    mkdir -p "$PROJECT_ROOT/logs"

    # Start APScheduler embedding daemon in background
    nohup python3 "$PROJECT_ROOT/.claude/hooks/apscheduler-embedding-daemon.py" --daemon > "$PROJECT_ROOT/logs/apscheduler-embedding.log" 2>&1 &
    local scheduler_pid=$!

    # Give it time to start
    sleep 5

    # Verify it's running
    if kill -0 $scheduler_pid 2>/dev/null; then
        echo $scheduler_pid > "$PROJECT_ROOT/.embedding-scheduler.pid"
        print_status "✅ APScheduler Embedding Daemon started (PID: $scheduler_pid)"

        # Brief status check
        sleep 3
        local daemon_status=$(python3 "$PROJECT_ROOT/.claude/hooks/apscheduler-embedding-daemon.py" --status 2>/dev/null | grep '"daemon_running"' | grep -o 'true\|false' || echo "unknown")
        if [ "$daemon_status" = "true" ]; then
            print_status "✅ APScheduler daemon operational - persistent 30-second interval processing enabled"
            print_status "✅ Context7 BackgroundScheduler solution - robust threading and auto-recovery"
        else
            print_warning "⚠️  APScheduler daemon started but status check unclear"
        fi
        return 0
    else
        print_error "Failed to start APScheduler Embedding Daemon"
        return 1
    fi
}

# Start Codex Server
start_codex_server() {
    print_status "Starting Codex MCP Server..."

    # Check if already running
    if curl -sf --max-time 2 "http://localhost:${CODEX_SERVER_PORT}/health" >/dev/null 2>&1; then
        print_status "Codex Server already running on port $CODEX_SERVER_PORT"
        return 0
    fi

    # Check if Codex server directory exists
    local codex_dir="/tmp/openai-codex-mcp"
    if [ ! -d "$codex_dir" ]; then
        print_error "Codex MCP server directory not found at $codex_dir"
        return 1
    fi

    # Check if virtual environment exists
    if [ ! -d "$codex_dir/.venv" ]; then
        print_error "Codex server virtual environment not found at $codex_dir/.venv"
        return 1
    fi

    # Create logs directory
    mkdir -p "$PROJECT_ROOT/logs"

    # Start Codex server in background
    cd "$codex_dir"
    nohup env PORT=$CODEX_SERVER_PORT .venv/bin/python codex_server.py > "$PROJECT_ROOT/logs/codex-server.log" 2>&1 &
    local codex_pid=$!
    cd "$PROJECT_ROOT"

    # Give it time to start
    sleep 3

    # Verify it's running
    if kill -0 $codex_pid 2>/dev/null; then
        # Health check validation
        local health_attempts=0
        while [ $health_attempts -lt 10 ]; do
            if curl -sf --max-time 2 "http://localhost:${CODEX_SERVER_PORT}/health" >/dev/null 2>&1; then
                echo $codex_pid > "$PROJECT_ROOT/.codex.pid"
                print_status "✅ Codex Server started (PID: $codex_pid, Port: $CODEX_SERVER_PORT)"
                return 0
            fi
            sleep 2
            health_attempts=$((health_attempts + 1))
        done

        print_error "Codex Server started but health check failed"
        return 1
    else
        print_error "Failed to start Codex Server"
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

    # Phase 1: Infrastructure Services (CRITICAL)
    print_status "📦 Phase 1: Starting Infrastructure Services..."

    # Start Database Manager (infrastructure first)
    if ! start_database; then
        print_error "Failed to start Database Manager - CRITICAL ERROR"
        return 1
    fi

    # Start Model Registry Daemon (depends on database - CRITICAL for AI functionality)
    if ! start_model_registry; then
        print_error "Failed to start Model Registry Daemon - CRITICAL ERROR"
        print_error "AI model management functionality will be unavailable"
        return 1
    fi

    # Start Vector Memory Service (depends on database)
    if ! start_vector; then
        print_error "Failed to start Vector Memory Service - CRITICAL ERROR"
        return 1
    fi

    # Start Context Bridge Service (enhanced embedding with embeddinggemma)
    if ! start_context_bridge; then
        print_warning "Context Bridge Service failed to start - CONTINUING WITHOUT ENHANCED CONTEXT"
        print_warning "Enhanced context injection with embeddinggemma will not be available"
    fi

    # Verify Enhanced Memory System (Phase 1-3 semantic memory)
    if ! verify_enhanced_memory; then
        print_warning "Enhanced Memory System verification failed - CONTINUING WITH BASIC MEMORY"
        print_warning "Semantic memory features may be limited"
    fi

    # Phase 2: Core Orchestration Services (CRITICAL)
    print_status "🎯 Phase 2: Starting Core Orchestration Services..."

    # Start Unified Orchestrator (orchestrates other services)
    if ! start_unified_orchestrator; then
        print_error "Failed to start Unified Orchestrator - CRITICAL ERROR"
        return 1
    fi

    # Start CLI Integration Daemon (depends on orchestrator - CRITICAL for MCP functionality)
    if ! start_cli_integration; then
        print_error "Failed to start CLI Integration Daemon - CRITICAL ERROR"
        print_error "MCP command execution functionality will be unavailable"
        return 1
    fi

    # Start Codex Server (MCP integration for OpenAI Codex)
    if ! start_codex_server; then
        print_warning "Codex Server failed to start - CONTINUING WITHOUT CODEX"
        print_warning "OpenAI Codex MCP integration will not be available"
    fi

    # Start Enforcement System (critical for 100-line code limit enforcement)
    if ! start_enforcement; then
        print_warning "Claude Code Enforcement System failed to start - CONTINUING WITHOUT ENFORCEMENT"
        print_warning "100-line code limit enforcement will not be active"
    fi

    # Start Embedding Background Scheduler (automatic queue processing)
    if ! start_embedding_scheduler; then
        print_warning "Embedding Background Scheduler failed to start - CONTINUING WITHOUT AUTO-EMBEDDING"
        print_warning "Automatic embedding queue processing will not be active"
    fi

    # Phase 3: Monitoring and Support Services (OPTIONAL)
    print_status "📊 Phase 3: Starting Monitoring and Support Services..."

    # Start DevFlow Metrics Server (performance monitoring and Context7 quality tracking)
    if ! start_metrics_server; then
        print_warning "DevFlow Metrics Server failed to start - CONTINUING WITHOUT MONITORING"
        print_warning "Context7 quality tracking and performance metrics will not be available"
    fi

    print_status "🎉 DevFlow Unified System v1.0 Started Successfully!"
    print_status "✅ Database Manager: Running on port $DB_MANAGER_PORT"
    print_status "✅ Model Registry: Running on port $MODEL_REGISTRY_PORT"
    print_status "✅ Vector Memory: Running on port $VECTOR_MEMORY_PORT"
    print_status "✅ Unified Orchestrator: Running on port $ORCHESTRATOR_PORT"
    print_status "✅ CLI Integration: Running on port $CLI_INTEGRATION_PORT"

    # Check Context Bridge Service status
    if curl -sf --max-time 2 "http://localhost:$CONTEXT_BRIDGE_PORT/health" >/dev/null 2>&1; then
        print_status "✅ Context Bridge: Running on port $CONTEXT_BRIDGE_PORT (Enhanced embedding with embeddinggemma)"
    else
        print_warning "⚠️  Context Bridge: Not Running - Enhanced context injection disabled"
    fi

    # Check Codex Server status
    if curl -sf --max-time 2 "http://localhost:$CODEX_SERVER_PORT/health" >/dev/null 2>&1; then
        print_status "✅ Codex Server: Running on port $CODEX_SERVER_PORT"
    else
        print_warning "⚠️  Codex Server: Not Running - OpenAI Codex MCP integration disabled"
    fi

    # Check enforcement status
    if curl -sf --max-time 2 "http://localhost:$ENFORCEMENT_DAEMON_PORT/health" >/dev/null 2>&1; then
        local enforcement_status=$(curl -s --max-time 2 "http://localhost:$ENFORCEMENT_DAEMON_PORT/health" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "UNKNOWN")
        print_status "✅ Enforcement Daemon: Running (Status: $enforcement_status, Port: $ENFORCEMENT_DAEMON_PORT)"
    else
        print_warning "⚠️  Enforcement Daemon: Not Running - 100-line limit enforcement disabled"
    fi

    # Check embedding scheduler status
    if pgrep -f "embedding-scheduler-daemon" >/dev/null 2>&1; then
        local scheduler_running=$(python3 "$PROJECT_ROOT/.claude/hooks/embedding-background-scheduler.py" --status 2>/dev/null | grep '"scheduler_running"' | grep -o 'true\|false' || echo "unknown")
        local pending_entries=$(python3 "$PROJECT_ROOT/.claude/hooks/embedding-background-scheduler.py" --status 2>/dev/null | grep '"pending_entries"' | grep -o '[0-9]*' || echo "unknown")
        print_status "✅ Embedding Scheduler: Running (Active: $scheduler_running, Queue: $pending_entries entries)"
    else
        print_warning "⚠️  Embedding Scheduler: Not Running - automatic embedding processing disabled"
    fi

    # Check metrics server status
    if curl -sf --max-time 2 "http://localhost:$DEVFLOW_METRICS_PORT/health" >/dev/null 2>&1; then
        local metrics_health=$(curl -s --max-time 2 "http://localhost:$DEVFLOW_METRICS_PORT/json" 2>/dev/null)
        local context7_quality=$(echo "$metrics_health" | grep -o '"qualityScore":[0-9.]*' | cut -d':' -f2 || echo "unknown")
        print_status "✅ DevFlow Metrics: Running on port $DEVFLOW_METRICS_PORT (Context7 Quality: ${context7_quality})"
    else
        print_warning "⚠️  DevFlow Metrics: Not Running - Performance monitoring disabled"
    fi

    print_status "📊 Health: http://localhost:$ORCHESTRATOR_PORT/health"
    print_status "🎛️  Mode: http://localhost:$ORCHESTRATOR_PORT/api/mode"
    print_status "📈 Orchestrator Metrics: http://localhost:$ORCHESTRATOR_PORT/api/metrics"
    print_status "📊 DevFlow Metrics: http://localhost:$DEVFLOW_METRICS_PORT/metrics (Prometheus)"
    print_status "🧠 Context Bridge: http://localhost:$CONTEXT_BRIDGE_PORT/health"
    print_status "🔧 Enforcement: http://localhost:$ENFORCEMENT_DAEMON_PORT/health"

    # Check Enhanced Memory System status
    if verify_enhanced_memory >/dev/null 2>&1; then
        print_status "✅ Enhanced Memory: Semantic memory system operational (Phase 1-3)"
    else
        print_warning "⚠️  Enhanced Memory: System verification failed - check Ollama and components"
    fi

    print_status "🔄 System ready for task orchestration with enhanced context injection, semantic memory, automatic embedding processing, and real-time monitoring"
    print_status "📊 DevFlow Metrics: Context7 quality tracking, task performance monitoring, and Prometheus-compatible metrics"
    print_status "🎯 Full Mode Readiness: Quality threshold 75% for Context7 Full Mode transition"

    return 0
}

# Start Claude Code with environment variables
start_claude_code() {
    print_status "Starting Claude Code with DevFlow environment..."

    # Verify critical variables are loaded
    if [ -z "$CONTEXT7_API_KEY" ]; then
        print_warning "CONTEXT7_API_KEY not found - Context7 integration may not work"
    fi

    if [ -z "$SYNTHETIC_API_KEY" ]; then
        print_warning "SYNTHETIC_API_KEY not found - Synthetic integration may not work"
    fi

    print_info "Environment variables loaded for Claude Code:"
    print_info "  CONTEXT7_API_KEY: ${CONTEXT7_API_KEY:0:10}..."
    print_info "  SYNTHETIC_API_KEY: ${SYNTHETIC_API_KEY:0:10}..."
    print_info "  GITHUB_PERSONAL_ACCESS_TOKEN: ${GITHUB_PERSONAL_ACCESS_TOKEN:0:10}..."

    # Start Claude Code with environment variables inherited
    print_status "🚀 Launching Claude Code..."
    exec claude "$@"
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

    # Check Model Registry Daemon (CRITICAL)
    if curl -sf --max-time 2 "http://localhost:${MODEL_REGISTRY_PORT}/health" >/dev/null 2>&1; then
        local registry_health=$(curl -s "http://localhost:${MODEL_REGISTRY_PORT}/health" 2>/dev/null)
        local registry_status=$(echo "$registry_health" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        print_status "✅ Model Registry: Running (Status: $registry_status, Port: $MODEL_REGISTRY_PORT)"
    else
        print_status "❌ Model Registry: Stopped - AI model management disabled"
    fi

    # Check Vector Memory Service
    if netstat -an 2>/dev/null | grep -q "${VECTOR_MEMORY_PORT}.*LISTEN"; then
        print_status "✅ Vector Memory: Running (Port: $VECTOR_MEMORY_PORT)"
    else
        print_status "❌ Vector Memory: Stopped"
    fi

    # Check Context Bridge Service
    if curl -sf --max-time 2 "http://localhost:${CONTEXT_BRIDGE_PORT}/health" >/dev/null 2>&1; then
        local bridge_health=$(curl -s "http://localhost:${CONTEXT_BRIDGE_PORT}/health" 2>/dev/null)
        local bridge_status=$(echo "$bridge_health" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        print_status "✅ Context Bridge: Running (Status: $bridge_status, Port: $CONTEXT_BRIDGE_PORT)"
    else
        print_status "❌ Context Bridge: Stopped - Enhanced context injection disabled"
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

    # Check CLI Integration Daemon (CRITICAL)
    if curl -sf --max-time 2 "http://localhost:${CLI_INTEGRATION_PORT}/health" >/dev/null 2>&1; then
        local cli_health=$(curl -s "http://localhost:${CLI_INTEGRATION_PORT}/health" 2>/dev/null)
        local cli_status=$(echo "$cli_health" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        print_status "✅ CLI Integration: Running (Status: $cli_status, Port: $CLI_INTEGRATION_PORT)"
    else
        print_status "❌ CLI Integration: Stopped - MCP command execution disabled"
    fi

    # Check Codex Server
    if curl -sf --max-time 2 "http://localhost:${CODEX_SERVER_PORT}/health" >/dev/null 2>&1; then
        print_status "✅ Codex Server: Running (Port: $CODEX_SERVER_PORT)"
    else
        print_status "❌ Codex Server: Stopped"
    fi

    # Check Enforcement Daemon
    if curl -sf --max-time 2 "http://localhost:$ENFORCEMENT_DAEMON_PORT/health" >/dev/null 2>&1; then
        local enforcement_health=$(curl -s --max-time 2 "http://localhost:$ENFORCEMENT_DAEMON_PORT/health" 2>/dev/null)
        local enforcement_status=$(echo "$enforcement_health" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "UNKNOWN")
        print_status "✅ Enforcement Daemon: Running (Status: $enforcement_status, Port: $ENFORCEMENT_DAEMON_PORT)"
    else
        print_status "❌ Enforcement Daemon: Stopped - 100-line limit enforcement disabled"
    fi

    # Check Embedding Background Scheduler
    if pgrep -f "embedding-scheduler-daemon" >/dev/null 2>&1; then
        local scheduler_status=$(python3 "$PROJECT_ROOT/.claude/hooks/embedding-background-scheduler.py" --status 2>/dev/null | grep '"scheduler_running"' | grep -o 'true\|false' || echo "unknown")
        local queue_size=$(python3 "$PROJECT_ROOT/.claude/hooks/embedding-background-scheduler.py" --status 2>/dev/null | grep '"pending_entries"' | grep -o '[0-9]*' || echo "0")
        print_status "✅ Embedding Scheduler: Running (Active: $scheduler_status, Queue: $queue_size entries)"
    else
        print_status "❌ Embedding Scheduler: Stopped - automatic embedding processing disabled"
    fi

    # Check DevFlow Metrics Server
    if curl -sf --max-time 2 "http://localhost:$DEVFLOW_METRICS_PORT/health" >/dev/null 2>&1; then
        local metrics_health=$(curl -s --max-time 2 "http://localhost:$DEVFLOW_METRICS_PORT/json" 2>/dev/null)
        local context7_quality=$(echo "$metrics_health" | grep -o '"qualityScore":[0-9.]*' | cut -d':' -f2 || echo "unknown")
        local total_tasks=$(echo "$metrics_health" | grep -o '"total":[0-9]*' | cut -d':' -f2 | head -1 || echo "unknown")
        print_status "✅ DevFlow Metrics: Running (Port: $DEVFLOW_METRICS_PORT, Context7: ${context7_quality}, Tasks: ${total_tasks})"
    else
        print_status "❌ DevFlow Metrics: Stopped - Performance monitoring disabled"
    fi

    # Check Enhanced Memory System
    if verify_enhanced_memory >/dev/null 2>&1; then
        print_status "✅ Enhanced Memory: Semantic memory system operational (Ollama + Phase 1-3)"
    else
        print_status "❌ Enhanced Memory: System not operational - check Ollama and components"
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
        claude)
            load_environment
            set_defaults
            start_claude_code
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
            echo "  claude   - Launch Claude Code with DevFlow environment variables"
            echo "  help     - Show this help message"
            echo ""
            echo "Services included:"
            echo "  • Database Manager (SQLite unified database)"
            echo "  • Vector Memory Service (embedding storage)"
            echo "  • Context Bridge Service (enhanced context injection)"
            echo "  • Unified Orchestrator (task coordination)"
            echo "  • Codex Server (OpenAI integration)"
            echo "  • Enforcement Daemon (100-line limit)"
            echo "  • Embedding Scheduler (background processing)"
            echo "  • Metrics Server (Context7 quality & performance monitoring)"
            echo ""
            echo "Architecture: Unified Orchestrator v1.0 + Native Monitoring"
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