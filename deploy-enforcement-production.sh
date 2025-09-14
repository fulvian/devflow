#!/bin/bash

# Production Deployment Package for Enforcement System
# This script handles compilation, deployment, configuration, and rollback

set -euo pipefail

# Configuration
readonly DEPLOYMENT_ROOT="/opt/enforcement-system"
readonly APP_NAME="enforcement-app"
readonly BACKUP_DIR="/opt/backups/enforcement"
readonly LOG_FILE="/var/log/enforcement-deploy.log"
readonly CONFIG_DIR="${DEPLOYMENT_ROOT}/config"
readonly BIN_DIR="${DEPLOYMENT_ROOT}/bin"
readonly CURRENT_LINK="${DEPLOYMENT_ROOT}/current"
readonly HEALTH_CHECK_ENDPOINT="http://localhost:8080/health"
readonly HEALTH_CHECK_TIMEOUT=30

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Check if running as root
check_privileges() {
    if [[ $EUID -ne 0 ]]; then
        error_exit "This script must be run as root"
    fi
}

# Create necessary directories
setup_directories() {
    log "Setting up directories..."
    mkdir -p "${DEPLOYMENT_ROOT}" "${BACKUP_DIR}" "${CONFIG_DIR}" "${BIN_DIR}"
    chown -R enforcement:enforcement "${DEPLOYMENT_ROOT}" 2>/dev/null || true
}

# Compile the application
compile_application() {
    log "Compiling application..."
    
    # Assuming source is in /tmp/enforcement-source
    local source_dir="/tmp/enforcement-source"
    local build_dir="${source_dir}/build"
    
    if [[ ! -d "${source_dir}" ]]; then
        error_exit "Source directory ${source_dir} does not exist"
    fi
    
    cd "${source_dir}"
    
    # Compile (example using make - adjust based on build system)
    if ! make clean all; then
        error_exit "Compilation failed"
    fi
    
    # Create build directory if it doesn't exist
    mkdir -p "${build_dir}"
    
    log "Compilation completed successfully"
}

# Create deployment package
create_deployment_package() {
    log "Creating deployment package..."
    
    local source_dir="/tmp/enforcement-source"
    local build_dir="${source_dir}/build"
    local package_dir="/tmp/enforcement-package"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local package_name="enforcement-${timestamp}.tar.gz"
    
    # Clean previous package directory
    rm -rf "${package_dir}"
    mkdir -p "${package_dir}/bin" "${package_dir}/config" "${package_dir}/scripts"
    
    # Copy binaries
    cp -r "${build_dir}/"* "${package_dir}/bin/"
    
    # Copy configuration files
    cp -r "${source_dir}/config/"* "${package_dir}/config/" 2>/dev/null || true
    
    # Copy deployment scripts
    cp "${source_dir}/scripts/"* "${package_dir}/scripts/" 2>/dev/null || true
    
    # Create package
    cd /tmp
    tar -czf "${package_name}" -C "${package_dir}" .
    
    log "Deployment package created: ${package_name}"
}

# Backup current deployment
backup_current_deployment() {
    log "Creating backup of current deployment..."
    
    if [[ -d "${CURRENT_LINK}" ]]; then
        local timestamp=$(date +%Y%m%d_%H%M%S)
        local backup_name="enforcement-backup-${timestamp}.tar.gz"
        
        tar -czf "${BACKUP_DIR}/${backup_name}" -C "${DEPLOYMENT_ROOT}" current
        
        # Keep only last 5 backups
        ls -t "${BACKUP_DIR}"/enforcement-backup-*.tar.gz | tail -n +6 | xargs -r rm
        
        log "Backup created: ${backup_name}"
    else
        log "No current deployment found, skipping backup"
    fi
}

# Deploy new version
deploy_new_version() {
    log "Deploying new version..."
    
    local package_path="/tmp/enforcement-$(date +%Y%m%d_%H%M%S).tar.gz"
    local new_version_dir="${DEPLOYMENT_ROOT}/versions/$(date +%Y%m%d_%H%M%S)"
    
    # Create new version directory
    mkdir -p "${new_version_dir}"
    
    # Extract package
    tar -xzf "${package_path}" -C "${new_version_dir}"
    
    # Set permissions
    chown -R enforcement:enforcement "${new_version_dir}"
    chmod +x "${new_version_dir}/bin/"*
    
    # Update current symlink
    ln -sfn "${new_version_dir}" "${CURRENT_LINK}"
    
    log "New version deployed to ${new_version_dir}"
}

# Configure application
configure_application() {
    log "Configuring application..."
    
    local config_source="${CURRENT_LINK}/config"
    local config_target="${CONFIG_DIR}"
    
    # Copy configuration files if they don't exist
    if [[ -d "${config_source}" ]]; then
        cp -n "${config_source}/"* "${config_target}/" 2>/dev/null || true
    fi
    
    # Set proper permissions
    chown -R enforcement:enforcement "${CONFIG_DIR}"
    chmod 600 "${CONFIG_DIR}"/*
    
    log "Application configured"
}

# Start application
start_application() {
    log "Starting application..."
    
    # Stop if already running
    systemctl stop enforcement 2>/dev/null || true
    
    # Start service
    if ! systemctl start enforcement; then
        error_exit "Failed to start enforcement service"
    fi
    
    log "Application started"
}

# Health check
health_check() {
    log "Performing health check..."
    
    local counter=0
    while [[ $counter -lt ${HEALTH_CHECK_TIMEOUT} ]]; do
        if curl -s --fail "${HEALTH_CHECK_ENDPOINT}" >/dev/null; then
            log "Health check passed"
            return 0
        fi
        
        log "Health check failed, retrying in 1 second..."
        sleep 1
        ((counter++))
    done
    
    error_exit "Health check failed after ${HEALTH_CHECK_TIMEOUT} seconds"
}

# Rollback to previous version
rollback() {
    log "Initiating rollback..."
    
    local latest_backup=$(ls -t "${BACKUP_DIR}"/enforcement-backup-*.tar.gz | head -n1)
    
    if [[ -z "${latest_backup}" ]]; then
        error_exit "No backup found for rollback"
    fi
    
    # Stop current application
    systemctl stop enforcement 2>/dev/null || true
    
    # Restore from backup
    local restore_dir="${DEPLOYMENT_ROOT}/rollback_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "${restore_dir}"
    tar -xzf "${latest_backup}" -C "${restore_dir}"
    
    # Update current symlink
    ln -sfn "${restore_dir}/current" "${CURRENT_LINK}"
    
    # Restart application
    systemctl start enforcement
    
    log "Rollback completed to $(basename "${latest_backup}")"
}

# Setup monitoring
setup_monitoring() {
    log "Setting up monitoring..."
    
    # Create logrotate configuration
    cat > /etc/logrotate.d/enforcement <<EOF
/var/log/enforcement/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 enforcement enforcement
    postrotate
        systemctl reload enforcement >/dev/null 2>&1 || true
    endscript
}
EOF
    
    # Setup systemd service monitoring
    systemctl enable enforcement
    
    log "Monitoring setup completed"
}

# Main deployment function
main() {
    log "Starting enforcement system deployment"
    
    check_privileges
    setup_directories
    compile_application
    create_deployment_package
    backup_current_deployment
    deploy_new_version
    configure_application
    start_application
    health_check
    setup_monitoring
    
    log "Deployment completed successfully"
}

# Handle rollback on error
trap 'rollback' ERR

# Execute main function
main "$@"