#!/bin/bash
# devflow-start.sh v3.1.0
# Production deployment script for DevFlow Cometa Platform
# Integrates Real Dream Team Orchestrator components

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="/var/run/devflow"
LOG_DIR="/var/log/devflow"
CONFIG_DIR="/etc/devflow"

# Ensure directories exist
mkdir -p "$PID_DIR" "$LOG_DIR" "$CONFIG_DIR"

# Service names
SERVICES=(
    "api-server"
    "auth-service"
    "database-proxy"
    "message-queue"
    "cache-manager"
    "file-storage"
    "notification-engine"
    "analytics-processor"
    "search-indexer"
    "task-scheduler"
    "web-frontend"
    "monitoring-agent"
    "real-dream-team-orchestrator"
    "cli-integration-manager"
    "platform-status-tracker"
)

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') [${1}] ${2}"
}

log_info() {
    log "${BLUE}INFO${NC}" "$1"
}

log_success() {
    log "${GREEN}SUCCESS${NC}" "$1"
}

log_warning() {
    log "${YELLOW}WARNING${NC}" "$1"
}

log_error() {
    log "${RED}ERROR${NC}" "$1"
}

# Health check function
health_check() {
    local service_name=$1
    local port=$2
    local timeout=${3:-5}
    
    if command -v nc >/dev/null 2>&1; then
        if nc -z localhost "$port" -w"$timeout" 2>/dev/null; then
            return 0
        fi
    elif command -v curl >/dev/null 2>&1; then
        if curl -s --connect-timeout "$timeout" "http://localhost:$port/health" >/dev/null 2>&1; then
            return 0
        fi
    else
        log_warning "Neither nc nor curl available for health checks"
        return 1
    fi
    
    return 1
}

# Start Real Dream Team Orchestrator
start_real_orchestrator() {
    log_info "Starting Real Dream Team Orchestrator..."
    
    local pid_file="$PID_DIR/real-dream-team-orchestrator.pid"
    local log_file="$LOG_DIR/real-dream-team-orchestrator.log"
    
    if [[ -f "$pid_file" ]]; then
        local pid
        pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            log_warning "Real Dream Team Orchestrator is already running (PID: $pid)"
            return 0
        else
            rm -f "$pid_file"
        fi
    fi
    
    # Start the orchestrator service
    nohup node "$SCRIPT_DIR/src/core/orchestration/real-dream-team-orchestrator.js" \
        --config "$CONFIG_DIR/orchestrator.conf" \
        >>"$log_file" 2>&1 &
    
    local orchestrator_pid=$!
    echo "$orchestrator_pid" > "$pid_file"
    
    # Wait for service to be ready
    local retries=30
    local retry_count=0
    
    while [[ $retry_count -lt $retries ]]; do
        if health_check "real-dream-team-orchestrator" 8080 2; then
            log_success "Real Dream Team Orchestrator started successfully (PID: $orchestrator_pid)"
            return 0
        fi
        sleep 1
        ((retry_count++))
    done
    
    log_error "Failed to start Real Dream Team Orchestrator"
    return 1
}

# Start CLI MCP Integration Manager
start_cli_integration() {
    log_info "Starting CLI MCP Integration Manager..."
    
    local pid_file="$PID_DIR/cli-integration-manager.pid"
    local log_file="$LOG_DIR/cli-integration-manager.log"
    
    if [[ -f "$pid_file" ]]; then
        local pid
        pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            log_warning "CLI MCP Integration Manager is already running (PID: $pid)"
            return 0
        else
            rm -f "$pid_file"
        fi
    fi
    
    # Start the CLI integration service
    nohup node "$SCRIPT_DIR/src/core/mcp/cli-integration-manager.js" \
        --config "$CONFIG_DIR/cli-manager.conf" \
        >>"$log_file" 2>&1 &
    
    local cli_pid=$!
    echo "$cli_pid" > "$pid_file"
    
    # Wait for service to be ready
    local retries=30
    local retry_count=0
    
    while [[ $retry_count -lt $retries ]]; do
        if health_check "cli-integration-manager" 8081 2; then
            log_success "CLI MCP Integration Manager started successfully (PID: $cli_pid)"
            return 0
        fi
        sleep 1
        ((retry_count++))
    done
    
    log_error "Failed to start CLI MCP Integration Manager"
    return 1
}

