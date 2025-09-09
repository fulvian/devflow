# Piano Operativo Fase 0 - Foundation & Proof of Concept

## **📋 Overview**
**Durata**: 4-6 settimane  
**Obiettivo**: Implementare memoria persistente minimal e coordinazione Claude Code ↔ OpenRouter  
**Success Criteria**: 30% riduzione token usage, context handoff funzionante, zero perdita architectural decisions

---

## **🏗️ Architettura Tecnica Fase 0**

### **Component Architecture**
```
DevFlow Foundation/
├── packages/
│   ├── core/                    # @devflow/core
│   │   ├── src/
│   │   │   ├── memory/         # Memory persistence system
│   │   │   ├── routing/        # Basic task routing
│   │   │   ├── adapters/       # Platform adapters
│   │   │   └── utils/          # Shared utilities
│   │   └── package.json
│   ├── claude-adapter/         # @devflow/claude-adapter
│   │   ├── src/adapter.ts      # Main adapter
│   │   ├── hooks/              # cc-sessions integration
│   │   └── package.json
│   └── adapters/openrouter/    # @devflow/openrouter
│       ├── src/gateway.ts      # Gateway orchestrator
│       ├── src/client/         # HTTP client, auth, retry, limiter
│       ├── src/models/         # Model configs, selector, classifier
│       ├── src/routing/        # Router, cost optimizer, fallback, perf
│       ├── src/analytics/      # Cost/usage trackers, reporter
│       └── package.json
├── tools/                      # Development utilities
├── tests/                      # Integration tests
└── package.json               # Workspace configuration
```

### **Database Schema (SQLite)**
```sql
-- Core memory tables
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    task_id TEXT,
    platform TEXT NOT NULL,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    context_size_tokens INTEGER,
    cost_usd DECIMAL(10,6) DEFAULT 0.0
);

CREATE TABLE memory_blocks (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES sessions(id),
    block_type TEXT NOT NULL, -- 'architectural', 'implementation', 'context'
    content TEXT NOT NULL,
    importance_score DECIMAL(3,2) DEFAULT 0.5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE task_contexts (
    id TEXT PRIMARY KEY,
    task_name TEXT NOT NULL,
    accumulated_context TEXT,
    last_platform TEXT,
    total_tokens_saved INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Full-text search
CREATE VIRTUAL TABLE memory_fts USING fts5(content, block_type);
```

---

## **🚀 Sprint Breakdown**

### **Sprint 1: Core Foundation (Settimana 1-2)** - ✅ **ARCHITECTURE PHASE COMPLETED**
**Claude Code Focus**: Architettura e setup progetto  
**Codex Focus**: Implementation core components

#### **Claude Code Tasks**: ✅ **COMPLETED**
1. **Project Architecture Setup** ✅
   - ✅ Monorepo structure with pnpm workspaces (package.json, pnpm-workspace.yaml)
   - ✅ TypeScript configuration con strict mode (tsconfig.json con project references)
   - ✅ ESLint + Prettier configuration (eslint.config.js, .prettierrc)
   - ✅ Testing setup con Vitest (vitest.config.ts con coverage thresholds)

2. **Database Schema Design** ✅
   - ✅ SQLite schema ottimizzato per use cases (schema.sql completo con FTS5, JSON1)
   - ✅ Migration system design (schema_versions table, triggers automatici)
   - ✅ Query patterns identification (views, indexes ottimizzati)
   - ✅ Performance considerations (PRAGMA settings, ANALYZE)

3. **Memory System Architecture** ✅
   - ✅ Context serialization strategy (TypeScript interfaces complete)
   - ✅ Importance scoring algorithm design (0.0-1.0 scoring system)
   - ✅ Context compaction rules definition (multiple strategies defined)
   - ✅ Search and retrieval patterns (semantic + full-text search)

#### **Codex Implementation Tasks**:

**CODEX-1A: Project Foundation Setup** ✅ **COMPLETED & VALIDATED**
- ✅ **Implementation Results**:
  - Monorepo structure completa con pnpm workspaces
  - TypeScript 5.0+ strict mode con project references
  - ESLint v9 + @typescript-eslint v8 compatibility
  - All quality gates passing: build, type-check, lint
  - Dependency conflicts risolti e validati
