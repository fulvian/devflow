#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"

"$ROOT_DIR/scripts/start-devflow-memory.sh" start

echo "Starting OpenAI Codex session with DevFlow memory…"

RESP=$(curl -sS -H 'Content-Type: application/json' -X POST http://localhost:${DEVFLOW_MEMORY_DAEMON_PORT:-3055}/session/start \
  -d '{"platform":"openai_codex","title":"Codex Session","description":"Auto-start via wrapper"}')

echo "$RESP"
echo "Use the returned taskId/sessionId to store memory via /memory/store and end via /session/end."

# Here you can invoke your Codex CLI or workflow, e.g.:
# codex-cli "$@"

