# DevFlow Complete Startup Scripts

## 🚀 Script di Avvio Completo

Gli script `start-devflow-complete.sh` e `stop-devflow-complete.sh` gestiscono l'avvio e l'arresto completo di tutti i servizi DevFlow con verifica dell'autoswitch CCR.

## 📋 Funzionalità

### Script di Avvio (`start-devflow-complete.sh`)

#### ✅ **Cleanup Automatico**
- Termina processi esistenti su porta 3000 (MCP Synthetic)
- Termina processi Claude Code Router e DevFlow Startup
- Pulisce file PID e log precedenti

#### ✅ **Verifica Dipendenze**
- Controlla presenza di Node.js, npm, npx
- Verifica file di configurazione CCR e Claude Code
- Valida struttura del progetto

#### ✅ **Avvio Servizi in Background**
- **MCP Synthetic Server**: Avvia su porta 3000 con health check
- **Claude Code Router**: Rileva se già attivo o avvia nuovo processo
- **DevFlow Startup**: Processo principale di coordinamento

#### ✅ **Verifica Autoswitch CCR**
- Controlla configurazione soglie (Warning: 0.7, Critical: 0.85, Emergency: 0.95)
- Verifica abilitazione fallback
- Testa routing automatico a Synthetic

#### ✅ **Gestione Processi**
- Crea directory `logs/` e `pids/`
- Salva PID di tutti i processi per gestione
- Log dettagliati per debugging

### Script di Stop (`stop-devflow-complete.sh`)

#### ✅ **Stop Pulito**
- Termina processi usando file PID
- Termina processi su porte specifiche
- Termina processi per nome pattern
- Cleanup completo file temporanei

#### ✅ **Verifica Stato**
- Controlla stato di tutti i servizi
- Report dettagliato servizi attivi/non attivi
- Opzione `--status` per solo verifica

## 🎯 Utilizzo

### Avvio Completo
```bash
# Avvio completo con cleanup e test
./start-devflow-complete.sh

# Salta cleanup (se servizi già attivi)
./start-devflow-complete.sh --skip-cleanup

# Salta test autoswitch (per avvio veloce)
./start-devflow-complete.sh --skip-test

# Solo verifica dipendenze e configurazione
./start-devflow-complete.sh --skip-cleanup --skip-test
```

### Stop Completo
```bash
# Stop completo di tutti i servizi
./stop-devflow-complete.sh

# Solo verifica stato senza fermare
./stop-devflow-complete.sh --status
```

### Test Autoswitch CCR
```bash
# Test completo autoswitch CCR
./test-ccr-autoswitch.sh
```

## 🔧 Configurazione

### File di Configurazione
- **CCR**: `configs/ccr-config.json`
- **Claude Code**: `~/.claude-code/config.json`
- **Environment**: `.env` (SYNTHETIC_API_KEY)

### Porte Utilizzate
- **MCP Synthetic Server**: 3000
- **Claude Code Router**: Processo in background

### Directory
- **Logs**: `logs/` (devflow-startup.log, claude-code-router.log)
- **PID**: `pids/` (devflow-startup.pid, claude-code-router.pid)

## 🧪 Verifica Autoswitch CCR

### Soglie Configurate
- **Warning**: 70% usage → Avviso
- **Critical**: 85% usage → Switch a Synthetic
- **Emergency**: 95% usage → Switch forzato

### Modelli Synthetic
- **Primario**: `hf:Qwen/Qwen3-Coder-480B-A35B-Instruct`
- **Fallback**: `hf:Qwen/Qwen2.5-Coder-32B-Instruct`
- **Ragionamento**: `hf:deepseek-ai/DeepSeek-V3`

### Test di Verifica
Il test invia un prompt molto lungo (>20K caratteri) per triggerare l'autoswitch e verifica che:
1. La risposta contenga indicazioni di routing
2. Il modello utilizzato sia Synthetic (Qwen/DeepSeek)
3. Il fallback funzioni correttamente

## 📊 Output di Esempio

### Avvio Riuscito
```
🚀 DevFlow Complete Startup Script
=====================================

[18:36:05] 🧹 Avvio cleanup completo...
✅ Cleanup completato

[18:36:05] 🔍 Verificando dipendenze...
✅ Tutte le dipendenze sono disponibili

[18:36:05] 🚀 Avviando CTIR Server...
✅ CTIR Server avviato (PID: 9875)

[18:36:05] 🔍 Avviando CTIR Analyzer...
✅ CTIR Analyzer avviato (PID: 9878)

[18:36:05] 🎯 Avviando Claude Code Router...
✅ Claude Code Router già in esecuzione (PID: 2171)

[18:36:05] 🔍 Verificando configurazione autoswitch CCR...
✅ Autoswitch CCR configurato correttamente

✅ 🚀 DevFlow completamente avviato!
ℹ️  Puoi ora utilizzare Claude Code con autoswitch CCR automatico
```

### Test Autoswitch
```
🧪 Test Autoswitch CCR
======================

[18:36:33] 🔍 Testando configurazione CCR...
✅ Configurazione CCR valida

[18:36:33] 🔍 Testando servizi...
✅ Tutti i servizi sono attivi

[18:36:33] 🧪 Testando autoswitch CCR...
✅ Autoswitch CCR funzionante - routing rilevato nella risposta
✅ Modello Qwen rilevato - autoswitch a Synthetic funzionante

🎉 TUTTI I TEST SUPERATI!
```

## 🚨 Troubleshooting

### Problemi Comuni

#### 1. **Porta già in uso**
```bash
# Verifica processi su porta
lsof -ti:3456
lsof -ti:3001

# Termina manualmente
kill -9 $(lsof -ti:3456)
```

#### 2. **Claude Code Router non si avvia**
```bash
# Verifica log
tail -f logs/claude-code-router.log

# Riavvia manualmente
npx @musistudio/claude-code-router start
```

#### 3. **Autoswitch non funziona**
```bash
# Verifica configurazione CCR
jq '.devflow.sessionManagement' configs/ccr-config.json

# Test manuale
echo "Test" | npx @musistudio/claude-code-router
```

#### 4. **MCP Synthetic non risponde**
```bash
# Verifica API key
echo $SYNTHETIC_API_KEY

# Test API
curl -H "Authorization: Bearer $SYNTHETIC_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"hf:Qwen/Qwen3-Coder-480B-A35B-Instruct","messages":[{"role":"user","content":"Test"}]}' \
     https://api.synthetic.new/v1/chat/completions
```

## 🔄 Workflow Completo

1. **Avvio**: `./start-devflow-complete.sh`
2. **Verifica**: `./stop-devflow-complete.sh --status`
3. **Test**: `./test-ccr-autoswitch.sh`
4. **Stop**: `./stop-devflow-complete.sh`

## 📝 Note Tecniche

- Gli script utilizzano `nohup` per processi in background
- Gestione segnali SIGINT/SIGTERM per cleanup automatico
- Timeout configurabili per health check
- Log dettagliati per debugging
- Gestione PID per stop pulito
- Verifica dipendenze prima dell'avvio
- Test automatico autoswitch CCR

## 🎯 Risultato Atteso

Dopo l'esecuzione degli script, Claude Code dovrebbe:
- ✅ Utilizzare CTIR per routing intelligente
- ✅ Switch automatico a Synthetic quando necessario
- ✅ Fallback robusto tra modelli
- ✅ Gestione completa del contesto
- ✅ Persistenza memoria DevFlow
- ✅ Monitoraggio usage e costi
