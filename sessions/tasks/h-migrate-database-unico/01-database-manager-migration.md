---
task: h-migrate-database-unico-01
subtask: 01-database-manager-migration
agent: synthetic_code
batch: A
status: pending
created: 2025-09-19
modules: [database-manager, packages/core/dist/services]
---

# Database Manager Migration

## Problem/Goal
Riconfigurare Database Manager Service (PID 325) da `./data/devflow.sqlite` a `./devflow.sqlite` unificato.

## Success Criteria
- [ ] DATABASE_PATH aggiornato in environment variables
- [ ] Service restart smooth senza downtime
- [ ] Tutte le API endpoints funzionanti su nuovo database
- [ ] Backup del vecchio database completato

## Implementation
**Synthetic Code Agent Task**:
- Modifica `packages/core/dist/services/database-manager.cjs`
- Update path resolution: `process.env.DATABASE_PATH || './devflow.sqlite'`
- Implementa graceful restart mechanism
- Crea migration validation script

## Agent Prompt
```
TASK_ID: DEVFLOW-DB-001
Generate code to migrate Database Manager from ./data/devflow.sqlite to ./devflow.sqlite:
1. Update database-manager.cjs with new default path
2. Create environment variable override system
3. Implement hot-reload configuration without service downtime
4. Add validation checks for database connection
```