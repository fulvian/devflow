#!/bin/bash

# TypeScript build script for production deployment
# Error handling enabled
set -e

# Define colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
echo_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

echo_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

echo_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo_error "This script must be run from the project root directory"
  exit 1
fi

# Ensure required tools are installed
echo_info "Checking for required tools..."
if ! command -v npm &> /dev/null; then
  echo_error "npm is not installed. Please install Node.js first."
  exit 1
fi

if ! command -v tsc &> /dev/null; then
  echo_warn "TypeScript compiler not found. Installing..."
  npm install -g typescript
fi

# Clean previous builds
echo_info "Cleaning previous builds..."
rm -rf dist/

# Install dependencies
echo_info "Installing dependencies..."
npm ci

# Build TypeScript
echo_info "Compiling TypeScript with production configuration..."
npx tsc -p production/tsconfig.production.json

# Copy configuration files
echo_info "Copying configuration files..."
cp -r production/config dist/

# Create necessary directories
mkdir -p dist/logs
mkdir -p dist/data

# Set permissions
echo_info "Setting permissions..."
chmod +x dist/src/index.js

# Finalize
echo_info "Build completed successfully!"
echo_info "Production files are located in the dist/ directory"
