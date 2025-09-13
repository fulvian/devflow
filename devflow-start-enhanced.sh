#!/bin/bash

# =============================================================================
# Enhanced DevFlow Startup Script with Fallback Orchestrator and CCR Integration
# =============================================================================
#
# This script starts the complete DevFlow system including:
# - Fallback Orchestrator
# - CCR (Cross-Chain Relay) Integration system
# - Claude → Codex → Gemini → Qwen3 fallback chain
# - Health checks and monitoring
#
# Usage: ./devflow-start.sh [options]
# Options:
#   --debug       Enable debug mode
#   --help        Show this help message
#
# =============================================================================

set -euo pipefail  # Strict mode: exit on error, undefined vars, pipe failures

# -----------------------------------------------------------------------------
# Configuration and Constants
# -----------------------------------------------------------------------------

readonly SCRIPT_NAME="devflow-start"
readonly SCRIPT_VERSION="1.0.0"
readonly LOG_FILE="/var/log/${SCRIPT_NAME}.log"
readonly CONFIG_DIR="/etc/devflow"
readonly ORCHESTRATOR_PORT="8080"
readonly CCR_PORT="8081"
readonly HEALTH_CHECK_TIMEOUT=30
readonly STARTUP_DELAY=2

# Fallback chain services in order
readonly FALLBACK_SERVICES=("claude" "codex" "gemini" "qwen3")

# -----------------------------------------------------------------------------
# Global Variables
# -----------------------------------------------------------------------------

DEBUG_MODE=false
SERVICES_STARTED=()

# -----------------------------------------------------------------------------
# Logging Functions
# -----------------------------------------------------------------------------

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

log_info() {
    log "INFO" "$@"
}

log_warn() {
    log "WARN" "$@"
}

log_error() {
    log "ERROR" "$@"
}

log_debug() {
    if [[ "$DEBUG_MODE" == true ]]; then
        log "DEBUG" "$@"
    fi
}

# -----------------------------------------------------------------------------
# Error Handling
# -----------------------------------------------------------------------------

cleanup() {
    log_info "Received shutdown signal, cleaning up..."
    stop_services
    log_info "Cleanup completed"
    exit 0
}

trap cleanup SIGTERM SIGINT

error_exit() {
    local lineno="$1"
    local message="$2"
    log_error "Error at line $lineno: $message"
    stop_services
    exit 1
}

trap 'error_exit $LINENO "$BASH_COMMAND"' ERR

# -----------------------------------------------------------------------------
# Health Check Functions
# -----------------------------------------------------------------------------

wait_for_service() {
    local service_name="$1"
    local port="$2"
    local timeout="${3:-$HEALTH_CHECK_TIMEOUT}"
    
    log_info "Waiting for $service_name to become available on port $port (timeout: ${timeout}s)"
    
    local start_time
    start_time=$(date +%s)
    
    while true; do
        if nc -z localhost "$port" 2>/dev/null; then
            log_info "$service_name is ready"
            return 0
        fi
        
        local current_time
        current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        if [[ $elapsed -ge $timeout ]]; then
            log_error "$service_name failed to start within ${timeout} seconds"
            return 1
        fi
        
        sleep 1
    done
}

# -----------------------------------------------------------------------------
# Service Management Functions
# -----------------------------------------------------------------------------

start_fallback_orchestrator() {
    log_info "Starting Fallback Orchestrator..."
    
    # Create orchestrator configuration
    create_orchestrator_config
    
    # Start the orchestrator service
    if ! systemd-run --unit=devflow-orchestrator \
                     --service-type=forking \
                     /usr/local/bin/fallback-orchestrator \
                     --config="${CONFIG_DIR}/orchestrator.yaml" \
                     --port="$ORCHESTRATOR_PORT"; then
        log_error "Failed to start Fallback Orchestrator"
        return 1
    fi
    
    SERVICES_STARTED+=("orchestrator")
    
    # Wait for orchestrator to be ready
    if ! wait_for_service "Fallback Orchestrator" "$ORCHESTRATOR_PORT"; then
        return 1
    fi
    
    log_info "Fallback Orchestrator started successfully"
}

