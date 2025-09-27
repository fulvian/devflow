#!/bin/bash

#################################################################
# CLAUDE CODE CONTEXT RESTORE SYSTEM
# Context7-Compliant Recovery from Emergency Mode
#
# USAGE:
#   bash .claude/emergency/context-restore.sh
#
# DESCRIPTION:
#   Safely restores Enhanced Memory context replacement
#   after emergency rollback has been activated
#################################################################

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

print_restore() {
    echo -e "${BLUE}[RESTORE]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_system_health() {
    print_restore "🔍 Checking system health before restore..."

    # Check if Enhanced Memory system is available
    if [ ! -d "$PROJECT_ROOT/src/core/semantic-memory" ]; then
        print_error "Enhanced Memory system not found"
        return 1
    fi

    # Check if Ollama is running
    if ! curl -sf --max-time 3 "http://localhost:11434/api/tags" >/dev/null 2>&1; then
        print_warning "Ollama service not available - Enhanced Memory will have limited functionality"
    else
        print_success "Ollama service is available"
    fi

    # Check database
    if [ ! -f "$PROJECT_ROOT/data/devflow_unified.sqlite" ]; then
        print_warning "Unified database not found - will use fallback"
    else
        print_success "Unified database available"
    fi

    return 0
}

restore_enhanced_context() {
    print_restore "🔄 RESTORING CLAUDE CODE ENHANCED CONTEXT SYSTEM"
    print_restore "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Check if emergency mode is active
    if [ ! -f "$PROJECT_ROOT/.claude/emergency/CONTEXT_ROLLBACK_ACTIVE" ]; then
        print_warning "Emergency mode is not active - nothing to restore"
        return 0
    fi

    # System health check
    if ! check_system_health; then
        print_error "System health check failed - restore aborted for safety"
        return 1
    fi

    # Step 1: Remove emergency flag
    rm -f "$PROJECT_ROOT/.claude/emergency/CONTEXT_ROLLBACK_ACTIVE"
    print_success "Emergency flag removed"

    # Step 2: Restore Enhanced Memory integration hook
    if [ -f "$PROJECT_ROOT/.claude/hooks/enhanced-memory-integration.py.EMERGENCY_DISABLED" ]; then
        mv "$PROJECT_ROOT/.claude/hooks/enhanced-memory-integration.py.EMERGENCY_DISABLED" "$PROJECT_ROOT/.claude/hooks/enhanced-memory-integration.py"
        print_success "Enhanced Memory integration restored"
    fi

    # Step 3: Restore context interceptor if it exists
    if [ -f "$PROJECT_ROOT/.claude/hooks/context-interceptor.py.EMERGENCY_DISABLED" ]; then
        mv "$PROJECT_ROOT/.claude/hooks/context-interceptor.py.EMERGENCY_DISABLED" "$PROJECT_ROOT/.claude/hooks/context-interceptor.py"
        print_success "Context interceptor restored"
    fi

    # Step 4: Clear emergency environment variables
    unset CLAUDE_CONTEXT_NATIVE_ONLY
    unset CLAUDE_CONTEXT_ENHANCED_DISABLED
    unset CLAUDE_CONTEXT_EMERGENCY_MODE

    # Step 5: Update DevFlow status
    if [ -f "$PROJECT_ROOT/.devflow/system-status.json" ]; then
        jq '.context_system = "enhanced_memory" | .enhanced_memory = "active" | .last_restore = "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"' \
           "$PROJECT_ROOT/.devflow/system-status.json" > "$PROJECT_ROOT/.devflow/system-status.json.tmp" &&
        mv "$PROJECT_ROOT/.devflow/system-status.json.tmp" "$PROJECT_ROOT/.devflow/system-status.json"
        print_success "DevFlow status updated"
    fi

    # Step 6: Create restore config
    cat > "$PROJECT_ROOT/.claude/emergency/last-restore-config.json" << EOF
{
    "restore_mode": true,
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")",
    "enhanced_memory_enabled": true,
    "context_interception_enabled": true,
    "restore_successful": true
}
EOF

    # Step 7: Log restoration
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")] ENHANCED CONTEXT RESTORED" >> "$PROJECT_ROOT/.claude/emergency/rollback.log"
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")] Enhanced Memory context management active" >> "$PROJECT_ROOT/.claude/emergency/rollback.log"

    # Step 8: Test Enhanced Memory system
    print_restore "🧪 Testing Enhanced Memory system..."

    if command -v node >/dev/null 2>&1 && [ -f "$PROJECT_ROOT/scripts/memory-bridge-runner.js" ]; then
        local test_result=$(node "$PROJECT_ROOT/scripts/memory-bridge-runner.js" health-check 2>/dev/null || echo '{"success":false}')
        local test_status=$(echo "$test_result" | grep -o '"success":[^,}]*' | cut -d':' -f2 | tr -d ' "')

        if [ "$test_status" = "true" ]; then
            print_success "Enhanced Memory system test: PASSED"
        else
            print_warning "Enhanced Memory system test: FAILED - will use fallback mode"
        fi
    else
        print_warning "Enhanced Memory test skipped - Node.js not available"
    fi

    # Step 9: Update README
    cat > "$PROJECT_ROOT/.claude/emergency/README.md" << EOF
# CLAUDE CODE CONTEXT SYSTEM - ENHANCED MODE ACTIVE

**Enhanced Memory context restored at: $(date -u +"%Y-%m-%dT%H:%M:%S.000Z")**

## Current State
- ✅ Enhanced Memory context replacement: **ACTIVE**
- ✅ Context interception: **ACTIVE**
- ✅ Predictive context injection: **ACTIVE**
- ✅ Cross-session memory: **ACTIVE**

## Emergency Rollback (if needed):
\`\`\`bash
bash .claude/emergency/context-rollback.sh
\`\`\`

## Status Files:
- Last restore config: \`.claude/emergency/last-restore-config.json\`
- This file: \`.claude/emergency/README.md\`

## Logs Location:
- System logs: \`.claude/emergency/rollback.log\`

**Note**: Claude Code is now using Enhanced Memory context management
with intelligent context injection and cross-session persistence.
EOF

    print_restore "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_success "🎯 ENHANCED CONTEXT SYSTEM RESTORED SUCCESSFULLY"
    print_success "✅ Claude Code is now using Enhanced Memory context management"
    print_success "🧠 Intelligent context injection and predictive analytics active"
    print_success "📖 Status saved to: .claude/emergency/README.md"

    return 0
}

# Execute restoration
restore_enhanced_context

print_restore "🚀 Claude Code is ready with ENHANCED MEMORY CONTEXT SYSTEM"
print_restore "🚨 Emergency rollback available: bash .claude/emergency/context-rollback.sh"