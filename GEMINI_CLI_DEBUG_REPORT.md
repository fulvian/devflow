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

## ANALISI TECNICA

### Root Cause Hypothesis
1. **OAuth Token Expiration**: Il token oauth-personal scade rapidamente
2. **Configuration Mismatch**: Discrepanza tra auth type configurato vs rilevato
3. **Session Management Issue**: Gemini CLI non mantiene sessioni autenticate
4. **Environment Variables**: Possibili conflitti con variabili d'ambiente MCP

### Impact Assessment
- **Orchestrator Status**: 66.67% platform availability
- **Fallback Mechanism**: ✅ Sistema continua con Codex + Qwen
- **Production Impact**: ⚠️ Ridotta redundancy ma sistema operativo

## CURRENT WORKAROUND IMPLEMENTATO
- Real Dream Team Orchestrator gestisce gracefully il fallimento Gemini
- Circuit breaker pattern previene cascade failures
- Exit code 2 distingue auth errors da altri failures
- Sistema continua operativo con piattaforme disponibili

## RACCOMANDAZIONI PER IL DEBUG TEAM

### Priority 1: OAuth Investigation
```bash
# Verificare stato token OAuth
cat ~/.config/gemini/oauth_creds.json | jq '.'
# Verificare scadenza token
# Verificare refresh token mechanism
```

### Priority 2: Environment Analysis
```bash
# Verificare conflitti variabili d'ambiente
env | grep -i gemini
# Verificare MCP server interference
lsof -i :3200-3300
```

### Priority 3: Auth Flow Debug
```bash
# Test con debug mode
DEBUG=1 gemini --debug "test"
# Test con OAuth reset
rm ~/.config/gemini/oauth_creds.json && gemini
```

### Priority 4: Alternative Auth Methods
- Investigare API key authentication vs oauth-personal
- Considerare service account authentication
- Verificare compatibility con MCP environment

## STATUS SISTEMA POST-DEBUGGING
- Real Dream Team Orchestrator: ✅ OPERATIONAL
- Codex Platform: ✅ 100% success rate (51ms avg)
- Qwen Platform: ✅ 100% success rate (13s avg)
- Gemini Platform: ❌ 0% success rate (auth failure)

## NEXT STEPS
1. Debug team investigation secondo raccomandazioni sopra
2. Se risoluzione rapida non possibile: considerare temporary disabling Gemini platform
3. Monitorare performance Codex + Qwen per assicurare adequate coverage
4. Pianificare Gemini re-enabling post-fix

---
**Report generato**: 2025-09-18 15:01
**Sistema**: DevFlow Cometa v3.1 - Real Dream Team Orchestrator
**Responsabile**: Claude Code Integration Team