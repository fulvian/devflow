#!/bin/bash

# DevFlow v3.1 Enhanced StatusLine - New Design
# Displays dynamic system status with progress, task info, and services in ASCII art boxes

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FOOTER_STATE_FILE="$PROJECT_ROOT/.devflow/footer-state.json"
PS_BIN="$(command -v ps || echo /bin/ps)"
DB_PATH="$PROJECT_ROOT/data/devflow.sqlite"

# Colors for status display (Ayu-ish palette)
RED='\033[38;5;203m'
GREEN='\033[38;5;114m'
YELLOW='\033[38;5;215m'
BLUE='\033[38;5;111m'
CYAN='\033[38;5;117m'
PURPLE='\033[38;5;141m'
ORANGE='\033[38;5;208m'
DIM='\033[38;5;242m'
NC='\033[0m' # No Color

# Unicode blocks for progress bar
FULL_BLOCK="█"
EMPTY_BLOCK="░"

# Function to generate progress bar with correct color gradient
# For completion bars: red (0%) -> orange (25%) -> yellow (50%) -> green (100%)
# For limit bars: green (0%) -> yellow (50%) -> orange (75%) -> red (100%)
generate_progress_bar() {
    local percentage=$1
    local width=${2:-10}
    local bar_type=${3:-"completion"}  # "completion" or "limit"
    
    if [ "$percentage" -lt 0 ]; then percentage=0; fi
    if [ "$percentage" -gt 100 ]; then percentage=100; fi
    local filled=$((percentage * width / 100))
    local empty=$((width - filled))

    local color="$GREEN"
    if [ "$bar_type" = "completion" ]; then
        # Completion bars: red -> orange -> yellow -> green
        if [ $percentage -le 25 ]; then
            color=$RED
        elif [ $percentage -le 50 ]; then
            color=$ORANGE
        elif [ $percentage -le 75 ]; then
            color=$YELLOW
        else
            color=$GREEN
        fi
    else
        # Limit bars: green -> yellow -> orange -> red
        if [ $percentage -le 25 ]; then
            color=$GREEN
        elif [ $percentage -le 50 ]; then
            color=$YELLOW
        elif [ $percentage -le 75 ]; then
            color=$ORANGE
        else
            color=$RED
        fi
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

# Function to get platform limits data
get_platform_limits() {
    # Get real data for Qwen and Synthetic API from database
    local qwen_used=0
    local qwen_limit=1000  # Daily limit for Qwen
    local synthetic_used=0
    local synthetic_limit=135  # 5-hour limit for Synthetic API
    
    # Get Qwen usage (count of records in last 24 hours)
    if [ -f "$DB_PATH" ]; then
        qwen_used=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM synthetic_usage WHERE provider = 'qwen' AND created_at > datetime('now', '-24 hours');" 2>/dev/null || echo "0")
        synthetic_used=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM synthetic_usage WHERE provider = 'synthetic' AND created_at > datetime('now', '-5 hours');" 2>/dev/null || echo "0")
    fi
    
    echo "$qwen_used $qwen_limit $synthetic_used $synthetic_limit"
}

# Function to read task information from current_task.json and database
read_current_task_info() {
    local current_task_file="$PROJECT_ROOT/.claude/state/current_task.json"
    local task_name="devflow-v3_1-deployment"
    local completed_microtasks=0
    local total_microtasks=1
    local progress_percentage=0
    local token_count=0
    
    # Get task data from current_task.json
    if [ -f "$current_task_file" ]; then
        # Extract task name
        task_name=$(grep -o '"task"[[:space:]]*:[[:space:]]*"[^"]*"' "$current_task_file" | cut -d'"' -f4)
        task_name=${task_name:-"devflow-v3_1-deployment"}
        
        # Extract microtask progress
        completed_microtasks=$(grep -o '"completed_microtasks"[[:space:]]*:[[:space:]]*[0-9]*' "$current_task_file" | cut -d':' -f2 | tr -d ' ')
        total_microtasks=$(grep -o '"total_microtasks"[[:space:]]*:[[:space:]]*[0-9]*' "$current_task_file" | cut -d':' -f2 | tr -d ' ')
        
        # Extract progress percentage
        progress_percentage=$(grep -o '"progress_percentage"[[:space:]]*:[[:space:]]*[0-9]*' "$current_task_file" | cut -d':' -f2 | tr -d ' ')
        
        # Extract token count
        token_count=$(grep -o '"token_count"[[:space:]]*:[[:space:]]*[0-9]*' "$current_task_file" | cut -d':' -f2 | tr -d ' ')
        
        # Set defaults if not found
        completed_microtasks=${completed_microtasks:-0}
        total_microtasks=${total_microtasks:-1}
        progress_percentage=${progress_percentage:-0}
        token_count=${token_count:-0}
    fi
    
    # Override with database data if available
    if [ -f "$DB_PATH" ]; then
        local db_task_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM task_contexts;" 2>/dev/null || echo "0")
        local db_active_tasks=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM task_contexts WHERE status = 'active';" 2>/dev/null || echo "0")
        
        # If we have tasks in the database, use database info
        if [ "$db_task_count" -gt 0 ]; then
            total_microtasks=$db_task_count
            completed_microtasks=$((db_task_count - db_active_tasks))
            if [ "$total_microtasks" -gt 0 ]; then
                progress_percentage=$((completed_microtasks * 100 / total_microtasks))
            fi
        fi
    fi
    
    echo "$task_name $completed_microtasks $total_microtasks $progress_percentage $token_count"
}

# Function to get open tasks from database
get_open_tasks() {
    local open_tasks=""
    
    if [ -f "$DB_PATH" ]; then
        # Get active tasks from database
        local active_tasks=$(sqlite3 "$DB_PATH" "SELECT title FROM task_contexts WHERE status = 'active' LIMIT 3;" 2>/dev/null || echo "")
        
        if [ -n "$active_tasks" ]; then
            local count=0
            while IFS= read -r task_title; do
                if [ -n "$task_title" ]; then
                    if [ $count -gt 0 ]; then
                        open_tasks="$open_tasks · "
                    fi
                    # Truncate long task names
                    if [ ${#task_title} -gt 20 ]; then
                        task_title="${task_title:0:17}..."
                    fi
                    open_tasks="${open_tasks}${task_title}"
                    ((count++))
                fi
            done <<< "$active_tasks"
        fi
    fi
    
    echo "$open_tasks"
}

# Function to probe services live
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

# Function to read footer state
read_footer_state() {
    if [ -f "$FOOTER_STATE_FILE" ]; then
        cat "$FOOTER_STATE_FILE" 2>/dev/null
    else
        echo "{}"
    fi
}

# Function to format task name
format_task_name() {
    local task=$1
    # Truncate long task names
    if [ ${#task} -gt 25 ]; then
        echo "${task:0:22}..."
    else
        echo "$task"
    fi
}

# Main function
main() {
    # Read current state
    local state_json=$(read_footer_state)
    
    # Get current task information
    read -r task_name completed_microtasks total_microtasks progress_percentage token_count <<< "$(read_current_task_info)"
    
    # Get platform limits
    read -r qwen_used qwen_limit synthetic_used synthetic_limit <<< "$(get_platform_limits)"
    
    # Get open tasks
    local open_tasks=$(get_open_tasks)
    
    # Get service status
    read -r services_active services_total system_status <<< "$(probe_services_live)"
    
    # Determine mode
    local mode="DEV"
    if [ "${NODE_ENV}" = "production" ]; then mode="PRODUCTION"; fi
    
    # Calculate session context percentage (based on token count)
    local session_percentage=$((token_count * 100 / 200000))
    if [ $session_percentage -gt 100 ]; then session_percentage=100; fi
    
    # Calculate microtask percentage
    local microtask_percentage=0
    if [ "$total_microtasks" -gt 0 ]; then
        microtask_percentage=$((completed_microtasks * 100 / total_microtasks))
    fi
    
    # Format token counts
    local formatted_tokens=$(format_token_count "$token_count")
    local formatted_max_tokens="200k"
    
    # Generate progress bars
    local session_progress_bar=$(generate_progress_bar "$session_percentage" 10 "completion")
    local task_progress_bar=$(generate_progress_bar "$microtask_percentage" 10 "completion")
    
    # Generate platform limit progress bars
    local qwen_percentage=0
    local synthetic_percentage=0
    
    if [ "$qwen_limit" -gt 0 ]; then
        qwen_percentage=$((qwen_used * 100 / qwen_limit))
    fi
    
    if [ "$synthetic_limit" -gt 0 ]; then
        synthetic_percentage=$((synthetic_used * 100 / synthetic_limit))
    fi
    
    local qwen_bar=$(generate_progress_bar "$qwen_percentage" 10 "limit")
    local synthetic_bar=$(generate_progress_bar "$synthetic_percentage" 10 "limit")
    
    # Status color
    local status_color="$CYAN"
    case "$system_status" in
        "PRODUCTION") status_color=$GREEN ;;
        "PARTIAL") status_color=$YELLOW ;;
        "DEGRADED") status_color=$RED ;;
    esac
    
    # Line 1: Session Context
    echo -e "┌─ Claude Code Context ─────────────────────────────────────────┐"
    echo -e "│ 🧠 Session: $session_progress_bar $session_percentage% (${formatted_tokens}/${formatted_max_tokens} tokens)   │"
    echo -e "└───────────────────────────────────────────────────────────────┘"
    
    # Line 2: Current Task
    echo -e "┌─ Current Task ────────────────────────────────────────────────┐"
    local formatted_task=$(format_task_name "$task_name")
    echo -e "│ 📌 $formatted_task · $task_progress_bar $microtask_percentage% ($completed_microtasks/$total_microtasks)  │"
    echo -e "│ DevFlow v3.1 · ${status_color}${system_status}${NC} · 🔥 $services_active/$services_total services    │"
    echo -e "└───────────────────────────────────────────────────────────────┘"
    
    # Line 3: Open Tasks (if any)
    if [ -n "$open_tasks" ]; then
        echo -e "┌─ Open Tasks ──────────────────────────────────────────────────┐"
        # Truncate if too long
        if [ ${#open_tasks} -gt 55 ]; then
            open_tasks="${open_tasks:0:52}..."
        fi
        echo -e "│ 📋 $open_tasks │"
        echo -e "└───────────────────────────────────────────────────────────────┘"
    fi
    
    # Line 4: Platform Limits (simplified to only Qwen and Synthetic)
    echo -e "┌─ Platform Limits ─────────────────────────────────────────────┐"
    echo -e "│ 🧠 Qwen: $qwen_bar $qwen_percentage% ($qwen_used/$qwen_limit)               │"
    echo -e "│ 🤖 Synthetic: $synthetic_bar $synthetic_percentage% ($synthetic_used/$synthetic_limit)            │"
    echo -e "└───────────────────────────────────────────────────────────────┘"
}

# Run main function
main

# Configurable Synthetic health URL
SYN_HEALTH_URL="${DEVFLOW_SYNTHETIC_HEALTH_URL:-http://localhost:3000/health}"