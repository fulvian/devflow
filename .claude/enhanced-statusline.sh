#!/bin/bash

# DevFlow v3.1 Enhanced StatusLine - New Design
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
ORANGE='\033[38;5;208m'
DIM='\033[38;5;242m'
LIGHT_GRAY='\033[38;5;250m'
NC='\033[0m' # No Color

# Unicode blocks for progress bar
FULL_BLOCK="█"
EMPTY_BLOCK="░"

# Function to generate gradient color based on percentage (0% = green, 100% = red)
generate_gradient_color() {
    local percentage=$1
    
    if [ $percentage -le 25 ]; then
        echo -e "$GREEN"
    elif [ $percentage -le 50 ]; then
        echo -e "$YELLOW"
    elif [ $percentage -le 75 ]; then
        echo -e "$ORANGE"
    else
        echo -e "$RED"
    fi
}

# Function to generate progress bar with gradient colors
generate_progress_bar() {
    local percentage=$1
    local width=${2:-10}
    local invert_color=${3:-false}  # true for limits (green=0%, red=100%)
    
    if [ "$percentage" -lt 0 ]; then percentage=0; fi
    if [ "$percentage" -gt 100 ]; then percentage=100; fi
    
    local filled=$((percentage * width / 100))
    local empty=$((width - filled))
    
    # Choose color based on gradient and invert setting
    local color
    if [ "$invert_color" = "true" ]; then
        # For limits: 0% = green, 100% = red
        color=$(generate_gradient_color "$percentage")
    else
        # For progress: 0% = red, 100% = green
        local inverted_percentage=$((100 - percentage))
        color=$(generate_gradient_color "$inverted_percentage")
    fi
    
    local bar=""
    for ((i=0; i<filled; i++)); do bar+="$FULL_BLOCK"; done
    for ((i=0; i<empty; i++)); do bar+="$EMPTY_BLOCK"; done
    
    echo -e "${color}${bar}${NC}"
}

# Function to format token count
format_token_count() {
    local tokens=$1
    if [ "$tokens" -ge 1000 ]; then
        echo "$((tokens / 1000))k"
    else
        echo "$tokens"
    fi
}

# Function to get current task microtasks info
get_microtasks_info() {
    local current_task_file="$PROJECT_ROOT/.claude/state/current_task.json"
    
    # Get task data from current_task.json
    local total_microtasks=1
    local completed_microtasks=0
    local percentage=0
    
    if [ -f "$current_task_file" ]; then
        # Extract microtask progress
        total_microtasks=$(grep -o '"total_microtasks"[[:space:]]*:[[:space:]]*[0-9]*' "$current_task_file" | cut -d':' -f2 | tr -d ' ')
        completed_microtasks=$(grep -o '"completed_microtasks"[[:space:]]*:[[:space:]]*[0-9]*' "$current_task_file" | cut -d':' -f2 | tr -d ' ')
        
        # Set defaults if not found
        total_microtasks=${total_microtasks:-1}
        completed_microtasks=${completed_microtasks:-0}
    fi
    
    # Override with database data if available
    if [ -f "$PROJECT_ROOT/data/devflow.sqlite" ]; then
        local db_task_count=$(sqlite3 "$PROJECT_ROOT/data/devflow.sqlite" "SELECT COUNT(*) FROM task_contexts;" 2>/dev/null || echo "0")
        local db_active_tasks=$(sqlite3 "$PROJECT_ROOT/data/devflow.sqlite" "SELECT COUNT(*) FROM task_contexts WHERE status = 'active';" 2>/dev/null || echo "0")
        
        # If we have tasks in the database, use database info
        if [ "$db_task_count" -gt 0 ]; then
            total_microtasks=$db_task_count
            completed_microtasks=$((db_task_count - db_active_tasks))
        fi
    fi
    
    # Calculate percentage
    if [ "$total_microtasks" -gt 0 ]; then
        percentage=$((completed_microtasks * 100 / total_microtasks))
    fi
    
    echo "$completed_microtasks $total_microtasks $percentage"
}

