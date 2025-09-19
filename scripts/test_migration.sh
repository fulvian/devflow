#!/bin/bash

# DevFlow Migration Test Script
# Comprehensive testing of database migration success

set -euo pipefail

# Configuration
SIMPLE_DB="data/devflow.sqlite"
ADVANCED_DB="devflow.sqlite"
TEST_REPORT="migration_test_report_$(date +%Y%m%d_%H%M%S).txt"
API_BASE_URL="http://localhost:3006"
FALLBACK_URL="http://localhost:3005"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$TEST_REPORT"
}

# Test result functions
test_start() {
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    echo -e "${BLUE}TEST $TESTS_TOTAL: $1${NC}"
    log "TEST $TESTS_TOTAL: $1"
}

test_pass() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}✓ PASS: $1${NC}"
    log "✓ PASS: $1"
}

test_fail() {
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "${RED}✗ FAIL: $1${NC}"
    log "✗ FAIL: $1"
}

test_warning() {
    echo -e "${YELLOW}⚠ WARNING: $1${NC}"
    log "⚠ WARNING: $1"
}

# Database test functions
test_database_existence() {
    test_start "Database file existence"

    if [[ -f "$ADVANCED_DB" ]]; then
        test_pass "Advanced database exists: $ADVANCED_DB"
    else
        test_fail "Advanced database missing: $ADVANCED_DB"
        return 1
    fi

    if [[ -f "$SIMPLE_DB" ]]; then
        test_pass "Simple database exists: $SIMPLE_DB"
    else
        test_warning "Simple database missing: $SIMPLE_DB (may be expected after migration)"
    fi
}

test_database_integrity() {
    test_start "Database integrity check"

    local result=$(sqlite3 "$ADVANCED_DB" "PRAGMA integrity_check;" 2>/dev/null || echo "ERROR")

    if [[ "$result" == "ok" ]]; then
        test_pass "Database integrity check passed"
    else
        test_fail "Database integrity check failed: $result"
    fi
}

test_data_counts() {
    test_start "Data count verification"

    # Count records in advanced database
    local task_count=$(sqlite3 "$ADVANCED_DB" "SELECT COUNT(*) FROM task_contexts;" 2>/dev/null || echo "0")
    local memory_count=$(sqlite3 "$ADVANCED_DB" "SELECT COUNT(*) FROM memory_blocks;" 2>/dev/null || echo "0")

    log "Advanced DB - Tasks: $task_count, Memory blocks: $memory_count"

    if [[ "$task_count" -gt 0 ]]; then
        test_pass "Found $task_count tasks in advanced database"
    else
        test_warning "No tasks found in advanced database"
    fi

    if [[ "$memory_count" -gt 0 ]]; then
        test_pass "Found $memory_count memory blocks in advanced database"
    else
        test_warning "No memory blocks found in advanced database"
    fi

    # Compare with simple database if it exists
    if [[ -f "$SIMPLE_DB" ]]; then
        local simple_task_count=$(sqlite3 "$SIMPLE_DB" "SELECT COUNT(*) FROM task_contexts;" 2>/dev/null || echo "0")
        local simple_memory_count=$(sqlite3 "$SIMPLE_DB" "SELECT COUNT(*) FROM memory_blocks;" 2>/dev/null || echo "0")

        log "Simple DB - Tasks: $simple_task_count, Memory blocks: $simple_memory_count"

        if [[ "$task_count" -ge "$simple_task_count" ]]; then
            test_pass "Task count preserved or increased ($simple_task_count → $task_count)"
        else
            test_fail "Task count decreased ($simple_task_count → $task_count)"
        fi
    fi
}

test_advanced_features() {
    test_start "Advanced features verification"

    # Test FTS tables
    local fts_tables=$(sqlite3 "$ADVANCED_DB" "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_fts%';" | wc -l)

    if [[ "$fts_tables" -gt 0 ]]; then
        test_pass "Found $fts_tables FTS tables for advanced search"
    else
        test_warning "No FTS tables found"
    fi

    # Test knowledge entities
    local knowledge_tables=$(sqlite3 "$ADVANCED_DB" "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'knowledge_%';" | wc -l)

    if [[ "$knowledge_tables" -gt 0 ]]; then
        test_pass "Found $knowledge_tables knowledge management tables"
    else
        test_warning "No knowledge management tables found"
    fi

    # Test analytics tables
    local analytics_tables=$(sqlite3 "$ADVANCED_DB" "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%analytics%' OR name LIKE '%performance%';" | wc -l)

    if [[ "$analytics_tables" -gt 0 ]]; then
        test_pass "Found $analytics_tables analytics/performance tables"
    else
        test_warning "No analytics tables found"
    fi
}

