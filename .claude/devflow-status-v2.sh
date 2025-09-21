#!/bin/bash

# DEVFLOW-FOOTER-001: Modern Claude Code-style footer with status dots
# Single-line layout with real data integration from current_task.json and .*.pid files

set -euo pipefail

# Color definitions (ANSI 16-color mode for compatibility)
readonly RESET="\033[0m"
readonly GRAY="\033[38;5;240m"
readonly GREEN="\033[38;5;76m"
readonly YELLOW="\033[38;5;220m"
readonly RED="\033[38;5;196m"
readonly BLUE="\033[38;5;39m"
readonly MAGENTA="\033[38;5;129m"

# Status dot indicators
readonly DOT_ACTIVE="${GREEN}●${RESET}"
readonly DOT_STANDBY="${YELLOW}●${RESET}"
readonly DOT_IDLE="${GRAY}●${RESET}"

# Data sources
readonly CURRENT_TASK_FILE=".claude/state/current_task.json"
readonly PID_PATTERN=".*.pid"
readonly TASKS_DIR="sessions/tasks"

# Error handling
error_exit() {
    echo -e "${RED}Error: $1${RESET}" >&2
    exit 1
}

# Get current task info from JSON file
get_current_task() {
    if [[ ! -f "$CURRENT_TASK_FILE" ]]; then
        echo "none|0"
        return
    fi

    local task_name progress
    task_name=$(jq -r '.task // "unknown"' "$CURRENT_TASK_FILE" 2>/dev/null) || task_name="unknown"
    progress=$(jq -r '.progress_percentage // 0' "$CURRENT_TASK_FILE" 2>/dev/null) || progress=0
    
    echo "$task_name|$progress"
}

# Count running services from .*.pid files
count_running_services() {
    local count=0
    for pid_file in .$PID_PATTERN; do
        [[ -f "$pid_file" ]] && ((count++))
    done
    echo "$count"
}

# Count standby tasks in sessions/tasks directory
count_standby_tasks() {
    local count=0
    [[ -d "$TASKS_DIR" ]] && count=$(find "$TASKS_DIR" -name "*.task" 2>/dev/null | wc -l)
    echo "$count"
}

# Generate status dots for services
generate_service_dots() {
    local service_count=$1
    local dots=""
    
    for ((i=1; i<=5; i++)); do
        if ((i <= service_count)); then
            dots+="$DOT_ACTIVE"
        else
            dots+="$DOT_IDLE"
        fi
    done
    echo "$dots"
}

# Generate status dots for standby tasks
generate_task_dots() {
    local task_count=$1
    local dots=""
    
    for ((i=1; i<=5; i++)); do
        if ((i <= task_count)); then
            dots+="$DOT_STANDBY"
        else
            dots+="$DOT_IDLE"
        fi
    done
    echo "$dots"
}

# Format progress percentage
format_progress() {
    local progress=$1
    if ((progress == 0)); then
        echo ""
    else
        printf "%d%%" "$progress"
    fi
}

# Main execution
main() {
    # Get all data
    local task_data
    task_data=$(get_current_task) || error_exit "Failed to read current task"
    local task_name=${task_data%|*}
    local progress=${task_data#*|}
    
    local service_count
    service_count=$(count_running_services) || error_exit "Failed to count services"
    
    local standby_count
    standby_count=$(count_standby_tasks) || error_exit "Failed to count standby tasks"
    
    # Generate status dots
    local service_dots
    service_dots=$(generate_service_dots "$service_count")
    
    local task_dots
    task_dots=$(generate_task_dots "$standby_count")
    
    local progress_text
    progress_text=$(format_progress "$progress")
    
    # Output single-line footer
    echo -e "${GRAY}🧠 ${task_name}${progress_text} │ ⚙️ ${service_dots} │ 📋 ${task_dots} │ 🎯 ${standby_count}${RESET}"
}

# Execute main function
main