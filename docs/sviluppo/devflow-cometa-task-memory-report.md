# Resoconto Sistema Task & Memoria DevFlow “Cometa” (SQLite)

- Stato: COMPLETATO
- Data: 2025-09-17T00:00:00Z
- Branch: feature/co-me-ta_to_real_world

## Sintesi
È stato completato l’inserimento dell’Iniezione di Contesto (Opzione B) nel server MCP Synthetic con retrieval semantico su SQLite, compressione entro budget token e formattazione del contesto nel prompt. Sono stati aggiunti gli hook di salvataggio (Stop/SubagentStop) per alimentare la base conoscenza. Il sistema “Cometa” di task e memoria è pienamente operativo su SQLite, con pipeline RAG e persistenza robusta.

## Architettura (SQLite)
- Task: `TaskHierarchyService` (CRUD su `task_contexts`)
- Memoria semantica: `SemanticMemoryService` con `UnifiedDatabaseManager`
  - Tabelle: `memory_blocks`, `memory_block_embeddings`
  - Indici: su `model_id`, `memory_block_id`, `created_at`
- Bridge & Compressione: `MemoryBridgeService`, `ContextCompressor`
- Iniezione: prefisso “[Contesto Recuperato]” prima del prompt del modello
- Hook: Stop/SubagentStop → estrazione conoscenza + snapshot + embeddings

## Componenti Principali
- `TaskHierarchyService` (dist/core/task-hierarchy/...): gestione gerarchia, status, parent/child.
- `SemanticMemoryService` (dist/core/semantic-memory/...): generazione embeddings e ricerca similarità.
- `UnifiedDatabaseManager` (dist/database/...): storage embeddings, batch, query.
- `ContextCompressor` (dist/core/memory-bridge/...): selezione blocchi entro budget.
- `LocalEmbeddingModel`/`OllamaEmbeddingModel`: layer embedding (fallback locale, opzionale Ollama).

## Implementazioni Chiave
1) Iniezione di Contesto (Opzione B)
   - File: `mcp-servers/synthetic/src/context-injection.ts`
   - Integrazione: `mcp-servers/synthetic/src/dual-enhanced-index.ts` e `dist/dual-enhanced-index.js`
   - Flusso:
     1. Crea task effimero da prompt, genera embedding
     2. `findSimilarTasks` → blocchi ordinati per similarità
     3. `ContextCompressor` → rispetto `CONTEXT_TOKEN_BUDGET`
     4. Sezione “[Contesto Recuperato]” → prefisso prompt
     5. Archiviazione task effimero

2) Hook Intelligent Save (Stop/SubagentStop)
   - File: `.claude/hooks/intelligent-save-hook.mjs`, `stop-hook.mjs`, `subagent-stop-hook.mjs`
   - Flusso:
     1. Legge transcript/JSON da stdin
     2. `HarvestingProtocol` → estrazione e staging memoria
     3. Crea task snapshot + embedding (persiste su SQLite)
     4. Salva blocco episodico (riassunto) in `memory_blocks`
     5. Archivia snapshot per mantenere la lista ordinata

## Configurazione
- Env principali:
  - `CONTEXT_INJECTION_ENABLED=true`
  - `CONTEXT_TOKEN_BUDGET=2000`
  - `CONTEXT_SIMILARITY_THRESHOLD=0.7`
  - `CONTEXT_MAX_BLOCKS=8`
  - `CONTEXT_TEMPLATE=default|compact`
  - (Opzionale) `OLLAMA_URL`, `OLLAMA_EMBED_MODEL`

## KPI & Monitoraggio
- Rilevanza: similarità media blocchi selezionati
- Efficienza: token risparmiati (%), latenza retrieval (ms)
- Qualità: riduzione richieste di chiarimento
- Log consigliati: `logs/context-injection.log`, `logs/hook-intelligent-save.log`

## Validazione
- Smoke test MCP: avvio server Synthetic OK, iniezione attiva (prefisso visibile)
- Hook: snapshot + embedding creati, persistenza su SQLite operativa (richiede `sqlite3` installato)

## Prossimi Step (facoltativi)
- Abilitare Ollama per embeddings di qualità superiore
- Aggiungere log strutturati per ogni richiesta di iniezione (metrica similitudine, blocchi, token)
- A/B test `threshold/limit/template` per ottimizzare rilevanza/efficienza

## Stato Task
- [x] Iniezione di contesto (Opzione B) implementata e integrata
- [x] Hook Stop/SubagentStop con persistenza e embeddings
- [x] Documentazione e variabili ambiente
- [x] Completato

