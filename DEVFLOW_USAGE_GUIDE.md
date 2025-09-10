# DevFlow Claude Code Integration - Usage Guide

## 🚀 Quick Start

DevFlow è ora completamente integrato con Claude Code sessions! Segui questi passi per iniziare:

### 1. Setup Iniziale
```bash
# Installa le dipendenze
pnpm install

# Builda il progetto
pnpm build

# Setup DevFlow integration
pnpm devflow:setup

# Testa l'integrazione
pnpm devflow:test
```

### 2. Avvio DevFlow
```bash
# Avvia DevFlow MCP Server
pnpm devflow:start
```

### 3. Avvio Claude Code con DevFlow
```bash
# Avvia Claude Code (DevFlow si integra automaticamente)
claude-code
```

---

## 🛠️ Funzionalità Disponibili

### **MCP Tools Integrati**

DevFlow fornisce i seguenti tools MCP a Claude Code:

#### **1. `/devflow_search` - Ricerca Memoria**
```bash
/devflow_search "authentication patterns"
```
- Cerca nella memoria semantica di DevFlow
- Restituisce decisioni architetturali rilevanti
- Supporta filtri per tipo di blocco e soglia di similarità

#### **2. `/devflow_handoff` - Handoff Piattaforme**
```bash
/devflow_handoff codex "implement JWT authentication"
```
- Genera comandi di handoff per altre piattaforme
- Preserva decisioni architetturali
- Supporta: codex, synthetic, gemini, cursor

#### **3. `/devflow_memory_store` - Salvataggio Memoria**
```bash
/devflow_memory_store "Use microservices architecture for scalability"
```
- Salva decisioni importanti nella memoria semantica
- Classifica automaticamente per tipo e importanza
- Disponibile per ricerca futura

#### **4. `/devflow_context_inject` - Iniezione Contesto**
```bash
/devflow_context_inject task-123 session-456
```
- Inietta contesto rilevante nella sessione corrente
- Carica automaticamente decisioni architetturali precedenti
- Ottimizza per il task corrente

#### **5. `/devflow_analytics` - Analytics**
```bash
/devflow_analytics session
```
- Mostra metriche di performance
- Token usage e cost savings
- Success rate degli handoff

---

## 🔄 Funzionamento Automatico

### **Context Injection Automatico**
- **All'avvio sessione**: DevFlow carica automaticamente il contesto rilevante
- **Durante la sessione**: Monitora e cattura decisioni architetturali
- **Al termine**: Salva tutto nella memoria semantica

### **Memory Capture Automatico**
- **PostToolUse**: Cattura automaticamente decisioni importanti
- **Rilevamento intelligente**: Identifica decisioni architetturali e pattern di implementazione
- **Scoring automatico**: Assegna punteggi di importanza

### **Platform Handoff Intelligente**
- **Preservazione contesto**: Mantiene decisioni architetturali tra piattaforme
- **Ottimizzazione**: Adatta il contesto per ogni piattaforma target
- **Comandi generati**: Crea comandi di handoff pronti all'uso

---

## 📊 Monitoraggio e Analytics

### **Health Check**
```bash
# Verifica stato DevFlow
pnpm devflow:test
```

### **Metriche Disponibili**
- **Sessioni attive**: Numero di sessioni Claude Code con DevFlow
- **Blocchi memoria**: Decisioni architetturali salvate
- **Query ricerca**: Ricerche nella memoria semantica
- **Handoff eseguiti**: Success rate degli handoff
- **Token risparmiati**: Riduzione costi API

---

## ⚙️ Configurazione

### **File di Configurazione**
- **`.claude/settings.json`**: Configurazione principale DevFlow
- **`.env`**: Variabili ambiente per API keys
- **`.claude/hooks/devflow-integration.py`**: Hook Python per cc-sessions

