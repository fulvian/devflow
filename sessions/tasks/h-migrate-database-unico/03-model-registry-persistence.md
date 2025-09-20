---
task: h-migrate-database-unico-03
subtask: 03-model-registry-persistence
agent: synthetic_code
batch: A
status: pending
created: 2025-09-19
modules: [model-registry-service, platform-performance]
---

# Model Registry Persistence

## Problem/Goal
Aggiungere persistenza al Model Registry Service (PID 422) attualmente solo in-memory, utilizzando tabella `platform_performance`.

## Success Criteria
- [ ] Health metrics salvati in platform_performance table
- [ ] Failover history tracking persistente
- [ ] Performance analytics cross-restart
- [ ] API per query performance storica

## Agent Prompt
```
TASK_ID: DEVFLOW-DB-003
Add persistence to Model Registry Service:
1. Connect model-registry-service.cjs to devflow.sqlite
2. Implement platform_performance table integration
3. Add health metrics persistence (Ollama/Synthetic status)
4. Create performance analytics API endpoints
```