test_api_endpoints() {
    test_start "API endpoints functionality"

    # Detect which port is active
    local api_url=""
    if curl -s -f "$API_BASE_URL/health" > /dev/null 2>&1; then
        api_url="$API_BASE_URL"
        test_pass "API responding on primary port 3006"
    elif curl -s -f "$FALLBACK_URL/health" > /dev/null 2>&1; then
        api_url="$FALLBACK_URL"
        test_warning "API responding on fallback port 3005"
    else
        test_fail "API not responding on either port"
        return 1
    fi

    # Test health endpoint
    local health_response=$(curl -s "$api_url/health" 2>/dev/null || echo "ERROR")
    if [[ "$health_response" == *"OK"* ]]; then
        test_pass "Health endpoint working"
    else
        test_fail "Health endpoint failed: $health_response"
    fi

    # Test tasks API
    local tasks_response=$(curl -s "$api_url/api/tasks" -H "Authorization: Bearer dev-token" 2>/dev/null || echo "ERROR")
    if [[ "$tasks_response" == *"success"* ]] || [[ "$tasks_response" == *"AUTH_REQUIRED"* ]]; then
        test_pass "Tasks API responding (authentication system working)"
    else
        test_warning "Tasks API response unclear: $tasks_response"
    fi

    # Test memory API
    local memory_response=$(curl -s "$api_url/api/memory/query" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer dev-token" -d '{"query":"test"}' 2>/dev/null || echo "ERROR")
    if [[ "$memory_response" == *"success"* ]] || [[ "$memory_response" == *"AUTH_REQUIRED"* ]]; then
        test_pass "Memory API responding"
    else
        test_warning "Memory API response unclear: $memory_response"
    fi
}

test_performance_benchmark() {
    test_start "Performance benchmark"

    # Simple query performance test
    local start_time=$(date +%s%N)
    sqlite3 "$ADVANCED_DB" "SELECT COUNT(*) FROM task_contexts;" > /dev/null 2>&1
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds

    log "Query performance: ${duration}ms"

    if [[ "$duration" -lt 1000 ]]; then
        test_pass "Query performance acceptable (${duration}ms)"
    else
        test_warning "Query performance slow (${duration}ms)"
    fi
}

test_rollback_procedure() {
    test_start "Rollback procedure validation"

    # Check if backup exists
    local latest_backup=$(find backups -name "backup_*" -type d 2>/dev/null | sort | tail -1)

    if [[ -n "$latest_backup" ]] && [[ -d "$latest_backup" ]]; then
        test_pass "Backup directory found: $latest_backup"

        # Check if restore script exists
        if [[ -f "$latest_backup/restore.sh" ]]; then
            test_pass "Restore script available"
        else
            test_fail "Restore script missing"
        fi

        # Check if backup files exist
        local backup_files=$(find "$latest_backup" -name "*.sqlite" | wc -l)
        if [[ "$backup_files" -gt 0 ]]; then
            test_pass "Found $backup_files database backup files"
        else
            test_fail "No database backup files found"
        fi

    else
        test_fail "No backup directory found"
    fi
}

# Main test execution
main() {
    echo "=== DevFlow Migration Test Suite ==="
    echo "Starting comprehensive migration testing..."
    log "DevFlow Migration Test Suite - $(date)"
    echo ""

    # Run all tests
    test_database_existence
    test_database_integrity
    test_data_counts
    test_advanced_features
    test_api_endpoints
    test_performance_benchmark
    test_rollback_procedure

    # Generate summary
    echo ""
    echo "=== TEST SUMMARY ==="
    echo -e "Total tests: ${BLUE}$TESTS_TOTAL${NC}"
    echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Failed: ${RED}$TESTS_FAILED${NC}"

    log "=== FINAL SUMMARY ==="
    log "Total tests: $TESTS_TOTAL"
    log "Passed: $TESTS_PASSED"
    log "Failed: $TESTS_FAILED"

    if [[ "$TESTS_FAILED" -eq 0 ]]; then
        echo -e "${GREEN}🎉 ALL TESTS PASSED - Migration successful!${NC}"
        log "🎉 ALL TESTS PASSED - Migration successful!"
        exit 0
    else
        echo -e "${RED}❌ $TESTS_FAILED tests failed - Review required${NC}"
        log "❌ $TESTS_FAILED tests failed - Review required"
        exit 1
    fi
}

# Execute main function
main "$@"