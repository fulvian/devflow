# Architettura Orchestrazione Agenti Unificata v1.0

## 📋 Panoramica

Questo documento descrive l'architettura unificata per l'orchestrazione degli agenti DevFlow, progettata per sostituire tutti i sistemi di orchestrazione esistenti con un approccio semplificato, smart e unificato.

## 🏗️ Architettura Generale

### Gerarchia degli Agenti

```
┌─────────────────────────────────────────────────────────────┐
│                    CLAUDE SONNET (SUPREMO)                  │
│                  Orchestratore Esclusivo                    │
├─────────────────────────────────────────────────────────────┤
│                    AGENTI SPECIALIZZATI                     │
│                                                             │
│ 1. Codex CLI → Qwen3 Coder (Heavy Reasoning & Tools)       │
│ 2. Gemini CLI → Kimi K2 (Frontend & Refactoring)           │
│ 3. Qwen CLI → GLM 4.5 (Backend & Automation)               │
│ 4. Analyst = Gemini → Qwen3 (Context Analysis)             │
│ 5. Strategic = Codex → DeepSeek V3.1 (Strategic Decisions) │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Principi Fondamentali

### 1. Orchestratore Supremo Unico
- **Claude Sonnet**: Unico responsabile di tutte le decisioni strategiche
- **Nessun Fallback**: Claude Sonnet non ha fallback, è il controller finale
- **Potere Decisionale Esclusivo**: Solo Claude può decidere routing, priorità, escalation

### 2. Agenti Specializzati CLI-Synthetic
- **CLI come Primari**: Agenti CLI specializzati per domini specifici
- **Synthetic come Fallback**: Ogni CLI ha un fallback Synthetic specializzato
- **Zero Auto-Verifica**: Nessun agente può verificare il proprio lavoro

### 3. Modalità Operative
- **claude-only**: Solo Claude (bypass enforcement 100 righe)
- **all-mode**: Full stack (CLI + Synthetic + Cross-verification)
- **cli-only**: CLI + Claude (no Synthetic)
- **synthetic-only**: Synthetic + Claude (no CLI)

## 🔄 Mapping Agenti

### Implementazione → Fallback

| Ruolo | CLI Primario | Synthetic Fallback | Specializzazione |
|-------|-------------|-------------------|------------------|
| Coder 1 | Codex | Qwen3 Coder | Heavy Reasoning & Tool Use |
| Coder 2 | Gemini | Kimi K2 | Frontend & Robust Refactor |
| Coder 3 | Qwen | GLM 4.5 | Backend & Fast Patching |
| Analyst | Gemini | Qwen3 Coder | Context Analysis |
| Strategic | Codex | DeepSeek V3.1 | Strategic Decisions |

### Synthetic Models Mapping

| Agente | Modello | API Endpoint |
|--------|---------|-------------|
| Qwen3 Coder | hf:Qwen/Qwen3-Coder-480B-A35B-Instruct | synthetic.new |
| Kimi K2 | hf:moonshotai/Kimi-K2-Instruct-0905 | synthetic.new |
| GLM 4.5 | hf:zai-org/GLM-4.5 | synthetic.new |
| DeepSeek V3.1 | hf:deepseek-ai/DeepSeek-V3.1 | synthetic.new |

## ⚡ Sistema Cross-Verification

### Matrice di Verifica (No Auto-Verifica)

| Implementer | Verificatori Possibili | Fallback Verification |
|-------------|----------------------|---------------------|
| Codex | Gemini, Qwen | GLM 4.5 |
| Gemini | Codex, Qwen | Kimi K2 |
| Qwen | Codex, Gemini | DeepSeek V3.1 |
| Qwen3 Coder | Kimi K2, GLM 4.5, DeepSeek | - |
| Kimi K2 | Qwen3, GLM 4.5, DeepSeek | - |
| GLM 4.5 | Qwen3, Kimi K2, DeepSeek | - |
| DeepSeek V3.1 | Qwen3, Kimi K2, GLM 4.5 | - |

## 🕰️ Sistema Timeout Intelligente

### Timeout Dinamici per Tipo Task

| Task Type | Simple | Medium | Complex | Heavy |
|-----------|--------|--------|---------|-------|
| Code Generation | 45s | 90s | 180s | 600s |
| Code Analysis | 30s | 60s | 120s | 300s |
| Reasoning | 20s | 45s | 90s | 180s |
| Creative | 25s | 60s | 120s | 240s |

### Fattori di Calcolo
- **Performance Storica**: Aggiustamento basato su successi passati dell'agente
- **Complessità Task**: Moltiplicatore per tipo e dimensioni task
- **Carico Sistema**: Adattamento per load CPU/memoria
- **Modalità Operativa**: Timeout diversi per modalità

## 🎛️ Modalità Operative Dettagliate

### claude-only
```typescript
{
  orchestrator: 'claude_sonnet',
  execution: 'claude_sonnet',
  verification: 'claude_sonnet',
  enforcement: false,  // NO limite 100 righe
  fallback_chain: []
}
```

### all-mode
```typescript
{
  orchestrator: 'claude_sonnet',
  execution: 'cli_agents → synthetic_fallbacks → claude_emergency',
  verification: 'cross_verification_matrix',
  enforcement: true,   // Limite 100 righe per Claude
  fallback_chain: ['cli', 'synthetic', 'claude']
}
```

### cli-only
```typescript
{
  orchestrator: 'claude_sonnet',
  execution: 'cli_agents → claude_emergency',
  verification: 'cli_cross_verification',
  enforcement: true,
  fallback_chain: ['cli', 'claude']
}
```

### synthetic-only
```typescript
{
  orchestrator: 'claude_sonnet',
  execution: 'synthetic_agents → claude_emergency',
  verification: 'synthetic_cross_verification',
  enforcement: true,
  fallback_chain: ['synthetic', 'claude']
}
```

## 📊 API Gateway & Monitoring

### Endpoints Principali
- `/health` - Health check tutti i servizi
- `/metrics` - Performance metrics real-time
- `/api/:platform/*` - Routing ai platform specifici
- `/mode/switch/:mode` - Cambio modalità operativa
- `/agents/performance` - Statistiche performance agenti

### WebSocket Real-time
- `metricsUpdate` - Aggiornamenti metrics in tempo reale
- `modeChange` - Notifiche cambio modalità
- `agentStatus` - Status agenti (online/offline/degraded)

## 🔧 Componenti Tecnici

### File Principali
```
packages/orchestrator/unified/src/
├── timeout/
│   └── intelligent-timeout-manager.ts
├── orchestration/
│   └── unified-cli-synthetic-orchestrator.ts
├── verification/
│   └── cross-verification-system.ts
├── modes/
│   └── operational-modes-manager.ts
├── routing/
│   └── intelligent-router.ts
├── handoff/
│   └── cross-platform-handoff.ts
├── api/
│   └── unified-gateway.ts
└── core/
    └── unified-orchestrator.ts
```

## 🚀 Vantaggi dell'Architettura

### 1. Semplificazione
- **Un solo orchestratore**: Claude Sonnet comanda tutto
- **Eliminazione ridondanze**: Un solo sistema invece di multipli
- **Chiarezza decisionale**: Chi fa cosa è sempre chiaro

### 2. Intelligenza
- **Timeout adattivi**: Si migliorano con l'esperienza
- **Routing ottimizzato**: Basato su performance reali
- **Fallback specializzati**: Non generici ma per competenza

### 3. Robustezza
- **Cross-verification**: Zero auto-verifica
- **Fallback multipli**: CLI → Synthetic → Claude
- **Performance tracking**: Monitoraggio continuo

### 4. Flessibilità
- **4 modalità operative**: Per ogni situazione
- **Switch dinamico**: Cambio modalità in tempo reale
- **Emergency override**: Claude può sempre intervenire

## 🎯 STATO IMPLEMENTAZIONE - AGGIORNAMENTO 2025-09-23

### ✅ IMPLEMENTATO
- **Hook di Routing Intelligente**: `.claude/hooks/intelligent-task-router.js` (Refactored v2.0)
- **Architettura Centralizzata**: Hook come bridge leggero → Unified Orchestrator backend
- **Intercettazione Automatica**: Cattura tutti i tool call `mcp__codex-cli__*`, `mcp__gemini-cli__*`, `mcp__qwen-code__*`
- **Analisi Dimensione Task**: < 100 righe → Claude diretto, > 100 righe → delegazione Orchestrator
- **Routing Centralizzato**: Tutte le decisioni gestite dall'Unified Orchestrator (porta 3005)
- **Eliminazione Duplicazioni**: Logica di routing unificata, nessuna duplicazione tra hook e Orchestrator
- **Fallback Automatico Verificato**:
  - CLI → Synthetic funziona automaticamente (testato in produzione)
  - Gemini timeout → Qwen CLI → Synthetic Qwen3 Coder ✅
  - Logging completo delle catene di fallback
- **HTTP Bridge Pattern**: Hook comunica via REST API con Orchestrator
- **Fail-Open Design**: Errori di comunicazione → execuzione diretta (resilienza)

### 🔄 FUNZIONALITÀ ATTIVE
- **Architettura Centralizzata**: Hook → Orchestrator → Agenti (Single Source of Truth)
- **Routing Trasparente**: Claude non è consapevole del routing automatico
- **Fallback Automatico**: CLI → Synthetic con timeout detection (30s CLI, fallback immediato)
- **Performance Monitoring Unificato**:
  - Hook metrics: `.claude/logs/routing-metrics.json`
  - Orchestrator metrics: `/api/metrics` endpoint
  - Logs centralizzati: `/logs/unified-orchestrator.log`
- **Configurazione Dinamica**: Environment variables + API endpoints per tuning
- **Bridge Pattern**: Hook leggero (< 50 righe logic) + Orchestrator completo

### 📋 REQUISITI ATTIVAZIONE
- [ ] Riavvio Claude Code per attivazione hook refactored
- [x] **Test routing automatico completato**: ✅ Gemini → Qwen → Qwen3 Coder → Kimi K2 (fallback a catena)
- [x] **Monitoring metriche attivo**: Hook + Orchestrator logging funzionante
- [ ] Fine-tuning soglie timeout per environment production

### 🎯 ARCHITETTURA FINALE RAGGIUNTA
- **Single Source of Truth**: Unified Orchestrator (porta 3005) gestisce tutto il routing
- **Zero Duplicazioni**: Hook come bridge leggero, logica centralizzata
- **Fallback Automatico Verificato**: CLI → Synthetic funziona end-to-end
- **Resilienza Totale**: Fail-open + timeout detection + multiple fallback levels

## 📈 Metriche di Successo

### Performance Indicators
- **Riduzione complessità**: Eliminazione sistemi ridondanti
- **Miglioramento affidabilità**: Cross-verification + fallback
- **Ottimizzazione tempi**: Timeout intelligenti + performance tracking
- **Aumento trasparenza**: Monitoring real-time + audit trail

### Target Obiettivi
- **99% success rate** per task routing
- **< 5s response time** per switching modalità
- **Zero conflitti** tra sistemi di orchestrazione
- **100% audit trail** per tutte le decisioni

## 🔄 Piano di Migrazione

### Fase 1: Analisi Esistente
- [ ] Inventory completo sistemi orchestrazione attuali
- [ ] Mappatura dipendenze e conflitti
- [ ] Identificazione integration points

### Fase 2: Unificazione
- [ ] Eliminazione sistemi ridondanti
- [ ] Migrazione configurazioni esistenti
- [ ] Aggiornamento riferimenti codebase

### Fase 3: Testing
- [ ] Test unitari tutti i componenti
- [ ] Test integrazione end-to-end
- [ ] Test performance sotto carico

### Fase 4: Deploy
- [ ] Rollout graduale per modalità
- [ ] Monitoring intensivo performance
- [ ] Feedback loop e ottimizzazioni

---

**Versione**: 1.0
**Data**: 2025-09-22
**Autore**: Claude Sonnet + DevFlow Team