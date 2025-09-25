#!/bin/bash
# System Health Monitor for DevFlow - Prevents macOS crashes
# Monitors memory pressure, CPU usage, and subprocess count

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_DIR/logs/system-health-monitor.log"
ALERT_FILE="$PROJECT_DIR/logs/system-alerts.log"

# Configuration
MEMORY_THRESHOLD=400000  # Pages (400k pages * 16KB = ~6.4GB)
CPU_THRESHOLD=70         # CPU percentage
SUBPROCESS_THRESHOLD=15  # Max subprocess count
CHECK_INTERVAL=30        # Seconds between checks

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

log_message() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

alert_message() {
    local message=$1
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] ALERT: $message" | tee -a "$ALERT_FILE"
    echo -e "${RED}🚨 ALERT: $message${NC}"
}

get_memory_usage() {
    # Get active memory pages from vm_stat
    vm_stat | grep "Pages active" | awk '{print $3}' | tr -d '.'
}

get_cpu_usage() {
    # Get CPU usage from top
    top -l 1 | grep "CPU usage" | awk '{print $3}' | tr -d '%'
}

get_subprocess_count() {
    # Count DevFlow related processes
    ps aux | grep -E "(node|python|claude|devflow)" | grep -v grep | grep -v "system-health-monitor" | wc -l | tr -d ' '
}

check_disk_space() {
    # Check available disk space percentage
    df -h "$PROJECT_DIR" | tail -1 | awk '{print $5}' | tr -d '%'
}

cleanup_processes() {
    local reason=$1
    alert_message "Performing emergency cleanup due to: $reason"

    # Kill memory bridge processes that might be hanging
    pkill -f "memory-bridge-runner.js" 2>/dev/null

    # Kill hanging Python subprocess
    pkill -f "enhanced-memory-integration.py" 2>/dev/null

    # Kill old claude processes (keep current one)
    ps aux | grep claude | grep -v $$ | head -5 | awk '{print $2}' | xargs -I {} kill {} 2>/dev/null

    log_message "CLEANUP" "Emergency cleanup completed for: $reason"
}

monitor_system() {
    log_message "INFO" "Starting system health monitoring (PID: $$)"

    while true; do
        # Get current metrics
        MEMORY_PAGES=$(get_memory_usage)
        CPU_PERCENT=$(get_cpu_usage)
        SUBPROCESS_COUNT=$(get_subprocess_count)
        DISK_USAGE=$(check_disk_space)

        # Convert memory to GB for display
        MEMORY_GB=$(echo "scale=1; $MEMORY_PAGES * 16 / 1024 / 1024" | bc 2>/dev/null || echo "0")

        # Regular status log (every 5 minutes)
        if [ $(($(date +%s) % 300)) -lt $CHECK_INTERVAL ]; then
            log_message "STATUS" "Memory: ${MEMORY_GB}GB (${MEMORY_PAGES} pages), CPU: ${CPU_PERCENT}%, Processes: ${SUBPROCESS_COUNT}, Disk: ${DISK_USAGE}%"
        fi

        # Check memory threshold
        if [ "$MEMORY_PAGES" -gt "$MEMORY_THRESHOLD" ]; then
            alert_message "High memory usage: ${MEMORY_GB}GB (${MEMORY_PAGES} pages) > threshold"
            cleanup_processes "high_memory"
        fi

        # Check CPU threshold
        if [ "$CPU_PERCENT" -gt "$CPU_THRESHOLD" ]; then
            alert_message "High CPU usage: ${CPU_PERCENT}% > ${CPU_THRESHOLD}% threshold"
            cleanup_processes "high_cpu"
        fi

        # Check subprocess count
        if [ "$SUBPROCESS_COUNT" -gt "$SUBPROCESS_THRESHOLD" ]; then
            alert_message "Too many processes: ${SUBPROCESS_COUNT} > ${SUBPROCESS_THRESHOLD} threshold"
            cleanup_processes "too_many_processes"
        fi

        # Check disk space
        if [ "$DISK_USAGE" -gt 90 ]; then
            alert_message "Low disk space: ${DISK_USAGE}% used > 90% threshold"
        fi

        # Display current status with colors
        if [ "$MEMORY_PAGES" -lt 300000 ] && [ "$CPU_PERCENT" -lt 50 ] && [ "$SUBPROCESS_COUNT" -lt 10 ]; then
            echo -e "${GREEN}✅ System healthy: Mem=${MEMORY_GB}GB CPU=${CPU_PERCENT}% Proc=${SUBPROCESS_COUNT}${NC}"
        elif [ "$MEMORY_PAGES" -lt "$MEMORY_THRESHOLD" ] && [ "$CPU_PERCENT" -lt "$CPU_THRESHOLD" ]; then
            echo -e "${YELLOW}⚠️  System warning: Mem=${MEMORY_GB}GB CPU=${CPU_PERCENT}% Proc=${SUBPROCESS_COUNT}${NC}"
        else
            echo -e "${RED}🚨 System critical: Mem=${MEMORY_GB}GB CPU=${CPU_PERCENT}% Proc=${SUBPROCESS_COUNT}${NC}"
        fi

        sleep "$CHECK_INTERVAL"
    done
}

# Handle script termination
cleanup_and_exit() {
    log_message "INFO" "System health monitor stopping (PID: $$)"
    exit 0
}

trap cleanup_and_exit SIGTERM SIGINT

# Create log directories
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$(dirname "$ALERT_FILE")"

# Check if bc is available (for memory calculations)
if ! command -v bc &> /dev/null; then
    log_message "WARN" "bc command not found. Memory calculations will be simplified."
fi

# Start monitoring
echo -e "${GREEN}🔍 Starting DevFlow System Health Monitor${NC}"
echo "Log file: $LOG_FILE"
echo "Alert file: $ALERT_FILE"
echo "Press Ctrl+C to stop"
echo

monitor_system