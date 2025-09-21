#!/bin/bash

# 🧠 COMETA BRAIN ACTIVE FOOTER - Advanced AI-Enhanced DevFlow Status
# Format: 🧠 ComBrain │ task-name 100% │ Z3-Verified │ 14/16 AI-Agents │ Real-Time Context

# Colors and Effects
COMETA_BLUE='\033[96m'
BRAIN_PURPLE='\033[95m'
SUCCESS_GREEN='\033[92m'
ACTIVE_YELLOW='\033[93m'
Z3_ORANGE='\033[38;5;208m'
DIM='\033[90m'
BOLD='\033[1m'
RESET='\033[0m'

# Get task info
TASK_FILE=".claude/state/current_task.json"
if [ -f "$TASK_FILE" ]; then
    TASK_NAME=$(jq -r '.task // "cometa-brain"' "$TASK_FILE" 2>/dev/null | sed 's/devflow-//' | sed 's/-real-integration//')
    TASK_PROGRESS=$(jq -r '.progress_percentage // 100' "$TASK_FILE" 2>/dev/null)
else
    TASK_NAME="cometa-brain"
    TASK_PROGRESS=100
fi

# Cometa Brain status check
COMETA_STATUS="ACTIVE"
if [ -f ".devflow/verification-trigger.json" ]; then
    VERIFICATION_SYSTEM=$(jq -r '.verification_system // "DISABLED"' ".devflow/verification-trigger.json" 2>/dev/null)
    if [[ "$VERIFICATION_SYSTEM" == *"Z3"* ]]; then
        Z3_STATUS="${Z3_ORANGE}Z3-Verified${RESET}"
    else
        Z3_STATUS="${DIM}No-Z3${RESET}"
    fi
else
    Z3_STATUS="${DIM}No-Verif${RESET}"
fi

# Count AI agents (MCP services)
AI_AGENTS=0
TOTAL_AGENTS=0
for service_name in "synthetic" "gemini" "qwen" "codex" "cometa"; do
    TOTAL_AGENTS=$((TOTAL_AGENTS + 1))
    # Check if MCP service is running
    if [ -f ".${service_name}.pid" ]; then
        pid=$(cat ".${service_name}.pid" 2>/dev/null)
        if [ "$pid" = "MCP_READY" ] || ([ -n "$pid" ] && kill -0 "$pid" 2>/dev/null); then
            AI_AGENTS=$((AI_AGENTS + 1))
        fi
    fi
done

# Real-time context awareness indicator
CONTEXT_AWARENESS="Real-Time"
if [ -f "src/core/cometa/proactive-context-engine.ts" ]; then
    CONTEXT_AWARENESS="${SUCCESS_GREEN}Proactive${RESET}"
else
    CONTEXT_AWARENESS="${DIM}Static${RESET}"
fi

# Format and display Cometa Brain footer
echo -e "${BOLD}${BRAIN_PURPLE}🧠 ComBrain${RESET} ${DIM}│${RESET} ${COMETA_BLUE}${TASK_NAME}${RESET} ${SUCCESS_GREEN}${TASK_PROGRESS}%${RESET} ${DIM}│${RESET} ${Z3_STATUS} ${DIM}│${RESET} ${SUCCESS_GREEN}${AI_AGENTS}${RESET}/${TOTAL_AGENTS} AI-Agents ${DIM}│${RESET} ${CONTEXT_AWARENESS} Context"