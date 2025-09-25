#!/bin/bash
# Test script for safe hooks implementation
# Verifies that memory management and subprocess cleanup work correctly

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TEST_LOG="$PROJECT_DIR/logs/safe-hooks-test.log"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_test() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$TEST_LOG"

    case $level in
        "PASS") echo -e "${GREEN}✅ $message${NC}" ;;
        "FAIL") echo -e "${RED}❌ $message${NC}" ;;
        "WARN") echo -e "${YELLOW}⚠️  $message${NC}" ;;
        "INFO") echo -e "${BLUE}ℹ️  $message${NC}" ;;
    esac
}

test_hook_safety_config() {
    log_test "INFO" "Testing hook safety configuration..."

    local config_file="$PROJECT_DIR/.devflow/hook-safety-config.json"

    if [[ -f "$config_file" ]]; then
        log_test "PASS" "Hook safety config exists"

        # Validate JSON
        if python3 -m json.tool "$config_file" > /dev/null 2>&1; then
            log_test "PASS" "Hook safety config is valid JSON"
        else
            log_test "FAIL" "Hook safety config is invalid JSON"
            return 1
        fi
    else
        log_test "FAIL" "Hook safety config missing"
        return 1
    fi

    return 0
}

test_memory_bridge_safe() {
    log_test "INFO" "Testing safe memory bridge..."

    local bridge_file="$PROJECT_DIR/scripts/memory-bridge-runner-safe.js"

    if [[ -f "$bridge_file" ]]; then
        log_test "PASS" "Safe memory bridge exists"

        # Test basic functionality
        local test_data='{"user_prompt":"test prompt","session_id":"test123","project_id":1}'
        local result=$(timeout 10s node "$bridge_file" "context-injection" "$test_data" 2>/dev/null)

        if [[ $? -eq 0 && -n "$result" ]]; then
            log_test "PASS" "Safe memory bridge responds correctly"

            # Check if response is valid JSON
            if echo "$result" | python3 -m json.tool > /dev/null 2>&1; then
                log_test "PASS" "Safe memory bridge returns valid JSON"
            else
                log_test "FAIL" "Safe memory bridge returns invalid JSON"
                return 1
            fi
        else
            log_test "FAIL" "Safe memory bridge does not respond"
            return 1
        fi
    else
        log_test "FAIL" "Safe memory bridge missing"
        return 1
    fi

    return 0
}

test_enhanced_hook_safe() {
    log_test "INFO" "Testing safe enhanced memory hook..."

    local hook_file="$PROJECT_DIR/.claude/hooks/enhanced-memory-integration-safe.py"

    if [[ -f "$hook_file" ]]; then
        log_test "PASS" "Safe enhanced memory hook exists"

        # Test syntax
        if python3 -m py_compile "$hook_file" 2>/dev/null; then
            log_test "PASS" "Safe enhanced memory hook has valid Python syntax"
        else
            log_test "FAIL" "Safe enhanced memory hook has Python syntax errors"
            return 1
        fi

        # Test basic execution
        local test_data='{"prompt":"test prompt for context injection"}'
        local result=$(timeout 10s python3 "$hook_file" "UserPromptSubmit" "$test_data" 2>/dev/null)

        if [[ $? -eq 0 ]]; then
            log_test "PASS" "Safe enhanced memory hook executes without errors"

            # Check if it returns valid JSON
            if echo "$result" | python3 -m json.tool > /dev/null 2>&1; then
                log_test "PASS" "Safe enhanced memory hook returns valid JSON"
            else
                log_test "WARN" "Safe enhanced memory hook returns non-JSON output (may be normal)"
            fi
        else
            log_test "FAIL" "Safe enhanced memory hook fails to execute"
            return 1
        fi
    else
        log_test "FAIL" "Safe enhanced memory hook missing"
        return 1
    fi

    return 0
}

test_system_health_monitor() {
    log_test "INFO" "Testing system health monitor..."

    local monitor_file="$PROJECT_DIR/scripts/system-health-monitor.sh"

    if [[ -f "$monitor_file" ]]; then
        log_test "PASS" "System health monitor exists"

        if [[ -x "$monitor_file" ]]; then
            log_test "PASS" "System health monitor is executable"
        else
            log_test "FAIL" "System health monitor is not executable"
            return 1
        fi
    else
        log_test "FAIL" "System health monitor missing"
        return 1
    fi

    return 0
}