# Function to get open tasks from sessions directory
get_open_tasks() {
    local tasks_dir="$PROJECT_ROOT/sessions/tasks"
    local open_tasks=""
    
    # First try to get tasks from database
    if [ -f "$PROJECT_ROOT/data/devflow.sqlite" ]; then
        # Get active tasks from database
        local active_tasks=$(sqlite3 "$PROJECT_ROOT/data/devflow.sqlite" "SELECT title FROM task_contexts WHERE status = 'active' LIMIT 3;" 2>/dev/null || echo "")
        
        if [ -n "$active_tasks" ]; then
            local count=0
            while IFS= read -r task_title; do
                if [ -n "$task_title" ]; then
                    # Try to get progress percentage from the task title or set to 0
                    local progress=0
                    open_tasks="$open_tasks$task_title($progress%) · "
                    ((count++))
                fi
            done <<< "$active_tasks"
            # Remove trailing " · "
            open_tasks=${open_tasks% · }
            echo "$open_tasks"
            return
        fi
    fi
    
    # Fallback to file-based approach
    if [ -d "$tasks_dir" ]; then
        # Find markdown files that don't have "status: completed" or "Status: done"
        for task_file in "$tasks_dir"/*.md; do
            if [ -f "$task_file" ]; then
                local task_name=$(basename "$task_file" .md)
                # Skip if it's the done directory or template
                if [[ "$task_name" != "TEMPLATE" ]] && [[ "$task_name" != "done" ]]; then
                    # Check if task is completed
                    if ! grep -q -E "status:\s*completed|Status:\s*done" "$task_file" 2>/dev/null; then
                        # Try to get progress percentage from the file
                        local progress=$(grep -o -E "progress_percentage:\s*[0-9]+" "$task_file" 2>/dev/null | cut -d':' -f2 | tr -d ' ')
                        if [ -z "$progress" ]; then
                            progress=0
                        fi
                        open_tasks="$open_tasks$task_name($progress%) · "
                    fi
                fi
            fi
        done
        # Remove trailing " · "
        open_tasks=${open_tasks% · }
    fi
    
    echo "$open_tasks"
}

# Function to get platform usage limits
get_platform_limits() {
    # Get real data for Qwen and Synthetic API from database
    local qwen_used=0
    local qwen_limit=1000  # Daily limit for Qwen
    local synthetic_used=0
    local synthetic_limit=135  # 5-hour limit for Synthetic API
    
    # Get Qwen usage (count of records in last 24 hours)
    if [ -f "$PROJECT_ROOT/data/devflow.sqlite" ]; then
        qwen_used=$(sqlite3 "$PROJECT_ROOT/data/devflow.sqlite" "SELECT COUNT(*) FROM synthetic_usage WHERE provider = 'qwen' AND created_at > datetime('now', '-24 hours');" 2>/dev/null || echo "0")
        synthetic_used=$(sqlite3 "$PROJECT_ROOT/data/devflow.sqlite" "SELECT COUNT(*) FROM synthetic_usage WHERE provider = 'synthetic' AND created_at > datetime('now', '-5 hours');" 2>/dev/null || echo "0")
    fi
    
    # For Codex and Gemini, we'll keep mock values or set them to 0 since we're focusing on Qwen and Synthetic
    local codex_usage=0
    local codex_limit=150
    local gemini_usage=0
    local gemini_limit=100
    
    echo "$codex_usage $codex_limit $gemini_usage $gemini_limit $qwen_used $qwen_limit $synthetic_used $synthetic_limit"
}

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

    # Try to get token count from current task file
    local token_count=17900
    if [ -f "$PROJECT_ROOT/.claude/state/current_task.json" ]; then
        token_count=$(cat "$PROJECT_ROOT/.claude/state/current_task.json" | grep -o '"token_count":[0-9]*' | cut -d':' -f2 | head -1)
        if [ -z "$token_count" ]; then
            token_count=17900
        fi
    fi

    echo "{\"progress\":{\"percentage\":$percentage,\"current_task\":\"devflow-v3_1-deployment\",\"token_count\":$token_count},\"system\":{\"status\":\"$status\",\"services_active\":$active_services,\"services_total\":$total_services},\"mode\":\"$mode\"}"
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

# Function to get open tasks from DevFlow database
get_open_tasks_db() {
    if [ -f "$PROJECT_ROOT/data/devflow.sqlite" ]; then
        # Get tasks that are not completed
        local open_tasks=$(sqlite3 "$PROJECT_ROOT/data/devflow.sqlite" "SELECT title, status FROM task_contexts WHERE status != 'completed' AND status != 'archived' LIMIT 4;" 2>/dev/null)
        if [ -n "$open_tasks" ]; then
            # Process the database results
            local task_list=""
            local count=0
            while IFS= read -r line; do
                if [ -n "$line" ] && [ $count -lt 4 ]; then
                    IFS='|' read -r title status <<< "$line"
                    # For now, we'll use a default progress of 0% since the database doesn't store progress
                    task_list="${task_list}${title}(0%) · "
                    ((count++))
                fi
            done <<< "$open_tasks"
            # Remove trailing " · "
            task_list=${task_list% · }
            if [ -n "$task_list" ]; then
                echo "$task_list"
                return
            fi
        fi
    fi
    # Fallback to session tasks directory
    local session_tasks=$(find "$PROJECT_ROOT/sessions/tasks" -name "*.md" -not -path "*/done/*" 2>/dev/null | head -4)
    if [ -n "$session_tasks" ]; then
        local task_list=""
        for task_file in $session_tasks; do
            local task_name=$(basename "$task_file" .md)
            task_list="${task_list}${task_name}(50%) · "
        done
        echo "${task_list% · }"
    else
        echo "no-tasks(0%)"
    fi
}

main() {
    # Read current state
    local state_json=$(read_footer_state)

    # Parse state with Python for reliability
    if command -v python3 >/dev/null 2>&1; then
        local parsed
        parsed=$(STATE_JSON="$state_json" python3 - <<'PY'
import json,os
data=json.loads(os.environ.get('STATE_JSON','{}'))
p=data.get('progress',{}).get('percentage')
ct=data.get('progress',{}).get('current_task')
tc=data.get('progress',{}).get('token_count')
sysstat=data.get('system',{}).get('status')
sa=data.get('system',{}).get('services_active')
st=data.get('system',{}).get('services_total')
mode=data.get('mode')
last=data.get('last_tool')
print(*(str(x) if x is not None else '' for x in [p,ct,tc,sysstat,sa,st,mode,last]))
PY
)
        read -r percentage current_task token_count system_status services_active services_total mode last_tool <<< "$parsed"
    else
        # Fallback to grep parsing
        percentage=$(echo "$state_json" | grep -o '"progress":{[^}]*}' | grep -o '"percentage":[0-9]*' | cut -d':' -f2)
        current_task=$(echo "$state_json" | grep -o '"progress":{[^}]*}' | grep -o '"current_task":"[^"]*"' | cut -d'"' -f4)
        token_count=$(echo "$state_json" | grep -o '"progress":{[^}]*}' | grep -o '"token_count":[0-9]*' | cut -d':' -f2)
        system_status=$(echo "$state_json" | grep -o '"system":{[^}]*}' | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        services_active=$(echo "$state_json" | grep -o '"system":{[^}]*}' | grep -o '"services_active":[0-9]*' | cut -d':' -f2)
        services_total=$(echo "$state_json" | grep -o '"system":{[^}]*}' | grep -o '"services_total":[0-9]*' | cut -d':' -f2)
        mode=$(echo "$state_json" | grep -o '"mode":"[^"]*"' | cut -d'"' -f4)
        last_tool=$(echo "$state_json" | grep -o '"last_tool":"[^"]*"' | cut -d'"' -f4)
    fi

    # Check if we have a valid percentage from state, otherwise derive from services
    if [ -n "$percentage" ] && [ "$percentage" -ge 0 ] && [ "$percentage" -le 100 ]; then
        # Use the provided percentage
        true
    elif [ -n "$services_active" ] && [ -n "$services_total" ] && [ "$services_total" -gt 0 ]; then
        # Derive from services if percentage is invalid
        percentage=$((services_active * 100 / services_total))
    else
        # Default to 0 if we can't determine
        percentage=0
    fi
    
    current_task=${current_task:-"devflow-v3_1-deployment"}
    system_status=${system_status:-"PARTIAL"}
    services_active=${services_active:-0}
    services_total=${services_total:-8}
    token_count=${token_count:-17900}
    if [ -z "$mode" ]; then
        if [ "${NODE_ENV}" = "production" ]; then mode="PRODUCTION"; else mode="DEV"; fi
    fi

    # Get task details from current_task.json
    local total_microtasks=1
    local completed_microtasks=0
    if [ -f "$PROJECT_ROOT/.claude/state/current_task.json" ]; then
        total_microtasks=$(cat "$PROJECT_ROOT/.claude/state/current_task.json" | grep -o '"total_microtasks":[0-9]*' | cut -d':' -f2 | head -1)
        completed_microtasks=$(cat "$PROJECT_ROOT/.claude/state/current_task.json" | grep -o '"completed_microtasks":[0-9]*' | cut -d':' -f2 | head -1)
        if [ -z "$total_microtasks" ]; then total_microtasks=1; fi
        if [ -z "$completed_microtasks" ]; then completed_microtasks=0; fi
    fi

    # Calculate task progress percentage
    local task_progress=0
    if [ "$total_microtasks" -gt 0 ]; then
        task_progress=$((completed_microtasks * 100 / total_microtasks))
    fi

    # Format token count
    local formatted_tokens="0k"
    if [ -n "$token_count" ]; then
        if [ "$token_count" -gt 1000 ]; then
            formatted_tokens="$((token_count / 1000))k"
        else
            formatted_tokens="$token_count"
        fi
    fi

    # Generate progress bars with gradient colors
    local session_progress_bar=$(generate_progress_bar "$percentage" 10)
    
    # Get microtasks info
    read -r completed_microtasks total_microtasks microtasks_percentage <<< "$(get_microtasks_info)"
    local task_progress_bar=$(generate_progress_bar "$microtasks_percentage" 10)
    
    # Get open tasks
    local open_tasks=$(get_open_tasks)
    
    # Get platform limits
    read -r codex_usage codex_limit gemini_usage gemini_limit qwen_usage qwen_limit synthetic_usage synthetic_limit <<< "$(get_platform_limits)"
    local codex_percentage=0
    local gemini_percentage=0
    local qwen_percentage=0
    local synthetic_percentage=0
    
    if [ "$codex_limit" -gt 0 ]; then codex_percentage=$((codex_usage * 100 / codex_limit)); fi
    if [ "$gemini_limit" -gt 0 ]; then gemini_percentage=$((gemini_usage * 100 / gemini_limit)); fi
    if [ "$qwen_limit" -gt 0 ]; then qwen_percentage=$((qwen_usage * 100 / qwen_limit)); fi
    if [ "$synthetic_limit" -gt 0 ]; then synthetic_percentage=$((synthetic_usage * 100 / synthetic_limit)); fi
    
    local codex_bar=$(generate_progress_bar "$codex_percentage" 10 true)
    local gemini_bar=$(generate_progress_bar "$gemini_percentage" 10 true)
    local qwen_bar=$(generate_progress_bar "$qwen_percentage" 10 true)
    local synthetic_bar=$(generate_progress_bar "$synthetic_percentage" 10 true)

    # Status color for system status
    local status_color="$CYAN"
    case "$system_status" in
        "PRODUCTION") status_color=$GREEN ;;
        "PARTIAL") status_color=$YELLOW ;;
        "DEGRADED") status_color=$RED ;;
    esac

    # Format task name
    local formatted_task=$(format_task_name "$current_task")

    # Icons
    local task_icon="📌"
    local svc_icon="🔥"
    local codex_icon="🤖"
    local gemini_icon="💎"
    local qwen_icon="🧠"
    local synthetic_icon="🤖"

    # Line 1: Claude Code Context
    local session_percentage=$((token_count * 100 / 200000))  # Claude Sonnet 3.5 limit
    if [ $session_percentage -gt 100 ]; then session_percentage=100; fi
    local session_bar=$(generate_progress_bar "$session_percentage" 10)
    local session_tokens=$(format_token_count "$token_count")
    echo -e "┌─ Claude Code Context ─────────────────────────────┐"
    echo -e "│ ${task_icon} Session: $session_bar $session_percentage% (${session_tokens}/200k tokens)   │"
    echo -e "└───────────────────────────────────────────────────┘"

    # Line 2: Current Task
    echo -e "┌─ Current Task ────────────────────────────────────┐"
    echo -e "│ ${task_icon} ${formatted_task} · $task_progress_bar $microtasks_percentage% (${completed_microtasks}/${total_microtasks})  │"
    echo -e "│ DevFlow v3.1 · ${status_color}${system_status}${NC} · ${svc_icon} ${services_active}/${services_total} services    │"
    echo -e "└───────────────────────────────────────────────────┘"

    # Line 3: Open Tasks (only if there are open tasks)
    if [ -n "$open_tasks" ] && [ "$open_tasks" != "no-tasks(0%)" ]; then
        echo -e "┌─ Open Tasks ──────────────────────────────────────┐"
        # For now, we'll show a simple representation
        # Truncate if too long
        if [ ${#open_tasks} -gt 50 ]; then
            open_tasks="${open_tasks:0:47}..."
        fi
        echo -e "│ 📋 $open_tasks │"
        echo -e "└───────────────────────────────────────────────────┘"
    fi

    # Line 4: Platform Limits
    echo -e "┌─ Platform Limits ─────────────────────────────────┐"
    echo -e "│ ${codex_icon} Codex: $codex_bar $codex_percentage% (${codex_usage}/${codex_limit})                │"
    echo -e "│ ${gemini_icon} Gemini: $gemini_bar $gemini_percentage% (${gemini_usage}/${gemini_limit})               │"
    echo -e "│ ${qwen_icon} Qwen: $qwen_bar $qwen_percentage% (${qwen_usage}/${qwen_limit})               │"
    echo -e "│ ${synthetic_icon} Synthetic: $synthetic_bar $synthetic_percentage% (${synthetic_usage}/${synthetic_limit})            │"
    echo -e "└───────────────────────────────────────────────────┘"
}

# Run main function
main
# Configurable Synthetic health URL
SYN_HEALTH_URL="${DEVFLOW_SYNTHETIC_HEALTH_URL:-http://localhost:3000/health}"
