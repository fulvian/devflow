# DevFlow Persistent Memory+Task Daemon

Purpose: Provide a zero-touch, persistent memory and task manager for Claude Code and Codex sessions without modifying existing code. It writes to `devflow.sqlite` using the existing schema (`task_contexts`, `coordination_sessions`, `memory_blocks`).

## Endpoints (localhost:3055)

- POST `/session/start`
  - Body: `{ platform, title?, description?, priority?, status?, taskId? }`
  - Creates a task (if not provided) and a coordination session. Returns `{ taskId, sessionId }`.

- POST `/memory/store`
  - Body: `{ taskId, sessionId, blockType, label, content, metadata? }`
  - Persists a memory block linked to the session.

- POST `/session/end`
  - Body: `{ sessionId }`
  - Marks session `end_time`.

- GET `/health`
  - Returns basic service status.

## Start/Stop

```bash
scripts/start-devflow-memory.sh start   # start background daemon
scripts/start-devflow-memory.sh status  # check status
scripts/start-devflow-memory.sh health  # HTTP health
scripts/start-devflow-memory.sh stop    # stop daemon
```

Environment vars:

- `DEVFLOW_DB_PATH` (default: `devflow.sqlite`)
- `DEVFLOW_MEMORY_DAEMON_PORT` (default: `3055`)
- `DEVFLOW_MEMORY_DAEMON_PID` (default: `.memory-task-daemon.pid`)

## Example Usage

```bash
curl -sS -X POST http://localhost:3055/session/start \
  -H 'Content-Type: application/json' \
  -d '{"platform":"claude_code","title":"Dev session"}'

curl -sS -X POST http://localhost:3055/memory/store \
  -H 'Content-Type: application/json' \
  -d '{
        "taskId":"<TASK>",
        "sessionId":"<SESSION>",
        "blockType":"decision",
        "label":"Startup policy",
        "content":"Enable cross-session memory for Claude & Codex",
        "metadata":{"source":"daemon"}
      }'

curl -sS -X POST http://localhost:3055/session/end \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"<SESSION>"}'
```

## Auto-Start for Claude & Codex (No Code Changes)

Wrap your usual startup with the daemon:

```bash
# 1) Start memory daemon
scripts/start-devflow-memory.sh start

# 2) Start your standard DevFlow or Codex/Claude flows as usual
./devflow-start.sh start   # or your habitual command
```

Optionally, call `/session/start` at the beginning of each tool session (from shell hooks or task runners) to ensure sessions are recorded without editing application code. Codex sessions can do the same (pre/post command hooks) to persist memory automatically.

