# CCR Session Independence - Setup & Troubleshooting Guide

## 🎯 Overview

CCR (Claude Code Router) Session Independence è la soluzione per risolvere il problema critico di usabilità di DevFlow quando Claude Code raggiunge i limiti di sessione. Questa implementazione fornisce:

- **Automatic Fallback**: Transizione automatica a Codex/Synthetic quando Claude Code raggiunge i limiti
- **Context Preservation**: Preservazione completa del contesto durante il handoff
- **Proactive Monitoring**: Monitoraggio proattivo con soglie intelligenti
- **Zero Downtime**: Continuità operativa garantita

## 🚀 Quick Setup

### 1. Installazione CCR

```bash
# Installa Claude Code Router globalmente
npm install -g @musistudio/claude-code-router

# Verifica installazione
ccr --version
```

### 2. Configurazione Environment Variables

```bash
# Aggiungi al tuo .env
export OPENAI_API_KEY="your-openai-api-key"
export OPENROUTER_API_KEY="your-openrouter-api-key"
export DEVFLOW_CCR_ENABLED="true"
export DEVFLOW_CCR_CONFIG_PATH="./configs/ccr-config.json"
```

### 3. Configurazione CCR

Il file `configs/ccr-config.json` contiene la configurazione completa:

```json
{
  "log": true,
  "NON_INTERACTIVE_MODE": true,
  "OPENAI_API_KEY": "${OPENAI_API_KEY}",
  "OPENROUTER_API_KEY": "${OPENROUTER_API_KEY}",
  "router": {
    "default": "claude-3-5-sonnet-20241022",
    "codex": "gpt-4o",
    "synthetic": "claude-3-5-sonnet-20241022",
    "longContext": "claude-3-5-sonnet-20241022"
  },
  "fallback": {
    "enabled": true,
    "chain": ["claude_code", "codex", "synthetic", "gemini"],
    "timeout": 30000,
    "retryAttempts": 3
  }
}
```

### 4. Avvio CCR con DevFlow

```bash
# Avvia CCR in background
ccr --config ./configs/ccr-config.json --daemon &

# Verifica che CCR sia attivo
ps aux | grep ccr
```

## 🔧 Troubleshooting

### Problema: CCR non si avvia

**Sintomi:**
- Errore "ccr: command not found"
- CCR si chiude immediatamente dopo l'avvio

**Soluzioni:**
1. **Verifica installazione:**
   ```bash
   npm list -g @musistudio/claude-code-router
   ```

2. **Reinstalla se necessario:**
   ```bash
   npm uninstall -g @musistudio/claude-code-router
   npm install -g @musistudio/claude-code-router
   ```

3. **Verifica permessi:**
   ```bash
   chmod +x $(which ccr)
   ```

### Problema: API Keys non riconosciute

**Sintomi:**
- Errore "Invalid API key"
- CCR non riesce a connettersi ai servizi

**Soluzioni:**
1. **Verifica environment variables:**
   ```bash
   echo $OPENAI_API_KEY
   echo $OPENROUTER_API_KEY
   ```

2. **Testa API keys:**
   ```bash
   curl -H "Authorization: Bearer $OPENAI_API_KEY" \
        https://api.openai.com/v1/models
   ```

3. **Aggiorna configurazione:**
   ```json
   {
     "OPENAI_API_KEY": "sk-your-actual-key-here",
     "OPENROUTER_API_KEY": "sk-or-your-actual-key-here"
   }
   ```

### Problema: Fallback non funziona

**Sintomi:**
- DevFlow si blocca quando Claude Code raggiunge i limiti
- Nessuna transizione automatica a Codex/Synthetic

**Soluzioni:**
1. **Verifica configurazione fallback:**
   ```json
   {
     "fallback": {
       "enabled": true,
       "chain": ["claude_code", "codex", "synthetic"],
       "timeout": 30000
     }
   }
   ```

2. **Testa fallback manualmente:**
   ```bash
   # Simula limite raggiunto
   export DEVFLOW_SIMULATE_LIMIT="true"
   # Riavvia DevFlow
   ```

3. **Verifica log CCR:**
   ```bash
   tail -f /var/log/ccr.log
   ```

### Problema: Context Loss durante Handoff

**Sintomi:**
- Perdita di informazioni durante la transizione
- Task interrotti o dati mancanti