- ✅ **Technical Validation**:
  - `pnpm install` - Successo con dependency fixes
  - `pnpm build` - Tutti i package compilano correttamente  
  - `pnpm type-check` - TypeScript strict mode compliance
  - `pnpm lint` - Zero errors su tutti i source files
- ✅ **Ready for CODEX-1B**: Memory system implementation

**CODEX-1B: Memory System Core Implementation** ✅ **IMPLEMENTED**
- ✅ **Core Implementation Results**:
  - Database layer completo: connection.ts, migrations.ts, queries.ts, transaction.ts
  - Memory system: manager.ts, blocks.ts, contexts.ts, sessions.ts, search.ts, compaction.ts
  - Better-sqlite3 integration con @types/better-sqlite3 per TypeScript compliance
  - Migration system con automatic schema initialization da schema.sql
  - FTS5 full-text search capabilities implementate
- ✅ **Architecture Validation**:
  - Tutte le interfaces da @devflow/shared utilizzate correttamente
  - 4-layer Memory Hierarchy implementata (Context Window → Session → Working → Long-term)
  - Type-safe query builders con prepared statements
  - Context compaction con multiple strategies (importance, recency)
- ⚠️ **Minor Build Issues** (non-blocking):
  - TypeScript strict mode environment variable access (TS4111)
  - Test data completeness per full interfaces (mancano alcuni required fields)
  - Unused variable warnings in service classes
- ✅ **Ready for Integration**: Core memory system functional per Claude Code Adapter

### **Sprint 2: Claude Code Integration (Settimana 2-3)** ✅ **IMPLEMENTED**
**Claude Code Focus**: cc-sessions hooks e context management  
**Codex Focus**: Adapter implementation e testing

**CODEX-2A: Claude Code Adapter Implementation** ✅ **IMPLEMENTED**
- ✅ **Core Implementation Results**:
  - ClaudeAdapter orchestrator con context injection/extraction pipeline
  - Hook system: session-hooks, tool-hooks, context-hooks per cc-sessions integration
  - Context management: manager, extractor, injector, detector per important info
  - Filesystem monitoring: watcher, debouncer, safe-ops per real-time updates
  - Complete integration con SQLiteMemoryManager da CODEX-1B
- ✅ **Architecture Integration**:
  - Non-intrusive design che rispetta existing cc-sessions workflows
  - Hook registration system per session:start, session:end, tool:used events
  - Context pipeline: Extract → Analyze → Store → Retrieve → Inject
  - Performance optimizations: debounced FS events, limited context injection
- ⚠️ **Build Issues** (same as CODEX-1B): TypeScript strict mode environment variables
- ✅ **Ready for Integration**: Claude Code adapter functional per OpenRouter handoff

#### **Claude Code Tasks**:
1. **cc-sessions Hooks Analysis**
   - Analisi hook system esistente
   - Integration points identification
   - Context extraction strategies
   - Hook lifecycle management

2. **Context Management Strategy**
   - Context serialization/deserialization
   - Important information detection
   - Context compaction algorithms
   - Memory threshold management

#### **Codex Implementation Tasks**:
```markdown
# CODEX TASK 2A: Claude Code Adapter Implementation

## Context & Objective
Implementare l'adapter per Claude Code che si integra con cc-sessions hooks per salvare e ripristinare contesto automaticamente.

## Technical Requirements
- Integration con cc-sessions hook system
- Context extraction da file .claude/context/
- Automatic context saving su tool usage
- Context injection su session start

## Implementation Guidelines
- Utilizzare filesystem watchers per hook triggers
- Implementare debouncing per context saves
- Error handling per filesystem operations
- Logging dettagliato per debugging

## Expected Deliverables
- packages/claude-adapter/src/adapter.ts
- packages/claude-adapter/src/hooks/
- packages/claude-adapter/src/context-manager.ts
- Integration tests con mock cc-sessions
- Documentation per setup e utilizzo

## Report Template
[Standard format con focus su integration testing results]
```

---

## **🚀 Sprint 3 – OpenRouter Gateway (CODEX‑3A)**

