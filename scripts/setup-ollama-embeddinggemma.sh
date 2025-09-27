#!/bin/bash

# Ollama EmbeddingGemma Setup and Verification Script
# Task ID: DEVFLOW-OLLAMA-001
# Purpose: Setup Ollama environment and verify EmbeddingGemma functionality

set -euo pipefail

# Color codes for output formatting
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Configuration
readonly MODEL_NAME="embeddinggemma:300m"
readonly MODEL_SIZE="622MB"
readonly EXPECTED_DIMENSIONS=768
readonly TEST_TEXT="The quick brown fox jumps over the lazy dog"
readonly OLLAMA_SERVICE="ollama"
readonly VERIFICATION_SCRIPT="verify_embeddinggemma.sh"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check system requirements
check_system_requirements() {
    log_info "Checking system requirements..."
    
    # Check macOS
    if [[ "$(uname)" != "Darwin" ]]; then
        log_error "This script is designed for macOS systems only"
        exit 1
    fi
    
    # Check available RAM (at least 8GB recommended)
    local available_ram
    available_ram=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
    local ram_gb=$((available_ram * 4096 / 1024 / 1024 / 1024))
    
    if [[ $ram_gb -lt 8 ]]; then
        log_warning "Available RAM is less than 8GB (${ram_gb}GB detected). Performance may be impacted."
    else
        log_success "Sufficient RAM available (${ram_gb}GB)"
    fi
    
    log_success "System requirements check passed"
}

