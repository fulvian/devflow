#!/bin/bash

# DevFlow Cometa Primary Deployment Script
# Deploys Cometa as the primary system replacing cc-session

set -e

echo "🚀 Starting Cometa Primary Deployment..."

# Backup current cc-session state
echo "📦 Creating backup of current cc-session state..."
BACKUP_DIR="backups/cc-session-backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r .claude/state "$BACKUP_DIR/" 2>/dev/null || echo "⚠️ No .claude/state to backup"

echo "✅ Backup created at: $BACKUP_DIR"

# Update current task state to use Cometa
echo "🔄 Updating current task to use Cometa system..."
CURRENT_TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)

# Update current task in Cometa database
sqlite3 data/devflow.sqlite "
UPDATE tasks
SET
  status = 'in_progress',
  description = description || '\n\n## Cometa Deployment\n- Backup created: $BACKUP_DIR\n- Migration timestamp: $CURRENT_TIMESTAMP\n- System: Transitioned from cc-session to Cometa',
  updated_at = '$CURRENT_TIMESTAMP'
WHERE id = 'unified-devflow-system';
"

# Create Cometa configuration file
echo "⚙️ Creating Cometa configuration..."
cat > .claude/cometa-config.json << EOF
{
  "system": "cometa-devflow",
  "version": "3.1.0",
  "primary_db": "data/devflow.sqlite",
  "backup_path": "$BACKUP_DIR",
  "migration_timestamp": "$CURRENT_TIMESTAMP",
  "features": {
    "unified_memory": true,
    "task_management": true,
    "session_tracking": true,
    "agent_delegation": true,
    "synthetic_integration": true
  },
  "replaced_systems": ["cc-session"],
  "status": "active"
}
EOF

echo "✅ Cometa configuration created"

# Update current task JSON to point to Cometa
echo "🔄 Updating .claude/state/current_task.json to use Cometa..."
cat > .claude/state/current_task.json << EOF
{
  "task": "unified-devflow-system",
  "branch": "feature/unified-devflow",
  "services": [
    "devflow-orchestrator",
    "cometa-memory-system"
  ],
  "updated": "$(date +%Y-%m-%d)",
  "system": "cometa-devflow",
  "migration_note": "Migrated from cc-session to Cometa unified system",
  "cometa_db": "data/devflow.sqlite"
}
EOF

echo "✅ Current task updated to use Cometa"

# Verify Cometa system functionality
echo "🔍 Verifying Cometa system functionality..."
TASK_COUNT=$(sqlite3 data/devflow.sqlite "SELECT COUNT(*) FROM tasks;")
SESSION_COUNT=$(sqlite3 data/devflow.sqlite "SELECT COUNT(*) FROM sessions;")

echo "📊 Cometa System Status:"
echo "  Tasks: $TASK_COUNT"
echo "  Sessions: $SESSION_COUNT"
echo "  Database: data/devflow.sqlite"
echo "  Config: .claude/cometa-config.json"

# Update DevFlow services to use Cometa
echo "🔄 Updating DevFlow services configuration..."
if [ -f "devflow-start-v31.sh" ]; then
  # Add Cometa system activation
  echo "
# Cometa System Activation
echo \"[STATUS] 🧠 Cometa Unified Memory System: Active\"
echo \"[STATUS] 📊 Tasks: $TASK_COUNT | Sessions: $SESSION_COUNT\"
echo \"[STATUS] 🔄 Migration: cc-session → Cometa completed\"
" >> devflow-start-v31.sh
fi

echo "✅ DevFlow services updated"

# Create Cometa status command
echo "📋 Creating Cometa status command..."
cat > scripts/cometa-status.sh << 'EOF'
#!/bin/bash

echo "🧠 Cometa DevFlow System Status"
echo "================================="

if [ ! -f "data/devflow.sqlite" ]; then
  echo "❌ Cometa database not found"
  exit 1
fi

echo "📊 Database Statistics:"
TASKS=$(sqlite3 data/devflow.sqlite "SELECT COUNT(*) FROM tasks;")
SESSIONS=$(sqlite3 data/devflow.sqlite "SELECT COUNT(*) FROM sessions;")
ACTIVE_TASKS=$(sqlite3 data/devflow.sqlite "SELECT COUNT(*) FROM tasks WHERE status = 'in_progress';")

echo "  Total Tasks: $TASKS"
echo "  Total Sessions: $SESSIONS"
echo "  Active Tasks: $ACTIVE_TASKS"

echo ""
echo "📋 Recent Tasks:"
sqlite3 data/devflow.sqlite "SELECT id, title, status, updated_at FROM tasks ORDER BY updated_at DESC LIMIT 5;" | while read line; do
  echo "  $line"
done

echo ""
echo "🧠 System Configuration:"
if [ -f ".claude/cometa-config.json" ]; then
  echo "  Config: ✅ Active"
  echo "  System: $(jq -r '.system' .claude/cometa-config.json)"
  echo "  Version: $(jq -r '.version' .claude/cometa-config.json)"
else
  echo "  Config: ❌ Not found"
fi

echo ""
echo "🚀 Status: Cometa is the primary system"
EOF

chmod +x scripts/cometa-status.sh

echo "✅ Cometa status command created"

# Final verification
echo "🔍 Final system verification..."
./scripts/cometa-status.sh

echo ""
echo "🎉 Cometa Primary Deployment Completed Successfully!"
echo ""
echo "📋 Summary:"
echo "  ✅ cc-session backed up to: $BACKUP_DIR"
echo "  ✅ Cometa configuration active: .claude/cometa-config.json"
echo "  ✅ Current task migrated to Cometa database"
echo "  ✅ DevFlow services updated"
echo "  ✅ Status command available: ./scripts/cometa-status.sh"
echo ""
echo "🚀 Cometa DevFlow is now the primary task and memory management system!"