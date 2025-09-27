#!/bin/bash

# INSTALL ENFORCEMENT HOOK SYSTEM
# Installa il sistema di redirect automatico all'Unified Orchestrator

HOOK_DIR=".claude/hooks"
CONFIG_FILE=".claude/config/claude.json"

echo "Installing enforcement hook system..."

# Make hooks executable
chmod +x "$HOOK_DIR/line-counter.js"
chmod +x "$HOOK_DIR/orchestrator-client.js"
chmod +x "$HOOK_DIR/pre-tool-use-redirect.js"

# Test orchestrator connection
echo "Testing Unified Orchestrator connection..."
curl -s http://localhost:3005/api/health > /dev/null

if [ $? -eq 0 ]; then
    echo "✅ Unified Orchestrator reachable on port 3005"
else
    echo "❌ WARNING: Unified Orchestrator not reachable on port 3005"
    echo "   Make sure to start the orchestrator before using hooks"
fi

# Create test
echo "Creating test hook..."
node "$HOOK_DIR/pre-tool-use-redirect.js"

echo "✅ Enforcement hook system installed successfully!"
echo ""
echo "How it works:"
echo "1. Pre-tool-use hook intercepts Write/Edit/MultiEdit calls"
echo "2. If >100 lines and not claude-only mode:"
echo "3. → Automatically redirects to Unified Orchestrator (port 3005)"
echo "4. → Orchestrator handles CLI → Synthetic fallback chain"
echo "5. → No manual intervention required"
echo ""
echo "To bypass: Set claude-only mode in .claude/state/daic-mode.json"