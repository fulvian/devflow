#!/usr/bin/env bash
set -euo pipefail

PORT="${DEVFLOW_MEMORY_DAEMON_PORT:-3055}"

usage() {
  cat <<EOF
Usage: $0 {start|mem|end}
  start PLATFORM TITLE [DESCRIPTION]  -> returns taskId sessionId
  mem TASK_ID SESSION_ID TYPE LABEL CONTENT_JSON
  end SESSION_ID
EOF
}

post() {
  local path="$1"; shift
  curl -sS -H 'Content-Type: application/json' -X POST "http://localhost:$PORT$path" -d "$1"
}

case "${1:-}" in
  start)
    platform="${2:-claude_code}"; title="${3:-Development Session}"; desc="${4:-}"
    body=$(jq -nc --arg p "$platform" --arg t "$title" --arg d "$desc" '{platform:$p,title:$t,description:$d}')
    post "/session/start" "$body" ;;
  mem)
    taskId="${2:-}"; sessionId="${3:-}"; type="${4:-context}"; label="${5:-note}"; contentJson="${6:-"{}"}"
    [[ -z "$taskId" || -z "$sessionId" ]] && { echo "taskId and sessionId required"; exit 1; }
    body=$(jq -nc --arg tid "$taskId" --arg sid "$sessionId" --arg bt "$type" --arg lbl "$label" --argjson c "$contentJson" '{taskId:$tid,sessionId:$sid,blockType:$bt,label:$lbl,content:($c|tostring)}')
    post "/memory/store" "$body" ;;
  end)
    sid="${2:-}"; [[ -z "$sid" ]] && { echo "sessionId required"; exit 1; }
    body=$(jq -nc --arg sid "$sid" '{sessionId:$sid}')
    post "/session/end" "$body" ;;
  *) usage; exit 1 ;;
esac

