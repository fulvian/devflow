# Synthetic API Troubleshooting Guide

## Problema Risolto: Errori di Billing e Modelli Non Disponibili

### Situazione Iniziale
- Errore 402: "Your plan doesn't cover on-demand models, and there's insufficient credit balance"
- Modelli come `hf:mistralai/Mistral-7B-Instruct-v0.3` causavano errori di billing
- Il modello `hf:Qwen/Qwen-72B-Chat` non era disponibile

### Soluzione Implementata

#### 1. Test di Disponibilità Modelli
Creato script di test (`tools/test-synthetic-models.js`) che verifica:
- Disponibilità di tutti i modelli configurati
- Rilevamento automatico di errori di billing
- Raccomandazioni per modelli alternativi

#### 2. Configurazione Ottimizzata
Aggiornata `configs/ccr-config.json` con:

```json
{
  "Providers": [
    {
      "name": "synthetic_provider",
      "api_base_url": "https://api.synthetic.new/v1/chat/completions",
      "api_key": "syn_4f04a1a3108cfbb64ac973367542d361",
      "models": [
        "hf:Qwen/Qwen3-Coder-480B-A35B-Instruct",
        "hf:Qwen/Qwen2.5-Coder-32B-Instruct", 
        "hf:deepseek-ai/DeepSeek-V3"
      ]
    }
  ],
  "Router": {
    "default": "synthetic_provider,hf:Qwen/Qwen3-Coder-480B-A35B-Instruct",
    "codex": "synthetic_provider,hf:Qwen/Qwen3-Coder-480B-A35B-Instruct",
    "synthetic": "synthetic_provider,hf:Qwen/Qwen3-Coder-480B-A35B-Instruct",
    "longContext": "synthetic_provider,hf:deepseek-ai/DeepSeek-V3",
    "fallback": "synthetic_provider,hf:Qwen/Qwen2.5-Coder-32B-Instruct"
  }
}
```

#### 3. Modelli Verificati e Funzionanti
✅ **Disponibili:**
- `hf:Qwen/Qwen3-Coder-480B-A35B-Instruct` (Modello principale per Codex)
- `hf:Qwen/Qwen2.5-Coder-32B-Instruct` (Fallback)
- `hf:deepseek-ai/DeepSeek-V3` (Contesto lungo)

❌ **Problemi:**
- `hf:mistralai/Mistral-7B-Instruct-v0.3` (Errori di billing)
- `hf:Qwen/Qwen-72B-Chat` (Non disponibile)

### Caratteristiche del Modello Principale

#### Qwen3-Coder-480B-A35B-Instruct
- **Architettura:** Mixture-of-Experts (MoE) con 480B parametri totali, 35B attivi
- **Contesto:** 256K token nativi, estendibile a 1M con YaRN
- **Specializzazione:** Codifica agentica, utilizzo browser, attività di coding
- **Performance:** Paragonabile a Claude Sonnet per task di coding

#### Parametri Ottimali
```json
{
  "temperature": 0.7,
  "top_p": 0.8,
  "top_k": 20,
  "repetition_penalty": 1.05,
  "max_new_tokens": 65536
}
```

### Gestione Errori Implementata

#### Fallback Chain
1. **Primario:** `hf:Qwen/Qwen3-Coder-480B-A35B-Instruct`
2. **Secondario:** `hf:Qwen/Qwen2.5-Coder-32B-Instruct`
3. **Contesto Lungo:** `hf:deepseek-ai/DeepSeek-V3`

#### Error Handling
- Rilevamento automatico errori di billing (402)
- Fallback automatico a modelli disponibili
- Retry con timeout configurabile (30s)
- Logging dettagliato per debugging

### Comandi di Test

#### Test Modelli Disponibili
```bash
node tools/test-synthetic-models.js
```

#### Test Configurazione CCR
```bash
# Test con modello principale
echo "Test Qwen3-Coder" | npx @musistudio/claude-code-router

# Test con fallback
echo "Test fallback" | npx @musistudio/claude-code-router --route fallback
```

### Monitoraggio e Manutenzione

#### Verifica Periodica
- Eseguire test modelli settimanalmente
- Monitorare errori di billing
- Aggiornare configurazione se necessario

#### Risoluzione Problemi Billing
1. Visitare https://synthetic.new/billing
2. Verificare crediti disponibili
3. Aggiornare piano se necessario
4. Utilizzare modelli fallback durante problemi

### File di Configurazione

- **Principale:** `configs/ccr-config.json`
- **Fallback:** `configs/ccr-config-fallback.json`
- **Test:** `tools/test-synthetic-models.js`

### Prossimi Passi

1. ✅ Configurazione corretta implementata
2. ✅ Modello Qwen3-Coder-480B-A35B-Instruct come principale
3. ✅ Fallback chain funzionante
4. 🔄 Test integrazione completa
5. 🔄 Monitoraggio performance

### Note Tecniche

- Il modello Qwen3-Coder richiede `transformers >= 4.51.0`
- Gestione memoria ottimizzata per modelli MoE
- Supporto completo per chiamate di funzione
- Integrazione nativa con DevFlow context transformer
