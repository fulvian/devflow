#!/bin/bash

# DevFlow Start Script with Project Lifecycle Management
# This script manages the startup of DevFlow services including the new Project Lifecycle API server

set -euo pipefail

# Configuration
readonly SCRIPT_NAME="devflow-start"
readonly LOG_FILE="/var/log/${SCRIPT_NAME}.log"
readonly PID_DIR="/var/run/devflow"
readonly LIFECYCLE_PID_FILE="${PID_DIR}/project-lifecycle.pid"
readonly LIFECYCLE_PORT=3008
readonly LIFECYCLE_DB_PATH="data/devflow.sqlite"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Logging functions
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"
}

log_info() {
    log "${GREEN}INFO${NC}: $*"
}

log_warn() {
    log "${YELLOW}WARN${NC}: $*"
}

log_error() {
    log "${RED}ERROR${NC}: $*"
}

# Ensure required directories exist
initialize_environment() {
    mkdir -p "${PID_DIR}" || {
        log_error "Failed to create PID directory: ${PID_DIR}"
        exit 1
    }
    
    mkdir -p "$(dirname "${LIFECYCLE_DB_PATH}")" || {
        log_error "Failed to create database directory: $(dirname "${LIFECYCLE_DB_PATH}")"
        exit 1
    }
    
    touch "${LOG_FILE}" || {
        log_error "Failed to create log file: ${LOG_FILE}"
        exit 1
    }
}

# Check if a process is running based on PID file
is_process_running() {
    local pid_file="$1"
    
    if [[ -f "${pid_file}" ]]; then
        local pid
        pid=$(cat "${pid_file}")
        
        if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
            return 0
        else
            # Clean up stale PID file
            rm -f "${pid_file}"
            return 1
        fi
    fi
    
    return 1
}

# Check if a port is in use
is_port_in_use() {
    local port="$1"
    if command -v ss >/dev/null 2>&1; then
        ss -tuln | grep -q ":${port} "
    elif command -v netstat >/dev/null 2>&1; then
        netstat -tuln | grep -q ":${port} "
    else
        # Fallback: try to bind to the port
        if command -v nc >/dev/null 2>&1; then
            ! nc -z localhost "${port}"
        else
            log_warn "Neither ss, netstat, nor nc available for port checking"
            return 1
        fi
    fi
}

# Start the Project Lifecycle API server
start_project_lifecycle() {
    log_info "Starting Project Lifecycle API server..."
    
    # Check if already running
    if is_process_running "${LIFECYCLE_PID_FILE}"; then
        log_warn "Project Lifecycle API server is already running"
        return 0
    fi
    
    # Check if port is available
    if is_port_in_use "${LIFECYCLE_PORT}"; then
        log_error "Port ${LIFECYCLE_PORT} is already in use"
        return 1
    fi
    
    # Validate database path
    if [[ ! -f "${LIFECYCLE_DB_PATH}" ]] && [[ ! -w "$(dirname "${LIFECYCLE_DB_PATH}")" ]]; then
        log_error "Database path is not writable: ${LIFECYCLE_DB_PATH}"
        return 1
    fi
    
    # Start the server
    local cmd="project-lifecycle-server"
    
    # Check if the command exists
    if ! command -v "${cmd}" >/dev/null 2>&1; then
        log_error "Project Lifecycle server command not found: ${cmd}"
        return 1
    fi
    
    # Start the process in background
    "${cmd}" \
        --port="${LIFECYCLE_PORT}" \
        --db-path="${LIFECYCLE_DB_PATH}" \
        >> "${LOG_FILE}" 2>&1 &
    
    local pid=$!
    
    # Wait briefly to see if process started successfully
    sleep 2
    
    # Check if process is still running
    if kill -0 "${pid}" 2>/dev/null; then
        echo "${pid}" > "${LIFECYCLE_PID_FILE}"
        log_info "Project Lifecycle API server started with PID ${pid}"
        return 0
    else
        log_error "Failed to start Project Lifecycle API server"
        return 1
    fi
}

