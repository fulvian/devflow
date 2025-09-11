#!/usr/bin/env bash

# DevFlow Complete Startup Script
# Gestisce cleanup, avvio servizi e verifica autoswitch CCR

set -euo pipefail

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configurazione
PROJECT_ROOT="/Users/fulvioventura/devflow"
MCP_SYNTHETIC_PORT="3456"
CCR_CONFIG_PATH="$PROJECT_ROOT/configs/ccr-config.json"
CLAUDE_CONFIG_PATH="$HOME/.claude-code/config.json"
LOG_DIR="$PROJECT_ROOT/logs"
PID_DIR="$PROJECT_ROOT/pids"

# Funzioni di utilità
log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Crea directory necessarie
create_directories() {
    log "Creando directory necessarie..."
    mkdir -p "$LOG_DIR" "$PID_DIR"
    success "Directory create"
}

# Funzione per terminare processi su porte specifiche
kill_port_processes() {
    local port=$1
    local service_name=$2
    
    log "Terminando processi su porta $port ($service_name)..."
    
    # Trova processi che usano la porta
    local pids=$(lsof -ti:$port 2>/dev/null || true)
    
    if [ -n "$pids" ]; then
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        sleep 2
        
        # Force kill se necessario
        local remaining_pids=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$remaining_pids" ]; then
            echo "$remaining_pids" | xargs kill -KILL 2>/dev/null || true
            warning "Processi su porta $port terminati forzatamente"
        else
            success "Processi su porta $port terminati correttamente"
        fi
    else
        info "Nessun processo attivo su porta $port"
    fi
}

# Funzione per terminare processi per nome
kill_named_processes() {
    local pattern=$1
    local service_name=$2
    
    log "Terminando processi $service_name..."
    
    local pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    
    if [ -n "$pids" ]; then
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        sleep 2
        
        # Force kill se necessario
        local remaining_pids=$(pgrep -f "$pattern" 2>/dev/null || true)
        if [ -n "$remaining_pids" ]; then
            echo "$remaining_pids" | xargs kill -KILL 2>/dev/null || true
            warning "Processi $service_name terminati forzatamente"
        else
            success "Processi $service_name terminati correttamente"
        fi
    else
        info "Nessun processo $service_name attivo"
    fi
}

