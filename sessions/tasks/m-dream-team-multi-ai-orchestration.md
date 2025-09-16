# Dream Team Multi-AI Orchestration System

## Context Manifest

**Task ID**: m-dream-team-multi-ai-orchestration
**Priority**: Critical
**Status**: Planning
**Started**: 2025-09-16
**Branch**: feature/dream-team-orchestration

### Objective
Implementare sistema di orchestrazione multi-AI ottimizzato che trasforma DevFlow in un dream team coordinato con:
- CLI tools come sistema primario (Codex, Gemini, Qwen)
- Fallback atomici role-specific a Synthetic
- Sistema Consensum per decisioni critiche collegiali
- Batching intelligente per ottimizzazione API

### Services Involved
- Multi-Platform Usage Monitor
- Atomic Fallback System
- Consensum Council Engine
- Intelligent Agent Router
- API Batching Orchestrator

### Architecture Goals
1. **Primary**: CLI tools tramite MCP servers (massimizzare risorse gratuite/economiche)
2. **Fallback**: Synthetic agents solo quando CLI esauriti (role-specific)
3. **Collegial**: Sistema Consensum per decisioni architetturali critiche
4. **Efficient**: Batching intelligente per minimizzare chiamate API

## Macro-Tasks Planning

### MACRO-TASK 1: Multi-Platform Usage Monitor System
**Synthetic Agent**: Qwen 3 Coder
**Estimated Calls**: 8-12 API calls (con batching)
**Priority**: Foundation

#### Micro-Tasks:
1. **M1.1**: Gemini CLI Usage Tracker con soglia Pro→Flash
2. **M1.2**: Qwen CLI Quota Monitor (1000 req/day)
3. **M1.3**: Codex CLI Session Tracker (no fallback)
4. **M1.4**: Consensum Weekly Quota System
5. **M1.5**: Unified Dashboard Integration

### MACRO-TASK 2: Atomic Fallback Engine
**Synthetic Agent**: DeepSeek V3 Reasoning
**Estimated Calls**: 6-8 API calls (con batching)
**Priority**: Core System

#### Micro-Tasks:
2. **M2.1**: Gemini CLI → Qwen 2.5 Synthetic (role: verificatore)
3. **M2.2**: Qwen CLI → Qwen 3 Synthetic (role: QA specialist)
4. **M2.3**: Context Preservation per fallback atomici
5. **M2.4**: Fallback Quality Gates
6. **M2.5**: Performance Testing Fallback Chains

### MACRO-TASK 3: Consensum Council System
**Synthetic Agent**: Qwen 3 Coder + DeepSeek V3 Reasoning
**Estimated Calls**: 10-15 API calls (sistema complesso)
**Priority**: Advanced Feature

#### Micro-Tasks:
1. **M3.1**: Consensum Council Interface
2. **M3.2**: Critical Decision Trigger Logic
3. **M3.3**: Qwen 3 + DeepSeek V3 Cross-Examination
4. **M3.4**: Consensus Synthesis Algorithm
5. **M3.5**: Tech Lead Integration Workflow

### MACRO-TASK 4: Intelligent Agent Router
**Synthetic Agent**: Qwen 3 Coder
**Estimated Calls**: 5-7 API calls (con batching)
**Priority**: Core Integration

#### Micro-Tasks:
1. **M4.1**: Enhanced AgentClassificationEngine per CLI priority
2. **M4.2**: Task-to-Agent mapping ottimizzato
3. **M4.3**: Real-time usage-based routing
4. **M4.4**: Integration con sistema existing DevFlow
5. **M4.5**: Performance benchmarking

### MACRO-TASK 5: API Batching Orchestrator
**Synthetic Agent**: DeepSeek V3 Reasoning
**Estimated Calls**: 4-6 API calls (ottimizzazione)
**Priority**: Optimization

#### Micro-Tasks:
1. **M5.1**: Batching Strategy Design
2. **M5.2**: Request Aggregation Engine
3. **M5.3**: Response Distribution System
4. **M5.4**: Cost Optimization Analytics
5. **M5.5**: Performance Monitoring

## Intelligent API Batching Strategy

### Batching Patterns:
1. **Related Code Tasks**: Batch 3-5 micro-tasks dello stesso macro-task
2. **Context Sharing**: Gruppo task che condividono context simile
3. **Agent Specialization**: Batch per stesso agente Synthetic
4. **Cost Optimization**: Priorità ai batch che riducono total API calls

### Batch Compositions:
- **Batch A (Qwen 3)**: M1.1, M1.2, M1.5, M4.1, M4.2 (5 tasks = 1 API call)
- **Batch B (DeepSeek V3)**: M2.1, M2.3, M5.1, M5.2 (4 tasks = 1 API call)
- **Batch C (Mixed)**: M3.1, M3.4, M4.3 (3 tasks = 1 API call per agent)

### Estimated Total API Calls:
- **Without Batching**: 35-48 chiamate separate
- **With Intelligent Batching**: 12-18 chiamate aggregate
- **Saving**: ~65% riduzione chiamate API

## Work Log

### 2025-09-16 - Planning & Implementation Phase
- ✅ Task creation and context manifest
- ✅ Macro-task breakdown with Synthetic agent assignment
- ✅ Intelligent batching strategy design
- ✅ MACRO-TASK 1: Multi-Platform Usage Monitor COMPLETED
  - ✅ M1.1: Multi-Platform Usage Monitor base implementation
  - ✅ M1.2: Gemini CLI Tracker with /stats and Pro→Flash prevention
  - ✅ M1.3: Qwen CLI Monitor with 1000 req/day generous limits
- ✅ MACRO-TASK 2: Atomic Fallback Engine COMPLETED
  - ✅ M2.1: Atomic fallback chains (Gemini→Qwen 2.5, Qwen→Qwen 3)
  - ✅ M2.2: Context preservation for role-specific fallbacks
  - ✅ M2.3: Quality gates and confidence thresholds
- ✅ MACRO-TASK 3: Consensum Council System COMPLETED
  - ✅ M3.1: Consensum Council Interface with critical decision triggers
  - ✅ M3.2: Qwen 3 + DeepSeek V3 Cross-Examination protocol
  - ✅ M3.3: Weighted consensus synthesis (Qwen 60%, DeepSeek 40%)
  - ✅ M3.4: Tech Lead integration workflow with 20 req/week quota
- 🔄 MACRO-TASK 4: Intelligent Agent Router (in progress)

### Next Steps
1. Iniziare con MACRO-TASK 1 (Usage Monitor) - foundation
2. Implementare batching strategy per chiamate ottimizzate
3. Testing incrementale con fallback atomici
4. Integration testing completo sistema

## Context Dependencies
- Existing DevFlow orchestration system
- MCP servers già configurati (.mcp.json)
- AgentClassificationEngine attuale
- DelegationSystem esistente

## Success Criteria
- [ ] CLI tools utilizzati come primary con fallback atomici
- [ ] Riduzione 65%+ chiamate API tramite batching intelligente
- [ ] Sistema Consensum operativo per decisioni critiche
- [ ] Usage monitor real-time multi-piattaforma
- [ ] Integration trasparente con DevFlow esistente