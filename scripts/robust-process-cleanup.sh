#!/bin/bash

# =============================================================================
# DevFlow Robust Process Cleanup System
# =============================================================================
# This script provides robust cleanup of DevFlow processes, including:
# - Detection of orphan processes via pattern matching
# - Handling of both root and user processes
# - Graceful termination with force kill fallback
# - Comprehensive DevFlow service identification
# - Safe permission checking
#
# Usage: ./devflow-cleanup.sh [OPTIONS]
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
readonly SCRIPT_NAME="DevFlow Cleanup"
readonly VERSION="1.0.0"
readonly LOG_FILE="./logs/devflow-cleanup.log"

# Process patterns to match DevFlow services
readonly PROCESS_PATTERNS=(
    "devflow-server"
    "devflow-worker"
    "devflow-scheduler"
    "node.*devflow"
    "python.*devflow"
    "real-dream-team"
    "cli-integration-manager"
    "platform-status-tracker"
    "codex-mcp"
    "ts-node.*real-dream-team"
    "ts-node.*cli-integration"
    "ts-node.*platform-status"
    "npx.*ts-node.*real-dream-team"
    "npx.*ts-node.*cli-integration"
    "npx.*ts-node.*platform-status"
)

# Termination signals in order of preference
readonly TERMINATION_SIGNALS=("TERM" "INT" "QUIT")
readonly FORCE_SIGNAL="KILL"

# Timeouts in seconds
readonly GRACE_PERIOD=10
readonly FORCE_TIMEOUT=5

# -----------------------------------------------------------------------------
# Logging Functions
# -----------------------------------------------------------------------------
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

log_info() {
    log "INFO" "$@"
}

log_warn() {
    log "WARN" "$@"
}

log_error() {
    log "ERROR" "$@"
}

log_debug() {
    if [[ "${DEBUG:-false}" == "true" ]]; then
        log "DEBUG" "$@"
    fi
}

# -----------------------------------------------------------------------------
# Utility Functions
# -----------------------------------------------------------------------------
check_permission() {
    local pid="$1"
    local proc_user
    local current_user

    # Get process owner
    if ! proc_user=$(ps -o user= -p "$pid" 2>/dev/null); then
        log_debug "Cannot determine owner for PID $pid"
        return 1
    fi

    # Get current user
    current_user=$(id -un)

    # Check if we can kill the process
    if [[ "$proc_user" == "$current_user" ]] || [[ "$current_user" == "root" ]]; then
        return 0
    else
        return 1
    fi
}

is_process_running() {
    local pid="$1"
    kill -0 "$pid" 2>/dev/null
}

