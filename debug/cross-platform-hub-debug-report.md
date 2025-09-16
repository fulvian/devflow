# DevFlow Cross-Platform Hub — Debug Report

Generated: 2025-09-15

## Summary
- No “last cross-platform hub task” is recorded in Cometa: there are no coordination/handoff sessions stored.
- Two SQLite databases are present with divergent schemas; the running configuration points to the older schema, so the hub orchestration layer is not persisting to the expected tables.

## Environment Snapshot (relevant)
- `DEVFLOW_DB_PATH`: `./data/devflow.sqlite`
- Core DB resolver: `packages/core/src/database/connection.ts` uses `loadCoreEnv()` and falls back to `./devflow.sqlite` if env not set.

## Database Files Observed
1) `./data/devflow.sqlite`
- Tables: `task_contexts`, `sessions`, `memory_blocks`, `memory_block_embeddings`, `synthetic_usage`, `migration_log` (no `coordination_sessions`).
- `task_contexts` here does NOT include `primary_platform` column.

2) `./devflow.sqlite`
- Tables include advanced schema: `coordination_sessions`, `task_contexts` (with routing/context columns), FTS views, and helper views like `active_tasks_with_sessions`.
- Counts observed: `task_contexts = 3`, `coordination_sessions = 0`.

## Data Snapshot (key checks run)
- `SELECT COUNT(*) FROM task_contexts;` → 3 (on both DBs, placeholder/demo rows).
- `SELECT COUNT(*) FROM coordination_sessions;` →
  - `./devflow.sqlite`: 0 (table exists, empty)
  - `./data/devflow.sqlite`: error (table does not exist)

## Root Cause Assessment
- Configuration mismatch: `.env` sets `DEVFLOW_DB_PATH=./data/devflow.sqlite` (old schema). The newer hub schema (with `coordination_sessions`) exists under `./devflow.sqlite`.
- Migrations not applied (or not applied to the DB in use). Despite `ensureMigrations(getDB())` being present in core, the selected DB by env lacks the new tables/columns.

## Impact
- Hub cross-platform orchestration cannot persist sessions/handoffs → no telemetry to answer “last cross-platform hub task”.
- Reports/dashboards depending on `coordination_sessions` will appear empty or fail on the `./data/devflow.sqlite` DB.

## Recommended Next Steps
1) Pick a single DB path for development (recommended: `./devflow.sqlite`) and set `DEVFLOW_DB_PATH` accordingly. Remove conflicting JSON/config blocks embedded in `.env` that point elsewhere (e.g., `./packages/core/devflow.sqlite`).
2) Re-run startup so `ensureMigrations(getDB())` creates/verifies `coordination_sessions` on the chosen DB.
3) Run a simple cross-platform handoff to generate at least one row in `coordination_sessions`.
4) Use the queries below to verify the “last cross-platform task”.

## Verification Queries (copy/paste)
### Schema presence
```
PRAGMA table_info(coordination_sessions);
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
```

### Basic counts
```
SELECT (SELECT COUNT(*) FROM task_contexts) AS tasks,
       (SELECT COUNT(*) FROM coordination_sessions) AS sessions,
       (SELECT COUNT(*) FROM memory_blocks) AS memory_blocks;
```

### Latest sessions
```
SELECT id, task_id, platform, session_type, start_time, end_time,
       handoff_from_session, handoff_to_session, handoff_success
FROM coordination_sessions
ORDER BY datetime(start_time) DESC
LIMIT 15;
```

### Identify last cross-platform task (distinct platforms ≥ 2)
```
WITH s AS (
  SELECT task_id,
         COUNT(DISTINCT platform) AS platforms,
         SUM(CASE WHEN handoff_success THEN 1 ELSE 0 END) AS ok,
         MAX(start_time) AS last_session
  FROM coordination_sessions
  GROUP BY task_id
)
SELECT t.id, t.title, t.status, s.platforms, s.ok, s.last_session
FROM task_contexts t
JOIN s ON s.task_id = t.id
WHERE s.platforms >= 2
ORDER BY datetime(s.last_session) DESC
LIMIT 1;
```

## Notes for Claude Review
- Focus on aligning `DEVFLOW_DB_PATH` and confirming migrations. Once `coordination_sessions` is populated, the “last cross-platform task” query will return a concrete result.

