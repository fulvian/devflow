#!/usr/bin/env bash
set -euo pipefail

# Unified, context7-compliant start wrapper for running DevFlow inside Codex.
# - Initializes Context7 config
# - Starts the Persistent Memory+Task daemon
# - Optionally starts full DevFlow services via devflow-start.sh (with --full)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
PID_FILE="$ROOT_DIR/.codex-integration.pid"

log() { printf "[codex-start] %s\n" "$*"; }

ensure_logs() { mkdir -p "$ROOT_DIR/logs"; }

init_context7() {
  ensure_logs
  local cfg="$ROOT_DIR/.config/context7.json"
  if [ ! -f "$cfg" ]; then
    mkdir -p "$ROOT_DIR/.config"
    cat > "$cfg" << EOF
{
  "enabled": true,
  "mcp_endpoint": "npx -y @upstash/context7-mcp@latest",
  "session_id": "codex-$(date +%s)",
  "auto_inject": true,
  "cache_duration": 3600
}
EOF
    log "Context7 config created at .config/context7.json"
  else
    log "Context7 config already present"
  fi
  export CONTEXT7_ENABLED=true
  export CONTEXT7_SESSION_ID=$(grep -o '"session_id"\s*:\s*"[^"]*"' "$cfg" | cut -d'"' -f4 || echo "codex-${RANDOM}")
  log "Context7 enabled (Session: $CONTEXT7_SESSION_ID)"
}

start_memory_daemon() {
  ensure_logs
  "$ROOT_DIR/scripts/start-devflow-memory.sh" start
}

stop_memory_daemon() {
  if [ -f "$ROOT_DIR/.memory-task-daemon.pid" ]; then
    "$ROOT_DIR/scripts/start-devflow-memory.sh" stop || true
  fi
}

start_full_services_if_requested() {
  if [ "${START_FULL:-false}" = "true" ]; then
    log "Starting full DevFlow services via devflow-start.sh"
    bash "$ROOT_DIR/devflow-start.sh" start || true
  fi
}

status() {
  log "Memory+Task Daemon:"
  "$ROOT_DIR/scripts/start-devflow-memory.sh" status || true
  log "Health:"
  if command -v curl >/dev/null 2>&1; then
    curl -sS "http://localhost:${DEVFLOW_MEMORY_DAEMON_PORT:-3055}/health" || true
    echo
  fi
  if [ -f "$ROOT_DIR/devflow-start.sh" ]; then
    log "Core services (devflow-start.sh status):"
    bash "$ROOT_DIR/devflow-start.sh" status || true
  fi
}

bootstrap_codex_session() {
  # Creates a Codex session in the persistent store and prints IDs.
  if ! command -v curl >/dev/null 2>&1; then
    log "curl not available; cannot bootstrap session"
    exit 1
  fi
  local resp
  resp=$(curl -sS -H 'Content-Type: application/json' -X POST \
    "http://localhost:${DEVFLOW_MEMORY_DAEMON_PORT:-3055}/session/start" \
    -d '{"platform":"openai_codex","title":"Codex Session","description":"Started via codex unified start"}') || true
  echo "$resp"
}

start() {
  init_context7
  start_memory_daemon
  start_full_services_if_requested
  echo $$ > "$PID_FILE"
  log "Codex unified start complete. Use 'status' to verify."
}

stop() {
  stop_memory_daemon
  if [ -f "$PID_FILE" ]; then rm -f "$PID_FILE"; fi
  log "Stopped Codex integration components."
}

usage() {
  cat << USAGE
Usage: $0 [start|stop|status|restart|bootstrap-session] [--full]
  start             Start Context7 + Memory daemon (and full DevFlow with --full)
  stop              Stop Memory daemon
  status            Show status of Memory daemon and core services
  restart           Stop then start
  bootstrap-session Create a Codex session (returns JSON with taskId, sessionId)
Options:
  --full            Also start devflow-start.sh services
USAGE
}

cmd="${1:-start}"; shift || true
START_FULL=false
for arg in "$@"; do
  if [ "$arg" = "--full" ]; then START_FULL=true; fi
done

case "$cmd" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  restart) stop || true; start ;;
  bootstrap-session) bootstrap_codex_session ;;
  *) usage; exit 1 ;;
esac

