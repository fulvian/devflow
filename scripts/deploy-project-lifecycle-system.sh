# SYNTHETIC CODE GENERATION - DEVFLOW-PLM-007 → hf:Qwen/Qwen3-Coder-480B-A35B-Instruct

## Generated Code

```bash
#!/bin/bash

# Project Lifecycle Management Deployment Script
# Task ID: DEVFLOW-PLM-007
# Description: Automated deployment script for complete Project Lifecycle Management system

set -euo pipefail

# Configuration
readonly SCRIPT_NAME="plm-deploy"
readonly SCRIPT_VERSION="1.0.0"
readonly LOG_DIR="/var/log/plm"
readonly BACKUP_DIR="/opt/plm/backups"
readonly CONFIG_DIR="/opt/plm/config"
readonly DEPLOYMENT_TIMEOUT=300
readonly HEALTH_CHECK_RETRIES=10
readonly HEALTH_CHECK_INTERVAL=5

# Service ports
readonly API_PORT=8080
readonly ORCHESTRATOR_PORT=8081
readonly MONITORING_PORT=8082

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Global variables
DEPLOYMENT_START_TIME=""
ROLLBACK_REQUIRED=false
CURRENT_DEPLOYMENT_ID=""

# Logging functions
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${LOG_DIR}/${SCRIPT_NAME}.log"
}

log_info() {
    log "INFO" "$1"
}

log_warn() {
    log "WARN" "$1"
}

log_error() {
    log "ERROR" "$1"
}

log_success() {
    log "SUCCESS" "$1"
}

# Error handling
error_exit() {
    local message="$1"
    local exit_code="${2:-1}"
    log_error "${message}"
    
    if [[ "${ROLLBACK_REQUIRED}" == true ]]; then
        log_info "Initiating rollback procedure..."
        perform_rollback
    fi
    
    exit "${exit_code}"
}

# Trap for cleanup on script exit
trap 'cleanup' EXIT
trap 'error_exit "Script interrupted" 130' INT TERM

# Initialize deployment environment
init_deployment() {
    log_info "Initializing Project Lifecycle Management deployment v${SCRIPT_VERSION}"
    
    # Create necessary directories
    mkdir -p "${LOG_DIR}" "${BACKUP_DIR}" "${CONFIG_DIR}" || error_exit "Failed to create required directories"
    
    # Set deployment ID and start time
    CURRENT_DEPLOYMENT_ID=$(date +%Y%m%d_%H%M%S)
    DEPLOYMENT_START_TIME=$(date +%s)
    
    log_info "Deployment ID: ${CURRENT_DEPLOYMENT_ID}"
    
    # Check dependencies
    check_dependencies
    
    # Validate environment
    validate_environment
}

# Check required dependencies
check_dependencies() {
    local dependencies=("docker" "kubectl" "psql" "node" "npm" "git")
    local missing_deps=()
    
    log_info "Checking dependencies..."
    
    for dep in "${dependencies[@]}"; do
        if ! command -v "${dep}" &> /dev/null; then
            missing_deps+=("${dep}")
        fi
    done
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        error_exit "Missing required dependencies: ${missing_deps[*]}"
    fi
    
    log_success "All dependencies satisfied"
}

# Validate deployment environment
validate_environment() {
    log_info "Validating deployment environment..."
    
    # Check if running as root or with sufficient privileges
    if [[ $EUID -ne 0 ]] && ! sudo -n true &> /dev/null; then
        error_exit "This script requires root privileges or sudo access"
    fi
    
    # Check available disk space (minimum 5GB)
    local available_space
    available_space=$(df /opt | awk 'NR==2 {print $4}')
    if [[ ${available_space} -lt 5242880 ]]; then
        error_exit "Insufficient disk space. Minimum 5GB required in /opt"
    fi
    
    # Check database connectivity
    if ! pg_isready -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" &> /dev/null; then
        error_exit "Database connection failed. Please check database service"
    fi
    
    log_success "Environment validation passed"
}

# Setup database schema extensions
setup_database_extensions() {
    log_info "Setting up database schema extensions..."
    
    # Create backup before making changes
    create_database_backup
    
    # Enable required PostgreSQL extensions
    local extensions=("uuid-ossp" "pgcrypto" "citext")
    
    for ext in "${extensions[@]}"; do
        if ! psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" -d "${DB_NAME:-cometa}" -c "CREATE EXTENSION IF NOT EXISTS \"${ext}\";" &> /dev/null; then
            error_exit "Failed to create extension: ${ext}"
        fi
        log_info "Extension ${ext} enabled"
    done
    
    # Apply schema migrations
    apply_schema_migrations
    
    log_success "Database schema extensions setup completed"
}

# Create database backup
create_database_backup() {
    log_info "Creating database backup..."
    
    local backup_file="${BACKUP_DIR}/cometa_backup_${CURRENT_DEPLOYMENT_ID}.sql"
    
    if ! pg_dump -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" "${DB_NAME:-cometa}" > "${backup_file}"; then
        error_exit "Failed to create database backup"
    fi
    
    # Compress backup
    if ! gzip "${backup_file}"; then
        error_exit "Failed to compress database backup"
    fi
    
    log_success "Database backup created: ${backup_file}.gz"
}

# Apply schema migrations
apply_schema_migrations() {
    log_info "Applying schema migrations..."
    
    # This would typically run migration scripts
    # For demonstration, we'll simulate the process
    local migration_dir="/opt/plm/migrations"
    
    if [[ ! -d "${migration_dir}" ]]; then
        log_warn "Migration directory not found: ${migration_dir}"
        return
    fi
    
    # Apply migrations in order
    find "${migration_dir}" -name "*.sql" -type f | sort | while read -r migration; do
        local migration_name
        migration_name=$(basename "${migration}")
        log_info "Applying migration: ${migration_name}"
        
        if ! psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" -d "${DB_NAME:-cometa}" -f "${migration}" &> /dev/null; then
            error_exit "Failed to apply migration: ${migration_name}"
        fi
    done
    
    log_success "Schema migrations applied successfully"
}

# Start all required services
start_services() {
    log_info "Starting required services..."
    
    # Start database service if not running
    if ! systemctl is-active --quiet postgresql; then
        log_info "Starting PostgreSQL service..."
        if ! systemctl start postgresql; then
            error_exit "Failed to start PostgreSQL service"
        fi
    fi
    
    # Start Docker services
    start_docker_services
    
    # Start application services
    start_application_services
    
    log_success "All services started"
}

# Start Docker services
start_docker_services() {
    log_info "Starting Docker services..."
    
    # Check if Docker is running
    if ! systemctl is-active --quiet docker; then
        log_info "Starting Docker service..."
        if ! systemctl start docker; then
            error_exit "Failed to start Docker service"
        fi
    fi
    
    # Start containers if docker-compose file exists
    local compose_file="/opt/plm/docker-compose.yml"
    if [[ -f "${compose_file}" ]]; then
        if ! docker-compose -f "${compose_file}" up -d; then
            error_exit "Failed to start Docker containers"
        fi
        log_info "Docker containers started"
    fi
}

# Start application services
start_application_services() {
    log_info "Starting application services..."
    
    # Start API server
    start_api_server
    
    # Start orchestrator
    start_orchestrator
    
    # Start monitoring service
    start_monitoring_service
}

# Start API server
start_api_server() {
    log_info "Starting API server on port ${API_PORT}..."
    
    # Check if port is already in use
    if lsof -i :${API_PORT} &> /dev/null; then
        log_warn "Port ${API_PORT} is already in use. Attempting to stop existing service..."
        pkill -f "plm-api" || true
        sleep 2
    fi
    
    # Start the API server (simulated)
    # In a real scenario, this would start your actual API service
    local api_dir="/opt/plm/api"
    if [[ -d "${api_dir}" ]]; then
        cd "${api_dir}" || error_exit "Failed to change to API directory"
        
        # Simulate starting API server in background
        nohup npm start > "${LOG_DIR}/api.log" 2>&1 &
        local api_pid=$!
        
        # Wait briefly for startup
        sleep 3
        
        # Check if process is still running
        if ! kill -0 "${api_pid}" &> /dev/null; then
            error_exit "API server failed to start"
        fi
        
        log_success "API server started with PID: ${api_pid}"
    else
        error_exit "API directory not found: ${api_dir}"
    fi
}

# Start orchestrator
start_orchestrator() {
    log_info "Starting orchestrator on port ${ORCHESTRATOR_PORT}..."
    
    # Check if port is already in use
    if lsof -i :${ORCHESTRATOR_PORT} &> /dev/null; then
        log_warn "Port ${ORCHESTRATOR_PORT} is already in use. Attempting to stop existing service..."
        pkill -f "plm-orchestrator" || true
        sleep 2
    fi
    
    # Start the orchestrator (simulated)
    local orchestrator_dir="/opt/plm/orchestrator"
    if [[ -d "${orchestrator_dir}" ]]; then
        cd "${orchestrator_dir}" || error_exit "Failed to change to orchestrator directory"
        
        # Simulate starting orchestrator in background
        nohup ./orchestrator --port=${ORCHESTRATOR_PORT} > "${LOG_DIR}/orchestrator.log" 2>&1 &
        local orchestrator_pid=$!
        
        # Wait briefly for startup
        sleep 3
        
        # Check if process is still running
        if ! kill -0 "${orchestrator_pid}" &> /dev/null; then
            error_exit "Orchestrator failed to start"
        fi
        
        log_success "Orchestrator started with PID: ${orchestrator_pid}"
    else
        error_exit "Orchestrator directory not found: ${orchestrator_dir}"
    fi
}

# Start monitoring service
start_monitoring_service() {
    log_info "Starting monitoring service on port ${MONITORING_PORT}..."
    
    # Check if port is already in use
    if lsof -i :${MONITORING_PORT} &> /dev/null; then
        log_warn "Port ${MONITORING_PORT} is already in use. Attempting to stop existing service..."
        pkill -f "plm-monitor" || true
        sleep 2
    fi
    
    # Start the monitoring service (simulated)
    local monitor_dir="/opt/plm/monitor"
    if [[ -d "${monitor_dir}" ]]; then
        cd "${monitor_dir}" || error_exit "Failed to change to monitor directory"
        
        # Simulate starting monitoring service in background
        nohup ./monitor --port=${MONITORING_PORT} > "${LOG_DIR}/monitor.log" 2>&1 &
        local monitor_pid=$!
        
        # Wait briefly for startup
        sleep 3
        
        # Check if process is still running
        if ! kill -0 "${monitor_pid}" &> /dev/null; then
            error_exit "Monitoring service failed to start"
        fi
        
        log_success "Monitoring service started with PID: ${monitor_pid}"
    else
        error_exit "Monitor directory not found: ${monitor_dir}"
    fi
}

# Deploy API server
deploy_api_server() {
    log_info "Deploying API server..."
    
    local api_source="/opt/plm/source/api"
    local api_target="/opt/plm/api"
    
    # Backup current API if exists
    if [[ -d "${api_target}" ]]; then
        log_info "Creating backup of current API server..."
        if ! cp -r "${api_target}" "${BACKUP_DIR}/api_backup_${CURRENT_DEPLOYMENT_ID}"; then
            error_exit "Failed to backup current API server"
        fi
    fi
    
    # Deploy new API server
    if [[ -d "${api_source}" ]]; then
        log_info "Deploying new API server from ${api_source}..."
        if ! cp -r "${api_source}" "${api_target}"; then
            error_exit "Failed to deploy API server"
        fi
        
        # Install dependencies
        cd "${api_target}" || error_exit "Failed to change to API directory"
        if ! npm install --production; then
            error_exit "Failed to install API dependencies"
        fi
        
        log_success "API server deployed successfully"
    else
        error_exit "API source directory not found: ${api_source}"
    fi
}

# Activate Claude Code hook
activate_claude_hook() {
    log_info "Activating Claude Code hook..."
    
    local hook_script="/opt/plm/hooks/claude-hook.sh"
    
    if [[ -f "${hook_script}" ]]; then
        # Make hook executable
        if ! chmod +x "${hook_script}"; then
            error_exit "Failed to make Claude hook executable"
        fi
        
        # Register hook with system (example with systemd)
        local hook_service="[Unit]
Description=Claude Code Hook
After=network.target

[Service]
Type=simple
ExecStart=${hook_script}
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target"
        
        echo "${hook_service}" > /etc/systemd/system/claude-hook.service
        
        # Enable and start the hook service
        if ! systemctl enable claude-hook.service; then
            error_exit "Failed to enable Claude hook service"
        fi
        
        if ! systemctl start claude-hook.service; then
            error_exit "Failed to start Claude hook service"
        fi
        
        log_success "Claude Code hook activated"
    else
        log_warn "Claude hook script not found: ${hook_script}"
    fi
}

# Configure orchestrator
configure_orchestrator() {
    log_info "Configuring orchestrator..."
    
    local config_file="/opt/plm/orchestrator/config.json"
    local config_dir=$(dirname "${config_file}")
    
    # Create config directory if not exists
    mkdir -p "${config_dir}" || error_exit "Failed to create orchestrator config directory"
    
    # Generate orchestrator configuration
    local config_content="{
  \"apiEndpoint\": \"http://localhost:${API_PORT}\",
  \"monitoringEndpoint\": \"http://localhost:${MONITORING_PORT}\",
  \"database\": {
    \"host\": \"${DB_HOST:-localhost}\",
    \"port\": ${DB_PORT:-5432},
    \"name\": \"${DB_NAME:-cometa}\",
    \"user\": \"${DB_USER:-postgres}\"
  },
  \"deploymentId\": \"${CURRENT_DEPLOYMENT_ID}\",
  \"logLevel\": \"info\"
}"
    
    echo "${config_content}" > "${config_file}" || error_exit "Failed to write orchestrator configuration"
    
    log_success "Orchestrator configured"
}

# Perform health checks
perform_health_checks() {
    log_info "Performing health checks..."
    
    local health_checks_passed=true
    
    # Check API server health
    if ! check_api_health; then
        log_error "API server health check failed"
        health_checks_passed=false
    fi
    
    # Check orchestrator health
    if ! check_orchestrator_health; then
        log_error "Orchestrator health check failed"
        health_checks_passed=false
    fi
    
    # Check database connectivity
    if ! check_database_health; then
        log_error "Database health check failed"
        health_checks_passed=false
    fi
    
    if [[ "${health_checks_passed}" == false ]]; then
        error_exit "Health checks failed"
    fi
    
    log_success "All health checks passed"
}

# Check API server health
check_api_health() {
    log_info "Checking API server health..."
    
    local retries=0
    while [[ ${retries} -lt ${HEALTH_CHECK_RETRIES} ]]; do
        if curl -s -f "http://localhost:${API_PORT}/health" &> /dev/null; then
            log_success "API server is healthy"
            return 0
        fi
        
        log_info "API server not ready, retrying in ${HEALTH_CHECK_INTERVAL} seconds... (${retries}/${HEALTH_CHECK_RETRIES})"
        sleep ${HEALTH_CHECK_INTERVAL}
        ((retries++))
    done
    
    return 1
}

# Check orchestrator health
check_orchestrator_health() {
    log_info "Checking orchestrator health..."
    
    local retries=0
    while [[ ${retries} -lt ${HEALTH_CHECK_RETRIES} ]]; do
        if curl -s -f "http://localhost:${ORCHESTRATOR_PORT}/health" &> /dev/null; then
            log_success "Orchestrator is healthy"
            return 0
        fi
        
        log_info "Orchestrator not ready, retrying in ${HEALTH_CHECK_INTERVAL} seconds... (${retries}/${HEALTH_CHECK_RETRIES})"
        sleep ${HEALTH_CHECK_INTERVAL}
        ((retries++))
    done
    
    return 1
}

# Check database health
check_database_health() {
    log_info "Checking database health..."
    
    if pg_isready -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" &> /dev/null; then
        log_success "Database is healthy"
        return 0
    else
        log_error "Database is not ready"
        return 1
    fi
}

#

## Usage Stats
- Model: hf:Qwen/Qwen3-Coder-480B-A35B-Instruct (Code Specialist)
- Tokens: 4205
- Language: bash

## MCP Response Metadata
{
  "requestId": "mcp_mfqztw5c_fpez5911fts",
  "timestamp": "2025-09-19T15:28:03.587Z",
  "version": "2.0.0",
  "model": "hf:Qwen/Qwen3-Coder-480B-A35B-Instruct",
  "tokensUsed": 4205
}