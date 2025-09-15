#!/bin/bash

# DevFlow v3.1 Enhanced StatusLine
# Displays dynamic system status with progress, task info, and services

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FOOTER_STATE_FILE="$PROJECT_ROOT/.devflow/footer-state.json"
PS_BIN="$(command -v ps || echo /bin/ps)"

# Colors for status display (Ayu-ish palette)
RED='\033[38;5;203m'
GREEN='\033[38;5;114m'
YELLOW='\033[38;5;215m'
BLUE='\033[38;5;111m'
CYAN='\033[38;5;117m'
PURPLE='\033[38;5;141m'
DIM='\033[38;5;242m'
NC='\033[0m' # No Color

# Unicode blocks for progress bar
FULL_BLOCK="█"
EMPTY_BLOCK="░"

probe_services_live() {
    local active=0
    local total=8
    local pid_files=(".database.pid" ".registry.pid" ".vector.pid" ".optimizer.pid" ".ccr.pid" ".enforcement.pid" ".orchestrator.pid")
    for pidf in "${pid_files[@]}"; do
        if [ -f "$PROJECT_ROOT/$pidf" ]; then
            local pid
            pid=$(tr -d '\n' < "$PROJECT_ROOT/$pidf" 2>/dev/null || echo "")
            if [ "$pid" = "MCP_READY" ]; then
                ((active++))
            elif [ -n "$pid" ] && [[ "$pid" =~ ^[0-9]+$ ]] && "$PS_BIN" -p "$pid" >/dev/null 2>&1; then
                ((active++))
            fi
        fi
    done
    # Synthetic check
    if [ -f "$PROJECT_ROOT/.synthetic.pid" ] && [ "$(cat "$PROJECT_ROOT/.synthetic.pid" 2>/dev/null | tr -d '\n')" = "MCP_READY" ]; then
        ((active++))
    elif command -v curl >/dev/null 2>&1 && curl -sf --max-time 1 "$SYN_HEALTH_URL" >/dev/null 2>&1; then
        ((active++))
    fi
    local status="PARTIAL"
    if [ $active -ge 6 ]; then status="PRODUCTION"; fi
    if [ $active -lt 3 ]; then status="DEGRADED"; fi
    echo "$active $total $status"
}

generate_progress_bar() {
    local percentage=$1
    local width=${2:-10}
    if [ "$percentage" -lt 0 ]; then percentage=0; fi
    if [ "$percentage" -gt 100 ]; then percentage=100; fi
    local filled=$((percentage * width / 100))
    local empty=$((width - filled))

    # Color: low→warn→good
    local color="$YELLOW"
    if [ $percentage -lt 50 ]; then
        color=$YELLOW
    elif [ $percentage -lt 80 ]; then
        color=$BLUE
    else
        color=$GREEN
    fi

    local bar=""
    for ((i=0; i<filled; i++)); do bar+="$FULL_BLOCK"; done
    for ((i=0; i<empty; i++)); do bar+="$EMPTY_BLOCK"; done

    echo -e "${color}${bar}${NC}"
}

get_fallback_status() {
    # Fallback status when footer-state.json is not available
    local active_services=0
    # Measured services (real):
    local pid_files=(".database.pid" ".registry.pid" ".vector.pid" ".optimizer.pid" ".ccr.pid" ".enforcement.pid" ".orchestrator.pid")
    local total_services=8

    for pid_file in "${pid_files[@]}"; do
        if [ -f "$PROJECT_ROOT/$pid_file" ]; then
            local pid=$(cat "$PROJECT_ROOT/$pid_file" 2>/dev/null || echo "")
            if [ "$pid" = "MCP_READY" ]; then
                ((active_services++))
            elif [ -n "$pid" ] && [[ "$pid" =~ ^[0-9]+$ ]] && "$PS_BIN" -p "$pid" >/dev/null 2>&1; then
                ((active_services++))
            fi
        fi
    done

    # Check Synthetic MCP: prefer sentinel file, then health
    if [ -f "$PROJECT_ROOT/.synthetic.pid" ] && [ "$(cat "$PROJECT_ROOT/.synthetic.pid" 2>/dev/null | tr -d '\n' )" = "MCP_READY" ]; then
        ((active_services++))
    elif command -v curl >/dev/null 2>&1 && curl -sf --max-time 1 "$SYN_HEALTH_URL" >/dev/null 2>&1; then
        ((active_services++))
    fi

    local percentage=$((active_services * 100 / total_services))
    local status="PARTIAL"
    if [ $active_services -ge 6 ]; then status="PRODUCTION"; fi
    if [ $active_services -lt 3 ]; then status="DEGRADED"; fi

    # Mode from environment if available
    local mode="DEV"
    if [ "${NODE_ENV}" = "production" ]; then mode="PRODUCTION"; fi

    echo "{\"progress\":{\"percentage\":$percentage,\"current_task\":\"devflow-v3_1-deployment\"},\"system\":{\"status\":\"$status\",\"services_active\":$active_services,\"services_total\":$total_services},\"mode\":\"$mode\"}"
}

