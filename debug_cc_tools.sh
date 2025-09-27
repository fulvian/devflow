#!/bin/bash

echo "🔍 CC-Tools gRPC Server Debug Script"
echo "======================================"

PROJECT_ROOT="/Users/fulvioventura/devflow"
GO_SERVER_DIR="$PROJECT_ROOT/go-server"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[✅]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[⚠️ ]${NC} $1"; }
print_error() { echo -e "${RED}[❌]${NC} $1"; }

echo -e "\n📋 Phase 1: Environment Validation"
echo "-----------------------------------"

if [ ! -f "$GO_SERVER_DIR/cc-tools-server" ]; then
  print_error "CC-Tools server binary not found at $GO_SERVER_DIR/cc-tools-server"
  echo "Build it with: (cd $GO_SERVER_DIR && go build -o cc-tools-server .)"
  exit 1
fi
print_status "CC-Tools server binary exists"

if ! command -v grpcurl >/dev/null 2>&1; then
  print_warning "grpcurl not found. Install via Homebrew: brew install grpcurl"
else
  print_status "grpcurl available"
fi

echo -e "\n🌐 Phase 2: Network Diagnostics"
echo "--------------------------------"

# Check if port is in use
if lsof -i :50051 >/dev/null 2>&1; then
  print_warning "Port 50051 already in use:"
  lsof -i :50051
  echo "Stopping existing processes..."
  pkill -f cc-tools-server || true
  sleep 2
fi

echo "Starting CC-Tools server..."
cd "$GO_SERVER_DIR"
nohup ./cc-tools-server > debug.log 2>&1 &
SERVER_PID=$!
cd "$PROJECT_ROOT"

sleep 3

if ! kill -0 $SERVER_PID 2>/dev/null; then
  print_error "Server failed to start"
  echo "--- go-server/debug.log ---"
  cat "$GO_SERVER_DIR/debug.log" || true
  exit 1
fi
print_status "Server started (PID: $SERVER_PID)"

echo -e "\n🔌 Testing connectivity..."

if netstat -an | grep -q "\.50051.*LISTEN"; then
  print_status "Port 50051 is listening"
else
  print_error "Port 50051 not listening"
fi

if nc -z localhost 50051 >/dev/null 2>&1; then
  print_status "Basic TCP connection successful"
else
  print_error "Basic TCP connection failed"
fi

echo -e "\n🚀 Phase 3: gRPC Testing"
echo "-------------------------"

if command -v grpcurl >/dev/null 2>&1; then
  if grpcurl -plaintext localhost:50051 list >/dev/null 2>&1; then
    print_status "gRPC reflection working"
    grpcurl -plaintext localhost:50051 list
  else
    print_warning "gRPC reflection not available"
  fi

  echo -e "\n🧪 Testing CC-Tools service..."
  if grpcurl -plaintext localhost:50051 \
    cc_tools_integration.CCToolsIntegration/GetProjectMetadata \
    -d '{"project_root": "/tmp", "hook_type": "test"}' >/dev/null 2>&1; then
    print_status "CC-Tools service responding"
  else
    print_error "CC-Tools service not responding"
    echo "gRPC error details:"
    grpcurl -plaintext localhost:50051 \
      cc_tools_integration.CCToolsIntegration/GetProjectMetadata \
      -d '{"project_root": "/tmp", "hook_type": "test"}' || true
  fi
else
  print_warning "grpcurl not installed; skipping reflection/service tests"
fi

echo -e "\n🐍 Phase 4: Python Client Test"
echo "-------------------------------"

if [ -f "$PROJECT_ROOT/test_grpc_client.py" ]; then
  python3 "$PROJECT_ROOT/test_grpc_client.py" || true
else
  print_warning "Python test client not found"
fi

echo -e "\n🧹 Cleanup"
echo "----------"
kill $SERVER_PID 2>/dev/null || true
print_status "Server stopped"

echo -e "\n📋 Debug complete. Check logs at: $GO_SERVER_DIR/debug.log"

