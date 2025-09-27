#!/bin/bash

# DevFlow Footer - Compact status display for DevFlow sessions
# Reads current task and system status, displays in a compact colorful format

set -euo pipefail

# Color definitions
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly MAGENTA='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m' # No Color

# Configuration
readonly SESSIONS_DIR="sessions"
readonly TASKS_DIR="${SESSIONS_DIR}/tasks"
readonly CURRENT_TASK_FILE=".claude/state/current_task.json"
readonly PID_FILES=(".database.pid" ".registry.pid" ".vector.pid" ".optimizer.pid" ".synthetic.pid" ".ccr.pid" ".enforcement.pid" ".fallback.pid" ".platform-status-tracker.pid" ".real-dream-team-orchestrator.pid" ".cli-integration-manager.pid" ".verification.pid")

# Initialize variables
task_name="None"
branch_name="None"
progress="0%"
services_count=0
running_services=0

# Function to safely read JSON values
read_json_value() {
    local file="$1"
    local key="$2"
    if [[ -f "$file" ]]; then
        jq -r ".$key" "$file" 2>/dev/null || echo "Unknown"
    else
        echo "Unknown"
    fi
}

# Get current task information
if [[ -f "$CURRENT_TASK_FILE" ]]; then
    task_name=$(read_json_value "$CURRENT_TASK_FILE" "task")
    branch_name=$(read_json_value "$CURRENT_TASK_FILE" "branch")
    progress=$(read_json_value "$CURRENT_TASK_FILE" "progress_percentage")
    progress="${progress}%"
    
    # Count services from the array
    if command -v jq >/dev/null 2>&1; then
        services_count=$(jq '.services | length' "$CURRENT_TASK_FILE" 2>/dev/null || echo "0")
    fi
fi

# Count running services
for pid_file in "${PID_FILES[@]}"; do
    if [[ -f "$pid_file" ]]; then
        pid=$(cat "$pid_file" 2>/dev/null || echo "")
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            ((running_services++))
        fi
    fi
done

# Calculate context size
context_size="0"
if [[ -d "$SESSIONS_DIR" ]]; then
    context_size=$(du -sh "$SESSIONS_DIR" 2>/dev/null | cut -f1 || echo "0")
fi

# Count standby tasks
standby_tasks=0
if [[ -d "$TASKS_DIR" ]]; then
    standby_tasks=$(find "$TASKS_DIR" -name "*.md" ! -name "TEMPLATE.md" 2>/dev/null | wc -l | tr -d ' ')
fi

# Display compact footer
printf "${BLUE}DF${NC} [${GREEN}%s${NC}][${YELLOW}%s${NC}][${CYAN}%s${NC}][${MAGENTA}%s${NC}/${BLUE}%s${NC}][${RED}%s${NC}][${YELLOW}%s${NC}]\n" \
    "$task_name" \
    "$branch_name" \
    "$progress" \
    "$running_services" \
    "${#PID_FILES[@]}" \
    "$context_size" \
    "${standby_tasks}T"