read_footer_state() {
    # Prefer persisted state (real), fallback to live probe
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

    # Prefer robust parsing via Python if available, else grep fallback
    if command -v python3 >/dev/null 2>&1; then
        local parsed
        parsed=$(STATE_JSON="$state_json" python3 - <<'PY'
import json,os
data=json.loads(os.environ.get('STATE_JSON','{}'))
p=data.get('progress',{}).get('percentage')
ct=data.get('progress',{}).get('current_task')
sysstat=data.get('system',{}).get('status')
sa=data.get('system',{}).get('services_active')
st=data.get('system',{}).get('services_total')
mode=data.get('mode')
last=data.get('last_tool')
print(*(str(x) if x is not None else '' for x in [p,ct,sysstat,sa,st,mode,last]))
PY
)
        read -r percentage current_task system_status services_active services_total mode last_tool <<< "$parsed"
    else
        percentage=$(echo "$state_json" | grep -o '"progress":{[^}]*}' | grep -o '"percentage":[0-9]*' | cut -d':' -f2)
        current_task=$(echo "$state_json" | grep -o '"progress":{[^}]*}' | grep -o '"current_task":"[^"]*"' | cut -d'"' -f4)
        system_status=$(echo "$state_json" | grep -o '"system":{[^}]*}' | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        services_active=$(echo "$state_json" | grep -o '"system":{[^}]*}' | grep -o '"services_active":[0-9]*' | cut -d':' -f2)
        services_total=$(echo "$state_json" | grep -o '"system":{[^}]*}' | grep -o '"services_total":[0-9]*' | cut -d':' -f2)
        mode=$(echo "$state_json" | grep -o '"mode":"[^"]*"' | cut -d'"' -f4)
        last_tool=$(echo "$state_json" | grep -o '"last_tool":"[^"]*"' | cut -d'"' -f4)
    fi

    # Sensible defaults from measured data, no fake 100%
    if [ -z "$percentage" ] && [ -n "$services_active" ] && [ -n "$services_total" ] && [ "$services_total" -gt 0 ]; then
        percentage=$((services_active * 100 / services_total))
    fi
    percentage=${percentage:-0}
    current_task=${current_task:-"devflow-v3_1-deployment"}
    system_status=${system_status:-"PARTIAL"}
    services_active=${services_active:-0}
    services_total=${services_total:-8}
    if [ -z "$mode" ]; then
        if [ "${NODE_ENV}" = "production" ]; then mode="PRODUCTION"; else mode="DEV"; fi
    fi

    # Generate progress bar and readable task
    local progress_bar=$(generate_progress_bar "$percentage" 10)
    local formatted_task=$(format_task_name "$current_task")

    # Status color
    local status_color="$CYAN"
    case "$system_status" in
        "PRODUCTION") status_color=$GREEN ;;
        "PARTIAL") status_color=$YELLOW ;;
        "DEGRADED") status_color=$RED ;;
    esac

    # Icons
    local dot="·"
    local task_icon="📌"
    local svc_icon="🔥"
    local tool_icon="🛠"

    # Line 1: Task and progress (clear, compact)
    echo -e "${task_icon} ${PURPLE}${formatted_task}${NC} ${DIM}${dot}${NC} ${progress_bar} ${CYAN}${percentage}%${NC}"

    # Line 2: Platform status with services and env/mode
    # Live services probe overrides file values to avoid staleness
    read -r live_active live_total live_status <<< "$(probe_services_live)"
    if [ -n "$live_active" ] && [ "$live_total" -gt 0 ]; then
        services_active="$live_active"; services_total="$live_total"; system_status="$live_status";
        case "$system_status" in
            "PRODUCTION") status_color=$GREEN ;;
            "PARTIAL") status_color=$YELLOW ;;
            "DEGRADED") status_color=$RED ;;
        esac
    fi

    local mode_display="$mode"
    echo -e "${BLUE}DevFlow v3.1${NC} ${DIM}${dot}${NC} ${status_color}${system_status}${NC} ${DIM}${dot}${NC} ${svc_icon} ${services_active}/${services_total} services ${DIM}${dot}${NC} ${CYAN}${mode_display}${NC}"${last_tool:+" ${DIM}${dot}${NC} ${tool_icon} ${last_tool}"}
}

# Run main function
main
# Configurable Synthetic health URL
SYN_HEALTH_URL="${DEVFLOW_SYNTHETIC_HEALTH_URL:-http://localhost:3000/health}"
