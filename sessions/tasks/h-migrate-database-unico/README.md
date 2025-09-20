---
task: h-migrate-database-unico
branch: feature/migrate-database-unico
status: pending
created: 2025-09-19
modules: [database-manager, vector-memory-service, model-registry-service, semantic-memory-service, core-database]
---

# Database Unificato - Single Source of Truth

## Problem/Goal
Unificare tutti i servizi DevFlow nel database avanzato `devflow.sqlite` eliminando frammentazione:
- **Database Manager**: usa `./data/devflow.sqlite` (OBSOLETO)
- **Vector Memory**: usa `./data/vector.sqlite` (SEPARATO)
- **Model Registry**: nessuna persistenza (CRITICO)
- **Servizi Vari**: mix di configurazioni (INCONSISTENTE)

Implementare Single Source of Truth con zero downtime e funzionalità ampliate.

## Success Criteria
- [ ] Tutti i servizi DevFlow connessi a `./devflow.sqlite` unificato
- [ ] Zero perdita di dati durante migrazione
- [ ] Zero downtime dei servizi
- [ ] Database `./data/` directory completamente eliminata
- [ ] Cost Analytics e Synthetic Usage tracking attivi
- [ ] Knowledge Entities learning system operativo
- [ ] Platform Performance routing intelligence attivo
- [ ] Test di integrazione completi superati
- [ ] Backup e rollback procedure verificate

## Architecture Strategy
**MACRO PHASES**:
1. **Phase 1**: Database Service Unification (Critical Path)
2. **Phase 2**: Advanced Features Activation
3. **Phase 3**: Intelligence & Analytics Layer
4. **Phase 4**: Cleanup & Optimization

**BATCHING STRATEGY**:
- **Batch A** (Synthetic Code): Database migration scripts + service reconfiguration
- **Batch B** (Synthetic Reasoning): Architecture decisions + rollback strategies
- **Batch C** (Synthetic Context): Testing & validation comprehensive coverage

## Micro Tasks Overview
- `01-database-manager-migration.md` - Riconfigurare DB Manager al DB unificato
- `02-vector-service-migration.md` - Migrare Vector Memory Service
- `03-model-registry-persistence.md` - Aggiungere persistenza a Model Registry
- `04-services-configuration.md` - Unificare configurazioni tutti i servizi
- `05-cost-analytics-tracker.md` - Implementare Synthetic/Cost tracking
- `06-knowledge-learning-system.md` - Attivare Knowledge Entities system
- `07-platform-intelligence.md` - Performance-based routing intelligence
- `08-testing-validation.md` - Test di integrazione completi
- `09-cleanup-optimization.md` - Pulizia finale e ottimizzazioni

## User Notes
- **Zero Downtime**: Tutti i servizi devono rimanere operativi durante migrazione
- **Data Safety**: Triple backup strategy (pre, durante, post migrazione)
- **Rollback Ready**: Ogni phase deve avere rollback immediato
- **Performance**: Sistema deve essere più veloce dopo l'unificazione

## Context Manifest

### How Database Fragmentation Currently Works: DevFlow Multi-Database Architecture

DevFlow currently operates with a severely fragmented database architecture that creates consistency, performance, and operational challenges. The system currently spans multiple SQLite databases, each serving different services with overlapping schemas and conflicting data paths.

**Primary Database: `/devflow.sqlite` (Root Level - 491KB)**
This is the main "unified" database that exists at the project root and contains the most comprehensive schema. It serves as the target for migration and contains:

- **Core Tables**: `task_contexts`, `memory_blocks`, `coordination_sessions`, `memory_block_embeddings`, `knowledge_entity_embeddings`
- **Advanced Features**: `cost_analytics`, `synthetic_usage`, `knowledge_entities`, `entity_relationships`, `platform_performance`
- **Full-Text Search**: Virtual FTS5 tables for `memory_fts`, `tasks_fts`, `knowledge_entities_fts`
- **Views and Analytics**: `active_tasks_with_sessions`, `platform_efficiency_summary`, comprehensive performance tracking
- **Rich Schema**: Complete with triggers, indexes, foreign key constraints, and lifecycle management

