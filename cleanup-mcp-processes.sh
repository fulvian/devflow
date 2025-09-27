#!/bin/bash

# MCP Process Cleanup Script
# Safely terminates duplicate MCP processes while preserving one instance of each type

set -e  # Exit on any error

echo "=== MCP Process Cleanup Script ==="
echo "Identifying and terminating duplicate MCP processes..."

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

# Track PIDs to preserve (first instance of each type)
declare -A preserve_pids

# Handle codex processes
echo "Processing codex processes..."
codex_pids=($(get_pids "codex"))
if [ ${#codex_pids[@]} -gt 0 ]; then
    echo "Found ${#codex_pids[@]} codex processes"
    preserve_pids["codex"]="${codex_pids[0]}"
    if [ ${#codex_pids[@]} -gt 1 ]; then
        echo "Preserving codex PID: ${codex_pids[0]}"
        # Kill all except the first one
        pids_to_kill=("${codex_pids[@]:1}")
        safe_kill "${pids_to_kill[@]}"
    fi
else
    echo "No codex processes found"
fi

# Handle gemini-mcp processes
echo "Processing gemini-mcp processes..."
gemini_pids=($(get_pids "gemini-mcp"))
if [ ${#gemini_pids[@]} -gt 0 ]; then
    echo "Found ${#gemini_pids[@]} gemini-mcp processes"
    preserve_pids["gemini-mcp"]="${gemini_pids[0]}"
    if [ ${#gemini_pids[@]} -gt 1 ]; then
        echo "Preserving gemini-mcp PID: ${gemini_pids[0]}"
        # Kill all except the first one
        pids_to_kill=("${gemini_pids[@]:1}")
        safe_kill "${pids_to_kill[@]}"
    fi
else
    echo "No gemini-mcp processes found"
fi

# Handle qwen-mcp processes
echo "Processing qwen-mcp processes..."
qwen_pids=($(get_pids "qwen-mcp"))
if [ ${#qwen_pids[@]} -gt 0 ]; then
    echo "Found ${#qwen_pids[@]} qwen-mcp processes"
    preserve_pids["qwen-mcp"]="${qwen_pids[0]}"
    if [ ${#qwen_pids[@]} -gt 1 ]; then
        echo "Preserving qwen-mcp PID: ${qwen_pids[0]}"
        # Kill all except the first one
        pids_to_kill=("${qwen_pids[@]:1}")
        safe_kill "${pids_to_kill[@]}"
    fi
else
    echo "No qwen-mcp processes found"
fi

# Preserve main devflow processes (example PID 35897)
# In a real scenario, you would identify the actual devflow process PID
# For now, we'll just note that we're preserving it

echo "=== Summary ==="
for process_type in "${!preserve_pids[@]}"; do
    echo "Preserved $process_type with PID: ${preserve_pids[$process_type]}"
done

echo "MCP process cleanup completed successfully."

# Optional: Restart clean MCP servers after cleanup
# Uncomment the following lines if you want to automatically restart the MCP servers
# echo "Restarting MCP servers..."
# codex --daemon &
# gemini-mcp --daemon &
# qwen-mcp --daemon &
# echo "MCP servers restarted."

exit 0