#!/bin/bash

#################################################################
# CLAUDE CODE CONTEXT EMERGENCY ROLLBACK SYSTEM
# Context7-Compliant Emergency Recovery Protocol
#
# USAGE:
#   bash .claude/emergency/context-rollback.sh
#   OR via environment: CLAUDE_CONTEXT_EMERGENCY=true
#
# DESCRIPTION:
#   Immediately disables Enhanced Memory context replacement
#   and restores native Claude Code context management
#################################################################

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

print_emergency() {
    echo -e "${RED}[EMERGENCY]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

emergency_rollback() {
    print_emergency "🚨 ACTIVATING CLAUDE CODE CONTEXT EMERGENCY ROLLBACK"
    print_emergency "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Step 1: Create emergency flag file
    echo "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")" > "$PROJECT_ROOT/.claude/emergency/CONTEXT_ROLLBACK_ACTIVE"
    print_success "Emergency rollback flag created"

    # Step 2: Disable Enhanced Memory context interception
    if [ -f "$PROJECT_ROOT/.claude/hooks/context-interceptor.py" ]; then
        mv "$PROJECT_ROOT/.claude/hooks/context-interceptor.py" "$PROJECT_ROOT/.claude/hooks/context-interceptor.py.EMERGENCY_DISABLED"
        print_success "Context interceptor disabled"
    fi

    # Step 3: Disable Enhanced Memory integration hook
    if [ -f "$PROJECT_ROOT/.claude/hooks/enhanced-memory-integration.py" ]; then
        mv "$PROJECT_ROOT/.claude/hooks/enhanced-memory-integration.py" "$PROJECT_ROOT/.claude/hooks/enhanced-memory-integration.py.EMERGENCY_DISABLED"
        print_success "Enhanced Memory integration disabled"
    fi

    # Step 4: Set emergency environment variables
    export CLAUDE_CONTEXT_NATIVE_ONLY=true
    export CLAUDE_CONTEXT_ENHANCED_DISABLED=true
    export CLAUDE_CONTEXT_EMERGENCY_MODE=true

    # Step 5: Kill Enhanced Memory processes
    pkill -f "enhanced-memory-service" 2>/dev/null || true
    pkill -f "context-bridge-service" 2>/dev/null || true
    pkill -f "memory-bridge-runner" 2>/dev/null || true
    print_success "Enhanced Memory processes terminated"

    # Step 6: Create emergency config
    cat > "$PROJECT_ROOT/.claude/emergency/emergency-context-config.json" << EOF
{
    "emergency_mode": true,
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")",
    "native_context_only": true,
    "enhanced_memory_disabled": true,
    "context_interception_disabled": true,
    "rollback_reason": "emergency_activation",
    "restore_command": "bash .claude/emergency/context-restore.sh"
}
EOF

    print_success "Emergency configuration saved"

    # Step 7: Update DevFlow status
    if [ -f "$PROJECT_ROOT/.devflow/system-status.json" ]; then
        jq '.context_system = "native_emergency" | .enhanced_memory = "disabled" | .last_emergency = "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"' \
           "$PROJECT_ROOT/.devflow/system-status.json" > "$PROJECT_ROOT/.devflow/system-status.json.tmp" &&
        mv "$PROJECT_ROOT/.devflow/system-status.json.tmp" "$PROJECT_ROOT/.devflow/system-status.json"
        print_success "DevFlow status updated"
    fi

    # Step 8: Create emergency instructions
    cat > "$PROJECT_ROOT/.claude/emergency/README.md" << EOF
# CLAUDE CODE CONTEXT EMERGENCY MODE ACTIVE

**Emergency rollback activated at: $(date -u +"%Y-%m-%dT%H:%M:%S.000Z")**

## Current State
- ✅ Native Claude Code context management: **ACTIVE**
- ❌ Enhanced Memory context replacement: **DISABLED**
- ❌ Context interception: **DISABLED**
- ❌ Predictive context injection: **DISABLED**

## To Restore Enhanced Memory Context (when safe):
\`\`\`bash
bash .claude/emergency/context-restore.sh
\`\`\`

## Emergency Status Files:
- Emergency flag: \`.claude/emergency/CONTEXT_ROLLBACK_ACTIVE\`
- Emergency config: \`.claude/emergency/emergency-context-config.json\`
- This file: \`.claude/emergency/README.md\`

## Logs Location:
- Emergency logs: \`.claude/emergency/rollback.log\`

**Note**: Claude Code will continue to work normally with native context management.
Enhanced Memory features will be unavailable until restored.
EOF

    # Step 9: Log emergency activation
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")] EMERGENCY ROLLBACK ACTIVATED" >> "$PROJECT_ROOT/.claude/emergency/rollback.log"
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")] Native context management restored" >> "$PROJECT_ROOT/.claude/emergency/rollback.log"

    print_emergency "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_success "🎯 EMERGENCY ROLLBACK COMPLETED SUCCESSFULLY"
    print_success "✅ Claude Code context management is now NATIVE ONLY"
    print_success "📖 Instructions saved to: .claude/emergency/README.md"
    print_warning "⚠️  Enhanced Memory features are DISABLED until manually restored"

    return 0
}

# Check if emergency mode is already active
if [ -f "$PROJECT_ROOT/.claude/emergency/CONTEXT_ROLLBACK_ACTIVE" ]; then
    print_warning "Emergency rollback is already active"
    print_warning "To restore: bash .claude/emergency/context-restore.sh"
    exit 0
fi

# Create emergency directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/.claude/emergency"

# Execute emergency rollback
emergency_rollback

print_emergency "🚀 Claude Code is ready to continue with NATIVE CONTEXT ONLY"
print_emergency "🔄 To restore Enhanced Memory: bash .claude/emergency/context-restore.sh"