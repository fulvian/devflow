# 🚀 CCR Fallback System - Quick Start Guide

## **🔄 Sistema di Fallback Automatico: Codex → Gemini CLI → Qwen3 (Synthetic)**

Il sistema CCR (Claude Code Router) Fallback implementa orchestrazione automatica tra agenti AI con preservazione del contesto e monitoring real-time.

---

## **⚡ Comandi Rapidi**

### **Avvio Sistema Completo**
```bash
# Avvia tutti i servizi DevFlow + CCR
./devflow-start.sh
```

### **Avvio Manuale Sessione CCR** 
```bash
# Equivalente a: npx @musistudio/claude-code-router code
./ccr-manual-start.sh
```

### **Gestione Servizi CCR**
```bash
# Gestisce: Codex MCP, CCR Manager, Monitoring, Metrics
./scripts/ccr-services.sh start
./scripts/ccr-services.sh stop
./scripts/ccr-services.sh status
./scripts/ccr-services.sh restart
```

---

## **🏗️ Architettura Sistema**

### **Servizi Background Automatici**
1. **Codex MCP Server**: `mcp-servers/codex/dist/index.js`
2. **Enhanced CCR Manager**: `packages/core/src/coordination/enhanced-ccr-fallback-manager.ts`
3. **Monitoring WebSocket Server**: `packages/core/src/monitoring/websocket-server.ts`
4. **Metrics Collector**: `packages/core/src/monitoring/metrics-collector.ts`

### **Fallback Chain**
```
Sonnet 5h Limit → Codex MCP → Gemini CLI → Qwen3 (Synthetic)
                     ↓             ↓              ↓
                Context Preserved → Error Recovery → Final Fallback
```

---

## **📊 Monitoring & Logs**

### **Real-time Monitoring**
- **Dashboard**: `http://localhost:3001/monitoring`
- **WebSocket Stream**: `ws://localhost:3001/ws`

### **Log Files**
```bash
# Servizi principali
tail -f logs/synthetic-server.log      # Synthetic MCP
tail -f logs/ccr-server.log           # Emergency CCR  
tail -f logs/ccr-services.log         # CCR Services Manager

# Servizi CCR specifici
tail -f logs/codex-mcp-server.log     # Codex MCP Server
tail -f logs/ccr-manager.log          # Enhanced CCR Manager
tail -f logs/monitoring-websocket.log  # Monitoring WebSocket
tail -f logs/metrics-collector.log    # Metrics Collector
```

---

## **🔧 Configurazione**

### **Variabili Ambiente Richieste**
```bash
SYNTHETIC_API_KEY=syn-xxx...          # Synthetic.new API
OPENAI_API_KEY=sk-xxx...              # OpenAI API (Codex)
OPENROUTER_API_KEY=sk-or-xxx...       # OpenRouter API
DEVFLOW_PROJECT_ROOT=/path/to/devflow
```

### **Configurazione CCR**
- **Config File**: `configs/ccr-config.json`
- **Fallback Chain**: `CCR_FALLBACK_CHAIN="codex,synthetic,gemini"`
- **Context Preservation**: `CCR_CONTEXT_PRESERVATION="true"`
- **Monitoring**: `CCR_MONITORING_ENABLED="true"`

---

## **🧪 Test & Validazione**

### **Test Servizi Individuali**
```bash
# Test Codex MCP Server
cd mcp-servers/codex && npm run dev

# Test Enhanced CCR Manager  
npx ts-node packages/core/src/coordination/enhanced-ccr-fallback-manager.ts

# Test Monitoring WebSocket
npx ts-node packages/core/src/monitoring/websocket-server.ts
```

### **Test Fallback Chain**
```bash
# Simula session limit per testare fallback
# (implementato in Enhanced CCR Manager)
```

---

## **⚠️ Troubleshooting**

### **Errori Comuni**

1. **"Codex MCP Server non attivo"**
   ```bash
   cd mcp-servers/codex
   npm install && npm run build
   ./scripts/ccr-services.sh start
   ```

2. **"CCR Services script not found"**
   ```bash
   chmod +x scripts/ccr-services.sh
   ```

3. **"Enhanced CCR Manager failed"**
   ```bash
   # Verifica variabili ambiente
   echo $OPENAI_API_KEY
   echo $OPENROUTER_API_KEY
   ```

### **Reset Completo**
```bash
# Stop tutto e riavvia
./devflow-stop.sh
pkill -f "ccr\|codex\|monitoring\|metrics" 2>/dev/null || true
./devflow-start.sh
```

---

## **📈 Metriche & Performance**

### **KPI Monitorati**
- **Agent Latency**: Codex, Gemini, Synthetic response times
- **Success Rate**: % successful requests per agent
- **Fallback Triggers**: Frequency of fallback activations  
- **Context Preservation**: % context retained across transitions
- **Error Rate**: % failed requests per agent

### **Thresholds**
- **Warning**: Error rate > 2%
- **Critical**: Error rate > 5%
- **Latency Alert**: Response time > 500ms

---

## **🚀 Workflow Tipico**

1. **Avvio Sistema**: `./devflow-start.sh`
2. **Verifica Servizi**: `./scripts/ccr-services.sh status`
3. **Sessione Normale**: `claude-code` (auto-fallback quando necessario)
4. **Sessione Manuale CCR**: `./ccr-manual-start.sh`
5. **Monitoring**: Browser → `http://localhost:3001/monitoring`
6. **Stop Sistema**: `./devflow-stop.sh`

---

**✅ Sistema pronto per produzione con fallback automatico e monitoring completo!**