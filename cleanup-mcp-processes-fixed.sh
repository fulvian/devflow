#!/bin/bash

# MCP Process Cleanup Script (macOS bash 3.2 compatible)
# Safely terminates duplicate MCP processes while preserving one instance of each type

set -e  # Exit on any error

echo "=== MCP Process Cleanup Script (Fixed) ==="
echo "Identifying and terminating duplicate MCP processes..."
echo "Total MCP processes found: $(ps aux | grep -E "(mcp|codex|gemini|qwen)" | grep -v grep | wc -l)"

# Function to safely terminate processes
safe_kill() {
    local pids=("$@")
    for pid in "${pids[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            echo "Terminating process PID: $pid"
            # Try graceful termination first
            kill -TERM "$pid" 2>/dev/null || true
            # Wait a moment for graceful shutdown
            sleep 2
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                echo "Force killing PID: $pid"
                kill -KILL "$pid" 2>/dev/null || true
            fi
        else
            echo "Process PID: $pid already terminated"
        fi
    done
}

# Function to get PIDs for a process name, excluding this script
get_pids() {
    local process_name="$1"
    # Using pgrep to find processes, excluding the current script
    pgrep -f "$process_name" | grep -v "$$" || true
}

# Clean up codex processes - keep only 1
echo "Processing codex processes..."
codex_pids=($(get_pids "codex"))
if [ ${#codex_pids[@]} -gt 0 ]; then
    echo "Found ${#codex_pids[@]} codex processes"
    if [ ${#codex_pids[@]} -gt 1 ]; then
        echo "Preserving codex PID: ${codex_pids[0]}"
        # Kill all except the first one
        for i in $(seq 1 $((${#codex_pids[@]} - 1))); do
            safe_kill "${codex_pids[$i]}"
        done
    fi
else
    echo "No codex processes found"
fi

# Clean up gemini-mcp processes - keep only 1
echo "Processing gemini-mcp processes..."
gemini_pids=($(get_pids "gemini-mcp"))
if [ ${#gemini_pids[@]} -gt 0 ]; then
    echo "Found ${#gemini_pids[@]} gemini-mcp processes"
    if [ ${#gemini_pids[@]} -gt 1 ]; then
        echo "Preserving gemini-mcp PID: ${gemini_pids[0]}"
        # Kill all except the first one
        for i in $(seq 1 $((${#gemini_pids[@]} - 1))); do
            safe_kill "${gemini_pids[$i]}"
        done
    fi
else
    echo "No gemini-mcp processes found"
fi

# Clean up qwen-mcp processes - keep only 1  
echo "Processing qwen-mcp processes..."
qwen_pids=($(get_pids "qwen-mcp"))
if [ ${#qwen_pids[@]} -gt 0 ]; then
    echo "Found ${#qwen_pids[@]} qwen-mcp processes"
    if [ ${#qwen_pids[@]} -gt 1 ]; then
        echo "Preserving qwen-mcp PID: ${qwen_pids[0]}"
        # Kill all except the first one
        for i in $(seq 1 $((${#qwen_pids[@]} - 1))); do
            safe_kill "${qwen_pids[$i]}"
        done
    fi
else
    echo "No qwen-mcp processes found"
fi

# Clean up npm exec processes that are duplicates
echo "Processing npm exec MCP processes..."
npm_mcp_pids=($(ps aux | grep -E "npm exec.*mcp" | grep -v grep | awk '{print $2}'))
if [ ${#npm_mcp_pids[@]} -gt 4 ]; then
    echo "Found ${#npm_mcp_pids[@]} npm exec MCP processes, keeping first 4"
    for i in $(seq 4 $((${#npm_mcp_pids[@]} - 1))); do
        safe_kill "${npm_mcp_pids[$i]}"
    done
fi

echo "=== Cleanup completed ==="
echo "Remaining MCP processes: $(ps aux | grep -E "(mcp|codex|gemini|qwen)" | grep -v grep | wc -l)"

exit 0