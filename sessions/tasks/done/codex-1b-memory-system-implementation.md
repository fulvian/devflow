# CODEX TASK 1B: Memory System Core Implementation

## Context & Objective
Implementare il sistema core di memoria persistente con SQLite seguendo lo schema e l'architettura progettati da Claude Code nella fase architetturale di Sprint 1. Questo sistema sarà il foundation del DevFlow memory management e dovrà supportare il 4-layer memory hierarchy definito.

## Technical Requirements

### Database Layer
- **better-sqlite3** per database operations con performance ottimali
- **Schema management** con migration system automatico
- **Type-safe query builders** per tutte le operazioni CRUD
- **Connection pooling** e gestione efficiente delle connessioni
- **Transaction support** per operazioni atomiche
- **Full-text search** con SQLite FTS5 per ricerca semantica
- **JSON support** con SQLite JSON1 extension per structured data

### Memory System Architecture
- **4-Layer Memory Hierarchy**:
  1. Context Window (immediato)
  2. Session Memory (SQLite sessions table)
  3. Working Memory (SQLite memory_blocks table) 
  4. Long-term Memory (SQLite task_contexts table)
- **Context serialization/deserialization** con TypeScript type safety
- **Importance scoring** algorithm (0.0-1.0 scale)
- **Context compaction** con multiple strategies
- **Memory search** con full-text e semantic capabilities

### Performance Requirements
- **Query Performance**: <50ms per simple queries, <200ms per complex
- **Memory Efficiency**: Lazy loading e connection cleanup automatico
- **Scalability**: Support per progetti con 1000+ memory blocks
- **Error Resilience**: Retry logic e graceful degradation

## Implementation Guidelines

### Code Quality Standards
- **TypeScript strict mode** compliance al 100%
- **Error handling robusto** con structured logging
- **Prepared statements** per tutte le query SQL per security e performance
- **Connection lifecycle** management con proper cleanup
- **Unit tests** per ogni component (target 90% coverage)
- **Integration tests** per workflow completi

### Database Implementation Patterns
- **Migration system**: Versioned schema updates con rollback support
- **Query builders**: Type-safe wrappers attorno a raw SQL
- **Connection pooling**: Efficient reuse delle database connections
- **Transaction management**: ACID compliance per operazioni multiple
- **Index optimization**: Strategic indexes per performance queries

### Architecture Integration
- **Interface compliance**: Implementare le interfaces definite in @devflow/shared
- **Dependency injection**: Loose coupling con adapter pattern
- **Configuration system**: Environment-based config per different environments
- **Logging integration**: Structured logging per debugging e monitoring

## Expected Deliverables

### Core Implementation Files
```
packages/core/src/
├── database/
│   ├── connection.ts          # Database connection management
│   ├── migrations.ts          # Schema migration system
│   ├── queries.ts             # Type-safe query builders
│   └── transaction.ts         # Transaction management utilities
├── memory/
│   ├── manager.ts             # Main MemoryManager implementation
│   ├── blocks.ts              # Memory block operations
│   ├── sessions.ts            # Session management
│   ├── contexts.ts            # Task context operations
│   ├── search.ts              # Full-text and semantic search
│   └── compaction.ts          # Context compaction algorithms
└── index.ts                   # Main package exports
```

### Database Schema Implementation
- **Migration 001**: Core tables (sessions, memory_blocks, task_contexts)
- **Migration 002**: FTS5 virtual table setup
- **Migration 003**: Indexes e performance optimizations
- **Schema validation**: Runtime validation con Zod schemas

### Testing Suite
- **Unit tests**: Ogni component con mock databases
- **Integration tests**: End-to-end workflow testing
- **Performance tests**: Query performance benchmarking
- **Memory leak tests**: Connection cleanup validation

### Documentation
- **API Reference**: JSDoc completo per tutte le public interfaces
- **Usage Examples**: Code examples per common use cases
- **Performance Guide**: Best practices per optimal performance
- **Troubleshooting**: Common issues e solutions

## Success Criteria

### Functional Requirements
- [ ] **Database Connection**: Successful SQLite connection con better-sqlite3
- [ ] **Schema Management**: Migration system funzionante con rollback
- [ ] **CRUD Operations**: Complete create, read, update, delete per tutte le tables
- [ ] **Memory Hierarchy**: Tutti i 4 layers implementati e funzionanti
- [ ] **Search System**: Full-text search con FTS5 operational
- [ ] **Context Compaction**: Almeno 2 compaction strategies implementate
- [ ] **Type Safety**: Tutti i types da @devflow/shared utilizzati correttamente

### Technical Validation
- [ ] **Build Success**: `pnpm build` completes without errors
- [ ] **Type Check**: `pnpm type-check` passes completely
- [ ] **Lint Check**: `pnpm lint` passes with zero errors
- [ ] **Unit Tests**: >90% test coverage achieved
- [ ] **Integration Tests**: Core workflows tested end-to-end
- [ ] **Performance Benchmarks**: Query performance targets met

### Integration Readiness
- [ ] **Interface Compliance**: Implements all MemoryManager interfaces
- [ ] **Adapter Compatibility**: Ready for Claude Code adapter integration
- [ ] **Error Handling**: Comprehensive error scenarios covered
- [ ] **Documentation Complete**: API reference e usage guide ready

## Technical Context

### Schema Reference
Il database schema completo è disponibile in:
- `packages/core/src/database/schema.sql` - Complete schema definition
- `packages/shared/src/types/memory.ts` - TypeScript interfaces

### Dependencies
- `better-sqlite3` - SQLite database operations
- `@devflow/shared` - Shared TypeScript interfaces
- `zod` - Runtime schema validation (già disponibile)

### Performance Benchmarks
Target performance basato su use cases reali:
- Session lookup: <10ms
- Memory block search: <50ms  
- Context compaction: <200ms
- Full database queries: <500ms

## Report Template

Al completamento, fornire report strutturato con:

### Implementation Summary
- Components implementati con brief description
- Key technical decisions e rationale
- Challenges encountered e solutions applied
- Performance optimizations implemented

### Code Architecture
- Key interfaces e loro implementations
- Database schema validation results
- Query performance benchmarks
- Memory management patterns used

### Testing Results
- Unit test coverage percentages
- Integration test scenarios validated
- Performance benchmark results
- Error handling test results

### Next Steps Recommendations
- Integration points per CODEX-2A (Claude Code Adapter)
- Performance optimization opportunities identified
- Additional features che potrebbero essere beneficial
- Technical debt o areas for future improvement

### Memory Context for Persistence
JSON object con implementation context per cc-sessions memory:
```json
{
  "task": "CODEX-1B",
  "component": "memory-system-core",
  "key_decisions": ["database choice", "query patterns", "performance optimizations"],
  "integration_points": ["claude-adapter", "openrouter-gateway"],
  "performance_metrics": {"queries": "times", "memory": "usage"},
  "next_tasks": ["CODEX-2A preparation"]
}
```

---

**Target Completion**: 2-3 giorni di focused implementation
**Handoff Ready**: Complete foundation per Sprint 2 Claude Code Integration