**Fragmented Database: `/data/vector.sqlite` (45KB)**
Currently used by the Vector Memory Service with a minimal schema containing only:
- **Single Table**: `vector_memories` with columns for id, content, type, metadata, embedding_vector, dimensions, model_id, created_at
- **Basic Indexes**: Only 3 indexes on type, model, and created_at
- **Service Process**: Runs on port 8084 via `packages/core/dist/services/vector-memory-service.cjs`
- **Data Content**: Contains 5 vector memories with EmbeddingGemma model (768 dimensions)

**Legacy Database Directory: `/data/devflow.sqlite` (Referenced but Obsolete)**
The `.env.prod.example` still references `DEVFLOW_DB_PATH=./data/devflow.sqlite`, indicating this was the original intended location. However, this path creates confusion because:
- Configuration points to `./data/` but actual advanced database is at root level
- Services have hardcoded assumptions about different database locations
- Docker configurations expect `/data/` path structure

**Service Database Fragmentation Pattern:**

When the Database Manager service starts (port 8082), it creates its own database at `./data/devflow.sqlite` with a basic schema containing only:
- Simple tables: `task_contexts`, `memory_blocks`, `memory_block_embeddings`
- No advanced features like cost analytics, knowledge entities, or platform performance
- Separate from the rich schema at root level `/devflow.sqlite`

Similarly, the Vector Memory Service (port 8084) creates `./data/vector.sqlite` with its own isolated schema, creating a complete disconnection from the main database's memory and embedding infrastructure.

**Model Registry Service: No Persistence Layer**
The Model Registry Service (port 8083) operates entirely in memory with JSON logging to `logs/model-registry.log`. It tracks:
- Health status for Ollama and Synthetic providers
- Failover statistics and request tracking
- Provider availability and performance metrics
- **CRITICAL ISSUE**: All this operational intelligence is lost on service restart

**Configuration Inconsistencies:**
- Database Manager: `process.env.DATABASE_PATH || './data/devflow.sqlite'`
- Vector Service: `process.env.DATABASE_PATH || './data/vector.sqlite'`
- Task Hierarchy Service: `dbPath: string = './devflow.sqlite'` (points to root)
- CCR Runner: `dbPath: process.env.DEVFLOW_DB_PATH || 'devflow.sqlite'`

**Data Flow Disconnection:**
Currently, when a user creates a task through the task hierarchy system, it writes to the root `/devflow.sqlite`. When vector embeddings are generated, they go to `/data/vector.sqlite`. When database operations occur through the Database Manager service, they target `/data/devflow.sqlite`. This creates three separate data silos with no cross-referential integrity.

**Critical Performance Impact:**
The fragmentation forces the system to maintain multiple SQLite connections, WAL files, and transaction logs. Each service maintains its own connection pool, causing resource contention and preventing true ACID compliance across related operations.

### For Database Unification Implementation: Integration Architecture

The migration to a single source of truth at `/devflow.sqlite` requires careful orchestration because the current system has built deep assumptions about database separation. Here's what needs to integrate:

**Database Manager Service Migration:**
The service at `packages/core/dist/services/database-manager.cjs` must be reconfigured to point to the root `/devflow.sqlite` instead of creating its own instance. This requires:
- Updating the `DATABASE_PATH` environment variable default
- Ensuring the comprehensive schema is created, not the basic one
- Migrating any existing data from `/data/devflow.sqlite` to the unified database
- Preserving the production WAL mode and performance configurations

**Vector Memory Service Consolidation:**
The `packages/core/dist/services/vector-memory-service.cjs` must be completely rearchitected to:
- Use the `memory_block_embeddings` and `knowledge_entity_embeddings` tables instead of `vector_memories`
- Integrate with the existing embedding infrastructure in the main database
- Maintain compatibility with the EmbeddingGemma model (768 dimensions)
- Ensure vector operations are ACID-compliant with memory block creation

