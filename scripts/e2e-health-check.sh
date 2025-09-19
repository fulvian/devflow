#!/usr/bin/env bash
set -euo pipefail

# Load .env if present
ENV_FILE=".env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC2046
  export $(grep -E '^(DEVFLOW_DB_PATH|DB_MANAGER_PORT|VECTOR_MEMORY_PORT|MODEL_REGISTRY_PORT|TOKEN_OPTIMIZER_PORT|ORCHESTRATOR_PORT)=' "$ENV_FILE" | xargs -0 -I {} bash -lc 'echo {}' 2>/dev/null || true)
fi

DB_PATH=${DEVFLOW_DB_PATH:-"./data/devflow.sqlite"}
DB_MANAGER_PORT=${DB_MANAGER_PORT:-3002}
VECTOR_MEMORY_PORT=${VECTOR_MEMORY_PORT:-3003}
MODEL_REGISTRY_PORT=${MODEL_REGISTRY_PORT:-3004}
TOKEN_OPTIMIZER_PORT=${TOKEN_OPTIMIZER_PORT:-3006}
ORCHESTRATOR_PORT=${ORCHESTRATOR_PORT:-3007}

echo "[CHECK] Using DB: $DB_PATH"
echo "[CHECK] Ports => DB:$DB_MANAGER_PORT, Vector:$VECTOR_MEMORY_PORT, Registry:$MODEL_REGISTRY_PORT, Optimizer:$TOKEN_OPTIMIZER_PORT, Orchestrator:$ORCHESTRATOR_PORT"

FAILED=0

function check_curl() {
  local name=$1 port=$2 path=${3:-/health}
  echo "[CHECK] $name on :$port$path"
  if ! curl -sf --max-time 3 "http://localhost:${port}${path}" >/dev/null 2>&1; then
    echo "[FAIL] $name health check failed"
    FAILED=1
  else
    echo "[OK] $name healthy"
  fi
}

# Health checks (best-effort; some services may not expose /health)
check_curl "Orchestrator" "$ORCHESTRATOR_PORT" "/health" || true
check_curl "Database Manager" "$DB_MANAGER_PORT" "/health" || true
check_curl "Vector Memory" "$VECTOR_MEMORY_PORT" "/health" || true
check_curl "Token Optimizer" "$TOKEN_OPTIMIZER_PORT" "/health" || true

# Model Registry may not expose /health; try root /
if ! curl -sf --max-time 3 "http://localhost:${MODEL_REGISTRY_PORT}/" >/dev/null 2>&1; then
  echo "[WARN] Model Registry not responding on :$MODEL_REGISTRY_PORT (no /health)."
else
  echo "[OK] Model Registry responding on :$MODEL_REGISTRY_PORT"
fi

# Port listeners
if command -v lsof >/dev/null 2>&1; then
  echo "[CHECK] Listening sockets"
  lsof -nP -iTCP -sTCP:LISTEN | grep -E ":(${DB_MANAGER_PORT}|${VECTOR_MEMORY_PORT}|${MODEL_REGISTRY_PORT}|${TOKEN_OPTIMIZER_PORT}|${ORCHESTRATOR_PORT})\b" || echo "[WARN] lsof found no matching listeners"
else
  echo "[WARN] lsof not available; skipping listener check"
fi

# Logs quick scan
echo "[CHECK] Logs quick scan (last 50 lines)"
for f in logs/database-manager.log logs/model-registry.log logs/vector-memory.log logs/token-optimizer.log logs/orchestrator.log; do
  [[ -f "$f" ]] || continue
  echo "== $f =="
  tail -n 50 "$f" | sed 's/^/  /'
  if tail -n 200 "$f" | grep -Eiq "(error|unhandled|exception|eaddrinuse|eperm|refused|failed)"; then
    echo "[WARN] Potential errors found in $f"
  fi
done

# DB checks
if command -v sqlite3 >/dev/null 2>&1; then
  if [[ -f "$DB_PATH" ]]; then
    echo "[CHECK] DB views and tables"
    sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='view' AND name IN ('tasks','v_memory_with_embeddings','v_active_tasks_with_sessions','memory_block_embeddings_adv') ORDER BY name;"
    sqlite3 "$DB_PATH" "SELECT count(*) AS cnt FROM task_contexts;"
    sqlite3 "$DB_PATH" "SELECT count(*) AS cnt FROM memory_blocks;"
    sqlite3 "$DB_PATH" "SELECT id, title, status, priority FROM tasks ORDER BY updated_at DESC LIMIT 3;" || true
  else
    echo "[FAIL] DB file not found at $DB_PATH"; FAILED=1
  fi
else
  echo "[WARN] sqlite3 not available; skipping DB checks"
fi

if [[ $FAILED -ne 0 ]]; then
  echo "[RESULT] Health checks reported issues (see logs above)."
  exit 1
fi

echo "[RESULT] All checks completed without critical errors."

