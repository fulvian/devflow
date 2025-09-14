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
