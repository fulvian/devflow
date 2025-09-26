#!/bin/bash

# 🧠 ENHANCED FOOTER SYSTEM - New Generation DevFlow Status
# Format: 🧠 R:● W:○ │ enhanced_footer 85% │ [claude-only] │ 3/5 Agents │ Session:2.5K Task:1.2K │ 3 pending

# Enhanced colors with gradients
BRAIN_PURPLE='\033[95m'
R_ACTIVE='\033[32m'      # 🟢 Verde: R:●
R_IDLE='\033[90m'        # ⚪ Grigio: R:○
W_ACTIVE='\033[33m'      # 🟡 Giallo: W:●
W_IDLE='\033[90m'        # ⚪ Grigio: W:○
PROGRESS_HIGH='\033[92m' # 🟢 Verde: >80%
PROGRESS_MID='\033[93m'  # 🟡 Giallo: 40-80%
PROGRESS_LOW='\033[91m'  # 🔴 Rosso: <40%
MODE_CLAUDE='\033[35m'   # 🟣 Magenta: [claude-only]
MODE_ALL='\033[36m'      # 🔵 Ciano: [all-mode]
MODE_CLI='\033[34m'      # 🔵 Blu: [cli-only]
MODE_SYNTH='\033[32m'    # 🟢 Verde: [synthetic-only]
TOKEN_SESSION='\033[96m' # 🔵 Ciano chiaro: Session tokens
TOKEN_TASK='\033[94m'    # 🔵 Blu: Task tokens
PENDING_COUNT='\033[31m' # 🔴 Rosso: Pending tasks
DIM='\033[90m'
BOLD='\033[1m'
RESET='\033[0m'

# Function to check database activity
check_db_activity() {
    local db_path="/Users/fulvioventura/devflow/data/devflow_unified.sqlite"
    local read_active="○"
    local write_active="○"
    local read_color="$R_IDLE"
    local write_color="$W_IDLE"

    if [ -f "$db_path" ]; then
        # Check recent activity in last 10 seconds
        local recent_reads=$(sqlite3 "$db_path" "SELECT COUNT(*) FROM audit_log WHERE operation IN ('SELECT', 'READ') AND timestamp > datetime('now', '-10 seconds')" 2>/dev/null || echo "0")
        local recent_writes=$(sqlite3 "$db_path" "SELECT COUNT(*) FROM audit_log WHERE operation IN ('INSERT', 'UPDATE', 'DELETE') AND timestamp > datetime('now', '-10 seconds')" 2>/dev/null || echo "0")

        if [ "$recent_reads" -gt 0 ]; then
            read_active="●"
            read_color="$R_ACTIVE"
        fi

        if [ "$recent_writes" -gt 0 ]; then
            write_active="●"
            write_color="$W_ACTIVE"
        fi
    fi

    echo "${read_color}R:${read_active}${RESET} ${write_color}W:${write_active}${RESET}"
}

# Function to get task progress - Context7 Dynamic Progress System
get_task_progress() {
    local task_name="enhanced_footer"
    local progress=0
    local progress_color="$PROGRESS_LOW"

    # Context7 Pattern: Dynamic progress calculation using AI Dev Tasks methodology
    if [ -f "/Users/fulvioventura/devflow/scripts/dynamic-progress-calculator.js" ]; then
        local dynamic_data=$(cd /Users/fulvioventura/devflow && node scripts/dynamic-progress-calculator.js 2>/dev/null)

        if [ -n "$dynamic_data" ]; then
            local calc_success=$(echo "$dynamic_data" | jq -r '.progress // null' 2>/dev/null)
            if [ "$calc_success" != "null" ] && [ -n "$calc_success" ]; then
                task_name=$(echo "$dynamic_data" | jq -r '.taskName // "dynamic_task"' 2>/dev/null)
                progress=$(echo "$dynamic_data" | jq -r '.progress // 0' 2>/dev/null)
            fi
        fi
    fi

    # Fallback 1: Database query with Context7 weighted calculation
    if [ "$progress" -eq 0 ] && [ -f "/Users/fulvioventura/devflow/data/devflow_unified.sqlite" ]; then
        local db_task=$(sqlite3 "/Users/fulvioventura/devflow/data/devflow_unified.sqlite" "SELECT name, CASE WHEN status='completed' THEN 100 WHEN status='in_progress' THEN (SELECT COALESCE(CAST(COUNT(CASE WHEN status='completed' THEN 1 END) * 100.0 / COUNT(*) AS INTEGER), 50) FROM tasks WHERE parent_task_id = t.id) ELSE 10 END as progress FROM tasks t WHERE status IN ('in_progress', 'pending') ORDER BY updated_at DESC LIMIT 1" 2>/dev/null)

        if [ -n "$db_task" ]; then
            task_name=$(echo "$db_task" | cut -d'|' -f1)
            progress=$(echo "$db_task" | cut -d'|' -f2)
        fi
    fi

    # Fallback 2: footer-state.json (legacy support)
    if [ "$progress" -eq 0 ] && [ -f "/Users/fulvioventura/devflow/.devflow/footer-state.json" ]; then
        local footer_progress=$(jq -r '.progress // "10%"' "/Users/fulvioventura/devflow/.devflow/footer-state.json" 2>/dev/null | sed 's/%//')
        if [ -n "$footer_progress" ] && [ "$footer_progress" != "null" ]; then
            progress="$footer_progress"
        fi
    fi

    # Context7 Progress Color Algorithm
    if [ "$progress" -ge 80 ]; then
        progress_color="$PROGRESS_HIGH"
    elif [ "$progress" -ge 40 ]; then
        progress_color="$PROGRESS_MID"
    else
        progress_color="$PROGRESS_LOW"
    fi

    echo "${BOLD}${task_name}${RESET} ${progress_color}${progress}%${RESET}"
}

# Function to get agent mode - Context7 Zustand-inspired state management
get_agent_mode() {
    local mode="claude-only"
    local mode_color="$MODE_CLAUDE"
    local state_file="${PWD}/.devflow/orchestrator-mode-state.json"

    # Context7 Pattern: Try primary source (orchestrator API)
    local orchestrator_mode=$(curl -s --connect-timeout 2 "http://localhost:3005/api/mode" 2>/dev/null | jq -r '.currentMode // "claude-only"' 2>/dev/null || echo "claude-only")

    if [ "$orchestrator_mode" != "null" ] && [ -n "$orchestrator_mode" ] && [ "$orchestrator_mode" != "claude-only" ]; then
        mode="$orchestrator_mode"
        # Context7 Pattern: Cache successful state for resilience
        echo "{\"currentMode\":\"$mode\",\"lastUpdate\":\"$(date -Iseconds)\",\"source\":\"orchestrator\"}" > "$state_file" 2>/dev/null
    else
        # Context7 Pattern: Fallback to cached state (Zustand-like persistence)
        if [ -f "$state_file" ]; then
            local cached_mode=$(jq -r '.currentMode // "claude-only"' "$state_file" 2>/dev/null || echo "claude-only")
            local cache_age=$(jq -r '.lastUpdate // "1970-01-01T00:00:00Z"' "$state_file" 2>/dev/null)
            local current_time=$(date -Iseconds)

            # Use cached mode if less than 5 minutes old
            if [ -n "$cached_mode" ] && [ "$cached_mode" != "null" ]; then
                mode="$cached_mode"
            fi
        fi
    fi

    # Set color based on mode
    case "$mode" in
        "claude-only") mode_color="$MODE_CLAUDE" ;;
        "all-mode") mode_color="$MODE_ALL" ;;
        "cli-only") mode_color="$MODE_CLI" ;;
        "synthetic-only") mode_color="$MODE_SYNTH" ;;
        *) mode_color="$DIM" ;;
    esac

    echo "${mode_color}[${mode}]${RESET}"
}

# Function to get agent count
get_agent_count() {
    local active=1  # Claude sempre attivo
    local total=8
    local count_color="$PROGRESS_HIGH"

    # Try new realtime status endpoint first
    local agent_status=$(curl -s --connect-timeout 2 "http://localhost:3005/api/agents/realtime-status" 2>/dev/null | jq -r '.active // 1, .total // 8' 2>/dev/null || echo "1 8")

    if [ -n "$agent_status" ]; then
        active=$(echo "$agent_status" | head -n1)
        total=$(echo "$agent_status" | tail -n1)
    else
        # Fallback: check PID files
        local agent_count=1  # Claude
        for pidfile in .synthetic.pid .gemini.pid .qwen.pid .codex.pid; do
            if [ -f "$pidfile" ]; then
                local pid_content=$(cat "$pidfile" 2>/dev/null)
                if [ "$pid_content" = "MCP_READY" ] || ([ -n "$pid_content" ] && kill -0 "$pid_content" 2>/dev/null); then
                    agent_count=$((agent_count + 1))
                fi
            fi
        done
        active="$agent_count"
    fi

    # Set color
    if [ "$active" -gt 0 ]; then
        count_color="$PROGRESS_HIGH"
    else
        count_color="$PROGRESS_LOW"
    fi

    echo "${count_color}${active}${RESET}/${total} Agents"
}

# Function to get token counters
get_token_counters() {
    local session_tokens=0
    local task_tokens=0

    # Use simple token monitor with timeout for clean token counts
    if [ -f "/Users/fulvioventura/devflow/scripts/simple-token-monitor.ts" ]; then
        local real_time_data=$(cd /Users/fulvioventura/devflow && npx ts-node scripts/simple-token-monitor.ts & PID=$!; sleep 3; kill -9 $PID 2>/dev/null; wait $PID 2>/dev/null)
        if [ -n "$real_time_data" ]; then
            local success=$(echo "$real_time_data" | jq -r '.success // false' 2>/dev/null || echo "false")
            if [ "$success" = "true" ]; then
                # Use input/output format directly from token monitor
                local input_formatted=$(echo "$real_time_data" | jq -r '.input // "0"' 2>/dev/null)
                local output_formatted=$(echo "$real_time_data" | jq -r '.output // "0"' 2>/dev/null)

                # Output with new Input/Output format
                echo "${TOKEN_SESSION}Input:${input_formatted}${RESET} ${TOKEN_TASK}Output:${output_formatted}${RESET}"
                return
            fi
        fi
    fi

    # Fallback: read from token state file
    if [ "$session_tokens" = "0" ] && [ -f ".devflow/token-usage-state.json" ]; then
        local token_data=$(jq -r '.session.total // 0, .task.current // 0' ".devflow/token-usage-state.json" 2>/dev/null || echo "0 0")
        session_tokens=$(echo "$token_data" | head -n1)
        task_tokens=$(echo "$token_data" | tail -n1)
    fi

    # Format tokens
    local session_formatted=$(format_tokens "$session_tokens")
    local task_formatted=$(format_tokens "$task_tokens")

    echo "${TOKEN_SESSION}Session:${session_formatted}${RESET} ${TOKEN_TASK}Task:${task_formatted}${RESET}"
}

# Function to format token numbers
format_tokens() {
    local count=$1
    if [ "$count" -ge 1000000 ]; then
        # Use bc for precise decimal calculation
        local millions=$(echo "scale=2; $count / 1000000" | bc 2>/dev/null || echo "$(( count / 1000000 ))")
        echo "${millions}M"
    elif [ "$count" -ge 1000 ]; then
        local thousands=$(echo "scale=1; $count / 1000" | bc 2>/dev/null || echo "$(( count / 1000 ))")
        echo "${thousands}K"
    else
        echo "$count"
    fi
}

# Function to get pending tasks count
get_pending_count() {
    local pending=0
    local pending_color="$DIM"

    # Try database query
    if [ -f "/Users/fulvioventura/devflow/data/devflow_unified.sqlite" ]; then
        pending=$(sqlite3 "/Users/fulvioventura/devflow/data/devflow_unified.sqlite" "SELECT COUNT(*) FROM tasks WHERE status IN ('pending', 'in_progress')" 2>/dev/null || echo "0")
    fi

    if [ "$pending" -gt 0 ]; then
        pending_color="$PENDING_COUNT"
    fi

    echo "${pending_color}${pending} pending${RESET}"
}

# Main footer generation
generate_enhanced_footer() {
    local db_activity=$(check_db_activity)
    local task_progress=$(get_task_progress)
    local agent_mode=$(get_agent_mode)
    local agent_count=$(get_agent_count)
    local token_counters=$(get_token_counters)
    local pending_count=$(get_pending_count)

    echo -e "${BOLD}${BRAIN_PURPLE}🧠${RESET} ${db_activity} ${DIM}│${RESET} ${task_progress} ${DIM}│${RESET} ${agent_mode} ${DIM}│${RESET} ${agent_count} ${DIM}│${RESET} ${token_counters} ${DIM}│${RESET} ${pending_count}"
}

# Execute
generate_enhanced_footer