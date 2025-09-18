# PIANO DI IMPLEMENTAZIONE PER L'INIEZIONE DI CONTESTO NEI PROMPT

## 1. ANALISI E VALUTAZIONE

### 1.1. Riepilogo dell'Analisi
- **Hook Attivo**: Final Orchestration Hook (`final-orchestration-hook.js`)
- **Componente Principale**: SemanticMemoryService per la gestione della memoria semantica
- **Punti di Iniezione**: Prima dell'elaborazione del modello in `processUserMessage`
- **Dipendenze Disponibili**: SQLite, Winston, axios, better-sqlite3
- **Best Practice Identificate**: RAG, Memory-Based Context, Temporal Filtering

### 1.2. Obiettivi dell'Implementazione
1. Migliorare la coerenza delle risposte AI attraverso l'iniezione di contesto rilevante
2. Ridurre la necessità di ripetere informazioni già fornite in sessioni precedenti
3. Aumentare l'efficacia del sistema attraverso un utilizzo più intelligente della memoria
4. Mantenere le performance e la sicurezza del sistema

## 2. PROGETTAZIONE DELL'IMPLEMENTAZIONE

### 2.1. Architettura del Sistema di Iniezione Contesto

#### 2.1.1. Componenti Principali
1. **ContextRetrievalService**: Servizio per recuperare contesto rilevante dalla memoria semantica
2. **ContextEnhancer**: Componente per arricchire i prompt con il contesto recuperato
3. **ContextInjectionPoint**: Punto di integrazione nel flusso di elaborazione dei prompt

#### 2.1.2. Flusso di Elaborazione
1. Ricezione del prompt utente
2. Recupero del contesto rilevante tramite ContextRetrievalService
3. Arricchimento del prompt con ContextEnhancer
4. Elaborazione del prompt arricchito dal modello AI
5. Logging e monitoraggio dell'operazione

### 2.2. Specifiche Tecniche

#### 2.2.1. ContextRetrievalService
```typescript
// src/core/context/context-retrieval-service.ts
export class ContextRetrievalService {
  constructor(
    private semanticMemoryService: SemanticMemoryService,
    private taskHierarchyService: TaskHierarchyService
  ) {}

  async retrieveRelevantContext(prompt: string, sessionId: string, limit: number = 5): Promise<ContextBlock[]> {
    // 1. Creazione di un task temporaneo per il prompt
    const tempTask = await this.taskHierarchyService.createTask({
      title: "Prompt context",
      description: prompt,
      sessionId: sessionId
    });

    // 2. Generazione dell'embedding per il task temporaneo
    await this.semanticMemoryService.generateTaskEmbedding(tempTask.id, "default");

    // 3. Ricerca di task simili
    const similarTasks = await this.semanticMemoryService.findSimilarTasks(
      tempTask.id, 
      "default", 
      limit, 
      0.7 // soglia di similarità
    );

    // 4. Estrazione del contesto rilevante
    const contextBlocks: ContextBlock[] = [];
    for (const result of similarTasks) {
      if (result.task) {
        contextBlocks.push({
          title: result.task.title,
          description: result.task.description,
          similarity: result.similarity,
          timestamp: result.task.createdAt
        });
      }
    }

    return contextBlocks;
  }
}
```

#### 2.2.2. ContextEnhancer
```typescript
// src/core/context/context-enhancer.ts
export class ContextEnhancer {
  enhancePrompt(originalPrompt: string, contextBlocks: ContextBlock[]): string {
    if (contextBlocks.length === 0) {
      return originalPrompt;
    }

    // Formatta i blocchi di contesto
    const contextString = contextBlocks
      .map(block => `- [${block.timestamp}] ${block.title}: ${block.description}`)
      .join('\n');

    // Inietta il contesto nel prompt
    return `[Contesto Recuperato]\n${contextString}\n\n[Prompt Originale]\n${originalPrompt}`;
  }
}
```