**Model Registry Persistence Addition:**
The Model Registry service needs a complete persistence layer that integrates with the unified database. This involves:
- Creating tables for `model_providers`, `model_health_history`, `failover_events`, `provider_performance_metrics`
- Converting the in-memory health status tracking to database persistence
- Implementing provider performance analytics that feed into `platform_performance` table
- Ensuring model availability data informs the platform routing intelligence

**Service Configuration Standardization:**
All services must be updated to use consistent database path resolution:
- Single environment variable: `DEVFLOW_DB_PATH=./devflow.sqlite`
- Removal of hardcoded `./data/` assumptions
- Docker configurations updated to mount unified database location
- Orchestrator configuration (`devflow-start.sh`) updated for single database reference

**Advanced Features Activation Requirements:**
The unified database already contains sophisticated schemas that are not being utilized:

1. **Cost Analytics Integration**: The `cost_analytics` and `synthetic_usage` tables can immediately begin tracking all API usage across services
2. **Knowledge Learning System**: The `knowledge_entities` and `entity_relationships` tables enable cross-session learning and pattern recognition
3. **Platform Intelligence**: The `platform_performance` table can provide real-time routing decisions based on historical performance data

### Technical Reference Details

#### Current Database Schemas Comparison

**Root `/devflow.sqlite` (Target Unified Schema)**:
```sql
-- Core entities with full lifecycle support
task_contexts (12 columns + lifecycle + CC integration)
memory_blocks (13 columns + embeddings + relationships)
coordination_sessions (14 columns + handoff tracking)

-- Advanced features ready for activation
cost_analytics (date, platform, model, costs, efficiency)
synthetic_usage (provider, agent_type, model, usage metrics)
knowledge_entities (learning system with confidence scoring)
platform_performance (routing intelligence)

-- Full-text search
Virtual FTS5 tables for all major entities
```

**Fragment `/data/vector.sqlite` (Simple Schema)**:
```sql
-- Minimal vector storage
vector_memories (8 columns, no relationships)
```

**Fragment `/data/devflow.sqlite` (Basic Schema)**:
```sql
-- Basic task/memory without advanced features
task_contexts (6 columns only)
memory_blocks (5 columns, no relationships)
memory_block_embeddings (5 columns, no model tracking)
```

#### Migration Data Flow

**Phase 1: Service Reconfiguration**
1. Database Manager → Root database with full schema validation
2. Vector Service → Unified embedding tables with relationship mapping
3. Model Registry → New persistence layer with provider tracking

**Phase 2: Data Migration Scripts**
1. Vector memories → Memory block embeddings with foreign key creation
2. Service health data → Model provider performance tables
3. Configuration consolidation → Single source environment variables

**Phase 3: Advanced Feature Activation**
1. Cost tracking → Real-time API usage monitoring
2. Knowledge learning → Cross-session pattern recognition
3. Platform intelligence → Performance-based routing decisions

#### File Locations for Implementation

- **Database Manager Update**: `/packages/core/dist/services/database-manager.cjs` lines 17-18 (DATABASE_PATH)
- **Vector Service Migration**: `/packages/core/dist/services/vector-memory-service.cjs` lines 18-20 (schema update)
- **Model Registry Persistence**: Create new `/src/core/model-registry/model-registry-persistence.ts`
- **Configuration Updates**:
  - `/ccr.config.json` (if database routing added)
  - `/.env.prod.example` line 27 (DEVFLOW_DB_PATH)
  - `/devflow-start.sh` service startup commands
- **Migration Scripts**: `/scripts/migrate-to-unified-database.sql`
- **Testing**: `/src/core/database/integration-tests/` (new directory)

#### Zero-Downtime Migration Strategy

1. **Pre-migration backup**: All three databases to `/backups/pre-unification/`
2. **Shadow migration**: Copy data to unified database while services run
3. **Service cutover**: Update configuration and restart services one by one
4. **Validation**: Verify data integrity and feature activation
5. **Cleanup**: Remove fragmented databases after verification period

#### Rollback Requirements

- Configuration rollback scripts for each service
- Database restore procedures for each fragment
- Service restart orchestration for rollback scenario
- Data consistency validation for rollback verification

## Work Log
- [2025-09-19] Task created with comprehensive microservice analysis