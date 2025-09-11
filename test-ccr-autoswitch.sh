#!/usr/bin/env bash

# Test Autoswitch CCR
# Verifica che l'autoswitch CCR funzioni correttamente

set -euo pipefail

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurazione
PROJECT_ROOT="/Users/fulvioventura/devflow"

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

# Test autoswitch CCR
test_ccr_autoswitch() {
    log "🧪 Testando autoswitch CCR..."
    
    cd "$PROJECT_ROOT"
    
    # Verifica che CCR sia attivo
    if ! pgrep -f "claude-code-router" > /dev/null 2>&1; then
        error "Claude Code Router non è attivo"
        return 1
    fi
    
    # Crea un prompt molto lungo per triggerare l'autoswitch
    local long_prompt="Test autoswitch CCR con prompt molto lungo che dovrebbe superare i limiti di token di Claude Sonnet. "
    long_prompt+="Ripeto questo testo molte volte per simulare un uso intensivo di token: "
    
    # Crea un prompt molto lungo
    for i in {1..50}; do
        long_prompt+="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. "
    done
    
    long_prompt+="Ora rispondi con una breve analisi di questo testo e dimmi quale modello stai usando."
    
    info "Invio prompt lungo a CCR..."
    info "Lunghezza prompt: ${#long_prompt} caratteri"
    
    # Testa la risposta del router
    local response=$(echo "$long_prompt" | timeout 60s npx @musistudio/claude-code-router 2>/dev/null || echo "TIMEOUT")
    
    if [ "$response" = "TIMEOUT" ]; then
        warning "Test autoswitch timeout - potrebbe indicare problemi di configurazione"
        return 1
    fi
    
    info "Risposta ricevuta (primi 200 caratteri):"
    echo "${response:0:200}..."
    echo ""
    
    # Verifica che la risposta contenga indicazioni di routing
    if echo "$response" | grep -qi "synthetic\|codex\|fallback\|qwen\|deepseek"; then
        success "Autoswitch CCR funzionante - routing rilevato nella risposta"
        
        # Verifica specifica del modello
        if echo "$response" | grep -qi "qwen"; then
            success "Modello Qwen rilevato - autoswitch a Synthetic funzionante"
        elif echo "$response" | grep -qi "deepseek"; then
            success "Modello DeepSeek rilevato - autoswitch a Synthetic funzionante"
        else
            warning "Routing rilevato ma modello specifico non identificato"
        fi
        
        return 0
    else
        warning "Autoswitch CCR non rilevato nella risposta"
        warning "La risposta potrebbe essere da Claude Sonnet invece che da Synthetic"
        return 1
    fi
}

# Test configurazione CCR
test_ccr_config() {
    log "🔍 Testando configurazione CCR..."
    
    local ccr_config="$PROJECT_ROOT/configs/ccr-config.json"
    
    if [ ! -f "$ccr_config" ]; then
        error "File configurazione CCR non trovato: $ccr_config"
        return 1
    fi
    
    # Verifica configurazione autoswitch
    if ! jq -e '.devflow.sessionManagement' "$ccr_config" > /dev/null 2>&1; then
        error "Configurazione sessionManagement non trovata in CCR"
        return 1
    fi
    
    # Verifica soglie
    local warning_threshold=$(jq -r '.devflow.sessionManagement.warningThreshold' "$ccr_config")
    local critical_threshold=$(jq -r '.devflow.sessionManagement.criticalThreshold' "$ccr_config")
    local emergency_threshold=$(jq -r '.devflow.sessionManagement.emergencyThreshold' "$ccr_config")
    
    info "Soglie autoswitch configurate:"
    info "  Warning: $warning_threshold"
    info "  Critical: $critical_threshold"
    info "  Emergency: $emergency_threshold"
    
    # Verifica fallback
    local fallback_enabled=$(jq -r '.fallback.enabled' "$ccr_config")
    if [ "$fallback_enabled" != "true" ]; then
        error "Fallback non abilitato"
        return 1
    fi
    
    success "Configurazione CCR valida"
    return 0
}

# Test servizi
test_services() {
    log "🔍 Testando servizi..."
    
    local services_ok=true
    
    # Verifica MCP Synthetic
    if curl -s "http://127.0.0.1:3000/health" > /dev/null 2>&1; then
        success "MCP Synthetic: Attivo"
    else
        error "MCP Synthetic: Non risponde"
        services_ok=false
    fi
    
    # Verifica Claude Code Router
    if pgrep -f "claude-code-router" > /dev/null 2>&1; then
        success "Claude Code Router: Attivo"
    else
        error "Claude Code Router: Non attivo"
        services_ok=false
    fi
    
    # Verifica DevFlow Startup
    if pgrep -f "start-devflow" > /dev/null 2>&1; then
        success "DevFlow Startup: Attivo"
    else
        error "DevFlow Startup: Non attivo"
        services_ok=false
    fi
    
    if [ "$services_ok" = true ]; then
        success "Tutti i servizi sono attivi"
        return 0
    else
        error "Alcuni servizi non sono attivi"
        return 1
    fi
}

# Funzione principale
main() {
    echo -e "${BLUE}🧪 Test Autoswitch CCR${NC}"
    echo -e "${BLUE}======================${NC}"
    echo ""
    
    local all_tests_passed=true
    
    # Test configurazione
    if ! test_ccr_config; then
        all_tests_passed=false
    fi
    echo ""
    
    # Test servizi
    if ! test_services; then
        all_tests_passed=false
    fi
    echo ""
    
    # Test autoswitch
    if ! test_ccr_autoswitch; then
        all_tests_passed=false
    fi
    echo ""
    
    # Risultato finale
    if [ "$all_tests_passed" = true ]; then
        success "🎉 TUTTI I TEST SUPERATI!"
        success "L'autoswitch CCR è configurato e funzionante"
        success "Claude Code può delegare automaticamente a Synthetic quando necessario"
    else
        error "❌ ALCUNI TEST FALLITI"
        error "Verificare la configurazione e i servizi"
    fi
}

# Esegui script principale
main "$@"