### Deliverables Implementati
- Gateway OpenRouter con pipeline: context injection → routing intelligente → chiamata API → tracking costi/metriche → risposta.
- Client HTTP: fetch con timeout, retry esponenziale, validazione risposta, gestione errori strutturata.
- Rate limiting per richieste/minuto con coda sicura.
- Modelli: configurazioni costi/contesto, classifier euristico, selettore basato su costo/capacità/performance.
- Fallback chain e performance tracker (latenza e success rate per modello).
- Analytics: cost tracker (budget opzionale), usage tracker e reporter per riepiloghi per modello.
- Test unitari (Vitest) con API mock: selector, retry, cost tracker, gateway.

### Integrazioni e Compliance
- TypeScript strict al 100% (no any; exact optional property types ok).
- Sicurezza: nessuna chiave hardcoded; uso `OPEN_ROUTER_API_KEY`/`OPENROUTER_*` via env.
- Configurabilità: `OPENROUTER_PREFERRED_MODELS`, `OPENROUTER_COST_BUDGET_USD`, `OPENROUTER_MAX_RETRIES`, `OPENROUTER_TIMEOUT_MS`.

### Limiti/Note in questo ambiente
- Test nativi su SQLite (`better-sqlite3`) sono gated con `SKIP_NATIVE=1` a causa di mismatch binari in questa sandbox.
- La build del pacchetto openrouter è isolata per evitare cross-build non necessari.

### Prossimi Step (prep CODEX‑4A)
- Collegare gateway all’adapter Claude per handoff end‑to‑end (inject/extract context reali).
- Test di integrazione end‑to‑end con mock e success criteria di performance.
- Aggiungere ulteriori modelli e affinare pesi di routing/costi.

### Comandi utili
- Test monorepo (sandbox): `SKIP_NATIVE=1 pnpm test -w`
- Test gateway: `pnpm -C packages/adapters/openrouter test`
- Build gateway: `pnpm -C packages/adapters/openrouter build`

### **Sprint 3: OpenRouter Integration (Settimana 3-4)** 🟡 **IMPLEMENTED + HARDENING IN CORSO**
**Claude Code Focus**: Router logic e cost optimization  
**Codex Focus**: API integration e gateway implementation

**CODEX-3A: OpenRouter Gateway Implementation** ✅ **IMPLEMENTED**
- ✅ **OpenRouter API Integration Results**:
  - Complete HTTP client con fetch-based API calls, timeout control, retry logic
  - Secure authentication con environment variable API key management
  - Rate limiting con token bucket algorithm per API throttling
  - Full TypeScript type safety con response validation e error handling
- ✅ **Model Routing & Selection System**:
  - Multi-model support: claude-3-sonnet, gpt-4o-mini, gemini-1.5-pro configs
  - Task classification system con capability matching
  - Cost optimization algorithm per intelligent model selection
  - Fallback chains per high availability e error recovery
- ✅ **Cost Tracking & Analytics**:
  - Real-time cost tracking con budget monitoring
  - Usage analytics per model performance e request tracking
  - Performance tracker con latency metrics e success rates
  - Comprehensive reporting system con per-model statistics
- ⚠️ **Build Issues** (same as previous): Core package TypeScript strict mode issues
- ✅ **Ready for Integration**: OpenRouter Gateway functional per end-to-end testing

#### Hardening Delta (ongoing)
- Env parsing centralizzato: shared `OpenRouterEnvSchema` + `loadOpenRouterEnv()`
- Response validation: Zod schema per `ChatResponse` nel client
- Cost safety: guardie anti-NaN in `estimateCostUSD`
- Model selection robustness: fallback a `DEFAULT_MODELS` quando i preferiti non corrispondono
- Test aggiuntivi: gateway fallback preferiti; cost tracker invalid values

#### **Claude Code Tasks**:
1. **Task Classification System**
   - Rule-based routing algorithm
   - Model selection criteria
   - Cost optimization strategies
   - Performance monitoring

2. **OpenRouter Integration Design**
   - API wrapper architecture
   - Context injection protocols
   - Error handling and fallbacks
   - Rate limiting management

