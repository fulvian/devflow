#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

HOST="${1:-localhost}"
PORT="${2:-${GRPC_PORT:-50051}}"
SERVICE="cc_tools_integration.CCToolsIntegration"
PROJECT_ROOT="${3:-/tmp}"

if ! command -v grpcurl >/dev/null 2>&1; then
  echo "grpcurl non trovato. Installa con: brew install grpcurl" >&2
  exit 1
fi

# In produzione (reflection off) usiamo una chiamata applicativa come health
grpcurl -plaintext \
  -import-path "$PROJECT_ROOT_DIR/go-server/proto" \
  -proto cc_tools_integration.proto \
  -d "{\"project_root\":\"$PROJECT_ROOT\",\"hook_type\":\"health\"}" \
  "$HOST:$PORT" "$SERVICE"/GetProjectMetadata