### **Variabili Ambiente**
```bash
# DevFlow Configuration
DEVFLOW_ENABLED=true
DEVFLOW_DB_PATH=./devflow.sqlite
DEVFLOW_AUTO_INJECT=true
DEVFLOW_HANDOFF_ENABLED=true

# Platform API Keys
OPENAI_API_KEY=your-openai-key
SYNTHETIC_API_KEY=your-synthetic-key
GEMINI_API_KEY=your-gemini-key
```

### **Configurazione Piattaforme**
```json
{
  "devflow": {
    "platforms": {
      "claude_code": {
        "enabled": true,
        "specializations": ["architecture", "complex_reasoning", "system_design"]
      },
      "openai_codex": {
        "enabled": true,
        "specializations": ["implementation", "bulk_coding", "pattern_following"]
      }
    }
  }
}
```

---

## 🎯 Esempi di Utilizzo

### **Scenario 1: Nuovo Progetto**
```bash
# 1. Avvia Claude Code
claude-code

# 2. Crea nuovo task
# DevFlow automaticamente:
# - Rileva che è un nuovo task
# - Non trova contesto precedente
# - Monitora per nuove decisioni

# 3. Durante lo sviluppo
# DevFlow automaticamente:
# - Cattura decisioni architetturali
# - Salva pattern di implementazione
# - Mantiene memoria semantica
```

### **Scenario 2: Continuazione Progetto**
```bash
# 1. Avvia Claude Code
claude-code

# 2. Riprendi task esistente
# DevFlow automaticamente:
# - Carica contesto precedente
# - Inietta decisioni architetturali
# - Preserva continuità

# 3. Ricerca nella memoria
/devflow_search "authentication patterns"
# Restituisce decisioni precedenti e pattern
```

### **Scenario 3: Handoff Multi-Piattaforma**
```bash
# 1. Pianificazione architetturale (Claude Code)
# DevFlow cattura decisioni automaticamente

# 2. Handoff a Codex per implementazione
/devflow_handoff codex "implement JWT authentication"
# Genera comando con contesto preservato

# 3. Handoff a Synthetic per debugging
/devflow_handoff synthetic "debug authentication issues"
# Mantiene continuità architetturale
```

---

## 🔧 Troubleshooting

### **Problemi Comuni**

#### **DevFlow non si avvia**
```bash
# Verifica dipendenze
pnpm install

# Verifica build
pnpm build

# Testa integrazione
pnpm devflow:test
```

#### **Hook Python non funzionano**
```bash
# Verifica permessi
chmod +x .claude/hooks/devflow-integration.py

# Verifica Python
python3 --version

# Testa hook manualmente
echo '{"hook_event_name": "SessionStart", "task_name": "test"}' | python3 .claude/hooks/devflow-integration.py
```

#### **MCP Server non risponde**
```bash
# Verifica porta
netstat -an | grep 8000

# Riavvia MCP Server
pnpm devflow:start
```

### **Log e Debug**
```bash
# Abilita verbose mode
export DEVFLOW_VERBOSE=true

# Verifica log
tail -f .claude/logs/devflow.log
```

---

## 📈 Performance e Ottimizzazione

### **Target di Performance**
- **Context Injection**: <500ms
- **Memory Capture**: >95% success rate
- **Handoff Success**: >90% success rate
- **Token Reduction**: 30%+

### **Ottimizzazioni**
- **Database**: SQLite con WAL mode per performance
- **Vector Search**: Embedding ottimizzati per similarità
- **Context Compaction**: Rimozione ridondanze automatica
- **Caching**: Cache intelligente per query frequenti

---

## 🎉 Risultati Attesi

Con DevFlow completamente integrato, otterrai:

✅ **Zero Amnesia Digitale**: Memoria persistente tra sessioni  
✅ **Context Automatico**: Iniezione automatica del contesto rilevante  
✅ **Handoff Intelligente**: Passaggio seamless tra piattaforme  
✅ **Token Optimization**: Riduzione del 30%+ dei token usage  
✅ **Architectural Consistency**: Zero drift architetturale  
✅ **Development Velocity**: 40%+ aumento velocità sviluppo  

**DevFlow è ora un vero Universal Development State Manager!** 🚀