test_memory_pressure_simulation() {
    log_test "INFO" "Testing memory pressure handling..."

    local bridge_file="$PROJECT_DIR/scripts/memory-bridge-runner-safe.js"

    if [[ -f "$bridge_file" ]]; then
        # Test health check endpoint
        local health_result=$(timeout 5s node "$bridge_file" "health-check" '{}' 2>/dev/null)

        if [[ $? -eq 0 && -n "$health_result" ]]; then
            log_test "PASS" "Memory bridge health check responds"

            # Parse health status
            local health_status=$(echo "$health_result" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(data.get('overall_health', 'unknown'))
except:
    print('error')
")

            if [[ "$health_status" == "healthy" ]]; then
                log_test "PASS" "Memory bridge reports healthy status"
            else
                log_test "WARN" "Memory bridge reports non-healthy status: $health_status"
            fi
        else
            log_test "FAIL" "Memory bridge health check fails"
            return 1
        fi
    fi

    return 0
}

test_process_cleanup() {
    log_test "INFO" "Testing process cleanup mechanisms..."

    local initial_processes=$(pgrep -f "memory-bridge-runner" | wc -l)
    log_test "INFO" "Initial memory bridge processes: $initial_processes"

    # Start a test process
    local bridge_file="$PROJECT_DIR/scripts/memory-bridge-runner-safe.js"
    if [[ -f "$bridge_file" ]]; then
        # Start background process
        timeout 3s node "$bridge_file" "health-check" '{}' &
        local test_pid=$!

        sleep 1

        # Check if process exists
        if kill -0 $test_pid 2>/dev/null; then
            log_test "INFO" "Test process started successfully"
        else
            log_test "WARN" "Test process already completed"
        fi

        # Wait for completion or timeout
        wait $test_pid 2>/dev/null
        local exit_code=$?

        if [[ $exit_code -eq 0 ]]; then
            log_test "PASS" "Test process completed normally"
        elif [[ $exit_code -eq 124 ]]; then
            log_test "PASS" "Test process timed out as expected"
        else
            log_test "WARN" "Test process exited with code: $exit_code"
        fi

        # Check for cleanup
        sleep 1
        local final_processes=$(pgrep -f "memory-bridge-runner" | wc -l)

        if [[ $final_processes -le $initial_processes ]]; then
            log_test "PASS" "Process cleanup working correctly"
        else
            log_test "WARN" "Possible process leak detected"
        fi
    fi

    return 0
}

test_original_hook_disabled() {
    log_test "INFO" "Verifying original hook is disabled..."

    local original_hook="$PROJECT_DIR/.claude/hooks/enhanced-memory-integration.py"
    local disabled_hook="$PROJECT_DIR/.claude/hooks/enhanced-memory-integration.py.disabled"

    if [[ -f "$disabled_hook" && ! -f "$original_hook" ]]; then
        log_test "PASS" "Original hook properly disabled"
    elif [[ ! -f "$original_hook" ]]; then
        log_test "PASS" "Original hook removed/not present"
    else
        log_test "FAIL" "Original hook still active - this is dangerous!"
        return 1
    fi

    return 0
}

run_comprehensive_tests() {
    log_test "INFO" "Starting comprehensive safe hooks testing..."
    echo

    local total_tests=0
    local passed_tests=0
    local failed_tests=0

    # Create logs directory
    mkdir -p "$(dirname "$TEST_LOG")"
    echo "Safe Hooks Test Results - $(date)" > "$TEST_LOG"
    echo "======================================" >> "$TEST_LOG"

    # Run all tests
    tests=(
        "test_original_hook_disabled"
        "test_hook_safety_config"
        "test_system_health_monitor"
        "test_memory_bridge_safe"
        "test_enhanced_hook_safe"
        "test_memory_pressure_simulation"
        "test_process_cleanup"
    )

    for test_func in "${tests[@]}"; do
        echo
        total_tests=$((total_tests + 1))

        if $test_func; then
            passed_tests=$((passed_tests + 1))
        else
            failed_tests=$((failed_tests + 1))
        fi
    done

    # Summary
    echo
    echo "========================================"
    log_test "INFO" "Test Summary:"
    log_test "INFO" "Total Tests: $total_tests"
    log_test "INFO" "Passed: $passed_tests"
    log_test "INFO" "Failed: $failed_tests"

    if [[ $failed_tests -eq 0 ]]; then
        log_test "PASS" "All tests passed! Safe hooks ready for activation."
        return 0
    else
        log_test "FAIL" "$failed_tests test(s) failed. Review issues before activation."
        return 1
    fi
}

# Handle script arguments
case "${1:-run}" in
    "run"|"test")
        run_comprehensive_tests
        ;;
    "config")
        test_hook_safety_config
        ;;
    "bridge")
        test_memory_bridge_safe
        ;;
    "hook")
        test_enhanced_hook_safe
        ;;
    "monitor")
        test_system_health_monitor
        ;;
    "cleanup")
        test_process_cleanup
        ;;
    *)
        echo "Usage: $0 [run|config|bridge|hook|monitor|cleanup]"
        echo "  run     - Run all tests (default)"
        echo "  config  - Test hook safety configuration"
        echo "  bridge  - Test safe memory bridge"
        echo "  hook    - Test safe enhanced memory hook"
        echo "  monitor - Test system health monitor"
        echo "  cleanup - Test process cleanup mechanisms"
        exit 1
        ;;
esac