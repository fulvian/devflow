#!/bin/bash
# DevFlow Memory System Auto-Backup
# Creates hourly backups of critical memory system files

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=".claude/memory-backups/backup_$TIMESTAMP"

echo "🔄 DevFlow Memory Backup: Creating backup at $TIMESTAMP"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Critical files to backup
CRITICAL_FILES=(
    ".claude/hooks/enhanced-memory-integration.py"
    ".claude/hooks/apscheduler-embedding-daemon.py"
    ".claude/hooks/universal-memory-injection.py"
    ".claude/hooks/embedding-auto-population.py"
    ".claude/hooks/context-interceptor.py"
    ".claude/hooks/unified-memory-injection.py"
    ".claude/hooks/unified-embedding-processor.py"
)

# Backup existing files
for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "$BACKUP_DIR/"
        echo "✅ Backed up: $file"
    elif [ -f "${file}.EMERGENCY_DISABLED" ]; then
        cp "${file}.EMERGENCY_DISABLED" "$BACKUP_DIR/$(basename $file).EMERGENCY_DISABLED"
        echo "⚠️  Backed up disabled: $file"
    fi
done

# Backup deactivated folder if exists
if [ -d ".claude/hooks/deactivated" ]; then
    cp -r ".claude/hooks/deactivated" "$BACKUP_DIR/"
    echo "✅ Backed up deactivated folder"
fi

# Clean old backups (keep last 48 hours = 48 backups)
find .claude/memory-backups/ -name "backup_*" -type d -mtime +2 -exec rm -rf {} \; 2>/dev/null

echo "✅ DevFlow Memory Backup completed: $BACKUP_DIR"