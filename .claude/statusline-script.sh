#!/bin/bash

# Claude Code StatusLine Script
# Provides comprehensive session information in a clean format
# System-agnostic version using Python instead of jq

# Read JSON input from stdin
input=$(cat)

# Extract basic info using Python (works on all systems)
cwd=$(echo "$input" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('workspace', {}).get('current_dir') or data.get('cwd', ''))")
model_name=$(echo "$input" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('model', {}).get('display_name', 'Claude'))")
session_id=$(echo "$input" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('session_id', ''))")

# Function to calculate context breakdown and progress
calculate_context() {
    # Get transcript if available
    transcript_path=$(echo "$input" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('transcript_path', ''))")
    
    # Determine usable context limit (80% of theoretical before auto-compact)
    if [[ "$model_name" == *"Sonnet"* ]]; then
        context_limit=800000   # 800k usable for 1M Sonnet models
    else
        context_limit=160000   # 160k usable for 200k models (Opus, etc.)
    fi
    
    if [[ -n "$transcript_path" && -f "$transcript_path" ]]; then
        # Parse transcript to get real token usage from most recent main-chain message
        total_tokens=$(python3 -c "
import sys, json

try:
    with open('$transcript_path', 'r') as f:
        lines = f.readlines()
    
    most_recent_usage = None
    most_recent_timestamp = None
    
    for line in lines:
        try:
            data = json.loads(line.strip())
            # Skip sidechain entries (subagent calls)
            if data.get('isSidechain', False):
                continue
            
            # Check for usage data in main-chain messages
            if data.get('message', {}).get('usage'):
                timestamp = data.get('timestamp')
                if timestamp and (not most_recent_timestamp or timestamp > most_recent_timestamp):
                    most_recent_timestamp = timestamp
                    most_recent_usage = data['message']['usage']
        except:
            continue
    
    # Calculate context length (input + cache tokens only, NOT output)
    if most_recent_usage:
        context_length = (
            most_recent_usage.get('input_tokens', 0) +
            most_recent_usage.get('cache_read_input_tokens', 0) +
            most_recent_usage.get('cache_creation_input_tokens', 0)
        )
        print(context_length)
    else:
        print(0)
except:
    print(0)
" 2>/dev/null)
        
        # Calculate actual context usage percentage
        if [[ $total_tokens -gt 0 ]]; then
            # Use Python for floating point math (bc not available on all systems)
            progress_pct=$(python3 -c "print(f'{$total_tokens * 100 / $context_limit:.1f}')")
            progress_pct_int=$(python3 -c "print(int($total_tokens * 100 / $context_limit))")
            if [[ $progress_pct_int -gt 100 ]]; then
                progress_pct="100.0"
                progress_pct_int=100
            fi
        else
            progress_pct="0.0"
            progress_pct_int=0
        fi
    else
        # Default values when no transcript available - read from current task file
        if [[ -f "$cwd/.claude/state/current_task.json" ]]; then
            total_tokens=$(python3 -c "
import sys, json
try:
    with open('$cwd/.claude/state/current_task.json', 'r') as f:
        data = json.load(f)
        print(data.get('token_count', 17900))
except:
    print(17900)
" 2>/dev/null)
        else
            total_tokens=17900
        fi
        progress_pct=$(python3 -c "print(f'{$total_tokens * 100 / $context_limit:.1f}')")
        progress_pct_int=$(python3 -c "print(int($total_tokens * 100 / $context_limit))")
    fi
    
    # Format token count in 'k' format
    formatted_tokens=$(python3 -c "print(f'{$total_tokens // 1000}k')")
    formatted_limit=$(python3 -c "print(f'{$context_limit // 1000}k')")
    
    # Create progress bar (capped at 100%) with Ayu Dark colors
    filled_blocks=$((progress_pct_int / 10))
    if [[ $filled_blocks -gt 10 ]]; then filled_blocks=10; fi
    empty_blocks=$((10 - filled_blocks))
    
    # Ayu Dark colors (converted to closest ANSI 256)
    if [[ $progress_pct_int -lt 50 ]]; then
        bar_color="\033[38;5;114m"  # AAD94C green
    elif [[ $progress_pct_int -lt 80 ]]; then
        bar_color="\033[38;5;215m"  # FFB454 orange
    else
        bar_color="\033[38;5;203m"  # F26D78 red
    fi
    gray_color="\033[38;5;242m"     # Dim for empty blocks
    text_color="\033[38;5;250m"     # BFBDB6 light gray
    reset="\033[0m"
    
    progress_bar="${bar_color}"
    for ((i=0; i<filled_blocks; i++)); do progress_bar+="█"; done
    progress_bar+="${gray_color}"
    for ((i=0; i<empty_blocks; i++)); do progress_bar+="░"; done
    progress_bar+="${reset} ${text_color}${progress_pct}% (${formatted_tokens}/${formatted_limit})${reset}"
    
    echo -e "$progress_bar"
}

# Function to get platform limits data from DevFlow database
get_platform_limits() {
    db_path="$cwd/data/devflow_unified.sqlite"
    
    # Get real data for Qwen and Synthetic API from database
    local qwen_used=0
    local qwen_limit=1000  # Daily limit for Qwen
    local synthetic_used=0
    local synthetic_limit=135  # 5-hour limit for Synthetic API
    
    # Get Qwen usage (count of records in last 24 hours)
    if [[ -f "$db_path" ]]; then
        qwen_used=$(sqlite3 "$db_path" "SELECT COUNT(*) FROM synthetic_usage WHERE provider = 'qwen' AND created_at > datetime('now', '-24 hours');" 2>/dev/null || echo "0")
        synthetic_used=$(sqlite3 "$db_path" "SELECT COUNT(*) FROM synthetic_usage WHERE provider = 'synthetic' AND created_at > datetime('now', '-5 hours');" 2>/dev/null || echo "0")
    fi
    
    # Create progress bars with Ayu Dark colors
    qwen_percentage=0
    synthetic_percentage=0
    
    if [[ $qwen_limit -gt 0 ]]; then
        qwen_percentage=$((qwen_used * 100 / qwen_limit))
    fi
    
    if [[ $synthetic_limit -gt 0 ]]; then
        synthetic_percentage=$((synthetic_used * 100 / synthetic_limit))
    fi
    
    # Qwen progress bar
    filled_blocks=$((qwen_percentage / 10))
    if [[ $filled_blocks -gt 10 ]]; then filled_blocks=10; fi
    empty_blocks=$((10 - filled_blocks))
    
    # Color based on limit usage (green -> yellow -> orange -> red)
    if [[ $qwen_percentage -lt 25 ]]; then
        bar_color="\033[38;5;114m"  # AAD94C green
    elif [[ $qwen_percentage -lt 50 ]]; then
        bar_color="\033[38;5;215m"  # FFB454 yellow
    elif [[ $qwen_percentage -lt 75 ]]; then
        bar_color="\033[38;5;208m"  # FF943B orange
    else
        bar_color="\033[38;5;203m"  # F26D78 red
    fi
    
    qwen_bar="${bar_color}"
    for ((i=0; i<filled_blocks; i++)); do qwen_bar+="█"; done
    qwen_bar+="\033[38;5;242m"
    for ((i=0; i<empty_blocks; i++)); do qwen_bar+="░"; done
    qwen_bar+="\033[0m"
    
    # Synthetic progress bar
    filled_blocks=$((synthetic_percentage / 10))
    if [[ $filled_blocks -gt 10 ]]; then filled_blocks=10; fi
    empty_blocks=$((10 - filled_blocks))
    
    # Color based on limit usage (green -> yellow -> orange -> red)
    if [[ $synthetic_percentage -lt 25 ]]; then
        bar_color="\033[38;5;114m"  # AAD94C green
    elif [[ $synthetic_percentage -lt 50 ]]; then
        bar_color="\033[38;5;215m"  # FFB454 yellow
    elif [[ $synthetic_percentage -lt 75 ]]; then
        bar_color="\033[38;5;208m"  # FF943B orange
    else
        bar_color="\033[38;5;203m"  # F26D78 red
    fi
    
    synthetic_bar="${bar_color}"
    for ((i=0; i<filled_blocks; i++)); do synthetic_bar+="█"; done
    synthetic_bar+="\033[38;5;242m"
    for ((i=0; i<empty_blocks; i++)); do synthetic_bar+="░"; done
    synthetic_bar+="\033[0m"
    
    echo "$qwen_bar $qwen_percentage $qwen_used $qwen_limit $synthetic_bar $synthetic_percentage $synthetic_used $synthetic_limit"
}

# Get current task with DevFlow v3.1 enhancement
get_current_task() {
    cyan="\033[38;5;111m"    # 59C2FF entity blue
    green="\033[38;5;114m"   # AAD94C string green
    reset="\033[0m"
    if [[ -f "$cwd/.claude/state/current_task.json" ]]; then
        # Get task data from current_task.json
        task_name=$(grep -o '"task"[[:space:]]*:[[:space:]]*"[^"]*"' "$cwd/.claude/state/current_task.json" | cut -d'"' -f4)
        task_name=${task_name:-"None"}
        
        # Get progress data
        completed_microtasks=$(grep -o '"completed_microtasks"[[:space:]]*:[[:space:]]*[0-9]*' "$cwd/.claude/state/current_task.json" | cut -d':' -f2 | tr -d ' ')
        total_microtasks=$(grep -o '"total_microtasks"[[:space:]]*:[[:space:]]*[0-9]*' "$cwd/.claude/state/current_task.json" | cut -d':' -f2 | tr -d ' ')
        progress_percentage=$(grep -o '"progress_percentage"[[:space:]]*:[[:space:]]*[0-9]*' "$cwd/.claude/state/current_task.json" | cut -d':' -f2 | tr -d ' ')
        
        # Set defaults if not found
        completed_microtasks=${completed_microtasks:-0}
        total_microtasks=${total_microtasks:-1}
        progress_percentage=${progress_percentage:-0}
        
        # Override with database data if available
        db_path="$cwd/data/devflow_unified.sqlite"
        if [[ -f "$db_path" ]]; then
            db_task_count=$(sqlite3 "$db_path" "SELECT COUNT(*) FROM task_contexts;" 2>/dev/null || echo "0")
            db_active_tasks=$(sqlite3 "$db_path" "SELECT COUNT(*) FROM task_contexts WHERE status = 'active';" 2>/dev/null || echo "0")
            
            # If we have tasks in the database, use database info
            if [[ "$db_task_count" -gt 0 ]]; then
                total_microtasks=$db_task_count
                completed_microtasks=$((db_task_count - db_active_tasks))
                if [[ "$total_microtasks" -gt 0 ]]; then
                    progress_percentage=$((completed_microtasks * 100 / total_microtasks))
                fi
            fi
        fi
        
        # DevFlow v3.1 enhanced display
        if grep -q "cometa-devflow" "$cwd/.claude/state/current_task.json" 2>/dev/null; then
            prefix="🧠 DevFlow→v3.1"
        else
            prefix="Task"
        fi
        
        # Create progress bar
        progress_pct_int=$progress_percentage
        filled_blocks=$((progress_pct_int / 10))
        if [[ $filled_blocks -gt 10 ]]; then filled_blocks=10; fi
        empty_blocks=$((10 - filled_blocks))
        
        # Ayu Dark colors (converted to closest ANSI 256)
        if [[ $progress_pct_int -lt 50 ]]; then
            bar_color="\033[38;5;114m"  # AAD94C green
        elif [[ $progress_pct_int -lt 80 ]]; then
            bar_color="\033[38;5;215m"  # FFB454 orange
        else
            bar_color="\033[38;5;203m"  # F26D78 red
        fi
        gray_color="\033[38;5;242m"     # Dim for empty blocks
        text_color="\033[38;5;250m"     # BFBDB6 light gray
        reset_color="\033[0m"
        
        progress_bar="${bar_color}"
        for ((i=0; i<filled_blocks; i++)); do progress_bar+="█"; done
        progress_bar+="${gray_color}"
        for ((i=0; i<empty_blocks; i++)); do progress_bar+="░"; done
        progress_bar+="${reset_color}"
        
        # Truncate long task names
        if [[ ${#task_name} -gt 25 ]]; then
            formatted_task="${task_name:0:22}..."
        else
            formatted_task="$task_name"
        fi
        
        echo -e "${green}${prefix}: ${formatted_task} · ${progress_bar} ${progress_pct_int}% (${completed_microtasks}/${total_microtasks})${reset}"
    else
        echo -e "${cyan}Task: None${reset}"
    fi
}

# Get DAIC mode with DevFlow services info
get_daic_mode() {
    purple="\033[38;5;183m"  # D2A6FF constant purple
    green="\033[38;5;114m"   # AAD94C string green
    orange="\033[38;5;215m"  # FFB454 func orange
    reset="\033[0m"

    # Get DAIC mode
    if [[ -f "$cwd/.claude/state/daic-mode.json" ]]; then
        mode=$(python3 -c "
import sys, json
try:
    with open('$cwd/.claude/state/daic-mode.json', 'r') as f:
        data = json.load(f)
        print(data.get('mode', 'discussion'))
except:
    print('discussion')
" 2>/dev/null)
    else
        mode="discussion"
    fi

    # Check DevFlow services status
    services_info=$(python3 -c "
import os
import json

try:
    # Check for active service PIDs - All 8 DevFlow services
    active_services = []
    if os.path.exists('.database.pid'):
        active_services.append('DB')
    if os.path.exists('.registry.pid'):
        active_services.append('Registry')
    if os.path.exists('.vector.pid'):
        active_services.append('Vector')
    if os.path.exists('.optimizer.pid'):
        active_services.append('Optimizer')
    if os.path.exists('.ccr.pid'):
        active_services.append('CCR')
    if os.path.exists('.enforcement.pid'):
        active_services.append('Enforcement')
    if os.path.exists('.orchestrator.pid'):
        active_services.append('Orchestrator')

    # Check Synthetic MCP Server
    try:
        import urllib.request
        urllib.request.urlopen('http://localhost:3000/health', timeout=1)
        active_services.append('Synthetic')
    except:
        pass

    if active_services:
        print(f' | 🔥 {len(active_services)}/8 services')
    else:
        print(' | 🔥 0/8 services')
except:
    print('')
" 2>/dev/null)

    if [[ "$mode" == "discussion" ]]; then
        echo -e "${purple}DAIC: Discussion${reset}${orange}$services_info${reset}"
    else
        echo -e "${green}DAIC: Implementation${reset}${orange}$services_info${reset}"
    fi
}

# Count edited files with color
count_edited_files() {
    yellow="\033[38;5;215m"  # FFB454 func orange
    reset="\033[0m"
    if [[ -d "$cwd/.git" ]]; then
        cd "$cwd"
        # Count modified and staged files
        modified_count=$(git status --porcelain 2>/dev/null | grep -E '^[AM]|^.[AM]' | wc -l || echo "0")
        echo -e "${yellow}✎ $modified_count files${reset}"
    else
        echo -e "${yellow}✎ 0 files${reset}"
    fi
}

# Count open tasks with color
count_open_tasks() {
    blue="\033[38;5;111m"    # 73B8FF modified blue
    reset="\033[0m"
    tasks_dir="$cwd/sessions/tasks"
    
    # First try to get tasks from database
    db_path="$cwd/data/devflow_unified.sqlite"
    if [[ -f "$db_path" ]]; then
        # Get active tasks from database
        active_tasks=$(sqlite3 "$db_path" "SELECT title FROM task_contexts WHERE status = 'active' LIMIT 3;" 2>/dev/null || echo "")
        
        if [[ -n "$active_tasks" ]]; then
            open_count=0
            while IFS= read -r task_title; do
                if [[ -n "$task_title" ]]; then
                    ((open_count++))
                fi
            done <<< "$active_tasks"
            
            echo -e "${blue}[$open_count open]${reset}"
            return
        fi
    fi
    
    # Fallback to file-based approach
    if [[ -d "$tasks_dir" ]]; then
        # Count .md files that don't contain "Status: done" or "Status: completed"
        open_count=0
        for task_file in "$tasks_dir"/*.md; do
            if [[ -f "$task_file" ]]; then
                if ! grep -q -E "Status:\s*(done|completed)" "$task_file" 2>/dev/null; then
                    ((open_count++))
                fi
            fi
        done
        echo -e "${blue}[$open_count open]${reset}"
    else
        echo -e "${blue}[0 open]${reset}"
    fi
}

# Build the complete statusline
progress_info=$(calculate_context)
task_info=$(get_current_task)
daic_info=$(get_daic_mode)
files_info=$(count_edited_files)
tasks_info=$(count_open_tasks)

# Get platform limits info
platform_info=$(get_platform_limits)
read -r qwen_bar qwen_percentage qwen_used qwen_limit synthetic_bar synthetic_percentage synthetic_used synthetic_limit <<< "$platform_info"

# Output the complete statusline in multiple lines with color support
# Line 1: Progress bar | Current task
echo -e "$progress_info | $task_info"

# Line 2: DAIC mode | Files edited | Open tasks
echo -e "$daic_info | $files_info | $tasks_info"

# Line 3: Platform Limits (simplified to only Qwen and Synthetic)
echo -e "🤖 Qwen: $qwen_bar ${qwen_percentage}% (${qwen_used}/${qwen_limit}) | 🤖 Synthetic: $synthetic_bar ${synthetic_percentage}% (${synthetic_used}/${synthetic_limit})"
