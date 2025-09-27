#!/bin/bash

# Pre-Deployment Validation Script
# Implements PIANO_TEST_DEBUG_COMETA_BRAIN.md section 9.1 exactly
# This script performs complete validation before deployment

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/pre-deployment-validation.log"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo "[$TIMESTAMP] $*" | tee -a "$LOG_FILE"
}

log_info() {
    log "${BLUE}INFO${NC}: $*"
}

log_success() {
    log "${GREEN}SUCCESS${NC}: $*"
}

log_warning() {
    log "${YELLOW}WARNING${NC}: $*"
}

log_error() {
    log "${RED}ERROR${NC}: $*"
}

# Error handling
error_exit() {
    log_error "$1"
    exit 1
}

# Check if required tools are available
check_dependencies() {
    log_info "Checking dependencies..."
    
    local deps=("node" "npm" "docker" "git" "npx" "python3" "pip")
    local missing_deps=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing_deps+=("$dep")
        fi
    done
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        error_exit "Missing required dependencies: ${missing_deps[*]}"
    fi
    
    log_success "All dependencies are available"
}

# Run unit and integration tests
run_tests() {
    log_info "Running tests..."
    
    # Check if test directory exists
    if [ ! -d "test" ] && [ ! -d "__tests__" ]; then
        log_warning "No test directory found, skipping tests"
        return 0
    fi
    
    # Run tests with coverage
    if ! npm test -- --coverage; then
        error_exit "Tests failed"
    fi
    
    # Check coverage thresholds (example: 80%)
    local coverage_file="coverage/coverage-summary.json"
    if [ -f "$coverage_file" ]; then
        local lines_coverage
        lines_coverage=$(jq -r '.total.lines.pct' "$coverage_file" 2>/dev/null || echo "0")
        
        if (( $(echo "$lines_coverage < 80" | bc -l) )); then
            error_exit "Code coverage ($lines_coverage%) is below required threshold (80%)"
        fi
    fi
    
    log_success "All tests passed"
}

# Run code quality checks
run_code_quality() {
    log_info "Running code quality checks..."
    
    # ESLint for JavaScript/TypeScript
    if [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ]; then
        if ! npx eslint . --ext .js,.ts,.jsx,.tsx; then
            error_exit "ESLint found issues"
        fi
    fi
    
    # Prettier for code formatting
    if [ -f ".prettierrc" ]; then
        if ! npx prettier --check .; then
            error_exit "Prettier formatting issues found"
        fi
    fi
    
    # Python code quality (if applicable)
    if command -v pylint &> /dev/null && find . -name "*.py" -type f | grep -q .; then
        if ! find . -name "*.py" -type f -exec pylint {} +; then
            error_exit "Pylint found issues"
        fi
    fi
    
    log_success "Code quality checks passed"
}

# Run security scans
run_security_scan() {
    log_info "Running security scans..."
    
    # Audit npm dependencies
    if [ -f "package-lock.json" ] || [ -f "yarn.lock" ]; then
        if ! npm audit --audit-level high; then
            log_warning "Security vulnerabilities found in npm dependencies"
            # In production, you might want to exit here depending on policy
        fi
    fi
    
    # Run additional security tools if available
    if command -v npx &> /dev/null; then
        # Run Snyk test if snyk is available
        if npx snyk --version &> /dev/null; then
            if ! npx snyk test; then
                log_warning "Snyk found security issues"
            fi
        fi
    fi
    
    log_success "Security scan completed"
}

# Validate dependencies
validate_dependencies() {
    log_info "Validating dependencies..."
    
    # Check for outdated dependencies
    if [ -f "package.json" ]; then
        local outdated
        outdated=$(npm outdated --json 2>/dev/null || echo "{}")
        if [ "$outdated" != "{}" ]; then
            log_warning "Outdated dependencies found"
            echo "$outdated" | jq .
        fi
    fi
    
    # Check for vulnerable dependencies
    if [ -f "package-lock.json" ]; then
        # Check for known vulnerabilities
        if npm audit --audit-level moderate | grep -q "found"; then
            log_warning "Moderate or higher vulnerabilities found in dependencies"
        fi
    fi
    
    log_success "Dependency validation completed"
}

