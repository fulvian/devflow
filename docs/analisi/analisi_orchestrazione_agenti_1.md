# Analisi del Sistema di Orchestrazione di Claude Code

## 1. Architettura di Orchestrazione Principale

Il sistema DevFlow implementa un framework di orchestrazione multi-agente sofisticato con Claude Code (Sonnet) come orchestratore principale. Il sistema è progettato con una gerarchia di delega rigorosa:

**Catena di Delega Primaria:** Sonnet (90% di utilizzo) → Codex → Gemini → Synthetic

## 2. Classificazione degli Agenti e Routing

Il sistema utilizza l'`AgentClassificationEngine` che instrada intelligentemente i compiti basandosi su:
- Tipo di compito e complessità
- Capacità degli agenti
- Modelli di utilizzo e limiti
- Monitoraggio della durata della sessione

## 3. Regole che Governano l'Orchestrazione

### Regole Prescrittive per Claude Code:
1. **Regola Obbligatoria per Compiti di Codifica**: Tutti i compiti di codifica (CODE_GENERATION, CODE_REVIEW) DEVONO essere gestiti esclusivamente da agenti Synthetic
2. **Applicazione del Limite di Sessione**: L'utilizzo di Sonnet è limitato al 90% per prevenire blocchi di sessione
3. **Durata Massima della Sessione**: Limite di 5 ore per sessione (18.000.000 ms)
4. **Protezione del Limite di Token**: Limite di 100.000 token per Sonnet per prevenire blocchi di sessione
5. **Prevenzione delle Violazioni CCR**: Blocco esplicito delle richieste di ragionamento cross-context

### Regole Interpretative:
1. **Routing per Tipo di Compito**:
   - ARCHITECTURE, TECH_LEAD, SYSTEM_DESIGN → Sonnet (primario)
   - Compiti DEBUG → Gemini (agente secondario)
   - Compiti TEST → Codex (agente secondario)
   - Compiti BASH → Synthetic (agente secondario)

2. **Meccanismi di Fallback**:
   - Monitoraggio dello stato di salute di tutti gli agenti
   - Protezione con interruttore magnetotermico (circuit breaker)
   - Limitazione della frequenza per agenti Synthetic
   - Protocolli di handoff di emergenza

## 4. Agenti Coinvolti

1. **Sonnet (Claude Code)**: Orchestratore principale e tech lead per decisioni architetturali
2. **Codex (OpenAI)**: Sviluppatore senior per compiti di implementazione
3. **Gemini**: Responsabile della documentazione e specialista del debugging
4. **Synthetic**: Specialista QA e gestore di compiti di routine
5. **Qwen**: Agente CLI aggiuntivo per compiti specializzati

## 5. Flusso di Orchestrazione

1. **Classificazione del Compito**: Ogni compito viene analizzato e classificato dal sistema cognitivo
2. **Assegnazione dell'Agente**: Basata sul tipo di compito e sulle metriche di utilizzo correnti
3. **Monitoraggio dello Stato di Salute**: Monitoraggio continuo dello stato di salute e delle prestazioni degli agenti
4. **Gestione del Fallback**: Handoff automatico quando gli agenti falliscono o raggiungono i limiti
5. **Conservazione del Contesto**: Conservazione completa del contesto durante gli handoff
6. **Monitoraggio del Progresso**: Monitoraggio continuo del progresso del compito e dell'utilizzo dei token

## 6. Gestione delle Sessioni e Limiti

Il sistema implementa un rilevamento proattivo dei limiti di sessione con soglie:
- **Livello di Avviso**: 70% di utilizzo
- **Livello Critico**: 85% di utilizzo
- **Livello di Emergenza**: 95% di utilizzo

Quando si avvicinano i limiti, il sistema attiva:
1. Compressione proattiva al livello di avviso
2. Compressione aggressiva al livello critico
3. Handoff di emergenza al livello di emergenza

## 7. Meccanismi di Handoff

Il sistema implementa un handoff senza soluzione di continuità tra le piattaforme utilizzando:
1. **Conservazione del Contesto**: Conservazione completa dei blocchi di memoria e dello stato della sessione
2. **Engine di Handoff della Piattaforma**: Genera comandi appropriati per ogni piattaforma target
3. **Gestore del Fallback CCR**: Gestisce il fallback automatico al Claude Code Router quando necessario

## 8. Orchestratore Dream Team

L'orchestratore "Dream Team" fornisce esecuzione parallela su più agenti:
- **Codex**: Specialista dell'implementazione
- **Gemini**: Documentazione e analisi
- **Qwen**: QA e validazione

Questo sistema esegue compiti in parallelo su tutte le piattaforme selezionate e aggrega i risultati.

## 9. Perché Altri Agenti Potrebbero Non Essere Operativi

Basandosi sull'analisi del codice, ci potrebbero essere diverse ragioni per cui altri agenti non vengono chiamati:

1. **Limitazione della Frequenza Synthetic**: Il sistema implementa una limitazione della frequenza per gli agenti Synthetic, che potrebbe impedirne l'attivazione
2. **Monitoraggio dello Stato di Salute**: Se gli agenti sono contrassegnati come non salubri, il sistema non instraderà loro compiti
3. **Protezione del Circuit Breaker**: Gli agenti con circuit breaker aperti non riceveranno compiti
4. **Problemi di Configurazione**: Chiavi API mancanti o configurazione errata potrebbero impedire l'attivazione degli agenti
5. **Classificazione dei Compiti**: I compiti potrebbero essere classificati in modo da mantenerli all'interno del dominio di Sonnet

## 10. Meccanismi di Enforcement

Il sistema ha meccanismi di enforcement rigorosi:
- **Whitelisting degli Strumenti MCP**: Solo gli strumenti autorizzati sono consentiti
- **Enforcement della Modalità DAIC**: Blocca le operazioni di scrittura in modalità discussione
- **Rilevamento delle Violazioni CCR**: Previene i tentativi di ragionamento cross-context
- **Monitoraggio dell'Utilizzo**: Traccia l'utilizzo dei token e la durata della sessione

Questo sistema di orchestrazione completo garantisce che Claude Code agisca come il direttore d'orchestra intelligente di un ensemble multi-agente, con regole rigorose che governano quando e come gli altri agenti vengono coinvolti, e meccanismi di fallback robusti per mantenere il funzionamento del sistema anche quando singoli agenti falliscono o raggiungono i loro limiti.