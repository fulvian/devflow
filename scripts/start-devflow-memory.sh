#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
PID_FILE="${DEVFLOW_MEMORY_DAEMON_PID:-$ROOT_DIR/.memory-task-daemon.pid}"
PORT="${DEVFLOW_MEMORY_DAEMON_PORT:-3055}"
DB_PATH="${DEVFLOW_DB_PATH:-$ROOT_DIR/devflow.sqlite}"

usage() {
  echo "Usage: $0 {start|stop|status|restart|health}"
}

is_running() {
  [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

start() {
  if is_running; then
    echo "[devflow-memory] already running (PID $(cat "$PID_FILE"))"
    exit 0
  fi
  echo "[devflow-memory] starting on port $PORT with DB $DB_PATH"
  nohup npx ts-node "$ROOT_DIR/src/daemon/persistent-memory-task-daemon.ts" \
    > "$ROOT_DIR/logs/devflow-memory-daemon.log" 2>&1 &
  echo $! > "$PID_FILE"
  sleep 1
  echo "[devflow-memory] started (PID $(cat "$PID_FILE"))"
}

stop() {
  if ! is_running; then
    echo "[devflow-memory] not running"
    exit 0
  fi
  pid=$(cat "$PID_FILE")
  echo "[devflow-memory] stopping (PID $pid)"
  kill -TERM "$pid" 2>/dev/null || true
  rm -f "$PID_FILE"
}

status() {
  if is_running; then
    echo "[devflow-memory] running (PID $(cat "$PID_FILE")) on port $PORT"
  else
    echo "[devflow-memory] stopped"
  fi
}

health() {
  if command -v curl >/dev/null 2>&1; then
    curl -sS "http://localhost:$PORT/health" || true
  else
    echo "curl not available"
  fi
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  restart) stop || true; start ;;
  health) health ;;
  *) usage; exit 1 ;;
esac

