#!/bin/bash

# DevFlow Simple Footer - Clean, readable, beautiful
# Format: DevFlow │ task-name 75% │ 14/16 services │ 92% context

# Colors
GREEN='\033[32m'
BLUE='\033[34m'
YELLOW='\033[33m'
DIM='\033[90m'
RESET='\033[0m'

# Get task info
TASK_FILE=".claude/state/current_task.json"
if [ -f "$TASK_FILE" ]; then
    TASK_NAME=$(jq -r '.task // "no-task"' "$TASK_FILE" 2>/dev/null | sed 's/devflow-//' | sed 's/-real-integration//')
    TASK_PROGRESS=$(jq -r '.progress_percentage // 0' "$TASK_FILE" 2>/dev/null)
else
    TASK_NAME="no-task"
    TASK_PROGRESS=0
fi

# Count active services
ACTIVE_SERVICES=0
TOTAL_SERVICES=0
for pid_file in .*.pid; do
    if [ -f "$pid_file" ]; then
        TOTAL_SERVICES=$((TOTAL_SERVICES + 1))
        pid=$(cat "$pid_file" 2>/dev/null)
        if [ "$pid" = "MCP_READY" ] || ([ -n "$pid" ] && kill -0 "$pid" 2>/dev/null); then
            ACTIVE_SERVICES=$((ACTIVE_SERVICES + 1))
        fi
    fi
done

# Get context usage from ccusage
CONTEXT_PCT=0
if command -v ccusage >/dev/null && command -v jq >/dev/null; then
    TODAY_TOKENS=$(ccusage --json 2>/dev/null | jq -r '.daily[-1].totalTokens // 0')
    if [ "$TODAY_TOKENS" -gt 0 ]; then
        CONTEXT_PCT=$((TODAY_TOKENS * 100 / 200000000))  # 200M token limit
        if [ "$CONTEXT_PCT" -gt 100 ]; then CONTEXT_PCT=100; fi
    fi
fi

# Format and display
echo -e "${BLUE}DevFlow${RESET} ${DIM}│${RESET} ${GREEN}${TASK_NAME}${RESET} ${YELLOW}${TASK_PROGRESS}%${RESET} ${DIM}│${RESET} ${GREEN}${ACTIVE_SERVICES}${RESET}/${TOTAL_SERVICES} services ${DIM}│${RESET} ${YELLOW}${CONTEXT_PCT}%${RESET} context"