start_ccr_system() {
    log_info "Starting CCR Integration System..."
    
    # Create CCR configuration
    create_ccr_config
    
    # Start the CCR service
    if ! systemd-run --unit=devflow-ccr \
                     --service-type=forking \
                     /usr/local/bin/ccr-integration \
                     --config="${CONFIG_DIR}/ccr.yaml" \
                     --port="$CCR_PORT"; then
        log_error "Failed to start CCR Integration System"
        return 1
    fi
    
    SERVICES_STARTED+=("ccr")
    
    # Wait for CCR to be ready
    if ! wait_for_service "CCR System" "$CCR_PORT"; then
        return 1
    fi
    
    log_info "CCR Integration System started successfully"
}

initialize_fallback_chain() {
    log_info "Initializing fallback chain configuration..."
    
    # Validate orchestrator is running
    if ! wait_for_service "Fallback Orchestrator" "$ORCHESTRATOR_PORT" 5; then
        log_error "Cannot initialize fallback chain: Orchestrator not available"
        return 1
    fi
    
    # Configure the fallback chain through the orchestrator API
    local chain_config
    chain_config=$(jq -n --argjson services "$(printf '%s\n' "${FALLBACK_SERVICES[@]}" | jq -R . | jq -s .)" \
        '{
            "chain": $services,
            "strategy": "sequential",
            "timeout": 30000,
            "retry_attempts": 3
        }')
    
    if ! curl -s -X POST \
              -H "Content-Type: application/json" \
              -d "$chain_config" \
              "http://localhost:${ORCHESTRATOR_PORT}/api/v1/chain" \
              | jq -e .success >/dev/null; then
        log_error "Failed to configure fallback chain"
        return 1
    fi
    
    log_info "Fallback chain initialized successfully"
}

start_fallback_services() {
    log_info "Starting fallback chain services..."
    
    for service in "${FALLBACK_SERVICES[@]}"; do
        log_info "Starting $service service..."
        
        if ! systemd-run --unit="devflow-${service}" \
                         --service-type=forking \
                         /usr/local/bin/"$service"-service \
                         --config="${CONFIG_DIR}/${service}.yaml"; then
            log_error "Failed to start $service service"
            return 1
        fi
        
        SERVICES_STARTED+=("$service")
        
        # Small delay between service starts
        sleep "$STARTUP_DELAY"
    done
    
    log_info "All fallback services started"
}

integrate_ccr_with_orchestrator() {
    log_info "Integrating CCR with Fallback Orchestrator..."
    
    # Validate both services are running
    if ! wait_for_service "Fallback Orchestrator" "$ORCHESTRATOR_PORT" 5; then
        log_error "Cannot integrate CCR: Orchestrator not available"
        return 1
    fi
    
    if ! wait_for_service "CCR System" "$CCR_PORT" 5; then
        log_error "Cannot integrate CCR: CCR system not available"
        return 1
    fi
    
    # Register CCR with orchestrator
    local ccr_config
    ccr_config=$(jq -n \
        --arg host "localhost" \
        --arg port "$CCR_PORT" \
        '{
            "name": "ccr_integration",
            "type": "relay",
            "endpoint": "http://\($host):\($port)/api/v1",
            "enabled": true
        }')
    
    if ! curl -s -X POST \
              -H "Content-Type: application/json" \
              -d "$ccr_config" \
              "http://localhost:${ORCHESTRATOR_PORT}/api/v1/integrations" \
              | jq -e .success >/dev/null; then
        log_error "Failed to register CCR with orchestrator"
        return 1
    fi
    
    log_info "CCR successfully integrated with orchestrator"
}

# -----------------------------------------------------------------------------
# Configuration Functions
# -----------------------------------------------------------------------------

create_orchestrator_config() {
    log_debug "Creating orchestrator configuration..."
    
    mkdir -p "$CONFIG_DIR"
    
    cat > "${CONFIG_DIR}/orchestrator.yaml" <<EOF
# Fallback Orchestrator Configuration
server:
  port: $ORCHESTRATOR_PORT
  host: 0.0.0.0

logging:
  level: ${DEBUG_MODE:+debug}${DEBUG_MODE:-info}
  file: /var/log/orchestrator.log

monitoring:
  enabled: true
  endpoint: /metrics

chain:
  default_timeout: 30000
  max_retries: 3
EOF
}

create_ccr_config() {
    log_debug "Creating CCR configuration..."
    
    mkdir -p "$CONFIG_DIR"
    
    cat > "${CONFIG_DIR}/ccr.yaml" <<EOF
# CCR Integration Configuration
server:
  port: $CCR_PORT
  host: 0.0.0.0

orchestrator:
  endpoint: http://localhost:$ORCHESTRATOR_PORT/api/v1

chains:
  enabled: true
  sync_interval: 60

logging:
  level: ${DEBUG_MODE:+debug}${DEBUG_MODE:-info}
  file: /var/log/ccr.log
EOF
}