# -----------------------------------------------------------------------------
# Process Detection Functions
# -----------------------------------------------------------------------------
find_devflow_processes() {
    local pids=()
    local pattern
    local quiet_mode="${1:-false}"

    if [[ "$quiet_mode" != "true" ]]; then
        log_info "Searching for DevFlow processes..." >&2
    fi

    # Use pgrep for reliable process finding
    local simple_patterns=(
        "real-dream-team"
        "cli-integration"
        "platform-status"
        "codex-mcp"
        "devflow-server"
        "devflow-worker"
    )

    for pattern in "${simple_patterns[@]}"; do
        if [[ "$quiet_mode" != "true" ]]; then
            log_debug "Searching with pattern: $pattern" >&2
        fi

        # Use pgrep to find matching processes, excluding this script
        local found_pids
        found_pids=$(pgrep -f "$pattern" 2>/dev/null | grep -v "$$" || true)

        if [[ -n "$found_pids" ]]; then
            while IFS= read -r pid; do
                if [[ -n "$pid" ]] && [[ "$pid" =~ ^[0-9]+$ ]]; then
                    pids+=("$pid")
                    if [[ "$quiet_mode" != "true" ]]; then
                        log_debug "Found process PID: $pid" >&2
                    fi
                fi
            done <<< "$found_pids"
        fi
    done

    # Remove duplicates and ensure we have an array even if empty
    if [[ ${#pids[@]} -gt 0 ]]; then
        # Use traditional method instead of readarray for compatibility
        local unique_pids
        unique_pids=$(printf '%s\n' "${pids[@]}" | sort -u | tr '\n' ' ')
        if [[ "$quiet_mode" != "true" ]]; then
            log_info "Found ${#pids[@]} DevFlow processes" >&2
        fi
        echo "$unique_pids"
    else
        if [[ "$quiet_mode" != "true" ]]; then
            log_info "Found 0 DevFlow processes" >&2
        fi
        echo ""
    fi
}

get_process_info() {
    local pid="$1"
    ps -o pid,ppid,user,comm,args=COMMAND -p "$pid" 2>/dev/null || echo "PID $pid (process info unavailable)"
}

# -----------------------------------------------------------------------------
# Process Termination Functions
# -----------------------------------------------------------------------------
terminate_process() {
    local pid="$1"
    local signal="$2"
    
    log_debug "Sending $signal to PID $pid"
    
    if ! kill "-$signal" "$pid" 2>/dev/null; then
        log_debug "Failed to send $signal to PID $pid"
        return 1
    fi
    
    return 0
}

wait_for_process_termination() {
    local pid="$1"
    local timeout="${2:-$GRACE_PERIOD}"
    local count=0

    log_debug "Waiting for PID $pid to terminate (timeout: ${timeout}s)"

    while [[ $count -lt $timeout ]]; do
        if ! is_process_running "$pid"; then
            log_debug "PID $pid terminated successfully"
            return 0
        fi
        sleep 1
        ((count++))
    done

    log_debug "PID $pid did not terminate within ${timeout}s"
    return 1
}

kill_process_gracefully() {
    local pid="$1"
    local signal

    log_info "Attempting graceful termination of PID $pid"

    # Try multiple signals in order of preference
    for signal in "${TERMINATION_SIGNALS[@]}"; do
        if terminate_process "$pid" "$signal"; then
            if wait_for_process_termination "$pid"; then
                return 0
            fi
        else
            log_debug "Could not send $signal to PID $pid"
        fi
    done

    log_warn "Graceful termination failed for PID $pid, attempting force kill"
    return 1
}

force_kill_process() {
    local pid="$1"

    log_info "Force killing PID $pid"

    if terminate_process "$pid" "$FORCE_SIGNAL"; then
        if wait_for_process_termination "$pid" "$FORCE_TIMEOUT"; then
            log_info "Force kill successful for PID $pid"
            return 0
        else
            log_error "Force kill failed for PID $pid - process may still be running"
            return 1
        fi
    else
        log_error "Could not send $FORCE_SIGNAL to PID $pid"
        return 1
    fi
}

# -----------------------------------------------------------------------------
# Main Cleanup Functions
# -----------------------------------------------------------------------------
cleanup_process() {
    local pid="$1"
    local result=0

    log_info "Cleaning up process PID $pid"
    log_debug "Process info: $(get_process_info "$pid")"

    # Check permissions
    if ! check_permission "$pid"; then
        log_warn "Insufficient permissions to terminate PID $pid (skipping)"
        return 1
    fi

    # Check if process is still running
    if ! is_process_running "$pid"; then
        log_debug "PID $pid is no longer running"
        return 0
    fi

    # Try graceful termination first
    if ! kill_process_gracefully "$pid"; then
        # If graceful termination fails, try force kill
        if ! force_kill_process "$pid"; then
            result=1
        fi
    fi

    return $result
}

cleanup_all_processes() {
    local pids
    local result=0
    local pid

    # Find all DevFlow processes (quiet mode to avoid log capture)
    read -ra pids <<< "$(find_devflow_processes true)"

    if [[ ${#pids[@]} -eq 0 ]]; then
        log_info "No DevFlow processes found"
        return 0
    fi

    log_info "Attempting to clean up ${#pids[@]} processes"

    # Clean up each process
    for pid in "${pids[@]}"; do
        if ! cleanup_process "$pid"; then
            log_error "Failed to clean up PID $pid"
            result=1
        fi
    done

    if [[ $result -eq 0 ]]; then
        log_info "All DevFlow processes cleaned up successfully"
    else
        log_warn "Some processes could not be cleaned up"
    fi

    return $result
}

# -----------------------------------------------------------------------------
# Display Functions
# -----------------------------------------------------------------------------
show_help() {
    cat << EOF
$SCRIPT_NAME v$VERSION

Robust process cleanup system for DevFlow services.

USAGE:
    $0 [OPTIONS]

OPTIONS:
    -h, --help      Show this help message
    -v, --verbose   Enable verbose logging
    -d, --debug     Enable debug logging
    --dry-run       Show what would be cleaned up without actually doing it

EXAMPLES:
    $0              # Clean up all DevFlow processes
    $0 --dry-run    # Show processes that would be cleaned up
    $0 --verbose    # Run with verbose output

EOF
}

show_dry_run() {
    echo "Would clean up the following processes:"
    printf "%-10s %-10s %-15s %s\n" "PID" "PPID" "USER" "COMMAND"
    printf "%-10s %-10s %-15s %s\n" "---" "----" "----" "-------"

    # Use pgrep directly for dry run to avoid log capture
    local simple_patterns=(
        "real-dream-team"
        "cli-integration"
        "platform-status"
        "codex-mcp"
        "devflow-server"
        "devflow-worker"
    )

    local found_any=false
    for pattern in "${simple_patterns[@]}"; do
        local found_pids
        found_pids=$(pgrep -f "$pattern" 2>/dev/null | grep -v "$$" || true)

        if [[ -n "$found_pids" ]]; then
            while IFS= read -r pid; do
                if [[ -n "$pid" ]] && [[ "$pid" =~ ^[0-9]+$ ]]; then
                    if ps -o pid,ppid,user,comm -p "$pid" >/dev/null 2>&1; then
                        ps -o pid,ppid,user,comm -p "$pid" | tail -n +2
                        found_any=true
                    fi
                fi
            done <<< "$found_pids"
        fi
    done

    if [[ "$found_any" = false ]]; then
        echo "No DevFlow processes found"
    fi
}

# -----------------------------------------------------------------------------
# Main Execution
# -----------------------------------------------------------------------------
main() {
    local dry_run=false

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -d|--debug)
                DEBUG=true
                shift
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    log_info "Starting $SCRIPT_NAME v$VERSION"

    # Check if running as root (recommended for full cleanup)
    if [[ "$(id -u)" != "0" ]]; then
        log_warn "Not running as root - some processes may not be accessible"
    fi

    # Perform dry run or actual cleanup
    if [[ "$dry_run" == true ]]; then
        show_dry_run
        log_info "Dry run completed"
    else
        if cleanup_all_processes; then
            log_info "$SCRIPT_NAME completed successfully"
            exit 0
        else
            log_error "$SCRIPT_NAME completed with errors"
            exit 1
        fi
    fi
}

# -----------------------------------------------------------------------------
# Script Entry Point
# -----------------------------------------------------------------------------
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi