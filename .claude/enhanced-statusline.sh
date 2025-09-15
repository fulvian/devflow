#!/bin/bash

# DevFlow v3.1 Enhanced StatusLine
# Based on cc-sessions successful footer implementation pattern
# Displays dynamic system status with progress bar, task info, and service monitoring

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FOOTER_STATE_FILE="$PROJECT_ROOT/.devflow/footer-state.json"

# Colors for status display
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Unicode blocks for progress bar
FULL_BLOCK="█"
EMPTY_BLOCK="░"

generate_progress_bar() {
    local percentage=$1
    local width=10
    local filled=$((percentage * width / 100))
    local empty=$((width - filled))

    local color=""
    if [ $percentage -lt 50 ]; then
        color=$GREEN
    elif [ $percentage -lt 80 ]; then
        color=$YELLOW
    else
        color=$RED
    fi

    local bar=""
    for ((i=0; i<filled; i++)); do
        bar+="$FULL_BLOCK"
    done
    for ((i=0; i<empty; i++)); do
        bar+="$EMPTY_BLOCK"
    done

    echo -e "${color}${bar}${NC}"
}

get_fallback_status() {
    # Fallback status when footer-state.json is not available
    local active_services=0
    local total_services=7

    # Check basic service status
    local pid_files=(".database.pid" ".registry.pid" ".vector.pid" ".optimizer.pid" ".synthetic.pid" ".ccr.pid" ".enforcement.pid")

    for pid_file in "${pid_files[@]}"; do
        if [ -f "$PROJECT_ROOT/$pid_file" ]; then
            local pid=$(cat "$PROJECT_ROOT/$pid_file" 2>/dev/null || echo "")
            if [ "$pid" = "MCP_READY" ]; then
                ((active_services++))
            elif [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
                ((active_services++))
            fi
        fi
    done

    local percentage=$((active_services * 100 / total_services))
    local status="PARTIAL"
    if [ $active_services -ge 6 ]; then
        status="PRODUCTION"
    elif [ $active_services -lt 3 ]; then
        status="DEGRADED"
    fi

    echo "{\"progress\":{\"percentage\":$percentage,\"current_task\":\"devflow-v3_1-deployment\"},\"system\":{\"status\":\"$status\",\"services_active\":$active_services,\"services_total\":$total_services},\"mode\":\"PRODUCTION\"}"
}

read_footer_state() {
    if [ -f "$FOOTER_STATE_FILE" ]; then
        cat "$FOOTER_STATE_FILE" 2>/dev/null || get_fallback_status
    else
        get_fallback_status
    fi
}

format_task_name() {
    local task=$1
    # Truncate long task names
    if [ ${#task} -gt 25 ]; then
        echo "${task:0:22}..."
    else
        echo "$task"
    fi
}

main() {
    # Read current state
    local state_json=$(read_footer_state)

    # Parse JSON using basic shell tools (jq-free approach)
    local percentage=$(echo "$state_json" | grep -o '"percentage":[0-9]*' | cut -d':' -f2)
    local current_task=$(echo "$state_json" | grep -o '"current_task":"[^"]*"' | cut -d'"' -f4)
    local system_status=$(echo "$state_json" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    local services_active=$(echo "$state_json" | grep -o '"services_active":[0-9]*' | cut -d':' -f2)
    local services_total=$(echo "$state_json" | grep -o '"services_total":[0-9]*' | cut -d':' -f2)
    local mode=$(echo "$state_json" | grep -o '"mode":"[^"]*"' | cut -d'"' -f4)

    # Default values if parsing fails
    percentage=${percentage:-75}
    current_task=${current_task:-"devflow-v3_1"}
    system_status=${system_status:-"PRODUCTION"}
    services_active=${services_active:-6}
    services_total=${services_total:-7}
    mode=${mode:-"PRODUCTION"}

    # Generate progress bar
    local progress_bar=$(generate_progress_bar $percentage)

    # Format task name
    local formatted_task=$(format_task_name "$current_task")

    # Determine status color
    local status_color=""
    case "$system_status" in
        "PRODUCTION") status_color=$GREEN ;;
        "PARTIAL") status_color=$YELLOW ;;
        "DEGRADED") status_color=$RED ;;
        *) status_color=$CYAN ;;
    esac

    # Create status display (cc-sessions style)
    # Line 1: Progress bar with percentage and task
    echo -e "${progress_bar} ${CYAN}${percentage}%${NC} | Task: ${PURPLE}${formatted_task}${NC}"

    # Line 2: DevFlow info with system status and services
    echo -e "${BLUE}DevFlow v3.1${NC} | ${status_color}${system_status}${NC} | ✎ ${services_active}/${services_total} services | ${CYAN}${mode}${NC}"
}

# Run main function
main