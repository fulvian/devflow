#!/usr/bin/env bash

# DevFlow Complete Stop Script
# Termina tutti i servizi DevFlow in modo pulito

set -euo pipefail

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurazione
PROJECT_ROOT="/Users/fulvioventura/devflow"
CTIR_PORT="3456"
CTIR_ANALYZER_PORT="3001"
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
    echo -e "${BLUE}ℹ️  $1${NC}"
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

# Termina processi usando file PID
kill_pid_files() {
    log "Terminando processi usando file PID..."
    
    if [ -d "$PID_DIR" ]; then
        for pid_file in "$PID_DIR"/*.pid; do
            if [ -f "$pid_file" ]; then
                local pid=$(cat "$pid_file")
                local service_name=$(basename "$pid_file" .pid)
                
                if kill -0 "$pid" 2>/dev/null; then
                    log "Terminando $service_name (PID: $pid)..."
                    kill -TERM "$pid" 2>/dev/null || true
                    sleep 2
                    
                    if kill -0 "$pid" 2>/dev/null; then
                        kill -KILL "$pid" 2>/dev/null || true
                        warning "$service_name terminato forzatamente"
                    else
                        success "$service_name terminato correttamente"
                    fi
                else
                    info "$service_name non attivo"
                fi
                
                rm -f "$pid_file"
            fi
        done
    else
        info "Directory PID non trovata"
    fi
}

# Stop completo
stop_all() {
    log "🛑 Avvio stop completo DevFlow..."
    
    # Termina processi usando file PID
    kill_pid_files
    echo ""
    
    # Termina processi su porte specifiche
    kill_port_processes "$CTIR_PORT" "CTIR"
    kill_port_processes "$CTIR_ANALYZER_PORT" "CTIR Analyzer"
    echo ""
    
    # Termina processi specifici
    kill_named_processes "claude-code-router" "Claude Code Router"
    kill_named_processes "ctir.*dist/index.js" "CTIR Server"
    kill_named_processes "mcp.*synthetic" "MCP Synthetic"
    kill_named_processes "ctir-router-mcp" "CTIR Router MCP"
    echo ""
    
    # Pulisci file PID
    rm -f "$PID_DIR"/*.pid 2>/dev/null || true
    
    success "Stop completato"
}

# Verifica stato
check_status() {
    log "📊 Verificando stato servizi..."
    
    local services_running=0
    local total_services=4
    
    # Verifica CTIR
    if curl -s "http://127.0.0.1:$CTIR_PORT/health" > /dev/null 2>&1; then
        info "CTIR: Attivo"
        services_running=$((services_running + 1))
    else
        info "CTIR: Non attivo"
    fi
    
    # Verifica CTIR Analyzer
    if curl -s "http://127.0.0.1:$CTIR_ANALYZER_PORT/health" > /dev/null 2>&1; then
        info "CTIR Analyzer: Attivo"
        services_running=$((services_running + 1))
    else
        info "CTIR Analyzer: Non attivo"
    fi
    
    # Verifica Claude Code Router
    if pgrep -f "claude-code-router" > /dev/null 2>&1; then
        info "Claude Code Router: Attivo"
        services_running=$((services_running + 1))
    else
        info "Claude Code Router: Non attivo"
    fi
    
    # Verifica MCP Synthetic
    if pgrep -f "mcp.*synthetic" > /dev/null 2>&1; then
        info "MCP Synthetic: Attivo"
        services_running=$((services_running + 1))
    else
        info "MCP Synthetic: Non attivo"
    fi
    
    echo ""
    if [ $services_running -eq 0 ]; then
        success "Tutti i servizi sono stati fermati"
    else
        warning "$services_running/$total_services servizi ancora attivi"
    fi
}

# Funzione principale
main() {
    echo -e "${RED}🛑 DevFlow Complete Stop Script${NC}"
    echo -e "${RED}=================================${NC}"
    echo ""
    
    # Parse argomenti
    local status_only=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --status)
                status_only=true
                shift
                ;;
            --help)
                echo "Usage: $0 [--status] [--help]"
                echo ""
                echo "Options:"
                echo "  --status    Mostra solo lo stato dei servizi senza fermarli"
                echo "  --help      Mostra questo help"
                exit 0
                ;;
            *)
                error "Argomento sconosciuto: $1"
                exit 1
                ;;
        esac
    done
    
    if [ "$status_only" = true ]; then
        check_status
    else
        stop_all
        echo ""
        check_status
    fi
}

# Esegui script principale
main "$@"