**Soluzioni:**
1. **Verifica Context Preservation:**
   ```typescript
   const preservation = new ContextPreservation(memoryManager);
   const context = await preservation.preserveContext(taskId, sessionId);
   console.log('Context preserved:', context.contextSize);
   ```

2. **Controlla memoria SQLite:**
   ```bash
   sqlite3 packages/core/devflow.sqlite \
     "SELECT COUNT(*) FROM memory_blocks WHERE type = 'emergency_context';"
   ```

3. **Abilita debug mode:**
   ```json
   {
     "log": true,
     "debug": true,
     "contextPreservation": {
       "enableCompression": true,
       "maxContextSize": 200000
     }
   }
   ```

### Problema: Performance Degradation

**Sintomi:**
- Lentezza durante il handoff
- Timeout frequenti

**Soluzioni:**
1. **Ottimizza timeout:**
   ```json
   {
     "fallback": {
       "timeout": 60000,
       "retryAttempts": 2
     }
   }
   ```

2. **Abilita compressione:**
   ```json
   {
     "transformers": [{
       "path": "./packages/core/src/coordination/ccr-transformers/devflow-context-transformer.js",
       "options": {
         "compressContext": true,
         "maxContextSize": 150000
       }
     }]
   }
   ```

3. **Monitora performance:**
   ```bash
   # Monitora CPU e memoria
   top -p $(pgrep ccr)
   ```

## 📊 Monitoring & Metrics

### Health Check Endpoint

```bash
# Verifica stato CCR
curl http://localhost:8080/health

# Risposta attesa:
{
  "status": "healthy",
  "activeSessions": 3,
  "fallbackChain": ["claude_code", "codex", "synthetic"],
  "lastHandoff": "2025-01-27T10:30:00Z"
}
```

### Log Analysis

```bash
# Monitora log in tempo reale
tail -f /var/log/ccr.log | grep -E "(FALLBACK|HANDOFF|ERROR)"

# Analizza pattern di fallback
grep "FALLBACK_TRIGGERED" /var/log/ccr.log | wc -l
```

### Performance Metrics

```bash
# Statistiche handoff
sqlite3 packages/core/devflow.sqlite \
  "SELECT platform, COUNT(*) as handoffs, AVG(context_size) as avg_context 
   FROM session_handoffs 
   WHERE timestamp > datetime('now', '-24 hours') 
   GROUP BY platform;"
```

## 🔄 Maintenance

### Backup Configuration

```bash
# Backup configurazione CCR
cp configs/ccr-config.json configs/ccr-config.backup.$(date +%Y%m%d).json

# Backup database memoria
cp packages/core/devflow.sqlite packages/core/devflow.backup.$(date +%Y%m%d).sqlite
```

### Update CCR

```bash
# Aggiorna CCR alla versione più recente
npm update -g @musistudio/claude-code-router

# Verifica versione
ccr --version
```

### Cleanup

```bash
# Pulisci log vecchi
find /var/log -name "ccr*.log" -mtime +7 -delete

# Pulisci database
sqlite3 packages/core/devflow.sqlite \
  "DELETE FROM memory_blocks WHERE timestamp < datetime('now', '-30 days');"
```

## 🆘 Emergency Procedures

### Disable CCR Temporarily

```bash
# Ferma CCR
pkill -f ccr

# Disabilita fallback
export DEVFLOW_CCR_ENABLED="false"

# Riavvia DevFlow
```

### Manual Context Recovery

```bash
# Recupera contesto di emergenza
sqlite3 packages/core/devflow.sqlite \
  "SELECT content FROM memory_blocks 
   WHERE type = 'emergency_context' 
   ORDER BY timestamp DESC LIMIT 1;"
```

### Full Reset

```bash
# Reset completo CCR
pkill -f ccr
rm -rf /tmp/ccr-*
rm -f configs/ccr-config.json
npm uninstall -g @musistudio/claude-code-router
npm install -g @musistudio/claude-code-router
```

## 📞 Support

Per problemi non risolti:

1. **Controlla log completi:**
   ```bash
   journalctl -u ccr -n 100
   ```

2. **Raccogli informazioni sistema:**
   ```bash
   ccr --version
   node --version
   npm --version
   ```

3. **Crea issue su GitHub** con:
   - Log completi
   - Configurazione (senza API keys)
   - Descrizione problema
   - Steps per riprodurre

---

**Ultimo aggiornamento:** 2025-01-27  
**Versione CCR:** 1.0.0  
**Compatibilità DevFlow:** >= 0.1.0