# Install Ollama
install_ollama() {
    log_info "Installing Ollama..."
    
    if command_exists ollama; then
        local version
        version=$(ollama --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
        log_success "Ollama already installed (version ${version})"
        return 0
    fi
    
    # Download and install Ollama
    if ! curl -fsSL https://ollama.com/install.sh | sh; then
        log_error "Failed to install Ollama"
        exit 1
    fi
    
    # Wait for installation to complete
    sleep 5
    
    # Verify installation
    if ! command_exists ollama; then
        log_error "Ollama installation failed or not found in PATH"
        exit 1
    fi
    
    log_success "Ollama installed successfully"
}

# Start Ollama service
start_ollama_service() {
    log_info "Starting Ollama service..."
    
    # Check if service is already running
    if pgrep -x "ollama" > /dev/null; then
        log_success "Ollama service is already running"
        return 0
    fi
    
    # Start the service
    if ! ollama serve > /dev/null 2>&1 & then
        log_error "Failed to start Ollama service"
        exit 1
    fi
    
    # Wait for service to be ready
    local attempts=0
    local max_attempts=30
    while ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; do
        attempts=$((attempts + 1))
        if [[ $attempts -ge $max_attempts ]]; then
            log_error "Ollama service failed to start within timeout period"
            exit 1
        fi
        sleep 2
    done
    
    log_success "Ollama service started successfully"
}

# Download EmbeddingGemma model
download_model() {
    log_info "Downloading ${MODEL_NAME} model (${MODEL_SIZE})..."
    
    # Check if model is already downloaded
    if ollama list | grep -q "${MODEL_NAME}"; then
        log_success "Model ${MODEL_NAME} is already downloaded"
        return 0
    fi
    
    # Download the model
    if ! ollama pull "${MODEL_NAME}"; then
        log_error "Failed to download model ${MODEL_NAME}"
        exit 1
    fi
    
    log_success "Model ${MODEL_NAME} downloaded successfully"
}

# Test basic API functionality
test_api_functionality() {
    log_info "Testing basic API functionality..."
    
    # Test API availability
    if ! curl -s -f http://localhost:11434/api/tags >/dev/null; then
        log_error "Ollama API is not responding"
        exit 1
    fi
    
    # Test model listing
    local model_list
    model_list=$(ollama list)
    if ! echo "$model_list" | grep -q "${MODEL_NAME}"; then
        log_error "Model ${MODEL_NAME} not found in model list"
        exit 1
    fi
    
    log_success "API functionality test passed"
}

# Verify embedding output dimensions
verify_embedding_dimensions() {
    log_info "Verifying embedding output dimensions..."
    
    # Generate embedding
    local response
    response=$(curl -s -X POST http://localhost:11434/api/embeddings \
        -H "Content-Type: application/json" \
        -d "{\"model\": \"${MODEL_NAME}\", \"prompt\": \"${TEST_TEXT}\"}")
    
    # Check if request was successful
    if [[ $? -ne 0 ]] || [[ -z "$response" ]]; then
        log_error "Failed to generate embedding"
        exit 1
    fi
    
    # Extract embedding array
    local embedding
    embedding=$(echo "$response" | jq -r '.embedding')
    
    if [[ "$embedding" == "null" ]] || [[ -z "$embedding" ]]; then
        log_error "Embedding not found in response"
        exit 1
    fi
    
    # Count dimensions
    local dimensions
    dimensions=$(echo "$embedding" | jq 'length')
    
    if [[ $? -ne 0 ]]; then
        log_error "Failed to parse embedding dimensions"
        exit 1
    fi
    
    # Verify dimensions
    if [[ $dimensions -ne $EXPECTED_DIMENSIONS ]]; then
        log_error "Expected ${EXPECTED_DIMENSIONS} dimensions, got ${dimensions}"
        exit 1
    fi
    
    log_success "Embedding dimensions verified: ${dimensions} (expected: ${EXPECTED_DIMENSIONS})"
}

# Create verification script
create_verification_script() {
    log_info "Creating verification script: ${VERIFICATION_SCRIPT}..."
    
    cat > "${VERIFICATION_SCRIPT}" << 'EOF'
#!/bin/bash

# EmbeddingGemma Verification Script
# Automatically verify Ollama EmbeddingGemma functionality

set -euo pipefail

readonly MODEL_NAME="embeddinggemma:300m"
readonly EXPECTED_DIMENSIONS=768
readonly TEST_TEXT="Verification test for EmbeddingGemma model"

# Color codes
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Check if required commands exist
for cmd in curl jq ollama; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        log_error "$cmd is not installed"
        exit 1
    fi
done

# Verify model is available
if ! ollama list | grep -q "${MODEL_NAME}"; then
    log_error "Model ${MODEL_NAME} not found"
    exit 1
fi

# Generate embedding
log_info "Generating test embedding..."
response=$(curl -s -X POST http://localhost:11434/api/embeddings \
    -H "Content-Type: application/json" \
    -d "{\"model\": \"${MODEL_NAME}\", \"prompt\": \"${TEST_TEXT}\"}")

# Check response
if [[ $? -ne 0 ]] || [[ -z "$response" ]]; then
    log_error "Failed to generate embedding"
    exit 1
fi

# Verify embedding dimensions
dimensions=$(echo "$response" | jq -r '.embedding | length')

if [[ $? -ne 0 ]] || [[ "$dimensions" == "null" ]]; then
    log_error "Failed to parse embedding"
    exit 1
fi

if [[ $dimensions -ne $EXPECTED_DIMENSIONS ]]; then
    log_error "Dimension mismatch: expected ${EXPECTED_DIMENSIONS}, got ${dimensions}"
    exit 1
fi

log_success "Verification successful: ${dimensions} dimensions confirmed"
echo "$response" | jq '.embedding[:5]'  # Show first 5 values as sample
EOF

    # Make script executable
    chmod +x "${VERIFICATION_SCRIPT}"
    
    log_success "Verification script created successfully"
}

# Main execution
main() {
    log_info "Starting Ollama EmbeddingGemma setup and verification"
    
    # Check prerequisites
    for cmd in curl jq; do
        if ! command_exists "$cmd"; then
            log_error "$cmd is required but not installed"
            exit 1
        fi
    done
    
    check_system_requirements
    install_ollama
    start_ollama_service
    download_model
    test_api_functionality
    verify_embedding_dimensions
    create_verification_script
    
    log_success "Ollama EmbeddingGemma setup and verification completed successfully!"
    echo
    log_info "To verify the setup at any time, run: ./${VERIFICATION_SCRIPT}"
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi