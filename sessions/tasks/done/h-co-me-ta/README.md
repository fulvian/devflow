---
task: h-co-me-ta
branch: feature/co-me-ta
status: pending
created: 2025-09-12
modules: [core, memory, task-management, cognitive-engine]
---

# Cognitive Task+Memory Unified System (CO-ME-TA)

## Problem/Goal
Implementazione del sistema unificato DevFlow Cognitive Task+Memory che integra gestione gerarchica dei task e memoria persistente multi-modale, replicando i pattern cognitivi umani di navigazione codebase con Memory Bridge per Synthetic agents stateless.

## Success Criteria
- [ ] **Task Hierarchy Engine**: Sistema completo progetti→roadmaps→macro-tasks→micro-tasks funzionante con SQLite backend
- [ ] **Memory Bridge Protocol**: Context compression/injection/harvesting per Synthetic agents implementato e testato
- [ ] **Semantic Memory Engine**: ChromaDB/Qdrant integration con code embeddings e hybrid search operativo
- [ ] **Cognitive Mapping Engine**: Neo4j/TigerGraph con mental maps automatici e navigation patterns
- [ ] **Activity Registry System**: Git integration + reasoning chain preservation + pattern recognition
- [ ] **Cross-Session Persistence**: Memory recovery >99% accuracy tra sessioni diverse
- [ ] **Unified DevFlow Interface**: API unificata con cc-sessions compatibility layer
- [ ] **Performance Compliance**: API rate limiting 135/5h rispettato, query performance <100ms
- [ ] **Production Hardening**: Test coverage >95%, monitoring attivo, deployment documentation

## Context Files
- @docs/sviluppo/sviluppo_cognitive_task_memory_1.md  # Roadmap dettagliato implementazione
- @sessions/tasks/refoundation-plan.md               # Context refoundation DevFlow
- @packages/core/                                    # Core DevFlow modules
- @src/mcp-servers/enhanced-synthetic/               # Synthetic integration esistente
- @.claude/state/current_task.json                   # Task state management

## User Notes
Questo task rappresenta l'evoluzione architettuale più significativa di DevFlow. Implementazione basata su:
- **Approccio Hybrid**: Memory Bridge con context compression + selective injection
- **4-Layer Architecture**: SQLite + Vector DB + Graph DB + Activity Registry  
- **32 Micro-Tasks**: Distribuiti su 4 phases in 9 settimane
- **Synthetic Agent Coordination**: Code/Reasoning/Auto agents per specializzazione

Il sistema sostituirà gradualmente cc-sessions mantenendo backward compatibility durante la migrazione.

## Work Log
- [2025-09-12] Task creato, roadmap dettagliato completato in sviluppo_cognitive_task_memory_1.md