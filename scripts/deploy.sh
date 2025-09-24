#!/bin/bash

# PIANO_TEST_DEBUG_COMETA_BRAIN.md - Section 9.3: Deployment Script
# Complete deployment automation script

set -euo pipefail

# Configuration
APP_NAME="cometa-brain"
APP_DIR="/opt/${APP_NAME}"
BACKUP_DIR="/opt/backups"
LOG_FILE="/var/log/${APP_NAME}-deployment.log"
SERVICE_NAME="${APP_NAME}.service"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "${LOG_FILE}"
}

# Error handling
error_exit() {
    log "${RED}ERROR: $1${NC}"
    exit 1
}

# Success message
success() {
    log "${GREEN}SUCCESS: $1${NC}"
}

# Warning message
warning() {
    log "${YELLOW}WARNING: $1${NC}"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error_exit "This script must be run as root"
    fi
}

# Create backup of current deployment
create_backup() {
    log "Creating backup of current deployment..."
    
    # Create backup directory if it doesn't exist
    mkdir -p "${BACKUP_DIR}"
    
    local timestamp
    timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_name="${APP_NAME}_backup_${timestamp}"
    local backup_path="${BACKUP_DIR}/${backup_name}.tar.gz"
    
    if [[ -d "${APP_DIR}" ]]; then
        tar -czf "${backup_path}" -C "$(dirname "${APP_DIR}")" "$(basename "${APP_DIR}")" \
            || error_exit "Failed to create backup"
        success "Backup created at ${backup_path}"
    else
        warning "Application directory does not exist, skipping backup"
    fi
}

# Update application code
update_code() {
    log "Updating application code..."
    
    if [[ ! -d "${APP_DIR}" ]]; then
        mkdir -p "${APP_DIR}"
        log "Created application directory"
    fi
    
    # Navigate to app directory
    cd "${APP_DIR}" || error_exit "Failed to navigate to ${APP_DIR}"
    
    # If it's a git repository, pull latest changes
    if [[ -d ".git" ]]; then
        git pull origin main || error_exit "Failed to pull latest code"
        success "Code updated via git"
    else
        # For this example, we'll simulate downloading new code
        # In a real scenario, this would be replaced with actual code deployment
        log "Simulating code deployment (in real scenario, this would deploy new code)"
        touch .deployment_marker
        success "Code updated"
    fi
}

# Install/update dependencies
install_dependencies() {
    log "Installing/Updating dependencies..."
    
    cd "${APP_DIR}" || error_exit "Failed to navigate to ${APP_DIR}"
    
    # Check for package manager files and install accordingly
    if [[ -f "package.json" ]]; then
        npm install || error_exit "Failed to install npm dependencies"
        success "NPM dependencies installed"
    elif [[ -f "requirements.txt" ]]; then
        if command -v pip3 &> /dev/null; then
            pip3 install -r requirements.txt || error_exit "Failed to install Python dependencies"
            success "Python dependencies installed"
        else
            warning "pip3 not found, skipping Python dependencies"
        fi
    else
        log "No standard dependency files found, skipping dependency installation"
    fi
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    cd "${APP_DIR}" || error_exit "Failed to navigate to ${APP_DIR}"
    
    # Check for common migration frameworks
    if [[ -f "manage.py" ]]; then
        # Django migrations
        python3 manage.py migrate || error_exit "Django migrations failed"
        success "Django migrations completed"
    elif [[ -f "alembic.ini" ]]; then
        # Alembic migrations
        alembic upgrade head || error_exit "Alembic migrations failed"
        success "Alembic migrations completed"
    elif [[ -f "prisma/schema.prisma" ]]; then
        # Prisma migrations
        npx prisma migrate deploy || error_exit "Prisma migrations failed"
        success "Prisma migrations completed"
    else
        log "No recognized migration framework found, skipping migrations"
    fi
}

# Run tests
run_tests() {
    log "Running tests..."
    
    cd "${APP_DIR}" || error_exit "Failed to navigate to ${APP_DIR}"
    
    # Check for test frameworks
    if [[ -f "package.json" ]] && grep -q "test" package.json; then
        npm test || error_exit "Tests failed"
        success "NPM tests passed"
    elif [[ -d "tests" ]] || [[ -f "test" ]]; then
        if command -v pytest &> /dev/null; then
            pytest || error_exit "Pytest failed"
            success "Pytest tests passed"
        else
            warning "pytest not found, skipping Python tests"
        fi
    else
        log "No recognized test framework found, skipping tests"
    fi
}

# Restart service
restart_service() {
    log "Restarting service..."
    
    if systemctl is-active --quiet "${SERVICE_NAME}"; then
        systemctl restart "${SERVICE_NAME}" || error_exit "Failed to restart service"
        success "Service restarted"
    else
        systemctl start "${SERVICE_NAME}" || error_exit "Failed to start service"
        success "Service started"
    fi
}

# Health check
health_check() {
    log "Performing health check..."
    
    local max_attempts=30
    local attempt=1
    local health_endpoint="http://localhost:8080/health"
    
    # Check if service file exists
    if ! systemctl is-active --quiet "${SERVICE_NAME}"; then
        error_exit "Service is not running"
    fi
    
    # If curl is available, try to reach the health endpoint
    if command -v curl &> /dev/null; then
        while [[ $attempt -le $max_attempts ]]; do
            if curl -f -s "${health_endpoint}" > /dev/null; then
                success "Health check passed"
                return 0
            fi
            
            log "Health check attempt ${attempt}/${max_attempts} failed, retrying in 2 seconds..."
            sleep 2
            ((attempt++))
        done
        
        error_exit "Health check failed after ${max_attempts} attempts"
    else
        # If curl is not available, just check if service is running
        if systemctl is-active --quiet "${SERVICE_NAME}"; then
            success "Service is running (curl not available for detailed health check)"
        else
            error_exit "Service is not running"
        fi
    fi
}

# Main deployment function
main() {
    log "Starting ${APP_NAME} deployment"
    
    check_root
    create_backup
    update_code
    install_dependencies
    run_migrations
    run_tests
    restart_service
    health_check
    
    success "Deployment completed successfully"
}

# Run main function
main "$@"