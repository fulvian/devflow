# DevFlow Environment Configuration

- DEVFLOW_DB_PATH: Absolute path to the shared SQLite database file used by all DevFlow services (orchestrator, agents). If not set, the orchestrator resolves the first existing path in this order:
  1) `<repo>/data/devflow.sqlite`
  2) `<repo>/devflow.sqlite`
  If none exist, it will create `<repo>/data/devflow.sqlite`.

Recommendation: Keep the canonical database at `<repo>/data/devflow.sqlite` so Claude Code, Gemini, and other agent integrations share the same persistent memory store.

