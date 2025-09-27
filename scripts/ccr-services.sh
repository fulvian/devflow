#!/bin/bash

# CCR Services Management Script
# Gestisce i servizi background necessari per CCR Fallback System

set -e

# Colori per output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Funzioni di utilità
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Avvia Codex MCP Server
start_codex_mcp() {
    log_info "Avviando Codex MCP Server..."
    
    if pgrep -f "codex.*mcp" > /dev/null; then
        log_warning "Codex MCP Server già attivo"
        return 0
    fi
    
    # Verifica esistenza directory
    if [ ! -d "mcp-servers/codex" ]; then
        log_error "Directory mcp-servers/codex non trovata"
        return 1
    fi
    
    cd mcp-servers/codex
    
    # Build se necessario
    if [ ! -d "dist" ] || [ ! -f "dist/index.js" ]; then
        log_info "Building Codex MCP Server..."
        npm run build > /dev/null 2>&1
    fi
    
    # Avvia il server
    OPENAI_API_KEY="$OPENAI_API_KEY" \
    CODEX_MODEL="gpt-4" \
    DEVFLOW_PROJECT_ROOT="$(pwd)/../.." \
    nohup node dist/index.js > ../../logs/codex-mcp-server.log 2>&1 &
    
    echo $! >> ../../.devflow_pids
    cd ../..
    
    log_success "Codex MCP Server avviato (PID: $!)"
}

# Avvia Enhanced CCR Manager
start_ccr_manager() {
    log_info "Avviando Enhanced CCR Manager..."
    
    if pgrep -f "enhanced-ccr-fallback-manager" > /dev/null; then
        log_warning "Enhanced CCR Manager già attivo"
        return 0
    fi
    
    # Verifica file esistente
    if [ ! -f "packages/core/src/coordination/enhanced-ccr-fallback-manager.ts" ]; then
        log_error "Enhanced CCR Manager non trovato"
        return 1
    fi
    
    # Avvia il manager
    CCR_CONFIG_PATH="./configs/ccr-config.json" \
    CCR_FALLBACK_CHAIN="codex,synthetic,gemini" \
    CCR_MONITORING_ENABLED="true" \
    nohup npx ts-node --esm -T packages/core/src/coordination/enhanced-ccr-fallback-manager.ts > logs/ccr-manager.log 2>&1 &
    
    echo $! >> .devflow_pids
    log_success "Enhanced CCR Manager avviato (PID: $!)"
}

# Avvia Monitoring WebSocket Server  
start_monitoring_websocket() {
    log_info "Avviando Monitoring WebSocket Server..."
    
    if pgrep -f "websocket-server" > /dev/null; then
        log_warning "Monitoring WebSocket Server già attivo"
        return 0
    fi
    
    # Verifica file esistente
    if [ ! -f "packages/core/src/monitoring/websocket-server.ts" ]; then
        log_error "Monitoring WebSocket Server non trovato"
        return 1
    fi
    
    # Avvia il server WebSocket
    WEBSOCKET_PORT="3001" \
    MONITORING_ENABLED="true" \
    nohup npx ts-node --esm -T packages/core/src/monitoring/websocket-server.ts > logs/monitoring-websocket.log 2>&1 &
    
    echo $! >> .devflow_pids
    log_success "Monitoring WebSocket Server avviato (PID: $!)"
}

# Avvia Metrics Collector
start_metrics_collector() {
    log_info "Avviando Metrics Collector..."
    
    if pgrep -f "metrics-collector" > /dev/null; then
        log_warning "Metrics Collector già attivo"
        return 0
    fi
    
    # Verifica file esistente
    if [ ! -f "packages/core/src/monitoring/metrics-collector.ts" ]; then
        log_error "Metrics Collector non trovato"
        return 1
    fi
    
    # Avvia il collector
    METRICS_COLLECTION_INTERVAL="5000" \
    METRICS_BUFFER_SIZE="1000" \
    nohup npx ts-node --esm -T packages/core/src/monitoring/metrics-collector.ts > logs/metrics-collector.log 2>&1 &
    
    echo $! >> .devflow_pids
    log_success "Metrics Collector avviato (PID: $!)"
}

# Avvia Automatic CCR Trigger
start_automatic_ccr_trigger() {
    log_info "Avviando Automatic CCR Trigger..."
    
    if pgrep -f "automatic-ccr-trigger" > /dev/null; then
        log_warning "Automatic CCR Trigger già attivo"
        return 0
    fi
    
    # Verifica file esistente
    if [ ! -f "packages/core/src/coordination/automatic-ccr-trigger.ts" ]; then
        log_error "Automatic CCR Trigger non trovato"
        return 1
    fi
    
    # Avvia il trigger automatico (JS runner senza dipendenze di rete)
    CCR_AUTO_TRIGGER="true" \
    CCR_TRIGGER_LEVEL="critical" \
    CCR_POLL_INTERVAL_MS="5000" \
    DEVFLOW_DB_PATH="./data/devflow_unified.sqlite" \
    CLAUDE_LIMIT_LOG="${CLAUDE_LIMIT_LOG:-logs/claude-usage.log}" \
    nohup node tools/auto-ccr-runner.js > logs/automatic-ccr-trigger.log 2>&1 &
    
    echo $! >> .devflow_pids
    log_success "Automatic CCR Trigger avviato (PID: $!)"
}

# Stop tutti i servizi CCR
stop_ccr_services() {
    log_info "Fermando servizi CCR..."
    
    # Stop Codex MCP Server
    pkill -f "codex.*mcp" 2>/dev/null || true
    
    # Stop Enhanced CCR Manager  
    pkill -f "enhanced-ccr-fallback-manager" 2>/dev/null || true
    
    # Stop Monitoring WebSocket Server
    pkill -f "websocket-server" 2>/dev/null || true
    
    # Stop Metrics Collector
    pkill -f "metrics-collector" 2>/dev/null || true
    
    # Stop Automatic CCR Trigger
    pkill -f "automatic-ccr-trigger" 2>/dev/null || true
    pkill -f "auto-ccr-runner.js" 2>/dev/null || true
    
    log_success "Servizi CCR fermati"
}

# Status dei servizi CCR
status_ccr_services() {
    log_info "Status servizi CCR:"
    echo ""
    
    echo -n "Codex MCP Server: "
    if pgrep -f "codex.*mcp" > /dev/null; then
        echo -e "${GREEN}ATTIVO${NC}"
    else
        echo -e "${RED}INATTIVO${NC}"
    fi
    
    echo -n "Enhanced CCR Manager: "
    if pgrep -f "enhanced-ccr-fallback-manager" > /dev/null; then
        echo -e "${GREEN}ATTIVO${NC}"
    else
        echo -e "${RED}INATTIVO${NC}"
    fi
    
    echo -n "Monitoring WebSocket Server: "
    if pgrep -f "websocket-server" > /dev/null; then
        echo -e "${GREEN}ATTIVO${NC}"
    else
        echo -e "${RED}INATTIVO${NC}"
    fi
    
    echo -n "Metrics Collector: "
    if pgrep -f "metrics-collector" > /dev/null; then
        echo -e "${GREEN}ATTIVO${NC}"
    else
        echo -e "${RED}INATTIVO${NC}"
    fi
    
    echo -n "Automatic CCR Trigger: "
    if pgrep -f "auto-ccr-runner.js\|automatic-ccr-trigger" > /dev/null; then
        echo -e "${GREEN}ATTIVO${NC}"
    else
        echo -e "${RED}INATTIVO${NC}"
    fi
    echo ""
}

# Avvia tutti i servizi CCR
start_all_ccr_services() {
    log_info "Avviando tutti i servizi CCR..."
    
    # Crea directory logs se non esiste
    mkdir -p logs
    
    start_codex_mcp
    sleep 2
    
    start_ccr_manager
    sleep 2
    
    start_monitoring_websocket
    sleep 2
    
    start_metrics_collector
    sleep 2
    
    start_automatic_ccr_trigger
    sleep 2
    
    log_success "Tutti i servizi CCR avviati"
    echo ""
    status_ccr_services
}

# Menu principale
case "$1" in
    start)
        start_all_ccr_services
        ;;
    stop)
        stop_ccr_services
        ;;
    status)
        status_ccr_services
        ;;
    restart)
        stop_ccr_services
        sleep 2
        start_all_ccr_services
        ;;
    codex)
        start_codex_mcp
        ;;
    manager)
        start_ccr_manager
        ;;
    websocket)
        start_monitoring_websocket
        ;;
    metrics)
        start_metrics_collector
        ;;
    trigger)
        start_automatic_ccr_trigger
        ;;
    *)
        echo "Uso: $0 {start|stop|status|restart|codex|manager|websocket|metrics|trigger}"
        echo ""
        echo "Comandi:"
        echo "  start     - Avvia tutti i servizi CCR"
        echo "  stop      - Ferma tutti i servizi CCR" 
        echo "  status    - Mostra status servizi CCR"
        echo "  restart   - Riavvia tutti i servizi CCR"
        echo "  codex     - Avvia solo Codex MCP Server"
        echo "  manager   - Avvia solo Enhanced CCR Manager"
        echo "  websocket - Avvia solo Monitoring WebSocket Server"
        echo "  metrics   - Avvia solo Metrics Collector"
        echo "  trigger   - Avvia solo Automatic CCR Trigger"
        exit 1
        ;;
esac