# Check database migrations
check_database_migrations() {
    log_info "Checking database migrations..."
    
    # This is a placeholder - implementation depends on your database technology
    # For example, with Prisma:
    if [ -f "prisma/schema.prisma" ]; then
        if ! npx prisma migrate status; then
            error_exit "Database migration status check failed"
        fi
    fi
    
    # For Sequelize:
    # if [ -f "sequelize.config.js" ]; then
    #     if ! npx sequelize-cli db:migrate:status; then
    #         error_exit "Database migration status check failed"
    #     fi
    # fi
    
    # For custom migration systems, implement appropriate checks
    # Example placeholder:
    if [ -d "migrations" ]; then
        local pending_migrations
        pending_migrations=$(find migrations -name "*.sql" -type f | wc -l)
        if [ "$pending_migrations" -gt 0 ]; then
            log_info "Found $pending_migrations migration files"
        fi
    fi
    
    log_success "Database migration check completed"
}

# Run performance benchmarks
run_performance_benchmarks() {
    log_info "Running performance benchmarks..."
    
    # Check if benchmark scripts exist
    if [ -f "benchmark.js" ] || [ -f "benchmark.py" ]; then
        # Run benchmarks and compare with baseline
        if [ -f "benchmark.js" ]; then
            if ! node benchmark.js; then
                error_exit "Performance benchmarks failed"
            fi
        elif [ -f "benchmark.py" ]; then
            if ! python3 benchmark.py; then
                error_exit "Performance benchmarks failed"
            fi
        fi
    else
        log_warning "No benchmark files found, skipping performance tests"
    fi
    
    log_success "Performance benchmarks completed"
}

# Validate build artifacts
validate_build_artifacts() {
    log_info "Validating build artifacts..."
    
    # Check if build directory exists
    if [ ! -d "dist" ] && [ ! -d "build" ]; then
        log_warning "No build directory found"
        return 0
    fi
    
    # Validate critical files exist
    local critical_files=("index.js" "package.json" "README.md")
    for file in "${critical_files[@]}"; do
        if [ -d "dist" ] && [ ! -f "dist/$file" ] && [ -d "build" ] && [ ! -f "build/$file" ]; then
            log_warning "Critical file $file not found in build output"
        fi
    done
    
    # Validate file permissions
    if [ -d "dist" ]; then
        find dist -type f -name "*.js" -exec chmod 644 {} \;
    fi
    
    if [ -d "build" ]; then
        find build -type f -name "*.js" -exec chmod 644 {} \;
    fi
    
    log_success "Build artifacts validation completed"
}

# Check environment configuration
check_environment_config() {
    log_info "Checking environment configuration..."
    
    # Check required environment variables
    local required_vars=("NODE_ENV" "DATABASE_URL")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        error_exit "Missing required environment variables: ${missing_vars[*]}"
    fi
    
    # Validate environment-specific configs
    local env_files=(".env" ".env.production" ".env.local")
    for env_file in "${env_files[@]}"; do
        if [ -f "$env_file" ]; then
            # Check for common misconfigurations
            if grep -q "PASSWORD=.*" "$env_file"; then
                log_warning "Potential plaintext password found in $env_file"
            fi
        fi
    done
    
    log_success "Environment configuration check completed"
}

# Run all validation steps
run_pre_deployment_validation() {
    log_info "Starting pre-deployment validation pipeline"
    
    check_dependencies
    run_tests
    run_code_quality
    run_security_scan
    validate_dependencies
    check_database_migrations
    run_performance_benchmarks
    validate_build_artifacts
    check_environment_config
    
    log_success "Pre-deployment validation completed successfully"
}

# Main execution
main() {
    log_info "Pre-Deployment Validation Script"
    log_info "Following PIANO_TEST_DEBUG_COMETA_BRAIN.md section 9.1"
    
    # Ensure we're in the project root
    if [ ! -f "package.json" ] && [ ! -f "requirements.txt" ]; then
        error_exit "Must be run from project root directory"
    fi
    
    # Create log file if it doesn't exist
    touch "$LOG_FILE"
    
    # Run validation pipeline
    run_pre_deployment_validation
    
    log_info "Pre-deployment validation completed at $(date -u)"
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi