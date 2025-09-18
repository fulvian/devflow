# GEMINI CLI INTEGRATION - DEBUG REPORT

## PROBLEMA IDENTIFICATO
**Status**: CRITICO - Gemini CLI authentication failure persistente
**Impact**: 33% platform availability loss nel Real Dream Team Orchestrator
**Data**: 2025-09-18 15:01

## SINTOMI
- Gemini CLI restituisce errore: "The configured auth type is oauth-personal, but the current auth type is undefined"
- L'autenticazione sembra essere effimera/instabile
- Il comando `gemini` mostra prompt di autenticazione per frazione di secondo ma non risolve il problema
- DevFlow wrapper `tools/cli/devflow-gemini.mjs` fallisce consistentemente con exit code 2

## TENTATIVI DI RISOLUZIONE ESPERITI

### 1. Verifica Installazione e Configurazione
```bash
which gemini                    # ✅ /opt/homebrew/bin/gemini
gemini --help                  # ✅ Comando disponibile e funzionante
ls -la ~/.config/gemini        # ✅ Directory config presente
```

**Risultato**: Gemini CLI correttamente installato e configurazione directory presente

### 2. Analisi File di Configurazione
```bash
ls -la ~/.config/gemini/
# File presenti:
# - oauth_creds.json (1801 bytes)
# - settings.json (2345 bytes)
# - google_account_id, google_accounts.json, installation_id
```

**Risultato**: File di configurazione presenti ma problema con oauth_creds.json

### 3. Test Autenticazione Diretta
```bash
echo "quit" | gemini
# Risultato: Stesso errore oauth-personal vs undefined
```

**Risultato**: Problema persistente anche in modalità interattiva

### 4. Implementazione Error Handling nel Wrapper
**File**: `tools/cli/devflow-gemini.mjs:45-51`
```javascript
// Check for authentication errors and provide helpful message
if (res.stderr && res.stderr.includes('re-authenticate with the correct type')) {
  console.error('[gemini-cli] Authentication Error: Gemini CLI requires re-authentication.');
  console.error('[gemini-cli] Please run: gemini');
  console.error('[gemini-cli] Then follow the authentication prompts.');
  console.error('[gemini-cli] DevFlow will continue with Codex and Qwen platforms.');
  process.exit(2); // Special exit code for auth errors
}
```

**Risultato**: Error handling implementato, sistema continua con altre piattaforme

### 5. Test --prompt Flag Implementation
**Approccio**: Utilizzo `--prompt` flag per modalità non-interattiva secondo Gemini CLI docs
```javascript
const args = [...GEMINI_CLI_ARGS, '--prompt', input];
```

**Risultato**: Sintassi corretta ma problema oauth sottostante persiste

### 6. Verifica OAuth Flow
**Comando testato dall'utente**: `gemini` (riavvio manuale)
**Risultato riferito**: "l'auth viene presa automaticamente (appare una frazione di secondo nella casella del prompt)"

### 7. Tentativi di Debug Avanzato Post-Report (2025-09-18)

#### 7.1 Reset Credenziali OAuth
- **Azione**: Rimozione forzata di `~/.config/gemini/oauth_creds.json` per resettare il login.
- **Risultato**: ❌ Fallito. Il file non è stato trovato, indicando che il problema non era un file corrotto.

#### 7.2 Passaggio ad Autenticazione tramite API Key
- **Azione**: Abbandono di OAuth in favore di una API Key, metodo più robusto per l'uso non interattivo.
- **Passo 1**: Consultata la documentazione ufficiale (`context7`) per verificare la procedura.
- **Passo 2**: Creato il file `~/.gemini/.env` con la `GEMINI_API_KEY` fornita dall'utente.
- **Risultato**: ❌ Fallimento. Lo script ha continuato a restituire lo stesso errore di autenticazione, ignorando la API Key.

#### 7.3 Rigenerazione e Verifica della API Key
- **Azione**: L'utente ha generato una nuova API Key e aggiornato il file `.env` per escludere problemi legati a una chiave invalida.
- **Risultato**: ❌ Fallimento. Nessun cambiamento, l'errore di autenticazione persiste.

#### 7.4 Forzatura della API Key tramite Variabile d'Ambiente Diretta
- **Azione**: Esecuzione dello script forzando la API Key sulla stessa riga del comando, per garantire la massima priorità e bypassare eventuali altre credenziali come le Application Default Credentials (ADC).
- **Comando di test**: `GEMINI_API_KEY="..." node tools/cli/devflow-gemini.mjs "..."`
- **Risultato**: ❌ Fallimento. L'errore di autenticazione persiste anche con questo metodo, che dovrebbe avere la precedenza su ogni altra configurazione.

## ANALISI TECNICA (AGGIORNATA)

### Root Cause Hypothesis
1. <del>OAuth Token Expiration</del>: Irrilevante dopo i tentativi con API Key.
2. <del>Configuration Mismatch</del>: I file di configurazione `oauth_creds.json` e `settings.json` non sono presenti, quindi non dovrebbero causare conflitti.
3. **Conflitto con Credenziali Nascoste (ADC)**: L'ipotesi principale era che le Application Default Credentials (ADC) di `gcloud` interferissero. Tuttavia, anche forzando la API Key con una variabile d'ambiente diretta (che dovrebbe avere priorità assoluta), il problema non si è risolto.
4. **Bug Interno di `gemini-cli`**: A questo punto, con tutti i metodi di autenticazione standard che falliscono in modo anomalo, l'ipotesi più plausibile è un bug interno al `gemini-cli` stesso, che gestisce in modo errato la priorità delle credenziali o l'inizializzazione in ambienti non interattivi su macOS.
5. **Problema di Ambiente Shell/Node.js**: Esiste una remota possibilità che l'ambiente di esecuzione dello script `node` non erediti correttamente le variabili d'ambiente o abbia permessi tali da non poter accedere alle risorse necessarie, anche se i test effettuati rendono questa ipotesi meno probabile.

### Impact Assessment
- **Orchestrator Status**: 66.67% platform availability
- **Fallback Mechanism**: ✅ Sistema continua con Codex + Qwen
- **Production Impact**: ⚠️ Ridotta redundancy ma sistema operativo

## CURRENT WORKAROUND IMPLEMENTATO
- Real Dream Team Orchestrator gestisce gracefully il fallimento Gemini.
- Il wrapper `devflow-gemini.mjs` intercetta l'errore di autenticazione (exit code 2) e permette al sistema di procedere.

## RACCOMANDAZIONI PER IL DEBUG TEAM

### Priority 1: Isolare l'Ambiente
- **Azione**: Testare `gemini-cli` in un ambiente completamente pulito e isolato (es. un container Docker `node:latest`) senza alcuna configurazione Google Cloud o `gcloud` pregressa.
- **Setup**:
  1. Installare `gemini-cli` nel container.
  2. Impostare la `GEMINI_API_KEY` come variabile d'ambiente.
  3. Eseguire un comando base: `gemini --prompt "test"`
- **Obiettivo**: Determinare se il problema è legato all'ambiente specifico della macchina di sviluppo o se è un bug riproducibile universalmente.

### Priority 2: Debug Verboso del CLI
- **Azione**: Provare a eseguire il comando con tutti i flag di debug possibili per ottenere più informazioni.
- **Comando**: `DEBUG=1 GEMINI_API_KEY="..." node tools/cli/devflow-gemini.mjs "test"` (lo script `devflow-gemini.mjs` passa già il flag `--debug` se `DEBUG` è impostato).

### Priority 3: Escalation
- **Azione**: Se il test in ambiente isolato fallisce, aprire un'issue sul repository GitHub di `gemini-cli` (`https://github.com/google-gemini/gemini-cli/issues`).
- **Contenuto**: Allegare questo report di debug completo, che documenta tutti i tentativi falliti e le ipotesi.

## STATUS SISTEMA POST-DEBUGGING
- Real Dream Team Orchestrator: ✅ OPERATIONAL
- Codex Platform: ✅ 100% success rate
- Qwen Platform: ✅ 100% success rate
- Gemini Platform: ❌ **0% success rate (auth failure)** - Problema bloccante non risolto.

## NEXT STEPS
1. **Eseguire il test in ambiente isolato (Docker)** come da raccomandazione `Priority 1`.
2. Se il problema persiste, procedere con l'escalation e l'apertura di una issue su GitHub.
3. Nel frattempo, mantenere la piattaforma Gemini disabilitata o gestita dal meccanismo di fallback per non impattare la stabilità del sistema.

---
**Report generato**: 2025-09-18 15:01
**Report aggiornato**: 2025-09-18 16:30
**Sistema**: DevFlow Cometa v3.1 - Real Dream Team Orchestrator
**Responsabile**: Claude Code Integration Team & Gemini Assistant

**Report generato**: 2025-09-18 15:01
**Sistema**: DevFlow Cometa v3.1 - Real Dream Team Orchestrator
**Responsabile**: Claude Code Integration Team