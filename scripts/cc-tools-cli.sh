#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERR ]${NC} $*"; }

usage() {
  cat <<USAGE
CC-Tools gRPC CLI (grpcurl-based)

Usage:
  $(basename "$0") list [--host HOST] [--port PORT]
  $(basename "$0") metadata --project-root PATH [--hook-type TYPE] [--host HOST] [--port PORT]
  $(basename "$0") validate --project-root PATH [--hook-type TYPE] [--timeout-ms MS] [--host HOST] [--port PORT] [--raw]

Options:
  --host HOST        Hostname (default: localhost)
  --port PORT        Port (default: from GRPC_PORT or 50051)
  --project-root     Project root path
  --hook-type TYPE   Hook type (default: pre-commit)
  --timeout-ms MS    Timeout for ValidateProject (default: 15000)
  --raw              Print raw grpcurl output only
  --auto-start       If port not listening, start via ./devflow-start.sh
  -h, --help         Show help
USAGE
}

require_grpcurl() {
  if ! command -v grpcurl >/dev/null 2>&1; then
    error "grpcurl non trovato. Installa con: brew install grpcurl"
    exit 1
  fi
}

port_listening() {
  local host="$1"; local port="$2"
  nc -z "$host" "$port" >/dev/null 2>&1
}

ensure_running_or_start() {
  local host="$1"; local port="$2"; local auto_start="$3"
  if port_listening "$host" "$port"; then
    return 0
  fi
  if [[ "$auto_start" == "true" ]]; then
    warn "Porta $port non in ascolto. Avvio DevFlow..."
    (cd "$PROJECT_ROOT" && CC_TOOLS_USE_DEBUG="${CC_TOOLS_USE_DEBUG:-true}" ./devflow-start.sh) || {
      error "Avvio DevFlow fallito"
      exit 1
    }
    sleep 2
    if ! port_listening "$host" "$port"; then
      error "Porta $port ancora non in ascolto dopo l'avvio"
      exit 1
    fi
  else
    error "Porta $port non in ascolto. Avvia il sistema o usa --auto-start"
    exit 1
  fi
}

cmd="$1" || { usage; exit 1; }
shift || true

HOST="localhost"
PORT="${GRPC_PORT:-50051}"
PROJECT_ROOT_ARG=""
HOOK_TYPE="pre-commit"
TIMEOUT_MS="15000"
RAW="false"
AUTO_START="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) HOST="$2"; shift 2;;
    --port) PORT="$2"; shift 2;;
    --project-root) PROJECT_ROOT_ARG="$2"; shift 2;;
    --hook-type) HOOK_TYPE="$2"; shift 2;;
    --timeout-ms) TIMEOUT_MS="$2"; shift 2;;
    --raw) RAW="true"; shift 1;;
    --auto-start) AUTO_START="true"; shift 1;;
    -h|--help) usage; exit 0;;
    *) error "Argomento sconosciuto: $1"; usage; exit 1;;
  esac
done

require_grpcurl
ensure_running_or_start "$HOST" "$PORT" "$AUTO_START"

SERVICE_FQN="cc_tools_integration.CCToolsIntegration"

case "$cmd" in
  list)
    $RAW || info "Listing servizi via reflection @ $HOST:$PORT"
    grpcurl -plaintext "$HOST:$PORT" list
    ;;
  metadata)
    [[ -n "$PROJECT_ROOT_ARG" ]] || { error "--project-root richiesto"; exit 1; }
    $RAW || info "GetProjectMetadata: project_root=$PROJECT_ROOT_ARG hook_type=$HOOK_TYPE"
    grpcurl -plaintext \
      -import-path "$PROJECT_ROOT/go-server/proto" \
      -proto cc_tools_integration.proto \
      -d "{\"project_root\":\"$PROJECT_ROOT_ARG\",\"hook_type\":\"$HOOK_TYPE\"}" \
      "$HOST:$PORT" "$SERVICE_FQN"/GetProjectMetadata
    ;;
  validate)
    [[ -n "$PROJECT_ROOT_ARG" ]] || { error "--project-root richiesto"; exit 1; }
    $RAW || info "ValidateProject: project_root=$PROJECT_ROOT_ARG hook_type=$HOOK_TYPE timeout_ms=$TIMEOUT_MS"
    grpcurl -plaintext \
      -import-path "$PROJECT_ROOT/go-server/proto" \
      -proto cc_tools_integration.proto \
      -d "{\"project_root\":\"$PROJECT_ROOT_ARG\",\"hook_type\":\"$HOOK_TYPE\",\"timeout_ms\":$TIMEOUT_MS}" \
      "$HOST:$PORT" "$SERVICE_FQN"/ValidateProject
    ;;
  *)
    error "Comando sconosciuto: $cmd"; usage; exit 1;;
esac