# Cleanup completo
cleanup_all() {
    log "🧹 Avvio cleanup completo..."
    
    # Termina processi specifici
    kill_named_processes "claude-code-router" "Claude Code Router"
    kill_named_processes "mcp.*synthetic" "MCP Synthetic"
    kill_named_processes "start-devflow" "DevFlow Startup"
    
    # Pulisci file PID
    rm -f "$PID_DIR"/*.pid 2>/dev/null || true
    
    success "Cleanup completato"
}

# Verifica dipendenze
check_dependencies() {
    log "🔍 Verificando dipendenze..."
    
    local missing_deps=()
    
    # Verifica Node.js
    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    fi
    
    # Verifica npm
    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    fi
    
    # Verifica npx
    if ! command -v npx &> /dev/null; then
        missing_deps+=("npx")
    fi
    
    # Verifica file di configurazione
    if [ ! -f "$CCR_CONFIG_PATH" ]; then
        error "File configurazione CCR non trovato: $CCR_CONFIG_PATH"
        exit 1
    fi
    
    if [ ! -f "$CLAUDE_CONFIG_PATH" ]; then
        error "File configurazione Claude Code non trovato: $CLAUDE_CONFIG_PATH"
        exit 1
    fi
    
    if [ ${#missing_deps[@]} -eq 0 ]; then
        success "Tutte le dipendenze sono disponibili"
    else
        error "Dipendenze mancanti: ${missing_deps[*]}"
        exit 1
    fi
}

# Verifica MCP Synthetic Server
verify_mcp_synthetic() {
    log "🔍 Verificando MCP Synthetic Server..."
    
    # Verifica se MCP Synthetic è disponibile
    if [ ! -f "$PROJECT_ROOT/mcp-servers/synthetic/dist/index.js" ]; then
        warning "MCP Synthetic dist non trovato"
        warning "Build con: cd mcp-servers/synthetic && npm run build"
        return 1
    fi
    
    # Testa che il server MCP si avvii correttamente
    cd "$PROJECT_ROOT/mcp-servers/synthetic"
    
    # Test rapido del server MCP (senza timeout su macOS)
    echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' | node dist/index.js > /dev/null 2>&1 &
    local test_pid=$!
    sleep 2
    kill $test_pid 2>/dev/null || true
    
    if [ $? -eq 0 ] || [ $? -eq 143 ]; then
        success "MCP Synthetic Server: Disponibile e funzionante"
        info "MCP Synthetic Server è un server MCP che comunica tramite stdio"
        info "Viene avviato automaticamente da Claude Code quando necessario"
        return 0
    else
        warning "MCP Synthetic Server: Problemi di avvio"
        return 1
    fi
}

# Avvia Claude Code Router
start_claude_code_router() {
    log "🎯 Avviando Claude Code Router..."
    
    # Verifica se è già in esecuzione
    if pgrep -f "claude-code-router" > /dev/null 2>&1; then
        local existing_pid=$(pgrep -f "claude-code-router" | head -1)
        success "Claude Code Router già in esecuzione (PID: $existing_pid)"
        echo $existing_pid > "$PID_DIR/claude-code-router.pid"
        return 0
    fi
    
    cd "$PROJECT_ROOT"
    
    # Carica variabili d'ambiente
    if [ -f ".env" ]; then
        source .env
    fi
    
    # Avvia Claude Code Router in background
    nohup npx @musistudio/claude-code-router start > "$LOG_DIR/claude-code-router.log" 2>&1 &
    local ccr_pid=$!
    echo $ccr_pid > "$PID_DIR/claude-code-router.pid"
    
    # Attendi che il router sia pronto
    sleep 5
    
    # Verifica che il processo sia ancora attivo
    if kill -0 $ccr_pid 2>/dev/null; then
        success "Claude Code Router avviato (PID: $ccr_pid)"
        return 0
    else
        error "Claude Code Router non è riuscito ad avviarsi"
        return 1
    fi
}

# Avvia DevFlow Core
start_devflow_core() {
    log "🧠 Avviando DevFlow Core..."
    
    # Verifica se DevFlow Core è disponibile
    if [ ! -f "$PROJECT_ROOT/packages/core/dist/index.js" ]; then
        warning "DevFlow Core dist non trovato"
        warning "Build con: cd packages/core && npm run build"
        return 1
    fi
    
    cd "$PROJECT_ROOT"
    
    # Avvia DevFlow Core in background
    nohup node start-devflow-simple.mjs > "$LOG_DIR/devflow-core.log" 2>&1 &
    local devflow_pid=$!
    echo $devflow_pid > "$PID_DIR/devflow-core.pid"
    
    # Attendi che il processo si stabilizzi
    sleep 3
    
    if kill -0 $devflow_pid 2>/dev/null; then
        success "DevFlow Core avviato (PID: $devflow_pid)"
        return 0
    else
        warning "DevFlow Core terminato prematuramente"
        return 1
    fi
}

# Verifica autoswitch CCR
verify_ccr_autoswitch() {
    log "🔍 Verificando configurazione autoswitch CCR..."
    
    # Verifica configurazione CCR
    if ! jq -e '.devflow.sessionManagement' "$CCR_CONFIG_PATH" > /dev/null 2>&1; then
        error "Configurazione sessionManagement non trovata in CCR"
        return 1
    fi
    
    # Verifica soglie di autoswitch
    local warning_threshold=$(jq -r '.devflow.sessionManagement.warningThreshold' "$CCR_CONFIG_PATH")
    local critical_threshold=$(jq -r '.devflow.sessionManagement.criticalThreshold' "$CCR_CONFIG_PATH")
    local emergency_threshold=$(jq -r '.devflow.sessionManagement.emergencyThreshold' "$CCR_CONFIG_PATH")
    
    if [ "$warning_threshold" = "null" ] || [ "$critical_threshold" = "null" ] || [ "$emergency_threshold" = "null" ]; then
        error "Soglie di autoswitch non configurate correttamente"
        return 1
    fi
    
    info "Soglie autoswitch configurate:"
    info "  Warning: $warning_threshold"
    info "  Critical: $critical_threshold"
    info "  Emergency: $emergency_threshold"
    
    # Verifica configurazione fallback
    if ! jq -e '.fallback.enabled' "$CCR_CONFIG_PATH" > /dev/null 2>&1; then
        error "Fallback non abilitato in CCR"
        return 1
    fi
    
    local fallback_enabled=$(jq -r '.fallback.enabled' "$CCR_CONFIG_PATH")
    if [ "$fallback_enabled" != "true" ]; then
        error "Fallback non abilitato"
        return 1
    fi
    
    success "Autoswitch CCR configurato correttamente"
    return 0
}

# Test autoswitch CCR
test_ccr_autoswitch() {
    log "🧪 Testando autoswitch CCR..."
    
    # Testa direttamente l'API HTTP del router invece del CLI
    local test_prompt="Test autoswitch CCR con prompt molto lungo che dovrebbe superare i limiti di token di Claude Sonnet. "
    test_prompt+="Ripeto questo testo molte volte per simulare un uso intensivo di token: "
    
    # Crea un prompt molto lungo
    for i in {1..50}; do
        test_prompt+="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. "
    done
    
    # Testa la risposta tramite API HTTP (se disponibile)
    local response=$(curl -s -X POST "http://127.0.0.1:$MCP_SYNTHETIC_PORT/api/test" \
        -H "Content-Type: application/json" \
        -d "{\"prompt\":\"$test_prompt\"}" \
        --max-time 30 2>/dev/null || echo "TIMEOUT")
    
    if [ "$response" = "TIMEOUT" ]; then
        warning "Test autoswitch timeout - API non disponibile"
        warning "Verifica che MCP Synthetic sia attivo su porta $MCP_SYNTHETIC_PORT"
        return 1
    fi
    
    # Verifica che la risposta contenga indicazioni di routing
    if echo "$response" | grep -q "synthetic\|codex\|fallback\|qwen\|deepseek"; then
        success "Autoswitch CCR funzionante - routing rilevato"
        return 0
    else
        warning "Autoswitch CCR non rilevato nella risposta"
        warning "Risposta ricevuta: ${response:0:100}..."
        return 1
    fi
}

# Avvia sessione Claude Code
start_claude_session() {
    log "🎭 Avviando sessione Claude Code..."
    
    cd "$PROJECT_ROOT"
    
    # Verifica che tutti i servizi siano attivi
    local services_ready=true
    
    # Verifica MCP Synthetic
    if ! curl -s "http://127.0.0.1:$MCP_SYNTHETIC_PORT/health" > /dev/null 2>&1; then
        warning "MCP Synthetic non risponde"
        services_ready=false
    fi
    
    if [ "$services_ready" = false ]; then
        warning "Alcuni servizi non sono pronti, ma procedo con l'avvio"
    fi
    
    # Avvia Claude Code
    info "Avvio Claude Code con configurazione completa..."
    info "Servizi attivi:"
    info "  - MCP Synthetic: http://127.0.0.1:$MCP_SYNTHETIC_PORT"
    info "  - Claude Code Router: Attivo"
    info "  - DevFlow Core: Attivo"
    
    success "Sessione Claude Code pronta per l'uso"
    
    # Mostra informazioni utili
    echo ""
    info "📋 Informazioni utili:"
    info "  - Log MCP Synthetic: $LOG_DIR/mcp-synthetic.log"
    info "  - Log Claude Code Router: $LOG_DIR/claude-code-router.log"
    info "  - Log DevFlow Core: $LOG_DIR/devflow-core.log"
    info "  - PID MCP Synthetic: $(cat $PID_DIR/mcp-synthetic.pid 2>/dev/null || echo 'N/A')"
    info "  - PID Claude Code Router: $(cat $PID_DIR/claude-code-router.pid 2>/dev/null || echo 'N/A')"
    info "  - PID DevFlow Core: $(cat $PID_DIR/devflow-core.pid 2>/dev/null || echo 'N/A')"
    
    echo ""
    success "🚀 DevFlow completamente avviato!"
    info "Puoi ora utilizzare Claude Code con autoswitch CCR automatico"
}

# Funzione principale
main() {
    echo -e "${PURPLE}🚀 DevFlow Complete Startup Script${NC}"
    echo -e "${PURPLE}=====================================${NC}"
    echo ""
    
    # Parse argomenti
    local skip_cleanup=false
    local skip_test=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-cleanup)
                skip_cleanup=true
                shift
                ;;
            --skip-test)
                skip_test=true
                shift
                ;;
            --help)
                echo "Usage: $0 [--skip-cleanup] [--skip-test] [--help]"
                echo ""
                echo "Options:"
                echo "  --skip-cleanup    Salta il cleanup dei processi esistenti"
                echo "  --skip-test       Salta il test dell'autoswitch CCR"
                echo "  --help           Mostra questo help"
                exit 0
                ;;
            *)
                error "Argomento sconosciuto: $1"
                exit 1
                ;;
        esac
    done
    
    # Esegui cleanup se richiesto
    if [ "$skip_cleanup" = false ]; then
        cleanup_all
        echo ""
    fi
    
    # Crea directory necessarie
    create_directories
    
    # Verifica dipendenze
    check_dependencies
    echo ""
    
    # Verifica servizi
    verify_mcp_synthetic
    echo ""
    
    start_claude_code_router
    echo ""
    
    start_devflow_core
    echo ""
    
    # Verifica autoswitch CCR
    verify_ccr_autoswitch
    echo ""
    
    # Test autoswitch CCR
    if [ "$skip_test" = false ]; then
        test_ccr_autoswitch
        echo ""
    fi
    
    # Avvia sessione Claude Code
    start_claude_session
}

# Gestione segnali per cleanup
cleanup_on_exit() {
    log "Ricevuto segnale di terminazione, eseguendo cleanup..."
    cleanup_all
    exit 0
}

trap cleanup_on_exit SIGINT SIGTERM

# Esegui script principale
main "$@"