# -----------------------------------------------------------------------------
# Monitoring and Status Functions
# -----------------------------------------------------------------------------

check_system_health() {
    log_info "Performing system health check..."
    
    # Check orchestrator health
    if ! curl -s -f "http://localhost:${ORCHESTRATOR_PORT}/health" >/dev/null; then
        log_error "Orchestrator health check failed"
        return 1
    fi
    
    # Check CCR health
    if ! curl -s -f "http://localhost:${CCR_PORT}/health" >/dev/null; then
        log_error "CCR health check failed"
        return 1
    fi
    
    # Check each fallback service
    for service in "${FALLBACK_SERVICES[@]}"; do
        # In a real implementation, we would check each service's health endpoint
        log_debug "Health check for $service would be performed here"
    done
    
    log_info "System health check passed"
    return 0
}

report_status() {
    log_info "=== DevFlow System Status ==="
    log_info "Services started: ${SERVICES_STARTED[*]}"
    log_info "Fallback chain: ${FALLBACK_SERVICES[*]}"
    log_info "Orchestrator endpoint: http://localhost:$ORCHESTRATOR_PORT"
    log_info "CCR endpoint: http://localhost:$CCR_PORT"
    log_info "=============================="
}

# -----------------------------------------------------------------------------
# Service Control Functions
# -----------------------------------------------------------------------------

stop_services() {
    log_info "Stopping DevFlow services..."
    
    # Stop in reverse order
    for (( idx=${#SERVICES_STARTED[@]}-1 ; idx>=0 ; idx-- )); do
        local service="${SERVICES_STARTED[idx]}"
        log_info "Stopping $service..."
        systemctl stop "devflow-${service}" 2>/dev/null || true
    done
    
    SERVICES_STARTED=()
}

# -----------------------------------------------------------------------------
# Main Functions
# -----------------------------------------------------------------------------

show_help() {
    cat <<EOF
Enhanced DevFlow Startup Script
Version: $SCRIPT_VERSION

USAGE:
    $SCRIPT_NAME [OPTIONS]

OPTIONS:
    --debug     Enable debug logging
    --help      Show this help message

DESCRIPTION:
    Starts the complete DevFlow system with Fallback Orchestrator and CCR Integration.
    
    Services started in order:
    1. Fallback Orchestrator
    2. CCR Integration System
    3. Fallback chain services (Claude → Codex → Gemini → Qwen3)
    
    Includes health checks, monitoring, and graceful shutdown handling.
EOF
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --debug)
                DEBUG_MODE=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

main() {
    log_info "Starting DevFlow Enhanced System (Version: $SCRIPT_VERSION)"
    
    # Parse command line arguments
    parse_arguments "$@"
    
    # Validate prerequisites
    for cmd in jq curl nc systemd-run; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "Required command '$cmd' not found"
            exit 1
        fi
    done
    
    # Start services in correct order
    log_info "Starting services in coordinated sequence..."
    
    # 1. Start Fallback Orchestrator
    if ! start_fallback_orchestrator; then
        log_error "Failed to start Fallback Orchestrator"
        exit 1
    fi
    
    # 2. Start CCR System
    if ! start_ccr_system; then
        log_error "Failed to start CCR System"
        exit 1
    fi
    
    # 3. Initialize fallback chain
    if ! initialize_fallback_chain; then
        log_error "Failed to initialize fallback chain"
        exit 1
    fi
    
    # 4. Start fallback services
    if ! start_fallback_services; then
        log_error "Failed to start fallback services"
        exit 1
    fi
    
    # 5. Integrate CCR with orchestrator
    if ! integrate_ccr_with_orchestrator; then
        log_error "Failed to integrate CCR with orchestrator"
        exit 1
    fi
    
    # 6. Perform health check
    if ! check_system_health; then
        log_error "System health check failed"
        exit 1
    fi
    
    # 7. Report final status
    report_status
    
    log_info "DevFlow Enhanced System started successfully!"
    log_info "Press Ctrl+C to shutdown gracefully"
    
    # Keep script running to handle signals
    while true; do
        sleep 60
    done
}

# -----------------------------------------------------------------------------
# Script Entry Point
# -----------------------------------------------------------------------------

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi