#!/bin/bash

# CCR Manual Start Script
# Avvio manuale di Claude Code sotto CCR (Claude Code Router)
# Equivalente al comando: npx @musistudio/claude-code-router code

set -e

# Colori per output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 DevFlow CCR Manual Start${NC}"
echo -e "${BLUE}================================${NC}"

# Verifica prerequisiti
echo -e "${YELLOW}📋 Verificando prerequisiti...${NC}"

# Verifica variabili ambiente
if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${RED}❌ OPENAI_API_KEY non configurata${NC}"
    exit 1
fi

if [ -z "$OPENROUTER_API_KEY" ]; then
    echo -e "${RED}❌ OPENROUTER_API_KEY non configurata${NC}"
    exit 1
fi

if [ -z "$SYNTHETIC_API_KEY" ]; then
    echo -e "${RED}❌ SYNTHETIC_API_KEY non configurata${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Variabili ambiente configurate${NC}"

# Verifica servizi DevFlow attivi
echo -e "${YELLOW}🔍 Verificando servizi DevFlow...${NC}"

# Controlla se Synthetic MCP è attivo
if ! pgrep -f "synthetic.*mcp" > /dev/null; then
    echo -e "${RED}❌ Synthetic MCP Server non attivo${NC}"
    echo -e "${YELLOW}💡 Avvia prima devflow-start.sh${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Servizi DevFlow attivi${NC}"

# Avvia Codex MCP Server se necessario
echo -e "${YELLOW}🚀 Avviando Codex MCP Server...${NC}"
if ! pgrep -f "codex.*mcp" > /dev/null; then
    cd mcp-servers/codex
    npm run build > /dev/null 2>&1
    nohup npm start > ../../logs/codex-mcp.log 2>&1 &
    echo $! >> ../../.devflow_pids
    cd ../..
    echo -e "${GREEN}✅ Codex MCP Server avviato${NC}"
else
    echo -e "${GREEN}✅ Codex MCP Server già attivo${NC}"
fi

# Avvia Enhanced CCR Manager
echo -e "${YELLOW}🧠 Avviando Enhanced CCR Manager...${NC}"
if ! pgrep -f "enhanced-ccr-fallback-manager" > /dev/null; then
    nohup npx ts-node packages/core/src/coordination/enhanced-ccr-fallback-manager.ts > logs/ccr-manager.log 2>&1 &
    echo $! >> .devflow_pids
    echo -e "${GREEN}✅ Enhanced CCR Manager avviato${NC}"
else
    echo -e "${GREEN}✅ Enhanced CCR Manager già attivo${NC}"
fi

# Avvia Monitoring WebSocket Server
echo -e "${YELLOW}📊 Avviando Monitoring WebSocket Server...${NC}"
if ! pgrep -f "websocket-server" > /dev/null; then
    nohup npx ts-node packages/core/src/monitoring/websocket-server.ts > logs/monitoring-websocket.log 2>&1 &
    echo $! >> .devflow_pids
    echo -e "${GREEN}✅ Monitoring WebSocket Server avviato${NC}"
else
    echo -e "${GREEN}✅ Monitoring WebSocket Server già attivo${NC}"
fi

# Attende che tutti i servizi siano pronti
echo -e "${YELLOW}⏳ Attendendo inizializzazione servizi...${NC}"
sleep 3

# Configura CCR con fallback chain
echo -e "${YELLOW}⚙️ Configurando CCR Fallback Chain...${NC}"

export CCR_CONFIG_PATH="./configs/ccr-config.json"
export CCR_FALLBACK_CHAIN="codex,synthetic,gemini"
export CCR_MONITORING_ENABLED="true"
export CCR_CONTEXT_PRESERVATION="true"

# Avvia Claude Code sotto CCR
echo -e "${GREEN}🎯 Avviando Claude Code sotto CCR...${NC}"
echo -e "${BLUE}📝 Configurazione attiva:${NC}"
echo -e "   • Fallback Chain: Codex → Synthetic → Gemini"
echo -e "   • Context Preservation: Abilitato"
echo -e "   • Real-time Monitoring: Abilitato"
echo -e "   • Emergency Fallback: Abilitato"
echo ""
echo -e "${YELLOW}🔄 Per monitorare: tail -f logs/ccr-manager.log${NC}"
echo -e "${YELLOW}📊 Dashboard: http://localhost:3001/monitoring${NC}"
echo ""

# Comando CCR equivalente a: npx @musistudio/claude-code-router code
npx @musistudio/claude-code-router code \
    --config="$CCR_CONFIG_PATH" \
    --fallback-chain="$CCR_FALLBACK_CHAIN" \
    --monitoring \
    --context-preservation \
    --log-level=info

echo -e "${GREEN}✅ Sessione CCR terminata${NC}"