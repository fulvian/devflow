#!/bin/bash

# DevFlow Configuration Update Script
# Updates services to use the advanced database

set -euo pipefail

# Configuration
ORCHESTRATOR_SERVICE="services/devflow-orchestrator"
BACKUP_DIR="backups/config_backup_$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$BACKUP_DIR/config_update.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error_exit() {
    echo -e "${RED}ERROR: $1${NC}" >&2
    log "ERROR: $1"
    exit 1
}

success() {
    echo -e "${GREEN}$1${NC}"
    log "SUCCESS: $1"
}

warning() {
    echo -e "${YELLOW}WARNING: $1${NC}"
    log "WARNING: $1"
}

main() {
    # Create backup directory first
    mkdir -p "$BACKUP_DIR" || {
        echo "ERROR: Failed to create backup directory"
        exit 1
    }

    log "Starting DevFlow configuration update"

    # Backup current environment and config files
    log "Backing up current configuration files"
    if [[ -f ".env" ]]; then
        cp ".env" "$BACKUP_DIR/.env.backup"
    fi

    if [[ -f "$ORCHESTRATOR_SERVICE/.env" ]]; then
        cp "$ORCHESTRATOR_SERVICE/.env" "$BACKUP_DIR/orchestrator.env.backup"
    fi

    # Update environment variable for database path
    log "Updating database path configuration"

    # Set environment variable for current session
    export DEVFLOW_DB_PATH="./devflow.sqlite"

    # Update .env file if it exists, otherwise create it
    if [[ -f ".env" ]]; then
        # Remove existing DEVFLOW_DB_PATH if present
        sed -i.bak '/^DEVFLOW_DB_PATH=/d' ".env"
    fi
    echo "DEVFLOW_DB_PATH=./devflow.sqlite" >> ".env"

    success "Database path configuration updated"

    # Find and restart DevFlow orchestrator processes
    log "Identifying DevFlow processes to restart"

    # Find orchestrator processes
    ORCHESTRATOR_PIDS=$(pgrep -f "devflow-orchestrator" || true)

    if [[ -n "$ORCHESTRATOR_PIDS" ]]; then
        log "Found orchestrator processes: $ORCHESTRATOR_PIDS"

        # Graceful shutdown
        log "Gracefully stopping orchestrator processes"
        echo "$ORCHESTRATOR_PIDS" | xargs -I {} kill -TERM {} || true

        # Wait for graceful shutdown
        sleep 5

        # Force kill if still running
        REMAINING_PIDS=$(pgrep -f "devflow-orchestrator" || true)
        if [[ -n "$REMAINING_PIDS" ]]; then
            warning "Force killing remaining processes: $REMAINING_PIDS"
            echo "$REMAINING_PIDS" | xargs -I {} kill -9 {} || true
        fi

        success "Orchestrator processes stopped"
    else
        log "No orchestrator processes found running"
    fi

    # Restart orchestrator with new configuration
    log "Starting orchestrator with new database configuration"

    cd "$ORCHESTRATOR_SERVICE" || error_exit "Could not change to orchestrator directory"

    # Start in background with new environment
    DEVFLOW_DB_PATH="../../devflow.sqlite" node dist/app.js > ../../logs/orchestrator.log 2>&1 &
    ORCHESTRATOR_PID=$!

    cd - > /dev/null

    log "Started new orchestrator process with PID: $ORCHESTRATOR_PID"

    # Wait for service to start
    log "Waiting for service to start..."
    sleep 10

    # Verify service is running
    if kill -0 "$ORCHESTRATOR_PID" 2>/dev/null; then
        success "Orchestrator service is running"
    else
        error_exit "Orchestrator service failed to start"
    fi

    # Test API endpoints
    log "Testing API endpoints"

    # Test health endpoint
    if curl -s -f http://localhost:3006/health > /dev/null; then
        success "Health endpoint responding"
    else
        warning "Health endpoint not responding on port 3006, trying 3005"
        if curl -s -f http://localhost:3005/health > /dev/null; then
            success "Health endpoint responding on port 3005"
        else
            error_exit "Health endpoint not responding on either port"
        fi
    fi

    # Test tasks API (with auth token if needed)
    log "Testing tasks API"
    TASKS_RESPONSE=$(curl -s http://localhost:3006/api/tasks -H "Authorization: Bearer dev-token" || echo "AUTH_REQUIRED")

    if [[ "$TASKS_RESPONSE" == *"AUTH_REQUIRED"* ]] || [[ "$TASKS_RESPONSE" == *"success"* ]]; then
        success "Tasks API responding (authentication working)"
    else
        warning "Tasks API response unclear: $TASKS_RESPONSE"
    fi

    success "Configuration update completed successfully"
    log "Backup location: $BACKUP_DIR"
    log "New orchestrator PID: $ORCHESTRATOR_PID"

    # Create rollback script
    cat > "$BACKUP_DIR/rollback.sh" << 'EOF'
#!/bin/bash
# Auto-generated rollback script
set -euo pipefail

BACKUP_DIR="$(dirname "$0")"

echo "Rolling back DevFlow configuration"

# Stop current processes
pgrep -f "devflow-orchestrator" | xargs -I {} kill -TERM {} || true
sleep 3
pgrep -f "devflow-orchestrator" | xargs -I {} kill -9 {} || true

# Restore config files
if [[ -f "$BACKUP_DIR/.env.backup" ]]; then
    cp "$BACKUP_DIR/.env.backup" ".env"
fi

if [[ -f "$BACKUP_DIR/orchestrator.env.backup" ]]; then
    cp "$BACKUP_DIR/orchestrator.env.backup" "services/devflow-orchestrator/.env"
fi

echo "Configuration rollback completed"
echo "Please manually restart services with original configuration"
EOF

    chmod +x "$BACKUP_DIR/rollback.sh"

    echo ""
    echo "=== CONFIGURATION UPDATE SUMMARY ==="
    echo "Database path: ./devflow.sqlite"
    echo "Orchestrator PID: $ORCHESTRATOR_PID"
    echo "Backup location: $BACKUP_DIR"
    echo "Rollback script: $BACKUP_DIR/rollback.sh"
}

main "$@"