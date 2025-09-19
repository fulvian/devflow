#!/bin/bash

# DevFlow Database Backup Script
# Backs up both simple and advanced databases with integrity checks

set -euo pipefail

# Configuration
SIMPLE_DB="data/devflow.sqlite"
ADVANCED_DB="devflow.sqlite"
BACKUP_DIR="backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_SUBDIR="$BACKUP_DIR/backup_$TIMESTAMP"
LOG_FILE="$BACKUP_SUBDIR/backup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    echo -e "${RED}ERROR: $1${NC}" >&2
    log "ERROR: $1"
    exit 1
}

# Success message
success() {
    echo -e "${GREEN}$1${NC}"
    log "SUCCESS: $1"
}

# Warning message
warning() {
    echo -e "${YELLOW}WARNING: $1${NC}"
    log "WARNING: $1"
}

# Main backup function
main() {
    # Create backup directory first
    mkdir -p "$BACKUP_SUBDIR" || {
        echo "ERROR: Failed to create backup directory"
        exit 1
    }

    log "Starting DevFlow database backup process"

    # Check if databases exist
    if [[ ! -f "$SIMPLE_DB" ]]; then
        warning "Simple database $SIMPLE_DB not found"
    fi

    if [[ ! -f "$ADVANCED_DB" ]]; then
        warning "Advanced database $ADVANCED_DB not found"
    fi

    # Backup simple database
    if [[ -f "$SIMPLE_DB" ]]; then
        log "Backing up simple database: $SIMPLE_DB"
        cp "$SIMPLE_DB" "$BACKUP_SUBDIR/devflow_simple_$TIMESTAMP.sqlite" || error_exit "Failed to backup simple database"

        # Generate checksum
        sha256sum "$SIMPLE_DB" > "$BACKUP_SUBDIR/devflow_simple_$TIMESTAMP.sha256"
        success "Simple database backed up successfully"
    fi

    # Backup advanced database
    if [[ -f "$ADVANCED_DB" ]]; then
        log "Backing up advanced database: $ADVANCED_DB"
        cp "$ADVANCED_DB" "$BACKUP_SUBDIR/devflow_advanced_$TIMESTAMP.sqlite" || error_exit "Failed to backup advanced database"

        # Generate checksum
        sha256sum "$ADVANCED_DB" > "$BACKUP_SUBDIR/devflow_advanced_$TIMESTAMP.sha256"
        success "Advanced database backed up successfully"
    fi

    # Create backup manifest
    cat > "$BACKUP_SUBDIR/manifest.json" << EOF
{
    "backup_timestamp": "$TIMESTAMP",
    "backup_date": "$(date -Iseconds)",
    "simple_db_path": "$SIMPLE_DB",
    "advanced_db_path": "$ADVANCED_DB",
    "backup_location": "$BACKUP_SUBDIR",
    "simple_db_exists": $([ -f "$SIMPLE_DB" ] && echo "true" || echo "false"),
    "advanced_db_exists": $([ -f "$ADVANCED_DB" ] && echo "true" || echo "false")
}
EOF

    # Create restore script
    cat > "$BACKUP_SUBDIR/restore.sh" << 'EOF'
#!/bin/bash
# Auto-generated restore script
set -euo pipefail

BACKUP_DIR="$(dirname "$0")"
TIMESTAMP="$(basename "$BACKUP_DIR" | cut -d'_' -f2-)"

echo "Restoring DevFlow databases from backup $TIMESTAMP"

# Restore simple database
if [[ -f "$BACKUP_DIR/devflow_simple_$TIMESTAMP.sqlite" ]]; then
    echo "Restoring simple database..."
    cp "$BACKUP_DIR/devflow_simple_$TIMESTAMP.sqlite" "data/devflow.sqlite"
    echo "Simple database restored"
fi

# Restore advanced database
if [[ -f "$BACKUP_DIR/devflow_advanced_$TIMESTAMP.sqlite" ]]; then
    echo "Restoring advanced database..."
    cp "$BACKUP_DIR/devflow_advanced_$TIMESTAMP.sqlite" "devflow.sqlite"
    echo "Advanced database restored"
fi

echo "Restore completed successfully"
EOF

    chmod +x "$BACKUP_SUBDIR/restore.sh"

    success "Backup completed successfully"
    log "Backup location: $BACKUP_SUBDIR"
    log "Restore script: $BACKUP_SUBDIR/restore.sh"

    # Display backup summary
    echo ""
    echo "=== BACKUP SUMMARY ==="
    echo "Timestamp: $TIMESTAMP"
    echo "Location: $BACKUP_SUBDIR"
    echo "Files:"
    ls -la "$BACKUP_SUBDIR/"
}

# Run main function
main "$@"