# Stop the Project Lifecycle API server
stop_project_lifecycle() {
    log_info "Stopping Project Lifecycle API server..."
    
    if is_process_running "${LIFECYCLE_PID_FILE}"; then
        local pid
        pid=$(cat "${LIFECYCLE_PID_FILE}")
        
        # Try graceful shutdown first
        if kill -TERM "${pid}" 2>/dev/null; then
            local count=0
            while [[ ${count} -lt 30 ]] && kill -0 "${pid}" 2>/dev/null; do
                sleep 1
                ((count++))
            done
            
            # Force kill if still running
            if kill -0 "${pid}" 2>/dev/null; then
                log_warn "Force killing Project Lifecycle API server (PID: ${pid})"
                kill -KILL "${pid}" 2>/dev/null || true
            fi
        fi
        
        rm -f "${LIFECYCLE_PID_FILE}"
        log_info "Project Lifecycle API server stopped"
    else
        log_warn "Project Lifecycle API server is not running"
    fi
}

# Get status of the Project Lifecycle API server
status_project_lifecycle() {
    if is_process_running "${LIFECYCLE_PID_FILE}"; then
        local pid
        pid=$(cat "${LIFECYCLE_PID_FILE}")
        echo "Project Lifecycle API server: ${GREEN}RUNNING${NC} (PID: ${pid})"
        
        # Check if port is listening
        if is_port_in_use "${LIFECYCLE_PORT}"; then
            echo "  Port ${LIFECYCLE_PORT}: ${GREEN}LISTENING${NC}"
        else
            echo "  Port ${LIFECYCLE_PORT}: ${RED}NOT LISTENING${NC}"
        fi
        
        return 0
    else
        echo "Project Lifecycle API server: ${RED}STOPPED${NC}"
        return 1
    fi
}

# Display usage information
usage() {
    cat << EOF
Usage: ${SCRIPT_NAME} [OPTIONS] COMMAND

Commands:
  start                 Start all DevFlow services including Project Lifecycle API
  stop                  Stop all DevFlow services
  restart               Restart all DevFlow services
  status                Show status of all DevFlow services
  lifecycle-start       Start only the Project Lifecycle API server
  lifecycle-stop        Stop only the Project Lifecycle API server
  lifecycle-status      Show status of the Project Lifecycle API server

Options:
  -h, --help            Show this help message

Examples:
  ${SCRIPT_NAME} start
  ${SCRIPT_NAME} lifecycle-status
EOF
}

# Main start function - maintains compatibility with existing script
start_all_services() {
    log_info "Starting all DevFlow services..."
    
    # Start existing services here (placeholder)
    # ... existing service start logic ...
    
    # Start Project Lifecycle API
    if start_project_lifecycle; then
        log_info "All DevFlow services started successfully"
    else
        log_error "Failed to start some DevFlow services"
        return 1
    fi
}

# Main stop function - maintains compatibility with existing script
stop_all_services() {
    log_info "Stopping all DevFlow services..."
    
    # Stop Project Lifecycle API
    stop_project_lifecycle
    
    # Stop existing services here (placeholder)
    # ... existing service stop logic ...
    
    log_info "All DevFlow services stopped"
}

# Main status function - maintains compatibility with existing script
status_all_services() {
    echo "DevFlow Services Status:"
    echo "========================"
    
    # Show Project Lifecycle API status
    status_project_lifecycle
    
    # Show existing services status here (placeholder)
    # ... existing service status logic ...
}

# Main function
main() {
    initialize_environment
    
    # If no arguments provided, show usage
    if [[ $# -eq 0 ]]; then
        usage
        exit 1
    fi
    
    # Parse command
    local command="$1"
    
    case "${command}" in
        start)
            start_all_services
            ;;
        stop)
            stop_all_services
            ;;
        restart)
            stop_all_services
            start_all_services
            ;;
        status)
            status_all_services
            ;;
        lifecycle-start)
            start_project_lifecycle
            ;;
        lifecycle-stop)
            stop_project_lifecycle
            ;;
        lifecycle-status)
            status_project_lifecycle
            ;;
        -h|--help)
            usage
            ;;
        *)
            log_error "Unknown command: ${command}"
            usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"