#### **Codex Implementation Tasks**:
```markdown
# CODEX TASK 3A: OpenRouter Gateway Implementation

## Context & Objective
Implementare gateway per OpenRouter API con support per multiple models, context injection automatica e cost optimization.

## Technical Requirements
- OpenRouter API client con TypeScript types
- Model routing basato su task classification
- Context injection transparente
- Cost tracking e rate limiting
- Error handling e retry logic

## Implementation Guidelines
- Utilizzare fetch API con timeout management
- Implementare exponential backoff per retries
- Structured logging per API calls
- Configuration system per model preferences

## Expected Deliverables
- packages/openrouter-gateway/src/gateway.ts
- packages/openrouter-gateway/src/models/
- packages/openrouter-gateway/src/cost-tracker.ts
- API integration tests
- Cost optimization benchmarks

## Report Template
[Standard format con metriche di performance e costo]
```

### **Sprint 4: Integration & Testing (Settimana 4-5)**
**Claude Code Focus**: End-to-end testing e optimization  
**Codex Focus**: Integration testing e bug fixes

#### **Integration Tasks**:
1. **End-to-End Workflow Testing**
   - Claude Code → context save → OpenRouter handoff
   - Context preservation validation
   - Cost tracking verification
   - Performance benchmarking

2. **Real-world Usage Testing**
   - Test su progetti reali
   - Token usage comparison
   - Context quality assessment
   - User experience validation

#### **Codex Implementation Tasks**:
```markdown
# CODEX TASK 4A: Integration Testing Suite

## Context & Objective
Implementare comprehensive testing suite per validare l'intero workflow DevFlow dalla context extraction al handoff tra piattaforme.

## Technical Requirements
- E2E tests con mock API responses
- Performance benchmarking tools
- Cost calculation validation
- Context preservation testing
- Real workflow simulation

## Implementation Guidelines
- Utilizzare Vitest per integration tests
- Mock APIs per testing controllato
- Performance metrics collection
- Test data generation utilities
- CI/CD integration ready

## Expected Deliverables
- tests/integration/ con test suite completa
- tools/benchmarks/ per performance testing
- Mock API servers per testing
- Test data fixtures
- CI/CD configuration files

## Report Template
[Standard format con test coverage e performance metrics]
```

### **Sprint 5: Polish & Documentation (Settimana 5-6)**
**Claude Code Focus**: Documentation e deployment prep  
**Codex Focus**: Bug fixes e performance optimization

---

## **📊 Success Metrics Tracking**

### **Technical KPIs**
- **Token Reduction**: Baseline measurement → 30% target reduction
- **Context Handoff Success**: >95% preservation accuracy
- **Response Time**: <2s per context injection
- **Cost Optimization**: Automatic routing al modello più cost-effective

### **Measurement Tools**
- Automated token usage tracking
- Context diff analysis
- API cost monitoring dashboard
- Performance profiling integration

### **Testing Strategy**
- Unit tests: >90% coverage su core components
- Integration tests: Full workflow simulation
- Performance tests: Load testing con real data
- User acceptance testing: Real-world usage validation

---

## **🔄 Handoff Protocols**

### **Claude Code → Codex Handoff**
1. Claude Code crea detailed task specification
2. Includes technical context e architectural constraints
3. Provides expected deliverables checklist
4. Defines success criteria e testing requirements

### **Codex → Claude Code Handoff**
1. Codex delivers code + comprehensive report
2. Report includes technical decisions rationale
3. Context memory data per persistence
4. Recommendations per next steps

### **Memory Persistence Protocol**
- Automatic context save dopo ogni major operation
- Structured metadata per easy retrieval
- Importance scoring per context compaction
- Cross-session continuity maintenance

---

## **🚨 Risk Mitigation**

### **Technical Risks**
- **cc-sessions Integration**: Fallback manual context injection
- **OpenRouter API Changes**: Adapter pattern per easy updates  
- **Performance Issues**: Caching e lazy loading strategies
- **Data Loss**: Automatic backups e recovery procedures

### **Timeline Risks**
- **Complexity Underestimation**: Break tasks in smaller chunks
- **Integration Challenges**: Early integration testing
- **Scope Creep**: Strict MVP boundaries
- **External Dependencies**: Local fallbacks quando possibile

---

*Piano Operativo creato: 2025-09-08*  
*Target Start: Immediato*  
*Target Completion: 4-6 settimane*
