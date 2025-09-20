---
task: h-migrate-database-unico-02
subtask: 02-vector-service-migration
agent: synthetic_code
batch: A
status: pending
created: 2025-09-19
modules: [vector-memory-service, packages/core/dist/services]
---

# Vector Memory Service Migration

## Problem/Goal
Migrare Vector Memory Service (PID 514) da database separato `./data/vector.sqlite` al database unificato `./devflow.sqlite`.

## Success Criteria
- [ ] Dati vector esistenti migrati senza perdite
- [ ] Service utilizza tabelle unified: memory_block_embeddings, knowledge_entity_embeddings
- [ ] Performance mantenute o migliorate
- [ ] Eliminazione `./data/vector.sqlite`

## Agent Prompt
```
TASK_ID: DEVFLOW-DB-002
Migrate Vector Memory Service to unified database:
1. Update vector-memory-service.cjs database path
2. Create data migration script from vector.sqlite to devflow.sqlite
3. Map existing tables to unified schema (memory_block_embeddings, etc.)
4. Implement rollback mechanism
```