#### 2.2.3. Punto di Iniezione
```typescript
// Modifica a mcp-servers/orchestrator/src/index.ts
private async processUserMessage(ws: WebSocket, message: MCPMessage): Promise<void> {
  // ... codice esistente ...

  // 1. Recupero del contesto rilevante
  const contextRetrievalService = new ContextRetrievalService(
    semanticMemoryService, 
    taskHierarchyService
  );
  const relevantContext = await contextRetrievalService.retrieveRelevantContext(
    userMessage.content, 
    sessionId
  );

  // 2. Arricchimento del prompt
  const contextEnhancer = new ContextEnhancer();
  const enhancedContent = contextEnhancer.enhancePrompt(
    userMessage.content, 
    relevantContext
  );

  // 3. Elaborazione con il modello (aggiornato)
  const response = await this.processWithModel(session, enhancedContent);

  // ... resto del codice esistente ...
}
```

## 3. IMPLEMENTAZIONE

### 3.1. Fase 1: Implementazione dei Componenti Core
- [ ] Creazione di ContextRetrievalService
- [ ] Creazione di ContextEnhancer
- [ ] Definizione delle interfacce e dei tipi necessari

### 3.2. Fase 2: Integrazione nel Flusso di Elaborazione
- [ ] Modifica di `processUserMessage` per includere il recupero e l'arricchimento del contesto
- [ ] Configurazione del servizio di memoria semantica
- [ ] Gestione degli errori e casi limite

### 3.3. Fase 3: Logging e Monitoraggio
- [ ] Aggiunta di logging per le operazioni di recupero contesto
- [ ] Implementazione di metriche per valutare l'efficacia
- [ ] Integrazione con il sistema di monitoring esistente

## 4. TESTING

### 4.1. Test Unitari
- [ ] Test di ContextRetrievalService
- [ ] Test di ContextEnhancer
- [ ] Test dei casi limite e degli errori

### 4.2. Test di Integrazione
- [ ] Test dell'intero flusso di iniezione contesto
- [ ] Test con diversi tipi di prompt e contesti
- [ ] Test delle performance

### 4.3. Test di Sistema
- [ ] Verifica del corretto funzionamento end-to-end
- [ ] Test di regressione per assicurare che le funzionalità esistenti non siano compromesse

## 5. DEPLOY E MONITORAGGIO

### 5.1. Strategia di Deploy
- Implementazione iniziale in ambiente di staging
- Test approfondito con utenti selezionati
- Rollout graduale in produzione

### 5.2. Monitoraggio Post-Deploy
- Monitoraggio delle metriche di performance
- Raccolta di feedback dagli utenti
- Analisi dell'efficacia dell'iniezione di contesto

## 6. MITIGAZIONE DEI RISCHI

### 6.1. Rischi Identificati e Strategie di Mitigazione

| Rischio | Probabilità | Impatto | Strategia di Mitigazione |
|---------|-------------|---------|--------------------------|
| Fallimento del recupero contesto | Media | Alto | Implementazione di fallback al prompt originale |
| Degradamento delle performance | Bassa | Medio | Monitoraggio continuo e ottimizzazione |
| Problemi di sicurezza | Bassa | Alto | Sanitizzazione dei dati e audit logging |
| Iniezione di contesto non rilevante | Media | Medio | Tuning dei parametri di similarità e feedback degli utenti |

### 6.2. Piani di Contingenza
- Possibilità di disabilitare temporaneamente l'iniezione di contesto in caso di problemi critici
- Rollback automatizzato in caso di degradamento delle performance
- Processo di escalation per la gestione di incidenti di sicurezza

## 7. SUCCESSO E VALUTAZIONE

### 7.1. Metriche di Successo
- Aumento della coerenza delle risposte AI (misurata tramite feedback degli utenti)
- Riduzione del numero di richieste di chiarimento
- Miglioramento del tempo medio per completare i task
- Riduzione dell'utilizzo di token (attraverso una migliore comprensione del contesto)

### 7.2. Processo di Valutazione
- Raccolta di metriche per un periodo di 30 giorni post-implementazione
- Confronto con i valori baseline
- Report di valutazione e raccomandazioni per ulteriori miglioramenti