# Start Platform Status Tracker
start_status_tracker() {
    log_info "Starting Platform Status Tracker..."
    
    local pid_file="$PID_DIR/platform-status-tracker.pid"
    local log_file="$LOG_DIR/platform-status-tracker.log"
    
    if [[ -f "$pid_file" ]]; then
        local pid
        pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            log_warning "Platform Status Tracker is already running (PID: $pid)"
            return 0
        else
            rm -f "$pid_file"
        fi
    fi
    
    # Start the status tracker service
    nohup node "$SCRIPT_DIR/src/core/ui/platform-status-tracker.js" \
        --config "$CONFIG_DIR/status-tracker.conf" \
        >>"$log_file" 2>&1 &
    
    local tracker_pid=$!
    echo "$tracker_pid" > "$pid_file"
    
    # Wait for service to be ready
    local retries=30
    local retry_count=0
    
    while [[ $retry_count -lt $retries ]]; do
        if health_check "platform-status-tracker" 8082 2; then
            log_success "Platform Status Tracker started successfully (PID: $tracker_pid)"
            return 0
        fi
        sleep 1
        ((retry_count++))
    done
    
    log_error "Failed to start Platform Status Tracker"
    return 1
}

# Start all services
start_services() {
    log_info "Starting DevFlow Cometa Platform services..."
    
    # Start existing services (simplified for example)
    for service in "${SERVICES[@]:0:12}"; do
        log_info "Starting $service..."
        # Implementation would depend on existing service startup logic
        # This is a placeholder for existing functionality
        touch "$PID_DIR/$service.pid"
    done
    
    # Start new Real Dream Team Orchestrator components
    start_real_orchestrator || log_error "Failed to start Real Dream Team Orchestrator"
    start_cli_integration || log_error "Failed to start CLI MCP Integration Manager"
    start_status_tracker || log_error "Failed to start Platform Status Tracker"
    
    log_success "Service startup process completed"
}

# Stop all services with graceful shutdown
stop_services() {
    log_info "Stopping DevFlow Cometa Platform services..."
    
    # Stop new services first
    local new_services=("real-dream-team-orchestrator" "cli-integration-manager" "platform-status-tracker")
    
    for service in "${new_services[@]}"; do
        local pid_file="$PID_DIR/$service.pid"
        
        if [[ -f "$pid_file" ]]; then
            local pid
            pid=$(cat "$pid_file")
            
            if kill -0 "$pid" 2>/dev/null; then
                log_info "Stopping $service (PID: $pid)..."
                
                # Try graceful shutdown first
                kill -TERM "$pid" 2>/dev/null || true
                
                # Wait for graceful shutdown
                local retries=30
                local retry_count=0
                
                while [[ $retry_count -lt $retries ]] && kill -0 "$pid" 2>/dev/null; do
                    sleep 1
                    ((retry_count++))
                done
                
                # Force kill if still running
                if kill -0 "$pid" 2>/dev/null; then
                    log_warning "Force killing $service (PID: $pid)"
                    kill -KILL "$pid" 2>/dev/null || true
                fi
            fi
            
            rm -f "$pid_file"
            log_success "Stopped $service"
        else
            log_warning "$service is not running (no PID file found)"
        fi
    done
    
    # Stop existing services
    for service in "${SERVICES[@]:0:12}"; do
        local pid_file="$PID_DIR/$service.pid"
        
        if [[ -f "$pid_file" ]]; then
            local pid
            pid=$(cat "$pid_file")
            
            if kill -0 "$pid" 2>/dev/null; then
                log_info "Stopping $service (PID: $pid)..."
                kill -TERM "$pid" 2>/dev/null || true
                
                # Wait for graceful shutdown
                local retries=30
                local retry_count=0
                
                while [[ $retry_count -lt $retries ]] && kill -0 "$pid" 2>/dev/null; do
                    sleep 1
                    ((retry_count++))
                done
                
                # Force kill if still running
                if kill -0 "$pid" 2>/dev/null; then
                    log_warning "Force killing $service (PID: $pid)"
                    kill -KILL "$pid" 2>/dev/null || true
                fi
            fi
            
            rm -f "$pid_file"
            log_success "Stopped $service"
        else
            log_warning "$service is not running (no PID file found)"
        fi
    done
    
    log_success "All services stopped"
}

# Check service status
status_services() {
    log_info "DevFlow Cometa Platform Service Status:"
    echo "----------------------------------------"
    
    local all_services_running=true
    
    for service in "${SERVICES[@]}"; do
        local pid_file="$PID_DIR/$service.pid"
        local status="UNKNOWN"
        local pid=""
        
        if [[ -f "$pid_file" ]]; then
            pid=$(cat "$pid_file")
            if kill -0 "$pid" 2>/dev/null; then
                status="${GREEN}RUNNING${NC} (PID: $pid)"
            else
                status="${RED}STOPPED${NC} (PID file exists but process not running)"
                all_services_running=false
            fi
        else
            status="${RED}STOPPED${NC} (No PID file)"
            all_services_running=false
        fi
        
        printf "%-30s: %b\n" "$service" "$status"
    done
    
    echo "----------------------------------------"
    
    if $all_services_running; then
        log_success "All services are running"
        return 0
    else
        log_warning "Some services are not running"
        return 1
    fi
}

# Restart all services
restart_services() {
    stop_services
    sleep 2
    start_services
}

# Main command processing
case "${1:-}" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    status)
        status_services
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac

exit 0