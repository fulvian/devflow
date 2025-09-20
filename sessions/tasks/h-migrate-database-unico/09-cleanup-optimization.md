---
task: h-migrate-database-unico-09
subtask: 09-cleanup-optimization
agent: synthetic_context
batch: C
status: pending
created: 2025-09-19
modules: [cleanup, optimization, documentation]
---

# Cleanup & Optimization

## Problem/Goal
Pulizia finale del sistema dopo migrazione: eliminazione database obsoleti, ottimizzazione performance e documentazione completa.

## Success Criteria
- [ ] Directory `./data/` completamente rimossa
- [ ] Database performance ottimizzato (WAL mode, indexing)
- [ ] Documentation aggiornata per nuovo architecture
- [ ] Monitoring dashboard per new unified system

## Agent Prompt
```
TASK_ID: DEVFLOW-DB-009
Plan final cleanup and optimization phase:
1. Analyze remaining legacy components for safe removal
2. Design database optimization strategies (indexes, WAL, vacuum)
3. Create documentation update requirements
4. Plan monitoring dashboard for unified system health
```